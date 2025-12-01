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
      
      console.log(`Loaded ${bank}:`, data); // Debug: see what we got
      
      // Special handling for sentences.json which uses "sentences" key
      if (bank === 'sentences' && Array.isArray(data.sentences) && data.sentences.length > 0) {
        state.words[bank] = data.sentences.slice();
        console.log(`${bank} loaded successfully:`, state.words[bank].length, 'items');
      } else if (Array.isArray(data.words) && data.words.length > 0) {
        state.words[bank] = data.words.slice();
        console.log(`${bank} loaded successfully:`, state.words[bank].length, 'items');
      } else if (Array.isArray(data) && data.length > 0) {
        // Maybe the JSON is just an array, not {words: [...]}
        state.words[bank] = data.slice();
        console.log(`${bank} loaded as array:`, state.words[bank].length, 'items');
      } else {
        throw new Error('Invalid data format');
      }
    } catch(e) {
      console.warn(`Failed to load ${bank} words:`, e);
      // Only use defaults for non-sentence banks
      if (bank === 'sentences') {
        state.words[bank] = [
          "The quick brown fox jumps over the lazy dog",
          "Pack my box with five dozen liquor jugs",
          "How vexingly quick daft zebras jump"
        ];
      } else {
        state.words[bank] = DEFAULT_WORDS.slice();
      }
    }
  }
}

async function spawnWord() {
  // FIX #1: Only check isProcessing, allow multiple words on screen
  if (state.isProcessing) return;
  
  const sentenceChance = getSentenceChance();
  const goldenChance = getGoldenChance();
  
  let word, isSentence = false, isGolden = false, wordBank = state.currentWordBank;
  
  // FIX #4: Sentences should use words-sentences.json
  if (sentenceChance > 0 && Math.random() < sentenceChance) {
    isSentence = true;
    // Check if sentences loaded properly
    if (state.words.sentences && state.words.sentences.length > 0) {
      word = state.words.sentences[Math.floor(Math.random() * state.words.sentences.length)];
      console.log('Spawning sentence:', word); // Debug log
    } else {
      // Fallback if sentences didn't load
      word = "The quick brown fox jumps over the lazy dog";
      console.warn('Sentences not loaded, using fallback');
    }
    
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

  // NEW SYSTEM: Left edge takes WORD_DURATION_MS to reach left edge,
  // then continues at same speed until right edge is off screen
  const startLeft = areaWidth;
  const leftEdgeTarget = 0; // Left edge of play area
  
  // Calculate speed: distance the left edge travels / time
  const distanceForLeftEdge = areaWidth; // From right edge to left edge
  const speed = distanceForLeftEdge / WORD_DURATION_MS; // pixels per millisecond
  
  // Total distance = left edge travel + word width (so right edge clears screen)
  const totalDistance = areaWidth + measuredWidth;
  
  // Total time = total distance / speed
  const totalDuration = totalDistance / speed;
  
  const endLeft = -measuredWidth; // Right edge is off screen

  const anim = el.animate([
    { left: startLeft + 'px' },
    { left: endLeft + 'px' }
  ], {
    duration: totalDuration,
    easing: 'linear',
    fill: 'forwards'
  });

  // FIX #1: Set this as the active word for typing
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
  
  // FIX #1: Clear active word references immediately
  state.activeWordEl = null;
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
    handleSuccess(el);
  } else {
    handleWrong(el, target);
  }
}

function handleSuccess(el) {
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

  // FIX #5: Check if at max BEFORE spawning floating text to avoid overlap
  const maxMult = getMaxMultiplier();
  const multAfter = getMultiplierForCombo(state.combo);
  const wasAtMax = mult >= maxMult;
  const nowAtMax = multAfter >= maxMult;
  
  // Only show MAX message if we just hit max (not if already at max)
  if (nowAtMax && !wasAtMax) {
    const comboNumEl = document.querySelector('.combo-num');
    if (comboNumEl) comboNumEl.classList.add('maxed');
    // Delay the MAX message slightly so it doesn't overlap with +$ message
    setTimeout(() => {
      spawnFloating(`MAX ${maxMult.toFixed(1)}×!`, el);
    }, 300);
  } else if (nowAtMax) {
    const comboNumEl = document.querySelector('.combo-num');
    if (comboNumEl) comboNumEl.classList.add('maxed');
  }

  // FIX #1: Spawn next word IMMEDIATELY
  state.isProcessing = false;
  spawnWord();

  // Fade out the typed line on the old word
  const typedLine = el.querySelector('.typed-line');
  if (typedLine) {
    typedLine.animate([{ opacity: 1 }, { opacity: 0 }], { 
      duration: 320, 
      fill: 'forwards' 
    });
  }

  // Speed up the old word to rush it off screen
  const endLeft = -(el.offsetWidth || 120) - 8;
  const currentLeft = parseFloat(getComputedStyle(el).left) || 0;
  
  const fastAnim = el.animate([
    { left: currentLeft + 'px' },
    { left: endLeft + 'px' }
  ], { 
    duration: 2000,
    easing: 'cubic-bezier(.2,.8,.2,1)', 
    fill: 'forwards' 
  });
  
  fastAnim.onfinish = () => {
    if (document.body.contains(el)) el.remove();
  };
}

function handleWrong(el, target) {
  state.combo = 0;
  state.lastCorrect = 0;
  updateHUD();
  feedback('Wrong — combo reset', 'crimson');
  
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
  
  const centerX = bubbleRect.left - containerRect.left + (bubbleRect.width / 2);
  const centerY = bubbleRect.top - containerRect.top + (bubbleRect.height / 2);

  for (let i = 0; i < Math.min(6, text.length); i++) {
    const p = document.createElement('div');
    p.className = 'piece';
    p.textContent = text[i];
    playArea.appendChild(p);

    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';

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