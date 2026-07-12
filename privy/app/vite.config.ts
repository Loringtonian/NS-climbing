import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @solana/web3.js expects a Buffer global in the browser; polyfilled in main.tsx.
export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis" },
  server: { port: 5173 },
});
