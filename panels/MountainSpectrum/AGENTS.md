# AGENTS.md · MountainSpectrum 项目规则

> 📌 **文档基线**：2026-09-18（面板 v0.9.0，仓库 v1.3.17）
> 新增山峰频谱面板：等距矩形阵列 + 每个波峰一组 3 个可拖控制点（峰/左边缘/右边缘）+ 总闸高度 + 4 槽预设。
> 1131 断言。本文件 / README / CHANGELOG / 根 README / 根 CHANGELOG / tips 已随本轮同步。
> **更新文档或代码后请更新此行**（日期 + 版本 + 一句话），并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects **2015.3+ 至 2026**（2026 中文版实测）+ ExtendScript（**ES3**：
  无 `const`/`let`/箭头函数/模板字符串/**无 `JSON`**）
- ScriptUI Panel 单文件交付，`panels/MountainSpectrum/MountainSpectrum.jsx` 就是全部
- **UTF-8 带 BOM**（ExtendScript 否则中文乱码；`install.py` 部署时自动补）
- 语法检查：`cp MountainSpectrum.jsx _c.js && node --check _c.js`（node 不认 `.jsx` 后缀）

## 代码结构（四层，改代码请先定位到层）

| 层 | 内容 | 可测性 |
|---|---|---|
| **纯逻辑层** | `falloff` `edgeKeepOf` `intrinsicPeak` `peakScaleOf` `influenceRadiusPx` `resolvePoints` `barPhase` `pointContribution` `combineHeights` `barHeightAt` `barHeightOfIndex` `countVisibleBars` `autoInfluenceBars` `rowWidth` `autoCount` `barOffsetX` `clampNum` `clampInt` `pickNum` `pickBool` `pickBaseY` | ✅ node 直接测 |
| **表达式构建层** | `buildExprCore` / `buildSizeExpr` / `buildPosExpr` | ✅ eval 出来跑，与纯函数**逐根柱子比对** |
| **预设层** | `serializePreset` `deserializePreset` `slotsToJson` `jsonParseSlots` `resetSlots` | ✅ node 测 |
| **AE 层** | 图层读写、面板 UI、状态栏、Undo、`app.scheduleTask` | ❌ 只能真机验 |

**node 导出分支**在文件顶部：

```js
if (typeof app === "undefined") { … module.exports = {…}; return; }
```

⇒ 纯逻辑层**不能引用任何 AE API**（`app` / `comp` / `layer` 都不行）。

## 两条铁律

### 铁律 1 · 表达式与纯函数必须严格镜像

`buildExprCore` 生成的表达式 与 `pointContribution` + `combineHeights` 是**同一套逻辑的两份实现**。
**改任何一处必须同步改另一处** —— 测试里的"表达式等价性"断言会立刻抓到漏改。

这不是形式主义，它已经三次当场抓到漏改：v0.3.4（影响范围单位）、v0.8.0（左右半径）、v0.9.0（地板起算）。

### 铁律 2 · 不要为提高可控性而撕毁已有的公开契约

v0.7.0 做总闸时，第一版打算把 `pointContribution` 的判据从 `hExplicit > 0` 改成 `>= 0`。
那会让**「高度滑块填 0 = 自动」这条契约撕裂成两半**（0 变成"峰高 0"）——
几十条既有断言 + 用户手上的旧工程会一起炸。

最终改成**把归一化后的峰高编码进 `y`**（`y = baseY − 峰高×s`，`h` 置 `-1`）：
`pointContribution` 走它原有的"自动"分支就得到正确结果，**既有断言零改动**。

v0.9.0 加 `baseH` 参数时遵守同样原则：**新参数放末尾、不传时与旧版逐点相同**。

> 通用做法：**加参数 / 加字段，不要改判据。** 判据是契约，参数是扩展。

## 真机坑清单（都踩过，别再踩）

| 坑 | 正确做法 |
|---|---|
| ScriptUI **双窗口**（空 Panel + 新 Window 并存） | `var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)` |
| `edittext` / 多行 `statictext` **赋 `.text` 后首选宽度会重算** → 面板弹宽 | 建控件时把宽度钉到 `preferredSize` / `minimumSize` / **`maximumSize`** 三处（见 `pinW`） |
| `preferredSize` 的**高度**在首次布局前是 volatile（读回常是 0） | 高度一律传 **`-1`**（让 ScriptUI 自动算）；**不要读回 `preferredSize.height` 再写回** |
| `pal.layout.resize()` 按当前首选宽度重排 → 回填预设时把面板撑开 | **不调 `layout.resize()`**，只调 `layout.layout(true)` |
| `app.settings` 会崩（历史结论） | 预设写**工程所在目录**的 JSON（跟随工程走） |
| `dropdownlist` 未初始化 `selection` → `.selection.index` 为 null | 显式 `dd.selection = 0` |
| **表达式引擎只吃保守语法子集** | 一次只声明一个变量（**禁 `var a,b,c;`**）、**禁 `+=` / `++` / `continue`**、**禁 IIFE**、**禁单行注释**、靠**最后一句裸变量**返回值 |
| **`File.saveDialog` 只接受 2 个参数**（`prompt[, preset]`），**没有目录参数** | 要"默认到工程目录"必须用**实例方法** `fileObj.saveDlg()` / `openDlg()`。官方文档原文：*"Differs from the class method saveDialog() in that it presets the current folder to this File object's parent folder"* |
| `Math.random()` 生成要 `setValue` 的值 | 用 `generateRandomNumber()`（官方文档点名；旧版 AE 多线程下可能返回重复值） |
| 面板实例在 AE 里**常驻** → 打开工程时脚本不会再跑，槽位永远读不到 | `app.scheduleTask`（**毫秒**、浮点、`repeat=true`）常驻低频轮询，比对"预设文件路径 + 是否存在"，一变就重读 |
| Undo 半截栈 | `beginUndoGroup()` + `try/finally { endUndoGroup() }` |
| 操作结果用 alert 打扰 | 用面板底部 statusBar（仅"未激活合成"用弹窗） |
| 点数很少时自动影响范围算出**超出半行宽**的值 → 整行被抬平 | `autoInfluenceBars` 封顶到 `N/2` |

## 关键设计决策（为什么是这样）

### 1. 边缘点复用 `山峰点 ` 前缀是**安全的**

`countPoints` 用 `parseInt(nm.substring(PT_PREFIX.length))` 取编号，而 **`parseInt("1 左") === 1`**
（遇非数字即停）；`findLayer` 是精确匹配；`cleanup` 用 `indexOf(PT_PREFIX) === 0`，于是边缘点自动跟着被清理。

**这三条都已写成断言钉住** —— 改命名规则前先看测试。

### 2. 总闸用"编码进 y"而不是改判据

见铁律 2。

### 3. `countVisibleBars` 必须把 `baseH` 真实传下去

旧版传 `0` 再自己判 `h > baseH` —— 那是在**躲 `combineHeights` 的 max 钳制**。
v0.9.0 改了公式后这个绕法立刻失效：传 0 会让 `pointContribution` 退化成"从零起算"，
边缘又被判成不可见（实测可见根数从 9 掉到 7）。

> **警惕这类"为了绕开旧实现而写的间接写法"** —— 底层语义一变，它们静默失效。

### 4. 「边缘控制」滑块是**性能退路**

关闭时表达式不再做那两次必然失败的图层查找。老工程没有该滑块 → `catch` 回退 `0` →
行为与开销都不变。峰多到几十个时这是实打实的差别。

### 5. 总闸图层**只在不存在时创建**

`ensureHeightLayer` 绝不重置已存在图层的位置 —— 否则用户改一次「数量」、点一次
「生成 / 重建」，调好的高度就被打回默认了。

### 6. 边界跳变是**有意保留**的

窗口内最低 = `地板 + 可用高度×e`，窗口外 = `地板` ⇒ 一定有台阶（除非 e=0）。
这是"圈定范围"这个契约的固有代价，把台阶大小交给「边缘高度%」控制而不是抹平它。

## 测试

```bash
cd panels/MountainSpectrum
node test_MountainSpectrum.js                                  # 1131 断言
cp MountainSpectrum.jsx _c.js && node --check _c.js && rm _c.js  # 语法
```

**三个层次缺一不可**：

1. **纯函数断言** —— 数学正确性
2. **表达式等价性** —— `eval` 真表达式 + mock `thisComp`，与纯函数**逐根柱子比对数值**。
   这是保证"表达式 = 纯函数"两条实现不漂移的**唯一手段**
3. **源码体检** —— grep 生成的表达式 / 源码文本，确认关键写法（保守语法、参数顺序、命名）没被改掉

**写断言时的两个坑**：

- 布尔比较用 `eq`，**不要用 `near`** —— `near(name, a > b, true)` 的 `eps` 是 undefined，**必然失败**
- 比对两个函数返回值时**所有参数都要对齐** —— 漏一个有默认值的参数就会得到"假失败"，曾因此误判代码有错

**反向对照（"测试全绿 ≠ 测试有效"）**：
写完断言后，故意把源码改坏再 `eval`，验证断言**会不会真的变红**。

实测靠它抓到过弱断言（正则漏掉 `var a = 1, b = 2;` 这种写法）和**探针选错**：

- 用"最高柱"去验证**宽度** → 抓不到（边缘点不改峰顶高度）
- 用"边缘可见性"去验证**是否减去 baseH** → 抓不到（地板是加法基线，真正的破坏是**峰顶被抬高**）

> **教训：写反向对照前，先想清楚"这个破坏会体现在哪条契约上"。**

## 改代码检查清单

- [ ] 纯逻辑层改了 → **表达式层同步了吗**？
- [ ] 新增参数**放末尾**了吗？不传时行为与旧版逐项相同吗？
- [ ] 生成的表达式里有 `var a, b, c;` / `++` / `+=` / `//` 吗？（都会让 ExtendScript 报错）
- [ ] `node --check` + `node test_MountainSpectrum.js` 都过了吗？
- [ ] 改了默认值 → **测试里有没有硬编码旧默认值**？（曾因此假失败）
- [ ] 加了新图层类型 → `cleanup` 的删除条件覆盖了吗？`countPoints` 会不会把它误数成峰？
- [ ] `python install.py` 部署 + 逐字节校验过了吗？
- [ ] 文档（README / CHANGELOG / 本文件 / tips）同步了吗？
