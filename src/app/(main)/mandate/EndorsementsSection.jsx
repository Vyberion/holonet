"use client";

import { useState } from "react";

const ENDORSEMENTS = [
  {
    id: "thegodfr0g",
    username: "thegodfr0g",
    occupation: "Former General Malgus, Reaver Commander & High Inquisitor",
    hasLetter: true,
    content: `Back in 2023 I had the pleasure of serving alongside Owen, back when we were both Reaver Lords cutting our teeth together. It was then I could see his clear cut ability to openly communicate with fellow HRs while leading a division strong.\n\nWhen we sat together on the council, myself as Warmaster, him as Darth Baras, it gave me a front row seat to see how he thinks. Owen is a smart chap with strong ideologies, he doesn't want power for powers sake, he's got a vision for the order, and I think everyone should respect that, these visions also prove Owen's vast patience, which is a virtue not every Sith can claim.\n\nBeyond this, he's a genuinely good friend and someone I'd trust to lead the order to take over the GALAXY!!\n\nthegodfr0g, reaper of souls`
  },
  {
    id: "BarrakudaCERO",
    username: "BarrakudaCERO",
    occupation: "Darth Baras",
    hasLetter: true,
    content: `First and foremost, the candidate I consider most suitable for this rank is Vyber, based on his analysis of the situation, the way he handles divisional operations, and what I’ve been able to see whilst looking into the server,simply out of curiosity when I first met him and learnt about his career, whilst he has been under my command in the Reavers. Furthermore, and I repeat, regarding his track record, I have looked at the ideas he put forward during his time as a member of the HC, and there are several things that originated with him which are still in place today, which I think is what makes him stand out far more than the other applicants, because of the mark he has already made whilst being in those kinds of ranks`
  },
  {
    id: "JimmyTheDankLord",
    username: "JimmyTheDankLord",
    occupation: "Senior Reaver, Former Darth Nox, Darth Marr & Darth Mortis",
    hasLetter: true,
    content: `I endorse Reaver Lord Vyberon for Emperor of the Sith Order. He has previous experience in ruling the order as a former emperor. His determination and steadfast attitude within the reaver division has improved it rapidly and without failure. He is always attentive which is important as a leader and it is very clear he has great passion for his job. He is more than worthy for the throne.`
  },
  {
    id: "coldmanjar123",
    username: "coldmanjar123",
    occupation: "Senior Reaver, Former Guard Captain",
    hasLetter: true,
    content: `I think Vyberon is the most deserving of this position of emperor--Not because he was already emperor before, but also because he's proven himself to be a prominent leader figure during his tenure in Reavers.\n\nDuring my time spent in Reavers, not a lot of drama regarding Vyberon has gone down, everybody respects him due to the fact on how he earned it from the community from his serious yet fair demeanour, this allowed him to successfully bring Reavers out of the darkness and into the light. His lack of drama and controversy also allows me to trust him that he knows what he's doing, and hope for the best when he obtains the role of Emperor.\n\nFurthermore, he has experience in almost every position and knows the ins and outs of this group entirely.\n\nFor these reasons alone, I believe Vyberon should be the one to inherit this job as Emperor.`
  },
  {
    id: "SlushyArcalis",
    username: "SlushyArcalis",
    occupation: "38th Sith Emperor, Former Lord Voice & Project Manager",
    hasLetter: true,
    content: `To Whom It May Concern,\n\nIt is with great confidence that I write this letter in support of Reaver Lord Vyberon and his candidacy for Sith Emperor.\n\nHaving previously served as The Emperor's Voice during Vyberon's tenure as Emperor, I had the privilege of working closely alongside him and witnessing his leadership firsthand. This experience has given me a unique perspective on both his character and his ability to lead the Sith Order through periods of both stability and adversity.\n\nThroughout his leadership, Vyberon consistently demonstrated decisiveness without sacrificing fairness. He possesses the ability to make difficult decisions when necessary while remaining receptive to the perspectives of those around him. Rather than allowing the Order to become complacent, he has always encouraged progress and has never been afraid to challenge the status quo where he believes meaningful improvement can be achieved.\n\nWhat has always distinguished Vyberon is his innovative mindset. He understands that the long-term success of the Sith Order depends not only on preserving its traditions, but also on its willingness to evolve. While many leaders are content to maintain existing systems, Vyberon has consistently advocated for the meaningful change needed to keep the Order moving forward. His vision is driven not by change for its own sake, but by a genuine desire to strengthen the community and ensure its continued success.\n\nDuring his previous tenure as Emperor, the Order faced one of its most difficult periods, with declining activity and challenges that extended well beyond the authority of any one leader. Despite those circumstances, Vyberon remained consistently active, approachable, and committed to guiding the Order forward. Rather than allowing those difficulties to define his leadership, he continued to support his High Command, engage with the wider membership, and do everything within his ability to steer the Order through uncertain times.\n\nBeyond his strategic thinking, Vyberon is a leader capable of bringing people together. He leads with professionalism, encourages collaboration among his peers, and earns respect through his actions rather than his title. His experience as a former Emperor, combined with his commitment to continual improvement, places him in a strong position to guide the Order into its next chapter.\n\nHaving worked alongside him in one of the highest positions within the Order, I have every confidence in Vyberon's ability to serve as Sith Emperor once again. If given the opportunity, I would gladly serve under his leadership once more. I trust his judgement, respect his integrity, and firmly believe that his experience, vision, and willingness to embrace meaningful change make him the strongest candidate for the position.\n\nFor these reasons, I offer my strongest recommendation in support of Vyberon's application for Sith Emperor.\n\nWith respect,\nSlushyArcalis\nFormer Voice of the Emperor under Vyberon\n38th Sith Emperor & Project Manager\n20th July, 2026`
  },
  {
    id: "Apexivix",
    username: "Apexivix",
    occupation: "Guard Commander, Former Darth Nox",
    hasLetter: true,
    content: `TBD`
  },
  {
    id: "Skellvex",
    username: "Skellvex",
    occupation: "Former Lord Wrath & Lord Voice",
    hasLetter: true,
    content: `TBD`
  },
  {
    id: "JessieVylorian",
    username: "JessieVylorian",
    occupation: "Darth Marr",
    hasLetter: false
  }
];

export function EndorsementsSection() {
  const [activeLetter, setActiveLetter] = useState(null);

  const openLetter = (endorsement) => {
    if (endorsement.hasLetter) {
      setActiveLetter(endorsement);
      document.body.style.overflow = "hidden";
    }
  };

  const closeLetter = () => {
    setActiveLetter(null);
    document.body.style.overflow = "";
  };

  return (
    <>
      <section className="v2-page v2-endorsements animate-on-scroll">
        <div className="v2-header-bar animate-on-scroll stagger-1">
          <div className="v2-header-accent"></div>
          <h3>ENDORSEMENTS</h3>
        </div>

        <div className="v2-text-content">
          <p className="animate-on-scroll stagger-2">
            The following individuals have pledged their support and placed their trust in my mandate.
          </p>
        </div>

        <div className="v2-endorsements-grid animate-on-scroll stagger-3">
          {ENDORSEMENTS.map((endorser, i) => (
            <div
              key={endorser.id}
              className={`endorsement-card ${endorser.hasLetter ? 'has-letter' : ''}`}
              onClick={() => openLetter(endorser)}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="endorsement-pfp-wrapper">
                <img
                  src={`/assets/mandate/${endorser.id}.webp`}
                  alt={endorser.username}
                  className="endorsement-pfp"
                  onError={(e) => { e.target.src = 'https://i.imgur.com/7I9WbJ0.png' }}
                />
              </div>
              <div className="endorsement-info">
                <h4>{endorser.username}</h4>
                <p className="endorsement-occupation">{endorser.occupation}</p>
                {endorser.hasLetter && (
                  <span className="read-letter-badge">Read Letter ▸</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Letter Overlay */}
      <div className={`letter-overlay ${activeLetter ? 'is-open' : ''}`}>
        <div className="letter-overlay-bg" onClick={closeLetter}></div>
        <div className="letter-content-container">
          <button className="letter-back-btn" onClick={closeLetter}>
            <span className="triangle-icon">◂</span> RETURN
          </button>

          {activeLetter && (
            <div className="discord-message-layout">
              <div className="discord-pfp-container">
                <img
                  key={activeLetter.id}
                  src={`/assets/mandate/${activeLetter.id}.webp`}
                  alt={activeLetter.username}
                  className="discord-pfp"
                  onError={(e) => { e.target.src = 'https://i.imgur.com/7I9WbJ0.png' }}
                />
              </div>
              <div className="discord-message-body" key={`body-${activeLetter.id}`}>
                <div className="discord-header discord-stagger" style={{ animationDelay: '1s' }}>
                  <span className="discord-username">{activeLetter.username}</span>
                  <span className="discord-role">{activeLetter.occupation}</span>
                </div>
                <div className="discord-content">
                  {activeLetter.content.split('\n').map((paragraph, index) => {
                    // Filter out empty lines to not waste space/index
                    if (!paragraph.trim()) return null;
                    return (
                      <p
                        key={index}
                        className="discord-stagger"
                        style={{ animationDelay: `${1 + (index * 0.15)}s` }}
                      >
                        {paragraph}
                      </p>
                    );
                  })}

                  <div
                    className="discord-signature discord-stagger"
                    style={{
                      animationDelay: `${1 + (activeLetter.content.split('\n').filter(p => p.trim()).length * 0.15)}s`
                    }}
                  >
                    {activeLetter.username}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
