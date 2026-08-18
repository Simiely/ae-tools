// ============================================================
//  水面波动生成器 (After Effects ScriptUI Panel) v12
//  功能：一键在合成中生成"水面上涨波动"效果
//  可调参数：上涨速度 / 流动速度 / 波峰高度 / 波长
//           + 噪波开关（Perlin 噪声随机起伏）/ 种子（控制随机效果）
//  预设：4 个固定槽位 + 双层持久化（工程 JSON + app.settings 全局保底）
//        读取优先工程 JSON，缺失回退全局设置（参考 AE-Lyrics-Animator）
//  复位：一键恢复面板参数为默认值
//  报错：弹窗显示错误与关键步骤（可全选复制）
// ============================================================
//
// 预设机制（对齐 AE-Lyrics-Animator v3.5）：
//   - UI：存储 1 2 3 4 | 清除全部；使用 1 2 3 4 | 复位（使用按钮无数据时禁用）
//   - 保存：presetsCache[槽位] = 当前参数 → 双写 app.settings + 工程 JSON
//   - 读取：工程 JSON 优先 → app.settings 回退 → 内存缓存 presetsCache 中转
//   - 存储位置：.aep 同级「水面波动预设.json」 + app.settings(Section=WaterRisePanel)
//   - 需 AE 首选项「允许脚本写入文件和访问网络」开启才能写文件
//
// 坐标/引用关键修复（历次踩坑，勿回退）：
//   1. 路径必须加底部点 [W,H],[0,H] 闭合多边形，否则 AE 强制闭合会崩
//   2. 图层级 ADBE Anchor Point / ADBE Position 归零
//   3. 形状组级 ADBE Vector Transform Group 下 Anchor/Position 归零
//   4. 所有属性访问用 match name（跨语言），不用显示名
//   5. 集合变更后引用失效：使用前一律 findGroupByName/findPathProp 重新查找
//   6. 渐变填充 match name 版本差异大 → 直接纯色，不做多次失败尝试
//
// ============================================================

(function (thisObj) {
    var pal = (thisObj instanceof Panel) ? thisObj
        : new Window("palette", "水面波动生成器", undefined, { resizeable: false });

    pal.orientation = "column";
    pal.alignChildren = "fill";
    pal.spacing = 6;
    pal.margins = 12;

    // ---------- 工具：一行 标签 + 输入框（range 为可选的范围提示） ----------
    function makeRow(parent, label, def, range) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = "left";
        row.spacing = 8;
        var t = row.add("statictext", undefined, label);
        t.size = [150, 18];
        var e = row.add("edittext", undefined, String(def));
        e.size = [64, 20];
        if (range) {
            var r = row.add("statictext", undefined, range);
            r.size = [60, 18];
        }
        return { row: row, edit: e };
    }

    // ---------- 默认参数 ----------
    var DEFAULTS = {
        width: 400, height: 600, duration: 0, cycleFrames: 0,
        rise: 90, flow: 2.4, amp: 12, wl: 180,
        noise: 0, seed: 1, noiseSpeed: 0.9, noiseSize: 0.6, noiseGrain: 90,
        bodyColor: [0.27, 0.62, 0.93], bodyOpacity: 100,
        glowColor: [1, 1, 1], glowOpacity: 20
    };

    // ---------- 合成设置 ----------
    var pComp = pal.add("panel", undefined, "合成设置");
    pComp.orientation = "column";
    pComp.alignChildren = "fill";
    pComp.spacing = 4;
    var cW   = makeRow(pComp, "宽度 (px)", DEFAULTS.width, "最小64");
    var cH   = makeRow(pComp, "高度 (px)", DEFAULTS.height, "最小64");
    var cDur = makeRow(pComp, "时长 (秒, 0=自动)", DEFAULTS.duration);
    var cCycle = makeRow(pComp, "循环帧数 (帧, 0=自动)", DEFAULTS.cycleFrames);

    // ---------- 波浪参数 ----------
    var pWave = pal.add("panel", undefined, "波浪参数（生成后仍可在 AE 内调节）");
    pWave.orientation = "column";
    pWave.alignChildren = "fill";
    pWave.spacing = 4;
    var wRise   = makeRow(pWave, "上涨速度 (px/秒)", DEFAULTS.rise, "最小1");
    var wFlow   = makeRow(pWave, "流动速度", DEFAULTS.flow);
    var wAmp    = makeRow(pWave, "波峰高度 (px)", DEFAULTS.amp, "最小1");
    var wLen    = makeRow(pWave, "波长 (px)", DEFAULTS.wl, "最小20");

    // 噪波开关 + 种子（≥0）
    var nzRow = pWave.add("group");
    nzRow.orientation = "row";
    nzRow.alignChildren = "left";
    nzRow.spacing = 8;
    var nzCheck = nzRow.add("checkbox", undefined, "噪波开关");
    var nzLabel = nzRow.add("statictext", undefined, "种子");
    nzLabel.size = [36, 18];
    var seedEdit = nzRow.add("edittext", undefined, String(DEFAULTS.seed));
    seedEdit.size = [64, 20];
    var seedRange = nzRow.add("statictext", undefined, "最小0");
    seedRange.size = [60, 18];

    // 噪波速度（≥0）
    var nzRow2 = pWave.add("group");
    nzRow2.orientation = "row";
    nzRow2.alignChildren = "left";
    nzRow2.spacing = 8;
    var nspdLabel = nzRow2.add("statictext", undefined, "噪波速度");
    nspdLabel.size = [62, 18];
    var nspdEdit = nzRow2.add("edittext", undefined, String(DEFAULTS.noiseSpeed));
    nspdEdit.size = [52, 20];
    var nspdRange = nzRow2.add("statictext", undefined, "最小0");
    nspdRange.size = [60, 18];

    // 噪波幅度（≥0）
    var nzRow3 = pWave.add("group");
    nzRow3.orientation = "row";
    nzRow3.alignChildren = "left";
    nzRow3.spacing = 8;
    var nsizeLabel = nzRow3.add("statictext", undefined, "噪波幅度");
    nsizeLabel.size = [62, 18];
    var nsizeEdit = nzRow3.add("edittext", undefined, String(DEFAULTS.noiseSize));
    nsizeEdit.size = [52, 20];
    var nsizeRange = nzRow3.add("statictext", undefined, "最小0");
    nsizeRange.size = [60, 18];

    // 噪波颗粒（≥4，越小越密）
    var nzRow4 = pWave.add("group");
    nzRow4.orientation = "row";
    nzRow4.alignChildren = "left";
    nzRow4.spacing = 8;
    var ngrainLabel = nzRow4.add("statictext", undefined, "噪波颗粒");
    ngrainLabel.size = [62, 18];
    var ngrainEdit = nzRow4.add("edittext", undefined, String(DEFAULTS.noiseGrain));
    ngrainEdit.size = [52, 20];
    var ngrainRange = nzRow4.add("statictext", undefined, "最小4");
    ngrainRange.size = [60, 18];
    var ngrainHint = nzRow4.add("statictext", undefined, "越小越密");
    ngrainHint.size = [70, 18];

    // ---------- 水体与高光（颜色 + 透明度） ----------
    var bodyColor = DEFAULTS.bodyColor.slice();
    var glowColor = DEFAULTS.glowColor.slice();
    var pColor = pal.add("panel", undefined, "水体与高光（颜色 / 透明度）");
    pColor.orientation = "column";
    pColor.alignChildren = "fill";
    pColor.spacing = 4;

    var bodyRow = pColor.add("group");
    bodyRow.orientation = "row";
    bodyRow.alignChildren = "left";
    bodyRow.spacing = 8;
    var bodyLabel = bodyRow.add("statictext", undefined, "水体颜色");
    bodyLabel.size = [62, 18];
    var bodySwatch = bodyRow.add("panel");
    bodySwatch.preferredSize = [18, 18];
    var bodyHash = bodyRow.add("statictext", undefined, "#");
    bodyHash.size = [12, 18];
    var bodyHexEdit = bodyRow.add("edittext", undefined, rgb01ToHex(bodyColor));
    bodyHexEdit.size = [56, 20];
    var bodyOpLabel = bodyRow.add("statictext", undefined, "透明度");
    bodyOpLabel.size = [48, 18];
    var bodyOpacityEdit = bodyRow.add("edittext", undefined, String(DEFAULTS.bodyOpacity));
    bodyOpacityEdit.size = [44, 20];
    var bodyOpUnit = bodyRow.add("statictext", undefined, "%");
    bodyOpUnit.size = [18, 18];

    var glowRow = pColor.add("group");
    glowRow.orientation = "row";
    glowRow.alignChildren = "left";
    glowRow.spacing = 8;
    var glowLabel = glowRow.add("statictext", undefined, "高光颜色");
    glowLabel.size = [62, 18];
    var glowSwatch = glowRow.add("panel");
    glowSwatch.preferredSize = [18, 18];
    var glowHash = glowRow.add("statictext", undefined, "#");
    glowHash.size = [12, 18];
    var glowHexEdit = glowRow.add("edittext", undefined, rgb01ToHex(glowColor));
    glowHexEdit.size = [56, 20];
    var glowOpLabel = glowRow.add("statictext", undefined, "透明度");
    glowOpLabel.size = [48, 18];
    var glowOpacityEdit = glowRow.add("edittext", undefined, String(DEFAULTS.glowOpacity));
    glowOpacityEdit.size = [44, 20];
    var glowOpUnit = glowRow.add("statictext", undefined, "%");
    glowOpUnit.size = [18, 18];

    // ---------- 主按钮 ----------
    var btnGroup = pal.add("group");
    btnGroup.orientation = "row";
    btnGroup.alignChildren = "fill";
    btnGroup.spacing = 8;
    var btnGen = btnGroup.add("button", undefined, "生成水面效果");

    // ---------- 预设管理（4 槽位，对齐 AE-Lyrics-Animator） ----------
    var pPreset = pal.add("panel", undefined, "预设管理（工程 JSON + 全局设置双层存储）");
    pPreset.orientation = "column";
    pPreset.alignChildren = "fill";
    pPreset.spacing = 4;

    var saveRow = pPreset.add("group");
    saveRow.orientation = "row";
    saveRow.alignChildren = "left";
    saveRow.spacing = 4;
    var saveLabel = saveRow.add("statictext", undefined, "存储");
    saveLabel.size = [28, 20];
    var saveBtns = [];
    var loadBtns = [];
    var i2;
    for (i2 = 1; i2 <= 4; i2++) {
        var sBtn = saveRow.add("button", undefined, String(i2));
        sBtn.size = [26, 22];
        saveBtns.push(sBtn);
    }
    var clearPresetBtn = saveRow.add("button", undefined, "清除全部");
    clearPresetBtn.size = [64, 22];

    var loadRow = pPreset.add("group");
    loadRow.orientation = "row";
    loadRow.alignChildren = "left";
    loadRow.spacing = 4;
    var loadLabel = loadRow.add("statictext", undefined, "使用");
    loadLabel.size = [28, 20];
    for (i2 = 1; i2 <= 4; i2++) {
        var lBtn = loadRow.add("button", undefined, String(i2));
        lBtn.size = [26, 22];
        lBtn.enabled = false;
        loadBtns.push(lBtn);
    }
    var resetBtn = loadRow.add("button", undefined, "复位");
    resetBtn.size = [64, 22];

    // ---------- 状态行 ----------
    var status = pal.add("statictext", undefined, "设置参数后点「生成水面效果」。");
    status.size = [280, 26];
    status.alignment = "left";
    status.wrap = true;

    // ---------- 内部步骤记录（出错时拼进弹窗） ----------
    var runLog = "";
    function log(msg) { runLog += msg + "\n"; }

    // ---------- 错误弹窗（可复制，附执行步骤） ----------
    function showError(title, err) {
        var msg = "【" + title + "】\n\n";
        if (err) {
            if (typeof err === "string") {
                msg += err;
            } else {
                msg += "信息: " + (err.message || err) + "\n";
                if (err.line !== undefined) msg += "行号: " + err.line + "\n";
                if (err.stack !== undefined) msg += "堆栈:\n" + err.stack + "\n";
            }
        }
        if (runLog.length > 0) msg += "\n—— 已执行步骤 ——\n" + runLog;

        var w = new Window("palette", title, undefined);
        w.orientation = "column";
        w.spacing = 8;
        w.margins = 12;
        var et = w.add("edittext", undefined, msg, { multiline: true, scrollable: true, readonly: true });
        et.size = [480, 240];
        et.active = true;
        var btns = w.add("group");
        btns.alignment = "right";
        btns.spacing = 8;
        var bCopy = btns.add("button", undefined, "全选文本");
        bCopy.onClick = function () {
            et.active = true;
            try { et.selectAll(); } catch (e) { /* 忽略 */ }
        };
        var bClose = btns.add("button", undefined, "关闭");
        bClose.onClick = function () { w.close(); };
        w.center();
        w.show();
    }

    function getNum(ctl, def) {
        var v = parseFloat(ctl.edit.text);
        return isNaN(v) ? def : v;
    }

    // ---------- swatch 色块显示颜色（参考 starry-sky-generator） ----------
    function updateSwatch(elem, color) {
        try {
            var gfx = elem.graphics;
            if (!gfx || !gfx.newBrush) return;
            var bType = (gfx.BrushType && gfx.BrushType.SOLID_COLOR) || 0;
            var brush = gfx.newBrush(bType, [color[0], color[1], color[2]]);
            if (brush) {
                gfx.backgroundColor = brush;
                gfx.disabledBackgroundColor = brush;
            }
        } catch (e) { /* 忽略 */ }
    }

    // ---------- HSL ↔ RGB（参考 starry-sky-generator 的颜色选取器） ----------
    function hslToRgb01(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = l - c / 2;
        var r = 0, g = 0, b = 0;
        if (h < 60) { r = c + m; g = x + m; b = m; }
        else if (h < 120) { r = x + m; g = c + m; b = m; }
        else if (h < 180) { r = m; g = c + m; b = x + m; }
        else if (h < 240) { r = m; g = x + m; b = c + m; }
        else if (h < 300) { r = x + m; g = m; b = c + m; }
        else { r = c + m; g = m; b = x + m; }
        return [r, g, b];
    }

    function rgb01ToHsl(r, g, b) {
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var dh = 0, ds = 0, dl = (mx + mn) / 2;
        if (mx !== mn) {
            var dd = mx - mn;
            ds = dl > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
            if (mx === r) dh = ((g - b) / dd + (g < b ? 6 : 0)) * 60;
            else if (mx === g) dh = ((b - r) / dd + 2) * 60;
            else dh = ((r - g) / dd + 4) * 60;
        }
        return [Math.round(dh), Math.round(ds * 100), Math.round(dl * 100)];
    }

    // ---------- 颜色选取对话框（HSL 滑块 + 预览，参考 starry-sky-generator） ----------
    // 返回 [r,g,b] 0-1；取消返回 null
    function openHslColorPicker(title, current) {
        var hsl0 = rgb01ToHsl(current[0], current[1], current[2]);
        var curH = hsl0[0], curS = hsl0[1], curL = hsl0[2];
        var result = null;

        var dlg = new Window("dialog", title);
        dlg.orientation = "column";
        dlg.alignChildren = ["left", "top"];
        dlg.spacing = 6;
        dlg.margins = [12, 12, 12, 12];

        var previewPane = dlg.add("panel");
        previewPane.preferredSize = [300, 50];
        previewPane.alignment = ["fill", "top"];

        function updatePreview(h, s, l) {
            try {
                var rgb = hslToRgb01(h, s, l);
                var pgfx = previewPane.graphics;
                if (!pgfx || !pgfx.newBrush) return;
                var bType = (pgfx.BrushType && pgfx.BrushType.SOLID_COLOR) || 0;
                var pBrush = pgfx.newBrush(bType, rgb);
                if (pBrush) {
                    pgfx.backgroundColor = pBrush;
                    pgfx.disabledBackgroundColor = pBrush;
                }
            } catch (e) { /* 忽略 */ }
        }
        updatePreview(curH, curS, curL);

        // H 色相 0-360
        var hGrp = dlg.add("group");
        hGrp.orientation = "row";
        hGrp.alignChildren = ["left", "center"];
        hGrp.spacing = 4;
        hGrp.add("statictext", undefined, "H").preferredSize = [16, 18];
        var hSl = hGrp.add("slider", undefined, curH, 0, 360);
        var hIn = hGrp.add("edittext", undefined, String(curH));
        hIn.preferredSize = [55, 20]; hIn.characters = 5;
        hGrp.add("statictext", undefined, "deg (角度)").preferredSize = [68, 18];
        hSl.onChanging = function () {
            hIn.text = Math.round(hSl.value).toString();
            updatePreview(hSl.value, sSl.value, lSl.value);
        };
        hIn.onChange = function () {
            var vv = parseInt(hIn.text);
            if (!isNaN(vv)) hSl.value = Math.max(0, Math.min(360, vv));
        };

        // S 饱和度 0-100
        var sGrp = dlg.add("group");
        sGrp.orientation = "row";
        sGrp.alignChildren = ["left", "center"];
        sGrp.spacing = 4;
        sGrp.add("statictext", undefined, "S").preferredSize = [16, 18];
        var sSl = sGrp.add("slider", undefined, curS, 0, 100);
        var sIn = sGrp.add("edittext", undefined, String(curS));
        sIn.preferredSize = [55, 20]; sIn.characters = 5;
        sGrp.add("statictext", undefined, "%").preferredSize = [22, 18];
        sSl.onChanging = function () {
            sIn.text = Math.round(sSl.value).toString();
            updatePreview(hSl.value, sSl.value, lSl.value);
        };
        sIn.onChange = function () {
            var vv = parseInt(sIn.text);
            if (!isNaN(vv)) sSl.value = Math.max(0, Math.min(100, vv));
        };

        // L 亮度 0-100
        var lGrp = dlg.add("group");
        lGrp.orientation = "row";
        lGrp.alignChildren = ["left", "center"];
        lGrp.spacing = 4;
        lGrp.add("statictext", undefined, "L").preferredSize = [16, 18];
        var lSl = lGrp.add("slider", undefined, curL, 0, 100);
        var lIn = lGrp.add("edittext", undefined, String(curL));
        lIn.preferredSize = [55, 20]; lIn.characters = 5;
        lGrp.add("statictext", undefined, "%").preferredSize = [22, 18];
        lSl.onChanging = function () {
            lIn.text = Math.round(lSl.value).toString();
            updatePreview(hSl.value, sSl.value, lSl.value);
        };
        lIn.onChange = function () {
            var vv = parseInt(lIn.text);
            if (!isNaN(vv)) lSl.value = Math.max(0, Math.min(100, vv));
        };

        var btnGrp = dlg.add("group");
        btnGrp.orientation = "row";
        btnGrp.alignChildren = ["center", "center"];
        btnGrp.spacing = 10;
        var okBtn = btnGrp.add("button", undefined, "确定");
        okBtn.onClick = function () {
            result = hslToRgb01(hSl.value, sSl.value, lSl.value);
            dlg.close();
        };
        var cancelBtn = btnGrp.add("button", undefined, "取消");
        cancelBtn.onClick = function () { dlg.close(); };

        dlg.center();
        dlg.show();
        return result;
    }

    // ---------- HEX ↔ RGB（直接输色） ----------
    function hexToRgb01(hex) {
        var s = String(hex).replace(/[#\s]/g, "");
        if (s.length !== 6) return null;
        var r = parseInt(s.substr(0, 2), 16);
        var g = parseInt(s.substr(2, 2), 16);
        var b = parseInt(s.substr(4, 2), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
        return [r / 255, g / 255, b / 255];
    }

    function rgb01ToHex(color) {
        function to2(v) {
            var s = Math.round(v * 255).toString(16).toUpperCase();
            return s.length < 2 ? "0" + s : s;
        }
        return to2(color[0]) + to2(color[1]) + to2(color[2]);
    }

    // ================= 参数读取/回填/复位 =================
    function getCurrentParams() {
        return {
            w: getNum(cW, DEFAULTS.width),
            h: getNum(cH, DEFAULTS.height),
            dur: getNum(cDur, DEFAULTS.duration),
            cycleFrames: getNum({ edit: cCycle.edit }, DEFAULTS.cycleFrames),
            rise: getNum(wRise, DEFAULTS.rise),
            flow: getNum(wFlow, DEFAULTS.flow),
            amp: getNum(wAmp, DEFAULTS.amp),
            wl: getNum(wLen, DEFAULTS.wl),
            noise: nzCheck.value ? 1 : 0,
            seed: getNum({ edit: seedEdit }, DEFAULTS.seed),
            noiseSpeed: getNum({ edit: nspdEdit }, DEFAULTS.noiseSpeed),
            noiseSize: getNum({ edit: nsizeEdit }, DEFAULTS.noiseSize),
            noiseGrain: getNum({ edit: ngrainEdit }, DEFAULTS.noiseGrain),
            bodyColor: bodyColor,
            bodyOpacity: getNum({ edit: bodyOpacityEdit }, DEFAULTS.bodyOpacity),
            glowColor: glowColor,
            glowOpacity: getNum({ edit: glowOpacityEdit }, DEFAULTS.glowOpacity)
        };
    }

    function applyParams(p) {
        if (!p) return;
        if (p.w !== undefined) cW.edit.text = String(p.w);
        if (p.h !== undefined) cH.edit.text = String(p.h);
        if (p.dur !== undefined) cDur.edit.text = String(p.dur);
        if (p.cycleFrames !== undefined) cCycle.edit.text = String(p.cycleFrames);
        if (p.rise !== undefined) wRise.edit.text = String(p.rise);
        if (p.flow !== undefined) wFlow.edit.text = String(p.flow);
        if (p.amp !== undefined) wAmp.edit.text = String(p.amp);
        if (p.wl !== undefined) wLen.edit.text = String(p.wl);
        if (p.noise !== undefined) nzCheck.value = (p.noise > 0.5);
        if (p.seed !== undefined) seedEdit.text = String(p.seed);
        if (p.noiseSpeed !== undefined) nspdEdit.text = String(p.noiseSpeed);
        if (p.noiseSize !== undefined) nsizeEdit.text = String(p.noiseSize);
        if (p.noiseGrain !== undefined) ngrainEdit.text = String(p.noiseGrain);
        if (p.bodyColor && p.bodyColor.length === 3) {
            bodyColor = p.bodyColor;
            updateSwatch(bodySwatch, bodyColor);
            bodyHexEdit.text = rgb01ToHex(bodyColor);
        }
        if (p.bodyOpacity !== undefined) bodyOpacityEdit.text = String(p.bodyOpacity);
        if (p.glowColor && p.glowColor.length === 3) {
            glowColor = p.glowColor;
            updateSwatch(glowSwatch, glowColor);
            glowHexEdit.text = rgb01ToHex(glowColor);
        }
        if (p.glowOpacity !== undefined) glowOpacityEdit.text = String(p.glowOpacity);
    }

    function resetParams() {
        applyParams(DEFAULTS);
        status.text = "参数已复位为默认值。";
    }

    // ================= JSON polyfill（ExtendScript 无原生 JSON） =================
    function quote(s) {
        return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }

    function jsonStringify(obj) {
        var t = typeof obj;
        if (obj === null) return "null";
        if (t === "number" || t === "boolean") return String(obj);
        if (t === "string") return quote(obj);
        if (t === "undefined" || t === "function") return "null";
        if (t === "object") {
            if (obj instanceof Array) {
                var a = [];
                var i;
                for (i = 0; i < obj.length; i++) a.push(jsonStringify(obj[i]));
                return "[" + a.join(",") + "]";
            }
            var out = [];
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) out.push(quote(k) + ":" + jsonStringify(obj[k]));
            }
            return "{" + out.join(",") + "}";
        }
        return "null";
    }

    function jsonParse(s) {
        return eval("(" + s + ")");
    }

    // ================= 预设持久化（双层：工程 JSON + app.settings） =================
    var SETTINGS_SECTION = "WaterRisePanel";
    var SETTINGS_KEY_PREFIX = "preset_";
    var PRESET_FILENAME = "水面波动预设.json";
    var presetsCache = null;

    function getProjectPresetFile() {
        try {
            var projFile = app.project.file;
            if (!projFile) return null;
            var projFolder = projFile.parent;
            if (!projFolder) return null;
            return new File(projFolder.fsName + "/" + PRESET_FILENAME);
        } catch (e) { return null; }
    }

    function writeToSettings(idx, params) {
        try {
            app.settings.saveSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx, jsonStringify(params));
            return true;
        } catch (e) { return false; }
    }

    function readFromSettings(idx) {
        try {
            var s = app.settings.getSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx);
            if (s && s.length > 0) return jsonParse(s);
        } catch (e) { /* 忽略 */ }
        return null;
    }

    function deleteFromSettings(idx) {
        try { app.settings.deleteSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx); } catch (e) { /* 忽略 */ }
    }

    function writeToProjectFile(data) {
        var f = getProjectPresetFile();
        if (!f) {
            status.text = "工程未保存，预设已存全局设置（app.settings）。";
            return false;
        }
        try {
            f.encoding = "utf-8";
            f.open("w");
            f.write(jsonStringify(data));
            f.close();
            return true;
        } catch (e) {
            status.text = "JSON 写入失败: " + e.message;
            return false;
        }
    }

    function readFromProjectFile() {
        var f = getProjectPresetFile();
        if (!f || !f.exists) return null;
        var content = "";
        try {
            f.encoding = "utf-8";
            f.open("r");
            content = f.read();
            f.close();
        } catch (e) { return null; }
        if (!content || content.length === 0) return null;
        try { return jsonParse(content); } catch (e) { return null; }
    }

    function deleteProjectFile() {
        var f = getProjectPresetFile();
        if (f && f.exists) {
            try { f.remove(); } catch (e) { /* 忽略 */ }
        }
    }

    function initPresetsCache() {
        // 读取优先级：工程 JSON → app.settings
        var fromFile = readFromProjectFile();
        if (fromFile) return fromFile;
        var cache = {};
        var i;
        for (i = 1; i <= 4; i++) {
            var p = readFromSettings(i);
            if (p) cache[String(i)] = p;
        }
        return cache;
    }

    function updateLoadButtons() {
        if (!presetsCache) presetsCache = initPresetsCache();
        var i;
        for (i = 1; i <= 4; i++) {
            if (loadBtns && loadBtns[i - 1]) {
                loadBtns[i - 1].enabled = (presetsCache[String(i)]) ? true : false;
            }
        }
    }

    function saveSlot(idx) {
        if (!presetsCache) presetsCache = initPresetsCache();
        presetsCache[String(idx)] = getCurrentParams();
        var globalOk = writeToSettings(idx, presetsCache[String(idx)]);
        var fileOk = writeToProjectFile(presetsCache);
        updateLoadButtons();
        if (fileOk) {
            status.text = "已保存到预设 " + idx + "（工程目录 JSON）";
        } else if (globalOk) {
            status.text = "已保存到预设 " + idx + "（全局设置）";
        } else {
            status.text = "保存预设 " + idx + " 失败";
        }
    }

    function loadSlot(idx) {
        if (!presetsCache) presetsCache = initPresetsCache();
        var p = presetsCache[String(idx)];
        if (!p) {
            status.text = "预设 " + idx + " 没有数据";
            return;
        }
        applyParams(p);
        status.text = "已加载预设 " + idx + "，参数已回填（点「生成水面效果」应用）。";
    }

    function clearAllPresets() {
        var i;
        for (i = 1; i <= 4; i++) deleteFromSettings(i);
        deleteProjectFile();
        presetsCache = {};
        updateLoadButtons();
        status.text = "已清除所有预设（全局 + 工程 JSON）。";
    }

    // ================= 属性定位（历次踩坑修复） =================
    function findPathProp(group) {
        if (!group) return null;
        var i;
        for (i = 1; i <= group.numProperties; i++) {
            try {
                var p = group.property(i);
                if (p && p.matchName === "ADBE Vector Shape - Group") return p;
            } catch (e) { /* 跳过 */ }
        }
        return null;
    }

    function findGroupByName(parent, name) {
        if (!parent) return null;
        var i;
        for (i = 1; i <= parent.numProperties; i++) {
            try {
                var p = parent.property(i);
                if (p && p.name === name) return p;
            } catch (e) { /* 跳过 */ }
        }
        return null;
    }

    function getPathData(pathObj) {
        if (!pathObj) return null;
        try {
            var sub = pathObj.property("Path");
            if (sub && sub.expression !== undefined) return sub;
        } catch (e) { /* 不是组 */ }
        return pathObj;
    }

    function zeroGroupTransform(group) {
        if (!group) return false;
        try {
            var gtf = group.property("ADBE Vector Transform Group");
            if (!gtf) {
                log("!! 未找到组变换(ADBE Vector Transform Group)");
                return false;
            }
            var ga = gtf.property("ADBE Vector Anchor");
            if (!ga) ga = gtf.property("Anchor Point");
            var gp = gtf.property("ADBE Vector Position");
            if (!gp) gp = gtf.property("Position");
            if (ga) ga.setValue([0, 0]);
            if (gp) gp.setValue([0, 0]);
            log("OK 组变换归零: Anchor/Position = [0,0]");
            return true;
        } catch (e) {
            log("!! 组变换归零失败: " + e.message);
        }
        return false;
    }

    // ================= 路径表达式（单层正弦 + 可选 Perlin 噪波） =================
    function buildWaterPathExp() {
        return "var W = thisComp.width;\n" +
            "var H = thisComp.height;\n" +
            "var rise = effect('上涨速度')(1);\n" +
            "var flow = effect('流动速度')(1);\n" +
            "var amp = effect('波峰高度')(1);\n" +
            "var wl = Math.max(20, effect('波长')(1));\n" +
            "var seed = effect('种子')(1);\n" +
            "var nz = effect('噪波开关')(1);\n" +
            "var nspd = effect('噪波速度')(1);\n" +
            "var nsize = effect('噪波幅度')(1);\n" +
            "var grain = Math.max(4, effect('噪波颗粒')(1));\n" +
            "var off = effect('循环起点')(1);\n" +
            "var cf = effect('循环帧数')(1);\n" +
            "var cycle = cf > 0.5 ? cf * thisComp.frameDuration : H / Math.max(rise, 0.001);\n" +
            "var t = Math.max(time - off, 0);\n" +
            "var level = (t % cycle) / cycle;\n" +
            "var baseY = H - level * H;\n" +
            "var pts = [];\n" +
            "var n = Math.floor(W / 4);\n" +
            "var i = 0;\n" +
            "var x = 0;\n" +
            "var y = 0;\n" +
            "for (i = 0; i <= n; i = i + 1) {\n" +
            "    x = i * 4;\n" +
            "    y = baseY + amp * Math.sin(2 * Math.PI * x / wl + time * flow);\n" +
            "    if (nz > 0.5) {\n" +
            "        y = y + amp * nsize * (noise([x / grain, time * nspd, seed]) - 0.5) * 2;\n" +
            "    }\n" +
            "    pts.push([x, y]);\n" +
            "}\n" +
            "pts.push([W, H]);\n" +
            "pts.push([0, H]);\n" +
            "createPath(pts);\n";
    }

    function buildGlowPathExp() {
        return "var W = thisComp.width;\n" +
            "var H = thisComp.height;\n" +
            "var rise = effect('上涨速度')(1);\n" +
            "var flow = effect('流动速度')(1);\n" +
            "var amp = effect('波峰高度')(1);\n" +
            "var wl = Math.max(20, effect('波长')(1));\n" +
            "var seed = effect('种子')(1);\n" +
            "var nz = effect('噪波开关')(1);\n" +
            "var nspd = effect('噪波速度')(1);\n" +
            "var nsize = effect('噪波幅度')(1);\n" +
            "var grain = Math.max(4, effect('噪波颗粒')(1));\n" +
            "var off = effect('循环起点')(1);\n" +
            "var cf = effect('循环帧数')(1);\n" +
            "var cycle = cf > 0.5 ? cf * thisComp.frameDuration : H / Math.max(rise, 0.001);\n" +
            "var t = Math.max(time - off, 0);\n" +
            "var level = (t % cycle) / cycle;\n" +
            "var baseY = H - level * H - 3;\n" +
            "var pts = [];\n" +
            "var n = Math.floor(W / 4);\n" +
            "var i = 0;\n" +
            "var x = 0;\n" +
            "var y = 0;\n" +
            "for (i = 0; i <= n; i = i + 1) {\n" +
            "    x = i * 4;\n" +
            "    y = baseY + amp * Math.sin(2 * Math.PI * x / wl + time * flow);\n" +
            "    if (nz > 0.5) {\n" +
            "        y = y + amp * nsize * (noise([x / grain, time * nspd, seed]) - 0.5) * 2;\n" +
            "    }\n" +
            "    pts.push([x, y]);\n" +
            "}\n" +
            "createPath(pts, [], [], false);\n";
    }

    // ================= 生成 =================
    function generate() {
        try {
            runLog = "";
            log("==== 开始生成 ====");

            var proj = app.project;
            if (!proj) { status.text = "请先打开一个项目。"; return; }

            var p = getCurrentParams();
            var w = Math.max(64, Math.floor(p.w));
            var h = Math.max(64, Math.floor(p.h));
            var rise = Math.max(1, p.rise);
            var flow = p.flow;
            var amp = Math.max(1, p.amp);
            var wl = Math.max(20, p.wl);
            var nzOn = (p.noise > 0.5);
            var seed = Math.max(0, Math.floor(p.seed));
            var noiseSpeed = Math.max(0, p.noiseSpeed);
            var noiseSize = Math.max(0, p.noiseSize);
            var noiseGrain = Math.max(4, p.noiseGrain);
            var bodyColor = (p.bodyColor && p.bodyColor.length === 3) ? p.bodyColor : [0.27, 0.62, 0.93];
            var bodyOpacity = Math.min(100, Math.max(0, p.bodyOpacity));
            var glowColor = (p.glowColor && p.glowColor.length === 3) ? p.glowColor : [1, 1, 1];
            var glowOpacity = Math.min(100, Math.max(0, p.glowOpacity));

            var dur = p.dur;
            var cycleFrames = Math.max(0, Math.floor(p.cycleFrames));
            var cycle = cycleFrames > 0 ? cycleFrames / 30 : h / rise;
            if (dur <= 0) dur = Math.min(120, Math.max(5, cycle + 2));

            app.beginUndoGroup("生成水面波动效果");
            var comp = proj.items.addComp("水面上涨", w, h, 1, dur, 30);
            log("OK 合成已创建 " + w + "x" + h + " " + dur.toFixed(1) + "s");
            comp.openInViewer();

            var bg = comp.layers.addSolid([0.043, 0.102, 0.169], "背景", w, h, 1, dur);
            bg.moveToBeginning();
            log("OK 背景图层已创建");

            var layer = comp.layers.addShape();
            layer.name = "水面";
            log("OK 水面形状图层已创建");
            // 图层级变换归零（match name，跨语言）
            var transform = layer.property("ADBE Transform Group");
            if (transform) {
                try {
                    var tAnchor = transform.property("ADBE Anchor Point");
                    var tPos = transform.property("ADBE Position");
                    if (tAnchor) tAnchor.setValue([0, 0]);
                    if (tPos) tPos.setValue([0, 0]);
                    log("OK 图层变换归零: Anchor/Position = [0,0]");
                } catch (eTF) {
                    log("!! 图层变换归零失败: " + eTF.message);
                }
            }
            var contents = layer.property("Contents");
            if (!contents) throw new Error("无法获取形状图层的 Contents 属性");

            // --- 组1：水体（纯色填充 + 闭合多边形路径） ---
            var gWater = contents.addProperty("ADBE Vector Group");
            if (!gWater) throw new Error("无法添加水体组 (ADBE Vector Group)");
            gWater.name = "水体";
            var gWaterContents = gWater.property("Contents");
            var i;
            for (i = gWaterContents.numProperties; i >= 1; i--) {
                gWaterContents.property(i).remove();
            }
            var path1 = gWaterContents.addProperty("ADBE Vector Shape - Group");
            if (!path1) throw new Error("无法添加水面路径组件: ADBE Vector Shape - Group");
            path1.name = "水面路径";
            log("OK 水面路径已添加");

            var fill2 = gWaterContents.addProperty("ADBE Vector Graphic - Fill");
            if (!fill2) throw new Error("无法添加纯色填充: ADBE Vector Graphic - Fill");
            fill2.name = "水体";
            // 颜色由一个 Color Control 控件驱动（AE 原生取色器，值含 RGBA）
            fill2.property("Color").expression = "effect('水体颜色')(1)";
            log("OK 水体填充已设置（Color Control 驱动）");

            // --- 组2：波峰高光（描边 + 仅波浪线路径） ---
            var gGlow = contents.addProperty("ADBE Vector Group");
            if (!gGlow) throw new Error("无法添加高光组 (ADBE Vector Group)");
            gGlow.name = "波峰高光";
            var gGlowContents = gGlow.property("Contents");
            for (i = gGlowContents.numProperties; i >= 1; i--) {
                gGlowContents.property(i).remove();
            }
            var path2 = gGlowContents.addProperty("ADBE Vector Shape - Group");
            if (!path2) throw new Error("无法添加高光路径组件");
            path2.name = "高光路径";
            log("OK 高光路径已添加");
            var stroke = gGlowContents.addProperty("ADBE Vector Graphic - Stroke");
            if (stroke) {
                stroke.name = "高光";
                // 颜色由「高光颜色」Color Control 驱动（RGBA 含透明度）
                stroke.property("Color").expression = "effect('高光颜色')(1)";
                stroke.property("Stroke Width").setValue(2);
                log("OK 高光描边已设置（Color Control 驱动）");
            }

            // --- 滑块/勾选框控制 ---
            var fx = layer.property("ADBE Effect Parade");
            if (!fx) throw new Error("无法获取效果列表 ADBE Effect Parade");
            function addSlider(name, val) {
                var s = fx.addProperty("ADBE Slider Control");
                if (!s) throw new Error("无法添加滑块控件: " + name);
                s.name = name;
                var sp = s.property("ADBE Slider Control-0001");
                if (!sp) throw new Error("滑块参数缺失: " + name);
                sp.setValue(val);
                log("OK 滑块: " + name + " = " + val);
                return s;
            }
            function addCheckbox(name, val) {
                var cb = fx.addProperty("ADBE Checkbox Control");
                if (!cb) throw new Error("无法添加勾选框控件: " + name);
                cb.name = name;
                var cp = cb.property("ADBE Checkbox Control-0001");
                if (!cp) throw new Error("勾选框参数缺失: " + name);
                cp.setValue(val ? 1 : 0);
                log("OK 勾选框: " + name + " = " + (val ? 1 : 0));
                return cb;
            }
            function addColor(name, val) {
                var c = fx.addProperty("ADBE Color Control");
                if (!c) throw new Error("无法添加颜色控件: " + name);
                c.name = name;
                var cp = c.property("ADBE Color Control-0001");
                if (!cp) throw new Error("颜色参数缺失: " + name);
                cp.setValue(val);
                log("OK 颜色控件: " + name);
                return c;
            }
            addSlider("上涨速度", rise);
            addSlider("流动速度", flow);
            addSlider("波峰高度", amp);
            addSlider("波长", wl);
            addSlider("循环帧数", cycleFrames);
            addCheckbox("噪波开关", nzOn);
            addSlider("种子", seed);
            addSlider("噪波速度", noiseSpeed);
            addSlider("噪波幅度", noiseSize);
            addSlider("噪波颗粒", noiseGrain);
            // 颜色用 Color Control 控件（一个参数，AE 原生取色器，值含 RGBA）
            addColor("水体颜色", [bodyColor[0], bodyColor[1], bodyColor[2], bodyOpacity / 100]);
            addColor("高光颜色", [glowColor[0], glowColor[1], glowColor[2], glowOpacity / 100]);
            addSlider("循环起点", 0);

            // --- 挂表达式（全部重新查找拿新鲜引用，避免引用失效"对象无效"） ---
            var gWaterRef = findGroupByName(contents, "水体");
            if (!gWaterRef) throw new Error("找不到水体组");
            zeroGroupTransform(gWaterRef);
            var pathData1 = getPathData(findPathProp(gWaterRef.property("Contents")));
            if (!pathData1) throw new Error("找不到水面路径属性");
            pathData1.expression = buildWaterPathExp();
            log("OK 水面路径表达式已挂载（闭合多边形）");

            var gGlowRef = findGroupByName(contents, "波峰高光");
            if (!gGlowRef) throw new Error("找不到高光组");
            zeroGroupTransform(gGlowRef);
            var pathData2 = getPathData(findPathProp(gGlowRef.property("Contents")));
            if (!pathData2) throw new Error("找不到高光路径属性");
            pathData2.expression = buildGlowPathExp();
            log("OK 高光路径表达式已挂载（仅波浪线）");

            app.endUndoGroup();
            log("==== 生成完成 ====");
            status.text = "已生成合成「水面上涨」，波浪自动上涨循环。";
        } catch (e) {
            try { app.endUndoGroup(); } catch (e2) { /* 忽略 */ }
            status.text = "生成失败，请查看弹窗。";
            showError("生成水面失败", e);
        }
    }

    // ================= 事件绑定 =================
    btnGen.onClick = generate;
    resetBtn.onClick = resetParams;
    clearPresetBtn.onClick = clearAllPresets;
    // 点色块打开调色板（不再需要「…」按钮）
    function openBodyPicker() {
        var c = openHslColorPicker("水体颜色", bodyColor);
        if (c) {
            bodyColor = c;
            updateSwatch(bodySwatch, bodyColor);
            bodyHexEdit.text = rgb01ToHex(bodyColor);
        }
    }
    function openGlowPicker() {
        var c = openHslColorPicker("高光颜色", glowColor);
        if (c) {
            glowColor = c;
            updateSwatch(glowSwatch, glowColor);
            glowHexEdit.text = rgb01ToHex(glowColor);
        }
    }
    try {
        bodySwatch.addEventListener("click", openBodyPicker);
        glowSwatch.addEventListener("click", openGlowPicker);
    } catch (e) { /* 忽略 */ }

    // 直接输入 HEX 修改颜色（自动补 #）
    bodyHexEdit.onChange = function () {
        var c = hexToRgb01(bodyHexEdit.text);
        if (c) {
            bodyColor = c;
            updateSwatch(bodySwatch, bodyColor);
            bodyHexEdit.text = rgb01ToHex(bodyColor);
        }
    };
    glowHexEdit.onChange = function () {
        var c = hexToRgb01(glowHexEdit.text);
        if (c) {
            glowColor = c;
            updateSwatch(glowSwatch, glowColor);
            glowHexEdit.text = rgb01ToHex(glowColor);
        }
    };
    updateSwatch(bodySwatch, bodyColor);
    updateSwatch(glowSwatch, glowColor);
    for (i2 = 1; i2 <= 4; i2++) {
        saveBtns[i2 - 1].onClick = (function (idx) {
            return function () { saveSlot(idx); };
        })(i2);
        loadBtns[i2 - 1].onClick = (function (idx) {
            return function () { loadSlot(idx); };
        })(i2);
    }

    presetsCache = initPresetsCache();
    updateLoadButtons();

    if (pal instanceof Window) {
        pal.center();
        pal.show();
    } else {
        pal.layout.layout(true);
    }
})(this);