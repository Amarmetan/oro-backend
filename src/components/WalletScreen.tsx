import React, { useState, useEffect, useRef } from 'react';
import { User, DepositTransaction } from '../types';
import { api } from '../lib/apiClient';
import {
  Wallet,
  ArrowDownLeft,
  Copy,
  Check,
  Crown,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  ShieldCheck,
  Smartphone,
  Building2,
  Upload,
  Image as ImageIcon,
  X,
  FileCheck,
} from 'lucide-react';

interface WalletScreenProps {
  currentUser: User | null;
  onRefresh: () => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ currentUser, onRefresh }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [activeMethod, setActiveMethod] = useState<'telebirr' | 'cbe' | 'ebirr' | 'sinqee'>('telebirr');
  const [depositAmount, setDepositAmount] = useState('100');
  const [refCode, setRefCode] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [depositErrorMsg, setDepositErrorMsg] = useState<string | null>(null);

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // VIP
  const [subscribingVip, setSubscribingVip] = useState(false);
  const [vipMsg, setVipMsg] = useState<string | null>(null);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Transactions
  const [transactions, setTransactions] = useState<DepositTransaction[]>([]);

  useEffect(() => {
    loadData();
  }, [currentUser?.user_id]);

  const loadData = () => {
    api.getSettings().then((res) => {
      if (res.success) setSettings(res.settings);
    });

    api.getMe().then((res) => {
      if (res.success && res.recent_transactions) {
        setTransactions(res.recent_transactions);
      }
    });
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setDepositErrorMsg('Please select a valid image screenshot (PNG, JPEG, or WebP)');
      return;
    }
    setDepositErrorMsg(null);
    setScreenshotFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshotPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositSuccessMsg(null);
    setDepositErrorMsg(null);

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      setDepositErrorMsg('Please enter a valid deposit amount in ETB');
      return;
    }

    setSubmittingDeposit(true);
    try {
      const res = await api.deposit({
        amount: amt,
        payment_method: activeMethod,
        reference_code: refCode.trim() || `${activeMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        file: screenshotFile || undefined,
        screenshot_base64: screenshotPreview || undefined,
      });

      if (res.success) {
        setDepositSuccessMsg(res.message);
        setRefCode('');
        clearSelectedFile();
        loadData();
        onRefresh();
      } else {
        setDepositErrorMsg(res.message);
      }
    } catch (err: any) {
      setDepositErrorMsg(err.message || 'Deposit submission failed');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setRedeemingCoupon(true);
    setCouponMsg(null);

    try {
      const res = await api.redeemCoupon(couponCode.trim());
      if (res.success) {
        setCouponMsg({ text: res.message, type: 'success' });
        setCouponCode('');
        onRefresh();
        loadData();
      } else {
        setCouponMsg({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setCouponMsg({ text: err.message || 'Redemption failed', type: 'error' });
    } finally {
      setRedeemingCoupon(false);
    }
  };

  const handleSubscribeVip = async () => {
    setSubscribingVip(true);
    setVipMsg(null);

    try {
      const res = await api.subscribeVip();
      if (res.success) {
        setVipMsg(res.message);
        onRefresh();
        loadData();
      } else {
        setVipMsg(res.message);
      }
    } catch (err: any) {
      setVipMsg(err.message || 'Failed to activate VIP');
    } finally {
      setSubscribingVip(false);
    }
  };

  const paymentAccounts = {
    telebirr: {
      name: 'Telebirr SuperApp',
      detail: settings.telebirr_phone || '+251911223344',
      accountName: 'ORO RECORDS ENTERTAINMENT',
      icon: Smartphone,
      color: 'text-amber-400',
    },
    cbe: {
      name: 'Commercial Bank of Ethiopia (CBE)',
      detail: settings.cbe_account?.split(' ')[0] || '1000234567890',
      accountName: 'ORO RECORDS MEDIA ENTERPRISE',
      icon: Building2,
      color: 'text-purple-400',
    },
    ebirr: {
      name: 'E-Birr / Coop Bank of Oromia',
      detail: settings.ebirr_account?.split(' ')[0] || '+251977889900',
      accountName: 'ORO CINEMA STREAMING',
      icon: Smartphone,
      color: 'text-emerald-400',
    },
    sinqee: {
      name: 'Sinqee Bank S.C.',
      detail: settings.sinqee_account?.split(' ')[0] || '300456789',
      accountName: 'ORO RECORDS PRODUCTION',
      icon: Building2,
      color: 'text-blue-400',
    },
  };

  const currentAccount = paymentAccounts[activeMethod];

  return (
    <div className="space-y-4 pb-20">
      {/* Wallet Balance Hero Card */}
      <div className="bg-gradient-to-br from-emerald-500/20 via-[#10151E] to-[#080A0F] border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            Buyer Wallet Balance
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-mono font-bold">ETHIOPIAN BIRR</span>
          </div>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-black font-mono tracking-tight text-white">
              {currentUser?.balance.toFixed(2) ?? '0.00'}
            </span>
            <span className="text-sm font-bold text-emerald-400 ml-1.5">ETB</span>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-zinc-400">Loyalty Points</div>
            <div className="text-xs font-bold text-emerald-300 font-mono">
              ⭐ {currentUser?.points ?? 0} PTS
            </div>
          </div>
        </div>

        {/* VIP Status or Upgrade Callout */}
        <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
          {currentUser?.is_vip === 1 ? (
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-400 text-zinc-950">
                <Crown className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="text-xs font-bold text-emerald-300">VIP Cinephile Pass Active</div>
                <div className="text-[10px] text-zinc-400">
                  Enjoy up to 50% discount on all movie catalog titles
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-emerald-400" />
                  Monthly VIP Cinephile Pass
                </div>
                <div className="text-[10px] text-zinc-400">250 ETB / 30 days • 50% off all films</div>
              </div>
              <button
                onClick={handleSubscribeVip}
                disabled={subscribingVip}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-zinc-950 font-extrabold text-xs rounded-xl shadow transition active:scale-95 cursor-pointer"
              >
                {subscribingVip ? 'Activating...' : 'Get Pass'}
              </button>
            </div>
          )}
        </div>

        {vipMsg && (
          <p className="text-[11px] text-emerald-300 mt-2 p-2 bg-emerald-500/15 rounded-lg border border-emerald-500/30">
            {vipMsg}
          </p>
        )}
      </div>

      {/* Promo Code / Coupon Card */}
      <div className="bg-[#0E121A] border border-zinc-800 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            Redeem Voucher / Coupon
          </span>
          <span className="text-[10px] text-zinc-500">Try: OROPROMO50</span>
        </div>

        <form onSubmit={handleRedeemCoupon} className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="e.g. OROPROMO50, TELEBIRR25"
            className="flex-1 px-3 py-2 bg-[#121622] text-zinc-200 placeholder-zinc-500 border border-zinc-800 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={redeemingCoupon || !couponCode.trim()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl transition active:scale-95 cursor-pointer"
          >
            {redeemingCoupon ? 'Checking...' : 'Apply'}
          </button>
        </form>

        {couponMsg && (
          <p
            className={`text-[11px] p-2 rounded-lg border ${
              couponMsg.type === 'success'
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40'
                : 'bg-red-950/50 text-red-300 border-red-500/40'
            }`}
          >
            {couponMsg.text}
          </p>
        )}
      </div>

      {/* Deposit Instructions & Form (§3 and §5) */}
      <div className="bg-[#121620] border border-amber-500/20 rounded-2xl p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white" style={{ fontFamily: 'Cinzel, serif' }}>
              Deposit ETB Funds
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
              Instant Bank Reconcile
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Transfer to our verified merchant account, then paste your reference number below.
          </p>
        </div>

        {/* Payment Method Selector Tabs */}
        <div className="grid grid-cols-4 gap-1.5 bg-[#0E121B] p-1 rounded-xl border border-gray-800">
          {(['telebirr', 'cbe', 'ebirr', 'sinqee'] as const).map((method) => {
            const isSelected = activeMethod === method;
            const labels = {
              telebirr: 'Telebirr',
              cbe: 'CBE Bank',
              ebirr: 'E-Birr',
              sinqee: 'Sinqee',
            };
            return (
              <button
                key={method}
                type="button"
                onClick={() => setActiveMethod(method)}
                className={`py-1.5 px-1 text-[11px] font-bold rounded-lg transition ${
                  isSelected
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {labels[method]}
              </button>
            );
          })}
        </div>

        {/* Active Account Details Box with Copy */}
        <div className="bg-[#161B26] p-3 rounded-xl border border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-300">
              {currentAccount.name}
            </span>
            <span className="text-[10px] text-gray-400">{currentAccount.accountName}</span>
          </div>

          <div className="flex items-center justify-between bg-[#0E121B] p-2.5 rounded-lg border border-gray-800">
            <span className="font-mono text-xs font-black text-amber-400">
              {currentAccount.detail}
            </span>
            <button
              onClick={() => copyToClipboard(currentAccount.detail, activeMethod)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold transition"
            >
              {copiedKey === activeMethod ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Deposit Submission Form */}
        <form onSubmit={handleDepositSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Amount (ETB)
              </label>
              <div className="flex gap-1 mb-1.5">
                {['50', '100', '250', '500'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDepositAmount(val)}
                    className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${
                      depositAmount === val
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-[#0E121B] border-gray-800 text-gray-400'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="10"
                step="1"
                required
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Transaction Reference
              </label>
              <input
                type="text"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                placeholder="e.g. TEL-98831 / CBE-FT..."
                className="w-full px-3 py-2 bg-[#0E121B] text-gray-200 border border-gray-800 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
              />
              <span className="text-[9px] text-gray-500 block mt-1">SMS or transaction receipt ID</span>
            </div>
          </div>

          {/* Direct Screenshot File Upload Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                Proof of Payment Receipt (Screenshot)
              </label>
              <span className="text-[10px] text-amber-400 font-medium">PNG / JPEG / WebP</span>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {!screenshotPreview ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
                    : 'border-gray-700 hover:border-gray-600 bg-[#0E121B] hover:bg-[#151B27]'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-200">
                      Tap to select or drop screenshot
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Upload your bank transfer or Telebirr confirmation receipt
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-[11px] font-semibold border border-gray-700 transition"
                  >
                    Browse Files
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#0E121B] p-2.5 rounded-xl border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-200 truncate max-w-[200px]">
                        {screenshotFile?.name || 'receipt_screenshot.png'}
                      </p>
                      <p className="text-[10px] text-emerald-400 font-mono">
                        {screenshotFile ? `${(screenshotFile.size / 1024).toFixed(1)} KB` : 'Attached'} • Ready for verification
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Thumbnail Preview */}
                <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-black/50 max-h-36 flex items-center justify-center">
                  <img
                    src={screenshotPreview}
                    alt="Receipt preview"
                    className="w-full h-auto max-h-36 object-contain rounded"
                  />
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 backdrop-blur rounded text-[9px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Screenshot Loaded
                  </div>
                </div>
              </div>
            )}
          </div>

          {depositErrorMsg && (
            <p className="text-xs text-red-300 p-2 bg-red-950/60 rounded-lg border border-red-500/30">
              {depositErrorMsg}
            </p>
          )}

          {depositSuccessMsg && (
            <p className="text-xs text-emerald-300 p-2 bg-emerald-950/60 rounded-lg border border-emerald-500/30">
              {depositSuccessMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submittingDeposit}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition active:scale-98 shadow flex items-center justify-center gap-1.5"
          >
            {submittingDeposit ? (
              'Submitting Pending Deposit...'
            ) : (
              <>
                <ArrowDownLeft className="w-4 h-4" /> Submit Deposit Verification
              </>
            )}
          </button>
        </form>
      </div>

      {/* Transaction History (§3 / §5) */}
      <div className="bg-[#121620] border border-gray-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Deposit Request History
          </h4>
          <span className="text-[10px] text-gray-500">{transactions.length} Total</span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-gray-500 py-3 text-center">No recent deposits</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const statusBadges = {
                approved: {
                  bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                  icon: CheckCircle2,
                  label: 'APPROVED & CREDITED',
                },
                pending: {
                  bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
                  icon: Clock,
                  label: 'PENDING ADMIN AUDIT',
                },
                rejected: {
                  bg: 'bg-red-500/20 text-red-400 border-red-500/40',
                  icon: XCircle,
                  label: 'REJECTED',
                },
              };

              const badge = statusBadges[tx.status] || statusBadges.pending;
              const Icon = badge.icon;

              return (
                <div
                  key={tx.id}
                  className="p-2.5 bg-[#161B26] rounded-xl border border-gray-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white font-mono">
                        +{tx.amount.toFixed(2)} ETB
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">
                        • {tx.payment_method}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                      Ref: {tx.reference_code}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${badge.bg}`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {badge.label}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </span>
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
