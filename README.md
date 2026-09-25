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

## 📥 How to Install & Use (For Friends & Non-Developers)

Koi bhi user bina coding ya software install kiye yeh extension Chrome me chala sakta hai:

1. **Download Extension:**
   - GitHub Releases se ya is repo se `netflixroom-extension.zip` download karein aur kisi folder me **Extract / Unzip** karein.
2. **Load in Chrome:**
   - Google Chrome open karein aur URL bar me likhein: `chrome://extensions/`
   - Top-right corner par **Developer mode** on karein.
   - Top-left par **Load unpacked** button par click karein aur extracted folder select karein.
3. **Enjoy Watching:**
   - [Netflix](https://www.netflix.com) open karein aur top-right Extensions menu se **Netflix Watch Party** icon par click karein.
   - Side panel open ho jayega. Room banayein ya Party Code enter kar ke join karein!

---

## 🚀 Developer Setup

### 1. Backend Server Setup

```bash
cd backend
npm install
npm start
```
*Server runs on `http://localhost:5000` with WebSocket support.*

### 2. Chrome Extension Build

```bash
cd extension
npm install
npm run build
```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons
- **Real-Time Communication**: WebRTC (Mesh Audio DSP), Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, MongoDB / Mongoose
- **Browser APIs**: Chrome Extensions Manifest V3 (Side Panel, Tabs, Storage)
