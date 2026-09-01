# 更新日志（CHANGELOG）

## v0.2.2（2026-09-01 真机修复 + 预设 + 调试）

- **修复「对象无效」根因**: 第 319 行 `fxVal.property(1)` 在「窗口›扩展」Panel 上下文被 AE 判为无效对象。真正根因是 Panel 按钮 onClick 直接对 AE 项目树做深层修改的已知坑, 改用 `app.scheduleTask` 把生成逻辑延迟一帧到主线程上下文执行(此前 openInViewer/enabled 后移未打中)
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
