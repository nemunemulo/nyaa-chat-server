const io = require('socket.io-client');

const SERVER_URL = process.env.TARGET_URL || 'http://nemulo.duckdns.org:3000';

const CHANNELS_DATA = [
  {
    name: '자유대화',
    topic: '모든 사용자와 자유롭게 대화하는 광장입니다.',
    users: ['자유인', '수다쟁이', '네코미미', '방랑자', '냥이친구', '바람돌이', '프로접속러', '채팅요정', '밤하늘', '첫눈'],
    messages: [
      '안녕하세요 모두 반갑습니다!',
      '오라클 클라우드 서버 쾌적하네요 ㅎㅎ',
      '냥봇 안녕!',
      '다들 어디서 오셨나요?',
      '채팅 반응속도 엄청 빠르네요!',
      '렉 없이 잘 돌아가네요 굿굿',
      '접속 유저 진짜 많아졌다!',
      '새로운 채팅방 많이 생겼네요',
      '오늘 날씨 너무 좋지 않나요?',
      '점심 뭐 드셨어요?'
    ]
  },
  {
    name: '음악감상',
    topic: '좋아하는 음악과 플레이리스트를 공유해요 🎧',
    users: ['비트마스터', '멜로디', '재즈피아노', '록스피릿', '인디보컬', '베이스러버', '턴테이블', '헤드폰요정', '어쿠스틱', '드러머K'],
    messages: [
      '요즘 뉴진스 노래 계속 듣고 있어요',
      '재즈 피아노 명곡 추천받습니다',
      '어쿠스틱 기타 소리가 참 편안하네요',
      '밴드 음악 좋아하시는 분 계신가요?',
      '로파이(Lo-Fi) 비트 들으면서 코딩 중입니다',
      '새 이어폰 샀는데 공간감이 장난 아니네요',
      '플레이리스트 교환하실 분!',
      '비 오는 날엔 역시 감성 발라드죠',
      '베이스 리프가 귀에 맴도네요',
      '오늘 퇴근길 노래는 이걸로 정했다'
    ]
  },
  {
    name: '게임이야기',
    topic: '스팀, 콘솔, 모바일 게임 자유 토크 🎮',
    users: ['게이머루키', '치킨헌터', '마나포션', '스팀매니아', '콘솔러', '퀘스트헌터', '길드마스터', '레이드탱커', '피지컬괴물', '로그라이크'],
    messages: [
      '오늘 밤에 같이 듀오 뛰실 분 구합니다',
      '스팀 세일 시작했는데 지갑이 위험하네요',
      '이번 보스 패턴 너무 어렵지 않나요? ㅠㅠ',
      '드디어 전설 무기 드랍했습니다!! ㅊㅊ 부탁',
      '패드 조작감이 키마보다 훨씬 편하네요',
      '로그라이크는 한 판만 더 하려다 밤샙니다',
      '게임 최적화 잘 되어 있네요',
      '신작 트레일러 그래픽 미쳤던데요',
      '길드원 상시 모집 중입니다',
      '핑 10ms로 아주 쾌적하게 플레이 중'
    ]
  },
  {
    name: '코딩개발',
    topic: '개발 지식과 잡담을 나누는 개발자 방 💻',
    users: ['풀스택냥', '깃마스터', '버그사냥꾼', '파이썬도사', '타스매니아', '도커선장', '리눅서', '클라우드러', '코딩달팽이', '알고리즘봇'],
    messages: [
      'Socket.io 웹소켓 통신 성능이 진짜 깔끔하네요',
      '오라클 클라우드 프리티어 가성비 갓입니다',
      'TypeScript strict 모드는 필수입니다',
      '드디어 오늘 디버깅 한 건 해결했습니다',
      '도커 컨테이너로 띄우니까 관리하기 넘 편해요',
      '우분투 iptables 방화벽 설정 필수죠',
      'Node.js 20 버전 LTS 아주 안정적입니다',
      'CI/CD 파이프라인 구축 중인데 뿌듯하네요',
      '깃 커밋 컨벤션 맞추는 거 습관 들이는 중',
      '커피 한 잔 마시고 빌드 돌려야겠습니다'
    ]
  },
  {
    name: '맛집공유',
    topic: '전국 숨은 맛집과 요리 레시피 공유 🍜',
    users: ['미식가', '고독한식객', '라멘순례자', '빵돌이', '달콤디저트', '고기파티', '초밥러버', '치맥러버', '떡볶이탐험가', '카페라떼'],
    messages: [
      '홍대 쪽에 진짜 인생 라멘집 발견했어요',
      '오늘 저녁은 삼겹살에 된장찌개 갑니다',
      '소금빵 갓 구워져 나왔을 때가 최고죠',
      '매운 떡볶이에 튀김 조합 못 참습니다',
      '퇴근 후 시원한 생맥주 한 잔의 행복!',
      '초밥 오마카세 예약 성공했네요 ㅎㅎ',
      '에어프라이어로 통삼겹 구웠는데 겉바속촉 대박',
      '디저트로 딸기 케이크 어떠세요?',
      '국밥에 깍두기 국물 넣는 파 vs 안 넣는 파',
      '여기는 커피 향이 진짜 깊고 맛있네요'
    ]
  },
  {
    name: '애니만화',
    topic: '애니메이션, 만화, 서브컬처 라운지 🍿',
    users: ['오타쿠', '작화감독', '성우덕후', '신작애니봇', '만화카페주인', '명작탐구', '극장판러버', '코스어', '라노벨마스터', '코믹스러버'],
    messages: [
      '이번 분기 신작 액션 작화 진짜 미쳤던데요',
      '극장판 엔딩 크레딧 보고 여운이 남네요',
      '원작 만화책 전권 소장 완료했습니다',
      '성우분 연기력이 몰입감을 확 올려주네요',
      '주말에 만화카페 가서 하루 종일 있고 싶다',
      'OP 노래가 중독성 있어서 무한 반복 중',
      '다음 화 언제 나오죠 현기증 납니다',
      '피규어 새로 하나 장만했는데 퀄리티 좋네요',
      '클래식 명작 애니는 다시 봐도 감동입니다',
      '애니 속 배경지 성지순례 가보고 싶어요'
    ]
  },
  {
    name: '영화드라마',
    topic: '최신 영화 리뷰와 인생 드라마 추천 🎬',
    users: ['시네필', '팝콘킬러', '넷플릭스러', '감독의눈', '쿠키영상', '정주행러', '명대사수집가', '스릴러매니아', 'SF영화팬', '필름카메라'],
    messages: [
      '이번 영화 반전 대박이네요 스포는 금지!',
      '아이맥스로 보고 왔는데 사운드 압도적입니다',
      '드라마 1화부터 정주행 시작했습니다',
      '쿠키 영상 꼭 2개 다 보고 나오세요',
      'SF 장르 연출이 너무 세련되었어요',
      '배우들 연기 앙상블이 아주 훌륭합니다',
      '주말에 볼만한 넷플릭스 시리즈 추천해 주세요',
      '마지막 씬 명대사가 가슴을 울리네요',
      '영상미랑 조명이 예술인 작품입니다',
      '카라멜 팝콘 대짜 혼자 다 먹었네요 ㅋㅋ'
    ]
  },
  {
    name: '반려동물',
    topic: '우리 귀여운 댕냥이들과 소동물 이야기 🐾',
    users: ['고양이집사', '골든댕댕이', '햄스터볼', '츄르조공러', '앵무새친구', '냥냥펀치', '꼬리살랑', '냥스타', '멍멍이보호자', '캣닢중독'],
    messages: [
      '우리 집 고양이가 키보드 위에 누웠어요 ㅋㅋㅋ',
      '퇴근하고 문 열면 꼬리 흔드는 댕댕이 힐링 그 자체',
      '츄르 하나 뜯으니까 눈이 번쩍 뜨이네요',
      '골골송 부르면서 꾹꾹이 해줍니다',
      '강아지 산책 1시간 코스 다녀왔어요',
      '햄스터 해바라기씨 볼주머니에 빵빵하게 넣음 귀여워',
      '식빵 굽는 자세가 너무 완벽합니다',
      '사료 바꿨는데 다행히 잘 먹네요',
      '발바닥 젤리 냄새 고소해요',
      '반려동물은 사랑입니다 ❤️'
    ]
  },
  {
    name: '일상수다',
    topic: '소소한 하루 이야기와 쉼터 ☕',
    users: ['햇살가득', '퇴근길', '새벽감성', '커피한잔', '월요병극복', '힐링타임', '야식생각', '주말언제와', '소소한행복', '비오는날'],
    messages: [
      '오늘 하루도 다들 고생 많으셨습니다!',
      '따뜻한 아메리카노 한 잔 마시며 휴식 중',
      '퇴근 지하철에 사람 진짜 많네요',
      '내일은 금요일이라 벌써 기분 좋습니다',
      '야식으로 라면 끓일까 심각하게 고민 중...',
      '하루 만보 걷기 오늘 성공했네요',
      '창밖으로 노을 지는 게 참 예쁩니다',
      '다들 편안한 저녁 시간 보내세요~',
      '소소한 일상이 주는 행복이 제일인 것 같아요',
      '오늘 밤에는 꿀잠 자야겠습니다'
    ]
  },
  {
    name: '운동건강',
    topic: '오운완! 헬스, 러닝, 홈트, 건강 정보 공유 💪',
    users: ['헬스보이', '런닝맨', '단백질쉐이크', '오운완', '필라테스러', '스트레칭', '홈트요정', '클라이머', '수영꿈나무', '자전거라이더'],
    messages: [
      '오늘 하체 운동 끝내고 오운완 인증합니다!',
      '러닝 5km 25분 페이스 달렸네요 상쾌합니다',
      '운동 끝나고 단백질 쉐이크 한 잔 필수',
      '자세 교정엔 필라테스가 진짜 좋은 것 같아요',
      '퇴근 후 헬스장 가는 게 제일 힘들지만 뿌듯',
      '스트레칭 10분만 해도 몸이 가벼워지네요',
      '클라이밍 볼더링 파란 난이도 완등 성공!',
      '물 하루 2리터 마시기 실천 중입니다',
      '주말에 자전거 타고 한강 한 바퀴 돌아야겠어요',
      '다들 부상 없이 건강하게 득근하세요!'
    ]
  }
];

const AVATARS = ['🧑‍💻', '👩‍💻', '🧑‍🎨', '👩‍🎨', '👨‍🚀', '🐱', '🐶', '🦊', '🐼', '🦁', '🐨', '🐯'];

async function startSimulation() {
  console.log(`====================================================`);
  console.log(`🚀 Nyaa Chat 100인 동시 접속 & 10개 채널 부하 테스트 시작`);
  console.log(`🎯 대상 서버: ${SERVER_URL}`);
  console.log(`📊 채널: 10개 | 총 유저 수: 100명`);
  console.log(`====================================================\n`);

  const sockets = [];
  let userCounter = 0;

  for (let chIndex = 0; chIndex < CHANNELS_DATA.length; chIndex++) {
    const ch = CHANNELS_DATA[chIndex];
    const channelId = ch.name === '자유대화' ? '#자유대화' : `#${ch.name}`;

    console.log(`[채널 ${chIndex + 1}/10] ${channelId} 유저 10명 생성 중...`);

    for (let uIndex = 0; uIndex < ch.users.length; uIndex++) {
      userCounter++;
      const nickname = ch.users[uIndex];
      const userId = `sim_user_${chIndex}_${uIndex}_${Math.random().toString(36).substring(2, 6)}`;
      const avatar = AVATARS[userCounter % AVATARS.length];

      // Stagger connections by 80ms to avoid handshake flooding
      await new Promise(r => setTimeout(r, 80));

      const socket = io(SERVER_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        // Register user
        socket.emit('user_join', {
          userId,
          nickname,
          avatar,
          statusText: `${ch.name} 참여 중 ✨`
        });

        // If not default channel, join target channel
        if (channelId !== '#자유대화') {
          setTimeout(() => {
            socket.emit('join_channel', {
              channelName: ch.name,
              topic: ch.topic
            });
          }, 300);
        }
      });

      // Keep reference
      sockets.push({
        socket,
        nickname,
        userId,
        channelId,
        channelData: ch
      });
    }
  }

  console.log(`\n✅ 100명 유저 전원 연결 완료!`);
  console.log(`💬 지금부터 10개 채널에서 실시간 대화 패킷을 지속적으로 송출합니다.`);
  console.log(`👀 브라우저(http://nemulo.duckdns.org:3000)를 새로고침하여 채널 목록과 실시간 대화를 확인하세요!\n`);

  // Periodic active chat simulation
  // Every 1~2.5 seconds, pick a random user to send a realistic message
  const chatInterval = setInterval(() => {
    if (sockets.length === 0) return;
    
    // Pick 1 to 3 random users per tick to chat concurrently
    const numChatters = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numChatters; i++) {
      const targetUser = sockets[Math.floor(Math.random() * sockets.length)];
      if (targetUser && targetUser.socket.connected) {
        const msgs = targetUser.channelData.messages;
        const msgContent = msgs[Math.floor(Math.random() * msgs.length)];

        targetUser.socket.emit('send_message', {
          roomId: targetUser.channelId,
          content: msgContent,
          type: 'text'
        });
      }
    }
  }, 1200);

  // Graceful shutdown handling
  const cleanup = () => {
    console.log('\n🛑 부하 테스트 종료 중... 모든 소켓 연결을 정리합니다.');
    clearInterval(chatInterval);
    for (const item of sockets) {
      if (item.socket) item.socket.disconnect();
    }
    console.log('✅ 전원 퇴장 완료.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startSimulation().catch(err => {
  console.error('Simulation error:', err);
});
