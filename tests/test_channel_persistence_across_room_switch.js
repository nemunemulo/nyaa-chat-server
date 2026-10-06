const io = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('--- Testing Channel Persistence Across Room Switch ---');

  const rand = Math.random().toString(36).substring(2, 6);
  const client = io(SERVER_URL, { forceNew: true, transports: ['websocket'] });

  const u = { userId: `u_tester_${rand}`, nickname: `코코참_${rand}`, avatar: '🌸' };

  await new Promise((resolve) => client.on('connect', resolve));

  console.log('[Test 1] Logging in...');
  let currentChannels = [];
  client.on('channel_list_update', (channels) => {
    currentChannels = channels;
  });

  await new Promise((resolve) => {
    client.on('init_state', (state) => {
      currentChannels = state.channels;
      resolve();
    });
    client.emit('user_join', u);
  });

  console.log('  -> Logged in. Initial channels:', currentChannels.map(c => c.name));

  const testChannelName = `#세계선_${rand}`;
  console.log(`[Test 2] Creating channel ${testChannelName}...`);
  await new Promise((resolve) => {
    client.on('room_switched', (data) => {
      if (data.roomMeta.id === testChannelName) resolve();
    });
    client.emit('join_channel', { channelName: testChannelName });
  });

  await new Promise((r) => setTimeout(r, 300));
  const hasTestChan = currentChannels.some(c => c.id === testChannelName);
  assert(hasTestChan, `User joined channels must contain ${testChannelName}`);
  console.log(`  -> Channel created and present in left sidebar. Total channels: ${currentChannels.length}`);

  console.log('[Test 3] Switching view to #자유대화 (clicking #자유대화 in sidebar)...');
  await new Promise((resolve) => {
    client.on('room_switched', (data) => {
      if (data.roomMeta.id === '#자유대화') resolve();
    });
    client.emit('switch_room', { targetType: 'channel', targetId: '#자유대화' });
  });

  await new Promise((r) => setTimeout(r, 400));

  // Critical Assertion: The custom channel MUST STILL EXIST and remain in the user's sidebar!
  const stillHasTestChan = currentChannels.some(c => c.id === testChannelName);
  assert.strictEqual(stillHasTestChan, true, `${testChannelName} must NOT be deleted when user clicks #자유대화!`);
  console.log(`  -> SUCCESS: ${testChannelName} STILL EXISTS in user's sidebar! (Not deleted on view switch)`);

  console.log(`[Test 4] Switching view back to ${testChannelName}...`);
  await new Promise((resolve) => {
    client.on('room_switched', (data) => {
      if (data.roomMeta.id === testChannelName) resolve();
    });
    client.emit('switch_room', { targetType: 'channel', targetId: testChannelName });
  });
  console.log(`  -> Successfully switched back to ${testChannelName}`);

  console.log(`[Test 5] Explicitly parting ${testChannelName} via /part (or clicking ✕)...`);
  client.emit('part_channel', { channelId: testChannelName });
  await new Promise((r) => setTimeout(r, 500));

  const channelDeletedAfterPart = !currentChannels.some(c => c.id === testChannelName);
  assert.strictEqual(channelDeletedAfterPart, true, `${testChannelName} must be auto-deleted when user explicitly parts`);
  console.log(`  -> SUCCESS: ${testChannelName} auto-deleted after explicit /part!`);

  client.disconnect();
  console.log('\n=============================================');
  console.log('  ALL CHANNEL PERSISTENCE TESTS PASSED! 🎉');
  console.log('=============================================\n');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
