import { redirect } from "@sveltejs/kit";
import { listBrainEntries } from "$lib/server/brain-docs";
import type { PageServerLoad } from "./$types";

function workspaceRoot() {
  return process.env.PI_NOTES_WORKSPACE_ROOT || process.cwd();
}

export const load: PageServerLoad = ({ params }) => {
  if (params.product === "pi-notes") throw redirect(308, "/notes");

  return {
    product: params.product,
    entries: params.product === "notes" ? listBrainEntries(workspaceRoot()) : [],
    documents: [],
  };
};
