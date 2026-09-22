---
title: "Koragg: a chief of staff agent for Slack and Gmail"
summary: "Every inbound message becomes a tracked work item with a deadline, and the agent decides whether a later reply actually satisfies what was asked."
company: "Independent project"
role: "Product & build"
timeline: "2026 · Jun to Jul"
metrics:
  - { value: "133 cases", label: "Labelled evaluation set" }
  - { value: "15 modes", label: "Failure modes scored separately" }
  - { value: "4 calls", label: "Model decisions in the loop, the rest is code" }
tags: ["Agent design", "Evals", "State machines", "Slack & Gmail", "Prototype"]
order: 11
featured: false
draft: false
kind: independent
scene: night
photo: "/photos/night-zanskar.webp"
focal: center
gallery:
  - src: "/shots/koragg/01-board.webp"
    alt: "The Koragg board showing work items grouped into lanes with due dates and next actions"
    caption: "The board. Work sorts into Your Move, Waiting On, Scheduled, Needs Review and Closed, and each card states the next action."
  - src: "/shots/koragg/02-brief.webp"
    alt: "A morning brief listing items to clear first, items owed today, and items waiting on other people"
    caption: "The morning brief. The model phrases the digest, but the ordering and the deadlines come from the lifecycle state machine."
  - src: "/shots/koragg/03-eval.webp"
    alt: "An evaluation table showing capture recall, false positive rate and type accuracy broken out across fifteen failure modes"
    caption: "Evaluation by failure mode. A single aggregate score would hide the adversarial cases, which are the ones worth watching."
  - src: "/shots/koragg/04-activity.webp"
    alt: "A run log showing each captured item with the model that classified it and its confidence"
    caption: "The run log. Every step is inspectable, including which model made each call and how confident it was."
---

## Context

Work arrives as messages, and messages do not track themselves. A request buried in
the middle of a Slack thread, or a question at the end of a long email, is
indistinguishable from noise until it is already late. I wanted to find out whether
an agent could hold that state reliably rather than just summarise an inbox, so I
built one that runs the whole loop from capture to close.

## The problem

The difficult part is not reading messages. It is making three judgements correctly
and repeatedly. The first is whether a message is work at all. The second is who owes
the next move. The third is whether a later reply actually satisfies what was
originally asked. Getting the first wrong means the system either floods you with
noise or silently drops a commitment. Getting the third wrong means items close
before they are finished, or stay open long after they are done.

## Approach

**One loop, stated explicitly.** Capture a message, classify it, resolve its context,
plan it by writing an explicit definition of done, arm a timer, attach any replies
that arrive, judge whether a reply satisfies that definition, and then close the item,
re-arm it, flip it to your move, or escalate it.

**Collapse lateness and staleness into a single mechanic.** An item is cold when its
timer is running and no satisfying reply has arrived. Modelling it this way removes
the need for a separate path for items that quietly went nowhere, which is where this
kind of system usually leaks.

**Draw a hard line between the model and the code.** The model makes exactly four
bounded decisions: classify a message, plan the item, judge a reply, and phrase the
morning brief. Direction, dates, identity, the timer lifecycle and the scheduler are
all deterministic code covered by unit tests. Every model output is validated against
a schema and returned as a typed object, so no stage ever hands free text to the next
stage.

**Keep the two risky dependencies swappable.** The connector boundary puts synthetic
fixtures and the live Gmail and Slack APIs behind one interface, with a single
normalisation step where any provider-specific shape is allowed to exist. The model
boundary puts an offline deterministic stub, a local subscription path and an API
path behind one interface chosen by an environment variable. The whole pipeline runs
end to end offline with no key and no network.

**Score by failure mode, never as one number.** The evaluation harness grades the two
consequential model decisions over 133 labelled cases and reports 15 failure modes
separately across adversarial, negative and positive categories. The adversarial set
covers the cases that matter most, including a request buried in a thread, a
rhetorical question that only looks like an ask, and a real ask hidden inside a
thank-you message. On the graded run this holds 99 percent capture recall, a 2 percent
false positive rate and 97 percent type accuracy. Because run-to-run model variance is
real, the regression gate is a per-mode comparison against a committed baseline rather
than the headline figures.

**Persist properly and write nothing.** The ledger is SQLite, keyed so that
re-ingesting the same message is idempotent, and it survives restarts. Every outbound
action stays a draft for review and is never sent automatically.

## What the prototype does

It runs a three-day synthetic world end to end: a cold start that builds the ledger
from zero, a sweep that replays later messages and ages items toward breach, a
scheduler that time-blocks owed work into open hours, a prioritised morning brief,
the evaluation matrix, and a read-only dashboard with a per-item trace showing the
source message alongside the agent's step-by-step decisions. The same code path runs
against real Slack and Gmail with credentials supplied, and in that mode all data
stays on the local machine.

## Reflection & tradeoffs

- **Reporting one aggregate score would have hidden the failures worth fixing.**
  Recall of 99 percent looks settled until the breakdown shows which single mode is
  carrying the misses. Splitting the report by mode is what made the evaluation
  useful for deciding what to work on.
- **The timer is the product.** Classification is the part that looks like the
  interesting problem, but the durable value comes from the lifecycle that keeps an
  item alive and correctly assigned until something actually satisfies it.
- **Read-only is a deliberate limit, not an unfinished edge.** An agent that sends on
  your behalf has to be right about intent every time, and nothing in the evaluation
  yet justifies that.
- **What I would build next:** widen the labelled set beyond the synthetic world,
  since fixtures written by the same person who wrote the classifier will always
  flatter it, and grade the planner's definition of done more strictly, because every
  close decision downstream depends on how well that was written.
