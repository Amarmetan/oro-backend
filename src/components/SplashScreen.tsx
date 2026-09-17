import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { OroLogo } from './OroLogo';
import { Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  customLogoUrl?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, customLogoUrl }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 2.4-second progress animation to achieve 2-3 second auto-transition
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
          }, 200);
          return 100;
        }
        return prev + 4;
      });
    }, 70);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#080A0F] text-white overflow-hidden select-none px-6 py-10"
      >
        {/* Subtle Ambient Radial Glow (Vibrant Emerald / Green Brand Accents) */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 h-32 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header info / Skip button */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold tracking-wider">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>TELEGRAM MINI APP</span>
          </div>

          <button
            onClick={onComplete}
            className="text-xs text-zinc-400 hover:text-emerald-400 px-3 py-1 rounded-full hover:bg-zinc-800/60 transition-colors font-medium cursor-pointer"
          >
            Skip &rarr;
          </button>
        </div>

        {/* Center: Hero Logo Animation */}
        <div className="flex flex-col items-center justify-center my-auto z-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-6"
          >
            {/* Animated Glow Halo */}
            <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl animate-pulse pointer-events-none" />
            
            <div className="relative p-6 rounded-3xl bg-[#0E121A]/80 border border-emerald-500/30 backdrop-blur-md shadow-[0_0_30px_rgba(34,197,94,0.2)]">
              <OroLogo size="xl" customLogoUrl={customLogoUrl} animated={true} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="space-y-1.5"
          >
            <h1 className="text-xl font-bold tracking-tight text-white font-serif">
              ORO RECORDS
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs font-medium tracking-wide">
              Official Afan Oromo Cinema & Entertainment Network
            </p>
          </motion.div>
        </div>

        {/* Bottom Loading Progress Indicator */}
        <div className="w-full max-w-xs flex flex-col items-center gap-3 z-10">
          {/* Custom Spinner / Progress Bar */}
          <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden p-0.5 border border-emerald-500/20">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-300 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.6)]"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          <div className="flex items-center justify-between w-full text-[11px] text-zinc-400 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Initializing Cinema Hub...
            </span>
            <span className="font-mono text-emerald-400 font-bold">{progress}%</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
