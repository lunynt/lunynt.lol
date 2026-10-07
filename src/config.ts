export interface SocialLink {
  label: string;
  href: string;
  icon: string;
}

export interface Project {
  name: string;
  description: string;
  url: string;
  language: string;
  languageColor: string;
  tags: string[];
  stars: number;
  forks: number;
  repo?: string;
}

export interface SiteConfig {
  name: string;
  url: string;
  title: string;
  description: string;
  keywords: string[];
  locale: string;
  themeColor: string;
  discordId: string;
  socials: SocialLink[];
}

export interface ProfileConfig {
  name: string;
  pronunciation: string;
  pronunciationHint: string;
  avatar: string;
  about: string[];
}

export interface VisitorConfig {
  enabled: boolean;
  namespace: string;
}

export interface IntroConfig {
  enabled: boolean;
  lines: string[];
}

export interface GuestbookConfig {
  enabled: boolean;
  maxName: number;
  maxMessage: number;
  pageSize: number;
  postsPerWindow: number;
  windowMinutes: number;
  votesPerMinute: number;
  blockedWords: string[];
}

export const site: SiteConfig = {
  name: "lunynt",
  url: "https://lunynt.lol",
  title: "lunynt",
  description:
    "lunynt builds free and open-source software, with a focus on alternatives to paid and closed-source tools.",
  keywords: [
    "lunynt",
    "open source",
    "developer",
    "portfolio",
    "software",
    "typescript",
  ],
  locale: "en",
  themeColor: "#0a0a0b",
  discordId: "160830289357176832",
  socials: [
    { label: "github", href: "https://github.com/lunynt", icon: "github" },
    { label: "telegram", href: "https://t.me/lunynt", icon: "telegram" },
    {
      label: "discord",
      href: "https://discord.gg/fGepBdxTbw",
      icon: "discord",
    },
  ],
};

export const profile: ProfileConfig = {
  name: "lunynt",
  pronunciation: "/ˈlunɪnt/",
  pronunciationHint: "",
  avatar: "/pfp.jpg",
  about: ["hey, i'm lunynt. i enjoy programming and making music."],
};

export const projects: Project[] = [
  {
    name: "lunynt/lunynt.lol",
    description: "lunynt's personal portfolio site",
    url: "https://github.com/lunynt/lunynt.lol",
    language: "TypeScript",
    languageColor: "#3178c6",
    tags: ["astro", "css", "data", "meta"],
    stars: 0,
    forks: 0,
    repo: "lunynt/lunynt.lol",
  },
];

export const visitor: VisitorConfig = {
  enabled: true,
  namespace: "lunynt.lol",
};

export const intro: IntroConfig = {
  enabled: true,
  lines: ["Welcome to lunynt.lol, visitor"],
};

export const shortLinks: Record<string, string> = {
  discord: "https://discord.gg/fGepBdxTbw",
  git: "https://github.com/lunynt",
  gh: "https://github.com/lunynt",
  telegram: "https://t.me/lunynt",
  tg: "https://t.me/lunynt",
};

export const guestbook: GuestbookConfig = {
  enabled: true,
  maxName: 40,
  maxMessage: 500,
  pageSize: 20,
  postsPerWindow: 5,
  windowMinutes: 10,
  votesPerMinute: 60,
  blockedWords: [
    "nigger",
    "nigga",
    "niglet",
    "coon",
    "darkie",
    "spic",
    "spick",
    "wetback",
    "beaner",
    "chink",
    "gook",
    "paki",
    "raghead",
    "towelhead",
    "sandnigger",
    "kike",
    "heeb",
    "faggot",
    "fag",
    "dyke",
    "tranny",
    "shemale",
    "retard",
    "retarded",
    "spastic",
    "mong",
    "cunt",
    "whore",
    "slut",
    "skank",
    "bitch",
    "bastard",
    "kys",
    "kill yourself",
  ],
};
