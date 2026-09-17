import React, { useState, useEffect } from 'react';
import { User, Partner, PayoutRequest, LedgerEntry, PayoutPreview } from '../types';
import { api } from '../lib/apiClient';
import {
  Briefcase,
  Upload,
  DollarSign,
  TrendingUp,
  FileCheck2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Film,
  Plus,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface PartnerScreenProps {
  currentUser: User | null;
  onRefresh: () => void;
}

export const PartnerScreen: React.FC<PartnerScreenProps> = ({ currentUser, onRefresh }) => {
  const isPartner = currentUser?.is_partner === 1;

  // Partner Application State
  const [appName, setAppName] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appChannel, setAppChannel] = useState('');
  const [appFocus, setAppFocus] = useState('Oromo Cinema');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appSuccessMsg, setAppSuccessMsg] = useState<string | null>(null);
  const [appErrorMsg, setAppErrorMsg] = useState<string | null>(null);
  const [tosText, setTosText] = useState<string>('');

  // Partner Dashboard State
  const [partnerData, setPartnerData] = useState<Partner | null>(null);
  const [partnerMovies, setPartnerMovies] = useState<any[]>([]);
  const [salesHistory, setSalesHistory] = useState<LedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Payout Request State
  const [payoutAmount, setPayoutAmount] = useState('500');
  const [payoutMethod, setPayoutMethod] = useState('telebirr');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutName, setPayoutName] = useState('');
  const [payoutPreview, setPayoutPreview] = useState<PayoutPreview | null>(null);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Upload Movie Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOriginalTitle, setNewOriginalTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Drama');
  const [newPrice, setNewPrice] = useState('50');
  const [newVipPrice, setNewVipPrice] = useState('30');
  const [newDescription, setNewDescription] = useState('');
  const [newPosterUrl, setNewPosterUrl] = useState('');
  const [newQuality, setNewQuality] = useState('1080p FHD');
  const [newLanguages, setNewLanguages] = useState('Afan Oromo');
  const [uploadingMovie, setUploadingMovie] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((res) => {
      if (res.success && res.settings.partner_tos_text) {
        setTosText(res.settings.partner_tos_text);
      }
    });

    if (isPartner) {
      loadPartnerDashboard();
    }
  }, [currentUser?.user_id, isPartner]);

  // Load live fee preview when payout amount changes (§3 & §5)
  useEffect(() => {
    if (!isPartner) return;
    const amt = parseFloat(payoutAmount);
    if (!isNaN(amt) && amt > 0) {
      api.getPartnerPayoutPreview(amt).then((res) => {
        if (res.success) setPayoutPreview(res);
      });
    } else {
      setPayoutPreview(null);
    }
  }, [payoutAmount, isPartner]);

  const loadPartnerDashboard = () => {
    setLoadingDashboard(true);
    api.getPartnerSales()
      .then((res) => {
        if (res.success) {
          setPartnerData(res.partner);
          setPartnerMovies(res.movies);
          setSalesHistory(res.sales_history);
          setPayouts(res.payouts);
          if (res.partner) {
            setPayoutAccount(res.partner.payout_account || '');
            setPayoutName(res.partner.payout_name || '');
          }
        }
      })
      .finally(() => setLoadingDashboard(false));
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingApp(true);
    setAppSuccessMsg(null);
    setAppErrorMsg(null);

    try {
      const res = await api.applyPartner({
        name: appName,
        phone: appPhone,
        channel_or_portfolio: appChannel,
        category_focus: appFocus,
      });

      if (res.success) {
        setAppSuccessMsg(res.message);
      } else {
        setAppErrorMsg(res.message);
      }
    } catch (err: any) {
      setAppErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMsg(null);
    const amt = parseFloat(payoutAmount);

    if (isNaN(amt) || amt <= 0) {
      setPayoutMsg({ text: 'Please enter a valid amount', type: 'error' });
      return;
    }

    setSubmittingPayout(true);
    try {
      const res = await api.requestPartnerPayout({
        amount: amt,
        payout_method: payoutMethod,
        payout_account: payoutAccount,
        payout_name: payoutName,
      });

      if (res.success) {
        setPayoutMsg({ text: res.message, type: 'success' });
        loadPartnerDashboard();
        onRefresh();
      } else {
        setPayoutMsg({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setPayoutMsg({ text: err.message || 'Payout failed', type: 'error' });
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleUploadMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingMovie(true);
    setUploadMsg(null);

    try {
      const res = await api.uploadPartnerMovie({
        title: newTitle,
        original_title: newOriginalTitle,
        category: newCategory,
        description: newDescription,
        regular_price: parseFloat(newPrice),
        vip_price: parseFloat(newVipPrice),
        poster_url: newPosterUrl || 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&auto=format&fit=crop&q=80',
        quality: newQuality,
        languages: newLanguages,
      });

      if (res.success) {
        setUploadMsg(res.message);
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadMsg(null);
          loadPartnerDashboard();
        }, 1500);
      } else {
        setUploadMsg(res.message);
      }
    } catch (err: any) {
      setUploadMsg(err.message || 'Upload failed');
    } finally {
      setUploadingMovie(false);
    }
  };

  // IF NOT A PARTNER: Render application & TOS workflow
  if (!isPartner) {
    return (
      <div className="space-y-4 pb-20">
        <div className="bg-gradient-to-br from-purple-950/60 via-[#161B26] to-[#0D111A] border border-purple-500/30 rounded-2xl p-5 shadow-xl text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Briefcase className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight" style={{ fontFamily: 'Cinzel, serif' }}>
                ORO Creator & Partner Studio
              </h2>
              <span className="text-[10px] text-purple-300 font-semibold">
                70% Revenue Share • 24h Payouts
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed mt-2">
            Distribute your films, documentaries, and series directly to thousands of paying Ethiopian cinema fans on Telegram.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="p-2 bg-[#0E121B] rounded-xl border border-gray-800">
              <div className="text-base font-black text-amber-400 font-mono">70%</div>
              <div className="text-[9px] text-gray-400">Creator Royalty</div>
            </div>
            <div className="p-2 bg-[#0E121B] rounded-xl border border-gray-800">
              <div className="text-base font-black text-emerald-400 font-mono">Daily</div>
              <div className="text-[9px] text-gray-400">Telebirr / CBE</div>
            </div>
            <div className="p-2 bg-[#0E121B] rounded-xl border border-gray-800">
              <div className="text-base font-black text-purple-400 font-mono">100%</div>
              <div className="text-[9px] text-gray-400">Copyright Safe</div>
            </div>
          </div>
        </div>

        {/* TOS Agreement Box (§5) */}
        <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4 space-y-2">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Distribution Terms & Agreement
          </h3>
          <p className="text-xs text-gray-400 bg-[#0E121B] p-3 rounded-xl border border-gray-800/80 leading-relaxed font-sans">
            {tosText || 'ORO RECORDS Partner Agreement: Creators receive 70% of gross ticket sales. Films must possess legitimate copyright and authorization.'}
          </p>
        </div>

        {/* Application Form */}
        <div className="bg-[#121620] border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Submit Partner Application
          </h3>

          <form onSubmit={handleApplySubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Full Name / Studio Name
              </label>
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. Chala Benti or Oromia Motion Pictures"
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Phone Number (Telebirr / Mobile)
              </label>
              <input
                type="tel"
                required
                value={appPhone}
                onChange={(e) => setAppPhone(e.target.value)}
                placeholder="+251911..."
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Telegram Channel / YouTube Portfolio Link
              </label>
              <input
                type="url"
                value={appChannel}
                onChange={(e) => setAppChannel(e.target.value)}
                placeholder="https://t.me/... or https://youtube.com/..."
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Category Focus
              </label>
              <select
                value={appFocus}
                onChange={(e) => setAppFocus(e.target.value)}
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="Oromo Cultural">Oromo Cultural & History</option>
                <option value="Drama">Contemporary Drama</option>
                <option value="Action">Action & Thriller</option>
                <option value="Comedy">Comedy & Romance</option>
                <option value="Documentary">Documentary</option>
              </select>
            </div>

            {appErrorMsg && (
              <p className="text-xs text-red-300 p-2 bg-red-950/60 rounded-lg border border-red-500/30">
                {appErrorMsg}
              </p>
            )}

            {appSuccessMsg && (
              <p className="text-xs text-emerald-300 p-2 bg-emerald-950/60 rounded-lg border border-emerald-500/30">
                {appSuccessMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submittingApp}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-extrabold text-xs rounded-xl shadow transition active:scale-98"
            >
              {submittingApp ? 'Submitting Application...' : 'Apply as ORO Partner'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // IF PARTNER: Render Partner Dashboard
  return (
    <div className="space-y-4 pb-20">
      {/* Partner Earnings Card */}
      <div className="bg-gradient-to-br from-amber-500/20 via-[#161B26] to-[#0D111A] border border-amber-500/40 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            Partner Commission Balance
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 font-bold">
            70% CREATOR CUT
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-black font-mono tracking-tight text-white">
              {partnerData?.commission_balance.toFixed(2) || '0.00'}
            </span>
            <span className="text-sm font-bold text-amber-400 ml-1.5">ETB</span>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-gray-400">Total Life Earnings</div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {partnerData?.total_earned.toFixed(2) || '0.00'} ETB
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition shadow active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Submit New Movie
          </button>

          <span className="text-xs text-gray-400">
            {partnerMovies.length} Published Films
          </span>
        </div>
      </div>

      {/* Upload Movie Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#0D111A] border border-amber-500/40 rounded-2xl max-w-md w-full p-4 text-white shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-sm font-black text-white" style={{ fontFamily: 'Cinzel, serif' }}>
                Upload Film for Distribution (§3)
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-xs text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadMovie} className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase">
                  Movie Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Borana Warriors"
                  className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase">
                  Original Title (Oromo / Amharic)
                </label>
                <input
                  type="text"
                  value={newOriginalTitle}
                  onChange={(e) => setNewOriginalTitle(e.target.value)}
                  placeholder="e.g. Gootota Booranaa"
                  className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                  >
                    <option value="Oromo Cultural">Oromo Cultural</option>
                    <option value="Drama">Drama</option>
                    <option value="Action">Action</option>
                    <option value="Comedy">Comedy</option>
                    <option value="Thriller">Thriller</option>
                    <option value="Documentary">Documentary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">
                    Quality
                  </label>
                  <select
                    value={newQuality}
                    onChange={(e) => setNewQuality(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                  >
                    <option value="4K UHD">4K UHD</option>
                    <option value="1080p FHD">1080p FHD</option>
                    <option value="720p HD">720p HD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">
                    Ticket Price (ETB)
                  </label>
                  <input
                    type="number"
                    min="20"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">
                    VIP Price (ETB)
                  </label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={newVipPrice}
                    onChange={(e) => setNewVipPrice(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase">
                  Poster Image URL
                </label>
                <input
                  type="url"
                  value={newPosterUrl}
                  onChange={(e) => setNewPosterUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or leave blank for default"
                  className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase">
                  Synopsis / Storyline
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief synopsis for moviegoers..."
                  className="w-full px-3 py-1.5 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-lg text-xs"
                />
              </div>

              {uploadMsg && (
                <p className="text-xs text-amber-300 p-2 bg-amber-950/60 rounded border border-amber-500/40">
                  {uploadMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={uploadingMovie}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl shadow active:scale-98 transition"
              >
                {uploadingMovie ? 'Submitting to Curator...' : 'Submit Film for Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payout Request Section with Fee Preview (§3 & §5) */}
      <div className="bg-[#121620] border border-amber-500/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            Request Payout (Atomic Ledger)
          </h3>
          <span className="text-[10px] text-gray-400">Min: 100 ETB</span>
        </div>

        <form onSubmit={handleRequestPayout} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Amount (ETB)
              </label>
              <input
                type="number"
                min="100"
                step="10"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs font-mono focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Payout Channel
              </label>
              <select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value)}
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs focus:border-amber-500"
              >
                <option value="telebirr">Telebirr (+251...)</option>
                <option value="cbe">CBE Bank Account</option>
                <option value="ebirr">E-Birr</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Account Number / Phone
              </label>
              <input
                type="text"
                required
                value={payoutAccount}
                onChange={(e) => setPayoutAccount(e.target.value)}
                placeholder="+251911... / 1000..."
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs font-mono focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                required
                value={payoutName}
                onChange={(e) => setPayoutName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs focus:border-amber-500"
              />
            </div>
          </div>

          {/* Live Fee & Net Amount Preview (§3 requirement) */}
          {payoutPreview && (
            <div className="p-3 bg-[#161B26] rounded-xl border border-gray-800 text-xs space-y-1">
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Gross Payout Requested:</span>
                <span className="font-mono text-white font-bold">{payoutPreview.amount.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Platform Withdrawal Fee ({payoutPreview.fee_percent}%):</span>
                <span className="font-mono text-red-400">-{payoutPreview.fee.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold text-xs pt-1 border-t border-gray-800">
                <span>Net Cash Disbursement:</span>
                <span className="font-mono">{payoutPreview.net_amount.toFixed(2)} ETB</span>
              </div>
              {payoutPreview.error && (
                <p className="text-[11px] text-red-400 pt-1">{payoutPreview.error}</p>
              )}
            </div>
          )}

          {payoutMsg && (
            <p
              className={`text-xs p-2 rounded-lg border ${
                payoutMsg.type === 'success'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-950/60 text-red-300 border-red-500/40'
              }`}
            >
              {payoutMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={submittingPayout || (payoutPreview && !payoutPreview.can_withdraw)}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 text-black font-extrabold text-xs rounded-xl shadow active:scale-98 transition disabled:opacity-50"
          >
            {submittingPayout ? 'Submitting Atomic Payout...' : 'Submit Withdrawal Request'}
          </button>
        </form>
      </div>

      {/* Partner Movies & Sales Log */}
      <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
          My Catalog & Distribution Status
        </h4>

        {partnerMovies.length === 0 ? (
          <p className="text-xs text-gray-500 py-3 text-center">No movies submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {partnerMovies.map((m) => (
              <div
                key={m.id}
                className="p-2.5 bg-[#161B26] rounded-xl border border-gray-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white">{m.title}</div>
                  <div className="text-[10px] text-gray-400">
                    {m.category} • Price: {m.regular_price} ETB
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                      m.approval_status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {m.approval_status.toUpperCase()}
                  </span>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    {m.sales_count || 0} tickets sold
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
