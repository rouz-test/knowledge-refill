"use client";

import React from "react";

export type DocTab = "service" | "privacy" | "terms";

export function ServiceDocModal(props: {
  open: boolean;
  tab: DocTab;
  onClose: () => void;
}) {
  const { open, tab, onClose } = props;
  if (!open) return null;

  const title =
    tab === "privacy" ? "개인정보 처리방침" : tab === "terms" ? "이용약관" : "서비스 정보";

  const body =
    tab === "privacy"
      ? [
          "지식조각은 서비스 제공을 위해 필요한 최소한의 정보만을 처리합니다.",
          "",
          "서비스 이용 과정에서 다음과 같은 정보가 처리될 수 있습니다.",
          "",
          "• 출생연도: 콘텐츠 코호트 제공을 위해 사용되며, 기기 내에만 저장됩니다.",
          "• 콘텐츠 읽음 여부: 이용 경험 개선을 위해 기기 내에 저장됩니다.",
          "",
          "지식조각은 회원가입 기능을 제공하지 않으며,",
          "이용자를 직접 식별할 수 있는 개인정보를 수집하지 않습니다.",
          "",
          "콘텐츠 제공 및 서비스 운영을 위해 Firebase를 사용하며,",
          "이 과정에서 서버에 최소한의 비식별 정보가 처리될 수 있습니다.",
          "",
          "운영자는 개인정보 보호 관련 법령을 준수하며,",
          "관련 문의는 서비스 정보에 기재된 이메일을 통해 접수할 수 있습니다.",
        ]
      : tab === "terms"
      ? [
          "지식조각은 개인이 운영하는 지식 콘텐츠 제공 서비스입니다.",
          "",
          "본 서비스에서 제공되는 모든 콘텐츠는 정보 제공을 목적으로 하며,",
          "특정한 전문적 조언이나 결정을 대체하지 않습니다.",
          "",
          "이용자는 본 서비스를 통해 얻은 정보를 이용함에 있어",
          "스스로의 판단과 책임 하에 활용해야 합니다.",
          "",
          "운영자는 서비스의 정확성, 완전성, 최신성을 유지하기 위해 노력하나,",
          "콘텐츠의 오류나 누락으로 인해 발생한 손해에 대해 책임을 지지 않습니다.",
          "",
          "서비스는 사전 고지 없이 일부 또는 전부가 변경, 중단될 수 있습니다.",
        ]
      : [
          "지식조각",
          "",
          "매일 한 조각씩, 생각을 업데이트합니다.",
          "",
          "운영자: rouz",
          "문의: rouz@mail.com",
          "",
          "© 2026 rouz. All rights reserved.",
        ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="문서 닫기"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[520px] rounded-2xl border border-purple-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/90 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5"
      >
        <div className="flex items-center justify-between">
          <div className="font-bold text-white">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-200/90 hover:text-white hover:bg-white/10"
            aria-label="닫기"
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-purple-800/25 bg-slate-950/20 p-4">
          <div className="space-y-2 text-[13px] leading-6 text-slate-100 whitespace-pre-wrap">
            {body.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-purple-500/30 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
