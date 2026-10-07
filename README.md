# FamBit

FamBit is a family habit dashboard: one shared home for daily routines, points, rewards, gifting, progress, and family rituals.

## What the app does

- Creates private family spaces with parent-admin controls
- Gives each member a habit panel, reward balance, and visual progression
- Supports rewards, gifting, shared purchases, weekly recaps, and stats
- Handles offline task completion and sync recovery
- Uses Momentum, Harmony, and shield loadouts for transparent bonus progression

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Production is hosted at `https://fambit.vercel.app`; the public landing page is
`/home` (English) or `/home/ko` (Korean). Signed-out visits to `/` open `/home`.

When changing the production domain, update Supabase Authentication → URL
Configuration: set Site URL to the new origin and allow its `/auth/callback`
URL, including `/auth/callback?next=**` for returning to a specific app page.
Set `NEXT_PUBLIC_SITE_URL` on Vercel to the same origin before redeploying. Keep
OAuth initiation and its callback on the same origin so the PKCE cookie is
available. Supabase's Google provider callback remains the Supabase project
URL, independent of the app's domain. Installed apps and cookies belong to
their original domain; open the new address and sign in again after migration.

## Verification

```bash
npm run lint
npm run test
npm run build
```

For database security changes, also run the remote RLS regression suite:

```bash
npm run test:rls
```

Current coverage includes Shield Wall multi-family isolation. The test runs in
a transaction and rolls back its temporary rows.

## Product notes

- Admin mode is parent-protected by PIN.
- Family members can join with invite codes.
- The dashboard is designed for tablet, phone, and shared family-screen use.
