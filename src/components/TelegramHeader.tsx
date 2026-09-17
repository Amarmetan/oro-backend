import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getActiveUserId, setActiveUserId, apiClient } from '../lib/apiClient';
import { Users, Crown, ShieldAlert, Sparkles, ChevronDown, Check, RefreshCw, UserX, UserCheck, ShieldCheck } from 'lucide-react';
import { OroLogo } from './OroLogo';

interface TelegramHeaderProps {
  currentUser: User | null;
  onRefresh: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  customLogoUrl?: string;
  onReplayIntro?: () => void;
}

export const TelegramHeader: React.FC<TelegramHeaderProps> = ({
  currentUser,
  onRefresh,
  activeTab,
  setActiveTab,
  customLogoUrl,
  onReplayIntro,
}) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [isTelegramClient, setIsTelegramClient] = useState(false);

  useEffect(() => {
    // Check if running inside native Telegram WebApp client
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
      setIsTelegramClient(true);
      try {
        (window as any).Telegram.WebApp.ready();
        (window as any).Telegram.WebApp.expand();
      } catch (e) {
        console.warn('Telegram WebApp SDK init error', e);
      }
    }

    // Load available test personas for the preview mode switcher
    apiClient.getUsers().then((res) => {
      if (res.success) {
        setAvailableUsers(res.users);
      }
    }).catch(console.error);
  }, []);

  const handleSelectPersona = (id: number) => {
    setActiveUserId(id);
    setShowPersonaMenu(false);
    onRefresh();
  };

  const activeUserId = getActiveUserId();
  const isAdmin = currentUser?.is_admin === 1 || currentUser?.user_id === 7770001;

  const handleAdminToggle = () => {
    if (activeTab === 'admin') {
      setActiveTab('browse');
    } else {
      if (isAdmin) {
        setActiveTab('admin');
      }
    }
  };

  // Determine current mode for preview testing
  const isUnregistered = currentUser?.is_registered === 0;

  return (
    <header className="sticky top-0 z-40 bg-[#080A0F]/95 backdrop-blur-md border-b border-emerald-500/20 text-white">
      {/* Mini App Status Bar & Preview Testing Controls */}
      <div className="px-3 py-1.5 bg-gradient-to-r from-[#0E131D] via-[#121824] to-[#0A0D14] text-xs flex flex-wrap items-center justify-between gap-1.5 border-b border-emerald-500/10">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-wider text-[10px] uppercase font-mono">
            {isTelegramClient ? 'Telegram WebApp' : 'PREVIEW SIMULATOR'}
          </span>
          {onReplayIntro && (
            <button
              onClick={onReplayIntro}
              className="text-[10px] text-zinc-400 hover:text-emerald-400 underline decoration-emerald-500/40 ml-1 cursor-pointer"
              title="Replay Intro / Splash Animation"
            >
              Intro
            </button>
          )}
        </div>

        {/* Preview Testing Controls: 3 Modes requested by User */}
        <div className="flex items-center gap-1.5">
          {/* 1. Unregistered User Mode */}
          <button
            onClick={() => handleSelectPersona(5550001)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition active:scale-95 cursor-pointer ${
              activeUserId === 5550001 || isUnregistered
                ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-sm'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:text-amber-400 hover:border-amber-500/40'
            }`}
            title="Test Onboarding / Mandatory Registration Modal"
          >
            <UserX className="w-2.5 h-2.5" />
            <span>Unregistered</span>
          </button>

          {/* 2. Registered Buyer Mode */}
          <button
            onClick={() => {
              handleSelectPersona(9990003);
              if (activeTab === 'admin') setActiveTab('browse');
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition active:scale-95 cursor-pointer ${
              activeUserId === 9990003 && !isAdmin
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:text-emerald-400 hover:border-emerald-500/40'
            }`}
            title="Test Normal Buyer View (Admin panel is strictly hidden)"
          >
            <UserCheck className="w-2.5 h-2.5" />
            <span>Buyer</span>
          </button>

          {/* 3. Authorized Admin Mode */}
          <button
            onClick={() => {
              handleSelectPersona(7770001);
              setActiveTab('admin');
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition active:scale-95 cursor-pointer ${
              isAdmin && activeUserId === 7770001
                ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:text-purple-400 hover:border-purple-500/40'
            }`}
            title="Switch to Authorized Admin mode (Full access & CMS)"
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>Admin</span>
          </button>

          {/* Full Persona Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              className="p-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700 transition"
              title="Select all test personas"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {showPersonaMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-[#0E121A] border border-emerald-500/30 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center justify-between">
                  <span>Preview Personas</span>
                  <span className="text-[9px] text-emerald-400 font-mono">RBAC Test</span>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {availableUsers.map((u) => {
                    const isSelected = u.user_id === activeUserId;
                    return (
                      <button
                        key={u.user_id}
                        onClick={() => handleSelectPersona(u.user_id)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between transition text-xs hover:bg-emerald-500/10 ${
                          isSelected ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-200'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span>{u.first_name} {u.last_name}</span>
                            {u.is_admin === 1 && (
                              <span className="px-1.5 py-0.2 bg-purple-500/30 text-purple-300 rounded text-[9px] font-bold">ADMIN</span>
                            )}
                            {u.is_partner === 1 && (
                              <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-300 rounded text-[9px] font-bold">STUDIO</span>
                            )}
                            {u.is_registered === 0 && (
                              <span className="px-1.5 py-0.2 bg-amber-500/30 text-amber-300 rounded text-[9px] font-bold">UNREGISTERED</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400">
                            @{u.username} • Balance: <span className="text-emerald-400 font-mono font-medium">{u.balance.toFixed(2)} ETB</span>
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main App Bar with Custom Logo */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('browse')}>
          <OroLogo size="md" customLogoUrl={customLogoUrl} />
        </div>

        {/* Action Controls: Admin Portal button ONLY visible if user is Authorized Admin */}
        <div className="flex items-center gap-2">
          {/* STRICT RBAC: Only shown if user has is_admin === 1 or is whitelisted */}
          {isAdmin && (
            <button
              onClick={handleAdminToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 shadow-md border cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-950/40'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-900/50'
              }`}
              title="Access Admin CMS & Review Portal"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeTab === 'admin' ? 'Store View' : 'Admin Portal'}</span>
            </button>
          )}

          {/* Quick Wallet Pill */}
          {currentUser && currentUser.is_registered !== 0 && (
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition active:scale-95 shadow-sm cursor-pointer ${
                activeTab === 'wallet'
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold'
                  : 'bg-[#121620] text-zinc-200 border-emerald-500/30 hover:border-emerald-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-xs font-bold">
                {currentUser.balance.toFixed(2)} <span className="text-[10px] opacity-80">ETB</span>
              </span>
              {currentUser.is_vip === 1 && (
                <Crown className="w-3 h-3 text-emerald-400 ml-0.5" />
              )}
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 border border-zinc-700/50 transition active:rotate-180 cursor-pointer"
            title="Refresh balance and catalog"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
