export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7f7f9",
        padding: "60px 20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          padding: "48px 40px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          lineHeight: 1.8,
          color: "#222",
        }}
      >
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>
          개인정보처리방침
        </h1>
        <p style={{ fontSize: "15px", color: "#666", marginBottom: "32px" }}>
          지식조각은 이용자의 개인정보를 소중하게 생각하며, 관련 법령을 준수합니다.
          본 방침은 서비스 이용 과정에서 처리되는 정보의 범위와 목적을 안내하기
          위해 작성되었습니다.
        </p>

        <SectionTitle number="1" title="수집 및 처리하는 정보" />
        <ul style={{ paddingLeft: "20px", marginBottom: "28px" }}>
          <li>
            <strong>출생년도</strong>: 콘텐츠 추천 기능 제공을 위해 사용되며,
            사용자의 기기 내부에만 저장됩니다.
          </li>
          <li>
            <strong>콘텐츠 읽음 여부</strong>: 이용 경험 개선을 위해 기기 내부에
            저장됩니다.
          </li>
        </ul>

        <SectionTitle number="2" title="외부 서비스 사용" />
        <p style={{ marginBottom: "28px" }}>
          본 서비스는 운영 및 안정성 확보를 위해 <strong>Google Firebase</strong>
          를 사용합니다. 이 과정에서 기기 정보 및 앱 사용 정보 등
          비식별 정보가 처리될 수 있습니다.
        </p>

        <SectionTitle number="3" title="광고 (해당 시)" />
        <p style={{ marginBottom: "28px" }}>
          본 서비스는 <strong>Google AdMob</strong>을 통한 광고를 포함할 수
          있습니다. 광고 제공 과정에서 광고 식별자가 사용될 수 있습니다.
        </p>

        <SectionTitle number="4" title="개인정보 보관 및 파기" />
        <p style={{ marginBottom: "28px" }}>
          모든 정보는 사용자의 기기 내에 저장되며, 앱 삭제 시 함께
          제거됩니다.
        </p>

        <SectionTitle number="5" title="이용자의 권리" />
        <p style={{ marginBottom: "28px" }}>
          사용자는 언제든지 앱을 삭제함으로써 정보 저장을 중단할 수
          있습니다.
        </p>

        <SectionTitle number="6" title="문의" />
        <p style={{ marginBottom: "8px" }}>
          개인정보 관련 문의는 아래 이메일로 연락해주시기 바랍니다.
        </p>
        <p style={{ fontWeight: 500, marginBottom: "32px" }}>
          이메일: rouz@mail.com
        </p>

        <hr style={{ border: "none", borderTop: "1px solid #eee" }} />
        <p
          style={{
            marginTop: "20px",
            fontSize: "13px",
            color: "#999",
            textAlign: "right",
          }}
        >
          시행일: 2026년 2월 13일
        </p>
      </div>
    </main>
  );
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <h2
      style={{
        fontSize: "18px",
        marginBottom: "12px",
        marginTop: "36px",
      }}
    >
      {number}. {title}
    </h2>
  );
}