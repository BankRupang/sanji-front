import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler experimental rule — too strict for standard useEffect data-fetching patterns.
      // Requires useSyncExternalStore or TanStack Query to satisfy; not adopted in this project.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
