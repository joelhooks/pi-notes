import { error, redirect } from "@sveltejs/kit";
import { loadBrainReviewDocument } from "$lib/server/brain-docs";
import type { PageServerLoad } from "./$types";

function workspaceRoot() {
  return process.env.PI_NOTES_WORKSPACE_ROOT || process.cwd();
}

export const load: PageServerLoad = async ({ params }) => {
  const entry = params.entry;
  if (params.product === "pi-notes") throw redirect(308, `/notes/${entry}`);

  if (params.product !== "notes") {
    throw error(404, "Unknown product namespace");
  }

  const document = await loadBrainReviewDocument(workspaceRoot(), entry);
  if (!document) {
    throw error(404, "Brain entry not found");
  }

  return {
    product: params.product,
    entry,
    entries: [],
    documents: [document],
  };
};
