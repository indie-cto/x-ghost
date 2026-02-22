/**
 * X Ghost — Content script.
 * Injects ghost buttons on tweets and handles reply posting.
 */

(function () {
  'use strict';

  const SELECTORS = {
    tweet: 'article[data-testid="tweet"]',
    actionBar: '[role="group"]',
    tweetText: '[data-testid="tweetText"]',
    userName: '[data-testid="User-Name"]',
    replyBtn: '[data-testid="reply"]',
    replyBox: '[data-testid="tweetTextarea_0"]',
    postBtn: '[data-testid="tweetButtonInline"]'
  };

  const GHOST_MARKER = 'xg-ghost-injected';

  function extractAuthor(tweet) {
    const userNameEl = tweet.querySelector(SELECTORS.userName);
    if (!userNameEl) return 'unknown';
    const link = userNameEl.querySelector('a[href^="/"]');
    if (!link) return 'unknown';
    return link.getAttribute('href').replace('/', '');
  }

  function extractPostText(tweet) {
    const textEl = tweet.querySelector(SELECTORS.tweetText);
    return textEl ? textEl.textContent.trim() : '';
  }

  function createGhostButton() {
    const btn = document.createElement('button');
    btn.className = 'xg-ghost-btn';
    btn.title = 'Generate AI replies';
    btn.setAttribute('aria-label', 'Generate AI replies with X Ghost');
    btn.textContent = '\uD83D\uDC7B';
    return btn;
  }

  function waitForElement(selector, timeout) {
    timeout = timeout || 5000;
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver((_mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    });
  }

  async function postReply(tweet, text) {
    // Click the reply button on the tweet
    const replyBtn = tweet.querySelector(SELECTORS.replyBtn);
    if (!replyBtn) throw new Error('Reply button not found');
    replyBtn.click();

    // Wait for the reply box to appear
    const replyBox = await waitForElement(SELECTORS.replyBox, 5000);

    // Focus and insert text
    replyBox.focus();
    await new Promise(r => setTimeout(r, 200));

    // Use execCommand for compatibility with X's React-controlled inputs
    document.execCommand('insertText', false, text);

    // Wait for the Post button to become enabled
    await new Promise(r => setTimeout(r, 500));

    const postBtn = await waitForElement(SELECTORS.postBtn, 3000);

    // Wait until button is not disabled
    let attempts = 0;
    while (postBtn.disabled && attempts < 20) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }

    if (postBtn.disabled) throw new Error('Post button did not enable');
    postBtn.click();
  }

  function injectGhostButton(tweet) {
    if (tweet.dataset[GHOST_MARKER]) return;
    tweet.dataset[GHOST_MARKER] = 'true';

    const actionBar = tweet.querySelector(SELECTORS.actionBar);
    if (!actionBar) return;

    const btn = createGhostButton();

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const author = extractAuthor(tweet);
      const postText = extractPostText(tweet);

      if (!postText) return;

      const popup = window.XGhostPopup.create(btn);
      window.XGhostPopup.showLoading(popup);

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GENERATE_COMMENTS',
          author,
          postText
        });

        if (response.error) {
          const showLink = response.error === 'no_api_key' || response.error === 'invalid_key';
          window.XGhostPopup.showError(popup, response.message, showLink);
          return;
        }

        window.XGhostPopup.showVariants(popup, response.variants, async (replyText) => {
          try {
            await postReply(tweet, replyText);
            window.XGhostPopup.showStatus(popup, 'Reply posted!', 'success');
            setTimeout(() => window.XGhostPopup.destroy(), 1500);
          } catch (err) {
            window.XGhostPopup.showStatus(popup, 'Failed to post. Try copying and posting manually.', 'error');
          }
        });
      } catch (err) {
        window.XGhostPopup.showError(popup, 'Something went wrong. Please try again.');
      }
    });

    // Insert before the last child (share button area) for natural placement
    actionBar.appendChild(btn);
  }

  function scanAndInject() {
    const tweets = document.querySelectorAll(SELECTORS.tweet);
    tweets.forEach(injectGhostButton);
  }

  // Initial scan
  scanAndInject();

  // Observe DOM for dynamically loaded tweets
  const observer = new MutationObserver(() => {
    scanAndInject();
  });

  const main = document.querySelector('main') || document.body;
  observer.observe(main, { childList: true, subtree: true });
})();
