import { site, profile, projects } from "../config";

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}

export function personJsonLd() {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: site.url,
    description: site.description,
    image: absoluteUrl(profile.avatar),
  };

  const sameAs = site.socials.map((social) => social.href);
  if (sameAs.length > 0) {
    data.sameAs = sameAs;
  }

  return data;
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    description: site.description,
    inLanguage: site.locale,
  };
}

export function projectsJsonLd() {
  if (projects.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: projects.map((project, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: project.name,
      description: project.description,
      url: project.url,
    })),
  };
}
