import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";
import { injectBrainComponentImports, workspaceRoot } from "./src/lib/server/brain-pipeline";
import { mermaidTldrawPlugin } from "./src/lib/server/mermaid/vite-plugin";

const port = Number(process.env.PI_NOTES_PORT ?? 4188);
const packageRoot = dirname(fileURLToPath(import.meta.url));
const hostNodeModules = resolve(packageRoot, "node_modules");

function brainMdsvexPipeline(): Plugin {
  return {
    name: "pi-notes-brain-mdsvex-pipeline",
    enforce: "pre",
    transform(code, id) {
      const root = workspaceRoot();
      if (!id.endsWith(".svx") || !id.includes(`${root}/.brain/`)) return null;
      return { code: injectBrainComponentImports(code, root), map: null };
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_PI_NOTES_WORKSPACE_ROOT": JSON.stringify(workspaceRoot()),
  },
  plugins: [brainMdsvexPipeline(), mermaidTldrawPlugin(workspaceRoot()), tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      layerchart: resolve(hostNodeModules, "layerchart/dist/index.js"),
    },
  },
  ssr: {
    noExternal: ["@hugeicons/svelte", "@hugeicons/core-free-icons", "layerchart"],
  },
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    allowedHosts: ["dark-wizard.tail7af24.ts.net"],
    fs: {
      allow: [workspaceRoot()],
    },
  },
});
