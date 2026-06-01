# moonbatant.com

Personal portfolio + writing site for **Mamoon Mondal** — Founding PM, AI-native products.
Built with [Astro](https://astro.build). Static, fast, markdown-driven.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs static site to dist/
npm run preview  # preview the production build
```

## Editing content

Almost everything is data-driven — no need to touch components:

| What | Where |
|------|-------|
| Name, headline, contact links, LinkedIn/GitHub | `src/consts.ts` → `SITE`, `SOCIALS`, `HERO` |
| About paragraph | `src/consts.ts` → `ABOUT` |
| Experience / education / skills | `src/consts.ts` → `EXPERIENCE`, `EDUCATION`, `SKILLS` |
| Project cards ("Building with Claude") | `src/consts.ts` → `PROJECTS` |
| Medium / external articles | `src/data/external-writing.ts` |
| Résumé PDF (download button) | replace `public/resume.pdf` |

### Add a new post / update

Drop a markdown file into `src/content/blog/`:

```markdown
---
title: "My new update"
description: "One-line summary shown in the list."
date: 2026-06-15
tags: ["Agents", "Claude Code"]
draft: false
---

Body in markdown…
```

It appears automatically on `/writing` and the homepage teaser, sorted by date.
Set `draft: true` to keep it hidden.

## ⚠️ Before going live

- Set your real **LinkedIn URL** in `src/consts.ts` (`SOCIALS.linkedin` — currently a guess).
- Optionally add a **GitHub URL** (`SOCIALS.github`).

## Deploy to moonbatant.com

The site builds to a static `dist/` folder — host it anywhere. Recommended free options:

### Option A — Cloudflare Pages (recommended)
1. Push this repo to GitHub.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → connect the repo.
3. Build command: `npm run build` · Output directory: `dist`.
4. **Custom domains** → add `moonbatant.com`. If your DNS is on Cloudflare, it wires up automatically; otherwise point a `CNAME` to the `*.pages.dev` target.

### Option B — Netlify
1. Push to GitHub → Netlify → **Add new site** → import repo.
2. Build: `npm run build` · Publish dir: `dist`.
3. **Domain settings** → add `moonbatant.com` and follow the DNS instructions.

### Option C — Vercel
1. Import the repo at vercel.com. Astro is auto-detected.
2. **Settings → Domains** → add `moonbatant.com`.

> `public/CNAME` (`moonbatant.com`) is included for **GitHub Pages**. If you deploy with
> Pages instead, set the custom domain in the repo's Pages settings — the CNAME file is read automatically.

DNS, in short: add an `A`/`ALIAS`/`CNAME` record at your registrar pointing the apex
`moonbatant.com` (and optionally `www`) at your host, then verify in the host's dashboard.
