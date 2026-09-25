import { v4 as uuidv4 } from 'uuid';
import Party from '../models/Party.js';
import Message from '../models/Message.js';
import { isDbConnected } from '../config/db.js';

// Generate clean, readable party code like "NETFLIX-7K2P" or "WATCH-9X4R"
function generatePartyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WP-${code}`;
}

export const createParty = async (req, res) => {
  try {
    const { name, description, hostId, hostName, settings, mediaInfo } = req.body;

    if (!hostId || !hostName) {
      return res.status(400).json({ success: false, message: 'Host details are required.' });
    }

    const partyCode = generatePartyCode();
    const partyName = name?.trim() || `${hostName}'s Watch Party`;

    const partyData = {
      partyCode,
      name: partyName,
      description: description || '',
      hostId,
      hostName,
      members: [
        {
          userId: hostId,
          name: hostName,
          avatar: '',
          isHost: true,
          isMuted: true,
          isSpeaking: false,
          inVoice: false,
          lastActive: new Date()
        }
      ],
      mediaInfo: {
        title: mediaInfo?.title || 'Netflix Stream',
        episodeInfo: mediaInfo?.episodeInfo || '',
        videoUrl: mediaInfo?.videoUrl || '',
        duration: mediaInfo?.duration || 0
      },
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        lastUpdated: new Date(),
        controlledBy: hostName
      },
      settings: {
        onlyHostCanControl: settings?.onlyHostCanControl || false,
        isVoiceEnabled: settings?.isVoiceEnabled !== undefined ? settings.isVoiceEnabled : true,
        maxMembers: settings?.maxMembers || 20
      },
      isActive: true
    };

    if (isDbConnected()) {
      const party = await Party.create(partyData);
      return res.status(201).json({ success: true, party });
    }

    // In-memory response
    return res.status(201).json({ success: true, party: partyData });
  } catch (error) {
    console.error('Error creating party:', error);
    res.status(500).json({ success: false, message: 'Server error while creating party.' });
  }
};

export const getPartyByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Party code is required.' });
    }

    const partyCode = code.trim().toUpperCase();

    if (isDbConnected()) {
      const party = await Party.findOne({ partyCode, isActive: true });
      if (!party) {
        return res.status(404).json({ success: false, message: 'Watch party not found or has expired.' });
      }
      return res.json({ success: true, party });
    }

    return res.json({
      success: true,
      party: {
        partyCode,
        name: 'Watch Party',
        isActive: true
      }
    });
  } catch (error) {
    console.error('Error fetching party:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching party.' });
  }
};

export const getPartyMessages = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Party code is required.' });
    }

    const partyCode = code.trim().toUpperCase();

    if (isDbConnected()) {
      const messages = await Message.find({ partyCode }).sort({ timestamp: 1 }).limit(100);
      return res.json({ success: true, messages });
    }

    return res.json({ success: true, messages: [] });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching messages.' });
  }
};
