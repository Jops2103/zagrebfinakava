// Independent fallback: choosing a machine always moves new customers to capsule selection.
// This file is intentionally separate from the main form script.
(function () {
  function goToCapsules() {
    const section = document.getElementById('kapsule');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Capture the click separately so the navigation still works if the main
  // machine-selection handler encounters an unrelated form error.
  document.addEventListener('click', function (event) {
    const button = event.target.closest('.model-select');
    if (!button) return;

    // Existing customers follow their own quantity-change workflow.
    if (document.body.dataset.customerChangeMode === 'true') return;

    window.setTimeout(goToCapsules, 0);
    window.setTimeout(goToCapsules, 180);
    window.setTimeout(goToCapsules, 420);
  }, true);
})();
