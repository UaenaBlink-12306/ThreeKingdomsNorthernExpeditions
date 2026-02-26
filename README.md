# 三国北伐：玩家友好指南（中文在前，英文在后）

本 README 先提供中文版本，再提供英文版本。

---

## 中文版

### 这是什么游戏

- 这是一个本地运行的单人策略游戏，背景是诸葛亮北伐。
- 你将作为蜀汉决策者，每回合做选择，处理前线与朝局压力。
- 长期目标是稳住陇右并推进关中。
- `Doom` 压力过高会导致局势崩坏。

### 开始前你需要知道

这个游戏实际上由两部分组成：

- 后端服务（负责游戏规则和状态）
- 前端页面（你在浏览器里看到的界面）

如果这两部分已经有人帮你启动好了，你只需要打开：

- `http://127.0.0.1:5173`

如果打不开，请联系项目维护者先启动服务。

### Windows 与 macOS：从零开始完整安装与启动

下面这部分是给第一次接触的人准备的，按顺序做就可以。

#### 第 0 步：准备软件

你需要先安装两样东西：

1. `Python 3.11+`
2. `Node.js 20 LTS+`（会自带 `npm`）

建议下载官方安装包：

- Python: `https://www.python.org/downloads/`
- Node.js: `https://nodejs.org/`

Windows 安装 Python 时请务必勾选：

- `Add Python to PATH`

#### 第 1 步：打开项目文件夹

项目根目录应包含：

- `backend/`
- `frontend/`
- `README.md`

#### 第 2 步：启动后端（Backend）

请开一个终端窗口（记作“终端 A”）。

Windows（PowerShell 或 CMD）：

```powershell
cd <你的项目路径>\ThreeKingdomsNorthernExpeditions-main\backend
python -m venv .venv
```

macOS（Terminal）：

```bash
cd /你的项目路径/ThreeKingdomsNorthernExpeditions-main/backend
python3 -m venv .venv
```

激活虚拟环境：

Windows PowerShell：

```powershell
.venv\Scripts\Activate.ps1
```

如果提示脚本权限错误（`running scripts is disabled`），先执行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

Windows CMD：

```cmd
.venv\Scripts\activate.bat
```

macOS：

```bash
source .venv/bin/activate
```

安装依赖并启动后端：

Windows / macOS：

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

可选：配置后端环境变量（AI 功能）

1. 在 `backend/` 目录里找到 `.env` 文件（已存在）。
2. 至少确认这些字段：
   - `DEEPSEEK_API_KEY=你的Key`
   - `DEEPSEEK_COURT_LIVE_LINES=1`
3. 如果你没有 DeepSeek Key，游戏主体仍可运行，但部分 AI 文本功能会降级/不可用。

然后启动后端：

```bash
python -m uvicorn app.main:app --reload --port 8000
```

看到类似 `Uvicorn running on http://127.0.0.1:8000` 就表示后端启动成功。

可在浏览器验证：

- `http://127.0.0.1:8000/health`

页面显示 `{"status":"ok"}` 代表后端正常。

#### 第 3 步：启动前端（Frontend）

再开一个终端窗口（记作“终端 B”）。

Windows：

```powershell
cd <你的项目路径>\ThreeKingdomsNorthernExpeditions-main\frontend
npm install
npm run dev
```

macOS：

```bash
cd /你的项目路径/ThreeKingdomsNorthernExpeditions-main/frontend
npm install
npm run dev
```

如果 Windows PowerShell 执行 `npm` 报脚本权限错误，可以用：

```powershell
cmd /c npm install
cmd /c npm run dev
```

看到类似 `Local: http://127.0.0.1:5173/` 就表示前端启动成功。

可选：确认前端 API 地址

1. 打开 `frontend/.env.local`
2. 确保存在这一行：
   - `VITE_API_BASE=http://127.0.0.1:8000/api`
3. 修改后需要重启前端（重新执行 `npm run dev`）。

在浏览器打开：

- `http://127.0.0.1:5173`

#### 第 4 步：检查前后端是否连通

如果页面能正常显示游戏界面，并且不是一直卡在“正在连接战局...”，就说明前后端连接正常。

#### 第 5 步：每天再次启动时怎么做

后续再次进入游戏，不需要重复安装依赖。通常只要：

1. 终端 A 进 `backend/`，激活虚拟环境后运行 `uvicorn`
2. 终端 B 进 `frontend/`，运行 `npm run dev`
3. 打开 `http://127.0.0.1:5173`

#### 常见安装/启动问题（Windows 与 macOS）

- `python` 或 `python3` 找不到：
  - Python 未安装或未加入 PATH。请重新安装并勾选 PATH。
- `npm` 找不到：
  - Node.js 未安装成功。重装 Node.js LTS。
- 前端页面打不开：
  - 检查终端 B 是否仍在运行，且显示 5173 端口。
- 页面一直“正在连接战局...”：
  - 检查终端 A 的后端是否仍在运行（8000 端口）。
- 8000 或 5173 端口被占用：
  - 先关闭占用程序，或改端口重新启动。
- macOS 安装某些依赖失败（编译工具缺失）：
  - 先执行 `xcode-select --install`，然后重试 `npm install`。

### 你在界面会看到什么

- `顶部栏`：当前战局核心信息
- `左侧固定栏`：目标与关键资源（始终可见）
- `地图区`：战线、路线、控制区变化
- `当前事件`：你这一刻要做的决策
- `回合战报`：本回合发生了什么、为什么发生
- `AI 军议台`：建议与复盘说明
- `朝堂缓冲区`：在特定条件下触发的政治博弈阶段

### 每回合怎么操作

1. 先看 `当前事件`。
2. 选择一个行动按钮。
3. 等状态提示更新。
4. 查看 `回合战报` 理解后果。
5. 进入下一回合，直到胜利或失败。

### 胜负条件

- 胜利：
  - 关中推进达到目标回合数，且
  - 陇右没有崩盘。
- 失败：
  - `Doom` 危机链压垮局势，或
  - 关键战略条件失守。

### 朝堂缓冲区（重点）

当政治压力上升时，游戏会进入 `朝堂缓冲区`。

当前版本特点：

- 不会像以前那样长时间“卡住”。
- 加载中会给出实时反馈文案。
- 重要人物仍可使用 AI 生成台词。
- 为了速度，AI 台词有每步上限，超时会立即回退到本地文本。

### 继续游戏与同步

- 当前会话保存在浏览器本地存储中。
- 你可以在控制区复制 `Game ID` 便于定位会话。
- 如果显示异常，可点击 `Refresh State`（刷新状态）。

### 快捷键

- `N`：新游戏
- `J`：推进回合（可用时）
- `H`：帮助

### 常见问题

- 一直显示“正在连接”：
  - 通常是后端没启动。
- 按钮是灰色不可点：
  - 可能正在处理中，或当前条件不满足。
- 响应变慢：
  - 先看加载状态提示；若长时间不恢复，点 `Refresh State`。
- 朝堂阶段有延迟：
  - 可能是 AI 请求短暂波动；系统会自动回退保障可继续。
- 页面空白：
  - 刷新浏览器标签页一次。

### AI 台词速度配置（给维护者）

可通过以下环境变量在“台词质量”和“响应速度”之间调节：

- `DEEPSEEK_COURT_LIVE_LINES`：是否启用朝堂 AI 台词
- `DEEPSEEK_COURT_IMPORTANT_NPCS`：允许使用 AI 台词的重要人物列表
- `DEEPSEEK_COURT_MAX_AI_LINES_PER_STEP`：每个朝堂决策步骤最多 AI 台词条数
- `DEEPSEEK_COURT_TIMEOUT_SECONDS`：单次调用超时时间（越小越快回退）
- `DEEPSEEK_COURT_SUPPORT_JUDGE_ENABLED`：是否启用 AI 支持度判分（通常关闭以提速）

当前推荐的快配思路：

- 开启 AI 台词
- 仅重要人物使用 AI
- 每步最多 1 条 AI 台词
- 短超时 + 自动回退

### 项目结构（简版）

- `backend/`：规则引擎、状态机、接口
- `frontend/`：界面与交互
- `backend/app/data/events.json`：剧情/事件图
- `backend/app/engine/`：核心游戏逻辑

---

## English Version

# Three Kingdoms: Northern Expedition (Player-Friendly Guide)

This game is a local single-player strategy experience inspired by Zhuge Liang's Northern Expeditions.

This README is written for people with **no coding background**.

## What This Game Is

- You play as Shu Han's decision maker.
- Every turn, you choose actions and react to battlefield and court politics.
- Your main long-term goal is to secure Guanzhong while keeping Longyou stable.
- If pressure (Doom) grows too high, your campaign can collapse.

## Before You Start

The game has two parts running in the background:

- a game server (backend)
- the game screen in your browser (frontend)

If someone already started both for you, just open:

- `http://127.0.0.1:5173`

If not, ask the project owner to start the backend and frontend first.

## Full Setup Guide for Windows and macOS (Step-by-Step)

This section is for first-time users. Follow it in order.

### Step 0: Install Required Software

You need:

1. `Python 3.11+`
2. `Node.js 20 LTS+` (includes `npm`)

Official downloads:

- Python: `https://www.python.org/downloads/`
- Node.js: `https://nodejs.org/`

On Windows, during Python installation, make sure to enable:

- `Add Python to PATH`

### Step 1: Open the Project Folder

Your project root should contain:

- `backend/`
- `frontend/`
- `README.md`

### Step 2: Start Backend

Open one terminal window (Terminal A).

Windows (PowerShell or CMD):

```powershell
cd <your-path>\ThreeKingdomsNorthernExpeditions-main\backend
python -m venv .venv
```

macOS (Terminal):

```bash
cd /your-path/ThreeKingdomsNorthernExpeditions-main/backend
python3 -m venv .venv
```

Activate virtual environment:

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

If you get `running scripts is disabled`, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

Windows CMD:

```cmd
.venv\Scripts\activate.bat
```

macOS:

```bash
source .venv/bin/activate
```

Install dependencies and start backend:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Optional: configure backend environment (AI features)

1. In `backend/`, locate `.env` (already present).
2. At minimum, confirm:
   - `DEEPSEEK_API_KEY=your-key`
   - `DEEPSEEK_COURT_LIVE_LINES=1`
3. If no DeepSeek key is provided, the core game still runs, but some AI text features may be reduced/unavailable.

Then start backend:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

When you see `Uvicorn running on http://127.0.0.1:8000`, backend is ready.

Health check in browser:

- `http://127.0.0.1:8000/health`

You should see `{"status":"ok"}`.

### Step 3: Start Frontend

Open a second terminal window (Terminal B).

Windows:

```powershell
cd <your-path>\ThreeKingdomsNorthernExpeditions-main\frontend
npm install
npm run dev
```

macOS:

```bash
cd /your-path/ThreeKingdomsNorthernExpeditions-main/frontend
npm install
npm run dev
```

If PowerShell blocks `npm`, use:

```powershell
cmd /c npm install
cmd /c npm run dev
```

When you see `Local: http://127.0.0.1:5173/`, frontend is ready.

Optional: verify frontend API target

1. Open `frontend/.env.local`
2. Make sure this line exists:
   - `VITE_API_BASE=http://127.0.0.1:8000/api`
3. If changed, restart frontend (`npm run dev` again).

Open:

- `http://127.0.0.1:5173`

### Step 4: Confirm Frontend and Backend Are Connected

If the game screen loads and does not stay on "connecting", both services are working.

### Step 5: Daily Restart (Next Time)

You do not need to reinstall every day.

Usually:

1. Terminal A: enter `backend/`, activate `.venv`, run `uvicorn`
2. Terminal B: enter `frontend/`, run `npm run dev`
3. Open `http://127.0.0.1:5173`

### Common Setup Issues

- `python` or `python3` not found:
  - Python is not installed correctly or not in PATH.
- `npm` not found:
  - Node.js is not installed correctly.
- Frontend page will not open:
  - Terminal B is not running or not on port 5173.
- Page stuck on "connecting":
  - backend in Terminal A is not running.
- Port 8000 or 5173 already in use:
  - close the conflicting app or run on another port.
- macOS dependency build errors:
  - run `xcode-select --install`, then retry `npm install`.

## What You Will See On Screen

- `Top Header`: core status and current game context
- `Left Sidebar`: always-visible objectives and key resources
- `Map Panel`: campaign map, routes, and control changes
- `Current Event`: your immediate decision point
- `Turn Report`: what changed this turn and why
- `AI War Council`: advice and interpretation
- `Court Buffer` (appears when triggered): political negotiation phase

## How One Turn Works

1. Read `Current Event`.
2. Choose one action button.
3. Wait for the status line to update.
4. Read `Turn Report` to understand consequences.
5. Repeat until victory or defeat.

## Win and Lose Conditions

- Win:
  - Guanzhong progress reaches the target for enough turns, and
  - Longyou does not collapse.
- Lose:
  - Doom crisis chain overwhelms your state, or
  - core strategic conditions fail.

## Court Buffer (Important)

When major political pressure appears, the game enters `Court Buffer`.

What changed recently:

- It no longer feels stuck for long periods.
- The UI now gives live loading feedback while syncing.
- Important characters can still speak with AI-generated lines.
- To keep it fast, AI lines are limited per decision step and fall back instantly if needed.

## Save / Continue

- The game keeps your current session in browser local storage.
- You can copy the `Game ID` from the control panel for tracking.
- If something looks out of sync, use the `Refresh State` button in the UI.

## Keyboard Shortcuts

- `N`: New Game
- `J`: Next Turn (when available)
- `H`: Help

## If Something Looks Wrong

- Stuck on "connecting":
  - backend is probably not running.
- Buttons disabled:
  - the game is still processing, or that option is currently unavailable.
- Very slow response:
  - wait for the loading status text; if it does not recover, click `Refresh State`.
- Court phase feels delayed:
  - this is usually temporary network delay from AI calls; fallback should recover quickly.
- Blank page after refresh:
  - reload the browser tab once.

## AI Speech Speed Settings (For Maintainer)

These settings control quality vs speed for court dialogue:

- `DEEPSEEK_COURT_LIVE_LINES`
  - turn AI court lines on/off
- `DEEPSEEK_COURT_IMPORTANT_NPCS`
  - which characters are allowed to use AI lines
- `DEEPSEEK_COURT_MAX_AI_LINES_PER_STEP`
  - max AI lines per court decision step
- `DEEPSEEK_COURT_TIMEOUT_SECONDS`
  - per-call timeout (smaller is faster fallback)
- `DEEPSEEK_COURT_SUPPORT_JUDGE_ENABLED`
  - whether support-shift judging uses AI (usually off for speed)

Recommended fast setup currently used:

- live AI lines enabled
- only important NPCs use AI
- max 1 AI line per step
- short timeout with fallback

## Project Structure (Simple View)

- `backend/`: game rules, state machine, API
- `frontend/`: UI and interaction
- `backend/app/data/events.json`: story/event graph
- `backend/app/engine/`: core game logic

---

If you want, I can also provide a separate `README_player.md` and `README_maintainer.md` so players and developers each get a cleaner version.
