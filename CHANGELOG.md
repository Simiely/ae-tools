# 更新日志（CHANGELOG）

## v1.3.54

- **DialogueText v0.11.10 → v0.11.11**：修复段落文本「空格后的第一个字从 0 秒起一直显示」
  （真机 44 字 / 1 空格，第一个「朵」常显、隐藏阶段也不消失）。
  - 根因：选区与关键帧按**原文下标**排，而空格不建动画器；
    AE 26 真机实测**索引单位下空格不占索引** ⇒ 空格后第一个字的 AE 索引没有任何动画器覆盖，
    后续字整体早一拍；
  - 修法：新增 `countVisibleChars`；`applyTypeScroll` 用可见字数 `visN` 计算时间轴/表达式；
    `applyTypewriter` 用 `selIdx`（非空白字符序号）写 `Index Start/End` 与关键帧时间；
    日志显示 `N 字(可见 M)`。
- 文档：面板四件套 + tips + `AE_API_VERIFIED.md` §8.9（补「索引不含空格」的真机结论）；
  DialogueText 断言 491 → **506**。
- 验收：`node test_DialogueText.js` 506 通过 / 0 失败；`python verify.py` 全部通过；
  ✅ 真机确认（2026-11-25，用户反馈「这次正常了」）。

## v1.3.53

- **DialogueText v0.11.9 → v0.11.10（v0.11.9 已撤回）**：修正索引选区在真机报
  「无法将 set value 与此属性一起使用，因为属性或父级属性被隐藏」。
  - 每个新建动画器都有**自己的默认选区（百分比）**，必须**逐个**切 `Units=Index`；
  - 切到索引后要写 **`ADBE Text Index Start/End`**（官方 matchName 表），
    百分比那对此时是隐藏属性；两对显示名都叫 Start/End，必须按 matchName 取；
  - 取不到索引属性就切回百分比，绝不混用。
- 文档：面板四件套 + tips + `AE_API_VERIFIED.md` §8.9（补官方 matchName 与隐藏属性结论）；
  DialogueText 断言 485 → **491**。
- 验收：`node test_DialogueText.js` 491 通过 / 0 失败；`python verify.py` 全部通过。

## v1.3.52

- **DialogueText v0.11.8 → v0.11.9**：修复段落文本逐字出现「有两个字从 0 秒起一直显示」。
  每字动画器的范围选择器由**百分比**改为**索引单位**
  （`Units=Index` / `Based On=Characters` / `Start=i` / `End=i+1`，0 基、空格占索引），
  只在第一个非空白字探测一次；取不到索引属性时退回百分比并写诊断。
- 文档：面板四件套 + tips + `AE_API_VERIFIED.md` §8.9 同步；DialogueText 断言 474 → **485**。
- 验收：`node test_DialogueText.js` 485 通过 / 0 失败；`python verify.py` 全部通过。

## v1.3.51

- **文档入库整理（不改代码逻辑）**：
  - `AE_API_VERIFIED.md` 移入**仓库根**（此前 CHANGELOG 多处引用「仓库根」，文件却留在工作区），
    README「文档」区补索引；
  - 原始规划稿的调研结论存档进 `panels/DialogueText/DEVELOPMENT.md` 附录
    （原稿《对话文本动画插件规划.md》仍留工作区，**不入库**）；
  - DialogueText 的 AGENTS / README / DEVELOPMENT / tips 口径统一到 v0.11.8：
    **段落文本的出现窗口 = 你给的段落框**（清掉「窗口=文字范围」的旧写法）；
    AGENTS 里 v0.11.7 的「框高倍增 / 拉高框」指导改为「排版框单行化 + 原框作窗口」；
  - `tips/tools/README.md` 的 DialogueText 状态 `v0.1.3` → `v0.11.8（待真机验证）`；
  - `_template/README.md` 补「挂载末尾 `pal.layout.layout(true)`」约定
    （对应 DialogueText v0.1.2 整窗空白事故；`PanelTemplate.jsx` 已同步补上）；
  - 根 `DEVELOPMENT.md` 项目概览的面板数 7 → 12，与 README 对齐。
- 验收：`python verify.py` 全部通过（12 面板 + `_template`），DialogueText 474 断言不变。

## v1.3.50

- **DialogueText v0.11.7 → v0.11.8**：段落文本溢出**不再拉高用户的框**，改为「**单行化 + 你的框就是出现窗口**」。
- 起因：v0.11.7 把溢出的段落框从 49 拉到 129px，文字全显示了，但用户明确反对
  「原本的文本框被修改了……我给的文本框就是出现字的范围」，并要求「文字不超出框，仍从右往左出现，像程序一样」。
- 官方依据与硬约束：
  - Adobe Help《创建和编辑文本图层》：段落文本**按框宽自动换行**，超出定界框的行**不渲染**；
  - `TextDocument.boxText` **只读**，脚本不能把段落文本转成点文本（官方只能右键菜单互转）；
  - ⇒ 595px 宽 + 49 字 + 字号 40.6 必然 3 行，「框保持 49 高」与「3 行全可见」不可兼得；
    要让整句不换行，**排版框宽度必须够**。
- 修法：
  - 框高设成**一行高**（`max(原框高, ceil(行距))`），此时 `boxOverflow === false` 等价于「整段一行」；
  - 宽度**倍增**（上限 `max(8192, 32w)`）+ **二分**到最小一行宽，写回 `boxTextSize`，复核 `boxOverflow`，失败一律还原；
  - **窗口 = 用户原框**（`boxTextSize` + `boxTextPos`，层坐标）：宽高都不动，点文本仍用文字外框；
  - 原框尺寸写进蒙版名 `DT_窗口 595x49`（`buildMaskName` / `parseMaskNameBox` / `readStoredWindow`），
    重复应用仍按原框当窗口；`isOurMaskName` 改为前缀判定，清理旧蒙版不受影响；
  - 窗口比文字窄 ⇒ 位置表达式 `dx = br - (rl + avg*ks)`（上限 0）让整行「打满后左移」，
    即终端式从右往左流动；框高小于一行、文本含强制换行（`\r`）时告警/还原，不硬改；
  - 日志：`⚠ 段落文本溢出: 排版框 595x49 → Wx49px (官方 boxOverflow, 试探 N 次, 1 行), 改为单行; 你的框 595x49 作为出现窗口…`。
- 验收：`node test_DialogueText.js` → **474 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 待真机验证（先 Ctrl+Z 撤销一次回到 595x49，再应用）。

## v1.3.49

- **DialogueText v0.11.6 → v0.11.7**：段落框溢出判定改用 **AE 官方 `TextDocument.boxOverflow`**（AE 24.6+）。
- 起因：v0.11.6 依赖 `sourceRectAtTime(t, false)` 在撑高后返回**文字范围**；官方表达式参考只保证
  `includeExtents=true` 时段落文本返回**段落框边界**，若宿主返回的是框尺寸，v0.11.6 只能还原 + 告警。
- 修法：
  - 先读 `boxOverflow`：`false` ⇒ 全部文字在框内，**完全不动用户的框**；
    `true` ⇒ 框高**倍增**（上限 `max(4096, 64h)`）找到第一个不溢出的高度，再**二分**到最小可容纳高度，
    写回 `boxTextSize`（宽度不变 ⇒ 换行不变），写回后**再读一次 `boxOverflow` 复核**；
  - 任何失败 / 复核仍溢出 ⇒ 还原原框高；成功后 `restoreBoxPos` 把 `boxTextPos` 复位，文字不跟着框跳；
  - 旧版 AE 没有 `boxOverflow` 时自动退回 v0.11.6 的撑高探测法；
  - 日志：`段落框无溢出(全部文字都在框内), 框尺寸不改` /
    `⚠ 段落文本溢出: 框高 38 → Npx (官方 boxOverflow, 试探 N 次, M 行)`。
- 依据：ae-scripting.docsforadobe.dev `TextDocument`（AE 24.6 新增 `boxOverflow` / `boxTextSize` /
  `boxTextPos` / `composedLineCount`；TextDocument 实例是组合时快照，改后必须重新取 `st.value`）。
- 验收：`node test_DialogueText.js` → **450 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（49 字长句应演满出现时长，日志「试探 N 次」应为个位数到十几）。

## v1.3.48

- **DialogueText v0.11.5 → v0.11.6**：修复「时长也不对，似乎 6 秒不起效果」（长句后半段不出现）。
- 根因（用 Adobe 官方《创建和编辑文本图层》交叉验证）：文本层是**段落文本（框文本）**，
  `文字 566x38px` 只有一行高，而 49 字需要 3 行；**AE 不显示超出定界框的文字**（只留溢出图标）。
  关键帧确实铺满 0 → 6.00s，但第 19 字之后整段不可见 —— 可见的约 18 字在 2.2s 演完，
  剩下 3.8 秒在演看不见的字，于是看起来「6 秒没生效」。v0.11.4 的「尾字不出现」同源。
- 修法：
  - `getTextInfo` 采集 `doc.boxText / boxTextSize / leading`；
  - 新增 `fitParagraphBox`：应用前把定界框**临时撑高**再测，文字高度变大 ⇒ 确有被裁的行，
    就把框高收到 `fitBoxHeight(实测高)`（宽度/换行不变，只放出被裁的行）；
    无溢出则原样还原；源文本有动画（`numKeys`/表达式）时不写 doc；任何失败都还原；
  - 应用日志新增文本层类型/字号/行距/入出点/⚠拉伸/⚠时间重映射与溢出修复结果；
  - `applyTypewriter` 写完后读回 `keyTime()` 打印「关键帧核对 … (期望 …)」，
    偏差超过半帧加 ⚠（宿主若换算过时间一眼可见）。
- 验收：`node test_DialogueText.js` → **436 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（长句应完整逐字演满出现时长）。

## v1.3.47

- **DialogueText v0.11.4 → v0.11.5**：修复「文字特别长的时候，没有逐字出现所有的文字」。
- 根因：逐字出现的窗口 = 文本框（零边距时框宽 = 文字宽），而蒙版羽化是**向内**的
  （清晰区比框左右各窄一个羽化宽）。为让第一个字避开羽化，位置表达式把整行**右移一个羽化宽**，
  于是文字右缘被推出框右缘；长文本时尾部几个字整段落在羽化区/框外 ——
  不透明度关键帧照常执行但看不见，只能等隐藏阶段整行左移才「滑」出来。
  短文本只影响不到 1 个字，长文本（49 字、平均字宽 11.5px）会吃掉尾部 2~4 个字。
- 修法：
  - 新增 `computeFeatherOutsetBox`：逐字出现的蒙版路径左右各**外扩**半个羽化，
    框内完全清晰、过渡区全在框外（横向滚动仍向内，框外完全不可见）；
  - `buildTypeScrollExpression` 去掉羽化参数与右移补偿：前沿按**文本框边界**算，
    `dx` 上限 0、下限 `min(0, 框右 - 文字右)` —— 零/正边距时出现阶段文字**完全不动**，
    只有负边距（框比文字窄）时才按前沿整行左移；隐藏阶段从出现结束位移连续出发；
  - 应用日志新增文字尺寸 `文字 WxHpx`。
- 验收：`node test_DialogueText.js` → **405 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（长句应从第一个字到最后一个字完整逐字出现）。

## v1.3.46

- **DialogueText v0.11.3 → v0.11.4**：修复「开头逐字出现仍然没有」。
- 根因：v0.11.1 起整体渐隐挂在 `DT_滚动`（选区覆盖 0-100%）上，出现结束时的不透明度是
  **100**；AE 文本动画器不透明度会**覆盖**同字符其他动画器的结果，每字动画器
  `0 → 100` 的出现关键帧被顶掉，整行从 0 秒起就可见。
- 修法：`DT_滚动` 只保留位置表达式；`applyTypewriter` 新增 `hideStart / hideEnd`，
  每个字自己的不透明度动画器追加 `hideStart → 100`、`hideEnd → 0`，所有字同区间渐隐；
  关键帧统一 LINEAR，失败兜底写回 100。
- 验收：`node test_DialogueText.js` → **383 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（0 秒起应重新逐字出现）。

## v1.3.45

- **DialogueText v0.11.2 → v0.11.3**：修复「开头逐字出现的效果没有了」。
- 根因：AE 新建的文本动画器**自带一个默认选区（0-100%）**，
  `applyTypewriter` 每字又 `addRangeSelector` 追加第二个选区；
  两选区并集覆盖全部字符，起止百分比失效，每字关键帧退化成整行一起渐变。
- 修法：每字动画器优先复用 `selGroup.property(1)`，取不到才新建；
  与 `applyScroll` / `applyTypeScroll` 三处统一。
- 验收：`node test_DialogueText.js` → **378 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（开头应恢复逐字出现）。

## v1.3.44

- **DialogueText v0.11.1 → v0.11.2**：修正整体渐隐关键帧。
- 真机日志报 `值 -100 在 0 至 100 的范围外`，且整行文字一开始就看不见。
- 根因：文本动画器 Opacity 是**目标不透明度**（100 = 不变，0 = 全透明），脚本范围 0..100；
  v0.11.0/0.11.1 按「叠加值」写成 `0 → -100`，第一帧 0 写入成功且向前保持 → 整行全透明。
- 修法：改为 `lastVisible` 处 **100** → `endTime` 处 **0**；catch 里把两个关键帧重置为 100 兜底。
- 验收：`node test_DialogueText.js` → **373 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**。

## v1.3.43

- **DialogueText v0.11.0 → v0.11.1**：修复真机「应用动画」失败
  （`Error: 在需要数字、数组或属性的位置找到类型为"Error"的对象 @line 1096`，整体回滚）。
- 原因：v0.11.0 为整体渐隐新建**第二个**文本动画器（`DT_渐隐整体`），AE 26 上该链路不稳定；
  且 `diag("..." + eFK)` 拼接时二次抛错，吞掉了真实原因。
- 修法：整体渐隐改为与 `DT_滚动` **共用同一个动画器**（属性组里再加文本不透明度，
  `lastVisible` 处 0 → `endTime` 处 -100）；新增 `errText()` 统一安全转换错误对象。
- 「输出与调试」日志框 **4 行 → 10 行**；日志/诊断补上隐藏像素。
- 验收：`node test_DialogueText.js` → **371 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（点「应用动画」应成功，隐藏阶段同时渐隐 + 左移）。

## v1.3.42

- **DialogueText v0.10.0 → v0.11.0**：按用户澄清「隐藏时间，本身也会有透明度从100到0的变化，
  隐藏像素，只是让这个变化的过程中，文字移动」修正隐藏阶段的语义。
- 新增文本动画器 **`DT_渐隐整体`**：隐藏(秒) 内文本不透明度关键帧 `0 → -100`
  （整行 100% → 0%），与 `DT_滚动` 的左移同区间、同时发生；不改图层自身 Opacity。
- **隐藏像素**只负责位移（默认按用户截图改为 **100**；0 = 原地渐隐）。
- **羽化默认值按截图改为 25**（原 60）。
- 验收：`node test_DialogueText.js` → **367 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（隐藏阶段应同时看到渐隐与左移）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.41

- **DialogueText v0.9.0 → v0.10.0**：按用户要求修正内向羽化导致逐字出现第一个字发虚的问题。
- 逐字出现位置表达式新增**羽化补偿**：清晰区 `[框左+羽化, 框右-羽化]`，
  文字左缘自动右移进清晰区，打字前沿最多到清晰区右缘；羽化宽按图层缩放反算并夹到半框宽。
- 新增参数 **「隐藏像素」**：控制隐藏阶段向左位移的距离（画面像素，默认 600；0 = 不动）。
- 抽出 `getScaleXY()`，蒙版与逐字表达式共用缩放读取。
- 验收：`node test_DialogueText.js` → **360 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（观察第一个字是否仍发虚、隐藏像素 0/600/1200 的位移）。
- 文档四件套 + `tips/tools/DialogueText.md` 同步。

## v1.3.40

- **DialogueText v0.8.0 → v0.9.0**：按用户要求「两套控制……选中哪个就用哪个，就不用下拉式的」，
  把「方式」下拉改成**两个互斥单选**（`横向滚动` / `逐字出现`）。
- `横向滚动参数`（方向/时长/开头曲线/结束曲线）与 `逐字出现参数`（渐隐/出现/隐藏）
  各自成组，选中哪个模式就只显示哪套参数；切换后 `pal.layout.layout(true)` 重新排版。
- 方式读取收口到 `getMode()`；`readParams()` 不再直接读下拉 index。
- 应用/诊断日志按模式只打印相关参数（逐字模式不再打印方向/曲线/时长）。
- 验收：`node test_DialogueText.js` → **347 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（两套参数组显隐、切换后无空白/重叠）。
- 文档四件套 + `tips/tools/DialogueText.md` 同步。

## v1.3.39

- **DialogueText v0.7.0 → v0.8.0**：按用户纠正「应该只有 2 个模式」，把模式合并回去。
- 方式下拉恢复 **2 项**：`横向滚动` / `逐字出现`；删除 `MODE_TYPE_SCROLL` 与第三分支，
  旧值 2 由 `normalizeMode` 回落到横向滚动。
- **「逐字出现」= 一整套动画**：逐字出现 → 打满文本框后整行左移 →
  最后一个字出现后整行向左滑出（被窗口蒙版裁掉）；
  原来的「原地逐字出现、不加蒙版」分支删除。
- **删除「字速」参数**：出现节奏只由「出现(秒)」决定，
  `step = (出现时长 - 单字渐隐) / (字数 - 1)`。
- 参数行合并为 `渐隐(秒) / 出现(秒) / 隐藏(秒)`（仅逐字出现启用）；
  边距/羽化/强度在两种模式下都可用。
- 验收：`node test_DialogueText.js` → **341 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（模式下拉 2 项、逐字出现整套节奏、滑出裁切）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.38

- **DialogueText v0.6.0 → v0.7.0**：按用户澄清「逐字出现，然后隐藏是一整套动画，
  而且也需要时间可以控制的」重做逐字左移。
- **窗口 = 文本框**：删除「窗口宽」参数与 `computeTypeScrollBox`，
  直接用 `computeBox`（文字范围 + 四边边距）当可视窗口，打满后整行左移。
- **时间只填两段**：删除「停留 / 整体渐隐」，改为 **出现(秒)**（整句打完的总时长）
  与 **隐藏(秒)**（整行滑出窗口用时）；`字速` 只保留给「逐字出现」。
- **隐藏 = 整行向左滑出**：删除 `DT_渐隐整体`；位置表达式分两段：
  出现阶段按平均字宽推进、超出窗口右缘才左移；
  出现结束后用隐藏时长把位移线性推到「文字右缘贴窗口左缘」，完全滑出被蒙版裁掉。
- `computeTypeScrollTiming(charCount, appearDur, fade, hideDur)` → `step / lastVisible / endTime`；
  `applyTypewriter` 增加可选 `intervalOverride`，逐字左移直接传步长。
- 出点延长到「出现 + 隐藏」结束；零边距时打字阶段不左移（几何必然），
  想中途左移用负右边距收窄窗口。
- 验收：`node test_DialogueText.js` → **338 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（出现节奏、滑出速度、框外不可见）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.37

- **DialogueText v0.5.1 → v0.6.0**：一次提交解决用户三条反馈。
- 新增**逐字左移**模式（`MODE_TYPE_SCROLL=2`）：固定窗口内从左往右逐字出现，
  满窗后整块连续左移，最后一个字出现并停留后整体渐隐。
  - 新增参数：**窗口宽(px)**（0 = 跟随文字）、**停留(秒)**、**整体渐隐(秒)**；
  - 纯函数：`computeTypeScrollBox` / `buildTypeScrollExpression` / `computeTypeScrollTiming`；
  - 实现为「逐字出现 + `DT_滚动` Position 表达式（平均字宽推进）+ `DT_渐隐整体` Opacity 关键帧」，
    出点自动延长到整体渐隐结束；窗口宽 0 时退化为逐字出现 + 整体渐隐。
- **首次加载提速**：`flog()` 改为内存累积 + 最多每 800ms 整文件写一次（上限 2000 行），
  挂载完成 / 操作结束 / 异常时 `flushLog()` 强制落盘，不再每条日志重写桌面文件。
- **说明文字去输入框**：`addNote` 改用 `statictext`，去掉只读 edittext 的白底与滚动条；
  真实数值参数（字速/时长/边距/窗口宽等）仍是输入框。
  UI 上只保留底部「输出与调试」一个多行框。
- 验收：`node test_DialogueText.js` → **335 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（逐字左移节奏、整体渐隐、框外不可见、首次打开速度）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.36

- **DialogueText v0.5.0 → v0.5.1**：按用户反馈「羽化是向内羽化，所以超出边框会完全看不到」。
  根因：AE 蒙版羽化以路径为中心向两侧扩散，v0.5.0 的路径压在框边，
  框外还有 half-feather 宽度的半透明文字。
- 新增 `computeFeatherInsetBox(box, featherLayerX)`：蒙版路径左右各内缩**半个羽化**，
  过渡区完全落在框内，**框外完全不可见**；过渡总宽度仍等于面板「羽化(px)」。
- 羽化值按 `scaleX` 反算后夹到框宽以内，路径至少保留 0.5px，避免大羽化把矩形压扁。
- 上下仍不羽化、不内缩；诊断日志改为「左右羽化(向内)」。
- 验收：`node test_DialogueText.js` → **275 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（框外无半透明文字、羽化总宽度与输入一致）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.35

- **DialogueText v0.4.0 → v0.5.0**：按用户要求「增加动态曲线 —— 开头的曲线和结束的曲线，
  默认可以选择几种常见的曲线，比如淡入淡出、前面快后面慢、前面慢后面快」。
- 新增两个下拉：**开头曲线**（匀速起步 / 慢起加速 / 快起减速）+ **结束曲线**
  （匀速收尾 / 减速慢收 / 加速快收），只改速度分布，起止点、时长、文本框均不变。
- 新增纯函数 `easeProgress(k, startCurve, endCurve)`：
  `a` 由开头曲线、`b` 由结束曲线决定，按 `q = a*(1-k) + b*k` 加权，端点严格 0/1。
  慢起+慢收 = 淡入淡出（smoothstep）；快起+慢收 = 前快后慢；慢起+快收 = 前慢后快。
- `buildScrollExpression` 增加 `startCurve / endCurve`，曲线在表达式里内联展开，
  默认匀速与 v0.4.0 行为逐字一致。
- 逐字模式无位移，两个曲线下拉自动禁用；应用日志打印两种曲线文案。
- 验收：`node test_DialogueText.js` → **254 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（三种常见组合的手感、两种方向、逐字模式禁用）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.34

- **DialogueText v0.3.0 → v0.4.0**：按用户反馈「动画应该是文字在文本框内的移动，现在是整个文本框移动了」。
  根因：v0.3 的窗口按「画面四边内缩」生成，内缩默认 0 时窗口=整个 5120×1600 画面，
  文字（宽 557px）会横穿整屏 —— 视觉上就是整块文字在飞。
- 文本框改为**贴合选中文字自身范围**（`sourceRectAtTime` 层空间）：
  `computeBox(rect, padL, padR, padT, padB)`；边距 0 = 紧贴文字，正数外扩、负数内收；
  逐层生成，不再依赖画面宽高。
- 蒙版改**静态 Shape**（`new Shape()` + 顶点/零切线/闭合 + `setValue`），去掉路径表达式与 `fromComp()`。
- 滚动起止点直接用框的左右边界（层空间常量），零边距时行程 = 2 倍文字宽。
- **羽化只作用左右边缘**（`fea.setValue([feather / sx, 0])`）；**逐字出现模式不再加窗口蒙版**。
- UI 改为「左边距/右边距/上边距/下边距」，删除「动画」分组里重复的羽化输入框。
- 验收：`node test_DialogueText.js` → **190 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（框是否留在文字原位置、文字是否只在框内滑过、边距正负、羽化/强度、重应用）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.33

- **DialogueText v0.2.0 → v0.3.0**：按用户反馈「空对象方案复杂了」，改为**参数化文本框**。
- 移除 `DT_左消失点` / `DT_右消失点` 空对象、`ensureNull` / `defaultNullXs` / `doSelectNulls`
  以及「消失点控制器」UI 分组。
- 新增面板参数：`左缩 / 右缩 / 上缩 / 下缩`（px，0 = 贴画面边）→ 合成坐标矩形；
  `羽化(px)` → 蒙版羽化（按图层缩放反算）；`强度(%)` → **蒙版不透明度**（用户确认的语义）。
- 蒙版路径仍为表达式：四角以合成坐标写死，运行时 `fromComp()` 换算到图层空间，
  缩放/旋转/父级图层上的文本框在画面上仍是轴对齐矩形。
- 滚动起止点改由文本框左右边界决定（`buildScrollExpression` 增加 `boxLeft/boxRight/midY`）。
- **参数可继续调整**：改完参数再点「应用动画」，先按名称清理旧动画再重建，不叠加；单 Undo 组。
- 验收：`node test_DialogueText.js` → **172 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（四边内缩、羽化距离/强度、两种方向/方式、改参数重应用）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.32

- **DialogueText v0.1.3 → v0.2.0（破坏性改版）**：按用户要求推翻「多行脚本 → 生成字幕层」方案。
  改为**读取时间轴上选中文本层的 Source Text，就地加动画** —— 不改文字、字体、字号、图层位置。
- 新增**两个空对象控制器** `DT_左消失点` / `DT_右消失点`：在合成里左右拖动，
  两端渐隐位置经表达式**实时**变化，无需重新应用。
- 窗口改为 **1 个矩形蒙版**（`MaskMode.ADD`，`DT_窗口`）+ 蒙版路径/羽化表达式，
  用 `fromComp()` 把控制器位置换算到图层空间，两端羽化向内展开。
- **方式**：横向滚动 / 逐字出现；**方向**：从右往左 / 从左往右。
  滚动用文本动画器 `ADBE Text Position 3D` 的位置表达式（不动图层 Position）；
  逐字用每字符 Opacity 动画器 + 关键帧。
- 安全机制：单 Undo 组；失败回滚本次动画器/蒙版/新建空对象；重应用前按名称清理旧动画；
  **先清理再测量**避免旧滚动位移污染 `sourceRectAtTime`；移除动画后无使用者时顺手删控制器。
- 移除旧功能：多行脚本解析、时间码/排期、角色配色、九宫格、生成字幕层及全部相关 UI。
- `ADBE Text Position` 会报 `Can not add a property`，必须用 **`ADBE Text Position 3D`**（已联网核对）。
- 验收：`node test_DialogueText.js` → **164 通过 / 0 失败**；`verify.py` / `install.py` 通过；
  ⚠️ 仍**待真机验证**（拖动控制器实时性、两种方向/方式、重应用不叠加、单次撤销）。
- 文档四件套 + `tips/tools/DialogueText.md` + `AE_API_VERIFIED.md` 第 8 节同步。

## v1.3.31

- **DialogueText v0.1.2 → v0.1.3**：修复真机「构建日志全绿、面板整窗空白」。
  根因：v0.1.2 删分页时连带删掉了 `showPage()` 里的 `pal.layout.layout(true)` ——
  AE 的 ScriptUI Panel 不会自动排版脚本动态添加的控件，控件都在但一个不显示。
- 挂载末尾补回 `pal.layout.layout(true)`（仓库其余 6 个面板同款收尾；
  Adobe 社区 "Blank Panel" 的结论也是这一句），并把面板实际/首选尺寸写进日志。
- UI 骨架按 `_template/PanelTemplate.jsx` 收口；参数改两列排、文本框收矮
  （脚本 6 行 / 预览 3 行 / 调试 4 行），避免单页内容超出面板可视区。
- ⚠️ 顺带发现 `_template/PanelTemplate.jsx` 自己也没写这句 `layout.layout(true)`，待补。
- 验收：`node test_DialogueText.js` → **132 通过 / 0 失败**。

## v1.3.30

- **DialogueText v0.1.1 → v0.1.2**：按用户反馈**去掉分页**。
  v0.1.1 的「页面下拉 + group 显隐」虽能显示，但用户明确「面板就不应该分页」。
- 改为**单页纵向 + 5 个 `panel` 分组**（与 NumCounter / MountainSpectrum 同款）：
  脚本 / 时间 / 文字 / 布局 / 输出与调试全部直接可见。
- 主按钮与状态栏固定在版本号下方，面板再矮也点得到；
  脚本框 8 行、预览框 5 行、调试框 6 行，压缩总高度。
- 桌面日志 `DialogueText_debug.log` 与构建失败兜底界面保持不变。
- 验收：`node test_DialogueText.js` → **132 通过 / 0 失败**。

## v1.3.29

- **DialogueText v0.1.0 → v0.1.1**：修复真机打开面板**整窗空白**。
  根因指向 `tabbedpanel`（本仓库唯一无先例容器）→ 改为「页面下拉 + 5 个 group 显隐」。
- UI 构建整体 `try/catch`：失败时进入**兜底界面**（显示日志 + 复制 + 打开），不再空白等待。
- 新增桌面日志 `DialogueText_debug.log`：脚本实际路径 / AE 与 ExtendScript 版本 /
  UI 构建每一步 / `safeRun` 操作与异常（行号、文件、错误号、堆栈）；失败回退系统临时目录。
- 面板「输出与调试」页新增「显示完整日志 / 日志存桌面 / 打开日志」。
- 验收：`node test_DialogueText.js` → **132 通过 / 0 失败**。

## 文档维护 · 2026-11-17

- 接入 knowledge-base 的**单项目规范**（spec 2.1.3 / repo-kit 2.7.2，profile `link-only`）
- 新增 `schema/taxonomy.json`、`tools/repo-kit/`、`tools/update-repo-kit.ps1`、`schema/kit.lock.json` 与 CI
- 只查链接与入口，**不要求 frontmatter**
- 71 个 md、66 个相对链接全部纳入检查，首次体检零错
- 验收：`REPO CHECK: PASS`（ERROR=0）、`KIT LOCK: PASS (v2.7.2, spec=2.1.3)`

## v1.3.28

- **MountainSpectrum v1.5.7 → v1.5.8**：**修正 v1.5.7 的方向错误**。用户澄清：
  「现在的模式似乎不对……控制点是唯一控制起伏的东西。那么山峰柱根据它的位置跟控制点互动，看是否起伏。」
- **v1.5.7 错在哪**：把形状基准挂到「控制器」上后，柱带着山形整体走、山形【永远不变】——
  但用户要的是**控制点固定在合成里当地形、柱是移动的采样者**：柱走到哪儿就按哪儿的地形高度长，
  被父级带走后离控制点远了，就【该】不起伏。
- **正确做法**：基准改用【本图层在合成空间的真实位置】`thisLayer.toComp(transform.anchorPoint)`：
  无父级时 ≡ `transform.position`（与最初行为完全一致）；设父级瞬间 AE 补偿 position 但视觉不变 →
  形状不变；父级一动 → 真实位置变化 → 高度按新位置重算 → **「柱子扫过固定地形」**。
- **测试方法的关键**：mock 新增 `thisLayer.toComp`，且 `layerWorld`（真实位置）与 `layerPos`（position 值）
  **可分离** —— 这是能模拟「AE 补偿 position 但真实位置不变」的唯一办法；二者不分离就测不出。
  第十三节重写为 25 条断言：柱真实位置移动 → 形状必须改变、移出影响范围 → 回基础高度、
  position 被补偿但真实位置不变 → 形状逐位不变。**反向对照** 4 处注入 → 8 条变红。
- **顺带**：修掉 v1.5.7 遗留的提示文本字面 `\\n` 转义 bug（面板里显示成错误字符）；
  修面板 README 版本行（停在 v1.5.5，两轮漏更）；第七节基准断言更新（同一个 `indexOf` 弱断言坑已踩两次，
  注释里写明「基准类断言必须钉当前实现的完整串 + 断言旧写法不存在」）。
- 验收：`node test_MountainSpectrum.js` → **286 通过 / 0 失败**；`python verify.py` → 11/11。

## v1.3.27

- **MountainSpectrum v1.5.6 → v1.5.7**：「山峰 柱」现在可以**设父级跟随运动**而不会毁掉山形。
  需求原文：「我希望山峰 柱可以选择一个父级，跟随运动，但是这样的话，之前到山峰的效果就没有了」
  → 补充：「我就是希望控制点的位置不变。也能有效果」。
- **根因是坐标系混用（不是父级功能本身的问题）**：形状基准原先取自**柱图层自身的
  `transform.position`** —— 在 AE 里给图层设父级时 AE 会**补偿**该值（改写它以保持视觉位置），
  基准随之漂移；而峰点没有父级（仍是合成坐标）→ 两者差一个父级偏移 → 形状散掉。
  **实测（40 根取样）**：只有柱的坐标系平移 → **33/40 根高度改变**；全部图层一起平移 → 0/40。
- **修法**：基准改挂到**「山峰 控制器」**（空对象、不该跟随运动）上 →
  **山形由控制点唯一决定**，而柱图层可自由设父级跟随运动。
  改动 4 处：基准 X（`bx`）、总闸基线 Y（`hMax`）、峰高基线 Y（`pk2` / `pk`）。
  **等价性**：`generate()` 里控制器与「山峰 柱」同置 `[centerX, baseY]`，对现有用法无行为变化。
- **顺带修正**：拖动「山峰 柱」图层现在**只平移整行、不再连带改变山形** ——
  这正是本文件一贯的设计意图（「拖动形状图层移动整行」），此前因基准取自图层自身而实际会变形。
- 断言 273 → **285**。新增**第十三节**「柱图层设父级 / 拖动不再影响形状」：
  ① 柱位置平移（±300 / −500）→ 40 根高度**逐位不变**；② 控制器平移 → 形状**必须改变**
  （证明基准确实换了源，否则断言可能假绿）；③ 柱的 Y 变化不影响形状、控制器 Y 变化影响形状。
  **反向对照**：3 处注入 → **10 条断言变红**，还原即恢复。
- **顺带修一条漏网的弱断言**：`核心用图层自身 X 定位柱子` 用的是
  `indexOf("transform.position[0] + …")` —— 基准改成 `c.transform.position[0] + …` 之后
  **它照样通过**（`c.` 之后的子串仍匹配）。已改为带 `c.` 前缀的完整串。
- **面板可观测性**：「诊断」新增**父级状态**报告（柱 / 控制器 / 总闸三层），
  基准层被设了父级会标 `<-- !! 基准层不该有父级`；提示区新增「跟随运动 / 父级」一段；
  面板 README 常见问题补对应问答（含"哪些层能设父级"对照表）。
- ⚠️ **已有工程需重新生成一次**才会用上新表达式（表达式是生成时写进图层的）；
  因为控制器与柱同位置，重新生成后形状与原来一致。

## v1.3.26

- **给 5 个零测试面板补断言测试 —— 全仓技术债清零**（此前 **4,656 行代码零回归保护**）：

  | 面板 | 新版本 | 断言数 | 取函数方式 | 本轮顺带修/记 |
  |---|---|---|---|---|
  | AE-Water-Rise-Generator | **1.1.2** | 75 | 导出闸门 | 断言按实测真值重写（1/255 → 实测 1.53/255） |
  | AE-Lyrics-Animator | **3.7** | 38 | 导出闸门 | 记录债务：全文件无 Undo 组 |
  | AudioScale | **1.0.1** | 53 | 导出闸门 | `VER` 从 buildUI 内提到 IIFE 顶层；修注释缩进 |
  | starry-sky-generator | **3.4** | 43 | **文本提取** | 修两处硬编码版本号（窗口标题/启动日志还写着 v3.2） |
  | AE-Dashed-Grid-Generator | **1.0.2** | 29 | —（无纯函数） | 记录债务：`layout.resize()` 撑宽 + 无 Undo 组 |

- **两个可复用的取函数方式**（都进了 `_template/README.md` 的同类讨论）：
  ① **导出闸门**（首选）—— `if (typeof app === "undefined") { module.exports = …; return; }`，
     **位置有硬约束**：所有纯函数之后、任何 AE API 之前；AE 里 `app` 存在即整块跳过，运行行为零变化；
  ② **文本提取**（无闸门可用时）—— 按花括号配对从源码切出函数体再 `eval`。
     starry-sky 用它是因为外壳是**裸块 `{ … }`**（而非 IIFE），块内 `return` 不合法，闸门写不进去。
- **本轮发现并修复的缺陷**（都不是用户报的，是"补测试的路上撞见"）：
  starry-sky 窗口标题与启动日志硬编码 `v3.2` 而 `VER` 已是 3.3（版本号并非单一真相）；
  AudioScale 的 `VER` 藏在 `buildUI` 函数内部（闸门引用不到，且单一真相不该藏在函数里）。
- **记录 4 项已知债务**（本次**不改行为**，只在测试里写成条件式断言"钉住不恶化"）：
  Lyrics-Animator 无 Undo 组 / Dashed-Grid 无 Undo 组 / Dashed-Grid 的 `setStatus` 调 `layout.resize()`
  （会在状态栏文本变长时撑宽面板，MountainSpectrum v1.1.1 踩过）/ 两处"契约边界"（图层名不转义、
  `findBothChannelsEffectIndex` 不做空值兜底）。
- **反向对照全部通过**（每个面板都做了）：合计注入 16 处回归 → 25 条断言精确变红，还原即恢复。
  过程中抓到一条**弱断言**：把 `Math.round` 改成 `Math.floor` 时 starry-sky 所有颜色断言照样通过
  —— 已补"半通道值四舍五入"用例专门抓它。
- 验收：`python verify.py` → **11/11 面板 + 骨架 45/45 全通过，技术债 6 项全清零**

## v1.3.25

- **新增面板骨架模板 `_template/`**（PanelTemplate.jsx / test / 四件套）：从 MountainSpectrum
  v1.5.6（仓库唯一完成度最高的面板）**只抽通用骨架、不抽业务**。承载的每条约定都有出处：
  顶部版本号 + `VER` 三处一致 / 测试导出闸门 / `safeRun` 包裹所有 handler / `pinW` 三处都写 /
  `fixedBox` 先钉宽度再钉高度 / `scrollable` 存在性回退 / 单 Undo 组 + `finally` /
  「未激活合成」状态栏 + 弹窗双提示 / 诊断三件套。**45 条断言，其中 6 组是「骨架体检」断言**，
  守着上面这些约定本身不被改腐（模板会被反复复制，骨架腐化了每个新面板都是错的）。
- **新增脚手架 `new_panel.py`**：`python new_panel.py MyPanel "我的面板"` 一条命令派生
  （复制 + 改名 + 替换标识 + 生成四件套）。**已实测**：派生 DemoPanel → 语法 OK、45/45 全绿、
  标识零残留，产物已删除。
- ⚠️ **模板不能放 `panels/` 下** —— `install.py` 的 `collect_jsx()` 会收集 `panels/` **一级子目录**
  里的所有 `.jsx` 并部署，模板放进去会被当成真面板装进 AE 扩展菜单。故放仓库根 `_template/`。
- **`verify.py` 新增第 ⑤ 项「骨架巡检」**：模板本体（语法 + 自带测试 + 版本一致性）。
  为什么必须单独查：面板扫描是 `panels/*`，覆盖不到 `_template/` —— 模板不查就会腐化。
  **已做反向对照**：把模板改腐（handler 绕过 `safeRun`）→ verify 报 `FAIL 44 通过 / 1 失败`
  且退出码 1；还原 → 全绿、退出码 0。

## v1.3.24

- **横向统一：11 个面板全部具备「版本号单一真相 + 面板顶部常驻显示」**
  背景：AE 只在**启动时**载入 ScriptUI Panel 脚本 —— 改完不重启 AE，面板里跑的还是旧版，
  而 AE 报的错也可能是**旧文件**的行号（2026-09-21 MountainSpectrum 实测：AE 比脚本早启动 33 分钟，
  报的「行 2069」属于旧文件）。没有版本号就无从判断 AE 里跑的是不是最新的。
  - 为其余 10 个面板补齐 `var VER` 常量 + 面板顶部加粗版本号：
    AudioScale **v1.0.0**（首次编号，此前 CHANGELOG 只写「当前版本」）、TimeAxisIndent **v1.7.2**、
    AE-Dashed-Grid **v1.0.1**、AE-Water-Rise **v1.1.1**、AE-Lyrics-Animator **v3.6**、
    AE-Rolling-Lyrics **v3.8**、AE-Rolling-Lyrics-V2 **v2.0.14**、NumCounter **v0.2.10**、
    QuickKey **v0.3.12**、starry-sky-generator **v3.3**
  - 顺带修两处版本号不一致：QuickKey 文件头停在 `0.3.6` 而 CHANGELOG 已到 `0.3.11`；
    TimeAxisIndent 文件头 `1.7.1` 与新增的 `VER` 不同步
  - `verify.py` 新增两项检查：**占位符残留**（教训：批量改时残留 `HOST.add`，而 `node --check`
    只查语法、**抓不到未定义变量**，四个面板全"通过"却是坏的）、**VER 与 CHANGELOG 顶部一致性**
  - 验收：`python verify.py` → **11/11 通过**；「无 VER 常量」欠债 **10 → 0**
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
