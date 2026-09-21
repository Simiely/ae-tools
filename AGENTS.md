# AGENTS.md · 项目规则

> 📌 **文档基线**：2026-09-21（commit `待本轮 docs commit 回填`）**新增面板骨架模板 `_template/` + 脚手架 `new_panel.py`**（派生一条命令；模板自带 45 条断言，其中 6 组是「骨架体检」断言，守着 safeRun 包裹 / pinW 三处写 / 闸门位置 / 版本号三处一致不被改腐）。`verify.py` 新增第 ⑤ 项**骨架巡检** —— 模板不能放 `panels/` 下（`install.py` 会把一级子目录的 .jsx 部署到 AE），只能放仓库根，因此面板扫描覆盖不到它，必须单独查，否则模板会腐化。验收 11/11 + 骨架 45/45 通过
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
- **插件部署状态**：全部 11 个面板均为可部署状态（MountainSpectrum 已于 v1.5.4 正式交付并部署；此前「待开发，禁止部署」的标注已作废 —— 它的源码早已并入 `panels/MountainSpectrum/`）
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
