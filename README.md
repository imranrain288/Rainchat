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
- **MongoDB** running on `mongodb://127.0.0.1:27017` (or provide `MONGO_URI` in `server/.env`)

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

### 5. Deploy on Netlify
Netlify serves the frontend; the Express API and Socket.IO server must run on a separate Node.js host that supports persistent WebSocket connections. The backend also needs a reachable MongoDB database.

1. Push this repository to GitHub, then import it in Netlify. Netlify reads `netlify.toml` for the client build and SPA routing.
2. Deploy the backend to a Node.js host. Configure its environment variables, including `MONGO_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` set to your exact Netlify site origin (for example, `https://your-site.netlify.app`). Add any optional `GEMINI_API_KEY` and SMTP settings you use.
3. In Netlify, set the environment variable `VITE_API_URL` to the backend's public origin (for example, `https://your-api.example.com`, without an `/api` suffix), then trigger a new deploy. This URL is used by both REST API requests and Socket.IO.
4. Confirm the backend is reachable at `https://your-api.example.com/api/health` and that its CORS allowlist includes the Netlify site origin.

The app requires a backend host that supports Socket.IO; Netlify Functions are not a replacement for this persistent server. For local development, leave `VITE_API_URL` unset to use the Vite `/api` and Socket.IO development proxies.

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
