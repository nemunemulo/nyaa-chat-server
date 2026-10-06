const { io } = require('socket.io-client');
const assert = require('assert');

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

    socket.on('connect_error', (err) => {
      reject(err);
    });
  });
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTests() {
  console.log('=== Starting URL Direct Channel Join Automated Tests ===\n');

  // Test 1: Normal user connects without targetChannel
  console.log('[Test 1] User without targetChannel joins #자유대화 by default...');
  const normalUser = await createClient('u_normal_1', 'NormalUser1');
  assert.strictEqual(normalUser.data.user.currentRoom, '#자유대화', 'Default room must be #자유대화');
  const normalChs = normalUser.data.channels.map(c => c.id);
  assert(normalChs.includes('#자유대화'), 'Default channel list must include #자유대화');
  console.log('✓ PASS: Normal user landed in #자유대화, channels:', normalChs);

  // Test 2: External Site A user connects with targetChannel = '사이트A'
  console.log('\n[Test 2] Site A user connects with targetChannel="사이트A" (without "#")...');
  const siteAUser = await createClient('u_sitea_1', 'SiteAUser', { targetChannel: '사이트A' });
  assert.strictEqual(siteAUser.data.user.currentRoom, '#사이트A', 'Target room must normalize to #사이트A');
  const siteAChs = siteAUser.data.channels.map(c => c.id);
  assert(siteAChs.includes('#사이트A'), 'Channels must include #사이트A');
  assert(!siteAChs.includes('#자유대화'), 'Channels must NOT include #자유대화 (자유채널 빠짐)');
  console.log('✓ PASS: Site A user landed directly in #사이트A without #자유대화! Channels:', siteAChs);

  // Test 3: External Site B user connects with targetChannel = '#사이트B'
  console.log('\n[Test 3] Site B user connects with targetChannel="#사이트B"...');
  const siteBUser = await createClient('u_siteb_1', 'SiteBUser', { targetChannel: '#사이트B' });
  assert.strictEqual(siteBUser.data.user.currentRoom, '#사이트B');
  const siteBChs = siteBUser.data.channels.map(c => c.id);
  assert(siteBChs.includes('#사이트B'), 'Channels must include #사이트B');
  assert(!siteBChs.includes('#자유대화'), 'Channels must NOT include #자유대화');
  assert(!siteBChs.includes('#사이트A'), 'Channels must NOT include #사이트A');
  console.log('✓ PASS: Site B user landed directly in #사이트B isolated from Site A and #자유대화');

  // Test 4: Message isolation between Site A and Site B
  console.log('\n[Test 4] Message delivery isolation between Site A and Site B...');
  let siteBReceivedMsg = false;
  let siteAReceivedMsg = null;

  siteBUser.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.includes('Hello Site A')) {
      siteBReceivedMsg = true;
    }
  });

  // Second user joins Site A
  const siteAUser2 = await createClient('u_sitea_2', 'SiteAUser2', { targetChannel: '#사이트A' });
  siteAUser2.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.includes('Hello Site A')) {
      siteAReceivedMsg = msg;
    }
  });

  siteAUser.socket.emit('send_message', {
    roomId: '#사이트A',
    content: 'Hello Site A room members!'
  });

  await wait(400);

  assert(siteAReceivedMsg, 'Site A member must receive the message');
  assert(!siteBReceivedMsg, 'Site B member must NOT receive Site A message');
  console.log('✓ PASS: Message correctly scoped to #사이트A without leaking to #사이트B');

  // Test 5: Oper-only channel protection (#관리자)
  console.log('\n[Test 5] Attempt to directly join protected oper channel (#관리자) via targetChannel...');
  const intruder = await createClient('u_intruder', 'Intruder', { targetChannel: '#관리자' });
  assert.strictEqual(intruder.data.user.currentRoom, '#자유대화', 'Direct entry to #관리자 must fallback to #자유대화');
  const intruderChs = intruder.data.channels.map(c => c.id);
  assert(!intruderChs.includes('#관리자'), 'Non-oper must not have #관리자 in channel list');
  console.log('✓ PASS: Unauthorized access to #관리자 blocked, safely fallback to #자유대화');

  // Cleanup
  normalUser.socket.disconnect();
  siteAUser.socket.disconnect();
  siteAUser2.socket.disconnect();
  siteBUser.socket.disconnect();
  intruder.socket.disconnect();

  console.log('\n========================================');
  console.log('🎉 ALL 5 TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
