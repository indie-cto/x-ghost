/**
 * X Ghost — Inline popup for reply variants.
 * Loaded as content script (IIFE + global namespace).
 */

(function () {
  'use strict';

  const MAX_CHARS = 280;

  function getThemeClass() {
    const cs = getComputedStyle(document.body);
    const bg = cs.backgroundColor;
    const match = bg.match(/\d+/g);
    if (match) {
      const brightness = (parseInt(match[0]) * 299 + parseInt(match[1]) * 587 + parseInt(match[2]) * 114) / 1000;
      return brightness < 128 ? 'xg-dark' : 'xg-light';
    }
    return 'xg-dark';
  }

  function positionPopup(popup, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left - 150;

    // Keep within viewport
    if (left < 12) left = 12;
    if (left + 340 > window.innerWidth - 12) left = window.innerWidth - 352;
    if (top + 400 > window.innerHeight) top = rect.top - 420;
    if (top < 12) top = 12;

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function create(anchorEl) {
    destroy(); // remove any existing popup

    const theme = getThemeClass();

    // Overlay to capture outside clicks
    const overlay = document.createElement('div');
    overlay.className = 'xg-popup-overlay';
    overlay.addEventListener('click', destroy);

    // Popup container
    const popup = document.createElement('div');
    popup.className = `xg-popup ${theme}`;
    popup.addEventListener('click', e => e.stopPropagation());

    // Header
    const header = document.createElement('div');
    header.className = 'xg-popup-header';

    const title = document.createElement('span');
    title.className = 'xg-popup-title';
    title.textContent = '\uD83D\uDC7B X Ghost';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'xg-popup-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Close (Esc)';
    closeBtn.addEventListener('click', destroy);

    header.append(title, closeBtn);
    popup.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.className = 'xg-popup-content';
    popup.appendChild(content);

    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    positionPopup(popup, anchorEl);

    // Keyboard handler
    const onKey = (e) => {
      if (e.key === 'Escape') destroy();
    };
    document.addEventListener('keydown', onKey);
    popup._xgKeyHandler = onKey;

    return popup;
  }

  function destroy() {
    const existing = document.querySelector('.xg-popup');
    if (existing) {
      if (existing._xgKeyHandler) {
        document.removeEventListener('keydown', existing._xgKeyHandler);
      }
      existing.remove();
    }
    const overlay = document.querySelector('.xg-popup-overlay');
    if (overlay) overlay.remove();
  }

  function showLoading(popup) {
    const content = popup.querySelector('.xg-popup-content');
    content.innerHTML = '';

    const skeleton = document.createElement('div');
    skeleton.className = 'xg-skeleton';
    for (let i = 0; i < 3; i++) {
      const card = document.createElement('div');
      card.className = 'xg-skeleton-card';
      skeleton.appendChild(card);
    }
    content.appendChild(skeleton);
  }

  function showError(popup, message, showSettingsLink) {
    const content = popup.querySelector('.xg-popup-content');
    content.innerHTML = '';

    const msg = document.createElement('div');
    msg.className = 'xg-error-msg';

    if (showSettingsLink) {
      msg.innerHTML = `${message}<br><a href="#" class="xg-settings-link">Open Settings</a>`;
      msg.querySelector('.xg-settings-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
      });
    } else {
      msg.textContent = message;
    }
    content.appendChild(msg);
  }

  function showVariants(popup, variants, onPost) {
    const content = popup.querySelector('.xg-popup-content');
    content.innerHTML = '';

    const variantsContainer = document.createElement('div');
    variantsContainer.className = 'xg-variants';

    const keys = ['bold', 'smart', 'witty'];
    const labels = { bold: 'Bold', smart: 'Smart', witty: 'Witty' };
    const hints = { bold: 'Press 1', smart: 'Press 2', witty: 'Press 3' };
    let selectedKey = null;

    // Edit area (hidden until selection)
    const editArea = document.createElement('div');
    editArea.className = 'xg-edit-area';
    editArea.style.display = 'none';

    const textarea = document.createElement('textarea');
    textarea.className = 'xg-edit-textarea';
    textarea.placeholder = 'Edit your reply...';

    const charCount = document.createElement('div');
    charCount.className = 'xg-char-count';

    const postBtn = document.createElement('button');
    postBtn.className = 'xg-post-btn';
    postBtn.textContent = 'Post Reply';
    postBtn.disabled = true;

    function updateCharCount() {
      const len = textarea.value.length;
      charCount.textContent = `${len}/${MAX_CHARS}`;
      charCount.classList.toggle('xg-over-limit', len > MAX_CHARS);
      postBtn.disabled = len === 0 || len > MAX_CHARS;
    }

    function selectVariant(key) {
      selectedKey = key;
      variantsContainer.querySelectorAll('.xg-variant-card').forEach(card => {
        card.classList.toggle('xg-selected', card.dataset.key === key);
      });
      textarea.value = variants[key];
      editArea.style.display = 'block';
      updateCharCount();
      textarea.focus();
    }

    keys.forEach(key => {
      const card = document.createElement('div');
      card.className = 'xg-variant-card';
      card.dataset.key = key;

      const label = document.createElement('div');
      label.className = 'xg-variant-label';
      label.textContent = labels[key];

      const text = document.createElement('div');
      text.className = 'xg-variant-text';
      text.textContent = variants[key];

      const hint = document.createElement('div');
      hint.className = 'xg-variant-hint';
      hint.textContent = hints[key];

      card.append(label, text, hint);
      card.addEventListener('click', () => selectVariant(key));
      variantsContainer.appendChild(card);
    });

    textarea.addEventListener('input', updateCharCount);

    postBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (text && text.length <= MAX_CHARS) {
        postBtn.disabled = true;
        postBtn.textContent = 'Posting...';
        onPost(text);
      }
    });

    editArea.append(textarea, charCount, postBtn);
    content.append(variantsContainer, editArea);

    // Keyboard shortcuts for variant selection
    const onKey = (e) => {
      if (document.activeElement === textarea) return;
      if (e.key === '1') selectVariant('bold');
      if (e.key === '2') selectVariant('smart');
      if (e.key === '3') selectVariant('witty');
    };
    document.addEventListener('keydown', onKey);

    // Store handler for cleanup
    const prevHandler = popup._xgKeyHandler;
    popup._xgKeyHandler = (e) => {
      if (e.key === 'Escape') destroy();
      onKey(e);
    };
    if (prevHandler) document.removeEventListener('keydown', prevHandler);
    document.addEventListener('keydown', popup._xgKeyHandler);
  }

  function showStatus(popup, message, type) {
    let status = popup.querySelector('.xg-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'xg-status';
      popup.querySelector('.xg-popup-content').appendChild(status);
    }
    status.textContent = message;
    status.className = `xg-status xg-status-${type || ''}`;
  }

  // Expose globally for content.js
  window.XGhostPopup = { create, destroy, showLoading, showError, showVariants, showStatus };
})();
