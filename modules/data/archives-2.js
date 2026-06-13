export const nodes = [
  {
    id: 'sith-code',
    label: 'The Sith Code',
    x: 0.5,
    y: 0.3,
    article: {
      title: 'The Sith Code',
      body: 'Peace is a lie. There is only passion. Through passion I gain strength...',
      link: null,
    },
  },
  {
    id: 'rule-of-two',
    label: 'Rule of Two',
    x: 0.3,
    y: 0.55,
    article: {
      title: 'The Rule of Two',
      body: 'One to embody the power, the other to crave it...',
      link: null,
    },
  },
  {
    id: 'dark-council',
    label: 'Dark Council',
    x: 0.7,
    y: 0.55,
    article: {
      title: 'The Dark Council',
      body: 'The governing body of the Sith Order, composed of the most powerful Lords...',
      link: '/codex/dark-council',
    },
  },
  {
    id: 'kaggath',
    label: 'Kaggath',
    x: 0.2,
    y: 0.75,
    article: {
      title: 'The Kaggath',
      body: 'An ancient Sith rite of challenge — a duel of power, resources, and will...',
      link: '/codex/kaggath',
    },
  },
  {
    id: 'hierarchy',
    label: 'Hierarchy',
    x: 0.5,
    y: 0.72,
    article: {
      title: 'The Sith Hierarchy',
      body: 'From Acolyte to Ancient One — the structure of power within the Order...',
      link: '/codex/hierarchy',
    },
  },
  {
    id: 'force-lightning',
    label: 'Force Lightning',
    x: 0.8,
    y: 0.75,
    article: {
      title: 'Force Lightning',
      body: 'A manifestation of pure dark side energy, channelled through the fingertips...',
      link: null,
    },
  },
]
export const edges = [
  ['sith-code', 'rule-of-two'],
  ['sith-code', 'dark-council'],
  ['sith-code', 'hierarchy'],
  ['rule-of-two', 'kaggath'],
  ['hierarchy', 'kaggath'],
  ['hierarchy', 'force-lightning'],
  ['dark-council', 'force-lightning'],
]