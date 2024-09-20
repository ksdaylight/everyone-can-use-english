import {
  AppSettingsProviderContext,
  AISettingsProviderContext,
} from "@renderer/context";
import { useContext } from "react";
import { ChatMessageHistory, BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import OpenAI from "openai";
import { type LLMResult } from "@langchain/core/outputs";
import { v4 } from "uuid";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { t } from "i18next";
import { Client } from "@/api";

// 定义缓存机制
let wordDeckCache: string[] | null = null;
let grammarDeckCache: string[] | null = null;
let wordDeckCacheTimestamp: number | null = null;
let grammarDeckCacheTimestamp: number | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 缓存有效期为 1 小时（以毫秒为单位）

export const useConversation = () => {
  const { EnjoyApp, user, apiUrl, anki, learningLanguage, azureApi } =
    useContext(AppSettingsProviderContext);
  // const { googleGenerativeAi } = useContext(AISettingsProviderContext);
  const { openai, currentEngine } = useContext(AISettingsProviderContext);

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
    const clearAndReturnOriginal = "clearAndReturnOriginal";
    // 检查并替换 wordDeck
    if (systemMessage.includes(wordToCheck)) {
      const wordDeck = await getWordDeck();
      const wordDeckString = wordDeck.join(", ");
      systemMessage = systemMessage.replace(
        new RegExp(`\\b${wordToCheck}\\b`, "g"),
        ""
      );
      let preWordConstraints = "";
      if (learningLanguage === "fr-FR") {
        preWordConstraints = "Voici les mots/phrases, etc., que j'ai appris :";
      } else {
        preWordConstraints = "Here are the words/phrases etc I learned:";
      }
      const wordConstraints = `${preWordConstraints}
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
      let preGrammarConstraints = "";
      if (learningLanguage === "fr-FR") {
        preGrammarConstraints =
          "Ce qui suit est ce que j'ai appris sur la structure des phrases, la grammaire, etc.:";
      } else {
        preGrammarConstraints =
          "The following are what I learned about sentence structure, grammar etc:";
      }
      const grammarConstraints = `${preGrammarConstraints}
${grammarDeckString}.
    `;
      systemMessage += ` ${grammarConstraints}`;
    }

    if (systemMessage.includes(clearAndReturnOriginal)) {
      systemMessage = ""; //清空
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
      prompt: prompt as any,
      verbose: true,
    });
    let response: LLMResult["generations"][0] = [];
    try {
      await chain.call({ input: message.content }, [
        {
          handleLLMEnd: async (output) => {
            response = output.generations[0];
          },
        },
      ]);
    } catch (error) {
      // response.push({ text: systemMessage + "\n---->" + message.content });//通过主动制造错误，直接返回特定格式内容
      response.push({ text: systemMessage + message.content }); //通过主动制造错误，直接返回特定格式内容
    }

    const replies = response.map((r) => {
      return {
        id: v4(),
        content: r.text,
        role: "assistant" as MessageRoleEnum,
        conversationId: conversation.id,
      };
    });
    // message.content = systemMessage + message.content;
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
  const frSpeakers = [
    "fr-FR-CelesteNeural",
    "fr-FR-CelesteNeural",
    "fr-FR-HenriNeural",
    "fr-FR-AlainNeural",
    "fr-FR-ClaudeNeural",
    "fr-FR-MauriceNeural",
    "fr-FR-JosephineNeural",
    "fr-FR-YvetteNeural",
    "fr-FR-EloiseNeural",
    "fr-FR-JeromeNeural",
    "fr-FR-CoralieNeural",
    "fr-FR-JacquelineNeural",
    "fr-FR-YvesNeural",
    "fr-FR-DeniseNeural",
  ];
  const generateSSMLText = (input: string, speakers: string[]): string => {
    // Split the input into lines
    const lines = input.split("\n").map((line) => line.trim());

    // Filter out empty lines and whitespace-only lines
    const filteredLines = lines.filter((line) => line !== "");

    // Shuffle the speakers array randomly
    const shuffledSpeakers = shuffleArray(speakers);

    // Prepare SSML text
    let ssmlText = `
    <speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="fr-FR">
  `;

    filteredLines.forEach((line, index) => {
      // Get speaker from shuffled array
      const speaker = shuffledSpeakers[index % shuffledSpeakers.length];

      // Skip empty lines
      if (line.trim() === "") return;

      // Format each line with SSML tags
      ssmlText += `
      <voice name="${speaker}">
        <mstts:express-as>
          <prosody rate="0%" pitch="0%">
            ${line}
          </prosody>
        </mstts:express-as>
      </voice>
    `;
    });

    // Close SSML tag
    ssmlText += `
    </speak>
  `;

    return ssmlText.trim(); // Trim to remove any leading/trailing whitespace
  };

  // Function to shuffle array randomly
  const shuffleArray = (array: any[]): any[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  const tts = async (params: Partial<SpeechType>) => {
    const { configuration } = params;
    const { engine, model = "tts-1", voice } = configuration || {};

    let buffer;

    const ssmlOutput = generateSSMLText(params.text, frSpeakers);
    buffer = await EnjoyApp.recordings.askAzureTTS(
      ssmlOutput,
      azureApi.key,
      azureApi.region
    );

    // if (model.match(/^(openai|tts-)/)) {
    //   buffer = await openaiTTS(params);
    // } else if (model.startsWith("azure")) {
    //   // buffer = await azureTTS(params);
    //   buffer = await openaiTTS(params);
    // }

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
      } //要改顺序
    );
  };

  const openaiTTS = async (params: Partial<SpeechType>) => {
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
      throw new Error(t("openaiKeyRequired"));
    }

    // const file = await client.audio.speech.create({
    //   input: params.text,
    //   model,
    //   voice,
    // });
    // const buffer = await file.arrayBuffer();

    //      `
    //     <speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="fr-FR">
    //     <voice name="fr-FR-CelesteNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 danse
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-BrigitteNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 A. danse (nom féminin) : Activité artistique et culturelle consistant en des mouvements rythmés et expressifs du corps.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-HenriNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 Elle aime beaucoup la danse classique.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-AlainNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 Nous avons un cours de danse tous les mercredis.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-ClaudeNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 Les enfants ont fait une belle danse lors du spectacle.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-MauriceNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 B. danse (verbe) : Effectuer des mouvements rythmés et coordonnés avec le corps en rythme avec la musique.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-JosephineNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 Ils dansent ensemble lors des mariages.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-YvetteNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 Les jeunes apprennent à danser le hip-hop.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>

    //     <voice name="fr-FR-EloiseNeural">
    //         <mstts:express-as>
    //             <prosody rate="0%" pitch="0%">
    //                 Elle danse avec légèreté et grâce.
    //             </prosody>
    //         </mstts:express-as>
    //     </voice>
    // </speak>
    //     `

    //     const input = `
    //   danse
    //   A. danse (nom féminin) : Activité artistique et culturelle consistant en des mouvements rythmés et expressifs du corps.

    //   Elle aime beaucoup la danse classique.

    //   Nous avons un cours de danse tous les mercredis.

    //   Les enfants ont fait une belle danse lors du spectacle.

    //   B. danse (verbe) : Effectuer des mouvements rythmés et coordonnés avec le corps en rythme avec la musique.

    //   Ils dansent ensemble lors des mariages.

    //   Les jeunes apprennent à danser le hip-hop.

    //   Elle danse avec légèreté et grâce.
    // `;
    const ssmlOutput = generateSSMLText(params.text, frSpeakers);
    const buffer: any = await EnjoyApp.recordings.askAzureTTS(
      ssmlOutput,
      azureApi.key,
      azureApi.region
    );

    return EnjoyApp.speeches.create(
      {
        text: params.text, //input,
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
