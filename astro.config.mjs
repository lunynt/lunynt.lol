import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { shortLinks } from "./src/config.ts";

const redirects = Object.fromEntries(
  Object.entries(shortLinks).map(([slug, destination]) => [
    `/${slug}`,
    destination,
  ]),
);

export default defineConfig({
  site: "https://lunynt.lol",
  output: "static",
  adapter: vercel(),
  security: { checkOrigin: true },
  redirects,
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/404") && !page.includes("/admin"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
