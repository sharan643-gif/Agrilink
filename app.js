/**
 * Farmer-Direct Marketplace
 * Interactive Application Engine (Routing, API Fetching, Simulation)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==================== STATE & BACKEND CONFIG ====================
  const API_BASE_URL = 'http://localhost:5000/api';

  // Local fallback mock database in case the database server is not running yet
  const FALLBACK_LISTINGS = [
    {
      id: 1,
      farmerName: "Thiru R. Selvam",
      avatar: "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-1.png?raw=true",
      crop: "Salem Turmeric",
      quantity: 1200,
      quantityDisplay: "1,200 Kg",
      price: "₹140 - ₹160 / Kg",
      location: "Salem",
      description: "[FALLBACK DATA] GI-Tagged premium quality Salem turmeric. Sun-dried and polished. Low moisture content, rich yellow curcumin (5.2%).",
      rating: "4.9",
      ratingCount: 14,
      verified: true,
      phone: "+919845011111",
      image: "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-1.png?raw=true"
    },
    {
      id: 2,
      farmerName: "Smt. K. Gomathi",
      avatar: "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-2.png?raw=true",
      crop: "Onions",
      quantity: 3500,
      quantityDisplay: "3.5 Tonnes",
      price: "₹24 - ₹28 / Kg",
      location: "Erode",
      description: "[FALLBACK DATA] Bellary Red onions. Well-cured, double-skin quality. Size 55mm+. Harvested last week, stored in ventilated cold structures.",
      rating: "4.8",
      ratingCount: 22,
      verified: true,
      phone: "+919845022222",
      image: "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-2.png?raw=true"
    }
  ];

  // Active runtime state
  let listings = [];

  // ==================== DOM ELEMENTS ====================
  const header = document.getElementById('header');
  const navMenu = document.getElementById('nav-menu');
  const mobileToggle = document.getElementById('mobile-toggle');
  const pageViews = document.querySelectorAll('.page-view');
  const navLinks = document.querySelectorAll('.nav-link, .nav-cta');
  
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
  const modalCallBtn = document.getElementById('modal-call-btn');
  const modalWaBtn = document.getElementById('modal-wa-btn');

  // Forms
  const simulateListingForm = document.getElementById('simulate-listing-form');
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
    '/contact': 'page-contact'
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

    // Close Mobile Menu if open
    navMenu.classList.remove('active');
    mobileToggle.classList.remove('active');
  }

  window.addEventListener('hashchange', handleNavigation);
  handleNavigation();


  // ==================== HEADER SCROLL EFFECT ====================
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });


  // ==================== MOBILE NAVIGATION ====================
  mobileToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    mobileToggle.classList.toggle('active');
  });


  // ==================== DATABASE CONNECTIVITY (API FETCH) ====================
  
  async function fetchListings() {
    resultsCountTitle.textContent = "Loading Directory...";
    
    const cropVal = searchCropInput.value.trim();
    const locVal = filterLocationSelect.value;
    const qtyVal = filterQuantitySelect.value;

    // Construct URL with Query params for MongoDB filtering
    let url = `${API_BASE_URL}/listings?`;
    if (cropVal) url += `crop=${encodeURIComponent(cropVal)}&`;
    if (locVal) url += `location=${encodeURIComponent(locVal)}&`;
    if (qtyVal) url += `quantity=${encodeURIComponent(qtyVal)}&`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('API server responded with error status');
      }
      listings = await response.json();
      renderDirectory(listings);
    } catch (error) {
      console.warn('API error, falling back to local simulation data:', error.message);
      // Fallback local query simulation
      simulateLocalQuery(cropVal, locVal, qtyVal);
    }
  }

  // Fallback simulator if backend is offline
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

      card.innerHTML = `
        <div class="card-image-box">
          <img src="${item.image}" alt="${item.crop} harvest">
          ${verificationBadgeHtml}
          <div class="crop-price-badge">${item.price}</div>
        </div>
        <div class="card-content">
          <div class="card-farmer-info">
            <img src="${item.avatar}" alt="${item.farmerName}" class="farmer-avatar">
            <div class="farmer-name-details">
              <h4>${item.farmerName}</h4>
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
            <div class="meta-item">Available Stock <span>${item.quantityDisplay}</span></div>
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

    modalFarmerAvatar.src = targetListing.avatar;
    modalFarmerName.textContent = targetListing.farmerName;
    modalFarmerLocation.textContent = `${targetListing.location} District, Tamil Nadu`;
    modalCropName.textContent = targetListing.crop;
    modalQuantity.textContent = targetListing.quantityDisplay;
    modalPrice.textContent = targetListing.price;
    
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
      `Hello ${targetListing.farmerName}, I saw your listing for ${targetListing.crop} (${targetListing.quantityDisplay}) on the Farmer-Direct Marketplace portal. Is the stock still available? I would like to negotiate details.`
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

  // Simulate Farmer Produce Listing Submission
  if (simulateListingForm) {
    simulateListingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('sim-farmer-name').value;
      const phone = document.getElementById('sim-phone').value;
      const crop = document.getElementById('sim-crop-name').value;
      const qtyInput = document.getElementById('sim-quantity').value;
      const price = document.getElementById('sim-price').value;
      const location = document.getElementById('sim-location').value;
      const desc = document.getElementById('sim-description').value || "Harvest quality checked, ready to load.";

      const parsedQty = parseFloat(qtyInput.replace(/[^0-9.]/g, '')) || 800;

      let defaultAvatar = "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-1.png?raw=true";
      let defaultCropImg = "https://github.com/sharan643-gif/Agrilink/blob/main/hero_bg.png?raw=true";
      
      if (crop === 'Onions' || crop === 'Mangoes (Alphonso)') {
        defaultAvatar = "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-2.png?raw=true";
        defaultCropImg = "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-2.png?raw=true";
      } else if (crop === 'Salem Turmeric') {
        defaultAvatar = "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-1.png?raw=true";
        defaultCropImg = "https://github.com/sharan643-gif/Agrilink/blob/main/farmer-1.png?raw=true";
      }

      const listingData = {
        farmerName: name,
        avatar: defaultAvatar,
        crop: crop,
        quantity: parsedQty,
        quantityDisplay: qtyInput,
        price: `${price} / Unit`,
        location: location,
        description: desc,
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        image: defaultCropImg
      };

      try {
        const response = await fetch(`${API_BASE_URL}/listings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listingData)
        });

        if (!response.ok) {
          throw new Error('Failed to create listing on backend database');
        }

        showToast("Success! Listing saved in MongoDB database.");
        simulateListingForm.reset();
        
        setTimeout(() => {
          window.location.hash = '#/buyers';
        }, 1500);

      } catch (error) {
        console.warn('API error, saving listing in local browser memory instead:', error.message);
        
        // Offline Fallback simulation
        const fallbackIdListing = {
          ...listingData,
          id: Date.now(),
          rating: "5.0",
          ratingCount: 0,
          verified: true
        };
        listings.unshift(fallbackIdListing);
        showToast("Success! Listing added to temporary browser state.", "success");
        simulateListingForm.reset();

        setTimeout(() => {
          window.location.hash = '#/buyers';
        }, 1500);
      }
    });
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
        const response = await fetch(`${API_BASE_URL}/registrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(regData)
        });

        if (!response.ok) {
          throw new Error('Failed to submit registration on backend database');
        }

        showToast(`Registration saved to MongoDB! Welcome, ${name}.`);
        pilotRegistrationForm.reset();

      } catch (error) {
        console.warn('API error, simulating registration locally:', error.message);
        showToast(`Registered successfully (Local Sim)! Welcome, ${name}.`);
        pilotRegistrationForm.reset();
      }
    });
  }

});
