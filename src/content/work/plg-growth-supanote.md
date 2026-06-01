---
title: "Rebuilding Supanote's PLG activation path"
summary: "Signup→subscription sat flat at ~12% for months. I reframed the quarter around conversion, found the real leak — setup, not the demo note — and lifted trial-to-paid +5% in two months."
company: "Supanote.ai"
role: "Founding Product Manager"
timeline: "2026 · ~2 months"
metrics:
  - { value: "+5%", label: "Trial-to-paid conversion (2 mo)" }
  - { value: "5 in 7", label: "Activation metric (notes / days)" }
  - { value: "3.5% → <1%", label: "Incident rate, cut in parallel" }
tags: ["PLG", "Funnel & activation", "PostHog", "Experimentation", "Growth"]
order: 4
featured: true
draft: false
---

## Context

Supanote is an AI clinical scribe for behavioral-health providers — therapists,
psychiatrists, counsellors. Acquisition was healthy: Facebook ads, Reddit, and the
primary volume from ICP-targeted blog content were landing the right users on the
signup page. But **signup→subscription conversion sat at roughly 12%, flat for
months** despite a growing top of funnel.

## The problem

The team's reflex was to keep shipping features. I argued the opposite: the
constraint wasn't acquisition or surface area — it was everything that happened
*after* signup. So I made **signup conversion the theme for the quarter** and moved
the team off feature work and onto the funnel.

> More traffic into a leaky middle doesn't compound — it just costs more.

## Approach

**Define activation first.** Before optimizing anything, I needed a target that
actually correlated with revenue. One threshold stood out: **users who created 5
notes within 7 days almost always subscribed** — the 5th-note and subscription
numbers tracked so closely they were effectively the same event. That became the
activation metric: the *leading* indicator, distinct from the *lagging*
signup→subscription outcome.

**Instrument the whole path.** I instrumented the funnel end to end against the
7-day free trial (in PostHog + GA4, with SQL on top) so every stage had a number
and a drop attached: Signup → Setup complete → First note (24h) → **5th note /
activation (7 days)** → Subscription.

**Diagnose — sessions vs. funnel.** PostHog replays were emphatic: over 80% of
sessions ended right after users saw the demo note, pointing to "the demo note is
the drop-off." But the full analytics funnel showed the bigger, more fixable leak
*upstream*: **setup completion was shedding 20–47% of users** before they ever
reached a real note. The replays showed a symptom; the funnel showed the cause.

> Sessions tell you where it hurts. The funnel tells you where to operate.

**Ship.**

1. **Rebuilt the setup flow** — reworked the highest-friction screens and removed
   the steps causing the 20–47% drop, collapsing the path from signup to a
   provider's first real note.
2. **Pulled the activation moment forward** — reoriented onboarding around first
   note in 24 hours and 5th in 7 days, inside the trial window.
3. **Shipped reliability fixes in parallel** — production incidents were quietly
   taxing trust during the exact window users were deciding whether to pay.

## Impact

- **+5% trial-to-paid conversion lift in two months**, off a flat ~12% baseline.
- Drove the **production incident rate from 3.5% to under 1%** in parallel.

## Reflection & tradeoffs

- **Activation and conversion are different layers — say so out loud.**
  Signup→subscription is the lagging business outcome; activation (5 notes in 7
  days) is the leading indicator you actually move to get there. Keeping them
  distinct kept the team honest about what each change was supposed to do.
- **Qualitative finds the question; quantitative answers it.** The replays were
  essential — they told me where to look — but committing to the demo-note story
  would have been the wrong bet. The funnel redirected the quarter to the leak that
  actually mattered.
- **What's next:** the part trials don't show you — retention cohorts past the trial
  (D7/D30) and a referral loop into a network of providers who already trust the
  tool.
