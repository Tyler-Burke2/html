/* ========================================
   STAR TYPER - SKILLS
   Skill system management
======================================== */

function renderSkills() {
  skillsEl.innerHTML = '';
  
  const availableSkills = state.skills.filter(s => !s.purchased);
  const skillOrder = ['phrases', 'medium', 'hard', 'veryhard', 'expert'];
  const orderedSkills = [];
  
  for (const id of skillOrder) {
    const skill = availableSkills.find(s => s.id === id);
    if (skill) {
      if (id !== 'phrases') {
        const prevIndex = skillOrder.indexOf(id) - 1;
        const prevId = skillOrder[prevIndex];
        const prevSkill = state.skills.find(s => s.id === prevId);
        
        if (prevSkill && !prevSkill.purchased) {
          break;
        }
      }
      orderedSkills.push(skill);
      
      if (id !== 'phrases') break;
    }
  }
  
  orderedSkills.forEach(s => {
    const div = document.createElement('div');
    div.className = 'skill';
    div.innerHTML = `
      <div class="skill-thumb">
        <img src="${s.img}" alt="${s.name}" style="max-width:48px">
      </div>
      <div class="skill-info">
        <div class="skill-title">${s.name}</div>
        <div class="skill-desc">${s.desc}</div>
      </div>
      <div class="skill-buy">
        <div style="font-weight:900">${s.cost}$</div>
        <button class="btn buy-btn" data-id="${s.id}">Unlock</button>
      </div>
    `;
    skillsEl.appendChild(div);
  });
  
  skillsEl.querySelectorAll('.buy-btn').forEach(b => {
    b.addEventListener('click', () => buySkill(b.dataset.id));
  });
}

function buySkill(id) {
  const s = state.skills.find(x => x.id === id);
  if (!s) return;
  
  if (state.dollars < s.cost) { 
    feedback('Not enough dollars', 'crimson'); 
    return; 
  }
  
  state.dollars -= s.cost;
  s.purchased = true;
  
  if (id === 'phrases') {
    const sentenceUpgrade = {
      id: 'sentences',
      name: 'Phrase Amplifier',
      desc: 'Increase sentence spawn chance by +1%',
      baseCost: 2000,
      add: 0.01,
      level: 0,
      img: 'images/money.png'
    };
    
    if (!state.upgrades.find(u => u.id === 'sentences')) {
      state.upgrades.push(sentenceUpgrade);
    }
    
    feedback('Phrases unlocked! Check the shop for Phrase Amplifier.');
  } else {
    const bankMap = {
      medium: 'medium',
      hard: 'hard',
      veryhard: 'veryhard',
      expert: 'expert'
    };
    
    const bankName = bankMap[id];
    if (bankName && !state.unlockedWordBanks.includes(bankName)) {
      state.unlockedWordBanks.push(bankName);
      state.currentWordBank = bankName; // Auto-switch to new difficulty
      feedback(`${s.name} unlocked! Now using ${bankName} words.`);
    }
  }
  
  updateHUD();
  autosaveNow();
}