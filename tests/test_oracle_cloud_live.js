const { io } = require('socket.io-client');
const assert = require('assert');
const https = require('https');

const LIVE_URL = 'https://nemulo.duckdns.org';

function createClient(userId, nickname, joinData = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(LIVE_URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: false,
      extraHeaders: { 'x-test-client': 'true' }
    });

    const timeout = setTimeout(() => {
      reject(new Error(`Connection timeout to ${LIVE_URL}`));
    }, 10000);

    socket.on('connect', () => {
      socket.emit('user_join', {
        userId,
        nickname,
        avatar: '☁️',
        ...joinData
      });
    });

    socket.on('init_state', (data) => {
      clearTimeout(timeout);
      resolve({ socket, data });
    });

    socket.on('login_error', (err) => {
      clearTimeout(timeout);
      resolve({ socket, loginError: err.message });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function httpsGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`${LIVE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function testOracleCloudLive() {
  console.log(`========================================================`);
  console.log(`☁️  Testing Oracle Cloud Live Infrastructure: ${LIVE_URL}`);
  console.log(`========================================================\n`);

  // Test 1: HTTP Security Headers
  console.log('[Test 1] Inspecting HTTP Security Headers on Oracle Cloud...');
  const rootRes = await httpsGet('/');
  assert.strictEqual(rootRes.headers['x-powered-by'], undefined, 'X-Powered-By must be hidden');
  assert.strictEqual(rootRes.headers['x-content-type-options'], 'nosniff', 'X-Content-Type-Options must be nosniff');
  assert.strictEqual(rootRes.headers['content-security-policy'], 'frame-ancestors *', 'frame-ancestors * must be set for iframe embedding');
  assert.strictEqual(rootRes.headers['referrer-policy'], 'strict-origin-when-cross-origin', 'Referrer-Policy must be strict-origin-when-cross-origin');
  console.log('✓ PASS: Security headers (CSP, nosniff, no-server-banner) perfectly active on Oracle Cloud!\n');

  // Test 2: OCI Instance Metadata SSRF Attack Block (169.254.169.254)
  console.log('[Test 2] OCI Metadata SSRF Defense (http://169.254.169.254/opc/v1/instance/)...');
  const ociMeta = await httpsGet('/api/link-preview?url=http://169.254.169.254/opc/v1/instance/');
  assert.strictEqual(ociMeta.statusCode, 404, 'OCI metadata must return 404/blocked');
  const localMeta = await httpsGet('/api/link-preview?url=http://127.0.0.1:3000/');
  assert.strictEqual(localMeta.statusCode, 404, 'Localhost probe must return 404/blocked');
  console.log('✓ PASS: Oracle Cloud instance metadata & loopback SSRF completely blocked (404)!\n');

  // Test 3: Nickname 16-char limit and reserved name blocking on Live Server
  console.log('[Test 3] Nickname validation on Oracle Cloud live server...');
  const nick17 = await createClient('u_oci_toolong', '가나다라마바사아자차카타파하가나다'); // 17 chars
  assert(nick17.loginError && nick17.loginError.includes('16자'), '17-char nick must be rejected on live server');
  console.log('  ✔ Nickname > 16 chars rejected:', nick17.loginError);

  const nickReserved = await createClient('u_oci_admin', '관리자');
  assert(nickReserved.loginError && nickReserved.loginError.includes('시스템 전용 닉네임'), 'Reserved "관리자" must be rejected on live server');
  console.log('  ✔ Reserved nickname "관리자" rejected:', nickReserved.loginError);

  const nick16Valid = await createClient('u_oci_exact16', '오라클클라우드테스트계정입니다'); // Exactly 16 chars
  assert.strictEqual(nick16Valid.data.user.nickname, '오라클클라우드테스트계정입니다');
  console.log('✓ PASS: 16-char validation & reserved name blocking confirmed on Oracle Cloud!\n');

  // Test 4: URL Channel Auto-Join (?channel=오라클라이브) without #자유대화
  console.log('[Test 4] Connecting with targetChannel="오라클라이브" (external iframe simulation)...');
  const siteUser1 = await createClient('u_oci_site1', '클라우드유저1', { targetChannel: '오라클라이브' });
  const siteUser2 = await createClient('u_oci_site2', '클라우드유저2', { targetChannel: '#오라클라이브' });

  assert.strictEqual(siteUser1.data.user.currentRoom, '#오라클라이브');
  assert.strictEqual(siteUser2.data.user.currentRoom, '#오라클라이브');

  const visibleChannels = siteUser1.data.channels.map(c => c.id);
  console.log(`  User Room: ${siteUser1.data.user.currentRoom}`);
  console.log(`  Visible Channels in Sidebar: ${visibleChannels.join(', ')}`);
  assert(visibleChannels.includes('#오라클라이브'), 'Must include #오라클라이브');
  assert(!visibleChannels.includes('#자유대화'), 'Must NOT include #자유대화 (자유채널 제외)');
  console.log('✓ PASS: Channel auto-created and isolated from #자유대화 on Oracle Cloud!\n');

  // Test 5: Live Real-time Messaging and IP Privacy
  console.log('[Test 5] Real-time messaging and IP privacy leak check...');
  let liveReceivedMsg = null;
  siteUser2.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.includes('OCI_TEST')) {
      liveReceivedMsg = msg;
    }
  });

  siteUser1.socket.emit('send_message', {
    roomId: '#오라클라이브',
    content: 'OCI_TEST: Oracle Cloud live deployment is fully working!'
  });

  await wait(800);
  assert(liveReceivedMsg, 'User 2 must receive live message');
  console.log(`  Received Message Content: "${liveReceivedMsg.content}"`);
  console.log(`  Received Message senderIp: ${liveReceivedMsg.senderIp}`);
  assert.strictEqual(liveReceivedMsg.senderIp, undefined, 'senderIp must be stripped over the internet!');
  console.log('✓ PASS: Real-time messaging confirmed and sender IP address is completely protected!\n');

  // Test 6: Message length cap (2000 chars) on Live Server
  console.log('[Test 6] Oversized message length truncation on Oracle Cloud...');
  const oversizedText = 'OCI_' + 'Z'.repeat(2400);
  let oversizedReceived = null;
  siteUser2.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.startsWith('OCI_ZZZZ')) {
      oversizedReceived = msg;
    }
  });

  siteUser1.socket.emit('send_message', {
    roomId: '#오라클라이브',
    content: oversizedText
  });

  await wait(800);
  assert(oversizedReceived, 'Oversized message must be received');
  assert.strictEqual(oversizedReceived.content.length, 2000, 'Content must be capped to 2000 chars');
  console.log('✓ PASS: Oversized message (2404 chars) was safely capped to exactly 2000 chars!\n');

  // Clean disconnect
  nick16Valid.socket.disconnect();
  siteUser1.socket.disconnect();
  siteUser2.socket.disconnect();

  console.log(`========================================================`);
  console.log(`🎉 ALL ORACLE CLOUD LIVE PRODUCTION TESTS PASSED!`);
  console.log(`========================================================`);
  process.exit(0);
}

testOracleCloudLive().catch((err) => {
  console.error('\n❌ Oracle Cloud test failed:', err);
  process.exit(1);
});
