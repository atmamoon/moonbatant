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

## Deploy — GitHub Pages (live)

This repo auto-deploys to **GitHub Pages** via `.github/workflows/deploy.yml` on every
push to `main`. No server, no database — it's a fully static site (the résumé is just
`public/resume.pdf`). Repo: https://github.com/atmamoon/moonbatant

- Pages source: **GitHub Actions** (set under Settings → Pages).
- Custom domain: `moonbatant.com` (also stored in `public/CNAME`).

### Point Namecheap DNS at GitHub Pages

In Namecheap → **Domain List → Manage → Advanced DNS → Host Records**, first
**delete** the default `CNAME www → parkingpage.namecheap.com` and the `URL Redirect`
records, then add:

| Type  | Host | Value                | TTL       |
|-------|------|----------------------|-----------|
| A     | @    | 185.199.108.153      | Automatic |
| A     | @    | 185.199.109.153      | Automatic |
| A     | @    | 185.199.110.153      | Automatic |
| A     | @    | 185.199.111.153      | Automatic |
| CNAME | www  | atmamoon.github.io.  | Automatic |

(Optional IPv6 — add four AAAA `@` records: `2606:50c0:8000::153`, `…8001::153`,
`…8002::153`, `…8003::153`.)

Propagation takes minutes to a couple of hours. Then in **Settings → Pages**, once the
domain shows verified, tick **Enforce HTTPS** (GitHub provisions the SSL cert
automatically). Done — `https://moonbatant.com` is live.
