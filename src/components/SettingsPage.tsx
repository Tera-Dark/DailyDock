import { useEffect, useRef, useState } from "react";
import { type Settings } from "../model";
import { extensionMode } from "../storage";
import {
  permissionLabel,
  playSound,
  showReminder,
  unlockAudio,
} from "../reminders";
export function SettingsPage({
  settings,
  onSettings,
  onExport,
  onImport,
  onNotice,
}: {
  settings: Settings;
  onSettings: (s: Partial<Settings>) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onNotice: (message: string) => void;
}) {
  const [state, setState] = useState(permissionLabel()),
    [message, setMessage] = useState("测试不会创建任务。请检查设备音量。"),
    [pending, setPending] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <div className="settings-page">
      <section>
        <h2>外观</h2>
        <p>选择浅色、深色或跟随系统。</p>
        <div className="button-row">
          {(
            [
              ["system", "跟随系统"],
              ["light", "浅色"],
              ["dark", "深色"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={
                "button " + (settings.theme === value ? "primary" : "")
              }
              aria-pressed={settings.theme === value}
              onClick={() => onSettings({ theme: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>常用推荐</h2>
        <label className="suggestions-setting">
          <span>
            <b>在「今天」显示常用入口</b>
            <small>
              根据你在 DailyDock
              的使用次数、近期和大致时段排序；不读取浏览历史。
            </small>
          </span>
          <input
            type="checkbox"
            checked={settings.suggestionsEnabled !== false}
            onChange={(e) =>
              onSettings({ suggestionsEnabled: e.target.checked })
            }
          />
        </label>
      </section>
      <section className="settings-sheet">
        <span className="overline">REMINDERS</span>
        <h2>提醒与测试</h2>
        <p>
          {extensionMode
            ? "扩展使用系统通知及其通知音；试听音在当前页面播放。"
            : "保持页面打开，时间到了会提示；关闭页面或浏览器后不会提醒。"}
        </p>
        <p className="permission">{state}</p>
        <div className="button-row">
          {!extensionMode &&
            "Notification" in window &&
            Notification.permission !== "granted" && (
              <button
                className="button"
                onClick={async () => {
                  try {
                    await Notification.requestPermission();
                    setState(permissionLabel());
                  } catch {
                    setMessage("无法请求通知权限，请检查浏览器设置。");
                  }
                }}
              >
                开启桌面通知
              </button>
            )}
          <button
            className="button"
            onClick={async () => {
              const ok = await unlockAudio();
              setMessage(
                ok && playSound()
                  ? "已尝试播放提醒音，请检查音量。"
                  : "无法播放，请检查浏览器声音权限。",
              );
            }}
          >
            试听提醒音
          </button>
          <button
            className="button primary"
            disabled={pending}
            onClick={async () => {
              await unlockAudio();
              setPending(true);
              setMessage("测试已开始，10 秒后触发，请保持页面打开。");
              setTimeout(async () => {
                const result = await showReminder("这是一次提醒测试", true);
                const text = `测试已触发。${result.desktop ? "已发送桌面通知。" : "未发送桌面通知，请先开启通知权限。"}${result.sound ? " 已尝试播放提醒音。" : " 提醒音未能播放。"}`;
                onNotice("测试提醒：这是一次提醒测试");
                if (mounted.current) {
                  setMessage(text);
                  setPending(false);
                }
              }, 10000);
            }}
          >
            10 秒后测试提醒
          </button>
        </div>
        <p role="status">{message}</p>
      </section>
      <section>
        <h2>本地数据</h2>
        <p>数据保存在当前浏览器中。建议定期导出备份，导入会覆盖当前内容。</p>
        <div className="button-row">
          <button className="button" onClick={onExport}>
            导出 JSON
          </button>
          <button
            className="button"
            onClick={() => importInput.current?.click()}
          >
            导入 JSON
          </button>
          <input
            ref={importInput}
            tabIndex={-1}
            aria-label="选择 JSON 备份"
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) onImport(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </section>
    </div>
  );
}
