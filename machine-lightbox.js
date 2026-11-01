// Dedicated, isolated lightbox for the two machine photos.
// Kept separate from the main site script so unrelated JavaScript errors cannot disable it.
(function () {
  const galleries = document.querySelectorAll('#ponuda .model-image-gallery img');
  if (!galleries.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'image-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Uvećana fotografija aparata');

  const enlarged = document.createElement('img');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'image-lightbox-close';
  close.setAttribute('aria-label', 'Zatvori uvećanu fotografiju');
  close.textContent = '×';
  overlay.append(enlarged, close);
  document.body.appendChild(overlay);

  function closeViewer() {
    overlay.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    enlarged.removeAttribute('src');
  }
  function openViewer(image) {
    enlarged.src = image.currentSrc || image.src;
    enlarged.alt = image.alt || 'Uvećana fotografija aparata';
    overlay.classList.add('open');
    document.body.classList.add('lightbox-open');
  }

  galleries.forEach((image) => {
    image.style.cursor = 'zoom-in';
    image.setAttribute('role', 'button');
    image.setAttribute('tabindex', '0');
    image.setAttribute('aria-label', (image.alt || 'Fotografija aparata') + ' — kliknite za uvećanje');
    image.addEventListener('click', () => openViewer(image));
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openViewer(image);
      }
    });
  });

  close.addEventListener('click', closeViewer);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeViewer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) closeViewer();
  });
})();