import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  isHost: { type: Boolean, default: false },
  isMuted: { type: Boolean, default: true },
  isSpeaking: { type: Boolean, default: false },
  inVoice: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now }
}, { _id: false });

const partySchema = new mongoose.Schema({
  partyCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  hostId: { type: String, required: true },
  hostName: { type: String, required: true },
  members: [memberSchema],
  mediaInfo: {
    title: { type: String, default: 'Netflix Content' },
    episodeInfo: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    duration: { type: Number, default: 0 }
  },
  playbackState: {
    isPlaying: { type: Boolean, default: false },
    currentTime: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    controlledBy: { type: String, default: 'host' }
  },
  settings: {
    onlyHostCanControl: { type: Boolean, default: false },
    isVoiceEnabled: { type: Boolean, default: true },
    maxMembers: { type: Number, default: 20 }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.models.Party || mongoose.model('Party', partySchema);
