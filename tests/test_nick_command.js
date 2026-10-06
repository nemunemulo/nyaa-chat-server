const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://127.0.0.1:3000';

function createClient(userId, nickname, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: { 'x-test-client': 'true', ...extraHeaders }
    });

    socket.on('connect', () => {
      socket.emit('user_join', { userId, nickname, avatar: '👤' });
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
  console.log('=== Starting /nick Command Automated Tests ===\n');

  // Test 1: User joins as OldCat and changes to NewCat
  console.log('[Test 1] User changes nickname from OldCat to NewCat...');
  const user1 = await createClient('u_user1', 'OldCat');
  let nickChangedData = null;
  user1.socket.on('nickname_changed', (d) => { nickChangedData = d; });

  user1.socket.emit('change_nickname', { newNickname: 'NewCat' });
  await wait(300);

  assert(nickChangedData, 'Must receive nickname_changed event');
  assert.strictEqual(nickChangedData.nickname, 'NewCat');
  assert.strictEqual(nickChangedData.oldNickname, 'OldCat');
  console.log('✓ PASS: Nickname changed successfully to NewCat');

  // Test 2: Try changing to the same nickname
  console.log('\n[Test 2] Change to same nickname rejected...');
  let sameNickError = null;
  user1.socket.once('nickname_error', (d) => { sameNickError = d.message; });
  user1.socket.emit('change_nickname', { newNickname: 'NewCat' });
  await wait(300);
  assert(sameNickError && sameNickError.includes('동일합니다'), 'Should reject same nickname');
  console.log('✓ PASS: Same nickname rejected with message:', sameNickError);

  // Test 3: Try changing to reserved nickname (냥봇)
  console.log('\n[Test 3] Change to reserved nickname (냥봇) rejected...');
  let reservedError = null;
  user1.socket.once('nickname_error', (d) => { reservedError = d.message; });
  user1.socket.emit('change_nickname', { newNickname: '냥봇' });
  await wait(300);
  assert(reservedError && (reservedError.includes('시스템 전용') || reservedError.includes('예약')), 'Should reject reserved nickname');
  console.log('✓ PASS: Reserved nickname rejected with message:', reservedError);

  // Test 4: Another user tries to take NewCat
  console.log('\n[Test 4] Preemption check: User2 cannot take NewCat...');
  const user2 = await createClient('u_user2', 'OtherCat');
  let takenError = null;
  user2.socket.once('nickname_error', (d) => { takenError = d.message; });
  user2.socket.emit('change_nickname', { newNickname: 'NewCat' });
  await wait(300);
  assert(takenError && takenError.includes('이미 사용하고 있습니다'), 'Should reject taken nickname');
  console.log('✓ PASS: Preempted nickname rejected with message:', takenError);

  // Test 5: Empty nickname rejected
  console.log('\n[Test 5] Empty nickname rejected...');
  let emptyError = null;
  user2.socket.once('nickname_error', (d) => { emptyError = d.message; });
  user2.socket.emit('change_nickname', { newNickname: '   ' });
  await wait(300);
  assert(emptyError && emptyError.includes('입력해 주세요'), 'Should reject empty nickname');
  console.log('✓ PASS: Empty nickname rejected with message:', emptyError);

  // Cleanup
  user1.socket.disconnect();
  user2.socket.disconnect();

  console.log('\n=== ALL /nick TESTS PASSED SUCCESSFULLY! ===\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
