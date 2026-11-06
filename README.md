# Barkat Chai POS

A phone-first point of sale for a small chai shop. React + Vite PWA on Supabase.

**Features:** quick sell screen (Cash / Online / Udhaar), per-item discounts and free items, chai and black tea
containers, udhaar (credit and cash lent) ledger by person, stats with date filters, offline sales queue,
void and restore bills, full CSV backup.

## 1. Supabase setup

1. Create a project at supabase.com.
2. **SQL editor:** run [`supabase/schema.sql`](supabase/schema.sql) (new project).
   Existing project that already has the v1 tables: run `migration_002.sql`, then `migration_003.sql`.
3. **Authentication → Providers → Email:** turn **off** "Allow new users to sign up".
   Without this, anyone who finds the URL could create an account and read your sales.
4. **Authentication → Users → Add user:** create the one shop login (email + password, auto confirm).
5. **Project Settings → API Keys:** copy the project URL and the `anon` / publishable key.
   Never use the `service_role` / secret key in this app.

## 2. Run locally

```bash
cp .env.example .env     # fill in the two values
npm install
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## 3. Deploy on Vercel

1. Push the repo to GitHub and import it in Vercel (framework: Vite, defaults are fine).
2. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy.
3. Open the Vercel URL on the shop phone, sign in, and use **Add to Home Screen**.

[`vercel.json`](vercel.json) sets security headers (CSP, no framing, HSTS) and caching. The service worker caches
only the app shell. Sales data always goes over the network.

Updates: when a new version is deployed, a "New version available" bar appears. Tap **Reload** when the counter is quiet.

## 4. Daily use notes

- **Header dot:** green = everything saved, orange = sales waiting for internet (safe on the phone, uploads
  automatically), red = a sale the server rejected (tap it to Retry or Discard).
- **Delete = void.** Voided bills leave the totals but stay in the database. Restore them from Bills → "Show voided".
- Udhaar names are matched ignoring capitals, so "imran" and "Imran" are one person.

## 5. Backups

- Bills tab → **Download full backup (CSV)** gives two files: every bill line and every udhaar entry, including voided ones.
- Do this about once a month.
- Free Supabase projects **pause after 7 days with no activity**. Opening the app once a week is enough to keep it awake. A paused project restores from the Supabase dashboard.

## 6. Editing the menu

Prices and items live in the `items` table (Supabase → Table editor). `cups` is how many cups one unit draws from a
container (Full Chai = 2). `batch_type` is `chai`, `black_tea` or `none`. Changes show up on the phone the next time the app opens.

## 7. Icons

Edit `public/icon.svg`, then run `npm run icons` to regenerate the PNGs.
