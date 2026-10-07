import type { Project } from "../config";

interface RepoResponse {
  language?: string | null;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
}

const COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Astro: "#ff5a03",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Shell: "#89e051",
  Java: "#b07219",
  Ruby: "#701516",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4f5d95",
  Lua: "#000080",
  Nix: "#7e7eff",
};

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: RepoResponse | null }>();

function token(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
}

async function fetchRepo(repo: string): Promise<RepoResponse | null> {
  const cached = cache.get(repo);
  if (cached && Date.now() - cached.at < TTL) {
    return cached.data;
  }

  let data: RepoResponse | null = null;

  try {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "lunynt.lol",
    };

    const auth = token();
    if (auth) {
      headers.authorization = `Bearer ${auth}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
    });

    if (response.ok) {
      data = (await response.json()) as RepoResponse;
    }
  } catch {
    data = null;
  }

  cache.set(repo, { at: Date.now(), data });
  return data;
}

export async function enrichProjects(projects: Project[]): Promise<Project[]> {
  return Promise.all(
    projects.map(async (project) => {
      if (!project.repo) {
        return project;
      }

      const data = await fetchRepo(project.repo);
      if (!data) {
        return project;
      }

      const language = data.language ?? project.language;
      const topics =
        data.topics && data.topics.length > 0 ? data.topics : project.tags;

      return {
        ...project,
        language,
        languageColor: COLORS[language] ?? project.languageColor,
        tags: topics,
        stars:
          typeof data.stargazers_count === "number"
            ? data.stargazers_count
            : project.stars,
        forks:
          typeof data.forks_count === "number"
            ? data.forks_count
            : project.forks,
      };
    }),
  );
}
