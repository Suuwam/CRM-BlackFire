# Blackfire CRM Mobile App

A dedicated cross-platform React Native (Expo) mobile application for **CRM Blackfire**, housed in its own isolated `mobile/` directory without altering the core web application codebase.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Configure API Target
Open `src/api.js` and set `API_URL` to point to your backend:
```javascript
export const API_URL = 'http://<YOUR-LOCAL-IP>:5000/api'; // e.g. http://192.168.1.50:5000/api
```

### 3. Run Mobile App
- **Expo Dev Server**: `npm start`
- **Android Simulator / Device**: `npm run android`
- **iOS Simulator / Device**: `npm run ios`
- **Web Mobile Preview**: `npm run web`

---

## 📱 Features

- **Cinematic Dark Theme**: Matches Blackfire AI's black-and-gold visual identity.
- **Project Switcher**: Toggle between **🔥 Blackfire AI** and **🌊 Aawazz** projects on the fly.
- **Dashboard & Workload Overview**: View task metrics, active projects, and system activity logs.
- **Kanban Board**: Mobile-optimized task lists grouped by status (`In Progress`, `To Do`, `Backlog`, `Done`).
- **Clients Directory**: View company contacts, email, and phone details.
- **Activity Log**: Real-time system activity history.
- **Native Bottom Navigation Bar**: Easy single-thumb navigation between Overview, Board, Clients, and Log.
