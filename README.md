# Larry (Mechanic App)

## Stack
- Vite + React + TypeScript
- Tailwind + shadcn/ui (Radix)
- Supabase (client SDK + `/supabase` folder)
- Tests: Vitest + Playwright

## Quick start
```bash
cp .env.example .env
npm install
npm run dev
```

- Dev server: http://localhost:8080

Required frontend environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Supabase Edge Functions also require server-side secrets configured in the Supabase project (not in the browser `.env` file), including:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

## Scripts
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run preview` – preview production build
- `npm run lint` – eslint
- `npm test` – vitest (CI mode)

## Security notes (dev server)
This project intentionally binds the Vite dev server to `127.0.0.1` by default.
If you want to expose it on your LAN, run:
```bash
npm run dev -- --host
```
(or set `server.host` explicitly for your environment).
