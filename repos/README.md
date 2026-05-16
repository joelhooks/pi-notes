# Source reference subtrees

These directories are shallow source snapshots used by agents as local reference material.

They are intentionally committed as source subtrees, not nested git repos or runtime dependencies. Refresh them with shallow clones, record the source, remove nested `.git` directories, then force-add the snapshot because `repos/` is ignored for tooling performance.

| Directory | Source | Purpose |
| --- | --- | --- |
| `pi` | `https://github.com/earendil-works/pi` | Canonical Pi source for extension/session/RPC capability checks |
| `pi-mono` | `file:///Users/joel/Code/joelhooks/pi-mono` | Local Pi source snapshot, docs, examples |
| `effect` | `file:///Users/joel/Code/effect-ts/effect` | Effect source/API reference |
| `keystrok` | `https://github.com/KunalTanwar/keystrok.git` | Keyboard-first design/API inspiration, MIT licensed |

## Refresh shape

```bash
rm -rf repos/pi repos/pi-mono repos/effect repos/keystrok
git clone --depth 1 https://github.com/earendil-works/pi repos/pi
git clone --depth 1 file:///Users/joel/Code/joelhooks/pi-mono repos/pi-mono
git clone --depth 1 file:///Users/joel/Code/effect-ts/effect repos/effect
git clone --depth 1 https://github.com/KunalTanwar/keystrok.git repos/keystrok
rm -rf repos/pi/.git repos/pi-mono/.git repos/effect/.git repos/keystrok/.git
```

Keep `repos/` excluded from TypeScript, SvelteKit, Vite, Brain scans, and formatters.

When intentionally committing a refreshed snapshot:

```bash
git add -f repos/pi repos/pi-mono repos/effect repos/keystrok repos/README.md
```
