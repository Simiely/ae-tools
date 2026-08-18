# AGENTS.md · 项目规则

> 📌 **文档基线**:2026-08-18(v0.1.0 初始)
> **更新文档/代码后,请更新此行**(日期 + 新 commit hash),并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects **2015.3+**(依赖 `selectedProperties` API;2026 中文版实测)+ ExtendScript(**ES3**:无 const/let/箭头函数/模板字符串,语法检查用 `node --check` 复制为 .js)
- ScriptUI Panel 单文件交付,免安装(放 `ScriptUI Panels/`)
- 脚本文件必须 **UTF-8 带 BOM**(ExtendScript 引擎否则中文乱码;install.py 部署时自动补)

## 关键坑(改代码前必读)

1. **ScriptUI Panel 双窗口**:必须 `var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)`,否则从「窗口 > 扩展」打开出现"空 Panel + 新 Window"两个窗口(其他插件已踩过的通用坑)
2. **`selectedProperties` 是打帧目标的唯一来源**:用户在时间轴按 P/S/R/T 展开并选中的属性才在此数组里;选中属性组(PropertyGroup)时 `setValueAtTime` 会抛错,必须 try/catch 逐属性跳过
3. **时间单位**:AE 内部时间是**秒**,节点间隔是**帧**;换算 `comp.time + times[s] * comp.frameDuration`
4. **间隔语义 = 与"靠锚点一侧**最近开启节点(或锚点)**"的帧距(即节点自己的 gap)**:锚点下方节点从锚点累加(`t[i] = 最近开启上一节点 + gap[i]`),上方节点从锚点倒推(`t[i] = 最近开启下一节点 - gap[i]`——**用节点自己的 gap,不是锚点/邻居的**;v0.1.2 曾错写成 `gap[i+1]` 导致中间/末尾帧非均匀间隔时错位,test_quickkey.js 已守护);改这里必须同步改 computeTimes() 和 README 说明
5. **关闭节点 = 完全剔除(v0.1.3 语义变更)**:`computeTimes` 对关闭槽位返回 null,`doKey` 用 `if (!isAnchor && !state.on[s]) continue;` 跳过——不打帧、不占位,后续节点按**最近开启节点**重算(曾为"占位"语义,用户真机实测后改为"跳过";默认关闭的 4/5 号节点会让链条自动跳过它们)
6. **数值语义**:每节点「数值」列 = 打帧值,支持逗号分隔多维(`parseValue` 返回 null = 留空 → 用 `prop.value` 当前值);维度不匹配时 setValueAtTime 抛错,计数 badCount 并在状态栏提示,**不静默回退当前值**(用户显式填了数值就该看到没生效)
7. **undo 组**:`beginUndoGroup` 必须配 `try/finally { endUndoGroup }`,异常时不留半截撤销栈
8. **ScriptUI dropdownlist**:`selection` 必须显式初始化(`ddMode.selection = ddMode.items[0]`),否则 `.selection.index` 为 null 报错
9. **节点区 = 行池复用,不重建**:节点数 1~30 动态(v0.1.4),预建足量行、按 count 切换 `visible`,避免 ScriptUI 增删行;锚点行随模式变化,refresh() 改每行 visible/enabled/文本;checkbox/输入框的 onClick/onChange 闭包捕获 slot(用 IIFE 包住,别用循环变量);锚点行数值输入恒可用,间隔输入隐藏
10. **锚点槽位随 N 变化**:`anchorPos(mode, n)` = 起始 1 / 中间 ⌈N/2⌉ / 末尾 N;改节点数后必须 `ensureRows()` + `refresh()` + `pal.layout.layout(true)` 三连,否则新行不显示或布局错乱
11. **resizeState 只补默认不删值**:节点数缩容再扩容,旧槽位开关/间隔/数值保留(补新槽位默认 on=true、gap=5、val="")

## 约定

- UI 标签用中文;注释用中文;单 .jsx 文件交付
- 节点数默认 5(1~30),模式默认「起始帧」,间隔默认 5 帧,节点 1~3 开、4~5 关;数值列默认全空(= 用当前值)
- 数值输入规则:`parseValue` 逗号分隔,多维属性如位置 `960, 540`、缩放 `100, 100`;单维直接填数字(旋转度/不透明度 0~100/缩放百分比)
- 操作结果提示写面板底部 statusBar,不用 alert 弹窗(仅"未激活合成"用弹窗)
- 槽位顺序:上早下晚(槽位 1 最早上);锚点槽位 = `anchorPos(state.mode, state.count)`
- 状态只存在内存,不持久化(关闭面板重置;后续可加 settings 文件)
- 发布:push 到 GitHub(仓库 public,用 PAT + 代理 7890)

## 常用命令

- 回归测试:`node test_quickkey.js`(29 项断言,改 computeTimes/parseValue/anchorPos 必须跑)
- 语法检查:`cp QuickKey.jsx _check.js && node --check _check.js && rm _check.js`
- 补 BOM:Python 前插 `b'\xef\xbb\xbf'`
- 部署:`python install.py`(ae-tools 根目录,自动检测 AE 版本 + BOM + 字节校验)
- 真机验证:重启 AE → 窗口 > 扩展 → QuickKey
