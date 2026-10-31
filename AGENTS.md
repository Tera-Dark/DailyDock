# 项目协作约定

- 使用 React / TypeScript / Vite；`src/` 是当前前端源码，`extension/app.js` 与 `extension/style.css` 是保留的旧版实现。
- 网页与扩展共享 `extension/build/` 构建产物；源码检出后先运行 `npm ci` 和 `npm run build`。扩展更新后需在浏览器扩展管理页重新加载。
- 网页和扩展分别使用各自的 localStorage / chrome.storage.local；保留现有存储键、任务字段和备份兼容性，不清理用户数据。
- 修改提醒逻辑时同时检查 `src/reminders.ts` 和 `extension/background.js`；网页版关闭页面后不保证提醒。
- 网站图标优先内置资源，否则直接请求对应站点的 favicon，失败回退名称首字母；不得静默引入第三方图标服务或浏览器历史读取。
- 完成修改后运行 `npm run check`；实际浏览器、扩展系统通知及触屏未验证时如实说明。更多使用和验证说明见 `README.md` 与 `docs/UI-UX-REVIEW.md`。
