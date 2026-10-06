const io = require('socket.io-client');

const socket = io('http://localhost:3000', { transports: ['websocket'] });

socket.on('connect', () => {
  socket.emit('user_join', { userId: 'u_tester_nyaa', nickname: '호출러', avatar: '🐱' });
});

socket.on('init_state', () => {
  socket.emit('send_message', { roomId: '#자유대화', content: '냥봇아' });
});

socket.on('new_message', (msg) => {
  if (msg.sender && msg.sender.nickname === '냥봇') {
    console.log('BOT_REPLY:', msg.content);
    if (msg.content === 'Nyaa~~~') {
      console.log('SUCCESS: Bot replied with Nyaa~~~');
      process.exit(0);
    } else {
      console.error('FAIL: Unexpected reply:', msg.content);
      process.exit(1);
    }
  }
});

setTimeout(() => {
  console.error('TIMEOUT');
  process.exit(1);
}, 4000);
