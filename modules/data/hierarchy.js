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
        slug: "dark-council-placeholder",
        name: "Dark Council",
        body: "Dark Council entries will be added later.",
        category: "Dark Council"
      }
    ]
  },
  {
    id: "high-command",
    title: "High Command",
    section: "HIGH COMMAND",
    items: [
      {
        slug: "torretoterminus",
        name: "Lord Emperor Torreto",
        body: "The 40th Sith Emperor.",
        category: "TorretoTerminus",
        path: "The 40th Sith Emperor",
        pathOwnRow: true
      },
      {
        slug: "the_voice",
        name: "The Emperor's Voice",
        body: "The Emperor's Voice.",
        category: "The Voice",
        path: "The Emperor's Powerbase"
      },
      {
        slug: "the_wrath",
        name: "The Emperor's Wrath",
        body: "The Emperor's Wrath.",
        category: "The Wrath",
        path: "The Emperor's Powerbase"
      },
      {
        slug: "servant_one",
        name: "Servant One",
        body: "Servant One.",
        category: "Servant One",
        path: "The Emperor's Powerbase"
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
        href: "/group-administration/gawk_aktuun",
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
        href: "/group-administration/project-manager",
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

function imageForItem(item) {
  return `/assets/morphs/${IMAGE_BY_SLUG[item.slug] || item.slug.replace(/-/g, "_")}.png`;
}

export function hierarchyItems() {
  return HIERARCHY_GROUPS.flatMap(group =>
    group.items.map((item, index) => ({
      ...item,
      image: item.image || imageForItem(item),
      groupId: group.id,
      groupTitle: group.title,
      section: group.section,
      order: index + 1,
      href: item.href || `/${group.id}/${item.slug}`
    }))
  );
}

export function getHierarchyGroup(id) {
  return HIERARCHY_GROUPS.find(group => group.id === id) || null;
}

export function getHierarchyItem(groupId, slug) {
  const group = getHierarchyGroup(groupId);
  if (!group) return null;

  const item = group.items.find(entry => entry.slug === slug);
  return item ? { ...item, image: item.image || imageForItem(item), groupId: group.id, groupTitle: group.title, section: group.section, href: item.href || `/${group.id}/${item.slug}` } : null;
}
