/* ========================================
   STAR TYPER - STATE
   Game state management
======================================== */

let state = {
  dollars: 0,
  basePerLetter: 1,
  currentWordBank: 'easy',
  unlockedWordBanks: ['easy'],
  skills: [
    {
      id: 'phrases',
      name: 'Phrase Training',
      desc: 'Unlock sentence challenges worth 5× normal payout',
      cost: 1000,
      purchased: false,
      img: 'images/money.png'
    },
    {
      id: 'medium',
      name: 'Apprentice Vocabulary',
      desc: 'Unlock medium difficulty words (2× money per letter)',
      cost: 5000,
      purchased: false,
      img: 'images/money.png'
    },
    {
      id: 'hard',
      name: 'Scholar\'s Lexicon',
      desc: 'Unlock hard difficulty words (4× money per letter)',
      cost: 15000,
      purchased: false,
      img: 'images/money.png'
    },
    {
      id: 'veryhard',
      name: 'Master Linguist',
      desc: 'Unlock very hard difficulty words (8× money per letter)',
      cost: 50000,
      purchased: false,
      img: 'images/money.png'
    },
    {
      id: 'expert',
      name: 'Cosmic Dictionary',
      desc: 'Unlock expert difficulty words (16× money per letter)',
      cost: 150000,
      purchased: false,
      img: 'images/money.png'
    }
  ],
  upgrades: [
    { 
      id: 'credits', 
      name: 'Fuel Cell', 
      desc: 'Gain +$1 per letter typed', 
      baseCost: 100, 
      add: 1, 
      level: 0, 
      img: 'images/fuel_cells.png' 
    },
    { 
      id: 'stellar', 
      name: 'UFO Radar', 
      desc: 'Increase chance of UFO words by 1%', 
      baseCost: 500, 
      add: 0.01, 
      level: 0, 
      img: 'images/UFO.png' 
    },
    { 
      id: 'warp', 
      name: 'Rocket Thrusters', 
      desc: 'Accelerate combo growth by +0.1 per word', 
      baseCost: 1000, 
      add: 0.1, 
      level: 0, 
      img: 'images/thrusters.png' 
    },
    { 
      id: 'reactor', 
      name: 'Main Engine', 
      desc: 'Expand max multiplier capacity by +1.0', 
      baseCost: 2500, 
      add: 1.0, 
      level: 0, 
      img: 'images/engine.png' 
    }
  ],
  words: {
    easy: [],
    medium: [],
    hard: [],
    veryhard: [],
    expert: [],
    ufo: [],
    sentences: []
  },
  activeWordEl: null,
  activeAnimation: null,
  typed: '',
  combo: 0,
  lastCorrect: 0,
  autosaveTimeout: null,
  ambientOn: false,
  isProcessing: false
};