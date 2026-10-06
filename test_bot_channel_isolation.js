const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function run() {
  console.log('=== Test: Bot Channel Isolation Verification ===');

  const client = io(SERVER_URL, { reconnection: false });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timeout')), 5000);

    client.on('connect', () => {
      console.log('Client connected:', client.id);
      client.emit('user_join', {
        userId: 'iso_tester',
        nickname: '아이소테스터',
        avatar: '🐱'
      });
    });

    client.on('init_state', (data) => {
      clearTimeout(timer);
      console.log('1. init_state received. Default room:', data.user.currentRoom);
      const freeCh = data.channels.find(c => c.id === '#자유대화');
      console.log('#자유대화:', { hasBot: freeCh.hasBot, userCount: freeCh.userCount });
      if (!freeCh.hasBot) return reject(new Error('Free channel must have bot'));
      resolve();
    });
  });

  // Test 1: Bot responds in #자유대화
  console.log('\n--- Test 1: Bot responds in #자유대화 ---');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bot response timeout in #자유대화')), 4000);

    client.on('new_message', function onMsg(msg) {
      if (msg.sender && (msg.sender.isBot || msg.sender.userId === 'bot_nyaa')) {
        client.off('new_message', onMsg);
        clearTimeout(timer);
        console.log(`✅ Bot responded in #자유대화: "${msg.content}"`);
        resolve();
      }
    });

    client.emit('send_message', {
      roomId: '#자유대화',
      content: '냥봇아 안녕'
    });
  });

  // Test 2: Join custom channel #커스텀채널 and verify bot is NOT present and DOES NOT respond
  console.log('\n--- Test 2: Custom channel #커스텀채널 ---');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Join custom channel timeout')), 5000);

    client.on('room_switched', (data) => {
      if (data.roomMeta && data.roomMeta.id === '#커스텀채널') {
        console.log('Switched to #커스텀채널. isService:', data.roomMeta.isService);
        if (data.roomMeta.isService) {
          clearTimeout(timer);
          return reject(new Error('Custom channel must NOT be a service channel!'));
        }
        clearTimeout(timer);
        resolve();
      }
    });

    client.emit('join_channel', {
      channelName: '커스텀채널',
      topic: '개인 커스텀 채널'
    });
  });

  // Test 3: Mentioning bot in #커스텀채널 must NOT elicit a response
  console.log('\n--- Test 3: Mention bot in #커스텀채널 (Expecting NO response) ---');
  await new Promise((resolve, reject) => {
    let responded = false;
    const onBotMsg = (msg) => {
      if (msg.sender && (msg.sender.isBot || msg.sender.userId === 'bot_nyaa')) {
        responded = true;
      }
    };
    client.on('new_message', onBotMsg);

    client.emit('send_message', {
      roomId: '#커스텀채널',
      content: '냥봇 나와봐'
    });

    setTimeout(() => {
      client.off('new_message', onBotMsg);
      if (responded) {
        return reject(new Error('Bot responded in custom channel, but should NOT have!'));
      }
      console.log('✅ Bot successfully ignored mention in custom channel #커스텀채널!');
      resolve();
    }, 1200);
  });

  // Test 4: Switch back to #자유대화, custom channel is destroyed (0 users left)
  console.log('\n--- Test 4: Leave custom channel & auto-deletion ---');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Channel auto-delete timeout')), 5000);

    client.on('channel_list_update', (channels) => {
      const customExists = channels.some(c => c.id === '#커스텀채널');
      if (!customExists) {
        clearTimeout(timer);
        console.log('✅ Custom channel #커스텀채널 successfully auto-deleted when user count reached 0!');
        resolve();
      }
    });

    client.emit('part_channel', {
      channelId: '#커스텀채널'
    });
  });

  console.log('\n🎉 ALL BOT ISOLATION & SERVICE CHANNEL TESTS PASSED! 🎉\n');
  client.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
