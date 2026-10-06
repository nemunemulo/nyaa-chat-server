const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://127.0.0.1:3000';

function createClient(userId, nickname, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Connection timeout for ${nickname}`));
    }, 4000);

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
      clearTimeout(timer);
      resolve({ socket, data });
    });

    socket.on('login_error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Login error for ${nickname}: ${err.message}`));
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTests() {
  console.log('--- Starting IRC Modes, /list, and Left Sidebar Scoping Tests ---');
  const RUN_ID = Math.random().toString(36).substring(2, 7);
  const user1Nick = `유저1_${RUN_ID}`;
  const user2Nick = `유저2_${RUN_ID}`;
  const operNick = `운영자_${RUN_ID}`;

  let client1 = null;
  let client2 = null;
  let clientOper = null;

  try {
    // 1. Connect Client 1 & Client 2
    console.log('[Test 1] Connecting clients...');
    client1 = await createClient(`u1_${RUN_ID}`, user1Nick);
    client2 = await createClient(`u2_${RUN_ID}`, user2Nick);
    assert(client1.data.user.nickname === user1Nick);
    assert(client2.data.user.nickname === user2Nick);
    console.log('  -> Clients connected successfully.');

    // 2. Test Left Sidebar Scoping: Unjoined channels must NOT appear in other users\' sidebar
    console.log('[Test 2] Testing left sidebar scoping (unjoined channels not visible)...');
    const customChanName = `#테스트채널_${RUN_ID}`;

    // Client 1 creates custom channel
    client1.socket.emit('join_channel', { channelName: customChanName, topic: '테스트용 채널입니다.' });
    await wait(300);

    // Client 2 requests channel list update
    let client2Channels = null;
    client2.socket.once('channel_list_update', (channels) => {
      client2Channels = channels;
    });
    client2.socket.emit('get_channel_list');
    await wait(300);

    assert(client2Channels, 'Client 2 should receive channel list update');
    const c2HasCustom = client2Channels.some(c => c.id === customChanName);
    assert.strictEqual(c2HasCustom, false, `Client 2 should NOT see unjoined channel ${customChanName} in left sidebar!`);
    console.log('  -> Scoping verified: Unjoined channel correctly hidden from Client 2 left sidebar.');

    // 3. Test /list command (Server Channel Directory)
    console.log('[Test 3] Testing /list (getServerChannelList)...');
    let serverChannels = null;
    client2.socket.once('server_channels_result', (list) => {
      serverChannels = list;
    });
    client2.socket.emit('get_server_channels');
    await wait(300);

    assert(serverChannels, 'Client 2 should receive server_channels_result');
    const inServerList = serverChannels.some(c => c.id === customChanName);
    assert.strictEqual(inServerList, true, `Custom channel ${customChanName} should appear in /list directory.`);
    console.log('  -> /list verified: Custom channel appears in public directory.');

    // 4. Test Channel Key / Password (+k)
    console.log('[Test 4] Testing channel mode +k (password/key)...');
    // Client 1 is op in custom channel. Sets +k
    client1.socket.emit('set_channel_mode', { roomId: customChanName, modeStr: '+k', params: 'secretpass123' });
    await wait(300);

    // Client 2 attempts to join without key
    let keyRequiredReceived = false;
    client2.socket.once('channel_key_required', (data) => {
      keyRequiredReceived = true;
      assert.strictEqual(data.roomId, customChanName);
    });
    client2.socket.emit('join_channel', { channelName: customChanName });
    await wait(300);
    assert.strictEqual(keyRequiredReceived, true, 'Client 2 should be prompted for channel password (+k)');

    // Client 2 attempts to join with WRONG key
    let wrongKeyReceived = false;
    client2.socket.once('channel_key_required', (data) => {
      wrongKeyReceived = true;
      assert(data.error.includes('일치하지 않습니다'));
    });
    client2.socket.emit('join_channel', { channelName: customChanName, key: 'wrongpass' });
    await wait(300);
    assert.strictEqual(wrongKeyReceived, true, 'Client 2 should fail join with wrong key');

    // Client 2 joins with CORRECT key
    let roomSwitched = false;
    client2.socket.once('room_switched', (data) => {
      if (data.roomMeta.id === customChanName) roomSwitched = true;
    });
    client2.socket.emit('join_channel', { channelName: customChanName, key: 'secretpass123' });
    await wait(300);
    assert.strictEqual(roomSwitched, true, 'Client 2 should successfully join with correct password');
    console.log('  -> +k mode verified: Password enforcement and successful unlock.');

    // 5. Test Moderated Channel Mode (+m) and Voice (+v)
    console.log('[Test 5] Testing moderated channel mode (+m) and voice (+v)...');
    // Client 1 sets +m
    client1.socket.emit('set_channel_mode', { roomId: customChanName, modeStr: '+m' });
    await wait(300);

    // Client 2 (not op, no voice) tries to send a message
    let modeWarningReceived = false;
    client2.socket.on('new_message', (msg) => {
      if (msg.type === 'system' && msg.content.includes('+m')) {
        modeWarningReceived = true;
      }
    });
    client2.socket.emit('send_message', { roomId: customChanName, content: '내가 말할 수 있을까?', type: 'text' });
    await wait(300);
    assert.strictEqual(modeWarningReceived, true, 'Client 2 should be blocked by +m moderated mode');

    // Client 1 grants voice to Client 2 (+v)
    client1.socket.emit('set_channel_mode', { roomId: customChanName, modeStr: '+v', params: user2Nick });
    await wait(300);

    // Client 2 tries to send message again with voice
    let voiceChatDelivered = false;
    client1.socket.on('new_message', (msg) => {
      if (msg.content === '발언권 얻어서 대화 가능냥!') {
        voiceChatDelivered = true;
      }
    });
    client2.socket.emit('send_message', { roomId: customChanName, content: '발언권 얻어서 대화 가능냥!', type: 'text' });
    await wait(300);
    assert.strictEqual(voiceChatDelivered, true, 'Client 2 with +v should be able to chat in +m channel');
    console.log('  -> +m and +v modes verified: Non-voiced users blocked, voiced users can chat.');

    // 6. Test Non-Operator Permission Check
    console.log('[Test 6] Testing non-operator permission check for mode changes...');
    let nonOpBlocked = false;
    client2.socket.once('new_message', (msg) => {
      if (msg.type === 'system' && msg.content.includes('방장(@) 또는 서버 운영자만 가능')) {
        nonOpBlocked = true;
      }
    });
    client2.socket.emit('set_channel_mode', { roomId: customChanName, modeStr: '-m' });
    await wait(300);
    assert.strictEqual(nonOpBlocked, true, 'Non-op should be blocked from changing channel modes');
    console.log('  -> Permission check verified: Non-operator cannot change channel modes.');

    // 7. Test User Limit (+l) and Invite Only (+i)
    console.log('[Test 7] Testing channel user limit (+l) and invite only (+i)...');
    const limitChanName = `#정원채널_${RUN_ID}`;
    // Client 1 creates channel with limit 1
    client1.socket.emit('join_channel', { channelName: limitChanName, limit: 1 });
    await wait(300);

    // Client 2 attempts to join
    let limitExceeded = false;
    client2.socket.once('new_message', (msg) => {
      if (msg.type === 'system' && msg.content.includes('초과되어 입장할 수 없습니다')) {
        limitExceeded = true;
      }
    });
    client2.socket.emit('join_channel', { channelName: limitChanName });
    await wait(300);
    assert.strictEqual(limitExceeded, true, 'Client 2 should be rejected when channel reaches user limit (+l)');

    // Client 1 removes limit (-l) and sets invite only (+i)
    client1.socket.emit('set_channel_mode', { roomId: limitChanName, modeStr: '-l +i' });
    await wait(300);

    // Client 2 attempts to join invite-only channel
    let inviteRequired = false;
    client2.socket.once('new_message', (msg) => {
      if (msg.type === 'system' && msg.content.includes('초대 전용(+i) 채널')) {
        inviteRequired = true;
      }
    });
    client2.socket.emit('join_channel', { channelName: limitChanName });
    await wait(300);
    assert.strictEqual(inviteRequired, true, 'Client 2 should be rejected without an invite');

    // Client 1 invites Client 2
    let inviteNoticeReceived = false;
    client2.socket.once('invited_to_channel', (data) => {
      if (data.roomId === limitChanName) inviteNoticeReceived = true;
    });
    client1.socket.emit('invite_user', { targetNickname: user2Nick, roomId: limitChanName });
    await wait(300);
    assert.strictEqual(inviteNoticeReceived, true, 'Client 2 should receive invited_to_channel event');

    // Client 2 joins now that they are invited
    let inviteJoinSuccess = false;
    client2.socket.once('room_switched', (data) => {
      if (data.roomMeta.id === limitChanName) inviteJoinSuccess = true;
    });
    client2.socket.emit('join_channel', { channelName: limitChanName });
    await wait(300);
    assert.strictEqual(inviteJoinSuccess, true, 'Client 2 should successfully join after invite');
    console.log('  -> +l and +i modes verified: Limit and invite checks passed.');

    // 8. Test Private/Secret channels hidden from /list for non-members
    console.log('[Test 8] Testing private/secret channels (+p/+s) in /list...');
    const secretChanName = `#비밀방_${RUN_ID}`;
    client1.socket.emit('join_channel', { channelName: secretChanName, isPrivate: true });
    await wait(300);

    // Client 3 (not in channel) checks /list
    const client3 = await createClient(`u3_${RUN_ID}`, `유저3_${RUN_ID}`);
    let listForClient3 = null;
    client3.socket.once('server_channels_result', (list) => {
      listForClient3 = list;
    });
    client3.socket.emit('get_server_channels');
    await wait(300);
    assert(listForClient3);
    const secretInList = listForClient3.some(c => c.id === secretChanName);
    assert.strictEqual(secretInList, false, 'Private/Secret channel must NOT appear in /list for non-members');
    client3.socket.disconnect();
    console.log('  -> +p/+s privacy verified: Hidden from non-members in /list.');

    console.log('\n=============================================');
    console.log('  ALL IRC MODE AND DIRECTORY TESTS PASSED! 🎉');
    console.log('=============================================\n');
  } catch (err) {
    console.error('Test FAILED:', err);
    process.exit(1);
  } finally {
    if (client1 && client1.socket) client1.socket.disconnect();
    if (client2 && client2.socket) client2.socket.disconnect();
    if (clientOper && clientOper.socket) clientOper.socket.disconnect();
  }
}

runTests();
