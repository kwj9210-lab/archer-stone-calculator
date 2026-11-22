import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = '__Host-archer_sid';
export const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const LOGIN_CACHE_HEADERS = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };

export function nicknameKey(value) {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFKC').trim();
  if (!/^[가-힣a-zA-Z0-9_-]{2,20}$/.test(text)) return null;
  return { display: text, key: text.toLocaleLowerCase('en-US') };
}
export function validPassword(value) {
  return typeof value === 'string' && value.length >= 10 && value.length <= 128;
}
export function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
export async function hashPassword(password) {
  if (!validPassword(password)) throw new Error('invalid password');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return 'scrypt-v1$' + salt + '$' + key.toString('hex');
}
export async function checkPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = await scrypt(password, Buffer.from(parts[1], 'hex'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(expected, actual);
}
export function newSession() { return randomBytes(32).toString('base64url'); }
export function sessionCookie(token) {
  return COOKIE_NAME + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + (SESSION_MS / 1000);
}
export function clearSessionCookie() {
  return COOKIE_NAME + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}
export function readCookie(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE_NAME + '=([A-Za-z0-9_-]{43})' + '(?:;|$)'));
  return match?.[1] || null;
}
function baseURL() {
  const root = process.env.SUPABASE_URL;
  if (!root || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(root)) throw new Error('SUPABASE_URL is not configured');
  if (!process.env.SUPABASE_SECRET_KEY?.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY is not configured');
  return root.replace(/\/$/, '') + '/rest/v1/';
}
export async function db(path, options = {}) {
  const url = baseURL() + path;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'apikey': process.env.SUPABASE_SECRET_KEY,
      'Accept': 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store'
  });
  if (!response.ok) {
    console.error('Access DB request failed:', response.status, path.split('?')[0]);
    throw new Error('Access DB unavailable');
  }
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}
export function eqFilter(value) { return encodeURIComponent('eq.' + value); }
export async function getMember(request) {
  const token = readCookie(request);
  if (!token) return null;
  const tokenHash = digest(token);
  const sessions = await db('access_sessions?select=id,member_id,expires_at&token_hash=' + eqFilter(tokenHash) + '&limit=1');
  const session = sessions?.[0];
  if (!session || Date.parse(session.expires_at) <= Date.now()) return null;
  const members = await db('access_members?select=id,nickname,role,status,login_count,last_login_at&id=' + eqFilter(session.member_id) + '&limit=1');
  const member = members?.[0];
  if (!member || member.status !== 'approved') return null;
  return { ...member, sessionId: session.id, tokenHash };
}
export async function insertSession(memberId) {
  const token = newSession();
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  await db('access_sessions', {
    method: 'POST',
    body: { member_id: memberId, token_hash: digest(token), expires_at: expiresAt },
    headers: { Prefer: 'return=minimal' }
  });
  return token;
}
export async function throttle(request, action, limit, seconds) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 80) || 'unknown';
  const key = digest(action + ':' + ip);
  return await db('rpc/access_throttle', { method: 'POST', body: { p_bucket: key, p_limit: limit, p_seconds: seconds } });
}
export async function jsonRequest(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new Error('json_required');
  const body = await request.text();
  if (body.length > 4096) throw new Error('payload_too_large');
  return JSON.parse(body);
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}
export function answer(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...LOGIN_CACHE_HEADERS, ...extraHeaders } });
}
export function errorAnswer(status, message) { return answer({ ok: false, message }, status); }
