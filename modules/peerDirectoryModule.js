// ============================================================================
// Nyaa Chat - Ultra-Lightweight Whitelist Peer Directory & Server Extensions
// (modules/peerDirectoryModule.js)
// ============================================================================
// [핵심 설계 원칙]
// 1. 서버 간 채팅 내용은 일절 연동하지 않으며(독립 초경량 구조),
//    오직 수동 등록된 화이트리스트(data/peers_whitelist.txt) 이웃 서버들과만
//    [서버 상태 + 공개 채널 리스트 + 프로토콜 정보] 요약본(수 KB)을 주기적으로 교류합니다.
// 2. 스테이터스(중심) 서버가 일시적으로 죽더라도, 이웃 서버들이 마지막으로 교류한
//    디렉토리 수첩(data/network_directory.json)을 유지하고 서로 백업 교류하여
//    유저는 언제나 전체 서버 리스트와 각 서버의 공개 채널 목록을 조회할 수 있습니다.
// 3. 기본 명령어(Core)는 절대 침해할 수 없으며(하위호환 100% 보장),
//    서버별 확장 명령어(extendedCommands)와 권장 모듈 안내만 접속 시 고지하고
//    타 서버 이동 시 자동으로 비활성화됩니다.
// ============================================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { safeAtomicWriteFileSync } = require('./fsSafe');

// 절대 침해 불가 기본 표준 명령어 (갈라파고스화 방지 성역)
const PROTECTED_CORE_COMMANDS = new Set([
  'join', 'j', 'part', 'leave', 'list', 'servers', 'server',
  'nick', 'whois', 'w', 'msg', 'query', 'topic', 'mode',
  'op', 'deop', 'kick', 'ban', 'unban', 'banlist', 'oper',
  'me', 'clear', 'export', 'help',
  'peer', 'servername', 'serverurl', 'extcmd'
]);

function isLocalHostOrIp(host) {
  if (!host) return true;
  const clean = host.split(':')[0].toLowerCase();
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1' ||
         clean.startsWith('192.168.') || clean.startsWith('10.') || clean.startsWith('172.16.');
}

function normalizeServerUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    let proto = parsed.protocol.toLowerCase();
    const host = parsed.host.toLowerCase();
    let pathname = parsed.pathname.replace(/\/+$/, '');
    // HTTPS Enforcement: Upgrade non-local http to https
    if (proto === 'http:' && !isLocalHostOrIp(parsed.hostname)) {
      proto = 'https:';
    }
    return `${proto}//${host}${pathname}`;
  } catch (e) {
    return trimmed.replace(/\/+$/, '').toLowerCase();
  }
}

function extractHostFromUrl(rawUrl) {
  try {
    const u = new URL(normalizeServerUrl(rawUrl));
    return u.host.toLowerCase();
  } catch (e) {
    return String(rawUrl || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  }
}

function httpJsonRequest(targetUrl, method = 'GET', bodyObj = null, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const payloadStr = bodyObj ? JSON.stringify(bodyObj) : null;
      const options = {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NyaaChat-PeerSync/1.0'
        },
        timeout: timeoutMs
      };

      if (payloadStr) {
        options.headers['Content-Type'] = 'application/json; charset=utf-8';
        options.headers['Content-Length'] = Buffer.byteLength(payloadStr, 'utf8');
      }

      const req = lib.request(options, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (raw.length < 512 * 1024) raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (err) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.on('error', (err) => reject(err));

      if (payloadStr) req.write(payloadStr);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function setupPeerDirectoryModule({
  app,
  io,
  dataDir,
  users,
  channels,
  getChannels,
  isOperChannel,
  getChannelModeString,
  BOT_NAME
}) {
  const SERVER_CONFIG_FILE = path.join(dataDir, 'server_config.json');
  const PEERS_WHITELIST_FILE = path.join(dataDir, 'peers_whitelist.txt');
  const NETWORK_DIR_FILE = path.join(dataDir, 'network_directory.json');
  const MODULES_DIR = path.join(dataDir, 'client_modules');

  if (!fs.existsSync(MODULES_DIR)) {
    fs.mkdirSync(MODULES_DIR, { recursive: true });
  }

  // Auto-detect domain from /etc/caddy/Caddyfile or ~/duckdns/duck.sh if not explicitly set
  function detectDefaultServerIdentity() {
    if (process.env.SERVER_URL) {
      const envUrl = normalizeServerUrl(process.env.SERVER_URL);
      return {
        serverName: process.env.SERVER_NAME || `서버 (${extractHostFromUrl(envUrl)})`,
        serverUrl: envUrl
      };
    }
    try {
      const candidates = [
        '/etc/caddy/Caddyfile',
        path.join(process.env.HOME || '/home/ubuntu', 'duckdns', 'duck.sh')
      ];
      for (const file of candidates) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          if (/tnemu\.duckdns\.org/i.test(content) || /domains=tnemu\b/i.test(content)) {
            return {
              serverName: process.env.SERVER_NAME || 'B서버 (tnemu)',
              serverUrl: 'https://tnemu.duckdns.org'
            };
          }
          if (/nemulo\.duckdns\.org/i.test(content) || /domains=nemulo\b/i.test(content)) {
            return {
              serverName: process.env.SERVER_NAME || 'A서버 (nemulo)',
              serverUrl: 'https://nemulo.duckdns.org'
            };
          }
        }
      }
    } catch (e) {
      // ignore detection error
    }
    return {
      serverName: process.env.SERVER_NAME || 'A서버 (nemulo)',
      serverUrl: 'https://nemulo.duckdns.org'
    };
  }

  const detectedIdentity = detectDefaultServerIdentity();

  // 1. Load or Initialize Server Config
  let serverConfig = {
    serverName: detectedIdentity.serverName,
    serverUrl: detectedIdentity.serverUrl,
    protocol: 'nyaa-core-v1',
    description: process.env.SERVER_DESC || 'Nyaa Chat 표준 호환 서버',
    extendedCommands: [],
    recommendedModule: null
  };

  function loadServerConfig() {
    try {
      if (fs.existsSync(SERVER_CONFIG_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(SERVER_CONFIG_FILE, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          serverConfig = Object.assign({}, serverConfig, parsed);
          if (process.env.SERVER_NAME) serverConfig.serverName = process.env.SERVER_NAME;
          if (process.env.SERVER_URL) serverConfig.serverUrl = normalizeServerUrl(process.env.SERVER_URL);
        }
      } else {
        saveServerConfig();
      }
    } catch (e) {
      console.error('[PeerDirectory] Failed to load server_config.json:', e.message);
    }
  }

  function saveServerConfig() {
    try {
      safeAtomicWriteFileSync(SERVER_CONFIG_FILE, JSON.stringify(serverConfig, null, 2), 'utf8');
    } catch (e) {
      console.error('[PeerDirectory] Failed to save server_config.json:', e.message);
    }
  }

  // 2. Load or Initialize Whitelist File (data/peers_whitelist.txt)
  let whitelistUrls = new Set(); // normalized URLs

  function loadWhitelist() {
    whitelistUrls.clear();
    try {
      if (!fs.existsSync(PEERS_WHITELIST_FILE)) {
        const defaultTxt = [
          '# ============================================================================',
          '# Nyaa Chat 서버 간 수동 화이트리스트 (data/peers_whitelist.txt)',
          '# ============================================================================',
          '# 신뢰할 수 있는 이웃 서버(또는 스테이터스 서버)의 주소를 한 줄에 하나씩 적어주세요.',
          '# 화이트리스트에 등록된 서버끼리만 서버 상태 및 공개 채널 리스트를 주기적으로 교류합니다.',
          '# 채팅창에서 관리자(/oper) 로그인 후 아래 명령어로도 즉시 추가/삭제할 수 있습니다:',
          '#   /peer add https://tnemu.duckdns.org',
          '#   /peer del https://tnemu.duckdns.org',
          '#   /peer list',
          '#   /peer sync',
          '# ============================================================================',
          'https://nemulo.duckdns.org',
          'https://tnemu.duckdns.org',
          ''
        ].join('\r\n');
        safeAtomicWriteFileSync(PEERS_WHITELIST_FILE, defaultTxt, 'utf8');
      }
      const lines = fs.readFileSync(PEERS_WHITELIST_FILE, 'utf8').split(/\r?\n/);
      lines.forEach((line) => {
        const clean = line.trim();
        if (!clean || clean.startsWith('#') || clean.startsWith(';')) return;
        const norm = normalizeServerUrl(clean);
        if (norm) whitelistUrls.add(norm);
      });
    } catch (e) {
      console.error('[PeerDirectory] Failed to load peers_whitelist.txt:', e.message);
    }
  }

  function saveWhitelist() {
    try {
      const header = [
        '# ============================================================================',
        '# Nyaa Chat 서버 간 수동 화이트리스트 (data/peers_whitelist.txt)',
        '# 한 줄에 하나씩 신뢰하는 이웃 서버 URL을 입력하세요. (/peer add <URL> 명령 지원)',
        '# ============================================================================',
        ''
      ];
      const body = Array.from(whitelistUrls);
      safeAtomicWriteFileSync(PEERS_WHITELIST_FILE, header.concat(body).join('\r\n') + '\r\n', 'utf8');
    } catch (e) {
      console.error('[PeerDirectory] Failed to save peers_whitelist.txt:', e.message);
    }
  }

  function isUrlWhitelisted(candidateUrl) {
    const norm = normalizeServerUrl(candidateUrl);
    if (!norm) return false;
    if (norm === normalizeServerUrl(serverConfig.serverUrl)) return true;
    if (whitelistUrls.has(norm)) return true;
    const candidateHost = extractHostFromUrl(norm);
    for (const w of whitelistUrls) {
      if (extractHostFromUrl(w) === candidateHost) return true;
    }
    return false;
  }

  // 3. Load or Initialize Cached Network Directory (data/network_directory.json)
  const networkDirectory = new Map(); // normalizedUrl -> serverEntry

  function loadNetworkDirectory() {
    try {
      if (fs.existsSync(NETWORK_DIR_FILE)) {
        const list = JSON.parse(fs.readFileSync(NETWORK_DIR_FILE, 'utf8'));
        if (Array.isArray(list)) {
          list.forEach((entry) => {
            if (entry && entry.serverUrl) {
              const norm = normalizeServerUrl(entry.serverUrl);
              if (norm && isUrlWhitelisted(norm)) {
                networkDirectory.set(norm, entry);
              }
            }
          });
        }
      }
    } catch (e) {
      console.error('[PeerDirectory] Failed to load network_directory.json:', e.message);
    }
  }

  let saveDirTimer = null;
  function saveNetworkDirectoryDebounced() {
    if (saveDirTimer) return;
    saveDirTimer = setTimeout(() => {
      saveDirTimer = null;
      try {
        const arr = Array.from(networkDirectory.values());
        safeAtomicWriteFileSync(NETWORK_DIR_FILE, JSON.stringify(arr, null, 2), 'utf8');
      } catch (e) {}
    }, 1000);
  }

  // 4. Build This Server's Live Snapshot
  function buildSelfServerSnapshot() {
    const onlineUsers = Array.from(users.values());
    const publicChannels = [];
    const chList = typeof getChannels === 'function' ? (getChannels() || []) : (channels || []);

    chList.forEach((ch) => {
      if (isOperChannel(ch)) return;
      if (ch.modes && (ch.modes.s || ch.modes.p)) return; // Exclude secret/private channels from public server list

      let count = onlineUsers.filter((u) =>
        u.joinedChannels ? u.joinedChannels.has(ch.id) : u.currentRoom === ch.id
      ).length;
      if (ch.hasBot) count += 1;

      publicChannels.push({
        id: ch.id,
        name: ch.name,
        topic: ch.topic || ch.description || '',
        userCount: count,
        hasKey: Boolean(ch.modes && ch.modes.k),
        modes: getChannelModeString(ch)
      });
    });

    publicChannels.sort((a, b) => b.userCount - a.userCount);

    const selfUrl = normalizeServerUrl(serverConfig.serverUrl);
    const snapshot = {
      serverName: serverConfig.serverName || 'Nyaa 표준 서버',
      serverUrl: selfUrl,
      host: extractHostFromUrl(selfUrl),
      protocol: serverConfig.protocol || 'nyaa-core-v1',
      description: serverConfig.description || '',
      userCount: onlineUsers.length,
      publicChannels,
      extendedCommands: (serverConfig.extendedCommands || []).map((c) => ({
        cmd: c.cmd,
        command: c.cmd,
        desc: c.desc,
        description: c.desc,
        usage: c.usage || c.cmd
      })),
      recommendedModule: serverConfig.recommendedModule || null,
      lastUpdated: Date.now(),
      isOnline: true
    };

    networkDirectory.set(selfUrl, snapshot);
    return snapshot;
  }

  // Merge incoming server record if whitelisted and newer
  function mergePeerSnapshot(record, markOnline = true) {
    if (!record || !record.serverUrl) return false;
    const norm = normalizeServerUrl(record.serverUrl);
    if (!norm || !isUrlWhitelisted(norm)) return false;

    // Never overwrite self snapshot with external data
    if (norm === normalizeServerUrl(serverConfig.serverUrl)) return false;

    const existing = networkDirectory.get(norm);
    const incomingTime = Number(record.lastUpdated) || 0;
    const existingTime = existing ? (Number(existing.lastUpdated) || 0) : 0;

    if (!existing || incomingTime >= existingTime || markOnline) {
      const sanitizedChannels = Array.isArray(record.publicChannels)
        ? record.publicChannels.slice(0, 200).map((ch) => ({
            id: String(ch.id || ch.name || '#자유대화').slice(0, 40),
            name: String(ch.name || ch.id || '#자유대화').slice(0, 40),
            topic: String(ch.topic || '').slice(0, 120),
            userCount: Number(ch.userCount) || 0,
            hasKey: Boolean(ch.hasKey),
            modes: String(ch.modes || '+nt').slice(0, 16)
          }))
        : [];

      const sanitizedExtCmds = Array.isArray(record.extendedCommands)
        ? record.extendedCommands
            .filter((c) => c && c.cmd && !PROTECTED_CORE_COMMANDS.has(String(c.cmd).replace(/^\//, '').toLowerCase()))
            .slice(0, 30)
            .map((c) => ({
              cmd: String(c.cmd).slice(0, 24),
              desc: String(c.desc || '').slice(0, 80),
              usage: String(c.usage || c.cmd).slice(0, 40)
            }))
        : [];

      networkDirectory.set(norm, {
        serverName: String(record.serverName || extractHostFromUrl(norm)).slice(0, 40),
        serverUrl: norm,
        host: extractHostFromUrl(norm),
        protocol: String(record.protocol || 'nyaa-core-v1').slice(0, 24),
        description: String(record.description || '').slice(0, 100),
        userCount: Number(record.userCount) || 0,
        publicChannels: sanitizedChannels,
        extendedCommands: sanitizedExtCmds,
        recommendedModule: record.recommendedModule || null,
        lastUpdated: incomingTime > 0 ? incomingTime : Date.now(),
        isOnline: Boolean(markOnline ? true : record.isOnline)
      });
      return true;
    }
    return false;
  }

  // Get full directory list sorted with self first, then whitelisted peers
  function getFullDirectoryList() {
    const selfSnap = buildSelfServerSnapshot();
    const selfUrl = normalizeServerUrl(selfSnap.serverUrl);
    const result = [];

    // 1. Self server first
    result.push(Object.assign({}, selfSnap, { isSelf: true }));

    // 2. All whitelisted servers (even if not yet contacted or temporarily offline!)
    whitelistUrls.forEach((peerUrl) => {
      if (peerUrl === selfUrl) return;
      const cached = networkDirectory.get(peerUrl);
      if (cached) {
        result.push(Object.assign({}, cached, { isSelf: false }));
      } else {
        result.push({
          serverName: extractHostFromUrl(peerUrl),
          serverUrl: peerUrl,
          host: extractHostFromUrl(peerUrl),
          protocol: 'nyaa-core-v1',
          description: '화이트리스트 등록 서버 (동기화 대기 중)',
          userCount: 0,
          publicChannels: [{ id: '#자유대화', name: '#자유대화', topic: '기본 채널', userCount: 0, hasKey: false, modes: '+nt' }],
          extendedCommands: [],
          recommendedModule: null,
          lastUpdated: 0,
          isOnline: false,
          isSelf: false
        });
      }
    });

    return result;
  }

  // 5. Periodic Whitelist Peer Sync (Every 60s + On Demand)
  let isSyncing = false;
  async function syncWithWhitelistedPeers() {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const selfSnap = buildSelfServerSnapshot();
      const selfUrl = normalizeServerUrl(selfSnap.serverUrl);
      const peers = Array.from(whitelistUrls).filter((u) => u !== selfUrl);

      for (const peerUrl of peers) {
        try {
          // Try mutual gossip endpoint POST /api/peer-sync first
          const syncPayload = {
            sender: selfSnap,
            directory: getFullDirectoryList()
          };
          const res = await httpJsonRequest(`${peerUrl}/api/peer-sync`, 'POST', syncPayload, 4500);
          if (res && res.server) {
            mergePeerSnapshot(res.server, true);
          }
          if (res && Array.isArray(res.directory)) {
            res.directory.forEach((item) => {
              if (item && item.serverUrl && isUrlWhitelisted(item.serverUrl)) {
                const isDirectPeer = normalizeServerUrl(item.serverUrl) === peerUrl;
                mergePeerSnapshot(item, isDirectPeer ? true : Boolean(item.isOnline));
              }
            });
          }
        } catch (err) {
          // Fallback: try GET /api/server-info
          try {
            const info = await httpJsonRequest(`${peerUrl}/api/server-info`, 'GET', null, 4000);
            if (info && info.serverUrl) {
              mergePeerSnapshot(info, true);
            }
          } catch (err2) {
            // Peer is currently unreachable -> keep its cached directory entry & channels, just mark isOnline = false
            const cached = networkDirectory.get(peerUrl);
            if (cached) {
              cached.isOnline = false;
              networkDirectory.set(peerUrl, cached);
            }
          }
        }
      }
      saveNetworkDirectoryDebounced();
    } finally {
      isSyncing = false;
    }
  }

  // Initialize files & start periodic sync timer
  loadServerConfig();
  loadWhitelist();
  loadNetworkDirectory();
  buildSelfServerSnapshot();

  setTimeout(() => syncWithWhitelistedPeers(), 3000);
  setInterval(() => syncWithWhitelistedPeers(), 60 * 1000);

  // 6. Express HTTP Endpoints for Peer Discovery & Client Queries
  app.get('/api/server-info', (req, res) => {
    res.json(buildSelfServerSnapshot());
  });

  app.get('/api/network-directory', (req, res) => {
    res.json({
      selfServer: buildSelfServerSnapshot(),
      servers: getFullDirectoryList(),
      updatedAt: Date.now()
    });
  });

  // Mutual Backup Gossip Endpoint (Strictly Whitelist-Protected & Reverse-Verified!)
  app.post('/api/peer-sync', express.json({ limit: '256kb' }), async (req, res) => {
    const body = req.body || {};
    const sender = body.sender;

    if (!sender || !sender.serverUrl || !isUrlWhitelisted(sender.serverUrl)) {
      return res.status(403).json({
        error: 'NOT_IN_WHITELIST',
        message: '이 서버의 화이트리스트(peers_whitelist.txt)에 등록된 이웃 서버만 상태 교류가 허용됩니다.'
      });
    }

    const normSenderUrl = normalizeServerUrl(sender.serverUrl);
    if (normSenderUrl === normalizeServerUrl(serverConfig.serverUrl)) {
      return res.status(400).json({ error: 'SELF_SYNC_IGNORED' });
    }

    // Security: Reverse Verification to prevent identity spoofing
    try {
      const verifiedInfo = await httpJsonRequest(`${normSenderUrl}/api/server-info`, 'GET', null, 3500);
      if (verifiedInfo && normalizeServerUrl(verifiedInfo.serverUrl) === normSenderUrl) {
        mergePeerSnapshot(verifiedInfo, true);
      } else {
        return res.status(401).json({ error: 'SPOOFING_DETECTED', message: '피어 서버 원격 신원 검증에 실패했습니다.' });
      }
    } catch (err) {
      return res.status(401).json({ error: 'REVERSE_VERIFY_UNREACHABLE', message: '발신 피어 서버에 도달할 수 없습니다.' });
    }

    if (Array.isArray(body.directory)) {
      body.directory.forEach((entry) => {
        if (entry && entry.serverUrl && isUrlWhitelisted(entry.serverUrl)) {
          const isDirectSender = normalizeServerUrl(entry.serverUrl) === normSenderUrl;
          mergePeerSnapshot(entry, isDirectSender ? true : Boolean(entry.isOnline));
        }
      });
    }

    saveNetworkDirectoryDebounced();

    res.json({
      ok: true,
      server: buildSelfServerSnapshot(),
      directory: getFullDirectoryList()
    });
  });

  // Optional Server Module Text File Download Endpoint (Pure text only, never binaries)
  app.get('/api/modules/:moduleId', (req, res) => {
    const rawId = String(req.params.moduleId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!rawId) return res.status(400).json({ error: 'Invalid module ID' });
    const modFile = path.join(MODULES_DIR, `${rawId}.txt`);
    if (!fs.existsSync(modFile)) {
      return res.status(404).json({ error: '모듈 파일을 찾을 수 없습니다.' });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(modFile);
  });

  // 7. Helper to attach to each Socket connection
  function registerSocketHandlers(socket) {
    // Client requests the network server list (Server List Call)
    socket.on('get_network_directory', async (opts) => {
      // 1) Immediately send current snapshot for 0ms UI response
      socket.emit('network_directory_result', {
        selfServer: buildSelfServerSnapshot(),
        servers: getFullDirectoryList()
      });
      // 2) Live-sync with whitelisted neighbor servers so new channels (e.g. #바보) appear right away
      await syncWithWhitelistedPeers();
      socket.emit('network_directory_result', {
        selfServer: buildSelfServerSnapshot(),
        servers: getFullDirectoryList()
      });
    });

    // Execute Server Extended Command (e.g., custom bot interaction on Server C)
    socket.on('exec_server_command', (data) => {
      const user = users.get(socket.id);
      const cmdInput = data && (data.cmd || data.command);
      if (!user || !cmdInput) return;

      const rawCmd = String(cmdInput).replace(/^\//, '').toLowerCase();
      if (PROTECTED_CORE_COMMANDS.has(rawCmd)) return; // Never intercept core commands

      const extList = serverConfig.extendedCommands || [];
      const matched = extList.find((c) => String(c.cmd).replace(/^\//, '').toLowerCase() === rawCmd);
      if (!matched) {
        socket.emit('new_message', {
          id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          roomId: data.roomId || user.currentRoom || '#자유대화',
          type: 'system',
          content: `* [${serverConfig.serverName}] 지원하지 않는 서버 명령어입니다: /${rawCmd}`,
          timestamp: Date.now()
        });
        return;
      }

      const targetRoom = data.roomId || user.currentRoom || '#자유대화';
      const argsText = String(data.args || '').trim();
      let replyTemplate = matched.response || `🤖 [${serverConfig.serverName}] $nick님이 /${rawCmd} 명령어를 실행했습니다.`;

      replyTemplate = replyTemplate
        .replace(/\$nick/g, user.nickname)
        .replace(/\$me/g, user.nickname)
        .replace(/\$chan/g, targetRoom)
        .replace(/\$server/g, serverConfig.serverName)
        .replace(/\$args/g, argsText || '(없음)')
        .replace(/\$rand\((\d+),(\d+)\)/g, (_, a, b) => {
          const min = parseInt(a, 10);
          const max = parseInt(b, 10);
          return String(Math.floor(Math.random() * (max - min + 1)) + min);
        });

      const botMsg = {
        id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        roomId: targetRoom,
        sender: {
          userId: 'bot_nyaa',
          nickname: matched.botName || BOT_NAME || '지킴이',
          avatar: '🤖',
          isBot: true
        },
        content: replyTemplate,
        type: 'text',
        timestamp: Date.now()
      };

      io.to(targetRoom).emit('new_message', botMsg);
    });

    // Server Operator (/oper) Commands for Whitelist & Server Identity Management
    socket.on('peer_admin_command', async (data) => {
      const user = users.get(socket.id);
      const roomId = (data && data.roomId) || (user && user.currentRoom) || '#자유대화';
      const sendSys = (txt) => {
        socket.emit('new_message', {
          id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          roomId,
          type: 'system',
          content: txt,
          timestamp: Date.now()
        });
      };

      if (!user || !user.isServerOper) {
        sendSys('* ⛔ 서버 관리자(/oper) 권한이 필요한 명령어입니다.');
        return;
      }

      let sub = String(data.subCommand || data.subCmd || '').toLowerCase();
      let arg1 = String(data.arg1 || '').trim();
      let arg2 = String(data.arg2 || '').trim();

      if (Array.isArray(data.args)) {
        if (sub === 'peer' || sub === 'extcmd') {
          const action = String(data.args[0] || 'list').toLowerCase();
          sub = `${sub}_${action}`;
          arg1 = String(data.args[1] || '').trim();
          arg2 = data.args.slice(2).join(' ').trim();
        } else {
          arg1 = data.args.join(' ').trim();
        }
      }

      if (sub === 'servername') {
        if (!arg1) {
          sendSys(`* 현재 서버 이름: "${serverConfig.serverName}" (변경: /servername <새이름>)`);
          return;
        }
        serverConfig.serverName = arg1.slice(0, 40);
        saveServerConfig();
        const snap = buildSelfServerSnapshot();
        sendSys(`* ✅ 서버 표시 이름이 "${serverConfig.serverName}"(으)로 변경되었습니다.`);
        io.emit('server_info_updated', snap);
        io.emit('server_info_update', snap);
      } else if (sub === 'serverurl') {
        if (!arg1) {
          sendSys(`* 현재 서버 공식 주소: "${serverConfig.serverUrl}" (변경: /serverurl <https://주소>)`);
          return;
        }
        serverConfig.serverUrl = normalizeServerUrl(arg1);
        saveServerConfig();
        const snap = buildSelfServerSnapshot();
        sendSys(`* ✅ 서버 공식 주소가 "${serverConfig.serverUrl}"(으)로 변경되었습니다.`);
        io.emit('server_info_updated', snap);
        io.emit('server_info_update', snap);
      } else if (sub === 'peer_list') {
        const list = Array.from(whitelistUrls);
        if (list.length === 0) {
          sendSys('* 📋 현재 화이트리스트에 등록된 이웃 서버가 없습니다. (/peer add <https://서버주소> 로 추가)');
        } else {
          const lines = list.map((u, idx) => {
            const entry = networkDirectory.get(u);
            const st = entry ? (entry.isOnline ? '🟢온라인' : '⚪캐시보관중') : '⏳미확인';
            const name = entry ? entry.serverName : extractHostFromUrl(u);
            return `  ${idx + 1}. [${st}] ${name} (${u})`;
          });
          sendSys(`* 📋 화이트리스트 이웃 서버 목록 (${list.length}개):\n` + lines.join('\n'));
        }
      } else if (sub === 'peer_add') {
        const norm = normalizeServerUrl(arg1);
        if (!norm) {
          sendSys('* 사용법: /peer add <https://이웃서버주소>');
          return;
        }
        whitelistUrls.add(norm);
        saveWhitelist();
        sendSys(`* 🔗 화이트리스트에 이웃 서버 [${norm}] 추가 완료! 상태 동기화를 시도합니다...`);
        await syncWithWhitelistedPeers();
        const synced = networkDirectory.get(norm);
        if (synced && synced.isOnline) {
          sendSys(`* ✅ [${synced.serverName}] (${norm}) 서버와 성공적으로 연결되어 공개 채널 ${synced.publicChannels.length}개를 받아왔습니다!`);
        } else {
          sendSys(`* ℹ️ [${norm}] 서버가 화이트리스트에 등록되었습니다. (상대 서버도 내 주소를 화이트리스트에 등록하면 상호 교류됩니다.)`);
        }
      } else if (sub === 'peer_del') {
        const norm = normalizeServerUrl(arg1);
        if (!norm || !whitelistUrls.has(norm)) {
          sendSys('* 해당 주소가 화이트리스트에 없습니다. (/peer list 로 확인)');
          return;
        }
        whitelistUrls.delete(norm);
        networkDirectory.delete(norm);
        saveWhitelist();
        saveNetworkDirectoryDebounced();
        sendSys(`* 🗑️ 화이트리스트에서 [${norm}] 서버를 제거했습니다.`);
      } else if (sub === 'peer_sync') {
        sendSys('* 🔄 화이트리스트 이웃 서버들과 상태 및 공개 채널 수첩을 동기화합니다...');
        await syncWithWhitelistedPeers();
        sendSys(`* ✅ 동기화 완료! (현재 수첩 내 서버: ${getFullDirectoryList().length}개)`);
      } else if (sub === 'extcmd_add') {
        if (!arg1 || !arg2) {
          sendSys('* 사용법: /extcmd add </명령어> <설명 | 봇응답문구> (예: /extcmd add /주사위 주사위 굴리기 | 🎲 $nick님이 주사위를 굴렸습니다! 결과: $rand(1,6))');
          return;
        }
        let cleanCmd = arg1.startsWith('/') ? arg1.slice(1).toLowerCase() : arg1.toLowerCase();
        if (PROTECTED_CORE_COMMANDS.has(cleanCmd)) {
          sendSys(`* ⛔ [/${cleanCmd}] 명령어는 표준 기본 명령어(Core)이므로 서버 확장 명령어로 덮어쓸 수 없습니다. (하위호환 보호)`);
          return;
        }
        const parts = arg2.split('|');
        const desc = (parts[0] || '').trim() || `${serverConfig.serverName} 전용 명령어`;
        const response = (parts.slice(1).join('|') || parts[0] || '').trim();

        if (!Array.isArray(serverConfig.extendedCommands)) serverConfig.extendedCommands = [];
        serverConfig.extendedCommands = serverConfig.extendedCommands.filter(
          (c) => String(c.cmd).replace(/^\//, '').toLowerCase() !== cleanCmd
        );
        serverConfig.extendedCommands.push({
          cmd: '/' + cleanCmd,
          desc,
          usage: '/' + cleanCmd,
          response
        });
        saveServerConfig();
        const snap = buildSelfServerSnapshot();
        io.emit('server_info_updated', snap);
        sendSys(`* ✅ 서버 전용 확장 명령어 [/${cleanCmd}] 등록 완료! (이 서버 접속자에게 자동 고지되며 타 서버에서는 비활성화됩니다.)`);
      } else if (sub === 'extcmd_del') {
        let cleanCmd = arg1.replace(/^\//, '').toLowerCase();
        if (!cleanCmd) {
          sendSys('* 사용법: /extcmd del </명령어>');
          return;
        }
        const before = (serverConfig.extendedCommands || []).length;
        serverConfig.extendedCommands = (serverConfig.extendedCommands || []).filter(
          (c) => String(c.cmd).replace(/^\//, '').toLowerCase() !== cleanCmd
        );
        saveServerConfig();
        const snap = buildSelfServerSnapshot();
        io.emit('server_info_updated', snap);
        sendSys(
          before !== serverConfig.extendedCommands.length
            ? `* 🗑️ 서버 확장 명령어 [/${cleanCmd}] 삭제 완료.`
            : `* 해당 확장 명령어(/${cleanCmd})가 존재하지 않습니다.`
        );
      } else if (sub === 'extcmd_list') {
        const list = serverConfig.extendedCommands || [];
        if (list.length === 0) {
          sendSys('* 현재 등록된 서버 전용 확장 명령어가 없습니다. (/extcmd add </명령어> <설명 | 응답> 으로 추가)');
        } else {
          const lines = list.map((c) => `  • ${c.cmd} : ${c.desc}`);
          sendSys(`* 🧩 [${serverConfig.serverName}] 전용 확장 명령어 목록:\n` + lines.join('\n'));
        }
      }
    });
  }

  return {
    getServerInfo: buildSelfServerSnapshot,
    getFullDirectoryList,
    syncWithWhitelistedPeers,
    registerSocketHandlers,
    PROTECTED_CORE_COMMANDS
  };
}

module.exports = {
  setupPeerDirectoryModule,
  PROTECTED_CORE_COMMANDS
};
