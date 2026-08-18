# AGENTS.md · 项目规则

## 技术栈

- After Effects 2026 中文版 + ExtendScript（ES3）
- 交付形态：单文件 ScriptUI 面板脚本（`.jsx`）
- 部署位置：`%APPDATA%\Adobe\After Effects\26.0\Scripts\ScriptUI Panels\`
- 编码：**UTF-8 with BOM**（ExtendScript 引擎无 BOM 会乱码中文）

## 关键坑（每条都踩过，越具体越好）

- **ADBE Vector Group 的子属性只有「内容」和「变换」**：形状/描边必须加进组的内容容器 `ADBE Vectors Group`，直接加会报"无法将名称为 ADBE Vector Group 的属性添加到此"
- **自由路径 matchName 是 `ADBE Vector Shape - Group`**，不是 `- Path`；Shape 对象用全局构造函数 `new Shape()`（AVLayer 没有 newShape）
- **Stroke Color 是 4D RGBA**：`setValue([r,g,b,a])`，写 3 通道会出错
- **Dashes 组是 NAMED_GROUP，Dash/Gap 属性"始终存在只是隐藏"**：`addProperty()` 是"揭示"不是"添加"，揭示后 `setValue` 才有效；`property()` 取到隐藏引用直接 setValue 报"属性被隐藏"
- **statictext 默认单行**：多行必须创建时加 `{multiline: true}`，换行用 `\r`；更新文本后要 `layout(true)` + `layout.resize()`
- **线宽保持用物理方案**：共享描边放组外（Contents 根级），缩放「网格组」变换时线宽天然不变；toComp 表达式只对图层等比缩放有效，非等比缩放引擎无解

## 约定

- UI 标签 / 注释全中文
- 所有 AE 属性访问统一 matchName（+ fallback），不硬编码单一名字
- 错误处理统一走 `showDebugError()`（可复制对话框 + 日志文件）
- 成功/失败提示显示在面板状态区，不弹 alert

## 常用命令

- 部署到 AE：`python deploy_ae_script.py --src AE_dashed_grid_shared-edge.jsx --version 26.0 --scope user --folder "ScriptUI Panels"`（ae-script-deploy skill）
- 语法检查：`cp file.jsx _check.js && node --check _check.js`

## 详细规则（按需 @引用）

- 暂无拆分；文档见 DEVELOPMENT.md 的「关键问题与方案」一坑一篇
