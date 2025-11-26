/* ========================================
   STAR TYPER - WORDS
   Word loading, spawning, and typing logic
======================================== */

async function loadWords() {
  const banks = ['easy', 'medium', 'hard', 'veryhard', 'expert', 'ufo', 'sentences'];
  
  for (const bank of banks) {
    try {
      const filename = bank === 'veryhard' ? 'json/words-veryhard.json' : `json/words-${bank}.json`;
      const response = await fetch(filename, { cache: "no-store" });
      if (!response.ok) throw new Error('fetch fail');
      const data = await response.json();
      state.words[bank] = Array.isArray(data.words) && data.words.length 
        ? data.words.slice() 
        : DEFAULT_WORDS.slice();
    } catch(e) {
      console.warn(`Failed to load ${bank} words, using defaults`, e);
      state.words[bank] = DEFAULT_WORDS.slice();
    }
  }
}

async function spawnWord() {
  if (state.activeWordEl || state.isProcessing) return;
  
  const sentenceChance = getSentenceChance();
  const goldenChance = getGoldenChance();
  
  let word, isSentence = false, isGolden = false, wordBank = state.currentWordBank;
  
  if (sentenceChance > 0 && Math.random() < sentenceChance) {
    isSentence = true;
    const sentenceList = state.words.sentences.length ? state.words.sentences : DEFAULT_WORDS;
    word = sentenceList[Math.floor(Math.random() * sentenceList.length)];
    
    playArea.classList.remove('sentence-warning');
    void playArea.offsetWidth;
    playArea.classList.add('sentence-warning');
    setTimeout(() => playArea.classList.remove('sentence-warning'), 600);
    
    await new Promise(resolve => setTimeout(resolve, 650));
  }
  else if (Math.random() < goldenChance) {
    isGolden = true;
    const bankOrder = ['easy', 'medium', 'hard', 'veryhard', 'expert'];
    const currentIndex = bankOrder.indexOf(state.currentWordBank);
    
    if (currentIndex === bankOrder.length - 1) {
      wordBank = 'ufo';
    } else {
      wordBank = bankOrder[currentIndex + 1];
    }
    
    const wordList = state.words[wordBank].length ? state.words[wordBank] : DEFAULT_WORDS;
    word = wordList[Math.floor(Math.random() * wordList.length)];
  }
  else {
    const wordList = state.words[state.currentWordBank].length 
      ? state.words[state.currentWordBank] 
      : DEFAULT_WORDS;
    word = wordList[Math.floor(Math.random() * wordList.length)];
  }

  const el = document.createElement('div');
  el.className = 'moving-word';
  el.innerHTML = `
    <div class="word-bubble" aria-hidden="true">${escapeHtml(word)}</div>
    <div class="typed-line" aria-hidden="true"></div>
  `;
  playArea.appendChild(el);

  el.dataset.word = word;
  el.dataset.golden = isGolden ? '1' : '0';
  el.dataset.sentence = isSentence ? '1' : '0';
  el.dataset.handled = '0';

  const areaWidth = playArea.clientWidth;
  const wordBubble = el.querySelector('.word-bubble');
  const measuredWidth = el.offsetWidth || wordBubble.offsetWidth || 120;

  if (isGolden) {
    wordBubble.classList.add('golden');
  } else if (isSentence) {
    wordBubble.classList.add('sentence');
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
    if (document.body.contains(el) && el.dataset.handled === '0') {
      flashPlayAreaBorder();
      playHugeCenterExplosion(el.dataset.word || '', el.dataset.sentence === '1');
      handleMiss(el, word);
    }
  };

  return el;
}

function renderTypedForActive() {
  const el = state.activeWordEl;
  if (!el) return;
  
  const target = el.dataset.word || '';
  const typed = state.typed || '';
  const typedLine = el.querySelector('.typed-line');
  if (!typedLine) return;
  
  let html = '';
  for (let i = 0; i < target.length; i++) {
    const targetChar = target[i];
    const typedChar = typed[i] || '';
    
    if (typedChar === '') {
      html += `<span class="pending">${targetChar}</span>`;
    } else if (typedChar === targetChar) {
      html += `<span class="match">${typedChar}</span>`;
    } else {
      html += `<span class="mismatch">${typedChar}</span>`;
    }
  }
  
  if (typed.length > target.length) {
    for (let j = target.length; j < typed.length; j++) {
      html += `<span class="mismatch">${typed[j]}</span>`;
    }
  }
  
  typedLine.innerHTML = html;
}

function submitActive() {
  const el = state.activeWordEl;
  if (!el) {
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

  if (candidate.length === 0) {
    feedback('Type first', 'crimson');
    state.isProcessing = false;
    return;
  }

  if (candidate === target) {
    handleSuccess(el, anim);
  } else {
    handleWrong(el, anim, target);
  }
}

function handleSuccess(el, anim) {
  state.combo = state.combo + 1;
  state.lastCorrect = now();
  
  const mult = getMultiplierForCombo(state.combo);
  const perLetter = calcPerLetter();
  const word = el.dataset.word || '';
  const letterCount = word.length;
  
  let gained = Math.round(perLetter * letterCount * mult);

  if (el.dataset.golden === '1') {
    gained = gained * 3;
  } else if (el.dataset.sentence === '1') {
    gained = gained * 5;
  }

  state.dollars += Math.max(1, gained);
  updateHUD();
  spawnFloating(`+${gained} $`, el);

  try { 
    successSfx && successSfx.play().catch(() => {}); 
  } catch(e) {}

  const bubble = el.querySelector('.word-bubble');
  bubble?.classList.add('flash-correct');

  if (el.dataset.golden === '1') {
    spawnGoldenParticlesAtElement(el, 18);
    if (bubble) {
      bubble.style.transform = 'scale(1.04)';
      setTimeout(() => { 
        if (bubble) bubble.style.transform = ''; 
      }, 400);
    }
  } else if (el.dataset.sentence === '1') {
    spawnGreenParticlesAtElement(el, 24);
    if (bubble) {
      bubble.style.transform = 'scale(1.06)';
      setTimeout(() => { 
        if (bubble) bubble.style.transform = ''; 
      }, 400);
    }
  }

  if (anim) {
    try {
      anim.playbackRate = 3.6;
    } catch(e) {
      try { 
        anim.cancel(); 
      } catch(e2) {}
      
      const endLeft = -(el.offsetWidth || 120) - 8;
      const currentLeft = parseFloat(getComputedStyle(el).left) || 0;
      const fast = el.animate([
        { left: currentLeft + 'px' },
        { left: endLeft + 'px' }
      ], { 
        duration: 150,
        easing: 'cubic-bezier(.2,.8,.2,1)', 
        fill: 'forwards' 
      });
      fast.onfinish = () => cleanupActive(el, true);
    }
    anim.onfinish = () => cleanupActive(el, true);
  } else {
    cleanupActive(el, true);
  }

  const maxMult = getMaxMultiplier();
  const multAfter = getMultiplierForCombo(state.combo);
  if (multAfter >= maxMult) {
    const comboNumEl = document.querySelector('.combo-num');
    if (comboNumEl) comboNumEl.classList.add('maxed');
    spawnFloating(`MAX ${maxMult.toFixed(1)}×!`, el);
  }
}

function handleWrong(el, anim, target) {
  state.combo = 0;
  state.lastCorrect = 0;
  updateHUD();
  feedback('Wrong – combo reset', 'crimson');

  try { 
    if (anim) anim.cancel(); 
  } catch(e) {}
  
  flashPlayAreaBorder();
  playHugeCenterExplosion(target || el.dataset.word || '', el.dataset.sentence === '1');
  handleMiss(el, el.dataset.word, true);
}

function handleMiss(el, word, force = false) {
  if (!el || !document.body.contains(el)) return;
  el.dataset.handled = '1';

  const bubble = el.querySelector('.word-bubble');
  const text = word || (el.dataset && el.dataset.word) || '';

  if (bubble) bubble.style.visibility = 'hidden';

  const bubbleRect = bubble ? bubble.getBoundingClientRect() : el.getBoundingClientRect();
  const containerRect = playArea.getBoundingClientRect();

  for (let i = 0; i < Math.min(6, text.length); i++) {
    const p = document.createElement('div');
    p.className = 'piece';
    p.textContent = text[i];
    playArea.appendChild(p);

    const startLeft = bubbleRect.left - containerRect.left + (bubbleRect.width / 2);
    const startTop = bubbleRect.top - containerRect.top + (bubbleRect.height / 2);
    p.style.left = startLeft + 'px';
    p.style.top = startTop + 'px';

    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 80;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 20;
    
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360 - 180}deg)`, opacity: 0 }
    ], { 
      duration: 700 + Math.random() * 300, 
      easing: 'cubic-bezier(.2,.8,.2,1)' 
    }).onfinish = () => p.remove();
  }

  const typedLine = el.querySelector('.typed-line');
  if (typedLine) {
    typedLine.animate([{ opacity: 1 }, { opacity: 0 }], { 
      duration: 500, 
      fill: 'forwards' 
    });
  }

  state.combo = 0;
  state.lastCorrect = 0;
  updateHUD();

  setTimeout(() => {
    if (document.body.contains(el)) el.remove();
    if (state.activeWordEl === el) state.activeWordEl = null;
    state.activeAnimation = null;
    state.isProcessing = false;
    setTimeout(() => spawnWord(), 380);
  }, 780);
}

function cleanupActive(el, wasSuccess) {
  if (!el) return;
  
  const typedLine = el.querySelector('.typed-line');
  if (typedLine) {
    typedLine.animate([{ opacity: 1 }, { opacity: 0 }], { 
      duration: 320, 
      fill: 'forwards' 
    });
  }
  
  setTimeout(() => {
    if (document.body.contains(el)) el.remove();
    if (state.activeWordEl === el) state.activeWordEl = null;
    state.activeAnimation = null;
    state.isProcessing = false;
    setTimeout(() => spawnWord(), 320);
  }, 320);
}

window.addEventListener('keydown', (e) => {
  if (!menuModal.classList.contains('hidden') || 
      !statsModal.classList.contains('hidden') || 
      !confirmModal.classList.contains('hidden')) {
    return;
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    state.typed += e.key;
    try { 
      typeSfx && typeSfx.play().catch(() => {}); 
    } catch(e) {}
    renderTypedForActive();
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    state.typed = state.typed.slice(0, -1);
    renderTypedForActive();
  } else if (e.key === 'Enter') {
    submitActive();
  } else if (e.key === 'Escape') {
    state.typed = '';
    renderTypedForActive();
  }
});