// ============================================================
// NumCounter · 数字计数器面板 (ScriptUI Panel, ExtendScript ES3)
//
// Version: 0.2.0
// Description: 一键生成「数字从起始值递增到目标值」的动画。
//   支持步进、小数位、字间距、字体(家庭+字重)、等宽锁定、对齐、缓动。
//   动画由「数值」滑块关键帧驱动 + 每位独立文本图层的 sourceText 表达式实时格式化。
//   生成后仍可拖「数值」滑块关键帧调节奏, 改小数位/步进滑块即时变, 无需重跑脚本。
//
// 安装: 放到 %APPDATA%\Adobe\After Effects\<ver>\Scripts\ScriptUI Panels\
//       (本仓库用 python install.py 统一部署)
// 使用: 重启 AE -> 窗口 > 扩展 > NumCounter · 数字计数器
//
// 抖动根因与修复(本版 = 独立数位 / odometer):
//   比例字体数字宽度不等(1 比 8 窄), 单文本图层里位数变化会让整行伸缩 -> 抖动。
//   本版把每一位拆成固定槽位的独立文本图层, 由共享「数值」滑块驱动,
//   每位表达式只截取自己那一位的字符。每位待在自己槽里, 邻居不动 -> 任意字体零抖动。
//   字体/字重通过 app.fonts.allFonts 枚举(家庭 -> 字重两级联动), 适配不同字体。
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
    // dec: 小数位数(0~4); pre/suf: 前缀/后缀(本版 UI 不暴露, 保留给表达式兼容)
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

    var CTRL_NAME = "NumCounter 控制"; // 控制空对象名(数值/步进/小数位滑块)

    // ---- 字体枚举: 从 app.fonts (AE 24.0+) 取系统字体做两级下拉 ----
    // gFontFamilyList: 家庭名下拉项(含「(默认)」与等宽字体)
    // gFontStyles: 家庭名 -> [{style: 字重名, ps: PostScript 名}] (按家庭内顺序)
    // gFontMap: 家庭名 -> PostScript 名(兜底, 用于 Consolas/Courier New 等未进 allFonts 的)
    var gFontFamilyList = ["（默认）"];
    var gFontStyles = {};
    var gFontMap = {};
    function ensureMonoInList(name) {
        for (var i = 0; i < gFontFamilyList.length; i++) {
            if (gFontFamilyList[i] === name) { return; }
        }
        gFontFamilyList.push(name);
        gFontMap[name] = name;
    }
    function collectFonts() {
        try {
            if (typeof app.fonts === "undefined" || !app.fonts) { return; }
            var all = app.fonts.allFonts;
            if (!all || !all.length) { return; }
            var seen = {};
            for (var i = 0; i < all.length; i++) {
                var fam = all[i];
                if (!fam) { continue; }
                var arr = (fam instanceof Array) ? fam : [fam];
                var first = arr[0];
                if (!first || !first.familyName) { continue; }
                var fn = first.familyName;
                if (seen[fn]) { continue; }
                seen[fn] = true;
                gFontFamilyList.push(fn);
                gFontMap[fn] = first.postScriptName || fn;
                var styles = [];
                for (var k = 0; k < arr.length; k++) {
                    var fo = arr[k];
                    if (!fo) { continue; }
                    styles.push({ style: fo.styleName || "常规", ps: fo.postScriptName || fn });
                }
                gFontStyles[fn] = styles;
            }
            ensureMonoInList("Consolas");
            ensureMonoInList("Courier New");
        } catch (e) { /* 字体枚举失败则用默认列表(仅等宽) */ }
    }

    // ---- 对齐枚举兼容: AE 2026 成员名为 *_JUSTIFY, 旧版曾用 LEFT/CENTER/RIGHT ----
    function getJustification(align) {
        try {
            var P = ParagraphJustification;
            if (typeof P === "undefined") { return undefined; }
            var names = {
                0: ["LEFT", "LEFT_JUSTIFY"],
                1: ["CENTER", "CENTER_JUSTIFY"],
                2: ["RIGHT", "RIGHT_JUSTIFY"]
            };
            var ns = names[align] || names[1];
            for (var i = 0; i < ns.length; i++) {
                if (P[ns[i]] !== undefined) { return P[ns[i]]; }
            }
            return undefined;
        } catch (e) { return undefined; }
    }

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

    // ---- 构建每位数位图层的 sourceText 表达式 (ES3, 与 formatNumber 逻辑一致) ----
    // 引用控制层 CTRL_NAME 的效果: 数值 / 步进 / 小数位
    // SLOT/SLOTCOUNT 为本层槽位索引与总槽数(生成时写死到表达式里)
    function buildSlotExpr(slotIndex, slotCount, ctrlName) {
        return ""
            + 'var ctrl = thisComp.layer("' + ctrlName + '");\n'
            + 'var val = ctrl("Effects")("数值")("滑块");\n'
            + 'var step = ctrl("Effects")("步进")("滑块");\n'
            + 'var dec = ctrl("Effects")("小数位")("滑块");\n'
            + 'if (step > 0) { val = Math.round(val / step) * step; }\n'
            + 'var f = 1; for (var i = 0; i < dec; i++) { f = f * 10; }\n'
            + 'val = Math.round(val * f) / f;\n'
            + 'var neg = val < 0; var av = Math.abs(val);\n'
            + 'var sc = Math.round(av * f); var s = String(sc);\n'
            + 'if (dec > 0) { while (s.length <= dec) { s = "0" + s; } var ip = s.substring(0, s.length - dec); var dp = s.substring(s.length - dec); s = ip + "." + dp; }\n'
            + 'if (neg && val !== 0) { s = "-" + s; }\n'
            + 'var SLOT = ' + slotIndex + '; var SLOTCOUNT = ' + slotCount + ';\n'
            + 'var fr = SLOTCOUNT - 1 - SLOT; var ch = (fr >= 0 && fr < s.length) ? s.charAt(s.length - 1 - fr) : "";\n'
            + 'ch;\n';
    }

    // ---- 计算总槽数(= 起始/目标格式化字符串的最大长度, 含符号与小数点) ----
    function computeSlotCount(startVal, targetVal, dec) {
        function fstr(v) {
            var s = formatNumber(Math.abs(v), dec, "", "");
            return (v < 0 ? "-" : "") + s;
        }
        var a = fstr(startVal);
        var b = fstr(targetVal);
        var n = Math.max(a.length, b.length);
        return n > 0 ? n : 1;
    }

    // ---- 解析当前所选字体 -> PostScript 名(含字重) ----
    function resolveFontPs(pal) {
        if (pal.monoChk.value) { return "Consolas"; }
        var fam = pal.fontDd.selection ? pal.fontDd.selection.text : "（默认）";
        if (!fam || fam === "（默认）") { return ""; }
        var styles = gFontStyles[fam];
        if (styles && styles.length) {
            var si = pal.styleDd.selection ? pal.styleDd.selection.index : 0;
            if (si < 0 || si >= styles.length) { si = 0; }
            return styles[si].ps || fam;
        }
        return gFontMap[fam] || fam; // 兜底
    }

    // ---- 缓动: 写「数值」滑块两帧的 temporal ease (失败不影响计数, 退化为线性) ----
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

    // ---- 主生成逻辑: 始终拆成每位数位图层 + 控制空对象 ----
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
            var tracking = parseFloat(pal.trackInp.text); // 本版 = 槽位间额外间距(px)
            if (isNaN(tracking)) { tracking = 0; }
            var mono = pal.monoChk.value;
            var align = pal.alignDd.selection ? pal.alignDd.selection.index : 1; // 0左 1中 2右
            var ease = pal.easeDd.selection ? pal.easeDd.selection.index : 0;     // 0线性 1入 2出 3入出
            var ps = resolveFontPs(pal);

            var fontSize = 120;
            var slotCount = computeSlotCount(startVal, targetVal, dec);
            var slotW = fontSize * 0.6 + tracking; // 槽位间距(px)
            var totalW = slotCount * slotW;
            var blockLeft;
            if (align === 0) { blockLeft = 0; }
            else if (align === 2) { blockLeft = comp.width - totalW; }
            else { blockLeft = (comp.width - totalW) / 2; }
            var cy = comp.height / 2;

            // 控制空对象: 数值/步进/小数位 滑块(数位图层统一引用)
            var ctrl = comp.layers.addNull();
            ctrl.name = CTRL_NAME;
            ctrl.enabled = false; // 不可见, 仅作控制
            var fxVal = ctrl.Effects.addProperty("ADBE Slider Control");
            fxVal.name = "数值";
            var fxStep = ctrl.Effects.addProperty("ADBE Slider Control");
            fxStep.name = "步进";
            var fxDec = ctrl.Effects.addProperty("ADBE Slider Control");
            fxDec.name = "小数位";
            var valProp = fxVal.property(1);
            var stepProp = fxStep.property(1);
            var decProp = fxDec.property(1);
            var t0 = comp.time;
            var t1 = comp.time + frames * comp.frameDuration;
            valProp.setValueAtTime(startVal, t0);
            valProp.setValueAtTime(targetVal, t1);
            stepProp.setValue(step);
            decProp.setValue(dec);
            applyEasing(valProp, ease);

            // 逐个槽位建独立文本图层
            for (var i = 0; i < slotCount; i++) {
                var tl = comp.layers.addText("0");
                tl.name = "数位 " + i;
                var doc = tl.sourceText.value;
                doc.fillColor = [1, 1, 1];
                doc.fontSize = fontSize;
                try {
                    if (ps && ps.length > 0) { doc.font = ps; }
                } catch (e) { /* 字体失败保留默认 */ }
                doc.tracking = 0; // 单字符, tracking 无意义
                var just = getJustification(1); // 每位数位居中于槽
                if (just !== undefined) { doc.justification = just; }
                tl.sourceText.setValue(doc);
                // 固定槽位坐标(每位独立定位 -> 任意字体零抖动)
                var cx = blockLeft + i * slotW + slotW / 2;
                tl.position.setValue([cx, cy]);
                // 源文本表达式: 截取本槽位字符
                tl.sourceText.expression = buildSlotExpr(i, slotCount, CTRL_NAME);
            }

            ctrl.selected = true;

            setStatus(pal,
                "✓ 已生成: " + startVal + "→" + targetVal + " / " + frames + "帧"
                + (step > 0 ? " / 步进" + step : "")
                + (dec > 0 ? " / " + dec + "位小数" : "")
                + (mono ? " / 等宽" : "")
                + " / " + slotCount + "位独立图层"
                + "\r提示: 拖「" + CTRL_NAME + "」的「数值」滑块关键帧调节奏",
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
        pal.fontDd.selection = pal.fontDd.items[0]; // 默认
        refreshStyleDd(pal);
        pal.monoChk.value = true;
        pal.fontDd.enabled = !pal.monoChk.value;
        pal.styleDd.enabled = !pal.monoChk.value;
        pal.alignDd.selection = pal.alignDd.items[1]; // 中
        pal.easeDd.selection = pal.easeDd.items[0];   // 线性
        setStatus(pal, "已重置为默认值", [0.6, 0.6, 0.6]);
    }

    // ---- 字体两级联动: 家庭变化 -> 重建字重下拉 ----
    function refreshStyleDd(pal) {
        var fam = pal.fontDd.selection ? pal.fontDd.selection.text : "（默认）";
        var styles = gFontStyles[fam];
        var items = ["常规"];
        if (styles && styles.length) {
            items = [];
            for (var i = 0; i < styles.length; i++) { items.push(styles[i].style); }
        }
        pal.styleDd.removeAll();
        for (var j = 0; j < items.length; j++) { pal.styleDd.add("item", items[j]); }
        pal.styleDd.selection = pal.styleDd.items[0];
    }

    // ---- 标准面板模式: 停靠为面板时不新建窗口 ----
    collectFonts(); // 填充字体下拉(必须在建 UI 前)
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
    r3.add("statictext", undefined, "字间距(px):");
    pal.trackInp = r3.add("edittext", undefined, "0"); pal.trackInp.characters = 5;

    // 字体与对齐区
    var pFont = pal.add("panel", undefined, "字体与对齐");
    pFont.orientation = "column";
    pFont.alignChildren = "fill";
    pFont.spacing = 6;

    var rf1 = pFont.add("group"); rf1.orientation = "row"; rf1.alignChildren = "center";
    rf1.add("statictext", undefined, "字体:");
    pal.fontDd = rf1.add("dropdownlist", undefined, gFontFamilyList);
    pal.fontDd.selection = pal.fontDd.items[0]; // 默认
    pal.fontDd.preferredSize.width = 130;
    rf1.add("statictext", undefined, "字重:");
    pal.styleDd = rf1.add("dropdownlist", undefined, ["常规"]);
    pal.styleDd.selection = pal.styleDd.items[0];
    pal.styleDd.preferredSize.width = 90;
    pal.fontDd.onChange = function () { refreshStyleDd(pal); };

    pal.monoChk = pFont.add("checkbox", undefined, "等宽锁定(强制 Consolas, 适配不同字体零抖动)");
    pal.monoChk.value = true;
    pal.fontDd.enabled = !pal.monoChk.value; // 等宽锁定开启时禁用字体/字重下拉
    pal.styleDd.enabled = !pal.monoChk.value;
    pal.monoChk.onClick = function () {
        pal.fontDd.enabled = !pal.monoChk.value;
        pal.styleDd.enabled = !pal.monoChk.value;
    };

    var rf2 = pFont.add("group"); rf2.orientation = "row"; rf2.alignChildren = "center";
    rf2.add("statictext", undefined, "对齐:");
    pal.alignDd = rf2.add("dropdownlist", undefined, ["左", "中", "右"]);
    pal.alignDd.selection = pal.alignDd.items[1];
    rf2.add("statictext", undefined, "缓动:");
    pal.easeDd = rf2.add("dropdownlist", undefined, ["线性", "缓入", "缓出", "缓入缓出"]);
    pal.easeDd.selection = pal.easeDd.items[0];

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
