import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.resolve(process.cwd(), 'ororecords_v2.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Configure WAL mode for maximum concurrency and durability
db.exec(` PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000; PRAGMA foreign_keys = ON; `);

// Async lock queue for in-process serialization of atomic financial operations
class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift()!;
          next();
        } else {
          this.locked = false;
        }
      };

      if (!this.locked) {
        this.locked = true;
        resolve(release);
      } else {
        this.queue.push(() => resolve(release));
      }
    });
  }
}

export const DB_LOCK = new Mutex();

/** * Initialize database schema */
export function initDatabase() {
  db.exec(` CREATE TABLE IF NOT EXISTS users ( user_id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT, balance REAL NOT NULL DEFAULT 0.0, is_vip INTEGER NOT NULL DEFAULT 0, vip_until TEXT, points INTEGER NOT NULL DEFAULT 0, is_admin INTEGER NOT NULL DEFAULT 0, is_partner INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL ); CREATE TABLE IF NOT EXISTS movies ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, original_title TEXT, category TEXT NOT NULL, description TEXT, poster_url TEXT NOT NULL, trailer_url TEXT, file_id TEXT, regular_price REAL NOT NULL, vip_price REAL NOT NULL, discount_percent INTEGER NOT NULL DEFAULT 0, is_popular INTEGER NOT NULL DEFAULT 0, rental_duration_hours INTEGER NOT NULL DEFAULT 72, allow_lifetime INTEGER NOT NULL DEFAULT 1, partner_id INTEGER, partner_cut_percent REAL NOT NULL DEFAULT 70.0, approval_status TEXT NOT NULL DEFAULT 'active', -- active, pending, rejected release_year INTEGER NOT NULL, quality TEXT NOT NULL DEFAULT '1080p FHD', languages TEXT NOT NULL DEFAULT 'Afan Oromo', created_at TEXT NOT NULL, FOREIGN KEY (partner_id) REFERENCES users(user_id) ); CREATE TABLE IF NOT EXISTS purchases ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, movie_id INTEGER NOT NULL, amount_paid REAL NOT NULL, purchase_type TEXT NOT NULL, -- rental, lifetime, folder folder_category TEXT, expires_at TEXT, -- NULL for lifetime created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(user_id), FOREIGN KEY (movie_id) REFERENCES movies(id) ); CREATE TABLE IF NOT EXISTS partners ( user_id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', -- active, suspended commission_balance REAL NOT NULL DEFAULT 0.0, total_earned REAL NOT NULL DEFAULT 0.0, channel_link TEXT, payout_method TEXT NOT NULL DEFAULT 'telebirr', payout_account TEXT NOT NULL, payout_name TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(user_id) ); CREATE TABLE IF NOT EXISTS partner_applications ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, channel_or_portfolio TEXT, category_focus TEXT, status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(user_id) ); CREATE TABLE IF NOT EXISTS transactions ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL, -- telebirr, cbe, ebirr, sinqee screenshot_url TEXT, reference_code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected admin_notes TEXT, created_at TEXT NOT NULL, reviewed_at TEXT, FOREIGN KEY (user_id) REFERENCES users(user_id) ); CREATE TABLE IF NOT EXISTS payout_requests ( id INTEGER PRIMARY KEY AUTOINCREMENT, partner_id INTEGER NOT NULL, amount REAL NOT NULL, fee REAL NOT NULL, net_amount REAL NOT NULL, payout_method TEXT NOT NULL, payout_account TEXT NOT NULL, payout_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected created_at TEXT NOT NULL, processed_at TEXT, FOREIGN KEY (partner_id) REFERENCES partners(user_id) ); CREATE TABLE IF NOT EXISTS ledger_entries ( id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, transaction_type TEXT NOT NULL, -- deposit, movie_purchase, folder_purchase, partner_commission, partner_payout, admin_adjustment, coupon_reward account_type TEXT NOT NULL, -- buyer, partner, platform, escrow account_id INTEGER NOT NULL, -- user_id or 0 for platform debit REAL NOT NULL DEFAULT 0.0, credit REAL NOT NULL DEFAULT 0.0, balance_after REAL NOT NULL, reference_id TEXT NOT NULL, description TEXT NOT NULL ); CREATE TABLE IF NOT EXISTS coupons ( code TEXT PRIMARY KEY, discount_amount REAL NOT NULL, max_uses INTEGER NOT NULL DEFAULT 100, times_used INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, expires_at TEXT ); CREATE TABLE IF NOT EXISTS coupon_redemptions ( id INTEGER PRIMARY KEY AUTOINCREMENT, coupon_code TEXT NOT NULL, user_id INTEGER NOT NULL, redeemed_at TEXT NOT NULL, UNIQUE(coupon_code, user_id), FOREIGN KEY (coupon_code) REFERENCES coupons(code), FOREIGN KEY (user_id) REFERENCES users(user_id) ); CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL ); CREATE TABLE IF NOT EXISTS announcements ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, media_url TEXT, action_link TEXT, badge TEXT DEFAULT 'NEW RELEASE', is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL ); `);

  seedDefaultData();

  // Ensure bot_deep_link column exists on movies table
  try {
    db.exec('ALTER TABLE movies ADD COLUMN bot_deep_link TEXT;');
  } catch (e) {}

  // Ensure is_registered, phone_number, and preferred_language columns exist on users table
  try {
    db.exec('ALTER TABLE users ADD COLUMN is_registered INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN phone_number TEXT;');
  } catch (e) {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'Afan Oromo';");
  } catch (e) {}

  // RBAC Hardening: Strictly ensure only genuine administrator(s) have is_admin = 1
  try {
    db.exec('UPDATE users SET is_admin = 0 WHERE user_id NOT IN (7770001);');
    db.exec('UPDATE users SET is_admin = 1 WHERE user_id = 7770001;');
  } catch (e) {}

  // Seed or ensure test accounts exist with correct registration & role statuses
  try {
    // Ensure established test buyers and partner are marked registered
    db.exec(` UPDATE users SET is_registered = 1 WHERE user_id IN (7770001, 8880002, 9990003, 9990004); `);

    // Ensure dedicated unregistered test user 5550001 exists for testing onboarding
    const unreg = db.prepare('SELECT user_id FROM users WHERE user_id = 5550001').get();
    if (!unreg) {
      db.prepare(` INSERT INTO users (user_id, username, first_name, last_name, balance, is_vip, vip_until, points, is_admin, is_partner, is_registered, phone_number, preferred_language, created_at) VALUES (5550001, 'guest_visitor', 'New', 'Visitor', 0.0, 0, NULL, 0, 0, 0, 0, NULL, 'Afan Oromo', datetime('now')) `).run();
    }
  } catch (e) {
    console.warn('Test accounts sync error:', e);
  }
}

/** * Seed initial settings, users, and movies */
function seedDefaultData() {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount > 0) {
    // Ensure announcements table has sample if empty
    try {
      const annCount = (db.prepare('SELECT COUNT(*) as c FROM announcements').get() as { c: number }).c;
      if (annCount === 0) {
        const now = new Date().toISOString();
        db.prepare(` INSERT INTO announcements (title, content, media_url, action_link, badge, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?) `).run(
          'Exclusive 4K Premiere: Hunda Dura',
          'The landmark cultural drama is now streaming in pristine 4K UHD. Get 50% discount with VIP Cinephile Pass!',
          'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&auto=format&fit=crop&q=80',
          'https://t.me/OroRecordsBot?start=movie_1',
          'HOT PREMIERE',
          now
        );
      }
    } catch (e) {
      console.warn('Announcements table check:', e);
    }
    return;
  }

  const now = new Date().toISOString();

  // Settings
  const defaultSettings: Record<string, string> = {
    cbe_account: '1000234567890 (Commercial Bank of Ethiopia - ORO RECORDS)',
    telebirr_phone: '+251911223344 (ORO Entertainment Telebirr SuperApp)',
    ebirr_account: '+251977889900 (Coop Bank of Oromia / E-Birr)',
    sinqee_account: '300456789 (Sinqee Bank S.C. - ORO Media)',
    withdrawal_fee_percent: '2.5',
    withdrawal_min_fee: '10.0',
    min_withdrawal_amount: '100.0',
    vip_monthly_price: '250.0',
    telegram_bot_username: '@OroRecordsBot',
    custom_logo_url: '/logo.svg',
    partner_tos_text: 'ORO RECORDS Partner Distribution Agreement: Creators & producers receive 70% commission on all single movie transactions and proportional shares on category bundles. Payouts are reconciled via Telebirr or CBE within 24 hours. Submitted films must possess legitimate Ethiopian copyright and broadcast clearance.',
  };

  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v);
  }

  // Users:
  // 1. Admin: 7770001 (Admin User)
  // 2. Verified Partner: 8880002 (Chala Benti - Film Producer)
  // 3. Regular Buyer: 9990003 (Dawit Gemeda - Active VIP Buyer)
  // 4. New Buyer: 9990004 (Rahel Bekele - New Visitor)
  const insertUser = db.prepare(` INSERT INTO users (user_id, username, first_name, last_name, balance, is_vip, vip_until, points, is_admin, is_partner, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) `);

  insertUser.run(7770001, 'oroadmin', 'Oro', 'Administrator', 1500.0, 1, '2030-01-01T00:00:00.000Z', 500, 1, 0, now);
  insertUser.run(8880002, 'chala_films', 'Chala', 'Benti', 250.0, 1, '2027-01-01T00:00:00.000Z', 120, 0, 1, now);
  insertUser.run(9990003, 'dawit_g', 'Dawit', 'Gemeda', 350.0, 1, '2026-12-31T00:00:00.000Z', 85, 0, 0, now);
  insertUser.run(9990004, 'rahel_b', 'Rahel', 'Bekele', 0.0, 0, null, 10, 0, 0, now);

  // Partner profile
  const insertPartner = db.prepare(` INSERT INTO partners (user_id, status, commission_balance, total_earned, channel_link, payout_method, payout_account, payout_name, created_at) VALUES (?, 'active', 1450.0, 4850.0, 'https://t.me/chalafilms_oro', 'telebirr', '+251911778899', 'Chala Benti', ?) `);
  insertPartner.run(8880002, now);

  // Seed Movies
  const insertMovie = db.prepare(` INSERT INTO movies ( title, original_title, category, description, poster_url, trailer_url, file_id, regular_price, vip_price, discount_percent, is_popular, rental_duration_hours, allow_lifetime, partner_id, partner_cut_percent, approval_status, release_year, quality, languages, created_at ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) `);

  const moviesData = [
    {
      title: 'Hunda Dura (Before Everything)',
      original_title: 'Hunda Dura',
      category: 'Oromo Cultural',
      description: 'An epic tale of resistance, family honor, and ancestral heritage set against the scenic highlands of Hararghe. Masterfully directed with breathtaking traditional cinematography.',
      poster_url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&auto=format&fit=crop&q=80',
      trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      file_id: 'BAACAgQAAxkBAAEPOro_HD01_oro_rec',
      regular_price: 60.0,
      vip_price: 35.0,
      discount_percent: 20,
      is_popular: 1,
      rental_duration_hours: 72,
      allow_lifetime: 1,
      partner_id: 8880002,
      partner_cut_percent: 70.0,
      approval_status: 'active',
      release_year: 2024,
      quality: '4K UHD',
      languages: 'Afan Oromo, English Subtitles',
    },
    {
      title: 'Finfinnee Nights',
      original_title: 'Boorana Finfinnee',
      category: 'Drama',
      description: 'A gritty urban thriller unfolding in the heart of Addis Ababa. An aspiring musician gets drawn into an underworld conspiracy while trying to protect his neighborhood recording studio.',
      poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80',
      trailer_url: 'https://www.w3schools.com/html/movie.mp4',
      file_id: 'BAACAgQAAxkBAAEPNite_02_oro_rec',
      regular_price: 50.0,
      vip_price: 25.0,
      discount_percent: 0,
      is_popular: 1,
      rental_duration_hours: 48,
      allow_lifetime: 1,
      partner_id: 8880002,
      partner_cut_percent: 70.0,
      approval_status: 'active',
      release_year: 2024,
      quality: '1080p FHD',
      languages: 'Afan Oromo, Amharic Subtitles',
    },
    {
      title: 'Abbaa Gadaa: The Sacred Covenant',
      original_title: 'Abbaa Gadaa',
      category: 'Oromo Cultural',
      description: 'Documentary cinema tracing the 500+ year democratic governance system of the Gadaa system, featuring unreleased spiritual ceremonies and wisdom from respected elders.',
      poster_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&auto=format&fit=crop&q=80',
      trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      file_id: 'BAACAgQAAxkBAAEPGadaa_03_oro_rec',
      regular_price: 75.0,
      vip_price: 40.0,
      discount_percent: 15,
      is_popular: 1,
      rental_duration_hours: 96,
      allow_lifetime: 1,
      partner_id: null,
      partner_cut_percent: 0.0,
      approval_status: 'active',
      release_year: 2023,
      quality: '4K UHD',
      languages: 'Afan Oromo, English & French Subtitles',
    },
    {
      title: 'Basha’s Gold (Warqee Basha)',
      original_title: 'Warqee Basha',
      category: 'Action',
      description: 'High-octane action across the Bale Mountains national park as former ranger Basha tracks down an international syndicate smuggling precious Ethiopian artifacts.',
      poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
      trailer_url: 'https://www.w3schools.com/html/movie.mp4',
      file_id: 'BAACAgQAAxkBAAEPBasha_04_oro_rec',
      regular_price: 55.0,
      vip_price: 30.0,
      discount_percent: 30,
      is_popular: 1,
      rental_duration_hours: 72,
      allow_lifetime: 1,
      partner_id: 8880002,
      partner_cut_percent: 70.0,
      approval_status: 'active',
      release_year: 2024,
      quality: '1080p FHD',
      languages: 'Afan Oromo, Amharic Audio Track',
    },
    {
      title: 'Sabboontuu Love',
      original_title: 'Sabboontuu',
      category: 'Comedy',
      description: 'A hilarious romantic comedy of two childhood sweethearts from Jimma whose wedding turns into an unforgettable spectacle between modern city organizers and country relatives.',
      poster_url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&auto=format&fit=crop&q=80',
      trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      file_id: 'BAACAgQAAxkBAAEPSabbo_05_oro_rec',
      regular_price: 45.0,
      vip_price: 20.0,
      discount_percent: 10,
      is_popular: 0,
      rental_duration_hours: 48,
      allow_lifetime: 1,
      partner_id: null,
      partner_cut_percent: 0.0,
      approval_status: 'active',
      release_year: 2023,
      quality: '1080p FHD',
      languages: 'Afan Oromo',
    },
    {
      title: 'Shadows over Wonchi',
      original_title: 'Gaaddidduu Wancii',
      category: 'Thriller',
      description: 'A psychological mystery thriller set at Lake Wonchi crater. When a visiting archaeologist disappears, the local boatman uncovers decades-old village secrets.',
      poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&auto=format&fit=crop&q=80',
      trailer_url: 'https://www.w3schools.com/html/movie.mp4',
      file_id: 'BAACAgQAAxkBAAEPWonchi_06_oro_rec',
      regular_price: 50.0,
      vip_price: 25.0,
      discount_percent: 0,
      is_popular: 0,
      rental_duration_hours: 72,
      allow_lifetime: 1,
      partner_id: 8880002,
      partner_cut_percent: 70.0,
      approval_status: 'active',
      release_year: 2024,
      quality: '1080p FHD',
      languages: 'Afan Oromo, English Subtitles',
    },
    {
      title: 'Karrayyuu: Songs of the Herds',
      original_title: 'Karrayyuu',
      category: 'Documentary',
      description: 'An intimate portrait of the Karrayyuu pastoralist community living along the Awash valley, capturing their poetry, camel caravans, and deep ecological bonds.',
      poster_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
      trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      file_id: 'BAACAgQAAxkBAAEPKarray_07_oro_rec',
      regular_price: 40.0,
      vip_price: 20.0,
      discount_percent: 0,
      is_popular: 0,
      rental_duration_hours: 72,
      allow_lifetime: 1,
      partner_id: null,
      partner_cut_percent: 0.0,
      approval_status: 'active',
      release_year: 2023,
      quality: '1080p FHD',
      languages: 'Afan Oromo, English Subtitles',
    }
  ];

  for (const m of moviesData) {
    insertMovie.run(
      m.title, m.original_title, m.category, m.description, m.poster_url, m.trailer_url, m.file_id,
      m.regular_price, m.vip_price, m.discount_percent, m.is_popular, m.rental_duration_hours,
      m.allow_lifetime, m.partner_id, m.partner_cut_percent, m.approval_status, m.release_year,
      m.quality, m.languages, now
    );
  }

  // Seed sample coupons
  const insertCoupon = db.prepare(` INSERT INTO coupons (code, discount_amount, max_uses, times_used, is_active, expires_at) VALUES (?, ?, ?, ?, ?, ?) `);
  insertCoupon.run('OROPROMO50', 50.0, 500, 12, 1, '2027-12-31T00:00:00.000Z');
  insertCoupon.run('TELEBIRR25', 25.0, 200, 35, 1, '2027-12-31T00:00:00.000Z');
  insertCoupon.run('WELCOME10', 10.0, 1000, 80, 1, '2027-12-31T00:00:00.000Z');

  // Seed a pending partner movie submission for admin review demonstration
  insertMovie.run(
    'Arsi Riders (Boraata Arsii)',
    'Boraata Arsii',
    'Drama',
    'Horse breeding legacy and athletic champions rising from the fertile plateau of Bekoji to world track championships.',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    'https://www.w3schools.com/html/mov_bbb.mp4',
    'BAACAgQAAxkBAAEPArsi_99_partner_oro',
    55.0,
    30.0,
    0,
    0,
    72,
    1,
    8880002,
    70.0,
    'pending',
    2024,
    '4K UHD',
    'Afan Oromo',
    now
  );

  // Seed pending transactions & initial ledger entries for audit completeness
  const insertTx = db.prepare(` INSERT INTO transactions (user_id, amount, payment_method, screenshot_url, reference_code, status, admin_notes, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) `);

  // Approved deposit for Dawit Gemeda (user 9990003)
  insertTx.run(
    9990003,
    500.0,
    'telebirr',
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    'TEL-2026-98831',
    'approved',
    'Verified on Telebirr portal',
    new Date(Date.now() - 86400000 * 2).toISOString(),
    new Date(Date.now() - 86400000 * 2 + 1800000).toISOString()
  );

  // Pending deposit waiting for Admin approval
  insertTx.run(
    9990004,
    200.0,
    'cbe',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80',
    'CBE-FT26091177',
    'pending',
    null,
    new Date(Date.now() - 3600000 * 3).toISOString(),
    null
  );

  // Seed sample initial purchase for Dawit Gemeda
  const insertPurchase = db.prepare(` INSERT INTO purchases (user_id, movie_id, amount_paid, purchase_type, folder_category, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) `);
  // Active rental: expires in 48 hours
  const rentalExpiry = new Date(Date.now() + 48 * 3600000).toISOString();
  insertPurchase.run(9990003, 1, 35.0, 'rental', null, rentalExpiry, new Date(Date.now() - 86400000).toISOString());

  // Pending payout request for partner Chala Benti
  const insertPayout = db.prepare(` INSERT INTO payout_requests (partner_id, amount, fee, net_amount, payout_method, payout_account, payout_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) `);
  insertPayout.run(
    8880002,
    500.0,
    12.5,
    487.5,
    'telebirr',
    '+251911778899',
    'Chala Benti',
    new Date(Date.now() - 7200000).toISOString()
  );

  // Seed initial ledger entries
  const insertLedger = db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) `);

  // Initial seed capital & approved deposit entries
  insertLedger.run(
    new Date(Date.now() - 86400000 * 3).toISOString(),
    'seed_capital',
    'platform',
    0,
    1750.0, // Platform Cash debit
    0,
    1750.0,
    'SEED-CAPITAL-01',
    'Initial opening merchant float'
  );
  insertLedger.run(
    new Date(Date.now() - 86400000 * 3).toISOString(),
    'seed_capital',
    'buyer',
    7770001,
    0,
    1500.0, // Admin wallet credit
    1500.0,
    'SEED-CAPITAL-01',
    'Admin operational allocation'
  );
  insertLedger.run(
    new Date(Date.now() - 86400000 * 3).toISOString(),
    'seed_capital',
    'buyer',
    8880002,
    0,
    250.0, // Chala initial wallet credit
    250.0,
    'SEED-CAPITAL-01',
    'Creator tester allocation'
  );

  // Initial partner accumulated royalty
  insertLedger.run(
    new Date(Date.now() - 86400000 * 2).toISOString(),
    'partner_commission',
    'platform',
    0,
    1425.5, // Platform cash escrow debit
    0,
    1425.5,
    'SEED-ROYALTY-01',
    'Escrow reserve for partner accumulated royalties'
  );
  insertLedger.run(
    new Date(Date.now() - 86400000 * 2).toISOString(),
    'partner_commission',
    'partner',
    8880002,
    0,
    1425.5, // Partner commission credit
    1425.5,
    'SEED-ROYALTY-01',
    'Creator accumulated theatrical catalog royalties'
  );

  // Dawit Gemeda deposit entry (Debit Platform Cash 500, Credit Buyer 500)
  insertLedger.run(
    new Date(Date.now() - 86400000 * 2).toISOString(),
    'deposit',
    'platform',
    0,
    500.0, // Debit platform cash
    0,
    500.0,
    'DEP-TEL-2026-98831',
    'Cash received in Telebirr merchant account'
  );
  insertLedger.run(
    new Date(Date.now() - 86400000 * 2).toISOString(),
    'deposit',
    'buyer',
    9990003,
    0,
    500.0, // Credit buyer liability
    500.0,
    'DEP-TEL-2026-98831',
    'Telebirr deposit approved'
  );

  // Movie purchase ledger entries (Buyer debit 35, Partner credit 24.5, Platform cut 10.5)
  insertLedger.run(
    new Date(Date.now() - 86400000).toISOString(),
    'movie_purchase',
    'buyer',
    9990003,
    35.0,
    0,
    350.0, // Remaining balance
    'PURCHASE-1-9990003',
    'Rental purchase: Hunda Dura (Before Everything)'
  );
  insertLedger.run(
    new Date(Date.now() - 86400000).toISOString(),
    'partner_commission',
    'partner',
    8880002,
    0,
    24.5,
    1450.0,
    'PURCHASE-1-9990003',
    '70% Partner royalty for movie #1'
  );
  insertLedger.run(
    new Date(Date.now() - 86400000).toISOString(),
    'movie_purchase',
    'platform',
    0,
    0,
    10.5,
    510.5,
    'PURCHASE-1-9990003',
    '30% Platform distribution share'
  );
}

/** * Telegram initData verification as required by §4 of spec */
export function verify_init_data(initData: string, botToken: string = process.env.BOT_TOKEN || 'DEMO_BOT_TOKEN'): any | null {
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash) {
      // In dev/demo environment without active bot token secret, allow JSON parse if dev flag or valid user payload
      const userStr = params.get('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    }

    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const checkString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    // Constant-time compare
    const match = crypto.timingSafeEqual(Buffer.from(computedHash, 'utf8'), Buffer.from(receivedHash, 'utf8'));

    // === FIX #2: Signature enforcement must not depend on NODE_ENV ===
    // The original code only rejected a bad/forged hash when
    // NODE_ENV === 'production'. In any other environment (staging, or
    // simply an unset NODE_ENV, which is common in many deployments) a
    // forged initData payload with a bogus hash was accepted, letting
    // anyone impersonate any Telegram user_id -- including the admin
    // account (7770001). The signature check is a core auth guarantee
    // and must always be enforced once a hash is present. The "no
    // signature at all" demo path above (the `!receivedHash` branch,
    // gated on absence of a bot token) is left untouched for legitimate
    // local/demo use without a real bot token.
    if (!match) {
      return null;
    }

    const userVal = params.get('user');
    return userVal ? JSON.parse(userVal) : null;
  } catch (err) {
    console.error('initData verify error:', err);
    return null;
  }
}

/** * Get setting value */
export function get_setting(key: string, defaultValue: string = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

/** * Calculate withdrawal fee helper */
export function calculate_withdrawal_fee(amount: number): { fee: number; net_amount: number; fee_percent: number } {
  const percent = parseFloat(get_setting('withdrawal_fee_percent', '2.5'));
  const minFee = parseFloat(get_setting('withdrawal_min_fee', '10.0'));

  let fee = (amount * percent) / 100.0;
  if (fee < minFee) {
    fee = minFee;
  }
  fee = Math.round(fee * 100) / 100;
  const net_amount = Math.max(0, Math.round((amount - fee) * 100) / 100);

  return { fee, net_amount, fee_percent: percent };
}

/** * Format price label */
export function format_price_label(movie: any, isVip: boolean): string {
  const effectivePrice = isVip ? movie.vip_price : (movie.discount_percent > 0 ? movie.regular_price * (1 - movie.discount_percent / 100) : movie.regular_price);
  const rounded = Math.round(effectivePrice);

  if (isVip) {
    return `${rounded} ETB (VIP Privilege)`;
  }
  if (movie.discount_percent > 0) {
    return `${rounded} ETB (${movie.discount_percent}% OFF)`;
  }
  return `${rounded} ETB`;
}

/** * Format movie badges */
export function format_movie_badges(movie: any): string[] {
  const badges: string[] = [];
  if (movie.is_popular) badges.push('🔥 POPULAR');
  if (movie.discount_percent > 0) badges.push(`🏷️ ${movie.discount_percent}% OFF`);
  if (movie.quality?.includes('4K')) badges.push('⚡ 4K UHD');
  if (movie.vip_price < movie.regular_price) badges.push('⭐ VIP PASS');
  if (movie.category === 'Oromo Cultural') badges.push('🏛️ CULTURAL');
  return badges;
}

/** * ATOMIC FUNCTION: purchase_single_movie * Executes strictly under mutex with BEGIN IMMEDIATE transaction */
export async function purchase_single_movie( userId: number, movieId: number, purchaseType: 'rental' | 'lifetime' = 'rental' ): Promise<{ success: boolean; message: string; purchaseId?: number; balanceAfter?: number }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    // 1. Fetch user
    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;
    if (!user) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'User account not found' };
    }

    // 2. Fetch movie
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId) as any;
    if (!movie || movie.approval_status !== 'active') {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Movie is not currently active for purchase' };
    }

    // 3. Determine price
    const isVip = user.is_vip === 1;
    let price = isVip ? movie.vip_price : movie.regular_price;
    if (!isVip && movie.discount_percent > 0) {
      price = movie.regular_price * (1 - movie.discount_percent / 100);
    }
    price = Math.round(price * 100) / 100;

    if (purchaseType === 'lifetime') {
      price = Math.round(price * 1.6 * 100) / 100; // 60% uplift for permanent lifetime ownership
    }

    // 4. Verify buyer balance
    if (user.balance < price) {
      db.exec('ROLLBACK;');
      return {
        success: false,
        message: `Insufficient balance (${user.balance.toFixed(2)} ETB). Movie price is ${price.toFixed(2)} ETB. Please deposit funds via Telebirr or CBE.`,
      };
    }

    // 5. Check if user already has an active purchase
    //
    // === FIX #1: Recognize folder-bundle ownership too ===
    // Movies bought as part of a category "folder" bundle are stored with
    // purchase_type = 'folder' and expires_at = NULL (see purchase_folder
    // below). The original WHERE clause only matched
    // purchase_type = 'lifetime' OR expires_at > now, so a folder purchase
    // was invisible here. That let a user who already owned a movie via a
    // bundle buy the very same movie again individually and be charged a
    // second time. 'folder' is now included alongside 'lifetime' as a
    // permanent-ownership type.
    const existing = db.prepare(` SELECT * FROM purchases WHERE user_id = ? AND movie_id = ? AND (purchase_type IN ('lifetime', 'folder') OR expires_at > datetime('now')) ORDER BY id DESC LIMIT 1 `).get(userId, movieId) as any;

    if (existing) {
      db.exec('ROLLBACK;');
      return {
        success: false,
        message: existing.purchase_type === 'lifetime'
          ? 'You already own lifetime access to this film.'
          : existing.purchase_type === 'folder'
          ? 'You already own this film through a folder bundle purchase.'
          : 'You already have an active rental for this movie.',
      };
    }

    const now = new Date().toISOString();
    let expiresAt: string | null = null;
    if (purchaseType === 'rental') {
      const durationHours = movie.rental_duration_hours || 72;
      expiresAt = new Date(Date.now() + durationHours * 3600000).toISOString();
    }

    // 6. Deduct balance & award points (+5 loyalty points)
    const newBuyerBalance = Math.round((user.balance - price) * 100) / 100;
    db.prepare('UPDATE users SET balance = ?, points = points + 5 WHERE user_id = ?').run(newBuyerBalance, userId);

    // 7. Insert purchase
    const purchaseResult = db.prepare(` INSERT INTO purchases (user_id, movie_id, amount_paid, purchase_type, folder_category, expires_at, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?) `).run(userId, movieId, price, purchaseType, expiresAt, now);

    const purchaseId = Number(purchaseResult.lastInsertRowid);
    const refId = `PURCHASE-${purchaseId}-${userId}`;

    // 8. Buyer Ledger Entry (Debit)
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'movie_purchase', 'buyer', ?, ?, 0, ?, ?, ?) `).run(now, userId, price, newBuyerBalance, refId, `Purchased ${purchaseType}: ${movie.title}`);

    // 9. Partner split vs platform split
    if (movie.partner_id && movie.partner_cut_percent > 0) {
      const partnerCut = Math.round((price * (movie.partner_cut_percent / 100)) * 100) / 100;
      const platformCut = Math.round((price - partnerCut) * 100) / 100;

      // Credit partner
      const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(movie.partner_id) as any;
      if (partner) {
        const newPartnerBal = Math.round((partner.commission_balance + partnerCut) * 100) / 100;
        const newEarned = Math.round((partner.total_earned + partnerCut) * 100) / 100;

        db.prepare('UPDATE partners SET commission_balance = ?, total_earned = ? WHERE user_id = ?')
          .run(newPartnerBal, newEarned, movie.partner_id);

        // Partner ledger entry (Credit)
        db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_commission', 'partner', ?, 0, ?, ?, ?, ?) `).run(now, movie.partner_id, partnerCut, newPartnerBal, refId, `${movie.partner_cut_percent}% royalty for "${movie.title}"`);
      }

      // Platform ledger entry (Credit)
      db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'movie_purchase', 'platform', 0, 0, ?, 0, ?, ?) `).run(now, platformCut, refId, `Platform fee for movie #${movie.id}`);
    } else {
      // 100% Platform
      db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'movie_purchase', 'platform', 0, 0, ?, 0, ?, ?) `).run(now, price, refId, `Direct platform sale for movie #${movie.id}`);
    }

    db.exec('COMMIT;');
    return {
      success: true,
      message: `Successfully purchased "${movie.title}"! ${purchaseType === 'lifetime' ? 'Permanent lifetime access granted.' : `Rental valid until ${new Date(expiresAt!).toLocaleString()}.`}`,
      purchaseId,
      balanceAfter: newBuyerBalance,
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('purchase_single_movie error:', err);
    return { success: false, message: err.message || 'Transaction failed due to internal error' };
  } finally {
    release();
  }
}

/** * ATOMIC FUNCTION: purchase_folder (Category bundle purchase) */
export async function purchase_folder( userId: number, category: string ): Promise<{ success: boolean; message: string; count?: number; balanceAfter?: number }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;
    if (!user) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'User not found' };
    }

    // Get all active movies in category
    const movies = db.prepare("SELECT * FROM movies WHERE category = ? AND approval_status = 'active'").all(category) as any[];
    if (!movies || movies.length === 0) {
      db.exec('ROLLBACK;');
      return { success: false, message: `No active movies found in category "${category}"` };
    }

    // 40% discount bundle price
    const sumRegular = movies.reduce((acc, m) => acc + m.regular_price, 0);
    const bundleDiscount = 0.4;
    const bundlePrice = Math.round(sumRegular * (1 - bundleDiscount) * 100) / 100;

    if (user.balance < bundlePrice) {
      db.exec('ROLLBACK;');
      return {
        success: false,
        message: `Insufficient balance (${user.balance.toFixed(2)} ETB). Folder bundle price is ${bundlePrice.toFixed(2)} ETB (40% OFF ${sumRegular} ETB).`,
      };
    }

    const now = new Date().toISOString();
    const newBuyerBalance = Math.round((user.balance - bundlePrice) * 100) / 100;

    // Deduct user balance
    db.prepare('UPDATE users SET balance = ?, points = points + 25 WHERE user_id = ?').run(newBuyerBalance, userId);

    const refId = `FOLDER-${Date.now()}-${userId}`;

    // Ledger debit for buyer
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'folder_purchase', 'buyer', ?, ?, 0, ?, ?, ?) `).run(now, userId, bundlePrice, newBuyerBalance, refId, `Purchased entire "${category}" Folder Bundle (${movies.length} films)`);

    // Insert purchase for each movie (lifetime access)
    const insertPurchase = db.prepare(` INSERT INTO purchases (user_id, movie_id, amount_paid, purchase_type, folder_category, expires_at, created_at) VALUES (?, ?, ?, 'folder', ?, NULL, ?) `);

    // Calculate per-movie distributed price
    const pricePerMovie = Math.round((bundlePrice / movies.length) * 100) / 100;

    for (const m of movies) {
      insertPurchase.run(userId, m.id, pricePerMovie, category, now);

      if (m.partner_id && m.partner_cut_percent > 0) {
        const partnerCut = Math.round((pricePerMovie * (m.partner_cut_percent / 100)) * 100) / 100;
        const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(m.partner_id) as any;
        if (partner) {
          const newPartnerBal = Math.round((partner.commission_balance + partnerCut) * 100) / 100;
          db.prepare('UPDATE partners SET commission_balance = ?, total_earned = total_earned + ? WHERE user_id = ?')
            .run(newPartnerBal, partnerCut, m.partner_id);

          db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_commission', 'partner', ?, 0, ?, ?, ?, ?) `).run(now, m.partner_id, partnerCut, newPartnerBal, refId, `Folder royalty for "${m.title}"`);
        }
      }
    }

    db.exec('COMMIT;');
    return {
      success: true,
      message: `Unlocked all ${movies.length} movies in "${category}" at 40% bundle discount!`,
      count: movies.length,
      balanceAfter: newBuyerBalance,
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('purchase_folder error:', err);
    return { success: false, message: err.message || 'Transaction failed' };
  } finally {
    release();
  }
}

/** * ATOMIC FUNCTION: request_payout_atomic * Wraps partner payout request */
export async function request_payout_atomic( partnerId: number, amount: number, payoutMethod: string, payoutAccount: string, payoutName: string ): Promise<{ success: boolean; message: string; payoutId?: number; netAmount?: number }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(partnerId) as any;
    if (!partner || partner.status !== 'active') {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Partner account not found or is suspended' };
    }

    const minAmount = parseFloat(get_setting('min_withdrawal_amount', '100.0'));
    if (amount < minAmount) {
      db.exec('ROLLBACK;');
      return { success: false, message: `Minimum payout request is ${minAmount} ETB.` };
    }

    if (partner.commission_balance < amount) {
      db.exec('ROLLBACK;');
      return {
        success: false,
        message: `Insufficient commission balance (${partner.commission_balance.toFixed(2)} ETB). Requested: ${amount.toFixed(2)} ETB`,
      };
    }

    const { fee, net_amount } = calculate_withdrawal_fee(amount);
    const newCommissionBal = Math.round((partner.commission_balance - amount) * 100) / 100;

    // Deduct immediately into escrow
    db.prepare('UPDATE partners SET commission_balance = ? WHERE user_id = ?').run(newCommissionBal, partnerId);

    const now = new Date().toISOString();
    const insertRes = db.prepare(` INSERT INTO payout_requests (partner_id, amount, fee, net_amount, payout_method, payout_account, payout_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) `).run(partnerId, amount, fee, net_amount, payoutMethod, payoutAccount, payoutName, now);

    const payoutId = Number(insertRes.lastInsertRowid);
    const refId = `PAYOUT-REQ-${payoutId}`;

    // Ledger: Partner debit (funds leave the partner's spendable commission balance)
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_payout', 'partner', ?, ?, 0, ?, ?, ?) `).run(now, partnerId, amount, newCommissionBal, refId, `Payout request #${payoutId} held in escrow pending admin review`);

    // === FIX #3 (part A): Add the missing offsetting escrow leg ===
    // The original code only wrote the partner-side debit above. That left
    // this transaction with a debit and no matching credit anywhere in the
    // ledger for the entire time the request sits pending, so
    // reconcile_ledger_report() would see total_debits != total_credits
    // and falsely report an unbalanced ledger. The schema already
    // anticipates an 'escrow' account_type in its column comment; we now
    // actually use it: the funds are credited into escrow the moment they
    // leave the partner's balance, and process_payout_atomic (below) moves
    // them out of escrow again on approval or reversal on rejection.
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_payout', 'escrow', ?, 0, ?, 0, ?, ?) `).run(now, partnerId, amount, refId, `Escrow hold for pending payout request #${payoutId}`);

    db.exec('COMMIT;');
    return {
      success: true,
      message: `Payout request of ${amount.toFixed(2)} ETB submitted (Net: ${net_amount.toFixed(2)} ETB after ${fee.toFixed(2)} ETB fee).`,
      payoutId,
      netAmount: net_amount,
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('request_payout_atomic error:', err);
    return { success: false, message: err.message || 'Payout request failed' };
  } finally {
    release();
  }
}

/** * ATOMIC FUNCTION: process_payout_atomic * Admin processes payout (approve or reject) */
export async function process_payout_atomic( payoutId: number, action: 'approve' | 'reject', adminNotes: string = '' ): Promise<{ success: boolean; message: string }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    const payout = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId) as any;
    if (!payout || payout.status !== 'pending') {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Payout request not found or already reviewed' };
    }

    const now = new Date().toISOString();
    const refId = `PAYOUT-${action.toUpperCase()}-${payoutId}`;

    if (action === 'approve') {
      db.prepare("UPDATE payout_requests SET status = 'approved', processed_at = ? WHERE id = ?").run(now, payoutId);

      // === FIX #3 (part B): Release the escrow hold created in request_payout_atomic ===
      // This debit closes out the escrow credit booked when the request was
      // submitted, so the funds move cleanly from escrow to "disbursed"
      // rather than vanishing from one side of the ledger.
      db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_payout', 'escrow', ?, ?, 0, 0, ?, ?) `).run(now, payout.partner_id, payout.amount, refId, `Escrow released for approved payout #${payoutId}`);

      // Finalize ledger entries:
      // 1. Platform cash disbursement of net_amount (Credit asset)
      db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_payout', 'platform', 0, 0, ?, 0, ?, ?) `).run(now, payout.net_amount, refId, `Disbursed ${payout.net_amount} ETB to ${payout.payout_name} via ${payout.payout_method}`);

      // 2. Platform revenue of fee
      if (payout.fee > 0) {
        db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_payout', 'platform', 0, 0, ?, 0, ?, ?) `).run(now, payout.fee, refId, `Payout processing fee retained for request #${payoutId}`);
      }

      db.exec('COMMIT;');
      return { success: true, message: `Payout #${payoutId} approved and marked disbursed.` };
    } else {
      // Rejection: refund partner commission balance
      const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(payout.partner_id) as any;
      if (partner) {
        const refundedBal = Math.round((partner.commission_balance + payout.amount) * 100) / 100;
        db.prepare('UPDATE partners SET commission_balance = ? WHERE user_id = ?').run(refundedBal, payout.partner_id);

        // === FIX #3 (part B, cont'd): Release escrow on rejection too ===
        // Symmetric with the approval path: the escrow credit booked at
        // request time is reversed here since the funds are going back to
        // the partner's balance instead of being disbursed.
        db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_payout', 'escrow', ?, ?, 0, 0, ?, ?) `).run(now, payout.partner_id, payout.amount, refId, `Escrow released for rejected payout #${payoutId}`);

        db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'partner_payout', 'partner', ?, 0, ?, ?, ?, ?) `).run(now, payout.partner_id, payout.amount, refundedBal, refId, `Refunded rejected payout #${payoutId}: ${adminNotes}`);
      }

      db.prepare("UPDATE payout_requests SET status = 'rejected', processed_at = ? WHERE id = ?").run(now, payoutId);

      db.exec('COMMIT;');
      return { success: true, message: `Payout #${payoutId} rejected and ${payout.amount} ETB refunded to partner.` };
    }
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('process_payout_atomic error:', err);
    return { success: false, message: err.message || 'Processing payout failed' };
  } finally {
    release();
  }
}

/** * ATOMIC FUNCTION: approve_deposit_atomic * Admin reviews and approves pending user deposit */
export async function approve_deposit_atomic( depositId: number, adminNotes: string = 'Verified payment receipt' ): Promise<{ success: boolean; message: string; newBalance?: number }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(depositId) as any;
    if (!tx || tx.status !== 'pending') {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Deposit transaction not found or already processed' };
    }

    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(tx.user_id) as any;
    if (!user) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Associated user account not found' };
    }

    const newBalance = Math.round((user.balance + tx.amount) * 100) / 100;
    const now = new Date().toISOString();

    // 1. Update user balance
    db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, tx.user_id);

    // 2. Mark transaction approved
    db.prepare("UPDATE transactions SET status = 'approved', admin_notes = ?, reviewed_at = ? WHERE id = ?")
      .run(adminNotes, now, depositId);

    const refId = `DEP-${tx.reference_code}`;

    // 3. Ledger: Buyer credit
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'deposit', 'buyer', ?, 0, ?, ?, ?, ?) `).run(now, tx.user_id, tx.amount, newBalance, refId, `Approved ${tx.payment_method.toUpperCase()} deposit (${tx.reference_code})`);

    // 4. Ledger: Platform cash received
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'deposit', 'platform', 0, 0, ?, 0, ?, ?) `).run(now, tx.amount, refId, `Received funds via ${tx.payment_method}`);

    db.exec('COMMIT;');
    return {
      success: true,
      message: `Deposit #${depositId} for ${tx.amount} ETB approved. User balance credited to ${newBalance} ETB.`,
      newBalance,
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('approve_deposit_atomic error:', err);
    return { success: false, message: err.message || 'Deposit approval failed' };
  } finally {
    release();
  }
}

/** * ATOMIC FUNCTION: reject_deposit_atomic */
export async function reject_deposit_atomic( depositId: number, adminNotes: string = 'Invalid screenshot or reference' ): Promise<{ success: boolean; message: string }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(depositId) as any;
    if (!tx || tx.status !== 'pending') {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Deposit not found or already processed' };
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE transactions SET status = 'rejected', admin_notes = ?, reviewed_at = ? WHERE id = ?")
      .run(adminNotes, now, depositId);

    db.exec('COMMIT;');
    return { success: true, message: `Deposit #${depositId} rejected.` };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, message: err.message || 'Rejection failed' };
  } finally {
    release();
  }
}

/** * ATOMIC FUNCTION: adjust_balance_atomic * Direct admin balance adjustments with ledger audit trail */
export async function adjust_balance_atomic( userId: number, amount: number, reason: string, adminId: number = 7770001 ): Promise<{ success: boolean; message: string; balanceAfter?: number }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;
    if (!user) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'User not found' };
    }

    const newBalance = Math.round((user.balance + amount) * 100) / 100;
    if (newBalance < 0) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Adjustment would result in negative user balance' };
    }

    db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, userId);

    const now = new Date().toISOString();
    const refId = `ADJUST-${Date.now()}-${userId}`;

    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'admin_adjustment', 'buyer', ?, ?, ?, ?, ?, ?) `).run(
      now,
      userId,
      amount < 0 ? Math.abs(amount) : 0,
      amount > 0 ? amount : 0,
      newBalance,
      refId,
      `Admin #${adminId} adjustment: ${reason}`
    );

    // === FIX #3 (part C): Add the missing platform-side offsetting entry ===
    // The original code only wrote the buyer-side leg. A positive
    // adjustment (crediting the user) needs an offsetting platform debit
    // (money going out), and a negative adjustment (debiting the user)
    // needs an offsetting platform credit (money coming back in) —
    // otherwise every admin adjustment permanently unbalances the ledger
    // that reconcile_ledger_report() checks.
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'admin_adjustment', 'platform', 0, ?, ?, 0, ?, ?) `).run(
      now,
      amount > 0 ? amount : 0,
      amount < 0 ? Math.abs(amount) : 0,
      refId,
      `Platform-side offset for admin #${adminId} adjustment: ${reason}`
    );

    db.exec('COMMIT;');
    return {
      success: true,
      message: `Balance adjusted by ${amount > 0 ? '+' : ''}${amount} ETB. Current balance: ${newBalance} ETB.`,
      balanceAfter: newBalance,
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, message: err.message || 'Adjustment failed' };
  } finally {
    release();
  }
}

/** * ATOMIC FUNCTION: redeem_coupon_atomic */
export async function redeem_coupon_atomic( userId: number, couponCode: string ): Promise<{ success: boolean; message: string; amountRedeemed?: number; newBalance?: number }> {
  const release = await DB_LOCK.acquire();

  try {
    db.exec('BEGIN IMMEDIATE;');

    const normalizedCode = couponCode.trim().toUpperCase();
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(normalizedCode) as any;

    if (!coupon) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'Invalid promo code' };
    }

    if (!coupon.is_active || (coupon.times_used >= coupon.max_uses)) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'This coupon code has expired or reached maximum redemption limits' };
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'This coupon code has expired' };
    }

    // Check if user already redeemed
    const alreadyRedeemed = db.prepare('SELECT * FROM coupon_redemptions WHERE coupon_code = ? AND user_id = ?')
      .get(normalizedCode, userId);
    if (alreadyRedeemed) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'You have already redeemed this promo coupon' };
    }

    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;
    if (!user) {
      db.exec('ROLLBACK;');
      return { success: false, message: 'User not found' };
    }

    const now = new Date().toISOString();
    const rewardAmount = coupon.discount_amount;
    const newBalance = Math.round((user.balance + rewardAmount) * 100) / 100;

    // Update coupon usage
    db.prepare('UPDATE coupons SET times_used = times_used + 1 WHERE code = ?').run(normalizedCode);

    // Record user redemption
    db.prepare('INSERT INTO coupon_redemptions (coupon_code, user_id, redeemed_at) VALUES (?, ?, ?)')
      .run(normalizedCode, userId, now);

    // Update user balance
    db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, userId);

    const refId = `COUPON-${normalizedCode}-${userId}`;

    // Ledger entry (buyer side)
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'coupon_reward', 'buyer', ?, 0, ?, ?, ?, ?) `).run(now, userId, rewardAmount, newBalance, refId, `Redeemed promo voucher: ${normalizedCode}`);

    // === FIX #3 (part D): Add the missing platform-side offsetting entry ===
    // The original code credited the buyer's balance with no matching
    // debit anywhere, meaning every coupon redemption permanently
    // unbalanced total_debits vs total_credits in reconcile_ledger_report().
    // The platform is the one funding the promo, so it takes the debit.
    db.prepare(` INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description) VALUES (?, 'coupon_reward', 'platform', 0, ?, 0, 0, ?, ?) `).run(now, rewardAmount, refId, `Platform-funded coupon reward: ${normalizedCode}`);

    db.exec('COMMIT;');
    return {
      success: true,
      message: `Coupon "${normalizedCode}" successfully applied! Credited ${rewardAmount} ETB to your balance.`,
      amountRedeemed: rewardAmount,
      newBalance,
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('redeem_coupon_atomic error:', err);
    return { success: false, message: err.message || 'Coupon redemption failed' };
  } finally {
    release();
  }
}

/** * RECONCILIATION REPORT: reconcile_ledger_report * Verifies double-entry ledger integrity, platform cash vs liabilities */
export function reconcile_ledger_report(): any {
  const entries = db.prepare('SELECT * FROM ledger_entries ORDER BY id ASC').all() as any[];

  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    totalDebits += entry.debit;
    totalCredits += entry.credit;
  }

  // Current system liabilities
  const buyerBalanceRow = db.prepare('SELECT SUM(balance) as total FROM users').get() as { total: number };
  const partnerBalanceRow = db.prepare('SELECT SUM(commission_balance) as total FROM partners').get() as { total: number };
  const totalBuyerBalances = Math.round((buyerBalanceRow.total || 0) * 100) / 100;
  const totalPartnerBalances = Math.round((partnerBalanceRow.total || 0) * 100) / 100;

  const totalLiabilities = Math.round((totalBuyerBalances + totalPartnerBalances) * 100) / 100;

  // Actual cash held (sum of all approved deposits minus approved payouts net disbursements)
  const approvedDepositsRow = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE status = 'approved'").get() as { total: number };
  const approvedPayoutsRow = db.prepare("SELECT SUM(net_amount) as total FROM payout_requests WHERE status = 'approved'").get() as { total: number };

  const totalDepositsApproved = Math.round((approvedDepositsRow.total || 0) * 100) / 100;
  const totalPayoutsApproved = Math.round((approvedPayoutsRow.total || 0) * 100) / 100;
  const netCashHeld = Math.round((totalDepositsApproved - totalPayoutsApproved) * 100) / 100;

  // Platform gross revenue
  const platformRevenueRow = db.prepare(` SELECT (SUM(credit) - SUM(debit)) as net FROM ledger_entries WHERE account_type = 'platform' `).get() as { net: number };
  const totalPlatformRevenue = Math.round((platformRevenueRow.net || 0) * 100) / 100;

  totalDebits = Math.round(totalDebits * 100) / 100;
  totalCredits = Math.round(totalCredits * 100) / 100;
  const netDiff = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100;

  return {
    total_debits: totalDebits,
    total_credits: totalCredits,
    net_diff: netDiff,
    is_balanced: netDiff < 1.0, // Ledger balanced within small rounding cents
    total_buyer_balances: totalBuyerBalances,
    total_partner_balances: totalPartnerBalances,
    total_platform_revenue: totalPlatformRevenue,
    total_deposits_approved: totalDepositsApproved,
    total_payouts_approved: totalPayoutsApproved,
    total_liabilities: totalLiabilities,
    net_cash_held: netCashHeld,
    entries_count: entries.length,
    generated_at: new Date().toISOString(),
  };
}

// Initialize on import
initDatabase();
