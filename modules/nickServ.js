/**
 * Lightweight NickServ (선택적 닉네임 비밀번호 보호 모듈)
 *
 * 설계 원칙:
 * 1. 선택적 보호: 비밀번호를 등록하지 않은 일반 사용자는 기존처럼 완전 익명으로 자유롭게 사용.
 * 2. 닉네임 선점/도배 방지 (1일 생성 횟수 제한):
 *    - 동일 IP에서 24시간 동안 최대 3개의 닉네임만 신규 등록 허용 (무단 대량 선점 차단).
 * 3. 브루트포스(사전 대입) 방어:
 *    - 5회 연속 인증 실패 시 15분간 해당 IP에서 해당 닉네임 인증 차단(Lockout) + 소켓 강제 연결 종료(Kick).
 * 4. 인증 유예 시간 (Grace Period):
 *    - 등록된 닉네임으로 접속하거나 변경 시 60초의 유예 시간 부여.
 *    - 60초 내 미인증 시 '게스트_xxxx' 임시 닉네임으로 자동 강제 변경.
 *    - 미인증 상태에서는 사칭 발언 방지를 위해 일반 메시지 전송 차단 (/identify, /nickpass 만 허용).
 * 5. 표준 보안 암호화:
 *    - Node.js 내장 crypto PBKDF2 (SHA-256, 10,000 iterations, 16-byte random salt, timingSafeEqual).
 * 6. 데이터 영속성:
 *    - data/registered_nicks.json (디바운스 자동 저장).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { safeAtomicWriteFileSync } = require('./fsSafe');

class NickServ {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.dbPath = path.join(this.dataDir, 'registered_nicks.json');
    this.saveDebounceMs = options.saveDebounceMs || 1000;
    this.saveTimer = null;

    // Registered Nicknames DB: lowercaseNick -> { nickname, salt, hash, registeredAt, registeredIp, lastLoginAt }
    this.nicks = new Map();

    // IP Daily Registration Limit (Max 3 registrations per 24 hours per IP)
    this.DAILY_REG_LIMIT = 3;
    this.DAILY_REG_WINDOW_MS = 24 * 60 * 60 * 1000;
    this.ipRegistrations = new Map(); // ip -> [timestamp, ...]

    // Brute Force Lockout (5 failed attempts -> 15 min lock)
    this.MAX_LOGIN_ATTEMPTS = 5;
    this.LOCKOUT_DURATION_MS = 15 * 60 * 1000;
    this.loginAttempts = new Map(); // key(ip_lowercaseNick) -> { count, lockedUntil, lastAttempt }

    // Grace Period Duration for Unverified Users
    this.GRACE_PERIOD_MS = 60 * 1000; // 60 seconds

    this.load();

    // Periodic in-memory Map cleanup every 10 minutes to prevent memory leak on long-running servers
    setInterval(() => {
      const now = Date.now();
      for (const [key, attempt] of this.loginAttempts.entries()) {
        if (attempt && attempt.lockedUntil && now > attempt.lockedUntil) {
          this.loginAttempts.delete(key);
        } else if (attempt && !attempt.lockedUntil && (now - attempt.lastAttempt) > this.LOCKOUT_DURATION_MS) {
          this.loginAttempts.delete(key);
        }
      }
      for (const [ip, timestamps] of this.ipRegistrations.entries()) {
        const valid = (timestamps || []).filter(t => (now - t) <= this.DAILY_REG_WINDOW_MS);
        if (valid.length === 0) this.ipRegistrations.delete(ip);
        else this.ipRegistrations.set(ip, valid);
      }
    }, 10 * 60 * 1000);
  }

  load() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const data = JSON.parse(raw);
        for (const [k, v] of Object.entries(data)) {
          this.nicks.set(k.toLowerCase(), v);
        }
        console.log(`[NickServ] Loaded ${this.nicks.size} registered nicknames.`);
      }
    } catch (err) {
      console.error('[NickServ] Failed to load registered_nicks.json:', err);
    }
  }

  saveDebounced() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const obj = {};
        for (const [k, v] of this.nicks.entries()) {
          obj[k] = v;
        }
        safeAtomicWriteFileSync(this.dbPath, JSON.stringify(obj, null, 2), 'utf8');
      } catch (err) {
        console.error('[NickServ] Failed to save registered_nicks.json:', err);
      }
    }, this.saveDebounceMs);
  }

  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  }

  generateSalt() {
    return crypto.randomBytes(16).toString('hex');
  }

  isRegistered(nickname) {
    if (!nickname) return false;
    return this.nicks.has(nickname.toLowerCase());
  }

  getRegistrationInfo(nickname) {
    if (!nickname) return null;
    return this.nicks.get(nickname.toLowerCase()) || null;
  }

  isReservedName(nickname) {
    if (!nickname) return true;
    const clean = nickname.toLowerCase().trim();
    if (clean === '냥봇' || clean === '챗봇' || clean === 'bot_nyaa' || clean === '^냥봇') return true;
    if (clean === '네무' || clean === '네무로' || clean === 'nemu' || clean === 'nemulo') return true;
    if (clean === 'system' || clean === 'admin' || clean === '관리자' || clean === '운영자') return true;
    if (clean.startsWith('게스트_') || clean.startsWith('유저_') || clean.startsWith('guest_') || clean.startsWith('user_') || clean.startsWith('임시_')) return true;
    return false;
  }

  checkRegistrationRate(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1') return { allowed: true };
    const now = Date.now();
    let timestamps = this.ipRegistrations.get(ip) || [];
    timestamps = timestamps.filter(t => (now - t) <= this.DAILY_REG_WINDOW_MS);
    this.ipRegistrations.set(ip, timestamps);
    if (timestamps.length >= this.DAILY_REG_LIMIT) {
      return {
        allowed: false,
        reason: `동일 IP에서 24시간 동안 최대 ${this.DAILY_REG_LIMIT}개의 닉네임만 등록할 수 있습니다.`
      };
    }
    return { allowed: true };
  }

  recordRegistration(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1') return;
    const now = Date.now();
    let timestamps = this.ipRegistrations.get(ip) || [];
    timestamps = timestamps.filter(t => (now - t) <= this.DAILY_REG_WINDOW_MS);
    timestamps.push(now);
    this.ipRegistrations.set(ip, timestamps);
  }

  registerNickname(ip, nickname, password, userId) {
    const cleanNick = (nickname || '').trim();
    if (!cleanNick || cleanNick.length < 2 || cleanNick.length > 16) {
      return { success: false, message: '* ⚠️ 닉네임은 2자 이상 16자 이하만 등록 가능합니다.' };
    }
    if (!password || password.length < 4 || password.length > 64) {
      return { success: false, message: '* ⚠️ 비밀번호는 4자 이상 64자 이하로 설정해 주세요.' };
    }
    if (this.isReservedName(cleanNick)) {
      return { success: false, message: `* ⚠️ "${cleanNick}"은(는) 예약된 시스템 닉네임이므로 비밀번호를 등록할 수 없습니다.` };
    }
    if (this.isRegistered(cleanNick)) {
      return { success: false, message: `* ⚠️ "${cleanNick}"은(는) 이미 등록된 닉네임입니다. (비밀번호 변경: /nickpass <기존암호> <새암호>)` };
    }

    const rateCheck = this.checkRegistrationRate(ip);
    if (!rateCheck.allowed) {
      return { success: false, message: `* ⚠️ [등록 한도 초과] ${rateCheck.reason}` };
    }

    const salt = this.generateSalt();
    const hash = this.hashPassword(password, salt);
    const now = Date.now();

    const record = {
      nickname: cleanNick,
      salt,
      hash,
      registeredAt: now,
      registeredIp: ip || '',
      lastLoginAt: now,
      userId: userId || ''
    };

    this.nicks.set(cleanNick.toLowerCase(), record);
    this.recordRegistration(ip);
    this.saveDebounced();

    return {
      success: true,
      message: `* 🔒 닉네임 [${cleanNick}]의 비밀번호가 안전하게 등록되었습니다! 다음 접속부터는 /identify <암호> 로 인증해주세요.`
    };
  }

  isLockedOut(ip, nickname) {
    const cleanNick = (nickname || '').trim().toLowerCase();
    const attemptKey = `${ip || 'unknown'}_${cleanNick}`;
    const now = Date.now();
    const attempt = this.loginAttempts.get(attemptKey);
    if (attempt && attempt.lockedUntil && now < attempt.lockedUntil) {
      const remainingMinutes = Math.ceil((attempt.lockedUntil - now) / (60 * 1000));
      return { locked: true, remainingMinutes };
    }
    return { locked: false, remainingMinutes: 0 };
  }

  verifyPassword(ip, nickname, password) {
    const cleanNick = (nickname || '').trim().toLowerCase();
    const record = this.nicks.get(cleanNick);
    if (!record) {
      return { success: false, isRegistered: false, message: '* ⚠️ 등록되지 않은 닉네임입니다.' };
    }

    const attemptKey = `${ip || 'unknown'}_${cleanNick}`;
    const now = Date.now();
    let attempt = this.loginAttempts.get(attemptKey) || { count: 0, lockedUntil: 0, lastAttempt: now };

    // Check if locked
    if (attempt.lockedUntil && now < attempt.lockedUntil) {
      const remainingMinutes = Math.ceil((attempt.lockedUntil - now) / (60 * 1000));
      return {
        success: false,
        isRegistered: true,
        locked: true,
        remainingMinutes,
        message: `* 🚫 [인증 잠금] 비밀번호 5회 연속 오류로 인해 ${remainingMinutes}분 동안 해당 닉네임 인증이 차단되었습니다.`
      };
    }

    // Verify hash with timingSafeEqual
    const inputHash = this.hashPassword(password, record.salt);
    const match = crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(record.hash, 'hex'));

    if (match) {
      // Reset attempts on success
      this.loginAttempts.delete(attemptKey);
      record.lastLoginAt = now;
      this.saveDebounced();
      return {
        success: true,
        isRegistered: true,
        message: `* 🔓 닉네임 [${record.nickname}]의 본인 인증이 완료되었습니다.`
      };
    } else {
      attempt.count = (attempt.count || 0) + 1;
      attempt.lastAttempt = now;

      if (attempt.count >= this.MAX_LOGIN_ATTEMPTS) {
        attempt.lockedUntil = now + this.LOCKOUT_DURATION_MS;
        this.loginAttempts.set(attemptKey, attempt);
        return {
          success: false,
          isRegistered: true,
          count: attempt.count,
          locked: true,
          shouldKick: true,
          message: `* 🚫 [인증 잠금] 비밀번호를 5회 연속 잘못 입력하여 15분간 해당 닉네임 인증이 차단되며 연결이 종료됩니다.`
        };
      } else {
        this.loginAttempts.set(attemptKey, attempt);
        const remaining = this.MAX_LOGIN_ATTEMPTS - attempt.count;
        return {
          success: false,
          isRegistered: true,
          count: attempt.count,
          remainingAttempts: remaining,
          message: `* ⚠️ 비밀번호가 일치하지 않습니다. (실패 ${attempt.count}/5회 - 남은 횟수: ${remaining}회)`
        };
      }
    }
  }

  changePassword(nickname, oldPassword, newPassword) {
    const cleanNick = (nickname || '').trim().toLowerCase();
    const record = this.nicks.get(cleanNick);
    if (!record) {
      return { success: false, message: '* ⚠️ 등록되지 않은 닉네임입니다.' };
    }
    const oldHash = this.hashPassword(oldPassword, record.salt);
    if (!crypto.timingSafeEqual(Buffer.from(oldHash, 'hex'), Buffer.from(record.hash, 'hex'))) {
      return { success: false, message: '* ⚠️ 기존 비밀번호가 일치하지 않습니다.' };
    }
    if (!newPassword || newPassword.length < 4 || newPassword.length > 64) {
      return { success: false, message: '* ⚠️ 새 비밀번호는 4자 이상 64자 이하로 설정해 주세요.' };
    }
    const newSalt = this.generateSalt();
    record.salt = newSalt;
    record.hash = this.hashPassword(newPassword, newSalt);
    this.saveDebounced();
    return { success: true, message: `* 🔑 닉네임 [${record.nickname}]의 비밀번호가 성공적으로 변경되었습니다.` };
  }

  unregisterNickname(nickname, password) {
    const cleanNick = (nickname || '').trim().toLowerCase();
    const record = this.nicks.get(cleanNick);
    if (!record) {
      return { success: false, message: '* ⚠️ 등록되지 않은 닉네임입니다.' };
    }
    const oldHash = this.hashPassword(password, record.salt);
    if (!crypto.timingSafeEqual(Buffer.from(oldHash, 'hex'), Buffer.from(record.hash, 'hex'))) {
      return { success: false, message: '* ⚠️ 비밀번호가 일치하지 않아 등록을 해제할 수 없습니다.' };
    }
    this.nicks.delete(cleanNick);
    this.saveDebounced();
    return { success: true, message: `* 🔓 닉네임 [${record.nickname}]의 비밀번호 등록이 해제되었습니다. 이제 누구나 사용할 수 있습니다.` };
  }
}

module.exports = { NickServ };
