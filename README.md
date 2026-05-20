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
