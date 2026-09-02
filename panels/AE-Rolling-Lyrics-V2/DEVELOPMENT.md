# DEVELOPMENT.md · 开发记录

## 一、项目概览

滚动歌词生成器 **V2** 是 AE 2026 的歌词滚动工具（基于 v1 v3.7 迭代）。核心能力：把歌词按行拆成图层，由 `Lyrics_Ctrl` 空对象 + 表达式驱动整列歌词滚动，到画面中心的句子放大变亮。

**V2 与 v1 的关系**：v1（`../AE-Rolling-Lyrics/rolling-lyrics.jsx`，v3.7）**冻结不动**；V2 是独立文件 `rolling-lyrics-v2.jsx`，新增「滚动句数」（1/2/3 句一起滚动）+「组内行间距」，滚动逻辑从"按句"升级为"按组"。

演进：v1 全历史 → V2 首版（v2.0.0）组滚动模型。

## 二、架构说明

```
rolling-lyrics-v2.jsx
├─ util 层：estTextWidth / numVal / addPropertySafe / getPropertySafe / clearProp / removeGenerated
├─ preset 层（参数映射 + 双层持久化：工程目录 JSON + app.settings）
│  ├─ collectParams / toPreset / fromPreset / applyParams   ← 新参数 lps / mg 四路同步
│  ├─ 工程 JSON：滚动歌词预设.json（跟工程走）
│  └─ app.settings：全局保底
├─ core 层（可测试，Node 导出）
│  ├─ parseLyrics / computeOffsets / computeMaxDist / measureFit / createLyricLayer
│  ├─ addSliderControl / addCheckboxControl（效果容器 ADBE Effect Parade）
│  ├─ buildController(comp, n, params)
│  │   └─ 12 个控件：最大字号/普通字号/间距/组内行间距/滚动句数/
│  │                最大透明度/普通透明度/滚动帧数/停顿帧数/停顿随机/抖动帧数/水平对齐
│  │   └─ 滚动位置表达式（按组）：m=⌈n/k⌉ 组，step=mg*(k-1)+g，
│  │       循环"停顿+滚动"m-1 次，组中心 y = H/2 - (idx-(m-1)/2)*step
│  └─ attachExpressions(L, i, n, k, cx, cy, cap)
│      ├─ 位置：x = Lyrics_Master[0] + 对齐偏移（左/中/右，偏移用 sourceRectAtTime 求真实文本宽，边距30）
│      │        y = Lyrics_Ctrl.position[1] + (rel - ((mnum-1)/2)*step)
│      │        rel = gi*step + (ii-(k-1)/2)*mg（gi=⌊i/k⌋, ii=i mod k）
│      └─ 缩放/透明度：d = |Lyrics_Ctrl[1] - Lyrics_Master[1]|（组中心距离）
└─ ui 层：buildUI（含「滚动句数」下拉 +「组内行间距」输入框 +「水平对齐」下拉）/ run 主流程 / 预设管理
```

**组滚动核心公式**：
```
k  = 滚动句数（1/2/3）
m  = ⌈n/k⌉（组数）
step = multiGap*(k-1) + gap        ← 组与组的中心间距
句 i 的组内偏移 = (ii - (k-1)/2) * multiGap
句 i 的 y = 组中心 y + (gi - idx)*step + 组内偏移
```

## 三、关键问题与方案（一坑一篇）

### 问题：句号在文本最左/行首，本应在最右（v2.0.13）

**TL;DR**：放宽段框宽（v2.0.12）后仍复现 → 证明不是换行，而是**文本方向（direction）**。根因 = **源图层继承了 RTL/双向（从右到左）文本方向**，AE 的 bidi 引擎按 RTL 重排，句中汉字为 LTR 强字符顺序大体不变，**但句末标点「。」被排到段首（最左）**。

- 证据链：① 官方 `TextDocument.direction` 属性 + `ParagraphDirection.DIRECTION_LEFT_TO_RIGHT / _RIGHT_TO_LEFT` 枚举（ADAdobe 脚本参考）；② Adobe 社区真实案例「AE 文本反向打字，问号/引号跑到 front 而非 end」；③ Reverse-Text 这类插件就是为"RTL 把标点排错"而存在。三者一致指向 direction/bidi
- 修复：`applyLyricText` 写回时显式 `if (d.direction !== LTR) d.direction = LTR`（用 `typeof ParagraphDirection` 防旧版本），把每个歌词层锁为横向从左到右；与 v2.0.12 框宽放宽并存（一防换行、一防反向）
- 排查记录：整段审计确认插件**对字符顺序零改动**——`parseLyrics` 仅 trim/切行、`measureFit` 仅改字号、`estTextWidth` 的 `charCodeAt` 仅估宽、写回仅 `td.text=歌词`；无任何 reverse/重排
- 测试 39 → **41**（用例 13：源层 RTL direction 被显式锁定为 LTR）
- 防坑要点：**复用源文本样式时，除字号/字体外还要警惕源层的段落方向（direction）与文本框类型（boxText）**，两者独立且都会让标点位置错乱；新添 `ParagraphDirection` 时测试需先在 vm sandbox 注入该枚举再触发写回

### 问题：歌词句末的中文句号「。」被放到行首（v2.0.12）

**TL;DR**：用户歌词每句以句号结尾，生成后句号被排到句子开头。根因 = **源图层是段落（有边框）文本框（box text）**：`createLyricLayer` 在有源图层时**复用/复制源层**、`buildLyrics` 直接写 `td.text=歌词`，但没处理源层是段落文本框——AE 会按**框宽自动换行**（官方：paragraph text box 中文本会 wrap to fit the bounding box）；中文句号「。」是 Unicode UAX#14 的**闭标点（CL）**，断行时被排到下一行行首。放大句字号更大、更宽 → 更早触发换行，与"句号行首"现象吻合。

- 修复：把歌词写回统一收敛到局部函数 `applyLyricText`：先检测 `td.boxText`（段落文本框），若是则把 `td.boxTextSize = [comp.width*2+200, 5000]` 放宽到极限，杜绝自动换行，使句号等标点始终留在句尾。point text 源层 `boxText` 为 false，走原路径不受影响
- 依据（可信来源）：Adobe 官方「Creating and Editing Text Layers」明示段落文本框按边界框宽换行；AdAdobe 脚本参考 `TextDocument.boxText` / `.boxTextSize` 专用于段落文本框
- 排查并排除的候选：克隆标记悬挂标点（Hanging Punctuation，默认关且为"边距外"非"行首"）、RTL 文本方向、parseLyrics 标点/换行处理（仅 trim + 按 `\r?\n` 切行，不动标点顺序）
- 测试 37 → **39**（用例 12：段落文本框写回会自动放宽框宽、文本含句号正确写入）
- 防坑要点：**凡"复用源文本样式"的功能，都必须检查源层是否为段落文本框（`sourceText.value.boxText`），否则写回更长文本会按旧框宽换行**——这也解释了为何"点文本"用户与"拉框文本"用户行为不同

### 问题：左/右对齐时「放大句」不贴边，较长句末尾看似被挤到行前（v2.0.11）

**TL;DR**：对齐偏移曾按 `sourceRectAtTime(...).width`（**scale=100% 的源宽**）计算；但当前句会被放大（`scale=150%` 等）。锚点在文本中心，中心缩放**中心不动、但左/右缘随 scale 移动**，而 sourceRect 返回的是未缩放宽 → 放大句照它套边距必然偏位（左对齐时左缘偏左、右对齐时右缘偏右）。长句放大后整体向左漂移，视觉上像句末标点"被挤到行首"。

- 修复：position 表达式把源宽乘实时缩放 `scl = transform.scale[0]/100`，`w = sourceRectAtTime(...).width * scl`，让左/右对齐把"放大后的指定边"精确贴到 30px 边距；居中 `ax=0` 与缩放无关，天然不受影响
- 表达式依赖：position 读本层 `transform.scale`（AEx 数据流无环：scale 不读 position），AE 端自动处理求值顺序
- 测试：mock 支持 `transform.scale`（scale 每帧先于 position 求值、写回供读）；用例 10 拆分"放大句 vs 普通句"左/右断言，防止只测普通句让未来改回归溜过去
- 防坑要点：**凡是"位置按文本宽度计算"的 offset，只要该层有缩放（scale 表达式/动画），就必须把实时缩放乘进去**；否则对齐只在 scale=100% 时精确

### 问题：选左/右对齐生成后仍居中（align 未生效）

**TL;DR**：新增 `align` 参数必须在 `buildLyrics` → `buildController` 调用对象里**显式透传**。v2.0.9 只在 `buildController` 里 `addSliderControl(ctrl, CN.align, params.align ?? DEFAULTS.align)` 加了 fallback，但 `buildLyrics` 重建参数对象时没把 `align` 传进去 → 恒走 `DEFAULTS.align=1`（居中），面板下拉选择被无视。

- 根因：v2.0.9 把 `align` 加进 collectParams / CN / DEFAULTS / toPreset / fromPreset / applyParams / buildController / 表达式，却**漏了 `buildLyrics` 主流程调用 buildController 时的透传对象**（第 695 行那一坨 `{ maxSize..., multiGap }`）。与 v2.0.3 修过的 `linesPerScroll`/`multiGap` 漏传**完全同类**——buildController 的关注点参数只有被 `buildLyrics` 显式列出才会生效
- 为何测试没抓到：`test_rolling_lyrics_v2.js` 的 `snapshot()` 直接调 `buildController(P)`，绕过了 `buildLyrics`，所以 align（与 lps/mg）都能正确透传，测试绿；但真实 AE 入口走 `buildLyrics`，参数在那一层就丢了
- 修复：`buildController` 调用对象补 `align`（`params.align ?? DEFAULTS.align` + 0..2 clamp）；新增**用例 11**走真实 `buildLyrics` 验证控件值（左=0/右=2）
- 预防：**凡新增可调参数，必须同步审查 `buildLyrics` 里传给 buildController 的对象是否包含**；测试不能只测 `buildController` 单点，至少要有一条走 `buildLyrics` 的透传断言
- 教训：ES3 无对象展开，新增参数时 buildController 调用处的字面量对象→"靠人肉列全"，最容易漏；建议后续若参数再增，可考虑把规范化逻辑放进 buildController 内部而不再由 buildLyrics 重建对象（减少漏传面）

### 问题：歌词水平居中改为可选左/中/右对齐

**TL;DR**：原 x = `centerX + (master[0]-centerX)`（固定画面中心）。改为每句 x = `master[0] + ax`，其中 ax 为对齐偏移（左/中/右），偏移用 `sourceRectAtTime(time,false).width` 取每句真实文本宽，边距 30px。

- 需求：歌词可左对齐 / 居中 / 右对齐，默认居中（不变）
- 对齐偏移 ax：`al<0.5 → 30+w/2-W2（左）`、`al<1.5 → 0（中）`、`否则 → W2-30-w/2（右）`
- 必须用 `sourceRectAtTime`（真实文本测量）：fitLong 缩窄后每句宽度不同，若用固定估算会溢出画布；锚点已在文本中心 + 组内统一比例缩放 → 缩放不改变水平中心，对齐始终准确
- 保留 `master[0]` 相加：拖动 Lyrics_Master 整体水平移动歌词的能力不受影响（偏移量直接叠加在 master x 上）
- 新增 CN 常量 `align`（水平对齐），Lyrics_Ctrl 挂滑块控件（0/1/2），表达式阈值 `<0.5 / <1.5` 判定；面板用下拉（左对齐/居中/右对齐）
- 测试：表达式引用 `sourceRectAtTime` 在 Node 环境不可用，`makeEnv` 注入固定宽 srcW=300 的 mock；新增用例 10 五条断言（左 180 / 中 960 / 右 1740）
- 预防：改对齐公式必须保持 `x = master[0] + ax` 结构（否则破坏整体移动）；sourceRectAtTime 依赖文本图层（歌声图层均为文本），勿用于空对象

### 问题：滚动"按句"改"按组"后，句子位置漂移

**TL;DR**：V2 若只把控制器改成组滚动、句图层仍按单句偏移，滚动中句子会跳位。必须让句图层表达式与控制器用**完全相同的组索引算法**（同样的 times 累积 + seedRandom 流），再用 `rel - idx*step` 对齐。

- 问题：组滚动模型下，句位置 = 组中心 + 组内偏移；组中心由控制器表达式算，句图层若不知道"当前组 idx"会错位
- 根因：控制器位置只暴露"当前组中心 y"，没暴露"当前组索引"
- 解决：句图层位置表达式**自算 idx**（与控制器表达式同算法、同种子流 seedRandom(jj+11000)）；`y = ctrl.position[1] + (gi*step + (ii-(k-1)/2)*mg) - idx*step`
- 预防：改控制器表达式时必须同步改句表达式（AGENTS 关键坑 2 守护）

### 问题：整组放大 vs 单句放大

**TL;DR**：需求是"2 句一起到中心放大"，若沿用 v1 的 `|transform.position[1] - master|`（单句距离），组内各句缩放不一致，视觉上不是"整组放大"。

- 解决：缩放/透明度距离改为**组中心距离** `|Lyrics_Ctrl.position[1] - master[1]|`，组内所有句共享同一缩放/透明度 → 整组同步放大变亮
- 预防：不要改回 `transform.position[1]`（AGENTS 关键坑 3）

### 问题：v1 / v2 同目录并存，部署与清理互不干扰

**TL;DR**：两版文件名不同（rolling-lyrics.jsx / rolling-lyrics-v2.jsx），install.py 自动部署到 ScriptUI Panels 后 AE 菜单两版共存；清理旧图层时 removeGenerated 按 Lyrics_ 前缀匹配，两版共用同一套图层命名（Lyrics_Ctrl / Lyrics_Master / 歌词_），同一合成里不要同时用两版生成（会互相清理对方图层）。

- 预防：README 注明"同合成用同一版生成"

### 问题：组滚动句位置偏移基准错误，歌词整体错位 + 组切换跳变

**TL;DR**：句位置用了 `ctrlY + (rel - idx*step)`，把"相对第 0 组中心的偏移"与"当前组索引"耦合，导致 idx=0 时组0 不在画面中心（整体错位 290px），且随 idx 变化偏移突跳。正确公式：`ctrlY + rel - ((mnum-1)/2)*step`（**固定偏移**，滚动动画由 ctrl 的 linear 插值提供）。

- 问题：播放时歌词错位跳动；k=1 时句0 也不在中心
- 根因：v1 的句偏移是 `(i - half)*g`（相对 ctrl 参考点的**固定偏移**）；V2 误写成 `(rel - idx*step)`（把 idx 卷进偏移，破坏固定性）
- 解决：偏移固定为 `rel_i - ((mnum-1)/2)*step`；句子 y = ctrl 动态位置 + 固定偏移，与 v1 同构（ctrl 的 y0/y1 = H/2 + ((mnum-1)/2 - idx)*step 本就正确）
- 验证：新增 `test_rolling_lyrics_v2.js` 模拟测试（14 断言）守护，改动表达式必须跑测试
- 预防：任何句位置/缩放表达式改动，先跑 `node test_rolling_lyrics_v2.js`

### 问题：组到中心的距离 d 基准错误，透明度/字号两档被抹平

**TL;DR**：缩放/透明度表达式用 `|ctrlY - master|` 算"组到画面中心距离"，但参考点 ctrlY 在停顿态 ≠ 画面中心（中心组几何中心在 H/2，参考点在 H/2±偏移），导致**中心组算出来 d≈step 而不是 0**，所有句子透明度都落在渐变中间值——"看不出 100% 与 30% 的区别"。

- 问题：用户反馈透明度看不出区别
- 根因：d 必须按"句所属组的几何中心"算：`d = |ctrlY + gi*step - (mnum-1)/2*step - master|`（gi=⌊i/k⌋）；旧式 `|ctrlY - master|` 忘了组偏移项
- 解决：d 修正 + 语义改为「二值 + 滚动过渡」：`ease(min(d,step), 0, step, 最大, 普通)`——停顿态中心组 d=0→最大、其余组 d≥step→普通（二值）；滚动中 d 在 0..step 过渡（平滑）
- 验证：模拟测试用例 7/8（静止二值 + 滚动过渡 65 交叉）守护
- 预防：任何"到中心距离"类表达式，先用模拟测试断言中心组的 d=0

## 四、文档基线（断点续传）

- 2026-09-02（commit 未提交）：修复「水平对齐」不生效（v2.0.10，buildLyrics 漏传 align，测试 35 断言）
- 2026-09-02（commit 未提交）：新增「水平对齐」左/中/右（v2.0.9，测试 33 断言）
- 2026-08-18（commit `9673f48`）：真机验证通过，V2 转稳定（v2.0.8，顶层 v1.0.3）
- 2026-08-18（commit `c037ab2`）：控件名常量 CN + 测试升级真实表达式执行（v2.0.7，28 断言）
- 2026-08-18（commit `35b90c9`）：滚动句数不限行数、最后一组不满居中修复（v2.0.6，测试 31 断言）
- 2026-08-18（commit `345932d`）：透明度/字号二值+滚动过渡、d 基准修复（v2.0.5，测试 24 断言）
- 2026-08-18（commit `a73deae`）：修复句位置偏移基准错误（v2.0.4，+模拟测试 14 断言）
- 2026-08-18（commit `86ee42e`）：修复 buildController 漏传新参数（v2.0.3）
- 2026-08-18（commit `ef4981d`）：滚动帧数默认 9、停顿帧数默认 30（v2.0.2）
- 2026-08-18（commit `e1b310a`）：默认参数调整 v2.0.1（60/40/145/100/30，组内行间距对齐 145）
- 2026-08-18（commit `b10df33`）：V2 首版建立（v2.0.0，组滚动模型）
- 维护流程：① CHANGELOG 追加版本 → ② AGENTS 基线行更新 → ③ knowledge-base 仓库盘点表回填（用户执行）→ ④ 推送
