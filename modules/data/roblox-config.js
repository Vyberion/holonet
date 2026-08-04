export const SUPER_USER_IDS = ["2627035499"];

export const ROBLOX_GROUPS = {
  DARK_COUNCIL: {
    groupId: 3199126,
    tiers: {
      groupOwner: [255],
      projectManager: [254],
      emperor: [253],
      emperorPowerbase: [252, 251],
      highRankOverseer: [250, 100, 25, 20, 15],
      darkHonorGuardOverseer: [45],
      reaverOverseer: [35],
      dreadMasterOverseer: [40],
      inquisitoriusOverseer: [30],
      warmaster: [150]
    },
    ranks: {
      "253": { mode: "prefix", value: "Lord Emperor" },
      "252": { mode: "fixed", value: "Lord Voice" },
      "251": { mode: "fixed", value: "Lord Wrath" },
      "250": { mode: "fixed", value: "Darth Marr" },
      "150": { mode: "fixed", value: "General Malgus" },
      "100": { mode: "fixed", value: "Darth Acina" },
      "45": { mode: "fixed", value: "Darth Mortis" },
      "40": { mode: "fixed", value: "Darth Nox" },
      "35": { mode: "fixed", value: "Darth Baras" },
      "30": { mode: "fixed", value: "Darth Jadus" },
      "25": { mode: "fixed", value: "Darth Aruk" },
      "20": { mode: "fixed", value: "Darth Vowrawn" },
      "15": { mode: "fixed", value: "Darth Ravage" }
    }
  },

  MAIN_GROUP: {
    groupId: 3197893,
    tiers: {
      upper: [44, 45],
      lower: [50, 53]
    },
    ranks: {
      "53": { mode: "prefix", value: "Darth" },
      "50": { mode: "prefix", value: "Lord" },
      "45": { mode: "prefix", value: "Master" },
      "44": { mode: "prefix", value: "Overseer" },
      "42": { mode: "prefix", value: "Shadow Guard" },
      "35": { mode: "prefix", value: "Seer" },
      "34": { mode: "prefix", value: "Marauder" },
      "33": { mode: "prefix", value: "Sorcerer" },
      "32": { mode: "prefix", value: "Warrior" },
      "29": { mode: "prefix", value: "Adept" },
      "27": { mode: "prefix", value: "Apprentice" },
      "26": { mode: "prefix", value: "Prospect" },
      "25": { mode: "prefix", value: "Acolyte" },
      "24": { mode: "prefix", value: "Initiate" },
      "23": { mode: "prefix", value: "Academy Student" },
      "20": { mode: "prefix", value: "Neophyte" },
      "15": { mode: "prefix", value: "Hopeful" },
      "2": { mode: "prefix", value: "Tyro" },
      "1": { mode: "prefix", value: "Grotthu" }
    }
  },

  DIVISIONS: {
    reavers: {
      groupId: 3219802,
      tiers: {
        "1ic": [200],
        hr: [15],
        nco: [10],
        member: [1, 5]
      },
      ranks: {
        "200": { mode: "prefix", value: "Reaver Commander" },
        "15": { mode: "prefix", value: "Reaver Lord" },
        "10": { mode: "prefix", value: "Senior Reaver" },
        "5": { mode: "prefix", value: "Reaver" },
        "1": { mode: "prefix", value: "Reaver Initiate" }
      }
    },
    dhg: {
      groupId: 4364250,
      tiers: {
        "1ic": [100],
        "2ic": [90],
        hr: [80],
        nco: [60],
        member: [30, 50]
      },
      ranks: {
        "100": { mode: "prefix", value: "Guard Commander" },
        "90": { mode: "prefix", value: "Guard Captain" },
        "80": { mode: "prefix", value: "Guard Lieutenant" },
        "60": { mode: "prefix", value: "Senior Guard" },
        "50": { mode: "prefix", value: "Guard" },
        "30": { mode: "prefix", value: "Guard Initiate" }
      }
    },
    inquisitors: {
      groupId: 3356831,
      tiers: {
        "1ic": [200],
        hr: [155],
        nco: [150],
        member: [100, 125]
      },
      ranks: {
        "200": { mode: "prefix", value: "Grand Inquisitor" },
        "155": { mode: "prefix", value: "High Inquisitor" },
        "150": { mode: "prefix", value: "Senior Inquisitor" },
        "125": { mode: "prefix", value: "Inquisitor" },
        "100": { mode: "prefix", value: "Inquisitor Initiate" }
      }
    },
    dreadmasters: {
      groupId: 3215895,
      tiers: {
        "1ic": [36],
        "2ic": [30],
        member: [2, 3, 4, 10, 15, 20, 25]
      },
      ranks: {
        "36": { mode: "fixed", value: "Dread Master Raptus" },
        "30": { mode: "fixed", value: "Dread Master Tyrans" },
        "25": { mode: "fixed", value: "Dread Master Styrak" },
        "20": { mode: "fixed", value: "Dread Master Calphayus" },
        "15": { mode: "fixed", value: "Dread Master Brontes" },
        "10": { mode: "fixed", value: "Dread Master Bestia" },
        "4": { mode: "prefix", value: "Dread Captain" },
        "3": { mode: "prefix", value: "Dread Guard" },
        "2": { mode: "prefix", value: "Dread Host" }
      }
    }
  }
};
