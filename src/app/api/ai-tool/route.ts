import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// .env.local의 GEMINI_API_KEY를 읽어옵니다.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 기능별 프롬프트 정의
const PROMPTS: Record<string, string> = {
    // 1. 기사 초안 생성
    draft: `당신은 따뜻하고 전문적인 지역 신문 데스크입니다.
제공된 인터뷰 내용을 바탕으로 마을 소식지나 지역 신문에 게재될 1,200자 내외의 인터뷰 기사 초안을 작성하세요.
현장의 생생한 분위기 묘사와 직접 인용구를 조화롭게 배치하여 스토리텔링 형식으로 완성하세요.`,

    // 2. 인터뷰 내용 정리
    cleanup: `당신은 인터뷰 전문 에디터입니다.
인터뷰 녹취 원문에서 불필요한 추임새('어', '음', 말더듬 등)나 중복 표현을 제거하고,
핵심 맥락을 살려 [질문 - 핵심 요점 - 정리된 답변] 형태로 읽기 쉽고 체계적으로 재구성하세요.`,

    // 3. 제목·리드 추천
    headline: `제공된 인터뷰 내용을 심층 분석하여 독자의 시선을 끄는 제목과 리드문을 추천하세요.
1. 제목 5종:
  - 감성형 (마을의 정서와 울림을 담은 제목) 2개
  - 직관형 (기사의 핵심 팩트 중심) 2개
  - 인용형 (인터뷰이의 명대사 활용) 1개
2. 리드문(도입부): 기사 시작부에 들어갈 2~3문장 분량의 매력적인 도입문 2종`,

    // 4. 주요 발언 추출
    quotes: `인터뷰 원문에서 인터뷰이의 가치관, 삶의 철학, 마을에 대한 애정이 가장 잘 드러난 핵심 발언을 선별하세요.
기사 본문에 바로 강조 상자나 큰따옴표로 인용할 수 있는 명대사 3~5개를 선별하고, 각 발언의 전후 맥락을 한 줄로 함께 덧붙이세요.`,

    // 5. 발언 의도 분석
    intent: `인터뷰 발언의 이면에 담긴 행간과 의도를 분석하세요.
단순히 말한 표면적 사실을 넘어, 화자가 마을 공동체와 이웃 주민들에게 진정으로 전하고자 하는 숨은 의도와 핵심 메시지를 3~4가지 포인트로 정리하세요.`,

    // 6. 인물 소개글 생성
    profile: `제공된 인터뷰 내용을 바탕으로 기사 상단이나 프로필 박스에 들어갈 인물 소개글을 작성하세요.
인터뷰이의 현재 활동, 마을에서의 역할, 주요 특징이 한눈에 드러나도록 간결하고 신뢰감 높은 어조로 3~4문장 내외로 서술하세요.`,

    // 7. 인터뷰 요약문 생성
    summary: `바쁜 독자들이 인터뷰의 핵심을 1분 만에 파악할 수 있도록 3~4개의 핵심 불릿 포인트로 일목요연하게 요약하세요.`,

    // 8. 기사 다듬기 (윤문)
    polish: `작성된 기사 초안의 문장을 매끄럽게 다듬습니다.
문맥이 어색한 문장과 불필요한 번역투 표현을 고치고, 마을 주민 누구나 편안하게 읽을 수 있는 따뜻하고 자연스러운 문체로 윤문하세요.`,

    // 9. 사전 인터뷰 질문 생성
    questions: `주민 인터뷰 대상자의 배경과 취재 주제를 고려하여, 인터뷰이가 자연스럽게 자신의 속이야기와 경험을 풀어낼 수 있는 단계별 질문지 7개를 생성하세요. (라포 형성용 질문 → 핵심 질문 → 미래 계획 및 마을에 바라는 점 순서)`
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, text, extraInfo, prompt } = body;

        let finalPrompt = prompt;

        if (!finalPrompt) {
            if (!action || !PROMPTS[action]) {
                return NextResponse.json(
                    { error: "올바른 기능(action) 또는 prompt가 지정되지 않았습니다." },
                    { status: 400 }
                );
            }

            if (!text || !text.trim()) {
                return NextResponse.json(
                    { error: "분석할 텍스트 내용이 없습니다." },
                    { status: 400 }
                );
            }

            const systemPrompt = PROMPTS[action];
            const context = extraInfo
                ? `[추가 배경 정보]\n${extraInfo}\n\n[인터뷰 원문/텍스트]\n${text}`
                : `[인터뷰 원문/텍스트]\n${text}`;

            finalPrompt = `${systemPrompt}\n\n${context}`;
        }

        let response;
        try {
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: finalPrompt,
            });
        } catch (err: any) {
            if (
                err?.message?.includes("gemini-2.5-flash") ||
                err?.status === 404 ||
                err?.message?.includes("404")
            ) {
                response = await ai.models.generateContent({
                    model: "gemini-3.6-flash",
                    contents: finalPrompt,
                });
            } else {
                throw err;
            }
        }

        return NextResponse.json({ result: response.text });
    } catch (error: any) {
        console.error("구글 API 호출 에러:", error);
        return NextResponse.json(
            { error: error?.message || "AI 생성 실패" },
            { status: 500 }
        );
    }
}
