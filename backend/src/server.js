import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import partyRoutes from './routes/partyRoutes.js';
import { createAdminRouter } from './routes/adminRoutes.js';
import { registerPartySocket } from './sockets/partySocket.js';

import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '../public');
const viewsPath = path.join(__dirname, '../views');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || '*';

// Initialize Database (with fallback)
connectDB();

// Configure EJS View Engine
app.set('view engine', 'ejs');
app.set('views', [viewsPath, path.join(__dirname, 'views')]);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Landing Page & Assets
app.use(express.static(publicPath));

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

registerPartySocket(io);

// Dedicated Admin Panel Routes: /user/admin/access
app.use('/user/admin', createAdminRouter(io));
app.get('/admin', (req, res) => res.redirect('/user/admin/access'));

// API Routes
app.use('/api/party', partyRoutes);

// Direct Extension Download Endpoint
app.get('/download', (req, res) => {
  const zipPath = path.join(publicPath, 'netflixroom-extension.zip');
  res.download(zipPath, 'netflixroom-extension.zip', (err) => {
    if (err) {
      res.status(404).send('Download file not found');
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Netflix Watch Party Real-time Server'
  });
});

// Fallback to Landing Page for root & frontend navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Watch Party Server running on http://localhost:${PORT}`);
  console.log(`🛡️ Admin Control Center active on http://localhost:${PORT}/user/admin/access`);
  console.log(`🔌 WebSocket Server active on ws://localhost:${PORT}`);
});

