"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DiscordSDK } from "@discord/embedded-app-sdk";

let discordSdkInstance = null;
let discordSdkAuthorized = false;

export function DiscordActivityProvider({ clientId }) {
  const pathname = usePathname();
  const [isActivity, setIsActivity] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const hostname = window.location.hostname;

    if (hostname.includes("discordsays.com")) {
      setIsActivity(true);

      if (!discordSdkInstance) {
        discordSdkInstance = new DiscordSDK(clientId);
        setupDiscordSdk().catch(console.error);
      }
    }
  }, [clientId]);

  async function setupDiscordSdk() {
    await discordSdkInstance.ready();

    let authResult;
    try {
      authResult = await discordSdkInstance.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify", "rpc.activities.write"]
      });
    } catch {
      authResult = await discordSdkInstance.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        scope: ["identify", "rpc.activities.write"]
      });
    }

    const { code } = authResult;

    try {
      const response = await fetch("/api/discord/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await response.json();

      if (data.access_token) {
        await discordSdkInstance.commands.authenticate({ access_token: data.access_token });
        discordSdkAuthorized = true;
        updateRichPresence(pathname);
      } else {
        console.error("Discord token exchange failed:", data);
      }
    } catch (err) {
      console.error("Failed to authenticate Discord SDK:", err);
    }
  }

  useEffect(() => {
    if (isActivity && discordSdkAuthorized) {
      updateRichPresence(pathname);
    }
  }, [pathname, isActivity]);

  async function updateRichPresence(path) {
    if (!discordSdkInstance || !discordSdkAuthorized) return;

    let pageName = "Holonet Terminal";

    if (path === "/") pageName = "Home";
    else if (path.startsWith("/codex")) pageName = "The Codex";
    else if (path.startsWith("/statutes")) pageName = "Statutes";
    else if (path.startsWith("/archives")) pageName = "The Archives";
    else if (path.startsWith("/hierarchy")) pageName = "The Hierarchy";
    else if (path.startsWith("/registry")) pageName = "The Registry";
    else if (path.startsWith("/powerbases")) pageName = "Powerbases";
    else if (path.startsWith("/account")) pageName = "Account Settings";

    try {
      await discordSdkInstance.commands.setActivity({
        activity: {
          type: 0,
          details: "Viewing the Holonet",
          state: `Reading ${pageName}`,
          assets: {
            large_image: "holo_pfp",
            large_text: "H.O.L.O"
          }
        }
      });
    } catch (err) {
      console.error("Failed to update rich presence:", err);
    }
  }

  return null;
}
