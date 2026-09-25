import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Smile, Sparkles, X, Search, Flame, Popcorn, Heart, Laugh } from 'lucide-react';
import { ChatMessage } from '../../types';
import { Avatar } from '../../components/Avatar';
import { IconButton } from '../../components/IconButton';

interface ChatTabProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string, type?: 'chat' | 'sticker', stickerUrl?: string) => void;
}

interface StickerItem {
  id: string;
  title: string;
  slogan: string;
  emoji: string;
  badge: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
}

const WATCH_PARTY_STICKERS: StickerItem[] = [
  {
    id: 'popcorn_party',
    title: 'Popcorn Time',
    slogan: '🍿 POPCORN TIME!',
    emoji: '🍿',
    badge: 'CINEMA',
    bgGradient: 'from-amber-950/80 via-amber-900/50 to-orange-950/80',
    borderColor: 'border-amber-500/50',
    textColor: 'text-amber-300'
  },
  {
    id: 'peak_cinema',
    title: 'Peak Cinema',
    slogan: '🔥 PEAK CINEMA!',
    emoji: '🔥',
    badge: 'HYPE',
    bgGradient: 'from-red-950/80 via-rose-900/50 to-orange-950/80',
    borderColor: 'border-red-500/50',
    textColor: 'text-red-300'
  },
  {
    id: 'mind_blown',
    title: 'Mind Blown',
    slogan: '🤯 MIND BLOWN!',
    emoji: '🤯',
    badge: 'SHOCK',
    bgGradient: 'from-purple-950/80 via-indigo-900/50 to-violet-950/80',
    borderColor: 'border-purple-500/50',
    textColor: 'text-purple-300'
  },
  {
    id: 'plot_twist',
    title: 'Plot Twist',
    slogan: '⚡ WHAT A TWIST!',
    emoji: '⚡',
    badge: 'TWIST',
    bgGradient: 'from-yellow-950/80 via-amber-900/50 to-yellow-950/80',
    borderColor: 'border-yellow-500/50',
    textColor: 'text-yellow-300'
  },
  {
    id: 'no_spoilers',
    title: 'No Spoilers',
    slogan: '🤫 SHHH! NO SPOILERS',
    emoji: '🤫',
    badge: 'QUIET',
    bgGradient: 'from-rose-950/80 via-pink-900/50 to-red-950/80',
    borderColor: 'border-rose-500/50',
    textColor: 'text-rose-300'
  },
  {
    id: 'crying_tears',
    title: 'Too Emotional',
    slogan: '😭 TOO EMOTIONAL!',
    emoji: '😭',
    badge: 'FEELS',
    bgGradient: 'from-sky-950/80 via-blue-900/50 to-cyan-950/80',
    borderColor: 'border-sky-500/50',
    textColor: 'text-sky-300'
  },
  {
    id: 'laughing_dead',
    title: 'Dead LMFAO',
    slogan: '💀 I AM DEAD LOL',
    emoji: '💀',
    badge: 'FUNNY',
    bgGradient: 'from-slate-900 via-zinc-900 to-stone-900',
    borderColor: 'border-slate-500/50',
    textColor: 'text-slate-200'
  },
  {
    id: 'standing_ovation',
    title: 'Standing Ovation',
    slogan: '👏 STANDING OVATION',
    emoji: '👏',
    badge: 'BRAVO',
    bgGradient: 'from-emerald-950/80 via-teal-900/50 to-green-950/80',
    borderColor: 'border-emerald-500/50',
    textColor: 'text-emerald-300'
  },
  {
    id: 'binge_mode',
    title: 'Next Episode',
    slogan: '🛋️ NEXT EPISODE NOW',
    emoji: '🛋️',
    badge: 'BINGE',
    bgGradient: 'from-violet-950/80 via-purple-900/50 to-fuchsia-950/80',
    borderColor: 'border-violet-500/50',
    textColor: 'text-violet-300'
  },
  {
    id: 'jumpscare',
    title: 'Jumpscare',
    slogan: '👻 JUMPSCARE ALERT!',
    emoji: '👻',
    badge: 'HORROR',
    bgGradient: 'from-neutral-950 via-purple-950 to-black',
    borderColor: 'border-purple-600/50',
    textColor: 'text-purple-300'
  },
  {
    id: 'oscar_worthy',
    title: 'Oscar Worthy',
    slogan: '🏆 10/10 MASTERPIECE',
    emoji: '🏆',
    badge: 'OSCAR',
    bgGradient: 'from-amber-950/90 via-yellow-900/60 to-amber-950/90',
    borderColor: 'border-amber-400/60',
    textColor: 'text-amber-200'
  },
  {
    id: 'pizza_chill',
    title: 'Pizza & Chill',
    slogan: '🍕 PIZZA TIME!',
    emoji: '🍕',
    badge: 'CHILL',
    bgGradient: 'from-orange-950/80 via-red-900/50 to-amber-950/80',
    borderColor: 'border-orange-500/50',
    textColor: 'text-orange-300'
  }
];

const QUICK_REACTION_EMOJIS = ['🍿', '🔥', '😂', '😱', '👏', '❤️', '💀', '😭'];

const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: 'Party & Movie',
    icon: '🍿',
    emojis: ['🍿', '🎬', '🎥', '🎞️', '📽️', '📺', '📻', '🎙️', '🎧', '🍕', '🍔', '🍟', '🌭', '🍩', '🍪', '🍫', '🍦', '🥤', '🍺', '🍻', '🥂', '🍾', '🎮', '🕹️', '🛋️', '👑', '🎉', '🎊', '✨', '🎈', '🎆', '🎇']
  },
  {
    name: 'Smileys & Reactions',
    icon: '😂',
    emojis: ['😂', '🤣', '😭', '🥹', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎', '🥳', '😏', '😒', '😞', '🥺', '😤', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '🤔', '🫣', '🤫', '🥱', '😴', '💀', '👻', '👽', '🤖', '💩']
  },
  {
    name: 'Gestures & Hearts',
    icon: '❤️',
    emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤟', '🤘', '👌', '🤌', '👈', '👉', '☝️', '✋', '👋', '🤙', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❤️‍🔥', '💖', '💯', '🔥', '⚡', '💥', '⭐', '🌟', '✨', '🏆', '🚨']
  }
];

function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  currentUserId,
  onSendMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers'>('stickers');
  const [emojiSearch, setEmojiSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'chat');
    setInputText('');
    setIsPickerOpen(false);
  };

  const handleQuickEmojiSend = (emoji: string) => {
    onSendMessage(emoji, 'chat');
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleStickerSend = (sticker: StickerItem) => {
    onSendMessage(sticker.slogan, 'sticker', sticker.id);
    setIsPickerOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter emojis by search
  const filteredEmojiCategories = emojiSearch.trim()
    ? EMOJI_CATEGORIES.map(cat => ({
        ...cat,
        emojis: cat.emojis.filter(e => e.includes(emojiSearch.trim()))
      })).filter(cat => cat.emojis.length > 0)
    : EMOJI_CATEGORIES;

  const filteredStickers = emojiSearch.trim()
    ? WATCH_PARTY_STICKERS.filter(s =>
        s.title.toLowerCase().includes(emojiSearch.toLowerCase()) ||
        s.slogan.toLowerCase().includes(emojiSearch.toLowerCase()) ||
        s.emoji.includes(emojiSearch)
      )
    : WATCH_PARTY_STICKERS;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e12] relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 text-slate-600 stroke-[1.5]" />
            <p className="text-xs font-medium text-slate-400">No messages yet</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Send a message, sticker or emoji to start the party!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const isSystem = msg.type === 'system' || msg.type === 'action';
            const isSticker = msg.type === 'sticker';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex items-center justify-center my-1.5">
                  <span className="text-[10px] text-slate-400 bg-[#14161d] border border-[#272b3a] px-2.5 py-0.5 rounded-[3px]">
                    {msg.text}
                  </span>
                </div>
              );
            }

            // Render Sticker Message
            if (isSticker) {
              const matchedSticker = WATCH_PARTY_STICKERS.find(s => s.id === msg.stickerUrl || s.slogan === msg.text) || {
                id: 'custom',
                title: 'Sticker',
                slogan: msg.text,
                emoji: '🍿',
                badge: 'STICKER',
                bgGradient: 'from-amber-950/80 via-red-950/60 to-purple-950/80',
                borderColor: 'border-[#E50914]/50',
                textColor: 'text-amber-200'
              };

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isMe && <Avatar name={msg.senderName} size="sm" />}
                  <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-medium text-slate-400">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <span className="text-[9px] text-slate-600">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    </div>

                    {/* Rich Sticker Card */}
                    <div
                      className={`p-3 rounded-[4px] border bg-gradient-to-br ${matchedSticker.bgGradient} ${matchedSticker.borderColor} shadow-md flex flex-col items-center text-center gap-1.5 min-w-[140px] transform hover:scale-[1.02] transition-transform`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[8.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-[2px] bg-black/40 text-slate-300 border border-white/10">
                          {matchedSticker.badge}
                        </span>
                        <Sparkles className="w-3 h-3 text-amber-400/80" />
                      </div>
                      <span className="text-3xl my-0.5 select-none filter drop-shadow-md">
                        {matchedSticker.emoji}
                      </span>
                      <span className={`text-[11px] font-black tracking-wide ${matchedSticker.textColor} drop-shadow-sm`}>
                        {matchedSticker.slogan}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Standard Text / Emoji Message
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {!isMe && <Avatar name={msg.senderName} size="sm" />}
                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-medium text-slate-400">
                      {isMe ? 'You' : msg.senderName}
                    </span>
                    <span className="text-[9px] text-slate-600">
                      {formatMessageTime(msg.timestamp)}
                    </span>
                  </div>
                  <div
                    className={`px-3 py-2 text-xs rounded-[4px] border ${
                      isMe
                        ? 'bg-[#1b1e28] text-slate-100 border-[#353b4f]'
                        : 'bg-[#14161d] text-slate-200 border-[#272b3a]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words select-text">{msg.text}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Emoji & Sticker Picker Drawer */}
      {isPickerOpen && (
        <div className="absolute bottom-[108px] left-2 right-2 max-h-[280px] bg-[#14161d] border border-[#272b3a] rounded-[4px] shadow-2xl z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Picker Header & Tabs */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#272b3a] bg-[#0d0e12]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPickerTab('stickers')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-[3px] transition-colors ${
                  pickerTab === 'stickers'
                    ? 'bg-[#E50914] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Stickers</span>
              </button>
              <button
                type="button"
                onClick={() => setPickerTab('emojis')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-[3px] transition-colors ${
                  pickerTab === 'emojis'
                    ? 'bg-[#222634] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smile className="w-3 h-3 text-amber-400" />
                <span>Emojis</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-[2px]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-2.5 py-1.5 border-b border-[#272b3a] bg-[#14161d]">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0d0e12] border border-[#272b3a] rounded-[3px]">
              <Search className="w-3 h-3 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder={pickerTab === 'stickers' ? 'Search stickers...' : 'Search emojis...'}
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                className="w-full bg-transparent text-[11px] text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-2.5 overflow-y-auto min-h-[160px] max-h-[200px]">
            {pickerTab === 'stickers' ? (
              /* Stickers Grid */
              <div className="grid grid-cols-2 gap-2">
                {filteredStickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => handleStickerSend(sticker)}
                    className={`p-2.5 rounded-[4px] border bg-gradient-to-br ${sticker.bgGradient} ${sticker.borderColor} hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center text-center gap-1 shadow-sm group`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {sticker.emoji}
                    </span>
                    <span className={`text-[10px] font-bold ${sticker.textColor} leading-tight`}>
                      {sticker.slogan}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              /* Emojis Grid */
              <div className="space-y-3">
                {filteredEmojiCategories.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {cat.name}
                    </span>
                    <div className="grid grid-cols-8 gap-1">
                      {cat.emojis.map((emoji, idx) => (
                        <button
                          key={`${emoji}-${idx}`}
                          type="button"
                          onClick={() => handleEmojiClick(emoji)}
                          className="h-7 text-base rounded-[3px] hover:bg-[#222634] active:scale-90 flex items-center justify-center transition-all select-none"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Reaction Emoji Bar */}
      <div className="px-2.5 py-1.5 bg-[#101218] border-t border-[#272b3a] flex items-center justify-between gap-1 overflow-x-auto">
        <span className="text-[9px] uppercase font-bold text-slate-500 shrink-0">
          React:
        </span>
        <div className="flex items-center gap-1">
          {QUICK_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleQuickEmojiSend(emoji)}
              className="w-6 h-6 rounded-[3px] text-xs hover:bg-[#222634] hover:scale-110 active:scale-95 flex items-center justify-center transition-all select-none"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-2.5 bg-[#14161d] border-t border-[#272b3a]">
        <div className="flex items-end gap-1.5 bg-[#0d0e12] border border-[#272b3a] focus-within:border-[#E50914] rounded-[4px] p-1.5 transition-colors">
          {/* Emoji/Sticker Trigger Button */}
          <button
            type="button"
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            className={`p-1.5 rounded-[3px] transition-colors shrink-0 ${
              isPickerOpen ? 'bg-[#E50914] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-[#222634]'
            }`}
            title="Emojis & Stickers"
          >
            <Smile className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message or reaction..."
            rows={1}
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 resize-none outline-none px-1 py-1 max-h-20"
          />

          <IconButton
            size="sm"
            variant="primary"
            onClick={handleSend}
            disabled={!inputText.trim()}
            tooltip="Send message"
            className="shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};
