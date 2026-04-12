import { describe, expect, it } from "vitest";

import { getSqlQueryAtOffset, parseSqlQueries, prepareStatementsForExecution, stripSqlComments } from "./query.js";

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
