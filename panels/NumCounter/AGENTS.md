# AGENTS.md · 项目规则

> 📌 **文档基线**:2026-09-02（commit `9d1899c`）NumCounter v0.2.9（文档同步：架构描述对齐 odometer 实现 buildSlotExpr + 数位 N 独立层 + 控制空对象 NumCounter 控制；明确步进语义=显示最小单位/非每帧步进；测试断言 19→60；4 槽位预设写入文档；缓动本地验证通过）
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
│   snapToStep(v, step)       把数值吸附到步进倍数(显示最小单位,非每帧步进)
│   formatNumber(v, dec, pre, suf)  带固定小数位的格式化(与表达式一致)
├─ 表达式构建:buildSlotExpr(slotIndex, slotCount, ctrlName)   每位独立文本图层的 sourceText 表达式(ES3, 逻辑=formatNumber)
├─ 缓动:applyEasing(prop, ease)     写「数值」滑块两帧 temporal ease(失败退化为线性)
├─ 执行:buildCounter(pal)           建 N 个独立数位文本图层 + 控制空对象(含 3 滑块) + 关键帧 + 表达式(单 Undo 组)
│       resetInputs(pal)            面板输入重置为默认
├─ 预设槽:saveSlot/loadSlot/clearAllSlots/exportSlots/importSlots  + presetsCache["1".."4"] 内存缓存 + 工程目录 NumCounter.presets.json
├─ 公共:setStatus(pal,msg,rgb) / showDebugError(err)
└─ UI 层:标准面板模式 (thisObj instanceof Panel) 构建参数/字体对齐/按钮/状态
```

**规则**:① 数字格式化改 `snapToStep`/`formatNumber` 必须**同步改 `buildSlotExpr` 的表达式**(两处逻辑一致)并跑 `test_NumCounter.js`;② 纯函数进测试;③ 刷新/执行分离,别交错;④ 新 undo 操作复用 `beginUndoGroup`+`try/finally endUndoGroup`。

## 关键坑(改代码前必读)

1. **ScriptUI Panel 双窗口**:必须 `var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)`,否则从「窗口 > 扩展」打开出现"空 Panel + 新 Window"两个窗口(通用坑)。
2. **表达式按效果序号引用**:`effect(1)("滑块")=数值 / effect(2)("滑块")=步进 / effect(3)("滑块")=小数位`,顺序与添加顺序(数值→步进→小数位)一致;**改名不影响**(序号稳定),但新增效果必须排在 3 之后或同步改表达式。
3. **ES3 隐藏雷**:
   - 本面板未用正则字面量;若将来加正则,禁 `\\`(用字符串方法或 `new RegExp("...")`)。
   - 对象字面量属性名禁保留字(`in/new/var/...`)。
   - **JSON 非 ExtendScript 原生** → 不依赖全局 JSON;`formatNumber` 纯手写字符串拼接,零依赖。
   - `buildSlotExpr` 拼每位表达式时,槽位索引/总槽数直接写死进表达式;若将来嵌入用户输入(如字体名)到表达式,务必转义英文双引号(已用 `split('"').join('\\"')` 思路)。
4. **TextDocument 属性**:字体/字距/对齐走 `doc.font / doc.tracking / doc.justification`(ParagraphJustification 常量),先 `setValue(doc)` 再设 `sourceText.expression`;**表达式只驱动文本字符串,文档属性保持**(字体/字距不丢)。
5. **等宽锁定消除抖动**:勾选后 `doc.font="Consolas"`(等宽字体每位等宽);比例字体(如默认)数字宽度不等仍会抖 → 面板默认勾选等宽,并提示配合「中/右」对齐最稳。
6. **缓动语义(2026-09-02 本地验证通过, AE 26.0)**:`applyEasing` 用 `KeyframeType.BEZIER` + `KeyframeEase(0, influence)`(influence 合法 0.1~100, 钳到 0.1≈线性);缓入=起慢(首帧慢/末帧线性)、缓出=尾慢、缓入缓出=两端慢。`setInterpolationTypeAtKey`/`setTemporalEaseAtKey` 全部包 try/catch,**失败退化为线性,计数动画照常**(2026-09-02 本地验证可用)。
7. **单 Undo 组**:`beginUndoGroup` 配 `try/finally { endUndoGroup }`,异常不留半截撤销栈。
8. **无激活合成**:`buildCounter` 先判 `activeItem instanceof CompItem`,否则状态栏提示不报错。
9. **步进语义(显示最小单位, 非每帧步进)**:`步进`(step) 是显示值的吸附粒度, 数值按帧数连续(线性/缓动)插值, 表达式仅 `Math.round(val/step)*step` 把显示值取整到最近 step 倍数; 节奏由帧数/缓动决定, 与 step 无关。step=0 则不吸附、连续递增; 终点显示值取最近 step 倍数(如 0→97 步进 5 末值显示 95), 不保证等于 target。
10. **预设槽(4 固定槽位, v0.2.7 起)**:对齐仓库 AE-Lyrics-Animator 等「预设槽」实践。`presetsCache["1".."4"]` 内存缓存 + 工程目录 `NumCounter.presets.json` 持久化(刻意避开会崩的 `app.settings`)。空槽位 = null(对应「使用」按钮灰禁用)。⚠️ 槽位索引全局 1-based; UI 闭包 `idx` 为 0-based, `onClick` 必须传 `idx+1`(v0.2.9 修复的坑, 否则存 "0".."3" 但读 "1".."4" 全灰)。

## 约定

- UI 标签用中文;注释用中文;单 `.jsx` 文件交付(`NumCounter.jsx`)。
- 默认:起始 0 / 目标 100 / 帧数 30 / 步进 1 / 小数位 0 / 字距 0 / 等宽锁定开 / 对齐中 / 缓动线性。
- 脚本头部保留 `Version / Description` 注释;版本号变更进 CHANGELOG。
- 动画从**当前时间指示器**开始(用户自行放置 CTI),帧数决定结束时间。
- 生成产物: N 个独立数位文本图层 `数位 0..N-1`(各带截取自己那一位的 sourceText 表达式) + 控制空对象 `NumCounter 控制`(含 数值/步进/小数位 3 滑块);动画锚定当前时间指示器,帧数决定结束时间。

## 常用命令

- 回归测试:`node test_NumCounter.js`(60 项断言,实测全过;改纯逻辑层必须跑)
- 语法检查:`cp NumCounter.jsx _check.js && node --check _check.js && rm _check.js`
- 补 BOM:Python 前插 `b'\xef\xbb\xbf'`(install.py 部署时自动补)
- 部署:`python install.py`(ae-tools 根目录,自动检测 AE 版本 + BOM + 字节校验)
- 真机验证:重启 AE → 窗口 > 扩展 → NumCounter · 数字计数器
