# 🎬 Netflix Watch Party & Spatial Voice Room

A production-grade Manifest V3 Chrome Extension and Real-Time WebSocket Backend for synchronized Netflix watch parties with Spatial WebRTC voice chat, animated reactions, and zero-drift playback control.

---

## 🌟 Key Features

- **⚡ Zero-Drift Video Sync**: Real-time Play, Pause, and Seek synchronization (<300ms drift tolerance) with loop-prevention flags.
- **🎙️ WebRTC Spatial Voice Room**:
  - Cascaded 24dB/octave high-pass filter (260 Hz) and low-pass filter (3200 Hz).
  - Anti-keystroke / laptop chassis vibration suppression.
  - Smart Voice Activity Gate + Push-to-Talk (Spacebar) mode.
  - Master room output volume slider & individual member volume controls.
- **🍿 Animated Stickers & Emojis**:
  - 1-Click Quick Reaction bar (`🍿`, `🔥`, `😂`, `😱`, `❤️`, `💀`, `👏`, `😭`).
  - Categorized emoji picker with search.
  - Rich Watch Party badge stickers.
- **🛡️ Chrome Side Panel Integration**: Seamless side panel view with responsive UI (strict max border-radius ≤ 5px).
- **🚀 Node.js / Socket.IO Backend**: Real-time room management with MongoDB persistence and automatic in-memory fallback.

---

## 📁 Repository Structure

```
netflixroom/
├── backend/                # Express + Socket.IO Signaling & Room Server
│   ├── src/
│   │   ├── config/         # MongoDB and environment configuration
│   │   ├── controllers/    # Room REST APIs
│   │   ├── models/         # Party and Message schemas
│   │   ├── routes/         # API routes
│   │   ├── sockets/        # Real-time WebRTC & sync signaling
│   │   └── server.js       # Main server entrypoint
│   ├── .env.example
│   └── package.json
├── extension/              # Manifest V3 Chrome Extension (React + Vite + TypeScript)
│   ├── public/             # Extension icons & assets
│   ├── src/
│   │   ├── background/     # Extension service worker
│   │   ├── content/        # Netflix video player adapter
│   │   ├── services/       # WebRTC Voice & WebSocket services
│   │   ├── sidepanel/      # Side panel React UI
│   │   └── popup/          # Extension launcher popup
│   ├── manifest.json
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Backend Server Setup

```bash
cd backend
npm install
npm start
```
*Server runs on `http://localhost:5000` with WebSocket support.*

### 2. Chrome Extension Setup

```bash
cd extension
npm install
npm run build
```

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `netflixroom/extension/dist` folder.
4. Open [Netflix](https://www.netflix.com), click the extension icon to open the Side Panel, create or join a party, and enjoy!

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons
- **Real-Time Communication**: WebRTC (Mesh Audio DSP), Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, MongoDB / Mongoose
- **Browser APIs**: Chrome Extensions Manifest V3 (Side Panel, Tabs, Storage)
