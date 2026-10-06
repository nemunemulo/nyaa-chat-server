# 🐾 Nyaa Chat Server

Node.js와 Socket.IO 기반의 실시간 채팅 서버입니다. 별도의 외부 데이터베이스 없이 파일 기반으로 데이터를 저장하며, 웹 브라우저 및 전용 데스크톱 클라이언트와 연동됩니다.

- 🖥️ **전용 데스크톱 클라이언트 (Windows)**: [nyaa-chat-client 저장소 바로가기](https://github.com/nemunemulo/nyaa-chat-client)

---

## 📁 디렉터리 구조

```text
nyaa-chat-server/
├── server.js                  # 메인 서버 (Express + Socket.IO)
├── package.json               # 프로젝트 의존성 설정
├── .env.example               # 환경변수 설정 예시 파일
├── modules/                   # 서버 기능 모듈
│   ├── antiSpam.js            # 도배 방지 및 필터링
│   ├── dmModule.js            # 1:1 귓속말
│   ├── fsSafe.js              # 파일 쓰기 보조
│   ├── nickServ.js            # 닉네임 등록 및 인증
│   ├── peerDirectoryModule.js # 이웃 서버 목록 동기화
│   └── uploadModule.js        # 파일 첨부 처리
├── public/                    # 내장 웹 클라이언트
│   ├── index.html             # 웹 채팅 UI 마크업
│   ├── app.js                 # 클라이언트 스크립트
│   └── style.css              # 반응형 스타일시트
├── data/                      # 런타임 데이터 (Git 제외)
│   ├── .gitkeep
│   └── peers_whitelist.example.txt # 화이트리스트 서버 설정 예시
└── uploads/                   # 파일 첨부 저장소 (Git 제외)
    └── .gitkeep
```

---

## 🚀 빠른 시작

### 1. 설치
```bash
git clone https://github.com/nemunemulo/nyaa-chat-server.git
cd nyaa-chat-server
npm install
```

### 2. 환경변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 관리자 계정 정보를 설정합니다.
```bash
cp .env.example .env
```

```env
PORT=3000
OPER_USER=admin
OPER_PASS=your_password
NODE_ENV=production
```

### 3. 서버 실행
```bash
# 개발 모드
npm run dev

# 일반 실행
npm start
```
서버 실행 후 웹 브라우저에서 `http://localhost:3000` (또는 설정한 포트)으로 접속할 수 있습니다.

---

## 🌐 프로덕션 배포 가이드

### PM2 백그라운드 서비스 등록
```bash
npm install -g pm2
pm2 start server.js --name nyaachat
pm2 save
pm2 startup
```

### Caddy 역방향 프록시 예시 (`/etc/caddy/Caddyfile`)
```caddy
your-domain.com {
    reverse_proxy localhost:3000
}
```

---

## 💬 주요 슬래시 명령어

### 일반 사용자 명령어
| 명령어 | 설명 | 예시 |
| :--- | :--- | :--- |
| `/help` | 사용 가능한 명령어 도움말 확인 | `/help` |
| `/nick <새닉네임>` | 닉네임 변경 | `/nick 냥이` |
| `/join <채널명> [암호]` | 채널 입장 (없으면 새로 개설) | `/join #자유대화` |
| `/part` 또는 `/leave` | 현재 채널에서 퇴장 | `/part` |
| `/list [검색어]` | 공개 채널 목록 조회 | `/list 게임` |
| `/whois <닉네임>` | 유저 정보 조회 | `/whois 철수` |
| `/msg <닉네임> <내용>` | 1:1 귓속말 전송 | `/msg 영희 안녕!` |
| `/me <행동>` | 3인칭 행동 묘사 메시지 | `/me 기지개를 켠다` |
| `/ping` | 서버 지연시간(RTT) 측정 | `/ping` |
| `/stats` | 서버 통계 조회 | `/stats` |
| `/clear` | 현재 화면 대화 버퍼 청소 | `/clear` |

### 닉네임 관리 (NickServ)
| 명령어 | 설명 | 예시 |
| :--- | :--- | :--- |
| `/register <비밀번호>` | 닉네임 등록 | `/register mypass123` |
| `/identify <비밀번호>` | 등록된 닉네임 인증 | `/identify mypass123` |
| `/nickpass <새비밀번호>` | 닉네임 비밀번호 변경 | `/nickpass newpass456` |
| `/unregister <비밀번호>` | 닉네임 등록 해제 | `/unregister mypass123` |

### 채널 관리 (방장 `@` 전용)
| 명령어 / 모드 | 설명 | 예시 |
| :--- | :--- | :--- |
| `/topic <주제>` | 채널 주제 변경 | `/topic 공지사항` |
| `/op <닉네임>` | 다른 유저에게 방장 권한 부여 | `/op 친구` |
| `/deop <닉네임>` | 방장 권한 회수 | `/deop 친구` |
| `/kick <닉네임> [사유]`| 채널에서 유저 강제 퇴장 | `/kick 스패머` |
| `/mode +t` / `-t` | 방장만 토픽 변경 가능 여부 설정 | `/mode +t` |
| `/mode +n` / `-n` | 외부 비참가자의 메시지 차단 | `/mode +n` |
| `/mode +k <비번>` / `-k` | 채널 비밀번호 설정 및 해제 | `/mode +k 1234` |
| `/mode +l <인원>` / `-l` | 채널 최대 인원 제한 설정 | `/mode +l 20` |
| `/mode +m` / `-m` | 방장/발언권 소지자만 대화 가능한 사회자 모드 | `/mode +m` |
| `/mode +i` / `-i` | 초대 전용 비공개 모드 | `/mode +i` |
| `/mode +s` / `-s` | 검색 목록에 노출되지 않는 비밀 모드 | `/mode +s` |

### 서버 관리자 (`/oper`) 전용
| 명령어 | 설명 | 예시 |
| :--- | :--- | :--- |
| `/oper <ID> <PW>` | 관리자 권한 획득 | `/oper admin secret` |
| `/kline <닉/IP> [사유]` | 유저/IP 차단 | `/kline 불량유저` |
| `/unkline <IP>` | 차단 해제 | `/unkline 192.168.1.10` |
| `/peer add <주소>` | 이웃 서버 등록 | `/peer add https://node2.org` |
| `/peer del <주소>` | 이웃 서버 등록 해제 | `/peer del https://node2.org` |
| `/peer list` | 등록된 이웃 서버 목록 조회 | `/peer list` |
| `/peer sync` | 이웃 서버들과 목록 동기화 | `/peer sync` |

---

## 📜 라이선스

이 프로젝트는 [MIT License](LICENSE)에 따라 자유롭게 사용, 수정, 배포할 수 있습니다.
