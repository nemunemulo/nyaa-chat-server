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
  console.log('--- Starting Oper, Kick, Ban & Bot Always-Op Tests ---');

  // Test 1: NyaaBot has op in #자유대화
  console.log('\n[Test 1] Checking NyaaBot op in #자유대화...');
  const alice = await createClient('u_alice', 'Alice');
  const freeCh = alice.data.channels.find(c => c.id === '#자유대화');
  assert(freeCh, '#자유대화 must exist');
  assert(freeCh.operators.includes('bot_nyaa'), 'bot_nyaa must be in #자유대화 operators');
  console.log('✓ PASS: NyaaBot is an operator in #자유대화');

  // Test 2: NyaaBot has op in newly created custom channel
  console.log('\n[Test 2] User creates #gaming channel...');
  alice.socket.emit('join_channel', { channelName: '#gaming', topic: 'Game talk' });
  await wait(300);

  const bob = await createClient('u_bob', 'Bob');
  bob.socket.emit('join_channel', { channelName: '#gaming' });
  await wait(300);

  // Check channel operators for #gaming
  let gamingOperators = null;
  bob.socket.on('channel_operators_update', (data) => {
    if (data.roomId === '#gaming') gamingOperators = data.operators;
  });
  // Alice grants op or checks
  alice.socket.emit('switch_room', { targetType: 'channel', targetId: '#gaming' });
  await wait(300);

  // Test 3: Oper login failure & success
  console.log('\n[Test 3] Testing /oper login...');
  let operFailed = false;
  alice.socket.once('oper_failed', () => { operFailed = true; });
  alice.socket.emit('oper_login', { operId: 'nemu', operPw: 'wrongpassword' });
  await wait(200);
  assert(operFailed, 'Wrong password must fail oper login');
  console.log('✓ PASS: Wrong password rejected');

  let operSuccess = false;
  alice.socket.once('oper_success', () => { operSuccess = true; });
  alice.socket.emit('oper_login', { operId: 'nemu', operPw: 'nemulo' });
  await wait(200);
  assert(operSuccess, 'Correct password must succeed oper login');
  console.log('✓ PASS: /oper nemu nemulo succeeded');

  // Test 4: Oper can grant op in service channel (#자유대화)
  console.log('\n[Test 4] Oper grants op to Bob in #자유대화...');
  alice.socket.emit('switch_room', { targetType: 'channel', targetId: '#자유대화' });
  bob.socket.emit('switch_room', { targetType: 'channel', targetId: '#자유대화' });
  await wait(200);

  let freeOpUpdate = null;
  alice.socket.on('channel_operators_update', (d) => {
    if (d.roomId === '#자유대화') freeOpUpdate = d.operators;
  });
  alice.socket.emit('grant_op', { roomId: '#자유대화', targetNickname: 'Bob' });
  await wait(300);
  assert(freeOpUpdate && freeOpUpdate.includes('u_bob'), 'Bob should have received op in #자유대화');
  console.log('✓ PASS: Oper granted op to Bob in #자유대화:', freeOpUpdate);

  // Test 5: Kick user from channel
  console.log('\n[Test 5] Testing /kick in #gaming channel...');
  alice.socket.emit('switch_room', { targetType: 'channel', targetId: '#gaming' });
  bob.socket.emit('switch_room', { targetType: 'channel', targetId: '#gaming' });
  await wait(300);

  let kickedReceived = false;
  bob.socket.once('kicked_from_channel', (data) => {
    kickedReceived = true;
    console.log('Bob received kick notification:', data);
  });

  alice.socket.emit('kick_user', { roomId: '#gaming', targetNickname: 'Bob', reason: '테스트 강퇴' });
  await wait(400);
  assert(kickedReceived, 'Bob must receive kicked_from_channel event');
  console.log('✓ PASS: Bob was kicked from #gaming');

  // Test 6: Cannot kick NyaaBot
  console.log('\n[Test 6] Testing kick immunity for NyaaBot...');
  let botKickError = null;
  const msgHandler = (msg) => {
    if (msg.content && msg.content.includes('냥봇은 채널에서 강퇴할 수 없습니다')) {
      botKickError = msg.content;
    }
  };
  alice.socket.on('new_message', msgHandler);
  alice.socket.emit('kick_user', { roomId: '#gaming', targetNickname: '냥봇', reason: '강퇴 시도' });
  await wait(300);
  alice.socket.off('new_message', msgHandler);
  assert(botKickError, 'Server must reject kicking NyaaBot');
  console.log('✓ PASS: NyaaBot cannot be kicked:', botKickError);

  // Test 7: Oper /ban with external IP (using x-forwarded-for header)
  console.log('\n[Test 7] Testing Oper /ban on Charlie (IP: 203.0.113.195)...');
  const TEST_BAN_IP = '203.0.113.195';
  const charlie = await createClient('u_charlie', 'Charlie', { 'x-forwarded-for': TEST_BAN_IP });
  await wait(200);

  let charlieBanned = false;
  charlie.socket.once('banned', (data) => {
    charlieBanned = true;
    console.log('Charlie received banned event:', data);
  });

  alice.socket.emit('ban_user', { targetNickname: 'Charlie', reason: '테스트 영구 차단' });
  await wait(400);
  assert(charlieBanned, 'Charlie must receive banned event');
  console.log('✓ PASS: Charlie was banned and disconnected');

  // Test 8: Reconnection attempt with banned IP fails
  console.log('\n[Test 8] Banned IP connection rejection...');
  try {
    await createClient('u_charlie2', 'Charlie2', { 'x-forwarded-for': TEST_BAN_IP });
    assert.fail('Banned IP should have been rejected');
  } catch (err) {
    console.log('Connection rejected as expected:', err.message);
    assert(err.message === 'BANNED_IP' || err.message.includes('BANNED_IP'), 'Must reject with BANNED_IP');
    console.log('✓ PASS: Banned IP cannot reconnect');
  }

  // Test 9: Loopback protection (cannot ban 127.0.0.1 / Bob)
  console.log('\n[Test 9] Loopback protection...');
  let loopbackProtected = false;
  alice.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.includes('로컬 루프백 IP')) {
      loopbackProtected = true;
    }
  });
  alice.socket.emit('ban_user', { targetNickname: 'Bob', reason: '로컬호스트 차단 시도' });
  await wait(300);
  assert(loopbackProtected, 'Server must protect loopback IP from ban');
  console.log('✓ PASS: Loopback IP is protected from being banned');

  // Test 10: Oper /unban
  console.log('\n[Test 10] Testing Oper /unban...');
  alice.socket.emit('unban_ip', { targetIp: TEST_BAN_IP });
  await wait(300);
  const unbannedClient = await createClient('u_charlie_back', 'CharlieBack', { 'x-forwarded-for': TEST_BAN_IP });
  assert(unbannedClient && unbannedClient.socket.connected, 'Unbanned IP should connect successfully');
  unbannedClient.socket.disconnect();
  console.log('✓ PASS: IP was unbanned and reconnected successfully');

  // Cleanup: remove banned_ips.json
  const fs = require('fs');
  const path = require('path');
  const banFile = path.join(__dirname, '..', 'data', 'banned_ips.json');
  try {
    if (fs.existsSync(banFile)) fs.unlinkSync(banFile);
  } catch (e) {}

  // Cleanup: disconnect sockets
  alice.socket.disconnect();
  bob.socket.disconnect();

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
