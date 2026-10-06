const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('--- Starting OmniChat E2E Simulation Test ---');

  const client1 = io(SERVER_URL);
  const client2 = io(SERVER_URL);

  const u1 = { userId: 'user_alice_1', nickname: '앨리스', avatar: '👩‍🎨' };
  const u2 = { userId: 'user_bob_2', nickname: '밥', avatar: '👨‍🚀' };

  let checks = {
    c1_init: false,
    c2_init: false,
    group_text: false,
    upload_blocked_group: false,
    dm_blocked: false,
    whois_success: false
  };

  await new Promise((resolve) => {
    let connected = 0;
    const onConnect = () => {
      connected++;
      if (connected === 2) resolve();
    };
    client1.on('connect', onConnect);
    client2.on('connect', onConnect);
  });
  console.log('✔ Both clients connected to Socket.io server.');

  // User joins
  client1.emit('user_join', u1);
  client2.emit('user_join', u2);

  client1.on('init_state', (data) => {
    console.log(`✔ Client 1 initialized. Channels: ${data.channels.length}, Nick: ${data.user.nickname}`);
    checks.c1_init = true;
  });

  client2.on('init_state', (data) => {
    console.log(`✔ Client 2 initialized. Channels: ${data.channels.length}, Nick: ${data.user.nickname}`);
    checks.c2_init = true;
  });

  await new Promise((r) => setTimeout(r, 1000));

  // Step 1: Group text message
  client2.on('new_message', (msg) => {
    if (msg.content === '안녕하세요 밥님!' && msg.roomId === '#자유대화') {
      console.log('✔ User 2 received Group Text Message from User 1:', msg.content);
      checks.group_text = true;
    }
  });

  // Client 1 system message listener for upload rejection and DM rejection
  client1.on('new_message', (msg) => {
    if (msg.type === 'system' && msg.content.includes('업로드 기능은 서버 정책에 따라 지원하지 않습니다')) {
      console.log('✔ User 1 received upload blocked notification.');
      checks.upload_blocked_group = true;
    }
    if (msg.type === 'system' && msg.content.includes('1:1 대화 기능은 서버 정책에 따라 분리/비활성화되어 있습니다')) {
      console.log('✔ User 1 received 1:1 DM blocked notification.');
      checks.dm_blocked = true;
    }
  });

  client1.emit('send_message', {
    roomId: '#자유대화',
    content: '안녕하세요 밥님!',
    type: 'text'
  });

  await new Promise((r) => setTimeout(r, 500));

  // Step 2: Test Group Image message (Should be rejected)
  client1.emit('send_message', {
    roomId: '#자유대화',
    content: '마스코트 고양이 사진 공유 시도',
    type: 'image',
    fileInfo: {
      url: '/uploads/sample_image.jpg',
      originalName: 'sample_image.jpg',
      size: 622546,
      mimetype: 'image/jpeg',
      fileType: 'image'
    }
  });

  await new Promise((r) => setTimeout(r, 500));

  // Step 3: Test 1:1 Direct Message (Should be blocked per user policy)
  client1.emit('switch_room', { targetType: 'dm', targetId: u2.userId });

  await new Promise((r) => setTimeout(r, 500));

  // Step 4: Test IRC WHOIS user information query
  client1.on('whois_result', (data) => {
    if (data.target === u2.nickname && data.formattedText.includes('밥 님의 사용자 정보')) {
      console.log('✔ User 1 received WHOIS result for User 2.');
      checks.whois_success = true;
    }
  });

  client1.emit('whois', { target: u2.nickname });

  await new Promise((r) => setTimeout(r, 1000));

  client1.disconnect();
  client2.disconnect();

  console.log('\n--- Test Results Summary ---');
  console.log(checks);

  const allPassed = Object.values(checks).every(Boolean);
  if (allPassed) {
    console.log('\n🎉 ALL E2E CHAT TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.error('\n❌ Some checks failed.');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
