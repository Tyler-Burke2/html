/* ========================================
   STAR TYPER - UI
   UI updates and rendering
======================================== */

function updateHUD() {
  dollarsEl.textContent = fmt(state.dollars);
  perLetterEl.textContent = '$' + calcBasePerLetter();
  bankMultEl.textContent = getWordBankMultiplier() + '×';
  goldenChanceEl.textContent = Math.round(getGoldenChance() * 100) + '%';
  sentenceChanceEl.textContent = Math.round(getSentenceChance() * 100) + '%';
  comboGrowthEl.textContent = getComboStep().toFixed(2);
  maxMultEl.textContent = getMaxMultiplier().toFixed(2) + '×';
  comboEl.textContent = state.combo;
  
  const mult = getMultiplierForCombo(state.combo);
  multiplierEl.textContent = mult.toFixed(2) + '×';

  const comboNumEl = document.querySelector('.combo-num');
  if (comboNumEl) {
    const maxMult = getMaxMultiplier();
    if (mult >= maxMult) {
      comboNumEl.classList.add('maxed');
    } else {
      comboNumEl.classList.remove('maxed');
    }
  }
  
  renderSkills();
  renderUpgrades();
  updateWordBankSelector();
}

function updateWordBankSelector() {
  wordBankSelect.innerHTML = '';
  
  state.unlockedWordBanks.forEach(bank => {
    const option = document.createElement('option');
    option.value = bank;
    option.textContent = bank.charAt(0).toUpperCase() + bank.slice(1);
    if (bank === state.currentWordBank) {
      option.selected = true;
    }
    wordBankSelect.appendChild(option);
  });
}

function feedback(msg, color = '') {
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
  
  setTimeout(() => {
    fb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600 })
      .onfinish = () => fb.remove();
  }, 1200);
}