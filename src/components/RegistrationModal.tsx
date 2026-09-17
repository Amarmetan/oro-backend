import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Phone, Globe, CheckCircle2, AlertCircle, Loader2, Gift } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { User as UserType } from '../types';
import { OroLogo } from './OroLogo';

interface RegistrationModalProps {
  currentUser: UserType | null;
  onRegistered: (updatedUser: UserType) => void;
  customLogoUrl?: string;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  currentUser,
  onRegistered,
  customLogoUrl,
}) => {
  const [firstName, setFirstName] = useState(
    currentUser?.first_name && currentUser.first_name !== 'New' && currentUser.first_name !== 'Guest'
      ? currentUser.first_name
      : ''
  );
  const [lastName, setLastName] = useState(
    currentUser?.last_name && currentUser.last_name !== 'Visitor' ? currentUser.last_name : ''
  );
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone_number || '+251 9');
  const [username, setUsername] = useState(
    currentUser?.username ? currentUser.username.replace(/^user_\d+$/, '') : ''
  );
  const [preferredLanguage, setPreferredLanguage] = useState<string>(
    currentUser?.preferred_language || 'Afan Oromo'
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCelebration, setSuccessCelebration] = useState(false);

  const languages = [
    { id: 'Afan Oromo', label: 'Afaan Oromoo', native: 'Afaan Oromoo' },
    { id: 'Amharic', label: 'Amharic', native: 'አማርኛ' },
    { id: 'English', label: 'English', native: 'English' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim()) {
      setErrorMessage('Please enter your first name.');
      return;
    }

    if (!phoneNumber.trim() || phoneNumber.trim().length < 9) {
      setErrorMessage('Please enter a valid Ethiopian mobile number (e.g., +251 9... or 09...).');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.registerUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim(),
        username: username.trim() || undefined,
        preferred_language: preferredLanguage,
      });

      if (res.success && res.user) {
        setSuccessCelebration(true);
        setTimeout(() => {
          onRegistered(res.user!);
        }, 1200);
      } else {
        setErrorMessage(res.message || 'Registration failed. Please check details.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080A0F]/95 backdrop-blur-xl px-4 py-6 overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0E121A] border border-emerald-500/30 rounded-2xl shadow-2xl p-6 text-white overflow-hidden my-auto"
      >
        {/* Top Header Glow Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-600" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="p-3 rounded-2xl bg-zinc-900/90 border border-emerald-500/20 mb-3 shadow-inner">
            <OroLogo size="lg" customLogoUrl={customLogoUrl} />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white font-serif">
            Member Registration
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Complete your ORO RECORDS account profile to unlock direct Telegram streaming and instant Ethiopian wallet deposits.
          </p>
        </div>

        {/* Welcome Bonus Callout */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 mb-5 text-xs text-emerald-300">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Gift className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-semibold text-emerald-400">Welcome Bonus</div>
            <div className="text-[11px] text-zinc-400">Receive 25 Cinema Points to redeem for movie discounts!</div>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successCelebration ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-10 text-center space-y-3"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-white">Welcome to ORO RECORDS!</h3>
            <p className="text-xs text-zinc-400">Your profile is verified. Entering cinema store...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  First Name <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Dawit"
                    className="w-full bg-[#141A24] border border-zinc-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Gemeda"
                  className="w-full bg-[#141A24] border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Phone Number (Telebirr / CBE) <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+251 911 234567"
                  className="w-full bg-[#141A24] border border-zinc-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Used to verify automatic deposit confirmations from Telebirr & CBE.
              </p>
            </div>

            {/* Telegram Username */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Telegram Handle
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full bg-[#141A24] border border-zinc-700/80 rounded-xl pl-7 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Preferred Language */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Preferred Cinema Language</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {languages.map((lang) => {
                  const active = preferredLanguage === lang.id;
                  return (
                    <button
                      type="button"
                      key={lang.id}
                      onClick={() => setPreferredLanguage(lang.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-all ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                          : 'bg-[#141A24] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <span className="text-xs">{lang.label}</span>
                      <span className="text-[10px] text-zinc-500">{lang.native}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-zinc-950 font-bold text-xs tracking-wider uppercase transition-all shadow-[0_4px_20px_rgba(34,197,94,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering Profile...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
