// Admin accounts (bcrypt hashes in data/users.json) and in-memory sessions.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { DATA_DIR, writeAtomic } = require('./store');

const USERS = path.join(DATA_DIR, 'users.json');
const SESSION_HOURS = 12;
const sessions = new Map(); // token -> {user, exp}
const DUMMY = bcrypt.hashSync('not-a-real-password', 11);

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS, 'utf8')); } catch (_) { return []; }
}
function writeUsers(u) { fs.mkdirSync(DATA_DIR, { recursive: true }); writeAtomic(USERS, u); }

// First run: create the "admin" account. Password from ADMIN_PASSWORD or a random one printed once.
function ensureAdmin() {
  const users = readUsers();
  if (users.length) return null;
  const given = process.env.ADMIN_PASSWORD;
  const pwd = given && given.length >= 8 ? given : crypto.randomBytes(9).toString('base64url');
  writeUsers([{ username: process.env.ADMIN_USER || 'admin', hash: bcrypt.hashSync(pwd, 11), mustChange: true, createdAt: new Date().toISOString() }]);
  return given ? null : pwd;
}

// login rate limit: 8 failed tries per IP per 15 minutes
const fails = new Map();
function limited(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.t > 15 * 60e3) { fails.delete(ip); return false; }
  return f.n >= 8;
}
function noteFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.t > 15 * 60e3) fails.set(ip, { n: 1, t: Date.now() });
  else f.n++;
}

async function login(username, password, ip) {
  if (limited(ip)) return { error: 'Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.', status: 429 };
  const u = readUsers().find(x => x.username === String(username || '').trim());
  // compare against a dummy hash when the user doesn't exist, so timing doesn't reveal usernames
  const ok = await bcrypt.compare(String(password || ''), u ? u.hash : DUMMY);
  if (!u || !ok) { noteFail(ip); return { error: 'Sai tên đăng nhập hoặc mật khẩu.', status: 401 }; }
  fails.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user: u.username, exp: Date.now() + SESSION_HOURS * 3600e3 });
  return { token, user: u.username, mustChange: !!u.mustChange };
}

function getSession(token) {
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(token); return null; }
  return s;
}
function logout(token) { sessions.delete(token); }

async function changePassword(username, current, next, keepToken) {
  const users = readUsers();
  const u = users.find(x => x.username === username);
  if (!u) return { error: 'Không tìm thấy tài khoản.', status: 404 };
  if (!(await bcrypt.compare(String(current || ''), u.hash))) return { error: 'Mật khẩu hiện tại chưa đúng.', status: 400 };
  if (String(next || '').length < 8) return { error: 'Mật khẩu mới cần ít nhất 8 ký tự.', status: 400 };
  u.hash = await bcrypt.hash(String(next), 11);
  u.mustChange = false;
  writeUsers(users);
  // sign out every other session of this user
  for (const [t, s] of sessions) if (s.user === username && t !== keepToken) sessions.delete(t);
  return { ok: true };
}

function mustChange(username) { const u = readUsers().find(x => x.username === username); return !!(u && u.mustChange); }

module.exports = { ensureAdmin, login, getSession, logout, changePassword, mustChange };
