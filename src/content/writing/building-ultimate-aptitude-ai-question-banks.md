---
title: "1,098 AI-written exam questions, zero wrong answer keys (that I know of): how Ultimate Aptitude was built"
summary: "The hard problem in AI-generated test prep isn't generating questions — it's making sure the answer keys are right. The verification pipeline, the procedural generators, and the privacy-first analytics behind Ultimate Aptitude."
date: 2026-07-07
tags: ["ultimate-aptitude", "ai", "claude", "building in public"]
---

[Ultimate Aptitude](/ultimate-aptitude/) is a free, open-source aptitude trainer with 1,098 hand-checked GMAT/CAT-level questions. I built it with Claude as my pair — which sounds like the easy way, and mostly was, except for one problem that ate more effort than everything else combined: **an LLM will happily write a hard quant question with a subtly wrong answer key.**

Here's how the build actually worked, and what I'd tell any PM shipping AI-generated content.

## The failure mode: confident, plausible, wrong

Ask a model for a "very hard GMAT probability question with the answer key and a worked explanation" and you'll get one — fluent, exam-flavored, and wrong maybe one time in ten. The explanation will be internally consistent with the wrong answer, which is what makes it dangerous: a student drilling on it learns the mistake. For a practice tool, answer-key correctness isn't a quality bar, it's the entire product.

So generation was never the pipeline. Generation was step one of a pipeline that assumes every generated item is guilty until proven innocent:

1. **Decorrelated re-solving.** Every bank question was re-solved independently — by a separate session that saw only the question, never the proposed key or explanation. Solve-then-compare, not review-and-nod. A grader who can see the answer will agree with it; a grader who can't has to actually do the math. Disagreements got a third resolution pass or the question was dropped.
2. **Machine verification where possible.** For the statistics batch, every answer was verified by an independently written Python computation before insertion — the question's scenario re-implemented as code, executed, and compared against the key. If the numbers didn't match, the item didn't ship.
3. **Correct by construction.** The procedural generator tier flips the problem entirely: templates are built *from* the answer. Pick the answer values first, derive the question around them, and the key can't be wrong. That's what makes unlimited fresh questions safe.
4. **A template-fingerprint audit.** Months in, an audit found clusters of near-clone questions — same underlying shape, different numbers — which quietly shrink a bank's real variety. 46 items were renewed in place: same topic slot, brand-new problem and technique. Content banks rot in non-obvious ways; you have to go looking.

None of this is exotic. It's evals discipline applied to content instead of model behavior — decorrelate the grader from the generator, and prefer execution over judgment wherever the domain allows it.

## The product insight: time is the metric

The other thing I'd defend to anyone building test prep: per-question timing is worth more than more questions. The app records seconds spent on every question and produces a pacing table by topic with blunt verdicts — *time sink*, *accurate but slow*, *fast but wrong*. In my own practice, the score-moving discovery was never "I can't do geometry"; it was "geometry costs me 130 seconds per question at 40% accuracy, so on test day I guess-and-go, and between tests I drill it." One table converts practice from repetition into strategy.

## Analytics without a single byte of PII

The hosted version needed usage data — is anyone using it, which questions are miscalibrated, what do score distributions look like — and I wanted that without collecting anything about *people*. The event schema is three events: `test_started`, `question_answered` (question id, topic, correct or not, seconds spent), `test_completed` (score, duration, completion reason). No identify calls ever, autocapture off, session recording off, Do-Not-Track respected, nothing sent when you run it locally. The only identifier is a random anonymous id in your own browser.

The deliberate trade: an anonymous localStorage id gives true daily-active counts but counts a person's phone and laptop as two users. Fine. Approximately-right population data with zero privacy cost beats precisely-right data with a login wall — the login wall would kill the product's entire reason to exist.

The fun second-order effect: because every answer event carries a question id, real users are now a continuous review layer for the banks. A question with an anomalously low correct-rate for its difficulty tag is either miscalibrated or broken — either way, it gets pulled and re-verified. The verification pipeline never really ends; it just gets outsourced to production.

## Stack, for the curious

Vanilla HTML/CSS/JS, zero dependencies, no build step. Question banks are flat JSON files; test types are config entries composing "N questions from bank X, M from generator Y." The whole thing is [open source](https://github.com/atmamoon/ultimate-aptitude) — MIT for code, CC BY 4.0 for all 1,098 questions.

**[→ Try it](/ultimate-aptitude/)** — no login, and the hardest quant bank is meaner than the real exam.
