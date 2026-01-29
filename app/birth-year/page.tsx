"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BirthYearWheelPicker from "../components/BirthYearWheelPicker";

export default function BirthYearPage() {
  const router = useRouter();

  const defaultYear = useMemo(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("birthYear") : null;
    const y = saved ? Number(saved) : 1990;
    return Number.isFinite(y) ? y : 1990;
  }, []);

  const [birthYear, setBirthYear] = useState<number>(defaultYear);

  const goNext = () => {
    localStorage.setItem("birthYear", String(birthYear));
    router.push("/content");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0b0b10", color: "white", padding: 24 }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: "center" }}>태어난 해를 선택해 주세요</h1>
        <p style={{ marginTop: 10, opacity: 0.75, textAlign: "center" }}>
          연령대에 맞춘 콘텐츠를 보여드립니다.
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 18,
            border: "1px solid rgba(168,85,247,0.35)",
            background: "linear-gradient(135deg, rgba(88,28,135,0.45), rgba(24,24,27,0.7))",
          }}
        >
          <BirthYearWheelPicker value={birthYear} onChange={setBirthYear} startYear={1940} />

          <button
            onClick={goNext}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "14px 12px",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 800,
              background: "linear-gradient(90deg, rgba(168,85,247,1), rgba(88,28,135,1))",
            }}
          >
            시작하기
          </button>
        </div>

        <p style={{ marginTop: 16, textAlign: "center", opacity: 0.5, fontSize: 12 }}>
          이 정보는 기기에만 저장되며 외부로 전송되지 않습니다.
        </p>
      </div>
    </main>
  );
}