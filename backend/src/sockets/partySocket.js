import Party from '../models/Party.js';
import Message from '../models/Message.js';
import { isDbConnected } from '../config/db.js';

// In-memory active parties cache for ultra-fast real-time sync & fallback
const activeRooms = new Map();

// Helper to get or create memory party
function getOrCreateMemoryParty(partyCode, initialData = {}) {
  const code = partyCode.toUpperCase();
  if (!activeRooms.has(code)) {
    activeRooms.set(code, {
      partyCode: code,
      name: initialData.name || 'Watch Party',
      description: initialData.description || '',
      hostId: initialData.hostId || '',
      hostName: initialData.hostName || '',
      members: [],
      mediaInfo: {
        title: initialData.mediaInfo?.title || 'Netflix Stream',
        episodeInfo: initialData.mediaInfo?.episodeInfo || '',
        videoUrl: initialData.mediaInfo?.videoUrl || '',
        duration: initialData.mediaInfo?.duration || 0
      },
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        lastUpdated: new Date(),
        controlledBy: 'host'
      },
      settings: {
        onlyHostCanControl: initialData.settings?.onlyHostCanControl || false,
        isVoiceEnabled: true,
        maxMembers: 20
      },
      voiceParticipants: new Set(),
      messages: []
    });
  }
  return activeRooms.get(code);
}

export function registerPartySocket(io) {
  io.on('connection', (socket) => {
    let currentPartyCode = null;
    let currentUser = null;

    // 1. JOIN PARTY
    socket.on('party:join', async (payload, callback) => {
      try {
        const { partyCode, user } = payload;
        if (!partyCode || !user || !user.userId) {
          if (callback) callback({ success: false, error: 'Invalid join credentials' });
          return;
        }

        const code = partyCode.trim().toUpperCase();
        currentPartyCode = code;
        currentUser = user;

        socket.join(code);

        let room = activeRooms.get(code);
        if (!room) {
          if (isDbConnected()) {
            const dbParty = await Party.findOne({ partyCode: code, isActive: true });
            if (dbParty) {
              room = getOrCreateMemoryParty(code, dbParty.toObject());
            } else {
              room = getOrCreateMemoryParty(code, {
                hostId: user.userId,
                hostName: user.name,
                name: `${user.name}'s Watch Party`
              });
            }
          } else {
            room = getOrCreateMemoryParty(code, {
              hostId: user.userId,
              hostName: user.name,
              name: `${user.name}'s Watch Party`
            });
          }
        }

        // Add or update member
        const existingMemberIndex = room.members.findIndex(m => m.userId === user.userId);
        const memberData = {
          userId: user.userId,
          name: user.name,
          avatar: user.avatar || '',
          isHost: room.hostId === user.userId || (!room.hostId && room.members.length === 0),
          isMuted: true,
          isSpeaking: false,
          inVoice: false,
          socketId: socket.id,
          lastActive: new Date()
        };

        if (memberData.isHost && !room.hostId) {
          room.hostId = user.userId;
          room.hostName = user.name;
        }

        if (existingMemberIndex >= 0) {
          room.members[existingMemberIndex] = { ...room.members[existingMemberIndex], ...memberData };
        } else {
          room.members.push(memberData);
        }

        // Broadcast member joined
        socket.to(code).emit('party:member-joined', {
          member: memberData,
          totalMembers: room.members.length
        });

        // Broadcast system chat notification
        const joinMsg = {
          id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          partyCode: code,
          senderId: 'system',
          senderName: 'System',
          senderAvatar: '',
          text: `${user.name} joined the watch party`,
          type: 'system',
          timestamp: new Date().toISOString()
        };
        room.messages.push(joinMsg);
        io.to(code).emit('chat:message', joinMsg);

        // Acknowledge with full room state
        if (callback) {
          callback({
            success: true,
            party: {
              partyCode: room.partyCode,
              name: room.name,
              description: room.description,
              hostId: room.hostId,
              hostName: room.hostName,
              members: room.members,
              mediaInfo: room.mediaInfo,
              playbackState: room.playbackState,
              settings: room.settings
            },
            messages: room.messages.slice(-50)
          });
        }
      } catch (err) {
        console.error('Socket party:join error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // 2. PLAYBACK SYNCHRONIZATION
    socket.on('sync:play', (data) => {
      if (!currentPartyCode) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      if (room.settings.onlyHostCanControl && currentUser && room.hostId !== currentUser.userId) {
        return;
      }

      room.playbackState.isPlaying = true;
      room.playbackState.currentTime = Number(data.position || 0);
      room.playbackState.lastUpdated = new Date();
      room.playbackState.controlledBy = currentUser?.name || 'User';

      socket.to(currentPartyCode).emit('sync:play', {
        position: room.playbackState.currentTime,
        timestamp: Date.now(),
        issuer: currentUser?.name || 'User',
        origin: 'remote'
      });

      const sysMsg = {
        id: `sys-${Date.now()}`,
        partyCode: currentPartyCode,
        senderId: 'system',
        senderName: 'System',
        text: `${currentUser?.name || 'A member'} played the video`,
        type: 'action',
        timestamp: new Date().toISOString()
      };
      io.to(currentPartyCode).emit('chat:message', sysMsg);
    });

    socket.on('sync:pause', (data) => {
      if (!currentPartyCode) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      if (room.settings.onlyHostCanControl && currentUser && room.hostId !== currentUser.userId) {
        return;
      }

      room.playbackState.isPlaying = false;
      room.playbackState.currentTime = Number(data.position || 0);
      room.playbackState.lastUpdated = new Date();
      room.playbackState.controlledBy = currentUser?.name || 'User';

      socket.to(currentPartyCode).emit('sync:pause', {
        position: room.playbackState.currentTime,
        timestamp: Date.now(),
        issuer: currentUser?.name || 'User',
        origin: 'remote'
      });

      const sysMsg = {
        id: `sys-${Date.now()}`,
        partyCode: currentPartyCode,
        senderId: 'system',
        senderName: 'System',
        text: `${currentUser?.name || 'A member'} paused the video`,
        type: 'action',
        timestamp: new Date().toISOString()
      };
      io.to(currentPartyCode).emit('chat:message', sysMsg);
    });

    socket.on('sync:seek', (data) => {
      if (!currentPartyCode) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      if (room.settings.onlyHostCanControl && currentUser && room.hostId !== currentUser.userId) {
        return;
      }

      room.playbackState.currentTime = Number(data.position || 0);
      room.playbackState.lastUpdated = new Date();

      socket.to(currentPartyCode).emit('sync:seek', {
        position: room.playbackState.currentTime,
        timestamp: Date.now(),
        issuer: currentUser?.name || 'User',
        origin: 'remote'
      });
    });

    socket.on('sync:media-update', (data) => {
      if (!currentPartyCode) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      room.mediaInfo = {
        ...room.mediaInfo,
        ...data
      };

      io.to(currentPartyCode).emit('sync:media-update', room.mediaInfo);
    });

    socket.on('sync:state-request', () => {
      if (!currentPartyCode) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      socket.emit('sync:state-response', {
        playbackState: room.playbackState,
        mediaInfo: room.mediaInfo
      });
    });

    // 3. CHAT MESSAGING
    socket.on('chat:message', async (data, callback) => {
      if (!currentPartyCode || !currentUser) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      const messageObj = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        partyCode: currentPartyCode,
        senderId: currentUser.userId,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar || '',
        text: (data.text || '').trim(),
        type: data.type || 'chat',
        stickerUrl: data.stickerUrl || null,
        timestamp: new Date().toISOString()
      };

      if (!messageObj.text && !messageObj.stickerUrl) return;

      room.messages.push(messageObj);
      if (room.messages.length > 200) room.messages.shift();

      io.to(currentPartyCode).emit('chat:message', messageObj);

      if (isDbConnected()) {
        try {
          Message.create(messageObj).catch(() => {});
        } catch (_) {}
      }

      if (callback) callback({ success: true, message: messageObj });
    });

    // 4. WEBRTC VOICE SIGNALING (MESH)
    socket.on('voice:join', () => {
      if (!currentPartyCode || !currentUser) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      // Existing members in voice
      const existingVoiceMembers = room.members
        .filter(m => m.inVoice && m.socketId && m.socketId !== socket.id)
        .map(m => ({ socketId: m.socketId, userId: m.userId, name: m.name }));

      room.voiceParticipants.add(currentUser.userId);
      const member = room.members.find(m => m.userId === currentUser.userId);
      if (member) {
        member.inVoice = true;
        member.isMuted = false;
        member.socketId = socket.id;
      }

      // Notify joining user with all current voice peers
      socket.emit('voice:existing-participants', {
        participants: existingVoiceMembers
      });

      // Broadcast to existing members in party
      io.to(currentPartyCode).emit('voice:user-joined', {
        userId: currentUser.userId,
        name: currentUser.name,
        socketId: socket.id
      });
    });

    socket.on('voice:leave', () => {
      if (!currentPartyCode || !currentUser) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      room.voiceParticipants.delete(currentUser.userId);
      const member = room.members.find(m => m.userId === currentUser.userId);
      if (member) {
        member.inVoice = false;
        member.isSpeaking = false;
      }

      io.to(currentPartyCode).emit('voice:user-left', {
        userId: currentUser.userId,
        socketId: socket.id
      });
    });

    socket.on('voice:mute', (isMuted) => {
      if (!currentPartyCode || !currentUser) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      const member = room.members.find(m => m.userId === currentUser.userId);
      if (member) {
        member.isMuted = !!isMuted;
        if (isMuted) member.isSpeaking = false;
      }

      io.to(currentPartyCode).emit('voice:state-change', {
        userId: currentUser.userId,
        isMuted: !!isMuted,
        isSpeaking: false
      });
    });

    socket.on('voice:speaking', (isSpeaking) => {
      if (!currentPartyCode || !currentUser) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      const member = room.members.find(m => m.userId === currentUser.userId);
      if (member && !member.isMuted) {
        member.isSpeaking = !!isSpeaking;
      }

      socket.to(currentPartyCode).emit('voice:speaking', {
        userId: currentUser.userId,
        isSpeaking: !!isSpeaking
      });
    });

    // P2P WebRTC Signaling Relays
    socket.on('voice:signal:offer', ({ toSocketId, offer }) => {
      socket.to(toSocketId).emit('voice:signal:offer', {
        fromSocketId: socket.id,
        fromUserId: currentUser?.userId,
        offer
      });
    });

    socket.on('voice:signal:answer', ({ toSocketId, answer }) => {
      socket.to(toSocketId).emit('voice:signal:answer', {
        fromSocketId: socket.id,
        fromUserId: currentUser?.userId,
        answer
      });
    });

    socket.on('voice:signal:candidate', ({ toSocketId, candidate }) => {
      socket.to(toSocketId).emit('voice:signal:candidate', {
        fromSocketId: socket.id,
        candidate
      });
    });

    // 5. DISCONNECT / LEAVE
    const handleLeave = () => {
      if (!currentPartyCode || !currentUser) return;
      const room = activeRooms.get(currentPartyCode);
      if (!room) return;

      room.members = room.members.filter(m => m.userId !== currentUser.userId);
      room.voiceParticipants.delete(currentUser.userId);

      if (room.hostId === currentUser.userId && room.members.length > 0) {
        room.hostId = room.members[0].userId;
        room.hostName = room.members[0].name;
        room.members[0].isHost = true;
      }

      io.to(currentPartyCode).emit('party:member-left', {
        userId: currentUser.userId,
        name: currentUser.name,
        newHostId: room.hostId,
        totalMembers: room.members.length
      });

      io.to(currentPartyCode).emit('voice:user-left', {
        userId: currentUser.userId,
        socketId: socket.id
      });

      const leaveMsg = {
        id: `sys-${Date.now()}`,
        partyCode: currentPartyCode,
        senderId: 'system',
        senderName: 'System',
        text: `${currentUser.name} left the watch party`,
        type: 'system',
        timestamp: new Date().toISOString()
      };
      io.to(currentPartyCode).emit('chat:message', leaveMsg);

      if (room.members.length === 0) {
        setTimeout(() => {
          const fresh = activeRooms.get(currentPartyCode);
          if (fresh && fresh.members.length === 0) {
            activeRooms.delete(currentPartyCode);
          }
        }, 15 * 60 * 1000);
      }
    };

    socket.on('party:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
