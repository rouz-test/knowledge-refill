"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("birthYear");
      if (saved) router.replace("/content");
      else router.replace("/birth-year");
    }, 900); // 0.9초: 필요하면 700~1200 사이로 조정

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main
      style={{
        height: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>지식 리필</div>
        <div style={{ marginTop: 10, opacity: 0.75 }}>
          오늘도 하나만, 가볍게 업데이트
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: 0.5 }}>
          Loading…
        </div>
      </div>
    </main>
  );
}