# AGENTS.md · 山峰频谱 MountainSpectrum

> 📌 **文档基线**：2026-09-21 · 山峰频谱 MountainSpectrum **v1.5.8** / 仓库 **v1.3.28**（v1.5.8：**修正 v1.5.7 的方向错误** —— 用户澄清「控制点是唯一控制起伏的东西，山峰柱根据它的位置跟控制点互动」。基准改用**本图层在合成空间的真实位置**（`thisLayer.toComp(transform.anchorPoint)`）：无父级 ≡ transform.position（行为不变）；设父级后柱跟随运动时**扫过固定地形**，高度按新位置重算，离开影响范围回基础高度。mock 新增 `thisLayer.toComp`（layerWorld 与 layerPos 可分离）。断言 273 → 286，反向对照 4 处注入 → 8 条变红。）
> （v1.5.4：面板顶部常驻版本号 + 状态栏带版本；修「点生成没反应」——「未激活合成」改为状态栏+弹窗，
> 统一入口 `needCompAlert()` 覆盖 5 个入口；点「生成」立刻写「正在生成…」。
> ⚠️ **血的教训**：ScriptUI Panel 由 AE【启动时】载入 —— 改完代码**必须完全退出 AE 重启**，
> 否则 AE 报的行号属于**旧文件**（2026-09-21 实测：AE 比脚本早启动 33 分钟，报的「行 2069」是旧版的行）。
> 261 断言全绿，新增源码级体检断言已做反向对照。commit hash 见根 AGENTS.md）

本文件是**给 AI / 维护者看的规则**。使用说明在 [README.md](README.md)，踩过的坑在 [DEVELOPMENT.md](DEVELOPMENT.md)。

---

## 1. 技术栈与硬约束（不可协商）

| 项 | 值 |
|---|---|
| 语言 | **ExtendScript ES3** —— 无 `const/let`、无箭头函数、无模板字符串、**无 `JSON`** |
| 语法检查 | `cp MountainSpectrum.jsx _check.js && node --check _check.js && rm _check.js`（node 不认 `.jsx` 后缀） |
| 编码 | **UTF-8 带 BOM**（ExtendScript 否则中文乱码）。写入工具产出无 BOM，由仓库 `install.py` 部署时统一补 |
| 交付 | **单文件 IIFE**，`panels/MountainSpectrum/MountainSpectrum.jsx` 就是全部（仓库约定：`ScriptUI Panel 单文件交付`） |
| UI | AE 2026（内部 26.0）中文版；**UI 标签、注释一律中文** |
| 测试 | `node test_MountainSpectrum.js`（必须在面板目录内运行，脚本按相对路径载入主文件） |

**为什么不拆文件**：ExtendScript 支持 `#include "x.jsxinc"` / `//@include`（官方 Preprocessor directives 文档），
但（a）找不到 include 文件是**运行时报错**（面板直接打不开）、（b）被包含的代码**不出现在调试器里，无法打断点**、
（c）要连带改 `install.py` 部署 `.jsxinc` 并破坏仓库"单文件"约定。
⇒ 走**逻辑模块化**：靠"测试导出闸门"切出可测层，靠**参数表**消除横切面重复。

---

## 2. 代码结构（分层）

```
MountainSpectrum.jsx
├── L1~  头部文档（功能 / 产物 / 语义 / 逐版本变更）
├── 命名常量（图层名、滑块名、默认值区间）
├── 纯逻辑层            ← 不引用任何 AE API(app/comp/layer 都不行)  ✅ node 可测
│   ├── 基础      clampNum clampInt pickNum pickBool pickBaseY falloff barOffsetX rowWidth autoCount
│   ├── 窗口形状  SL_EDGE / EDGE_DEF / edgeKeepOf
│   ├── 宽度      influenceRadiusPx(根数→像素) autoRadiusFor(唯一入口) resolvePoints
│   ├── 高度      intrinsicPeak peakScaleOf pointContribution combineHeights barHeightAt
│   ├── 索引      barHeightOfIndex countVisibleBars autoInfluenceBars
│   ├── 表达式构建 buildExprCore buildSizeExpr buildPosExpr      ⚠️ 与上面那组【手工镜像】
│   └── 参数表    PARAM_SPECS paramSpec DEFAULTS PRESET_KEYS
│                 序列化 serializePreset deserializePreset slotsToJson jsonParseSlots resetSlots
├── 【测试导出闸门】if (typeof app === "undefined") { module.exports = {...}; return; }
└── AE 运行环境层        ❌ node 无法测试（51 个函数 / 1200+ 行，自动化覆盖 0）
    ├── 状态栏 / 调试弹窗     setStatus showDebugError
    ├── 合成与图层查找        getComp findLayer countPoints countBars rnd01 currentBaseY cleanup propByNames
    ├── 滑块与形状组          addSlider setSlider addColorControl rectSizeProp rectPosProp buildBarGroups rewriteBarExpr
    ├── 构建层               readParams pointXAt makeEdgePoints syncEdgeX makePoint ensureHeightLayer
    ├── 主流程               generate readPointsFromComp visibleCountHint pushParam uniformEdgePoints
    │                        resetPoints randomPeaks cleanAll
    ├── 预设槽位（工程目录）  getPresetFile writeSlotsToStorage loadSlotsFromStorage
    │                        projectKey watchProject startProjectWatch
    │                        collectParams applyParamsToUI bindLiveParam saveSlot loadSlot clearAllSlots
    │                        pickSaveTarget pickOpenTarget exportSlots importSlots
    └── UI 层                由 PARAM_SPECS 生成控件 + 按钮 + 提示 + 状态栏
```

---

## 3. 参数表 PARAM_SPECS —— 加参数只改一处

```js
{ key: "w", label: "矩形宽", ui: "edW", kind: "num", def: 24, lo: 1, hi: 100000,
  mode: "ctrl", ctrl: SL_W, group: "排列", chars: 4 }
```

| 字段 | 作用 |
|---|---|
| `key` | 预设键 / 参数对象键（`DEFAULTS`、`PRESET_KEYS` 都由它派生） |
| `ui` | 面板控件句柄（`U[sp.ui]`） |
| `kind` | `num` / `int` / `bool` / `idx`（下拉） —— 决定控件类型与钳制方式 |
| `def` `lo` `hi` | 默认值与钳制区间（`serializePreset` 自动套用） |
| `mode` | **`ctrl`** 写控制器滑块 / **`points`** 推给点位 / **`layer`** 移动形状图层 / **`rebuild`** 结构性参数 |
| `group` | UI 归到哪个面板（排列 / 高度 / 起伏） |

**加一个参数的标准动作**：
1. `PARAM_SPECS` 加一行；
2. 若要实时生效 → 在 `pushParam` 里补该 mode 的落地代码（多数情况不用，现有 4 种 mode 已覆盖）；
3. `UI_ROWS` 里挑个位置（决定它出现在哪一行）；
4. 需要进表达式 → 在 `buildExprCore` 里读它，**并同步改纯逻辑层的对应函数**；
5. `test_MountainSpectrum.js` 第八节补一条"参数表自洽"断言。

⚠️ **值范围为 `1..99` 这类"百分比"参数注意口径**：`readParams` 里 `baseRatio` 会 `/100` 供几何使用，
`serializePreset` 存的是**百分比整数**。别在两处混用。

---

## 4. 表达式层：必须与纯函数严格镜像（最容易出错的 143 行）

`buildExprCore()` 用 `L.push("...")` 拼出一段**字符串程序**，AE 逐帧求值。它和纯函数 `barHeightOfIndex` 链是
**两份实现、同一套数学** —— 改一处必须同步改另一处，测试第六节用"eval 真实表达式 + 逐根比对"守护（1600 次比对）。

表达式引擎只吃**最保守子集**（仓库既有真机坑，见 `AE-Water-Rise-Generator/AGENTS.md` 与 `NumCounter` 已验证写法）：

- ❌ 一次声明多个变量（`var a, b;`）→ ✅ 一行一个
- ❌ `++` / `+=` / `continue` / IIFE
- ❌ 对象字面量键用 ES3 保留字（`in` / `new` / `var`）
- ❌ 正则字面量里的 `\`（ExtendScript 会报语法错，node 拦不住）
- ✅ 用 `try/catch` 包住"可能不存在的图层/效果"的读取，并在 catch 里给保守默认值
- ✅ 靠**最后一句裸变量**返回值（`outSize;` / `outPos;`），AE 取最后一句的值

---

## 5. 真机坑清单（写新代码前先过一遍）

| 坑 | 正确做法 |
|---|---|
| ScriptUI **双窗口**（空 Panel + 新 Window 并存） | `var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)` |
| 无 UI 脚本放进 `ScriptUI Panels/` → 残留关不掉的空面板 | 本面板有 UI；无 UI 脚本一律放 `scripts/` |
| **对象字面量属性名用 ES3 保留字** | 换名，改完 grep 一遍 |
| 全局 `JSON` 不是原生内置（靠 Adobe 面板泄漏才有） | 自写序列化 + "首字符判定 + 受控 eval" 解析 |
| Effects 是**索引属性组**，`addProperty` 后同类旧引用失效（"对象无效"） | 每次按名字重新取回，不缓存引用 |
| `dropdownlist` 未初始化 `selection` | 显式 `dd.selection = 0`（本面板由 `applyParamsToUI` / 建控件时设） |
| Undo 半截栈 | `beginUndoGroup()` + `try/finally { endUndoGroup() }`（3 个入口各自成组） |
| 操作结果用 alert 打扰 | 用面板底部状态栏；仅"未激活合成"这类前置条件才值得弹窗；真异常才走 `showDebugError` |
| ScriptUI 赋 `.text` 后首选宽度重算 → 面板弹宽 | 建控件时把宽度钉到 `preferredSize` / `minimumSize` / `maximumSize` 三处（`pinW` / `numBox`）；高度一律传 `-1`；**绝不**读回 `preferredSize.height`；`setStatus` 不调 `layout.resize()` |
| 中文界面下属性显示名找不到 | 一律先试 match name（`propByNames`），再试显示名 |
| `app.settings` 会崩 | 预设写**工程目录 JSON**（跟随工程走） |
| 打开工程后预设不刷新（面板实例常驻） | `app.scheduleTask` 低频轮询"预设文件路径 + 是否存在"，一变就重读 |
| `File.saveDialog` 没有目录参数 | 用 File **实例方法** `saveDlg()` / `openDlg()`（文档原文：presets the current folder to this File object's parent folder） |
| `Math.random()` 用于 `setValue` | 用 `generateRandomNumber()`（官方文档点名场景；做存在性回退） |
| 集合变更（又 addProperty）后缓存引用失效 | 重新按索引/名字取回再写 |

---

## 6. 改代码的检查清单

- [ ] 语法：`cp x.jsx _check.js && node --check _check.js && rm _check.js`
- [ ] 断言：`node test_MountainSpectrum.js` **必须全过**（改行为 → 同步改期望值，不许改断言来迁就 bug）
- [ ] **纯逻辑层改了 → 表达式层同步了吗？**（`buildExprCore` 是手工镜像，测试守护但不会自动改）
- [ ] 参数表改了 → `DEFAULTS` / `PRESET_KEYS` / 建控件 / 读面板 / 存预设 / 填预设 **是否都自动跟随了**？（应该都自动；若某处仍手写，说明它漏在表外）
- [ ] 新增/删除滑块 → 老工程做**缺失回退**了吗（`try/catch` + 保守默认值）？并想清楚要不要在生成时补建
- [ ] 新的源码级体检断言 → **做反向对照**（喂回归代码必须变红，否则是假绿）
- [ ] 数值性质断言 → 检查**探针选对了吗**（例：验宽度别用峰顶；验基础高度别用峰顶那根）
- [ ] 用户可见的行为变化 → 同步 `README.md` / `CHANGELOG.md` / `DEVELOPMENT.md` / `tips/tools/MountainSpectrum.md`
- [ ] 版本号：`MountainSpectrum.jsx` 头部 + `CHANGELOG.md` + 根 `README.md` 工具总览表 + 根 `CHANGELOG.md` + 根 `AGENTS.md` 基线行

---

## 7. 数值契约（改动前务必知道）

| 量 | 单位 / 语义 | 备注 |
|---|---|---|
| `points[].xl` / `.xr` | **绝对 X**（合成坐标） | 宽度来源；缺一侧 → 用 `autoR` |
| `resolvePoints` 输出的 `r` / `rl` | **像素半径**（右 / 左） | 供 `barHeightAt` 使用 |
| `influenceRadiusPx(rTotal, pitch, delta)` | 根数 → 像素 | `delta` = 点位相对柱网相位，摆边缘点时取 0.5（保守） |
| `pointContribution` 的返回值 | **超出基础高度多少**（不是绝对高度） | `combineHeights` 再加回地板 |
| `barHeightOfIndex` 输出的 `h` | **绝对高度** | = 基础高度 + 合成量 |
| 「高度」滑块 = 0 | **自动**（用"基线 − 点位Y"） | 不要改成 `>= 0`，会把 0 撕成两种语义 |
| 总闸 `hMax` = 数字 | 启用（**0 是合法值** = 整排压平） | `null/NaN` 才是"未启用" |
| 基础高度负值 | 一律按 **0**（表达式与纯函数同口径） | 不钳会算出负高度 → AE 翻转渲染 |

---

## 8. 交付流程

1. 改代码 → 语法检查 → 跑断言（全过）
2. 部署：仓库根 `python install.py`（自动补 BOM + 逐字节校验）
3. **真机验证**（用户）：重启 AE → `窗口 › 扩展 › MountainSpectrum` → **点「生成 / 重建」**
   （表达式与滑块集合烘焙在工程里，旧工程必须重建才拿到新行为）
4. 通过后 → 四件套 + 根 README / CHANGELOG / AGENTS + tips 同步 → commit + push
   （照仓库先例：`feat:` 一个 commit，再 `docs:` 回填 AGENTS 基线 hash）
