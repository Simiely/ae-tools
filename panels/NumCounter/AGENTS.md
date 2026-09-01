# AGENTS.md · 项目规则

> 📌 **文档基线**:2026-09-01(v0.1.0) — 首次提交后回填 commit hash
> **更新文档/代码后,请更新此行**(日期 + 新 commit hash),并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects **2026(内部版本 26.0)中文版** + ExtendScript(**ES3**:无 const/let/箭头函数/模板字符串/JSON,语法检查用 `node --check` 复制为 .js)
- ScriptUI Panel 单文件交付,免安装(放 `ScriptUI Panels/`)
- 脚本文件必须 **UTF-8 带 BOM**(ExtendScript 引擎否则中文乱码;install.py 部署时自动补)

## 代码结构

```
单文件 IIFE(ES3)
├─ 纯逻辑层(node 可测, 必须进 test_NumCounter.js):
│   snapToStep(v, step)       把数值吸附到步进倍数
│   formatNumber(v, dec, pre, suf)  带固定小数位的格式化(与表达式一致)
├─ 表达式构建:buildExpr(pre, suf)   拼出 sourceText 表达式(ES3, 逻辑=formatNumber)
├─ 缓动:applyEasing(prop, ease)     写「数值」滑块两帧 temporal ease(失败退化为线性)
├─ 执行:buildCounter(pal)           建文本图层 + 3 滑块 + 关键帧 + 表达式(单 Undo 组)
│       resetInputs(pal)            面板输入重置为默认
├─ 公共:setStatus(pal,msg,rgb) / showDebugError(err)
└─ UI 层:标准面板模式 (thisObj instanceof Panel) 构建参数/字体对齐/按钮/状态
```

**规则**:① 数字格式化改 `snapToStep`/`formatNumber` 必须**同步改 `buildExpr` 的表达式**(两处逻辑一致)并跑 `test_NumCounter.js`;② 纯函数进测试;③ 刷新/执行分离,别交错;④ 新 undo 操作复用 `beginUndoGroup`+`try/finally endUndoGroup`。

## 关键坑(改代码前必读)

1. **ScriptUI Panel 双窗口**:必须 `var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)`,否则从「窗口 > 扩展」打开出现"空 Panel + 新 Window"两个窗口(通用坑)。
2. **表达式按效果序号引用**:`effect(1)("滑块")=数值 / effect(2)("滑块")=步进 / effect(3)("滑块")=小数位`,顺序与添加顺序(数值→步进→小数位)一致;**改名不影响**(序号稳定),但新增效果必须排在 3 之后或同步改表达式。
3. **ES3 隐藏雷**:
   - 本面板未用正则字面量;若将来加正则,禁 `\\`(用字符串方法或 `new RegExp("...")`)。
   - 对象字面量属性名禁保留字(`in/new/var/...`)。
   - **JSON 非 ExtendScript 原生** → 不依赖全局 JSON;`formatNumber` 纯手写字符串拼接,零依赖。
   - `buildExpr` 拼表达式时,前缀/后缀若含英文双引号会被破坏 → 已用 `split('"').join('\\"')` 转义;新增需嵌入用户输入到表达式时务必转义。
4. **TextDocument 属性**:字体/字距/对齐走 `doc.font / doc.tracking / doc.justification`(ParagraphJustification 常量),先 `setValue(doc)` 再设 `sourceText.expression`;**表达式只驱动文本字符串,文档属性保持**(字体/字距不丢)。
5. **等宽锁定消除抖动**:勾选后 `doc.font="Consolas"`(等宽字体每位等宽);比例字体(如默认)数字宽度不等仍会抖 → 面板默认勾选等宽,并提示配合「中/右」对齐最稳。
6. **缓动语义(待真机验证)**:`applyEasing` 用 `KeyframeType.BEZIER` + `KeyframeEase(0, influence)`(influence 合法 0.1~100, 钳到 0.1≈线性);缓入=起慢(首帧慢/末帧线性)、缓出=尾慢、缓入缓出=两端慢。`setInterpolationTypeAtKey`/`setTemporalEaseAtKey` 全部包 try/catch,**失败退化为线性,计数动画照常**(本机无 AE,缓动手感需真机确认)。
7. **单 Undo 组**:`beginUndoGroup` 配 `try/finally { endUndoGroup }`,异常不留半截撤销栈。
8. **无激活合成**:`buildCounter` 先判 `activeItem instanceof CompItem`,否则状态栏提示不报错。

## 约定

- UI 标签用中文;注释用中文;单 `.jsx` 文件交付(`NumCounter.jsx`)。
- 默认:起始 0 / 目标 100 / 帧数 30 / 步进 1 / 小数位 0 / 字距 0 / 等宽锁定开 / 对齐中 / 缓动线性。
- 脚本头部保留 `Version / Description` 注释;版本号变更进 CHANGELOG。
- 动画从**当前时间指示器**开始(用户自行放置 CTI),帧数决定结束时间。
- 生成文本图层名:`数字计数器 <起始>→<目标>`,并选中该层便于继续编辑。

## 常用命令

- 回归测试:`node test_NumCounter.js`(19 项断言,改纯逻辑层必须跑)
- 语法检查:`cp NumCounter.jsx _check.js && node --check _check.js && rm _check.js`
- 补 BOM:Python 前插 `b'\xef\xbb\xbf'`(install.py 部署时自动补)
- 部署:`python install.py`(ae-tools 根目录,自动检测 AE 版本 + BOM + 字节校验)
- 真机验证:重启 AE → 窗口 > 扩展 → NumCounter · 数字计数器
