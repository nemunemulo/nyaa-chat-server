const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function testPersistenceAndScoping() {
  console.log('🧪 [Test] Starting Channel Persistence & Scoping Verification...\n');

  // Client 1 connects
  const client1 = io(SERVER_URL, { reconnection: false });
  await new Promise((resolve) => {
    client1.on('connect', () => {
      client1.emit('user_join', { userId: 'u_tester1', nickname: '테스터1', avatar: '🐱' });
      client1.on('init_state', (data) => {
        console.log('✅ Client 1 connected and joined #자유대화');
        resolve();
      });
    });
  });

  // Client 1 joins #관리자
  console.log('\n--- Step 1: Client 1 joins #관리자 ---');
  await new Promise((resolve) => {
    client1.emit('join_channel', { channelName: '관리자', topic: '관리자 전용 채널' });
    client1.once('room_switched', (data) => {
      console.log('✅ Room switched to:', data.roomMeta.id);
      resolve();
    });
  });

  // Verify #관리자 is in channel list with userCount 1
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Channel list timeout')), 3000);
    client1.once('channel_list_update', (channels) => {
      clearTimeout(timeout);
      const adminCh = channels.find(c => c.id === '#관리자');
      if (!adminCh) return reject(new Error('#관리자 channel missing!'));
      console.log('✅ #관리자 exists with userCount:', adminCh.userCount);
      resolve();
    });
  });

  // Step 2: Client 1 switches view back to #자유대화
  console.log('\n--- Step 2: Client 1 switches view back to #자유대화 (Must NOT delete #관리자) ---');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Switch room timeout')), 3000);
    client1.emit('switch_room', { targetType: 'channel', targetId: '#자유대화' });
    client1.once('room_switched', (data) => {
      clearTimeout(timeout);
      console.log('✅ Client 1 switched active view to:', data.roomMeta.id);
      resolve();
    });
  });

  // Wait 500ms and check channel list to ensure #관리자 is still alive!
  await new Promise(r => setTimeout(r, 500));
  await new Promise((resolve, reject) => {
    client1.emit('switch_room', { targetType: 'channel', targetId: '#자유대화' });
    client1.once('channel_list_update', (channels) => {
      const adminCh = channels.find(c => c.id === '#관리자');
      if (!adminCh) {
        return reject(new Error('FAILED: #관리자 was deleted when switching to #자유대화!'));
      }
      console.log('✅ [PASSED] #관리자 remains alive after switching view! userCount:', adminCh.userCount);
      resolve();
    });
  });

  // Step 3: Connect Client 2 (only in #자유대화) and verify user scoping
  console.log('\n--- Step 3: Client 2 connects to #자유대화 only; verify user list serialization ---');
  const client2 = io(SERVER_URL, { reconnection: false });
  await new Promise((resolve) => {
    client2.on('connect', () => {
      client2.emit('user_join', { userId: 'u_tester2', nickname: '테스터2', avatar: '🐶' });
      client2.once('user_list_update', (users) => {
        const u1 = users.find(u => u.userId === 'u_tester1');
        const u2 = users.find(u => u.userId === 'u_tester2');
        console.log('User 1 joinedChannels:', u1?.joinedChannels);
        console.log('User 2 joinedChannels:', u2?.joinedChannels);

        if (!u1?.joinedChannels?.includes('#관리자')) {
          throw new Error('User 1 joinedChannels should include #관리자');
        }
        if (u2?.joinedChannels?.includes('#관리자')) {
          throw new Error('User 2 joinedChannels should NOT include #관리자');
        }
        console.log('✅ [PASSED] User list accurately reports channel memberships!');
        resolve();
      });
    });
  });

  // Step 4: Client 1 parts #관리자 (/part) -> Must auto-delete #관리자!
  console.log('\n--- Step 4: Client 1 parts #관리자 -> Must be auto-deleted ---');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Part channel timeout')), 5000);
    client1.emit('part_channel', { channelId: '#관리자' });
    client1.on('channel_list_update', (channels) => {
      const adminCh = channels.find(c => c.id === '#관리자');
      if (!adminCh) {
        clearTimeout(timeout);
        console.log('✅ [PASSED] #관리자 was auto-deleted after explicit /part!');
        resolve();
      }
    });
  });

  // Step 5: Client 2 creates #임시방 then disconnects -> Must auto-delete on disconnect!
  console.log('\n--- Step 5: Client 2 creates #임시방 then disconnects -> Must auto-delete on disconnect ---');
  await new Promise((resolve) => {
    client2.emit('join_channel', { channelName: '임시방', topic: '퇴장 테스트 방' });
    client2.once('room_switched', () => {
      console.log('✅ Client 2 joined #임시방');
      resolve();
    });
  });

  await new Promise(r => setTimeout(r, 400));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Disconnect cleanup timeout')), 5000);
    client1.on('channel_list_update', (channels) => {
      const tempCh = channels.find(c => c.id === '#임시방');
      if (!tempCh) {
        clearTimeout(timeout);
        console.log('✅ [PASSED] #임시방 was auto-deleted when Client 2 disconnected!');
        resolve();
      }
    });
    console.log('Client 2 disconnecting...');
    client2.disconnect();
  });

  client1.disconnect();
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀');
  process.exit(0);
}

testPersistenceAndScoping().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
