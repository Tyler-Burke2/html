/* script.js
   Updated to:
   - Ensure words travel fully off-screen and take exactly 6s to cross
   - Add golden words (5% chance) with particle burst on success
   - Add combo-step upgrade (linear +0.1 per level)
   - Flash play-area border on wrong submissions
   - Fix spam/Enter bug by operating on captured element references and marking handled elements
   - Keep original structure & naming as much as possible
*/

const DEFAULT_WORDS = ["temple","wilds","ancient","compass","whisper","starlight","meadow","journey","sapphire","summit","lantern","quest","guardian","voyage","echo","timber","harbor","mystic","horizon","sanctum"];
const SAVE_KEY = 'typing-clicker-bright-v1';
const AUTOSAVE_INTERVAL_MS = 10000;
const WORD_DURATION_MS = 6000; // fixed 6 seconds for full travel
const SPEED_OFF_FACTOR = 3; // speed up factor for successful "speed off"
const BASE_MULTIPLIER_STEP = 0.1;
const MULTIPLIER_MAX = 5.0;

// State (kept format similar to your original)
let state = {
  dollars: 0,
  basePerWord: 1,
  upgrades: [
    { id: 'plus1', name: '+1 $/word', desc: 'Add +1 dollar per word', baseCost: 25, add: 1, level: 0, img: 'images/upgrade-plus1.png' },
    { id: 'plus3', name: '+3 $/word', desc: 'Add +3 dollars per word', baseCost: 110, add: 3, level: 0, img: 'images/upgrade-plus3.png' },
    { id: 'combo', name: 'Combo Mastery', desc: 'Increase combo multiplier slightly', baseCost: 260, add: 0, level: 0, img: 'images/upgrade-combo.png' },
    // NEW upgrade: combo-step increases the per-word combo increment (linear)
    { id: 'combo-step', name: 'Combo Accelerator', desc: 'Each level adds +0.1 to combo growth per word', baseCost: 200, add: 0.1, level: 0, img: 'images/upgrade-combo-step.png' }
  ],
  words: [],
  activeWordEl: null,
  activeAnimation: null,
  typed: '',
  combo: 0,
  lastCorrect: 0,
  autosaveTimeout: null,
  ambientOn: false
};

// DOM
const playArea = document.getElementById('play-area');
const floatingContainer = document.getElementById('floating-container');

const dollarsEl = document.getElementById('dollars');
const perWordEl = document.getElementById('per-word');
const comboEl = document.getElementById('combo');
const multiplierEl = document.getElementById('multiplier');
const comboMultDisplay = document.getElementById('combo-mult');
const upgradesEl = document.getElementById('upgrades');

const menuModal = document.getElementById('menu-modal');
const openMenuBtn = document.getElementById('open-menu');
const closeMenuBtn = document.getElementById('close-menu');
const manualSaveBtn = document.getElementById('manual-save');
const manualLoadBtn = document.getElementById('manual-load');
const exportBtn = document.getElementById('export-save');
const importBtn = document.getElementById('import-save');
const importArea = document.getElementById('import-area');
const resetBtn = document.getElementById('reset-progress');

const ambientAudio = document.getElementById('ambient-audio');
const typeSfx = document.getElementById('type-sfx');
const successSfx = document.getElementById('success-sfx');
const audioToggleBtn = document.getElementById('audio-toggle');

// Utilities
function now(){ return Date.now(); }
function fmt(n){ return Math.floor(n); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Load external words.json (falls back to DEFAULT_WORDS)
async function loadWords(){
  try {
    const r = await fetch('words.json', {cache: "no-store"});
    if(!r.ok) throw new Error('fetch fail');
    const data = await r.json();
    state.words = Array.isArray(data.words) && data.words.length ? data.words.slice() : DEFAULT_WORDS.slice();
  } catch(e){
    state.words = DEFAULT_WORDS.slice();
  }
}

// Per-word earnings
function calcPerWord(){
  let per = state.basePerWord;
  state.upgrades.forEach(u => { if(u.add && (u.id === 'plus1' || u.id === 'plus3')) per += u.add * u.level; });
  return per;
}

// Effective combo step (base + upgrades combo-step)
function getEffectiveComboStep(){
  let step = BASE_MULTIPLIER_STEP;
  const up = state.upgrades.find(x => x.id === 'combo-step');
  if(up && up.level) step += up.level * (up.add || 0);
  return step;
}

// Multiplier: based on combo count and effective step
function getMultiplierForCombo(combo){
  if(combo <= 1) return 1.0;
  const step = getEffectiveComboStep();
  const mult = 1 + (combo - 1) * step;
  return Math.min(mult, MULTIPLIER_MAX);
}

function updateHUD(){
  dollarsEl.textContent = fmt(state.dollars);
  perWordEl.textContent = fmt(calcPerWord());
  comboEl.textContent = state.combo;
  const mult = getMultiplierForCombo(state.combo);
  multiplierEl.textContent = mult.toFixed(2) + '×';

  const comboNumEl = document.querySelector('.combo-num');
  if(comboNumEl){
    if(mult >= MULTIPLIER_MAX) comboNumEl.classList.add('maxed');
    else comboNumEl.classList.remove('maxed');
  }
  renderUpgrades();
}

/* ---------- SPAWN / ANIMATION LOGIC ---------- */

/*
  spawnWord:
   - ensures the word element starts fully offscreen to the right (left = playAreaWidth px)
   - animates its left property from playAreaWidth -> -wordWidth over WORD_DURATION_MS (6000ms)
   - marks element with dataset.handled to avoid double-processing
   - adds dataset.golden for golden words (5% chance)
*/
async function spawnWord(){
  // Only one active word at a time
  if(state.activeWordEl) return;

  // ensure we have words
  if(!state.words || state.words.length === 0) state.words = DEFAULT_WORDS.slice();

  const word = state.words[Math.floor(Math.random()*state.words.length)];
  const isGolden = (Math.random() < 0.05); // 5% chance

  // create element structure like original
  const el = document.createElement('div');
  el.className = 'moving-word';
  el.innerHTML = `
    <div class="word-bubble" aria-hidden="true">${escapeHtml(word)}</div>
    <div class="typed-line" aria-hidden="true"></div>
  `;
  playArea.appendChild(el);

  // store state on element
  el.dataset.word = word;
  el.dataset.golden = isGolden ? '1' : '0';
  el.dataset.handled = '0'; // flag to prevent double-handling

  // ensure layout is computed so offsets are accurate
  // read a layout property to force reflow
  const areaRect = playArea.getBoundingClientRect();
  const areaWidth = playArea.clientWidth;

  // To measure the word bubble width we must ensure it has been laid out
  // Force a reflow by reading offsetWidth
  const wordBubble = el.querySelector('.word-bubble');
  const measuredWidth = el.offsetWidth || wordBubble.offsetWidth || 120;

  // If golden, apply an inline style highlight so we don't have to change CSS
  if(isGolden){
    // golden visual inline styling (non-invasive)
    wordBubble.style.background = 'linear-gradient(90deg,#fff7d6,#ffd166)';
    wordBubble.style.color = '#331900';
    wordBubble.style.border = '1px solid rgba(255,209,102,0.85)';
    wordBubble.style.boxShadow = '0 16px 44px rgba(255,209,102,0.12), 0 0 18px rgba(255,209,102,0.18)';
  }

  // Place element just outside the right edge of the play area
  // We'll animate the "left" property from areaWidth (px) -> -measuredWidth (px)
  el.style.left = areaWidth + 'px';
  el.style.top = '50%';
  el.style.transform = 'translateY(-50%)';

  // Create the animation with Web Animations API animating the "left" CSS property.
  // Use numeric px values so the travel is independent of window size and always takes WORD_DURATION_MS.
  const startLeft = areaWidth;
  const endLeft = -measuredWidth - 8; // extra -8 px so it fully clears

  // IMPORTANT: keep a reference to the animation so we can speed it up on success
  const anim = el.animate([
    { left: startLeft + 'px' },
    { left: endLeft + 'px' }
  ], {
    duration: WORD_DURATION_MS,
    easing: 'linear',
    fill: 'forwards'
  });

  // Save pointers in state for potential external access (like cancel)
  state.activeWordEl = el;
  state.activeAnimation = anim;

  // Handle natural finish => miss
  anim.onfinish = () => {
    // if element still in DOM and wasn't already handled, treat as miss
    if(document.body.contains(el) && el.dataset.handled === '0'){
      handleMiss(el, word);
    }
  };

  return el;
}

/* ---------- RENDER TYPED ---------- */
function renderTypedForActive(){
  const el = state.activeWordEl;
  if(!el) return;
  const target = el.dataset.word || '';
  const typed = state.typed || '';
  const typedLine = el.querySelector('.typed-line');
  if(!typedLine) return;
  let html = '';
  for(let i=0;i<target.length;i++){
    const t = target[i];
    const c = typed[i] || '';
    if(c === '') html += `<span class="pending">${t}</span>`;
    else if(c === t) html += `<span class="match">${c}</span>`;
    else html += `<span class="mismatch">${c}</span>`;
  }
  if(typed.length > target.length){
    for(let j=target.length;j<typed.length;j++){
      html += `<span class="mismatch">${typed[j]}</span>`;
    }
  }
  typedLine.innerHTML = html;
}

/* ---------- SUBMIT / SUCCESS / MISS ---------- */

/*
  submitActive:
    - Capture current active element into local variable (el)
    - Immediately mark as handled and clear state.activeWordEl so new spawns are allowed
    - Compare typed string to target and handle success/failure based on that captured element
*/
function submitActive(){
  const el = state.activeWordEl;
  if(!el){
    feedback('No active word', 'crimson');
    return;
  }

  // Capture and mark so rapid Enter/key spam won't process this element more than once
  el.dataset.handled = '1';
  state.activeWordEl = null; // allow spawn of next word while we finish processing
  const anim = state.activeAnimation;
  state.activeAnimation = null;

  const target = el.dataset.word || '';
  const candidate = (state.typed || '').trim();

  // Clear typed buffer for next word immediately for UX
  state.typed = '';

  if(candidate.length === 0){
    feedback('Type first', 'crimson');
    // restore active if we didn't actually process? We'll remove it to avoid duplicate: handle as wrong
    el.dataset.handled = '1';
    // treat as no-op but keep element present
    return;
  }

  if(candidate === target){
    // SUCCESS path — operate on the captured element 'el'
    state.combo = state.combo + 1;
    state.lastCorrect = now();
    const mult = getMultiplierForCombo(state.combo);
    const per = calcPerWord();
    let gained = Math.round(per * mult);

    // golden handling
    if(el.dataset.golden === '1'){
      gained = gained * 3;
    }

    state.dollars += Math.max(1, gained);
    updateHUD();
    spawnFloating(`+${gained} $`, el);

    // correct SFX and visual
    try{ successSfx && successSfx.play().catch(()=>{}); }catch{}

    const bubble = el.querySelector('.word-bubble');
    bubble?.classList.add('flash-correct');

    // if it's golden, spawn particles at its position
    if(el.dataset.golden === '1'){
      spawnGoldenParticlesAtElement(el, 18);
      // optional extra visual: temporary scale
      bubble && (bubble.style.transform = 'scale(1.04)');
      setTimeout(()=> { if(bubble) bubble.style.transform = ''; }, 300);
    }

    // accelerate the animation (if supported) to make it exit faster
    if(anim){
      try{
        anim.playbackRate = SPEED_OFF_FACTOR;
      } catch(e){
        // fallback: cancel and animate a fast exit to the end
        anim.cancel();
        const areaWidth = playArea.clientWidth;
        const endLeft = - (el.offsetWidth || 120) - 8;
        const fast = el.animate([
          { left: getComputedStyle(el).left || '0px' },
          { left: endLeft + 'px' }
        ], { duration: Math.max(120, WORD_DURATION_MS / SPEED_OFF_FACTOR), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        fast.onfinish = () => cleanupActive(el, true);
      }
      // ensure cleanup when accelerated animation ends
      anim.onfinish = () => cleanupActive(el, true);
    } else {
      // no anim object — cleanup soon
      cleanupActive(el, true);
    }

    // HUD update
    updateHUD();

    // If reached cap, show special floating message
    const multAfter = getMultiplierForCombo(state.combo);
    if(multAfter >= MULTIPLIER_MAX){
      const comboNumEl = document.querySelector('.combo-num');
      if(comboNumEl) comboNumEl.classList.add('maxed');
      spawnFloating('MAX 5.0×!', el);
    }

  } else {
    // WRONG path
    state.combo = 0;
    state.lastCorrect = 0;
    updateHUD();
    feedback('Wrong — combo reset', 'crimson');

    // cancel anim then handle miss at the element's place
    try{ if(anim) anim.cancel(); } catch(e){}
    handleMiss(el, el.dataset.word, true);
  }
}

/*
  handleMiss(el, word, force)
   - animates pieces breaking outward but positions them relative to the playArea so they appear at the correct location
   - resets combo and spawns next word after a short delay
*/
function handleMiss(el, word, force=false){
  if(!el || !document.body.contains(el)) return;
  // ensure we mark handled to avoid double handling
  el.dataset.handled = '1';

  const bubble = el.querySelector('.word-bubble');
  const text = word || (el.dataset && el.dataset.word) || '';

  // compute bubble bounding relative to playArea
  const bubbleRect = bubble ? bubble.getBoundingClientRect() : el.getBoundingClientRect();
  const containerRect = playArea.getBoundingClientRect();

  // hide bubble so pieces show instead
  if(bubble) bubble.style.visibility = 'hidden';

  // spawn pieces inside playArea positioned correctly
  for(let i=0;i<text.length;i++){
    const p = document.createElement('div');
    p.className = 'piece';
    p.textContent = text[i];
    playArea.appendChild(p);

    // position relative to playArea
    const startLeft = bubbleRect.left - containerRect.left + (bubbleRect.width/2);
    const startTop = bubbleRect.top - containerRect.top + (bubbleRect.height/2);
    p.style.left = startLeft + 'px';
    p.style.top = startTop + 'px';

    // animate piece outward
    const angle = (Math.random()*Math.PI*2);
    const dist = 60 + Math.random()*140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30;
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity:1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${(Math.random()*360-180)}deg)`, opacity:0 }
    ], { duration: 700 + Math.random()*300, easing: 'cubic-bezier(.2,.8,.2,1)' })
    .onfinish = () => p.remove();
  }

  // typed-line fade
  const typedLine = el.querySelector('.typed-line');
  if(typedLine){
    typedLine.animate([{ opacity:1 }, { opacity:0 }], { duration:500, fill:'forwards' });
  }

  // flash the play area border (new simpler wrong animation)
  flashPlayAreaBorder();

  // reset combo & HUD
  state.combo = 0;
  state.lastCorrect = 0;
  updateHUD();

  // remove original element after a short delay and spawn next
  setTimeout(()=> {
    if(document.body.contains(el)) el.remove();
    if(state.activeWordEl === el) state.activeWordEl = null;
    state.activeAnimation = null;
    setTimeout(()=> spawnWord(), 300);
  }, 650);
}

/*
  cleanupActive(el, wasSuccess)
   - removes element and schedules spawn of next word
*/
function cleanupActive(el, wasSuccess){
  if(!el) return;
  const typedLine = el.querySelector('.typed-line');
  if(typedLine) typedLine.animate([{ opacity:1 }, { opacity:0 }], { duration:320, fill:'forwards' });
  setTimeout(()=> {
    if(document.body.contains(el)) el.remove();
    if(state.activeWordEl === el) state.activeWordEl = null;
    state.activeAnimation = null;
    setTimeout(()=> spawnWord(), 260);
  }, 260);
}

/* ---------- Floating +$ text ---------- */
function spawnFloating(text, nearEl=null){
  const el = document.createElement('div');
  el.className = 'floating';
  el.textContent = text;
  Object.assign(el.style, {
    position: 'absolute',
    fontWeight: 800,
    color: '#b85b00',
    pointerEvents: 'none',
    zIndex: 70,
    opacity: '1'
  });

  // position near element if provided, otherwise center-ish
  if(nearEl && nearEl.getBoundingClientRect){
    const rect = nearEl.getBoundingClientRect();
    el.style.left = (rect.left + rect.width/2) + 'px';
    el.style.top  = (rect.top + rect.height/2 - 18) + 'px';
  } else {
    el.style.left = (window.innerWidth/2 + (Math.random()*160 - 80)) + 'px';
    el.style.top = (window.innerHeight*0.35 + (Math.random()*60 - 30)) + 'px';
  }

  floatingContainer.appendChild(el);
  const anim = el.animate([
    { transform: 'translateY(0)', opacity: 1 },
    { transform: 'translateY(-70px)', opacity: 0 }
  ], { duration: 900 + Math.random()*200, easing: 'cubic-bezier(.2,.8,.2,1)'});
  anim.onfinish = ()=> el.remove();
}

/* ---------- Input handling (typed keys) ---------- */
window.addEventListener('keydown', (e) => {
  if(!menuModal.classList.contains('hidden')) return;

  // If no active word exists, ignore typed characters except spawn a word maybe
  if(e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
    state.typed += e.key;
    try{ typeSfx && typeSfx.play().catch(()=>{}); }catch{}
    renderTypedForActive();
  } else if(e.key === 'Backspace'){
    e.preventDefault();
    state.typed = state.typed.slice(0, -1);
    renderTypedForActive();
  } else if(e.key === 'Enter'){
    submitActive();
  } else if(e.key === 'Escape'){
    state.typed = '';
    renderTypedForActive();
  }
});

/* ---------- Upgrades UI and purchase ---------- */
function upgradeCost(u){ return Math.ceil(u.baseCost * Math.pow(1.6, u.level)); }
function renderUpgrades(){
  upgradesEl.innerHTML = '';
  state.upgrades.forEach(u => {
    const cost = upgradeCost(u);
    const div = document.createElement('div');
    div.className = 'upgrade';
    div.innerHTML = `
      <div class="u-thumb"><img src="${u.img}" alt="${u.name}" class="placeholder-img" style="max-width:48px"></div>
      <div class="u-info">
        <div class="u-title">${u.name} <small style="color:#666;font-weight:700">(lvl ${u.level})</small></div>
        <div class="u-desc">${u.desc}</div>
      </div>
      <div class="u-buy">
        <div style="font-weight:900">${cost}$</div>
        <button class="btn buy-btn" data-id="${u.id}">Buy</button>
      </div>
    `;
    upgradesEl.appendChild(div);
  });
  upgradesEl.querySelectorAll('.buy-btn').forEach(b => {
    b.addEventListener('click', (ev) => buyUpgrade(b.dataset.id));
  });
}
function buyUpgrade(id){
  const u = state.upgrades.find(x=>x.id===id);
  if(!u) return;
  const cost = upgradeCost(u);
  if(state.dollars < cost){ feedback('Not enough dollars', 'crimson'); return; }
  state.dollars -= cost;
  u.level++;
  // If combo-step upgrade bought, nothing else needed: getEffectiveComboStep reads from state.upgrades
  updateHUD();
  autosaveNow();
  feedback(`Bought ${u.name}`);
}

/* ---------- Persistence (save/load/export/import) ---------- */
function getSave(){
  return {
    dollars: state.dollars,
    basePerWord: state.basePerWord,
    upgrades: state.upgrades.map(u=>({id:u.id, level:u.level})),
    combo: state.combo,
    lastCorrect: state.lastCorrect
  };
}
function saveToLocal(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(getSave())); }catch(e){ console.warn('save', e); }
}
function loadFromLocal(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(typeof d.dollars === 'number') state.dollars = d.dollars;
    if(Array.isArray(d.upgrades)){
      state.upgrades.forEach(u=>{
        const found = d.upgrades.find(x=>x.id===u.id);
        u.level = found ? (found.level||0) : 0;
      });
    }
    if(typeof d.combo === 'number') state.combo = d.combo;
    if(typeof d.lastCorrect === 'number') state.lastCorrect = d.lastCorrect;
    updateHUD();
    return true;
  }catch(e){ console.warn('load', e); return false; }
}
function exportSave(){ const text = JSON.stringify(getSave(), null, 2); navigator.clipboard?.writeText(text).then(()=> feedback('Save copied')); }
function importSaveFromArea(){ try{ const txt = importArea.value.trim(); if(!txt){ feedback('Paste JSON'); return; } const d = JSON.parse(txt); if(typeof d.dollars!=='number') throw new Error('bad'); state.dollars = d.dollars; if(Array.isArray(d.upgrades)){ state.upgrades.forEach(u=>{ const f = d.upgrades.find(x=>x.id===u.id); u.level = f ? (f.level||0) : 0; }); } state.combo = typeof d.combo==='number' ? d.combo : 0; state.lastCorrect = typeof d.lastCorrect==='number' ? d.lastCorrect : 0; updateHUD(); feedback('Imported'); autosaveNow(); }catch(e){ feedback('Invalid JSON', 'crimson'); } }
function resetProgress(){ if(!confirm('Reset all progress?')) return; state.dollars = 0; state.basePerWord = 1; state.upgrades.forEach(u=>u.level=0); state.combo = 0; state.lastCorrect = 0; saveToLocal(); updateHUD(); feedback('Progress reset'); }

/* ---------- Feedback (ephemeral message) ---------- */
function feedback(msg, color=''){
  const fb = document.createElement('div');
  fb.textContent = msg;
  fb.style.position = 'fixed';
  fb.style.right = '28px';
  fb.style.top = '28px';
  fb.style.background = 'rgba(10,10,10,0.85)';
  fb.style.color = '#fff';
  fb.style.padding = '8px 12px';
  fb.style.borderRadius = '8px';
  fb.style.zIndex = 200;
  document.body.appendChild(fb);
  setTimeout(()=> fb.animate([{opacity:1},{opacity:0}], {duration:600}).onfinish = ()=> fb.remove(), 900);
}

/* ---------- Autosave ---------- */
let autosaveTimeout;
function autosaveNow(){ saveToLocal(); clearTimeout(autosaveTimeout); autosaveTimeout = setTimeout(autosaveNow, AUTOSAVE_INTERVAL_MS); }

/* ---------- Menu handlers ---------- */
function openMenu(){ menuModal.classList.remove('hidden'); menuModal.setAttribute('aria-hidden','false'); }
function closeMenu(){ menuModal.classList.add('hidden'); menuModal.setAttribute('aria-hidden','true'); }
openMenuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
manualSaveBtn.addEventListener('click', ()=>{ saveToLocal(); feedback('Saved'); });
manualLoadBtn.addEventListener('click', ()=>{ const ok = loadFromLocal(); feedback(ok ? 'Loaded' : 'No save found'); });
exportBtn.addEventListener('click', exportSave);
importBtn.addEventListener('click', importSaveFromArea);
resetBtn.addEventListener('click', resetProgress);

/* ---------- Audio toggle ---------- */
audioToggleBtn.addEventListener('click', ()=>{
  state.ambientOn = !state.ambientOn;
  if(state.ambientOn) try{ ambientAudio.play().catch(()=>{}); }catch{} else ambientAudio.pause();
  audioToggleBtn.classList.toggle('active', state.ambientOn);
});

/* ---------- Wrong-border flash helper (no CSS edits required) ---------- */
function flashPlayAreaBorder(){
  // animate a temporary box-shadow on playArea to indicate error
  const prevBoxShadow = playArea.style.boxShadow;
  playArea.animate([
    { boxShadow: '0 0 0 0 rgba(255,0,0,0.0)' },
    { boxShadow: '0 0 18px 6px rgba(255,0,0,0.85)' },
    { boxShadow: '0 0 0 0 rgba(255,0,0,0.0)' }
  ], { duration: 420, easing: 'ease-out' });
  // also set a quick red outline so it reads if user has dev CSS overriding boxShadow
  playArea.style.outline = '3px solid rgba(255,0,0,0.65)';
  setTimeout(()=> { playArea.style.outline = ''; playArea.style.boxShadow = prevBoxShadow || ''; }, 420);
}

/* ---------- Golden particle burst (inline-styled particles, no CSS changes) ---------- */
function spawnGoldenParticlesAtElement(el, count=12){
  if(!el || !playArea) return;
  const bubble = el.querySelector('.word-bubble');
  if(!bubble) return;
  const bubbleRect = bubble.getBoundingClientRect();
  const containerRect = playArea.getBoundingClientRect();
  const cx = bubbleRect.left - containerRect.left + bubbleRect.width/2;
  const cy = bubbleRect.top - containerRect.top + bubbleRect.height/2;

  for(let i=0;i<count;i++){
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.width = '8px';
    p.style.height = '8px';
    p.style.borderRadius = '50%';
    p.style.pointerEvents = 'none';
    p.style.zIndex = 80;
    p.style.background = (i%2===0) ? '#ffd166' : '#fff7d6';
    playArea.appendChild(p);

    // random trajectory
    const angle = Math.random()*Math.PI*2;
    const dist = 40 + Math.random()*90;
    const dx = Math.cos(angle)*dist;
    const dy = Math.sin(angle)*dist - 10;

    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0 }
    ], { duration: 700 + Math.random()*300, easing: 'cubic-bezier(.2,.8,.2,1)' })
    .onfinish = () => p.remove();
  }
}

/* ---------- spawn floating $ and other helpers ---------- */
function spawnFloating(text, nearEl=null){
  const el = document.createElement('div');
  el.className = 'floating';
  el.textContent = text;
  Object.assign(el.style, {
    position: 'absolute',
    fontWeight: 800,
    color: '#b85b00',
    pointerEvents: 'none',
    zIndex: 70,
    opacity: '1',
    left: (window.innerWidth/2) + 'px',
    top: (window.innerHeight*0.35) + 'px'
  });

  // position near element if provided
  if(nearEl && nearEl.getBoundingClientRect){
    const rect = nearEl.getBoundingClientRect();
    el.style.left = (rect.left + rect.width/2) + 'px';
    el.style.top = (rect.top + rect.height/2 - 18) + 'px';
  } else {
    el.style.left = (window.innerWidth/2 + (Math.random()*160 - 80)) + 'px';
    el.style.top = (window.innerHeight*0.35 + (Math.random()*60 - 30)) + 'px';
  }

  floatingContainer.appendChild(el);
  const anim = el.animate([
    { transform:'translateY(0)', opacity:1 },
    { transform:'translateY(-70px)', opacity:0 }
  ], { duration:900 + Math.random()*200, easing:'cubic-bezier(.2,.8,.2,1)'});
  anim.onfinish = ()=> el.remove();
}

/* ---------- Upgrades rendering (initial) ---------- */
function renderUpgrades(){
  upgradesEl.innerHTML = '';
  state.upgrades.forEach(u => {
    const cost = upgradeCost(u);
    const div = document.createElement('div');
    div.className = 'upgrade';
    div.innerHTML = `
      <div class="u-thumb"><img src="${u.img}" alt="${u.name}" class="placeholder-img" style="max-width:48px"></div>
      <div class="u-info">
        <div class="u-title">${u.name} <small style="color:#666;font-weight:700">(lvl ${u.level})</small></div>
        <div class="u-desc">${u.desc}</div>
      </div>
      <div class="u-buy">
        <div style="font-weight:900">${cost}$</div>
        <button class="btn buy-btn" data-id="${u.id}">Buy</button>
      </div>
    `;
    upgradesEl.appendChild(div);
  });
  upgradesEl.querySelectorAll('.buy-btn').forEach(b => {
    b.addEventListener('click', (ev) => buyUpgrade(b.dataset.id));
  });
}
function upgradeCost(u){ return Math.ceil(u.baseCost * Math.pow(1.6, u.level)); }
function buyUpgrade(id){
  const u = state.upgrades.find(x=>x.id===id);
  if(!u) return;
  const cost = upgradeCost(u);
  if(state.dollars < cost){ feedback('Not enough dollars', 'crimson'); return; }
  state.dollars -= cost;
  u.level++;
  updateHUD();
  autosaveNow();
  feedback(`Bought ${u.name}`);
}

/* ---------- save/load/export/import/reset ---------- */
// (same as before)
function resetProgress(){ if(!confirm('Reset all progress?')) return; state.dollars = 0; state.basePerWord = 1; state.upgrades.forEach(u=>u.level=0); state.combo = 0; state.lastCorrect = 0; saveToLocal(); updateHUD(); feedback('Progress reset'); }
function getSave(){ return { dollars: state.dollars, basePerWord: state.basePerWord, upgrades: state.upgrades.map(u=>({id:u.id, level:u.level})), combo: state.combo, lastCorrect: state.lastCorrect }; }
function saveToLocal(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(getSave())); }catch(e){ console.warn('save', e); } }
function loadFromLocal(){ try{ const raw = localStorage.getItem(SAVE_KEY); if(!raw) return false; const d = JSON.parse(raw); if(typeof d.dollars === 'number') state.dollars = d.dollars; if(Array.isArray(d.upgrades)){ state.upgrades.forEach(u=>{ const found = d.upgrades.find(x=>x.id===u.id); u.level = found ? (found.level||0) : 0; }); } if(typeof d.combo === 'number') state.combo = d.combo; if(typeof d.lastCorrect === 'number') state.lastCorrect = d.lastCorrect; updateHUD(); return true; }catch(e){ console.warn('load', e); return false; } }
function exportSave(){ const text = JSON.stringify(getSave(), null, 2); navigator.clipboard?.writeText(text).then(()=> feedback('Save copied')); }
function importSaveFromArea(){ try{ const txt = importArea.value.trim(); if(!txt){ feedback('Paste JSON'); return; } const d = JSON.parse(txt); if(typeof d.dollars!=='number') throw new Error('bad'); state.dollars = d.dollars; if(Array.isArray(d.upgrades)){ state.upgrades.forEach(u=>{ const f = d.upgrades.find(x=>x.id===u.id); u.level = f ? (f.level||0) : 0; }); } state.combo = typeof d.combo==='number' ? d.combo : 0; state.lastCorrect = typeof d.lastCorrect==='number' ? d.lastCorrect : 0; updateHUD(); feedback('Imported'); autosaveNow(); }catch(e){ feedback('Invalid JSON', 'crimson'); } }

/* ---------- misc handlers ---------- */
openMenuBtn.addEventListener('click', ()=>{ menuModal.classList.remove('hidden'); menuModal.setAttribute('aria-hidden','false'); });
closeMenuBtn.addEventListener('click', ()=>{ menuModal.classList.add('hidden'); menuModal.setAttribute('aria-hidden','true'); });
manualSaveBtn.addEventListener('click', ()=>{ saveToLocal(); feedback('Saved'); });
manualLoadBtn.addEventListener('click', ()=>{ const ok = loadFromLocal(); feedback(ok ? 'Loaded' : 'No save found'); });
exportBtn.addEventListener('click', exportSave);
importBtn.addEventListener('click', importSaveFromArea);
resetBtn.addEventListener('click', resetProgress);

audioToggleBtn.addEventListener('click', ()=>{
  state.ambientOn = !state.ambientOn;
  if(state.ambientOn) try{ ambientAudio.play().catch(()=>{}); }catch{} else ambientAudio.pause();
  audioToggleBtn.classList.toggle('active', state.ambientOn);
});

/* ---------- boot ---------- */
async function init(){
  await loadWords();
  loadFromLocal();
  renderUpgrades();
  updateHUD();
  // spawn first word immediately
  await spawnWord();
  // autosave loop
  autosaveTimeout = setTimeout(autosaveNow, AUTOSAVE_INTERVAL_MS);
}
init();

// Expose for debugging (keeps your original convenience)
window._typingClicker = {
  state, spawnWord, saveToLocal, loadFromLocal, exportSave, importSaveFromArea, resetProgress
};
