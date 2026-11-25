# AE 脚本 API 校验记录（对话文本动画）

> 校验日期：2026-11-25
> 来源：After Effects Scripting Guide（docsforadobe 仓库）、Adobe 官方文本动画文档、Adobe 社区实测代码。
> 原则：代码里只用下列已校验名称；不确定的路径做两级回退并写诊断，不靠猜。

## 1. 文本图层与 TextDocument

- `comp.layers.addText([sourceText])` → TextLayer（点文本）
- `comp.layers.addBoxText([width, height])` → TextLayer（段落文本，后续多行用）
- 源文本：`layer.property("ADBE Text Properties").property("ADBE Text Document")`
- `TextDocument` 已确认属性：
  - `.text`（字符串）
  - `.font`（PostScript 字体名；字体缺失时 AE 会自动替换）
  - `.fontSize`（数值）
  - `.fillColor`（[r, g, b]，0–1）
  - `.applyFill`（布尔）
  - `.justification`（`ParagraphJustification.LEFT_JUSTIFY / CENTER_JUSTIFY / RIGHT_JUSTIFY`）
  - `.tracking`（1/1000 em）
  - `.leading`（数值）、`.autoLeading`（布尔）
  - `.boxText`（**只读**）、`.boxTextSize`（[w, h]）、`.boxTextPos`
- 写回：`srcProp.setValue(doc)`

## 2. 文本动画器（渐隐 / 打字）

- 动画器组：`layer.property("ADBE Text Properties").property("ADBE Text Animators")`
- 新增动画器：`.addProperty("ADBE Text Animator")`
- 动画器属性组：`animator.property("ADBE Text Animator Properties")`
- 不透明度：`.addProperty("ADBE Text Opacity")`
  - 它是**目标不透明度**：100 = 不变，0 = 全透明（不是 0 = 不变 / -100 = 全透明的叠加值）；
  - `setValueAtTime` 取值范围 **0..100**；写 -100 会报
    「值 -100 在 0 至 100 的范围外」（AE 26.0 真机实测，2026-11-25）。
  - 多个动画器作用于同一字符时，不透明度会**覆盖**前面动画器的结果（不是相乘）：
    覆盖全行 0-100% 的 100% 动画器会让每字动画器 0 → 100 的逐字出现失效
    （真机 v0.11.2/v0.11.3 现象，v0.11.4 改为写进每字动画器）。
- 选择器组：`animator.property("ADBE Text Selectors")`
- 范围选择器：`.addProperty("ADBE Text Selector")`
- 起止百分比：`selector.property("ADBE Text Percent Start")` / `"ADBE Text Percent End"`
- 高级组：`selector.property("ADBE Text Range Advanced")`
  - `ADBE Text Range Units`：1 = 百分比，2 = 索引（社区实测）
  - `ADBE Text Range Type2`（Based On）：1 = 字符，2 = 不含空格字符，3 = 词，4 = 行（3/4 社区实测；1/2 为 UI 顺序）
  - `ADBE Text Selector Smoothness`：0 = 硬切，大于 0 = 边界渐隐
  - `ADBE Text Selector Mode`、`ADBE Text Selector Max Amount`
- 兼容写法：Smoothness 优先取 `ADBE Text Range Advanced` 子属性，失败再直接取 `selector.property("ADBE Text Selector Smoothness")`。

## 3. 蒙版（显示范围窗口）

- 创建：`layer.property("ADBE Mask Parade").addProperty("ADBE Mask Atom")` → MaskPropertyGroup
- 形状：`mask.property("ADBE Mask Shape")`；值用 `new Shape()`，设置 `vertices`、`inTangents`、`outTangents`、`closed = true`
- 羽化：`mask.property("ADBE Mask Feather").setValue([x, y])`（像素，2D）
- 不透明度：`ADBE Mask Opacity`；偏移：`ADBE Mask Offset`
- 模式：`mask.maskMode = MaskMode.ADD`
- 形状关键帧：`maskShapeProp.setValueAtTime(t, shape)`
- **关键点**：蒙版在图层空间，会跟图层一起移动。所以"窗口跟随尾部"要动画**蒙版路径**，文本层保持不动。

## 4. 时间与关键帧

- `layer.startTime = 0`；`layer.inPoint` / `layer.outPoint`（秒，可写）
- `prop.setValueAtTime(timeSeconds, value)`：时间以合成起点 0 计
- `prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR)`
- 可用：`comp.frameDuration`、`comp.frameRate`、`comp.duration`、`comp.width` / `comp.height`

## 5. 布局测量

- `layer.sourceRectAtTime(time, false)` → `{ top, left, width, height }`（相对图层锚点）
- 点文本左对齐时 `left ≈ 0`；居中时 `left ≈ -width/2`
- 用 rect 计算 9 宫格与堆叠基线

## 6. 参考来源

- Text Layer Match Names：https://ae-scripting.docsforadobe.dev/matchnames/layer/textlayer/
- TextDocument：https://ae-scripting.docsforadobe.dev/text/textdocument/
- LayerCollection（addText / addBoxText）：https://ae-scripting.docsforadobe.dev/layer/layercollection/
- PropertyGroup（Mask Atom / Mask Shape / Mask Feather）：https://ae-scripting.docsforadobe.dev/property/propertygroup/
- Property（setValueAtTime）：https://ae-scripting.docsforadobe.dev/property/property/
- MaskPropertyGroup：https://ae-scripting.docsforadobe.dev/property/maskpropertygroup/
- Shape：https://ae-scripting.docsforadobe.dev/other/shape/
- Adobe 社区（Range Type2：4 = 行、3 = 词）：https://community.adobe.com/questions-529/adding-an-expression-to-an-expression-selector-via-a-script-54885
- 法文社区（Range Type2 = 3 词；Units 1 百分比 / 2 索引）：https://www.repaire.net/forums/discussions/script-animation-texte-base-sur-mot.112996/
- Adobe 官方打字机：https://www.adobe.com/learn/after-effects/web/the-unlock-how-to-create-a-typewriter-effect-in-after-effects
- Adobe Help 文本动画（Smoothness）：https://helpx.adobe.com/after-effects/using/animating-text.html

## 7. 实现时的兜底与真机验证点

- Smoothness：优先 Advanced 子属性，失败回退直接子属性；仍失败则记录诊断，不阻断生成。
- Mask Feather：优先 `[f, 0]`（只横向羽化）；报错回退 `[f, f]`。
- 字体：从选中文本层继承；继承失败保留 AE 默认字体并写诊断。
- 所有 `property("...")` 取用都走 safeGet + try/catch；失败时把属性名写进诊断区。
- 不运行 AE 探针；以静态检查 + AE 真机手动验证为准。

## 8. v0.4.0 新增校验（2026-11-25）

v0.4.0 改为「读取选中文本层 + **贴合文字的静态文本框蒙版**」：
不再按画面内缩建框，也不再给蒙版路径写表达式。
v0.2.0 的空对象控制器方案、v0.3.0 的合成坐标 + `fromComp()` 表达式方案均已移除
（不再调用 `comp.layers.addNull()`，也不再依赖 `Layer.nullLayer`）。
下面只记录当前实现实际用到的项。

### 8.1 文本动画器位置必须用 3D matchName

- 官方文本层 matchNames 列表里，动画器属性组的 Position 写作
  **`ADBE Text Position 3D`**（即使图层是 2D 也必须用它）。
- 用 `ADBE Text Position` 调 `addProperty` 会抛
  `Can not add a property with name "ADBE Text Position"`。
- 同理：Scale → `ADBE Text Scale 3D`，Anchor Point → `ADBE Text Anchor Point 3D`。
- 实现：候选列表把 3D 名称放第一位，2D 名称只作后备；测试断言 3D 下标早于 2D。
- 来源：After Effects 文本层 matchNames 文档 + Adobe 官方社区实测帖
  （“even though it's not 3D, use ADBE Text Position 3D”）。

### 8.2 文本框蒙版（脚本侧，v0.4.0 起为静态形状）

- `layer.property("ADBE Mask Parade").addProperty("ADBE Mask Atom")` → `MaskPropertyGroup`。
- `mask.maskMode = MaskMode.ADD`（`MaskMode` 枚举含 ADD / SUBTRACT / INTERSECT / LIGHTEN / DARKEN / DIFFERENCE）。
- 文本框按**文字自身范围**（`sourceRectAtTime` 的**层空间**矩形）加四边边距得到，
  顶点直接写进 `mask.property("ADBE Mask Shape")`：
  ```js
  var sh = new Shape();
  sh.vertices = [[l, t], [r, t], [r, b], [l, b]];
  sh.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
  sh.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
  sh.closed = true;
  shape.setValue(sh);
  ```
  **v0.4.0 不再给蒙版路径写表达式，也不再使用 `fromComp()`** —— 蒙版与
  `sourceRectAtTime` 同属层空间，顶点可以直接使用；框随图层缩放/旋转一起变换。
- **羽化距离**写 `mask.property("ADBE Mask Feather")`：`setValue([featherX, 0])`。
  只做**左右羽化**，上下留硬边（框贴合文字后，上下羽化会把文字上下缘吃淡）。
  `sx = 图层 scaleX / 100`，`featherX = 羽化(px) / sx`，保证画面上的羽化宽度 ≈ 用户输入值。
- **羽化只向内扩散（v0.5.1，横向滚动）**：AE 蒙版羽化以路径为中心向**两侧**扩散，
  所以路径左右各向内缩 `featherX / 2`（`computeFeatherInsetBox`），
  外扩的那一半正好回到文本框边缘 —— **框外完全不可见**，过渡总宽度仍为 `featherX`。
  羽化值夹到框宽以内，路径至少保留 0.5px，避免大羽化把矩形压成一条线。
  **v0.11.5 起逐字出现改为向框外扩散**（`computeFeatherOutsetBox`，路径各外扩半个羽化）：
  逐字出现的窗口就是文本框，向内羽化会把首尾的字吃掉，长文本尾部尤其明显。
- **羽化强度**写 `mask.property("ADBE Mask Opacity")`，值域 0–100，**100 = 完全保留**。
  这是用户明确确认的语义：强度不是羽化宽度，而是框内整体不透明度。
- 重应用时按名称 `DT_窗口` 找到旧蒙版先 `remove()`，再新建，避免叠加。
- 蒙版在**两种模式都创建**：横向滚动用来裁掉框外文字；
  逐字出现用来裁掉隐藏阶段滑出窗口的文字（羽化向外，框内全清晰）。

### 8.3 表达式与层空间（非脚本 API）

- `sourceRectAtTime(t, false)`：返回**层空间** `{top, left, width, height}`。
  本面板在脚本侧调用它取文字范围（应用时测量），**不在表达式里调用**
  （与动画器同层，可能形成循环依赖）。
- 蒙版顶点、蒙版羽化、文本动画器 Position 偏移**都是层空间**，不需要坐标换算。
- 动画器位置表达式返回值维度必须与属性维度一致：
  `ADBE Text Position 3D` → `[dx, 0, 0]`；2D 后备 → `[dx, 0]`。
- 滚动表达式里的 `lo / hi`（文本框左右边界）与 `rl / rr`（文字左右缘）
  都是应用时烘入的**层空间常量**；运行时只用 `time`、`inPoint`。
- `createPath()` / `fromComp()` 在 v0.4.0 的实现里**已不再使用**。

### 8.4 动态曲线（v0.5.0，表达式内联）

- 两个下拉只决定表达式里追加哪两行，**不改** `lo / hi / rl / rr / s / e / dur`：
  - 开头曲线：慢起 `a = k * k;`；快起 `a = 1 - (1 - k) * (1 - k);`；
  - 结束曲线：慢收 `b = 1 - (1 - k) * (1 - k);`；快收 `b = k * k;`；
  - 组合：`var q = a * (1 - k) + b * k;`，位移 `var dx = s + (e - s) * q;`。
- 端点严格：`k=0` 时 `q = a = 0`，`k=1` 时 `q = b = 1`，与曲线组合无关，不会跳变。
- 匀速（默认）不追加覆盖行，`q = k`，与 v0.4.0 行为逐字一致。
- 表达式里**不定义函数**（AE 表达式引擎对函数声明支持一致，但内联更保守、日志可读）。
- 常见组合：慢起+慢收 = smoothstep `3k²-2k³`（淡入淡出）；
  快起+慢收 = `2k-k²`（前快后慢）；慢起+快收 = `k²`（前慢后快）。

### 8.5 逐字出现（v0.11.5：两个模式之一，一整套动画）

- 结构：每字符 `DT_渐隐NN`（Opacity 关键帧负责出现 + 隐藏渐隐）+ **一个** `DT_滚动`
  （**只挂 Position 表达式**，负责满窗左移与隐藏位移）。
  ⚠️ **文本动画器不透明度会覆盖同字符上其他动画器的结果**（不是相乘）：
  若把隐藏阶段渐隐挂到一个选区覆盖 0-100% 的动画器（如 `DT_滚动`）上，
  它出现结束时的 100% 会把每字动画器 `0 → 100` 的出现关键帧顶掉，
  整行从 0 秒起就可见 —— 真机现象「开头逐字出现消失」（v0.11.1~v0.11.3，v0.11.4 修复）。
  正确做法：隐藏渐隐写进**每个字自己的**不透明度动画器（同一区间 `100 → 0`）。
  ⚠️ 选区获取做防御：`if (selGroup.numProperties > 0) sel = selGroup.property(1)`，
  取不到才 `addRangeSelector`（不同版本可能自带默认选区）。
  ⚠️ 不要再单独创建第二个「渐隐整体」动画器：AE 26 上「第二个动画器 + 第二个选区」
  这条创建链路会抛 `Found an object of type 'Error' where a number, array or property
  was expected`（真机 v0.11.0 复现），导致整次应用回滚。
- 每字不透明度的关键帧共四个：`t0 → 0`、`t1 → 100`（出现）、
  `inPoint + lastVisible → 100`、`inPoint + endTime → 0`（隐藏渐隐），全部 LINEAR；
  最后一个字的 `t1` 与 `lastVisible` 重合时自动合并为 3 个关键帧。
  文本动画器的 Opacity 是**目标不透明度**（100 = 不变，0 = 全透明），
  脚本取值范围 **0..100**：写 `-100` 会报「值 -100 在 0 至 100 的范围外」
  （真机 v0.11.1 复现）。**不写图层自身 Opacity**。
- 错误对象在 `diag` 里必须经 `errText()` 转字符串：直接 `"..." + e` 在个别宿主错误上
  会二次抛错，把真实原因吞掉。
- 默认值（按用户截图）：渐隐 0.12 / 出现 2.0 / 隐藏 0.8 / 隐藏像素 100 / 羽化 25。
  隐藏像素 0 = 原地渐隐。
- 时间轴（`computeTypeScrollTiming(n, appearDur, fade, hideDur)`）：
  `step = (appearDur - fade) / (n - 1)`（单字为 0），
  第 i 字关键帧 `i*step → i*step + fade`，`lastVisible = appearDur`，
  `endTime = appearDur + hideDur`，出点延长到 `endTime`。
- 位置表达式（`buildTypeScrollExpression(n, rl, rw, bl, br, appearDur, fade, hideDur, is3D, hidePx)`）
  只用 `time` 与 `inPoint`，所有几何量烘入常量（v0.11.5 起**不再接收羽化宽**）：
  - 边界直接用文本框：`bl` / `br` 是框的清晰边界（逐字出现的羽化向**框外**扩散，
    见 `computeFeatherOutsetBox`：路径各外扩半个羽化 → 框内 alpha 恒为 1）。
  - 出现阶段：`ks = t / step + 1`（把正在画的字宽算进前沿）夹 `0..n`；
    `dx = br - (rl + avg * ks)`，上限 **0**（文字绝不右移）、
    下限 `dxEnd = min(0, br - rr)`；`avg = 文字宽 / 字数`。
    零/正边距时 `dx ≡ 0` —— 出现阶段文字完全不动，每个字都在自己的位置上逐字出现；
    只有负边距（框比文字窄）时，前沿到 `br` 后整行才左移。
  - 隐藏阶段：`t > appearDur` 后 `h = (t - appearDur) / hideDur` 夹 `0..1`；
    `dx0 = dxEnd`（与出现结束连续）、`dx1 = dx0 - hidePx`；
    `dx = dx0 + (dx1 - dx0) * h`；`hidePx = 面板像素 / 图层 scaleX`。
  - ⚠️ **不要重新引入「右移避羽化」**（`shift = 清晰区左缘 - 文字左缘`）：
    框 = 文字时它会把文字右缘推出框外，长文本尾部几个字整套落在羽化/框外，
    不透明度关键帧照常执行却看不见，只能等隐藏阶段滑出来（真机 v0.11.4 现象，v0.11.5 修复）。
- 窗口框：直接用 `computeBox(rect, padL, padR, padT, padB)`，没有独立窗口宽参数；
  边距为负会把窗口收窄，左移更早发生。
- 几何必然：零边距时窗口宽 = 文字宽，出现阶段 `dx ≡ 0`（完全不动），
  只有隐藏阶段按隐藏像素左移。
- 蒙版羽化方向：横向滚动向内（`computeFeatherInsetBox`，框外完全不可见）；
  逐字出现向外（`computeFeatherOutsetBox`，框内完全清晰）。
  这是 `applyWindowMask(layer, box, feather, strength, outward)` 的第 5 个参数。
- 说明文字：`statictext` 在 ScriptUI Panel 宿主里无白底/无滚动条（`edittext` 只读时是白底，
  内容超高会出滚动条）；真实数值输入仍是 `edittext`。
- 日志节流：`flog` 只 push 到内存数组（上限 2000 行），`writeLogSnapshot` 由
  `LOG_WRITE_GAP = 800ms` 节流；`flushLog` 在挂载完成 / handler 结束 / 异常时强制写。
  ExtendScript 的 `File` 写入是同步的，逐条写桌面文件在网盘同步目录下会线性拖慢启动。

### 8.6 仍需真机确认

- `new Shape()` + `shape.setValue(sh)` 写入四点矩形蒙版在真实 AE 中是否按预期显示。
- `ADBE Mask Opacity` 是否可在蒙版属性组上直接 `setValue`（预期可写，0–100）。
- 只做左右羽化（`[f, 0]`）时，`ADBE Mask Feather` 是否接受零值分量。
- 羽化按图层 scaleX 反算后，画面上的过渡宽度是否与输入值接近。
- 逐字出现的羽化方向：v0.11.5 起羽化向**框外**扩散，羽化 > 0 时第一个字和最后一个字
  都应立即清晰（长句尾部也要逐字出现，不能等隐藏阶段才露出来）；
  隐藏像素 0 / 600 / 1200 时位移是否符合面板输入（按 scaleX 换算）。
- 逐字出现零边距时 `dx` 是否恒为 0（出现阶段文字完全不动）、隐藏阶段是否连续左移。
- 文本动画器 Position 表达式里 `inPoint` 是否可直接使用。
- 文本框在缩放/旋转图层上是否随文字一起变换，且文字只在框内可见。
- 动态曲线三种组合（慢起+慢收 / 快起+慢收 / 慢起+快收）在真机上的速度分布是否符合预期，
  且同样时长内仍能准确走完框的左右边界。
- 逐字模式下每字符一个动画器在 2000 字符时的创建耗时。
- 逐字左移：满窗前 `dx=0`、满窗后连续左移；出现结束后整行在 `隐藏(秒)` 内
  向左滑出窗口并被蒙版完全裁掉；`出现(秒)` 与滑块节奏是否一致。
- 首次打开面板的耗时是否明显下降，说明文字是否已是纯文本（无白底框、无滚动条）。
- v0.11.6 段落框探测：撑高后 `sourceRectAtTime(t,false)` 的高度是否随文字行数变大
  （若恒等于撑高值，脚本会还原原框并写诊断）；点文本层是否完全不受影响。
- v0.11.7 官方 `boxOverflow`：日志是否出现 `段落框无溢出` 或
  `⚠ 段落文本溢出: 排版框 …`；`试探 N 次` 是否在个位数到十几。
- v0.11.8 单行化 + 原框作窗口（待真机确认）：
  1. 先 Ctrl+Z 撤销 v0.11.7 的撑高，确认段落框回到 595x49；
  2. 应用后日志：`⚠ 段落文本溢出: 排版框 595x49 → Wx49px (官方 boxOverflow, 试探 N 次, 1 行), 改为单行; 你的框 595x49 作为出现窗口…`；
  3. **框高不再变化**，只加宽排版框；文字/字体/字号/图层位置不变；
  4. 画面：文字只出现在 595x49 框内，先在框内逐字出现，打满后整行从右往左流动，
     隐藏阶段继续左移并渐隐；最后一个字也能看到；
  5. 同一层再应用一次：蒙版名带 `DT_窗口 595x49`，窗口仍为 595x49（幂等）；
  6. `boxTextPos` 与 `sourceRectAtTime` 的层坐标是否一致（日志里的窗口坐标
     应与用户框在原处的画面对应）；
  7. 点文本层：窗口仍为文字外框，框尺寸/位置均不动。

### 8.7 段落文本（框文本）会隐藏超出定界框的文字（v0.11.6 起；v0.11.7 改用官方 boxOverflow）

- **官方依据**（已核对）：
  - 《创建和编辑文本图层》：段落文本按定界框换行；**输入超出定界框容纳量时，
    定界框上只出现溢出图标**；把段落文本转为点文本时，定界框外的字符会被删除
    （说明框外文字并不参与渲染）。
  - 《表达式语言参考》`sourceRectAtTime(t, includeExtents)`：
    **extents 仅对形状图层与段落文本图层生效**（AE 15.1+），
    段落文本下返回的是**段落框范围**；`includeExtents = false` 时返回文字边界。
    ⚠️ 官方只明确了 `true` 的情形；文字被框裁掉时 `false` 返回什么并未保证，
    所以**不要用它判定是否溢出**（v0.11.7 修正）。
- **官方溢出判定与修框属性**（AE 24.6+ 新增，AE 26.0 已确认存在）：
  - `TextDocument.boxOverflow`（只读布尔）：**有文字没能排进定界框时为 `true`**；
  - `TextDocument.boxTextSize`：`[宽, 高]`，可读写（整数，最小 1）；
  - `TextDocument.boxTextPos`：框左上角的图层坐标，可读写；
  - `TextDocument.composedLineCount`：排进框里的行数（全溢出时可能为 0）；
  - ⚠️ TextDocument 实例是**组合时快照**：改对象不会触发重排，
    必须在 `st.setValue(d)` 之后**重新取 `st.value`** 再读 `boxOverflow`。
- **后果**：长句放进「只够一行」的段落框时，后面的行既不显示、也不会被逐字演到；
  关键帧铺满整个出现时长，但视觉上只演可见的一行 —— 表现为
  「出现 6 秒像没生效 / 时长不对 / 尾部不出现」。
- **`fitParagraphBox` 的做法**（v0.11.8，取代 v0.11.7 的「拉高框」）：
  1. 仅当 `doc.boxText === true` 才处理；源文本有 `numKeys`/`expressionEnabled` 时跳过；
  2. 读 `st.value.boxOverflow`：`false` ⇒ 全部文字在框内，**不动用户的框**；
     `null`（旧版 AE 没有该属性）⇒ 走第 6 步的探测法；
  3. `true` ⇒ 先把框高设成**一行高**（`max(原框高, ceil(行距))`，行距缺失按字号×1.2）：
     此时 `boxOverflow === false` 等价于「整段排成一行」；
  4. 宽度**倍增**（w→2w→4w…，上限 `max(8192, 32w)`，最多 18 次）找到第一个不溢出，
     再在已知溢出 `lo` 与已知不溢出 `hi` 之间**二分**到最小一行宽，写回 `boxTextSize`，
     再读一次 `boxOverflow` 复核；仍溢出 / 异常 ⇒ 还原原框；成功后 `boxTextPos` 复位；
  5. 只写 `boxTextSize` / `boxTextPos`，不改文字/字体/字号/图层位置；
  6. 旧版回退：撑高到 `max(2000, 40h)` 后测 `sourceRectAtTime(t,false)`，
     `isBoxOverflow(原高, 测得高)` 为真 ⇒ 先放到足够宽量单行宽，再收紧到刚好一行；
     测得高 ≈ 撑高值 ⇒ 还原并告警；
  7. 每次写框都重新 `st.value` 取 TextDocument；任何异常路径都必须还原原框。
- **不可用于截断判断的写法**：不要用「撑高后的高度 ≈ 撑高值」当成溢出结论
  （那说明 API 返回的是框而不是文字），也不要用 `includeExtents=true` 的高度
  判断文字行数（它返回段落框范围）；能用 `boxOverflow` 就不要再用测量推断。
- 参考：
  - TextDocument（boxOverflow / boxTextSize / boxTextPos / composedLineCount）：
    https://ae-scripting.docsforadobe.dev/text/textdocument/
  - 脚本 API 更新日志（AE 24.6 新增列表）：
    https://ae-scripting.docsforadobe.dev/introduction/changelog.html

### 8.8 「你的框就是出现窗口」：单行化 + 原框作窗口（v0.11.8）

用户要求：**文字不超出框，但仍从右往左出现，像程序（终端）一样**；
并明确「我给的文本框就是出现字的范围」—— **不能改用户的框**。

- **为什么必须改排版框宽**（不是实现取舍）：
  - Adobe Help《创建和编辑文本图层》：段落文本**按框宽自动换行**，
    拖动定界框手柄只会让文字**重排**；超出定界框的行**不渲染**；
  - `TextDocument.boxText` **只读**：脚本不能把段落文本转成点文本
    （官方只提供右键菜单互转；转点文本会删除框外字符）；
  - ⇒ 595px 宽 + 49 字 + 字号 40.6 必然 3 行；「框保持 49 高」与「3 行全可见」不可兼得；
    要让整句一行，**排版框宽度必须够**。
- **窗口几何**：
  - `boxTextPos` = 段落框左上角的**层坐标**（可读写；与 `sourceRectAtTime` 同坐标系，
    真机日志 `文本框(层空间) [x1,y1]-[x2,y2]` 与 `boxTextSize` 宽高一致可交叉验证）；
  - 窗口 = `boxTextPos` + **原** `boxTextSize`（宽高都不动），再叠加面板四边边距；
  - 点文本仍沿用 `sourceRectAtTime` 的文字外框（`boxText=true` 时才用框）。
- **持久化**：原框尺寸写进蒙版名 `DT_窗口 595x49`
  （`buildMaskName` / `parseMaskNameBox` / `readStoredWindow`）；
  排版框已被加宽，**重复应用**必须靠它找回真正的窗口；
  `isOurMaskName` 改为前缀判定（`DT_窗口` 与 `DT_窗口 595x49` 都算本工具蒙版），
  旧版蒙版（精确名 `DT_窗口`）照常清理。
- **终端式流动**：窗口比文字窄时，位置表达式
  `dx = br - (rl + avg * ks)`（上限 0，`dxEnd = min(0, br - rr)`）
  让前沿始终贴着窗口右缘、整行随之左移；零/正边距时 `dx ≡ 0`（原位逐字出现），
  行为与 v0.11.5 完全一致。
- **边界情况**：
  - 框高 < 行距 ⇒ 日志告警（文字上下会被窗口裁掉）；
  - 文本含强制换行（`\r`）⇒ 宽度加满仍 `boxOverflow` ⇒ 还原原框并告警，不硬改；
  - 源文本有动画（`numKeys`/`expressionEnabled`）⇒ 不写 TextDocument（会覆盖动画）。
  - 创建和编辑文本图层（中文）：https://helpx.adobe.com/cn/after-effects/using/creating-editing-text-layers.html
  - 表达式语言参考（sourceRectAtTime / includeExtents）：
    https://helpx.adobe.com/cn/after-effects/using/expression-language-reference.html
  - 脚本 setValueAtTime（时间以合成起点 0 计）：
    https://ae-scripting.docsforadobe.dev/property/property/

### 8.9 逐字选区必须用索引单位，且每个动画器分别切（v0.11.10 / v0.11.11）

- 每字动画器的范围选择器原来写**百分比** `Start=i/n*100`、`End=(i+1)/n*100`。
  字符数 n 不能整除 100 时字符边界是小数，AE 按字符边界取整，
  可能把**相邻字一起并进同一个动画器**；被并进来的字沿用第一个动画器的关键帧
  （0 → 100 后一直 100 到隐藏阶段），表现为「有两个字从 0 秒起一直显示」。
- 官方《Animating text》：
  - 范围选择器的**单位**可选百分比或索引；
  - **依据**选「字符」时**空格也计入**（「不包含空格的字符」才排除空格）；
  - URL：https://helpx.adobe.com/cn/after-effects/using/animating-text.html
  - ⚠️ **真机 v0.11.10 反例（2026-11-25）**：`Units=Index` + `Based On=Characters(1)` 下
    **空格不占索引** —— 44 字含 1 空格时，AE 索引 31 是空格后的第一个「朵」而不是空格。
    按原文下标写 `Start=i / End=i+1` 会让该字没有任何动画器覆盖、从 0 秒起一直显示。
    ⇒ **索引单位与关键帧节奏统一用非空白字符序号 `selIdx`**（`countVisibleChars`），
    不依赖枚举含义，也不切换到未验证的 `Based On=2`。以真机行为为准。
- 官方 Text Layer Match Names（已核对，2025-11-21 版）同时列出两对属性：
  - `ADBE Text Percent Start` / `ADBE Text Percent End`（显示名 Start / End）
  - `ADBE Text Index Start` / `ADBE Text Index End`（显示名也是 Start / End）
  - `ADBE Text Range Units`（Advanced > Units）
  - 来源：https://ae-scripting.docsforadobe.dev/matchnames/layer/textlayer/
- **关键结论（真机 v0.11.9 验证）**：
  - 单位切到 Index 后，**百分比那对变成隐藏属性**；继续写它会报
    「无法将 'set value' 与此属性一起使用，因为属性或父级属性被隐藏」；
  - 两对属性**显示名完全相同**，不能用显示名 `Start` / `End` 兜底，必须按 matchName 取；
  - **每个新建动画器都自带一个默认选区**（默认百分比），必须逐个切单位；
    只切第一个会让后面的动画器把索引值当百分比用。
- 脚本写法（本面板 v0.11.11）：
  - `ADBE Text Range Units`：**2 = 索引**（1 = 百分比，社区实测）；
  - `ADBE Text Range Type2`：**1 = 字符**；
  - 索引单位下数值是**可见字符索引（0 基，空格不占）**：
    `Start=selIdx / End=selIdx+1` 精确选中第 selIdx+1 个可见字符；
  - 社区同款做法（`Units: Index` + `Start: 0 / End: 1` = 第一个字）：
    https://community.adobe.com/t5/after-effects-discussions/how-to-create-bounce-effect-with-text-animator/m-p/10687113
- 本面板实现：`setSelectorUnits` / `setSelectorIndexMode` / `findSelectorStartEnd(sel, wantIndex)`；
  取不到索引属性就切回百分比并写诊断，**绝不混用**。
- 真机已确认（v0.11.10）：无「设置选区失败」；但**空格后第一个字常显**
  ⇒ 已由 v0.11.11 的非空白字符序号修复。
- 真机已确认（v0.11.11，2026-11-25）：长句（含空格）无字常显，第一个「朵」按节奏出现
  ⇒ 非空白字符序号方案闭环。
  仍需回归核对：多个 `DT_渐隐NN > 范围选择器 1 > 高级` 里都是 Units = 索引、
  Start / End 为相邻整数、Based On = 字符、Smoothness = 0；日志显示 `N 字(可见 M)`。

