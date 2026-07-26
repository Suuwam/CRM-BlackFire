# CRM — Blackfire × Aawazz

## Quick Start

### 1. MongoDB Atlas Setup
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → create a free cluster
2. Create a database user (username + password)
3. Whitelist your IP (or use `0.0.0.0/0` for dev)
4. Copy the connection string

### 2. Configure Backend
Edit `backend/.env`:
```
MONGO_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxx.mongodb.net/crm-blackfire?retryWrites=true&w=majority
PORT=5000
```

### 3. Run Backend
```bash
cd backend
npm run dev
```
Backend runs at → http://localhost:5000

### 4. Run Frontend
```bash
cd frontend
npm run dev
```
Frontend runs at → http://localhost:5173

---

## Features
- **Dashboard** — Stats + upcoming events
- **Clients** — CRUD with optional photo upload (hover avatar → click `+`)
- **Calendar** — Monthly grid, click day → event cards panel
- **Email** — Templates with `{{name}}` `{{company}}` variable substitution + mailto
- **References** — Link board with tags and search
- **Board** — Trello-style Kanban with drag-and-drop
  - 🖤 **Blackfire AI** (main project)
  - 🎵 **Aawazz** (SaaS product)
  - Columns: Backlog → To Do → In Progress → QA/Review → Done

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/clients | List / Create |
| PUT/DELETE | /api/clients/:id | Update / Delete |
| PATCH | /api/clients/:id/photo | Upload photo |
| GET/POST | /api/events | Calendar events |
| GET/POST | /api/templates | Email templates |
| GET/POST | /api/references | Reference links |
| GET/POST | /api/tasks | Kanban tasks |
| PATCH | /api/tasks/:id/move | Move to column |
