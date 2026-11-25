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

### 自写插件（12）

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
| 对话文本动画 DialogueText | `panels/DialogueText/` | 面板 | Window > Extensions | v0.11.11（**读取选中文本层就地加动画**：不改文字/字体字号/位置 + **段落文本：你的框就是出现窗口**（四边边距可正可负 + 羽化距离**滚动向内/逐字向外** + 羽化强度=蒙版不透明度）+ **两个互斥单选**：横向滚动 / **逐字出现**（一整套：以文本框为窗口逐字出现 + 满窗整行左移 + 隐藏阶段**整行渐隐 100%→0% 并按「隐藏像素」同时左移**，出现(秒)/隐藏(秒)/隐藏像素可调，默认 2.0/0.8/100；选中哪个就只显示哪套参数）+ **逐字出现羽化向框外**（框内全清晰，文字不再右移，长句尾部的字也完整逐字出现）+ **段落文本溢出修复（v0.11.8）**（AE 隐藏超出定界框的文字；用官方 `TextDocument.boxOverflow` 判定：无溢出不动框；有溢出把排版框**单行化**——框高保持一行、宽度倍增 + 二分加到能装下整行（不改文字/字体/字号/图层位置），再把**原框（宽高都不动）当出现窗口**，文字在框内像终端一样从右往左流动；原框尺寸存进蒙版名 `DT_窗口 595x49`，重复应用仍按原框当窗口；写回后复核、失败还原、`boxTextPos` 复位）+ **逐字选区修复（v0.11.10，v0.11.9 已撤回）**（每个动画器**逐个**切**索引单位** `Units=Index`，再用 `ADBE Text Index Start/End = selIdx / selIdx+1`（**非空白字符序号**；v0.11.11 真机：索引单位下空格不占索引）精确只选一个字；百分比在字符数不能整除 100 时会把相邻字并进来，导致两个字从 0 秒起一直显示；索引模式下百分比那对是隐藏属性，写它会报错；取不到索引属性才退回百分比）+ 方向可选 + **开头/结束动态曲线** + 首次加载提速（日志节流）+ 说明文字改静态文本；默认真值：渐隐 0.12 / 羽化 25 / 强度 100 / 边距 0；`DT_滚动` 只负责位置表达式 + 隐藏阶段渐隐写进每字不透明度动画器（100 → 0，不写负值；避免覆盖全行的 100% 顶掉逐字出现）+ 每字动画器防御性复用自带默认选区 + 错误信息走 `errText` 安全转换 + 日志框 10 行；改参数再点「应用动画」即更新；506 断言，**已真机验证**） | 新插件（本仓库首发） |

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
- AE 脚本 API 校验记录（对话文本动画）→ [AE_API_VERIFIED.md](AE_API_VERIFIED.md)
- 单项目规范（知识库）→ knowledge-base/单项目规范/README.md

## 边界

- 本仓库不包含 Simiely/knowledge-base（用户私有知识库，另仓维护，只读引用）。
- **原独立仓库已归档只读**（2026-10-09）：`TimeAxisIndent` · `AE-Dashed-Grid-Generator` · `AE-Water-Rise-Generator` · `AE-Rolling-Lyrics` · `AE-Lyrics-Animator` · `AudioScale` · `starry-sky-generator` —— 本仓库是它们**唯一源码源**，历史快照留在那些仓库里。
