# Blackfire × Aawazz CRM ⚡

A modern, high-performance, full-stack CRM built for **Blackfire AI** and **Aawazz**. Features a minimalist premium design system, attendance and clock-in tracking tied to CRM sign-ins, a live team presence board, work scheduling calendar, variable-injected employee email automation, resource reference link board, and a multi-project Kanban board.

![Tech Stack](https://img.shields.io/badge/Stack-React%2018%20%7C%20Node.js%20%7C%20Express%20%7C%20MongoDB-black?style=for-the-badge)
![UI Design](https://img.shields.io/badge/Design-Minimalist%20Premium-18181b?style=for-the-badge)

---

## 💻 How to Access & Run Locally

### Direct Access (Currently Running)
If the local server is running on your machine:
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

### Step-by-Step Local Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/Suuwam/CRM-BlackFire.git
cd CRM-BlackFire
```

#### 2. Start the Backend Server
```bash
cd backend
npm install
npm run dev
```
> The backend runs at `http://localhost:5000` connected to MongoDB Atlas.

#### 3. Start the Frontend Application
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
> The frontend runs at `http://localhost:5173`.

---

## 🎨 Key Features & Modules

### 1. 📅 Work Scheduling Calendar
- **Bigger Grid & Exact Day Alignment**: Visual month grid with auto-filled date alignment and day numbers.
- **Color-Coded Event Cards**: Work items styled dynamically by category (`Blue`, `Green`, `Amber`, `Gray`).
- **Interactive Side Panel**: Select any day to view detailed events, scheduled client links, notes, and quick action controls (Add/Edit/Delete).

### 2. ⏱️ Attendance & Time Tracking
- **Clock in on sign-in**: Logging in starts the day; logging out closes it. The pill in the top bar clocks in or out manually and shows live hours.
- **Daily Board**: Present / not present / away summaries plus a per-employee table of clock-in, clock-out, hours, overtime, status and notes, for any date.
- **Team Presence**: Who is online right now, driven by a 60s heartbeat (offline after 3 missed beats).
- **Work History**: Every employee sees their own 30-day history and totals in `Account → Work history`; admins see everyone's in **Admin Overview**.
- **Backlog Trail**: Logins, logouts, exits and clock events all land in the Backlog feed.
- Tunables: `ATTENDANCE_TZ` (backend), `VITE_SHIFT_MINUTES` and `VITE_ON_TIME_BY` (frontend).

### 3. ✉️ Employee Email Automation
- **Template Builder**: Create and edit reusable email templates.
- **Employee Directory**: Pick one or many employees as recipients — the old client roster now lives here.
- **Variable Substitution**: Live preview substituting `{{name}}`, `{{email}}`, `{{username}}` and `{{role}}`.

### 4. 📋 Project Kanban Board
- **Multi-Project Management**: Switch between **Blackfire AI** (Main Project) and **Aawazz** (SaaS Product).
- **5-Stage Pipeline**: Backlog → To Do → In Progress → QA / Review → Done.
- **Interactive Drag & Drop**: Drag task cards seamlessly across columns with real-time API sync.

### 5. 🔗 Reference Link Board
- **Resource Bookmark Manager**: Track design assets, documentation, and external tools.
- **Tag Filtering & Search**: Categorize links with tags and copy URLs in one click.

### 6. 💬 Website Feedback
Reviews left on our websites (LipiSub first) land in the CRM, one dashboard per website.

- **Sidebar → Feedback**: *All websites* plus one entry per connected site.
- **Per-site dashboard**: average rating; **positive (4–5★) / neutral (3★) / negative (1–2★)** counts and split; last-30-days chart; star and category breakdown; **similar feedback** (reviews that say the same thing, grouped by shared words, e.g. "10× export froze"); a filterable list of every review.
- **Alerts**: every new review shows in the Alerts bell, and as a phone notification (Android app, and iPhone home-screen app).
- Everyone signed in can view it; only admins add or remove websites.

**Connecting a website (no code in the CRM):**
1. CRM → **Feedback → All websites** → type the site's name → **Add website**.
2. Click **Setup** and copy the two values into that site's server env:
   ```
   CRM_WEBHOOK_URL=https://crm-blackfire.vercel.app/api/feedback/hook/<site>
   CRM_WEBHOOK_SECRET=<the secret shown>
   ```
3. Restart the site. New reviews arrive within seconds; old ones can be resent from the site's admin (LipiSub: *Admin → Feedback → Send to CRM*).

*New secret* replaces a leaked secret (the site stops sending until its env is updated). *Remove* deletes the site and its reviews.

**Adding a site other than LipiSub:** it must send LipiSub's format. Copy `lipsub-backend/src/services/crmWebhook.js` (about 60 lines, no dependencies), call `postWebhook(feedbackPayload(row), { url, secret })` when a review is saved, then connect it as above. The contract is in `lipsub-backend/DEPLOY.md` → *Feedback → CRM*:
- `POST` JSON `{ event, id, createdAt, feedback: { rating 1–5, category bug|idea|praise|other, message, page }, user: { id, email, name, plan } }`
- Headers: `X-LipiSub-Timestamp` (unix seconds) and `X-LipiSub-Signature: sha256=HMAC-SHA256(secret, "<timestamp>.<raw body>")`. `X-Webhook-Timestamp` / `X-Webhook-Signature` work too.
- The CRM rejects a bad signature (401) or a timestamp more than 5 minutes off, and skips an `id` it already has, so resends are safe.

Check: `cd backend && node test-feedback.js`.

### 7. 🍎 iPhone (Home Screen app)
No App Store needed. On the iPhone (iOS 16.4+):
1. Open **https://crm-blackfire.vercel.app** in **Safari** → **Share** → **Add to Home Screen**.
2. Open **Blackfire** from the home screen and sign in.
3. **Alerts** (bottom of the sidebar) → **Enable notifications** → **Allow**.

New feedback, milestone changes and emails then arrive as notifications even with the app closed (Web Push). Tapping one opens the matching page. The button only appears in the home-screen app; Safari tabs can't receive push on iPhone. Desktop Chrome/Edge/Firefox get the same button.

- You don't get notified of your own changes.
- No setup: the push keys (VAPID) are generated on first use and stored in Mongo (`settings` collection). To pin your own instead, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (from `npx web-push generate-vapid-keys`) and optionally `VAPID_SUBJECT=mailto:you@…`. Changing the keys means everyone taps **Enable notifications** again.

### 8. 📱 Mobile App (Android)
- Download `crm-blackfire.apk` (repo root, or `/crm-blackfire.apk` on the deployed site) and install it.
- **Notifications**: new feedback, milestone changes and emails pop up as phone notifications. Allow notifications when asked on first launch. The app checks every minute while it is open or recently in the background. A fully closed app catches up when reopened (no Firebase push yet).
- Rebuild after frontend changes:
  ```bash
  cd frontend && npm run build && npx cap sync android
  cd android && JAVA_HOME=../../jdk21 ./gradlew assembleDebug
  cp app/build/outputs/apk/debug/app-debug.apk ../../crm-blackfire.apk
  cp app/build/outputs/apk/debug/app-debug.apk ../public/crm-blackfire.apk
  ```

---

## 🛠️ Architecture & Tech Stack

```
CRM-BlackFire/
├── backend/
│   ├── models/        # Mongoose Data Models (User, Attendance, Event, Task, Template, Reference, Feedback, FeedbackSource)
│   ├── routes/        # Express Route Handlers
│   ├── uploads/       # Profile Image Storage
│   └── server.js      # Express Server & MongoDB Connection (Serverless-ready)
├── frontend/
│   ├── src/
│   │   ├── api/       # Centralized Axios/Fetch API Services
│   │   ├── components/# Reusable UI Components (Sidebar, Modal, Toast)
│   │   ├── pages/     # Page Views (Dashboard, Attendance, Team, Calendar, Email, Board, References, Feedback)
│   │   └── index.css  # Premium Minimalist Design System
│   ├── index.html
│   └── vite.config.js
└── vercel.json        # Unified Vercel Monorepo Deployment Config
```

- **Frontend**: React 18, Vite, React Router DOM, Custom CSS System (Inter 800 variable font, dark zinc accents)
- **Backend**: Node.js, Express, Mongoose 8, Multer, CORS
- **Database**: MongoDB Atlas (`crmcluster`)

---

## 🌐 Deploying to Vercel

The project includes a serverless-ready `vercel.json` configuration for unified full-stack Vercel deployment.

1. Push code to your GitHub repo: `https://github.com/Suuwam/CRM-BlackFire`
2. Go to **[Vercel Dashboard](https://vercel.com/new)** → Import `CRM-BlackFire`.
3. Add Environment Variable:
   - `MONGO_URI`: `mongodb+srv://crmadmin:<password>@crmcluster.0yyfhqw.mongodb.net/crm-blackfire?retryWrites=true&w=majority`
4. Click **Deploy**.

---

## 📝 License
Created for **Blackfire AI** & **Aawazz**.
