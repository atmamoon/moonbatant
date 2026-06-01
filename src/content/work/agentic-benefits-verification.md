---
title: "Re-architecting benefits verification into an agentic system"
summary: "Took a brittle rule-based enterprise workflow to a harness-based agent orchestration — driving rapid ARR growth and sharply cutting production incidents post-launch."
company: "Supanote.ai"
role: "Founding Product Manager"
timeline: "2026 · post-launch"
metrics:
  - { value: "0 → 1", label: "Launched the product line" }
  - { value: "ARR ↑↑", label: "Rapid growth post-launch" }
  - { value: "Incidents ↓", label: "Cut sharply via evals + audits" }
tags: ["Agent design", "Orchestration", "Evals", "Enterprise B2B", "Reliability"]
order: 2
featured: true
draft: false
---

> Metrics on this page are generalized to respect Supanote's confidentiality —
> the methods and decisions are real; exact figures available on request.

## Context

Alongside the PLG scribe, I own an **enterprise B2B benefits-verification** product
at Supanote — a 0-to-1 line I launched and then scaled. Benefits verification is a
high-stakes, high-variance workflow: lots of edge cases, lots of ways to be subtly
wrong, and enterprise customers who feel every incident.

## The problem

The initial implementation was **rule-based**. Rules are predictable but brittle:
every new payer quirk or edge case meant another branch, and the system couldn't
generalize. Reliability suffered as coverage grew, and the production incident rate
climbed to a level that was **unacceptable for an enterprise product.**

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

- Drove **rapid ARR growth in the first months** after the 0-to-1 launch.
- **Sharply cut the production incident rate** — to a small fraction of its prior
  level, within weeks — via the audits and eval harness.

## Reflection & tradeoffs

The throughline: an agentic system buys you generalization, but it only earns
enterprise trust if reliability is engineered in deliberately — evals as a gate,
audits as a habit, and clear decisions about where a human stays in the loop.
*(Expand: the specific human-in-the-loop and guardrail choices you made, and where
you chose control over full automation.)*
