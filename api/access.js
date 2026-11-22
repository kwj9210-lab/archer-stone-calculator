import {
  COOKIE_NAME, answer, checkPassword, clearSessionCookie, db, digest, eqFilter, errorAnswer,
  getMember, hashPassword, insertSession, jsonRequest, nicknameKey, readCookie,
  sameOrigin, sessionCookie, throttle, validPassword
} from '../lib/access.js';

const NO_STORE = { 'Cache-Control': 'no-store' };
const fail = (status, message) => errorAnswer(status, message);

export async function GET(request) {
  try {
    const member = await getMember(request);
    if (!member) return fail(401, '로그인이 필요합니다.');
    const view = new URL(request.url).searchParams.get('view') || 'me';
    if (view === 'me') return answer({ ok: true, user: { id: member.id, nickname: member.nickname, role: member.role } });
    if (view !== 'users') return fail(400, '잘못된 요청입니다.');
    if (member.role !== 'admin') return fail(403, '관리자만 접근할 수 있습니다.');
    const users = await db('access_members?select=id,nickname,role,status,created_at,approved_at,last_login_at,login_count&order=created_at.desc&limit=500');
    return answer({ ok: true, users });
  } catch (error) {
    console.error('GET /api/access:', error.message);
    return fail(503, '회원정보를 불러올 수 없습니다.');
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return fail(403, '허용되지 않은 요청입니다.');
  let payload;
  try { payload = await jsonRequest(request); }
  catch { return fail(400, 'JSON 입력을 확인해 주세요.'); }
  const action = payload?.action;
  try {
    if (action === 'logout') {
      const token = readCookie(request);
      if (token) await db('access_sessions?token_hash=' + eqFilter(digest(token)), { method: 'DELETE' });
      return answer({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
    }
    if (action !== 'signup' && action !== 'login') return fail(400, '알 수 없는 요청입니다.');
    const nickname = nicknameKey(payload.nickname);
    if (!nickname || !validPassword(payload.password)) return fail(400, '닉네임은 2~20자, 비밀번호는 10~128자로 입력해 주세요.');
    if (!await throttle(request, action, action === 'signup' ? 5 : 15, 600)) return fail(429, '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const rows = await db('access_members?select=id,nickname,role,status,password_hash,login_count&nickname_key=' + eqFilter(nickname.key) + '&limit=1');
    const existing = rows?.[0];
    if (action === 'signup') {
      if (existing) return fail(409, '이미 사용 중인 닉네임입니다.');
      const passwordHash = await hashPassword(payload.password);
      await db('access_members', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: { nickname: nickname.display, nickname_key: nickname.key, password_hash: passwordHash, status: 'pending', role: 'member' }
      });
      return answer({ ok: true, message: '가입 신청이 접수됐습니다. 관리자 승인 후 로그인할 수 있습니다.' }, 202);
    }
    // Same generic error for unknown nicknames and incorrect passwords.
    const matched = existing ? await checkPassword(payload.password, existing.password_hash) : false;
    if (!matched) return fail(401, '닉네임 또는 비밀번호가 일치하지 않습니다.');
    if (existing.status === 'pending') return fail(403, '관리자 승인 대기 중입니다.');
    if (existing.status !== 'approved') return fail(403, '사용할 수 없는 계정입니다.');
    const token = await insertSession(existing.id);
    await db('access_members?id=' + eqFilter(existing.id), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: { last_login_at: new Date().toISOString(), login_count: Number(existing.login_count || 0) + 1 }
    });
    return answer({ ok: true, role: existing.role, nickname: existing.nickname }, 200, { 'Set-Cookie': sessionCookie(token) });
  } catch (error) {
    console.error('POST /api/access:', error.message);
    return fail(503, '현재 요청을 처리할 수 없습니다.');
  }
}

export async function PATCH(request) {
  if (!sameOrigin(request)) return fail(403, '허용되지 않은 요청입니다.');
  let payload;
  try { payload = await jsonRequest(request); }
  catch { return fail(400, 'JSON 입력을 확인해 주세요.'); }
  if (!['pending', 'approved', 'rejected', 'blocked'].includes(payload?.status) || !/^[a-f0-9-]{36}$/i.test(String(payload?.id || ''))) {
    return fail(400, '회원 또는 승인 상태가 올바르지 않습니다.');
  }
  try {
    const admin = await getMember(request);
    if (!admin || admin.role !== 'admin') return fail(403, '관리자만 처리할 수 있습니다.');
    const users = await db('access_members?select=id,role,status&id=' + eqFilter(payload.id) + '&limit=1');
    const user = users?.[0];
    if (!user) return fail(404, '회원을 찾을 수 없습니다.');
    if (user.role === 'admin') return fail(403, '관리자 계정은 이 화면에서 변경할 수 없습니다.');
    const patch = { status: payload.status, approved_at: payload.status === 'approved' ? new Date().toISOString() : null };
    await db('access_members?id=' + eqFilter(payload.id), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: patch
    });
    if (payload.status !== 'approved') {
      await db('access_sessions?member_id=' + eqFilter(payload.id), { method: 'DELETE' });
    }
    return answer({ ok: true });
  } catch (error) {
    console.error('PATCH /api/access:', error.message);
    return fail(503, '승인 상태를 변경하지 못했습니다.');
  }
}
