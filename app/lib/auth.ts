import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "nailong_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 210_000;
const encoder = new TextEncoder();

type SessionUser = { id: string; username: string; recoveryEmail: string | null };

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return { hash: bytesToBase64(hash), salt: bytesToBase64(salt), iterations: PASSWORD_ITERATIONS };
}

export async function verifyPassword(password: string, hash: string, salt: string, iterations: number) {
  const actual = await derivePassword(password, base64ToBytes(salt), iterations);
  const expected = base64ToBytes(hash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeUsername(username: string) {
  return username.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

export function validateUsername(value: string) {
  const username = value.trim().normalize("NFKC");
  const length = Array.from(username).length;
  if (length < 2 || length > 16) return { error: "用户名需要 2–16 个字符" } as const;
  if (!/^[\p{L}\p{N}]+$/u.test(username)) return { error: "用户名只能包含中文、字母和数字" } as const;
  return { username, normalized: normalizeUsername(username) } as const;
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 72) return "密码需要 8–72 位";
  return null;
}

export function validateRecoveryEmail(email: string) {
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不正确";
  return null;
}

export async function createSession(userId: string) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tokenHash = await sha256(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  await getDb().insert(sessions).values({ tokenHash, userId, expiresAt });
  return { token, expiresAt };
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function getSessionToken(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const cookie of cookies.split(";")) {
    const [name, ...parts] = cookie.trim().split("=");
    if (name === SESSION_COOKIE) return parts.join("=");
  }
  return null;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const [row] = await getDb()
    .select({ id: users.id, username: users.username, recoveryEmail: users.recoveryEmail })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, Math.floor(Date.now() / 1000))))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(request: Request) {
  const token = getSessionToken(request);
  if (!token) return;
  await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
}
