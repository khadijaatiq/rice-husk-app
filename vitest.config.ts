import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    // Allow TypeScript files to be found when imported with .js extension.
    // The vite type definitions lag behind; the option exists at runtime.
    // @ts-expect-error extensionAlias is valid in Vite ≥4.2 but not yet typed
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
