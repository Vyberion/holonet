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
    >
      <div className="v2-bg"></div>
      <InteractiveMandate
        videoPlaybackId="yy4W01x02TPhZcppBYZmL552Xd02WzyOF8g2OqZFJf00bYE"
        hero={
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
        }
        content={
          <div className="v2-content-wrapper">
            <section className="v2-page v2-proclamation animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>PROCLAMATION</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-2">
                <p className="v2-greeting">To the Lords and Aspirants of the Sith Order:</p>
                <p>For too long, the Order has lacked direction and been weakened. We have bickered over the remnants of what little we have while the Order has drifted away from the principles that once made it what it was.</p>
                <p>The Order has grown stagnant, it has been utterly bloated by those who mistake pettiness with one another for what we were meant to become; a succession of leaders have lacked the will required to return it to its former glory and your passion has been allowed to erode. Time has dulled its edge and complacency has been allowed to spread corner to corner. This must end.</p>
                <p>I proclaim that my second campaign begins today. I am returning with a clear intent. I want to restore the Order to its original glory. I want to bring it into the future. Oftentimes, the future of the Sith has been diluted by overly specific misdirected decrees from day one. Changes are often introduced without true consultation with other aspects of the group, patchy and isolated from the issues that they are meant to fix. Hence, this mandate does not contain a list of strict promises, because I believe the path forward is more than one document and must adapt to whatever challenges we come across as we face them.</p>

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
                  <div className="v2-pillar animate-on-scroll stagger-1">
                    <h4>PILLAR OF PURPOSE</h4>
                    <p>Our actions should not exist for their own sake. This Order requires purpose, and so I will personally look for the best ways possible to make sure it becomes relevant once again.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>PILLAR OF RECRUITMENT</h4>
                    <p>We will explore all pathways to save the Order from stagnation. This includes integration with the potential upcoming Battlegrounds game to secure a steady influx of new Aspirants.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-3">
                    <h4>PILLAR OF PROGRESSION</h4>
                    <p>The current systems for events and rank progression will be subject to revision. We must ensure that participation is meaningful, but more than simply function over form.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-4">
                    <h4>PILLAR OF CANON</h4>
                    <p>We will explore establishing a formal Group Canon that provides a solid baseline for continued roleplay. Every member should be able to take part in a coherent setting.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-5">
                    <h4>PILLAR OF RIVALRY</h4>
                    <p>Petty infighting is a waste of time. Internal rivalry must serve a purpose, and so we will foster meaningful competition. Destructive conflict threatens the Order and will be treated as treason.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-6">
                    <h4>PILLAR OF UNITY</h4>
                    <p>Splinter groups that operate against the best interests of the Order will not be tolerated. External allegiances may of course exist, but those who actively divide the Order and our members will be strictly prohibited at first sight.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-7">
                    <h4>PILLAR OF ARCHIVAL</h4>
                    <p>We have lost too much of our history. It is my priority to make sure no more of it is lost, and preserve as much as we can from here on out. Moving forward, the documentation of our lore and history will be preserved.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-8">
                    <h4>PILLAR OF DOCTRINE</h4>
                    <p>The Sith Order is not an army, and we will stop operating under the delusion that we are soldiers. We are a religious order, and our focus will return to such, and so we will stop lying with the militaristic and bureaucratic mindset that has infected the Order.</p>
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

              <div className="v2-text-content animate-on-scroll stagger-4">
                <p>My experience within the Order has given me a perspective. I have witnessed, while albeit overall minor, the evolution of our systems and the larger challenges that face the group. I have gained an understanding of both the strengths that must be protected and the weaknesses that must be addressed.</p>

                <p>I have seen how ambition can be lost through the poor direction of those who wield it. I have seen how systems can become detached from their purpose. I have seen how temporary fixes often fail to deal with the deeper issues. I have seen what this Order needs. These lessons learned form the base of my vision and so I approach this position with a deeply rooted understanding of what it takes.</p>

                <p style={{ marginTop: '40px' }}>With the same sentiment as my last application: I am not one for going on and on about personal achievements nor diminishing the accolades of my rivals during this period. However, I will state a few of my achievements as to not fall flat.</p>

                <div className="v2-pillars animate-on-scroll stagger-5" style={{ marginTop: '40px' }}>
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> ACHIEVEMENTS
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-1">
                    <h4>THE HOLONET</h4>
                    <p>I have recently released the very Holonet this page is apart of, as I wanted to begin the transition to a truly centralised database area with a better logging and member management system. It wasn't necessary from a frontend perspective, but I believe even the standards of our documents should should always be improved. I vehemently reject the statement: "Why fix what isn't broken?" Instead, I say: "Why not improve what isn't perfect?"</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>PAST DATABASES</h4>
                    <p>I created the last 2 sites used prior, first the Notion and then later the Google Site that first bore the domain this page uses, used for a combined total of more than 3 years.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-3">
                    <h4>COMBAT PROFICIENCY</h4>
                    <p>Albeit seemingly a moot point these days, I am decently proficient in combat. I believe the Emperor should be a steward to all values of the Order, prowess in combat duly included.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-4">
                    <h4>HIGH COMMAND</h4>
                    <p>I have served in this position before. While not a perfect reign by any means, my four months on the Throne and nine months as High Command (one of which was spent as the High Command Reaver Overseer rather than the Head of Divisions) boosted my experience first-hand required for the role.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-5">
                    <h4>CENTRALIZED DOCUMENTS</h4>
                    <p>They may have since changed, but I was responsible for the first generally long-lasting, centralized documents during my second term as Wrath. This was understandably superceded, but I will always make an effort to push for a consistent quality and raise the standards of the Order. Small improvements are always still improvements.</p>
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
                <p>The Sith Order shall be more than just a shadow of its former self. To deny such a thing is to wallow in its failures.</p>
                <p>We cannot cling to the status quo. If nothing changes, neither will it. It requires a willingness to adapt and pursue a vision for what it can become. Given this responsibility again, I intend to dedicate my whole term to restoring purpose and making ambition meaningful and a central part of our identity again.</p>
                <p>The legacy of our great Order should be judged by what it achieves next, not by its past from Eras ago. I have spoken with the Supreme Lord Reagant Group Dictator Ancient One Senior Advisor Manar_Aktuun regarding his views on the future of our group and whether our visions are compatible. Given my history, I honestly did not expect these to align as closely as they did. Nevertheless, the question is no longer whether we share the same vision, it is how we begin to move forward. We can reclaim the Sith Order.</p>
                <p className="v2-italic animate-on-scroll stagger-3">Only the strong shall inherit the stars. By my Authority and Hand, in Mind and Will:</p>
                <div className="v2-signature animate-on-scroll stagger-4">Vyberon<br /></div>
                <iframe data-testid="embed-iframe" style={{ borderRadius: "12px" }} src="https://open.spotify.com/embed/track/48v2zlOv10W8F4RWg7eWy1?utm_source=generator&theme=0&si=d317b391208240f2" width="100%" height="352" frameBorder="0" allowFullScreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
              </div>
            </section>
          </div>
        }
      />

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
