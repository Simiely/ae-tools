// ============================================================
// NumCounter · 数字计数器面板 (ScriptUI Panel, ExtendScript ES3)
//
// Version: 0.2.2
// Description: 一键生成「数字从起始值递增到目标值」的动画。
//   支持步进、小数位、字间距、字体(家庭+字重)、等宽锁定、对齐、缓动。
//   动画由「数值」滑块关键帧驱动 + 每位独立文本图层的 sourceText 表达式实时格式化。
//   生成后仍可拖「数值」滑块关键帧调节奏, 改小数位/步进滑块即时变, 无需重跑脚本。
//   预设: 用 app.settings 持久化参数组合(保存/应用/删除)。
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
//
// 已知坑(AE ScriptUI 面板):
//   按钮 onClick 里直接对 AE 项目树做深层修改(新建 effect 后访问其子属性)会报
//   "Object is invalid"。修复: 用 app.scheduleTask 把生成逻辑延迟一帧到主线程上下文执行。
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

    // 预设序列化 / 反序列化 (纯函数, node 可测; ES3 无 JSON, 用 key=value& 格式)
    function serializePreset(o) {
        function kv(k, v) { return k + "=" + String(v); }
        return [kv("start", o.start), kv("target", o.target), kv("frames", o.frames),
            kv("step", o.step), kv("dec", o.dec), kv("track", o.track),
            kv("font", o.font), kv("style", o.style), kv("align", o.align),
            kv("ease", o.ease), kv("mono", o.mono ? "true" : "false")].join("&");
    }
    function deserializePreset(s) {
        var o = { start: 0, target: 100, frames: 30, step: 1, dec: 0, track: 0,
            font: "（默认）", style: "常规", align: 1, ease: 0, mono: true };
        if (!s) { return o; }
        var parts = s.split("&");
        for (var i = 0; i < parts.length; i++) {
            var kv = parts[i].split("=");
            if (kv.length < 2) { continue; }
            var k = kv[0]; var v = kv[1];
            if (k === "start") { o.start = parseFloat(v); }
            else if (k === "target") { o.target = parseFloat(v); }
            else if (k === "frames") { o.frames = parseInt(v, 10); }
            else if (k === "step") { o.step = parseFloat(v); }
            else if (k === "dec") { o.dec = parseInt(v, 10); }
            else if (k === "track") { o.track = parseFloat(v); }
            else if (k === "font") { o.font = v; }
            else if (k === "style") { o.style = v; }
            else if (k === "align") { o.align = parseInt(v, 10); }
            else if (k === "ease") { o.ease = parseInt(v, 10); }
            else if (k === "mono") { o.mono = (v === "true"); }
        }
        return o;
    }

    // node 测试导出: 在 AE 之外(app 未定义)只导出纯函数并返回, 跳过 UI 代码
    if (typeof app === "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            module.exports = {
                snapToStep: snapToStep, formatNumber: formatNumber,
                serializePreset: serializePreset, deserializePreset: deserializePreset
            };
        }
        return;
    }

    // ============================================================
    // 以下为 AE 运行环境代码
    // ============================================================

    var CTRL_NAME = "NumCounter 控制"; // 控制空对象名(数值/步进/小数位滑块)
    var PRESET_SECTION = "NumCounter";      // app.settings 分区
    var PRESET_INDEX_KEY = "_preset_index";  // 预设名索引(用 | 连接)

    // ---- 调试诊断缓冲: 每次生成清空前次, 失败时把详情显示给用户 ----
    var gDiag = [];
    function diag(msg) { try { gDiag.push(String(msg)); } catch (e) {} }
    function flushDiag(pal) {
        try { if (pal && pal.debugBox) { pal.debugBox.text = gDiag.join("\n"); } } catch (e) {}
    }

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
            + 'var val = ctrl.effect("数值")(1);\n'
            + 'var step = ctrl.effect("步进")(1);\n'
            + 'var dec = ctrl.effect("小数位")(1);\n'
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

    // ---- 取 Slider 效果的值属性(多层 fallback, 规避个别 AE 版本子属性判无效) ----
    // 返回 {prop, info}: prop 为可用属性或 null, info 为诊断字符串
    function sliderValueProp(eff) {
        if (!eff) { return { prop: null, info: "eff=null" }; }
        var tries = [
            { label: "property(1)", get: function () { return eff.property(1); } },
            { label: "eff(1)", get: function () { return eff(1); } },
            { label: 'property("滑块")', get: function () { return eff.property("滑块"); } }
        ];
        for (var i = 0; i < tries.length; i++) {
            try {
                var p = tries[i].get();
                if (p !== null && p !== undefined) {
                    return { prop: p, info: "OK via " + tries[i].label };
                }
                diag("  滑块值尝试 " + tries[i].label + " = 空");
            } catch (e) {
                diag("  滑块值尝试 " + tries[i].label + " 抛错: " + e.message);
            }
        }
        return { prop: null, info: "全部尝试失败" };
    }

    // ---- 主生成逻辑: 始终拆成每位数位图层 + 控制空对象 ----
    // 由 onClick 通过 app.scheduleTask 延迟一帧调用, 仅为避免面板回调长时间阻塞 UI 重绘;
    //   真正的「对象无效」修复见下方 Effects 引用复取(非 scheduleTask)
    function buildCounter(pal) {
        gDiag.length = 0;
        try {
            diag("=== 生成开始 (AE " + (app.version || "?") + ") ===");
            var comp = app.project.activeItem;
            diag("comp: " + (comp ? (comp instanceof CompItem ? "CompItem OK" : "非CompItem类型=" + (comp.constructor ? comp.constructor.name : "?")) : "null"));
            if (!(comp && comp instanceof CompItem)) {
                setStatus(pal, "请先双击打开一个合成, 再点生成。", [0.85, 0.55, 0.1]);
                flushDiag(pal);
                return;
            }

            // 强制把合成激活到前台 viewer
            try { comp.openInViewer(); diag("openInViewer OK"); } catch (e) { diag("openInViewer 抛错: " + e.message); }

            // 清理上次生成的同类图层(控制层 + 数位层), 避免 thisComp.layer 命中旧的、无关键帧的控制层
            // (旧控制层无关键帧 => 表达式读到的数值恒定 => 计数不动)
            try {
                var toRemove = [];
                for (var li = 1; li <= comp.numLayers; li++) {
                    var L = comp.layer(li);
                    var nm = L ? L.name : "";
                    if (nm === CTRL_NAME || (nm && nm.indexOf("数位") === 0)) {
                        toRemove.push(L);
                    }
                }
                for (var ri = 0; ri < toRemove.length; ri++) {
                    try { toRemove[ri].remove(); } catch (e2) {}
                }
                diag("清理旧图层: " + toRemove.length + " 个(控制层/数位层)");
            } catch (e) { diag("清理旧图层跳过: " + e.message); }

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
            diag("参数: start=" + startVal + " target=" + targetVal + " frames=" + frames
                + " step=" + step + " dec=" + dec + " track=" + tracking + " mono=" + mono
                + " align=" + align + " ease=" + ease + " font=" + ps);

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
            // 权威修复(见 ae-scripting.docsforadobe.dev > PropertyBase > Reference invalidation;
            //   omino.com/pixelblog/2009/08/04/ae-scripting-notes; Dan Ebberts / Tomas Sinkunas 在
            //   Adobe 社区确认): Effects 是「索引属性组」, 每调用一次 addProperty 就会使同组内
            //   所有既有引用失效。因此绝不能在一次添加后、下一次添加前持有该引用去访问子属性;
            //   正确做法是: 三个效果全部 addProperty 完, 再按名字重新取回, 然后访问其子属性。
            var ctrl = comp.layers.addNull();
            ctrl.name = CTRL_NAME;
            diag("ctrl 创建: name=" + ctrl.name + " matchName=" + (ctrl.matchName || "?"));
            // 仅依次添加并命名, 不在此处持有引用去取值(否则下一次 addProperty 会使其失效)
            ctrl.Effects.addProperty("ADBE Slider Control").name = "数值";
            ctrl.Effects.addProperty("ADBE Slider Control").name = "步进";
            ctrl.Effects.addProperty("ADBE Slider Control").name = "小数位";
            // 全部加完后再按名字重新取回(此前的引用已失效) —— 关键修复
            var fxVal = ctrl.Effects.property("数值");
            var fxStep = ctrl.Effects.property("步进");
            var fxDec = ctrl.Effects.property("小数位");
            diag("复取: 数值 typeof=" + (typeof fxVal) + " instanceof PropertyGroup=" + (fxVal instanceof PropertyGroup)
                + " numProperties=" + (fxVal ? fxVal.numProperties : "?"));

            var r1 = sliderValueProp(fxVal);
            var r2 = sliderValueProp(fxStep);
            var r3 = sliderValueProp(fxDec);
            diag("滑块值获取: 数值=" + r1.info + " | 步进=" + r2.info + " | 小数位=" + r3.info);
            var valProp = r1.prop, stepProp = r2.prop, decProp = r3.prop;

            if (!valProp || !stepProp || !decProp) {
                // 收集详细诊断, 弹窗 + 状态栏 + 调试框 三处都给, 方便反馈
                var dmsg = "创建滑块控制失败(对象无效)。\n"
                    + "comp=" + (comp ? "CompItem" : "null") + "\n"
                    + "ctrl.name=" + (ctrl ? ctrl.name : "null") + "\n"
                    + "fxVal typeof=" + (typeof fxVal)
                    + " instanceof PropertyGroup=" + (fxVal instanceof PropertyGroup)
                    + " numProperties=" + (fxVal ? fxVal.numProperties : "?") + "\n";
                try { var t1 = fxVal.property(1); dmsg += "property(1)=" + (t1 != null); }
                catch (e) { dmsg += "property(1) 抛错: " + e.message; }
                try { var t2 = fxVal(1); dmsg += "\neff(1)=" + (t2 != null); }
                catch (e) { dmsg += "\neff(1) 抛错: " + e.message; }
                try { var t3 = fxVal.property("滑块"); dmsg += "\nproperty(滑块)=" + (t3 != null); }
                catch (e) { dmsg += "\nproperty(滑块) 抛错: " + e.message; }
                dmsg += "\n\n如反复出现, 请截此信息反馈(含 AE 版本)。";
                setStatus(pal, "✗ 创建滑块控制失败(对象无效)", [0.85, 0.3, 0.3]);
                diag("!! 失败: " + dmsg);
                flushDiag(pal);
                alert(dmsg);
                app.endUndoGroup();
                return;
            }

            // 关键帧锚点: 默认锚在当前播放头; 若会超出合成时长, 则回退到 0(保证首播可见)
            var fd = frames * comp.frameDuration;
            var t0 = comp.time;
            if (t0 + fd > comp.duration) { t0 = 0; }
            var t1 = t0 + fd;
            valProp.setValueAtTime(startVal, t0);
            valProp.setValueAtTime(targetVal, t1);
            stepProp.setValue(step);
            decProp.setValue(dec);
            applyEasing(valProp, ease);
            diag("滑块关键帧设置 OK (数值 " + startVal + "->" + targetVal + ")");

            // 关键修复(证据: Adobe HelpX「表达式错误」+ CSDN AE 社区高采纳):
            // 控制空对象(Null)本身不渲染任何像素, 无需禁用; 一旦 enabled=false,
            // 其滑块关键帧在播放时不会更新 => 数位图层读到的数值恒定 => 计数不动。
            // 故保持 enabled=true, 空对象不可见且关键帧可正常驱动表达式。
            ctrl.enabled = true;
            diag("ctrl 保持 enabled=true(空对象不可见, 关键帧驱动表达式正常)");

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
            diag("数位图层生成 OK: 共 " + slotCount + " 个");

            try { ctrl.selected = true; } catch (e) { diag("ctrl.selected 抛错(忽略): " + e.message); }

            setStatus(pal,
                "✓ 已生成: " + startVal + "→" + targetVal + " / " + frames + "帧"
                + (step > 0 ? " / 步进" + step : "")
                + (dec > 0 ? " / " + dec + "位小数" : "")
                + (mono ? " / 等宽" : "")
                + " / " + slotCount + "位独立图层"
                + "\r提示: 拖「" + CTRL_NAME + "」的「数值」滑块关键帧调节奏",
                [0.1, 0.75, 0.35]);
            diag("=== 生成成功 ===");
        } catch (e) {
            setStatus(pal, "✗ 出错: " + e.toString(), [0.9, 0.25, 0.2]);
            diag("!! 异常: " + e.toString() + (e.line !== undefined ? " @line " + e.line : ""));
            showDebugError(e);
        } finally {
            try { app.endUndoGroup(); } catch (e2) {}
            flushDiag(pal);
        }
    }

    // ---- 预设: 用 app.settings 持久化(跨会话) ----
    function getPresetNames() {
        try {
            if (app.settings.haveSetting(PRESET_SECTION, PRESET_INDEX_KEY)) {
                var s = app.settings.getSetting(PRESET_SECTION, PRESET_INDEX_KEY);
                if (s && s.length) { return s.split("|"); }
            }
        } catch (e) {}
        return [];
    }
    function refreshPresetDd(pal) {
        var names = getPresetNames();
        pal.presetDd.removeAll();
        pal.presetDd.add("item", "（当前参数）");
        for (var i = 0; i < names.length; i++) { pal.presetDd.add("item", names[i]); }
        pal.presetDd.selection = pal.presetDd.items[0];
    }
    function savePreset(pal) {
        try {
            var name = prompt("预设名称:", "预设1");
            if (!name) { return; }
            var o = {
                start: parseFloat(pal.startInp.text) || 0,
                target: parseFloat(pal.targetInp.text) || 0,
                frames: parseInt(pal.framesInp.text, 10) || 30,
                step: parseFloat(pal.stepInp.text) || 0,
                dec: parseInt(pal.decInp.text, 10) || 0,
                track: parseFloat(pal.trackInp.text) || 0,
                font: pal.fontDd.selection ? pal.fontDd.selection.text : "（默认）",
                style: pal.styleDd.selection ? pal.styleDd.selection.text : "常规",
                align: pal.alignDd.selection ? pal.alignDd.selection.index : 1,
                ease: pal.easeDd.selection ? pal.easeDd.selection.index : 0,
                mono: pal.monoChk.value
            };
            var s = serializePreset(o);
            app.settings.saveSetting(PRESET_SECTION, "preset_" + name, s, "user");
            var names = getPresetNames();
            var found = false;
            for (var i = 0; i < names.length; i++) { if (names[i] === name) { found = true; break; } }
            if (!found) { names.push(name); }
            app.settings.saveSetting(PRESET_SECTION, PRESET_INDEX_KEY, names.join("|"), "user");
            refreshPresetDd(pal);
            for (var j = 0; j < pal.presetDd.items.length; j++) {
                if (pal.presetDd.items[j].text === name) { pal.presetDd.selection = pal.presetDd.items[j]; break; }
            }
            setStatus(pal, "✓ 已保存预设: " + name, [0.1, 0.75, 0.35]);
        } catch (e) {
            setStatus(pal, "✗ 保存预设失败: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        }
    }
    function loadPreset(pal) {
        try {
            var sel = pal.presetDd.selection;
            if (!sel || sel.text === "（当前参数）") { setStatus(pal, "请先在下拉选择已存预设", [0.85, 0.55, 0.1]); return; }
            var name = sel.text;
            if (!app.settings.haveSetting(PRESET_SECTION, "preset_" + name)) {
                setStatus(pal, "预设不存在: " + name, [0.9, 0.25, 0.2]); return;
            }
            var s = app.settings.getSetting(PRESET_SECTION, "preset_" + name);
            var o = deserializePreset(s);
            pal.startInp.text = String(o.start);
            pal.targetInp.text = String(o.target);
            pal.framesInp.text = String(o.frames);
            pal.stepInp.text = String(o.step);
            pal.decInp.text = String(o.dec);
            pal.trackInp.text = String(o.track);
            var fi = -1;
            for (var i = 0; i < pal.fontDd.items.length; i++) { if (pal.fontDd.items[i].text === o.font) { fi = i; break; } }
            if (fi >= 0) { pal.fontDd.selection = pal.fontDd.items[fi]; refreshStyleDd(pal); }
            var si = -1;
            for (var k = 0; k < pal.styleDd.items.length; k++) { if (pal.styleDd.items[k].text === o.style) { si = k; break; } }
            if (si >= 0) { pal.styleDd.selection = pal.styleDd.items[si]; }
            pal.monoChk.value = o.mono;
            pal.fontDd.enabled = !o.mono;
            pal.styleDd.enabled = !o.mono;
            if (o.align >= 0 && o.align < pal.alignDd.items.length) { pal.alignDd.selection = pal.alignDd.items[o.align]; }
            if (o.ease >= 0 && o.ease < pal.easeDd.items.length) { pal.easeDd.selection = pal.easeDd.items[o.ease]; }
            setStatus(pal, "✓ 已应用预设: " + name, [0.1, 0.75, 0.35]);
        } catch (e) {
            setStatus(pal, "✗ 应用预设失败: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        }
    }
    function deletePreset(pal) {
        try {
            var sel = pal.presetDd.selection;
            if (!sel || sel.text === "（当前参数）") { setStatus(pal, "请先选择要删除的预设", [0.85, 0.55, 0.1]); return; }
            var name = sel.text;
            try { app.settings.deleteSetting(PRESET_SECTION, "preset_" + name); } catch (e) {}
            var names = getPresetNames();
            var out = [];
            for (var i = 0; i < names.length; i++) { if (names[i] !== name) { out.push(names[i]); } }
            app.settings.saveSetting(PRESET_SECTION, PRESET_INDEX_KEY, out.join("|"), "user");
            refreshPresetDd(pal);
            setStatus(pal, "✓ 已删除预设: " + name, [0.6, 0.6, 0.6]);
        } catch (e) {
            setStatus(pal, "✗ 删除预设失败: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
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

    // 预设区 (app.settings 持久化)
    var pPreset = pal.add("panel", undefined, "预设");
    pPreset.orientation = "column";
    pPreset.alignChildren = "fill";
    pPreset.spacing = 6;
    var pr1 = pPreset.add("group"); pr1.orientation = "row"; pr1.alignChildren = "center";
    pr1.add("statictext", undefined, "预设:");
    pal.presetDd = pr1.add("dropdownlist", undefined, ["（当前参数）"]);
    pal.presetDd.selection = pal.presetDd.items[0];
    pal.presetDd.preferredSize.width = 150;
    var pr2 = pPreset.add("group"); pr2.orientation = "row"; pr2.alignment = "center"; pr2.spacing = 8;
    var btnSave = pr2.add("button", undefined, "保存预设");
    var btnLoad = pr2.add("button", undefined, "应用预设");
    var btnDel = pr2.add("button", undefined, "删除预设");
    btnSave.onClick = function () { savePreset(pal); };
    btnLoad.onClick = function () { loadPreset(pal); };
    btnDel.onClick = function () { deletePreset(pal); };
    refreshPresetDd(pal); // 填充已存预设

    // 按钮
    var btnRow = pal.add("group");
    btnRow.orientation = "row";
    btnRow.alignment = "center";
    btnRow.spacing = 10;
    var btnGen = btnRow.add("button", undefined, "生成");
    // 关键修复: 用 scheduleTask 延迟到主线程上下文执行, 规避 Panel 按钮回调里
    // 新建 effect 子属性被 AE 判为 "对象无效" 的已知坑
    btnGen.onClick = function () {
        NC_pal = pal; // 全局引用, 供 scheduleTask 字符串回调访问
        try {
            app.scheduleTask("if (typeof NC_buildCounter === 'function') { NC_buildCounter(NC_pal); }", 0);
        } catch (e) {
            buildCounter(pal); // 兜底: 个别环境 scheduleTask 不可用则直接执行
        }
    };
    var btnReset = btnRow.add("button", undefined, "重置");
    btnReset.onClick = function () { resetInputs(pal); };

    // 状态区
    var statusPanel = pal.add("panel", undefined, "状态");
    statusPanel.alignChildren = "fill";
    pal.status = statusPanel.add("statictext", undefined,
        "就绪 - 填好参数点生成", { multiline: true });
    pal.status.alignment = ["fill", "center"];
    pal.status.preferredSize = [300, 40];

    // 调试输出区 (实时显示诊断, 便于复制反馈)
    var dbgPanel = pal.add("panel", undefined, "调试输出");
    dbgPanel.alignChildren = "fill";
    pal.debugBox = dbgPanel.add("edittext", undefined, "", { multiline: true, readonly: true });
    pal.debugBox.preferredSize = [300, 90];

    if (pal instanceof Window) { pal.center(); pal.show(); }
    else { pal.layout.layout(true); }

    // 暴露到全局, 供 scheduleTask 字符串回调引用(无 var -> 全局属性)
    NC_buildCounter = buildCounter;

})(this);
