import { join } from "node:path";
import type { Plugin } from "vite";
import { renderDiagrams } from "../../../../scripts/render-mermaid";

function isReviewMarkdown(file: string, root: string): boolean {
  const normalized = file.replace(/\\/g, "/");
  const normalizedRoot = root.replace(/\\/g, "/");
  if (!/\.(svx|mdx?|svelte\.md)$/.test(normalized)) return false;
  return normalized.startsWith(`${normalizedRoot}/.brain/`) || normalized.startsWith(`${normalizedRoot}/docs/`);
}

export function mermaidTldrawPlugin(root: string): Plugin {
  return {
    name: "pi-notes-mermaid-tldraw",
    async buildStart() {
      const { total, rendered } = await renderDiagrams({ root });
      if (!total) return;
      this.info(rendered ? `rendered ${rendered}/${total} mermaid diagram(s)` : `${total} mermaid diagram(s) cached`);
    },
    configureServer(server) {
      const globs = [join(root, ".brain/**/*.{svx,md,mdx}"), join(root, "docs/**/*.{svx,md,mdx}")];
      server.watcher.add(globs);
      let running = Promise.resolve();
      const onChange = (file: string) => {
        if (!isReviewMarkdown(file, root)) return;
        running = running
          .then(() => renderDiagrams({ root }))
          .then(({ rendered }) => {
            if (!rendered) return;
            server.config.logger.info(`re-rendered ${rendered} mermaid diagram(s), reloading`);
            server.ws.send({ type: "full-reload" });
          })
          .catch((error: unknown) => server.config.logger.error(`mermaid render failed: ${error instanceof Error ? error.message : String(error)}`));
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
    },
  };
}
