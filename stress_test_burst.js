const io = require('socket.io-client');

const SERVER_URL = process.env.TARGET_URL || 'http://nemulo.duckdns.org:3000';

const CHANNELS_DATA = [
  { name: '자유대화', users: ['자유인', '수다쟁이', '네코미미', '방랑자', '냥이친구', '바람돌이', '프로접속러', '채팅요정', '밤하늘', '첫눈'] },
  { name: '음악감상', users: ['비트마스터', '멜로디', '재즈피아노', '록스피릿', '인디보컬', '베이스러버', '턴테이블', '헤드폰요정', '어쿠스틱', '드러머K'] },
  { name: '게임이야기', users: ['게이머루키', '치킨헌터', '마나포션', '스팀매니아', '콘솔러', '퀘스트헌터', '길드마스터', '레이드탱커', '피지컬괴물', '로그라이크'] },
  { name: '코딩개발', users: ['풀스택냥', '깃마스터', '버그사냥꾼', '파이썬도사', '타스매니아', '도커선장', '리눅서', '클라우드러', '코딩달팽이', '알고리즘봇'] },
  { name: '맛집공유', users: ['미식가', '고독한식객', '라멘순례자', '빵돌이', '달콤디저트', '고기파티', '초밥러버', '치맥러버', '떡볶이탐험가', '카페라떼'] },
  { name: '애니만화', users: ['오타쿠', '작화감독', '성우덕후', '신작애니봇', '만화카페주인', '명작탐구', '극장판러버', '코스어', '라노벨마스터', '코믹스러버'] },
  { name: '영화드라마', users: ['시네필', '팝콘킬러', '넷플릭스러', '감독의눈', '쿠키영상', '정주행러', '명대사수집가', '스릴러매니아', 'SF영화팬', '필름카메라'] },
  { name: '반려동물', users: ['고양이집사', '골든댕댕이', '햄스터볼', '츄르조공러', '앵무새친구', '냥냥펀치', '꼬리살랑', '냥스타', '멍멍이보호자', '캣닢중독'] },
  { name: '일상수다', users: ['햇살가득', '퇴근길', '새벽감성', '커피한잔', '월요병극복', '힐링타임', '야식생각', '주말언제와', '소소한행복', '비오는날'] },
  { name: '운동건강', users: ['헬스보이', '런닝맨', '단백질쉐이크', '오운완', '필라테스러', '스트레칭', '홈트요정', '클라이머', '수영꿈나무', '자전거라이더'] }
];

const AVATARS = ['🧑‍💻', '👩‍💻', '🧑‍🎨', '👩‍🎨', '👨‍🚀', '🐱', '🐶', '🦊', '🐼', '🦁', '🐨', '🐯'];

const TOTAL_ROUNDS = 10;
const ROUND_INTERVAL_MS = 500; // 10 rounds over 5 seconds (500ms * 10 = 5000ms)

async function runBurstStressTest() {
  console.log(`================================================================`);
  console.log(`🔥 [버스트 부하 테스트] 100명 전원 5초간 10회 동시 발송 시나리오`);
  console.log(`🎯 대상 서버: ${SERVER_URL}`);
  console.log(`⚡ 조건: 100명 동시 전송 × 10회 = 총 1,000건 메시지 폭풍 발송`);
  console.log(`⏱️ 발송 주기: 0.5초(500ms)마다 100명 전원 동시 일제 사격`);
  console.log(`================================================================\n`);

  const sockets = [];
  let userCounter = 0;
  let receivedCount = 0;

  console.log(`[1/3] 100명 가상 유저 연결 및 10개 채널 분산 입장 진행 중...`);

  // Connect 100 users
  for (let chIndex = 0; chIndex < CHANNELS_DATA.length; chIndex++) {
    const ch = CHANNELS_DATA[chIndex];
    const channelId = ch.name === '자유대화' ? '#자유대화' : `#${ch.name}`;

    for (let uIndex = 0; uIndex < ch.users.length; uIndex++) {
      userCounter++;
      const nickname = ch.users[uIndex];
      const userId = `burst_u_${chIndex}_${uIndex}_${Math.random().toString(36).substring(2, 6)}`;
      const avatar = AVATARS[userCounter % AVATARS.length];

      await new Promise(r => setTimeout(r, 40));

      const socket = io(SERVER_URL, {
        reconnection: false,
        transports: ['websocket']
      });

      socket.on('connect', () => {
        socket.emit('user_join', { userId, nickname, avatar });
        if (channelId !== '#자유대화') {
          setTimeout(() => {
            socket.emit('join_channel', { channelName: ch.name, topic: `${ch.name} 버스트 테스트` });
          }, 150);
        }
      });

      socket.on('new_message', () => {
        receivedCount++;
      });

      sockets.push({
        socket,
        nickname,
        userId,
        channelId
      });
    }
  }

  // Wait 2.5 seconds for all users to settle in their rooms
  console.log(`[2/3] 모든 유저 채널 입장 완료. 잠시 대기 후 일제 사격을 개시합니다... (2초 후 시작)`);
  await new Promise(r => setTimeout(r, 2000));

  console.log(`\n🚨 [3/3] 버스트 일제 사격 카운트다운: 3... 2... 1... START!!\n`);

  let totalSent = 0;
  const startTime = Date.now();

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const roundStart = Date.now();
    const roundMsg = `[동시발송 #${round}/10] 🔥 100인 버스트 테스트 메시지입니다!`;

    // ALL 100 users emit at the exact same moment
    for (const item of sockets) {
      if (item.socket.connected) {
        item.socket.emit('send_message', {
          roomId: item.channelId,
          content: `${roundMsg} (${item.nickname})`,
          type: 'text'
        });
        totalSent++;
      }
    }

    const elapsedSoFar = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`💥 [라운드 ${round}/${TOTAL_ROUNDS}] 100명 전원 동시 발송 완료! (누적 발송: ${totalSent}건 | 경과 시간: ${elapsedSoFar}초)`);

    // Wait until next round interval
    const timeSpent = Date.now() - roundStart;
    const waitTime = Math.max(0, ROUND_INTERVAL_MS - timeSpent);
    if (round < TOTAL_ROUNDS) {
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const throughput = (totalSent / totalTime).toFixed(1);

  // Wait 2 seconds for server to broadcast all messages
  await new Promise(r => setTimeout(r, 2000));

  console.log(`\n================================================================`);
  console.log(`🎉 [버스트 부하 테스트 완료 결과]`);
  console.log(`- 총 발송 메시지 수 : ${totalSent} 건`);
  console.log(`- 소요 시간        : ${totalTime} 초 (목표 5초 내 완주)`);
  console.log(`- 초당 처리량(TPS) : ${throughput} msg/sec`);
  console.log(`- 수신된 브로드캐스트 : ${receivedCount.toLocaleString()} 패킷 처리 완료`);
  console.log(`================================================================`);
  console.log(`\n💡 브라우저(http://nemulo.duckdns.org:3000)에서 10개 방에 쏟아진 1,000건의 메시지를 확인하세요!`);
  console.log(`(연결은 20초간 유지된 후 자동 정리됩니다)\n`);

  // Keep connections alive for 20 seconds so user can see it in browser
  await new Promise(r => setTimeout(r, 20000));

  console.log('🛑 테스트 소켓들을 정상 해제합니다.');
  for (const s of sockets) {
    if (s.socket) s.socket.disconnect();
  }
  console.log('✅ 전원 정리 완료.');
  process.exit(0);
}

runBurstStressTest().catch(err => {
  console.error('Burst test error:', err);
  process.exit(1);
});
