import {
  AppSettingsProviderContext,
  AISettingsProviderContext,
} from "@renderer/context";
import { useContext } from "react";
import { ChatMessageHistory, BufferMemory } from "langchain/memory/index";
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import OpenAI from "openai";
import { type LLMResult } from "@langchain/core/outputs";
import { v4 } from "uuid";
import { Client } from "@/api";

// 定义缓存机制
let wordDeckCache: string[] | null = null;
let grammarDeckCache: string[] | null = null;
let wordDeckCacheTimestamp: number | null = null;
let grammarDeckCacheTimestamp: number | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 缓存有效期为 1 小时（以毫秒为单位）

export const useConversation = () => {
  const { EnjoyApp, user, apiUrl, anki, learningLanguage } = useContext(
    AppSettingsProviderContext
  );
  const { openai, googleGenerativeAi, currentEngine } = useContext(
    AISettingsProviderContext
  );

  const pickLlm = (conversation: ConversationType) => {
    const {
      baseUrl,
      model,
      temperature,
      maxTokens,
      frequencyPenalty,
      presencePenalty,
      numberOfChoices,
    } = conversation.configuration;

    if (conversation.engine === "enjoyai") {
      return new ChatOpenAI({
        openAIApiKey: user.accessToken,
        configuration: {
          baseURL: `${apiUrl}/api/ai`,
        },
        maxRetries: 0,
        modelName: model,
        temperature,
        maxTokens,
        frequencyPenalty,
        presencePenalty,
        n: numberOfChoices,
      });
    } else if (conversation.engine === "openai") {
      if (!openai) throw new Error("OpenAI API key is required");

      return new ChatOpenAI({
        openAIApiKey: openai.key,
        configuration: {
          baseURL: baseUrl || openai.baseUrl,
        },
        maxRetries: 0,
        modelName: model,
        temperature,
        maxTokens,
        streaming: true,
        frequencyPenalty,
        presencePenalty,
        n: numberOfChoices,
      });
    } else if (conversation.engine === "ollama") {
      return new ChatOllama({
        baseUrl,
        model,
        temperature,
        frequencyPenalty,
        presencePenalty,
        maxRetries: 2,
      });
    } else if (conversation.engine === "googleGenerativeAi") {
      if (!googleGenerativeAi)
        throw new Error("Google Generative AI API key is required");

      return new ChatGoogleGenerativeAI({
        apiKey: googleGenerativeAi.key,
        modelName: model,
        temperature: temperature,
        maxOutputTokens: maxTokens,
        maxRetries: 2,
      });
    }
  };

  const fetchChatHistory = async (conversation: ConversationType) => {
    const chatMessageHistory = new ChatMessageHistory();
    let limit = conversation.configuration.historyBufferSize;
    if (!limit || limit < 0) {
      limit = 0;
    }
    const _messages: MessageType[] = await EnjoyApp.messages.findAll({
      where: { conversationId: conversation.id },
      order: [["createdAt", "DESC"]],
      limit,
    });

    _messages
      .sort(
        (a, b) =>
          new Date(a.createdAt).getUTCMilliseconds() -
          new Date(b.createdAt).getUTCMilliseconds()
      )
      .forEach((message) => {
        if (message.role === "user") {
          chatMessageHistory.addUserMessage(message.content);
        } else if (message.role === "assistant") {
          chatMessageHistory.addAIChatMessage(message.content);
        }
      });

    return chatMessageHistory;
  };

  const chat = async (
    message: Partial<MessageType>,
    params: {
      conversation: ConversationType;
    }
  ): Promise<Partial<MessageType>[]> => {
    const { conversation } = params;

    if (conversation.type === "gpt") {
      return askGPT(message, params);
    } else if (conversation.type === "tts") {
      return askTTS(message, params);
    } else {
      return [];
    }
  };
  const findDeckByLanguage = (
    anki: AnkiConfigType,
    language: string
  ): DeckConfig | undefined => {
    return anki.decks?.find((deck) => deck.language === language);
  };

  // 模拟异步获取 wordDeck 的函数
  const fetchWordDeck = async (): Promise<string[]> => {
    return fetchDeckUsefulData("word");
  };

  // 模拟异步获取 grammarDeck 的函数
  const fetchGrammarDeck = async (): Promise<string[]> => {
    return fetchDeckUsefulData("grammar");
  };
  //
  const fetchDeckUsefulData = async (type: string): Promise<string[]> => {
    // 这里模拟从网络获取数据的过程
    // 这里从网络获取数据的过程
    const client = new Client({
      baseUrl: anki.url,
    });
    const learningLanguageDeck = findDeckByLanguage(anki, learningLanguage);
    if (!learningLanguageDeck) {
      throw new Error(`Deck for language ${learningLanguage} not found`);
    }
    const targetDeck =
      type === "word"
        ? learningLanguageDeck.wordsDeck
        : learningLanguageDeck.grammarDeck; //简单判断，有需要再改

    const resultFromAnki = await client.api.post("", {
      action: "findCards",
      version: 6,
      key: anki.key,
      params: {
        query: `deck:${targetDeck}`,
      },
    });
    const cardIds: number[] = (resultFromAnki as any).result;
    const batchSize = 500; // 每批请求的卡片数量，可以根据需要调整
    const deckResult: string[] = [];

    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize);
      let response = await client.api.post("", {
        action: "cardsInfo",
        version: 6,
        key: anki.key,
        params: {
          cards: batch,
        },
      });

      (response as any).result.forEach((card: any) => {
        const fields = card.fields;
        const fieldOrderZero: any = Object.values(fields).find(
          (field: any) => field.order === 0
        );
        if (fieldOrderZero) {
          deckResult.push(fieldOrderZero?.value);
        }
      });
      response = null; //释放
    }

    return deckResult;
  };

  // 获取 wordDeck，并使用缓存机制
  const getWordDeck = async (): Promise<string[]> => {
    const now = Date.now();

    // 检查缓存是否存在以及是否过期
    if (
      wordDeckCache &&
      wordDeckCacheTimestamp &&
      now - wordDeckCacheTimestamp < CACHE_DURATION
    ) {
      return wordDeckCache;
    }

    // 如果缓存不存在或已过期，重新获取数据
    wordDeckCache = await fetchWordDeck();
    wordDeckCacheTimestamp = now;

    return wordDeckCache;
  };

  // 获取 grammarDeck，并使用缓存机制
  const getGrammarDeck = async (): Promise<string[]> => {
    const now = Date.now();

    // 检查缓存是否存在以及是否过期
    if (
      grammarDeckCache &&
      grammarDeckCacheTimestamp &&
      now - grammarDeckCacheTimestamp < CACHE_DURATION
    ) {
      return grammarDeckCache;
    }

    // 如果缓存不存在或已过期，重新获取数据
    grammarDeckCache = await fetchGrammarDeck();
    grammarDeckCacheTimestamp = now;

    return grammarDeckCache;
  };

  // 更新 systemMessage 的函数
  const addConstraints = async (systemMessage: string): Promise<string> => {
    // 定义需要查找和替换的词汇
    const wordToCheck = "wordDeck";
    const grammarToCheck = "grammarDeck";

    // 检查并替换 wordDeck
    if (systemMessage.includes(wordToCheck)) {
      const wordDeck = await getWordDeck();
      const wordDeckString = wordDeck.join(", ");
      systemMessage = systemMessage.replace(
        new RegExp(`\\b${wordToCheck}\\b`, "g"),
        ""
      );
      const wordConstraints = `Using only the following vocabulary/phrases I've learned:
${wordDeckString}.
    `;
      systemMessage += ` ${wordConstraints}`;
    }

    // 检查并替换 grammarDeck
    if (systemMessage.includes(grammarToCheck)) {
      const grammarDeck = await getGrammarDeck();
      const grammarDeckString = grammarDeck.join(", ");
      systemMessage = systemMessage.replace(
        new RegExp(`\\b${grammarToCheck}\\b`, "g"),
        ""
      );
      const grammarConstraints = `Using only the following sentence structure, grammar:
${grammarDeckString}.
    `;
      systemMessage += ` ${grammarConstraints}`;
    }

    // 移除多余的空格
    systemMessage = systemMessage.trim().replace(/\s+/g, " ");

    return systemMessage;
  };
  /*
   * Ask GPT
   * chat with GPT conversation
   * Use LLM to generate response
   */
  const askGPT = async (
    message: Partial<MessageType>,
    params: {
      conversation: ConversationType;
    }
  ): Promise<Partial<MessageType>[]> => {
    const { conversation } = params;
    const chatHistory = await fetchChatHistory(conversation);
    const memory = new BufferMemory({
      chatHistory,
      memoryKey: "history",
      returnMessages: true,
    });
    let systemMessage = conversation.configuration.roleDefinition as string;

    systemMessage = await addConstraints(systemMessage);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system" as MessageRoleEnum, systemMessage],
      new MessagesPlaceholder("history"),
      ["human", "{input}"],
    ]);

    const llm = pickLlm(conversation);
    const chain = new ConversationChain({
      llm: llm as any,
      memory,
      prompt,
      verbose: true,
    });
    let response: LLMResult["generations"][0] = [];
    await chain.call({ input: message.content }, [
      {
        handleLLMEnd: async (output) => {
          response = output.generations[0];
        },
      },
    ]);

    const replies = response.map((r) => {
      return {
        id: v4(),
        content: r.text,
        role: "assistant" as MessageRoleEnum,
        conversationId: conversation.id,
      };
    });

    message.role = "user" as MessageRoleEnum;
    message.conversationId = conversation.id;

    await EnjoyApp.messages.createInBatch([message, ...replies]);

    return replies;
  };

  /*
   * Ask TTS
   * chat with TTS conversation
   * It reply with the same text
   * and create speech using TTS
   */
  const askTTS = async (
    message: Partial<MessageType>,
    params: {
      conversation: ConversationType;
    }
  ): Promise<Partial<MessageType>[]> => {
    const { conversation } = params;
    const reply: MessageType = {
      id: v4(),
      content: message.content,
      role: "assistant" as MessageRoleEnum,
      conversationId: conversation.id,
      speeches: [],
    };
    message.role = "user" as MessageRoleEnum;
    message.conversationId = conversation.id;

    const speech = await tts({
      sourceType: "Message",
      sourceId: reply.id,
      text: reply.content,
      configuration: conversation.configuration.tts,
    });
    await EnjoyApp.messages.createInBatch([message, reply]);

    reply.speeches = [speech];

    return [reply];
  };

  const tts = async (params: Partial<SpeechType>) => {
    const { configuration } = params;
    const {
      engine = currentEngine.name,
      model = "tts-1",
      voice = "alloy",
      baseUrl,
    } = configuration || {};

    let client: OpenAI;

    if (engine === "enjoyai") {
      client = new OpenAI({
        apiKey: user.accessToken,
        baseURL: `${apiUrl}/api/ai`,
        dangerouslyAllowBrowser: true,
        maxRetries: 1,
      });
    } else if (openai) {
      client = new OpenAI({
        apiKey: openai.key,
        baseURL: baseUrl || openai.baseUrl,
        dangerouslyAllowBrowser: true,
        maxRetries: 1,
      });
    } else {
      throw new Error("OpenAI API key is required");
    }

    const file = await client.audio.speech.create({
      input: params.text,
      model,
      voice,
    });
    const buffer = await file.arrayBuffer();

    return EnjoyApp.speeches.create(
      {
        text: params.text,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        configuration: {
          engine,
          model,
          voice,
        },
      },
      {
        type: "audio/mp3",
        arrayBuffer: buffer,
      }
    );
  };

  return {
    chat,
    tts,
  };
};
