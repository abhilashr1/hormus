import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const featureComponentFiles = ["src/components/**/*.{ts,tsx}"];
const uiPrimitiveFiles = ["src/components/ui/**/*.{ts,tsx}"];
const specializedWidgetFiles = ["src/components/query-editor.tsx", "src/components/results-grid.tsx"];

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-electron",
      "release",
      "coverage",
      "node_modules",
      "*.d.ts",
      "*.tsbuildinfo",
      "vite.config.js",
      "tailwind.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx,cts,mts}"],
  })),
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: featureComponentFiles,
    ignores: [...uiPrimitiveFiles, ...specializedWidgetFiles],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: "Use a shared UI primitive instead of raw button markup in feature components.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: "Use a shared UI primitive instead of raw input markup in feature components.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Use a shared UI primitive instead of raw select markup in feature components.",
        },
      ],
    },
  },
  {
    files: ["electron/**/*.ts", "vite.config.ts", "tailwind.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["src/components/ui/resizable.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
