const { io } = require('socket.io-client');
const assert = require('assert');

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
      console.log(`[Socket Connected] id: ${socket.id} (Transport: ${socket.io.engine.transport.name})`);
      socket.emit('user_join', {
        userId,
        nickname,
        avatar: '🐱',
        ...joinData
      });
    });

    socket.on('init_state', (data) => {
      clearTimeout(timeout);
      resolve({ socket, data });
    });

    socket.on('login_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Login Error: ${err.message}`));
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

async function testLiveDomain() {
  console.log(`====================================================`);
  console.log(`🌐 Testing Live Server: ${LIVE_URL}`);
  console.log(`====================================================\n`);

  // Test 1: Connect as Normal User -> lands in #자유대화
  console.log('[Test 1] Regular connect without targetChannel...');
  const normalUser = await createClient('u_live_normal', '라이브유저');
  console.log(`  Current Room: ${normalUser.data.user.currentRoom}`);
  console.log(`  Visible Channels: ${normalUser.data.channels.map(c => c.id).join(', ')}`);
  assert.strictEqual(normalUser.data.user.currentRoom, '#자유대화');
  assert(normalUser.data.channels.some(c => c.id === '#자유대화'));
  console.log('✔ PASS: Standard user successfully connects to #자유대화\n');

  // Test 2: Connect with targetChannel="라이브테스트방" (without '#')
  console.log('[Test 2] Connect with targetChannel="라이브테스트방" (external site simulation)...');
  const targetRoomName = '라이브테스트방';
  const siteUser = await createClient('u_live_site', '사이트유저', { targetChannel: targetRoomName });
  console.log(`  Current Room: ${siteUser.data.user.currentRoom}`);
  const siteChannels = siteUser.data.channels.map(c => c.id);
  console.log(`  Visible Channels: ${siteChannels.join(', ')}`);

  assert.strictEqual(siteUser.data.user.currentRoom, '#라이브테스트방', 'Should auto-normalize with #');
  assert(siteChannels.includes('#라이브테스트방'), 'Must have #라이브테스트방 in channel list');
  assert(!siteChannels.includes('#자유대화'), 'Must NOT have #자유대화 in channel list (자유채널 빠짐)');
  console.log('✔ PASS: External user directly landed in #라이브테스트방 with #자유대화 excluded!\n');

  // Test 3: Messaging in the targeted channel
  console.log('[Test 3] Sending and receiving message in #라이브테스트방...');
  let receivedMsg = null;
  siteUser.socket.on('new_message', (msg) => {
    if (msg.roomId === '#라이브테스트방' && msg.type !== 'system') {
      receivedMsg = msg;
    }
  });

  siteUser.socket.emit('send_message', {
    roomId: '#라이브테스트방',
    content: '라이브 도메인 HTTPS 웹소켓 통신 테스트 성공냥!'
  });

  await wait(600);
  assert(receivedMsg, 'Must receive sent message');
  console.log(`  Received Message: "${receivedMsg.content}" from ${receivedMsg.sender?.nickname}`);
  assert.strictEqual(receivedMsg.content, '라이브 도메인 HTTPS 웹소켓 통신 테스트 성공냥!');
  console.log('✔ PASS: Real-time messaging active and responsive on live domain!\n');

  // Test 4: Verify oper-only protection on live domain
  console.log('[Test 4] Attempting unauthorized join to #관리자 on live domain...');
  const intruder = await createClient('u_live_intruder', '해킹시도자', { targetChannel: '#관리자' });
  console.log(`  Intruder Landed In: ${intruder.data.user.currentRoom}`);
  assert.strictEqual(intruder.data.user.currentRoom, '#자유대화');
  assert(!intruder.data.channels.some(c => c.id === '#관리자'));
  console.log('✔ PASS: Oper channel protection intact on live domain!\n');

  // Clean disconnect
  normalUser.socket.disconnect();
  siteUser.socket.disconnect();
  intruder.socket.disconnect();

  console.log('====================================================');
  console.log('🎉 ALL LIVE DOMAIN TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

testLiveDomain().catch((err) => {
  console.error('\n❌ Live domain test failed:', err);
  process.exit(1);
});
