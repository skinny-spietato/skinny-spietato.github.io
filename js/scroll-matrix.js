/**
 * SITOSS NODEBETAV1.0.0 — SCROLL MATRIX v2.1
 * Infinite Horizontal Scroll Engine
 */

'use strict';

(function ScrollMatrix() {
    const slider = document.getElementById('sys-slider-container');
    if (!slider) return;

    const originalSlides = Array.from(slider.querySelectorAll('.sys-case-study-slide'));
    if (originalSlides.length === 0) return;

    // 1. Clona la prima e l'ultima slide
    const firstClone = originalSlides[0].cloneNode(true);
    const lastClone = originalSlides[originalSlides.length - 1].cloneNode(true);

    // Rimuove gli ID per evitare conflitti
    firstClone.removeAttribute('id');
    lastClone.removeAttribute('id');

    // Inizializza i video nei cloni
    const clonedVideos = [...firstClone.querySelectorAll('video'), ...lastClone.querySelectorAll('video')];
    clonedVideos.forEach(video => {
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.play().catch(() => {});
    });

    // 2. Inserisce i cloni nel DOM
    slider.insertBefore(lastClone, originalSlides[0]);
    slider.appendChild(firstClone);

    let slideWidth = slider.clientWidth;
    let isJumping = false;

    // 3. Posizionamento Iniziale (salta il clone di coda)
    requestAnimationFrame(() => {
        slider.scrollLeft = slideWidth;
    });

    // 4. Meccanica di salto invisibile Anti-Flicker (Debounced per iOS)
    let scrollTimeout;
    
    slider.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        
        // Aspettiamo 150ms dalla fine del movimento prima di saltare.
        // Questo previene il bug di iOS dove il "momentum" e lo "scroll-snap"
        // costringono la pagina a rimbalzare indietro alla slide precedente.
        scrollTimeout = setTimeout(() => {
            const scrollPos = slider.scrollLeft;
            const maxScroll = slider.scrollWidth - slideWidth;

            // Utente scorre a destra (raggiunge il clone di coda)
            if (scrollPos >= maxScroll - 5) { 
                slider.style.scrollSnapType = 'none';
                slider.scrollLeft = slideWidth;
                slider.offsetHeight; // Forza il reflow
                slider.style.scrollSnapType = 'x mandatory';
            }
            // Utente scorre a sinistra (raggiunge il clone di testa)
            else if (scrollPos <= 5) {
                slider.style.scrollSnapType = 'none';
                slider.scrollLeft = slideWidth * originalSlides.length;
                slider.offsetHeight;
                slider.style.scrollSnapType = 'x mandatory';
            }
        }, 150);
    });

    // 5. Ricalibrazione dinamica
    window.addEventListener('resize', () => {
        slideWidth = slider.clientWidth;
        if (slider.scrollLeft < slideWidth) {
             slider.scrollLeft = slideWidth;
        }
    });

})();


/* ==========================================================================
   MOTORE CINETICO "ALL SYSTEMS" [PHASE-3] — SWIPE-TO-REVEAL
   ========================================================================== */
(function AllSystemsKinetics() {
    'use strict';

    const overlay = document.getElementById('sys-all-systems-overlay');
    const slider = document.getElementById('sys-slider-container');
    if (!overlay || !slider) return;

    // 1. Costanti e Stato
    const THRESHOLD_RATIO = 0.40;
    const LOCK_RELEASE_MS = 500;

    const AllSystemsState = {
        isOpen: false,
        actionLocked: false,
        wheelAccum: 0,
        touchStart: 0
    };

    let decayTimer = null;

    // 2. Logica "Bottom-Check"
    function isAtBottom(slide) {
        if (!slide) return false;
        return slide.scrollTop + slide.clientHeight >= slide.scrollHeight - 5;
    }

    // 3. Azione di Apertura/Chiusura
    function openAllSystems() {
        if (AllSystemsState.isOpen || AllSystemsState.actionLocked) return;
        
        AllSystemsState.isOpen = true;
        AllSystemsState.actionLocked = true;
        AllSystemsState.wheelAccum = 0;

        overlay.classList.add('is-active');
        overlay.setAttribute('aria-hidden', 'false');

        setTimeout(() => { AllSystemsState.actionLocked = false; }, LOCK_RELEASE_MS);
    }

    function closeAllSystems() {
        if (!AllSystemsState.isOpen || AllSystemsState.actionLocked) return;

        AllSystemsState.isOpen = false;
        AllSystemsState.actionLocked = true;
        AllSystemsState.wheelAccum = 0;

        overlay.classList.remove('is-active');
        overlay.setAttribute('aria-hidden', 'true');

        // Chiude la preview (HUD Scanner) se aperta
        const previewUnit = document.getElementById('sys-all-systems-preview');
        if (previewUnit && previewUnit.classList.contains('is-scanning')) {
            previewUnit.classList.remove('is-scanning');
            document.querySelectorAll('.sys-grid-cell.sys-target-locked').forEach(c => c.classList.remove('sys-target-locked'));
            setTimeout(() => { previewUnit.innerHTML = ''; }, 300);
        }

        setTimeout(() => { AllSystemsState.actionLocked = false; }, LOCK_RELEASE_MS);
    }

    function getActiveSlide() {
        const slides = slider.querySelectorAll('.sys-case-study-slide');
        const currentIndex = Math.round(slider.scrollLeft / slider.clientWidth);
        return slides[currentIndex];
    }

    // 4. Gestione Eventi (Wheel & Touch)
    window.addEventListener('wheel', (e) => {
        if (AllSystemsState.actionLocked) return;

        const threshold = window.innerHeight * THRESHOLD_RATIO;
        const dy = e.deltaY;

        if (AllSystemsState.isOpen) {
            // Swipe down to close (deltaY < 0 means rotating up, pulling content down)
            if (dy < 0) {
                AllSystemsState.wheelAccum += dy;
                if (AllSystemsState.wheelAccum <= -threshold) {
                    closeAllSystems();
                }
            } else {
                AllSystemsState.wheelAccum = 0;
            }
        } else {
            // Swipe up to open (deltaY > 0 means rotating down, pulling content up)
            if (dy > 0 && isAtBottom(getActiveSlide())) {
                AllSystemsState.wheelAccum += dy;
                if (AllSystemsState.wheelAccum >= threshold) {
                    openAllSystems();
                }
            } else {
                AllSystemsState.wheelAccum = 0;
            }
        }

        clearTimeout(decayTimer);
        decayTimer = setTimeout(() => {
            AllSystemsState.wheelAccum = 0;
        }, 300);
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
        AllSystemsState.touchStart = e.touches[0].clientY;
        AllSystemsState.wheelAccum = 0;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (AllSystemsState.actionLocked) return;

        const currentY = e.touches[0].clientY;
        const dy = AllSystemsState.touchStart - currentY; // Positive = swipe up

        const threshold = window.innerHeight * THRESHOLD_RATIO;

        if (AllSystemsState.isOpen) {
            // Swipe down (dy < 0) to close
            if (dy < -threshold) {
                closeAllSystems();
            }
        } else {
            // Swipe up (dy > 0) to open, only if at bottom
            if (dy > threshold && isAtBottom(getActiveSlide())) {
                openAllSystems();
            }
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        setTimeout(() => { AllSystemsState.wheelAccum = 0; }, 150);
    }, { passive: true });

})();

/* ==========================================================================
   MODULO SMART BAR — AUTO-HIDE ACCESS BAR
   Nasconde la top bar scorrendo in basso, la rivela scorrendo in alto.
   ========================================================================== */
(function SmartAccessBar() {
    const accessBar = document.getElementById('sys-access-bar');
    if (!accessBar) return;

    // Applica la transizione fluida per il movimento in asse Y
    accessBar.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s, background 0.3s';

    // Attendi un istante affinché i cloni dello slider siano nel DOM
    setTimeout(() => {
        const slides = document.querySelectorAll('.sys-case-study-slide');
        
        slides.forEach(slide => {
            let lastScrollY = slide.scrollTop;
            
            slide.addEventListener('scroll', () => {
                const currentScrollY = slide.scrollTop;
                
                // Scroll verso il basso (> 80px per evitare trigger accidentali all'inizio)
                if (currentScrollY > lastScrollY && currentScrollY > 80) {
                    // Trasla in alto fuori dallo schermo (mantenendo il centro X)
                    accessBar.style.transform = 'translate(-50%, calc(-100% - 30px))';
                } 
                // Scroll verso l'alto
                else if (currentScrollY < lastScrollY) {
                    // Ripristina la posizione originaria
                    accessBar.style.transform = 'translateX(-50%)';
                }
                
                lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
            }, { passive: true });
        });
    }, 100);
})();

/* ==========================================================================
   INIZIALIZZAZIONE MATRIX E TOROIDAL ENGINE (OVERSCAN 14x8) [PHASE-5.2]
   ========================================================================== */
(function InitializeToroidalOverscan() {
    const viewport = document.getElementById('sys-all-systems-grid-viewport');
    const matrixContainer = document.getElementById('sys-all-systems-snake-matrix');
    if (!viewport || !matrixContainer) return;

    // Configurazione Geometria 14x8
    const CELL_SIZE = 54; 
    const COLS = 14; 
    const ROWS = 8;

    // Database Base (72 Asset)
    const basePool = [
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/DICIOTTO.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOSETTE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTOTTO.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/UNO.png' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOQUINDICI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTUNO.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/CINQUANTA.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEODUE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTA.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTUNO.png' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEONOVE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTISETTE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTUNO.png' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOVENTIDUE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/SEI.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTAQUATTRO.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOOTTO.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/DODICI.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOTRE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTADUE.png' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTANOVE.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOUNDICI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTAQUATTRO.png' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/DICIANNOVE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTIDUE.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOSEDICI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/OTTO.JPG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/CINQUE.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOVENTI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTITRE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/DIECI.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOUNO.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUATTORDICI.png' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTISEI.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEODICIASETTE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/CINQUANTUNO.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTANOVE.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOCINQUE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/SETTE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTASEI.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEODODICI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TREDICI.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTATRE.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEODICIOTTO.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTINOVE.png' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTATRE.png' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEODIECI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTASETTE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTA.png' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOSEI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/SEDICI.jpg' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUATTRO.JPG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOTREDICI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTOTTO.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/UNDICI.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOVENTUNO.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTASEI.png' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTICINQUE.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEODICIANNOVE.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTOTTO.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTASETTE.png' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOQUATTRO.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTI.png' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/CINQUANTADUE.PNG' },
        { type: 'video', src: 'https://res.cloudinary.com/db30mvs3d/video/upload/f_auto,q_auto/VIDEO/ALLSYSTEMCOMPRESSI/VIDEOQUATTORDICI.mp4' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTADUE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/VENTIQUATTRO.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/NOVE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/TRENTACINQUE.png' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/QUARANTACINQUE.PNG' },
        { type: 'image', src: 'https://res.cloudinary.com/db30mvs3d/image/upload/w_800,f_auto,q_auto/IMMAGINI/ALLSYSTEMS/DICIASETTE.PNG' }
    ];

    // Riempimento dinamico fino a 112 nodi
    let combinedPool = [...basePool];
    while (combinedPool.length < 112) {
        const randomAsset = basePool[Math.floor(Math.random() * basePool.length)];
        combinedPool.push(randomAsset);
    }
    combinedPool.sort(() => Math.random() - 0.5); // Shuffle finale

// ── RADAR OTTIMIZZAZIONE PERFORMANCE (INTERSECTION OBSERVER) ──
    // Monitora quali celle sono effettivamente visibili nel vetro
    const performanceRadar = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting) {
                // Il video entra nel vetro: Avvia la riproduzione
                let playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {}); // Catch silenzioso
                }
            } else {
                // Il video è nell'overscan (invisibile): Congela il frame per salvare RAM/GPU
                video.pause();
            }
        });
    }, {
        root: viewport, // Usa il contenitore di vetro come limite visivo
        rootMargin: '50px' // Inizia a caricare il video 50px prima che entri nell'inquadratura
    });

    matrixContainer.innerHTML = '';
    
    // Iniezione Nodi
    combinedPool.forEach(asset => {
        const cell = document.createElement('div');
        cell.className = 'sys-grid-cell';
        
        if (asset.type === 'image') {
            const img = document.createElement('img');
            img.src = asset.src;
            // Riattiviamo il lazy loading ora che la struttura è solida
            img.loading = 'lazy'; 
            cell.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = asset.src;
            video.muted = true; 
            video.loop = true; 
            video.playsInline = true; 
            video.preload = 'metadata'; // Non scaricare l'intero video all'inizio
            // RIMOSSO: video.autoplay = true; (Ora lo gestisce il Radar)
            
            video.onerror = function() {
                console.error("Media Decode Error su:", asset.src);
                cell.style.border = "1px solid #ff0000";
                cell.style.background = "rgba(255, 0, 0, 0.2)";
            };
            
            cell.appendChild(video);
            
            // Aggancia il video al Radar di ottimizzazione
            performanceRadar.observe(video);
        }
        matrixContainer.appendChild(cell);
    });

    // 3. Logica Motore Ibrido (Edge-Hover / Touch-Drag)
    let currentX = 0, currentY = 0;
    let mouseX = 0, mouseY = 0;
    let isHovering = false;
    const MAX_SPEED = 2.0;
    const EDGE_THRESHOLD = 0.35;

    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    let isDragging = false;
    let lastTouchX = 0, lastTouchY = 0;

    function shiftColumnLeft() {
        const cells = Array.from(matrixContainer.children);
        for (let r = 0; r < ROWS; r++) matrixContainer.insertBefore(cells[r * COLS], cells[r * COLS + (COLS - 1)].nextSibling);
    }
    function shiftColumnRight() {
        const cells = Array.from(matrixContainer.children);
        for (let r = ROWS - 1; r >= 0; r--) matrixContainer.insertBefore(cells[r * COLS + (COLS - 1)], cells[r * COLS]);
    }
    function shiftRowUp() {
        const cells = Array.from(matrixContainer.children);
        for (let c = 0; c < COLS; c++) matrixContainer.appendChild(cells[c]);
    }
    function shiftRowDown() {
        const cells = Array.from(matrixContainer.children);
        const frag = document.createDocumentFragment();
        for (let c = (ROWS - 1) * COLS; c < ROWS * COLS; c++) frag.appendChild(cells[c]);
        matrixContainer.prepend(frag);
    }

    function updateMatrix() {
        while (currentX <= -CELL_SIZE) { shiftColumnLeft(); currentX += CELL_SIZE; }
        while (currentX >= CELL_SIZE) { shiftColumnRight(); currentX -= CELL_SIZE; }
        while (currentY <= -CELL_SIZE) { shiftRowUp(); currentY += CELL_SIZE; }
        while (currentY >= CELL_SIZE) { shiftRowDown(); currentY -= CELL_SIZE; }
        matrixContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }

    if (isTouchDevice) {
        // Fallback Touch (Drag to Scroll)
        viewport.addEventListener('touchstart', (e) => {
            isDragging = true;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
            if (!viewport.classList.contains('sys-is-moving')) viewport.classList.add('sys-is-moving');
        }, { passive: false });

        viewport.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const currentTouchX = e.touches[0].clientX;
            const currentTouchY = e.touches[0].clientY;
            const deltaX = currentTouchX - lastTouchX;
            const deltaY = currentTouchY - lastTouchY;
            currentX += deltaX;
            currentY += deltaY;
            lastTouchX = currentTouchX;
            lastTouchY = currentTouchY;
            updateMatrix();
        }, { passive: false });

        viewport.addEventListener('touchend', () => {
            isDragging = false;
            if (viewport.classList.contains('sys-is-moving')) viewport.classList.remove('sys-is-moving');
        });
        
        viewport.addEventListener('touchcancel', () => {
            isDragging = false;
            if (viewport.classList.contains('sys-is-moving')) viewport.classList.remove('sys-is-moving');
        });
    } else {
        // Edge Hover Logic per Desktop
        function engineLoop() {
            if (isHovering) {
                const rect = viewport.getBoundingClientRect();
                const nx = (mouseX - rect.left) / rect.width;
                const ny = (mouseY - rect.top) / rect.height;
                let vX = 0, vY = 0;
                
                if (nx < EDGE_THRESHOLD) vX = ((EDGE_THRESHOLD - nx) / EDGE_THRESHOLD) * MAX_SPEED;
                else if (nx > 1 - EDGE_THRESHOLD) vX = -((nx - (1 - EDGE_THRESHOLD)) / EDGE_THRESHOLD) * MAX_SPEED;
                
                if (ny < EDGE_THRESHOLD) vY = ((EDGE_THRESHOLD - ny) / EDGE_THRESHOLD) * MAX_SPEED;
                else if (ny > 1 - EDGE_THRESHOLD) vY = -((ny - (1 - EDGE_THRESHOLD)) / EDGE_THRESHOLD) * MAX_SPEED;

                if (Math.abs(vX) > 0 || Math.abs(vY) > 0) {
                    if (!viewport.classList.contains('sys-is-moving')) viewport.classList.add('sys-is-moving');
                } else {
                    if (viewport.classList.contains('sys-is-moving')) viewport.classList.remove('sys-is-moving');
                }

                currentX += vX; currentY += vY;
                updateMatrix();
            } else {
                if (viewport.classList.contains('sys-is-moving')) viewport.classList.remove('sys-is-moving');
            }
            requestAnimationFrame(engineLoop);
        }
        viewport.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; isHovering = true; });
        viewport.addEventListener('mouseleave', () => { isHovering = false; });
        requestAnimationFrame(engineLoop);
    }
})();

/* ==========================================================================
   HUD SCANNER (SMART FREEZE HOVER) [PHASE-4.2]
   ========================================================================== */
(function ScannerHUD() {
    const previewUnit = document.getElementById('sys-all-systems-preview');
    const matrixContainer = document.getElementById('sys-all-systems-snake-matrix');
    const viewport = document.getElementById('sys-all-systems-grid-viewport');
    if (!previewUnit || !matrixContainer || !viewport) return;

    if (previewUnit.parentNode !== document.body) {
        document.body.appendChild(previewUnit);
    }

    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);

    const handleScan = (e) => {
        if (viewport.classList.contains('sys-is-moving')) return;

        const cell = e.target.closest('.sys-grid-cell');
        if (!cell) return;

        const media = cell.querySelector('img, video');
        if (!media) return;

        document.querySelectorAll('.sys-grid-cell.sys-target-locked').forEach(c => c.classList.remove('sys-target-locked'));
        cell.classList.add('sys-target-locked');

        previewUnit.innerHTML = ''; 

        let clone;
        if (media.tagName.toLowerCase() === 'video') {
            clone = document.createElement('video');
            // DYNAMIC ROUTING: Intercetta il path compresso e forza il caricamento dell'originale HQ
            clone.src = media.src.replace('ALLSYSTEMCOMPRESSI', 'ALLSYSTEMS');
            clone.autoplay = true; clone.loop = true; clone.muted = true; clone.playsInline = true;
        } else {
            clone = document.createElement('img');
            clone.src = media.src;
        }

        clone.className = 'preview-media';
        previewUnit.appendChild(clone);
        previewUnit.classList.add('is-scanning');
    };

    if (isTouchDevice) {
        matrixContainer.addEventListener('click', handleScan);
    } else {
        matrixContainer.addEventListener('mouseover', handleScan);
        viewport.addEventListener('mouseleave', () => {
            previewUnit.classList.remove('is-scanning');
            document.querySelectorAll('.sys-grid-cell.sys-target-locked').forEach(c => c.classList.remove('sys-target-locked'));
            setTimeout(() => {
                if (!previewUnit.classList.contains('is-scanning')) {
                    previewUnit.innerHTML = '';
                }
            }, 300);
        });
    }
})();

/* ==========================================================================
   ACTIVE SYSTEMS RADAR — SMART VIDEO CONTROLLER
   Gestisce l'attivazione automatica dei video solo quando la slide è visibile.
   ========================================================================== */
(function ActiveSystemsRadar() {
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting) {
                // La slide è a schermo: Avvia i video
                video.play().catch(() => {}); 
            } else {
                // La slide è uscita: Ferma i video per risparmiare GPU/RAM
                video.pause();
                video.currentTime = 0; // Reset opzionale per fluidità
            }
        });
    }, {
        threshold: 0.2 // Attiva quando almeno il 20% del video è visibile
    });

    // Aggancia il radar a tutti i video principali delle slide
    document.querySelectorAll('.sys-case-study-slide video').forEach(v => videoObserver.observe(v));
})();
