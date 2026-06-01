import { defineCollection, z } from 'astro:content';

// Deep case studies — the heart of a PM portfolio.
// Body follows Problem → Approach → Impact → Reflection.
// Add a new .md file to src/content/work/ to publish a case study.
const work = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // One-line hook shown in cards and at the top of the case study.
    summary: z.string(),
    company: z.string(),
    role: z.string(),
    timeline: z.string(), // e.g. "2026 · 3 months"
    // Headline metrics shown as callout stats (keep to 2–4).
    metrics: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .default([]),
    tags: z.array(z.string()).default([]),
    // Lower number = shown first. Featured on the homepage if featured: true.
    order: z.number().default(99),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work };
