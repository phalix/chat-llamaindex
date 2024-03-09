import { Embedding } from "@/app/client/fetch/url";

import {
  Document,
  MetadataMode,
  SentenceSplitter,
  SimpleNodeParser,
  VectorStoreIndex,
  serviceContextFromDefaults,
  HuggingFaceEmbedding,
  Ollama,
  QdrantVectorStore,
} from "llamaindex";

export async function splitCSVAndEmbed(
  document: string,
  datasource?: string,
): Promise<Embedding[]> {
  const nodeParser = new SimpleNodeParser({
    textSplitter: new SentenceSplitter({
      chunkSize: 512,
      chunkOverlap: 20,
    }),
  });
  const documents = document.split("\n").map((x) => {
    return new Document({ text: x });
  });
  //const documents = [new Document({ text: document })];
  const nodes = nodeParser.getNodesFromDocuments(documents);

  const embedModel = new HuggingFaceEmbedding({
    modelType: "BAAI/bge-small-en-v1.5",
    quantized: false,
  });
  embedModel.getExtractor();
  const llm = new Ollama({
    model: "gemma:2b",
    requestTimeout: 4800.0,
    baseURL: process.env.ollamabaseurl,
  });

  const serviceContext = serviceContextFromDefaults({
    embedModel: embedModel,
    llm: llm,
  });

  const vectorStore = new QdrantVectorStore({
    url: process.env.qdrantbaseurl,
    collectionName: datasource,
  });

  const index = await VectorStoreIndex.fromDocuments(documents, {
    vectorStore,
    serviceContext: serviceContext,
  });

  const nodesWithEmbeddings = await index.getNodeEmbeddingResults(nodes);

  return nodesWithEmbeddings.map((nodeWithEmbedding) => ({
    text: nodeWithEmbedding.getContent(MetadataMode.NONE),
    embedding: nodeWithEmbedding.getEmbedding(),
  }));
}

export async function splitAndEmbed(
  document: string,
  datasource?: string,
): Promise<Embedding[]> {
  const nodeParser = new SimpleNodeParser({
    textSplitter: new SentenceSplitter({
      chunkSize: 512,
      chunkOverlap: 20,
    }),
  });
  document = document.replace(/[^A-Za-z0-9öäü ]+/g, " ");
  const documents = [new Document({ text: document, id_: "test123" })];
  const nodes = nodeParser.getNodesFromDocuments(documents);
  console.log("step 1");
  const embedModel = new HuggingFaceEmbedding({
    modelType: "BAAI/bge-small-en-v1.5",
    quantized: false,
  });
  embedModel.getExtractor();

  const llm = new Ollama({
    model: "gemma:2b",
    requestTimeout: 4800.0,
    baseURL: process.env.ollamabaseurl,
  });

  const serviceContext = serviceContextFromDefaults({
    embedModel: embedModel,
    llm: llm,
  });

  const vectorStore = new QdrantVectorStore({
    url: process.env.qdrantbaseurl,
    collectionName: datasource,
  });

  const index = await VectorStoreIndex.fromDocuments(documents, {
    vectorStore: vectorStore,
    logProgress: false,
    serviceContext: serviceContext,
  });

  const nodesWithEmbeddings = await index.getNodeEmbeddingResults(nodes);

  return nodesWithEmbeddings.map((nodeWithEmbedding) => ({
    text: nodeWithEmbedding.getContent(MetadataMode.NONE),
    embedding: nodeWithEmbedding.getEmbedding(),
  }));
}
