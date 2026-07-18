import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { InteractiveMandate } from "./InteractiveMandate.jsx";
import { InteractiveDocument } from "../../../components/InteractiveDocument/InteractiveDocument.jsx";
import { SpotifyEmbed } from "../../../components/SpotifyEmbed.jsx";
import "./v2.css";
import "../../../components/InteractiveDocument/document-v2.css";

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
      showFooter={false}
      mainClassName="mandate-v2-main"
      includeSearchOverlay={false}
    >
      <div className="v2-bg"></div>
      <InteractiveMandate>
      <InteractiveDocument
        videoPlaybackId="4x1bb1pN7Lj02wApu002MIhgKCvSbWiQieAibyzFSgPkY"
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
                <p>For too long, the Order has lacked direction and has been weakened as a result. We have bickered over the remnants of what little we have while it has drifted away from the principles that once made it what it was.</p>
                <p>The Order has grown stagnant relative to its past, bloated by those who mistake pettiness with one another for strength; a succession of leaders has lacked the will and foresight required to return it to its former glory and our passion has been allowed to erode. Time has dulled its edge and complacency has been allowed to spread from corner to corner. This must end.</p>
                <p>Today, I proclaim the beginning of my third campaign in total, for a second term on the throne. I have returned with a clear objective: to restore the Sith Order and, when that has been done, prepare it for the future. My priority will be to reinforce the identity of the Order as a living institution, not one that is sidelined by the trivialisation of its traditions and laws.</p>
                <p>Before any more has been written, I must state that I have grown to disdain applications that blindly promise hard changes, like political manifestos in which half the promises are unkept. This is by no means a dismissal of my own vision or capabilities, nor that of any other candidate. No one can predict the future of the Order, nor should its future depend upon a single person's brainstorming.</p>
                <p>Therefore, this mandate is a declaration of the principles that will guide the throne under my reign.</p>
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
                    <p>Our actions should not exist for their own sake. This Order requires purpose, and so I will personally look for the best ways possible to make sure it becomes relevant once again. Furthermore, I wish for it to be a place where one can be proud to say that they are a part of, not one that is ridiculed by its own members.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>PILLAR OF RECRUITMENT</h4>
                    <p>We will explore all pathways to save the Order from stagnation. With the lack of internal opportunities, we must look outward to grow. This includes, and primarily stems from, integration with the potential upcoming Battlegrounds game to secure a steady influx of new Aspirants.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-3">
                    <h4>PILLAR OF PROGRESSION</h4>
                    <p>The current systems for events and rank progression will be subject to revision. However, no immediate or major change is expected. The Order functions as is, but a comprehensive audit of what is and what can be is by no means harmful. We must ensure that participation is meaningful, but more than simply function over form.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-4">
                    <h4>PILLAR OF RIVALRY</h4>
                    <p>Petty infighting is a waste of time. Internal rivalry must serve a purpose, and so we will foster meaningful competition. Destructive conflict threatens the Order and will be treated as treason.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-5">
                    <h4>PILLAR OF INFLUENCE</h4>
                    <p>As one of my highest priorities, we will heavily explore revising the current powerbase system to genuinely maximize the importance of building a genuine following. Power should absolutely be built and actively maintained. The Order should not be shaped by friend groups.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-6">
                    <h4>PILLAR OF UNITY</h4>
                    <p>Splinter groups that operate against the best interests of the Order will not be tolerated. External allegiances may of course exist, but those who actively divide the Order and its members should be strictly outlawed.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-7">
                    <h4>PILLAR OF DOCTRINE</h4>
                    <p>The Sith Order is not an army, and we will stop operating under the delusion that we are soldiers. While the Order consists of soldiers and warriors, we are an esoteric order and our focus will return to such. The militaristic mindset that has dominated the Order must be shed.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-8">
                    <h4>PILLAR OF ARCHIVAL</h4>
                    <p>We have lost too much of our history. It is my priority to make sure no more of it is lost, and preserve as much as we can from here on out. Moving forward, the documentation of our lore and history will be preserved.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-9">
                    <h4>PILLAR OF CANON</h4>
                    <p>We will explore establishing a formal Group Canon that provides a solid baseline for continued roleplay. Every member should be able to take part in a coherent setting. In conjunction with and as an integral part of the Order's history, the canon would be preserved.</p>
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
                    <p>NOV - APR 24</p>
                  </div>
                  <div className="pos-item border-bottom">
                    <h5>HEAD OF INSTRUCTION</h5>
                    <p>JUN 23</p>
                  </div>
                  <div className="pos-item border-right border-bottom">
                    <h5>KEEPER OF KNOWLEDGE</h5>
                    <p>JUN - AUG 23</p>
                    <p>JUN 26 - PRES</p>
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
                    <h5>REAVER</h5>
                    <p>MAR - MAY 22</p>
                    <p>SEP - NOV 23</p>
                    <p>MAY 26 - PRES</p>
                  </div>
                  <div className="pos-item wide">
                    <h5>INQUISITORIUS</h5>
                    <p>AUG 22</p>
                  </div>
                </div>
              </div>

              <div className="v2-text-content animate-on-scroll stagger-4">
                <p>I have witnessed, while not majorly notable, the evolution of our systems, and the larger challenges that face the group. I have gained an understanding of both the strengths that must be protected and the weaknesses that must be addressed.</p>

                <p>I have seen how ambition can be lost through the poor direction of those who wield it. I have seen how systems can become detached from their purpose. I have seen how temporary fixes often fail to deal with the deeper issues. I have seen what this Order needs. These lessons learned form the basis of my vision and so I approach this position with a deeply rooted understanding of what it takes.</p>

                <p style={{ marginTop: '40px' }}>With the same sentiment as my last application: I am not one for boasting on and on about personal achievements, nor diminishing the accolades of my rivals during this period. However, I will state a few of my achievements as to not fall flat.</p>

                <div className="v2-pillars animate-on-scroll stagger-5" style={{ marginTop: '40px' }}>
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> ACHIEVEMENTS
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-1">
                    <h4>THE HOLONET</h4>
                    <p>I have recently released the very Holonet this page is a part of, as I wanted to begin the transition to a truly centralised database area with a better logging and member management system. It wasn't strictly necessary from a frontend/public viewpoint, but I believe even the standards of our documents should always be improved. I vehemently reject the statement: "Why fix what isn't broken?" Instead, I say: "Why not improve what isn't perfect?"</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>PAST DATABASES</h4>
                    <p>I created the last two sites used prior, first the Notion and then later the Google Site that first bore the domain that this page uses, which served the Order for a combined total of more than 3 years.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-3">
                    <h4>COMBAT PROFICIENCY</h4>
                    <p>Albeit a seemingly moot point these days, I am proficient in combat. I believe the Emperor should be a steward to all values of the Order, prowess in combat duly included. This considered, I have exclusively been a part of the combat half of the Order for three years now. Importantly, combat does not entirely dominate my interests.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-4">
                    <h4>HIGH COMMAND</h4>
                    <p>I have served in this position before. While not a perfect reign by any means, my four months on the Throne and nine months as High Command (one of which was spent as the High Command Reaver Overseer rather than the Head of Divisions) boosted my first-hand experience in the role.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-5">
                    <h4>CENTRALISATION</h4>
                    <p>They may have since changed, but I was responsible for the first generally long-lasting, centralised documents during my second term as Wrath. This was understandably superseded, but I will always push for a consistently raised quality and with that raise the standards of our documentation and, by extension, the Order. Small improvements are always still improvements.</p>
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
                <p>We cannot cling to the status quo. If nothing changes, neither will the Order. It requires a willingness to adapt and pursue a vision for what it can become. Given this responsibility again, I intend to dedicate my whole term and beyond to restoring purpose and making ambition meaningful and a central part of our identity again.</p>
                <p>The legacy of our great Order should be judged by what we achieve next, not by our past from eons ago. I have recently spoken with the Supreme Lord Reagant Group Dictator Ancient One Senior Advisor Manar_Aktuun regarding his views on the future of our group and whether our visions are compatible. Honestly, given my history, I was surprised to find that they are. Therefore, the question is no longer whether we share the same mindset, but how we begin working on it. I accept any burden willingly. </p>
                <p className="v2-italic animate-on-scroll stagger-3">Only the strong shall inherit the stars. By my hand and authority, with mind and will:</p>
                <div className="v2-signature animate-on-scroll stagger-4">Vyberon<br /></div>
                <SpotifyEmbed uri="spotify:track:48v2zlOv10W8F4RWg7eWy1" />
              </div>
            </section>
          </div>
        }
      />
      </InteractiveMandate>

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
