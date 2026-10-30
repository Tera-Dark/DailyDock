# DailyDock

零成本、无账号、无后端的每日签到与待办管理。

## V0.1 产品定位

- **Chrome / Edge MV3 扩展**：浏览器启动后定时提醒，点击扩展图标快速查看与勾选今日事项。
- **完整管理网页**：扩展内置的 `options.html` 作为独立管理页面，添加、编辑、删除、分类、排序无需服务器。
- **本地数据**：使用 `chrome.storage.local`，扩展弹窗、管理页面及后台提醒共享同一份数据；不涉及跨设备同步。
- **重复方式**：每天、指定星期、单次任务；网站签到可附网址，一键打开。
- **备份**：JSON 导入与导出。不上传任何数据。
- **提醒**：由浏览器的 `chrome.alarms` 调度，浏览器运行时通知；关闭浏览器或设备关机时**无法保证准时提醒**，重新启动后恢复调度。
- 无 AI、无 API Key、无服务器、无埋点。

## 安装

1. 下载仓库 ZIP 并解压。
2. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
3. 开启开发者模式，选择“加载已解压的扩展程序”，指向本仓库 `extension` 文件夹。
4. 点击工具栏 DailyDock 图标，点“管理任务”打开完整页面。
5. 授予系统通知权限，确保 Chrome/Edge 及系统通知未被屏蔽。

## 数据和提醒说明

此版本将所有任务存于当前浏览器配置文件的扩展本地存储；卸载扩展或清理其存储可能导致数据丢失，务必定期导出 JSON。扩展并不读取或控制签到网站，不保存 Cookie、密码，也不冒充已签到；仅由用户确认完成。浏览器扩展的权限仅包含 `storage`、`alarms`、`notifications`，无网站访问权限。

Chrome/Edge 可能因休眠、系统节能或浏览器关闭推迟通知；重要医疗、安全或财务提醒应另使用系统日历/闹钟作为保障。

## 文件结构

- `extension/manifest.json` 浏览器扩展元数据
- `extension/background.js` 提醒调度和通知处理
- `extension/popup.html` 快捷清单
- `extension/options.html` 完整任务管理页
- `extension/app.js` 两个页面共用的任务逻辑
- `extension/style.css` 共用视觉样式

## 开发

纯 HTML/CSS/JS，无依赖，无构建步骤。采用 Manifest V3，Chrome/Edge 安装即可运行。
