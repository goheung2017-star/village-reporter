import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY 환경 변수가 .env.local에 설정되지 않았습니다." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "오디오 데이터가 전달되지 않았습니다." },
        { status: 400 }
      );
    }

    // audio Blob을 Buffer로 변환한 후 base64 인라인 데이터로 인코딩
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    let mimeType = audioFile.type || "audio/webm";
    if (mimeType.includes("webm")) {
      mimeType = "audio/webm";
    } else if (mimeType.includes("mp4")) {
      mimeType = "audio/mp4";
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt =
      "다음 한국어 음성을 듣고 정확하게 받아써 주세요. 추임새나 의미 없는 잡음은 자연스럽게 정리하고, 오직 받아쓴 텍스트 내용만 출력하세요.";

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          {
            text: prompt,
          },
        ],
      });
    } catch (err: any) {
      // gemini-2.5-flash 모델이 비활성화된 환경인 경우 gemini-3.6-flash로 자동 대체
      if (
        err?.message?.includes("gemini-2.5-flash") ||
        err?.status === 404 ||
        err?.message?.includes("404")
      ) {
        response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: prompt,
            },
          ],
        });
      } else {
        throw err;
      }
    }

    const resultText = response?.text?.trim() || "";

    return NextResponse.json({ text: resultText });
  } catch (error: any) {
    console.error("Gemini 음성 인식(STT) 오류:", error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
