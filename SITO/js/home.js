/**
 * SITOSS NODEBETAV1.0.0 — HOME.JS
 * Finite State Machine con Action Lock.
 *
 * STATI:
 *   contacts  → visibili (opacity 1) / nascosti (opacity 0)
 *   method    → aperto (translateY 0) / chiuso (translateY 100%)
 *
 * SWIPE DOWN (rawDelta > 0 | wheel su):
 *   [method APERTO]  → closeMethod()
 *   [method CHIUSO]  → toggleContacts()
 *
 * SWIPE UP (rawDelta < 0 | wheel giù):
 *   → openMethod() + closeContacts()
 *
 * ACTION LOCK: un singolo gesto produce una sola azione.
 *   Touch: lock ON al commit → unlock al touchend
 *   Wheel: lock ON al commit → unlock dopo 500ms
 */

'use strict';

(function SYSHomeEngine() {

    /* ─── Nodi DOM ─────────────────────────────────────────────────────── */
    const bottomActions = document.getElementById('sys-bottom-actions');
    const methodPanel   = document.getElementById('sys-method-panel');

    if (!bottomActions || !methodPanel) return;

    /* ─── Costanti ─────────────────────────────────────────────────────── */
    const THRESHOLD_RATIO  = 0.40;   // 40% VH
    const WHEEL_MIN_DELTA  = 10;     // px — tolleranza anti-jitter
    const WHEEL_DEBOUNCE   = 400;    // ms — reset accum dopo inattività
    const LOCK_RELEASE_MS  = 500;    // ms — finestra refrattaria post-azione (wheel)

    /* ─── Stato privato ────────────────────────────────────────────────── */
    const State = Object.seal({
        areContactsOn: false,
        areMethodOn:   false,
        actionLocked:  false,
        touchStartY:   0,
        wheelAccum:    0,
        wheelDebounce: null,
        lockTimer:     null,
    });

    /* ─── Soglia dinamica ──────────────────────────────────────────────── */
    function threshold() {
        return window.innerHeight * THRESHOLD_RATIO;
    }

    /* ═══════════════════════════════════════════════════════════════════
       PRIMITIVE DI STATO — apri / chiudi atomici
    ═══════════════════════════════════════════════════════════════════ */

    function openContacts() {
        if (!State.areContactsOn) {
            bottomActions.classList.add('is-active');
            bottomActions.setAttribute('aria-hidden', 'false');
            State.areContactsOn = true;
        }
    }

    function closeContacts() {
        if (State.areContactsOn) {
            bottomActions.classList.remove('is-active');
            bottomActions.setAttribute('aria-hidden', 'true');
            State.areContactsOn = false;
        }
    }

    function toggleContacts() {
        State.areContactsOn ? closeContacts() : openContacts();
    }

    function openMethod() {
        if (!State.areMethodOn) {
            methodPanel.classList.add('is-active');
            methodPanel.setAttribute('aria-hidden', 'false');
            State.areMethodOn = true;
        }
    }

    function closeMethod() {
        if (State.areMethodOn) {
            methodPanel.classList.remove('is-active');
            methodPanel.setAttribute('aria-hidden', 'true');
            State.areMethodOn = false;
        }
    }

    /* ═══════════════════════════════════════════════════════════════════
       REGOLE DI INTERAZIONE — macchina a stati finiti
    ═══════════════════════════════════════════════════════════════════ */

    /* SWIPE DOWN → chiude method se aperto, altrimenti toggleContacts */
    function onSwipeDown() {
        if (State.areMethodOn) {
            closeMethod();
        } else {
            toggleContacts();
        }
    }

    /* SWIPE UP → apre method + chiude contacts */
    function onSwipeUp() {
        openMethod();
        closeContacts();
    }

    /* ═══════════════════════════════════════════════════════════════════
       TOUCH — delta assoluto dal punto iniziale
    ═══════════════════════════════════════════════════════════════════ */

    window.addEventListener('touchstart', function (e) {
        State.touchStartY  = e.touches[0].clientY;
        State.actionLocked = false; /* Ogni nuovo tocco parte sbloccato */
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
        e.preventDefault();

        /* Action lock: un solo commit per gesto */
        if (State.actionLocked) return;

        const currentY = e.touches[0].clientY;
        const rawDelta = currentY - State.touchStartY;
        const th       = threshold();

        if (rawDelta >= th) {
            /* Soglia SWIPE DOWN raggiunta */
            onSwipeDown();
            State.actionLocked = true;
        } else if (rawDelta <= -th) {
            /* Soglia SWIPE UP raggiunta */
            onSwipeUp();
            State.actionLocked = true;
        }
        /* Nessun rollback intermedio — i layer rimangono stabili */

    }, { passive: false });

    window.addEventListener('touchend', function () {
        /* Sblocca sempre al rilascio del dito */
        State.actionLocked = false;
        State.touchStartY  = 0;
    }, { passive: true });

    /* ═══════════════════════════════════════════════════════════════════
       WHEEL — accumulatore bidirezionale con lock
    ═══════════════════════════════════════════════════════════════════ */

    window.addEventListener('wheel', function (e) {
        e.preventDefault();

        /* Ignora componente orizzontale dominante */
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) + 5) return;

        /* Tolleranza anti-jitter */
        if (Math.abs(e.deltaY) < WHEEL_MIN_DELTA) return;

        /* Durante finestra refrattaria — accumulo silenzioso continua
           ma nessuna ulteriore azione viene eseguita */
        if (State.actionLocked) {
            /* Reset debounce comunque per evitare accumulo fantasma */
            clearTimeout(State.wheelDebounce);
            State.wheelDebounce = setTimeout(() => {
                State.wheelAccum = 0;
            }, WHEEL_DEBOUNCE);
            return;
        }

        State.wheelAccum += e.deltaY;

        const th = threshold();

        if (State.wheelAccum <= -th) {
            /* Rotella SU → SWIPE DOWN */
            onSwipeDown();
            State.wheelAccum   = 0;
            State.actionLocked = true;

            /* Finestra refrattaria: sblocca dopo LOCK_RELEASE_MS */
            clearTimeout(State.lockTimer);
            State.lockTimer = setTimeout(() => {
                State.actionLocked = false;
            }, LOCK_RELEASE_MS);

        } else if (State.wheelAccum >= th) {
            /* Rotella GIÙ → SWIPE UP */
            onSwipeUp();
            State.wheelAccum   = 0;
            State.actionLocked = true;

            clearTimeout(State.lockTimer);
            State.lockTimer = setTimeout(() => {
                State.actionLocked = false;
            }, LOCK_RELEASE_MS);
        }

        /* Debounce: reset accum se l'utente smette senza raggiungere soglia */
        clearTimeout(State.wheelDebounce);
        State.wheelDebounce = setTimeout(() => {
            State.wheelAccum = 0;
        }, WHEEL_DEBOUNCE);

    }, { passive: false });

})();
