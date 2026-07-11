import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createMermaidDiagram } from "@tldraw/mermaid";
import { Tldraw, toRichText } from "tldraw";
import "tldraw/tldraw.css";

async function preloadFonts(editor) {
  const fonts = ["draw", "sans", "serif", "mono"];
  for (const font of fonts) {
    editor.createShape({ type: "text", x: 0, y: 0, props: { richText: toRichText("Mgjpqy"), font } });
  }
  await editor.fonts.loadRequiredFontsForCurrentPage();
  await editor.getContainerDocument().fonts.ready;
  editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
}

function App() {
  return createElement(Tldraw, {
    onMount(editor) {
      window.__tldrawEditor = editor;
      window.__tldrawReady = preloadFonts(editor);
    },
  });
}

createRoot(document.getElementById("root")).render(createElement(App));

window.renderMermaid = async (source, opts) => {
  const editor = window.__tldrawEditor;
  if (!editor) throw new Error("tldraw editor is not mounted yet");
  await window.__tldrawReady;

  const existing = [...editor.getCurrentPageShapeIds()];
  if (existing.length) editor.deleteShapes(existing);

  await createMermaidDiagram(editor, source, {
    async onUnsupportedDiagram(svgString) {
      await editor.putExternalContent({ type: "svg-text", text: svgString });
    },
  });

  const ids = [...editor.getCurrentPageShapeIds()];
  if (!ids.length) throw new Error("mermaid produced no shapes");

  const light = await editor.getSvgString(ids, { padding: opts.padding, background: false, darkMode: false });
  const dark = await editor.getSvgString(ids, { padding: opts.padding, background: false, darkMode: true });
  if (!light || !dark) throw new Error("tldraw export produced no svg");

  return { light: light.svg, dark: dark.svg };
};
