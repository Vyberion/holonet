import { existsSync } from "node:fs";
import { join } from "node:path";

const MORPH_FALLBACK_IMAGE = "/assets/morphs/clown.jpg";
const CURRENT_EMPEROR_SLUG = "the-40th-emperor";

function ordinal(value) {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;

  return `${value}${{ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th"}`;
}

function emperorPathTitle(value) {
  return {
    1: "The First",
    2: "The Second",
    3: "The Third",
    4: "The Fourth",
    5: "The Fifth",
    6: "The Sixth",
    7: "The Seventh",
    8: "The Eighth",
    9: "The Ninth",
    10: "The Decennial",
    11: "The Eleventh",
    12: "The Twelfth",
    13: "The Thirteenth",
    14: "The Fourteenth",
    15: "The Fifteenth",
    16: "The Sixteenth",
    17: "The Seventeenth",
    18: "The Eighteenth",
    19: "The Nineteenth",
    20: "The Vicennial",
    21: "The Twenty-First",
    22: "The Twenty-Second",
    23: "The Twenty-Third",
    24: "The Twenty-Fourth",
    25: "The Twenty-Fifth",
    26: "The Twenty-Sixth",
    27: "The Twenty-Seventh",
    28: "The Twenty-Eighth",
    29: "The Twenty-Ninth",
    30: "The Tricennial",
    31: "The Thirty-First",
    32: "The Thirty-Second",
    33: "The Thirty-Third",
    34: "The Thirty-Fourth",
    35: "The Thirty-Fifth",
    36: "The Thirty-Sixth",
    37: "The Thirty-Seventh",
    38: "The Thirty-Eighth",
    39: "The Thirty-Ninth",
    40: "The Quadragennial"
  }[value] || `The ${ordinal(value)}`;
}

export const HIERARCHY_GROUPS = [
  {
    id: "low-ranks",
    title: "Low Ranks",
    section: "LOW RANKS",
    items: [
      {
        slug: "grotthu",
        name: "Grotthu",
        body: "The first rank obtainable by all conscripts of the Sith Order, an ambitious visitor must join the group to receive a Grotthu promotion.",
        category: "Low Rank"
      },
      {
        slug: "tyro",
        name: "Tyro",
        body: "Grotthus must attend and pass an Order Induction to receive a Tyro promotion.",
        category: "Low Rank"
      },
      {
        slug: "hopeful",
        name: "Hopeful",
        body: "Tyros must attend and pass any event to receive a Hopeful promotion.",
        category: "Low Rank"
      },
      {
        slug: "neophyte",
        name: "Neophyte",
        body: "Hopefuls must attend and pass any event to receive a Neophyte promotion.",
        category: "Low Rank"
      },
      {
        slug: "academy-student",
        name: "Academy Student",
        body: "Neophytes must attend and pass any event to receive an Academy Student promotion.",
        category: "Low Rank"
      },
      {
        slug: "initiate",
        name: "Initiate",
        body: "Initiates must attend and pass any event to receive an Initiate promotion.",
        category: "Low Rank"
      },
      {
        slug: "acolyte",
        name: "Acolyte",
        body: "Initiates must attend and pass any event to receive an Acolyte promotion.",
        category: "Low Rank"
      },
      {
        slug: "sith-prospect",
        name: "Sith Prospect",
        body: "Acolytes must attend and pass any event as well as their Prospect Trial to receive a Prospect promotion.\n\nTo retake a failed Prospect Trial, Acolytes must attend and pass a Conscript training, or an event related to the section failed during the initial trial.",
        category: "Low Rank"
      }
    ]
  },
  {
    id: "middle-ranks",
    title: "Mid Ranks",
    section: "MID RANKS",
    items: [
      {
        slug: "sith-apprentice",
        name: "Sith Apprentice",
        body: "Sith Prospects must attend and pass any event as well as pass their Apprentice trial.\n\nTo retake a failed Apprentice Trial, Prospects must attend and pass a Conscript training, or an event related to the section failed during the initial trial.",
        category: "Mid Rank"
      },
      {
        slug: "sith-adept",
        name: "Sith Adept",
        body: "Sith Apprentices must attend and pass any event as well as their Adept Trial to receive an Adept promotion.\n\nTo retake a failed Adept Trial, Apprentices must attend and pass a Conscript training, or an event related to the section failed during the initial trial.",
        category: "Mid Rank"
      },
      {
        slug: "sith-sorcerer",
        name: "Sith Sorcerer",
        body: "Sith Adepts must attend and pass a Conscript training or special event as well as a lore specific event.\n\nTo retake a failed Sorcerer Trial, Adepts must attend and pass a Conscript training or a related event to the section failed during the initial trial.",
        category: "Mid Rank",
        path: "Lore Path"
      },
      {
        slug: "sith-warrior",
        name: "Sith Warrior",
        body: "Sith Adepts must attend and pass a Conscript training or special event in addition to a combat specific event.\n\nTo retake a failed Warrior Trial, Adepts must attend and pass a Conscript training, or an event related to the section failed during the initial trial.",
        category: "Mid Rank",
        path: "Combat Path"
      },
      {
        slug: "sith-seer",
        name: "Sith Seer",
        body: "Sith Sorcerers must attend and pass a Conscript training or special event as well as a lore specific event and a Codex training.\n\nTo retake a failed Seer Trial, Sorcerers must attend and pass a Conscript training or a related event to the section failed during the initial trial.",
        category: "Mid Rank",
        path: "Lore Path"
      },
      {
        slug: "sith-marauder",
        name: "Sith Marauder",
        body: "Sith Warriors must attend and pass a Conscript training or special event as well as a combat specific event and a Codex training.\n\nTo retake a failed Marauder Trial, Warriors must attend and pass a Conscript training or a related event to the section failed during the initial trial.",
        category: "Mid Rank",
        path: "Combat Path"
      }
    ]
  },
  {
    id: "high-ranks",
    title: "High Ranks",
    section: "HIGH RANKS",
    items: [
      {
        slug: "sith-overseer",
        name: "Sith Overseer",
        body: "Sith Seers or Marauders must assist 3 events as well as pass an Overseer trial.\n\nTo retake a failed Overseer Trial, a Marauder or Seer must attend and pass a Conscript training or an event related to the section failed during the initial trial.",
        category: "High Rank"
      },
      {
        slug: "sith-master",
        name: "Sith Master",
        body: "Sith Overseers must have completed 7 days as an Overseer, 2 vouches of any type, and host 15 events as well as pass a Master trial.\n\nTo retake a failed Master Trial, Overseers must host 5 trainings and attend and pass an event related to the section failed during the initial trial.",
        category: "High Rank"
      },
      {
        slug: "sith-lord",
        name: "Sith Lord",
        body: "Sith Masters must have completed 7 days as a Master, 3 vouches, two of any type and 1 Dark Council+, and host 20 events as well as pass a Lord trial.\n\nTo retake a failed Lord Trial, Masters must host 5 trainings, acquire another vouch of any type, and attend and pass an event related to the section failed during the initial trial.",
        category: "High Rank"
      },
      {
        slug: "darth",
        name: "Darth",
        body: "Obtained by passing a Darth Trial.\n\nThis rank may alternatively be granted through purges, discharges, demotions for rule breaking or as the result of losing a Kaggath.\n\nConscripts of this rank are required to use grammar and complete their weekly quota.",
        category: "High Rank"
      }
    ]
  },
  {
    id: "divisions",
    title: "Divisions",
    section: "DIVISIONS",
    items: [
      {
        slug: "dark-honor-guards",
        href: "/dark-honor-guards/info",
        name: "Dark Honor Guard",
        body: "The Dark Honor Guards are an elite set of individuals who are tasked with upholding and maintaining law and order within the Temple. These individuals are tasked with neutralizing hostile threats, safeguarding members of high importance, and serving as the primary law enforcement force on Korriban.\n\nGuard members undergo harsh training and are well equipped to handle any situation that may arise. They are granted specialized tools, which include:\n\nSaber Pike - A weapon with extended range compared to standard Lightsabers.\nDivisional Force - Used to manage rule-breakers and aid in line of work.\nCuffs - Used to detain and jail rule-breakers within the Sanctum.\n\nJoining Requirements:\nProspective members must have a solid understanding of the Sith Codex as well as the rules of Korriban. A high level of discipline, professionalism, and commitment to the Guard's code is expected at all times. Members must also be ranked Academy Student or higher to attend a tryout.\n\nDivision Type: Law Enforcement",
        category: "Division"
      },
      {
        slug: "reavers",
        href: "/reavers/info",
        name: "Reavers",
        body: "The Reavers are the Emperor's Elite Assassins, they are entrusted with eliminating any hostile threat and protecting the Temple from external threats at all costs. Operating in secrecy, they carry out secret missions designed to maintain order, and security amongst the Sith Order.\n\nAs a special operations division, Reavers are equipped with specialized tools and abilities that aid in their missions, such as:\n\nDual Saber - A weapon with faster swing speeds than regular sabers.\nDivisional Force - Useful for pursuing and neutralizing fleeing hostiles.\nEmulate - Allows members to disguise themselves during operations.\n\nJoining Requirements:\nSith looking to join must possess a strong understanding of the Sith Codex and be highly proficient in Lightsaber combat. Professionalism, discipline, and discretion are also highly important for anyone seeking to become a Reaver. Members must also be ranked Academy Student or higher to attend a tryout.\n\nDivision Type: Special Operations",
        category: "Division"
      },
      {
        slug: "dread-masters",
        href: "/dread-masters/info",
        name: "Dread Masters",
        body: "The Dread Masters are a group of powerful and influential beings within the Order who are tasked with teaching Ancient Knowledge to the next generation of Sith. Through engaging lore trainings, they ensure the preservation and understanding of the Order's history and philosophies are kept.\n\nSpecializing in Sith lore, Dread Masters possess deep knowledge of ancient teachings and wield the tools needed to both educate and enforce the Order's philosophies:\n\nDread Pike - Has greater range than regular sabers. And is yellow.\nDivisional Force - Used for swift mobility across the temple and training grounds.\nAdministrator on Korriban - Enables them to host and manage lore sessions effectively.\n\nJoining Requirements:\nAspiring Sith must demonstrate strong proficiency in Sith Lore as well as in the Sith Codex. A deep understanding of the teachings of the Order, and a high level of professionalism are essential for those seeking to join the Dread Council. Members must also be ranked Academy Student or higher to attend a tryout.\n\nDivision Type: Ancient Knowledge",
        category: "Division"
      },
      {
        slug: "inquisitors",
        href: "/inquisitors/info",
        name: "Inquisitorius",
        body: "Division information can be filled in here.",
        category: "Division"
      }
    ]
  },
  {
    id: "dark-council",
    title: "Dark Council",
    section: "DARK COUNCIL",
    items: [
      {
        slug: "hro",
        name: "The Emperor's Wrath",
        body: "The High Rank Overseer represents the Dark Council's authority over the high ranks.",
        category: "High Rank Overseer",
        path: "High Rank Overseer",
        pathOwnRow: true
      },
      {
        slug: "dhgo",
        name: "Darth Mortis",
        body: "The Guard Overseer directs the Dark Honor Guard on behalf of the Dark Council.",
        category: "Guard Overseer",
        path: "Guard Overseer",
        pathOwnRow: true,
        active: false
      },
      {
        slug: "rvro",
        name: "Darth Baras",
        body: "The Reaver Overseer directs the Reavers on behalf of the Dark Council.",
        category: "Reaver Overseer",
        path: "Reaver Overseer",
        pathOwnRow: true,
        active: false
      },
      {
        slug: "iqo",
        name: "Darth Jadus",
        body: "The Inquisitor Overseer directs the Inquisitorius on behalf of the Dark Council.",
        category: "Inquisitor Overseer",
        path: "Inquisitor Overseer",
        pathOwnRow: true,
        active: false
      },
      {
        slug: "dmo",
        name: "Darth Nox",
        body: "The Dread Master Overseer directs the Dread Masters on behalf of the Dark Council.",
        category: "Dread Master Overseer",
        path: "Dread Master Overseer",
        pathOwnRow: true,
        active: false
      },
      {
        slug: "wm",
        name: "Warmaster",
        body: "The Warmaster commands military direction for the Dark Council.",
        category: "Warmaster",
        path: "Warmaster",
        pathOwnRow: true,
        active: false
      }
    ]
  },
  {
    id: "high-command",
    title: "High Command",
    section: "HIGH COMMAND",
    items: [
      {
        slug: CURRENT_EMPEROR_SLUG,
        href: `/archives/emperors/${CURRENT_EMPEROR_SLUG}`,
        name: "Lord Emperor Torreto",
        body: "PENDING.",
        category: "The Quadragennial",
        path: "The Quadragennial",
        pathOwnRow: true,
        routable: false
      },
      {
        slug: "the_voice",
        name: "The Emperor's Voice",
        body: "The Emperor's Voice carries the will of the Emperor and speaks with the authority of the throne.",
        category: "The Emperor's Voice",
        path: "The Emperor's Powerbase"
      },
      {
        slug: "the_wrath",
        name: "The Emperor's Wrath",
        body: "The Emperor's Wrath serves as the blade of the throne and enforces the Emperor's command.",
        category: "The Emperor's Wrath",
        path: "The Emperor's Powerbase"
      },
      {
        slug: "servant_one",
        name: "Servant One",
        body: "",
        category: "Servant One",
        path: "The Emperor's Powerbase",
        classified: true
      }
    ]
  },
  {
    id: "administration",
    title: "Group Administration",
    section: "GROUP ADMINISTRATION",
    items: [
      {
        slug: "group-owner",
        name: "Manar",
        body: "Group Owner.",
        category: "Group Owner",
        path: "Group Owner"
      },
      {
        slug: "project-manager",
        name: "Rdn",
        body: "Project Manager.",
        category: "Project Manager",
        path: "Project Manager"
      },
      {
        slug: "athli0s_aktuun",
        name: "Athlios",
        body: "Sith Architect.",
        category: "Athli0s Aktuun",
        path: "Sith Architect"
      },
      {
        slug: "gawk_aktuun",
        name: "Gawk",
        body: "Sith Architect.",
        category: "Gawk Aktuun",
        path: "Sith Architect"
      },
      {
        slug: "blueakuji",
        name: "Blue",
        body: "Sith Architect.",
        category: "BlueAkuji",
        path: "Sith Architect"
      },
      {
        slug: "fallen-gawk",
        href: "/administration/gawk_aktuun",
        image: "/assets/morphs/gawk_aktuun.png",
        name: "Gawk",
        body: "Fallen Advisor.",
        category: "Gawk Aktuun",
        path: "Fallen Advisors"
      },
      {
        slug: "naktisterminus",
        name: "Naktis",
        body: "Fallen Advisor.",
        category: "Naktisterminus",
        path: "Fallen Advisors"
      },
      {
        slug: "fallen-rdn",
        href: "/administration/project-manager",
        image: "/assets/morphs/project_manager.png",
        name: "Rdn",
        body: "Fallen Advisor.",
        category: "Project Manager",
        path: "Fallen Advisors"
      },
      {
        slug: "terrabiome",
        name: "Terrabiome",
        body: "Fallen Advisor.",
        category: "Terrabiome",
        path: "Fallen Advisors"
      },
      {
        slug: "tranom_x",
        name: "Tranom",
        body: "Fallen Advisor.",
        category: "Tranom X",
        path: "Fallen Advisors"
      }
    ]
  }
];

const IMAGE_BY_SLUG = {
  "academy-student": "academy_student",
  "dark-honor-guards": "dark_honor_guard",
  "dread-masters": "dread_master",
  inquisitors: "inquisitor",
  reavers: "reaver"
};

const EMPEROR_ARCHIVE_DATA = [
  {
    name: "Lord Emperor Varnak",
    body: "VarnakKallig was chosen by iWakers and began the imperial lineage as the First Emperor of TSO in July 2017. The rank had previously been unobtainable to regular members, making his ascension the first of its kind.\n\nHis reign was remembered for competent leadership, combat ability, and the standard it set for later Emperors. After a period of stagnation, he Fell and later served as the first Fallen advisor to future successors."
  },
  {
    name: "Lord Emperor Vynlinnery",
    body: "Vynlinnery, also known as Reaper, was the second Emperor of TSO and was chosen by iWakers. His rule was remembered as strict, with harsher punishments that made his administration controversial.\n\nPoor judgment during his tenure contributed to his Fall, and he did not remain as an advisor."
  },
  {
    name: "Lord Emperor Nazgulaz",
    body: "Nazgulaz was the third Emperor of TSO and the third Emperor appointed by iWakers. His policy focused heavily on divisions, and his rule was regarded as firm but comparatively fair.\n\nHis tenure lasted only a few weeks. After his Fall, he remained as a Fallen advisor."
  },
  {
    name: "Lord Emperor Rok",
    body: "iRoklas was declared and ranked as the fourth Emperor of TSO by iWakers. His tenure lasted less than a day and remained unofficial in practice because he did not accept the title before being demoted.\n\nHe is retained in the imperial archive because he was formally selected, ranked and considered a serious choice for the throne."
  },
  {
    name: "Lord Emperor Domitius (I)",
    body: "Domitius_Drahavos was the fifth Emperor of TSO and was appointed by iWakers. His first reign was strict and enforcement focused, with mass reforms, high standards, and harsh punishment used against perceived incompetence.\n\nHe was known as a skilled combatant for his era and for his extreme judgment in divisional inspections. After his Fall, his results allowed him to carry on as an advisor."
  },
  {
    name: "Lord Emperor Zacho",
    body: "Thatguyzacho was the sixth Emperor of TSO and the sixth Emperor appointed by iWakers. His reign was viewed as comparatively lax, and his administration experienced internal friction.\n\nHis tenure is remembered for improvement to training events and for influence drawn from earlier administrations. After his Fall, he did not remain as an advisor."
  },
  {
    name: "Lord Emperor Terrabiome (I)",
    body: "Terrabiome was the seventh Emperor of TSO and the seventh Emperor chosen by iWakers. Much of his first reign is no longer well documented.\n\nHe ascended from Darth Mortis after success within the Dark Honor Guard and placed attention on the divisions of his time. It is unclear whether he remained as an advisor after his initial Fall."
  },
  {
    name: "Lord Emperor Domitius (II)",
    body: "Domitius became the eighth Emperor of TSO and the first person to hold a second imperial reign. He returned from Fallen status under iWakers.\n\nHis second reign was stricter than his first, with heavy involvement in divisional administration. Near the end of this period, iWakers withdrew from ownership and Domitius ascended to The Force as owner of TSO."
  },
  {
    name: "Lady Empress Bella",
    body: "Bella_Drahavos was the ninth sovereign of TSO and the first Lady Empress of the Sith. She was the first sovereign appointed by Lord Dom.\n\nDetailed information about her reign is limited, though the archive records her as interactive and associated with quality inspections on all group members."
  },
  {
    name: "Lord Emperor Dalton",
    body: "Dalton_Lycan was the tenth Emperor of TSO and the second Emperor appointed by Lord Dom.\n\nFew details about his reign are preserved in the current archive."
  },
  {
    name: "Lord Emperor Tenebrae",
    body: "Tenebrae_Lycan was the eleventh Emperor of TSO and the third Emperor appointed by Lord Dom. His reign was brief, lasting nine days.\n\nHe Fell after a change in preference from the Ancient One."
  },
  {
    name: "Lord Emperor Spectre",
    body: "SpectreDrahavos was the twelfth Emperor of TSO and the first Emperor appointed by Lord Zach. His reign took place during a period of severe group stagnation near the end of summer 2018.\n\nSpectre produced numerous reform ideas and regularly consulted his Council. He was regarded as capable during a difficult era and resigned in September 2018, remaining as an advisor afterward."
  },
  {
    name: "Lord Emperor Terrabiome (II)",
    body: "Terrabiome_Drahavos became the thirteenth Emperor of TSO and the second sovereign to hold a second term. He was the second Emperor appointed by Lord Zach.\n\nHis second reign focused on group legislation and the improvement and balancing of divisions. After another period of stagnation, he Fell and remained as an advisor in November 2018."
  },
  {
    name: "Lord Emperor Gurt",
    body: "Gurt_Kalazar was the fourteenth Emperor of TSO and the first official Emperor to ascend from a developer position. He was the third Emperor appointed by Lord Zach.\n\nHis administration organized High Command and the Dark Council, questionable selections were made, but ultimately were rectified in better judgment. His administration proved effective, and he reigned during a more active period. His reign lasted nearly four months, the longest for its time, before he ascended through The Force as owner of TSO in March 2019."
  },
  {
    name: "Lord Emperor Avextriux",
    body: "Avextriux_Kalazar was the fifteenth Emperor of TSO and the first Emperor appointed by Lord Gurt. He ascended from Dread Master Raptus and focused heavily on divisions, especially the Shadow Guard.\n\nHis reign was strict and initially unstable due to conspiracy within the Dark Council, leading to a Council wipe and new leadership. His later efforts declined, and he Fell in April 2019 without remaining as an advisor."
  },
  {
    name: "Lady Empress Hannah",
    body: "Hannah_Kalazar was the sixteenth sovereign of TSO, the second Lady Empress, and the second sovereign appointed by Lord Gurt.\n\nHer reign produced declining results and allegations of bias within the administration. She was regarded as dormant, with inexperienced leadership selections, and did not remain as an advisor after her Fall in June 2019."
  },
  {
    name: "Lord Emperor Rannek",
    body: "Rannek_Drahavos, also known as Odin, was the seventeenth Emperor of TSO and the third Emperor appointed by Lord Gurt. He intended to establish new ideas for the group at the start of his reign.\n\nExtended inactivity prevented major action during his tenure. After his Fall in August 2019, he did not remain as an advisor."
  },
  {
    name: "Lord Emperor Kronos (I)",
    body: "Kronos_Drahavos, also known as iiMrMoon or Evan, was the eighteenth Emperor of TSO and the fourth Emperor appointed by Lord Gurt. He inherited a dormant administration and restructured leadership around available members.\n\nHis legislation updated existing policy, reinforced high-rank numbers, and applied firm oversight to divisions. Activity declined near the school year, and he Fell in September 2019. He did not initially remain as an advisor, but later achieved Fallen status."
  },
  {
    name: "Lord Emperor Asura",
    body: "Asuramarumaru was the nineteenth official Emperor of TSO and the only Emperor chosen by Lord Nazgulaz and Narvog. The archive also notes an unofficial transitional emperor-elect period under Brody before Asura's reign.\n\nAsura emphasized the Shadow Guard and early Kaggath policy. He was the first Emperor to receive Architect permissions due to proficiency in building, development, and morph-making. Misuse of those permissions contributed to his Fall in November 2019."
  },
  {
    name: "Lord Emperor Chaos (I)",
    body: "ChaosVirtus was the twentieth sovereign of TSO and the ninth Emperor chosen by iWakers overall. His reign began during a new owner era with increased activity and opportunity for rebuilding.\n\nChaos helped rebuild the Dark Council while the Order was under-governed. His strict style and harsh punishments created tension within the Council, contributing to his removal. He did not initially remain as an advisor."
  },
  {
    name: "Lord Emperor Kronos (II)",
    body: "Kronos_Kalazar was the twenty-first Emperor of TSO and the tenth Emperor chosen by iWakers. His second reign occurred during map transitions and restructuring of the ranking system.\n\nHis policy focused on maintaining and improving activity during the summer. Rising conflict between the bloodlines of Aktuun and Kalazar and threats to his position culminated in a challenge for the throne in July 2020."
  },
  {
    name: "Lord Emperor Manar",
    body: "Manar_Aktuun was the twenty-second Emperor of TSO, the first Emperor to win the title by Kaggath, and the eleventh Emperor under iWakers.\n\nHis reign took place during bloodline conflict and included resistance tied to the previous Kaggath. After inactivity and administrative issues, his throne was challenged in August 2020."
  },
  {
    name: "Lord Emperor Sprinkle",
    body: "Sprinkle_Kalazar was the twenty-third Emperor of TSO, the second Emperor to win the title by Kaggath, and an Emperor under Kactussman (previously, Gurt_Kalazar).\n\nHis reign was hands-off, with significant responsibility placed on High Command. He was eventually challenged for the throne due to inactivity around September 2020."
  },
  {
    name: "Lord Emperor Timo",
    body: "Tiimo_Aktuun, also known as Euqatix, was the twenty-fourth Emperor of TSO and the third Emperor to win the title by Kaggath. He was an experienced member and an exceptional combatant, winning Champion of the Sith multiple times.\n\nHis reign occurred as bloodline tensions began to calm, though opposition remained. His position was challenged in December 2020."
  },
  {
    name: "Lord Emperor Zeus",
    body: "Zeus_Kalazar, also known as Stormkrieg or Ekori, was the First Black Emperor of TSO, the twenty-fifth Emperor overall and the fourth Emperor to win the title by Kaggath. He was remembered for strong combat skill and for remaining outside bloodline politics.\n\nHis reign included controversial communications policy changes and disciplinary action against High Command. He was regarded as fair by some, but resistance grew after sanctions against his Lord Wrath, leading to a challenge in February 2021."
  },
  {
    name: "Lord Emperor Terrabiome (III)",
    body: "Terrabiome_Kalazar was the twenty-sixth Emperor of TSO and the first Emperor to hold three terms. He was the fifth Emperor to win the title by Kaggath.\n\nHis third reign was regarded as fair and stable, with strong relations across the group and High Command. Bloodline tensions were reduced during this period, and the Order experienced moderate prosperity through the summer. He Fell and remained as an advisor in August 2021."
  },
  {
    name: "Lord Emperor Segnus",
    body: "Segnus_Kalazar was the twenty-seventh Emperor of TSO and an Emperor under Kactussman. He was appointed after an application process in August 2021.\n\nHis reign began near the start of the school year, when activity was declining. His administration was viewed as acceptable early on, but later became inactive. Segnus eventually Fell and did not remain as an advisor."
  },
  {
    name: "Lord Emperor Gawking",
    body: "Gawk_Aktuun, also known as Gawking, was the twenty-eighth Emperor of TSO and the longest-serving Emperor, though his reign is remembered as one carried heavily by his latter Wrath. He was appointed after serving as Dark Honor Guard Commander and survived challenges from remaining High Command merely through the support system holding the throne upright. His reign lasted more than thirteen months and is remembered for policy revisions, the shutdown of the Shadow Guard and the hosting of unique events, though many of these successes were shaped by those around him. He was the second Emperor to achieve Architect privileges, but the transition of ownership between Kactussman and CroczTerminus destabilized the era, leading to his Fall in November 2022. He remained as a bickering advisor."
  },
  {
    name: "Lord Emperor Legacy",
    body: "Legacy_Lycan was the twenty-ninth Emperor of TSO and the first Emperor chosen by Manar_Aktuun. He ascended from Dread Master Raptus while the group was recovering from major instability left by previous ownership.\n\nLegacy proposed many ideas that he was insistent on implementing, though many were viewed as impractical. Heavy resistance developed during his tenure, and he was challenged for his position in December 2022."
  },
  {
    name: "Lord Emperor Aramis",
    body: "Boiledmonkeyfoot, also known as Aramis, was the thirtieth Emperor of TSO and the first to obtain the title by forfeit of Kaggath. He was the second Emperor under Manar_Aktuun.\n\nHe ascended after serving alongside his predecessor on High Command. His reign was viewed as dormant and disconnected from the Order, with limited practical direction. He later resigned after a successful challenge."
  },
  {
    name: "Lord Emperor Poncake",
    body: "PoncakeTerminus was the thirty-first Emperor of TSO and the third Emperor under Manar_Aktuun. He was remembered for efforts to improve the Dark Honor Guard and for bringing elitism to the Shadow Guard.\n\nPoncake was an exceptional combatant and held Champion of the Sith multiple times, but his judgment was often questioned. His reign ended after rank and money-related misconduct came to light; he faced banishment, and did not remain as an advisor."
  },
  {
    name: "Lord Emperor Naktis (II)",
    body: "NaktisTerminus, also known as Chaos, was the thirty-second Emperor of TSO and the fourth Emperor under Manar_Aktuun. His second imperial rule followed a philosophy of an iron rule.\n\nNaktis prioritized standards and results within his administration. Some resistance formed beneath him, but it did not seriously threaten his rule. After some time, he Fell and remained as an advisor."
  },
  {
    name: "Lord Emperor Tranom",
    body: "Tranom_X was the thirty-third Emperor of TSO and the fifth Emperor under Manar_Aktuun. He led the Order during a period of dwindling activity.\n\nHis tenure was supported by a tactically selected High Command. After his Fall, he remained as an advisor."
  },
  {
    name: "Lord Emperor Vyberon",
    body: "Vyberon was the thirty-fourth Emperor of TSO and the sixth Emperor under Manar_Aktuun. His reign introduced ideas affecting the ranking structure and regulation guides.\n\nHe also established precedent for supreme decrees and declarations. Prolonged stagnation, pressure from advisors and subordinates, and limited owner support led Vyberon, his High Command and Dark Council to resign in July 2024. Though many reforms did not last, his reign is remembered for innovation."
  },
  {
    name: "Lord Emperor Torreto",
    body: "TorretoTerminus was the thirty-fifth Emperor of TSO and the seventh Emperor under Manar_Aktuun. His reign was swift and marked by active use of executive decision-making.\n\nSome decisions were considered poorly advised due to limited counsel, but his rule still affected the community through High Command appointments, a Dark Council appointment, and continued divisional strength. He resigned in December 2024 after the likelihood of a challenge."
  },
  {
    name: "Lord Emperor Ghost",
    body: "GhostTerminus was the thirty-sixth Emperor of TSO and the eighth Emperor under Manar_Aktuun. His reign introduced influential ideas, including the creation of the Codex and administrative improvements.\n\nGhost maintained an interactive tenure, overseeing High Command and executing reforms throughout his rule. He resigned in April 2025."
  },
  {
    name: "Lord Emperor Bag",
    body: "BagArvex was the thirty-seventh Emperor of TSO, the ninth Emperor under Manar_Aktuun, and the first Emperor to climb the ranks as an Architect.\n\nHis reign oversaw a full Dark Council, complete High Command, and several Codex changes, most notably Kaggath law. He also continued working as the primary developer. After roughly one and a half months, his reign slowed and he resigned in June 2025."
  },
  {
    name: "Lord Emperor Slushy",
    body: "PENDING."
  },
  {
    name: "Lord Emperor Saph",
    body: "PENDING."
  },
  {
    name: "Lord Emperor Torreto",
    body: "PENDING.",
    current: true
  }
];

function emperorArchiveRecord(index) {
  const title = ordinal(index);
  const source = EMPEROR_ARCHIVE_DATA[index - 1] || {};

  return {
    slug: `the-${title}-emperor`.toLowerCase(),
    name: source.name || `The ${title} Emperor`,
    body: source.body || "Biography pending archival upload.",
    category: `The ${title} Sith Emperor`,
    path: emperorPathTitle(index),
    current: source.current || index === 40
  };
}

export const EMPEROR_ARCHIVE_GROUP = {
  id: "emperor-archive",
  title: "Emperor Archive",
  section: "EMPERORS",
  items: Array.from({ length: 40 }, (_, index) => emperorArchiveRecord(index + 1))
};

function isActiveItem(item) {
  return item.active !== false;
}

function normalizeAssetPath(src) {
  if (!src) return "";
  if (/^(?:https?:)?\/\//.test(src) || src.startsWith("data:")) return src;

  return src.startsWith("/") ? src : `/${src}`;
}

function morphExists(src) {
  const normalized = normalizeAssetPath(src);
  if (!normalized.startsWith("/assets/morphs/")) return true;

  return existsSync(join(process.cwd(), "public", normalized.replace(/^\/+/, "")));
}

function imageForItem(item) {
  if (item.image) {
    const explicitImage = normalizeAssetPath(item.image);
    return morphExists(explicitImage) ? explicitImage : MORPH_FALLBACK_IMAGE;
  }

  const imageName = IMAGE_BY_SLUG[item.slug] || item.slug.replace(/-/g, "_");
  const image = `/assets/morphs/${imageName}.png`;
  return morphExists(image) ? image : MORPH_FALLBACK_IMAGE;
}

function decorateHierarchyItem(group, item, index, fallbackHref) {
  return {
    ...item,
    image: imageForItem(item),
    groupId: group.id,
    groupTitle: group.title,
    section: group.section,
    order: index + 1,
    href: item.href || fallbackHref
  };
}

export function hierarchyItems({ includeInactive = false } = {}) {
  return HIERARCHY_GROUPS.flatMap(group =>
    group.items
      .filter(item => includeInactive || isActiveItem(item))
      .map((item, index) => decorateHierarchyItem(group, item, index, `/${group.id}/${item.slug}`))
  );
}

export function getHierarchyGroup(id) {
  return HIERARCHY_GROUPS.find(group => group.id === id) || null;
}

export function getVisibleHierarchyGroup(id) {
  const group = getHierarchyGroup(id);
  if (!group) return null;

  return {
    ...group,
    items: group.items.filter(isActiveItem)
  };
}

export function visibleHierarchyGroups() {
  return HIERARCHY_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(isActiveItem)
  })).filter(group => group.items.length);
}

export function getHierarchyItem(groupId, slug, { includeInactive = false } = {}) {
  const group = getHierarchyGroup(groupId);
  if (!group) return null;

  const item = group.items.find(entry => entry.slug === slug);
  if (!item || (!includeInactive && !isActiveItem(item))) return null;

  const index = group.items.indexOf(item);
  return decorateHierarchyItem(group, item, index, `/${group.id}/${item.slug}`);
}

export function emperorArchiveItems() {
  return EMPEROR_ARCHIVE_GROUP.items.map((item, index) =>
    decorateHierarchyItem(EMPEROR_ARCHIVE_GROUP, item, index, `/archives/emperors/${item.slug}`)
  );
}

export function getEmperorArchiveItem(slug) {
  const item = EMPEROR_ARCHIVE_GROUP.items.find(entry => entry.slug === slug);
  if (!item) return null;

  const index = EMPEROR_ARCHIVE_GROUP.items.indexOf(item);
  return decorateHierarchyItem(EMPEROR_ARCHIVE_GROUP, item, index, `/archives/emperors/${item.slug}`);
}
