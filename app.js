/**
 * Farmer-Direct Marketplace
 * Interactive Application Engine (Routing, API Fetching, Simulation)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==================== THEME SYSTEM (Dark / Light Mode) ====================
  // Theme is applied pre-paint by an inline script in <head>; this just wires
  // up the toggle button, persists the choice, and keeps aria state in sync.
  (function initThemeToggle() {
    const root = document.documentElement;
    const toggleBtns = document.querySelectorAll('.theme-toggle');
    if (!toggleBtns.length) return;

    const syncAria = () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      toggleBtns.forEach(btn => btn.setAttribute('aria-checked', String(isDark)));
    };
    syncAria();

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const isDark = root.getAttribute('data-theme') === 'dark';
        const next = isDark ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        syncAria();
      });
    });

    // Follow system preference changes if the user hasn't chosen manually
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem('theme')) return; // respect explicit user choice
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        syncAria();
      });
    }
  })();

  // ==================== 3D TILT DEPTH EFFECT ====================
  // Adds a subtle pointer-tracked perspective tilt to cards (.directory-card,
  // .auth-card) for a "3D glass" feel. Uses event delegation so it keeps
  // working on dynamically-rendered listing cards. Skipped on touch devices
  // and when the user prefers reduced motion (handled primarily via CSS,
  // this JS also bails out early as a safety net).
  // ==================== CURSOR-FOLLOWING BACKGROUND GLOW ====================
  // Moves the small green glow (html::after in styles.css, driven by the
  // --mx/--my CSS variables) toward the cursor. Desktop-only: devices
  // without a real mouse (touch/mobile) never attach this listener, so
  // mobile performance and graphics are completely untouched — the
  // floating background there just keeps its own independent animation.
  (function initCursorGlow() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasRealMouse = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (prefersReducedMotion || !hasRealMouse) return;

    const root = document.documentElement;
    let pendingEvent = null;
    let rafQueued = false;

    const applyGlowPosition = () => {
      rafQueued = false;
      const e = pendingEvent;
      if (!e) return;
      root.style.setProperty('--mx', `${e.clientX}px`);
      root.style.setProperty('--my', `${e.clientY}px`);
    };

    document.addEventListener('mousemove', (e) => {
      pendingEvent = e;
      if (!rafQueued) {
        rafQueued = true;
        requestAnimationFrame(applyGlowPosition);
      }
    }, { passive: true });
  })();

  (function initTiltEffect() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (prefersReducedMotion || isTouchDevice) return;

    const TILT_SELECTOR = '.directory-card, .auth-card';
    const MAX_TILT_DEG = 6;

    // Raw mousemove can fire far faster than the screen can paint (up to
    // several hundred times a second on a fast mouse). Reading
    // getBoundingClientRect() and writing a transform on every single event
    // forces layout/paint work that lower-end devices can't keep up with —
    // that's what reads as "janky". Instead we just remember the latest
    // event and do the actual measure+write once per animation frame via
    // rAF, capping the work to the display's real refresh rate no matter
    // how fast the mouse reports events.
    let pendingTiltEvent = null;
    let tiltRAFQueued = false;

    const applyTilt = () => {
      tiltRAFQueued = false;
      const e = pendingTiltEvent;
      if (!e) return;
      const card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;  // 0 -> 1
      const py = (e.clientY - rect.top) / rect.height;   // 0 -> 1

      const rotateY = (px - 0.5) * (MAX_TILT_DEG * 2);
      const rotateX = (0.5 - py) * (MAX_TILT_DEG * 2);

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    };

    document.addEventListener('mousemove', (e) => {
      pendingTiltEvent = e;
      if (!tiltRAFQueued) {
        tiltRAFQueued = true;
        requestAnimationFrame(applyTilt);
      }
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      const card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
      if (!card) return;
      // Only reset once the pointer actually leaves the card (not on inner element hops)
      if (card.contains(e.relatedTarget)) return;
      card.style.transform = '';
    });
  })();

  // ==================== LIQUID GLASS 27 — MOTION LAYER ====================
  // Decorative/motion only — never touches routing, data fetching, forms,
  // or auth below. Each piece is defensive: a missing element or an older
  // browser just means that one effect quietly doesn't run.
  const lgPrefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lgHasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  // ---- Ripple micro-interaction on buttons, nav, cards, toggle ----
  (function initLiquidGlassRipple() {
    if (lgPrefersReducedMotion) return;

    const RIPPLE_SELECTOR = '.btn, .nav-link, .nav-cta, .theme-toggle, .directory-card, .auth-card, .step-card, .modal-close';

    document.addEventListener('pointerdown', (e) => {
      const host = e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
      if (!host) return;

      host.classList.add('lg-ripple-host');

      const rect = host.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.6 || 60;
      const x = (typeof e.clientX === 'number' ? e.clientX : rect.left + rect.width / 2) - rect.left;
      const y = (typeof e.clientY === 'number' ? e.clientY : rect.top + rect.height / 2) - rect.top;

      const ripple = document.createElement('span');
      ripple.className = 'lg-ripple';
      ripple.style.width = size + 'px';
      ripple.style.height = size + 'px';
      ripple.style.left = (x - size / 2) + 'px';
      ripple.style.top = (y - size / 2) + 'px';

      host.appendChild(ripple);
      const cleanupRipple = () => ripple.remove();
      ripple.addEventListener('animationend', cleanupRipple);
      setTimeout(() => { if (ripple.isConnected) cleanupRipple(); }, 800);
    }, { passive: true });
  })();

  // ---- Theme-switch circular wipe ----
  // Doesn't decide the theme (initThemeToggle above already owns that) —
  // just watches data-theme flip and plays a soft radial flourish centered
  // on wherever the toggle was pressed.
  (function initLiquidGlassThemeWipe() {
    if (lgPrefersReducedMotion || !('MutationObserver' in window)) return;

    let originX = '50%';
    let originY = '50%';

    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        const rect = btn.getBoundingClientRect();
        const clientX = typeof e.clientX === 'number' ? e.clientX : rect.left + rect.width / 2;
        const clientY = typeof e.clientY === 'number' ? e.clientY : rect.top + rect.height / 2;
        originX = (clientX / window.innerWidth * 100) + '%';
        originY = (clientY / window.innerHeight * 100) + '%';
      });
    });

    const observer = new MutationObserver(() => spawnWipe(originX, originY));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function spawnWipe(x, y) {
      const el = document.createElement('div');
      el.className = 'lg-wipe';
      el.style.setProperty('--lg-x', x);
      el.style.setProperty('--lg-y', y);
      document.body.appendChild(el);
      const cleanupWipe = () => el.remove();
      el.addEventListener('animationend', cleanupWipe);
      setTimeout(() => { if (el.isConnected) cleanupWipe(); }, 900);
    }
  })();

  // ---- Hero ambient parallax + dust particles ----
  // The .lg-orb elements themselves live directly in index.html now; this
  // only adds pointer-parallax drift on desktop and generates the drifting
  // dust particles (randomized per load, so JS-generated rather than static).
  (function initLiquidGlassHeroAtmosphere() {
    const hero = document.querySelector('#page-home .hero-section');
    if (!hero) return;

    if (lgHasHover) {
      const orbs = hero.querySelectorAll('.lg-orb'); // queried once, not on every mousemove
      let pendingOrbEvent = null;
      let orbRAFQueued = false;

      const applyOrbParallax = () => {
        orbRAFQueued = false;
        const e = pendingOrbEvent;
        if (!e) return;
        const rect = hero.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        orbs.forEach((orb, i) => {
          const depth = (i + 1) * 9;
          orb.style.transform = `translate(${(px * depth).toFixed(1)}px, ${(py * depth).toFixed(1)}px)`;
        });
      };

      // Same fix as the tilt effect above: batch to one rAF-synced update
      // per frame instead of doing a layout read + N style writes on every
      // raw mousemove event.
      hero.addEventListener('mousemove', (e) => {
        pendingOrbEvent = e;
        if (!orbRAFQueued) {
          orbRAFQueued = true;
          requestAnimationFrame(applyOrbParallax);
        }
      }, { passive: true });
    }

    if (lgPrefersReducedMotion) return;

    const PARTICLE_COUNT = 14;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = document.createElement('div');
      p.className = 'lg-particle';
      const duration = 7 + Math.random() * 7;
      p.style.left = (Math.random() * 100) + '%';
      p.style.bottom = (Math.random() * 30) + '%';
      p.style.animationDuration = duration + 's';
      p.style.animationDelay = '-' + (Math.random() * duration) + 's';
      p.style.opacity = String(0.25 + Math.random() * 0.35);
      hero.appendChild(p);
    }
  })();

  // ---- Magnetic pull on primary CTAs ----
  (function initLiquidGlassMagneticCTA() {
    if (lgPrefersReducedMotion || !lgHasHover) return;

    document.querySelectorAll('.hero-buttons .btn, .nav-cta').forEach((btn) => {
      // Same rAF-batching fix as the effects above: cap the measure+write
      // work to one per frame instead of once per raw mousemove event.
      let pendingMagnetEvent = null;
      let magnetRAFQueued = false;

      const applyMagnet = () => {
        magnetRAFQueued = false;
        const e = pendingMagnetEvent;
        if (!e) return;
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.35;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      };

      btn.addEventListener('mousemove', (e) => {
        pendingMagnetEvent = e;
        if (!magnetRAFQueued) {
          magnetRAFQueued = true;
          requestAnimationFrame(applyMagnet);
        }
      }, { passive: true });
      btn.addEventListener('mouseleave', () => {
        pendingMagnetEvent = null;
        btn.style.transform = '';
      });
    });
  })();

  // ---- Scroll-reveal for cards + section headers/stats (bigger entrance) ----
  // Covers static cards (step-card, auth-card) present at load, and
  // dynamically-rendered listing cards (.directory-card) added later by
  // fetchListings() further down, via a MutationObserver on the grids.
  // Section headers (title/subtitle/intro paragraph groups) and stat blocks
  // get the bigger ".lg-reveal-big" treatment — more scale + a blur-in —
  // since they're page-level moments rather than repeated grid items.
  (function initLiquidGlassScrollReveal() {
    if (!('IntersectionObserver' in window)) return;

    const CARD_REVEAL_SELECTOR = '.step-card, .auth-card, .directory-card, .prop-card, .use-case-box, .trust-item, .map-card, .pilot-text, .footer-col';
    const BIG_REVEAL_SELECTOR = '.section-header, .stat-item';
    const REVEAL_SELECTOR = `${CARD_REVEAL_SELECTOR}, ${BIG_REVEAL_SELECTOR}`;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('lg-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    function observeAll(root) {
      root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
        if (el.dataset.lgObserved) return;
        el.dataset.lgObserved = 'true';
        if (!lgPrefersReducedMotion) {
          const isBig = el.matches(BIG_REVEAL_SELECTOR);
          el.classList.add(isBig ? 'lg-reveal-big' : 'lg-reveal');
          // Stagger cards that share a parent (grids, step rows, etc.) so
          // they fade up one after another instead of all at once — mirrors
          // the staggered card entrance from the reference animation.
          const groupSiblings = Array.from(el.parentElement.children).filter((sib) =>
            sib.matches(REVEAL_SELECTOR)
          );
          const idx = groupSiblings.indexOf(el);
          if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 5) * 80}ms`;
        }
        io.observe(el);
      });
    }

    observeAll(document);

    if (!('MutationObserver' in window)) return;
    ['directory-grid', 'farmers-listing-grid'].forEach((id) => {
      const grid = document.getElementById(id);
      if (!grid) return;
      const mo = new MutationObserver(() => observeAll(grid));
      mo.observe(grid, { childList: true });
    });
  })();

  // ---- Count-up animation for stat numbers ----
  // Animates .stat-num values (e.g. "500+", "12", "80+") from 0 up to
  // their target when they scroll into view, preserving any non-numeric
  // suffix. Mirrors the number count-up seen in the reference animation.
  (function initStatCountUp() {
    if (!('IntersectionObserver' in window)) return;
    const statEls = document.querySelectorAll('.stat-num');
    if (!statEls.length) return;

    function animateCount(el) {
      const raw = el.textContent.trim();
      const match = raw.match(/^([\d,]+)(.*)$/);
      if (!match) return;
      const target = parseInt(match[1].replace(/,/g, ''), 10);
      const suffix = match[2] || '';
      if (lgPrefersReducedMotion || !isFinite(target)) {
        el.textContent = raw;
        return;
      }
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        el.textContent = Math.round(target * eased).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString() + suffix;
      }
      requestAnimationFrame(tick);
    }

    const statIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          statIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    statEls.forEach((el) => statIo.observe(el));
  })();

  // ==================== STATE & BACKEND CONFIG ====================
  // We now talk to Supabase directly from the browser instead of going
  // through the Express server (server.js / API_BASE_URL). Supabase is
  // always-on and publicly reachable, so any device — including a buyer's
  // phone anywhere on the internet, not just laptops on the same WiFi as a
  // locally-running server — can read and write listings correctly. This
  // is initialized up here (rather than further down, where it used to
  // live) because handleNavigation() below can call fetchListings()
  // immediately on page load, before the rest of the script has run.
  const SUPABASE_URL = "https://ofbwcyncwuqevbmlmafa.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mYndjeW5jd3VxZXZibWxtYWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Mjc3OTAsImV4cCI6MjA5OTQwMzc5MH0.MKKH3du-vv9X2n4as1VahfGyUgNc1Nlks60sDoWlGTc";

  let supabaseClient = null;
  if (typeof supabase !== 'undefined') {
    // Loaded via the Supabase CDN script tag in index.html
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Supabase SDK not found — make sure the Supabase <script> tag is included in index.html before app.js.');
  }

  // Local fallback mock database in case Supabase is unreachable
  const FALLBACK_LISTINGS = [
    {
      id: 1,
      farmerName: "Thiru R. Selvam",
      avatar: "https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/farmer-1.png",
      crop: "Salem Turmeric",
      quantity: 1200,
      quantityDisplay: "1,200 Kg",
      price: "₹140 - ₹160 / Kg",
      location: "Salem",
      address: "24, Kovil Street, Omalur, Salem",
      description: "[FALLBACK DATA] GI-Tagged premium quality Salem turmeric. Sun-dried and polished. Low moisture content, rich yellow curcumin (5.2%).",
      rating: "4.9",
      ratingCount: 14,
      verified: true,
      phone: "+919845011111",
      altPhone: "+919845011112",
      email: "selvam.turmeric@example.com",
      image: "https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/farmer-1.png"
    },
    {
      id: 2,
      farmerName: "Smt. K. Gomathi",
      avatar: "https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/farmer-2.png",
      crop: "Onions",
      quantity: 3500,
      quantityDisplay: "3.5 Tonnes",
      price: "₹24 - ₹28 / Kg",
      location: "Erode",
      address: "7, Periyar Nagar, Gobichettipalayam, Erode",
      description: "[FALLBACK DATA] Bellary Red onions. Well-cured, double-skin quality. Size 55mm+. Harvested last week, stored in ventilated cold structures.",
      rating: "4.8",
      ratingCount: 22,
      verified: true,
      phone: "+919845022222",
      altPhone: "",
      email: "gomathi.farms@example.com",
      image: "https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/farmer-2.png"
    }
  ];

  // Active runtime state
  let listings = [];

  // ==================== DOM ELEMENTS ====================
  const header = document.getElementById('header');
  const navMenu = document.getElementById('nav-menu');
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');
  const pageViews = document.querySelectorAll('.page-view');
  const navLinks = document.querySelectorAll('.nav-link, .nav-cta');
  const tabbarIndicator = document.getElementById('tabbar-indicator');
  const tabbarGlass = document.querySelector('.mobile-tabbar-glass');
  
  // Search Directory DOMs
  const directoryGrid = document.getElementById('directory-grid');
  const farmersListingGrid = document.getElementById('farmers-listing-grid');
  const farmersListingTitle = document.getElementById('farmers-listing-title');
  const searchCropInput = document.getElementById('search-crop');
  const filterLocationSelect = document.getElementById('filter-location');
  const filterQuantitySelect = document.getElementById('filter-quantity');
  const searchBtn = document.getElementById('search-btn');
  const resultsCountTitle = document.getElementById('results-count-title');
  
  // Modal DOMs
  const contactModal = document.getElementById('contact-modal');
  const modalClose = document.getElementById('modal-close');
  const modalFarmerAvatar = document.getElementById('modal-farmer-avatar');
  const modalFarmerName = document.getElementById('modal-farmer-name');
  const modalFarmerLocation = document.getElementById('modal-farmer-location');
  const modalCropName = document.getElementById('modal-crop-name');
  const modalQuantity = document.getElementById('modal-quantity');
  const modalPrice = document.getElementById('modal-price');
  const modalAddress = document.getElementById('modal-address');
  const modalAltPhone = document.getElementById('modal-alt-phone');
  const modalEmail = document.getElementById('modal-email');
  const modalCallBtn = document.getElementById('modal-call-btn');
  const modalWaBtn = document.getElementById('modal-wa-btn');

  // Forms
  const pilotRegistrationForm = document.getElementById('pilot-registration-form');
  const farmerListingForm = document.getElementById('farmer-listing-form');
  const toastContainer = document.getElementById('toast-container');


  // ==================== ROUTING SYSTEM ====================
  const routeMap = {
    '': 'page-home',
    '/': 'page-home',
    '/farmers': 'page-farmers',
    '/buyers': 'page-buyers',
    '/how-it-works': 'page-how-it-works',
    '/about': 'page-about',
    '/contact': 'page-contact',
    '/farmer-signin': 'page-farmer-signin',
    '/buyer-signin': 'page-buyer-signin',
    '/farmer-register': 'page-farmer-register',
    '/buyer-register': 'page-buyer-register',
    '/farmer-forgot-password': 'page-farmer-forgot-password',
    '/buyer-forgot-password': 'page-buyer-forgot-password',
    '/profile': 'page-profile'
  };

  function handleNavigation() {
    let hashPath = window.location.hash.slice(1);
    if (!hashPath.startsWith('/')) {
      hashPath = '/' + hashPath;
    }
    
    if (hashPath === '//') hashPath = '/';

    const targetPageId = routeMap[hashPath] || 'page-home';

    // Swap active views
    pageViews.forEach(view => {
      if (view.id === targetPageId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update Nav bar links
    navLinks.forEach(link => {
      const linkHash = link.getAttribute('href');
      if (link.classList.contains('nav-cta')) return;
      
      if (linkHash === `#${hashPath === '/' ? '' : hashPath}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Custom View Triggers
    if (targetPageId === 'page-buyers') {
      if (updateBuyerDirectoryAccess()) {
        fetchListings();
      }
    }
    if (targetPageId === 'page-farmers') {
      if (updateFarmersPreviewAccess()) {
        fetchFarmersPreview();
      }
      updateFarmerListingFormAccess();
    }
    if (targetPageId === 'page-profile') {
      renderProfile();
    }

    // Slide/morph the liquid indicator under whichever tab is now active
    updateTabbarIndicator();

    // Close Mobile Menu if open
    closeMobileMenu();
  }

  // ==================== MOBILE TAB BAR LIQUID INDICATOR ====================
  // Moves + resizes the glass "blob" behind the active tab so it slides and
  // morphs to fit whichever icon is selected — the signature iOS 27 liquid
  // glass motion. Only reads layout (getBoundingClientRect) on nav changes
  // and resize, never on a continuous loop, so it stays cheap.
  function updateTabbarIndicator() {
    if (!tabbarIndicator || !tabbarGlass) return;
    const activeTab = tabbarGlass.querySelector('.tabbar-link.active');
    if (!activeTab) return;

    const containerRect = tabbarGlass.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const baseOffset = 4; // matches .tabbar-indicator's CSS `left: 4px`
    const offsetX = (tabRect.left - containerRect.left) - baseOffset;

    tabbarIndicator.style.width = `${tabRect.width}px`;
    tabbarIndicator.style.transform = `translateX(${offsetX}px)`;
  }

  window.addEventListener('resize', () => {
    window.clearTimeout(window.__tabbarResizeT);
    window.__tabbarResizeT = window.setTimeout(updateTabbarIndicator, 120);
  });

  // Position it correctly on first load (no transition flash — the CSS
  // transition only kicks in on subsequent changes since this runs before
  // the browser's first paint of the mobile tab bar).
  updateTabbarIndicator();

  // ==================== PROFILE PAGE ====================
  function renderProfile() {
    const signedInBox = document.getElementById('profile-signed-in');
    const signedOutBox = document.getElementById('profile-signed-out');
    if (!signedInBox || !signedOutBox) return;

    const role = localStorage.getItem('auth_role');
    const sessionRaw = localStorage.getItem('auth_session');

    let session = null;
    try {
      session = sessionRaw ? JSON.parse(sessionRaw) : null;
    } catch (e) {
      session = null;
    }

    const user = session && session.user ? session.user : null;

    if (!role || !user) {
      signedInBox.style.display = 'none';
      signedOutBox.style.display = 'block';
      return;
    }

    signedOutBox.style.display = 'none';
    signedInBox.style.display = 'block';

    const meta = user.user_metadata || {};
    const name = meta.name || 'Not available';
    const email = user.email || 'Not available';
    const phone = meta.phone || 'Not available';
    const location = meta.location || 'Not available';

    document.getElementById('profile-avatar-initial').textContent = name.charAt(0).toUpperCase() || '?';
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-email').textContent = email;
    document.getElementById('profile-phone').textContent = phone;
    document.getElementById('profile-location').textContent = location;

    const roleBadge = document.getElementById('profile-role-badge');
    const extraLabel = document.getElementById('profile-extra-label');
    const extraValue = document.getElementById('profile-extra-value');
    const dashboardBtn = document.getElementById('profile-dashboard-btn');

    const myListingsSection = document.getElementById('profile-my-listings-section');

    if (role === 'buyer') {
      roleBadge.textContent = 'Buyer';
      extraLabel.textContent = 'Business Address';
      extraValue.textContent = meta.address || 'Not available';
      dashboardBtn.onclick = () => { window.location.hash = '#/buyers'; };
      if (myListingsSection) myListingsSection.style.display = 'none';
    } else {
      roleBadge.textContent = 'Farmer';
      extraLabel.textContent = 'Primary Crop';
      extraValue.textContent = meta.crop_type || 'Not available';
      dashboardBtn.onclick = () => { window.location.hash = '#/farmers'; };
      if (myListingsSection) {
        myListingsSection.style.display = 'block';
        fetchMyListings(email, phone);
      }
    }

    const signOutBtn = document.getElementById('profile-signout-btn');
    if (signOutBtn) {
      signOutBtn.onclick = () => {
        localStorage.removeItem('auth_role');
        localStorage.removeItem('auth_session');
        showToast && showToast('Signed out successfully.', 'success');
        window.location.hash = '#/';
      };
    }
  }

  window.addEventListener('hashchange', handleNavigation);
  handleNavigation();


  // ==================== HEADER SCROLL EFFECT ====================
  if (header) {
    let headerTicking = false;
    let lastScrollY = window.scrollY;
    const HEADER_HIDE_THRESHOLD = 80; // don't hide until scrolled a bit past the top
    const updateHeaderScrolled = () => {
      const currentY = window.scrollY;
      header.classList.toggle('scrolled', currentY > 40);

      // Auto-hide the header while actively scrolling down through content
      // (so it never sits on top of text you're reading), and bring it back
      // the moment the user scrolls up to look for it. Skipped while the
      // mobile menu sheet is open so it can't disappear mid-interaction.
      const menuOpen = navMenu && navMenu.classList.contains('active');
      if (!menuOpen) {
        if (currentY > lastScrollY && currentY > HEADER_HIDE_THRESHOLD) {
          header.classList.add('header-hidden');
        } else {
          header.classList.remove('header-hidden');
        }
      }

      lastScrollY = currentY;
      headerTicking = false;
    };
    // passive + rAF-batched, matching the other scroll listeners in this
    // file, so the browser never has to wait on this handler to decide
    // whether it can start scrolling.
    window.addEventListener('scroll', () => {
      if (!headerTicking) {
        headerTicking = true;
        requestAnimationFrame(updateHeaderScrolled);
      }
    }, { passive: true });
  }


  // ==================== MOBILE NAVIGATION ====================
  function closeMobileMenu() {
    if (navMenu) navMenu.classList.remove('active');
    if (mobileToggle) mobileToggle.classList.remove('active');
    if (mobileMenuBackdrop) mobileMenuBackdrop.classList.remove('active');
    document.body.classList.remove('mobile-menu-open');
  }

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpening = !navMenu.classList.contains('active');
      navMenu.classList.toggle('active');
      mobileToggle.classList.toggle('active');
      if (mobileMenuBackdrop) mobileMenuBackdrop.classList.toggle('active', isOpening);
      document.body.classList.toggle('mobile-menu-open', isOpening);
    });
  }

  if (mobileMenuBackdrop) {
    mobileMenuBackdrop.addEventListener('click', closeMobileMenu);
  }


  // ==================== DATABASE CONNECTIVITY (API FETCH) ====================
  
  async function fetchListings() {
    resultsCountTitle.textContent = "Loading Directory...";
    
    const cropVal = searchCropInput.value.trim();
    const locVal = filterLocationSelect.value;
    const qtyVal = filterQuantitySelect.value;

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client was not initialized properly.');
      }

      let query = supabaseClient.from('listings').select('*').order('created_at', { ascending: false });

      if (cropVal) query = query.ilike('crop', `%${cropVal}%`);
      if (locVal) query = query.eq('location', locVal);
      if (qtyVal === 'small') query = query.lt('quantity', 500);
      else if (qtyVal === 'medium') query = query.gte('quantity', 500).lte('quantity', 2000);
      else if (qtyVal === 'large') query = query.gt('quantity', 2000);

      const { data, error } = await query;
      if (error) throw error;

      listings = (data || []).map(normalizeListing);
      renderDirectory(listings, directoryGrid, resultsCountTitle);
    } catch (error) {
      console.warn('Supabase fetch error, falling back to local simulation data:', error.message);
      // Fallback local query simulation
      simulateLocalQuery(cropVal, locVal, qtyVal);
    }
  }

  // Fallback simulator if the database is unreachable
  function simulateLocalQuery(cropVal, locVal, qtyVal) {
    let mockSrc = listings.length > 0 ? listings : FALLBACK_LISTINGS;
    const filtered = mockSrc.filter(item => {
      const cropMatch = item.crop.toLowerCase().includes(cropVal.toLowerCase());
      const locMatch = !locVal || item.location === locVal;
      let qtyMatch = true;
      if (qtyVal === 'small') qtyMatch = item.quantity < 500;
      else if (qtyVal === 'medium') qtyMatch = item.quantity >= 500 && item.quantity <= 2000;
      else if (qtyVal === 'large') qtyMatch = item.quantity > 2000;
      
      return cropMatch && locMatch && qtyMatch;
    });
    renderDirectory(filtered, directoryGrid, resultsCountTitle);
  }

  // ==================== FARMER AUTH GATE (for the listing form) ====================
  // Mirrors the same localStorage session check renderProfile() uses.
  function getAuthSession() {
    const role = localStorage.getItem('auth_role');
    const sessionRaw = localStorage.getItem('auth_session');
    let session = null;
    try {
      session = sessionRaw ? JSON.parse(sessionRaw) : null;
    } catch (e) {
      session = null;
    }
    const user = session && session.user ? session.user : null;
    return { role, user };
  }

  function isFarmerSignedIn() {
    const { role, user } = getAuthSession();
    return role === 'farmer' && !!user;
  }

  function isBuyerSignedIn() {
    const { role, user } = getAuthSession();
    return role === 'buyer' && !!user;
  }

  // Shows the "Meet Our Farmers" preview only to signed-in Farmers; everyone
  // else sees a sign-in / register prompt instead (mirrors updateBuyerDirectoryAccess).
  function updateFarmersPreviewAccess() {
    const signedInBox = document.getElementById('farmers-preview-signed-in');
    const signedOutBox = document.getElementById('farmers-preview-signed-out');
    if (!signedInBox || !signedOutBox) return false;

    if (isFarmerSignedIn()) {
      signedInBox.style.display = 'block';
      signedOutBox.style.display = 'none';
      return true;
    } else {
      signedInBox.style.display = 'none';
      signedOutBox.style.display = 'block';
      return false;
    }
  }
  // a sign-in / register prompt instead (mirrors updateFarmerListingFormAccess).
  function updateBuyerDirectoryAccess() {
    const signedInBox = document.getElementById('buyer-directory-signed-in');
    const signedOutBox = document.getElementById('buyer-directory-signed-out');
    if (!signedInBox || !signedOutBox) return false;

    if (isBuyerSignedIn()) {
      signedInBox.style.display = 'block';
      signedOutBox.style.display = 'none';
      return true;
    } else {
      signedInBox.style.display = 'none';
      signedOutBox.style.display = 'block';
      return false;
    }
  }

  // Shows the "Add Your Crop Details" form only for signed-in farmers;
  // everyone else sees a sign-in / register prompt instead.
  function updateFarmerListingFormAccess() {
    const signedInBox = document.getElementById('farmer-listing-signed-in');
    const signedOutBox = document.getElementById('farmer-listing-signed-out');
    if (!signedInBox || !signedOutBox) return;

    if (isFarmerSignedIn()) {
      signedInBox.style.display = 'block';
      signedOutBox.style.display = 'none';

      // Prefill known fields from the account so the farmer doesn't
      // have to retype their own name/phone/email every time.
      const { user } = getAuthSession();
      const meta = user.user_metadata || {};
      const nameInput = document.getElementById('listing-farmer-name');
      const phoneInput = document.getElementById('listing-phone');
      const emailInput = document.getElementById('listing-email');
      const locationInput = document.getElementById('listing-location');

      if (nameInput && !nameInput.value) nameInput.value = meta.name || '';
      if (phoneInput && !phoneInput.value) phoneInput.value = meta.phone || '';
      if (emailInput && !emailInput.value) emailInput.value = user.email || '';
      if (locationInput && !locationInput.value) locationInput.value = meta.location || '';
    } else {
      signedInBox.style.display = 'none';
      signedOutBox.style.display = 'block';
    }
  }

  // ==================== FARMERS PAGE — "MEET OUR FARMERS" PREVIEW ====================
  // Read-only, unfiltered preview of live listings shown on the Farmers
  // page so prospective farmers can see what their own listing will look
  // like once they sign up. Reuses the same Supabase table / fallback
  // data as the Buyers directory, just rendered into a different grid
  // with no search/filter controls and capped to a handful of cards.
  async function fetchFarmersPreview() {
    if (!farmersListingGrid) return;

    const PREVIEW_LIMIT = 6;
    farmersListingGrid.innerHTML = `
      <div class="no-results">
        <p>Loading farmer profiles...</p>
      </div>
    `;

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client was not initialized properly.');
      }

      const { data, error } = await supabaseClient
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PREVIEW_LIMIT);

      if (error) throw error;

      const preview = (data || []).map(normalizeListing);
      if (preview.length > 0) {
        listings = preview.length > listings.length ? preview : listings;
      }
      renderDirectory(preview, farmersListingGrid, null);
    } catch (error) {
      console.warn('Supabase fetch error on farmers preview, falling back to local data:', error.message);
      const mockSrc = listings.length > 0 ? listings : FALLBACK_LISTINGS;
      renderDirectory(mockSrc.slice(0, PREVIEW_LIMIT), farmersListingGrid, null);
    }
  }

  // ==================== PROFILE PAGE — "MY LISTINGS" (farmer dashboard) ====================
  // Fetches only the listings that belong to the currently signed-in farmer
  // and renders them with a Delete button so the farmer can remove a
  // listing once the crop is sold out / no longer available.
  // We match on email (and phone as a fallback) since the listings table
  // does not currently store the Supabase auth user id.
  async function fetchMyListings(email, phone) {
    const grid = document.getElementById('my-listings-grid');
    if (!grid) return;

    grid.innerHTML = `<p style="color:var(--text-muted);">Loading your listings...</p>`;

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client was not initialized properly.');
      }
      if (!email && !phone) {
        throw new Error('No email or phone on file to match listings against.');
      }

      let query = supabaseClient.from('listings').select('*').order('created_at', { ascending: false });
      if (email) {
        query = query.eq('email', email);
      } else {
        query = query.eq('phone', phone);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mine = (data || []).map(normalizeListing);
      renderMyListings(mine);
    } catch (error) {
      console.warn('Could not load "My Listings" from Supabase:', error.message);
      // Fallback: filter whatever is already in memory (e.g. listings the
      // farmer just published locally while offline).
      const mine = listings.filter(item =>
        (email && item.email && item.email.toLowerCase() === email.toLowerCase()) ||
        (phone && item.phone === phone)
      );
      renderMyListings(mine);
    }
  }

  function renderMyListings(dataList) {
    const grid = document.getElementById('my-listings-grid');
    if (!grid) return;

    if (!dataList || dataList.length === 0) {
      grid.innerHTML = `<p style="color:var(--text-muted);">You haven't published any crop listings yet. Use the "Add Your Crop Details" form on the Farmers page to publish one.</p>`;
      return;
    }

    grid.innerHTML = dataList.map(item => {
      const targetId = item._id || item.id;
      const availabilityText = getAvailability(item);
      return `
        <div class="my-listing-card">
          <div class="my-listing-card-top">
            <h4>${item.crop}</h4>
          </div>
          <div class="my-listing-meta">Available Stock: ${availabilityText}</div>
          <div class="my-listing-meta">Location: ${item.location || 'Not available'}</div>
          <div class="my-listing-meta">Price: ${getPriceDisplay(item)}</div>
          <button type="button" class="btn btn-danger delete-listing-trigger" data-id="${targetId}">Delete Listing</button>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.delete-listing-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        deleteMyListing(id);
      });
    });
  }

  async function deleteMyListing(id) {
    const confirmed = window.confirm('Delete this listing? This cannot be undone.');
    if (!confirmed) return;

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client was not initialized properly.');
      }
      // id may be a UUID/number from Supabase, so pass it through as-is.
      const { error } = await supabaseClient.from('listings').delete().eq('id', id);
      if (error) throw error;

      showToast('Listing deleted.', 'success');
    } catch (error) {
      console.warn('Supabase delete error, removing locally instead:', error.message);
      showToast('Listing removed (offline mode — it may reappear once reconnected).', 'success');
    }

    // Keep everything in sync regardless of whether the delete hit the
    // database or only happened locally: drop it from the in-memory
    // listings array and re-render any grid currently on screen.
    listings = listings.filter(item => String(item._id || item.id) !== String(id));

    const { email, phone } = (() => {
      const { user } = getAuthSession();
      const meta = (user && user.user_metadata) || {};
      return { email: (user && user.email) || '', phone: meta.phone || '' };
    })();
    fetchMyListings(email, phone);

    if (document.getElementById('page-farmers')?.classList.contains('active') && isFarmerSignedIn()) {
      fetchFarmersPreview();
    }
    if (document.getElementById('page-buyers')?.classList.contains('active') && isBuyerSignedIn()) {
      fetchListings();
    }
  }

  // Supabase stores columns as snake_case (farmer_name, quantity_display, ...)
  // but the rest of this file (and the directory card / modal renderers)
  // expect camelCase. Normalize every row we get back so those all just work,
  // the same way server.js used to before we cut it out of this flow.
  function normalizeListing(row) {
    if (!row) return row;
    return {
      id: row.id,
      farmerName: row.farmer_name ?? row.farmerName,
      avatar: row.avatar,
      crop: row.crop,
      quantity: row.quantity,
      quantityDisplay: row.quantity_display ?? row.quantityDisplay,
      price: row.price,
      location: row.location,
      address: row.address ?? '',
      description: row.description,
      rating: row.rating,
      ratingCount: row.rating_count ?? row.ratingCount ?? 0,
      verified: row.verified,
      phone: row.phone,
      altPhone: row.alt_phone ?? row.altPhone ?? '',
      email: row.email ?? '',
      image: row.image,
      createdAt: row.created_at ?? row.createdAt
    };
  }


  // ==================== SAFE FIELD RESOLVERS ====================
  // Listings can arrive from three different sources (MongoDB, Supabase via
  // the backend's normalizeListing(), or the local FALLBACK_LISTINGS array),
  // and each has historically used slightly different key names. These
  // helpers pull the correct value from whichever key is actually present
  // and guarantee we NEVER render "undefined"/"null" in the UI.

  function isEmpty(value) {
    return value === undefined || value === null || String(value).trim() === '';
  }

  function getFarmerName(item) {
    const candidates = [item.farmerName, item.farmer_name, item.name];
    const found = candidates.find(v => !isEmpty(v));
    return found || 'Not available';
  }

  function getAvailability(item) {
    // Prefer the pre-formatted display string (e.g. "1,200 Kg"); fall back
    // to a raw numeric quantity/availability value; finally show a fallback.
    const displayCandidates = [item.quantityDisplay, item.quantity_display, item.availabilityDisplay, item.availability];
    const displayFound = displayCandidates.find(v => !isEmpty(v));
    if (displayFound) {
      const text = String(displayFound).trim();
      // If it's just a bare number with no unit (e.g. "10"), add "Kg".
      return /^[\d,.]+$/.test(text) ? `${text} Kg` : text;
    }

    const numericCandidates = [item.quantity, item.availableQuantity, item.stock];
    const numericFound = numericCandidates.find(v => !isEmpty(v));
    if (numericFound) return `${numericFound} Kg`;

    return 'Not available';
  }

  function getAddress(item) {
    const candidates = [item.address, item.village, item.fullAddress];
    const found = candidates.find(v => !isEmpty(v));
    return found || 'Not available';
  }

  function getAltPhone(item) {
    const candidates = [item.altPhone, item.alt_phone, item.alternatePhone];
    const found = candidates.find(v => !isEmpty(v));
    return found || 'Not available';
  }

  function getEmail(item) {
    const candidates = [item.email];
    const found = candidates.find(v => !isEmpty(v));
    return found || 'Not available';
  }

  function getPriceDisplay(item) {
    // Farmers can type a price a few different ways ("500", "₹500",
    // "140 - 160", "₹140 - ₹160 / Kg", etc.). Normalize all of them so the
    // price badge always shows a ₹ symbol and a "/ Kg" unit, without ever
    // double-adding either one.
    const raw = [item.price, item.priceRange].find(v => !isEmpty(v));
    if (!raw) return 'Price on request';

    let text = String(raw).trim();

    // Add ₹ before every number that doesn't already have one right before it
    // (covers single prices and ranges like "140 - 160").
    text = text.replace(/(^|\s)(?!₹)(\d)/g, (match, prefix, digit) => `${prefix}₹${digit}`);

    // Append the "/ Kg" unit if some per-unit suffix isn't already present.
    if (!/\/\s*(kg|kilogram|tonne|ton|quintal)/i.test(text)) {
      text = `${text} / Kg`;
    }

    return text;
  }

  // ==================== RENDER DIRECTORY CARDS ====================
  // gridEl/titleEl let this same renderer power both the full Buyers
  // search directory and the read-only "Meet Our Farmers" preview grid
  // on the Farmers page. titleEl is optional — the farmers preview
  // doesn't need a "N listings found" style counter.
  function renderDirectory(dataList, gridEl, titleEl) {
    const grid = gridEl || directoryGrid;
    const title = titleEl !== undefined ? titleEl : resultsCountTitle;

    grid.innerHTML = '';

    if (title) {
      if (dataList.length === 1) {
        title.textContent = "1 Verified Listing Found";
      } else {
        title.textContent = `${dataList.length} Verified Listings Found`;
      }
    }

    if (dataList.length === 0) {
      grid.innerHTML = `
        <div class="no-results">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"></path>
          </svg>
          <h3>No Match Found</h3>
          <p>Try resetting filters or searching for alternate crops (e.g. onions, turmeric, potatoes).</p>
        </div>
      `;
      return;
    }

    dataList.forEach(item => {
      const card = document.createElement('article');
      card.className = 'directory-card glow-card';
      
      const verificationBadgeHtml = item.verified 
        ? `<div class="verification-badge">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
            Verified Farmer
           </div>`
        : `<div class="verification-badge" style="background-color: var(--accent);">
            Pending verification
           </div>`;

      // Support MongoDB _id (string) or local fallback number ID
      const targetId = item._id || item.id;

      // Resolve once so both the card markup and the alt text stay in sync
      const farmerName = getFarmerName(item);
      const availabilityText = getAvailability(item);

      card.innerHTML = `
        <div class="card-image-box">
          <img src="${item.image}" alt="${item.crop} harvest" onerror="this.onerror=null;this.src='https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/hero_bg.png';">
          ${verificationBadgeHtml}
          <div class="crop-price-badge">${getPriceDisplay(item)}</div>
        </div>
        <div class="card-content">
          <div class="card-farmer-info">
            <img src="${item.avatar}" alt="${farmerName}" class="farmer-avatar" onerror="this.onerror=null;this.src='https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/farmer-1.png';">
            <div class="farmer-name-details">
              <h4>${farmerName}</h4>
              <div class="farmer-rating">
                ★ ${item.rating || '5.0'} <span>(${item.ratingCount || 0} deals)</span>
              </div>
            </div>
          </div>
          <div class="card-crop-details">
            <h3 class="card-crop-name">${item.crop}</h3>
            <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${item.description}</p>
          </div>
          <div class="card-meta-grid">
            <div class="meta-item">Available Stock <span>${availabilityText}</span></div>
            <div class="meta-item">Location <span>${item.location}, TN</span></div>
          </div>
          <button class="btn btn-secondary card-btn contact-farmer-trigger" data-id="${targetId}">Contact Farmer</button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Attach Event Listeners (scoped to this grid so we don't double-bind
    // handlers on the other grid's cards when both are on the page)
    grid.querySelectorAll('.contact-farmer-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openContactModal(id);
      });
    });
  }

  // Connect filters
  if (searchBtn) searchBtn.addEventListener('click', fetchListings);
  if (searchCropInput) searchCropInput.addEventListener('input', fetchListings);
  if (filterLocationSelect) filterLocationSelect.addEventListener('change', fetchListings);
  if (filterQuantitySelect) filterQuantitySelect.addEventListener('change', fetchListings);


  // ==================== MODAL SYSTEM ====================
  function openContactModal(farmerId) {
    // Search in fetched database or fallback database
    const targetListing = listings.find(item => (item._id === farmerId || String(item.id) === String(farmerId))) || 
                          FALLBACK_LISTINGS.find(item => String(item.id) === String(farmerId));
    if (!targetListing) return;

    modalFarmerAvatar.onerror = function () {
      this.onerror = null;
      this.src = 'https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/farmer-1.png';
    };
    modalFarmerAvatar.src = targetListing.avatar;

    const farmerName = getFarmerName(targetListing);
    const availabilityText = getAvailability(targetListing);
    const addressText = getAddress(targetListing);
    const altPhoneText = getAltPhone(targetListing);
    const emailText = getEmail(targetListing);

    modalFarmerName.textContent = farmerName;
    modalFarmerLocation.textContent = `${targetListing.location} District, Tamil Nadu`;
    modalCropName.textContent = targetListing.crop;
    modalQuantity.textContent = availabilityText;
    modalPrice.textContent = getPriceDisplay(targetListing);
    modalAddress.textContent = addressText;
    modalAltPhone.textContent = altPhoneText;
    modalEmail.textContent = emailText;
    
    const verificationLabel = contactModal.querySelector('#modal-verification');
    if (targetListing.verified) {
      verificationLabel.textContent = "ID & Land Checked ✓";
      verificationLabel.style.color = "var(--primary)";
    } else {
      verificationLabel.textContent = "Self-Declared listing (Check details)";
      verificationLabel.style.color = "var(--accent)";
    }

    modalCallBtn.href = `tel:${targetListing.phone}`;
    
    const waText = encodeURIComponent(
      `Hello ${farmerName}, I saw your listing for ${targetListing.crop} (${availabilityText}) on the Farmer-Direct Marketplace portal. Is the stock still available? I would like to negotiate details.`
    );
    modalWaBtn.href = `https://wa.me/${targetListing.phone.replace('+', '')}?text=${waText}`;

    contactModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeContactModal() {
    contactModal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  if (modalClose) modalClose.addEventListener('click', closeContactModal);
  if (contactModal) {
    contactModal.addEventListener('click', (e) => {
      if (e.target === contactModal) closeContactModal();
    });
  }


  // ==================== FORM SIMULATORS ====================
  
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const checkIcon = `<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" style="margin-right:2px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
    toast.innerHTML = `${checkIcon} <span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => { toast.remove(); }, 400);
    }, 3500);
  }

  // Contact / Join Pilot Form Submission
  if (pilotRegistrationForm) {
    pilotRegistrationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('reg-name').value;
      const phone = document.getElementById('reg-phone').value;
      const email = document.getElementById('reg-email').value;
      const role = document.getElementById('reg-role').value;
      const location = document.getElementById('reg-location').value;
      const village = document.getElementById('reg-village').value;
      const message = document.getElementById('reg-message').value || '';

      const regData = { name, phone, email, role, location, village, message };

      try {
        if (!supabaseClient) {
          throw new Error('Supabase client was not initialized properly.');
        }

        const { error } = await supabaseClient
          .from('registrations')
          .insert([regData]);

        if (error) throw error;

        showToast(`Registration saved! Welcome, ${name}.`);
        pilotRegistrationForm.reset();

      } catch (error) {
        console.warn('Supabase error, could not save registration:', error.message);
        showToast(`Could not save your registration — please try again.`, 'error');
      }
    });
  }

  // Farmer "Add Produce Listing" Form Submission
  if (farmerListingForm) {
    farmerListingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!isFarmerSignedIn()) {
        showToast('Please sign in as a Farmer before publishing a listing.', 'error');
        updateFarmerListingFormAccess();
        return;
      }

      const farmerName = document.getElementById('listing-farmer-name').value.trim();
      const phone = document.getElementById('listing-phone').value.trim();
      const altPhone = document.getElementById('listing-alt-phone').value.trim();
      const email = document.getElementById('listing-email').value.trim();
      const crop = document.getElementById('listing-crop').value.trim();
      const location = document.getElementById('listing-location').value;
      const address = document.getElementById('listing-address').value.trim();
      const quantity = Number(document.getElementById('listing-quantity').value);
      let quantityDisplay = document.getElementById('listing-quantity-display').value.trim();
      const price = document.getElementById('listing-price').value.trim();
      const image = 'https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/hero_bg.png';
      const avatar = 'https://raw.githubusercontent.com/sharan643-gif/Agrilink/main/farmer-1.png';
      const description = document.getElementById('listing-description').value.trim();

      if (!farmerName || !phone || !crop || !location || !quantity || !price) {
        showToast('Please fill in all required fields (marked *).', 'error');
        return;
      }

      if (!quantityDisplay) {
        quantityDisplay = `${quantity.toLocaleString('en-IN')} Kg`;
      }

      const newListingRow = {
        farmer_name: farmerName,
        avatar,
        crop,
        quantity,
        quantity_display: quantityDisplay,
        price,
        location,
        address,
        description,
        phone,
        alt_phone: altPhone,
        email,
        image,
        verified: false,
        rating: '5.0',
        rating_count: 0
      };

      try {
        if (!supabaseClient) {
          throw new Error('Supabase client was not initialized properly.');
        }

        const { data, error } = await supabaseClient
          .from('listings')
          .insert([newListingRow])
          .select()
          .single();

        if (error) throw error;

        const saved = normalizeListing(data);
        listings = [saved, ...listings];

        showToast(`Listing published! "${crop}" is now live for buyers to see.`);
        farmerListingForm.reset();

        // Refresh whichever grid(s) are currently visible so the new
        // listing shows up immediately without a page reload.
        if (document.getElementById('page-farmers')?.classList.contains('active') && isFarmerSignedIn()) {
          fetchFarmersPreview();
        }
        if (document.getElementById('page-buyers')?.classList.contains('active') && isBuyerSignedIn()) {
          fetchListings();
        }
      } catch (error) {
        console.warn('Supabase error, saving listing locally instead:', error.message);

        // Fallback: keep the listing in memory so it still shows up in
        // this session's grids even without a database connection.
        const localListing = {
          id: `local-${Date.now()}`,
          farmerName,
          avatar,
          crop,
          quantity,
          quantityDisplay,
          price,
          location,
          address,
          description,
          rating: '5.0',
          ratingCount: 0,
          verified: false,
          phone,
          altPhone,
          email,
          image,
          createdAt: new Date().toISOString()
        };
        listings = [localListing, ...listings];

        showToast(`Listing saved locally — "${crop}" is now visible in this session.`, 'success');
        farmerListingForm.reset();

        if (document.getElementById('page-farmers')?.classList.contains('active') && isFarmerSignedIn()) {
          renderDirectory(listings.slice(0, 6), farmersListingGrid, null);
        }
        if (document.getElementById('page-buyers')?.classList.contains('active') && isBuyerSignedIn()) {
          renderDirectory(listings, directoryGrid, resultsCountTitle);
        }
      }
    });
  }

  // ==================== SUPABASE AUTHENTICATION SYSTEM ====================
  // (supabaseClient is already initialized near the top of this file)
  // Check if we are on the farmer sign-in page or buyer sign-in page
  const farmerLoginForm = document.getElementById('farmer-login-form');
  const buyerLoginForm = document.getElementById('buyer-login-form');

  // Helper to show form specific inline status alerts
  function showAuthMessage(formContainer, text, type = 'error') {
    let alertDiv = formContainer.querySelector('.auth-alert');
    if (!alertDiv) {
      alertDiv = document.createElement('div');
      alertDiv.className = 'auth-alert';
      formContainer.prepend(alertDiv);
    }
    alertDiv.className = `auth-alert alert-${type}`;
    alertDiv.textContent = text;
    
    // Add icon based on type
    const errorIcon = `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" style="margin-right:4px; display:inline-block; vertical-align:middle;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    const successIcon = `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" style="margin-right:4px; display:inline-block; vertical-align:middle;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
    alertDiv.innerHTML = `${type === 'error' ? errorIcon : successIcon} <span>${text}</span>`;
    
    // Smooth transition fade-in
    alertDiv.style.opacity = '0';
    alertDiv.style.transform = 'translateY(-10px)';
    alertDiv.style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
      alertDiv.style.opacity = '1';
      alertDiv.style.transform = 'translateY(0)';
    }, 50);
  }

  // Handle Farmer Login Form Submission
  if (farmerLoginForm) {
    farmerLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('farmer-email').value.trim();
      const password = document.getElementById('farmer-password').value;
      const submitBtn = farmerLoginForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      
      // Basic client-side validation
      if (!email || !password) {
        showAuthMessage(farmerLoginForm, 'Please fill in all fields.', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Signing in...`;

        if (!supabaseClient) {
          throw new Error('Supabase client was not initialized properly.');
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          throw error;
        }

        showAuthMessage(farmerLoginForm, 'Sign-in successful! Redirecting to dashboard...', 'success');
        
        // Save local session state
        localStorage.setItem('auth_role', 'farmer');
        localStorage.setItem('auth_session', JSON.stringify(data.session));

        setTimeout(() => {
          window.location.hash = '#/farmers';
        }, 1500);

      } catch (err) {
        console.error('Farmer auth error:', err.message);
        showAuthMessage(farmerLoginForm, err.message || 'Verification failed. Please check credentials.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }

  // Handle Buyer Login Form Submission
  if (buyerLoginForm) {
    buyerLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('buyer-email').value.trim();
      const password = document.getElementById('buyer-password').value;
      const submitBtn = buyerLoginForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      
      // Basic client-side validation
      if (!email || !password) {
        showAuthMessage(buyerLoginForm, 'Please fill in all fields.', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Signing in...`;

        if (!supabaseClient) {
          throw new Error('Supabase client was not initialized properly.');
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          throw error;
        }

        showAuthMessage(buyerLoginForm, 'Sign-in successful! Redirecting to directory...', 'success');
        
        // Save local session state
        localStorage.setItem('auth_role', 'buyer');
        localStorage.setItem('auth_session', JSON.stringify(data.session));

        setTimeout(() => {
          window.location.hash = '#/buyers';
        }, 1500);

      } catch (err) {
        console.error('Buyer auth error:', err.message);
        showAuthMessage(buyerLoginForm, err.message || 'Verification failed. Please check credentials.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }


  // ==================== FORGOT PASSWORD (EMAIL LINK) SYSTEM ====================
  // Flow for both farmer & buyer:
  //   1. User enters email -> supabaseClient.auth.resetPasswordForEmail(email, {
  //        redirectTo: RESET_PASSWORD_REDIRECT_URL
  //      })
  //      This triggers Supabase's default "Reset Password" email containing a
  //      magic link ({{ .ConfirmationURL }} — no template edit needed, so this
  //      works even on free-tier projects without custom SMTP configured).
  //   2. User clicks the link in their email -> Supabase verifies it server-side
  //      and redirects them to reset-password.html?code=xxxx.
  //   3. reset-password.html calls supabaseClient.auth.exchangeCodeForSession(code)
  //      to start a temporary recovery session, then supabaseClient.auth.updateUser(
  //      { password }) sets the new password, then signs out so they log in fresh.
  // No custom SQL table is required — Supabase's built-in auth schema manages the
  // token lifecycle internally. See reset-password.html for step 2 & 3.
  //
  // IMPORTANT: reset-password.html must be added as a Redirect URL in
  // Supabase Dashboard > Authentication > URL Configuration, e.g.
  // https://yoursite.com/reset-password.html
  const RESET_PASSWORD_REDIRECT_URL = `${window.location.origin}${window.location.pathname.replace(/index\.html$/, '')}reset-password.html`;

  function setupForgotPasswordFlow(role) {
    const requestForm = document.getElementById(`${role}-forgot-request-form`);
    if (!requestForm) return;

    const emailInput = document.getElementById(`${role}-forgot-email`);

    // Step 1: Send the reset link
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const submitBtn = requestForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;

      if (!email) {
        showAuthMessage(requestForm, 'Please enter your registered email.', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Sending link...`;

        if (!supabaseClient) {
          throw new Error('Supabase client was not initialized properly.');
        }

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: RESET_PASSWORD_REDIRECT_URL
        });
        if (error) throw error;

        showAuthMessage(requestForm, 'Reset link sent! Check your email inbox and click the link to set a new password.', 'success');
        requestForm.reset();

      } catch (err) {
        console.error(`${role} forgot-password request error:`, err.message);
        showAuthMessage(requestForm, err.message || 'Could not send reset link. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });

    // Reset the request form (clear any old alert) whenever this page is
    // (re)entered — step 2 now lives entirely on reset-password.html.
    document.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (hash === `/${role}-forgot-password`) {
        requestForm.reset();
        const alertDiv = requestForm.querySelector('.auth-alert');
        if (alertDiv) alertDiv.remove();
      }
    });
  }

  setupForgotPasswordFlow('farmer');
  setupForgotPasswordFlow('buyer');


  // ==================== SUPABASE REGISTRATION (SIGN-UP) SYSTEM ====================
  // These handlers power the /farmer-register and /buyer-register pages.
  // Flow for both roles: 1) supabaseClient.auth.signUp() creates the auth.users entry
  //                       2) once we have a session, we insert a matching profile row
  //                          directly into a public table ('farmers' or 'buyers')
  //                          keyed by the new user's id — no DB trigger required
  //                       3) depending on whether email confirmation is required,
  //                          we either log the person straight in or send them to Sign-In
  //
  // IMPORTANT: "Confirm email" must be turned OFF in Supabase
  // (Authentication > Sign In / Providers > Email) for this pilot app.
  // With it on, every signup sends a confirmation email, and Supabase's
  // shared/default email service allows only ~2 emails/hour — which is
  // what causes the "email rate limit exceeded" error on Create Account.
  // Turning it off also means data.session is always returned immediately,
  // so the profile insert below always runs.
  //
  // Run supabase_setup.sql (provided alongside this file) once in the
  // Supabase SQL editor to create these tables before testing sign-up:
  //
  //   create table public.farmers (
  //     id uuid primary key references auth.users(id) on delete cascade,
  //     name text not null,
  //     email text not null,
  //     phone text not null,
  //     location text not null,
  //     crop_type text not null,
  //     created_at timestamp with time zone default now()
  //   );
  //
  //   create table public.buyers (
  //     id uuid primary key references auth.users(id) on delete cascade,
  //     name text not null,
  //     email text not null,
  //     phone text not null,
  //     address text not null,
  //     created_at timestamp with time zone default now()
  //   );
  //
  // Remember to enable Row Level Security + an "insert own row" policy
  // (auth.uid() = id) on both tables so the anon key can only write the
  // signed-up user's own profile.

  const farmerRegisterForm = document.getElementById('farmer-register-form');
  const buyerRegisterForm = document.getElementById('buyer-register-form');

  // Shared helper: basic password validation used by both registration forms
  function validatePasswords(form, password, confirmPassword) {
    if (password.length < 6) {
      showAuthMessage(form, 'Password must be at least 6 characters long.', 'error');
      return false;
    }
    if (password !== confirmPassword) {
      showAuthMessage(form, 'Passwords do not match. Please re-check.', 'error');
      return false;
    }
    return true;
  }

  // Handle Farmer Registration Form Submission
  if (farmerRegisterForm) {
    farmerRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Collect form field values
      const name = document.getElementById('farmer-reg-name').value.trim();
      const email = document.getElementById('farmer-reg-email').value.trim();
      const password = document.getElementById('farmer-reg-password').value;
      const confirmPassword = document.getElementById('farmer-reg-confirm-password').value;
      const phone = document.getElementById('farmer-reg-phone').value.trim();
      const location = document.getElementById('farmer-reg-location').value;
      const cropType = document.getElementById('farmer-reg-crop').value;

      const submitBtn = farmerRegisterForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;

      // Basic client-side validation
      if (!name || !email || !password || !confirmPassword || !phone || !location || !cropType) {
        showAuthMessage(farmerRegisterForm, 'Please fill in all fields.', 'error');
        return;
      }
      if (!validatePasswords(farmerRegisterForm, password, confirmPassword)) {
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Creating account...`;

        if (!supabaseClient) {
          throw new Error('Supabase client was not initialized properly.');
        }

        // Step 1: Create the authentication user.
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              role: 'farmer',
              name: name,
              phone: phone,
              location: location,
              crop_type: cropType
            }
          }
        });

        if (error) {
          throw error;
        }

        // Step 2: Write the profile row directly into public.farmers.
        // We no longer depend on a DB trigger — we insert explicitly here
        // so the data is guaranteed to be saved as soon as we have a session.
        if (data.session && data.user) {
          // Use upsert instead of insert: if this id already has a farmers
          // row (e.g. re-registering the same account, or a double
          // submission of this form), update it instead of throwing a
          // "duplicate key value violates unique constraint" error.
          const { error: profileError } = await supabaseClient
            .from('farmers')
            .upsert([{
              id: data.user.id,
              name: name,
              email: email,
              phone: phone,
              location: location,
              crop_type: cropType
            }], { onConflict: 'id' });

          if (profileError) {
            throw profileError;
          }
        } else if (data.user && !data.session) {
          // signUp succeeded but no session was issued. This happens when
          // the email is already registered (Supabase returns the existing
          // user without an error, to avoid leaking which emails exist) or
          // when email confirmation is still required.
          showAuthMessage(farmerRegisterForm, 'This email may already have an account. Try signing in instead, or check your email to confirm.', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          return;
        }

        farmerRegisterForm.reset();

        if (data.session) {
          // Email confirmation is disabled on this Supabase project — user is logged in immediately
          showAuthMessage(farmerRegisterForm, 'Account created! Redirecting to your dashboard...', 'success');
          localStorage.setItem('auth_role', 'farmer');
          localStorage.setItem('auth_session', JSON.stringify(data.session));
          setTimeout(() => {
            window.location.hash = '#/farmers';
          }, 1800);
        } else {
          // Email confirmation is still required on this Supabase project.
          // Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email)
          // so accounts activate immediately and the profile insert above always runs.
          showAuthMessage(farmerRegisterForm, 'Account created! Please check your email to confirm, then sign in.', 'success');
          setTimeout(() => {
            window.location.hash = '#/farmer-signin';
          }, 2200);
        }

      } catch (err) {
        console.error('Farmer registration error:', err.message);
        showAuthMessage(farmerRegisterForm, err.message || 'Registration failed. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }

  // Handle Buyer Registration Form Submission
  if (buyerRegisterForm) {
    buyerRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Collect form field values
      const name = document.getElementById('buyer-reg-name').value.trim();
      const email = document.getElementById('buyer-reg-email').value.trim();
      const password = document.getElementById('buyer-reg-password').value;
      const confirmPassword = document.getElementById('buyer-reg-confirm-password').value;
      const phone = document.getElementById('buyer-reg-phone').value.trim();
      const address = document.getElementById('buyer-reg-address').value.trim();

      const submitBtn = buyerRegisterForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;

      // Basic client-side validation
      if (!name || !email || !password || !confirmPassword || !phone || !address) {
        showAuthMessage(buyerRegisterForm, 'Please fill in all fields.', 'error');
        return;
      }
      if (!validatePasswords(buyerRegisterForm, password, confirmPassword)) {
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Creating account...`;

        if (!supabaseClient) {
          throw new Error('Supabase client was not initialized properly.');
        }

        // Step 1: Create the authentication user.
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              role: 'buyer',
              name: name,
              phone: phone,
              address: address
            }
          }
        });

        if (error) {
          throw error;
        }

        // Step 2: Write the profile row directly into public.buyers.
        // We no longer depend on a DB trigger — we insert explicitly here
        // so the data is guaranteed to be saved as soon as we have a session.
        if (data.session && data.user) {
          // Use upsert instead of insert: if this id already has a buyers
          // row (e.g. re-registering the same account, or a double
          // submission of this form), update it instead of throwing a
          // "duplicate key value violates unique constraint" error.
          const { error: profileError } = await supabaseClient
            .from('buyers')
            .upsert([{
              id: data.user.id,
              name: name,
              email: email,
              phone: phone,
              address: address
            }], { onConflict: 'id' });

          if (profileError) {
            throw profileError;
          }
        } else if (data.user && !data.session) {
          // signUp succeeded but no session was issued. This happens when
          // the email is already registered (Supabase returns the existing
          // user without an error, to avoid leaking which emails exist) or
          // when email confirmation is still required.
          showAuthMessage(buyerRegisterForm, 'This email may already have an account. Try signing in instead, or check your email to confirm.', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          return;
        }

        buyerRegisterForm.reset();

        if (data.session) {
          showAuthMessage(buyerRegisterForm, 'Account created! Redirecting to the directory...', 'success');
          localStorage.setItem('auth_role', 'buyer');
          localStorage.setItem('auth_session', JSON.stringify(data.session));
          setTimeout(() => {
            window.location.hash = '#/buyers';
          }, 1800);
        } else {
          // Email confirmation is still required on this Supabase project.
          // Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email)
          // so accounts activate immediately and the profile insert above always runs.
          showAuthMessage(buyerRegisterForm, 'Account created! Please check your email to confirm, then sign in.', 'success');
          setTimeout(() => {
            window.location.hash = '#/buyer-signin';
          }, 2200);
        }

      } catch (err) {
        console.error('Buyer registration error:', err.message);
        showAuthMessage(buyerRegisterForm, err.message || 'Registration failed. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }

});
/* ====================================================================
 * LG-EXT — Liquid Glass 27 extended component behavior
 * Progressive enhancement for: FAB, notification banner dismiss,
 * accordion disclosure, segmented control, section-level parallax,
 * and horizontal carousel controls. Each guards for missing markup so
 * pages that don't use a given component are unaffected.
 * ==================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const lgReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Notification banner dismiss ----
  document.querySelectorAll('.notif-banner-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      const banner = btn.closest('.notif-banner');
      if (!banner) return;
      banner.classList.add('lg-dismissing');
      banner.addEventListener('animationend', () => banner.remove(), { once: true });
      setTimeout(() => { if (banner.isConnected) banner.remove(); }, 500);
    });
  });

  // ---- Accordion disclosure ----
  document.querySelectorAll('.accordion').forEach((accordion) => {
    const items = accordion.querySelectorAll('.accordion-item');
    items.forEach((item) => {
      const trigger = item.querySelector('.accordion-trigger');
      const panel = item.querySelector('.accordion-panel-inner');
      if (!trigger || !panel) return;
      trigger.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
      trigger.addEventListener('click', () => {
        const willOpen = !item.classList.contains('open');
        // Single-open behavior within a group, like an iOS settings list.
        items.forEach((other) => {
          other.classList.remove('open');
          const otherTrigger = other.querySelector('.accordion-trigger');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        });
        if (willOpen) {
          item.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  });

  // ---- Segmented control ----
  document.querySelectorAll('.segmented-control').forEach((control) => {
    const options = Array.from(control.querySelectorAll('.segmented-option'));
    const indicator = control.querySelector('.segmented-indicator');
    if (!options.length || !indicator) return;

    function moveIndicator(target, animate = true) {
      const controlRect = control.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      indicator.style.transition = animate ? '' : 'none';
      indicator.style.width = rect.width + 'px';
      indicator.style.transform = `translateX(${rect.left - controlRect.left - 4}px)`;
    }

    const active = control.querySelector('.segmented-option.active') || options[0];
    active.classList.add('active');
    requestAnimationFrame(() => moveIndicator(active, false));

    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        options.forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');
        moveIndicator(opt);
        control.dispatchEvent(new CustomEvent('segmentchange', { detail: { value: opt.dataset.value || opt.textContent.trim() } }));
      });
    });

    window.addEventListener('resize', () => {
      const current = control.querySelector('.segmented-option.active');
      if (current) moveIndicator(current, false);
    });
  });

  // ---- FAB ripple (reuses the existing .lg-ripple-host / .lg-ripple system) ----
  document.querySelectorAll('.fab').forEach((fab) => {
    fab.classList.add('lg-ripple-host');
  });

  // ---- Section-level parallax on scroll (desktop only, respects reduced motion) ----
  if (!lgReducedMotion && window.matchMedia('(min-width: 900px)').matches) {
    const parallaxSections = document.querySelectorAll('.parallax-section');
    if (parallaxSections.length) {
      let ticking = false;
      const updateParallax = () => {
        parallaxSections.forEach((section) => {
          const rect = section.getBoundingClientRect();
          const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
          const layers = section.querySelectorAll('.parallax-layer');
          layers.forEach((layer, i) => {
            const depth = (i + 1) * 18;
            const y = (progress - 0.5) * depth;
            layer.style.transform = `translateY(${y}px)`;
          });
        });
        ticking = false;
      };
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      }, { passive: true });
      updateParallax();
    }
  }

  // ---- Carousel prev/next controls ----
  document.querySelectorAll('[data-carousel]').forEach((wrap) => {
    const track = wrap.querySelector('.carousel');
    const prevBtn = wrap.querySelector('[data-carousel-prev]');
    const nextBtn = wrap.querySelector('[data-carousel-next]');
    if (!track) return;
    const scrollByCard = (dir) => {
      const card = track.querySelector('.carousel-card');
      const amount = card ? card.getBoundingClientRect().width + 20 : 300;
      track.scrollBy({ left: dir * amount, behavior: 'smooth' });
    };
    if (prevBtn) prevBtn.addEventListener('click', () => scrollByCard(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByCard(1));
  });

  // ---- Scroll-linked 3D tilt (Apple-style card depth) ----
  // Cards marked .tilt-on-scroll rotate in 3D as they pass through the
  // viewport: tilted back on the way in, flat when centered, tilted
  // forward on the way out. Runs on a rAF-throttled scroll/resize
  // listener and is skipped entirely under reduced-motion.
  const tiltEls = document.querySelectorAll('.tilt-on-scroll');
  if (tiltEls.length && !lgReducedMotion) {
    const MAX_ROTATE_DEG = 14;
    const MAX_TRANSLATE_Z = -60; // cards recede slightly at the edges
    const MAX_SCALE_DROP = 0.06;

    let tiltTicking = false;

    const updateTilt = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      tiltEls.forEach((el) => {
        // Let the entrance reveal (.lg-reveal / .lg-visible, added by the
        // scroll-reveal observer above) finish its own fade-and-rise first;
        // only take over with the inline tilt transform once a card has
        // actually appeared, so the two animations don't fight.
        if (el.classList.contains('lg-reveal') && !el.classList.contains('lg-visible')) {
          return;
        }
        const rect = el.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const viewportCenter = vh / 2;
        // -1 when the card center is at the bottom edge, 0 when centered,
        // +1 when it's at the top edge.
        let progress = (viewportCenter - cardCenter) / viewportCenter;
        progress = Math.max(-1, Math.min(1, progress));

        const rotateX = progress * MAX_ROTATE_DEG;
        const translateZ = Math.abs(progress) * MAX_TRANSLATE_Z;
        const scale = 1 - Math.abs(progress) * MAX_SCALE_DROP;
        const translateY = Math.abs(progress) * 6;

        el.style.transform =
          `perspective(1600px) rotateX(${rotateX.toFixed(2)}deg) ` +
          `translateZ(${translateZ.toFixed(1)}px) translateY(${translateY.toFixed(1)}px) ` +
          `scale(${scale.toFixed(3)})`;
      });
      tiltTicking = false;
    };

    const requestTiltUpdate = () => {
      if (!tiltTicking) {
        requestAnimationFrame(updateTilt);
        tiltTicking = true;
      }
    };

    window.addEventListener('scroll', requestTiltUpdate, { passive: true });
    window.addEventListener('resize', requestTiltUpdate);
    updateTilt();
  }

  // ---- Scroll progress glow beam (fills + subtly re-hues as you scroll) ----
  (function initScrollProgressGlow() {
    const fill = document.getElementById('scroll-progress-fill');
    if (!fill) return;

    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const scrollable = (doc.scrollHeight - doc.clientHeight) || 1;
      const pct = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100));
      fill.style.width = pct.toFixed(2) + '%';
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  // ---- Pointer-tracked spotlight glow for `.glow-card` surfaces ----
  // Sets --spot-x/--spot-y (percentages) on the card so the radial-gradient
  // glow defined in CSS follows the cursor. Delegated + rAF-throttled so it
  // stays cheap even with many cards (e.g. the directory results grid).
  (function initGlowCardSpotlight() {
    if (lgPrefersReducedMotion || !lgHasHover) return;

    let pendingEl = null;
    let pendingX = 0;
    let pendingY = 0;
    let ticking = false;

    const apply = () => {
      if (pendingEl) {
        pendingEl.style.setProperty('--spot-x', pendingX.toFixed(1) + '%');
        pendingEl.style.setProperty('--spot-y', pendingY.toFixed(1) + '%');
      }
      ticking = false;
    };

    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest ? e.target.closest('.glow-card') : null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      pendingEl = card;
      pendingX = ((e.clientX - rect.left) / rect.width) * 100;
      pendingY = ((e.clientY - rect.top) / rect.height) * 100;
      if (!ticking) {
        requestAnimationFrame(apply);
        ticking = true;
      }
    }, { passive: true });
  })();

  // ---- Pause off-screen paint-heavy ambient animations ----
  // Most of the decorative motion in this file (orbs, sheens, tilt, parallax)
  // animates `transform`/`opacity`, which the browser can run on the
  // compositor thread — cheap, and doesn't get janky under load. A handful
  // of elements instead animate `background-position` (the wallpaper
  // "breathe", the hero dust drift, the gradient-text heading sheen, the
  // scroll-progress bar sheen). background-position can't be composited, so
  // the browser has to repaint that element on *every frame* the animation
  // is running — and by default it keeps running even while the element is
  // scrolled miles off-screen or on a page the user isn't looking at. On
  // slower/integrated GPUs those constant off-screen repaints are a real,
  // measurable source of jank elsewhere on the page. Pausing them via
  // IntersectionObserver whenever they're not visible removes that cost
  // entirely with no visible difference, since nobody's looking anyway.
  (function initPauseOffscreenAnimations() {
    if (lgPrefersReducedMotion || !('IntersectionObserver' in window)) return;

    const PAINT_HEAVY_SELECTOR = '#home-hero, .hero-dust, .glow-heading, .scroll-progress-fill';
    const targets = document.querySelectorAll(PAINT_HEAVY_SELECTOR);
    if (!targets.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
      });
    }, { threshold: 0 });

    targets.forEach((el) => io.observe(el));
  })();

  // ---- Icon morph helper: toggling `.swapped` on any `.icon-morph` element ----
  document.querySelectorAll('[data-icon-morph-target]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const targetSelector = trigger.getAttribute('data-icon-morph-target');
      const target = document.querySelector(targetSelector);
      if (target) target.classList.toggle('swapped');
    });
  });
});
