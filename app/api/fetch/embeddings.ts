import { Embedding } from "@/app/client/fetch/url";
import {
  DATASOURCES_CHUNK_OVERLAP,
  DATASOURCES_CHUNK_SIZE,
} from "@/scripts/constants.mjs";
import {
  Document,
  MetadataMode,
  SentenceSplitter,
  SimpleNodeParser,
  VectorStoreIndex,
  serviceContextFromDefaults,
  HuggingFaceEmbedding,
  Ollama,
} from "llamaindex";

export default async function splitAndEmbed(
  document: string,
): Promise<Embedding[]> {
  const nodeParser = new SimpleNodeParser({
    textSplitter: new SentenceSplitter({
      chunkSize: DATASOURCES_CHUNK_SIZE,
      chunkOverlap: DATASOURCES_CHUNK_OVERLAP,
    }),
  });
  const documents = [new Document({ text: document })];
  const nodes = nodeParser.getNodesFromDocuments(documents);

  const embedModel = new HuggingFaceEmbedding({
    /*modelType:"BAAI/bge-small-en-v1.5"*/
  });
  embedModel.getExtractor();
  const llm = new Ollama({
    model: "gemma:2b",
    requestTimeout: 4800.0,
    baseURL: "http://localhost:11434",
  });

  const serviceContext = serviceContextFromDefaults({
    embedModel: embedModel,
    llm: llm,
  });

  console.log(nodes);
  const index = await VectorStoreIndex.fromDocuments(documents, {
    serviceContext: serviceContext,
  });

  const nodesWithEmbeddings = await index.getNodeEmbeddingResults(nodes);

  return nodesWithEmbeddings.map((nodeWithEmbedding) => ({
    text: nodeWithEmbedding.getContent(MetadataMode.NONE),
    embedding: nodeWithEmbedding.getEmbedding(),
  }));
}
