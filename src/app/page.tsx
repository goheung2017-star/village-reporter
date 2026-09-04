"use client";

import { useState, useRef } from "react";
import { Mic, Square, Loader2, Copy, Check, RefreshCw, FileText } from "lucide-react";

export default function ReporterWorkspace() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [interviewText, setInterviewText] = useState("");
  const [resultText, setResultText] = useState("");
  const [activeTab, setActiveTab] = useState("draft");
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 1. 브라우저 마이크 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 브라우저가 지원하는 오디오 코덱을 순차적으로 안전하게 선택
      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          alert("녹음된 음성 데이터가 없습니다. 조금 더 길게 말씀해 주세요.");
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        await handleTranscribe(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250); // 250ms 단위로 청크 데이터를 누락 없이 안정적으로 수집
      setIsRecording(true);
    } catch (err) {
      alert("마이크 접근 권한이 거부되었거나 사용 가능한 마이크 장치가 없습니다.");
    }
  };

  // 2. 녹음 중단
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 3. STT 변환 API 호출
  const handleTranscribe = async (blob: Blob) => {
    setIsProcessing(true);
    setLoadingMessage("현장 녹음 음성을 텍스트로 변환하고 있습니다...");
    const formData = new FormData();
    formData.append("audio", blob, "record.webm");

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);

      if (res.status !== 200) {
        // 백엔드가 내려준 구체적인 에러 메시지(data.error)를 alert로 표시
        alert(`음성 인식 서버 오류: ${data?.error || res.statusText || `상태 코드 ${res.status}`}`);
        return;
      }

      if (data?.text) {
        setInterviewText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
      } else if (data?.error) {
        alert(`음성 인식 오류: ${data.error}`);
      }
    } catch (err: any) {
      alert(`음성 인식 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
      setLoadingMessage("");
    }
  };

  // 4. AI 기사 작성/분석 도구 호출
  const runAiTool = async (action: string) => {
    if (!interviewText.trim()) {
      alert("먼저 왼쪽 창에 인터뷰 녹취 내용을 입력하거나 음성을 녹음해주세요.");
      return;
    }
    setActiveTab(action);
    setIsProcessing(true);
    setLoadingMessage("AI가 기사 및 인터뷰 내용을 분석하고 있습니다...");

    try {
      const res = await fetch("/api/ai-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: interviewText }),
      });
      const data = await res.json();
      if (data.result) {
        setResultText(data.result);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("AI 작업 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
      setLoadingMessage("");
    }
  };

  // 5. 결과 복사 기능
  const copyToClipboard = () => {
    if (!resultText) return;
    navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 9가지 핵심 기능 버튼 정의
  const toolButtons = [
    { id: "draft", label: "기사 초안 생성" },
    { id: "cleanup", label: "인터뷰 내용 정리" },
    { id: "headline", label: "제목·리드 추천" },
    { id: "quotes", label: "주요 발언 추출" },
    { id: "intent", label: "발언 의도 분석" },
    { id: "profile", label: "인물 소개글 생성" },
    { id: "summary", label: "인터뷰 요약문" },
    { id: "polish", label: "기사 다듬기" },
    { id: "questions", label: "사전 질문 생성" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8">
      {/* 상단 헤더 */}
      <header className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded">마을기자단 전용</span>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">AI 취재·기사 작성 도우미</h1>
          </div>
          <p className="text-slate-600 text-sm mt-1">현장 인터뷰 녹취부터 마을 소식지 기사 완성까지 한 번에 처리합니다.</p>
        </div>
      </header>

      {/* 메인 2단 워크스페이스 */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 녹음 및 원문 입력 영역 */}
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[750px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-800 text-base">인터뷰 원문 / 녹취록</span>
            </div>
            
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-full font-semibold shadow-sm transition-all animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" /> 녹음 완료
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-full font-semibold shadow-sm transition-all"
              >
                <Mic className="w-4 h-4" /> 현장 인터뷰 녹음
              </button>
            )}
          </div>

          <textarea
            className="flex-1 w-full p-4 mt-4 text-base leading-relaxed border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            placeholder="상단 '현장 인터뷰 녹음' 버튼을 눌러 녹음을 진행하거나, 직접 타이핑 또는 녹취 텍스트를 여기에 붙여넣으세요."
            value={interviewText}
            onChange={(e) => setInterviewText(e.target.value)}
          />

          <div className="pt-3 flex justify-between items-center text-xs text-slate-500">
            <span>글자 수: {interviewText.length}자</span>
            {interviewText && (
              <button
                onClick={() => setInterviewText("")}
                className="text-slate-400 hover:text-slate-600 underline"
              >
                원문 지우기
              </button>
            )}
          </div>
        </section>

        {/* 오른쪽: AI 작업 도구 및 생성 결과 */}
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[750px]">
          {/* 기능 선택 탭 버튼 그리드 */}
          <div className="grid grid-cols-3 gap-2 pb-4 border-b border-slate-100">
            {toolButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => runAiTool(btn.id)}
                disabled={isProcessing}
                className={`text-xs md:text-sm py-2.5 px-2 rounded-xl font-medium transition-all ${
                  activeTab === btn.id
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* 결과 표시 영역 */}
          <div className="flex-1 relative mt-4">
            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-100">
                <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
                <span className="text-sm font-semibold text-slate-700">{loadingMessage}</span>
              </div>
            )}
            <textarea
              readOnly
              className="w-full h-full p-4 text-base leading-relaxed bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none text-slate-800"
              placeholder="상단의 AI 기능 버튼을 누르면 정제된 결과물이 이곳에 표시됩니다."
              value={resultText}
            />
          </div>

          {/* 하단 제어 버튼 */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-100 mt-2">
            <button
              onClick={() => runAiTool(activeTab)}
              disabled={isProcessing || !interviewText}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-30"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 다시 생성
            </button>

            <button
              onClick={copyToClipboard}
              disabled={!resultText}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "복사 완료!" : "기사 결과 복사"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}