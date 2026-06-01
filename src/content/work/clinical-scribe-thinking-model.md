---
title: "Shipping a thinking model for clinical notes"
summary: "An accuracy-vs-latency tradeoff on Supanote's AI scribe — clinical-note accuracy from 85% to 90% via a hand-curated golden set and an engagement-weighted ground truth."
company: "Supanote.ai"
role: "Founding Product Manager"
timeline: "2026 · ongoing"
metrics:
  - { value: "85% → 90%", label: "Clinical-note accuracy" }
  - { value: "+5%", label: "PLG paid conversion (2 mo)" }
  - { value: "60s", label: "Hard latency ceiling set" }
tags: ["Evals", "LLMs", "Clinical accuracy", "Latency/cost tradeoff", "PLG"]
order: 3
featured: true
draft: false
---

## Context

Supanote is an AI clinical scribe: clinicians dictate or record a visit, and the
product generates a structured clinical note. The quality bar is unusually high —
a note that's subtly wrong is worse than no note, because a clinician has to catch
and fix it. I run this PLG self-serve product end to end.

The question on the table: should we move note generation to a **thinking model**?
It promised better notes, but at a real latency cost. Clinicians generate notes in
the flow of a busy day, so latency isn't cosmetic — past a threshold, the feature
stops getting used.

## The problem

"Better notes" is not a metric. Before I could evaluate any model, I had to define
what *good* meant — and in a clinical product, *good* means **clinical accuracy**:
the note has to be medically and factually correct, with no hallucinated findings,
because a wrong note is worse than no note.

- **The real target: clinical correctness.** A note is only good if a clinician
  would sign it as an accurate record of the visit.
- **The measurable proxy: "zero-edit accept."** Clinical correctness is expensive to
  label at scale, so I used *a note the clinician keeps without changing* as the
  observable signal — while staying honest that zero-edit accept blends true clinical
  correctness with style and with rubber-stamping, so it can over-count.
- **Whose judgment counts?** Not all accepts are equal. A low-engagement user who
  rubber-stamps everything carries less signal than a high-engagement editor whose
  edits are deliberate. So I **weighted the ground truth toward high-engagement
  editors**, whose accepts are a far better stand-in for clinical correctness.

## Approach

**Curating a golden set.** Rather than evaluate on noisy production traffic, I built
a clean evaluation set by narrowing ~40k users down to ~3k active, high-feedback
users, then **hand-selecting 70–80 notes** spanning note sizes, languages, and note
types. Small, deliberate, and representative beats large and noisy for this kind of
judgment-heavy eval.

**Measuring the tradeoff explicitly.** Against that golden set:

- **Clinical-note accuracy moved from 85% → 90%** — measured via engagement-weighted
  zero-edit accept and spot-checked against clinician-reviewed correctness.
- Latency moved from **p95 ~30s → ~40s** (+10s).
- I set an explicit **walk-away line: a 60s p95 ceiling.** Beyond that, don't ship —
  go find a model with similar accuracy at lower latency.

## Impact

- Shipped the upgrade and **lifted PLG paid conversion ~5% in two months**,
  alongside onboarding and reliability work.
- Established the golden-set + engagement-weighted-accuracy method as the
  repeatable way we evaluate model changes on the scribe.

## Reflection & tradeoffs

The honest lesson is about **clean attribution.** We shipped the thinking model and
a streamed "thinking steps" UX in the same release and saw a satisfaction lift —
but with two variables changing at once, I couldn't cleanly attribute the lift to
either. The right design is an isolated A/B (model-only vs. model + streaming) so
the metric move is attributable.

It's also worth naming the real trade: this wasn't purely "accuracy vs. latency."
We *accepted* worse latency to gain both accuracy and a better UX — and the
discipline that made it defensible was deciding the 60s ceiling and the accuracy
metric **before** looking at results, not after.
