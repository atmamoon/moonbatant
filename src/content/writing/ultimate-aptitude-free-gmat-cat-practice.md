---
title: "Ultimate Aptitude: free, no-login GMAT/CAT-level practice tests"
summary: "I built a timed aptitude trainer with 1,000+ hand-checked questions and per-question pacing analysis — free, open source, and usable without signing up for anything. Here's what's inside and why it exists."
date: 2026-07-07
tags: ["ultimate-aptitude", "gmat", "cat", "open source"]
---

**TL;DR:** [Ultimate Aptitude](/ultimate-aptitude/) is a free, browser-based aptitude trainer — timed GMAT/CAT-level mocks for quant, verbal, data insights, logic and DILR, with per-question pacing analysis. No login, no ads, no paywall, no "unlock full report" tricks. The [code and every question are open source](https://github.com/atmamoon/ultimate-aptitude).

## Why I built it

Earlier this year I had to prepare for a timed cognitive aptitude test as part of a hiring process. The test-prep landscape I found was bleak in a very specific way: everything wanted an email before showing a single question, free tiers capped out at one demo test, and "detailed analytics" lived behind a subscription. The actual product — hard questions under a real clock — was always three signups away.

So I built my own. It started as a personal simulator for one test format and kept growing as my own practice needs got harder: first GMAT/CAT-level quant, then Data Sufficiency, CAT-style DILR sets, GMAT Verbal, Data Insights, and finally a complete three-section GMAT Focus mock. At some point I realized I was sitting on something genuinely useful, and there was no reason to keep it to myself.

## What's inside

**13 session types**, from an 8-minute quant blitz to a full 64-question, 2h15m GMAT Focus Edition mock in real section order. The section mocks follow the *current* official blueprints — GMAT Quant with no geometry and no DS (both moved out in the Focus Edition), Verbal with no sentence correction, Data Insights with all five item types, and CAT QA weighted ~60% to arithmetic and algebra like the real paper.

**1,098 hand-checked bank questions** across seven banks — advanced Problem Solving, Data Sufficiency, DILR sets, Verbal (grouped RC passages), Data Insights (with real charts), plus the original numerical and logic banks. Everything is tagged `hard` or `very-hard`; every answer key was independently re-verified before inclusion. On top of that, a procedural generator tier produces unlimited fresh numerical, logic and spatial questions from randomized templates.

**Real exam mechanics.** A countdown clock that auto-submits at zero. Forward-only navigation — once you advance, your answer locks and there is no back button, exactly like the real tests. Five options, single answer, no calculator. A no-repeat sampler tracks which bank questions you've seen, so nothing repeats until you've exhausted a bank.

**Pacing analysis, which is the part I actually care about.** The app times every question individually. After each test you get a *Pacing by topic* table that tells you where your seconds went and hands out verdicts: ⛔ *time sink — guess fast in tests, drill after*, 🐢 *accurate but slow*, ⚠️ *fast but wrong*. In my own prep, this table changed my scores more than any additional content did. Most people don't lose marks because they can't solve questions; they lose marks because they spend 140 seconds proving they can't solve *this* one.

## The no-login thing is a feature, not an oversight

Everything runs in your browser. Your practice history is stored in your browser's localStorage and is exportable as Markdown whenever you want it. There is no account system because there is nothing an account would do for you — it would only do things for me.

For usage stats, the hosted version sends three anonymous events (test started, question answered, test completed) with zero personal data — no names, no emails, nothing that identifies you. Autocapture is off, session recording is off, Do-Not-Track is respected. The entire analytics implementation is [~90 lines you can read](https://github.com/atmamoon/ultimate-aptitude/blob/main/js/analytics.js), and if you self-host you can turn it off by deleting one line.

## It's open source — questions included

The [GitHub repo](https://github.com/atmamoon/ultimate-aptitude) has everything: MIT-licensed code, and all 1,098 questions under CC BY 4.0 — use them in your own tools, flashcards, or classroom material with attribution. The whole app is dependency-free vanilla HTML/CSS/JS: no build step, no framework. Adding a new test type is a config entry; adding a new question bank is a JSON file.

If you contribute questions, one rule: verify the answer key by solving the question independently before you submit. A wrong key is worse than no question.

**[→ Start practicing](/ultimate-aptitude/)** — pick a session, no signup, first question in ten seconds.
