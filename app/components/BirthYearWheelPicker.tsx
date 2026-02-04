"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: number;
  onChange: (year: number) => void;
  startYear?: number; // default 1940
};

export default function BirthYearWheelPicker({
  value,
  onChange,
  startYear = 1940,
}: Props) {
  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    return Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => startYear + i
    );
  }, [currentYear, startYear]);

  const wheelRef = useRef<HTMLDivElement>(null);
  const itemHeight = 60;

  // 최초 진입 시 현재 value 위치로 스크롤 맞추기
  useEffect(() => {
    const idx = years.indexOf(value);
    if (wheelRef.current && idx !== -1) {
      wheelRef.current.scrollTop = idx * itemHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    const el = wheelRef.current;
    if (!el) return;

    const index = Math.round(el.scrollTop / itemHeight);
    const year = years[index];
    if (year && year !== value) onChange(year);
  };

  const handleYearClick = (year: number) => {
    onChange(year);
    const idx = years.indexOf(year);
    if (wheelRef.current && idx !== -1) {
      wheelRef.current.scrollTo({ top: idx * itemHeight, behavior: "smooth" });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* 선택 인디케이터 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: itemHeight,
          borderTop: "2px solid rgba(168, 85, 247, 0.45)",
          borderBottom: "2px solid rgba(168, 85, 247, 0.45)",
          background:
            "linear-gradient(90deg, rgba(168,85,247,0.18), rgba(88,28,135,0.18))",
          borderRadius: 12,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* 상/하단 그라데이션(휠 느낌) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 96,
          background:
            "linear-gradient(to bottom, rgba(24,24,27,0.9), rgba(24,24,27,0.4), transparent)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 96,
          background:
            "linear-gradient(to top, rgba(24,24,27,0.9), rgba(24,24,27,0.4), transparent)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* 스크롤 리스트 */}
      <div
        ref={wheelRef}
        onScroll={handleScroll}
        className="scrollbar-hide"
        style={{
          height: 300,
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
          paddingTop: 120,
          paddingBottom: 120,
          position: "relative",
          zIndex: 1,
        }}
      >
        {years.map((year) => {
          const isSelected = year === value;
          return (
            <button
              key={year}
              onClick={() => handleYearClick(year)}
              style={{
                width: "100%",
                height: itemHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scrollSnapAlign: "center",
                transition: "all 200ms ease",
                fontSize: isSelected ? 26 : 18,
                fontWeight: isSelected ? 800 : 500,
                color: isSelected ? "white" : "rgba(168, 85, 247, 0.45)",
                background: "transparent",
              }}
            >
              {year}년
            </button>
          );
        })}
      </div>

      {/* 스크롤바 숨김 CSS (전역) */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}