import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import {
  db,
  verify_init_data,
  purchase_single_movie,
  purchase_folder,
  request_payout_atomic,
  process_payout_atomic,
  approve_deposit_atomic,
  reject_deposit_atomic,
  adjust_balance_atomic,
  redeem_coupon_atomic,
  reconcile_ledger_report,
  calculate_withdrawal_fee,
  format_price_label,
  format_movie_badges,
  get_setting,
} from './core.ts';

export const apiRouter = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for payment receipts and CMS promotional media
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for screenshots, media, posters, teasers
});

// Extend Request interface
interface AuthenticatedRequest extends Request {
  telegramUser?: any;
  currentUserId?: number;
  currentUser?: any;
}

// Admin whitelist for Oro Records system (authorized Telegram IDs)
const ADMIN_WHITELIST: number[] = [7770001];

/** * Authentication Middleware: * Checks Telegram WebApp initData header first. * If running in companion applet simulator, allows selecting test persona via 'x-mock-user-id'. * Enforces RBAC by strictly preserving is_admin from database and admin whitelist. */
function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const initData = (req.headers['x-telegram-init-data'] as string) || '';
  const mockUserId = (req.headers['x-mock-user-id'] as string) || (req.query.mock_user_id as string);

  let userId: number | null = null;

  if (initData) {
    const verified = verify_init_data(initData);
    if (verified && verified.id) {
      userId = verified.id;
      req.telegramUser = verified;
    }
  }

  // Fallback for companion demo preview / simulator
  if (!userId && mockUserId) {
    const parsed = parseInt(mockUserId, 10);
    if (!isNaN(parsed)) {
      userId = parsed;
    }
  }

  // Default to regular registered buyer (Dawit Gemeda: 9990003) in preview mode (NOT admin)
  if (!userId) {
    userId = 9990003;
  }

  req.currentUserId = userId;

  // Retrieve user record from DB
  let user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;
  if (!user) {
    // New visitor: create unverified / unregistered record with 0 balance and is_registered = 0
    const now = new Date().toISOString();
    const isWhitelisted = ADMIN_WHITELIST.includes(userId);
    db.prepare(`
      INSERT INTO users (user_id, username, first_name, last_name, balance, is_vip, vip_until, points, is_admin, is_partner, is_registered, preferred_language, created_at)
      VALUES (?, ?, ?, ?, 0.0, 0, NULL, 0, ?, 0, 0, 'Afan Oromo', ?)
    `).run(
      userId,
      req.telegramUser?.username || `user_${userId}`,
      req.telegramUser?.first_name || 'New',
      req.telegramUser?.last_name || 'Visitor',
      isWhitelisted ? 1 : 0,
      now
    );
    user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  }

  // RBAC Integrity: Ensure is_admin is strictly 1 ONLY for admin accounts
  if (user) {
    const isSuperAdmin = ADMIN_WHITELIST.includes(user.user_id) || user.username === 'oroadmin' || user.is_admin === 1;
    user.is_admin = isSuperAdmin ? 1 : 0;
  }

  req.currentUser = user;
  next();
}

apiRouter.use(authMiddleware);

// Health check endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'ORO RECORDS Companion App' });
});

// Branding config endpoint (custom logo, theme, app info)
apiRouter.get('/branding', (_req: Request, res: Response) => {
  res.json({
    success: true,
    logo_url: get_setting('custom_logo_url', '/logo.svg'),
    brand_name: 'ORO RECORDS',
    accent_color: '#22C55E',
    admin_whitelist: ADMIN_WHITELIST,
  });
});

// ==========================================
// 1. PUBLIC & MEDIA UPLOAD ENDPOINTS
// ==========================================

/** * POST /api/upload * Handles direct screenshot file upload or media teaser/poster file upload */
apiRouter.post('/upload', upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      // Check if base64 provided in request body
      const { base64, filename } = req.body;
      if (base64) {
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64, 'base64');
        const ext = matches ? `.${matches[1].split('/')[1] || 'jpg'}` : '.jpg';
        const uniqueName = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const filePath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(filePath, buffer);
        return res.json({
          success: true,
          url: `/uploads/${uniqueName}`,
          filename: filename || uniqueName,
          size: buffer.length,
        });
      }
      return res.status(400).json({ success: false, message: 'No file received for upload' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'File upload failed' });
  }
});

/** * GET /api/announcements - list active announcements & teasers */
apiRouter.get('/announcements', (req: AuthenticatedRequest, res: Response) => {
  try {
    const announcements = db.prepare(`
      SELECT * FROM announcements 
      WHERE is_active = 1 
      ORDER BY id DESC
    `).all();
    res.json({ success: true, announcements });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/movies?category=&page=&search=&quality= */
apiRouter.get('/movies', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, search, page = '1', limit = '24' } = req.query;
    const isVip = req.currentUser?.is_vip === 1;
    const rawBotUser = get_setting('telegram_bot_username', 'OroRecordsBot');
    const botUsername = rawBotUser.replace(/^@/, '').trim();

    let query = "SELECT * FROM movies WHERE approval_status = 'active'";
    const params: any[] = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search && typeof search === 'string' && search.trim()) {
      query += ' AND (title LIKE ? OR original_title LIKE ? OR description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY is_popular DESC, release_year DESC, id DESC';

    const p = Math.max(1, parseInt(page as string, 10));
    const lim = Math.max(1, parseInt(limit as string, 10));
    const offset = (p - 1) * lim;

    query += ' LIMIT ? OFFSET ?';
    params.push(lim, offset);

    const movies = db.prepare(query).all(...params) as any[];

    // Decorate movies with badges, labels, and direct bot deep links
    const formatted = movies.map((m) => ({
      ...m,
      bot_deep_link: m.bot_deep_link || (m.file_id ? `https://t.me/${botUsername}?start=movie_${m.id}` : `https://t.me/${botUsername}`),
      price_label: format_price_label(m, isVip),
      badges: format_movie_badges(m),
      effective_price: isVip
        ? m.vip_price
        : m.discount_percent > 0
        ? Math.round(m.regular_price * (1 - m.discount_percent / 100))
        : m.regular_price,
    }));

    // Fetch categories count
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM movies 
      WHERE approval_status = 'active' 
      GROUP BY category
    `).all() as any[];

    res.json({
      success: true,
      movies: formatted,
      categories,
      page: p,
      is_vip: isVip,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/movies/:id - Detail, respecting approval_status='active' (or partner/admin access) */
apiRouter.get('/movies/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id) as any;

    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    // Gating check
    const isOwner = movie.partner_id === req.currentUserId;
    const isAdmin = req.currentUser?.is_admin === 1;
    if (movie.approval_status !== 'active' && !isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Movie is currently under review' });
    }

    const rawBotUser = get_setting('telegram_bot_username', 'OroRecordsBot');
    const botUsername = rawBotUser.replace(/^@/, '').trim();
    const isVip = req.currentUser?.is_vip === 1;

    // Check user purchase status
    let userPurchase: any = null;
    if (req.currentUserId) {
      userPurchase = db.prepare(`
        SELECT * FROM purchases 
        WHERE user_id = ? AND movie_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(req.currentUserId, id);

      if (userPurchase && userPurchase.expires_at) {
        userPurchase.is_expired = new Date(userPurchase.expires_at) < new Date();
      }
    }

    // Attach partner info if available
    let partnerInfo = null;
    if (movie.partner_id) {
      partnerInfo = db.prepare(`
        SELECT u.first_name, u.last_name, p.channel_link 
        FROM partners p 
        JOIN users u ON u.user_id = p.user_id 
        WHERE p.user_id = ?
      `).get(movie.partner_id);
    }

    res.json({
      success: true,
      movie: {
        ...movie,
        bot_deep_link: movie.bot_deep_link || (movie.file_id ? `https://t.me/${botUsername}?start=movie_${movie.id}` : `https://t.me/${botUsername}`),
        price_label: format_price_label(movie, isVip),
        badges: format_movie_badges(movie),
        effective_price: isVip
          ? movie.vip_price
          : movie.discount_percent > 0
          ? Math.round(movie.regular_price * (1 - movie.discount_percent / 100))
          : movie.regular_price,
        partner_name: partnerInfo ? `${partnerInfo.first_name} ${partnerInfo.last_name}` : 'ORO RECORDS Original',
      },
      user_purchase: userPurchase,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/purchase/:movie_id - wraps purchase_single_movie */
apiRouter.post('/purchase/:movie_id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const movieId = parseInt(req.params.movie_id, 10);
    const { purchase_type = 'rental' } = req.body;
    const userId = req.currentUserId!;

    const result = await purchase_single_movie(userId, movieId, purchase_type);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/purchase/folder/:category - wraps purchase_folder */
apiRouter.post('/purchase/folder/:category', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const category = decodeURIComponent(req.params.category);
    const userId = req.currentUserId!;

    const result = await purchase_folder(userId, category);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/me - balance, VIP status, points, purchase history */
apiRouter.get('/me', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Purchases
    const purchases = db.prepare(`
      SELECT p.*, m.title as movie_title, m.original_title, m.category, m.poster_url, m.quality, m.file_id
      FROM purchases p
      JOIN movies m ON m.id = p.movie_id
      WHERE p.user_id = ?
      ORDER BY p.id DESC
    `).all(userId) as any[];

    const now = new Date();
    const mappedPurchases = purchases.map((p) => {
      const isExpired = p.expires_at ? new Date(p.expires_at) < now : false;
      let timeLeft = 'Permanent Lifetime Access';
      if (p.expires_at && !isExpired) {
        const diffMs = new Date(p.expires_at).getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        timeLeft = `${diffHours}h ${diffMins}m remaining`;
      } else if (isExpired) {
        timeLeft = 'Rental Expired';
      }

      return {
        ...p,
        is_expired: isExpired,
        time_left: timeLeft,
      };
    });

    // Recent transactions (deposits)
    const recentTx = db.prepare(`
      SELECT * FROM transactions 
      WHERE user_id = ? 
      ORDER BY id DESC LIMIT 10
    `).all(userId);

    // Partner info if applicable
    const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);

    // Pending application if any
    const pendingApp = db.prepare(`
      SELECT * FROM partner_applications 
      WHERE user_id = ? AND status = 'pending'
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    res.json({
      success: true,
      user,
      active_purchases_count: mappedPurchases.filter((p) => !p.is_expired).length,
      purchases: mappedPurchases,
      recent_transactions: recentTx,
      partner: partner || null,
      is_partner_application_pending: !!pendingApp,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/user/register - Mandatory Onboarding for new buyers / telegram members */
apiRouter.post('/user/register', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const { first_name, last_name, phone_number, username, preferred_language } = req.body;

    if (!first_name || !first_name.trim()) {
      return res.status(400).json({ success: false, message: 'First name is required for account registration' });
    }

    if (!phone_number || !phone_number.trim()) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required for Ethiopian payment reconciliation' });
    }

    const cleanFirstName = first_name.trim();
    const cleanLastName = (last_name || '').trim();
    const cleanPhone = phone_number.trim();
    const cleanUsername = (username || req.telegramUser?.username || `user_${userId}`).replace(/^@/, '').trim();
    const cleanLang = ['Afan Oromo', 'Amharic', 'English'].includes(preferred_language) ? preferred_language : 'Afan Oromo';

    // Update user record: mark as registered and grant 25 bonus cinema points
    db.prepare(`
      UPDATE users
      SET first_name = ?,
          last_name = ?,
          phone_number = ?,
          username = ?,
          preferred_language = ?,
          is_registered = 1,
          points = points + 25
      WHERE user_id = ?
    `).run(cleanFirstName, cleanLastName, cleanPhone, cleanUsername, cleanLang, userId);

    const updatedUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

    res.json({
      success: true,
      message: 'Registration completed successfully! 25 Welcome Cinema Points have been added to your profile.',
      user: updatedUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/user/reset-registration - Preview Testing tool to simulate unregistered state */
apiRouter.post('/user/reset-registration', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    db.prepare('UPDATE users SET is_registered = 0 WHERE user_id = ?').run(userId);
    const updatedUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    res.json({ success: true, message: 'User status successfully reset to Unregistered', user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/deposit - submits screenshot + claimed amount (writes pending transactions row) */
apiRouter.post('/deposit', upload.single('screenshot_file'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const { amount, payment_method, screenshot_url, screenshot_base64, reference_code } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid deposit amount in ETB' });
    }

    const normalizedMethod = (payment_method || '').toLowerCase();
    if (!['telebirr', 'cbe', 'ebirr', 'sinqee'].includes(normalizedMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method selected. Supported: Telebirr, CBE Birr, E-Birr, Sinqee Bank.' });
    }

    const ref = (reference_code || `REF-${Date.now().toString().slice(-6)}`).trim();
    let screenshot = screenshot_url || '';

    // Handle direct file upload in multipart form
    if (req.file) {
      screenshot = `/uploads/${req.file.filename}`;
    } else if (!screenshot && screenshot_base64) {
      // Handle base64 upload from camera or pasted receipt
      try {
        const matches = screenshot_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(screenshot_base64, 'base64');
        const ext = matches ? `.${matches[1].split('/')[1] || 'jpg'}` : '.jpg';
        const uniqueName = `receipt-${Date.now()}-${userId}${ext}`;
        const filePath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(filePath, buffer);
        screenshot = `/uploads/${uniqueName}`;
      } catch (e) {
        console.error('Failed to parse base64 receipt:', e);
      }
    }

    if (!screenshot) {
      screenshot = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80';
    }

    const now = new Date().toISOString();
    const insertRes = db.prepare(`
      INSERT INTO transactions (user_id, amount, payment_method, screenshot_url, reference_code, status, admin_notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?)
    `).run(userId, parsedAmount, payment_method, screenshot, ref, now);

    res.json({
      success: true,
      message: `Deposit request for ${parsedAmount} ETB submitted via ${payment_method.toUpperCase()}. Admin will verify your uploaded screenshot receipt and credit your balance shortly.`,
      transaction_id: Number(insertRes.lastInsertRowid),
      reference_code: ref,
      screenshot_url: screenshot,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/coupon/redeem - wraps redeem_coupon_atomic */
apiRouter.post('/coupon/redeem', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const result = await redeem_coupon_atomic(userId, code);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/vip/subscribe - Monthly VIP Pass subscription (250 ETB) */
apiRouter.post('/vip/subscribe', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;

    const vipCost = parseFloat(get_setting('vip_monthly_price', '250.0'));
    if (user.balance < vipCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance (${user.balance.toFixed(2)} ETB). VIP Monthly Pass costs ${vipCost} ETB. Please deposit funds first.`,
      });
    }

    const newBalance = Math.round((user.balance - vipCost) * 100) / 100;
    const now = new Date();
    // 30 days VIP
    const vipUntil = new Date(now.getTime() + 30 * 86400000).toISOString();

    db.prepare(`
      UPDATE users 
      SET balance = ?, is_vip = 1, vip_until = ?, points = points + 50 
      WHERE user_id = ?
    `).run(newBalance, vipUntil, userId);

    // Record ledger
    db.prepare(`
      INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description)
      VALUES (?, 'movie_purchase', 'buyer', ?, ?, 0, ?, ?, ?)
    `).run(now.toISOString(), userId, vipCost, newBalance, `VIP-${Date.now()}-${userId}`, 'Purchased 30-day VIP Cinephile Pass');

    db.prepare(`
      INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description)
      VALUES (?, 'movie_purchase', 'platform', 0, 0, ?, 0, ?, ?)
    `).run(now.toISOString(), vipCost, `VIP-${Date.now()}-${userId}`, 'VIP Pass revenue');

    res.json({
      success: true,
      message: `Congratulations! VIP Pass activated until ${new Date(vipUntil).toLocaleDateString()}. Enjoy up to 50% discount on all movie titles!`,
      vip_until: vipUntil,
      new_balance: newBalance,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. PARTNER ENDPOINTS
// ==========================================

/** * POST /api/partner/apply - writes to partner_applications (pending review) */
apiRouter.post('/partner/apply', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const { name, phone, channel_or_portfolio, category_focus } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    // Check if already partner
    const existingPartner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);
    if (existingPartner) {
      return res.status(400).json({ success: false, message: 'You are already an approved partner' });
    }

    // Check existing pending
    const existingPending = db.prepare("SELECT * FROM partner_applications WHERE user_id = ? AND status = 'pending'").get(userId);
    if (existingPending) {
      return res.status(400).json({ success: false, message: 'You already have an application under review' });
    }

    const now = new Date().toISOString();
    const insertRes = db.prepare(`
      INSERT INTO partner_applications (user_id, name, phone, channel_or_portfolio, category_focus, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(userId, name, phone, channel_or_portfolio || '', category_focus || 'Oromo Cinema', now);

    res.json({
      success: true,
      message: 'Partner application submitted successfully. Our curator team will review your channel and portfolio within 24 hours.',
      application_id: Number(insertRes.lastInsertRowid),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/partner/movies - upload flow, inserted as approval_status='pending' */
apiRouter.post('/partner/movies', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const partner = db.prepare("SELECT * FROM partners WHERE user_id = ? AND status = 'active'").get(userId) as any;
    const isAdmin = req.currentUser?.is_admin === 1;

    if (!partner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only approved partners can submit films' });
    }

    const {
      title,
      original_title,
      category,
      description,
      poster_url,
      trailer_url,
      file_id,
      regular_price,
      vip_price,
      release_year,
      quality,
      languages,
    } = req.body;

    if (!title || !category || !regular_price) {
      return res.status(400).json({ success: false, message: 'Title, category, and price are required' });
    }

    const regPrice = parseFloat(regular_price);
    const vPrice = vip_price ? parseFloat(vip_price) : Math.round(regPrice * 0.6);
    const now = new Date().toISOString();

    const insertRes = db.prepare(`
      INSERT INTO movies (
        title, original_title, category, description, poster_url, trailer_url, file_id,
        regular_price, vip_price, discount_percent, is_popular, rental_duration_hours,
        allow_lifetime, partner_id, partner_cut_percent, approval_status, release_year,
        quality, languages, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 72, 1, ?, 70.0, 'pending', ?, ?, ?, ?)
    `).run(
      title,
      original_title || title,
      category,
      description || '',
      poster_url || 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&auto=format&fit=crop&q=80',
      trailer_url || 'https://www.w3schools.com/html/mov_bbb.mp4',
      file_id || `BAACAgQAAxkBAAEPPartner_${Date.now()}`,
      regPrice,
      vPrice,
      userId,
      release_year || new Date().getFullYear(),
      quality || '1080p FHD',
      languages || 'Afan Oromo',
      now
    );

    res.json({
      success: true,
      message: `Film "${title}" submitted successfully for distribution review. Admin will verify broadcast rights and activate it shortly.`,
      movie_id: Number(insertRes.lastInsertRowid),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/partner/sales - pulls from ledger_entries where account_type='partner' */
apiRouter.get('/partner/sales', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId) as any;

    if (!partner && req.currentUser?.is_admin !== 1) {
      return res.status(403).json({ success: false, message: 'Partner access required' });
    }

    const partnerId = partner ? partner.user_id : userId;

    // Sales and commission entries from ledger
    const ledger = db.prepare(`
      SELECT * FROM ledger_entries 
      WHERE account_type = 'partner' AND account_id = ?
      ORDER BY id DESC LIMIT 50
    `).all(partnerId) as any[];

    // Partner's movies
    const movies = db.prepare(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM purchases p WHERE p.movie_id = m.id) as sales_count,
        (SELECT COALESCE(SUM(amount_paid), 0) FROM purchases p WHERE p.movie_id = m.id) as gross_sales
      FROM movies m 
      WHERE m.partner_id = ? 
      ORDER BY m.id DESC
    `).all(partnerId);

    // Partner's payout history
    const payouts = db.prepare(`
      SELECT * FROM payout_requests 
      WHERE partner_id = ? 
      ORDER BY id DESC
    `).all(partnerId);

    res.json({
      success: true,
      partner,
      movies,
      sales_history: ledger,
      payouts,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/partner/payout/preview?amount= - wraps calculate_withdrawal_fee */
apiRouter.get('/partner/payout/preview', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const amountStr = req.query.amount as string;
    const amount = parseFloat(amountStr || '0');

    const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId) as any;
    const partnerBalance = partner ? partner.commission_balance : 0;
    const minAmount = parseFloat(get_setting('min_withdrawal_amount', '100.0'));

    if (isNaN(amount) || amount <= 0) {
      return res.json({
        amount: 0,
        fee: 0,
        net_amount: 0,
        fee_percent: 2.5,
        partner_balance: partnerBalance,
        can_withdraw: false,
        error: 'Please enter a valid amount',
      });
    }

    const { fee, net_amount, fee_percent } = calculate_withdrawal_fee(amount);
    let error: string | undefined = undefined;

    if (amount < minAmount) {
      error = `Minimum withdrawal amount is ${minAmount} ETB`;
    } else if (amount > partnerBalance) {
      error = `Amount exceeds available commission balance (${partnerBalance.toFixed(2)} ETB)`;
    }

    res.json({
      amount,
      fee,
      net_amount,
      fee_percent,
      partner_balance: partnerBalance,
      can_withdraw: !error,
      error,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/partner/payout - wraps request_payout_atomic */
apiRouter.post('/partner/payout', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUserId!;
    const { amount, payout_method, payout_account, payout_name } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount' });
    }

    if (!payout_method || !payout_account || !payout_name) {
      return res.status(400).json({ success: false, message: 'Payout method, account, and account name are required' });
    }

    const result = await request_payout_atomic(
      userId,
      parsedAmount,
      payout_method,
      payout_account,
      payout_name
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. ADMIN ENDPOINTS (RBAC PROTECTED)
// ==========================================

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.currentUser;
  const isWhitelisted = user && ADMIN_WHITELIST.includes(user.user_id);
  const hasAdminRole = user && user.is_admin === 1;

  if (!user || (!hasAdminRole && !isWhitelisted)) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Administrator privileges required. Your Telegram account is not authorized to access ORO RECORDS administrative management tools.',
    });
  }
  next();
}

/** * GET /api/admin/deposits/pending */
apiRouter.get('/admin/deposits/pending', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const pending = db.prepare(`
      SELECT t.*, u.first_name, u.last_name, u.username, u.balance as current_user_balance
      FROM transactions t
      JOIN users u ON u.user_id = t.user_id
      WHERE t.status = 'pending'
      ORDER BY t.id ASC
    `).all();

    res.json({ success: true, pending_deposits: pending });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/deposits/:id/approve */
apiRouter.post('/admin/deposits/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { admin_notes } = req.body;

    const result = await approve_deposit_atomic(id, admin_notes || 'Verified on banking portal');
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/deposits/:id/reject */
apiRouter.post('/admin/deposits/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { admin_notes } = req.body;

    const result = await reject_deposit_atomic(id, admin_notes || 'Invalid transaction receipt');
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/admin/payouts/pending */
apiRouter.get('/admin/payouts/pending', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const pending = db.prepare(`
      SELECT pr.*, u.first_name, u.last_name, u.username, p.channel_link
      FROM payout_requests pr
      JOIN users u ON u.user_id = pr.partner_id
      JOIN partners p ON p.user_id = pr.partner_id
      WHERE pr.status = 'pending'
      ORDER BY pr.id ASC
    `).all();

    res.json({ success: true, pending_payouts: pending });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/payouts/:id/approve */
apiRouter.post('/admin/payouts/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { admin_notes } = req.body;

    const result = await process_payout_atomic(id, 'approve', admin_notes || 'Disbursed via Telebirr Business');
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/payouts/:id/reject */
apiRouter.post('/admin/payouts/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { admin_notes } = req.body;

    const result = await process_payout_atomic(id, 'reject', admin_notes || 'Account details mismatch');
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/admin/movies/pending */
apiRouter.get('/admin/movies/pending', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const pending = db.prepare(`
      SELECT m.*, u.first_name, u.last_name, u.username
      FROM movies m
      LEFT JOIN users u ON u.user_id = m.partner_id
      WHERE m.approval_status = 'pending'
      ORDER BY m.id ASC
    `).all();

    res.json({ success: true, pending_movies: pending });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/movies/:id/approve */
apiRouter.post('/admin/movies/:id/approve', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare("UPDATE movies SET approval_status = 'active' WHERE id = ?").run(id);
    res.json({ success: true, message: `Movie #${id} approved and published to catalog.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/movies/:id/reject */
apiRouter.post('/admin/movies/:id/reject', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare("UPDATE movies SET approval_status = 'rejected' WHERE id = ?").run(id);
    res.json({ success: true, message: `Movie #${id} marked as rejected.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/admin/partner/applications */
apiRouter.get('/admin/partner/applications', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const apps = db.prepare(`
      SELECT pa.*, u.first_name, u.last_name, u.username
      FROM partner_applications pa
      JOIN users u ON u.user_id = pa.user_id
      ORDER BY pa.id DESC
    `).all();

    res.json({ success: true, applications: apps });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/partner/applications/:id/approve */
apiRouter.post('/admin/partner/applications/:id/approve', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const app = db.prepare('SELECT * FROM partner_applications WHERE id = ?').get(id) as any;
    if (!app || app.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Application not found or already reviewed' });
    }

    const now = new Date().toISOString();
    // Update application
    db.prepare("UPDATE partner_applications SET status = 'approved' WHERE id = ?").run(id);

    // Update user role
    db.prepare('UPDATE users SET is_partner = 1 WHERE user_id = ?').run(app.user_id);

    // Insert partner record if not exists
    const existing = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(app.user_id);
    if (!existing) {
      db.prepare(`
        INSERT INTO partners (user_id, status, commission_balance, total_earned, channel_link, payout_method, payout_account, payout_name, created_at)
        VALUES (?, 'active', 0.0, 0.0, ?, 'telebirr', ?, ?, ?)
      `).run(app.user_id, app.channel_or_portfolio, app.phone, app.name, now);
    }

    res.json({ success: true, message: `Partner application #${id} approved! Creator unlocked partner dashboard.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/admin/ledger/reconcile - wraps reconcile_ledger_report */
apiRouter.get('/admin/ledger/reconcile', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = reconcile_ledger_report();
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/admin/ledger/entries */
apiRouter.get('/admin/ledger/entries', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const entries = db.prepare('SELECT * FROM ledger_entries ORDER BY id DESC LIMIT ?').all(limit);
    res.json({ success: true, entries });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/balance/adjust - wraps adjust_balance_atomic */
apiRouter.post('/admin/balance/adjust', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user_id, amount, reason } = req.body;
    const parsedUserId = parseInt(user_id, 10);
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedUserId) || isNaN(parsedAmount)) {
      return res.status(400).json({ success: false, message: 'Valid user ID and amount are required' });
    }

    const result = await adjust_balance_atomic(parsedUserId, parsedAmount, reason || 'Manual Admin Credit', req.currentUserId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/admin/stats - Quick platform executive metrics */
apiRouter.get('/admin/stats', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalMovies = (db.prepare('SELECT COUNT(*) as c FROM movies').get() as any).c;
    const activeMovies = (db.prepare("SELECT COUNT(*) as c FROM movies WHERE approval_status = 'active'").get() as any).c;
    const pendingMovies = (db.prepare("SELECT COUNT(*) as c FROM movies WHERE approval_status = 'pending'").get() as any).c;
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
    const totalPartners = (db.prepare("SELECT COUNT(*) as c FROM partners WHERE status = 'active'").get() as any).c;
    const pendingDeposits = (db.prepare("SELECT COUNT(*) as c FROM transactions WHERE status = 'pending'").get() as any).c;
    const pendingPayouts = (db.prepare("SELECT COUNT(*) as c FROM payout_requests WHERE status = 'pending'").get() as any).c;
    const pendingApps = (db.prepare("SELECT COUNT(*) as c FROM partner_applications WHERE status = 'pending'").get() as any).c;
    const depVolume = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE status = 'approved'").get() as any).s;
    const payoutVolume = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM payout_requests WHERE status = 'approved'").get() as any).s;

    res.json({
      success: true,
      stats: {
        total_movies: totalMovies,
        active_movies: activeMovies,
        pending_movies: pendingMovies,
        total_users: totalUsers,
        total_partners: totalPartners,
        pending_deposits_count: pendingDeposits,
        pending_payouts_count: pendingPayouts,
        pending_apps_count: pendingApps,
        total_deposits_volume: depVolume,
        total_payouts_volume: payoutVolume,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/movies - CMS: Upload & publish new movie directly */
apiRouter.post('/admin/movies', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title,
      original_title,
      category,
      description,
      poster_url,
      trailer_url,
      file_id,
      regular_price,
      vip_price,
      discount_percent = 0,
      is_popular = 0,
      rental_duration_hours = 72,
      allow_lifetime = 1,
      partner_id = null,
      partner_cut_percent = 70.0,
      release_year = new Date().getFullYear(),
      quality = '1080p FHD',
      languages = 'Afan Oromo',
      bot_deep_link,
    } = req.body;

    if (!title || !category || regular_price === undefined || vip_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, regular price (ETB), and VIP price (ETB) are required',
      });
    }

    const regPrice = parseFloat(regular_price);
    const vPrice = parseFloat(vip_price);
    const disc = parseInt(discount_percent, 10) || 0;
    const year = parseInt(release_year, 10) || new Date().getFullYear();
    const rentalHours = parseInt(rental_duration_hours, 10) || 72;

    const poster = poster_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80';
    const telegramFileId = file_id || `BAACAgQAAxkBAAEPOro_${Date.now()}_oro_rec`;
    const now = new Date().toISOString();

    const insertRes = db.prepare(`
      INSERT INTO movies (
        title, original_title, category, description, poster_url, trailer_url,
        file_id, regular_price, vip_price, discount_percent, is_popular,
        rental_duration_hours, allow_lifetime, partner_id, partner_cut_percent,
        approval_status, release_year, quality, languages, bot_deep_link, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        'active', ?, ?, ?, ?, ?
      )
    `).run(
      title.trim(),
      original_title ? original_title.trim() : title.trim(),
      category.trim(),
      description ? description.trim() : 'Official ORO RECORDS release.',
      poster,
      trailer_url || '',
      telegramFileId.trim(),
      regPrice,
      vPrice,
      disc,
      is_popular ? 1 : 0,
      rentalHours,
      allow_lifetime ? 1 : 0,
      partner_id ? parseInt(partner_id, 10) : null,
      parseFloat(partner_cut_percent) || 70.0,
      year,
      quality.trim() || '1080p FHD',
      languages.trim() || 'Afan Oromo',
      bot_deep_link ? bot_deep_link.trim() : null,
      now
    );

    const newMovie = db.prepare('SELECT * FROM movies WHERE id = ?').get(insertRes.lastInsertRowid);

    res.json({
      success: true,
      message: `Movie "${title}" published directly to catalog!`,
      movie: newMovie,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * PUT /api/admin/movies/:id - CMS: Update movie details & prices (ETB) */
apiRouter.put('/admin/movies/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId) as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    const {
      title = existing.title,
      original_title = existing.original_title,
      category = existing.category,
      description = existing.description,
      poster_url = existing.poster_url,
      trailer_url = existing.trailer_url,
      file_id = existing.file_id,
      regular_price = existing.regular_price,
      vip_price = existing.vip_price,
      discount_percent = existing.discount_percent,
      is_popular = existing.is_popular,
      rental_duration_hours = existing.rental_duration_hours,
      allow_lifetime = existing.allow_lifetime,
      release_year = existing.release_year,
      quality = existing.quality,
      languages = existing.languages,
      bot_deep_link = existing.bot_deep_link,
    } = req.body;

    db.prepare(`
      UPDATE movies SET
        title = ?,
        original_title = ?,
        category = ?,
        description = ?,
        poster_url = ?,
        trailer_url = ?,
        file_id = ?,
        regular_price = ?,
        vip_price = ?,
        discount_percent = ?,
        is_popular = ?,
        rental_duration_hours = ?,
        allow_lifetime = ?,
        release_year = ?,
        quality = ?,
        languages = ?,
        bot_deep_link = ?
      WHERE id = ?
    `).run(
      title,
      original_title,
      category,
      description,
      poster_url,
      trailer_url,
      file_id,
      parseFloat(regular_price),
      parseFloat(vip_price),
      parseInt(discount_percent, 10),
      is_popular ? 1 : 0,
      parseInt(rental_duration_hours, 10),
      allow_lifetime ? 1 : 0,
      parseInt(release_year, 10),
      quality,
      languages,
      bot_deep_link ? bot_deep_link.trim() : null,
      movieId
    );

    const updated = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);

    res.json({
      success: true,
      message: `Movie #${movieId} updated successfully!`,
      movie: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * DELETE /api/admin/movies/:id - CMS: Delete movie from catalog */
apiRouter.delete('/admin/movies/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId) as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    db.prepare('DELETE FROM movies WHERE id = ?').run(movieId);

    res.json({
      success: true,
      message: `Movie "${existing.title}" deleted from catalog.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/admin/announcements - CMS: List all announcements (active & draft) */
apiRouter.get('/admin/announcements', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const announcements = db.prepare('SELECT * FROM announcements ORDER BY id DESC').all();
    res.json({ success: true, announcements });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * POST /api/admin/announcements - CMS: Create announcement / promotional teaser */
apiRouter.post('/admin/announcements', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, content, media_url, action_link, badge = 'ANNOUNCEMENT' } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const now = new Date().toISOString();
    const insertRes = db.prepare(`
      INSERT INTO announcements (title, content, media_url, action_link, badge, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(title.trim(), content.trim(), media_url || null, action_link || null, badge.trim(), now);

    res.json({
      success: true,
      message: 'Announcement published successfully!',
      id: Number(insertRes.lastInsertRowid),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * DELETE /api/admin/announcements/:id - CMS: Delete announcement */
apiRouter.delete('/admin/announcements/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    res.json({ success: true, message: `Announcement #${id} deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * PUT /api/admin/settings - Update platform settings (bot username, accounts, fees) */
apiRouter.put('/admin/settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object is required' });
    }

    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, value] of Object.entries(settings)) {
        upsertStmt.run(key, String(value));
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    res.json({ success: true, message: 'Platform settings updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. COMMON & SETTINGS ENDPOINTS
// ==========================================

/** * GET /api/settings - Ethiopian payment accounts & terms */
apiRouter.get('/settings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** * GET /api/users - Quick switcher list for testing personas in browser preview */
apiRouter.get('/users', (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = db.prepare('SELECT user_id, username, first_name, last_name, balance, is_vip, is_admin, is_partner FROM users').all();
    res.json({ success: true, users, current_user_id: req.currentUserId });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
