import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, Sparkles, Shield, Share2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { IconButton } from '../../components/IconButton';
import { Party } from '../../types';

interface CreatePartyViewProps {
  userName: string;
  onBack: () => void;
  onCreateParty: (name: string, description: string, onlyHost: boolean) => Promise<Party | null>;
  onEnterParty: (party: Party) => void;
}

export const CreatePartyView: React.FC<CreatePartyViewProps> = ({
  userName,
  onBack,
  onCreateParty,
  onEnterParty
}) => {
  const [partyName, setPartyName] = useState(`${userName ? `${userName}'s` : 'My'} Watch Party`);
  const [description, setDescription] = useState('');
  const [onlyHostCanControl, setOnlyHostCanControl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdParty, setCreatedParty] = useState<Party | null>(null);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!partyName.trim()) {
      setError('Please enter a party name.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const party = await onCreateParty(partyName.trim(), description.trim(), onlyHostCanControl);
      if (party) {
        setCreatedParty(party);
      } else {
        setError('Failed to create party. Check server connection.');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating party');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setIsCopiedLink(true);
      setTimeout(() => setIsCopiedLink(false), 2000);
    } else {
      setIsCopiedCode(true);
      setTimeout(() => setIsCopiedCode(false), 2000);
    }
  };

  // Created Success Card
  if (createdParty) {
    const inviteLink = `https://netflix.com/?watchParty=${createdParty.partyCode}`;

    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-[#0d0e12] overflow-y-auto">
        <div className="space-y-5">
          <div className="text-center pt-2">
            <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center rounded-[4px] mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Party Ready!</h2>
            <p className="text-xs text-slate-400 mt-1">
              Share the code or link with your friends to join.
            </p>
          </div>

          <div className="bg-[#14161d] p-4 rounded-[4px] border border-[#272b3a] space-y-3.5">
            <div>
              <span className="text-[11px] font-medium text-slate-400">Party Code</span>
              <div className="flex items-center justify-between mt-1 p-2 bg-[#0d0e12] border border-[#272b3a] rounded-[4px]">
                <span className="text-sm font-mono font-bold text-[#E50914] tracking-wider">
                  {createdParty.partyCode}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyToClipboard(createdParty.partyCode, false)}
                  leftIcon={isCopiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {isCopiedCode ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-400">Direct Invite Link</span>
              <div className="flex items-center justify-between mt-1 p-2 bg-[#0d0e12] border border-[#272b3a] rounded-[4px]">
                <span className="text-xs text-slate-400 truncate max-w-[170px]">
                  {inviteLink}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyToClipboard(inviteLink, true)}
                  leftIcon={isCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                >
                  {isCopiedLink ? 'Copied' : 'Copy Link'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => onEnterParty(createdParty)}
          className="w-full mt-6"
        >
          Enter Watch Party
        </Button>
      </div>
    );
  }

  // Create Form
  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-[#0d0e12] overflow-y-auto">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <IconButton size="sm" variant="ghost" onClick={onBack} tooltip="Go back">
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </IconButton>
          <h2 className="text-sm font-bold text-slate-100">Create a Watch Party</h2>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-[4px] bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Party Name"
            placeholder="e.g. Movie Night with Friends"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
          />

          <Input
            label="Optional Description"
            placeholder="e.g. Watching Stranger Things S4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Host lock option */}
          <div
            onClick={() => setOnlyHostCanControl(!onlyHostCanControl)}
            className="flex items-start gap-3 p-3 bg-[#14161d] border border-[#272b3a] rounded-[4px] cursor-pointer hover:border-[#353b4f] transition-colors"
          >
            <input
              type="checkbox"
              id="hostLock"
              checked={onlyHostCanControl}
              onChange={() => {}}
              className="mt-0.5 rounded-[2px] accent-[#E50914] cursor-pointer"
            />
            <div className="flex flex-col">
              <label htmlFor="hostLock" className="text-xs font-semibold text-slate-200 cursor-pointer">
                Host-Only Playback Controls
              </label>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Only you will be able to play, pause, or seek the video.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6">
        <Button
          variant="primary"
          size="lg"
          isLoading={isLoading}
          onClick={handleCreate}
          className="w-full"
        >
          Create Party
        </Button>
      </div>
    </div>
  );
};
