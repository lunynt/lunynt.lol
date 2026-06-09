export interface RepoData {
  description: string | null;
  stars: number;
  language: string | null;
  topics: string[];
}

const FALLBACK_COLOR = '#888';

let langColorCache: Promise<Record<string, string>> | null = null;

function getLangColors(): Promise<Record<string, string>> {
  if (!langColorCache) {
    langColorCache = fetch('https://raw.githubusercontent.com/ozh/github-colors/master/colors.json')
      .then(r => (r.ok ? r.json() : {}))
      .then((data: Record<string, { color?: string }>) =>
        Object.fromEntries(Object.entries(data).map(([lang, info]) => [lang, info.color ?? FALLBACK_COLOR]))
      )
      .catch(() => ({}));
  }
  return langColorCache;
}

export async function fetchRepo(slug: string): Promise<{ repo: RepoData | null; langColor: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}`);
    if (!res.ok) return { repo: null, langColor: FALLBACK_COLOR };

    const data = await res.json();
    const repo: RepoData = {
      description: data.description ?? null,
      stars: data.stargazers_count ?? 0,
      language: data.language ?? null,
      topics: data.topics ?? [],
    };

    const langColor = repo.language ? (await getLangColors())[repo.language] ?? FALLBACK_COLOR : FALLBACK_COLOR;
    return { repo, langColor };
  } catch {
    return { repo: null, langColor: FALLBACK_COLOR };
  }
}

export function formatStars(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}
