import express from 'express';
import {
  getAdminDashboardStats,
  closeRoomByAdmin,
  kickUserByAdmin,
  broadcastMessageByAdmin
} from '../sockets/partySocket.js';

export function createAdminRouter(io) {
  const router = express.Router();

  // 1. Render Admin Panel Dashboard
  router.get('/access', (req, res) => {
    try {
      const stats = getAdminDashboardStats();
      res.render('admin', { stats });
    } catch (err) {
      console.error('Error rendering admin panel:', err);
      res.status(500).send('Internal Server Error rendering Admin Panel: ' + err.message);
    }
  });

  // 2. Real-time stats API for live frontend polling
  router.get('/access/api/stats', (req, res) => {
    try {
      const stats = getAdminDashboardStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Force Close Party Room
  router.post('/access/api/room/:code/close', (req, res) => {
    try {
      const { code } = req.params;
      const result = closeRoomByAdmin(io, code);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Kick User from Party
  router.post('/access/api/room/:code/kick', (req, res) => {
    try {
      const { code } = req.params;
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }
      const result = kickUserByAdmin(io, code, userId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Send Broadcast Notice
  router.post('/access/api/broadcast', (req, res) => {
    try {
      const { partyCode, message } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, error: 'Message text is required' });
      }
      const result = broadcastMessageByAdmin(io, partyCode, message);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
