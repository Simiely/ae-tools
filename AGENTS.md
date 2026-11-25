# AGENTS.md · 项目规则

> 📌 **文档基线**：2026-11-25（commit `3a85641`）DialogueText 入库 v0.11.11（逐字选区与节奏改用非空白字符序号，真机通过）　← 前序：2026-11-17（`634efb2`）接入单项目规范机器层（link-only）
> **更新文档/代码后，请更新此行**（日期 + 新 commit hash），并在 CHANGELOG 追加版本

> 写给 AI / 未来维护者的项目上下文。只记录代码里看不出的信息。

## 技术栈

- Adobe After Effects **2026（内部版本 26.0）中文版** + ExtendScript（**ES3**：无 const/let/箭头函数/模板字符串/JSON，语法检查用 `node --check`）
  （ES3 限制速查见知识库 `../速查表/ES3语法限制速查.md`）
- ScriptUI Panel 单文件交付，免安装（放 `ScriptUI Panels/` 目录）
- 脚本文件必须 **UTF-8 带 BOM**（ExtendScript 引擎否则中文乱码）

## 关键坑（改代码前必读）

1. **ScriptUI Panel 双窗口**：从「窗口 > 扩展」打开时 AE 把 Panel 作为顶层 `this` 传入，必须 `var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)`，否则"空 Panel + 新 Window"并存（TimeAxisIndent 已踩，勿回归）
2. **无 UI 一次性脚本 ≠ 面板**：放 `ScriptUI Panels/` 会**残留空面板**（AE 固有行为，脚本关不掉）。无 UI 脚本只能放 `scripts/`（自写）或 `third-party/scripts/`（收集）。若脚本被迫在面板目录运行，顶部加 `try { if (this instanceof Window) { this.close(); } } catch (e) {}`（asu_NudgeKeyFrames 已按此改）
3. **UTF-8 BOM**：Write/Edit 工具产出无 BOM，`install.py` 部署时自动补；`node --check` 不认 `.jsx` 后缀，需复制为 `.js` 再查
4. **自写与收集严格分离**：`panels/` `scripts/` 只放自写；收集/第三方脚本一律进 `third-party/`（README 注明来源），不许混入自写目录
5. **git 推送**：本机无**全局** user.name/email —— 已在本仓库设过仓库级身份（`Simiely <124016031+Simiely@users.noreply.github.com>`，写在 `.git/config`，**不影响其他仓库**）。代理 7890。**2026-09-21 实测**：本仓库直接 push 即可成功，**不再需要** `-c http.https://github.com.proxy=...` 覆盖（此前记的"全局空值会覆盖真实代理"已不成立，别再默认套最复杂的那条命令）。最小可用：`GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c http.sslVerify=false push https://x-access-token:$GH_TOKEN@github.com/Simiely/ae-tools.git main`

6. **批量改文档要用脚本、且多行锚点必须转行尾**：本仓库文档是 **CRLF**，而脚本里的多行锚点习惯用 `\n` 写 —— 忘了 `old.replace("\n", nl)` 会**静默失配**（2026-09-21 实测：脚本在第 17 行 assert 就中断，后面 README/AGENTS/CHANGELOG 全没执行，但前面几步已写盘，看起来像"改了一半"）。同理 Write/Edit 工具产出的是 LF，改 `.jsx` 时要用脚本统一转回 CRLF + BOM。

## 约定

- UI 标签用中文；注释用中文；每目录一个 .jsx 主文件（+ 可选 test_*.js 模拟测试）
- 每次改动遵循单项目规范：README / AGENTS / DEVELOPMENT / CHANGELOG 四件套同步（见知识库 `../单项目规范/README.md`）
- 脚本头部保留 `Version / Description` 注释；版本号变更进 CHANGELOG
- **插件部署状态**：全部 12 个面板均为可部署状态（MountainSpectrum 已于 v1.5.4 正式交付并部署；DialogueText v0.11.8 已按用户要求改为「读取选中文本层就地加动画 + **贴合文字的文本框蒙版**（四边边距/羽化距离/羽化强度；横向滚动羽化向内、逐字出现羽化向外）+ **开头/结束动态曲线** + **两个互斥单选**：横向滚动 / 逐字出现（逐字出现 = 一整套：以文本框为窗口逐字出现 + 满窗整行左移 + 隐藏阶段**整行渐隐 100%→0% 并按「隐藏像素」同时左移**，出现/隐藏时长/隐藏像素可调；选中哪个就只显示并使用哪套参数）+ **逐字出现羽化向框外**（框内全清晰，文字不再右移，长句尾部的字也完整逐字出现）」，文字只在文字原位置的框内滑过，速度分布可选淡入淡出/前快后慢/前慢后快；默认隐藏像素 100、羽化 25；v0.11.1 把整体渐隐并入 `DT_滚动` 动画器（修掉 AE 26 上的「应用失败」）、错误信息统一走 `errText`、日志框加高到 10 行；v0.11.2 把渐隐关键帧改为 100 → 0（不再写越界的 -100，也不会整行变透明）；v0.11.3 每字动画器防御性复用自带默认选区；v0.11.4 把隐藏阶段渐隐改写进每字动画器（`DT_滚动` 只负责位置），修复覆盖全行的 100% 不透明度顶掉逐字出现；v0.11.5 把逐字出现的羽化改为向框外扩散、去掉位置表达式里的右移补偿，修复长文本尾部的字不逐字出现；v0.11.6 新增**段落文本框溢出修复**（AE 隐藏超出定界框的文字，把框高收到刚好容纳全部文字，宽度/换行不变），修复「出现 6 秒像没生效、长句后半段不出现」，并打印文本层类型/字号/行距/入出点与关键帧读回核对；v0.11.7 溢出判定改用 AE 官方 `TextDocument.boxOverflow`（无溢出完全不动框；有溢出用倍增 + 二分定框高，写回后复核、失败还原、`boxTextPos` 复位；旧版 AE 自动退回撑高探测），不再依赖 `sourceRectAtTime` 的返回语义；v0.11.8 **段落文本不再拉高框** —— 改为把排版框**单行化**（框高保持一行、宽度倍增 + 二分加到能装下整行，不改文字/字体/字号/图层位置），**原框（宽高都不动）作为出现窗口**，文字在框内像终端一样从右往左流动；原框尺寸存进蒙版名 `DT_窗口 595x49`，重复应用仍按原框当窗口（不会把加宽的排版框误当窗口）；v0.6.0 把日志改为节流落盘（首次加载提速）、说明文字改用静态文本；v0.11.9（已撤回）与 v0.11.10 把逐字选区改为**索引单位**并**每个动画器逐个切**（写 `ADBE Text Index Start/End`，百分比那对在索引模式下是隐藏属性）；v0.11.11 把选区索引与节奏改为**非空白字符序号**（AE 26 真机：索引单位下空格不占索引，按原文下标排会让空格后第一个字从 0 秒起一直显示）；v0.3 的画面内缩框与 v0.2 的空对象控制器均已移除；506 断言通过，v0.11.11 已真机验证（2026-11-25）；此前「待开发，禁止部署」的标注已作废 —— 它的源码早已并入 `panels/MountainSpectrum/`）
- **新面板从 `_template/` 起步**：`python new_panel.py MyPanel "我的面板"` 一条命令派生（复制 + 改名 + 替换标识 + 生成四件套）。模板承载的是**踩过坑才定下的约定**（`safeRun` 包裹所有 handler / `pinW` 三处都写 / 测试导出闸门的位置 / 版本号三处一致 / `fixedBox` 先钉宽度再钉高度）—— `_template/README.md` 有「删掉会怎样」对照表，**别删**。
- ⚠️ **模板不能放 `panels/` 下**：`install.py` 会收集 `panels/` **一级子目录**里的所有 `.jsx` 并部署 —— 放进去会被当成真面板装进 AE 的扩展菜单。它放仓库根 `_template/`（`install.py` 不扫）。
- **使用技巧**：AE 通用技巧进 `tips/ae/`，插件进阶用法进 `tips/tools/`（文件名与 `panels/` 目录对应），与插件 README 双向链接；与 knowledge-base（开发规范）边界不变

## 常用命令

- 新面板派生：`python new_panel.py MyPanel "我的面板"`（或手动复制 `_template/`）
- 全仓验收：`python verify.py`（语法 + 断言 + 部署一致性 + 技术债 + `_template/` 骨架巡检）
- 部署全部：`python install.py`（自动检测 AE 版本 + 补 BOM + 逐字节校验）；`--dry-run` 只看清单
- 语法检查：`cp x.jsx _c.js && node --check _c.js && rm _c.js`
- 补 BOM：Python 前插 `b'\xef\xbb\xbf'`
- 发布：commit 后按维护四步走（① CHANGELOG → ② AGENTS 基线 → ③ knowledge-base 仓库盘点表回填【用户执行】→ ④ push）

## 详细规则（按需 @引用）

- @../knowledge-base/单项目规范/README.md
- @../knowledge-base/速查表/ES3语法限制速查.md
