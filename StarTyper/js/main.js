/* ========================================
   STAR TYPER - MAIN
   Initialization and event listeners
======================================== */

// Event Listeners
openMenuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
manualSaveBtn.addEventListener('click', () => { 
  saveToLocal(); 
  feedback('Saved'); 
});
manualLoadBtn.addEventListener('click', () => { 
  const ok = loadFromLocal(); 
  feedback(ok ? 'Loaded' : 'No save found'); 
});
exportBtn.addEventListener('click', exportSave);
importBtn.addEventListener('click', importSaveFromArea);

openStatsBtn.addEventListener('click', openStats);
closeStatsBtn.addEventListener('click', closeStats);

menuResetBtn?.addEventListener('click', () => {
  openConfirmReset();
});
confirmNo.addEventListener('click', () => {
  closeConfirmReset();
});
confirmYes.addEventListener('click', () => {
  closeConfirmReset();
  closeMenu();
  doResetAll();
});

audioToggleBtn.addEventListener('click', () => {
  state.ambientOn = !state.ambientOn;
  if (state.ambientOn) {
    try { 
      ambientAudio.play().catch(() => {}); 
    } catch(e) {}
  } else {
    ambientAudio.pause();
  }
  audioToggleBtn.classList.toggle('active', state.ambientOn);
});

wordBankSelect.addEventListener('change', (e) => {
  state.currentWordBank = e.target.value;
  updateHUD();
  autosaveNow();
  feedback(`Switched to ${e.target.value} words`);
});

// Initialization
async function init() {
  await loadWords();
  loadFromLocal();
  renderSkills();
  renderUpgrades();
  updateHUD();
  await spawnWord();
  autosaveTimeout = setTimeout(autosaveNow, AUTOSAVE_INTERVAL_MS);
}

init();

// Debug Access
window._typingClicker = {
  state, 
  spawnWord, 
  saveToLocal, 
  loadFromLocal, 
  exportSave, 
  importSaveFromArea, 
  doResetAll
};