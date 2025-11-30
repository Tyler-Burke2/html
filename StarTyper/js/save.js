/* ========================================
   STAR TYPER - SAVE
   Save/load system
======================================== */

function getSave() {
  return {
    dollars: state.dollars,
    basePerLetter: state.basePerLetter,
    currentWordBank: state.currentWordBank,
    unlockedWordBanks: state.unlockedWordBanks.slice(),
    skills: state.skills.map(s => ({ id: s.id, purchased: s.purchased })),
    upgrades: state.upgrades.map(u => ({ id: u.id, level: u.level })),
    combo: state.combo,
    lastCorrect: state.lastCorrect
  };
}

function saveToLocal() {
  try { 
    localStorage.setItem(SAVE_KEY, JSON.stringify(getSave())); 
  } catch(e) { 
    console.warn('save', e); 
  }
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    
    const d = JSON.parse(raw);
    if (typeof d.dollars === 'number') state.dollars = d.dollars;
    
    if (typeof d.currentWordBank === 'string') {
      state.currentWordBank = d.currentWordBank;
    }
    
    if (Array.isArray(d.unlockedWordBanks)) {
      state.unlockedWordBanks = d.unlockedWordBanks;
    }
    
    if (Array.isArray(d.skills)) {
      state.skills.forEach(s => {
        const found = d.skills.find(x => x.id === s.id);
        s.purchased = found ? (found.purchased || false) : false;
      });
      
      // Re-add sentence upgrade if phrases was purchased
      const phrasesSkill = state.skills.find(s => s.id === 'phrases');
      if (phrasesSkill && phrasesSkill.purchased) {
        if (!state.upgrades.find(u => u.id === 'sentences')) {
          state.upgrades.push({
            id: 'sentences',
            name: 'Phrase Amplifier',
            desc: 'Increase sentence spawn chance by +1%',
            baseCost: 2000,
            add: 0.01,
            level: 0,
            img: 'images/money.png'
          });
        }
      }
    }
    
    if (Array.isArray(d.upgrades)) {
      state.upgrades.forEach(u => {
        const found = d.upgrades.find(x => x.id === u.id);
        u.level = found ? (found.level || 0) : 0;
      });
    }
    
    if (typeof d.combo === 'number') state.combo = d.combo;
    if (typeof d.lastCorrect === 'number') state.lastCorrect = d.lastCorrect;
    
    updateHUD();
    return true;
  } catch(e) { 
    console.warn('load', e); 
    return false; 
  }
}

function exportSave() { 
  const text = JSON.stringify(getSave(), null, 2); 
  navigator.clipboard?.writeText(text).then(() => feedback('Save copied')); 
}

function importSaveFromArea() { 
  try { 
    const txt = importArea.value.trim(); 
    if (!txt) { 
      feedback('Paste JSON'); 
      return; 
    }
    
    const d = JSON.parse(txt); 
    if (typeof d.dollars !== 'number') throw new Error('Invalid save data'); 
    
    state.dollars = d.dollars;
    
    if (typeof d.currentWordBank === 'string') {
      state.currentWordBank = d.currentWordBank;
    }
    
    if (Array.isArray(d.unlockedWordBanks)) {
      state.unlockedWordBanks = d.unlockedWordBanks;
    }
    
    if (Array.isArray(d.skills)) {
      state.skills.forEach(s => {
        const f = d.skills.find(x => x.id === s.id);
        s.purchased = f ? (f.purchased || false) : false;
      });
      
      // Re-add sentence upgrade if phrases was purchased
      const phrasesSkill = state.skills.find(s => s.id === 'phrases');
      if (phrasesSkill && phrasesSkill.purchased) {
        if (!state.upgrades.find(u => u.id === 'sentences')) {
          state.upgrades.push({
            id: 'sentences',
            name: 'Phrase Amplifier',
            desc: 'Increase sentence spawn chance by +1%',
            baseCost: 2000,
            add: 0.01,
            level: 0,
            img: 'images/money.png'
          });
        }
      }
    }
    
    if (Array.isArray(d.upgrades)) { 
      state.upgrades.forEach(u => { 
        const f = d.upgrades.find(x => x.id === u.id); 
        u.level = f ? (f.level || 0) : 0; 
      }); 
    } 
    
    state.combo = typeof d.combo === 'number' ? d.combo : 0; 
    state.lastCorrect = typeof d.lastCorrect === 'number' ? d.lastCorrect : 0; 
    
    updateHUD(); 
    feedback('Imported'); 
    autosaveNow(); 
  } catch(e) { 
    feedback('Invalid JSON', 'crimson'); 
  } 
}

function doResetAll() {
  state.dollars = 0; 
  state.basePerLetter = 1;
  state.currentWordBank = 'easy';
  state.unlockedWordBanks = ['easy'];
  state.skills.forEach(s => s.purchased = false);
  state.upgrades.forEach(u => u.level = 0);
  state.upgrades = state.upgrades.filter(u => u.id !== 'sentences');
  state.combo = 0; 
  state.lastCorrect = 0; 
  
  try { 
    localStorage.removeItem(SAVE_KEY); 
  } catch(e) {}
  
  saveToLocal(); 
  updateHUD(); 
  feedback('Progress reset');
}

let autosaveTimeout;

function autosaveNow() { 
  saveToLocal(); 
  clearTimeout(autosaveTimeout); 
  autosaveTimeout = setTimeout(autosaveNow, AUTOSAVE_INTERVAL_MS); 
}