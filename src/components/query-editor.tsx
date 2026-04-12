import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { editor as MonacoEditor, Position } from "monaco-editor";
import type { Connection, SchemaNode } from "@/shared/ipc";
import { Card } from "@/components/ui/card";

const SIMPLE_IDENTIFIER_PATTERN = /^[A-Za-z_][\w$]*$/;
const QUALIFIED_SCHEMA_PATTERN = /(?:^|[\s(,])(?:"([^"]*)"|`([^`]*)`|([A-Za-z_][\w$]*))\.(?:"[^"]*|`[^`]*|[A-Za-z_][\w$]*)?$/;

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: string) => void;
  onRun?: () => void;
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

function buildSchemaSuggestions(
  monaco: Parameters<OnMount>[1],
  schemas: SchemaNode[],
  connectionKind: Connection["kind"],
  range: import("monaco-editor").IRange,
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
  range: import("monaco-editor").IRange,
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

function extractQualifiedSchemaName(linePrefix: string) {
  const match = QUALIFIED_SCHEMA_PATTERN.exec(linePrefix);
  return match ? match[1] ?? match[2] ?? match[3] ?? null : null;
}

export function QueryEditor({
  value,
  onChange,
  onSelectionChange,
  onRun,
  schemas,
  selectedSchema,
  connectionKind,
}: QueryEditorProps) {
  const onRunRef = useRef(onRun);
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
    const updateSelection = () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model || selection.isEmpty()) {
        onSelectionChangeRef.current?.("");
        return;
      }

      onSelectionChangeRef.current?.(model.getValueInRange(selection));
    };

    updateSelection();
    editor.onDidChangeCursorSelection(updateSelection);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      updateSelection();
      onRunRef.current?.();
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
        const qualifiedSchemaName = extractQualifiedSchemaName(linePrefix);
        const activeSchema = getSelectedSchemaNode(availableSchemas, activeSchemaName);

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

        const suggestions = [
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
