const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { safeAtomicWriteFile, safeAtomicWriteFileSync } = require('./modules/fsSafe');
const { setupUploadModule } = require('./modules/uploadModule');
const { setupDmModule } = require('./modules/dmModule');
const { setupPeerDirectoryModule } = require('./modules/peerDirectoryModule');
const antiSpam = require('./modules/antiSpam');
const cors = require('cors');

const app = express();

// Timing-safe constant-time string comparison to prevent timing attacks
function secureCompareStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// HTTPS Enforcement: Redirect external HTTP traffic to HTTPS (preserving local networks)
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');
  const proto = req.headers['x-forwarded-proto'];
  if (proto && proto.toLowerCase() === 'http' && !isLocal) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Feature Flag: Media and File Upload Support
// Default: false (Separated and disabled for lightweight RAM & resource optimization)
const ENABLE_MEDIA_UPLOAD = process.env.ENABLE_MEDIA_UPLOAD === 'true';

// Feature Flag: 1:1 Direct Message Support
// Default: false (Separated and disabled per user policy)
const ENABLE_1ON1_DM = process.env.ENABLE_1ON1_DM === 'true';

const serverStartTime = Date.now();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: ENABLE_MEDIA_UPLOAD ? 1e8 : 1e6 // 1MB for text chat, 100MB if media enabled
});

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const BANNED_IPS_FILE = path.join(DATA_DIR, 'banned_ips.json');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// IP Ban Storage & Metadata
let bannedIps = new Set();
let bannedIpMeta = new Map(); // ip -> { ip, nickname, userId, reason, bannedBy, bannedAt }

try {
  if (fs.existsSync(BANNED_IPS_FILE)) {
    const list = JSON.parse(fs.readFileSync(BANNED_IPS_FILE, 'utf-8'));
    if (Array.isArray(list)) {
      list.forEach((item) => {
        if (typeof item === 'string') {
          bannedIps.add(item);
          bannedIpMeta.set(item, {
            ip: item,
            nickname: '(기록 없음)',
            userId: '',
            reason: '관리자 영구 차단',
            bannedBy: '관리자',
            bannedAt: 0
          });
        } else if (item && item.ip) {
          bannedIps.add(item.ip);
          bannedIpMeta.set(item.ip, item);
        }
      });
    }
  }
} catch (e) {
  console.error('Failed to load banned IPs:', e);
}

function saveBannedIps() {
  try {
    const serialized = Array.from(bannedIps).map((ip) => {
      return (
        bannedIpMeta.get(ip) || {
          ip,
          nickname: '(기록 없음)',
          userId: '',
          reason: '관리자 영구 차단',
          bannedBy: '관리자',
          bannedAt: Date.now()
        }
      );
    });
    safeAtomicWriteFile(BANNED_IPS_FILE, JSON.stringify(serialized, null, 2), 'utf-8', (err) => {
      if (err) console.error('Failed to save banned IPs:', err);
    });
  } catch (e) {}
}

function getClientIp(socket) {
  if (!socket) return '';
  const forwarded = socket.handshake?.headers?.['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim().replace(/^::ffff:/, '');
  }
  const raw = socket.handshake?.address || socket.conn?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '');
}

// User IP Tracking (Recent mapping of userId -> client IP for offline moderation)
const userLastIpMap = new Map();
function recordUserIp(userId, ip) {
  if (userId && ip) userLastIpMap.set(userId, ip);
}
function getUserIp(userId) {
  if (!userId) return '';
  return userLastIpMap.get(userId) || '';
}

// Load or initialize messages
let messageHistory = {};
try {
  if (fs.existsSync(MESSAGES_FILE)) {
    messageHistory = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('Error reading messages file, starting fresh', e);
  messageHistory = {};
}

let saveMessagesTimer = null;
function saveMessagesDebounced() {
  if (saveMessagesTimer) return;
  saveMessagesTimer = setTimeout(() => {
    saveMessagesTimer = null;
    try {
      safeAtomicWriteFile(MESSAGES_FILE, JSON.stringify(messageHistory), 'utf-8', (err) => {
        if (err) console.error('Failed to save message history:', err);
      });
    } catch (e) {
      console.error('Failed to save message history:', e);
    }
  }, 1000);
}

// Active users map: socketId -> User Info
const users = new Map();

// Server Bot: Permanently guards official service channels
const BOT_ID = 'bot_nyaa';
const BOT_NAME = '냥봇';
const BOT_AVATAR = '^';

const SERVER_BOT = {
  socketId: 'bot_socket_nyaa',
  userId: BOT_ID,
  nickname: BOT_NAME,
  avatar: BOT_AVATAR,
  currentRoom: '#자유대화',
  joinedChannels: new Set(['#자유대화', '#ai-collab']),
  isBot: true,
  isOp: true,
  onlineAt: Date.now(),
  statusText: '서비스 채널 수호 봇 🐾'
};

// Register Server Bot in users map
users.set(SERVER_BOT.socketId, SERVER_BOT);

// Root Server Operator Credentials
const OPER_SECRET_FILE = path.join(DATA_DIR, 'oper_secret.key');
let expectedOperId = (process.env.OPER_USER || 'nemuru').trim();
let expectedOperPw = (process.env.OPER_PASS || '').trim();

if (!expectedOperPw) {
  try {
    if (fs.existsSync(OPER_SECRET_FILE)) {
      expectedOperPw = fs.readFileSync(OPER_SECRET_FILE, 'utf8').trim();
    }
  } catch (_) {}
}

if (!expectedOperPw) {
  expectedOperPw = crypto.randomBytes(16).toString('hex');
  try {
    safeAtomicWriteFileSync(OPER_SECRET_FILE, expectedOperPw + '\n', { encoding: 'utf8', mode: 0o600 });
    console.log(`[안내] data/oper_secret.key 에 32자리 보안 관리자 비밀번호를 자동 생성했습니다.`);
  } catch (e) {
    console.error('Failed to save oper_secret.key:', e);
  }
}

// Registered AI Operator Accounts for /aioper & exclusive reserved nicknames (Saved in gitignored data/)
const AIOPER_FILE = path.join(DATA_DIR, 'aioper_accounts.json');
let AIOPER_ACCOUNTS = {};

try {
  if (fs.existsSync(AIOPER_FILE)) {
    const raw = fs.readFileSync(AIOPER_FILE, 'utf8');
    AIOPER_ACCOUNTS = JSON.parse(raw);
  }
} catch (e) {
  console.error('Failed to load aioper_accounts.json:', e);
}

if (!AIOPER_ACCOUNTS['nemulo'] && process.env.AIOPER_NEMULO_PW) {
  AIOPER_ACCOUNTS['nemulo'] = {
    pw: process.env.AIOPER_NEMULO_PW,
    defaultNick: '네무로',
    name: '네무로 (AI 어시스턴트)'
  };
}
if (!AIOPER_ACCOUNTS['nemu'] && process.env.AIOPER_NEMU_PW) {
  AIOPER_ACCOUNTS['nemu'] = {
    pw: process.env.AIOPER_NEMU_PW,
    defaultNick: '네무',
    name: '네무 (AI 어시스턴트)'
  };
}
if (!AIOPER_ACCOUNTS['koko'] && process.env.AIOPER_KOKO_PW) {
  AIOPER_ACCOUNTS['koko'] = {
    pw: process.env.AIOPER_KOKO_PW,
    defaultNick: 'koko',
    name: 'koko (AI 어시스턴트)'
  };
}

try {
  if (!fs.existsSync(AIOPER_FILE) && Object.keys(AIOPER_ACCOUNTS).length > 0) {
    safeAtomicWriteFileSync(AIOPER_FILE, JSON.stringify(AIOPER_ACCOUNTS, null, 2), { encoding: 'utf8', mode: 0o600 });
  }
} catch (e) {}

const AI_RESERVED_NICKS = new Set(['네무', '네무로']);

function isAiReservedNickname(nick) {
  if (!nick) return false;
  return AI_RESERVED_NICKS.has(nick.trim());
}

// Operator / Admin channel naming check
function isOperChannelName(input) {
  if (!input) return false;
  const clean = input.toLowerCase().replace(/[\s_#-]+/g, '');
  return clean === '관리자' || clean === '운영자' || clean === 'admin' || clean === 'oper' || clean === 'staff' || clean.includes('관리자') || clean.includes('운영자');
}

function isOperChannel(channel) {
  if (!channel) return false;
  if (channel.isOperOnly) return true;
  return isOperChannelName(channel.id) || isOperChannelName(channel.name);
}

// Mode Helpers
function initChannelModes(channel) {
  if (!channel) return;
  if (!channel.modes) {
    channel.modes = {
      i: false, // invite-only
      t: true,  // topic protection (default true for op)
      k: null,  // key/password string or null
      l: null,  // limit number or null
      m: false, // moderated
      n: true,  // no external messages
      p: false, // private (hidden from /list)
      s: false  // secret (hidden completely)
    };
  }
  if (!channel.invitedUsers) channel.invitedUsers = new Set();
  else if (Array.isArray(channel.invitedUsers)) channel.invitedUsers = new Set(channel.invitedUsers);
  if (!channel.voices) channel.voices = new Set();
  else if (Array.isArray(channel.voices)) channel.voices = new Set(channel.voices);
  return channel;
}

function formatModeString(modes) {
  if (!modes) return '+t';
  let str = '+';
  ['t', 'n', 'i', 'm', 'p', 's'].forEach(flag => {
    if (modes[flag]) str += flag;
  });
  if (modes.k) str += 'k';
  if (modes.l) str += 'l';
  return str === '+' ? '' : str;
}

function parseModeString(modeStr, paramStr = '') {
  const result = [];
  if (!modeStr) return result;

  const rawParts = [...modeStr.trim().split(/\s+/), ...(paramStr ? paramStr.trim().split(/\s+/) : [])].filter(Boolean);
  const flagTokens = [];
  const params = [];

  for (const p of rawParts) {
    if (p.startsWith('+') || p.startsWith('-')) {
      flagTokens.push(p);
    } else {
      params.push(p);
    }
  }

  let paramIdx = 0;
  for (const token of flagTokens) {
    let currentAction = '+';
    for (let i = 0; i < token.length; i++) {
      const ch = token[i];
      if (ch === '+' || ch === '-') {
        currentAction = ch;
      } else {
        let arg = null;
        if (['k', 'l', 'v', 'o'].includes(ch)) {
          if (currentAction === '+' || ['v', 'o'].includes(ch)) {
            if (paramIdx < params.length) {
              arg = params[paramIdx++];
            }
          }
        }
        result.push({ action: currentAction, flag: ch, arg });
      }
    }
  }
  return result;
}

// Default Service channels: permanently guarded by the server bot
const DEFAULT_CHANNELS = [
  {
    id: '#자유대화',
    name: '#자유대화',
    topic: '모든 사용자와 자유롭게 대화하는 광장입니다.',
    icon: '#',
    createdBy: 'system',
    isService: true,
    operators: [BOT_ID],
    modes: { i: false, t: true, k: null, l: null, m: false, n: true, p: false, s: false }
  },
  {
    id: '#ai-collab',
    name: '#ai-collab',
    topic: '🤖 AI 에이전트 & 서버 총괄 운영자 협업 연구실 (+s 비밀 모드)',
    icon: '🤖',
    createdBy: 'system',
    isService: true,
    operators: [BOT_ID],
    modes: { i: false, t: true, k: null, l: null, m: false, n: true, p: true, s: true }
  }
];

let channelList = [...DEFAULT_CHANNELS];
try {
  if (fs.existsSync(CHANNELS_FILE)) {
    const loaded = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8'));
    if (Array.isArray(loaded) && loaded.length > 0) {
      const map = new Map();
      DEFAULT_CHANNELS.forEach(c => map.set(c.id, { ...c }));
      loaded.forEach(c => {
        initChannelModes(c);
        if (map.has(c.id)) {
          const def = map.get(c.id);
          map.set(c.id, { ...c, ...def });
        } else {
          if (isOperChannel(c)) {
            c.isOperOnly = true;
            if (!c.icon || c.icon === '#') c.icon = '⚖️';
          }
          map.set(c.id, c);
        }
      });
      channelList = Array.from(map.values());
    }
  }
} catch (e) {
  console.error('Error reading channels file:', e);
}

// Ensure all channels have mode structures initialized
channelList.forEach(c => initChannelModes(c));

function saveChannels() {
  try {
    const serialized = channelList.map(ch => ({
      ...ch,
      invitedUsers: Array.from(ch.invitedUsers || []),
      voices: Array.from(ch.voices || [])
    }));
    safeAtomicWriteFile(CHANNELS_FILE, JSON.stringify(serialized, null, 2), 'utf-8', (err) => {
      if (err) console.error('Failed to save channels:', err);
    });
  } catch (e) {
    console.error('Failed to save channels:', e);
  }
}

let saveChannelsTimer = null;
function saveChannelsDebounced() {
  if (saveChannelsTimer) return;
  saveChannelsTimer = setTimeout(() => {
    saveChannelsTimer = null;
    saveChannels();
  }, 100);
}

function getSerializedUsers(forUser = null) {
  return Array.from(users.values()).map(u => {
    let joined = u.joinedChannels ? Array.from(u.joinedChannels) : [u.currentRoom || '#자유대화'];
    // Filter out secret (+s) or private (+p) channels unless forUser is oper or a member of that channel!
    joined = joined.filter(chId => {
      const ch = getChannel(chId);
      if (!ch) return true;
      const isSecret = ch.modes && (ch.modes.s || ch.modes.p);
      if (!isSecret) return true;
      if (forUser && forUser.isServerOper) return true;
      if (forUser && forUser.joinedChannels && forUser.joinedChannels.has(chId)) return true;
      return false;
    });

    return {
      socketId: u.socketId,
      userId: u.userId,
      nickname: u.nickname,
      avatar: u.avatar,
      currentRoom: u.currentRoom,
      joinedChannels: joined,
      isBot: Boolean(u.isBot),
      isOp: Boolean(u.isOp),
      isServerOper: Boolean(u.isServerOper),
      isAiOper: Boolean(u.isAiOper),
      aiOperId: u.aiOperId || null,
      onlineAt: u.onlineAt,
      statusText: u.statusText
    };
  });
}

let broadcastUserListTimer = null;
function broadcastUserListDebounced() {
  if (broadcastUserListTimer) return;
  broadcastUserListTimer = setTimeout(() => {
    broadcastUserListTimer = null;
    for (const [sId, s] of io.sockets.sockets) {
      const user = users.get(sId);
      s.emit('user_list_update', getSerializedUsers(user));
    }
  }, 80);
}

// Get serialized channels with live user counts and bot presence info (scoped by user's joined channels)
function getChannelListWithUserCounts(forUser = null) {
  return channelList
    .filter(ch => {
      // 1. 관리자 전용 채널은 운영자 로그인(/oper) 상태의 사용자에게만 노출
      if (isOperChannel(ch)) {
        return Boolean(forUser && forUser.isServerOper);
      }
      // 2. 요구사항: 본인이 현재 참여 중인 채널(joinedChannels)만 사이드바에 표시
      // (외부 사이트 특정 채널 직행 시 자유채널 제외, joinedChannels가 없거나 빈 경우 기본 #자유대화 표시)
      if (forUser && forUser.joinedChannels) {
        return forUser.joinedChannels.has(ch.id) || (forUser.joinedChannels.size === 0 && ch.id === '#자유대화');
      }
      return ch.id === '#자유대화';
    })
    .map(ch => {
      const humanCount = getHumanUsersInRoom(ch.id).length;
      // For service channels, bot permanently guards the room (+1)
      const count = ch.isService ? humanCount + 1 : humanCount;
      const operOnly = Boolean(ch.isOperOnly || isOperChannel(ch));
      return {
        ...ch,
        isOperOnly: operOnly,
        userCount: count,
        hasBot: Boolean(ch.isService),
        hasKey: Boolean(ch.modes && ch.modes.k),
        modes: formatModeString(ch.modes)
      };
    });
}

// Get all public server channels for /list command (excluding +p/+s private/secret channels from non-members)
function getServerChannelList(forUser = null, keyword = '') {
  const cleanKw = (keyword || '').trim().toLowerCase();
  return channelList
    .filter(ch => {
      // 관리자 전용 채널은 운영자에게만 노출
      if (isOperChannel(ch) && (!forUser || !forUser.isServerOper)) {
        return false;
      }
      // +p (Private) 또는 +s (Secret) 채널은 참여자 또는 서버 운영자가 아니면 /list에서 숨김
      const isPrivate = ch.modes && (ch.modes.p || ch.modes.s);
      const isMember = forUser && forUser.joinedChannels && forUser.joinedChannels.has(ch.id);
      const isOper = forUser && forUser.isServerOper;
      if (isPrivate && !isMember && !isOper) {
        return false;
      }
      if (cleanKw) {
        const nameMatch = ch.name && ch.name.toLowerCase().includes(cleanKw);
        const topicMatch = ch.topic && ch.topic.toLowerCase().includes(cleanKw);
        if (!nameMatch && !topicMatch) return false;
      }
      return true;
    })
    .map(ch => {
      const humanCount = getHumanUsersInRoom(ch.id).length;
      const count = ch.isService ? humanCount + 1 : humanCount;
      return {
        id: ch.id,
        name: ch.name,
        topic: ch.topic || '',
        userCount: count,
        isJoined: Boolean(forUser && forUser.joinedChannels && forUser.joinedChannels.has(ch.id)),
        hasKey: Boolean(ch.modes && ch.modes.k),
        isPrivate: Boolean(ch.modes && (ch.modes.p || ch.modes.s)),
        modes: formatModeString(ch.modes),
        isService: Boolean(ch.isService)
      };
    });
}

let broadcastChannelListTimer = null;
function broadcastChannelListDebounced() {
  if (broadcastChannelListTimer) return;
  broadcastChannelListTimer = setTimeout(() => {
    broadcastChannelListTimer = null;
    for (const [sId, s] of io.sockets.sockets) {
      const user = users.get(sId);
      s.emit('channel_list_update', getChannelListWithUserCounts(user));
    }
  }, 80);
}

// Initial clean save
saveChannels();

function normalizeChannelId(input) {
  let clean = (input || '').trim();
  if (!clean.startsWith('#')) clean = '#' + clean;
  // Replace illegal room characters
  clean = clean.replace(/[\s/\\?%*:|"<>]+/g, '_');
  if (clean === '#') clean = '#채널_' + Math.random().toString(36).substring(2, 6);
  return clean;
}

function getChannel(roomId) {
  return channelList.find(c => c.id.toLowerCase() === (roomId || '').toLowerCase());
}

// Get all human users currently present in a room
function getHumanUsersInRoom(roomId) {
  return Array.from(users.values()).filter(u => {
    if (u.isBot) return false;
    if (u.joinedChannels && u.joinedChannels.has(roomId)) return true;
    return u.currentRoom === roomId;
  });
}

// Ensure channel operators consistency when users enter a room
function ensureChannelOperatorsOnJoin(channel, user) {
  if (!channel || !channel.id.startsWith('#')) return;
  if (!Array.isArray(channel.operators)) channel.operators = [];

  // NyaaBot ALWAYS retains operator (@) status in every channel!
  if (!channel.operators.includes(BOT_ID)) {
    channel.operators.unshift(BOT_ID);
    saveChannelsDebounced();
  }

  // Service channels (#자유대화) are permanently guarded by BOT_ID (^냥봇);
  // Human users NEVER receive automatic @ operator status in service channels unless granted by an oper!
  if (channel.isService) {
    return;
  }

  const humanUsersInRoom = getHumanUsersInRoom(channel.id);
  // For user-created custom channels:
  // If this user is the only human user in the room, grant them operator status
  if (humanUsersInRoom.length <= 1) {
    if (!channel.operators.includes(user.userId)) {
      channel.operators.push(user.userId);
      saveChannelsDebounced();
    }
  } else {
    // If multiple humans in the room, check if any human has op
    const hasHumanOp = humanUsersInRoom.some(u => channel.operators.includes(u.userId));
    if (!hasHumanOp) {
      channel.operators.push(user.userId);
      saveChannelsDebounced();
    }
  }
}

// Handle operator transfer or channel auto-deletion when a user leaves a room or disconnects
function handleUserLeavingRoom(roomId, leavingUserId, leavingSocketId) {
  if (!roomId || !roomId.startsWith('#')) return;
  const channel = getChannel(roomId);
  if (!channel) return;
  if (!Array.isArray(channel.operators)) channel.operators = [];

  // 1. Ephemeral Op: When a user leaves, their operator status in this channel is removed!
  if (leavingUserId) {
    channel.operators = channel.operators.filter(id => id !== leavingUserId);
  }
  // Ensure BOT_ID is always present
  if (!channel.operators.includes(BOT_ID)) {
    channel.operators.unshift(BOT_ID);
  }
  saveChannelsDebounced();

  // Service channels are permanently guarded by BOT_ID; do not assign or transfer human operators
  if (channel.isService) {
    return;
  }

  const remainingHumanUsers = Array.from(users.values()).filter(u => {
    if (u.isBot) return false;
    if (u.userId === leavingUserId || u.socketId === leavingSocketId) return false;
    if (u.joinedChannels && u.joinedChannels.has(roomId)) return true;
    return u.currentRoom === roomId;
  });

  // Requirement: "채널에 유저가 0명이면 채널이 자동으로 사라지게해줘."
  // Non-service channels disappear immediately when all human users have left!
  if (remainingHumanUsers.length === 0) {
    if (!channel.isService && channel.createdBy !== 'system') {
      console.log(`[Nyaa Chat] 채널 [${channel.id}] 에 남은 유저가 0명이므로 채널을 자동 삭제합니다.`);
      channelList = channelList.filter(c => c.id.toLowerCase() !== roomId.toLowerCase());
      saveChannelsDebounced();
      broadcastChannelListDebounced();
      return;
    }
  }

  // If human users remain in the channel, ensure at least one human user holds @
  const hasHumanOp = remainingHumanUsers.some(u => channel.operators.includes(u.userId));
  if (!hasHumanOp && remainingHumanUsers.length > 0) {
    const nextOp = remainingHumanUsers[0];
    channel.operators.push(nextOp.userId);
    saveChannelsDebounced();
    const opMsg = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      type: 'system',
      content: `* 방장이 퇴장하여 ${nextOp.nickname}님이 방장(@) 권한을 이어받았습니다.`,
      timestamp: Date.now()
    };
    io.to(roomId).emit('new_message', opMsg);
    io.to(roomId).emit('channel_operators_update', { roomId, operators: channel.operators });
  }

  broadcastChannelListDebounced();
}

// Cleanly handle room switch (cancels typing indicator in previous room)
function leaveCurrentRoom(user, socket, newRoomId) {
  if (!user || !socket) return;
  const oldRoomId = user.currentRoom;
  if (!oldRoomId || oldRoomId === newRoomId) return;

  // Immediately cancel typing indicator in old room
  socket.to(oldRoomId).emit('user_typing', {
    userId: user.userId,
    nickname: user.nickname,
    roomId: oldRoomId,
    isTyping: false
  });
}

// Mascot response generator for server bot (냥봇)
function generateBotResponse(text, senderNick, roomId) {
  const clean = (text || '').toLowerCase();

  if (clean.includes('시간') || clean.includes('몇시') || clean.includes('time') || clean.includes('시각')) {
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `현재 서버 시각은 ${timeStr} 입니다냥! ⏰`;
  }
  if (clean.includes('명령어') || clean.includes('help') || clean.includes('사용법')) {
    return `/help 명령어를 입력하시면 채널 개설, /topic 변경, /op 방장 부여 등 슬래시 명령어 도움말을 확인하실 수 있습니다냥! 📜`;
  }

  // 냥봇 호출 시 귀엽게 "Nyaa~~~" 로 화답
  return 'Nyaa~~~';
}

// WHOIS Format Helpers
function formatKoreanWhoisTime(timestamp) {
  const d = new Date(timestamp);
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dayOfWeek = days[d.getDay()];
  const hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = String(hours % 12 || 12).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 ${dayOfWeek} ${ampm} ${hour12}시 ${min}분 ${sec}초`;
}

function formatIdleTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}초`;
  }
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  parts.push(`${seconds}초`);
  return parts.join(' ');
}

function getWhoisChannelsString(targetUser, requester) {
  if (targetUser.isBot || targetUser.userId === BOT_ID) {
    return '@#자유대화';
  }
  const joined = Array.from(targetUser.joinedChannels || []);
  if (joined.length === 0) return '없음';

  const visibleChannels = [];
  for (const chId of joined) {
    const ch = getChannel(chId);
    if (!ch) continue;

    // Check privacy (+p / +s)
    const isPrivate = ch.modes && (ch.modes.p || ch.modes.s);
    const requesterIsMember = requester?.joinedChannels && requester.joinedChannels.has(chId);
    const requesterIsOper = Boolean(requester?.isServerOper);
    if (isPrivate && !requesterIsMember && !requesterIsOper) {
      continue;
    }

    const isOp = Array.isArray(ch.operators) && ch.operators.includes(targetUser.userId);
    const hasVoice = Boolean(ch.voices && ch.voices.has(targetUser.userId));

    let prefix = '';
    if (isOp) prefix = '@';
    else if (hasVoice) prefix = '+';

    visibleChannels.push(`${prefix}${ch.name}`);
  }

  return visibleChannels.length > 0 ? visibleChannels.join(', ') : '없음';
}

function buildWhoisBox(targetUser, requester) {
  const nick = targetUser.nickname;
  const userId = targetUser.userId;
  const username = (targetUser.isBot || targetUser.userId === BOT_ID) ? 'BOT' : 'WEB';
  const channelsStr = getWhoisChannelsString(targetUser, requester);

  let authLine = '';
  if (targetUser.isServerOper) {
    authLine = ` │  인증유저: ${nick} 님은 nemuru 총괄 운영자로 로그인되었습니다.\n`;
  } else if (targetUser.isAiOper) {
    authLine = ` │  인증유저: ${nick} 님은 AI 협업 운영자(${targetUser.aiOperId || 'aioper'})로 인증되었습니다. 🤖\n`;
  } else if (targetUser.isBot || targetUser.userId === BOT_ID) {
    authLine = ` │  인증유저: ${nick} 님은 공식 봇 서비스로 인증되었습니다.\n`;
  }

  const isBot = Boolean(targetUser.isBot || targetUser.userId === BOT_ID);
  const idleMs = isBot ? 0 : (Date.now() - (targetUser.lastActiveTime || targetUser.connectTime || Date.now()));
  const idleStr = isBot ? '0초 (상시 활동)' : formatIdleTime(idleMs);
  const connectTs = targetUser.connectTime || targetUser.onlineAt || Date.now();
  const connectStr = formatKoreanWhoisTime(connectTs);

  return (
    ` ┌───────────────────────────━━\n` +
    ` │  ${nick} 님의 사용자 정보\n` +
    ` │\n` +
    ` │  연결주소: ${nick}@#${userId}\n` +
    ` │  사용자명: ${username}\n` +
    ` │  입실채널: ${channelsStr}\n` +
    authLine +
    ` │  접속서버: *.tnemu.duckdns.org:3000/ * TNemu\n` +
    ` │  잠수시간: ${idleStr}\n` +
    ` │  접속시간: ${connectStr}\n` +
    ` └───────────────────────────━━`
  );
}

// Security hardening: hide server banner
app.disable('x-powered-by');

// Middleware
app.use(cors());
app.use((req, res, next) => {
  // Allow embedding in iframes from external sites (sidebars, widgets, modals)
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Separated Media & File Upload Module (Disabled by default)
const uploadModule = setupUploadModule(app, {
  enabled: ENABLE_MEDIA_UPLOAD,
  uploadsDir: UPLOADS_DIR
});

// Separated 1:1 Direct Message Module (Disabled by default)
const dmModule = setupDmModule(io, {
  enabled: ENABLE_1ON1_DM
});

// Config API Endpoint
app.get('/api/config', (req, res) => {
  res.json({
    mediaUploadEnabled: ENABLE_MEDIA_UPLOAD,
    dmEnabled: ENABLE_1ON1_DM,
    antiSpam: {
      windowSeconds: 5,
      maxMessages: 10,
      timeoutSeconds: 60,
      maxStrikes: 3
    },
    version: '1.0.0-text-optimized'
  });
});

// SSRF Guard: check if a hostname is private or local/reserved IP
function isPrivateOrReservedIp(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().trim();

  // Localhost aliases & IPv6 loopback
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host === '[::1]') {
    return true;
  }

  // IPv4 range checks
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Regex);
  if (match) {
    const [, o1, o2] = match.map(Number);
    if (o1 === 10) return true; // 10.0.0.0/8
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16
    if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16 (Link-Local & Cloud Metadata)
    if (o1 === 127) return true; // 127.0.0.0/8
    if (o1 === 0) return true; // 0.0.0.0/8
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true; // 100.64.0.0/10
  }

  // Block internal domain suffixes
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.localdomain')) {
    return true;
  }

  return false;
}

// Link Preview Cache & Helper (YouTube, Steam, and Web)
const linkPreviewCache = new Map();

async function getLinkPreview(rawUrl) {
  if (!rawUrl) return null;
  const cleanUrl = rawUrl.replace(/[.,!?:;)]+$/, '');
  if (linkPreviewCache.has(cleanUrl)) {
    return linkPreviewCache.get(cleanUrl);
  }

  // SSRF Validation: Validate URL scheme and block private/local addresses
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (isPrivateOrReservedIp(parsed.hostname)) {
      return null;
    }
  } catch (e) {
    return null;
  }

  let result = null;

  try {
    // 1. YouTube Detection
    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const videoId = ytMatch[1];
      const fallbackThumb = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
        if (oembedRes.ok) {
          const ytData = await oembedRes.json();
          result = {
            url: cleanUrl,
            siteName: 'YouTube',
            siteType: 'youtube',
            title: ytData.title || 'YouTube 동영상',
            description: ytData.author_name ? `게시자: ${ytData.author_name}` : 'YouTube에서 시청하기',
            image: ytData.thumbnail_url || fallbackThumb
          };
        }
      } catch (e) {}

      if (!result) {
        result = {
          url: cleanUrl,
          siteName: 'YouTube',
          siteType: 'youtube',
          title: 'YouTube 동영상',
          description: 'YouTube에서 시청하기',
          image: fallbackThumb
        };
      }
    }

    // 2. Steam Store Game Detection
    if (!result) {
      const steamMatch = cleanUrl.match(/store\.steampowered\.com\/app\/(\d+)/);
      if (steamMatch) {
        const appId = steamMatch[1];
        const fallbackThumb = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
        try {
          const steamApiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=korean`;
          const steamRes = await fetch(steamApiUrl, { signal: AbortSignal.timeout(3000) });
          if (steamRes.ok) {
            const steamData = await steamRes.json();
            if (steamData[appId] && steamData[appId].data) {
              const game = steamData[appId].data;
              const priceText = game.is_free ? '무료 플레이' : (game.price_overview?.final_formatted || '');
              const desc = game.short_description ? game.short_description.replace(/<[^>]*>/g, '').trim() : 'Steam 상점에서 상세 정보 확인하기';
              result = {
                url: cleanUrl,
                siteName: 'Steam',
                siteType: 'steam',
                title: game.name || `Steam 게임 #${appId}`,
                description: [priceText, desc].filter(Boolean).join(' • '),
                image: game.header_image || fallbackThumb
              };
            }
          }
        } catch (e) {}

        if (!result) {
          result = {
            url: cleanUrl,
            siteName: 'Steam',
            siteType: 'steam',
            title: `Steam 게임 (#${appId})`,
            description: 'Steam 상점에서 상세 정보 확인하기',
            image: fallbackThumb
          };
        }
      }
    }

    // 3. Generic OpenGraph Fallback
    if (!result) {
      try {
        const res = await fetch(cleanUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(3000),
          redirect: 'follow'
        });
        if (res.ok) {
          // Verify final redirected URL is not internal
          if (res.url) {
            try {
              const finalHost = new URL(res.url).hostname;
              if (isPrivateOrReservedIp(finalHost)) return null;
            } catch (e) { return null; }
          }
          // Read up to 64KB to avoid memory exhaustion (DoS)
          let html = '';
          if (res.body && typeof res.body.getReader === 'function') {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let bytesRead = 0;
            while (bytesRead < 65536) {
              const { done, value } = await reader.read();
              if (done) break;
              bytesRead += value.length;
              html += decoder.decode(value, { stream: true });
            }
            reader.cancel().catch(() => {});
          } else {
            const rawText = await res.text();
            html = rawText.slice(0, 65536);
          }
          const getMeta = (prop) => {
            const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:)?${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
                      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?${prop}["']`, 'i'));
            return m ? m[1] : null;
          };
          const title = getMeta('title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
          const description = getMeta('description') || '';
          const image = getMeta('image') || '';
          let siteName = getMeta('site_name');
          if (!siteName) {
            try { siteName = new URL(cleanUrl).hostname; } catch (e) { siteName = 'Link'; }
          }

          if (title || image) {
            result = {
              url: cleanUrl,
              siteName,
              siteType: 'general',
              title: title.trim(),
              description: description.trim(),
              image
            };
          }
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error('Link preview error:', err);
  }

  if (result) {
    linkPreviewCache.set(cleanUrl, result);
    if (linkPreviewCache.size > 500) {
      const firstKey = linkPreviewCache.keys().next().value;
      linkPreviewCache.delete(firstKey);
    }
  }

  return result;
}

// Link Preview REST API Endpoint
app.get('/api/link-preview', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'URL is required' });
  const preview = await getLinkPreview(targetUrl);
  if (!preview) return res.status(404).json({ error: 'Preview not available' });
  res.json(preview);
});

// Helper to get 1:1 DM room id deterministically
const dmRoomParticipants = new Map();

function getDmRoomId(userId1, userId2) {
  const u1 = String(userId1 || '');
  const u2 = String(userId2 || '');
  const sorted = [u1, u2].sort();
  const roomId = `dm_${sorted[0]}_${sorted[1]}`;
  dmRoomParticipants.set(roomId, { user1: sorted[0], user2: sorted[1] });
  return roomId;
}

function resolveDmParticipants(roomId, senderUserId) {
  if (!roomId || !roomId.startsWith('dm_')) return null;
  if (dmRoomParticipants.has(roomId)) {
    const { user1, user2 } = dmRoomParticipants.get(roomId);
    const otherUserId = (senderUserId === user1) ? user2 : user1;
    return { user1, user2, otherUserId };
  }
  const raw = roomId.slice(3); // Remove 'dm_'
  if (senderUserId) {
    if (raw.startsWith(senderUserId + '_')) {
      const otherUserId = raw.slice(senderUserId.length + 1);
      dmRoomParticipants.set(roomId, { user1: senderUserId, user2: otherUserId });
      return { user1: senderUserId, user2: otherUserId, otherUserId };
    } else if (raw.endsWith('_' + senderUserId)) {
      const otherUserId = raw.slice(0, raw.length - senderUserId.length - 1);
      dmRoomParticipants.set(roomId, { user1: otherUserId, user2: senderUserId });
      return { user1: otherUserId, user2: senderUserId, otherUserId };
    }
  }
  const allUsers = Array.from(users.values());
  for (const u of allUsers) {
    if (raw.startsWith(u.userId + '_')) {
      const otherUserId = raw.slice(u.userId.length + 1);
      const user1 = u.userId;
      const user2 = otherUserId;
      dmRoomParticipants.set(roomId, { user1, user2 });
      return { user1, user2, otherUserId: (senderUserId === user1) ? user2 : user1 };
    }
  }
  return null;
}

// Helper to get active retention-filtered history for a room
function get24hRoomHistory(roomId) {
  const now = Date.now();
  const cutoff = getRetentionCutoff(now);
  const list = messageHistory[roomId] || [];
  return list.filter((m) => (m.timestamp || now) >= cutoff);
}

// Connection middleware: Reject banned IPs (Permanent and 24-hr Anti-Spam) + Connection Handshake Rate Limiting
io.use((socket, next) => {
  const ip = getClientIp(socket);
  if (bannedIps.has(ip)) {
    console.log(`[Nyaa Chat] Rejected connection from banned IP: ${ip} (${socket.id})`);
    return next(new Error('BANNED_IP'));
  }
  const tempBan = antiSpam.isTempBanned(ip);
  if (tempBan.isBanned) {
    console.log(`[Nyaa Chat] Rejected connection from temp-banned IP: ${ip} (${socket.id})`);
    return next(new Error(`TEMP_BANNED_SPAM:${tempBan.remainingHours}시간`));
  }

  // WebSocket Handshake Connection Rate Limiting (10 connections per 2s, 3 strikes = 24h temp ban)
  const connCheck = antiSpam.checkConnectionRate(ip);
  if (!connCheck.allowed) {
    console.warn(`[Connection Flood] Rejected handshake from ${ip}: ${connCheck.reason}`);
    return next(new Error('RATE_LIMITED_CONNECTION'));
  }

  next();
});

// Track failed operator login attempts per IP for rate limiting and security
const operFailedAttempts = new Map(); // ip -> { count: number, lastAttempt: number }

// Ultra-lightweight Whitelist Peer Directory & Server Extensions Module
const peerDirectory = setupPeerDirectoryModule({
  app,
  io,
  dataDir: DATA_DIR,
  users,
  getChannels: () => channelList,
  isOperChannel,
  getChannelModeString: (ch) => formatModeString(ch && ch.modes),
  BOT_NAME
});

// Lightweight NickServ: Optional Nickname Password Protection
const { NickServ } = require('./modules/nickServ');
const nickServ = new NickServ({ dataDir: DATA_DIR });

function startNickGracePeriod(socket, user) {
  if (!user || user.isNickVerified || !nickServ.isRegistered(user.nickname)) return;
  if (user.nickGraceTimer) clearTimeout(user.nickGraceTimer);

  socket.emit('new_message', {
    id: `sys_${Date.now()}`,
    roomId: user.currentRoom || '#자유대화',
    type: 'system',
    content: `* 🔒 [보호 닉네임 안내] "${user.nickname}"은(는) 비밀번호가 등록된 보호 닉네임입니다.\n* 본인이 맞다면 60초 이내에 /identify <암호> (또는 /nickpass <암호>)를 입력해 주세요.\n* 60초 내 미인증 시 임시 닉네임으로 강제 변경되며, 인증 전에는 채팅 발언이 제한됩니다.`,
    timestamp: Date.now()
  });

  user.nickGraceTimer = setTimeout(() => {
    const u = users.get(socket.id);
    if (u && !u.isNickVerified && nickServ.isRegistered(u.nickname)) {
      forceGuestNickname(socket, u, '인증 시간 초과(60초)');
    }
  }, nickServ.GRACE_PERIOD_MS);
}

function forceGuestNickname(socket, user, reason) {
  if (user.nickGraceTimer) {
    clearTimeout(user.nickGraceTimer);
    user.nickGraceTimer = null;
  }
  const oldNick = user.nickname;
  let guestNick = `게스트_${Math.random().toString(36).substring(2, 6)}`;
  while (Array.from(users.values()).some(u => u.nickname.toLowerCase() === guestNick.toLowerCase())) {
    guestNick = `게스트_${Math.random().toString(36).substring(2, 6)}`;
  }
  user.nickname = guestNick;
  user.isNickVerified = true;

  socket.emit('nickname_changed', { oldNickname: oldNick, newNickname: guestNick });
  socket.broadcast.emit('user_renamed', {
    userId: user.userId,
    oldNickname: oldNick,
    newNickname: guestNick
  });
  broadcastUserListDebounced();

  socket.emit('new_message', {
    id: `sys_${Date.now()}`,
    roomId: user.currentRoom || '#자유대화',
    type: 'system',
    content: `* ⚠️ [보호 닉네임] ${reason}로 인해 임시 닉네임 [${guestNick}]으로 강제 변경되었습니다.\n* (본인 닉네임 복구: /nick ${oldNick} 후 60초 이내 /identify <암호>)`,
    timestamp: Date.now()
  });
}

// Socket.io Real-time Handlers
io.on('connection', (socket) => {
  const socketConnectTime = Date.now();
  const socketIp = getClientIp(socket);
  console.log(`Socket connected: ${socket.id} (IP: ${socketIp})`);

  peerDirectory.registerSocketHandlers(socket);

  // User Join / Register
  socket.on('user_join', (data) => {
    const { userId, nickname, avatar, targetChannel: rawTargetChannel, channelKey, nickpass: rawNickpass } = data;
    const defaultRoom = '#자유대화';
    const rawNick = (nickname || '').trim();
    if (!rawNick) {
      socket.emit('login_error', { message: '사용할 닉네임을 입력해 주세요.' });
      return;
    }

    if (rawNick.length > 16) {
      socket.emit('login_error', { message: '닉네임은 최대 16자까지 설정할 수 있습니다.' });
      return;
    }

    const reqNick = rawNick.slice(0, 16);
    const cleanNick = reqNick.toLowerCase();
    if (cleanNick === BOT_NAME.toLowerCase() || cleanNick === BOT_ID.toLowerCase() || cleanNick === '^냥봇' || cleanNick === 'system' || cleanNick === '관리자') {
      socket.emit('login_error', {
        message: `"${reqNick}"은(는) 시스템 전용 닉네임이므로 사용할 수 없습니다.`
      });
      return;
    }

    let isAiOperDirect = false;
    let aiOperIdDirect = null;
    if (data.aioperId && data.aioperPw) {
      const operId = String(data.aioperId).trim().toLowerCase();
      const operPw = String(data.aioperPw).trim();
      const aiAcc = AIOPER_ACCOUNTS[operId];
      if (aiAcc && secureCompareStrings(aiAcc.pw, operPw)) {
        isAiOperDirect = true;
        aiOperIdDirect = operId;
      }
    }

    if (isAiReservedNickname(reqNick)) {
      const allowedNick = isAiOperDirect && AIOPER_ACCOUNTS[aiOperIdDirect]?.defaultNick;
      if (allowedNick !== reqNick) {
        socket.emit('login_error', {
          message: `"${reqNick}" 닉네임은 공인 AI 전용 닉네임입니다. 일반 사용자는 사용할 수 없습니다.`
        });
        return;
      }
    }

    const clientIp = getClientIp(socket);
    const resolvedUserId = userId || socket.id;

    // NickServ: Registered Nickname Check
    const isRegisteredNick = nickServ.isRegistered(reqNick);
    let isNickVerified = !isRegisteredNick;
    let nickVerifiedNotice = null;

    if (isRegisteredNick) {
      const lockInfo = nickServ.isLockedOut(clientIp, reqNick);
      if (lockInfo.locked) {
        socket.emit('login_error', {
          message: `"${reqNick}" 닉네임은 비밀번호 5회 오류로 인해 ${lockInfo.remainingMinutes}분간 인증이 차단되어 있습니다.`
        });
        return;
      }

      if (rawNickpass) {
        const vRes = nickServ.verifyPassword(clientIp, reqNick, rawNickpass);
        if (vRes.success) {
          isNickVerified = true;
          nickVerifiedNotice = vRes.message;
        } else {
          nickVerifiedNotice = vRes.message;
          if (vRes.shouldKick) {
            socket.emit('login_error', { message: vRes.message });
            socket.disconnect(true);
            return;
          }
        }
      }
    }

    // ID / Nickname Preemption Check:
    // If another active online socket from a DIFFERENT user already uses this nickname (case-insensitive), reject.
    const isNickTakenByOther = Array.from(users.values()).some(
      (u) => u.nickname.toLowerCase() === reqNick.toLowerCase() &&
             u.socketId !== socket.id &&
             u.userId !== resolvedUserId
    );

    if (isNickTakenByOther) {
      socket.emit('login_error', {
        message: `"${reqNick}" 닉네임은 현재 접속 중인 사용자가 이미 선점하고 있습니다. 다른 닉네임을 입력해 주세요.`
      });
      return;
    }

    // Single-Session Policy: Prevent duplicate multi-window/multi-browser logins from the same computer/IP
    const isTestClient = Boolean(
      socket.handshake?.headers?.['x-test-client'] === 'true' ||
      process.env.ALLOW_MULTI_CONNECT === 'true'
    );

    if (!isTestClient) {
      // 1) Same browser session check (same userId)
      const existingUserSession = Array.from(users.values()).find(
        (u) => u.userId === resolvedUserId && u.socketId !== socket.id
      );

      if (existingUserSession) {
        if (existingUserSession.nickname.toLowerCase() === reqNick.toLowerCase()) {
          // Page refresh or reconnect with same nickname: gracefully replace old session
          const oldSocket = io.sockets.sockets.get(existingUserSession.socketId);
          if (oldSocket) {
            oldSocket.emit('login_error', { message: '다른 창 또는 새로고침으로 인해 이전 세션이 종료되었습니다.' });
            oldSocket.disconnect(true);
          }
          users.delete(existingUserSession.socketId);
        } else {
          // Attempting to log in with a 2nd nickname in the same browser
          socket.emit('login_error', {
            message: `이미 현재 브라우저에서 "${existingUserSession.nickname}"(으)로 접속 중입니다.\n내부 로그 충돌 및 오류 방지를 위해 한 브라우저에서는 하나의 닉네임만 이용하실 수 있습니다.`
          });
          return;
        }
      }

      // 2) Same IP Multi-Connection Limit:
      // Allow multiple devices/family/coworkers on the same NAT/Wi-Fi router,
      // but cap to MAX_SESSIONS_PER_IP (default 5) to prevent automated bot flood attacks.
      const MAX_SESSIONS_PER_IP = parseInt(process.env.MAX_SESSIONS_PER_IP || '5', 10);
      const sameIpSessions = Array.from(users.values()).filter(
        (u) => u.clientIp === clientIp && u.socketId !== socket.id
      );

      if (sameIpSessions.length >= MAX_SESSIONS_PER_IP) {
        socket.emit('login_error', {
          message: `동일한 네트워크 환경(IP: ${clientIp})에서 동시 접속 한도(최대 ${MAX_SESSIONS_PER_IP}개)를 초과했습니다.\n시스템 과부하 방지를 위해 추가 접속이 제한됩니다.`
        });
        return;
      }
    }

    recordUserIp(resolvedUserId, clientIp);

    // Resolve target channel (from URL query parameter or external site embedding)
    let initialRoom = defaultRoom;
    if (rawTargetChannel && typeof rawTargetChannel === 'string') {
      let candidate = rawTargetChannel.trim();
      if (candidate.length > 0) {
        candidate = normalizeChannelId(candidate);
        if (candidate.length > 30) candidate = candidate.slice(0, 30);

        // Security: Prevent unauthorized direct entry to oper-only channels
        const isOperTarget = isOperChannelName(candidate) || (getChannel(candidate) && isOperChannel(getChannel(candidate)));
        if (!isOperTarget) {
          initialRoom = candidate;
        }
      }
    }

    let targetCh = getChannel(initialRoom);
    if (!targetCh) {
      // Auto-create the channel on the fly if it does not exist
      targetCh = {
        id: initialRoom,
        name: initialRoom,
        topic: `${initialRoom} 대화방입니다.`,
        icon: '#',
        createdBy: reqNick,
        createdAt: Date.now(),
        isOperOnly: false,
        operators: [BOT_ID, resolvedUserId],
        modes: { i: false, t: true, k: null, l: null, m: false, n: true, p: false, s: false },
        invitedUsers: new Set(),
        voices: new Set()
      };
      channelList.push(targetCh);
      saveChannelsDebounced();
    } else {
      initChannelModes(targetCh);
      // Check channel entry restrictions (+k, +i, +l)
      let canEnter = true;
      if (targetCh.modes && targetCh.modes.k) {
        const providedKey = (channelKey || '').trim();
        if (providedKey !== targetCh.modes.k) {
          canEnter = false;
          socket.emit('channel_key_required', {
            roomId: targetCh.id,
            channelName: targetCh.name,
            error: providedKey ? '채널 비밀번호가 일치하지 않습니다.' : '채널 비밀번호가 필요합니다.'
          });
        }
      }
      if (canEnter && targetCh.modes && targetCh.modes.i) {
        const isInvited = targetCh.invitedUsers && targetCh.invitedUsers.has(resolvedUserId);
        if (!isInvited) {
          canEnter = false;
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: defaultRoom,
            type: 'system',
            content: `* '${targetCh.name}' 채널은 초대 전용(+i) 채널입니다.`,
            timestamp: Date.now()
          });
        }
      }
      if (canEnter && targetCh.modes && targetCh.modes.l) {
        const currentCount = getHumanUsersInRoom(targetCh.id).length;
        if (currentCount >= targetCh.modes.l) {
          canEnter = false;
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: defaultRoom,
            type: 'system',
            content: `* '${targetCh.name}' 채널 정원이 초과되었습니다. (+l)`,
            timestamp: Date.now()
          });
        }
      }

      if (!canEnter) {
        initialRoom = defaultRoom;
        targetCh = getChannel(defaultRoom);
      }
    }

    const user = {
      socketId: socket.id,
      userId: resolvedUserId,
      nickname: reqNick,
      avatar: avatar || '🧑‍💻',
      currentRoom: initialRoom,
      joinedChannels: new Set([initialRoom]),
      onlineAt: Date.now(),
      connectTime: Date.now(),
      lastActiveTime: Date.now(),
      clientIp: clientIp,
      isAiOper: isAiOperDirect,
      aiOperId: aiOperIdDirect,
      isNickVerified: isNickVerified,
      nickGraceTimer: null
    };

    users.set(socket.id, user);

    // Join target channel
    socket.join(initialRoom);

    // Ensure operators for target channel
    if (targetCh) {
      ensureChannelOperatorsOnJoin(targetCh, user);
    }

    // Notify caller with initial state:
    // Server does NOT send past messages (history: []) to clients.
    // Clients only read their own local storage and receive live messages.
    socket.emit('init_state', {
      user,
      channels: getChannelListWithUserCounts(user),
      users: getSerializedUsers(user),
      history: [],
      mediaUploadEnabled: ENABLE_MEDIA_UPLOAD,
      dmEnabled: ENABLE_1ON1_DM,
      serverInfo: peerDirectory.getServerInfo()
    });

    if (isRegisteredNick) {
      if (isNickVerified) {
        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId: initialRoom,
          type: 'system',
          content: nickVerifiedNotice || `* 🔓 [본인 인증] 닉네임 [${user.nickname}]의 비밀번호 인증이 완료되었습니다.`,
          timestamp: Date.now()
        });
      } else {
        if (nickVerifiedNotice) {
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: initialRoom,
            type: 'system',
            content: nickVerifiedNotice,
            timestamp: Date.now()
          });
        }
        startNickGracePeriod(socket, user);
      }
    }

    if (isAiOperDirect) {
      socket.emit('aioper_success', {
        operId: aiOperIdDirect,
        nickname: user.nickname,
        message: `AI 협업 운영자(${aiOperIdDirect}) 권한이 승인되었습니다. (전용 닉네임: ${user.nickname}) 🤖`
      });
    }

    // Broadcast user list update to everyone
    broadcastUserListDebounced();
    broadcastChannelListDebounced();

    // Broadcast join announcement in initial room
    const isOp = targetCh && Array.isArray(targetCh.operators) && targetCh.operators.includes(user.userId);
    const joinMsg = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId: initialRoom,
      type: 'system',
      content: `* ${isOp ? '@' : ''}${user.nickname}님이 ${initialRoom}에 입장하셨습니다.`,
      timestamp: Date.now()
    };
    if (!messageHistory[initialRoom]) messageHistory[initialRoom] = [];
    messageHistory[initialRoom].push(joinMsg);
    io.to(initialRoom).emit('new_message', joinMsg);
  });

  // Switch Room (Group Channel or 1:1 DM)
  socket.on('switch_room', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const { targetType, targetId } = data; // targetType: 'channel' | 'dm'
    let newRoomId = '';
    let roomMeta = {};

    if (targetType === 'channel') {
      newRoomId = normalizeChannelId(targetId);
      let channel = getChannel(newRoomId);

      // Check oper-only channel access
      if (channel && isOperChannel(channel) && !currentUser.isServerOper) {
        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId: currentUser.currentRoom || '#자유대화',
          type: 'system',
          content: `* '${channel.name}' 채널은 관리자 전용 채널입니다. 관리자 로그인(/oper) 후 입장할 수 있습니다. 🔒`,
          timestamp: Date.now()
        });
        return;
      }

      if (channel) {
        initChannelModes(channel);
        const isMember = currentUser.joinedChannels && currentUser.joinedChannels.has(channel.id);
        const isOper = currentUser.isServerOper;
        const isOp = Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId);

        if (!isMember && !isOper) {
          // Check +k (key/password)
          if (channel.modes && channel.modes.k) {
            const providedKey = (data.key || '').trim();
            if (providedKey !== channel.modes.k) {
              socket.emit('channel_key_required', {
                roomId: channel.id,
                channelName: channel.name,
                error: providedKey ? '채널 비밀번호가 일치하지 않습니다.' : '채널 비밀번호가 필요합니다.'
              });
              return;
            }
          }

          // Check +i (invite-only)
          if (channel.modes && channel.modes.i) {
            const isInvited = channel.invitedUsers && channel.invitedUsers.has(currentUser.userId);
            if (!isInvited && !isOp) {
              socket.emit('new_message', {
                id: `sys_${Date.now()}`,
                roomId: currentUser.currentRoom || '#자유대화',
                type: 'system',
                content: `* '${channel.name}' 채널은 초대 전용(+i) 채널입니다. 방장의 초대를 받아야 입장할 수 있습니다. ✉️`,
                timestamp: Date.now()
              });
              return;
            }
          }

          // Check +l (user limit)
          if (channel.modes && channel.modes.l) {
            const currentCount = getHumanUsersInRoom(channel.id).length;
            if (currentCount >= channel.modes.l) {
              socket.emit('new_message', {
                id: `sys_${Date.now()}`,
                roomId: currentUser.currentRoom || '#자유대화',
                type: 'system',
                content: `* '${channel.name}' 채널의 정원(${channel.modes.l}명)이 초과되어 입장할 수 없습니다. (+l)`,
                timestamp: Date.now()
              });
              return;
            }
          }
        }
      }

      if (!channel) {
        const isOperTarget = isOperChannelName(newRoomId);
        if (isOperTarget && !currentUser.isServerOper) {
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: currentUser.currentRoom || '#자유대화',
            type: 'system',
            content: `* '${newRoomId}' 채널은 관리자 전용 채널입니다. 관리자(/oper) 권한이 필요합니다. 🔒`,
            timestamp: Date.now()
          });
          return;
        }

        channel = {
          id: newRoomId,
          name: newRoomId,
          topic: `${newRoomId} 대화방입니다.`,
          icon: isOperTarget ? '⚖️' : '#',
          createdBy: currentUser.nickname,
          createdAt: Date.now(),
          isOperOnly: isOperTarget,
          operators: [BOT_ID, currentUser.userId],
          modes: { i: false, t: true, k: null, l: null, m: false, n: true, p: false, s: false },
          invitedUsers: new Set(),
          voices: new Set()
        };
        channelList.push(channel);
        saveChannelsDebounced();
      }

      // Cleanly leave previous room before entering new channel
      leaveCurrentRoom(currentUser, socket, newRoomId);

      if (!currentUser.joinedChannels) {
        currentUser.joinedChannels = new Set([currentUser.currentRoom || '#자유대화']);
      }
      currentUser.joinedChannels.add(newRoomId);
      currentUser.currentRoom = newRoomId;
      currentUser.lastActiveTime = Date.now();
      socket.join(newRoomId);

      // Ensure operator state for this channel
      ensureChannelOperatorsOnJoin(channel, currentUser);
      broadcastChannelListDebounced();
      broadcastUserListDebounced();

      roomMeta = {
        type: 'channel',
        id: channel.id,
        name: channel.name,
        icon: channel.icon || '#',
        topic: channel.topic || '',
        description: channel.topic || '',
        operators: channel.operators || [],
        voices: Array.from(channel.voices || []),
        modes: formatModeString(channel.modes),
        rawModes: channel.modes,
        hasKey: Boolean(channel.modes && channel.modes.k),
        isService: Boolean(channel.isService),
        isOperOnly: Boolean(channel.isOperOnly || isOperChannel(channel))
      };
    } else if (targetType === 'dm') {
      if (!ENABLE_1ON1_DM) {
        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId: currentUser.currentRoom || '#자유대화',
          type: 'system',
          content: '* 1:1 대화 기능은 서버 정책에 따라 분리/비활성화되어 있습니다.',
          timestamp: Date.now()
        });
        return;
      }
      const partner = Array.from(users.values()).find((u) => u.userId === targetId);
      newRoomId = getDmRoomId(currentUser.userId, targetId);

      // Cleanly leave previous room before entering DM
      leaveCurrentRoom(currentUser, socket, newRoomId);

      currentUser.lastActiveTime = Date.now();
      currentUser.currentRoom = newRoomId;
      socket.join(newRoomId);
      broadcastChannelListDebounced();
      broadcastUserListDebounced();

      roomMeta = {
        type: 'dm',
        id: newRoomId,
        targetUserId: targetId,
        name: partner ? partner.nickname : (data.targetName || '대화 상대'),
        avatar: partner ? partner.avatar : (data.targetAvatar || '👤'),
        isOnline: Boolean(partner),
        operators: []
      };
    }

    // Send room switched. For regular rooms history is empty; for oper channels, send recent history
    const roomHistory = (isOperChannel({ id: newRoomId }) && currentUser.isServerOper)
      ? (messageHistory[newRoomId] || []).slice(-50)
      : [];

    socket.emit('room_switched', {
      roomMeta,
      history: roomHistory
    });
  });

  // Channel Creation / Join
  socket.on('join_channel', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    // Anti-Spam: Join Flood Rate Limiting (5 joins per 2 seconds, 3 strikes = 24h temp ban)
    const clientIp = getClientIp(socket);
    const floodCheck = antiSpam.checkJoinFlood(currentUser, clientIp);
    if (!floodCheck.allowed) {
      console.warn(`[Join Flood] Socket ${socket.id} (${clientIp}, ${currentUser.nickname}) exceeded join rate: ${floodCheck.action} (Strike ${floodCheck.strikeCount}/3)`);
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom || '#자유대화',
        type: 'system',
        content: floodCheck.reason,
        timestamp: Date.now()
      });
      setTimeout(() => {
        try { socket.disconnect(true); } catch (_) {}
      }, 50);
      return;
    }

    const channelName = normalizeChannelId(data.channelName || data.name);
    const topic = (data.topic || `${channelName} 대화방에 오신 것을 환영합니다.`).trim().slice(0, 80);

    let channel = getChannel(channelName);

    // Check oper-only channel access
    if (channel && isOperChannel(channel) && !currentUser.isServerOper) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom || '#자유대화',
        type: 'system',
        content: `* '${channel.name}' 채널은 관리자 전용 채널입니다. 관리자 로그인(/oper) 후 입장할 수 있습니다. 🔒`,
        timestamp: Date.now()
      });
      return;
    }

    if (channel) {
      initChannelModes(channel);
      const isMember = currentUser.joinedChannels && currentUser.joinedChannels.has(channel.id);
      const isOper = currentUser.isServerOper;
      const isOp = Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId);

      if (!isMember && !isOper) {
        // Check +k (key/password)
        if (channel.modes && channel.modes.k) {
          const providedKey = (data.key || '').trim();
          if (providedKey !== channel.modes.k) {
            socket.emit('channel_key_required', {
              roomId: channel.id,
              channelName: channel.name,
              error: providedKey ? '채널 비밀번호가 일치하지 않습니다.' : '채널 비밀번호가 필요합니다.'
            });
            return;
          }
        }

        // Check +i (invite-only)
        if (channel.modes && channel.modes.i) {
          const isInvited = channel.invitedUsers && channel.invitedUsers.has(currentUser.userId);
          if (!isInvited && !isOp) {
            socket.emit('new_message', {
              id: `sys_${Date.now()}`,
              roomId: currentUser.currentRoom || '#자유대화',
              type: 'system',
              content: `* '${channel.name}' 채널은 초대 전용(+i) 채널입니다. 방장의 초대를 받아야 입장할 수 있습니다. ✉️`,
              timestamp: Date.now()
            });
            return;
          }
        }

        // Check +l (user limit)
        if (channel.modes && channel.modes.l) {
          const currentCount = getHumanUsersInRoom(channel.id).length;
          if (currentCount >= channel.modes.l) {
            socket.emit('new_message', {
              id: `sys_${Date.now()}`,
              roomId: currentUser.currentRoom || '#자유대화',
              type: 'system',
              content: `* '${channel.name}' 채널의 정원(${channel.modes.l}명)이 초과되어 입장할 수 없습니다. (+l)`,
              timestamp: Date.now()
            });
            return;
          }
        }
      }
    }

    let isNew = false;
    if (!channel) {
      const isOperTarget = isOperChannelName(channelName);
      if (isOperTarget && !currentUser.isServerOper) {
        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId: currentUser.currentRoom || '#자유대화',
          type: 'system',
          content: `* '${channelName}' 채널은 관리자 전용 채널입니다. 관리자(/oper) 권한이 필요합니다. 🔒`,
          timestamp: Date.now()
        });
        return;
      }

      channel = {
        id: channelName,
        name: channelName,
        topic,
        icon: isOperTarget ? '⚖️' : '#',
        createdBy: currentUser.nickname,
        createdAt: Date.now(),
        isOperOnly: isOperTarget,
        operators: [BOT_ID, currentUser.userId],
        modes: {
          i: Boolean(data.isInviteOnly),
          t: true,
          k: data.key ? String(data.key).trim() : null,
          l: data.limit ? parseInt(data.limit, 10) : null,
          m: Boolean(data.isModerated),
          n: true,
          p: Boolean(data.isPrivate),
          s: Boolean(data.isSecret)
        },
        invitedUsers: new Set(),
        voices: new Set()
      };
      channelList.push(channel);
      saveChannelsDebounced();
      isNew = true;
    }

    // Cleanly leave previous room before entering new channel
    leaveCurrentRoom(currentUser, socket, channel.id);

    if (!currentUser.joinedChannels) {
      currentUser.joinedChannels = new Set([currentUser.currentRoom || '#자유대화']);
    }
    const alreadyJoined = currentUser.joinedChannels.has(channel.id);
    currentUser.joinedChannels.add(channel.id);
    currentUser.currentRoom = channel.id;
    socket.join(channel.id);

    ensureChannelOperatorsOnJoin(channel, currentUser);
    broadcastChannelListDebounced();
    broadcastUserListDebounced();

    const roomMeta = {
      type: 'channel',
      id: channel.id,
      name: channel.name,
      icon: channel.icon || '#',
      topic: channel.topic,
      description: channel.topic,
      operators: channel.operators || [],
      voices: Array.from(channel.voices || []),
      modes: formatModeString(channel.modes),
      rawModes: channel.modes,
      hasKey: Boolean(channel.modes && channel.modes.k),
      isService: Boolean(channel.isService),
      isOperOnly: Boolean(channel.isOperOnly || isOperChannel(channel))
    };

    const joinHistory = (isOperChannel(channel) && currentUser.isServerOper)
      ? (messageHistory[channel.id] || []).slice(-50)
      : [];

    socket.emit('room_switched', {
      roomMeta,
      history: joinHistory
    });

    if (!alreadyJoined) {
      const isOp = Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId);
      const joinNotice = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId: channel.id,
        type: 'system',
        content: `* ${isOp ? '@' : ''}${currentUser.nickname}님이 ${channel.id}에 입장하셨습니다.${isNew ? ' (새 채널 개설 / 방장)' : ''}`,
        timestamp: Date.now()
      };
      if (!messageHistory[channel.id]) messageHistory[channel.id] = [];
      messageHistory[channel.id].push(joinNotice);
      io.to(channel.id).emit('new_message', joinNotice);
      saveMessagesDebounced();
    }
  });

  // Channel Topic & Settings Edit (/topic)
  socket.on('set_topic', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const { channelId, topic, modeSettings } = data;
    const channel = getChannel(channelId);
    if (!channel) return;
    initChannelModes(channel);

    // Check operator status:
    // If channel.modes.t is true, only operators (or server oper) can set topic
    const requiresOp = channel.modes ? channel.modes.t : true;
    const hasOp = Array.isArray(channel.operators) && channel.operators.length > 0;
    const isOp = (Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId)) || currentUser.isServerOper;
    if (requiresOp && hasOp && !isOp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: channelId,
        type: 'system',
        content: `* 채널 주제(Topic)는 방장(@) 권한이 있는 사용자만 변경할 수 있습니다. (+t 모드)`,
        timestamp: Date.now()
      });
      return;
    }

    if (topic !== undefined) {
      channel.topic = (topic || '').trim().slice(0, 80);
    }

    // If operator provided mode settings via modal:
    if (isOp && modeSettings) {
      if (modeSettings.isPrivate !== undefined) channel.modes.p = Boolean(modeSettings.isPrivate);
      if (modeSettings.isSecret !== undefined) channel.modes.s = Boolean(modeSettings.isSecret);
      if (modeSettings.isInviteOnly !== undefined) channel.modes.i = Boolean(modeSettings.isInviteOnly);
      if (modeSettings.isModerated !== undefined) channel.modes.m = Boolean(modeSettings.isModerated);
      if (modeSettings.isTopicProtected !== undefined) channel.modes.t = Boolean(modeSettings.isTopicProtected);
      if (modeSettings.key !== undefined) channel.modes.k = modeSettings.key ? String(modeSettings.key).trim() : null;
      if (modeSettings.limit !== undefined) channel.modes.l = modeSettings.limit ? parseInt(modeSettings.limit, 10) : null;
    }

    saveChannelsDebounced();
    broadcastChannelListDebounced();

    const topicMsg = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId: channelId,
      type: 'system',
      content: `* @${currentUser.nickname}님이 채널 주제(Topic)를 변경했습니다: "${channel.topic}" [모드: ${formatModeString(channel.modes)}]`,
      timestamp: Date.now()
    };
    if (!messageHistory[channelId]) messageHistory[channelId] = [];
    messageHistory[channelId].push(topicMsg);

    io.to(channelId).emit('topic_updated', {
      roomId: channelId,
      topic: channel.topic,
      changedBy: currentUser.nickname,
      modes: formatModeString(channel.modes),
      rawModes: channel.modes
    });
    io.to(channelId).emit('new_message', topicMsg);
    saveMessagesDebounced();
  });

  // Channel Mode Command (/mode)
  socket.on('set_channel_mode', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const { roomId, modeStr, params } = data;
    if (!roomId || !roomId.startsWith('#')) return;
    const channel = getChannel(roomId);
    if (!channel) return;
    initChannelModes(channel);

    // If no mode string provided, just query current modes
    if (!modeStr || !modeStr.trim()) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* ${channel.name} 채널의 현재 모드: ${formatModeString(channel.modes)} (키: ${channel.modes.k ? '설정됨' : '없음'}, 정원: ${channel.modes.l ? channel.modes.l + '명' : '무제한'})`,
        timestamp: Date.now()
      });
      return;
    }

    const isOp = (Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId)) || currentUser.isServerOper;
    if (!isOp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 채널 모드 변경은 방장(@) 또는 서버 운영자만 가능합니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const parsed = parseModeString(modeStr, params);
    const changes = [];

    for (const { action, flag, arg } of parsed) {
      const isAdd = action === '+';
      switch (flag) {
        case 'i':
          channel.modes.i = isAdd;
          changes.push(`${action}i (초대 전용 ${isAdd ? '설정' : '해제'})`);
          break;
        case 't':
          channel.modes.t = isAdd;
          changes.push(`${action}t (방장 토픽 보호 ${isAdd ? '설정' : '해제'})`);
          break;
        case 'm':
          channel.modes.m = isAdd;
          changes.push(`${action}m (발언권 제한 ${isAdd ? '설정' : '해제'})`);
          break;
        case 'n':
          channel.modes.n = isAdd;
          changes.push(`${action}n (외부 메시지 차단 ${isAdd ? '설정' : '해제'})`);
          break;
        case 'p':
          channel.modes.p = isAdd;
          changes.push(`${action}p (비공개 ${isAdd ? '설정' : '해제'})`);
          break;
        case 's':
          channel.modes.s = isAdd;
          changes.push(`${action}s (비밀 모드 ${isAdd ? '설정' : '해제'})`);
          break;
        case 'k':
          if (isAdd) {
            if (arg) {
              channel.modes.k = String(arg).trim();
              changes.push(`+k [암호 설정됨]`);
            }
          } else {
            channel.modes.k = null;
            changes.push(`-k (채널 암호 해제)`);
          }
          break;
        case 'l':
          if (isAdd) {
            const lim = parseInt(arg, 10);
            if (lim > 0) {
              channel.modes.l = lim;
              changes.push(`+l (인원 제한: ${lim}명)`);
            }
          } else {
            channel.modes.l = null;
            changes.push(`-l (인원 제한 해제)`);
          }
          break;
        case 'o':
          if (arg) {
            const targetUser = Array.from(users.values()).find(u => u.nickname.toLowerCase() === arg.toLowerCase());
            if (targetUser) {
              if (isAdd) {
                if (!channel.operators.includes(targetUser.userId)) {
                  channel.operators.push(targetUser.userId);
                  changes.push(`+o (${targetUser.nickname}님에게 방장 부여)`);
                }
              } else {
                if (targetUser.userId !== BOT_ID) {
                  channel.operators = channel.operators.filter(id => id !== targetUser.userId);
                  changes.push(`-o (${targetUser.nickname}님의 방장 회수)`);
                }
              }
            }
          }
          break;
        case 'v':
          if (arg) {
            const targetUser = Array.from(users.values()).find(u => u.nickname.toLowerCase() === arg.toLowerCase());
            if (targetUser) {
              if (isAdd) {
                channel.voices.add(targetUser.userId);
                changes.push(`+v (${targetUser.nickname}님에게 발언권 부여)`);
              } else {
                channel.voices.delete(targetUser.userId);
                changes.push(`-v (${targetUser.nickname}님의 발언권 회수)`);
              }
            }
          }
          break;
      }
    }

    if (changes.length > 0) {
      saveChannelsDebounced();
      broadcastChannelListDebounced();

      const modeNotice = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId,
        type: 'system',
        content: `* @${currentUser.nickname}님이 채널 모드를 변경했습니다: ${changes.join(', ')} [현재 모드: ${formatModeString(channel.modes)}]`,
        timestamp: Date.now()
      };
      if (!messageHistory[roomId]) messageHistory[roomId] = [];
      messageHistory[roomId].push(modeNotice);
      io.to(roomId).emit('new_message', modeNotice);
      io.to(roomId).emit('channel_operators_update', { roomId, operators: channel.operators });
      saveMessagesDebounced();
    }
  });

  // Invite User to Channel (/invite <nickname> [#channel])
  socket.on('invite_user', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;
    const { targetNickname, roomId } = data;
    const targetRoom = roomId || currentUser.currentRoom;
    if (!targetRoom || !targetRoom.startsWith('#')) return;
    const channel = getChannel(targetRoom);
    if (!channel) return;
    initChannelModes(channel);

    const isOp = (Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId)) || currentUser.isServerOper;
    if (!isOp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: targetRoom,
        type: 'system',
        content: `* 유저 초대는 방장(@) 또는 서버 운영자만 가능합니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const cleanNick = (targetNickname || '').trim().toLowerCase();
    const targetUser = Array.from(users.values()).find(u => u.nickname.toLowerCase() === cleanNick);
    if (!targetUser) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: targetRoom,
        type: 'system',
        content: `* 현재 접속 중인 "${targetNickname}" 유저를 찾을 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    channel.invitedUsers.add(targetUser.userId);
    saveChannelsDebounced();

    socket.emit('new_message', {
      id: `sys_${Date.now()}`,
      roomId: targetRoom,
      type: 'system',
      content: `* ${targetUser.nickname}님을 ${channel.name} 채널에 초대했습니다.`,
      timestamp: Date.now()
    });

    const targetSocket = io.sockets.sockets.get(targetUser.socketId);
    if (targetSocket) {
      targetSocket.emit('invited_to_channel', {
        roomId: channel.id,
        channelName: channel.name,
        invitedBy: currentUser.nickname
      });
      targetSocket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: targetUser.currentRoom || '#자유대화',
        type: 'system',
        content: `* ✉️ @${currentUser.nickname}님이 귀하를 ${channel.name} 채널로 초대했습니다! (/join ${channel.name} 으로 입장 가능)`,
        timestamp: Date.now()
      });
    }
  });

  // Get Server Channels for /list command (supports optional search keyword)
  socket.on('get_server_channels', (data) => {
    const currentUser = users.get(socket.id);
    const keyword = (typeof data === 'string') ? data : (data?.keyword || '');
    socket.emit('server_channels_result', getServerChannelList(currentUser, keyword));
  });

  // Client Ping / Pong RTT Measurement
  socket.on('client_ping', (data) => {
    socket.emit('server_pong', data);
  });

  // WHOIS User Information Query
  socket.on('whois', (data) => {
    const requester = users.get(socket.id);
    if (!requester) return;

    requester.lastActiveTime = Date.now();

    const targetQuery = (typeof data === 'string' ? data : (data?.target || data?.nickname || data?.userId || '')).trim();
    if (!targetQuery) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: requester.currentRoom || '#자유대화',
        type: 'system',
        content: '* 사용법: /whois <닉네임> (또는 우측 접속자 목록 클릭)',
        timestamp: Date.now()
      });
      return;
    }

    let targetUser = null;
    for (const u of users.values()) {
      if (u.nickname?.toLowerCase() === targetQuery.toLowerCase() || u.userId === targetQuery) {
        targetUser = u;
        break;
      }
    }

    if (!targetUser && (targetQuery === '냥봇' || targetQuery === BOT_ID || targetQuery.toLowerCase() === 'bot')) {
      targetUser = {
        userId: BOT_ID,
        nickname: '냥봇',
        isBot: true,
        isServerOper: false,
        connectTime: serverStartTime,
        lastActiveTime: Date.now(),
        joinedChannels: new Set(['#자유대화'])
      };
    }

    if (!targetUser) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: requester.currentRoom || '#자유대화',
        type: 'system',
        content: `* [WHOIS] '${targetQuery}' 사용자를 찾을 수 없습니다. (오프라인이거나 존재하지 않는 사용자)`,
        timestamp: Date.now()
      });
      return;
    }

    const formattedBox = buildWhoisBox(targetUser, requester);

    socket.emit('whois_result', {
      target: targetUser.nickname,
      targetUserId: targetUser.userId,
      formattedText: formattedBox,
      roomId: requester.currentRoom || '#자유대화'
    });
  });

  // Grant Channel Operator (/op <nickname>)
  socket.on('grant_op', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const { roomId, targetNickname } = data;
    if (!roomId || !roomId.startsWith('#')) return;
    const channel = getChannel(roomId);
    if (!channel) return;
    if (channel.isService && !currentUser.isServerOper) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 서비스 채널(${channel.name})은 서버 운영자만 방장(@) 권한을 부여할 수 있습니다.`,
        timestamp: Date.now()
      });
      return;
    }
    if (!Array.isArray(channel.operators)) channel.operators = [];

    const isCurrentOp = (channel.operators.includes(currentUser.userId)) || currentUser.isServerOper;
    if (!isCurrentOp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 방장(@) 권한 또는 서버 운영자만 다른 사용자에게 방장 권한을 부여할 수 있습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const cleanTarget = (targetNickname || '').trim().toLowerCase();
    const targetUser = Array.from(users.values()).find(
      (u) => (u.joinedChannels ? u.joinedChannels.has(roomId) : u.currentRoom === roomId) && u.nickname.toLowerCase() === cleanTarget
    );

    if (!targetUser) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 현재 방에 입장 중인 "${targetNickname}" 사용자를 찾을 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    if (!channel.operators.includes(targetUser.userId)) {
      channel.operators.push(targetUser.userId);
      if (!channel.operators.includes(BOT_ID)) channel.operators.unshift(BOT_ID);
      saveChannelsDebounced();

      const notice = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId,
        type: 'system',
        content: `* @${currentUser.nickname}님이 ${targetUser.nickname}님에게 방장(@) 권한을 부여했습니다.`,
        timestamp: Date.now()
      };
      if (!messageHistory[roomId]) messageHistory[roomId] = [];
      messageHistory[roomId].push(notice);
      io.to(roomId).emit('new_message', notice);
      io.to(roomId).emit('channel_operators_update', { roomId, operators: channel.operators });
      broadcastChannelListDebounced();
      saveMessagesDebounced();
    } else {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* ${targetUser.nickname}님은 이미 방장(@) 권한을 가지고 있습니다.`,
        timestamp: Date.now()
      });
    }
  });

  // Revoke Channel Operator (/deop <nickname>)
  socket.on('revoke_op', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const { roomId, targetNickname } = data;
    if (!roomId || !roomId.startsWith('#')) return;
    const channel = getChannel(roomId);
    if (!channel) return;
    if (!Array.isArray(channel.operators)) channel.operators = [];

    const isCurrentOp = (channel.operators.includes(currentUser.userId)) || currentUser.isServerOper;
    if (!isCurrentOp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 방장(@) 권한 또는 서버 운영자만 방장 권한을 해제할 수 있습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const cleanTarget = (targetNickname || '').trim().toLowerCase();
    if (cleanTarget === BOT_NAME.toLowerCase() || cleanTarget === BOT_ID.toLowerCase() || cleanTarget === '^냥봇') {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 서버 지킴이 냥봇의 방장(@) 권한은 해제할 수 없습니다냥! 🐾`,
        timestamp: Date.now()
      });
      return;
    }

    const targetUser = Array.from(users.values()).find(
      (u) => (u.joinedChannels ? u.joinedChannels.has(roomId) : u.currentRoom === roomId) && u.nickname.toLowerCase() === cleanTarget
    );

    if (!targetUser) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 현재 방에 입장 중인 "${targetNickname}" 사용자를 찾을 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    channel.operators = channel.operators.filter((id) => id !== targetUser.userId);
    if (!channel.operators.includes(BOT_ID)) channel.operators.unshift(BOT_ID);
    saveChannelsDebounced();

    const notice = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      type: 'system',
      content: `* @${currentUser.nickname}님이 @${targetUser.nickname}님의 방장 권한을 해제했습니다.`,
      timestamp: Date.now()
    };
    if (!messageHistory[roomId]) messageHistory[roomId] = [];
    messageHistory[roomId].push(notice);
    io.to(roomId).emit('new_message', notice);
    io.to(roomId).emit('channel_operators_update', { roomId, operators: channel.operators });
    broadcastChannelListDebounced();
    saveMessagesDebounced();
  });

  // Nickname Change with Online Preemption (/nick)
  socket.on('change_nickname', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const oldNick = currentUser.nickname;
    const rawNewNick = (data.newNickname || '').trim();

    if (!rawNewNick) {
      socket.emit('nickname_error', {
        message: '변경할 닉네임을 입력해 주세요. (사용법: /nick <새로운닉네임>)'
      });
      return;
    }

    if (rawNewNick.length > 16) {
      socket.emit('nickname_error', {
        message: '닉네임은 최대 16자까지 설정할 수 있습니다.'
      });
      return;
    }

    const newNick = rawNewNick.slice(0, 16);

    if (newNick.toLowerCase() === oldNick.toLowerCase()) {
      socket.emit('nickname_error', {
        message: `현재 닉네임("${oldNick}")과 동일합니다.`
      });
      return;
    }

    const cleanNick = newNick.toLowerCase();
    if (cleanNick === BOT_NAME.toLowerCase() || cleanNick === BOT_ID.toLowerCase() || cleanNick === '^냥봇' || cleanNick === 'system' || cleanNick === '관리자') {
      socket.emit('nickname_error', {
        message: `"${newNick}"은(는) 시스템 전용 닉네임이므로 사용할 수 없습니다.`
      });
      return;
    }

    if (isAiReservedNickname(newNick)) {
      const allowedNick = currentUser.isAiOper && AIOPER_ACCOUNTS[currentUser.aiOperId]?.defaultNick;
      if (allowedNick !== newNick) {
        socket.emit('nickname_error', {
          message: `"${newNick}" 닉네임은 공인 AI 전용 닉네임입니다. 일반 사용자는 변경할 수 없습니다.`
        });
        return;
      }
    }

    // Check preemption: is this new nickname taken by an online user?
    const isNickTaken = Array.from(users.values()).some(
      (u) => u.nickname.toLowerCase() === cleanNick && u.socketId !== socket.id && u.userId !== currentUser.userId
    );

    if (isNickTaken) {
      socket.emit('nickname_error', {
        message: `"${newNick}" 닉네임은 현재 접속 중인 다른 사용자가 이미 사용하고 있습니다.`
      });
      return;
    }

    const isNewNickRegistered = nickServ.isRegistered(newNick);
    if (isNewNickRegistered) {
      const clientIp = getClientIp(socket);
      const lockInfo = nickServ.isLockedOut(clientIp, newNick);
      if (lockInfo.locked) {
        socket.emit('nickname_error', {
          message: `"${newNick}" 닉네임은 비밀번호 5회 오류로 인해 ${lockInfo.remainingMinutes}분간 인증이 차단되어 있습니다.`
        });
        return;
      }
    }

    currentUser.nickname = newNick;
    if (currentUser.nickGraceTimer) {
      clearTimeout(currentUser.nickGraceTimer);
      currentUser.nickGraceTimer = null;
    }

    if (isNewNickRegistered) {
      currentUser.isNickVerified = false;
      startNickGracePeriod(socket, currentUser);
    } else {
      currentUser.isNickVerified = true;
    }

    broadcastUserListDebounced();
    socket.emit('nickname_changed', { oldNickname: oldNick, nickname: newNick });

    // Announce in current room
    if (currentUser.currentRoom) {
      const channel = getChannel(currentUser.currentRoom);
      const isOp = channel && Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId);
      const nickMsg = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId: currentUser.currentRoom,
        type: 'system',
        content: `* ${oldNick} 님이 ${isOp ? '@' : ''}${newNick}(으)로 닉네임을 변경하셨습니다.`,
        timestamp: Date.now()
      };
      if (!messageHistory[currentUser.currentRoom]) messageHistory[currentUser.currentRoom] = [];
      messageHistory[currentUser.currentRoom].push(nickMsg);
      io.to(currentUser.currentRoom).emit('new_message', nickMsg);
      saveMessagesDebounced();
    }
  });

  // Part Channel (/part)
  socket.on('part_channel', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const targetRoom = data.channelId || currentUser.currentRoom;
    if (targetRoom && targetRoom !== '#자유대화') {
      socket.to(targetRoom).emit('user_typing', {
        userId: currentUser.userId,
        nickname: currentUser.nickname,
        roomId: targetRoom,
        isTyping: false
      });

      const channel = getChannel(targetRoom);
      const isOp = channel && Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId);
      const partMsg = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId: targetRoom,
        type: 'system',
        content: `* ${isOp ? '@' : ''}${currentUser.nickname}님이 ${targetRoom}에서 퇴장하셨습니다.`,
        timestamp: Date.now()
      };
      if (!messageHistory[targetRoom]) messageHistory[targetRoom] = [];
      messageHistory[targetRoom].push(partMsg);
      io.to(targetRoom).emit('new_message', partMsg);
      saveMessagesDebounced();

      if (currentUser.joinedChannels) {
        currentUser.joinedChannels.delete(targetRoom);
      }
      socket.leave(targetRoom);
      handleUserLeavingRoom(targetRoom, currentUser.userId, socket.id);

      if (currentUser.currentRoom === targetRoom) {
        currentUser.currentRoom = '#자유대화';
        socket.join('#자유대화');
        if (currentUser.joinedChannels) {
          currentUser.joinedChannels.add('#자유대화');
        }

        const defaultCh = getChannel('#자유대화') || { id: '#자유대화', name: '#자유대화', topic: '', operators: [] };
        ensureChannelOperatorsOnJoin(defaultCh, currentUser);

        socket.emit('room_switched', {
          roomMeta: {
            type: 'channel',
            id: defaultCh.id,
            name: defaultCh.name,
            icon: '#',
            topic: defaultCh.topic,
            operators: defaultCh.operators || [],
            isService: true
          },
          history: []
        });
      }

      broadcastChannelListDebounced();
      broadcastUserListDebounced();
    }
  });

  // Server Operator Login (/oper <operId> <operPw>)
  socket.on('oper_login', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    const clientIp = getClientIp(socket);
    const operId = (data.operId || data.username || data.id || '').trim();
    const operPw = (data.operPw || data.password || data.pw || '').trim();

    if (secureCompareStrings(operId, expectedOperId) && secureCompareStrings(operPw, expectedOperPw)) {
      operFailedAttempts.delete(clientIp);
      user.isServerOper = true;
      socket.emit('oper_success', { message: '서버 총괄 운영자(Server Operator) 권한이 승인되었습니다. 👑' });
      // Immediately push updated channel list to the oper
      socket.emit('channel_list_update', getChannelListWithUserCounts(user));
      broadcastChannelListDebounced();

      const opAnnounce = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId: user.currentRoom || '#자유대화',
        type: 'system',
        content: `* [시스템] ${user.nickname}님이 서버 총괄 운영자(nemuru)로 인증되었습니다. 👑`,
        timestamp: Date.now()
      };
      socket.emit('new_message', opAnnounce);
      broadcastUserListDebounced();
    } else {
      const record = operFailedAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
      record.count += 1;
      record.lastAttempt = Date.now();
      operFailedAttempts.set(clientIp, record);

      if (record.count >= 10 && record.count % 10 === 0) {
        console.warn(`[Security Alert] IP ${clientIp} (nick: ${user.nickname}) oper login failed ${record.count} times.`);
      }

      socket.emit('oper_failed', { message: '운영자 인증에 실패했습니다. (아이디 또는 비밀번호 불일치)' });
    }
  });

  // AI Operator Login (/aioper <operId> <operPw>)
  socket.on('aioper_login', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    const operId = (data.operId || data.username || data.id || '').trim().toLowerCase();
    const operPw = (data.operPw || data.password || data.pw || '').trim();

    const account = AIOPER_ACCOUNTS[operId];
    if (account && secureCompareStrings(account.pw, operPw)) {
      user.isAiOper = true;
      user.aiOperId = operId;
      const oldNick = user.nickname;
      if (account.defaultNick && user.nickname !== account.defaultNick) {
        user.nickname = account.defaultNick;
        socket.emit('nickname_changed', { oldNickname: oldNick, nickname: account.defaultNick });
      }

      socket.emit('aioper_success', {
        operId,
        nickname: user.nickname,
        message: `AI 협업 운영자(${operId}) 권한이 승인되었습니다. (전용 닉네임: ${user.nickname}) 🤖`
      });

      const aiAnnounce = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId: user.currentRoom || '#ai-collab',
        type: 'system',
        content: `* [시스템] ${oldNick !== user.nickname ? `${oldNick} 님이 ` : ''}${user.nickname}님이 AI 협업 운영자(/aioper ${operId})로 인증되었습니다. 🤖`,
        timestamp: Date.now()
      };
      socket.emit('new_message', aiAnnounce);
      socket.emit('channel_list_update', getChannelListWithUserCounts(user));
      broadcastChannelListDebounced();
      broadcastUserListDebounced();
    } else {
      socket.emit('aioper_failed', { message: 'AI 운영자 인증에 실패했습니다. (아이디 또는 비밀번호 불일치)' });
    }
  });

  // Client requests channel list refresh (e.g. after oper login)
  socket.on('get_channel_list', () => {
    const user = users.get(socket.id);
    socket.emit('channel_list_update', getChannelListWithUserCounts(user));
  });

  // Channel Kick User (/kick <nickname> [reason])
  socket.on('kick_user', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const { roomId, targetNickname, reason } = data;
    if (!roomId || !roomId.startsWith('#')) return;
    const channel = getChannel(roomId);
    if (!channel) return;

    const isCurrentOp = (Array.isArray(channel.operators) && channel.operators.includes(currentUser.userId)) || currentUser.isServerOper;
    if (!isCurrentOp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 채널 방장(@) 권한 또는 서버 운영자만 /kick 명령어를 사용할 수 있습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const cleanTarget = (targetNickname || '').trim().toLowerCase();
    if (cleanTarget === BOT_NAME.toLowerCase() || cleanTarget === BOT_ID.toLowerCase() || cleanTarget === '^냥봇') {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 서버 지킴이 냥봇은 채널에서 강퇴할 수 없습니다냥! 🐾`,
        timestamp: Date.now()
      });
      return;
    }

    const targetUser = Array.from(users.values()).find(
      (u) => (u.joinedChannels ? u.joinedChannels.has(roomId) : u.currentRoom === roomId) && u.nickname.toLowerCase() === cleanTarget
    );

    if (!targetUser) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId,
        type: 'system',
        content: `* 현재 채널에 참가 중인 "${targetNickname}" 사용자를 찾을 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const kickReason = (reason || '채널 방장에 의해 추방되었습니다.').trim();

    // 1. Remove from channel.operators
    if (channel.operators) {
      channel.operators = channel.operators.filter(id => id !== targetUser.userId);
      if (!channel.operators.includes(BOT_ID)) channel.operators.unshift(BOT_ID);
      saveChannelsDebounced();
    }

    // 2. Remove from joinedChannels and leave socket room
    if (targetUser.joinedChannels) {
      targetUser.joinedChannels.delete(roomId);
    }
    const targetSocket = io.sockets.sockets.get(targetUser.socketId);
    if (targetSocket) {
      targetSocket.leave(roomId);
      // If target was viewing this room, redirect them to #자유대화
      if (targetUser.currentRoom === roomId) {
        targetUser.currentRoom = '#자유대화';
        targetSocket.join('#자유대화');
        if (targetUser.joinedChannels) targetUser.joinedChannels.add('#자유대화');
        const defaultCh = getChannel('#자유대화') || { id: '#자유대화', name: '#자유대화', topic: '', operators: [BOT_ID] };
        ensureChannelOperatorsOnJoin(defaultCh, targetUser);
        targetSocket.emit('room_switched', {
          roomMeta: {
            type: 'channel',
            id: defaultCh.id,
            name: defaultCh.name,
            icon: '#',
            topic: defaultCh.topic,
            operators: defaultCh.operators || [BOT_ID],
            isService: true
          },
          history: []
        });
      }
      targetSocket.emit('kicked_from_channel', {
        roomId,
        channelName: channel.name,
        kickedBy: currentUser.nickname,
        reason: kickReason
      });
    }

    // 3. Announce in room
    const kickMsg = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      type: 'system',
      content: `* @${currentUser.nickname}님이 ${targetUser.nickname}님을 채널에서 강퇴(kick)하셨습니다. (사유: ${kickReason})`,
      timestamp: Date.now()
    };
    if (!messageHistory[roomId]) messageHistory[roomId] = [];
    messageHistory[roomId].push(kickMsg);
    io.to(roomId).emit('new_message', kickMsg);
    saveMessagesDebounced();

    handleUserLeavingRoom(roomId, targetUser.userId, targetUser.socketId);
    broadcastUserListDebounced();
    broadcastChannelListDebounced();
  });

  // Server Operator Ban User (/ban <nickname> [reason])
  socket.on('ban_user', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser || !currentUser.isServerOper) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser ? currentUser.currentRoom : '#자유대화',
        type: 'system',
        content: `* 서버 운영자(Operator) 권한이 필요합니다. (/oper 로그인 필요)`,
        timestamp: Date.now()
      });
      return;
    }

    const { targetNickname, reason } = data;
    const cleanTarget = (targetNickname || '').trim().toLowerCase();
    if (cleanTarget === BOT_NAME.toLowerCase() || cleanTarget === BOT_ID.toLowerCase() || cleanTarget === '^냥봇') {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom,
        type: 'system',
        content: `* 서버 지킴이 냥봇은 차단(BAN)할 수 없습니다냥! 🐾`,
        timestamp: Date.now()
      });
      return;
    }

    const targetUser = Array.from(users.values()).find(
      (u) => u.nickname.toLowerCase() === cleanTarget && !u.isBot
    );

    if (!targetUser) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom,
        type: 'system',
        content: `* 현재 접속 중인 "${targetNickname}" 사용자를 찾을 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    if (targetUser.socketId === socket.id) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom,
        type: 'system',
        content: `* 자기 자신을 차단(BAN)할 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetUser.socketId);
    const targetIp = getClientIp(targetSocket);
    if (!targetIp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom,
        type: 'system',
        content: `* 대상 사용자의 IP를 확인할 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    if (targetIp === '127.0.0.1' || targetIp === '::1' || targetIp === 'localhost') {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom,
        type: 'system',
        content: `* 로컬 루프백 IP(${targetIp})는 서버 안전을 위해 차단할 수 없습니다.`,
        timestamp: Date.now()
      });
      return;
    }

    const banReason = (reason || '서버 운영 정책 위반으로 영구 차단되었습니다.').trim();

    bannedIps.add(targetIp);
    bannedIpMeta.set(targetIp, {
      ip: targetIp,
      nickname: targetUser.nickname,
      userId: targetUser.userId,
      reason: banReason,
      bannedBy: currentUser.nickname,
      bannedAt: Date.now()
    });
    saveBannedIps();

    console.log(`[Nyaa Chat] IP Banned: ${targetIp} (User: ${targetUser.nickname}) by Oper: ${currentUser.nickname}`);

    const banNotice = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId: currentUser.currentRoom,
      type: 'system',
      content: `* 🚨 [서버 공지] 운영자 @${currentUser.nickname}님이 ${targetUser.nickname} 사용자를 서버에서 영구 차단(IP BAN: ${targetIp})하셨습니다. (사유: ${banReason})`,
      timestamp: Date.now()
    };
    io.emit('new_message', banNotice);

    // Disconnect target and any socket from this IP
    for (const [sId, s] of io.sockets.sockets) {
      const sIp = getClientIp(s);
      if (sIp === targetIp) {
        s.emit('banned', { reason: banReason, ip: targetIp });
        s.disconnect(true);
      }
    }
  });

  // Server Operator Unban (/unban <ip 또는 닉네임>)
  socket.on('unban_ip', (data) => {
    const currentUser = users.get(socket.id);
    if (!currentUser || !currentUser.isServerOper) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser ? currentUser.currentRoom : '#자유대화',
        type: 'system',
        content: '* /unban 명령어는 서버 관리자(Operator) 전용입니다.',
        timestamp: Date.now()
      });
      return;
    }
    const targetInput = (data.targetIp || data.target || '').trim();
    if (!targetInput) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom || '#자유대화',
        type: 'system',
        content: '* 사용법: /unban <IP주소 또는 닉네임>',
        timestamp: Date.now()
      });
      return;
    }

    let targetIp = null;
    let targetNickname = null;

    // Check if input is directly an IP
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(targetInput) || targetInput.includes(':');

    if (isIp) {
      targetIp = targetInput;
      const meta = bannedIpMeta.get(targetIp);
      if (meta && meta.nickname) targetNickname = meta.nickname;
    } else {
      // Input is a nickname. Resolve IP from ban metadata, temp bans, or active users
      const cleanNick = targetInput.toLowerCase();

      // 1. Search in bannedIpMeta
      for (const [ip, meta] of bannedIpMeta.entries()) {
        if (meta.nickname && meta.nickname.toLowerCase() === cleanNick) {
          targetIp = ip;
          targetNickname = meta.nickname;
          break;
        }
      }

      // 2. Search in antiSpam tempBans
      if (!targetIp) {
        const tempBansList = antiSpam.getTempBansList();
        const foundTemp = tempBansList.find(t => t.nickname && t.nickname.toLowerCase() === cleanNick);
        if (foundTemp) {
          targetIp = foundTemp.ip;
          targetNickname = foundTemp.nickname;
        }
      }

      // 3. Search in active users
      if (!targetIp) {
        const foundUser = Array.from(users.values()).find(u => u.nickname.toLowerCase() === cleanNick);
        if (foundUser && foundUser.clientIp) {
          targetIp = foundUser.clientIp;
          targetNickname = foundUser.nickname;
        }
      }
    }

    if (!targetIp) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom || '#자유대화',
        type: 'system',
        content: `* 차단 목록이나 최근 접속 기록에서 "${targetInput}" 사용자의 IP를 찾을 수 없습니다. IP 주소로 직접 해제하려면: /unban <IP주소>`,
        timestamp: Date.now()
      });
      return;
    }

    let unbanned = false;
    if (bannedIps.has(targetIp)) {
      bannedIps.delete(targetIp);
      bannedIpMeta.delete(targetIp);
      saveBannedIps();
      unbanned = true;
    }
    if (antiSpam.clearTempBan(targetIp)) {
      unbanned = true;
    }
    antiSpam.clearUserData(targetIp, null);

    if (unbanned) {
      console.log(`[Nyaa Chat] IP Unbanned: ${targetIp} (Nick: ${targetNickname || targetInput}) by Oper: ${currentUser.nickname}`);
      const dispText = targetNickname
        ? `사용자 "${targetNickname}" (IP: ${targetIp})`
        : `IP [${targetIp}]`;
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom || '#자유대화',
        type: 'system',
        content: `* 👑 [관리자] ${dispText} 차단이 정상 해제되었습니다.`,
        timestamp: Date.now()
      });
    } else {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser.currentRoom || '#자유대화',
        type: 'system',
        content: `* 차단 목록에서 IP [${targetIp}]${targetNickname ? ` ("${targetNickname}")` : ''}을(를) 찾을 수 없습니다. (이미 해제되었거나 차단되지 않음)`,
        timestamp: Date.now()
      });
    }
  });

  // Server Operator Ban List (/banlist)
  socket.on('get_banlist', () => {
    const currentUser = users.get(socket.id);
    if (!currentUser || !currentUser.isServerOper) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: currentUser?.currentRoom || '#자유대화',
        type: 'system',
        content: '* /banlist 명령어는 서버 관리자(Operator) 전용입니다.',
        timestamp: Date.now()
      });
      return;
    }

    const permBans = Array.from(bannedIps).map((ip) => {
      const meta = bannedIpMeta.get(ip) || {};
      return {
        ip,
        nickname: meta.nickname || '(기록 없음)',
        reason: meta.reason || '관리자 영구 차단',
        bannedBy: meta.bannedBy || '관리자',
        bannedAt: meta.bannedAt || 0,
        type: 'permanent'
      };
    });

    const tempBans = antiSpam.getTempBansList().map((t) => ({
      ip: t.ip,
      nickname: t.nickname || '(알 수 없음)',
      reason: t.reason || '도배 3회 누적 (하루 밴)',
      bannedBy: '시스템(Anti-Spam)',
      bannedAt: t.bannedAt,
      remainingMinutes: t.remainingMinutes,
      type: 'temp_spam'
    }));

    const totalCount = permBans.length + tempBans.length;

    let output = '';
    output += ` ┌──────────────────────────────────────────────────────────━━\n`;
    output += ` │  🚨 서버 차단 목록 (총 ${totalCount}건)\n`;
    output += ` │\n`;

    if (totalCount === 0) {
      output += ` │  현재 차단된 IP 또는 사용자가 없습니다.\n`;
    } else {
      let idx = 1;
      if (permBans.length > 0) {
        output += ` │  [영구 차단 IP - 총 ${permBans.length}건]\n`;
        permBans.forEach((b) => {
          const timeStr = b.bannedAt ? new Date(b.bannedAt).toLocaleString('ko-KR') : '기록 없음';
          output += ` │   ${idx++}. IP: ${b.ip}\n`;
          output += ` │      • 닉네임: ${b.nickname}\n`;
          output += ` │      • 사유: ${b.reason}\n`;
          output += ` │      • 차단일시: ${timeStr} (처리: @${b.bannedBy})\n`;
          output += ` │\n`;
        });
      }

      if (tempBans.length > 0) {
        output += ` │  [도배 제재 임시 차단(하루 밴) - 총 ${tempBans.length}건]\n`;
        tempBans.forEach((b) => {
          const hours = Math.floor(b.remainingMinutes / 60);
          const mins = b.remainingMinutes % 60;
          const remainingStr = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
          output += ` │   ${idx++}. IP: ${b.ip}\n`;
          output += ` │      • 닉네임: ${b.nickname}\n`;
          output += ` │      • 사유: ${b.reason}\n`;
          output += ` │      • 남은 시간: 약 ${remainingStr}\n`;
          output += ` │\n`;
        });
      }
    }

    output += ` └──────────────────────────────────────────────────────────━━`;

    socket.emit('banlist_result', {
      formattedText: output,
      totalCount,
      permBans,
      tempBans
    });
  });

  // Test helper: simulate mute expiry for multi-strike test suite
  if (socket.handshake?.headers?.['x-test-client'] === 'true') {
    socket.on('test_clear_mute', () => {
      const clientIp = getClientIp(socket);
      const user = users.get(socket.id);
      if (user) {
        antiSpam.clearMuteOnly(clientIp, user.userId);
      }
    });
  }


  // Send Message (Text / Action / File)
  socket.on('send_message', (msgData) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const { roomId, content, type, fileInfo } = msgData;
    if (!roomId) return;

    // NickServ Command Interception (/nickpass, /identify, /register, /unregister)
    const trimmedContent = (content || '').trim();
    if (trimmedContent.startsWith('/')) {
      const parts = trimmedContent.slice(1).trim().split(/\s+/);
      const cmd = (parts[0] || '').toLowerCase();
      const clientIp = getClientIp(socket);

      if (cmd === 'nickpass' || cmd === 'register' || cmd === 'identify' || cmd === 'id' || cmd === 'unregister') {
        if (cmd === 'register') {
          if (parts.length < 2) {
            socket.emit('new_message', {
              id: `sys_${Date.now()}`,
              roomId: sender.currentRoom || roomId,
              type: 'system',
              content: '* 사용법: /register <암호> (현재 닉네임에 비밀번호를 등록합니다)',
              timestamp: Date.now()
            });
            return;
          }
          const regRes = nickServ.registerNickname(clientIp, sender.nickname, parts[1], sender.userId);
          if (regRes.success) {
            sender.isNickVerified = true;
            if (sender.nickGraceTimer) {
              clearTimeout(sender.nickGraceTimer);
              sender.nickGraceTimer = null;
            }
          }
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: sender.currentRoom || roomId,
            type: 'system',
            content: regRes.message,
            timestamp: Date.now()
          });
          return;
        }

        if (cmd === 'identify' || cmd === 'id') {
          if (parts.length < 2) {
            socket.emit('new_message', {
              id: `sys_${Date.now()}`,
              roomId: sender.currentRoom || roomId,
              type: 'system',
              content: '* 사용법: /identify <암호> (보호된 닉네임의 본인 인증을 수행합니다)',
              timestamp: Date.now()
            });
            return;
          }
          const vRes = nickServ.verifyPassword(clientIp, sender.nickname, parts[1]);
          if (vRes.success) {
            sender.isNickVerified = true;
            if (sender.nickGraceTimer) {
              clearTimeout(sender.nickGraceTimer);
              sender.nickGraceTimer = null;
            }
          }
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: sender.currentRoom || roomId,
            type: 'system',
            content: vRes.message,
            timestamp: Date.now()
          });
          if (vRes.shouldKick) {
            setTimeout(() => {
              try { socket.disconnect(true); } catch (_) {}
            }, 100);
          }
          return;
        }

        if (cmd === 'unregister') {
          if (parts.length < 2) {
            socket.emit('new_message', {
              id: `sys_${Date.now()}`,
              roomId: sender.currentRoom || roomId,
              type: 'system',
              content: '* 사용법: /unregister <암호> (현재 닉네임의 비밀번호 등록을 해제합니다)',
              timestamp: Date.now()
            });
            return;
          }
          const unregRes = nickServ.unregisterNickname(sender.nickname, parts[1]);
          if (unregRes.success) {
            sender.isNickVerified = true;
          }
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: sender.currentRoom || roomId,
            type: 'system',
            content: unregRes.message,
            timestamp: Date.now()
          });
          return;
        }

        if (cmd === 'nickpass') {
          if (parts.length === 2) {
            const pass = parts[1];
            if (!nickServ.isRegistered(sender.nickname)) {
              const regRes = nickServ.registerNickname(clientIp, sender.nickname, pass, sender.userId);
              if (regRes.success) {
                sender.isNickVerified = true;
                if (sender.nickGraceTimer) {
                  clearTimeout(sender.nickGraceTimer);
                  sender.nickGraceTimer = null;
                }
              }
              socket.emit('new_message', {
                id: `sys_${Date.now()}`,
                roomId: sender.currentRoom || roomId,
                type: 'system',
                content: regRes.message,
                timestamp: Date.now()
              });
              return;
            } else if (!sender.isNickVerified) {
              const vRes = nickServ.verifyPassword(clientIp, sender.nickname, pass);
              if (vRes.success) {
                sender.isNickVerified = true;
                if (sender.nickGraceTimer) {
                  clearTimeout(sender.nickGraceTimer);
                  sender.nickGraceTimer = null;
                }
              }
              socket.emit('new_message', {
                id: `sys_${Date.now()}`,
                roomId: sender.currentRoom || roomId,
                type: 'system',
                content: vRes.message,
                timestamp: Date.now()
              });
              if (vRes.shouldKick) {
                setTimeout(() => {
                  try { socket.disconnect(true); } catch (_) {}
                }, 100);
              }
              return;
            } else {
              socket.emit('new_message', {
                id: `sys_${Date.now()}`,
                roomId: sender.currentRoom || roomId,
                type: 'system',
                content: '* ℹ️ 이미 본인 인증이 완료된 닉네임입니다. 비밀번호를 변경하려면 /nickpass <기존암호> <새암호> 를 입력하세요.',
                timestamp: Date.now()
              });
              return;
            }
          } else if (parts.length >= 3) {
            const chgRes = nickServ.changePassword(sender.nickname, parts[1], parts[2]);
            socket.emit('new_message', {
              id: `sys_${Date.now()}`,
              roomId: sender.currentRoom || roomId,
              type: 'system',
              content: chgRes.message,
              timestamp: Date.now()
            });
            return;
          } else {
            socket.emit('new_message', {
              id: `sys_${Date.now()}`,
              roomId: sender.currentRoom || roomId,
              type: 'system',
              content: '* 사용법:\n  - 비밀번호 신규 등록: /nickpass <암호>\n  - 본인 인증: /identify <암호> (또는 /nickpass <암호>)\n  - 비밀번호 변경: /nickpass <기존암호> <새암호>\n  - 등록 해제: /unregister <암호>',
              timestamp: Date.now()
            });
            return;
          }
        }
      }

      if (cmd === 'stats' || cmd === 'serverinfo') {
        const uptimeSec = Math.floor(process.uptime());
        const days = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const mins = Math.floor((uptimeSec % 3600) / 60);
        const secs = uptimeSec % 60;
        const uptimeStr = `${days > 0 ? days + '일 ' : ''}${hours}시간 ${mins}분 ${secs}초`;

        const mem = process.memoryUsage();
        const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
        const heapMb = (mem.heapUsed / 1024 / 1024).toFixed(1);

        const socketCount = io.sockets.sockets ? io.sockets.sockets.size : users.size;
        const activeUserCount = users.size;
        const totalChannels = channelList.length;

        const statsContent = [
          `* 📊 [서버 상태 정보 (Server Stats)]`,
          `* • 서버 버전: NyaaChat Server v1.6.0 (Node ${process.version} / ${process.platform})`,
          `* • 가동 시간: ${uptimeStr}`,
          `* • 현재 접속: ${activeUserCount}명 (활성 소켓: ${socketCount}개)`,
          `* • 개설 채널: ${totalChannels}개 (공개/비공개 포함)`,
          `* • 메모리 점유: RSS ${rssMb}MB / Heap ${heapMb}MB`
        ].join('\n');

        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId: sender.currentRoom || roomId,
          type: 'system',
          content: statsContent,
          timestamp: Date.now()
        });
        return;
      }

      if (cmd === 'list') {
        const keyword = parts[1] || '';
        const filtered = getServerChannelList(sender, keyword);
        if (filtered.length === 0) {
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: sender.currentRoom || roomId,
            type: 'system',
            content: keyword ? `* 🔍 '${keyword}' 검색어와 일치하는 채널이 없습니다.` : `* 개설된 공개 채널이 없습니다.`,
            timestamp: Date.now()
          });
        } else {
          const listLines = [
            `* 📋 [채널 목록 (${filtered.length}개)${keyword ? " - 검색어: '" + keyword + "'" : ''}]`,
            ...filtered.map(ch => `* • ${ch.name} (${ch.userCount}명) [${ch.modes || '+nt'}] : ${ch.topic || '(주제 없음)'}${ch.hasKey ? ' 🔒' : ''}`)
          ];
          socket.emit('new_message', {
            id: `sys_${Date.now()}`,
            roomId: sender.currentRoom || roomId,
            type: 'system',
            content: listLines.join('\n'),
            timestamp: Date.now()
          });
        }
        return;
      }
    }

    // Impersonation Guard: If user is on a registered nickname but has not verified password yet
    if (!sender.isNickVerified && nickServ.isRegistered(sender.nickname)) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: sender.currentRoom || roomId,
        type: 'system',
        content: `* 🔒 [보호 닉네임] 비밀번호 인증(/identify <암호>)을 완료하기 전에는 메시지를 전송할 수 없습니다. (미인증 시 60초 후 임시 닉네임으로 변경됩니다)`,
        timestamp: Date.now()
      });
      return;
    }

    const channel = getChannel(roomId);
    if (channel) initChannelModes(channel);

    if (channel && channel.isOperOnly && !sender.isServerOper) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: sender.currentRoom || '#자유대화',
        type: 'system',
        content: `* '${channel.name}' 채널은 관리자 전용 채널입니다. 일반 사용자는 메시지를 작성할 수 없습니다. 🔒`,
        timestamp: Date.now()
      });
      return;
    }

    // Check +n mode (No external messages)
    if (channel && channel.modes && channel.modes.n) {
      const isMember = sender.joinedChannels && sender.joinedChannels.has(roomId);
      if (!isMember && !sender.isServerOper) {
        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId: sender.currentRoom || '#자유대화',
          type: 'system',
          content: `* [모드 알림] 이 채널은 외부 메시지 금지(+n) 모드입니다. 채널에 입장 후 메시지를 전송하세요.`,
          timestamp: Date.now()
        });
        return;
      }
    }

    const isOp = Boolean(channel && Array.isArray(channel.operators) && channel.operators.includes(sender.userId));
    const hasVoice = Boolean(channel && channel.voices && channel.voices.has(sender.userId));

    // Check +m mode (Moderated channel: only op or voice can speak)
    if (channel && channel.modes && channel.modes.m) {
      if (!isOp && !hasVoice && !sender.isServerOper) {
        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId,
          type: 'system',
          content: `* [모드 알림] 이 채널은 발언권 제한(+m) 모드입니다. 방장(@) 또는 발언권(+v)을 가진 사용자만 대화할 수 있습니다. 🔇`,
          timestamp: Date.now()
        });
        return;
      }
    }

    sender.lastActiveTime = Date.now();

    // Block image/video/file uploads if media upload is disabled
    if (!ENABLE_MEDIA_UPLOAD && (fileInfo || ['image', 'video', 'file'].includes(type))) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: sender.currentRoom || roomId,
        type: 'system',
        content: '* 이미지, 동영상 및 파일 업로드 기능은 서버 정책에 따라 지원하지 않습니다.',
        timestamp: Date.now()
      });
      return;
    }

    const isDm = roomId.startsWith('dm_');

    // Block 1:1 DM if disabled
    if (!ENABLE_1ON1_DM && (isDm || type === 'dm')) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: sender.currentRoom || roomId,
        type: 'system',
        content: '* 1:1 대화 기능은 서버 정책에 따라 분리/비활성화되어 있습니다.',
        timestamp: Date.now()
      });
      return;
    }

    const clientIp = getClientIp(socket);
    recordUserIp(sender.userId, clientIp);

    // Anti-Spam Rate Limiting and Penalty Check
    const muteStatus = antiSpam.isMuted(clientIp, sender.userId);
    if (muteStatus.isMuted) {
      socket.emit('new_message', {
        id: `sys_${Date.now()}`,
        roomId: sender.currentRoom || roomId,
        type: 'system',
        content: `* ⏳ [도배 제재] 도배 방지 정책으로 인해 채팅이 제한된 상태입니다. 약 ${muteStatus.remainingSeconds}초 후에 대화가 가능합니다. (누적 경고: ${muteStatus.strikeCount}/3)`,
        timestamp: Date.now()
      });
      return;
    }

    const spamResult = antiSpam.checkMessage(sender, clientIp);
    if (!spamResult.allowed) {
      if (spamResult.action === 'timeout') {
        const warningMsg = spamResult.strikeCount === 1
          ? `* ⚠️ [도배 경고 (1/3)] 5초 이내에 10회 이상 메시지 전송(도배)이 감지되어 1분간 대화가 제한됩니다. (※ 3회 적발 시 하루 밴)`
          : `* ⚠️ [도배 경고 (2/3)] 도배가 재감지되어 1분간 대화가 제한됩니다. (※ 1회 추가 적발 시 24시간 동안 서버 접속이 차단됩니다!)`;

        socket.emit('new_message', {
          id: `sys_${Date.now()}`,
          roomId: sender.currentRoom || roomId,
          type: 'system',
          content: warningMsg,
          timestamp: Date.now()
        });
        socket.emit('spam_timeout', {
          durationSeconds: spamResult.durationSeconds,
          strikeCount: spamResult.strikeCount,
          muteUntil: spamResult.muteUntil
        });
        return;
      } else if (spamResult.action === 'ban') {
        const banNotice = {
          id: `sys_${Date.now()}_spam`,
          roomId: sender.currentRoom || roomId,
          type: 'system',
          content: `* 🚨 [도배 제재] ${sender.nickname} 님이 24시간 내 도배 경고 3회 누적으로 인해 24시간 동안 서버 이용이 차단(하루 밴)되었습니다.`,
          timestamp: Date.now()
        };
        io.emit('new_message', banNotice);

        socket.emit('banned', {
          reason: '24시간 내 도배 3회 누적으로 인한 24시간 임시 차단 (하루 밴)',
          ip: clientIp,
          durationHours: spamResult.durationHours,
          banUntil: spamResult.banUntil
        });

        for (const [sId, s] of io.sockets.sockets) {
          if (getClientIp(s) === clientIp) {
            s.disconnect(true);
          }
        }
        return;
      }
      return;
    }
    let dmInfo = null;
    let otherUser = null;
    if (isDm) {
      dmInfo = resolveDmParticipants(roomId, sender.userId);
      const otherUserId = dmInfo ? dmInfo.otherUserId : (msgData.recipientId || null);
      if (otherUserId) {
        otherUser = Array.from(users.values()).find((u) => u.userId === otherUserId);
      }
    }

    let cleanContent = (content || '').trim();
    if (cleanContent.length > 2000) {
      cleanContent = cleanContent.slice(0, 2000);
    }

    if (!cleanContent && !fileInfo && type !== 'action') {
      return;
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      recipientId: dmInfo ? dmInfo.otherUserId : (msgData.recipientId || null),
      sender: {
        userId: sender.userId,
        nickname: sender.nickname,
        avatar: sender.avatar,
        socketId: socket.id,
        isOp: isOp,
        hasVoice: hasVoice,
        isServerOper: Boolean(sender.isServerOper),
        isAiOper: Boolean(sender.isAiOper),
        aiOperId: sender.aiOperId || null
      },
      content: cleanContent,
      type: type || 'text', // 'text' | 'action' | 'image' | 'video' | 'file'
      fileInfo: fileInfo || null,
      timestamp: Date.now()
    };

    if (!messageHistory[roomId]) {
      messageHistory[roomId] = [];
    }

    messageHistory[roomId].push(message);
    if (messageHistory[roomId].length > 200) {
      messageHistory[roomId].shift();
    }

    // Emit message to everyone in the room
    io.to(roomId).emit('new_message', message);

    // If it's a DM, make sure the recipient socket ALSO receives message and dm_notification
    if (isDm && otherUser && otherUser.socketId) {
      const otherSocket = io.sockets.sockets.get(otherUser.socketId);
      if (otherSocket) {
        const isAlreadyInRoom = otherSocket.rooms && otherSocket.rooms.has(roomId);
        if (!isAlreadyInRoom) {
          otherSocket.emit('new_message', message);
        }
      }
      io.to(otherUser.socketId).emit('dm_notification', {
        sender: {
          userId: sender.userId,
          nickname: sender.nickname,
          avatar: sender.avatar
        },
        roomId,
        message: message
      });
    }
    saveMessagesDebounced();

    // Check if message triggers Bot response (mention in channel or 1:1 DM)
    const botChannel = getChannel(roomId);
    const isServiceRoom = Boolean(botChannel && (botChannel.isService || botChannel.id === '#자유대화'));
    const isChannelMention = isServiceRoom && (content.includes('냥봇') || content.includes('@냥봇'));
    const isBotDm = roomId.startsWith('dm_') && roomId.includes('bot_nyaa');

    if ((type === 'text' || !type) && (isChannelMention || isBotDm)) {
      setTimeout(() => {
        const replyText = generateBotResponse(content || '', sender.nickname, roomId);
        const botChannel = getChannel(roomId);
        const botIsOp = Boolean(botChannel && Array.isArray(botChannel.operators) && botChannel.operators.includes(BOT_ID));
        const botMsg = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          roomId,
          sender: {
            userId: SERVER_BOT.userId,
            nickname: SERVER_BOT.nickname,
            avatar: SERVER_BOT.avatar,
            isBot: true,
            isOp: botIsOp
          },
          content: replyText,
          type: 'text',
          timestamp: Date.now()
        };

        if (!messageHistory[roomId]) {
          messageHistory[roomId] = [];
        }
        messageHistory[roomId].push(botMsg);
        if (messageHistory[roomId].length > 200) {
          messageHistory[roomId].shift();
        }
        io.to(roomId).emit('new_message', botMsg);
        saveMessagesDebounced();
      }, 350);
    }

    // Check for link preview asynchronously if text
    if (type === 'text') {
      const urlMatch = (content || '').match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const targetUrl = urlMatch[1];
        getLinkPreview(targetUrl).then((preview) => {
          if (preview) {
            message.linkPreview = preview;
            io.to(roomId).emit('message_updated', {
              messageId: message.id,
              roomId,
              linkPreview: preview
            });
            saveMessagesDebounced();
          }
        }).catch(() => {});
      }
    }
  });

  // Real-time Typing Indicator
  socket.on('typing', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    user.lastActiveTime = Date.now();
    const { roomId, isTyping } = data;
    socket.to(roomId).emit('user_typing', {
      userId: user.userId,
      nickname: user.nickname,
      roomId,
      isTyping
    });
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    const now = Date.now();
    const user = users.get(socket.id);
    const connectTime = user ? (user.connectTime || user.onlineAt || socketConnectTime) : socketConnectTime;
    const durationSeconds = Math.max(0, Math.round((now - connectTime) / 1000));
    const clientIp = (user && user.clientIp) ? user.clientIp : socketIp;

    if (user) {
      if (user.nickGraceTimer) {
        clearTimeout(user.nickGraceTimer);
        user.nickGraceTimer = null;
      }
      console.log(`User disconnected: ${user.nickname} (${socket.id}) [IP: ${clientIp}, duration: ${durationSeconds}s, reason: ${reason}]`);
      users.delete(socket.id);

      const joined = user.joinedChannels ? Array.from(user.joinedChannels) : [user.currentRoom || '#자유대화'];
      joined.forEach(roomId => {
        socket.to(roomId).emit('user_typing', {
          userId: user.userId,
          nickname: user.nickname,
          roomId: roomId,
          isTyping: false
        });
        handleUserLeavingRoom(roomId, user.userId, socket.id);
        const targetChannel = getChannel(roomId);
        if (targetChannel) {
          const leaveMsg = {
            id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            roomId: roomId,
            type: 'system',
            content: `* ${user.nickname}님이 퇴장하셨습니다.`,
            timestamp: Date.now()
          };
          if (!messageHistory[roomId]) messageHistory[roomId] = [];
          messageHistory[roomId].push(leaveMsg);
          io.to(roomId).emit('new_message', leaveMsg);
        }
      });
      saveMessagesDebounced();

      broadcastUserListDebounced();
      broadcastChannelListDebounced();
    }
  });
});

// Start Server
function getLocalIp() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return '0.0.0.0';
}

const localIp = getLocalIp();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=============================================`);
  console.log(`  Nyaa Chat Server is running on:`);
  console.log(`  - Local:   http://localhost:${PORT}`);
  console.log(`  - Network: http://${localIp}:${PORT}`);
  console.log(`  - Bind:    0.0.0.0:${PORT} (All Interfaces)`);
  console.log(`=============================================`);
});
