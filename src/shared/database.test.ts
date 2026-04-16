import { describe, expect, it } from "vitest";

import { quoteIdentifier, quoteQualifiedName } from "./database.js";

describe("quoteIdentifier", () => {
  it("keeps simple lowercase postgres identifiers unquoted", () => {
    expect(quoteIdentifier("postgresql", "users", { preserveSimple: true })).toBe("users");
    expect(quoteIdentifier("postgresql", "user_id", { preserveSimple: true })).toBe("user_id");
  });

  it("quotes postgres identifiers when case-sensitive characters would break unquoted lookup", () => {
    expect(quoteIdentifier("postgresql", "UserName", { preserveSimple: true })).toBe('"UserName"');
    expect(quoteIdentifier("postgresql", "OrderItems", { preserveSimple: true })).toBe('"OrderItems"');
  });

  it("keeps simple mysql identifiers bare but quotes identifiers that need escaping", () => {
    expect(quoteIdentifier("mysql", "UserName", { preserveSimple: true })).toBe("UserName");
    expect(quoteIdentifier("mysql", "order-items", { preserveSimple: true })).toBe("`order-items`");
  });
});

describe("quoteQualifiedName", () => {
  it("applies per-part quoting rules for postgres qualified names", () => {
    expect(quoteQualifiedName("postgresql", "public", "UserSessions", { preserveSimple: true })).toBe('public."UserSessions"');
    expect(quoteQualifiedName("postgresql", "Reporting", "daily_rollup", { preserveSimple: true })).toBe('"Reporting".daily_rollup');
  });
});
