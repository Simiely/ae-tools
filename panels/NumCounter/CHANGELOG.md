# 更新日志（CHANGELOG）

## v0.2.8（2026-09-01 修复「存储后使用按钮不变可用」）

- **现象**: 点「存储预设 N」成功后, 对应的「使用预设 N」按钮仍是灰的(不可用), 需重启 AE 才生效
- **根因(ScriptUI 行为, 搜索权威确认)**: 在按钮 `onClick` 回调里同步修改另一个控件的 `.enabled` 后, AE 不会自动重绘该控件 —— 启动阶段之所以正常, 是因为脚本末尾 `pal.layout.layout(true)` 兜底刷新了一次; 但「存储」发生在事件循环里, 没有这步兜底, 故视觉态没更新
- **权威证据**: Adobe 社区 Marc Autret 正确回答 — 在 `onClick` 中改控件外观后必须调用 `win.layout.layout(1)` 强制重绘(LayoutManager 标准手法)
- **修复**: `updateSlotLoadBtns(pal)` 在所有槽位状态写完后调用 `pal.layout.layout(true)` 强制刷新; 该函数由 `saveSlot / clearAllSlots / importSlots / loadSlotsFromStorage` 调用并统一传入 `pal`
- **验证**: node 语法 OK + 60 断言全过; install.py 部署 AE 26.0; 推 GitHub

## v0.2.7（2026-09-01 预设改为「4 槽位」模式, 对齐仓库预设槽实践）

- **需求**: 用户要求预设改成仓库其他插件(AE-Lyrics-Animator / starry-sky / Water-Rise / Rolling-Lyrics / QuickKey)统一的「预设槽」形式, 而非 v0.2.5/0.2.6 的「名称下拉 + 保存/应用/删除」
- **做法(1:1 复用仓库实践, 但避开 app.settings)**:
  - 参考 **AE-Lyrics-Animator** 的源头实现(`存储1-4 / 使用1-4 / 清除全部 / 复位` 按钮 + `presetsCache` 内存缓存), 改为 NumCounter 的 `存储预设 1-4 / 使用预设 1-4 / 清空全部 / 导出预设… / 导入预设…`
  - 4 个固定槽位 + `presetsCache["1".."4"]` 内存缓存; **空槽位 = null**(对应「使用」按钮灰色禁用)
  - 持久化**只用工程目录 JSON**(单层): 启动时 `loadSlotsFromStorage()` 读 `NumCounter.presets.json` 恢复槽位; 文件格式 `{version, slots:{ "1": 参数对象|null, ... "4": null }}`, 手写 `slotsToJson` 构造 + 受控 `jsonParseSlots` 解析(ES3 禁 JSON, 仅 `{` 开头才 eval)
  - **刻意不采用 `app.settings`**: v0.2.5 已证实 `saveSetting` 第 4 参传字符串会被 AE 拒绝(`user 不是无符号整数`), 故只走工程目录文件, 与「预设跟工程走」诉求一致
  - 参数收集/回填复用既有 `serializePreset` / `deserializePreset` 归一化, 抽成 `collectParams(pal)` / `applyParamsToUI(pal, p)`
- 面板 CHANGELOG v0.2.7 / 根 CHANGELOG v1.3.9

## v0.2.6（2026-09-01 修复「数字始终不动」的真正根因 + 预设升级为 JSON）

- **现象**: v0.2.0–v0.2.5 全程「生成成功但数字不递增」; v0.2.4 把控制层改回 enabled=true 仍无效
- **真正根因(经搜索权威确认, Adobe 官方 Property 文档 + AE 标准手册示例)**:
  `Property.setValueAtTime` 签名 = **`(time, newValue)`(时间在前、值在后)**。本插件自 odometer 引入起一直写成
  `valProp.setValueAtTime(startVal, t0)`, 把「值」误送到「时间」参数:
  - `setValueAtTime(0, 0)` 碰巧对(时间0/值0)
  - `setValueAtTime(100, 1.0)` 被解释成「时间=100 秒 / 值=1.0」→ 第二个关键帧落在 100 秒处
  - 整个可见播放区间(0~1s)内数值恒≈0 ⇒ **数字根本不动**
  - 这就是 v0.2.0 起「数字不动」的恒定主因; v0.2.4 的 `enabled=true` 只是排除了「禁用冻结」这个次要因素, 并未触及参数顺序
- **修法**: 改用无歧义的 `addKey(t) + setValueAtKey(k, v)`(两者签名均为「时间/索引在前」, 与顺序无关); 并对数值滑块做**数据层验证** —— 生成后读 `numKeys` 与 `valueAtTime(t0)/valueAtTime(t1)`, 确认关键帧数=2 且 t0→t1 数值确实从 startVal 变到 targetVal; 若 numKeys<2 直接报错提示而非静默生成
- **预设文件升级为真正 JSON**: `NumCounter.presets`(每行 `name|序列化串`) → **`NumCounter.presets.json`(标准 JSON 数组)**, 便于人工查看/编辑。因仓库规范 ES3 禁用 `JSON.parse/stringify`, 写入用手写 `presetsToJson` 构造、读取用受控 `jsonParseArray`(仅当首字符为 `[` 时 `eval`, 文件为本脚本自生成的可信预设); 旧 `key=value&` 字符串仍可被 `deserializePreset` 兼容读取
- 面板 CHANGELOG v0.2.6 / 根 CHANGELOG v1.3.8

## v0.2.5（2026-09-01 修复「保存预设报错」+ 预设改为工程目录文件）

- **现象**: 保存预设报 `Error: After Effects错误: 由于参数 4，无法调用"saveSetting"。user 不是无符号整数。`（第 555 行附近）
- **根因(经搜索权威确认)**: v0.2.2 用 `app.settings.saveSetting(section, key, value, "user")` 存预设, 第 4 参传了字符串 `"user"`; 官方 AE 脚本指南(ae-scripting.docsforadobe.dev · Settings object)写明 `saveSetting(sectionName, keyName, value[, prefType])`, 第 4 参是 `prefType`(PREFType 枚举, 实为无符号整数), 传字符串即被拒 → 报错。此外 `app.settings` 存进全局 AE 偏好, 不随工程走、且有 1999 字节上限, 与「预设存工程目录」的诉求不符
- **修法**: 预设改为**工程目录文件存储** —— `app.project.file.parent` 取工程所在目录, 写 `NumCounter.presets`(UTF-8, 每行 `name|序列化串`), 保存/应用/删除全走文件读写; 工程未保存时提示先 Ctrl/Cmd+S; 写文件需开启 AE 首选项「允许脚本写入文件与访问网络」
- **纠正**: v0.2.2 用 `app.settings` 持久化预设的方案本版废弃; 序列化纯函数 serializePreset/deserializePreset 保留, 新增文件行纯函数 sanitizePresetName/formatPresetLine/parsePresetLine 进 test(新增 9 断言, 共 41)
- 面板 CHANGELOG v0.2.5 / 根 CHANGELOG v1.3.7

## v0.2.4（2026-09-01 修复「生成成功但数字不动」）

- **现象**: 生成无报错、调试输出全 OK, 但播放时数字不递增
- **根因(经搜索权威确认, After Effects HelpX「表达式错误」+ CSDN AE 社区高采纳)**:
  1. 控制空对象被 `ctrl.enabled = false` 禁用(空对象本就不渲染, 禁用纯多余) → 其滑块关键帧在播放时**不更新** → 数位图层读到的数值恒定 → 不动
  2. 多次运行后存在多个同名 `NumCounter 控制` 层, `thisComp.layer(...)` 可能命中旧的、无关键帧的控制层
  3. 关键帧锚在 `comp.time`, 播放头在尾部时整段动画落在可视范围外 → 看似不动
- **修法**:
  1. 控制层**保持 enabled=true**(空对象不可见且关键帧可正常驱动表达式)
  2. 生成前**清理上次的控制层 + 数位层**, 保证 `thisComp.layer(CTRL_NAME)` 命中带关键帧的当前控制层
  3. 关键帧锚点兜底: 播放头锚定, 超出合成时长则回退到 0
  4. 数位表达式改用 Adobe 官方 pickwhip 标准写法 `ctrl.effect("数值")(1)`(比 `("Effects")` 更稳, 用索引(1)取滑块值、与中文版属性名无关)
- 面板 CHANGELOG v0.2.4 / 根 CHANGELOG v1.3.6

## v0.2.3（2026-09-01 「对象无效」权威根因修复）

- **真正根因(经搜索权威确认)**: `Effects` 是 AE 的「索引属性组」, 每次 `addProperty()` 都会使同组内**所有既有引用失效**(ae-scripting.docsforadobe.dev > PropertyBase > Reference invalidation; omino blog; Dan Ebberts / Tomas Sinkunas 在 Adobe 社区确认)。v0.2.0–v0.2.2 连续报错的第 319 行 `fxVal.property(1)` 正是因为在 `fxStep`/`fxDec` 的 addProperty 之后, `fxVal` 已被判无效
- **权威修法**: 三个滑块效果全部 `addProperty` 完成后, **再按名字重新取回**(`ctrl.Effects.property("数值")` 等)再访问其子属性; 绝不在两次 addProperty 之间持有引用取值
- **表达式同步**: 数位图层 sourceText 表达式引用滑块值改为索引 `("数值")(1)`, 与脚本侧一致且不受 AE 语言包影响
- **scheduleTask 纠错**: v0.2.2 把 scheduleTask 误当根因修复, 本版更正 —— 它只是避免面板回调阻塞 UI, 与「对象无效」无关
- 面板 CHANGELOG v0.2.3 / 根 CHANGELOG v1.3.5

## v0.2.2（2026-09-01 调试 + 预设）

- **调试输出区 + 预设**: 本版新增「调试输出」只读框与预设存储(见下); 另加 `app.scheduleTask` 延迟生成逻辑。**注意**: 当时把 scheduleTask 误判为「对象无效」根因修复, 实测未打中 —— 真正根因见 v0.2.3(索引属性组 addProperty 使同组引用失效)
- **调试输出区**: 面板底部新增「调试输出」只读框, 每次生成实时显示诊断(comp/ctrl/fxVal 类型·instanceof·numProperties·三层 property 尝试结果); 失败时额外弹窗 + 状态栏 + 调试框三处给详情, 便于复制反馈
- **预设存储/使用**: 用 `app.settings` 跨会话持久化参数组合; 新增「预设」区(下拉 + 保存/应用/删除); 序列化纯函数 serializePreset/deserializePreset 进 test(新增 13 断言, 共 32)

## v0.2.1（2026-09-01 真机修复）

- 修复生成时报 `ReferenceError: 对象无效`(第 319 行 `fxVal.property(1)`): 新图层滑块子属性被 AE 判为无效对象
- 根因规避: 生成前 `comp.openInViewer()` 强制激活合成; `ctrl.enabled = false` 后移到所有滑块值设置完成之后(提前禁用会导致子属性被判无效)
- 滑块值属性取用加多层 fallback(`property(1)` → `eff(1)` → 中文名 "滑块"), 失败给友好报错而非崩溃

## v0.2.0（2026-09-01 架构升级）

- **架构改为「独立数位 / odometer」**:每次生成把每一位拆成固定槽位的独立文本图层,由共享「数值」滑块(控制空对象 `NumCounter 控制`)驱动,每位表达式只截取自己那一位字符
- **效果**:任意比例字体(含思源黑体/Arial 等)计数也零抖动——每位待在自己槽里,邻居不动;不再依赖等宽字体
- **字体 + 字重两级联动**:基于 `app.fonts.allFonts` 枚举家庭名,选家庭后重建字重下拉(Regular/Bold/Italic...),写入 PostScript 名(含字重)
- **移除前后缀**:按用户要求不做进面板(可另行手动加图层);纯函数 `formatNumber` 仍保留 pre/suf 参数兼容
- **字距更名为「字间距(px)」**:在数位模式下作槽位间额外间距;数位图层 tracking 置 0(单字符无意义)
- 离线验证:node 模拟数位截取(右对齐/符号/小数/步进吸附)8 例全部符合预期
- ES3 语法 `node --check` + 19 项纯逻辑断言通过;雷区(保留字属性/正则`\\`/const/let/箭头)扫描无

## v0.1.1（2026-09-01 真机修复）

- **修复**:`doc.justification` 在 AE 2026 报错「无法设置 justification,值未定义」—— 根因是 `ParagraphJustification` 成员名已从 `LEFT/CENTER/RIGHT` 改为 `LEFT_JUSTIFY/CENTER_JUSTIFY/RIGHT_JUSTIFY`。改用 `getJustification()` 兼容两种命名,取不到则跳过(不再崩溃)
- **改进**:字体由手填 edittext 改为**系统字体下拉**(基于 `app.fonts.allFonts` 枚举家庭名,映射 PostScript 名);「等宽锁定」勾选时自动禁用字体下拉并强制 Consolas
- 字体/对齐设置均包 try/catch,单一项失败不影响计数动画

## v0.1.0（当前版本, 2026-09-01 首发）

- 新增 **NumCounter**(`panels/NumCounter/`):数字计数器面板 —— 填起始/目标/帧数,一键生成数字递增动画
- 核心:**表达式 + 滑块驱动**(「数值」滑块关键帧 = 时间轴, sourceText 表达式实时格式化),生成后仍可拖滑块/关键帧调整,无需重跑
- 控制项:起始数字 / 目标数字 / 总帧数 / 步进值(每次跳多少) / 小数位(0~4) / 字距 / 字体 / 等宽锁定 / 对齐(左中右) / 前缀 / 后缀 / 缓动(线性/缓入/缓出/缓入缓出)
- 抖动修复:等宽锁定(强制 Consolas 等宽字体)+ 对齐(中/右)组合,彻底消除数字变化时的宽度跳动
- 纯逻辑层 `snapToStep` / `formatNumber` 进 `test_NumCounter.js`(19 项断言);ES3 语法 `node --check` 通过
- 单 Undo 组包裹;UTF-8 BOM 由 install.py 自动补
- 待真机验证:缓动手感(语义按标准 recipe,失败退化为线性)
