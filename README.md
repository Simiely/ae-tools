# ae-tools

个人 After Effects 脚本工具集（monorepo）。所有 AE 脚本的**唯一源码源**，一键部署到本地 AE。
**自写插件与收集插件分目录管理**，互不混淆。

## 目录结构

```
ae-tools/
├─ README.md · AGENTS.md · DEVELOPMENT.md · CHANGELOG.md   四件套文档
├─ install.py             一键部署器（检测 AE 版本 + UTF-8 BOM + 字节校验）
├─ verify.py              仓库级验收（语法 + 断言 + 部署一致性 + 技术债 + 骨架巡检）
├─ new_panel.py           新面板脚手架（从 _template/ 派生：复制 + 改名 + 替换标识）
├─ _template/             面板骨架模板 ⚠️ 不能放 panels/ 下（会被误当面板部署）
│                         → 约定速查见 _template/README.md
├─ panels/                自写 · ScriptUI 面板 → Window > Extensions
├─ scripts/               自写 · 无 UI 脚本（预留）→ File > Scripts
├─ third-party/           收集 · 第三方/外部脚本（README 标注来源）→ 按类型部署
├─ tips/                  使用技巧知识库（AE 通用 + 插件进阶用法）→ tips/README.md
├─ extensions/ · lib/ · samples/   （预留）
└─ releases/              发行版压缩包归档
```

## 工具总览

### 自写插件（11）

| 工具 | 源码位置 | 类型 | AE 菜单 | 状态 | 原独立仓库 |
|---|---|---|---|---|---|
| 时间轴缩进 TimeAxisIndent | `panels/TimeAxisIndent/` | 面板 | Window > Extensions | 稳定 | Simiely/TimeAxisIndent |
| 虚线网格 AE-Dashed-Grid-Generator | `panels/AE-Dashed-Grid-Generator/` | 面板 | Window > Extensions | 稳定 | Simiely/AE-Dashed-Grid-Generator |
| 水位上升 WaterRisePanel | `panels/AE-Water-Rise-Generator/` | 面板 | Window > Extensions | 稳定 | 本地仓库（无远端，已并入） |
| 滚动歌词 Rolling Lyrics | `panels/AE-Rolling-Lyrics/` | 面板 | Window > Extensions | 稳定（v1 冻结） | Simiely/AE-Rolling-Lyrics |
| 滚动歌词 V2（新版本） | `panels/AE-Rolling-Lyrics-V2/` | 面板 | Window > Extensions | 稳定（v2.0.13，对齐 左/中/右 + 兼容源层段框/RTL 方向） | 基于 v1 迭代，v1 冻结不动 |
| 歌词逐字散落动画 | `panels/AE-Lyrics-Animator/` | 面板 | Window > Extensions | 稳定 | Simiely/AE-Lyrics-Animator |
| 音频缩放 AudioScale | `panels/AudioScale/` | 面板 | Window > Extensions | 稳定 | Simiely/AudioScale |
| 星空生成器 starry-sky-generator | `panels/starry-sky-generator/` | 面板 | Window > Extensions | 稳定 | Simiely/starry-sky-generator |
| 快速K帧 QuickKey | `panels/QuickKey/` | 面板 | Window > Extensions | 开发中（v0.3.6，内置 cubic 预设） | 新插件（本仓库首发） |
| 数字计数器 NumCounter | `panels/NumCounter/` | 面板 | Window > Extensions | v0.2.9（已本地验证，独立数位/odometer + 字体字重两级联动 + 4 槽位预设 + 调试输出区；修复「对象无效」/「数字不动」/「存储后使用按钮不变可用」） | 新插件（本仓库首发） |
| 山峰频谱 MountainSpectrum | `panels/MountainSpectrum/` | 面板 | Window > Extensions | v1.5.8（已本地验证；等距矩形阵列 + 一个波峰一组 3 个可拖控制点(峰/左边缘/右边缘，宽度唯一来源) + 总闸统一高度 + 节奏条(开关=复选框, 每 N 根一根更高; 山内完全跟随山丘轮廓零戳出, 山外独自高) + 边缘羽化带参数「边缘过渡(根)」+ 柱子颜色可调(默认白, 面板取色) + **可设父级跟随运动(按真实位置采样控制点地形)** + **面板顶部常驻版本号** + 参数表驱动的 15 个实时参数 + 4 槽预设 + 空对象角色括注命名与标签色；261 断言含逐根比对） | 新插件（本仓库首发） |

### 收集的脚本（1）

| 工具 | 源码位置 | 类型 | AE 菜单 | 来源 |
|---|---|---|---|---|
| 关键帧吸附 asu_NudgeKeyFrames | `third-party/scripts/asu_NudgeKeyFrames.jsx` | 一次性脚本 | File > Scripts | [sundstedt.se](https://sundstedt.se/blog?p=661)（外部免费，已加关闭空窗 + 完成提示） |

## 安装 / 部署

```bash
python verify.py             # 仓库级验收：语法 + 断言 + 部署一致性 + 技术债清单
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
3. 写新面板：`python new_panel.py MyPanel "我的面板"`（从 `_template/` 派生，自带测试骨架）
3. 重启 AE 验证

## 文档

- 项目规则（技术栈、关键坑、约定）→ [AGENTS.md](AGENTS.md)
- 架构与问题记录（一坑一篇）→ [DEVELOPMENT.md](DEVELOPMENT.md)
- 变更记录 → [CHANGELOG.md](CHANGELOG.md)
- 使用技巧（AE 通用 + 插件进阶用法）→ [tips/README.md](tips/README.md)
- 单项目规范（知识库）→ knowledge-base/单项目规范/README.md

## 边界

- 本仓库不包含 Simiely/knowledge-base（用户私有知识库，另仓维护，只读引用）。
