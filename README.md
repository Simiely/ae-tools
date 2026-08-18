# ae-tools

个人 After Effects 脚本工具集（monorepo）。所有 AE 脚本的**唯一源码源**，一键部署到本地 AE。
**自写插件与收集插件分目录管理**，互不混淆。

## 目录结构

```
ae-tools/
├─ README.md · AGENTS.md · DEVELOPMENT.md · CHANGELOG.md   四件套文档
├─ install.py             一键部署器（检测 AE 版本 + UTF-8 BOM + 字节校验）
├─ panels/                自写 · ScriptUI 面板 → Window > Extensions
├─ scripts/               自写 · 无 UI 脚本（预留）→ File > Scripts
├─ third-party/           收集 · 第三方/外部脚本（README 标注来源）→ 按类型部署
├─ extensions/ · lib/ · samples/   （预留）
└─ releases/              发行版压缩包归档
```

## 工具总览

### 自写插件（7）

| 工具 | 源码位置 | 类型 | AE 菜单 | 状态 | 原独立仓库 |
|---|---|---|---|---|---|
| 时间轴缩进 TimeAxisIndent | `panels/TimeAxisIndent/` | 面板 | Window > Extensions | 稳定 | Simiely/TimeAxisIndent |
| 虚线网格 AE-Dashed-Grid-Generator | `panels/AE-Dashed-Grid-Generator/` | 面板 | Window > Extensions | 稳定 | Simiely/AE-Dashed-Grid-Generator |
| 水位上升 WaterRisePanel | `panels/AE-Water-Rise-Generator/` | 面板 | Window > Extensions | 稳定 | 本地仓库（无远端，已并入） |
| 山峰频谱 MountainSpectrum | `panels/MountainSpectrum/` | 面板 | Window > Extensions | 稳定 | 无 git（已并入） |
| 滚动歌词 Rolling Lyrics | `panels/AE-Rolling-Lyrics/` | 面板 | Window > Extensions | 稳定 | Simiely/AE-Rolling-Lyrics |
| 歌词逐字散落动画 | `panels/AE-Lyrics-Animator/` | 面板 | Window > Extensions | 稳定 | Simiely/AE-Lyrics-Animator |
| 音频缩放 AudioScale | `panels/AudioScale/` | 面板 | Window > Extensions | 稳定 | Simiely/AudioScale |
| 星空生成器 starry-sky-generator | `panels/starry-sky-generator/` | 面板 | Window > Extensions | 稳定 | Simiely/starry-sky-generator |

### 待开发（WIP，暂不部署）

| 工具 | 说明 |
|---|---|
| 山峰频谱 MountainSpectrum | 内容已清理出主目录（2026-08-18），**待开发**，不部署、不安装；源码保留在 `D:\workbuddy\2026-08-12-17-14-47\ae-scripts\MountainSpectrum.jsx` |

### 收集的脚本（1）

| 工具 | 源码位置 | 类型 | AE 菜单 | 来源 |
|---|---|---|---|---|
| 关键帧吸附 asu_NudgeKeyFrames | `third-party/scripts/asu_NudgeKeyFrames.jsx` | 一次性脚本 | File > Scripts | [sundstedt.se](https://sundstedt.se/blog?p=661)（外部免费，已加关闭空窗 + 完成提示） |

## 安装 / 部署

```bash
python install.py            # 自动检测 AE 版本并部署全部
python install.py --version 26.0
python install.py --dry-run  # 先看会装什么
```

- `panels/` 下每个子目录里的 `.jsx` → AE `ScriptUI Panels`（Window > Extensions）
- `scripts/` 与 `third-party/scripts/` 下的 `.jsx` → AE `Scripts`（File > Scripts）
- 自动补 UTF-8 BOM（ExtendScript 中文必需），部署后逐字节校验
- **部署后需重启 After Effects** 才会出现在菜单里

## 快速开始

1. 改代码：修改 `panels/<Tool>/<Tool>.jsx`（本仓库是唯一源码源）
2. 部署：`python install.py`
3. 重启 AE 验证

## 文档

- 项目规则（技术栈、关键坑、约定）→ [AGENTS.md](AGENTS.md)
- 架构与问题记录（一坑一篇）→ [DEVELOPMENT.md](DEVELOPMENT.md)
- 变更记录 → [CHANGELOG.md](CHANGELOG.md)
- 单项目规范（知识库）→ knowledge-base/单项目规范/README.md

## 边界

- 本仓库不包含 Simiely/knowledge-base（用户私有知识库，另仓维护，只读引用）。
