import React, { useState, useEffect } from 'react';
import { Movie, Purchase, User } from '../types';
import { api } from '../lib/apiClient';
import {
  X,
  Play,
  Film,
  Clock,
  Globe,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Crown,
  Share2,
  ExternalLink,
  Lock,
  Wallet,
} from 'lucide-react';

interface MovieDetailModalProps {
  movieId: number;
  onClose: () => void;
  currentUser: User | null;
  onPurchaseSuccess: (message: string) => void;
  onGoToWallet: () => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  movieId,
  onClose,
  currentUser,
  onPurchaseSuccess,
  onGoToWallet,
}) => {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [userPurchase, setUserPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseType, setPurchaseType] = useState<'rental' | 'lifetime'>('rental');
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    api.getMovie(movieId)
      .then((res) => {
        if (res.success && res.movie) {
          setMovie(res.movie);
          setUserPurchase(res.user_purchase || null);
        } else {
          setErrorMsg(res.message || 'Failed to load movie details');
        }
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [movieId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#0E121A] border border-emerald-500/30 rounded-2xl p-6 text-center text-white max-w-sm w-full">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-zinc-300">Retrieving ORO master reel...</p>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#0E121A] border border-red-500/30 rounded-2xl p-6 text-center text-white max-w-sm w-full">
          <p className="text-sm text-red-400 font-semibold mb-3">{errorMsg || 'Movie not found'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 text-xs rounded-xl font-bold hover:bg-zinc-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isVip = currentUser?.is_vip === 1;
  const hasActiveAccess = userPurchase && (!userPurchase.expires_at || !userPurchase.is_expired);

  // Compute calculated prices
  const basePrice = isVip ? movie.vip_price : (movie.discount_percent > 0 ? movie.regular_price * (1 - movie.discount_percent / 100) : movie.regular_price);
  const rentalPrice = Math.round(basePrice * 100) / 100;
  const lifetimePrice = Math.round(basePrice * 1.6 * 100) / 100;
  const activeSelectedPrice = purchaseType === 'rental' ? rentalPrice : lifetimePrice;

  const userBalance = currentUser?.balance ?? 0;
  const canAfford = userBalance >= activeSelectedPrice;

  const handlePurchase = async () => {
    setErrorMsg(null);
    setPurchasing(true);

    try {
      const res = await api.purchaseMovie(movie.id, purchaseType);
      if (res.success) {
        onPurchaseSuccess(res.message);
        // Refresh movie purchase state
        const updated = await api.getMovie(movie.id);
        if (updated.success) {
          setUserPurchase(updated.user_purchase || null);
        }
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#0D111A] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto text-white shadow-2xl relative animate-in slide-in-from-bottom-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/60 text-gray-300 hover:text-white border border-gray-700/50 backdrop-blur-md transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Video Player or Poster Backdrop */}
        <div className="relative aspect-video w-full bg-black overflow-hidden">
          {isPlayingTrailer ? (
            <div className="relative w-full h-full">
              <video
                src={movie.trailer_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setIsPlayingTrailer(false)}
                className="absolute top-3 left-3 z-20 px-2 py-1 bg-black/70 text-xs rounded-md text-amber-300 font-medium"
              >
                Back to Poster
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D111A] via-black/40 to-black/20" />
              
              {/* Play Trailer CTA */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => setIsPlayingTrailer(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/90 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/30 transition transform hover:scale-105 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Preview Official Trailer
                </button>
              </div>

              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded bg-black/70 border border-amber-500/40 text-amber-300 font-mono font-bold">
                  {movie.quality}
                </span>
                <span className="px-2 py-0.5 rounded bg-black/70 text-gray-300 font-semibold">
                  {movie.release_year} • {movie.category}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="p-4 space-y-4">
          {/* Header & Badges */}
          <div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {movie.badges?.map((badge, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider"
                >
                  {badge}
                </span>
              ))}
            </div>

            <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: 'Cinzel, serif' }}>
              {movie.title}
            </h2>
            {movie.original_title && (
              <p className="text-xs text-amber-400 font-semibold italic">
                Original Title: {movie.original_title}
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">
              Curated by <span className="text-gray-300 font-medium">{movie.partner_name || 'ORO RECORDS'}</span>
            </p>
          </div>

          {/* Synopsis */}
          <div className="text-xs text-gray-300 leading-relaxed bg-[#141924] p-3 rounded-xl border border-gray-800/80">
            {movie.description}
          </div>

          {/* Film Specs */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300 bg-[#121620] p-3 rounded-xl border border-gray-800/60">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Languages: <strong className="text-white">{movie.languages}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Rental Window: <strong className="text-white">{movie.rental_duration_hours} Hours</strong></span>
            </div>
          </div>

          {/* Ownership Status Banner if already purchased */}
          {hasActiveAccess ? (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ACCESS UNLOCKED
                </span>
                <span className="font-mono text-[11px]">
                  {userPurchase?.purchase_type === 'lifetime' ? 'Permanent Ownership' : 'Rental Active'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                {userPurchase?.time_left || 'Ready to watch immediately on your device or via Telegram.'}
              </p>

              <div className="pt-2 flex items-center gap-2">
                <a
                  href={`https://t.me/OroRecordsBot?start=watch_${movie.file_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-lg text-center flex items-center justify-center gap-1.5 transition shadow"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Stream on Telegram Bot
                </a>
              </div>
            </div>
          ) : (
            /* Purchase Box */
            <div className="space-y-3 bg-[#11151F] p-3 rounded-xl border border-emerald-500/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                  Select Access Type
                </span>
                {isVip && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                    <Crown className="w-3 h-3" /> VIP Rate Applied
                  </span>
                )}
              </div>

              {/* Rental vs Lifetime Radio Cards */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPurchaseType('rental')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    purchaseType === 'rental'
                      ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-sm'
                      : 'bg-[#0E121B] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">72h Rental</span>
                    <Clock className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="mt-1 text-base font-black font-mono text-emerald-400">
                    {rentalPrice} <span className="text-[10px] text-zinc-300">ETB</span>
                  </div>
                  <div className="text-[9px] text-zinc-400">Stream anytime for 3 days</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPurchaseType('lifetime')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    purchaseType === 'lifetime'
                      ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-sm'
                      : 'bg-[#0E121B] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Lifetime Pass</span>
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="mt-1 text-base font-black font-mono text-emerald-400">
                    {lifetimePrice} <span className="text-[10px] text-zinc-300">ETB</span>
                  </div>
                  <div className="text-[9px] text-zinc-400">Never expires + downloads</div>
                </button>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-2 bg-red-950/60 border border-red-500/40 text-red-300 text-xs rounded-lg">
                  {errorMsg}
                </div>
              )}

              {/* Balance Summary & Action Button */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px] mb-2 text-zinc-300">
                  <span>Your Current Wallet:</span>
                  <span className="font-mono font-bold text-white">
                    {userBalance.toFixed(2)} ETB
                  </span>
                </div>

                {canAfford ? (
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 hover:from-emerald-400 hover:to-green-400 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {purchasing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        Authorizing Atomic Ledger...
                      </span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Confirm & Unlock ({activeSelectedPrice} ETB)
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] flex items-center justify-between">
                      <span>Insufficient balance ({userBalance.toFixed(2)} ETB)</span>
                      <span className="font-bold">Need {(activeSelectedPrice - userBalance).toFixed(2)} ETB more</span>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onGoToWallet();
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Deposit with Telebirr / CBE
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
