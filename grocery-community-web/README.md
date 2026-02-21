# Grocery Shopping + Community (Netlify + Supabase)

This is a ready-to-deploy React (Vite) web starter that you can map to your Figma screens.

## 1) Create Supabase project
1. Create a project in Supabase.
2. In **SQL Editor**, run: `supabase/schema.sql`
3. (Optional) Seed products:
   - Table Editor → `products` → Insert rows, or run your own SQL.

## 2) Configure Auth
In Supabase:
- Authentication → Providers: enable **Email**
- Authentication → URL Configuration:
  - Site URL: `https://YOUR-NETLIFY-SITE.netlify.app`
  - Redirect URLs: add `https://YOUR-NETLIFY-SITE.netlify.app/**` (and your localhost URL, e.g. `http://localhost:5173/**`)

## 3) Local dev
```bash
npm i
cp .env.example .env
npm run dev
```

Set values in `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 4) Deploy to Netlify
- Push this folder to GitHub
- In Netlify: New site from Git
  - Build command: `npm run build`
  - Publish directory: `dist`
- Add environment variables in Netlify:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

SPA routing is already configured in `netlify.toml`.

## 5) Map to Figma
- Replace `src/pages/*` layouts with your frames
- Turn repeated patterns into components under `src/components`
- Move your tokens into Tailwind (`tailwind.config.js`)

## Project routes
- `/` Home
- `/auth` Sign in/up
- `/shop` Products + your lists (auth)
- `/lists/:id` List detail (auth)
- `/community` Posts (auth)
- `/profile` Profile (auth)
