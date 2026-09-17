export interface User {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  balance: number;
  is_vip: number;
  vip_until: string | null;
  points: number;
  is_admin: number;
  is_partner: number;
  is_registered?: number;
  phone_number?: string | null;
  preferred_language?: string;
  created_at: string;
}

export interface Movie {
  id: number;
  title: string;
  original_title: string;
  category: string;
  description: string;
  poster_url: string;
  trailer_url: string;
  file_id: string;
  regular_price: number;
  vip_price: number;
  discount_percent: number;
  is_popular: number;
  rental_duration_hours: number;
  allow_lifetime: number;
  partner_id: number | null;
  partner_name?: string;
  partner_cut_percent: number;
  approval_status: 'active' | 'pending' | 'rejected';
  release_year: number;
  quality: string;
  languages: string;
  created_at: string;
  bot_deep_link?: string;
  price_label?: string;
  badges?: string[];
  effective_price?: number;
}

export interface Purchase {
  id: number;
  user_id: number;
  movie_id: number;
  amount_paid: number;
  purchase_type: 'rental' | 'lifetime' | 'folder';
  folder_category: string | null;
  expires_at: string | null;
  created_at: string;
  movie_title?: string;
  original_title?: string;
  category?: string;
  poster_url?: string;
  quality?: string;
  file_id?: string;
  is_expired?: boolean;
  time_left?: string;
}

export interface Partner {
  user_id: number;
  status: 'active' | 'suspended';
  commission_balance: number;
  total_earned: number;
  channel_link: string;
  payout_method: string;
  payout_account: string;
  payout_name: string;
  created_at: string;
}

export interface PartnerApplication {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  channel_or_portfolio: string;
  category_focus: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface DepositTransaction {
  id: number;
  user_id: number;
  user_name?: string;
  amount: number;
  payment_method: 'telebirr' | 'cbe' | 'ebirr' | 'sinqee';
  screenshot_url: string;
  reference_code: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface PayoutRequest {
  id: number;
  partner_id: number;
  partner_name?: string;
  amount: number;
  fee: number;
  net_amount: number;
  payout_method: string;
  payout_account: string;
  payout_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at?: string | null;
}

export interface LedgerEntry {
  id: number;
  timestamp: string;
  transaction_type: 'deposit' | 'movie_purchase' | 'folder_purchase' | 'partner_commission' | 'partner_payout' | 'admin_adjustment' | 'coupon_reward';
  account_type: 'buyer' | 'partner' | 'platform' | 'escrow';
  account_id: number;
  debit: number;
  credit: number;
  balance_after: number;
  reference_id: string;
  description: string;
}

export interface ReconciliationReport {
  total_debits: number;
  total_credits: number;
  net_diff: number;
  is_balanced: boolean;
  total_buyer_balances: number;
  total_partner_balances: number;
  total_platform_revenue: number;
  total_deposits_approved: number;
  total_payouts_approved: number;
  total_liabilities: number;
  net_cash_held: number;
  entries_count: number;
  generated_at: string;
}

export interface PayoutPreview {
  amount: number;
  fee: number;
  net_amount: number;
  fee_percent: number;
  partner_balance: number;
  can_withdraw: boolean;
  error?: string;
}

export interface UserProfileResponse {
  user: User;
  active_purchases_count: number;
  purchases: Purchase[];
  recent_transactions: DepositTransaction[];
  partner?: Partner | null;
  is_partner_application_pending?: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  media_url?: string | null;
  action_link?: string | null;
  badge?: string;
  is_active: number;
  created_at: string;
}

export interface AdminStats {
  total_movies: number;
  active_movies: number;
  pending_movies: number;
  total_users: number;
  total_partners: number;
  pending_deposits_count: number;
  pending_payouts_count: number;
  pending_apps_count: number;
  total_deposits_volume: number;
  total_payouts_volume: number;
}
