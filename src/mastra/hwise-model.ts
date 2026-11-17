import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// LM Studio serves the selected Qwen3 8B model through its OpenAI-compatible API.
// Override these HWISE_* variables if the endpoint, API key, or model ID differs.
export const hwiseModelId = process.env.HWISE_LM_STUDIO_MODEL?.trim() || 'qwen/qwen3-8b';

const lmStudio = createOpenAICompatible({
  name: 'hwise-lm-studio',
  baseURL: process.env.HWISE_LM_STUDIO_BASE_URL?.trim() || 'http://127.0.0.1:1234/v1',
  apiKey: process.env.HWISE_LM_STUDIO_API_KEY?.trim() || 'lm-studio',
});

export const hwiseChatModel = lmStudio.chatModel(hwiseModelId);
