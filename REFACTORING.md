# v1 → v2 重构说明

本文档记录从 v1（原生 JS、单文件主进程）到 v2（TypeScript、模块化、产品级设施）的全部架构决策与行为变化。

## 重构目标

功能与 v1 对齐的前提下，解决五类问题：数据双写分裂、业务与 UI 耦合、IPC 无校验、零工程化设施、若干隐性 bug。

## 一、数据层：消除三套真相源

v1 的任务数据同时写三个地方：electron-store（全量 JSON 覆盖）、SQLite task_history（统计用副本）、localStorage（渲染层兜底），靠渲染进程手动同步，任一环节失败即不一致。

v2 改为：**SQLite 是任务的唯一真相源**（active/completed/deleted 全生命周期一张 `tasks` 表），electron-store 只存设置、窗口位置、游戏状态这类轻量配置，localStorage 兜底删除。渲染进程只持有只读缓存，所有写操作通过 IPC 落库后生效。

配套设施：

- **schema 版本化迁移**（`schema_version` 表），首次启动自动把 v1 的 `task_history` 表和 electron-store 里的任务导入新表，旧表重命名保留。
- **损坏自动恢复**：启动时跑 `integrity_check`，失败则把损坏文件备份为 `*.corrupt-<ts>` 后重建；electron-store 开启 `clearInvalidConfig`。
- **统计查询修复 N+1**：v1 的 7 日趋势循环发 14 条 SQL，24 小时分布全表捞取后逐行处理；v2 各用一次范围查询在内存聚合。

## 二、业务逻辑：抽离为纯函数

v1 的 XP 结算、连击判定、升级、成就检查散落在渲染层 779 行的上帝类中，无法测试。v2 全部抽到 `src/shared/game.ts` 和 `time.ts`，是无副作用的纯函数：

- `applyTaskCompletion(state, priority, settings, now)` → 一次返回新状态 + 所有 UI 事件（升级、成就、连击）
- `toggleTimer(task, now)` → 计时器状态机
- `resetTodayIfNeeded(state, today)` → 跨天重置

渲染层只负责调用纯函数、播放动效、通过 IPC 持久化。番茄钟与主应用解耦：v1 直接改 `app.gameState`，v2 通过 `PomodoroHost` 回调接口通知。

## 三、主进程：模块化 + 进程边界安全

v1 的 main.js 把窗口、托盘、设置、20 个平铺 IPC handler 混在 313 行里。v2 拆为 `windows/`、`tray.ts`、`ipc/register.ts`、`db/`、`logger.ts`、`settingsStore.ts`，入口只做组装。

安全改进：

- **IPC 全量校验**：通道名集中常量化（`shared/constants.ts`），每个 handler 入参经 `shared/validate.ts` 校验/净化——任务文本截断、优先级白名单、设置项白名单+数值钳制，渲染进程不再能往 store 写任意结构。
- **preload 最小暴露**：类型化 `RendererApi` 接口，渲染层拿不到 `ipcRenderer` 本体。
- **CSP**：两个 HTML 加 Content-Security-Policy；移除 Google Fonts 外部请求（离线可用 + 隐私）。
- **任务文本渲染改用 DOM API**（v1 经 escapeHtml + innerHTML，v2 直接 textContent，消除整个 XSS 风险面）。
- **新窗口请求一律拒绝**并转交系统浏览器；**单实例锁**避免双开写库冲突。

## 四、修复的 v1 缺陷

1. `mouse-enter` 不是 BrowserWindow 事件，该监听是死代码 → 删除。
2. `blurOpacity` 设置存了但主进程写死 0.55 → 失焦透明度真正生效。
3. `particleCount` 设置存了但渲染层写死 24 → 生效。
4. `alwaysOnTop` 设置与托盘勾选互不同步、重启丢失 → 统一从 store 读写。
5. 标签栏硬编码在 HTML，设置里的自定义标签不出现在浮窗 → 改为按设置动态渲染。
6. 折叠后展开恢复写死 560px，丢失用户调整的高度 → 记忆展开高度并持久化。
7. 任务 id 用 `Date.now+random` → `crypto.randomUUID()`。
8. 完成任务时若计时仍在运行，v1 落库的耗时不含最后一段活动时间 → v2 在 complete 时结算。
9. 粒子动画 rAF 永久循环（无粒子也在跑）→ 空闲时停止。
10. 数据库写失败被静默吞掉（`.catch(() => {})`）→ 统一上报 electron-log。

## 五、新增产品级设施

- **日志**：electron-log 写 `userData/logs`（5MB 滚动），主进程未捕获异常、渲染进程 error/unhandledrejection 全部入日志。
- **测试**：Vitest，54 个断言覆盖游戏结算、计时状态机、校验层、任务仓库（内存 SQLite）、统计聚合、v1 数据迁移。
- **CI**：GitHub Actions，macOS runner 跑 lint → typecheck → test → 未签名打包并上传 dmg artifact。
- **类型**：TypeScript strict，双 tsconfig（主进程 CJS / 渲染层 ESM bundler），共享类型经 `@shared` 别名引用。

## 行为差异说明（有意为之）

- 任务排序持久化为 `sort_order` 字段（v1 依赖数组顺序整体覆盖写）。
- 删除任务为软删除（v1 同样保留历史，行为一致，但 v2 不再有 store/SQLite 不一致窗口）。
- 设置窗口"AI 效率诊断"更名"效率诊断"（规则引擎，并非 AI，避免误导）。
- 看板/终端等 settings 页面的 `set` 命令仍可改任意白名单内设置，但越界数值会被主进程钳制。

## 已知待办（建议后续迭代）

- 代码签名与公证：需要 Apple Developer 账号，`electron-builder.yml` 已留好注释配置。
- 自动更新（electron-updater）：依赖签名，签名就绪后接入。
- 渲染层 E2E（Playwright + Electron）：当前覆盖到逻辑层，UI 交互依赖手工回归。
