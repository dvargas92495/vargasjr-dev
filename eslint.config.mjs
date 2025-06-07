import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import noMockInternalModules from "./eslint-rules/no-mock-internal-modules.js";
import importsAtTop from "./eslint-rules/imports-at-top.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "custom": {
        rules: {
          "no-mock-internal-modules": noMockInternalModules,
          "imports-at-top": importsAtTop,
        },
      },
    },
    rules: {
      "custom/imports-at-top": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.js", "**/*.spec.ts", "**/*.spec.js"],
    rules: {
      "custom/no-mock-internal-modules": "error",
    },
  },
];

export default eslintConfig;
