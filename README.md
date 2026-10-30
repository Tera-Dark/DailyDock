# DailyDock

**把每日签到与小事，安静地放在浏览器里。**

DailyDock 是一个纯本地、零后端、零 AI、零月费的 Chrome / Edge Manifest V3 浏览器扩展。小弹窗快速签到，独立管理页处理重复任务、提醒和数据备份。

## 功能（V0.2）

- 浏览器工具栏弹窗：今日进度、未完成事项、网址直达、回车快速添加每日任务
- 管理页面：**今天 / 全部任务 / 网站签到 / 偏好与数据**，搜索、完成状态筛选
- 周期：每天、每周指定星期、单次日期；历史完成记录按天存储
- 任务字段：名称、类别、时间、网址（仅 http/https）、浏览器提醒
- 提醒：`chrome.alarms` + 系统通知，支持通知中「10 分钟后提醒」及打开管理页；工具栏 badge 展示待完成数量
- 外观：遵循仓库指定的 GPT-inspired UI Skill，自定义语义变量、系统/浅色/深色主题、键盘焦点及减少动画支持
- 隐私：`chrome.storage.local`；不访问签到站内容、不抓取 Cookie、不读取密码、不发送任务到服务器
- JSON 备份：导入、导出，兼容 V0.1 数据格式

## 免费安装（开发者模式）

1. 下载或克隆本仓库。
2. 打开 Chrome `chrome://extensions`，或 Edge `edge://extensions`。
3. 启用开发者模式，点击「加载已解压的扩展程序」。
4. **选择 `extension/` 目录**（该目录内有 `manifest.json`）。
5. 固定工具栏图标，点击即可使用；右上角设置图标打开完整管理页面。

> 无需安装 Node、无 npm 依赖、无账号。更新代码后可在扩展管理页点击「重新加载」，然后重新打开管理页。

## 使用说明

**快捷新增**：在弹窗或「今天」管理页输入一项内容，回车直接建立**每日重复**任务。其他重复方式、提醒和网址在「新建任务」/编辑界面设定。

**手动签到**：添加网址后出现「打开」按钮，在目标站签到后回到 DailyDock 自己勾选；**打开网站不代表签到成功**。

**单次事项**：不设日期可立即出现在「今天」，设定未来日期则到那天才出现在今日清单；未完成的单次事项继续保留为待办。

**浏览器提醒**：只有任务启用「到点发送浏览器通知」并设置时间，浏览器运行时才会调度本地通知。Chrome / Edge 通知也需要系统允许。提醒可能因休眠、设备关机或关闭浏览器而延迟/错过；不能替代严格可靠的系统闹钟。

**数据备份**：在「偏好与数据」导出 JSON。卸载扩展、切换浏览器配置文件或清理扩展存储可能丢失任务。导入前务必导出旧数据，因为导入会覆盖当前清单。

## 项目结构

```text
extension/
  manifest.json       Manifest V3
  popup.html          便捷清单
  options.html        独立管理网页
  app.js              共用 UI / 任务逻辑
  style.css           语义 Design Tokens + 响应式样式
  background.js       通知、徽标与定时调度
  icon.png, icon.svg  扩展图标资源
tests/
  smoke.mjs           零依赖 Node 冒烟测试
docs/
  UI-UX-REVIEW.md     设计标准和验收清单
```

## 开发与检查

安装 Node.js 18+ 后执行：

```bash
node tests/smoke.mjs
```

该命令覆盖周期任务、单次完成、网址协议过滤、主界面结构、导入规范、角标与稍后提醒保留。它不是浏览器端到端测试；实际通知、外观、宽度、权限、系统托盘/状态必须在 Chrome/Edge 真机验证。

## 设计依据

- [用户自有 ChatGPT-Inspired UI Skill](https://github.com/Tera-Dark/personal-agent-skills/tree/main/02_design/chatgpt-inspired-ui)
- [审查与验收记录](docs/UI-UX-REVIEW.md)

这是**受启发的原创 UI**，并非 OpenAI 官方 UI，也不使用 OpenAI 标识和字体。
