export default {
  discord: {
    clientId: "DISCORD_CLIENT_ID",
    guildId: "1046437795465539604"
  },
  holonet: {
    baseUrl: "https://holonet.vercel.app"
  },
  theme: {
    color: 0xff3348,
    errorColor: 0x8f1d2c,
    successColor: 0x35c46f
  },
  channels: {
    activityLog: "1455303713701757138",
    verificationLog: "1522314604796051487",
    announcements: {
      holonet: "CHANNEL_ID",
      reavers: "CHANNEL_ID",
      dhg: "CHANNEL_ID",
      inquisitors: "CHANNEL_ID",
      dreadmasters: "CHANNEL_ID",
      highranks: "CHANNEL_ID",
      darkCouncil: "CHANNEL_ID"
    }
  },
  cheekyResponder: {
    enabled: false,
    channelId: "1406487804413739059",
    chance: 1 / 2000,
    cooldownMs: 4 * 60 * 60 * 1000,
    phrases: [
      "Speak.",
      "Summarize this.",
      "No.",
      "Yes."
    ]
  },
  scopes: {
    priority: ["darkCouncil", "reavers", "dhg", "inquisitors", "dreadmasters", "highranks"],
    divisionOrder: ["reavers", "dhg", "inquisitors", "dreadmasters"]
  },
  nicknames: {
    enabled: true,
    priority: ["DIVISIONS", "HIGH_RANKS", "DARK_COUNCIL"],
    managed: {
      DARK_COUNCIL: {
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
      HIGH_RANKS: {
        ranks: {
          "53": { mode: "prefix", value: "Darth" },
          "50": { mode: "prefix", value: "Sith Lord" },
          "45": { mode: "prefix", value: "Sith Master" },
          "44": { mode: "prefix", value: "Sith Overseer" },
          "42": { mode: "prefix", value: "Shadow Guard" },
          "35": { mode: "prefix", value: "Sith Seer" },
          "34": { mode: "prefix", value: "Sith Marauder" },
          "33": { mode: "prefix", value: "Sith Sorcerer" },
          "32": { mode: "prefix", value: "Sith Warrior" },
          "29": { mode: "prefix", value: "Sith Adept" },
          "27": { mode: "prefix", value: "Sith Apprentice" },
          "26": { mode: "prefix", value: "Sith Prospect" },
          "25": { mode: "prefix", value: "Acolyte" },
          "24": { mode: "prefix", value: "Initiate" },
          "23": { mode: "prefix", value: "Academy Student" },
          "20": { mode: "prefix", value: "Neophyte" },
          "15": { mode: "prefix", value: "Hopeful" },
          "2": { mode: "prefix", value: "Tyro" },
          "1": { mode: "prefix", value: "Grotthu" },
        }
      },
      DIVISIONS: {
        reavers: {
          ranks: {
            "200": { mode: "prefix", value: "Reaver Commander" },
            "15": { mode: "prefix", value: "Reaver Lord" },
            "10": { mode: "prefix", value: "Senior Reaver" },
            "5": { mode: "prefix", value: "Reaver" },
            "1": { mode: "prefix", value: "Reaver Initiate" }
          }
        },
        dhg: {
          ranks: {
            "100": { mode: "prefix", value: "Guard Commander" },
            "90": { mode: "prefix", value: "Guard Captain" },
            "80": { mode: "prefix", value: "Guard Lieutenant" },
            "60": { mode: "prefix", value: "Senior Guard" },
            "50": { mode: "prefix", value: "Guardsman" },
            "30": { mode: "prefix", value: "Guard Initiate" }
          }
        },
        inquisitors: {
          ranks: {
            "200": { mode: "prefix", value: "Grand Inquisitor" },
            "155": { mode: "prefix", value: "High Inquisitor" },
            "150": { mode: "prefix", value: "Senior Inquisitor" },
            "125": { mode: "prefix", value: "Inquisitor" },
            "100": { mode: "prefix", value: "Inquisitor Initiate" }
          }
        },
        dreadmasters: {
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
    }
  },
  roles: {
    verified: "1134203786328543392",
    managed: {
      DARK_COUNCIL: {
        ranks: {
          "255": ["1046451358515089449", "1046546991360004136"],
          "254": ["1302790774458552331", "1046546991360004136"],
          "253": ["1046451363384668320", "1046546991360004136"],
          "252": "1046546991360004136",
          "251": "1046546991360004136",
          "250": ["1109325343824826399", "1046546991360004136"],
          "100": ["1109325343824826399", "1046546991360004136"],
          "25": ["1109325343824826399", "1046546991360004136"],
          "20": ["1109325343824826399", "1046546991360004136"],
          "15": ["1109325343824826399", "1046546991360004136"],
          "30": "1172292778710028399",
          "40": "1172292778710028399",
          "45": "1172292778710028399",
          "150": "1109325113142288426",
          ranges: [
            { min: 1, max: 250, roles: ["1046451366488445018"] }
        ]
        },
      },
      HIGH_RANKS: {
        ranks: {
          "53": "1172292778710028399", 
          "50": "1134210796625346560",
          "45": "1134210771824414802",
          "44": "1134207491719319634",
          "42": "1046451377687244862",
          "35": "1134204399514812649",
          "34": "1134210593902051358",
          "33": "1134210728027488287",
          "32": "1134210576713777152",
          "29": "1134206028104351844",
          "27": "1134203963273642114",
          "26": "1134210556467879947",
          "25": "1134210545717874918",
          "24": "1046451397274640485",
          "23": "1134207247073951834",
          "20": "1134204266580561951",
          "15": "1134208296383946863",
          "2": "1134210490751516733",
          "1": "1134203793387560960",
        },
        ranges: [
          { min: 44, max: 53, roles: ["1134219014634229790", "1046546991360004136"] },
          { min: 27, max: 35, roles: ["1134219075980116059"] },
          { min: 1, max: 26, roles: ["1134219089238306886"]}
        ]
      },
      DIVISIONS: {
        reavers: {
          ranks: {
            "200": ["1140373874475814972", "1130513164807708793"],
          },
          ranges: [
            { min: 1, max: 200,roles: ["1046451382351314984", "1134214563013853215"] },
            { min: 10, max: 200,roles: ["1084912631367864320"] },
            { min: 15, max: 200, roles: ["1178128252183777382", "1046546991360004136"] }
          ]
        },
        dhg: { 
          ranks: { 
            "100": ["1140374126872240411", "1130513164807708793", "1134204341855727766", "1134204341855727766", "1134204341855727766", "1046546991360004136"], 
          },
          ranges: [
            { min: 1, max: 95, roles: ["1134204341855727766", "1134214563013853215"]},
            { min: 60, max: 90, roles: ["1134204341855727766"]},
            { min: 80, max: 90, roles: ["1134204341855727766", "1046546991360004136"]},
          ]
        },
        inquisitors: { 
          ranks: { 
            "200": ["1046550260601847938", "1130513164807708793"],
            "155": "1136046525483585597", 
          },
          ranges: [
            { min: 1, max: 200, roles: ["1046451376236003359", "1134214563013853215"]},
            { min: 150, max: 200, roles: ["1178132079230324866"]},
            { min: 155, max: 200, roles: ["1178132079230324866", "1046546991360004136"]},
          ]
          },
        dreadmasters: { 
          ranks: { 
            "36": ["1140373714102407291", "1130513164807708793", "1046546991360004136"],
            "30": "1229205096487714887", 
            "2": "1314621769314730114", 
          },
          ranges: [
            { min: 1, max: 36, roles: ["1455305201451008192", "1134214563013853215"]},
            { min: 10, max: 36, roles: ["1134206237668561027"]},
          ]
        }
      }
    }
  }
};
