/**
 * X Ghost — Settings page logic.
 */

(function () {
  'use strict';

  const MODELS = {
    openai: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast, cheap)' },
      { value: 'gpt-4o', label: 'GPT-4o (best quality)' }
    ],
    anthropic: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (balanced)' },
      { value: 'claude-haiku-235-20241022', label: 'Claude Haiku 3.5 (fast, cheap)' }
    ]
  };

  const DEFAULT_SETTINGS = {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    styleDescription: '',
    customSystemPrompt: '',
    dailyLimit: 10
  };

  // DOM elements
  const els = {
    provider: document.getElementById('provider'),
    apiKey: document.getElementById('apiKey'),
    toggleKey: document.getElementById('toggleKey'),
    model: document.getElementById('model'),
    styleDescription: document.getElementById('styleDescription'),
    analyzeStyle: document.getElementById('analyzeStyle'),
    analyzeStatus: document.getElementById('analyzeStatus'),
    customSystemPrompt: document.getElementById('customSystemPrompt'),
    dailyLimit: document.getElementById('dailyLimit'),
    usageCount: document.getElementById('usageCount'),
    saveBtn: document.getElementById('saveBtn'),
    saveStatus: document.getElementById('saveStatus')
  };

  function updateModelDropdown(provider) {
    const models = MODELS[provider] || MODELS.openai;
    els.model.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      els.model.appendChild(opt);
    });
  }

  async function loadSettings() {
    const { xg_settings } = await chrome.storage.local.get('xg_settings');
    const settings = { ...DEFAULT_SETTINGS, ...xg_settings };

    els.provider.value = settings.provider;
    updateModelDropdown(settings.provider);
    els.apiKey.value = settings.apiKey;
    els.model.value = settings.model;
    els.styleDescription.value = settings.styleDescription;
    els.customSystemPrompt.value = settings.customSystemPrompt;
    els.dailyLimit.value = settings.dailyLimit;

    // Ensure model value is valid after dropdown update
    if (!els.model.value) {
      els.model.selectedIndex = 0;
    }

    await loadUsage(settings.dailyLimit);
  }

  async function loadUsage(dailyLimit) {
    try {
      const usage = await chrome.runtime.sendMessage({ type: 'GET_USAGE' });
      els.usageCount.textContent = `${usage.count} / ${dailyLimit || els.dailyLimit.value}`;
    } catch {
      els.usageCount.textContent = '0 / ' + (dailyLimit || els.dailyLimit.value);
    }
  }

  async function saveSettings() {
    const settings = {
      provider: els.provider.value,
      apiKey: els.apiKey.value.trim(),
      model: els.model.value,
      styleDescription: els.styleDescription.value.trim(),
      customSystemPrompt: els.customSystemPrompt.value.trim(),
      dailyLimit: Math.max(1, parseInt(els.dailyLimit.value) || 10)
    };

    await chrome.storage.local.set({ xg_settings: settings });

    els.saveStatus.textContent = 'Saved!';
    setTimeout(() => { els.saveStatus.textContent = ''; }, 2000);
  }

  async function analyzeStyle() {
    els.analyzeStyle.disabled = true;
    els.analyzeStatus.textContent = 'Scraping posts from active X tab...';
    els.analyzeStatus.className = 'xg-help-text';

    try {
      // Step 1: Scrape replies from active tab
      const scrapeResult = await chrome.runtime.sendMessage({ type: 'SCRAPE_REPLIES' });

      if (scrapeResult.error) {
        els.analyzeStatus.textContent = scrapeResult.message;
        els.analyzeStatus.className = 'xg-help-text xg-error';
        return;
      }

      els.analyzeStatus.textContent = `Found ${scrapeResult.replies.length} posts. Analyzing style...`;

      // Step 2: Analyze style via LLM
      const result = await chrome.runtime.sendMessage({
        type: 'ANALYZE_STYLE',
        replies: scrapeResult.replies
      });

      if (result.error) {
        els.analyzeStatus.textContent = result.message;
        els.analyzeStatus.className = 'xg-help-text xg-error';
        return;
      }

      els.styleDescription.value = result.styleDescription;
      els.analyzeStatus.textContent = 'Style analysis complete!';
      els.analyzeStatus.className = 'xg-help-text';
    } catch (err) {
      els.analyzeStatus.textContent = 'Analysis failed. Make sure you have an X tab open.';
      els.analyzeStatus.className = 'xg-help-text xg-error';
    } finally {
      els.analyzeStyle.disabled = false;
    }
  }

  // Event listeners
  els.provider.addEventListener('change', () => {
    updateModelDropdown(els.provider.value);
  });

  els.toggleKey.addEventListener('click', () => {
    const isPassword = els.apiKey.type === 'password';
    els.apiKey.type = isPassword ? 'text' : 'password';
  });

  els.saveBtn.addEventListener('click', saveSettings);
  els.analyzeStyle.addEventListener('click', analyzeStyle);

  // Initialize
  loadSettings();
})();
