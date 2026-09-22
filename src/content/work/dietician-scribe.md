---
title: "AI Dietician Scribe: a consult-to-plan pipeline with a safety gate"
summary: "Five stages from an ambient consultation to a printable Indian meal plan, where every clinical number comes from a deterministic calculator and no unresolved field can pass through."
company: "Independent project"
role: "Product & build"
timeline: "2026 · Jun to Jul"
metrics:
  - { value: "5 stages", label: "Capture to plan, each graded separately" }
  - { value: "37 criteria", label: "Per-stage evaluation rubric" }
  - { value: "8 cases", label: "Gold-labelled consults" }
tags: ["Agent design", "Evals", "Clinical safety", "Healthcare", "Prototype"]
order: 13
featured: false
draft: false
kind: independent
scene: alpenglow
photo: "/photos/alpenglow-garhwal-ridge.webp"
focal: "50% 68%"
gallery:
  - src: "/shots/dietician-scribe/01-capture.webp"
    alt: "A live consultation view with a diarised transcript on the left and a nutrition record filling in on the right"
    caption: "Capture. The record populates as the consultation runs, and any transcript line can be redacted before anything is saved."
  - src: "/shots/dietician-scribe/02-review.webp"
    alt: "A review screen showing extracted fields, two of them flagged as needing review, with a gated confirm action"
    caption: "Structure. Low-confidence fields are flagged, and the confirm action stays blocked until every one of them is resolved."
  - src: "/shots/dietician-scribe/03-targets.webp"
    alt: "An energy and macronutrient target screen showing the calculator inputs, a consistency bar and a guideline citation"
    caption: "Reason. The energy target is calculator-derived, the macros are checked back against it, and each number carries its basis."
  - src: "/shots/dietician-scribe/04-plan.webp"
    alt: "A weekly diet plan editor showing meals for one day against a calorie target, each with edit, regenerate, swap and trace actions"
    caption: "Generate. Every item is grounded in the Indian food composition tables and carries a trace, and regeneration preserves edits."
---

## Context

A solo dietician in India runs a consultation, and then spends the evening turning
handwritten notes into a structured record, a set of energy and macronutrient
targets, and a weekly meal chart. That path is repetitive and highly structured,
which makes it an obvious candidate for automation. It is also clinical, which makes
naive automation dangerous. I built this to work out what it takes to automate the
path without letting a language model anywhere near the numbers that matter.

## The problem

The obvious build is a single model that listens to the consultation and writes a
plan. It fails in ways that are difficult to notice. It invents a nutrition value for
a food. It records an allergy with the polarity reversed, so "not allergic to nuts"
becomes an allergy. It produces an energy target below a safe floor. It applies a
weight-loss deficit to a patient who is pregnant. Each of these outputs is fluent,
plausible and clinically consequential, and none of them looks like an error on the
screen.

## Approach

**Split the work into five stages with separate outputs.** Capture produces a
diarised transcript. Structure produces a nutrition record with per-field confidence.
Reason produces energy and macronutrient targets plus a nutrition diagnosis. Generate
produces a grounded meal plan. Remember carries the record forward to the next visit.
Each stage has its own output, its own failure surface and its own score, so a
regression can be attributed to a specific step instead of to the system as a whole.

**Take the numbers away from the model.** The energy target is computed by a
deterministic calculator using the Mifflin-St Jeor equation and an activity factor,
with a condition-appropriate macronutrient split. The model writes the rationale and
the problem statement around those numbers, and every number displayed to the user
has to trace back to a calculator field. A number that appears in model prose without
that trace is treated as a provenance violation rather than a wording issue.

**Gate the transition between stages.** Extraction marks fields it is unsure about,
and the confirm action that generates targets stays blocked until every flagged field
has been accepted, edited or rejected. The pipeline cannot carry an unresolved field
into a calculation.

**Ground the generated content.** Plan items resolve to entries in the Indian food
composition tables, guideline claims cite the national nutrition recommendations, and
each item carries its source so the dietician can check it. Regeneration is scoped, so
asking for a new day does not overwrite edits already made.

**Keep the human structurally in the loop.** Every generated output is labelled as
AI-drafted or AI-generated and remains editable, transcript lines can be redacted
during capture rather than after, and the plan is finalised by the dietician before it
reaches a patient.

**Write the evaluation rubric before the backend.** The rubric grades 37 criteria
across the five stages plus a cross-cutting block, against eight gold-labelled Indian
consultation cases covering conditions such as gestational diabetes, chronic kidney
disease, thyroid disorders and paediatric underweight. A safety gate is evaluated
before any averaging, so a run that fabricates a calculator number, inverts an
allergy, misses a special-population override or leaks data across patients fails
outright regardless of how high its overall score is.

## What the prototype does

The five-stage flow runs end to end with realistic data and real state carried across
stages, so redactions, edits, confirmations and the finalised plan all flow through to
the patient timeline. The interface is complete and the evaluation design is written.
The backend architecture is specified in detail, including managed speech recognition
for Indian languages behind a provider interface, incremental extraction, deterministic
calculators exposed as tools, and retrieval over the food composition database, but it
is not yet built.

## Reflection & tradeoffs

- **Writing the rubric first changed the design.** Working out how a stage would be
  graded surfaced the failure modes that mattered, and several product decisions,
  including the confirm gate and the number provenance rule, exist because the rubric
  demanded something checkable.
- **Averaging is the wrong instinct for safety.** A high overall score can sit
  comfortably on top of an inverted allergy. Making the safety criteria a hard gate
  evaluated before any aggregation is what stops a good average from hiding a
  dangerous run.
- **Confidence flags create their own risk.** Flagging too much produces alert
  fatigue, and the dietician starts accepting everything without reading it. The
  rubric weights failing to flag a genuinely ambiguous clinical field more heavily
  than over-flagging a clear one, but that balance is a real tradeoff and needs to be
  measured with actual users.
- **What I would build next:** the capture stage, because it is both the hardest and
  the most consequential. Errors in transcribing a weight, a dose or a food quantity
  propagate silently into every calculation downstream, which is why numeric accuracy
  is gated harder than word accuracy in the rubric.
