# VAULTS

A turn-based heist game. Crack vaults, then build your own and dare the internet to break in.

- **Twelve campaign heists** teach every trick: patrols, takedowns, cameras, lasers, keycards, EMPs, armored guards, turn limits.
- **A vault builder** with walls, doors, guards (waypoint patrols), cameras (sweep sequences), lasers (on/off patterns), a timeline to preview every patrol, undo/redo and autosaved drafts.
- **The Machine**: an A* search over every possible heist. It runs in a Web Worker while you build, finds the shortest crack, and rates the vault from 1 to 5 locks.
- **Proof of crack**: you can only publish a vault you've beaten yourself, so every vault is fair.
- **Public vaults** (optional, needs a database): a page per vault, verified attempts, first blood, per-vault leaderboards, a capture heatmap, replays of the best cracks, trending, unbroken and hardest lists, thief and builder leaderboards, profiles, and social-card images.
- **Share links** work without any backend: the whole vault is compressed into the URL.

The engine is deterministic. The server replays every submitted move string through the same code the browser runs, so a client can't fake a crack, a turn count or a capture.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Without any environment variables, everything except public vaults works: the campaign, the builder, the Machine and share links.

## Deploy

### Vercel

1. Import the GitHub repo in Vercel. The framework is detected as Next.js, and `vercel.json` sets the build command.
2. Add environment variables (optional, see below) and deploy.

### Netlify

1. Import the repo. `netlify.toml` sets the build command, and Netlify's Next.js runtime handles the rest.
2. Add environment variables (optional) and deploy.

### Environment variables

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | public vaults, leaderboards | Any Postgres, e.g. [Neon](https://neon.tech) (free tier). Use the **direct** (non-pooled) connection string. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | accounts | From [Clerk](https://clerk.com). Players need an account to publish vaults and to appear on leaderboards. |
| `CLERK_SECRET_KEY` | accounts | Clerk secret key. |
| `NEXT_PUBLIC_SITE_URL` | social cards | Optional. Your public URL, e.g. `https://vaults.example.com`. On Vercel and Netlify it is detected automatically. |
| `SKIP_MIGRATIONS` | | Set to `1` to skip migrations during the build (e.g. previews sharing one database). |

When `DATABASE_URL` is set, `npm run build` runs `prisma generate`, applies migrations (`prisma migrate deploy`), then runs `next build`. Anonymous players can still play public vaults; their runs count toward a vault's stats, but not toward leaderboards.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / server |
| `npm test` | engine, solver and campaign tests (Vitest) |
| `npm run test:e2e` | browser tests (Playwright) against a production build: `npm run build && npm run test:e2e` |
| `npm run smoke` | API check against a dev server started with `VAULTS_DEV_AUTH=1` and a database |
| `npm run typecheck` / `npm run lint` | static checks |

## How it's built

- Next.js (App Router), React, Tailwind CSS, motion, zustand, zod
- Prisma + Postgres for public vaults, Clerk for accounts (both optional)
- The board is one SVG drawn in tile units. Actors move with CSS transforms, and rotations are unwrapped so a guard turning from west to north never spins the long way round.

```
src/engine/       rules (game.ts), sight and geometry, validation, the Machine (solver.ts)
src/content/      the twelve campaign heists, each verified solvable by the Machine in tests
src/editor/       builder document model, undo/redo, drafts
src/workers/      the Machine's Web Worker
src/server/       database access, auth, verified publishing and attempts, social cards
src/app/          pages and API routes
prisma/           schema and migrations
tests/e2e/        Playwright tests
```

## Rules in one paragraph

Each turn: you act (move, wait or EMP), take down any guard you stepped on, pick up loot and keycards, escape if you're on the entrance with all the loot, then the building ticks (guards step, cameras turn, lasers switch). You're caught if anyone can see you, a laser is live on your tile, or someone can see a body. Vision cones widen by one tile on each side every two tiles and are blocked by walls, doors and diagonal wall corners. The full rules are on `/how`.
