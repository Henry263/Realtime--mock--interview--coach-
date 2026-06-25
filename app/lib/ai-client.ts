import OpenAI from 'openai';

// AI Provider Configuration
// Set AI_PROVIDER to 'openai' or 'ollama' in .env
const provider = process.env.AI_PROVIDER || 'openai';

const config = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  },
  ollama: {
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    apiKey: 'ollama', // Required by SDK but ignored by Ollama
    model: process.env.OLLAMA_MODEL || 'llama3',
  },
};

const activeConfig = config[provider as keyof typeof config] || config.openai;

export const aiClient = new OpenAI({
  baseURL: activeConfig.baseURL,
  apiKey: activeConfig.apiKey,
});

export const aiModel = activeConfig.model;

export const getProviderInfo = () => ({
  provider,
  model: activeConfig.model,
  baseURL: activeConfig.baseURL,
});
