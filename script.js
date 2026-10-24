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
        capsuleNote.textContent = `Obavezno: odaberite ${minimum * 100} kapsula prema željenoj mjesečnoj količini. Kliknite vrste kapsula u galeriji iznad.`;
        capsuleNote.classList.add('capsule-error-note');
      }
      if (status) status.textContent = 'Upit nije poslan. Odaberite vrste kapsula koje ukupno odgovaraju željenoj mjesečnoj količini.';
      if (capsuleWrap) {
        capsuleWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        capsuleInput?.focus({ preventScroll: true });
      }
      return;
    }

    // Give every submission a distinct subject so mail clients are less likely to group inquiries into one conversation.
    const subjectInput = form.querySelector('input[name="_subject"]');
    const topicForSubject = (selectedTopic && selectedTopic.value || 'Novi upit').trim();
    const modelForSubject = (selectedModel && selectedModel.value || '').trim();
    const subjectDetails = [topicForSubject, modelForSubject && modelForSubject !== 'Nisam još odabrao/la' ? modelForSubject : 'bez odabranog aparata']
      .filter(Boolean)
      .join(' — ');
    const submittedAt = new Date();
    const readableTime = submittedAt.toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'medium' });
    if (subjectInput) subjectInput.value = `ZFK — ${subjectDetails} — ${readableTime} — #${Date.now()}`;

    const emailInput = document.getElementById('email');
    const emailCopy = document.getElementById('sender-email-copy');
    if (emailInput && emailCopy) emailCopy.value = emailInput.value.trim();
  });
}
const menu = document.querySelector('.menu');
const nav = document.querySelector('.header nav');

document.getElementById('year').textContent = new Date().getFullYear();

// FormSubmit redirects here after accepting a submission.
const successMessage = document.getElementById('success-message');
const params = new URLSearchParams(window.location.search);
if (params.get('upit') === 'poslan' && successMessage) {
  successMessage.hidden = false;
  if (status) status.textContent = 'Poruka uspješno proslijeđena!';

  // Remove the one-time success flag immediately so refreshing cannot replay it.
  params.delete('upit');
  const remainingQuery = params.toString();
  const cleanUrl = window.location.pathname + (remainingQuery ? '?' + remainingQuery : '') + window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);

  window.setTimeout(() => {
    successMessage.hidden = true;
    if (status && status.textContent === 'Poruka uspješno proslijeđena!') {
      status.textContent = '';
    }
  }, 30000);
}

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

// The visitor can choose a monthly target above the model's minimum.
const monthlyQuantityField = document.getElementById('monthly-quantity');
const monthlyQuantityWrap = document.getElementById('monthly-quantity-field');
const chooseCapsulesAction = document.getElementById('choose-capsules-action');
let finderPackageLimit = 0;

function minimumPackageLimit(modelValue) {
  if (/LB\s*300/i.test(modelValue || '')) return 2;
  if (/LB\s*1200/i.test(modelValue || '')) return 3;
  return 0;
}

function configureMonthlyQuantity(preferredCapsules = 0) {
  if (!monthlyQuantityField || !capsuleModelField) return;
  const modelValue = capsuleModelField.value;
  const minimum = minimumPackageLimit(modelValue);
  monthlyQuantityField.replaceChildren();
  if (!minimum) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Najprije odaberite aparat';
    monthlyQuantityField.append(option);
    monthlyQuantityField.value = '';
    return;
  }
  const preferredBoxes = preferredCapsules > 0 ? Math.ceil(preferredCapsules / 100) : 0;
  const start = Math.max(minimum, preferredBoxes || minimum);
  const maxBoxes = Math.max(start + 4, minimum + 4);
  for (let boxes = minimum; boxes <= maxBoxes; boxes++) {
    const option = document.createElement('option');
    option.value = String(boxes * 100);
    option.textContent = `${boxes * 100} kapsula mjesečno (${boxes} ${boxes === 1 ? 'kutija' : boxes >= 2 && boxes <= 4 ? 'kutije' : 'kutija'})`;
    monthlyQuantityField.append(option);
  }
  const desired = preferredBoxes ? preferredBoxes * 100 : minimum * 100;
  monthlyQuantityField.value = String(Math.max(minimum * 100, desired));
  monthlyQuantityField.disabled = false;
}

function capsulePackageLimit() {
  if (monthlyQuantityField && !monthlyQuantityField.disabled && Number(monthlyQuantityField.value) > 0) {
    return Math.ceil(Number(monthlyQuantityField.value) / 100);
  }
  if (finderPackageLimit > 0) return finderPackageLimit;
  return minimumPackageLimit(capsuleModelField ? capsuleModelField.value : '');
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
      note.textContent = 'Svaki klik dodaje jednu kutiju od 100 kapsula. Odaberite vrste dok ne popunite željenu mjesečnu količinu.';
    } else if (minimum > 0) {
      const selectedCount = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
      note.textContent = selectedCount < minimum
        ? `Odaberite vrste kapsula dok ne dosegnete ukupno ${minimum * 100} kapsula mjesečno. Količinu možete promijeniti u obrascu prije odabira vrsta.`
        : 'Odabrana mjesečna količina je popunjena. Nastavite na upit ili odaberite DA ako želite dodati još kutija.';
    } else {
      note.textContent = 'Najprije odaberite aparat ili vrstu upita, a zatim izaberite kapsule.';
    }
  }

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

  const applianceOrder = topicField && topicField.value === 'Želim aparat uz mjesečnu kupnju kapsula';
  if (monthlyQuantityWrap) {
    monthlyQuantityWrap.hidden = offerQuestionOnly || isCapsuleOnlyOrder() || !applianceOrder || !minimum;
    monthlyQuantityField.disabled = monthlyQuantityWrap.hidden;
  }
  if (chooseCapsulesAction) chooseCapsulesAction.hidden = monthlyQuantityWrap ? monthlyQuantityWrap.hidden : true;

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
  const targetBoxes = Number(quantity && quantity.value) / 100;
  if (capsuleNote && targetBoxes > 0) {
    capsuleNote.textContent = selectedBoxes < targetBoxes
      ? 'Odabrano ' + (selectedBoxes * 100) + ' od ' + (targetBoxes * 100) + ' kapsula. Odaberite još ' + ((targetBoxes - selectedBoxes) * 100) + ' kapsula u galeriji.'
      : 'Odabir kapsula je popunjen za željenu mjesečnu količinu.';
  } else if (capsuleNote) {
    capsuleNote.textContent = 'Obavezno: odaberite vrste kapsula u galeriji dok ne dosegnete odabranu mjesečnu količinu. Svaki klik dodaje jednu kutiju od 100 kapsula.';
  }
}

// The hero "Odaberi aparat" link must not bypass the required customer-status step.
const heroChooseMachine = document.getElementById('hero-choose-machine');
if (heroChooseMachine) {
  heroChooseMachine.addEventListener('click', event => {
    const customerStatus = document.getElementById('user-status');
    if (!customerStatus) return;
    event.preventDefault();
    const enquirySection = document.getElementById('narudzba');
    const changeSection = document.getElementById('promjena-kolicine');
    if (!customerStatus.value) {
      if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => customerStatus.focus({ preventScroll: true }), 400);
      return;
    }
    if (customerStatus.value === 'postojeci') {
      if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (changeSection) window.setTimeout(() => changeSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
      return;
    }
    const machineSection = document.getElementById('ponuda');
    if (machineSection) machineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

document.querySelectorAll('.model-select').forEach(button => {
  button.addEventListener('click', () => {
    const customerStatus = document.getElementById('user-status');
    const enquirySection = document.getElementById('narudzba');
    // Before any selections are made, require the visitor to identify as a new
    // or existing customer first. After choosing "Novi korisnik", this button
    // can be clicked again to select the machine normally.
    if (customerStatus && !customerStatus.value) {
      if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => customerStatus.focus({ preventScroll: true }), 350);
      return;
    }
    if (customerStatus && customerStatus.value === 'postojeci') {
      // Existing customers continue in their dedicated form. A machine choice
      // from the gallery preselects that machine, then takes them to quantity.
      const modelName = button.dataset.model || '';
      const existingModelField = document.getElementById('change-model');
      const modelPattern = /LB\\s*300/i.test(modelName)
        ? /LB\\s*300/i
        : /LB\\s*1200/i.test(modelName)
          ? /LB\\s*1200/i
          : null;
      const existingOption = existingModelField && modelPattern
        ? Array.from(existingModelField.options).find(item => modelPattern.test(item.value))
        : null;
      if (existingOption) {
        existingModelField.value = existingOption.value;
        existingModelField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const changeSection = document.getElementById('promjena-kolicine');
      if (changeSection) changeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const changeQuantity = document.getElementById('change-quantity');
      window.setTimeout(() => changeQuantity && changeQuantity.focus({ preventScroll: true }), 350);
      return;
    }
    // Finder and machine-card buttons share this handler. Match the canonical form
    // option by model family so longer display names (e.g. "LB 1200 Classy & Milk")
    // still select the corresponding inquiry-form option ("Lavazza LB 1200").
    const modelName = button.dataset.model || '';
    const quantityMatch = (button.dataset.quantity || '').match(/(\d+)\s*kapsula/i);
    // A finder recommendation like "300 kapsula mjesečno" means three 100-capsule
    // boxes in the inquiry. Regular machine-card selections keep their usual minimum.
    finderPackageLimit = quantityMatch ? Math.max(1, Math.ceil(Number(quantityMatch[1]) / 100)) : 0;
    const modelPattern = /LB\s*300/i.test(modelName)
      ? /LB\s*300/i
      : /LB\s*1200/i.test(modelName)
        ? /LB\s*1200/i
        : null;
    const modelOption = modelPattern
      ? Array.from(capsuleModelField.options).find(item => modelPattern.test(item.textContent))
      : null;
    if (modelOption) capsuleModelField.value = modelOption.value || modelOption.textContent;
    topicField.value = 'Želim aparat uz mjesečnu kupnju kapsula';
    configureMonthlyQuantity(quantityMatch ? Number(quantityMatch[1]) : 0);
    selectedCapsules.clear();
    saveCapsuleSelections();
    const noExtra = document.querySelector('input[name="Dodatne kapsule"][value="Ne"]');
    if (noExtra) noExtra.checked = true;
    if (status) status.textContent = '';
    updateSelectedCapsuleField();
    const enquirySection = document.getElementById('narudzba');
    if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (monthlyQuantityField && !monthlyQuantityField.disabled) monthlyQuantityField.focus({ preventScroll: true });
  });
});

document.querySelectorAll('.capsule-select').forEach(button => {
  button.addEventListener('click', () => {
    // Briefly darken the button as click feedback, then restore its normal appearance.
    button.classList.remove('capsule-select-feedback');
    if (button._capsuleFeedbackTimer) window.clearTimeout(button._capsuleFeedbackTimer);
    void button.offsetWidth;
    button.classList.add('capsule-select-feedback');
    button._capsuleFeedbackTimer = window.setTimeout(() => {
      button.classList.remove('capsule-select-feedback');
      button._capsuleFeedbackTimer = null;
    }, 450);

    const customerStatus = document.getElementById('user-status');
    const enquirySection = document.getElementById('narudzba');
    // If a visitor has not yet chosen their customer status, send them to that
    // required first step instead of adding a capsule before the inquiry flow.
    if (customerStatus && !customerStatus.value) {
      if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => customerStatus.focus({ preventScroll: true }), 350);
      return;
    }
    const variety = button.dataset.capsule;
    const selectedBoxes = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
    // Existing customers choose capsule varieties against their requested monthly quantity.
    if (customerStatus && customerStatus.value === 'postojeci') {
      const changeQuantity = document.getElementById('change-quantity');
      const changeStatus = document.getElementById('customer-change-status');
      const targetBoxes = Number(changeQuantity && changeQuantity.value) / 100;
      if (!Number.isFinite(targetBoxes) || targetBoxes < 1) {
        if (changeStatus) changeStatus.textContent = 'Najprije odaberite aparat i novu mjesečnu količinu u obrascu.';
        if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => changeQuantity && changeQuantity.focus({ preventScroll: true }), 350);
        return;
      }
      if (selectedBoxes >= targetBoxes) {
        if (changeStatus) changeStatus.textContent = 'Već ste odabrali vrste za svih ' + (targetBoxes * 100) + ' kapsula mjesečno.';
        const changeSection = document.getElementById('promjena-kolicine');
        if (changeSection) changeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      selectedCapsules.set(variety, (selectedCapsules.get(variety) || 0) + 1);
      saveCapsuleSelections();
      updateChangeCapsuleField();
      if (changeStatus) changeStatus.textContent = '';
      if (selectedBoxes + 1 >= targetBoxes) {
        const changeSection = document.getElementById('promjena-kolicine');
        if (changeSection) window.setTimeout(() => changeSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
      }
      return;
    }
    if (!capsuleField) return;
    const minimum = isCapsuleOnlyOrder() ? 0 : capsulePackageLimit();
    const addingExtras = !isCapsuleOnlyOrder() && wantsAdditionalCapsules() && selectedBoxes >= minimum;

    if (!isCapsuleOnlyOrder() && !minimum) {
      if (status) status.textContent = 'Najprije odaberite aparat, a zatim odaberite kapsule.';
      return;
    }
    if (!isCapsuleOnlyOrder() && selectedBoxes >= minimum && !addingExtras) {
      if (status) status.textContent = `Već ste odabrali željenu mjesečnu količinu od ${minimum * 100} kapsula. Ako želite još, u obrascu odaberite DA za dodatne kutije.`;
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

function updateModelMinimumNote() {
  const note = document.getElementById('model-minimum-note');
  if (!note || !capsuleModelField) return;
  if (/LB\\s*300/i.test(capsuleModelField.value)) {
    note.textContent = 'LB300 mini: potrebno je odabrati najmanje 2 kutije (200 kapsula).';
  } else if (/LB\\s*1200/i.test(capsuleModelField.value)) {
    note.textContent = 'LB1200 Classy & Milk: potrebno je odabrati najmanje 3 kutije (300 kapsula).';
  } else {
    note.textContent = 'Odaberite aparat i željenu mjesečnu količinu kapsula.';
  }
}

if (capsuleModelField) {
  updateModelMinimumNote();
  capsuleModelField.addEventListener('change', () => {
    finderPackageLimit = 0;
    configureMonthlyQuantity();
    selectedCapsules.clear();
    saveCapsuleSelections();
    if (status) status.textContent = '';
    updateSelectedCapsuleField();
    updateModelMinimumNote();
  });
}

if (monthlyQuantityField) {
  monthlyQuantityField.addEventListener('change', () => {
    finderPackageLimit = 0;
    selectedCapsules.clear();
    saveCapsuleSelections();
    if (status) status.textContent = '';
    updateSelectedCapsuleField();
  });
}

document.getElementById('choose-capsules-button')?.addEventListener('click', () => {
  const capsuleSection = document.getElementById('kapsule');
  if (capsuleSection) capsuleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

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
    mini:{name:'LB 300 mini',modelValue:'Lavazza LB 300 mini',quantity:'200 kapsula mjesečno (2 kutije)',tag:'Za espresso i crnu kavu',facts:['Min. količina: 200 kapsula (2 kutije)','Kompaktan format','Za espresso i crnu kavu','Bez sustava za mliječne napitke']},
    milk:{name:'LB 1200 Classy & Milk',modelValue:'Lavazza LB 1200 Classy & Milk',quantity:'300 kapsula mjesečno (3 kutije)',tag:'Za mliječne napitke i veće potrebe',facts:['Min. količina: 300 kapsula (3 kutije)','Sustav za mliječne napitke','Spremnik za vodu od 1,8 l','Spremnik za iskorištene kapsule do 15 kapsula']}
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
    const miniEligible=e.boxes>=2;
    const milkEligible=e.boxes>=3;
    let key='',showBoth=false,tag='',copy='',noEligible=false;
    if(drinks==='black'){
      if(miniEligible){key='mini';tag='Preporuka prema vašim željama';copy=`Budući da želite samo espresso i crnu kavu, preporučujemo LB 300 mini ${useLabels[use]}. Veća potrošnja kapsula ne isključuje ovaj model ako ne trebate mliječne napitke.`;}
      else {noEligible=true;tag='Količina ispod minimuma';copy=`Vodič preporučuje ${e.total} kapsula (${e.boxes} ${e.boxes===1?'kutija':'kutije'}) mjesečno. Za LB 300 mini potrebno je najmanje 200 kapsula mjesečno (2 kutije), pa se aparat još ne može odabrati.`;}
    } else if(drinks==='milk'){
      if(milkEligible){key='milk';tag='Preporuka prema vašim željama';copy=`Budući da želite i mliječne napitke, preporučujemo LB 1200 Classy & Milk ${useLabels[use]}.`;}
      else {noEligible=true;tag='Količina ispod minimuma';copy=`Vodič preporučuje ${e.total} kapsula (${e.boxes} ${e.boxes===1?'kutija':'kutije'}) mjesečno. Za LB 1200 Classy & Milk potrebno je najmanje 300 kapsula mjesečno (3 kutije), pa se aparat još ne može odabrati.`;}
    } else if(!miniEligible){
      noEligible=true;tag='Količina ispod minimuma';copy=`Vodič preporučuje ${e.total} kapsula (${e.boxes} ${e.boxes===1?'kutija':'kutije'}) mjesečno. Za LB 300 mini potrebno je najmanje 200 kapsula (2 kutije), a za LB 1200 Classy & Milk najmanje 300 kapsula (3 kutije). Trenutačna preporuka ne zadovoljava minimum nijednog aparata.`;
    } else if(!milkEligible){
      key='mini';tag='Dostupan model prema preporučenoj količini';copy=`Uz ${e.count} osoba vodič preporučuje ${e.total} kapsula mjesečno. Ta količina zadovoljava minimum za LB 300 mini (2 kutije), ali još ne zadovoljava minimum za LB 1200 Classy & Milk (3 kutije). Budući da niste odabrali vrstu napitka, možete odabrati LB 300 mini.`;
    } else if(e.count>3||e.monthly>=300){
      key='milk';showBoth=true;tag='Naš savjet: LB 1200 Classy & Milk';copy=`Uz ${e.count} osoba procijenjena je potrošnja ${e.monthly} kapsula mjesečno. Za više od 3 osobe praktičniji može biti LB 1200 Classy & Milk zbog većeg spremnika za vodu i kapaciteta za iskorištene kapsule. Od 300 kapsula mjesečno naviše posebno ga preporučujemo. Ipak, konačan izbor je vaš.`;
    } else {showBoth=true;tag='Usporedite oba modela';copy=`Uz ${e.count} osoba procijenjena je potrošnja ${e.monthly} kapsula mjesečno. Budući da još niste odlučili koje napitke želite, usporedite oba aparata i odaberite onaj koji vam više odgovara.`;}
    const model=key?models[key]:null;
    resultTag.textContent=tag;
    resultTitle.textContent=noEligible?'Još nije moguće odabrati aparat':showBoth?'Koji aparat vam više odgovara?':`Lavazza ${model.name}`;
    resultCopy.textContent=copy;
    resultFacts.replaceChildren();
    [`Procijenjena potrošnja: ${e.monthly} kapsula mjesečno`,`Broj osoba: ${e.count}`,`Preporučena količina: ${e.total} kapsula (${e.boxes} ${e.boxes===1?'kutija':e.boxes>=2&&e.boxes<=4?'kutije':'kutija'})`].concat(model?model.facts:['Minimalna količina: LB 300 mini — 200 kapsula (2 kutije); LB 1200 Classy & Milk — 300 kapsula (3 kutije)']).forEach(fact=>{const li=document.createElement('li');li.textContent=fact;resultFacts.append(li);});
    resultModels.hidden=!showBoth||noEligible;
    resultButton.hidden=showBoth||noEligible;
    const quantityFor=(m)=>`${e.total} kapsula mjesečno (${e.boxes} ${e.boxes===1?'kutija':e.boxes>=2&&e.boxes<=4?'kutije':'kutija'})`;
    if(model)setModelButton(resultButton,model,quantityFor(model));
    resultModels.querySelectorAll('.finder-model-button').forEach(button=>{
      const m=button.dataset.model.includes('1200')?models.milk:models.mini;
      const eligible=m===models.milk?milkEligible:miniEligible;
      button.closest('.finder-model-choice').hidden=!eligible;
      setModelButton(button,m,quantityFor(m));
    });
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


/* Existing customers can request a monthly capsule quantity change. */
(function setupCustomerQuantityChange(){
  const form = document.getElementById('customer-change-form');
  const model = document.getElementById('change-model');
  const quantity = document.getElementById('change-quantity');
  const note = document.getElementById('change-quantity-note');
  const status = document.getElementById('customer-change-status');
  const capsuleVarieties = document.getElementById('change-capsule-varieties');
  const capsuleNote = document.getElementById('change-capsule-note');
  const chooseCapsules = document.getElementById('change-choose-capsules');
  if (!form || !model || !quantity) return;
  if (chooseCapsules) {
    chooseCapsules.addEventListener('click', () => {
      const customerStatus = document.getElementById('user-status');
      if (customerStatus) customerStatus.value = 'postojeci';
      const gallery = document.getElementById('kapsule');
      if (gallery) gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  const minimums = {
    'Lavazza LB 300 mini': 200,
    'Lavazza LB 1200 Classy & Milk': 300
  };
  function configure(){
    const minimum = minimums[model.value];
    quantity.replaceChildren();
    if (!minimum) {
      quantity.add(new Option('Najprije odaberite aparat', ''));
      quantity.disabled = true;
      if (note) note.textContent = 'Odaberite aparat kako bi se prikazale dostupne količine.';
      return;
    }
    quantity.add(new Option('Odaberite novu količinu', ''));
    for (let amount = minimum; amount <= minimum + 1000; amount += 100) {
      quantity.add(new Option(amount + ' kapsula mjesečno (' + amount / 100 + (amount === 100 ? ' kutija)' : ' kutija)'), String(amount)));
    }
    quantity.disabled = false;
    if (note) note.textContent = 'Minimalno ' + minimum + ' kapsula mjesečno za odabrani aparat. Odabir je u koracima od 100 kapsula.';
  }
  model.addEventListener('change', () => {
    configure();
    selectedCapsules.clear();
    saveCapsuleSelections();
    updateChangeCapsuleField();
    if (status) status.textContent = '';
  });
  quantity.addEventListener('change', () => {
    selectedCapsules.clear();
    saveCapsuleSelections();
    updateChangeCapsuleField();
    if (status) status.textContent = '';
  });
  updateChangeCapsuleField();
  form.addEventListener('submit', event => {
    const minimum = minimums[model.value];
    const amount = Number(quantity.value);
    const selectedBoxes = Array.from(selectedCapsules.values()).reduce((sum, qty) => sum + qty, 0);
    if (!minimum || !Number.isFinite(amount) || amount < minimum || amount % 100 !== 0) {
      event.preventDefault();
      if (status) status.textContent = 'Odaberite aparat i valjanu mjesečnu količinu prije slanja zahtjeva.';
      quantity.focus();
      return;
    }
    if (selectedBoxes !== amount / 100 || !capsuleVarieties || !capsuleVarieties.value.trim()) {
      event.preventDefault();
      updateChangeCapsuleField();
      if (status) status.textContent = 'Obavezno odaberite vrste kapsula za cijelu željenu mjesečnu količinu.';
      if (capsuleVarieties) capsuleVarieties.focus();
      return;
    }
    if (status) status.textContent = 'Zahtjev se šalje…';
  });
  const params = new URLSearchParams(window.location.search);
  if (params.get('promjena-poslana') === '1' || params.has('promjena-poslana')) {
    if (status) status.textContent = 'Hvala! Zahtjev je poslan. Potvrdit ćemo promjenu e-mailom.';
    params.delete('promjena-poslana');
    const query = params.toString();
    window.history.replaceState({}, document.title, window.location.pathname + (query ? '?' + query : '') + window.location.hash);
  }
})();


/* Show the regular inquiry fields only for new customers; reveal the separate change form for existing customers. */
(function setupCustomerTypeSwitch(){
  const selector = document.getElementById('user-status');
  const newFields = document.getElementById('new-customer-fields');
  const changeSection = document.getElementById('promjena-kolicine');
  if (!selector || !newFields || !changeSection) return;
  const setEnabled = (container, enabled) => {
    container.querySelectorAll('input, select, textarea, button').forEach(control => {
      if (control.type === 'hidden' || control.name === '_honey' || control.name === '_subject' || control.name === '_template' || control.name === '_next') {
        control.disabled = !enabled;
      } else {
        control.disabled = !enabled;
      }
    });
  };
  function update(){
    const existing = selector.value === 'postojeci';
    const newCustomer = selector.value === 'novi';
    newFields.hidden = !newCustomer;
    changeSection.hidden = !existing;
    setEnabled(newFields, newCustomer);
    if (existing) {
      const changeForm = document.getElementById('customer-change-form');
      if (changeForm) {
        changeForm.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = false; });
      }
    }
  }
  selector.addEventListener('change', () => {
    update();
    if (selector.value === 'postojeci') {
      changeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  update();
})();
