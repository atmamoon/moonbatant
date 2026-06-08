---
title: "Re-architecting benefits verification into an agentic system"
summary: "Took a brittle rule-based enterprise workflow to a harness-based agent orchestration — 2.2x ARR in 3 months, with eval-gated reliability for an enterprise bar."
company: "Supanote.ai"
role: "Founding Product Manager"
timeline: "2026 · 3 months post-launch"
metrics:
  - { value: "2.2x", label: "ARR in 3 months" }
  - { value: "0 → 1", label: "Launched the product line" }
  - { value: "Eval-gated", label: "Regressions caught pre-production" }
tags: ["Agent design", "Orchestration", "Evals", "Enterprise B2B", "Reliability"]
order: 4
featured: true
draft: false
scene: storm
photo: "/photos/storm-annapurna.webp"
focal: center
peak: "Annapurna"
---

## Context

Alongside the PLG scribe, I own an **enterprise B2B benefits-verification** product
at Supanote — a 0-to-1 line I launched and then scaled. Benefits verification is a
high-stakes, high-variance workflow: lots of edge cases, lots of ways to be subtly
wrong, and enterprise customers who feel every incident.

## The problem

The initial implementation was **rule-based**. Rules are predictable but brittle:
every new payer quirk or edge case meant another branch, and the system couldn't
generalize. Reliability suffered as coverage grew — too brittle to hold the bar an
enterprise product demands.

## Approach

I re-architected the workflow into an **agentic, harness-based orchestration**:

- **Parallel agents** handling sub-tasks concurrently instead of one monolithic flow.
- **Skill hierarchies** so capabilities compose rather than duplicate.
- **Tool calling** to reach the systems of record the verification depends on.
- **Context/memory loops** so the system carries state across steps.

The reliability work was inseparable from the architecture work. I ran
**architectural audits** to find failure surfaces and built a **custom eval
harness** so we could catch regressions before they reached production rather than
discovering them as incidents.

## Impact

- **2.2x ARR within 3 months** of the 0-to-1 launch.
- **Hardened reliability to an enterprise bar** — a custom eval harness plus
  architectural audits caught regressions before they reached production.

## Reflection & tradeoffs

The throughline: an agentic system buys you generalization, but it only earns
enterprise trust if reliability is engineered in deliberately — evals as a gate,
audits as a habit, and clear decisions about where a human stays in the loop.
*(Expand: the specific human-in-the-loop and guardrail choices you made, and where
you chose control over full automation.)*
