# AGENTS.md · 项目规则

> 📌 **文档基线**：2026-08-18（commit `35b90c9`）滚动句数不限行数 v2.0.6
> **更新文档/代码后，请更新此行**（日期 + 新 commit hash），并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects **2026（内部版本 26.0）中文版** + ExtendScript（**ES3**：无 const/let/箭头函数/模板字符串/JSON，语法检查用 `node --check`）
- ScriptUI Panel 单文件交付，免安装（放 `ScriptUI Panels/` 目录）
- 脚本文件必须 **UTF-8 带 BOM**（ExtendScript 引擎否则中文乱码）

## 关键坑（改代码前必读）

1. **V2 是 v1 的独立迭代版**：`rolling-lyrics-v2.jsx` 与 `../AE-Rolling-Lyrics/rolling-lyrics.jsx`（v1，冻结）并存。改 V2 只动本目录文件，**绝不修改 v1 目录**；两版通过脚本文件名（rolling-lyrics.jsx / rolling-lyrics-v2.jsx）在 AE 菜单里区分
2. **组滚动模型**：V2 把歌词按 k 句一组（k = 滚动句数 1/2/3），组数 m = ⌈n/k⌉；**组步长 step = multiGap*(k-1) + gap**（组内 k-1 个组内行间距 + 组间 1 个间距）。滚动位置表达式（Lyrics_Ctrl）与每句位置表达式里的"当前组 idx"算法必须**完全一致**（同样的 times 累积 + seedRandom 流），否则滚动漂移
3. **缩放/透明度按组中心距离**：`d = |Lyrics_Ctrl.position[1] - Lyrics_Master.position[1]|`，整组同缩放同透明度（"一起到中心放大"）。不要改回按单句 `transform.position[1]`
4. **表达式引用中文效果名**：控件名「滚动句数」「组内行间距」等必须与 `addSliderControl` 的 name 完全一致；改控件名需同步改 3 处表达式（ctrl 位置、句位置、缩放/透明度）
5. **ScriptUI Panel 双窗口**：必须 `(thisObj instanceof Panel) ? thisObj : new Window(...)`（v1 已有，勿回归）
6. **UTF-8 BOM**：Write/Edit 工具产出无 BOM，`install.py` 部署时自动补；`node --check` 不认 `.jsx`，需复制为 `.js` 再查
7. **预设版本 v3**：新增短键 `lps`（linesPerScroll）/ `mg`（multiGap）；`fromPreset` 对缺失字段回退 DEFAULTS，旧预设（v2）兼容

## 约定

- UI 标签用中文；注释用中文；表达式代码用英文 + 中文效果名引用
- 每句一个图层（数量 = 歌词行数，不因分组变化）；分组只影响滚动/缩放逻辑
- 参数默认值集中在 `DEFAULTS`；新参数必须同时进 collectParams / toPreset / fromPreset / applyParams 四处
- 每次改动遵循单项目规范：README / AGENTS / DEVELOPMENT / CHANGELOG 四件套同步

## 常用命令

- 回归测试：`node test_rolling_lyrics_v2.js`（28 断言，**执行真实表达式字符串**：vm 加载 JSX → mock AE → 逐帧求值；改表达式后必须跑）
- 语法检查：`cp rolling-lyrics-v2.jsx _c.js && node --check _c.js && rm _c.js`
- 部署：仓库根 `python install.py`（自动检测 AE 版本 + 补 BOM + 字节校验）
- 补 BOM：Python 前插 `b'\xef\xbb\xbf'`
- **控件名改名**：只改 `CN` 常量对象（buildController / 表达式 / 面板显示名全同步）

## 详细规则（按需 @引用）

- @../../knowledge-base/模板库/单项目规范/README.md（如路径变化以实际为准）
- @../../knowledge-base/速查表/ES3语法限制速查.md
