import React, { useState } from 'react';
import { ArrowLeft, Users, KeyRound } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { IconButton } from '../../components/IconButton';
import { Party } from '../../types';

interface JoinPartyViewProps {
  onBack: () => void;
  onJoinParty: (code: string) => Promise<{ success: boolean; party?: Party; error?: string }>;
  onPartyJoined: (party: Party) => void;
}

export const JoinPartyView: React.FC<JoinPartyViewProps> = ({
  onBack,
  onJoinParty,
  onPartyJoined
}) => {
  const [partyCode, setPartyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const cleanCode = partyCode.trim().toUpperCase();

    if (!cleanCode) {
      setError('Please enter a party code.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await onJoinParty(cleanCode);
      if (res.success && res.party) {
        onPartyJoined(res.party);
      } else {
        setError(res.error || 'Could not find or join watch party.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-[#0d0e12] overflow-y-auto">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <IconButton size="sm" variant="ghost" onClick={onBack} tooltip="Go back">
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </IconButton>
          <h2 className="text-sm font-bold text-slate-100">Join a Watch Party</h2>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-[4px] bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Enter Party Code"
            placeholder="e.g. WP-7K2P"
            value={partyCode}
            onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            leftElement={<KeyRound className="w-4 h-4" />}
            autoFocus
          />

          <div className="bg-[#14161d] p-3 rounded-[4px] border border-[#272b3a] text-[11px] text-slate-400 leading-relaxed">
            <p>
              Ask the party host for their 6-8 character party code or click their shared invite link directly while on Netflix.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6">
        <Button
          variant="primary"
          size="lg"
          isLoading={isLoading}
          onClick={handleJoin}
          disabled={!partyCode.trim()}
          className="w-full"
        >
          Join Party
        </Button>
      </div>
    </div>
  );
};
