# Blackfire CRM ⚡

The internal CRM for **Blackfire AI**: attendance and live team presence, milestones, a multi-project Kanban board, calendar, employee email automation, a links board, and feedback dashboards for every website we run. It's available on the web, on Android, and on iPhone.

**Open it:** **[crm-blackfire.vercel.app](https://crm-blackfire.vercel.app)**

![Stack](https://img.shields.io/badge/Stack-React%2018%20%7C%20Node.js%20%7C%20Express%20%7C%20MongoDB-black?style=for-the-badge)
![Platforms](https://img.shields.io/badge/Platforms-Web%20%7C%20Android%20%7C%20iPhone-18181b?style=for-the-badge)

---

## 📲 Get the app

### Android

<a href="https://crm-blackfire.vercel.app/crm-blackfire.apk">
  <img src="https://img.shields.io/badge/Download-Android%20APK-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Download for Android" height="48">
</a>

1. Tap the button above on your phone. It downloads `crm-blackfire.apk`.
2. Open the file. If Android asks, allow **Install unknown apps** for your browser or Files app.
3. Open **Blackfire CRM**. On the first launch it asks once to send notifications. Tap **Allow**. Android remembers the answer, and you can change it later with the **Notifications** switch under **Alerts**.

### iPhone / iPad

You don't need the App Store. You install it from Safari in about 30 seconds (requires iOS 16.4 or later):

1. Open **[crm-blackfire.vercel.app](https://crm-blackfire.vercel.app)** in **Safari**. It has to be Safari, not Chrome.
2. Tap the **Share** button (the square with an arrow ↑ at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.
4. Open **Blackfire** from your home screen and sign in.
5. To get notifications, tap **Alerts** at the bottom of the menu, turn on the **Notifications** switch, then tap **Allow**.

> The **Notifications** switch only works in the home-screen app. iPhones don't allow notifications from a regular Safari tab.

### What you get notified about
New website feedback, milestone changes, and emails, on both Android and iPhone. Tapping a notification opens the matching page. You won't be notified about changes you made yourself.

---

## 🎨 Features

| Area | What it does |
|---|---|
| **Dashboard** | Workload, throughput, priority mix, hours today and the week ahead. |
| **Milestones** | Numbered company milestones. Everyone can mark them done, and every change notifies the team. |
| **Attendance** | Signing in clocks you in and signing out clocks you out (or use the top-bar pill). Daily board with hours, overtime and notes. |
| **Team** | Who's online, away, clocked out or offline (60 s heartbeat), with each person's hours today against the shift. |
| **Assigned · Backlog · Overdue** | Your tasks, the full activity trail, and anything past due. |
| **Calendar** | Month grid with color-coded posts and events and a side panel to add, edit or delete them. **Colour** sets your own calendar accent (saved in your browser). |
| **Email** | Reusable templates sent to one or many employees, with `{{name}}`, `{{email}}`, `{{username}}` and `{{role}}` filled in. |
| **Links** | A bookmark board for design assets, docs and tools, with tags and search. |
| **Board** | Kanban per project, each board in its own colour (any colour: 16 presets plus a full picker), with open / done / overdue counts and progress: Backlog → To Do → In Progress → QA → Done, with drag and drop. |
| **Feedback** | Reviews from our websites, with a dashboard for each site. See below. |
| **Admin** | Admin Overview (everyone's work history, plus **CRM storage**: used vs. left, and a button to download a ZIP of data older than 6 months and then delete it) and Accounts (approve sign-up requests; set role, active and milestone access). |

### 💬 Website Feedback

Every review left on one of our websites (LipiSub first) arrives in the CRM within seconds.

- **Sidebar → Feedback** (at the bottom) lists every website. Admins add new ones there. **All websites dashboard** combines every site's reviews in one dashboard, with a per-website breakdown.
- **Each site's dashboard** shows:
  - the average rating
  - **positive (4–5★), neutral (3★) and negative (1–2★)** counts and their split
  - a chart of the last 30 days
  - the breakdown by star rating and by category
  - **similar feedback**: reviews that say the same thing, grouped together (e.g. *"10× export froze"*)
  - a filterable list of every review
- Each website has its own **colour**: it marks the website's card and dashboard. Pick it when adding the site, or change it later under **Settings**.
- Everyone signed in can view feedback. Only admins can add or remove websites.

#### Connecting a website (no code changes in the CRM)
1. Go to **Feedback**, type the site's name, and click **+ Add website**.
2. The site's card opens **How to connect**. Copy the two lines into that site's backend `.env` (LipiSub: cPanel → File Manager → `api.lipisub.com/.env`):
   ```
   CRM_WEBHOOK_URL=https://crm-blackfire.vercel.app/api/feedback/hook/<site>
   CRM_WEBHOOK_SECRET=<the secret shown>
   ```
3. Restart the site's backend (LipiSub: cPanel → Setup Node.js App → Restart). In LipiSub, *Admin → Feedback* should now say "New reviews are sent to the CRM automatically". Press **Send to CRM** on older reviews to bring them in. The card turns **● Connected** when the first review arrives.

**New secret** replaces a leaked secret. The site stops sending until you update its env. **Remove** deletes the site and all its reviews.

#### Adding a site other than LipiSub
The site has to send LipiSub's format. The easiest way is to copy `lipsub-backend/src/services/crmWebhook.js` (about 60 lines, no dependencies). Call `postWebhook(feedbackPayload(row), { url, secret })` whenever a review is saved, then connect the site as described above. The full contract is in `lipsub-backend/DEPLOY.md` under *Feedback → CRM*:

- **Body:** `POST` JSON `{ event, id, createdAt, feedback: { rating 1–5, category bug|idea|praise|other, message, page }, user: { id, email, name, plan } }`
- **Headers:** `X-LipiSub-Timestamp` (unix seconds) and `X-LipiSub-Signature: sha256=HMAC-SHA256(secret, "<timestamp>.<raw body>")`. `X-Webhook-Timestamp` / `X-Webhook-Signature` also work.
- **What the CRM rejects:** a bad signature (401) or a timestamp more than 5 minutes off. If it already has a review's `id`, it skips it, so resending is safe.

---

### 🗄️ Storage and archiving (Admin Overview)
- **CRM storage** shows the database's size (data + indexes) against your plan (`STORAGE_LIMIT_MB`, default 512 MB). The meter turns amber at 70% and red at 90%. Photos and card images live on Cloudinary and aren't counted.
- **Download ZIP & delete** gets rid of history older than 6 months, in two confirmed steps:
  1. It downloads `blackfire-crm-before-<date>.zip`: a README plus one JSON file per collection.
  2. Only after the ZIP has been saved, it asks again and deletes exactly those records.
- **What counts as old:**
  - activity log, attendance and past calendar events
  - feedback reviews
  - tasks that are done or cancelled, and milestones that are done
  - reviewed sign-up requests (password hashes are left out of the ZIP)
- **Never touched:** accounts, boards, open tasks, templates, links and website settings.
- **Safety:** the server refuses any cutoff newer than 180 days, and every delete is recorded in the activity feed.

## 💻 Run locally

```bash
git clone https://github.com/Suuwam/CRM-BlackFire.git
cd CRM-BlackFire

# Backend → http://localhost:5000
cd backend && cp .env.example .env   # set MONGO_URI
npm install && npm run dev

# Frontend → http://localhost:5173 (new terminal; proxies /api to :5000)
cd frontend && npm install && npm run dev
```

Checks:
```bash
node backend/test-feedback.js   # webhook signatures + similar-feedback grouping
node backend/test-zip.js        # the archive ZIP opens in a real unzip, byte for byte
node frontend/sw.test.mjs       # service worker never serves a stale app shell
```

### Environment variables (backend / Vercel)

| Variable | Needed | What for |
|---|---|---|
| `MONGO_URI` | **yes** | MongoDB Atlas connection string |
| `BOOTSTRAP_ADMIN_PASSWORD` | | Password for the `admin` account created on a brand-new database that has no admin yet (default `blackfire`). Change it after the first sign-in. It's never reapplied after that. |
| `ALLOWED_ORIGINS` | prod | Comma-separated CORS allow-list |
| `ATTENDANCE_TZ` | | Day boundary for attendance (default `Asia/Kathmandu`) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `MAIL_FROM` | for email | Outgoing mail |
| `CLOUDINARY_CLOUD_NAME` `CLOUDINARY_API_KEY` `CLOUDINARY_API_SECRET` | for uploads | Profile photos and card images |
| `STORAGE_LIMIT_MB` | | Size of your MongoDB plan, for the Admin Overview storage meter (default `512`, the Atlas free tier) |
| `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` | no | Push keys. If unset, they're generated on first use and stored in Mongo (`settings`). If you change them, everyone has to turn the *Notifications* switch on again. |

Frontend: `VITE_API_URL` (default `/api`), `VITE_SHIFT_MINUTES`, `VITE_ON_TIME_BY`.

---

## 📱 Building the mobile apps

**Android** (Capacitor). Run this after any frontend change, then commit both APKs. Use `build:android`, not plain `build`: the download copy in `public/` would otherwise be packed inside the new APK, which then grows every rebuild.
```bash
cd frontend && npm run build:android   # web build without the APK itself, then cap sync
cd android && JAVA_HOME=../../jdk21 ./gradlew clean assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../../crm-blackfire.apk
cp app/build/outputs/apk/debug/app-debug.apk ../public/crm-blackfire.apk   # what the download button serves
```
The app turns new alerts into phone notifications using `@capacitor/local-notifications`. It checks every minute while it's open or was used recently.

**iPhone** doesn't need a build. It's the website installed to the home screen (`frontend/public/manifest.json` + `sw.js`), and notifications come through Web Push (`backend/utils/push.js`). Every deploy updates it automatically. A native Xcode project (`frontend/ios`) also exists, but building it requires a Mac.

---

## 🛠️ Architecture

```
CRM-BlackFire/
├── api/index.js         # Vercel serverless entry → backend/server.js
├── backend/
│   ├── models/          # User, Attendance, Event, Task, Board, Milestone, Template, Reference,
│   │                    # Activity, AccountApplication, Feedback, FeedbackSource
│   ├── routes/          # Express routes (/api/*), incl. feedback.js (webhook + dashboards), push.js
│   ├── utils/           # session, rate limit, mailer, activity log, feedback, push
│   └── server.js
├── frontend/
│   ├── src/             # React 18 + Vite: pages/, components/, api/, index.css
│   ├── public/          # manifest.json, sw.js (offline shell + push), crm-blackfire.apk
│   ├── android/         # Capacitor Android project
│   └── ios/             # Capacitor iOS project
├── crm-blackfire.apk    # latest Android build
└── vercel.json          # one Vercel project: SPA + /api
```

- **Frontend:** React 18, Vite, React Router, SWR, custom CSS design system, Capacitor 8
- **Backend:** Node.js, Express, Mongoose 8, web-push, Nodemailer, Cloudinary
- **Database:** MongoDB Atlas

## 🌐 Deploying

Pushing to `main` deploys to Vercel. To set it up from scratch: import the repo at [vercel.com/new](https://vercel.com/new), add `MONGO_URI` (plus any of the optional variables above), and deploy. `vercel.json` handles the build and routing.

The code lives in two repositories that are kept identical:
[Suuwam/CRM-BlackFire](https://github.com/Suuwam/CRM-BlackFire) and [BlackfireAI/real-crm-blackfire](https://github.com/BlackfireAI/real-crm-blackfire).

---

## 📝 License
Created for **Blackfire AI**.
