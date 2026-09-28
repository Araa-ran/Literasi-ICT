'use strict';
/* ================== PENGATURAN ================== */
const RESET_PREVIOUS_ON_GAMEOVER = true; // true: saat nyawa habis, level sebelumnya dikunci & diulang dari awal
const START_LIVES = 5, START_HINTS = 5;
const IMAGE_EXT = ['jpg', 'png', 'jpeg', 'webp']; // foto soal: images/level1/1.jpg ... images/level3/15.jpg

/* ================== DATA SOAL: [jawaban, hint] ================== */
const DATA = [
  { time: 60, q: [
    ['die Autobahn','die'],['die Hausaufgabe','die'],['teuer','Adjektiv'],['das Wochenende','das'],['suchen','Verb'],
    ['der Kindergarten','der'],['das Kaufhaus','das'],['der Supermarkt','der'],['der Handschuh','der'],['der Badeanzug','der'],
    ['das Schlafzimmer','das'],['die Freizeit','die'],['die Fahrkarte','die'],['der Parkplatz','der'],['Gute Nacht',null] ] },
  { time: 60, q: [
    ['die Waschmaschine','die'],['das Schwimmbad','das'],['reich','Adjektiv'],['die Krankenkasse','die'],['die Hauptstadt','die'],
    ['die Mittagspause','die'],['lernen','Verb'],['der Arbeitsplatz','der'],['der Schneemann','der'],['die Ankunft','die'],
    ['einfach','Adjektiv'],['der Kugelschreiber','der'],['die Sonnenbrille','die'],['der Anschluss','der'],['Auf Wiedersehen',null] ] },
  { time: 120, q: [
    ['der Einfall','der'],['die Ausbildung','die'],['der Strandurlaub','der'],['einladen','Verb'],['die Bankkauffrau','die'],
    ['das Taschentuch','das'],['die Hauptschule','die'],['der Geldautomat','der'],['die Tastatur','die'],['die Hochzeit','die'],
    ['die Geburtstagsparty','die'],['das Feuerwerk','das'],['die Mitternacht','die'],['der Fahrplan','der'],['Herzlichen Glückwunsch',null] ] }
];

/* ================== SIMPAN / MUAT ================== */
const KEY = 'rateDasBild_v1';
const newLv = () => ({ q: 0, lives: START_LIVES, hints: START_HINTS, steps: {} });
function load() {
  const base = { unlocked: [1], levels: { 1: newLv(), 2: newLv(), 3: newLv() }, muted: false };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.levels) return Object.assign(base, s); } catch (e) {}
  return base;
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const $ = s => document.querySelector(s);

/* ================== RUMPUT (background dibuat otomatis) ================== */
(function grass() {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); g.fillStyle = '#3a7a1c'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * N, y = Math.random() * N, len = 6 + Math.random() * 11, a = -Math.PI / 2 + (Math.random() - .5) * 1.1;
    g.strokeStyle = `hsl(${82 + Math.random() * 22},${50 + Math.random() * 25}%,${20 + Math.random() * 30}%)`;
    g.lineWidth = .8 + Math.random() * .9;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len); g.stroke();
    }
  }
  document.body.style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* ================== AUDIO (dibuat dengan WebAudio, tanpa file) ================== */
const Snd = {
  ctx: null, want: null, step: 0, next: 0, timer: null, bpm: 112, muted: S.muted,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const x = this.ctx = new C();
    this.music = x.createGain(); this.sfx = x.createGain();
    this.music.connect(x.destination); this.sfx.connect(x.destination); this.applyMute();
    const b = x.createBuffer(1, x.sampleRate * .5, x.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
    this.start();
  },
  applyMute() { if (!this.ctx) return; this.music.gain.value = this.muted ? 0 : .22; this.sfx.gain.value = this.muted ? 0 : .6; },
  toggle() { this.muted = !this.muted; S.muted = this.muted; save(); this.applyMute(); $('#muteBtn').textContent = this.muted ? '🔇' : '🔊'; },
  f: m => 440 * Math.pow(2, (m - 69) / 12),
  tone(f, t, d, type, vol, dest, f2) {
    const x = this.ctx, o = x.createOscillator(), g = x.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + d + .05);
  },
  hat(t, vol) {
    const x = this.ctx, s = x.createBufferSource(), g = x.createGain(), h = x.createBiquadFilter();
    s.buffer = this.noise; h.type = 'highpass'; h.frequency.value = 7000; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    s.connect(h); h.connect(g); g.connect(this.music); s.start(t); s.stop(t + .06);
  },
  setMode(m) { this.want = m; this.start(); },
  start() {
    clearInterval(this.timer); this.timer = null; this.mode = this.want;
    if (!this.ctx || !this.mode) return;
    this.step = 0; this.bpm = this.mode === 'tense' ? 150 : 112; this.next = this.ctx.currentTime + .1;
    this.timer = setInterval(() => { while (this.next < this.ctx.currentTime + .2) { this.play(this.step++, this.next); this.next += 60 / this.bpm / 2; } }, 30);
  },
  play(n, t) {
    const e = 60 / this.bpm / 2, s = n % 32, bar = Math.floor(s / 8), f = this.f, M = this.music;
    if (this.mode === 'calm') {
      const root = [48, 45, 41, 43][bar], ch = [[60, 64, 67, 64], [57, 60, 64, 60], [53, 57, 60, 57], [55, 59, 62, 59]][bar];
      if (s % 4 === 0) this.tone(f(root), t, e * 3.5, 'triangle', .5, M);
      this.tone(f(ch[s % 4] + 12), t, e * 1.6, 'sine', .22, M);
      const mel = [76,0,79,0,76,0,74,0, 72,0,76,0,74,0,72,0, 69,0,72,0,77,0,76,0, 74,0,71,0,74,0,0,0][s];
      if (mel) this.tone(f(mel), t, e * 1.8, 'square', .07, M);
      if (s % 2) this.hat(t, .04);
    } else {
      const root = [33, 29, 33, 28][bar], sd = s % 8;
      this.tone(f(sd === 7 ? root + 3 : root), t, e * .9, 'sawtooth', .3, M);
      if (s % 4 === 0) this.tone(130, t, .2, 'sine', .7, M, 40);
      if (sd === 0 || sd === 3 || sd === 6) this.tone(f([81, 84, 80][(s / 3 | 0) % 3]), t, e * .5, 'square', .06, M);
      this.hat(t, s % 2 ? .07 : .04);
    }
  },
  click() { if (this.ctx) this.tone(660, this.ctx.currentTime, .06, 'square', .12); },
  tick() { if (this.ctx) this.tone(1100, this.ctx.currentTime, .05, 'sine', .25); },
  hint() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(1200, t, .3, 'sine', .3); this.tone(1600, t + .1, .4, 'sine', .25); },
  correct() { if (!this.ctx) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((q, i) => this.tone(q, t + i * .09, .3, 'triangle', .4)); },
  wrong() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(220, t, .4, 'sawtooth', .35, null, 70); this.tone(165, t + .05, .4, 'square', .15, null, 60); },
  lose() { if (!this.ctx) return; const t = this.ctx.currentTime; [392, 330, 262, 196].forEach((q, i) => this.tone(q, t + i * .22, .5, 'triangle', .45)); },
  win() { if (!this.ctx) return; const t = this.ctx.currentTime; [523, 659, 784, 1047, 784, 1047, 1319].forEach((q, i) => this.tone(q, t + i * .13, .45, 'triangle', .4)); }
};
$('#muteBtn').textContent = Snd.muted ? '🔇' : '🔊';
$('#muteBtn').onclick = () => Snd.toggle();
document.addEventListener('pointerdown', () => Snd.init());
document.addEventListener('click', e => { if (e.target.closest('.btn,.tile,.lamp') && !e.target.closest('.grey')) Snd.click(); });

/* ================== UTIL UI ================== */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + id).classList.add('active');
  if (id !== 'game') { stopTimer(); Snd.setMode('calm'); }
}
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
function modal(title, text, buttons) {
  $('#mTitle').textContent = title; $('#mText').textContent = text; const b = $('#mBtns'); b.innerHTML = '';
  buttons.forEach(o => { const x = document.createElement('button'); x.className = 'btn ' + (o.cls || ''); x.textContent = o.label; x.onclick = () => { $('#modal').classList.remove('show'); o.fn && o.fn(); }; b.append(x); });
  $('#modal').classList.add('show');
}
const norm = s => s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[!.?,]/g, '');

/* ================== MENU ================== */
$('#bPlay').onclick = () => { renderPlay(); show('play'); };
$('#bHelp').onclick = () => show('help');
$('#bHelpBack').onclick = () => show('menu');
$('#bPlayBack').onclick = () => show('menu');
$('#bGridBack').onclick = () => { renderPlay(); show('play'); };
$('#bReset').onclick = () => modal('Zurücksetzen?', 'Semua jawaban & progres akan dihapus. Lanjutkan?', [
  { label: 'Ja', cls: 'red', fn: () => { S = { unlocked: [1], levels: { 1: newLv(), 2: newLv(), 3: newLv() }, muted: Snd.muted }; save(); toast('Alles zurückgesetzt!'); } },
  { label: 'Nein' }]);

function renderPlay() {
  const box = $('#lvlList'); box.innerHTML = '';
  for (let n = 1; n <= 3; n++) {
    const open = S.unlocked.includes(n), L = S.levels[n], b = document.createElement('button');
    b.className = 'btn lvl' + (open ? '' : ' grey');
    b.innerHTML = `<i class="ico ${open ? 'star' : 'lock'}"></i><span>Level ${n}</span>` + (open && L.q > 0 ? `<em>${L.q}/15</em>` : '');
    b.onclick = () => { if (!open) { Snd.wrong(); shake(b); return; } openGrid(n); };
    box.append(b);
  }
}
function openGrid(n) {
  G.level = n; $('#gridTitle').textContent = 'LEVEL ' + n;
  const L = S.levels[n], box = $('#tiles'); box.innerHTML = '';
  for (let i = 0; i < 15; i++) {
    const open = i <= L.q, b = document.createElement('button');
    b.className = 'btn tile' + (i === 14 && open ? ' red' : '') + (!open ? ' grey' : '') + (i < L.q ? ' done' : '') + (i === L.q ? ' cur' : '');
    b.textContent = i + 1;
    b.onclick = () => { if (!open) { Snd.wrong(); shake(b); return; } startQuestion(n, i); };
    box.append(b);
  }
  show('grid');
}

/* ================== GAME ================== */
const G = { level: 1, idx: 0, review: false, busy: false, timerId: null, endAt: 0, lastSec: null };
const heartSVG = '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.4-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.6-8 11-8 11z"/></svg>';
const cur = () => S.levels[G.level];
const ans = () => DATA[G.level - 1].q[G.idx][0];

function drawHearts() {
  const L = cur(); $('#lives').innerHTML = '';
  for (let i = 0; i < 5; i++) { const h = document.createElement('span'); h.className = 'heart' + (i < L.lives ? '' : ' lost'); h.innerHTML = heartSVG; $('#lives').append(h); }
  $('#hintCount').textContent = G.idx === 14 ? '–' : L.hints;
  $('#lamp').classList.toggle('off', G.idx === 14 || G.review);
}
function loadImage() {
  const img = $('#qimg'), ph = $('#ph'); let k = 0;
  const base = `images/level${G.level}/${G.idx + 1}.`;
  img.style.display = 'none'; ph.style.display = 'block'; $('#phPath').textContent = base + 'jpg';
  img.onload = () => { img.style.display = 'block'; ph.style.display = 'none'; };
  img.onerror = () => { if (++k < IMAGE_EXT.length) img.src = base + IMAGE_EXT[k]; };
  img.src = base + IMAGE_EXT[0];
}
function startQuestion(level, idx) {
  stopTimer(); G.level = level; G.idx = idx; G.busy = false;
  const L = cur(); G.review = idx < L.q;
  const card = $('#card'), inp = $('#answer'), timed = idx === 14 && !G.review;
  card.className = 'card' + (timed ? ' timed' : '');
  inp.disabled = G.review; inp.value = G.review ? ans() : '';
  $('#bCheck').textContent = G.review ? 'Weiter' : 'Prüfen';
  const c = $('#counter'); c.className = 'counter' + (timed ? ' timer' : ''); c.textContent = `${idx + 1}/15`;
  drawHearts(); loadImage(); renderHint(); show('game');
  if (timed) { Snd.setMode('tense'); startTimer(); } else { Snd.setMode('calm'); if (!G.review) setTimeout(() => inp.focus(), 50); }
}

/* ---- hint ---- */
function parts(a) { const m = a.match(/^(der|die|das) (.+)$/i); return m ? m[2] : a; }
function revealOrder(word) {
  const ix = [...word].map((c, i) => i).filter(i => word[i] !== ' '), o = [ix[0], ix[ix.length - 1], ix[Math.floor(ix.length / 2)]];
  const first = [...new Set(o)]; return first.concat(ix.filter(i => !first.includes(i)));
}
function renderHint() {
  const s = $('#hintStrip'), L = cur(), a = ans(), h = DATA[G.level - 1].q[G.idx][1];
  if (G.review) { s.style.display = 'block'; s.innerHTML = '✔ ' + a; return; }
  const step = L.steps[G.idx] || 0;
  if (!h || step === 0) { s.style.display = 'none'; return; }
  let html = '💡 Hinweis: <b>' + h + '</b>';
  if (step >= 2) {
    const w = parts(a), rev = revealOrder(w).slice(0, Math.max(0, step - 2)), n = [...w].filter(c => c !== ' ').length;
    const pat = [...w].map((c, i) => c === ' ' ? '&nbsp;&nbsp;' : rev.includes(i) ? c.toUpperCase() : '_').join(' ');
    html += `<br><span class="pat">${pat}</span> (${n})`;
  }
  s.style.display = 'block'; s.innerHTML = html;
}
$('#lamp').onclick = () => {
  if (G.review || G.busy) return;
  if (G.idx === 14) { toast('Bei Frage 15 gibt es keine Hinweise!'); return; }
  const L = cur(), step = L.steps[G.idx] || 0;
  if (step >= 5) { toast('Alle Hinweise dieser Frage benutzt'); return; }
  if (L.hints <= 0) { toast('Keine Hinweise mehr in diesem Level!'); Snd.wrong(); shake($('#lamp')); return; }
  L.hints--; L.steps[G.idx] = step + 1; save(); Snd.hint(); drawHearts(); renderHint();
};

/* ---- timer (soal 15) ---- */
function startTimer() { G.endAt = Date.now() + DATA[G.level - 1].time * 1000; G.lastSec = null; drawTimer(); G.timerId = setInterval(drawTimer, 200); }
function stopTimer() { clearInterval(G.timerId); G.timerId = null; if (Snd.mode === 'tense') Snd.bpm = 150; }
function drawTimer() {
  const r = Math.max(0, Math.ceil((G.endAt - Date.now()) / 1000)), c = $('#counter');
  c.textContent = `⏱ ${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
  if (r !== G.lastSec) { G.lastSec = r; if (r <= 10 && r > 0) Snd.tick(); Snd.bpm = r <= 10 ? 190 : 150; c.classList.toggle('low', r <= 10); }
  if (r <= 0) { stopTimer(); if (!penalty('Zeit abgelaufen!')) startTimer(); }
}

/* ---- jawab ---- */
function penalty(msg) {
  const L = cur(); L.lives--; save(); drawHearts(); const card = $('#card');
  card.classList.add('bad'); setTimeout(() => card.classList.remove('bad'), 500); shake($('#answer'));
  if (L.lives <= 0) { G.busy = true; stopTimer(); Snd.lose(); setTimeout(gameOver, 700); return true; }
  Snd.wrong(); toast(`${msg} Noch ${L.lives} ${L.lives === 1 ? 'Leben' : 'Leben'}`); return false;
}
function submit() {
  if (G.busy) return;
  if (G.review) { G.idx < 14 ? startQuestion(G.level, G.idx + 1) : openGrid(G.level); return; }
  const v = norm($('#answer').value); if (!v) return;
  if (v === norm(ans())) {
    G.busy = true; stopTimer(); Snd.correct(); $('#card').classList.add('ok'); $('#answer').value = ans();
    const L = cur(); L.q = Math.max(L.q, G.idx + 1); save();
    setTimeout(() => G.idx < 14 ? startQuestion(G.level, G.idx + 1) : levelComplete(), 1100);
  } else { penalty('Falsch!'); $('#answer').select(); }
}
$('#bCheck').onclick = submit;
$('#answer').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
$('#bGameBack').onclick = () => { if (!G.busy) openGrid(G.level); };

function gameOver() {
  const n = G.level;
  modal('Game Over', 'Keine Leben mehr! Kamu mulai lagi dari soal 1' + (RESET_PREVIOUS_ON_GAMEOVER && n > 1 ? ' dan level sebelumnya terkunci lagi.' : '.'), [{ label: 'OK', fn: () => {
    S.levels[n] = newLv();
    if (RESET_PREVIOUS_ON_GAMEOVER) { for (let k = 1; k < n; k++) S.levels[k] = newLv(); S.unlocked = [...new Set([1, n])]; }
    save(); G.busy = false; openGrid(n); } }]);
}
function levelComplete() {
  const n = G.level; Snd.win(); stopTimer();
  if (n < 3 && !S.unlocked.includes(n + 1)) S.unlocked.push(n + 1);
  save();
  modal(n < 3 ? 'Level geschafft!' : 'Glückwunsch!', n < 3 ? `Level ${n + 1} sudah terbuka!` : 'Kamu sudah menyelesaikan semua level. Toll gemacht!',
    [{ label: 'Weiter', fn: () => { G.busy = false; renderPlay(); show('play'); } }]);
}
