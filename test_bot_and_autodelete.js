const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('--- Starting Nyaa Chat Auto-deletion & Bot Guardian Verification ---');

  const client1 = io(SERVER_URL, { reconnection: false });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timeout')), 5000);

    client1.on('connect', () => {
      console.log('Client 1 connected:', client1.id);
      client1.emit('user_join', {
        userId: 'test_user_1',
        nickname: '테스터1',
        avatar: '🐱'
      });
    });

    client1.on('init_state', async (data) => {
      clearTimeout(timer);
      console.log('[Test 1] init_state received.');
      console.log('Channels count:', data.channels.length);

      const freeCh = data.channels.find(c => c.id === '#자유대화');
      console.log('#자유대화 meta:', {
        name: freeCh.name,
        isService: freeCh.isService,
        hasBot: freeCh.hasBot,
        userCount: freeCh.userCount,
        operators: freeCh.operators
      });

      if (!freeCh.hasBot) {
        return reject(new Error('Failed: #자유대화 must have hasBot=true'));
      }
      if (freeCh.userCount < 2) { // at least 1 human + 1 bot
        return reject(new Error(`Failed: expected at least 2 users (1 bot + humans), got ${freeCh.userCount}`));
      }
      console.log('✅ [Test 1 Passed] Service channel has bot guardian and correct occupancy count.');

      resolve();
    });
  });

  // Test 2: Create a custom channel and verify auto-deletion when 0 users remain
  console.log('\n--- Test 2: Custom Channel Auto-Deletion on 0 Users ---');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Channel test timeout')), 8000);

    // Step 2-A: Join custom channel
    client1.emit('join_channel', {
      channelName: '임시채널',
      topic: '임시 테스트 방'
    });

    let channelCreated = false;

    client1.on('channel_list_update', (channels) => {
      const tempCh = channels.find(c => c.id === '#임시채널');
      if (!channelCreated && tempCh) {
        channelCreated = true;
        console.log('✅ Custom channel #임시채널 created successfully. UserCount:', tempCh.userCount);
        if (tempCh.hasBot) {
          return reject(new Error('Custom channel must NOT have bot'));
        }

        // Now leave the channel by switching back to #자유대화
        setTimeout(() => {
          console.log('Client 1 leaving #임시채널 back to #자유대화...');
          client1.emit('part_channel', {
            channelId: '#임시채널'
          });
        }, 500);
      } else if (channelCreated) {
        // Channel was created and user left, verify it is auto-deleted!
        if (!tempCh) {
          clearTimeout(timer);
          console.log('✅ [Test 2 Passed] #임시채널 was automatically destroyed and removed because users reached 0!');
          resolve();
        } else {
          console.log('Channel still in list with user count:', tempCh.userCount);
        }
      }
    });
  });

  // Test 3: Mentioning 냥봇 in #자유대화 receives response
  console.log('\n--- Test 3: Bot Response in Service Channel ---');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bot mention response timeout')), 5000);

    client1.on('new_message', (msg) => {
      if (msg.sender && (msg.sender.isBot || msg.sender.userId === 'bot_nyaa')) {
        clearTimeout(timer);
        console.log(`✅ [Test 3 Passed] Bot responded in ${msg.roomId}: "${msg.content}" (Sender: ${msg.sender.nickname}, isOp: ${msg.sender.isOp})`);
        resolve();
      }
    });

    console.log('Sending mention to 냥봇...');
    client1.emit('send_message', {
      roomId: '#자유대화',
      content: '냥봇 안녕! 오늘 몇시야?'
    });
  });

  // Test 4: 1:1 DM with Bot
  console.log('\n--- Test 4: 1:1 DM with Bot ---');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bot DM response timeout')), 5000);

    const dmRoomId = 'dm_bot_nyaa_test_user_1';

    client1.emit('switch_room', {
      targetType: 'dm',
      targetId: 'bot_nyaa'
    });

    setTimeout(() => {
      client1.on('new_message', (msg) => {
        if (msg.sender && (msg.sender.isBot || msg.sender.userId === 'bot_nyaa') && msg.roomId.startsWith('dm_')) {
          clearTimeout(timer);
          console.log(`✅ [Test 4 Passed] Bot responded in DM ${msg.roomId}: "${msg.content}"`);
          resolve();
        }
      });

      console.log('Sending DM to bot_nyaa...');
      client1.emit('send_message', {
        roomId: dmRoomId,
        content: '도움말 좀 알려줘'
      });
    }, 300);
  });

  console.log('\n🎉 ALL BOT & AUTO-DELETION TESTS PASSED SUCCESSFULLY! 🎉\n');
  client1.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
