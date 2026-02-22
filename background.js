import { callLLM, APIError } from './lib/api.js';
import { buildCommentPrompt, buildStyleAnalysisPrompt } from './lib/prompts.js';

const DEFAULT_SETTINGS = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  styleDescription: '',
  customSystemPrompt: '',
  dailyLimit: 10
};

async function getSettings() {
  const { xg_settings } = await chrome.storage.local.get('xg_settings');
  return { ...DEFAULT_SETTINGS, ...xg_settings };
}

async function getUsage() {
  const { xg_usage } = await chrome.storage.local.get('xg_usage');
  const today = new Date().toISOString().slice(0, 10);
  if (!xg_usage || xg_usage.date !== today) {
    const reset = { date: today, count: 0 };
    await chrome.storage.local.set({ xg_usage: reset });
    return reset;
  }
  return xg_usage;
}

async function incrementUsage() {
  const usage = await getUsage();
  usage.count++;
  await chrome.storage.local.set({ xg_usage: usage });
  return usage;
}

function parseVariants(raw) {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const parsed = JSON.parse(cleaned);
  if (!parsed.bold || !parsed.smart || !parsed.witty) {
    throw new Error('Missing variant keys in response');
  }
  return {
    bold: String(parsed.bold),
    smart: String(parsed.smart),
    witty: String(parsed.witty)
  };
}

async function handleGenerateComments({ author, postText }) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    return { error: 'no_api_key', message: 'Please set your API key in X Ghost settings.' };
  }

  const usage = await getUsage();
  if (usage.count >= settings.dailyLimit) {
    return { error: 'limit_reached', message: `Daily limit of ${settings.dailyLimit} reached. Change it in settings.` };
  }

  const { systemPrompt, userPrompt } = buildCommentPrompt(
    author, postText, settings.styleDescription, settings.customSystemPrompt
  );

  try {
    const raw = await callLLM(settings.provider, settings.apiKey, settings.model, systemPrompt, userPrompt);
    const variants = parseVariants(raw);
    await incrementUsage();
    return { variants };
  } catch (err) {
    if (err instanceof APIError) {
      if (err.status === 401) {
        return { error: 'invalid_key', message: 'Invalid API key. Check your settings.' };
      }
      if (err.status === 429) {
        return { error: 'rate_limit', message: 'Rate limited by API. Try again in a moment.' };
      }
      return { error: 'api_error', message: err.message };
    }
    return { error: 'parse_error', message: 'Failed to parse AI response. Try again.' };
  }
}

async function handleAnalyzeStyle({ replies }) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    return { error: 'no_api_key', message: 'Please set your API key first.' };
  }

  if (!replies || replies.length < 3) {
    return { error: 'insufficient_data', message: 'Need at least 3 posts to analyze style. Scroll through your Replies tab first.' };
  }

  const { systemPrompt, userPrompt } = buildStyleAnalysisPrompt(replies);

  try {
    const raw = await callLLM(settings.provider, settings.apiKey, settings.model, systemPrompt, userPrompt);
    return { styleDescription: raw.trim() };
  } catch (err) {
    if (err instanceof APIError) {
      return { error: 'api_error', message: err.message };
    }
    return { error: 'unknown', message: 'Style analysis failed. Try again.' };
  }
}

async function handleScrapeReplies() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('x.com')) {
      return { error: 'wrong_tab', message: 'Navigate to your X profile Replies tab first.' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const tweets = document.querySelectorAll('[data-testid="tweetText"]');
        const texts = [];
        tweets.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 10) texts.push(text);
        });
        return texts.slice(0, 20);
      }
    });

    const replies = results?.[0]?.result || [];
    return { replies };
  } catch (err) {
    return { error: 'scrape_failed', message: 'Could not read posts from the page. Make sure you are on x.com.' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case 'GENERATE_COMMENTS':
        return handleGenerateComments(message);
      case 'ANALYZE_STYLE':
        return handleAnalyzeStyle(message);
      case 'SCRAPE_REPLIES':
        return handleScrapeReplies();
      case 'GET_USAGE':
        return getUsage();
      default:
        return { error: 'unknown_message', message: `Unknown message type: ${message.type}` };
    }
  };

  handler().then(sendResponse);
  return true; // keep channel open for async response
});

// Open settings page on toolbar icon click
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
