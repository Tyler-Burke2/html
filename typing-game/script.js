/* script.js - updated with 3 upgrades and stats in menu */

const DEFAULT_WORDS = ["temple","wilds","ancient","compass","whisper","starlight","meadow","journey","sapphire","summit","lantern","quest","guardian","voyage","echo","timber","harbor","mystic","horizon","sanctum"];
const SAVE_KEY = 'typing-clicker-bright-v1';
const AUTOSAVE_INTERVAL_MS = 10000;
const WORD_DURATION_MS = 6000;

// Base values
const BASE_GOLDEN_CHANCE = 0.05;
const BASE_COMBO_STEP = 0.1;
const MULTIPLIER_MAX = 5.0;

// State
let state = {
  dollars: 0,
  basePerWord: 1,
  upgrades: [
    { id: 'plus1', name: '+1 $/word', desc: 'Add +1 dollar per word', baseCost: 25, add: 1, level: 0, img: 'images/icon_stack_2.png' },
    { id: 'golden', name: 'Golden Chance +1%', desc: 'Increase chance of golden words by 1%', baseCost: 100, add: 0.01, level: 0, img: 'images/icon_stack_2.png' },
    { id: 'combo-step', name: 'Combo Growth +0.1', desc: 'Increase combo growth per word by +0.1', baseCost: 200, add: 0.1, level: 0, img: 'images/icon_stack_2.png' }
  ],
  words: [],
  activeWordEl: null,
  activeAnimation: null,
  typed: '',
  combo: 0,
  lastCorrect: 0,
  autosaveTimeout: null,
  ambientOn: false,
  isProcessing: false
};

// DOM
const playArea = document.getElementById('play-area');
const floatingContainer = document.getElementById('floating-container');

const dollarsEl = document.getElementById('dollars');
const perWordEl = document.getElementById('per-word');
const goldenChanceEl = document.getElementById('golden-chance');
const comboGrowthEl = document.getElementById('combo-growth');
const comboEl = document.getElementById('combo');
const multiplierEl = document.getElementById('multiplier');
const upgradesEl = document.getElementById('upgrades');

const menuModal = document.getElementById('menu-modal');
const openMenuBtn = document.getElementById('open-menu');
const closeMenuBtn = document.getElementById('close-menu');
const manualSaveBtn = document.getElementById('manual-save');
const manualLoadBtn = document.getElementById('manual-load');
const exportBtn = document.getElementById('export-save');
const importBtn = document.getElementById('import-save');
const importArea = document.getElementById('import-area');
const menuResetBtn = document.getElementById('menu-reset');

const statsModal = document.getElementById('stats-modal');
const openStatsBtn = document.getElementById('open-stats');
const closeStatsBtn = document.getElementById('close-stats');

const confirmModal = document.getElementById('confirm-modal');
const confirmYes = document.getElementById('confirm-reset-yes');
const confirmNo = document.getElementById('confirm-reset-no');

const ambientAudio = document.getElementById('ambient-audio');
const typeSfx = document.getElementById('type-sfx');
const successSfx = document.getElementById('success-sfx');
const audioToggleBtn = document.getElementById('audio-toggle');

// Utilities
function now(){ return Date.now(); }
function fmt(n){ return Math.floor(n); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Load external words.json if present
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

// Calculations
function calcPerWord(){
  let per = state.basePerWord;
  const up = state.upgrades.find(u => u.id === 'plus1');
  if(up && up.level) per += up.add * up.level;
  return per;
}

function getGoldenChance(){
  const up = state.upgrades.find(u => u.id === 'golden');
  let chance = BASE_GOLDEN_CHANCE;
  if(up && up.level) chance += up.add * up.level;
  return Math.min(chance, 1.0); // cap at 100%
}

function getComboStep(){
  let step = BASE_COMBO_STEP;
  const up = state.upgrades.find(u => u.id === 'combo-step');
  if(up && up.level) step += up.add * up.level;
  return step;
}

function getMultiplierForCombo(combo){
  if(combo <= 1) return 1.0;
  const step = getComboStep();
  const mult = 1 + (combo - 1) * step;
  return Math.min(mult, MULTIPLIER_MAX);
}

function updateHUD(){
  dollarsEl.textContent = fmt(state.dollars);
  perWordEl.textContent = fmt(calcPerWord());
  goldenChanceEl.textContent = Math.round(getGoldenChance() * 100) + '%';
  comboGrowthEl.textContent = getComboStep().toFixed(2);
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
async function spawnWord(){
  if(state.activeWordEl || state.isProcessing) return;
  if(!state.words || state.words.length === 0) state.words = DEFAULT_WORDS.slice();

  const word = state.words[Math.floor(Math.random()*state.words.length)];
  const isGolden = (Math.random() < getGoldenChance());

  const el = document.createElement('div');
  el.className = 'moving-word';
  el.innerHTML = `
    <div class="word-bubble" aria-hidden="true">${escapeHtml(word)}</div>
    <div class="typed-line" aria-hidden="true"></div>
  `;
  playArea.appendChild(el);

  el.dataset.word = word;
  el.dataset.golden = isGolden ? '1' : '0';
  el.dataset.handled = '0';

  const areaWidth = playArea.clientWidth;
  const wordBubble = el.querySelector('.word-bubble');
  const measuredWidth = el.offsetWidth || wordBubble.offsetWidth || 120;

  if(isGolden){
    wordBubble.classList.add('golden');
  }

  el.style.left = areaWidth + 'px';
  el.style.top = '50%';
  el.style.transform = 'translateY(-50%)';

  const startLeft = areaWidth;
  const endLeft = -measuredWidth - 8;

  const anim = el.animate([
    { left: startLeft + 'px' },
    { left: endLeft + 'px' }
  ], {
    duration: WORD_DURATION_MS,
    easing: 'linear',
    fill: 'forwards'
  });

  state.activeWordEl = el;
  state.activeAnimation = anim;

  anim.onfinish = () => {
    if(document.body.contains(el) && el.dataset.handled === '0'){
      flashPlayAreaBorder();
      playHugeCenterExplosion(el.dataset.word || '');
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
function submitActive(){
  const el = state.activeWordEl;
  if(!el){
    feedback('No active word', 'crimson');
    return;
  }

  state.isProcessing = true;
  el.dataset.handled = '1';
  state.activeWordEl = null;
  const anim = state.activeAnimation;
  state.activeAnimation = null;

  const target = el.dataset.word || '';
  const candidate = (state.typed || '').trim();
  state.typed = '';

  if(candidate.length === 0){
    feedback('Type first', 'crimson');
    state.isProcessing = false;
    return;
  }

  if(candidate === target){
    // SUCCESS
    state.combo = state.combo + 1;
    state.lastCorrect = now();
    const mult = getMultiplierForCombo(state.combo);
    const per = calcPerWord();
    let gained = Math.round(per * mult);

    if(el.dataset.golden === '1'){
      gained = gained * 3;
    }

    state.dollars += Math.max(1, gained);
    updateHUD();
    spawnFloating(`+${gained} $`, el);

    try{ successSfx && successSfx.play().catch(()=>{}); }catch{}

    const bubble = el.querySelector('.word-bubble');
    bubble?.classList.add('flash-correct');

    if(el.dataset.golden === '1'){
      spawnGoldenParticlesAtElement(el, 18);
      bubble && (bubble.style.transform = 'scale(1.04)');
      setTimeout(()=> { if(bubble) bubble.style.transform = ''; }, 400);
    }

    if(anim){
      try{
        anim.playbackRate = 1.8;
      } catch(e){
        try{ anim.cancel(); }catch{}
        const endLeft = - (el.offsetWidth || 120) - 8;
        const currentLeft = parseFloat(getComputedStyle(el).left) || 0;
        const fast = el.animate([
          { left: currentLeft + 'px' },
          { left: endLeft + 'px' }
        ], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        fast.onfinish = () => cleanupActive(el, true);
      }
      anim.onfinish = () => cleanupActive(el, true);
    } else {
      cleanupActive(el, true);
    }

    const multAfter = getMultiplierForCombo(state.combo);
    if(multAfter >= MULTIPLIER_MAX){
      const comboNumEl = document.querySelector('.combo-num');
      if(comboNumEl) comboNumEl.classList.add('maxed');
      spawnFloating('MAX 5.0×!', el);
    }

  } else {
    // WRONG
    state.combo = 0;
    state.lastCorrect = 0;
    updateHUD();
    feedback('Wrong – combo reset', 'crimson');

    try{ if(anim) anim.cancel(); } catch(e){}
    flashPlayAreaBorder();
    playHugeCenterExplosion(target || el.dataset.word || '');
    handleMiss(el, el.dataset.word, true);
  }
}

function handleMiss(el, word, force=false){
  if(!el || !document.body.contains(el)) return;
  el.dataset.handled = '1';

  const bubble = el.querySelector('.word-bubble');
  const text = word || (el.dataset && el.dataset.word) || '';

  if(bubble) bubble.style.visibility = 'hidden';

  const bubbleRect = bubble ? bubble.getBoundingClientRect() : el.getBoundingClientRect();
  const containerRect = playArea.getBoundingClientRect();

  for(let i=0;i<Math.min(6, text.length);i++){
    const p = document.createElement('div');
    p.className = 'piece';
    p.textContent = text[i];
    playArea.appendChild(p);

    const startLeft = bubbleRect.left - containerRect.left + (bubbleRect.width/2);
    const startTop = bubbleRect.top - containerRect.top + (bubbleRect.height/2);
    p.style.left = startLeft + 'px';
    p.style.top = startTop + 'px';

    const angle = (Math.random()*Math.PI*2);
    const dist = 40 + Math.random()*80;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 20;
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity:1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${(Math.random()*360-180)}deg)`, opacity:0 }
    ], { duration: 700 + Math.random()*300, easing: 'cubic-bezier(.2,.8,.2,1)' })
    .onfinish = () => p.remove();
  }

  const typedLine = el.querySelector('.typed-line');
  if(typedLine){
    typedLine.animate([{ opacity:1 }, { opacity:0 }], { duration:500, fill:'forwards' });
  }

  state.combo = 0;
  state.lastCorrect = 0;
  updateHUD();

  setTimeout(()=> {
    if(document.body.contains(el)) el.remove();
    if(state.activeWordEl === el) state.activeWordEl = null;
    state.activeAnimation = null;
    state.isProcessing = false;
    setTimeout(()=> spawnWord(), 380);
  }, 780);
}

function cleanupActive(el, wasSuccess){
  if(!el) return;
  const typedLine = el.querySelector('.typed-line');
  if(typedLine) typedLine.animate([{ opacity:1 }, { opacity:0 }], { duration:320, fill:'forwards' });
  setTimeout(()=> {
    if(document.body.contains(el)) el.remove();
    if(state.activeWordEl === el) state.activeWordEl = null;
    state.activeAnimation = null;
    state.isProcessing = false;
    setTimeout(()=> spawnWord(), 320);
  }, 320);
}

/* ---------- Huge center explosion ---------- */
function playHugeCenterExplosion(text){
  if(!playArea) return;
  const containerRect = playArea.getBoundingClientRect();
  const cx = containerRect.width / 2;
  const cy = containerRect.height / 2;

  const letters = String(text || '').split('');
  const count = Math.max(10, (letters.length * 2));
  for(let i=0;i<count;i++){
    const ch = letters.length ? letters[i % letters.length] : String.fromCharCode(65 + (i % 26));
    const p = document.createElement('div');
    p.className = 'center-piece-large';
    p.textContent = ch;
    p.style.fontSize = Math.min(220, Math.max(140, Math.round(containerRect.width * 0.12))) + 'px';
    if(Math.random() < 0.08) p.classList.add('golden');

    playArea.appendChild(p);

    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.transform = 'translate(-50%,-50%) scale(1)';
    p.style.opacity = '1';

    const angle = (Math.random()*Math.PI*2);
    const dist = 140 + Math.random()*320;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - (Math.random()*40);
    const rotate = (Math.random()*360-180);
    const dur = 900 + Math.random()*900;

    const keyframes = [
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity:1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4) rotate(${rotate}deg)`, opacity:0 }
    ];

    p.animate(keyframes, { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' })
     .onfinish = () => p.remove();
  }
}

/* ---------- Floating text (+$) slowed 3x ---------- */
function spawnFloating(text, nearEl=null){
  const el = document.createElement('div');
  el.className = 'floating';
  el.textContent = text;
  Object.assign(el.style, {
    position: 'absolute',
    fontWeight: 800,
    color: '#ffd166',
    pointerEvents: 'none',
    zIndex: 200,
    opacity: '1',
    transform: 'translate(-50%, 0)'
  });

  if(nearEl && nearEl.getBoundingClientRect){
    const rect = nearEl.getBoundingClientRect();
    el.style.left = (rect.left + rect.width/2) + 'px';
    el.style.top  = (rect.top + rect.height/2 - 18) + 'px';
  } else {
    el.style.left = (window.innerWidth/2 + (Math.random()*160 - 80)) + 'px';
    el.style.top = (window.innerHeight*0.35 + (Math.random()*60 - 30)) + 'px';
  }

  floatingContainer.appendChild(el);

  const baseDuration = 900 + Math.random()*300;
  const dur = baseDuration * 3;

  const anim = el.animate([
    { transform: 'translate(-50%, 0) scale(1)', opacity: 1 },
    { transform: 'translate(-50%, -140px) scale(1.08)', opacity: 0 }
  ], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)'});
  anim.onfinish = ()=> el.remove();
}

/* ---------- Input handling ---------- */
window.addEventListener('keydown', (e) => {
  if(!menuModal.classList.contains('hidden') || !statsModal.classList.contains('hidden') || !confirmModal.classList.contains('hidden')) return;

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

/* ---------- Upgrades ---------- */
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
    b.addEventListener('click', () => buyUpgrade(b.dataset.id));
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

/* ---------- Persistence ---------- */
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

function exportSave(){ 
  const text = JSON.stringify(getSave(), null, 2); 
  navigator.clipboard?.writeText(text).then(()=> feedback('Save copied')); 
}

function importSaveFromArea(){ 
  try{ 
    const txt = importArea.value.trim(); 
    if(!txt){ feedback('Paste JSON'); return; } 
    const d = JSON.parse(txt); 
    if(typeof d.dollars!=='number') throw new Error('bad'); 
    state.dollars = d.dollars; 
    if(Array.isArray(d.upgrades)){ 
      state.upgrades.forEach(u=>{ 
        const f = d.upgrades.find(x=>x.id===u.id); 
        u.level = f ? (f.level||0) : 0; 
      }); 
    } 
    state.combo = typeof d.combo==='number' ? d.combo : 0; 
    state.lastCorrect = typeof d.lastCorrect==='number' ? d.lastCorrect : 0; 
    updateHUD(); 
    feedback('Imported'); 
    autosaveNow(); 
  }catch(e){ 
    feedback('Invalid JSON', 'crimson'); 
  } 
}

function doResetAll(){
  state.dollars = 0; 
  state.basePerWord = 1; 
  state.upgrades.forEach(u=>u.level=0); 
  state.combo = 0; 
  state.lastCorrect = 0; 
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  saveToLocal(); 
  updateHUD(); 
  feedback('Progress reset');
}

/* ---------- Reset handlers ---------- */
function openConfirmReset(){
  confirmModal.classList.remove('hidden');
  confirmModal.setAttribute('aria-hidden','false');
}
function closeConfirmReset(){
  confirmModal.classList.add('hidden');
  confirmModal.setAttribute('aria-hidden','true');
}

menuResetBtn?.addEventListener('click', ()=> {
  openConfirmReset();
});
confirmNo.addEventListener('click', ()=> {
  closeConfirmReset();
});
confirmYes.addEventListener('click', ()=> {
  closeConfirmReset();
  closeMenu();
  doResetAll();
});

/* ---------- Feedback ---------- */
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
  fb.style.zIndex = 500;
  document.body.appendChild(fb);
  setTimeout(()=> fb.animate([{opacity:1},{opacity:0}], {duration:600}).onfinish = ()=> fb.remove(), 1200);
}

/* ---------- Autosave ---------- */
let autosaveTimeout;
function autosaveNow(){ 
  saveToLocal(); 
  clearTimeout(autosaveTimeout); 
  autosaveTimeout = setTimeout(autosaveNow, AUTOSAVE_INTERVAL_MS); 
}

/* ---------- Menu handlers ---------- */
function openMenu(){ 
  menuModal.classList.remove('hidden'); 
  menuModal.setAttribute('aria-hidden','false'); 
}
function closeMenu(){ 
  menuModal.classList.add('hidden'); 
  menuModal.setAttribute('aria-hidden','true'); 
}
openMenuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
manualSaveBtn.addEventListener('click', ()=>{ saveToLocal(); feedback('Saved'); });
manualLoadBtn.addEventListener('click', ()=>{ const ok = loadFromLocal(); feedback(ok ? 'Loaded' : 'No save found'); });
exportBtn.addEventListener('click', exportSave);
importBtn.addEventListener('click', importSaveFromArea);

/* ---------- Stats handlers ---------- */
function openStats(){ 
  statsModal.classList.remove('hidden'); 
  statsModal.setAttribute('aria-hidden','false'); 
}
function closeStats(){ 
  statsModal.classList.add('hidden'); 
  statsModal.setAttribute('aria-hidden','true'); 
}
openStatsBtn.addEventListener('click', openStats);
closeStatsBtn.addEventListener('click', closeStats);

/* ---------- Audio toggle ---------- */
audioToggleBtn.addEventListener('click', ()=>{
  state.ambientOn = !state.ambientOn;
  if(state.ambientOn) try{ ambientAudio.play().catch(()=>{}); }catch{} 
  else ambientAudio.pause();
  audioToggleBtn.classList.toggle('active', state.ambientOn);
});

/* ---------- Visual effects ---------- */
function flashPlayAreaBorder(){
  playArea.classList.add('flash-border');
  setTimeout(()=> playArea.classList.remove('flash-border'), 800);
}

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
    p.style.zIndex = 180;
    p.style.background = (i%2===0) ? '#ffd166' : '#fff7d6';
    playArea.appendChild(p);

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

/* ---------- Initialization ---------- */
async function init(){
  await loadWords();
  loadFromLocal();
  renderUpgrades();
  updateHUD();
  await spawnWord();
  autosaveTimeout = setTimeout(autosaveNow, AUTOSAVE_INTERVAL_MS);
}

init();

// Debug access
window._typingClicker = {
  state, spawnWord, saveToLocal, loadFromLocal, exportSave, importSaveFromArea, doResetAll
};