import { describe, expect, it } from "vitest";

import {
  detectSqlParameters,
  getSqlQueryAtOffset,
  parseSqlQueries,
  prepareStatementsForExecution,
  stripSqlComments,
  substituteSqlParameters,
} from "./query.js";

describe("stripSqlComments", () => {
  it("removes line and block comments while preserving quoted content", () => {
    const sql = `
select '-- keep';
-- remove this
select 1 /* block comment */ as value;
select '/* keep */';
`;

    expect(stripSqlComments(sql)).toContain("select '-- keep';");
    expect(stripSqlComments(sql)).toContain("select 1   as value;");
    expect(stripSqlComments(sql)).toContain("select '/* keep */';");
    expect(stripSqlComments(sql)).not.toContain("-- remove this");
  });
});

describe("prepareStatementsForExecution", () => {
  it("splits statements across blank lines and strips trailing semicolons", () => {
    const sql = `
select 1;
select 2;

-- spacer

select ';still string';
`;

    expect(prepareStatementsForExecution(sql)).toEqual(["select 1", "select 2", "select ';still string'"]);
  });

  it("does not split on semicolons inside strings or comments", () => {
    const sql = `
select 'a;b';
select 1 /* ; */ as value;
`;

    expect(prepareStatementsForExecution(sql)).toEqual(["select 'a;b'", "select 1 /* ; */ as value"]);
  });
});

describe("parseSqlQueries", () => {
  it("returns query segments with stable offsets", () => {
    const sql = "select 1;\n\nselect 2;";
    const segments = parseSqlQueries(sql);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.text).toBe("select 1;");
    expect(segments[1]?.text).toBe("select 2;");
  });
});

describe("getSqlQueryAtOffset", () => {
  it("finds the segment that contains a cursor offset", () => {
    const sql = "select 1;\n\nselect 2;";
    const secondSelectOffset = sql.lastIndexOf("select 2") + 2;

    expect(getSqlQueryAtOffset(sql, secondSelectOffset)?.text).toBe("select 2;");
  });
});

describe("detectSqlParameters", () => {
  it("finds positional, named, and anonymous placeholders while ignoring quoted content and comments", () => {
    const sql = `
select $1, :status, ?, ':ignored', "$2"
from users
where id = $1
  and state = :status
  and flags ? 'admin'
  and note = $$contains :ignored and $2$$;
-- ? and :commented_out
`;

    expect(detectSqlParameters(sql)).toEqual([
      expect.objectContaining({ id: "$1", token: "$1", kind: "positional", name: "1" }),
      expect.objectContaining({ id: ":status", token: ":status", kind: "named", name: "status" }),
      expect.objectContaining({ id: "?1", token: "?", kind: "anonymous", name: "param1" }),
    ]);
  });

  it("ignores postgres casts and assignment syntax", () => {
    const sql = "select now()::date, value := 1, :real_name from config where id = $2";

    expect(detectSqlParameters(sql)).toEqual([
      expect.objectContaining({ id: ":real_name", kind: "named" }),
      expect.objectContaining({ id: "$2", kind: "positional" }),
    ]);
  });
});

describe("substituteSqlParameters", () => {
  it("replaces repeated positional and named parameters with the provided values", () => {
    const sql = "select * from users where id = $1 or owner_id = $1 and state = :state";

    expect(
      substituteSqlParameters(sql, {
        $1: "42",
        ":state": "'active'",
      }),
    ).toBe("select * from users where id = 42 or owner_id = 42 and state = 'active'");
  });

  it("replaces anonymous placeholders in order", () => {
    const sql = "select * from audit_log where actor_id = ? and action = ?";

    expect(
      substituteSqlParameters(sql, {
        "?1": "7",
        "?2": "'LOGIN'",
      }),
    ).toBe("select * from audit_log where actor_id = 7 and action = 'LOGIN'");
  });
});
