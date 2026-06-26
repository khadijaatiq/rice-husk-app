import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    // Allow TypeScript files to be found when imported with .js extension
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
