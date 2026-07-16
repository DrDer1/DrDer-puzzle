(function() {
  'use strict';

  class PWAManager {
    constructor() {
      this.deferredPrompt = null;
      this.swRegistration = null;
      this.isStandalone = this.checkStandalone();
      this.promptReceived = false;
      this.gamesPlayed = 0;
      this.installShown = false;
    }

    checkStandalone() {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator.standalone === true) return true;
      return false;
    }

    async init() {
      console.log('App mode:', this.isStandalone ? 'Standalone' : 'Browser');

      if ('serviceWorker' in navigator) {
        try {
          this.swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
          console.log('SW registered:', this.swRegistration.scope);
          this.setupUpdateDetection();
        } catch (err) {
          console.warn('SW failed:', err.message);
        }
      }

      this.setupInstallEvents();
      this.updateInstallButton();
      setTimeout(() => this.runDiagnostics(), 3000);
    }

    setupInstallEvents() {
      window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt received');
        e.preventDefault();
        this.deferredPrompt = e;
        this.promptReceived = true;
        this.updateInstallButton();
      });

      window.addEventListener('appinstalled', () => {
        console.log('App installed');
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
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.showUpdateBanner();
          }
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    showUpdateBanner() {
      const existing = document.getElementById('updateBanner');
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.className = 'update-banner';
      banner.id = 'updateBanner';
      banner.innerHTML = '<span>نسخة جديدة متوفرة</span><div style="display:flex;gap:0.5rem;"><button class="update-btn" id="updateNowBtn">تحديث</button><button class="update-later-btn" id="updateLaterBtn">لاحقاً</button></div>';
      document.body.appendChild(banner);

      document.getElementById('updateNowBtn').onclick = () => {
        if (this.swRegistration && this.swRegistration.waiting) {
          this.swRegistration.waiting.postMessage('skipWaiting');
        }
        banner.remove();
      };

      document.getElementById('updateLaterBtn').onclick = () => banner.remove();

      setTimeout(() => {
        const b = document.getElementById('updateBanner');
        if (b) b.remove();
      }, 30000);
    }

    detectPlatform() {
      const ua = navigator.userAgent.toLowerCase();
      if (/android/.test(ua)) {
        if (/samsung/i.test(ua)) return 'samsung';
        if (/edg/i.test(ua)) return 'edge-android';
        if (/chrome/i.test(ua)) return 'android-chrome';
        return 'android-other';
      }
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/macintosh/.test(ua)) return 'mac';
      if (/windows/.test(ua)) return 'windows';
      return 'other';
    }

    getInstallInstructions() {
      const instructions = {
        'android-chrome': { name: 'Chrome Android', steps: 'اضغط على ⋮ ثم "تثبيت التطبيق"' },
        'samsung': { name: 'Samsung Internet', steps: 'اضغط على ☰ ثم "إضافة إلى الشاشة الرئيسية"' },
        'edge-android': { name: 'Edge Android', steps: 'اضغط على ⋯ ثم "إضافة إلى الهاتف"' },
        'android-other': { name: 'Android', steps: 'اختر "إضافة إلى الشاشة الرئيسية" من قائمة المتصفح' },
        'ios': { name: 'iPhone/iPad', steps: 'اضغط على 📤 ثم "Add to Home Screen"' },
        'mac': { name: 'Mac', steps: 'في Chrome اضغط على أيقونة التثبيت في شريط العنوان' },
        'windows': { name: 'Windows', steps: 'في Chrome أو Edge اضغط على أيقونة التثبيت في شريط العنوان' },
        'other': { name: 'جهازك', steps: 'استخدم Chrome واضغط على أيقونة التثبيت في شريط العنوان' }
      };
      return instructions[this.detectPlatform()];
    }

    createModal(content) {
      this.closeAllModals();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'pwaModal';
      overlay.innerHTML = '<div class="modal-dialog">' + content + '</div>';
      document.body.appendChild(overlay);
      return overlay;
    }

    closeAllModals() {
      document.querySelectorAll('.modal-overlay').forEach(function(m) { m.remove(); });
    }

    showInstallPrompt() {
      if (this.isStandalone || this.installShown) return;
      this.installShown = true;

      var self = this;
      var overlay = this.createModal(
        '<div class="modal-icon">📲</div>' +
        '<h3 class="modal-title">تثبيت DrDer Puzzle</h3>' +
        '<p class="modal-subtitle">ثبّت اللعبة على جهازك لتجربة أسرع وبدون إنترنت</p>' +
        '<div class="modal-actions">' +
        '<button class="modal-primary-btn" id="installNowBtn">📲 تثبيت التطبيق</button>' +
        '<button class="modal-secondary-btn" id="installLaterBtn">لاحقاً</button>' +
        '</div>'
      );

      document.getElementById('installNowBtn').onclick = async function() {
        if (self.deferredPrompt) {
          self.deferredPrompt.prompt();
          var result = await self.deferredPrompt.userChoice;
          console.log('Install result:', result.outcome);
          self.deferredPrompt = null;
        }
        overlay.remove();
        self.updateInstallButton();
      };

      document.getElementById('installLaterBtn').onclick = function() {
        overlay.remove();
      };
    }

    showManualInstructions() {
      if (this.isStandalone) return;
      var p = this.getInstallInstructions();
      var overlay = this.createModal(
        '<div class="modal-icon">📱</div>' +
        '<h3 class="modal-title">تثبيت التطبيق</h3>' +
        '<p class="modal-subtitle">' + p.name + '</p>' +
        '<div class="platform-instructions"><div class="platform-name">الخطوات:</div><div>' + p.steps + '</div></div>' +
        '<div class="modal-actions"><button class="modal-secondary-btn" id="manualCloseBtn">حسناً</button></div>'
      );
      document.getElementById('manualCloseBtn').onclick = function() { overlay.remove(); };
    }

    updateInstallButton() {
      var btn = document.getElementById('permanentInstallBtn');
      if (!btn) return;
      if (this.isStandalone) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'block';
        btn.textContent = this.deferredPrompt ? '📲 تثبيت التطبيق' : '📱 تثبيت التطبيق';
      }
    }

    runDiagnostics() {
      console.group('PWA Diagnostic');
      console.log('HTTPS:', (location.protocol === 'https:' || location.hostname === 'localhost') ? 'PASS' : 'FAIL');
      console.log('Standalone:', this.isStandalone ? 'YES' : 'NO');
      console.log('SW:', this.swRegistration ? 'PASS' : 'FAIL');
      console.log('Install Prompt:', this.promptReceived ? 'Received' : 'Not received');

      fetch('./manifest.json').then(function(r) {
        console.log('Manifest:', r.ok ? 'PASS' : 'FAIL');
      }).catch(function() {
        console.log('Manifest: FAIL');
      });

      if (!this.promptReceived && !this.isStandalone) {
        console.log('Install blocked - possible reasons:');
        console.log('1. Already installed');
        console.log('2. User dismissed prompt');
        console.log('3. Need more engagement');
        console.log('4. Invalid manifest or SW');
      }

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
        main: document.getElementById('mainMenu'),
        game: document.getElementById('gameScreen'),
        settings: document.getElementById('settingsScreen'),
        bestScores: document.getElementById('bestScoresScreen'),
        howToPlay: document.getElementById('howToPlayScreen'),
        about: document.getElementById('aboutScreen')
      };
      this.el = function(id) { return document.getElementById(id); };
      this.puzzleBoard = this.el('puzzleBoard');
      this.timerDisplay = this.el('timerDisplay');
      this.movesDisplay = this.el('movesDisplay');
      this.gameLevelLabel = this.el('gameLevelLabel');
      this.resumeBtn = this.el('resumeGameBtn');
      this.undoBtn = this.el('undoBtn');
      this.timerToggle = this.el('timerToggle');
      this.movesToggle = this.el('movesToggle');
      this.scoresList = this.el('scoresList');
      this.permanentInstallBtn = this.el('permanentInstallBtn');
      this.levelButtons = document.querySelectorAll('.level-btn');
    }

    initEvents() {
      var self = this;

      this.el('startGameBtn').onclick = function() {
        self.startNewGame(self.getSelectedLevel());
        if (self.pwa && !self.pwa.installShown && !self.pwa.isStandalone && self.pwa.deferredPrompt) {
          setTimeout(function() { self.pwa.showInstallPrompt(); }, 2000);
        }
      };

      this.el('bestScoresBtn').onclick = function() { self.displayBestScores(); self.switchScreen('bestScores'); };
      this.el('settingsBtn').onclick = function() { self.switchScreen('settings'); };
      this.el('howToPlayBtn').onclick = function() { self.switchScreen('howToPlay'); };
      this.el('aboutBtn').onclick = function() { self.switchScreen('about'); };

      this.el('backToMenuBtn').onclick = function() {
        if (self.pwa) self.pwa.closeAllModals();
        self.stopTimer();
        self.gameActive = false;
        self.switchScreen('main');
      };

      this.el('newGameBtn').onclick = function() { self.startNewGame(self.gridSize); };
      this.el('undoBtn').onclick = function() { self.undoMove(); };

      this.el('deleteScoresBtn').onclick = function() {
        [3,4,5,6,7].forEach(function(s) { localStorage.removeItem('drder_best_' + s); });
        alert('تم حذف جميع النتائج.');
      };

      this.resumeBtn.onclick = function() {
        if (!self.resumeGame()) alert('لا توجد لعبة محفوظة.');
      };

      this.permanentInstallBtn.onclick = function() {
        if (self.pwa) {
          if (self.pwa.deferredPrompt) {
            self.pwa.showInstallPrompt();
          } else {
            self.pwa.showManualInstructions();
          }
        }
      };

      this.timerToggle.onclick = function() {
        self.timerToggle.classList.toggle('active');
        self.timerEnabled = self.timerToggle.classList.contains('active');
        if (self.gameActive) {
          self.stopTimer();
          if (self.timerEnabled) self.startTimer();
        }
      };

      this.movesToggle.onclick = function() {
        self.movesToggle.classList.toggle('active');
        self.movesCounterEnabled = self.movesToggle.classList.contains('active');
        self.updateMovesDisplay();
      };

      this.levelButtons.forEach(function(b) {
        b.onclick = function() {
          self.levelButtons.forEach(function(x) { x.classList.remove('active'); });
          b.classList.add('active');
        };
      });

      ['backFromSettingsBtn','backFromScoresBtn','backFromHowToPlayBtn','backFromAboutBtn'].forEach(function(id) {
        self.el(id).onclick = function() { self.switchScreen('main'); };
      });

      window.addEventListener('keydown', function(e) {
        if (self.currentScreen !== 'game' || !self.gameActive) return;
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); self.undoMove(); return; }
        var key = e.key;
        var size = self.gridSize;
        var target = self.emptyIndex;
        if (key === 'ArrowRight') target = self.emptyIndex + 1;
        else if (key === 'ArrowLeft') target = self.emptyIndex - 1;
        else if (key === 'ArrowUp') target = self.emptyIndex - size;
        else if (key === 'ArrowDown') target = self.emptyIndex + size;
        else return;
        e.preventDefault();
        if (target >= 0 && target < size * size && self.tiles[target] !== 0) {
          var er = Math.floor(self.emptyIndex / size);
          var tr = Math.floor(target / size);
          var ec = self.emptyIndex % size;
          var tc = target % size;
          if (Math.abs(er - tr) + Math.abs(ec - tc) === 1) {
            self.moveTile(target);
          }
        }
      });
    }

    setPWA(pwa) { this.pwa = pwa; }

    switchScreen(id) {
      var self = this;
      Object.values(this.screens).forEach(function(s) { s.classList.add('hidden'); });
      this.screens[id].classList.remove('hidden');
      this.currentScreen = id;
      if (id === 'main') this.updateResumeVisibility();
    }

    getSelectedLevel() {
      var active = document.querySelector('.level-btn.active');
      return active ? parseInt(active.dataset.size) : 4;
    }

    formatTime(sec) {
      var m = Math.floor(sec / 60).toString().padStart(2, '0');
      var s = (sec % 60).toString().padStart(2, '0');
      return m + ':' + s;
    }

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    startTimer() {
      if (!this.timerEnabled || !this.gameActive) return;
      this.stopTimer();
      var self = this;
      this.timerInterval = setInterval(function() {
        self.timerSeconds++;
        self.timerDisplay.textContent = self.formatTime(self.timerSeconds);
        self.saveGame();
      }, 1000);
    }

    updateMovesDisplay() {
      this.movesDisplay.textContent = this.movesCounterEnabled ? this.moves : '--';
    }

    countInversions(arr) {
      var inv = 0;
      for (var i = 0; i < arr.length; i++) {
        for (var j = i + 1; j < arr.length; j++) {
          if (arr[i] && arr[j] && arr[i] > arr[j]) inv++;
        }
      }
      return inv;
    }

    isSolvable(tileArray, size, emptyIdx) {
      var inv = this.countInversions(tileArray);
      if (size % 2 === 1) return inv % 2 === 0;
      var emptyRowFromBottom = size - Math.floor(emptyIdx / size);
      return (inv % 2 === 0) === (emptyRowFromBottom % 2 === 1);
    }

    generatePuzzle(size) {
      var total = size * size;
      var arr = Array.from({ length: total - 1 }, function(_, i) { return i + 1; });
      arr.push(0);
      var emptyIdx;
      do {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = arr[i];
          arr[i] = arr[j];
          arr[j] = temp;
        }
        emptyIdx = arr.indexOf(0);
      } while (!this.isSolvable(arr, size, emptyIdx));
      this.emptyIndex = emptyIdx;
      return arr;
    }

    renderBoard() {
      this.puzzleBoard.innerHTML = '';
      this.puzzleBoard.style.gridTemplateColumns = 'repeat(' + this.gridSize + ', 1fr)';
      var self = this;
      this.tiles.forEach(function(value, index) {
        var tileDiv = document.createElement('div');
        tileDiv.className = 'tile' + (value === 0 ? ' empty' : '');
        if (value !== 0) {
          tileDiv.textContent = value;
          tileDiv.addEventListener('click', function() { self.handleTileClick(index); });
          tileDiv.addEventListener('touchstart', function(e) { e.preventDefault(); self.handleTileClick(index); });
        }
        self.puzzleBoard.appendChild(tileDiv);
      });
    }

    getAdjacentIndices(index) {
      var size = this.gridSize;
      var row = Math.floor(index / size);
      var col = index % size;
      var adj = [];
      if (row > 0) adj.push(index - size);
      if (row < size - 1) adj.push(index + size);
      if (col > 0) adj.push(index - 1);
      if (col < size - 1) adj.push(index + 1);
      return adj;
    }

    moveTile(tileIndex, recordHistory) {
      if (recordHistory === undefined) recordHistory = true;
      if (!this.gameActive) return false;
      if (!this.getAdjacentIndices(this.emptyIndex).includes(tileIndex)) return false;

      if (recordHistory) {
        this.moveHistory.push({
          tileIndex: tileIndex,
          emptyIndex: this.emptyIndex,
          moves: this.moves,
          timerSeconds: this.timerSeconds,
          tiles: this.tiles.slice()
        });
      }

      var temp = this.tiles[this.emptyIndex];
      this.tiles[this.emptyIndex] = this.tiles[tileIndex];
      this.tiles[tileIndex] = temp;
      this.emptyIndex = tileIndex;
      this.moves++;
      this.updateMovesDisplay();
      this.renderBoard();
      this.saveGame();
      this.updateUndoButton();

      if (this.checkWin()) {
        this.handleWin();
      }
      return true;
    }

    handleTileClick(index) {
      if (this.tiles[index] !== 0) this.moveTile(index);
    }

    undoMove() {
      if (!this.gameActive || !this.moveHistory.length) return;
      var last = this.moveHistory.pop();
      this.tiles = last.tiles.slice();
      this.emptyIndex = last.emptyIndex;
      this.moves = last.moves;
      this.timerSeconds = last.timerSeconds;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
      this.renderBoard();
      this.saveGame();
      this.updateUndoButton();
    }

    updateUndoButton() {
      if (this.undoBtn) {
        this.undoBtn.disabled = !this.gameActive || !this.moveHistory.length;
      }
    }

    checkWin() {
      var size = this.gridSize;
      for (var i = 0; i < size * size - 1; i++) {
        if (this.tiles[i] !== i + 1) return false;
      }
      return this.tiles[size * size - 1] === 0;
    }

    showVictoryModal() {
      if (this.pwa) this.pwa.closeAllModals();

      var self = this;
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'victoryOverlay';
      overlay.innerHTML =
        '<div class="modal-dialog victory-modal">' +
        '<div class="victory-icon">🏆</div>' +
        '<h2 class="victory-title">تهانينا!</h2>' +
        '<p class="modal-subtitle">لقد قمت بحل اللغز بنجاح</p>' +
        '<div class="victory-stats">' +
        '<div class="victory-stat"><span class="victory-stat-icon">⏱️</span><span class="victory-stat-value">' + this.formatTime(this.timerSeconds) + '</span><span class="victory-stat-label">الوقت</span></div>' +
        '<div class="victory-stat-divider"></div>' +
        '<div class="victory-stat"><span class="victory-stat-icon">👆</span><span class="victory-stat-value">' + this.moves + '</span><span class="victory-stat-label">حركة</span></div>' +
        '<div class="victory-stat-divider"></div>' +
        '<div class="victory-stat"><span class="victory-stat-icon">🧩</span><span class="victory-stat-value">' + this.gridSize + '×' + this.gridSize + '</span><span class="victory-stat-label">المستوى</span></div>' +
        '</div>' +
        '<div class="modal-actions">' +
        '<button class="modal-primary-btn" id="victoryNextBtn">▶ التالي</button>' +
        '<button class="modal-secondary-btn" id="victoryNewGameBtn">🔄 لعبة جديدة</button>' +
        '<button class="modal-secondary-btn" id="victoryHomeBtn">🏠 القائمة الرئيسية</button>' +
        '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      document.getElementById('victoryNextBtn').onclick = function() {
        overlay.remove();
        self.startNewGame(self.gridSize < 7 ? self.gridSize + 1 : 7);
      };

      document.getElementById('victoryNewGameBtn').onclick = function() {
        overlay.remove();
        self.startNewGame(self.gridSize);
      };

      document.getElementById('victoryHomeBtn').onclick = function() {
        overlay.remove();
        self.stopTimer();
        self.gameActive = false;
        self.switchScreen('main');
      };
    }

    handleWin() {
      this.gameActive = false;
      this.stopTimer();
      this.moveHistory = [];
      this.updateUndoButton();
      this.saveBestScore();
      this.clearSave();

      var self = this;
      setTimeout(function() { self.showVictoryModal(); }, 400);

      if (this.pwa) {
        this.pwa.gamesPlayed++;
        if (!this.pwa.isStandalone && !this.pwa.installShown && this.pwa.gamesPlayed >= 1) {
          setTimeout(function() {
            if (self.pwa.deferredPrompt) {
              self.pwa.showInstallPrompt();
            }
          }, 3000);
        }
      }
    }

    startNewGame(size) {
      if (this.pwa) this.pwa.closeAllModals();
      this.stopTimer();
      this.gridSize = size;
      this.tiles = this.generatePuzzle(size);
      this.moves = 0;
      this.timerSeconds = 0;
      this.moveHistory = [];
      this.gameActive = true;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = '00:00';
      this.gameLevelLabel.textContent = size + '×' + size;
      this.renderBoard();
      this.switchScreen('game');
      this.startTimer();
      this.saveGame();
      this.updateUndoButton();
    }

    resumeGame() {
      var saved = JSON.parse(localStorage.getItem('drder_puzzle_save'));
      if (!saved) return false;
      this.gridSize = saved.gridSize;
      this.tiles = saved.tiles;
      this.emptyIndex = saved.emptyIndex;
      this.moves = saved.moves;
      this.timerSeconds = saved.timerSeconds;
      this.moveHistory = saved.moveHistory || [];
      this.gameActive = true;
      this.updateMovesDisplay();
      this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
      this.gameLevelLabel.textContent = this.gridSize + '×' + this.gridSize;
      this.renderBoard();
      this.switchScreen('game');
      this.startTimer();
      this.updateUndoButton();
      return true;
    }

    saveGame() {
      if (!this.gameActive) return;
      localStorage.setItem('drder_puzzle_save', JSON.stringify({
        gridSize: this.gridSize,
        tiles: this.tiles,
        emptyIndex: this.emptyIndex,
        moves: this.moves,
        timerSeconds: this.timerSeconds,
        moveHistory: this.moveHistory
      }));
      this.updateResumeVisibility();
    }

    clearSave() {
      localStorage.removeItem('drder_puzzle_save');
      this.updateResumeVisibility();
    }

    updateResumeVisibility() {
      this.resumeBtn.style.display = localStorage.getItem('drder_puzzle_save') ? 'block' : 'none';
    }

    saveBestScore() {
      var key = 'drder_best_' + this.gridSize;
      var prev = JSON.parse(localStorage.getItem(key)) || { moves: Infinity, time: Infinity, wins: 0 };
      localStorage.setItem(key, JSON.stringify({
        moves: Math.min(prev.moves, this.moves),
        time: Math.min(prev.time, this.timerSeconds),
        wins: prev.wins + 1
      }));
    }

    displayBestScores() {
      var self = this;
      var html = '';
      [3, 4, 5, 6, 7].forEach(function(size) {
        var d = JSON.parse(localStorage.getItem('drder_best_' + size));
        if (d) {
          html += '<p><strong>' + size + '×' + size + '</strong>: 🏆 ' + d.moves + ' | ⏱️ ' + self.formatTime(d.time) + ' | 🏅 ' + d.wins + '</p>';
        }
      });
      this.scoresList.innerHTML = html || 'لا توجد نتائج بعد.';
    }

    init() {
      this.updateResumeVisibility();
    }
  }

  var pwa = new PWAManager();
  var game = new Game();
  game.setPWA(pwa);

  pwa.init();
  game.init();

  console.log('DrDer Puzzle 1 - Ready');
})();
