// ============================================================
// 山峰频谱  MountainSpectrum.jsx
// 版本: 0.9.0  (2026-09-18)
// 适用: After Effects 2015.3+ 至 2026 (ExtendScript / ScriptUI)
//
// 功能:
//   一键在当前合成里画出「等距横向排开的矩形」, 再用若干可拖动的
//   点位空对象控制高度 —— 矩形离点越近就越高, 宽度不变, 于是连成
//   一片中间高两侧低的小山丘; 点位加到足够多, 就成了音频波谱的样子。
//
// 核心设计:
//   矩形高度/位置由【表达式】驱动, 不烘焙关键帧 ——
//   生成后拖动点位、拖控制器滑块都实时生效, 无需重跑脚本。
//
// 产物(全部在同一个 Undo 组内, Ctrl+Z 可整体撤销):
//   1. 形状图层「山峰 柱」  = N 个矩形组(每个一组一矩形) + 根级填充
//   2. 空对象「山峰 控制」  = 7 个滑块(矩形宽/间距/基础高度/叠加方式/起伏曲线/影响范围倍率%/边缘高度%)
//   3. 空对象「山峰点 1..M」= 峰, 每个带 3 个滑块「影响范围」「高度」「边缘控制」
//   4. 空对象「山峰点 k 左 / 山峰点 k 右」= 左右边缘控制点
//      ⇒ 【一个波峰 = 一组 3 个可拖对象】(峰 + 左边缘 + 右边缘); M 个波峰 = M 组
//   5. 空对象「山峰 高度」  = 总闸: 它离基线多高, 整排最高柱就多高(直接拖它调高度)
//
// 点位语义:
//   X = 峰在哪(水平位置), Y = 峰多高(基线以上),
//   影响范围 = 【影响几根竖条】(kNN 半径 = 第 m 近那根柱子的实际距离) ⇒ 恰好 m 根
//   高度     = 该点峰高的绝对值(px, 基线以上); 0 = 自动(用"基线 − 点位Y")。
//
// 左右边缘控制点(v0.8.0)——一个波峰 = 一组 3 个控制点:
//   左半径 = 峰X − 左边缘点X;   右半径 = 右边缘点X − 峰X   ⇒ 两边可不对称
//   (左边缓右边陡 = 音频里 attack/decay 不同, 反之亦然)。
//   边缘点【接管】该侧半径: 它存在时「影响范围」不再管这一侧。
//   删掉某一侧边缘点 -> 那一侧回退成「影响范围」的对称半径;
//   两边都删 -> 完全回到对称, 即旧行为。
//   把边缘点拖到峰的【另一侧】-> 该侧半径为负 -> 钳到 0, 相当于关掉那一侧。
//   ⚠️ 「边缘控制」滑块(默认 1)是性能退路: 关掉它, 表达式就不再去做那两次
//      必然失败的图层查找。峰很多时(几十个)这能省下可观的求值开销。
//
// 总闸「山峰 高度」(v0.7.0):
//   它是一个普通空对象, 存在的唯一理由是【让高度也能靠拖点控制】。
//   拖它 -> 整排等比缩放到"最高那根 = 它离基线的高度", 各峰相对高矮保留、形状不变。
//   它不存在 / 被删掉 -> 总闸关闭, 完全回到"各点位用自己高度"的旧行为(向后兼容)。
//   ⚠️ 总闸一开, 各点位的「高度」就【退化为相对权重】—— 填 400 不再意味着绝对 400px,
//      而是"这一个峰相对其他峰高多少"。想让某根固定成绝对高度, 就把它调成最高那根,
//      再拖总闸到目标值。
//
// ⚠️ 两个必须说清的事实:
//   ① 影响范围在行根数为偶数时, 若点位恰好落在两根正中且 m 为奇数, 会得到 m+1 根 ——
//      对称窗口左右等距, 无法二选一。这是几何事实, 不是 bug。
//   ② "窗口内" ≠ "一定看得见" —— 贡献 = 峰高 × 衰减(t), 尾部衰减到 基础高度/峰高
//      以下时柱子被钳在基础高度上, 看着没变。边缘高度%让窗口最边缘那根保留一部分【地板之上的可用高度】。
//      v0.9.0 起衰减作用在"地板之上"的区间, 于是窗口内每一根都高过基础高度、都看得见。
//      状态栏会回报【实际可见根数】。
//
// v0.9.0 高度公式变更(用户报:「左右控制了之后只是影响范围, 但是无法让最低的上去,
//   必须要高度足够高, 这样的可控度还不够太够。可以是左右移动之后, 可控范围内的竖条
//   都会起效果吗, 只是说影响由于距离相对较小」):
//   旧公式: 柱高 = max(峰高 × 衰减, 基础高度)。
//     要看见窗口边缘, 必须 峰高 × e > 基础高度 ⇒ 【峰高 > 基础高度 ÷ e】——
//     e=30% 时是基础高度的 3.33 倍。基础高度一高, 边缘就被地板吞掉, 与范围外毫无差别,
//     这就是"必须要高度足够高"的根因(实测: 峰高 237.6 + 地板 150, 边缘柱高被钳到 150)。
//   新公式: 柱高 = 基础高度 + (峰高 − 基础高度) × 衰减。
//     衰减作用在【地板之上】的区间, 于是只要 e > 0, 窗口内每一根都保证高于地板;
//     峰顶仍精确等于峰高 —— "峰高 = 绝对高度"这条语义没有变。
//     落地: pointContribution 多一个 baseH 参数, 返回"超出地板多少"而不是绝对高度;
//           combineHeights 从 max(合成, 地板) 改成 地板 + 合成。
//     baseH 未给或为 0 -> effH = 峰高, 与旧公式逐点相同(旧调用零改动)。
//   默认「边缘高度%」30% → 10%: 新公式下 10% 已足够让边缘明显可见, 且范围边界的
//     台阶只有约 10% 可用高度, 不会突兀。仍可手动调。
//   ⚠️ 副作用(如实说明): 范围边界会出现一道台阶 —— 范围内最低 = 地板 + 可用高度×e,
//     范围外 = 地板, 两者相差 可用高度×e。e 越小台阶越轻; e=0 时无台阶, 但边缘恰好
//     落在地板上(看不见)。这是"圈定范围"这个契约的固有代价, 不是实现缺陷。
//   ⚠️ countVisibleBars 必须把 baseH 【真实传下去】—— 旧版传 0 再自己判定, 那是在躲
//     combineHeights 的 max 钳制; 新公式下传 0 会让 pointContribution 退化成"从零起算",
//     边缘又被判成不可见(实测可见根数会从 9 掉到 7)。
//
// v0.8.0 新增左右边缘控制点(用户要求:「每个点控制的边缘, 可以也用两个控制点来确定吗,
//   这样可控性会好很多」+「相当于一个波峰的控制点, 会有 3 个一组。这样, 多个控制点就有多个组」):
//   每个波峰配两个空对象「山峰点 k 左」「山峰点 k 右」, 拖它们的 X 定山丘左右边界 ——
//   取代了原先"一个「影响范围」管左右对称宽度"的限制, 现在两边独立。
//   命名复用 PT_PREFIX 前缀【是安全的】: countPoints 用 parseInt 取编号, 而 parseInt("1 左") === 1
//     (遇非数字即停); findLayer 是精确匹配; cleanup 用 indexOf(PT_PREFIX) === 0,
//     于是边缘点会自动跟着被清理。这三条都已写成断言钉住。
//   纯函数: resolvePoints 认 points[].xl / .xr(边缘点的绝对 X), 输出 { r: 右半径, rl: 左半径 };
//     pointContribution 多一个可选参数 rLeftPx —— 不传时两侧同用 rPx, 完全向后兼容,
//     于是几十条既有断言零改动。
//   表达式: 同逻辑 —— dd = bx − px, dd < 0 用 rl, 否则用 R。
//   交互: 「影响范围」字段变更 与 「重设点位」 都会调 syncEdgeX 把边缘点重摆到新半径处,
//     否则边缘点会与峰错位; 更要紧的是「影响范围」会被边缘点架空, 看着像个假参数。
//
// v0.7.0 新增总闸(用户要求:「增加一个控制高度的控制点, 这个点位多高, 最高高度就是多少」):
//   新增空对象「山峰 高度」+ 纯函数 intrinsicPeak / peakScaleOf:
//     pmax = max(各点位的"固有峰高")         固有峰高 = 「高度」>0 ? 该值 : (基线 − 点位Y)
//     hMax = 基线 − 高度控制点Y              (拖它 = 改 hMax)
//     hsc  = hMax / pmax                     最高那根恰好 = hMax, 其余等比
//   落地方式(关键): resolvePoints 启用总闸时把"归一化后的绝对峰高"编码进返回项的
//     y(= baseY − 峰高)并把 h 置 -1(自动) —— 于是 pointContribution 走它原有的
//     "自动"分支就能算出归一化峰高, 【完全不必改它的公开契约】。
//     为什么坚持不改: 「高度」滑块填 0 = 自动 是既有契约, 若把判据从 >0 改成 >=0,
//     h=0 的语义就变成"峰高 0", 几十条既有断言与用户手上的旧工程会一起撕裂。
//   默认: 生成时把高度控制点放在 基线以上 合成高×22% —— hsc 恰好 = 1,
//     观感与不开总闸时完全一致, 用户往上拖才长高。
//
// v0.6.1 修复(用户报:「ui 上没有控制高度的参数呢。不是新增了参数控制吗, 都没看到」):
//   【我的设计错】v0.4.1 的「高度」和 v0.6.0 的「边缘高度%」都只做成了【图层效果控件】里的
//   滑块(分别在「山峰点 n」和「山峰 控制」上), 面板上一个入口都没有 ——
//   用户看的是面板, 当然什么都看不到。
//   修法: 两个参数都进面板「高度」区第二行, 且【改完立即生效】:
//     点位高度: [__]   边缘高度%: [__]
//     - 点位高度 onChange → pushPointHeight() 推给所有已有点位(0 = 自动)
//     - 边缘高度% onChange → pushEdgeToController() 写控制器;
//       老工程没有该滑块时【顺手补建】(addSlider), 于是不必重新生成也能用
//   同时: 生成时用面板值初始化(点位的「高度」滑块、控制器的「边缘高度%」);
//        「重设点位」也会把面板的点位高度一并推下去; 两者都进预设(键 ph / edge)。
//
// v0.6.0 新增可调参数: 控制器「边缘高度%」(用户要求"做成一个可控制的参数")
//   把 v0.4.1 写死的 FALL_EDGE = 0.65 换成滑块, 并改用【标准窗口族】的构造方式:
//       w(x) = e + (1 − e) × falloff(x, 曲线类型)      e = 边缘高度% / 100
//   依据: 这就是 Hamming 窗的一般化 —— Hamming 定义为 0.54 − 0.46cos
//         = 0.08 + 0.92 × Hann, 即"常数底 + 原曲线的缩放版"。
//   语义(直接可操作): e = 【窗口最边缘那根柱子保留峰高的百分比】
//     100% → w ≡ 1        = 矩形窗(Boxcar): 窗口内每一根都满高, 边缘硬切, 根数最准
//       0% → w = falloff  = 纯 von Hann: 山形最柔, 但边缘归零 ⇒ 边缘看不见
//      30% → 边缘保留 30% 的可用高度   (v0.9.0 起默认改为 10%)
//   ⚠️ 这是【此消彼长】: 边缘调高 → 根数准但边缘硬; 调低 → 山形柔但边缘矮。
//      Harris 1978 讲的就是这个权衡, 不存在"同时最优"。
//   ⚠️ 滑块是【生成时】写进控制器的 —— 已有工程要重新点「生成 / 重建」才有这个滑块。
//      表达式对该滑块缺失做了 try/catch 回退(取默认 10%), 所以旧工程不会报错。
//
// v0.5.0 算法升级(用户要求"检索网络, 有别的算法吗")—— 全部以检索到的权威定义为准:
//
//   检索结论一: 我们原来的曲线 = 窗函数里的 **von Hann(升余弦)**。
//     - MathWorks tukeywin 文档: "The Tukey window is a rectangular window with the first
//       and last r/2 percent of the samples equal to parts of a cosine. … If you specify
//       r ≥ 1, an L-point **von Hann window** is returned."
//     - SciPy signal.windows.tukey 文档: alpha = "the fraction of the window inside the
//       cosine tapered region. If zero → **rectangular window**. If one → **Hann window**."
//       (引 Harris, F.J. 1978, "On the use of Windows for Harmonic Analysis with the DFT",
//        Proc. IEEE 66(1):51-83 —— 窗函数领域的经典文献)
//     ⇒ Hann 的两端【恰好归零】, 所以窗口边缘的柱子必然看不见。这不是参数没调好, 是选错了窗。
//     ⇒ 全部平滑窗(Hann / Hamming / Blackman / Tukey / Epanechnikov / tricube)两端都趋近 0;
//       Hamming 两端是 0.08(不是 0), 但 8% 峰高通常仍在基础高度之下。这是数学性质, 无解。
//       所以"想让窗口内每一根都明显抬起", 只能把整条曲线【整体抬起来】——
//       标准做法就是 Hamming 的构造(Hamming = 0.08 + 0.92 × Hann)。
//       v0.6.0 起把它做成可调参数「边缘高度%」(控制器滑块), 见下方窗口形状一节。
//
//   检索结论二(更关键): 半径公式用 (m+1)/2 × 柱距 是"半个柱距"的【估算】, 所以根数必然
//     在 m / m+1 之间漂。正规做法是取【第 m 近那根柱子的实际距离】—— 即 kNN / 自适应带宽核
//     (kernel density estimation 里的 k-nearest-neighbour bandwidth)。
//     把各柱到点位的距离(单位=柱距)排开依次是 Δ, 1-Δ, 1+Δ, 2-Δ, 2+Δ, …
//       m 奇 → 第 m 项 = (m-1)/2 + Δ ;  m 偶 → 第 m 项 = m/2 - Δ
//     判定改成【≤】(非严格)后, "填 m"就【恰好】影响 m 根。
//     ⚠️ 半径末尾必须乘 (1 + 1e-9): k×柱距 常算出 150.49999999999997 而边界柱恰在 150.5,
//        不放大就漏掉"第 m 近"那根(实测: 填 9 只得到 8 根)。
//     ⇒ 实测(40 根 + 2 点位 + 基础高度 40px): 填 1..21 每一档都恰好得到相同根数, 且全部可见。
//
//   唯一退化(几何事实, 无法用公式消除): 点位正好落在两根正中(Δ=0.5)且 m 为奇数时,
//     两侧等距、无法二选一 → 会得到 m+1 根。
//
// v0.4.1 修复(用户报「1 个点 还是无法控制」+「填 9 根却最多影响 7 个」+「要拉的很远」):
//   先【实测】再动手。结论: 机制没坏, 差在"窗口内"≠"看得见"。
//   实测(N=40 偶数根 / 影响范围 9 / 峰高 238px / 基础高度 40px / 余弦):
//     窗口内有贡献 10 根, 视觉上真的抬起 8 根 → 用户报 7(其峰高与基础高度略有不同)。
//   根因: 贡献 = 峰高 × 衰减(t); 尾部衰减到 基础高度/峰高 以下就被钳平。
//     余弦曲线只有 t < 0.73(≈半径的 73%)那段视觉有效 —— 所以"要拉的很远才够"。
//   ① 【新增每个点位的「高度」滑块】= 该点峰高绝对值(px, 基线以上)。
//      0 = 自动(沿用"基线 − 点位Y", 向后兼容, 拖点仍生效); >0 直接覆盖峰高。
//      抬高峰高 = 尾部整体越过基础高度 = 窗口内根数全部显形 ——
//      同时解决"只看见 7 根"和"要拉很远", 也正是用户点名要的那个控制。
//   ② 【状态栏回报"实际可见 N 根"】—— 把"填 9 却看见 7"从黑箱变成可读数字,
//      用户照着调「影响范围」/「高度」/「基础高度」即可。配套纯函数 countVisibleBars()。
//   ③ 【回退上一版改错的方向】v0.4.0 我把半径从 (m+1)/2×柱距 改成 m/2×柱距,
//      想让"有贡献的根数 ≤ m"; 但那样窗口反而【装不下第 m 根】, 实测视觉可见
//      从 8 根掉到 6 根 —— 与用户"要更多"的需求正好相反。已改回 (m+1)/2×柱距。
//   ④ 半径负数/零一律钳到 1 根(v0.4.0 的写法会让"填 0 或负数"彻底失效)。
//
// v0.4.0 自审修正(逐条以官方文档 / 仓库真机验证过的做法为依据, 不靠推测):
//   ① 【纠正】导出/导入对话框的起始目录 —— File.saveDialog 官方签名只有两个参数、
//      没有目录参数, 我上一版传的第 3 参属未文档化、不可依赖。改为用 File【实例方法】
//      saveDlg()/openDlg() —— 文档原文 "presets the current folder to this File object's
//      parent folder"。导出与导入都能默认到工程目录(上一版说"导入绕不过去"也是错的)。
//   ② 【纠正】pinW 读回 preferredSize.height 再写回 —— 控件未首次布局时该值不可靠,
//      会把高度一起钉成 0。官方文档: "A preferredSize of -1 causes the size to be
//      calculated automatically"。另据 Adobe 官方社区(Marc Autret 采纳答案):
//      preferredSize 首次布局后丢失, 真正持久的是 minimumSize/maximumSize。
//   ③ randomPeaks 用 Math.random() 生成要 setValue 的值 —— 官方文档明确应改用
//      generateRandomNumber()(旧版 AE 多线程下可能返回重复值)。
//   ④ 【真 bug】切换工程时上一工程的预设槽残留在内存 → 换到没有预设文件的工程会
//      整段跳过装载, 「使用」按钮仍亮且给出别的工程的预设。修法: resetSlots() 先清空。
//   ⑤ 【真 bug】「重设点位」按面板「数量」算行宽, 与实际柱数不符 → 点位与柱子错位。
//   ⑥ 【真 bug】randomPeaks 用面板「基线%」算基线, 而实际基线是形状图层的 Y。
//      新增纯函数 pickBaseY(): 图层实际位置优先, 取不到才回退面板值。
//   ⑦ importSlots 写盘失败仍报成功; ⑧ rewriteBarExpr 逐组取属性无保护(一坏组整轮崩)。
//
// v0.3.4 修复(用户报 3 条):
//   ① 「影响范围=9 却不止 9 根」+「一个点数还是无法控制」= 同一个根因:
//      我此前把单位定成【每侧几根】(9 → 左右各 9 根 = 19 根), 而用户口径是【总共几根】。
//      现改为总根数: 有效半径 = (总根数 + 1) / 2 × 柱距。
//      autoInfluenceBars 也改为返回总根数, 并封顶到 N(单点 = 一整座两端回落的山丘)。
//   ② 「预设要能在下次打开工程时自动读取」—— 面板实例在 AE 内常驻, 而打开工程发生在
//      面板创建【之后】(AE 启动那一刻可能还没有工程), 初始化只读一次根本读不到。
//      现改用 app.scheduleTask 常驻低频轮询(1.5s)比对"工程预设文件路径 + 是否存在",
//      一变就重读; 点「使用」前也更比对一次。
//   ③ 「导出对话框默认工程所在文件夹」—— saveDialog 第 3 参传【完整路径】
//      (工程目录下的预设文件), 系统对话框会以它所在目录作为起始目录。
//
// v0.3.3 修复(用户报: 点数改成 1 时"控制点没效果", 而点数=2 有效果):
//   两个真因, 都由「点数=1」这个特例同时触发:
//   ① 自动影响范围没封顶 —— 点数=1 时算出 49 格(半径 1700px), 而半行宽只有 675px,
//      整行都落在半径内、全被抬到接近峰高 => 看成"点位没作用"。M=2 时算 32 格,
//      两点叠加有起伏所以看得出效果。修法: autoInfluenceBars 封顶到 N/2,
//      封顶后半行两端恰好回落到基线附近, 才是正常的山丘轮廓。
//   ② 面板的「影响范围」只给【新建】点位设初值 —— 点数=1 时没有新点被建,
//      所以怎么改都没反应; 点数=2 时新建了点 2, 拿到了新值, 于是"有效果"。
//      修法: 把该按钮改名为「重设点位」, 并把面板的影响范围统一推给【所有已有点位】,
//      同时把 X 按新点数重新均分(否则点数变了老点位还留在旧的等分位置)。
//
// v0.3.2 修复:
//   - 点「使用」回填预设时, 面板会"弹宽"。根因是 ScriptUI 的自动宽度:
//     edittext / 多行 statictext 一旦赋 .text, 首选宽度会【跟着内容重算】,
//     characters 只给初值压不住; 再叠加 setStatus 里的 layout.resize(),
//     面板就按新的首选宽度撑开了。
//     修法: ① 数字输入框统一走 numBox() —— 建控件时把宽度钉到
//     preferredSize / minimumSize / maximumSize 三处(内容再长只在框内滚动);
//     ② 多行 statictext(提示 / 状态栏)同样钉宽, 让它换行而不是撑宽;
//     ③ setStatus 不再调 layout.resize(); ④ 导出提示不再打印完整路径。
//     注: 仓库里 NumCounter / 虚线网格都保留 layout.resize(), 本插件因为
//     "回填预设" 会成批改文本才暴露该问题, 故单独去掉。
//
// v0.3.1 修正:
//   - 「影响范围」与「点数」恢复同一行(此前为放长标签而拆成两行, 与仓库面板的
//     紧凑排版不符)。标签缩短为「影响范围(根):」, 单位说明仍在下方的提示里。
//
// v0.3.0 变更(单位语义, 破坏性):
//   - 「影响范围」从【像素半径】改为【每侧影响几根竖条】。
//     判定式: 有效半径 = (根数 + 1) × 柱距 × 倍率/100, 柱距 = 矩形宽 + 间距
//     (+1 是"严格小于"判定的补偿: 半径 (k+1)×柱距 ⇒ |j| ≤ k ⇒ 每侧正好 k 根有值)
//     好处: 改「矩形宽 / 间距」时山丘覆盖的根数【不变】, 波形不被排列参数带跑。
//     ⚠️ 预设文件随之升到 version 2; 读到 v1 的槽位会把 r 重置为"自动"(量纲不通)。
//
// v0.2.1 修正:
//   - 预设面板排版改为【对齐仓库既有做法】(AE-Lyrics-Animator / QuickKey 两处
//     排版完全一致): 槽位就是四个数字按钮, 两行搞定, 不是四行"槽N 存储/使用"——
//         存储 [1][2][3][4] [清除全部]
//         使用 [1][2][3][4] [复位]
//         [导出配置] [导入配置]
//     同时补上之前漏掉的「复位」按钮(仓库两个面板都有)。
//
// v0.2.0 新增:
//   - 预设槽(4 固定槽位) + 导出/导入, 对齐仓库既有「预设槽」实践(NumCounter /
//     QuickKey / AE-Lyrics-Animator): 存于【工程所在目录】的
//     MountainSpectrum.presets.json(跟随工程走, 避开会崩的 app.settings);
//     ⚠️ 槽位 key 全程 1-based("1".."4"); ES3 无 JSON -> 手写序列化 +
//     "首字符判定 + 受控 eval" 解析(NumCounter v0.2.9 的索引错位坑已规避)。
//   - 面板初值与预设默认值收敛到单一 DEFAULTS 表, 避免两处漂移。
//   - 顺带修一个潜伏 bug: clamp(parseFloat(空框)) 返回 lo 而不是默认值,
//     导致清空输入框时「矩形宽」变成 1 而不是 24(原 if(isNaN) 那行永不执行)。
//
// v0.1.2 修复:
//   - 「拖动形状图层无法移动整行」。根因: 矩形位置表达式把控制器合成坐标
//     减掉图层自身坐标, 图层位置被完全抵消 —— 矩形在合成坐标里纹丝不动。
//     改为【形状图层自己就是锚点】: 位置表达式只输出与图层位置无关的
//     偏移量, 图层 position = 行中心 X / 基线 Y, 拖动即移动整行。
//     副作用(有意为之): 点位是合成坐标(世界坐标), 行从点位下面"滑过",
//     所以横向移动整行时峰形会跟着变; 要整块搬走, 请把「山峰 柱」和
//     所有「山峰点」一起选中再拖。
//
// v0.1.1 新增:
//   - 控制器加「影响范围倍率%」滑块(默认 100) —— 一个滑块就能实时
//     缩放所有山丘的宽度, 还能打关键帧让整片山丘一起"呼吸";
//     每个点自己的「影响范围」作为基数与之相乘(低频宽/高频窄的
//     波谱感仍可逐点微调)。缺该滑块时表达式回退为 100%。
//
// v0.1.0 首发:
//   - 等距矩形阵列(数量/宽/间距/自动铺满合成宽度)
//   - 余弦/高斯/线性/二次 四种起伏曲线
//   - 叠加(求和) / 取最高 两种多点合成方式
//   - 点位可增删(重设点数)、可一键随机波峰
//   - 基础高度 = 山丘之外所有矩形的平坦高度
//
// 安装: 免安装, 由仓库 install.py 部署到
//   %APPDATA%\Adobe\After Effects\26.0\Scripts\ScriptUI Panels\
// ============================================================

(function (thisObj) {

    // ============================================================
    // 命名常量(表达式按这些名字找图层/效果, 改名会导致表达式失效)
    // ============================================================
    var LAYER_BARS = "山峰 柱";
    var LAYER_CTRL = "山峰 控制";
    var PT_PREFIX  = "山峰点 ";
    // 总闸「山峰 高度」: 一个普通的空对象, 它离基线多高, 整排最高柱就多高。
    //   存在的意义 = 让高度也能【靠拖点】控制(和峰的位置一样直观), 而不是只能填数字。
    //   拖它 = 整座山等比长高/变矮, 形状不变; 各点位之间的高矮差别仍然保留。
    var LAYER_HGT  = "山峰 高度";
    var HGT_DEF_RATIO = 0.22;   // 默认最高高度 = 合成高 × 22%(与点位默认峰高一致)
    var GROUP_PREFIX = "柱 ";
    var RECT_NAME  = "矩形路径 1";

    var SL_W     = "矩形宽";
    var SL_G     = "间距";
    var SL_BASE  = "基础高度";
    var SL_MODE  = "叠加方式";   // 0=叠加(求和) 1=取最高
    var SL_FTYPE = "起伏曲线";   // 0=余弦 1=高斯 2=线性 3=二次
    var SL_R     = "影响范围";
    var SL_H     = "高度";       // 每个点位的峰高(px, 基线以上); 0 = 自动(跟随点位 Y)
    // ---------- 左右边缘控制点(v0.8.0) ----------
    // 每个点位配两个空对象「山峰点 k 左」「山峰点 k 右」, 拖它们的 X 定山丘左右边界。
    //   左半径 = 峰X − 左边缘X;  右半径 = 右边缘X − 峰X  ⇒ 两边可以不对称
    //   (左边缓右边陡 = 音频里的 attack/decay 不同, 反之亦然)。
    // 命名复用 PT_PREFIX 前缀是【安全的】: countPoints 用
    //   parseInt(nm.substring(PT_PREFIX.length)) 取编号, 而 parseInt("1 左") === 1
    //   (遇非数字即停), 所以边缘点不会被误数成峰; findLayer 是精确匹配, 也不会误命中。
    //   cleanup 用 indexOf(PT_PREFIX) === 0 判断删除, 于是边缘点会自动跟着被清理。
    var PT_L_SUFFIX = " 左";
    var PT_R_SUFFIX = " 右";
    var SL_EC     = "边缘控制";   // 0 = 用「影响范围」的对称半径; 1 = 用左右边缘点(默认)
    var EC_DEF    = 1;
    var SL_RSCALE = "影响范围倍率%";   // 控制器上的全局倍率(默认 100 = 不缩放)
    var RSCALE_DEF = 100;             // 缺该滑块时的回退值
    var H_DEF      = 0;               // 「高度」缺该滑块时的回退值 = 0(自动, 向后兼容)
    var SL_COLOR = "矩形颜色";   // 图层上的 Color Control, 统一驱动所有组内填充

    var FILL_COLOR = [1, 0.573, 0.573, 1];   // #FF9292 (4D RGBA, 必须 4 个分量)
    var MAX_BARS   = 400;
    var MAX_POINTS = 60;

    // 表达式收尾变量名(AE 取最后一句的值, node 测试靠这个名字补 return)
    var OUT_SIZE = "outSize";
    var OUT_POS  = "outPos";

    // 高斯曲线归一化常数: g(t) = (exp(-4.5t^2) - LO) / SPAN, 使 g(0)=1, g(1)=0
    var GAUSS_LO   = Math.exp(-4.5);
    var GAUSS_SPAN = 1 - GAUSS_LO;

    // ============================================================
    // 纯逻辑层(node 可测, 必须进 test_MountainSpectrum.js)
    // ============================================================

    function clampNum(v, lo, hi) {
        if (isNaN(v)) return lo;
        if (v < lo) return lo;
        if (v > hi) return hi;
        return v;
    }

    function clampInt(v, lo, hi) {
        if (isNaN(v)) return lo;
        v = Math.round(v);
        if (v < lo) return lo;
        if (v > hi) return hi;
        return v;
    }

    // 基线 Y 取值优先级: 【形状图层的实际 Y】 > 面板的「基线 %合成高」。
    // 为什么以图层实际位置为准: 生成时基线 = 合成高 × 基线比, 但用户随时可以拖动
    //   「山峰 柱」图层改基线 —— 此时面板值已过时, 用它会让点位跳到错误高度。
    // barsY 传 null / NaN 表示拿不到图层(尚未生成, 或图层被删/改名), 才回退面板值。
    function pickBaseY(barsY, compH, panelRatioPct) {
        if (typeof barsY === "number" && !isNaN(barsY)) { return barsY; }
        return compH * (clampNum(panelRatioPct, 1, 99) / 100);
    }

    // 起伏曲线: t = 距离 / 影响范围 (t=0 在点上 → 1, t>=1 无影响 → 0)
    function falloff(t, type) {
        if (t >= 1) return 0;
        if (t <= 0) return 1;
        if (type === 1) { return (Math.exp(-4.5 * t * t) - GAUSS_LO) / GAUSS_SPAN; }
        if (type === 2) { return 1 - t; }
        if (type === 3) { var u = 1 - t; return u * u; }
        return 0.5 * (1 + Math.cos(Math.PI * t));
    }

    // 第 i 根柱子(0-based)相对行中心的水平偏移; 整体居中
    function barOffsetX(i, N, W, G) {
        return (i - (N - 1) / 2) * (W + G);
    }

    // 整行总宽
    function rowWidth(N, W, G) {
        return N * W + (N - 1) * G;
    }

    // 自动铺满: 合成宽度内(两侧各留 margin)最多能放几根
    function autoCount(compW, W, G, margin) {
        if (W <= 0) return 1;
        var avail = compW - 2 * margin;
        var n = Math.floor((avail + G) / (W + G));
        if (n < 1) n = 1;
        if (n > MAX_BARS) n = MAX_BARS;
        return n;
    }

    // ---------- 窗口形状: 「边缘高度%」 ----------
    //
    // 背景(检索确认): 我们的起伏曲线 = 窗函数里的 **von Hann(升余弦)**。
    //   MathWorks tukeywin: "r ≥ 1 → an L-point von Hann window"(Tukey 的 α=1 极端)
    //   SciPy signal.windows.tukey: alpha "If one → Hann window"(引 Harris 1978)
    //   Hann 的两端【恰好为 0】 ⇒ 窗口边缘的柱子必然看不见。而所有平滑窗
    //   (Hann / Hamming / Blackman / Tukey / Epanechnikov / tricube)两端都趋近 0,
    //   Hamming 两端是 0.08 但通常仍在基础高度之下。这是窗函数的数学性质, 无解。
    //
    //   ⇒ 想让窗口内每一根都显形, 只能把整条曲线【整体抬起来】, 让边缘不再是 0。
    //     标准做法就是 Hamming 的构造: Hamming = 0.08 + 0.92 × Hann
    //     (即 0.54 − 0.46cos: 把一个常数底 + 原曲线的缩放版相加)。本插件把它一般化:
    //
    //        w(x) = e + (1 − e) × falloff(x, 曲线类型)        x = 距离 / 半径
    //
    //     e = 「边缘高度%」/100, 含义就是【窗口最边缘那根柱子保留峰高的百分之几】:
    //        e = 100% → w ≡ 1        = 矩形窗(Boxcar): 窗口内每一根都满高, 边缘硬切
    //        e = 0%   → w = falloff  = 纯 von Hann: 平滑山丘, 但边缘归零(看不见)
    //        e = 30%  → 边缘保留 30% 的可用高度   (v0.9.0 起默认值改为 10%)
    //
    //   ⚠️ 这是一条【此消彼长】的曲线, 不是"调好就能同时满足":
    //      边缘高度调高 → 根数更准、边缘更硬; 调低 → 山形更柔、边缘更矮。
    //      Harris 1978 讲的就是这个权衡。想让边缘柔且仍然可见, 只能靠抬高「基础高度」
    //      之外的「高度」滑块(把整座山抬高, 让尾巴也越过基础高度)。
    var SL_EDGE = "边缘高度%";
    // v0.9.0: 默认从 30% 降到 10%。新公式下 e 的含义变成"【地板之上可用高度】的比例" ——
    //   10% 已足够让窗口边缘明显高过地板(地板 40 / 峰高 238 时, 边缘比地板高约 20px),
    //   同时范围边界那道台阶也只有约 10% 可用高度, 不会突兀。仍可手动调。
    var EDGE_DEF = 10;
    function edgeKeepOf(pct) {
        if (typeof pct !== "number" || isNaN(pct)) { return EDGE_DEF / 100; }
        if (pct > 100) { pct = 100; }
        if (pct < 0) { pct = 0; }
        return pct / 100;
    }

    // 单个点位对某根柱子的高度贡献(半径已是【像素】; 单位换算见 influenceRadiusPx)
    // hExplicit > 0 时用【该点位「高度」滑块的绝对峰高】, 否则用"基线 − 点位Y"推算。
    //   为什么要这个: 山丘尾部衰减到 基础高度/峰高 以下就被钳平, 看着像"没影响到" ——
    //   抬高峰高能把整个窗口内的柱子都顶出基础高度。
    // edgeKeep = 「边缘高度%」折算的 0..1 系数(见上)。
    function pointContribution(bx, px, py, baseY, rPx, type, hExplicit, edgeKeep, rLeftPx, baseH) {
        var peak = baseY - py;                    // 点在基线以上 → 正 (AE 的 y 向下)
        if (hExplicit > 0) { peak = hExplicit; }
        if (peak <= 0) return 0;
        // 左右不对称: 柱子落在峰的【左侧】时用左半径。
        //   未给 rLeftPx -> 两侧同用 rPx, 即完全对称(向后兼容)。
        var rUse = rPx;
        if (typeof rLeftPx === "number" && bx < px) { rUse = rLeftPx; }
        if (rUse <= 0) return 0;
        var t = Math.abs(bx - px) / rUse;
        if (t > 1) return 0;                      // 窗口外: 归零(kNN 半径下判定为【≤】)
        var e = edgeKeepOf(edgeKeep);
        // v0.9.0: 衰减作用在【基础高度之上】的区间 —— 返回"超出地板多少"而非绝对高度。
        //   于是窗口内每一根都保证高过基础高度(只要 e > 0), 不必再把峰高抬到
        //   基础高度的 1/e 倍以上才能看见边缘(旧公式下默认 30% 时要 3.33 倍)。
        //   baseH 未给或为 0 -> effH = peak, 与旧行为逐点相同(旧调用零改动)。
        var effH = peak;
        if (typeof baseH === "number" && baseH > 0) {
            effH = peak - baseH;
            if (effH <= 0) return 0;              // 峰顶还没地板高 -> 这个点不起作用
        }
        return effH * (e + (1 - e) * falloff(t, type));
    }

    // 点位相对"柱网"的相位: 0 = 正好落在某根柱子上; 0.5 = 正好落在两根正中。
    // rowLeftX = 整行最左那根柱子的合成 X。
    function barPhase(px, rowLeftX, pitch) {
        if (pitch <= 0) { return 0; }
        var ic = (px - rowLeftX) / pitch;      // 点位的"柱坐标"(小数)
        var frac = ic - Math.floor(ic);
        if (frac > 0.5) { frac = 1 - frac; }
        return frac;                            // ∈ [0, 0.5]
    }

    // 影响范围: 点位滑块的值 = 【影响几根竖条】, 这里换算成像素半径。
    //
    // ⭐ 半径取【第 m 近那根柱子的实际距离】× 柱距(kNN 半径), 而不是"半个柱距"的估算。
    //   依据: 把各柱到点位的距离(单位=柱距)从小到大排, 依次是
    //         Δ, 1-Δ, 1+Δ, 2-Δ, 2+Δ, 3-Δ, …   (Δ = barPhase, ∈[0, 0.5])
    //     奇数位(m=2k-1) 的第 m 项 = (k-1)+Δ = (m-1)/2 + Δ
    //     偶数位(m=2k)   的第 m 项 = k-Δ     = m/2 - Δ
    //   判定用【≤】(非严格), 于是"填 m"就【恰好】影响 m 根, 不再随行根数的奇偶
    //   在 m / m+1 之间漂(v0.4.1 之前用 (m+1)/2×柱距 就是这个毛病)。
    //   唯一退化: 点位正好落在两根正中(Δ=0.5)且 m 为奇数 —— 两侧等距无法二选一,
    //   会得到 m+1 根。这是几何事实, 无法用公式消除。
    //
    // m<1 钳到 1(至少正下方那根); 倍率% 在此基础上线性缩放半径。
    function influenceRadiusPx(rTotal, pitch, rscalePct, delta) {
        if (typeof rscalePct !== "number") { rscalePct = RSCALE_DEF; }
        if (rTotal < 1) { rTotal = 1; }
        if (typeof delta !== "number" || isNaN(delta)) { delta = 0.5; }
        if (delta > 0.5) { delta = 0.5; }
        if (delta < 0) { delta = 0; }
        var k;
        if (rTotal % 2 === 1) { k = (rTotal - 1) / 2 + delta; }
        else { k = rTotal / 2 - delta; }
        if (k < 0.5) { k = 0.5; }       // 下限: 至少覆盖正下方那根
        // ⚠️ 末尾的 (1 + 1e-9) 是抗浮点误差的必需项:
        //    k×柱距 常算出 150.49999999999997, 而边界柱恰好落在 150.5 ——
        //    不放大一点, 判定 |d| ≤ R 会把"第 m 近"那根本该算进来的柱子挤掉
        //    (实测: 填 9 只得到 8 根)。放大 1e-9 不会影响任何实际像素位置。
        return k * pitch * rscalePct / 100 * (1 + 1e-9);
    }

    // 单个点位的「固有峰高」= 「高度」滑块 > 0 ? 该值 : (基线Y − 点位Y)。
    //   点落在基线下方且没填高度 -> 0(该点无峰)。
    function intrinsicPeak(p, baseY) {
        var h = (p && typeof p.h === "number") ? p.h : 0;
        if (h > 0) { return h; }
        var pk = baseY - p.y;
        return (pk > 0) ? pk : 0;
    }

    // 总闸: 把各点位【等比缩放】到「最高那根恰好 = hMax」的缩放系数。
    //   hMax 是数字  -> 启用总闸(0 会让整排压平到基础高度, 这是合法结果);
    //   hMax 非数字  -> 未启用(null/undefined/NaN), 返回 1, 即完全保持原行为。
    // ⚠️ "返回 0" 和 "未启用" 是两件事, 不能混 —— 前者是用户把总闸拖到基线了。
    function peakScaleOf(points, baseY, hMax) {
        if (typeof hMax !== "number" || isNaN(hMax)) { return 1; }
        var mx = 0, i, pk;
        for (i = 0; i < points.length; i++) {
            pk = intrinsicPeak(points[i], baseY);
            if (pk > mx) { mx = pk; }
        }
        if (mx <= 0) { return 1; }        // 一个有效峰都没有 -> 缩放无意义
        if (hMax < 0) { hMax = 0; }
        return hMax / mx;
    }

    // 把「根数」单位的点位列表解析成「像素半径」点位列表。
    // rowLeftX 给了就用该点的【真实相位】算 kNN 半径(精确 m 根);
    //   没给则退化为 Δ=0.5(最保守: 假设点位落在两根正中)。
    //
    // baseY + hMax 一起给 = 启用【总闸】(见 peakScaleOf)。
    // 总闸的落地方式: 把「归一化后的绝对峰高」编码进返回项的 y(= baseY − 峰高),
    //   同时把 h 置为 -1(自动)。这样 pointContribution 走它原有的"自动"分支就能
    //   算出归一化后的峰高 —— 于是【不必改动它的判据】, 也就不会把"「高度」滑块填 0
    //   = 自动"这条既有契约撕成两半(h=0 变成"峰高 0"), 几十条既有断言零改动。
    // 峰高归一化成 0 时 y 恰好 = baseY, 对应"点在基线上 -> 无贡献", 也自然成立。
    function resolvePoints(points, pitch, rscalePct, rowLeftX, baseY, hMax) {
        var gate = (typeof hMax === "number" && !isNaN(hMax));
        var s = gate ? peakScaleOf(points, baseY, hMax) : 1;
        var out = [], k, d, rSym, rl, rr, py, hh;
        for (k = 0; k < points.length; k++) {
            d = (typeof rowLeftX === "number")
                ? barPhase(points[k].x, rowLeftX, pitch) : 0.5;
            rSym = influenceRadiusPx(points[k].r, pitch, rscalePct, d);
            // 左右半径: 给了边缘点(xl/xr)就用它, 否则两侧都用「影响范围」换算的对称半径。
            //   边缘点被拖到峰的【另一侧】-> 该侧半径为负 -> 钳到 0, 即"关掉这一侧"。
            rl = (typeof points[k].xl === "number") ? (points[k].x - points[k].xl) : rSym;
            rr = (typeof points[k].xr === "number") ? (points[k].xr - points[k].x) : rSym;
            if (rl < 0) { rl = 0; }
            if (rr < 0) { rr = 0; }
            py = gate ? (baseY - intrinsicPeak(points[k], baseY) * s) : points[k].y;
            hh = gate ? -1 : points[k].h;
            out.push({ x: points[k].x, y: py, h: hh, r: rr, rl: rl });
        }
        return out;
    }

    // 多点合成: mode 0=叠加(求和) 1=取最高; 最后钳到基础高度
    // vals = 各点【超出基础高度】的贡献量(见 pointContribution)。
    //   v0.9.0 起返回 = 基础高度 + 合成量, 而不再是 max(合成量, 基础高度) ——
    //   因为 vals 已经是"超出量", 地板从"钳制上限"变成"加法基线"。
    //   合成量恒 ≥ 0, 所以结果恒 ≥ 基础高度(地板语义保留)。
    function combineHeights(vals, mode, baseH) {
        var h = 0, i, v;
        if (mode === 1) {
            for (i = 0; i < vals.length; i++) {
                v = vals[i];
                if (v > h) h = v;
            }
        } else {
            for (i = 0; i < vals.length; i++) { h += vals[i]; }
        }
        var b = (typeof baseH === "number" && baseH > 0) ? baseH : 0;
        return b + h;
    }

    // 某水平位置的柱子高度(points 里的 r 为【像素】半径)
    function barHeightAt(bx, points, baseY, mode, baseH, type, edgeKeep) {
        var vals = [], k, p;
        for (k = 0; k < points.length; k++) {
            p = points[k];
            vals.push(pointContribution(bx, p.x, p.y, baseY, p.r, type, p.h, edgeKeep, p.rl, baseH));
        }
        return combineHeights(vals, mode, baseH);
    }

    // 第 i 根柱子的高度(与表达式同参数, 供测试比对)
    // rowX/rowY = 【形状图层自身】在合成里的位置(行中心 X / 基线 Y)
    // points 里的 r = 【每侧根数】, 内部换算成像素半径
    function barHeightOfIndex(i, N, W, G, rowX, rowY, points, mode, baseH, type, rscalePct, edgeKeep, hMax) {
        var bx = rowX + barOffsetX(i, N, W, G);
        var rowLeftX = rowX - (N - 1) / 2 * (W + G);
        return barHeightAt(bx, resolvePoints(points, W + G, rscalePct, rowLeftX, rowY, hMax),
                           rowY, mode, baseH, type, edgeKeep);
    }

    // 【视觉上真的抬起】的柱子数 —— 这才是用户口径的"影响了几根"。
    //
    // 与"窗口内有贡献的根数"不是一回事: 贡献小于基础高度时柱子被钳在基础高度上,
    //   看着根本没变。以默认值实测(峰高 238px / 基础高度 40px / 余弦曲线),
    //   「影响范围 9」在 40 根(偶数)的行上是【10 根有贡献、8 根看得见】——
    //   用户报"填 9 却只影响 7~8 根"就是这个差额。
    // 用途: 状态栏回报真实数字, 让用户照着调「影响范围」/「高度」/「基础高度」,
    //   而不是猜。baseH 传 0 得到的是"有贡献的根数"。
    //
    // ⚠️ 单位契约(容易搞错): points[].r 是【根数】, 内部自己换算成像素 ——
    //    与 barHeightAt(bx, points, ...) 不一样, 后者收的 points[].r 是【像素】。
    //    (barHeightOfIndex 也收根数; barHeightAt 收像素。)
    // 返回"视觉上真的抬起来了"的根数(柱高 > 基础高度 + 极小的容差)。
    // ⚠️ v0.9.0 起必须把 baseH 【真实传下去】(旧版传 0 再自己判定, 是在躲
    //    combineHeights 的 max 钳制)。新公式下 pointContribution 要用 baseH 算
    //    effH = 峰高 − 基础高度, 传 0 会让它退化成"从零起算", 边缘就又被判成不可见了。
    function countVisibleBars(N, W, G, rowX, rowY, points, mode, baseH, type, rscalePct, edgeKeep, hMax) {
        var c = 0, i, h;
        for (i = 0; i < N; i++) {
            h = barHeightOfIndex(i, N, W, G, rowX, rowY, points, mode, baseH, type, rscalePct, edgeKeep, hMax);
            if (h > baseH + 1e-6) { c = c + 1; }
        }
        return c;
    }

    // 自动影响范围(【总根数】): 让每个点的山丘大约覆盖 2.5 个「点位间距」,
    // 再封顶到整行根数 N。封顶是必要的 —— 否则点数很少时(尤其 M=1)算出的半径
    // 远超半行宽, 整行都落在半径内、全被抬到接近峰高, 看起来"点位/影响范围没作用"。
    // 封顶到 N 后, 单点正好是一整座"两端回落到基线"的山丘。
    function autoInfluenceBars(N, W, G, M) {
        var pitch = W + G;
        if (pitch <= 0 || M < 1) { return 1; }
        var total = rowWidth(N, W, G) / (M + 1) * 2.5 / pitch * 2 - 1;
        var cap = N;
        if (cap < 1) { cap = 1; }
        if (total > cap) { total = cap; }
        if (total < 1) { total = 1; }
        return Math.round(total);
    }

    // ---------- 表达式构建层 ----------
    // 表达式内核: 与 barHeightOfIndex 同逻辑(改一处必须同步改另一处, 测试守护)
    //
    // ⚠️ 表达式引擎只吃「最保守语法」(仓库既有真机坑, 见 Water-Rise/AGENTS.md
    //    与 NumCounter 已验证写法): 一次只声明一个变量、不用 += / 不用 ++、
    //    不用 continue、不用 IIFE; 靠最后一句裸变量返回。
    function buildExprCore(i, N, M) {
        var L = [];
        L.push("var c = thisComp.layer(\"" + LAYER_CTRL + "\");");
        L.push("var W = c.effect(\"" + SL_W + "\")(1);");
        L.push("var G = c.effect(\"" + SL_G + "\")(1);");
        L.push("var baseH = c.effect(\"" + SL_BASE + "\")(1);");
        L.push("var mode = c.effect(\"" + SL_MODE + "\")(1);");
        L.push("var ftype = c.effect(\"" + SL_FTYPE + "\")(1);");
        L.push("var rsc = " + RSCALE_DEF + ";");
        L.push("try { rsc = c.effect(\"" + SL_RSCALE + "\")(1); } catch (e3) { rsc = " + RSCALE_DEF + "; }");
        L.push("var edge = " + EDGE_DEF + ";");
        L.push("try { edge = c.effect(\"" + SL_EDGE + "\")(1); } catch (e5) { edge = " + EDGE_DEF + "; }");
        L.push("if (edge > 100) { edge = 100; }");
        L.push("if (edge < 0) { edge = 0; }");
        L.push("edge = edge / 100;");
        L.push("var i = " + i + ";");
        L.push("var N = " + N + ";");
        L.push("var M = " + M + ";");
        L.push("var pitch = W + G;");
        L.push("var rowLeftX = transform.position[0] - (N - 1) / 2 * pitch;");
        L.push("var ic = 0;");
        L.push("var fr = 0;");
        L.push("var kk = 0;");
        L.push("var bx = transform.position[0] + (i - (N - 1) / 2) * (W + G);");
        L.push("var sum = 0;");
        L.push("var mx = 0;");
        L.push("var k = 0;");
        L.push("var P = null;");
        L.push("var pp = null;");
        L.push("var pk = 0;");
        L.push("var hh = 0;");
        L.push("var R = 0;");
        L.push("var t = 0;");
        L.push("var f = 0;");
        L.push("var v = 0;");
        // 左右边缘控制点(v0.8.0): rl = 左半径, R = 右半径; 未启用时两者同为对称半径
        L.push("var rl = 0;");
        L.push("var rUse = 0;");
        L.push("var dd = 0;");
        L.push("var ECl = null;");
        L.push("var ECr = null;");
        L.push("var ecOn = 0;");
        L.push("var eff = 0;");
        // ---- 总闸「山峰 高度」(与纯函数 peakScaleOf 严格镜像) ----
        // 该图层不存在 -> hGate 保持 0, 一切按旧行为(向后兼容)。
        // 存在 -> 先扫一遍求各点位的"最大固有峰高" pmax, 再令 hsc = hMax / pmax,
        //   主循环里每个峰高乘 hsc => 最高的那根恰好 = hMax, 其余等比。
        L.push("var hGate = 0;");
        L.push("var hMax = 0;");
        L.push("var hsc = 1;");
        L.push("var pmax = 0;");
        L.push("var HL = null;");
        L.push("var P2 = null;");
        L.push("var pk2 = 0;");
        L.push("var hh2 = 0;");
        L.push("var k2 = 0;");
        L.push("try { HL = thisComp.layer(\"" + LAYER_HGT + "\"); } catch (e6) { HL = null; }");
        L.push("if (HL) {");
        L.push("  hGate = 1;");
        L.push("  hMax = transform.position[1] - HL.transform.position[1];");
        L.push("  if (hMax < 0) { hMax = 0; }");
        L.push("  for (k2 = 1; k2 <= M; k2 = k2 + 1) {");
        L.push("    P2 = null;");
        L.push("    try { P2 = thisComp.layer(\"" + PT_PREFIX + "\" + k2); } catch (e7) { P2 = null; }");
        L.push("    if (P2) {");
        L.push("      hh2 = 0;");
        L.push("      try { hh2 = P2.effect(\"" + SL_H + "\")(1); } catch (e8) { hh2 = 0; }");
        L.push("      pk2 = transform.position[1] - P2.transform.position[1];");
        L.push("      if (hh2 > 0) { pk2 = hh2; }");
        L.push("      if (pk2 > pmax) { pmax = pk2; }");
        L.push("    }");
        L.push("  }");
        L.push("  if (pmax > 0) { hsc = hMax / pmax; }");
        L.push("}");
        L.push("for (k = 1; k <= M; k = k + 1) {");
        L.push("  P = null;");
        L.push("  try { P = thisComp.layer(\"" + PT_PREFIX + "\" + k); } catch (e1) { P = null; }");
        L.push("  if (P) {");
        L.push("    pp = P.transform.position;");
        L.push("    hh = 0;");
        L.push("    try { hh = P.effect(\"" + SL_H + "\")(1); } catch (e4) { hh = 0; }");
        // 边缘控制开关(默认 1)。老工程没这个滑块 -> catch 回退 0,
        //   于是连那两次必然失败的图层查找都省掉了(M 大时这是实打实的性能差别)。
        L.push("    ecOn = 0;");
        L.push("    try { ecOn = P.effect(\"" + SL_EC + "\")(1); } catch (e11) { ecOn = 0; }");
        L.push("    pk = transform.position[1] - pp[1];");
        L.push("    if (hh > 0) { pk = hh; }");
        // 总闸生效时把峰高缩放到"最高 = 峰值控制点的高度"
        L.push("    if (hGate > 0) { pk = pk * hsc; }");
        L.push("    if (pk > 0) {");
        L.push("      R = 0;");
        L.push("      try { R = P.effect(\"" + SL_R + "\")(1); } catch (e2) { R = 0; }");
        L.push("      if (R < 1) R = 1;");
        L.push("      ic = (pp[0] - rowLeftX) / pitch;");
        L.push("      fr = ic - Math.floor(ic);");
        L.push("      if (fr > 0.5) { fr = 1 - fr; }");
        L.push("      kk = R / 2 - fr;");
        L.push("      if (R % 2 > 0.5) { kk = (R - 1) / 2 + fr; }");
        L.push("      if (kk < 0.5) { kk = 0.5; }");
        // ---- 左右边缘控制点(与纯函数 resolvePoints 严格镜像) ----
        // 启用时: 左半径 = 峰X − 左边缘点X; 右半径 = 右边缘点X − 峰X —— 两边可不对称。
        // 查找失败(该侧边缘点被删) -> 那一侧回退成「影响范围」换算的对称半径。
        // 边缘点被拖到峰的【另一侧】-> 该侧半径为负 -> 钳到 0, 即"关掉这一侧"。
        L.push("      R = kk * pitch * rsc / 100 * 1.000000001;");
        L.push("      rl = R;");
        L.push("      if (ecOn > 0.5) {");
        L.push("        ECl = null;");
        L.push('        try { ECl = thisComp.layer("' + PT_PREFIX + '" + k + "' + PT_L_SUFFIX + '"); } catch (e9) { ECl = null; }');
        L.push("        if (ECl) { rl = pp[0] - ECl.transform.position[0]; }");
        L.push("        ECr = null;");
        L.push('        try { ECr = thisComp.layer("' + PT_PREFIX + '" + k + "' + PT_R_SUFFIX + '"); } catch (e10) { ECr = null; }');
        L.push("        if (ECr) { R = ECr.transform.position[0] - pp[0]; }");
        L.push("        if (rl < 0) { rl = 0; }");
        L.push("        if (R < 0) { R = 0; }");
        L.push("      }");
        L.push("      dd = bx - pp[0];");
        L.push("      rUse = R;");
        L.push("      if (dd < 0) { rUse = rl; }");
        L.push("      if (rUse > 0) {");
        L.push("        t = Math.abs(dd) / rUse;");
        L.push("        if (t <= 1) {");
        L.push("          if (ftype < 0.5) { f = 0.5 * (1 + Math.cos(Math.PI * t)); }");
        L.push("          else if (ftype < 1.5) { f = (Math.exp(-4.5 * t * t) - " + GAUSS_LO + ") / " + GAUSS_SPAN + "; }");
        L.push("          else if (ftype < 2.5) { f = 1 - t; }");
        L.push("          else { f = (1 - t) * (1 - t); }");
        L.push("          f = edge + (1 - edge) * f;");
        // v0.9.0: 衰减作用在【基础高度之上】的区间(与纯函数 pointContribution 严格镜像)
        //   eff = 峰高 − 基础高度; v = 超出地板多少。这样窗口内每根都保证高过地板。
        L.push("          eff = pk - baseH;");
        L.push("          v = 0;");
        L.push("          if (eff > 0) { v = eff * f; }");
        L.push("          sum = sum + v;");
        L.push("          if (v > mx) { mx = v; }");
        L.push("        }");
        L.push("      }");
        L.push("    }");
        L.push("  }");
        L.push("}");
        L.push("var h = mx;");
        L.push("if (mode < 0.5) { h = sum; }");
        L.push("h = baseH + h;");
        return L.join("\n") + "\n";
    }

    // 矩形路径「大小」表达式 → [W, h]
    function buildSizeExpr(i, N, M) {
        return buildExprCore(i, N, M)
            + "var " + OUT_SIZE + " = [W, h];\n"
            + OUT_SIZE + ";\n";
    }

    // 矩形路径「位置」表达式 → 让矩形【底边】钉在基线(图层自身的 Y)上, 高度只向上长
    //
    // ⚠️ 这里【绝不能】写 bx - transform.position[0] 之类的"抵消图层位置"写法 ——
    //    输出的是【图层坐标系】的值, AE 会再叠加图层自身的 position,
    //    所以只有输出与 transform.position 无关, 拖动形状图层才能移动整行
    //    (v0.1.1 的 bug: bx 取自控制器坐标又被减掉图层坐标, 结果图层拖不动)。
    //    柱子水平偏移只由 W/G 决定 → 图层可自由拖动, 行整体跟随。
    function buildPosExpr(i, N, M) {
        return buildExprCore(i, N, M)
            + "var " + OUT_POS + " = [(i - (N - 1) / 2) * (W + G), -h / 2];\n"
            + OUT_POS + ";\n";
    }

    // ============================================================
    // 预设(4 固定槽位 + 导出导入) —— 纯逻辑层(node 可测)
    // 对齐仓库既有「预设槽」实践(NumCounter / QuickKey / AE-Lyrics-Animator):
    //   固定 4 槽位 · 存于【工程所在目录】的 JSON(跟随工程走, 避开会崩的 app.settings)
    //   · ES3 无 JSON.stringify/parse -> 手写序列化, 解析走"首字符判定 + 受控 eval"
    // ⚠️ 槽位 key 全程 1-based("1".."4"), 与 NumCounter v0.2.9 修过的错位坑一致
    // ============================================================
    var SLOT_KEYS   = ["1", "2", "3", "4"];
    var SLOT_COUNT  = 4;
    var PRESET_FILE_NAME = "MountainSpectrum.presets.json";
    // v1: r = 像素半径;  v2: r = 每侧根数;  v3(v0.3.4 起): r = 总共根数 —— 量纲几经变化, 故升版本
    var PRESET_VERSION = 3;
    // 预设字段与面板控件一一对应
    var PRESET_KEYS = ["n", "auto", "w", "gap", "baseH", "baseRatio", "ftype", "mode", "r", "pts", "ph", "edge"];

    // 面板默认值(单一来源: 预设归一化与面板初值都用它, 避免两处漂移)
    var DEFAULTS = {
        n: 40, auto: false, w: 24, gap: 10,
        baseH: 40, baseRatio: 80, ftype: 0, mode: 0, r: 0, pts: 5,
        ph: 0,              // 点位高度(px, 基线以上); 0 = 自动(跟随点位 Y 位置)
        edge: EDGE_DEF      // 边缘高度%(窗口最边缘那根保留峰高的百分比)
    };

    // 宽松取数: 空串/undefined/null/非数字 -> 默认值(不用 clamp 的 lo, 否则空框会变成 1)
    function pickNum(v, dflt) {
        var x = parseFloat(v);
        return isNaN(x) ? dflt : x;
    }
    // 空串 / "false" / 0 / 缺省 -> false; true / "true" / 1 -> true
    function pickBool(v) {
        return !!(v === true || v === "true" || v === 1 || v === "1");
    }

    // 把槽位缓存【就地】清空(4 个 key 全 null)并返回它。
    // 就地改而不是换成新对象, 是为了保持引用稳定: 目前所有读取都走同一个模块级变量,
    //   换成新对象其实也能工作 —— 但一旦将来有人把 presetsCache 传进闭包持有,
    //   换对象就会让那部分引用停在旧对象上, 这类 bug 很难查。统一用就地改, 从写法上杜绝。
    // 为什么必须清空: 切换工程时若不清空, 换到一个【没有预设文件】的工程就会整段跳过装载,
    //   内存里残留上一个工程的槽位 —— 「使用」按钮继续亮着, 点下去给的是别的工程的预设。
    function resetSlots(cache) {
        for (var i = 0; i < SLOT_KEYS.length; i++) { cache[SLOT_KEYS[i]] = null; }
        return cache;
    }

    // 归一化: 无论来源是面板、槽位文件还是手改 JSON, 出来的都是合法且钳制过的参数
    function serializePreset(o) {
        return {
            n:         clampInt(pickNum(o && o.n, DEFAULTS.n), 1, MAX_BARS),
            auto:      pickBool(o && o.auto),
            w:         clampNum(pickNum(o && o.w, DEFAULTS.w), 1, 100000),
            gap:       clampNum(pickNum(o && o.gap, DEFAULTS.gap), 0, 100000),
            baseH:     clampNum(pickNum(o && o.baseH, DEFAULTS.baseH), 0, 100000),
            baseRatio: clampNum(pickNum(o && o.baseRatio, DEFAULTS.baseRatio), 1, 99),
            ftype:     clampInt(pickNum(o && o.ftype, DEFAULTS.ftype), 0, 3),
            mode:      clampInt(pickNum(o && o.mode, DEFAULTS.mode), 0, 1),
            r:         clampNum(pickNum(o && o.r, DEFAULTS.r), 0, MAX_BARS),
            pts:       clampInt(pickNum(o && o.pts, DEFAULTS.pts), 1, MAX_POINTS),
            ph:        clampNum(pickNum(o && o.ph, DEFAULTS.ph), 0, 100000),
            edge:      clampNum(pickNum(o && o.edge, DEFAULTS.edge), 0, 100)
        };
    }

    // 读回: 对象(槽位文件)或旧版 "k=v&k=v" 串都吃; 一律走 serializePreset 归一化
    function deserializePreset(src) {
        if (!src) { return serializePreset(null); }
        if (typeof src === "string") {
            var o = {};
            var parts = src.split("&");
            for (var i = 0; i < parts.length; i++) {
                var kv = parts[i].split("=");
                if (kv.length < 2) { continue; }
                o[kv[0]] = kv[1];
            }
            return serializePreset(o);
        }
        return serializePreset(src);
    }

    // 槽位文件 = { version:1, slots:{ "1":参数|null, ... "4":null } }
    // 字段只有数字/布尔/null -> 手写拼接即合法 JSON(无字符串, 无需转义)
    function slotsToJson(cache) {
        var out = '{\n  "version": ' + PRESET_VERSION + ',\n  "slots": {\n';
        for (var i = 0; i < SLOT_KEYS.length; i++) {
            var k = SLOT_KEYS[i];
            var src = cache ? cache[k] : null;
            var comma = (i < SLOT_KEYS.length - 1) ? ",\n" : "\n";
            if (!src) {
                out += '    "' + k + '": null' + comma;
            } else {
                var q = serializePreset(src);
                out += '    "' + k + '": {';
                for (var j = 0; j < PRESET_KEYS.length; j++) {
                    var key = PRESET_KEYS[j];
                    if (key === "auto") {
                        out += '"auto":' + (q.auto ? "true" : "false");
                    } else {
                        out += '"' + key + '":' + q[key];
                    }
                    if (j < PRESET_KEYS.length - 1) { out += ","; }
                }
                out += "}" + comma;
            }
        }
        out += "  }\n}";
        return out;
    }

    // ES3 无 JSON.parse: 仅当首字符为 { 才解析(防误读非本插件文件),
    // 解析出的每个槽位再逐字段归一化钳制
    function jsonParseSlots(str) {
        var empty = { version: PRESET_VERSION, slots: resetSlots({}) };
        if (!str || str.charAt(0) !== "{") { return empty; }
        try {
            var obj = eval("(" + str + ")");
            var ver = (obj && obj.version != null) ? parseInt(obj.version, 10) : 1;
            if (isNaN(ver)) { ver = 1; }
            var slots = resetSlots({});
            if (obj && obj.slots) {
                for (var i = 0; i < SLOT_KEYS.length; i++) {
                    var k = SLOT_KEYS[i];
                    if (!obj.slots[k]) { continue; }
                    var one = deserializePreset(obj.slots[k]);
                    // 迁移: v1 的 r 是像素半径, 与 v2 的「每侧根数」量纲不通 -> 重置为自动
                    if (ver < PRESET_VERSION) { one.r = DEFAULTS.r; }
                    slots[k] = one;
                }
            }
            return { version: ver, slots: slots };
        } catch (e) { return empty; }
    }

    // ============================================================
    // node 测试导出: 在 AE 之外(app 未定义)只导出纯函数并返回, 跳过 UI 代码
    // ============================================================
    if (typeof app === "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            module.exports = {
                clampNum: clampNum, clampInt: clampInt, falloff: falloff,
                pickBaseY: pickBaseY,
                barOffsetX: barOffsetX, rowWidth: rowWidth, autoCount: autoCount,
                pointContribution: pointContribution, combineHeights: combineHeights,
                barHeightAt: barHeightAt, barHeightOfIndex: barHeightOfIndex,
                countVisibleBars: countVisibleBars,
                influenceRadiusPx: influenceRadiusPx, resolvePoints: resolvePoints,
                intrinsicPeak: intrinsicPeak, peakScaleOf: peakScaleOf,
                barPhase: barPhase,
                autoInfluenceBars: autoInfluenceBars,
                buildExprCore: buildExprCore, buildSizeExpr: buildSizeExpr,
                buildPosExpr: buildPosExpr,
                serializePreset: serializePreset, deserializePreset: deserializePreset,
                slotsToJson: slotsToJson, jsonParseSlots: jsonParseSlots,
                resetSlots: resetSlots,
                pickNum: pickNum, pickBool: pickBool,
                PRESET: {
                    file: PRESET_FILE_NAME, version: PRESET_VERSION,
                    slotKeys: SLOT_KEYS, slotCount: SLOT_COUNT,
                    keys: PRESET_KEYS, defaults: DEFAULTS
                },
                NAMES: {
                    bars: LAYER_BARS, ctrl: LAYER_CTRL, ptPrefix: PT_PREFIX,
                    hgt: LAYER_HGT, hgtDefRatio: HGT_DEF_RATIO,
                    ptLSuffix: PT_L_SUFFIX, ptRSuffix: PT_R_SUFFIX,
                    ec: SL_EC, ecDef: EC_DEF,
                    groupPrefix: GROUP_PREFIX, rect: RECT_NAME,
                    w: SL_W, g: SL_G, base: SL_BASE, mode: SL_MODE,
                    ftype: SL_FTYPE, r: SL_R, h: SL_H, hDef: H_DEF, rscale: SL_RSCALE, color: SL_COLOR,
                    rscaleDef: RSCALE_DEF, edge: SL_EDGE, edgeDef: EDGE_DEF,
                    edgeKeepOf: edgeKeepOf,
                    maxBars: MAX_BARS, maxPoints: MAX_POINTS,
                    gaussLo: GAUSS_LO, gaussSpan: GAUSS_SPAN,
                    outSize: OUT_SIZE, outPos: OUT_POS
                }
            };
        }
        return;
    }

    // ============================================================
    // 以下为 AE 运行环境代码
    // ============================================================

    var C_OK   = [0.10, 0.75, 0.35];
    var C_WARN = [0.85, 0.55, 0.10];
    var C_ERR  = [0.90, 0.25, 0.20];

    // ---------- 状态栏 / 调试弹窗 ----------
    function setStatus(pal, msg, rgb) {
        try {
            if (!pal.status) return;
            pal.status.text = msg;
            var pen = pal.status.graphics.newPen(0, rgb, 1);
            pal.status.graphics.foregroundColor = pen;
        } catch (e) { /* 颜色设置失败不影响文本 */ }
        try { pal.layout.layout(true); } catch (e2) {}
        // 注意: 这里【不要】调 layout.resize() —— 状态栏文本变长时它会按新的首选宽度
        // 把面板撑宽(点「使用」回填预设时最明显)。宽度已在建控件时钉死, 无需 resize。
    }

    function showDebugError(err, step) {
        try {
            var lines = [];
            lines.push("出错位置: " + (step || "未知"));
            lines.push("错误类型: " + (err && err.name ? err.name : "未知"));
            lines.push("错误信息: " + (err ? err.toString() : "未知"));
            if (err && err.line !== undefined) { lines.push("行号: " + err.line); }
            if (err && err.stack) { lines.push("堆栈:"); lines.push(err.stack); }
            var msg = lines.join("\n");

            var win = new Window("dialog", "山峰频谱 - 出错");
            win.orientation = "column";
            win.alignChildren = "fill";
            win.spacing = 10;
            win.margins = 12;
            win.add("statictext", undefined, "以下为错误详情(可全选复制 Ctrl+A / Ctrl+C):");
            var box = win.add("edittext", undefined, msg, { multiline: true, scrollable: true });
            box.preferredSize.width = 520;
            box.preferredSize.height = 220;
            var row = win.add("group");
            row.alignment = "center";
            var ok = row.add("button", undefined, "确定");
            ok.onClick = function () { win.close(); };
            win.center();
            win.show();
        } catch (e3) {
            alert("脚本出错:\n" + (err ? err.toString() : String(e3)));
        }
    }

    // ---------- 合成 / 图层查找 ----------
    function getComp() {
        var item = app.project ? app.project.activeItem : null;
        if (!item || !(item instanceof CompItem)) return null;
        return item;
    }

    function findLayer(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            var L = comp.layer(i);
            var nm = "";
            try { nm = L.name; } catch (e) { continue; }
            if (nm === name) return L;
        }
        return null;
    }

    // 数当前有几个「山峰点 k」
    function countPoints(comp) {
        var n = 0;
        for (var i = 1; i <= comp.numLayers; i++) {
            var nm = "";
            try { nm = comp.layer(i).name; } catch (e) { continue; }
            if (nm.length > PT_PREFIX.length && nm.indexOf(PT_PREFIX) === 0) {
                var idx = parseInt(nm.substring(PT_PREFIX.length), 10);
                if (!isNaN(idx) && idx > n) n = idx;
            }
        }
        return n;
    }

    // 数形状图层里有几个「柱 k」组
    function countBars(barsLayer) {
        var n = 0;
        try {
            var contents = barsLayer.property("ADBE Root Vectors Group");
            for (var i = 1; i <= contents.numProperties; i++) {
                var nm = contents.property(i).name;
                if (nm.length > GROUP_PREFIX.length && nm.indexOf(GROUP_PREFIX) === 0) {
                    var idx = parseInt(nm.substring(GROUP_PREFIX.length), 10);
                    if (!isNaN(idx) && idx > n) n = idx;
                }
            }
        } catch (e) {}
        return n;
    }

    // 0..1 随机数。
    // 官方文档依据(ae-scripting.docsforadobe.dev · Global functions · generateRandomNumber):
    //   "This function is recommended instead of Math.random() for generating random numbers
    //    that will be applied as values in a project (e.g., when using setValue)."
    //   原因: 旧版 AE(13.5.x)多线程并发下 Math.random() 可能返回重复值。
    //   本插件 randomPeaks 正是"生成随机数 → setValue", 属该文档点名场景。
    //   generateRandomNumber 自 AE 13.6(CC 2015) 起才有, 故做存在性回退。
    function rnd01() {
        try {
            if (typeof generateRandomNumber === "function") { return generateRandomNumber(); }
        } catch (e) {}
        return Math.random();
    }

    // 当前行的【实际基线 Y】。
    // 基线 = 形状图层「山峰 柱」自身的 position[1](生成时写为 合成高×基线比,
    // 但用户随时可以拖这个图层改基线)。拿不到图层才回退到面板的「基线 %合成高」。
    // ⚠️ 不能只用面板值 —— 用户拖过形状图层后两者不一致, 点位会跳到错误高度。
    function currentBaseY(comp, U) {
        var barsY = null;
        var bars = findLayer(comp, LAYER_BARS);
        if (bars) {
            try {
                var v = bars.transform.position.value;
                if (v && v.length >= 2) { barsY = v[1]; }
            } catch (e) {}
        }
        var ratio = pickNum(U.edBaseline.text, DEFAULTS.baseRatio);
        return pickBaseY(barsY, comp.height, ratio);
    }

    // 删除本插件生成的所有图层, 返回删除数量
    function cleanup(comp) {
        var removed = 0;
        for (var i = comp.numLayers; i >= 1; i--) {
            var nm = "";
            try { nm = comp.layer(i).name; } catch (e) { continue; }
            if (nm === LAYER_BARS || nm === LAYER_CTRL || nm === LAYER_HGT
                || nm.indexOf(PT_PREFIX) === 0) {
                try { comp.layer(i).remove(); removed++; } catch (e2) {}
            }
        }
        return removed;
    }

    // 按候选名字取属性: 先 match name, 再显示名。找不到返回 null
    // (仓库既有坑: 中文界面下显示名会静默找不到, 一律先试 match name)
    function propByNames(host, names) {
        for (var i = 0; i < names.length; i++) {
            var p = null;
            try { p = host.property(names[i]); } catch (e) { p = null; }
            if (p) return p;
        }
        return null;
    }

    // 给空对象加一个滑块并设初值
    // 注意: Effects 是索引属性组, 每次 addProperty 会让既有子引用失效,
    //       所以每次都用名字重新取回后立即写入, 不缓存引用。
    function addSlider(host, name, val) {
        var e = host.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        if (!e) { throw new Error("无法添加滑块「" + name + "」"); }
        e.name = name;
        host.property("ADBE Effect Parade").property(name).property(1).setValue(val);
    }

    // 按名字设置【已存在】滑块的数值(用于把面板参数推给已有点位)
    function setSlider(host, name, val) {
        try {
            var e = host.property("ADBE Effect Parade").property(name);
            if (!e) { return false; }
            e.property(1).setValue(val);
            return true;
        } catch (e2) { return false; }
    }

    // 给形状图层加一个颜色控件 —— 所有组内填充的颜色都由它统一驱动,
    // 改这一个颜色, 全部矩形一起变。
    function addColorControl(layer, name, val) {
        var e = layer.property("ADBE Effect Parade").addProperty("ADBE Color Control");
        if (!e) { throw new Error("无法添加颜色控件「" + name + "」"); }
        e.name = name;
        var host = layer.property("ADBE Effect Parade").property(name);
        var c = propByNames(host, ["ADBE Color Control-0001", "Color", "颜色"]);
        if (!c) { c = host.property(1); }
        c.setValue(val);
    }

    // 组内第一个内容就是矩形路径(建组时先加它), 按索引取回最稳
    function rectSizeProp(gc) {
        return propByNames(gc.property(1), ["ADBE Vector Rect Size", "Size", "大小"]);
    }
    function rectPosProp(gc) {
        return propByNames(gc.property(1), ["ADBE Vector Rect Position", "Position", "位置"]);
    }

    // 建/重建 N 个矩形组, 并写入表达式
    // 结构: 「柱 k」组 → [矩形路径 1, 填充 1](填充在路径之后, 颜色由图层颜色控件驱动)
    // 采用 AE 矩形工具的固有结构(填充在组内), 比在组外放共享填充更稳。
    function buildBarGroups(barsLayer, N, M) {
        addColorControl(barsLayer, SL_COLOR, FILL_COLOR);

        var contents = barsLayer.property("ADBE Root Vectors Group");
        for (var k = 1; k <= N; k++) {
            var g = contents.addProperty("ADBE Vector Group");
            if (!g) { throw new Error("无法添加形状组「" + GROUP_PREFIX + k + "」"); }
            g.name = GROUP_PREFIX + k;
            var gc = propByNames(g, ["ADBE Vectors Group", "Contents", "内容"]);
            if (!gc) { throw new Error("组「" + GROUP_PREFIX + k + "」找不到内容容器"); }

            var rectProp = gc.addProperty("ADBE Vector Shape - Rect");
            if (!rectProp) { throw new Error("无法添加矩形路径(ADBE Vector Shape - Rect)"); }
            try { rectProp.name = RECT_NAME; } catch (e1) {}

            // 填充必须排在矩形路径【之后】—— AE 的填充只作用于它上方的路径
            var fill = gc.addProperty("ADBE Vector Graphic - Fill");
            if (!fill) { throw new Error("无法添加组内填充"); }
            var fc = propByNames(fill, ["ADBE Vector Fill Color", "Color", "颜色"]);
            if (fc) { fc.expression = "effect(\"" + SL_COLOR + "\")(1)"; }

            // 集合已变更(之后又 addProperty 了填充) → 重新按索引取回矩形路径再写表达式,
            // 否则先前缓存的引用可能已失效(仓库既有坑: 集合变更后引用失效)
            var sz = rectSizeProp(gc);
            var ps = rectPosProp(gc);
            if (!sz || !ps) { throw new Error("组「" + GROUP_PREFIX + k + "」找不到矩形路径的大小/位置"); }
            sz.expression = buildSizeExpr(k - 1, N, M);
            ps.expression = buildPosExpr(k - 1, N, M);
        }
    }

    // 只重写表达式(点位数量变化时用, 不重建图层)
    function rewriteBarExpr(N, M) {
        var comp = getComp();
        if (!comp) return false;
        var bars = findLayer(comp, LAYER_BARS);
        if (!bars) return false;
        var contents = bars.property("ADBE Root Vectors Group");
        for (var k = 1; k <= N; k++) {
            // 逐组保护: 组被改名/删掉不该让整轮重写崩掉(否则一个坏组 -> 整个循环抛错 + 弹窗)
            try {
                var g = contents.property(GROUP_PREFIX + k);
                if (!g) { continue; }
                var gc = propByNames(g, ["ADBE Vectors Group", "Contents", "内容"]);
                if (!gc) { continue; }
                var sz = rectSizeProp(gc);
                var ps = rectPosProp(gc);
                if (!sz || !ps) { continue; }
                sz.expression = buildSizeExpr(k - 1, N, M);
                ps.expression = buildPosExpr(k - 1, N, M);
            } catch (e3) { /* 跳过这一组, 继续后面的 */ }
        }
        return true;
    }

    // 读面板参数 → 归一化后的参数对象
    function readParams(U, comp) {
        // ⚠️ 不能直接 clamp 原始输入: clamp 遇 NaN 返回 lo, 会让空输入框变成 1(而不是默认值)。
        //    一律 pickNum(空/非法 -> DEFAULTS) 再 clamp。
        var W = clampNum(pickNum(U.edW.text, DEFAULTS.w), 1, comp.width);
        var G = clampNum(pickNum(U.edGap.text, DEFAULTS.gap), 0, comp.width);
        var baseH = clampNum(pickNum(U.edBaseH.text, DEFAULTS.baseH), 0, comp.height);
        var ratio = clampNum(pickNum(U.edBaseline.text, DEFAULTS.baseRatio), 1, 99);
        var M = clampInt(pickNum(U.edPoints.text, DEFAULTS.pts), 1, MAX_POINTS);
        var Rin = clampNum(pickNum(U.edR.text, DEFAULTS.r), 0, MAX_BARS);
        var PH = clampNum(pickNum(U.edPH.text, DEFAULTS.ph), 0, 100000);
        var edgePct = clampNum(pickNum(U.edEdge.text, DEFAULTS.edge), 0, 100);

        var mode = (U.ddMode.selection ? U.ddMode.selection.index : DEFAULTS.mode);
        var ftype = (U.ddFall.selection ? U.ddFall.selection.index : DEFAULTS.ftype);

        var N;
        if (U.cbFill.value) {
            N = autoCount(comp.width, W, G, comp.width * 0.03);
        } else {
            N = clampInt(pickNum(U.edCount.text, DEFAULTS.n), 1, MAX_BARS);
        }

        var rowW = rowWidth(N, W, G);
        var defR = (Rin > 0) ? Rin : autoInfluenceBars(N, W, G, M);

        return {
            n: N, w: W, gap: G, baseH: baseH,
            baseRatio: ratio / 100,
            m: M, r: defR, mode: mode, ftype: ftype,
            ph: PH, edge: edgePct,
            rowW: rowW,
            auto: U.cbFill.value
        };
    }

    // 第 k 个点位的理想水平位置(相对行中心均分)
    function pointXAt(k, M, rowW, centerX) {
        return centerX + ((k - 0.5) / M - 0.5) * rowW;
    }

    // 建某个波峰的左右边缘控制点(于是【一个波峰 = 一组 3 个空对象】: 峰 + 左 + 右)。
    //   左/右边缘点的 X 决定山丘的左右边界, 拖它们即可实时改宽度, 两边可不对称。
    //   放在基线上(与峰同高会互相遮挡), 且 X 分列峰两侧, 方便直接拖。
    function makeEdgePoints(comp, k, px, baseY, rPx) {
        var EL = comp.layers.addNull();
        EL.name = PT_PREFIX + k + PT_L_SUFFIX;
        EL.transform.position.setValue([px - rPx, baseY]);
        var ER = comp.layers.addNull();
        ER.name = PT_PREFIX + k + PT_R_SUFFIX;
        ER.transform.position.setValue([px + rPx, baseY]);
    }

    // 把某个峰的两侧边缘点摆到 峰X ∓ rPx 处(只改 X, 保留它们各自的 Y —— 用户可能拖过)。
    //   某一侧边缘点不存在就跳过 —— 删掉一侧 = 关掉那一侧(该侧回退成对称半径)。
    // 共用点: 「影响范围」字段变更 与 「重设点位」都要调用它, 否则边缘点会与峰错位。
    function syncEdgeX(comp, k, px, rPx) {
        var E = findLayer(comp, PT_PREFIX + k + PT_L_SUFFIX);
        if (E) {
            var yL = 0;
            try { yL = E.transform.position.value[1]; } catch (e1) { yL = 0; }
            try { E.transform.position.setValue([px - rPx, yL]); } catch (e2) {}
        }
        E = findLayer(comp, PT_PREFIX + k + PT_R_SUFFIX);
        if (E) {
            var yR = 0;
            try { yR = E.transform.position.value[1]; } catch (e3) { yR = 0; }
            try { E.transform.position.setValue([px + rPx, yR]); } catch (e4) {}
        }
    }

    function makePoint(comp, k, M, rowW, centerX, baseY, peak, R, PH, pitchIn) {
        var px = pointXAt(k, M, rowW, centerX);
        var P = comp.layers.addNull();
        P.name = PT_PREFIX + k;
        P.transform.position.setValue([px, baseY - peak]);
        addSlider(P, SL_R, R);
        addSlider(P, SL_H, (typeof PH === "number" && !isNaN(PH)) ? PH : H_DEF);
        addSlider(P, SL_EC, EC_DEF);
        // 边缘点的初始位置按「影响范围」换算的对称半径摆放(Δ 取 0.5 的保守估计);
        //   之后用户一拖就以边缘点为准(它接管), 所以这里只是起点, 不必与 kNN 半径分毫不差。
        var pitch = (typeof pitchIn === "number" && pitchIn > 0) ? pitchIn : 34;
        makeEdgePoints(comp, k, px, baseY, influenceRadiusPx(R, pitch, 100, 0.5));
        return P;
    }

    // 建/复用总闸空对象「山峰 高度」。
    //   它离基线的距离 = 整排最高柱的高度; 拖它 = 整座山等比缩放(形状不变)。
    // ⚠️ 只在【不存在】时创建并定位; 已存在则原样返回 —— 绝不重置它的位置。
    //    理由: 用户调好的高度是"设计意图", 不该因为他改了「数量」点一次「生成 / 重建」
    //    就被打回默认(那样每改一次排列都要重调高度)。
    //    想让高度回到默认 -> 在时间轴里删掉这一层, 再点「生成 / 重建」或「重设点位」。
    //    (顺带: 删掉这一层 = 关闭总闸, 表达式 hGate 归 0, 回到各点位独立高度。)
    function ensureHeightLayer(comp, centerX, baseY, hMaxPx) {
        var L = findLayer(comp, LAYER_HGT);
        if (L) { return L; }
        L = comp.layers.addNull();
        L.name = LAYER_HGT;
        var h = (typeof hMaxPx === "number" && hMaxPx > 0) ? hMaxPx : (comp.height * HGT_DEF_RATIO);
        L.transform.position.setValue([centerX, baseY - h]);
        return L;
    }

    // ---------- 主流程 ----------

    function generate(pal, U) {
        var step = "读取参数";
        try {
            var comp = getComp();
            if (!comp) {
                setStatus(pal, "请先在时间轴里激活一个合成, 再点生成。", C_WARN);
                return;
            }
            var p = readParams(U, comp);

            step = "生成";
            app.beginUndoGroup("山峰频谱:生成");
            try {
                cleanup(comp);

                var baseY = comp.height * p.baseRatio;
                var centerX = comp.width / 2;

                step = "建形状图层";
                var bars = comp.layers.addShape();
                bars.name = LAYER_BARS;
                // 形状图层自身的位置就是「行中心 X / 基线 Y」—— 拖它就能移动整行
                bars.transform.position.setValue([centerX, baseY]);
                buildBarGroups(bars, p.n, p.m);

                step = "建控制器";
                var ctrl = comp.layers.addNull();
                ctrl.name = LAYER_CTRL;
                ctrl.transform.position.setValue([centerX, baseY]);
                addSlider(ctrl, SL_W, p.w);
                addSlider(ctrl, SL_G, p.gap);
                addSlider(ctrl, SL_BASE, p.baseH);
                addSlider(ctrl, SL_MODE, p.mode);
                addSlider(ctrl, SL_FTYPE, p.ftype);
                addSlider(ctrl, SL_RSCALE, RSCALE_DEF);
                addSlider(ctrl, SL_EDGE, p.edge);

                step = "建点位";
                var peak = comp.height * 0.22;
                for (var k = 1; k <= p.m; k++) {
                    makePoint(comp, k, p.m, p.rowW, centerX, baseY, peak, p.r, p.ph, p.w + p.gap);
                }

                // 总闸: 默认高度 = 合成高 × 22%(与点位默认峰高一致)
                //   -> 生成后 hsc 恰好 = 1, 观感与不开总闸时完全相同, 用户往上拖才长高。
                step = "建高度控制点";
                ensureHeightLayer(comp, centerX, baseY, comp.height * HGT_DEF_RATIO);
            } finally {
                app.endUndoGroup();
            }

            setStatus(pal,
                "已生成 " + p.n + " 根矩形 + " + p.m + " 个点位"
                + (p.auto ? "(自动铺满)" : "")
                + visibleCountHint(comp)
                + "\r拖动「山峰点 n」改山丘, 拖控制器滑块改排列。",
                C_OK);
        } catch (e) {
            setStatus(pal, "出错: " + step + ", 详情见弹窗", C_ERR);
            showDebugError(e, step);
        }
    }

    // 从合成里读回所有点位的参数(供状态栏回报"实际可见根数")
    function readPointsFromComp(comp) {
        var out = [], M = countPoints(comp), k, L, pos, r, h, ec, EL, ER, p;
        for (k = 1; k <= M; k++) {
            L = findLayer(comp, PT_PREFIX + k);
            if (!L) { continue; }
            pos = null;
            try { pos = L.transform.position.value; } catch (e1) { pos = null; }
            if (!pos || pos.length < 2) { continue; }
            r = 0;
            h = 0;
            ec = 0;
            try { r = L.property("ADBE Effect Parade").property(SL_R).property(1).value; } catch (e2) { r = 0; }
            try { h = L.property("ADBE Effect Parade").property(SL_H).property(1).value; } catch (e3) { h = 0; }
            try { ec = L.property("ADBE Effect Parade").property(SL_EC).property(1).value; } catch (e4) { ec = 0; }
            p = { x: pos[0], y: pos[1], r: r, h: h };
            // 边缘控制开启且该侧边缘点存在时才带上 xl/xr —— 缺了就让纯函数回退对称半径
            if (ec > 0.5) {
                EL = findLayer(comp, PT_PREFIX + k + PT_L_SUFFIX);
                if (EL) { try { p.xl = EL.transform.position.value[0]; } catch (e5) {} }
                ER = findLayer(comp, PT_PREFIX + k + PT_R_SUFFIX);
                if (ER) { try { p.xr = ER.transform.position.value[0]; } catch (e6) {} }
            }
            out.push(p);
        }
        return out;
    }

    // 状态栏补充信息: "实际可见 N 根"。
    // 用户看的是【视觉上抬起来了几根】, 与"影响范围"填的数字常常不等 —— 差在衰减尾部
    // 被「基础高度」钳平。把这个数字显示出来, 用户就能照着调, 不用猜。
    function visibleCountHint(comp) {
        try {
            if (!comp) { return ""; }
            var bars = findLayer(comp, LAYER_BARS);
            var ctrl = findLayer(comp, LAYER_CTRL);
            if (!bars || !ctrl) { return ""; }
            var N = countBars(bars);
            if (N < 1) { return ""; }
            var pts = readPointsFromComp(comp);
            if (pts.length < 1) { return ""; }

            var W = 24;
            var G = 10;
            var baseH = 0;
            var mode = 0;
            var ftype = 0;
            var rsc = RSCALE_DEF;
            var ekeep = EDGE_DEF;
            try { W = ctrl.effect(SL_W)(1); } catch (e1) { W = 24; }
            try { G = ctrl.effect(SL_G)(1); } catch (e2) { G = 10; }
            try { baseH = ctrl.effect(SL_BASE)(1); } catch (e3) { baseH = 0; }
            try { mode = ctrl.effect(SL_MODE)(1); } catch (e4) { mode = 0; }
            try { ftype = ctrl.effect(SL_FTYPE)(1); } catch (e5) { ftype = 0; }
            try { rsc = ctrl.effect(SL_RSCALE)(1); } catch (e6) { rsc = RSCALE_DEF; }
            try { ekeep = ctrl.effect(SL_EDGE)(1); } catch (e7) { ekeep = EDGE_DEF; }

            var rowPos = bars.transform.position.value;

            // 总闸: 高度控制点离基线多高, 最高柱就多高(hMax 为 null = 未启用)
            var hMax = null;
            var hL = findLayer(comp, LAYER_HGT);
            if (hL) {
                try {
                    hMax = rowPos[1] - hL.transform.position.value[1];
                    if (hMax < 0) { hMax = 0; }
                } catch (e8) { hMax = null; }
            }

            var vis = countVisibleBars(N, W, G, rowPos[0], rowPos[1], pts, mode, baseH, ftype, rsc, ekeep, hMax);
            var tag = (typeof hMax === "number") ? (" | 最高 " + Math.round(hMax) + "px") : "";
            return " 实际可见 " + vis + " 根(共 " + N + " 根)" + tag + "。";
        } catch (e) { return ""; }
    }

    // 把面板的「点位高度」立即推给所有已有点位(0 = 自动, 跟随点位 Y)。
    // 返回改到的个数; 输入为空/非法返回 -1(保持不动)。
    function pushPointHeight(pal, U) {
        try {
            var comp = getComp();
            if (!comp) { return -1; }
            var raw = pickNum(U.edPH.text, NaN);
            if (isNaN(raw)) { return -1; }
            var v = clampNum(raw, 0, 100000);
            var M = countPoints(comp);
            if (M < 1) { return 0; }
            var n = 0;
            for (var k = 1; k <= M; k++) {
                var L = findLayer(comp, PT_PREFIX + k);
                if (!L) { continue; }
                if (setSlider(L, SL_H, v)) { n = n + 1; }
            }
            return n;
        } catch (e) { return -1; }
    }

    // 把面板的「边缘高度%」立即推给控制器。
    // 老工程没有这个滑块 -> 顺手补建(addSlider), 于是不必重新生成也能用。
    // 返回 1 = 成功, 0 = 还没生成, -1 = 输入非法。
    function pushEdgeToController(pal, U) {
        try {
            var comp = getComp();
            if (!comp) { return -1; }
            var raw = pickNum(U.edEdge.text, NaN);
            if (isNaN(raw)) { return -1; }
            var v = clampNum(raw, 0, 100);
            var ctrl = findLayer(comp, LAYER_CTRL);
            if (!ctrl) { return 0; }
            if (!setSlider(ctrl, SL_EDGE, v)) { addSlider(ctrl, SL_EDGE, v); }
            return 1;
        } catch (e) { return -1; }
    }

    // 把面板的「影响范围」【立即】推给所有已有点位。
    //
    // 为什么必须有它: 面板字段过去只在「生成 / 重建」或「重设点位」时才落地,
    //   用户改完对话框看着毫无反应 → 判断为"点位无法控制"。v0.3.3 / v0.3.4 两轮
    //   都只改了"值算得对不对", 没解决"改了到底生不生效"这个交互问题。
    //   现在改为输入框 onChange 直接推给已有点位 —— 改完即见。
    //
    // 只动「影响范围」滑块, 【不动点位位置】(位置仍由「重设点位」按点数重排)。
    // 面板值填 0 = 自动推算(与「重设点位」口径一致)。
    // 返回实际改到的点位数; 输入为空/非法时返回 -1 表示"保持不动"(避免误把范围清成 0)。
    function pushInfluenceToPoints(pal, U) {
        try {
            var comp = getComp();
            if (!comp) { return -1; }
            var raw = pickNum(U.edR.text, NaN);
            if (isNaN(raw)) { return -1; }
            var bars = findLayer(comp, LAYER_BARS);
            if (!bars) { return -1; }
            var N = countBars(bars);
            if (N < 1) { return -1; }
            var M = countPoints(comp);
            if (M < 1) { return -1; }

            var W = clampNum(pickNum(U.edW.text, DEFAULTS.w), 1, comp.width);
            var G = clampNum(pickNum(U.edGap.text, DEFAULTS.gap), 0, comp.width);
            var Mset = clampInt(pickNum(U.edPoints.text, DEFAULTS.pts), 1, MAX_POINTS);
            var v = clampNum(raw, 0, MAX_BARS);
            if (v <= 0) { v = autoInfluenceBars(N, W, G, Mset); }

            var n = 0;
            var pitch = W + G;
            var rPx = influenceRadiusPx(v, pitch, 100, 0.5);
            for (var k = 1; k <= M; k++) {
                var L = findLayer(comp, PT_PREFIX + k);
                if (!L) { continue; }
                if (setSlider(L, SL_R, v)) { n = n + 1; }
                // 边缘点一并摆到新半径处。
                //   为什么必须做: 边缘点一旦存在就【接管】了这一侧的半径, 若不跟着动,
                //   「影响范围」这个字段就会被架空 —— 用户改了它却毫无反应, 看着像假的。
                var px = 0;
                try { px = L.transform.position.value[0]; } catch (e1) { px = 0; }
                syncEdgeX(comp, k, px, rPx);
            }
            return n;
        } catch (e) { return -1; }
    }

    // 重设点数: 增删点位空对象, 并重写全部矩形表达式(保留已有点位位置)
    function resetPoints(pal, U) {
        var step = "读取参数";
        try {
            var comp = getComp();
            if (!comp) {
                setStatus(pal, "请先在时间轴里激活一个合成。", C_WARN);
                return;
            }
            var bars = findLayer(comp, LAYER_BARS);
            if (!bars) {
                setStatus(pal, "还没有生成, 请先点「生成 / 重建」。", C_WARN);
                return;
            }
            var N = countBars(bars);
            if (N < 1) {
                setStatus(pal, "形状图层里找不到矩形组, 请点「生成 / 重建」。", C_WARN);
                return;
            }
            var p = readParams(U, comp);
            var old = countPoints(comp);
            // ⚠️ 行宽必须用【实际柱数 N】, 不能用面板的「数量」——
            //    面板的「数量」只有点「生成 / 重建」才会落地; 若只点「重设点位」,
            //    实际柱数不变, 却按面板数量去均分点位 -> 点位与柱子错位。
            var rowW = rowWidth(N, p.w, p.gap);
            // ⚠️ 基线取【形状图层「山峰 柱」的实际 Y】, 不是面板的「基线 %合成高」——
            //    用户拖过形状图层后两者不一致, 用面板值会让点位跳到错误高度。
            var baseY = currentBaseY(comp, U);
            var centerX = comp.width / 2;
            var peak = comp.height * 0.22;

            app.beginUndoGroup("山峰频谱:重设点位");
            try {
                step = "增删点位";

                if (p.m < old) {
                    for (var k = old; k > p.m; k--) {
                        var L = findLayer(comp, PT_PREFIX + k);
                        if (L) { try { L.remove(); } catch (e1) {} }
                    }
                } else if (p.m > old) {
                    for (var k2 = old + 1; k2 <= p.m; k2++) {
                        // 顺手修: 原来漏传 p.ph, 新建点位的「高度」会退化默认值而不是面板值
                        makePoint(comp, k2, p.m, rowW, centerX, baseY, peak, p.r, p.ph, p.w + p.gap);
                    }
                }

                // 老工程(在总闸出现之前生成的)还没有「山峰 高度」-> 顺手补建。
                //   已存在则不动位置, 于是这里也是"拖高之后再点重设点位"的安全路径。
                step = "建高度控制点";
                ensureHeightLayer(comp, centerX, baseY, comp.height * HGT_DEF_RATIO);

                // 关键: 把【面板的影响范围】推给所有已有点位(0 = 按 auto 重算),
                // 并把 X 按新点数重新均分(否则点数变了, 老点位还留在旧的等分位置上)。
                // Y(高度)保留用户已调好的值, 不被覆盖。
                step = "统一排列与影响范围";
                var syncR = influenceRadiusPx(p.r, p.w + p.gap, 100, 0.5);
                for (var k3 = 1; k3 <= p.m; k3++) {
                    var LP = findLayer(comp, PT_PREFIX + k3);
                    if (!LP) { continue; }
                    var curY = baseY - peak;
                    try { curY = LP.transform.position.value[1]; } catch (e3) {}
                    var npx = pointXAt(k3, p.m, rowW, centerX);
                    LP.transform.position.setValue([npx, curY]);
                    setSlider(LP, SL_R, p.r);
                    setSlider(LP, SL_H, p.ph);
                    // 老工程的点位没有「边缘控制」滑块 -> 补建, 于是重设点位后即可用边缘点
                    if (!setSlider(LP, SL_EC, EC_DEF)) { addSlider(LP, SL_EC, EC_DEF); }
                    // 点位 X 变了 -> 左右边缘点按新半径一并重摆(与「影响范围」同语义, 对称)
                    syncEdgeX(comp, k3, npx, syncR);
                }

                step = "重写表达式";
                if (!rewriteBarExpr(N, p.m)) {
                    setStatus(pal, "重写表达式失败, 请点「生成 / 重建」。", C_WARN);
                    return;
                }
            } finally {
                app.endUndoGroup();
            }

            setStatus(pal, "点位已改为 " + p.m + " 个(原 " + old + " 个), 已按新点数均分并统一影响范围为 " + p.r + " 根。"
                + visibleCountHint(comp), C_OK);
        } catch (e) {
            setStatus(pal, "出错: " + step + ", 详情见弹窗", C_ERR);
            showDebugError(e, step);
        }
    }

    // 随机波峰: 把各点位高度随机化(位置不动), 一键出波谱感
    function randomPeaks(pal, U) {
        var step = "读取参数";
        try {
            var comp = getComp();
            if (!comp) {
                setStatus(pal, "请先在时间轴里激活一个合成。", C_WARN);
                return;
            }
            // 基线 = 形状图层「山峰 柱」的实际 Y, 取不到才回退面板值
            var baseY = currentBaseY(comp, U);
            var M = countPoints(comp);
            if (M < 1) {
                setStatus(pal, "还没有点位, 请先点「生成 / 重建」。", C_WARN);
                return;
            }
            app.beginUndoGroup("山峰频谱:随机波峰");
            try {
                step = "随机高度";
                for (var k = 1; k <= M; k++) {
                    var L = findLayer(comp, PT_PREFIX + k);
                    if (!L) continue;
                    var pos = L.transform.position.value;
                    var h = comp.height * (0.08 + rnd01() * 0.42);
                    L.transform.position.setValue([pos[0], baseY - h]);
                }
            } finally {
                app.endUndoGroup();
            }
            setStatus(pal, "已随机 " + M + " 个点位的高度。", C_OK);
        } catch (e) {
            setStatus(pal, "出错: " + step + ", 详情见弹窗", C_ERR);
            showDebugError(e, step);
        }
    }

    function cleanAll(pal) {
        var step = "清理";
        try {
            var comp = getComp();
            if (!comp) {
                setStatus(pal, "请先在时间轴里激活一个合成。", C_WARN);
                return;
            }
            app.beginUndoGroup("山峰频谱:清理");
            try {
                var n = cleanup(comp);
            } finally {
                app.endUndoGroup();
            }
            setStatus(pal, n > 0 ? ("已清理 " + n + " 个图层。") : "没有需要清理的图层。", C_OK);
        } catch (e) {
            setStatus(pal, "出错: " + step + ", 详情见弹窗", C_ERR);
            showDebugError(e, step);
        }
    }

    // ---------- 预设槽位(AE 侧: 工程目录文件读写 + 面板交互) ----------
    // presetsCache["1".."4"] = 归一化参数对象 | null(空槽); 启动时从工程目录恢复
    var presetsCache = resetSlots({});
    var gSlotLoadBtns = [];   // UI 构建后填充, updateSlotLoadBtns 据此启用/禁用「使用」

    function getPresetFile() {
        try {
            if (!app.project || !app.project.file) { return null; }
            var folder = app.project.file.parent;
            if (!folder) { return null; }
            return new File(folder.fsName + "/" + PRESET_FILE_NAME);
        } catch (e) { return null; }
    }

    // ⚠️ 索引契约: 全程 1-based。gSlotLoadBtns[i] 对应 SLOT_KEYS[i]("1".."4")
    function updateSlotLoadBtns(pal) {
        for (var i = 0; i < gSlotLoadBtns.length; i++) {
            gSlotLoadBtns[i].enabled = !!presetsCache[SLOT_KEYS[i]];
        }
        if (pal && pal.layout) { try { pal.layout.layout(true); } catch (e) {} }
    }

    // 从工程目录恢复槽位(工程未保存过则全部清空, 不报错)
    function loadSlotsFromStorage(pal) {
        // ⚠️ 必须【先把缓存全部清空】再按文件装载。
        //    旧写法只在 f.exists 时才进分支, 于是切换到一个【没有预设文件】的工程时
        //    整段被跳过, 内存里仍留着上个工程的槽位 —— 「使用」按钮继续亮着,
        //    点下去给出的是【上一个工程】的预设(跨工程串味)。
        var i, k;
        resetSlots(presetsCache);

        var f = getPresetFile();
        if (f && f.exists) {
            try {
                f.encoding = "UTF-8";
                if (f.open("r")) {
                    var txt = String(f.read());
                    f.close();
                    if (txt.charCodeAt(0) === 0xFEFF) { txt = txt.substring(1); }
                    var data = jsonParseSlots(txt);
                    for (i = 0; i < SLOT_COUNT; i++) {
                        k = SLOT_KEYS[i];
                        presetsCache[k] = data.slots[k] ? data.slots[k] : null;
                    }
                }
            } catch (e) { try { f.close(); } catch (e2) {} }
        }
        updateSlotLoadBtns(pal);
    }

    function writeSlotsToStorage() {
        var f = getPresetFile();
        if (!f) { return false; }
        try {
            f.encoding = "UTF-8";
            if (!f.open("w")) { return false; }
            f.write(slotsToJson(presetsCache));
            f.close();
            return true;
        } catch (e) { try { f.close(); } catch (e2) {} return false; }
    }

    // ---- 打开/切换工程时自动重读预设 ----
    // 面板实例在 AE 生命周期内【常驻】, 而"打开工程"往往发生在面板创建【之后】——
    // AE 启动那一刻可能还没有工程(getPresetFile() 返回 null), 初始化那次读取什么也读不到;
    // 等你手动打开工程时面板脚本不会再跑, 于是槽位一直是空的。
    // 修法: 低频轮询"工程预设文件的路径 + 是否存在", 一变就重读; 点槽位按钮前也顺手比对一次。
    var lastProjectKey = "";
    function projectKey() {
        try {
            var f = getPresetFile();
            if (!f) { return ""; }
            return f.fsName + "|" + (f.exists ? "1" : "0");
        } catch (e) { return ""; }
    }
    function watchProject(pal) {
        try {
            var k = projectKey();
            if (k !== lastProjectKey) {
                lastProjectKey = k;
                loadSlotsFromStorage(pal);
            }
        } catch (e) {}
    }
    // 起常驻轮询(scheduleTask 回调只能拿全局函数名, 故先把函数与 pal 暴露到全局)
    function startProjectWatch(pal) {
        try {
            if ($.global.__msWatching) { return; }   // 只起一个
            if (typeof app.scheduleTask !== "function") { return; }
            $.global.__msWatching = true;
            MS_pal = pal;
            MS_watchProject = watchProject;
            app.scheduleTask(
                "if (typeof MS_watchProject === 'function') { MS_watchProject(MS_pal); }",
                1500, true);
        } catch (e) {}
    }

    // 当前面板参数 -> 归一化预设对象(只收集, 不落盘)
    function collectParams(U) {
        return serializePreset({
            n: U.edCount.text,
            auto: U.cbFill.value,
            w: U.edW.text,
            gap: U.edGap.text,
            baseH: U.edBaseH.text,
            baseRatio: U.edBaseline.text,
            ftype: (U.ddFall.selection ? U.ddFall.selection.index : DEFAULTS.ftype),
            mode: (U.ddMode.selection ? U.ddMode.selection.index : DEFAULTS.mode),
            r: U.edR.text,
            pts: U.edPoints.text,
            ph: U.edPH.text,
            edge: U.edEdge.text
        });
    }

    // 预设对象 -> 回填面板控件(载入统一走"改控件", 不触发其它副作用)
    function applyParamsToUI(U, p) {
        if (!p) { return; }
        U.edCount.text = String(p.n);
        U.cbFill.value = !!p.auto;
        U.edW.text = String(p.w);
        U.edGap.text = String(p.gap);
        U.edBaseH.text = String(p.baseH);
        U.edBaseline.text = String(p.baseRatio);
        U.edR.text = String(p.r);
        U.edPoints.text = String(p.pts);
        U.edPH.text = String(p.ph);
        U.edEdge.text = String(p.edge);
        if (p.ftype >= 0 && p.ftype < U.ddFall.items.length) { U.ddFall.selection = U.ddFall.items[p.ftype]; }
        if (p.mode >= 0 && p.mode < U.ddMode.items.length) { U.ddMode.selection = U.ddMode.items[p.mode]; }
    }

    // 复位: 面板回默认参数(serializePreset(null) 即全 DEFAULTS 表),
    // 复用「使用」同一条回填路径, 不另写一套赋值
    function resetInputs(pal, U) {
        applyParamsToUI(U, serializePreset(null));
        setStatus(pal, "已复位为默认参数。", C_OK);
    }

    // 存储: 面板 -> 槽位(内存 + 写工程目录 JSON)
    function saveSlot(pal, U, idx) {
        try {
            if (!getPresetFile()) {
                setStatus(pal, "请先保存工程(Ctrl+S)再存预设 —— 预设文件跟随工程目录。", C_WARN);
                return;
            }
            presetsCache[String(idx)] = collectParams(U);
            if (writeSlotsToStorage()) {
                updateSlotLoadBtns(pal);
                setStatus(pal, "已存储到预设槽 " + idx + " → 工程目录 " + PRESET_FILE_NAME, C_OK);
            } else {
                setStatus(pal, "写入预设文件失败(请在 AE 首选项里开启「允许脚本写入文件」)", C_ERR);
            }
        } catch (e) {
            setStatus(pal, "存储预设失败: " + e.toString(), C_ERR);
            showDebugError(e, "存储预设");
        }
    }

    // 使用: 槽位 -> 回填面板(不自动生成, 由用户确认后再点生成, 避免误毁当前合成)
    function loadSlot(pal, U, idx) {
        try {
            watchProject(pal);   // 双保险: 万一轮询没跑到, 点按钮前也比对一次工程
            var p = presetsCache[String(idx)];
            if (!p) { setStatus(pal, "预设槽 " + idx + " 是空的(先点「存储」)。", C_WARN); return; }
            applyParamsToUI(U, p);
            setStatus(pal, "已应用预设槽 " + idx + " — 点「生成 / 重建」生效。", C_OK);
        } catch (e) {
            setStatus(pal, "应用预设失败: " + e.toString(), C_ERR);
            showDebugError(e, "应用预设");
        }
    }

    function clearAllSlots(pal) {
        try {
            resetSlots(presetsCache);
            if (writeSlotsToStorage()) {
                updateSlotLoadBtns(pal);
                setStatus(pal, "已清除全部预设。", C_OK);
            } else {
                setStatus(pal, "写入预设文件失败。", C_ERR);
            }
        } catch (e) {
            setStatus(pal, "清空失败: " + e.toString(), C_ERR);
            showDebugError(e, "清空预设");
        }
    }

    // 打开系统文件对话框时把【起始目录】设为工程所在目录。
    //
    // 官方文档依据(extendscript.docsforadobe.dev · File Object):
    //   类方法  File.saveDialog(prompt[, preset=""])  —— 签名里【只有两个参数】, 没有目录参数。
    //           (参数表第 2 项写的是 filter, "Windows only", 属文档自相矛盾处;
    //            但无论按哪种解释, 都【不存在】第 3 个"目录"参数。)
    //   ⇒ 上一版给 File.saveDialog 传第 3 个参数(完整路径)属未文档化用法, 不可依赖。
    //   实例方法 fileObj.saveDlg([prompt][, preset]) —— 文档原文:
    //     "Differs from the class method saveDialog() in that it presets the current folder
    //      to this File object's parent folder and the file to this object's associated file."
    //   ⇒ 正确做法: 造一个指向「工程目录下预设文件」的 File 对象, 调它的【实例方法】。
    //     这样起始目录 = 该文件的父目录(= 工程目录), 文件名也预填为该文件名。
    //     openDlg() 同理("presets the current folder to this File object's parent folder")。
    //   ⇒ 所以【导出与导入都能默认到工程目录】, 上一版说"导入没有目录参数、绕不过去"是错的。
    // 工程尚未保存(getPresetFile() 返回 null)时回退到类方法(起始目录交给系统记忆)。
    var DIALOG_FILTER = "JSON:*.json";
    function pickSaveTarget(prompt) {
        var pf = getPresetFile();
        if (pf) {
            try { return pf.saveDlg(prompt, DIALOG_FILTER); } catch (e1) {}
        }
        return File.saveDialog(prompt, DIALOG_FILTER);
    }
    function pickOpenTarget(prompt) {
        var pf = getPresetFile();
        if (pf) {
            try { return pf.openDlg(prompt, DIALOG_FILTER); } catch (e1) {}
        }
        return File.openDialog(prompt, DIALOG_FILTER);
    }

    // 导出: 另存独立 .json, 跨工程复用。对话框起始目录 = 工程所在目录
    function exportSlots(pal) {
        try {
            if (!getPresetFile()) { setStatus(pal, "请先保存工程(Ctrl+S)再导出。", C_WARN); return; }
            var f = pickSaveTarget("导出预设槽");
            if (!f) { return; }
            f.encoding = "UTF-8";
            if (!f.open("w")) { setStatus(pal, "导出失败(无法写入该文件)。", C_ERR); return; }
            f.write(slotsToJson(presetsCache));
            f.close();
            setStatus(pal, "已导出预设槽 → " + f.name, C_OK);
        } catch (e) {
            setStatus(pal, "导出失败: " + e.toString(), C_ERR);
            showDebugError(e, "导出预设");
        }
    }

    // 导入: 选 .json, 只覆盖其中非空槽位(空槽不冲掉现有值)。起始目录 = 工程所在目录
    function importSlots(pal) {
        try {
            var f = pickOpenTarget("导入预设槽");
            if (!f) { return; }
            f.encoding = "UTF-8";
            if (!f.open("r")) { setStatus(pal, "读取失败(无法打开该文件)。", C_ERR); return; }
            var txt = String(f.read());
            f.close();
            if (txt.charCodeAt(0) === 0xFEFF) { txt = txt.substring(1); }
            var data = jsonParseSlots(txt);
            var n = 0;
            for (var i = 0; i < SLOT_COUNT; i++) {
                var k = SLOT_KEYS[i];
                if (data.slots[k]) { presetsCache[k] = data.slots[k]; n = n + 1; }
            }
            // 写盘可能失败(工程未保存): 如实提示, 不谎报成功
            var saved = writeSlotsToStorage();
            updateSlotLoadBtns(pal);
            if (n < 1) {
                setStatus(pal, "该文件里没有可用的预设槽(格式不符)。", C_WARN);
            } else if (saved) {
                setStatus(pal, "已导入 " + n + " 个预设槽。", C_OK);
            } else {
                setStatus(pal, "已导入 " + n + " 个预设槽(仅本次会话有效: 工程未保存, 写不进预设文件)。", C_WARN);
            }
        } catch (e) {
            setStatus(pal, "导入失败: " + e.toString(), C_ERR);
            showDebugError(e, "导入预设");
        }
    }

    // ---------- UI 宽度钉死工具 ----------
    // ScriptUI 坑: edittext / 多行 statictext 一旦赋 .text, 首选宽度会【跟着内容重算】——
    //   characters 只给初值, 压不住; 再叠加 layout.resize() 就会让面板"弹宽"。
    //   (点「使用」回填预设时最明显: 同时改了多个输入框的文本 + 触发状态栏刷新)
    // 修法: 建控件时把宽度钉死到 preferredSize / minimumSize / maximumSize 三处,
    //       并把状态栏文本也钉住(让它换行而不是撑宽); 同时 setStatus 不再调 layout.resize()。
    function pinW(ctrl, w) {
        if (!ctrl || !w) { return; }
        // ⚠️ 高度一律传 -1(自动), 【绝不】读回 ctrl.preferredSize.height 再写回 ——
        //    控件刚建、尚未首次布局时该值不可靠(可能为 0 或 -1), 会把高度一起钉成 0。
        //    官方文档依据(extendscript.docsforadobe.dev · Size and location objects):
        //      "A preferredSize of -1 causes the size to be calculated automatically."
        // ⚠️ 三处都要写, 不能只写 preferredSize —— Adobe 官方社区(Marc Autret, 采纳答案):
        //    "preferredSize is a 'volatile' property of the ScriptUI widgets, it is lost on
        //     the first layout. So I think you need to play with minimumSize instead."
        try { ctrl.preferredSize = [w, -1]; } catch (e) {}
        try { ctrl.minimumSize = [w, 0]; } catch (e2) {}
        try { ctrl.maximumSize = [w, 10000]; } catch (e3) {}
    }

    var BOX_CHAR_W = 7;   // 每字符估算宽(px)
    // 数字输入框: 固定宽度(内容再长也只在框内滚动, 不改变布局)
    // characters 也要一起给 —— 官方文档(EditText): "A number of characters for which to
    // reserve space when calculating the preferred size of the element." 框架自算宽度时用它。
    function numBox(parent, chars, val) {
        var e = parent.add("edittext", undefined, val);
        e.characters = chars;
        pinW(e, chars * BOX_CHAR_W + 14);
        return e;
    }

    // ---------- UI 层 ----------
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "山峰频谱", undefined, { resizeable: false });

    pal.orientation = "column";
    pal.alignChildren = "fill";
    pal.spacing = 8;
    pal.margins = 12;

    var U = {};

    // 排列
    var p1 = pal.add("panel", undefined, "排列");
    p1.orientation = "column";
    p1.alignChildren = "fill";
    var r1 = p1.add("group");
    r1.orientation = "row";
    r1.alignChildren = "center";
    r1.add("statictext", undefined, "数量:");
    U.edCount = numBox(r1, 4, String(DEFAULTS.n));
    r1.add("statictext", undefined, "矩形宽:");
    U.edW = numBox(r1, 4, String(DEFAULTS.w));
    r1.add("statictext", undefined, "间距:");
    U.edGap = numBox(r1, 4, String(DEFAULTS.gap));
    U.cbFill = p1.add("checkbox", undefined, "自动铺满合成宽度(勾选后忽略「数量」)");
    U.cbFill.value = DEFAULTS.auto;

    // 高度
    var p2 = pal.add("panel", undefined, "高度");
    p2.orientation = "column";
    p2.alignChildren = "fill";
    var r2 = p2.add("group");
    r2.orientation = "row";
    r2.alignChildren = "center";
    r2.add("statictext", undefined, "基础高度:");
    U.edBaseH = numBox(r2, 4, String(DEFAULTS.baseH));
    r2.add("statictext", undefined, "基线(%合成高):");
    U.edBaseline = numBox(r2, 3, String(DEFAULTS.baseRatio));
    // 第二行: 两个"高度"相关参数(与图层效果控件里的同名滑块一一对应, 改完立即生效)
    var r2b = p2.add("group");
    r2b.orientation = "row";
    r2b.alignChildren = "center";
    r2b.add("statictext", undefined, "点位高度:");
    U.edPH = numBox(r2b, 4, String(DEFAULTS.ph));
    r2b.add("statictext", undefined, "边缘高度%:");
    U.edEdge = numBox(r2b, 3, String(DEFAULTS.edge));

    // 起伏
    var p3 = pal.add("panel", undefined, "起伏");
    p3.orientation = "column";
    p3.alignChildren = "fill";
    var r3 = p3.add("group");
    r3.orientation = "row";
    r3.alignChildren = "center";
    r3.add("statictext", undefined, "起伏曲线:");
    U.ddFall = p3.add("dropdownlist", undefined, ["余弦", "高斯", "线性", "二次"]);
    U.ddFall.selection = DEFAULTS.ftype;
    var r4 = p3.add("group");
    r4.orientation = "row";
    r4.alignChildren = "center";
    r4.add("statictext", undefined, "叠加方式:");
    U.ddMode = p3.add("dropdownlist", undefined, ["叠加(求和)", "取最高"]);
    U.ddMode.selection = DEFAULTS.mode;
    // 影响范围 + 点数 合并在一行(与仓库面板一样紧凑); 单位说明放在下方提示里
    var r5 = p3.add("group");
    r5.orientation = "row";
    r5.alignChildren = "center";
    r5.add("statictext", undefined, "影响范围(根):");
    U.edR = numBox(r5, 4, String(DEFAULTS.r));
    r5.add("statictext", undefined, "点数:");
    U.edPoints = numBox(r5, 3, String(DEFAULTS.pts));

    // 按钮
    var b1 = pal.add("group");
    b1.alignment = "fill";
    var btnGen = b1.add("button", undefined, "生成 / 重建");
    var btnPts = b1.add("button", undefined, "重设点位");
    var b2 = pal.add("group");
    b2.alignment = "fill";
    var btnRnd = b2.add("button", undefined, "随机波峰");
    var btnClr = b2.add("button", undefined, "清理");

    // 预设管理: 排版对齐仓库既有做法(AE-Lyrics-Animator / QuickKey 两处一致)——
    //   存储 1-4 | 清除全部
    //   使用 1-4 | 复位
    //   导出配置 | 导入配置
    var pPre = pal.add("panel", undefined, "预设管理(存于工程目录)");
    pPre.orientation = "column";
    pPre.alignChildren = ["fill", "top"];
    pPre.spacing = 4;

    var saveRow = pPre.add("group");
    saveRow.orientation = "row";
    saveRow.alignChildren = ["left", "center"];
    saveRow.spacing = 4;
    var sLbl = saveRow.add("statictext", undefined, "存储");
    sLbl.preferredSize.width = 40;
    for (var pi = 1; pi <= SLOT_COUNT; pi++) {
        // IIFE 捕获槽位号(1-based) —— 与仓库同款写法, 规避槽位 key 错位
        (function (idx) {
            var b = saveRow.add("button", undefined, String(idx));
            b.preferredSize.width = 28;
            b.onClick = function () { saveSlot(pal, U, idx); };
        })(pi);
    }
    var btnSlotClear = saveRow.add("button", undefined, "清除全部");
    btnSlotClear.onClick = function () { clearAllSlots(pal); };

    var loadRow = pPre.add("group");
    loadRow.orientation = "row";
    loadRow.alignChildren = ["left", "center"];
    loadRow.spacing = 4;
    var lLbl = loadRow.add("statictext", undefined, "使用");
    lLbl.preferredSize.width = 40;
    for (var pj = 1; pj <= SLOT_COUNT; pj++) {
        (function (idx) {
            var b2 = loadRow.add("button", undefined, String(idx));
            b2.preferredSize.width = 28;
            b2.enabled = false;   // 空槽位禁用, 由 updateSlotLoadBtns 按缓存启停
            b2.onClick = function () { loadSlot(pal, U, idx); };
            gSlotLoadBtns.push(b2);
        })(pj);
    }
    var btnSlotReset = loadRow.add("button", undefined, "复位");
    btnSlotReset.onClick = function () { resetInputs(pal, U); };

    var ioRow = pPre.add("group");
    ioRow.orientation = "row";
    ioRow.alignChildren = ["left", "center"];
    ioRow.spacing = 4;
    var btnSlotExp = ioRow.add("button", undefined, "导出配置");
    btnSlotExp.onClick = function () { exportSlots(pal); };
    var btnSlotImp = ioRow.add("button", undefined, "导入配置");
    btnSlotImp.onClick = function () { importSlots(pal); };

    // 提示
    var tip = pal.add("statictext", undefined,
        "改完立即生效(无需重新生成): 影响范围 / 点位高度 / 边缘高度%。"
        + "「影响范围」= 影响几根竖条;「点位高度」= 峰高 px(0 = 自动跟随点位 Y)。"
        + "【左右边界】直接拖「山峰点 k 左」「山峰点 k 右」两个空对象: 拖哪个改哪一侧,"
        + "两边可以不一样宽(左缓右陡)。删掉某一侧 = 该侧回退成「影响范围」的对称宽度。"
        + "一个波峰 = 一组 3 个控制点(峰 + 左 + 右), M 个波峰 = M 组。"
        + "「边缘高度%」= 窗口最边缘那根保留【地板之上可用高度】的百分比:"
        + "100% = 窗口内全平(矩形窗, 根数最准但边缘硬切);0% = 边缘渐隐到零(山形最柔但边缘看不见);"
        + "默认 10% 兼顾(v0.9.0 起衰减作用在地板之上, 所以范围内每一根都保证高于基础高度)。"
        + "【最高高度】拖「山峰 高度」空对象: 它离基线多高, 整排最高柱就多高, 其余各峰等比缩放"
        + "(形状不变)。拖到基线 = 整排压平;删掉这一层 = 关闭总闸。"
        + "状态栏会回报【实际可见根数 | 最高高度】。"
        + "行位置 = 拖「山峰 柱」图层;改「数量」需重新生成。", { multiline: true });
    pinW(tip, 320);

    // 状态
    var sp = pal.add("panel", undefined, "状态");
    sp.alignChildren = "fill";
    pal.status = sp.add("statictext", undefined,
        "就绪 — 打开合成后点「生成 / 重建」。", { multiline: true });
    pal.status.alignment = ["fill", "center"];
    pinW(pal.status, 320);

    // 「影响范围」改完即生效: 直接把面板值推给所有已有点位, 不必再点「重设点位」。
    // (onChange 在回车或焦点离开时触发, 与 AE 输入框的常规行为一致)
    U.edR.onChange = function () {
        var n = pushInfluenceToPoints(pal, U);
        if (n > 0) {
            setStatus(pal, "影响范围已推给 " + n + " 个点位, 立即生效。"
                + visibleCountHint(getComp()), C_OK);
        } else if (n === 0) {
            setStatus(pal, "还没有生成点位, 请先点「生成 / 重建」。", C_WARN);
        } else {
            setStatus(pal, "影响范围需为数字(填 0 = 自动推算)。", C_WARN);
        }
    };

    // 「点位高度」改完即生效: 推给所有已有点位(0 = 自动)
    U.edPH.onChange = function () {
        var n = pushPointHeight(pal, U);
        if (n > 0) {
            setStatus(pal, "点位高度已推给 " + n + " 个点位, 立即生效。"
                + visibleCountHint(getComp()), C_OK);
        } else if (n === 0) {
            setStatus(pal, "还没有生成点位, 请先点「生成 / 重建」。", C_WARN);
        } else {
            setStatus(pal, "点位高度需为数字(0 = 自动跟随点位位置)。", C_WARN);
        }
    };

    // 「边缘高度%」改完即生效: 直接写控制器滑块(老工程会自动补建该滑块)
    U.edEdge.onChange = function () {
        var n = pushEdgeToController(pal, U);
        if (n === 1) {
            setStatus(pal, "边缘高度已应用, 立即生效。"
                + visibleCountHint(getComp()), C_OK);
        } else if (n === 0) {
            setStatus(pal, "还没有生成, 请先点「生成 / 重建」。", C_WARN);
        } else {
            setStatus(pal, "边缘高度需为 0~100 的数字。", C_WARN);
        }
    };

    btnGen.onClick = function () { generate(pal, U); };
    btnPts.onClick = function () { resetPoints(pal, U); };
    btnRnd.onClick = function () { randomPeaks(pal, U); };
    btnClr.onClick = function () { cleanAll(pal); };

    // 启动: 读一次工程目录里的预设槽 + 起常驻轮询(之后打开/切换工程会自动重读)
    watchProject(pal);
    startProjectWatch(pal);

    if (pal instanceof Window) {
        pal.preferredSize.width = 340;
        pal.center();
        pal.show();
    } else {
        pal.layout.layout(true);
    }

})(this);
