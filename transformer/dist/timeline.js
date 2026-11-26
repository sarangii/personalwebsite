'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TOTAL_MONTHS = 12;
const MAX_STEP = TOTAL_MONTHS - 1;
const journey = $('#journey'), stage = $('#journey-stage'), area = $('#object-area'), canvas = $('#build-canvas'), ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let months = [], sources = {}, frames = [], month = 1, rawMonth = 1, targetMonth = 1, shownIndex = -1, wantedIndex = 0, raf = null, dirty = true, playing = false, previousMonth = 1, playStart = 0, playBase = 1;
let layout = {top: 0, travel: 1, width: 1, height: 1, dpr: 1, image: {x: 0, y: 0, size: 1}}, cache = new Map(), pending = new Set(), queue = [], workers = 0, currentSource = null, staticMode = reduced.matches;

function request() { if (raf === null) raf = requestAnimationFrame(tick); }
function layoutChanged() { dirty = true; request(); }

function measure() {
  const s = stage.getBoundingClientRect();
  if (innerWidth < 768) {
    const copyBottom = $('.month-copy').getBoundingClientRect().bottom - s.top;
    area.style.top = Math.min(Math.max(copyBottom + 12, stage.clientHeight * 0.44), stage.clientHeight - 210) + 'px';
    area.style.minHeight = '0';
  } else {
    area.style.top = '';
    area.style.minHeight = '';
  }
  const r = area.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), side = Math.min(r.width, r.height);
  layout = {
    top: journey.getBoundingClientRect().top + scrollY,
    travel: Math.max(1, journey.offsetHeight - stage.offsetHeight),
    width: r.width,
    height: r.height,
    dpr,
    image: {x: r.left - s.left + (r.width - side) / 2, y: r.top - s.top + (r.height - side) / 2, size: side}
  };
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    shownIndex = -1;
  }
  dirty = false;
}

function updateParallelStreams(number) {
  const activeMap = {
    design: number >= 1 && number <= 3,
    core: number >= 1 && number <= 7,
    windings: number >= 3 && number <= 7,
    tank: number >= 3 && number <= 10,
    fat: number >= 9 && number <= 12
  };
  $$('#stream-pills i').forEach(pill => {
    const key = pill.dataset.stream;
    pill.classList.toggle('active', Boolean(activeMap[key]));
  });
  const playhead = $('#lane-playhead'), playheadLabel = $('#lane-playhead-label'), lanesBody = $('#lanes-body');
  if (playhead && lanesBody) {
    const labelCol = innerWidth < 768 ? 125 : 210;
    const trackWidth = Math.max(1, lanesBody.clientWidth - labelCol);
    const pct = clamp((number - 1) / MAX_STEP, 0, 1);
    playhead.style.left = `${(pct * trackWidth).toFixed(1)}px`;
    if (playheadLabel) playheadLabel.textContent = `M${String(number).padStart(2, '0')}`;
  }
}

function renderMonth(number) {
  if (!months.length) return;
  number = clamp(number, 1, TOTAL_MONTHS);
  if (number === previousMonth && month === number && $('#month-body').dataset.ready) {
    updateParallelStreams(number);
    return;
  }
  month = number;
  previousMonth = number;
  dirty = true;
  const m = months[number - 1];
  $('#month-number').textContent = String(number).padStart(2, '0');
  $('#phase').textContent = m.phase;
  $('#month-title').textContent = m.title;
  $('#month-body').textContent = m.body;
  $('#month-body').dataset.ready = 'true';
  $('#component-name').textContent = m.added;
  $('#component-detail').textContent = m.detail;
  $('#parallel-copy').textContent = m.parallel;
  $('#build-poster').alt = `Illustrative transformer build, month ${number}: ${m.added}`;
  area.setAttribute('aria-label', `Illustrative transformer build, month ${number}: ${m.added}`);
  $('#month-range').value = number;
  $('#month-range').setAttribute('aria-valuetext', `Month ${number}: ${m.title}`);
  $$('[data-month]').forEach(b => {
    const n = Number(b.dataset.month), on = n === number;
    b.classList.toggle('current', on);
    b.classList.toggle('done', n < number);
    b.tabIndex = on ? 0 : -1;
    if (on) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
  $$('[data-inventory]').forEach(li => {
    const n = Number(li.dataset.inventory);
    li.classList.toggle('in-build', n <= number);
    li.classList.toggle('current-item', n === number);
  });
  updateParallelStreams(number);
  $('#previous').disabled = number === 1;
  $('#next').disabled = number === TOTAL_MONTHS;
  $('#jump-complete').textContent = number === TOTAL_MONTHS ? 'Back to the steel' : 'See the finished build';
  $('#render-caption').textContent = number === TOTAL_MONTHS ? 'Final assembly · Month 12' : number === 1 ? 'Scroll to follow the build' : 'Fixed camera · Stepped CRGO & concentric coil build';
}

function closest(value) {
  return clamp(Math.round(((value - 1) / MAX_STEP) * (frames.length - 1)), 0, frames.length - 1);
}

function planAssets(index) {
  const direction = index >= wantedIndex ? 1 : -1;
  wantedIndex = index;
  const indices = [
    index, index + direction, index - direction,
    index + 2 * direction, index - 2 * direction,
    index + 3 * direction, index - 3 * direction,
    index + 4 * direction, index + 5 * direction, index + 6 * direction
  ].filter(i => i >= 0 && i < frames.length);
  queue = [...new Set(indices.map(i => frames[i].src))].filter(src => !cache.has(src) && !pending.has(src));
  pump();
}

async function loadImage(src) {
  if ('createImageBitmap' in window) {
    const r = await fetch(src);
    if (!r.ok) throw Error('Image unavailable');
    return createImageBitmap(await r.blob());
  }
  const img = new Image();
  img.src = src;
  await img.decode();
  if (!img.naturalWidth) throw Error('Invalid image');
  return img;
}

function pump() {
  while (workers < 4 && queue.length) {
    const src = queue.shift();
    if (cache.has(src) || pending.has(src)) continue;
    workers++;
    pending.add(src);
    loadImage(src).then(img => {
      cache.set(src, {img, time: performance.now()});
      trimCache();
      request();
    }).catch(() => {
      if (src === frames[wantedIndex]?.src) {
        $('#loading-note').textContent = 'This image is unavailable; monthly details remain available.';
      }
    }).finally(() => {
      workers--;
      pending.delete(src);
      pump();
    });
  }
}

function trimCache() {
  const maxCache = innerWidth < 768 ? 32 : 96;
  if (cache.size <= maxCache) return;
  const selected = frames[wantedIndex]?.src;
  [...cache.entries()].sort((a, b) => a[1].time - b[1].time).forEach(([src, item]) => {
    if (cache.size > maxCache && src !== selected && src !== currentSource) {
      item.img.close?.();
      cache.delete(src);
    }
  });
}

function draw(index) {
  const f = frames[index], entry = cache.get(f.src);
  if (!entry) return false;
  if (shownIndex === index) return true;
  const {width: w, height: h, dpr} = layout, side = Math.min(w, h);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(entry.img, (w - side) / 2, (h - side) / 2, side, side);
  shownIndex = index;
  currentSource = f.src;
  entry.time = performance.now();
  canvas.dataset.renderedMonth = String(f.month);
  stage.classList.add('render-ready');
  return true;
}

function project(point) {
  const target = [0, 0, 3.2], forward = [-11, 17, -7.8];
  const normal = v => { const d = Math.hypot(...v); return v.map(x => x / d); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const f = normal(forward), right = normal(cross(f, [0, 0, 1])), up = cross(right, f), v = point.map((x, i) => x - target[i]);
  return [0.5 + dot(v, right) / 13.5, 0.5 - dot(v, up) / 13.5];
}

function updateLeader(index) {
  if (!frames.length || shownIndex !== index || innerWidth < 768) {
    $('#stage-leader').style.opacity = '0';
    return;
  }
  // Map frame index (0..92) back to equivalent 1..24 geometry timeline value so leader anchors track the exact 3D mesh positions
  const m24 = 1 + index * 0.25;
  let point;
  if (m24 < 2.0) point = [0, -0.8, 2.6];
  else if (m24 < 3.0) point = [0.6, -0.8, 2.0];
  else if (m24 < 3.75) point = [1.4, -0.4, 0.5];
  else if (m24 < 5.5) point = [0.5, 0, 0.55];
  else if (m24 < 6.75) point = [-2.25, 0, 2.75];
  else if (m24 < 7.75) point = [3.85, -1.05, 1.05];
  else if (m24 < 8.75) point = [-2.25, -0.68, 2.75 + 4.35];
  else if (m24 < 9.75) point = [-2.25, -0.99, 2.75 + 4.35];
  else if (m24 < 10.75) point = [0, -1.02, 2.75 + 4.35];
  else if (m24 < 12.0) point = [-2.25, -1.0, 2.75 + 4.35 * (1 - clamp(m24 - 11, 0, 1))];
  else if (m24 < 12.75) point = [-2.25, -1.0, 2.75];
  else if (m24 < 13.75) point = [0, -0.58, 5.18];
  else if (m24 < 14.75) point = [0.75, -0.72, 4.92];
  else if (m24 < 16.25) point = [3.5, -1.8, 2.75];
  else if (m24 < 17.25) point = [0, -3.55, 2.85];
  else if (m24 < 18.75) point = [0, -1.8, 2.75];
  else if (m24 < 19.75) point = [0, 0.78, 6.85];
  else if (m24 < 20.75) point = [4.02, -1.0, 2.5];
  else if (m24 < 22.0) point = [2.35, -2.26, 2.1];
  else if (m24 < 23.25) point = [0, 0.78, 8.05];
  else point = [-1.3, -1.94, 3.1];

  const [u, v] = project(point), r = layout.image, px = r.x + u * r.size, py = r.y + v * r.size, sRect = stage.getBoundingClientRect(), cRect = $('#component-name').getBoundingClientRect(), ex = cRect.left - sRect.left - 10, ey = cRect.top - sRect.top + cRect.height * 0.5;
  $('#stage-leader').setAttribute('viewBox', `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
  $('#leader-line').setAttribute('points', `${px},${py} ${ex - 20},${ey} ${ex},${ey}`);
  $('#leader-dot').setAttribute('cx', px);
  $('#leader-dot').setAttribute('cy', py);
  $('#stage-leader').style.opacity = '1';
}

function stop(syncScroll = true) {
  if (!playing) return;
  playing = false;
  $('#play').setAttribute('aria-pressed', 'false');
  $('#play-label').textContent = 'Play build';
  $('#play-icon').setAttribute('d', 'M4 2l9 6-9 6z');
  if (syncScroll && !staticMode) {
    window.scrollTo({top: layout.top + layout.travel * (rawMonth - 1) / MAX_STEP, behavior: 'instant'});
  }
}

function tick(time) {
  raf = null;
  if (!months.length) return;
  if (dirty) measure();

  if (playing) {
    if (playStart === 0) playStart = time;
    rawMonth = clamp(playBase + (time - playStart) / 2800, 1, TOTAL_MONTHS);
    targetMonth = rawMonth;
    if (rawMonth >= TOTAL_MONTHS) stop(true);
  } else if (!staticMode) {
    targetMonth = 1 + MAX_STEP * clamp((scrollY - layout.top) / layout.travel, 0, 1);
    const diff = targetMonth - rawMonth;
    if (Math.abs(diff) > 0.003) {
      rawMonth += diff * 0.28;
    } else {
      rawMonth = targetMonth;
    }
  }

  renderMonth(clamp(Math.floor(rawMonth + 0.01), 1, TOTAL_MONTHS));
  if (dirty) measure();

  if (frames.length && ctx) {
    const i = closest(rawMonth);
    planAssets(i);
    const ready = draw(i);
    $('#loading-note').classList.toggle('visible', !ready && shownIndex < 0);
    updateLeader(i);
  }

  if (playing || (!staticMode && Math.abs(targetMonth - rawMonth) > 0.003)) {
    request();
  }
}

function go(value, focus = false) {
  stop(false);
  value = clamp(value, 1, TOTAL_MONTHS);
  rawMonth = value;
  targetMonth = value;
  renderMonth(value);
  if (dirty) measure();
  if (staticMode) {
    renderMonth(value);
    request();
  } else {
    window.scrollTo({top: layout.top + layout.travel * (value - 1) / MAX_STEP, behavior: 'instant'});
  }
  request();
  if (focus) requestAnimationFrame(() => $(`[data-month="${value}"]`)?.focus());
}

window.addEventListener('scroll', () => { if (!playing) request(); }, {passive: true});
window.addEventListener('resize', layoutChanged);
window.addEventListener('pageshow', layoutChanged);
['wheel', 'touchstart', 'pointerdown'].forEach(type => window.addEventListener(type, e => {
  if (playing && !e.target.closest('#play')) stop(true);
}, {passive: true}));
if ('ResizeObserver' in window) new ResizeObserver(layoutChanged).observe(area);
document.fonts?.ready.then(layoutChanged);

$$('[data-month]').forEach(b => b.addEventListener('click', () => go(Number(b.dataset.month))));
$$('[data-jump-month]').forEach(lane => lane.addEventListener('click', () => go(Number(lane.dataset.jumpMonth), true)));
$('#previous').addEventListener('click', () => go(month - 1));
$('#next').addEventListener('click', () => go(month + 1));
$('#jump-complete').addEventListener('click', () => go(month === TOTAL_MONTHS ? 1 : TOTAL_MONTHS));
$('#month-range').addEventListener('input', e => go(Number(e.target.value)));

$('.months-rail').addEventListener('keydown', e => {
  let target = null;
  if (['ArrowDown', 'ArrowRight'].includes(e.key)) target = month + 1;
  if (['ArrowUp', 'ArrowLeft'].includes(e.key)) target = month - 1;
  if (e.key === 'Home') target = 1;
  if (e.key === 'End') target = TOTAL_MONTHS;
  if (target !== null) {
    e.preventDefault();
    go(clamp(target, 1, TOTAL_MONTHS), true);
  }
});

$('#play').addEventListener('click', () => {
  if (playing) {
    stop(true);
    return;
  }
  if (month === TOTAL_MONTHS) go(1);
  playing = true;
  playStart = 0;
  playBase = rawMonth;
  $('#play').setAttribute('aria-pressed', 'true');
  $('#play-label').textContent = 'Pause build';
  $('#play-icon').setAttribute('d', 'M3 2h4v12H3zm6 0h4v12H9z');
  request();
});

document.addEventListener('visibilitychange', () => { if (document.hidden) stop(true); });

function setReduced(value) {
  stop(false);
  staticMode = value;
  document.body.classList.toggle('static-mode', value);
  layoutChanged();
}
reduced.addEventListener('change', e => setReduced(e.matches));
setReduced(reduced.matches);

function openDialog(d) {
  stop(true);
  if (!d.open) d.showModal();
}
$('#about-timeline').addEventListener('click', () => openDialog($('#about-dialog')));
$$('.dialog-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach(d => d.addEventListener('click', e => {
  if (e.target === d) {
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }
}));
$('#sources-link').addEventListener('click', () => $('#about-dialog').close());

$('#research-button').addEventListener('click', () => {
  if (!months.length) return;
  const m = months[month - 1];
  $('#research-month').textContent = `MONTH ${String(month).padStart(2, '0')} · ${m.phase}`;
  $('#research-title').textContent = m.title;
  $('#research-body').textContent = m.body + ' ' + m.detail + '.';
  $('#research-links').replaceChildren(...m.sources.map(key => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = sources[key].url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = sources[key].label;
    li.appendChild(a);
    return li;
  }));
  openDialog($('#research-dialog'));
});

Promise.all([
  fetch('assets/timeline/months.json').then(r => { if (!r.ok) throw Error('Content unavailable'); return r.json(); }),
  fetch('assets/timeline/manifest.json').then(r => { if (!r.ok) throw Error('Frames unavailable'); return r.json(); })
]).then(([content, sequence]) => {
  months = content.months;
  sources = content.sources;
  frames = sequence;
  if (!ctx) {
    setReduced(true);
    $('.table-details').open = true;
    return;
  }
  renderMonth(1);
  planAssets(closest(rawMonth));
  request();
}).catch(() => {
  document.body.classList.add('static-mode');
  staticMode = true;
  $('.table-details').open = true;
  $('#render-caption').textContent = 'Read all monthly milestones below';
  $('#play').hidden = true;
});
