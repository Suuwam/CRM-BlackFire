# Blackfire × Aawazz CRM ⚡

A modern, high-performance, full-stack CRM built for **Blackfire AI** and **Aawazz**. Features a minimalist premium design system, complete client management, work scheduling calendar, variable-injected email automation, resource reference link board, and a multi-project Kanban board.

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

### 2. 👤 Client Relationship Management
- **Complete CRM Roster**: Filter by client status (`Active`, `Prospect`, `Inactive`) or search by name/company.
- **Photo Upload Support**: Hover over any client avatar to upload custom profile photos via Multer API.
- **Detailed Modal**: In-depth client detail view with email, phone, current project, and notes.

### 3. ✉️ Email Automation & Variable Substitution
- **Template Builder**: Create and edit reusable email templates.
- **Client Variable Substitution**: Live preview substituting `{{name}}`, `{{company}}`, `{{email}}`, `{{phone}}`, and `{{project}}`.
- **Quick Mailto Link**: One-click button to launch pre-filled client emails directly in your default mail app.

### 4. 📋 Project Kanban Board
- **Multi-Project Management**: Switch between **Blackfire AI** (Main Project) and **Aawazz** (SaaS Product).
- **5-Stage Pipeline**: Backlog → To Do → In Progress → QA / Review → Done.
- **Interactive Drag & Drop**: Drag task cards seamlessly across columns with real-time API sync.

### 5. 🔗 Reference Link Board
- **Resource Bookmark Manager**: Track design assets, documentation, and external tools.
- **Tag Filtering & Search**: Categorize links with tags and copy URLs in one click.

---

## 🛠️ Architecture & Tech Stack

```
CRM-BlackFire/
├── backend/
│   ├── models/        # Mongoose Data Models (Client, Event, Task, Template, Reference)
│   ├── routes/        # Express Route Handlers
│   ├── uploads/       # Profile Image Storage
│   └── server.js      # Express Server & MongoDB Connection (Serverless-ready)
├── frontend/
│   ├── src/
│   │   ├── api/       # Centralized Axios/Fetch API Services
│   │   ├── components/# Reusable UI Components (Sidebar, Modal, Toast)
│   │   ├── pages/     # Page Views (Dashboard, Calendar, Clients, Email, Board, References)
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
