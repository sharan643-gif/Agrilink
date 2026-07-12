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
  (function initTiltEffect() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (prefersReducedMotion || isTouchDevice) return;

    const TILT_SELECTOR = '.directory-card, .auth-card';
    const MAX_TILT_DEG = 6;

    document.addEventListener('mousemove', (e) => {
      const card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;  // 0 -> 1
      const py = (e.clientY - rect.top) / rect.height;   // 0 -> 1

      const rotateY = (px - 0.5) * (MAX_TILT_DEG * 2);
      const rotateX = (0.5 - py) * (MAX_TILT_DEG * 2);

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    document.addEventListener('mouseout', (e) => {
      const card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
      if (!card) return;
      // Only reset once the pointer actually leaves the card (not on inner element hops)
      if (card.contains(e.relatedTarget)) return;
      card.style.transform = '';
    });
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
      fetchListings();
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

    if (role === 'buyer') {
      roleBadge.textContent = 'Buyer';
      extraLabel.textContent = 'Business Address';
      extraValue.textContent = meta.address || 'Not available';
      dashboardBtn.onclick = () => { window.location.hash = '#/buyers'; };
    } else {
      roleBadge.textContent = 'Farmer';
      extraLabel.textContent = 'Primary Crop';
      extraValue.textContent = meta.crop_type || 'Not available';
      dashboardBtn.onclick = () => { window.location.hash = '#/farmers'; };
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
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
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
      renderDirectory(listings);
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
    renderDirectory(filtered);
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
    if (displayFound) return displayFound;

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

  // ==================== RENDER DIRECTORY CARDS ====================
  function renderDirectory(dataList) {
    directoryGrid.innerHTML = '';
    
    if (dataList.length === 1) {
      resultsCountTitle.textContent = "1 Verified Listing Found";
    } else {
      resultsCountTitle.textContent = `${dataList.length} Verified Listings Found`;
    }

    if (dataList.length === 0) {
      directoryGrid.innerHTML = `
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
      card.className = 'directory-card';
      
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
          <div class="crop-price-badge">${item.price}</div>
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
      directoryGrid.appendChild(card);
    });

    // Attach Event Listeners
    document.querySelectorAll('.contact-farmer-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
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
    modalPrice.textContent = targetListing.price;
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
