/**
 * Anti-Spam Rate Limiting and Penalty Module for Nyaa Chat
 *
 * Rules:
 * 1. Detection: 10 messages within 5 seconds (5,000 ms)
 * 2. Strike 1 & 2: 1-minute timeout (mute) + warning notice
 * 3. Strike 3 (within 24 hours): 24-hour (1 day) temporary IP ban + disconnect
 * 4. Whitelist: Server operators and official bots are exempt
 */

const SPAM_WINDOW_MS = 5 * 1000;         // 5 seconds
const SPAM_MAX_MESSAGES = 10;            // 10 messages
const MUTE_DURATION_MS = 60 * 1000;      // 1 minute (60,000 ms)
const STRIKE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const TEMP_BAN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_STRIKES = 3;

// In-memory tracking structures
const userRecentTimestamps = new Map(); // key -> [timestamp, ...]
const userStrikes = new Map();          // key -> [{ timestamp }, ...]
const userMutes = new Map();            // key -> muteUntilTimestamp
const tempBans = new Map();             // ip -> { banUntil, reason }

function getTrackingKey(ip, userId) {
  // Use IP as primary tracking key so reloading/re-logging with different nick/id doesn't bypass
  if (ip && ip !== '::1' && ip !== '127.0.0.1') {
    return `ip_${ip}`;
  }
  return userId ? `user_${userId}` : `ip_${ip || 'unknown'}`;
}

function isWhitelisted(user) {
  if (!user) return false;
  if (user.isServerOper) return true;
  if (user.isAiOper) return true; // AI 협업 운영자 도배/속도제한 면제
  if (user.isBot || user.userId === 'bot_nyaa' || user.nickname === '냥봇') return true;
  return false;
}

/**
 * Check if the user/IP is currently in a 1-minute timeout
 */
function isMuted(ip, userId) {
  const key = getTrackingKey(ip, userId);
  const muteUntil = userMutes.get(key);
  if (!muteUntil) return { isMuted: false, remainingSeconds: 0, strikeCount: 0 };

  const now = Date.now();
  if (now >= muteUntil) {
    userMutes.delete(key);
    return { isMuted: false, remainingSeconds: 0, strikeCount: 0 };
  }

  const remainingSeconds = Math.ceil((muteUntil - now) / 1000);
  const strikeList = getValidStrikes(key);
  return {
    isMuted: true,
    remainingSeconds,
    strikeCount: strikeList.length
  };
}

/**
 * Check if an IP is currently banned under the 24-hour temporary ban
 */
function isTempBanned(ip) {
  if (!ip) return { isBanned: false };
  const banInfo = tempBans.get(ip);
  if (!banInfo) return { isBanned: false };

  const now = Date.now();
  if (now >= banInfo.banUntil) {
    tempBans.delete(ip);
    return { isBanned: false };
  }

  const remainingMs = banInfo.banUntil - now;
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  return {
    isBanned: true,
    remainingMs,
    remainingHours,
    reason: banInfo.reason,
    banUntil: banInfo.banUntil
  };
}

function getValidStrikes(key) {
  const now = Date.now();
  const list = userStrikes.get(key) || [];
  const valid = list.filter(item => (now - item.timestamp) < STRIKE_EXPIRY_MS);
  if (valid.length !== list.length) {
    if (valid.length === 0) {
      userStrikes.delete(key);
    } else {
      userStrikes.set(key, valid);
    }
  }
  return valid;
}

/**
 * Inspect message sending rate.
 * Returns:
 *  - { allowed: true }
 *  - { allowed: false, action: 'timeout', strikeCount: number, durationSeconds: number, muteUntil: number }
 *  - { allowed: false, action: 'ban', strikeCount: 3, durationHours: number, banUntil: number }
 */
function checkMessage(user, ip) {
  if (isWhitelisted(user)) {
    return { allowed: true };
  }

  const now = Date.now();
  const key = getTrackingKey(ip, user?.userId);

  // 1. Check if already muted
  const muteCheck = isMuted(ip, user?.userId);
  if (muteCheck.isMuted) {
    return {
      allowed: false,
      action: 'already_muted',
      remainingSeconds: muteCheck.remainingSeconds,
      strikeCount: muteCheck.strikeCount
    };
  }

  // 2. Record this message timestamp
  let timestamps = userRecentTimestamps.get(key) || [];
  timestamps = timestamps.filter(t => (now - t) <= SPAM_WINDOW_MS);
  timestamps.push(now);
  userRecentTimestamps.set(key, timestamps);

  // 3. Check if burst limit exceeded (>= SPAM_MAX_MESSAGES within SPAM_WINDOW_MS)
  if (timestamps.length >= SPAM_MAX_MESSAGES) {
    // Reset recent burst timestamps so we don't trigger multiple strikes on the same burst
    userRecentTimestamps.delete(key);

    // Add strike
    const strikes = getValidStrikes(key);
    strikes.push({ timestamp: now });
    userStrikes.set(key, strikes);

    const strikeCount = strikes.length;

    if (strikeCount >= MAX_STRIKES) {
      // Strike 3: 24-Hour Ban
      const banUntil = now + TEMP_BAN_DURATION_MS;
      if (ip) {
        tempBans.set(ip, {
          ip,
          nickname: user?.nickname || '알 수 없음',
          userId: user?.userId || '',
          bannedAt: now,
          banUntil,
          reason: '24시간 내 도배 3회 누적 (하루 밴)'
        });
      }
      return {
        allowed: false,
        action: 'ban',
        strikeCount,
        durationHours: 24,
        banUntil
      };
    } else {
      // Strike 1 or 2: 1-Minute Mute
      const muteUntil = now + MUTE_DURATION_MS;
      userMutes.set(key, muteUntil);
      return {
        allowed: false,
        action: 'timeout',
        strikeCount,
        durationSeconds: 60,
        muteUntil
      };
    }
  }

  return { allowed: true };
}


// Channel Join Flood Protection:
// Rule: Max 5 channel joins per 2 seconds (2,000 ms)
const JOIN_FLOOD_WINDOW_MS = 2 * 1000;   // 2 seconds
const JOIN_FLOOD_MAX = 5;                // max 5 channel joins in 2 seconds
const JOIN_STRIKE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const userRecentJoinTimestamps = new Map(); // key -> [timestamp, ...]
const userJoinStrikes = new Map();          // key -> [{ timestamp }, ...]

function getValidJoinStrikes(key) {
  const now = Date.now();
  const list = userJoinStrikes.get(key) || [];
  const valid = list.filter(item => (now - item.timestamp) < JOIN_STRIKE_EXPIRY_MS);
  if (valid.length !== list.length) {
    if (valid.length === 0) {
      userJoinStrikes.delete(key);
    } else {
      userJoinStrikes.set(key, valid);
    }
  }
  return valid;
}

/**
 * Inspect channel join rate.
 * Returns:
 *  - { allowed: true }
 *  - { allowed: false, action: 'disconnect', strikeCount: number, reason: string }
 *  - { allowed: false, action: 'ban', strikeCount: 3, durationHours: 24, banUntil: number, reason: string }
 */
function checkJoinFlood(user, ip) {
  if (isWhitelisted(user)) {
    return { allowed: true };
  }

  const now = Date.now();
  const key = getTrackingKey(ip, user?.userId);

  let timestamps = userRecentJoinTimestamps.get(key) || [];
  timestamps = timestamps.filter(t => (now - t) <= JOIN_FLOOD_WINDOW_MS);
  timestamps.push(now);
  userRecentJoinTimestamps.set(key, timestamps);

  if (timestamps.length > JOIN_FLOOD_MAX) {
    userRecentJoinTimestamps.delete(key);

    const strikes = getValidJoinStrikes(key);
    strikes.push({ timestamp: now });
    userJoinStrikes.set(key, strikes);

    const strikeCount = strikes.length;

    if (strikeCount >= MAX_STRIKES) {
      const banUntil = now + TEMP_BAN_DURATION_MS;
      if (ip) {
        tempBans.set(ip, {
          ip,
          nickname: user?.nickname || '알 수 없음',
          userId: user?.userId || '',
          bannedAt: now,
          banUntil,
          reason: '2초당 5개 초과 채널 과다 입장(Join Flood) 3회 적발 (하루 밴)'
        });
      }
      return {
        allowed: false,
        action: 'ban',
        strikeCount,
        durationHours: 24,
        banUntil,
        reason: '비정상적인 속도의 채널 입장(Join Flood)이 3회 누적되어 24시간 동안 서버 접속이 차단되었습니다.'
      };
    } else {
      return {
        allowed: false,
        action: 'disconnect',
        strikeCount,
        reason: `* ⚠️ [채널 입장 제한] 2초당 5개 이상의 채널 과다 입장(Join Flood)이 감지되어 연결이 종료되었습니다. (경고 ${strikeCount}/3 - 3회 적발 시 24시간 차단)`
      };
    }
  }

  return { allowed: true };
}

function clearTempBan(ip) {
  if (ip && tempBans.has(ip)) {
    tempBans.delete(ip);
    return true;
  }
  return false;
}

function getTempBansList() {
  const now = Date.now();
  const list = [];
  for (const [ip, info] of tempBans.entries()) {
    if (now < info.banUntil) {
      const remainingMs = info.banUntil - now;
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      list.push({
        ip,
        nickname: info.nickname || '알 수 없음',
        userId: info.userId || '',
        reason: info.reason || '도배 3회 누적',
        bannedAt: info.bannedAt || (info.banUntil - TEMP_BAN_DURATION_MS),
        banUntil: info.banUntil,
        remainingMinutes,
        type: 'temp_spam'
      });
    } else {
      tempBans.delete(ip);
    }
  }
  return list;
}

function clearUserData(ip, userId) {
  const key = getTrackingKey(ip, userId);
  userRecentTimestamps.delete(key);
  userStrikes.delete(key);
  userMutes.delete(key);
  userRecentJoinTimestamps.delete(key);
  userJoinStrikes.delete(key);
  if (ip) tempBans.delete(ip);
}

function clearMuteOnly(ip, userId) {
  const key = getTrackingKey(ip, userId);
  userMutes.delete(key);
}

// Connection Handshake Rate Limiting (WebSocket Connection Rate Limiting)
// Rule: Max 10 handshakes per 2 seconds (2,000 ms) per IP
const CONN_FLOOD_WINDOW_MS = 2 * 1000;
const CONN_FLOOD_MAX = 10;
const connRecentTimestamps = new Map(); // ip -> [timestamp, ...]
const connStrikes = new Map();          // ip -> [{ timestamp }, ...]

function checkConnectionRate(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return { allowed: true };
  }

  const now = Date.now();
  let timestamps = connRecentTimestamps.get(ip) || [];
  timestamps = timestamps.filter(t => (now - t) <= CONN_FLOOD_WINDOW_MS);
  timestamps.push(now);
  connRecentTimestamps.set(ip, timestamps);

  if (timestamps.length > CONN_FLOOD_MAX) {
    connRecentTimestamps.delete(ip);
    let strikes = connStrikes.get(ip) || [];
    strikes = strikes.filter(item => (now - item.timestamp) < STRIKE_EXPIRY_MS);
    strikes.push({ timestamp: now });
    connStrikes.set(ip, strikes);

    const strikeCount = strikes.length;
    if (strikeCount >= MAX_STRIKES) {
      const banUntil = now + TEMP_BAN_DURATION_MS;
      tempBans.set(ip, {
        ip,
        nickname: '연결 폭주 감지',
        userId: '',
        bannedAt: now,
        banUntil,
        reason: '비정상적인 웹소켓 연결 폭주(Connection Flood) 3회 적발 (24시간 차단)'
      });
      return {
        allowed: false,
        action: 'ban',
        strikeCount,
        reason: '비정상적인 연결 시도 누적으로 24시간 동안 차단되었습니다.'
      };
    } else {
      return {
        allowed: false,
        action: 'reject',
        strikeCount,
        reason: `연결 요청 속도 초과 (경고 ${strikeCount}/3)`
      };
    }
  }

  return { allowed: true };
}

// Periodic cleanup every 10 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, muteUntil] of userMutes.entries()) {
    if (now >= muteUntil) userMutes.delete(key);
  }
  for (const [ip, info] of tempBans.entries()) {
    if (now >= info.banUntil) tempBans.delete(ip);
  }
  for (const key of userJoinStrikes.keys()) {
    getValidJoinStrikes(key);
  }
  for (const [key, timestamps] of userRecentJoinTimestamps.entries()) {
    const valid = timestamps.filter(t => (now - t) <= JOIN_FLOOD_WINDOW_MS);
    if (valid.length === 0) userRecentJoinTimestamps.delete(key);
    else userRecentJoinTimestamps.set(key, valid);
  }
  for (const [ip, timestamps] of connRecentTimestamps.entries()) {
    const valid = timestamps.filter(t => (now - t) <= CONN_FLOOD_WINDOW_MS);
    if (valid.length === 0) connRecentTimestamps.delete(ip);
    else connRecentTimestamps.set(ip, valid);
  }
  for (const key of userStrikes.keys()) {
    getValidStrikes(key);
  }
  for (const [key, timestamps] of userRecentTimestamps.entries()) {
    const valid = timestamps.filter(t => (now - t) <= SPAM_WINDOW_MS);
    if (valid.length === 0) userRecentTimestamps.delete(key);
    else userRecentTimestamps.set(key, valid);
  }
}, 10 * 60 * 1000);

module.exports = {
  SPAM_WINDOW_MS,
  SPAM_MAX_MESSAGES,
  MUTE_DURATION_MS,
  STRIKE_EXPIRY_MS,
  TEMP_BAN_DURATION_MS,
  MAX_STRIKES,
  isMuted,
  isTempBanned,
  checkMessage,
  clearTempBan,
  getTempBansList,
  clearUserData,
  clearMuteOnly,
  JOIN_FLOOD_WINDOW_MS,
  JOIN_FLOOD_MAX,
  checkJoinFlood,
  CONN_FLOOD_WINDOW_MS,
  CONN_FLOOD_MAX,
  checkConnectionRate,
  getTrackingKey
};
