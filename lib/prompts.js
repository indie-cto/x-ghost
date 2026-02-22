/**
 * Prompt templates for reply generation and style analysis.
 */

export function buildCommentPrompt(author, postText, styleDescription, customSystemPrompt) {
  const systemPrompt = customSystemPrompt ||
    `You are an expert social media reply writer. You craft engaging, authentic replies for X/Twitter posts.
${styleDescription ? `\nThe user's writing style: ${styleDescription}` : ''}

Rules:
- Keep replies concise (under 280 characters each)
- Sound natural and human — no hashtags, no emojis unless they fit naturally
- Match the tone and context of the original post
- Never be offensive, racist, or inflammatory
- Each variant should feel distinctly different`;

  const userPrompt = `Generate 3 reply variants for this X post:

Author: @${author}
Post: "${postText}"

Respond with ONLY valid JSON in this exact format, no other text:
{"bold": "a confident, direct reply", "smart": "an insightful, thoughtful reply", "witty": "a clever, humorous reply"}`;

  return { systemPrompt, userPrompt };
}

export function buildStyleAnalysisPrompt(replies) {
  const systemPrompt = `You are an expert at analyzing writing style on social media. You identify patterns in tone, vocabulary, humor style, sentence structure, and personality.`;

  const userPrompt = `Analyze the writing style of these X/Twitter posts and provide a concise style description (2-3 sentences) that could guide an AI to replicate this voice:

${replies.map((r, i) => `${i + 1}. "${r}"`).join('\n')}

Respond with ONLY the style description, no other text.`;

  return { systemPrompt, userPrompt };
}
