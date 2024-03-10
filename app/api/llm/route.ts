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
  CallbackManager,
} from "llamaindex";

import { createServiceContext, createVectorIndex } from "./provisioner";

import { ALL_MODELS } from "../../client/platforms/llm";

import { NextRequest, NextResponse } from "next/server";
import { LLMConfig, MessageContent } from "@/app/client/platforms/llm";

import { Embedding } from "@/app/client/fetch/url";
import Locale from "@/app/locales";

async function createChatEngine(
  serviceContext: ServiceContext,
  index?: VectorStoreIndex,
  topk = 5,
  chatHistory?: ChatMessage[],
) {
  if (index) {
    const retriever = index!.asRetriever();
    retriever.similarityTopK = topk;

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
      topk,
      timeout,
    }: {
      message: MessageContent;
      chatHistory: ChatMessage[];
      datasource: string | undefined;
      config: LLMConfig;
      embeddings: Embedding[] | undefined;
      topk: number | undefined;
      timeout: number | undefined;
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

    const callbackManager = new CallbackManager({
      onLLMStream: (x) => {
        console.log(x);
      },
      onRetrieve: (x) => {
        console.log(x);
      },
    });

    const [serviceContext, llm, embedModel] = createServiceContext(
      config,
      timeout ? timeout : 40000,
      callbackManager,
    );

    let chatEngine;
    if (embeddings) {
      const index = await createIndex(serviceContext, embeddings);
      chatEngine = await createChatEngine(
        serviceContext,
        index,
        topk,
        messages,
      );
    } else {
      if (datasource) {
        const index = await createVectorIndex(
          serviceContext,
          embedModel,
          datasource,
          timeout ? timeout : 40000,
        );

        chatEngine = await createChatEngine(
          serviceContext,
          index,
          topk,
          messages,
        );
      } else {
        chatEngine = await createChatEngine(serviceContext);
      }
    }

    //TODO: currently not implemented in any other thing than open ai!
    //Tokens of ollama is not implemented!
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
