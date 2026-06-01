---
title: "Automating fax-based referral intake with an AI agent"
summary: "Specialty clinics still run referrals over fax. An AI intake agent cut turnaround 40% and 4x'd per-user operational efficiency."
company: "Innovaccer"
role: "Product Manager"
timeline: "2022–2025"
metrics:
  - { value: "4x", label: "Per-user operational efficiency" }
  - { value: "40%", label: "Faster turnaround time" }
tags: ["AI agent", "Healthcare ops", "Automation", "Workflow"]
order: 3
featured: false
draft: false
---

> Draft case study — metrics are from my own work. Expand the discovery, the
> before/after workflow, and the rollout detail with what you can share.

## Context

In US healthcare, specialty referrals still move over **fax**. For specialty
clinics, a human reads each inbound fax, extracts the patient and referral details,
and keys them into the system — slow, error-prone, and a poor use of clinical-ops
time. At Innovaccer I owned the product work to automate this.

## The problem

Manual intake was the bottleneck. Turnaround time (how long from fax arriving to
referral actioned) was long, throughput was capped by headcount, and accuracy
depended on whoever was reading the page that day.

## Approach

I shipped an **AI intake agent** that reads inbound faxes, extracts the structured
referral data, and routes it into the workflow — turning a manual transcription
step into a reviewed, automated one.
*(Expand: extraction approach, the human review/confirmation step, and how you
measured extraction quality before trusting it.)*

## Impact

- **4x improvement in per-user operational efficiency.**
- **40% faster turnaround time** on referral intake.

## Reflection & tradeoffs

This was an early, concrete example of the pattern I've kept building since:
automate the high-volume, low-judgment transcription work, but keep a human review
step where being wrong is expensive.
