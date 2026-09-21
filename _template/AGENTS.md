# AGENTS.md — 面板模板 PanelTemplate

> ⚠️ **派生提示**：本文件随模板复制到新面板目录后，请把「面板模板」改成你的面板名、
> 版本号基线改成初始版本，其余约定**原样保留**（它们与根 `AGENTS.md` 一致）。

## 本目录是什么

一个 **AE ScriptUI 面板**，由 `_template/` 派生而来。

## 硬约定（与根 AGENTS.md 一致，此处只列与本目录相关的）

### 文件与命名
- 主文件 `.jsx` **与目录同名**（`MyPanel/MyPanel.jsx`）—— `install.py` 按文件名部署，
  不同名会让 AE 菜单里出现意外的名字
- 源码 **UTF-8 with BOM + CRLF**；`install.py` 会自动补 BOM，但**别把行尾改成 LF**（diff 会整文件飘红）
- 文件名里**不要有空格**（部署路径带空格后会变成难引用的字符串；中文文件名本身可以）

### 版本号（三处单一真相）
`var VER` 常量 / `CHANGELOG.md` 顶部标题 / 面板顶部显示 —— **三处必须一致**，`verify.py` 会自动校验。

为什么较真：ScriptUI Panel 由 **AE 启动时**载入 —— 改完脚本不重启 AE，面板里跑的**还是旧版**，
且 AE 报的错可能是**旧文件**的行号（2026-09-21 实测：AE 比脚本早启动 33 分钟，
报的「行 2069」属于旧文件）。**没有版本号就无法判断 AE 里跑的是不是最新的。**
改动生效的判定永远是：打开面板 → 看顶部版本号对不对。

### 代码结构（顺序不可调）
```
一、标识与版本         VER / TOOL_ID / TOOL_TITLE / 所有魔法字符串
二、纯逻辑层           只做数学与字符串, 绝不碰 AE API
三、测试导出闸门       if (typeof app === "undefined") { module.exports = ...; return; }
四、AE 层              setStatus / diag / getComp / safeRun …
五、UI 尺寸工具        pinW / numBox / fixedBox / sliderRow
六、UI 层              面板构建（顶部版本号 / 参数区 / 按钮 / 说明 / 调试区 / 状态栏）
七、主逻辑             业务实现（单 Undo 组）
八、面板挂载            Panel 模式 vs 独立窗口
```
**闸门位置有硬约束**：所有纯函数之后、任何 AE API 之前，末尾必须 `return`。
上移 → 导出 `undefined`；下移 → node 下先执行 AE 代码而崩。

### 三条铁律（写工程的操作）
1. **先判前置条件**，缺失就「状态栏 + 弹窗」双提示 —— 只写状态栏，用户会以为"按钮坏了"
2. **所有写操作包在一个 Undo 组**里，`finally` 里 `endUndoGroup()` —— 异常也要能收
3. **复用既有图层**（`findLayer`）而不是重复创建 —— 用户点两次不该出现两份

### 所有 handler 必须经 `safeRun`
AE 的 ScriptUI handler 抛错是**完全静默**的（没有控制台）—— 这是"点击没反应"的根源。

## 测试

```bash
node test_PanelTemplate.js     # 派生后: node test_<你的面板>.js
```

两类断言都要留：
- **Ⅰ 业务断言** —— 纯函数行为（自己加）
- **Ⅱ 骨架体检断言** —— 守住上面这些约定本身（模板会被反复复制，骨架腐化了每个新面板都错）

**新增体检断言后必须做反向对照**（故意改坏源码 → 必须变红），否则可能是假绿。

## 部署与验收

```bash
python verify.py      # 语法 / 断言 / 部署一致性 / 技术债清单
python install.py     # 部署（重启 AE 后生效）
```

## 文档四件套

`README.md`（用户向）/ `AGENTS.md`（本文件，Agent 向）/ `DEVELOPMENT.md`（坑记录）/
`CHANGELOG.md`（版本历史）。**改动代码必须同步它们** —— 用 `verify.py` 兜底，别指望记性。

## 基线

> 📌 **文档基线**：2026-09-21 · 面板模板 **v0.1.0** / 仓库 **v1.3.24**
> 由 `_template/` 派生。骨架约定出自 MountainSpectrum v1.5.6 的踩坑史，
> 详见 `../../panels/MountainSpectrum/DEVELOPMENT.md`。
