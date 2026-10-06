const io = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3000';

async function runWhoisAndDmDisabledTests() {
  console.log('--- Starting WHOIS and 1:1 DM Disabled Automated Tests ---');

  const client1 = io(SERVER_URL, { forceNew: true, transports: ['websocket'], extraHeaders: { 'x-test-client': 'true' } });
  const client2 = io(SERVER_URL, { forceNew: true, transports: ['websocket'], extraHeaders: { 'x-test-client': 'true' } });

  const rand = Math.random().toString(36).substring(2, 6);
  const u1 = { userId: `u_normal_${rand}`, nickname: `코코참_${rand}`, avatar: '🌸' };
  const u2 = { userId: `u_oper_${rand}`, nickname: `메롱_${rand}`, avatar: '🐱' };

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    client1.on('connect', check);
    client2.on('connect', check);
  });

  console.log('[Test 1] Logging in users...');
  await new Promise((resolve) => {
    client1.on('init_state', () => resolve());
    client1.emit('user_join', u1);
  });

  await new Promise((resolve) => {
    client2.on('init_state', () => resolve());
    client2.emit('user_join', u2);
  });

  // Authenticate Client 2 as server operator
  console.log('[Test 2] Authenticating Client 2 as server operator (/oper)...');
  await new Promise((resolve) => {
    client2.on('oper_success', () => resolve());
    client2.emit('oper_login', { operId: 'nemu', operPw: 'nemulo' });
  });
  console.log('  -> Client 2 authenticated as server operator.');

  // Test 3: DM Disabled - switch_room
  console.log('[Test 3] Testing 1:1 DM switch_room blocking...');
  let dmSwitchBlocked = false;
  client1.on('new_message', (msg) => {
    if (msg.type === 'system' && msg.content.includes('1:1 대화 기능은 서버 정책에 따라 분리/비활성화되어 있습니다')) {
      dmSwitchBlocked = true;
    }
  });
  client1.emit('switch_room', { targetType: 'dm', targetId: u2.userId });
  await new Promise((r) => setTimeout(r, 600));
  assert.strictEqual(dmSwitchBlocked, true, 'switch_room with dm must be blocked');
  console.log('  -> PASS: switch_room dm rejected with disabled policy notification.');

  // Test 4: DM Disabled - send_message to dm_ room
  console.log('[Test 4] Testing 1:1 DM send_message blocking...');
  let dmSendBlocked = false;
  client1.on('new_message', (msg) => {
    if (msg.type === 'system' && msg.content.includes('1:1 대화 기능은 서버 정책에 따라 분리/비활성화되어 있습니다')) {
      dmSendBlocked = true;
    }
  });
  client1.emit('send_message', {
    roomId: `dm_${u1.userId}_${u2.userId}`,
    content: '1:1 테스트',
    type: 'text'
  });
  await new Promise((r) => setTimeout(r, 600));
  assert.strictEqual(dmSendBlocked, true, 'send_message to dm_ room must be blocked');
  console.log('  -> PASS: send_message to dm_ room rejected.');

  // Test 5: WHOIS on Server Operator (Client 2)
  console.log('[Test 5] Testing WHOIS on Server Operator (Client 2)...');
  let operWhoisReceived = false;
  let operWhoisText = '';
  client1.on('whois_result', (data) => {
    if (data.target === u2.nickname) {
      operWhoisReceived = true;
      operWhoisText = data.formattedText;
    }
  });

  client1.emit('whois', { target: u2.nickname });
  await new Promise((r) => setTimeout(r, 700));

  assert.strictEqual(operWhoisReceived, true, 'Should receive whois_result for Client 2');
  console.log('  -> Received WHOIS Result for Oper:\n' + operWhoisText);

  assert.ok(operWhoisText.includes('┌───────────────────────────━━'), 'Must have top border');
  assert.ok(operWhoisText.includes(`${u2.nickname} 님의 사용자 정보`), 'Must have nickname header');
  assert.ok(operWhoisText.includes(`연결주소: ${u2.nickname}@#${u2.userId}`), 'Must have connection address');
  assert.ok(operWhoisText.includes('사용자명: WEB'), 'Must have username WEB');
  assert.ok(operWhoisText.includes('입실채널:'), 'Must have joined channels');
  assert.ok(operWhoisText.includes(`인증유저: ${u2.nickname} 님은 nemu 운영자로 로그인되었습니다.`), 'Must show oper auth line');
  assert.ok(operWhoisText.includes('접속서버: *.nemulo.duckdns.org:3000/ * Nemulo'), 'Must show server address');
  assert.ok(operWhoisText.includes('잠수시간:'), 'Must show idle time');
  assert.ok(operWhoisText.includes('접속시간:'), 'Must show connect time');
  assert.ok(operWhoisText.includes('└───────────────────────────━━'), 'Must have bottom border');
  console.log('  -> PASS: Oper WHOIS correctly displays operator authentication & full details.');

  // Test 6: WHOIS on Normal User (Client 1) - Must NOT contain 인증유저
  console.log('[Test 6] Testing WHOIS on Normal User (Client 1)...');
  let normalWhoisReceived = false;
  let normalWhoisText = '';
  client2.on('whois_result', (data) => {
    if (data.target === u1.nickname) {
      normalWhoisReceived = true;
      normalWhoisText = data.formattedText;
    }
  });

  client2.emit('whois', { target: u1.nickname });
  await new Promise((r) => setTimeout(r, 700));

  assert.strictEqual(normalWhoisReceived, true, 'Should receive whois_result for Client 1');
  console.log('  -> Received WHOIS Result for Normal User:\n' + normalWhoisText);

  assert.ok(!normalWhoisText.includes('인증유저:'), 'Normal user must NOT have 인증유저 line');
  assert.ok(normalWhoisText.includes(`연결주소: ${u1.nickname}@#${u1.userId}`), 'Must have normal user address');
  assert.ok(normalWhoisText.includes('사용자명: WEB'), 'Must have username WEB');
  assert.ok(normalWhoisText.includes('접속서버: *.nemulo.duckdns.org:3000/ * Nemulo'), 'Must have server address');
  console.log('  -> PASS: Normal User WHOIS omits auth line as requested [운영자/봇만].');

  // Test 7: WHOIS on Bot (냥봇)
  console.log('[Test 7] Testing WHOIS on Bot (냥봇)...');
  let botWhoisReceived = false;
  let botWhoisText = '';
  client1.on('whois_result', (data) => {
    if (data.target === '냥봇') {
      botWhoisReceived = true;
      botWhoisText = data.formattedText;
    }
  });

  client1.emit('whois', { target: '냥봇' });
  await new Promise((r) => setTimeout(r, 700));

  assert.strictEqual(botWhoisReceived, true, 'Should receive whois_result for bot');
  console.log('  -> Received WHOIS Result for Bot:\n' + botWhoisText);

  assert.ok(botWhoisText.includes('냥봇 님의 사용자 정보'), 'Bot whois header');
  assert.ok(botWhoisText.includes('연결주소: 냥봇@#bot_nyaa'), 'Bot address');
  assert.ok(botWhoisText.includes('사용자명: BOT'), 'Bot username');
  assert.ok(botWhoisText.includes('인증유저: 냥봇 님은 공식 봇 서비스로 인증되었습니다.'), 'Bot auth line');
  console.log('  -> PASS: Bot WHOIS displays official bot authentication.');

  // Test 8: Nonexistent user whois error
  console.log('[Test 8] Testing WHOIS on Nonexistent user...');
  let notFoundReceived = false;
  client1.on('new_message', (msg) => {
    if (msg.type === 'system' && msg.content.includes('[WHOIS]') && msg.content.includes('사용자를 찾을 수 없습니다')) {
      notFoundReceived = true;
    }
  });

  client1.emit('whois', { target: '없는유저_xyz' });
  await new Promise((r) => setTimeout(r, 600));

  assert.strictEqual(notFoundReceived, true, 'Should receive not found notice for missing user');
  console.log('  -> PASS: Nonexistent user shows clean not found system message.');

  client1.disconnect();
  client2.disconnect();

  console.log('\n=============================================');
  console.log('  ALL WHOIS & DM DISABLED TESTS PASSED! 🎉');
  console.log('=============================================\n');
}

runWhoisAndDmDisabledTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
