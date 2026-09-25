import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getAdminDashboardStats,
  closeRoomByAdmin,
  kickUserByAdmin,
  broadcastMessageByAdmin,
  logAdminEvent
} from '../sockets/partySocket.js';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'netflix_super_secret_admin_jwt_key_2026';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

// Authentication Guard Middleware
function requireAdminAuth(req, res, next) {
  const token = req.cookies?.admin_token || req.headers['x-admin-token'];

  if (!token) {
    if (req.path.includes('/api/')) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Admin authentication required.' });
    }
    return res.redirect('/user/admin/login');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminUser = decoded;
    next();
  } catch (err) {
    res.clearCookie('admin_token');
    if (req.path.includes('/api/')) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid token.' });
    }
    return res.redirect('/user/admin/login?error=Session+expired.+Please+log+in+again.');
  }
}

export function createAdminRouter(io) {
  const router = express.Router();

  // 1. GET /user/admin/login - Render Login View
  router.get('/login', (req, res) => {
    // If already logged in, redirect directly to dashboard
    const token = req.cookies?.admin_token;
    if (token) {
      try {
        jwt.verify(token, JWT_SECRET);
        return res.redirect('/user/admin/access');
      } catch (_) {}
    }

    const error = req.query.error || null;
    res.render('login', { error });
  });

  // 2. POST /user/admin/login - Process Authentication
  router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render('login', { error: 'Both username and password are required.' });
    }

    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      // Generate Signed JWT Token (24 hours expiry)
      const token = jwt.sign(
        { username: ADMIN_USER, role: 'super_admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Set secure HTTP-only cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      });

      logAdminEvent('AUTH_LOGIN', `Admin "${username}" successfully logged in`, { ip: req.ip });
      return res.redirect('/user/admin/access');
    }

    logAdminEvent('AUTH_FAILED', `Failed admin login attempt with username "${username}"`, { ip: req.ip });
    res.render('login', { error: 'Invalid admin username or password.' });
  });

  // 3. GET /user/admin/logout - Clear Session
  router.get('/logout', (req, res) => {
    res.clearCookie('admin_token');
    logAdminEvent('AUTH_LOGOUT', 'Administrator logged out', { ip: req.ip });
    res.redirect('/user/admin/login');
  });

  // 4. GET /user/admin/access - Protected Main Enterprise Dashboard
  router.get('/access', requireAdminAuth, (req, res) => {
    try {
      const stats = getAdminDashboardStats();
      res.render('admin', { stats, user: req.adminUser });
    } catch (err) {
      console.error('Error rendering admin panel:', err);
      res.status(500).send('Internal Server Error rendering Admin Panel: ' + err.message);
    }
  });

  // 5. GET /user/admin/access/api/stats - Protected Real-Time Polling Endpoint
  router.get('/access/api/stats', requireAdminAuth, (req, res) => {
    try {
      const stats = getAdminDashboardStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. POST /user/admin/access/api/room/:code/close - Protected Terminate Room
  router.post('/access/api/room/:code/close', requireAdminAuth, (req, res) => {
    try {
      const { code } = req.params;
      const result = closeRoomByAdmin(io, code);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. POST /user/admin/access/api/room/:code/kick - Protected Kick Member
  router.post('/access/api/room/:code/kick', requireAdminAuth, (req, res) => {
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

  // 8. POST /user/admin/access/api/broadcast - Protected Send Global / Room Broadcast
  router.post('/access/api/broadcast', requireAdminAuth, (req, res) => {
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
