# DEVELOPMENT.md · 开发记录

## 一、项目概览

ae-tools 是个人 AE 脚本工具集的 **monorepo**：7 个自写 ScriptUI 面板（MountainSpectrum 标注待开发、已移出）+ 1 个收集的外部脚本（asu_NudgeKeyFrames），配套一键部署器 `install.py`。定位：所有 AE 脚本的**唯一源码源**，AppData 里的安装副本只是部署产物——改代码 → 跑 `python install.py` → 全装好。

演进：2026-08-18 从 7 个分散的 workspace 目录整合（原 8 个独立 git 仓库/目录 + 多份重复副本）→ 建 monorepo → 目录分离（自写/收集）→ 四件套文档。

## 二、架构说明

```
ae-tools/
├─ panels/                   自写 · ScriptUI 面板 ×7（MountainSpectrum 待开发已移出）→ ScriptUI Panels（Window > Extensions）
├─ scripts/                  自写 · 无 UI 脚本（预留，当前空）
├─ third-party/scripts/      收集 · 外部脚本（asu_NudgeKeyFrames.jsx）→ Scripts（File > Scripts）
├─ install.py                一键部署器
├─ README.md · AGENTS.md · DEVELOPMENT.md · CHANGELOG.md   四件套
├─ releases/                 （AE-Rolling-Lyrics-v3.7.zip）
└─ extensions/ lib/ samples/ （预留）
```

`install.py` 流程：扫描 `%APPDATA%\Adobe\After Effects\` 自动检测版本 → `panels/` 各子目录 jsx → `ScriptUI Panels\`、`scripts/` 与 `third-party/scripts/` → `Scripts\` → 每个文件补 UTF-8 BOM → 部署 → 逐字节校验。

## 三、关键问题与方案（一坑一篇）

### 问题：无 UI 一次性脚本放进 ScriptUI Panels 残留空面板

**TL;DR**：AE 对 ScriptUI Panels 里的脚本一律提供 Panel 宿主，无 UI 脚本运行后留下空面板，脚本侧 `this.close()` 关不掉（面板生命周期由 AE 管理）。

- 问题：asu_NudgeKeyFrames 部署到 ScriptUI Panels 后，点开停留空窗口
- 根因：ScriptUI Panels 的定位就是"可停靠面板"，AE 官方手册明确"When a script is launched as a panel, AE provides the panel"
- 解决：无 UI 脚本改放 `scripts/` / `third-party/scripts/`（File > Scripts 直接执行，零窗口）；脚本加 `try { if (this instanceof Window) { this.close(); } } catch (e) {}` 双环境兼容 + 末尾 alert 完成提示
- 预防：部署前先判断有无 UI——有 UI 才放 `panels/`，无 UI 一律 scripts 系目录

### 问题：同名插件多份源码，版本不一致无法判断新旧

**TL;DR**：TimeAxisIndent / RollingLyrics 等在多个 workspace 目录有副本且内容不同，按文件名/时间都无法确定"最终版"。

- 问题：08-11 与 08-14 两个 `TimeAxisIndent.jsx`（18KB vs 11KB）；08-13 与 08-14 两个 `rolling-lyrics.jsx`（31KB vs 46KB）
- 根因：不同日期开发各自留档，后来者未必是最终版
- 解决：以 **AE 中实际安装运行的那份为准**，逐字节 `cmp` 去重（TimeAxisIndent 取 08-11、RollingLyrics 取 08-14、LyricsAnimator 两份相同取文档齐全者）
- 预防：monorepo 建立后只有唯一源码源，不再产生跨目录副本

### 问题：ExtendScript 中文乱码 / 语法检查失败

**TL;DR**：ExtendScript 引擎要求 UTF-8 带 BOM；`node --check` 不认 `.jsx` 后缀。

- 根因：Write/Edit 工具产出 UTF-8 无 BOM；node 只检查已知扩展名
- 解决：`install.py` 统一补 BOM；语法检查复制为 `.js` 再查
- 预防：发布前按 AGENTS.md 常用命令走一遍

### 问题：install.py 清理嵌套仓库时删除被安全策略拦截

**TL;DR**：环境把 `rm -rf` 转成"回收站删除"，对 `.git` 目录失败（trash 工具报错、COM 兜底找不到文件），首次清理报错退出。

- 问题：`find panels -name .git -exec rm -rf` 后仍残留 `.github`
- 根因：安全删除策略接管 rm，trash 工具对该路径失败
- 解决：重试删除即成功（`.git` 已清）；`rm -rf` 对小目录（`.github`）直接生效
- 预防：复制项目进 monorepo 后，用 `find ... -exec rm -rf` 清理并复查残留

## 四、文档基线（断点续传）

- 2026-08-18（commit `564fb1f`）：MountainSpectrum 标注待开发移出主目录（不部署/不安装）
- 2026-08-18（commit `4fa9fa2`）：四件套建立（README/AGENTS/DEVELOPMENT/CHANGELOG）+ 自写/收集目录分离
- 维护流程：① CHANGELOG 追加版本 → ② AGENTS 基线行更新 → ③ knowledge-base/仓库盘点表.md 回填（**由用户执行**，本仓库维护者不得改动 knowledge-base）→ ④ 推送
