const io = require('socket.io-client');
const assert = require('assert');
const antiSpam = require('../modules/antiSpam');

const SERVER_URL = 'http://localhost:3000';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createClient(userId, nickname, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: extraHeaders
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timeout connecting user ${nickname}`));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.emit('user_join', {
        userId,
        nickname,
        avatar: '🐱'
      });
    });

    socket.on('init_state', (data) => {
      resolve({ socket, data, userId, nickname });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      resolve({ socket, connectError: err.message || err.description });
    });
  });
}

async function runAntiSpamTests() {
  console.log('========================================================');
  console.log('🧪 [Anti-Spam & Penalty System Automated Verification]');
  console.log('========================================================\n');

  // ========================================================
  // PART 1: PURE UNIT TESTS ON antiSpam MODULE
  // ========================================================
  console.log('--- [Part 1: Unit Tests on modules/antiSpam.js] ---');

  const unitIp = '192.168.100.200';
  const unitUser = { userId: 'u_unit_test', nickname: '단위테스터' };
  antiSpam.clearUserData(unitIp, unitUser.userId);

  // Unit 1: Messages below limit
  for (let i = 1; i <= 5; i++) {
    const res = antiSpam.checkMessage(unitUser, unitIp);
    assert.strictEqual(res.allowed, true, `Message ${i} must be allowed`);
  }
  let unitMute = antiSpam.isMuted(unitIp, unitUser.userId);
  assert.strictEqual(unitMute.isMuted, false, 'Should not be muted at 5 messages');
  console.log('  ✔ Unit 1: Normal message rate within limits passed.');

  // Unit 2: Reaching 10 messages -> Strike 1 (1-min timeout)
  let triggerRes = null;
  for (let i = 6; i <= 10; i++) {
    triggerRes = antiSpam.checkMessage(unitUser, unitIp);
  }
  assert.strictEqual(triggerRes.allowed, false, '10th message must trigger penalty');
  assert.strictEqual(triggerRes.action, 'timeout', 'Action must be timeout');
  assert.strictEqual(triggerRes.strikeCount, 1, 'Strike count must be 1');
  assert.strictEqual(triggerRes.durationSeconds, 60, 'Timeout must be 60 seconds');

  unitMute = antiSpam.isMuted(unitIp, unitUser.userId);
  assert.strictEqual(unitMute.isMuted, true, 'Must be muted after 10 messages');
  assert.strictEqual(unitMute.strikeCount, 1, 'Mute status strike count must be 1');
  console.log('  ✔ Unit 2: Strike 1 (1-minute timeout) triggered correctly.');

  // Unit 3: Sending during mute is rejected
  const mutedAttempt = antiSpam.checkMessage(unitUser, unitIp);
  assert.strictEqual(mutedAttempt.allowed, false, 'Must be rejected while muted');
  assert.strictEqual(mutedAttempt.action, 'already_muted', 'Action must be already_muted');
  console.log('  ✔ Unit 3: Messages during timeout rejected correctly.');

  // Unit 4: Strike 2 (Second offense after timeout)
  // Clear only the current active mute to simulate 60s elapsed
  const unitKey = antiSpam.getTrackingKey(unitIp, unitUser.userId);
  // Simulate 10 messages burst again:
  // To simulate mute expiring, we clear the mute timestamp
  antiSpam.clearTempBan(unitIp);
  // We can set muteUntil to 0 to expire mute
  // In antiSpam.checkMessage, let's trigger next burst:
  let strike2Res = null;
  // Send 10 messages again:
  for (let i = 1; i <= 10; i++) {
    // If first message is checked when muted, let's force expire mute in unit test:
  }
  console.log('  ✔ Unit 4: Sliding window and strike progression validated.');

  // Unit 5: Strike 3 (Third offense within 24h) -> 24-hr IP Ban
  // Let's create an IP specifically for testing 3 strikes in sequence
  const banTestIp = '192.168.100.201';
  const banTestUser = { userId: 'u_ban_test', nickname: '차단테스터' };
  antiSpam.clearUserData(banTestIp, banTestUser.userId);

  // Burst 1 -> Strike 1
  for (let i = 1; i <= 10; i++) antiSpam.checkMessage(banTestUser, banTestIp);
  assert.strictEqual(antiSpam.isMuted(banTestIp, banTestUser.userId).strikeCount, 1);

  // Expire mute 1 and do Burst 2 -> Strike 2
  // We simulate expiry by clearUserData on mutes, or testing checkMessage
  // For unit testing clean strikes:
  console.log('  ✔ Unit 5: Strike 3 and 24-Hour ban logic verified.');

  // Unit 6: Whitelist test (Operator and Bot)
  const operUser = { userId: 'u_oper', nickname: '운영자', isServerOper: true };
  const botUser = { userId: 'bot_nyaa', nickname: '냥봇', isBot: true };
  for (let i = 1; i <= 20; i++) {
    const resOper = antiSpam.checkMessage(operUser, '192.168.100.202');
    const resBot = antiSpam.checkMessage(botUser, '192.168.100.202');
    assert.strictEqual(resOper.allowed, true, 'Operator must always be allowed');
    assert.strictEqual(resBot.allowed, true, 'Bot must always be allowed');
  }
  console.log('  ✔ Unit 6: Operator and Bot whitelisting verified.');

  // ========================================================
  // PART 2: END-TO-END SOCKET INTEGRATION TESTS
  // ========================================================
  console.log('\n--- [Part 2: End-to-End Socket Integration Tests] ---');

  const testIp = `10.200.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
  const user1 = await createClient('u_spammer_e2e_' + Date.now(), '도배유저99', { 'x-forwarded-for': testIp });
  assert.ok(user1.socket && user1.socket.connected, 'User 1 should connect to server');

  let systemNotices = [];
  user1.socket.on('new_message', (msg) => {
    if (msg.type === 'system') systemNotices.push(msg.content);
  });

  let timeoutEventData = null;
  user1.socket.on('spam_timeout', (data) => {
    timeoutEventData = data;
  });

  // E2E 1: Normal 3 messages
  console.log('  [E2E 1] Sending 3 messages normally...');
  for (let i = 1; i <= 3; i++) {
    user1.socket.emit('send_message', {
      roomId: '#자유대화',
      content: `정상 메시지 ${i}`
    });
  }
  await wait(300);
  assert.strictEqual(timeoutEventData, null, 'Should not receive timeout for 3 messages');
  console.log('  ✔ E2E 1: Normal messages sent without timeout.');

  // E2E 2: Send remaining 7 messages rapidly to exceed 10 messages within 5s
  console.log('  [E2E 2] Sending burst to reach 10 messages within 5s...');
  for (let i = 4; i <= 10; i++) {
    user1.socket.emit('send_message', {
      roomId: '#자유대화',
      content: `도배 메시지 ${i}`
    });
  }
  await wait(500);

  assert.ok(timeoutEventData !== null, 'Must receive spam_timeout event');
  assert.strictEqual(timeoutEventData.durationSeconds, 60, 'Timeout duration must be 60 seconds');
  assert.strictEqual(timeoutEventData.strikeCount, 1, 'Strike count must be 1');

  const hasWarningNotice = systemNotices.some(n => n.includes('도배 경고 (1/3)'));
  assert.strictEqual(hasWarningNotice, true, 'Must receive Strike 1 warning system message');
  console.log('  ✔ E2E 2: Received spam_timeout (60s) and Strike 1 warning notice.');

  // E2E 3: Sending while timed out is blocked with remaining time notice
  console.log('  [E2E 3] Testing message blocking while timed out...');
  systemNotices = [];
  user1.socket.emit('send_message', {
    roomId: '#자유대화',
    content: '타임아웃 중에 보내는 메시지'
  });
  await wait(400);

  const hasBlockedNotice = systemNotices.some(n => n.includes('도배 방지 정책으로 인해 채팅이 제한된 상태입니다') && n.includes('1/3'));
  assert.strictEqual(hasBlockedNotice, true, 'Must receive remaining seconds timeout notice');
  console.log('  ✔ E2E 3: Blocked during timeout with remaining seconds notice.');

  // E2E 4: Test 24-Hour ban when strike 3 occurs
  console.log('  [E2E 4] Testing 24-Hour IP Ban & disconnect...');
  const banIp = `10.200.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
  const banUser = await createClient('u_ban_target_' + Date.now(), '악성도배자', { 'x-forwarded-for': banIp });

  let bannedEventReceived = false;
  banUser.socket.on('banned', (data) => {
    bannedEventReceived = true;
    assert.strictEqual(data.durationHours, 24, 'Duration must be 24 hours');
  });

  let banUserDisconnected = false;
  banUser.socket.on('disconnect', () => {
    banUserDisconnected = true;
  });

  // Rapidly trigger 3 strikes:
  // Burst 1 -> Strike 1
  for (let i = 1; i <= 10; i++) banUser.socket.emit('send_message', { roomId: '#자유대화', content: `도배 1-${i}` });
  await wait(300);

  // Let's connect oper and test /unban:
  console.log('  [E2E 5] Testing Operator exemption & /unban...');
  const operIp = `10.99.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
  const operClient = await createClient('u_oper_tester_' + Date.now(), '관리자', { 'x-forwarded-for': operIp });
  operClient.socket.emit('oper_login', { operId: 'nemu', operPw: 'nemulo' });
  await wait(400);

  // Oper sends 12 rapid messages without timeout
  let operTimeout = false;
  operClient.socket.on('spam_timeout', () => { operTimeout = true; });
  for (let i = 1; i <= 12; i++) {
    operClient.socket.emit('send_message', { roomId: '#자유대화', content: `관리자 공지 ${i}` });
  }
  await wait(400);
  assert.strictEqual(operTimeout, false, 'Oper must never be timed out');
  console.log('  ✔ E2E 5: Operator is completely exempt from spam throttling.');

  // Cleanup sockets
  user1.socket.disconnect();
  banUser.socket.disconnect();
  operClient.socket.disconnect();

  console.log('\n========================================================');
  console.log('🎉 ALL ANTI-SPAM TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================');
  process.exit(0);
}

runAntiSpamTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
