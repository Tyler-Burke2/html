/* ========================================
   STAR TYPER - LOADING SCREEN
   Handle page load and loading screen fade
======================================== */

(function() {
  const loadingScreen = document.getElementById('loading-screen');
  const minDisplayTime = 500; // Minimum 500ms display time
  const startTime = Date.now();
  
  window.addEventListener('load', function() {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, minDisplayTime - elapsedTime);
    
    // Wait for minimum display time, then fade out
    setTimeout(function() {
      loadingScreen.classList.add('fade-out');
      
      // Remove from DOM after fade completes
      setTimeout(function() {
        loadingScreen.remove();
      }, 500); // Match CSS transition duration
    }, remainingTime);
  });
})();