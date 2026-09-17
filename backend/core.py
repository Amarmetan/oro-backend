"""
ORO RECORDS — Core Ledger & Database Module (core.py)
Shared business logic and atomic financial functions for bot_v2.py and FastAPI/Flask APIs.
Contains zero Telegram UI/bot dependencies, allowing standalone imports.

Connection rules enforced:
  - WAL mode (PRAGMA journal_mode = WAL)
  - Strict serialization using BEGIN IMMEDIATE transactions
  - In-process threading lock (DB_LOCK) for high-throughput concurrency protection
  - Double-entry ledger verification
"""

import sqlite3
import threading
import hmac
import hashlib
import json
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple

DB_FILE = "ororecords_v2.db"
DB_LOCK = threading.Lock()

def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection configured with WAL mode and row factory."""
    conn = sqlite3.connect(DB_FILE, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 10000;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def verify_init_data(init_data: str, bot_token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies Telegram WebApp initData HMAC-SHA256 signature on every request (§4).
    Re-derives user identity safely to prevent forgery.
    """
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed_hash, received_hash):
            return None
        return json.loads(parsed.get("user", "{}"))
    except Exception:
        return None

def get_setting(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default

def calculate_withdrawal_fee(amount: float, percent: float = 2.5, min_fee: float = 10.0) -> Dict[str, float]:
    fee = round(max((amount * percent) / 100.0, min_fee), 2)
    net = round(max(0.0, amount - fee), 2)
    return {"fee": fee, "net_amount": net, "fee_percent": percent}

def format_price_label(movie: sqlite3.Row, is_vip: bool) -> str:
    effective = movie["vip_price"] if is_vip else (
        movie["regular_price"] * (1 - movie["discount_percent"] / 100.0)
        if movie["discount_percent"] > 0 else movie["regular_price"]
    )
    rounded = round(effective)
    if is_vip:
        return f"{rounded} ETB (VIP)"
    if movie["discount_percent"] > 0:
        return f"{rounded} ETB ({movie['discount_percent']}% OFF)"
    return f"{rounded} ETB"

def format_movie_badges(movie: sqlite3.Row) -> List[str]:
    badges = []
    if movie["is_popular"]:
        badges.append("🔥 POPULAR")
    if movie["discount_percent"] > 0:
        badges.append(f"🏷️ {movie['discount_percent']}% OFF")
    if "4K" in (movie["quality"] or ""):
        badges.append("⚡ 4K UHD")
    if movie["category"] == "Oromo Cultural":
        badges.append("🏛️ CULTURAL")
    return badges

def purchase_single_movie(user_id: int, movie_id: int, purchase_type: str = "rental") -> Tuple[bool, str, Optional[int]]:
    """Atomic movie purchase using BEGIN IMMEDIATE under thread lock."""
    with DB_LOCK:
        conn = get_db_connection()
        try:
            conn.execute("BEGIN IMMEDIATE;")
            cur = conn.cursor()

            # Check user
            user = cur.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
            if not user:
                conn.rollback()
                return False, "User account not found", None

            # Check movie
            movie = cur.execute("SELECT * FROM movies WHERE id = ? AND approval_status = 'active'", (movie_id,)).fetchone()
            if not movie:
                conn.rollback()
                return False, "Movie is not active for streaming/rental", None

            # Calculate price
            is_vip = bool(user["is_vip"])
            price = movie["vip_price"] if is_vip else movie["regular_price"]
            if not is_vip and movie["discount_percent"] > 0:
                price = movie["regular_price"] * (1 - movie["discount_percent"] / 100.0)
            if purchase_type == "lifetime":
                price = price * 1.6
            price = round(price, 2)

            if user["balance"] < price:
                conn.rollback()
                return False, f"Insufficient balance ({user['balance']} ETB). Required: {price} ETB.", None

            now = datetime.utcnow().isoformat()
            expires_at = None
            if purchase_type == "rental":
                hours = movie["rental_duration_hours"] or 72
                expires_at = (datetime.utcnow() + timedelta(hours=hours)).isoformat()

            new_balance = round(user["balance"] - price, 2)
            cur.execute("UPDATE users SET balance = ?, points = points + 5 WHERE user_id = ?", (new_balance, user_id))

            cur.execute("""
                INSERT INTO purchases (user_id, movie_id, amount_paid, purchase_type, folder_category, expires_at, created_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?)
            """, (user_id, movie_id, price, purchase_type, expires_at, now))
            purchase_id = cur.lastrowid
            ref_id = f"PURCHASE-{purchase_id}-{user_id}"

            # Buyer ledger entry (Debit)
            cur.execute("""
                INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description)
                VALUES (?, 'movie_purchase', 'buyer', ?, ?, 0, ?, ?, ?)
            """, (now, user_id, price, new_balance, ref_id, f"Purchased {purchase_type}: {movie['title']}"))

            # Partner commission vs Platform
            if movie["partner_id"] and movie["partner_cut_percent"] > 0:
                partner_cut = round(price * (movie["partner_cut_percent"] / 100.0), 2)
                cur.execute("""
                    UPDATE partners 
                    SET commission_balance = commission_balance + ?, total_earned = total_earned + ?
                    WHERE user_id = ?
                """, (partner_cut, partner_cut, movie["partner_id"]))

                partner = cur.execute("SELECT commission_balance FROM partners WHERE user_id = ?", (movie["partner_id"],)).fetchone()
                cur.execute("""
                    INSERT INTO ledger_entries (timestamp, transaction_type, account_type, account_id, debit, credit, balance_after, reference_id, description)
                    VALUES (?, 'partner_commission', 'partner', ?, 0, ?, ?, ?, ?)
                """, (now, movie["partner_id"], partner_cut, partner["commission_balance"], ref_id, f"Royalty for {movie['title']}"))

            conn.commit()
            return True, f"Successfully purchased {movie['title']}", purchase_id
        except Exception as e:
            conn.rollback()
            return False, str(e), None
        finally:
            conn.close()

def reconcile_ledger_report() -> Dict[str, Any]:
    """Reconciles double-entry ledger against user and partner liabilities."""
    with DB_LOCK:
        conn = get_db_connection()
        cur = conn.cursor()
        debits = cur.execute("SELECT COALESCE(SUM(debit), 0) FROM ledger_entries").fetchone()[0]
        credits = cur.execute("SELECT COALESCE(SUM(credit), 0) FROM ledger_entries").fetchone()[0]
        buyer_bal = cur.execute("SELECT COALESCE(SUM(balance), 0) FROM users").fetchone()[0]
        partner_bal = cur.execute("SELECT COALESCE(SUM(commission_balance), 0) FROM partners").fetchone()[0]
        approved_dep = cur.execute("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status='approved'").fetchone()[0]
        approved_pay = cur.execute("SELECT COALESCE(SUM(net_amount), 0) FROM payout_requests WHERE status='approved'").fetchone()[0]
        conn.close()

        return {
            "total_debits": round(debits, 2),
            "total_credits": round(credits, 2),
            "is_balanced": abs(debits - credits) < 1.0,
            "total_buyer_balances": round(buyer_bal, 2),
            "total_partner_balances": round(partner_bal, 2),
            "total_liabilities": round(buyer_bal + partner_bal, 2),
            "net_cash_held": round(approved_dep - approved_pay, 2)
        }
