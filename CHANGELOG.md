# 更新日志（CHANGELOG）

## v1.1.0（当前版本）

- 新增 **QuickKey**（`panels/QuickKey/`）：节点式 K 帧排程面板——当前时间指示器为锚点（起始/中间/末尾），5 节点位可开关 + 帧距数字 + 每节点数值列（逗号分隔支持多维，留空=用当前值），一键给选中属性（`selectedProperties`）批量打帧，单 Undo 组可整体撤销
- v0.2.0 新增**曲线功能**：预设下拉（自定义 + 内置线性/缓入/缓出/缓入缓出 + 导入）+ x1 y1 x2 y2 输入（cubic-bezier），选预设自动填数/手填匹配显示预设名，导出/导入预设 JSON（默认工程目录），打帧自动套用缓动
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
- 状态：开发中（v0.2.14，曲线功能待真机验证）；四件套文档齐 + test_quickkey.js 回归测试（105 断言）

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
