import {
  fetchContentFromURL,
  getPDFContentFromBuffer,
} from "@/app/api/fetch/content";
import { NextResponse, NextRequest } from "next/server";

import { splitAndEmbed, splitCSVAndEmbed } from "./embeddings";
import { URLDetailContent } from "@/app/client/fetch/url";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const site = searchParams.get("site");
  if (!site) {
    return NextResponse.json(
      { error: "Missing site parameter" },
      { status: 400 },
    );
  }

  try {
    const urlContent = await fetchContentFromURL(site);
    urlContent.embeddings = await splitAndEmbed(urlContent.content!);
    return NextResponse.json(urlContent);
  } catch (error) {
    console.error("[Fetch]", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}

async function handleText(
  fileName: string,
  text: string,
  datasource?: string,
): Promise<URLDetailContent> {
  const embeddings = await splitAndEmbed(text, datasource);
  return {
    content: text,
    embeddings: embeddings,
    url: fileName,
    size: text.length,
    type: "text/plain",
  };
}

async function handlePDF(
  fileName: string,
  pdf: string,
  datasource?: string,
): Promise<URLDetailContent> {
  const pdfBuffer = Buffer.from(pdf, "base64");
  const pdfData = await getPDFContentFromBuffer(pdfBuffer);
  const embeddings = await splitAndEmbed(pdfData.content, datasource);
  return {
    content: pdfData.content,
    embeddings: embeddings,
    size: pdfData.size,
    type: "application/pdf",
    url: fileName,
  };
}

async function handleCSV(
  fileName: string,
  csv: string,
  datasource?: string,
): Promise<URLDetailContent> {
  const embeddings = await splitCSVAndEmbed(csv, datasource);
  return {
    content: csv,
    embeddings: embeddings,
    url: fileName,
    size: csv.length,
    type: "text/csv",
  };
}

type Input = {
  datasource?: string;
  fileName: string;
  pdf?: string;
  text?: string;
  csv?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { datasource, fileName, pdf, text, csv }: Input =
      await request.json();
    if (!fileName && (!pdf || !text)) {
      return NextResponse.json(
        {
          error:
            "filename and either text or pdf is required in the request body",
        },
        { status: 400 },
      );
    }
    let json;
    if (pdf) {
      json = await handlePDF(fileName, pdf, datasource);
    }
    if (text) {
      json = await handleText(fileName, text!, datasource);
    }
    if (csv) {
      json = await handleCSV(fileName, csv, datasource);
    }

    return NextResponse.json(json);
  } catch (error) {
    console.error("[Fetch]", error);
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      {
        status: 500,
      },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
