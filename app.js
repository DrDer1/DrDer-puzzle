(function() {
  'use strict';

  class PWAManager {
    constructor() {
      this.deferredPrompt = null;
      this.swRegistration = null;
      this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      this.promptReceived = false;
      this.gamesPlayed = 0;
      this.installShown = false;
    }

    async init() {
      console.log('App mode:', this.isStandalone ? 'Standalone' : 'Browser');
      if ('serviceWorker' in navigator) {
        try {
          this.swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
          console.log('SW registered:', this.swRegistration.scope);
          this.setupUpdateDetection();
        } catch (err) {
          console.warn('SW failed:', err);
        }
      }
      this.setupInstallEvents();
      this.updateInstallButton();
      setTimeout(() => this.runDiagnostics(), 5000);
    }

    setupInstallEvents() {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.promptReceived = true;
        this.updateInstallButton();
      });
      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null;
        this.isStandalone = true;
        this.updateInstallButton();
        this.closeAllModals();
      });
    }

    setupUpdateDetection() {
      if (!this.swRegistration) return;
      this.swRegistration.addEventListener('updatefound', () => {
        const newWorker = this.swRegistration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.showUpdateBanner();
          }
        });
      });
    }

    showUpdateBanner() {
      const banner = document.createElement('div');
      banner.className = 'update-banner';
      banner.id = 'updateBanner';
      banner.innerHTML = '<span>🔄 يتوفر إصدار جديد!</span><button class="update-btn" id="updateNowBtn">تحديث الآن</button><button class="modal-secondary-btn" id="updateLaterBtn" style="padding:0.5rem 1rem;font-size:0.9rem;">لاحقاً</button>';
      document.body.appendChild(banner);
      document.getElementById('updateNowBtn').onclick = () => { if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('skipWaiting'); window.location.reload(); };
      document.getElementById('updateLaterBtn').onclick = () => banner.remove();
    }

    detectPlatform() {
      const ua = navigator.userAgent.toLowerCase();
      if (/android/.test(ua)) { if (/samsung/i.test(ua)) return 'samsung'; if (/edg/i.test(ua)) return 'edge-android'; return 'android-chrome'; }
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/macintosh/.test(ua)) return 'mac';
      if (/windows/.test(ua)) return 'windows';
      return 'other';
    }

    getPlatformInstructions() {
      const inst = {
        'android-chrome': { name: 'Chrome على Android', steps: 'اضغط على ⋮ ثم "تثبيت التطبيق"' },
        'samsung': { name: 'Samsung Internet', steps: 'اضغط على ☰ ثم "إضافة إلى الشاشة الرئيسية"' },
        'edge-android': { name: 'Edge على Android', steps: 'اضغط على ⋯ ثم "إضافة إلى الهاتف"' },
        'ios': { name: 'Safari على iPhone', steps: 'اضغط على 📤 ثم "Add to Home Screen"' },
        'mac': { name: 'Mac', steps: 'استخدم Chrome واضغط على أيقونة التثبيت في شريط العنوان' },
        'windows': { name: 'Windows', steps: 'استخدم Chrome أو Edge واضغط على أيقونة التثبيت في شريط العنوان' },
        'other': { name: 'جهازك', steps: 'استخدم Chrome واضغط على أيقونة التثبيت في شريط العنوان' }
      };
      return inst[this.detectPlatform()];
    }

    createModal({ icon, title, subtitle, buttons, extraContent = '', className = '' }) {
      this.closeAllModals();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'pwaModal';
      const btnsHTML = buttons.map((btn, i) => `<button class="${i === 0 ? 'modal-primary-btn' : 'modal-secondary-btn'}" id="${btn.id}">${btn.text}</button>`).join('');
      overlay.innerHTML = `<div class="modal-dialog ${className}">${icon ? `<div class="modal-icon">${icon}</div>` : ''}${title ? `<h3 class="modal-title">${title}</h3>` : ''}${subtitle ? `<p class="modal-subtitle">${subtitle}</p>` : ''}${extraContent}<div class="modal-actions">${btnsHTML}</div></div>`;
      document.body.appendChild(overlay);
      buttons.forEach(btn => { const el = document.getElementById(btn.id); if (el) el.onclick = () => { if (btn.onClick) btn.onClick(); this.closeAllModals(); }; });
      setTimeout(() => this.closeAllModals(), 60000);
    }

    closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); }

    showInstallPrompt() {
      if (this.isStandalone || this.installShown) return;
      this.installShown = true;
      this.createModal({ icon: '📲', title: 'تثبيت DrDer Puzzle 1', subtitle: 'ثبّت التطبيق لتجربة أسرع والوصول دون اتصال', buttons: [{ id: 'installNowBtn', text: '📲 تثبيت التطبيق', onClick: () => this.triggerInstall() }, { id: 'installLaterBtn', text: 'لاحقاً' }] });
    }

    showManualInstructions() {
      if (this.isStandalone) return;
      const p = this.getPlatformInstructions();
      this.createModal({ icon: '📱', title: 'تثبيت التطبيق', subtitle: `اتبع الخطوات (${p.name}):`, extraContent: `<div class="platform-instructions"><div class="platform-name">${p.name}:</div><div>${p.steps}</div></div>`, buttons: [{ id: 'manualCloseBtn', text: 'حسناً' }] });
    }

    async triggerInstall() {
      if (this.deferredPrompt) {
        try {
          this.deferredPrompt.prompt();
          await this.deferredPrompt.userChoice;
          this.deferredPrompt = null;
        } catch (err) { console.warn('Install failed:', err); }
      }
      this.updateInstallButton();
    }

    showInstallAfterEngagement() {
      if (this.installShown || this.isStandalone) return;
      setTimeout(() => {
        if (this.deferredPrompt) this.showInstallPrompt();
        else if (!this.isStandalone) this.showManualInstructions();
      }, 2000);
    }

    updateInstallButton() {
      const btn = document.getElementById('permanentInstallBtn');
      if (!btn) return;
      if (this.isStandalone) { btn.style.display = 'none'; }
      else { btn.style.display = 'block'; btn.textContent = this.deferredPrompt ? '📲 تثبيت التطبيق' : '📱 كيفية التثبيت'; }
    }

    runDiagnostics() {
      console.group('PWA Diagnostic - DrDer Puzzle 1');
      console.log('URL:', window.location.href);
      console.log('HTTPS:', (window.location.protocol === 'https:' || window.location.hostname === 'localhost') ? 'OK' : 'FAIL');
      console.log('Standalone:', this.isStandalone ? 'Yes' : 'No');
      console.log('beforeinstallprompt:', this.promptReceived ? 'Received' : 'Not received');
      console.log('SW:', this.swRegistration ? 'Registered' : 'Not registered');
      if (!this.promptReceived && !this.isStandalone) {
        console.log('Possible reasons: 1. Already installed 2. User dismissed 3. Not enough engagement 4. Browser unsupported');
      }
      fetch('./manifest.json').then(r => r.json()).then(d => console.log('Manifest:', d.name)).catch(() => console.log('Manifest: FAIL'));
      console.groupEnd();
    }
  }

  class Game {
    constructor() {
      this.gridSize = 4;
      this.tiles = [];
      this.emptyIndex = 15;
      this.moves = 0;
      this.timerSeconds = 0;
      this.timerInterval = null;
      this.gameActive = false;
      this.timerEnabled = true;
      this.movesCounterEnabled = true;
      this.moveHistory = [];
      this.currentScreen = 'main';
      this.pwa = null;
      this.initDOM();
      this.initEvents();
    }

    initDOM() {
      this.screens = {
        main: document.getElementById('mainMenu'), game: document.getElementById('gameScreen'),
        settings: document.getElementById('settingsScreen'), bestScores: document.getElementById('bestScoresScreen'),
        howToPlay: document.getElementById('howToPlayScreen'), about: document.getElementById('aboutScreen'),
      };
      this.$ = (id) => document.getElementById(id);
      this.puzzleBoard = this.$('puzzleBoard');
      this.timerDisplay = this.$('timerDisplay');
      this.movesDisplay = this.$('movesDisplay');
      this.gameLevelLabel = this.$('gameLevelLabel');
      this.resumeBtn = this.$('resumeGameBtn');
      this.undoBtn = this.$('undoBtn');
      this.timerToggle = this.$('timerToggle');
      this.movesToggle = this.$('movesToggle');
      this.scoresList = this.$('scoresList');
      this.permanentInstallBtn = this.$('permanentInstallBtn');
      this.levelButtons = document.querySelectorAll('.level-btn');
    }

    initEvents() {
      this.$('startGameBtn').onclick = () => { this.startNewGame(this.getSelectedLevel()); if (this.pwa) this.pwa.showInstallAfterEngagement(); };
      this.$('bestScoresBtn').onclick = () => { this.displayBestScores(); this.switchScreen('bestScores'); };
      this.$('settingsBtn').onclick = () => this.switchScreen('settings');
      this.$('howToPlayBtn').onclick = () => this.switchScreen('howToPlay');
      this.$('aboutBtn').onclick = () => this.switchScreen('about');
      this.$('backToMenuBtn').onclick = () => { if (this.pwa) this.pwa.closeAllModals(); this.stopTimer(); this.gameActive = false; this.switchScreen('main'); };
      this.$('newGameBtn').onclick = () => this.startNewGame(this.gridSize);
      this.$('undoBtn').onclick = () => this.undoMove();
      this.$('deleteScoresBtn').onclick = () => { [3,4,5,6,7].forEach(s => localStorage.removeItem('drder_best_' + s)); alert('تم حذف أفضل النتائج.'); };
      this.resumeBtn.onclick = () => { if (!this.resumeGame()) alert('لا توجد لعبة محفوظة.'); };
      this.permanentInstallBtn.onclick = () => { if (this.pwa) { if (this.pwa.deferredPrompt) this.pwa.showInstallPrompt(); else this.pwa.showManualInstructions(); } };
      this.timerToggle.onclick = () => { this.timerToggle.classList.toggle('active'); this.timerEnabled = this.timerToggle.classList.contains('active'); if (this.gameActive) { this.stopTimer(); if (this.timerEnabled) this.startTimer(); } };
      this.movesToggle.onclick = () => { this.movesToggle.classList.toggle('active'); this.movesCounterEnabled = this.movesToggle.classList.contains('active'); this.updateMovesDisplay(); };
      this.levelButtons.forEach(b => b.onclick = () => { this.levelButtons.forEach(x => x.classList.remove('active')); b.classList.add('active'); });
      ['backFromSettingsBtn','backFromScoresBtn','backFromHowToPlayBtn','backFromAboutBtn'].forEach(id => { this.$(id).onclick = () => this.switchScreen('main'); });
      window.addEventListener('keydown', (e) => {
        if (this.currentScreen !== 'game' || !this.gameActive) return;
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undoMove(); return; }
        const key = e.key, size = this.gridSize;
        let target = this.emptyIndex;
        if (key === 'ArrowRight') target = this.emptyIndex + 1;
        else if (key === 'ArrowLeft') target = this.emptyIndex - 1;
        else if (key === 'ArrowUp') target = this.emptyIndex - size;
        else if (key === 'ArrowDown') target = this.emptyIndex + size;
        else return;
        e.preventDefault();
        if (target >= 0 && target < size*size && this.tiles[target] !== 0) {
          if (Math.abs(Math.floor(this.emptyIndex/size) - Math.floor(target/size)) + Math.abs((this.emptyIndex%size) - (target%size)) === 1) this.moveTile(target);
        }
      });
    }

    setPWA(pwa) { this.pwa = pwa; }
    switchScreen(id) { Object.values(this.screens).forEach(s => s.classList.add('hidden')); this.screens[id].classList.remove('hidden'); this.currentScreen = id; if (id === 'main') this.updateResumeVisibility(); }
    getSelectedLevel() { const a = document.querySelector('.level-btn.active'); return a ? parseInt(a.dataset.size) : 4; }
    formatTime(s) { return Math.floor(s/60).toString().padStart(2,'0') + ':' + (s%60).toString().padStart(2,'0'); }
    stopTimer() { if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; } }
    startTimer() { if (!this.timerEnabled || !this.gameActive) return; this.stopTimer(); this.timerInterval = setInterval(() => { this.timerSeconds++; this.timerDisplay.textContent = this.formatTime(this.timerSeconds); this.saveGame(); }, 1000); }
    updateMovesDisplay() { this.movesDisplay.textContent = this.movesCounterEnabled ? this.moves : '--'; }
    countInversions(a) { let inv = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] && a[j] && a[i] > a[j]) inv++; return inv; }
    isSolvable(a, s, ei) { const inv = this.countInversions(a); if (s % 2 === 1) return inv % 2 === 0; return (inv % 2 === 0) === ((s - Math.floor(ei / s)) % 2 === 1); }
    
    generatePuzzle(size) {
      const t = size * size;
      const a = Array.from({ length: t - 1 }, (_, i) => i + 1);
      a.push(0);
      let ei;
      do { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } ei = a.indexOf(0); } while (!this.isSolvable(a, size, ei));
      this.emptyIndex = ei;
      return a;
    }

    renderBoard() {
      this.puzzleBoard.innerHTML = '';
      this.puzzleBoard.style.gridTemplateColumns = 'repeat(' + this.gridSize + ', 1fr)';
      this.tiles.forEach((v, i) => {
        const d = document.createElement('div');
        d.className = 'tile' + (v === 0 ? ' empty' : '');
        if (v !== 0) { d.textContent = v; d.onclick = () => this.handleClick(i); d.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleClick(i); }); }
        this.puzzleBoard.appendChild(d);
      });
    }

    getAdjacent(i) { const s = this.gridSize, r = Math.floor(i/s), c = i%s, adj = []; if (r > 0) adj.push(i-s); if (r < s-1) adj.push(i+s); if (c > 0) adj.push(i-1); if (c < s-1) adj.push(i+1); return adj; }

    moveTile(i, rec = true) {
      if (!this.gameActive || !this.getAdjacent(this.emptyIndex).includes(i)) return false;
      if (rec) this.moveHistory.push({ ti: i, ei: this.emptyIndex, m: this.moves, ts: this.timerSeconds, t: [...this.tiles] });
      [this.tiles[this.emptyIndex], this.tiles[i]] = [this.tiles[i], this.tiles[this.emptyIndex]];
      this.emptyIndex = i;
      this.moves++;
      this.updateMovesDisplay();
      this.renderBoard();
      this.saveGame();
      this.updateUndoBtn();
      if (this.checkWin()) this.handleWin();
      return true;
    }

    handleClick(i) { if (this.tiles[i] !== 0) this.moveTile(i); }

    undoMove() {
      if (!this.gameActive || !this.moveHistory.length) return;
      const l = this.moveHistory.pop();
      this.tiles = [...l.t];
      this.emptyIndex = l.ei;
      this.moves = l.m;
      this.timerSeconds = l.ts;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
      this.renderBoard();
      this.saveGame();
      this.updateUndoBtn();
    }

    updateUndoBtn() { if (this.undoBtn) this.undoBtn.disabled = !this.gameActive || !this.moveHistory.length; }

    checkWin() {
      for (let i = 0; i < this.gridSize * this.gridSize - 1; i++) if (this.tiles[i] !== i + 1) return false;
      return this.tiles[this.gridSize * this.gridSize - 1] === 0;
    }

    showVictory() {
      if (this.pwa) this.pwa.closeAllModals();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'victoryOverlay';
      overlay.innerHTML = '<div class="modal-dialog victory-modal"><div class="victory-icon">🏆</div><h2 class="victory-title">تهانينا!</h2><p class="modal-subtitle">لقد قمت بحل اللغز بنجاح</p><div class="victory-stats"><div class="victory-stat"><span class="victory-stat-icon">⏱️</span><span class="victory-stat-value">' + this.formatTime(this.timerSeconds) + '</span><span class="victory-stat-label">الوقت</span></div><div class="victory-stat-divider"></div><div class="victory-stat"><span class="victory-stat-icon">👆</span><span class="victory-stat-value">' + this.moves + '</span><span class="victory-stat-label">حركة</span></div><div class="victory-stat-divider"></div><div class="victory-stat"><span class="victory-stat-icon">🧩</span><span class="victory-stat-value">' + this.gridSize + '×' + this.gridSize + '</span><span class="victory-stat-label">المستوى</span></div></div><div class="modal-actions"><button class="modal-primary-btn" id="victoryNextBtn">▶ التالي</button><button class="modal-secondary-btn" id="victoryNewGameBtn">🔄 لعبة جديدة</button><button class="modal-secondary-btn" id="victoryHomeBtn">🏠 القائمة الرئيسية</button></div></div>';
      document.body.appendChild(overlay);
      document.getElementById('victoryNextBtn').onclick = () => { overlay.remove(); this.startNewGame(this.gridSize < 7 ? this.gridSize + 1 : 7); };
      document.getElementById('victoryNewGameBtn').onclick = () => { overlay.remove(); this.startNewGame(this.gridSize); };
      document.getElementById('victoryHomeBtn').onclick = () => { overlay.remove(); this.stopTimer(); this.gameActive = false; this.switchScreen('main'); };
      if (this.pwa) { this.pwa.gamesPlayed++; if (this.pwa.gamesPlayed === 1 && !this.pwa.isStandalone) this.pwa.showInstallAfterEngagement(); }
    }

    handleWin() { this.gameActive = false; this.stopTimer(); this.moveHistory = []; this.updateUndoBtn(); this.saveBestScore(); this.clearSave(); setTimeout(() => this.showVictory(), 300); }

    startNewGame(size) {
      if (this.pwa) this.pwa.closeAllModals();
      this.stopTimer();
      this.gridSize = size;
      this.tiles = this.generatePuzzle(size);
      this.moves = 0; this.timerSeconds = 0; this.moveHistory = []; this.gameActive = true;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = '00:00';
      this.gameLevelLabel.textContent = size + '×' + size;
      this.renderBoard();
      this.switchScreen('game');
      this.startTimer();
      this.saveGame();
      this.updateUndoBtn();
    }

    resumeGame() {
      const s = JSON.parse(localStorage.getItem('drder_puzzle_save'));
      if (!s) return false;
      this.gridSize = s.gridSize; this.tiles = s.tiles; this.emptyIndex = s.emptyIndex;
      this.moves = s.moves; this.timerSeconds = s.timerSeconds; this.moveHistory = s.moveHistory || []; this.gameActive = true;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
      this.gameLevelLabel.textContent = this.gridSize + '×' + this.gridSize;
      this.renderBoard();
      this.switchScreen('game');
      this.startTimer();
      this.updateUndoBtn();
      return true;
    }

    saveGame() {
      if (!this.gameActive) return;
      localStorage.setItem('drder_puzzle_save', JSON.stringify({ gridSize: this.gridSize, tiles: this.tiles, emptyIndex: this.emptyIndex, moves: this.moves, timerSeconds: this.timerSeconds, moveHistory: this.moveHistory }));
      this.updateResumeVisibility();
    }

    clearSave() { localStorage.removeItem('drder_puzzle_save'); this.updateResumeVisibility(); }
    updateResumeVisibility() { this.resumeBtn.style.display = localStorage.getItem('drder_puzzle_save') ? 'block' : 'none'; }

    saveBestScore() {
      const k = 'drder_best_' + this.gridSize;
      const p = JSON.parse(localStorage.getItem(k)) || { moves: Infinity, time: Infinity, wins: 0 };
      localStorage.setItem(k, JSON.stringify({ moves: Math.min(p.moves, this.moves), time: Math.min(p.time, this.timerSeconds), wins: p.wins + 1 }));
    }

    displayBestScores() {
      let h = '';
      [3,4,5,6,7].forEach(s => { const d = JSON.parse(localStorage.getItem('drder_best_' + s)); if (d) h += '<p><strong>' + s + '×' + s + '</strong>: 🏆 ' + d.moves + ' | ⏱️ ' + this.formatTime(d.time) + ' | 🏅 ' + d.wins + '</p>'; });
      this.scoresList.innerHTML = h || 'لا توجد نتائج بعد.';
    }

    init() { this.updateResumeVisibility(); }
  }

  const pwa = new PWAManager();
  const game = new Game();
  game.setPWA(pwa);
  pwa.init();
  game.init();
})();
