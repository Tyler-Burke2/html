/* ========================================
   STAR TYPER - MODALS
   Modal management and handlers
======================================== */

function openMenu() { 
  menuModal.classList.remove('hidden'); 
  menuModal.setAttribute('aria-hidden', 'false'); 
}

function closeMenu() { 
  menuModal.classList.add('hidden'); 
  menuModal.setAttribute('aria-hidden', 'true'); 
}

function openStats() { 
  statsModal.classList.remove('hidden'); 
  statsModal.setAttribute('aria-hidden', 'false'); 
}

function closeStats() { 
  statsModal.classList.add('hidden'); 
  statsModal.setAttribute('aria-hidden', 'true'); 
}

function openConfirmReset() {
  confirmModal.classList.remove('hidden');
  confirmModal.setAttribute('aria-hidden', 'false');
}

function closeConfirmReset() {
  confirmModal.classList.add('hidden');
  confirmModal.setAttribute('aria-hidden', 'true');
}