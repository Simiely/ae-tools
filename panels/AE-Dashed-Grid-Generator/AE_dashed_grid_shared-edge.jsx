// ============================================================
// 虚线网格框生成器 (共用交接边 / shared-edge) - ScriptUI 面板版
//
// 安装: 放到 %APPDATA%\Adobe\After Effects\26.0\Scripts\ScriptUI Panels\
// 使用: 重启 AE -> 菜单 窗口 > 扩展 > 虚线网格生成器
//       面板里填行列数/尺寸/线型 -> 点"生成网格"
//
// 原理: 一个形状图层内 = 外框路径 + N-1 条横线 + N-1 条竖线,
//       全部共享同一条虚线描边 -> 内部线为相邻格子共用, 无双线
//
// 注意: ADBE Vector Group 的子属性只能是"内容(ADBE Vectors Group)"
//       和"变换(ADBE Vector Transform Group)", 形状/描边必须加到
//       组的内容容器里, 否则报"无法将属性添加到此"
// ============================================================

(function (thisObj) {

    // ---- 调试模块: 错误对话框 (文字可复制) ----
    function showDebugError(err) {
        try {
            var lines = [];
            lines.push("错误类型: " + (err && err.name ? err.name : "未知"));
            lines.push("错误信息: " + (err ? err.toString() : "未知"));
            if (err && err.fileName) { lines.push("文件: " + err.fileName); }
            if (err && err.line !== undefined) { lines.push("行号: " + err.line); }
            if (err && err.stack) { lines.push("堆栈:"); lines.push(err.stack); }
            var msg = lines.join("\n");

            // 同时写一份日志到桌面, 方便留存
            try {
                var logFile = new File("~/ae_dashed_grid_error.log");
                logFile.open("w");
                logFile.write("[" + new Date() + "]\n" + msg + "\n");
                logFile.close();
            } catch (e) { /* 日志写入失败不阻塞弹窗 */ }

            var win = new Window("dialog", "脚本出错 - Debug");
            win.orientation = "column";
            win.alignChildren = "fill";
            win.spacing = 10;
            win.margins = 12;

            var tip = win.add("statictext", undefined,
                "以下为错误详情(可全选复制 Ctrl+A / Ctrl+C):");
            tip.alignment = "left";

            var box = win.add("edittext", undefined, msg, {
                multiline: true, scrollable: true
            });
            box.preferredSize.width = 520;
            box.preferredSize.height = 220;

            var btnRow = win.add("group");
            btnRow.orientation = "row";
            btnRow.alignment = "center";
            var copyBtn = btnRow.add("button", undefined, "复制全部");
            copyBtn.onClick = function () {
                try {
                    box.active = true;
                    app.executeCommand(23); // 全选 (与 Ctrl+A 等效)
                    app.executeCommand(19); // 复制 (与 Ctrl+C 等效)
                } catch (e2) {
                    alert("自动复制失败, 请手动选中文本后 Ctrl+C\n" + e2);
                }
            };
            var okBtn = btnRow.add("button", undefined, "确定");
            okBtn.onClick = function () { win.close(); };

            win.center();
            win.show();
        } catch (e3) {
            // 极端情况: 对话框本身失败, 退回普通 alert
            alert("脚本出错:\n" + (err ? err.toString() : String(e3)));
        }
    }

    // ---- 面板状态区更新 (成功绿 / 失败红) ----
    function setStatus(pal, msg, rgb) {
        pal.status.text = msg;
        try {
            var pen = pal.status.graphics.newPen(0, rgb, 1);
            pal.status.graphics.foregroundColor = pen;
        } catch (e) { /* 颜色设置失败不影响文本 */ }
        try { pal.layout.layout(true); } catch (e2) {}
        try { pal.layout.resize(); } catch (e3) {}
    }

    function buildGrid(pal) {
        try {
            var comp = app.project.activeItem;
            if (!(comp && comp instanceof CompItem)) {
                setStatus(pal, "请先双击打开一个合成, 再点击生成。", [0.85, 0.55, 0.1]);
                return;
            }

            var COLS = Math.max(1, parseInt(pal.cols.text, 10) || 2);
            var ROWS = Math.max(1, parseInt(pal.rows.text, 10) || 2);
            var GRID_W = parseFloat(pal.gw.text) || 900;
            var GRID_H = parseFloat(pal.gh.text) || 600;
            var STROKE_W = parseFloat(pal.sw.text) || 3;
            var DASH = parseFloat(pal.dash.text) || 14;
            var GAP = parseFloat(pal.gap.text) || 8;

            var layer = comp.layers.addShape();
            layer.name = "虚线网格 " + COLS + "x" + ROWS;

            // 形状图层根内容
            var contents = layer.property("ADBE Root Vectors Group");
            // 顶层组
            var top = contents.addProperty("ADBE Vector Group");
            top.name = "网格 " + COLS + "x" + ROWS;
            // 组的内容容器 —— 形状/描边必须加到这里
            var content = top.property("ADBE Vectors Group");

            var halfW = GRID_W / 2, halfH = GRID_H / 2;

            function addPath(verts, closed) {
                // 自由路径的 match name 是 "ADBE Vector Shape - Group"
                var pp = content.addProperty("ADBE Vector Shape - Group");
                // Shape 对象用全局构造函数创建 (AVLayer 没有 newShape 方法)
                var sh = new Shape();
                sh.vertices = verts;
                var z = [];
                for (var i = 0; i < verts.length; i++) { z.push([0, 0]); }
                sh.inTangents = z;
                sh.outTangents = z;
                sh.closed = closed;
                pp.property("ADBE Vector Shape").setValue(sh);
            }

            // 外框 (闭合矩形)
            addPath([[ -halfW, -halfH ], [ halfW, -halfH ],
                     [ halfW,  halfH ], [ -halfW,  halfH ]], true);

            // 竖分隔线 (共 COLS-1 条)
            for (var c = 1; c < COLS; c++) {
                var x = -halfW + GRID_W * c / COLS;
                addPath([[x, -halfH], [x, halfH]], false);
            }
            // 横分隔线 (共 ROWS-1 条)
            for (var r = 1; r < ROWS; r++) {
                var y = -halfH + GRID_H * r / ROWS;
                addPath([[ -halfW, y ], [ halfW, y ]], false);
            }

            // 共享描边 —— 放到【组外】(Contents 根级), 这是关键:
            // Rick Gerard 物理方案: 描边不参与组变换, 缩放「网格组」变换时
            // 线宽/虚线间距天然保持, 连非等比缩放都有效 (表达式做不到这点)
            var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("ADBE Vector Stroke Width").setValue(STROKE_W);
            // 注意: Stroke Color 是 4D RGBA (速查表确认, 写 3D 会出错)
            stroke.property("ADBE Vector Stroke Color").setValue([0.85, 0.87, 1, 1]);

            // 虚线: Dashes 组是 NAMED_GROUP, Dash/Gap 属性"始终存在只是隐藏",
            // addProperty() 的作用是"揭示"隐藏属性, 揭示后 setValue 才有效
            // (参考社区 Dan Ebberts: stroke.property("ADBE Vector Stroke Dashes").addProperty("ADBE Vector Stroke Dash 1"))
            var dashes = stroke.property("ADBE Vector Stroke Dashes");
            var d1 = dashes.addProperty("ADBE Vector Stroke Dash 1"); // 揭示 Dash 1
            d1.setValue(DASH);
            var g1 = dashes.addProperty("ADBE Vector Stroke Gap 1");  // 揭示 Gap 1
            g1.setValue(GAP);

            // 缩放补偿: 双保险
            // 1) 物理方案(主): 描边在组外, 缩放「网格组」变换时线宽天然不变
            // 2) 表达式方案(辅): 缩放【图层本身】时, toComp 算出缩放因子,
            //    value 除以它实现视觉恒定; ||0.001 防除零
            // (非等比缩放图层时 AE 引擎无法完美保持, 社区共识)
            if (pal.keepStroke.value) {
                var SCALE_COMP = 'value / length(toComp([0,0]), toComp([0.7071,0.7071])) || 0.001;';
                stroke.property("ADBE Vector Stroke Width").expression = SCALE_COMP;
                d1.expression = SCALE_COMP;
                g1.expression = SCALE_COMP;
            }

            // 自由路径默认无填充, 无需 fill 代码
            // 状态区多行文本用 \r 换行 (ScriptUI multiline 兼容性最佳)
            setStatus(pal,
                "✓ 已生成 " + COLS + "x" + ROWS + " 共用边虚线网格\r提示: 缩放请用「网格组」变换, 线宽自动保持",
                [0.1, 0.75, 0.35]);
        } catch (e) {
            // 状态区显示错误摘要 + 弹可复制的调试对话框
            setStatus(pal, "✗ 出错: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        }
    }

    // ---- 标准面板模式: 停靠为面板时不新建窗口 ----
    var pal = (thisObj instanceof Panel) ? thisObj
        : new Window("palette", "虚线网格生成器", undefined, { resizeable: false });
    pal.orientation = "column";
    pal.alignChildren = "fill";
    pal.spacing = 8;
    pal.margins = 12;

    var p1 = pal.add("panel", undefined, "行列");
    p1.orientation = "row";
    p1.alignChildren = "center";
    p1.add("statictext", undefined, "列:");
    pal.cols = p1.add("edittext", undefined, "2");
    pal.cols.characters = 4;
    p1.add("statictext", undefined, "行:");
    pal.rows = p1.add("edittext", undefined, "2");
    pal.rows.characters = 4;

    var p2 = pal.add("panel", undefined, "尺寸");
    p2.orientation = "row";
    p2.alignChildren = "center";
    p2.add("statictext", undefined, "宽:");
    pal.gw = p2.add("edittext", undefined, "900");
    pal.gw.characters = 5;
    p2.add("statictext", undefined, "高:");
    pal.gh = p2.add("edittext", undefined, "600");
    pal.gh.characters = 5;

    var p3 = pal.add("panel", undefined, "线型");
    p3.orientation = "column";
    p3.alignChildren = "fill";
    var p3row = p3.add("group");
    p3row.orientation = "row";
    p3row.alignChildren = "center";
    p3row.add("statictext", undefined, "线宽:");
    pal.sw = p3row.add("edittext", undefined, "3");
    pal.sw.characters = 3;
    p3row.add("statictext", undefined, "虚线:");
    pal.dash = p3row.add("edittext", undefined, "14");
    pal.dash.characters = 4;
    p3row.add("statictext", undefined, "间隙:");
    pal.gap = p3row.add("edittext", undefined, "8");
    pal.gap.characters = 4;
    // 缩放补偿开关: 勾选后线宽/虚线间距不随图层缩放变化
    pal.keepStroke = p3.add("checkbox", undefined, "缩放时保持线宽与虚线间距");
    pal.keepStroke.value = true;

    var btn = pal.add("button", undefined, "生成网格");
    btn.onClick = function () { buildGrid(pal); };

    // ---- 状态展示区 (成功/失败信息显示在这里) ----
    // 注意: statictext 默认单行, 必须用 creation property {multiline:true}
    // 多行文本才生效且自动换行 (ScriptUI for Dummies / Adobe 社区确认)
    var statusPanel = pal.add("panel", undefined, "状态");
    statusPanel.alignChildren = "fill";
    pal.status = statusPanel.add("statictext", undefined,
        "就绪 - 填好参数点击生成", { multiline: true });
    pal.status.alignment = ["fill", "center"];
    pal.status.preferredSize = [300, 40];

    if (pal instanceof Window) { pal.center(); pal.show(); }
    else { pal.layout.layout(true); }

})(this);
