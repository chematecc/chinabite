/* Hero carousel (v6.2): 3 photos, auto-rotates every 4.5s with a fade.
   Dots + swipe switch slides; any interaction pauses auto-rotate for 12s.
   Auto-rotate is off when the tab is hidden or the user prefers reduced
   motion. No video, no sound. All 3 slides are plain <img> in the DOM so
   they preload — switching never flashes white. */
(function () {
  var root = document.getElementById('heroCarousel');
  if (!root) return;
  var slides = Array.prototype.slice.call(root.querySelectorAll('.hero-slide'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('[data-hero-dot]'));
  if (slides.length < 2 || dots.length !== slides.length) return;
  var i = 0, timer = null, resumeTimer = null;
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduceMotion = false; }
  function show(n, user) {
    slides[i].classList.remove('is-active');
    dots[i].classList.remove('is-active');
    dots[i].removeAttribute('aria-current');
    i = (n + slides.length) % slides.length;
    slides[i].classList.add('is-active');
    dots[i].classList.add('is-active');
    dots[i].setAttribute('aria-current', 'true');
    if (user) pauseAuto();
  }
  function startAuto() {
    if (reduceMotion) return;
    stopAuto();
    timer = setInterval(function () { show(i + 1); }, 4500);
  }
  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function pauseAuto() {
    stopAuto();
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(startAuto, 12000);
  }
  dots.forEach(function (d, idx) {
    d.addEventListener('click', function () { show(idx, true); });
  });
  var x0 = null;
  root.addEventListener('touchstart', function (e) {
    x0 = e.changedTouches[0].clientX;
  }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 30) show(i + (dx < 0 ? 1 : -1), true);
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopAuto(); else startAuto();
  });
  startAuto();
})();
