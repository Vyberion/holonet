"use client";

import { useState } from "react";

const ENDORSEMENTS = [
  {
    id: "thegodfr0g",
    username: "thegodfr0g",
    occupation: "Former General Malgus, Reaver Commander & High Inquisitor",
    hasLetter: true,
    content: `Back in 2023 I had the pleasure of serving alongside Owen, back when we were both Reaver Lords cutting our teeth together. It was then I could see his clear cut ability to openly communicate with fellow HRs while leading a division strong.\n\nWhen we sat together on the council, myself as Warmaster, him as Darth Baras, it gave me a front row seat to see how he thinks. Owen is a smart chap with strong ideologies, he doesn't want power for powers sake, he's got a vision for the order, and I think everyone should respect that, these visions also prove Owen's vast patience, which is a virtue not every Sith can claim.\n\nBeyond this, he's a genuinely good friend and someone I'd trust to lead the order to take over the GALAXY!!\n\nreaper of souls,`
  },
  {
    id: "BarrakudaCERO",
    username: "BarrakudaCERO",
    occupation: "Darth Baras",
    hasLetter: true,
    content: `First and foremost, the candidate I consider most suitable for this rank is Vyber, based on his analysis of the situation, the way he handles divisional operations, and what I’ve been able to see whilst looking into the server, simply out of curiosity when I first met him and learnt about his career, whilst he has been under my command in the Reavers. Furthermore, and I repeat, regarding his track record, I have looked at the ideas he put forward during his time as a member of the HC, and there are several things that originated with him which are still in place today, which I think is what makes him stand out far more than the other applicants, because of the mark he has already made whilst being in those kinds of ranks`
  },
  {
    id: "JimmyTheDankLord",
    username: "JimmyTheDankLord",
    occupation: "Senior Reaver, Former Darth Nox, Darth Marr & Darth Mortis",
    hasLetter: true,
    content: `I endorse Reaver Lord Vyberon for Emperor of the Sith Order. He has previous experience in ruling the order as a former Emperor. His determination and steadfast attitude within the reaver division has improved it rapidly and without failure. He is always attentive which is important as a leader and it is very clear he has great passion for his job. He is more than worthy for the throne.`
  },
  {
    id: "coldmanjar123",
    username: "coldmanjar123",
    occupation: "Senior Reaver, Former Guard Captain",
    hasLetter: true,
    content: `I think Vyberon is the most deserving of this position of emperor--Not because he was already Emperor before, but also because he's proven himself to be a prominent leader figure during his tenure in Reavers.\n\nDuring my time spent in Reavers, not a lot of drama regarding Vyberon has gone down, everybody respects him due to the fact on how he earned it from the community from his serious yet fair demeanour, this allowed him to successfully bring Reavers out of the darkness and into the light. His lack of drama also allows me to trust him that he knows what he's doing, and hope for the best when he obtains the role of Emperor.\n\nFurthermore, he has experience in almost every position and knows the ins and outs of this group entirely.\n\nFor these reasons alone, I believe Vyberon should be the one to inherit this job as Emperor.`
  },
  {
    id: "SlushyArcalis",
    username: "SlushyArcalis",
    occupation: "38th Sith Emperor, Former Lord Voice & Project Manager",
    hasLetter: true,
    content: `I’m writing to back Reaver Lord Vyberon for Sith Emperor.\n\nDuring his previous time on the throne, I served directly under him as his Voice. Working that closely with him gave me a clear view of how he operates as a leader, both when things are running smoothly and when we hit rough patches.\n\nVyberon has a talent for making the hard calls without being unreasonable. He actually listens to the people around him but isn't afraid to challenge the status quo if it means pushing the Order forward. He doesn't settle for complacency.\n\nWhat really stands out is that he wants to improve the group rather than just coast on what's already there. He understands that we need to evolve. He isn't interested in change just for the sake of it, but because he genuinely wants to build a stronger, more active community.\n\nHis last run as Emperor fell during one of our toughest periods. We were dealing with declining activity and massive hurdles that were completely out of his control. But instead of giving up or pointing fingers, he kept pushing. He supported his High Command and stayed engaged with the members to steer us through it the best he could.\n\nHe leads by example rather than just relying on a title to get respect. Given his track record, I know he has what it takes to guide the Order into its next era.\n\nI’d gladly serve under his leadership again. I trust his judgement and I know he’s the right fit for the position.\n\nWith respect,`
  },
  {
    id: "Apexivix",
    username: "Apexivix",
    occupation: "Guard Commander, Former Darth Nox",
    hasLetter: false,
    content: `TBD`
  },
  {
    id: "Skellvex",
    username: "Skellvex",
    occupation: "Former Lord Wrath & Lord Voice",
    hasLetter: false,
    content: `TBD`
  },
  {
    id: "JessieVylorian",
    username: "JessieVylorian",
    occupation: "Darth Marr",
    hasLetter: false
  },
  {
    id: "Athlios_Aktuun",
    username: "Athlios_Aktuun",
    occupation: "34.5th Sith Emperor, Sith Architect, Former Lord Wrath",
    hasLetter: true,
    content: "I have worked with Vyber several times even being apart of his High Command during his last reign, I can without a doubt recommend him as the next Emperor for several reasons. Vyber has continuously shown the willingness to work and has always made an attempt to make this order better than it has been, with him constantly outputting new ideas and systems to make the group function better as a whole. With his time as Reaver Lord and previous positions, he has been one of the most effective leaders that TSO has seen and unlike some Emperor's he doesn't just repeat mistakes and do the same bare minimum effort that most do. He puts in an attempt to make the game better for everyone. He is my recommendation for the next Emperor."
  },
  {
    id: "HuenArcalis",
    username: "HuenArcalis",
    occupation: "High Inquisitor, Former Darth Ravage & Darth Grand Inquisitor",
    hasLetter: true,
    content: "In my humble opinion, Vyberon, Reaver Lord, deserves the position as Emperor more than others through his past and future contributions towards the Order, creating websites while others laid back with feet up."
  },
  {
    id: "Zalivore",
    username: "Zalivore",
    occupation: "Former Darth Aruk",
    hasLetter: true,
    content: "Mf how the fuck would I remember some shit on star wars roblox from 5 years ago?"
  },
  {
    id: "Chakalaka3786",
    username: "Chakalaka3786",
    occupation: "Former Darth & My Wife",
    hasLetter: true,
    content: "Can I be servant 1?"
  }
];

export function EndorsementsSection() {
  const [activeLetter, setActiveLetter] = useState(null);
  const [animatingPfp, setAnimatingPfp] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const openLetter = (endorsement) => {
    if (endorsement.hasLetter) {
      setActiveLetter(endorsement);
      setIsClosing(false);
      setAnimatingPfp(true);
      setTimeout(() => setAnimatingPfp(false), 1500);
      document.body.style.overflow = "hidden";
    }
  };

  const closeLetter = () => {
    setIsClosing(true);
    document.body.style.overflow = "";
    setTimeout(() => {
      setActiveLetter(null);
      setIsClosing(false);
    }, 500);
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
                {endorser.hasLetter ? (
                  <span className="read-letter-badge">Read Letter ▸</span>
                ) : (
                  <span className="read-letter-badge no-statement">NO STATEMENT</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Letter Overlay */}
      <div className={`letter-overlay ${activeLetter && !isClosing ? 'is-open' : ''}`}>
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
                  className={`discord-pfp ${animatingPfp ? 'epic-transition' : ''}`}
                  onError={(e) => { e.target.src = 'https://i.imgur.com/7I9WbJ0.png' }}
                />
              </div>
              <div className="discord-message-body" key={`body-${activeLetter.id}`}>
                <div className="discord-header">
                  <span className="discord-username">{activeLetter.username}</span>
                  <span className="discord-role">{activeLetter.occupation}</span>
                </div>
                <div className="discord-content">
                  {activeLetter.content.split('\n').map((paragraph, index) => {
                    // Filter out empty lines to not waste space/index
                    if (!paragraph.trim()) return null;
                    return (
                      <p key={index}>
                        {paragraph}
                      </p>
                    );
                  })}

                  <div className="discord-signature">
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
