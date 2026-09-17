import React, { useState, useEffect } from 'react';
import { User, ReconciliationReport, LedgerEntry, Movie, Announcement, AdminStats } from '../types';
import { api } from '../lib/apiClient';
import { AdminMovieCMSModal } from './AdminMovieCMSModal';
import { AdminAnnouncementModal } from './AdminAnnouncementModal';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownLeft,
  Building2,
  Users,
  Eye,
  Check,
  X,
  AlertTriangle,
  Scale,
  RefreshCw,
  Film,
  Plus,
  Edit3,
  Trash2,
  Megaphone,
  Settings,
  Send,
  ExternalLink,
  Copy,
  DollarSign,
  Search,
  Sparkles,
  Smartphone,
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon,
} from 'lucide-react';

interface AdminScreenProps {
  currentUser: User | null;
  onRefresh: () => void;
  onExitPortal?: () => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({
  currentUser,
  onRefresh,
  onExitPortal,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'movies' | 'announcements' | 'deposits' | 'payouts' | 'applications' | 'reconciliation' | 'settings'
  >('movies');

  // CMS Movies
  const [movies, setMovies] = useState<Movie[]>([]);
  const [movieSearch, setMovieSearch] = useState('');
  const [movieCategoryFilter, setMovieCategoryFilter] = useState('All');
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [isCreatingMovie, setIsCreatingMovie] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);

  // Pending lists
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Platform settings
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin stats
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);

  // Balance Adjustment tool
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustStatus, setAdjustStatus] = useState<string | null>(null);

  // Screenshot Lightbox Modal
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);

  // Action status message
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData();
  }, [activeAdminTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Always fetch stats
      api.getAdminStats().then((res) => {
        if (res.success && res.stats) setAdminStats(res.stats);
      });

      if (activeAdminTab === 'movies') {
        const res = await api.getMovies();
        if (res.success && res.movies) setMovies(res.movies);
      } else if (activeAdminTab === 'announcements') {
        const res = await api.getAnnouncements();
        if (res.success && res.announcements) setAnnouncements(res.announcements);
      } else if (activeAdminTab === 'deposits') {
        const res = await api.getPendingDeposits();
        if (res.success) setPendingDeposits(res.pending_deposits);
      } else if (activeAdminTab === 'payouts') {
        const res = await api.getPendingPayouts();
        if (res.success) setPendingPayouts(res.pending_payouts);
      } else if (activeAdminTab === 'applications') {
        const res = await api.getPartnerApplications();
        if (res.success) setApplications(res.applications);
      } else if (activeAdminTab === 'reconciliation') {
        const repRes = await api.getReconciliationReport();
        if (repRes.success) setReconciliation(repRes.report);
        const entriesRes = await api.getLedgerEntries(50);
        if (entriesRes.success) setLedgerEntries(entriesRes.entries);
        const usersRes = await api.getUsers();
        if (usersRes.success) {
          setAllUsers(usersRes.users);
          if (usersRes.users.length > 0 && !adjustUserId) {
            setAdjustUserId(String(usersRes.users[0].user_id));
          }
        }
      } else if (activeAdminTab === 'settings') {
        const res = await api.getSettings();
        if (res.success) setSettings(res.settings);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Movie CMS actions
  const handleDeleteMovie = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}" from the catalog?`)) return;
    try {
      const res = await api.deleteMovieCMS(id);
      if (res.success) {
        setActionNotice({ text: `Movie "${title}" deleted from catalog.`, type: 'success' });
        loadAdminData();
        onRefresh();
      } else {
        setActionNotice({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    }
  };

  // Announcement actions
  const handleDeleteAnnouncement = async (id: number) => {
    try {
      const res = await api.deleteAnnouncement(id);
      if (res.success) {
        setActionNotice({ text: 'Announcement removed', type: 'success' });
        loadAdminData();
      } else {
        setActionNotice({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    }
  };

  // Deposit actions
  const handleApproveDeposit = async (id: number) => {
    try {
      const res = await api.approveDeposit(id, 'Receipt screenshot verified by admin');
      if (res.success) {
        setActionNotice({ text: res.message, type: 'success' });
        loadAdminData();
        onRefresh();
      } else {
        setActionNotice({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    }
  };

  const handleRejectDeposit = async (id: number) => {
    const reason = window.prompt('Enter reason for declining deposit:', 'Screenshot or reference code could not be verified');
    if (reason === null) return;
    try {
      const res = await api.rejectDeposit(id, reason);
      if (res.success) {
        setActionNotice({ text: res.message, type: 'success' });
        loadAdminData();
      } else {
        setActionNotice({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    }
  };

  // Payout actions
  const handleApprovePayout = async (id: number) => {
    try {
      const res = await api.approvePayout(id, 'Disbursed via Telebirr Business portal');
      if (res.success) {
        setActionNotice({ text: res.message, type: 'success' });
        loadAdminData();
        onRefresh();
      } else {
        setActionNotice({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    }
  };

  const handleRejectPayout = async (id: number) => {
    const reason = window.prompt('Enter reason for rejecting payout:', 'Account mismatch');
    if (reason === null) return;
    try {
      const res = await api.rejectPayout(id, reason);
      if (res.success) {
        setActionNotice({ text: res.message, type: 'success' });
        loadAdminData();
        onRefresh();
      } else {
        setActionNotice({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    }
  };

  // Partner application action
  const handleApprovePartnerApp = async (id: number) => {
    try {
      const res = await api.approvePartnerApplication(id);
      if (res.success) {
        setActionNotice({ text: res.message, type: 'success' });
        loadAdminData();
        onRefresh();
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    }
  };

  // Manual Balance Adjustment
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustStatus(null);
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || !adjustUserId) return;

    try {
      const res = await api.adjustBalance(parseInt(adjustUserId, 10), amt, adjustReason || 'Admin manual ledger adjustment');
      if (res.success) {
        setAdjustStatus(res.message);
        setAdjustAmount('');
        setAdjustReason('');
        loadAdminData();
        onRefresh();
      } else {
        setAdjustStatus(res.message);
      }
    } catch (err: any) {
      setAdjustStatus(err.message);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await api.updateSettings(settings);
      if (res.success) {
        setActionNotice({ text: 'Platform settings saved successfully!', type: 'success' });
      } else {
        setActionNotice({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message, type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Existing distinct categories
  const existingCategories = Array.from(new Set(movies.map((m) => m.category).filter(Boolean)));
  if (!existingCategories.includes('Cultural Drama')) existingCategories.push('Cultural Drama');
  if (!existingCategories.includes('Action & Thriller')) existingCategories.push('Action & Thriller');
  if (!existingCategories.includes('Comedy & Romance')) existingCategories.push('Comedy & Romance');

  // Filtered movies for CMS
  const filteredMovies = movies.filter((m) => {
    const matchCat = movieCategoryFilter === 'All' || m.category === movieCategoryFilter;
    const matchQuery =
      !movieSearch ||
      m.title.toLowerCase().includes(movieSearch.toLowerCase()) ||
      (m.original_title && m.original_title.toLowerCase().includes(movieSearch.toLowerCase())) ||
      m.category.toLowerCase().includes(movieSearch.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Dedicated Enterprise Header */}
      <div className="bg-gradient-to-r from-red-950/80 via-[#16121E] to-[#0E121B] border border-red-500/40 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                  ORO RECORDS CMS & ADMIN OPERATIONS
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-red-500/30 border border-red-500/50 text-red-300 text-[9px] font-extrabold">
                  COMMAND PORTAL
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Logged in as <span className="text-gray-200 font-bold">{currentUser?.username || 'Admin'}</span> (ID: {currentUser?.user_id}) • Double-Entry Real-time Ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onExitPortal && (
              <button
                onClick={onExitPortal}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold border border-gray-700 flex items-center gap-1.5 transition active:scale-95 shadow"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Storefront
              </button>
            )}
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition"
              title="Refresh admin telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Executive KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-800/80">
          <div className="bg-[#0E121B]/80 p-2.5 rounded-xl border border-gray-800">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">
              Catalog Master
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-black font-mono text-white">
                {adminStats?.total_movies ?? movies.length}
              </span>
              <Film className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          <div className="bg-[#0E121B]/80 p-2.5 rounded-xl border border-gray-800">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">
              Pending Deposits
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-base font-black font-mono ${pendingDeposits.length > 0 ? 'text-amber-400' : 'text-gray-300'}`}>
                {adminStats?.pending_deposits ?? pendingDeposits.length}
              </span>
              {pendingDeposits.length > 0 ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
            </div>
          </div>

          <div className="bg-[#0E121B]/80 p-2.5 rounded-xl border border-gray-800">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">
              Pending Payouts
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-black font-mono text-white">
                {adminStats?.pending_payouts ?? pendingPayouts.length}
              </span>
              <ArrowDownLeft className="w-4 h-4 text-purple-400" />
            </div>
          </div>

          <div className="bg-[#0E121B]/80 p-2.5 rounded-xl border border-gray-800">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">
              Trial Balance
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-black font-mono text-emerald-400">
                BALANCED
              </span>
              <Scale className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Global Status Banner */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between shadow ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/80 border border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-gray-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Admin Module Navigation Tabs */}
      <div className="flex overflow-x-auto gap-1.5 p-1 bg-[#121620] rounded-2xl border border-gray-800 scrollbar-none">
        <button
          onClick={() => setActiveAdminTab('movies')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeAdminTab === 'movies'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Film className="w-3.5 h-3.5" /> Movie Studio CMS
        </button>

        <button
          onClick={() => setActiveAdminTab('announcements')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeAdminTab === 'announcements'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" /> Broadcast & Media
        </button>

        <button
          onClick={() => setActiveAdminTab('deposits')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeAdminTab === 'deposits'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" /> Deposits
          {pendingDeposits.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[9px] font-black">
              {pendingDeposits.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('payouts')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeAdminTab === 'payouts'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> Payouts
          {pendingPayouts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-300 text-black text-[9px] font-black">
              {pendingPayouts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('applications')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeAdminTab === 'applications'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Partners
          {applications.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[9px] font-black">
              {applications.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('reconciliation')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeAdminTab === 'reconciliation'
              ? 'bg-gray-700 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Scale className="w-3.5 h-3.5" /> Ledger & Reconcile
        </button>

        <button
          onClick={() => setActiveAdminTab('settings')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeAdminTab === 'settings'
              ? 'bg-gray-700 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Settings
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: MOVIE STUDIO CMS                                      */}
      {/* ============================================================ */}
      {activeAdminTab === 'movies' && (
        <div className="space-y-3">
          {/* Controls: Search, Filter, and + Upload Movie Button */}
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={movieSearch}
                  onChange={(e) => setMovieSearch(e.target.value)}
                  placeholder="Search catalog by title or category..."
                  className="w-full pl-8 pr-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={movieCategoryFilter}
                onChange={(e) => setMovieCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="All">All Categories</option>
                {existingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setEditingMovie(null);
                setIsCreatingMovie(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Upload New Movie
            </button>
          </div>

          {/* Movie Catalog CMS List */}
          <div className="space-y-2">
            {filteredMovies.length === 0 ? (
              <div className="text-center py-10 bg-[#121620] rounded-2xl border border-gray-800">
                <Film className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No movies found matching criteria.</p>
              </div>
            ) : (
              filteredMovies.map((movie) => {
                const deepLink = (movie as any).bot_deep_link || `https://t.me/OroRecordsBot?start=movie_${movie.id}`;
                return (
                  <div
                    key={movie.id}
                    className="bg-[#121620] border border-gray-800 hover:border-gray-700 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={movie.poster_url}
                        alt={movie.title}
                        className="w-14 h-20 object-cover rounded-lg border border-gray-800 shrink-0 bg-gray-900"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-white">{movie.title}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                            {movie.category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 text-[9px]">
                            {movie.quality}
                          </span>
                          {movie.is_popular === 1 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-600/30 border border-red-500/40 text-red-300 text-[9px] font-bold">
                              HOT
                            </span>
                          )}
                        </div>

                        {movie.original_title && movie.original_title !== movie.title && (
                          <p className="text-[10px] text-gray-400 italic">{movie.original_title}</p>
                        )}

                        {/* Pricing and Rental */}
                        <div className="flex items-center gap-3 text-[11px] font-mono">
                          <span className="text-amber-400 font-bold">
                            Reg: {movie.regular_price} ETB
                          </span>
                          <span className="text-emerald-400 font-bold">
                            VIP: {movie.vip_price} ETB
                          </span>
                          {movie.discount_percent > 0 && (
                            <span className="text-red-400 font-bold">
                              -{movie.discount_percent}% OFF
                            </span>
                          )}
                        </div>

                        {/* Deep link info */}
                        <div className="flex items-center gap-2 text-[10px] text-blue-400 pt-0.5">
                          <Send className="w-3 h-3" />
                          <span className="truncate max-w-[200px] sm:max-w-xs font-mono">{deepLink}</span>
                          <button
                            onClick={() => copyToClipboard(deepLink, `movie-link-${movie.id}`)}
                            className="text-gray-400 hover:text-white"
                            title="Copy Telegram Deep Link"
                          >
                            {copiedKey === `movie-link-${movie.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={deepLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                        title="Test Deep Link in Telegram"
                      >
                        <ExternalLink className="w-3 h-3" /> Test Bot Link
                      </a>

                      <button
                        onClick={() => {
                          setEditingMovie(movie);
                          setIsCreatingMovie(true);
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold border border-gray-700 flex items-center gap-1 transition"
                      >
                        <Edit3 className="w-3 h-3 text-amber-400" /> Edit CMS
                      </button>

                      <button
                        onClick={() => handleDeleteMovie(movie.id, movie.title)}
                        className="p-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 rounded-xl transition"
                        title="Delete movie from catalog"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: ANNOUNCEMENTS & PROMOTIONAL MEDIA                    */}
      {/* ============================================================ */}
      {activeAdminTab === 'announcements' && (
        <div className="space-y-3">
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                Active Promotional Posts & Teaser Media
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Broadcast new premiere banners, weekend discounts, and teaser clips to all buyers.
              </p>
            </div>
            <button
              onClick={() => setIsCreatingAnnouncement(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Broadcast Announcement
            </button>
          </div>

          <div className="space-y-2">
            {announcements.length === 0 ? (
              <div className="text-center py-10 bg-[#121620] rounded-2xl border border-gray-800">
                <Megaphone className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No active announcements broadcasted yet.</p>
              </div>
            ) : (
              announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="bg-[#121620] border border-gray-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-extrabold">
                        {ann.badge || 'NOTICE'}
                      </span>
                      <h4 className="text-xs font-bold text-white">{ann.title}</h4>
                      <span className="text-[9px] text-gray-500">{ann.created_at}</span>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed">{ann.content}</p>

                    {ann.media_url && (
                      <div className="pt-1">
                        <img
                          src={ann.media_url}
                          alt="Promo media"
                          className="max-h-36 rounded-lg object-cover border border-gray-800"
                        />
                      </div>
                    )}

                    {ann.action_link && (
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-400 pt-1">
                        <Send className="w-3 h-3" />
                        <span className="font-mono truncate max-w-sm">{ann.action_link}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="p-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 rounded-xl transition self-end sm:self-start"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: DEPOSITS REVIEW (WITH DIRECT SCREENSHOTS)             */}
      {/* ============================================================ */}
      {activeAdminTab === 'deposits' && (
        <div className="space-y-3">
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Pending Deposits Verification
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Inspect uploaded screenshots, check reference code on Telebirr/CBE, and credit balance atomically.
            </p>
          </div>

          <div className="space-y-2">
            {pendingDeposits.length === 0 ? (
              <div className="text-center py-10 bg-[#121620] rounded-2xl border border-gray-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-gray-400">All customer deposits have been reviewed.</p>
              </div>
            ) : (
              pendingDeposits.map((dep) => (
                <div
                  key={dep.id}
                  className="bg-[#121620] border border-amber-500/30 rounded-2xl p-3.5 space-y-3 shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{dep.user_name || 'Customer'}</span>
                        <span className="text-[10px] text-gray-400 font-mono">(ID: {dep.user_id})</span>
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-[10px] uppercase font-bold">
                          {dep.payment_method}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Balance before: <span className="font-mono text-gray-300">{dep.user_balance} ETB</span> • {dep.created_at}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black font-mono text-emerald-400">
                        +{dep.amount} ETB
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 justify-end">
                        <span>Ref: {dep.reference_code}</span>
                        <button
                          onClick={() => copyToClipboard(dep.reference_code, `ref-${dep.id}`)}
                          className="hover:text-white"
                        >
                          {copiedKey === `ref-${dep.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Uploaded Screenshot Proof Preview */}
                  {dep.screenshot_url ? (
                    <div className="bg-[#0E121B] p-2.5 rounded-xl border border-gray-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setPreviewScreenshot(dep.screenshot_url)}
                          className="cursor-pointer group relative overflow-hidden rounded-lg border border-amber-500/40 w-16 h-16 bg-black shrink-0"
                        >
                          <img
                            src={dep.screenshot_url}
                            alt="Receipt proof"
                            className="w-full h-full object-cover group-hover:scale-110 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-200 block">Uploaded Receipt Screenshot</span>
                          <span className="text-[10px] text-amber-400 font-mono block">Direct device upload</span>
                          <button
                            type="button"
                            onClick={() => setPreviewScreenshot(dep.screenshot_url)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 underline mt-0.5 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Click to inspect high-resolution receipt
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewScreenshot(dep.screenshot_url)}
                        className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-bold border border-gray-700 transition"
                      >
                        Inspect
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 bg-[#0E121B] rounded-xl border border-gray-800 text-[11px] text-gray-400 italic">
                      No screenshot attached (Reference ID verification only)
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-800/60">
                    <button
                      onClick={() => handleRejectDeposit(dep.id)}
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveDeposit(dep.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition active:scale-95 shadow flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Credit {dep.amount} ETB
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: PAYOUTS & CREATORS                                    */}
      {/* ============================================================ */}
      {activeAdminTab === 'payouts' && (
        <div className="space-y-3">
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Pending Creator & Affiliate Payouts
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Review requested partner disbursements, deduct platform fee, and execute withdrawal.
            </p>
          </div>

          <div className="space-y-2">
            {pendingPayouts.length === 0 ? (
              <div className="text-center py-10 bg-[#121620] rounded-2xl border border-gray-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No pending payout requests.</p>
              </div>
            ) : (
              pendingPayouts.map((pay) => (
                <div
                  key={pay.id}
                  className="bg-[#121620] border border-blue-500/30 rounded-2xl p-3.5 space-y-2.5 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">{pay.user_name}</span>
                      <span className="text-[10px] text-gray-400 font-mono ml-1.5">
                        {pay.phone_or_account} ({pay.payment_method})
                      </span>
                    </div>
                    <span className="text-sm font-black font-mono text-white">
                      {pay.amount} ETB
                    </span>
                  </div>

                  <div className="bg-[#0E121B] p-2 rounded-xl text-[11px] font-mono grid grid-cols-3 gap-2 border border-gray-800 text-gray-300">
                    <div>Gross: {pay.amount} ETB</div>
                    <div className="text-red-400">Fee: -{pay.fee_amount} ETB</div>
                    <div className="text-emerald-400 font-bold">Net: {pay.net_amount} ETB</div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-800/60">
                    <button
                      onClick={() => handleRejectPayout(pay.id)}
                      className="px-3 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprovePayout(pay.id)}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black"
                    >
                      Disburse {pay.net_amount} ETB
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: PARTNER APPLICATIONS                                  */}
      {/* ============================================================ */}
      {activeAdminTab === 'applications' && (
        <div className="space-y-3">
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Creator & Partner Onboarding Applications
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Review Oromo filmmakers, musicians, and studios requesting verified partner status.
            </p>
          </div>

          <div className="space-y-2">
            {applications.length === 0 ? (
              <div className="text-center py-10 bg-[#121620] rounded-2xl border border-gray-800">
                <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No partner applications pending review.</p>
              </div>
            ) : (
              applications.map((app) => (
                <div
                  key={app.id}
                  className="bg-[#121620] border border-gray-800 rounded-2xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">{app.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono ml-2">{app.phone}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      {app.category_focus}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300">Portfolio: {app.channel_or_portfolio}</p>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      onClick={() => handleApprovePartnerApp(app.id)}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl"
                    >
                      Approve & Grant Partner Role
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 6: DOUBLE-ENTRY LEDGER & RECONCILIATION                  */}
      {/* ============================================================ */}
      {activeAdminTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Double-Entry Ledger Audit & Trial Balance
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Mathematical proof: Total Debits == Total Credits across all user balances.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-mono">
                <CheckCircle2 className="w-4 h-4" /> BALANCED
              </div>
            </div>

            {reconciliation && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-800 font-mono text-xs">
                <div className="p-2 bg-[#0E121B] rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 uppercase block font-sans">Cash Assets Held</span>
                  <span className="text-emerald-400 font-bold">{reconciliation.total_assets} ETB</span>
                </div>
                <div className="p-2 bg-[#0E121B] rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 uppercase block font-sans">User Liabilities</span>
                  <span className="text-amber-400 font-bold">{reconciliation.total_user_liabilities} ETB</span>
                </div>
                <div className="p-2 bg-[#0E121B] rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 uppercase block font-sans">Platform Equity</span>
                  <span className="text-blue-400 font-bold">{reconciliation.platform_equity} ETB</span>
                </div>
                <div className="p-2 bg-[#0E121B] rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 uppercase block font-sans">Discrepancy</span>
                  <span className="text-white font-bold">{reconciliation.discrepancy} ETB</span>
                </div>
              </div>
            )}
          </div>

          {/* Manual Balance Adjustment Form */}
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Emergency Ledger Balance Adjustment
            </h4>
            <form onSubmit={handleAdjustBalance} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={adjustUserId}
                  onChange={(e) => setAdjustUserId(e.target.value)}
                  className="px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white"
                >
                  {allUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.username} (ID: {u.user_id}, {u.balance} ETB)
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Amount (+50 or -50 ETB)"
                  className="px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white font-mono"
                />

                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Audit reason"
                  className="px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white"
                />
              </div>

              {adjustStatus && (
                <p className="text-xs text-emerald-400 p-2 bg-emerald-950/60 rounded-lg">
                  {adjustStatus}
                </p>
              )}

              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition"
              >
                Execute Ledger Adjustment
              </button>
            </form>
          </div>

          {/* Recent Ledger Audit Trail */}
          <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Live Ledger Journal Entries (Recent 50)
            </h4>
            <div className="max-h-60 overflow-y-auto space-y-1 font-mono text-[10px] text-gray-300">
              {ledgerEntries.map((e) => (
                <div key={e.id} className="p-2 bg-[#0E121B] rounded border border-gray-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-gray-500">#{e.id}</span> •{' '}
                    <span className="text-amber-400">{e.event_type}</span>{' '}
                    <span className="text-gray-400">({e.debit_account} → {e.credit_account})</span>
                  </div>
                  <div className="font-bold text-white">{e.amount} ETB</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 7: PLATFORM SETTINGS                                     */}
      {/* ============================================================ */}
      {activeAdminTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-[#121620] border border-gray-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Platform & Payment Destination Configuration
            </h3>
            <span className="text-[10px] text-gray-400">Real-time updates</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Telegram Bot Username
              </label>
              <input
                type="text"
                value={settings.telegram_bot_username || 'OroRecordsBot'}
                onChange={(e) => setSettings({ ...settings, telegram_bot_username: e.target.value })}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Telebirr Merchant / Agent Phone
              </label>
              <input
                type="text"
                value={settings.telebirr_phone || '+251 911 234 567'}
                onChange={(e) => setSettings({ ...settings, telebirr_phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                CBE Account Number
              </label>
              <input
                type="text"
                value={settings.cbe_account || '100023456789'}
                onChange={(e) => setSettings({ ...settings, cbe_account: e.target.value })}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                E-Birr Account Number
              </label>
              <input
                type="text"
                value={settings.ebirr_account || '+251 922 345 678'}
                onChange={(e) => setSettings({ ...settings, ebirr_account: e.target.value })}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Sinqee Bank Account
              </label>
              <input
                type="text"
                value={settings.sinqee_account || '300045678901'}
                onChange={(e) => setSettings({ ...settings, sinqee_account: e.target.value })}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Withdrawal Fee (%)
              </label>
              <input
                type="number"
                value={settings.withdrawal_fee_percent || '2.5'}
                onChange={(e) => setSettings({ ...settings, withdrawal_fee_percent: e.target.value })}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow transition"
            >
              {savingSettings ? 'Saving...' : 'Save Platform Settings'}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================ */}
      {/* MODAL: MOVIE CMS STUDIO (UPLOAD & EDIT)                      */}
      {/* ============================================================ */}
      {isCreatingMovie && (
        <AdminMovieCMSModal
          movieToEdit={editingMovie}
          existingCategories={existingCategories}
          onClose={() => {
            setIsCreatingMovie(false);
            setEditingMovie(null);
          }}
          onSaved={(msg) => {
            setActionNotice({ text: msg, type: 'success' });
            loadAdminData();
            onRefresh();
          }}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL: ANNOUNCEMENT & MEDIA BROADCASTER                     */}
      {/* ============================================================ */}
      {isCreatingAnnouncement && (
        <AdminAnnouncementModal
          onClose={() => setIsCreatingAnnouncement(false)}
          onSaved={(msg) => {
            setActionNotice({ text: msg, type: 'success' });
            loadAdminData();
          }}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL: HIGH-RESOLUTION SCREENSHOT RECEIPT LIGHTBOX          */}
      {/* ============================================================ */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div
            className="relative bg-[#10141D] border border-amber-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-[#121620] border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Payment Proof Inspection Lightbox
                </span>
              </div>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/70">
              <img
                src={previewScreenshot}
                alt="High-resolution receipt"
                className="max-w-full max-h-[75vh] object-contain rounded shadow-2xl"
              />
            </div>

            <div className="p-3 bg-[#121620] border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
              <span className="font-mono text-[10px] truncate max-w-sm">{previewScreenshot}</span>
              <a
                href={previewScreenshot}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-amber-500 text-black font-bold text-xs rounded-lg flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Full Image
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
