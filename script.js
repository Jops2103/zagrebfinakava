/* On refresh, remove any section hash and return to the top, including on mobile browsers that restore scroll late. */
(function resetScrollPositionOnRefresh(){
  const navigation = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (!navigation || navigation.type !== 'reload') return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // A saved URL hash can make mobile browsers jump back to a section after the initial scroll.
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  const returnToTop = () => window.scrollTo(0, 0);
  returnToTop();
  window.addEventListener('load', returnToTop, { once: true });
  window.addEventListener('pageshow', () => {
    returnToTop();
    window.setTimeout(returnToTop, 100);
    window.setTimeout(returnToTop, 400);
  }, { once: true });
})();

const form = document.getElementById('order-form');
// Keep the new-customer form configured for Web3Forms.
if (form) {
  form.setAttribute('method', 'POST');
  form.method = 'post';
}
const status = document.getElementById('status');

// Keep a clearly named copy of the sender's email in the submitted message body.
// The required email field is validated by the browser before this submit handler runs.
if (form) {
  form.addEventListener('submit', (event) => {
    // Validate standard required fields first.
    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
      if (status) status.textContent = 'Ispunite sva obavezna polja označena zvjezdicom (*) i potvrdite suglasnost.';
      return;
    }

    // When an appliance is selected, the required minimum capsule boxes must also be selected.
    const selectedModel = document.getElementById('model');
    const selectedTopic = document.getElementById('topic');
    const capsuleInput = document.getElementById('capsules');
    const capsuleWrap = capsuleInput && capsuleInput.closest('.capsule-selection-field');
    const capsuleNote = document.getElementById('capsule-selection-note');
    const selectedCount = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
    const minimum = capsulePackageLimit();
    const applianceOrder = selectedTopic && selectedTopic.value === 'Želim aparat uz mjesečnu kupnju kapsula';
    if (applianceOrder && selectedModel && selectedModel.value && minimum > 0 && selectedCount < minimum) {
      event.preventDefault();
      if (capsuleWrap) capsuleWrap.classList.add('capsule-selection-invalid');
      if (capsuleInput) capsuleInput.setAttribute('aria-invalid', 'true');
      if (capsuleNote) {
        capsuleNote.textContent = `Obavezno: odaberite najmanje ${minimum} ${minimum === 1 ? 'kutiju kapsula' : 'kutije kapsula'} za odabrani aparat. Kliknite kapsule u galeriji iznad.`;
        capsuleNote.classList.add('capsule-error-note');
      }
      if (status) status.textContent = 'Upit nije poslan. Obavezno odaberite minimalnu količinu kapsula za odabrani aparat.';
      if (capsuleWrap) {
        capsuleWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        capsuleInput?.focus({ preventScroll: true });
      }
      return;
    }

    // Reassert the Web3Forms POST configuration before submission.
    form.setAttribute('method', 'POST');
    form.method = 'post';

    // Give every submission a distinct subject so mail clients are less likely to group inquiries into one conversation.
    const subjectInput = form.querySelector('input[name="subject"]');
    const topicForSubject = (selectedTopic && selectedTopic.value || 'Novi upit').trim();
    const modelForSubject = (selectedModel && selectedModel.value || '').trim();
    const subjectDetails = [topicForSubject, modelForSubject && modelForSubject !== 'Nisam još odabrao/la' ? modelForSubject : 'bez odabranog aparata']
      .filter(Boolean)
      .join(' — ');
    const submittedAt = new Date();
    const readableTime = submittedAt.toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'medium' });
    if (subjectInput) subjectInput.value = `ZFK — ${subjectDetails} — ${readableTime} — #${Date.now()}`;

  });
}
const menu = document.querySelector('.menu');
const nav = document.querySelector('.header nav');

document.getElementById('year').textContent = new Date().getFullYear();

function closeMenu({ returnFocus = false } = {}) {
  nav.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Otvori izbornik');
  if (returnFocus) menu.focus();
}

menu.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Zatvori izbornik' : 'Otvori izbornik');
});

nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => closeMenu());
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    closeMenu({ returnFocus: true });
  }
});

window.matchMedia('(min-width: 701px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

// Enlarge product and hero photos on click; close with Escape or backdrop.
(function setupImageLightbox(){
  const images = Array.from(document.querySelectorAll('.product-gallery img, .model-image-gallery img, .hero-product-image'));
  if (!images.length) return;
  const overlay = document.createElement('div');
  overlay.className = 'image-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Uvećana fotografija proizvoda');
  const enlarged = document.createElement('img');
  const close = document.createElement('button');
  close.className = 'image-lightbox-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Zatvori uvećanu fotografiju');
  close.textContent = '×';
  const caption = document.createElement('p');
  caption.className = 'image-lightbox-caption';
  const previous = document.createElement('button');
  previous.className = 'image-lightbox-nav image-lightbox-previous';
  previous.type = 'button';
  previous.setAttribute('aria-label', 'Prethodna fotografija');
  previous.textContent = '‹';
  const next = document.createElement('button');
  next.className = 'image-lightbox-nav image-lightbox-next';
  next.type = 'button';
  next.setAttribute('aria-label', 'Sljedeća fotografija');
  next.textContent = '›';
  overlay.append(enlarged, previous, next, close, caption);
  document.body.append(overlay);
  let previousFocus = null;
  let activeImages = [];
  let activeIndex = 0;

  function showImage(index) {
    if (!activeImages.length) return;
    activeIndex = (index + activeImages.length) % activeImages.length;
    const image = activeImages[activeIndex];
    enlarged.src = image.currentSrc || image.src;
    enlarged.alt = image.alt || 'Uvećana fotografija proizvoda';
    caption.textContent = (image.classList.contains('hero-product-image') ? 'Lavazza Firma' : (image.alt || '')) +
      (activeImages.length > 1 ? ` · ${activeIndex + 1} / ${activeImages.length}` : '');
    const hasNavigation = activeImages.length > 1;
    previous.hidden = !hasNavigation;
    next.hidden = !hasNavigation;
  }
  function openImage(image) {
    previousFocus = document.activeElement;
    const gallery = image.closest('.product-gallery, .model-image-gallery, .capsule-gallery');
    activeImages = gallery
      ? Array.from(gallery.querySelectorAll('img'))
      : [image];
    activeIndex = Math.max(0, activeImages.indexOf(image));
    showImage(activeIndex);
    overlay.classList.add('open');
    document.body.classList.add('lightbox-open');
    close.focus();
  }
  function closeImage() {
    overlay.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    enlarged.removeAttribute('src');
    activeImages = [];
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }
  previous.addEventListener('click', () => showImage(activeIndex - 1));
  next.addEventListener('click', () => showImage(activeIndex + 1));
  images.forEach(image => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', (image.alt || 'Fotografija proizvoda') + ' — kliknite za uvećanje');
    image.addEventListener('click', () => openImage(image));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openImage(image);
      }
    });
  });
  close.addEventListener('click', closeImage);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeImage();
  });

  // On touchscreens, swipe left/right in the enlarged image to browse the same gallery.
  let touchStartX = 0;
  let touchStartY = 0;
  overlay.addEventListener('touchstart', event => {
    if (!overlay.classList.contains('open') || !event.changedTouches.length) return;
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, {passive:true});
  overlay.addEventListener('touchend', event => {
    if (!overlay.classList.contains('open') || !event.changedTouches.length || activeImages.length < 2) return;
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      showImage(activeIndex + (dx < 0 ? 1 : -1));
    }
  }, {passive:true});

  document.addEventListener('keydown', event => {
    if (!overlay.classList.contains('open')) return;
    if (event.key === 'Escape') closeImage();
    else if (event.key === 'ArrowLeft' && activeImages.length > 1) showImage(activeIndex - 1);
    else if (event.key === 'ArrowRight' && activeImages.length > 1) showImage(activeIndex + 1);
  });
})();


// Copy the direct email address for visitors who prefer ordering by email.
document.querySelectorAll('[data-copy-email]').forEach(button => {
  button.addEventListener('click', async () => {
    const email = button.getAttribute('data-copy-email');
    const status = document.querySelector('.email-copy-status');
    try {
      await navigator.clipboard.writeText(email);
      if (status) status.textContent = 'E-mail adresa kopirana. Zalijepite je u svoju poruku.';
    } catch (error) {
      if (status) status.textContent = 'Označite adresu e-pošte iznad i kopirajte je.';
    }
  });
});


// Step 1: when an appliance is selected, the visitor chooses exactly its minimum number of capsule boxes.
const capsuleField = document.getElementById('capsules');
const capsuleVarietiesField = document.getElementById('capsule-varieties');
const capsuleModelField = document.getElementById('model');
const topicField = document.getElementById('topic');
const contractEmailFieldWrap = document.getElementById('contract-email-field');
const contractEmailField = document.getElementById('contract-email');
const modelFieldWrap = capsuleModelField ? capsuleModelField.closest('.field') : null;
const capsuleVarietiesWrap = capsuleVarietiesField ? capsuleVarietiesField.closest('.field') : null;
const capsuleQuantityWrap = capsuleField ? capsuleField.closest('.field') : null;
const additionalCapsulesField = document.getElementById('additional-capsules');
const additionalCapsuleVarietiesField = document.getElementById('additional-capsule-varieties');
const additionalCapsulesWrap = document.getElementById('additional-capsules-field');
const additionalCapsulesDetails = document.getElementById('additional-capsules-details');
const additionalCapsulesChoices = document.querySelectorAll('input[name="Dodatne kapsule"]');
const selectedCapsules = new Map();

function updateCapsuleButtonFeedback() {
  document.querySelectorAll('.capsule-select').forEach(button => {
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent.trim();
    const count = selectedCapsules.get(button.dataset.capsule) || 0;
    button.classList.toggle('capsule-selected', count > 0);
    button.setAttribute('aria-pressed', count > 0 ? 'true' : 'false');
    if (count > 0) {
      const word = count === 1 ? 'kutija' : (count >= 2 && count <= 4 ? 'kutije' : 'kutija');
      button.textContent = 'Odabrano: ' + count + ' ' + word + ' ✓';
    } else {
      button.textContent = button.dataset.originalLabel;
    }
  });
}

const capsuleSelectionStorageKey = 'zfk-selected-capsules-v1';

function saveCapsuleSelections() {
  try { localStorage.setItem(capsuleSelectionStorageKey, JSON.stringify(Array.from(selectedCapsules.entries()))); } catch (error) { /* Storage may be unavailable; current-page selection still works. */ }
}

function restoreCapsuleSelections() {
  try {
    const saved = JSON.parse(localStorage.getItem(capsuleSelectionStorageKey) || '[]');
    if (Array.isArray(saved)) saved.forEach(entry => {
      if (Array.isArray(entry) && typeof entry[0] === 'string' && Number.isFinite(entry[1]) && entry[1] > 0) {
        selectedCapsules.set(entry[0], Math.floor(entry[1]));
      }
    });
  } catch (error) { /* Ignore invalid or unavailable saved selections. */ }
}

// When a visitor chooses a model from the finder, use its calculated quantity
// as the package target instead of falling back to the model's ordinary minimum.
let finderPackageLimit = 0;

function capsulePackageLimit() {
  if (finderPackageLimit > 0) return finderPackageLimit;
  const selectedModel = capsuleModelField ? capsuleModelField.value : '';
  // Each box contains 100 capsules. Enforce the published minimum for each model.
  if (/LB\s*1300/i.test(selectedModel)) return 2;
  if (/LB2600/i.test(selectedModel)) return 3;
  return 0;
}

function isCapsuleOnlyOrder() {
  return topicField && topicField.value === 'Želim naručiti kapsule';
}

function isOfferQuestion() {
  return topicField && topicField.value === 'Imam pitanje o ponudi';
}

function wantsAdditionalCapsules() {
  const selected = document.querySelector('input[name="Dodatne kapsule"]:checked');
  return selected && selected.value === 'Da';
}

function resizeCapsuleVarietiesField() {
  [capsuleVarietiesField, additionalCapsuleVarietiesField].forEach(field => {
    if (!field || field.tagName !== 'TEXTAREA') return;
    field.style.height = 'auto';
    field.style.height = `${Math.max(field.scrollHeight, 72)}px`;
  });
}

function updateSelectedCapsuleField() {
  if (!capsuleField) return;
  const selectedBoxes = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
  const minimum = isCapsuleOnlyOrder() ? 0 : capsulePackageLimit();
  const boxLabel = selectedBoxes === 1
    ? '1 kutija'
    : selectedBoxes >= 2 && selectedBoxes <= 4
      ? `${selectedBoxes} kutije`
      : selectedBoxes >= 5
        ? `${selectedBoxes} kutija`
        : '';
  capsuleField.value = boxLabel;

  // Clear the visible validation state as soon as the required capsule quantity is selected.
  const capsuleSelectionWrap = capsuleField.closest('.capsule-selection-field');
  const capsuleSelectionNote = document.getElementById('capsule-selection-note');
  if (capsuleSelectionWrap && selectedBoxes >= minimum && minimum > 0) {
    capsuleSelectionWrap.classList.remove('capsule-selection-invalid');
    capsuleField.removeAttribute('aria-invalid');
    if (capsuleSelectionNote) capsuleSelectionNote.classList.remove('capsule-error-note');
    if (status && status.textContent.startsWith('Upit nije poslan. Obavezno odaberite')) status.textContent = '';
  }

  if (additionalCapsulesField) {
    const extraBoxes = Math.max(0, selectedBoxes - (isCapsuleOnlyOrder() ? 0 : minimum));
    const boxWord = extraBoxes === 1 ? 'kutija' : (extraBoxes >= 2 && extraBoxes <= 4 ? 'kutije' : 'kutija');
    additionalCapsulesField.value = `${extraBoxes} ${boxWord}`;
  }

  // For capsule-only orders, every selected box belongs in the main capsule summary.
  const packageBoxes = isCapsuleOnlyOrder() ? selectedBoxes : Math.min(selectedBoxes, minimum);
  const additionalBoxCount = Math.max(0, selectedBoxes - packageBoxes);
  const packageVarieties = new Map();
  const additionalVarieties = new Map();
  let remainingPackageBoxes = packageBoxes;

  selectedCapsules.forEach((qty, name) => {
    const inPackage = Math.min(qty, remainingPackageBoxes);
    if (inPackage > 0) packageVarieties.set(name, inPackage);
    remainingPackageBoxes -= inPackage;
    const extraQty = qty - inPackage;
    if (extraQty > 0) additionalVarieties.set(name, extraQty);
  });

  if (capsuleVarietiesField) {
    capsuleVarietiesField.value = packageVarieties.size
      ? Array.from(packageVarieties, ([name, qty]) => qty > 1 ? `${name} × ${qty}` : name).join(', ')
      : 'Nijedna vrsta još nije odabrana';
  }
  const additionalVarietiesText = additionalVarieties.size
    ? Array.from(additionalVarieties, ([name, qty]) => qty > 1 ? `${name} × ${qty}` : name).join(', ')
    : 'Nijedna dodatna vrsta još nije odabrana';

  // Keep the quantity field numeric-only; variety names stay in the separate field.
  if (additionalCapsulesField) {
    const extraBoxes = additionalBoxCount;
    additionalCapsulesField.value = `${extraBoxes} komada`;
  }
  if (additionalCapsuleVarietiesField) {
    additionalCapsuleVarietiesField.value = additionalVarietiesText;
  }
  // Grow both capsule summary fields to fit all varieties and quantities.
  resizeCapsuleVarietiesField();

  const note = document.getElementById('capsule-selection-note');
  if (note) {
    if (isCapsuleOnlyOrder()) {
      note.textContent = 'Svaki klik na „Odaberi ove kapsule” dodaje jednu kutiju.';
    } else if (minimum > 0) {
      const selectedCount = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
      note.textContent = selectedCount < minimum
        ? `Za odabrani aparat obavezno odaberite najmanje ${minimum} ${minimum === 1 ? 'kutiju kapsula' : 'kutije kapsula'}. Nakon odabira vratit ćemo vas na upit, gdje možete izabrati želite li odmah naručiti još kutija.`
        : 'Minimalna količina je odabrana. Nastavite na upit i odaberite DA ako želite dodati još kutija.';
    } else {
      note.textContent = 'Najprije odaberite aparat ili vrstu upita, a zatim izaberite kapsule.';
    }
  }

  updateCapsuleButtonFeedback();

  const offerQuestionOnly = isOfferQuestion();

  if (modelFieldWrap) {
    modelFieldWrap.hidden = isCapsuleOnlyOrder() || offerQuestionOnly;
  }
  if (capsuleVarietiesWrap) {
    capsuleVarietiesWrap.hidden = offerQuestionOnly;
  }
  if (capsuleQuantityWrap) {
    capsuleQuantityWrap.hidden = offerQuestionOnly;
  }

  if (additionalCapsulesWrap) {
    additionalCapsulesWrap.hidden = offerQuestionOnly || isCapsuleOnlyOrder() || !minimum;
  }
  if (additionalCapsulesDetails) {
    additionalCapsulesDetails.hidden = offerQuestionOnly || !wantsAdditionalCapsules() || isCapsuleOnlyOrder();
  }

  // These details are not sent with a general question, because that request needs only the message.
  [capsuleModelField, capsuleVarietiesField, capsuleField, additionalCapsulesField, additionalCapsuleVarietiesField, ...additionalCapsulesChoices]
    .filter(Boolean)
    .forEach(field => { field.disabled = offerQuestionOnly; });

  const extraDoneButton = document.getElementById('extra-capsules-done');
  if (extraDoneButton) {
    extraDoneButton.hidden = offerQuestionOnly || (isCapsuleOnlyOrder() ? selectedBoxes === 0 : !wantsAdditionalCapsules());
  }
  document.dispatchEvent(new Event('zfk:capsules-updated'));
}

document.querySelectorAll('.model-select').forEach(button => {
  button.addEventListener('click', () => {
    if (document.body.dataset.customerChangeMode === 'true') {
      const target = document.getElementById('change-model');
      const modelName = button.dataset.model || '';
      if (target) {
        target.value = /LB\\s*2600/i.test(modelName) ? 'Lavazza LB2600' : /LB\\s*300/i.test(modelName) ? 'Lavazza LB 1300 Classy Soul' : '';
        target.dispatchEvent(new Event('change', {bubbles:true}));
      }
      document.getElementById('promjena-kolicine')?.scrollIntoView({behavior:'smooth',block:'start'});
      window.setTimeout(() => document.getElementById('change-quantity')?.focus({preventScroll:true}),350);
      return;
    }
    // Finder and machine-card buttons share this handler. Match the canonical form
    // option by model family so longer display names (e.g. "LB2600")
    // still select the corresponding inquiry-form option ("Lavazza LB 2600").
    const modelName = button.dataset.model || '';
    const quantityMatch = (button.dataset.quantity || '').match(/(\d+)\s*kapsula/i);
    // A finder recommendation like "300 kapsula mjesečno" means three 100-capsule
    // boxes in the inquiry. Regular machine-card selections keep their usual minimum.
    finderPackageLimit = quantityMatch ? Math.max(1, Math.ceil(Number(quantityMatch[1]) / 100)) : 0;
    const modelPattern = /LB\s*1300/i.test(modelName)
      ? /LB\s*1300/i
      : /LB2600/i.test(modelName)
        ? /LB2600/i
        : null;
    const modelOption = modelPattern
      ? Array.from(capsuleModelField.options).find(item => modelPattern.test(item.textContent))
      : null;
    if (modelOption) capsuleModelField.value = modelOption.value || modelOption.textContent;
    topicField.value = 'Želim aparat uz mjesečnu kupnju kapsula';
    selectedCapsules.clear();
    saveCapsuleSelections();
    const noExtra = document.querySelector('input[name="Dodatne kapsule"][value="Ne"]');
    if (noExtra) noExtra.checked = true;
    if (status) status.textContent = '';
    updateSelectedCapsuleField();
    const capsuleSection = document.getElementById('kapsule');
    if (capsuleSection) capsuleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const note = document.getElementById('capsule-selection-note');
    if (note) note.focus?.({ preventScroll: true });
  });
});

document.querySelectorAll('.capsule-select').forEach(button => {
  button.addEventListener('click', () => {
    if (!capsuleField) return;
    const variety = button.dataset.capsule;
    if (document.body.dataset.customerChangeMode === 'true') {
      const quantityField = document.getElementById('change-quantity');
      const changeStatus = document.getElementById('customer-change-status');
      const capsuleText = document.getElementById('change-capsule-varieties');
      const sameQuantity = !!(quantityField && quantityField.value === 'same');
      const targetBoxes = Number(quantityField && quantityField.value) / 100;
      const selectedCount = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
      if (!sameQuantity && (!Number.isFinite(targetBoxes) || targetBoxes < 1)) {
        if (changeStatus) changeStatus.textContent = 'Najprije odaberite aparat i novu mjesečnu količinu u obrascu.';
        document.getElementById('promjena-kolicine')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      if (!sameQuantity && selectedCount >= targetBoxes) {
        if (changeStatus) changeStatus.textContent = 'Već ste odabrali vrste za svih ' + (targetBoxes * 100) + ' kapsula mjesečno.';
        document.getElementById('promjena-kolicine')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      selectedCapsules.set(variety, (selectedCapsules.get(variety) || 0) + 1);
      saveCapsuleSelections();
      updateChangeCapsuleField();
      if (changeStatus) changeStatus.textContent = '';
      if (!sameQuantity && selectedCount + 1 >= targetBoxes) window.setTimeout(() => document.getElementById('promjena-kolicine')?.scrollIntoView({behavior:'smooth',block:'start'}),250);
      return;
    }
    const selectedBoxes = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
    const minimum = isCapsuleOnlyOrder() ? 0 : capsulePackageLimit();
    const addingExtras = !isCapsuleOnlyOrder() && wantsAdditionalCapsules() && selectedBoxes >= minimum;

    if (!isCapsuleOnlyOrder() && !minimum) {
      if (status) status.textContent = 'Najprije odaberite aparat u odjeljku „ODABERITE SVOJ MODEL”, a zatim odaberite kapsule.';
      const modelSection = document.getElementById('ponuda');
      if (modelSection) {
        // On phones, reliably move the visitor to model selection before allowing
        // any capsule choice; delay scrolling slightly so the tap/UI update settles.
        if (window.matchMedia('(max-width: 760px)').matches) {
          window.location.hash = 'ponuda';
          window.setTimeout(() => modelSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        } else {
          modelSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      return;
    }
    if (!isCapsuleOnlyOrder() && selectedBoxes >= minimum && !addingExtras) {
      if (status) status.textContent = `Za ovaj aparat odaberite ukupno ${minimum} ${minimum === 1 ? 'kutiju' : 'kutije'}. Već ste odabrali tu količinu.`;
      return;
    }

    selectedCapsules.set(variety, (selectedCapsules.get(variety) || 0) + 1);
    saveCapsuleSelections();
    updateSelectedCapsuleField();
    if (status) status.textContent = '';
    if (!isCapsuleOnlyOrder() && minimum > 0 && selectedBoxes + 1 === minimum) {
      const enquirySection = document.getElementById('narudzba');
      if (enquirySection) window.setTimeout(() => enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    }
  });
});

additionalCapsulesChoices.forEach(choice => {
  choice.addEventListener('change', () => {
    if (choice.value === 'Ne') {
      // Switching back to NE cancels every capsule box selected as an extra.
      const minimum = capsulePackageLimit();
      let remainingPackageBoxes = minimum;
      const packageSelections = new Map();

      selectedCapsules.forEach((qty, name) => {
        const keepQty = Math.min(qty, remainingPackageBoxes);
        if (keepQty > 0) packageSelections.set(name, keepQty);
        remainingPackageBoxes -= keepQty;
      });

      selectedCapsules.clear();
      packageSelections.forEach((qty, name) => selectedCapsules.set(name, qty));
      saveCapsuleSelections();
    }

    updateSelectedCapsuleField();
    if (choice.value === 'Da') {
      const capsuleSection = document.getElementById('kapsule');
      if (capsuleSection) capsuleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const enquirySection = document.getElementById('narudzba');
      if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

const extraCapsulesDoneButton = document.getElementById('extra-capsules-done');
if (extraCapsulesDoneButton) {
  extraCapsulesDoneButton.addEventListener('click', () => {
    const enquirySection = document.getElementById('narudzba');
    if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function updateContractEmailField() {
  const required = isCapsuleOnlyOrder();
  if (contractEmailFieldWrap) contractEmailFieldWrap.hidden = !required;
  if (contractEmailField) {
    contractEmailField.required = required;
    if (!required) contractEmailField.value = '';
  }
}

if (topicField) {
  updateContractEmailField();
  topicField.addEventListener('change', () => {
    finderPackageLimit = 0;
    updateContractEmailField();
    if ((isCapsuleOnlyOrder() || isOfferQuestion()) && capsuleModelField) {
      // Do not include a previously selected appliance with a capsule-only order or a general question.
      capsuleModelField.selectedIndex = 0;
      const noExtra = document.querySelector('input[name="Dodatne kapsule"][value="Ne"]');
      if (noExtra) noExtra.checked = true;
    }
    selectedCapsules.clear();
    saveCapsuleSelections();
    if (status) status.textContent = '';
    updateSelectedCapsuleField();
  });
}

if (capsuleModelField) {
  capsuleModelField.addEventListener('change', () => {
    finderPackageLimit = 0;
    selectedCapsules.clear();
    saveCapsuleSelections();
    if (status) status.textContent = '';
    updateSelectedCapsuleField();
  });
}

// Do not revive a stale capsule quantity from an earlier visit. Keep saved choices
// only when returning from a capsule detail page, where the query parameter records
// the user's explicit add-to-order action.
const capsuleFromDetail = params.get('odaberiKapsulu');
if (capsuleFromDetail) {
  restoreCapsuleSelections();
} else {
  selectedCapsules.clear();
  try { localStorage.removeItem(capsuleSelectionStorageKey); } catch (error) { /* Storage may be unavailable. */ }
}
updateSelectedCapsuleField();

// A capsule chosen on its detail page adds one box without clearing earlier choices.
if (capsuleFromDetail && capsuleField && topicField) {
  const matchingCapsuleButton = Array.from(document.querySelectorAll('.capsule-select'))
    .find(button => button.dataset.capsule === capsuleFromDetail);
  if (matchingCapsuleButton) {
    topicField.value = 'Želim naručiti kapsule';
    selectedCapsules.set(capsuleFromDetail, (selectedCapsules.get(capsuleFromDetail) || 0) + 1);
    saveCapsuleSelections();
    updateSelectedCapsuleField();
    if (status) status.textContent = '';
    params.delete('odaberiKapsulu');
    const remainingQuery = params.toString();
    const cleanUrl = window.location.pathname + (remainingQuery ? '?' + remainingQuery : '') + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}



// First screen: new visitors browse normally; existing customers open the dedicated monthly-quantity form.
(function setupCustomerGateway(){
  const routes = document.querySelectorAll('[data-customer-route]');
  const changeSection = document.getElementById('promjena-kolicine');
  const changeForm = document.getElementById('customer-change-form');
  const changeModel = document.getElementById('change-model');
  routes.forEach(link => link.addEventListener('click', event => {
    if (link.dataset.customerRoute !== 'existing') return;
    event.preventDefault();
    if (changeSection) changeSection.hidden = false;
    document.body.dataset.customerChangeMode = 'true';
    if (changeSection) {
      changeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        const firstField = changeForm && changeForm.querySelector('input:not([type="hidden"])');
        if (firstField) firstField.focus({ preventScroll: true });
      }, 400);
    }
  }));
  const chooseCapsules = document.getElementById('change-choose-capsules');
  if (chooseCapsules) chooseCapsules.addEventListener('click', () => {
    const quantity = document.getElementById('change-quantity');
    const status = document.getElementById('customer-change-status');
    if (!changeModel || !changeModel.value || !quantity || !quantity.value) {
      if (status) status.textContent = 'Najprije odaberite aparat i novu mjesečnu količinu.';
      if (changeModel && !changeModel.value) changeModel.focus();
      else if (quantity) quantity.focus();
      return;
    }
    document.body.dataset.customerChangeMode = 'true';
    selectedCapsules.clear();
    saveCapsuleSelections();
    updateChangeCapsuleField();
    const gallery = document.getElementById('kapsule');
    if (gallery) gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
 
/* Interactive appliance finder with capsule-use estimate and recommendation rules. */
(function setupApplianceFinder(){
  const finder = document.getElementById('appliance-finder');
  if (!finder) return;
  const steps = Array.from(finder.querySelectorAll('[data-finder-step]'));
  const result = document.getElementById('finder-result');
  const progressLabel = document.getElementById('finder-progress-label');
  const progressFill = document.getElementById('finder-progress-fill');
  const statusMessage = document.getElementById('finder-status');
  const resultTitle = document.getElementById('finder-result-title');
  const resultCopy = document.getElementById('finder-result-copy');
  const resultTag = document.getElementById('finder-result-tag');
  const resultFacts = document.getElementById('finder-result-facts');
  const resultButton = result.querySelector('.finder-result-button');
  const resultModels = document.getElementById('finder-result-models');
  const peopleInput = document.getElementById('finder-people-count');
  const monthlyEstimate = document.getElementById('finder-monthly-estimate');
  const boxEstimate = document.getElementById('finder-box-estimate');
  let activeStep = 1;
  const useLabels = {home:'za dom', apartment:'za apartman', office:'za ured ili poslovni prostor'};
  const models = {
    mini:{name:'LB 1300 Classy Soul',modelValue:'Lavazza LB 1300 Classy Soul',quantity:'Preporučena količina prema vodiču',tag:'Za espresso i crnu kavu',facts:['Kompaktan format','Za espresso i crnu kavu','Bez sustava za mliječne napitke']},
    milk:{name:'LB2600',modelValue:'Lavazza LB2600',quantity:'Preporučena količina prema vodiču',tag:'Za mliječne napitke i veće potrebe',facts:['Za espresso i mliječne napitke','Spremnik za vodu od 3,6 l','Spremnik za iskorištene kapsule do 25 kapsula']}
  };
  function answer(name){const chosen=finder.querySelector(`input[name="${name}"]:checked`);return chosen?chosen.value:'';}
  function people(){const n=Number.parseInt(peopleInput.value,10);return Number.isFinite(n)?Math.min(500,Math.max(1,n)):1;}
  function estimate(){const count=people();const monthly=count*40;const boxes=Math.floor(monthly/100)+1;monthlyEstimate.textContent=`${monthly} kapsula mjesečno`;boxEstimate.textContent=`${boxes*100} kapsula (${boxes} ${boxes===1?'kutija':'kutija'})`;return {count,monthly,boxes,total:boxes*100};}
  function showStep(step){activeStep=step;steps.forEach(item=>{item.hidden=Number(item.dataset.finderStep)!==step;});result.hidden=true;statusMessage.textContent='';progressLabel.textContent=`Korak ${step} od ${steps.length}`;progressFill.style.width=`${(step/steps.length)*100}%`;const fieldset=steps.find(item=>Number(item.dataset.finderStep)===step)?.querySelector('fieldset');if(fieldset)fieldset.focus({preventScroll:true});}
  function setModelButton(button,model,quantity){button.dataset.model=model.modelValue;button.dataset.quantity=quantity;button.setAttribute('aria-label',`Odaberi aparat ${model.name}`);}
  function showRecommendation(){
    const use=answer('finder-use'),drinks=answer('finder-drinks');
    if(!use||!drinks){statusMessage.textContent='Odaberite odgovor prije prikaza preporuke.';return;}
    const e=estimate();
    let key='',showBoth=false,tag='',copy='';
    if(drinks==='black'){key='mini';tag='Preporuka prema vašim željama';copy=`Budući da želite samo espresso i crnu kavu, preporučujemo LB 1300 Classy Soul ${useLabels[use]}. Veća potrošnja kapsula ne isključuje ovaj model ako ne trebate mliječne napitke.`;}
    else if(drinks==='milk'){key='milk';tag='Preporuka prema vašim željama';copy=`Budući da želite i mliječne napitke, preporučujemo LB2600 ${useLabels[use]}.`;}
    else if(e.count>3||e.monthly>=300){key='milk';showBoth=true;tag='Naš savjet: LB2600';copy=`Uz ${e.count} osoba procijenjena je potrošnja ${e.monthly} kapsula mjesečno. Za više od 3 osobe praktičniji može biti LB2600 zbog većeg spremnika za vodu i kapaciteta za iskorištene kapsule. Od 300 kapsula mjesečno naviše posebno ga preporučujemo. Ipak, konačan izbor je vaš.`;}
    else {showBoth=true;tag='Usporedite oba modela';copy=`Uz ${e.count} osoba procijenjena je potrošnja ${e.monthly} kapsula mjesečno. Budući da još niste odlučili koje napitke želite, usporedite oba aparata i odaberite onaj koji vam više odgovara.`;}
    const model=key?models[key]:null;
    resultTag.textContent=tag;resultTitle.textContent=showBoth?'Koji aparat vam više odgovara?':`Lavazza ${model.name}`;resultCopy.textContent=copy;
    const modelMinimum = key === 'mini' ? 200 : key === 'milk' ? 300 : 0;
    const recommendedTotal = Math.max(e.total, modelMinimum);
    const recommendedBoxes = recommendedTotal / 100;
    resultFacts.replaceChildren();
    [`Procijenjena potrošnja: ${e.monthly} kapsula mjesečno`,`Preporučena ugovorena količina: ${recommendedTotal} kapsula (${recommendedBoxes} kutije)`,`Broj osoba: ${e.count}`].concat(model?model.facts:[]).forEach(fact=>{const li=document.createElement('li');li.textContent=fact;resultFacts.append(li);});
    resultModels.hidden=!showBoth;resultButton.hidden=showBoth;
    if(model)setModelButton(resultButton,model,`${recommendedTotal} kapsula mjesečno (preporuka vodiča)`);
    resultModels.querySelectorAll('.finder-model-button').forEach(button=>{const m=button.dataset.model.includes('2600')?models.milk:models.mini;const total=Math.max(e.total,m===models.milk?300:200);setModelButton(button,m,`${total} kapsula mjesečno (preporuka vodiča)`);});
    steps.forEach(item=>{item.hidden=true;});result.hidden=false;statusMessage.textContent='';progressLabel.textContent='Preporuka je spremna';progressFill.style.width='100%';resultTitle.focus({preventScroll:true});
  }
  finder.querySelectorAll('[data-finder-next]').forEach(button=>button.addEventListener('click',()=>{const current=steps.find(item=>Number(item.dataset.finderStep)===activeStep);if(!current||!current.querySelector('input[type="radio"]:checked')){statusMessage.textContent='Odaberite jednu opciju za nastavak.';return;}showStep(Number(button.dataset.finderNext));}));
  finder.querySelectorAll('[data-finder-prev]').forEach(button=>button.addEventListener('click',()=>showStep(Number(button.dataset.finderPrev))));
  document.getElementById('finder-show-result')?.addEventListener('click',showRecommendation);
  document.getElementById('finder-people-minus')?.addEventListener('click',()=>{peopleInput.value=String(Math.max(1,people()-1));estimate();});
  document.getElementById('finder-people-plus')?.addEventListener('click',()=>{peopleInput.value=String(Math.min(500,people()+1));estimate();});
  peopleInput?.addEventListener('input',estimate);
  document.getElementById('finder-restart')?.addEventListener('click',()=>{finder.querySelectorAll('input[type="radio"]').forEach(input=>{input.checked=false;});peopleInput.value='1';estimate();resultModels.hidden=true;resultButton.hidden=false;showStep(1);});
  estimate();showStep(1);
})();
 
 
/* Native page scrolling; only in-page actions use the browser's gentle smooth-scroll behavior. */


/* Hero slideshow: slow crossfades, with a pause control and reduced-motion support. */
(function setupHeroSlideshow(){
  const gallery = document.querySelector('.hero-photo');
  if (!gallery) return;
  const slides = Array.from(gallery.querySelectorAll('[data-hero-slide]'));
  const toggle = document.getElementById('hero-slideshow-toggle');
  const counter = document.getElementById('hero-slide-count');
  const progress = gallery.querySelector('.hero-slide-progress');
  if (slides.length < 2) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeSlide = slides.find(slide => slide.classList.contains('is-active')) || slides[0];
  let timer = null;
  let paused = reduceMotion.matches;
  const intervalMs = 6200;

  function availableSlides(){
    return slides.filter(slide => slide.dataset.failed !== 'true');
  }
  function renderCounter(){
    const available = availableSlides();
    const position = Math.max(0, available.indexOf(activeSlide)) + 1;
    if (counter) counter.textContent = String(position).padStart(2,'0') + ' / ' + String(available.length).padStart(2,'0');
  }
  function activate(slide){
    if (!slide || slide.dataset.failed === 'true') return;
    activeSlide = slide;
    slides.forEach(item => {
      const active = item === slide;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-hidden', active ? 'false' : 'true');
      item.tabIndex = active ? 0 : -1;
    });
    renderCounter();
    gallery.classList.remove('hero-slideshow-running');
    if (progress) progress.offsetWidth;
    if (!paused && !reduceMotion.matches) requestAnimationFrame(() => gallery.classList.add('hero-slideshow-running'));
  }
  function advance(){
    const available = availableSlides();
    if (available.length < 2) return;
    const current = available.indexOf(activeSlide);
    activate(available[(current + 1 + available.length) % available.length]);
  }
  function stop(){
    if (timer) window.clearInterval(timer);
    timer = null;
    gallery.classList.remove('hero-slideshow-running');
  }
  function start(){
    stop();
    if (paused || reduceMotion.matches || document.hidden || availableSlides().length < 2) return;
    gallery.classList.add('hero-slideshow-running');
    timer = window.setInterval(advance, intervalMs);
  }

  slides.forEach(slide => {
    slide.addEventListener('error', () => {
      const wasActive = slide === activeSlide;
      slide.dataset.failed = 'true';
      slide.style.display = 'none';
      if (wasActive) {
        const next = availableSlides()[0];
        if (next) activate(next);
      }
      renderCounter();
      start();
    }, {once:true});
    slide.tabIndex = slide === activeSlide ? 0 : -1;
    slide.setAttribute('aria-hidden', slide === activeSlide ? 'false' : 'true');
  });

  if (toggle){
    toggle.hidden = reduceMotion.matches;
    toggle.addEventListener('click', () => {
      paused = !paused;
      toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
      toggle.setAttribute('aria-label', paused ? 'Nastavi izmjenu fotografija' : 'Pauziraj izmjenu fotografija');
      toggle.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
      if (paused) stop(); else start();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
  if (typeof reduceMotion.addEventListener === 'function'){
    reduceMotion.addEventListener('change', event => {
      if (toggle) toggle.hidden = event.matches;
      if (event.matches){ paused = true; stop(); }
      else { paused = false; start(); }
    });
  }
  renderCounter();
  start();
})();

/* Gentle image parallax for the full-width video thumbnail; the PLAY link opens YouTube in a new tab. */
(function setupFilmImageParallax(){
  const section = document.getElementById('lavazza-film');
  const image = section && section.querySelector('.film-banner-image');
  if (!section || !image) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches) return;
  let framePending = false;

  function updateImagePosition(){
    framePending = false;
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom < 0 || rect.top > viewportHeight) return;
    const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
    // Stronger parallax: the enlarged photo travels upward as the page scrolls down.
    const shift = (progress - 0.5) * -260;
    image.style.setProperty('--film-image-shift', shift.toFixed(1) + 'px');
  }
  function requestUpdate(){
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateImagePosition);
  }
  window.addEventListener('scroll', requestUpdate, {passive:true});
  window.addEventListener('resize', requestUpdate);
  updateImagePosition();
})();


/* On phones, move the same PLAY link onto the hero photo; restore it to the capsule banner on wider screens. */
(function placeMobilePlayOnHeroImage(){
  const play = document.querySelector('#lavazza-film .film-banner-play');
  const banner = document.querySelector('#lavazza-film .film-banner');
  const heroImage = document.querySelector('.hero-image-wrap');
  if (!play || !banner || !heroImage) return;

  const mobile = window.matchMedia('(max-width: 700px), (orientation: landscape) and (max-height: 520px)');
  function place(){
    if (mobile.matches){
      if (play.parentElement !== heroImage) heroImage.appendChild(play);
    } else if (play.parentElement !== banner){
      banner.appendChild(play);
    }
  }
  place();
  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', place);
  else if (typeof mobile.addListener === 'function') mobile.addListener(place);
})();


/* Mobile-specific scroll effects: lightweight reveal and subtle portrait hero parallax. */
(function setupMobileScrollEffects(){
  const mobile = window.matchMedia('(max-width:700px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!mobile.matches) return;

  const revealTargets = Array.from(document.querySelectorAll('.model-card, .capsule-card, #kako-radi .steps article'));
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {threshold:0.12, rootMargin:'0px 0px -36px 0px'});

    const groups = [
      Array.from(document.querySelectorAll('.model-card')),
      Array.from(document.querySelectorAll('.capsule-card')),
      Array.from(document.querySelectorAll('#kako-radi .steps article'))
    ];
    groups.forEach(group => group.forEach((element,index) => {
      element.classList.add('mobile-reveal');
      element.style.setProperty('--mobile-reveal-delay', Math.min(index,3) * 55 + 'ms');
      observer.observe(element);
    }));
  }

  // Keep the parallax deliberately subtle and limited to portrait phones.
  const portrait = window.matchMedia('(max-width:700px) and (orientation:portrait)');
  const hero = document.querySelector('.hero-image-wrap');
  const heroImage = hero && hero.querySelector('.hero-product-image');
  if (!hero || !heroImage || reduceMotion.matches || !portrait.matches) return;

  let framePending = false;
  function updateParallax(){
    framePending = false;
    if (!portrait.matches || !mobile.matches || reduceMotion.matches) {
      heroImage.style.removeProperty('--mobile-hero-shift');
      return;
    }
    const rect = hero.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom < 0 || rect.top > viewportHeight) return;
    const distance = (viewportHeight * 0.5) - (rect.top + rect.height * 0.5);
    const shift = Math.max(-12, Math.min(12, distance * -0.025));
    heroImage.style.setProperty('--mobile-hero-shift', shift.toFixed(1) + 'px');
  }
  function scheduleParallax(){
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateParallax);
  }
  window.addEventListener('scroll', scheduleParallax, {passive:true});
  window.addEventListener('resize', scheduleParallax);
  if (typeof portrait.addEventListener === 'function') portrait.addEventListener('change', scheduleParallax);
  updateParallax();
})();


function refreshCustomerChangeButtons(){
  const form = document.getElementById('customer-change-form');
  if (!form) return;
  const chooseButton = document.getElementById('change-choose-capsules');
  const submitButton = form.querySelector('button[type="submit"]');
  const quantity = document.getElementById('change-quantity');
  const capsuleVarieties = document.getElementById('change-capsule-varieties');
  const consent = document.getElementById('change-consent');
  const selectedBoxes = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
  const sameQuantity = !!(quantity && quantity.value === 'same');
  const targetBoxes = Number(quantity && quantity.value) / 100;

  if (chooseButton) {
    const hasCapsules = selectedBoxes > 0 && !!(capsuleVarieties && capsuleVarieties.value.trim());
    chooseButton.classList.toggle('is-ready', hasCapsules);
    chooseButton.style.setProperty('background-color', hasCapsules ? '#003da5' : '#8a8f98', 'important');
    chooseButton.style.setProperty('border-color', hasCapsules ? '#003da5' : '#8a8f98', 'important');
    chooseButton.style.setProperty('color', '#fff', 'important');
  }

  const fieldsReady = Array.from(form.querySelectorAll('[required]')).every(field =>
    !field.disabled && field.checkValidity()
  );
  const capsuleSelectionReady = sameQuantity
    ? selectedBoxes > 0
    : Number.isFinite(targetBoxes) && targetBoxes > 0 && selectedBoxes === targetBoxes;
  const ready = fieldsReady && !!(consent && consent.checked) &&
    capsuleSelectionReady &&
    !!(capsuleVarieties && capsuleVarieties.value.trim());
  if (submitButton) {
    submitButton.classList.toggle('is-ready', ready);
    submitButton.style.setProperty('background-color', ready ? '#003da5' : '#8a8f98', 'important');
    submitButton.style.setProperty('border-color', ready ? '#003da5' : '#8a8f98', 'important');
    submitButton.style.setProperty('color', '#fff', 'important');
  }
}

function updateChangeCapsuleField(){
  const capsuleVarieties = document.getElementById('change-capsule-varieties');
  const quantity = document.getElementById('change-quantity');
  const capsuleNote = document.getElementById('change-capsule-note');
  if (!capsuleVarieties) return;
  const selectedBoxes = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
  capsuleVarieties.value = selectedBoxes
    ? Array.from(selectedCapsules, ([name, qty]) => qty > 1 ? name + ' × ' + qty : name).join(', ')
    : '';
  const sameQuantity = !!(quantity && quantity.value === 'same');
  const targetBoxes = Number(quantity && quantity.value) / 100;
  if (capsuleNote && sameQuantity) {
    capsuleNote.textContent = selectedBoxes
      ? 'Odabrane vrste kapsula za promjenu; postojeća mjesečna količina ostaje ista.'
      : 'Količina ostaje ista. U galeriji odaberite barem jednu kutiju željenih vrsta kapsula.';
  } else if (capsuleNote && targetBoxes > 0) {
    capsuleNote.textContent = selectedBoxes < targetBoxes
      ? 'Odabrano ' + (selectedBoxes * 100) + ' od ' + (targetBoxes * 100) + ' kapsula. Odaberite još ' + ((targetBoxes - selectedBoxes) * 100) + ' kapsula u galeriji.'
      : 'Odabir kapsula je popunjen za željenu mjesečnu količinu.';
  } else if (capsuleNote) {
    capsuleNote.textContent = 'Obavezno: odaberite vrste kapsula u galeriji dok ne dosegnete odabranu mjesečnu količinu. Svaki klik dodaje jednu kutiju od 100 kapsula.';
  }
  updateCapsuleButtonFeedback();
  refreshCustomerChangeButtons();
}



/* Existing customers can request a monthly capsule quantity change. */
(function setupCustomerQuantityChange(){
  const form = document.getElementById('customer-change-form');
  const model = document.getElementById('change-model');
  const newModel = document.getElementById('change-new-model');
  const quantity = document.getElementById('change-quantity');
  const note = document.getElementById('change-quantity-note');
  const status = document.getElementById('customer-change-status');
  const capsuleVarieties = document.getElementById('change-capsule-varieties');
  const capsuleNote = document.getElementById('change-capsule-note');
  const chooseCapsules = document.getElementById('change-choose-capsules');
  if (!form || !model || !quantity) return;

  const minimums = {
    'Lavazza LB 1300 Classy Soul': 200,
    'Lavazza LB2600': 300
  };
  function effectiveModel(){
    const currentModel = model.value;
    const requestedModel = newModel && newModel.value;
    // The stable "same" option explicitly means keep the current appliance.
    if (requestedModel === 'same') return currentModel;
    return requestedModel && Object.prototype.hasOwnProperty.call(minimums, requestedModel)
      ? requestedModel
      : currentModel;
  }
  // Keep the native select's option nodes stable for mobile browsers.
  // Only hide quantities below the selected appliance's minimum.
  function configure(){
    const targetModel = effectiveModel();
    const minimum = minimums[targetModel];
    const previousQuantity = quantity.value;
    if (!quantity.dataset.optionsReady) {
      quantity.replaceChildren();
      quantity.add(new Option('Odaberite količinu', ''));
      quantity.add(new Option('Samo promjena vrste kapsula (količina ostaje ista)', 'same'));
      for (let amount = 200; amount <= 2000; amount += 100) {
        quantity.add(new Option(amount + ' kapsula (' + amount / 100 + ' kutije)', String(amount)));
      }
      quantity.dataset.optionsReady = 'true';
    }
    Array.from(quantity.options).forEach(option => {
      const amount = Number(option.value);
      if (option.value && option.value !== 'same' && Number.isFinite(amount)) {
        option.hidden = !!minimum && amount < minimum;
        option.disabled = !minimum || amount < minimum;
      }
    });
    quantity.disabled = !minimum;
    if (!minimum) {
      quantity.value = '';
      if (note) note.textContent = 'Najprije odaberite aparat u polju „Vaš aparat”.';
      return;
    }
    if (previousQuantity && previousQuantity !== 'same' && Number(previousQuantity) < minimum) {
      quantity.value = '';
    }
    const isSwitching = !!(newModel && newModel.value && newModel.value !== 'same' && newModel.value !== model.value);
    if (note) note.textContent = (newModel && newModel.value === 'same' ? 'Aparat ostaje isti. ' : '') +
      'Minimalno ' + minimum + ' kapsula mjesečno za ' + (isSwitching ? 'novi odabrani aparat' : 'odabrani aparat') +
      '. Količine su u koracima od 100 kapsula.';
  }
  function configureNewModel(){
    if (!newModel) return;
    // Keep a stable set of native <option> elements. Replacing the options each
    // time the current model changes can make mobile browser pickers lose taps
    // or reset their selected value.
    const options = Array.from(newModel.options);
    const placeholder = options.find(option => option.value === '');
    const same = options.find(option => option.value === 'same');
    const soul = options.find(option => option.value === 'Lavazza LB 1300 Classy Soul');
    const lb2600 = options.find(option => option.value === 'Lavazza LB2600');
    const current = model.value;
    if (placeholder) placeholder.textContent = current
      ? 'Odaberite ostanak ili novi aparat'
      : 'Najprije odaberite svoj aparat';
    if (same) same.textContent = 'Bez promjene aparata';
    if (soul) soul.textContent = current === soul.value
      ? 'Trenutačni aparat: Lavazza LB 1300 Classy Soul'
      : 'Novi aparat: Lavazza LB 1300 Classy Soul';
    if (lb2600) lb2600.textContent = current === lb2600.value
      ? 'Trenutačni aparat: Lavazza LB2600'
      : 'Novi aparat: Lavazza LB2600';
    newModel.disabled = false;
    // Do not silently select a model. Preserve a user's explicit choice.
    if (newModel.value === current && current) newModel.value = 'same';
  }
  function clearCapsuleChoices(){
    selectedCapsules.clear();
    saveCapsuleSelections();
    updateChangeCapsuleField();
    if (status) status.textContent = '';
  }
  const refreshMachineOptions = () => {
    configureNewModel();
    configure();
    clearCapsuleChoices();
  };
  // Native select controls on mobile/tablet may emit both input and change.
  // Rebuilding dependent selects twice can erase the user's choice, so react
  // to the committed selection only.
  model.addEventListener('change', refreshMachineOptions);
  if (newModel) {
    const refreshNewMachine = () => {
      // Choosing "Bez promjene aparata" must keep the quantity/capsule-change
      // selector available for the existing appliance.
      const keepingCurrent = newModel.value === 'same';
      if (!keepingCurrent) quantity.value = '';
      configure();
      if (keepingCurrent && model.value && minimums[model.value]) {
        quantity.disabled = false;
        if (note) note.textContent = 'Aparat ostaje isti. Odaberite novu mjesečnu količinu ili samo promjenu vrste kapsula.';
      }
      clearCapsuleChoices();
      refreshCustomerChangeButtons();
    };
    newModel.addEventListener('change', refreshNewMachine);
  }
  quantity.addEventListener('change', () => {
    clearCapsuleChoices();
    refreshCustomerChangeButtons();
  });
  form.addEventListener('input', refreshCustomerChangeButtons);
  form.addEventListener('change', refreshCustomerChangeButtons);
  configureNewModel();
  configure();
  updateChangeCapsuleField();
  form.addEventListener('submit', event => {
    const minimum = minimums[effectiveModel()];
    const sameQuantity = quantity.value === 'same';
    const amount = Number(quantity.value);
    const selectedBoxes = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
    if (!sameQuantity && (!minimum || !Number.isFinite(amount) || amount < minimum || amount % 100 !== 0)) {
      event.preventDefault();
      if (status) status.textContent = 'Odaberite aparat i valjanu mjesečnu količinu prije slanja zahtjeva.';
      quantity.focus();
      return;
    }
    if ((sameQuantity ? selectedBoxes < 1 : selectedBoxes !== amount / 100) || !capsuleVarieties || !capsuleVarieties.value.trim()) {
      event.preventDefault();
      updateChangeCapsuleField();
      if (status) status.textContent = 'Obavezno odaberite vrste kapsula za cijelu željenu mjesečnu količinu.';
      if (capsuleVarieties) capsuleVarieties.focus();
      return;
    }
    if (status) status.textContent = 'Zahtjev se šalje…';
  });
  const params = new URLSearchParams(window.location.search);
  if (params.has('promjena-poslana')) {
    const section = document.getElementById('promjena-kolicine');
    if (section) {
      section.hidden = false;
      document.body.dataset.customerChangeMode = 'true';
    }
    if (status) {
      status.textContent = 'Poruka je uspješno poslana!';
      status.hidden = false;
    }
    params.delete('promjena-poslana');
    const query = params.toString();
    window.history.replaceState({}, document.title, window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    if (section) window.requestAnimationFrame(() => section.scrollIntoView({ behavior: 'auto', block: 'start' }));
  }
})();




(function handleCustomerRouteMode(){
  document.querySelectorAll('[data-customer-route="new"]').forEach(link => link.addEventListener('click', () => {
    delete document.body.dataset.customerChangeMode;
    const section = document.getElementById('promjena-kolicine');
    if (section) section.hidden = true;
  }));
})();


// Give a visual cue when the new-customer form is ready to submit.
(function markOrderFormReady(){
  const form = document.getElementById('order-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const topic = document.getElementById('topic');
  const model = document.getElementById('model');
  const consent = document.getElementById('consent');
  const varieties = document.getElementById('capsule-varieties');
  let refreshQueued = false;

  function isVisible(field){
    if (field.disabled || field.closest('[hidden]')) return false;
    const style = window.getComputedStyle(field);
    return style.display !== 'none' && style.visibility !== 'hidden' && field.getClientRects().length > 0;
  }

  function refreshButton(){
    refreshQueued = false;
    const requiredFields = Array.from(form.querySelectorAll('[required]')).filter(isVisible);
    let ready = requiredFields.every(field => field.checkValidity());
    if (!consent || !consent.checked) ready = false;

    const applianceOrder = topic && topic.value === 'Želim aparat uz mjesečnu kupnju kapsula';
    if (applianceOrder) {
      if (!model || !model.value || !varieties || !varieties.value.trim() ||
          varieties.value.trim() === 'Nijedna vrsta još nije odabrana') ready = false;
    }

    if (button) {
      button.classList.toggle('is-ready', ready);
      const color = ready ? '#003da5' : '#8a8f98';
      button.style.setProperty('background-color', color, 'important');
      button.style.setProperty('background', color, 'important');
      button.style.setProperty('border-color', color, 'important');
      button.style.setProperty('color', '#fff', 'important');
      button.setAttribute('aria-disabled', ready ? 'false' : 'true');
    }
  }

  function queueRefresh(){
    if (refreshQueued) return;
    refreshQueued = true;
    window.setTimeout(refreshButton, 0);
  }

  // Capture events from controls and refresh after capsule-selection code has updated the form.
  ['input','change','click','focusout','keyup','pointerup','touchend'].forEach(type =>
    form.addEventListener(type, queueRefresh, {capture:true, passive:type === 'touchend'})
  );
  document.addEventListener('zfk:capsules-updated', queueRefresh);
  [topic, model, varieties, consent].filter(Boolean).forEach(field => {
    field.addEventListener('input', queueRefresh);
    field.addEventListener('change', queueRefresh);
  });
  document.addEventListener('visibilitychange', queueRefresh);
  window.addEventListener('pageshow', queueRefresh);
  window.addEventListener('resize', queueRefresh);
  window.addEventListener('orientationchange', queueRefresh);
  queueRefresh();
})();

/* Submit both ZFK forms through Web3Forms without leaving the page. */
(function setupWeb3FormsSubmission(){
  const forms = [document.getElementById('order-form'), document.getElementById('customer-change-form')].filter(Boolean);
  forms.forEach(form => {
    form.setAttribute('method', 'POST');
    form.setAttribute('action', 'https://api.web3forms.com/submit');
    form.addEventListener('submit', async event => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const isExisting = form.id === 'customer-change-form';
      const statusElement = document.getElementById(isExisting ? 'customer-change-status' : 'status');
      const successElement = isExisting ? statusElement : document.getElementById('success-message');
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton ? submitButton.innerHTML : '';
      const subjectField = form.querySelector('input[name="subject"]');
      if (subjectField) {
        const submittedAt = new Date();
        const timestamp = submittedAt.toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'medium' });
        subjectField.value = (isExisting ? 'ZFK — Zahtjev postojećeg korisnika' : 'ZFK — Novi upit') + ' — ' + timestamp + ' — #' + Date.now();
      }

      if (statusElement) {
        statusElement.hidden = false;
        statusElement.textContent = isExisting ? 'Zahtjev se šalje…' : 'Upit se šalje…';
      }
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute('aria-busy', 'true');
      }

      try {
        const formData = new FormData(form);
        if (isExisting) {
          const quantityField = document.getElementById('change-quantity');
          if (quantityField && quantityField.value === 'same') {
            formData.set('Nova mjesečna količina ili samo promjena vrste kapsula', 'Samo promjena vrste kapsula; postojeća mjesečna količina ostaje ista.');
          }
        }
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });
        const result = await response.json();
        if (!response.ok || result.success !== true) {
          throw new Error(result.message || 'Slanje nije uspjelo.');
        }

        if (statusElement) statusElement.textContent = isExisting
          ? 'Zahtjev je uspješno poslan! Svaki zahtjev šalje se kao zasebna e-mail poruka.'
          : 'Poruka uspješno proslijeđena!';
        if (!isExisting && successElement) successElement.hidden = false;
        if (submitButton) {
          submitButton.innerHTML = isExisting ? 'Zahtjev poslan ✓' : 'Upit poslan ✓';
          submitButton.setAttribute('aria-label', isExisting ? 'Zahtjev uspješno poslan' : 'Upit uspješno poslan');
        }
      } catch (error) {
        if (statusElement) statusElement.textContent = 'Slanje nije uspjelo. Provjerite internetsku vezu i pokušajte ponovno. Ako se problem nastavi, javite nam se e-mailom.';
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonText;
          submitButton.removeAttribute('aria-busy');
        }
      }
    });
  });
})();
