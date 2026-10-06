# RainChat • Real-time Messaging Platform

A full-stack, high-performance messaging website built on the **MERN** stack (**M**ongoDB, **E**xpress.js, **R**eact.js, **N**ode.js) with real-time **Socket.IO** synchronization.

---

## 🌟 Features

- **Authentication System**:
  - **Signup Page**: Registration with name, username, email, password hashing (bcrypt), and customizable avatars (DiceBear & curated presets).
  - **Login Page**: Secure JWT authentication with identifier (email or username), password visibility toggle, error handling, and one-click demo logins.
  - **Session Management**: Persistent JWT auth with automatic token verification.

- **Conversation Dashboard**:
  - **Registered Users Directory**: Dynamic conversation list of all registered platform members.
  - **Conversation Snippets**: Displays the last sent/received message and timestamp for each user.
  - **Unread Message Badges**: Real-time counter of unread incoming messages.
  - **Live Online Presence**: Green glowing status indicator driven by active WebSocket connections.
  - **Search & Filtering**: Instant search across registered users by full name or username.

- **Real-Time Direct Messaging**:
  - Instant message delivery with **Socket.IO**.
  - **IME-Safe Enter-to-Submit**: Built according to Modern Web Guidance to prevent incomplete composition when using IME keys.
  - **Typing Indicators**: Live "*Alex is typing...*" indicator.
  - **Read Receipts**: Real-time double checkmarks (delivered vs. read in cyan).
  - **Quick Emoji Reactions**: Instant emoji picker bar.
  - **Offline Email Notifications**: Emails recipients when a new message arrives while they are offline (SMTP configuration required).
  - **User Blocking**: Block or unblock users from a conversation; blocks are enforced for messages in both directions.
  - **Gemini Assistant**: Authenticated AI chat powered by the Gemini API.

- **Design & Aesthetics**:
  - Deep obsidian dark mode with glowing violet/indigo/cyan accents.
  - Glassmorphic card styling with backdrop blur.
  - Responsive design (desktop split view + collapsible mobile drawer).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** running on `mongodb://127.0.0.1:27017` (or provide `MONGO_URI` or `MONGODB_URI` in `server/.env`)

### 2. Start Both Server & Client Concurrently
From the project root directory, run:
```bash
npm run dev
```
- **Backend API & WebSockets**: `http://localhost:5000`
- **Frontend Web Application**: `http://localhost:5173`

### 3. Configure Offline Email Notifications
Set these variables in `server/.env` to enable SMTP delivery. Without them, chat messages still send normally and email notifications are skipped.
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=PulseChat <notifications@example.com>
```

### 4. Configure Gemini Assistant
Set a valid Google AI Studio API key in `server/.env`. The key stays on the backend and is never sent to the browser.
```env
GEMINI_API_KEY=your-google-ai-studio-api-key
GEMINI_MODEL=gemini-3.8-flash
```
Restart the backend after changing environment variables.

### 5. Deploy on Vercel
Deploy the frontend and backend as separate Vercel projects from this repository. The backend is an Express app with a separate Socket.IO function. Vercel WebSocket support is currently in beta and requires Fluid Compute.

1. Create the frontend Vercel project with **Root Directory** set to `client`. Use the Vite preset, build command `npm run build`, and output directory `dist`.
2. Create a second Vercel project for this repository with **Root Directory** set to `server`. Vercel detects the Express app from `src/index.js`; do not add a catch-all route to a root `index.js`.
3. Set backend environment variables `MONGO_URI` (or `MONGODB_URI`), `JWT_SECRET`, and `CLIENT_ORIGIN` (the exact frontend origin, such as `https://your-rainchat.vercel.app`). The MongoDB URI must point to a reachable database; production does not fall back to localhost. Add optional `GEMINI_API_KEY` and SMTP settings as needed. Enable **Fluid Compute** in the backend project's Function settings if it is not already enabled.
4. Set the frontend project's `VITE_API_URL` to the backend's public origin, without an `/api` suffix, then redeploy the frontend.
5. Check `https://your-api.vercel.app/` and `https://your-api.vercel.app/api/health`; both should return JSON. Test login and real-time messaging from the frontend.

Vercel WebSocket connections close when their function reaches its duration limit, so clients must reconnect. This app keeps online-user routing in process memory; for reliable real-time delivery across multiple function instances, configure a shared Socket.IO adapter such as Redis. Uploaded files also need persistent object storage because Vercel function filesystems are temporary. The Vercel build uses `/` as its asset base; other builds keep the `/Rainchat/` base used by GitHub Pages. For local development, leave `VITE_API_URL` unset to use the Vite proxies.

### Build the Android app with Capacitor

Set `VITE_API_URL` in `client/.env.production` to the deployed backend origin (without `/api`). Ensure the backend's `CLIENT_ORIGIN` allows `https://localhost`, then from `client` run:

```bash
npm run build:capacitor
npx cap sync android
npx cap open android
```

The Capacitor build uses relative asset URLs so the app can load its bundled files from Android WebView. Rebuild and sync after frontend or API URL changes.

---

## 👤 One-Click Demo Credentials

To test two-way real-time messaging between two browser tabs:

| Name | Email | Password |
| :--- | :--- | :--- |
| **Alex Morgan** | `alex@example.com` | `password123` |
| **Sarah Chen** | `sarah@example.com` | `password123` |
| **David Miller** | `david@example.com` | `password123` |

*(You can also sign up a new account anytime on the Signup page!)*

---

## 📂 Project Architecture

```
├── package.json               # Root orchestrator scripts
├── start-dev.js               # Concurrent runner for server and client
├── server/                    # Node.js + Express + Socket.IO Backend
│   ├── .env                   # Server environment variables
│   ├── src/
│   │   ├── config/db.js       # Mongoose connection logic
│   │   ├── controllers/       # Auth, user, and message controllers
│   │   ├── middleware/        # JWT auth protection middleware
│   │   ├── models/            # User, Message, and Conversation schemas
│   │   ├── routes/            # REST API endpoints
│   │   ├── socket/socket.js   # Socket.IO connection & event handlers
│   │   ├── seed.js            # Database populator script
│   │   └── index.js           # Server entrypoint
├── client/                    # React 19 + Vite Frontend
│   ├── index.html             # Google fonts & SEO meta tags
│   ├── vite.config.js         # API & WebSocket reverse proxies
│   └── src/
│       ├── context/           # AuthContext, SocketContext, ChatContext
│       ├── components/        # Sidebar, ConversationList, ChatWindow, etc.
│       ├── pages/             # LoginPage, SignupPage, DashboardPage
│       └── services/api.js    # API service layer
```
