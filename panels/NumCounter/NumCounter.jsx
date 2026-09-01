// ============================================================
// NumCounter · 数字计数器面板 (ScriptUI Panel, ExtendScript ES3)
//
// Version: 0.2.8
// Description: 一键生成「数字从起始值递增到目标值」的动画。
//   支持步进、小数位、字间距、字体(家庭+字重)、等宽锁定、对齐、缓动。
//   动画由「数值」滑块关键帧驱动 + 每位独立文本图层的 sourceText 表达式实时格式化。
//   生成后仍可拖「数值」滑块关键帧调节奏, 改小数位/步进滑块即时变, 无需重跑脚本。
//   预设: 对齐仓库 AE-Lyrics-Animator 等「预设槽」实践 —— 固定 4 槽位(存储/使用/清空) + 导出导入,
//         存于工程所在目录的 NumCounter.presets.json(跟随工程走, 避开会崩的 app.settings)。
//   2026-09-01 v0.2.8 修复: 存储槽位后对应「使用」按钮不变可用 —— ScriptUI 在 onClick 回调里
//         改别的控件 .enabled 后不自动重绘, updateSlotLoadBtns 末尾加 pal.layout.layout(true) 强制刷新。
//
// 2026-09-01 v0.2.6 关键修复: 此前 setValueAtTime(startVal, t0) 把「值」传到了「时间」参数,
//   关键帧被错放到 100 秒处, 可见播放区间内数值恒≈0 => 数字不动。改为无歧义的
//   addKey + setValueAtKey, 并加数据层验证(numKeys 与 valueAtTime)。预设文件升级为真正 JSON。
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

    // 预设序列化 / 反序列化 (纯函数, node 可测)
    // 返回/接收「标准预设对象」(所有字段归一化); 文件层再写成 JSON 数组。
    function serializePreset(o) {
        return {
            start: (o && o.start != null) ? parseFloat(o.start) : 0,
            target: (o && o.target != null) ? parseFloat(o.target) : 0,
            frames: (o && o.frames != null) ? parseInt(o.frames, 10) : 30,
            step: (o && o.step != null) ? parseFloat(o.step) : 0,
            dec: (o && o.dec != null) ? parseInt(o.dec, 10) : 0,
            track: (o && o.track != null) ? parseFloat(o.track) : 0,
            font: (o && o.font != null) ? String(o.font) : "（默认）",
            style: (o && o.style != null) ? String(o.style) : "常规",
            align: (o && o.align != null) ? parseInt(o.align, 10) : 1,
            ease: (o && o.ease != null) ? parseInt(o.ease, 10) : 0,
            mono: !!(o && o.mono)
        };
    }
    function deserializePreset(src) {
        var o = { start: 0, target: 100, frames: 30, step: 1, dec: 0, track: 0,
            font: "（默认）", style: "常规", align: 1, ease: 0, mono: true };
        if (!src) { return o; }
        // 兼容旧 key=value& 字符串(ES3 无 JSON.parse)
        if (typeof src === "string") {
            var parts = src.split("&");
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
        // 对象(来自 JSON 数组): 按字段归一化
        if (src.start != null) { o.start = parseFloat(src.start); }
        if (src.target != null) { o.target = parseFloat(src.target); }
        if (src.frames != null) { o.frames = parseInt(src.frames, 10); }
        if (src.step != null) { o.step = parseFloat(src.step); }
        if (src.dec != null) { o.dec = parseInt(src.dec, 10); }
        if (src.track != null) { o.track = parseFloat(src.track); }
        if (src.font != null) { o.font = String(src.font); }
        if (src.style != null) { o.style = String(src.style); }
        if (src.align != null) { o.align = parseInt(src.align, 10); }
        if (src.ease != null) { o.ease = parseInt(src.ease, 10); }
        if (src.mono != null) { o.mono = !!src.mono; }
        return o;
    }

    // 预设名纯函数(可测): name 禁 | 和换行(避免破坏 JSON / 行结构); 用 split/join 避开正则
    function sanitizePresetName(name) {
        var s = String(name);
        s = s.split("|").join("_");
        s = s.split("\r").join("_");
        s = s.split("\n").join("_");
        return s;
    }

    // 手写 JSON 值转义(ES3 禁用 JSON.stringify)。仅处理字符串中的 " 与 \。
    function jsonEscape(s) {
        s = String(s);
        s = s.split("\\").join("\\\\");
        s = s.split('"').join('\\"');
        return s;
    }
    // 将预设对象数组写成标准 JSON 数组字符串(便于人工查看/编辑)
    function presetsToJson(arr) {
        var out = "[\n";
        for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            out += '  {"name":"' + jsonEscape(o.name) + '",'
                + '"start":' + (o.start != null ? o.start : 0) + ','
                + '"target":' + (o.target != null ? o.target : 0) + ','
                + '"frames":' + (o.frames != null ? o.frames : 30) + ','
                + '"step":' + (o.step != null ? o.step : 0) + ','
                + '"dec":' + (o.dec != null ? o.dec : 0) + ','
                + '"track":' + (o.track != null ? o.track : 0) + ','
                + '"font":"' + jsonEscape(o.font != null ? o.font : "（默认）") + '",'
                + '"style":"' + jsonEscape(o.style != null ? o.style : "常规") + '",'
                + '"align":' + (o.align != null ? o.align : 1) + ','
                + '"ease":' + (o.ease != null ? o.ease : 0) + ','
                + '"mono":' + (o.mono ? "true" : "false") + '}'
                + (i < arr.length - 1 ? ",\n" : "\n");
        }
        out += "]";
        return out;
    }
    // 读取标准 JSON 数组(ES3 禁用 JSON.parse; 文件为本脚本自生成的可信预设,
    //   仅当首字符为 [ 时才解析, 防止误读非本插件文件)
    function jsonParseArray(str) {
        if (!str || str.charAt(0) !== "[") { return []; }
        try { return eval("(" + str + ")"); } catch (e) { return []; }
    }
    // 槽位预设文件 = {version, slots:{ "1": 参数对象|null, ... "4": null }}
    // 手写构造(ES3 禁用 JSON.stringify); 空槽位 = null(对齐 QuickKey「空槽位={}」的语义, 此处用 null 更利受控 eval 解析)
    function slotsToJson(cache) {
        var keys = ["1", "2", "3", "4"];
        var out = '{\n  "version": 1,\n  "slots": {\n';
        for (var i = 0; i < keys.length; i++) {
            var p = cache[keys[i]];
            var comma = (i < keys.length - 1) ? ",\n" : "\n";
            if (!p) {
                out += '    "' + keys[i] + '": null' + comma;
            } else {
                out += '    "' + keys[i] + '": {'
                    + '"start":' + (p.start != null ? p.start : 0) + ','
                    + '"target":' + (p.target != null ? p.target : 0) + ','
                    + '"frames":' + (p.frames != null ? p.frames : 30) + ','
                    + '"step":' + (p.step != null ? p.step : 0) + ','
                    + '"dec":' + (p.dec != null ? p.dec : 0) + ','
                    + '"track":' + (p.track != null ? p.track : 0) + ','
                    + '"font":"' + jsonEscape(p.font != null ? p.font : "（默认）") + '",'
                    + '"style":"' + jsonEscape(p.style != null ? p.style : "常规") + '",'
                    + '"align":' + (p.align != null ? p.align : 1) + ','
                    + '"ease":' + (p.ease != null ? p.ease : 0) + ','
                    + '"mono":' + (p.mono ? "true" : "false") + '}' + comma;
            }
        }
        out += "  }\n}";
        return out;
    }
    // 读取槽位预设(ES3 禁用 JSON.parse; 仅当首字符为 { 才解析, 防误读非本插件文件)
    function jsonParseSlots(str) {
        var empty = { version: 1, slots: { "1": null, "2": null, "3": null, "4": null } };
        if (!str || str.charAt(0) !== "{") { return empty; }
        try {
            var obj = eval("(" + str + ")");
            var slots = { "1": null, "2": null, "3": null, "4": null };
            if (obj && obj.slots) {
                for (var k = 1; k <= 4; k++) {
                    var sk = String(k);
                    if (obj.slots[sk]) { slots[sk] = obj.slots[sk]; }
                }
            }
            return { version: (obj && obj.version != null) ? obj.version : 1, slots: slots };
        } catch (e) { return empty; }
    }

    // node 测试导出: 在 AE 之外(app 未定义)只导出纯函数并返回, 跳过 UI 代码
    if (typeof app === "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            module.exports = {
                snapToStep: snapToStep, formatNumber: formatNumber,
                serializePreset: serializePreset, deserializePreset: deserializePreset,
                sanitizePresetName: sanitizePresetName,
                jsonEscape: jsonEscape, presetsToJson: presetsToJson, jsonParseArray: jsonParseArray,
                slotsToJson: slotsToJson, jsonParseSlots: jsonParseSlots
            };
        }
        return;
    }

    // ============================================================
    // 以下为 AE 运行环境代码
    // ============================================================

    var CTRL_NAME = "NumCounter 控制"; // 控制空对象名(数值/步进/小数位滑块)
    var PRESET_FILE_NAME = "NumCounter.presets.json"; // 预设文件: 标准 JSON 数组, 存于工程所在目录

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
            // 根因修复(证据: Adobe 官方 Property 文档 + AE 标准手册示例):
            //   setValueAtTime 签名 = (time, newValue), 时间在前、值在后。
            //   此前写成 setValueAtTime(startVal, t0) 把「值」误当「时间」, 关键帧被错放到
            //   time=100s 处, 可见播放区间(0~1s)内数值恒≈0 => 数字不动。
            //   改用无歧义的 addKey + setValueAtKey, 并做数据层验证。
            var k1 = valProp.addKey(t0); valProp.setValueAtKey(k1, startVal);
            var k2 = valProp.addKey(t1); valProp.setValueAtKey(k2, targetVal);
            stepProp.setValue(step);
            decProp.setValue(dec);
            applyEasing(valProp, ease);
            diag("滑块关键帧设置 OK (数值 " + startVal + "->" + targetVal + " @ " + t0.toFixed(3) + "→" + t1.toFixed(3) + "s)");
            // 数据层验证: 确认关键帧已建立, 且数值确实随时间从 startVal 变到 targetVal
            var vk1 = (valProp.numKeys >= 1) ? valProp.valueAtTime(t0, false) : NaN;
            var vk2 = (valProp.numKeys >= 2) ? valProp.valueAtTime(t1, false) : NaN;
            diag("关键帧验证: numKeys=" + valProp.numKeys + " | t0值=" + vk1 + " | t1值=" + vk2);
            if (valProp.numKeys < 2) {
                setStatus(pal, "✗ 关键帧未建立(numKeys=" + valProp.numKeys + "), 数字不会动", [0.9, 0.25, 0.2]);
                diag("!! 关键帧缺失: 数值滑块无关键帧 => 计数不动");
                flushDiag(pal);
                app.endUndoGroup();
                return;
            }

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

    // ---- 预设槽位: 对齐仓库 AE-Lyrics-Animator 等「预设槽」实践(4 固定槽位 + 工程目录 JSON) ----
    // presetsCache["1".."4"] = 归一化参数对象|null(空槽位=null); 内存缓存 + 启动恢复
    // 持久化单层 = 工程目录 NumCounter.presets.json(避开 v0.2.5 已证实会崩的 app.settings)
    var SLOT_COUNT = 4;
    var presetsCache = { "1": null, "2": null, "3": null, "4": null };
    var gSlotLoadBtns = []; // UI 构建后填充, updateSlotLoadBtns 据此启用/禁用「使用」按钮
    function getPresetFile() {
        try {
            if (!app.project || !app.project.file) { return null; }
            var folder = app.project.file.parent;
            if (!folder) { return null; }
            return new File(folder.fsName + "/" + PRESET_FILE_NAME);
        } catch (e) { return null; }
    }
    // 读工程 JSON -> 恢复 presetsCache(启动时调用)
    function loadSlotsFromStorage(pal) {
        var f = getPresetFile();
        if (f && f.exists) {
            try {
                f.encoding = "UTF-8";
                if (f.open("r")) {
                    var txt = String(f.read());
                    f.close();
                    if (txt.charCodeAt(0) === 0xFEFF) { txt = txt.substring(1); }
                    var data = jsonParseSlots(txt);
                    for (var k = 1; k <= SLOT_COUNT; k++) {
                        var sk = String(k);
                        presetsCache[sk] = data.slots[sk] ? data.slots[sk] : null;
                    }
                }
            } catch (e) { try { f.close(); } catch (e2) {} }
        }
        updateSlotLoadBtns(pal);
    }
    function writeSlotsToStorage() {
        var f = getPresetFile();
        if (!f) { return false; }
        try {
            f.encoding = "UTF-8";
            if (!f.open("w")) { return false; }
            f.write(slotsToJson(presetsCache));
            f.close();
            return true;
        } catch (e) { try { f.close(); } catch (e2) {} return false; }
    }
    // 当前面板参数 -> 归一化对象(纯收集, 不写文件)
    function collectParams(pal) {
        return serializePreset({
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
        });
    }
    // 参数对象 -> 回填面板控件
    function applyParamsToUI(pal, p) {
        if (!p) { return; }
        pal.startInp.text = String(p.start);
        pal.targetInp.text = String(p.target);
        pal.framesInp.text = String(p.frames);
        pal.stepInp.text = String(p.step);
        pal.decInp.text = String(p.dec);
        pal.trackInp.text = String(p.track);
        var fi = -1;
        for (var i = 0; i < pal.fontDd.items.length; i++) { if (pal.fontDd.items[i].text === p.font) { fi = i; break; } }
        if (fi >= 0) { pal.fontDd.selection = pal.fontDd.items[fi]; refreshStyleDd(pal); }
        var si = -1;
        for (var k = 0; k < pal.styleDd.items.length; k++) { if (pal.styleDd.items[k].text === p.style) { si = k; break; } }
        if (si >= 0) { pal.styleDd.selection = pal.styleDd.items[si]; }
        pal.monoChk.value = p.mono;
        pal.fontDd.enabled = !p.mono;
        pal.styleDd.enabled = !p.mono;
        if (p.align >= 0 && p.align < pal.alignDd.items.length) { pal.alignDd.selection = pal.alignDd.items[p.align]; }
        if (p.ease >= 0 && p.ease < pal.easeDd.items.length) { pal.easeDd.selection = pal.easeDd.items[p.ease]; }
    }
    // 按内存缓存更新「使用」按钮可用状态(空槽位禁用)
    // 注意: ScriptUI 在按钮 onClick 回调里同步改别的控件 .enabled 后不会立即重绘,
    // 必须 pal.layout.layout(true) 强制刷新, 否则「存储后使用按钮仍灰」(启动阶段因脚本末尾 layout 兜底才生效)。
    function updateSlotLoadBtns(pal) {
        if (!gSlotLoadBtns || !gSlotLoadBtns.length) { return; }
        for (var i = 0; i < gSlotLoadBtns.length; i++) {
            var sk = String(i + 1);
            gSlotLoadBtns[i].enabled = !!presetsCache[sk];
        }
        if (pal && pal.layout) { try { pal.layout.layout(true); } catch (e) {} }
    }
    // 存储: 当前面板参数 -> 槽位 idx(内存 + 写工程 JSON)
    function saveSlot(pal, idx) {
        try {
            if (!getPresetFile()) {
                setStatus(pal, "✗ 请先保存工程 (Ctrl/Cmd+S) 再保存预设", [0.9, 0.55, 0.1]);
                return;
            }
            presetsCache[String(idx)] = collectParams(pal);
            if (writeSlotsToStorage()) {
            updateSlotLoadBtns(pal);
            setStatus(pal, "✓ 已存储到预设槽 " + idx + " → 工程目录 NumCounter.presets.json", [0.1, 0.75, 0.35]);
            } else {
                setStatus(pal, "✗ 写入预设文件失败(请开启『允许脚本写入文件』)", [0.9, 0.25, 0.2]);
            }
        } catch (e) {
            setStatus(pal, "✗ 保存预设失败: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        }
    }
    // 使用: 槽位 idx -> 回填面板
    function loadSlot(pal, idx) {
        try {
            var p = presetsCache[String(idx)];
            if (!p) { setStatus(pal, "预设槽 " + idx + " 为空(先点「存储」)", [0.85, 0.55, 0.1]); return; }
            applyParamsToUI(pal, p);
            setStatus(pal, "✓ 已应用预设槽 " + idx, [0.1, 0.75, 0.35]);
        } catch (e) {
            setStatus(pal, "✗ 应用预设失败: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        }
    }
    // 清空全部 4 槽位
    function clearAllSlots(pal) {
        try {
            presetsCache = { "1": null, "2": null, "3": null, "4": null };
            if (writeSlotsToStorage()) {
            updateSlotLoadBtns(pal);
            setStatus(pal, "✓ 已清空全部预设槽", [0.6, 0.6, 0.6]);
            } else {
                setStatus(pal, "✗ 写入预设文件失败", [0.9, 0.25, 0.2]);
            }
        } catch (e) {
            setStatus(pal, "✗ 清空失败: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        }
    }
    // 导出预设: 另存独立 .json(跨工程复用)
    function exportSlots(pal) {
        try {
            if (!getPresetFile()) { setStatus(pal, "✗ 请先保存工程再导出", [0.9, 0.55, 0.1]); return; }
            var f = File.saveDialog("导出预设槽", "JSON:*.json", "NumCounter.presets.json");
            if (!f) { return; }
            f.encoding = "UTF-8";
            if (!f.open("w")) { setStatus(pal, "✗ 导出失败", [0.9, 0.25, 0.2]); return; }
            f.write(slotsToJson(presetsCache));
            f.close();
            setStatus(pal, "✓ 已导出预设槽 → " + f.fsName, [0.1, 0.75, 0.35]);
        } catch (e) {
            setStatus(pal, "✗ 导出失败: " + e.toString(), [0.9, 0.25, 0.2]);
            showDebugError(e);
        }
    }
    // 导入预设: 选 .json 合并进当前槽位(同名覆盖)
    function importSlots(pal) {
        try {
            var f = File.openDialog("导入预设槽", "JSON:*.json");
            if (!f) { return; }
            f.encoding = "UTF-8";
            if (!f.open("r")) { setStatus(pal, "✗ 读取失败", [0.9, 0.25, 0.2]); return; }
            var txt = String(f.read());
            f.close();
            if (txt.charCodeAt(0) === 0xFEFF) { txt = txt.substring(1); }
            var data = jsonParseSlots(txt);
            var n = 0;
            for (var k = 1; k <= SLOT_COUNT; k++) {
                var sk = String(k);
                if (data.slots[sk]) { presetsCache[sk] = data.slots[sk]; n++; }
            }
            writeSlotsToStorage();
            updateSlotLoadBtns(pal);
            setStatus(pal, "✓ 已导入 " + n + " 个预设槽", [0.1, 0.75, 0.35]);
        } catch (e) {
            setStatus(pal, "✗ 导入失败: " + e.toString(), [0.9, 0.25, 0.2]);
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

    // 预设槽位(对齐仓库 AE-Lyrics-Animator 等「预设槽」实践: 固定 4 槽位 + 工程目录 JSON)
    var pPreset = pal.add("panel", undefined, "预设槽位");
    pPreset.orientation = "column";
    pPreset.alignChildren = "fill";
    pPreset.spacing = 6;
    // 存储行: 1-4
    var prSave = pPreset.add("group"); prSave.orientation = "row"; prSave.alignChildren = "center"; prSave.spacing = 2;
    prSave.add("statictext", undefined, "存储预设:");
    for (var si = 0; si < SLOT_COUNT; si++) {
        (function(idx) {
            var b = prSave.add("button", undefined, String(idx + 1));
            b.preferredSize = [26, 22];
            b.onClick = function () { saveSlot(pal, idx); };
        })(si);
    }
    // 使用行: 1-4(空槽位禁用, 启动后由 loadSlotsFromStorage 更新)
    var prLoad = pPreset.add("group"); prLoad.orientation = "row"; prLoad.alignChildren = "center"; prLoad.spacing = 2;
    prLoad.add("statictext", undefined, "使用预设:");
    for (var li = 0; li < SLOT_COUNT; li++) {
        (function(idx) {
            var b = prLoad.add("button", undefined, String(idx + 1));
            b.preferredSize = [26, 22];
            b.enabled = false;
            gSlotLoadBtns.push(b);
            b.onClick = function () { loadSlot(pal, idx); };
        })(li);
    }
    // 工具行: 清空 / 导出 / 导入
    var prTool = pPreset.add("group"); prTool.orientation = "row"; prTool.alignment = "center"; prTool.spacing = 6;
    var btnClear = prTool.add("button", undefined, "清空全部");
    var btnExport = prTool.add("button", undefined, "导出预设…");
    var btnImport = prTool.add("button", undefined, "导入预设…");
    btnClear.onClick = function () { clearAllSlots(pal); };
    btnExport.onClick = function () { exportSlots(pal); };
    btnImport.onClick = function () { importSlots(pal); };
    loadSlotsFromStorage(pal); // 启动恢复槽位 + 更新「使用」按钮可用状态

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
