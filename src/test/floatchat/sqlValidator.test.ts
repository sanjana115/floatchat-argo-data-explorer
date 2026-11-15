import { describe, it, expect } from "vitest";
import { validateSql, DEFAULT_MAX_LIMIT } from "@/lib/floatchat/sqlValidator";

const GOOD = "SELECT c.float_id, c.cycle_number, p.profile_id, m.temperature FROM measurements m JOIN profiles p ON m.profile_id = p.profile_id JOIN cycles c ON p.cycle_id = c.cycle_id WHERE m.pressure <= 10";
const err = (sql: string) => {
  const r = validateSql(sql);
  return r.ok ? null : r.error;
};

describe("SQL validator", () => {
  it("accepts a valid hierarchical SELECT and appends the default LIMIT", () => {
    const r = validateSql(GOOD);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.limit).toBe(DEFAULT_MAX_LIMIT);
      expect(r.sql).toMatch(/LIMIT \(500\)$/);
    }
  });

  it("clamps a LIMIT above the maximum and keeps a smaller one", () => {
    const big = validateSql(`${GOOD} LIMIT 100000`);
    const small = validateSql(`${GOOD} LIMIT 20`);
    expect(big.ok && big.limit).toBe(500);
    expect(small.ok && small.limit).toBe(20);
  });

  it("requires exactly one statement", () => {
    expect(err(`${GOOD}; SELECT 1 FROM floats`)).toMatch(/Exactly one statement/);
  });

  it.each([
    ["INSERT INTO floats(float_id) VALUES ('x')", /Only SELECT/],
    ["UPDATE profiles SET data_mode = 'D'", /Only SELECT/],
    ["DELETE FROM measurements", /Only SELECT/],
    ["DROP TABLE floats", /Only SELECT|Could not parse/],
    ["WITH x AS (SELECT * FROM floats) SELECT * FROM x", /no WITH/],
    ["SELECT float_id FROM floats UNION SELECT float_id FROM cycles", /no UNION/],
  ])("rejects non-SELECT: %s", (sql, re) => {
    expect(err(sql)).toMatch(re);
  });

  it.each([
    ["SELECT * FROM query_log", /Table "query_log" is not allowed/],
    ["SELECT * FROM term_definitions", /Table "term_definitions" is not allowed/],
    ["SELECT * FROM auth.users", /Schema "auth" is not allowed/],
    ["SELECT * FROM pg_catalog.pg_roles", /Schema "pg_catalog" is not allowed/],
  ])("enforces the table whitelist: %s", (sql, re) => {
    expect(err(sql)).toMatch(re);
  });

  it.each([
    ["SELECT pg_sleep(10) FROM floats", /Unsafe function "pg_sleep"/],
    ["SELECT pg_read_file('/etc/passwd') FROM floats", /Unsafe function "pg_read_file"/],
    ["SELECT set_config('role','postgres',true) FROM floats", /Unsafe function "set_config"/],
    ["SELECT md5(float_id) FROM floats", /Function "md5" is not on the allowed list/],
    ["SELECT * FROM generate_series(1, 1000000000)", /Functions in FROM are not allowed/],
  ])("rejects unsafe or unlisted functions: %s", (sql, re) => {
    expect(err(sql)).toMatch(re);
  });

  it("rejects what it cannot parse", () => {
    expect(err("SELEC temperature FRM measurements")).toMatch(/Could not parse SQL/);
    expect(err("SELECT * FROM floats FOR UPDATE")).toMatch(/locking/);
  });

  it.each([
    ["SELECT count(*) FROM measurements m JOIN cycles c ON m.profile_id = c.float_id", /measurements must be joined through profiles/],
    ["SELECT count(*) FROM measurements m", /measurements must be joined through profiles/],
    ["SELECT count(*) FROM measurements m JOIN profiles p ON m.measurement_id = p.cycle_id", /measurements must be joined through profiles/],
    ["SELECT count(*) FROM profiles p JOIN cycles c ON p.latitude > 0", /profiles and cycles must be joined/],
    ["SELECT count(*) FROM profiles p JOIN floats f ON f.float_id = p.profile_id", /float IDs come via cycles/],
    ["SELECT count(*) FROM profiles p JOIN cycles c ON p.cycle_id = c.cycle_id JOIN floats f ON f.platform_type = c.float_id", /float IDs come via cycles/],
  ])("enforces the hierarchy: %s", (sql, re) => {
    expect(err(sql)).toMatch(re);
  });

  it("checks the hierarchy inside scalar subqueries too", () => {
    expect(err("SELECT count(*) FROM profiles p WHERE p.profile_id IN (SELECT m.profile_id FROM measurements m)")).toMatch(/measurements must be joined through profiles/);
  });

  it("requires profile_id on row-level queries", () => {
    expect(err("SELECT m.temperature FROM measurements m JOIN profiles p ON m.profile_id = p.profile_id")).toMatch(/must select p.profile_id/);
  });

  it("rejects subqueries in FROM", () => {
    expect(err("SELECT x.n FROM (SELECT count(*) AS n FROM floats) x")).toMatch(/Subqueries in FROM/);
  });

  it("accepts the recent-term subquery and aggregates", () => {
    const r = validateSql("SELECT count(DISTINCT p.profile_id) AS n FROM profiles p WHERE p.profile_time >= (SELECT max(p2.profile_time) FROM profiles p2) - INTERVAL '30 days'");
    expect(r.ok).toBe(true);
  });
});
