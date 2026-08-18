# DEVELOPMENT.md · 开发记录

## 一、项目概览

滚动歌词生成器 **V2** 是 AE 2026 的歌词滚动工具（基于 v1 v3.7 迭代）。核心能力：把歌词按行拆成图层，由 `Lyrics_Ctrl` 空对象 + 表达式驱动整列歌词滚动，到画面中心的句子放大变亮。

**V2 与 v1 的关系**：v1（`../AE-Rolling-Lyrics/rolling-lyrics.jsx`，v3.7）**冻结不动**；V2 是独立文件 `rolling-lyrics-v2.jsx`，新增「滚动句数」（1/2/3 句一起滚动）+「组内行间距」，滚动逻辑从"按句"升级为"按组"。

演进：v1 全历史 → V2 首版（v2.0.0）组滚动模型。

## 二、架构说明

```
rolling-lyrics-v2.jsx
├─ util 层：estTextWidth / numVal / addPropertySafe / getPropertySafe / clearProp / removeGenerated
├─ preset 层（参数映射 + 双层持久化：工程目录 JSON + app.settings）
│  ├─ collectParams / toPreset / fromPreset / applyParams   ← 新参数 lps / mg 四路同步
│  ├─ 工程 JSON：滚动歌词预设.json（跟工程走）
│  └─ app.settings：全局保底
├─ core 层（可测试，Node 导出）
│  ├─ parseLyrics / computeOffsets / computeMaxDist / measureFit / createLyricLayer
│  ├─ addSliderControl / addCheckboxControl（效果容器 ADBE Effect Parade）
│  ├─ buildController(comp, n, params)
│  │   └─ 11 个控件：最大字号/普通字号/间距/组内行间距/滚动句数/
│  │                最大透明度/普通透明度/滚动帧数/停顿帧数/停顿随机/抖动帧数
│  │   └─ 滚动位置表达式（按组）：m=⌈n/k⌉ 组，step=mg*(k-1)+g，
│  │       循环"停顿+滚动"m-1 次，组中心 y = H/2 - (idx-(m-1)/2)*step
│  └─ attachExpressions(L, i, n, k, cx, cy, cap)
│      ├─ 位置：y = Lyrics_Ctrl.position[1] + (rel - idx*step)
│      │        rel = gi*step + (ii-(k-1)/2)*mg（gi=⌊i/k⌋, ii=i mod k）
│      └─ 缩放/透明度：d = |Lyrics_Ctrl[1] - Lyrics_Master[1]|（组中心距离）
└─ ui 层：buildUI（含「滚动句数」下拉 +「组内行间距」输入框）/ run 主流程 / 预设管理
```

**组滚动核心公式**：
```
k  = 滚动句数（1/2/3）
m  = ⌈n/k⌉（组数）
step = multiGap*(k-1) + gap        ← 组与组的中心间距
句 i 的组内偏移 = (ii - (k-1)/2) * multiGap
句 i 的 y = 组中心 y + (gi - idx)*step + 组内偏移
```

## 三、关键问题与方案（一坑一篇）

### 问题：滚动"按句"改"按组"后，句子位置漂移

**TL;DR**：V2 若只把控制器改成组滚动、句图层仍按单句偏移，滚动中句子会跳位。必须让句图层表达式与控制器用**完全相同的组索引算法**（同样的 times 累积 + seedRandom 流），再用 `rel - idx*step` 对齐。

- 问题：组滚动模型下，句位置 = 组中心 + 组内偏移；组中心由控制器表达式算，句图层若不知道"当前组 idx"会错位
- 根因：控制器位置只暴露"当前组中心 y"，没暴露"当前组索引"
- 解决：句图层位置表达式**自算 idx**（与控制器表达式同算法、同种子流 seedRandom(jj+11000)）；`y = ctrl.position[1] + (gi*step + (ii-(k-1)/2)*mg) - idx*step`
- 预防：改控制器表达式时必须同步改句表达式（AGENTS 关键坑 2 守护）

### 问题：整组放大 vs 单句放大

**TL;DR**：需求是"2 句一起到中心放大"，若沿用 v1 的 `|transform.position[1] - master|`（单句距离），组内各句缩放不一致，视觉上不是"整组放大"。

- 解决：缩放/透明度距离改为**组中心距离** `|Lyrics_Ctrl.position[1] - master[1]|`，组内所有句共享同一缩放/透明度 → 整组同步放大变亮
- 预防：不要改回 `transform.position[1]`（AGENTS 关键坑 3）

### 问题：v1 / v2 同目录并存，部署与清理互不干扰

**TL;DR**：两版文件名不同（rolling-lyrics.jsx / rolling-lyrics-v2.jsx），install.py 自动部署到 ScriptUI Panels 后 AE 菜单两版共存；清理旧图层时 removeGenerated 按 Lyrics_ 前缀匹配，两版共用同一套图层命名（Lyrics_Ctrl / Lyrics_Master / 歌词_），同一合成里不要同时用两版生成（会互相清理对方图层）。

- 预防：README 注明"同合成用同一版生成"

### 问题：组滚动句位置偏移基准错误，歌词整体错位 + 组切换跳变

**TL;DR**：句位置用了 `ctrlY + (rel - idx*step)`，把"相对第 0 组中心的偏移"与"当前组索引"耦合，导致 idx=0 时组0 不在画面中心（整体错位 290px），且随 idx 变化偏移突跳。正确公式：`ctrlY + rel - ((mnum-1)/2)*step`（**固定偏移**，滚动动画由 ctrl 的 linear 插值提供）。

- 问题：播放时歌词错位跳动；k=1 时句0 也不在中心
- 根因：v1 的句偏移是 `(i - half)*g`（相对 ctrl 参考点的**固定偏移**）；V2 误写成 `(rel - idx*step)`（把 idx 卷进偏移，破坏固定性）
- 解决：偏移固定为 `rel_i - ((mnum-1)/2)*step`；句子 y = ctrl 动态位置 + 固定偏移，与 v1 同构（ctrl 的 y0/y1 = H/2 + ((mnum-1)/2 - idx)*step 本就正确）
- 验证：新增 `test_rolling_lyrics_v2.js` 模拟测试（14 断言）守护，改动表达式必须跑测试
- 预防：任何句位置/缩放表达式改动，先跑 `node test_rolling_lyrics_v2.js`

### 问题：组到中心的距离 d 基准错误，透明度/字号两档被抹平

**TL;DR**：缩放/透明度表达式用 `|ctrlY - master|` 算"组到画面中心距离"，但参考点 ctrlY 在停顿态 ≠ 画面中心（中心组几何中心在 H/2，参考点在 H/2±偏移），导致**中心组算出来 d≈step 而不是 0**，所有句子透明度都落在渐变中间值——"看不出 100% 与 30% 的区别"。

- 问题：用户反馈透明度看不出区别
- 根因：d 必须按"句所属组的几何中心"算：`d = |ctrlY + gi*step - (mnum-1)/2*step - master|`（gi=⌊i/k⌋）；旧式 `|ctrlY - master|` 忘了组偏移项
- 解决：d 修正 + 语义改为「二值 + 滚动过渡」：`ease(min(d,step), 0, step, 最大, 普通)`——停顿态中心组 d=0→最大、其余组 d≥step→普通（二值）；滚动中 d 在 0..step 过渡（平滑）
- 验证：模拟测试用例 7/8（静止二值 + 滚动过渡 65 交叉）守护
- 预防：任何"到中心距离"类表达式，先用模拟测试断言中心组的 d=0

## 四、文档基线（断点续传）

- 2026-08-18（commit `9673f48`）：真机验证通过，V2 转稳定（v2.0.8，顶层 v1.0.3）
- 2026-08-18（commit `c037ab2`）：控件名常量 CN + 测试升级真实表达式执行（v2.0.7，28 断言）
- 2026-08-18（commit `35b90c9`）：滚动句数不限行数、最后一组不满居中修复（v2.0.6，测试 31 断言）
- 2026-08-18（commit `345932d`）：透明度/字号二值+滚动过渡、d 基准修复（v2.0.5，测试 24 断言）
- 2026-08-18（commit `a73deae`）：修复句位置偏移基准错误（v2.0.4，+模拟测试 14 断言）
- 2026-08-18（commit `86ee42e`）：修复 buildController 漏传新参数（v2.0.3）
- 2026-08-18（commit `ef4981d`）：滚动帧数默认 9、停顿帧数默认 30（v2.0.2）
- 2026-08-18（commit `e1b310a`）：默认参数调整 v2.0.1（60/40/145/100/30，组内行间距对齐 145）
- 2026-08-18（commit `b10df33`）：V2 首版建立（v2.0.0，组滚动模型）
- 维护流程：① CHANGELOG 追加版本 → ② AGENTS 基线行更新 → ③ knowledge-base 仓库盘点表回填（用户执行）→ ④ 推送
