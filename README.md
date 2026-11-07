# ForumHub

Private, local-first, mobile-first PWA that centralizes your forums, favorites, alerts and AI summaries.
Credentials live in an encrypted vault: the master password and derived keys never leave the device.

**Live app:** https://lcarlini.github.io/ForumHub/ (open it in a browser, or install it from the browser menu: "Add to Home Screen" on iPhone, "Install app" on desktop).

## Deploy to GitHub Pages

The workflow at `.github/workflows/pages.yml` builds and publishes `dist/` on every push to `main`.

One-time setup in the repository:

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the "Deploy to GitHub Pages" workflow manually from the **Actions** tab).
4. The site appears at https://lcarlini.github.io/ForumHub/ once the `deploy` job finishes.

The app is built with `base: '/ForumHub/'` in `vite.config.ts`. If you rename the repository or serve it from a custom domain at the root, change that value.

## Run

```bash
npm install
npm run dev        # http://localhost:5173/ForumHub/
npm run build      # typecheck + production build (dist/)
npm run preview
```

## What's in this version (Phase 1)

- Responsive PWA shell: bottom tab bar under 1024 px, fixed sidebar above.
- First-run vault creation and unlock. Dark theme by default, light theme toggle.
- Vault encryption in the browser: PBKDF2-SHA-256 (600,000 iterations, random 16-byte salt) and AES-256-GCM with a fresh IV on every save. The key is non-extractable and held only in memory.
- Auto-lock after 15 minutes of inactivity, and when the tab stays hidden longer than that.
- IndexedDB (Dexie) stores only the ciphertext record. No plaintext, no keys.
- Forums: CRUD, groups, search, favorites, open counter, last-visited timestamp, encrypted login fields.
- Home: favorite tiles, recently visited, alert summary, quick AI entry.
- Alerts: rule CRUD and enable/disable. Rules are stored but not evaluated yet (Phase 3).
- AI summaries: TL;DR, extract links, solutions, compare opinions, translate, explain technically. Calls go straight from the browser to OpenAI, Anthropic or OpenRouter with the user's own key. Results can be saved in the vault.
- Encrypted backup export and restore (`.fhbackup`, the same ciphertext record).
- Offline app shell via a generated service worker (Workbox through vite-plugin-pwa).

## Not built yet (by design, per the architecture plan)

- R2 cloud sync and the Cloudflare Worker API (`/vault/read`, `/vault/write`, `/ai/proxy`). Phase 2.
- Cron-driven feed checks and Web Push. Phase 3.
- Worker proxy for AI calls. The browser-direct path is the v1 stand-in; `src/lib/ai.ts` is the only place to swap it.
- Gemini support (the type exists; the UI does not offer it yet).
- Automatic forum login or scraping. Out of scope.

## Layout

```
src/
  lib/crypto.ts        PBKDF2 + AES-GCM vault record (pure Web Crypto)
  lib/vault-store.ts   Zustand store: status, session key, mutate/persist, auto-lock
  lib/db.ts            Dexie schema (ciphertext only)
  lib/types.ts         Decrypted vault document types
  lib/ai.ts            Provider client (OpenAI, OpenRouter, Anthropic)
  lib/backup.ts        Encrypted backup download/restore
  screens/             Lock, Home, Forums, Alerts, AI, Settings
  components/ui.tsx    Small design-system primitives
```

## Security notes

- The whole vault is one encrypted document, not per-field ciphertext. The plan's per-field shape can be adopted later; the threat model is the same.
- Losing the master password means losing the vault. There is no recovery path by design. Keep a backup.
- Use Bitwarden for real credentials. ForumHub's login fields are references, not a replacement.
