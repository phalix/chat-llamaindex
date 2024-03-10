import {
  BaseEmbedding,
  CallbackManager,
  HuggingFaceEmbedding,
  LLM,
  Ollama,
  ServiceContext,
  serviceContextFromDefaults,
  QdrantVectorStore,
  VectorStoreIndex,
} from "llamaindex";

import { QdrantClient } from "@qdrant/js-client-rest";

import { LLMConfig } from "@/app/client/platforms/llm";

export async function createVectorIndex(
  serviceContext: ServiceContext,
  embedModel: BaseEmbedding,
  datasource: string,
  timeout: number,
): Promise<VectorStoreIndex> {
  /*manually intializing qdrant client, in order to make it possible to set the timeout*/
  const qdrClient = new QdrantClient({
    url: process.env.qdrantbaseurl,
    timeout: timeout ? timeout : 40000,
  });

  const vectorStore = new QdrantVectorStore({
    client: qdrClient,
    collectionName: datasource,
  });
  let exists = false;
  exists = await vectorStore.collectionExists(datasource);
  if (!exists) {
    const test = await embedModel.getTextEmbedding("hi");
    await vectorStore.createCollection(datasource, test.length);
  }
  const index = await VectorStoreIndex.fromVectorStore(
    vectorStore,
    serviceContext,
  );
  return index;
}

export function createServiceContext(
  config: LLMConfig,
  timeout: number,
  callbackManager?: CallbackManager,
): [ServiceContext, LLM, BaseEmbedding] {
  const llm = new Ollama({
    model: config.model,
    requestTimeout: timeout ? timeout : 40000,
    baseURL: process.env.ollamabaseurl,
    temperature: config.temperature,
    topP: config.topP,
    callbackManager: callbackManager,
    modelMetadata: {
      maxTokens: 4096 / 4,
      contextWindow: 4096,
    },
  });

  const embedModel = new HuggingFaceEmbedding({
    modelType: "BAAI/bge-small-en-v1.5",
    quantized: false,
  });

  const serviceContext = serviceContextFromDefaults({
    llm,
    embedModel: embedModel,
    chunkSize: 512,
    chunkOverlap: 20,
    callbackManager: callbackManager,
  });

  return [serviceContext, llm, embedModel];
}
