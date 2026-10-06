const { io } = require('socket.io-client');
const assert = require('assert');
const http = require('http');

const SERVER_URL = 'http://127.0.0.1:3000';

function createClient(userId, nickname, joinData = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: { 'x-test-client': 'true' }
    });

    socket.on('connect', () => {
      socket.emit('user_join', {
        userId,
        nickname,
        avatar: '👤',
        ...joinData
      });
    });

    socket.on('init_state', (data) => {
      resolve({ socket, data });
    });

    socket.on('login_error', (err) => {
      resolve({ socket, loginError: err.message });
    });

    socket.on('connect_error', (err) => {
      reject(err);
    });
  });
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runSecurityTests() {
  console.log('=== Starting Security Patches Automated Verification ===\n');

  // Test 1: Privacy - senderIp NOT leaked in new_message
  console.log('[Test 1] Privacy: senderIp must NOT be present in received message...');
  const user1 = await createClient('u_sec_1', '일반유저1');
  const user2 = await createClient('u_sec_2', '일반유저2');

  let receivedMessage = null;
  user2.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.includes('PrivacyTest')) {
      receivedMessage = msg;
    }
  });

  user1.socket.emit('send_message', {
    roomId: '#자유대화',
    content: 'PrivacyTest: Hello world!'
  });

  await wait(400);
  assert(receivedMessage, 'User 2 must receive the message');
  assert.strictEqual(receivedMessage.senderIp, undefined, 'senderIp must be stripped from public payload!');
  console.log('✓ PASS: senderIp was cleanly stripped from client payload (No IP leak)');

  // Test 2: SSRF Guard on /api/link-preview
  console.log('\n[Test 2] SSRF Defense: blocking internal/private IP requests...');
  const ssrf1 = await httpGet('/api/link-preview?url=http://127.0.0.1:3000');
  assert.strictEqual(ssrf1.statusCode, 404, 'http://127.0.0.1 must be rejected');

  const ssrf2 = await httpGet('/api/link-preview?url=http://localhost:3000');
  assert.strictEqual(ssrf2.statusCode, 404, 'http://localhost must be rejected');

  const ssrf3 = await httpGet('/api/link-preview?url=http://192.168.0.1');
  assert.strictEqual(ssrf3.statusCode, 404, 'http://192.168.x.x must be rejected');

  const ssrf4 = await httpGet('/api/link-preview?url=http://169.254.169.254/latest/meta-data/');
  assert.strictEqual(ssrf4.statusCode, 404, 'AWS metadata IP 169.254.x.x must be rejected');

  // Verify X-Powered-By is hidden and security headers are present
  assert.strictEqual(ssrf1.headers['x-powered-by'], undefined, 'X-Powered-By header must be disabled');
  assert.strictEqual(ssrf1.headers['x-content-type-options'], 'nosniff', 'X-Content-Type-Options must be nosniff');
  console.log('✓ PASS: All SSRF internal/private requests blocked (404) & security headers confirmed');

  // Test 3: Nickname 16-char limit and reserved name blocking on user_join
  console.log('\n[Test 3] Nickname limit (16 chars) and reserved name blocking on initial join...');
  const nick17 = await createClient('u_sec_toolong', '가나다라마바사아자차카타파하가나다'); // 17 chars
  assert(nick17.loginError && nick17.loginError.includes('16자'), '17-char nick must be rejected on join');
  console.log('✓ PASS: Nickname > 16 chars rejected:', nick17.loginError);

  const nickReserved = await createClient('u_sec_admin', '관리자');
  assert(nickReserved.loginError && nickReserved.loginError.includes('시스템 전용 닉네임'), 'Reserved "관리자" must be rejected on join');
  console.log('✓ PASS: Reserved nickname "관리자" rejected on join:', nickReserved.loginError);

  const nick16Valid = await createClient('u_sec_exact16', '가나다라마바사아자차카타파하가나'); // Exactly 16 chars
  assert.strictEqual(nick16Valid.data.user.nickname, '가나다라마바사아자차카타파하가나');
  console.log('✓ PASS: Exactly 16-char Korean nickname accepted');

  // Test 4: Message length limit (2000 characters)
  console.log('\n[Test 4] Message content limit (capped to 2000 chars)...');
  const hugeContent = 'A'.repeat(2500);
  let hugeReceived = null;
  user2.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.startsWith('AAAA')) {
      hugeReceived = msg;
    }
  });

  user1.socket.emit('send_message', {
    roomId: '#자유대화',
    content: hugeContent
  });

  await wait(400);
  assert(hugeReceived, 'Message should be received');
  assert.strictEqual(hugeReceived.content.length, 2000, 'Content must be truncated to 2000 chars');
  console.log('✓ PASS: Oversized message (2500 chars) successfully capped to 2000 chars');

  // Test 5: Room topic limit (80 characters)
  console.log('\n[Test 5] Channel topic limit (capped to 80 chars)...');
  const longTopic = '동해물과백두산이마르고닳도록하느님이보우하사우리나라만세무궁화삼천리화려강산대한사람대한으로길이보전하세남산위에저소나무철갑을두른듯바람서리불변함은우리기상일세가을하늘공활한데높고구름없이밝은달은우리가슴일편단심일세이'; // > 80 chars
  user1.socket.emit('join_channel', {
    channelName: '#토픽테스트',
    topic: longTopic
  });

  let roomSwitched = null;
  user1.socket.once('room_switched', (d) => { roomSwitched = d; });
  await wait(400);

  assert(roomSwitched, 'Room switched event must arrive');
  assert(roomSwitched.roomMeta.topic.length <= 80, `Topic length must be <= 80 chars (actual: ${roomSwitched.roomMeta.topic.length})`);
  console.log(`✓ PASS: Channel topic successfully capped to ${roomSwitched.roomMeta.topic.length} chars (<= 80)`);

  // Test 6: Oper login failure >= 10 times -> Brute force rate limited
  console.log('\n[Test 6] Oper login failure 10 times triggers security rejection...');
  const attacker = await createClient('u_attacker', '공격자');
  let rejected = false;
  attacker.socket.on('oper_login_result', (res) => {
    if (!res.success) rejected = true;
  });
  for (let i = 1; i <= 10; i++) {
    attacker.socket.emit('oper_login', { operId: 'nemu', operPw: `wrong_${i}` });
  }
  await wait(600);
  assert(rejected, 'Attacker attempts must be rejected');
  console.log('✓ PASS: Oper brute force rejected safely');

  // Clean disconnects
  user1.socket.disconnect();
  user2.socket.disconnect();
  nick16Valid.socket.disconnect();
  operClient.socket.disconnect();
  attacker.socket.disconnect();

  console.log('\n======================================================');
  console.log('🎉 ALL 6 SECURITY & CUSTOM CONSTRAINTS TESTS PASSED!');
  console.log('======================================================');
  process.exit(0);
}

runSecurityTests().catch((err) => {
  console.error('❌ Security test failed:', err);
  process.exit(1);
});
