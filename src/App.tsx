import React, { useState, useEffect, useCallback } from 'react';
import { Movie, Purchase, User, UserProfileResponse } from './types';
import { api, getActiveUserId } from './lib/apiClient';
import { TelegramHeader } from './components/TelegramHeader';
import { Navigation } from './components/Navigation';
import { HomeBrowseScreen } from './components/HomeBrowseScreen';
import { MovieDetailModal } from './components/MovieDetailModal';
import { WalletScreen } from './components/WalletScreen';
import { PurchasesScreen } from './components/PurchasesScreen';
import { PartnerScreen } from './components/PartnerScreen';
import { AdminScreen } from './components/AdminScreen';
import { SplashScreen } from './components/SplashScreen';
import { RegistrationModal } from './components/RegistrationModal';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('browse');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileResponse | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('/logo.svg');

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Load user data
  const loadUserData = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (res.success) {
        setCurrentUser(res.user);
        setUserProfile(res);
      }
    } catch (err) {
      console.error('Failed to load user profile', err);
    }
  }, []);

  // Load movies
  const loadMovies = useCallback(async () => {
    try {
      const res = await api.getMovies({
        category: selectedCategory,
        search: searchQuery,
      });
      if (res.success) {
        setMovies(res.movies);
        if (res.categories && res.categories.length > 0) {
          setCategories(res.categories);
        }
      }
    } catch (err) {
      console.error('Failed to load movies', err);
    }
  }, [selectedCategory, searchQuery]);

  // Load branding info
  const loadBranding = useCallback(async () => {
    try {
      const res = await api.getBranding();
      if (res.success && res.logo_url) {
        setCustomLogoUrl(res.logo_url);
      }
    } catch (err) {
      console.error('Failed to load branding', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadUserData();
    loadMovies();
    loadBranding();

    // Listen for custom persona change events
    const handleUserChanged = () => {
      loadUserData();
      loadMovies();
    };

    window.addEventListener('oro_user_changed', handleUserChanged);
    return () => window.removeEventListener('oro_user_changed', handleUserChanged);
  }, [loadUserData, loadMovies, loadBranding]);

  // Handle folder purchase
  const handlePurchaseFolder = async (category: string) => {
    try {
      const res = await api.purchaseFolder(category);
      if (res.success) {
        showToast(res.message, 'success');
        loadUserData();
        loadMovies();
      } else {
        showToast(res.message, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Folder bundle purchase failed', 'info');
    }
  };

  // Check whether registration is mandatory for current user
  const isRegistrationRequired = currentUser !== null && currentUser.is_registered === 0;

  return (
    <div className="min-h-screen bg-[#06080D] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      {/* Intro Splash Screen */}
      {showSplash && (
        <SplashScreen
          onComplete={() => setShowSplash(false)}
          customLogoUrl={customLogoUrl}
        />
      )}

      {/* Mandatory Onboarding & User Registration Modal */}
      {!showSplash && isRegistrationRequired && (
        <RegistrationModal
          currentUser={currentUser}
          customLogoUrl={customLogoUrl}
          onRegistered={(updatedUser) => {
            setCurrentUser(updatedUser);
            loadUserData();
            showToast('Welcome to ORO RECORDS! Profile created & 25 bonus points credited.', 'success');
          }}
        />
      )}

      {/* Container simulating Telegram WebApp viewport frame on desktop or native full-width on mobile */}
      <div
        className={`w-full ${
          activeTab === 'admin' ? 'max-w-4xl' : 'max-w-md'
        } mx-auto min-h-screen bg-[#080A0F] border-x border-zinc-900 shadow-2xl flex flex-col relative transition-all duration-300`}
      >
        {/* Telegram Header & Persona Switcher */}
        <TelegramHeader
          currentUser={currentUser}
          onRefresh={() => {
            loadUserData();
            loadMovies();
          }}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'admin') {
              if (currentUser?.is_admin === 1 || currentUser?.user_id === 7770001) {
                setActiveTab('admin');
              } else {
                showToast('Admin clearance required. Only authorized managers can access this view.', 'info');
              }
            } else {
              setActiveTab(tab);
            }
          }}
          onReplayIntro={() => setShowSplash(true)}
          customLogoUrl={customLogoUrl}
        />

        {/* Global Toast Alert */}
        {toastMessage && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 text-zinc-950 font-extrabold text-xs rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-300 animate-in fade-in slide-in-from-top-4">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="flex-1">{toastMessage.text}</span>
              <button
                onClick={() => setToastMessage(null)}
                className="opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-3.5 overflow-y-auto">
          {activeTab === 'browse' && (
            <HomeBrowseScreen
              movies={movies}
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectMovie={(m) => setSelectedMovie(m)}
              onPurchaseFolder={handlePurchaseFolder}
              currentUser={currentUser}
              onGoToWallet={() => setActiveTab('wallet')}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchasesScreen
              purchases={userProfile?.purchases || []}
              currentUser={currentUser}
              onRefresh={loadUserData}
              onBrowseMore={() => setActiveTab('browse')}
            />
          )}

          {activeTab === 'wallet' && (
            <WalletScreen
              currentUser={currentUser}
              onRefresh={() => {
                loadUserData();
                loadMovies();
              }}
            />
          )}

          {activeTab === 'partner' && (
            <PartnerScreen
              currentUser={currentUser}
              onRefresh={() => {
                loadUserData();
                loadMovies();
              }}
            />
          )}

          {activeTab === 'admin' && (
            currentUser?.is_admin === 1 || currentUser?.user_id === 7770001 ? (
              <AdminScreen
                currentUser={currentUser}
                onRefresh={() => {
                  loadUserData();
                  loadMovies();
                }}
                onExitPortal={() => setActiveTab('browse')}
              />
            ) : (
              <div className="bg-[#0E121A] border border-red-500/40 rounded-2xl p-6 text-center space-y-3 my-8">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-base font-black text-white uppercase">
                  Admin Authorization Required
                </h2>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  This command portal is restricted to ORO RECORDS administrative staff and platform owners.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      // Switch to Demo Admin (ID: 7770001)
                      import('./lib/apiClient').then(({ setActiveUserId }) => {
                        setActiveUserId(7770001);
                        loadUserData();
                        loadMovies();
                      });
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-xl shadow transition cursor-pointer"
                  >
                    Switch to Admin Persona (7770001 - @oroadmin)
                  </button>
                  <button
                    onClick={() => setActiveTab('browse')}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Back to Cinema Storefront
                  </button>
                </div>
              </div>
            )
          )}
        </main>

        {/* Movie Detail Modal */}
        {selectedMovie && (
          <MovieDetailModal
            movieId={selectedMovie.id}
            currentUser={currentUser}
            onClose={() => setSelectedMovie(null)}
            onPurchaseSuccess={(msg) => {
              showToast(msg, 'success');
              loadUserData();
              loadMovies();
            }}
            onGoToWallet={() => setActiveTab('wallet')}
          />
        )}

        {/* Bottom Navigation Tab Bar */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'admin') {
              if (currentUser?.is_admin === 1 || currentUser?.user_id === 7770001) {
                setActiveTab('admin');
              } else {
                showToast('Admin clearance required. Only authorized managers can access this view.', 'info');
              }
            } else {
              setActiveTab(tab);
            }
          }}
          currentUser={currentUser}
          activePurchasesCount={userProfile?.active_purchases_count || 0}
        />
      </div>
    </div>
  );
}
