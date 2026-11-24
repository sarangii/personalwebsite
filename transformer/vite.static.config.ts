import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

/** A GitHub Pages build of the interactive study. */
export default defineConfig({
  base: "/transformer/",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
