import { describe, it, expect } from "vitest";
import { groupProfiles, depthProfile, tsDiagram, timeSeries, toleranceFor, num } from "@/lib/floatchat/chartData";

const m = (pressure: unknown, temperature: unknown, salinity: unknown, qc: Partial<Record<"pres_qc" | "temp_qc" | "psal_qc", unknown>> = {}) => ({
  profile_id: "P1", float_id: "F1", cycle_number: 1, profile_time: "2026-01-01T00:00:00Z",
  pressure, temperature, salinity, pres_qc: 1, temp_qc: 1, psal_qc: 1, ...qc,
});

describe("graph data mapping", () => {
  it("drops null and fill values instead of plotting them as 0", () => {
    const r = depthProfile([m(10, null, 35), m(20, 99999, 35), m(30, 25.5, 35), m(null, 26, 35)], "temperature");
    expect(r.x).toEqual([25.5]);
    expect(r.y).toEqual([30]);
    expect(r.x).not.toContain(0);
    expect(r.missing).toBe(3);
    expect(num("")).toBeNull();
  });

  it("uses only QC flags 1 and 2 by default; flag 3/4 and missing flags are excluded", () => {
    const rows = [m(5, 28, 35), m(10, 27.9, 35, { temp_qc: 2 }), m(15, 27, 35, { temp_qc: 4 }), m(20, 26, 35, { temp_qc: 3 }), m(25, 25, 35, { temp_qc: null }), m(30, 24, 35, { pres_qc: 4 })];
    const r = depthProfile(rows, "temperature");
    expect(r.y).toEqual([5, 10]);
    expect(r.qcRejected).toBe(4);
    expect(depthProfile(rows, "temperature", { includeAllQc: true }).plotted).toBe(6);
  });

  it("depth profile is pressure in dbar sorted from the surface down", () => {
    const r = depthProfile([m(500, 10, 35), m(5, 28, 35), m(100, 20, 35)], "salinity");
    expect(r.y).toEqual([5, 100, 500]);
  });

  it("T-S diagram: x salinity, y temperature, colour pressure; needs all three valid", () => {
    const r = tsDiagram([m(5, 28, 34.1), m(50, 20, null), m(100, 15, 35.2)]);
    expect(r.x).toEqual([34.1, 35.2]);
    expect(r.y).toEqual([28, 15]);
    expect(r.c).toEqual([5, 100]);
  });

  it("groups rows into one entry per profile and ignores rows without depth readings", () => {
    const g = groupProfiles([m(5, 28, 35), { ...m(5, 27, 35), profile_id: "P2" }, { avg_temperature: 28 }]);
    expect(g.map((p) => p.key)).toEqual(["P1", "P2"]);
  });
});

describe("time graph (one float)", () => {
  const r = (pid: string, time: string | null, pressure: number, temperature: number | null, qc = 1) => ({
    profile_id: pid, cycle_number: Number(pid.slice(1)), profile_time: time, pressure, temperature, salinity: 35, pres_qc: 1, temp_qc: qc, psal_qc: 1,
  });

  it("one point per cycle, nearest to 10 dbar, ordered by profile time", () => {
    const { points } = timeSeries(
      [r("C2", "2026-02-01", 8, 27), r("C2", "2026-02-01", 11, 26.5), r("C1", "2026-01-01", 12, 28), r("C1", "2026-01-01", 30, 20)],
      "temperature", 10,
    );
    expect(points.map((p) => p.profileId)).toEqual(["C1", "C2"]);
    expect(points.map((p) => p.value)).toEqual([28, 26.5]);
  });

  it("skips cycles with no valid reading inside the tolerance, no time, or bad QC", () => {
    const { points, cyclesSkipped } = timeSeries(
      [r("C1", "2026-01-01", 10, 28), r("C2", "2026-02-01", 40, 27), r("C3", null, 10, 26), r("C4", "2026-03-01", 10, 25, 4), r("C5", "2026-04-01", 10, null)],
      "temperature", 10,
    );
    expect(points.map((p) => p.profileId)).toEqual(["C1"]);
    expect(cyclesSkipped).toBe(4);
  });

  it("tolerance is 5 dbar near the surface and 5% deeper down", () => {
    expect(toleranceFor(10)).toBe(5);
    expect(toleranceFor(1000)).toBe(50);
  });
});
