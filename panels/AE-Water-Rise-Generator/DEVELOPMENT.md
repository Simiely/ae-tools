# DEVELOPMENT.md · 水面波动生成器

## 项目概览

AE 2026 ScriptUI 面板脚本，把 Canvas 版「水面上涨波动」效果做成 AE 一键生成工具。用户设置参数 → 点「生成水面效果」→ 自动创建合成 + 背景 + 水面形状图层（表达式驱动波浪），波浪上涨到顶自动回底循环。面板含噪波控制与 4 槽位预设。

## 架构说明

### 文件结构

单文件 `WaterRisePanel.jsx`，IIFE 包裹（标准 Panel 模式，支持停靠）：

```
(function (thisObj) { ... })(this);
```

### 面板结构

- 合成设置：宽度 / 高度 / 时长
- 波浪参数：上涨速度 / 流动速度 / 波峰高度 / 波长 / 噪波开关+种子 / 噪波速度 / 噪波幅度 / 噪波颗粒（带最小范围提示）
- 主按钮：生成水面效果
- 预设管理：存储 1-4｜清除全部 / 使用 1-4｜复位
- 状态行

### 生成流程（generate）

1. 收集参数（getCurrentParams）→ 新建合成 + 背景纯色层
2. 新建形状图层「水面」：
   - **图层级变换归零**：ADBE Anchor Point / ADBE Position → [0,0]
   - 水体组：路径（ADBE Vector Shape - Group）+ 纯色填充（ADBE Vector Graphic - Fill）
   - 高光组：路径 + 描边（ADBE Vector Graphic - Stroke）
3. 挂滑块/勾选框控件：上涨速度 / 流动速度 / 波峰高度 / 波长 / 噪波开关(checkbox) / 种子 / 噪波速度 / 噪波幅度 / 噪波颗粒 / 循环起点
4. **挂表达式**（关键：全部现取现用）：
   - `findGroupByName(contents, "水体")` 重新查找组 → `zeroGroupTransform` 组变换归零 → `findPathProp` 找路径 → `getPathData` 取路径数据属性 → 赋 expression

### 表达式设计

- 水体路径（闭合多边形）：单层正弦 + 可选 Perlin 噪波
  ```
  y = baseY + amp*sin(2πx/wl + time*flow)
  if 噪波: y += amp*nsize*(noise([x/grain, time*nspd, seed])-0.5)*2
  末尾 push [W,H]、[0,H] 闭合到底部
  createPath(pts)  // 默认 is_closed=true
  ```
- 高光路径：同上但 baseY-3、不闭合（createPath(pts, [], [], false)），描边只画波浪线
- 水位循环：`cycle = cf > 0 ? cf * thisComp.frameDuration : H / rise`（循环帧数优先，否则按上涨速度自动）；`level = ((time - off) % cycle) / cycle`，到顶回底

### 颜色控制（面板 + 生成后）

- 面板：水体/高光颜色 → HSL 调色板对话框（openHslColorPicker，参考 starry-sky-generator：H/S/L 滑块 + 预览）+ HEX 输入（# 前缀外置）；透明度数字
- 生成后：**Color Control 效果**（match name `ADBE Color Control`，参数 `ADBE Color Control-0001`，值 [r,g,b,a] 0-1）——填充/描边颜色属性表达式直接 `effect('水体颜色')(1)` / `effect('高光颜色')(1)` 引用，一个参数含 RGBA，AE 原生取色器
- 颜色值在 DEFAULTS/getCurrentParams/applyParams 以数组存储，预设自动纳入（jsonStringify 支持嵌套数组）

### 预设持久化（双层，对齐 AE-Lyrics-Animator）

- 工程 JSON：`.aep` 同级 `水面波动预设.json`（getProjectPresetFile）
- 全局保底：app.settings（Section `WaterRisePanel`，key `preset_1..4`）
- 读取优先级：工程 JSON → app.settings；presetsCache 内存中转
- JSON：ExtendScript 无原生 JSON → 自写 jsonStringify / jsonParse（eval 包装）

## 关键问题与方案（一坑一篇，格式与 knowledge-base 一致）

### 问题：集合变更后引用失效（"对象无效"）

**TL;DR**：对同一 PropertyGroup 多次 addProperty 后，先前缓存的引用全部失效，必须现取现用。

- 问题：v1-v4 反复报 "对象无效"，行号指向挂表达式处
- 根因：AE 脚本中 addProperty/remove 会破坏兄弟属性/子组的引用（Dan Ebberts 确认）；v6 之前只用 `path1.property("Path")` 缓存引用跨多步操作
- 解决：`findPathProp(group)`（按 matchName `ADBE Vector Shape - Group` 遍历）+ `findGroupByName(parent, name)`（按 name 找组）+ `getPathData`（兼容组/数据属性两种结构），挂表达式前全部重新查找
- 预防：不要跨 addProperty 操作缓存子引用

### 问题：形状图层整体错位（水面偏到右下）

**TL;DR**：贝塞尔路径坐标相对"形状组锚点"，且图层 Position 默认在合成中心；图层+组变换必须归零。

- 问题：v8 把图层 Anchor 设 [0,0] 仍错位
- 根因：官方文档——贝塞尔形状路径坐标相对**路径形状组**的锚点（组内 ADBE Vector Transform Group），不是图层锚点；且用显示名 "Anchor Point" 在中文 AE 里找不到（静默失败）
- 解决：图层级 ADBE Anchor Point + ADBE Position 归零；组级 zeroGroupTransform() 把 ADBE Vector Anchor / ADBE Vector Position 归零；全部用 match name
- 预防：形状图层定位 = 图层变换归零 + 形状组变换归零；属性访问一律 match name

### 问题：AE 崩溃（"After Effects 已崩溃 (2)"）

**TL;DR**：路径数据只有顶部波浪线没有底部闭合点，AE 默认闭合时越界崩溃；且挂表达式后立即读 expressionError 会强制求值触发崩溃。

- 问题：v5 起用户运行后 AE 直接崩溃
- 根因：createPath 默认 is_closed=true，开放点序列（只有顶部线）被强制闭合时越界/死循环
- 解决：水体路径末尾 push `[W,H]`、`[0,H]` 形成闭合多边形；去掉挂载后立即读 expressionError 的强制求值
- 预防：凡 createPath 闭合路径，数据必须自洽（含底部点）；表达式语法用保守子集

### 问题：波浪太均匀，缺少自然感

**TL;DR**：单层正弦波过于规律 → 叠加 Perlin 噪波 + 种子。

- 问题：v10 之后用户反馈波浪太均匀
- 根因：正弦波理想化，无随机性
- 解决：噪波开关 + 种子 + 噪波速度 + 噪波幅度 + 噪波颗粒（`noise([x/grain, time*nspd, seed])`，seed 作第三维）
- 预防：噪波类随机需求优先用 AE 内置 noise()（平滑不闪跳），种子做第三维可复现

### 问题：ExtendScript 无原生 JSON

**TL;DR**：预设持久化需要 JSON，ExtendScript 环境没有 JSON.stringify/parse → 自写 polyfill。

- 问题：v10 预设存储需要序列化
- 根因：ExtendScript（ES3）无原生 JSON 对象
- 解决：自写 jsonStringify（支持对象/数组/嵌套/字符串转义）+ jsonParse（eval 包装，本地文件可控）
- 预防：保持 jsonStringify 覆盖全部基本类型

## 历次版本演进（简）

- v1 初版 → v4 修复引用失效 → v5/v6 修复崩溃（闭合多边形 + 保守表达式）→ v8/v9 修复错位（变换归零 + match name）→ v10 预设（命名式）→ v12 预设改 4 槽位双层持久化（对齐 AE-Lyrics-Animator）→ v11/v13-v15 噪波体系（开关/种子/速度/幅度/颗粒）→ v16/v17 UI 范围提示（文字化）
