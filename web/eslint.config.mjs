import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Allow unused variables that start with underscore
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      // Allow any type (with warning)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow empty interfaces
      "@typescript-eslint/no-empty-interface": "off",
      // React specific
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      // Next.js specific
      "@next/next/no-img-element": "warn",
    },
  },
];

export default eslintConfig;
