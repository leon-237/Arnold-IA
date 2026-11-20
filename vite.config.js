import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// L'app appelle /api/arnold : en dev, la clé reste côté serveur (ANTHROPIC_KEY),
// donc aucun proxy n'est nécessaire ici.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
  },
});
