import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { InteractiveDocument } from "../../../components/InteractiveDocument/InteractiveDocument.jsx";
import { SpotifyEmbed } from "../../../components/SpotifyEmbed.jsx";
import "../../../components/InteractiveDocument/document-v2.css";

export const metadata = holonetMetadata({
  title: "Emperor's Wrath Application",
  description: "Only the strong shall inherit the stars."
});

export default function WrathApplicationPage() {
  return (
    <HolonetFrame
      title="Application"
      subtitle="Emperor's Wrath"
      showHeader={false}
      showStatusBar={false}
      showNav={false}
      mainClassName="mandate-v2-main"
      includeSearchOverlay={false}
    >
      <div className="v2-wrath-bg"></div>
      <InteractiveDocument
        audioSrc="/assets/music/galaxy/calm.mp3"
        hero={
          <section className="v2-hero">
            <div className="hero-content">
              <h2 className="v2-subheading">[YOUR NAME]'S</h2>
              <h1 className="v2-title" style={{ fontSize: "clamp(3rem, 10vw, 8rem)" }}>WRATH APP</h1>
              <div className="v2-divider">
                <span className="diamond"></span>
                <span className="line"></span>
                <span className="diamond-large"></span>
                <span className="line"></span>
                <span className="diamond"></span>
              </div>
              <p className="v2-subtitle">AN APPLICATION<br />FOR THE POWERBASE</p>
              <div className="v2-divider">
                <span className="diamond"></span>
                <span className="line"></span>
                <span className="diamond-large"></span>
                <span className="line"></span>
                <span className="diamond"></span>
              </div>
              <div className="v2-quote-box splash-fade-in delay-1">
                <p>[Your personal quote or slogan here]</p>
              </div>
            </div>
          </section>
        }
        content={
          <div className="v2-content-wrapper">
            <section className="v2-page v2-proclamation animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>INTRODUCTION</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-2">
                <p className="v2-greeting">To the Lords and Aspirants of the Sith Order:</p>
                <p>[Write your opening statement here. Explain why you are applying and what you bring to the table.]</p>
                <p>[Provide any additional context or background for your application.]</p>
                <p>[Outline the general philosophy of your prospective tenure.]</p>
              </div>
            </section>

            <section className="v2-page v2-intent animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>INTENT</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-2">
                <div className="v2-pillars animate-on-scroll stagger-3">
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> PILLARS OF INTENT
                  </div>

                  {/* You can duplicate or remove these pillars as needed */}
                  <div className="v2-pillar animate-on-scroll stagger-1">
                    <h4>PILLAR ONE</h4>
                    <p>[Description of your first core pillar or priority.]</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>PILLAR TWO</h4>
                    <p>[Description of your second core pillar or priority.]</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-3">
                    <h4>PILLAR THREE</h4>
                    <p>[Description of your third core pillar or priority.]</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-4">
                    <h4>PILLAR FOUR</h4>
                    <p>[Description of your fourth core pillar or priority.]</p>
                  </div>

                </div>
              </div>
            </section>

            <section className="v2-page v2-record animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>RECORD</h3>
              </div>
              <div className="v2-induction animate-on-scroll stagger-2">INDUCTION // <span className="white-text">[Date]</span></div>

              <div className="v2-text-content animate-on-scroll stagger-4">
                <p>[Detail your past experience and qualifications.]</p>

                <div className="v2-pillars animate-on-scroll stagger-5" style={{ marginTop: '40px' }}>
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> ACHIEVEMENTS
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-1">
                    <h4>ACHIEVEMENT 1</h4>
                    <p>[Description of your achievement]</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>ACHIEVEMENT 2</h4>
                    <p>[Description of your achievement]</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="v2-page v2-ultimatum animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>CONCLUSION</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-2">
                <p>[Your closing statement and final pitch to the readers.]</p>
                <p className="v2-italic animate-on-scroll stagger-3">[Your concluding sign-off phrase]:</p>
                <div className="v2-signature animate-on-scroll stagger-4">[Your Name]<br /></div>

                {/* Optional Spotify Embed */}
                <SpotifyEmbed uri="spotify:track:48v2zlOv10W8F4RWg7eWy1" />
              </div>
            </section>
          </div>
        }
      />

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
