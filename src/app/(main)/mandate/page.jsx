import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { InteractiveMandate } from "./InteractiveMandate.jsx";
import "./v2.css";

export const metadata = holonetMetadata({
  title: "The Mandate",
  description: "Only the strong shall inherit the stars."
});

export default function MandateV2Page() {
  return (
    <HolonetFrame
      title="The Mandate"
      subtitle="The New Era"
      showHeader={false}
      showStatusBar={false}
      showNav={false}
      mainClassName="mandate-v2-main"
      includeSearchOverlay={false}
      releaseIntro={{
        enabled: true,
        force: true,
        video: {
          playbackId: "8TMIBxxLXd5BKfnDq3nU6xki2lvlXaJ9I00xrNkZ9k3k"
        }
      }}
    >
      <InteractiveMandate
        hero={
          <>
            <div className="v2-bg"></div>
            <section className="v2-hero">
              <div className="hero-content">
              <h2 className="v2-subheading">VYBERON'S</h2>
              <h1 className="v2-title">MANDATE</h1>
              <div className="v2-divider">
                <span className="diamond"></span>
                <span className="line"></span>
                <span className="diamond-large"></span>
                <span className="line"></span>
                <span className="diamond"></span>
              </div>
              <p className="v2-subtitle">A LETTER<br />TO THE ORDER</p>
              <div className="v2-divider">
                <span className="diamond"></span>
                <span className="line"></span>
                <span className="diamond-large"></span>
                <span className="line"></span>
                <span className="diamond"></span>
              </div>
              <div className="v2-quote-box splash-fade-in delay-1">
                <p>Only the strong shall inherit the stars</p>
              </div>
            </div>
          </section>
          </>
        }
        content={
          <div className="v2-content-wrapper">
            <section className="v2-page v2-proclamation animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>PROCLAMATION</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-2">
                <p className="v2-greeting">The Lords and Aspirants of the Sith Order:</p>
                <p>For too long, our potential has been squandered. We have bickered over scraps of what little we have while the Order has drifted away from the principles that once made it what it was.</p>
                <p>The Order has grown stagnant, weighed down by those who mistake pettiness for strength; time and succession have dulled its edge. Your passion has been eroded by a succession of leaders who lacked the vision and resolve required to lead the Order effectively. Under their stewardship, complacency became acceptable and mediocrity was allowed to take root. This must end.</p>
                <p>I proclaim the commencement of my second mandate. I do not return simply to preside over an institution diminished by years of stagnation. I return with a clear purpose, that which will restore the Order to its principles, rebuild its foundations and bring it into the future. Under my reclaimed throne:</p>

                <div className="v2-pillars animate-on-scroll stagger-3">
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> PILLARS OF INTENT
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-1">
                    <h4>PILLAR OF THE DOCTRINE</h4>
                    <p>The Sith Order is not an army, and we will stop operating under the delusion that we are soldiers. We will discard the militaristic vocabulary and bureaucratic thinking that has infected the Order. We are an esoteric religious order, and our focus will return to such.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-3">
                    <h4>PILLAR OF THE RIVALRY</h4>
                    <p>Peace is a lie. Petty conflict, however, is a waste of resources. Internal rivalry must serve a purpose, and so we will foster meaningful competition. Destructive infighting threatens the Order and will be treated as treason. Challenge your peers, but do not jeopardize the Order in doing so.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-4">
                    <h4>PILLAR OF THE ARCHIVE</h4>
                    <p>We have lost too much of our history. It is my priority to ensure no more is lost, and preserve as much as we can from here on out. Moving forward, the documentation of our lore and history will be recovered and preserved.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-5">
                    <h4>PILLAR OF THE NECESSARY</h4>
                    <p>Every action we take must serve a greater purpose. Our activities will no longer exist for their own sake. I will personally explore avenues to ensure this Order exists as a living, breathing, relevant institution once more.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>PILLAR OF THE DOMAIN</h4>
                    <p>I will not micromanage your duties. Sith and divisional leadership will be expected to govern with absolute competence. You are expected to generate your own momentum.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="v2-page v2-record animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>RECORD</h3>
              </div>
              <div className="v2-induction animate-on-scroll stagger-2">INDUCTION // <span className="white-text">March 2020</span></div>

              <div className="v2-record-section animate-on-scroll stagger-3">
                <div className="v2-pillars-header">
                  <span className="triangle-icon">▸</span> ACTIVE SERVICE
                </div>
                <div className="v2-positions-grid">
                  <div className="pos-item span-1 border-right">
                    <h5>2020</h5>
                    <p>MAR</p><p>MAY</p>
                  </div>
                  <div className="pos-item span-1 border-right">
                    <h5>2021</h5>
                    <p>AUG</p><p>SEP</p><p>OCT</p><p>NOV</p><p>DEC</p>
                  </div>
                  <div className="pos-item span-1 border-right">
                    <h5>2022</h5>
                    <p>JAN</p><p>FEB</p><p>AUG</p><p>DEC</p>
                  </div>
                  <div className="pos-item span-1 border-right">
                    <h5>2023</h5>
                    <p>JAN</p><p>FEB</p><p>MAR</p><p>APR</p><p>MAY</p><p>JUN</p><p>JUL</p><p>AUG</p><p>SEP</p><p>NOV</p><p>DEC</p>
                  </div>
                  <div className="pos-item span-1 border-right">
                    <h5>2024</h5>
                    <p>JAN</p><p>FEB</p><p>MAR</p><p>APR</p><p>JUN</p><p>JUL</p>
                  </div>
                  <div className="pos-item span-1">
                    <h5>2026</h5>
                    <p>MAY</p><p>JUN</p><p>JUL</p>
                  </div>
                </div>
              </div>

              <div className="v2-record-section animate-on-scroll stagger-4">
                <div className="v2-pillars-header">
                  <span className="triangle-icon">▸</span> POSITIONS HELD
                </div>
                <div className="v2-positions-grid">
                  <div className="pos-item border-right border-bottom">
                    <h5>EMPEROR</h5>
                    <p>APR - JUL 24</p>
                  </div>
                  <div className="pos-item border-right border-bottom">
                    <h5>HEAD OF DIVISIONS</h5>
                    <p>JUL - AUG 23</p>
                    <p>NOV - APR 23</p>
                  </div>
                  <div className="pos-item border-bottom">
                    <h5>HEAD OF INSTRUCTION</h5>
                    <p>JUN 23</p>
                  </div>
                  <div className="pos-item border-right border-bottom">
                    <h5>PURVEYOR OF TRUTH</h5>
                    <p>JUN - AUG 23</p>
                    <p>JUN - PRES. 23</p>
                  </div>
                  <div className="pos-item border-right border-bottom">
                    <h5>REAVER OVERSEER</h5>
                    <p>JUN - JUL 23</p>
                    <p>NOV 23</p>
                  </div>
                  <div className="pos-item border-bottom">
                    <h5>INSTRUCTOR</h5>
                    <p>SEP - NOV 21</p>
                    <p>DEC - FEB 22</p>
                    <p>DEC - FEB 23</p>
                  </div>
                  <div className="pos-item wide border-right">
                    <h5>THE REAVERS</h5>
                    <p>MAR - MAY 22</p>
                    <p>SEP - NOV 23</p>
                    <p>MAY 25 - PRES.</p>
                  </div>
                  <div className="pos-item wide">
                    <h5>THE INQUISITORIUS</h5>
                    <p>AUG 22</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="v2-page v2-ultimatum animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>ULTIMATUM</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-2">
                <p>The Sith Order must be more than just a monument to its own past. To do such a thing is to wallow in its failures.</p>
                <p>We cannot overcome the challenges laid before us by clinging to the status quo. They require a willingness to adapt and pursue a vision for what this Order can become. If entrusted with this position once more, I intend to dedicate my term to restoring purpose and making ambition not only meaningful, but a core tenet of the Order once more.</p>
                <p>The legacy of the Sith Order should be measured only by what it continues to accomplish. We can reclaim the Order.</p>
                <p className="v2-italic animate-on-scroll stagger-3">Only the strong shall inherit the stars.</p>
                <div className="v2-signature animate-on-scroll stagger-4">Vyberon</div>
              </div>
            </section>
          </div>
        }
      />

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
