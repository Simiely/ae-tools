# 更新日志（CHANGELOG）

## v1.3.23

- **MountainSpectrum v1.5.5 → v1.5.6**：修「起伏曲线」枚举越界分叉 —— 架构审计用**边界分叉探测**
  （25 个边界用例 × 40 根 = 1000 次逐根比对）发现：`ftype` 取非法值（如 9）时，纯函数落「余弦」、
  表达式落「二次」，40 根里 8 根不一致。拖控制器上的「起伏曲线」滑块出界即触发（画面与状态栏数字对不上）。
  两侧统一「`Math.round` 后夹到 [0,3]，越界回退 0」；断言 266 → **272**（新增第十二节边界等价性）。
- **新增仓库级验收脚本 `verify.py`**（与 `install.py` 并列）：一条命令跑完
  ① 全面板 `node --check` ② 所有带测试的面板 ③ 部署副本 vs 源码一致性 ④ **技术债清单**
  （无测试 / 无 VER / 测试缺失败退出码 / 部署不一致）。
  首次运行即产出：**5 个面板无测试、10 个面板无 VER 常量、AE-Rolling-Lyrics 的测试缺失败退出码**。

## v1.3.22

- **山峰频谱 MountainSpectrum v1.5.4 → v1.5.5**：提示区（「预设管理」与「状态」之间那段）由 `statictext`
  换成「**固定 8 行 + 右侧滚动条**」的多行文本框，文本显式分段 —— 解决"可读性差 + 空间占用多"；
  顺手修掉长期存在的尺寸坑：`pinW()` 会把 `preferredSize` 重置成 `[w, -1]`，导致 v1.1.1 起
  「调试输出区」设的 110px 高度**一直被静默覆盖**；新增 `fixedBox()` 明确"先钉宽度、再钉高度"。
  断言 261 → **266**（新增 5 条含顺序体检，已做反向对照）

## v1.3.21

- **山峰频谱 MountainSpectrum v1.1.1 → v1.5.4**（补记 v1.2.0~v1.5.4 五轮迭代；根 CHANGELOG 此前停在 v1.1.1）：
  空对象命名优化 + 图层标签色（v1.2.0）、节奏条（v1.1.0 引入 / v1.3.0 取大压缩 / v1.3.1 开关改复选框 /
  v1.3.2 山内完全跟随轮廓零戳出）、帧缓冲（v1.4.0，因静态合成无过渡过程而**弃用**）、
  **边缘羽化带**（v1.5.0，以空间线性过渡取代时间帧缓冲）、柱子颜色可调（v1.5.1，默认白）、
  修取色器崩溃（v1.5.2，ScriptUI Panels 不支持 colorpicker → 改 `$.colorPicker`）、
  默认色可见化（v1.5.3）、**版本号上界面 + 修「点生成没反应」**（v1.5.4）；断言 192 → **261**
- 顺带修正根文档两处漂移：根 `AGENTS.md` 撤掉已失效的「MountainSpectrum 待开发（禁止部署）」声明；
  根 `README.md` 工具总览版本 v1.5.0 → v1.5.4

## v1.3.20

- **山峰频谱 MountainSpectrum v1.1.0 → v1.1.1**: 新增**调试输出区**(可复制)——根因是 AE ScriptUI
  handler 抛错完全静默("点击没反应"); 照 NumCounter 先例补全: 调试区+复制按钮(executeCommand 23/19)、
  「诊断」按钮(AE 版本/工程/图层/滑块值一键收集)、全部 12 个按钮与 onChange 与启动代码统一兜底;
  225 断言全过(纯 AE 层改动)

## v1.3.19

- **山峰频谱 MountainSpectrum v1.0.0 → v1.1.0**: 新增**节奏条**(每 N 根一根更高的竖线, 音频可视化的
  beat/rhythm bars 形态): 控制器 3 个新滑块(开关/间隔/高度%), 面板「节奏」分组实时可调;
  山丘结合采用**固定增量**公式(柱高 = 节奏地板 + 山丘抬升量) —— 山内全场同量放大、轮廓连续,
  山外恢复独自高度, 山顶不会成倍戳出(调研依据: AM 调幅的形态取舍); 开关关 = 逐点等于 v1.0.0;
  旧工程/旧预设双向兼容(滑块缺失回退"关"); 225 断言全过(含 2000 次逐根比对)

## v1.3.18

- **山峰频谱 MountainSpectrum v0.9.0 → v1.0.0**（审计后重构，详见 `panels/MountainSpectrum/CHANGELOG.md`）：
  - **删除三个失效/隐藏参数**：点位「影响范围」、控制器「影响范围倍率%」、点位「边缘控制」——
    实测它们在有边缘点时被静默覆盖（改了没反应），宽度收敛为**只由左右边缘点控制**（单一真相）
  - **新增参数表 `PARAM_SPECS`**（单一真相）：加参数从"改 5~7 处"降到"改 1 处"（消除 Fowler 的 Shotgun Surgery）
  - **8 个参数改完立即生效**（矩形宽/间距/基础高度/基线%/起伏曲线/叠加方式/点位高度/边缘高度%），
    结构性参数（数量/自动铺满/点数）改完**明确提示**需重新生成，不再静默
  - 新增面板按钮**「均分边缘点」**；修复负基础高度下纯函数与表达式的分叉（10/30 组）、
    魔数漂移、`syncEdgeX` 静默失败；预设版本 v3 → v4（旧文件兼容，`r` 字段忽略）
  - 测试重写为十节结构：**192 条断言（含 1600 次逐根数值比对）全过**，关键体检断言做反向对照

## v1.3.17

- **新增面板「山峰频谱 MountainSpectrum」**（面板 v0.9.0，`panels/MountainSpectrum/`）：等距矩形阵列 + **一个波峰一组 3 个可拖控制点**（峰 / 左边缘 / 右边缘，左右宽度独立）+ **总闸「山峰 高度」**（拖它 = 整排最高柱等比缩放、形状不变）+ 4 槽位预设（工程目录 JSON，导出 / 导入）。高度公式 `柱高 = 基础高度 + (峰高 − 基础高度) × 衰减` —— 衰减作用在**地板之上**，故范围内每根都保证高于基础高度。**1131 断言**；四件套 + tips 已同步；根 README 工具总览 10 → 11，并撤下已空的「待开发（WIP，暂不部署）」一节

## v1.3.16

- **滚动歌词 V2** 修复「句号在文本最左/行首,本应在最右」(面板 v2.0.13): 放宽段框宽后仍复现→非换行而是**文本方向(direction)**。根因 = 源图层继承 RTL/双向方向, AE bidi 按从右到左重排, 汉字 LTR 强字符次序不变, 但**句末标点「。」被排到段首(最左)**; 佐证官方 ParagraphDirection 枚举 + 社区「文本反向、引号跑 front」案例 + Reverse-Text 插件价值。修复: applyLyricText 写回显式 `d.direction=LTR` 锁横向。测试 39→41

## v1.3.15

- **滚动歌词 V2** 修复「句号被放到行首」(面板 v2.0.12): 根因 = 源图层是段落(有边框)文本框时, AE 按旧框宽**自动换行**, 中文闭标点(UAX#14)断行落到行首(放大句字号大更易触发)。写入统一走 `applyLyricText`, 检测 `boxText` 则放宽 `boxTextSize=2×comp.width+200` 杜绝换行, 标点留句尾; 点文本源层 boxText=false 不受影响。依据 Adobe 官方「paragraph text box 按边界框宽换行」。测试 37→39

## v1.3.14

- **滚动歌词 V2** 修复左/右对齐下「放大句」不贴边(面板 v2.0.11): 真机选左对齐后当前句(放大句)未贴 30px, 长句放大整体左漂似"句号挤到行首"。根因 = 对齐偏移按 `sourceRectAtTime` 的**未缩放**宽(scale=100%)算, 而锚点在文本中心, 中心缩放会让左/右缘随 scale 漂移。修复: position 内 `w = sourceRect(width)×transform.scale[0]/100`(实时缩放感知), 放大句指定边精确贴边距, 居中不受影响。测试 mock 注入 transform.scale, 断言 35→37

## v1.3.13

- **滚动歌词 V2** 修复「水平对齐不生效」(面板 v2.0.10): 真机选中左/右对齐生成后仍居中。根因 = `buildLyrics` 调用 `buildController` 重建参数对象时漏传 `align`(与 v2.0.3 漏传 lines/multiGap 同类), 致控件走 DEFAULTS 恒为居中。修复补传 + 0..2 clamp。新增用例 11 `buildLyrics→buildController` 透传回归(测试 33→35 断言); 曾只在 `snapshot()` 直测 buildController 绕过 buildLyrics 故未抓到, 教训已记 DEVELOPMENT

## v1.3.12

- **滚动歌词 V2** 新增「水平对齐」(面板 v2.0.9): 歌词支持左对齐 / 居中 / 右对齐(默认居中 = 原行为)。面板下拉选择 + Lyrics_Ctrl「水平对齐」滑块(0/1/2) 实时改; 每句 x = master[0] + 对齐偏移, 偏移用 `sourceRectAtTime(...).width` 求真实文本宽(fitLong 缩窄后也不溢出), 边距 30px; 预设版本 v3→v4 新增短键 `al`(旧预设兼容回退); 模拟测试 28→33 断言(新增 sourceRectAtTime mock + 5 项对齐用例)。真机待用户验证

## v1.3.11

- **NumCounter** 修复「存储槽位后对应使用按钮不变可用」真正根因(面板 v0.2.9): 槽位索引 0-based/1-based 错位 —— 存储/使用按钮闭包 `idx` 为 0-based 写成 `presetsCache["0".."3"]`, 而全局约定 1-based("1".."4") 致使用按钮读空槽全灰。修复: 闭包 `onClick` 统一传 `idx+1`, 全链路 1-based 对齐(Node 模拟验证)。v0.2.8 的 `pal.layout.layout(true)` 为误诊, 仅作渲染保险

## v1.3.10（误判: 见 v1.3.11）

- ⚠️ 误判「存储槽位后对应使用按钮不变可用」为 ScriptUI 重绘问题(面板 v0.2.8), 加 `pal.layout.layout(true)`; 经 v0.2.9 重新检索确认为索引错位, 该修复无效

## v1.3.9

- **NumCounter** 预设改为「4 槽位」模式(面板 v0.2.7), 对齐仓库 AE-Lyrics-Animator 等「预设槽」实践: 固定 4 槽位(存储/使用/清空) + 导出导入, `presetsCache` 内存缓存, 持久化只用工程目录 `NumCounter.presets.json`(`{version, slots}` 结构, 手写构造 + 受控 eval 解析, 避开会崩的 `app.settings`)。参数收集/回填复用 `serializePreset`/`deserializePreset`

## v1.3.8

- **NumCounter** 修复「数字始终不动」的**真正根因**(面板 v0.2.6):`setValueAtTime` 官方签名 = `(time, newValue)`(时间在前), 本插件自 odometer 引入起一直写成 `setValueAtTime(startVal, t0)`, 把「值」误送到「时间」, 关键帧被错放到 100 秒处, 可见区间内数值恒≈0 ⇒ 不动。v0.2.0 起「数字不动」的恒定主因即此; v0.2.4 的 `enabled=true` 仅排除禁用冻结这一次要因素。修法: 改用无歧义的 `addKey + setValueAtKey` 并加 `numKeys`/`valueAtTime` 数据层验证。预设文件 `NumCounter.presets` 升级为真正 JSON `NumCounter.presets.json`(ES3 禁用 JSON.parse, 手写构造 + 受控 eval 读取)。来源: Adobe 官方 Property 文档 + AE 标准手册示例

## v1.3.7

- **NumCounter** 修复「保存预设报错」(面板 v0.2.5):根因 = v0.2.2 用 `app.settings.saveSetting(..., "user")` 第 4 参传字符串, 而官方指南第 4 参是 `prefType`(无符号整数)被拒;改为预设存**工程目录文件** `NumCounter.presets`(UTF-8, 每行 `name|序列化串`), 跟随工程走、无 1999 字节上限; 工程未保存提示先存盘, 写文件需开「允许脚本写入文件」。来源: ae-scripting.docsforadobe.dev · Settings object

## v1.3.6

- **NumCounter** 修复「生成成功但数字不动」(面板 v0.2.4):根因 = 控制空对象被 `enabled=false` 禁用致滑块关键帧播放时不更新(Adobe HelpX + CSDN AE 社区确认);另修多次运行同名控制层命中旧层、关键帧锚点越界。修法: 控制层保持 enabled、生成前清理旧控制层/数位层、关键帧锚点兜底、表达式改 `ctrl.effect("数值")(1)` 标准写法

## v1.3.4

- **NumCounter** 面板 v0.2.2:新增调试输出区(实时诊断 + 失败弹窗/状态栏/调试框三处详情);新增预设存储/使用(`app.settings` 持久化参数组合)。注: 当时把 `app.scheduleTask` 误当「对象无效」根因, 实测未打中, 真正根因见 v1.3.5

## v1.3.5

- **NumCounter** 修复「对象无效」**权威根因**(面板 v0.2.3):`Effects` 是 AE 索引属性组, 每次 `addProperty` 使同组既有引用失效, 第 319 行 `fxVal.property(1)` 在后续 addProperty 后已失效;修法 = 三滑块 addProperty 全部完成后按名字重新取回再访问子属性;数位表达式滑块值改索引 `(1)` 与脚本一致。来源: ae-scripting.docsforadobe.dev + omino blog + Dan Ebberts/Tomas Sinkunas(Adobe 社区)

## v1.3.3

- **NumCounter** 真机修复(面板 v0.2.1):生成时 `ReferenceError: 对象无效`(`fxVal.property(1)`);规避 = `comp.openInViewer()` 激活合成 + `ctrl.enabled=false` 后移 + 滑块属性多层 fallback;失败给友好报错

## v1.3.2

- **NumCounter** 架构升级(面板 v0.2.0):改为「独立数位 / odometer」——每位拆独立文本图层 + 控制空对象,任意比例字体零抖动;字体+字重两级联动下拉;移除前后缀、字距改字间距(px)

## v1.3.1

- **NumCounter** 真机修复(面板 v0.1.1):`ParagraphJustification` 枚举成员名改为 `*_JUSTIFY` 导致报错,改兼容写法;字体由手填改为系统字体下拉(`app.fonts.allFonts`)

## v1.3.0（当前版本）

- 新增 **NumCounter**(`panels/NumCounter/`,面板 v0.1.0):数字计数器面板 —— 填起始/目标/帧数一键生成数字递增动画
- 核心:**表达式 + 滑块驱动**(「数值」滑块关键帧 = 时间轴, sourceText 表达式实时格式化),生成后仍可拖滑块/关键帧调整,无需重跑
- 控制项:起始/目标/帧数/步进值/小数位(0~4)/字距/字体/等宽锁定/对齐/前缀/后缀/缓动
- 抖动修复:等宽锁定(强制 Consolas 等宽字体)+ 对齐(中/右)组合,彻底消除数字变化时的宽度跳动
- 根 README 自写插件表补 NumCounter 行(10 个);四件套文档齐

## v1.2.1

- tips/ae/expressions.md 新增「数字计数器（滑块控制）」套路：双滑块（起始值/速度）+ 速度关键帧控制增速与暂停时机

## v1.2.0

- 新增 **tips 使用技巧知识库**（`tips/`）：AE 通用技巧（快捷键/表达式/渲染导出/常见坑）+ 9 个自写插件使用技巧模板，与插件 README 双向链接，方便查找调用
- 根 README 目录结构与文档节登记 tips/；AGENTS 约定补「技巧进 tips/」规则

## v1.1.0

- 新增 **QuickKey**（`panels/QuickKey/`）：节点式 K 帧排程面板——当前时间指示器为锚点（起始/中间/末尾），5 节点位可开关 + 帧距数字 + 每节点数值列（逗号分隔支持多维，留空=用当前值），一键给选中属性（`selectedProperties`）批量打帧，单 Undo 组可整体撤销
- v0.2.0 新增**曲线功能**：预设下拉（自定义 + 内置线性/缓入/缓出/缓入缓出 + 导入）+ x1 y1 x2 y2 输入（cubic-bezier），选预设自动填数/手填匹配显示预设名，导出/导入预设 JSON（默认工程目录），打帧自动套用缓动
- v0.3.3 调试报告新增「动效整理」段：对象行（合成·图层·属性·维度）+ 节点/曲线竖排（节点时间值 + 段预设名与 bezier 数值），便于核对当前动效
- v0.3.4 默认节点数 5 → 3（起始帧模式,节点 1~3 全开）
- v0.3.5 全参数预设管理：4 槽位（存储/使用/清除/复位）+ 双层持久化（工程 `quickkey_配置.json` + app.settings）+ 导出配置/导入配置（全量备份 = 当前参数+槽位+曲线库）,对齐 AE-Lyrics-Animator 系方案
- v0.3.6 内置曲线预设 4 → 9：新增 cubic-3/cubic-2/cubic-1/cubic-out/cubic-in
- v0.2.1 修复真机语法错误：`\\` 正则字面量（ExtendScript 解析器拒绝）改纯字符串操作;JSON 非原生内置,内置 ES3 自包含迷你 JSON(序列化/解析零依赖)
- v0.2.2 修复曲线区 UI：开关行常驻可见(不再藏进隐藏组)、段行池改懒增长(不再一次性预建 29 行,解决打开慢)
- v0.2.3 修复曲线不生效：setValueAtTime 打的帧默认 LINEAR 插值,先转 BEZIER 再设缓动;打帧时立即记录帧索引(原时间匹配 0.002s 容差在非帧边界时全跳过)
- v0.2.4 核验修复线性段缓动污染：线性段两侧缓动置中性(原近似公式 y2×100% 对线性段算 100 影响);applySegCurves 加 node mock 核验(调用序列断言)
- v0.2.5 注释精简：版本头 178→39 行 + 代码地图(函数名索引 8 分区),文件 1457→1319 行,逻辑零改动
- v0.2.6 官方文档核验：setTemporalEaseAtKey 缓动参数是【数组】(1D/2D/3D=1/2/3 个 KeyframeEase),之前传单个对象是曲线不生效根因;报告加"曲线未开启"提示
- v0.2.7 Tab 键只在数字输入框之间循环(onKeyDown 拦 Tab + active 手动聚焦),避开开关/下拉/按钮
- v0.2.8 曲线应用异常根因：KeyframeEase 的 influence 合法范围 [0.1..100],传 0 构造抛错导致整段曲线失败;钳到 0.1≈线性;mock 加范围校验模拟真实行为
- v0.2.9 bezier→AE 映射公式修正：X 坐标→影响、Y 坐标→速度(社区公认公式,三方交叉验证),原 X/Y 用反导致"范围对不上"
- v0.2.10 曲线"未匹配"细分诊断：missIdx(索引无效)/missErr(调用异常带错误文本)+ findKeyIndex 加官方 nearestKeyIndex(t) 兜底;报告直接显示卡点,不再含糊
- v0.2.11 打帧改 addKey 方案：官方 addKey 创建即返回帧索引,彻底取代"打完再按时间找"(真机 3 索引无效根因);容差 0.03→0.05s
- v0.2.12 曲线逻辑重写：三层职责分离(纯转换 bezierToEase / AE 应用 applySegCurves 按帧索引直存 / 打帧 setKeyAt),公式集中一处,消除 8 轮补丁缠绕;行为零变化
- v0.2.13 修复真机「非法使用保留字」：对象属性名不能用 in(ES3 保留字,ExtendScript 拒绝,node 拦不住);in→inE,AGENTS 坑 18 扩为三雷
- v0.2.14 修复线性段端点被"僵直"变形：线性 = 匀速(官方文档),端点速度必须 = 段平均速度,原速度 0 是静止非线性;跳过判断改"两侧段都线性"
- v0.2.15 新增端点平滑开关：曲线两端「硬/平滑」可选,平滑 = 首帧/末帧速度归零(两端圆润,像 Easy Ease),首/末帧强制转 BEZIER
- v0.2.16 修复 2D 属性曲线报「值数组没有 1 元素」：SPATIAL(位置/锚点/方向)缓动数组恒 1 个(官方指南),新增 easeDimOf 按 matchName+实际值维度,不再用 propDimOf
- v0.3.0 UI 层重构(阶段 1 主线)：行池工厂 makeRowPool 统一两套行池、构建分块 buildHeader/buildNodeArea/buildCurveArea/buildFooter、刷新拆分 refreshHeader/refreshNodes/refreshCurve、控件引用分组为行对象;纯逻辑/预检/执行层一行未动,116 断言全过
- v0.3.1 UI 微调：模式行标签加「锚点」、节点区锚点行文字改「锚点」、间隔/数值/曲线数值输入框加宽(5 位)、列头同步
- v0.3.2(已回退)宽度自适应：实测布局不如固定宽度,整体回退到 v0.3.1
- 状态：开发中（v0.3.1，UI 微调已真机验证）；四件套文档齐 + test_quickkey.js 回归测试（116 断言）

## v1.0.3

- **Rolling Lyrics V2 真机验证通过**（2026-08-18）：滚动句数数字输入（任意 ≥1）+ 组内行间距 + 二值透明度全部正常，正式转「稳定」
- V2 工程化加固（v2.0.4~v2.0.7）：修复错位跳动、二值透明度、控件名常量集中、测试升级为真实表达式执行（28 断言）

## v1.0.2

- 新增 **Rolling Lyrics V2**（`panels/AE-Rolling-Lyrics-V2/`）：滚动句数 1/2/3 句一起滚动 + 组内行间距；v1（`panels/AE-Rolling-Lyrics/`）冻结不动
- README 自写插件表补 V2 行；修正 MountainSpectrum 残留行

## v1.0.1

- MountainSpectrum 内容清理出主目录，标注「待开发」（WIP），暂不部署/安装
- 源码保留在 `D:\workbuddy\2026-08-12-17-14-47\ae-scripts\MountainSpectrum.jsx`，待开发完成后再纳入

## v1.0.0

- 建立 ae-tools monorepo：整合 8 个自写 AE 插件（TimeAxisIndent / AE-Dashed-Grid-Generator / AE-Water-Rise-Generator / MountainSpectrum / AE-Rolling-Lyrics / AE-Lyrics-Animator / AudioScale / starry-sky-generator）
- 收集脚本 asu_NudgeKeyFrames.jsx（外部免费脚本，sundstedt.se）归入 `third-party/scripts/`，与自写插件严格分离
- `install.py` 一键部署器：自动检测 AE 版本、补 UTF-8 BOM、逐字节校验
- 四件套文档建立（README / AGENTS / DEVELOPMENT / CHANGELOG）
- 去重：TimeAxisIndent / RollingLyrics 以 AE 实际运行版本为准
