[English](README.en.md) | [한국어](README.md)

# 🐾 Nyaa Chat Server

A real-time chat server built with Node.js and Socket.IO. Stores data directly on the filesystem without external database dependencies, and supports both web browsers and dedicated native desktop clients.

- 🖥️ **Dedicated Desktop Client (Windows)**: [nyaa-chat-client Repository](https://github.com/nemunemulo/nyaa-chat-client)

---

## 📁 Directory Structure

```text
nyaa-chat-server/
├── server.js                  # Main server entry (Express + Socket.IO)
├── package.json               # Project dependencies and metadata
├── .env.example               # Environment variables template
├── modules/                   # Server feature modules
│   ├── antiSpam.js            # Spam mitigation & rate limiting
│   ├── dmModule.js            # 1:1 Direct messaging (whispers)
│   ├── fsSafe.js              # Atomic filesystem persistence helper
│   ├── nickServ.js            # Nickname registration & authentication
│   └── peerDirectoryModule.js # Neighbor server directory synchronization
├── public/                    # Built-in web client
│   ├── index.html             # Web chat markup
│   ├── app.js                 # Frontend application script
│   └── style.css              # Responsive dark theme stylesheet
└── data/                      # Runtime data directory (git-ignored)
    ├── .gitkeep
    └── peers_whitelist.example.txt # Whitelisted peer servers template
```

---

## 🔌 Architecture & Protocols

Nyaa Chat Server is an autonomous, lightweight real-time chat server combining traditional IRC workflows with modern WebSocket (Socket.IO v4) technology.

- **Real-Time Socket Communication**:
  - Leverages `Engine.IO v4 / Socket.IO v4` WebSocket and JSON events (`user_join`, `send_message`, `new_message`, `join_channel`, etc.) for lightweight bidirectional messaging.
- **Autonomous Distributed Network (Peer Directory Module)**:
  - Each server operates as an isolated chat space without replicating or cross-broadcasting message logs.
  - Neighboring servers (`peers`) exchange lightweight summary records (server health, online counts, and public channel listings) via HTTP REST authenticated with `x-peer-token`.
- **Client Freedom & Backward Compatibility**:
  - Provides broad compatibility with traditional IRC slash commands (`/join`, `/msg`, `/nick`, `/topic`, etc.), while ensuring server extensions remain decoupled from core messaging protocols.

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/nemunemulo/nyaa-chat-server.git
cd nyaa-chat-server
npm install
```

### 2. Environment Configuration
Copy `.env.example` to create your `.env` file and configure administrator credentials:
```bash
cp .env.example .env
```

```env
PORT=3000
ENABLE_WEB_CLIENT=false  # Default: false (Web browser chat disabled, native client only)
OPER_USER=admin
OPER_PASS=your_password
NODE_ENV=production
```

### 3. Running the Server
```bash
npm start
```
By default (`ENABLE_WEB_CLIENT=false`), users can only connect using the **dedicated desktop client (NyaaChat Client)**. Web browsers visiting the server will see an informational status page. To enable browser chat, set `ENABLE_WEB_CLIENT=true` in `.env`.

---

## 🌐 Production Deployment Guide

### Register with PM2 Background Process Manager
```bash
npm install -g pm2
pm2 start server.js --name nyaachat
pm2 save
pm2 startup
```

### Caddy Reverse Proxy Example (`/etc/caddy/Caddyfile`)
```caddy
your-domain.com {
    reverse_proxy localhost:3000
}
```

---

## 💬 Common Slash Commands

### General User Commands
| Command | Description | Example |
| :--- | :--- | :--- |
| `/help` | View list of available commands | `/help` |
| `/nick <new_nick>` | Change nickname | `/nick Nyaa` |
| `/join <#channel> [key]` | Join a channel (or create if absent) | `/join #gaming` |
| `/part` or `/leave` | Leave current channel | `/part` |
| `/list [keyword]` | List public channels | `/list gaming` |
| `/whois <nickname>` | View user information | `/whois Alice` |
| `/msg <nickname> <text>` | Send 1:1 whisper | `/msg Bob Hello!` |
| `/me <action>` | Send 3rd person action message | `/me stretches paws` |
| `/ping` | Check server latency (RTT) | `/ping` |
| `/stats` | View server statistics | `/stats` |
| `/clear` | Clear local screen chat buffer | `/clear` |

### Nickname Protection (NickServ)
| Command | Description | Example |
| :--- | :--- | :--- |
| `/register <password>` | Register current nickname | `/register mypass123` |
| `/identify <password>` | Authenticate registered nickname | `/identify mypass123` |
| `/nickpass <new_password>`| Change nickname password | `/nickpass newpass456` |
| `/unregister <password>` | Unregister nickname | `/unregister mypass123` |

### Channel Management (Operator `@` Only)
| Command / Mode | Description | Example |
| :--- | :--- | :--- |
| `/topic <topic>` | Change channel topic | `/topic Welcome to gaming room` |
| `/op <nickname>` | Grant operator status to user | `/op Alice` |
| `/deop <nickname>` | Revoke operator status from user | `/deop Alice` |
| `/kick <nickname> [reason]`| Kick user from channel | `/kick Spammer` |
| `/mode +t` / `-t` | Only operators may change topic | `/mode +t` |
| `/mode +n` / `-n` | Disallow messages from outside non-members | `/mode +n` |
| `/mode +k <key>` / `-k` | Set or remove channel password | `/mode +k 1234` |
| `/mode +l <limit>` / `-l` | Set channel user capacity limit | `/mode +l 20` |
| `/mode +m` / `-m` | Moderated mode: only ops/voices can speak | `/mode +m` |
| `/mode +i` / `-i` | Invite-only mode | `/mode +i` |
| `/mode +s` / `-s` | Secret mode (hidden from public list) | `/mode +s` |

### Server Operator (`/oper`) Only
| Command | Description | Example |
| :--- | :--- | :--- |
| `/oper <ID> <PW>` | Gain server operator privileges | `/oper admin secret` |
| `/kline <nick/IP> [reason]` | Ban user or IP | `/kline BadUser` |
| `/unkline <IP>` | Unban IP | `/unkline 192.168.1.10` |
| `/peer add <URL>` | Register neighbor peer server | `/peer add https://node2.org` |
| `/peer del <URL>` | Remove neighbor peer server | `/peer del https://node2.org` |
| `/peer list` | View list of registered peer servers | `/peer list` |
| `/peer sync` | Synchronize directory with peers | `/peer sync` |

---

## 📜 License

This project is licensed under the [MIT License](LICENSE). Feel free to use, modify, and distribute.
