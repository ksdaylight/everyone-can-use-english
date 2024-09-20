import { t } from "i18next";

export const GPT_PROVIDERS: { [key: string]: any } = {
  enjoyai: {
    name: "EnjoyAI",
    models: [
      "gpt-4o-mini",
      "gpt-4o",
      "chatgpt-4o-latest",
      "gpt-4-turbo",
      "gpt-4",
      "anthropic/claude-3.5-sonnet",
      "meta-llama/llama-3.1-8b-instruct",
      "meta-llama/llama-3.1-70b-instruct",
      "meta-llama/llama-3.1-405b-instruct",
      "google/gemma-2-27b-it",
      "google/gemma-2-9b-it:free",
      "google/gemini-pro-1.5",
      "google/gemini-flash-1.5",
      "perplexity/llama-3-sonar-large-32k-online",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-coder",
    ],
    configurable: [
      "model",
      "roleDefinition",
      "temperature",
      "numberOfChoices",
      "maxTokens",
      "frequencyPenalty",
      "presencePenalty",
      "historyBufferSize",
      "tts",
    ],
  },
  openai: {
    name: "OpenAI",
    description: t("youNeedToSetupApiKeyBeforeUsingOpenAI"),
    models: [
      "gpt-4o-mini",
      "gpt-4o",
      "chatgpt-4o-latest",
      "gpt-4-turbo",
      "gpt-4",
    ],
    configurable: [
      "model",
      "baseUrl",
      "roleDefinition",
      "temperature",
      "numberOfChoices",
      "maxTokens",
      "frequencyPenalty",
      "presencePenalty",
      "historyBufferSize",
      "tts",
    ],
  },
  ollama: {
    name: "Ollama",
    description: t("ensureYouHaveOllamaRunningLocallyAndHasAtLeastOneModel"),
    baseUrl: "http://localhost:11434",
    models: [],
    configurable: [
      "model",
      "baseUrl",
      "roleDefinition",
      "temperature",
      "maxTokens",
      "historyBufferSize",
      "frequencyPenalty",
      "presencePenalty",
      "tts",
    ],
  },
};
