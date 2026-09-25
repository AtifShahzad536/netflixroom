import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import partyRoutes from './routes/partyRoutes.js';
import { registerPartySocket } from './sockets/partySocket.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || '*';

// Initialize Database (with fallback)
connectDB();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/party', partyRoutes);

// Root Status endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Netflix Watch Party Real-time Server',
    websockets: 'active',
    timestamp: new Date().toISOString()
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

server.listen(PORT, () => {
  console.log(`🚀 Watch Party Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server active on ws://localhost:${PORT}`);
});
