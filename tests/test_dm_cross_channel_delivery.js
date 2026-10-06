const io = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3000';

async function runDmCrossChannelTests() {
  console.log('--- Starting 1:1 DM Cross-Channel & User ID Prefix Tests ---');

  // Client 1: 코코참 (starts in #자유대화)
  const client1 = io(SERVER_URL, { forceNew: true, transports: ['websocket'] });
  // Client 2: 메롱 (will switch to 1:1 DM)
  const client2 = io(SERVER_URL, { forceNew: true, transports: ['websocket'] });

  const rand = Math.random().toString(36).substring(2, 6);
  const u1 = { userId: `u_kanz_${rand}`, nickname: `코코참_${rand}`, avatar: '🌸' };
  const u2 = { userId: `u_7blt_${rand}`, nickname: `메롱_${rand}`, avatar: '🐱' };

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    client1.on('connect', check);
    client2.on('connect', check);
  });

  console.log('[Test 1] Logging in users with u_ prefixes in userId...');
  await new Promise((resolve) => {
    client1.on('init_state', () => resolve());
    client1.emit('user_join', u1);
  });

  await new Promise((resolve) => {
    client2.on('init_state', () => resolve());
    client2.emit('user_join', u2);
  });

  console.log('  -> Both users logged in. Client 1 is in #자유대화, Client 2 is in #자유대화.');

  // Test 2: Client 2 switches to DM with Client 1. Client 1 REMAINS in #자유대화!
  console.log('[Test 2] Client 2 switches to DM with Client 1 (Client 1 stays in #자유대화)...');
  let dmRoomId = '';
  await new Promise((resolve) => {
    client2.on('room_switched', (data) => {
      dmRoomId = data.roomMeta.id;
      assert.strictEqual(data.roomMeta.type, 'dm');
      assert.strictEqual(data.roomMeta.targetUserId, u1.userId);
      resolve();
    });
    client2.emit('switch_room', { targetType: 'dm', targetId: u1.userId });
  });

  console.log(`  -> Client 2 in DM room: ${dmRoomId}. Verified targetUserId is ${u1.userId}.`);

  // Test 3: Client 2 sends DM message. Client 1 MUST receive new_message & dm_notification while in #자유대화!
  console.log('[Test 3] Client 2 sends DM message. Testing background delivery to Client 1 in #자유대화...');
  let client1ReceivedNewMessage = false;
  let client1ReceivedDmNotification = false;
  let receivedMessagePayload = null;

  client1.on('new_message', (msg) => {
    if (msg.roomId === dmRoomId && msg.content === '1') {
      client1ReceivedNewMessage = true;
      receivedMessagePayload = msg;
    }
  });

  client1.on('dm_notification', (data) => {
    if (data.roomId === dmRoomId && data.message && data.message.content === '1') {
      client1ReceivedDmNotification = true;
    }
  });

  client2.emit('send_message', {
    roomId: dmRoomId,
    recipientId: u1.userId,
    content: '1',
    type: 'text'
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for Client 1 to receive DM while in #자유대화. Received new_message: ${client1ReceivedNewMessage}, notification: ${client1ReceivedDmNotification}`));
    }, 3000);

    const interval = setInterval(() => {
      if (client1ReceivedNewMessage && client1ReceivedDmNotification) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });

  assert.strictEqual(client1ReceivedNewMessage, true, 'Client 1 must receive new_message in background');
  assert.strictEqual(client1ReceivedDmNotification, true, 'Client 1 must receive dm_notification in background');
  assert.strictEqual(receivedMessagePayload.sender.userId, u2.userId, 'Sender ID must match Client 2');
  assert.strictEqual(receivedMessagePayload.recipientId, u1.userId, 'Recipient ID must match Client 1');
  console.log('  -> PASS: Client 1 in #자유대화 received DM new_message & dm_notification successfully!');

  // Test 4: Client 1 now switches to DM and replies
  console.log('[Test 4] Client 1 enters DM and sends reply back to Client 2...');
  let client2ReceivedReply = false;

  client2.on('new_message', (msg) => {
    if (msg.roomId === dmRoomId && msg.content === '2') {
      client2ReceivedReply = true;
    }
  });

  await new Promise((resolve) => {
    client1.on('room_switched', () => resolve());
    client1.emit('switch_room', { targetType: 'dm', targetId: u2.userId });
  });

  client1.emit('send_message', {
    roomId: dmRoomId,
    recipientId: u2.userId,
    content: '2',
    type: 'text'
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for Client 2 to receive reply from Client 1'));
    }, 3000);

    const interval = setInterval(() => {
      if (client2ReceivedReply) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });

  assert.strictEqual(client2ReceivedReply, true, 'Client 2 must receive reply');
  console.log('  -> PASS: Client 2 received reply in active DM room!');

  client1.disconnect();
  client2.disconnect();

  console.log('\n=============================================');
  console.log('  ALL 1:1 DM CROSS-CHANNEL TESTS PASSED! 🎉');
  console.log('=============================================\n');
}

runDmCrossChannelTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
