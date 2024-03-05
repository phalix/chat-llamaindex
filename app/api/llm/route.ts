import {
  ChatHistory,
  ChatMessage,
  ContextChatEngine,
  Document,
  HuggingFaceEmbedding,
  QdrantVectorStore,
  Ollama,
  ServiceContext,
  SimpleChatEngine,
  SimpleChatHistory,
  SummaryChatHistory,
  VectorStoreIndex,
  serviceContextFromDefaults,
  Response,
} from "llamaindex";

import { ALL_MODELS } from "../../client/platforms/llm";

import { NextRequest, NextResponse } from "next/server";
import { LLMConfig, MessageContent } from "@/app/client/platforms/llm";

import {
  DATASOURCES_CHUNK_OVERLAP,
  DATASOURCES_CHUNK_SIZE,
} from "@/scripts/constants.mjs";
import { Embedding } from "@/app/client/fetch/url";
import Locale from "@/app/locales";

async function createChatEngine(
  serviceContext: ServiceContext,
  index?: VectorStoreIndex,
) {
  if (index) {
    const retriever = index!.asRetriever();
    retriever.similarityTopK = 5;

    return new ContextChatEngine({
      chatModel: serviceContext.llm,
      retriever,
    });
  }

  return new SimpleChatEngine({
    llm: serviceContext.llm,
  });
}

async function createIndex(
  serviceContext: ServiceContext,
  embeddings: Embedding[],
) {
  const documents = embeddings.map((config) => {
    return new Document({ text: config.text });
  });

  const index = VectorStoreIndex.fromDocuments(documents, {
    serviceContext: serviceContext,
  });

  return index;
}

function createReadableStream(
  stream: AsyncIterable<Response>,
  chatHistory: ChatHistory,
) {
  const it = stream[Symbol.asyncIterator]();
  let responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  let aborted = false;
  writer.closed.catch(() => {
    // reader aborted the stream
    aborted = true;
  });
  const encoder = new TextEncoder();
  const onNext = async () => {
    try {
      const { value, done } = await it.next();
      if (aborted) return;
      if (!done) {
        writer.write(
          encoder.encode(`data: ${JSON.stringify(value.response)}\n\n`),
        );
        onNext();
      } else {
        writer.write(
          `data: ${JSON.stringify({
            done: true,
            // get the optional message containing the chat summary
            memoryMessage: chatHistory
              .newMessages()
              .filter((m) => m.role === "memory")
              .at(0),
          })}\n\n`,
        );
        writer.close();
      }
    } catch (error) {
      console.error("[LlamaIndex]", error);
      writer.write(
        `data: ${JSON.stringify({
          error: Locale.Chat.LLMError,
        })}\n\n`,
      );
      writer.close();
    }
  };
  onNext();
  return responseStream.readable;
}

export async function GET(request: NextRequest) {
  return NextResponse.json(ALL_MODELS);
}

export async function PUT(request: NextRequest) {
  const body = await request.text();
  const response = await fetch(process.env.ollamabaseurl + "/api/pull", {
    method: "POST",
    body: body,
  });
  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      chatHistory: messages,
      datasource,
      config,
      embeddings,
    }: {
      message: MessageContent;
      chatHistory: ChatMessage[];
      datasource: string | undefined;
      config: LLMConfig;
      embeddings: Embedding[] | undefined;
    } = body;
    if (!message || !messages || !config) {
      return NextResponse.json(
        {
          error:
            "message, chatHistory and config are required in the request body",
        },
        { status: 400 },
      );
    }

    /*const llmoai = new OpenAI({
      model: config.model,
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens,
    });*/

    const llm = new Ollama({
      model: config.model,
      requestTimeout: 19200.0,
      baseURL: process.env.ollamabaseurl,
      temperature: config.temperature,
      topP: config.topP,
    });

    const embedModel = new HuggingFaceEmbedding({
      modelType: "BAAI/bge-small-en-v1.5",
      quantized: false,
    });

    const serviceContext = serviceContextFromDefaults({
      llm,
      embedModel: embedModel,
      chunkSize: DATASOURCES_CHUNK_SIZE,
      chunkOverlap: DATASOURCES_CHUNK_OVERLAP,
    });

    let chatEngine;
    if (embeddings) {
      const index = await createIndex(serviceContext, embeddings);
      chatEngine = await createChatEngine(serviceContext, index);
    } else {
      const vectorStore = new QdrantVectorStore({
        url: process.env.qdrantbaseurl,
        collectionName: datasource,
      });
      let exists = false;
      if (datasource) {
        exists = await vectorStore.collectionExists(datasource);
      }
      if (datasource && exists) {
        if (!exists) {
          await vectorStore.createCollection(
            datasource,
            embedModel.embedBatchSize,
          );
        }
        const index = await VectorStoreIndex.fromVectorStore(
          vectorStore,
          serviceContext,
        );

        /*const queryEngine = index.asQueryEngine();

        const response = await queryEngine.query({
          query: "What did the author do in college?",
        });

        console.log(response)*/

        chatEngine = await createChatEngine(serviceContext, index);
      } else {
        chatEngine = await createChatEngine(serviceContext);
      }
    }

    //TODO: currently not implemented in any other thing than open ai!
    config.sendMemory = false;

    const chatHistory = config.sendMemory
      ? new SummaryChatHistory({ llm, messages })
      : new SimpleChatHistory({ messages });

    const stream = await chatEngine.chat({
      message,
      chatHistory,
      stream: true,
    });
    const readableStream = createReadableStream(stream, chatHistory);

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return NextResponse.json(
      {
        error: Locale.Chat.LLMError,
      },
      {
        status: 500,
      },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Set max running time of function, for Vercel Hobby use 10 seconds, see https://vercel.com/docs/functions/serverless-functions/runtimes#maxduration
export const maxDuration = 120;
