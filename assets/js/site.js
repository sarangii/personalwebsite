(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- reading progress (posts only) ----------
  var post = document.querySelector('.post');
  if (post) {
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    var update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.transform = 'scaleX(' + p + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ---------- bottom-edge peek ----------
  var peek = document.getElementById('peek');
  if (!peek) return;

  var KEY = 'peek-dismissed';
  var store = {
    get: function () { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } },
    set: function () { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }
  };
  if (store.get()) return;

  // 16x15 pixel rabbit; k = outline/eyes, w = fur, p = pink
  var grid = [
    '....kk....kk....',
    '...kwwk..kwwk...',
    '...kwpk..kpwk...',
    '...kwpk..kpwk...',
    '...kwpk..kpwk...',
    '...kwwkkkkwwk...',
    '..kwwwwwwwwwwk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwkwwwwwwkwwk.',
    '.kwwkwwwwwwkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwppwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kwwwwwwwwwwk..',
    '...kkkkkkkkkk...'
  ];
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('peek-art');
  grid.forEach(function (row, y) {
    for (var x = 0; x < row.length; x++) {
      var c = row.charAt(x);
      if (c === '.') continue;
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x);
      r.setAttribute('y', y);
      r.setAttribute('width', 1);
      r.setAttribute('height', 1);
      r.setAttribute('class', c);
      svg.appendChild(r);
    }
  });

  var shown = false;
  var hideTimer = null;

  function show() {
    if (shown) return;
    shown = true;
    peek.removeAttribute('aria-hidden');
    peek.classList.add('up');
    peek.querySelector('.peek-link').removeAttribute('tabindex');
    hideTimer = setTimeout(hide, 14000);
  }

  function hide() {
    clearTimeout(hideTimer);
    peek.classList.remove('up');
    peek.setAttribute('aria-hidden', 'true');
    peek.querySelector('.peek-link').setAttribute('tabindex', '-1');
    store.set();
    window.removeEventListener('scroll', onScroll);
  }

  // Milestone 1: scrolled past ~55% of the page
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 200 && window.scrollY / max > 0.55) show();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Milestone 2: following an in-page link in the header
  document.querySelectorAll('.site-header nav a').forEach(function (a) {
    a.addEventListener('click', function () { setTimeout(show, reduceMotion ? 0 : 700); });
  });

  // Milestone 3: lingering on a page too short to scroll
  setTimeout(function () {
    if (document.documentElement.scrollHeight - window.innerHeight <= 200) show();
  }, 8000);

  peek.querySelector('.peek-close').addEventListener('click', hide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shown) hide(); });
})();
