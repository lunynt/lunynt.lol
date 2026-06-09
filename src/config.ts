import pfp from './assets/pfp.png';
import banner from './assets/banner.png';

export const site = {
  name: 'lunynt.lol',
  url: 'https://lunynt.lol',
  description: "lunynt's personal site.",
  ogImage: 'https://lunynt.lol/banner.webp',
  personImage: 'https://lunynt.lol/pfp.webp',
  lang: 'en',
  locale: 'en_US',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterHandle: undefined as string | undefined,
} as const;

export const pages = {
  privacy: {
    title: `privacy - ${site.name}`,
    description: `what ${site.name} collects and why, in plain language.`,
  },
} as const;

export const user = {
  name: 'lunynt',
  pronunciation: 'lun·int',
  pronunciationHint: '"lun" like "fun", "int" like "tint/hint/mint"',
  pfp,
  banner,
  about: `hi, i'm lunynt, and uh... i build free and open-source projects for everyone. most of my projects focus on creating alternatives to paid or closed-source software, proving that great tools don't need a price tag. if that makes a few greedy developers cry, then that's a bonus :p\n\ni believe open-source makes software better. people can contribute, improve things over time, and build something that's better for everyone, without locking it behind a paywall.`,
  projects: [
    'lunynt/lunynt.lol',
    'lunynt/lunynt',
  ] as string[],
  discord: {
    userId: '160830289357176832', // this is my user id, change this to yours and join discord.gg/lanyard for the RPC to work
  },
} as const;

export const guestbook = {
  nameBlacklist: [
    'admin',
    'administrator',
    'moderator',
    'mod',
    'system',
    'root',
    'support',
    'staff',
    'lunynt',
    'lunynthere',
  ],
} as const;
