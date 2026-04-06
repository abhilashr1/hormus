import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: string) => void;
  onRun?: () => void;
}

export function QueryEditor({ value, onChange, onSelectionChange, onRun }: QueryEditorProps) {
  const handleMount: OnMount = (editor, monaco) => {
    const updateSelection = () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model || selection.isEmpty()) {
        onSelectionChange?.("");
        return;
      }

      onSelectionChange?.(model.getValueInRange(selection));
    };

    updateSelection();
    editor.onDidChangeCursorSelection(updateSelection);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      updateSelection();
      onRun?.();
    });
  };

  return (
    <div className="h-full overflow-hidden border border-[var(--border)] bg-[#15171b]">
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
        }}
      />
    </div>
  );
}
