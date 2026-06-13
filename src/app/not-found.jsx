import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "var(--theme-bg, #050606)",
      color: "var(--text, #e8d8d2)",
      fontFamily: "'Share Tech Mono', monospace",
      padding: "24px",
      textAlign: "center"
    }}>
      <div style={{ maxWidth: 680 }}>
        <p style={{ letterSpacing: "0.3em", color: "var(--theme-accent, #ff3b4f)" }}>RESOURCE UNKNOWN</p>
        <h1 style={{ fontFamily: "'Orbitron', sans-serif", margin: "16px 0", letterSpacing: "0.18em" }}>NODE NOT FOUND</h1>
        <p style={{ color: "var(--text-dim, #b99591)" }}>The requested Holonet resource is unavailable or has not been provisioned.</p>
        <div style={{ marginTop: 28 }}>
          <Link href="/" style={{ color: "var(--theme-accent, #ff3b4f)", textDecoration: "none", border: "1px solid currentColor", padding: "12px 22px", display: "inline-block" }}>
            RETURN HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
