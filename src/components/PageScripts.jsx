import { LegacyClientModules } from "./LegacyClientModules.jsx";

export function PageScripts({ scripts = [], moduleScripts = [], guarded = false }) {
  return <LegacyClientModules guarded={guarded} modules={[...scripts, ...moduleScripts]} />;
}
