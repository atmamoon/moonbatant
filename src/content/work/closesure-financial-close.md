---
title: "CloseSure: substantiating a balance sheet instead of asserting it"
summary: "A month-end close tool that computes what supports each balance from data the business already has, sends only the exceptions to people, and refuses to let a sign-off hide a remaining exposure."
company: "Independent project"
role: "Product & build"
timeline: "2026 · Jul"
metrics:
  - { value: "28 accounts", label: "Carried through one demo close" }
  - { value: "2 engines", label: "Bank and input tax credit matching" }
  - { value: "5 inputs", label: "File formats the support is computed from" }
tags: ["Product design", "Fintech", "Workflow", "Controls", "Prototype"]
order: 12
featured: false
draft: false
kind: independent
scene: winterline
photo: "/photos/winterline-kangchenjunga.webp"
focal: center
gallery:
  - src: "/shots/closesure/01-dashboard.webp"
    alt: "A close dashboard showing touchless percentage, value substantiated, credit exposure, open actions and a ranked work queue"
    caption: "The close dashboard. Twenty-five of twenty-eight accounts are auto-certified under policy, so what reaches a person is the risky remainder."
  - src: "/shots/closesure/02-bank-matching.webp"
    alt: "A bank reconciliation workspace showing proposed matches awaiting acceptance and residual items with their causes"
    caption: "Bank matching. Sets resolve silently only above the confidence line, and everything below it is proposed for a person to decide."
  - src: "/shots/closesure/03-gst-credit.webp"
    alt: "A tax credit reconciliation showing vendors whose invoices are missing from the government return, with per-invoice actions"
    caption: "Input tax credit at risk, attributed vendor by vendor, with a repeat non-filer flagged and each invoice given its own disposition."
  - src: "/shots/closesure/04-close-pack.webp"
    alt: "A close pack listing every account with its balance, difference, certification status and who certified it"
    caption: "The close pack. Every account is either automatically supported or reviewed, and every sign-off names who made it."
---

## Context

In a monthly financial close, the statutory filings have deadlines and therefore get
done. Balance substantiation, which is the work of proving what actually supports
each number on the balance sheet, has no deadline of its own. It accumulates quietly
through the year and then has to be reconstructed under pressure at audit. I built
CloseSure to work through what a tool for the Indian mid-market would look like if it
treated substantiation as the primary job rather than a reporting by-product.

## The problem

The segment I scoped for is roughly ₹80 crore to ₹800 crore in revenue with a finance
team of three to fifteen people. These teams have outgrown spreadsheets for
substantiation but cannot justify enterprise close software, so the work is done by
hand every month and the evidence lives in someone's inbox.

There is also a design trap in this category. It is easy to build a tool where
signing off makes a problem disappear from the screen. That produces a clean-looking
close and an unchanged underlying exposure, which is the exact failure the product
should exist to prevent.

## Approach

**Compute the support instead of collecting it.** The system imports the trial
balance along with data the business already generates: bank statements, the cash
ledger, the purchase register, and the government tax return in the portal's own
format. From those it derives what supports each balance, rather than asking an
accountant to assemble the evidence by hand.

**Two matching engines, and a stated confidence line for silence.** Bank
reconciliation and input tax credit reconciliation both resolve match sets
automatically only where a near-deterministic key exists, such as the bank's own
transaction reference. Anything below that line is proposed to a person rather than
matched silently. The reasoning is asymmetric: a wrong silent match corrodes trust in
every other number on the screen, while a wrong proposal costs one click.

**Wrap it in certification discipline.** Accounts move through prepare, review and
certify. Every engine action and human decision lands in an append-only activity log,
evidence is required above a value threshold before an account can be submitted, and
the same identity cannot both prepare and certify an account.

**Track two numbers and never merge them.** Open actions measure workflow and fall as
decisions get made. Economic exposure measures money and falls only when the
supporting data confirms it. Dispositioning every at-risk invoice takes the open
action count to zero while the exposure stays visible on the dashboard, because a
workflow decision does not put cash in the bank. Certification records decisions and
does not conceal exposure.

**Look for the entries that are quietly wrong.** A suspense entry described as being
booked to balance and still open four closes later is flagged as a forced balance in
June, rather than found by an auditor in September.

**Recompute from the inputs, every time.** Replacing an input file recomputes the
matches, the vendor flags, the exposure figure and every dashboard state derived from
them. This was a deliberate constraint on myself, because it is the difference between
a prototype that demonstrates a system and one that only demonstrates a set of
screens.

## What the prototype does

It carries a 28-account close from data import to a certified close pack. Twenty-five
accounts auto-certify under policy with the governing rule logged against each one,
and the three that carry real risk are routed to people: cash, input tax credit and
suspense. Each of those opens into a workspace that decomposes the difference into
causes, gives every item an age measured in closes survived, and requires a
disposition. The close pack exports an audit-ready statement showing that every
account was either automatically supported or reviewed, every exception was
dispositioned, every sign-off is attributable, and any credit still awaiting vendor
filings is carried forward in writing.

## Reflection & tradeoffs

- **The most useful decision was refusing to let certification zero the exposure.**
  It makes the demo look worse and the product more honest, and it is the single
  choice that most shaped the rest of the design.
- **A single north-star metric would have been gameable here.** Days to close falls if
  you simply assert balances, and credit recovered describes one customer's leak
  rather than the general problem. I paired value substantiated with certification
  integrity, because loosening a threshold raises the first and lowers the second, so
  neither number means anything alone.
- **Thresholds are configuration, and controls are not.** The confidence line, the
  rupee tolerance and the age at which an item is treated as stale are all
  per-customer parameters with defensible defaults. Changing them changes numbers, and
  it should never change the shape of the control.
- **What the demo does not prove:** the touchless rate here comes from data seeded to
  exercise every rule, so it is higher than a real first month would be. The claim I
  would defend is narrower, which is that the exposure in this dataset is traceable to
  the rupee and recomputes when the inputs change.
