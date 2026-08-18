# AGENTS.md · 项目规则

> 📌 **文档基线**：2026-08-12（commit `0969c3b`）v1.1.0：颜色控制（HSL/HEX/Color Control）+ 循环帧数
> **更新文档/代码后，请更新此行**（日期 + 新 commit hash），并在 CHANGELOG 追加版本

## 技术栈

- AE 2026 中文版 + ExtendScript（ES3 语法：无 let/const/箭头函数/模板字符串）
- 单文件交付：`WaterRisePanel.jsx`（ScriptUI Panel），窗口 > 扩展 加载
- 文件必须 UTF-8 with BOM（ExtendScript 引擎否则乱码中文）

## 关键坑（代码里看不出的信息）

- **集合变更后引用失效**：对同一 PropertyGroup 多次 addProperty/remove 后，之前缓存的属性/组引用全部失效（报"对象无效"）。使用前一律 `findGroupByName` / `findPathProp` 按 name/matchName 从父级重新查找。
- **贝塞尔路径坐标相对形状组锚点**：path 坐标不归图层锚点管，归组内 `ADBE Vector Transform Group` 管；必须图层级（ADBE Anchor Point/ADBE Position）+ 组级（ADBE Vector Anchor/ADBE Vector Position）一起归零，否则整张图错位。
- **路径必须闭合到底部**：AE 默认 is_closed=true，路径数据只有顶部波浪线、没有底部点 `[W,H]`,`[0,H]` 会强制闭合越界 → AE 崩溃。
- **属性访问用 match name 不用显示名**：中文界面下 "Anchor Point" 显示名是"锚点"，会静默找不到。用 `ADBE Anchor Point`、`ADBE Vector Anchor` 等。
- **渐变填充 match name 版本差异大**：`ADBE Vector Fill - Gradient` 在 AE 26 无效会抛错并污染图层状态 → 直接用纯色 `ADBE Vector Graphic - Fill`。
- **createPath 不传 tangents**：`createPath(pts)` 即可（官方文档：切线默认空数组自动补 [0,0]），路径步长 4px 视觉平滑。
- **表达式引擎子集**：用最保守语法——单变量声明（不用 `var a, b, c;`）、`i = i + 1`（不用 `i++`）、`y = y + x`（不用 `y += x`）。
- **颜色控制用 Color Control 效果**（match name `ADBE Color Control`，参数 `ADBE Color Control-0001`，值 [r,g,b,a] 0-1），不要用滑块拼颜色；填充/描边颜色属性表达式直接 `effect('水体颜色')(1)` 引用。
- **sampleImage 是 AVItem 的方法**（CompItem/FootageItem），AVLayer 上没有；且 ExtendScript 中不稳定（CC2015+ 异步返回 0,0,0,0）——吸色类功能慎用。
- **添加新效果会使旧效果引用失效**（官方文档确认：索引组重创建）：addSlider/addCheckbox/addColor 都是"添加后立即 setValue"，外部不缓存其返回值。

## 约定

- UI 标签用中文；注释用中文；.jsx 单文件交付
- 数值参数以 Slider Control / Checkbox Control 挂在水面图层，生成后可调；**颜色用 Color Control（一个参数，自带取色器）**
- 预设双层持久化（工程 JSON + app.settings），读取工程 JSON 优先
- 噪波用 AE 内置 `noise()`，种子作为第三维坐标

## 常用命令

- 语法检查：`node --check`（.jsx 需先复制为 .js）
- 部署：`python scripts/deploy_ae_script.py --src WaterRisePanel.jsx`（自动加 BOM + 拷贝到 ScriptUI Panels + 字节校验）
- 推送：修改后先本地调试确认，再 commit + push

## 详细规则（按需 @引用）

- @rules/技术栈.md（暂缺）
- @rules/常见坑.md（暂缺）
