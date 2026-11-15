#!/usr/bin/env python3
"""
Load real Argo profile NetCDF files (GDAC "prof" format, NetCDF-3) into the FloatChat database.

Usage:  python3 scripts/ingest_argo.py <file-or-dir> [...]
Env:    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (server-side only; never commit)

Rules (nothing is invented):
- data_mode 'R'  -> raw PRES/TEMP/PSAL and their *_QC, is_adjusted = false
- data_mode 'A'/'D' -> *_ADJUSTED values and *_ADJUSTED_QC, is_adjusted = true
- a level is kept only when its pressure value is present (not the NetCDF fill value)
- values are rounded to 4 decimals only to strip float32 noise (Argo resolution is 0.001)
- every row gets data_source = 'real' and source_file = the NetCDF file name
"""
import os, sys, glob, json, datetime, requests
import numpy as np
from scipy.io import netcdf_file

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Content-Type": "application/json"}
if not KEY.startswith("sb_"):
    H["Authorization"] = "Bearer " + KEY
FILL = 99999.0
EPOCH = datetime.datetime(1950, 1, 1, tzinfo=datetime.timezone.utc)


def s(arr):
    return b"".join(arr.tolist()).decode("latin-1").strip()


def qc(ch):
    c = ch.decode("latin-1") if isinstance(ch, bytes) else str(ch)
    return int(c) if c.isdigit() else None


def val(x):
    x = float(x)
    if not np.isfinite(x) or abs(x) >= FILL:
        return None
    return round(x, 4)


def post(table, rows, on_conflict=None, returning=False):
    params = {}
    if on_conflict:
        params["on_conflict"] = on_conflict
    prefer = ["resolution=merge-duplicates" if on_conflict else "resolution=ignore-duplicates",
              "return=representation" if returning else "return=minimal"]
    r = requests.post(f"{URL}/rest/v1/{table}", params=params, headers={**H, "Prefer": ",".join(prefer)},
                      data=json.dumps(rows), timeout=300)
    if r.status_code >= 300:
        raise SystemExit(f"{table} insert failed: {r.status_code} {r.text[:500]}")
    return r.json() if returning else None


def read_file(path):
    f = netcdf_file(path, "r", mmap=False)
    v = f.variables
    name = os.path.basename(path)
    n_prof = f.dimensions["N_PROF"]
    out, dropped = [], 0
    for i in range(n_prof):
        lat, lon = val(v["LATITUDE"][i]), val(v["LONGITUDE"][i])
        juld = float(v["JULD"][i])
        t = None if juld >= 999999 else (EPOCH + datetime.timedelta(seconds=round(juld * 86400))).isoformat()
        mode = v["DATA_MODE"][i].decode()
        adj = mode in ("A", "D")
        sfx = "_ADJUSTED" if adj else ""
        pres, temp, psal = v["PRES" + sfx][i], v["TEMP" + sfx][i], v["PSAL" + sfx][i]
        pq, tq, sq = v["PRES" + sfx + "_QC"][i], v["TEMP" + sfx + "_QC"][i], v["PSAL" + sfx + "_QC"][i]
        levels = []
        for k in range(len(pres)):
            p = val(pres[k])
            if p is None:
                if val(v["PRES"][i][k]) is not None:
                    dropped += 1
                continue
            levels.append(dict(level_index=k, pressure=p, temperature=val(temp[k]), salinity=val(psal[k]),
                               pres_qc=qc(pq[k]), temp_qc=qc(tq[k]), psal_qc=qc(sq[k]), is_adjusted=adj))
        out.append(dict(
            wmo=s(v["PLATFORM_NUMBER"][i]), cycle=int(v["CYCLE_NUMBER"][i]), direction=v["DIRECTION"][i].decode(),
            scheme=s(v["VERTICAL_SAMPLING_SCHEME"][i]), date_update=s(v["DATE_UPDATE"][()]) if v["DATE_UPDATE"].shape == (14,) else "",
            time=t, juld_qc=qc(v["JULD_QC"][i]), lat=lat, lon=lon, pos_qc=qc(v["POSITION_QC"][i]), mode=mode,
            file=name, levels=levels,
            float=dict(platform_type=s(v["PLATFORM_TYPE"][i]) if "PLATFORM_TYPE" in v else None,
                       wmo_inst_type=s(v["WMO_INST_TYPE"][i]), project_name=s(v["PROJECT_NAME"][i]),
                       pi_name=s(v["PI_NAME"][i]), data_centre=s(v["DATA_CENTRE"][i]))))
    f.close()
    return out, dropped


def main(paths):
    files = []
    for p in paths:
        files += sorted(glob.glob(os.path.join(p, "*.nc"))) if os.path.isdir(p) else [p]
    profiles, dropped_total = {}, 0
    for path in files:
        rows, dropped = read_file(path)
        dropped_total += dropped
        print(f"{os.path.basename(path)}: {len(rows)} profiles, {sum(len(r['levels']) for r in rows)} levels, {dropped} levels without adjusted pressure skipped")
        for r in rows:
            key = (r["wmo"], r["cycle"], r["direction"], r["scheme"])
            if key not in profiles or r["date_update"] > profiles[key]["date_update"]:
                profiles[key] = r
    prof = list(profiles.values())
    # profile ids: <wmo>_<cycle:03d>[D][_k]
    seen = {}
    for r in sorted(prof, key=lambda r: (r["wmo"], r["cycle"], r["direction"], r["scheme"])):
        base = f"{r['wmo']}_{r['cycle']:03d}{'D' if r['direction'] == 'D' else ''}"
        k = seen.get(base, 0)
        seen[base] = k + 1
        r["profile_id"] = base if k == 0 else f"{base}_{k}"

    floats = {}
    for r in prof:
        floats[r["wmo"]] = {"float_id": r["wmo"], **r["float"]}
    post("floats", list(floats.values()), on_conflict="float_id")

    cyc = sorted({(r["wmo"], r["cycle"]) for r in prof})
    ids = {}
    for i in range(0, len(cyc), 1000):
        res = post("cycles", [{"float_id": w, "cycle_number": c} for w, c in cyc[i:i + 1000]],
                   on_conflict="float_id,cycle_number", returning=True)
        for x in res:
            ids[(x["float_id"], x["cycle_number"])] = x["cycle_id"]

    prow = [dict(profile_id=r["profile_id"], cycle_id=ids[(r["wmo"], r["cycle"])], direction=r["direction"],
                 profile_time=r["time"], juld_qc=r["juld_qc"], latitude=r["lat"], longitude=r["lon"],
                 position_qc=r["pos_qc"], data_mode=r["mode"], data_source="real", source_file=r["file"],
                 vertical_sampling_scheme=r["scheme"]) for r in prof]
    for i in range(0, len(prow), 500):
        post("profiles", prow[i:i + 500], on_conflict="profile_id")

    batch, total = [], 0
    for r in prof:
        for lv in r["levels"]:
            batch.append({"profile_id": r["profile_id"], **lv})
            if len(batch) >= 5000:
                post("measurements", batch, on_conflict="profile_id,level_index")
                total += len(batch); batch = []
                print(f"  measurements loaded: {total}", flush=True)
    if batch:
        post("measurements", batch, on_conflict="profile_id,level_index")
        total += len(batch)
    # Refresh the precomputed dashboard summaries (per-profile levels, QC flag counts).
    rr = requests.post(f"{URL}/rest/v1/rpc/floatchat_refresh_summaries", headers=H, json={}, timeout=600)
    rr.raise_for_status()
    print(json.dumps({"files": len(files), "floats": len(floats), "cycles": len(cyc), "profiles": len(prow),
                      "measurements": total, "levels_skipped_no_adjusted_pressure": dropped_total}))


if __name__ == "__main__":
    main(sys.argv[1:] or ["."])
