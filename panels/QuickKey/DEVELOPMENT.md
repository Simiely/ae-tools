# DEVELOPMENT.md · 架构与问题记录

> 一坑一篇,按时间倒序。只记录"代码里看不出的信息"。

## v0.3.11(2026-08-19)—「使用存储」后数值类型下拉不刷新:refresh 没把 state 同步回控件

### 起因

真机:「使用存储 1-4」恢复槽位后,「数值输入」下拉(1 空/2 空/3 空/表达式)
停留旧值,界面与实际 state 不一致。

### 根因

预设管理走「改 state → refresh()」单向流(v0.3.5 定案),refresh = refreshHeader
+ refreshNodes + refreshCurve。但 v0.3.0 拆分后 `refreshHeader` **只刷新了
表达式行显隐和按钮文案**(grpExpr.visible / btnKey.text),从未把 state 同步回
头部控件;`refreshCurve` 也只刷段行,不刷曲线总开关/端点平滑。而「使用存储」
恢复的恰是 mode/count/vtype/expr/curveEnabled/curveSmoothEnd 这些字段——
state 变了,控件不动。

控件还是 buildHeader/buildCurveArea 的**局部变量**(var ddType 等),外层
refresh 函数根本访问不到——所以不是"漏写一行",是作用域设计导致的必然缺失。

### 修复

1. 相关控件提升到 isAe 块作用域(cntInp/ddMode/ddType/exprInp/chkCurve/chkSmooth),
   build 时赋值(去掉 var)
2. refreshHeader 同步:ddMode.selection / cntInp.text / ddType.selection /
   exprInp.text(程序设置 selection/text 不触发 onChange/onClick,无副作用)
3. refreshCurve 同步:chkCurve.value / chkSmooth.value

### 验证

- 158 断言不变(纯 UI 层);语法 ✓ BOM ✓ 已部署
- 待真机:「使用存储」看 4 个头部控件 + 2 个曲线开关是否全部跟随;「复位」
  「导入配置」同路径,一并验证

### 教训(已写入 AGENTS 坑 12b)

「改 state → refresh()」单向流里,refresh 函数必须同步**所有从 state 读取**的
控件,新增控件即加同步;控件声明统一放 isAe 块作用域,别留局部。

## v0.3.9(2026-08-19)— 导出文件可读性优化:单行 + 分组 + 备注(仍是标准 JSON)

### 起因

用户反馈:导出 JSON 每条预设多行嵌套可读性差(且用户会手动编辑后重新导入),
要求"适当的段行和备注"。

### 方案(关键约束:保持标准 JSON)

- JSON 标准**不支持注释**——"备注"用顶层 `_comment` 字段实现,合法且解析端忽略
  (validatePresets / parseConfigText 只取已知键,`_comment` 天然被跳过)
- "段行"用数组元素间**空行**实现(JSON 规范允许任意空白)
- 分组依据:内置预设名集合 `PRESETS_DEFAULT`(isBuiltinPresetName),导出时
  内置一组、导入一组,组间空行
- 每条预设压缩为单行 `{ "name": ..., "x1": ..., ... }`,配置参数一行一个

### 踩坑(本次真机测试暴露)

1. 重写 `stringifyPresets` 时**忘了在数组元素间加逗号**(原版用
   `parts.join(",\n  ")` 隐式加逗号,新版逐行 push 漏掉)→ 导出文件
   `JSON.parse` 报 "Expected ',' or ']' after array element"。
   **教训:手写 JSON 拼接后必须用 JSON.parse 验证 round-trip 再发布**——
   presetBodyLines 在非末行元素后补逗号
2. `_comment` 文案必须避开:花括号(会干扰手写提取的块扫描)、带引号的键名
   (grabStr/grabNum 按 `"key"` 匹配)、数字键形式(干扰 extractPresetsFallback)
   ——文案统一用 `name / x1 / y1 / x2 / y2` 无引号表述

### 验证

- 测试 155 → 158 断言(_comment 存在 + 内置/导入分组空行);全部通过
- 手写提取回退路径(extractPresetsFallback / extractParamsFromBlock)对新格式
  兼容——已由既有断言覆盖(extractPresetsFallback 手写分支仍 == PEX)

## v0.3.8(2026-08-19)— 动效整理报告:节点行毫秒 + 标题帧率标注

### 需求

真机反馈:动效整理报告只显示帧偏移(+6 帧),核对时间预算时要心算秒数。
要求节点行追加毫秒(30fps 下 +6 帧 = 200ms),并标注帧率基准。

### 实现要点

- 换算基准 = **工程实际帧率**(`1/comp.frameDuration`),不用固定 30——
  用户确认"按工程帧率计算,需标注工程帧率",非 30fps 工程自动准确
- 毫秒 = `Math.round(offset × frameDuration × 1000)`;锚点(+0 帧)不显示
- 标题行:`────── 动效整理 (30fps) ──────`,fps 保留 3 位
  (`Math.round(fps×1000)/1000`,29.97/23.976 如实显示)
- 纯展示增强,`buildReport` 拼接逻辑,无状态/无纯逻辑层改动,155 断言不变

## v0.3.7(2026-08-19)— 曲线在数值"减少"时方向反:avg 必须带符号

### 起因

真机:曲线功能对"值增加"(0→100)正常,值减少(不透明度 100→0、位置 960→460)时
缓动方向错乱,像"反向缓动"。

### 根因(官方文档定案)

`applySegCurves` 算段平均速度用的是 `valDiff`,而 `valDiff` 返回**绝对值**
(`Math.abs(a-b)`、数组取最大分量差)→ `avg` 恒 ≥ 0 → `bezierToEase` 的速度
`y1×avg/x1`、`(1−y2)×avg/(1−x2)` 恒正。

但 AE 的速度语义是**带符号**的,三处可信源一致:
- Adobe 官方 `KeyframeEase.speed`:"A floating-point value",无正负限制,可读写
- AE Keyframe Velocity 面板:值从高到低时显示**负速度**
  (社区教学确认:"going from a higher number to a lower number, it's interpreting
  that as a negative velocity. The curve is the exact same shape, it's just inverted.")
- AE 表达式 `velocity` 官方文档:"根据运动方向会出现负值的速度"

值 100→0 时真实速度应为 −100,代码给了 +100 → 方向反,曲线形状错乱。
线性段端点匀速(v0.2.14 的 `linSpd = avg`)在混合/平滑场景同样受影响。

### 修复

新增纯函数 **`valSignedDiff(a, b)`**(与 `valDiff` 语义对称):
- 数字 → `a - b`(带符号)
- 数组 → 取"最大绝对差分量"的带符号差(`[960,540]→[460,540]` 得 −500)
- 其他 → 0

`applySegCurves` 的 `avg` 改用 `valSignedDiff`,符号自然贯穿到 `bezierToEase`
(本体零改动)与线性端点 `linSpd`。influence 与方向无关不动;端点平滑不受影响。
0→100 得 +100(现行为不变,不回归);100→0 得 −100(修复)。

### 验证

- 测试 135 → **155 断言**:`valSignedDiff` 6 条(数字增/减、数组单轴减、数组增取最大分量、
  同值、类型不匹配)+ `bezierToEase` 负 avg 3 条(缓入/缓出/线性)+ `applySegCurves`
  减少方向端到端 3 条(值 200→100→0,断言 `eiSpd=-100` 贯穿)
- 全部通过;`node --check` 语法 ✓;BOM ✓

### 注意

多维属性混合方向(如 x 增 y 减)时,单标量 `avg` 只能取"最大绝对差分量"的方向,
是现有架构的固有近似(单轴变化完全正确)。若以后要逐维缓动需重做曲线模型,暂不做。

## v0.3.5(2026-08-19)— 全参数预设管理:4 槽位 + 双层持久化 + 导出导入

### 方案来源

对齐 AE-Lyrics-Animator → Rolling-Lyrics → Water-Rise 三代插件:
4 槽位(存储/使用/复位/清除)+ 双层持久化(工程目录 JSON 跟工程走、读优先
+ app.settings 全局保底)。QuickKey 参数集中在 state(单向流),所以收集/回填
直接操作 state,比从 UI 控件读更可靠。

### 关键设计决策(代码里看不出的)

1. **参数扁平化编码**(on 开关串 / gap 逗号 / val 槽位 `|` 格 `,` / curveSeg
   段 `|` 字段 `,`):让"手写 JSON 兜底解析"可行——ExtendScript 无原生 JSON,
   全量配置嵌套深,手写通用递归解析器不可维护;扁平结构 + grabStr/grabNum
   逐字段提取(extractParamsFromBlock)足够简单可靠
2. **槽位空 = `{}` 而非 null**:手写块解析按 `{..}` 顺序映射槽位 1-4,
   null 会破坏位置计数;空对象字段全缺 = 空槽位
3. **启动只恢复槽位、不覆盖当前参数**:loadSlotsFromStorage 仅填充
   state.slots(工程 JSON 优先,app.settings 保底),当前面板参数保持默认
4. **载入走「改 state → refresh → layout」单向流**:loadSlot/resetParams/
   importConfig 都不直接碰控件,避免状态与 UI 脱节(曲线预设导入同规则)
5. **导出配置 = 全量备份**(当前参数 + 4 槽位 + 曲线库),与曲线区
   「导出/导入预设」(只管曲线库)分工;`splitBy` 自写(零正则、不依赖 split)

### 验证

collectParams/applyParamsToState round-trip、关闭剔除段数、配置序列化解析、
手写解析路径全覆盖(116 → 135 断言);待真机验证双层持久化与导出导入。

## v0.3.0(2026-08-19)— UI 层重构:行池工厂 + 构建分块 + 刷新拆分(阶段 1:主线)

### 起因

用户要求按"最好优化效果"重构(程序量小,风险可控),先主线后支线。
上次评估:主线 8.5 / 支线 8 / 模块化 7.5(整体)/ 6.5(UI)——扣分集中在
UI 层:两套行池重复、refresh() 过载、控件引用分散。

### 重构内容(纯逻辑/预检/执行层一行未动)

1. **makeRowPool 行池工厂**:统一"懒增长 + visible 切换",返回
   {rows, ensure(need), hideAll, get(i)};节点行/段行共用,消除重复模式
2. **构建分块**:buildHeader / buildNodeArea / buildCurveArea / buildFooter
   ——每个函数只建自己那块 UI,控件引用作为行对象返回
3. **刷新拆分**:refresh = refreshHeader + refreshNodes + refreshCurve
   ——原 refresh 干 4 件事(节点/按钮文案/曲线/布局),现在每块管一件事
4. **行对象引用**:it = {row, chk, lbl, inp, vin, tme} / {row, lbl, dd, ins},
   取代平行对象字典(chk[slot]/lbl[slot]/...)——引用随行走,闭包捕获天然正确

### 验证

116 断言全过(纯逻辑未动)、语法 ✓、BOM ✓、已部署。行为零变化:
事件仍是"瘦处理器 → state → refresh"单向流;行池懒增长性能不变。

### 待真机

重启 AE 全功能回归(打帧/曲线/端点平滑/Tab 循环/表达式/导出导入)。
验证通过后进入阶段 2(支线:表达式/导出导入/调试收尾检查)。

## v0.2.16(2026-08-19)— SPATIAL 属性缓动数组长度=1(「值数组没有 1 元素」)

### 起因

1 个空(旋转,OneD)曲线正常;2 个空(锚点,2D_SPATIAL)报
「由于参数 2,无法调用 setTemporalEaseAtKey。值数组没有 1 元素」。

### 根因(官方指南定案)

manualslib 收录的 Adobe 官方脚本指南 p147:

> "The dimension of the array depends on the property's keyframeValueType.
> For ThreeD, 3. For TwoD, 2. **For all other keyframeValueTypes, including
> TwoD_SPATIAL and ThreeD_SPATIAL types, it is 1.**"

即:**SPATIAL 属性(位置/锚点/方向)即使 2D/3D,缓动数组也只收 1 个**
(Paul Tuersley 社区确认 Position 只有一组速度缓动)。我们此前用
propDimOf(锚点 2D→2)生成 2 个元素的数组 → AE 拒绝。

### 修复

新增 `easeDimOf(prop, v)`:
- SPATIAL(matchName = ADBE Position / Anchor Point / Orientation)→ 恒 1
- 缩放等非空间 → 按实际写入值 v 的维度(数组长度:2D→2、3D→3)
- 不依赖 propertyValueType(AE 2026 的 2D 变换属性报 3D 类型,不可靠)

### 教训

**「属性维度」(位数预检用)和「缓动数组长度」(setTemporalEaseAtKey 用)
是两个不同的概念,不能复用**——一个按"值有几维",一个按"SPATIAL 与否"。
node mock 一直测 1D 属性,2D 维度差异只有真机才暴露。

## v0.2.15(2026-08-19)— 端点平滑开关:两端速度归零

### 起因

用户反馈曲线序列首帧/末帧端点"硬"(起点直接有速度、终点或被跳过保持
LINEAR 直线角),要开关选「硬 / 平滑」。AskUserQuestion 确认语义:
**平滑 = 两端速度归零**(起点静止加速、终点减速静止,曲线两端水平圆润)。

### 实现

`applySegCurves(prop, frames, segs, smoothEnd)` 第 4 参:
- 平滑:首段「出」/末段「入」速度强制 0;端点邻接线性段时线性端点速度也置 0
  (linSpd=0);首/末帧即使两侧段都线性也不跳过(强制转 BEZIER)
- 硬(默认 false):行为完全不变(既有 105 断言全部原样通过)

UI:曲线功能行(常驻可见)新增「端点平滑」checkbox,直接写 state.curve.smoothEnd。

### 设计说明

- 平滑只动**边界速度**(首段出/末段入),不动中间段——曲线的"性格"保留,
  只是两端圆润
- 全线性 + 平滑 = 帧1/帧3 转 BEZIER 速度 0、帧2 保持 LINEAR(起点静止 →
  中间匀速 → 终点静止,合理)
- 全缓入缓出 + 平滑 = 与硬一致(缓入缓出端点速度本就 0,强制无变化)
- 教训延续:写 conv.inE 别写成 conv.in(v0.2.13 的坑,本次重写又犯一次,
  已 grep 修正)——**bezierToEase 的返回值字段是 out/inE**

## v0.2.14(2026-08-19)— 线性段端点被"僵直"变形:线性 = 匀速,不是速度 0

### 起因

用户实测:曲线段(如缓入缓出)后面跟线性段时,曲线段的**末帧端点**
不自由、被强行变形("被后面的线性变形了")。

### 根因(搜索 Adobe 官方 Keyframe interpolation 文档确认)

- 官方:线性插值 = "**uniform rate of change between keyframes**"(帧间匀速),
  且"At the second keyframe, the rate of change switches immediately to the
  rate between it and the third keyframe"——线性段速度 = 段平均速度
- 我们给线性段端点塞的 `KeyframeEase(0, 0.1)` **速度 = 0**——速度 0 是
  "静止/僵直"(Easy Ease 的端点),不是线性!混合场景(曲线段+线性段)时,
  曲线段末帧的「出」方向被塞了速度 0 → 端点被拉直变形
- 全线性场景侥幸没暴露:所有帧两侧都中性 → 整帧跳过,从未真正设置

### 修复

1. 线性段端点缓动 = `KeyframeEase(段平均速度, 0.1)`(匀速,影响 0.1≈线性)
2. 跳过判断从"两侧都中性"(对象比较)改为"**两侧段都线性或边界无段**"
   (segL/segR 检查 isLinearPreset)——全线性场景仍整帧跳过,保持默认 LINEAR
3. mock 更新:缓入+线性(帧2 出)、线性+缓入(帧2 入)的速度 0 → 平均速度 100

### 教训

**NEUTRAL(0, 0.1) 只配做"边界占位"(首帧入/末帧出),绝不能当线性段的
端点值**——线性是有物理意义的匀速,速度必须 = 段平均速度。这类"语义
偷懒"(拿占位值当真值)是补丁时代最容易埋的雷。

## v0.2.13(2026-08-19)— 真机「非法使用保留字」:对象属性名不能用 in

### 起因

v0.2.12 重写后真机报「在行 237 无法执行脚本。非法使用保留字」。
行 237 = `bezierToEase` 的返回对象字面量 `{out: ..., in: ...}`。

### 根因

`in` 是 ECMA-262 v3 的保留字(运算符)。ExtendScript 的解析器
**不允许保留字作为对象字面量属性名**(报「非法使用保留字」);
而 node(V8 现代引擎)允许,所以 `node --check` 和测试全绿,
真机一跑就崩——与 v0.2.1 正则 `\\` 同一类"node 通过但 AE 崩"。

### 修复与防护

1. `in:` → `inE:`,同步 applySegCurves 调用处与测试期望(105 断言全过)
2. AGENTS 坑 18 扩为三个雷,附 grep 检查命令:
   `(?:[{,]\s*)(in|new|var|default|...)`——新增对象字面量后必扫
3. 教训:ES3 兼容代码的对象属性名要避开全部保留字,**不要依赖
   node --check 做 ES3 合规性检查**(它只保证 V8 语法)

## v0.2.12(2026-08-19)— 曲线逻辑重写:三层职责分离

### 起因

曲线功能从 v0.2.0 到 v0.2.11 打了 8 轮补丁(插值/线性污染/数组参数/
influence 范围/公式修正/索引诊断/addKey),`applySegCurves` 的注释堆到
28 行、转换公式内联、缓动数组用"段下标 + 换算"组织,用户明确要求
"梳理好逻辑,直接重写"。

### 重写后结构(行为零变化,全部既有 mock 用例等价通过)

```
bezierToEase(x1,y1,x2,y2,avg)   ← 纯函数层(新):公式集中一处
   线性 → null;非线性 → {out:{speed,influence}, in:{speed,influence}}
     出影响 = x1×100;入影响 = (1−x2)×100(钳 0.1~100,取整 1 位)
     出速度 = y1×avg/x1;入速度 = (1−y2)×avg/(1−x2)(除零退 avg)

applySegCurves(prop, frames, segs)   ← AE 层:只做组装
   逐段 bezierToEase → 按【帧索引】直存 inEase[k]/outEase[k]:
     帧 k 出 = 段 k 出;帧 k+1 入 = 段 k 入;首帧入/末帧出 = NEUTRAL
   逐帧:两侧都中性跳过;否则 BEZIER 插值 + setTemporalEaseAtKey(数组)
   统计 {applied, missed, missIdx, missErr, missErrMsg} 不变

setKeyAt(prop, t, wv)   ← 打帧层(v0.2.11 不动):addKey 创建即得索引
```

### 关键收获

1. **补丁越多越要回头重写**:8 轮补丁的正确结论(公式/数组/范围/索引)
   全部保留,但组织方式从"叠注释"变成"分层函数",可读性质变
2. 缓动数组按帧索引直存(inEase[k]/outEase[k])比按段下标(easeIn[j])
   + 换算(k-1/k)直观得多,且行为完全一致——重写时用"行为等价 +
   mock 全绿"验证
3. 转换公式抽成纯函数后,4 项新断言直接守护(缓入缓出/线性/缓入/缓出),
   以后改公式不用再靠真机

### 后续修正(v0.2.13/0.2.14,本页图示两处已过时,以最新为准)

- **v0.2.13**:bezierToEase 返回对象的 `in` 属性名 → `inE`(in 是 ES3
  保留字,ExtendScript 报「非法使用保留字」)
- **v0.2.14**:① 线性段端点缓动从"NEUTRAL 速度 0"改为
  `KeyframeEase(段平均速度, 0.1)`(线性 = 匀速,速度 0 会僵直相邻曲线段);
  ② 跳过条件从"两侧都中性"改为"**两侧段都线性(或边界无段)**";
  ③ NEUTRAL(0, 0.1) 仅用于边界占位(首帧入/末帧出)

## v0.2.11(2026-08-19)— 打帧改 addKey:创建即得索引,消灭"打完再找"

### 起因

v0.2.10 细分诊断生效,真机报告「3 帧未匹配(3 索引无效)」——锁定是
"打帧后按时间找关键帧索引"环节全部失败(手写循环 + nearestKeyIndex
兜底均未命中),而非缓动调用异常。

### 搜索结论(可信依据)

1. **官方文档**:`Property.addKey(time)` "Adds a new keyframe or marker
   to the named property at the specified time and **returns the index
   of the new keyframe**"(返回新帧索引)——创建即得,无需事后查找
2. **Adobe 社区(Paul Tuersley,脚本大神)确认**:AE 关键帧放置存在已知
   精度问题,脚本打出的帧可能落在"帧与帧之间"——按时间匹配找索引天然不可靠

### 修复

`setKeyAt(prop, t, wv)` 取代 `setValueAtTime + findKeyIndex`:
1. 先按时间找已有帧(容差 0.03→0.05s)复用其索引(连续打帧不产生重复帧)
2. 无已有帧 → `addKey(t)` 直接拿索引(官方返回)
3. `setValueAtKey(idx, wv)` 设值
4. addKey 异常兜底 `setValueAtTime + numKeys`(极端,帧仍打上)

索引从"查找"变"创建即得",曲线应用直接用 addKey 返回的索引——理论上
missIdx 归零。mock 升级:numKeys/keyframeTime/addKey/setValueAtKey 模拟
+ 6 项新断言(无帧 addKey / 已有帧复用 / keyframeTime 抛错兜底),101 断言。

### 待真机验证 → ✅ 已验证闭环(2026-08-19)

- 真机报告「曲线应用: 3 帧套上缓动」,曲线功能全闭环(v0.2.12 重写后验证通过)
- addKey 方案稳定:后续多次真机报告再无「索引无效」

## v0.2.10(2026-08-19)— 曲线"未匹配"细分诊断 + nearestKeyIndex 兜底

### 起因

真机报告「曲线应用: 0 帧套上缓动 · 3 帧未匹配」(相比 v0.2.8 的"1 个属性异常"有进展:
KeyframeEase 构造已通过,卡在逐帧设置环节)。此时 setInterpolationTypeAtKey /
setTemporalEaseAtKey 签名均已对照官方文档确认合法,索引记录逻辑看起来也对,
但 3 帧全 missed——无法从代码推理定位,决定加诊断让真机数据说话。

### 做法

1. `findKeyIndex` 手写循环未命中时,用官方 `nearestKeyIndex(t)` 兜底
   (Property 专为"按时间找最近关键帧"设计,官方实现处理边界;手写循环
   容差逻辑理论上必中,兜底防 AE 版本行为差异)
2. `applySegCurves` 的 missed 细分:
   - `missIdx`: frames[k].idx 为 0/undefined(打帧后索引记录失败)
   - `missErr`: setInterpolationTypeAtKey / setTemporalEaseAtKey 抛错
     (try/catch 吞掉,带回首个错误文本)
3. 报告显示「未匹配(3 索引无效)」或「未匹配(3 调用异常)[错误信息]」

### 结论(已定案,v0.2.11 起不再需要本节的"待验证"分支)

- 真机报「3 索引无效」→ 不是 numKeys/keyframeTime 行为异常,而是
  "打完再按时间找索引"这条路本身不可靠——AE 关键帧放置有精度问题
  (Paul Tuersley 确认),手写循环和 nearestKeyIndex 都可能落空
- **最终方案:v0.2.11 改 addKey 创建即得索引,彻底绕开"查找"环节**
- 调用异常分支未出现(missErr 恒 0);missIdx 分支随 addKey 方案归零
- mock 测试新增 failEase 抛错模式,95 断言(后续随功能扩至 105)

## v0.2.4(2026-08-18)— 核验发现:线性段缓动污染(mock 模拟执行)

### 起因

用户「还没试,先核验」——不靠真机,直接把 applySegCurves 放进 node 测试,
mock KeyframeEase / KeyframeInterpolationType / prop 对象,逐帧核对调用序列。

### 发现的 bug

近似公式「入影响 = y2×100%」对**线性段(0 0 1 1)算出 100 影响**(y2=1),而
线性段的入影响应为 0。内置 4 个预设的 y2 **全是 1**,所以任何
「线性段 + 非线性段」混合(段1 缓入 + 段2 线性)时,线性段右帧会被设入 100%——
v0.2.3 的"两侧全线性才跳过"保护只在纯线性场景生效,混合场景漏网。

### 修复

- 线性段两侧缓动一律置 `NEUTRAL`(影响 0),不再按 y×100% 计算
- 帧侧跳过条件改为「入、出两侧都是 NEUTRAL 引用」——精确表达"该帧无缓动"
- mock 断言验证:全线性 → 0 次调用;缓入+线性 → 帧3(线性侧)不被污染;
  线性+缓入 → 帧1 不动;全缓入缓出 → 3 帧全部 BEZIER + 正确参数

### 教训

1. **AE 脚本的可测性扩展到了 AE 层**:applySegCurves 依赖 AE 对象但可以
   mock——把"会真机翻车"的逻辑先用 node 模拟跑一遍,成本极低收益极高
2. 近似公式要检查**边界预设**:线性(0 0 1 1)是 bezier 的退化情形,必须单独处理,
   不能套通用公式
3. 用户要求"先核验"是合理的工作方式:发布前用 mock 测试覆盖调用序列

## v0.2.3(2026-08-18)— 曲线套用不生效:插值类型 + 索引匹配

### 症状

用户选「缓入缓出」预设,打帧后关键帧**还是线性**。

### 根因①:setTemporalEaseAtKey 不改变插值类型

`setValueAtTime` 创建的关键帧默认插值 = **LINEAR**。`setTemporalEaseAtKey` 只写
缓动(KeyframeEase),**不会把 LINEAR 转成 BEZIER** —— 插值仍是线性,曲线自然不显示。
修复:设置缓动前先 `setInterpolationTypeAtKey(idx, BEZIER, BEZIER)`。

### 根因②:时间匹配索引的容差陷阱

原实现打完全部帧后 `findKeyIndex`(容差 0.002s)按时间找帧。播放头停在非帧边界
(如 0.17s)时,打帧时间 t 与 `keyframeTime` 的浮点表示可能出现 >0.002s 的偏差 →
匹配失败 → 全部 continue → 一个缓动都没设 → 依然线性,且**无声**(没有报错)。
修复:setValueAtTime 后**立即**记录索引(此时 keyframeTime 刚写入,偏差最小),
`findKeyIndex` 改"取最近匹配,容差 ±0.03s(≈1 帧@30fps)"。

### 其他决策

- 线性段(0 0 1 1)跳过设置,保持 AE 默认线性插值——零副作用、曲线编辑器显示干净
- 报告/状态栏新增曲线应用统计(套上 N 帧/未匹配 N 帧/异常 N 属性),
  "曲线没生效"从此不再无声
- 帧索引在打帧循环里收集(`propFrames[p]`),曲线应用直接用——执行层职责清晰,
  报告统计从 applySegCurves 返回值汇总

### 教训

1. AE 关键帧:插值类型(LINEAR/BEZIER)与缓动(KeyframeEase)是**两层**,设缓动前
   确认插值类型;setValueAtTime 的帧默认 LINEAR
2. 浮点时间匹配永远放宽容差或改用"写入时记录";0.002s 在 AE 时间精度下不可靠
3. 新功能不生效的排查顺序:先查"有没有真正执行到"(加统计),再查"API 前置条件"

## v0.2.2(2026-08-18)— 曲线区入口消失 + 打开慢:可见性设计与行池策略

### 症状

用户:UI 上看不到「曲线功能」开关(连打开的入口都没有)+ 面板打开比较久。

### 根因①:把"开关本身"藏进了按开关状态控制的隐藏组

`refresh()` 里 `grpCurve.visible = curveShow`(curveShow = 曲线开关 && 非表达式)。
曲线开关默认**关** → 整个 grpCurve(checkbox + 导出/导入按钮)visible=false →
用户看不到开关 → 永远勾不到 → 功能像"没做"。
**教训:总开关必须常驻可见,只能把"开关控制的内容区"藏起来。**

### 根因②:一次性预建 29 段行(145 个原生控件)

ScriptUI 控件是原生 OS 控件(带窗口句柄),创建开销大(Adobe 官方论坛性能帖点名)。
曲线段行池一次性 `for (1..29) addSegRow()` + `rebuildPresetDropdowns()` 全量
removeAll/add/sync —— 初始化要建 145 控件 + 数百次下拉操作,就是"打开久"。
节点行池 `ensureRows` 本来就是懒增长,曲线段行池不一致,是 v0.2.0 引入的性能回归。

### 修复

- grpCurve 常驻;只有 `grpSegs` 随 `curve.enabled && vtype!==3` 显隐
- `ensureSegRows(need)` 懒增长(与 ensureRows 同策略),返回是否新增行,新增时 layout(true)
- refresh 曲线段只遍历 `segList.length`;节点开关 onClick 补 layout(true)
- `addSegRow` 下拉创建时即用 `ddItemsForPresets()`(自定义+全量预设),懒增长后
  `syncSegDropdown` 的 `items[idx+1]` 不会越界

### 教训

1. **UI 可见性设计**:功能总开关永远可见,内容区才随开关显隐
2. **行池策略必须统一**:要么全懒增长,要么有明确理由全量预建;ScriptUI 控件按需创建
3. 结构评估(主线 8/支线 7.5/模块化 7)后修复点全部落在 UI 构建层——执行层与纯函数层
   是健康的

## v0.2.1(2026-08-18)— 真机语法错误:正则 `\\` 字面量 + JSON 非内置

### 症状

AE 打开面板报「**在行 794 无法执行脚本。语法错误**」;`node --check` 通过(V8 认这段代码),
ExtendScript 引擎不认——**node 检查通过 ≠ AE 能跑**的又一实例。

### 根因①(直接元凶):正则字面量里的 `\\`

`projectFileDir()` 里 `fsName.replace(/[^/\\]*$/, "")`——字符类 `[^/\\]` 含双反斜杠,
ExtendScript 解析器直接语法错误。而 `/\s/g`(v0.1.7 就在用)能跑,说明问题出在 `\\` 组合。
**结论:AE 脚本里避免任何含 `\\` 的正则字面量**,需要匹配反斜杠时用字符串方法
(indexOf/lastIndexOf/substring)或 `new RegExp()` 字符串构造。

### 根因②(排查中挖出的隐患):JSON 不是 ExtendScript 原生内置

社区定论(Adobe 官方论坛):ExtendScript 是 ECMA-262 v3,`JSON.parse/stringify` 是 ES5 特性,
**不是原生内置**——能用的机器是因为 Adobe Libraries 等面板把 JSON 泄漏进了所有面板共享的
全局上下文。**依赖全局 JSON 会因用户环境而异**。

修复:内置 ES3 自包含迷你 JSON(针对本插件固定格式):
- `stringifyPresets(presets)` → 标准 JSON 文本(缩进美观,用户可手编;任何工具可读)
- `parsePresetsText(txt)` → 优先全局 JSON.parse(严谨),失败/不可用退回
  `extractPresetsFallback`(逐字符扫描 `{...}` 块 + grabStr/grabNum,零正则)
- 全程零正则字面量,规避根因①的坑

### 教训

1. ExtendScript 语法检查要靠**真机**,node --check 只能拦 V8 语法;
   新增正则/字符串转义类代码时先自问"ExtendScript 解析器认不认"
2. AE 脚本的 JSON 必须自带实现,禁止依赖全局
3. 排查"语法错误"时,先 grep 全文件正则字面量,`\\` 组合是头号嫌疑

## v0.2.0(2026-08-18)— 曲线功能:预设下拉 + 4 数值 + 导出导入

### 设计决策

- **段 = 开启节点的相邻对**(`curveSegments(on, count)`):关闭节点断开链条,
  5 节点全开 = 4 段,关掉节点2 → [1,3] 直连成段。这是"关闭剔除"语义的自然延伸,
  不是固定槽位对(用户初稿说"5 个节点中间加 4 个"= 全开情形)。
- **预设交互**(用户确认):下拉 items = [自定义, 内置4, ...导入];选预设 → 填 4 空;
  手填 → `matchPreset` 容差 1e-4 匹配,命中显示预设名,否则「自定义」。
- **导出/导入**:JSON `{version:1, presets:[{name,x1,y1,x2,y2}]}`,默认存当前工程目录
  (`app.project.file` 的父目录,未保存退回 ~),`f.encoding="UTF-8"` 防中文乱码;
  导入合并同名覆盖;ExtendScript 内置 JSON 对象可用。
- **bezier → AE 缓动近似**(选型既定,用户选 cubic-bezier):每段 = 左帧「出」+ 右帧「入」,
  `setTemporalEaseAtKey(keyIndex, easeIn, easeOut)`:出影响 = y1×100%、入影响 = y2×100%、
  速度 = 段平均速度(valDiff/秒)。**固有精度损失**(bezier 与 AE 影响模型不是同构的),
  数值上不完全等于手调曲线,对快速 K 动画够用。
- 表达式模式禁用曲线(vtype===3 直接走 applyExpression,曲线区隐藏)。

### 实现要点

- 曲线段行池:预建 MAX_COUNT-1 = 29 行(同节点行池思路),refresh 按当前段数切换 visible;
  `state.curve.seg[i]` 按段序号存,段数变化(开关/节点数变动)时旧值保留、缺的补线性。
- 手填 4 空 → 只调 `syncSegDropdown`(写下拉 selection,**不调 refresh**,不写回文本)——否则
  正在编辑的框被 refresh 重置(AGENTS 坑 13 同款)。
- `applySegCurves` 内 segs 缺段时按线性兜底(下标对齐,防 undefined 崩)。
- 测试 50 → 74 断言:matchPreset(容差/不匹配)/ curveSegments(开关重排)/
  mergePresets(同名覆盖+不修改原)/ validatePresets(过滤非法、y 可超 1 回弹)/ valDiff。

## v0.1.17/0.1.18(2026-08-18)— 维度判断定案:threeDLayer 是唯一真相

### 定案数据(dim_test.jsx 用户实测)

```
枚举:THREE_D=6414 THREE_D_SPATIAL=6413 TWO_D=6416 TWO_D_SPATIAL=6415 ONE_D=6417(不碰撞)
图层1「参考.png」3D开关:关   位置 type=6413 缩放 type=6414 锚点 type=6413  ← 全是 3D 类型!
```

### 结论(推翻了 v0.1.12 的"propertyValueType 修复")

**AE 2026 中,2D 图层(3D 开关=关)的 位置/锚点/缩放 属性:
`.value` 返回 3 元素、`propertyValueType` 也报 ThreeD*(6413/6414)——两个 API 都
分不出 2D/3D。唯一可靠的维度真相 = `layer.threeDLayer` 开关。**
用户从头到尾是对的(value.length 和 propertyValueType 两个方案都是错判),
v0.1.12 那篇"修复"是假修复,已加 ⚠️ 修正标注。

### 最终方案

- `propDimCore(mn, vt, is3D, isSep)` 纯决策,枚举数值硬编码 6413~6417(AE 26.0 实测)
- 变换属性(位置/缩放/锚点/方向)→ 以 threeDLayer 为准
- 摄像机/灯光恒 3D(v0.1.18);分离尺寸跟随者恒 1D(separationLeader,v0.1.18)
- 非变换属性退回 propertyValueType;留空节点不参与预检

### 教训

**用户对自身项目的判断值得先验证再反驳**——两次"权威 API"都被用户实测推翻,
第三次才用诊断脚本定案。以后遇到"用户说 X、代码说 Y",先给诊断脚本,别急着下结论。

## v0.1.15(2026-08-18)— 位数预检原始诊断(连续三次 2D 误报 3 维)

### 症状

v0.1.13 起连报:普通 2D 图层的位置/缩放/锚点被预检判 3 维,用户三次反馈"又识别错了"。

### 排查难点

- v0.1.12 已改用权威 API propertyValueType(不该再错);
- v0.1.13 加了图层 3D 开关诊断,但用户贴的提示里**没有**「已开启 3D 图层开关」标注
  → 说明要么图层 3D 开关确实关着(那 propertyValueType 报 3D 就是异常),
  要么 propLayerInfo 上溯没找到图层(诊断静默失败),要么用户又在测旧版本(未重启 AE)。

### 决策:原始数据进提示

v0.1.15 起每条不匹配都附带 AE 原始诊断:
`[类型:ThreeD_SPATIAL · 图层「X」@「合成Y」3D开关:开/关/未知]`
- 类型常量名来自 propertyValueType(枚举名硬编码映射,不猜数值)
- 图层名/合成名/threeDLayer 来自沿 parentProperty 上溯到 Layer
- 下一份用户报告 = 确凿证据,三选一收敛:
  a) 类型=TwoD 但报 3 维 → 我的映射 bug,查枚举数值
  b) 类型=ThreeD 且 3D开关=开 → 预检正确,用户图层确实是 3D,引导切 3 空
  c) 类型=ThreeD 且 3D开关=关 → AE 自身异常(或 AE 2026 行为变化),上报 Adobe / 换判断源

### 排查顺序(写入 AGENTS)

① 用户是否重启 AE(未重启=旧版,一切白改)② 时间轴立方体图标(3D 开关)③ 新版原始诊断报告

## v0.1.14(2026-08-18)— 执行层重构(计划/执行/报告三段分离)

### 动机

用户:"先优化吧,我怕逻辑越来越乱了。"此前 8 轮迭代堆出 98 行的 doKey:
校验/预检/执行/报告四件事混在一起,报告 push 与执行交错,applyExpression 还重复了一套
undo/报告/弹窗模板。

### 方案(评审后定案)

1. **doKey 拆三段**:
   - `buildPlan()`(纯函数,node 可测)——把"排程+值"算成计划数组,不再碰 AE
   - `executePlan()`——只做 setValueAtTime,返回 {kfCount, badCount, fails}
   - `buildReport()`——纯文本拼接,按节点打印失败明细(格式与旧版逐字一致)
2. **抽公共辅助**:`withUndo(label, fn)`(undo 组 try/finally)、
   `perProp(props, fn)`(逐属性执行+有序 entries 记录)、`failDimCheck()`(预检失败三连)
3. **可测性上移**:buildPlan/planHasExplicit 进纯逻辑层,单测 33 → 39 断言

### 行为等价保证

报告格式逐字不变(失败行仍在所属节点下)、预检/自动弹窗/undo 分组不变。
测试全绿 + 真机重启验证功能无损。

### 教训

**"计划生成"与"执行"分离是把 AE 脚本逻辑变可测的关键**——
以后新增功能先想"能不能算成一份计划",能就算,再交给执行层写 AE。

## v0.1.13(2026-08-18)— 位数预检重写 + 3D 图层开关诊断

### 背景

v0.1.10~0.1.12 连续打补丁(预检 → 提示增强 → propertyValueType),用户实测后反馈
**"这块逻辑已经写乱了,不如重新写"**,且 2D 图层仍报 3 维(可能未重启 AE 生效,
也可能图层真开了 3D 开关)。

### 重写

拆成三个单一职责函数:
1. `propDimOf(prop)` — propertyValueType 权威维度
2. `propLayerInfo(prop)` — 沿 parentProperty 上溯找 Layer,取 层名 + threeDLayer 开关
3. `dimCheck(props, propNames, dim)` — 统一入口,返回 {ok, lines, sugDim}

### 关键诊断

**"2D 图层却报 3 维"的真相,大概率是图层开了 3D 图层开关(时间轴立方体图标)**——
开关一开,位置/缩放/锚点立即变 3D 属性,预检报 3 维是正确的。
新提示会写明「(图层「X」已开启 3D 图层开关)」,不再让用户猜。
若 2D 开关确认关闭仍报 3 维,才是真 bug,需把调试报告发来核对。

### 排查顺序(下次再遇"2D 报 3 维")

1. 是否重启 AE(部署后必须重启才生效,未重启看到的还是旧版)
2. 时间轴该图层立方体图标是否亮起(3D 开关)
3. 以上都排除 → 调试报告里读 propDimOf/propLayerInfo 输出

## v0.1.12(2026-08-18)— 2D 图层被误判 3 维(value.length 陷阱)

> ⚠️ **修正标注(v0.1.17)**:本节的"改用 propertyValueType 修复"是**假修复**——
> AE 2026 的 2D 变换属性 propertyValueType 同样报 3D(6413/6414),
> 最终方案见 v0.1.17/0.1.18(以图层 threeDLayer 为准)。本节仅留作历史。

### 症状

用户选的是普通 2D 图层的位置/缩放/锚点,预检却报「属性为 3 维,本次输入 2 个数」。

### 根因

维度判断用 `prop.value.length`,而 **AE 2026 中 2D 图层的位置/锚点 `.value` 返回
`[x, y, 0]`(3 元素,第三位补 0)**,2D 缩放也可能带尾 0 → 长度恒为 3 → 全部误判 3 维。
`value.length` 不是可靠的维度来源(搜索确认:官方文档建议用 `propertyValueType`)。

### 修复

`propDimOf(prop)` 改用 AE 权威枚举:
- `PropertyValueType.ThreeD_SPATIAL` / `ThreeD` → 3 维
- `PropertyValueType.TwoD_SPATIAL` / `TwoD` → 2 维
- `PropertyValueType.OneD` → 1 维
- COLOR/自定义/文本等(pd=0)→ 不预检,执行时 try/catch 兜底

### 经验

**AE 的 `.value` 有补齐尾巴的怪癖([x,y,0]),任何"猜维度"都必须走 propertyValueType**。
搜官方文档(ae-scripting.docsforadobe.dev Property 对象)确认了枚举定义。

## v0.1.10(2026-08-18)— 撤销自动适配,改执行前位数预检

### 背景

v0.1.8 实现了"数值维度自动适配"(单值广播到多维、数组补缺维),目标是消灭"值不是数组"。
用户实测后明确否决:**"这个修改没必要。程序执行之前先查询数值位数是否匹配,不匹配就直接提示,然后不执行就行了。"**

### 变更

- 删除 `fillDimsValue`(广播/补齐)与 `propDimDesc`,恢复"用户填什么就写什么"
- doKey 进入 undo 组**之前**做**位数预检**:
  - 有任一开启节点填了显式数值(hasExplicit)才校验;全留空(全用当前值)不校验
  - 逐属性读 `prop.value` 维度(数字=1,数组=length),与输入空数 dim 比对
  - 不匹配 → `alert("数值位数不匹配,未执行")` + 逐条列出「属性 X 为 N 维,本次输入 M 个数」+ 提示调空数或留空;lastReport 同步记录,`return` 不写入
- 特殊属性(文本等,维度取不到)不预检,执行时 try/catch 兜底(留空打当前值仍可用)

### 教训

**用户偏好显式错误提示,而非隐式"魔法"修正**——自动广播虽然聪明,但用户无法预期结果;
直接报错让用户自己决定(调空数或留空),行为可预测。开发前先问清楚,别自作聪明。

## v0.1.8(2026-08-18)— 数值维度自动适配(消灭"值不是数组")

### 症状(调试报告直接定位)

```
选中属性(4): 位置 / 锚点 / 位置 / 锚点
节点1 +0 帧 (0.17s) · 数值 20
    ✕ 位置 : After Effects错误: 由于参数 2，无法调用"setValueAtTime"。值不是数组。
```

### 根因

1 空模式填单个数字,打在**位置/锚点等二维属性**上:
`setValueAtTime(t, 20)` 要求参数 2 是数组 → AE 报「值不是数组」。
输入模式的维度与属性维度不匹配,不是脚本 bug,但用户不可能记住每个属性几维。

### 修复:维度自动适配

`fillDimsValue(v, cur)`(cur = 属性当前值)统一适配:
- **数字 × 多维** → 广播每维:缩放 50 → [50,50](符合 AE 缩放 uniform 直觉),位置 20 → [20,20]
- **数组不足** → 当前值补缺维:2 空 × 3D 位置 → [x, y, 当前z](不破坏 Z)
- **返回 null** = 维度不匹配(1D 属性给数组 / 数组超维)→ 报告写明
  「属性为 N 维,请用「N 个空」或留空」,不再甩一句"值不是数组"

### 测试

fillDimsValue 9 项,共 **42 项断言**。

### 经验

调试报告连续两轮实战定位根因(逗号残留 → 维度不匹配)。
1 空模式现在对任何维度都可用,用户不用记属性维度——"快速 K 帧"就该这样。

## v0.1.7(2026-08-18)— 修复"1 空模式全部判非法"(数值存储改数组)

### 症状(调试报告直接定位)

```
节点1 +0 帧 (0.20s) · 数值非法[123,,] → 跳过
节点2 +5 帧 (0.37s) · 数值非法[23,,] → 跳过
节点3 +10 帧 (0.53s) · 数值非法[34,,] → 跳过
结果: 0 个关键帧 · 9 个未生效
```

### 根因

v0.1.5 起 `state.val[slot]` 用**逗号拼接字符串**存储多框数值:
用户在 3 空模式填了 X=123、留空 Y/Z → joinParts 产生 `"123,,"`;
切回 1 空后 UI 只显示第一格(看起来是正常的 "123"),
但 classifyValue 解析整串 → 残留逗号 → parseFloat("") NaN → 判 bad → 整行跳过。
**显示与解析不一致**,是真机 bug 的温床。

### 修复

- `state.val[slot]` 改为**每空一格**的字符串数组(长度 3):框对格直读直写,
  彻底消灭逗号拼接/拆分,显示与存储永远一致;
  切换数值类型不丢数据(3 空 "123/540/0" → 1 空显示 "123" → 切回还原)。
- `classifyValue(cells, dim)` 直接读格子;框内出现逗号视为非法
  (提示改用对应空数模式),不再支持"1 空逗号多维"旧写法(已被 2/3 空取代)。
- splitParts/joinParts 删除(不再需要)。

### 测试

classifyValue 11 项(含回归用例 `["123","",""]` → fixed 123),共 **33 项断言**。

### 经验

**调试报告(v0.1.6)首次实战即定位根因**——没有它只能继续猜。
"显示给用户看的"和"脚本解析的"必须同源,跨格式转换(拼接/拆分)是这类 bug 的温床。

## v0.1.6(2026-08-18)— 调试报告(修复"打帧无效果"难排查)

### 症状

用户实测 v0.1.5 后反馈:**"都不上关键帧了"**。

### 排查

代码逻辑本身(computeTimes/doKey 循环)经测试无回归。最可能的两个真机场景:
1. **公式模式残留**:用户按验证步骤切「公式」测过表达式,表达式写在属性上
   (`expressionEnabled = true`),之后对该属性打帧 → `setValueAtTime` 抛错 → 全部失败
2. **2/3 空部分填写**:只填 X 留空 Y → classifyValue 判 bad → 整行跳过 → 0 关键帧

无法在真机前确认根因 → 与其猜,不如让脚本自己说。

### 决策

1. **调试报告**:`lastReport` 记录本次执行全明细(模式/节点数/数值类型/合成/指示器时间、
   每节点 时间+原始值+解析结果、每属性失败原因 + 错误信息 + 表达式启用状态),
   「调试」按钮弹出 dialog 查看;**打帧结果为零自动弹出**(直接回答"为什么没打上")
2. **classifyValue 替代 parseValueDim**:返回 {kind: empty|fixed|bad} 三态,
   语义与旧版一致但命名更贴近"执行归类";修复 ", ,"(全空多逗号)在 dim>1
   被"超维度"提前判 bad 的顺序问题——**全空判断必须在超维度判断之前**
3. 表达式属性不再静默:失败行标注 `[属性已启用表达式]`,报告里一目了然

### 测试

classifyValue 13 项 + split/join 3 项,共 **38 项断言**。

### 待真机确认

- 打帧为零自动弹窗是否打扰(如用户主动想打 0 帧的场景,可加开关)
- 表达式属性 setValueAtTime 抛错信息在 AE 26.0 的实际文案
- dialog 多行 edittext 滚动在 AE 里的表现

## v0.1.5(2026-08-18)— 数值输入类型切换(1/2/3 空 / 公式)

### 需求

用户:数值输入想要类型切换——"选数值输入一个数字,选缩放/位置就两个空,还可以选公式(表达式)给到对象"。
追问后确认:**缩放/位置都是 2 个空可合并**,**公式 = AE 表达式,写入选中属性**。

### 决策

1. **切换器 = 下拉「1 个空 / 2 个空 / 3 个空 / 公式」**(vtype,默认 1 个空)
   - 1 空 = 单值;2 空 = 二维数组(位置/缩放/锚点共用,占位符 X/Y);3 空 = 三维(3D 图层)
   - 合并缩放/位置安全:两者写入的都是 [x,y] 数组,AE 按属性类型解释,脚本不区分
2. **state.val[slot] 仍存逗号分隔字符串**:1/2/3 空只是 UI 拆成几个输入框
   (`splitParts`/`joinParts` 分合),切换类型不丢数据(单值 `50` 切 2 空 → X=50、Y 空)
3. **parseValue → parseValueDim(text, dim)**:返回 {ok, value} 三态
   - value=null:留空/全空 → 用属性当前值(向后兼容)
   - value="bad":显式填写但非法/维度不足 → 可见跳过 + badCount(不再静默回退,
     顺手修了 v0.1.1 起"填了 abc 也静默用当前值"的老瑕疵)
4. **公式模式 = applyExpression**:`prop.expression = expr; prop.expressionEnabled = true`,
   不排关键帧(表达式覆盖关键帧);按钮文案动态变「应用表达式(选中属性)」,
   表达式为空给状态栏提示;语法错误由 AE 弹窗 + try/catch 兜底

### 测试

parseValueDim 12 项 + split/join 3 项,共 **37 项断言**。

### 待真机确认

- 3 个数值框并行布局在 AE 26.0 的显示(列宽 ~120px 是否够)
- 表达式写入多个属性、表达式语法错误时的表现
- 公式模式下按钮文案与状态栏提示

## v0.1.4(2026-08-18)— 节点数动态化(1~30)

### 需求

用户:"现在只有 5 个节点,可以增加更多吗?比如输入数字就增加对应多的,排序模式不变。"

### 实现

1. **节点数输入框**(1~30,默认 5):`cntInp.onChange` → clamp → `resizeState` → `ensureRows` → `refresh` → `pal.layout.layout(true)` 五连。
2. **锚点规则泛化**:`MODE_ANCHOR = [1,3,5]` 常量改为 `anchorPos(mode, n)` 函数:
   起始 = 1,中间 = ⌈N/2⌉(偶数时略偏上,下方多一个),末尾 = N。
3. **行池复用**(关键决策):ScriptUI 无便捷的运行时增删行 API(remove() 可用性存疑),
   改为预建行控件、按 count 切换 `visible`——缩容再扩容时旧槽位数值保留,
   且避免 remove() 带来的布局抖动。代价:行控件只增不减,30 上限封顶防止撑爆面板。
4. **resizeState 只补默认不删值**:新槽位 on=true / gap=5 / val="",旧槽位不受影响。

### 测试

新增 N=7/4/8/6 四种节点数的排程用例 + anchorPos 规则 5 项,扩至 **29 项断言**。

### 待真机确认

- ScriptUI `visible=false` 隐藏行 + `layout(true)` 在 AE 26.0 的实际表现(行高/间距)
- 偶数节点数的"中间偏上"锚点是否符合直觉

## v0.1.3(2026-08-18)— 关闭节点语义:占位 → 完全剔除

### 症状

用户实测:关闭(勾选取消)一个节点后,其他节点的时间**没有变化**——
"关闭的帧还是被加入计算了"。

### 根因(设计决策变更)

v0.1.0 按用户当时的选择实现为"**占位**":关闭节点不打帧,但槽位和间隔照算,
保证后续节点时间稳定。真机使用后发现该语义反直觉:用户期望"关掉某个节点,
它就从这个序列里消失,前后节点自然靠拢",而不是留一个隐形的间隔坑。

### 变更

- `computeTimes(mode, gap, on)` 新增第三参数 on:关闭槽位返回 **null**,
  时间链只沿**最近开启节点**传播:
  - 下方:`t[i] = t[最近开启上一节点] + gap[i]`
  - 上方:`t[i] = t[最近开启下一节点] - gap[i]`
- `doKey` 依旧 `if (!isAnchor && !state.on[s]) continue;`(关闭节点不打帧)
- 预览:关闭节点显示「关闭」,不显示时间
- 回归测试新增 4 项"关闭剔除"用例(共 19 项断言)

### 影响

- 默认状态(4/5 号节点关闭)下,起始帧模式链条自动跳过 4/5,行为与 v0.1.2 一致
- 中间/末尾模式下关闭上方节点,锚点邻位会"向前靠拢"——这是新语义的预期效果
- 语义变更需用户真机确认

## v0.1.2(2026-08-18)— 修复中间/末尾帧倒推计算 bug

### 症状

用户实测:起始帧计算正确,切到中间帧 / 末尾帧后时间不对。

### 根因

倒推循环写成了 `t[i] = t[i+1] - gap[i+1]`,误用了**锚点一侧邻居节点**的间隔,
而不是**节点自己的** `gap[i]`。锚点槽位没有间隔输入(固定),其 gap 只是默认值 5,
所以:
- 默认全 5 时两种公式结果相同 → 起始帧模式(全累加,无倒推)和"没改过间隔"的场景不暴露;
- 一旦用户在中间/末尾模式下改上方节点间隔,锚点邻位的倒推就取错数字 → 时间错位。

### 修复与预防

- 公式改为 `t[i] = t[i+1] - gap[i]`,与下方节点的 `t[i] = t[i-1] + gap[i]` 对称
  (每个节点自己的 gap 都定义"与靠锚点一侧相邻节点的帧距")。
- computeTimes(mode, gap) 抽为纯函数 + `module.exports` 测试钩子(node 下不建 UI),
  新增 **test_quickkey.js(15 项断言)**:三种模式 × 非均匀间隔、对称间距、parseValue 规则。
- AGENTS.md 坑 4 同步修正(原文档里也写成了错公式)。

### 术语修正

「播放头」→ AE 官方学名「当前时间指示器」(Current Time Indicator, CTI),
UI 标签与全部文档统一。

## v0.1.1(2026-08-18)— 新增每节点数值列

### 需求背景

v0.1.0 打帧数值固定为"属性当前值"(先摆值再排程时间),用户实测反馈:
**面板不知道需要多少数值** —— 想要在节点上直接填关键帧值。

### 决策

1. **每节点独立数值输入**(列头:开关 | 节点 | 间隔 | 数值 | 时间),锚点行同样有数值输入
2. **留空 = 用属性当前值**(parseValue 返回 null),与 v0.1.0 行为完全兼容
3. **逗号分隔支持多维**:`parseValue` 把 `960, 540` 解析为 [960, 540],单维返回数字
4. **显式数值失败不静默**:维度不匹配(如 1D 属性填了 2 个数)时 setValueAtTime 抛错,
   计入 badCount 并在状态栏提示"N 个未生效",不偷偷回退当前值 —— 用户显式输入就该被看见

### 未覆盖 / 待真机验证

- 位置 2D/3D、缩放 2D 的逗号分隔数值,需真机确认 setValueAtTime 数组回写
- 表达式属性、Source Text 属性打帧行为(未实测)

## v0.1.0(2026-08-18)— 架构与关键决策

### 架构总览

```
QuickKey.jsx(单文件)
├─ 状态 state:mode(起始/中间/末尾)+ on[1..5] 开关 + gap[1..5] 帧距
├─ computeTimes():由锚点位置 + 间隔算出 5 槽位相对当前时间指示器的帧偏移
├─ UI:模式下拉 + 5 节点行(开关/间隔输入/时间预览)+ 打帧按钮 + 状态栏
└─ doKey():comp.selectedProperties × 开启槽位 → setValueAtTime 批量打帧
```

### 设计决策(为什么这么做)

1. **当前时间指示器 = 锚点,角色三选(起始/中间/末尾)**
   用户原始需求:当前时间指示器所在的帧可以当作序列的第 0 帧、中间激活帧或末尾帧。
   实现为 `MODE_ANCHOR = [1, 3, 5]`,槽位 1~5 固定"上早下晚"。

2. **间隔语义统一为"与靠锚点一侧相邻节点的帧距"**
   用户描述"它在上一帧的多少帧之后打关键帧"——这对锚点下方的节点是字面含义;
   锚点上方的节点没有"上一帧"可循,唯一的自洽定义是从锚点倒推:
   `t[i] = t[i+1] - gap[i+1]`。这样三种模式下间隔数字语义一致(相邻节点帧距),
   且全部输入都被使用(无未定义间距)。已用交互线框与用户确认。

3. **关闭节点 = 占位不打帧**
   用户明确选择"占位":关闭的节点跳过打帧,但槽位和间隔照算,
   避免"关掉中间节点后后续节点时间漂移"的意外。

4. **打帧目标 = selectedProperties,数值 = 属性当前值**
   用户选择"选中属性"作为目标(而非五大属性全打/面板选属性)。
   数值默认取当前值,即"先摆值、后排程时间"的工作流;
   每节点独立数值留作后续迭代(需加数值列)。

5. **固定 5 槽位不重建,refresh() 改行状态**
   ScriptUI 无便捷的增删行 API,锚点随模式变化时若重建节点区,
   会丢失各控件的闭包绑定。改为 5 行固定,refresh() 切换 visible/enabled/文本。

### 待办 / 已知限制

- 状态不持久化,重启 AE 后回到默认参数(V2 候选:settings 文件)
- 未覆盖:表达式属性(表达式开启时 setValueAtTime 行为需实测)、Source Text 属性、2D/3D 数组数值的真机确认
- 尚未真机验证(v0.1.1 需重启 AE 实测:三种模式、开关占位、数值列、多维逗号分隔、Ctrl+Z 撤销)
