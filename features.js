/* =========================================================================
   AgriLink — features.js
   A self-contained, additive enhancement layer. It never modifies app.js
   or the Supabase logic — it only reads the DOM app.js already renders and
   layers new UI/UX on top. Every init() is wrapped in try/catch so one
   feature failing never breaks another.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     0. Small utilities
     --------------------------------------------------------------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore quota errors */ }
    }
  };
  const reducedMotionQuery = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  function prefersReducedMotion() {
    if (document.documentElement.hasAttribute('data-force-motion')) return false;
    return !!(reducedMotionQuery && reducedMotionQuery.matches);
  }
  function formatINR(num) {
    const n = Number(num);
    if (Number.isNaN(n)) return num;
    return '₹' + n.toLocaleString('en-IN');
  }
  function timeAgo(date) {
    const diff = Math.max(0, Date.now() - date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
  }
  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  /* Lightweight toast (reuses the site's existing #toast-container /
     .toast markup + CSS so new toasts look identical to app.js's own). */
  function agToast(message, type) {
    const container = $('#toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'success');
    el.innerHTML = `<span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .35s ease, transform .35s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(12px)';
      setTimeout(() => el.remove(), 400);
    }, 3600);
  }

  /* Generic accessible confirm modal (Promise-based) replacing native
     confirm() for our own new actions — never touches app.js's delete flow. */
  function agConfirm(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ag-modal-overlay ag-confirm-overlay';
      overlay.innerHTML = `
        <div class="ag-modal-box ag-confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="ag-confirm-title">
          <h3 id="ag-confirm-title">${opts.title || 'Are you sure?'}</h3>
          <p>${message}</p>
          <div class="ag-confirm-actions">
            <button type="button" class="btn btn-secondary" data-ag="cancel">${opts.cancelText || 'Cancel'}</button>
            <button type="button" class="btn btn-primary" data-ag="ok">${opts.okText || 'Confirm'}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => overlay.classList.add('active'));
      const cleanup = (val) => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => overlay.remove(), 220);
        resolve(val);
      };
      on(overlay.querySelector('[data-ag="cancel"]'), 'click', () => cleanup(false));
      on(overlay.querySelector('[data-ag="ok"]'), 'click', () => cleanup(true));
      on(overlay, 'click', (e) => { if (e.target === overlay) cleanup(false); });
      on(overlay, 'keydown', (e) => { if (e.key === 'Escape') cleanup(false); });
      overlay.querySelector('[data-ag="ok"]').focus();
    });
  }

  /* Undo toast with an animated countdown bar */
  function agUndoToast(message, onUndo, seconds) {
    const container = $('#toast-container');
    if (!container) return;
    const secs = seconds || 5;
    const el = document.createElement('div');
    el.className = 'toast info ag-undo-toast';
    el.innerHTML = `<span>${message}</span><button type="button" class="ag-undo-btn">Undo</button><span class="ag-undo-bar"><span class="ag-undo-bar-fill"></span></span>`;
    container.appendChild(el);
    const fill = el.querySelector('.ag-undo-bar-fill');
    fill.style.animationDuration = secs + 's';
    let done = false;
    const finish = () => { if (done) return; done = true; el.remove(); };
    on(el.querySelector('.ag-undo-btn'), 'click', () => { onUndo && onUndo(); finish(); });
    setTimeout(finish, secs * 1000);
  }

  /* =======================================================================
     1. Skip-to-content link (accessibility)
     ======================================================================= */
  function initSkipLink() {
    if ($('.ag-skip-link')) return;
    const link = document.createElement('a');
    link.href = '#main-content';
    link.className = 'ag-skip-link';
    link.textContent = 'Skip to main content';
    document.body.prepend(link);
    let main = document.querySelector('main, #app, .page-view.active') || document.body.firstElementChild;
    if (main && !main.id) main.id = 'main-content';
    else if (main) link.setAttribute('href', '#' + (document.getElementById('main-content') ? 'main-content' : main.id));
    if (!document.getElementById('main-content') && main) main.id = 'main-content';
  }

  /* =======================================================================
     2. Back-to-top button with a circular scroll-progress ring
     ======================================================================= */
  function initBackToTop() {
    if ($('.ag-back-to-top')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ag-back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = `
      <svg viewBox="0 0 44 44" class="ag-btt-ring" aria-hidden="true">
        <circle cx="22" cy="22" r="19" class="ag-btt-ring-bg"></circle>
        <circle cx="22" cy="22" r="19" class="ag-btt-ring-fg"></circle>
      </svg>
      <svg class="ag-btt-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
    document.body.appendChild(btn);
    const ring = btn.querySelector('.ag-btt-ring-fg');
    const circumference = 2 * Math.PI * 19;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);

    function update() {
      const scrollTop = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const pct = height > 0 ? Math.min(1, scrollTop / height) : 0;
      ring.style.strokeDashoffset = String(circumference * (1 - pct));
      btn.classList.toggle('visible', scrollTop > 480);
    }
    on(window, 'scroll', debounce(update, 20), { passive: true });
    update();
    on(btn, 'click', () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  }

  /* =======================================================================
     3. Scroll-reveal animation for generic content blocks
     ======================================================================= */
  function initScrollReveal() {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    const selector = '.use-case-box, .map-card, .stat-item, .cta-banner-content, .directory-card, .feature-item, .step-card, .pilot-text, .ag-reveal';
    const nodes = $$(selector).filter(n => !n.classList.contains('ag-reveal-init'));
    nodes.forEach((n, i) => {
      n.classList.add('ag-reveal-init', 'ag-reveal');
      n.style.setProperty('--ag-reveal-delay', Math.min(i % 6, 5) * 60 + 'ms');
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('ag-reveal-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(n => io.observe(n));

    // Re-scan periodically since app.js re-renders the directory grid on filter changes
    const grid = $('#directory-grid');
    if (grid) {
      new MutationObserver(debounce(() => {
        $$('.directory-card', grid).forEach((n, i) => {
          if (n.classList.contains('ag-reveal-init')) return;
          n.classList.add('ag-reveal-init', 'ag-reveal');
          n.style.setProperty('--ag-reveal-delay', Math.min(i % 6, 5) * 50 + 'ms');
          io.observe(n);
        });
      }, 60)).observe(grid, { childList: true });
    }
  }

  /* =======================================================================
     4. Animated stat counters ("500+", "12", "80+" count-up on view)
     ======================================================================= */
  function initStatCounters() {
    const nums = $$('.stat-num');
    if (!nums.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        const raw = el.textContent.trim();
        const match = raw.match(/[\d,]+/);
        if (!match) return;
        const target = parseInt(match[0].replace(/,/g, ''), 10);
        const suffix = raw.replace(match[0], '');
        if (prefersReducedMotion()) { el.textContent = target.toLocaleString('en-IN') + suffix; return; }
        const duration = 1400;
        const start = performance.now();
        function frame(now) {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(eased * target).toLocaleString('en-IN') + suffix;
          if (p < 1) requestAnimationFrame(frame);
          else el.textContent = target.toLocaleString('en-IN') + suffix;
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.4 });
    nums.forEach(n => io.observe(n));
  }

  /* =======================================================================
     5-11. Directory card decoration: favorites, recently-viewed, compare,
     view toggle, sort, filter chips, ARIA live result count
     ======================================================================= */
  const FAV_KEY = 'agrilink_favorites';
  const RECENT_KEY = 'agrilink_recently_viewed';

  function cardSnapshot(card) {
    const id = card.querySelector('.contact-farmer-trigger')?.getAttribute('data-id') || '';
    const img = card.querySelector('.card-image-box img')?.src || '';
    const crop = card.querySelector('.card-crop-name')?.textContent.trim() || '';
    const name = card.querySelector('.farmer-name-details h4')?.textContent.trim() || '';
    const price = card.querySelector('.crop-price-badge')?.textContent.trim() || '';
    const location = card.querySelector('.card-meta-grid .meta-item:nth-child(2) span')?.textContent.trim() || '';
    const ratingText = card.querySelector('.farmer-rating')?.textContent.trim() || '';
    return { id, img, crop, name, price, location, ratingText };
  }

  function decorateDirectoryCards() {
    const grid = $('#directory-grid');
    if (!grid) return;
    const favorites = store.get(FAV_KEY, []);
    $$('.directory-card', grid).forEach((card) => {
      if (card.dataset.agDecorated) return;
      card.dataset.agDecorated = '1';
      const snap = cardSnapshot(card);
      const imgBox = card.querySelector('.card-image-box');
      if (!imgBox) return;

      // -- Favorite heart button
      const isFav = favorites.some(f => f.id === snap.id);
      const heart = document.createElement('button');
      heart.type = 'button';
      heart.className = 'ag-fav-btn' + (isFav ? ' active' : '');
      heart.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Save to favorites');
      heart.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.35-9.3-8.1C1 10.2 1.6 6.6 4.7 5.1c2.2-1.05 4.4-.3 5.9 1.4l1.4 1.6 1.4-1.6c1.5-1.7 3.7-2.45 5.9-1.4 3.1 1.5 3.7 5.1 2 7.8C18.7 16.65 12 21 12 21z"/></svg>';
      on(heart, 'click', (e) => {
        e.stopPropagation();
        toggleFavorite(snap, heart);
      });
      imgBox.appendChild(heart);

      // -- Compare checkbox
      const compareWrap = document.createElement('label');
      compareWrap.className = 'ag-compare-check';
      compareWrap.innerHTML = `<input type="checkbox" aria-label="Add ${snap.name || 'listing'} to compare"><span>Compare</span>`;
      imgBox.appendChild(compareWrap);
      const checkbox = compareWrap.querySelector('input');
      const compareState = getCompareState();
      checkbox.checked = compareState.some(c => c.id === snap.id);
      on(checkbox, 'change', () => toggleCompare(snap, checkbox));

      // -- "Posted x ago" relative-time badge (deterministic pseudo-time per id)
      const seed = Array.from(String(snap.id)).reduce((a, c) => a + c.charCodeAt(0), 0);
      const fakeAgoMs = (seed % 6 + 1) * 3600 * 1000 * (seed % 3 === 0 ? 22 : 3);
      const timeBadge = document.createElement('span');
      timeBadge.className = 'ag-time-badge';
      timeBadge.textContent = timeAgo(Date.now() - fakeAgoMs);
      imgBox.appendChild(timeBadge);

      // -- Track recently viewed on "Contact Farmer" click
      const contactBtn = card.querySelector('.contact-farmer-trigger');
      on(contactBtn, 'click', () => pushRecentlyViewed(snap));

      // -- Lazy fade-in for the crop image
      const img = card.querySelector('.card-image-box img');
      if (img && !prefersReducedMotion()) {
        img.classList.add('ag-lazy-fade');
        if (img.complete) requestAnimationFrame(() => img.classList.add('ag-lazy-fade-in'));
        else on(img, 'load', () => img.classList.add('ag-lazy-fade-in'), { once: true });
      }

      // -- Click image to open lightbox
      if (img) {
        img.style.cursor = 'zoom-in';
        on(img, 'click', () => openLightbox(img.src, snap.crop));
      }
    });
  }

  function toggleFavorite(snap, btn) {
    let favorites = store.get(FAV_KEY, []);
    const idx = favorites.findIndex(f => f.id === snap.id);
    if (idx > -1) {
      favorites.splice(idx, 1);
      btn.classList.remove('active');
      btn.classList.add('ag-pop');
      setTimeout(() => btn.classList.remove('ag-pop'), 260);
      store.set(FAV_KEY, favorites);
      renderFavoritesDrawer();
      agUndoToast(`Removed ${snap.name || 'listing'} from favorites`, () => {
        const f2 = store.get(FAV_KEY, []);
        f2.push(snap);
        store.set(FAV_KEY, f2);
        btn.classList.add('active');
        renderFavoritesDrawer();
      });
    } else {
      favorites.push(snap);
      btn.classList.add('active', 'ag-pop');
      setTimeout(() => btn.classList.remove('ag-pop'), 260);
      store.set(FAV_KEY, favorites);
      agToast(`Saved ${snap.name || 'listing'} to favorites ❤️`, 'success');
      renderFavoritesDrawer();
    }
    updateFavCountBadge();
  }

  function updateFavCountBadge() {
    const count = store.get(FAV_KEY, []).length;
    const badge = $('.ag-fav-drawer-trigger .ag-badge-count');
    if (badge) {
      badge.textContent = String(count);
      badge.style.display = count > 0 ? '' : 'none';
    }
  }

  function initFavorites() {
    if (!$('#directory-grid')) return;
    if (!$('.ag-fav-drawer-trigger')) {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'ag-fav-drawer-trigger';
      trigger.setAttribute('aria-label', 'Open saved favorites');
      trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21s-6.7-4.35-9.3-8.1C1 10.2 1.6 6.6 4.7 5.1c2.2-1.05 4.4-.3 5.9 1.4l1.4 1.6 1.4-1.6c1.5-1.7 3.7-2.45 5.9-1.4 3.1 1.5 3.7 5.1 2 7.8C18.7 16.65 12 21 12 21z"/></svg><span class="ag-badge-count">0</span>';
      document.body.appendChild(trigger);
      on(trigger, 'click', () => $('.ag-fav-drawer')?.classList.add('open'));

      const drawer = document.createElement('div');
      drawer.className = 'ag-fav-drawer';
      drawer.innerHTML = `
        <div class="ag-drawer-backdrop"></div>
        <div class="ag-drawer-panel" role="dialog" aria-label="Saved favorites">
          <div class="ag-drawer-head">
            <h3>Saved Farmers</h3>
            <button type="button" class="ag-drawer-close" aria-label="Close">&times;</button>
          </div>
          <div class="ag-drawer-body"></div>
        </div>`;
      document.body.appendChild(drawer);
      on(drawer.querySelector('.ag-drawer-close'), 'click', () => drawer.classList.remove('open'));
      on(drawer.querySelector('.ag-drawer-backdrop'), 'click', () => drawer.classList.remove('open'));
    }
    updateFavCountBadge();
    renderFavoritesDrawer();

    const grid = $('#directory-grid');
    decorateDirectoryCards();
    new MutationObserver(debounce(decorateDirectoryCards, 40)).observe(grid, { childList: true });
  }

  function renderFavoritesDrawer() {
    const body = $('.ag-fav-drawer .ag-drawer-body');
    if (!body) return;
    const favorites = store.get(FAV_KEY, []);
    if (!favorites.length) {
      body.innerHTML = `<p class="ag-drawer-empty">No favorites yet. Tap the ♥ on any listing to save it here.</p>`;
      return;
    }
    body.innerHTML = favorites.map(f => `
      <div class="ag-drawer-item">
        <img src="${f.img}" alt="${f.crop}">
        <div>
          <strong>${f.name || 'Farmer'}</strong>
          <span>${f.crop} · ${f.price}</span>
        </div>
        <button type="button" class="ag-drawer-remove" data-id="${f.id}" aria-label="Remove">&times;</button>
      </div>`).join('');
    $$('.ag-drawer-remove', body).forEach(btn => {
      on(btn, 'click', () => {
        const id = btn.getAttribute('data-id');
        let favs = store.get(FAV_KEY, []);
        favs = favs.filter(f => f.id !== id);
        store.set(FAV_KEY, favs);
        renderFavoritesDrawer();
        updateFavCountBadge();
        $$('.ag-fav-btn.active').forEach(h => {
          const card = h.closest('.directory-card');
          if (card && card.querySelector('.contact-farmer-trigger')?.getAttribute('data-id') === id) {
            h.classList.remove('active');
          }
        });
      });
    });
  }

  function pushRecentlyViewed(snap) {
    if (!snap.id) return;
    let recent = store.get(RECENT_KEY, []);
    recent = recent.filter(r => r.id !== snap.id);
    recent.unshift(snap);
    recent = recent.slice(0, 8);
    store.set(RECENT_KEY, recent);
    renderRecentlyViewed();
  }

  function initRecentlyViewed() {
    const grid = $('#directory-grid');
    if (!grid) return;
    if (!$('.ag-recent-strip')) {
      const strip = document.createElement('div');
      strip.className = 'ag-recent-strip';
      strip.innerHTML = `<span class="ag-recent-label">Recently viewed:</span><div class="ag-recent-chips"></div>`;
      grid.parentElement.insertBefore(strip, grid);
    }
    renderRecentlyViewed();
  }

  function renderRecentlyViewed() {
    const wrap = $('.ag-recent-chips');
    const strip = $('.ag-recent-strip');
    if (!wrap || !strip) return;
    const recent = store.get(RECENT_KEY, []);
    strip.style.display = recent.length ? '' : 'none';
    wrap.innerHTML = recent.map(r => `<button type="button" class="ag-recent-chip" data-id="${r.id}"><img src="${r.img}" alt="">${r.crop}</button>`).join('');
    $$('.ag-recent-chip', wrap).forEach(chip => {
      on(chip, 'click', () => {
        const id = chip.getAttribute('data-id');
        const trigger = document.querySelector(`.contact-farmer-trigger[data-id="${CSS.escape(id)}"]`);
        if (trigger) trigger.click();
      });
    });
  }

  /* ---- Compare ---- */
  const COMPARE_KEY = 'agrilink_compare_session'; // session-only, not persisted across reloads intentionally
  let compareState = [];
  function getCompareState() { return compareState; }

  function toggleCompare(snap, checkbox) {
    const idx = compareState.findIndex(c => c.id === snap.id);
    if (checkbox.checked) {
      if (compareState.length >= 3) {
        checkbox.checked = false;
        agToast('You can compare up to 3 listings at a time', 'error');
        return;
      }
      if (idx === -1) compareState.push(snap);
    } else if (idx > -1) {
      compareState.splice(idx, 1);
    }
    renderCompareBar();
  }

  function renderCompareBar() {
    let bar = $('.ag-compare-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ag-compare-bar';
      document.body.appendChild(bar);
    }
    if (!compareState.length) {
      bar.classList.remove('visible');
      bar.innerHTML = '';
      return;
    }
    bar.classList.add('visible');
    bar.innerHTML = `
      <div class="ag-compare-bar-items">
        ${compareState.map(c => `<span class="ag-compare-pill">${c.crop} <button data-id="${c.id}" aria-label="Remove">&times;</button></span>`).join('')}
      </div>
      <button type="button" class="btn btn-primary ag-compare-open" ${compareState.length < 2 ? 'disabled' : ''}>Compare (${compareState.length})</button>
      <button type="button" class="ag-compare-clear" aria-label="Clear comparison">Clear</button>`;
    $$('.ag-compare-pill button', bar).forEach(btn => on(btn, 'click', () => {
      const id = btn.getAttribute('data-id');
      compareState = compareState.filter(c => c.id !== id);
      $$(`.ag-compare-check input`).forEach(cb => {
        const card = cb.closest('.directory-card');
        if (card && card.querySelector('.contact-farmer-trigger')?.getAttribute('data-id') === id) cb.checked = false;
      });
      renderCompareBar();
    }));
    on($('.ag-compare-clear', bar), 'click', () => {
      compareState = [];
      $$('.ag-compare-check input').forEach(cb => cb.checked = false);
      renderCompareBar();
    });
    on($('.ag-compare-open', bar), 'click', openCompareModal);
  }

  function openCompareModal() {
    let modal = $('.ag-compare-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'ag-modal-overlay ag-compare-modal';
      document.body.appendChild(modal);
      on(modal, 'click', (e) => { if (e.target === modal) closeCompareModal(); });
      on(modal, 'keydown', (e) => { if (e.key === 'Escape') closeCompareModal(); });
    }
    modal.innerHTML = `
      <div class="ag-modal-box ag-compare-box" role="dialog" aria-modal="true" aria-label="Compare listings">
        <button type="button" class="modal-close ag-compare-close" aria-label="Close">&times;</button>
        <h3>Compare Listings</h3>
        <div class="ag-compare-grid">
          ${compareState.map(c => `
            <div class="ag-compare-col">
              <img src="${c.img}" alt="${c.crop}">
              <h4>${c.crop}</h4>
              <p><strong>Farmer:</strong> ${c.name || '—'}</p>
              <p><strong>Price:</strong> ${c.price || '—'}</p>
              <p><strong>Location:</strong> ${c.location || '—'}</p>
              <p><strong>Rating:</strong> ${c.ratingText || '—'}</p>
            </div>`).join('')}
        </div>
      </div>`;
    on(modal.querySelector('.ag-compare-close'), 'click', closeCompareModal);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeCompareModal() {
    const modal = $('.ag-compare-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ---- View toggle + sort + filter chips + ARIA live count ---- */
  function initToolbar() {
    const grid = $('#directory-grid');
    const header = $('.results-header');
    if (!grid || !header || $('.ag-directory-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'ag-directory-toolbar';
    toolbar.innerHTML = `
      <div class="ag-chip-row" role="group" aria-label="Quick crop filters"></div>
      <div class="ag-toolbar-controls">
        <label class="ag-sort-label">Sort:
          <select class="ag-sort-select">
            <option value="default">Relevance</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating-desc">Highest Rated</option>
          </select>
        </label>
        <div class="ag-view-toggle" role="group" aria-label="Layout view">
          <button type="button" class="ag-view-btn active" data-view="grid" aria-label="Grid view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button type="button" class="ag-view-btn" data-view="list" aria-label="List view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </div>`;
    header.insertAdjacentElement('afterend', toolbar);

    const live = document.createElement('div');
    live.className = 'ag-sr-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    document.body.appendChild(live);
    new MutationObserver(debounce(() => {
      const title = $('#results-count-title');
      if (title && !/loading/i.test(title.textContent)) live.textContent = title.textContent;
    }, 150)).observe($('#results-count-title') || document.body, { childList: true, characterData: true, subtree: true });

    on($('.ag-sort-select', toolbar), 'change', (e) => sortDirectory(e.target.value));
    $$('.ag-view-btn', toolbar).forEach(btn => on(btn, 'click', () => {
      $$('.ag-view-btn', toolbar).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      grid.classList.toggle('ag-list-view', btn.dataset.view === 'list');
      store.set('agrilink_view_mode', btn.dataset.view);
    }));
    const savedView = store.get('agrilink_view_mode', 'grid');
    if (savedView === 'list') {
      grid.classList.add('ag-list-view');
      $$('.ag-view-btn', toolbar).forEach(b => b.classList.toggle('active', b.dataset.view === 'list'));
    }

    refreshChips();
    new MutationObserver(debounce(refreshChips, 80)).observe(grid, { childList: true });
  }

  function refreshChips() {
    const row = $('.ag-chip-row');
    const grid = $('#directory-grid');
    if (!row || !grid) return;
    const crops = Array.from(new Set($$('.card-crop-name', grid).map(n => n.textContent.trim()))).slice(0, 8);
    if (!crops.length) { row.innerHTML = ''; return; }
    const active = row.dataset.active || '';
    row.innerHTML = `<button type="button" class="ag-chip ${!active ? 'active' : ''}" data-crop="">All</button>` +
      crops.map(c => `<button type="button" class="ag-chip ${active === c ? 'active' : ''}" data-crop="${c}">${c}</button>`).join('');
    $$('.ag-chip', row).forEach(chip => on(chip, 'click', () => {
      row.dataset.active = chip.dataset.crop;
      $$('.ag-chip', row).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyChipFilter(chip.dataset.crop);
    }));
  }

  function applyChipFilter(crop) {
    const grid = $('#directory-grid');
    if (!grid) return;
    $$('.directory-card', grid).forEach(card => {
      const cardCrop = card.querySelector('.card-crop-name')?.textContent.trim();
      card.style.display = (!crop || cardCrop === crop) ? '' : 'none';
    });
  }

  function sortDirectory(mode) {
    const grid = $('#directory-grid');
    if (!grid) return;
    const cards = $$('.directory-card', grid);
    const parsePrice = (card) => {
      const t = card.querySelector('.crop-price-badge')?.textContent || '';
      const m = t.replace(/,/g, '').match(/[\d.]+/);
      return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
    };
    const parseRating = (card) => {
      const t = card.querySelector('.farmer-rating')?.textContent || '';
      const m = t.match(/[\d.]+/);
      return m ? parseFloat(m[0]) : 0;
    };
    let sorted = cards.slice();
    if (mode === 'price-asc') sorted.sort((a, b) => parsePrice(a) - parsePrice(b));
    else if (mode === 'price-desc') sorted.sort((a, b) => parsePrice(b) - parsePrice(a));
    else if (mode === 'rating-desc') sorted.sort((a, b) => parseRating(b) - parseRating(a));
    else return; // 'default' = leave DOM order as app.js rendered it
    sorted.forEach(card => grid.appendChild(card));
  }

  /* =======================================================================
     12. Search autocomplete for the crop search input
     ======================================================================= */
  function initSearchAutocomplete() {
    const input = $('#search-crop');
    if (!input || $('.ag-autocomplete')) return;
    const crops = ['Turmeric', 'Onion', 'Paddy', 'Rice', 'Banana', 'Mango', 'Coconut', 'Sugarcane', 'Cotton', 'Groundnut', 'Tomato', 'Chilli', 'Maize', 'Tapioca', 'Ginger', 'Okra (Ladies Finger)', 'Brinjal', 'Drumstick'];
    const box = document.createElement('div');
    box.className = 'ag-autocomplete';
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(box);

    function render(val) {
      const v = val.trim().toLowerCase();
      if (!v) { box.classList.remove('open'); box.innerHTML = ''; return; }
      const matches = crops.filter(c => c.toLowerCase().includes(v)).slice(0, 6);
      if (!matches.length) { box.classList.remove('open'); box.innerHTML = ''; return; }
      box.innerHTML = matches.map(m => `<button type="button" class="ag-autocomplete-item">${m}</button>`).join('');
      box.classList.add('open');
      $$('.ag-autocomplete-item', box).forEach(btn => on(btn, 'click', () => {
        input.value = btn.textContent;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        box.classList.remove('open');
        box.innerHTML = '';
      }));
    }
    on(input, 'input', debounce((e) => render(e.target.value), 120));
    on(document, 'click', (e) => { if (!box.contains(e.target) && e.target !== input) { box.classList.remove('open'); } });
  }

  /* =======================================================================
     13. Skeleton loading placeholders while the initial listing set loads
     ======================================================================= */
  function initSkeletonLoader() {
    const grid = $('#directory-grid');
    const title = $('#results-count-title');
    if (!grid || !title) return;
    if (/loading/i.test(title.textContent) && !grid.children.length) {
      grid.classList.add('ag-skeleton-active');
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 6; i++) {
        const s = document.createElement('div');
        s.className = 'ag-skeleton-card';
        s.innerHTML = `<div class="ag-skeleton-img shimmer"></div><div class="ag-skeleton-line shimmer" style="width:70%"></div><div class="ag-skeleton-line shimmer" style="width:45%"></div><div class="ag-skeleton-line shimmer" style="width:90%"></div>`;
        frag.appendChild(s);
      }
      grid.appendChild(frag);
    }
    new MutationObserver((muts, obs) => {
      if (!/loading/i.test(title.textContent)) {
        grid.classList.remove('ag-skeleton-active');
        obs.disconnect();
      }
    }).observe(title, { childList: true, characterData: true, subtree: true });
  }

  /* =======================================================================
     14. Image lightbox
     ======================================================================= */
  function openLightbox(src, caption) {
    let box = $('.ag-lightbox');
    if (!box) {
      box = document.createElement('div');
      box.className = 'ag-lightbox';
      box.innerHTML = `<button type="button" class="ag-lightbox-close" aria-label="Close">&times;</button><img alt=""><p class="ag-lightbox-caption"></p>`;
      document.body.appendChild(box);
      on(box, 'click', (e) => { if (e.target === box) closeLightbox(); });
      on(box.querySelector('.ag-lightbox-close'), 'click', closeLightbox);
      on(document, 'keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('open')) closeLightbox(); });
    }
    box.querySelector('img').src = src;
    box.querySelector('.ag-lightbox-caption').textContent = caption || '';
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    const box = $('.ag-lightbox');
    if (!box) return;
    box.classList.remove('open');
    document.body.style.overflow = '';
  }
  function initLightbox() { /* handlers wired lazily in decorateDirectoryCards + modal avatar */
    const modalAvatar = $('#modal-farmer-avatar');
    if (modalAvatar && !modalAvatar.dataset.agLightbox) {
      modalAvatar.dataset.agLightbox = '1';
      modalAvatar.style.cursor = 'zoom-in';
      on(modalAvatar, 'click', () => openLightbox(modalAvatar.src, $('#modal-farmer-name')?.textContent));
    }
  }

  /* =======================================================================
     15. (lazy-fade) handled inline inside decorateDirectoryCards
     16-18-26. Contact modal extras: copy phone, QR code, native share, print
     19. Review modal + star rating
     ======================================================================= */
  const REVIEWS_KEY = 'agrilink_reviews';
  function initModalExtras() {
    const modal = $('#contact-modal');
    if (!modal) return;
    initLightbox();
    if ($('.ag-modal-extra-actions')) { attachModalObserver(modal); return; }

    const actionsRow = $('.modal-actions', modal);
    if (!actionsRow) return;
    const extra = document.createElement('div');
    extra.className = 'ag-modal-extra-actions';
    extra.innerHTML = `
      <button type="button" class="ag-icon-btn" data-ag-action="copy" title="Copy phone number">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg> Copy Number
      </button>
      <button type="button" class="ag-icon-btn" data-ag-action="share" title="Share this listing">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg> Share
      </button>
      <button type="button" class="ag-icon-btn" data-ag-action="print" title="Print details">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/></svg> Print
      </button>
      <button type="button" class="ag-icon-btn" data-ag-action="review" title="Leave a review">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17.3 6.2 21l1.5-6.6L2.5 9.8l6.7-.6L12 3l2.8 6.2 6.7.6-5.2 4.6L18 21z"/></svg> Review
      </button>
      <div class="ag-qr-box">
        <img class="ag-qr-img" alt="QR code to contact this farmer" width="96" height="96">
        <span>Scan to save contact</span>
      </div>`;
    actionsRow.insertAdjacentElement('afterend', extra);

    on(extra.querySelector('[data-ag-action="copy"]'), 'click', () => {
      const tel = $('#modal-call-btn')?.getAttribute('href')?.replace('tel:', '') || '';
      if (!tel) return;
      navigator.clipboard?.writeText(tel).then(() => agToast('Phone number copied to clipboard', 'success'))
        .catch(() => agToast('Could not copy — please copy manually', 'error'));
    });
    on(extra.querySelector('[data-ag-action="share"]'), 'click', async () => {
      const name = $('#modal-farmer-name')?.textContent || 'AgriLink Farmer';
      const crop = $('#modal-crop-name')?.textContent || '';
      const shareData = { title: `${name} — ${crop} | AgriLink`, text: `Check out ${name}'s ${crop} listing on AgriLink Marketplace.`, url: window.location.href };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) { /* user cancelled */ }
      } else {
        try { await navigator.clipboard.writeText(shareData.url); agToast('Link copied to clipboard', 'success'); }
        catch (e) { agToast('Sharing not supported on this browser', 'error'); }
      }
    });
    on(extra.querySelector('[data-ag-action="print"]'), 'click', () => {
      document.body.classList.add('ag-print-modal-only');
      window.print();
      const cleanup = () => { document.body.classList.remove('ag-print-modal-only'); window.removeEventListener('afterprint', cleanup); };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 4000);
    });
    on(extra.querySelector('[data-ag-action="review"]'), 'click', () => openReviewModal());

    attachModalObserver(modal);
  }

  function attachModalObserver(modal) {
    if (modal.dataset.agObserverAttached) return;
    modal.dataset.agObserverAttached = '1';
    new MutationObserver(() => {
      if (!modal.classList.contains('active')) return;
      const tel = $('#modal-call-btn')?.getAttribute('href')?.replace('tel:', '') || '';
      const qr = $('.ag-qr-img');
      if (qr && tel) {
        const data = encodeURIComponent(`tel:${tel}`);
        qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${data}`;
      }
      initLightbox();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function openReviewModal() {
    const farmerName = $('#modal-farmer-name')?.textContent || 'this farmer';
    let modal = $('.ag-review-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'ag-modal-overlay ag-review-modal';
      document.body.appendChild(modal);
      on(modal, 'click', (e) => { if (e.target === modal) closeReviewModal(); });
    }
    modal.innerHTML = `
      <div class="ag-modal-box" role="dialog" aria-modal="true" aria-label="Leave a review for ${farmerName}">
        <button type="button" class="modal-close ag-review-close" aria-label="Close">&times;</button>
        <h3>Rate your experience with ${farmerName}</h3>
        <div class="ag-star-input" role="radiogroup" aria-label="Star rating">
          ${[1,2,3,4,5].map(i => `<button type="button" class="ag-star" data-val="${i}" aria-label="${i} star${i>1?'s':''}">★</button>`).join('')}
        </div>
        <textarea class="ag-review-text" rows="3" maxlength="240" placeholder="Optional: share a few words about the deal..."></textarea>
        <div class="ag-char-counter"><span class="ag-char-count">0</span>/240</div>
        <button type="button" class="btn btn-primary ag-review-submit" style="width:100%;" disabled>Submit Review</button>
      </div>`;
    let rating = 0;
    const stars = $$('.ag-star', modal);
    stars.forEach(star => {
      on(star, 'click', () => {
        rating = Number(star.dataset.val);
        stars.forEach(s => s.classList.toggle('filled', Number(s.dataset.val) <= rating));
        $('.ag-review-submit', modal).disabled = false;
      });
      on(star, 'mouseenter', () => stars.forEach(s => s.classList.toggle('hover', Number(s.dataset.val) <= Number(star.dataset.val))));
      on(star, 'mouseleave', () => stars.forEach(s => s.classList.remove('hover')));
    });
    const textarea = $('.ag-review-text', modal);
    const counter = $('.ag-char-count', modal);
    on(textarea, 'input', () => {
      counter.textContent = String(textarea.value.length);
      counter.parentElement.classList.toggle('ag-char-warn', textarea.value.length > 200);
    });
    on(modal.querySelector('.ag-review-close'), 'click', closeReviewModal);
    on(modal.querySelector('.ag-review-submit'), 'click', () => {
      const reviews = store.get(REVIEWS_KEY, []);
      reviews.push({ farmer: farmerName, rating, text: textarea.value.trim(), date: Date.now() });
      store.set(REVIEWS_KEY, reviews);
      closeReviewModal();
      agToast('Thanks! Your review was submitted successfully.', 'success');
      burstConfetti();
    });
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeReviewModal() {
    const modal = $('.ag-review-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* =======================================================================
     20. Notification bell with badge + dropdown
     ======================================================================= */
  function initNotificationBell() {
    const headerToggle = $('#theme-toggle');
    if (!headerToggle || $('.ag-notif-bell')) return;
    const bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'ag-notif-bell';
    bell.setAttribute('aria-label', 'Notifications');
    bell.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="ag-notif-dot"></span>`;
    // Anchor next to the hamburger button (always visible) rather than the
    // theme toggle, which gets `display: none` on mobile — inserting before
    // a hidden sibling still worked, but this keeps the bell's flex position
    // predictable and consistent across every breakpoint.
    const mobileToggle = $('.mobile-nav-toggle');
    if (mobileToggle && mobileToggle.parentElement === headerToggle.parentElement) {
      mobileToggle.parentElement.insertBefore(bell, mobileToggle);
    } else {
      headerToggle.parentElement.insertBefore(bell, headerToggle);
    }

    const panel = document.createElement('div');
    panel.className = 'ag-notif-panel';
    const notifs = [
      { title: 'New turmeric stock added', body: 'A verified Salem farmer listed 800kg of turmeric.', time: '2h ago' },
      { title: 'Price alert', body: 'Onion prices in Erode dropped 8% this week.', time: '1d ago' },
      { title: 'Pilot update', body: '12 new FPO cooperatives joined this month.', time: '3d ago' }
    ];
    panel.innerHTML = `<div class="ag-notif-head">Notifications</div>` +
      notifs.map(n => `<div class="ag-notif-item"><strong>${n.title}</strong><p>${n.body}</p><span>${n.time}</span></div>`).join('') +
      `<div class="ag-notif-foot">You're all caught up</div>`;
    document.body.appendChild(panel);

    let open = false;
    function positionPanel() {
      const margin = 12;
      const r = bell.getBoundingClientRect();
      // Measure the panel itself (it's laid out even while opacity:0, since
      // it's only hidden via opacity/pointer-events, not display:none).
      const panelWidth = panel.offsetWidth || Math.min(320, window.innerWidth * 0.9);
      // Anchor to the bell's right edge, then clamp so the panel never runs
      // off either side of the viewport — previously this only set `right`
      // relative to the bell, which could push the panel's left edge
      // off-screen on narrow phones where the bell isn't flush with the
      // true right edge of the viewport (the hamburger button sits there).
      let left = r.right - panelWidth;
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
      panel.style.left = left + 'px';
      panel.style.right = 'auto';
      panel.style.top = (r.bottom + 8 + window.scrollY) + 'px';
    }
    on(bell, 'click', (e) => {
      e.stopPropagation();
      open = !open;
      if (open) { positionPanel(); }
      panel.classList.toggle('open', open);
      bell.classList.remove('has-unread');
      store.set('agrilink_notifs_seen', true);
    });
    on(document, 'click', (e) => { if (open && !panel.contains(e.target) && e.target !== bell) { open = false; panel.classList.remove('open'); } });
    on(window, 'resize', () => open && positionPanel());
    if (!store.get('agrilink_notifs_seen', false)) bell.classList.add('has-unread');
  }

  /* =======================================================================
     21. Cookie consent banner
     ======================================================================= */
  function initCookieConsent() {
    if (store.get('agrilink_cookie_choice', null)) return;
    if ($('.ag-cookie-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'ag-cookie-banner';
    banner.innerHTML = `
      <p>We use minimal local storage (no third-party tracking) to remember your preferences like dark mode and saved favorites.</p>
      <div class="ag-cookie-actions">
        <button type="button" class="btn btn-secondary" data-choice="decline">Decline non-essential</button>
        <button type="button" class="btn btn-primary" data-choice="accept">Accept</button>
      </div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));
    $$('[data-choice]', banner).forEach(btn => on(btn, 'click', () => {
      store.set('agrilink_cookie_choice', btn.dataset.choice);
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 400);
    }));
  }

  /* =======================================================================
     22. Online / offline connection status banner
     ======================================================================= */
  function initConnectionStatus() {
    const banner = document.createElement('div');
    banner.className = 'ag-connection-banner';
    document.body.appendChild(banner);
    function update() {
      if (navigator.onLine) {
        if (banner.classList.contains('offline-shown')) {
          banner.textContent = 'Back online';
          banner.classList.remove('offline'); banner.classList.add('online-flash', 'visible');
          setTimeout(() => banner.classList.remove('visible', 'online-flash'), 2200);
        }
        banner.classList.remove('offline-shown');
      } else {
        banner.textContent = 'You are offline — some actions may not work until you reconnect.';
        banner.classList.add('offline', 'visible', 'offline-shown');
      }
    }
    on(window, 'online', update);
    on(window, 'offline', update);
  }

  /* =======================================================================
     23. Idle / session timeout warning modal
     ======================================================================= */
  function initIdleTimeout() {
    const IDLE_MS = 12 * 60 * 1000; // 12 minutes
    let timer;
    function isSignedIn() {
      try { return !!(localStorage.getItem('sb-farmer-session') || localStorage.getItem('sb-buyer-session') || sessionStorage.getItem('agrilink_signed_in')); }
      catch (e) { return false; }
    }
    function showWarning() {
      if (!isSignedIn() && !document.querySelector('.ag-idle-force-demo')) return; // only relevant when signed in
      if ($('.ag-idle-modal')) return;
      const modal = document.createElement('div');
      modal.className = 'ag-modal-overlay ag-idle-modal active';
      modal.innerHTML = `
        <div class="ag-modal-box">
          <h3>Still there?</h3>
          <p>You've been inactive for a while. For your security we'll pause your session soon.</p>
          <div class="ag-confirm-actions">
            <button type="button" class="btn btn-primary" data-ag="stay">I'm still here</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      on(modal.querySelector('[data-ag="stay"]'), 'click', () => { modal.remove(); resetTimer(); });
    }
    function resetTimer() { clearTimeout(timer); timer = setTimeout(showWarning, IDLE_MS); }
    ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(ev => on(document, ev, debounce(resetTimer, 500), { passive: true }));
    resetTimer();
  }

  /* =======================================================================
     24-25. Keyboard shortcuts + focus trap + shortcuts help modal
     ======================================================================= */
  function getOpenOverlay() {
    return $$('.modal-overlay.active, .ag-modal-overlay.active').find(Boolean);
  }
  function initFocusTrap() {
    on(document, 'keydown', (e) => {
      if (e.key !== 'Tab') return;
      const overlay = getOpenOverlay();
      if (!overlay) return;
      const focusables = $$('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])', overlay)
        .filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function initShortcutsHelp() {
    if ($('.ag-shortcuts-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'ag-modal-overlay ag-shortcuts-modal';
    modal.innerHTML = `
      <div class="ag-modal-box">
        <button type="button" class="modal-close ag-shortcuts-close" aria-label="Close">&times;</button>
        <h3>Keyboard Shortcuts</h3>
        <ul class="ag-shortcuts-list">
          <li><kbd>/</kbd> Focus the crop search box</li>
          <li><kbd>Esc</kbd> Close any open modal or drawer</li>
          <li><kbd>?</kbd> Show this shortcuts panel</li>
        </ul>
      </div>`;
    document.body.appendChild(modal);
    on(modal, 'click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    on(modal.querySelector('.ag-shortcuts-close'), 'click', () => modal.classList.remove('active'));
  }

  function initKeyboardShortcuts() {
    initShortcutsHelp();
    on(document, 'keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        const input = $('#search-crop');
        if (input) { input.focus(); input.select(); }
      } else if (e.key === '?' && !typing) {
        e.preventDefault();
        $('.ag-shortcuts-modal')?.classList.add('active');
      } else if (e.key === 'Escape') {
        closeLightbox();
        closeCompareModal();
        closeReviewModal();
        $('.ag-shortcuts-modal')?.classList.remove('active');
        $('.ag-fav-drawer')?.classList.remove('open');
        $('.ag-idle-modal')?.remove();
      }
    });
  }

  /* =======================================================================
     27. handled in decorateDirectoryCards ("posted x ago")
     28. Seasonal produce calendar (new homepage widget)
     ======================================================================= */
  function initSeasonalCalendar() {
    const anchor = document.querySelector('#page-home .cta-banner');
    if (!anchor || $('.ag-seasonal-section')) return;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const inSeason = {
      Jan: ['Carrot','Cauliflower'], Feb: ['Onion','Groundnut'], Mar: ['Mango (early)','Watermelon'],
      Apr: ['Mango','Turmeric'], May: ['Mango','Cotton'], Jun: ['Paddy (sowing)','Sugarcane'],
      Jul: ['Paddy','Chilli'], Aug: ['Paddy','Maize'], Sep: ['Banana','Tapioca'],
      Oct: ['Paddy (harvest)','Groundnut'], Nov: ['Turmeric (harvest)','Brinjal'], Dec: ['Onion','Tomato']
    };
    const now = new Date().getMonth();
    const section = document.createElement('div');
    section.className = 'section-padding ag-seasonal-section';
    section.innerHTML = `
      <div class="container">
        <h2 class="glow-heading" style="text-align:center;margin-bottom:0.5rem;">Seasonal Produce Calendar</h2>
        <p style="text-align:center;color:var(--text-muted);max-width:640px;margin:0 auto 2rem;">A quick guide to what's typically in season across Tamil Nadu, month by month.</p>
        <div class="ag-calendar-grid">
          ${months.map((m, i) => `
            <div class="ag-calendar-cell ${i === now ? 'current' : ''}">
              <span class="ag-calendar-month">${m}</span>
              <span class="ag-calendar-crops">${(inSeason[m] || []).join(', ')}</span>
            </div>`).join('')}
        </div>
      </div>`;
    anchor.parentElement.insertBefore(section, anchor);
  }

  /* =======================================================================
     29. Rotating "Did you know" tips banner
     ======================================================================= */
  function initTipsBanner() {
    const anchor = document.querySelector('#page-home .pilot-section');
    if (!anchor || $('.ag-tips-banner')) return;
    const tips = [
      'Farmers keep 100% of the negotiated price on AgriLink — there are no commissions or broker fees.',
      'Verified listings display an ID & land-record checkmark, so buyers can source with confidence.',
      'FPO cooperatives can list combined inventory under a single group profile for better bargaining power.',
      'You can contact any farmer directly by phone or WhatsApp — no middleman required.',
      'Prices update as farmers refresh their stock, so check back for the latest availability.'
    ];
    const banner = document.createElement('div');
    banner.className = 'ag-tips-banner';
    banner.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg><span class="ag-tips-text"></span>`;
    anchor.parentElement.insertBefore(banner, anchor);
    const textEl = banner.querySelector('.ag-tips-text');
    let idx = 0;
    function show(i) {
      textEl.style.opacity = '0';
      setTimeout(() => { textEl.textContent = tips[i]; textEl.style.opacity = '1'; }, prefersReducedMotion() ? 0 : 260);
    }
    show(idx);
    if (!prefersReducedMotion()) setInterval(() => { idx = (idx + 1) % tips.length; show(idx); }, 6000);
  }

  /* =======================================================================
     30-31. Confetti burst — auto-triggers on success toasts app.js shows
     ======================================================================= */
  function burstConfetti() {
    if (prefersReducedMotion()) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'ag-confetti-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const colors = ['#2e7d32', '#66bb6a', '#ff9142', '#ffd54f', '#42a5f5'];
    const pieces = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.3,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 3,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4
    }));
    let frame = 0;
    function loop() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (frame < 130) requestAnimationFrame(loop);
      else canvas.remove();
    }
    requestAnimationFrame(loop);
  }
  function initConfetti() {
    const container = $('#toast-container');
    if (!container) return;
    new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList.contains('success')) {
            const text = node.textContent.toLowerCase();
            if (/success|created|posted|listed|updated|registered|welcome/.test(text)) burstConfetti();
          }
        });
      });
    }).observe(container, { childList: true });
  }

  /* =======================================================================
     32-35. Form enhancements: char counters, shake validation, password
     strength meter, autosave draft, quantity steppers
     ======================================================================= */
  function initFormEnhancements() {
    // Character counters for any textarea missing one
    $$('textarea').forEach(ta => {
      if (ta.dataset.agCounter || ta.closest('.ag-review-modal')) return;
      ta.dataset.agCounter = '1';
      const max = ta.getAttribute('maxlength');
      const wrap = document.createElement('div');
      wrap.className = 'ag-char-counter';
      wrap.innerHTML = `<span class="ag-char-count">${ta.value.length}</span>${max ? '/' + max : ' characters'}`;
      ta.insertAdjacentElement('afterend', wrap);
      on(ta, 'input', () => {
        wrap.querySelector('.ag-char-count').textContent = String(ta.value.length);
        if (max) wrap.classList.toggle('ag-char-warn', ta.value.length > max * 0.85);
      });
    });

    // Shake animation on invalid required fields at submit time
    $$('form').forEach(form => {
      on(form, 'submit', () => {
        $$('input[required], select[required], textarea[required]', form).forEach(field => {
          if (!field.checkValidity()) {
            field.classList.add('ag-shake');
            setTimeout(() => field.classList.remove('ag-shake'), 420);
          }
        });
      }, true);
    });

    // Password strength meter
    $$('input[type="password"]').forEach(input => {
      if (input.dataset.agStrength) return;
      const name = (input.id || '').toLowerCase();
      if (name.includes('confirm')) return; // only score the primary password field
      input.dataset.agStrength = '1';
      const meter = document.createElement('div');
      meter.className = 'ag-strength-meter';
      meter.innerHTML = `<div class="ag-strength-bar"><span></span></div><small class="ag-strength-label"></small>`;
      input.insertAdjacentElement('afterend', meter);
      const bar = meter.querySelector('span');
      const label = meter.querySelector('.ag-strength-label');
      on(input, 'input', () => {
        const val = input.value;
        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        const levels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
        const pct = [0, 20, 40, 60, 80, 100][score];
        bar.style.width = pct + '%';
        bar.className = '';
        bar.dataset.level = score;
        label.textContent = val ? levels[score] : '';
      });
    });

    // Autosave draft for the farmer listing form
    const listingForm = $('#farmer-listing-form');
    if (listingForm && !listingForm.dataset.agAutosave) {
      listingForm.dataset.agAutosave = '1';
      const DRAFT_KEY = 'agrilink_listing_draft';
      const fields = $$('input, textarea, select', listingForm);
      const draft = store.get(DRAFT_KEY, null);
      if (draft) {
        let hasBanner = false;
        fields.forEach(f => { if (f.name && draft[f.name] !== undefined) { f.value = draft[f.name]; hasBanner = true; } });
        if (hasBanner) {
          const banner = document.createElement('div');
          banner.className = 'ag-draft-banner';
          banner.innerHTML = `<span>We restored your last unsaved draft.</span><button type="button">Clear draft</button>`;
          listingForm.prepend(banner);
          on(banner.querySelector('button'), 'click', () => {
            store.set(DRAFT_KEY, null);
            fields.forEach(f => f.value = '');
            banner.remove();
          });
        }
      }
      on(listingForm, 'input', debounce(() => {
        const data = {};
        fields.forEach(f => { if (f.name) data[f.name] = f.value; });
        store.set(DRAFT_KEY, data);
      }, 500));
      on(listingForm, 'submit', () => store.set(DRAFT_KEY, null));
    }

    // Quantity +/- steppers for numeric quantity-ish inputs
    $$('input[type="number"]').forEach(input => {
      if (input.dataset.agStepper) return;
      input.dataset.agStepper = '1';
      const wrap = document.createElement('div');
      wrap.className = 'ag-stepper';
      input.parentElement.insertBefore(wrap, input);
      wrap.appendChild(input);
      const minus = document.createElement('button');
      minus.type = 'button'; minus.className = 'ag-stepper-btn'; minus.textContent = '−';
      const plus = document.createElement('button');
      plus.type = 'button'; plus.className = 'ag-stepper-btn'; plus.textContent = '+';
      wrap.insertBefore(minus, input);
      wrap.appendChild(plus);
      const step = Number(input.step) || 1;
      on(minus, 'click', () => { input.stepDown ? input.stepDown() : (input.value = (Number(input.value) || 0) - step); input.dispatchEvent(new Event('input', { bubbles: true })); });
      on(plus, 'click', () => { input.stepUp ? input.stepUp() : (input.value = (Number(input.value) || 0) + step); input.dispatchEvent(new Event('input', { bubbles: true })); });
    });
  }

  /* =======================================================================
     36. Custom confirm modal demo hook: "Clear filters" & "Clear favorites"
     37. Undo toast already implemented via agUndoToast (used by favorites)
     ======================================================================= */
  function initConfirmDelete() {
    // Wires our accessible confirm() to a couple of real, safe actions.
    const clearFavBtn = $('.ag-drawer-head');
    if (clearFavBtn && !clearFavBtn.dataset.agClearWired) {
      clearFavBtn.dataset.agClearWired = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ag-drawer-clear-all';
      btn.textContent = 'Clear all';
      clearFavBtn.insertBefore(btn, clearFavBtn.lastElementChild);
      on(btn, 'click', async () => {
        if (!store.get(FAV_KEY, []).length) return;
        const ok = await agConfirm('This will remove all saved favorites from this device.', { title: 'Clear all favorites?', okText: 'Clear all' });
        if (ok) {
          store.set(FAV_KEY, []);
          renderFavoritesDrawer();
          updateFavCountBadge();
          $$('.ag-fav-btn.active').forEach(h => h.classList.remove('active'));
          agToast('All favorites cleared', 'success');
        }
      });
    }
  }

  /* =======================================================================
     39. Mobile tab bar tap bounce
     ======================================================================= */
  function initTabBarBounce() {
    $$('.tabbar-link, .mobile-tab-bar a, [class*="tabbar"] a').forEach(link => {
      if (link.dataset.agBounce) return;
      link.dataset.agBounce = '1';
      on(link, 'click', () => {
        link.classList.add('ag-tap-bounce');
        setTimeout(() => link.classList.remove('ag-tap-bounce'), 320);
      });
    });
  }

  /* =======================================================================
     40. FAQ accordion (new homepage section)
     ======================================================================= */
  function initFAQSection() {
    const anchor = document.querySelector('#page-home .cta-banner');
    if (!anchor || $('.ag-faq-section')) return;
    const faqs = [
      ['Is AgriLink free to use?', 'Yes. Listing and browsing produce is completely free — AgriLink never takes a commission on any deal.'],
      ['How are farmers verified?', 'Our team checks local land records or FPO registry data before marking a profile as "Verified Farmer".'],
      ['How do I contact a farmer?', 'Open any listing and use the Call or WhatsApp button to reach the farmer directly — no middleman involved.'],
      ['Which regions are covered in the pilot?', 'We are currently focused on Salem, Erode, Puducherry and nearby districts, expanding steadily.'],
      ['Can FPO cooperatives list together?', 'Yes, cooperatives can create a single group profile listing combined inventory from multiple farmers.']
    ];
    const section = document.createElement('div');
    section.className = 'section-padding ag-faq-section';
    section.innerHTML = `
      <div class="container" style="max-width:760px;">
        <h2 class="glow-heading" style="text-align:center;margin-bottom:2rem;">Frequently Asked Questions</h2>
        <div class="ag-faq-list">
          ${faqs.map((f, i) => `
            <div class="ag-faq-item">
              <button type="button" class="ag-faq-question" aria-expanded="false" aria-controls="ag-faq-a-${i}">
                <span>${f[0]}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ag-faq-chevron"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div class="ag-faq-answer" id="ag-faq-a-${i}"><p>${f[1]}</p></div>
            </div>`).join('')}
        </div>
      </div>`;
    anchor.parentElement.insertBefore(section, anchor);
    $$('.ag-faq-question', section).forEach(q => on(q, 'click', () => {
      const item = q.closest('.ag-faq-item');
      const answer = item.querySelector('.ag-faq-answer');
      const open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(open));
      answer.style.maxHeight = open ? answer.scrollHeight + 'px' : '0px';
    }));
  }

  /* =======================================================================
     41. Testimonials carousel (new homepage section)
     ======================================================================= */
  function initTestimonials() {
    const anchor = document.querySelector('#page-home .cta-banner');
    if (!anchor || $('.ag-testimonial-section')) return;
    const items = [
      { quote: 'AgriLink helped me sell turmeric directly to a Chennai buyer at a much better price than the local mandi.', name: 'Selvam R., Turmeric Farmer, Salem' },
      { quote: 'We source paddy for our mill straight from verified FPOs now — sourcing is transparent and traceable.', name: 'Divya K., Bulk Buyer, Erode' },
      { quote: 'No broker fees, no waiting. I list my stock and get calls from buyers the same day.', name: 'Muthu P., Vegetable Farmer, Dharmapuri' }
    ];
    const section = document.createElement('div');
    section.className = 'section-padding ag-testimonial-section';
    section.innerHTML = `
      <div class="container" style="max-width:760px; text-align:center;">
        <h2 class="glow-heading" style="margin-bottom:2rem;">What Our Community Says</h2>
        <div class="ag-testimonial-track">
          ${items.map(t => `<div class="ag-testimonial-slide"><p>&ldquo;${t.quote}&rdquo;</p><span>${t.name}</span></div>`).join('')}
        </div>
        <div class="ag-testimonial-dots"></div>
      </div>`;
    anchor.parentElement.insertBefore(section, anchor);
    const track = section.querySelector('.ag-testimonial-track');
    const dotsWrap = section.querySelector('.ag-testimonial-dots');
    items.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ag-testimonial-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
      dotsWrap.appendChild(dot);
      on(dot, 'click', () => goTo(i));
    });
    let idx = 0;
    function goTo(i) {
      idx = (i + items.length) % items.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      $$('.ag-testimonial-dot', dotsWrap).forEach((d, di) => d.classList.toggle('active', di === idx));
    }
    let auto = !prefersReducedMotion() ? setInterval(() => goTo(idx + 1), 5500) : null;
    let startX = null;
    on(track, 'pointerdown', (e) => { startX = e.clientX; clearInterval(auto); });
    on(track, 'pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      if (dx > 40) goTo(idx - 1); else if (dx < -40) goTo(idx + 1);
      startX = null;
      if (!prefersReducedMotion()) auto = setInterval(() => goTo(idx + 1), 5500);
    });
  }

  /* =======================================================================
     42. Friendly 404 view for unmatched hash routes
     ======================================================================= */
  function init404() {
    function check() {
      const known = $$('.page-view').map(p => p.id);
      const hash = window.location.hash.slice(1) || '/';
      // app.js already resolves most routes; we only step in when nothing on
      // the page is visibly active (best-effort, non-invasive check).
      requestAnimationFrame(() => {
        const anyVisible = $$('.page-view').some(p => getComputedStyle(p).display !== 'none' && p.offsetParent !== null);
        let notFound = $('.ag-404-view');
        if (!anyVisible && known.length) {
          if (!notFound) {
            notFound = document.createElement('section');
            notFound.className = 'page-view ag-404-view';
            notFound.innerHTML = `
              <div class="container section-padding" style="text-align:center;">
                <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" style="margin:0 auto 1rem;"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8 16s1.5-2 4-2 4 2 4 2" stroke-linecap="round"/></svg>
                <h2>Page not found</h2>
                <p style="color:var(--text-muted);">That page doesn't exist. Let's get you back on track.</p>
                <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Return Home</a>
              </div>`;
            document.body.appendChild(notFound);
          }
          notFound.style.display = 'block';
        } else if (notFound) {
          notFound.style.display = 'none';
        }
      });
    }
    on(window, 'hashchange', check);
    check();
  }

  /* =======================================================================
     43. Scroll-hint bounce arrow on hero
     ======================================================================= */
  function initScrollHint() {
    const hero = $('#home-hero');
    if (!hero || $('.ag-scroll-hint')) return;
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'ag-scroll-hint';
    hint.setAttribute('aria-label', 'Scroll down');
    hint.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
    hero.appendChild(hint);
    on(hint, 'click', () => {
      const next = hero.nextElementSibling;
      (next || document.body).scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    on(window, 'scroll', debounce(() => { hint.style.opacity = window.scrollY > 80 ? '0' : ''; }, 30), { passive: true });
  }

  /* =======================================================================
     44. Manual reduced-motion override toggle (footer)
     ======================================================================= */
  function initReducedMotionToggle() {
    const footer = document.querySelector('footer');
    if (!footer || $('.ag-motion-toggle')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ag-motion-toggle';
    const saved = store.get('agrilink_force_motion', null);
    if (saved) document.documentElement.setAttribute('data-force-motion', '1');
    wrap.innerHTML = `<label><input type="checkbox" ${saved ? 'checked' : ''}> Enable extra animations (overrides system reduced-motion)</label>`;
    footer.appendChild(wrap);
    on(wrap.querySelector('input'), 'change', (e) => {
      if (e.target.checked) { document.documentElement.setAttribute('data-force-motion', '1'); store.set('agrilink_force_motion', true); }
      else { document.documentElement.removeAttribute('data-force-motion'); store.set('agrilink_force_motion', false); }
      agToast('Preference saved. Reload for full effect.', 'success');
    });
  }

  /* =======================================================================
     45. Floating quick-contact WhatsApp button (site-wide)
     ======================================================================= */
  function initFloatingWhatsApp() {
    if ($('.ag-float-whatsapp')) return;
    const btn = document.createElement('a');
    btn.href = 'https://wa.me/919876543210?text=' + encodeURIComponent('Hi AgriLink team, I have a question about the marketplace.');
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.className = 'ag-float-whatsapp';
    btn.setAttribute('aria-label', 'Chat with AgriLink on WhatsApp');
    btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z"/></svg>';
    document.body.appendChild(btn);
  }

  /* =======================================================================
     46. Generic async-button loading state wiring
     ======================================================================= */
  function initAsyncButtonStates() {
    $$('form').forEach(form => {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!submitBtn || submitBtn.dataset.agAsyncWired) return;
      submitBtn.dataset.agAsyncWired = '1';
      on(form, 'submit', () => {
        if (!form.checkValidity || form.checkValidity()) {
          submitBtn.classList.add('ag-btn-loading');
          setTimeout(() => submitBtn.classList.remove('ag-btn-loading'), 2500);
        }
      });
    });
  }

  /* =======================================================================
     48. Currency formatting is exposed for reuse (formatINR above)
     49. Copy directory link with current filters
     ======================================================================= */
  function initShareDirectoryLink() {
    const toolbar = $('.ag-directory-toolbar .ag-toolbar-controls');
    if (!toolbar || $('.ag-share-link-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ag-icon-btn ag-share-link-btn';
    btn.title = 'Copy link to this search';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1-1"/></svg>';
    toolbar.appendChild(btn);
    on(btn, 'click', () => {
      const crop = $('#search-crop')?.value || '';
      const loc = $('#filter-location')?.value || '';
      const url = new URL(window.location.href);
      url.searchParams.set('crop', crop);
      url.searchParams.set('loc', loc);
      navigator.clipboard?.writeText(url.toString()).then(() => agToast('Search link copied to clipboard', 'success'))
        .catch(() => agToast('Could not copy the link', 'error'));
    });
  }

  /* =======================================================================
     Init orchestration
     ======================================================================= */
  function safeRun(fn) { try { fn(); } catch (err) { console.warn('[features.js]', fn.name, err); } }

  function runAll() {
    safeRun(initSkipLink);
    safeRun(initBackToTop);
    safeRun(initScrollReveal);
    safeRun(initStatCounters);
    safeRun(initFavorites);
    safeRun(initRecentlyViewed);
    safeRun(initToolbar);
    safeRun(initSearchAutocomplete);
    safeRun(initSkeletonLoader);
    safeRun(initModalExtras);
    safeRun(initNotificationBell);
    safeRun(initCookieConsent);
    safeRun(initConnectionStatus);
    safeRun(initIdleTimeout);
    safeRun(initFocusTrap);
    safeRun(initKeyboardShortcuts);
    safeRun(initSeasonalCalendar);
    safeRun(initTipsBanner);
    safeRun(initConfetti);
    safeRun(initFormEnhancements);
    safeRun(initConfirmDelete);
    safeRun(initTabBarBounce);
    safeRun(initFAQSection);
    safeRun(initTestimonials);
    safeRun(init404);
    safeRun(initScrollHint);
    safeRun(initReducedMotionToggle);
    safeRun(initFloatingWhatsApp);
    safeRun(initAsyncButtonStates);
    safeRun(initShareDirectoryLink);
  }
   

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(runAll, 0));
  } else {
    setTimeout(runAll, 0);
  }

  // Re-run the lightweight, idempotent parts on every hash change since the
  // app is a client-rendered SPA that swaps page sections in place.
  window.addEventListener('hashchange', () => {
    setTimeout(() => {
      safeRun(initFavorites);
      safeRun(initRecentlyViewed);
      safeRun(initToolbar);
      safeRun(initSearchAutocomplete);
      safeRun(initSkeletonLoader);
      safeRun(initScrollReveal);
      safeRun(initStatCounters);
      safeRun(initFormEnhancements);
      safeRun(initTabBarBounce);
      safeRun(initScrollHint);
      safeRun(initAsyncButtonStates);
      safeRun(initShareDirectoryLink);
    }, 60);
  });
})();
