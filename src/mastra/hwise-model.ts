import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Agent, fetch as undiciFetch } from 'undici';

// LM Studio serves the selected Qwen3 4B model through its OpenAI-compatible API.
// Override these HWISE_* variables if the endpoint, API key, or model ID differs.
export const hwiseModelId = process.env.HWISE_LM_STUDIO_MODEL?.trim() || 'qwen/qwen3-4b';

// Custom fetch with extended headersTimeout to prevent premature timeouts on local CPU inference
const customDispatcher = new Agent({
  headersTimeout: 20 * 60 * 1000, // 20 minutes
  bodyTimeout: 20 * 60 * 1000,
});

const customFetch: typeof fetch = (url, init) => {
  return undiciFetch(url as string, {
    ...(init as Record<string, unknown>),
    dispatcher: customDispatcher,
  } as any) as unknown as Promise<Response>;
};

const lmStudio = createOpenAICompatible({
  name: 'hwise-lm-studio',
  baseURL: process.env.HWISE_LM_STUDIO_BASE_URL?.trim() || 'http://127.0.0.1:1234/v1',
  apiKey: process.env.HWISE_LM_STUDIO_API_KEY?.trim() || 'lm-studio',
  fetch: customFetch,
});

export const hwiseChatModel = lmStudio.chatModel(hwiseModelId);
