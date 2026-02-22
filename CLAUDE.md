# Project Guidelines for Claude

## Project Overview

This is a Chrome Extension (MV3) that injects a ghost button on every X/Twitter post. Clicking it generates 3 AI-powered reply variants (Bold, Smart, Witty) via OpenAI or Anthropic APIs.

## Tech Stack

- **Language**: Vanilla JavaScript (ES modules in service worker, IIFE in content scripts)
- **Platform**: Chrome Extension (Manifest V3)
- **No build step** — load unpacked in Chrome, zero build friction

## Development Commands

```bash
# No install/build needed — load unpacked at chrome://extensions

# Verify JSON is valid
python3 -m json.tool manifest.json > /dev/null

# Check JS syntax
node --check background.js
node --check content/content.js
node --check content/popup.js
node --check settings/settings.js
```

## Code Style & Conventions

### General Rules

- Follow existing code patterns in the codebase
- Keep functions small and focused (single responsibility)
- Use meaningful variable and function names
- Write self-documenting code; add comments only when logic isn't obvious

### File Organization

```
x-ghost/
├── manifest.json              # MV3 manifest
├── background.js              # Service worker — LLM API calls, message routing
├── content/
│   ├── content.js             # MutationObserver, ghost button injection, reply posting
│   ├── content.css            # Ghost button + inline popup styles (dark/light)
│   └── popup.js               # Inline popup rendering (variants, edit, post)
├── settings/
│   ├── settings.html          # Settings page
│   ├── settings.js            # Settings logic + style analysis trigger
│   └── settings.css           # Settings styles
├── lib/
│   ├── api.js                 # LLM API wrapper (OpenAI + Anthropic)
│   └── prompts.js             # Prompt templates
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Naming Conventions

- Files: `camelCase.js`
- CSS classes: `xg-` prefix (e.g., `xg-ghost-btn`, `xg-popup`)
- Constants: `SCREAMING_SNAKE_CASE`
- Functions: `camelCase`

## Architecture Notes

- **Content scripts** use IIFE + global namespace (`window.XGhostPopup`) — Chrome MV3 does not support ES modules in content scripts
- **Service worker** (`background.js`) uses ES modules (`"type": "module"`)
- **Message passing**: content scripts communicate with background via `chrome.runtime.sendMessage`
- **Storage**: `chrome.storage.local` with keys `xg_settings` and `xg_usage`
- **DOM selectors** for X/Twitter are centralized in `SELECTORS` constant in `content.js` for easy updates when X changes its DOM

### Key X/Twitter Selectors

```javascript
const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  actionBar: '[role="group"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  replyBtn: '[data-testid="reply"]',
  replyBox: '[data-testid="tweetTextarea_0"]',
  postBtn: '[data-testid="tweetButtonInline"]'
};
```

## Common Mistakes to Avoid

- NEVER commit `.env` files or secrets
- NEVER hardcode API keys in code — they are stored in `chrome.storage.local`
- ALWAYS use `xg-` prefix for CSS classes to avoid conflicts with X's styles
- ALWAYS use IIFE pattern in content scripts (not ES modules)
- DO NOT add npm/build dependencies — this is a zero-build project
- DO NOT use `document.execCommand` alternatives that break X's React-controlled inputs
- ALWAYS test with both dark and light X themes

## Verification Steps

IMPORTANT: Always verify your work using these methods:
1. Check JS syntax: `node --check <file>`
2. Validate manifest: `python3 -m json.tool manifest.json > /dev/null`
3. Load unpacked at `chrome://extensions` and test on x.com
4. Test ghost button injection on timeline, profile, search, and thread views
5. Test dark/light theme switching
