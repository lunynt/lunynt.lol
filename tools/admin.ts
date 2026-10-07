import postgres from "postgres";
import { hashPassword } from "../src/lib/password.ts";

const url = process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!url || !username || !password) {
  console.error(
    "set POSTGRES_URL, ADMIN_USERNAME and ADMIN_PASSWORD before running",
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

await sql`
  create table if not exists admins (
    id uuid primary key default gen_random_uuid(),
    username text unique not null,
    password_hash text not null,
    created_at timestamptz not null default now()
  )
`;

await sql`
  insert into admins (username, password_hash)
  values (${username}, ${hashPassword(password)})
  on conflict (username) do update set password_hash = excluded.password_hash
`;

console.log(`admin saved: ${username}`);

await sql.end();
