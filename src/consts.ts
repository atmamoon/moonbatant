// ─────────────────────────────────────────────────────────────────────────
// Site-wide config. Edit this file to update your contact links, headline,
// experience, and project cards — everything below flows into the pages.
// ─────────────────────────────────────────────────────────────────────────

export const SITE = {
  name: 'Mamoon Mondal',
  domain: 'moonbatant.com',
  title: 'Mamoon Mondal — AI Product Manager',
  description:
    'AI Product Manager with 4+ years building AI-native products — agentic systems, eval-driven reliability, and PLG growth. Writing about building AI agents with Claude.',
  // Used for absolute URLs (Open Graph). Keep in sync with astro.config.mjs.
  url: 'https://moonbatant.com',
};

// ── Analytics ───────────────────────────────────────────────────────────
// Paste your PostHog *Project API Key* below to turn on site-wide tracking.
// It's a public client key (starts with `phc_`) — safe to commit.
// Get it: posthog.com → sign up (free) → Settings → Project → "Project API Key".
// Host: US cloud = https://us.i.posthog.com · EU cloud = https://eu.i.posthog.com
// Leave posthogKey empty to disable tracking entirely (no script loads).
export const ANALYTICS = {
  posthogKey: 'phc_AGCpstJm3x2tY5LhLagAwzKSEHaZYyTr7utRdTUwWpFr',
  posthogHost: 'https://us.i.posthog.com',
};

export const SOCIALS = {
  email: 'sheikh.mamoon.mondal@gmail.com',
  linkedin: 'https://www.linkedin.com/in/mamoon-mondal',
  medium: 'https://medium.com/@sheikh.mamoon.mondal',
  // Optional: add a GitHub URL to show it in the header/footer
  github: 'https://github.com/atmamoon',
  location: 'Bengaluru, India',
  phone: '+91 7022382627',
};

export const HERO = {
  name: 'Mamoon Mondal',
  role: 'AI Product Manager',
  tagline:
    'I build AI-native products end to end — running a PLG self-serve product and an enterprise B2B agentic product in parallel, owning 0-to-1 discovery, agent design, and eval-driven reliability.',
  // Short punchy line above the name
  kicker: '4+ years building AI-native products',
};

// ── Hero rotation ───────────────────────────────────────────────────────
// A dusk-into-night arc. The first entry shows upfront (best shot); the hero
// cross-fades through the rest like changing mountain weather.
export const HERO_SCENES = [
  { scene: 'night',      photo: '/photos/night-zanskar.webp',            focal: 'center'  },
  { scene: 'winterline', photo: '/photos/winterline-kangchenjunga.webp', focal: 'center'  },
  { scene: 'alpenglow',  photo: '/photos/alpenglow-garhwal-ridge.webp',  focal: '50% 72%' },
  { scene: 'alpenglow',  photo: '/photos/alpenglow-everest.webp',        focal: 'center'  },
];

// Night Milky-Way backdrop behind the Writing/Contact footer.
export const FOOTER_PHOTO = '/photos/night-milkyway-pano.webp';

// ── Writing ─────────────────────────────────────────────────────────────
export const WRITING: { title: string; outlet: string; href: string }[] = [
  {
    title: 'Building a 5x PM Agent',
    outlet: 'Medium',
    href: 'https://medium.com/@sheikh.mamoon.mondal/building-a-5x-pm-agent-b9af78e16628',
  },
  {
    title: 'I built a free GMAT/CAT-level practice app with AI — the hard part was making sure the answers were actually right',
    outlet: 'Medium',
    href: 'https://medium.com/@sheikh.mamoon.mondal/i-built-a-free-gmat-cat-level-practice-app-with-ai-the-hard-part-was-making-sure-the-answers-were-5b4480839451',
  },
];

export const ABOUT = `I'm an AI product manager who builds AI-native products from zero to one. As founding PM at Supanote.ai, I run a PLG self-serve clinical-scribe product and an enterprise B2B benefits-verification agent in parallel — owning discovery, agent design, and the eval harnesses that keep them reliable in production.

Before that, at Innovaccer, I shipped AI agents that automated healthcare operations at scale, lifting per-user efficiency 4x and unifying post-acquisition product integrations.

I use AI heavily inside my own workflow too — building internal agents on Claude Code + MCP that automate program and design ops and multiply my throughput as a PM. I write about those experiments below.`;

// ── Experience ──────────────────────────────────────────────────────────
export type Job = {
  company: string;
  role: string;
  period: string;
  location: string;
  highlights: string[];
};

export const EXPERIENCE: Job[] = [
  {
    company: 'Supanote.ai',
    role: 'Founding Product Manager',
    period: 'Jan 2026 — Present',
    location: 'Bengaluru, India',
    highlights: [
      'Lifted PLG paid conversion 5% in 2 months on the AI clinical scribe through funnel analysis, onboarding iteration, and reliability improvements — running PLG and enterprise B2B in parallel.',
      'Scaled the B2B benefits-verification agent to 2.2x ARR in 3 months post 0-to-1 launch by re-architecting rule-based workflows into an agentic, harness-based orchestration with parallel agents, skill hierarchies, tool calling, and context/memory loops.',
      'Drove production incident rate from 3.5% to <1% in 2 weeks via architectural audits and a custom eval harness.',
      'Built the founding product operating layer — analytics, agile cadence, and internal AI agents automating program and design ops — driving a 5x lift in product velocity.',
    ],
  },
  {
    company: 'Innovaccer',
    role: 'Product Manager',
    period: 'Jul 2022 — Dec 2025',
    location: 'Noida, India',
    highlights: [
      'Automated fax-based referral intake for specialty clinics with an AI agent, improving per-user operational efficiency 4x (40% faster TAT).',
      'Scaled adoption of an automation platform 75% in 3 quarters by segmenting users, uncovering key pain points, and shipping bi-weekly experiments guided by KPIs.',
      'Improved complex UI flows via user-journey analytics and A/B testing, lifting active engagement 35%.',
      'Scaled automation execution capacity 2x through demand forecasting and rapid cross-functional delivery, maintaining <1% error rate under higher load.',
      'Unified post-acquisition product integrations into a single UX, achieving 100% SLA adherence and <2% incident rate post-launch.',
      'Built a contract-driven integration layer replacing one-off API/Kafka hooks, cutting rollout time by 67%.',
    ],
  },
];

export const EDUCATION = {
  school: 'Indian Institute of Technology (IIT) Dhanbad',
  degree: 'B.Tech, Mechanical Engineering · CGPA 8.28',
  period: '2018 — 2022',
};

export const SKILLS: { group: string; items: string[] }[] = [
  {
    group: 'Product',
    items: ['Discovery', 'Strategy', 'Roadmapping', 'Prioritization', 'GTM', 'Eval frameworks', 'A/B testing', 'KPI trees', 'Telemetry'],
  },
  {
    group: 'AI & Agents',
    items: ['LLMs (Claude, OpenAI, Gemini)', 'Agent design', 'Harnesses', 'Tool calling', 'Skill hierarchies', 'Context/memory', 'HITL & guardrails', 'RAG', 'Evals', 'MCP'],
  },
  {
    group: 'AI Foundations',
    items: ['Post-training (SFT, RLHF, DPO)', 'Reasoning models', 'Transformer internals'],
  },
  {
    group: 'Data & Tools',
    items: ['Claude Code', 'Codex', 'SQL', 'Python', 'Mixpanel', 'PostHog', 'Linear', 'Figma', 'n8n', 'Cursor', 'Braintrust', 'Langfuse'],
  },
];
