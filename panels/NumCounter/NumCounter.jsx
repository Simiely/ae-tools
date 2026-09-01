// ============================================================
// NumCounter · 数字计数器面板 (ScriptUI Panel, ExtendScript ES3)
//
// Version: 0.1.0
// Description: 一键生成「数字从起始值递增到目标值」的动画。
//   支持步进、小数位、字距、对齐、等宽锁定、前缀/后缀、缓动。
//   动画由「数值」滑块关键帧驱动 + sourceText 表达式实时格式化，
//   生成后仍可拖滑块/关键帧调整，无需重跑脚本。
//
// 安装: 放到 %APPDATA%\Adobe\After Effects\<ver>\Scripts\ScriptUI Panels\
//       (本仓库用 python install.py 统一部署)
// 使用: 重启 AE -> 窗口 > 扩展 > NumCounter · 数字计数器
//
// 抖动根因与修复: 比例字体数字宽度不等(1 比 8 窄),位数变化/同位数内变化
//   都会让文本宽度变 -> 左对齐整行右移、居中绕中心抖。
//   修复: ① 等宽数字字体(等宽锁定) ② 对齐(右/中,增长只朝一个方向)
//   ③ 固定位数(前导零,需配合等宽字体才彻底稳) ④ 字距作为统一加宽控制。
// ============================================================

(function (thisObj) {

    // ============================================================
    // 纯逻辑层 (node 可测, 必须进 test_NumCounter.js)
    // 与 sourceText 表达式内的格式化逻辑保持一致, 改这里必须同步表达式。
    // ============================================================

    // 把数值吸附到步进倍数 (step<=0 原样返回)
    function snapToStep(v, step) {
        if (!(step > 0)) { return v; }
        return Math.round(v / step) * step;
    }

    // 格式化为带固定小数位的字符串, 支持前缀/后缀与负号
    // dec: 小数位数(0~4); pre/suf: 前缀/后缀
    function formatNumber(v, dec, pre, suf) {
        pre = pre || "";
        suf = suf || "";
        var f = 1;
        for (var i = 0; i < dec; i++) { f = f * 10; }
        var val = Math.round(v * f) / f;
        var neg = val < 0;
        var av = Math.abs(val);
        var sc = Math.round(av * f);
        var s = String(sc);
        if (dec > 0) {
            while (s.length <= dec) { s = "0" + s; }
            var ip = s.substring(0, s.length - dec);
            var dp = s.substring(s.length - dec);
            s = ip + "." + dp;
        }
        if (neg && val !== 0) { s = "-" + s; }
        return pre + s + suf;
    }

    // node 测试导出: 在 AE 之外(app 未定义)只导出纯函数并返回, 跳过 UI 代码
    if (typeof app === "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            module.exports = { snapToStep: snapToStep, formatNumber: formatNumber };
        }
        return;
    }

    // ============================================================
    // 以下为 AE 运行环境代码
    // ============================================================

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
                    app.executeCommand(23); // 全选
                    app.executeCommand(19); // 复制
                } catch (e2) {
                    alert("自动复制失败, 请手动选中文本后 Ctrl+C\n" + e2);
                }
            };
            var okBtn = btnRow.add("button", undefined, "确定");
            okBtn.onClick = function () { win.close(); };

            win.center();
            win.show();
        } catch (e3) {
            alert("脚本出错:\n" + (err ? err.toString() : String(e3)));
        }
    }

    // ---- 状态区更新 (成功绿 / 失败红) ----
    function setStatus(pal, msg, rgb) {
        pal.status.text = msg;
        try {
            var pen = pal.status.graphics.newPen(0, rgb, 1);
            pal.status.graphics.foregroundColor = pen;
        } catch (e) { /* 颜色设置失败不影响文本 */ }
        try { pal.layout.layout(true); } catch (e2) {}
        try { pal.layout.resize(); } catch (e3) {}
    }

    // ---- 构建 sourceText 表达式 (ES3, 与 formatNumber 逻辑一致) ----
    // 引用效果按序号: effect(1)=数值, effect(2)=步进, effect(3)=小数位 (与添加顺序一致)
    function buildExpr(pre, suf) {
        var safePre = (pre || "").split('"').join('\\"');
        var safeSuf = (suf || "").split('"').join('\\"');
        return ""
            + 'var val = effect(1)("滑块");\n'      // 数值: 当前数值
            + 'var step = effect(2)("滑块");\n'     // 步进: 每次跳多少
            + 'var dec = effect(3)("滑块");\n'      // 小数位
            + 'if (step > 0) { val = Math.round(val / step) * step; }\n'
            + 'var f = 1; for (var i = 0; i < dec; i++) { f = f * 10; }\n'
            + 'val = Math.round(val * f) / f;\n'
            + 'var neg = val < 0; var av = Math.abs(val);\n'
            + 'var sc = Math.round(av * f); var s = String(sc);\n'
            + 'if (dec > 0) { while (s.length <= dec) { s = "0" + s; } var ip = s.substring(0, s.length - dec); var dp = s.substring(s.length - dec); s = ip + "." + dp; }\n'
            + 'if (neg && val !== 0) { s = "-" + s; }\n'
            + 'var PRE = "' + safePre + '"; var SUF = "' + safeSuf + '";\n'
            + 'PRE + s + SUF;\n';
    }

    // ---- 缓动: 写「数值」滑块两帧的 temporal ease (失败不影响计数, 退化为线性) ----
    // ease: 0 线性 / 1 缓入 / 2 缓出 / 3 缓入缓出
    function applyEasing(prop, ease) {
        if (!ease || ease === 0) { return; } // 线性: 保持默认
        try {
            if (typeof KeyframeType !== "undefined") {
                try { prop.setInterpolationTypeAtKey(1, KeyframeType.BEZIER, KeyframeType.BEZIER); } catch (e1) {}
                try { prop.setInterpolationTypeAtKey(2, KeyframeType.BEZIER, KeyframeType.BEZIER); } catch (e2) {}
            }
            var KE = KeyframeEase;
            var a, b;
            if (ease === 3) { a = 33; b = 33; }        // 缓入缓出
            else if (ease === 1) { a = 33; b = 0.1; }  // 缓入: 起步慢
            else if (ease === 2) { a = 0.1; b = 33; }  // 缓出: 收尾慢
            else { return; }
            var eSlow = [new KE(0, a)];
            var eLin = [new KE(0, b)];
            if (ease === 3) {
                prop.setTemporalEaseAtKey(1, eSlow, eSlow);
                prop.setTemporalEaseAtKey(2, eSlow, eSlow);
            } else if (ease === 1) {
                prop.setTemporalEaseAtKey(1, eSlow, eSlow);
                prop.setTemporalEaseAtKey(2, eLin, eLin);
            } else if (ease === 2) {
                prop.setTemporalEaseAtKey(1, eLin, eLin);
                prop.setTemporalEaseAtKey(2, eSlow, eSlow);
            }
        } catch (e) { /* 缓动失败退化为线性, 计数动画照常 */ }
    }

    // ---- 主生成逻辑 ----
    function buildCounter(pal) {
        var comp = null;
        try {
            comp = app.project.activeItem;
            if (!(comp && comp instanceof CompItem)) {
                setStatus(pal, "请先双击打开一个合成, 再点生成。", [0.85, 0.55, 0.1]);
                return;
            }

            app.beginUndoGroup("NumCounter 生成");

            var startVal = parseFloat(pal.startInp.text);
            if (isNaN(startVal)) { startVal = 0; }
            var targetVal = parseFloat(pal.targetInp.text);
            if (isNaN(targetVal)) { targetVal = 0; }
            var frames = parseInt(pal.framesInp.text, 10);
            if (isNaN(frames) || frames < 1) { frames = 30; }
            var step = parseFloat(pal.stepInp.text);
            if (!(step > 0)) { step = 0; }
            var dec = parseInt(pal.decInp.text, 10);
            if (isNaN(dec) || dec < 0) { dec = 0; }
            if (dec > 4) { dec = 4; }
            var tracking = parseFloat(pal.trackInp.text);
            if (isNaN(tracking)) { tracking = 0; }
            var font = pal.fontInp.text;
            var mono = pal.monoChk.value;
            var align = pal.alignDd.selection ? pal.alignDd.selection.index : 1; // 0左 1中 2右
            var pre = pal.preInp.text;
            var suf = pal.sufInp.text;
            var ease = pal.easeDd.selection ? pal.easeDd.selection.index : 0;     // 0线性 1入 2出 3入出

            // 新建文本图层
            var tl = comp.layers.addText("0");
            tl.name = "数字计数器 " + startVal + "→" + targetVal;

            // 文本文档属性: 字体 / 字号 / 字距 / 对齐 / 颜色
            var doc = tl.sourceText.value;
            doc.fillColor = [1, 1, 1];
            doc.fontSize = 120;
            if (mono) {
                doc.font = "Consolas";
            } else if (font && font.length > 0) {
                doc.font = font;
            }
            doc.tracking = tracking;
            var just = ParagraphJustification.LEFT;
            if (align === 1) { just = ParagraphJustification.CENTER; }
            else if (align === 2) { just = ParagraphJustification.RIGHT; }
            doc.justification = just;
            tl.sourceText.setValue(doc);

            // 三个滑块效果: 数值 / 步进 / 小数位 (顺序决定表达式 effect(1/2/3))
            var fxVal = tl.Effects.addProperty("ADBE Slider Control");
            fxVal.name = "数值";
            var fxStep = tl.Effects.addProperty("ADBE Slider Control");
            fxStep.name = "步进";
            var fxDec = tl.Effects.addProperty("ADBE Slider Control");
            fxDec.name = "小数位";

            var valProp = fxVal.property(1);  // Slider Control 唯一属性 = 滑块
            var stepProp = fxStep.property(1);
            var decProp = fxDec.property(1);

            var t0 = comp.time;
            var t1 = comp.time + frames * comp.frameDuration;
            valProp.setValueAtTime(startVal, t0);
            valProp.setValueAtTime(targetVal, t1);
            stepProp.setValue(step);
            decProp.setValue(dec);

            applyEasing(valProp, ease);

            // 源文本表达式: 实时按 数值/步进/小数位 格式化
            tl.sourceText.expression = buildExpr(pre, suf);

            tl.selected = true;

            setStatus(pal,
                "✓ 已生成: " + startVal + "→" + targetVal + " / " + frames + "帧"
                + (step > 0 ? " / 步进" + step : "")
                + (dec > 0 ? " / " + dec + "位小数" : "")
                + (mono ? " / 等宽" : "")
                + "\r提示: 拖「数值」滑块关键帧可调节奏, 改小数位/步进滑块即时变",
                [0.1, 0.75, 0.35]);
        } catch (e) {
            setStatus(pal, "✗ 出错: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        } finally {
            try { app.endUndoGroup(); } catch (e2) {}
        }
    }

    // ---- 重置面板输入 ----
    function resetInputs(pal) {
        pal.startInp.text = "0";
        pal.targetInp.text = "100";
        pal.framesInp.text = "30";
        pal.stepInp.text = "1";
        pal.decInp.text = "0";
        pal.trackInp.text = "0";
        pal.fontInp.text = "";
        pal.monoChk.value = true;
        pal.alignDd.selection = pal.alignDd.items[1]; // 中
        pal.preInp.text = "";
        pal.sufInp.text = "";
        pal.easeDd.selection = pal.easeDd.items[0];   // 线性
        setStatus(pal, "已重置为默认值", [0.6, 0.6, 0.6]);
    }

    // ---- 标准面板模式: 停靠为面板时不新建窗口 ----
    var pal = (thisObj instanceof Panel) ? thisObj
        : new Window("palette", "NumCounter · 数字计数器", undefined, { resizeable: false });
    pal.orientation = "column";
    pal.alignChildren = "fill";
    pal.spacing = 8;
    pal.margins = 12;

    // 参数区
    var pParam = pal.add("panel", undefined, "参数");
    pParam.orientation = "column";
    pParam.alignChildren = "fill";
    pParam.spacing = 6;

    function row(parent, label) {
        var g = parent.add("group");
        g.orientation = "row";
        g.alignChildren = "center";
        g.add("statictext", undefined, label);
        var inp = g.add("edittext", undefined, "");
        inp.characters = 8;
        return inp;
    }

    var r1 = pParam.add("group"); r1.orientation = "row"; r1.alignChildren = "center";
    r1.add("statictext", undefined, "起始数字:");
    pal.startInp = r1.add("edittext", undefined, "0"); pal.startInp.characters = 8;
    r1.add("statictext", undefined, "目标数字:");
    pal.targetInp = r1.add("edittext", undefined, "100"); pal.targetInp.characters = 8;

    var r2 = pParam.add("group"); r2.orientation = "row"; r2.alignChildren = "center";
    r2.add("statictext", undefined, "总帧数:");
    pal.framesInp = r2.add("edittext", undefined, "30"); pal.framesInp.characters = 6;
    r2.add("statictext", undefined, "步进值:");
    pal.stepInp = r2.add("edittext", undefined, "1"); pal.stepInp.characters = 6;

    var r3 = pParam.add("group"); r3.orientation = "row"; r3.alignChildren = "center";
    r3.add("statictext", undefined, "小数位:");
    pal.decInp = r3.add("edittext", undefined, "0"); pal.decInp.characters = 4;
    r3.add("statictext", undefined, "字距:");
    pal.trackInp = r3.add("edittext", undefined, "0"); pal.trackInp.characters = 5;

    // 字体与对齐区
    var pFont = pal.add("panel", undefined, "字体与对齐");
    pFont.orientation = "column";
    pFont.alignChildren = "fill";
    pFont.spacing = 6;

    var rf1 = pFont.add("group"); rf1.orientation = "row"; rf1.alignChildren = "center";
    rf1.add("statictext", undefined, "字体:");
    pal.fontInp = rf1.add("edittext", undefined, ""); pal.fontInp.characters = 14;
    rf1.add("statictext", undefined, "(留空=默认)");

    pal.monoChk = pFont.add("checkbox", undefined, "等宽锁定(强制等宽字体, 彻底消除数字抖动)");
    pal.monoChk.value = true;

    var rf2 = pFont.add("group"); rf2.orientation = "row"; rf2.alignChildren = "center";
    rf2.add("statictext", undefined, "对齐:");
    pal.alignDd = rf2.add("dropdownlist", undefined, ["左", "中", "右"]);
    pal.alignDd.selection = pal.alignDd.items[1];
    rf2.add("statictext", undefined, "缓动:");
    pal.easeDd = rf2.add("dropdownlist", undefined, ["线性", "缓入", "缓出", "缓入缓出"]);
    pal.easeDd.selection = pal.easeDd.items[0];

    var rf3 = pFont.add("group"); rf3.orientation = "row"; rf3.alignChildren = "center";
    rf3.add("statictext", undefined, "前缀:");
    pal.preInp = rf3.add("edittext", undefined, ""); pal.preInp.characters = 6;
    rf3.add("statictext", undefined, "后缀:");
    pal.sufInp = rf3.add("edittext", undefined, ""); pal.sufInp.characters = 6;

    // 按钮
    var btnRow = pal.add("group");
    btnRow.orientation = "row";
    btnRow.alignment = "center";
    btnRow.spacing = 10;
    var btnGen = btnRow.add("button", undefined, "生成");
    btnGen.onClick = function () { buildCounter(pal); };
    var btnReset = btnRow.add("button", undefined, "重置");
    btnReset.onClick = function () { resetInputs(pal); };

    // 状态区
    var statusPanel = pal.add("panel", undefined, "状态");
    statusPanel.alignChildren = "fill";
    pal.status = statusPanel.add("statictext", undefined,
        "就绪 - 填好参数点生成", { multiline: true });
    pal.status.alignment = ["fill", "center"];
    pal.status.preferredSize = [300, 40];

    if (pal instanceof Window) { pal.center(); pal.show(); }
    else { pal.layout.layout(true); }

})(this);
