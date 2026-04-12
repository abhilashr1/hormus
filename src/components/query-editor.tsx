import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { editor as MonacoEditor, IRange, Position } from "monaco-editor";
import type { Connection, SchemaNode } from "@/shared/ipc";
import { getSqlQueryAtOffset, parseSqlQueries, type SqlQuerySegment } from "@/shared/query";
import { Card } from "@/components/ui/card";

const SIMPLE_IDENTIFIER_PATTERN = /^[A-Za-z_][\w$]*$/;
const QUALIFIED_SCHEMA_PATTERN = /(?:^|[\s(,])(?:"([^"]*)"|`([^`]*)`|([A-Za-z_][\w$]*))\.(?:"[^"]*|`[^`]*|[A-Za-z_][\w$]*)?$/;
const TRAILING_QUALIFIER_PATTERN = /(?:"([^"]*)"|`([^`]*)`|([A-Za-z_][\w$]*))\.\s*$/;
const SQL_IDENTIFIER_FRAGMENT = /"([^"]|"")*"|`([^`]|``)*`|[A-Za-z_][\w$]*/.source;
const TABLE_REFERENCE_PATTERN = new RegExp(
  String.raw`\b(?:from|join|update|into)\s+(${SQL_IDENTIFIER_FRAGMENT})(?:\s*\.\s*(${SQL_IDENTIFIER_FRAGMENT}))?(?:\s+(?:as\s+)?(${SQL_IDENTIFIER_FRAGMENT}))?`,
  "gi",
);
const COLUMN_CONTEXT_PATTERN = /\b(select|where|having|group\s+by|order\s+by|on|set|and|or)\b[\s\S]*$/i;
const SQL_ALIAS_STOP_WORDS = new Set([
  "where",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "full",
  "cross",
  "group",
  "order",
  "having",
  "limit",
  "offset",
  "union",
  "on",
  "using",
]);

type SchemaObjectWithColumns = {
  name: string;
  columnNames: string[];
};

type QueryTableReference = {
  schemaName: string;
  objectName: string;
  alias?: string;
  columnNames: string[];
};

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: string) => void;
  onRun?: () => void;
  onRunQuery?: (query: string) => void;
  schemas: SchemaNode[];
  selectedSchema: string;
  connectionKind: Connection["kind"];
}

function isSimpleIdentifier(value: string) {
  return SIMPLE_IDENTIFIER_PATTERN.test(value);
}

function quoteIdentifier(kind: Connection["kind"], identifier: string) {
  if (isSimpleIdentifier(identifier)) {
    return identifier;
  }

  if (kind === "mysql") {
    return `\`${identifier.replace(/`/g, "``")}\``;
  }

  return `"${identifier.replace(/"/g, '""')}"`;
}

function getSelectedSchemaNode(schemas: SchemaNode[], selectedSchema: string) {
  return schemas.find((schema) => schema.name === selectedSchema) ?? schemas[0];
}

function unquoteIdentifier(identifier: string | null | undefined) {
  if (!identifier) {
    return null;
  }

  if (identifier.startsWith('"') && identifier.endsWith('"')) {
    return identifier.slice(1, -1).replace(/""/g, '"');
  }

  if (identifier.startsWith("`") && identifier.endsWith("`")) {
    return identifier.slice(1, -1).replace(/``/g, "`");
  }

  return identifier;
}

function identifiersEqual(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) {
    return false;
  }

  return left === right || left.toLowerCase() === right.toLowerCase();
}

function findSchemaByName(schemas: SchemaNode[], schemaName: string | null | undefined) {
  return schemas.find((schema) => identifiersEqual(schema.name, schemaName));
}

function findSchemaObject(
  schemas: SchemaNode[],
  selectedSchema: string,
  objectName: string | null | undefined,
  schemaName?: string | null,
): { schemaName: string; object: SchemaObjectWithColumns } | null {
  if (!objectName) {
    return null;
  }

  const searchSchemas = schemaName
    ? [findSchemaByName(schemas, schemaName)].filter(Boolean)
    : [
        getSelectedSchemaNode(schemas, selectedSchema),
        ...schemas.filter((schema) => !identifiersEqual(schema.name, selectedSchema)),
      ];

  for (const schema of searchSchemas) {
    if (!schema) {
      continue;
    }

    const object =
      schema.tables.find((table) => identifiersEqual(table.name, objectName)) ??
      schema.views.find((view) => identifiersEqual(view.name, objectName));

    if (object) {
      return { schemaName: schema.name, object };
    }
  }

  return null;
}

function buildSchemaSuggestions(
  monaco: Parameters<OnMount>[1],
  schemas: SchemaNode[],
  connectionKind: Connection["kind"],
  range: IRange,
) {
  return schemas.map((schema) => ({
    label: schema.name,
    kind: monaco.languages.CompletionItemKind.Module,
    insertText: quoteIdentifier(connectionKind, schema.name),
    detail: "Schema",
    range,
    sortText: `0-${schema.name}`,
  }));
}

function buildObjectSuggestions(
  monaco: Parameters<OnMount>[1],
  schema: SchemaNode | undefined,
  connectionKind: Connection["kind"],
  range: IRange,
  options?: { includeSchemaPrefix?: boolean; sortPrefix?: string },
) {
  if (!schema) {
    return [];
  }

  const prefix = options?.includeSchemaPrefix ? `${quoteIdentifier(connectionKind, schema.name)}.` : "";
  const sortPrefix = options?.sortPrefix ?? "1";

  const tables = schema.tables.map((table) => ({
    label: table.name,
    kind: monaco.languages.CompletionItemKind.Struct,
    insertText: `${prefix}${quoteIdentifier(connectionKind, table.name)}`,
    detail: `Table • ${schema.name}`,
    range,
    sortText: `${sortPrefix}-table-${schema.name}-${table.name}`,
  }));

  const views = schema.views.map((view) => ({
    label: view.name,
    kind: monaco.languages.CompletionItemKind.Interface,
    insertText: `${prefix}${quoteIdentifier(connectionKind, view.name)}`,
    detail: `View • ${schema.name}`,
    range,
    sortText: `${sortPrefix}-view-${schema.name}-${view.name}`,
  }));

  const functions = schema.functions.map((fn) => ({
    label: fn.name,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: `${prefix}${quoteIdentifier(connectionKind, fn.name)}($0)`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: `Function • ${schema.name}`,
    range,
    sortText: `${sortPrefix}-function-${schema.name}-${fn.name}`,
  }));

  return [...tables, ...views, ...functions];
}

function buildColumnSuggestions(
  monaco: Parameters<OnMount>[1],
  columnNames: string[],
  connectionKind: Connection["kind"],
  range: IRange,
  detail: string,
  sortPrefix = "0",
) {
  const seen = new Set<string>();

  return columnNames.flatMap((columnName) => {
    const key = columnName.toLowerCase();
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [
      {
        label: columnName,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: quoteIdentifier(connectionKind, columnName),
        detail,
        range,
        sortText: `${sortPrefix}-column-${columnName}`,
      },
    ];
  });
}

function extractQualifiedSchemaName(linePrefix: string) {
  const match = QUALIFIED_SCHEMA_PATTERN.exec(linePrefix);
  return match ? match[1] ?? match[2] ?? match[3] ?? null : null;
}

function extractTrailingQualifier(linePrefix: string) {
  const match = TRAILING_QUALIFIER_PATTERN.exec(linePrefix);
  return match ? match[1] ?? match[2] ?? match[3] ?? null : null;
}

function getQueryTextBeforePosition(model: MonacoEditor.ITextModel, position: Position) {
  const fullText = model.getValue();
  const cursorOffset = model.getOffsetAt(position);
  const activeQuery = getSqlQueryAtOffset(fullText, cursorOffset);

  if (!activeQuery) {
    return { activeQuery: null, queryPrefix: "" };
  }

  return {
    activeQuery,
    queryPrefix: fullText.slice(activeQuery.startOffset, cursorOffset),
  };
}

function getQueryTableReferences(
  queryText: string,
  schemas: SchemaNode[],
  selectedSchema: string,
): QueryTableReference[] {
  const references: QueryTableReference[] = [];

  for (const match of queryText.matchAll(TABLE_REFERENCE_PATTERN)) {
    const firstIdentifier = unquoteIdentifier(match[1]);
    const secondIdentifier = unquoteIdentifier(match[2]);
    const aliasCandidate = unquoteIdentifier(match[3]);
    const resolvedObject = secondIdentifier
      ? findSchemaObject(schemas, selectedSchema, secondIdentifier, firstIdentifier)
      : findSchemaObject(schemas, selectedSchema, firstIdentifier);

    if (!resolvedObject) {
      continue;
    }

    const alias =
      aliasCandidate && !SQL_ALIAS_STOP_WORDS.has(aliasCandidate.toLowerCase()) ? aliasCandidate : undefined;

    references.push({
      schemaName: resolvedObject.schemaName,
      objectName: resolvedObject.object.name,
      alias,
      columnNames: resolvedObject.object.columnNames,
    });
  }

  return references;
}

function findColumnsForQualifier(
  qualifier: string | null,
  references: QueryTableReference[],
  schemas: SchemaNode[],
  selectedSchema: string,
) {
  if (!qualifier) {
    return null;
  }

  const matchedReference = references.find(
    (reference) => identifiersEqual(reference.alias, qualifier) || identifiersEqual(reference.objectName, qualifier),
  );
  if (matchedReference) {
    return {
      columnNames: matchedReference.columnNames,
      detail: `${matchedReference.alias ? `${matchedReference.alias} • ` : ""}${matchedReference.schemaName}.${matchedReference.objectName}`,
    };
  }

  const resolvedObject = findSchemaObject(schemas, selectedSchema, qualifier);
  if (!resolvedObject) {
    return null;
  }

  return {
    columnNames: resolvedObject.object.columnNames,
    detail: `${resolvedObject.schemaName}.${resolvedObject.object.name}`,
  };
}

function getColumnsForQueryContext(references: QueryTableReference[]) {
  const seen = new Set<string>();
  const columns: string[] = [];

  for (const reference of references) {
    for (const columnName of reference.columnNames) {
      const key = columnName.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      columns.push(columnName);
    }
  }

  return columns;
}

function getLineVisibleColumns(model: MonacoEditor.ITextModel, lineNumber: number) {
  const content = model.getLineContent(lineNumber);
  const firstNonWhitespaceIndex = content.search(/\S/);
  if (firstNonWhitespaceIndex === -1) {
    return null;
  }

  const trailingWhitespaceLength = content.match(/\s*$/)?.[0].length ?? 0;
  return {
    startColumn: firstNonWhitespaceIndex + 1,
    endColumn: Math.max(firstNonWhitespaceIndex + 2, content.length - trailingWhitespaceLength + 1),
  };
}

function getQueryBlockColumns(model: MonacoEditor.ITextModel, query: SqlQuerySegment) {
  const start = model.getPositionAt(query.startOffset);
  const end = model.getPositionAt(query.endOffset);
  const lineBounds = [];

  for (let lineNumber = start.lineNumber; lineNumber <= end.lineNumber; lineNumber += 1) {
    const bounds = getLineVisibleColumns(model, lineNumber);
    if (bounds) {
      lineBounds.push(bounds);
    }
  }

  if (lineBounds.length === 0) {
    return null;
  }

  return {
    startLineNumber: start.lineNumber,
    endLineNumber: end.lineNumber,
    startColumn: Math.min(...lineBounds.map((bounds) => bounds.startColumn)),
    endColumn: Math.max(...lineBounds.map((bounds) => bounds.endColumn)),
  };
}

export function QueryEditor({
  value,
  onChange,
  onSelectionChange,
  onRun,
  onRunQuery,
  schemas,
  selectedSchema,
  connectionKind,
}: QueryEditorProps) {
  const onRunRef = useRef(onRun);
  const onRunQueryRef = useRef(onRunQuery);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const completionContextRef = useRef({
    schemas,
    selectedSchema,
    connectionKind,
  });

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    onRunQueryRef.current = onRunQuery;
  }, [onRunQuery]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    completionContextRef.current = {
      schemas,
      selectedSchema,
      connectionKind,
    };
  }, [connectionKind, schemas, selectedSchema]);

  const handleMount: OnMount = (editor, monaco) => {
    let runArrowDecorationIds: string[] = [];
    let idleHighlightTimer: number | null = null;
    let hoveredQuery: SqlQuerySegment | null = null;
    let idleQuery: SqlQuerySegment | null = null;
    let querySegments: SqlQuerySegment[] = [];
    const editorDomNode = editor.getDomNode();
    const activeQueryOverlay = document.createElement("div");
    activeQueryOverlay.className = "hormus-active-query-overlay";
    if (editorDomNode) {
      editorDomNode.appendChild(activeQueryOverlay);
    }

    const updateSelection = () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model || selection.isEmpty()) {
        onSelectionChangeRef.current?.("");
        return;
      }

      onSelectionChangeRef.current?.(model.getValueInRange(selection));
    };

    const clearIdleTimer = () => {
      if (idleHighlightTimer !== null) {
        window.clearTimeout(idleHighlightTimer);
        idleHighlightTimer = null;
      }
    };

    const runQuerySegment = (query: SqlQuerySegment) => {
      const model = editor.getModel();
      if (!model) {
        return;
      }

      const start = model.getPositionAt(query.startOffset);
      const end = model.getPositionAt(query.endOffset);
      const selection = new monaco.Selection(start.lineNumber, start.column, end.lineNumber, end.column);
      editor.setSelection(selection);
      editor.revealRangeInCenter(selection);
      onSelectionChangeRef.current?.(query.text);
      onRunQueryRef.current?.(query.text);
    };

    const updateRunArrowDecorations = () => {
      const model = editor.getModel();
      if (!model) {
        runArrowDecorationIds = editor.deltaDecorations(runArrowDecorationIds, []);
        return;
      }

      querySegments = parseSqlQueries(model.getValue());
      const decorations = querySegments.map((query) => {
        const start = model.getPositionAt(query.startOffset);
        return {
          range: new monaco.Range(start.lineNumber, 1, start.lineNumber, 1),
          options: {
            isWholeLine: true,
            glyphMarginClassName: "hormus-query-run-glyph",
            glyphMarginHoverMessage: { value: "Run query" },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        };
      });

      runArrowDecorationIds = editor.deltaDecorations(runArrowDecorationIds, decorations);
    };

    const updateActiveQueryHighlight = () => {
      const model = editor.getModel();
      const activeQuery = hoveredQuery ?? idleQuery;
      if (!model || !activeQuery) {
        activeQueryOverlay.style.display = "none";
        return;
      }

      const refreshedQuery = getSqlQueryAtOffset(model.getValue(), activeQuery.startOffset);
      if (!refreshedQuery) {
        activeQueryOverlay.style.display = "none";
        return;
      }

      const block = getQueryBlockColumns(model, refreshedQuery);
      if (!block) {
        activeQueryOverlay.style.display = "none";
        return;
      }

      const startPosition = editor.getScrolledVisiblePosition({
        lineNumber: block.startLineNumber,
        column: block.startColumn,
      });
      const endPosition = editor.getScrolledVisiblePosition({
        lineNumber: block.endLineNumber,
        column: block.endColumn,
      });

      if (!startPosition || !endPosition) {
        activeQueryOverlay.style.display = "none";
        return;
      }

      activeQueryOverlay.style.display = "block";
      activeQueryOverlay.style.left = `${startPosition.left}px`;
      activeQueryOverlay.style.top = `${startPosition.top}px`;
      activeQueryOverlay.style.width = `${Math.max(8, endPosition.left - startPosition.left)}px`;
      activeQueryOverlay.style.height = `${Math.max(startPosition.height, endPosition.top + endPosition.height - startPosition.top)}px`;
    };

    const scheduleIdleHighlight = () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      clearIdleTimer();
      idleQuery = null;
      updateActiveQueryHighlight();

      if (!model || !position) {
        return;
      }

      const candidateQuery = getSqlQueryAtOffset(model.getValue(), model.getOffsetAt(position));
      if (!candidateQuery) {
        return;
      }

      idleHighlightTimer = window.setTimeout(() => {
        idleQuery = candidateQuery;
        updateActiveQueryHighlight();
      }, 500);
    };

    const setHoveredQuery = (query: SqlQuerySegment | null) => {
      hoveredQuery = query;
      updateActiveQueryHighlight();
    };

    const getActiveQuery = () => hoveredQuery ?? idleQuery;

    const getQueryAtLine = (lineNumber: number) => {
      const model = editor.getModel();
      if (!model) {
        return null;
      }

      return querySegments.find((query) => model.getPositionAt(query.startOffset).lineNumber === lineNumber) ?? null;
    };

    updateSelection();
    updateRunArrowDecorations();
    scheduleIdleHighlight();
    editor.onDidChangeCursorSelection(updateSelection);
    editor.onDidChangeCursorPosition(() => {
      scheduleIdleHighlight();
    });
    editor.onDidChangeModelContent(() => {
      hoveredQuery = null;
      updateRunArrowDecorations();
      scheduleIdleHighlight();
    });
    editor.onDidScrollChange(() => {
      updateActiveQueryHighlight();
    });
    editor.onDidLayoutChange(() => {
      updateActiveQueryHighlight();
    });
    editor.onMouseMove((event) => {
      const model = editor.getModel();
      const position = event.target.position;
      if (!model || !position || event.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT) {
        setHoveredQuery(null);
        return;
      }

      setHoveredQuery(getSqlQueryAtOffset(model.getValue(), model.getOffsetAt(position)));
    });
    editor.onMouseLeave(() => {
      setHoveredQuery(null);
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      updateSelection();
      const activeQuery = getActiveQuery();
      if (activeQuery) {
        runQuerySegment(activeQuery);
        return;
      }

      onRunRef.current?.();
    });
    editor.onMouseDown((event) => {
      const model = editor.getModel();
      const position = event.target.position;
      const isCommandClick = event.event.metaKey || event.event.ctrlKey;
      const isGlyphClick = event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;

      if (isGlyphClick && position) {
        const query = getQueryAtLine(position.lineNumber);
        if (query) {
          runQuerySegment(query);
        }
        return;
      }

      if (!model || !position || !isCommandClick || event.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT) {
        return;
      }

      const activeQuery = getSqlQueryAtOffset(model.getValue(), model.getOffsetAt(position));
      if (!activeQuery) {
        return;
      }

      runQuerySegment(activeQuery);
    });

    const completionProvider = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [".", '"', "`"],
      provideCompletionItems(model: MonacoEditor.ITextModel, position: Position) {
        const { schemas: availableSchemas, selectedSchema: activeSchemaName, connectionKind: activeConnectionKind } =
          completionContextRef.current;

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const linePrefix = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const { activeQuery, queryPrefix } = getQueryTextBeforePosition(model, position);
        const tableReferences = activeQuery
          ? getQueryTableReferences(activeQuery.text, availableSchemas, activeSchemaName)
          : [];
        const trailingQualifier = extractTrailingQualifier(linePrefix);
        const qualifiedColumns = findColumnsForQualifier(
          trailingQualifier,
          tableReferences,
          availableSchemas,
          activeSchemaName,
        );
        const qualifiedSchemaName = extractQualifiedSchemaName(linePrefix);
        const activeSchema = getSelectedSchemaNode(availableSchemas, activeSchemaName);

        if (qualifiedColumns) {
          return {
            suggestions: buildColumnSuggestions(
              monaco,
              qualifiedColumns.columnNames,
              activeConnectionKind,
              range,
              `Column • ${qualifiedColumns.detail}`,
            ),
          };
        }

        if (qualifiedSchemaName) {
          return {
            suggestions: buildObjectSuggestions(
              monaco,
              availableSchemas.find((schema) => schema.name === qualifiedSchemaName),
              activeConnectionKind,
              range,
            ),
          };
        }

        const contextColumns =
          activeQuery && COLUMN_CONTEXT_PATTERN.test(queryPrefix) ? getColumnsForQueryContext(tableReferences) : [];
        const suggestions = [
          ...buildColumnSuggestions(
            monaco,
            contextColumns,
            activeConnectionKind,
            range,
            tableReferences.length === 1
              ? `Column • ${tableReferences[0].schemaName}.${tableReferences[0].objectName}`
              : "Column",
          ),
          ...buildSchemaSuggestions(monaco, availableSchemas, activeConnectionKind, range),
          ...buildObjectSuggestions(monaco, activeSchema, activeConnectionKind, range, { sortPrefix: "1" }),
          ...availableSchemas.flatMap((schema) =>
            buildObjectSuggestions(monaco, schema, activeConnectionKind, range, {
              includeSchemaPrefix: true,
              sortPrefix: schema.name === activeSchema?.name ? "2" : "3",
            }),
          ),
        ];

        return { suggestions };
      },
    });

    editor.onDidDispose(() => {
      clearIdleTimer();
      runArrowDecorationIds = [];
      activeQueryOverlay.remove();
      completionProvider.dispose();
    });
  };

  return (
    <Card className="h-full gap-0 overflow-hidden rounded-none bg-[#15171b] py-0">
      <Editor
        height="100%"
        defaultLanguage="sql"
        theme="vs-dark"
        value={value}
        onChange={(next) => onChange(next ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          roundedSelection: false,
          lineNumbersMinChars: 3,
          glyphMargin: true,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "on",
          snippetSuggestions: "inline",
        }}
      />
    </Card>
  );
}
