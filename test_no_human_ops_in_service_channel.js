const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function run() {
  console.log('=== Test: No Human Operators in Service Channel ===');

  const rand = Math.random().toString(36).substring(2, 6);
  const nick1 = `검증자1_${rand}`;
  const nick2 = `검증자2_${rand}`;

  const client1 = io(SERVER_URL, { reconnection: false });

  // 1. Client 1 joins #자유대화
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout step 1')), 5000);

    client1.on('login_error', (err) => {
      clearTimeout(timer);
      reject(new Error('Login error: ' + err.message));
    });

    const onConnected = () => {
      client1.emit('user_join', {
        userId: 'user_u1_' + rand,
        nickname: nick1
      });
    };

    if (client1.connected) {
      onConnected();
    } else {
      client1.once('connect', onConnected);
    }

    client1.on('init_state', (data) => {
      clearTimeout(timer);
      const freeCh = data.channels.find(c => c.id === '#자유대화');
      console.log(`${nick1} joined #자유대화. Operators:`, freeCh.operators);
      if (freeCh.operators.includes('user_u1_' + rand)) {
        return reject(new Error(`${nick1} should NOT be operator in #자유대화!`));
      }
      if (freeCh.operators.length !== 1 || freeCh.operators[0] !== 'bot_nyaa') {
        return reject(new Error(`Expected only [bot_nyaa], got: ${JSON.stringify(freeCh.operators)}`));
      }
      console.log('✅ [Pass 1] Regular human user is NOT operator in #자유대화. Operators:', freeCh.operators);
      resolve();
    });
  });

  // 2. Client 2 joins #자유대화
  const client2 = io(SERVER_URL, { reconnection: false });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout step 2')), 5000);

    let msgChecked = false;
    let chChecked = false;

    const checkBoth = () => {
      if (msgChecked && chChecked) {
        clearTimeout(timer);
        resolve();
      }
    };

    client1.on('new_message', (msg) => {
      if (msg.type === 'system' && msg.content.includes(nick2)) {
        console.log('Join message received for user 2:', msg.content);
        if (msg.content.includes('@' + nick2)) {
          clearTimeout(timer);
          return reject(new Error(`Join message should NOT have @ for ${nick2} in #자유대화!`));
        }
        console.log('✅ [Pass 2] Join message has NO @ for regular user in #자유대화.');
        msgChecked = true;
        checkBoth();
      }
    });

    client2.on('init_state', (data) => {
      const freeCh = data.channels.find(c => c.id === '#자유대화');
      if (freeCh) {
        if (freeCh.operators.includes('user_u1_' + rand) || freeCh.operators.includes('user_u2_' + rand)) {
          clearTimeout(timer);
          return reject(new Error(`Humans found in operators: ${JSON.stringify(freeCh.operators)}`));
        }
        console.log('✅ [Pass 3] In init_state, operators strictly remain [bot_nyaa]:', freeCh.operators);
        chChecked = true;
        checkBoth();
      }
    });

    const onConnected2 = () => {
      client2.emit('user_join', {
        userId: 'user_u2_' + rand,
        nickname: nick2
      });
    };

    if (client2.connected) {
      onConnected2();
    } else {
      client2.once('connect', onConnected2);
    }
  });

  // 3. User creates a custom channel and DOES get operator
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout step 4')), 5000);
    client1.emit('join_channel', {
      channelName: '유저채널_' + rand,
      topic: '개인 채널'
    });

    client1.on('room_switched', (data) => {
      if (data.roomMeta && data.roomMeta.id === '#유저채널_' + rand) {
        clearTimeout(timer);
        console.log('User 1 switched to custom channel. Operators:', data.roomMeta.operators);
        if (!data.roomMeta.operators.includes('user_u1_' + rand)) {
          return reject(new Error('Creator SHOULD be operator in custom channel!'));
        }
        console.log('✅ [Pass 4] Creator correctly received @ operator in custom channel.');
        resolve();
      }
    });
  });

  console.log('\n🎉 ALL OPERATOR TESTS PASSED: NO HUMAN OPS IN SERVICE CHANNEL! 🎉\n');
  client1.disconnect();
  client2.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
