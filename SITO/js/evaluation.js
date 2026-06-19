// =============================================================
// SITOSS — evaluation.js
// NODEBETAV1.0.0
// =============================================================

(function () {
  'use strict';

  // -----------------------------------------------------------
  // CONFIGURATION
  // -----------------------------------------------------------
  const API_URL = "https://script.google.com/macros/s/AKfycbzqvVJ7mJhJz2ZemAxTl1puBVvivAQ1Ld0ogGIL7_9gdhd9e5dCsugLXGQ3htqNe7z9Gw/exec";

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SITOSS_GLOSSARY = "ASSET: Elementi visivi finali (3D, Cinematic, Prototyping). Non sono bozzetti. BRIEF: Protocollo tecnico vincolante. REVISIONI: Ricalibrazioni entro il 10% del volume originale. BUDGET TIER 1 (< 600€): Solo micro-asset, richiede saldo anticipato 100%. BUDGET TIER 2 (600€ - 1k): Visual Identity base e 3D Essentials. BUDGET TIER 3 (1k - 5k): Prototipazione avanzata e architetture Full OS. BUDGET TIER 4 (5k - 10k): Sistemi complessi e High-end Motion Design. BUDGET TIER 5 (> 10k): Enterprise Visual Engineering ad alta densità.";

  // -----------------------------------------------------------
  // SECURITY CONFIGURATION (MOD D)
  // -----------------------------------------------------------
  const MAX_PAYLOAD_MB = 50;
  const MAX_PAYLOAD_BYTES = MAX_PAYLOAD_MB * 1024 * 1024;
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const SVG_GRANTED = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke-width="1.5"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>';
  const SVG_DENIED = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke-width="1.5"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>';

  // -----------------------------------------------------------
  // STATE
  // -----------------------------------------------------------
  let currentStep = 0;
  let LeadData = {};
  let otpErrorCount = 0;
  let linkErrorCount = 0;
  let isBotTyping = false;
  let inputLocked = false;
  let pendingFiles = [];
  let isOracleLocked = false;
  let isEvaluationComplete = false;
  let sysChatTranscript = []; // MODULO 3: log cronologico dell'intera sessione

  // ID univoco di sessione per la Black Box — generato al boot
  const EVAL_SESSION_ID = 'EVAL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();

  /**
   * Logger fire-and-forget verso il backend LOG_SYSTEM.
   * Non blocca mai il flusso — non usa await, ignora errori di rete.
   * @param {string} eventCode - Codice evento standardizzato
   * @param {string} detail    - Messaggio testuale
   * @param {object} [ctx]     - Contesto aggiuntivo (step, email, ecc.)
   */
  function evalLog(eventCode, detail, ctx) {
    try {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'LOG_SYSTEM_EVENT',
          eventCode: eventCode,
          detail: String(detail || '').substring(0, 300),
          context: JSON.stringify(Object.assign({ step: currentStep, email: LeadData.clientEmail || '' }, ctx || '')).substring(0, 300),
          sessionId: EVAL_SESSION_ID
        })
      }).catch(function() {}); // Fire and forget
    } catch(e) {}
  }

  // -----------------------------------------------------------
  // DOM REFERENCES
  // -----------------------------------------------------------
  const canvas = document.getElementById('sys-chat-canvas');
  const input = document.getElementById('sys-chat-input');
  const sendBtn = document.getElementById('sys-chat-send');
  const accessBar = document.getElementById('sys-access-bar');
  const statusText = document.getElementById('sys-status-text');
  const ghost = canvas ? canvas.querySelector('.sys-ghost-state') : null;

  let uploadBtn = document.getElementById('sys-chat-upload-btn');
  if (!uploadBtn) {
    uploadBtn = document.createElement('button');
    uploadBtn.id = 'sys-chat-upload-btn';
    uploadBtn.className = 'sys-chat-upload-btn';
    uploadBtn.setAttribute('aria-label', 'Allega file');
    uploadBtn.style.display = 'none';
    uploadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const wrapper = document.querySelector('.sys-chat-input-wrapper');
    if (wrapper) wrapper.insertBefore(uploadBtn, input);
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.pdf,.txt,.doc,.docx,.png,.jpg,.jpeg';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  const stagingArea = document.createElement('div');
  stagingArea.className = 'sys-file-staging';
  const inputWrapper = document.querySelector('.sys-chat-input-wrapper');
  if (inputWrapper) inputWrapper.insertBefore(stagingArea, inputWrapper.firstChild);

  const banOverlay = document.createElement('div');
  banOverlay.id = 'sys-ban-overlay';
  banOverlay.style.cssText = `display: none; position: fixed; inset: 0; background: rgba(180, 20, 20, 0.15); backdrop-filter: blur(6px); z-index: 9999; flex-direction: column; align-items: center; justify-content: center; font-family: 'Courier New', monospace; color: #ff4444; text-align: center; padding: 2rem;`;
  banOverlay.innerHTML = `<div style="font-size:clamp(1rem,3vw,1.5rem); letter-spacing:0.2em; margin-bottom:1.5rem; text-transform:uppercase;">[ACCESS DENIED: INSUFFICIENT REQUIREMENTS]</div><div id="ban-reason-text" style="font-size:clamp(0.75rem,2vw,1rem); opacity:0.7; max-width:600px; margin-bottom:2rem; line-height:1.6;"></div><div style="font-size:clamp(1.5rem,4vw,2.5rem); font-weight:700;" id="ban-countdown">15</div><div style="font-size:0.75rem; opacity:0.5; margin-top:0.5rem;">REDIRECTING...</div>`;
  document.body.appendChild(banOverlay);

  // -----------------------------------------------------------
  // [NEW] TERMINAL MODAL FINAL V3 - DOM INIT
  // -----------------------------------------------------------
  const finalModalBackdrop = document.createElement('div');
  finalModalBackdrop.className = 'sys-modal-backdrop';
  finalModalBackdrop.id = 'sys-final-modal-backdrop';

  const finalModal = document.createElement('div');
  finalModal.className = 'sys-final-modal';
  finalModal.id = 'sys-final-modal';

  const iconContainer = document.createElement('div');
  iconContainer.id = 'sys-modal-icon-container';
  finalModal.appendChild(iconContainer);

  finalModalBackdrop.appendChild(finalModal);
  document.body.appendChild(finalModalBackdrop);


  // -----------------------------------------------------------
  // ORACLE SUB-TERMINAL DOM
  // -----------------------------------------------------------
  const SVG_CHAT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  const SVG_CLOSE = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  const SVG_ARROW_UP = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>`;

  const oracleBtn = document.createElement('button');
  oracleBtn.id = 'sys-oracle-btn';
  oracleBtn.style.cssText = `position: fixed; bottom: 20px; right: 20px; width: 45px; height: 45px; border-radius: 50%; background-color: rgba(25, 25, 25, 0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: var(--sys-shadow-glass); display: flex; align-items: center; justify-content: center; z-index: 10001; cursor: pointer; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); color: rgba(157, 185, 126, 0.6); font-size: 20px; font-family: monospace; outline: none; padding: 0;`;
  oracleBtn.innerHTML = SVG_CHAT;
  document.body.appendChild(oracleBtn);

  const oracleSidebar = document.createElement('div');
  oracleSidebar.id = 'sys-oracle-sidebar';
  oracleSidebar.style.cssText = `position: fixed; top: 15px; right: -800px; width: 380px; max-width: calc(100vw - 30px); height: calc(100vh - 30px); transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1); z-index: 10000; display: flex; flex-direction: column; overflow: hidden;`;
  oracleSidebar.innerHTML = `
    <div style="padding: 20px 24px; background: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: space-between;">
      <span style="color: #9DB97E; font-family: monospace; letter-spacing: 2px; font-weight: bold; opacity: 0.8; font-size: 13px; text-transform: uppercase;">SKINNY_ORACLE_V1.0</span>
      <span style="width: 8px; height: 8px; background: #9DB97E; border-radius: 50%; box-shadow: 0 0 5px rgba(157, 185, 126, 0.7); animation: sysOrPulse 1.5s infinite alternate; flex-shrink: 0;"></span>
    </div>
    <div id="sys-oracle-output" style="flex: 1; padding: 20px 24px; overflow-y: auto; color: #9DB97E; font-family: monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap; display: flex; flex-direction: column; gap: 15px;"></div>
    <div id="sys-oracle-input-container" style="padding: 12px 16px 16px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
      <div id="sys-oracle-pill" style="display: flex; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 10px 18px 10px 10px; box-shadow: inset 0 1px 4px rgba(0,0,0,0.2); transition: border-color 0.25s ease, box-shadow 0.25s ease;">
        <button id="sys-oracle-send" style="flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; background-color: rgba(157, 185, 126, 0.2); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-primary); display: flex; align-items: center; justify-content: center; cursor: pointer; margin-right: 12px; transition: background-color 0.3s ease, transform 0.2s ease; outline: none; padding: 0;">${SVG_ARROW_UP}</button>
        <input type="text" id="sys-oracle-input" style="flex: 1; background: transparent; border: none; color: #9DB97E; font-family: monospace; font-size: 13px; outline: none; min-width: 0;" placeholder="[ENTER_QUERY_HERE_]" autocomplete="off">
      </div>
    </div>
  `;
  document.body.appendChild(oracleSidebar);

  const oracleStyle = document.createElement('style');
  oracleStyle.innerHTML = `
    @keyframes sysOrPulse { 
      0% { opacity: 0.3; transform: scale(1); box-shadow: 0 0 4px #9DB97E; } 
      100% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 8px rgba(157,185,126,0.6); } 
    }
    /* LOCKDOWN STATE: Pure Glass + Kinetic Shrink */
    .sys-oracle-locked { 
        background-color: rgba(25, 25, 25, 0.6) !important; 
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important; 
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important; 
        
        /* Tipografia e Colore Countdown */
        color: rgba(255, 51, 51, 0.6) !important;
        font-weight: 600 !important; 
        font-size: 13px !important; 
        
        /* Cinetica e Interazione */
        transform: scale(0.85) !important;
        cursor: not-allowed !important; 
        opacity: 1 !important;
    }
    .sys-oracle-locked svg { display: none; }
    .sys-oracle-glitch { animation: sysOrGlitch 0.3s forwards; }
    @keyframes sysOrGlitch {
      0% { right: 15px; transform: translate(0, 0); }
      20% { right: 5px; transform: translate(-2px, 1px); }
      40% { right: 15px; transform: translate(2px, -1px); }
      60% { right: -5px; transform: translate(-1px, 2px); }
      80% { right: 5px; transform: translate(1px, -2px); }
      100% { right: -800px; transform: translate(0, 0); }
    }
    #sys-oracle-output::-webkit-scrollbar { width: 4px; }
    #sys-oracle-output::-webkit-scrollbar-track { background: transparent; }
    #sys-oracle-output::-webkit-scrollbar-thumb { background: rgba(157,185,126,0.5); border-radius: 2px; }
    #sys-oracle-btn { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1), right 0.4s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important; }
    #sys-oracle-btn:hover { background-color: rgba(35, 35, 35, 0.8) !important; color: rgba(157, 185, 126, 0.9) !important; }
    
    /* Cinetica spaziale: fa volare il bottone dentro la pillola di input */
    .sys-oracle-trigger--active { 
        transform: scale(0.65) !important; 
        background: transparent !important; 
        border-color: transparent !important; 
        box-shadow: none !important; 
        right: 42px !important;  /* Coordinate esatte margine destro pillola */
        bottom: 34px !important; /* Coordinate esatte centratura verticale pillola */
    }
    
    /* Hover specifico quando è dentro la pillola (solo ingrandimento) */
    .sys-oracle-trigger--active:hover {
        background: transparent !important;
        transform: scale(0.75) !important; 
        color: rgba(157, 185, 126, 1) !important;
    }
    #sys-oracle-send:hover { background-color: rgba(157, 185, 126, 0.6) !important; }
    
    /* System Chat Typography Sync */
    #sys-oracle-sidebar,
    #sys-oracle-sidebar p,
    #sys-oracle-sidebar span,
    #sys-oracle-sidebar h1,
    #sys-oracle-sidebar h2,
    #sys-oracle-sidebar h3,
    #sys-oracle-sidebar div,
    #sys-oracle-sidebar input {
        color: rgba(157, 185, 126, 0.6) !important;
    }
    
    /* Exclusion for Send Button (Keep White Optics) */
    #sys-oracle-send, #sys-oracle-send svg {
        color: var(--text-primary) !important;
    }

    /* Sposta SOLO il bottone in alto per schermi fino a 768px (Tablet/Mobile) */
    @media (max-width: 768px) {
      #sys-oracle-btn:not(.sys-oracle-trigger--active) {
          /* ASSE Y: Sottrae 14px per bucare il padding invisibile del controller e appoggiarsi sul vetro */
          bottom: calc(var(--controller-h, 110px) - 14px) !important;
          
          /* ASSE X: Allinea il centro del trigger (45px) col centro del send (32px) + margini 4vw */
          right: calc(4vw + 1px) !important;
      }
    }
    
    /* Allarga la Island e riposiziona la X interna SOLO per schermi <= 500px (Mobile) */
    @media (max-width: 500px) {
      #sys-oracle-sidebar { 
          width: calc(100vw - 48px) !important; 
          height: 55vh !important;
          top: auto !important;
          bottom: calc(var(--controller-h, 110px) + 4px) !important;
          border-radius: 24px !important; 
      }
      .sys-oracle-trigger--active {
          right: 39px !important; 
          bottom: calc(var(--controller-h, 110px) + 23px) !important; 
      }
    }
  `;
  document.head.appendChild(oracleStyle);

  const oracleInput = oracleSidebar.querySelector('#sys-oracle-input');
  const oraclePill = oracleSidebar.querySelector('#sys-oracle-pill');
  const oracleSendBtn = oracleSidebar.querySelector('#sys-oracle-send');

  oracleInput.addEventListener('focus', () => {
    if (oraclePill) {
      oraclePill.style.borderColor = 'rgba(255,255,255,0.22)';
      oraclePill.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.2), 0 0 0 2px rgba(157,185,126,0.08)';
    }
  });
  oracleInput.addEventListener('blur', () => {
    if (oraclePill) {
      oraclePill.style.borderColor = 'rgba(255,255,255,0.1)';
      oraclePill.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.2)';
    }
  });

  function submitOracleQuery() {
    const val = oracleInput.value.trim();
    if (val && !isOracleLocked) {
      oracleInput.value = '';
      callOracleSupport(val);
    }
  }

  if (oracleSendBtn) {
    oracleSendBtn.addEventListener('click', submitOracleQuery);
  }

  let isOracleOpen = false;
  oracleBtn.addEventListener('click', () => {
    if (isOracleLocked) return;
    isOracleOpen = !isOracleOpen;
    const activeRightOffset = window.innerWidth <= 500 ? '12px' : '15px';
    oracleSidebar.style.right = isOracleOpen ? activeRightOffset : '-800px';
    if (isOracleOpen) {
      oracleBtn.classList.add('sys-oracle-trigger--active');
      oracleBtn.innerHTML = SVG_CLOSE;
      document.getElementById('sys-oracle-output').innerHTML = '';
      setTimeout(() => oracleInput.focus(), 300);
    } else {
      oracleBtn.classList.remove('sys-oracle-trigger--active');
      oracleBtn.innerHTML = SVG_CHAT;
    }
  });

  oracleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitOracleQuery();
    }
  });

  // -----------------------------------------------------------
  // HELPER MENTALE (SENTINELLA ASSISTENZA) - PURIFIED
  // -----------------------------------------------------------
  function isAssistanceRequest(text) {
    if (typeof text !== 'string') return false;

    // 1. Ignora i segnaposti del terminale
    if (text.includes('[') || text.includes(']')) return false;

    // 2. SCUDO DI PURIFICAZIONE: Rimuoviamo URL ed Email dal testo da analizzare
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)/gi;
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi;

    let purifiedText = text.replace(urlRegex, '').replace(emailRegex, '');

    // 3. Controllo domante (?): analizziamo solo il testo purificato
    if (purifiedText.includes('?')) return true;

    // 4. Controllo Keyword: analizziamo solo il testo purificato
    const keywords = ["help", "aiuto", "info", "spiega", "come funziona", "what is", "why", "perché", "perche", "assistenza"];
    const lowerText = purifiedText.toLowerCase();

    // Evita che parole interne ad altre (es. "infografica") facciano scattare l'allarme
    // Usiamo una regex con word boundary (\b) per le parole chiave più a rischio
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');

    return keywordRegex.test(lowerText);
  }

  // -----------------------------------------------------------
  // INIT
  // -----------------------------------------------------------
  function clearExampleText(e) {
    // SCUDO RACE-CONDITION: Ignora la pressione del tasto Invio per evitare conflitti con handleSubmit
    if (e && e.key === 'Enter') return;

    if (!inputLocked && input.value) {
      // 1. AUTO-ERASER: Intercetta e vaporizza il placeholder
      const exampleRegex = /\s*\(e\.g\.[^)]+\)/i;
      if (exampleRegex.test(input.value)) {
        input.value = input.value.replace(exampleRegex, '');
        // BETA: Ripristino proattivo dello spazio vitale se assente
        if (/^[A-Z\s/]+:$/.test(input.value)) {
          input.value = input.value + ' ';
        }
      }

      // 2. SCUDO IMMUTABILITA' PREFISSO: Disaccoppiato dall'Auto-Eraser
      // Se il testo corrisponde esattamente al prefisso asettico, blocca le azioni distruttive
      if (e && (e.key === 'Backspace' || e.key === 'Delete')) {
        // ALPHA: Spazio finale opzionale per garantire il lock dei due punti in ogni caso
        const prefixRegex = /^[A-Z\s/]+:\s*$/;
        if (prefixRegex.test(input.value)) {
          e.preventDefault();
        }
      }
    }
  }

  function init() {
    if (!input || !sendBtn) return;
    input.value = 'Start Preventive Evaluation';
    autoResizeInput();
    checkStartIntent();

    input.addEventListener('input', () => {
      autoResizeInput();
      checkStartIntent();
    });

    input.addEventListener('keydown', handleKeyDown);
    input.addEventListener('mousedown', clearExampleText);
    input.addEventListener('keydown', clearExampleText);
    sendBtn.addEventListener('click', handleSubmit);
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
  }

  function autoResizeInput() {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';

    const controller = document.querySelector('.sys-chat-controller');
    if (controller) {
      document.documentElement.style.setProperty('--controller-h', controller.offsetHeight + 'px');
    }
  }

  function checkStartIntent() {
    if (!input) return;
    const wrapper = document.querySelector('.sys-chat-input-wrapper');
    if (!wrapper) return;
    if (input.value === 'Start Preventive Evaluation') {
      wrapper.classList.add('sys-intent-start');
    } else {
      wrapper.classList.remove('sys-intent-start');
    }
  }

  function resetInput() {
    input.value = '';
    input.style.height = '36px';
    checkStartIntent();
  }

  function lockInput(permanent = false) {
    input.disabled = true;
    sendBtn.disabled = true;
    if (permanent) inputLocked = true;
  }

  function unlockInput() {
    if (inputLocked) return;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }

  function injectInputPrompt(text) {
    input.value = '';
    input.value = text;
    unlockInput();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    autoResizeInput();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function scrollToBottom() {
    if (!canvas) return;
    canvas.scrollTo({ top: canvas.scrollHeight, behavior: 'smooth' });
  }

  function updateStatusBar(code) {
    if (!accessBar || !statusText) return;
    localStorage.setItem('sitoss_status', code);
    accessBar.setAttribute('data-status', code);
    const labels = {
      'verification': 'STATUS: UNDER REVIEW<span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span>',
      'request': 'STATUS: ACCESS REQUEST<span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span>',
      'verified': 'STATUS: IDENTITY VERIFIED<span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span>',
      'denied': 'STATUS: ACCESS DENIED<span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span>',
      'allowed': 'STATUS: ACCESS ALLOWED<span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span>'
    };
    statusText.innerHTML = labels[code] || statusText.innerHTML;
  }

  function appendUserMessage(text, files = []) {
    if (ghost) ghost.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'chat-row chat-row--user';
    let mediaHTML = '';

    if (files.length > 0) {
      mediaHTML += '<div class="sys-bubble-gallery">';
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          // INIEZIONE ESTETICA ANTIGRAVITY: Smussatura angoli (border-radius) per resa soft ed elegante
          mediaHTML += `<img src="${URL.createObjectURL(file)}" alt="${escapeHTML(file.name)}" style="max-width:200px; max-height:200px; display:block; margin-top:8px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">`;
        } else {
          mediaHTML += `<div class="sys-bubble-doc">${escapeHTML(file.name.substring(0, 3))}..</div>`;
        }
      });
      mediaHTML += '</div>';
    }

    if (text || files.length > 0) {
      row.innerHTML = `<div class="chat-bubble">${mediaHTML}${text ? escapeHTML(text) : ''}</div>`;
      canvas.appendChild(row);
      scrollToBottom();
    }

    // MODULO 3 — Chat Logger
    const ts = new Date().toISOString();
    if (text) sysChatTranscript.push(`[${ts}] [USER]: ${text}`);
    if (files.length > 0) sysChatTranscript.push(`[${ts}] [USER_FILES]: ${files.map(f => f.name).join(', ')}`);
  }

  function appendUserMapMessage(area) {
    if (ghost) ghost.style.display = 'none';

    const GEO = {
      'ITALY': { lat: 41.8719, lng: 12.5674, zoom: 4, radius: 400000 },
      'EUROPE': { lat: 54.5260, lng: 15.2551, zoom: 2, radius: 1500000 },
      'EXTRA-EU': { lat: 20.0, lng: 0.0, zoom: 1, radius: 5000000 }
    };
    const geo = GEO[area] || GEO['EXTRA-UE'];

    const mapId = 'map-' + Date.now();
    const row = document.createElement('div');
    row.className = 'chat-row chat-row--user';
    row.innerHTML = `
      <div class="chat-bubble sys-map-bubble" style="padding: 0 !important; overflow: hidden; min-width: 260px; max-width: 80%; height: 220px; line-height: 0; font-size: 0; display: flex;">
        <div id="${mapId}" style="width: 100%; height: 100%; border-radius: inherit; z-index: 1;"></div>
      </div>
    `;

    canvas.appendChild(row);
    scrollToBottom();

    requestAnimationFrame(() => {
      const map = L.map(mapId, {
        center: [geo.lat, geo.lng],
        zoom: geo.zoom,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: false,
        minZoom: 1,
        maxBounds: [[-90, -180], [90, 180]],
        maxBoundsViscosity: 1.0
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      const targetCircle = L.circle([geo.lat, geo.lng], {
        color: '#8fb97a',
        fillColor: '#8fb97a',
        fillOpacity: 0.12,
        weight: 1.5,
        radius: window.innerWidth <= 768 ? geo.radius * 0.55 : geo.radius
      }).addTo(map);

      LeadData.targetCoords = { lat: geo.lat, lng: geo.lng };

      map.on('dblclick', function (e) {
        const currentZoom = map.getZoom();
        const scaleFactor = Math.pow(2, currentZoom - geo.zoom);
        const newRadius = geo.radius / scaleFactor;
        
        targetCircle.setLatLng(e.latlng);
        targetCircle.setRadius(newRadius);
        LeadData.targetCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      });

      scrollToBottom();
    });
  }

  function createBotRow() {
    if (ghost) ghost.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'chat-row chat-row--bot';
    row.innerHTML = `
      <div class="sys-bot-avatar" aria-hidden="true">
        <svg class="sys-access-bar__logo" viewBox="0 0 295.29 295.69" xmlns="http://www.w3.org/2000/svg">
          <path d="m267.55 61.51c-2.01-2.79-4.17-5.58-6.42-8.28-.13-.16-.27-.33-.41-.48-2.74-3.28-5.68-6.5-8.76-9.58s-6.06-5.8-9.22-8.45l-5.31 5.31-84.76 84.76-.02.02-5.28 5.28-72.31-72.3c2.63-2.14 5.35-4.14 8.14-6.01 18.83-12.64 40.97-19.43 64.16-19.43s45.99 6.99 64.99 20l23.29-23.29-.94-.68c-9.7-7.11-20.08-12.94-30.98-17.44-.72-.3-1.45-.6-2.18-.88-1.5-.6-3.03-1.16-4.56-1.7-.07-.03-.15-.05-.23-.08-.49-.17-.98-.34-1.48-.51-14.88-5.04-30.83-7.77-47.42-7.77-45.54-0-86.26 20.58-113.37 52.95l95.02 95.02-5.11 5.11-.08.08-66.92 66.91c-2.14-2.63-4.14-5.35-6.01-8.13-12.64-18.84-19.43-40.98-19.43-64.17s6.99-45.98 20-64.98l-17.92-17.92-5.01-5.01c-18.24 24.58-29.02 55.02-29.02 87.98 0 45.29 20.36 85.81 52.42 112.94l89.84-89.83 1.28-1.28 3.83-3.83 72.08 72.08c-2.64 2.13-5.36 4.13-8.15 5.99-18.78 12.55-40.84 19.28-63.94 19.28s-44.21-6.45-62.72-18.49l-.22.22-22.49 22.5-.44.44c23.69 17.07 52.63 27.31 83.95 27.81.48.01.97.02 1.45.01.32.01.64.01.96.01 31.01-.1 60.66-9.69 85.77-27.74 2.8-2.01 5.58-4.16 8.27-6.41.17-.13.33-.27.49-.41 3.28-2.74 6.5-5.69 9.58-8.77 2.96-2.95 5.8-6.05 8.46-9.21l-5.32-5.32-81.79-81.79-1.49-1.49-1.48-1.48-5.1-5.1 2.04-2.04 70.24-70.24c2.13 2.64 4.13 5.35 5.99 8.15 12.55 18.78 19.28 40.83 19.28 63.93s-6.59 44.69-18.88 63.33l23.6 23.6c.63-.87 1.26-1.75 1.87-2.64v-.63c16.95-24.68 25.91-53.54 25.91-83.66s-9.6-61.02-27.74-86.26z"/>
        </svg>
      </div>
      <div class="chat-bubble"></div>
    `;
    canvas.appendChild(row);
    scrollToBottom();
    return row.querySelector('.chat-bubble');
  }

  function appendBotMessage(text, replies = [], autoSubmit = true, onDone = null) {
    isBotTyping = true;
    lockInput();
    const bubble = createBotRow();

    typeText(bubble, text, 0, () => { scrollToBottom(); }, () => {
      isBotTyping = false;
      // MODULO 3 — Chat Logger (registra dopo il typewriter)
      sysChatTranscript.push(`[${new Date().toISOString()}] [SYS]: ${text}`);
      if (replies && replies.length > 0) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'sys-smart-replies';

        replies.forEach(item => {
          const isObj = (typeof item === 'object' && item !== null);
          const type = isObj ? item.type || 'button' : 'button';

          if (type === 'select') {
            const select = document.createElement('select');
            select.className = 'sys-smart-reply font-mono';
            select.style.appearance = 'none';
            select.style.webkitAppearance = 'none';
            select.style.textAlign = 'center';

            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = item.label + ' \u25BE';
            defaultOpt.disabled = true;
            defaultOpt.selected = true;
            select.appendChild(defaultOpt);

            item.options.forEach(optText => {
              const opt = document.createElement('option');
              opt.value = optText;
              opt.textContent = optText;
              select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
              const val = e.target.value;
              if (!val) return;

              if (item.label === 'ASSET COUNT') {
                LeadData.assetCount = val;

                if (currentStep === 7) {
                  LeadData.extraRevisions = LeadData.extraRevisions || '1';
                  currentStep = 7.3;
                  injectInputPrompt('PROJECT SCOPE: (e.g. Complete Visual Identity overhaul for a new streetwear brand)');
                }
              } else if (item.label === 'REQUESTED REVISIONS') {
                LeadData.extraRevisions = val;
              }
            });

            repliesContainer.appendChild(select);
          } else {
            const btnLabel = isObj ? item.label : item;
            const template = isObj ? item.template : null;

            const btn = document.createElement('button');
            btn.className = 'sys-smart-reply font-mono';
            btn.textContent = btnLabel;

            btn.addEventListener('click', () => {
              if (isBotTyping) return;
              // Rimuove l'active dalle altre opzioni e lo assegna a questa (UI_RECOVERY_PROTOCOL)
              repliesContainer.querySelectorAll('button.sys-smart-reply').forEach(b => {
                b.classList.remove('active-selection');
              });
              btn.classList.add('active-selection');

              // Pulisce esplicitamente per permettere l'overwrite fluido
              input.value = '';

              if (template) {
                input.value = template;
                unlockInput();
                input.focus();
                autoResizeInput();
                const firstPlaceholder = template.indexOf('[');
                const pos = firstPlaceholder !== -1 ? firstPlaceholder : template.length;
                input.setSelectionRange(pos, pos);
              } else if (autoSubmit) {
                input.value = btnLabel;
                handleSubmit();
              } else {
                input.value = btnLabel + ' - ';
                unlockInput();
                input.focus();
                const len = input.value.length;
                input.setSelectionRange(len, len);
                autoResizeInput();
              }
            });
            repliesContainer.appendChild(btn);
          }
        });
        bubble.appendChild(repliesContainer);
        scrollToBottom();
      }
      unlockInput();
      if (onDone) onDone();
    });
  }

  function appendBotInstant(text, tempClass = null) {
    const bubble = createBotRow();
    if (tempClass) {
      const row = bubble.closest('.chat-row') || bubble.parentElement;
      if (row) row.classList.add(tempClass);
    }
    bubble.innerHTML = escapeHTML(text);
    scrollToBottom();
    // MODULO 3 — Chat Logger (solo messaggi non temporanei)
    if (!tempClass) {
      sysChatTranscript.push(`[${new Date().toISOString()}] [SYS]: ${text}`);
    }
  }

  function typeText(element, text, index, onTick, onComplete) {
    if (index < text.length) {
      element.insertAdjacentText('beforeend', text.charAt(index));
      if (onTick) onTick();
      setTimeout(() => typeText(element, text, index + 1, onTick, onComplete), 12);
    } else {
      if (onComplete) onComplete();
    }
  }

  // -----------------------------------------------------------
  // SUBMISSION LOGIC (Con filtro Sentinella a monte)
  // -----------------------------------------------------------
  function handleSubmit() {
    if (inputLocked) return;
    if (isBotTyping) return;
    let text = input.value.trim();

    // SCUDO AUTO-ERASER: Purga eventuali esempi testuali residui prima del processamento
    text = text.replace(/\s*\(e\.g\.[^)]+\)/i, '').trim();

    if (!text && pendingFiles.length === 0) return;

    // SCUDO ANTI-TROLL & JAILBREAK (Filtro Locale Zero-Latency)
    const toxicRegex = /(ignora.*istruzioni|ignore.*previous|forget.*prompt|disregard|jailbreak|cazzo\b|merda\b|stronzo\b|fottiti\b|idiota\b|puttana\b|troia\b|bastardo\b|vaffanculo\b|coglione\b|bitch\b|fuck\b|shit\b|asshole\b|dickhead\b)/i;
    if (text && toxicRegex.test(text)) {
      appendUserMessage(text);
      resetInput();
      lockInput(true);
      if (uploadBtn) uploadBtn.style.display = 'none';
      appendBotInstant('TOXIC BEHAVIOR OR PROTOCOL BYPASS DETECTED.');
      setTimeout(() => triggerBanishment("POLICY_VIOLATION_UNAUTHORIZED_BEHAVIOR"), 1500);
      return;
    }

    // SCUDO INTERCETTATORE "SENTINELLA"
    if (text && isAssistanceRequest(text)) {
      appendUserMessage(text, [...pendingFiles]);
      resetInput();
      pendingFiles = [];
      if (typeof renderStagingArea === 'function') renderStagingArea();
      callGeminiAssist(currentStep, text);
      return;
    }

    if (currentStep === 0) {
      updateStatusBar('request');
    }

    resetInput();
    const filesToSend = [...pendingFiles];
    pendingFiles = [];
    if (typeof renderStagingArea === 'function') {
      renderStagingArea();
    }
    processStep(text, filesToSend);
  }

  function processStep(userInput = '', files = []) {
    if (inputLocked) return;

    // SCUDO MULTIMEDIALE: Accumula i file caricati in qualsiasi step per il payload finale
    if (files.length > 0) {
      if (!LeadData.finalFiles) LeadData.finalFiles = [];
      LeadData.finalFiles.push(...files);
    }

    // --- Inizio Master State Override e Helper Locali ---
    const replacePastBubbleText = (oldText, newText) => {
      if (!oldText) return false;
      const userBubbles = document.querySelectorAll('.chat-row--user .chat-bubble');
      for (let i = userBubbles.length - 1; i >= 0; i--) {
        const bubble = userBubbles[i];
        if (bubble.innerText.trim() === oldText.trim()) {
          bubble.innerText = newText;
          return true;
        }
      }
      return false;
    };

    const restoreCurrentPrompt = () => {
      if (isBotTyping) return;
      switch (currentStep) {
        case 1.1: injectInputPrompt('FULL NAME: (e.g. Skinny Spietato or SS Company)'); break;
        case 1.2: injectInputPrompt('WEBSITE/SOCIAL LINK: (e.g. https://instagram.com/yourbrand or www.yourwebsite.com)'); break;
        case 1.3: injectInputPrompt('PHONE CONTACT: (e.g. +39 333 123 4567)'); break;
        case 2: injectInputPrompt('EMAIL: (e.g. example@email.com)'); break;
        case 7.3: injectInputPrompt('PROJECT SCOPE: (e.g. Complete Visual Identity overhaul for a new streetwear brand)'); break;
        case 7.4: injectInputPrompt('ASSET TYPE: (e.g. 3D Garment animations and high-end logo design)'); break;
        case 7.5: injectInputPrompt('PHYSICAL OUTPUT / PRODUCTION: (e.g. creation of 10 3D printed items or large-scale t-shirt production)'); break;
        case 7.6: injectInputPrompt('REQUESTED SUBJECTS: (e.g. 3 Hoodies, 2 T-Shirts, and 1 metallic mascot)'); break;
        case 7.7: injectInputPrompt('VISUAL STYLE AND REFERENCE: (e.g. Dark futuristic aesthetic, cyberpunk mood, similar to the attached moodboard)'); break;
      }
    };

    const inputUpper = typeof userInput === 'string' ? userInput.trim().toUpperCase() : '';

    if (currentStep > 0 && inputUpper) {
      const validEntities = ['COMPANY', 'STARTUP', 'PRIVATE'];
      const validAreas = ['ITALY', 'EUROPE', 'EXTRA-EU'];
      const validScopes = ['VISUAL IDENTITY', 'MERCHANDISING', '3D/MOTION', '3D/GARMENT', '3D/PROTOTYPE', 'PRINT ASSET', 'FULL SITE'];
      const validBudgets = ['< 600€', '600€ - 1K', '1K-5K', '5K-10K', '> 10K'];

      // --- LOGICA ENTITIES ---
      if (validEntities.includes(inputUpper)) {
        if (currentStep > 1.3) {
          return;
        } else if (currentStep > 1 && currentStep <= 1.3) {
          // Cambia visivamente la vecchia bolla con la nuova entità cercandola per testo esatto
          replacePastBubbleText(LeadData.clientType, userInput);

          // Aggiorna SOLO l'entità senza azzerare i progressi successivi (Soft Override)
          LeadData.clientType = inputUpper;

          // Mantieni lo stato attuale e ripristina la barra di input con il placeholder del currentStep
          restoreCurrentPrompt();
          return;
        }
      }

      // --- LOGICA AREAS ---
      if (validAreas.includes(inputUpper)) {
        if (currentStep > 4) {
          const userRows = document.querySelectorAll('.chat-row--user');
          let mapRow = null;
          for (let i = userRows.length - 1; i >= 0; i--) {
            if (userRows[i].querySelector('div[id^="map-"]') || userRows[i].querySelector('.leaflet-container')) {
              mapRow = userRows[i];
              break;
            }
          }
          if (mapRow) {
            const GEO = {
              'ITALY': { lat: 41.8719, lng: 12.5674, zoom: 4, radius: 400000 },
              'EUROPE': { lat: 54.5260, lng: 15.2551, zoom: 2, radius: 1500000 },
              'EXTRA-EU': { lat: 20.0, lng: 0.0, zoom: 1, radius: 5000000 }
            };
            const geo = GEO[inputUpper] || GEO['EXTRA-EU'];
            const mapId = 'map-' + Date.now();

            mapRow.innerHTML = `
              <div class="chat-bubble sys-map-bubble" style="padding: 0 !important; overflow: hidden; min-width: 260px; max-width: 80%; height: 220px; line-height: 0; font-size: 0; display: flex;">
                <div id="${mapId}" style="width: 100%; height: 100%; border-radius: inherit; z-index: 1;"></div>
              </div>
            `;

            requestAnimationFrame(() => {
              const map = L.map(mapId, {
                center: [geo.lat, geo.lng], zoom: geo.zoom, zoomControl: false,
                attributionControl: false, dragging: true, scrollWheelZoom: true,
                touchZoom: true, doubleClickZoom: false, minZoom: 1,
                maxBounds: [[-90, -180], [90, 180]], maxBoundsViscosity: 1.0
              });
              L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd', maxZoom: 19
              }).addTo(map);
              L.circle([geo.lat, geo.lng], {
                color: '#8fb97a', fillColor: '#8fb97a',
                fillOpacity: 0.12, radius: window.innerWidth <= 768 ? geo.radius * 0.55 : geo.radius, weight: 1.5
              }).addTo(map);
            });
          }
          LeadData.area = inputUpper;
          restoreCurrentPrompt();
          return;
        }
      }

      // --- LOGICA SCOPES ---
      if (validScopes.includes(inputUpper) || inputUpper.startsWith('OTHER:')) {
        if (currentStep > 5) {
          replacePastBubbleText(LeadData.scope, userInput);
          LeadData.scope = userInput;
          restoreCurrentPrompt();
          return;
        }
      }

      // --- LOGICA BUDGETS ---
      if (validBudgets.includes(inputUpper)) {
        if (currentStep > 6) {
          replacePastBubbleText(LeadData.budget, userInput);
          LeadData.budget = userInput;
          restoreCurrentPrompt();
          return;
        }
      }
    }
    // --- Fine Master State Override ---

    if (currentStep === 0) {
      if (files.length) appendUserMessage('', files);
      currentStep = 1;

      const step0Text = 'PROCEED WITH THE INSERTION OF NAME, CONTACTS, AND WEBSITE/SOCIAL LINK.\n(NOTE: The requested data is strictly necessary for the preliminary audit and project calibration. The absence or falsification of these parameters will prevent the system from proceeding with the feasibility analysis. Select the entity type to generate the acquisition module.)';

      const step0Replies = ['COMPANY', 'STARTUP', 'PRIVATE'];

      appendBotMessage(step0Text, step0Replies, true);
      return;
    }

    if (currentStep === 1) {
      appendUserMessage(userInput);
      LeadData.clientType = userInput.toUpperCase();
      currentStep = 1.1;
      injectInputPrompt('FULL NAME: (e.g. Skinny Spietato or SS Company)');
      return;
    }

    if (currentStep === 1.1) {
      let cleanVal = userInput.replace(/^FULL\s+NAM[E]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "FULL NAME: " + cleanVal;
      appendUserMessage(perfectString);
      LeadData.clientName = cleanVal;
      currentStep = 1.2;
      injectInputPrompt('WEBSITE/SOCIAL LINK: (e.g. https://instagram.com/yourbrand or www.yourwebsite.com)');
      return;
    }

    if (currentStep === 1.2) {
      let cleanVal = userInput.replace(/^WEBSITE\/SOCIAL\s+LIN[K]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "WEBSITE/SOCIAL LINK: " + cleanVal;

      // SCUDO CLEAN-RETRY: Se l'utente sta riprovando dopo un errore, sostituisci la bolla vecchia e purga gli errori
      if (linkErrorCount > 0) {
        let oldString = "WEBSITE/SOCIAL LINK: " + (LeadData.socialLink || "N/D");
        let replaced = replacePastBubbleText(oldString, perfectString);
        if (!replaced) appendUserMessage(perfectString);

        // Purga le bolle di errore del bot e i vecchi log temporanei
        document.querySelectorAll('.sys-log-temp').forEach(n => n.remove());
        const botBubbles = document.querySelectorAll('.chat-row--bot .chat-bubble');
        botBubbles.forEach(b => {
          if (b.innerText.includes('UNREACHABLE_SOURCE')) {
            const row = b.closest('.chat-row');
            if (row) row.remove();
          }
        });
      } else {
        appendUserMessage(perfectString);
      }

      LeadData.socialLink = cleanVal;
      lockInput();
      callPingLink(LeadData.socialLink);
      return;
    }

    if (currentStep === 1.3) {
      let cleanVal = userInput.replace(/^PHONE\s+CONTAC[T]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "PHONE CONTACT: " + cleanVal;
      appendUserMessage(perfectString);
      LeadData.phoneContact = cleanVal;
      lockInput();

      const smartReplies = document.querySelectorAll('button.sys-smart-reply');
      smartReplies.forEach(btn => {
        const text = btn.textContent.trim().toUpperCase();
        if (['COMPANY', 'STARTUP', 'PRIVATE'].includes(text)) {
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.classList.remove('active-selection');
        }
      });

      currentStep = 2;
      appendBotMessage(
        'ENTER VERIFIABLE EMAIL ADDRESS.\n(NOTE: The provided address will serve as the exclusive communication node for quotes, technical documentation, and operational directives. Identity validation via OTP grants the system authorization to transmit service communications and future commercial updates. Enter an operational address.)',
        [],
        true,
        () => injectInputPrompt('EMAIL: (e.g. example@email.com)')
      );
      return;
    }

    if (currentStep === 2) {
      // SCUDO REGEX: Rimuove il prefisso prima di validare l'indirizzo
      let cleanVal = userInput.replace(/^EMAI[L]?:?\s*/i, '').trim();
      let perfectString = "EMAIL: " + cleanVal;

      if (!EMAIL_REGEX.test(cleanVal)) {
        LeadData.emailErrorCount = (LeadData.emailErrorCount || 0) + 1;

        if (LeadData.emailErrorCount > 1) {
          // Retry successivo al primo: Muta la vecchia bolla errata
          const userBubbles = document.querySelectorAll('.chat-row--user .chat-bubble');
          if (userBubbles.length > 0) userBubbles[userBubbles.length - 1].innerText = perfectString;

          // Purga eventuali errori precedenti per non duplicarli
          document.querySelectorAll('.chat-row--bot .chat-bubble').forEach(b => {
            if (b.innerText.includes('INVALID EMAIL FORMAT')) {
              const row = b.closest('.chat-row');
              if (row) row.remove();
            }
          });
        } else {
          // Primo errore assoluto: Appendi la bolla normalmente
          appendUserMessage(perfectString);
        }

        appendBotInstant('INVALID EMAIL FORMAT. RE-ENTER.');
        unlockInput();
        injectInputPrompt('EMAIL: (e.g. example@email.com)');
        return;
      }

      // SUCCESSO: La regex è valida.
      if (LeadData.emailErrorCount > 0) {
        // Se c'erano stati errori in precedenza, pulisci il DOM un'ultima volta
        const userBubbles = document.querySelectorAll('.chat-row--user .chat-bubble');
        if (userBubbles.length > 0) userBubbles[userBubbles.length - 1].innerText = perfectString;

        document.querySelectorAll('.chat-row--bot .chat-bubble').forEach(b => {
          if (b.innerText.includes('INVALID EMAIL FORMAT')) {
            const row = b.closest('.chat-row');
            if (row) row.remove();
          }
        });
      } else {
        appendUserMessage(perfectString);
      }

      LeadData.clientEmail = cleanVal;
      lockInput();
      callSendOtp(cleanVal);
      return;
    }

    if (currentStep === 2.5) {
      appendUserMessage(userInput);
      lockInput();
      callVerifyOtp(userInput);
      return;
    }

    if (currentStep === 4) {
      const validOptions4 = ['ITALY', 'EUROPE', 'EXTRA-EU'];
      if (!validOptions4.includes(userInput.toUpperCase())) {
        appendUserMessage(userInput);
        appendBotInstant('INVALID PARAMETER. VALID OPTIONS: ITALY, EUROPE, EXTRA-EU');
        unlockInput();
        return;
      }
      appendUserMapMessage(userInput.toUpperCase());
      LeadData.area = userInput.toUpperCase();
      currentStep = 5;
      appendBotMessage(
        'SELECT INTERVENTION SECTOR.\n(NOTE: Indicate the primary scope of the project. Operational specifications will be detailed in the next step. If the desired visual infrastructure is not present, use the \'OTHER\' option for manual entry.)',
        [
          'VISUAL IDENTITY',
          'MERCHANDISING',
          '3D/MOTION',
          '3D/GARMENT',
          '3D/PROTOTYPE',
          'PRINT ASSET',
          'FULL SITE',
          { label: 'OTHER', template: 'OTHER: (e.g. Custom 3D Environment or VR Experience)' }
        ]
      );
      return;
    }

    if (currentStep === 5) {
      const validOptions5 = ['VISUAL IDENTITY', 'MERCHANDISING', '3D/MOTION', '3D/GARMENT', '3D/PROTOTYPE', 'PRINT ASSET', 'FULL SITE'];
      const isStandard = validOptions5.includes(userInput.toUpperCase());
      const isOther = userInput.toUpperCase().startsWith('OTHER:');

      if (!isStandard && !isOther) {
        appendUserMessage(userInput);
        appendBotInstant('VALID OPTIONS REQUIRED. SELECT FROM MENU OR PREFIX "OTHER:"');
        unlockInput();
        return;
      }
      if (isOther) {
        let cleanVal = userInput.replace(/^OTHER:\s*/i, '').trim();
        if (!cleanVal) cleanVal = "N/D";
        userInput = "OTHER: " + cleanVal;
      }
      appendUserMessage(userInput);
      LeadData.scope = userInput;
      // [FIX BUG 1] Registriamo la selezione testuale nel transcript per il pannello Admin
      sysChatTranscript.push(`[${new Date().toISOString()}] [USER]: [AREA OPERATIVA SELEZIONATA]: ${LeadData.area || 'N/D'} // ${userInput}`);
      currentStep = 6;
      appendBotMessage('DEFINE ALLOCATED BUDGET.\n(NOTE: The indicated allocation will be binding only if congruent with the project\'s architecture. Requests with illogical or speculative economic parameters will cause automatic rejection before the quoting phase. For expenditure thresholds below €600, the protocol requires 100% upfront payment.)', ['< 600€', '600€ - 1k', '1k-5k', '5k-10k', '> 10k']);
      return;
    }

    if (currentStep === 6) {
      const validOptions6 = ['< 600€', '600€ - 1k', '1k-5k', '5k-10k', '> 10k'];
      if (!validOptions6.includes(userInput)) {
        appendUserMessage(userInput);
        appendBotInstant('BINDING PARAMETER REQUIRED. SELECT BUDGET FROM MENU');
        unlockInput();
        return;
      }
      appendUserMessage(userInput);
      LeadData.budget = userInput;

      setTimeout(() => {
        currentStep = 7;
        uploadBtn.style.display = 'flex';
        const dropdownOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'OTHER'];
        appendBotMessage(
          'PROVIDE PROJECT SPECIFICATIONS AND ASSETS.\n(NOTE: Enter ALL specifications at this stage: the late integration of new operational directives will be classified as an \'Extra Revision\' and deducted from the total count or billed separately. Including visual references via the \'Paperclip\' icon is a fundamental requirement for the project\'s architectural alignment.)',
          [
            { type: 'select', label: 'ASSET COUNT', options: dropdownOptions },
            { type: 'select', label: 'REQUESTED REVISIONS', options: dropdownOptions }
          ],
          false
        );
      }, 400);
      return;
    }

    if (currentStep === 7.3) {
      let cleanVal = userInput.replace(/^PROJECT\s+SCOP[E]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "PROJECT SCOPE: " + cleanVal;
      appendUserMessage(perfectString, files);
      LeadData.projectScope = cleanVal;
      currentStep = 7.4;
      injectInputPrompt('ASSET TYPE: (e.g. 3D Garment animations and high-end logo design)');
      return;
    }

    if (currentStep === 7.4) {
      let cleanVal = userInput.replace(/^ASSET\s+TYP[E]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "ASSET TYPE: " + cleanVal;
      appendUserMessage(perfectString, files);
      LeadData.assetType = cleanVal;
      currentStep = 7.5;
      injectInputPrompt('PHYSICAL OUTPUT / PRODUCTION: (e.g. creation of 10 3D printed items or large-scale t-shirt production)');
      return;
    }

    if (currentStep === 7.5) {
      let cleanVal = userInput.replace(/^PHYSICAL\s+OUTPUT\s*\/\s*PRODUCTIO[N]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "PHYSICAL OUTPUT / PRODUCTION: " + cleanVal;
      appendUserMessage(perfectString, files);
      LeadData.physicalOutput = cleanVal;
      currentStep = 7.6;
      injectInputPrompt('REQUESTED SUBJECTS: (e.g. 3 Hoodies, 2 T-Shirts, and 1 metallic mascot)');
      return;
    }

    if (currentStep === 7.6) {
      let cleanVal = userInput.replace(/^REQUESTED\s+SUBJECT[S]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "REQUESTED SUBJECTS: " + cleanVal;
      appendUserMessage(perfectString, files);
      LeadData.requestedSubjects = cleanVal;
      currentStep = 7.7;
      injectInputPrompt('VISUAL STYLE AND REFERENCE: (e.g. Dark futuristic aesthetic, cyberpunk mood, similar to the attached moodboard)');
      return;
    }

    if (currentStep === 7.7) {
      let cleanVal = userInput.replace(/^VISUAL\s+STYLE\s+AND\s+REFERENC[E]?:?\s*/i, '').trim();
      if (!cleanVal) cleanVal = "N/D";
      let perfectString = "VISUAL STYLE AND REFERENCE: " + cleanVal;
      appendUserMessage(perfectString, files);
      LeadData.visualStyle = cleanVal;

      // Fallback Data for backend
      LeadData.deadline = 'Standard';
      LeadData.uploadUrl = (LeadData.finalFiles && LeadData.finalFiles.length > 0) ? 'ATTACHMENTS_PRESENT' : 'NO_ATTACHMENTS';
      LeadData.internalNotes = 'Acquired via Preventive Evaluation Terminal';

      currentStep = 8;
      lockInput();

      if (LeadData.finalFiles && LeadData.finalFiles.length > 0) {
        appendBotInstant('ASSET LOADED: ' + LeadData.finalFiles.length + ' FILE(S) — CHECKSUM OK.', 'sys-log-temp');
        setTimeout(() => {
          document.querySelectorAll('.sys-log-temp').forEach(n => n.remove());
        }, 2500);
      }

      const auditLog = `COMPILING LEAD DATA...
\nENTITY: ${LeadData.clientType || 'N/D'} | EMAIL: ${LeadData.clientEmail || 'N/D'}
\nAREA: ${LeadData.area || 'N/D'} | SCOPE: ${LeadData.scope || 'N/D'} | BUDGET: ${LeadData.budget || 'N/D'}
\nROUTING TO EVALUATION MODULE...`;

      appendBotInstant(auditLog);

      setTimeout(() => {
        callGeminiEvaluate();
      }, 800);
      return;
    }
  }

  // -----------------------------------------------------------
  // NETWORK LAYER — Backend Multiplexer calls
  // -----------------------------------------------------------

  async function callBackend(payload) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP_' + res.status);
    return await res.json();
  }

  async function callSendOtp(email) {
    appendBotInstant('SENDING OTP TO: ' + email + '...', 'sys-log-temp');
    try {
      const data = await callBackend({ action: 'SEND_OTP', email });
      if (data.status === 'success') {
        currentStep = 2.5;
        otpErrorCount = 0;
        document.querySelectorAll('.sys-log-temp').forEach(node => node.remove());
        appendBotMessage('OTP SENT. ENTER 5-DIGIT ACCESS CODE.\n(NOTE: The validation token has been forwarded to the provided address. Check your inbox and junk/SPAM folder. The code has a limited time validity. Enter the numeric code to unlock the terminal.)');
      } else {
        appendBotInstant((data.message || 'SERVER_FAILURE') + '. RE-ENTER EMAIL.');
        unlockInput();
      }
    } catch (e) {
      evalLog('EVAL_OTP_SEND_FAIL', 'Impossibile contattare il server per invio OTP.', { email: LeadData.clientEmail });
      appendBotInstant('UNABLE TO CONTACT SERVER. RETRY.');
      unlockInput();
    }
  }

  async function callVerifyOtp(otp) {
    try {
      const data = await callBackend({ action: 'VERIFY_OTP', email: LeadData.clientEmail, otp });
      if (data.verified === true) {
        updateStatusBar('verified');
        appendBotInstant('AUTH SUCCESS: IDENTITY VERIFIED. PROTOCOL GRANTED.', 'sys-log-temp');
        currentStep = 4;
        setTimeout(() => {
          document.querySelectorAll('.sys-log-temp').forEach(node => node.remove());
          appendBotMessage('DEFINE OPERATIONAL AREA.\n(NOTE: The geographic parameter calibrates the project\'s communicative infrastructure, adapting language, tone, and cultural resonance to the target audience. The selected area also constrains the sizing of operational costs. Any linguistic exceptions can be defined in the textual brief.)', ['ITALY', 'EUROPE', 'EXTRA-EU']);
          unlockInput();
        }, 500);
      } else {
        otpErrorCount++;
        if (otpErrorCount >= 3) {
          evalLog('EVAL_OTP_MAX_RETRY', 'Max OTP retry raggiunto. Banishment attivato.', { attempts: otpErrorCount });
          triggerBanishment('MAX OTP RETRY EXCEEDED. IDENTITY UNVERIFIABLE.');
        } else {
          evalLog('EVAL_OTP_INVALID', 'OTP errato inserito.', { attempt: otpErrorCount });
          appendBotInstant('INVALID OTP. ATTEMPT ' + otpErrorCount + '/3. RE-ENTER.');
          unlockInput();
        }
      }
    } catch (e) {
      evalLog('EVAL_OTP_SEND_FAIL', 'Verifica OTP fallita per errore di rete.', { email: LeadData.clientEmail });
      appendBotInstant('OTP VERIFICATION FAILED. RETRY.');
      unlockInput();
    }
  }

  async function callPingLink(url) {
    appendBotInstant('CYBER-AUDIT IN PROGRESS: ' + url, 'sys-log-temp');
    try {
      const data = await callBackend({ action: 'PING_LINK', url });
      if (data.isValid === true) {
        const bypassNote = data.bypass ? ' SOCIAL BYPASS: OK' : ' HTTP ' + (data.httpCode || '200');
        appendBotInstant('PING: SOURCE VERIFIED.' + bypassNote + '.', 'sys-log-temp');
        setTimeout(() => {
          document.querySelectorAll('.sys-log-temp').forEach(node => node.remove());
          currentStep = 1.3;
          injectInputPrompt('PHONE CONTACT: (e.g. +39 333 123 4567)');
        }, 400);
      } else {
        linkErrorCount++;
        if (linkErrorCount >= 2) {
          evalLog('EVAL_LINK_BANNED', 'Link non raggiungibile dopo 2 tentativi. Banishment.', { url: LeadData.socialLink });
          triggerBanishment('UNREACHABLE_SOURCE. DIGITAL IDENTITY UNVERIFIABLE. ACCESS DENIED.');
        } else {
          evalLog('EVAL_LINK_UNREACHABLE', 'Link non raggiungibile (1° tentativo).', { url: LeadData.socialLink });
          appendBotInstant('UNREACHABLE_SOURCE. LAST ATTEMPT GRANTED. RE-ENTER VALID LINK.');
          setTimeout(() => {
            autoDeployOracle(
              '<span style="color:#9DB97E;">PROACTIVE ASSIST:</span><br><br>' +
              'Rilevata difficolt\u00e0 nella validazione del Cyber-Audit.<br><br>' +
              'Il terminale richiede un URL assoluto. Assicurati di includere <strong>https://</strong> all\'inizio del link<br>' +
              '(es. <em>https://instagram.com/tuonome</em>).<br><br>' +
              'Correggi l\'input nella barra sottostante e riprova.'
            );
            injectInputPrompt('WEBSITE/SOCIAL LINK: (e.g. https://instagram.com/yourbrand or www.yourwebsite.com)');
          }, 600);
          unlockInput();
        }
      }
    } catch (e) {
      evalLog('EVAL_LINK_UNREACHABLE', 'Ping link fallito per errore di rete.', { url: LeadData.socialLink });
      appendBotInstant('PING FAILED. RE-ENTER LINK.');
      unlockInput();
    }
  }

  async function callGeminiAssist(step, userInput) {
    const processingBubble = createBotRow();
    processingBubble.textContent = 'PROCESSING...';
    try {
      const data = await callBackend({
        action: 'GEMINI_ASSIST',
        step: step,
        userInput: userInput
      });
      processingBubble.textContent = '';
      if (data.status === 'success' && data.reply) {
        processingBubble.textContent = data.reply;
      } else {
        processingBubble.textContent = 'ERROR RETRIEVING SERVER RESPONSE. ADHERE TO PROTOCOL.';
      }
    } catch (e) {
      evalLog('EVAL_ASSIST_FAIL', 'callGeminiAssist fallito per errore di rete.');
      processingBubble.textContent = 'NETWORK ERROR. ADHERE TO PROTOCOL.';
    }
    scrollToBottom();
    unlockInput();
  }

  function autoDeployOracle(htmlMessage) {
    if (isOracleLocked) return;
    const out = document.getElementById('sys-oracle-output');
    if (!out) return;
    if (!isOracleOpen) {
      isOracleOpen = true;
      oracleSidebar.style.right = '0px';
      oracleBtn.classList.add('sys-oracle-trigger--active');
      oracleBtn.innerHTML = SVG_CLOSE;
      out.innerHTML = '';
    }
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'opacity: 0; transition: opacity 0.4s ease;';
    msgDiv.innerHTML = htmlMessage;
    out.appendChild(msgDiv);
    out.scrollTop = out.scrollHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { msgDiv.style.opacity = '1'; });
    });
  }

  function appendOracleMessage(text, isUser = false) {
    const out = document.getElementById('sys-oracle-output');
    if (!out) return;
    const msg = document.createElement('div');
    msg.style.opacity = '1';
    if (isUser) {
      msg.textContent = `USER_QUERY >> ${text}`;
      msg.style.opacity = '0.7';
      out.appendChild(msg);
      out.scrollTop = out.scrollHeight;
    } else {
      out.appendChild(msg);
      out.scrollTop = out.scrollHeight;
      typeText(msg, text, 0, () => { out.scrollTop = out.scrollHeight; });
    }
  }

  async function callOracleSupport(userQuery) {
    appendOracleMessage(userQuery, true);
    const processingMsg = document.createElement('div');
    processingMsg.textContent = 'PROCESSING QUERY...';
    const out = document.getElementById('sys-oracle-output');
    out.appendChild(processingMsg);
    out.scrollTop = out.scrollHeight;

    try {
      const data = await callBackend({
        action: 'ORACLE_SUPPORT',
        userInput: userQuery,
        glossaryContext: SITOSS_GLOSSARY,
        step: currentStep,
        leadData: LeadData
      });
      if (processingMsg.parentNode) out.removeChild(processingMsg);

      if (data && data.status === 'success' && data.data) {
        if (data.data.is_annoying === true || data.data.is_annoying === "true") {
          appendOracleMessage("UNAUTHORIZED QUERY. LOCKDOWN INITIATED.");
          setTimeout(() => {
            isOracleLocked = true;
            oracleSidebar.style.transition = 'none';
            oracleSidebar.classList.add('sys-oracle-glitch');
            setTimeout(() => {
              isOracleOpen = false;
              oracleSidebar.style.right = '-800px';
              oracleSidebar.classList.remove('sys-oracle-glitch');
              oracleSidebar.style.transition = 'right 0.3s ease';
              oracleBtn.classList.remove('sys-oracle-trigger--active');
            }, 300);
            oracleBtn.classList.add('sys-oracle-locked');
            oracleBtn.style.pointerEvents = 'none';
            let countdown = 30;
            oracleBtn.style.fontSize = '12px';
            oracleBtn.innerHTML = `${countdown}s`;
            appendBotInstant("USER ACCESS TO ORACLE RESTRICTED DUE TO PROTOCOL VIOLATION. WAIT FOR RE-CALIBRATION.");
            const lockInterval = setInterval(() => {
              countdown--;
              if (countdown > 0) {
                oracleBtn.innerHTML = `${countdown}s`;
              } else {
                clearInterval(lockInterval);
                isOracleLocked = false;
                oracleBtn.classList.remove('sys-oracle-locked');
                oracleBtn.style.pointerEvents = 'auto';
                oracleBtn.style.fontSize = '20px';
                oracleBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
              }
            }, 1000);
          }, 1000);
        } else {
          appendOracleMessage(data.data.reply || "RESPONSE EMPTY.");
        }
      } else {
        appendOracleMessage("ORACLE OFFLINE.");
      }
    } catch (e) {
      if (processingMsg.parentNode) out.removeChild(processingMsg);
      evalLog('EVAL_ORACLE_FAIL', 'callOracleSupport fallito per errore di rete.');
      appendOracleMessage("ORACLE CONNECTION FAILED.");
    }
  }

  async function callGeminiEvaluate() {
    try {
      const data = await callBackend({ action: 'GEMINI_EVALUATE', leadData: LeadData });
      if (data.status === 'error') {
        if (data.message === 'OVERLOAD') {
          evalLog('EVAL_AI_OVERLOAD', 'Modulo evaluation sovraccarico. Retry richiesto.');
          appendBotInstant('EVALUATION MODULE OVERLOADED. RETRY IN 60 SECONDS.');
          currentStep = 7;
          unlockInput();
          return;
        }
        evalLog('EVAL_AI_NETWORK_FAIL', 'GEMINI_EVALUATE ha restituito errore: ' + (data.message || 'UNKNOWN'));
        appendBotInstant((data.message || 'UNKNOWN'));
        return;
      }
      const verdict = data.verdict || {};
      if (verdict.is_banned === true) {
        appendBotInstant('EVALUATION: REJECTED.');
        const rejectionReason = verdict.error_code || 'UNKNOWN';
        evalLog('EVAL_BANISHMENT', 'Lead bannato dalla valutazione AI.', { reason: rejectionReason, clientType: LeadData.clientType });
        LeadData.chatLog = sysChatTranscript.join('\n');
        callBackend({ action: 'SAVE_REJECTED', leadData: LeadData, reason: rejectionReason }).catch(() => { });
        setTimeout(() => triggerBanishment(rejectionReason), 800);
      } else {
        approvedSequence();
      }
    } catch (e) {
      evalLog('EVAL_AI_NETWORK_FAIL', 'callGeminiEvaluate fallito per errore di rete: ' + e.toString().substring(0,100));
      appendBotInstant('UNABLE TO COMPLETE EVALUATION. CONTACT VIA EMAIL.');
    }
  }

  function showFinalModal(isGranted, errorCode = null) {
    const backdrop = document.getElementById('sys-final-modal-backdrop');
    const modal = document.getElementById('sys-final-modal');
    const iconContainer = document.getElementById('sys-modal-icon-container');
    if (!backdrop || !modal || !iconContainer) return;

    Array.from(modal.children).forEach(child => {
      if (child.id !== 'sys-modal-icon-container') { child.remove(); }
    });

    backdrop.style.display = 'flex';
    modal.style.animation = 'sysModalSnap 150ms ease-out forwards';

    const titleEl = document.createElement('h2');
    titleEl.style.fontWeight = 'normal';
    titleEl.style.fontSize = '1.2rem';
    titleEl.style.marginBottom = '1rem';
    titleEl.style.letterSpacing = '0.05em';
    titleEl.style.color = 'var(--text-secondary)';

    const bodyEl = document.createElement('p');
    bodyEl.className = 'sys-modal-desc';

    if (isGranted) {
      iconContainer.innerHTML = SVG_GRANTED;
      iconContainer.className = 'sys-modal-icon sys-modal-icon--granted';
      titleEl.textContent = 'Access allowed...';
      bodyEl.textContent = 'Data acquisition successfully finalized. Upon acceptance, you will be contacted via email within 14-18 business days.';
      bodyEl.style.color = 'rgba(157, 185, 126, 0.8)';
    } else {
      iconContainer.innerHTML = SVG_DENIED;
      iconContainer.className = 'sys-modal-icon sys-modal-icon--denied';
      titleEl.textContent = 'Access denied...';
      let specificText = "Architectural requirements not satisfied.";
      const errorMap = {
        "BUDGET_TOO_LOW": "Allocated budget is structurally incompatible with the requested project scope.",
        "MISSING_CRITICAL_DATA": "Essential data required for feasibility analysis is missing or invalid.",
        "MISSING_COMPANY_LINK": "A verifiable corporate digital footprint (URL/Social) is mandatory for this entity type.",
        "INSUFFICIENT_PROJECT_DATA": "Project brief is vague, non-professional, or lacks minimum technical specifications.",
        "SCOPE_OVERSATURATION": "Requested volume of assets exceeds the mathematical limits of the selected budget tier.",
        "NON_COMMERCIAL_INTENT": "System restricted to commercial projects. Parasitic or non-commercial intent detected.",
        "INCOMPLETE_APPLICATION": "Provided parameters fail to meet the minimum required completeness threshold. Project unprocessable.",
        "VAGUE_PROJECT_SCOPE": "Project brief lacks required technical density. System does not perform speculative work without clear directives.",
        "ARCHITECTURAL_MISMATCH": "Critical logical inconsistency detected between selected scope and requested outputs. Architectural mismatch.",
        "POLICY_VIOLATION_UNAUTHORIZED_BEHAVIOR": "Strict protocol violation. Toxic language, trolling, or unauthorized system bypass attempts detected."
      };
      if (errorCode && errorMap[errorCode]) {
        specificText = errorMap[errorCode];
      } else if (errorCode && errorCode !== 'UNKNOWN') {
        specificText = errorCode;
      }
      bodyEl.textContent = `The provided parameters do not meet the required threshold. ${specificText} Session will terminate in 10 seconds.`;
      bodyEl.style.color = 'rgba(255, 51, 51, 0.8)';
    }

    modal.appendChild(titleEl);
    modal.appendChild(bodyEl);

    isEvaluationComplete = true;
    window.isEvaluationComplete = true;

    setTimeout(() => {
      localStorage.setItem('sitoss_status', 'verification');
      document.body.style.transition = 'opacity 0.5s ease-out';
      document.body.style.opacity = '0';
      setTimeout(() => { window.location.href = 'index.html'; }, 500);
    }, 4500);
  }

  async function approvedSequence() {
    updateStatusBar('allowed');
    lockInput(true);
    if (uploadBtn) uploadBtn.style.display = 'none';
    try {
      LeadData.chatLog = sysChatTranscript.join('\n');
      LeadData.assetsBase64 = await filesToBase64(LeadData.finalFiles || []);
      const response = await callBackend({ action: 'SAVE_TO_SHEET', leadData: LeadData });
      if (response && response.status === 'saved') {
        showFinalModal(true);
      } else {
        evalLog('EVAL_SAVE_FAIL', 'SAVE_TO_SHEET ha restituito status non valido: ' + JSON.stringify(response).substring(0,100));
        appendBotInstant('DATA SAVE FAILED. CONTACT SUPPORT.');
      }
    } catch (e) {
      evalLog('EVAL_SAVE_FAIL', 'approvedSequence fallito per errore di rete: ' + e.toString().substring(0,100));
      appendBotInstant('DATA TRANSMISSION FAILED.');
    }
  }

  function triggerBanishment(errorCode) {
    lockInput(true);
    updateStatusBar('denied');
    if (uploadBtn) uploadBtn.style.display = 'none';
    showFinalModal(false, errorCode);
  }

  function handleFileUpload(e) {
    if (!e.target.files || !e.target.files.length) return;
    validaEInserisciFile(Array.from(e.target.files));
    e.target.value = '';
  }

  function validaEInserisciFile(filesArray) {
    let currentTotalBytes = pendingFiles.reduce((acc, f) => acc + f.size, 0);
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        alert(`FORMATO NON SUPPORTATO (${file.name}). USA SOLO JPG, PNG, WEBP O PDF.`);
        continue;
      }
      if (pendingFiles.length >= 10) {
        appendBotInstant('MAXIMUM 10 FILES ALLOWED.', 'sys-log-temp');
        setTimeout(() => document.querySelectorAll('.sys-log-temp').forEach(n => n.remove()), 2500);
        break;
      }
      if (currentTotalBytes + file.size > MAX_PAYLOAD_BYTES) {
        alert(`LIMITE PAYLOAD SUPERATO. MASSIMO ${MAX_PAYLOAD_MB}MB TOTALI CONSENTITI.`);
        break;
      }
      pendingFiles.push(file);
      currentTotalBytes += file.size;
    }
    renderStagingArea();
  }

  function renderStagingArea() {
    if (!stagingArea) return;
    stagingArea.innerHTML = '';
    if (pendingFiles.length === 0) {
      stagingArea.style.display = 'none';
    } else {
      stagingArea.style.display = 'flex';
      pendingFiles.forEach((file, index) => {
        const container = document.createElement('div');
        container.className = 'sys-thumb-container';
        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.className = 'sys-thumb-img';
          img.src = URL.createObjectURL(file);
          container.appendChild(img);
        } else {
          const doc = document.createElement('div');
          doc.className = 'sys-thumb-doc';
          doc.textContent = file.name.substring(0, 3) + '..';
          container.appendChild(doc);
        }
        const btn = document.createElement('button');
        btn.className = 'sys-thumb-remove';
        btn.textContent = 'X';
        btn.addEventListener('click', () => {
          pendingFiles.splice(index, 1);
          renderStagingArea();
        });
        container.appendChild(btn);
        stagingArea.appendChild(container);
      });
    }
    autoResizeInput();
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  // -----------------------------------------------------------
  // BASE64 ENCODER & FINALIZATION
  // -----------------------------------------------------------
  function filesToBase64(fileArray) {
    if (!fileArray || fileArray.length === 0) {
      return Promise.resolve([]);
    }

    const promises = fileArray.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const base64Raw = dataUrl.split(',')[1] || '';
        resolve({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: base64Raw
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }));

    return Promise.all(promises).then(results => results.filter(Boolean));
  }

  // INIZIALIZZAZIONE UNICA E DEFINITIVA
  init();

  // -----------------------------------------------------------
  // ANTI-REFRESH SHIELD
  // -----------------------------------------------------------
  window.addEventListener('beforeunload', function (e) {
    if (currentStep > 0 && !window.isEvaluationComplete) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

})();
