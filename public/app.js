// =========================================================
// OmniChat Frontend Application Logic
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const nicknameInput = document.getElementById('nicknameInput');
  const avatarPickerBtn = document.getElementById('avatarPickerBtn');
  const selectedAvatarSpan = document.getElementById('selectedAvatar');
  const avatarPalette = document.getElementById('avatarPalette');

  const myAvatarDisplay = document.getElementById('myAvatarDisplay');
  const myNicknameDisplay = document.getElementById('myNicknameDisplay');
  const myIdDisplay = document.getElementById('myIdDisplay');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');

  const tabChannels = document.getElementById('tabChannels');
  const tabDMs = document.getElementById('tabDMs');
  const channelsSection = document.getElementById('channelsSection');
  const dmsSection = document.getElementById('dmsSection');
  const channelsList = document.getElementById('channelsList');
  const usersList = document.getElementById('usersList');
  const channelCountBadge = document.getElementById('channelCountBadge');
  const onlineUserCount = document.getElementById('onlineUserCount');
  const totalDmUnread = document.getElementById('totalDmUnread');

  const toggleLeftSidebarBtn = document.getElementById('toggleLeftSidebarBtn');
  const toggleRightSidebarBtn = document.getElementById('toggleRightSidebarBtn');
  const collapseLeftSidebarBtn = document.getElementById('collapseLeftSidebarBtn');
  const collapseRightSidebarBtn = document.getElementById('collapseRightSidebarBtn');
  const headerUserCount = document.getElementById('headerUserCount');
  const rightSidebar = document.getElementById('rightSidebar');

  const currentRoomIcon = document.getElementById('currentRoomIcon');
  const currentRoomTitle = document.getElementById('currentRoomTitle');
  const currentRoomTypeTag = document.getElementById('currentRoomTypeTag');
  const currentRoomDesc = document.getElementById('currentRoomDesc');
  const messagesContainer = document.getElementById('messagesContainer');
  const typingIndicatorBar = document.getElementById('typingIndicatorBar');
  const typingText = document.getElementById('typingText');

  const chatInputForm = document.getElementById('chatInputForm');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const attachBtn = document.getElementById('attachBtn');
  const fileInputElement = document.getElementById('fileInputElement');
  const attachmentPreviewBar = document.getElementById('attachmentPreviewBar');
  const attachIconPreview = document.getElementById('attachIconPreview');
  const attachFileName = document.getElementById('attachFileName');
  const attachFileSize = document.getElementById('attachFileSize');
  const removeAttachBtn = document.getElementById('removeAttachBtn');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const progressFill = document.getElementById('progressFill');
  const dragDropOverlay = document.getElementById('dragDropOverlay');

  const toggleGalleryBtn = document.getElementById('toggleGalleryBtn');
  const mediaCountBadge = document.getElementById('mediaCountBadge');
  const mediaDrawer = document.getElementById('mediaDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const drawerMediaList = document.getElementById('drawerMediaList');
  const countAll = document.getElementById('countAll');
  const countImages = document.getElementById('countImages');
  const countVideos = document.getElementById('countVideos');
  const countFiles = document.getElementById('countFiles');

  const imageLightbox = document.getElementById('imageLightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxFileName = document.getElementById('lightboxFileName');
  const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const appBackdrop = document.getElementById('appBackdrop');

  // Channel and Modal DOM Elements
  const openCreateChannelBtn = document.getElementById('openCreateChannelBtn');
  const openServerListBtn = document.getElementById('openServerListBtn');
  const createChannelModal = document.getElementById('createChannelModal');
  const createChannelForm = document.getElementById('createChannelForm');
  const newChannelNameInput = document.getElementById('newChannelNameInput');
  const newChannelTopicInput = document.getElementById('newChannelTopicInput');
  const newChannelKeyInput = document.getElementById('newChannelKeyInput');
  const newChannelLimitInput = document.getElementById('newChannelLimitInput');
  const closeCreateChannelBtn = document.getElementById('closeCreateChannelBtn');
  const cancelCreateChannelBtn = document.getElementById('cancelCreateChannelBtn');

  // 1:1 DMs Left Sidebar
  const dmCountBadge = document.getElementById('dmCountBadge');
  const dmConversationsList = document.getElementById('dmConversationsList');

  // Server List Modal (/list)
  const serverListModal = document.getElementById('serverListModal');
  const closeServerListBtn = document.getElementById('closeServerListBtn');
  const confirmServerListBtn = document.getElementById('confirmServerListBtn');
  const serverChannelSearchInput = document.getElementById('serverChannelSearchInput');
  const refreshServerListBtn = document.getElementById('refreshServerListBtn');
  const serverChannelsContainer = document.getElementById('serverChannelsContainer');
  const serverChannelTotalCount = document.getElementById('serverChannelTotalCount');

  // Channel Password Modal (+k)
  const channelKeyModal = document.getElementById('channelKeyModal');
  const closeChannelKeyBtn = document.getElementById('closeChannelKeyBtn');
  const cancelChannelKeyBtn = document.getElementById('cancelChannelKeyBtn');
  const channelKeyForm = document.getElementById('channelKeyForm');
  const channelKeyTargetRoomId = document.getElementById('channelKeyTargetRoomId');
  const channelKeyInput = document.getElementById('channelKeyInput');
  const channelKeyErrorMsg = document.getElementById('channelKeyErrorMsg');
  const channelKeyModalTitle = document.getElementById('channelKeyModalTitle');
  const channelKeyModalDesc = document.getElementById('channelKeyModalDesc');

  // Edit Topic & Channel Mode Elements
  const editTopicBtn = document.getElementById('editTopicBtn');
  const editTopicModal = document.getElementById('editTopicModal');
  const editTopicForm = document.getElementById('editTopicForm');
  const editTopicInput = document.getElementById('editTopicInput');
  const editChannelKeyInput = document.getElementById('editChannelKeyInput');
  const editChannelLimitInput = document.getElementById('editChannelLimitInput');
  const editChannelTopicLockCheck = document.getElementById('editChannelTopicLockCheck');
  const editChannelModeratedCheck = document.getElementById('editChannelModeratedCheck');
  const editChannelInviteOnlyCheck = document.getElementById('editChannelInviteOnlyCheck');
  const closeEditTopicBtn = document.getElementById('closeEditTopicBtn');
  const cancelEditTopicBtn = document.getElementById('cancelEditTopicBtn');

  const helpCmdBtn = document.getElementById('helpCmdBtn');
  const cmdHelpModal = document.getElementById('cmdHelpModal');
  const closeCmdHelpBtn = document.getElementById('closeCmdHelpBtn');
  const confirmCmdHelpBtn = document.getElementById('confirmCmdHelpBtn');
  const exportChatBtn = document.getElementById('exportChatBtn');

  // Multi-Server Whitelist Directory & Extended Module DOM Elements
  const openNetworkServersBtn = document.getElementById('openNetworkServersBtn');
  const headerServerListBtn = document.getElementById('headerServerListBtn');
  const multiServersList = document.getElementById('multiServersList');
  const currentServerBadge = document.getElementById('currentServerBadge');
  const serverExtBar = document.getElementById('serverExtBar');
  const serverExtBarLabel = document.getElementById('serverExtBarLabel');
  const serverExtBtnsContainer = document.getElementById('serverExtBtnsContainer');

  const networkServersModal = document.getElementById('networkServersModal');
  const closeNetworkServersBtn = document.getElementById('closeNetworkServersBtn');
  const confirmNetworkServersBtn = document.getElementById('confirmNetworkServersBtn');
  const refreshNetworkServersBtn = document.getElementById('refreshNetworkServersBtn');
  const networkServerTotalCount = document.getElementById('networkServerTotalCount');
  const networkServersListContainer = document.getElementById('networkServersListContainer');
  const selectedNetworkServerTitle = document.getElementById('selectedNetworkServerTitle');
  const selectedNetworkServerProto = document.getElementById('selectedNetworkServerProto');
  const selectedNetworkChannelsContainer = document.getElementById('selectedNetworkChannelsContainer');
  const selectedNetworkServerModulesBox = document.getElementById('selectedNetworkServerModulesBox');
  const directServerUrlInput = document.getElementById('directServerUrlInput');
  const directServerChannelInput = document.getElementById('directServerChannelInput');
  const directServerConnectBtn = document.getElementById('directServerConnectBtn');

  // App State
  let socket = null;
  let currentUser = null;
  let currentRoom = { type: 'channel', id: '#자유대화', name: '#자유대화', topic: '' };
  let pendingFile = null;
  let unreadCounts = {}; // roomId -> count
  let currentHistory = [];
  let isSoundMuted = false;
  let typingTimeout = null;
  let isTyping = false;
  let mediaUploadEnabled = false; // Default: separated/disabled for lightweight optimization
  let activeDms = new Map(); // targetUserId -> { userId, nickname, avatar, lastSnippet, updatedAt }
  let serverChannelsData = [];
  let currentServerInfo = {
    serverName: window.location.hostname || '표준서버',
    serverUrl: window.location.origin,
    host: window.location.host || 'localhost',
    protocol: 'nyaa-core-v1',
    extendedCommands: [],
    modules: []
  };
  let networkDirectoryServers = [];
  let selectedNetworkServerUrl = null;
  let announcedServerExtKey = '';
  let sessionNickpass = '';

  // =========================================================
  // Client Local History Persistence Engine (Strictly Per-Server + Per-Channel)
  // =========================================================
  const LOCAL_STORAGE_PREFIX = 'nyaa_chat_history_v2_';
  const V1_STORAGE_PREFIX = 'nyaa_chat_history_v1_';
  const LEGACY_STORAGE_PREFIX = 'nyaa_legacy_history_v1_';

  function getServerStorageScope() {
    const rawHost = currentServerInfo?.host || window.location.host || 'default_server';
    return String(rawHost).trim().toLowerCase().replace(/[^a-z0-9.:_-]/g, '_');
  }

  function getRoomCacheKey(roomId) {
    return `${getServerStorageScope()}::${roomId}`;
  }

  function getLocalHistoryKey(roomId) {
    const uid = currentUser?.userId || 'guest';
    const srvScope = getServerStorageScope();
    return `${LOCAL_STORAGE_PREFIX}${srvScope}_${uid}_${roomId}`;
  }

  const localCache = new Map();
  const pendingSaveTimers = new Map();

  function getLocalMessages(roomId) {
    const cacheKey = getRoomCacheKey(roomId);
    if (localCache.has(cacheKey)) {
      return localCache.get(cacheKey);
    }
    try {
      let raw = localStorage.getItem(getLocalHistoryKey(roomId));
      // Seamless migration fallback from v1 if on the same origin host
      if (!raw && (!currentServerInfo?.host || currentServerInfo.host === window.location.host)) {
        const uid = currentUser?.userId || 'guest';
        raw = localStorage.getItem(`${V1_STORAGE_PREFIX}${uid}_${roomId}`)
           || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${uid}_${roomId}`);
      }
      if (!raw) {
        localCache.set(cacheKey, []);
        return [];
      }
      const parsed = JSON.parse(raw);
      let res = Array.isArray(parsed) ? parsed : [];
      // Clean up any old media or broken file attachments from history
      res = res.map(m => {
        if (m && (m.fileInfo || m.type === 'image' || m.type === 'video' || m.type === 'file')) {
          const copy = Object.assign({}, m);
          delete copy.fileInfo;
          copy.type = 'text';
          if (!copy.content) copy.content = '[파일 첨부 내역]';
          return copy;
        }
        return m;
      });
      localCache.set(cacheKey, res);
      return res;
    } catch (e) {
      console.error('Failed to read local chat history:', e);
      return [];
    }
  }

  function saveLocalMessages(roomId, messages) {
    const cacheKey = getRoomCacheKey(roomId);
    const storageKey = getLocalHistoryKey(roomId);
    localCache.set(cacheKey, messages);
    if (pendingSaveTimers.has(cacheKey)) return;

    pendingSaveTimers.set(cacheKey, setTimeout(() => {
      pendingSaveTimers.delete(cacheKey);
      try {
        const list = localCache.get(cacheKey) || [];
        const capped = list.length > 600 ? list.slice(-600) : list;
        localStorage.setItem(storageKey, JSON.stringify(capped));
      } catch (e) {
        console.warn('Failed to save local chat history:', e);
      }
    }, 200));
  }

  function mergeMessages(localList, serverList) {
    const map = new Map();
    // 1. Add local messages first
    (localList || []).forEach(m => {
      if (m && m.id) map.set(m.id, m);
    });
    // 2. Merge server messages (within 24 hours)
    (serverList || []).forEach(m => {
      if (m && m.id) map.set(m.id, m);
    });
    // 3. Sort by timestamp ascending
    return Array.from(map.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  function appendLocalMessage(roomId, msg) {
    const list = getLocalMessages(roomId);
    if (!list.some(m => m.id === msg.id)) {
      list.push(msg);
      saveLocalMessages(roomId, list);
    }
  }

  function exportChatHistory(roomId) {
    const list = getLocalMessages(roomId);
    if (list.length === 0) {
      alert('보관된 대화 기록이 없습니다.');
      return;
    }
    const srvName = currentServerInfo?.serverName || window.location.hostname || '서버';
    const srvHost = currentServerInfo?.host || window.location.host || 'localhost';
    const headerLine = `=== [Nyaa Chat 로그] 서버: ${srvName} (${srvHost}) | 채널: ${roomId} ===`;
    const lines = [headerLine, ...list.map(m => {
      const time = new Date(m.timestamp).toLocaleString('ko-KR');
      if (m.type === 'system') return `[${time}] *** ${m.content}`;
      if (m.type === 'action') return `[${time}] * ${m.sender?.nickname} ${m.content}`;
      return `[${time}] <${m.sender?.nickname}> ${m.content}`;
    })];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeSrv = `${srvName}_${srvHost}`.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const safeRoom = roomId.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    a.download = `nyaa_chat_[${safeSrv}]_${safeRoom}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Media Separation Controller (Lightweight text-chat optimization)
  function applyMediaSeparation(enabled) {
    mediaUploadEnabled = enabled;
    if (!enabled) {
      if (attachBtn) attachBtn.style.display = 'none';
      if (attachmentPreviewBar) attachmentPreviewBar.style.display = 'none';
      if (toggleGalleryBtn) toggleGalleryBtn.style.display = 'none';
      if (mediaDrawer) mediaDrawer.style.display = 'none';
      if (dragDropOverlay) dragDropOverlay.style.display = 'none';
      if (messageInput) {
        messageInput.placeholder = '메시지 또는 /명령어를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈, /help: 명령어)';
      }
    } else {
      if (attachBtn) attachBtn.style.display = '';
      if (toggleGalleryBtn) toggleGalleryBtn.style.display = '';
      if (dragDropOverlay) dragDropOverlay.style.display = '';
      if (messageInput) {
        messageInput.placeholder = '메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈, 이미지 복사 후 Ctrl+V 가능)';
      }
    }
  }

  // Fetch initial config from server
  fetch('/api/config')
    .then(r => r.json())
    .then(cfg => applyMediaSeparation(!!cfg.mediaUploadEnabled))
    .catch(() => applyMediaSeparation(false));

  // Sound generator (Lazy Web Audio API - zero background audio threads)
  let audioCtx = null;
  function playChime(type = 'receive') {
    if (isSoundMuted) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (type === 'receive') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        osc.frequency.setValueAtTime(440, now); // A4
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch (e) {}
  }

  // Web Notification API (background alert for mentions & DMs)
  function triggerWebNotification(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return; // Only when browser tab is in background
    try {
      new Notification(title, {
        body,
        icon: '🐾'
      });
    } catch (_) {}
  }

  function requestNotificationPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission().catch(() => {}); } catch (_) {}
    }
  }

  // Sound toggle
  soundToggleBtn.addEventListener('click', () => {
    isSoundMuted = !isSoundMuted;
    soundIcon.textContent = isSoundMuted ? '🔕' : '🔔';
    if (!isSoundMuted) requestNotificationPermission();
  });

  // Avatar Picker toggle
  if (avatarPickerBtn) {
    avatarPickerBtn.addEventListener('click', () => {
      if (avatarPalette) avatarPalette.style.display = avatarPalette.style.display === 'none' ? 'grid' : 'none';
    });
  }
  document.querySelectorAll('.avatar-opt').forEach((opt) => {
    opt.addEventListener('click', () => {
      if (selectedAvatarSpan) selectedAvatarSpan.textContent = opt.dataset.avatar;
      if (avatarPalette) avatarPalette.style.display = 'none';
    });
  });

  // =========================================================
  // Sidebar Toggles (Left Channels & Right Online Users)
  // =========================================================
  // =========================================================
  // Sidebar Toggles (Left Channels & Right Online Users)
  // Mobile / Tablet (<= 1024px): Sidebars start CLOSED by default!
  // =========================================================
  const isMobileOrTablet = () => window.innerWidth <= 1024;
  let isLeftSidebarOpen = isMobileOrTablet() ? false : localStorage.getItem('nyaa_left_sidebar_open') !== 'false';
  let isRightSidebarOpen = isMobileOrTablet() ? false : localStorage.getItem('nyaa_right_sidebar_open') !== 'false';

  function updateBackdropState() {
    if (!appBackdrop) return;
    const isAnyMobileDrawerOpen = isMobileOrTablet() && (
      Boolean(sidebar && sidebar.classList.contains('mobile-open')) ||
      Boolean(rightSidebar && rightSidebar.classList.contains('mobile-open'))
    );
    if (isAnyMobileDrawerOpen) {
      appBackdrop.classList.add('active');
    } else {
      appBackdrop.classList.remove('active');
    }
  }

  function setLeftSidebar(open) {
    if (!isMobileOrTablet()) {
      isLeftSidebarOpen = open;
      localStorage.setItem('nyaa_left_sidebar_open', open ? 'true' : 'false');
    }
    if (sidebar) {
      if (isMobileOrTablet()) {
        sidebar.classList.toggle('mobile-open', open);
        if (open) {
          // Mutual exclusion: Close right sidebar on mobile/tablet
          setRightSidebar(false);
        }
      } else {
        sidebar.classList.toggle('collapsed', !open);
        sidebar.classList.remove('mobile-open');
      }
    }
    if (toggleLeftSidebarBtn) {
      toggleLeftSidebarBtn.classList.toggle('active', open);
      const icon = toggleLeftSidebarBtn.querySelector('.toggle-icon');
      if (icon) icon.textContent = isMobileOrTablet() ? '☰' : (open ? '◀' : '▶');
      toggleLeftSidebarBtn.title = open ? '채널 창 닫기 (Alt+C 또는 F3)' : '채널 창 열기 (Alt+C 또는 F3)';
    }
    updateBackdropState();
  }

  function toggleLeftSidebar() {
    if (isMobileOrTablet()) {
      const isCurrentlyOpen = Boolean(sidebar && sidebar.classList.contains('mobile-open'));
      setLeftSidebar(!isCurrentlyOpen);
    } else {
      setLeftSidebar(!isLeftSidebarOpen);
    }
  }

  function setRightSidebar(open) {
    if (!isMobileOrTablet()) {
      isRightSidebarOpen = open;
      localStorage.setItem('nyaa_right_sidebar_open', open ? 'true' : 'false');
    }
    if (rightSidebar) {
      if (isMobileOrTablet()) {
        rightSidebar.classList.toggle('mobile-open', open);
        if (open) {
          // Mutual exclusion: Close left sidebar on mobile/tablet
          setLeftSidebar(false);
        }
      } else {
        rightSidebar.classList.toggle('collapsed', !open);
        rightSidebar.classList.remove('mobile-open');
      }
    }
    if (toggleRightSidebarBtn) {
      toggleRightSidebarBtn.classList.toggle('active', open);
      toggleRightSidebarBtn.title = open ? '접속자 목록 닫기 (Alt+U 또는 F4)' : '접속자 목록 열기 (Alt+U 또는 F4)';
    }
    updateBackdropState();
  }

  function toggleRightSidebar() {
    if (isMobileOrTablet()) {
      const isCurrentlyOpen = Boolean(rightSidebar && rightSidebar.classList.contains('mobile-open'));
      setRightSidebar(!isCurrentlyOpen);
    } else {
      setRightSidebar(!isRightSidebarOpen);
    }
  }

  function closeAllSidebarsOnMobile() {
    if (isMobileOrTablet()) {
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (rightSidebar) rightSidebar.classList.remove('mobile-open');
      if (toggleLeftSidebarBtn) toggleLeftSidebarBtn.classList.remove('active');
      if (toggleRightSidebarBtn) toggleRightSidebarBtn.classList.remove('active');
      updateBackdropState();
    }
  }

  if (toggleLeftSidebarBtn) toggleLeftSidebarBtn.addEventListener('click', toggleLeftSidebar);
  if (toggleRightSidebarBtn) toggleRightSidebarBtn.addEventListener('click', toggleRightSidebar);
  if (collapseLeftSidebarBtn) collapseLeftSidebarBtn.addEventListener('click', () => setLeftSidebar(false));
  if (collapseRightSidebarBtn) collapseRightSidebarBtn.addEventListener('click', () => setRightSidebar(false));
  if (appBackdrop) appBackdrop.addEventListener('click', closeAllSidebarsOnMobile);

  // Apply initial saved states
  setLeftSidebar(isLeftSidebarOpen);
  setRightSidebar(isRightSidebarOpen);

  // Mobile Touch Swipe Gesture: Swipe right from left edge to open channels sidebar
  let touchStartX = 0;
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length === 1 && isMobileOrTablet()) {
      const diffX = e.changedTouches[0].clientX - touchStartX;
      const diffY = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(diffX) > 50 && Math.abs(diffY) < 60) {
        if (touchStartX < 50 && diffX > 50) {
          // Swipe right from left edge -> open channel sidebar
          setLeftSidebar(true);
        } else if (diffX < -50) {
          // Swipe left -> close channel sidebar
          setLeftSidebar(false);
        }
      }
    }
  }, { passive: true });

  // Keyboard Shortcuts (토글키: Alt+C / Alt+U / F3 / F4 / Escape)
  document.addEventListener('keydown', (e) => {
    const isAltC = e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 'ㅊ');
    const isAltU = e.altKey && (e.key === 'u' || e.key === 'U' || e.key === 'ㅕ');
    const isF3 = e.key === 'F3';
    const isF4 = e.key === 'F4';

    if (e.key === 'Escape' && isMobileOrTablet()) {
      closeAllSidebarsOnMobile();
      return;
    }

    if (isAltC || isF3) {
      e.preventDefault();
      toggleLeftSidebar();
    } else if (isAltU || isF4) {
      e.preventDefault();
      toggleRightSidebar();
    }
  });

  // Mobile / Tablet Dynamic Viewport & Virtual Keyboard Handler (Galaxy Note 20 Ultra & iOS)
  function updateAppViewportHeight() {
    if (!isMobileOrTablet()) return;
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${h}px`);
  }

  let wasMobile = isMobileOrTablet();
  window.addEventListener('resize', () => {
    updateAppViewportHeight();
    const nowMobile = isMobileOrTablet();
    if (nowMobile !== wasMobile) {
      if (nowMobile) {
        closeAllSidebarsOnMobile();
      } else {
        sidebar?.classList.remove('mobile-open');
        rightSidebar?.classList.remove('mobile-open');
        const leftPref = localStorage.getItem('nyaa_left_sidebar_open') !== 'false';
        const rightPref = localStorage.getItem('nyaa_right_sidebar_open') !== 'false';
        setLeftSidebar(leftPref);
        setRightSidebar(rightPref);
      }
      wasMobile = nowMobile;
    }
    updateBackdropState();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(updateAppViewportHeight, 200);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateAppViewportHeight);
  }
  updateAppViewportHeight();

  if (messageInput && window.innerWidth <= 640) {
    messageInput.placeholder = '메시지를 입력하세요...';
  }

  // Mobile menu button toggles left sidebar
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleLeftSidebar);
  }

  // Theme Toggle (일반 모드 / 다크 모드)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const modalThemeToggleBtn = document.getElementById('modalThemeToggleBtn');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chat_theme', theme);
    const icon = theme === 'dark' ? '☀️' : '🌙';
    const title = theme === 'dark' ? '일반 모드로 전환' : '다크 모드로 전환';
    if (themeToggleBtn) {
      themeToggleBtn.textContent = icon;
      themeToggleBtn.title = title;
    }
    if (modalThemeToggleBtn) {
      modalThemeToggleBtn.textContent = icon;
      modalThemeToggleBtn.title = title;
    }
  }

  const savedTheme = localStorage.getItem('chat_theme') || 'light';
  applyTheme(savedTheme);

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  }

  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  if (modalThemeToggleBtn) modalThemeToggleBtn.addEventListener('click', toggleTheme);

  // Window Title Bar Controls
  const winMinBtn = document.getElementById('winMinBtn');
  const winMaxBtn = document.getElementById('winMaxBtn');
  const winCloseBtn = document.getElementById('winCloseBtn');

  if (winMaxBtn) {
    winMaxBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  if (winMinBtn) {
    winMinBtn.addEventListener('click', () => {
      alert('Chat이 최소화 모드 상태입니다. (창을 계속 유지합니다)');
    });
  }

  if (winCloseBtn) {
    winCloseBtn.addEventListener('click', () => {
      if (confirm('Chat 연결을 종료하고 입장 화면으로 이동하시겠습니까?')) {
        if (socket) socket.disconnect();
        loginModal.classList.add('active');
      }
    });
  }

  // Parse URL query parameters (?channel=... or ?room=... or ?c=..., ?nick=... or ?nickname=..., ?key=...)
  const urlParams = new URLSearchParams(window.location.search);
  const rawChannelParam = urlParams.get('channel') || urlParams.get('room') || urlParams.get('c');
  const urlNickParam = urlParams.get('nick') || urlParams.get('nickname') || urlParams.get('n');
  const urlKeyParam = urlParams.get('key') || urlParams.get('password') || urlParams.get('pw');

  let targetChannelParam = null;
  if (rawChannelParam && rawChannelParam.trim()) {
    let clean = rawChannelParam.trim();
    if (!clean.startsWith('#') && !clean.startsWith('＃')) {
      clean = '#' + clean;
    }
    targetChannelParam = clean;
  }

  // Check saved profile or auto-fill
  const savedNick = localStorage.getItem('omnichat_nick');
  const savedAvatar = localStorage.getItem('omnichat_avatar');
  if (urlNickParam && urlNickParam.trim()) {
    nicknameInput.value = urlNickParam.trim();
  } else if (savedNick) {
    nicknameInput.value = savedNick;
  }
  const nickpassInput = document.getElementById('nickpassInput');
  // OWASP security: purge legacy plaintext passwords from localStorage
  localStorage.removeItem('omnichat_nickpass');
  if (savedAvatar && selectedAvatarSpan) selectedAvatarSpan.textContent = savedAvatar;

  if (targetChannelParam) {
    currentRoom = { type: 'channel', id: targetChannelParam, name: targetChannelParam, topic: '' };
    const modalWinTitle = document.querySelector('.modal-window-bar .win-title');
    if (modalWinTitle) modalWinTitle.textContent = `Nyaa Chat - [${targetChannelParam}] 접속`;
    const welcomeSub = document.querySelector('.welcome-sub');
    if (welcomeSub) welcomeSub.innerHTML = `접속 대상 채널: <strong style="color: var(--accent-primary);">${escapeHtml(targetChannelParam)}</strong>`;
    const winTitle = document.getElementById('mainWindowTitle');
    if (winTitle) winTitle.textContent = `Nyaa Chat - [${targetChannelParam}]`;
    const roomTitle = document.getElementById('currentRoomTitle');
    if (roomTitle) roomTitle.textContent = targetChannelParam;
  }

  let lastUsersList = [];
  let lastChannelsList = [];

  function updateOperatorUI() {
    if (!currentUser) return;
    const isService = isCurrentRoomService();
    const isMeOp = Array.isArray(currentRoom?.operators) && currentRoom.operators.includes(currentUser.userId);
    const isMeOper = Boolean(currentUser.isServerOper);
    const operTag = isMeOper ? '<span class="oper-badge" title="서버 총괄 운영자">👑</span>' : '';
    const opTag = isMeOp ? '<span class="op-badge" title="채널 방장">@</span>' : '';
    myNicknameDisplay.innerHTML = `${operTag}${opTag}${escapeHtml(currentUser.nickname)}`;
    if (editTopicBtn) {
      editTopicBtn.style.display = (isMeOp || isMeOper || !isService) ? 'inline-block' : 'none';
    }
    if (lastUsersList.length > 0) renderUsers(lastUsersList);
    updateHelpModalOperVisibility();
  }

  function updateHelpModalOperVisibility() {
    const operCmdSection = document.getElementById('operCmdSection');
    if (!operCmdSection) return;
    const isOper = Boolean(currentUser && currentUser.isServerOper);
    operCmdSection.style.display = isOper ? 'block' : 'none';
  }

  // Login Form Submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nickname = nicknameInput.value.trim();
    if (!nickname) return;

    const avatar = (selectedAvatarSpan && selectedAvatarSpan.textContent) || '👤';
    localStorage.setItem('omnichat_nick', nickname);
    localStorage.setItem('omnichat_avatar', avatar);

    let userId = localStorage.getItem('omnichat_userid');
    if (!userId) {
      userId = 'u_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('omnichat_userid', userId);
    }

    const nickpassInputEl = document.getElementById('nickpassInput');
    const nickpass = (nickpassInputEl && nickpassInputEl.value) ? nickpassInputEl.value.trim() : (sessionNickpass || '');
    if (nickpass) {
      sessionNickpass = nickpass;
    }

    const payload = {
      userId,
      nickname,
      avatar,
      targetChannel: targetChannelParam || undefined,
      channelKey: urlKeyParam || undefined,
      nickpass: nickpass || undefined
    };

    if (!socket || !socket.connected) {
      initSocketConnection(payload);
    } else {
      socket.emit('user_join', payload);
    }
  });

  // Initialize Socket.io
  let lastLoginPayload = null;
  function initSocketConnection(userData) {
    lastLoginPayload = { ...userData };
    socket = io();

    let webPingTimer = null;
    socket.on('connect', () => {
      const payloadToSend = {
        ...lastLoginPayload,
        nickpass: lastLoginPayload?.nickpass || sessionNickpass || undefined,
        targetChannel: (currentUser && currentRoom?.id) ? currentRoom.id : (lastLoginPayload.targetChannel || targetChannelParam || currentRoom?.id)
      };
      socket.emit('user_join', payloadToSend);

      // Start ping RTT measurement
      if (webPingTimer) clearInterval(webPingTimer);
      socket.emit('client_ping', Date.now());
      webPingTimer = setInterval(() => {
        if (socket && socket.connected) socket.emit('client_ping', Date.now());
      }, 15000);
    });

    socket.on('server_pong', (sentTime) => {
      const rtt = Math.max(0, Date.now() - Number(sentTime));
      const winServerStatus = document.getElementById('winServerStatus');
      if (winServerStatus) {
        winServerStatus.textContent = `실시간 연결됨 [${rtt}ms]`;
      }
    });

    socket.on('disconnect', () => {
      if (webPingTimer) clearInterval(webPingTimer);
      const winServerStatus = document.getElementById('winServerStatus');
      if (winServerStatus) {
        winServerStatus.textContent = '연결 끊김';
      }
    });

    // Nickname / ID preemption rejection
    socket.on('login_error', (data) => {
      alert(data.message || '접속에 실패했습니다. 다른 닉네임을 사용해 주세요.');
      loginModal.classList.add('active');
      nicknameInput.focus();
    });

    socket.on('nickname_error', (data) => {
      appendSystemNotice(`* ⚠️ ${data.message || '닉네임 변경에 실패했습니다.'}`);
    });

    // Initial state received from server
    socket.on('init_state', (data) => {
      loginModal.classList.remove('active');
      currentUser = data.user;
      if (myAvatarDisplay) myAvatarDisplay.textContent = currentUser.avatar || '👤';
      if (myIdDisplay) myIdDisplay.textContent = `ID: #${currentUser.userId.slice(-4)}`;

      applyMediaSeparation(!!data.mediaUploadEnabled);
      renderChannels(data.channels);

      const defaultRoomId = data.user.currentRoom || '#자유대화';
      const ch = data.channels.find(c => c.id === defaultRoomId);
      currentRoom = {
        type: 'channel',
        id: defaultRoomId,
        name: defaultRoomId,
        topic: ch ? ch.topic : '',
        operators: ch ? (ch.operators || []) : [],
        isService: ch ? Boolean(ch.isService) : (defaultRoomId === '#자유대화')
      };

      if (data.serverInfo) {
        applyServerIdentityAndModules(data.serverInfo);
      } else {
        applyServerIdentityAndModules(currentServerInfo);
      }

      if (currentRoomTitle) currentRoomTitle.textContent = defaultRoomId;
      if (currentRoomDesc) {
        currentRoomDesc.textContent = (ch && ch.topic) ? ch.topic : `${defaultRoomId} 대화방입니다.`;
      }
      updateHeaderServerBadge();

      updateOperatorUI();
      renderUsers(data.users);

      // Load active DMs and render left sidebar DMs
      loadActiveDms();
      renderDms();

      // Only load local storage history - server does NOT provide past messages
      const localList = getLocalMessages(defaultRoomId);
      renderMessageHistory(localList);

      if (data.mediaUploadEnabled) {
        updateGalleryDrawer(localList);
      }

      // Ensure URL-requested targetChannel is joined if initial room differed
      if (targetChannelParam && defaultRoomId.toLowerCase() !== targetChannelParam.toLowerCase() && !window.__initialUrlChannelJoined) {
        window.__initialUrlChannelJoined = true;
        socket.emit('join_channel', {
          channelName: targetChannelParam,
          key: urlKeyParam || undefined
        });
      }
    });

    // Server identity & extended commands update
    socket.on('server_info_update', (sInfo) => {
      if (sInfo) {
        applyServerIdentityAndModules(sInfo);
        updateHeaderServerBadge();
      }
    });

    // Distributed Whitelist Network Directory result (/servers)
    socket.on('network_directory_result', (dirData) => {
      if (dirData && Array.isArray(dirData.servers)) {
        networkDirectoryServers = dirData.servers;
        renderNetworkServersModalList();
        renderMultiServersSidebar();
      }
    });

    // Server-scoped module/bot interaction event
    socket.on('server_module_event', (evt) => {
      if (!evt) return;
      appendSystemNotice(`* 🧩 [${evt.serverName || currentServerInfo.serverName} 모듈: ${evt.command || 'bot'}] 입력 처리됨 (${evt.args || '기본 호출'})`);
    });

    // Generic system notice from server (e.g. /peer, /servername, /extcmd feedback)
    socket.on('system_notice', (data) => {
      if (data && data.message) {
        appendWhoisNotice(data.message);
      }
    });

    // Channel list update (Smooth 60 FPS animation frame debounce)
    let renderChannelsRaf = null;
    socket.on('channel_list_update', (channels) => {
      cancelAnimationFrame(renderChannelsRaf);
      renderChannelsRaf = requestAnimationFrame(() => {
        renderChannels(channels);
        const activeCh = channels.find(c => c.id === currentRoom.id);
        if (activeCh && currentRoom.type === 'channel') {
          currentRoom.topic = activeCh.topic;
          currentRoom.operators = activeCh.operators || [];
          currentRoom.rawModes = activeCh.rawModes;
          currentRoomDesc.textContent = activeCh.topic || '설정된 토픽이 없습니다.';
          updateOperatorUI();
        }
      });
    });

    // Server channels directory result for /list
    socket.on('server_channels_result', (channels) => {
      renderServerChannelList(channels);
    });

    // WHOIS User Information Result
    socket.on('whois_result', (data) => {
      if (data && data.formattedText) {
        appendWhoisNotice(data.formattedText);
      }
    });

    // Server Operator Ban List Result (/banlist)
    socket.on('banlist_result', (data) => {
      if (data && data.formattedText) {
        appendWhoisNotice(data.formattedText);
      }
    });

    // Channel password required (+k)
    socket.on('channel_key_required', (data) => {
      openChannelKeyPrompt(data.roomId, data.channelName, data.error);
    });

    // Channel invite notification (+i)
    socket.on('invited_to_channel', (data) => {
      appendSystemNotice(`* ✉️ @${data.invitedBy}님이 귀하를 ${data.channelName} 채널로 초대했습니다!`);
      playChime('receive');
    });

    // Topic updated
    socket.on('topic_updated', (data) => {
      if (currentRoom.id === data.roomId) {
        currentRoom.topic = data.topic;
        currentRoom.rawModes = data.rawModes;
        currentRoomDesc.textContent = data.topic || '설정된 토픽이 없습니다.';
      }
    });

    // Channel operators updated
    socket.on('channel_operators_update', (data) => {
      if (currentRoom.id === data.roomId) {
        currentRoom.operators = data.operators || [];
        updateOperatorUI();
      }
    });

    // Nickname changed
    socket.on('nickname_changed', (data) => {
      if (currentUser) currentUser.nickname = data.nickname;
      localStorage.setItem('omnichat_nick', data.nickname);
      updateOperatorUI();
      appendSystemNotice(`* ✨ 닉네임이 "${data.nickname}"(으)로 변경되었습니다.`);
    });

    // User list update (Smooth 60 FPS animation frame debounce)
    let renderUsersRaf = null;
    socket.on('user_list_update', (users) => {
      cancelAnimationFrame(renderUsersRaf);
      renderUsersRaf = requestAnimationFrame(() => {
        renderUsers(users);
        renderDms(); // Refresh online indicators in DM list
      });
    });

    // Room switched
    socket.on('room_switched', (data) => {
      const { roomMeta } = data;
      currentRoom = roomMeta;
      if (!Array.isArray(currentRoom.operators)) currentRoom.operators = [];

      if (roomMeta.type === 'channel') {
        if (currentRoomIcon) currentRoomIcon.style.display = 'none';
        currentRoomTitle.textContent = roomMeta.name;
        currentRoomTypeTag.textContent = '채널';
        currentRoomDesc.textContent = roomMeta.topic || roomMeta.description || '설정된 토픽이 없습니다.';
      } else {
        if (currentRoomIcon) currentRoomIcon.style.display = 'none';
        currentRoomTitle.textContent = `${roomMeta.name} 님과의 대화`;
        currentRoomTypeTag.textContent = '1:1 대화 모드';
        currentRoomDesc.textContent = roomMeta.isOnline ? '현재 온라인 상태입니다.' : '현재 오프라인 상태입니다.';

        // Add to active DMs list
        addOrUpdateActiveDm({
          userId: roomMeta.targetUserId,
          nickname: roomMeta.name,
          avatar: roomMeta.avatar
        });
      }
      updateHeaderServerBadge();

      // Reset unread for this room
      unreadCounts[roomMeta.id] = 0;
      updateTotalDmBadge();
      updateActiveSidebarItem();
      renderDms();
      updateOperatorUI();

      // Load strictly from user's local storage
      const localList = getLocalMessages(roomMeta.id);
      renderMessageHistory(localList);

      if (mediaUploadEnabled) {
        updateGalleryDrawer(localList);
      }
      closeAllSidebarsOnMobile();
      renderUsers(lastUsersList);
      if (isTyping) {
        isTyping = false;
        clearTimeout(typingTimeout);
      }
      clearTimeout(remoteTypingTimeout);
      if (typingIndicatorBar) typingIndicatorBar.classList.remove('visible');
    });

    // New message arrived
    socket.on('new_message', (msg) => {
      // Always persist to user local storage
      appendLocalMessage(msg.roomId, msg);

      // If DM, record in active DMs
      if (msg.roomId.startsWith('dm_')) {
        const otherId = getDmPartnerId(msg.roomId, currentUser?.userId, msg.sender?.userId, msg.recipientId);
        const isFromMe = msg.sender?.userId === currentUser?.userId;
        const otherOnlineUser = (lastUsersList || []).find(u => u.userId === otherId);
        const existingDm = otherId ? activeDms.get(otherId) : null;

        const partnerNickname = isFromMe
          ? (otherOnlineUser?.nickname || existingDm?.nickname || '대화 상대')
          : (msg.sender?.nickname || otherOnlineUser?.nickname || '대화 상대');

        const partnerAvatar = isFromMe
          ? (otherOnlineUser?.avatar || existingDm?.avatar || '👤')
          : (msg.sender?.avatar || otherOnlineUser?.avatar || '👤');

        if (otherId) {
          addOrUpdateActiveDm({
            userId: otherId,
            nickname: partnerNickname,
            avatar: partnerAvatar
          }, msg.content);
          renderDms();
        }
      }

      if (msg.roomId === currentRoom.id) {
        appendMessage(msg);
        currentHistory.push(msg);
        if (mediaUploadEnabled) {
          updateGalleryDrawer(currentHistory);
        }
        if (msg.sender && msg.sender.userId !== currentUser?.userId) {
          playChime('receive');
          const isMention = currentUser && msg.content && (msg.content.includes(`@${currentUser.nickname}`) || msg.content.includes(currentUser.nickname));
          if (isMention) {
            triggerWebNotification(`[멘션] ${msg.sender.nickname} @ ${currentRoom.name || currentRoom.id}`, msg.content);
          }
        }
      } else {
        // Increment unread count for other rooms
        unreadCounts[msg.roomId] = (unreadCounts[msg.roomId] || 0) + 1;
        updateTotalDmBadge();
        updateActiveSidebarItem();
        renderDms();
        if (msg.sender && msg.sender.userId !== currentUser?.userId) {
          playChime('receive');
          if (msg.roomId.startsWith('dm_')) {
            triggerWebNotification(`[1:1 대화] ${msg.sender.nickname}`, msg.content);
          } else if (currentUser && msg.content && (msg.content.includes(`@${currentUser.nickname}`) || msg.content.includes(currentUser.nickname))) {
            triggerWebNotification(`[멘션] ${msg.sender.nickname} @ ${msg.roomId}`, msg.content);
          }
        }
      }
    });

    // DM Notification
    socket.on('dm_notification', (data) => {
      if (data.message) {
        appendLocalMessage(data.roomId, data.message);
      }
      if (data.sender && data.sender.userId && currentUser && data.sender.userId !== currentUser.userId) {
        addOrUpdateActiveDm(data.sender, data.message?.content || '');
        renderDms();
      }
      if (currentRoom.id !== data.roomId) {
        unreadCounts[data.roomId] = (unreadCounts[data.roomId] || 0) + 1;
        updateTotalDmBadge();
        updateActiveSidebarItem();
        renderDms();
        playChime('receive');
      }
    });

    // Typing indicator with auto-expiry safety timeout
    let remoteTypingTimeout = null;
    socket.on('user_typing', (data) => {
      if (data.roomId === currentRoom.id) {
        if (data.isTyping) {
          typingText.textContent = `${data.nickname} 님이 입력 중입니다...`;
          typingIndicatorBar.classList.add('visible');
          clearTimeout(remoteTypingTimeout);
          // Safety fallback: auto-hide after 3 seconds if isTyping: false was dropped or missed
          remoteTypingTimeout = setTimeout(() => {
            typingIndicatorBar.classList.remove('visible');
          }, 3000);
        } else {
          clearTimeout(remoteTypingTimeout);
          typingIndicatorBar.classList.remove('visible');
        }
      }
    });

    // Oper & Moderation Events
    socket.on('oper_success', (data) => {
      if (currentUser) currentUser.isServerOper = true;
      updateOperatorUI();
      appendSystemNotice(`👑 ${data.message}`);
      socket.emit('get_channel_list');
    });

    socket.on('oper_failed', (data) => {
      appendSystemNotice(`❌ ${data.message}`);
    });

    socket.on('aioper_success', (data) => {
      if (currentUser) {
        currentUser.isAiOper = true;
        currentUser.aiOperId = data.operId;
      }
      appendSystemNotice(`🤖 ${data.message}`);
    });

    socket.on('aioper_failed', (data) => {
      appendSystemNotice(`❌ ${data.message}`);
    });

    socket.on('kicked_from_channel', (data) => {
      alert(`[채널 강퇴 알림]\n${data.channelName} 채널에서 강퇴(kick)되었습니다.\n(방장: ${data.kickedBy} / 사유: ${data.reason})`);
    });

    socket.on('banned', (data) => {
      if (data && data.durationHours) {
        alert(`[서버 임시 차단 알림]\n도배 누적으로 인해 ${data.durationHours}시간 동안 서버 이용이 차단(하루 밴)되었습니다.\n(사유: ${data.reason})`);
      } else {
        alert(`[서버 영구 차단 알림]\n운영자에 의해 서버에서 영구 차단(IP BAN)되었습니다.\n(사유: ${data?.reason || '관리자 제재'})`);
      }
      window.location.reload();
    });

    socket.on('spam_timeout', (data) => {
      const input = document.getElementById('messageInput');
      if (!input) return;
      let left = data.durationSeconds || 60;
      input.disabled = true;
      const originalPlaceholder = input.placeholder || '메시지를 입력하세요...';
      input.placeholder = `[도배 제재] 1분간 대화가 제한됩니다 (${left}초 남음)...`;

      const interval = setInterval(() => {
        left--;
        if (left <= 0) {
          clearInterval(interval);
          input.disabled = false;
          input.placeholder = originalPlaceholder;
          input.focus();
        } else {
          input.placeholder = `[도배 제재] 1분간 대화가 제한됩니다 (${left}초 남음)...`;
        }
      }, 1000);
    });

      socket.on('connect_error', (err) => {
      const msg = err ? (err.message || err.description || '') : '';
      if (msg === 'BANNED_IP') {
        alert('귀하의 접속 IP는 서버 관리자에 의해 영구 차단(BAN)되어 접속할 수 없습니다.');
      } else if (msg.startsWith('TEMP_BANNED_SPAM')) {
        const parts = msg.split(':');
        const remaining = parts[1] || '24시간';
        alert(`귀하의 접속 IP는 도배 누적으로 인해 임시 차단(하루 밴)된 상태입니다.\n(남은 차단 시간: 약 ${remaining})`);
      }
    });
  }

  // Auto-connect when hopping from another server via Server List (?channel=#...&nick=...)
  if (targetChannelParam && urlNickParam && urlNickParam.trim()) {
    handleToggleAll(true);
    localStorage.setItem('nyaa_terms_agreed', 'true');
    const autoNick = urlNickParam.trim().slice(0, 16);
    const autoAvatar = (selectedAvatarSpan && selectedAvatarSpan.textContent) || localStorage.getItem('omnichat_avatar') || '👤';
    localStorage.setItem('omnichat_nick', autoNick);
    let autoUserId = localStorage.getItem('omnichat_userid');
    if (!autoUserId) {
      autoUserId = 'u_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('omnichat_userid', autoUserId);
    }
    initSocketConnection({
      userId: autoUserId,
      nickname: autoNick,
      avatar: autoAvatar,
      targetChannel: targetChannelParam,
      channelKey: urlKeyParam || undefined
    });
  }

  // =========================================================
  // Active 1:1 Direct Messages Persistence & Rendering
  // =========================================================
  function saveActiveDms() {
    if (!currentUser) return;
    try {
      const arr = Array.from(activeDms.values());
      localStorage.setItem('nyaa_active_dms_' + currentUser.userId, JSON.stringify(arr));
    } catch (e) {}
  }

  function loadActiveDms() {
    if (!currentUser) return;
    try {
      const raw = localStorage.getItem('nyaa_active_dms_' + currentUser.userId);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((item) => {
            // Clean up legacy malformed 'u' entries and self
            if (item && item.userId && item.userId !== 'u' && item.userId !== currentUser.userId) {
              activeDms.set(item.userId, item);
            }
          });
        }
      }
    } catch (e) {}
  }

  function getDmPartnerId(roomId, myUserId, senderUserId, recipientId) {
    if (recipientId && myUserId) {
      if (senderUserId === myUserId) return recipientId;
      return senderUserId;
    }
    if (senderUserId && myUserId && senderUserId !== myUserId) {
      return senderUserId;
    }
    if (!roomId || !roomId.startsWith('dm_')) return '';
    const raw = roomId.slice(3); // Remove 'dm_'
    if (myUserId) {
      if (raw.startsWith(myUserId + '_')) {
        return raw.slice(myUserId.length + 1);
      }
      if (raw.endsWith('_' + myUserId)) {
        return raw.slice(0, raw.length - myUserId.length - 1);
      }
    }
    const match = (lastUsersList || []).find(u => u.userId !== myUserId && (raw.startsWith(u.userId + '_') || raw.endsWith('_' + u.userId)));
    if (match) return match.userId;
    return '';
  }

  function addOrUpdateActiveDm(partner, lastSnippet = '') {
    if (!partner || !partner.userId || partner.userId === currentUser?.userId) return;
    const existing = activeDms.get(partner.userId) || {
      userId: partner.userId,
      nickname: partner.nickname || '대화 상대',
      avatar: partner.avatar || '👤',
      lastSnippet: '',
      updatedAt: Date.now()
    };
    if (partner.nickname) existing.nickname = partner.nickname;
    if (partner.avatar) existing.avatar = partner.avatar;
    if (lastSnippet) existing.lastSnippet = lastSnippet.slice(0, 40);
    existing.updatedAt = Date.now();
    activeDms.set(partner.userId, existing);
    saveActiveDms();
  }

  function removeActiveDm(partnerUserId) {
    activeDms.delete(partnerUserId);
    saveActiveDms();
    renderDms();
  }

  function renderDms() {
    const dmsSection = document.getElementById('dmsSection');
    if (dmsSection) dmsSection.style.display = 'none';
    if (!dmConversationsList) return;
    dmConversationsList.innerHTML = '';
    return; // 1:1 DM list separated and hidden per user policy

    if (dms.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.cssText = 'padding: 10px 14px; font-size: 11.5px; color: var(--text-muted); text-align: center;';
      emptyNotice.textContent = '진행 중인 1:1 대화가 없습니다.';
      dmConversationsList.appendChild(emptyNotice);
      return;
    }

    // Sort by recent activity
    dms.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    dms.forEach((dm) => {
      const dmRoomId = getDmRoomId(currentUser?.userId || '', dm.userId);
      const isCurrentActive = currentRoom.id === dmRoomId;
      const unread = unreadCounts[dmRoomId] || 0;

      // Online status check against lastUsersList
      const isOnline = (lastUsersList || []).some(u => u.userId === dm.userId);

      const item = document.createElement('div');
      item.className = `channel-item dm-conversation-item ${isCurrentActive ? 'active' : ''}`;
      item.dataset.dmRoomId = dmRoomId;
      item.dataset.targetUserId = dm.userId;

      // Notice: NO '#' in the title for 1:1 DMs as requested!
      const displayName = dm.nickname;
      const displayStatus = isOnline ? '온라인' : '오프라인';
      const statusDotClass = isOnline ? '' : 'offline';

      item.innerHTML = `
        <div class="channel-details" style="flex: 1; min-width: 0;">
          <div class="channel-header-line">
            <span class="channel-name" style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 13px;">${escapeHtml(dm.avatar || '👤')}</span>
              <span>${escapeHtml(displayName)}</span>
            </span>
            <div class="channel-meta-badges">
              <span class="user-status-text" style="font-size: 10px; color: ${isOnline ? 'var(--status-online)' : 'var(--text-muted)'};">
                <span class="user-status-dot ${statusDotClass}" style="width: 6px; height: 6px; display: inline-block;"></span>
                ${displayStatus}
              </span>
            </div>
          </div>
          <span class="channel-desc">${escapeHtml(dm.lastSnippet || '1:1 대화방')}</span>
        </div>
        ${unread > 0 ? `<span class="user-item-badge">${unread}</span>` : ''}
        <button type="button" class="dm-close-btn" title="대화 목록에서 닫기" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px 4px; font-size: 11px; margin-left: 4px; border-radius: 3px;">✕</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.dm-close-btn')) {
          e.stopPropagation();
          removeActiveDm(dm.userId);
          return;
        }
        if (isTyping && socket && socket.connected) {
          isTyping = false;
          clearTimeout(typingTimeout);
          socket.emit('typing', { roomId: currentRoom.id, isTyping: false });
        }
        socket.emit('switch_room', {
          targetType: 'dm',
          targetId: dm.userId,
          targetName: dm.nickname,
          targetAvatar: dm.avatar
        });
        closeAllSidebarsOnMobile();
      });

      dmConversationsList.appendChild(item);
    });
  }

  // =========================================================
  // Server Channel Directory (/list) & Key Prompt
  // =========================================================
  function renderServerChannelList(channels) {
    serverChannelsData = channels || [];
    if (!serverChannelsContainer) return;
    serverChannelsContainer.innerHTML = '';
    if (serverChannelTotalCount) serverChannelTotalCount.textContent = `총 ${serverChannelsData.length}개 채널`;

    const query = (serverChannelSearchInput?.value || '').trim().toLowerCase();
    const filtered = serverChannelsData.filter((ch) => {
      if (!query) return true;
      return ch.name.toLowerCase().includes(query) || (ch.topic || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      serverChannelsContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">일치하는 채널이 없습니다.</div>`;
      return;
    }

    filtered.forEach((ch) => {
      const row = document.createElement('div');
      row.className = 'server-channel-row';
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--border-light);';

      const keyIcon = ch.hasKey ? '<span title="비밀번호 설정됨 (+k)" style="font-size: 13px;">🔒</span>' : '';
      const privIcon = ch.isPrivate ? '<span title="비공개 채널 (+p)" style="font-size: 13px;">🕶️</span>' : '';
      const modeText = ch.modes ? `<span style="font-size: 11px; color: var(--text-muted); background: var(--bg-card); padding: 1px 4px; border-radius: 3px; border: 1px solid var(--border-light);">${escapeHtml(ch.modes)}</span>` : '';

      row.innerHTML = `
        <div style="flex: 1; min-width: 0; margin-right: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 700; color: var(--text-primary); font-size: 13.5px;">${escapeHtml(ch.name)}</span>
            ${keyIcon}
            ${privIcon}
            ${modeText}
            <span style="font-size: 11.5px; color: var(--accent-primary); background: rgba(59, 130, 246, 0.1); padding: 1px 6px; border-radius: 10px;">${ch.userCount}명</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(ch.topic || '설정된 주제 없음')}
          </div>
        </div>
        <div style="white-space: nowrap;">
          ${ch.isJoined
            ? `<button type="button" class="secondary-btn btn-go-channel" style="padding: 5px 12px; font-size: 12px;">참여 중 ↗</button>`
            : `<button type="button" class="primary-btn btn-join-channel" style="padding: 5px 14px; font-size: 12px; margin-top: 0;">입장</button>`}
        </div>
      `;

      row.querySelector('.btn-go-channel')?.addEventListener('click', () => {
        socket.emit('switch_room', { targetType: 'channel', targetId: ch.id });
        closeModal(serverListModal);
      });

      row.querySelector('.btn-join-channel')?.addEventListener('click', () => {
        if (ch.hasKey) {
          openChannelKeyPrompt(ch.id, ch.name);
          closeModal(serverListModal);
        } else {
          socket.emit('join_channel', { channelName: ch.id });
          closeModal(serverListModal);
        }
      });

      serverChannelsContainer.appendChild(row);
    });
  }

  function openChannelKeyPrompt(roomId, channelName, error = '') {
    if (channelKeyTargetRoomId) channelKeyTargetRoomId.value = roomId;
    if (channelKeyModalTitle) channelKeyModalTitle.textContent = `${channelName} 비밀번호 입력`;
    if (channelKeyInput) channelKeyInput.value = '';
    if (channelKeyErrorMsg) {
      if (error) {
        channelKeyErrorMsg.textContent = error;
        channelKeyErrorMsg.style.display = 'block';
      } else {
        channelKeyErrorMsg.style.display = 'none';
      }
    }
    openModal(channelKeyModal);
    setTimeout(() => channelKeyInput?.focus(), 100);
  }

  // Render Channels list (Only Joined Channels)
  function renderChannels(channels) {
    lastChannelsList = channels || [];
    channelsList.innerHTML = '';
    channelCountBadge.textContent = `${channels.length}개`;

    channels.forEach((ch) => {
      const item = document.createElement('div');
      item.className = `channel-item ${currentRoom.id === ch.id ? 'active' : ''}`;
      item.dataset.channelId = ch.id;

      // Fix double hashtag (#) bug:
      const displayName = ch.name.startsWith('#') ? ch.name : '#' + ch.name;
      // Fix undefined description bug:
      const displayTopic = ch.topic || ch.description || '대화방입니다.';
      const operBadge = ch.isOperOnly ? `<span class="channel-oper-tag" style="background:rgba(239,68,68,0.18);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;margin-right:3px;" title="관리자 전용 채널">⚖️ 관리자</span>` : '';
      const botBadge = ch.hasBot ? `<span class="channel-bot-tag" title="지킴이 봇 상주">^ 지킴이</span>` : '';
      const keyBadge = ch.hasKey ? `<span title="비밀번호 설정됨 (+k)" style="font-size: 11px;">🔒</span>` : '';
      const userBadge = `<span class="channel-user-count" title="참여자 수">${ch.userCount !== undefined ? ch.userCount : 1}명</span>`;

      const isCustomChannel = !ch.isService && ch.id !== '#자유대화';
      const closeBtn = isCustomChannel ? `<button type="button" class="channel-close-btn" title="채널 나가기 (/part)" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px 4px; font-size: 11px; margin-left: 4px; border-radius: 3px;">✕</button>` : '';

      item.innerHTML = `
        <div class="channel-details" style="flex: 1; min-width: 0;">
          <div class="channel-header-line">
            <span class="channel-name">${escapeHtml(displayName)}</span>
            <div class="channel-meta-badges">
              ${operBadge}
              ${botBadge}
              ${keyBadge}
              ${userBadge}
            </div>
          </div>
          <span class="channel-desc">${escapeHtml(displayTopic)}</span>
        </div>
        ${unreadCounts[ch.id] ? `<span class="user-item-badge">${unreadCounts[ch.id]}</span>` : ''}
        ${closeBtn}
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.channel-close-btn')) {
          e.stopPropagation();
          socket.emit('part_channel', { channelId: ch.id });
          return;
        }
        if (isTyping && socket && socket.connected) {
          isTyping = false;
          clearTimeout(typingTimeout);
          socket.emit('typing', { roomId: currentRoom.id, isTyping: false });
        }
        socket.emit('switch_room', { targetType: 'channel', targetId: ch.id });
        closeAllSidebarsOnMobile();
      });

      channelsList.appendChild(item);
    });
  }

  function isCurrentRoomService() {
    if (!currentRoom) return false;
    if (currentRoom.type === 'dm') return false;
    if (currentRoom.id === '#자유대화') return true;
    if (currentRoom.isService) return true;
    const ch = (lastChannelsList || []).find((c) => c.id === currentRoom.id);
    return Boolean(ch && ch.isService);
  }

  // Render Online Users list (Right Sidebar)
  function renderUsers(users) {
    lastUsersList = users || [];
    usersList.innerHTML = '';

    const isServiceRoom = isCurrentRoomService();
    const currentRoomId = currentRoom?.id || '#자유대화';

    // Filter users: only show users present in the current channel or DM
    const filteredUsers = (users || []).filter((u) => {
      const isBot = Boolean(u.isBot || u.userId === 'bot_nyaa');
      if (isBot) {
        return currentRoom?.type === 'channel' && isServiceRoom;
      }

      if (currentRoom?.type === 'dm') {
        return u.userId === currentRoom.targetUserId || u.userId === currentUser?.userId;
      }

      // Inside a channel: only show users who joined this channel
      if (Array.isArray(u.joinedChannels)) {
        return u.joinedChannels.includes(currentRoomId);
      }
      return u.currentRoom === currentRoomId;
    });

    const otherUsers = filteredUsers.filter((u) => u.userId !== currentUser?.userId);

    // If in DM mode and partner is offline, add them to otherUsers so they still appear
    if (currentRoom?.type === 'dm' && currentRoom.targetUserId) {
      const partnerOnline = otherUsers.some(u => u.userId === currentRoom.targetUserId);
      if (!partnerOnline) {
        const dmPartnerMeta = activeDms.get(currentRoom.targetUserId) || {
          userId: currentRoom.targetUserId,
          nickname: currentRoom.name || '대화 상대',
          avatar: currentRoom.avatar || '👤'
        };
        otherUsers.push({
          userId: dmPartnerMeta.userId,
          nickname: dmPartnerMeta.nickname,
          avatar: dmPartnerMeta.avatar,
          isOffline: true
        });
      }
    }

    const totalCount = (currentUser ? 1 : 0) + otherUsers.length;
    onlineUserCount.textContent = `${totalCount}명`;
    if (headerUserCount) headerUserCount.textContent = totalCount;

    // 1. Current User Item at top
    if (currentUser) {
      const isMeOp = Array.isArray(currentRoom?.operators) && currentRoom.operators.includes(currentUser.userId);
      const isMeOper = Boolean(currentUser.isServerOper);
      const operPrefix = isMeOper ? '<span class="oper-badge" title="서버 총괄 운영자">👑</span>' : '';
      const opPrefix = isMeOp ? '<span class="op-badge" title="채널 방장">@</span>' : '';
      const myItem = document.createElement('div');
      myItem.className = 'user-item user-item-me';
      myItem.style.cursor = 'pointer';
      myItem.title = `${currentUser.nickname} 사용자 정보 보기 (/whois)`;
      myItem.innerHTML = `
        <div class="user-details">
          <span class="user-name">${operPrefix}${opPrefix}${escapeHtml(currentUser.nickname)}<span class="me-tag">나</span></span>
          <span class="user-status-text"><span class="user-status-dot"></span> 온라인</span>
        </div>
      `;
      myItem.addEventListener('click', () => {
        socket.emit('whois', { target: currentUser.nickname });
        closeAllSidebarsOnMobile();
      });
      usersList.appendChild(myItem);
    }

    // Sort other users: Bots first, then Server Opers, then Ops, then others alphabetically
    otherUsers.sort((a, b) => {
      const aBot = (a.isBot || a.userId === 'bot_nyaa') ? 1 : 0;
      const bBot = (b.isBot || b.userId === 'bot_nyaa') ? 1 : 0;
      if (aBot !== bBot) return bBot - aBot;

      const aOper = a.isServerOper ? 1 : 0;
      const bOper = b.isServerOper ? 1 : 0;
      if (aOper !== bOper) return bOper - aOper;

      const aOp = (Array.isArray(currentRoom?.operators) && currentRoom.operators.includes(a.userId)) ? 1 : 0;
      const bOp = (Array.isArray(currentRoom?.operators) && currentRoom.operators.includes(b.userId)) ? 1 : 0;
      if (aOp !== bOp) return bOp - aOp;

      return (a.nickname || '').localeCompare(b.nickname || '');
    });

    otherUsers.forEach((user) => {
      const isOp = Array.isArray(currentRoom?.operators) && currentRoom.operators.includes(user.userId);
      const isOper = Boolean(user.isServerOper);
      const isBot = Boolean(user.isBot || user.userId === 'bot_nyaa');
      const isUserOffline = Boolean(user.isOffline);
      const botPrefix = isBot ? '<span class="bot-badge" title="서버 봇">^</span>' : '';
      const operPrefix = isOper ? '<span class="oper-badge" title="서버 총괄 운영자">👑</span>' : '';
      const opPrefix = isOp && !isBot ? '<span class="op-badge" title="채널 방장">@</span>' : '';
      const statusText = isBot ? '채널 지킴이 봇 (상시 대기)' : (isOper ? '서버 총괄 운영자' : (isUserOffline ? '현재 오프라인' : '사용자 정보 (/whois)'));
      const dotClass = isBot ? 'bot-dot' : (isUserOffline ? 'offline' : '');

      const item = document.createElement('div');
      item.className = 'user-item';
      item.dataset.userId = user.userId;
      item.title = `${user.nickname} 사용자 정보 보기 (/whois)`;
      item.style.cursor = 'pointer';

      item.innerHTML = `
        <div class="user-details">
          <span class="user-name">${botPrefix}${operPrefix}${opPrefix}${escapeHtml(user.nickname)}</span>
          <span class="user-status-text"><span class="user-status-dot ${dotClass}"></span> ${statusText}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        socket.emit('whois', { target: user.nickname || user.userId });
        closeAllSidebarsOnMobile();
      });

      usersList.appendChild(item);
    });
  }

  function getDmRoomId(id1, id2) {
    const sorted = [id1, id2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }

  function updateTotalDmBadge() {
    let total = 0;
    Object.keys(unreadCounts).forEach((key) => {
      if (key.startsWith('dm_')) total += unreadCounts[key];
    });
    if (totalDmUnread) {
      if (total > 0) {
        totalDmUnread.textContent = total;
        totalDmUnread.style.display = 'inline-block';
      } else {
        totalDmUnread.style.display = 'none';
      }
    }
  }

  function updateActiveSidebarItem() {
    document.querySelectorAll('.channel-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.channelId === currentRoom.id);
    });
    document.querySelectorAll('.user-item').forEach((el) => {
      if (currentRoom.type === 'dm') {
        const dmId = getDmRoomId(currentUser.userId, el.dataset.userId);
        el.classList.toggle('active', dmId === currentRoom.id);
      } else {
        el.classList.remove('active');
      }
    });
  }

  // Format Time & Dates
  function formatMsgTime(ts) {
    const date = new Date(ts);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  function getFileIcon(ext) {
    const map = {
      pdf: '📕',
      zip: '📦', rar: '📦', '7z': '📦',
      doc: '📘', docx: '📘',
      xls: '📗', xlsx: '📗',
      ppt: '📙', pptx: '📙',
      txt: '📄', json: '📝', js: '💻', html: '🌐',
      mp3: '🎵', wav: '🎵'
    };
    return map[ext.toLowerCase()] || '📁';
  }

  // Render Message History (Batch render using DocumentFragment)
  function renderMessageHistory(history) {
    messagesContainer.innerHTML = '';
    currentHistory = history || [];

    if (currentHistory.length === 0) {
      const welcome = document.createElement('div');
      welcome.className = 'system-message-row';
      welcome.innerHTML = `<span class="system-message-badge">이 방의 대화가 시작되었습니다. 메시지를 입력해 보세요!</span>`;
      messagesContainer.appendChild(welcome);
      return;
    }

    const fragment = document.createDocumentFragment();
    let lastDateStr = '';
    // Display latest 150 messages in DOM to keep memory usage minimal
    const sliceHistory = currentHistory.length > 150 ? currentHistory.slice(-150) : currentHistory;

    sliceHistory.forEach((msg) => {
      const dateStr = new Date(msg.timestamp).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
      });
      if (dateStr !== lastDateStr) {
        lastDateStr = dateStr;
        const dateDiv = document.createElement('div');
        dateDiv.className = 'date-divider';
        dateDiv.innerHTML = `<span>${dateStr}</span>`;
        fragment.appendChild(dateDiv);
      }
      const el = createMessageElement(msg);
      if (el) fragment.appendChild(el);
    });

    messagesContainer.appendChild(fragment);
    scrollToBottom();
  }

  // Create single message element (Optimized fast path for pure text)
  function createMessageElement(msg) {
    if (msg.type === 'system') {
      const row = document.createElement('div');
      row.className = 'system-message-row';
      const badge = document.createElement('span');
      badge.className = 'system-message-badge';
      badge.textContent = msg.content;
      row.appendChild(badge);
      return row;
    }

    const isSenderOp = Boolean(msg.sender?.isOp || (Array.isArray(currentRoom?.operators) && currentRoom.operators.includes(msg.sender?.userId)));
    const isBot = Boolean(msg.sender?.isBot || msg.sender?.userId === 'bot_nyaa');
    const authorPrefix = isBot
      ? '<span class="bot-badge" title="서버 봇">^</span>'
      : (isSenderOp ? '<span class="op-badge" title="채널 방장">@</span>' : '');

    // Action Message (/me ...)
    if (msg.type === 'action') {
      const row = document.createElement('div');
      row.className = 'message-row action-message-row';
      row.innerHTML = `
        <div class="action-message-content">
          <span class="action-symbol">*</span>
          <span class="action-author">${authorPrefix}${escapeHtml(msg.sender?.nickname || '사용자')}</span>
          <span class="action-text">${escapeHtml(msg.content)}</span>
          <span class="msg-time action-time">${formatMsgTime(msg.timestamp)}</span>
        </div>
      `;
      return row;
    }

    const isMe = msg.sender?.userId === currentUser?.userId;
    const row = document.createElement('div');
    row.className = `message-row ${isMe ? 'me' : 'other'}`;

    // Ultra-lightweight path for pure text messages (99% of chat)
    if (!mediaUploadEnabled || msg.type === 'text' || !msg.fileInfo) {
      const bubbleText = msg.content || (msg.fileInfo ? `[첨부: ${msg.fileInfo.originalName}]` : '');
      row.innerHTML = `
        <div class="msg-content-box">
          <div class="msg-info-line">
            <span class="msg-author">${authorPrefix}${escapeHtml(msg.sender?.nickname || '사용자')}</span>
            <span class="msg-time">${formatMsgTime(msg.timestamp)}</span>
          </div>
          <div class="msg-bubble">${formatText(bubbleText)}</div>
        </div>
      `;
      return row;
    }

    // Multimedia path (image/video/file)
    let mediaHtml = '';
    const safeMediaUrl = msg.fileInfo ? sanitizeMediaUrl(msg.fileInfo.url) : '';
    if (safeMediaUrl && msg.type === 'image' && msg.fileInfo) {
      const safeOrig = escapeHtml(msg.fileInfo.originalName || 'image');
      const safeUrlAttr = escapeHtml(safeMediaUrl);
      mediaHtml = `
        <div class="media-image-container" data-img-url="${safeUrlAttr}" data-img-name="${safeOrig}">
          <img src="${safeUrlAttr}" alt="${safeOrig}" loading="lazy">
          <div class="media-image-overlay">
            <span class="overlay-zoom-icon">🔍 확대보기</span>
          </div>
        </div>
      `;
    } else if (safeMediaUrl && msg.type === 'video' && msg.fileInfo) {
      const safeMime = escapeHtml(msg.fileInfo.mimetype || 'video/mp4');
      const safeUrlAttr = escapeHtml(safeMediaUrl);
      mediaHtml = `
        <div class="media-video-container">
          <video controls preload="metadata">
            <source src="${safeUrlAttr}" type="${safeMime}">
            브라우저가 동영상 재생을 지원하지 않습니다.
          </video>
        </div>
      `;
    } else if (safeMediaUrl && msg.type === 'file' && msg.fileInfo) {
      const safeOrig = escapeHtml(msg.fileInfo.originalName || 'file');
      const ext = safeOrig.split('.').pop() || '';
      const icon = getFileIcon(ext);
      const safeUrlAttr = escapeHtml(safeMediaUrl);
      mediaHtml = `
        <div class="media-file-card">
          <div class="file-card-icon">${icon}</div>
          <div class="file-card-details">
            <span class="file-card-name" title="${safeOrig}">${safeOrig}</span>
            <span class="file-card-size">${formatFileSize(msg.fileInfo.size)}</span>
          </div>
          <a href="${safeUrlAttr}" download="${safeOrig}" target="_blank" class="file-download-btn" title="다운로드">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </a>
        </div>
      `;
    }

    const captionHtml = msg.content ? `<div class="media-caption">${formatText(msg.content)}</div>` : '';

    row.innerHTML = `
      <div class="msg-content-box">
        <div class="msg-info-line">
          <span class="msg-author">${authorPrefix}${escapeHtml(msg.sender?.nickname || '사용자')}</span>
          <span class="msg-time">${formatMsgTime(msg.timestamp)}</span>
        </div>
        <div class="msg-bubble">
          ${mediaHtml}
          ${captionHtml}
        </div>
      </div>
    `;

    const imgEl = row.querySelector('.media-image-container');
    if (imgEl) {
      imgEl.addEventListener('click', () => {
        openLightbox(imgEl.dataset.imgUrl, imgEl.dataset.imgName);
      });
      const imgTag = imgEl.querySelector('img');
      if (imgTag) {
        imgTag.addEventListener('load', () => {
          scrollToBottom();
        });
      }
    }

    return row;
  }

  // Append Single Message (with DOM Capping for zero memory leaks)
  const MAX_DOM_NODES = 200;
  function appendMessage(msg, shouldScroll = true) {
    const el = createMessageElement(msg);
    if (!el) return;
    messagesContainer.appendChild(el);

    // Drop oldest message nodes when exceeding threshold to prevent memory bloat
    while (messagesContainer.children.length > MAX_DOM_NODES) {
      messagesContainer.removeChild(messagesContainer.firstElementChild);
    }

    if (shouldScroll) scrollToBottom();
  }

  function scrollToBottom() {
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    requestAnimationFrame(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeMediaUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const clean = url.trim();
    if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(clean) && !clean.includes('..')) {
      return clean;
    }
    try {
      const parsed = new URL(clean, window.location.origin);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === window.location.origin) {
        if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(parsed.pathname) && !parsed.pathname.includes('..')) {
          return parsed.pathname;
        }
      }
    } catch (e) {}
    return '';
  }

  function formatText(text) {
    if (!text) return '';
    if (text.indexOf('http://') === -1 && text.indexOf('https://') === -1) {
      return escapeHtml(text);
    }
    const urlRegex = /https?:\/\/[^\s"'<>]+/g;
    let parts = [];
    let lastIndex = 0;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      let url = match[0];
      let endTrim = '';
      while (/[.,?!:;)\]]$/.test(url)) {
        endTrim = url.slice(-1) + endTrim;
        url = url.slice(0, -1);
      }
      const before = text.substring(lastIndex, match.index);
      parts.push(escapeHtml(before));
      const safeUrl = escapeHtml(url);
      parts.push('<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: underline;">' + safeUrl + '</a>' + escapeHtml(endTrim));
      lastIndex = match.index + match[0].length;
    }
    parts.push(escapeHtml(text.substring(lastIndex)));
    return parts.join('');
  }


  // Typing emitter & auto-resize (Zero-layout-thrashing)
  let lastTextareaHeight = 0;
  messageInput.addEventListener('input', () => {
    if (messageInput.scrollHeight !== lastTextareaHeight) {
      messageInput.style.height = 'auto';
      const h = Math.min(messageInput.scrollHeight, 120);
      messageInput.style.height = h + 'px';
      lastTextareaHeight = h;
    }

    const hasContent = messageInput.value.trim().length > 0;
    if (hasContent) {
      if (!isTyping && socket && socket.connected) {
        isTyping = true;
        socket.emit('typing', { roomId: currentRoom.id, isTyping: true });
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        if (socket && socket.connected) {
          socket.emit('typing', { roomId: currentRoom.id, isTyping: false });
        }
      }, 1500);
    } else {
      if (isTyping) {
        isTyping = false;
        clearTimeout(typingTimeout);
        if (socket && socket.connected) {
          socket.emit('typing', { roomId: currentRoom.id, isTyping: false });
        }
      }
    }
  });

  // Enter to send, Shift+Enter for newline
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSendMessage();
    });
  }

  // File Attach Button (Guarded)
  if (attachBtn && fileInputElement) {
    attachBtn.addEventListener('click', () => {
      if (!mediaUploadEnabled) return;
      fileInputElement.click();
    });
    fileInputElement.addEventListener('change', () => {
      if (!mediaUploadEnabled) return;
      if (fileInputElement.files && fileInputElement.files[0]) {
        handleFileSelected(fileInputElement.files[0]);
      }
    });
  }

  function handleFileSelected(file) {
    if (!mediaUploadEnabled) {
      appendSystemNotice('* 이미지, 동영상 및 파일 업로드 기능은 서버 정책에 따라 지원하지 않습니다.');
      return;
    }
  }

  if (removeAttachBtn) {
    removeAttachBtn.addEventListener('click', () => {
      pendingFile = null;
      if (fileInputElement) fileInputElement.value = '';
      if (attachmentPreviewBar) attachmentPreviewBar.style.display = 'none';
    });
  }

  // Drag and drop block & notice
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendSystemNotice('* 이미지, 동영상 및 파일 업로드 기능은 서버 정책에 따라 지원하지 않습니다.');
    }
  }, false);

  // Clipboard Paste (Ctrl+V) Image block & notice
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (let item of items) {
      if (item.kind === 'file') {
        e.preventDefault();
        appendSystemNotice('* 이미지, 동영상 및 파일 업로드 기능은 서버 정책에 따라 지원하지 않습니다.');
        break;
      }
    }
  });

  // Upload File via XHR for progress bar
  function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error('업로드 실패: ' + xhr.statusText));
        }
      };

      xhr.onerror = () => reject(new Error('네트워크 오류'));
      xhr.send(formData);
    });
  }

  // Slash Command Parser
  function parseSlashCommand(rawInput) {
    const trimmed = rawInput.trim();
    if (!trimmed.startsWith('/')) return false;

    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const restText = args.join(' ');

    switch (cmd) {
      case 'join':
      case 'j': {
        const target = args[0];
        if (!target) {
          appendSystemNotice('사용법: /join #채널명 [비밀번호]');
          return true;
        }
        const key = args[1] || '';
        socket.emit('join_channel', { channelName: target, key });
        return true;
      }
      case 'list': {
        socket.emit('get_server_channels');
        openModal(serverListModal);
        return true;
      }
      case 'servers': {
        openNetworkServersExplorer(true);
        return true;
      }
      case 'server': {
        const targetSrvUrl = args[0];
        if (!targetSrvUrl) {
          openNetworkServersExplorer(false);
          return true;
        }
        const targetCh = args[1] || '#자유대화';
        connectToRemoteServerChannel(targetSrvUrl, targetCh);
        return true;
      }
      case 'servername':
      case 'serverurl':
      case 'peer':
      case 'extcmd': {
        socket.emit('peer_admin_command', { subCmd: cmd, args });
        return true;
      }
      case 'mode': {
        if (args.length === 0) {
          if (currentRoom.type === 'channel') {
            socket.emit('set_channel_mode', { roomId: currentRoom.id, modeStr: '' });
          } else {
            appendSystemNotice('사용법: /mode #채널 [+/-모드] [인자]');
          }
          return true;
        }
        let target = args[0];
        let modeStr = '';
        let params = '';

        if (target.startsWith('#')) {
          modeStr = args[1] || '';
          params = args.slice(2).join(' ');
        } else if (target.startsWith('+') || target.startsWith('-')) {
          modeStr = args[0];
          params = args.slice(1).join(' ');
          target = currentRoom.id;
        } else {
          appendSystemNotice(`사용자 모드 [${target}]: 사용자 모드는 현재 지원되지 않습니다.`);
          return true;
        }

        if (!target.startsWith('#')) {
          appendSystemNotice('사용법: /mode #채널 [+/-모드] [인자]');
          return true;
        }

        socket.emit('set_channel_mode', { roomId: target, modeStr, params });
        return true;
      }
      case 'invite': {
        const targetNick = args[0];
        const targetRoom = args[1] || (currentRoom.type === 'channel' ? currentRoom.id : null);
        if (!targetNick || !targetRoom) {
          appendSystemNotice('사용법: /invite <닉네임> [#채널명]');
          return true;
        }
        socket.emit('invite_user', { targetNickname: targetNick, roomId: targetRoom });
        return true;
      }
      case 'whois':
      case 'w': {
        const target = args[0];
        if (!target) {
          appendSystemNotice('사용법: /whois <닉네임> (또는 우측 접속자 목록 클릭)');
          return true;
        }
        socket.emit('whois', { target });
        return true;
      }
      case 'msg':
      case 'query': {
        appendSystemNotice('* 1:1 대화 기능은 서버 정책에 따라 분리/비활성화되어 있습니다.');
        return true;
      }
      case 'part':
      case 'leave': {
        if (currentRoom.type === 'channel') {
          socket.emit('part_channel', { channelId: currentRoom.id });
        } else {
          appendSystemNotice('1:1 대화방에서는 /part 대신 사이드바에서 채널을 선택하세요.');
        }
        return true;
      }
      case 'topic': {
        if (currentRoom.type !== 'channel') {
          appendSystemNotice('채널에서만 토픽을 설정할 수 있습니다.');
          return true;
        }
        if (restText) {
          socket.emit('set_topic', { channelId: currentRoom.id, topic: restText });
        } else {
          appendSystemNotice(`현재 ${currentRoom.name} 채널의 토픽: "${currentRoom.topic || '설정된 토픽 없음'}"`);
        }
        return true;
      }
      case 'op': {
        if (currentRoom.type !== 'channel') {
          appendSystemNotice('채널에서만 방장(@) 권한을 부여할 수 있습니다.');
          return true;
        }
        if (!restText) {
          appendSystemNotice('사용법: /op <닉네임>');
          return true;
        }
        socket.emit('grant_op', { roomId: currentRoom.id, targetNickname: restText });
        return true;
      }
      case 'deop': {
        if (currentRoom.type !== 'channel') {
          appendSystemNotice('채널에서만 방장(@) 권한을 해제할 수 있습니다.');
          return true;
        }
        if (!restText) {
          appendSystemNotice('사용법: /deop <닉네임>');
          return true;
        }
        socket.emit('revoke_op', { roomId: currentRoom.id, targetNickname: restText });
        return true;
      }
      case 'kick': {
        if (currentRoom.type !== 'channel') {
          appendSystemNotice('채널에서만 강퇴(kick) 기능을 사용할 수 있습니다.');
          return true;
        }
        const targetNick = args[0];
        if (!targetNick) {
          appendSystemNotice('사용법: /kick <닉네임> [사유]');
          return true;
        }
        const reason = args.slice(1).join(' ') || '채널 방장에 의해 추방되었습니다.';
        socket.emit('kick_user', { roomId: currentRoom.id, targetNickname: targetNick, reason });
        return true;
      }
      case 'oper': {
        if (args.length < 2) {
          appendSystemNotice('사용법: /oper <아이디> <비밀번호>');
          return true;
        }
        const [operId, operPw] = args;
        socket.emit('oper_login', { operId, operPw });
        return true;
      }
      case 'aioper': {
        if (args.length < 2) {
          appendSystemNotice('사용법: /aioper <아이디> <비밀번호>');
          return true;
        }
        const [operId, operPw] = args;
        socket.emit('aioper_login', { operId, operPw });
        return true;
      }
      case 'ban': {
        const targetNick = args[0];
        if (!targetNick) {
          appendSystemNotice('사용법: /ban <닉네임> [사유]');
          return true;
        }
        const reason = args.slice(1).join(' ') || '서버 운영 정책 위반으로 영구 차단되었습니다.';
        socket.emit('ban_user', { targetNickname: targetNick, reason });
        return true;
      }
      case 'unban': {
        const target = args[0];
        if (!target) {
          appendSystemNotice('사용법: /unban <닉네임 또는 IP주소>');
          return true;
        }
        socket.emit('unban_ip', { target, targetIp: target });
        return true;
      }
      case 'banlist': {
        socket.emit('get_banlist');
        return true;
      }
      case 'nick': {
        const targetNick = restText.trim();
        if (!targetNick) {
          appendSystemNotice('사용법: /nick <새로운닉네임>');
          return true;
        }
        if (targetNick.length > 16) {
          appendSystemNotice('닉네임은 최대 16자까지 설정할 수 있습니다.');
          return true;
        }
        socket.emit('change_nickname', { newNickname: targetNick });
        return true;
      }
      case 'nickpass':
      case 'identify':
      case 'id':
      case 'register':
      case 'unregister': {
        if ((cmd === 'nickpass' && args.length >= 1) || (cmd === 'register' && args.length >= 1) || (cmd === 'identify' && args.length >= 1) || (cmd === 'id' && args.length >= 1)) {
          sessionNickpass = args[0];
        } else if (cmd === 'unregister') {
          sessionNickpass = '';
        }
        socket.emit('send_message', {
          roomId: currentRoom.id,
          content: trimmed,
          type: 'text'
        });
        return true;
      }
      case 'me': {
        if (!restText) {
          appendSystemNotice('사용법: /me <행동>');
          return true;
        }
        socket.emit('send_message', {
          roomId: currentRoom.id,
          content: restText,
          type: 'action'
        });
        return true;
      }
      case 'clear': {
        messagesContainer.innerHTML = '';
        appendSystemNotice('화면의 대화창을 지웠습니다. (브라우저 로컬 저장소에는 대화가 유지됩니다)');
        return true;
      }
      case 'export': {
        exportChatHistory(currentRoom.id);
        return true;
      }
      case 'help': {
        updateHelpModalOperVisibility();
        openModal(cmdHelpModal);
        return true;
      }
      default: {
        // Check if current server provides this as a server-scoped extended command
        const extCmds = Array.isArray(currentServerInfo?.extendedCommands) ? currentServerInfo.extendedCommands : [];
        const matchedExt = extCmds.find(ec => ec && ec.command && ec.command.toLowerCase() === `/${cmd}`);
        if (matchedExt) {
          socket.emit('exec_server_command', {
            command: `/${cmd}`,
            args: restText,
            roomId: currentRoom.id
          });
          return true;
        }
        appendSystemNotice(`알 수 없는 명령어입니다: /${cmd} (이 서버에서 지원하지 않거나 비활성화된 확장 명령어입니다. /help 참고)`);
        return true;
      }
    }
  }

  function appendSystemNotice(text) {
    const row = document.createElement('div');
    row.className = 'system-message-row';
    row.innerHTML = `<span class="system-message-badge">${escapeHtml(text)}</span>`;
    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  function appendWhoisNotice(formattedText) {
    if (!messagesContainer) return;
    const row = document.createElement('div');
    row.className = 'whois-message-row';
    const box = document.createElement('div');
    box.className = 'whois-box';
    box.textContent = formattedText;
    row.appendChild(box);
    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  // =========================================================
  // Multi-Server Identity, Whitelist Directory & Scoped Modules
  // =========================================================
  function updateHeaderServerBadge() {
    const srvName = currentServerInfo?.serverName || '표준서버';
    if (currentServerBadge) {
      currentServerBadge.textContent = srvName;
      currentServerBadge.title = `현재 접속 서버: ${srvName} (${currentServerInfo?.serverUrl || window.location.origin}) — 클릭하면 서버 리스트(/servers) 열기`;
    }
    const winTitle = document.getElementById('mainWindowTitle');
    if (winTitle) {
      const rName = currentRoom?.name || currentRoom?.id || '#자유대화';
      winTitle.textContent = `Nyaa Chat - [${rName}]`;
    }
  }

  function applyServerIdentityAndModules(sInfo) {
    currentServerInfo = {
      serverName: sInfo.serverName || window.location.hostname || '표준서버',
      serverUrl: sInfo.serverUrl || window.location.origin,
      host: sInfo.host || window.location.host || 'localhost',
      protocol: sInfo.protocol || 'nyaa-core-v1',
      extendedCommands: Array.isArray(sInfo.extendedCommands) ? sInfo.extendedCommands : [],
      modules: Array.isArray(sInfo.modules) ? sInfo.modules : []
    };

    updateHeaderServerBadge();
    renderMultiServersSidebar();

    // Update Server-Specific Extended Command Bar (auto-hides on standard servers without extensions!)
    const extCmds = currentServerInfo.extendedCommands;
    const srvMods = currentServerInfo.modules;
    if (serverExtBar && serverExtBtnsContainer) {
      serverExtBtnsContainer.innerHTML = '';
      if (extCmds.length === 0 && srvMods.length === 0) {
        serverExtBar.style.display = 'none';
      } else {
        serverExtBar.style.display = 'flex';
        if (serverExtBarLabel) {
          serverExtBarLabel.textContent = `[${currentServerInfo.serverName}] 전용 확장:`;
        }
        extCmds.forEach((ec) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'icon-btn-text';
          btn.style.cssText = 'font-size: 11.5px; padding: 2px 8px; border: 1px solid #10b981; color: #34d399; background: rgba(16, 185, 129, 0.12); cursor: pointer;';
          btn.textContent = `${ec.command} (${ec.description || '확장'})`;
          btn.title = `${ec.description || ec.command} — 클릭 시 즉시 실행 (타 서버 이동 시 자동 비활성화)`;
          btn.addEventListener('click', () => {
            socket.emit('exec_server_command', {
              command: ec.command,
              args: '',
              roomId: currentRoom.id
            });
          });
          serverExtBtnsContainer.appendChild(btn);
        });

        srvMods.forEach((mod) => {
          const badge = document.createElement('span');
          badge.style.cssText = 'font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8;';
          badge.textContent = `모듈: ${mod.id}${mod.downloadUrl ? ' (다운로드 제공)' : ''}`;
          serverExtBtnsContainer.appendChild(badge);
        });

        const extKey = `${currentServerInfo.serverUrl}|${extCmds.map(e => e.command).join(',')}`;
        if (announcedServerExtKey !== extKey && extCmds.length > 0) {
          announcedServerExtKey = extKey;
          appendSystemNotice(`* [${currentServerInfo.serverName}] 전용 확장 명령어 고지: ${extCmds.map(e => `${e.command}(${e.description})`).join(', ')} — 이 서버에서만 활성화되며 타 서버에서는 자동 비활성화됩니다.`);
        }
      }
    }
  }

  function renderMultiServersSidebar() {
    if (!multiServersList) return;
    multiServersList.innerHTML = '';

    const serversToRender = networkDirectoryServers.length > 0
      ? networkDirectoryServers
      : [{
          serverName: currentServerInfo.serverName,
          serverUrl: currentServerInfo.serverUrl,
          host: currentServerInfo.host,
          isSelf: true,
          online: true,
          userCount: lastUsersList.length || 1,
          publicChannels: lastChannelsList || []
        }];

    serversToRender.forEach((srv) => {
      const isCurrent = Boolean(srv.isSelf || srv.serverUrl === currentServerInfo.serverUrl || srv.host === currentServerInfo.host);
      const item = document.createElement('div');
      item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-radius: 5px; font-size: 12px; cursor: pointer; background: ${isCurrent ? 'rgba(56, 189, 248, 0.16)' : 'transparent'}; color: ${isCurrent ? '#38bdf8' : 'var(--text-secondary)'}; font-weight: ${isCurrent ? '700' : '500'};`;
      const statusDot = srv.online !== false ? '●' : '○';
      item.innerHTML = `
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${statusDot} ${escapeHtml(srv.serverName || srv.host)} <small style="opacity:0.75;">(${escapeHtml(srv.host || '')})</small></span>
        <span style="font-size: 11px; opacity: 0.8;">${isCurrent ? '현재창' : '탐색'}</span>
      `;
      item.title = `${srv.serverName} (${srv.serverUrl}) — 클릭하여 공개채널 보기`;
      item.addEventListener('click', () => {
        selectedNetworkServerUrl = srv.serverUrl;
        openNetworkServersExplorer(false);
      });
      multiServersList.appendChild(item);
    });
  }

  function openNetworkServersExplorer(forceRefresh = false) {
    if (socket && socket.connected) {
      socket.emit('get_network_directory', { refresh: Boolean(forceRefresh) });
    }
    openModal(networkServersModal);
    renderNetworkServersModalList();
  }

  function renderNetworkServersModalList() {
    if (!networkServersListContainer) return;
    const list = networkDirectoryServers.length > 0
      ? networkDirectoryServers
      : [{
          serverName: currentServerInfo.serverName,
          serverUrl: currentServerInfo.serverUrl,
          host: currentServerInfo.host,
          protocol: currentServerInfo.protocol || 'nyaa-core-v1',
          isSelf: true,
          online: true,
          userCount: lastUsersList.length || 1,
          publicChannels: (lastChannelsList || []).map(c => ({ name: c.name || c.id, userCount: c.userCount || 0, topic: c.topic || '' })),
          extendedCommands: currentServerInfo.extendedCommands || [],
          modules: currentServerInfo.modules || []
        }];

    if (networkServerTotalCount) networkServerTotalCount.textContent = String(list.length);
    networkServersListContainer.innerHTML = '';

    if (!selectedNetworkServerUrl && list.length > 0) {
      selectedNetworkServerUrl = list[0].serverUrl;
    }

    list.forEach((srv) => {
      const isSelected = srv.serverUrl === selectedNetworkServerUrl;
      const row = document.createElement('div');
      row.style.cssText = `padding: 9px 10px; margin-bottom: 5px; border-radius: 6px; cursor: pointer; border: 1px solid ${isSelected ? '#38bdf8' : 'var(--border-main)'}; background: ${isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.45)'}; display: flex; flex-direction: column; gap: 3px;`;
      const chCount = Array.isArray(srv.publicChannels) ? srv.publicChannels.length : 0;
      const statusBadge = srv.isSelf
        ? '<span style="color:#38bdf8; font-size:11px; font-weight:700;">[현재 서버]</span>'
        : (srv.online !== false
            ? '<span style="color:#34d399; font-size:11px;">● 온라인</span>'
            : '<span style="color:#f59e0b; font-size:11px;">● 캐시됨(오프라인)</span>');

      row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:13px; color:var(--text-primary);">${escapeHtml(srv.serverName || srv.host)}</strong>
          ${statusBadge}
        </div>
        <div style="font-size:11.5px; color:var(--text-muted); display:flex; justify-content:space-between;">
          <span>주소: ${escapeHtml(srv.host || srv.serverUrl)}</span>
          <span>접속 ${srv.userCount || 0}명 · 공개채널 ${chCount}개</span>
        </div>
      `;

      const selectServerHandler = () => {
        selectedNetworkServerUrl = srv.serverUrl;
        renderNetworkServersModalList();
      };
      row.addEventListener('click', selectServerHandler);
      row.addEventListener('dblclick', selectServerHandler);
      networkServersListContainer.appendChild(row);
    });

    const selectedSrv = list.find(s => s.serverUrl === selectedNetworkServerUrl) || list[0];
    if (selectedSrv) {
      renderSelectedServerPublicChannels(selectedSrv);
    }
  }

  function renderSelectedServerPublicChannels(srv) {
    if (!selectedNetworkChannelsContainer) return;
    if (selectedNetworkServerTitle) {
      selectedNetworkServerTitle.textContent = `2. [${srv.serverName || srv.host}] 공개채널 리스트 (더블클릭 시 입장)`;
    }
    if (selectedNetworkServerProto) {
      selectedNetworkServerProto.textContent = `프로토콜: ${srv.protocol || 'nyaa-core-v1'}`;
    }

    const extCmds = Array.isArray(srv.extendedCommands) ? srv.extendedCommands : [];
    const mods = Array.isArray(srv.modules) ? srv.modules : [];
    if (selectedNetworkServerModulesBox) {
      if (extCmds.length === 0 && mods.length === 0) {
        selectedNetworkServerModulesBox.textContent = '서버 전용 확장 명령어/모듈: 없음 (순수 표준 호환 서버 — 하위호환 100%)';
      } else {
        const cmdText = extCmds.map(c => `${c.command}(${c.description || '확장'})`).join(', ');
        const modText = mods.map(m => `${m.name || m.id}`).join(', ');
        selectedNetworkServerModulesBox.textContent = `전용 확장: ${[cmdText, modText].filter(Boolean).join(' / ')} (해당 서버 창에서만 활성화)`;
      }
    }

    const channels = Array.isArray(srv.publicChannels) ? srv.publicChannels : [];
    selectedNetworkChannelsContainer.innerHTML = '';

    if (channels.length === 0) {
      selectedNetworkChannelsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12.5px;">표시할 공개채널이 없습니다. 아래 직접 입력란에서 #채널명으로 바로 입장할 수 있습니다.</div>';
      return;
    }

    channels.forEach((ch) => {
      const chName = ch.name || ch.id || '#자유대화';
      const row = document.createElement('div');
      row.style.cssText = 'padding: 8px 10px; margin-bottom: 5px; border-radius: 5px; border: 1px solid var(--border-main); background: rgba(15, 23, 42, 0.55); display: flex; justify-content: space-between; align-items: center; gap: 8px; cursor: pointer;';
      row.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13px; font-weight: 700; color: #34d399;">${escapeHtml(chName)} <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(${ch.userCount || 0}명)</span></div>
          <div style="font-size: 11.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(ch.topic || '설정된 토픽 없음')}</div>
        </div>
        <button type="button" class="primary-btn" style="padding: 4px 10px; margin-top: 0; font-size: 11.5px; white-space: nowrap;">입장 ↗</button>
      `;

      const joinHandler = () => {
        connectToRemoteServerChannel(srv.serverUrl, chName, srv.isSelf);
      };
      row.addEventListener('dblclick', joinHandler);
      const btn = row.querySelector('button');
      if (btn) btn.addEventListener('click', (e) => {
        e.stopPropagation();
        joinHandler();
      });

      selectedNetworkChannelsContainer.appendChild(row);
    });
  }

  function connectToRemoteServerChannel(targetServerUrl, targetChannelName, isSelfServer = false) {
    let cleanCh = (targetChannelName || '#자유대화').trim();
    if (!cleanCh.startsWith('#')) cleanCh = '#' + cleanCh;

    let cleanUrl = (targetServerUrl || '').trim().replace(/\/+$/, '');
    if (!cleanUrl) return;
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const isSameOrigin = isSelfServer || cleanUrl.toLowerCase() === window.location.origin.toLowerCase() || cleanUrl.toLowerCase() === (currentServerInfo?.serverUrl || '').toLowerCase();
    closeModal(networkServersModal);

    if (isSameOrigin) {
      socket.emit('join_channel', { channelName: cleanCh });
      return;
    }

    // Open simultaneous multi-server connection window with current nickname and target channel!
    const nickParam = encodeURIComponent(currentUser?.nickname || nicknameInput?.value || '');
    const chParam = encodeURIComponent(cleanCh);
    const joinUrl = `${cleanUrl}/?channel=${chParam}${nickParam ? `&nick=${nickParam}` : ''}`;
    appendSystemNotice(`* 다중 서버 동시 접속: [${cleanUrl}] 서버의 [${cleanCh}] 채널 창을 새로 엽니다...`);
    window.open(joinUrl, '_blank', 'noopener');
  }

  // Modal helpers
  const allModals = [createChannelModal, editTopicModal, cmdHelpModal, serverListModal, channelKeyModal, networkServersModal];
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'flex';
    modalEl.classList.add('active');
  }
  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    modalEl.classList.remove('active');
  }

  // Backdrop click to close modals
  allModals.forEach((modalEl) => {
    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
          closeModal(modalEl);
        }
      });
    }
  });

  // Send Message Logic (Unified for Enter key, Send button, and Form submit)
  async function handleSendMessage() {
    // Immediately cancel typing indicator
    if (isTyping) {
      isTyping = false;
      clearTimeout(typingTimeout);
      if (socket && socket.connected) {
        socket.emit('typing', { roomId: currentRoom.id, isTyping: false });
      }
    }

    const text = messageInput.value.trim();
    if (!text && !pendingFile) return;

    // Check for slash command (/join, /topic, /op, /deop, /nick, /me, /clear, /help, /export)
    if (text.startsWith('/')) {
      messageInput.value = '';
      messageInput.style.height = 'auto';
      parseSlashCommand(text);
      return;
    }

    let fileInfo = null;
    let msgType = 'text';

    if (pendingFile) {
      uploadProgressBar.style.display = 'block';
      progressFill.style.width = '10%';

      try {
        const uploadRes = await uploadFile(pendingFile, (pct) => {
          progressFill.style.width = `${pct}%`;
        });

        if (uploadRes.success) {
          fileInfo = uploadRes.file;
          msgType = fileInfo.fileType; // 'image' | 'video' | 'file'
        }
      } catch (err) {
        alert('파일 업로드 중 오류가 발생했습니다: ' + err.message);
        uploadProgressBar.style.display = 'none';
        return;
      }

      // Reset file input
      pendingFile = null;
      fileInputElement.value = '';
      attachmentPreviewBar.style.display = 'none';
      uploadProgressBar.style.display = 'none';
      progressFill.style.width = '0%';
    }

    // Emit message to server
    if (socket && socket.connected) {
      socket.emit('send_message', {
        roomId: currentRoom.id,
        recipientId: (currentRoom.type === 'dm') ? currentRoom.targetUserId : undefined,
        content: text,
        type: msgType,
        fileInfo
      });
    }

    // Reset input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    playChime('send');
    scrollToBottom();
  }

  // Send Message Form Submit
  chatInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Modal Event Listeners: Channel Creation
  if (openCreateChannelBtn) {
    openCreateChannelBtn.addEventListener('click', () => {
      newChannelNameInput.value = '';
      newChannelTopicInput.value = '';
      if (newChannelKeyInput) newChannelKeyInput.value = '';
      if (newChannelLimitInput) newChannelLimitInput.value = '';
      const pubRadio = document.querySelector('input[name="newChannelVisibility"][value="public"]');
      if (pubRadio) pubRadio.checked = true;
      openModal(createChannelModal);
      newChannelNameInput.focus();
    });
  }
  if (closeCreateChannelBtn) {
    closeCreateChannelBtn.addEventListener('click', () => {
      closeModal(createChannelModal);
    });
  }
  if (cancelCreateChannelBtn) {
    cancelCreateChannelBtn.addEventListener('click', () => {
      closeModal(createChannelModal);
    });
  }
  if (createChannelForm) {
    createChannelForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const chName = newChannelNameInput.value.trim();
      const topic = newChannelTopicInput.value.trim();
      const vis = document.querySelector('input[name="newChannelVisibility"]:checked')?.value || 'public';
      const keyVal = newChannelKeyInput ? newChannelKeyInput.value.trim() : '';
      const limitVal = newChannelLimitInput ? newChannelLimitInput.value.trim() : '';
      if (!chName) return;

      socket.emit('join_channel', {
        channelName: chName,
        topic,
        isPrivate: vis === 'private',
        isSecret: vis === 'secret',
        key: keyVal || null,
        limit: limitVal ? parseInt(limitVal, 10) : null
      });
      closeModal(createChannelModal);
    });
  }

  // Modal Event Listeners: Topic & Channel Modes Editing
  if (editTopicBtn) {
    editTopicBtn.addEventListener('click', () => {
      if (currentRoom.type !== 'channel') {
        alert('채널에서만 토픽과 모드를 수정할 수 있습니다.');
        return;
      }
      const isOp = (Array.isArray(currentRoom.operators) && currentRoom.operators.includes(currentUser?.userId)) || currentUser?.isServerOper;
      if (currentRoom.operators && currentRoom.operators.length > 0 && !isOp) {
        alert('채널 주제(Topic) 및 모드 설정은 방장(@) 권한이 있는 사용자만 변경할 수 있습니다.');
        return;
      }
      editTopicInput.value = currentRoom.topic || '';

      if (currentRoom.rawModes) {
        const m = currentRoom.rawModes;
        if (m.s) {
          const s = document.getElementById('editVisSecret');
          if (s) s.checked = true;
        } else if (m.p) {
          const p = document.getElementById('editVisPrivate');
          if (p) p.checked = true;
        } else {
          const pub = document.getElementById('editVisPublic');
          if (pub) pub.checked = true;
        }
        if (editChannelKeyInput) editChannelKeyInput.value = m.k || '';
        if (editChannelLimitInput) editChannelLimitInput.value = m.l || '';
        if (editChannelTopicLockCheck) editChannelTopicLockCheck.checked = Boolean(m.t);
        if (editChannelModeratedCheck) editChannelModeratedCheck.checked = Boolean(m.m);
        if (editChannelInviteOnlyCheck) editChannelInviteOnlyCheck.checked = Boolean(m.i);
      }
      openModal(editTopicModal);
      editTopicInput.focus();
    });
  }
  if (closeEditTopicBtn) {
    closeEditTopicBtn.addEventListener('click', () => {
      closeModal(editTopicModal);
    });
  }
  if (cancelEditTopicBtn) {
    cancelEditTopicBtn.addEventListener('click', () => {
      closeModal(editTopicModal);
    });
  }
  if (editTopicForm) {
    editTopicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newTopic = editTopicInput.value.trim();
      const vis = document.querySelector('input[name="editChannelVisibility"]:checked')?.value || 'public';
      const keyVal = editChannelKeyInput ? editChannelKeyInput.value.trim() : '';
      const limitVal = editChannelLimitInput ? editChannelLimitInput.value.trim() : '';

      socket.emit('set_topic', {
        channelId: currentRoom.id,
        topic: newTopic,
        modeSettings: {
          isPrivate: vis === 'private',
          isSecret: vis === 'secret',
          key: keyVal || null,
          limit: limitVal ? parseInt(limitVal, 10) : null,
          isTopicProtected: Boolean(editChannelTopicLockCheck?.checked),
          isModerated: Boolean(editChannelModeratedCheck?.checked),
          isInviteOnly: Boolean(editChannelInviteOnlyCheck?.checked)
        }
      });
      closeModal(editTopicModal);
    });
  }

  // Modal Event Listeners: Server List (/list)
  if (openServerListBtn) {
    openServerListBtn.addEventListener('click', () => {
      socket.emit('get_server_channels');
      openModal(serverListModal);
    });
  }
  if (closeServerListBtn) {
    closeServerListBtn.addEventListener('click', () => {
      closeModal(serverListModal);
    });
  }
  if (confirmServerListBtn) {
    confirmServerListBtn.addEventListener('click', () => {
      closeModal(serverListModal);
    });
  }
  if (refreshServerListBtn) {
    refreshServerListBtn.addEventListener('click', () => {
      socket.emit('get_server_channels');
    });
  }
  if (serverChannelSearchInput) {
    serverChannelSearchInput.addEventListener('input', () => {
      renderServerChannelList(serverChannelsData);
    });
  }

  // Modal Event Listeners: Distributed Whitelist Network Servers (/servers or F2)
  if (openNetworkServersBtn) {
    openNetworkServersBtn.addEventListener('click', () => openNetworkServersExplorer(false));
  }
  if (headerServerListBtn) {
    headerServerListBtn.addEventListener('click', () => openNetworkServersExplorer(false));
  }
  if (currentServerBadge) {
    currentServerBadge.style.cursor = 'pointer';
    currentServerBadge.addEventListener('click', () => openNetworkServersExplorer(false));
  }
  if (closeNetworkServersBtn) {
    closeNetworkServersBtn.addEventListener('click', () => closeModal(networkServersModal));
  }
  if (confirmNetworkServersBtn) {
    confirmNetworkServersBtn.addEventListener('click', () => closeModal(networkServersModal));
  }
  if (refreshNetworkServersBtn) {
    refreshNetworkServersBtn.addEventListener('click', () => openNetworkServersExplorer(true));
  }
  if (directServerConnectBtn) {
    directServerConnectBtn.addEventListener('click', () => {
      const srvUrl = (directServerUrlInput?.value || '').trim();
      const chName = (directServerChannelInput?.value || '#자유대화').trim();
      if (!srvUrl) {
        alert('접속할 서버 주소(예: https://c.org)를 입력해 주세요.');
        return;
      }
      connectToRemoteServerChannel(srvUrl, chName, false);
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      openNetworkServersExplorer(false);
    }
  });

  // Modal Event Listeners: Channel Key Prompt (+k)
  if (closeChannelKeyBtn) {
    closeChannelKeyBtn.addEventListener('click', () => {
      closeModal(channelKeyModal);
    });
  }
  if (cancelChannelKeyBtn) {
    cancelChannelKeyBtn.addEventListener('click', () => {
      closeModal(channelKeyModal);
    });
  }
  if (channelKeyForm) {
    channelKeyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = (channelKeyInput?.value || '').trim();
      const targetRoomId = channelKeyTargetRoomId?.value || '';
      if (!pass || !targetRoomId) return;

      socket.emit('join_channel', { channelName: targetRoomId, key: pass });
      closeModal(channelKeyModal);
    });
  }

  // Help & Export Buttons
  if (helpCmdBtn) {
    helpCmdBtn.addEventListener('click', () => {
      updateHelpModalOperVisibility();
      openModal(cmdHelpModal);
    });
  }
  if (closeCmdHelpBtn) {
    closeCmdHelpBtn.addEventListener('click', () => {
      closeModal(cmdHelpModal);
    });
  }
  if (confirmCmdHelpBtn) {
    confirmCmdHelpBtn.addEventListener('click', () => {
      closeModal(cmdHelpModal);
    });
  }
  if (exportChatBtn) {
    exportChatBtn.addEventListener('click', () => {
      exportChatHistory(currentRoom.id);
    });
  }

  // Lightbox View
  function openLightbox(url, name) {
    lightboxImg.src = url;
    lightboxFileName.textContent = name;
    lightboxDownloadBtn.href = url;
    lightboxDownloadBtn.setAttribute('download', name);
    imageLightbox.style.display = 'flex';
  }
  function closeLightbox() {
    imageLightbox.style.display = 'none';
    lightboxImg.src = '';
  }
  lightboxCloseBtn.addEventListener('click', closeLightbox);
  lightboxBackdrop.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageLightbox.style.display === 'flex') {
      closeLightbox();
    }
  });

  // Media Drawer & Gallery
  toggleGalleryBtn.addEventListener('click', () => {
    mediaDrawer.classList.toggle('open');
  });
  closeDrawerBtn.addEventListener('click', () => {
    mediaDrawer.classList.remove('open');
  });

  // Drawer Tabs
  let activeDrawerFilter = 'all';
  document.querySelectorAll('.drawer-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeDrawerFilter = tab.dataset.drawerTab;
      renderDrawerMedia(currentHistory);
    });
  });

  function updateGalleryDrawer(history) {
    const mediaMsgs = (history || []).filter((m) => m.fileInfo);
    mediaCountBadge.textContent = mediaMsgs.length;

    const imgCount = mediaMsgs.filter((m) => m.type === 'image').length;
    const vidCount = mediaMsgs.filter((m) => m.type === 'video').length;
    const fileCount = mediaMsgs.filter((m) => m.type === 'file').length;

    countAll.textContent = mediaMsgs.length;
    countImages.textContent = imgCount;
    countVideos.textContent = vidCount;
    countFiles.textContent = fileCount;

    renderDrawerMedia(history);
  }

  function renderDrawerMedia(history) {
    let mediaMsgs = (history || []).filter((m) => m.fileInfo);

    if (activeDrawerFilter === 'images') {
      mediaMsgs = mediaMsgs.filter((m) => m.type === 'image');
    } else if (activeDrawerFilter === 'videos') {
      mediaMsgs = mediaMsgs.filter((m) => m.type === 'video');
    } else if (activeDrawerFilter === 'files') {
      mediaMsgs = mediaMsgs.filter((m) => m.type === 'file');
    }

    if (mediaMsgs.length === 0) {
      drawerMediaList.innerHTML = `
        <div class="drawer-empty-state">
          <span>📂</span>
          <p>공유된 파일이 없습니다.</p>
        </div>
      `;
      return;
    }

    drawerMediaList.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';

    mediaMsgs.forEach((m) => {
      if (m.type === 'image') {
        const item = document.createElement('div');
        item.className = 'gallery-item-thumb';
        item.innerHTML = `<img src="${m.fileInfo.url}" alt="${escapeHtml(m.fileInfo.originalName)}">`;
        item.addEventListener('click', () => openLightbox(m.fileInfo.url, m.fileInfo.originalName));
        grid.appendChild(item);
      } else {
        const fileRow = document.createElement('div');
        fileRow.className = 'gallery-file-row';
        const ext = m.fileInfo.originalName.split('.').pop() || '';
        fileRow.innerHTML = `
          <span>${m.type === 'video' ? '🎬' : getFileIcon(ext)}</span>
          <span class="gallery-file-name" title="${escapeHtml(m.fileInfo.originalName)}">${escapeHtml(m.fileInfo.originalName)}</span>
          <a href="${m.fileInfo.url}" download target="_blank" style="color: var(--accent-cyan); text-decoration: none; font-size: 13px;">받기</a>
        `;
        drawerMediaList.appendChild(fileRow);
      }
    });

    if (grid.children.length > 0) {
      drawerMediaList.prepend(grid);
    }
  }
});
