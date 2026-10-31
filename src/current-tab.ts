import { safeUrl } from "./model";
/** Called only from the extension action popup after the user clicks to save. */
export async function readCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = safeUrl(tab?.url || "");
  if (!url) throw Error("当前页面无法添加，请打开 http 或 https 网站后重试。");
  return { url, title: (tab.title || new URL(url).hostname).slice(0, 160) };
}
