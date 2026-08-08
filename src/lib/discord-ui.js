// Shared Discord V2 Components for Web to Discord API calls

export function componentsV2Message(containers) {
  return {
    flags: 32768,
    components: containers,
    allowedMentions: { parse: [] }
  };
}

export function containerV2(components, color = 0xc90705) {
  return {
    type: 17,
    accent_color: color,
    components: components.flat()
  };
}

export function sectionV2(thumbnailUrl, components) {
  if (!thumbnailUrl) return components;

  return {
    type: 9,
    accessory: {
      type: 11,
      media: { url: thumbnailUrl }
    },
    components
  };
}

export function textDisplayV2(content) {
  return {
    type: 10,
    content
  };
}

export function separatorV2() {
  return {
    type: 14,
    divider: true,
    spacing: 1
  };
}
