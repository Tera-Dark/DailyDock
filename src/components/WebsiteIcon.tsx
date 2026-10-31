import { useEffect, useState } from "react";
import { safeUrl } from "../model";
import { extensionMode } from "../storage";

/** Fetch the site's conventional favicon directly; no third-party icon service. */
export function WebsiteIcon({ url, title }: { url: string; title: string }) {
  const valid = safeUrl(url);
  let origin = "";
  let local = "";
  try {
    const parsed = new URL(valid);
    origin = parsed.origin;
    const icons: Record<string, string> = {
      "x666.me": "x666.ico",
      "linux.do": "linux-do.svg",
      "api.kunyou.asia": "kunyou.jpg",
      "anyrouter.top": "anyrouter.ico",
    };
    const file = icons[parsed.hostname];
    if (file) local = (extensionMode ? "icons/" : "extension/icons/") + file;
  } catch {}
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [origin, local]);
  const source = local || (origin ? `${origin}/favicon.ico` : "");
  return (
    <span className="website-icon" aria-hidden="true">
      {source && !failed ? (
        <img
          src={source}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        title.trim().charAt(0).toUpperCase() || "网"
      )}
    </span>
  );
}
