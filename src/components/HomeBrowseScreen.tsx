import React, { useState, useEffect } from 'react';
import { Movie, User, Announcement } from '../types';
import { api } from '../lib/apiClient';
import {
  Search,
  Sparkles,
  FolderDown,
  Play,
  Star,
  Film,
  Flame,
  ShieldAlert,
  Tag,
  Megaphone,
  Send,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface HomeBrowseScreenProps {
  movies: Movie[];
  categories: { category: string; count: number }[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectMovie: (movie: Movie) => void;
  onPurchaseFolder: (category: string) => void;
  currentUser: User | null;
  onGoToWallet: () => void;
}

export const HomeBrowseScreen: React.FC<HomeBrowseScreenProps> = ({
  movies,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  onSelectMovie,
  onPurchaseFolder,
  currentUser,
  onGoToWallet,
}) => {
  const [folderConfirmCategory, setFolderConfirmCategory] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    api.getAnnouncements().then((res) => {
      if (res.success && res.announcements) {
        setAnnouncements(res.announcements);
      }
    });
  }, []);

  const isVip = currentUser?.is_vip === 1;

  // Calculate folder bundle savings for selected category
  const activeCategoryMovies = movies.filter((m) =>
    selectedCategory === 'All' ? true : m.category === selectedCategory
  );

  const categoryForBundle = selectedCategory !== 'All' ? selectedCategory : 'Oromo Cultural';
  const bundleTargetMovies = movies.filter((m) => m.category === categoryForBundle);
  const bundleSumRegular = bundleTargetMovies.reduce((acc, m) => acc + m.regular_price, 0);
  const bundlePrice = Math.round(bundleSumRegular * 0.6); // 40% OFF

  return (
    <div className="space-y-4 pb-20">
      {/* Published Announcements & Media Teasers */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.slice(0, 2).map((ann) => (
            <div
              key={ann.id}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/80 via-[#151221] to-[#0D1017] border border-purple-500/40 p-3.5 shadow-lg"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Megaphone className="w-3 h-3 text-purple-400" /> {ann.badge || 'PROMO'}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">{ann.created_at}</span>
              </div>

              <h3 className="text-xs font-black text-white">{ann.title}</h3>
              <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">{ann.content}</p>

              {ann.media_url && (
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-800 max-h-36 bg-black/40">
                  <img
                    src={ann.media_url}
                    alt="Announcement media"
                    className="w-full h-auto max-h-36 object-cover"
                  />
                </div>
              )}

              {ann.action_link && (
                <div className="mt-2.5 flex justify-end">
                  <a
                    href={ann.action_link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-black text-[11px] rounded-lg flex items-center gap-1 transition shadow active:scale-95"
                  >
                    <Send className="w-3 h-3" /> Open in Telegram Bot <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hero Banner with VIP or Featured Release */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950/80 via-[#0E131D] to-[#080A0F] border border-emerald-500/30 p-4 shadow-xl">
        <div className="absolute -right-8 -top-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider uppercase">
            <Flame className="w-3 h-3 text-emerald-400" />
            Spotlight Premiere
          </div>
          {isVip ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-zinc-950 font-extrabold flex items-center gap-1 shadow-sm">
              <Star className="w-3 h-3 fill-current" /> VIP PRIVILEGE ACTIVE
            </span>
          ) : (
            <button
              onClick={onGoToWallet}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              Get VIP Pass (50% Off) →
            </button>
          )}
        </div>

        <h2 className="text-lg font-black text-white tracking-tight font-serif">
          Hunda Dura (Before Everything)
        </h2>
        <p className="text-xs text-zinc-300 mt-1 line-clamp-2 leading-relaxed">
          The landmark Oromo historical drama now streaming in master 4K UHD. Distributed officially via ORO RECORDS.
        </p>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-emerald-400 font-mono">
              {isVip ? '35 ETB' : '48 ETB'}
            </span>
            <span className="text-[10px] text-zinc-400 line-through">60 ETB</span>
            <span className="text-[9px] bg-red-500/30 text-red-300 border border-red-500/40 px-1 rounded font-bold">
              20% OFF
            </span>
          </div>

          <button
            onClick={() => {
              const feat = movies.find((m) => m.id === 1) || movies[0];
              if (feat) onSelectMovie(feat);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Watch Preview
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, original Oromo name, genre..."
          className="w-full pl-9 pr-4 py-2 bg-[#0E121A] text-zinc-200 placeholder-zinc-500 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500/60 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Categories Horizontal Scroll */}
      <div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition shrink-0 cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'bg-[#121622] text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            All Films ({movies.length})
          </button>

          {categories.map((c) => {
            const isSelected = selectedCategory === c.category;
            return (
              <button
                key={c.category}
                onClick={() => setSelectedCategory(c.category)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 font-bold'
                    : 'bg-[#121622] text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {c.category} ({c.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Folder Bundle Purchase Feature (§3 / §5) */}
      {bundleTargetMovies.length > 1 && (
        <div className="p-3 bg-gradient-to-r from-purple-950/60 via-slate-900 to-[#121622] rounded-xl border border-purple-500/30 flex items-center justify-between gap-3 shadow">
          <div>
            <div className="flex items-center gap-1.5 text-purple-300 text-[11px] font-bold">
              <FolderDown className="w-3.5 h-3.5 text-purple-400" />
              <span>CATEGORY BUNDLE: {categoryForBundle.toUpperCase()}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Unlock all {bundleTargetMovies.length} films at <span className="text-purple-300 font-bold">40% bundle discount</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-amber-300">
                {bundlePrice} ETB
              </div>
              <div className="text-[9px] text-gray-400 line-through">
                {bundleSumRegular} ETB
              </div>
            </div>
            <button
              onClick={() => onPurchaseFolder(categoryForBundle)}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition active:scale-95 shadow"
            >
              Get Bundle
            </button>
          </div>
        </div>
      )}

      {/* Movie Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {selectedCategory === 'All' ? 'Catalog Highlights' : `${selectedCategory} Collection`}
          </h3>
          <span className="text-[11px] text-gray-500">
            {activeCategoryMovies.length} Available
          </span>
        </div>

        {activeCategoryMovies.length === 0 ? (
          <div className="text-center py-12 bg-[#121620] rounded-2xl border border-gray-800">
            <Film className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-300 font-medium">No movies found</p>
            <p className="text-xs text-gray-500 mt-1">Try clearing your search query or selecting another category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {activeCategoryMovies.map((movie) => {
              return (
                <div
                  key={movie.id}
                  onClick={() => onSelectMovie(movie)}
                  className="group bg-[#0E121A] rounded-xl overflow-hidden border border-zinc-800/80 hover:border-emerald-500/50 transition cursor-pointer flex flex-col shadow-md hover:shadow-emerald-500/10"
                >
                  {/* Poster Image Container */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

                    {/* Top Quality and Discount Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-emerald-300 font-bold border border-emerald-500/30">
                        {movie.quality || '1080p'}
                      </span>
                      {movie.discount_percent > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white font-extrabold shadow">
                          -{movie.discount_percent}%
                        </span>
                      )}
                    </div>

                    {/* Popular Pill */}
                    {movie.is_popular === 1 && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-zinc-950 font-extrabold flex items-center gap-0.5 shadow">
                          <Flame className="w-2.5 h-2.5 fill-current" /> HOT
                        </span>
                      </div>
                    )}

                    {/* Overlay Title and Category */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="text-[10px] font-semibold text-emerald-400 block tracking-tight">
                        {movie.category}
                      </span>
                      <h4 className="text-xs font-bold text-white leading-tight line-clamp-1">
                        {movie.title}
                      </h4>
                      {movie.original_title && movie.original_title !== movie.title && (
                        <span className="text-[10px] text-zinc-300 italic block line-clamp-1">
                          {movie.original_title}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing and Action Footer */}
                  <div className="p-2 bg-[#121622] flex items-center justify-between border-t border-zinc-800/60">
                    <div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {movie.price_label || `${movie.regular_price} ETB`}
                      </div>
                      <div className="text-[9px] text-zinc-400">
                        Rental (72h) / Lifetime
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <a
                        href={(movie as any).bot_deep_link || `https://t.me/OroRecordsBot?start=movie_${movie.id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white transition"
                        title="Stream direct on Telegram Bot"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>
                      <button
                        className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition cursor-pointer"
                        title="View Details & Access"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
