import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";
import { injectBrainComponentImports, workspaceRoot } from "./src/lib/server/brain-pipeline";

const port = Number(process.env.PI_NOTES_PORT ?? 4188);

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
  plugins: [brainMdsvexPipeline(), tailwindcss(), sveltekit()],
  ssr: {
    noExternal: ["@hugeicons/svelte", "@hugeicons/core-free-icons"],
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
