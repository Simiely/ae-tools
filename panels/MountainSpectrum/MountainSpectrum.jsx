// ============================================================
// 山峰频谱  MountainSpectrum.jsx
// 版本: 1.5.2  (2026-09-20)
// 适用: After Effects 2015.3+ 至 2026 (ExtendScript / ScriptUI)
//
// 功能:
//   一键在当前合成里画出「等距横向排开的矩形」, 再用若干可拖动的波峰控制点控制高度 ——
//   矩形离点越近就越高, 宽度不变, 于是连成一片中间高两侧低的小山丘;
//   波峰加到足够多, 就成了音频波谱的样子。
//
// 核心设计:
//   矩形高度/位置由【表达式】驱动, 不烘焙关键帧 ——
//   生成后拖动控制点、拖控制器滑块都实时生效, 无需重跑脚本。
//
// 产物(全部在同一个 Undo 组内, Ctrl+Z 可整体撤销):
//   1. 形状图层「山峰 柱」        = N 个矩形组(每组一路径 + 组内填充) + 图层级颜色控件
//   2. 空对象「山峰 控制器」      = 6 个滑块(矩形宽/间距/基础高度/叠加方式/起伏曲线/边缘高度%)
//   3. 波峰「山峰点 1【峰】..M【峰】」= 峰, 每个带 1 个滑块「高度」
//   4. 「山峰点 k【左缘】/ k【右缘】」= 左右边缘控制点
//      ⇒ 【一个波峰 = 一组 3 个可拖对象】(峰 + 左 + 右); M 个波峰 = M 组
//   5. 空对象「山峰 总高度闸」    = 总闸: 它离基线多高, 整排最高柱就多高(直接拖它调高度)
//
// 宽度语义(v1.0.0 起【唯一】的宽度控制):
//   左半径 = 峰X − 左边缘点X;   右半径 = 右边缘点X − 峰X   ⇒ 左右独立, 可不对称
//   某一侧边缘点被删 -> 该侧用【自动半径】(由 数量/矩形宽/间距/点数 推算, 见 autoRadiusFor)
//   边缘点拖到峰的【另一侧】-> 该侧半径为负 -> 钳 0, 相当于关掉这一侧
//   面板「均分边缘点」= 按自动半径一键摆齐所有波峰的左右边界
//
// 参数生效时机(在参数表 PARAM_SPECS 里逐个声明, UI 与推送全部由它派生):
//   改完立即生效 : 矩形宽 / 间距 / 基础高度 / 基线(%合成高) / 起伏曲线 / 叠加方式 /
//                  点位高度 / 边缘高度%
//   需重新生成   : 数量 / 自动铺满 / 点数  —— 结构性参数(增删图层/矩形组), 改完会明确提示
//
// 点位语义:
//   X = 峰在哪(水平位置), Y = 峰多高(基线以上),
//   高度 = 该点峰高的绝对值(px, 基线以上); 0 = 自动(用"基线 − 点位Y")。
//
// 总闸「山峰 总高度闸」(v0.7.0):
//   它是一个普通空对象, 存在的唯一理由是【让高度也能靠拖点控制】。
//   拖它 -> 整排等比缩放到"最高那根 = 它离基线的高度", 各峰相对高矮保留、形状不变。
//   它不存在 / 被删掉 -> 总闸关闭, 完全回到"各点位用自己高度"的旧行为(向后兼容)。
//   ⚠️ 总闸一开, 各点位的「高度」就【退化为相对权重】—— 填 400 不再意味着绝对 400px,
//      而是"这一个峰相对其他峰高多少"。想让某根固定成绝对高度, 就把它调成最高那根,
//      再拖总闸到目标值。
//
// ⚠️ 两条必须说清的事实:
//   ① "窗口内" ≠ "一定看得见" —— 贡献 = (峰高 − 基础高度) × 衰减(t), 其中 t = 距离/半径。
//      v0.9.0 起衰减作用在【地板之上】的区间, 于是只要「边缘高度%」> 0, 窗口内每一根都
//      保证高过基础高度 ⇒ 窗口根数 = 可见根数。状态栏会回报【实际可见根数】。
//   ② 基础高度是【加法基线】而不是"钳制上限": 柱子高度 = 基础高度 + 超出量。
//      负的基础高度一律按 0 处理(控制器滑块能被拖成负数; 不钳会算出负高度 -> 矩形翻转渲染)。
//
// v1.5.3 默认颜色可见化(用户需求:「默认颜色需要修改为白色ffffff」):
//   - 生成链路的默认值本就是 [1,1,1,1] = #FFFFFF, 无需改值;
//   - 但按钮初始文字是「选色…」, 不打开工程看不到默认色 -> 初始文字直接显示「#FFFFFF」,
//     面板一打开就能确认默认色; 打开工程后仍从合成读回实际颜色(行为不变)。
//
// v1.5.2 修 v1.5.1 的取色器崩溃(AE 报「UI element type 'colorpicker' is unknown or invalid
//          in this context」—— ScriptUI colorpicker 控件在 AE 的 ScriptUI Panels 里不可用):
//   - 改用按钮 + AE 原生 $.colorPicker() 取色, 按钮文字实时显示当前颜色 hex
//   - 其余行为不变: 默认白色 / 实时推送「矩形颜色」/ 生成后与启动时从合成读回
//
// v1.5.1 柱子颜色(用户需求:「可以修改柱子的颜色。默认使用白色。」):
//   - 默认填充色 #FF9292 -> 白色
//   - 面板新增「柱子颜色」取色器: onChange 实时推送形状图层上的「矩形颜色」Color Control
//     (图层缺效果时顺手补建); 生成后/面板启动时从合成读回, 取色器显示与实际不脱节
//   - 不进参数表/预设(颜色走图层效果, 跟随工程保存), 兼容个别 AE 版本 colorpicker.value 为 hex 字符串
//
// v1.5.0 空间羽化带(用户反馈:「3 帧缓冲似乎没生效……改成把边缘点扩展为一个宽度的范围, 带内线性变化」):
//   - 取代 v1.4.0 的时间帧缓冲 —— 那个方案只对"点位有关键帧动画"有意义, 静态时 fOut 恒定无效;
//     而用户看到的跳变是【相邻两根柱】的空间高度差, 时间缓冲治不了
//   - 新参数「边缘过渡(根)」(默认 3, 0 = 硬边界): 边缘点从"一个点"扩展为"点 + 羽化带",
//     带内所有柱(含节奏条)高度线性过渡 —— 业界标准 feather 做法(同 WaveLab 选区羽化 / FFT 窗函数)
//   - 普通柱: 衰减窗口扩展进羽化带, 山脚从 baseH+effH×edge 线性收到 baseH(消除 edge% 边界跳变)
//   - 节奏条: 山内核心(liftC>0)跟随轮廓; 带内从边界轮廓值线性过渡到独自地板; 带外独自高
//   - 纯函数 pointContribution/pointBand/barHeightAt 与表达式严格镜像; 等价性测试覆盖 fw=0/3
//
// v1.4.0 帧缓冲(已弃用, 被 v1.5.0 空间羽化取代; 用户反馈:「长的变短是在某个临界点一瞬间变化, 需要帧数缓冲, 比如 3 帧之后变成
//          符合山形状的, 可以自己选是几帧」):
//   - 控制器新增滑块「节奏缓冲帧」(面板「节奏」分组, 默认 3, 0 = 关即 v1.3.2 瞬切)
//   - 节奏条在山内/山外切换时不再瞬切: 统计当前帧与过去 bufN 帧里「山外」的占比 fOut,
//     柱高 = 山丘轮廓 + (独自高 − 轮廓) × fOut —— 切换后 bufN 帧内线性过渡, 稳态两端不变
//   - 过去帧采样 = 点位位置/高度 valueAtTime; 边缘点半径/控制器滑块/总闸用当前值(近似换性能)
//   - 纯函数保持稳态口径(与 bufN 关闭等价); 表达式 ↔ 纯函数等价性测试用静态 mock 自动覆盖
//
// v1.3.2 节奏条再修正(用户截图二次反馈:「还是超出了」—— 山坡上轮廓 < 地板处 v1.3.0 的 max 仍戳出):
//   - 口径改为【山内完全跟随山丘轮廓】: lift > 0(在某点位窗口内) -> 节奏条 = baseH+lift,
//     与邻居同高零戳出; lift = 0(山外) -> 节奏条 = 节奏地板, 独自高
//   - 窗口内 t≤1 且 edgeKeep>0 时贡献恒 > 0, 故 lift>0 ⟺ 在山内, 判定干净无歧义
//   - 纯函数 barHeightAt 与表达式模板两处严格镜像
//
// v1.3.1 UI 改进(用户反馈:「节奏条开关是输入数字 0 和 1, 应该改成选择框」):
//   - 节奏条开关从数字输入框(kind:"num")改为【复选框】(kind:"bool"), 面板「节奏」分组末尾整行显示
//   - 控制器上的滑块仍是数值 0/1(表达式口径不变); 复选框 onChange 经 pushParam 写滑块时
//     布尔经 sliderVal() 转 1/0 —— Slider Control.setValue(布尔) 在部分 AE 版本会抛错
//   - 旧预设里 rhyOn 存的 0/1 由 pickBool 兼容读取; 控制器缺滑块的旧工程照旧"顺手补建"
//
// v1.3.0 节奏条平滑化(用户反馈: 山内轮廓被节奏条戳成锯齿, 应"像没有格外高度一样平滑"):
//   - 结合公式从"固定增量"(节奏地板+抬升)改为【取大压缩】max(普通柱高度, 节奏地板) ——
//     山内节奏条与邻居同高, 轮廓 = 纯山丘; 山外恢复独自高; 交界 max 连续无跳变
//   - 纯函数 barHeightAt 与表达式模板两处严格镜像; 测试不变量改为 h_开 = max(h_关, 地板)
//   - 可见性口径不变: 节奏柱(>100%)仍恒可见(山内被山抬起、山外本来就更高)
//
// v1.2.0 命名优化(用户反馈:「空对象的名称需要优化, 不太好分辨」):
//   - 峰 =「山峰点 k【峰】」; 左/右边缘 =「山峰点 k【左缘】/【右缘】」(角色词【】括注, 编号在前)
//   - 控制器「山峰 控制」->「山峰 控制器」; 总闸「山峰 高度」->「山峰 总高度闸」
//   - 五类对象各配一种图层标签色: 峰=黄 左缘=蓝 右缘=绿 控制器=紫 总高度闸=红
//     (时间轴左侧色块直接分组, 不用逐个读名字)
//   - 前缀「山峰点 」不动: parseInt/cleanup 逻辑原样成立, 旧合成点「生成/重建」即换新名
//
// v1.1.2 修复(用户报 AE 两个弹窗:「行 1871 应为:)」+「模态对话框等待时无法运行脚本」):
//   - 模态错误弹窗里的「复制全部」改回手动 Ctrl+A/C 指引 —— executeCommand 在模态
//     等待期会被 AE 拒绝, 这是报错②的触发链; 自动复制只在非模态调试区保留
//   - scheduleTask 轮询 1500ms -> 3000ms(降低与模态状态撞车频率)
//   - 「行 1871 应为:)」: 当前文件经 node --check / espree ES5 / Rhino ES3 四档编译 /
//     保留字三重扫描全部通过, 行 1871 本身为干净代码 —— 最可能是 AE 在写入过程中
//     加载了截断副本; 已重新部署完整副本, 重启 AE 即可判定
//
// v1.1.1 新增调试输出区(用户报:「需要加入 debug 信息, 可以复制粘贴的那种。现在点击没有反应」):
//   - 根因: AE 的 ScriptUI handler 抛错【完全静默】(没有控制台), 预设按钮/启动代码/onChange
//     当时都没有 try/catch —— 出错就是"点击没反应"。
//   - 照 NumCounter 先例补全: gDiag 缓冲 + 面板「调试输出」区(只读) + 「复制」按钮
//     (app.executeCommand 23 全选 / 19 复制, 仓库真机验证过的剪贴板方案);
//     showDebugError 对话框补「复制全部」按钮
//   - 新增「诊断」按钮: 一次性把 AE 版本/工程/合成/图层在不在/滑块值/面板参数写进输出区
//   - 全部按钮 handler 走 safeRun 统一兜底; onChange 与面板启动代码同样兜底
//
// v1.1.0 新增节奏条(用户需求:「增加一个开关控制, 打开之后, 可以选择每几个竖线有一个更高的竖线;
//          进入到放大区域的时候, 让它像普通竖线一样放大, 保证流线型; 出去的时候恢复独自高一些」):
//   - 控制器新增 3 个滑块: 节奏条开关(默认 0=关) / 节奏间隔(默认 8) / 节奏条高度%(默认 180)
//   - 结合公式 v1.3.0 起改为【取大压缩】(用户反馈山内轮廓被节奏条戳成锯齿):
//     柱高 = max(普通柱高度 baseH+抬升, 节奏地板) ——
//     山内节奏条与邻居同高(轮廓 = 纯山丘, 像没有格外高度一样平滑, 参考截图);
//     山外抬升=0 -> 节奏条 = baseH×高度%(独自高); 交界处 max 连续无跳变。
//     (v1.1.0 的旧口径是"固定增量": 节奏地板+抬升, 山内会戳出一截 —— 已弃用;
//      floor 不高于普通柱地板时仍走旧口径, 向后兼容。)
//   - 数学依据: 调幅(AM)的两种形态中, "图案×增益"会成倍戳出包络, "包络+固定偏移"保流线型 ——
//     见 CUHK ELEG2310 讲义 s(t)=[1+k·m(t)]c(t) 与 ScienceDirect《DSP》Ch.10 对相加失真的说明。
//   - 产物交互: 三个参数走 PARAM_SPECS(mode:"ctrl"), 面板「节奏」分组实时可调, 预设自动携带。
//
// v1.0.0 重构(依据 `MountainSpectrum-架构审计报告.md` 的实测结论):
//   【P0-1 死参数】删除点位「影响范围」与控制器「影响范围倍率%」——
//     实测: 有边缘点时, 影响范围 = 1/9/30 或倍率 = 0/100/500 时, 40 根柱子的高度序列
//     【完全相同】。根因是 resolvePoints / buildExprCore 里算出 rSym 后又被边缘点距离覆盖。
//   【P0-2 语义错位】面板「影响范围」实际做的是"把两侧边缘点对称重摆", 会静默抹掉用户
//     刚拖出的左右不对称。替代品 = 面板「均分边缘点」按钮 + 直接拖边缘点。
//   【P0-3 kNN 落空】v0.5.0 的 kNN 精确半径在默认流程里被绕过(摆边缘点用的是 Δ=0.5 的
//     保守估计), 实测填 2/4/6/8/10/12/14 会得到 1/3/5/7/9/11/13 根 —— 15 档里 7 档偏离。
//     既然它已经不生效, 就不再保留这个"看起来能精确指定根数"的入口。
//   【P1-1 生效时机不可见】把 8 个参数做成改完【立即生效】(写控制器滑块 / 推点位 / 移动
//     图层), 3 个结构性参数(数量/自动铺满/点数)在 UI 上明确标注需重新生成。
//   【P1-2 Shotgun Surgery】新增参数表 PARAM_SPECS —— 以前加一个参数要手工改 5~7 处
//     (默认值表/预设键/读面板/存预设/填面板/建 UI/表达式/推送); 现在只声明一次,
//     其余全部派生。同时把"面板→参数"与"面板→预设"合并为同一条路径(6 条读写路径变 5 条)。
//   【P2-1 负基础高度分叉】纯函数 combineHeights 把负地板当 0, 而表达式算 eff = pk − baseH
//     会得到负高度 —— 实测 10/30 组分叉。现在两侧都钳到 ≥ 0, 并写了逐根比对断言。
//   【P2-2 魔数漂移】0.22 改用 HGT_DEF_RATIO; visibleCountHint 的回退值改用 DEFAULTS。
//   【P2-3 静默失败】syncEdgeX 改为返回实际摆动个数, 调用方据此把"边缘点缺失"报到状态栏。
//   【P3 文档卫生】测试文件小节编号重排(旧文件缺六七八且"十"重复两次)。
//   预设升 v4: 删掉 r 字段; 读到 v1~v3 的槽位自动忽略 r, 其余字段照常归一化(非破坏性)。
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
//   ⚠️ 副作用(如实说明): 范围边界会出现一道台阶 —— 范围内最低 = 地板 + 可用高度×e,
//     范围外 = 地板。e 越小台阶越轻; e=0 时无台阶, 但边缘恰好落在地板上(看不见)。
//     这是"圈定范围"这个契约的固有代价, 不是实现缺陷。
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
//   每个波峰配两个空对象「山峰点 k【左缘】」「山峰点 k【右缘】」, 拖它们的 X 定山丘左右边界 ——
//   取代了原先"一个「影响范围」管左右对称宽度"的限制, 现在两边独立。
//   命名复用 PT_PREFIX 前缀【是安全的】: countPoints 用 parseInt 取编号, 而 parseInt("1【峰】") === 1
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
    var LAYER_CTRL = "山峰 控制器";
    var PT_PREFIX  = "山峰点 ";
    // 总闸「山峰 总高度闸」: 一个普通的空对象, 它离基线多高, 整排最高柱就多高。
    //   存在的意义 = 让高度也能【靠拖点】控制(和峰的位置一样直观), 而不是只能填数字。
    //   拖它 = 整座山等比长高/变矮, 形状不变; 各点位之间的高矮差别仍然保留。
    var LAYER_HGT  = "山峰 总高度闸";
    var HGT_DEF_RATIO = 0.22;   // 默认最高高度 = 合成高 × 22%(与点位默认峰高一致)
    var GROUP_PREFIX = "柱 ";
    var RECT_NAME  = "矩形路径 1";

    var SL_W     = "矩形宽";
    var SL_G     = "间距";
    var SL_BASE  = "基础高度";
    var SL_MODE  = "叠加方式";   // 0=叠加(求和) 1=取最高
    var SL_FTYPE = "起伏曲线";   // 0=余弦 1=高斯 2=线性 3=二次
    var SL_H     = "高度";       // 每个点位的峰高(px, 基线以上); 0 = 自动(跟随点位 Y)
    // ---------- 宽度控制: 左右边缘点(v0.8.0 引入, v1.0.0 起是【唯一】的宽度控制) ----------
    // 每个点位配两个空对象「山峰点 k【左缘】」「山峰点 k【右缘】」, 拖它们的 X 定山丘左右边界。
    //   左半径 = 峰X − 左边缘X;  右半径 = 右边缘X − 峰X  ⇒ 两边可以不对称
    //   (左边缓右边陡 = 音频里的 attack/decay 不同, 反之亦然)。
    // v1.0.0 删除的两个参数(审计结论, 见 DEVELOPMENT.md「宽度为什么只剩一条链路」):
    //   · 点位「影响范围」滑块     —— 有边缘点时被静默覆盖, 赋值后不参与结果
    //   · 控制器「影响范围倍率%」  —— 同上, 且面板无入口、提示不提, 更隐蔽
    //   替代品: 面板「均分边缘点」按钮(按自动值一键摆齐) + 直接拖边缘点。
    // v1.2.0 命名优化(用户反馈「空对象名称不太好分辨」):
    //   峰 =「山峰点 k【峰】」, 左/右边缘 =「山峰点 k【左缘】/【右缘】」 ——
    //   角色词用【】括注跟在编号后, 扫一眼就知道这一层是干什么的。
    //   前缀 PT_PREFIX 仍不动: countPoints 的 parseInt("1【峰】") === 1 照样成立
    //     (遇非数字即停), 所以边缘点不会被误数成峰; findLayer 是精确匹配, 也不会误命中;
    //     cleanup 用 indexOf(PT_PREFIX) === 0 判断删除, 边缘点会自动跟着被清理。
    //   配套: 五类对象各配一种【图层标签色】, 时间轴左侧色块直接分组。
    //   ⚠️ 旧工程(带旧名「山峰点 k」「山峰 控制」)里旧图层名不会被新代码按精确名找到 ——
    //      面板对旧合成的「重设点位 / 均分边缘点 / 实时改参」会退化, 建议对旧合成点一次
    //      「生成 / 重建」(cleanup 会按前缀清掉旧点位再建新名)。
    var PT_PEAK_SUFFIX = "【峰】";
    var PT_L_SUFFIX = "【左缘】";
    var PT_R_SUFFIX = "【右缘】";

    // 图层标签色(AE 标签 1..16, 对应用户首选项里的色板顺序):
    //   峰=2黄  左缘=8蓝  右缘=9绿  控制器=10紫  总高度闸=1红
    var LABEL_PEAK  = 2;
    var LABEL_LEFT  = 8;
    var LABEL_RIGHT = 9;
    var LABEL_CTRL  = 10;
    var LABEL_HGT   = 1;
    var H_DEF      = 0;               // 「高度」缺该滑块时的回退值 = 0(自动, 向后兼容)
    var SL_COLOR = "矩形颜色";   // 图层上的 Color Control, 统一驱动所有组内填充

    var FILL_COLOR = [1, 1, 1, 1];           // v1.5.1 默认白色 (4D RGBA, 必须 4 个分量); 可在面板取色器里改
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
    // 节奏条(v1.1.0): 开关打开后, 每隔「节奏间隔」根竖线有一根更高的竖线。
    //   结合公式 v1.3.0 起为【取大压缩】(旧"固定增量"会把山内轮廓戳成锯齿, 用户反馈弃用):
    //     柱高 = max(baseH + 山丘抬升量, 节奏地板_i)   (普通柱: 节奏地板_i = baseH)
    //   山外抬升=0 -> 节奏条 = baseH×高度% (独自高); 山内节奏条被山丘吞掉(与邻居同高,
    //   轮廓 = 纯山丘无锯齿); 交界处 max 连续无跳变。
    //   开关关 -> 地板恒等于 baseH -> 逐点等于 v1.0.0 的公式(零风险回退)。
    var SL_RHY_ON  = "节奏条开关";
    var SL_RHY_N   = "节奏间隔";
    var SL_RHY_PCT = "节奏条高度%";
    var SL_RHY_FW = "边缘过渡根";
    var RHY_ON_DEF  = 0;      // 默认关: 与 v1.0.0 行为完全一致
    var RHY_N_DEF   = 8;      // 每 8 根一根
    var RHY_PCT_DEF = 180;    // 节奏条 = 基础高度 × 180%
    var RHY_FW_DEF = 3;       // v1.5.0: 边缘羽化带宽度(根) —— 山脚/节奏条在带内线性过渡; 0 = 硬边界(v1.3.2)
    var RHY_FW_MAX = 50;      // 过渡带上限(根)
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
    function pointContribution(bx, px, py, baseY, rPx, type, hExplicit, edgeKeep, rLeftPx, baseH, fw, pitch) {
        var peak = baseY - py;                    // 点在基线以上 → 正 (AE 的 y 向下)
        if (hExplicit > 0) { peak = hExplicit; }
        if (peak <= 0) return 0;
        // 左右不对称: 柱子落在峰的【左侧】时用左半径。
        //   未给 rLeftPx -> 两侧同用 rPx, 即完全对称(向后兼容)。
        var rUse = rPx;
        if (typeof rLeftPx === "number" && bx < px) { rUse = rLeftPx; }
        if (rUse <= 0) return 0;
        var t = Math.abs(bx - px) / rUse;
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
        if (t <= 1) {
            return effH * (e + (1 - e) * falloff(t, type));
        }
        // v1.5.0 边缘羽化带: t ∈ (1, 1+fwT] 线性衰减到 0 —— 山脚无相邻柱跳变(与表达式严格镜像)。
        //   fwT = fw(根) × 柱距 / 半径 —— 带宽按"根数"声明, 随各点半径换算成 t 的长度。
        if (typeof fw !== "number" || !(fw > 0)) { return 0; }
        var fwT = fw * pitch / rUse;
        if (fwT > 2) { fwT = 2; }
        var sF = (t - 1) / fwT;
        if (sF > 1) { return 0; }
        return effH * e * (1 - sF);
    }

    // v1.5.0 羽化带信息: 柱子落在点位羽化带(t ∈ (1, 1+fwT])内时返回 [s, B] ——
    //   s = (t−1)/fwT ∈ (0,1](0 = 紧贴核心边界), B = 边界轮廓值 effH×edge。
    //   节奏条山外过渡用它: 高度 = 独自地板 + (边界轮廓 − 独自地板) × (1 − s)。
    //   不在带内(核心内/带外/无效点)返回 null。与表达式采样严格镜像。
    function pointBand(bx, px, py, baseY, rPx, hExplicit, edgeKeep, rLeftPx, baseH, fw, pitch) {
        var peak = baseY - py;
        if (hExplicit > 0) { peak = hExplicit; }
        if (peak <= 0) { return null; }
        var rUse = rPx;
        if (typeof rLeftPx === "number" && bx < px) { rUse = rLeftPx; }
        if (rUse <= 0) { return null; }
        var t = Math.abs(bx - px) / rUse;
        if (t <= 1) { return null; }
        if (typeof fw !== "number" || !(fw > 0)) { return null; }
        var e = edgeKeepOf(edgeKeep);
        var effH = peak;
        if (typeof baseH === "number" && baseH > 0) {
            effH = peak - baseH;
            if (effH <= 0) { return null; }
        }
        var fwT = fw * pitch / rUse;
        if (fwT > 2) { fwT = 2; }
        var s = (t - 1) / fwT;
        if (s > 1) { return null; }
        return [s, effH * e];
    }

    // ---------- 宽度: 自动半径(v1.0.0) ----------
    // 把「自动影响范围(根数)」换算成像素距离。
    //   delta = 点位相对柱网的相位(0 = 正对某根柱子; 0.5 = 恰好落在两根正中)。
    //   取 0.5 是【最保守】的取法(结果只会多不会少), 用于: ① 生成 / 均分边缘点的初始距离;
    //   ② 某一侧边缘点被删掉时的回退半径。
    //   依据: 各柱到点位的距离(单位=柱距)从小到大排是 Δ, 1-Δ, 1+Δ, 2-Δ, 2+Δ, …
    //         奇数位(第 m 项) = (m-1)/2 + Δ ; 偶数位 = m/2 - Δ
    //   ⚠️ 末尾 (1 + 1e-9) 是抗浮点误差的必需项: k×柱距 常算出 …4999999997 而边界柱恰在 …5,
    //      不放大一点就会漏掉那根(实测过: 填 9 只得到 8 根)。
    // 注: 这只是"自动值"。真正的宽度永远是边缘点的实际 X —— 见 resolvePoints。
    function influenceRadiusPx(rTotal, pitch, delta) {
        if (typeof rTotal !== "number" || isNaN(rTotal) || rTotal < 1) { rTotal = 1; }
        if (typeof delta !== "number" || isNaN(delta)) { delta = 0.5; }
        if (delta > 0.5) { delta = 0.5; }
        if (delta < 0) { delta = 0; }
        var k;
        if (rTotal % 2 === 1) { k = (rTotal - 1) / 2 + delta; }
        else { k = rTotal / 2 - delta; }
        if (k < 0.5) { k = 0.5; }       // 下限: 至少覆盖正下方那根
        return k * pitch * (1 + 1e-9);
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

    // 把点位列表解析成「像素半径」点位: 宽度来自左右边缘点的实际 X, 缺一侧则回退 autoR。
    //   返回项: { x, y, h, r(右半径), rl(左半径) }
    //   xl / xr = 边缘点的【绝对 X】(合成坐标)。某一侧缺 -> 用 autoR;
    //     autoR 也没给(0) -> 那一侧关闭(半径 0)。
    //   边缘点被拖到峰的【另一侧】-> 该侧半径为负 -> 钳到 0, 同样是"关掉这一侧"。
    // baseY + hMax 一起给 = 启用【总闸】(见 peakScaleOf): 把「归一化后的绝对峰高」
    //   编码进返回项的 y(= baseY − 峰高)并把 h 置 -1(自动) —— 这样 pointContribution
    //   走它原有的"自动"分支就能算出归一化峰高, 【不必改动它的公开契约】。
    function resolvePoints(points, baseY, hMax, autoR) {
        var gate = (typeof hMax === "number" && !isNaN(hMax));
        var s = gate ? peakScaleOf(points, baseY, hMax) : 1;
        var auto = (typeof autoR === "number" && autoR > 0) ? autoR : 0;
        var out = [], k, rl, rr, py, hh;
        for (k = 0; k < points.length; k++) {
            rl = (typeof points[k].xl === "number") ? (points[k].x - points[k].xl) : auto;
            rr = (typeof points[k].xr === "number") ? (points[k].xr - points[k].x) : auto;
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
    // 节奏地板: 第 i 根柱子的"独自高度"。
    //   开关关 / 间隔非法 -> 恒等于 baseH(与 v1.0.0 逐点一致)。
    //   开关开 -> (i % interval)===0 的柱(从最左第 1 根开始数, 右移图案不变)
    //            地板 = baseH × 高度% ; 其余柱地板 = baseH。
    //   返回值永 >= 0(负 baseH 按 0, 与 combineHeights 同口径)。
    function barFloor(i, rhy, baseH) {
        var b = (typeof baseH === "number" && baseH > 0) ? baseH : 0;
        if (!rhy || !(rhy.on > 0.5)) { return b; }
        var n = Math.round(rhy.interval);
        if (!(n >= 1)) { n = 1; }          // 与表达式同口径: 非法间隔钳到 1(每根都节奏), 不回退
        if (i % n !== 0) { return b; }
        var r = rhy.ratioPct;
        if (!(r > 0)) { return b; }
        return b * r / 100;
    }

    function barHeightAt(bx, points, baseY, mode, baseH, type, edgeKeep, floor, fw, pitch) {
        var valsT = [], valsC = [], k, p;
        for (k = 0; k < points.length; k++) {
            p = points[k];
            valsT.push(pointContribution(bx, p.x, p.y, baseY, p.r, type, p.h, edgeKeep, p.rl, baseH, fw, pitch));
            valsC.push(pointContribution(bx, p.x, p.y, baseY, p.r, type, p.h, edgeKeep, p.rl, baseH, 0, pitch));
        }
        // floor = 该柱自己的"地板"(普通柱 = baseH; 节奏条 = baseH×高度%)。
        // v1.5.0 节奏条口径(空间羽化带, 取代 v1.3.2 的硬边界与 v1.4.0 的时间缓冲):
        //   山内核心(liftC > 0, 某点位窗口 t≤1) -> 完全跟随轮廓 baseH + 总抬升(含其他点的羽化带);
        //   山外羽化带内 -> 独自地板 + (边界轮廓值 − 独自地板) × (1 − s), s 为带内归一化位置 ——
        //     相邻柱高度差被带宽摊薄, 无跳变; 带外 -> 独自地板。
        //   普通柱恒 = baseH + 总抬升(羽化带让山脚本身也线性收尾)。
        //   floor 缺失/不高于 baseH -> 恒 = baseH + 总抬升(普通柱口径, 向后兼容)。
        var b = (typeof baseH === "number" && baseH > 0) ? baseH : 0;
        var isR = (typeof floor === "number" && floor > b);
        if (!isR) { return b + combineHeights(valsT, mode, 0); }
        var liftC = combineHeights(valsC, mode, 0);
        if (liftC > 0) { return b + combineHeights(valsT, mode, 0); }
        if (typeof fw === "number" && fw > 0) {
            var sMin = 9, Bmin = 0, k2, band;
            for (k2 = 0; k2 < points.length; k2++) {
                p = points[k2];
                band = pointBand(bx, p.x, p.y, baseY, p.r, p.h, edgeKeep, p.rl, baseH, fw, pitch);
                if (band != null && band[0] < sMin) { sMin = band[0]; Bmin = band[1]; }
            }
            if (sMin <= 1) { return floor + (b + Bmin - floor) * (1 - sMin); }
        }
        return floor;
    }

    // 自动半径的统一入口 —— 生成 / 均分边缘点摆初始位置时用它,
    // 表达式里的 autoR 与此严格镜像(同一组公式: autoInfluenceBars -> influenceRadiusPx(Δ=0.5))。
    function autoRadiusFor(N, W, G, M) {
        return influenceRadiusPx(autoInfluenceBars(N, W, G, M), W + G, 0.5);
    }

    // 第 i 根柱子的高度(与表达式同参数, 供测试比对)
    // rowX/rowY = 【形状图层自身】在合成里的位置(行中心 X / 基线 Y)
    // points[].xl / .xr = 左右边缘点的绝对 X; 某一侧缺 -> 用自动半径
    function barHeightOfIndex(i, N, W, G, rowX, rowY, points, mode, baseH, type, edgeKeep, hMax, rhy, fw) {
        var bx = rowX + barOffsetX(i, N, W, G);
        var autoR = autoRadiusFor(N, W, G, points.length);
        return barHeightAt(bx, resolvePoints(points, rowY, hMax, autoR),
                           rowY, mode, baseH, type, edgeKeep, barFloor(i, rhy, baseH), fw, W + G);
    }

    // 【视觉上真的抬起】的柱子数 —— 这才是用户口径的"影响了几根"。
    //
    // ⚠️ 单位契约(容易搞错): points[].xl / .xr 是【绝对 X】; 宽度由它们与峰 X 的差得到。
    //    (barHeightAt 收的 points[].r / .rl 才是【像素半径】。)
    // ⚠️ baseH 必须【真实传下去】(v0.9.0 起): pointContribution 要用它算
    //    effH = 峰高 − 基础高度; 传 0 会让它退化成"从零起算", 边缘会被判成不可见。
    function countVisibleBars(N, W, G, rowX, rowY, points, mode, baseH, type, edgeKeep, hMax, rhy, fw) {
        var c = 0, i, h;
        for (i = 0; i < N; i++) {
            h = barHeightOfIndex(i, N, W, G, rowX, rowY, points, mode, baseH, type, edgeKeep, hMax, rhy, fw);
            // "可见" = 高于普通柱的地板(baseH)。节奏条(>100%)恒可见 —— 它本来就更高。
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
    //
    // v1.0.0: 宽度【只认左右边缘点】(与纯函数 resolvePoints 严格镜像)——
    //   删掉了「影响范围」+「影响范围倍率%」两个滑块(它们在边缘点存在时被静默覆盖)。
    //   某一侧边缘点缺失 -> 该侧用 autoR(内联的 autoInfluenceBars 镜像),
    //   于是"删掉一侧 = 回到自动宽度"这个手感保留。
    function buildExprCore(i, N, M) {
        var L = [];
        L.push("var c = thisComp.layer(\"" + LAYER_CTRL + "\");");
        L.push("var W = c.effect(\"" + SL_W + "\")(1);");
        L.push("var G = c.effect(\"" + SL_G + "\")(1);");
        L.push("var baseH = c.effect(\"" + SL_BASE + "\")(1);");
        // 与纯函数 combineHeights 的口径一致: 基础高度负值按 0 处理。
        //   控制器滑块可以被拖成负数; 不钳的话表达式会算出【负高度】-> AE 翻转渲染,
        //   基线下方冒出一排反向柱子, 且与状态栏报的数字不一致(审计 P2-1, 实测 10/30 组分叉)。
        L.push("if (baseH < 0) { baseH = 0; }");
        L.push("var mode = c.effect(\"" + SL_MODE + "\")(1);");
        L.push("var ftype = c.effect(\"" + SL_FTYPE + "\")(1);");
        L.push("var edge = " + EDGE_DEF + ";");
        L.push("try { edge = c.effect(\"" + SL_EDGE + "\")(1); } catch (e5) { edge = " + EDGE_DEF + "; }");
        L.push("if (edge > 100) { edge = 100; }");
        L.push("if (edge < 0) { edge = 0; }");
        L.push("edge = edge / 100;");
        // 节奏条(v1.1.0): 三个滑块都缺失时回退"关" —— 旧工程(无这些滑块)行为与 v1.0.0 完全一致
        L.push("var ron = " + RHY_ON_DEF + ";");
        L.push("var rint = " + RHY_N_DEF + ";");
        L.push("var rpct = " + RHY_PCT_DEF + ";");
        L.push("try { ron = c.effect(\"" + SL_RHY_ON + "\")(1); } catch (e11) { ron = " + RHY_ON_DEF + "; }");
        L.push("try { rint = c.effect(\"" + SL_RHY_N + "\")(1); } catch (e12) { rint = " + RHY_N_DEF + "; }");
        L.push("try { rpct = c.effect(\"" + SL_RHY_PCT + "\")(1); } catch (e13) { rpct = " + RHY_PCT_DEF + "; }");
        // v1.5.0 边缘羽化带(根): 0 = 硬边界(v1.3.2 口径); 缺滑块(旧工程)回退 0 保持旧行为
        L.push("var rfw = 0;");
        L.push("try { rfw = c.effect(\"" + SL_RHY_FW + "\")(1); } catch (e14) { rfw = 0; }");
        L.push("var i = " + i + ";");
        L.push("var N = " + N + ";");
        L.push("var M = " + M + ";");
        L.push("var pitch = W + G;");
        L.push("var bx = transform.position[0] + (i - (N - 1) / 2) * pitch;");
        // ---- 回退半径 autoR: autoRadiusFor() 的镜像(内联, 因为表达式里不能调 JS 函数) ----
        L.push("var rowW = N * W + (N - 1) * G;");
        L.push("var ab = 1;");
        L.push("if (pitch > 0) { ab = Math.round(rowW / (M + 1) * 2.5 / pitch * 2 - 1); }");
        L.push("if (ab > N) { ab = N; }");
        L.push("if (ab < 1) { ab = 1; }");
        L.push("var kk = ab / 2 - 0.5;");
        L.push("if (ab % 2 > 0.5) { kk = (ab - 1) / 2 + 0.5; }");
        L.push("if (kk < 0.5) { kk = 0.5; }");
        L.push("var autoR = kk * pitch * 1.000000001;");
        L.push("var sum = 0;");
        L.push("var mx = 0;");
        L.push("var k = 0;");
        L.push("var P = null;");
        L.push("var pp = null;");
        L.push("var pk = 0;");
        L.push("var hh = 0;");
        L.push("var rl = 0;");
        L.push("var rr = 0;");
        L.push("var rUse = 0;");
        L.push("var dd = 0;");
        L.push("var t = 0;");
        L.push("var f = 0;");
        L.push("var v = 0;");
        L.push("var eff = 0;");
        L.push("var vC = 0;");
        L.push("var vB = 0;");
        L.push("var sumC = 0;");
        L.push("var mxC = 0;");
        L.push("var sMin = 9;");
        L.push("var Bmin = 0;");
        L.push("var s2 = 0;");
        L.push("var fwT = 0;");
        L.push("var EL = null;");
        L.push("var ER = null;");
        // ---- 总闸「山峰 总高度闸」(与纯函数 peakScaleOf 严格镜像) ----
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
        L.push("    try { P2 = thisComp.layer(\"" + PT_PREFIX + "\" + k2 + \"" + PT_PEAK_SUFFIX + "\"); } catch (e7) { P2 = null; }");
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
        L.push("  try { P = thisComp.layer(\"" + PT_PREFIX + "\" + k + \"" + PT_PEAK_SUFFIX + "\"); } catch (e1) { P = null; }");
        L.push("  if (P) {");
        L.push("    pp = P.transform.position;");
        L.push("    hh = 0;");
        L.push("    try { hh = P.effect(\"" + SL_H + "\")(1); } catch (e4) { hh = 0; }");
        L.push("    pk = transform.position[1] - pp[1];");
        L.push("    if (hh > 0) { pk = hh; }");
        L.push("    if (hGate > 0) { pk = pk * hsc; }");
        L.push("    if (pk > 0) {");
        L.push("      rl = autoR;");
        L.push("      rr = autoR;");
        L.push("      EL = null;");
        L.push('      try { EL = thisComp.layer("' + PT_PREFIX + '" + k + "' + PT_L_SUFFIX + '"); } catch (e9) { EL = null; }');
        L.push("      if (EL) { rl = pp[0] - EL.transform.position[0]; }");
        L.push("      ER = null;");
        L.push('      try { ER = thisComp.layer("' + PT_PREFIX + '" + k + "' + PT_R_SUFFIX + '"); } catch (e10) { ER = null; }');
        L.push("      if (ER) { rr = ER.transform.position[0] - pp[0]; }");
        L.push("      if (rl < 0) { rl = 0; }");
        L.push("      if (rr < 0) { rr = 0; }");
        L.push("      dd = bx - pp[0];");
        L.push("      rUse = rr;");
        L.push("      if (dd < 0) { rUse = rl; }");
        L.push("      if (rUse > 0) {");
        L.push("        t = Math.abs(dd) / rUse;");
        L.push("        eff = pk - baseH;");
        L.push("        vC = 0;");
        L.push("        vB = 0;");
        L.push("        if (t <= 1) {");
        L.push("          if (ftype < 0.5) { f = 0.5 * (1 + Math.cos(Math.PI * t)); }");
        L.push("          else if (ftype < 1.5) { f = (Math.exp(-4.5 * t * t) - " + GAUSS_LO + ") / " + GAUSS_SPAN + "; }");
        L.push("          else if (ftype < 2.5) { f = 1 - t; }");
        L.push("          else { f = (1 - t) * (1 - t); }");
        L.push("          f = edge + (1 - edge) * f;");
        L.push("          if (eff > 0) { vC = eff * f; }");
        L.push("        } else if (rfw > 0 && eff > 0) {");
        L.push("          fwT = rfw * pitch / rUse;");
        L.push("          if (fwT > 2) { fwT = 2; }");
        L.push("          s2 = (t - 1) / fwT;");
        L.push("          if (s2 <= 1) {");
        L.push("            vB = eff * edge * (1 - s2);");
        L.push("            if (s2 < sMin) { sMin = s2; Bmin = eff * edge; }");
        L.push("          }");
        L.push("        }");
        L.push("        v = vC + vB;");
        L.push("        sum = sum + v;");
        L.push("        if (v > mx) { mx = v; }");
        L.push("        sumC = sumC + vC;");
        L.push("        if (vC > mxC) { mxC = vC; }");
        L.push("      }");
        L.push("    }");
        L.push("  }");
        L.push("}");
        L.push("var h = mx;");
        L.push("if (mode < 0.5) { h = sum; }");
        L.push("var liftC = mxC;");
        L.push("if (mode < 0.5) { liftC = sumC; }");
        // 节奏地板(与纯函数 barFloor 严格镜像): 开关开且 i 落在间隔上 -> 地板 = baseH×高度%
        L.push("var fl = baseH;");
        L.push("if (ron > 0.5) {");
        L.push("  if (rint < 1) { rint = 1; }");
        L.push("  if (i % Math.round(rint) === 0 && rpct > 0) { fl = baseH * rpct / 100; }");
        L.push("}");
        // v1.5.0 节奏条口径(空间羽化带, 与纯函数 barHeightAt 严格镜像; 取代 v1.3.2 硬边界 / v1.4.0 时间缓冲):
        //   山内核心(liftC > 0) -> 完全跟随轮廓 baseH + 总抬升(含其他点的羽化带贡献);
        //   山外羽化带内(sMin <= 1) -> 独自地板 + (边界轮廓值 Bmin + baseH − 独自地板) × (1 − sMin);
        //   带外 -> 独自地板 fl。普通柱恒 = baseH + 总抬升(羽化带让山脚线性收尾)。
        L.push("if (fl > baseH) {");
        L.push("  if (liftC > 0) { h = baseH + h; } else {");
        L.push("    if (sMin <= 1) { h = fl + (baseH + Bmin - fl) * (1 - sMin); } else { h = fl; }");
        L.push("  }");
        L.push("} else {");
        L.push("  h = baseH + h;");
        L.push("}");
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
    // v1: r = 像素半径;  v2: r = 每侧根数;  v3: r = 总共根数;
    // v4(v1.0.0): 删掉 r —— 宽度改由左右边缘点控制, 不再是面板参数。
    //   读到 v1~v3 的槽位: r 自动被忽略, 其余字段照常归一化(不是破坏性迁移)。
    var PRESET_VERSION = 4;

    // ============================================================
    // 参数空间(单一真相) —— v1.0.0
    // ============================================================
    // 以前每个参数要手工同步 8 个站点(默认值表 / 预设键 / 读面板 / 存预设 / 填面板 / 建 UI /
    // 表达式读取 / onChange 推送), 加一个参数平均要改 5~7 处 —— 典型的 Shotgun Surgery,
    // 而漏改的表现是"某个控件改了没反应"(审计发现:「影响范围」就是这么变成死参数的)。
    // 现在只在 PARAM_SPECS 里声明一次, 其余全部由它派生:
    //   DEFAULTS · PRESET_KEYS · 建控件 · 读面板 · 存预设 · 填预设 · onChange 推送
    //
    // mode = "改完如何生效"(决定用户要不要重新生成):
    //   "ctrl"    写控制器上的同名滑块(表达式每帧读它)   -> 立即生效
    //   "points"  推给所有已有点位(逐点滑块)             -> 立即生效
    //   "layer"   移动形状图层(基线就是图层 Y)           -> 立即生效
    //   "rebuild" 结构性参数(增删图层/矩形组), 必须重新生成 -> UI 上明确标注
    // group = UI 归到哪个面板(排列 / 高度 / 起伏)
    var PARAM_SPECS = [
        { key: "n", label: "数量", ui: "edCount", kind: "int", def: 40, lo: 1, hi: MAX_BARS, mode: "rebuild", group: "排列", chars: 4 },
        { key: "auto", label: "自动铺满", ui: "cbFill", kind: "bool", def: false, mode: "rebuild", group: "排列", check: "自动铺满合成宽度(勾选后忽略「数量」)" },
        { key: "w", label: "矩形宽", ui: "edW", kind: "num", def: 24, lo: 1, hi: 100000, mode: "ctrl", ctrl: SL_W, group: "排列", chars: 4 },
        { key: "gap", label: "间距", ui: "edGap", kind: "num", def: 10, lo: 0, hi: 100000, mode: "ctrl", ctrl: SL_G, group: "排列", chars: 4 },
        { key: "baseH", label: "基础高度", ui: "edBaseH", kind: "num", def: 40, lo: 0, hi: 100000, mode: "ctrl", ctrl: SL_BASE, group: "高度", chars: 4 },
        { key: "baseRatio", label: "基线(%合成高)", ui: "edBaseline", kind: "num", def: 80, lo: 1, hi: 99, mode: "layer", group: "高度", chars: 3 },
        { key: "ftype", label: "起伏曲线", ui: "ddFall", kind: "idx", def: 0, lo: 0, hi: 3, mode: "ctrl", ctrl: SL_FTYPE, group: "起伏", items: ["余弦", "高斯", "线性", "二次"] },
        { key: "mode", label: "叠加方式", ui: "ddMode", kind: "idx", def: 0, lo: 0, hi: 1, mode: "ctrl", ctrl: SL_MODE, group: "起伏", items: ["叠加(求和)", "取最高"] },
        { key: "pts", label: "点数", ui: "edPoints", kind: "int", def: 5, lo: 1, hi: MAX_POINTS, mode: "rebuild", group: "起伏", chars: 3 },
        { key: "ph", label: "点位高度", ui: "edPH", kind: "num", def: 0, lo: 0, hi: 100000, mode: "points", group: "高度", chars: 4 },
        { key: "edge", label: "边缘高度%", ui: "edEdge", kind: "num", def: EDGE_DEF, lo: 0, hi: 100, mode: "ctrl", ctrl: SL_EDGE, group: "高度", chars: 3 },
        { key: "rhyOn", label: "节奏条开关", ui: "cbRhyOn", kind: "bool", def: false, mode: "ctrl", ctrl: SL_RHY_ON, group: "节奏", check: "节奏条开关(每 N 根一根更高)" },
        { key: "rhyN", label: "节奏间隔", ui: "edRhyN", kind: "int", def: RHY_N_DEF, lo: 1, hi: 500, mode: "ctrl", ctrl: SL_RHY_N, group: "节奏", chars: 3 },
        { key: "rhyPct", label: "节奏条高度%", ui: "edRhyPct", kind: "num", def: RHY_PCT_DEF, lo: 100, hi: 1000, mode: "ctrl", ctrl: SL_RHY_PCT, group: "节奏", chars: 4 },
        { key: "rhyFw", label: "边缘过渡(根)", ui: "edRhyFw", kind: "int", def: RHY_FW_DEF, lo: 0, hi: RHY_FW_MAX, mode: "ctrl", ctrl: SL_RHY_FW, group: "节奏", chars: 3 }
    ];

    function paramSpec(key) {
        for (var i = 0; i < PARAM_SPECS.length; i++) {
            if (PARAM_SPECS[i].key === key) { return PARAM_SPECS[i]; }
        }
        return null;
    }

    // 预设字段 = 参数表的键(唯一来源)
    var PRESET_KEYS = (function () {
        var o = [], i;
        for (i = 0; i < PARAM_SPECS.length; i++) { o.push(PARAM_SPECS[i].key); }
        return o;
    })();

    // 面板默认值(同样由参数表派生 —— 两处硬编码迟早漂移)
    var DEFAULTS = (function () {
        var o = {}, i, sp;
        for (i = 0; i < PARAM_SPECS.length; i++) { sp = PARAM_SPECS[i]; o[sp.key] = sp.def; }
        return o;
    })();

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

    // 归一化: 无论来源是面板、槽位文件还是手改 JSON, 出来的都是合法且钳制过的参数。
    // 由参数表驱动 —— 以后加参数只要在 PARAM_SPECS 里加一行, 这里自动覆盖, 不用再手改。
    function serializePreset(o) {
        var out = {}, i, sp, v;
        for (i = 0; i < PARAM_SPECS.length; i++) {
            sp = PARAM_SPECS[i];
            if (sp.kind === "bool") { out[sp.key] = pickBool(o && o[sp.key]); continue; }
            v = pickNum(o && o[sp.key], sp.def);
            out[sp.key] = (sp.kind === "int") ? clampInt(v, sp.lo, sp.hi) : clampNum(v, sp.lo, sp.hi);
        }
        return out;
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
                    // 迁移: v1~v3 的 r 字段(宽度)已在 v4 删除 —— 归一化时自然被忽略,
                    //   不需要专门处理(宽度改由左右边缘点控制)。
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
                pointContribution: pointContribution, pointBand: pointBand, combineHeights: combineHeights,
                barHeightAt: barHeightAt, barHeightOfIndex: barHeightOfIndex,
                barFloor: barFloor,
                countVisibleBars: countVisibleBars,
                influenceRadiusPx: influenceRadiusPx, autoRadiusFor: autoRadiusFor,
                resolvePoints: resolvePoints,
                intrinsicPeak: intrinsicPeak, peakScaleOf: peakScaleOf,
                autoInfluenceBars: autoInfluenceBars,
                buildExprCore: buildExprCore, buildSizeExpr: buildSizeExpr,
                buildPosExpr: buildPosExpr,
                serializePreset: serializePreset, deserializePreset: deserializePreset,
                slotsToJson: slotsToJson, jsonParseSlots: jsonParseSlots,
                resetSlots: resetSlots,
                pickNum: pickNum, pickBool: pickBool,
                paramSpec: paramSpec,
                readParams: readParams, collectParams: collectParams,
                applyParamsToUI: applyParamsToUI,
                PRESET: {
                    file: PRESET_FILE_NAME, version: PRESET_VERSION,
                    slotKeys: SLOT_KEYS, slotCount: SLOT_COUNT,
                    keys: PRESET_KEYS, defaults: DEFAULTS,
                    specs: PARAM_SPECS
                },
                NAMES: {
                    bars: LAYER_BARS, ctrl: LAYER_CTRL, ptPrefix: PT_PREFIX,
                    hgt: LAYER_HGT, hgtDefRatio: HGT_DEF_RATIO,
                    ptLSuffix: PT_L_SUFFIX, ptRSuffix: PT_R_SUFFIX, ptPeakSuffix: PT_PEAK_SUFFIX,
                    groupPrefix: GROUP_PREFIX, rect: RECT_NAME,
                    w: SL_W, g: SL_G, base: SL_BASE, mode: SL_MODE,
                    ftype: SL_FTYPE, h: SL_H, hDef: H_DEF, color: SL_COLOR,
                    edge: SL_EDGE, edgeDef: EDGE_DEF,
                    rhyOn: SL_RHY_ON, rhyN: SL_RHY_N, rhyPct: SL_RHY_PCT, rhyFw: SL_RHY_FW,
                    rhyOnDef: RHY_ON_DEF, rhyNDef: RHY_N_DEF, rhyPctDef: RHY_PCT_DEF, rhyFwDef: RHY_FW_DEF,
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

    // ---- 调试诊断(v1.1.1, 照 NumCounter 先例): 缓冲 -> 面板调试输出区 -> 可复制 ----
    //   为什么: AE 的 ScriptUI handler 抛错【完全静默】(没有控制台), 用户看到的就是
    //   "点击没反应"。诊断三件套 = diag() 收集 + debugBox 显示 + 复制按钮拿走。
    var gDiag = [];
    function diag(msg) { try { gDiag.push(String(msg)); } catch (e) {} }
    function flushDiag(p) {
        try { if (p && p.debugBox) { p.debugBox.text = gDiag.join("\n"); } } catch (e) {}
    }
    // 从只读框复制: 激活 -> 全选(23) -> 复制(19) —— NumCounter 真机验证过的做法
    function copyBoxToClipboard(box) {
        try {
            box.active = true;
            app.executeCommand(23); // 全选
            app.executeCommand(19); // 复制
            return true;
        } catch (e) { return false; }
    }

    function showDebugError(err, step) {
        try {
            diag("== 出错 ==");
            diag("位置: " + (step || "未知"));
            diag("类型: " + (err && err.name ? err.name : "未知"));
            diag("信息: " + (err ? err.toString() : "未知"));
            if (err && err.line !== undefined) { diag("行号: " + err.line); }
            if (err && err.stack) { diag("堆栈: " + err.stack); }
            var lines = [];
            lines.push("出错位置: " + (step || "未知"));
            lines.push("错误类型: " + (err && err.name ? err.name : "未知"));
            lines.push("错误信息: " + (err ? err.toString() : "未知"));
            if (err && err.line !== undefined) { lines.push("行号: " + err.line); }
            if (err && err.stack) { lines.push("堆栈:"); lines.push(err.stack); }
            lines.push("", "(面板底部「调试输出」区同步了一份, 点「复制」即可粘贴反馈)");
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
            // 注意: 这里【不做】executeCommand 自动复制 —— 模态弹窗等待期间 AE 会拒绝
            //   执行命令("当模式对话框正在等待回应时, 无法运行脚本"), 正是用户报的错②。
            //   模态弹窗里只给手动复制指引; 自动复制只在面板底部的【非模态】调试区提供。
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

    // 数当前有几个「山峰点 k【峰】」
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
        host.property("ADBE Effect Parade").property(name).property(1).setValue(sliderVal(val));
    }

    // 按名字设置【已存在】滑块的数值(用于把面板参数推给已有点位)
    function setSlider(host, name, val) {
        try {
            var e = host.property("ADBE Effect Parade").property(name);
            if (!e) { return false; }
            e.property(1).setValue(sliderVal(val));
            return true;
        } catch (e2) { return false; }
    }

    // v1.3.1: 复选框类参数(节奏条开关)的值是 true/false —— 写进 AE 滑块前转成 1/0,
    //   否则 Slider Control.setValue(布尔) 在部分 AE 版本会抛错(表达式读到的是数值滑块)。
    function sliderVal(val) {
        if (val === true) { return 1; }
        if (val === false) { return 0; }
        return val;
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

    // 读面板参数 → 归一化后的参数对象。
    //   ⚠️ 归一化统一走 collectParams + serializePreset —— 于是"面板输入 / 预设文件 /
    //      手改 JSON"三种来源的钳制口径完全一致(v1.0.0 前这里自己 clamp 一套,
    //      与预设那套是两份代码, 容易漂移; 这也是"参数有 6 条读写路径"里被合并掉的一条)。
    function readParams(U, comp) {
        var p = collectParams(U);
        // ⚠️ v1.1.3 修复: generate/resetPoints 用的历史键名是【p.m】, 而参数表产出的是
        //   【p.pts】—— v1.0.0 重构时两边没接上, p.m = undefined, 于是
        //   「for (k = 1; k <= p.m; k++)」一次都不跑 => 波峰的 3 个一组的控制点全部没建。
        //   这里统一映射(其余键名 n/w/gap/baseH/baseRatio/ftype/mode/ph/edge/rhy* 均已核对一致)。
        p.m = p.pts;
        // 「自动铺满」勾选时用合成宽度反推数量(结构性参数, 只在生成时落地)
        if (p.auto) { p.n = autoCount(comp.width, p.w, p.gap, comp.width * 0.03); }
        p.rowW = rowWidth(p.n, p.w, p.gap);
        p.baseRatio = p.baseRatio / 100;     // 面板是百分比(1..99), 内部几何用 0..1
        return p;
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
        EL.label = LABEL_LEFT;
        EL.transform.position.setValue([px - rPx, baseY]);
        var ER = comp.layers.addNull();
        ER.name = PT_PREFIX + k + PT_R_SUFFIX;
        ER.label = LABEL_RIGHT;
        ER.transform.position.setValue([px + rPx, baseY]);
    }

    // 把某个峰的两侧边缘点摆到 峰X ∓ rPx 处(只改 X, 保留它们各自的 Y —— 用户可能拖过)。
    //   返回实际摆动的边缘点个数: 0 = 两个都不存在。
    //   ⚠️ 返回值的意义(v1.0.0 起): 调用方据此把"没生效"暴露到状态栏 ——
    //      以前这里静默吞异常, 表现是"边缘点没跟着动", 用户会误判成"参数没用"(审计 P2-3)。
    //   某一侧缺边缘点就跳过 —— 那一侧回到自动半径(见 resolvePoints 的 autoR)。
    function syncEdgeX(comp, k, px, rPx) {
        var moved = 0;
        var E = findLayer(comp, PT_PREFIX + k + PT_L_SUFFIX);
        if (E) {
            var yL = 0;
            try { yL = E.transform.position.value[1]; } catch (e1) { yL = 0; }
            try { E.transform.position.setValue([px - rPx, yL]); moved = moved + 1; } catch (e2) {}
        }
        E = findLayer(comp, PT_PREFIX + k + PT_R_SUFFIX);
        if (E) {
            var yR = 0;
            try { yR = E.transform.position.value[1]; } catch (e3) { yR = 0; }
            try { E.transform.position.setValue([px + rPx, yR]); moved = moved + 1; } catch (e4) {}
        }
        return moved;
    }

    // 建一个波峰 + 它的左右边缘点(一个波峰 = 一组 3 个空对象)。
    //   边缘点初始位置 = 自动半径(autoRadiusFor), 与其后的 resolvePoints 回退口径一致;
    //   用户一拖就以边缘点为准, 所以这只是起点。
    function makePoint(comp, k, N, M, W, G, centerX, baseY, peak, PH) {
        var rowW = rowWidth(N, W, G);
        var px = pointXAt(k, M, rowW, centerX);
        var P = comp.layers.addNull();
        P.name = PT_PREFIX + k + PT_PEAK_SUFFIX;
        P.label = LABEL_PEAK;
        P.transform.position.setValue([px, baseY - peak]);
        addSlider(P, SL_H, (typeof PH === "number" && !isNaN(PH)) ? PH : H_DEF);
        makeEdgePoints(comp, k, px, baseY, autoRadiusFor(N, W, G, M));
        return P;
    }

    // 建/复用总闸空对象「山峰 总高度闸」。
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
        L.label = LABEL_HGT;
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
            // 诊断: 参数快照(出问题时反馈这段就能定位"面板读到了什么")
            diag("合成: " + comp.name + "  " + comp.width + "x" + comp.height);
            diag("参数: 数量=" + p.n + " 自动铺满=" + p.auto
                + " 矩形宽=" + p.w + " 间距=" + p.gap
                + " 基础高度=" + p.baseH + " 基线=" + Math.round(p.baseRatio * 100) + "%"
                + " 点数=" + p.pts
                + " 节奏=" + (p.rhyOn ? 1 : 0) + "/" + p.rhyN + "/" + p.rhyPct + " 过渡=" + p.rhyFw + "根"
                + " 边缘高度=" + p.edge + "%"
                + " 曲线=" + p.ftype + " 叠加=" + p.mode);

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
                ctrl.label = LABEL_CTRL;
                ctrl.transform.position.setValue([centerX, baseY]);
                // 控制器的滑块 = 全部 mode:"ctrl" 的参数(由参数表驱动, 顺序即声明顺序)
                for (var ci = 0; ci < PARAM_SPECS.length; ci++) {
                    if (PARAM_SPECS[ci].mode === "ctrl") { addSlider(ctrl, PARAM_SPECS[ci].ctrl, p[PARAM_SPECS[ci].key]); }
                }

                step = "建点位";
                var peak = comp.height * HGT_DEF_RATIO;
                for (var k = 1; k <= p.m; k++) {
                    makePoint(comp, k, p.n, p.m, p.w, p.gap, centerX, baseY, peak, p.ph);
                }

                // 总闸: 默认高度 = 合成高 × 22%(与点位默认峰高一致)
                //   -> 生成后 hsc 恰好 = 1, 观感与不开总闸时完全相同, 用户往上拖才长高。
                step = "建高度控制点";
                ensureHeightLayer(comp, centerX, baseY, comp.height * HGT_DEF_RATIO);
            } finally {
                app.endUndoGroup();
            }

            setStatus(pal,
                "已生成 " + p.n + " 根矩形 + " + p.m + " 个波峰(每个波峰一组 3 个控制点)"
                + (p.auto ? "(自动铺满)" : "")
                + visibleCountHint(comp)
                + "\r拖「山峰点 k【左缘】/ k【右缘】」改山丘宽度, 拖「山峰点 k【峰】」改峰位置与高度。",
                C_OK);
            diag("生成完成: 柱 " + p.n + " / 波峰 " + p.m);
            flushDiag(pal);
        } catch (e) {
            setStatus(pal, "出错: " + step + ", 详情见弹窗", C_ERR);
            showDebugError(e, step);
            flushDiag(pal);
        }
    }

    // 从合成里读回所有波峰的参数(供状态栏回报"实际可见根数")
    function readPointsFromComp(comp) {
        var out = [], M = countPoints(comp), k, L, pos, h, EL, ER, p;
        for (k = 1; k <= M; k++) {
            L = findLayer(comp, PT_PREFIX + k + PT_PEAK_SUFFIX);
            if (!L) { continue; }
            pos = null;
            try { pos = L.transform.position.value; } catch (e1) { pos = null; }
            if (!pos || pos.length < 2) { continue; }
            h = 0;
            try { h = L.property("ADBE Effect Parade").property(SL_H).property(1).value; } catch (e2) { h = 0; }
            p = { x: pos[0], y: pos[1], h: h };
            // 边缘点存在就带上绝对 X(宽度来源); 缺了就让纯函数回退自动半径
            EL = findLayer(comp, PT_PREFIX + k + PT_L_SUFFIX);
            if (EL) { try { p.xl = EL.transform.position.value[0]; } catch (e3) {} }
            ER = findLayer(comp, PT_PREFIX + k + PT_R_SUFFIX);
            if (ER) { try { p.xr = ER.transform.position.value[0]; } catch (e4) {} }
            out.push(p);
        }
        return out;
    }

    // 状态栏补充信息: "实际可见 N 根(共 N 根) | 最高 Npx"。
    // 用户看的是【视觉上抬起来了几根】, 把它显示出来就能照着调, 不用猜。
    // ⚠️ 这里的回退值一律取 DEFAULTS(不要再写 24/10 这类字面量 —— 与参数表漂移过)。
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

            var W = DEFAULTS.w;
            var G = DEFAULTS.gap;
            var baseH = 0;
            var mode = DEFAULTS.mode;
            var ftype = DEFAULTS.ftype;
            var ekeep = EDGE_DEF;
            try { W = ctrl.effect(SL_W)(1); } catch (e1) { W = DEFAULTS.w; }
            try { G = ctrl.effect(SL_G)(1); } catch (e2) { G = DEFAULTS.gap; }
            try { baseH = ctrl.effect(SL_BASE)(1); } catch (e3) { baseH = DEFAULTS.baseH; }
            try { mode = ctrl.effect(SL_MODE)(1); } catch (e4) { mode = DEFAULTS.mode; }
            try { ftype = ctrl.effect(SL_FTYPE)(1); } catch (e5) { ftype = DEFAULTS.ftype; }
            try { ekeep = ctrl.effect(SL_EDGE)(1); } catch (e7) { ekeep = EDGE_DEF; }
            // 节奏条: 缺滑块(旧工程)回退"关", 与表达式同口径
            var rhy = null;
            var ron = 0;
            try { ron = ctrl.effect(SL_RHY_ON)(1); } catch (e9a) { ron = 0; }
            if (ron > 0.5) {
                rhy = { on: 1, interval: RHY_N_DEF, ratioPct: RHY_PCT_DEF };
                try { rhy.interval = ctrl.effect(SL_RHY_N)(1); } catch (e9b) {}
                try { rhy.ratioPct = ctrl.effect(SL_RHY_PCT)(1); } catch (e9c) {}
            }
            // 与表达式 / 纯函数同一口径: 基础高度负值按 0(控制器滑块可以被拖成负数)
            if (!(baseH >= 0)) { baseH = 0; }

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

            var fwV = RHY_FW_DEF;
            try { fwV = ctrl.effect(SL_RHY_FW)(1); } catch (eFW) { fwV = RHY_FW_DEF; }
            var vis = countVisibleBars(N, W, G, rowPos[0], rowPos[1], pts, mode, baseH, ftype, ekeep, hMax, rhy, fwV);
            var tag = (typeof hMax === "number") ? (" | 最高 " + Math.round(hMax) + "px") : "";
            return " 实际可见 " + vis + " 根(共 " + N + " 根)" + tag + "。";
        } catch (e) { return ""; }
    }

    // ---------- 参数即时推送(v1.0.0: 参数表驱动, 一处声明全员生效) ----------
    // 返回: >0 = 成功改到的对象数; 0 = 还没生成(或该 mode 无事可做); -1 = 无工程/参数非法
    //   mode:"ctrl"    写控制器上的同名滑块 -> 表达式每帧读它, 立即生效
    //   mode:"points"  推给所有已有点位(逐点滑块)
    //   mode:"layer"   移动形状图层(面板的基线% -> 图层 Y, 与直接拖图层同义)
    //   mode:"rebuild" 结构性参数, 不推送(由 onChange 提示需重新生成)
    function pushParam(pal, U, key) {
        var sp = paramSpec(key);
        if (!sp) { return -1; }
        var comp = getComp();
        if (!comp) { return -1; }
        // 归一化统一走 collectParams + serializePreset(与存预设同一口径, 不会两套钳制)
        var v = serializePreset(collectParams(U))[key];
        var k, n, L;

        if (sp.mode === "ctrl") {
            var ctrl = findLayer(comp, LAYER_CTRL);
            if (!ctrl) { return 0; }
            if (!setSlider(ctrl, sp.ctrl, v)) { addSlider(ctrl, sp.ctrl, v); }
            return 1;
        }
        if (sp.mode === "points") {
            var M = countPoints(comp);
            n = 0;
            for (k = 1; k <= M; k++) {
                L = findLayer(comp, PT_PREFIX + k + PT_PEAK_SUFFIX);
                if (!L) { continue; }
                if (setSlider(L, SL_H, v)) { n = n + 1; }
            }
            return n;
        }
        if (sp.mode === "layer") {
            var bars = findLayer(comp, LAYER_BARS);
            if (!bars) { return 0; }
            try {
                var cur = bars.transform.position.value;
                bars.transform.position.setValue([cur[0], comp.height * v / 100]);
                return 1;
            } catch (e1) { return -1; }
        }
        return 0;
    }

    // 「均分边缘点」: 按当前 数量/矩形宽/间距/点数 重算自动半径, 把所有波峰的左右边缘点
    //   摆回对称位置。这是「影响范围」被删除后替代它的那件事 ——
    //   原来"填个数字精确设宽度"改成"一键回到自动宽度", 之后靠拖边缘点微调(或做不对称)。
    //   只改 X, 不动 Y; 不动峰的位置。
    function uniformEdgePoints(pal, U) {
        var step = "均分边缘点";
        try {
            var comp = getComp();
            if (!comp) { setStatus(pal, "请先在时间轴里激活一个合成。", C_WARN); return; }
            var bars = findLayer(comp, LAYER_BARS);
            if (!bars) { setStatus(pal, "还没有生成, 请先点「生成 / 重建」。", C_WARN); return; }
            var N = countBars(bars);
            if (N < 1) { setStatus(pal, "形状图层里找不到矩形组, 请点「生成 / 重建」。", C_WARN); return; }
            var M = countPoints(comp);
            if (M < 1) { setStatus(pal, "还没有波峰, 请先点「生成 / 重建」。", C_WARN); return; }

            var p = readParams(U, comp);
            // 用【实际柱数 N】算半径(面板的「数量」只有点生成才落地)
            var rPx = autoRadiusFor(N, p.w, p.gap, M);
            var moved = 0, miss = 0, k;
            app.beginUndoGroup("山峰频谱:均分边缘点");
            try {
                for (k = 1; k <= M; k++) {
                    var L = findLayer(comp, PT_PREFIX + k + PT_PEAK_SUFFIX);
                    if (!L) { continue; }
                    var px = 0;
                    try { px = L.transform.position.value[0]; } catch (e1) { px = 0; }
                    var mv = syncEdgeX(comp, k, px, rPx);
                    moved = moved + mv;
                    if (mv < 2) { miss = miss + 1; }
                }
            } finally {
                app.endUndoGroup();
            }

            var msg = "已按自动宽度(" + Math.round(rPx) + "px 半径)摆齐 " + M + " 个波峰的边缘点。";
            if (miss > 0) {
                msg = msg + " ⚠ 有 " + miss + " 个波峰缺边缘点 —— 该侧会退回自动半径。";
            }
            setStatus(pal, msg + visibleCountHint(comp), miss > 0 ? C_WARN : C_OK);
        } catch (e) {
            setStatus(pal, "出错: " + step + ", 详情见弹窗", C_ERR);
            showDebugError(e, step);
        }
    }


    // 重设点位: 增删波峰空对象(连带它的左右边缘点), 重排 X, 摆齐边缘点, 重写表达式。
    //   保留已有点位的 Y(用户调好的高度) —— 只动结构, 不动"设计意图"。
    function resetPoints(pal, U) {
        var step = "读取参数";
        try {
            var comp = getComp();
            if (!comp) { setStatus(pal, "请先在时间轴里激活一个合成。", C_WARN); return; }
            var bars = findLayer(comp, LAYER_BARS);
            if (!bars) { setStatus(pal, "还没有生成, 请先点「生成 / 重建」。", C_WARN); return; }
            var N = countBars(bars);
            if (N < 1) { setStatus(pal, "形状图层里找不到矩形组, 请点「生成 / 重建」。", C_WARN); return; }
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
            var peak = comp.height * HGT_DEF_RATIO;

            app.beginUndoGroup("山峰频谱:重设点位");
            try {
                step = "增删波峰";
                if (p.m < old) {
                    // 波峰与它的两个边缘点一起删 —— 否则会留下孤儿边缘点(它们也以 PT_PREFIX 开头)
                    for (var k = old; k > p.m; k--) {
                        var Ld = findLayer(comp, PT_PREFIX + k + PT_L_SUFFIX);
                        if (Ld) { try { Ld.remove(); } catch (e0) {} }
                        Ld = findLayer(comp, PT_PREFIX + k + PT_R_SUFFIX);
                        if (Ld) { try { Ld.remove(); } catch (e1) {} }
                        Ld = findLayer(comp, PT_PREFIX + k + PT_PEAK_SUFFIX);
                        if (Ld) { try { Ld.remove(); } catch (e2) {} }
                    }
                } else if (p.m > old) {
                    for (var k2 = old + 1; k2 <= p.m; k2++) {
                        makePoint(comp, k2, N, p.m, p.w, p.gap, centerX, baseY, peak, p.ph);
                    }
                }

                // 老工程(在总闸出现之前生成的)还没有「山峰 总高度闸」-> 顺手补建。
                //   已存在则不动位置, 于是这里也是"拖高之后再点重设点位"的安全路径。
                step = "建高度控制点";
                ensureHeightLayer(comp, centerX, baseY, comp.height * HGT_DEF_RATIO);

                // 把 X 按新点数重新均分(否则点数变了, 老点位还留在旧的等分位置上);
                //   并把「点位高度」推下去、把边缘点摆到自动宽度。
                step = "重排与宽度";
                var rPx = autoRadiusFor(N, p.w, p.gap, p.m);
                var miss = 0;
                for (var k3 = 1; k3 <= p.m; k3++) {
                    var LP = findLayer(comp, PT_PREFIX + k3 + PT_PEAK_SUFFIX);
                    if (!LP) { continue; }
                    var curY = baseY - peak;
                    try { curY = LP.transform.position.value[1]; } catch (e3) {}
                    var npx = pointXAt(k3, p.m, rowW, centerX);
                    LP.transform.position.setValue([npx, curY]);
                    setSlider(LP, SL_H, p.ph);
                    // 边缘点必须跟着峰走, 否则它们会与新位置错位
                    if (syncEdgeX(comp, k3, npx, rPx) < 2) { miss = miss + 1; }
                }

                step = "重写表达式";
                if (!rewriteBarExpr(N, p.m)) {
                    setStatus(pal, "重写表达式失败, 请点「生成 / 重建」。", C_WARN);
                    return;
                }
            } finally {
                app.endUndoGroup();
            }

            var msg = "波峰已改为 " + p.m + " 个(原 " + old + " 个), 已按新点数均分并摆齐边缘点。";
            if (miss > 0) { msg = msg + " ⚠ 有 " + miss + " 个波峰缺边缘点(该侧退回自动半径)。"; }
            setStatus(pal, msg + visibleCountHint(comp), miss > 0 ? C_WARN : C_OK);
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
                    var L = findLayer(comp, PT_PREFIX + k + PT_PEAK_SUFFIX);
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
                3000, true);
        } catch (e) {}
    }

    // 当前面板参数 -> 归一化预设对象(只收集, 不落盘)。由参数表驱动。
    //   与 readParams 共用这一条路径 —— 于是"面板 → 参数"和"面板 → 预设"不可能再出现两套钳制。
    function collectParams(U) {
        var raws = {}, i, sp;
        for (i = 0; i < PARAM_SPECS.length; i++) {
            sp = PARAM_SPECS[i];
            if (sp.kind === "bool") { raws[sp.key] = U[sp.ui].value; }
            else if (sp.kind === "idx") { raws[sp.key] = U[sp.ui].selection ? U[sp.ui].selection.index : sp.def; }
            else { raws[sp.key] = U[sp.ui].text; }
        }
        return serializePreset(raws);
    }

    // 预设对象 -> 回填面板控件(统一走"改控件", 不触发其它副作用)。由参数表驱动。
    //   ⚠️ 逐控件守卫: 某个控件不存在(布局漏建/未来增删参数)只跳过该参数,
    //      绝不让整个「应用预设」炸掉 —— v1.5.0 TypeError 的防御性加固。
    function applyParamsToUI(U, p) {
        if (!p) { return; }
        for (var i = 0; i < PARAM_SPECS.length; i++) {
            var sp = PARAM_SPECS[i];
            if (!U[sp.ui]) { continue; }
            var v = p[sp.key];
            if (sp.kind === "bool") { U[sp.ui].value = !!v; }
            else if (sp.kind === "idx") {
                if (v >= 0 && v < U[sp.ui].items.length) { U[sp.ui].selection = U[sp.ui].items[v]; }
            } else {
                U[sp.ui].text = String(v);
            }
        }
    }

    // 参数即时生效绑定(由参数表驱动):
    //   mode != "rebuild" -> onChange 里直接推给工程对象(控制器滑块 / 点位滑块 / 形状图层)
    //   mode == "rebuild" -> onChange 里【明确提示】需要重新生成(结构性参数不再静默)
    // 这条"按 mode 分流"的规则替代了原来手工给 3 个字段挂 onChange 的写法 ——
    // 审计发现: 12 个参数里 9 个改完没反应, 而 UI 上只有一句提示暗示, 用户会以为坏了。
    function bindLiveParam(pal, U, key) {
        var sp = paramSpec(key);
        if (!sp || !U[sp.ui]) { return; }
        U[sp.ui].onChange = function () {
            try {
                if (sp.mode === "rebuild") {
                    setStatus(pal, "「" + sp.label + "」是结构性参数 — 点「生成 / 重建」生效。", C_WARN);
                    return;
                }
                var n = pushParam(pal, U, key);
                if (n > 0) {
                    setStatus(pal, "「" + sp.label + "」已应用(立即生效)。" + visibleCountHint(getComp()), C_OK);
                } else if (n === 0) {
                    setStatus(pal, "还没有生成, 请先点「生成 / 重建」。", C_WARN);
                } else {
                    setStatus(pal, "「" + sp.label + "」需要合法的数字。", C_WARN);
                }
            } catch (eOC) {
                // onChange 里抛错同样静默 —— 落进调试输出区
                diag("!! onChange(" + sp.label + ") 异常: " + eOC);
                flushDiag(pal);
                setStatus(pal, "「" + sp.label + "」应用出错, 详情见「调试输出」。", C_ERR);
            }
        };
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

    // ---------- UI 层(v1.0.0: 控件由参数表生成) ----------
    // 三个分组(排列 / 高度 / 起伏), 组内每行放哪些参数由 UI_ROWS 指定。
    // 加参数只需两步: ① PARAM_SPECS 里加一行 ② 在 UI_ROWS 里挑个位置 ——
    //   建控件 / 读面板 / 存预设 / 填面板 / onChange 推送 全部自动覆盖。
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "山峰频谱", undefined, { resizeable: false });

    pal.orientation = "column";
    pal.alignChildren = "fill";
    pal.spacing = 8;
    pal.margins = 12;

    var U = {};

    var UI_GROUPS = ["排列", "高度", "节奏", "起伏"];
    var UI_ROWS = [
        ["n", "w", "gap"],
        ["baseH", "baseRatio"],
        ["ph", "edge"],
        ["rhyN", "rhyPct", "rhyFw"],
        ["ftype"],
        ["mode"],
        ["pts"]
    ];

    var uiG, uiRi, uiCi, uiPanel, uiSpec, uiRow, uiLbl;
    for (uiG = 0; uiG < UI_GROUPS.length; uiG++) {
        uiPanel = pal.add("panel", undefined, UI_GROUPS[uiG]);
        uiPanel.orientation = "column";
        uiPanel.alignChildren = "fill";
        for (uiRi = 0; uiRi < UI_ROWS.length; uiRi++) {
            uiRow = null;
            for (uiCi = 0; uiCi < UI_ROWS[uiRi].length; uiCi++) {
                uiSpec = paramSpec(UI_ROWS[uiRi][uiCi]);
                if (!uiSpec || uiSpec.group !== UI_GROUPS[uiG]) { continue; }
                if (!uiRow) {
                    uiRow = uiPanel.add("group");
                    uiRow.orientation = "row";
                    uiRow.alignChildren = "center";
                }
                uiLbl = uiRow.add("statictext", undefined, uiSpec.label + ":");
                if (uiSpec.kind === "idx") {
                    U[uiSpec.ui] = uiRow.add("dropdownlist", undefined, uiSpec.items);
                    U[uiSpec.ui].selection = uiSpec.def;
                } else {
                    U[uiSpec.ui] = numBox(uiRow, uiSpec.chars, String(uiSpec.def));
                }
            }
        }
        // 复选框类参数(自动铺满)整行显示在所属分组末尾
        for (uiCi = 0; uiCi < PARAM_SPECS.length; uiCi++) {
            uiSpec = PARAM_SPECS[uiCi];
            if (uiSpec.group === UI_GROUPS[uiG] && uiSpec.kind === "bool") {
                U[uiSpec.ui] = uiPanel.add("checkbox", undefined, uiSpec.check);
                U[uiSpec.ui].value = uiSpec.def;
            }
        }
    }

    // 柱子颜色(v1.5.2): 按钮弹 AE 原生取色器($.colorPicker) —— 实时生效。
    //   ⚠️ ScriptUI 的 "colorpicker" 控件在 AE 的 ScriptUI Panels(palette) 里报
    //   "UI element type 'colorpicker' is unknown or invalid in this context"(v1.5.1 实测),
    //   只能改用 $.colorPicker。按钮文字实时显示当前颜色 hex。
    //   v1.5.3: 初始文字直接显示默认色 #FFFFFF(不打开工程也能看到默认值)。
    var colorRow = pal.add("group");
    colorRow.orientation = "row";
    colorRow.alignChildren = ["left", "center"];
    colorRow.add("statictext", undefined, "柱子颜色:");
    var cpFillBtn = colorRow.add("button", undefined, "#FFFFFF");
    cpFillBtn.helpTip = "点击打开取色器修改柱子颜色(实时生效)";
    pinW(cpFillBtn, 110);
    function colorToHex(c) {
        function hx(v) {
            var h = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
            return (h.length < 2 ? "0" : "") + h;
        }
        return "#" + hx(c[0]) + hx(c[1]) + hx(c[2]);
    }
    // 从当前合成的柱图层读回颜色 -> 按钮文字(生成后/面板启动时同步, 避免显示与实际脱节)
    function syncFillColorPicker() {
        try {
            var comp = getComp();
            if (!comp) { return; }
            var bars = findLayer(comp, LAYER_BARS);
            if (!bars) { return; }
            var c = bars.property("ADBE Effect Parade").property(SL_COLOR).property(1).value;
            if (c && c.length >= 3) { cpFillBtn.text = colorToHex(c); }
        } catch (eSync) {}
    }
    cpFillBtn.onClick = safeRun("柱子颜色", function () {
        var comp = getComp();
        if (!comp) { setStatus(pal, "还没有打开工程。", C_WARN); return; }
        var bars = findLayer(comp, LAYER_BARS);
        if (!bars) { setStatus(pal, "还没有生成, 请先点「生成 / 重建」。", C_WARN); return; }
        var cur = [1, 1, 1];
        try {
            var c0 = bars.property("ADBE Effect Parade").property(SL_COLOR).property(1).value;
            if (c0 && c0.length >= 3) { cur = [c0[0], c0[1], c0[2]]; }
        } catch (e0) {}
        var init = (Math.round(Math.max(0, Math.min(1, cur[0])) * 255) << 16) |
                   (Math.round(Math.max(0, Math.min(1, cur[1])) * 255) << 8) |
                    Math.round(Math.max(0, Math.min(1, cur[2])) * 255);
        var ret = $.colorPicker(init);
        if (ret === undefined || ret === null) { return; }
        var c = [((ret >> 16) & 255) / 255, ((ret >> 8) & 255) / 255, (ret & 255) / 255, 1];
        var e = bars.property("ADBE Effect Parade").property(SL_COLOR);
        if (!e) { addColorControl(bars, SL_COLOR, c); } else { e.property(1).setValue(c); }
        cpFillBtn.text = colorToHex(c);
        setStatus(pal, "柱子颜色已更新(实时生效)。", C_OK);
    });

    // 按钮
    var b1 = pal.add("group");
    b1.alignment = "fill";
    var btnGen = b1.add("button", undefined, "生成 / 重建");
    var btnPts = b1.add("button", undefined, "重设点位");
    var b2 = pal.add("group");
    b2.alignment = "fill";
    var btnEdge = b2.add("button", undefined, "均分边缘点");
    var btnRnd = b2.add("button", undefined, "随机波峰");
    var btnClr = b2.add("button", undefined, "清理");
    var btnDiag = b2.add("button", undefined, "诊断");

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
            b.onClick = safeRun("存储预设 槽" + idx, function () { saveSlot(pal, U, idx); });
        })(pi);
    }
    var btnSlotClear = saveRow.add("button", undefined, "清除全部");
    btnSlotClear.onClick = safeRun("清除全部预设", function () { clearAllSlots(pal); });

    var loadRow = pPre.add("group");
    loadRow.orientation = "row";
    loadRow.alignChildren = ["left", "center"];
    loadRow.spacing = 4;
    var lLbl = loadRow.add("statictext", undefined, "使用");
    lLbl.preferredSize.width = 40;
    for (var pj = 1; pj <= SLOT_COUNT; pj++) {
        (function (idx) {
            var lb = loadRow.add("button", undefined, String(idx));
            lb.preferredSize.width = 28;
            lb.enabled = false;   // 空槽位禁用, 由 updateSlotLoadBtns 按缓存启停
            lb.onClick = safeRun("使用预设 槽" + idx, function () { loadSlot(pal, U, idx); });
            gSlotLoadBtns.push(lb);
        })(pj);
    }
    var btnSlotReset = loadRow.add("button", undefined, "复位");
    btnSlotReset.onClick = safeRun("复位", function () { resetInputs(pal, U); });

    var ioRow = pPre.add("group");
    ioRow.orientation = "row";
    ioRow.alignChildren = ["left", "center"];
    ioRow.spacing = 4;
    var btnSlotExp = ioRow.add("button", undefined, "导出配置");
    btnSlotExp.onClick = safeRun("导出配置", function () { exportSlots(pal); });
    var btnSlotImp = ioRow.add("button", undefined, "导入配置");
    btnSlotImp.onClick = safeRun("导入配置", function () { importSlots(pal); });

    // 提示
    var tip = pal.add("statictext", undefined,
        "【宽度】拖「山峰点 k【左缘】」「山峰点 k【右缘】」两个空对象 —— 拖哪个改哪一侧, 两边可以不同宽(左缓右陡)。"
        + "删掉某一侧 = 该侧退回自动宽度;「均分边缘点」= 一键回到自动宽度。"
        + "一个波峰 = 一组 3 个控制点(峰 + 左 + 右), M 个波峰 = M 组。"
        + "【改完立即生效】矩形宽 / 间距 / 基础高度 / 基线% / 起伏曲线 / 叠加方式 / 点位高度 / 边缘高度%"
        + "(点位高度 0 = 自动跟随点位 Y; 边缘高度% = 窗口最边缘那根保留【地板之上可用高度】的百分比)。"
        + "【需重新生成】数量 / 自动铺满 / 点数 —— 结构性参数, 改完会提示。"
        + "【最高高度】拖「山峰 总高度闸」空对象: 它离基线多高, 整排最高柱就多高, 其余各峰等比缩放(形状不变);"
        + "拖到基线 = 整排压平; 删掉这一层 = 关闭总闸。"
        + "状态栏回报【实际可见根数 | 最高高度】。行位置 = 拖「山峰 柱」图层。", { multiline: true });
    pinW(tip, 320);

    // 状态
    var sp = pal.add("panel", undefined, "状态");
    sp.alignChildren = "fill";
    pal.status = sp.add("statictext", undefined,
        "就绪 — 打开合成后点「生成 / 重建」。", { multiline: true });
    pal.status.alignment = ["fill", "center"];
    pinW(pal.status, 320);

    // 参数即时生效: 由参数表统一绑定(mode == "rebuild" 的只提示需重新生成, 不再静默)
    for (var uiBind = 0; uiBind < PARAM_SPECS.length; uiBind++) {
        bindLiveParam(pal, U, PARAM_SPECS[uiBind].key);
    }

    // ---- 调试输出区(v1.1.1): 诊断/错误详情都落在这里, 「复制」一键拿走 ----
    //   放在绑定之后建, bindLiveParam 的 onChange 出错也能落进来(flushDiag 判空不炸)
    var dbgPanel = pal.add("panel", undefined, "调试输出(反馈用)");
    dbgPanel.alignChildren = "fill";
    pal.debugBox = dbgPanel.add("edittext", undefined, "", { multiline: true, readonly: true });
    pal.debugBox.preferredSize = [320, 110];
    pinW(pal.debugBox, 320);
    var dbgRow = dbgPanel.add("group");
    dbgRow.alignment = "fill";
    var btnCopyDbg = dbgRow.add("button", undefined, "复制");
    var btnClearDbg = dbgRow.add("button", undefined, "清空");
    btnCopyDbg.onClick = function () {
        if (copyBoxToClipboard(pal.debugBox)) {
            setStatus(pal, "调试信息已复制到剪贴板。", C_OK);
        } else {
            setStatus(pal, "自动复制失败, 请在框内点一下再 Ctrl+A / Ctrl+C。", C_WARN);
        }
    };
    btnClearDbg.onClick = function () {
        gDiag.length = 0;
        flushDiag(pal);
        setStatus(pal, "调试输出已清空。", C_OK);
    };

    // safeRun: 所有按钮 handler 统一入口 —— AE 的 ScriptUI handler 抛错是【静默】的,
    //   这是"点击没反应"的根源; 这里兜住并弹可复制的错误详情。
    function safeRun(label, fn) {
        return function () {
            try {
                gDiag.length = 0;              // 每次操作只保留本次诊断(NumCounter 同款)
                diag("操作: " + label);
                fn();
            } catch (e) {
                diag("!! handler 异常: " + (e ? e.toString() : e));
                showDebugError(e, label);
            }
            flushDiag(pal);
        };
    }

    // 诊断: 把环境/工程/图层/滑块/面板参数一次性写入调试输出区(可复制反馈)
    function dumpDiagnostics() {
        gDiag.length = 0;
        diag("---- 山峰频谱诊断 ----");
        diag("脚本版本: 1.5.2");
        diag("AE 版本: " + app.version);
        diag("工程: " + ((app.project && app.project.file) ? app.project.file.fsName : "(未保存)"));
        var comp = getComp();
        if (!comp) {
            diag("活动合成: 无  <-- 如果你在点按钮\"没反应\", 最常见原因就是时间轴里没有激活的合成");
        } else {
            diag("合成: " + comp.name + "  " + comp.width + "x" + comp.height
                + "  " + (Math.round(comp.frameRate * 100) / 100) + "fps");
            var bars = findLayer(comp, LAYER_BARS);
            var ctrl = findLayer(comp, LAYER_CTRL);
            var hgt = findLayer(comp, LAYER_HGT);
            diag("图层: 柱=" + (bars ? "✓" : "✗") + " 控制=" + (ctrl ? "✓" : "✗")
                + " 高度总闸=" + (hgt ? "✓" : "✗"));
            diag("点位数: " + countPoints(comp)
                + (bars ? ("  矩形组数: " + countBars(bars)) : ""));
            if (ctrl) {
                var names = [SL_W, SL_G, SL_BASE, SL_MODE, SL_FTYPE, SL_EDGE,
                             SL_RHY_ON, SL_RHY_N, SL_RHY_PCT];
                var vals = [], ni;
                for (ni = 0; ni < names.length; ni++) {
                    var v = "?";
                    try { v = ctrl.effect(names[ni])(1); } catch (eR) { v = "(缺)"; }
                    vals.push(names[ni] + "=" + v);
                }
                diag("控制器滑块: " + vals.join(" | "));
            }
            if (bars) {
                try {
                    var bp = bars.transform.position.value;
                    diag("柱图层位置: [" + bp[0].toFixed(1) + ", " + bp[1].toFixed(1) + "]");
                } catch (eB) { diag("柱图层位置: 读取失败 " + eB); }
            }
        }
        // 面板当前参数(7+3 个输入框的原文)
        try {
            var cp2 = collectParams(U);
            var kv = [], kk;
            for (kk in cp2) { if (cp2.hasOwnProperty(kk)) { kv.push(kk + "=" + cp2[kk]); } }
            diag("面板参数: " + kv.join(" "));
        } catch (eC) { diag("面板参数: 收集失败 " + eC); }
        diag("----------------------");
        flushDiag(pal);
        setStatus(pal, "诊断信息已写入下方「调试输出」, 点「复制」即可粘贴反馈。", C_OK);
    }

    btnGen.onClick = safeRun("生成 / 重建", function () { generate(pal, U); syncFillColorPicker(); });
    btnPts.onClick = safeRun("重设点位", function () { resetPoints(pal, U); });
    btnEdge.onClick = safeRun("均分边缘点", function () { uniformEdgePoints(pal, U); });
    btnRnd.onClick = safeRun("随机波峰", function () { randomPeaks(pal, U); });
    btnClr.onClick = safeRun("清理", function () { cleanAll(pal); });
    btnDiag.onClick = safeRun("诊断", function () { dumpDiagnostics(); });


    // 启动: 读一次工程目录里的预设槽 + 起常驻轮询(之后打开/切换工程会自动重读)
    //   整段兜底 —— 启动期抛错同样会让面板"看起来正常但什么都不响应"
    try {
        diag("面板已加载 v1.5.3");
        flushDiag(pal);
        watchProject(pal);
        startProjectWatch(pal);
        syncFillColorPicker();   // 面板启动时从当前合成读回柱色, 避免取色器与实际脱节
    } catch (eBoot) {
        diag("!! 启动异常: " + eBoot);
        flushDiag(pal);
        showDebugError(eBoot, "面板启动");
    }

    if (pal instanceof Window) {
        pal.preferredSize.width = 340;
        pal.center();
        pal.show();
    } else {
        pal.layout.layout(true);
    }

})(this);
