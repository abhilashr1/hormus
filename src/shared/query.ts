export const QUERY_RESULT_PAGE_SIZE = 100;

export interface SqlQuerySegment {
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface SqlParameterPlaceholder {
  id: string;
  token: string;
  kind: "positional" | "named" | "anonymous";
  name: string;
  startOffset: number;
  endOffset: number;
}

export function stripSqlComments(sql: string) {
  let output = "";
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (!inDoubleQuote && char === "'") {
      output += char;
      if (inSingleQuote && next === "'") {
        output += next;
        index += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      index += 1;
      continue;
    }

    if (!inSingleQuote && char === "\"") {
      output += char;
      if (inDoubleQuote && next === "\"") {
        output += next;
        index += 2;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "-" && next === "-") {
      while (index < sql.length && sql[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "/" && next === "*") {
      output += " ";
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(index + 2, sql.length);
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function trimSegment(segment: SqlQuerySegment): SqlQuerySegment | null {
  const leadingWhitespace = segment.text.match(/^\s*/)?.[0].length ?? 0;
  const trailingWhitespace = segment.text.match(/\s*$/)?.[0].length ?? 0;
  const startOffset = segment.startOffset + leadingWhitespace;
  const endOffset = segment.endOffset - trailingWhitespace;
  const text = segment.text.slice(leadingWhitespace, segment.text.length - trailingWhitespace);

  if (!text.trim() || !stripSqlComments(text).trim()) {
    return null;
  }

  return {
    text,
    startOffset,
    endOffset,
  };
}

function splitBlockBySemicolon(sql: string, blockStartOffset: number, blockEndOffset: number) {
  const segments: SqlQuerySegment[] = [];
  let segmentStart = blockStartOffset;
  let index = blockStartOffset;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (index < blockEndOffset) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (!inDoubleQuote && char === "'") {
      if (inSingleQuote && next === "'") {
        index += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      index += 1;
      continue;
    }

    if (!inSingleQuote && char === "\"") {
      if (inDoubleQuote && next === "\"") {
        index += 2;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "-" && next === "-") {
      inLineComment = true;
      index += 2;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "/" && next === "*") {
      inBlockComment = true;
      index += 2;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === ";") {
      const segment = trimSegment({
        text: sql.slice(segmentStart, index + 1),
        startOffset: segmentStart,
        endOffset: index + 1,
      });
      if (segment) {
        segments.push(segment);
      }
      segmentStart = index + 1;
    }

    index += 1;
  }

  const trailingSegment = trimSegment({
    text: sql.slice(segmentStart, blockEndOffset),
    startOffset: segmentStart,
    endOffset: blockEndOffset,
  });
  if (trailingSegment) {
    segments.push(trailingSegment);
  }

  return segments;
}

export function parseSqlQueries(sql: string) {
  const segments: SqlQuerySegment[] = [];
  let blockStart: number | null = null;
  let lineStart = 0;
  let index = 0;

  while (index <= sql.length) {
    const atEnd = index === sql.length;
    const char = sql[index];

    if (!atEnd && char !== "\n") {
      index += 1;
      continue;
    }

    const lineEnd = index;
    const line = sql.slice(lineStart, lineEnd);
    const isBlankLine = line.trim().length === 0;

    if (!isBlankLine && blockStart === null) {
      blockStart = lineStart;
    }

    if ((isBlankLine || atEnd) && blockStart !== null) {
      const blockEnd = isBlankLine ? lineStart : lineEnd;
      segments.push(...splitBlockBySemicolon(sql, blockStart, blockEnd));
      blockStart = null;
    }

    lineStart = index + 1;
    index += 1;
  }

  return segments;
}

export function prepareStatementsForExecution(sql: string) {
  return parseSqlQueries(sql).map((segment) => segment.text.trim().replace(/;+$/, ""));
}

export function getSqlQueryAtOffset(sql: string, offset: number) {
  return parseSqlQueries(sql).find((segment) => offset >= segment.startOffset && offset <= segment.endOffset) ?? null;
}

function isIdentifierCharacter(char: string | undefined) {
  return !!char && /[A-Za-z0-9_]/.test(char);
}

function getPreviousNonWhitespaceCharacter(sql: string, offset: number) {
  let cursor = offset - 1;

  while (cursor >= 0 && /\s/.test(sql[cursor] ?? "")) {
    cursor -= 1;
  }

  return cursor >= 0 ? sql[cursor] : undefined;
}

function readDollarQuotedTag(sql: string, offset: number) {
  if (sql[offset] !== "$") {
    return null;
  }

  let cursor = offset + 1;
  while (cursor < sql.length && /[A-Za-z0-9_]/.test(sql[cursor] ?? "")) {
    cursor += 1;
  }

  if (sql[cursor] !== "$") {
    return null;
  }

  return sql.slice(offset, cursor + 1);
}

function scanSqlParameters(sql: string) {
  const placeholders: SqlParameterPlaceholder[] = [];
  const seenNamed = new Set<string>();
  const seenPositional = new Set<string>();
  const uniquePlaceholders: SqlParameterPlaceholder[] = [];
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarQuoteTag: string | null = null;
  let anonymousCounter = 0;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (dollarQuoteTag) {
      if (sql.startsWith(dollarQuoteTag, index)) {
        const tagLength = dollarQuoteTag.length;
        dollarQuoteTag = null;
        index += tagLength;
        continue;
      }
      index += 1;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        index += 2;
        continue;
      }
      if (char === "'") {
        inSingleQuote = false;
      }
      index += 1;
      continue;
    }

    if (inDoubleQuote) {
      if (char === "\"" && next === "\"") {
        index += 2;
        continue;
      }
      if (char === "\"") {
        inDoubleQuote = false;
      }
      index += 1;
      continue;
    }

    if (inBacktickQuote) {
      if (char === "`" && next === "`") {
        index += 2;
        continue;
      }
      if (char === "`") {
        inBacktickQuote = false;
      }
      index += 1;
      continue;
    }

    if (char === "-" && next === "-") {
      inLineComment = true;
      index += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 2;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      index += 1;
      continue;
    }

    if (char === "\"") {
      inDoubleQuote = true;
      index += 1;
      continue;
    }

    if (char === "`") {
      inBacktickQuote = true;
      index += 1;
      continue;
    }

    const nextDollarQuoteTag = readDollarQuotedTag(sql, index);
    if (nextDollarQuoteTag) {
      dollarQuoteTag = nextDollarQuoteTag;
      index += nextDollarQuoteTag.length;
      continue;
    }

    if (char === "$" && /\d/.test(next ?? "")) {
      let cursor = index + 1;
      while (cursor < sql.length && /\d/.test(sql[cursor] ?? "")) {
        cursor += 1;
      }

      const token = sql.slice(index, cursor);
      const placeholder: SqlParameterPlaceholder = {
        id: token,
        token,
        kind: "positional",
        name: token.slice(1),
        startOffset: index,
        endOffset: cursor,
      };
      placeholders.push(placeholder);
      if (!seenPositional.has(token)) {
        uniquePlaceholders.push(placeholder);
        seenPositional.add(token);
      }

      index = cursor;
      continue;
    }

    if (char === ":" && sql[index - 1] !== ":" && next !== ":" && next !== "=" && /[A-Za-z_]/.test(next ?? "")) {
      let cursor = index + 1;
      while (cursor < sql.length && isIdentifierCharacter(sql[cursor])) {
        cursor += 1;
      }

      const token = sql.slice(index, cursor);
      const placeholder: SqlParameterPlaceholder = {
        id: token,
        token,
        kind: "named",
        name: token.slice(1),
        startOffset: index,
        endOffset: cursor,
      };
      placeholders.push(placeholder);
      if (!seenNamed.has(token)) {
        uniquePlaceholders.push(placeholder);
        seenNamed.add(token);
      }

      index = cursor;
      continue;
    }

    const previousNonWhitespaceCharacter = getPreviousNonWhitespaceCharacter(sql, index);
    if (
      char === "?" &&
      next !== "|" &&
      next !== "&" &&
      (!previousNonWhitespaceCharacter || /[=,(<>]/.test(previousNonWhitespaceCharacter))
    ) {
      anonymousCounter += 1;
      const placeholder: SqlParameterPlaceholder = {
        id: `?${anonymousCounter}`,
        token: "?",
        kind: "anonymous",
        name: `param${anonymousCounter}`,
        startOffset: index,
        endOffset: index + 1,
      };
      placeholders.push(placeholder);
      uniquePlaceholders.push(placeholder);
      index += 1;
      continue;
    }

    index += 1;
  }

  return {
    all: placeholders,
    unique: uniquePlaceholders,
  };
}

export function detectSqlParameters(sql: string) {
  return scanSqlParameters(sql).unique;
}

export function substituteSqlParameters(sql: string, values: Record<string, string>) {
  const placeholders = scanSqlParameters(sql).all;
  if (placeholders.length === 0) {
    return sql;
  }

  let output = "";
  let cursor = 0;

  for (const placeholder of placeholders) {
    const replacement = values[placeholder.id];
    if (replacement === undefined) {
      throw new Error(`Missing value for parameter ${placeholder.token}`);
    }

    output += sql.slice(cursor, placeholder.startOffset);
    output += replacement;
    cursor = placeholder.endOffset;
  }

  output += sql.slice(cursor);
  return output;
}
