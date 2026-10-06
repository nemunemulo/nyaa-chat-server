const { io } = require('socket.io-client');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
  console.log('=== Starting /banlist and /unban (Nickname & IP) Tests ===\n');

  const banFile = path.join(__dirname, '..', 'data', 'banned_ips.json');
  try {
    if (fs.existsSync(banFile)) fs.unlinkSync(banFile);
  } catch (e) {}

  // 1. Normal user (non-oper) attempting /banlist & /unban
  console.log('[Test 1] Non-oper executing /banlist and /unban...');
  const user1 = await createClient('u_user1', 'NormalUser', { 'x-forwarded-for': '198.51.100.1' });
  let nonOperBanlistError = false;
  let nonOperUnbanError = false;

  user1.socket.on('new_message', (msg) => {
    if (msg.content && msg.content.includes('/banlist 명령어는 서버 관리자')) {
      nonOperBanlistError = true;
    }
    if (msg.content && msg.content.includes('/unban 명령어는 서버 관리자')) {
      nonOperUnbanError = true;
    }
  });

  user1.socket.emit('get_banlist');
  user1.socket.emit('unban_ip', { target: 'Someone' });
  await wait(300);

  assert(nonOperBanlistError, 'Non-oper must be rejected from /banlist');
  assert(nonOperUnbanError, 'Non-oper must be rejected from /unban');
  console.log('✓ PASS: Non-oper cannot run /banlist or /unban');

  // 2. Admin connects and logs in as Server Oper
  console.log('\n[Test 2] Admin login via /oper nemu nemulo...');
  const admin = await createClient('u_admin', 'AdminNemu', { 'x-forwarded-for': '198.51.100.2' });
  let operSuccess = false;
  admin.socket.once('oper_success', () => { operSuccess = true; });
  admin.socket.emit('oper_login', { operId: 'nemu', operPw: 'nemulo' });
  await wait(300);
  assert(operSuccess, 'Admin /oper login must succeed');
  console.log('✓ PASS: Admin authenticated as Server Oper');

  // 3. /banlist when empty
  console.log('\n[Test 3] Admin checks /banlist when empty...');
  let banlistResult = null;
  admin.socket.once('banlist_result', (data) => { banlistResult = data; });
  admin.socket.emit('get_banlist');
  await wait(300);
  assert(banlistResult, 'Admin must receive banlist_result');
  assert.strictEqual(banlistResult.totalCount, 0, 'Total bans should be 0');
  assert(banlistResult.formattedText.includes('현재 차단된 IP 또는 사용자가 없습니다'), 'Should show empty message');
  console.log('✓ PASS: Empty /banlist displayed correctly');

  // 4. Ban a user and check /banlist
  console.log('\n[Test 4] Ban BadGuy (IP: 198.51.100.50) and verify metadata in /banlist...');
  const badGuy = await createClient('u_badguy', 'BadGuy', { 'x-forwarded-for': '198.51.100.50' });
  await wait(200);

  let badGuyBanned = false;
  badGuy.socket.once('banned', () => { badGuyBanned = true; });
  admin.socket.emit('ban_user', { targetNickname: 'BadGuy', reason: '욕설 및 분란 조장' });
  await wait(400);
  assert(badGuyBanned, 'BadGuy must receive banned event');

  banlistResult = null;
  admin.socket.once('banlist_result', (data) => { banlistResult = data; });
  admin.socket.emit('get_banlist');
  await wait(300);

  assert(banlistResult, 'Admin must receive banlist_result');
  assert.strictEqual(banlistResult.totalCount, 1, 'Total bans should be 1');
  assert.strictEqual(banlistResult.permBans.length, 1, 'permBans length should be 1');
  const banEntry = banlistResult.permBans[0];
  assert.strictEqual(banEntry.ip, '198.51.100.50');
  assert.strictEqual(banEntry.nickname, 'BadGuy');
  assert.strictEqual(banEntry.reason, '욕설 및 분란 조장');
  assert(banlistResult.formattedText.includes('BadGuy'), 'Box output should include BadGuy');
  assert(banlistResult.formattedText.includes('198.51.100.50'), 'Box output should include IP');
  console.log('✓ PASS: /banlist shows permanent ban with nickname, IP, and reason');

  // 5. Unban by Nickname: /unban BadGuy
  console.log('\n[Test 5] Unban BadGuy by Nickname (/unban BadGuy)...');
  let unbanMsg = null;
  const adminMsgHandler = (msg) => {
    if (msg.content && msg.content.includes('차단이 정상 해제되었습니다')) {
      unbanMsg = msg.content;
    }
  };
  admin.socket.on('new_message', adminMsgHandler);
  admin.socket.emit('unban_ip', { target: 'BadGuy' });
  await wait(400);
  admin.socket.off('new_message', adminMsgHandler);

  assert(unbanMsg, 'Admin should receive unban confirmation');
  assert(unbanMsg.includes('BadGuy'), 'Unban confirmation should mention nickname');
  assert(unbanMsg.includes('198.51.100.50'), 'Unban confirmation should mention IP');
  console.log('✓ PASS: /unban BadGuy resolved IP and unbanned successfully:', unbanMsg);

  // Verify BadGuy IP can connect again
  const badGuyReconnected = await createClient('u_badguy_2', 'BadGuyReborn', { 'x-forwarded-for': '198.51.100.50' });
  assert(badGuyReconnected && badGuyReconnected.socket.connected, 'BadGuy should be able to reconnect');
  badGuyReconnected.socket.disconnect();
  console.log('✓ PASS: Formerly banned user reconnected successfully');

  // 6. Test Unbanning Anti-Spam Temporary Ban by Nickname
  console.log('\n[Test 6] Anti-Spam Temporary Ban & unban by nickname...');
  const spammer = await createClient('u_spammer', 'SpamCat', { 'x-forwarded-for': '198.51.100.77' });
  await wait(200);

  // Fast spam in loop to trigger timeout and 3 strikes (24h ban)
  for (let round = 1; round <= 3; round++) {
    for (let i = 1; i <= 10; i++) {
      spammer.socket.emit('send_message', {
        roomId: '#자유대화',
        content: `Spam line ${round}-${i}`
      });
    }
    await wait(200);
    if (round < 3) {
      spammer.socket.emit('test_clear_mute');
      await wait(100);
    }
  }
  await wait(500);

  // Check /banlist for temp_spam
  banlistResult = null;
  admin.socket.once('banlist_result', (data) => { banlistResult = data; });
  admin.socket.emit('get_banlist');
  await wait(300);

  assert(banlistResult, 'Admin must receive banlist_result');
  const tempEntry = banlistResult.tempBans.find(t => t.ip === '198.51.100.77');
  assert(tempEntry, 'Temp ban for 198.51.100.77 should be in banlist');
  assert.strictEqual(tempEntry.nickname, 'SpamCat', 'Temp ban entry must have nickname SpamCat');
  console.log('✓ PASS: Anti-spam temp ban is registered in /banlist:', tempEntry);

  // Unban SpamCat by Nickname
  console.log('\n[Test 7] Unban SpamCat by Nickname (/unban SpamCat)...');
  unbanMsg = null;
  admin.socket.on('new_message', adminMsgHandler);
  admin.socket.emit('unban_ip', { target: 'SpamCat' });
  await wait(400);
  admin.socket.off('new_message', adminMsgHandler);

  assert(unbanMsg, 'Admin should receive unban confirmation for SpamCat');
  console.log('✓ PASS: SpamCat temp ban unbanned successfully');

  // Verify SpamCat can connect now
  const spammerReconnected = await createClient('u_spammer_2', 'GoodCat', { 'x-forwarded-for': '198.51.100.77' });
  assert(spammerReconnected && spammerReconnected.socket.connected, 'SpamCat should be able to reconnect');
  spammerReconnected.socket.disconnect();
  console.log('✓ PASS: Temp banned user reconnected successfully after /unban SpamCat');

  // 7. Unban by IP directly: /unban <IP>
  console.log('\n[Test 8] Ban Troll then unban by IP (/unban 198.51.100.88)...');
  const troll = await createClient('u_troll', 'Troll', { 'x-forwarded-for': '198.51.100.88' });
  await wait(200);

  admin.socket.emit('ban_user', { targetNickname: 'Troll', reason: 'IP 직접 해제 테스트' });
  await wait(400);

  admin.socket.emit('unban_ip', { target: '198.51.100.88' });
  await wait(400);

  const trollReconnected = await createClient('u_troll_2', 'TrollClean', { 'x-forwarded-for': '198.51.100.88' });
  assert(trollReconnected && trollReconnected.socket.connected, 'Troll should reconnect after IP unban');
  trollReconnected.socket.disconnect();
  console.log('✓ PASS: Unban by direct IP address works');

  // 8. Unban nonexistent target gives clear message
  console.log('\n[Test 9] Unban unknown target...');
  let notFoundMsg = false;
  const unknownMsgHandler = (msg) => {
    if (msg.content && msg.content.includes('찾을 수 없습니다')) {
      notFoundMsg = true;
    }
  };
  admin.socket.on('new_message', unknownMsgHandler);
  admin.socket.emit('unban_ip', { target: 'GhostUser9999' });
  await wait(300);
  admin.socket.off('new_message', unknownMsgHandler);
  assert(notFoundMsg, 'Should inform operator that target could not be found');
  console.log('✓ PASS: Informative message when target cannot be found');

  // Cleanup
  user1.socket.disconnect();
  admin.socket.disconnect();
  try {
    if (fs.existsSync(banFile)) fs.unlinkSync(banFile);
  } catch (e) {}

  console.log('\n=== ALL /banlist & /unban TESTS PASSED SUCCESSFULLY! ===\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
