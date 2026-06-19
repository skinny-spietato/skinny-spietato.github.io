// =============================================================
// SITOSS NODEBETAV1.0.0 — access-state.js
// GLOBAL STATE MANAGER & PUNISHMENT PROTOCOL
// =============================================================

(function () {
    'use strict';

    const statusLabels = {
        'verification': 'STATUS: UNDER REVIEW',
        'request':      'STATUS: ACCESS REQUEST',
        'verified':     'STATUS: IDENTITY VERIFIED',
        'denied':       'STATUS: ACCESS DENIED',
        'allowed':      'STATUS: ACCESS ALLOWED'
    };

    let currentStatus = localStorage.getItem('sitoss_status');
    
    // Se non esiste, o è non valido (e non è 'punished'), inizializza a verification
    if (!currentStatus || (!statusLabels[currentStatus] && currentStatus !== 'punished')) {
        currentStatus = 'verification';
        localStorage.setItem('sitoss_status', currentStatus);
    }

    function renderStatus(statusKey) {
        const accessBar = document.getElementById('sys-access-bar');
        const statusText = document.getElementById('sys-status-text');
        
        // Mappa visivamente 'punished' su 'denied' per innescare estetica e testo rosso
        const visualStatus = (statusKey === 'punished') ? 'denied' : statusKey;

        if (accessBar) {
            accessBar.setAttribute('data-status', visualStatus);
        }
        if (statusText) {
            const label = statusLabels[visualStatus] || statusLabels['verification'];
            statusText.innerHTML = label + '<span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span><span class="dot" aria-hidden="true">.</span>';
        }
    }

    function initAccessBar() {
        const page = document.body.getAttribute('data-page');

        // 1. Esecuzione Punizione (Ghost State)
        if (currentStatus === 'punished') {
            renderStatus('punished'); // Mostra ACCESS DENIED
            
            // Dopo 2 secondi, degrada a UNDER REVIEW
            setTimeout(() => {
                currentStatus = 'verification';
                localStorage.setItem('sitoss_status', currentStatus);
                renderStatus(currentStatus);
            }, 2000);
        } 
        // 2. Entry Guard Standard (se sei fuori dalla chat e hai clearance, perdi tutto subito)
        else if (page !== 'evaluation' && currentStatus !== 'verification') {
            currentStatus = 'verification';
            localStorage.setItem('sitoss_status', currentStatus);
            renderStatus(currentStatus);
        } 
        // 3. Render Normale
        else {
            renderStatus(currentStatus);
        }

        // 4. Intercettazione Fuga (Imposta il marchio d'infamia prima che la pagina muoia)
        if (page === 'evaluation') {
            window.addEventListener('beforeunload', () => {
                if (window.isEvaluationComplete) return; // Bypass protocol from Step 8

                const statusBeforeExit = localStorage.getItem('sitoss_status');
                if (['request', 'verified', 'allowed'].includes(statusBeforeExit)) {
                    localStorage.setItem('sitoss_status', 'punished');
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccessBar);
    } else {
        initAccessBar();
    }
})();
