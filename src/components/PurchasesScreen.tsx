import React, { useState } from 'react';
import { Purchase, User } from '../types';
import {
  PlaySquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Film,
  ExternalLink,
  Play,
  Download,
  Sparkles,
  RefreshCw,
  FolderCheck,
} from 'lucide-react';

interface PurchasesScreenProps {
  purchases: Purchase[];
  currentUser: User | null;
  onRefresh: () => void;
  onBrowseMore: () => void;
}

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({
  purchases,
  currentUser,
  onRefresh,
  onBrowseMore,
}) => {
  const [selectedMovieForStream, setSelectedMovieForStream] = useState<Purchase | null>(null);

  const activePurchases = purchases.filter((p) => !p.is_expired);
  const expiredPurchases = purchases.filter((p) => p.is_expired);

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white" style={{ fontFamily: 'Cinzel, serif' }}>
            My Cinema Vault
          </h2>
          <p className="text-xs text-gray-400">
            {activePurchases.length} Active Film Licenses
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-[#141924] border border-gray-800 text-gray-400 hover:text-white transition"
          title="Refresh Library"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Embedded In-App Stream Player Modal */}
      {selectedMovieForStream && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-[#0D111A] border border-amber-500/40 rounded-2xl max-w-lg w-full overflow-hidden text-white shadow-2xl">
            <div className="p-3 bg-gradient-to-r from-amber-950/60 to-[#121622] flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold truncate max-w-[240px]">
                  {selectedMovieForStream.movie_title}
                </span>
              </div>
              <button
                onClick={() => setSelectedMovieForStream(null)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800/60"
              >
                ✕ Close
              </button>
            </div>

            <div className="aspect-video bg-black relative">
              <video
                src="https://www.w3schools.com/html/mov_bbb.mp4"
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  {selectedMovieForStream.quality || '1080p FHD'}
                </span>
                <span className="text-gray-400">
                  {selectedMovieForStream.time_left}
                </span>
              </div>

              <p className="text-[11px] text-gray-300">
                You have authorized playback rights. To receive this master file inside Telegram for offline saving, click below.
              </p>

              <a
                href={`https://t.me/OroRecordsBot?start=watch_${selectedMovieForStream.file_id || 'sample'}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow"
              >
                <ExternalLink className="w-4 h-4" />
                Send File to My Telegram Chat
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {purchases.length === 0 ? (
        <div className="text-center py-16 bg-[#121620] rounded-2xl border border-gray-800 p-6 space-y-3">
          <PlaySquare className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-sm font-bold text-gray-200">Your Vault is Empty</h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Rent individual movies for 72 hours, purchase lifetime access, or grab complete category bundles.
          </p>
          <button
            onClick={onBrowseMore}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition shadow"
          >
            Explore Cinema Catalog →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Rentals & Lifetime Ownership */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Active Access ({activePurchases.length})
              </h3>
            </div>

            <div className="space-y-2.5">
              {activePurchases.map((purchase) => {
                const isLifetime = purchase.purchase_type === 'lifetime' || purchase.purchase_type === 'folder';

                return (
                  <div
                    key={purchase.id}
                    className="p-3 bg-[#121620] border border-amber-500/20 hover:border-amber-500/40 rounded-xl flex items-center justify-between gap-3 transition shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-20 rounded-lg overflow-hidden bg-gray-900 shrink-0 border border-gray-800 relative">
                        {purchase.poster_url ? (
                          <img
                            src={purchase.poster_url}
                            alt={purchase.movie_title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-6 h-6 text-gray-600 m-auto" />
                        )}
                        {isLifetime && (
                          <div className="absolute top-1 left-1">
                            <span className="p-0.5 rounded bg-amber-500 text-black block">
                              <Sparkles className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-amber-400 font-bold uppercase">
                            {purchase.category || 'Film'}
                          </span>
                          {purchase.purchase_type === 'folder' && (
                            <span className="text-[9px] px-1 rounded bg-purple-500/30 text-purple-300 font-bold">
                              BUNDLE
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-white truncate">
                          {purchase.movie_title}
                        </h4>

                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          {isLifetime ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Lifetime Access
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-300">
                              <Clock className="w-3 h-3 text-amber-400" /> {purchase.time_left}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => setSelectedMovieForStream(purchase)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 text-black font-extrabold text-xs rounded-lg flex items-center gap-1 shadow transition active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Stream
                      </button>

                      <a
                        href={`https://t.me/OroRecordsBot?start=watch_${purchase.file_id || 'sample'}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-[#1A202C] hover:bg-gray-700 text-gray-300 text-[10px] font-bold rounded-lg text-center flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Telegram
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expired Purchases Archive */}
          {expiredPurchases.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Expired Rentals ({expiredPurchases.length})
              </h3>
              <div className="space-y-2 opacity-70">
                {expiredPurchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="p-2.5 bg-[#0E121A] border border-gray-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-gray-300">{purchase.movie_title}</div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" /> 72-hour rental period ended
                      </div>
                    </div>

                    <button
                      onClick={onBrowseMore}
                      className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold"
                    >
                      Renew
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
