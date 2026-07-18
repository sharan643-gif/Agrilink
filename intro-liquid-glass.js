/* ==========================================================================
   AGRILINK — PAINT SWEEP INTRO (orchestration)
   Only fires once per browser session (sessionStorage flag) and is skipped
   entirely under prefers-reduced-motion — same contract as before.
   ========================================================================== */
(function () {
  var splash = document.getElementById('intro-liquid');
  if (!splash) return;

  var alreadyShown = sessionStorage.getItem('introPlayed');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (alreadyShown || reduceMotion) {
    splash.remove();
    return;
  }

  sessionStorage.setItem('introPlayed', 'true');
  document.documentElement.classList.add('intro-active');

  var hero = document.getElementById('home-hero');
  if (hero) hero.classList.add('cine-armed');
  var reveals = hero ? hero.querySelectorAll('.cine-reveal') : [];

  // ---- Timeline (mirrors the CSS keyframe delays in intro-liquid-glass.css —
  // retune both together if you change timing) ----
  window.setTimeout(function () { splash.classList.add('is-sweeping'); }, 0);
  window.setTimeout(function () { splash.classList.add('is-clearing'); }, 1800);
  window.setTimeout(function () { splash.classList.add('is-revealed'); }, 1850);
  window.setTimeout(function () { splash.classList.add('is-exiting'); }, 3800);
  window.setTimeout(function () {
    document.documentElement.classList.remove('intro-active');
    if (hero) hero.classList.add('wallpaper-in');
  }, 4550);
  window.setTimeout(function () {
    for (var i = 0; i < reveals.length; i++) {
      reveals[i].classList.add('in');
    }
  }, 5250);
  window.setTimeout(function () {
    splash.remove();
  }, 6600);
})();