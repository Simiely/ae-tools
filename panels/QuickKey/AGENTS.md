# AGENTS.md · 项目规则

> 📌 **文档基线**:2026-08-18(v0.1.18)
> **更新文档/代码后,请更新此行**(日期 + 新 commit hash),并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects **2015.3+**(依赖 `selectedProperties` API;2026 中文版实测)+ ExtendScript(**ES3**:无 const/let/箭头函数/模板字符串,语法检查用 `node --check` 复制为 .js)
- ScriptUI Panel 单文件交付,免安装(放 `ScriptUI Panels/`)
- 脚本文件必须 **UTF-8 带 BOM**(ExtendScript 引擎否则中文乱码;install.py 部署时自动补)

## 代码结构(v0.1.14 重构后,按此分层维护)

```
单文件 IIFE(ES3)
├─ 纯逻辑层(node 可测,必须进 test_quickkey.js):
│   anchorPos / computeTimes / classifyValue / buildPlan / planHasExplicit / cellsRaw
├─ 预检层(AE 依赖,不测):propDimOf / propLayerInfo / dimCheck / failDimCheck
├─ 公共辅助:withUndo(undo 组) / perProp(逐属性执行+计数) / setStatus / propName / errMsg
├─ 执行层:doKey(校验→计划→预检→执行→报告,各调一段) / executePlan(只写 AE)
│   / buildReport(纯文本) / applyExpression(支线,复用 withUndo+perProp)
└─ UI 层:面板构建 / addRow·ensureRows(行池) / refresh / showReport
```

**规则**:① 新逻辑能纯函数化就放纯逻辑层并补断言;② 报告与执行永远分离,别再交错;
③ 新的"逐属性操作"必须复用 perProp;④ 新的 undo 操作必须复用 withUndo。

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
10. **节点区 = 行池复用,不重建**:节点数 1~30 动态(v0.1.4),预建足量行、按 count 切换 `visible`,避免 ScriptUI 增删行;锚点行随模式变化,refresh() 改每行 visible/enabled/文本;checkbox/输入框的 onClick/onChange 闭包捕获 slot(用 IIFE 包住,别用循环变量);锚点行数值输入恒可用,间隔输入隐藏
11. **锚点槽位随 N 变化**:`anchorPos(mode, n)` = 起始 1 / 中间 ⌈N/2⌉ / 末尾 N;改节点数后必须 `ensureRows()` + `refresh()` + `pal.layout.layout(true)` 三连,否则新行不显示或布局错乱
12. **resizeState 只补默认不删值**:节点数缩容再扩容,旧槽位开关/间隔/数值保留(补新槽位默认 on=true、gap=5、val="")
13. **数值框 = 每槽位 3 个 edittext 池**:`vin[slot]` 是数组,按 dim 切换 visible;框 onChange 直写 `state.val[slot][k]`(v0.1.7),**不要在该框 onChange 里调 refresh()**(会把正在编辑的框文本重置);切换 vtype 不丢数据(数组格子原样保留)

## 约定

- UI 标签用中文;注释用中文;单 .jsx 文件交付
- 节点数默认 5(1~30),模式默认「起始帧」,数值输入默认「1 个空」,间隔默认 5 帧,节点 1~3 开、4~5 关;数值列默认全空(= 用当前值)
- 数值输入规则:`classifyValue` 每空一格;1 空 = 单值(自动广播多维),2 空 = 二维(位置/缩放/锚点),3 空 = 三维(3D 图层);表达式模式写 AE 表达式,不排帧
- UI 行顺序:节点数 → 模式 → 数值输入 → 表达式(节点数在最顶,v0.1.9)
- 操作结果提示写面板底部 statusBar,不用 alert 弹窗(仅"未激活合成"用弹窗)
- 槽位顺序:上早下晚(槽位 1 最早上);锚点槽位 = `anchorPos(state.mode, state.count)`
- 状态只存在内存,不持久化(关闭面板重置;后续可加 settings 文件)
- 发布:push 到 GitHub(仓库 public,用 PAT + 代理 7890)

## 常用命令

- 回归测试:`node test_quickkey.js`(39 项断言,改纯逻辑层函数必须跑)
- 语法检查:`cp QuickKey.jsx _check.js && node --check _check.js && rm _check.js`
- 补 BOM:Python 前插 `b'\xef\xbb\xbf'`
- 部署:`python install.py`(ae-tools 根目录,自动检测 AE 版本 + BOM + 字节校验)
- 真机验证:重启 AE → 窗口 > 扩展 → QuickKey
