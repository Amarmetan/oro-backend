import React from 'react';
import { Compass, Wallet, PlaySquare, Briefcase, ShieldCheck } from 'lucide-react';
import { User } from '../types';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  activePurchasesCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  activePurchasesCount,
}) => {
  const isPartner = currentUser?.is_partner === 1;
  const isAdmin = currentUser?.is_admin === 1 || currentUser?.user_id === 7770001;

  const tabs: Array<{
    id: string;
    label: string;
    icon: any;
    badge?: number;
  }> = [
    { id: 'browse', label: 'Cinema', icon: Compass },
    {
      id: 'purchases',
      label: 'Library',
      icon: PlaySquare,
      badge: activePurchasesCount > 0 ? activePurchasesCount : undefined,
    },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    {
      id: 'partner',
      label: isPartner ? 'Studio' : 'Partner',
      icon: Briefcase,
    },
  ];

  // RBAC: Show the Admin tab ONLY if user is verified administrator
  if (isAdmin) {
    tabs.push({
      id: 'admin',
      label: 'Admin',
      icon: ShieldCheck,
    });
  }

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-40 bg-[#080A0F]/95 backdrop-blur-md border-t border-emerald-500/20 ${activeTab === 'admin' ? 'max-w-4xl' : 'max-w-md'} mx-auto`}>
      <div className="flex items-center justify-around py-2 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 relative transition active:scale-95 cursor-pointer ${
                isActive ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.2] text-emerald-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'stroke-[1.7]'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-emerald-500 text-zinc-950 text-[9px] font-black rounded-full min-w-[15px] text-center shadow shadow-emerald-500/40">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium tracking-tight ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-1 w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
