import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

/**
 * 管理画面の認証まわり（サーバー専用）。
 *
 * セキュリティ設計:
 * - 隠しURL: 実ルートは /admin だが、公開リポジトリにパスを残さないため
 *   middleware で env `ADMIN_PATH` のslug配下だけ /admin に rewrite する。
 *   直接 /admin へのアクセスは middleware が 404 にする。
 * - パスワード認証: `ADMIN_PASSWORD`（env）と定数時間比較。一致したら
 *   HMAC-SHA256 署名付きの HttpOnly cookie を発行し、以降はそれで認証する。
 * - 署名鍵は `ADMIN_SESSION_SECRET`（env）。cookie 改ざんを検知する。
 * - パスワード/署名鍵は env のみ（リポジトリにもDiscordにも出さない）。
 */

const SESSION_COOKIE = "sf_admin";
const SESSION_MAX_AGE_SEC = 60 * 60 * 8; // 8時間

/** 隠しURLのslug（env）。未設定なら管理画面は到達不能（安全側）。 */
export function getAdminPath(): string | null {
  const p = process.env.ADMIN_PATH;
  return p && p.trim() !== "" ? p.trim() : null;
}

function getSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

/** 定数時間の文字列比較（タイミング攻撃対策）。 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** 入力パスワードが正しいか。ADMIN_PASSWORD 未設定なら常に false。 */
export function verifyPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length === 0) return false;
  return safeEqual(input, pw);
}

/** 管理者パスワードが設定されているか（未設定なら「未設定」表示に使う）。 */
export function isAdminConfigured(): boolean {
  return (
    !!process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_PASSWORD.length > 0 &&
    !!getSecret()
  );
}

function hmac(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** 署名付きセッショントークンを作る（payload.signature）。 */
function makeToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = Buffer.from(
    JSON.stringify({ v: 1, iat: Date.now() }),
  ).toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

/** トークンの署名と有効期限を検証する。 */
function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, hmac(payload, secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data?.iat !== "number") return false;
    if (Date.now() - data.iat > SESSION_MAX_AGE_SEC * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

/** ログイン成功時にセッション cookie を張る。 */
export function startSession(): void {
  const token = makeToken();
  if (!token) return;
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

/** ログアウト（cookie 破棄）。 */
export function endSession(): void {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** 現在のリクエストが管理者として認証済みか。 */
export function isAuthed(): boolean {
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

/**
 * service_role キーを使う管理用 Supabase クライアント（RLS バイパス）。
 * サーバー専用。削除や全件集計に使う。セッションは持たない。
 */
export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin credentials are not configured.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
