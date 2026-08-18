# DEVELOPMENT.md · 开发记录

## 项目概览

AE 2026 虚线网格生成器：ScriptUI 面板脚本，生成共用交接边的虚线网格框。

- 交付物：`AE_dashed_grid_shared-edge.jsx`（单文件）
- 依赖：无第三方库，纯 AE ExtendScript + ScriptUI
- 目标 AE：2026 中文版（内部版本 26.0）

## 架构说明

```
AE_dashed_grid_shared-edge.jsx
├── (function(thisObj){ ... })(this)    标准面板模式（防双窗口）
│   ├── showDebugError(err)             调试模块：可复制错误对话框 + 日志
│   ├── setStatus(pal, msg, rgb)        状态区更新（成功绿/失败红）
│   ├── buildGrid(pal)                  核心生成逻辑
│   └── 面板 UI                        行列/尺寸/线型/缩放补偿/状态区
```

**buildGrid 生成的结构**：

```
Contents (ADBE Root Vectors Group)
├── 网格组 (ADBE Vector Group)          ← 路径都在组内
│   ├── 内容 (ADBE Vectors Group)
│   │   ├── 外框路径 (闭合矩形)
│   │   ├── N-1 条竖分隔线
│   │   └── M-1 条横分隔线
│   └── 变换 (ADBE Vector Transform Group) ← 缩放这里，线宽自动保持
└── 共享描边 (ADBE Vector Graphic - Stroke) ← 组外！物理方案关键
    └── 虚线 (Dashes: Dash 1 / Gap 1)
```

**核心设计**：
1. 一个形状图层内多个路径 + 一条共享描边 → 共用交接边（无双线）
2. 共享描边放组外 → 缩放组变换时线宽/间距天然保持
3. 面板 + 状态区 → 不弹窗、可连续操作

## 关键问题与方案

### 问题：ADBE Vector Group 无法添加属性（"无法将名称为 ADBE Vector Group 的属性添加到此"）

**TL;DR**：`ADBE Vector Group` 的子属性只有「内容(`ADBE Vectors Group`)」和「变换(`ADBE Vector Transform Group`)」，形状/描边必须加进内容容器。

- 问题：直接 `group.addProperty("ADBE Vector Shape - Group")` 报错
- 根因：AE 形状图层组是受限 NAMED_GROUP，子属性槽位固定
- 解决：`var content = group.property("ADBE Vectors Group")` 后，所有路径/描边加到 `content`
- 预防：形状图层里凡是"组"，先取它的 `ADBE Vectors Group` 再往里加

### 问题：AVLayer.newShape 未定义

**TL;DR**：Shape 对象用全局构造函数 `new Shape()`，AVLayer 上没有 newShape 方法。

- 问题：`layer.newShape()` 报 ReferenceError
- 根因：API 用错，`newShape` 不是 Layer 的方法
- 解决：`var sh = new Shape(); sh.vertices = ...; sh.closed = ...; path.setValue(sh)`
- 预防：创建 Shape 一律用全局构造函数

### 问题：描边颜色报错

**TL;DR**：`ADBE Vector Stroke Color` 是 4D RGBA 属性，写 3 通道会出错。

- 问题：`setValue([0.85, 0.87, 1])` 报错
- 根因：属性维度是 4（RGBA），不是 3
- 解决：`setValue([0.85, 0.87, 1, 1])`
- 预防：写颜色前先查属性维度（速查表：Stroke Color 4D RGBA）

### 问题：Dashes 虚线 setValue 报"属性被隐藏"

**TL;DR**：Dashes 组是 NAMED_GROUP，Dash/Gap 属性"始终存在只是隐藏"；`addProperty()` 是"揭示"而非"添加"，揭示后 setValue 才有效。

- 问题：`dashes.property("ADBE Vector Stroke Dash 1").setValue(14)` 报"属性或父级属性被隐藏"
- 根因：Dashes 是 NAMED_GROUP，所有 Dash/Gap 槽位预置但隐藏；property() 取到的是隐藏引用
- 解决：`var d1 = dashes.addProperty("ADBE Vector Stroke Dash 1"); d1.setValue(14);`
- 预防：凡遇隐藏属性，用 `addProperty()` 揭示后再操作；可用 `canSetExpression` 判断是否已揭示

### 问题：线宽缩放不保持（"部分自适应"）

**TL;DR**：toComp 表达式只对图层等比缩放有效；用物理方案——描边放组外，缩放「网格组」变换时线宽天然保持。

- 问题：勾选缩放补偿后，线宽"部分保持"但没完全不变
- 根因：toComp 表达式感知不到组变换缩放；非等比缩放图层引擎无解
- 解决：共享描边从组内移到 Contents 根级（组外），缩放组变换时描边不参与变换
- 预防：缩放网格用「网格组」变换（物理保持），别直接缩放图层

### 问题：状态区文字显示不全

**TL;DR**：statictext 默认单行，多行必须创建时 `{multiline: true}`，换行用 `\r`，更新后 `layout(true)` + `layout.resize()`。

- 问题：两行状态文字被截断
- 根因：statictext 默认单行控件；dockable 面板宽度由 AE 主 UI 控制
- 解决：创建时加 `{ multiline: true }`；`setStatus` 里 `layout(true)` 后追加 `layout.resize()`
- 预防：多行 statictext 一律创建时声明 multiline

### 问题：ScriptUI 面板双窗口

**TL;DR**：标准面板模式必须 `(thisObj instanceof Panel)` 判断，否则从扩展菜单打开会出现两个窗口。

- 问题：从 Window > Extensions 打开出现空白面板 + 新窗口
- 根因：无条件 `new Window`
- 解决：`var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)`
- 预防：面板脚本一律用标准模式收尾
