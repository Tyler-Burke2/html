(() => {
  const muffinBtn = document.getElementById('muffinButton');
  const scoreEl = document.getElementById('score');
  const perSecondEl = document.getElementById('perSecond');
  const upgradeList = document.querySelector('.upgrade-list');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const floatingEffects = document.getElementById('floatingEffects');
  const achievementList = document.getElementById('achievementList');
  const notifications = document.getElementById('notifications');

  let state = {
    score: 0,
    cps: 0,
    clickPower: 1,
    upgrades: {
      auto: { count: 0, cost: 50 },
      multiplier: { count: 0, cost: 200 },
      superMixer: { count: 0, cost: 1000 },
      bakery: { count: 0, cost: 5000 },
    },
    achievements: {}
  };

  const upgradesConfig = [
    { key:'auto', name:'Auto-Masher', desc:'+1 muffin/sec', baseCost:50, mult:1.6, effect:()=>recalcCps() },
    { key:'multiplier', name:'Masher Multiplier', desc:'+1 per click', baseCost:200, mult:2.2, effect:()=>state.clickPower++ },
    { key:'superMixer', name:'Super Mixer', desc:'+10 muffins/sec', baseCost:1000, mult:2.5, effect:()=>{ state.upgrades.auto.count+=10; recalcCps(); } },
    { key:'bakery', name:'Bakery Expansion', desc:'Double output', baseCost:5000, mult:3, effect:()=>{ state.cps*=2; state.clickPower*=2; } }
  ];

  const format = n => Math.floor(n);
  const canAfford = cost => state.score >= cost;
  const spend = amt => state.score -= amt;

  const save = () => localStorage.setItem('muffinState', JSON.stringify(state));
  const load = () => {
    const raw = localStorage.getItem('muffinState');
    if(raw){ try{ Object.assign(state, JSON.parse(raw)); }catch(e){console.warn(e);} }
    recalcCps(); updateDisplay(); buildUpgrades();
  };

  function recalcCps(){
    state.cps = state.upgrades.auto.count + state.upgrades.superMixer.count*10;
  }

  // ===== UI Helpers =====
  const notify = text => {
    const n = document.createElement('div'); n.className='notification'; n.textContent=text;
    notifications.appendChild(n);
    setTimeout(()=>n.remove(),3000);
  };

  const floatScore = amt => {
    const el = document.createElement('div'); el.className='float-score'; el.textContent=`+${amt}`;
    floatingEffects.appendChild(el);
    el.style.left = `${Math.random()*60+80}px`;
    el.style.top = `${Math.random()*60+80}px`;
    el.animate([{transform:'translate(0,0)', opacity:1},{transform:'translate(0,-50px)', opacity:0}], {duration:800,easing:'ease-out'});
    setTimeout(()=>el.remove(),800);
  };

  const spawnCrumbs = () => {
    for(let i=0;i<5;i++){
      const c=document.createElement('div'); c.className='crumb';
      floatingEffects.appendChild(c);
      const angle=Math.random()*2*Math.PI, dist=Math.random()*40+20;
      c.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${Math.cos(angle)*dist}px,${-Math.sin(angle)*dist}px)`,opacity:0}],{duration:600});
      setTimeout(()=>c.remove(),600);
    }
  };

  // ===== Build Upgrades =====
  function buildUpgrades(){
    upgradeList.innerHTML='';
    upgradesConfig.forEach(u=>{
      const info=state.upgrades[u.key];
      const btn=document.createElement('button');
      btn.className='upgrade'; btn.id=`upgrade-${u.key}`;
      btn.innerHTML=`<div class="title">${u.name}</div>
                     <div class="desc">${u.desc}</div>
                     <div class="cost">Cost: <span class="cost-value">${info.cost}</span></div>
                     <div class="owned">Owned: <span class="owned-value">${info.count}</span></div>`;
      btn.addEventListener('click',()=>buyUpgrade(u));
      upgradeList.appendChild(btn);
    });
    updateUpgradeButtons();
  }

  function updateUpgradeButtons(){
    upgradesConfig.forEach(u=>{
      const info=state.upgrades[u.key];
      const btn=document.querySelector(`#upgrade-${u.key}`);
      btn.querySelector('.cost-value').textContent=info.cost;
      btn.querySelector('.owned-value').textContent=info.count;
      const disabled=!canAfford(info.cost);
      btn.disabled=disabled; btn.setAttribute('aria-disabled',disabled);
    });
  }

  function buyUpgrade(u){
    const info=state.upgrades[u.key];
    if(!canAfford(info.cost)){ notify('Not enough muffins!'); return; }
    spend(info.cost); info.count++; info.cost=Math.ceil(info.cost*u.mult); u.effect(); updateDisplay(); notify(`Bought ${u.name}!`);
  }

  function updateDisplay(){
    scoreEl.textContent=format(state.score);
    perSecondEl.textContent=state.cps.toFixed(1);
    updateUpgradeButtons();
    checkAchievements();
  }

  // ===== Achievements =====
  const achievementsConfig = [
    { key:'firstClick', name:'First Click', condition:()=>state.score>=1 },
    { key:'hundredMuffins', name:'100 Muffins!', condition:()=>state.score>=100 },
    { key:'autoArmy', name:'Auto-Masher Master', condition:()=>state.upgrades.auto.count>=10 },
  ];

  function checkAchievements(){
    achievementsConfig.forEach(a=>{
      if(a.condition() && !state.achievements[a.key]){
        state.achievements[a.key]=true;
        const li=document.createElement('li'); li.textContent=a.name;
        achievementList.appendChild(li);
        notify(`Achievement Unlocked: ${a.name}!`);
      }
    });
  }

  // ===== Muffin Click =====
  let goldenActive=false;
  function activateGoldenMuffin(){
    if(goldenActive) return;
    goldenActive=true;
    const originalPower=state.clickPower;
    state.clickPower*=5;
    muffinBtn.classList.add('golden');
    notify('Golden Muffin Activated! 🍯');
    setTimeout(()=>{ state.clickPower=originalPower; muffinBtn.classList.remove('golden'); goldenActive=false; },30000);
  }

  muffinBtn.addEventListener('click',()=>{
    muffinBtn.classList.add('pop');
    setTimeout(()=>muffinBtn.classList.remove('pop'),180);
    state.score+=state.clickPower;
    updateDisplay();
    floatScore(state.clickPower);
    spawnCrumbs();
    if(Math.random()<0.01) activateGoldenMuffin();
  });

  saveBtn.addEventListener('click',()=>{ save(); notify('Game Saved!'); });
  resetBtn.addEventListener('click',()=>{
    if(!confirm('Reset your game?')) return;
    localStorage.removeItem('muffinState');
    state={ score:0,cps:0,clickPower:1,upgrades:{ auto:{count:0,cost:50}, multiplier:{count:0,cost:200}, superMixer:{count:0,cost:1000}, bakery:{count:0,cost:5000} }, achievements:{} };
    buildUpgrades(); updateDisplay();
  });

  // ===== Game Loop =====
  setInterval(()=>{ if(state.cps>0){ state.score+=state.cps/10; updateDisplay(); } },100);
  setInterval(save,10000);

  // ===== Init =====
  load();
})();
