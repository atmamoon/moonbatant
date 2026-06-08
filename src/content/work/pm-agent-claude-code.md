---
title: "Building a 5x PM agent on Claude Code"
summary: "An always-on autonomous PM agent: one Slack message in, a PRD, a mockup, and a Linear ticket out — built on Claude Code + MCP with parallel research sub-agents and full observability."
company: "Supanote.ai"
role: "Founding Product Manager"
timeline: "2026"
metrics:
  - { value: "5x", label: "Product velocity lift" }
  - { value: "1 Slack msg", label: "→ PRD, mockup & Linear ticket" }
  - { value: "Minutes", label: "Insight → reviewable artifact (was hours)" }
tags: ["Claude Code", "MCP", "Agent design", "Orchestration", "Observability"]
order: 1
featured: true
draft: false
scene: alpenglow
photo: "/photos/alpenglow-amadablam.webp"
focal: center
peak: "Ama Dablam"
---

> Full write-up on Medium:
> [Building a 5x PM Agent](https://medium.com/@sheikh.mamoon.mondal/building-a-5x-pm-agent-b9af78e16628).
> This is the condensed case-study version.

## Context

Most PM work isn't the thinking — it's the production *around* the thinking.
The judgment ("what should we build, and why") takes minutes; writing the PRD,
hunting for context, sketching a mockup, and filing the ticket take hours. And
every new request starts that assembly over from scratch.

I built an autonomous PM agent to own that assembly layer, so I keep the judgment
and the agent does the production.

## The problem

The goal was to **collapse the distance between having an insight and having a
reviewable artifact** — without giving up the parts of PM that actually require a
human. That meant an agent that could take a raw, ambiguous Slack message and turn
it into a ready-for-review PRD, mockup, and ticket, while staying inspectable enough
that I'd trust it and improve it.

## Approach

**Architecture.** The kernel is **Claude Code in headless mode** (`claude -p`) with
product-agnostic routing logic. Capabilities are **six on-demand skills** —
`create-prd`, `create-story`, `update-spec`, `design-mockup`, `ask-pm`, and
`action-request` — loaded only when needed.

**The pipeline, in five stages:**

1. **Capture** — a Slack Socket Mode listener (always-on, no public webhook) picks
   up the message.
2. **Classify** — a two-tier classifier (cheap regex first, model only when
   ambiguous) routes to the right skill.
3. **Research in parallel** — sub-agents simultaneously pull context from Notion,
   Linear, and Fireflies, run competitive research over web + knowledge base, and
   mine call transcripts; an orchestrator collects the results.
4. **Generate** — a structured PRD (problem traced to evidence, requirements as
   tables, testable acceptance criteria) plus an interactive JSX mockup rendered to
   PNG via headless Chrome.
5. **Publish** — a Linear ticket, the PRD in Notion, the mockup image, and a tidy
   cross-linked Slack reply. Thread memory lets follow-ups *update* existing
   artifacts instead of regenerating them.

**Knowledge & cost.** Per-product **versioned knowledge packs** (surfaces,
vocabulary, integration IDs, a screenshot index) keep mockups consistent with the
real product. A **stronger model orchestrates while a cheaper model runs the
parallel research sub-agents**, under a hard per-task budget cap.

## Impact

- **~5x lift in product velocity** — the agent absorbs the hours of assembly so the
  cycle from insight to reviewable artifact runs in minutes.
- One Slack message now yields a complete, cross-linked **PRD + mockup + Linear
  ticket**, ready for review.

## Reflection & tradeoffs

- **Human stays in the loop by design.** Everything lands as *ready-for-review* —
  the PM owns the *what* and the *why*; the agent owns the *how*.
- **Observability was the unlock.** Every run is inspectable (repo logs + a Notion
  work log), so the agent improved continuously — no black box.
- **Phased rollout earned trust.** Solo testing in a private channel → manual trace
  inspection → team access only after it proved reliable.
- **Designed for the failure modes:** a two-tier classifier for ambiguous intent,
  budget caps for cost, knowledge packs treated as living docs to fight staleness,
  a screenshot index to stop the agent reinventing UI, and explicit "report what
  broke" handling for flaky MCP connections.
- **What's next:** turning the captured traces into formal **eval harnesses**
  (Braintrust), and generalizing from drafting into operations (metrics monitoring
  via PostHog, support triage via Intercom).
