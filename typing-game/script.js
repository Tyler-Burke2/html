/*
 Bright Adventure version
 - moving word across screen every ~5s (fixed).
 - typed letters appear beneath moving word; Enter to submit.
 - correct => combo increments, multiplier += 0.1 per correct (first word = regular),
   multiplier capped at 5.0x. Wrong or miss => combo resets to 0 (multiplier = 1.0).
 - correct words speed off at 3x; missed words break apart.
 - autosave + manual save/load modal.
 - floating +$ on correct hits and combo max glow.
*/

const DEFAULT_WORDS = ["temple","wilds","ancient","compass","whisper","starlight","meadow","journey","sapphire","summit","lantern","quest","guardian","voyage","echo","timber","harbor","mystic","horizon","sanctum"];
const SAVE_KEY = 'typing-clicker-bright-v1';
const AUTOSAVE_INTERVAL_MS = 10000;
const WORD_DURATION_MS = 5000; // fixed time for a word to traverse
const SPEED_OFF_FACTOR = 3; // correct words speed off at 3x
const MULTIPLIER_STEP = 0.1;
const MULTIPLIER_MAX = 5.0;

// State
let state = {
  dollars: 0,
  basePerWord: 1,
  upgrades: [
    { id: 'plus1', name: '+1 $/word', desc: 'Add +1 dollar per word', baseCost: 25, add: 1, level: 0, img: 'images/upgrade-plus1.png' },
    { id: 'plus3', name: '+3 $/word', desc: 'Add +3 dollars per word', baseCost: 110, add: 3, level: 0, img: 'images/upgrade-plus3.png' },
    { id: 'combo', name: 'Combo Mastery', desc: 'Increase combo multiplier slightly', baseCost: 260, add: 0, level: 0, img: 'images/upgrade-combo.png' }
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
async function loadWords(){
  try{
    const r = await fetch('words.json', {cache: "no-store"});
    if(!r.ok) throw new Error('fetch fail');
    const data = await r.json();
    state.words = Array.isArray(data.words) && data.words.length ? data.words.slice() : DEFAULT_WORDS.slice();
  }catch(e){
    state.words = DEFAULT_WORDS.slice();
  }
}

function calcPerWord(){
  let per = state.basePerWord;
  state.upgrades.forEach(u => { if(u.add) per += u.add * u.level; });
  return per;
}

// Multiplier: based on combo count such that:
// first correct => combo 1 => multiplier = 1.00 (regular amount).
// second correct => combo 2 => multiplier = 1.10
// so multiplier = 1 + (combo - 1) * MULTIPLIER_STEP, capped at MULTIPLIER_MAX
function getMultiplierForCombo(combo){
  if(combo <= 1) return 1.0;
  const mult = 1 + (combo - 1) * MULTIPLIER_STEP;
  return Math.min(mult, MULTIPLIER_MAX);
}

function updateHUD(){
  dollarsEl.textContent = fmt(state.dollars);
  perWordEl.textContent = fmt(calcPerWord());
  comboEl.textContent = state.combo;
  const mult = getMultiplierForCombo(state.combo);
  multiplierEl.textContent = mult.toFixed(2) + '×';
  // combo glow when near cap or maxed
  const comboNumEl = document.querySelector('.combo-num');
  if(comboNumEl){
    if(mult >= MULTIPLIER_MAX) comboNumEl.classList.add('maxed');
    else comboNumEl.classList.remove('maxed');
  }
  renderUpgrades();
}

// Spawn a single moving word element and animate it across the play area.
// When the animation finishes naturally => miss. If sped off (playbackRate changed) finishes earlier => treat as success already handled.
let spawnTimeout = null;
async function spawnWord(){
  // Only one active word at a time; if one exists, ignore.
  if(state.activeWordEl) return;

  // pick random word
  if(!state.words || state.words.length === 0) state.words = DEFAULT_WORDS.slice();
  const word = state.words[Math.floor(Math.random()*state.words.length)];

  // create element structure
  const el = document.createElement('div');
  el.className = 'moving-word';
  el.innerHTML = `
    <div class="word-bubble" aria-hidden="true">${escapeHtml(word)}</div>
    <div class="typed-line" aria-hidden="true"></div>
  `;
  playArea.appendChild(el);
  state.activeWordEl = el;
  state.typed = '';
  renderTypedForActive();

  // animate using Web Animations API for precise control
  const duration = WORD_DURATION_MS;
  const anim = el.animate([
    { transform: 'translateX(0) translateY(-50%)' },
    { transform: `translateX(${window.innerWidth * 1.4}px) translateY(-50%)` }
  ], {
    duration: duration,
    easing: 'linear',
    fill: 'forwards'
  });

  state.activeAnimation = anim;
  anim.onfinish = () => {
    // animation ended naturally — treat as miss if element still exists
    if(document.body.contains(el)){
      handleMiss(el, word);
    }
  };

  // store word text on element for reference
  el.dataset.word = word;

  // ensure next word spawns only after this one resolves — don't automatically schedule spawn here
  return el;
}

// render typed letters under active word
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

// Escape helper for safe HTML insertion
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Submit handling (Enter pressed)
function submitActive(){
  const el = state.activeWordEl;
  if(!el) { feedback('No active word', 'crimson'); return; }
  const target = el.dataset.word || '';
  const candidate = state.typed.trim();
  if(candidate.length === 0){ feedback('Type first', 'crimson'); return; }

  if(candidate === target){
    // correct!
    // update combo: if previous correct recently? We treat consecutive correct without miss as combo; that's handled by resetting combo on miss.
    state.combo = state.combo + 1;
    state.lastCorrect = now();
    const mult = getMultiplierForCombo(state.combo);
    const per = calcPerWord();
    const gained = Math.round(per * mult);

    state.dollars += Math.max(1, gained);
    updateHUD();
    spawnFloating(`+${gained} $`, el);

    // audio and visual
    try{ successSfx && successSfx.play().catch(()=>{}); }catch{}
    el.querySelector('.word-bubble')?.classList.add('flash-correct');

    // speed off the animation: accelerate playbackRate (if supported) or cancel and animate to end quickly
    const anim = state.activeAnimation;
    if(anim){
      // try altering playbackRate
      try{
        anim.playbackRate = SPEED_OFF_FACTOR;
      }catch(e){
        // fallback: cancel and animate a fast exit
        anim.cancel();
        const fast = el.animate([
          { transform: getComputedStyle(el).transform || 'translateX(0) translateY(-50%)' },
          { transform: `translateX(${window.innerWidth * 1.4}px) translateY(-50%)` }
        ], { duration: Math.max(140, WORD_DURATION_MS / SPEED_OFF_FACTOR), easing: 'cubic-bezier(.2,.8,.2,1)', fill:'forwards' });
        fast.onfinish = () => cleanupActive(true);
      }
      // when the accelerated animation finishes it will call onfinish; but we also want to cleanup sooner
      anim.onfinish = () => cleanupActive(true);
    } else {
      // no anim object — just remove quickly
      cleanupActive(true);
    }

    // update HUD (multiplier display)
    updateHUD();

    // if reached cap, special visual
    const multAfter = getMultiplierForCombo(state.combo);
    if(multAfter >= MULTIPLIER_MAX){
      // show a small glow on combo element
      const comboNumEl = document.querySelector('.combo-num');
      if(comboNumEl) comboNumEl.classList.add('maxed');
      spawnFloating('MAX 5.0×!', el);
    }

  } else {
    // wrong submission
    state.combo = 0;
    state.lastCorrect = 0;
    updateHUD();
    feedback('Wrong — combo reset', 'crimson');
    // optional: break word as if it was missed
    const anim = state.activeAnimation;
    if(anim){
      anim.cancel();
    }
    handleMiss(el, el.dataset.word, true);
  }
}

// When a word reaches the right edge or is forced to miss
function handleMiss(el, word, force=false){
  // prevent double handling
  if(!document.body.contains(el)) return;
  // show break apart pieces
  const bubble = el.querySelector('.word-bubble');
  const text = word;
  bubble.style.visibility = 'hidden';

  // create pieces for each character and animate them outward
  const pieces = [];
  for(let i=0;i<text.length;i++){
    const p = document.createElement('div');
    p.className = 'piece';
    p.textContent = text[i];
    playArea.appendChild(p);
    // position near the bubble's center
    const rect = bubble.getBoundingClientRect();
    p.style.left = rect.left + (rect.width/2) + 'px';
    p.style.top = rect.top + (rect.height/2) + 'px';
    pieces.push(p);
    // animate piece
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

  // fade out typed-line smoothly
  const typedLine = el.querySelector('.typed-line');
  if(typedLine){
    typedLine.animate([{ opacity:1 }, { opacity:0 }], { duration:500, fill:'forwards' });
  }

  // reset combo and multiplier
  state.combo = 0;
  state.lastCorrect = 0;
  updateHUD();

  // remove the word element after short delay
  setTimeout(()=> {
    if(document.body.contains(el)) el.remove();
    state.activeWordEl = null;
    state.activeAnimation = null;
    // spawn next word smoothly
    setTimeout(()=> spawnWord(), 300);
  }, 650);
}

// cleanup after successful run (accelerated exit finished)
function cleanupActive(wasSuccess){
  const el = state.activeWordEl;
  if(!el) return;
  // fade out typed-line
  const typedLine = el.querySelector('.typed-line');
  if(typedLine) typedLine.animate([{ opacity:1 }, { opacity:0 }], { duration:320, fill:'forwards' });
  // remove element after small delay
  setTimeout(()=> {
    if(document.body.contains(el)) el.remove();
    state.activeWordEl = null;
    state.activeAnimation = null;
    // spawn next word immediately
    setTimeout(()=> spawnWord(), 260);
  }, 260);
}

// spawn floating text near the element
function spawnFloating(text, nearEl=null){
  const el = document.createElement('div');
  el.className = 'floating';
  el.textContent = text;
  Object.assign(el.style, {
    position: 'absolute',
    left: `${window.innerWidth/2 + (Math.random()*160 - 80)}px`,
    top: `${window.innerHeight*0.35 + (Math.random()*60 - 30)}px`,
    fontWeight:800,
    color:'#b85b00',
    pointerEvents:'none',
    zIndex:70,
    transform:'translateY(0)',
    opacity:'1'
  });
  floatingContainer.appendChild(el);
  const anim = el.animate([
    { transform:'translateY(0)', opacity:1 },
    { transform:'translateY(-70px)', opacity:0 }
  ], { duration:900 + Math.random()*200, easing:'cubic-bezier(.2,.8,.2,1)'});
  anim.onfinish = ()=> el.remove();
}

// typed input handling (global)
window.addEventListener('keydown', (e) => {
  if(!menuModal.classList.contains('hidden')) return;
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

// Upgrades UI
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
  updateHUD();
  autosaveNow();
  feedback(`Bought ${u.name}`);
}

// Persistence
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

// Feedback
function feedback(msg, color=''){
  // small ephemeral message on top right HUD
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

// Autosave
let autosaveTimeout;
function autosaveNow(){ saveToLocal(); clearTimeout(autosaveTimeout); autosaveTimeout = setTimeout(autosaveNow, AUTOSAVE_INTERVAL_MS); }

// Menu handlers
function openMenu(){ menuModal.classList.remove('hidden'); menuModal.setAttribute('aria-hidden','false'); }
function closeMenu(){ menuModal.classList.add('hidden'); menuModal.setAttribute('aria-hidden','true'); }
openMenuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
manualSaveBtn.addEventListener('click', ()=>{ saveToLocal(); feedback('Saved'); });
manualLoadBtn.addEventListener('click', ()=>{ const ok = loadFromLocal(); feedback(ok ? 'Loaded' : 'No save found'); });
exportBtn.addEventListener('click', exportSave);
importBtn.addEventListener('click', importSaveFromArea);
resetBtn.addEventListener('click', resetProgress);

// Audio toggle
audioToggleBtn.addEventListener('click', ()=>{
  state.ambientOn = !state.ambientOn;
  if(state.ambientOn) try{ ambientAudio.play().catch(()=>{}); }catch{} else ambientAudio.pause();
  audioToggleBtn.classList.toggle('active', state.ambientOn);
});

// boot
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

// Expose for debugging
window._typingClicker = {
  state, spawnWord, saveToLocal, loadFromLocal, exportSave, importSaveFromArea, resetProgress
};
