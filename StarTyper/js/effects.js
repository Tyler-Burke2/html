/* ========================================
   STAR TYPER - EFFECTS
   Visual effects and animations
======================================== */

function flashPlayAreaBorder() {
  playArea.classList.remove('flash-border');
  void playArea.offsetWidth;
  playArea.classList.add('flash-border');
  setTimeout(() => playArea.classList.remove('flash-border'), 2000);
}

function playHugeCenterExplosion(text, isSentence = false) {
  if (!playArea) return;
  
  const containerRect = playArea.getBoundingClientRect();
  const cx = containerRect.width / 2;
  const cy = containerRect.height / 2;

  const letters = String(text || '').split('');
  const count = Math.max(10, letters.length * 2);
  
  for (let i = 0; i < count; i++) {
    const ch = letters.length 
      ? letters[i % letters.length] 
      : String.fromCharCode(65 + (i % 26));
    
    const p = document.createElement('div');
    p.className = 'center-piece-large';
    p.textContent = ch;
    p.style.fontSize = Math.min(220, Math.max(140, Math.round(containerRect.width * 0.12))) + 'px';
    
    if (isSentence) {
      p.classList.add('sentence');
    } else if (Math.random() < 0.08) {
      p.classList.add('golden');
    }

    playArea.appendChild(p);

    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.transform = 'translate(-50%,-50%) scale(1)';
    p.style.opacity = '1';

    const angle = Math.random() * Math.PI * 2;
    const dist = 140 + Math.random() * 320;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - Math.random() * 40;
    const rotate = Math.random() * 360 - 180;
    const dur = 900 + Math.random() * 900;

    const keyframes = [
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4) rotate(${rotate}deg)`, opacity: 0 }
    ];

    p.animate(keyframes, { 
      duration: dur, 
      easing: 'cubic-bezier(.2,.8,.2,1)' 
    }).onfinish = () => p.remove();
  }
}

function spawnFloating(text, nearEl = null) {
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

  if (nearEl && nearEl.getBoundingClientRect) {
    const rect = nearEl.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height / 2 - 18) + 'px';
  } else {
    el.style.left = (window.innerWidth / 2 + (Math.random() * 160 - 80)) + 'px';
    el.style.top = (window.innerHeight * 0.35 + (Math.random() * 60 - 30)) + 'px';
  }

  floatingContainer.appendChild(el);

  const baseDuration = 900 + Math.random() * 300;
  const dur = baseDuration * 3;

  const anim = el.animate([
    { transform: 'translate(-50%, 0) scale(1)', opacity: 1 },
    { transform: 'translate(-50%, -140px) scale(1.08)', opacity: 0 }
  ], { 
    duration: dur, 
    easing: 'cubic-bezier(.2,.8,.2,1)' 
  });
  
  anim.onfinish = () => el.remove();
}

function spawnGoldenParticlesAtElement(el, count = 12) {
  if (!el || !playArea) return;
  
  const bubble = el.querySelector('.word-bubble');
  if (!bubble) return;
  
  const bubbleRect = bubble.getBoundingClientRect();
  const containerRect = playArea.getBoundingClientRect();
  const cx = bubbleRect.left - containerRect.left + bubbleRect.width / 2;
  const cy = bubbleRect.top - containerRect.top + bubbleRect.height / 2;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.width = '8px';
    p.style.height = '8px';
    p.style.borderRadius = '50%';
    p.style.pointerEvents = 'none';
    p.style.zIndex = 180;
    p.style.background = (i % 2 === 0) ? '#ffd166' : '#fff7d6';
    playArea.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 90;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 10;

    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0 }
    ], { 
      duration: 700 + Math.random() * 300, 
      easing: 'cubic-bezier(.2,.8,.2,1)' 
    }).onfinish = () => p.remove();
  }
}

function spawnGreenParticlesAtElement(el, count = 12) {
  if (!el || !playArea) return;
  
  const bubble = el.querySelector('.word-bubble');
  if (!bubble) return;
  
  const bubbleRect = bubble.getBoundingClientRect();
  const containerRect = playArea.getBoundingClientRect();
  const cx = bubbleRect.left - containerRect.left + bubbleRect.width / 2;
  const cy = bubbleRect.top - containerRect.top + bubbleRect.height / 2;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.width = '10px';
    p.style.height = '10px';
    p.style.borderRadius = '50%';
    p.style.pointerEvents = 'none';
    p.style.zIndex = 180;
    p.style.background = (i % 2 === 0) ? '#4ade80' : '#d1fae5';
    playArea.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 100;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 15;

    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0 }
    ], { 
      duration: 800 + Math.random() * 400, 
      easing: 'cubic-bezier(.2,.8,.2,1)' 
    }).onfinish = () => p.remove();
  }
}