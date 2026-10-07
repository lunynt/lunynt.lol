import { createInterface } from "node:readline";
import postgres from "postgres";
import { hashPassword } from "../src/lib/password.ts";

function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.resume();
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);

    let value = "";
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") {
          process.stdin.removeListener("data", onData);
          process.stdin.setRawMode(Boolean(wasRaw));
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          process.stdout.write("\n");
          process.exit(1);
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " ") {
          value += char;
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

const args = process.argv.slice(2);
const url = process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;

async function resolveField(
  envName: string,
  argIndex: number,
  question: string,
  hidden = false,
): Promise<string> {
  const fromEnv = process.env[envName];
  if (fromEnv) {
    return fromEnv;
  }
  const fromArg = args[argIndex];
  if (fromArg) {
    return fromArg;
  }
  if (!process.stdin.isTTY) {
    return "";
  }
  return hidden ? promptHidden(question) : promptLine(question);
}

const username = await resolveField("ADMIN_USERNAME", 0, "admin username: ");
const password = await resolveField("ADMIN_PASSWORD", 1, "admin password: ", true);

if (!url) {
  console.error("missing POSTGRES_URL (expected in .env.local)");
  process.exit(1);
}

if (!username || !password) {
  console.error(
    "missing username or password\n" +
      "usage: npm run admin:set -- <username> <password>\n" +
      "   or: ADMIN_USERNAME=you ADMIN_PASSWORD=secret npm run admin:set",
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
