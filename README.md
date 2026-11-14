# 360 Health

Personal fitness tracker (PWA). The full spec is in [CLAUDE.md](CLAUDE.md).

## First-time setup

1. Copy `.env.example` to `.env.local` and fill in the two Supabase values.
2. In the Supabase SQL Editor, run `supabase/migrations/0001_init.sql` once.
3. In Supabase: Authentication -> Users -> Add user (your login), then turn off
   "Allow new users to sign up" under Authentication -> Sign In / Providers.

## Commands

- `npm run dev`: run the app at http://localhost:3000
- `npm test`: run the unit tests
- `npm run build`: production build
- `npm run lint`: code checks
