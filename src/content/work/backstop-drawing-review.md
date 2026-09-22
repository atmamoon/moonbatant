---
title: "Backstop: a governed review queue for engineering drawings"
summary: "A pre-release check for 2D mechanical drawings that separates what it can prove from what it can only ask, and routes a reviewer's attention to the findings it can defend."
company: "Independent project"
role: "Product & build"
timeline: "2026 · Aug"
metrics:
  - { value: "3 tiers", label: "Claims separated by how provable they are" }
  - { value: "15 sheets", label: "Real public drawings in the queue" }
  - { value: "98% / 90%", label: "Precision gates before a check ships" }
tags: ["Product design", "Evals", "Guardrails", "Manufacturing", "Prototype"]
order: 10
featured: false
draft: false
kind: independent
scene: alpenglow
photo: "/photos/alpenglow-everest.webp"
focal: center
gallery:
  - src: "/shots/backstop/01-queue.webp"
    alt: "The Backstop queue listing 24 drawings with their standard profile, due date and check result"
    caption: "The queue. Every row carries its source, its governing standard profile and its due state, and the tiles above filter the worklist."
  - src: "/shots/backstop/02-exception-review.webp"
    alt: "A drawing sheet with nine numbered findings pinned to it, beside a panel of findings grouped by tier"
    caption: "Exception review. Each finding is a pin on the sheet plus the rule it comes from, a confidence level and a suggested fix."
  - src: "/shots/backstop/03-report.webp"
    alt: "A controlled review package showing the report header, provenance fields and the annotated drawing"
    caption: "The review package. It reaches people who never log in, carrying the annotated sheet, the findings register and the decision trail."
  - src: "/shots/backstop/04-standards.webp"
    alt: "The standards screen showing the workspace fallback, general tolerances and four standard profiles"
    caption: "Authority made inspectable. The governing rules narrow from workspace, to project, to source, to the drawing itself."
  - src: "/shots/backstop/05-insights.webp"
    alt: "An insights dashboard showing a metric hierarchy, governed volume, dismissal rate trend and logged escapes"
    caption: "The measurement design. Dismissal rate and reviewer-added findings are tracked as trust guardrails, not just throughput."
---

## Context

In mechanical manufacturing, the 2D drawing is the contract between the people who
design a part and the people who make it. A manufacturer receives hundreds of these
sheets every month from internal teams and from outside suppliers, and someone has
to check each one before it is released. I wanted to understand what a tool that
performed that check would actually have to get right, so I designed one and built
a working prototype of it.

## The problem

The cost of a drawing error grows at roughly ten times per lifecycle phase. NASA's
error-cost study measured an average of about $23,000 for errors caught early
against about $3.6 million for errors that reached operations on a real aircraft
programme, and the most common escaped errors were part-number, label and callout
mistakes, which is exactly the class a drawing check catches. At the same time the
dedicated checker role has largely disappeared across the industry while drawing
volumes grew, so the reviewing engineers absorbed that work on top of their own.

The binding constraint is therefore not detection. It is trust. A reviewing engineer
will forgive a missed error, but a few false alarms are enough for the tool to be
ignored permanently. Any design that optimises for finding more things will fail on
exactly the users it needs.

## Approach

**Separate the claims by how provable they are.** The product makes three different
kinds of claim and treats them differently. Tier one is deterministic and provable
from the sheet itself, such as a revision table that disagrees with the title block
or an empty CHECKED field, so it asserts a pass or a fail. Tier two is checkable
against ASME Y14.5 or ISO GPS plus the company standard, such as an undefined datum,
so it flags the issue with a rule citation and a confidence level. Tier three is a
defensible opinion, such as a bore tolerance that makes the part expensive to
manufacture, so it is phrased as a question and never as an error.

**Resolve authority before producing any verdict.** The governing rules narrow
through a hierarchy: the workspace default, then a project override, then a profile
for each customer or supplier, and finally what the drawing itself declares. This
matters because model-based definition is a legitimate practice under ISO 16792, so
a missing dimension cannot be proven wrong until it is clear whether the drawing,
the model, or the combined package governs. Authority resolution is an input gate
rather than a check.

**Make abstention a real outcome.** Every check resolves to one of five states:
confirmed defect, standards flag, engineering question, cannot determine when the
required authority or context is missing, and input blocked when the file is
unreadable. Only the first two are ever counted as defects.

**Put precision ahead of recall and enforce it with gates.** Each check class has
to clear an evaluation gate before it ships. Tier one requires at least 98 percent
precision and tier two at least 90 percent, while tier three is judged on usefulness
because scoring it as an accuracy claim would be dishonest.

**Let the reviewer outrank the checker in both directions.** A finding can be
dismissed with a reason, and that reason becomes a candidate company rule. The
finding text and the suggested fix are editable, with the original preserved in the
trail. The reviewer can pin their own findings on the sheet, and a clean result is
contestable as well, which reopens the drawing. Analytics stop at the workspace,
project and source level, so no individual drafter is ever scored. The tool never
blocks a release, and approving with open findings records an auditable override.

## What the prototype does

The build covers the full loop: a governed queue of 24 drawings across internal,
supplier and reference streams; an intake flow with duplicate detection and
readability checks; exception review with nine pinned findings across all three
tiers; a clean-result review whose decision log can be contested; a controlled
review package that exports as a real multi-page PDF with the annotated rendering,
the findings register, the decision trail and a render hash; and screens that make
the standards hierarchy and the measurement design inspectable.

The queue is backed by 15 real public drawings from OpenBuilds and an Iowa State
mechanical engineering course, with the licence and source URL recorded on each one.
Five of them carry human-verified labels. The other ten are marked as review
unavailable and source only, rather than being assigned invented results, and the
checking engine itself is declared as simulated inside the interface.

## Reflection & tradeoffs

- **The honesty rule shaped the product more than any feature did.** Refusing to
  invent a result for a real drawing forced abstention to become a visible product
  state with its own design, rather than an error case. That state turned out to be
  one of the more useful parts of the interface.
- **Precision gates are a product decision, not an engineering detail.** Choosing
  98 percent for the deterministic tier sets what can ship, and it also sets the
  order in which capabilities get built.
- **Small clean control sets prove less than they appear to.** The target false-block
  rate is under 2 percent, and 15 clean sheets cannot demonstrate that. Roughly 150
  independent clean sheets would be needed, which is worth stating plainly rather
  than implying a stronger claim than the data supports.
- **What I would build next:** a narrow live pipeline for the deterministic tier
  only, revision-to-revision comparison, and a labelled corpus large enough to make
  the precision gates real measurements instead of design targets.
