# CFLandGlide setup guide

About 30 minutes, once. You will set up three free accounts: **Supabase** (the private database and logins), **GitHub** (hosts the website) and **Google Cloud** (the map).

Files you need (sent separately, keep them private):
- `cflandglide-setup.sql` — sets up the database
- `cflandglide-import.json` — the 14 properties, owners, contacts, relatives, associates and images

Never upload those two files to GitHub.

---

## A. Database and logins (Supabase)

1. Go to **supabase.com** and sign up. Click **New project**. Name it **CFLandGlide**, pick the region **East US**, and set a database password (save it somewhere safe).
2. When the project is ready, open **SQL Editor** in the left menu, then **New query**. Paste the whole of `cflandglide-setup.sql` and click **Run**. You should see "Success".
   - Put the email you will log in with on line 21 of the file before running it.
3. Open **Authentication**, go to the sign-in settings and turn **off** "Allow new users to sign up". Only people you add can log in.
4. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a password, tick **Auto Confirm User** and save.
5. Go to **Project Settings → API keys** (or **Data API**). Copy:
   - the **Project URL** (looks like `https://abcd1234.supabase.co`)
   - the **anon / publishable** key
   Send both to Claude. They are safe to share. **Never send the `service_role` / secret key.**

> The free Supabase plan pauses a project after about a week with no use. If that happens, open Supabase and click **Restore**. The paid plan (about $25/month) never pauses.

## B. The website (GitHub)

6. On github.com, click **+ → New organization → Free** and name it **cflandglide**. This gives the site its own address, separate from Lake Burton: **https://cflandglide.github.io**. If that name is taken, pick another; the address follows the name.
7. In the new organization, create a **public** repository named exactly **cflandglide.github.io** (leave it empty). It has to be public for free hosting, but it only ever holds the app's code. The property data stays in Supabase, behind the login.
8. Give the Claude GitHub app access to the new organization (the same app you use for Lake Burton), then tell Claude. Claude publishes the site.
9. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.

## C. The map (Google Cloud)

10. Go to **console.cloud.google.com**, create a project named **CFLandGlide**, and link a billing account. Google requires a card even for free use; this tool's usage should stay inside Google's free monthly allowance.
11. In **APIs & Services → Library**, enable **Maps JavaScript API** and **Geocoding API**.
12. In **Google Maps Platform → Keys & Credentials**, create an API key and edit it:
    - **Application restrictions:** Websites, add `https://cflandglide.github.io/*`
    - **API restrictions:** restrict the key to Maps JavaScript API and Geocoding API
    - Save
13. In **Google Maps Platform → Map management**, click **Create Map ID**. Name it CFLandGlide, choose type **JavaScript**, and save. Copy the Map ID.
14. Open CFLandGlide, go to **Settings → Google Maps**, paste the key and the Map ID, then click **Save and reload**.
    The key is stored in your private database, not in the website's code.

## D. First run

15. Open **https://cflandglide.github.io** and log in. Choose `cflandglide-import.json` and click **Import**. Every check must pass before anything is saved. The app then looks up each parcel with Palm Beach County and draws its outline.
16. Go to **Data check → Check addresses** to confirm the 5 exact street addresses with Google. Only addresses that land on their own county parcel become "Exact location confirmed".
17. To add Charley: create his login in Supabase (step 4), then add his email and name in CFLandGlide under **Settings → Team**.

---

### What the app will and won't do

- An address is never guessed. Parcels without a street number are placed by **parcel ID** (dashed outline) and stay "Address Not Confirmed".
- Street View appears only when Google has imagery within 40 m of the parcel outline. Otherwise it says "Street View unavailable".
- Original values from the document are never overwritten. Edits show "Edited" next to the original source value, and every change is in **History**.
- Phone numbers, relatives and associates stay hidden until you click **Show contact details**.
- Search engines are told not to index the site, and nothing loads without a team login.
