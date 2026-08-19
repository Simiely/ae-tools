# AGENTS.md · 项目规则

> 📌 **文档基线**:2026-08-19(v0.3.10)
> **更新文档/代码后,请更新此行**(日期 + 新 commit hash),并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects **2015.3+**(依赖 `selectedProperties` API;2026 中文版实测)+ ExtendScript(**ES3**:无 const/let/箭头函数/模板字符串,语法检查用 `node --check` 复制为 .js)
- ScriptUI Panel 单文件交付,免安装(放 `ScriptUI Panels/`)
- 脚本文件必须 **UTF-8 带 BOM**(ExtendScript 引擎否则中文乱码;install.py 部署时自动补)

## 代码结构(v0.3.0 UI 层重构后,按此分层维护)

```
单文件 IIFE(ES3)
├─ 纯逻辑层(node 可测,必须进 test_quickkey.js):
│   anchorPos / computeTimes / classifyValue / buildPlan / planHasExplicit / cellsRaw
│   + 曲线(v0.2.0):matchPreset / curveSegments / mergePresets / validatePresets
│     / isLinearPreset / bezierToEase / valDiff / valSignedDiff(v0.3.7) / clonePreset
├─ 预检层(AE 依赖,不测):propDimCore / propDimOf / easeDimOf / propTypeName
│   / propLayerInfo / dimCheck / failDimCheck
├─ 公共辅助:withUndo(undo 组) / perProp(逐属性执行+计数) / setStatus / propName / errMsg
├─ 执行层:doKey(校验→计划→预检→执行→报告,各调一段) / executePlan(只写 AE+曲线)
│   / buildReport(纯文本) / applyExpression(支线,复用 withUndo+perProp)
│   / applySegCurves(曲线套用,AE 依赖) / setKeyAt / exportPresets / importPresets
└─ UI 层(v0.3.0 重组):
    ├─ 公共:showReport / makeRowPool(行池工厂,节点/段行共用)/
    │        bindNumTab·focusNextNum(Tab 数字框循环)
    ├─ 构建:buildHeader / buildNodeArea / buildCurveArea / buildFooter(各建一块)
    ├─ 刷新:refresh = refreshHeader + refreshNodes + refreshCurve(唯一渲染入口)
    └─ 曲线:syncSegDropdown / rebuildPresetDropdowns
```

**规则**:① 新逻辑能纯函数化就放纯逻辑层并补断言;② 报告与执行永远分离,别再交错;
③ 新的"逐属性操作"必须复用 perProp;④ 新的 undo 操作必须复用 withUndo;
⑤ **UI 控件行一律走 `makeRowPool` 行池工厂**(懒增长 + visible 切换,禁止手写第二套行池);
⑥ **新刷新逻辑放 refreshNodes/refreshCurve/refreshHeader,别往 refresh() 里堆**;
⑦ 行对象引用分组(`it = {row, chk, lbl, inp, vin, tme}`),禁止新开平行对象字典。

## 关键坑(改代码前必读)

1. **ScriptUI Panel 双窗口**:必须 `var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)`,否则从「窗口 > 扩展」打开出现"空 Panel + 新 Window"两个窗口(其他插件已踩过的通用坑)
2. **`selectedProperties` 是打帧目标的唯一来源**:用户在时间轴按 P/S/R/T 展开并选中的属性才在此数组里;选中属性组(PropertyGroup)时 `setValueAtTime` 会抛错,必须 try/catch 逐属性跳过
3. **时间单位**:AE 内部时间是**秒**,节点间隔是**帧**;换算 `comp.time + times[s] * comp.frameDuration`
4. **间隔语义 = 与"靠锚点一侧**最近开启节点(或锚点)**"的帧距(即节点自己的 gap)**:锚点下方节点从锚点累加(`t[i] = 最近开启上一节点 + gap[i]`),上方节点从锚点倒推(`t[i] = 最近开启下一节点 - gap[i]`——**用节点自己的 gap,不是锚点/邻居的**;v0.1.2 曾错写成 `gap[i+1]` 导致中间/末尾帧非均匀间隔时错位,test_quickkey.js 已守护);改这里必须同步改 computeTimes() 和 README 说明
5. **关闭节点 = 完全剔除(v0.1.3 语义变更)**:`computeTimes` 对关闭槽位返回 null,`doKey` 用 `if (!isAnchor && !state.on[s]) continue;` 跳过——不打帧、不占位,后续节点按**最近开启节点**重算(曾为"占位"语义,用户真机实测后改为"跳过";默认关闭的 4/5 号节点会让链条自动跳过它们)
6. **数值存储 = 每空一格数组(v0.1.7)**:`state.val[slot]` 是长度 3 的字符串数组,框对格直读直写;**禁止改回逗号拼接字符串**——v0.1.5/0.1.6 用逗号串,3 空部分填写(如 "123,,")切回 1 空显示正常但解析判非法,是"不上关键帧"的真机 bug(调试报告定位)。`classifyValue(cells, dim)` 返回 {kind: empty|fixed|bad}——empty(全空)→ 用 `prop.value` 当前值;fixed → 数字(1 空)或数组(2/3 空);bad(部分填写/非法字符/框内逗号)→ 可见跳过并计数 badCount
7. **表达式模式(v0.1.5)**:`state.vtype===3` 时点按钮走 `applyExpression`——`prop.expression = expr; prop.expressionEnabled = true`,不排关键帧(表达式覆盖关键帧,排了也白排);节点排程在表达式模式不生效,按钮文案变为「应用表达式(选中属性)」;UI 下拉选项名 = 「表达式」(v0.1.9 起,旧称「公式」)
7b. **打帧失败排查(v0.1.6)**:doKey 逐属性 try/catch 记录 `prop.expressionEnabled` 状态,失败原因进 `lastReport`;**打帧结果为零自动弹报告**——最常见根因是用过公式模式后表达式留在属性上(setValueAtTime 抛错),其次是 2/3 空部分填写被 classifyValue 判 bad;报告里都写明了
7c. **调试按钮**:`showReport()` 用 dialog + 多行 edittext 展示 lastReport;状态栏提示"点「调试」看明细";别在报告字符串里塞过多成功明细(30 节点 × N 属性会爆炸),只记节点行 + 失败行
7d. **数值位数预检(最终方案 v0.1.17/0.1.18)**:执行前用 `dimCheck` 校验,维度判断走 `propDimCore(mn, vt, is3D, isSep)` 纯决策:
    - **分离跟随者(separationLeader 非空)→ 1 维**;OneD → 1 维
    - **变换属性(位置/缩放/锚点/方向)→ 以图层 `threeDLayer` 开关为准**(AE 2026 实测:2D 图层这些属性 `.value` 返回 [x,y,0]、`propertyValueType` 报 6413/6414(ThreeD*),两个 API 都不可靠,唯一真相是 threeDLayer——这是 v0.1.10~0.1.16 反复踩坑、用户三次实测才定案的,**别再改成 value.length 或 propertyValueType**)**
    - **摄像机/灯光图层恒 3D**(无 3D 开关);非变换属性退回 propertyValueType(枚举数值硬编码:ThreeD_SPATIAL=6413/ThreeD=6414/TwoD_SPATIAL=6415/TwoD=6416/OneD=6417)
    - 有任一开启节点填了显式数值(planHasExplicit)才校验;不一致 → `lastReport` + `alert("数值位数不匹配,未执行")` + return,不做任何写入;提示附原始诊断(类型/图层/合成/3D开关)。留空节点不参与;COLOR/自定义/文本等(pd=0)不预检。**v0.1.8 自动广播已被用户否决,别加回去**
8. **undo 组**:`beginUndoGroup` 必须配 `try/finally { endUndoGroup }`,异常时不留半截撤销栈
9. **ScriptUI dropdownlist**:`selection` 必须显式初始化(`ddMode.selection = ddMode.items[0]`),否则 `.selection.index` 为 null 报错
10. **行池复用 + 懒增长,不重建、不全量预建**:节点行 `ensureRows`、曲线段行 `ensureSegRows` 都只补到当前需要数量(曲线段数 = 开启相邻对数);**禁止一次性预建 MAX_COUNT-1=29 行**(每行 5 个原生 ScriptUI 控件,145 控件创建开销大 = 面板打开慢,v0.2.2 实测);checkbox/输入框的 onClick/onChange 闭包捕获 slot(用 IIFE 包住,别用循环变量);锚点行数值输入恒可用,间隔输入隐藏;行数变化后必须 `pal.layout.layout(true)`(节点开关 onClick、曲线开关 onClick、ensureSegRows 新增行时都要)
11. **锚点槽位随 N 变化**:`anchorPos(mode, n)` = 起始 1 / 中间 ⌈N/2⌉ / 末尾 N;改节点数后必须 `ensureRows()` + `refresh()` + `pal.layout.layout(true)` 三连,否则新行不显示或布局错乱
12. **resizeState 只补默认不删值**:节点数缩容再扩容,旧槽位开关/间隔/数值保留(补新槽位默认 on=true、gap=5、val="")
13. **数值框 = 每槽位 3 个 edittext 池**:`vin[slot]` 是数组,按 dim 切换 visible;框 onChange 直写 `state.val[slot][k]`(v0.1.7),**不要在该框 onChange 里调 refresh()**(会把正在编辑的框文本重置);切换 vtype 不丢数据(数组格子原样保留)
14. **Tab 键数字框循环(v0.2.7)**:所有数字输入框(间隔/节点数值/曲线段数值)创建时调 `bindNumTab(box)` 注册进 `numBoxes` 并按创建顺序 Tab 循环(用 onKeyDown 拦 `e.keyName==="Tab"` + `e.preventDefault()` + 下一个可见可用的框 `.active=true`);**新增数字输入框必须调 bindNumTab**,否则 Tab 会跳走;ScriptUI edittext 的 onKeyDown/preventDefault/active 均可用(Adobe 官方示例 + ExtendScript wiki 确认)
14. **曲线功能(v0.2.0/0.2.2)**:「曲线功能」**开关行常驻可见**(checkbox + 导出/导入按钮不藏进隐藏组——否则开关默认关时入口消失,用户永远勾不到,v0.2.2 修复);**段 = 开启节点的相邻对**(`curveSegments(on, count)`,关闭节点断开链条、段随开关重排——关闭剔除语义的自然延伸,不是固定槽位对);段状态 `state.curve.seg[i]` 按段序号存(ensureCurveSeg 补齐默认线性),段数变化值保留;段行懒增长 `ensureSegRows`
15. **预设下拉交互**:下拉 items = [「自定义」, ...state.curve.presets(内置 4 + 导入)];`syncSegDropdown` 用 `matchPreset`(浮点容差 1e-4)匹配 4 值——命中 → 显示预设名,否则「自定义」;**选预设 → 填 4 空(直接写 segIn 文本,不调 refresh)**;**手填 4 空 → 只调 syncSegDropdown(别调 refresh,别写回文本)**,否则正在编辑的框会被重置
16. **导出/导入预设**:导出 = `state.curve.presets` 全部(内置 + 已导入)→ JSON `{version:1, presets:[{name,x1,y1,x2,y2}]}`,`File.saveDialog` 默认当前工程目录,`f.encoding="UTF-8"`(中文名不乱码);**序列化用 `stringifyPresets`、解析用 `parsePresetsText`(自包含,勿依赖全局 JSON,见坑 18)** → `mergePresets` 同名覆盖 → `rebuildPresetDropdowns()` 重建全部段下拉(removeAll + add,不要重建控件)
17. **曲线套用(打帧时,v0.2.12 重写 / 0.2.14 修线性端点 / 0.2.15 端点平滑 / 0.3.7 修减少方向)**:① 打帧用 **`setKeyAt(prop, t, wv)`**——“创建即得索引”:先按时间找已有帧(容差 ±0.05s)复用其索引,无则 `prop.addKey(t)` 直接返回新帧索引(官方文档:addKey "returns the index of the new keyframe"),`setValueAtKey` 设值;addKey 异常兜底 setValueAtTime+numKeys。**严禁回到"打完再按时间找索引"**(真机「3 索引无效」;社区确认 AE 关键帧放置有精度问题,Paul Tuersley)。② 转换公式集中在 **`bezierToEase(x1,y1,x2,y2,avg)`(纯函数)**:线性(0 0 1 1)→ null;非线性 → X 坐标→影响(x1×100、[1−x2]×100,钳 0.1~100 取整 1 位)、Y 坐标→速度(y1×avg/x1、[1−y2]×avg/[1−x2],除零退 avg)。**avg 必须带符号(v0.3.7):段平均速度 = `valSignedDiff(后值, 前值)/dt`(数字 a−b;数组取最大绝对差分量的带符号差)——严禁用 valDiff(绝对值),否则值减少时速度恒正、方向反(KeyframeEase.speed 官方浮点无正负限制,AE 值减少显示负速度)**。③ `applySegCurves(prop, frames, segs, smoothEnd)` 只做组装:逐段调 bezierToEase → 缓动按【帧索引】直存 inEase[k]/outEase[k](帧 k 出 = 段 k 出,帧 k+1 入 = 段 k 入;首帧入/末帧出 = NEUTRAL)→ 逐帧「**两侧段都线性(或边界无段)才跳过**」,否则先 `setInterpolationTypeAtKey(idx, BEZIER, BEZIER)` 再 `setTemporalEaseAtKey(idx, easeArr, easeArr)`。**线性段端点缓动 = `KeyframeEase(段平均速度, 0.1)`(线性 = 匀速,官方文档 "uniform rate of change";avg 同样带符号)——严禁速度 0**(v0.2.14 真机 bug:曲线段末帧端点被线性侧速度 0 "僵直"变形;全线性场景仍完全不动保持默认 LINEAR)。**端点平滑 smoothEnd(v0.2.15)**:首段「出」/末段「入」速度强制 0(曲线两端水平圆润),端点邻接线性段时线性端点速度也置 0,首/末帧即使两侧段都线性也不跳过(转 BEZIER);「硬」(默认)行为完全不变。**AE 侧三个硬约束:插值必须 BEZIER**(setValueAtTime/addKey 打的帧默认 LINEAR,直接设缓动不生效 v0.2.3);**缓动参数是数组且长度按官方规则 `easeDimOf(prop, v)`(v0.2.16)**:SPATIAL 属性(位置/锚点/方向,matchName 判断)**恒 1 个**,缩放等非空间按实际值 v 维度(2D→2、3D→3)——**严禁用 propDimOf 或 propertyValueType 算缓动数组长度**(AE 2026 的 2D 锚点报 ThreeD_SPATIAL 且缓动只收 1 个,propDimOf 返回 2 报「值数组没有 1 元素」,v0.2.16 真机 bug);**influence 合法 [0.1..100]**(传 0 构造抛错整段失败,NEUTRAL 钳 0.1,v0.2.8)。missed 细分 missIdx(索引无效)/missErr(调用抛错带文本),报告直接显示。**改 applySegCurves/bezierToEase/setKeyAt 必须跑 test_quickkey.js mock 核验**(已模拟真实约束 + addKey 索引 + failEase 抛错 + 线性端点匀速 + 平滑端点 + 减少方向断言)。表达式模式禁用曲线(vtype===3 直接走 applyExpression)
18. **ExtendScript 三个隐藏雷(真机踩坑)**:
    - **禁止在正则字面量里写 `\\`(双反斜杠)**——ExtendScript 解析器报「语法错误」(node/V8 能过,node --check 拦不住;真机报「行 794 无法执行脚本」,v0.2.1)。需要匹配反斜杠时改用字符串方法(indexOf/lastIndexOf/substring)或 `new RegExp("...")` 字符串构造
    - **对象字面量属性名禁止用 ES3 保留字**(如 `in`/`new`/`var`/`default` 等)——报「非法使用保留字」(node 现代引擎允许保留字做属性名,node --check 拦不住;真机报「行 237 无法执行脚本」,v0.2.13 bezierToEase 的 `{out, in}` 踩坑)。属性名改用非保留字(如 `inE`);**新增对象字面量后 grep 一遍 `(?:[{,]\s*)(in|new|var|...)\s*:`**
    - **JSON 不是 ExtendScript 原生内置**(ECMA-262 v3,ES5 才有 JSON.parse/stringify;能用是因为 Adobe Libraries 等面板把 JSON 泄漏进共享全局)。**禁止直接依赖全局 JSON**——一律用本项目自带的迷你 JSON:曲线预设用 `stringifyPresets`/`parsePresetsText`(退回 `extractPresetsFallback`);全参数配置(v0.3.5)用 `stringifyConfig`/`parseConfigText`(退回 `extractParamsFromBlock` + `extractSlotsFallback`),全程零正则字面量

## 约定

- UI 标签用中文;注释用中文;单 .jsx 文件交付
- 节点数默认 3(1~30,v0.3.4),模式默认「起始帧」,数值输入默认「1 个空」,间隔默认 5 帧;数值列默认全空(= 用当前值)
- 数值输入规则:`classifyValue` 每空一格;1 空 = 单值(自动广播多维),2 空 = 二维(位置/缩放/锚点),3 空 = 三维(3D 图层);表达式模式写 AE 表达式,不排帧
- UI 行顺序:节点数 → 模式 → 数值输入 → 表达式 → 节点表 → 曲线区(开关+导出导入+段行)→ **预设管理(存储/使用/复位/清除/导出配置/导入配置,v0.3.5)** → 打帧/调试 → 状态栏
- 操作结果提示写面板底部 statusBar,不用 alert 弹窗(仅"未激活合成"用弹窗)
- 槽位顺序:上早下晚(槽位 1 最早上);锚点槽位 = `anchorPos(state.mode, state.count)`
- 曲线默认:功能关;预设 = 内置 4 个(线性/缓入/缓出/缓入缓出,v0.3.10 回退去 cubic);段默认线性
- **预设管理(v0.3.5)**:4 槽位,存储/使用/清除/复位;双层持久化(工程 `quickkey_配置.json` 读优先 + app.settings Section=QuickKey 保底);导出配置 = 全量备份(当前参数+槽位+曲线库)。**载入/复位一律走「改 state → refresh() → layout」单向流,禁止直接改控件**;collectParams/applyParamsToState 是纯函数,改动必须跑测试
- 发布:push 到 GitHub(仓库 public,用 PAT + 代理 7890)

## 常用命令

- 回归测试:`node test_quickkey.js`(158 项断言,改纯逻辑层函数必须跑)
- 语法检查:`cp QuickKey.jsx _check.js && node --check _check.js && rm _check.js`
- 补 BOM:Python 前插 `b'\xef\xbb\xbf'`
- 部署:`python install.py`(ae-tools 根目录,自动检测 AE 版本 + BOM + 字节校验)
- 真机验证:重启 AE → 窗口 > 扩展 → QuickKey
