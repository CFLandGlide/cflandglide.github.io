# CFLandGlide

Private property research map for Charley Ford's Jupiter Farm, FL parcels: Google Maps with county parcel outlines, property and owner panels, notes, statuses, a review queue and a full change history.

- **Setup:** see [docs/SETUP.md](docs/SETUP.md)
- **Stack:** React + TypeScript + Tailwind (Vite), Supabase (Postgres, login, private image storage), Google Maps JavaScript API, Palm Beach County parcel GIS.
- **Publishing:** every push to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`).
- **Database:** `supabase/setup.sql` creates the tables, the access rules (team members only), the locks on original source values, and the audit trail.

This repository contains code only. No property, owner or contact data is ever committed. That data lives in Supabase behind a login.

Local development: copy `.env.example` to `.env.local` with the Supabase URL and public key, then `npm install` and `npm run dev`.
