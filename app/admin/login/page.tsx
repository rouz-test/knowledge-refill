"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={<div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>불러오는 중…</div>}
    >
      <AdminLoginInner />
    </Suspense>
  );
}

function AdminLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("로그인 중...");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setStatus(res.status === 401 ? "비밀번호가 올바르지 않습니다." : "로그인에 실패했습니다.");
        return;
      }

      setStatus("로그인 완료 ✅");
      router.replace(next);
    } catch (e: any) {
      setStatus(e?.message ?? "로그인 중 오류가 발생했습니다.");
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>관리자 로그인</h1>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
        내부 관리자 페이지 보호용 로그인입니다.
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="관리자 비밀번호"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />
        <button
          type="submit"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #222",
            background: "#222",
            color: "#fff",
          }}
        >
          로그인
        </button>

        {status ? <div style={{ fontSize: 13, opacity: 0.85 }}>{status}</div> : null}
      </form>
    </main>
  );
}