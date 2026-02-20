# 诸葛亮北伐：夺取关中与陇右（MVP）

前后端分离本地可运行策略游戏。

- 后端：FastAPI（状态机 + 事件图引擎）
- 前端：React + Vite + TypeScript（只负责渲染和交互）
- 地图：Leaflet + OSM + React-Leaflet（含 ant-path、方向箭头、行军特效）
- 存档：支持内存 `dict` 与 SQLite（可通过环境变量切换）

## 1. 功能闭环

- 新开局 -> 多回合决策 -> 事件触发 -> 状态更新 -> 终局
- 终局只有两个：
  - `WIN`
  - `DEFEAT_SHU`
- 除蜀亡外，所有局部失败都 Fail Forward 到 `recover/court/defense`
- 五丈原阶段每回合健康衰减；`post_zhuge_era` 只触发一次

## 2. 目录

```text
backend/
  requirements.txt
  app/
    main.py
    api/routes.py
    models/
    engine/
    data/events.json
  tests/

frontend/
  package.json
  vite.config.ts
  src/

README.md
```

## 3. 启动方式

## 3.1 后端

在终端 A：

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 仓储后端切换（内存 / SQLite）

后端默认使用内存仓储；可通过环境变量切换到 SQLite 持久化：

```bash
cd backend
REPOSITORY_BACKEND=sqlite SQLITE_PATH=./data/game_sessions.db python -m uvicorn app.main:app --reload --port 8000
```

- `REPOSITORY_BACKEND=inmemory|sqlite`（默认 `inmemory`）
- `SQLITE_PATH` 仅在 `sqlite` 模式下生效（默认 `backend/data/game_sessions.db`）
- SQLite 模式会在启动时自动初始化 `sessions` 表（`CREATE TABLE IF NOT EXISTS`），无需手工迁移。

健康检查：`http://127.0.0.1:8000/health`

## 3.2 前端

在终端 B：

```bash
cd frontend
npm install
npm run dev
```

打开：`http://localhost:5173`

> 注意：当前机器若没有 Node.js / npm，请先安装再运行前端。建议 Node.js 20+。

如果你拉取了新代码（尤其是地图/VFX依赖变更），请先重新安装前端依赖：

```bash
cd frontend
npm install
```

可选检查（确认地图依赖已装）：

```bash
npm ls leaflet react-leaflet leaflet-ant-path leaflet-polylinedecorator
```

### 前端常见问题

#### 报错：`Failed to resolve import "leaflet/dist/leaflet.css"`

原因：`leaflet` 依赖未正确安装（`node_modules/leaflet` 缺失）。

修复步骤：

```bash
cd frontend
npm install
npm run dev
```

若仍失败，执行干净重装：

```bash
cd frontend
# Windows CMD
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

## 4. 玩法说明（快速）

### 4.1 30 秒看懂胜负目标

- 顶部新增 **ObjectiveStrip（目标条）**，固定显示：
  - 主目标：关中稳固 `guanzhong_turns / 3`（陇右必须稳定）
  - 陇右状态：稳定 ✅ / 崩盘 ❌（崩盘即无法胜利）
  - Doom 压力：`doom / 12`（`>= 10` 时高亮预警）
- 详细胜负规则保留在“胜负判定（详细）”面板中。

### 4.2 每回合操作顺序（推荐）

1. 点击 `新游戏`
2. 看“当前事件”顶部 **行动提示（Action Prompt）**：
   - 有选项：`你现在要做：选择一个行动（n）`
   - 无选项：`你现在要做：推进回合（触发被动变化）`
3. 仅在事件面板使用主按钮 `继续下一回合`（避免重复 CTA）
4. 在右侧先看“本回合变化 + Because + 下一步”，再看战报细节
5. 地图会随剧情节点切换：路线流动、军标行进、控制区变化、检定冲击特效
6. 达成条件后弹出终局弹窗：`WIN` 或 `DEFEAT_SHU`

### 4.3 战报与摘要阅读方式

- TurnSummary 默认只展示前 5 条变化，可按需展开。
- 新增一行 **Because**（说明“为什么变化”）和 **下一步**（建议动作）。
- 日志面板默认切到 **本回合战报（新增）**，只看本回合 delta，减少跨回合重复阅读。
- 可切换到 **最近战报（历史）**；默认隐藏 `FX_` 原始 token，可手动打开。

### 4.4 降低重复文本

- 事件面板中的长说明改为“一次性提示”（`localStorage` 记忆已读）。
- 首回合有 3 行微引导，关闭后不再反复出现。
- 日志压缩支持近似重复归并（不仅仅是相邻完全相同文本）。

## 5. API

- `POST /api/new_game`
  - body: `{ "game_id"?: string, "seed"?: int }`
- `GET /api/state?game_id=xxx`
- `POST /api/act`
  - body: `{ "game_id": string, "action": string, "payload"?: any }`
  - 主要 action：
    - `choose_option` + `payload.option_id`
    - `next_turn`
    - `recover_choice/court_choice/defense_choice`（后端映射到 `choose_option`）
- `POST /api/reset`

## 6. 测试

在仓库根目录执行：

```bash
python -m pytest backend/tests -q
```

包含：

- `validate_graph`：图结构合法性、缓冲区可进可出、终局可达
- `simulate`：`n=2000` 随机策略仿真，无死锁、胜率窗口断言

前端单测（Vitest）在 `frontend/tests`：

```bash
cd frontend
npm test
```

当前包含的前端纯函数测试：

- `logDelta.test.ts`：本回合日志增量计算（前缀命中 / overlap 回退 / fail-safe）
- `explain.test.ts`：Because/下一步规则生成与 Doom 预警
- `log.test.ts`：日志解析分类与近似重复压缩

## 6.1 内容改动前本地校验（剧情生产规范）

每次修改 `backend/app/data/events.json`（新增节点、改分支、改 route）前，先在仓库根目录执行：

```bash
python backend/scripts/validate_events.py backend/app/data/events.json
```

校验分两步：

1. **JSON Schema 结构校验**：检查字段缺失、类型错误、节点结构与 `node_type` 约束不匹配；
2. **语义校验（validate_graph）**：检查可达性、缓冲区（recover/court/defense）进出边、route 与 location 合法性。

若报错会给出字段路径、节点 id 与修复建议。请确保本地校验通过后再提交内容变更。

## 7. 调参与扩展

- 数值集中在：`backend/app/engine/balance.py`
- 事件图在：`backend/app/data/events.json`
- 仓储接口在：`backend/app/engine/repository.py`
- SQLite 实现在：`backend/app/engine/repository_sqlite.py`
- 本地调试 SQLite：
  ```bash
  cd backend
  REPOSITORY_BACKEND=sqlite SQLITE_PATH=./data/dev_sessions.db python -m pytest tests/test_repository_sqlite.py -q
  ```
