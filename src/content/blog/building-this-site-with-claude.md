---
title: "Building this site with Claude Code"
description: "Why moonbatant.com exists, and how I spun up the whole thing — design, content, and deploy — in one Claude Code session."
date: 2026-06-01
tags: ["Claude Code", "Meta", "Agents"]
draft: false
---

Welcome to **moonbatant.com** — my corner of the internet for portfolio, writing, and the AI-agent experiments I keep running on the side.

This is the first post, so it's fitting that it's about how the site itself got built: in a single [Claude Code](https://claude.com/claude-code) session, from an empty folder to a deployable Astro site.

## The brief

I wanted three things:

- A **portfolio** that actually reflects what I do — building AI-native products, not just a list of job titles.
- A **writing space** for personal updates on the agents I build, alongside my longer pieces on Medium.
- Something **cheap and fast to host** on a domain I already own.

## How it came together

I handed Claude my résumé and my Medium profile and asked for a portfolio. It pulled the structured content out of both, picked a stack (Astro — markdown-driven, near-zero JS, trivial to deploy), and generated the whole thing: layout, theme toggle, components, and content collections.

The nice part of the setup: **adding a new post is just dropping a markdown file** into `src/content/blog/`. No CMS, no build config to touch.

## What's next

More write-ups on the agents I'm building — the PM agent, the always-on assistant, and whatever rabbit hole comes next. If any of this is useful to you, [reach out](mailto:sheikh.mamoon.mondal@gmail.com).
