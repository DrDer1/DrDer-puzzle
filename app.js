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
        this.levelButtons.forEach(x => x.classList.remove
