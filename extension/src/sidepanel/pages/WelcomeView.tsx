import React, { useState } from 'react';
import { PlayCircle, Users, Tv, Sparkles, User as UserIcon } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';

interface WelcomeViewProps {
  userName: string;
  onSaveUserName: (name: string) => void;
  onCreateClick: () => void;
  onJoinClick: () => void;
  isNetflixActive: boolean;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  userName,
  onSaveUserName,
  onCreateClick,
  onJoinClick,
  isNetflixActive
}) => {
  const [nameInput, setNameInput] = useState(userName || '');

  const handleNameBlur = () => {
    if (nameInput.trim()) {
      onSaveUserName(nameInput.trim());
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-[#0d0e12] overflow-y-auto">
      {/* Top Branding Section */}
      <div className="flex flex-col items-center text-center mt-3">
        <img
          src="/logo.png"
          alt="Netflix Watch Party Logo"
          className="w-16 h-16 object-contain rounded-[4px] shadow-lg mb-3 select-none"
        />

        <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          WatchTogether
        </h1>

        <p className="text-sm font-semibold text-[#E50914] mt-1 tracking-wide">
          Watch together. Stay connected.
        </p>

        <p className="text-xs text-slate-400 mt-2.5 max-w-[260px] leading-relaxed">
          Sync Netflix playback with your friends and chat or talk while you watch.
        </p>

        {/* Netflix Status Indicator */}
        <div className="mt-4">
          {isNetflixActive ? (
            <Badge variant="success" size="sm" dot className="py-1 px-2.5">
              Netflix Tab Connected
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" dot className="py-1 px-2.5">
              Open Netflix to start party
            </Badge>
          )}
        </div>
      </div>

      {/* User Name & Action Buttons */}
      <div className="w-full space-y-4 my-6">
        <div className="bg-[#14161d] p-3.5 rounded-[4px] border border-[#272b3a]">
          <Input
            label="Your Display Name"
            placeholder="Enter your name (e.g. Alex)"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameBlur}
            leftElement={<UserIcon className="w-4 h-4" />}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              if (nameInput.trim()) onSaveUserName(nameInput.trim());
              onCreateClick();
            }}
            leftIcon={<PlayCircle className="w-4 h-4" />}
            className="w-full"
          >
            Create Watch Party
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              if (nameInput.trim()) onSaveUserName(nameInput.trim());
              onJoinClick();
            }}
            leftIcon={<Users className="w-4 h-4" />}
            className="w-full"
          >
            Join Watch Party
          </Button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center pb-2">
        <p className="text-[10px] text-slate-600 font-mono">
          Manifest V3 • Real-time WebRTC & Socket Sync
        </p>
      </div>
    </div>
  );
};
