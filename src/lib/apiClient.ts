import {
  Movie,
  Purchase,
  User,
  Partner,
  DepositTransaction,
  PayoutRequest,
  LedgerEntry,
  ReconciliationReport,
  PayoutPreview,
  UserProfileResponse,
} from '../types';

// Global state for active mock user in dev/companion preview mode
// Default is regular Registered Buyer (Dawit Gemeda: 9990003), NOT admin
let activeMockUserId: number = 9990003;

export function getActiveUserId(): number {
  return activeMockUserId;
}

export function setActiveUserId(id: number) {
  activeMockUserId = id;
  if (typeof window !== 'undefined') {
    localStorage.setItem('oro_mock_user_id', String(id));
    window.dispatchEvent(new CustomEvent('oro_user_changed', { detail: { userId: id } }));
  }
}

// Initialize from storage if present, defaulting to regular Registered Buyer 9990003
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('oro_mock_user_id');
  if (saved) {
    const num = parseInt(saved, 10);
    if (!isNaN(num)) activeMockUserId = num;
  } else {
    activeMockUserId = 9990003;
    try {
      localStorage.setItem('oro_mock_user_id', '9990003');
    } catch (e) {}
  }
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Telegram WebApp initData if running inside native Telegram client
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
    headers['x-telegram-init-data'] = (window as any).Telegram.WebApp.initData;
  }

  // Active mock user ID for simulator/companion preview
  headers['x-mock-user-id'] = String(activeMockUserId);

  return headers;
}

export const api = {
  // --- Movies & Catalog ---
  async getMovies(params: { category?: string; search?: string; page?: number } = {}) {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));

    const res = await fetch(`/api/movies?${query.toString()}`, { headers: getHeaders() });
    return res.json() as Promise<{
      success: boolean;
      movies: Movie[];
      categories: { category: string; count: number }[];
      is_vip: boolean;
      message?: string;
    }>;
  },

  async getMovie(id: number) {
    const res = await fetch(`/api/movies/${id}`, { headers: getHeaders() });
    return res.json() as Promise<{
      success: boolean;
      movie: Movie;
      user_purchase?: Purchase | null;
      message?: string;
    }>;
  },

  async purchaseMovie(movieId: number, purchaseType: 'rental' | 'lifetime' = 'rental') {
    const res = await fetch(`/api/purchase/${movieId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ purchase_type: purchaseType }),
    });
    return res.json() as Promise<{
      success: boolean;
      message: string;
      purchaseId?: number;
      balanceAfter?: number;
    }>;
  },

  async purchaseFolder(category: string) {
    const res = await fetch(`/api/purchase/folder/${encodeURIComponent(category)}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json() as Promise<{
      success: boolean;
      message: string;
      count?: number;
      balanceAfter?: number;
    }>;
  },

  // --- Buyer Profile & Wallet ---
  async getMe() {
    const res = await fetch('/api/me', { headers: getHeaders() });
    return res.json() as Promise<UserProfileResponse & { success: boolean; message?: string }>;
  },

  // --- Uploads & Announcements ---
  async uploadFile(file: File | Blob, filename?: string) {
    const formData = new FormData();
    formData.append('file', file, filename || (file instanceof File ? file.name : 'upload.jpg'));

    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
      headers['x-telegram-init-data'] = (window as any).Telegram.WebApp.initData;
    }
    headers['x-mock-user-id'] = String(activeMockUserId);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData,
    });
    return res.json() as Promise<{
      success: boolean;
      url: string;
      filename: string;
      size: number;
      message?: string;
    }>;
  },

  async getAnnouncements() {
    const res = await fetch('/api/announcements', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; announcements: any[]; message?: string }>;
  },

  async deposit(data: {
    amount: number;
    payment_method: string;
    reference_code: string;
    screenshot_url?: string;
    screenshot_base64?: string;
    file?: File;
  }) {
    if (data.file) {
      const formData = new FormData();
      formData.append('amount', String(data.amount));
      formData.append('payment_method', data.payment_method);
      if (data.reference_code) formData.append('reference_code', data.reference_code);
      formData.append('screenshot_file', data.file);

      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
        headers['x-telegram-init-data'] = (window as any).Telegram.WebApp.initData;
      }
      headers['x-mock-user-id'] = String(activeMockUserId);

      const res = await fetch('/api/deposit', {
        method: 'POST',
        headers,
        body: formData,
      });
      return res.json() as Promise<{
        success: boolean;
        message: string;
        transaction_id?: number;
        reference_code?: string;
        screenshot_url?: string;
      }>;
    }

    const res = await fetch('/api/deposit', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{
      success: boolean;
      message: string;
      transaction_id?: number;
      reference_code?: string;
      screenshot_url?: string;
    }>;
  },

  async redeemCoupon(code: string) {
    const res = await fetch('/api/coupon/redeem', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    return res.json() as Promise<{
      success: boolean;
      message: string;
      amountRedeemed?: number;
      newBalance?: number;
    }>;
  },

  async subscribeVip() {
    const res = await fetch('/api/vip/subscribe', {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json() as Promise<{
      success: boolean;
      message: string;
      vip_until?: string;
      new_balance?: number;
    }>;
  },

  // --- Partner Endpoints ---
  async applyPartner(data: {
    name: string;
    phone: string;
    channel_or_portfolio: string;
    category_focus: string;
  }) {
    const res = await fetch('/api/partner/apply', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ success: boolean; message: string; application_id?: number }>;
  },

  async uploadPartnerMovie(data: Partial<Movie>) {
    const res = await fetch('/api/partner/movies', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ success: boolean; message: string; movie_id?: number }>;
  },

  async getPartnerSales() {
    const res = await fetch('/api/partner/sales', { headers: getHeaders() });
    return res.json() as Promise<{
      success: boolean;
      partner: Partner;
      movies: any[];
      sales_history: LedgerEntry[];
      payouts: PayoutRequest[];
      message?: string;
    }>;
  },

  async getPartnerPayoutPreview(amount: number) {
    const res = await fetch(`/api/partner/payout/preview?amount=${amount}`, { headers: getHeaders() });
    return res.json() as Promise<PayoutPreview & { success: boolean }>;
  },

  async requestPartnerPayout(data: {
    amount: number;
    payout_method: string;
    payout_account: string;
    payout_name: string;
  }) {
    const res = await fetch('/api/partner/payout', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{
      success: boolean;
      message: string;
      payoutId?: number;
      netAmount?: number;
    }>;
  },

  // --- Admin Endpoints ---
  async getPendingDeposits() {
    const res = await fetch('/api/admin/deposits/pending', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; pending_deposits: any[]; message?: string }>;
  },

  async approveDeposit(id: number, adminNotes?: string) {
    const res = await fetch(`/api/admin/deposits/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ admin_notes: adminNotes }),
    });
    return res.json() as Promise<{ success: boolean; message: string; newBalance?: number }>;
  },

  async rejectDeposit(id: number, adminNotes?: string) {
    const res = await fetch(`/api/admin/deposits/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ admin_notes: adminNotes }),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async getPendingPayouts() {
    const res = await fetch('/api/admin/payouts/pending', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; pending_payouts: any[]; message?: string }>;
  },

  async approvePayout(id: number, adminNotes?: string) {
    const res = await fetch(`/api/admin/payouts/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ admin_notes: adminNotes }),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async rejectPayout(id: number, adminNotes?: string) {
    const res = await fetch(`/api/admin/payouts/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ admin_notes: adminNotes }),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async getPendingMovies() {
    const res = await fetch('/api/admin/movies/pending', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; pending_movies: any[]; message?: string }>;
  },

  async approveMovie(id: number) {
    const res = await fetch(`/api/admin/movies/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async rejectMovie(id: number) {
    const res = await fetch(`/api/admin/movies/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async getPartnerApplications() {
    const res = await fetch('/api/admin/partner/applications', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; applications: any[]; message?: string }>;
  },

  async approvePartnerApplication(id: number) {
    const res = await fetch(`/api/admin/partner/applications/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async getReconciliationReport() {
    const res = await fetch('/api/admin/ledger/reconcile', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; report: ReconciliationReport; message?: string }>;
  },

  async getLedgerEntries(limit = 100) {
    const res = await fetch(`/api/admin/ledger/entries?limit=${limit}`, { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; entries: LedgerEntry[]; message?: string }>;
  },

  async adjustBalance(userId: number, amount: number, reason: string) {
    const res = await fetch('/api/admin/balance/adjust', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ user_id: userId, amount, reason }),
    });
    return res.json() as Promise<{ success: boolean; message: string; balanceAfter?: number }>;
  },

  // --- CMS Content Management System ---
  async getAdminStats() {
    const res = await fetch('/api/admin/stats', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; stats: any; message?: string }>;
  },

  async createMovieCMS(data: any) {
    const res = await fetch('/api/admin/movies', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ success: boolean; message: string; movie?: Movie }>;
  },

  async updateMovieCMS(id: number, data: any) {
    const res = await fetch(`/api/admin/movies/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ success: boolean; message: string; movie?: Movie }>;
  },

  async deleteMovieCMS(id: number) {
    const res = await fetch(`/api/admin/movies/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async createAnnouncement(data: {
    title: string;
    content: string;
    media_url?: string;
    action_link?: string;
    badge?: string;
  }) {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ success: boolean; message: string; id?: number }>;
  },

  async deleteAnnouncement(id: number) {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  async updateSettings(settings: Record<string, string>) {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ settings }),
    });
    return res.json() as Promise<{ success: boolean; message: string }>;
  },

  // --- Common ---
  async getSettings() {
    const res = await fetch('/api/settings', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; settings: Record<string, string> }>;
  },

  async getUsers() {
    const res = await fetch('/api/users', { headers: getHeaders() });
    return res.json() as Promise<{ success: boolean; users: User[]; current_user_id: number }>;
  },

  // --- User Registration & Branding ---
  async registerUser(data: {
    first_name: string;
    last_name?: string;
    phone_number: string;
    username?: string;
    preferred_language: string;
  }) {
    const res = await fetch('/api/user/register', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ success: boolean; message: string; user?: User }>;
  },

  async resetUserRegistration() {
    const res = await fetch('/api/user/reset-registration', {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json() as Promise<{ success: boolean; message: string; user?: User }>;
  },

  async getBranding() {
    const res = await fetch('/api/branding', { headers: getHeaders() });
    return res.json() as Promise<{
      success: boolean;
      logo_url: string;
      brand_name: string;
      accent_color: string;
      admin_whitelist: number[];
    }>;
  },
};

export const apiClient = api;
