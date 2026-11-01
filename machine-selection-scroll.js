// Independent fallback: choosing a machine always moves new customers to capsule selection.
// This file is intentionally separate from the main form script.
(function () {
  function goToCapsules() {
    const section = document.getElementById('kapsule');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // This independent handler is the reliable bridge between the chosen machine
  // card and the capsule gallery. It does not depend on the main form handler.
  function syncChosenMachine(button) {
    if (document.body.dataset.customerChangeMode === 'true') return false;
    const rawModel = String(button.dataset.model || '');
    const family = /LB\\s*1300/i.test(rawModel) ? 'LB1300'
      : /LB\\s*2600/i.test(rawModel) ? 'LB2600' : '';
    if (!family) return false;

    const modelField = document.getElementById('model');
    const topicField = document.getElementById('topic');
    if (!modelField) return false;
    const option = Array.from(modelField.options).find(item =>
      family === 'LB1300' ? /LB\\s*1300/i.test(item.textContent) : /LB\\s*2600/i.test(item.textContent)
    );
    if (!option) return false;

    modelField.value = option.value || option.textContent;
    if (topicField) {
      topicField.value = 'Želim aparat uz mjesečnu kupnju kapsula';
      topicField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    modelField.dispatchEvent(new Event('change', { bubbles: true }));

    // Refresh the main script's derived capsule state, when it is available.
    if (typeof window.updateSelectedCapsuleField === 'function') window.updateSelectedCapsuleField();
    if (typeof window.updateCapsuleButtonFeedback === 'function') window.updateCapsuleButtonFeedback();
    return true;
  }

  document.addEventListener('click', function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const machineButton = target.closest('.model-select');
    if (machineButton) {
      if (document.body.dataset.customerChangeMode === 'true') return;
      syncChosenMachine(machineButton);
      window.setTimeout(goToCapsules, 0);
      window.setTimeout(goToCapsules, 180);
      window.setTimeout(goToCapsules, 420);
      return;
    }

    // If the main handler left a quantity button disabled, recover only when
    // a valid machine is selected, then delegate to the shared quantity logic.
    const quantityButton = target.closest('#kapsule .capsule-quantity-plus, #kapsule .capsule-quantity-minus');
    if (!quantityButton || document.body.dataset.customerChangeMode === 'true') return;
    const modelField = document.getElementById('model');
    const modelValue = String(modelField && modelField.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const validModel = modelValue.includes('LB1300') || modelValue.includes('LB2600');
    if (!validModel) return;

    quantityButton.disabled = false;
    const gallery = quantityButton.closest('.blue-capsule-gallery');
    const source = gallery && gallery.querySelector('.capsule-select');
    const variety = source && source.dataset.capsule;
    if (!variety) return;
    if (typeof window.changeCapsuleQuantity === 'function') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.changeCapsuleQuantity(variety, quantityButton.classList.contains('capsule-quantity-plus') ? 1 : -1);
    } else {
      const note = document.getElementById('capsule-selection-note');
      if (note) note.textContent = 'Odabrani aparat je prepoznat, ali skripta za obračun kapsula nije učitana. Osvježite stranicu.';
    }
  }, true);
})();
