// Articles published elsewhere (Medium, etc.). These appear in the Writing
// list alongside local posts, marked with an outbound link.
export type ExternalPost = {
  title: string;
  description: string;
  date: string; // ISO date
  url: string;
  source: string;
  tags: string[];
};

export const EXTERNAL_WRITING: ExternalPost[] = [
  {
    title: 'Building a 5x PM Agent',
    description:
      'One Slack message in — a PRD, a mockup, and a Linear ticket out. The architecture of an autonomous PM agent on Claude Code + MCP.',
    date: '2026-05-31',
    url: 'https://medium.com/@sheikh.mamoon.mondal/building-a-5x-pm-agent-b9af78e16628',
    source: 'Medium',
    tags: ['Agents', 'Claude Code', 'MCP', 'PM'],
  },
  {
    title: 'One WhatsApp Chat Now Runs My Entire Digital Life',
    description:
      'An always-on AI agent running on my old PC that monitors email, Slack, analytics, and news — replacing five apps with one WhatsApp chat.',
    date: '2026-04-10',
    url: 'https://medium.com/@sheikh.mamoon.mondal/i-replaced-5-apps-with-one-whatsapp-chat-using-an-ai-agent-running-on-my-old-pc-f48eedfe2229',
    source: 'Medium',
    tags: ['Agents', 'Automation', 'Self-hosted'],
  },
  {
    title: 'My USB WiFi Dongle Kept Showing Up as a Disk Drive on Linux',
    description:
      "The frustrating problem every Linux user with a Realtek WiFi dongle eventually hits — and how I fixed it.",
    date: '2026-03-22',
    url: 'https://medium.com/@sheikh.mamoon.mondal/my-usb-wifi-dongle-kept-showing-up-as-a-disk-drive-on-linux-heres-how-i-fixed-it-152a4e6db3dc',
    source: 'Medium',
    tags: ['Linux', 'Troubleshooting'],
  },
];
