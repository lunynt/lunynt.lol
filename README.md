# lunynt.lol

lunynt's open-source personal website.

## stack

- framework: astro
- styling: tailwind v4
- script: typescript
- animations: motion
- hosting: vercel
- storage: supabase postgres (connected via the vercel integration)

## apis used

- lanyard api (for discord status)

## getting started

```bash
npm install
npm run dev
```

build for production:

```bash
npm run build
npm run preview
```

## configuration

everything editable lives in `src/config.ts`:

- `site`: name, url, title, description, keywords, locale, theme color, discord id, social links
- `profile`: name, pronunciation, avatar, about paragraphs
- `projects`: list of projects with name, description, url, language, tags, stars, forks
- `visitor`: enable or disable the counter and set its storage namespace
- `intro`: enable the landing animation and edit its lines
- `guestbook`: enable the guestbook and set the name and message limits and page size

## assets

the avatar is your own file referenced by `profile.avatar` in `src/config.ts`,
living in `public/`. the banner lives at `src/assets/banner.jpeg` and is imported
in `src/components/Profile.astro`, so astro optimizes it and the production build
serves it as webp. swap that file to change the banner. the open graph image at
`public/og.png` is generated from config. regenerate it after editing site copy
or the name:

```bash
npm run assets
```

## visitor count

the visitor count and the welcome line are served by `src/pages/api/visit.ts`,
which does an atomic upsert on a single integer row in supabase postgres. it stores
an aggregate count only, with no ip address, cookies, or identifiers. the details
are documented in `src/pages/privacy.astro`.

to enable storage, connect supabase to your vercel project (or add the supabase
integration from the marketplace), then expose `POSTGRES_URL`. locally, copy
`.env.example` to `.env` and paste the connection string from the supabase
dashboard. when it is missing the endpoint returns an empty result and the site
still renders normally.

## guestbook

the guestbook is served by `src/pages/api/guestbook.ts`. `GET` returns the latest
entries (with each entry's score and your own vote) and `POST` inserts one after
validating the input, the rate limit, and the captcha. `src/pages/api/guestbook/vote.ts`
records an up, down, or cleared vote. entries live in the `guestbook` table.

it uses cloudflare turnstile. create a widget for the domain at
dash.cloudflare.com, then set `PUBLIC_TURNSTILE_SITE_KEY` (rendered into the page)
and `TURNSTILE_SECRET_KEY` (server only). when the secret is not set the captcha
check is skipped so local development works without keys.

posting and voting are rate limited per visitor (a random `lunynt_vid` cookie) and
per hashed ip. the limits live in `src/config.ts` under `guestbook`:
`postsPerWindow` per `windowMinutes`, and `votesPerMinute`. set `RATE_LIMIT_SALT`
to a random string so the ip hash is not guessable.

## abuse protection

the guestbook and vote endpoints enforce the following: same-origin check (blocks
cross-site requests), a json `content-type` requirement, a request body size cap,
strict uuid validation, a turnstile token, and rate limiting per visitor and per
hashed ip. vote writes lock the entry row (`select ... for update`) and recompute
the score inside a transaction, so concurrent votes cannot corrupt the score. the
rate limiter runs as a hardened `security definer` function with execute revoked
from the public roles, and expires old rows.

entries are capped by length (`maxName`, `maxMessage` in config) with a live
character counter in the form, and name and message are filtered against
`guestbook.blockedWords`, which catches normal, leetspeak, and spaced-out attempts.

## short links

configurable redirects live in `src/config.ts` as `shortLinks`, a map of slug to
destination. `astro.config.mjs` turns them into 301 redirects at build time, so
`/discord`, `/gh`, `/git`, `/telegram`, and `/tg` (or anything you add) just work.

## analytics

`src/pages/api/visit.ts` increments the total and records an aggregate page view
per day and path in the `page_views` table (counts only, no identifiers). the
numbers surface in the admin dashboard.

## admin dashboard

`/admin` is a private dashboard for the guestbook and traffic. set
`ADMIN_USERNAME` and `ADMIN_PASSWORD` (the sign in credentials) and
`ADMIN_SECRET` (signs the session cookie) to enable it. the login form is also
protected by turnstile. the dashboard shows total visits, aggregate page views
(today, week,
total, a 14 day chart, and top paths) and the guestbook with approve, deny, pin,
reply, and delete. the pages are server rendered and the actions post to
`/api/admin/*`, all gated by a signed, http-only session cookie.

## database

both features use a single supabase postgres database. the schema is:

```sql
create table public.visits (
  id text primary key,
  count bigint not null default 0
);

create table public.guestbook (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  message text not null check (char_length(btrim(message)) between 1 and 500),
  score integer not null default 0,
  status text not null default 'approved',
  pinned boolean not null default false,
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.guestbook_votes (
  entry_id uuid not null references public.guestbook(id) on delete cascade,
  voter_id text not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (entry_id, voter_id)
);

create table public.page_views (
  day date not null,
  path text not null,
  count integer not null default 0,
  primary key (day, path)
);

create table public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create function public.check_rate_limit(key text, limit integer, window integer)
returns boolean ...
```

row level security is enabled on both with no public policies, so only the server
connection (the `POSTGRES_URL` role) can read or write. swap the connection string
after the integration injects it, or pull it locally with `npm run vercel:pull`.

## web files

- `public/robots.txt`
- `public/.well-known/security.txt`
- `public/manifest.webmanifest`
- `public/favicon.svg`
- `sitemap-index.xml` is generated at build time by the astro sitemap integration

## license

this project is licensed with AGPL v3.
