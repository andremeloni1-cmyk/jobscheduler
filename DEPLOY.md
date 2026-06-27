# Deploying the Job Scheduler to Hostinger

This is a PHP 8 + MySQL app. No build step, no Node — it runs on a standard
Hostinger shared-hosting plan (Premium or Business). Follow these in order.
The whole thing takes about 30–45 minutes the first time.

There are **three things only you can do** (they need your logins): create the
Google credentials, create the MySQL database, and upload the files. Everything
else the app handles itself.

---

## Step 1 — Create the MySQL database (Hostinger hPanel)

1. Log in to Hostinger → **hPanel** → your website → **Databases → MySQL Databases**.
2. Create a new database. Write down the **database name, username, and password**.
3. Open **phpMyAdmin** for that database → **Import** tab → upload `schema.sql`
   (or paste its contents into the **SQL** tab and run). This builds all the
   tables and seeds your 3 clients (Mii Kitchens, Harrington Kitchens, Peter Baldwin).

## Step 2 — Create Google OAuth credentials (Google Cloud Console)

Do this signed in as **andre@andremeloniphotography.co** (the account whose
Calendar, Drive, and Gmail you want the app to use).

1. Go to <https://console.cloud.google.com> → create a project, e.g. "Job Scheduler".
2. **APIs & Services → Library** → enable these three:
   - **Google Calendar API**
   - **Google Drive API**
   - **Gmail API**
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**. App name: "Job Scheduler". Support email: your email.
   - Add yourself as a **Test user** (your email). You can leave it in "Testing" —
     that's fine for a single-user tool and skips Google's review.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorised redirect URI** — this must EXACTLY match your app URL + `/oauth.php`.
     Use whichever matches how you deploy in Step 3:
     - Subdomain (recommended): `https://jobs.andremeloniphotography.co/oauth.php`
     - Subfolder: `https://andremeloniphotography.co/jobscheduler/public/oauth.php`
5. Copy the **Client ID** and **Client secret** — you'll paste them into `config.php`.

## Step 3 — Upload the files

**Recommended (clean URL + most secure): a subdomain pointing at `/public`.**

1. hPanel → **Domains → Subdomains** → create `jobs` (→ `jobs.andremeloniphotography.co`).
2. When creating it, set the **document root** to a folder like
   `public_html/jobscheduler/public`.
3. Upload the project so the structure on the server is:
   ```
   public_html/jobscheduler/
   ├── config/      (not web-accessible — sits above the docroot)
   ├── lib/         (not web-accessible)
   └── public/      ← the subdomain's document root
   ```
   Use **hPanel → File Manager** (drag the folder in) or FTP.

**Simpler fallback (no subdomain):** upload the whole `jobscheduler` folder into
`public_html`. Your app URL becomes
`https://andremeloniphotography.co/jobscheduler/public/`. The included `.htaccess`
files keep `config/` and `lib/` private. Use the matching redirect URI from Step 2.

## Step 4 — Fill in the config

1. In the `config/` folder, copy `config.sample.php` to **`config.php`**
   (File Manager → right-click → Copy/Rename).
2. Edit `config.php` and fill in:
   - `db` → the name/user/pass from Step 1.
   - `google.client_id` / `google.client_secret` → from Step 2.
   - `google.redirect_uri` → the **exact** URL you registered in Step 2.
   - `app.secret` → any long random string (mash the keyboard).
   - `business.timezone` is already `Australia/Sydney`.

## Step 5 — Create your login, then lock it down

1. Visit `…/setup.php` (e.g. `https://jobs.andremeloniphotography.co/setup.php`).
2. Pick a username and password (8+ characters). Submit.
3. **Delete `setup.php` from the server** (File Manager → delete). The app refuses
   to run it again once an account exists, but delete it anyway.

## Step 6 — Connect Google

1. Sign in at the app URL.
2. On the dashboard, click **Connect Google** → approve the Calendar/Drive/Gmail
   access. You'll land back on the dashboard showing **"Google connected"**.

Done. You now have all six features:

| Feature | Where |
|---|---|
| Confirm & book a job (creates calendar event) | Job page → **Confirm & book** |
| Cancel & remove (deletes calendar event) | Job page → **Cancel & remove** |
| Organise job PDFs in Drive | Job page → **Job PDFs** (auto-creates a per-job folder) |
| Maintenance reports (custom per job) | Job page → **New report** |
| View all calendar events | **Calendar** tab |
| Auto-email "I'm available" | Job page → **Email "I'm available"** |

---

## Notes & gotchas

- **Emails come from your real address.** Because the app sends via the Gmail API
  on your connected account, emails genuinely send from
  `andre@andremeloniphotography.co` — no domain-verification workaround needed
  (this was a limitation on the old Base44 dashboard).
- **Keep the OAuth app in "Testing".** As a single user added as a test user,
  you don't need Google's verification. Tokens refresh automatically.
- **HTTPS is required** for the Google login to work. Hostinger gives free SSL —
  enable it for the domain/subdomain in hPanel before Step 6.
- **PHP version:** set PHP to 8.0+ in hPanel → Advanced → PHP Configuration.
  The app uses cURL, which is on by default.
- **Backups:** your data lives in the MySQL database — export it from phpMyAdmin
  any time.
