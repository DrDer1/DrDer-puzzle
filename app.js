/**
 * DrDer Puzzle 1 - تطبيق PWA احترافي
 * جميع الحقوق محفوظة © DrDer
 */

(function() {
  'use strict';

  // ==================== مدير PWA ====================
  class PWAManager {
    constructor() {
      this.deferredPrompt = null;
      this.swRegistration = null;
      this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      this.promptReceived = false;
      this.gamesPlayed = 0;
    }

    async init() {
      console.log('📱 App mode:', this.isStandalone ? 'Standalone' : 'Browser');

      if ('serviceWorker' in navigator) {
        try {
          this.swRegistration = await navigator.serviceWorker.register('./sw.js');
          console.log('✅ SW registered:', this.swRegistration.scope);
          this.setupUpdateDetection();
        } catch (err) {
          console.warn('❌ SW registration failed:', err);
        }
      }

      this.setupInstallEvents();
      this.updateInstallButton();
      
      setTimeout(() => this.runDiagnostics(), 3000);
    }

    setupInstallEvents() {
      window.addEventListener('beforeinstallprompt', (e) => {
        console.log('🎯 beforeinstallprompt received!');
        e.preventDefault();
        this.deferredPrompt = e;
        this.promptReceived = true;
        this.updateInstallButton();
      });

      window.addEventListener('appinstalled', () => {
        console.log('✅ App installed!');
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
      banner.innerHTML = `
        <span>🔄 يتوفر إصدار جديد!</span>
        <button class="update-btn" id="updateNowBtn">تحديث الآن</button>
        <button class="modal-secondary-btn" id="updateLaterBtn" style="padding:0.5rem 1rem;font-size:0.9rem;">لاحقاً</button>
      `;
      document.body.appendChild(banner);

      document.getElementById('updateNowBtn').onclick = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage('skipWaiting');
        }
        window.location.reload();
      };

      document.getElementById('updateLaterBtn').onclick = () => banner.remove();
    }

    detectPlatform() {
      const ua = navigator.userAgent.toLowerCase();
      if (/android/.test(ua)) {
        if (/samsung/i.test(ua)) return 'samsung';
        if (/edg/i.test(ua)) return 'edge-android';
        return 'android-chrome';
      }
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/macintosh/.test(ua)) return 'mac';
      if (/windows/.test(ua)) return 'windows';
      return 'other';
    }

    getPlatformInstructions() {
      const instructions = {
        'android-chrome': { name: 'Chrome على Android', steps: 'اضغط على ⋮ ثم "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"' },
        'samsung': { name: 'Samsung Internet', steps: 'اضغط على ☰ ثم "إضافة إلى الشاشة الرئيسية"' },
        'edge-android': { name: 'Edge على Android', steps: 'اضغط على ⋯ ثم "إضافة إلى الهاتف"' },
        'ios': { name: 'Safari على iPhone/iPad', steps: 'اضغط على 📤 ثم "Add to Home Screen"' },
        'mac': { name: 'Mac', steps: 'استخدم Chrome/Edge واضغط على أيقونة التثبيت ⬇️ في شريط العنوان' },
        'windows': { name: 'Windows', steps: 'استخدم Chrome/Edge واضغط على أيقونة التثبيت ⬇️ في شريط العنوان' },
        'other': { name: 'جهازك', steps: 'استخدم Chrome/Edge واضغط على أيقونة التثبيت في شريط العنوان' }
      };
      return instructions[this.detectPlatform()];
    }

    createModal({ icon, title, subtitle, buttons, extraContent = '', className = '' }) {
      this.closeAllModals();

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'pwaModal';

      const buttonsHTML = buttons.map((btn, i) => {
        const cls = i === 0 ? 'modal-primary-btn' : 'modal-secondary-btn';
        return `<button class="${cls}" id="${btn.id}">${btn.text}</button>`;
      }).join('');

      overlay.innerHTML = `
        <div class="modal-dialog ${className}">
          ${icon ? `<div class="modal-icon">${icon}</div>` : ''}
          ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
          ${subtitle ? `<p class="modal-subtitle">${subtitle}</p>` : ''}
          ${extraContent}
          <div class="modal-actions">${buttonsHTML}</div>
        </div>
      `;

      document.body.appendChild(overlay);

      buttons.forEach(btn => {
        const el = document.getElementById(btn.id);
        if (el) {
          el.onclick = () => {
            if (btn.onClick) btn.onClick();
            this.closeAllModals();
          };
        }
      });

      setTimeout(() => this.closeAllModals(), 60000);
    }

    closeAllModals() {
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    }

    showInstallPrompt() {
      if (this.isStandalone) return;

      this.createModal({
        icon: '📲',
        title: 'تثبيت DrDer Puzzle 1',
        subtitle: 'ثبّت التطبيق لتجربة أسرع والوصول دون اتصال بالإنترنت',
        buttons: [
          { id: 'installNowBtn', text: '📲 تثبيت التطبيق', onClick: () => this.triggerInstall() },
          { id: 'installLaterBtn', text: 'لاحقاً' }
        ]
      });
    }

    showManualInstructions() {
      const platform = this.getPlatformInstructions();
      this.createModal({
        icon: '📱',
        title: 'تثبيت التطبيق',
        subtitle: `اتبع الخطوات (${platform.name}):`,
        extraContent: `<div class="platform-instructions"><div class="platform-name">${platform.name}:</div><div>${platform.steps}</div></div>`,
        buttons: [{ id: 'manualCloseBtn', text: 'حسناً' }]
      });
    }

    async triggerInstall() {
      if (this.deferredPrompt) {
        try {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          console.log(`📋 Install outcome: ${outcome}`);
          this.deferredPrompt = null;
          this.updateInstallButton();
        } catch (err) {
          console.warn('Install failed:', err);
          this.showManualInstructions();
        }
      } else {
        this.showManualInstructions();
      }
    }

    updateInstallButton() {
      const btn = document.getElementById('permanentInstallBtn');
      if (!btn) return;

      if (this.isStandalone) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'block';
        btn.textContent = this.deferredPrompt ? '📲 تثبيت التطبيق' : '📱 كيفية التثبيت';
      }
    }

    runDiagnostics() {
      console.group('🔍 PWA Diagnostic - DrDer Puzzle 1');
      console.log('🌐 URL:', window.location.href);
      console.log('🔒 HTTPS:', window.location.protocol === 'https:' || window.location.hostname === 'localhost' ? '✅' : '❌');
      console.log('📱 Standalone:', this.isStandalone ? '✅ Yes' : '❌ No (Browser mode)');
      console.log('🎯 beforeinstallprompt:', this.promptReceived ? '✅ Received' : '❌ Not received');
      console.log('💾 SW:', this.swRegistration ? '✅ Registered' : '❌ Not registered');

      if (!this.promptReceived && !this.isStandalone) {
        console.log('💡 Installation may be unavailable because:');
        console.log('  1. App may already be installed');
        console.log('  2. User previously dismissed prompt');
        console.log('  3. Not enough user engagement');
        console.log('  4. Browser doesn\'t support installation');
      }

      fetch('./manifest.json')
        .then(r => r.json())
        .then(data => {
          console.log('📋 Manifest:', data.name, '- icons:', data.icons?.length || 0);
        })
        .catch(() => console.log('❌ Manifest load failed'));

      console.groupEnd();
    }
  }

  // ==================== اللعبة ====================
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
        main: document.getElementById('mainMenu'),
        game: document.getElementById('gameScreen'),
        settings: document.getElementById('settingsScreen'),
        bestScores: document.getElementById('bestScoresScreen'),
        howToPlay: document.getElementById('howToPlayScreen'),
        about: document.getElementById('aboutScreen'),
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
      this.$('startGameBtn').onclick = () => this.startNewGame(this.getSelectedLevel());
      this.$('bestScoresBtn').onclick = () => { this.displayBestScores(); this.switchScreen('bestScores'); };
      this.$('settingsBtn').onclick = () => this.switchScreen('settings');
      this.$('howToPlayBtn').onclick = () => this.switchScreen('howToPlay');
      this.$('aboutBtn').onclick = () => this.switchScreen('about');
      this.$('backToMenuBtn').onclick = () => { this.pwa.closeAllModals(); this.stopTimer(); this.gameActive = false; this.switchScreen('main'); };
      this.$('newGameBtn').onclick = () => this.startNewGame(this.gridSize);
      this.$('undoBtn').onclick = () => this.undoMove();
      this.$('deleteScoresBtn').onclick = () => { [3,4,5,6,7].forEach(s => localStorage.removeItem(`drder_best_${s}`)); alert('تم حذف أفضل النتائج.'); };
      this.resumeBtn.onclick = () => { if (!this.resumeGame()) alert('لا توجد لعبة محفوظة.'); };
      this.permanentInstallBtn.onclick = () => {
        if (this.pwa.deferredPrompt) this.pwa.showInstallPrompt();
        else this.pwa.showManualInstructions();
      };

      this.timerToggle.onclick = () => {
        this.timerToggle.classList.toggle('active');
        this.timerEnabled = this.timerToggle.classList.contains('active');
        if (this.gameActive) { this.stopTimer(); if (this.timerEnabled) this.startTimer(); }
      };

      this.movesToggle.onclick = () => {
        this.movesToggle.classList.toggle('active');
        this.movesCounterEnabled = this.movesToggle.classList.contains('active');
        this.updateMovesDisplay();
      };

      this.levelButtons.forEach(b => b.onclick = () => {
        this.levelButtons.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });

      ['backFromSettingsBtn','backFromScoresBtn','backFromHowToPlayBtn','backFromAboutBtn'].forEach(id => {
        this.$(id).onclick = () => this.switchScreen('main');
      });

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
          const er = Math.floor(this.emptyIndex/size), tr = Math.floor(target/size);
          const ec = this.emptyIndex%size, tc = target%size;
          if (Math.abs(er-tr) + Math.abs(ec-tc) === 1) this.moveTile(target);
        }
      });
    }

    setPWA(pwa) { this.pwa = pwa; }

    switchScreen(id) {
      Object.values(this.screens).forEach(s => s.classList.add('hidden'));
      this.screens[id].classList.remove('hidden');
      this.currentScreen = id;
      if (id === 'main') this.updateResumeVisibility();
    }

    getSelectedLevel() {
      const active = document.querySelector('.level-btn.active');
      return active ? parseInt(active.dataset.size) : 4;
    }

    formatTime(sec) {
      return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;
    }

    stopTimer() { if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; } }

    startTimer() {
      if (!this.timerEnabled || !this.gameActive) return;
      this.stopTimer();
      this.timerInterval = setInterval(() => {
        this.timerSeconds++;
        this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
        this.saveGame();
      }, 1000);
    }

    updateMovesDisplay() { this.movesDisplay.textContent = this.movesCounterEnabled ? this.moves : '--'; }

    countInversions(arr) {
      let inv = 0;
      for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++)
          if (arr[i] && arr[j] && arr[i] > arr[j]) inv++;
      return inv;
    }

    isSolvable(arr, size, emptyIdx) {
      const inv = this.countInversions(arr);
      if (size % 2 === 1) return inv % 2 === 0;
      const rowFromBottom = size - Math.floor(emptyIdx / size);
      return (inv % 2 === 0) === (rowFromBottom % 2 === 1);
    }

    generatePuzzle(size) {
      const total = size * size;
      const arr = Array.from({ length: total - 1 }, (_, i) => i + 1);
      arr.push(0);
      let emptyIdx;
      do {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        emptyIdx = arr.indexOf(0);
      } while (!this.isSolvable(arr, size, emptyIdx));
      this.emptyIndex = emptyIdx;
      return arr;
    }

    renderBoard() {
      this.puzzleBoard.innerHTML = '';
      this.puzzleBoard.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;
      this.tiles.forEach((val, i) => {
        const div = document.createElement('div');
        div.className = 'tile' + (val === 0 ? ' empty' : '');
        if (val !== 0) {
          div.textContent = val;
          div.onclick = () => this.handleClick(i);
          div.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleClick(i); });
        }
        this.puzzleBoard.appendChild(div);
      });
    }

    getAdjacent(i) {
      const s = this.gridSize, r = Math.floor(i/s), c = i%s, adj = [];
      if (r > 0) adj.push(i-s);
      if (r < s-1) adj.push(i+s);
      if (c > 0) adj.push(i-1);
      if (c < s-1) adj.push(i+1);
      return adj;
    }

    moveTile(i, record = true) {
      if (!this.gameActive || !this.getAdjacent(this.emptyIndex).includes(i)) return false;
      if (record) this.moveHistory.push({ tileIndex: i, emptyIndex: this.emptyIndex, moves: this.moves, timerSeconds: this.timerSeconds, tiles: [...this.tiles] });
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
      const last = this.moveHistory.pop();
      this.tiles = [...last.tiles];
      this.emptyIndex = last.emptyIndex;
      this.moves = last.moves;
      this.timerSeconds = last.timerSeconds;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
      this.renderBoard();
      this.saveGame();
      this.updateUndoBtn();
    }

    updateUndoBtn() { if (this.undoBtn) this.undoBtn.disabled = !this.gameActive || !this.moveHistory.length; }

    checkWin() {
      for (let i = 0; i < this.gridSize * this.gridSize - 1; i++)
        if (this.tiles[i] !== i + 1) return false;
      return this.tiles[this.gridSize * this.gridSize - 1] === 0;
    }

    showVictory() {
      this.pwa.closeAllModals();

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'victoryOverlay';
      overlay.innerHTML = `
        <div class="modal-dialog victory-modal">
          <div class="victory-icon">🏆</div>
          <h2 class="victory-title">تهانينا!</h2>
          <p class="modal-subtitle">لقد قمت بحل اللغز بنجاح</p>
          <div class="victory-stats">
            <div class="victory-stat"><span class="victory-stat-icon">⏱️</span><span class="victory-stat-value">${this.formatTime(this.timerSeconds)}</span><span class="victory-stat-label">الوقت</span></div>
            <div class="victory-stat-divider"></div>
            <div class="victory-stat"><span class="victory-stat-icon">👆</span><span class="victory-stat-value">${this.moves}</span><span class="victory-stat-label">حركة</span></div>
            <div class="victory-stat-divider"></div>
            <div class="victory-stat"><span class="victory-stat-icon">🧩</span><span class="victory-stat-value">${this.gridSize}×${this.gridSize}</span><span class="victory-stat-label">المستوى</span></div>
          </div>
          <div class="modal-actions">
            <button class="modal-primary-btn" id="victoryNextBtn">▶ التالي</button>
            <button class="modal-secondary-btn" id="victoryNewGameBtn">🔄 لعبة جديدة</button>
            <button class="modal-secondary-btn" id="victoryHomeBtn">🏠 القائمة الرئيسية</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('victoryNextBtn').onclick = () => { overlay.remove(); this.startNewGame(this.gridSize < 7 ? this.gridSize + 1 : 7); };
      document.getElementById('victoryNewGameBtn').onclick = () => { overlay.remove(); this.startNewGame(this.gridSize); };
      document.getElementById('victoryHomeBtn').onclick = () => { overlay.remove(); this.stopTimer(); this.gameActive = false; this.switchScreen('main'); };

      this.pwa.gamesPlayed++;
      if (this.pwa.gamesPlayed === 1 && !this.pwa.isStandalone && this.pwa.deferredPrompt) {
        setTimeout(() => this.pwa.showInstallPrompt(), 2000);
      }
    }

    handleWin() {
      this.gameActive = false;
      this.stopTimer();
      this.moveHistory = [];
      this.updateUndoBtn();
      this.saveBestScore();
      this.clearSave();
      setTimeout(() => this.showVictory(), 300);
    }

    startNewGame(size) {
      this.pwa.closeAllModals();
      this.stopTimer();
      this.gridSize = size;
      this.tiles = this.generatePuzzle(size);
      this.moves = 0; this.timerSeconds = 0; this.moveHistory = []; this.gameActive = true;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = '00:00';
      this.gameLevelLabel.textContent = `${size}×${size}`;
      this.renderBoard();
      this.switchScreen('game');
      this.startTimer();
      this.saveGame();
      this.updateUndoBtn();
    }

    resumeGame() {
      const saved = JSON.parse(localStorage.getItem('drder_puzzle_save'));
      if (!saved) return false;
      this.gridSize = saved.gridSize; this.tiles = saved.tiles; this.emptyIndex = saved.emptyIndex;
      this.moves = saved.moves; this.timerSeconds = saved.timerSeconds;
      this.moveHistory = saved.moveHistory || []; this.gameActive = true;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
      this.gameLevelLabel.textContent = `${this.gridSize}×${this.gridSize}`;
      this.renderBoard();
      this.switchScreen('game');
      this.startTimer();
      this.updateUndoBtn();
      return true;
    }

    saveGame() {
      if (!this.gameActive) return;
      localStorage.setItem('drder_puzzle_save', JSON.stringify({
        gridSize: this.gridSize, tiles: this.tiles, emptyIndex: this.emptyIndex,
        moves: this.moves, timerSeconds: this.timerSeconds, moveHistory: this.moveHistory
      }));
      this.updateResumeVisibility();
    }

    clearSave() { localStorage.removeItem('drder_puzzle_save'); this.updateResumeVisibility(); }

    updateResumeVisibility() { this.resumeBtn.style.display = localStorage.getItem('drder_puzzle_save') ? 'block' : 'none'; }

    saveBestScore() {
      const key = `drder_best_${this.gridSize}`;
      const prev = JSON.parse(localStorage.getItem(key)) || { moves: Infinity, time: Infinity, wins: 0 };
      localStorage.setItem(key, JSON.stringify({
        moves: Math.min(prev.moves, this.moves),
        time: Math.min(prev.time, this.timerSeconds),
        wins: prev.wins + 1
      }));
    }

    displayBestScores() {
      let html = '';
      [3,4,5,6,7].forEach(size => {
        const d = JSON.parse(localStorage.getItem(`drder_best_${size}`));
        if (d) html += `<p><strong>${size}×${size}</strong>: 🏆 ${d.moves} | ⏱️ ${this.formatTime(d.time)} | 🏅 ${d.wins}</p>`;
      });
      this.scoresList.innerHTML = html || 'لا توجد نتائج بعد.';
    }

    init() {
      this.updateResumeVisibility();
    }
  }

  // ==================== بدء التطبيق ====================
  const pwa = new PWAManager();
  const game = new Game();
  game.setPWA(pwa);
  
  pwa.init();
  game.init();
})();
