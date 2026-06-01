import { defineCollection, z } from 'astro:content';

// Local "Updates" / blog posts. Drop a new .md file into src/content/blog/
// with this frontmatter and it shows up automatically on /writing.
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
