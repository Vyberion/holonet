import { ephemeral, errorEmbed } from "./discord-ui.js";

const MISSING_PERMISSIONS_CODE = 50013;
const CHANNEL_MESSAGE_PERMISSIONS = ["ViewChannel", "SendMessages", "EmbedLinks"];
const MESSAGE_EDIT_PERMISSIONS = ["ViewChannel", "SendMessages", "EmbedLinks", "ReadMessageHistory"];
const ROLE_SYNC_PERMISSIONS = ["ManageRoles"];
const NICKNAME_PERMISSIONS = ["ManageNicknames"];
const GUILD_PERMISSION_NAMES = new Set(["Administrator", "ManageGuild", "ManageRoles", "ManageNicknames"]);

const PERMISSION_LABELS = {
  AddReactions: "Add Reactions",
  Administrator: "Administrator",
  AttachFiles: "Attach Files",
  EmbedLinks: "Embed Links",
  ManageGuild: "Manage Server",
  ManageMessages: "Manage Messages",
  ManageNicknames: "Manage Nicknames",
  ManageRoles: "Manage Roles",
  MentionEveryone: "Mention Everyone",
  ReadMessageHistory: "Read Message History",
  SendMessages: "Send Messages",
  UseExternalEmojis: "Use External Emojis",
  ViewChannel: "View Channel"
};
const KNOWN_PERMISSION_NAMES = new Set(Object.keys(PERMISSION_LABELS));
const PERMISSION_BITS = new Map([
  [8n, "Administrator"],
  [32n, "ManageGuild"],
  [64n, "AddReactions"],
  [1024n, "ViewChannel"],
  [2048n, "SendMessages"],
  [8192n, "ManageMessages"],
  [16384n, "EmbedLinks"],
  [32768n, "AttachFiles"],
  [65536n, "ReadMessageHistory"],
  [131072n, "MentionEveryone"],
  [262144n, "UseExternalEmojis"],
  [134217728n, "ManageNicknames"],
  [268435456n, "ManageRoles"]
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function maybeBigInt(value) {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function permissionName(value) {
  if (typeof value === "string") {
    const compact = value.replace(/\s+/g, "");
    if (/^\d+$/.test(compact)) {
      const bit = maybeBigInt(compact);
      if (PERMISSION_BITS.has(bit)) return PERMISSION_BITS.get(bit);
    }
    return KNOWN_PERMISSION_NAMES.has(compact) ? compact : value;
  }

  const bit = typeof value === "bigint" ? value : maybeBigInt(value);
  if (bit !== null && PERMISSION_BITS.has(bit)) return PERMISSION_BITS.get(bit);

  return String(value || "");
}

function permissionLabel(value) {
  const name = permissionName(value);
  return PERMISSION_LABELS[name] || name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function permissionLabels(values) {
  return unique((values || []).map(permissionName)).map(permissionLabel);
}

function errorCode(error) {
  return error?.code ?? error?.rawError?.code ?? error?.cause?.code;
}

export function isMissingPermissionsError(error) {
  return Boolean(
    error?.missingPermissions?.length ||
    errorCode(error) === MISSING_PERMISSIONS_CODE ||
    errorCode(error) === "MISSING_BOT_PERMISSIONS" ||
    /missing permissions/i.test(String(error?.message || error?.rawError?.message || ""))
  );
}

export function missingBotPermissionsError(permissions) {
  const error = new Error("MISSING_BOT_PERMISSIONS");
  error.code = "MISSING_BOT_PERMISSIONS";
  error.missingPermissions = unique((permissions || []).map(permissionName));
  return error;
}

export function roleManagementBlockedError(blockedRoles) {
  const error = new Error("ROLE_MANAGEMENT_BLOCKED");
  error.code = "ROLE_MANAGEMENT_BLOCKED";
  error.blockedRoles = blockedRoles || [];
  return error;
}

function permissionsFromError(error) {
  const array = value => Array.isArray(value) ? value : value ? [value] : [];
  return unique([
    ...array(error?.missingPermissions),
    ...array(error?.missing),
    ...array(error?.permissions),
    ...array(error?.requiredPermissions)
  ].map(permissionName));
}

function routeUrl(error) {
  return String(error?.url || error?.requestData?.url || error?.request?.path || "");
}

function routeMethod(error) {
  return String(error?.method || error?.requestData?.method || "").toUpperCase();
}

function inferPermissionsFromError(error) {
  const url = routeUrl(error);
  const method = routeMethod(error);
  const inferred = [];

  if (/\/guilds\/\d+\/members\/\d+\/roles\//.test(url)) inferred.push(...ROLE_SYNC_PERMISSIONS);
  else if (/\/guilds\/\d+\/members\/\d+/.test(url)) inferred.push(...ROLE_SYNC_PERMISSIONS, ...NICKNAME_PERMISSIONS);

  if (/\/channels\/\d+\/messages/.test(url)) {
    inferred.push(...(method === "PATCH" ? MESSAGE_EDIT_PERMISSIONS : CHANNEL_MESSAGE_PERMISSIONS));
  }

  return unique(inferred);
}

function inferPermissionsFromInteraction(interaction) {
  const commandName = interaction?.commandName || "";
  const customId = String(interaction?.customId || "");

  if (["getroles", "update-roles"].includes(commandName) || customId === "verify:update") {
    return ROLE_SYNC_PERMISSIONS;
  }

  if (["verification", "clockpanel", "echo"].includes(commandName)) {
    return CHANNEL_MESSAGE_PERMISSIONS;
  }

  if (customId.startsWith("clock:") || customId.startsWith("viewtime:") || customId.startsWith("rpt")) {
    return MESSAGE_EDIT_PERMISSIONS;
  }

  return [];
}

function missingFromPermissions(source, requiredPermissions) {
  if (!source?.missing) return [];
  try {
    return source.missing(requiredPermissions).map(permissionName);
  } catch {
    return [];
  }
}

function botChannelPermissions(interaction) {
  if (interaction?.appPermissions) return interaction.appPermissions;
  const botMember = interaction?.guild?.members?.me;
  if (!botMember || !interaction?.channel?.permissionsFor) return null;
  return interaction.channel.permissionsFor(botMember);
}

function missingFromInteraction(interaction, requiredPermissions) {
  const guildPermissions = interaction?.guild?.members?.me?.permissions || null;
  const channelPermissions = botChannelPermissions(interaction);
  const missing = [];

  for (const permission of unique(requiredPermissions.map(permissionName))) {
    const source = GUILD_PERMISSION_NAMES.has(permission) ? guildPermissions : channelPermissions;
    missing.push(...missingFromPermissions(source, [permission]));
  }

  return unique(missing);
}

function requiredPermissionsFor(error, interaction) {
  return unique([
    ...permissionsFromError(error),
    ...inferPermissionsFromError(error),
    ...inferPermissionsFromInteraction(interaction)
  ]);
}

export function botErrorMessage(error, options = {}) {
  const fallback = options.fallback || "Unexpected bot error.";
  if (error?.code === "ROLE_MANAGEMENT_BLOCKED") {
    const blockedRoles = (error.blockedRoles || []).map(role => {
      const reason = role.managed
        ? "managed by an integration"
        : "not below the bot's highest role";
      return `${role.name || role.id} (${reason})`;
    });

    return blockedRoles.length
      ? `Discord denied role management for: ${blockedRoles.join(", ")}. Move the bot's highest role above those role(s), or remove integration-managed roles from the sync list.`
      : "Discord denied role management. Move the bot's highest role above the role(s) it needs to add/remove.";
  }

  if (!isMissingPermissionsError(error)) return error?.message || fallback;

  const required = requiredPermissionsFor(error, options.interaction);
  const exactMissing = missingFromInteraction(options.interaction, required);
  const labels = permissionLabels(exactMissing.length ? exactMissing : required);

  if (!labels.length) return "Discord reported missing bot permissions, but did not specify which permission was denied.";

  const hierarchyHint = labels.includes("Manage Roles") || labels.includes("Manage Nicknames")
    ? " The bot role may also need to be above the target role/member."
    : "";

  return `Missing bot permission(s): ${labels.join(", ")}.${hierarchyHint}`;
}

export function botErrorPayload(error, options = {}) {
  const message = botErrorMessage(error, options);
  if (isMissingPermissionsError(error)) return ephemeral({ content: message });
  return ephemeral({ embeds: [errorEmbed(message)] });
}
