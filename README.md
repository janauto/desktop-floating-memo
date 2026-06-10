# 浮窗备忘录 (Floating Memo) v2.0

桌面浮窗备忘录是一个基于 Electron 的 macOS 桌面效率工具：轻量任务清单、置顶透明浮窗、番茄时钟、任务计时、XP/等级/连击/成就的游戏化机制，以及数据看板，整合在一个毛玻璃悬浮窗中。

v2.0 是面向产品级的完整重构版本，功能与 v1 对齐，工程质量全面升级。重构细节见 [REFACTORING.md](./REFACTORING.md)。

## 技术栈

TypeScript（strict 模式）、electron-vite 构建、原生 DOM 渲染（无 UI 框架）、better-sqlite3（任务唯一真相源）、electron-store（设置与窗口状态）、electron-log（日志）、Vitest（单元测试）、GitHub Actions（CI）。

## 快速开始

要求：Node.js ≥ 20，macOS。

```bash
npm install        # 自动 rebuild better-sqlite3 原生模块
npm run dev        # 开发模式（热更新）
```

## 常用命令

```bash
npm test           # 单元测试（游戏逻辑 / 数据层 / 校验层）
                   # 注：pretest 会把 better-sqlite3 重编译为 Node ABI；
                   # predev/predist 会自动切回 Electron ABI，无需手动处理
npm run typecheck  # 双 tsconfig 类型检查（主进程 + 渲染层）
npm run lint       # ESLint
npm run dist       # 打包 dmg（未签名，本机使用）
```

## 目录结构

```text
src/
├── shared/            # 跨进程共享：类型、常量、纯业务逻辑（可测试）
│   ├── types.ts       # 全部领域类型 + RendererApi 接口
│   ├── constants.ts   # 默认设置、IPC 通道名
│   ├── game.ts        # XP / 连击 / 升级 / 成就结算（纯函数）
│   ├── time.ts        # 计时器逻辑与格式化（纯函数）
│   ├── validate.ts    # IPC 入参校验与净化
│   └── quotes.ts      # 语录库
├── main/              # 主进程
│   ├── index.ts       # 入口：组装模块、生命周期、单实例锁
│   ├── logger.ts      # electron-log + 未捕获异常
│   ├── settingsStore.ts
│   ├── tray.ts
│   ├── db/            # SQLite：连接/迁移/损坏恢复、任务仓库、统计仓库
│   ├── windows/       # 主浮窗、设置窗口管理器
│   └── ipc/           # IPC 注册中心（带参数校验）
├── preload/           # contextBridge 类型化 API
└── renderer/          # 渲染层（原生 DOM + TS）
    ├── index.html / settings.html
    ├── assets/        # 样式（继承 v1 视觉）
    └── src/
        ├── main-window/   # 浮窗：编排器、粒子、番茄钟、时钟、语录
        └── settings/      # 控制中心：看板/全局/个性化/终端 四页
tests/                 # Vitest 单元与集成测试
.github/workflows/     # CI：lint + typecheck + test + 打包
```

## 数据存储

- 任务（含历史）：`~/Library/Application Support/floating-memo/memo_history.db`（SQLite，WAL 模式）
- 设置 / 窗口位置 / 游戏状态：同目录 `config.json`（electron-store）
- 日志：同目录 `logs/`

从 v1 升级时，首次启动会自动把旧 `task_history` 表和 electron-store 中的任务迁入新表，无需手动处理。数据库损坏时会自动备份为 `*.corrupt-<时间戳>` 并重建，应用不会无法启动。

## 发布签名（可选）

`npm run dist` 产出的 dmg 未签名，仅适合本机或内部使用。对外分发需要 Apple Developer 证书，在 `electron-builder.yml` 中取消注释 `identity`/`hardenedRuntime`/`notarize` 并配置环境变量（`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`）。

## License

MIT
