# ae-tools

个人 After Effects 脚本工具集（monorepo）。所有 AE 插件源码的唯一来源（single source of truth），
一键部署到本地 After Effects；不再在多个目录里散落多份副本。

## 目录结构

```
ae-tools/
├─ README.md              本文件
├─ install.py             一键部署器（检测 AE 版本 + UTF-8 BOM + 字节校验）
├─ scripts/               无 UI 一次性脚本 → File > Scripts
├─ panels/                有 UI 的 ScriptUI 面板 → Window > Extensions
│  ├─ TimeAxisIndent/
│  ├─ AE-Dashed-Grid-Generator/
│  ├─ AE-Water-Rise-Generator/
│  ├─ MountainSpectrum/
│  ├─ AE-Rolling-Lyrics/
│  ├─ AE-Lyrics-Animator/
│  ├─ AudioScale/
│  └─ starry-sky-generator/
├─ extensions/            （预留）CEP 扩展
├─ lib/                   （预留）公共函数库
├─ releases/              发行版压缩包归档
└─ samples/               （预留）测试 .aep 工程
```

## 工具总览

| 工具 | 源码位置 | 类型 | AE 菜单 | 状态 | 原独立仓库 |
|---|---|---|---|---|---|
| 时间轴缩进 TimeAxisIndent | `panels/TimeAxisIndent/` | ScriptUI 面板 | Window > Extensions | 稳定 | Simiely/TimeAxisIndent |
| 虚线网格 AE-Dashed-Grid-Generator | `panels/AE-Dashed-Grid-Generator/` | ScriptUI 面板 | Window > Extensions | 稳定 | Simiely/AE-Dashed-Grid-Generator |
| 水位上升 WaterRisePanel | `panels/AE-Water-Rise-Generator/` | ScriptUI 面板 | Window > Extensions | 稳定 | 本地仓库（无远端，已并入） |
| 山峰频谱 MountainSpectrum | `panels/MountainSpectrum/` | ScriptUI 面板 | Window > Extensions | 稳定 | 无 git（已并入） |
| 滚动歌词 Rolling Lyrics | `panels/AE-Rolling-Lyrics/` | ScriptUI 面板 | Window > Extensions | 稳定 | Simiely/AE-Rolling-Lyrics |
| 歌词逐字散落动画 | `panels/AE-Lyrics-Animator/` | ScriptUI 面板 | Window > Extensions | 稳定 | Simiely/AE-Lyrics-Animator |
| 音频缩放 AudioScale | `panels/AudioScale/` | ScriptUI 面板 | Window > Extensions | 稳定 | Simiely/AudioScale |
| 星空生成器 starry-sky-generator | `panels/starry-sky-generator/` | ScriptUI 面板 | Window > Extensions | 稳定 | Simiely/starry-sky-generator |
| 关键帧吸附 asu_NudgeKeyFrames | `scripts/asu_NudgeKeyFrames.jsx` | 一次性脚本 | File > Scripts | 稳定（外部免费脚本） | sundstedt.se |

## 安装 / 部署

```bash
python install.py            # 自动检测 AE 版本并部署全部
python install.py --version 26.0
python install.py --dry-run  # 先看会装什么
```

- `panels/` 下每个子目录里的 `.jsx` → AE `ScriptUI Panels`（Window > Extensions）
- `scripts/` 下的 `.jsx` → AE `Scripts`（File > Scripts）
- 自动给所有脚本补 UTF-8 BOM（ExtendScript 中文必需），部署后逐字节校验
- **部署后需重启 After Effects** 才会出现在菜单里

## 开发工作流

1. 修改 `panels/<Tool>/<Tool>.jsx` 源码（本仓库是唯一源码源）
2. 运行 `python install.py` 部署到 AE
3. 重启 AE 验证

## 整合记录（2026-08-18）

- 原 8 个插件源码分散在 7 个 `D:\workbuddy\YYYY-MM-DD-*\` 工作区目录，已全部并入本仓库。
- 重复副本处理（以 AE 中实际运行的版本为准）：
  - TimeAxisIndent：保留 08-11 版（与已安装一致），08-14 旧版副本弃用
  - Rolling Lyrics：保留 08-14 版（与已安装一致），08-13 旧版副本弃用
  - 歌词逐字散落动画：两份相同，保留 08-14 版
- 每个插件目录保留各自的 README / CHANGELOG / DEVELOPMENT / AGENTS 文档。
- 历史 git 记录保留在原独立仓库（GitHub 归档）。

## 边界

- 本仓库不包含 Simiely/knowledge-base（用户私有知识库，另仓维护）。
