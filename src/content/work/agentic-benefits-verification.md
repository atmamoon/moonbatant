---
title: "Re-architecting benefits verification into an agentic system"
summary: "Took a brittle rule-based enterprise workflow to a harness-based agent orchestration — 2.2x ARR in 3 months, incidents from 3.5% to under 1%."
company: "Supanote.ai"
role: "Founding Product Manager"
timeline: "2026 · 3 months post-launch"
metrics:
  - { value: "2.2x", label: "ARR in 3 months" }
  - { value: "3.5% → <1%", label: "Production incident rate (2 wks)" }
  - { value: "0 → 1", label: "Launched the product line" }
tags: ["Agent design", "Orchestration", "Evals", "Enterprise B2B", "Reliability"]
order: 2
featured: true
draft: false
---

> Draft case study — the metrics are from my own work. Expand the customer
> context, constraints, and the specific guardrail decisions to the extent you can
> share them publicly.

## Context

Alongside the PLG scribe, I own an **enterprise B2B benefits-verification** product
at Supanote — a 0-to-1 line I launched and then scaled. Benefits verification is a
high-stakes, high-variance workflow: lots of edge cases, lots of ways to be subtly
wrong, and enterprise customers who feel every incident.

## The problem

The initial implementation was **rule-based**. Rules are predictable but brittle:
every new payer quirk or edge case meant another branch, and the system couldn't
generalize. Reliability suffered as coverage grew, and the incident rate sat around
**3.5%** — unacceptable for an enterprise product.

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
- Drove the **production incident rate from 3.5% to under 1% in two weeks** via the
  audits and eval harness.

## Reflection & tradeoffs

The throughline: an agentic system buys you generalization, but it only earns
enterprise trust if reliability is engineered in deliberately — evals as a gate,
audits as a habit, and clear decisions about where a human stays in the loop.
*(Expand: the specific human-in-the-loop and guardrail choices you made, and where
you chose control over full automation.)*
