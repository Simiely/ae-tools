# 开发文档（DEVELOPMENT.md）

> 面向开发者的项目文档：架构说明 + 关键问题与方案（一坑一篇）。
> 每个问题用统一格式：**TL;DR**（一句话结论）→ 问题 / 根因 / 解决 / 预防。

## 项目概览

AE 2026 中文版歌词逐字动画脚本，单文件 IIFE 结构（v3.5，约 1174 行）。选中文本图层后一键生成 5 种文字动画器（入场 / 出场 / 高度错落 / 字间距动态 / 散落分布），参数支持 4 槽位双层持久化预设。

## 架构说明

### 文件结构（歌词逐字散落动画工具.jsx）

```
├── 文件头注释（版本说明）
├── IIFE 包裹 (function(thisObj) { ... })(this)
├── DEFAULTS 对象（集中默认值，25 个参数）
├── UI 工厂函数：createParamPanel / addParamRow / addDropdownRow / addEnableCheckbox
├── UI 构建：5 个参数模块面板 + 预设管理面板
├── 基础工具：getVal / setStatus / removeLyricsAnimators / clearAnimators
├── 属性兼容层：addAnimProperty（多候选名 fallback）
├── JSON Polyfill（ExtendScript 无内置 JSON）
├── 存储模块（双层持久化）：工程目录 JSON + app.settings
├── 动画辅助：setBlur / getDirectionPos / findSelectorStartEnd / findAnimatorProps
│             / findAnimatorsGroup / getTextLen / lockCharRange
│             / createPerCharAnimator / buildScatterFadeExpr
├── 动画核心：readAnimParams / applyEntryAnim / applyExitAnim / applyScatterAnim
│             / applyHeightAnim / applySpacingAnim / applyAnimation（主函数）
└── 入口：按钮绑定 / 面板布局 / show
```

完整函数索引（函数名 → 行号 → 功能）见仓库内 `歌词逐字散落动画工具.jsx` 头部注释，或 `node --check` 后按需检索。

### Animator 命名规范

所有生成的动画器以 `歌词_` 前缀命名，便于清除时识别：

| Animator | 命名格式 | 示例 |
|----------|----------|------|
| 入场 | `歌词_入场` | `歌词_入场` |
| 出场 | `歌词_出场` | `歌词_出场` |
| 高度错落 | `歌词_高度_{ci}` | `歌词_高度_1` |
| 字间距 | `歌词_字间距_{ci}` | `歌词_字间距_1` |
| 散落分布 | `歌词_散落_{ci}` | `歌词_散落_1` |

### 预设数据结构

存储到 JSON / app.settings 的预设对象（槽位 1-4，字段为缩短 key）：

```javascript
{
    "1": {
        "d": "2.0",    // 入场持续时间
        "b": "40",     // 入场模糊
        "o": "80",     // 入场偏移
        "dir": 0,      // 入场方向
        "emode": 0,    // 入场模式（逐字/一起）
        "enbl": true,  // 入场启用
        "es": "3.5",   // 出场开始时间
        "ed": "2.0",   // 出场持续时间
        "ss1": "0",    // 字间距起始
        "ss2": "50",   // 字间距结束
        "ss3": "2.0",  // 字间距持续
        "ss4": "0",    // 字间距开始时间
        "spenbl": false // 字间距启用
        // ... 其余字段
    },
    "2": { ... }, "3": { ... }, "4": { ... }
}
```

## 关键问题与方案

### A. AE 2026 中文版兼容层

#### A1. matchName 与英文文档不一致

**TL;DR**：AE 2026 中文版属性面板显示中文但 matchName 仍是英文，且与标准文档存在差异；所有属性访问必须用候选 fallback 列表。

- **问题**：按英文文档写的 `layer.property("ADBE Text Position")` 在中文版取不到
- **根因**：本地化版本的属性路径 / matchName 与英文版不同
- **解决**：`addAnimProperty()` 对每个属性准备多组候选名，逐个尝试

```javascript
if (propType === "ADBE Text Position") candidates = [
    "ADBE Text Position", "ADBE Text Position 2D",
    "ADBE Text Position 3D", "Position", "位置"
];
```

- **预防**：新增属性访问一律走 `addAnimProperty()`，不硬编码单一 matchName

#### A2. Text Animators 组位置变化

**TL;DR**：Text Animators 在 AE 2026 中文版中位于 `ADBE Text Properties` 内部，不是图层的直接子属性；用备选路径查找。

- **问题**：`layer.property("ADBE Text Animators")` 返回 null
- **根因**：新版 API 将 Animators 组移入 `ADBE Text Properties` 内
- **解决**：`findAnimatorsGroup()` 先试直接路径，失败再走备选路径

```javascript
var animatorsGroup = layer.property("ADBE Text Animators");
if (!animatorsGroup) {
    var textProps = layer.property("ADBE Text Properties");
    animatorsGroup = textProps.property("ADBE Text Animators");
}
```

- **预防**：动画器组查找统一用 `findAnimatorsGroup()`

#### A3. Range Selector 的 4 套属性命名

**TL;DR**：Range Selector 的 Start/End 有 Percent / Index / 简写 / 显示名 4 套命名；AE 2026 中 Index 模式是隐藏 3D 属性，`setValue()` 会报错，**Percent 模式最稳**。

- **问题**：Index Start/End 是隐藏属性（3D 类型），`setValue()` 报错
- **根因**：Index 模式属性在部分版本为隐藏/只读
- **解决**：统一使用 Percent 模式（见 A4 / B2 的逐字锁定方案）
- **预防**：**Selector 默认 Units 为 Percent，只设置 Index 值会被忽略**；逐字锁定用 Percent 等分

#### A4. Animator 属性组含大量预置属性

**TL;DR**：`ADBE Text Animator Properties` 在 AE 2026 有 103 个子属性，直接 `addProperty` 可能失败；先尝试创建，失败回退访问。

- **问题**：`addProperty("ADBE Text Position")` 在某些情况下失败
- **根因**：属性组内已有大量预置属性，冲突
- **解决**：先 `addProperty` 创建新属性（避开隐藏预置），失败回退 `property()` 访问
- **预防**：属性创建逻辑保留"创建优先、访问兜底"的双路径

#### A5. 3D / 2D 属性值类型

**TL;DR**：Position 在部分版本是 3D 属性需传 `[x,y,z]`，普通 2D 只需 `[x,y]`；用 `PropertyValueType.ThreeD` 检测（勿用魔法数字 6413）。

```javascript
if (pType === PropertyValueType.ThreeD) {
    entryPosProp.setValue([-pEntryOff, 0, 0]);
} else {
    entryPosProp.setValue([-pEntryOff, 0]);
}
```

- **预防**：所有 setValue 数组长度按属性类型动态适配

### B. 表达式与动画

#### B1. textIndex 表达式变量不可用

**TL;DR**：AE 2026 中 `textIndex`（当前字符序号）提示未定义；逐字效果改用「每字符独立动画器 + 硬编码字符索引」。

- **问题**：使用 `textIndex` 的表达式全部被禁用
- **根因**：该表达式变量在 AE 2026 环境不可用
- **解决**：每个字符独立建一个文字动画器，Range Selector 用 Percent 锁定单字符，表达式硬编码索引作相位偏移

```javascript
// 每个字符 ci 的表达式
"[0, Math.sin(time * freq * 2 + " + ci + " * 0.8) * amp]"
```

- **预防**：不要依赖表达式层获取字符索引；逐字效果统一走 `createPerCharAnimator()`

#### B2. 逐字独立动画器：Index → Percent 回退

**TL;DR**：v1.1 曾改 Index 模式导致波浪失效。根因是 Units 未切换（默认 Percent 忽略 Index 值）+ 硬编码属性索引脆弱。**Percent 模式按字符数等分最稳**。

```javascript
var pStart = ((ci - 1) / textLen) * 100;
var pEnd   = (ci / textLen) * 100;
hPStart.setValue(pStart);
hPEnd.setValue(pEnd);
```

- **预防**：逐字锁定一律 Percent 等分；Index 模式需要额外设置 Units，且兼容性差，不再使用

#### B3. 动画起始时间基准

**TL;DR**：动画从播放头（`comp.time`）开始，而非固定 0 秒；所有关键帧时间用 `startTime + offset`。

```javascript
var startTime = comp.time;
var k1 = entryStartProp.addKey(startTime);
entryStartProp.setValueAtKey(k1, 0);
var k2 = entryStartProp.addKey(startTime + pEntryDur / pSpeed);
entryStartProp.setValueAtKey(k2, 100);
```

#### B4. seedRandom timeless 模式与种子隔离

**TL;DR**：`seedRandom(seed, true)` 的 `true` 保证每帧返回相同值；位置 / 大小 / 模糊用不同种子偏移（`+9999` / `+5555`）隔离随机流。

```javascript
seedRandom(pSeed + ci, true);            // 位置
seedRandom(pSeed + ci + 9999, true);     // 大小（独立于位置）
seedRandom(blurSeed + ci + 5555, true);  // 模糊量（独立于是否模糊）
```

#### B5. Scale 百分比坑

**TL;DR**：AE 的 Scale 属性值本身就是百分比，直接传原始百分比值，**不要除以 100**。

- **预防**：改散落/缩放逻辑时注意 Scale 单位

#### B6. Blur 表达式需返回 2D

**TL;DR**：Blur 表达式必须返回 2D 数组 `[x, y]`，返回单值会报错；`setBlur(prop, val, key)` 统一处理 2D/1D + 可选关键帧。

### C. 预设存储

#### C1. 双层持久化方案

**TL;DR**：预设同时写「工程目录 JSON」（跟工程走）+「app.settings」（全局保底），读取优先工程 JSON，缺失回退全局。

| 层级 | 存储方式 | 特点 |
|------|----------|------|
| 工程目录 JSON | `.aep` 同级目录 `歌词动画预设.json` | 跟工程走，不同工程独立 |
| 全局保底 | `app.settings`（AE 偏好） | 不依赖工程，随时可用 |

#### C2. ExtendScript 无内置 JSON 对象

**TL;DR**：ES3 引擎没有 `JSON` 对象，`JSON.stringify()` 直接 `ReferenceError`；在存储模块前注入 JSON polyfill。

```javascript
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.stringify !== "function") {
    JSON.stringify = function(obj) { /* 手动序列化 string/number/bool/array/object */ };
}
if (typeof JSON.parse !== "function") {
    JSON.parse = function(text) { return eval("(" + text + ")"); };
}
```

- **预防**：新增任何 JSON 使用前先确认 polyfill 已注入；polyfill 同时服务工程 JSON 和 app.settings

### D. UI 布局

#### D1. dockable Panel 宽度不受控

**TL;DR**：AE dockable Panel 宽度由主 UI 控制，`minimumSize` / `preferredSize` 在 Panel 模式下不影响实际面板宽度。

- **解决**：靠控件自身的固定宽度（标签 110px）+ 双轴 fill 撑满实现整洁布局

#### D2. edittext alignment 必须双轴格式

**TL;DR**：`alignment = "fill"` 单字符串只作用垂直轴；必须用 `["fill", "center"]` 双轴格式才能水平撑满。

```javascript
// 输入框
edittext.alignment = ["fill", "center"];
```

### E. 数值单位

#### E1. Tracking Amount 需 *0.1

**TL;DR**：字间距（Tracking Amount）单位是 1/1000 em，实测面板填 50 ≈ 实际值 500；表达式末尾 `* 0.1` 匹配面板直观值。

```javascript
linear(t, startTime, startTime + duration, startVal, endVal) * 0.1
```

### F. 调试

#### F1. alert 弹窗不可复制

**TL;DR**：ExtendScript 的 `alert()` 弹窗内容无法复制，长调试信息丢失；开发期用 `showDebugDialog()`（多行文本框，支持 Ctrl+A/Ctrl+C 复制），发布后移除。

## 开发环境

- Adobe After Effects 2026 中文版 + Windows
- 语法检查：`node --check 歌词逐字散落动画工具.jsx`（Node 仅验证 ES3 语法，不能运行 AE API）
- 无构建工具，单文件部署

## 版本演进

| 版本 | 核心变更 |
|------|----------|
| v1.0 | 高度错落（逐字波浪） |
| v1.1 | 入场 + 出场 + 波动（修复波浪失效：Index → Percent 回退） |
| v2.0 | 散落分布（随机位置 + 随机大小） |
| v3.0 | 方向选择 + 随机模糊 + 时间控制 |
| v3.1 | 入场 / 出场方向选择（4 向）+ 随机模糊 + 散落时间控制 |
| v3.2 | 面板总开关 + 逐字/一起模式 |
| v3.3 | UI 布局稳定 |
| v3.4 | 首次代码重构 |
| v3.5 | 字间距动态 + 双层存储 + 模块化重构 |
