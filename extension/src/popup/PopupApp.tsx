import React, { useState, useEffect } from 'react';
import { Tv, ExternalLink, PlayCircle, Users, LogOut } from 'lucide-react';
import { StorageService } from '../services/storage/storage-service';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

export const PopupApp: React.FC = () => {
  const [isNetflix, setIsNetflix] = useState(false);
  const [activePartyCode, setActivePartyCode] = useState<string | null>(null);

  useEffect(() => {
    const checkState = async () => {
      const code = await StorageService.getActivePartyCode();
      setActivePartyCode(code);

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = tabs[0]?.url || '';
          setIsNetflix(url.includes('netflix.com'));
        });
      }
    };
    checkState();
  }, []);

  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.sidePanel.open({ tabId: tabs[0].id });
          window.close();
        }
      });
    }
  };

  const handleOpenNetflix = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'https://www.netflix.com' });
      window.close();
    }
  };

  const handleLeaveParty = async () => {
    await StorageService.setActivePartyCode(null);
    setActivePartyCode(null);
  };

  return (
    <div className="w-[320px] p-4 bg-[#0d0e12] text-slate-100 flex flex-col gap-3.5 select-none font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#272b3a]">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-6 h-6 object-contain rounded-[2px] shrink-0"
          />
          <span className="font-bold text-xs tracking-tight">Netflix Watch Party</span>
        </div>
        <Badge variant={isNetflix ? 'success' : 'neutral'} size="sm" dot>
          {isNetflix ? 'Netflix Ready' : 'Not on Netflix'}
        </Badge>
      </div>

      {/* Party Status Box */}
      <div className="bg-[#14161d] p-3 rounded-[4px] border border-[#272b3a] flex flex-col gap-1.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          Current Session
        </span>
        {activePartyCode ? (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Active Room: <span className="font-mono text-[#E50914]">{activePartyCode}</span>
            </span>
            <button
              onClick={handleLeaveParty}
              className="text-[10px] text-rose-400 hover:text-rose-300 underline"
            >
              Leave
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No active watch party session.</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          variant="primary"
          size="md"
          onClick={handleOpenSidePanel}
          leftIcon={<PlayCircle className="w-4 h-4" />}
          className="w-full"
        >
          Open Watch Party Panel
        </Button>

        {!isNetflix && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleOpenNetflix}
            leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
            className="w-full"
          >
            Launch Netflix
          </Button>
        )}
      </div>

      <div className="text-center pt-1 border-t border-[#272b3a]">
        <p className="text-[10px] text-slate-600">
          Click extension icon or press Alt+Shift+W
        </p>
      </div>
    </div>
  );
};
