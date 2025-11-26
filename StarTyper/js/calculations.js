/* ========================================
   STAR TYPER - CALCULATIONS
   Game math and calculation functions
======================================== */

function now() { 
  return Date.now(); 
}

function fmt(n) { 
  return Math.floor(n); 
}

function escapeHtml(s) { 
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c])); 
}

function calcBasePerLetter() {
  let per = state.basePerLetter;
  const creditBooster = state.upgrades.find(u => u.id === 'credits');
  if (creditBooster && creditBooster.level) {
    per += creditBooster.add * creditBooster.level;
  }
  return per;
}

function getWordBankMultiplier() {
  return WORD_BANK_MULTIPLIERS[state.currentWordBank] || 1;
}

function calcPerLetter() {
  const base = calcBasePerLetter();
  const bankMult = getWordBankMultiplier();
  return base * bankMult;
}

function getGoldenChance() {
  const stellarScanner = state.upgrades.find(u => u.id === 'stellar');
  let chance = BASE_GOLDEN_CHANCE;
  if (stellarScanner && stellarScanner.level) {
    chance += stellarScanner.add * stellarScanner.level;
  }
  return Math.min(chance, 1.0);
}

function getSentenceChance() {
  const phrasesSkill = state.skills.find(s => s.id === 'phrases');
  if (!phrasesSkill || !phrasesSkill.purchased) return 0;
  
  const sentenceUpgrade = state.upgrades.find(u => u.id === 'sentences');
  let chance = BASE_SENTENCE_CHANCE;
  if (sentenceUpgrade && sentenceUpgrade.level) {
    chance += sentenceUpgrade.add * sentenceUpgrade.level;
  }
  return Math.min(chance, 0.5);
}

function getComboStep() {
  let step = BASE_COMBO_STEP;
  const warpDrive = state.upgrades.find(u => u.id === 'warp');
  if (warpDrive && warpDrive.level) {
    step += warpDrive.add * warpDrive.level;
  }
  return step;
}

function getMaxMultiplier() {
  let max = BASE_MAX_MULTIPLIER;
  const reactor = state.upgrades.find(u => u.id === 'reactor');
  if (reactor && reactor.level) {
    max += reactor.add * reactor.level;
  }
  return max;
}

function getMultiplierForCombo(combo) {
  if (combo <= 1) return 1.0;
  const step = getComboStep();
  const mult = 1 + (combo - 1) * step;
  const maxMult = getMaxMultiplier();
  return Math.min(mult, maxMult);
}

function upgradeCost(u) { 
  return Math.ceil(u.baseCost * Math.pow(1.6, u.level)); 
}