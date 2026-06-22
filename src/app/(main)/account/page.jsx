import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Account",
  description: "Holonet authorisation and clearance."
});

export default function AccountPage() {
  return (
    <HolonetFrame title="ACCOUNT" subtitle="ACCOUNT AUTHORIZATION">
      <div className="account-panel">
        <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", letterSpacing: "0.1em", lineHeight: 1.6 }}>
          Link your Roblox account to this browser session.
          This connection acts as your clearance pass.
        </p>

        <div className="terminal-box">
          <div className="data-row">
            <span className="data-label">Account Status:</span>
            <span className="data-value unbound" id="auth-status">UNBOUND</span>
          </div>
          <div className="data-row">
            <span className="data-label">Account Name:</span>
            <span className="data-value unbound" id="roblox-user">NULL</span>
          </div>
          <div className="data-row">
            <span className="data-label">Roblox UID:</span>
            <span className="data-value unbound" id="roblox-id">NULL</span>
          </div>
        </div>

        <button className="btn-auth" id="bind-btn">LOG IN</button>
        <div className="discord-link-box" id="discord-link-box" hidden>
          <p id="discord-link-status">Discord verification link detected.</p>
          <button className="btn-auth" id="discord-link-btn">LINK DISCORD</button>
        </div>
      </div>

      <style>{`
        .account-panel {
          background:
            radial-gradient(ellipse 92% 84% at 50% 112%, rgba(155, 0, 24, 0.2), transparent 63%),
            linear-gradient(145deg, rgba(41, 0, 8, 0.42) 0%, rgba(15, 2, 8, 0.98) 46%, rgba(4, 3, 4, 1) 100%);
          border: 1px solid var(--border-hot);
          box-shadow: 0 0 40px rgba(192, 0, 26, 0.08);
          padding: 40px;
          position: relative;
          overflow: hidden;
          max-width: 600px;
          margin: 0 auto;
          text-align: center;
        }

        .account-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 80% at 50% -20%, rgba(192, 0, 26, 0.1) 0%, transparent 60%);
          pointer-events: none;
        }

        .terminal-box {
          background: var(--panel);
          border: 1px solid var(--border-hot);
          padding: 20px;
          margin: 30px 0;
          font-family: 'Share Tech Mono', monospace;
          text-align: left;
        }

        .data-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 0.8rem;
          border-bottom: 1px dashed var(--border);
          padding-bottom: 4px;
        }

        .data-label {
          color: var(--text-faint);
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .data-value {
          color: var(--red-bright);
          text-shadow: 0 0 8px var(--red-glow);
        }

        .data-value.unbound {
          color: var(--text-dim);
          text-shadow: none;
        }

        .btn-auth {
          display: inline-block;
          background: transparent;
          color: var(--red-bright);
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          padding: 16px 32px;
          border: 1px solid var(--red-dim);
          cursor: crosshair;
          position: relative;
          transition: all 0.3s;
          text-decoration: none;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
        }

        .btn-auth:hover {
          background: rgba(192, 0, 26, 0.1);
          border-color: var(--red-bright);
          box-shadow: inset 0 0 20px var(--red-glow), 0 0 20px var(--red-glow);
          text-shadow: 0 0 10px var(--red-bright);
        }

        .discord-link-box {
          margin-top: 24px;
          border-top: 1px solid var(--border);
          padding-top: 22px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          color: var(--text-dim);
        }

        .discord-link-box .btn-auth {
          margin-top: 10px;
          font-size: 0.68rem;
          padding: 12px 20px;
        }

        @media (min-width: 1600px) {
          .account-panel {
            max-width: min(82vw, 860px);
            padding: 64px;
          }

          .terminal-box {
            margin: 44px 0;
            padding: 30px;
          }

          .data-row {
            font-size: 1rem;
          }

          .btn-auth {
            font-size: 0.98rem;
            padding: 20px 48px;
          }

          .account-panel > p {
            font-size: 0.86rem !important;
            max-width: 62ch;
            margin-left: auto;
            margin-right: auto;
          }
        }
      `}</style>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/modules/client/account.js"]} />
    </HolonetFrame>
  );
}
