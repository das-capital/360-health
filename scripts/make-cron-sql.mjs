// Writes the private SQL that creates the 5-minute reminder job on Supabase.
// Usage:  node scripts/make-cron-sql.mjs https://your-app.vercel.app
//
// The output contains the job's shared secret, so it goes to supabase/local/,
// which git ignores. Paste it into the Supabase SQL Editor once.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const appUrl = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(appUrl)) {
  console.error("Give the app's address, e.g.  node scripts/make-cron-sql.mjs https://your-app.vercel.app");
  process.exit(1);
}

const env = readFileSync(".env.local", "utf8");
const secret = env.match(/^CRON_SECRET\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim();
if (!secret) {
  console.error("CRON_SECRET is missing from .env.local");
  process.exit(1);
}

const sql = `-- PRIVATE: contains the reminder job's secret. Do not share or commit.
-- Run once in the Supabase SQL Editor. Safe to run again (it replaces the job).

select cron.unschedule(jobid) from cron.job where jobname = 'send-reminders';

select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url     := '${appUrl}/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ${secret}'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);
`;

mkdirSync("supabase/local", { recursive: true });
writeFileSync("supabase/local/reminder_job.sql", sql);
console.log("Written: supabase/local/reminder_job.sql (private, not in git)");
