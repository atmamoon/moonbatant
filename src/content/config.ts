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
    // Where the work was done. 'work' = shipped in a product role; 'independent'
    // = a self-directed build; 'academic' = a university project. The register
    // on /work groups by this, so the three are never conflated.
    kind: z.enum(['work', 'independent', 'academic']).default('work'),
    // Product screenshots, rendered as captioned plates after the body
    // (captured by scripts/capture-projects.mjs into public/shots/<slug>/).
    gallery: z
      .array(z.object({ src: z.string(), alt: z.string(), caption: z.string() }))
      .default([]),
    galleryTitle: z.string().default('Screens'), // "Stills" for a film's frames
    // Films of the work (YouTube), shown as plates under the headline results.
    // Nothing loads from YouTube until the reader presses play; the poster is
    // a still of our own, hosted here.
    films: z
      .array(
        z.object({
          id: z.string(), // YouTube video id
          title: z.string(),
          by: z.string(), // who published it
          duration: z.string(), // "1:36"
          poster: z.string(), // "/shots/<slug>/film-....webp"
          caption: z.string(),
        }),
      )
      .default([]),
    // Where the work can be inspected: source, papers, the video channel.
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    // ── Himalayan scene attribution (drives the case-study backdrop) ──
    // Each project is bound to one atmosphere + one ultra-HD peak photo.
    scene: z
      .enum(['alpenglow', 'winterline', 'storm', 'lake', 'night'])
      .default('alpenglow'),
    photo: z.string().optional(), // e.g. "/photos/alpenglow-amadablam.webp"
    focal: z.string().default('center'), // background-position for the photo
    peak: z.string().optional(), // ambient label only — never shown in UI
  }),
});

// On-site posts — project write-ups and essays, rendered at /writing/<slug>.
const writing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work, writing };
