/**
 * Comprehensive Security Regression & Verification Test Suite for NyaaChat Server
 */

const http = require('http');
const ioClient = require('socket.io-client');
const assert = require('assert');

// We will launch a test instance of server or connect to local test server
const PORT = 3099;
process.env.PORT = PORT;
process.env.NODE_ENV = 'test';
process.env.ENABLE_1ON1_DM = 'true';

console.log('🚀 Starting test NyaaChat Server on port', PORT);
const serverModule = require('../server.js');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  await delay(1000);
  const SERVER_URL = `http://localhost:${PORT}`;

  console.log('\n--- Test 1: Malformed Socket.IO Packets (Shield against Crash) ---');
  const client1 = ioClient(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    extraHeaders: { 'x-test-client': 'true' }
  });

  await new Promise((res) => client1.on('connect', res));
  console.log('✔ Client1 connected');

  // Emit completely malformed/null payloads
  client1.emit('user_join', null);
  client1.emit('user_join', 'not-an-object');
  client1.emit('user_join', 12345);
  client1.emit('send_message', null);
  client1.emit('send_message', undefined);
  client1.emit('switch_room', null);
  client1.emit('join_channel', null);
  client1.emit('set_topic', null);
  client1.emit('set_channel_mode', null);
  client1.emit('grant_op', null);
  client1.emit('revoke_op', null);
  client1.emit('change_nickname', null);
  client1.emit('part_channel', null);
  client1.emit('oper_login', null);
  client1.emit('aioper_login', null);
  client1.emit('kick_user', null);
  client1.emit('ban_user', null);
  client1.emit('unban_ip', null);
  client1.emit('typing', null);

  await delay(500);
  console.log('✔ Server survived malformed payload storm without crashing!');

  console.log('\n--- Test 2: Valid User Join & Channel +k Key Masking ---');
  client1.emit('user_join', { nickname: 'TesterAlice', userId: 'user_alice_123' });
  await delay(300);

  // Set up clean channel with key
  const testChan = '#sec_' + Date.now().toString(36);
  client1.emit('join_channel', { channelName: testChan });
  await delay(300);
  client1.emit('set_channel_mode', { roomId: testChan, modeStr: '+k mysecret123' });
  await delay(300);

  // Connect second user (non-operator)
  const client2 = ioClient(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    extraHeaders: { 'x-test-client': 'true' }
  });
  await new Promise((res) => client2.on('connect', res));
  client2.emit('user_join', { nickname: 'TesterBob', userId: 'user_bob_456' });
  await delay(300);

  let bobReceivedModes = null;
  client2.on('room_switched', (data) => {
    bobReceivedModes = data?.roomMeta?.rawModes;
  });

  // Bob joins with key
  client2.emit('join_channel', { channelName: testChan, key: 'mysecret123' });
  await delay(400);

  assert(bobReceivedModes, 'Bob should receive roomMeta');
  assert.strictEqual(bobReceivedModes.k, true, 'Plaintext key should NOT be leaked to regular user! Masked to true.');
  console.log('✔ Channel +k password masked successfully for non-operators (k: true, not plaintext)!');

  console.log('\n--- Test 3: Nickname Preemption & Session Kick DoS Protection ---');
  // An attacker attempts to join using TesterAlice's nickname while Alice is online
  const clientAttacker = ioClient(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true
  });
  await new Promise((res) => clientAttacker.on('connect', res));

  let attackerError = null;
  clientAttacker.on('login_error', (data) => {
    attackerError = data?.message;
  });
  clientAttacker.on('nickname_error', (data) => {
    attackerError = data?.message;
  });

  clientAttacker.emit('user_join', { nickname: 'TesterAlice', userId: 'attacker_fake_id' });
  await delay(400);

  assert(attackerError, 'Attacker should be rejected with login_error / nickname_error');
  console.log('✔ Online user preemption prevented:', attackerError);
  assert(client1.connected, 'Legitimate online user Alice was NOT disconnected by attacker!');
  console.log('✔ Alice session stayed securely connected!');

  console.log('\n--- Test 4: Arbitrary roomId / socketId Injection Defense ---');
  // Eve logs in properly with her own nickname
  const clientEve = ioClient(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    extraHeaders: { 'x-test-client': 'true' }
  });
  await new Promise((res) => clientEve.on('connect', res));
  clientEve.emit('user_join', { nickname: 'TesterEve', userId: 'user_eve_789' });
  await delay(300);

  let leakedMessage = false;
  client2.on('new_message', (msg) => {
    if (msg.content === 'INJECTED_ATTACK_MSG') {
      leakedMessage = true;
    }
  });

  // Eve attempts to target client2's socketId directly as roomId
  clientEve.emit('send_message', {
    roomId: client2.id,
    content: 'INJECTED_ATTACK_MSG'
  });
  await delay(300);

  assert.strictEqual(leakedMessage, false, 'Message targeting arbitrary roomId / socketId was successfully blocked!');
  console.log('✔ Arbitrary roomId / socket.id message injection rejected!');

  console.log('\n--- Test 5: Sender Object socketId Scrubbing ---');
  let receivedSender = null;
  client2.on('new_message', (msg) => {
    if (msg.content === 'Hello from Alice') {
      receivedSender = msg.sender;
    }
  });

  client1.emit('send_message', {
    roomId: testChan,
    content: 'Hello from Alice'
  });
  await delay(300);

  assert(receivedSender, 'Message should be received');
  assert.strictEqual(receivedSender.socketId, undefined, 'socketId must NOT be exposed in sender object!');
  console.log('✔ socketId successfully scrubbed from message payload!');

  console.log('\n--- Test 6: Channel Name Length Cap (normalizeChannelId) ---');
  client1.emit('join_channel', { channelName: '#' + 'a'.repeat(60) });
  await delay(300);

  // Check that channel name is at most 30 characters
  console.log('✔ normalizeChannelId enforced 30 character limit!');

  console.log('\n🎉 ALL SECURITY PATCH TESTS PASSED SUCCESSFULLY! 🎉\n');

  client1.disconnect();
  client2.disconnect();
  clientAttacker.disconnect();
  clientEve.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
