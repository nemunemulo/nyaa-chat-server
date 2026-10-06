const io = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3000';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createTestClient(userId, nickname, ip, extraHeaders = {}) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: {
        'x-forwarded-for': ip,
        ...extraHeaders
      }
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ socket, error: 'TIMEOUT' });
      }
    }, 4000);

    socket.on('connect', () => {
      socket.emit('user_join', { userId, nickname, avatar: '👤' });
    });

    socket.on('init_state', (data) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ socket, data, success: true });
      }
    });

    socket.on('login_error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ socket, loginError: err.message, success: false });
      }
    });
  });
}

async function runSingleConnectionPolicyTests() {
  console.log('========================================================');
  console.log('🧪 [Single-Session per Computer/IP Policy Automated Tests]');
  console.log('========================================================\n');

  const testIp = '172.25.10.55';
  const userIdA = 'u_browser_device_1';
  const nickA = '첫번째유저';

  // Test 1: First client connects normally from testIp
  console.log('[Test 1] Connecting first client (Tab 1) from PC IP...');
  const client1 = await createTestClient(userIdA, nickA, testIp);
  assert.strictEqual(client1.success, true, 'Client 1 must connect successfully');
  console.log('  ✔ PASS: Client 1 successfully logged in.');

  // Test 2: Second client tries to connect from SAME BROWSER (same userId) with DIFFERENT nickname
  console.log('\n[Test 2] Connecting second client from SAME BROWSER with different nickname (Tab 2)...');
  const client2SameBrowser = await createTestClient(userIdA, '두번째유저', testIp);
  assert.strictEqual(client2SameBrowser.success, false, 'Client 2 must be rejected');
  assert.ok(client2SameBrowser.loginError.includes('현재 브라우저에서'), 'Error must mention same browser restriction');
  console.log(`  ✔ PASS: Rejected same browser duplicate login with message: "${client2SameBrowser.loginError}"`);

  // Test 3: Third client tries to connect from SAME COMPUTER/IP with DIFFERENT browser/incognito (different userId)
  console.log('\n[Test 3] Connecting third client from DIFFERENT BROWSER on SAME COMPUTER/IP (Incognito)...');
  const client3SameIp = await createTestClient('u_browser_device_2', '세번째유저', testIp);
  assert.strictEqual(client3SameIp.success, false, 'Client 3 must be rejected');
  assert.ok(client3SameIp.loginError.includes('동일한 컴퓨터/네트워크 환경'), 'Error must mention same computer/IP restriction');
  console.log(`  ✔ PASS: Rejected same IP duplicate login with message: "${client3SameIp.loginError}"`);

  // Test 4: Refresh simulation (Same browser, same userId, SAME nickname)
  console.log('\n[Test 4] Simulating page refresh (Tab 1 F5) with same userId and same nickname...');
  let client1Terminated = false;
  client1.socket.on('disconnect', () => { client1Terminated = true; });
  client1.socket.on('login_error', () => { client1Terminated = true; });

  const refreshedClient = await createTestClient(userIdA, nickA, testIp);
  assert.strictEqual(refreshedClient.success, true, 'Refreshed client must be allowed to take over');
  await wait(300);
  assert.strictEqual(client1Terminated, true, 'Old stale connection must be closed');
  console.log('  ✔ PASS: Page refresh seamlessly accepted; old stale connection gracefully closed.');

  // Test 5: Client disconnects (closes window) -> New session can now connect from this IP
  console.log('\n[Test 5] Simulating browser close -> Subsequent login from same IP should succeed...');
  refreshedClient.socket.disconnect();
  await wait(500);

  const newClientAfterClose = await createTestClient('u_browser_device_3', '새로운유저', testIp);
  assert.strictEqual(newClientAfterClose.success, true, 'New client must connect after previous session closed');
  console.log('  ✔ PASS: New session connects successfully after previous window was closed.');

  newClientAfterClose.socket.disconnect();

  console.log('\n========================================================');
  console.log('🎉 ALL SINGLE-SESSION POLICY TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================');
  process.exit(0);
}

runSingleConnectionPolicyTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
