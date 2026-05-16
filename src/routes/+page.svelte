<script lang="ts">
  const links = [
    { href: "/pi-notes", label: "pi-notes dogfood" },
    { href: "/aihero", label: "aihero" },
    { href: "/joelclaw", label: "joelclaw" },
  ];
</script>

<svelte:head>
  <title>pi-notes</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-16 leading-relaxed">
  <p class="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-stone-500">pi-notes</p>
  <h1 class="text-balance text-5xl font-semibold tracking-tight">Local review documents for Pi sessions.</h1>
  <p class="mt-6 text-xl text-stone-700 dark:text-stone-300">
    Product-namespaced notes, served locally, wired back to the Pi session that spawned them.
  </p>

  <nav class="mt-10 flex gap-3 font-mono text-sm" aria-label="Example namespaces">
    {#each links as link}
      <a class="rounded border border-stone-300 px-3 py-2 hover:bg-stone-100 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-stone-900 dark:border-stone-700 dark:hover:bg-stone-900" href={link.href}>{link.label}</a>
    {/each}
  </nav>
</main>
