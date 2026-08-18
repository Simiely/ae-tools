# AGENTS.md · 项目规则

> 📌 **文档基线**：2026-08-03（commit `bc0a3ab`）完成四件套重写
> **更新文档/代码后，请更新此行**（日期 + 新 commit hash），并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects 2026 中文版 + **ExtendScript（ES3）**：无 `const`/`let`、模板字符串、箭头函数、`class`、**无内置 `JSON` 对象**
- 单文件 IIFE 结构，无构建工具，约 1174 行（v3.5）

## 关键坑（改代码前必读）

1. **Range Selector 只用 Percent 模式**：Index 模式的 Start/End 在 AE 2026 是隐藏 3D 属性，`setValue()` 报错；且 Units 默认 Percent，只设 Index 值会被忽略
2. **AE 2026 中文版 matchName 有差异**：属性访问一律用候选 fallback 列表（见 `addAnimProperty()`），Text Animators 可能在 `ADBE Text Properties` 内部（见 `findAnimatorsGroup()`）
3. **`textIndex` 表达式变量不可用**：逐字效果用「每字符独立动画器 + 硬编码索引」实现，不要依赖表达式索引
4. **数值单位坑**：Scale 属性值本身就是百分比（直接传原值，别除 100）；Tracking Amount 需 `* 0.1` 才匹配面板直观值
5. **`seedRandom(seed, true)`**：第二个参数 `true` = timeless mode，保证每帧返回相同值；位置/大小/模糊用不同种子偏移（+9999 / +5555）隔离

## 约定

- UI 标签用中文；生成动画器统一 `歌词_` 前缀（便于清除识别）
- 每个动画器模块带独立启用开关（checkbox 总开关）
- 参数默认值集中在 `DEFAULTS` 对象，新增参数必须同步加进去
- 表达式构建用数组 `join`，不用 `+=` 拼接

## 常用命令

- **语法检查**：`node --check 歌词逐字散落动画工具.jsx`（Node 只验证 ES3 语法，不能运行 AE API）
- 无构建 / 无测试命令；发布 = 改版本号 + 更新 CHANGELOG.md + README
- 详细开发记录见 DEVELOPMENT.md；版本历史见 CHANGELOG.md
