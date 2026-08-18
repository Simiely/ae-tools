# CHANGELOG.md

## [v1.0.0] - 2026-08-12

首个可用版本。

### 新增
- ScriptUI 面板脚本：一键生成共用交接边的虚线网格框（N×M）
- 参数化：行列数 / 总宽高 / 线宽 / 虚线长度 / 间隙
- 共用交接边结构：一个形状图层 + 共享描边，内部线无双重边
- 缩放保持：物理方案（描边在组外），缩放「网格组」变换时线宽/虚线间距不变
- 面板状态区：成功/失败信息显示在面板内，不弹窗
- 调试模块：出错弹出可复制详情的对话框 + 自动写日志到 `~/ae_dashed_grid_error.log`

### 修复（开发过程中）
- 形状属性必须加到组的 `ADBE Vectors Group` 内容容器（NAMED_GROUP 限制）
- 自由路径 matchName 用 `ADBE Vector Shape - Group`
- Shape 对象用全局构造函数 `new Shape()`（`layer.newShape` 不存在）
- 描边颜色 4D RGBA（`ADBE Vector Stroke Color`）
- Dashes 虚线用 `addProperty()` 揭示隐藏属性后再 setValue
- 状态区 statictext 声明 `multiline: true`，多行换行用 `\r`
- 标准面板模式（`instanceof Panel`）防双窗口

### 已知限制
- 直接缩放图层且非等比（X≠Y）时，AE 引擎无法完美保持线宽（社区共识）
- 依赖 AE 2026 中文版内部版本 26.0 目录；其他版本需调整部署路径
