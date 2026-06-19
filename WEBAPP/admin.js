// =========================================================================
// SITOSS NODEBETAV1.0.0 — admin.js
// SS-COMMAND-CENTER // MOTORE LOGICO DI SISTEMA
// =========================================================================
// LIVELLO AUTORIZZAZIONE: 0 (ACCESSO MASTER)
// ARCHITETTURA: ROUTER FETCH ASINCRONO
// =========================================================================  

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzqvVJ7mJhJz2ZemAxTl1puBVvivAQ1Ld0ogGIL7_9gdhd9e5dCsugLXGQ3htqNe7z9Gw/exec";

// [STATO DI SISTEMA] - Memoria volatile
let masterPassword = "";
let dashboardData = {};
let selectedInstance = null;
let currentDraftData = null; // [Two-Step PDF Mod 1C] - stato draft corrente
let currentSortMode = 'chrono_desc'; // Stato di ordinamento liste

// =========================================================================
// [SEQUENZA DI AVVIO] - Inizializzazione DOM
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    collegaSensori();
});

// =========================================================================
// [MODULI CORE] - Funzioni Base
// =========================================================================

/**
 * Assegna i listener agli elementi strutturali dell'interfaccia.
 */
function collegaSensori() {
    // --- Autenticazione ---
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) loginBtn.addEventListener('click', gestisciLogin);
    
    const passInput = document.getElementById('sys-master-pass');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') gestisciLogin();
        });
    }

    // --- Modale Preventivo: chiusura ---
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('sys-proposal-modal').style.display = 'none';
            selectedInstance = null;
            currentDraftData = null;
        });
    }

    // --- Two-Step PDF [Mod 1C] ---
    const draftBtn = document.getElementById('btn-generate-draft');
    if (draftBtn) draftBtn.addEventListener('click', eseguiGeneraDraft);

    const approveBtn = document.getElementById('btn-approve-send');
    if (approveBtn) approveBtn.addEventListener('click', eseguiApprovaEInvia);

    // --- Asset Builder [Mod 1A] ---
    const addAssetBtn = document.getElementById('btn-add-asset');
    if (addAssetBtn) addAssetBtn.addEventListener('click', aggiungiAsset);

    // --- Financial Override live display [Mod 1B] ---
    const priceInput = document.getElementById('input-price');
    const overrideSelect = document.getElementById('override-acconto');
    if (priceInput) priceInput.addEventListener('input', aggiornCalcDisplay);
    if (overrideSelect) overrideSelect.addEventListener('change', aggiornCalcDisplay);

    // --- Search Bar Globale e Sorting [Mod 3A/4A] ---
    const searchInput = document.getElementById('sys-global-search');
    const sortBtn = document.getElementById('btn-sort-list');
    if (searchInput) searchInput.addEventListener('input', (e) => filtraTabelle(e.target.value));
    if (sortBtn) sortBtn.addEventListener('click', handleSortToggle);

    // --- Router Tab ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(v => v.style.display = 'none');
            const targetView = document.getElementById(e.target.getAttribute('data-target'));
            if (targetView) targetView.style.display = 'block';
            const s = document.getElementById('sys-global-search');
            if (s) { s.value = ''; filtraTabelle(''); }
        });
    });

    // --- Accordion Ispezione ---
    document.querySelectorAll('.inspect-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            const icon = header.querySelector('.inspect-toggle-icon');
            if (!body) return;
            if (body.style.display === 'none') { body.style.display = 'block'; if (icon) icon.textContent = '-'; }
            else { body.style.display = 'none'; if (icon) icon.textContent = '+'; }
        });
    });

    // --- Note Interne CRM [Mod 2A] ---
    const updateNotesBtn = document.getElementById('btn-update-notes');
    if (updateNotesBtn) updateNotesBtn.addEventListener('click', aggiornaNoteInterne);

    // --- Custom Alert Overlay [Mod 3C] ---
    const cancelBtn = document.getElementById('sys-alert-cancel');
    const confirmBtn = document.getElementById('sys-alert-confirm');
    if (cancelBtn) cancelBtn.addEventListener('click', _sysAlertCancel);
    if (confirmBtn) confirmBtn.addEventListener('click', _sysAlertConfirm);

    // --- SYSTEM BROADCAST [Slide 2] ---
    const bGlobalToggle = document.getElementById('broadcast-global-toggle');
    const bSubject = document.getElementById('broadcast-subject');
    const bBody = document.getElementById('broadcast-body');
    const bBlacklist = document.getElementById('broadcast-blacklist');
    const bExecuteBtn = document.getElementById('btn-execute-broadcast');
    
    if (bGlobalToggle) bGlobalToggle.addEventListener('change', () => {
        // Attiva/disattiva i filtri in base al toggle
        const isGlobal = bGlobalToggle.checked;
        const filterBudget = document.getElementById('broadcast-filter-budget');
        const filterType   = document.getElementById('broadcast-filter-type');
        if (filterBudget) filterBudget.disabled = isGlobal;
        if (filterType)   filterType.disabled   = isGlobal;
        calcolaNodiRiceventi();
    });
    if (bBlacklist) bBlacklist.addEventListener('input', calcolaNodiRiceventi);
    if (bSubject)   bSubject.addEventListener('input', preparaInnesco);
    if (bBody)      bBody.addEventListener('input', preparaInnesco);
    if (bExecuteBtn) bExecuteBtn.addEventListener('click', eseguiBroadcastGlobale);

    // Filtri avanzati
    const filterBudget = document.getElementById('broadcast-filter-budget');
    const filterType   = document.getElementById('broadcast-filter-type');
    if (filterBudget) filterBudget.addEventListener('change', calcolaNodiRiceventi);
    if (filterType)   filterType.addEventListener('change', calcolaNodiRiceventi);

    // Scheduler buttons
    const btnSaveSchedule  = document.getElementById('btn-save-schedule');
    const btnClearSchedule = document.getElementById('btn-clear-schedule');
    if (btnSaveSchedule)  btnSaveSchedule.addEventListener('click', salvaSchedulazione);
    if (btnClearSchedule) btnClearSchedule.addEventListener('click', rimuoviSchedulazione);

    // Vault toggle
    const btnVaultToggle = document.getElementById('btn-vault-toggle');
    if (btnVaultToggle) {
        btnVaultToggle.addEventListener('click', () => {
            if (btnVaultToggle.classList.contains('sys-state-blacklist')) {
                btnVaultToggle.classList.remove('sys-state-blacklist');
                btnVaultToggle.classList.add('sys-state-whitelist');
                btnVaultToggle.textContent = 'WHITELIST';
            } else {
                btnVaultToggle.classList.remove('sys-state-whitelist');
                btnVaultToggle.classList.add('sys-state-blacklist');
                btnVaultToggle.textContent = 'BLACKLIST';
            }
            calcolaNodiRiceventi();
        });
    }

    // --- ARCHIVIO [Slide 4] ---
    const tabBtnsArchivio = document.querySelectorAll('.tab-btn-archivio');
    tabBtnsArchivio.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtnsArchivio.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('#area-archivio .sys-sub-view').forEach(v => v.style.display = 'none');
            const targetView = document.getElementById(e.target.getAttribute('data-target'));
            if (targetView) targetView.style.display = 'block';
        });
    });

    const searchUser = document.getElementById('sys-user-search');
    if (searchUser) {
        // Filtro live sulla lista utenti mentre si digita
        searchUser.addEventListener('input', (e) => {
            filtraListaUtenti(e.target.value.trim());
        });
        // Invio: apre il dossier del primo risultato visibile
        searchUser.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchUser.value.trim();
                if (!query) return;
                // Se c'è un solo risultato visibile, aprilo direttamente
                const visibleRows = document.querySelectorAll('.utenti-list-row:not([style*="display: none"])');
                if (visibleRows.length === 1) {
                    visibleRows[0].click();
                } else {
                    apriDossierUtente(query);
                }
            }
        });
    }

    const btnGdpr = document.getElementById('btn-gdpr-purge');
    if (btnGdpr) {
        btnGdpr.addEventListener('click', () => {
            const email = document.getElementById('dossier-email').textContent.trim();
            sysConfirm(
                `⚠️ PROTOCOLLO OBLIO GDPR\n\nSei in procinto di cancellare IRRIMEDIABILMENTE l'entità:\n${email}\n\nTutte le istanze collegate verranno rimosse da REQUESTS e FINANCE.\nL'azione è irreversibile.`,
                async (confirmed) => {
                    if (!confirmed) return;
                    const res = await sendToBackend('ADMIN_PURGE_USER', { email });
                    if (res && !res.error) {
                        sysAlert(`[PROTOCOLLO OBLIO ESEGUITO] Entità ${email} purificata dal database.`, '🧹');
                        sysLog(`[ERR] PROTOCOLLO OBLIO GDPR: Entità ${email} eliminata (${res.deletedFromRequests || 0} REQUESTS, ${res.deletedFromFinance || 0} FINANCE).`, 'ERR');
                        document.getElementById('user-dossier-panel').style.display = 'none';
                        if (searchUser) searchUser.value = '';
                        await ricaricaDashboard();
                    } else {
                        sysAlert('[ERRORE GDPR]: ' + (res?.error || 'Purge fallito.'));
                    }
                }, 'danger', '🧹'
            );
        });
    }

    // L'archivio mensile viene inizializzato DOPO il login (quando dashboardData è disponibile)
    // renderArchivioMensile() viene chiamata da renderTables()

    // --- REPORT ERRORI [Slide 5] ---
    const tabBtnsErrori = document.querySelectorAll('.tab-btn-errori');
    tabBtnsErrori.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtnsErrori.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('#area-errori .sys-sub-view').forEach(v => v.style.display = 'none');
            const targetView = document.getElementById(e.target.getAttribute('data-target'));
            if (targetView) targetView.style.display = 'block';
        });
    });

    const btnRefreshLogs = document.getElementById('btn-refresh-logs');
    if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener('click', async () => {
            btnRefreshLogs.textContent = '↻ CARICAMENTO...';
            btnRefreshLogs.disabled = true;
            const res = await sendToBackend('ADMIN_GET_LOGS', { limit: 200 });
            btnRefreshLogs.textContent = '↻ AGGIORNA LOG';
            btnRefreshLogs.disabled = false;
            if (res && !res.error) {
                renderNetworkLogs(res.logs || []);
                sysLog(`[NET] Log email ricaricati manualmente. ${(res.logs || []).length} record.`, 'NET');
            } else {
                sysLog(`[ERR] Impossibile caricare i log email: ${res?.error || 'UNKNOWN'}`, 'ERR');
            }
        });
    }

    const btnRefreshBlackbox = document.getElementById('btn-refresh-blackbox');
    if (btnRefreshBlackbox) {
        btnRefreshBlackbox.addEventListener('click', async () => {
            btnRefreshBlackbox.textContent = '↻ CARICAMENTO...';
            btnRefreshBlackbox.disabled = true;
            const res = await sendToBackend('ADMIN_GET_SYSTEM_LOGS', { limit: 200 });
            btnRefreshBlackbox.textContent = '↻ AGGIORNA';
            btnRefreshBlackbox.disabled = false;
            if (res && !res.error) {
                renderBlackBox(res.systemLogs || []);
            } else {
                sysLog(`[ERR] Impossibile caricare i log sistema: ${res?.warning || res?.error || 'UNKNOWN'}`, 'ERR');
            }
        });
    }
}

// =========================================================================
// [MODULO RETE] - Interfaccia di Comunicazione GAS
// =========================================================================

/**
 * Trasmette payload criptati al backend Google Apps Script.
 * @param {string} action - Comando operativo.
 * @param {object} dataObj - Dati json in uscita.
 */
async function sendToBackend(action, dataObj = {}) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: action,
                password: masterPassword,
                data: dataObj
            })
        });

        // Defensive parsing: intercetta risposte HTML/malformate (es. errore 500 Google)
        const rawText = await response.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (parseErr) {
            console.error("[ERRORE CRITICO] Risposta server non JSON:", rawText);
            if (typeof sysToast === 'function') sysToast("[NETWORK_ERROR] Impossibile contattare il server. (Risposta malformata)");
            return { error: "MALFORMED_SERVER_RESPONSE" };
        }

        // Intercettazione unificata: sia la chiave 'error' che status: "error"
        if (result.error || result.status === "error") {
            const errMsg = result.error || result.message || "UNKNOWN_ERROR";
            console.error("[ERRORE DI SISTEMA] Fallimento Operazione:", errMsg);
            
            if (errMsg === "SYSTEM_OFFLINE_CRITICAL") {
                const banner = document.getElementById('sys-panic-banner');
                if (banner) banner.style.display = 'block';
                if (typeof sysNotify === 'function') sysNotify("ERRORE CRITICO SISTEMA", { body: "Il Core AI è offline o non raggiungibile." });
            }
            
            return { error: errMsg };
        }

        return result;
    } catch (err) {
        console.error("[ERRORE CRITICO] Eccezione di rete:", err);
        if (typeof sysToast === 'function') sysToast("[NETWORK_ERROR] Impossibile contattare il server.");
        return { error: "NETWORK_FAILURE" };
    }
}


// =========================================================================
// [LOGICA OPERATIVA] - Esecuzione Comandi
// =========================================================================

/**
 * Intercetta e valida l'override di sistema (Login).
 */
async function gestisciLogin() {
    const passInput = document.getElementById('sys-master-pass');
    const tentataPassword = passInput.value.trim();

    if (!tentataPassword) {
        sysAlert("[AVVISO DI SISTEMA] Inserire Chiave Master.");
        return;
    }

    masterPassword = tentataPassword;

    // Blocco interfaccia
    const loginBtn = document.getElementById('btn-login');
    const testoOriginale = loginBtn.innerText;
    loginBtn.innerText = "AUTENTICAZIONE IN CORSO...";
    loginBtn.disabled = true;

    const res = await sendToBackend('ADMIN_GET_DASHBOARD', {});

    if (res && res.error) {
        sysAlert("[ACCESSO NEGATO] Chiave non valida.", '🔐');
        masterPassword = "";
    } else if (res) {
        // Accesso Concesso
        document.getElementById('sys-login-view').style.display = 'none';
        const viewport = document.getElementById('sys-matrix-viewport');
        viewport.style.display = 'block';
        viewport.scrollLeft = 0; // Forza lo scorrimento all'inizio (Slide 1)
        dashboardData = res;
        renderTables();
        if (typeof calcolaNodiRiceventi === 'function') calcolaNodiRiceventi();

        // Carica Network Logs (LOG_EMAIL), Black Box (LOG_SYSTEM) e config scheduler in parallelo
        Promise.all([
            sendToBackend('ADMIN_GET_LOGS',            { limit: 200 }),
            sendToBackend('ADMIN_GET_SYSTEM_LOGS',     { limit: 200 }),
            sendToBackend('ADMIN_GET_BROADCAST_CONFIG', {})
        ]).then(([logsRes, sysLogsRes, schedRes]) => {
            // Network Logs
            if (logsRes && !logsRes.error) {
                renderNetworkLogs(logsRes.logs || []);
            }
            // Black Box — dati persistenti da LOG_SYSTEM
            if (sysLogsRes && !sysLogsRes.error) {
                renderBlackBox(sysLogsRes.systemLogs || []);
            } else {
                sysLog(`[WARN] Log sistema non disponibili: ${sysLogsRes?.warning || 'UNKNOWN'}`, 'WARN');
            }
            // Scheduler config
            if (schedRes && schedRes.config) {
                const { freq, triggers, draftSubject, draftBody } = schedRes.config;
                const freqSel = document.getElementById('broadcast-schedule-freq');
                if (freqSel && freq) freqSel.value = freq;
                const trigSel = document.getElementById('broadcast-trigger-event');
                if (trigSel && triggers) {
                    Array.from(trigSel.options).forEach(opt => { opt.selected = triggers.includes(opt.value); });
                }
                const subEl = document.getElementById('broadcast-subject');
                const bodEl = document.getElementById('broadcast-body');
                if (subEl && !subEl.value && draftSubject) subEl.value = draftSubject;
                if (bodEl && !bodEl.value && draftBody)    bodEl.value = draftBody;
                aggiornaScheduleStatusUI(freq, triggers);
                preparaInnesco();
            }
        });

        // --- PWA NOTIFICATIONS SETUP ---
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
        if (typeof setupBackgroundPolling === 'function') setupBackgroundPolling();
    }

    // Ripristino bottone
    loginBtn.innerText = testoOriginale;
    loginBtn.disabled = false;
}

/**
 * Ricarica i dati dalla matrice e aggiorna il DOM.
 */
async function ricaricaDashboard() {
    const res = await sendToBackend('ADMIN_GET_DASHBOARD', {});
    if (res && !res.error) {
        dashboardData = res;
        renderTables();
        if (typeof calcolaNodiRiceventi === 'function') calcolaNodiRiceventi();
    }
}

// =========================================================================
// [MOTORE DI RENDERING] - Popolamento Matrici
// =========================================================================

function renderTables() {
    dashboardData.pending = sortDataArray(dashboardData.pending);
    dashboardData.waiting = sortDataArray(dashboardData.waiting);
    dashboardData.active = sortDataArray(dashboardData.active);
    dashboardData.rejected = sortDataArray(dashboardData.rejected);
    dashboardData.completed = sortDataArray(dashboardData.completed);
    dashboardData.frozen = sortDataArray(dashboardData.frozen);

    renderTabellaDaPreventivare();
    renderTabellaInAttesa();
    renderTabellaAttivi();
    renderTabellaRifiutati();
    renderTabellaCompletati();
    renderTabellaCongelati();

    // Aggiorna l'HUD analitico
    aggiornaWidgetAnalitici(dashboardData);

    // Aggiorna il Ledger Mensile con i dati reali
    renderArchivioMensile();

    // Aggiorna la lista utenti (tab UTENTI)
    renderListaUtenti();
}

// --- Funzioni di Ordinamento (Mod 4A) ---
function sortDataArray(arr) {
    if (!arr || !Array.isArray(arr)) return [];
    
    arr.sort((a, b) => {
        if (currentSortMode === 'chrono_desc') {
            return new Date(b.timestamp) - new Date(a.timestamp);
        } else if (currentSortMode === 'chrono_asc') {
            return new Date(a.timestamp) - new Date(b.timestamp);
        } else if (currentSortMode === 'alpha_asc') {
            const nameA = (a.clientName || '').toLowerCase();
            const nameB = (b.clientName || '').toLowerCase();
            return nameA.localeCompare(nameB);
        } else if (currentSortMode === 'alpha_desc') {
            const nameA = (a.clientName || '').toLowerCase();
            const nameB = (b.clientName || '').toLowerCase();
            return nameB.localeCompare(nameA);
        }
        return 0;
    });
    return arr;
}

function handleSortToggle() {
    const btn = document.getElementById('btn-sort-list');
    if (!btn) return;
    
    if (currentSortMode === 'chrono_desc') {
        currentSortMode = 'chrono_asc';
        btn.title = 'ORDINE: CRONOLOGICO (PIÙ VECCHI)';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9M4 12h7M4 18h5M15 9l3-3 3 3M18 6v12"/></svg>`;
    } else if (currentSortMode === 'chrono_asc') {
        currentSortMode = 'alpha_asc';
        btn.title = 'ORDINE: ALFABETICO (A-Z)';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h5M4 12h7M4 18h9M15 9l3-3 3 3M18 6v12"/></svg>`;
    } else if (currentSortMode === 'alpha_asc') {
        currentSortMode = 'alpha_desc';
        btn.title = 'ORDINE: ALFABETICO (Z-A)';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h5M4 12h7M4 18h9M15 15l3 3 3-3M18 6v12"/></svg>`;
    } else {
        currentSortMode = 'chrono_desc';
        btn.title = 'ORDINE: CRONOLOGICO (PIÙ RECENTI)';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9M4 12h7M4 18h5M15 15l3 3 3-3M18 6v12"/></svg>`;
    }
    
    renderTables();
    
    const searchInput = document.getElementById('sys-global-search');
    if (searchInput && searchInput.value) {
        filtraTabelle(searchInput.value);
    }
}

/**
 * Aggiorna i widget dell'HUD analitico (Mod V6 - Apple Green)
 */
function aggiornaWidgetAnalitici(data) {
    if (!data) return;

    // Helper interno: Estrattore sicuro di valori monetari numerici (gestisce separatori IT e ISO)
    const parseMoney = (val) => {
        if (!val || val === '') return 0;
        if (val instanceof Date) return 0;
        const str = String(val).trim();
        // Rileva date ISO serializzate come stringhe → ignora
        if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return 0;
        // Rimuove simboli valuta e spazi
        const clean = str.replace(/[^0-9,.]/g, '');
        if (!clean) return 0;
        let numStr = clean;
        if (clean.includes(',') && clean.includes('.')) {
            // Formato IT: 1.234,56 → 1234.56
            numStr = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
            numStr = clean.replace(',', '.');
        }
        return parseFloat(numStr) || 0;
    };

    // 1. PEND: Lead in coda
    const pendingCount = data.pending ? data.pending.length : 0;

    // 2. REV: Somma degli ACCONTI dei progetti in ATTESA FONDI (liquidità attesa) + ATTIVI (acconto ricevuto)
    //    Usa item.acconto (col F FINANCE = importo reale versato/dovuto), non item.budget (range testuale)
    let activeRev = 0;
    if (data.waiting && data.waiting.length > 0) {
        data.waiting.forEach(item => {
            activeRev += parseMoney(item.acconto);
        });
    }
    if (data.active && data.active.length > 0) {
        data.active.forEach(item => {
            activeRev += parseMoney(item.acconto);
        });
    }

    // 3. TOT.REV: Somma ACCONTI + SALDI dei progetti COMPLETATI (cash-flow storico reale)
    let totRev = 0;
    if (data.completed && data.completed.length > 0) {
        data.completed.forEach(item => {
            // Per i COMPLETATI usiamo il budget totale (saldo finale incassato interamente)
            totRev += parseMoney(item.budget);
        });
    }
    // Aggiunge anche gli acconti di waiting + active al totale storico
    totRev += activeRev;

    // 4. CR: Conversion Rate (COMPLETATI / Totale escludendo scarti manuali e AI)
    const completati = data.completed ? data.completed.length : 0;
    const attivi     = data.active    ? data.active.length    : 0;
    const successi   = completati + attivi;
    const totale = pendingCount +
                   (data.waiting  ? data.waiting.length  : 0) +
                   successi +
                   (data.frozen   ? data.frozen.length   : 0);
    // Escludo data.rejected dal denominatore (scarti non contano come opportunità perse nel CR)
    const cr = totale > 0 ? ((successi / totale) * 100).toFixed(1) : "0.0";

    // Inietta nel DOM
    const elCr     = document.getElementById('w-val-cr');
    const elRev    = document.getElementById('w-val-rev');
    const elTotRev = document.getElementById('w-val-tot-rev');
    const elPend   = document.getElementById('w-val-pend');

    if (elCr)     elCr.textContent     = cr + "%";
    if (elRev)    elRev.textContent    = "€" + Math.floor(activeRev).toLocaleString('it-IT');
    if (elTotRev) elTotRev.textContent = "€" + Math.floor(totRev).toLocaleString('it-IT');
    if (elPend)   elPend.textContent   = pendingCount;
}

/**
 * Helper: estrae il solo nome cliente rimuovendo il numero di telefono.
 * Gestisce sia il formato legacy "Nome - +39 xxx" che il nuovo formato pulito.
 */
function extractClientName(raw) {
    if (!raw || raw === '') return '—';
    const str = String(raw).trim();
    // Separa sul pattern " - " (separatore legacy nome/telefono) e prende solo la prima parte
    const parts = str.split(/\s+-\s+/);
    const nome = parts[0].trim();
    return nome || '—';
}

/**
 * Helper: formatta un valore budget in modo sicuro.
 * Blocca Date objects (bug legacy GAS) e valori null/undefined.
 */
function formatBudget(val) {
    if (!val || val === '') return 'N/A';
    if (val instanceof Date) return 'ERRORE DATI';
    const str = String(val).trim();
    if (!str || str === 'null' || str === 'undefined') return 'N/A';
    // Rileva date ISO serializzate come stringhe (es. "2026-04-28T...")
    if (/^\d{4}-\d{2}-\d{2}T/.test(str) || /^\w{3} \w{3} \d{2} \d{4}/.test(str)) return 'ERRORE DATI';
    return str;
}

/**
 * Istanze in sospeso.
 */
function renderTabellaDaPreventivare() {
    const tbody = document.getElementById('table-body-pending');
    if (!tbody) return;
    tbody.innerHTML = '';

    const pending = dashboardData.pending || [];

    pending.forEach((item, index) => {
        const tr = document.createElement('tr');

        const timestamp = item.timestamp || 'N/A';
        const id        = item.idIstanza  || 'N/A';
        // Estrae solo il nome (senza il numero di telefono che può essere ancora presente
        // in dati legacy salvati col vecchio formato "Nome - +39...")
        const nome      = extractClientName(item.clientName);
        const email     = item.clientEmail || '—';
        const scope     = item.scope       || '—';
        const budget    = formatBudget(item.budget);

        let timeFormatted = 'N/A';
        try { timeFormatted = new Date(timestamp).toLocaleDateString('it-IT'); } catch(e) {}

        tr.innerHTML = `
            <td>${timeFormatted}</td>
            <td>${id}</td>
            <td>${nome}</td>
            <td>${email}</td>
            <td>${scope}</td>
            <td>${budget}</td>
            <td class="actions-cell">
                <button class="btn-primary" onclick="apriIspezione('${id}')">ISPEZIONA</button>
                <button class="btn-primary" onclick="apriModalePreventivo(${index})">CONFIGURA</button>
                <button class="btn-danger" onclick="scartaIstanza('${id}')">SCARTA</button>
                <button class="btn-sys-icon btn-danger" onclick="eliminaIstanza('${id}')" title="ELIMINA DEFINITIVAMENTE" style="background:rgba(180,40,40,0.15);border:1px solid rgba(180,40,40,0.4);color:rgba(255,80,80,0.85);padding:4px 8px;border-radius:4px;cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Istanze in attesa di fondi.
 */
function renderTabellaInAttesa() {
    const tbody = document.getElementById('table-body-waiting');
    if (!tbody) return;
    tbody.innerHTML = '';

    const waiting = dashboardData.waiting || [];

    waiting.forEach((item) => {
        const tr = document.createElement('tr');

        const timestamp = item.timestamp  || 'N/A';
        const id        = item.idIstanza  || 'N/A';
        const nome      = extractClientName(item.clientName);
        const email     = item.clientEmail || '—';
        const budget    = formatBudget(item.budget);
        const acconto   = item.acconto ? `€ ${item.acconto}` : 'N/A';

        let timeFormatted = 'N/A';
        try { timeFormatted = new Date(timestamp).toLocaleDateString('it-IT'); } catch(e) {}

        tr.innerHTML = `
            <td>${timeFormatted}</td>
            <td>${id}</td>
            <td>${nome}</td>
            <td>${email}</td>
            <td>€ ${budget}</td>
            <td>${acconto}</td>
            <td class="actions-cell">
                <button class="btn-primary" onclick="apriIspezione('${id}')">ISPEZIONA</button>
                <button class="btn-primary" onclick="confermaPagamento('${id}')">CONFERMA PAGAMENTO</button>
                <button class="btn-danger" onclick="congelaIstanza('${id}')">SCARTA</button>
                <button class="btn-sys-icon btn-danger" onclick="eliminaIstanza('${id}')" title="ELIMINA DEFINITIVAMENTE" style="background:rgba(180,40,40,0.15);border:1px solid rgba(180,40,40,0.4);color:rgba(255,80,80,0.85);padding:4px 8px;border-radius:4px;cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Istanze in produzione.
 */
function renderTabellaAttivi() {
    const tbody = document.getElementById('table-body-active');
    if (!tbody) return;
    tbody.innerHTML = '';

    const active = dashboardData.active || [];

    const now = new Date();
    active.forEach((item) => {
        const tr = document.createElement('tr');
        const timestamp = item.timestamp  || 'N/A';
        const id        = item.idIstanza  || 'N/A';
        const nome      = extractClientName(item.clientName);
        const email     = item.clientEmail || '—';
        const scope     = item.scope       || '—';
        const budget    = formatBudget(item.budget);

        let timeFormatted = 'N/A';
        let deltaGiorni = 0;
        try {
            const d = new Date(timestamp);
            timeFormatted = d.toLocaleDateString('it-IT');
            deltaGiorni = Math.max(0, Math.floor((now - d) / 86400000));
        } catch(e) {}

        const isLate = deltaGiorni > 10;
        let badgeClass = isLate ? 'badge-time badge-late' : 'badge-time';
        let badgeLabel = isLate ? `+${deltaGiorni}GG ⚠` : `+${deltaGiorni}GG`;

        if (item.statusFinanziario === 'BALANCE_SENT') {
            badgeClass = 'badge-time badge-balance-sent';
            badgeLabel = 'SALDO RICHIESTO';
        } else if (item.statusFinanziario === 'UNPAID_BALANCE') {
            badgeClass = 'badge-time badge-unpaid';
            badgeLabel = 'INADEMPIENTE ⚠';
        }

        const isSaldo100 = (item.paymentStructure === 'SALDO_100_ANTICIPATO');
        const balanceBtn = isSaldo100 ? '' : `<button class="btn-primary" onclick="apriModaleSaldo('${id}')">GESTISCI SALDO</button>`;
        const completeBtn = isSaldo100 
            ? `<button class="btn-primary" onclick="segnaCompletato('${id}')">SEGNA COMPLETATO</button>`
            : `<button disabled style="opacity: 0.35;">SEGNA COMPLETATO</button>`;

        tr.innerHTML = `
            <td>${timeFormatted}</td>
            <td>${id}</td>
            <td>${nome}</td>
            <td>${email}</td>
            <td>${scope}</td>
            <td>€ ${budget}</td>
            <td><span class="${badgeClass}">${badgeLabel}</span></td>
            <td class="actions-cell">
                <button class="btn-primary" onclick="apriIspezione('${id}')">ISPEZIONA</button>
                ${balanceBtn}
                ${completeBtn}
                <button class="btn-danger" onclick="congelaIstanza('${id}')">SCARTA</button>
                <button class="btn-sys-icon btn-danger" onclick="eliminaIstanza('${id}')" title="ELIMINA DEFINITIVAMENTE" style="background:rgba(180,40,40,0.15);border:1px solid rgba(180,40,40,0.4);color:rgba(255,80,80,0.85);padding:4px 8px;border-radius:4px;cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Istanze rifiutate (AI o manuali).
 */
function renderTabellaRifiutati() {
    const tbody = document.getElementById('table-body-rejected');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rejected = dashboardData.rejected || [];

    rejected.forEach((item) => {
        const tr = document.createElement('tr');

        const timestamp = item.timestamp   || 'N/A';
        const id        = item.idIstanza   || 'N/A';
        const nome      = extractClientName(item.clientName);
        const email     = item.clientEmail || '—';
        const motivo    = item.internalNotes || item.status || 'N/A';

        let timeFormatted = 'N/A';
        try { timeFormatted = new Date(timestamp).toLocaleDateString('it-IT'); } catch(e) {}

        tr.innerHTML = `
            <td>${timeFormatted}</td>
            <td>${id}</td>
            <td>${nome}</td>
            <td>${email}</td>
            <td style="color: rgba(255,80,80,0.8); font-size: 0.75rem;">${motivo}</td>
            <td class="actions-cell">
                <button class="btn-primary" onclick="apriIspezione('${id}')">ISPEZIONA</button>
                <button disabled style="opacity: 0.35;">ARCHIVIATO</button>
                <button class="btn-sys-icon btn-danger" onclick="eliminaIstanza('${id}')" title="ELIMINA DEFINITIVAMENTE" style="background:rgba(180,40,40,0.15);border:1px solid rgba(180,40,40,0.4);color:rgba(255,80,80,0.85);padding:4px 8px;border-radius:4px;cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Istanze completate.
 */
function renderTabellaCompletati() {
    const tbody = document.getElementById('table-body-completed');
    if (!tbody) return;
    tbody.innerHTML = '';

    const completed = dashboardData.completed || [];

    const now = new Date();
    completed.forEach((item) => {
        const tr = document.createElement('tr');
        const timestamp = item.timestamp   || 'N/A';
        const id        = item.idIstanza   || 'N/A';
        const nome      = extractClientName(item.clientName);
        const email     = item.clientEmail || '—';
        const budget    = formatBudget(item.budget);

        let timeFormatted = 'N/A';
        let deltaGiorni = 0;
        try {
            const d = new Date(timestamp);
            timeFormatted = d.toLocaleDateString('it-IT');
            deltaGiorni = Math.max(0, Math.floor((now - d) / 86400000));
        } catch(e) {}

        const isUnpaid = (item.statusFinanziario === 'UNPAID_BALANCE');
        if (isUnpaid) {
            tr.style.background = 'rgba(220, 50, 50, 0.08)';
            tr.style.borderLeft = '3px solid rgba(220, 50, 50, 0.6)';
        }

        const badgeHtml = isUnpaid 
            ? `<span class="badge-time badge-unpaid">INADEMPIENTE</span>` 
            : `<span class="badge-time">+${deltaGiorni}GG</span>`;

        tr.innerHTML = `
            <td>${timeFormatted}</td>
            <td>${id}</td>
            <td>${nome}</td>
            <td>${email}</td>
            <td>€ ${budget}</td>
            <td>${badgeHtml}</td>
            <td class="actions-cell">
                <button class="btn-primary" onclick="apriIspezione('${id}')">ISPEZIONA</button>
                ${item.invoiced ? 
                  `<button disabled style="opacity: 0.35; margin-left: 8px;">FATTURATO</button>` : 
                  `<button class="btn-primary" onclick="apriModaleFattura('${id}', 'COMPLETATI')">FATTURA</button>`
                }
                <button class="btn-sys-icon btn-danger" onclick="eliminaIstanza('${id}')" title="ELIMINA DEFINITIVAMENTE" style="background:rgba(180,40,40,0.15);border:1px solid rgba(180,40,40,0.4);color:rgba(255,80,80,0.85);padding:4px 8px;border-radius:4px;cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Istanze congelate (sospese post-preventivo).
 */
function renderTabellaCongelati() {
    const tbody = document.getElementById('table-body-frozen');
    if (!tbody) return;
    tbody.innerHTML = '';

    const frozen = dashboardData.frozen || [];

    frozen.forEach((item) => {
        const tr = document.createElement('tr');

        const timestamp = item.timestamp   || 'N/A';
        const id        = item.idIstanza   || 'N/A';
        const nome      = extractClientName(item.clientName);
        const email     = item.clientEmail || '—';
        const budget    = formatBudget(item.budget);
        // Estrae il log di sospensione dalle note interne
        const logRaw    = item.internalNotes || '';
        const logMatch  = logRaw.match(/\[SUSPENSION_LOG\]:\s*([^|]+)/i);
        const logTesto  = logMatch ? logMatch[1].trim() : '—';

        let timeFormatted = 'N/A';
        try { timeFormatted = new Date(timestamp).toLocaleDateString('it-IT'); } catch(e) {}

        tr.innerHTML = `
            <td>${timeFormatted}</td>
            <td>${id}</td>
            <td>${nome}</td>
            <td>${email}</td>
            <td>€ ${budget}</td>
            <td style="color: rgba(100,180,255,0.8); font-size: 0.75rem;">${logTesto}</td>
            <td class="actions-cell">
                <button class="btn-primary" onclick="apriIspezione('${id}')">ISPEZIONA</button>
                <button class="btn-frost" onclick="ripristinaIstanza('${id}')">RIPRISTINA</button>
                <button class="btn-danger" onclick="scartaIstanza('${id}')">CESTINA</button>
                <button class="btn-sys-icon btn-danger" onclick="eliminaIstanza('${id}')" title="ELIMINA DEFINITIVAMENTE" style="background:rgba(180,40,40,0.15);border:1px solid rgba(180,40,40,0.4);color:rgba(255,80,80,0.85);padding:4px 8px;border-radius:4px;cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// [MODULO PDF FACTORY] - Logica Modale
// =========================================================================

/**
 * Aggancia l'istanza e sblocca l'HUD di compilazione.
 */
window.apriModalePreventivo = function(index) {
    selectedInstance = dashboardData.pending[index];
    if (!selectedInstance) return;

    currentDraftData = null;

    // Reset campi base — [3] Fix nome progetto: SOLO il nome, senza telefono
    const elProjectName = document.getElementById('prop-project-name');
    if (elProjectName) elProjectName.value = (selectedInstance.clientName || 'CLIENTE').toUpperCase();

    document.getElementById('input-days-arch').value = '';
    document.getElementById('input-days-prod').value = '';
    document.getElementById('input-notes').value = '';
    document.getElementById('input-price').value = '';

    // Reset Asset Builder [Mod 1A]
    const container = document.getElementById('asset-builder-container');
    if (container) { container.innerHTML = ''; aggiungiAsset(); }

    // Reset Financial Override [Mod 1B]
    const overrideSelect = document.getElementById('override-acconto');
    if (overrideSelect) overrideSelect.value = 'AUTO';
    aggiornCalcDisplay();

    // Reset Two-Step UI [Mod 1C]
    const pdfPreview = document.getElementById('pdf-preview-container');
    if (pdfPreview) pdfPreview.classList.remove('visible');
    const approveBtn = document.getElementById('btn-approve-send');
    if (approveBtn) approveBtn.disabled = true;

    document.getElementById('sys-proposal-modal').style.display = 'flex';
};

/**
 * [Mod 1C - STEP 1] Genera il draft PDF su Drive, non invia mail.
 */
async function eseguiGeneraDraft() {
    if (!selectedInstance) return;

    const daysArch = parseInt(document.getElementById('input-days-arch').value) || 0;
    const daysProd = parseInt(document.getElementById('input-days-prod').value) || 0;
    const notes    = document.getElementById('input-notes').value.trim();
    const price    = parseFloat(document.getElementById('input-price').value) || 0;

    if (price <= 0) { sysAlert("[AVVISO] Importo non valido. Inserire valore > 0."); return; }

    const assetsList = Array.from(document.querySelectorAll('.asset-input'))
        .map(el => el.value.trim()).filter(v => v !== '');

    const overrideVal = document.getElementById('override-acconto')?.value || 'AUTO';
    // [3] Fix: legge projectName in tempo reale dall'input
    const projectName = (document.getElementById('prop-project-name')?.value || '').trim()
                        || (selectedInstance.clientName || 'PROGETTO SITOSS').toUpperCase();

    const payload = {
        idIstanza:       selectedInstance.idIstanza || 'N/A',
        nomeCliente:     selectedInstance.clientName || 'CLIENTE',
        emailCliente:    selectedInstance.clientEmail || 'N/A',
        oggettoProgetto: selectedInstance.scope || 'PROGETTO SITOSS',
        projectName,
        daysArch, daysProd,
        techNotes:       notes,
        priceTotal:      price,
        assetsList,
        overrideAcconto: overrideVal
    };

    const draftBtn = document.getElementById('btn-generate-draft');
    const orig = draftBtn.innerText;
    draftBtn.innerText = 'ELABORAZIONE...';
    draftBtn.disabled = true;

    const res = await sendToBackend('ADMIN_GENERATE_DRAFT', payload);

    draftBtn.innerText = orig;
    draftBtn.disabled = false;

    if (res && !res.error && res.pdfUrl) {
        currentDraftData = { idIstanza: payload.idIstanza, pdfUrl: res.pdfUrl };
        // Mostra preview link
        const link = document.getElementById('pdf-preview-link');
        if (link) link.href = res.pdfUrl;
        const preview = document.getElementById('pdf-preview-container');
        if (preview) preview.classList.add('visible');
        // Abilita secondo step
        const approveBtn = document.getElementById('btn-approve-send');
        if (approveBtn) approveBtn.disabled = false;
        
        sysToast("DRAFT GENERATO", 'success');
        if (typeof sysNotify === 'function') sysNotify("Draft PDF Generato", { body: `Preventivo per ${payload.projectName} generato e pronto.` });
    } else {
        sysAlert("[ERRORE DRAFT]: " + (res?.error || 'Generazione PDF fallita.'));
    }
}

/**
 * [Mod 1C - STEP 2] Approva il draft: invia mail, scrive FINANCE e LOG.
 */
async function eseguiApprovaEInvia() {
    if (!currentDraftData) {
        sysAlert("[AVVISO] Generare prima il Draft PDF.");
        return;
    }

    const approveBtn = document.getElementById('btn-approve-send');
    const orig = approveBtn.innerText;
    approveBtn.innerText = 'TRASMISSIONE...';
    approveBtn.disabled = true;

    const res = await sendToBackend('ADMIN_SEND_PROPOSAL', {
        idIstanza:  currentDraftData.idIstanza,
        pdfUrl:     currentDraftData.pdfUrl,
        // [4] Iniezione note tecniche nel body email
        techNotes:  document.getElementById('input-notes')?.value?.trim() || '',
        // [SS-FIX] Espansione Payload per calcolo finanziario server-side
        priceTotal: parseFloat(document.getElementById('input-price')?.value) || 0,
        overrideAcconto: document.getElementById('override-acconto')?.value || 'AUTO',
        oggettoProgetto: selectedInstance?.scope || 'PROGETTO SITOSS'
    });

    if (res && !res.error) {
        sysAlert("[PROTOCOLLO COMPLETATO] Preventivo trasmesso al cliente.", '✅');
        if (typeof sysNotify === 'function') sysNotify("Preventivo Trasmesso", { body: "Il preventivo è stato inviato correttamente al cliente." });
        document.getElementById('sys-proposal-modal').style.display = 'none';
        selectedInstance = null;
        currentDraftData = null;
        await ricaricaDashboard();
    } else {
        approveBtn.innerText = orig;
        approveBtn.disabled = false;
        sysAlert("[ERRORE TRASMISSIONE]: " + (res?.error || 'Invio fallito.'));
    }
}

// =========================================================================
// [MODULO TRANSAZIONI] - Validazione Stato Pagamento
// =========================================================================

/**
 * Trasmette il flag di attivazione di un'istanza saldata.
 */
window.confermaPagamento = function(idIstanza) {
    apriModaleFattura(idIstanza, 'ATTESA_FONDI');
}

// =========================================================================
// [MODULO COMPLETAMENTO] - Archiviazione Istanza Prodotta
// =========================================================================

/**
 * Sposta un'istanza da ACTIVE a COMPLETED nel foglio FINANCE.
 */
window.segnaCompletato = async function(idIstanza) {
    sysConfirm(
        `Segnare [${idIstanza}] come COMPLETATA? Il progetto verrà definitivamente archiviato.`,
        async (ok) => {
            if (!ok) return;
            const res = await sendToBackend('ADMIN_MARK_COMPLETED', { idIstanza });
            if (res && !res.error) {
                sysAlert(`[SISTEMA AGGIORNATO] Istanza ${idIstanza} archiviata come COMPLETATA.`, '✅');
                if (typeof sysNotify === 'function') sysNotify("Progetto Completato", { body: `Istanza ${idIstanza} contrassegnata come completata.` });
                sysLog(`[OPS] COMPLETAMENTO: Istanza ${idIstanza} → COMPLETED.`, 'OPS');
                await ricaricaDashboard();
            } else {
                sysAlert('[ERRORE SERVER]: ' + (res?.error || 'Impossibile completare.'));
            }
        }, false, '🟢'
    );
}

// =========================================================================
// [MODULO ISPEZIONE DATI] (MOD A)
// =========================================================================

// =========================================================================
// [MODULO FATTURA / RICEVUTA]
// =========================================================================
let invoiceContext = null;
let invoiceDraftData = null;

window.apriModaleFattura = function(idIstanza, source) {
    const allInstances = [
        ...(dashboardData.pending || []),
        ...(dashboardData.waiting || []),
        ...(dashboardData.active || []),
        ...(dashboardData.completed || []),
        ...(dashboardData.frozen || [])
    ];
    const instance = allInstances.find(item => item.idIstanza === idIstanza);
    if (!instance) return;

    invoiceContext = { idIstanza, source, instanceData: instance };
    invoiceDraftData = null;

    // Reset UI Two-Step
    const preview = document.getElementById('inv-pdf-preview-container');
    if (preview) preview.style.display = 'none';
    const confirmBtn = document.getElementById('btn-confirm-invoice');
    if (confirmBtn) confirmBtn.disabled = true;

    // Dati Cliente
    document.getElementById('inv-cliente-nome').value = (instance.clientName || '').toUpperCase();
    document.getElementById('inv-cliente-cf').value = '';
    document.getElementById('inv-cliente-indirizzo').value = '';
    document.getElementById('inv-cliente-capcitta').value = '';

    // Dati Progetto e Finanziari
    document.getElementById('inv-oggetto').value = (instance.scope || '').toUpperCase();
    
    // Per compenso lordo, cerco di capire il budget
    let budgetVal = 0;
    if (instance.budget && !isNaN(parseFloat(instance.budget))) {
        budgetVal = parseFloat(instance.budget);
    } else if (instance.acconto && !isNaN(parseFloat(instance.acconto))) {
        // Se non ho un budget numerico (magari testuale "< 600"), uso l'acconto
        budgetVal = parseFloat(instance.acconto);
    }
    document.getElementById('inv-compenso-lordo').value = budgetVal || '';
    
    document.getElementById('inv-ritenuta-check').checked = true;

    aggiornaCalcoloFattura();

    document.getElementById('sys-invoice-modal').style.display = 'flex';
};

window.chiudiModaleFattura = function() {
    document.getElementById('sys-invoice-modal').style.display = 'none';
    invoiceContext = null;
    invoiceDraftData = null;
};

window.aggiornaCalcoloFattura = function() {
    const lordoStr = document.getElementById('inv-compenso-lordo').value;
    const compensoLordo = parseFloat(lordoStr) || 0;
    const applicaRitenuta = document.getElementById('inv-ritenuta-check').checked;

    let ritenuta = 0;
    if (applicaRitenuta) {
        ritenuta = compensoLordo * 0.20;
    }

    const nettoPrimaDiBollo = compensoLordo - ritenuta;
    
    // Il bollo è a carico del prestatore, quindi non si somma al totale che il cliente deve pagare
    const nettoTotale = nettoPrimaDiBollo;

    document.getElementById('inv-calc-ritenuta').textContent = `- € ${ritenuta.toLocaleString('it-IT', {minimumFractionDigits:2})}`;
    
    if (compensoLordo > 77.47) {
        document.getElementById('inv-calc-bollo').textContent = '€ 2,00 (A tuo carico)';
    } else {
        document.getElementById('inv-calc-bollo').textContent = 'Non applicabile';
    }

    document.getElementById('inv-calc-netto').textContent = `€ ${nettoTotale.toLocaleString('it-IT', {minimumFractionDigits:2})}`;
};

window.eseguiGeneraFattura = async function() {
    if (!invoiceContext) return;

    const compensoLordo = parseFloat(document.getElementById('inv-compenso-lordo').value) || 0;
    if (compensoLordo <= 0) {
        sysAlert("[AVVISO] Inserire un compenso lordo valido (> 0).");
        return;
    }

    const nomeCliente = document.getElementById('inv-cliente-nome').value.trim();
    const cfCliente = document.getElementById('inv-cliente-cf').value.trim();
    const indirizzoCliente = document.getElementById('inv-cliente-indirizzo').value.trim();
    const capcittaCliente = document.getElementById('inv-cliente-capcitta').value.trim();

    if (!nomeCliente || !cfCliente || !indirizzoCliente || !capcittaCliente) {
        sysAlert("[AVVISO] Compilare tutti i campi obbligatori del cliente.");
        return;
    }

    const payload = {
        idIstanza: invoiceContext.idIstanza,
        // Dati Prestatore (da form)
        prestatoreCf: document.getElementById('inv-prestatore-cf').value.trim() || 'NESSUN DATO',
        prestatoreIndirizzo: document.getElementById('inv-prestatore-indirizzo').value.trim() || 'NESSUN DATO',
        prestatoreCapCitta: document.getElementById('inv-prestatore-capcitta').value.trim() || 'NESSUN DATO',
        
        // Dati Cliente
        clienteNome: nomeCliente,
        clienteCf: cfCliente,
        clienteIndirizzo: indirizzoCliente,
        clienteCapCitta: capcittaCliente,
        
        // Dati Finanziari
        oggettoProgetto: document.getElementById('inv-oggetto').value.trim() || 'PRESTAZIONE',
        compensoLordo: compensoLordo,
        applicaRitenuta: document.getElementById('inv-ritenuta-check').checked
    };

    const draftBtn = document.getElementById('btn-generate-invoice');
    const origText = draftBtn.innerText;
    draftBtn.innerText = 'ELABORAZIONE...';
    draftBtn.disabled = true;

    const res = await sendToBackend('ADMIN_GENERATE_INVOICE', payload);

    draftBtn.innerText = origText;
    draftBtn.disabled = false;

    if (res && !res.error && res.pdfUrl && res.idRicevuta) {
        invoiceDraftData = { pdfUrl: res.pdfUrl, idRicevuta: res.idRicevuta };
        
        const link = document.getElementById('inv-pdf-preview-link');
        if (link) link.href = res.pdfUrl;
        const preview = document.getElementById('inv-pdf-preview-container');
        if (preview) preview.style.display = 'flex';
        
        const confirmBtn = document.getElementById('btn-confirm-invoice');
        if (confirmBtn) confirmBtn.disabled = false;
        
        sysToast("DRAFT RICEVUTA GENERATO", 'success');
    } else {
        sysAlert("[ERRORE DRAFT]: " + (res?.error || 'Generazione PDF fallita.'));
    }
};

window.eseguiConfermaFattura = async function() {
    if (!invoiceContext || !invoiceDraftData) {
        sysAlert("[AVVISO] Generare prima il Draft della Ricevuta.");
        return;
    }

    const confirmBtn = document.getElementById('btn-confirm-invoice');
    const origText = confirmBtn.innerText;
    confirmBtn.innerText = 'TRASMISSIONE...';
    confirmBtn.disabled = true;

    const emailCliente = invoiceContext.instanceData.clientEmail;

    const payload = {
        idIstanza: invoiceContext.idIstanza,
        pdfUrl: invoiceDraftData.pdfUrl,
        idRicevuta: invoiceDraftData.idRicevuta,
        source: invoiceContext.source,
        emailCliente: emailCliente,
        importoNetto: document.getElementById('inv-calc-netto').textContent.replace('€', '').trim(),
        nomeCliente: document.getElementById('inv-cliente-nome').value.trim()
    };

    const res = await sendToBackend('ADMIN_CONFIRM_INVOICE', payload);

    if (res && !res.error) {
        const msg = invoiceContext.source === 'ATTESA_FONDI' 
            ? `Pagamento confermato per ${invoiceContext.idIstanza}. Istanza in produzione e ricevuta inviata.`
            : `Ricevuta generata e inviata con successo per ${invoiceContext.idIstanza}.`;
            
        sysAlert(`[PROTOCOLLO COMPLETATO] ${msg}`, '✅');
        if (typeof sysNotify === 'function') sysNotify("Fattura Inviata", { body: msg });
        
        chiudiModaleFattura();
        await ricaricaDashboard();
    } else {
        confirmBtn.innerText = origText;
        confirmBtn.disabled = false;
        sysAlert("[ERRORE TRASMISSIONE]: " + (res?.error || 'Invio fallito.'));
    }
};

// =========================================================================
// [MODULO GESTIONE SALDO / INADEMPIENZA]
// =========================================================================
let balanceContext = null;

window.apriModaleSaldo = function(idIstanza) {
    if (!dashboardData) return;
    const allInstances = [
        ...(dashboardData.pending || []),
        ...(dashboardData.waiting || []),
        ...(dashboardData.active || []),
        ...(dashboardData.completed || []),
        ...(dashboardData.frozen || [])
    ];
    const instance = allInstances.find(item => item.idIstanza === idIstanza);
    if (!instance) return;

    balanceContext = instance;

    // Dati Cliente e Progetto
    document.getElementById('bal-cliente-nome').value = (instance.clientName || '').toUpperCase();
    document.getElementById('bal-cliente-email').value = instance.clientEmail || '';
    
    // Calcola e formatta budget e acconto
    const budgetVal = parseFloat(instance.budget) || 0;
    const accontoVal = parseFloat(instance.acconto) || 0;
    
    document.getElementById('bal-budget-totale').value = budgetVal ? budgetVal.toFixed(2) : '0.00';
    document.getElementById('bal-acconto-pagato').value = accontoVal ? accontoVal.toFixed(2) : '0.00';
    document.getElementById('bal-struttura').value = (instance.paymentStructure || 'N/D').toUpperCase();

    // Rileva automaticamente la percentuale residua di default
    let defaultPercentage = 50;
    if (instance.paymentStructure) {
        const struct = instance.paymentStructure.toUpperCase();
        if (struct === 'ACCONTO_50') {
            defaultPercentage = 50;
        } else if (struct === 'ACCONTO_75') {
            defaultPercentage = 25;
        } else if (struct.startsWith('OVERRIDE_') && struct.endsWith('PCT')) {
            const match = struct.match(/OVERRIDE_(\d+)PCT/);
            if (match) {
                const paidPct = parseInt(match[1], 10);
                defaultPercentage = Math.max(0, 100 - paidPct);
            }
        }
    }
    
    document.getElementById('bal-percentuale').value = defaultPercentage;
    
    aggiornaCalcoloSaldo();

    document.getElementById('sys-balance-modal').style.display = 'flex';
};

window.chiudiModaleSaldo = function() {
    document.getElementById('sys-balance-modal').style.display = 'none';
    balanceContext = null;
};

window.aggiornaCalcoloSaldo = function() {
    if (!balanceContext) return;
    const budgetVal = parseFloat(balanceContext.budget) || 0;
    const pct = parseFloat(document.getElementById('bal-percentuale').value) || 0;
    const importoSaldo = (budgetVal * pct / 100).toFixed(2);
    document.getElementById('bal-importo').value = importoSaldo;
};

window.eseguiInviaRichiestaSaldo = async function() {
    if (!balanceContext) return;

    const confirmBtn = document.getElementById('btn-confirm-balance');
    const origText = confirmBtn.innerText;
    confirmBtn.innerText = 'TRASMISSIONE...';
    confirmBtn.disabled = true;

    const payload = {
        idIstanza: balanceContext.idIstanza,
        percentage: parseFloat(document.getElementById('bal-percentuale').value) || 0,
        amount: parseFloat(document.getElementById('bal-importo').value) || 0
    };

    const res = await sendToBackend('ADMIN_SEND_BALANCE_REQUEST', payload);

    if (res && !res.error) {
        sysAlert(`Richiesta di saldo inviata con successo per ${balanceContext.idIstanza}.`, '✅');
        if (typeof sysNotify === 'function') sysNotify("Richiesta Saldo Inviata", { body: `Email inviata a ${balanceContext.clientEmail}` });
        
        chiudiModaleSaldo();
        await ricaricaDashboard();
    } else {
        confirmBtn.innerText = origText;
        confirmBtn.disabled = false;
        sysAlert("[ERRORE TRASMISSIONE]: " + (res?.error || 'Invio fallito.'));
    }
};

window.eseguiSegnaInadempiente = async function() {
    if (!balanceContext) return;

    if (!confirm("Sei sicuro di voler contrassegnare questo cliente come INADEMPIENTE? Il progetto verrà spostato nei completati con badge di allerta rosso.")) {
        return;
    }

    const unpaidBtn = document.getElementById('btn-unpaid-balance');
    const origText = unpaidBtn.innerText;
    unpaidBtn.innerText = 'REGISTRAZIONE...';
    unpaidBtn.disabled = true;

    const payload = {
        idIstanza: balanceContext.idIstanza
    };

    const res = await sendToBackend('ADMIN_MARK_BALANCE_UNPAID', payload);

    if (res && !res.error) {
        sysAlert(`Stato impostato su INADEMPIENTE per ${balanceContext.idIstanza}.`, '⚠');
        
        chiudiModaleSaldo();
        await ricaricaDashboard();
    } else {
        unpaidBtn.innerText = origText;
        unpaidBtn.disabled = false;
        sysAlert("[ERRORE]: " + (res?.error || 'Registrazione fallita.'));
    }
};

window.eseguiSaldoRicevuto = function() {
    if (!balanceContext) return;
    const id = balanceContext.idIstanza;
    chiudiModaleSaldo();
    segnaCompletato(id);
};

window.apriIspezione = function(idIstanza) {
    if (!dashboardData) return;

    const allInstances = [
        ...(dashboardData.pending || []),
        ...(dashboardData.waiting || []),
        ...(dashboardData.active || []),
        ...(dashboardData.rejected || []),
        ...(dashboardData.completed || []),
        ...(dashboardData.frozen || [])
    ];
    
    const instance = allInstances.find(item => item.idIstanza === idIstanza);
    if (!instance) return;

    // Salva riferimento all'istanza corrente per le note CRM
    window._currentInspectInstance = instance;

    // Estrazione dati
    const socialVal = (instance.socialLink && instance.socialLink.trim() !== '') ? instance.socialLink : "N/A";
    const briefVal  = (instance.projectGoals && instance.projectGoals.trim() !== '') 
        ? instance.projectGoals 
        : (instance.brief || "NESSUN DATO FORNITO");
    const driveVal  = (instance.driveFolder && instance.driveFolder !== "NO_ASSETS" && instance.driveFolder.trim() !== '') ? `<a href="${instance.driveFolder}" target="_blank">${instance.driveFolder}</a>` : "NESSUN DATO";
    const chatVal   = (instance.chatLog && instance.chatLog.trim() !== '') ? instance.chatLog : "NESSUN DATO";

    // Popola Note Interne CRM [Mod 2A]
    const notesTextarea = document.getElementById('inspect-internal-notes');
    if (notesTextarea) notesTextarea.value = instance.internalNotes || '';

    // [SS-MOD] Estrae il numero di telefono dal tag [PHONE: ...] nelle note interne
    // Supporta anche il formato legacy dove il numero era concatenato al nome ("Nome - +39...")
    const elPhone = document.getElementById('inspect-phone');
    if (elPhone) {
        let phoneVal = 'N/A';
        // Prima fonte: tag [PHONE:] nelle internalNotes (nuovo formato)
        const notesRaw = instance.internalNotes || '';
        const phoneTagMatch = notesRaw.match(/\[PHONE:\s*([^\]]+)\]/i);
        if (phoneTagMatch) {
            phoneVal = phoneTagMatch[1].trim();
        } else {
            // Seconda fonte: formato legacy "Nome - Numero" nella clientName
            const rawName = instance.clientName || '';
            const legacyParts = rawName.split(/\s+-\s+/);
            if (legacyParts.length > 1) {
                // La seconda parte potrebbe essere il telefono (se assomiglia a un numero)
                const candidate = legacyParts.slice(1).join(' - ').trim();
                if (/^[+\d\s().-]{6,}$/.test(candidate)) {
                    phoneVal = candidate;
                }
            }
        }
        elPhone.textContent = phoneVal;
    }

    // Popolamento UI - Parser Social Intelligente
    const elSocial = document.getElementById('inspect-social');
    if (socialVal !== "N/A") {
        let cleanStr = socialVal.trim();
        
        // Analisi Pattern: Handle o Domini noti
        const hasDomain = /\.(com|it|net|org|io)|instagram|linkedin|facebook|tiktok|x\.com|twitter/i.test(cleanStr);
        const isHandle = cleanStr.startsWith('@');
        
        if (cleanStr.startsWith('http')) {
            let displayStr = cleanStr;
            try { displayStr = new URL(cleanStr).hostname; } catch(e) {}
            elSocial.innerHTML = `<a href="${cleanStr}" target="_blank" rel="noopener noreferrer">${displayStr}</a>`;
        } else if (hasDomain) {
            elSocial.innerHTML = `<a href="https://${cleanStr}" target="_blank" rel="noopener noreferrer">${cleanStr}</a>`;
        } else if (isHandle) {
            elSocial.innerHTML = `<a href="https://www.google.com/search?q=${encodeURIComponent(cleanStr)}" target="_blank" rel="noopener noreferrer">${cleanStr}</a>`;
        } else {
            elSocial.textContent = cleanStr;
        }
    } else {
        elSocial.textContent = socialVal;
    }

    document.getElementById('inspect-brief').textContent = briefVal;
    document.getElementById('inspect-drive').innerHTML   = driveVal;
    
    // Transcript Chat Parser a bolle
    const chatContainer = document.getElementById('inspect-chat');
    chatContainer.innerHTML = '';
    
    // [FIX BUG 1] Iniezione dell'Area Operativa come bolla di sistema (utile per lo storico passato)
    if (instance.pathType && instance.subCategory) {
        const sysBubble = document.createElement('div');
        sysBubble.className = 'chat-bubble chat-sys';
        sysBubble.style.border = '1px solid var(--sys-trigger-active)';
        sysBubble.style.color = 'var(--sys-trigger-active)';
        sysBubble.style.fontFamily = 'var(--font-mono)';
        sysBubble.style.fontSize = '11px';
        sysBubble.innerHTML = `[SYS_DETECTED] AREA OPERATIVA: ${instance.pathType} - ${instance.subCategory}`;
        chatContainer.appendChild(sysBubble);
    }
    
    if (chatVal === "NESSUN DATO") {
        chatContainer.textContent = chatVal;
    } else {
        const lines = chatVal.split('\n');
        let currentRole = null;
        let currentMessage = '';
        
        const pushMessage = () => {
            if (!currentRole || !currentMessage.trim()) return;

            // [SS-FIX] FILTRO: salta il log tecnico grezzo dell'area operativa.
            // Questo messaggio ([AREA OPERATIVA SELEZIONATA]: ITALY // VISUAL IDENTITY)
            // viene loggato da evaluation.js ma non deve apparire nel transcript visivo.
            if (currentMessage.includes('[AREA OPERATIVA SELEZIONATA]')) return;

            const row = document.createElement('div');
            row.className = `chat-row chat-row--${currentRole}`;
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble';
            // [Mod 2B] Highlight regex — solo bolle utente (no bolle sistema)
            if (currentRole === 'user') {
                bubble.innerHTML = highlightTranscript(currentMessage.trim());
            } else {
                bubble.textContent = currentMessage.trim();
            }
            row.appendChild(bubble);
            chatContainer.appendChild(row);

            // [SS-FIX] INIEZIONE: dopo la domanda del bot sull'area geografica,
            // inietta una bolla utente pulita con la sola scelta (es. "ITALY").
            // Usa instance.area (campo dedicato) o pathType come fallback.
            if (currentRole === 'sys' && currentMessage.includes('DEFINE OPERATIONAL AREA')) {
                const areaVal = (instance.area || instance.pathType || '').toUpperCase().trim();
                if (areaVal) {
                    const areaRow = document.createElement('div');
                    areaRow.className = 'chat-row chat-row--user';
                    const areaBubble = document.createElement('div');
                    areaBubble.className = 'chat-bubble';
                    areaBubble.textContent = `(${areaVal})`;
                    areaRow.appendChild(areaBubble);
                    chatContainer.appendChild(areaRow);
                }
            }
        };

        lines.forEach(line => {
            // Cerca il pattern: "[timestamp] [RUOLO]:"
            const match = line.match(/^\[.*?\]\s*\[(SYS|USER|USER_FILES)\]:\s*(.*)/);
            if (match) {
                pushMessage(); // Salva il messaggio precedente se esiste
                currentRole = match[1] === 'SYS' ? 'sys' : 'user';
                currentMessage = match[2] + '\n';
            } else {
                currentMessage += line + '\n';
            }
        });
        pushMessage(); // Salva l'ultimo messaggio del ciclo
    }

    // Mostra modale
    const modal = document.getElementById('sys-inspect-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

window.chiudiIspezione = function() {
    const modal = document.getElementById('sys-inspect-modal');
    if (modal) {
        modal.style.display = 'none';
        // Reset compressione
        const bodies = modal.querySelectorAll('.inspect-section-body');
        const icons = modal.querySelectorAll('.inspect-toggle-icon');
        bodies.forEach(b => b.style.display = 'none');
        icons.forEach(i => i.textContent = '+');
    }
};

// =========================================================================
// [MODULO FREEZE] - Sospensione Progetto Post-Preventivo
// =========================================================================

/**
 * Congela un'istanza da WAITING o ACTIVE — scrive FROZEN su REQUESTS e FINANCE.
 */
window.congelaIstanza = async function(idIstanza) {
    sysPrompt(
        `Inserire motivazione per la sospensione dell'istanza [${idIstanza}]:`,
        async (motivazione) => {
            if (motivazione === null) return;
            const res = await sendToBackend('ADMIN_FREEZE_PROJECT', {
                idIstanza,
                reason: motivazione.trim() || 'NO_REASON_PROVIDED'
            });
            if (res && !res.error) {
                sysAlert(`[SISTEMA AGGIORNATO] Istanza [${idIstanza}] congelata.`, '❄️');
                sysLog(`[OPS] FREEZE: Istanza ${idIstanza} congelata. Motivo: ${(motivazione||'—').substring(0,60)}.`, 'WARN');
                await ricaricaDashboard();
            } else {
                sysAlert('[ERRORE SERVER]: ' + (res?.error || 'Impossibile sospendere.'));
            }
        }, '❄️'
    );
};

/**
 * Ripristina un'istanza congelata verso PENDING_PAYMENT (ATTESA FONDI).
 * Logica: forza il record FINANCE a PENDING_PAYMENT e REQUESTS a "New Lead (Pending Review)".
 * Riutilizza ADMIN_REJECT_MANUAL + ricreare il record è complesso — il ripristino
 * scrive direttamente via ADMIN_MARK_PAID come reset forzato (status Finance = PENDING_PAYMENT).
 */
window.ripristinaIstanza = async function(idIstanza) {
    sysConfirm(
        `Riportare l'istanza [${idIstanza}] in ATTESA FONDI? L'acconto dovrà essere nuovamente confermato.`,
        async (ok) => {
            if (!ok) return;
            const res = await sendToBackend('ADMIN_RESTORE_PROJECT', { idIstanza });
            if (res && !res.error) {
                sysAlert(`[SISTEMA AGGIORNATO] Istanza [${idIstanza}] ripristinata.`, '🔄');
                sysLog(`[OPS] RESTORE: Istanza ${idIstanza} ripristinata → PENDING_PAYMENT.`, 'OPS');
                await ricaricaDashboard();
            } else {
                sysAlert('[ERRORE SERVER]: ' + (res?.error || 'Impossibile ripristinare.'));
            }
        }, false, '🔄'
    );
};

// =========================================================================
// [MODULO SCARTO MANUALE] - Reiezione Operativa Istanza Pending
// =========================================================================

/**
 * Cestina manualmente un'istanza in sospeso impostando REJECTED_MANUAL.
 */
window.scartaIstanza = async function(idIstanza) {
    sysPrompt(
        `[OPERAZIONE DISTRUTTIVA] Inserire motivazione dello scarto per [${idIstanza}]:`,
        async (motivazione) => {
            if (motivazione === null) return;
            const res = await sendToBackend('ADMIN_REJECT_MANUAL', {
                idIstanza,
                reason: motivazione.trim() || 'NO_REASON_PROVIDED'
            });
            if (res && !res.error) {
                sysAlert(`[SISTEMA AGGIORNATO] Istanza [${idIstanza}] cestinata.`, '🗑️');
                sysLog(`[OPS] SCARTO MANUALE: Istanza ${idIstanza}. Motivo: ${(motivazione||'—').substring(0,60)}.`, 'WARN');
                await ricaricaDashboard();
            } else {
                sysAlert('[ERRORE SERVER]: ' + (res?.error || 'Impossibile eseguire lo scarto.'));
            }
        }, '🗑️'
    );
}

// =========================================================================
// [MODULO ELIMINAZIONE TOTALE] - Cancellazione definitiva dal database
// =========================================================================

/**
 * [7] Elimina TOTALMENTE un'istanza da REQUESTS e FINANCE senza lasciarvi traccia.
 */
window.eliminaIstanza = async function(idIstanza) {
    sysConfirm(
        `⚠️ OPERAZIONE IRREVERSIBILE\n\nL'istanza [${idIstanza}] verrà ELIMINATA DEFINITIVAMENTE da REQUESTS e FINANCE.\n\nNessun log verrà conservato. Confermare?`,
        async (ok) => {
            if (!ok) return;
            const res = await sendToBackend('ADMIN_DELETE_INSTANCE', { idIstanza });
            if (res && !res.error) {
                sysAlert(`[SISTEMA AGGIORNATO] Istanza [${idIstanza}] eliminata dal database.`, '🗑️');
                sysLog(`[ERR] ELIMINAZIONE DEFINITIVA: Istanza ${idIstanza} rimossa da REQUESTS e FINANCE.`, 'ERR');
                await ricaricaDashboard();
            } else {
                sysAlert('[ERRORE SERVER]: ' + (res?.error || 'Eliminazione fallita.'));
            }
        }, 'danger', '🗑️'
    );
};

// =========================================================================
// [MODULO ASSET BUILDER] - Dynamic Pill Row (Mod 1A)
// =========================================================================

/**
 * Aggiunge una riga-pill input nell'asset builder.
 */
function aggiungiAsset() {
    const container = document.getElementById('asset-builder-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'asset-pill-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'asset-input';
    input.placeholder = 'Es. Modello 3D, Logo, Video Promo...';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-asset';
    removeBtn.textContent = '×';
    removeBtn.title = 'Rimuovi asset';
    removeBtn.addEventListener('click', () => {
        row.remove();
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);
    input.focus();
}

// =========================================================================
// [MODULO FINANCIAL OVERRIDE] - Live Calc Display (Mod 1B)
// =========================================================================

/**
 * Aggiorna in real-time il display dell'acconto calcolato.
 */
function aggiornCalcDisplay() {
    const display = document.getElementById('fin-calc-display');
    if (!display) return;

    const price = parseFloat(document.getElementById('input-price')?.value) || 0;
    const overrideVal = document.getElementById('override-acconto')?.value || 'AUTO';

    if (price <= 0) { display.textContent = '— INSERIRE PREZZO'; return; }

    let percentage;
    if (overrideVal !== 'AUTO') {
        percentage = parseInt(overrideVal, 10) / 100;
    } else {
        // Simula calculateFinancialProtocol (speculare al backend)
        if (price < 600) {
            percentage = 1.0;
        } else {
            const scope = selectedInstance?.scope || '';
            percentage = (scope === 'FULL SITE' || scope === '3D/PROTOTYPE') ? 0.75 : 0.50;
        }
    }

    const importo = (price * percentage).toFixed(2);
    const label = overrideVal !== 'AUTO' ? `OVERRIDE ${overrideVal}%` : 'AUTO';
    display.textContent = `€ ${importo} (${label})`;
}

// =========================================================================
// [MODULO HIGHLIGHT] - Scanner Visivo Transcript (Mod 2B)
// =========================================================================

/**
 * Applica regex-highlight alle stringhe del transcript.
 * XSS-safe: esegue escape HTML prima di inserire i tag.
 */
function highlightTranscript(text) {
    // 1. Escape HTML per prevenire XSS
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // 2. Regex highlight (ordine: link > money > urgency)
    return escaped
        .replace(/(https?:\/\/[^\s&]+)/g,
            '<span class="sys-highlight sys-highlight--link">$1</span>')
        .replace(/(\b\d+[kK]\b|\b€\s*\d+|\b\d{3,}\b)/g,
            '<span class="sys-highlight sys-highlight--money">$1</span>')
        .replace(/\b(asap|urgente|domani|subito|entro|deadline|scadenza|prima possibile)\b/gi,
            '<span class="sys-highlight sys-highlight--urgency">$1</span>');
}

// =========================================================================
// [MOTORE RICERCA] - Filtro Globale Tabelle (Mod 3A)
// =========================================================================

/**
 * Filtra in real-time le righe di tutte le tabelle attive.
 * Confronta su: ID (col 1), Nome Cliente (col 2), Email (col 3).
 */
function filtraTabelle(query) {
    const q = query.trim().toLowerCase();
    document.querySelectorAll('.tab-content table tbody tr').forEach(tr => {
        if (!q) { tr.style.display = ''; return; }
        const cells = tr.querySelectorAll('td');
        const id    = (cells[1]?.textContent || '').toLowerCase();
        const nome  = (cells[2]?.textContent || '').toLowerCase();
        const email = (cells[3]?.textContent || '').toLowerCase();
        tr.style.display = (id.includes(q) || nome.includes(q) || email.includes(q)) ? '' : 'none';
    });
}

// =========================================================================
// [MODULO CRM] - Aggiornamento Note Interne (Mod 2A)
// =========================================================================

/**
 * Invia le note CRM al backend e aggiorna col S (INTERNAL_NOTES) del record.
 */
async function aggiornaNoteInterne() {
    const instance = window._currentInspectInstance;
    if (!instance) { sysAlert('[ERRORE] Nessuna istanza selezionata.'); return; }

    const notes = document.getElementById('inspect-internal-notes')?.value || '';
    const btn = document.getElementById('btn-update-notes');
    if (btn) { btn.disabled = true; btn.textContent = 'AGGIORNAMENTO...'; }

    const res = await sendToBackend('ADMIN_UPDATE_NOTES', {
        idIstanza: instance.idIstanza,
        notes: notes.trim()
    });

    if (btn) { btn.disabled = false; btn.textContent = 'AGGIORNA NOTE'; }

    if (res && !res.error) {
        sysAlert('[CRM AGGIORNATO] Note interne salvate correttamente.', '📝');
        sysLog(`[OPS] NOTE CRM aggiornate per istanza ${instance.idIstanza}.`, 'OPS');
        // Aggiorna in memoria locale
        instance.internalNotes = notes;
    } else {
        sysAlert('[ERRORE]: ' + (res?.error || 'Impossibile salvare le note.'));
    }
}

// =========================================================================
// [SISTEMA DIALOGO CUSTOM] - sysAlert / sysConfirm / sysPrompt (Mod 3C)
// =========================================================================

// Stato interno del dialog
let _sysAlertCallback = null;
let _sysAlertMode     = 'alert'; // 'alert' | 'confirm' | 'prompt'

function _initSysDialog(icon, title, msg) {
    document.getElementById('sys-alert-icon').textContent  = icon;
    document.getElementById('sys-alert-title').textContent = title;
    document.getElementById('sys-alert-msg').textContent   = msg;
}

/**
 * Mostra un overlay informativo (sostituisce alert()).
 */
function sysAlert(msg, icon = '⚠️') {
    _sysAlertMode = 'alert';
    _sysAlertCallback = null;
    _initSysDialog(icon, 'AVVISO DI SISTEMA', msg);
    document.getElementById('sys-alert-cancel').style.display = 'none';
    document.getElementById('sys-custom-input').classList.remove('visible');
    const confirmBtn = document.getElementById('sys-alert-confirm');
    confirmBtn.classList.remove('danger');
    confirmBtn.textContent = 'OK';
    document.getElementById('sys-custom-alert').classList.add('visible');
}

/**
 * Mostra un overlay di conferma (sostituisce confirm()).
 * @param {Function} callback - Riceve true (conferma) o null (annulla).
 */
function sysConfirm(msg, callback, danger = false, icon = '⚠️') {
    _sysAlertMode = 'confirm';
    _sysAlertCallback = callback;
    _initSysDialog(icon, 'CONFERMA OPERAZIONE', msg);
    document.getElementById('sys-alert-cancel').style.display = '';
    document.getElementById('sys-custom-input').classList.remove('visible');
    const confirmBtn = document.getElementById('sys-alert-confirm');
    confirmBtn.textContent = 'CONFERMA';
    if (danger) confirmBtn.classList.add('danger');
    else confirmBtn.classList.remove('danger');
    document.getElementById('sys-custom-alert').classList.add('visible');
}

/**
 * Mostra un overlay con campo input (sostituisce prompt()).
 * @param {Function} callback - Riceve il valore stringa o null (annulla).
 */
function sysPrompt(msg, callback, icon = '✏️') {
    _sysAlertMode = 'prompt';
    _sysAlertCallback = callback;
    _initSysDialog(icon, 'INPUT RICHIESTO', msg);
    document.getElementById('sys-alert-cancel').style.display = '';
    const inputEl = document.getElementById('sys-custom-input');
    inputEl.classList.add('visible');
    inputEl.value = '';
    document.getElementById('sys-alert-confirm').classList.remove('danger');
    document.getElementById('sys-alert-confirm').textContent = 'CONFERMA';
    document.getElementById('sys-custom-alert').classList.add('visible');
    // Focus con piccolo delay (attende animazione)
    setTimeout(() => inputEl.focus(), 80);
}

/**
 * Handler bottone ANNULLA dell'overlay custom.
 */
function _sysAlertCancel() {
    document.getElementById('sys-custom-alert').classList.remove('visible');
    if (_sysAlertMode !== 'alert' && _sysAlertCallback) {
        _sysAlertCallback(null);
    }
    _sysAlertCallback = null;
}

/**
 * Handler bottone CONFERMA dell'overlay custom.
 */
function _sysAlertConfirm() {
    document.getElementById('sys-custom-alert').classList.remove('visible');
    if (_sysAlertMode === 'confirm' && _sysAlertCallback) {
        _sysAlertCallback(true);
    } else if (_sysAlertMode === 'prompt' && _sysAlertCallback) {
        _sysAlertCallback(document.getElementById('sys-custom-input').value);
    }
    _sysAlertCallback = null;
}

// =========================================================================
// [MODULO BROADCAST] - System Broadcast (Newsletter)
// =========================================================================

let _broadcastTargetList = [];

/**
 * Scansiona le code della dashboardData (ESCLUSI rejected) e popola la target list.
 * Quando global è ON: include tutte le code (pending/waiting/active/completed/frozen).
 * Quando global è OFF: applica i filtri Budget e Tipo Entità.
 */
function calcolaNodiRiceventi() {
    if (!dashboardData) return;

    const globalToggle = document.getElementById('broadcast-global-toggle');
    if (!globalToggle) return;

    const isGlobal     = globalToggle.checked;
    const blacklistRaw = document.getElementById('broadcast-blacklist')?.value || '';
    const blacklist    = blacklistRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    const filterBudgetVal = document.getElementById('broadcast-filter-budget')?.value || 'ALL';
    const filterTypeVal   = document.getElementById('broadcast-filter-type')?.value  || 'ALL';

    // Mappa tier composti
    const TIER_MID_VALUES  = ['1k-5k', '5k-10k', '> 10k'];
    const TIER_HIGH_VALUES = ['5k-10k', '> 10k'];

    const emails = new Set();

    // Tutte le code non-rejected
    const allQueues = [
        ...(dashboardData.pending   || []),
        ...(dashboardData.waiting   || []),
        ...(dashboardData.active    || []),
        ...(dashboardData.completed || []),
        ...(dashboardData.frozen    || [])
    ];

    allQueues.forEach(record => {
        const email      = (record.clientEmail || '').trim().toLowerCase();
        const budget     = (record.budget      || '').trim();
        const clientType = (record.clientType  || '').trim().toUpperCase();

        if (!email || !email.includes('@')) return;
        if (blacklist.includes(email)) return;

        if (!isGlobal) {
            // Applica filtro Budget
            if (filterBudgetVal !== 'ALL') {
                if (filterBudgetVal === 'TIER_MID') {
                    if (!TIER_MID_VALUES.some(t => budget.includes(t.replace('> ', '')))) return;
                } else if (filterBudgetVal === 'TIER_HIGH') {
                    if (!TIER_HIGH_VALUES.some(t => budget.includes(t.replace('> ', '')))) return;
                } else {
                    if (budget !== filterBudgetVal) return;
                }
            }
            // Applica filtro Tipo Entità
            if (filterTypeVal !== 'ALL' && clientType !== filterTypeVal) return;
        }

        emails.add(email);
    });

    _broadcastTargetList = Array.from(emails);

    const countDisplay = document.getElementById('broadcast-target-count');
    if (countDisplay) {
        const filterNote = isGlobal ? 'OTP-VERIFICATI' : `FILTRATI (${filterBudgetVal} · ${filterTypeVal})`;
        countDisplay.textContent = `TARGET: ${_broadcastTargetList.length} NODI ${filterNote}`;
        countDisplay.style.color = _broadcastTargetList.length > 0
            ? 'var(--sys-trigger-active)'
            : 'rgba(255,100,80,0.9)';
    }

    preparaInnesco();
}

/**
 * Gestisce l'abilitazione del pulsante di invio.
 */
function preparaInnesco() {
    const subject = document.getElementById('broadcast-subject').value.trim();
    const body = document.getElementById('broadcast-body').value.trim();
    const btn = document.getElementById('btn-execute-broadcast');
    
    if (subject && body && _broadcastTargetList.length > 0) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

/**
 * Anima la progress bar e l'indicatore testuale.
 */
function mostraProgresso(attuale, totale) {
    const container = document.getElementById('broadcast-progress-container');
    const bar = document.getElementById('broadcast-progress-bar');
    const text = document.getElementById('broadcast-status-text');
    
    if (totale === 0) return;
    container.style.display = 'block';
    
    const pct = Math.round((attuale / totale) * 100);
    bar.style.width = pct + '%';
    text.textContent = `TRANSMITTING... ${pct}% [${attuale}/${totale}]`;
}

/**
 * Esegue il Broadcast Globale reale via backend ADMIN_BROADCAST.
 * Implementa A (invio reale) + B (batch quota-safe) + C (solo OTP-verificati).
 */
async function eseguiBroadcastGlobale() {
    const subject   = document.getElementById('broadcast-subject').value.trim();
    const bodyText  = document.getElementById('broadcast-body').value.trim();
    const blacklistRaw = document.getElementById('broadcast-blacklist')?.value || '';
    const targets   = _broadcastTargetList;

    if (!subject || !bodyText || targets.length === 0) return;

    sysConfirm(
        `ATTENZIONE: Broadcast Globale a ${targets.length} nodi OTP-verificati.\nOggetto: ${subject}\n\nLe email verranno inviate in lotti da 50. Confermare?`,
        async (confirmed) => {
            if (!confirmed) return;

            const btn = document.getElementById('btn-execute-broadcast');
            const container = document.getElementById('broadcast-progress-container');
            const bar       = document.getElementById('broadcast-progress-bar');
            const statusTxt = document.getElementById('broadcast-status-text');

            btn.disabled = true;
            btn.textContent = '[ TRASMISSIONE IN CORSO... ]';

            // Progress bar indeterminata durante l'attesa del backend
            container.style.display = 'block';
            bar.style.transition = 'width 8s linear';
            bar.style.width = '85%';
            statusTxt.textContent = `TRANSMITTING TO ${targets.length} NODES... BATCH MODE ACTIVE`;

            try {
                const blacklist  = blacklistRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
                const vaultMode  = document.getElementById('btn-vault-toggle')?.classList.contains('sys-state-whitelist') ? 'WHITELIST' : 'BLACKLIST';

                const res = await sendToBackend('ADMIN_BROADCAST', {
                    subject:   subject,
                    body:      bodyText,
                    blacklist: blacklist,
                    vaultMode: vaultMode,
                    batchSize: 50
                });

                // Completa la barra al 100%
                bar.style.transition = 'width 0.3s ease';
                bar.style.width = '100%';

                if (res && (res.status === 'SUCCESS' || res.status === 'PARTIAL')) {
                    const failedNote = res.failed > 0
                        ? ` · ${res.failed} ERRORI`
                        : ' · ZERO ERRORI';
                    statusTxt.textContent = `COMPLETED: ${res.sent} INVIATI${failedNote} / ${res.totalTargets} TARGET`;
                    statusTxt.style.color = res.failed > 0 ? 'rgba(255,180,80,0.9)' : 'var(--sys-trigger-active)';
                    btn.textContent = '[ BROADCAST COMPLETATO ]';

                    // Mostra errori se presenti
                    if (res.failed > 0 && res.errors && res.errors.length > 0) {
                        const errList = res.errors.map(e => `  ⚠ ${e.email}: ${e.error}`).join('\n');
                        sysAlert(`BROADCAST PARZIALE.\nInviati: ${res.sent} / ${res.totalTargets}\nFalliti: ${res.failed}\n\nDettagli errori:\n${errList}`);
                        if (typeof sysNotify === 'function') sysNotify("Broadcast Parziale", { body: `Inviati ${res.sent}/${res.totalTargets}. Alcuni fallimenti.` });
                    } else {
                        sysAlert(`BROADCAST COMPLETATO.\nNodi raggiunti: ${res.sent} / ${res.totalTargets}`);
                        if (typeof sysNotify === 'function') sysNotify("Broadcast Completato", { body: `Inviati ${res.sent}/${res.totalTargets} messaggi.` });
                    }

                } else if (res && res.status === 'NO_TARGETS') {
                    statusTxt.textContent = 'NESSUN TARGET DISPONIBILE — VERIFICA FILTRI';
                    statusTxt.style.color = 'rgba(255,180,80,0.9)';
                    btn.textContent = '[ ESEGUI BROADCAST GLOBALE ]';
                    btn.disabled = false;
                } else {
                    statusTxt.textContent = `ERRORE: ${res?.error || 'BACKEND_FAILURE'}`;
                    statusTxt.style.color = 'var(--accent-red)';
                    btn.textContent = '[ RIPROVA ]';
                    btn.disabled = false;
                }

            } catch(e) {
                bar.style.width = '100%';
                bar.style.background = 'var(--accent-red)';
                statusTxt.textContent = 'NETWORK ERROR — BROADCAST INTERROTTO';
                statusTxt.style.color = 'var(--accent-red)';
                btn.textContent = '[ RIPROVA ]';
                btn.disabled = false;
            }

            // Reset UI dopo 8 secondi (solo se completato con successo)
            setTimeout(() => {
                if (btn.textContent === '[ BROADCAST COMPLETATO ]') {
                    btn.textContent = '[ ESEGUI BROADCAST GLOBALE ]';
                    btn.disabled = false;
                    container.style.display = 'none';
                    bar.style.width = '0%';
                    bar.style.background = 'var(--sys-trigger-active)';
                    bar.style.transition = 'width 0.3s ease';
                    statusTxt.style.color = 'var(--sys-trigger-active)';
                    document.getElementById('broadcast-subject').value = '';
                    document.getElementById('broadcast-body').value = '';
                    preparaInnesco();
                }
            }, 8000);
        },
        'danger'
    );
}

// =========================================================================
// [MODULO SCHEDULER] — Frequenza e Auto-Trigger Newsletter
// =========================================================================

/**
 * Aggiorna l'indicatore visivo della schedulazione attiva.
 */
function aggiornaScheduleStatusUI(freq, triggers) {
    const el = document.getElementById('broadcast-schedule-status');
    if (!el) return;

    const freqLabels = {
        MANUAL:      'Solo Manuale',
        MONTHLY:     'Ogni Mese',
        BIMONTHLY:   'Ogni 2 Mesi',
        QUARTERLY:   'Trimestrale',
        SEMI_ANNUAL: 'Semestrale',
        ANNUAL:      'Annuale'
    };
    const freqLabel = freqLabels[freq] || freq;

    const triggerLabels = {
        NONE:          '',
        AT_COMPLETION: 'Fine Lavoro',
        AT_FREEZE:     'Congelamento',
        AT_REJECTION:  'Scarto Manuale',
        AT_PAYMENT:    'Pagamento'
    };

    const activeTriggers = (triggers || [])
        .filter(t => t !== 'NONE')
        .map(t => triggerLabels[t] || t)
        .join(', ');

    if (freq === 'MANUAL' && (!activeTriggers)) {
        el.textContent = 'NESSUNA SCHEDULAZIONE ATTIVA';
        el.style.color = 'rgba(255,255,255,0.25)';
    } else {
        const parts = [];
        if (freq !== 'MANUAL') parts.push(`⏱ ${freqLabel}`);
        if (activeTriggers)    parts.push(`⚡ ${activeTriggers}`);
        el.textContent = parts.join(' · ');
        el.style.color = 'var(--sys-trigger-active)';
    }
}

/**
 * Carica la configurazione del scheduler dal backend al login.
 */
async function caricaConfigScheduler() {
    const res = await sendToBackend('ADMIN_GET_BROADCAST_CONFIG', {});
    if (res && res.config) {
        const { freq, triggers, draftSubject, draftBody } = res.config;
        // Ripristina selettore frequenza
        const freqSel = document.getElementById('broadcast-schedule-freq');
        if (freqSel && freq) freqSel.value = freq;
        // Ripristina trigger multi-select
        const triggerSel = document.getElementById('broadcast-trigger-event');
        if (triggerSel && triggers) {
            Array.from(triggerSel.options).forEach(opt => {
                opt.selected = triggers.includes(opt.value);
            });
        }
        // Ripristina draft salvato nei campi (se presenti e campi vuoti)
        const subjectEl = document.getElementById('broadcast-subject');
        const bodyEl    = document.getElementById('broadcast-body');
        if (subjectEl && !subjectEl.value && draftSubject) subjectEl.value = draftSubject;
        if (bodyEl    && !bodyEl.value    && draftBody)    bodyEl.value    = draftBody;
        aggiornaScheduleStatusUI(freq, triggers);
        preparaInnesco();
    }
}

function evaluateBroadcastFSM() {
    const matrix = document.getElementById('sys-active-schedules-matrix');
    const btn    = document.getElementById('btn-execute-broadcast');
    if (!matrix || !btn) return;
    if (matrix.childElementCount > 0) {
        btn.classList.add('sys-btn-obscured');
    } else {
        btn.classList.remove('sys-btn-obscured');
        preparaInnesco();
    }
}

function renderScheduleNode(payload) {
    const matrix = document.getElementById('sys-active-schedules-matrix');
    if (!matrix) return;

    const freqLabels = {
        MANUAL: 'MANUAL', MONTHLY: 'MENSILE', BIMONTHLY: 'BIMESTRALE',
        QUARTERLY: 'TRIMESTRALE', SEMI_ANNUAL: 'SEMESTRALE', ANNUAL: 'ANNUALE'
    };
    const freqStr    = freqLabels[payload.freq] || payload.freq || 'MANUAL';
    const targetStr  = (payload.filterType !== 'ALL' ? payload.filterType : 'ALL') +
                       ' / ' + (payload.filterBudget !== 'ALL' ? payload.filterBudget : 'ALL');
    const triggerStr = payload.triggers && payload.triggers.length > 0
        ? payload.triggers.join(' + ')
        : 'NONE';
    const subjectStr = (payload.draftSubject || '—').substring(0, 42);
    const ts         = new Date().toLocaleString('it-IT', { hour12: false });

    const scheduleId = Date.now();

    const node = document.createElement('div');
    node.className          = 'sys-schedule-node';
    node.style.position     = 'relative';
    node.dataset.scheduleId = scheduleId;
    node.dataset.freq       = payload.freq    || 'MANUAL';
    node.dataset.triggers   = JSON.stringify(payload.triggers || []);

    const vaultStr    = payload.vaultMode === 'WHITELIST' ? 'WHITELIST' : 'BLACKLIST';
    const vaultColor  = payload.vaultMode === 'WHITELIST' ? 'var(--sys-trigger-active)' : '#ff3333';

    const dataDiv = document.createElement('div');
    dataDiv.className = 'sys-schedule-node__data';
    dataDiv.innerHTML = [
        `<span class="sys-schedule-node__label">FREQ</span><span>[${freqStr}]</span>`,
        `<span class="sys-schedule-node__label">TARGET</span><span>[${targetStr}]</span>`,
        `<span class="sys-schedule-node__label">TRIGGER</span><span>[${triggerStr}]</span>`,
        `<span class="sys-schedule-node__label">VAULT</span><span style="color:${vaultColor}">[${vaultStr}]</span>`,
        `<span class="sys-schedule-node__label">SUBJECT</span><span>[${subjectStr}]</span>`,
        `<span class="sys-schedule-node__label" style="opacity:0.35">${ts}</span>`
    ].join('');

    const killBtn = document.createElement('button');
    killBtn.className   = 'sys-delete-node';
    killBtn.textContent = 'KILL';
    killBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget.closest('.sys-schedule-node');
        const id     = target.dataset.scheduleId;
        target.classList.add('sys-node-destroy');
        setTimeout(() => {
            target.remove();
            evaluateBroadcastFSM();
            sysLog('SCHEDULE DESTROYED // ID: ' + id, 'ERR');
        }, 200);
    });

    node.appendChild(dataDiv);
    node.appendChild(killBtn);
    matrix.appendChild(node);
}

/**
 * Salva la configurazione di schedulazione via ADMIN_SET_BROADCAST_CONFIG.
 */
async function salvaSchedulazione() {
    const freq = document.getElementById('broadcast-schedule-freq')?.value || 'MANUAL';

    const triggerSel = document.getElementById('broadcast-trigger-event');
    const triggers   = triggerSel
        ? Array.from(triggerSel.selectedOptions).map(o => o.value).filter(v => v !== 'NONE')
        : [];

    const draftSubject = document.getElementById('broadcast-subject')?.value.trim() || '';
    const draftBody    = document.getElementById('broadcast-body')?.value.trim()    || '';
    const vaultMode    = document.getElementById('btn-vault-toggle')?.classList.contains('sys-state-whitelist') ? 'WHITELIST' : 'BLACKLIST';

    const btn = document.getElementById('btn-save-schedule');
    if (btn) { btn.textContent = '💾 SALVATAGGIO...'; btn.disabled = true; }

    const res = await sendToBackend('ADMIN_SET_BROADCAST_CONFIG', {
        freq, triggers, draftSubject, draftBody, vaultMode
    });

    if (btn) { btn.textContent = '💾 SALVA SCHEDULAZIONE'; btn.disabled = false; }

    if (res && res.status === 'SAVED') {
        aggiornaScheduleStatusUI(freq, triggers);
        renderScheduleNode({
            freq,
            triggers,
            filterBudget: document.getElementById('broadcast-filter-budget')?.value || 'ALL',
            filterType:   document.getElementById('broadcast-filter-type')?.value   || 'ALL',
            vaultMode:    vaultMode,
            draftSubject: draftSubject
        });
        evaluateBroadcastFSM();
    } else {
        sysAlert(`ERRORE SALVATAGGIO: ${res?.error || 'BACKEND_FAILURE'}`);
    }
}

/**
 * Rimuove tutta la configurazione di schedulazione.
 */
async function rimuoviSchedulazione() {
    sysConfirm('RIMUOVERE la schedulazione attiva?\nIl broadcast resterà solo manuale.', async (confirmed) => {
        if (!confirmed) return;
        const res = await sendToBackend('ADMIN_SET_BROADCAST_CONFIG', {
            freq: 'MANUAL', triggers: [], draftSubject: '', draftBody: ''
        });
        if (res && res.status === 'SAVED') {
            const freqSel = document.getElementById('broadcast-schedule-freq');
            const trigSel = document.getElementById('broadcast-trigger-event');
            if (freqSel) freqSel.value = 'MANUAL';
            if (trigSel) Array.from(trigSel.options).forEach(o => o.selected = (o.value === 'NONE'));
            aggiornaScheduleStatusUI('MANUAL', []);
            const matrix = document.getElementById('sys-active-schedules-matrix');
            if (matrix) matrix.innerHTML = '';
            evaluateBroadcastFSM();
        }
    }, 'danger');
}

// =========================================================================
// [MODULO SISTEMI] - Gestione Active & All Systems (Slide 3)
// =========================================================================

/**
 * Aggiunge una nuova riga vuota alla matrice pubblica.
 */
function aggiungiRigaMatrice() {
    const grid = document.getElementById('matrix-builder-grid');
    if (!grid) return;

    const row = document.createElement('div');
    row.className = 'matrix-row';
    row.innerHTML = `
        <span class="ping-indicator">[UNVERIFIED]</span>
        <input type="text" class="matrix-input-url" placeholder="URL dell'asset...">
        <select class="matrix-select-type">
            <option value="IMG">IMG</option>
            <option value="VIDEO">VIDEO</option>
        </select>
        <button type="button" class="btn-remove-matrix-row">&times;</button>
    `;
    grid.appendChild(row);
}

/**
 * Simula il controllo dei ping e abilita il salvataggio.
 */
async function eseguiPingCheck() {
    const btnPing = document.getElementById('btn-ping-check');
    const btnUpdate = document.getElementById('btn-update-matrix');
    const rows = document.querySelectorAll('.matrix-row');

    if (rows.length === 0) return;

    btnPing.disabled = true;
    btnPing.textContent = "[ ANALISI INTEGRITÀ... ]";

    // Simula tempo di rete
    await new Promise(r => setTimeout(r, 2000));

    let allPass = true;

    rows.forEach(row => {
        const input = row.querySelector('.matrix-input-url');
        const indicator = row.querySelector('.ping-indicator');
        
        if (input.value.trim().length > 5) {
            indicator.textContent = "[PASS]";
            indicator.className = 'ping-indicator ping-pass';
        } else {
            indicator.textContent = "[FAIL]";
            indicator.className = 'ping-indicator ping-fail';
            allPass = false;
        }
    });

    if (allPass) {
        btnPing.textContent = "[ CHECK COMPLETATO - OK ]";
        btnPing.classList.remove('btn-frost');
        btnPing.style.color = "var(--sys-trigger-active)";
        btnUpdate.disabled = false;
    } else {
        btnPing.textContent = "[ ERRORE: NODI OFFLINE ]";
        btnPing.style.color = "var(--accent-red)";
        btnUpdate.disabled = true;
    }

    setTimeout(() => {
        btnPing.disabled = false;
        btnPing.textContent = "[ ESEGUI PING CHECK ASSET ]";
        btnPing.classList.add('btn-frost');
        btnPing.style.color = "";
    }, 4000);
}

// =========================================================================
// [MODULO ARCHIVIO] - Archivio (Attività & Utenti) (Slide 4)
// =========================================================================

/**
 * Helper per parsare valori monetari in modo sicuro (speculare ad aggiornaWidgetAnalitici).
 */
function _parseMoney(val) {
    if (!val || val === '') return 0;
    if (val instanceof Date) return 0;
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return 0;
    const clean = str.replace(/[^0-9,.]/g, '');
    if (!clean) return 0;
    let numStr = clean;
    if (clean.includes(',') && clean.includes('.')) {
        numStr = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        numStr = clean.replace(',', '.');
    }
    return parseFloat(numStr) || 0;
}

/**
 * Genera e scarica un PDF del Ledger per il mese/anno specificato.
 * Usa jsPDF + AutoTable per un output professionale e brandizzato.
 * @param {string} monthLabel  - Etichetta del mese (es. "MAGGIO 2026")
 * @param {Array}  records     - Array di record del mese (già con _queue)
 * @param {object} metriche    - { fatturatoChiuso, liquiditaEntrata, cr, causeStr }
 */
function esportaLedgerPDF(monthLabel, records, metriche) {
    if (typeof window.jspdf === 'undefined') {
        sysAlert('[ERRORE] Motore PDF non disponibile. Verificare la connessione internet.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const PAGE_W  = doc.internal.pageSize.getWidth();
    const PAGE_H  = doc.internal.pageSize.getHeight();
    const MARGIN  = 14;

    // ---- Palette colori (tema dark → stampa chiara) ----
    const C_BLACK   = [10,  10,  10];
    const C_GRAY    = [90,  90,  90];
    const C_LIGHT   = [160, 160, 160];
    const C_GREEN   = [80,  180, 100];
    const C_RED     = [200, 70,  70];
    const C_YELLOW  = [210, 160, 40];
    const C_BLUE    = [80,  140, 210];
    const C_ACCENT  = [100, 200, 130];  // verde sistema SS

    // =====================================================
    // HEADER — Branding SS
    // =====================================================
    // Barra nera di testa
    doc.setFillColor(...C_BLACK);
    doc.rect(0, 0, PAGE_W, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('SS-COMMAND-CENTER', MARGIN, 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C_ACCENT);
    doc.text('// ARCHIVIO — LEDGER MENSILE', MARGIN, 15);

    // Titolo mese a destra
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(monthLabel, PAGE_W - MARGIN, 10, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C_LIGHT);
    doc.text(`${records.length} ISTANZE REGISTRATE`, PAGE_W - MARGIN, 16, { align: 'right' });

    // =====================================================
    // MICRO-HUD — Metriche del Mese
    // =====================================================
    let yPos = 28;

    const hudItems = [
        { label: 'FATTURATO CHIUSO',    value: `€ ${Math.floor(metriche.fatturatoChiuso).toLocaleString('it-IT')}` },
        { label: 'LIQUIDITÀ IN ENTRATA',value: `€ ${Math.floor(metriche.liquiditaEntrata).toLocaleString('it-IT')}` },
        { label: 'CR MESE',             value: `${metriche.cr}%` },
        { label: 'CAUSE RIGETTO',        value: metriche.causeStr }
    ];

    const hudW = (PAGE_W - MARGIN * 2) / hudItems.length;

    hudItems.forEach((item, i) => {
        const x = MARGIN + i * hudW;
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, yPos, hudW - 3, 16, 2, 2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...C_GRAY);
        doc.text(item.label, x + 4, yPos + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...C_BLACK);
        doc.text(item.value, x + 4, yPos + 13);
    });

    yPos += 22;

    // Linea separatrice
    doc.setDrawColor(...C_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
    yPos += 4;

    // =====================================================
    // TABELLA ISTANTANEA — AutoTable
    // =====================================================
    const sortedRecords = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const tableHead = [['DATA', 'ID ISTANZA', 'CLIENTE', 'EMAIL', 'SCOPE', 'STATUS', 'VALORE (€)']];

    const tableBody = sortedRecords.map(r => {
        const data   = r.timestamp ? new Date(r.timestamp).toLocaleDateString('it-IT') : 'N/D';
        const id     = r.idIstanza || 'N/D';
        const nome   = extractClientName(r.clientName);
        const mail   = r.clientEmail || '—';
        const scope  = r.scope || '—';
        const status = r._queue || r.status || '—';
        const val    = _parseMoney(r.budget);
        const valStr = val > 0 ? val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
        return [data, id, nome, mail, scope, status, valStr];
    });

    doc.autoTable({
        startY: yPos,
        head: tableHead,
        body: tableBody,
        margin: { left: MARGIN, right: MARGIN },
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
            lineColor: [220, 220, 220],
            lineWidth: 0.2
        },
        headStyles: {
            fillColor: C_BLACK,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'left'
        },
        alternateRowStyles: {
            fillColor: [248, 248, 248]
        },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },   // DATA
            1: { cellWidth: 36, font: 'courier', fontSize: 7 }, // ID
            2: { cellWidth: 36 },                      // CLIENTE
            3: { cellWidth: 48, fontSize: 7 },         // EMAIL
            4: { cellWidth: 28, fontSize: 7 },         // SCOPE
            5: { cellWidth: 26, halign: 'center' },    // STATUS
            6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' } // VALORE
        },
        didParseCell: (data) => {
            // Colora le celle STATUS prima del rendering (nessuna doppia scrittura)
            if (data.section === 'body' && data.column.index === 5) {
                const statusVal = (data.cell.raw || '').toUpperCase();
                let color = C_GRAY;
                if (statusVal === 'COMPLETED') color = C_GREEN;
                else if (statusVal === 'REJECTED') color = C_RED;
                else if (statusVal === 'ACTIVE')   color = C_YELLOW;
                else if (statusVal === 'FROZEN')   color = C_BLUE;
                else if (statusVal === 'WAITING')  color = [150, 100, 200];
                data.cell.styles.textColor = color;
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.halign    = 'center';
            }
        }
    });

    // =====================================================
    // FOOTER — Timestamp generazione
    // =====================================================
    const finalY = doc.lastAutoTable.finalY || PAGE_H - 10;
    const now = new Date().toLocaleString('it-IT');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_LIGHT);
    doc.text(`Generato da SS-COMMAND-CENTER il ${now}`, MARGIN, Math.min(finalY + 8, PAGE_H - 6));
    doc.text('DOCUMENTO RISERVATO — USO INTERNO', PAGE_W - MARGIN, Math.min(finalY + 8, PAGE_H - 6), { align: 'right' });

    // =====================================================
    // SALVATAGGIO
    // =====================================================
    const fileName = `LEDGER_${monthLabel.replace(/\s/g, '_')}.pdf`;
    doc.save(fileName);
}

/**
 * Costruisce dinamicamente il Ledger Mensile aggregando tutti i record da dashboardData.
 * Raggruppa per mese/anno di timestamp, dal più recente al più vecchio.
 */
function renderArchivioMensile() {
    const container = document.getElementById('ledger-months-container');
    if (!container) return;

    // --- Aggregazione ---
    // Raccoglie TUTTI i record da tutte le code (escluso pending puro senza Finance)
    const allRecords = [
        ...(dashboardData.completed || []).map(r => ({ ...r, _queue: 'COMPLETED' })),
        ...(dashboardData.active    || []).map(r => ({ ...r, _queue: 'ACTIVE' })),
        ...(dashboardData.waiting   || []).map(r => ({ ...r, _queue: 'WAITING' })),
        ...(dashboardData.rejected  || []).map(r => ({ ...r, _queue: 'REJECTED' })),
        ...(dashboardData.frozen    || []).map(r => ({ ...r, _queue: 'FROZEN' })),
        ...(dashboardData.pending   || []).map(r => ({ ...r, _queue: 'PENDING' }))
    ];

    if (allRecords.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; padding: 20px; text-align: center;">[NESSUN RECORD NEL DATABASE]</div>`;
        return;
    }

    // Raggruppa per YYYY-MM
    const monthGroups = {};
    const MESI_IT = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];

    allRecords.forEach(r => {
        if (!r.timestamp) return;
        let d;
        try { d = new Date(r.timestamp); if (isNaN(d.getTime())) return; } catch(e) { return; }
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthGroups[key]) monthGroups[key] = { records: [], year: d.getFullYear(), month: d.getMonth() };
        monthGroups[key].records.push(r);
    });

    // Ordina dal più recente
    const sortedKeys = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

    container.innerHTML = '';

    sortedKeys.forEach((key, idx) => {
        const group = monthGroups[key];
        const records = group.records;
        const monthLabel = `${MESI_IT[group.month]} ${group.year}`;

        // --- Calcolo metriche mensili ---
        let fatturatoChiuso = 0;
        let liquiditaEntrata = 0;
        let totaleLeadMese = records.length;
        let successi = 0;
        const causeRigetto = {};

        records.forEach(r => {
            if (r._queue === 'COMPLETED') {
                fatturatoChiuso += _parseMoney(r.budget);
                liquiditaEntrata += _parseMoney(r.budget);
                successi++;
            } else if (r._queue === 'ACTIVE') {
                liquiditaEntrata += _parseMoney(r.acconto);
                successi++;
            } else if (r._queue === 'WAITING') {
                successi++;
            } else if (r._queue === 'REJECTED') {
                // Estrai causa di rigetto
                const notes = r.internalNotes || r.status || '';
                const codeMatch = notes.match(/AI_REJECTION:\s*(\S+)|REJECTED_MANUAL/i);
                let code = 'ALTRO';
                if (codeMatch) code = codeMatch[1] || 'REJECTED_MANUAL';
                causeRigetto[code] = (causeRigetto[code] || 0) + 1;
            }
        });

        const cr = totaleLeadMese > 0 ? ((successi / totaleLeadMese) * 100).toFixed(1) : '0.0';

        // Cause di rigetto formattate
        const causeStr = Object.keys(causeRigetto).length > 0
            ? Object.entries(causeRigetto).map(([k, v]) => `${k}: ${v}`).join(' | ')
            : 'NESSUNO';

        // --- Costruzione HTML accordion ---
        const monthDiv = document.createElement('div');
        monthDiv.className = 'ledger-month-block';

        const isFirst = idx === 0;
        const headerEl = document.createElement('div');
        headerEl.className = 'ledger-month-header';
        headerEl.innerHTML = `
            <span>[${isFirst ? '-' : '+'}] ${monthLabel} <small style="opacity:0.5; font-size:10px;">(${totaleLeadMese} ISTANZE)</small></span>
            <button class="btn-frost btn-export" data-month="${monthLabel}" title="Esporta CSV del mese">ESPORTA LEDGER</button>
        `;

        // Tabella istantanea righe
        const tableRows = records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(r => {
            const data = r.timestamp ? new Date(r.timestamp).toLocaleDateString('it-IT') : 'N/D';
            const id   = r.idIstanza || 'N/D';
            const nome = extractClientName(r.clientName);
            const status = r._queue;
            const val  = _parseMoney(r.budget);
            const valStr = val > 0 ? `€${val.toLocaleString('it-IT')}` : '—';
            const statusColor = status === 'COMPLETED' ? 'var(--sys-trigger-active)'
                              : status === 'REJECTED'  ? 'var(--accent-red)'
                              : status === 'FROZEN'    ? 'rgba(100,180,255,0.8)'
                              : status === 'ACTIVE'    ? 'rgba(255,200,80,0.9)'
                              : 'var(--text-muted)';
            return `<tr>
                <td>${data}</td>
                <td style="font-family:var(--font-mono);font-size:10px;">${id}</td>
                <td>${nome}</td>
                <td style="color:${statusColor};font-size:10px;">${status}</td>
                <td style="color:var(--sys-trigger-active);">${valStr}</td>
            </tr>`;
        }).join('');

        const bodyEl = document.createElement('div');
        bodyEl.className = 'ledger-month-body';
        bodyEl.style.display = isFirst ? 'block' : 'none';
        bodyEl.innerHTML = `
            <div class="micro-hud">
                <div>FATTURATO CHIUSO: <span class="sys-highlight sys-highlight--money">€${Math.floor(fatturatoChiuso).toLocaleString('it-IT')}</span></div>
                <div>LIQUIDITÀ IN ENTRATA: <span class="sys-highlight sys-highlight--money">€${Math.floor(liquiditaEntrata).toLocaleString('it-IT')}</span></div>
                <div>CR MESE: <span class="sys-highlight sys-highlight--money">${cr}%</span></div>
            </div>
            <div class="rejection-stats">
                CAUSE DI RIGETTO: ${causeStr}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Status</th>
                        <th>Valore</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;

        monthDiv.appendChild(headerEl);
        monthDiv.appendChild(bodyEl);
        container.appendChild(monthDiv);

        // --- Event Listener Accordion ---
        headerEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-export') || e.target.closest('.btn-export')) {
                // Esporta PDF con metriche del mese
                esportaLedgerPDF(monthLabel, records, { fatturatoChiuso, liquiditaEntrata, cr, causeStr });
                return;
            }
            const span = headerEl.querySelector('span');
            if (bodyEl.style.display === 'none') {
                bodyEl.style.display = 'block';
                span.textContent = span.textContent.replace('[+]', '[-]');
            } else {
                bodyEl.style.display = 'none';
                span.textContent = span.textContent.replace('[-]', '[+]');
            }
        });
    });
}

/**
 * Apre il Dossier di un utente cercando nell'intero dashboardData per email.
 * @param {string} email - Indirizzo email da cercare.
 */
function apriDossierUtente(email) {
    if (!email) return;

    const panel = document.getElementById('user-dossier-panel');
    if (!panel) return;

    // Scan completo su tutte le code (record strutturati come oggetti)
    const allRecords = [
        ...(dashboardData.pending   || []),
        ...(dashboardData.waiting   || []),
        ...(dashboardData.active    || []),
        ...(dashboardData.rejected  || []),
        ...(dashboardData.completed || []),
        ...(dashboardData.frozen    || [])
    ];

    const emailNorm = email.trim().toLowerCase();
    const requestsHistory = allRecords.filter(r =>
        r.clientEmail && r.clientEmail.trim().toLowerCase() === emailNorm
    );

    if (requestsHistory.length === 0) {
        sysAlert(`[ERRORE] Entità non trovata per: ${email}`);
        panel.style.display = 'none';
        return;
    }

    // Dati identità dal primo record trovato
    const firstRecord = requestsHistory[0];
    document.getElementById('dossier-email').textContent = emailNorm;
    document.getElementById('dossier-name').textContent  = extractClientName(firstRecord.clientName) || 'N/D';

    // Calcolo LTV: somma budget di tutti i record COMPLETATI o con valore finanziario reale
    let totalValue = 0;
    requestsHistory.forEach(r => {
        totalValue += _parseMoney(r.budget);
    });
    document.getElementById('dossier-ltv').innerHTML =
        `LTV: <span class="sys-highlight sys-highlight--money">€${Math.floor(totalValue).toLocaleString('it-IT')}</span>`;

    // Trust Tags dinamici
    const trustContainer = document.querySelector('.trust-tags-container');
    if (trustContainer) {
        trustContainer.innerHTML = '';
        const hasCompleted = requestsHistory.some(r => (r.status || '').toString().toUpperCase().includes('COMPLETED') || (dashboardData.completed || []).some(c => c.idIstanza === r.idIstanza));
        const isMultiClient = requestsHistory.length > 1;
        if (hasCompleted) trustContainer.innerHTML += `<span class="trust-tag trust-tag--positive">[VERIFIED_CLIENT]</span>`;
        if (isMultiClient) trustContainer.innerHTML += `<span class="trust-tag trust-tag--positive">[REPEAT_CUSTOMER]</span>`;
        if (!hasCompleted && !isMultiClient) trustContainer.innerHTML += `<span class="trust-tag">[NEW_LEAD]</span>`;
    }

    // Popolamento tabella storico
    const historyBody = document.getElementById('dossier-history-body');
    historyBody.innerHTML = '';
    requestsHistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(r => {
            const id     = r.idIstanza || 'N/D';
            const scope  = r.scope    || '—';
            const status = r.status   || '—';
            let dateStr  = 'N/D';
            try { dateStr = new Date(r.timestamp).toLocaleDateString('it-IT'); } catch(e) {}

            const isCompleted = (dashboardData.completed || []).some(c => c.idIstanza === id);
            const isRejected  = (dashboardData.rejected  || []).some(c => c.idIstanza === id);
            const statusColor = isCompleted ? 'var(--sys-trigger-active)'
                              : isRejected  ? 'var(--accent-red)'
                              : 'var(--text-muted)';

            historyBody.innerHTML += `
                <tr>
                    <td style="font-family:var(--font-mono);font-size:10px;">${id}</td>
                    <td><span style="font-family:var(--font-mono);font-size:10px;color:${statusColor}">${scope}</span></td>
                    <td>${dateStr}</td>
                </tr>
            `;
        });

    // Radar Comunicazioni: log delle note interne come timeline
    const auditTrail = document.querySelector('.audit-trail-timeline');
    if (auditTrail) {
        auditTrail.innerHTML = '';
        requestsHistory.forEach(r => {
            if (!r.internalNotes) return;
            let dateStr = 'N/D';
            try { dateStr = new Date(r.timestamp).toLocaleString('it-IT'); } catch(e) {}
            auditTrail.innerHTML += `
                <div class="audit-dot">
                    <div class="audit-text">[${r.idIstanza}] ${r.internalNotes.substring(0, 120)}${r.internalNotes.length > 120 ? '...' : ''}</div>
                    <div class="audit-date">${dateStr}</div>
                </div>
            `;
        });
        if (!auditTrail.innerHTML.trim()) {
            auditTrail.innerHTML = `<div style="color:var(--text-muted);font-size:10px;font-family:var(--font-mono);">[NESSUN LOG DISPONIBILE]</div>`;
        }
    }

    panel.style.display = 'block';
}

/**
 * Costruisce la lista utenti completa (deduplicata per email, ordinata A→Z).
 * Ogni riga è cliccabile e apre il Dossier dell'utente.
 */
function renderListaUtenti() {
    const container = document.getElementById('utenti-list-container');
    if (!container) return;

    // Raccoglie tutti i record da tutte le code
    const allRecords = [
        ...(dashboardData.pending   || []),
        ...(dashboardData.waiting   || []),
        ...(dashboardData.active    || []),
        ...(dashboardData.rejected  || []),
        ...(dashboardData.completed || []),
        ...(dashboardData.frozen    || [])
    ];

    // Deduplicazione per email — tiene il record più recente per ogni utente
    const utentiMap = {};
    allRecords.forEach(r => {
        if (!r.clientEmail) return;
        const emailKey = r.clientEmail.trim().toLowerCase();
        if (!utentiMap[emailKey]) {
            utentiMap[emailKey] = { email: emailKey, name: extractClientName(r.clientName), records: [] };
        }
        utentiMap[emailKey].records.push(r);
    });

    const utenti = Object.values(utentiMap);

    if (utenti.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;padding:12px 0;">[NESSUNA ENTITÀ NEL DATABASE]</div>`;
        return;
    }

    // Ordinamento alfabetico per nome (fallback: email)
    utenti.sort((a, b) => {
        const nA = (a.name || a.email).toLowerCase();
        const nB = (b.name || b.email).toLowerCase();
        return nA.localeCompare(nB, 'it');
    });

    // Header contatore
    container.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.12em;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);">
            REGISTRO ENTITÀ — ${utenti.length} NODI TOTALI
        </div>
    `;

    // Costruisce le righe
    utenti.forEach(u => {
        const totalIstanze = u.records.length;
        const hasCompleted = (dashboardData.completed || []).some(c => c.clientEmail && c.clientEmail.trim().toLowerCase() === u.email);
        const hasActive    = (dashboardData.active    || []).some(c => c.clientEmail && c.clientEmail.trim().toLowerCase() === u.email);

        const statusDot = hasCompleted ? 'var(--sys-trigger-active)'
                        : hasActive    ? 'rgba(255,200,80,0.9)'
                        : 'rgba(255,255,255,0.25)';

        const row = document.createElement('div');
        row.className = 'utenti-list-row';
        row.dataset.email = u.email;
        row.dataset.name  = u.name.toLowerCase();
        row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.15s ease;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        `;

        row.innerHTML = `
            <span style="width:7px;height:7px;border-radius:50%;background:${statusDot};flex-shrink:0;"></span>
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;color:var(--text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name || '—'}</div>
                <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.email}</div>
            </div>
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);flex-shrink:0;">${totalIstanze} ISTANZA${totalIstanze !== 1 ? 'E' : ''}</span>
            <span style="font-family:var(--font-mono);font-size:10px;color:rgba(255,255,255,0.2);flex-shrink:0;">→</span>
        `;

        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.04)'; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; });
        row.addEventListener('click', () => {
            // Popola la searchbar con l'email cliccata
            const searchEl = document.getElementById('sys-user-search');
            if (searchEl) searchEl.value = u.email;
            apriDossierUtente(u.email);
        });

        container.appendChild(row);
    });
}

/**
 * Filtra in real-time la lista utenti in base alla query (nome o email).
 * @param {string} query - Testo di ricerca.
 */
function filtraListaUtenti(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.utenti-list-row').forEach(row => {
        const email = row.dataset.email || '';
        const name  = row.dataset.name  || '';
        row.style.display = (!q || email.includes(q) || name.includes(q)) ? '' : 'none';
    });
}

// =========================================================================
// [MODULO REPORT ERRORI] - Network Logs & Black Box Diagnostics
// =========================================================================

/**
 * Popola la tabella Network Logs con i record del foglio LOG_EMAIL (8 colonne).
 * @param {Array} logs - Array di oggetti { timestamp, idIstanza, email, type, subject, status, errMsg, mittente }
 */
function renderNetworkLogs(logs) {
    const tbody = document.getElementById('table-body-network-logs');
    const counter = document.getElementById('network-log-count');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:10px;padding:20px;">[NESSUN LOG DISPONIBILE]</td></tr>`;
        if (counter) counter.textContent = 'LOG EMAIL — 0 RECORD';
        return;
    }

    if (counter) counter.textContent = `LOG EMAIL — ${logs.length} RECORD`;

    // Palette trigger
    const typeColors = {
        'OTP_AUTH':          'rgba(200,150,255,0.85)',
        'PROPOSAL_PDF':      'rgba(100,160,255,0.85)',
        'PAYMENT_CONFIRMED': 'var(--sys-trigger-active)',
        'CRITICAL_PANIC':    'var(--accent-red)',
        'BROADCAST':         'rgba(255,180,80,0.85)',
        'AI_REJECTION':      'rgba(255,100,80,0.85)'
    };

    logs.forEach(log => {
        const tr = document.createElement('tr');

        // Timestamp
        let timeStr = '—';
        try { timeStr = new Date(log.timestamp).toLocaleString('it-IT'); } catch(e) {}

        // STATUS color
        const status = (log.status || 'UNKNOWN').toUpperCase();
        let statusColor = 'var(--text-muted)';
        let statusGlow  = '';
        if (status === 'SENT') {
            statusColor = 'var(--sys-trigger-active)';
        } else if (status === 'ERROR' || status.includes('FAIL') || status.includes('BOUNCE')) {
            statusColor = 'var(--accent-red)';
            statusGlow  = '0 0 8px rgba(180,40,40,0.5)';
        } else if (status === 'PENDING') {
            statusColor = 'rgba(255,200,80,0.9)';
        }

        // TRIGGER badge color
        const typeColor = typeColors[log.type] || 'var(--text-muted)';

        // ERRORE (visibile solo se presente)
        const errCell = log.errMsg
            ? `<span style="color:var(--accent-red);font-size:9px;font-family:var(--font-mono);" title="${log.errMsg}">⚠ ${log.errMsg.substring(0, 40)}${log.errMsg.length > 40 ? '…' : ''}</span>`
            : `<span style="color:var(--text-muted);font-size:9px;">—</span>`;

        // MITTENTE badge
        const mittenteIsAuto = (log.mittente || '').includes('SYSTEM');
        const mittenteLabel  = mittenteIsAuto ? 'SYS' : 'ADM';
        const mittenteColor  = mittenteIsAuto ? 'rgba(255,255,255,0.25)' : 'rgba(100,160,255,0.7)';

        tr.innerHTML = `
            <td style="font-family:var(--font-mono);font-size:10px;white-space:nowrap;">${timeStr}</td>
            <td style="font-family:var(--font-mono);font-size:10px;color:rgba(255,255,255,0.5);">${log.idIstanza || '—'}</td>
            <td style="font-family:var(--font-mono);font-size:10px;color:rgba(255,255,255,0.7);">${log.email || '—'}</td>
            <td><span style="font-family:var(--font-mono);font-size:9px;color:${typeColor};letter-spacing:0.06em;font-weight:600;">${log.type || '—'}</span></td>
            <td style="font-size:11px;color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${log.subject || ''}">${log.subject || '—'}</td>
            <td><span style="font-family:var(--font-mono);font-size:10px;font-weight:bold;color:${statusColor};text-shadow:${statusGlow};">${status}</span></td>
            <td>${errCell}</td>
            <td><span style="font-family:var(--font-mono);font-size:9px;color:${mittenteColor};letter-spacing:0.04em;">${mittenteLabel}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Logger client-side per la Black Box Diagnostics.
 * Aggiunge una riga timestampata al terminale #blackbox-terminal.
 * @param {string} message - Il messaggio da loggare.
 * @param {string} type    - Tipo: BOOT | AUTH | DATA | NET | OPS | WARN | ERR
 */
/**
 * Popola il terminale Black Box con i record persistenti da LOG_SYSTEM.
 * @param {Array} logs - Array da adminGetSystemLogs: { timestamp, severity, source, eventCode, detail, context, sessionId }
 */
function renderBlackBox(logs) {
    const terminal = document.getElementById('blackbox-terminal');
    const counter  = document.getElementById('blackbox-log-count');
    if (!terminal) return;

    terminal.innerHTML = '';

    if (!logs || logs.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:var(--text-muted);font-size:10px;text-align:center;padding:20px;';
        empty.textContent = '[NESSUN EVENTO REGISTRATO]';
        terminal.appendChild(empty);
        if (counter) counter.textContent = 'LOG SISTEMA — 0 EVENTI';
        return;
    }

    if (counter) counter.textContent = `LOG SISTEMA — ${logs.length} EVENTI`;

    const severityColors = {
        'INFO':     '#a0a0ff',
        'WARN':     '#ffcc44',
        'ERROR':    '#ff7755',
        'CRITICAL': '#ff3333'
    };
    const sourceColors = {
        'AI_CASCADE':       'rgba(200,150,255,0.8)',
        'EVALUATION_CHAT':  'rgba(100,200,255,0.8)',
        'BACKEND_CORE':     'rgba(255,180,80,0.8)'
    };

    logs.forEach(log => {
        let timeStr = '—';
        try { timeStr = new Date(log.timestamp).toLocaleString('it-IT'); } catch(e) {}

        const sevColor  = severityColors[log.severity]  || '#e0e0e0';
        const srcColor  = sourceColors[log.source]      || 'rgba(255,255,255,0.4)';

        const line = document.createElement('div');
        line.style.cssText = `
            padding: 5px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;

        // Riga principale: timestamp + severity + source + eventCode
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        header.innerHTML = `
            <span style="color:rgba(255,255,255,0.25);font-size:9px;white-space:nowrap;">${timeStr}</span>
            <span style="color:${sevColor};font-family:var(--font-mono);font-size:9px;font-weight:700;letter-spacing:0.08em;">[${log.severity}]</span>
            <span style="color:${srcColor};font-family:var(--font-mono);font-size:9px;">${log.source}</span>
            <span style="color:rgba(255,255,255,0.7);font-family:var(--font-mono);font-size:10px;font-weight:600;">${log.eventCode}</span>
        `;
        line.appendChild(header);

        // Riga dettaglio
        if (log.detail) {
            const detail = document.createElement('div');
            detail.style.cssText = 'color:rgba(255,255,255,0.55);font-size:10px;padding-left:4px;line-height:1.4;';
            detail.textContent = log.detail;
            line.appendChild(detail);
        }

        // Riga contesto + sessionId (collassata, espandibile al click)
        if (log.context || log.sessionId) {
            const meta = document.createElement('div');
            meta.style.cssText = 'color:rgba(255,255,255,0.2);font-family:var(--font-mono);font-size:8px;padding-left:4px;';
            meta.textContent = [log.sessionId ? `SID:${log.sessionId}` : '', log.context].filter(Boolean).join(' | ');
            line.appendChild(meta);
        }

        terminal.appendChild(line);
    });
}

function sysLog(message, type = 'OPS') {
    const terminal = document.getElementById('blackbox-terminal');
    if (!terminal) return;

    const now = new Date().toLocaleTimeString('it-IT', { hour12: false });

    const typeColors = {
        'BOOT': '#64c87a',   // verde
        'AUTH': '#64c8c8',   // ciano
        'DATA': '#a0a0ff',   // lavanda
        'NET':  '#80c8ff',   // azzurro
        'OPS':  '#e0e0e0',   // bianco
        'WARN': '#ffcc44',   // giallo
        'ERR':  '#ff5555'    // rosso
    };
    const color = typeColors[type] || '#e0e0e0';

    const line = document.createElement('div');
    line.style.cssText = `
        padding: 2px 0;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        animation: syslog-fadein 0.3s ease;
    `;
    line.innerHTML = `
        <span style="color:rgba(255,255,255,0.3);font-size:9px;">${now}</span>
        <span style="color:${color};font-size:10px;margin-left:8px;">${message}</span>
    `;

    terminal.insertBefore(line, terminal.firstChild); // Più recente in cima

    // Limita a 100 righe per non appesantire il DOM
    while (terminal.children.length > 100) {
        terminal.removeChild(terminal.lastChild);
    }
}

// =========================================================================
// [MODULO DIAGNOSTICO] - System Toasts & Error Handling
// =========================================================================

/**
 * Genera una notifica Toast non bloccante.
 * @param {string} messaggio - Il testo da visualizzare.
 * @param {string} tipo - 'error' (rosso) o 'warning' (ambra). Default: 'error'.
 */
function sysToast(messaggio, tipo = 'error') {
    const container = document.getElementById('sys-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `sys-toast toast-${tipo}`;
    toast.textContent = messaggio;

    container.appendChild(toast);

    // Fade out automatico
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        // Rimuovi dal DOM dopo l'animazione (300ms)
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// =========================================================================
// [SISTEMA NOTIFICHE PWA] - Notifiche Native
// =========================================================================

function sysNotify(title, options = {}) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(function(registration) {
                registration.showNotification(title, {
                    icon: 'logo-pwa.svg',
                    badge: 'logo-pwa.svg',
                    ...options
                });
            });
        } else {
            new Notification(title, { icon: 'logo-pwa.svg', ...options });
        }
    }
}

let _sysPollingInterval = null;
let _lastPendingCount = 0;

function setupBackgroundPolling() {
    if (_sysPollingInterval) clearInterval(_sysPollingInterval);
    _lastPendingCount = dashboardData.pending ? dashboardData.pending.length : 0;
    
    _sysPollingInterval = setInterval(async () => {
        if (!masterPassword) return; // Non polla se disconnesso
        const res = await sendToBackend('ADMIN_GET_DASHBOARD', {});
        if (res && !res.error) {
            const newPendingCount = res.pending ? res.pending.length : 0;
            if (newPendingCount > _lastPendingCount) {
                sysNotify("Nuova Richiesta Preventivo!", { 
                    body: "Ci sono nuovi preventivi in coda da valutare." 
                });
            }
            _lastPendingCount = newPendingCount;
            dashboardData = res;
            renderTables();
        }
    }, 180000); // 3 minuti
}
