# AGENTS.md · 项目规则

> 📌 **文档基线**：2026-09-01（commit `86c0f1e`）NumCounter v0.2.3（Effects 索引属性组 addProperty 使同组引用失效 → 全部 addProperty 后按名字复取；纠正 v0.2.2 把 scheduleTask 误当根因），根文档同步（四件套保持）
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
5. **git 推送**：本机无全局 user.name/email（用 `Simiely <124016031+Simiely@users.noreply.github.com>`）；代理 7890，全局 `http.https://github.com.proxy=` 为空会覆盖真实代理，push 需 `-c http.https://github.com.proxy=http://127.0.0.1:7890 -c http.sslVerify=false`

## 约定

- UI 标签用中文；注释用中文；每目录一个 .jsx 主文件（+ 可选 test_*.js 模拟测试）
- 每次改动遵循单项目规范：README / AGENTS / DEVELOPMENT / CHANGELOG 四件套同步（见知识库 `../单项目规范/README.md`）
- 脚本头部保留 `Version / Description` 注释；版本号变更进 CHANGELOG
- **待开发插件（禁止部署/安装）**：MountainSpectrum（2026-08-18 标注，内容已清理出主目录；源码在 `D:\workbuddy\2026-08-12-17-14-47\ae-scripts\MountainSpectrum.jsx`）
- **使用技巧**：AE 通用技巧进 `tips/ae/`，插件进阶用法进 `tips/tools/`（文件名与 `panels/` 目录对应），与插件 README 双向链接；与 knowledge-base（开发规范）边界不变

## 常用命令

- 部署全部：`python install.py`（自动检测 AE 版本 + 补 BOM + 逐字节校验）；`--dry-run` 只看清单
- 语法检查：`cp x.jsx _c.js && node --check _c.js && rm _c.js`
- 补 BOM：Python 前插 `b'\xef\xbb\xbf'`
- 发布：commit 后按维护四步走（① CHANGELOG → ② AGENTS 基线 → ③ knowledge-base 仓库盘点表回填【用户执行】→ ④ push）

## 详细规则（按需 @引用）

- @../knowledge-base/单项目规范/README.md
- @../knowledge-base/速查表/ES3语法限制速查.md
