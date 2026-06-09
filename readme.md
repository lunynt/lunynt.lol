# lunynt.lol
![astro](https://img.shields.io/badge/astro-FF5D01?style=flat&logo=astro&logoColor=white)
![typescript](https://img.shields.io/badge/typescript-3178C6?style=flat&logo=typescript&logoColor=white)
![tailwind css](https://img.shields.io/badge/tailwind_css-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![license](https://img.shields.io/badge/license-AGPL--3.0-blue)

lunynt's personal website, open-source, free to use :)

## features
- guestbook with likes, replies, and live updates via supabase realtime
- visitor counter with cooldown and ip deduplication
- proxy and vpn detection via getipintel.net
- cloudflare turnstile captcha (invisible mode)
- admin panel at `/admin` for managing entries, toggling the guestbook, and reviewing flagged content
- rate limiting and ip blocking built into the api routes
- discord presence (currently playing, listening to, etc.) via [lanyard](https://discord.gg/lanyard)

## stack
- framework: astro
- language: typescript
- styling: tailwind css
- database: supabase (postgres)
- hosting: vercel
- captcha: cloudflare turnstile

## setup

this guide walks u through setting up the project from scratch. u'll need accounts on vercel (hosting), supabase (database), and cloudflare (captcha). all three have free tiers that cover normal usage.

> the "currently" section uses [lanyard](https://discord.gg/lanyard) to show ur discord presence (what ur playing, listening to, etc.). to use it, join the lanyard discord server and set `user.discord.userId` in `config.ts` to ur discord user id. if u skip this, the currently section just won't show anything.

### 1. clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/lunynt.lol.git
cd lunynt.lol
npm install
```

### 2. create a supabase project

1. go to [supabase.com](https://supabase.com) and sign up or log in
2. click **new project**, give it a name, and set a database password (save this somewhere)
3. wait about a minute for it to finish setting up
4. go to **project settings** (gear icon, bottom left sidebar) then **api**
5. copy these three values for later:
   - **project url** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (under "project api keys")
   - **service_role** key (click reveal to see it)

> never share or commit ur service_role key. it bypasses all database security rules.

### 3. create a cloudflare turnstile widget

1. go to [cloudflare.com](https://cloudflare.com) and sign up or log in
2. in the left sidebar go to **turnstile**
3. click **add site**
4. give it a name, add ur domain (use `localhost` for local dev), and set the widget type to **invisible**
5. copy the **site key** and **secret key**

### 4. set up env vars

copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

open `.env.local` and fill in each value:

| variable | value |
|---|---|
| `PUBLIC_SUPABASE_URL` | project url from step 2 |
| `PUBLIC_SUPABASE_KEY` | anon public key from step 2 |
| `SUPABASE_SECRET_KEY` | service_role key from step 2 |
| `PUBLIC_TURNSTILE_SITE_KEY` | site key from step 3 |
| `TURNSTILE_SECRET_KEY` | secret key from step 3 |
| `PROXY_CHECK_CONTACT` | ur email address |

`PROXY_CHECK_CONTACT` is sent as a contact header to [getipintel.net](https://getipintel.net), a free proxy/vpn detection api. they ask for it so they can reach u if something breaks on their end.

### 5. set up the database

go to ur supabase dashboard and open **sql editor** in the left sidebar (not the table editor). paste this entire block in and click **run**.

this creates all the tables, functions, triggers, and security policies the app needs. it's safe to run more than once since everything uses `if not exists` or `create or replace`.

```sql
create table if not exists site_settings (
  id bigint primary key default 1,
  guestbook_enabled boolean default true,
  guestbook_disabled_reason text,
  guestbook_disabled_at timestamptz
);
insert into site_settings (id, guestbook_enabled) values (1, true) on conflict do nothing;

create table if not exists admin_users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password_hash text not null
);

create table if not exists admin_sessions (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references admin_users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists admin_login_attempts (
  id bigint primary key generated always as identity,
  ip text not null,
  created_at timestamptz default now()
);
create index if not exists admin_login_attempts_ip_created_idx on admin_login_attempts (ip, created_at);

create table if not exists guestbook (
  id bigint primary key generated always as identity,
  created_at timestamptz default now(),
  name text not null,
  website text,
  message text not null,
  likes bigint not null default 0 check (likes >= 0),
  creator_liked boolean not null default false,
  reply text
);
alter table guestbook add column if not exists creator_liked boolean not null default false;
alter table guestbook add column if not exists reply text;
alter table guestbook drop column if exists ip;
alter table guestbook drop column if exists flagged;
alter table guestbook drop column if exists flag_reason;
create index if not exists guestbook_created_at_idx on guestbook (created_at desc);

create table if not exists guestbook_moderation (
  entry_id bigint primary key references guestbook(id) on delete cascade,
  ip text,
  flagged boolean not null default false,
  flag_reason text
);

create table if not exists guestbook_likes (
  id bigint primary key generated always as identity,
  entry_id bigint references guestbook(id) on delete cascade,
  ip text not null,
  vote integer check (vote in (1, -1)),
  updated_at timestamptz default now(),
  unique(entry_id, ip)
);

create table if not exists guestbook_attempts (
  id bigint primary key generated always as identity,
  ip text not null,
  created_at timestamptz default now()
);
create index if not exists guestbook_attempts_created_at_idx on guestbook_attempts (created_at);

create table if not exists counter_hits (
  id bigint primary key generated always as identity,
  ip text not null,
  created_at timestamptz default now()
);
create index if not exists counter_hits_ip_created_idx on counter_hits (ip, created_at);

create table if not exists counter_total (
  id bigint primary key default 1,
  total bigint not null default 0,
  constraint counter_total_singleton check (id = 1)
);
insert into counter_total (id, total) values (1, 0) on conflict do nothing;

create table if not exists blocked_ips (
  id bigint primary key generated always as identity,
  ip text unique not null,
  reason text,
  created_at timestamptz default now()
);

create or replace function apply_guestbook_vote(p_entry_id bigint, p_delta integer)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_likes bigint;
begin
  update guestbook
  set likes = greatest(likes + p_delta, 0)
  where id = p_entry_id
  returning likes into new_likes;
  return new_likes;
end;
$$;

create or replace function insert_guestbook_entry(
  p_name text,
  p_website text,
  p_message text,
  p_ip text,
  p_flagged boolean,
  p_flag_reason text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id bigint;
begin
  insert into guestbook (name, website, message)
  values (p_name, p_website, p_message)
  returning id into new_id;

  insert into guestbook_moderation (entry_id, ip, flagged, flag_reason)
  values (new_id, p_ip, p_flagged, p_flag_reason);

  return new_id;
end;
$$;

create or replace function record_counter_hit(p_ip text, p_cooldown_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent_exists boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip, 0));

  select exists (
    select 1 from counter_hits
    where ip = p_ip and created_at >= now() - make_interval(secs => p_cooldown_seconds)
  ) into recent_exists;

  if recent_exists then
    return false;
  end if;

  insert into counter_hits (ip) values (p_ip);
  return true;
end;
$$;

create or replace function increment_counter_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update counter_total set total = total + 1 where id = 1;
  return new;
end;
$$;

drop trigger if exists counter_hits_increment_total on counter_hits;
create trigger counter_hits_increment_total
  after insert on counter_hits
  for each row execute function increment_counter_total();

create or replace view counter_ip_breakdown as
  select ip, count(*)::bigint as hits, max(created_at) as last_seen
  from counter_hits
  group by ip
  order by last_seen desc;

alter table site_settings enable row level security;
alter table admin_users enable row level security;
alter table admin_sessions enable row level security;
alter table admin_login_attempts enable row level security;
alter table guestbook enable row level security;
alter table guestbook_moderation enable row level security;
alter table guestbook_likes enable row level security;
alter table guestbook_attempts enable row level security;
alter table counter_hits enable row level security;
alter table counter_total enable row level security;
alter table blocked_ips enable row level security;

drop policy if exists "guestbook entries are publicly readable" on guestbook;
create policy "guestbook entries are publicly readable" on guestbook
  for select
  to anon, authenticated
  using (true);

revoke select on guestbook from anon, authenticated;
grant select (id, created_at, name, website, message, likes, creator_liked, reply)
  on guestbook to anon, authenticated;

do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'guestbook'
  ) then
    alter publication supabase_realtime add table guestbook;
  end if;
end $pub$;
```

**what this sets up:**

- **tables** for the guestbook, admin accounts, sessions, rate limiting, visitor counter, and blocked ips
- **row level security (RLS)** on every table. all tables are locked to server-side access only (via the service_role key). the `guestbook` table is the one exception since the browser reads it directly for the live feed
- **guestbook_moderation** is a separate private table that holds ip addresses and moderation flags. it has no public read policy, so visitors can never see each other's ip addresses even if they poke at the api directly
- **counter_total** is a running tally maintained by a trigger on `counter_hits`. this means the visitor counter api endpoint reads a single row instead of counting the entire hits table on every page load
- **realtime** is enabled on `guestbook` so new entries appear live without a page reload. skip the last block and entries only show up after refresh

> if u get `ERROR: 22P02: invalid input syntax for type uuid: "gen_random_uuid()"`, u created the tables through the table editor ui instead of the sql editor. drop them and run this block from the sql editor instead.

#### optional: automatic cleanup

`guestbook_attempts`, `admin_login_attempts`, and `counter_hits` grow over time. adding cleanup jobs keeps the rate-limiting queries fast by pruning old rows on a schedule. the visitor count shown on the site comes from `counter_total` and is not affected by pruning `counter_hits`.

to enable: go to **database** > **extensions** in ur supabase dashboard and turn on **pg_cron**. then run this in the sql editor:

```sql
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cleanup-guestbook-attempts', '17 * * * *', $$
      delete from guestbook_attempts where created_at < now() - interval '1 day'
    $$);
    perform cron.schedule('cleanup-admin-login-attempts', '23 * * * *', $$
      delete from admin_login_attempts where created_at < now() - interval '7 days'
    $$);
    perform cron.schedule('cleanup-counter-hits', '0 3 * * *', $$
      delete from counter_hits where created_at < now() - interval '90 days'
    $$);
  end if;
end $cron$;
```

the block checks for `pg_cron` at runtime and does nothing if it's not enabled, so it's safe to run regardless.

### 6. create an admin account

there's no signup page, so u add urself to the database directly.

**step 1:** run this in ur terminal to generate a hashed password. replace `UR_PASSWORD_HERE` with ur actual password before running:

```bash
node -e "const crypto = require('node:crypto'); const pass = 'UR_PASSWORD_HERE'; const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.scryptSync(pass, salt, 64).toString('hex'); console.log(\`\${salt}:\${hash}\`);"
```

it prints a string like `abc123...:def456...`. copy the whole thing.

**step 2:** go to the sql editor and run this, replacing the placeholders with ur username and the string from step 1:

```sql
insert into admin_users (username, password_hash) values ('UR_USERNAME_HERE', 'SALT_HASH_HERE');
```

log in at `/admin`.

### 7. deploy to vercel

1. push ur code to github
2. go to [vercel.com](https://vercel.com) and click **add new project**, then import ur repo
3. before deploying, go to **environment variables** and add all the vars from step 4
4. click **deploy**

vercel will automatically redeploy whenever u push to the main branch.

## licensing
licensed under [AGPL](LICENSE)
