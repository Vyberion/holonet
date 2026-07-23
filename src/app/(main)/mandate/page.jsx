import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { InteractiveMandate } from "./InteractiveMandate.jsx";
import { SpotifyEmbed } from "../../../components/SpotifyEmbed.jsx";
import "./v2.css";

import { EndorsementsSection } from "./EndorsementsSection.jsx";

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
      <InteractiveMandate
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
              <div className="v2-text-content">
                <p className="v2-greeting animate-on-scroll stagger-2">To the Lords and Aspirants of the Sith Order:</p>
                <p className="animate-on-scroll stagger-3">For too long, the Order has lacked direction and has been weakened as a result. We have bickered over the remnants of what little we have while it has drifted away from the principles that once made it what it was.</p>
                <p className="animate-on-scroll stagger-4">The Order has grown stagnant relative to its past, bloated by those who mistake pettiness with one another for strength; a succession of leaders has lacked the will and foresight required to return it to its former glory and our passion has been allowed to erode. Time has dulled its edge and complacency has been allowed to spread from corner to corner. This must end.</p>
                <p className="animate-on-scroll stagger-5">Today, I proclaim the beginning of my third campaign in total, for a second term on the throne. I have returned with a clear objective: to restore the Sith Order and, when that has been done, prepare it for the future. My priority will be to reinforce the identity of the Order as a living institution, not one that is sidelined by the trivialisation of its traditions and laws.</p>
                <p className="animate-on-scroll stagger-6">Before any more has been written, I must state that I have grown to disdain applications that blindly promise hard changes, like political manifestos in which half the promises are unkept. This is by no means a dismissal of my own vision or capabilities, nor that of any other candidate. No one can predict the future of the Order, nor should its future depend upon a single person's brainstorming.</p>
                <p className="animate-on-scroll stagger-7">Therefore, this mandate is a declaration of the principles and ideals that will guide the throne under my reign. Again, I understand there may be a lot of ambiguity in my wording and even in my explicit directives, this is intentional. I will not chain myself to any one path.</p>
              </div>
            </section>

            <section className="v2-page v2-intent animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>IDEOLOGY</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-3">
                <div className="v2-pillars">
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> PILLARS OF INTENT
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-1">
                    <h4>PILLAR OF PURPOSE</h4>
                    <p>Our actions must not exist for their own sake. This Order demands purpose, and I will personally drive the effort to discover the most effective ways to make it relevant once again. Furthermore, I wish for it to be an environment where members arare proud of what they are apart of, not one that is ridiculed by its own members.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-2">
                    <h4>PILLAR OF RECRUITMENT</h4>
                    <p>I will pursue all pathways to save the Order from stagnation. With the lack of internal opportunities, we must look outward to grow. This includes, and primarily stems from, integration with the potential upcoming Battlegrounds game to secure a steady influx of new Aspirants.</p>
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
                    <h4>PILLAR OF UNITY</h4>
                    <p>Splinter groups that operate against the best interests of the Order will not be tolerated. External allegiances may of course exist, but those who actively divide the Order and its members should be strictly outlawed.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-6">
                    <h4>PILLAR OF DOCTRINE</h4>
                    <p>The Sith Order is not an army, and we will stop operating under the delusion that we are soldiers. While the Order consists of soldiers and warriors, we are an esoteric order and our focus will return to such. The militaristic mindset that has dominated the Order must be shed.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-7">
                    <h4>PILLAR OF ARCHIVAL</h4>
                    <p>We have lost too much of our history. It is my priority to make sure no more of it is lost, and preserve as much as we can from here on out. Moving forward, the documentation of our lore and history will be preserved.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-8">
                    <h4>PILLAR OF CANON</h4>
                    <p>I intend on laying the groundwork to establish a formal Group Canon that provides a solid baseline for continued roleplay. Every member should be able to take part in a coherent setting. In conjunction with and as an integral part of the Order's history, the canon would be preserved.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="v2-page v2-mandate-actions animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>DIRECTIVES</h3>
              </div>
              <div className="v2-text-content animate-on-scroll stagger-2">

                <div className="v2-pillars">
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> ACTS
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-3">
                    <h4>THE POWERBASE ACT</h4>
                    <p>I seek to refine the Powerbase system to dismantle informal friend group politics that currently dictate standing. I look to ensure an actively used, useful framework that protects these principles. Influence must not be granted by association.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-4">
                    <h4>THE KAGGATH ACT</h4>
                    <p>I intend to explore adjustments to the Kaggath system. The goal is to revise the current framework so that it serves as a meaningful instrument of interpersonal rivalry rather than a flat, empty, rarely used means to ascend the ranks.</p>
                  </div>
                </div>

                <div className="v2-pillars">
                  <div className="v2-pillars-header">
                    <span className="triangle-icon">▸</span> DECREES
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-5">
                    <h4>THE ARCHIVAL DECREE</h4>
                    <p>Starting from day one, lore will be consolidated. I intend on establishing a definitive Canon to provide a unified lore timeline for the Order.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-6">
                    <h4>THE NARRATION DECREE</h4>
                    <p>The framing of the Order as a boot camp must end. I will immediately review all areas of the Order to ensure we align with our true principles.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-7">
                    <h4>THE COUNCIL DECREE</h4>
                    <p>While I dont intend on returning weekly useless meetings, I don't intend on having none at all. When deemed necesasry, updates on the direction of the Throne will be published. However it is important to clarify that transparency is not a virtue we intrinsically uphold.</p>
                  </div>
                  <div className="v2-pillar animate-on-scroll stagger-8">
                    <h4>THE ALIGNMENT DECREE</h4>
                    <p>Let me be clear: I will not make unsanctioned and wildly unpopular changes. Necessary changes may be made, but I will do my best to measure them against the best interests of the Order.</p>
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

              <div className="v2-text-content">
                <p className="animate-on-scroll stagger-4">I have witnessed, while not majorly notable, the evolution of our systems, and the larger challenges that face the group. I have gained an understanding of both the strengths that must be protected and the weaknesses that must be addressed.</p>

                <p className="animate-on-scroll stagger-5">I have seen how ambition can be lost through the poor direction of those who wield it. I have seen how systems can become detached from their purpose. I have seen how temporary fixes often fail to deal with the deeper issues. I have seen what this Order needs. These lessons learned form the basis of my vision and so I approach this position with a deeply rooted understanding of what it takes.</p>

                <div className="v2-record-section animate-on-scroll stagger-5">
                  <div className="v2-pillars-header">
                    CURRENT OCCUPATION
                  </div>
                  <p className="animate-on-scroll stagger-1">
                    My current rank is Reaver Lord. I joined the Reavers shortly before my exams, which required me to take an inactivity notice. Upon my return, I immediately jumped back into attending events and improving my combat. I attended Manar's promotion tournament and won it, earning my ascension to Senior Reaver, and doing so, showing that combat is still held to high regards in my division. Since then, I have ascended further to Reaver Lord, where I continue to host events and work to continuously elevate the division's standards. While I have yet to induct any new aspirants, I am closely watching several prospects who have shown a willingness to improve and earn a place in the division.
                  </p>
                </div>

                <p className="animate-on-scroll stagger-7">With the same sentiment as my last application, I am not one for boasting on and on about personal achievements, nor diminishing the accolades of my rivals during this period. However, I will state a few of my achievements as to not fall flat.</p>

                <div className="v2-pillars animate-on-scroll stagger-5">
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

            <EndorsementsSection />

            <section className="v2-page v2-ultimatum animate-on-scroll">
              <div className="v2-header-bar animate-on-scroll stagger-1">
                <div className="v2-header-accent"></div>
                <h3>ULTIMATUM</h3>
              </div>
              <div className="v2-text-content">
                <p className="animate-on-scroll stagger-2">The Sith Order shall be more than just a shadow of its former self. To deny such a thing is to wallow in its failures.</p>
                <p className="animate-on-scroll stagger-3">We cannot cling to the status quo. If nothing changes, neither will the Order. It requires a willingness to adapt and pursue a vision for what it can become. Given this responsibility again, I intend to dedicate my whole term and beyond to restoring purpose and making ambition meaningful and a central part of our identity again.</p>
                <p className="animate-on-scroll stagger-4">The legacy of our great Order should be judged by what we achieve next, not by our past from eons ago. I have recently spoken with the Supreme Lord Reagant Group Dictator Ancient One Senior Advisor Manar_Aktuun regarding his views on the future of our group and whether our visions are compatible. Honestly, given my history, I was surprised to find that they are. Therefore, the question is no longer whether we share the same mindset, but how we begin working on it. I accept any burden willingly. </p>
                <p className="v2-italic animate-on-scroll stagger-5">Only the strong shall inherit the stars. By my hand and authority, with mind and will:</p>
                <div className="v2-signature animate-on-scroll stagger-6">Vyberon<br /></div>
                <div className="animate-on-scroll stagger-7">
                  <SpotifyEmbed uri="spotify:track:48v2zlOv10W8F4RWg7eWy1" />
                </div>
              </div>
            </section>
          </div>
        }
      />

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
