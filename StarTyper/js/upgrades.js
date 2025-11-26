/* ========================================
   STAR TYPER - UPGRADES
   Upgrade system management
======================================== */

function renderUpgrades() {
  upgradesEl.innerHTML = '';
  
  state.upgrades.forEach(u => {
    const cost = upgradeCost(u);
    const div = document.createElement('div');
    div.className = 'upgrade';
    div.innerHTML = `
      <div class="u-thumb">
        <img src="${u.img}" alt="${u.name}" style="max-width:48px">
      </div>
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

function buyUpgrade(id) {
  const u = state.upgrades.find(x => x.id === id);
  if (!u) return;
  
  const cost = upgradeCost(u);
  if (state.dollars < cost) { 
    feedback('Not enough dollars', 'crimson'); 
    return; 
  }
  
  const currentMult = getMultiplierForCombo(state.combo);
  
  state.dollars -= cost;
  u.level++;
  
  if (u.id === 'warp' || u.id === 'reactor') {
    const newStep = getComboStep();
    const newMax = getMaxMultiplier();
    
    if (currentMult > 1.0) {
      const neededCombo = Math.floor(((currentMult - 1) / newStep) + 1);
      state.combo = Math.max(0, neededCombo);
    }
  }
  
  updateHUD();
  autosaveNow();
  feedback(`Bought ${u.name}`);
}