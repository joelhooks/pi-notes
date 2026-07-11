import { visit } from "unist-util-visit";
import { renderMermaidFigure } from "./shared.js";

// @ts-check

/**
 * @typedef {{ lang?: string | null, meta?: string | null, value: string }} CodeNode
 * @typedef {{ children: Array<unknown> }} ParentNode
 */

/**
 * Replaces fenced ```mermaid blocks with light/dark SVG <img>s. The SVG files
 * are generated separately by scripts/render-mermaid.ts using the same source
 * hash, so mdsvex rendering stays deterministic and does not launch a browser.
 */
export function remarkMermaidTldraw() {
  /** @param {unknown} tree */
  return (tree) => {
    visit(/** @type {never} */ (tree), "code", (node, index, parent) => {
      const code = /** @type {CodeNode} */ (node);
      const container = /** @type {ParentNode | undefined} */ (parent);
      if (code.lang !== "mermaid" || container === undefined || index === undefined) return;
      container.children[index] = {
        type: "html",
        value: renderMermaidFigure(code.value, code.meta),
      };
    });
  };
}

export default remarkMermaidTldraw;
