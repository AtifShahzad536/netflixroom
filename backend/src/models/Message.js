import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  partyCode: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String, default: '' },
  text: { type: String, default: '' },
  type: {
    type: String,
    enum: ['chat', 'system', 'action', 'sticker'],
    default: 'chat'
  },
  stickerUrl: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export default mongoose.models.Message || mongoose.model('Message', messageSchema);
