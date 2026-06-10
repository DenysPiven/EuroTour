import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base works on GitHub Pages (any repo path) and locally.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
