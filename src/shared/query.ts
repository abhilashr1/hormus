export const QUERY_RESULT_PAGE_SIZE = 100;

export interface SqlQuerySegment {
  text: string;
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
