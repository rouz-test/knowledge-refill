"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hold = params.get("hold");
  
    if (hold === "1") return; // ⬅ 스플래시 강제 유지
  
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("birthYear");
      if (saved) router.replace("/content");
      else router.replace("/birth-year");
    }, 900);
  
    return () => window.clearTimeout(timer);
  }, [router]);
  return (
    <main
      style={{
        height: "100vh",
        position: "relative",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(60% 60% at 50% 30%, rgba(168,85,247,0.18), transparent 60%), linear-gradient(180deg, #0b0614 0%, #12081f 50%, #07040d 100%)",
        color: "#f5f3ff",
      }}
    >
      <div
        style={{
          textAlign: "center",
          animation: "fadeUp 600ms ease-out forwards",
          opacity: 0,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <svg
            viewBox="0 0 200 200"
            width="120"
            height="120"
            role="img"
            aria-label="Knowledge Refill Logo"
          >
            <circle className="kr-bowl" cx="100" cy="100" r="78" />

            <g className="kr-dot kr-dot1">
              <path d={blobPath(100, 138, 9.6, 9.0)} />
            </g>
            <g className="kr-dot kr-dot2">
              <path d={blobPath(120, 136, 8.4, 7.9)} />
            </g>
            <g className="kr-dot kr-dot3">
              <path d={blobPath(80, 134, 9.0, 8.5)} />
            </g>
            <g className="kr-dot kr-dot4">
              <path d={blobPath(66, 122, 7.8, 7.3)} />
            </g>

            <g className="kr-dot kr-dot5">
              <path d={blobPath(132, 124, 7.2, 6.8)} />
            </g>
            <g className="kr-dot kr-dot6">
              <path d={blobPath(92, 122, 6.9, 6.5)} />
            </g>
            <g className="kr-dot kr-dot7">
              <path d={blobPath(110, 124, 7.1, 6.7)} />
            </g>
            <g className="kr-dot kr-dot8">
              <path d={blobPath(80, 114, 6.6, 6.2)} />
            </g>

            {/* Last dot: delayed “툭” */}
            <g className="kr-dot kr-dot9">
              <path d={blobPath(64, 106, 7.4, 7.0)} />
            </g>
          </svg>
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 0.6,
            opacity: 0.85,
          }}
        >
          지식조각
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            opacity: 0.45,
            letterSpacing: 0.4,
          }}
        >
          쌓는 중…
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
          textAlign: "center",
          fontSize: 11,
          letterSpacing: 0.3,
          opacity: 0.35,
        }}
      >
        © {new Date().getFullYear()} rouz. All rights reserved.
      </div>
      <style jsx>{`
        /* Logo (circle bowl + dots) */
        .kr-bowl {
          fill: none;
          stroke: rgba(221, 214, 254, 0.85);
          stroke-width: 3;
          opacity: 0;
          animation: krBowlIn 220ms ease-out forwards;
        }

        .kr-dot path {
          fill: rgba(245, 243, 255, 0.92);
          filter: drop-shadow(0 6px 14px rgba(168,85,247,0.18));
          /* ⬇️ 점 크기 재조정 (약 1.5배) */
          transform: scale(1.5);
          transform-origin: center;
        }

        .kr-dot {
          opacity: 0;
          /* SVG에서도 transform이 자연스럽게 먹도록 */
          transform-box: fill-box;
          transform-origin: center;
        }

        /* Dots: rhythmic pour (staggered) */
        .kr-dot1 { animation: krPour1 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards; }
        .kr-dot2 { animation: krPour2 560ms cubic-bezier(0.22, 1, 0.36, 1) 200ms forwards; }
        .kr-dot3 { animation: krPour3 560ms cubic-bezier(0.22, 1, 0.36, 1) 280ms forwards; }
        .kr-dot4 { animation: krPour4 560ms cubic-bezier(0.22, 1, 0.36, 1) 360ms forwards; }

        .kr-dot5 { animation: krPour2 560ms cubic-bezier(0.22, 1, 0.36, 1) 440ms forwards; }
        .kr-dot6 { animation: krPour3 560ms cubic-bezier(0.22, 1, 0.36, 1) 520ms forwards; }
        .kr-dot7 { animation: krPour4 560ms cubic-bezier(0.22, 1, 0.36, 1) 600ms forwards; }
        .kr-dot8 { animation: krPour1 560ms cubic-bezier(0.22, 1, 0.36, 1) 680ms forwards; }

        /* Last dot: delayed “툭” */
        .kr-dot9 { animation: krLast 460ms cubic-bezier(0.22, 1, 0.36, 1) 820ms forwards; }

        @keyframes krBowlIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes krPour1 {
          0%   { opacity: 0; transform: translate(0px, -62px) rotate(-2deg) scale(0.98); }
          35%  { opacity: 1; }
          82%  { transform: translate(-3px, 1px) rotate(1deg) scale(1.01); }
          100% { opacity: 1; transform: translate(0px, 0px) rotate(0deg) scale(1); }
        }

        @keyframes krPour2 {
          0%   { opacity: 0; transform: translate(0px, -58px) rotate(2deg) scale(0.98); }
          35%  { opacity: 1; }
          82%  { transform: translate(2px, 2px) rotate(-1deg) scale(1.01); }
          100% { opacity: 1; transform: translate(0px, 0px) rotate(0deg) scale(1); }
        }

        @keyframes krPour3 {
          0%   { opacity: 0; transform: translate(0px, -60px) rotate(-1deg) scale(0.98); }
          35%  { opacity: 1; }
          82%  { transform: translate(-1px, 1px) rotate(1deg) scale(1.01); }
          100% { opacity: 1; transform: translate(0px, 0px) rotate(0deg) scale(1); }
        }

        @keyframes krPour4 {
          0%   { opacity: 0; transform: translate(0px, -56px) rotate(1deg) scale(0.98); }
          35%  { opacity: 1; }
          82%  { transform: translate(3px, 2px) rotate(-1deg) scale(1.01); }
          100% { opacity: 1; transform: translate(0px, 0px) rotate(0deg) scale(1); }
        }

        @keyframes krLast {
          0%   { opacity: 0; transform: translate(0px, -78px) rotate(2deg) scale(0.98); }
          30%  { opacity: 1; }
          86%  { transform: translate(1px, 4px) rotate(-1deg) scale(1.015); }
          100% { opacity: 1; transform: translate(0px, 0px) rotate(0deg) scale(1); }
        }

        /* Page container fade */
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kr-bowl, .kr-dot {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function blobPath(cx: number, cy: number, rx: number, ry: number) {
  const k = 0.28;
  const ox = rx * k;
  const oy = ry * k;

  const x0 = cx - rx, x1 = cx - rx, x2 = cx - ox, x3 = cx;
  const x4 = cx + ox, x5 = cx + rx, x6 = cx + rx;

  const y0 = cy, y1 = cy - ry, y2 = cy - ry, y3 = cy - oy;
  const y4 = cy + oy, y5 = cy + ry, y6 = cy + ry;

  return `
    M ${x3} ${y1}
    C ${x4} ${y2} ${x5} ${y3} ${x6} ${y0}
    C ${x5} ${y4} ${x4} ${y5} ${x3} ${y6}
    C ${x2} ${y5} ${x1} ${y4} ${x0} ${y0}
    C ${x1} ${y3} ${x2} ${y2} ${x3} ${y1}
    Z
  `;
}