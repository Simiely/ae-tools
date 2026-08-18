// ============================================================
// 歌词逐字散落动画工具  v3.5  —  for After Effects 2026
// ============================================================
// 功能：选中文本图层后，自动生成逐字动画
// - 入场方向可选（左/右/上/下），逐字/一起模式
// - 出场方向与入场对称，逐字/一起模式
// - 高度错落（波浪浮动）+ 散落分布（随机位置、随机大小、可控时间）
// - 随机模糊效果（部分字符模糊、部分清晰，基于种子可复现）
// - 字间距动态（初始→结束字间距线性变化）
// - 每个功能面板有独立总开关，可单独启用/关闭
// - 所有参数可调
// - 预设存储/加载（双层持久化：工程目录 JSON + app.settings 全局保底）
// - 代码模块化重构，UI 工厂函数 + 动画子函数拆分
// ============================================================

(function(thisObj) {

// ---- 集中默认值 ----
var DEFAULTS = {
    entryDur: "2.0", entryBlur: "40", entryOffset: "80",
    entryDir: 0, entryMode: 0, entryEnable: true,
    exitStart: "3.5", exitDur: "2.0", exitOffset: "80",
    exitMode: 0, exitEnable: true,
    heightAmp: "30", heightFreq: "0.7", speed: "1.0", heightEnable: true,
    spacingStart: "0", spacingEnd: "50", spacingDur: "2.0", spacingStartTime: "0", spacingEnable: false,
    scatterRange: "150", seed: "1", scatterStart: "2.0", scatterTrans: "1.0",
    minScale: "50", maxScale: "200", blurSeed: "10", blurProb: "40",
    blurMin: "0", blurMax: "25", scatterEnable: true
};

// ---- UI 工厂函数 ----
function createParamPanel(parent, title) {
    var p = parent.add("panel");
    p.text = "  " + title;
    p.orientation = "column";
    p.alignChildren = ["fill", "top"];
    p.spacing = 3;
    p.margins = [8, 14, 8, 8];
    p.alignment = ["fill", "top"];
    return p;
}

function addParamRow(parent, label, defaultVal) {
    var g = parent.add("group");
    g.orientation = "row";
    g.alignChildren = ["fill", "center"];
    g.add("statictext", undefined, label).preferredSize.width = 110;
    var edt = g.add("edittext", undefined, defaultVal);
    edt.characters = 5;
    edt.alignment = ["fill", "center"];
    return edt;
}

function addDropdownRow(parent, label, items, selIndex) {
    var g = parent.add("group");
    g.orientation = "row";
    g.alignChildren = ["fill", "center"];
    g.add("statictext", undefined, label).preferredSize.width = 110;
    var dd = g.add("dropdownlist", undefined, items);
    dd.selection = selIndex || 0;
    dd.preferredSize.width = 100;
    return dd;
}

function addEnableCheckbox(parent, label, defaultVal) {
    var g = parent.add("group");
    g.orientation = "row";
    g.alignChildren = ["left", "center"];
    var cb = g.add("checkbox", undefined, "  " + label);
    cb.value = defaultVal;
    return cb;
}

// ---- 构建面板 ----
var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", "歌词逐字散落动画工具 v3.5", undefined, {resizeable: true});
pal.orientation = "column";
pal.alignChildren = ["fill", "top"];
pal.spacing = 4;
pal.margins = [8, 8, 8, 8];

// 标题
var titleGrp = pal.add("group");
titleGrp.orientation = "row";
titleGrp.alignment = "center";
var titleText = titleGrp.add("statictext", undefined, "歌词逐字散落动画工具");

// ---- 参数容器 ----
var tabGrp = pal.add("group");
tabGrp.orientation = "column";
tabGrp.alignChildren = ["fill", "top"];
tabGrp.spacing = 4;
tabGrp.alignment = ["fill", "top"];

// ======================================================================
// 入场参数
// ======================================================================
var entryGrp = createParamPanel(tabGrp, "入场参数");

// 入场总开关
var entryEnable = addEnableCheckbox(entryGrp, "启用入场动画", DEFAULTS.entryEnable);

var entryDur = addParamRow(entryGrp, "持续时间 (秒)", DEFAULTS.entryDur);
var entryBlur = addParamRow(entryGrp, "最大模糊值", DEFAULTS.entryBlur);
var entryOffset = addParamRow(entryGrp, "入场偏移 (像素)", DEFAULTS.entryOffset);
var entryDirection = addDropdownRow(entryGrp, "入场方向", ["从左到右", "从右到左", "从上到下", "从下到上"], DEFAULTS.entryDir);
var entryMode = addDropdownRow(entryGrp, "入场模式", ["逐字出现", "一起出现"], DEFAULTS.entryMode);

// ======================================================================
// 出场参数
// ======================================================================
var exitGrp = createParamPanel(tabGrp, "出场参数");

// 出场总开关
var exitEnable = addEnableCheckbox(exitGrp, "启用出场动画", DEFAULTS.exitEnable);

// 出场开始 (秒) - 带 (绝对时间) 提示
var g4 = exitGrp.add("group"); g4.orientation = "row"; g4.alignChildren = ["fill", "center"];
g4.add("statictext", undefined, "出场开始 (秒)").preferredSize.width = 110;
var exitStart = g4.add("edittext", undefined, DEFAULTS.exitStart); exitStart.characters = 5; exitStart.alignment = ["fill", "center"];
g4.add("statictext", undefined, "(绝对时间)").preferredSize.width = 80;

var exitDur = addParamRow(exitGrp, "出场持续时间 (秒)", DEFAULTS.exitDur);
var exitOffset = addParamRow(exitGrp, "出场偏移 (像素)", DEFAULTS.exitOffset);
var exitMode = addDropdownRow(exitGrp, "出场模式", ["逐字消失", "一起消失"], DEFAULTS.exitMode);

// ======================================================================
// 高度错落参数
// ======================================================================
var heightGrp = createParamPanel(tabGrp, "高度错落（波浪浮动）");

// 高度错落总开关
var heightEnable = addEnableCheckbox(heightGrp, "启用高度错落", DEFAULTS.heightEnable);

var heightAmp = addParamRow(heightGrp, "波动幅度 (像素)", DEFAULTS.heightAmp);
var heightFreq = addParamRow(heightGrp, "波动频率", DEFAULTS.heightFreq);
var speed = addParamRow(heightGrp, "流动速度", DEFAULTS.speed);

// ======================================================================
// 字间距动态参数
// ======================================================================
var spacingGrp = createParamPanel(tabGrp, "字间距动态");

// 字间距总开关
var spacingEnable = addEnableCheckbox(spacingGrp, "启用字间距动画", DEFAULTS.spacingEnable);

var spacingStart = addParamRow(spacingGrp, "初始字间距", DEFAULTS.spacingStart);
var spacingEnd = addParamRow(spacingGrp, "结束字间距", DEFAULTS.spacingEnd);
var spacingDur = addParamRow(spacingGrp, "持续时间 (秒)", DEFAULTS.spacingDur);

// 开始时间 (秒) - 带 (绝对时间) 提示
var gSp4 = spacingGrp.add("group"); gSp4.orientation = "row"; gSp4.alignChildren = ["fill", "center"];
gSp4.add("statictext", undefined, "开始时间 (秒)").preferredSize.width = 110;
var spacingStartTime = gSp4.add("edittext", undefined, DEFAULTS.spacingStartTime); spacingStartTime.characters = 5; spacingStartTime.alignment = ["fill", "center"];
gSp4.add("statictext", undefined, "(绝对时间)").preferredSize.width = 80;

// ======================================================================
// 散落分布参数
// ======================================================================
var scatterGrp = createParamPanel(tabGrp, "散落分布（随机位置 / 大小 / 模糊）");

// 散落分布总开关
var scatterEnable = addEnableCheckbox(scatterGrp, "启用散落分布", DEFAULTS.scatterEnable);

var scatterRange = addParamRow(scatterGrp, "散布范围 (像素)", DEFAULTS.scatterRange);
var seed = addParamRow(scatterGrp, "随机种子", DEFAULTS.seed);

// 散落开始 (秒) - 带 (绝对时间) 提示
var gS3 = scatterGrp.add("group"); gS3.orientation = "row"; gS3.alignChildren = ["fill", "center"];
gS3.add("statictext", undefined, "散落开始 (秒)").preferredSize.width = 110;
var scatterStart = gS3.add("edittext", undefined, DEFAULTS.scatterStart); scatterStart.characters = 5; scatterStart.alignment = ["fill", "center"];
gS3.add("statictext", undefined, "(绝对时间)").preferredSize.width = 80;

var scatterTrans = addParamRow(scatterGrp, "散落过渡 (秒)", DEFAULTS.scatterTrans);
var minScale = addParamRow(scatterGrp, "最小缩放 (%)", DEFAULTS.minScale);
var maxScale = addParamRow(scatterGrp, "最大缩放 (%)", DEFAULTS.maxScale);
var blurSeed = addParamRow(scatterGrp, "模糊随机种子", DEFAULTS.blurSeed);
var blurProb = addParamRow(scatterGrp, "模糊概率 (%)", DEFAULTS.blurProb);
var blurMin = addParamRow(scatterGrp, "最小模糊值", DEFAULTS.blurMin);
var blurMax = addParamRow(scatterGrp, "最大模糊值", DEFAULTS.blurMax);

// ======================================================================
// 预设管理
// ======================================================================
var presetGrp = pal.add("panel");
presetGrp.text = "  预设管理";
presetGrp.orientation = "column";
presetGrp.alignChildren = ["fill", "top"];
presetGrp.spacing = 3;
presetGrp.margins = [8, 14, 8, 6];
presetGrp.alignment = ["fill", "top"];

var saveRow = presetGrp.add("group");
saveRow.orientation = "row";
saveRow.alignChildren = ["left", "center"];
saveRow.spacing = 1;
var saveLabel = saveRow.add("statictext", undefined, "存储");
saveLabel.size = {width: 24, height: 20};
var saveBtns = [];
for (var px = 1; px <= 4; px++) {
    var sBtn = saveRow.add("button", undefined, String(px));
    sBtn.size = {width: 24, height: 22};
    saveBtns.push(sBtn);
}
var clearPresetBtn = saveRow.add("button", undefined, "清除全部");
clearPresetBtn.size = {width: 60, height: 22};

var loadRow = presetGrp.add("group");
loadRow.orientation = "row";
loadRow.alignChildren = ["left", "center"];
loadRow.spacing = 1;
var loadLabel = loadRow.add("statictext", undefined, "使用");
loadLabel.size = {width: 24, height: 20};
var loadBtns = [];
for (var px = 1; px <= 4; px++) {
    var lBtn = loadRow.add("button", undefined, String(px));
    lBtn.size = {width: 24, height: 22};
    lBtn.enabled = false;
    loadBtns.push(lBtn);
}
var resetBtn = loadRow.add("button", undefined, "复位");
resetBtn.size = {width: 55, height: 22};

for (var px = 1; px <= 4; px++) {
    saveBtns[px - 1].onClick = (function(idx) {
        return function() { saveSlot(idx); };
    })(px);
}
for (var px = 1; px <= 4; px++) {
    loadBtns[px - 1].onClick = (function(idx) {
        return function() { loadSlot(idx); };
    })(px);
}
clearPresetBtn.onClick = function() { clearAllPresets(); };
resetBtn.onClick = function() { resetParams(); };

// ======================================================================
// 按钮
// ======================================================================
var btnGrp = pal.add("group");
btnGrp.orientation = "row";
btnGrp.alignment = "center";
btnGrp.spacing = 20;
btnGrp.margins = [0, 6, 0, 0];

var applyBtn = btnGrp.add("button", undefined, "应用动画");
applyBtn.preferredSize.width = 130;
applyBtn.preferredSize.height = 28;

var clearBtn = btnGrp.add("button", undefined, "清除动画");
clearBtn.preferredSize.width = 130;
clearBtn.preferredSize.height = 28;

var statusBar = pal.add("statictext", undefined, "就绪 - 选中一个文本图层后点击应用");
statusBar.alignment = ["fill", "top"];
statusBar.margins = [0, 4, 0, 0];

var tipBar = pal.add("statictext", undefined, "提示：各面板可通过复选框独立开关；散落开始时间应 ≥ 入场持续时间");
tipBar.alignment = ["fill", "top"];
tipBar.margins = [0, 0, 0, 0];

// ============================================================
// 核心功能
// ============================================================

function getVal(ctrl, def) {
    var v = parseFloat(ctrl.text);
    return isNaN(v) ? def : v;
}

function setStatus(msg) {
    statusBar.text = msg;
}

// ---- 移除所有以"歌词_"开头的动画器 ----
function removeLyricsAnimators(animatorsGroup) {
    var removed = 0;
    for (var i = animatorsGroup.numProperties; i >= 1; i--) {
        var anim = animatorsGroup.property(i);
        if (anim.name && anim.name.indexOf("歌词_") === 0) {
            anim.remove();
            removed++;
        }
    }
    return removed;
}

// ---- 清除动画 ----
function clearAnimators() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        setStatus("请先激活一个合成");
        return;
    }
    var layer = comp.selectedLayers[0];
    if (!layer || !(layer instanceof TextLayer)) {
        setStatus("请选中一个文本图层");
        return;
    }

    var animatorsGroup = findAnimatorsGroup(layer);
    if (!animatorsGroup) { setStatus("该图层没有文字动画器"); return; }

    var removed = removeLyricsAnimators(animatorsGroup);

    if (removed > 0) {
        setStatus("已清除 " + removed + " 个文字动画器");
    } else {
        setStatus("未找到需要清除的文字动画器");
    }
}

// ---- 安全添加属性 ----
function addAnimProperty(propsGroup, propType) {
    var candidates = [propType];
    if (propType === "ADBE Text Blur") candidates = ["ADBE Text Blur", "ADBE Text Blur 2D", "ADBE Text Blur 3D", "Blur", "模糊"];
    else if (propType === "ADBE Text Position") candidates = ["ADBE Text Position", "ADBE Text Position 2D", "ADBE Text Position 3D", "Position", "位置"];
    else if (propType === "ADBE Text Opacity") candidates = ["ADBE Text Opacity", "ADBE Text Opacity Percent", "Opacity", "不透明度"];
    else if (propType === "ADBE Text Scale") candidates = ["ADBE Text Scale", "ADBE Text Scale 3D", "Scale", "缩放"];
    else if (propType === "ADBE Text Tracking Amount") candidates = ["ADBE Text Tracking Amount", "ADBE Text Tracking"];

    if (propsGroup.addProperty) {
        for (var ai = 0; ai < candidates.length; ai++) {
            try {
                var result = propsGroup.addProperty(candidates[ai]);
                if (result) return result;
            } catch (e) {}
        }
    }

    for (var ai = 0; ai < candidates.length; ai++) {
        try {
            var result = propsGroup.property(candidates[ai]);
            if (result) return result;
        } catch (e) {}
    }

    setStatus("错误: 无法添加属性 " + propType);
    return null;
}

// ---- 预设存储（双层：工程目录 JSON + app.settings 全局保底） ----

// JSON polyfill（ExtendScript 可能没有内置 JSON 对象）
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.stringify !== "function") {
    JSON.stringify = function(obj) {
        var t = typeof obj;
        if (t === "undefined") return undefined;
        if (t === "function" || obj === null) return "null";
        if (t === "boolean" || t === "number") return String(obj);
        if (t === "string") return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
        if (obj instanceof Array) {
            var arr = [];
            for (var i = 0; i < obj.length; i++) { arr.push(JSON.stringify(obj[i])); }
            return "[" + arr.join(",") + "]";
        }
        if (t === "object") {
            var pairs = [];
            for (var k in obj) {
                if (obj.hasOwnProperty(k)) {
                    var v = JSON.stringify(obj[k]);
                    if (v !== undefined) pairs.push('"' + k + '":' + v);
                }
            }
            return "{" + pairs.join(",") + "}";
        }
        return "null";
    };
}
if (typeof JSON.parse !== "function") {
    JSON.parse = function(text) {
        // 简易解析：用 eval（ExtendScript 环境安全）
        if (typeof text !== "string" || text.length === 0) return null;
        return eval("(" + text + ")");
    };
}

var SETTINGS_SECTION = "AE_Lyrics_Anim";
var SETTINGS_KEY_PREFIX = "preset_";
var PRESET_FILENAME = "歌词动画预设.json";

// ===== 工程目录 JSON 文件 =====

// 获取工程目录下的预设 JSON 文件路径
function getProjectPresetFile() {
    try {
        var projFile = app.project.file;
        if (!projFile) return null;
        var projFolder = projFile.parent;
        if (!projFolder) return null;
        var f = new File(projFolder.fsName + "/" + PRESET_FILENAME);
        return f;
    } catch (e) { return null; }
}

// 从工程目录 JSON 读取所有预设
function readFromProjectFile() {
    try {
        var f = getProjectPresetFile();
        if (!f || !f.exists) return null;
        f.open("r");
        var text = f.read();
        f.close();
        if (!text || text.length === 0) return null;
        var parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") return parsed;
    } catch (e) {}
    return null;
}

// 写入预设到工程目录 JSON（带详细诊断）
function writeToProjectFile(data) {
    var diag = ""; // 诊断信息

    try {
        var f = getProjectPresetFile();
        if (!f) {
            alert("JSON 写入失败：工程未保存\n\n请先保存 .aep 工程文件，预设才能跟工程走。\n本次已保存到全局设置（app.settings）。");
            return false;
        }
        diag += "路径: " + f.fsName + "\n";

        // 确保目录存在
        var dir = f.parent;
        if (dir) {
            diag += "目录存在: " + dir.exists + "\n";
        }

        // 序列化
        var content = JSON.stringify(data);
        diag += "内容长度: " + content.length + "\n";

        if (!content || content.length === 0) {
            alert("JSON 写入失败：内容为空\n" + diag);
            return false;
        }

        // 打开文件
        var opened = f.open("w");
        diag += "open 结果: " + opened + "\n";
        if (!opened) {
            alert("JSON 写入失败：无法打开文件\n" + diag + "\n请检查权限:\n编辑 → 首选项 → 脚本和表达式 → 允许脚本写入文件和访问网络");
            return false;
        }

        // 写入
        var wrote = f.write(content);
        diag += "write 结果: " + wrote + "\n";
        f.close();

        if (!wrote) {
            alert("JSON 写入失败：write 返回 false\n" + diag);
            return false;
        }

        // 验证
        f.open("r");
        var verify = f.read();
        f.close();
        diag += "验证读回长度: " + (verify ? verify.length : 0) + "\n";

        if (verify && verify.length > 0) {
            return true;
        } else {
            alert("JSON 写入失败：验证读回为空\n" + diag);
            return false;
        }
    } catch (ex) {
        alert("JSON 写入异常:\n" + ex.toString() + "\n" + diag);
        return false;
    }
}

// 删除工程目录 JSON 文件
function deleteProjectFile() {
    try {
        var f = getProjectPresetFile();
        if (f && f.exists) { f.remove(); }
    } catch (e) {}
}

// ===== app.settings 全局保底 =====

function readFromSettings(idx) {
    try {
        if (app.settings.haveSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx)) {
            var text = app.settings.getSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx);
            if (text && text.length > 0) return JSON.parse(text);
        }
    } catch (e) {}
    return null;
}

function writeToSettings(idx, params) {
    try {
        app.settings.saveSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx, JSON.stringify(params));
        return true;
    } catch (e) { return false; }
}

function deleteFromSettings(idx) {
    try {
        if (app.settings.haveSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx)) {
            app.settings.saveSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx, "");
        }
    } catch (e) {}
}

// ===== 统一接口 =====

// 读取所有预设：优先工程目录 JSON，回退 app.settings
var presetsCache = (function() {
    // 1. 先读工程目录 JSON
    var fromFile = readFromProjectFile();
    if (fromFile) return fromFile;

    // 2. 回退到 app.settings
    var cache = {};
    for (var i = 1; i <= 4; i++) {
        var p = readFromSettings(i);
        if (p) cache[String(i)] = p;
    }
    return cache;
})();

// 保存预设：同时写工程 JSON 和 app.settings
function saveSlot(idx) {
    var params = {
        d: entryDur.text, b: entryBlur.text, o: entryOffset.text,
        dir: entryDirection.selection ? entryDirection.selection.index : 0,
        emode: entryMode.selection ? entryMode.selection.index : 0,
        enbl: entryEnable.value,
        es: exitStart.text, ed: exitDur.text, eo: exitOffset.text,
        xmode: exitMode.selection ? exitMode.selection.index : 0,
        xenbl: exitEnable.value,
        a: heightAmp.text, f: heightFreq.text, sp: speed.text,
        henbl: heightEnable.value,
        ss1: spacingStart.text, ss2: spacingEnd.text, ss3: spacingDur.text, ss4: spacingStartTime.text,
        spenbl: spacingEnable.value,
        r: scatterRange.text, sd: seed.text,
        ss: scatterStart.text, st: scatterTrans.text,
        mn: minScale.text, mx: maxScale.text,
        bs: blurSeed.text, bp: blurProb.text, bmin: blurMin.text, bmax: blurMax.text,
        scnbl: scatterEnable.value
    };
    presetsCache[String(idx)] = params;

    // 1. 全局保底（始终执行）
    var globalOk = writeToSettings(idx, params);

    // 2. 工程目录 JSON（跟工程走）
    var fileOk = writeToProjectFile(presetsCache);

    updateLoadButtons();
    if (fileOk) {
        setStatus("已保存到预设 " + idx + "（工程目录 JSON）");
    } else if (globalOk) {
        setStatus("已保存到预设 " + idx + "（全局设置）");
    } else {
        setStatus("保存预设 " + idx + " 失败");
    }
}

function clearAllPresets() {
    for (var i = 1; i <= 4; i++) { deleteFromSettings(i); }
    deleteProjectFile();
    presetsCache = {};
    updateLoadButtons();
    setStatus("已清除所有预设");
}

function updateLoadButtons() {
    for (var pi = 1; pi <= 4; pi++) {
        if (loadBtns && loadBtns[pi - 1]) {
            loadBtns[pi - 1].enabled = (presetsCache && presetsCache[String(pi)]) ? true : false;
        }
    }
}

function loadSlot(idx) {
    if (!presetsCache || !presetsCache[String(idx)]) {
        setStatus("预设 " + idx + " 没有数据");
        return;
    }
    var p = presetsCache[String(idx)];
    entryDur.text = p.d !== undefined ? p.d : DEFAULTS.entryDur;
    entryBlur.text = p.b !== undefined ? p.b : DEFAULTS.entryBlur;
    entryOffset.text = p.o !== undefined ? p.o : DEFAULTS.entryOffset;
    if (entryDirection && p.dir !== undefined) entryDirection.selection = parseInt(p.dir);
    if (entryMode && p.emode !== undefined) entryMode.selection = parseInt(p.emode);
    if (entryEnable) entryEnable.value = (p.enbl !== undefined) ? p.enbl : DEFAULTS.entryEnable;
    exitStart.text = p.es !== undefined ? p.es : DEFAULTS.exitStart;
    exitDur.text = p.ed !== undefined ? p.ed : DEFAULTS.exitDur;
    exitOffset.text = p.eo !== undefined ? p.eo : DEFAULTS.exitOffset;
    if (exitMode && p.xmode !== undefined) exitMode.selection = parseInt(p.xmode);
    if (exitEnable) exitEnable.value = (p.xenbl !== undefined) ? p.xenbl : DEFAULTS.exitEnable;
    heightAmp.text = p.a !== undefined ? p.a : DEFAULTS.heightAmp;
    heightFreq.text = p.f !== undefined ? p.f : DEFAULTS.heightFreq;
    speed.text = p.sp !== undefined ? p.sp : DEFAULTS.speed;
    if (heightEnable) heightEnable.value = (p.henbl !== undefined) ? p.henbl : DEFAULTS.heightEnable;
    spacingStart.text = p.ss1 !== undefined ? p.ss1 : DEFAULTS.spacingStart;
    spacingEnd.text = p.ss2 !== undefined ? p.ss2 : DEFAULTS.spacingEnd;
    spacingDur.text = p.ss3 !== undefined ? p.ss3 : DEFAULTS.spacingDur;
    spacingStartTime.text = p.ss4 !== undefined ? p.ss4 : DEFAULTS.spacingStartTime;
    if (spacingEnable) spacingEnable.value = (p.spenbl !== undefined) ? p.spenbl : DEFAULTS.spacingEnable;
    scatterRange.text = p.r !== undefined ? p.r : DEFAULTS.scatterRange;
    seed.text = p.sd !== undefined ? p.sd : DEFAULTS.seed;
    scatterStart.text = p.ss !== undefined ? p.ss : DEFAULTS.scatterStart;
    scatterTrans.text = p.st !== undefined ? p.st : DEFAULTS.scatterTrans;
    minScale.text = p.mn !== undefined ? p.mn : DEFAULTS.minScale;
    maxScale.text = p.mx !== undefined ? p.mx : DEFAULTS.maxScale;
    blurSeed.text = p.bs !== undefined ? p.bs : DEFAULTS.blurSeed;
    blurProb.text = p.bp !== undefined ? p.bp : DEFAULTS.blurProb;
    blurMin.text = p.bmin !== undefined ? p.bmin : DEFAULTS.blurMin;
    blurMax.text = p.bmax !== undefined ? p.bmax : DEFAULTS.blurMax;
    if (scatterEnable) scatterEnable.value = (p.scnbl !== undefined) ? p.scnbl : DEFAULTS.scatterEnable;
    setStatus("已加载预设 " + idx);
}

function resetParams() {
    entryDur.text = DEFAULTS.entryDur;
    entryBlur.text = DEFAULTS.entryBlur;
    entryOffset.text = DEFAULTS.entryOffset;
    if (entryDirection) entryDirection.selection = DEFAULTS.entryDir;
    if (entryMode) entryMode.selection = DEFAULTS.entryMode;
    if (entryEnable) entryEnable.value = DEFAULTS.entryEnable;
    exitStart.text = DEFAULTS.exitStart;
    exitDur.text = DEFAULTS.exitDur;
    exitOffset.text = DEFAULTS.exitOffset;
    if (exitMode) exitMode.selection = DEFAULTS.exitMode;
    if (exitEnable) exitEnable.value = DEFAULTS.exitEnable;
    heightAmp.text = DEFAULTS.heightAmp;
    heightFreq.text = DEFAULTS.heightFreq;
    speed.text = DEFAULTS.speed;
    if (heightEnable) heightEnable.value = DEFAULTS.heightEnable;
    spacingStart.text = DEFAULTS.spacingStart;
    spacingEnd.text = DEFAULTS.spacingEnd;
    spacingDur.text = DEFAULTS.spacingDur;
    spacingStartTime.text = DEFAULTS.spacingStartTime;
    if (spacingEnable) spacingEnable.value = DEFAULTS.spacingEnable;
    scatterRange.text = DEFAULTS.scatterRange;
    seed.text = DEFAULTS.seed;
    scatterStart.text = DEFAULTS.scatterStart;
    scatterTrans.text = DEFAULTS.scatterTrans;
    minScale.text = DEFAULTS.minScale;
    maxScale.text = DEFAULTS.maxScale;
    blurSeed.text = DEFAULTS.blurSeed;
    blurProb.text = DEFAULTS.blurProb;
    blurMin.text = DEFAULTS.blurMin;
    blurMax.text = DEFAULTS.blurMax;
    if (scatterEnable) scatterEnable.value = DEFAULTS.scatterEnable;
    setStatus("参数已复位");
}

// ---- 辅助函数：安全设置 Blur 值（兼容 2D/1D，可选关键帧） ----
function setBlur(prop, val, key) {
    try {
        var isTwoD = (prop.propertyValueType === PropertyValueType.TwoD);
        if (key === undefined || key === null) {
            if (isTwoD) prop.setValue([val, val]);
            else prop.setValue(val);
        } else {
            if (isTwoD) prop.setValueAtKey(key, [val, val]);
            else prop.setValueAtKey(key, val);
        }
    } catch (e) {}
}

// ---- 辅助函数：根据方向计算 Position 偏移（isExit 时取反，对称出场） ----
function getDirectionPos(offset, direction, is3D, isExit) {
    var o = isExit ? -offset : offset;
    if (is3D) {
        if (direction === 1) return [o, 0, 0];        // 从右到左
        else if (direction === 2) return [0, -o, 0];   // 从上到下
        else if (direction === 3) return [0, o, 0];    // 从下到上
        else return [-o, 0, 0];                        // 从左到右
    } else {
        if (direction === 1) return [o, 0];
        else if (direction === 2) return [0, -o];
        else if (direction === 3) return [0, o];
        else return [-o, 0];
    }
}

// ---- 辅助函数：查找 Selector Start/End 属性 ----
function findSelectorStartEnd(sel) {
    var startProp = sel.property("ADBE Text Start");
    var endProp = sel.property("ADBE Text End");
    if (!startProp) startProp = sel.property("Start");
    if (!endProp) endProp = sel.property("End");
    if (!startProp && sel.numProperties >= 1) startProp = sel.property(1);
    if (!endProp && sel.numProperties >= 2) endProp = sel.property(2);
    return { start: startProp, end: endProp };
}

// ---- 辅助函数：查找 Animator 属性组 ----
function findAnimatorProps(anim) {
    var props = anim.property("ADBE Text Properties");
    if (!props) {
        for (var si = 1; si <= anim.numProperties; si++) {
            var sp = anim.property(si);
            if (sp.matchName && sp.matchName.indexOf("ADBE") >= 0 && sp.matchName.indexOf("Property") >= 0 && sp.matchName.indexOf("Select") < 0) {
                props = sp; break;
            }
        }
        if (!props) props = anim.property(anim.numProperties);
    }
    return props;
}

// ---- 查找 Animators 组 ----
function findAnimatorsGroup(layer) {
    var ag = layer.property("ADBE Text Animators");
    if (!ag) {
        var tp = layer.property("ADBE Text Properties");
        if (tp) ag = tp.property("ADBE Text Animators");
    }
    if (!ag) {
        for (var di = 1; di <= layer.numProperties; di++) {
            var dp = layer.property(di);
            if (dp.matchName && dp.matchName.indexOf("ADBE") >= 0 && dp.matchName.indexOf("nimator") >= 0) {
                ag = dp; break;
            }
        }
    }
    return ag;
}

// ---- 获取文本长度 ----
function getTextLen(layer) {
    var textProp = layer.property("ADBE Text Properties");
    var sourceText = textProp.property("ADBE Text Source Text");
    if (!sourceText) sourceText = textProp.property("ADBE Text Document");
    var textDoc = sourceText.value;
    if (typeof textDoc === "string") return Math.max(1, textDoc.length);
    else if (textDoc && textDoc.text) return Math.max(1, textDoc.text.length);
    return 1;
}

// ---- 设置单个字符的 Percent Range ----
function lockCharRange(sel, ci, textLen) {
    var se = findSelectorStartEnd(sel);
    if (se.start && se.end) {
        se.start.setValue(((ci - 1) / textLen) * 100);
        se.end.setValue((ci / textLen) * 100);
    }
}

// ============================================================
// 逐字 Animator 创建骨架
// ============================================================
function createPerCharAnimator(animatorsGroup, namePrefix, ci, textLen, propType) {
    var anim = animatorsGroup.addProperty("ADBE Text Animator");
    anim.name = namePrefix + "_" + ci;
    var props = findAnimatorProps(anim);
    if (!props) return null;
    var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    lockCharRange(sel, ci, textLen);
    if (propType) {
        return addAnimProperty(props, propType);
    }
    return props;
}

// ---- 散落渐入表达式公共片段 ----
function buildScatterFadeExpr(seed, ci, startTime, scatterStart, scatterTrans) {
    var s = "seedRandom(" + seed + " + " + ci + ", true);\n";
    s += "t = time - " + startTime.toFixed(3) + ";\n";
    s += "fade = linear(t, " + scatterStart.toFixed(3) + ", " + (scatterStart + scatterTrans).toFixed(3) + ", 0, 1);\n";
    return s;
}

// ============================================================
// 参数读取
// ============================================================
function readAnimParams() {
    var params = {};
    params.entryEnbl   = entryEnable.value;
    params.entryDur    = Math.max(0.1, getVal(entryDur, 2.0));
    params.entryBlur   = Math.max(0, getVal(entryBlur, 40));
    params.entryOff    = getVal(entryOffset, 80);
    params.direction   = entryDirection && entryDirection.selection ? entryDirection.selection.index : 0;
    params.entryMode   = entryMode && entryMode.selection ? entryMode.selection.index : 0;  // 0=逐字, 1=一起

    params.exitEnbl    = exitEnable.value;
    params.exitStart   = Math.max(0, getVal(exitStart, 3.5));
    params.exitDur     = Math.max(0.1, getVal(exitDur, 2.0));
    params.exitOff     = getVal(exitOffset, 80);
    params.exitBlur    = params.entryBlur;  // 出场模糊复用入场模糊值
    params.exitMode    = exitMode && exitMode.selection ? exitMode.selection.index : 0;  // 0=逐字, 1=一起

    params.heightEnbl  = heightEnable.value;
    params.heightAmp   = Math.max(0, getVal(heightAmp, 30));
    params.heightFreq  = Math.max(0.01, getVal(heightFreq, 0.7));
    params.speed       = Math.max(0.01, getVal(speed, 1.0));

    params.scatterEnbl = scatterEnable.value;
    params.scatterRange = Math.max(0, getVal(scatterRange, 150));
    params.seed        = Math.max(0, getVal(seed, 1));
    params.scatterStart = Math.max(0, getVal(scatterStart, 2.0));
    params.scatterTrans = Math.max(0.01, getVal(scatterTrans, 1.0));
    params.minScale    = Math.max(1, getVal(minScale, 50));
    params.maxScale    = Math.max(1, getVal(maxScale, 200));
    params.blurSeed    = Math.max(0, getVal(blurSeed, 10));
    params.blurProb    = Math.max(0, Math.min(100, getVal(blurProb, 40)));
    params.blurMin     = Math.max(0, getVal(blurMin, 0));
    params.blurMax     = Math.max(0, getVal(blurMax, 25));

    params.spacingEnbl  = spacingEnable.value;
    params.spacingStartVal = getVal(spacingStart, 0);
    params.spacingEndVal   = getVal(spacingEnd, 50);
    params.spacingDur      = Math.max(0.1, getVal(spacingDur, 2.0));
    params.spacingStartTime = Math.max(0, getVal(spacingStartTime, 0));
    return params;
}

// ============================================================
// Animator 1: 入场
// ============================================================
function applyEntryAnim(params, animatorsGroup, startTime) {
    var entryAnim = animatorsGroup.addProperty("ADBE Text Animator");
    entryAnim.name = "歌词_入场";

    var entrySel = entryAnim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    var entrySE = findSelectorStartEnd(entrySel);
    if (!entrySE.start || !entrySE.end) {
        setStatus("错误: 找不到入场 Selector Start/End"); return false;
    }
    entrySE.end.setValue(100);

    if (params.entryMode === 0) {
        // 逐字出现：Start 从 0 → 100 扫描
        var ek1 = entrySE.start.addKey(startTime);
        entrySE.start.setValueAtKey(ek1, 0);
        var ek2 = entrySE.start.addKey(startTime + params.entryDur / params.speed);
        entrySE.start.setValueAtKey(ek2, 100);
    } else {
        // 一起出现：整个文字一起出现，用 Opacity 从 0→100 关键帧
        // Range Selector 始终覆盖全部字符
        entrySE.start.setValue(0);
        entrySE.end.setValue(100);
    }

    var entryProps = findAnimatorProps(entryAnim);
    if (!entryProps) { setStatus("错误: 找不到入场 Animator 属性组"); return false; }

    // Opacity
    var entryOpProp = addAnimProperty(entryProps, "ADBE Text Opacity");
    if (entryOpProp) {
        if (params.entryMode === 1) {
            // 一起出现：用 Opacity 关键帧控制淡入
            try { entryOpProp.setValue(0); } catch(e) {}
            var eok1 = entryOpProp.addKey(startTime);
            entryOpProp.setValueAtKey(eok1, 0);
            var eok2 = entryOpProp.addKey(startTime + params.entryDur / params.speed);
            entryOpProp.setValueAtKey(eok2, 100);
        } else {
            // 逐字出现：Opacity=0 配合 Range Selector 扫描
            try { entryOpProp.setValue(0); } catch(e) {}
        }
    }

    // Blur
    var entryBlurProp = addAnimProperty(entryProps, "ADBE Text Blur");
    if (entryBlurProp) {
        if (params.entryMode === 1) {
            // 一起出现：Blur 从最大值 → 0 关键帧
            setBlur(entryBlurProp, params.entryBlur);
            var ebk1 = entryBlurProp.addKey(startTime);
            setBlur(entryBlurProp, params.entryBlur, ebk1);
            var ebk2 = entryBlurProp.addKey(startTime + params.entryDur / params.speed);
            setBlur(entryBlurProp, 0, ebk2);
        } else {
            setBlur(entryBlurProp, params.entryBlur);
        }
    }

    // Position
    var entryPosProp = addAnimProperty(entryProps, "ADBE Text Position");
    if (entryPosProp) {
        var is3D = (entryPosProp.propertyValueType === PropertyValueType.ThreeD);
        var entryPosVal = getDirectionPos(params.entryOff, params.direction, is3D, false);
        if (params.entryMode === 1) {
            // 一起出现：Position 从偏移 → 0 关键帧
            try { entryPosProp.setValue(entryPosVal); } catch(e) {}
            var epk1 = entryPosProp.addKey(startTime);
            entryPosProp.setValueAtKey(epk1, entryPosVal);
            var epk2 = entryPosProp.addKey(startTime + params.entryDur / params.speed);
            entryPosProp.setValueAtKey(epk2, is3D ? [0,0,0] : [0,0]);
        } else {
            try { entryPosProp.setValue(entryPosVal); } catch(e) {}
        }
    }
    return true;
}

// ============================================================
// Animator 2: 出场
// ============================================================
function applyExitAnim(params, animatorsGroup, startTime) {
    var exitStartTime = params.exitStart;
    var exitEndTime   = exitStartTime + params.exitDur / params.speed;

    var exitAnim = animatorsGroup.addProperty("ADBE Text Animator");
    exitAnim.name = "歌词_出场";

    var exitSel = exitAnim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    var exitSE = findSelectorStartEnd(exitSel);
    if (!exitSE.start || !exitSE.end) {
        setStatus("错误: 找不到出场 Selector Start/End"); return false;
    }
    exitSE.end.setValue(100);

    if (params.exitMode === 0) {
        // 逐字消失：Start 从 100 → 0 扫描
        var xk1 = exitSE.start.addKey(startTime + exitStartTime);
        exitSE.start.setValueAtKey(xk1, 100);
        var xk2 = exitSE.start.addKey(startTime + exitEndTime);
        exitSE.start.setValueAtKey(xk2, 0);
    } else {
        // 一起消失：Range Selector 始终覆盖全部
        exitSE.start.setValue(0);
        exitSE.end.setValue(100);
    }

    var exitProps = findAnimatorProps(exitAnim);
    if (!exitProps) { setStatus("错误: 找不到出场 Animator 属性组"); return false; }

    // Opacity
    var exitOpProp = addAnimProperty(exitProps, "ADBE Text Opacity");
    if (exitOpProp) {
        if (params.exitMode === 1) {
            // 一起消失：Opacity 从 100 → 0 关键帧
            try { exitOpProp.setValue(100); } catch(e) {}
            var xok1 = exitOpProp.addKey(startTime + exitStartTime);
            exitOpProp.setValueAtKey(xok1, 100);
            var xok2 = exitOpProp.addKey(startTime + exitEndTime);
            exitOpProp.setValueAtKey(xok2, 0);
        } else {
            exitOpProp.setValue(0);
        }
    }

    // Blur
    var exitBlurProp = addAnimProperty(exitProps, "ADBE Text Blur");
    if (exitBlurProp) {
        if (params.exitMode === 1) {
            setBlur(exitBlurProp, 0);
            var xbk1 = exitBlurProp.addKey(startTime + exitStartTime);
            setBlur(exitBlurProp, 0, xbk1);
            var xbk2 = exitBlurProp.addKey(startTime + exitEndTime);
            setBlur(exitBlurProp, params.exitBlur, xbk2);
        } else {
            setBlur(exitBlurProp, params.exitBlur);
        }
    }

    // Position
    var exitPosProp = addAnimProperty(exitProps, "ADBE Text Position");
    if (exitPosProp) {
        var eis3D = (exitPosProp.propertyValueType === PropertyValueType.ThreeD);
        var exitPosVal = getDirectionPos(params.exitOff, params.direction, eis3D, true);
        if (params.exitMode === 1) {
            // 一起消失：Position 从 0 → 偏移 关键帧
            try { exitPosProp.setValue(eis3D ? [0,0,0] : [0,0]); } catch(e) {}
            var xpk1 = exitPosProp.addKey(startTime + exitStartTime);
            exitPosProp.setValueAtKey(xpk1, eis3D ? [0,0,0] : [0,0]);
            var xpk2 = exitPosProp.addKey(startTime + exitEndTime);
            exitPosProp.setValueAtKey(xpk2, exitPosVal);
        } else {
            exitPosProp.setValue(exitPosVal);
        }
    }
    return true;
}

// ============================================================
// Animator 3: 散落分布（逐字随机位置 + 随机大小 + 随机模糊 + 时间渐入）
// ============================================================
function applyScatterAnim(params, animatorsGroup, startTime, textLen) {
    for (var ci = 1; ci <= textLen; ci++) {
        var sProps = createPerCharAnimator(animatorsGroup, "歌词_散落", ci, textLen, null);
        if (!sProps) continue;

        // Position
        var sPos = addAnimProperty(sProps, "ADBE Text Position");
        if (sPos) {
            var posExpr = [
                buildScatterFadeExpr(params.seed, ci, startTime, params.scatterStart, params.scatterTrans),
                "r = " + params.scatterRange + ";",
                "[random(-r, r) * fade, random(-r, r) * fade]"
            ].join("\n");
            sPos.expressionEnabled = true;
            sPos.expression = posExpr;
        }

        // Scale
        var sScale = addAnimProperty(sProps, "ADBE Text Scale");
        if (sScale) {
            var scaleExpr = [
                "seedRandom(" + params.seed + " + " + ci + " + 9999, true);",
                "t = time - " + startTime.toFixed(3) + ";",
                "fade = linear(t, " + params.scatterStart.toFixed(3) + ", " + (params.scatterStart + params.scatterTrans).toFixed(3) + ", 0, 1);",
                "s = random(" + params.minScale + ", " + params.maxScale + ");",
                "base = 100;",
                "[base + (s - base) * fade, base + (s - base) * fade]"
            ].join("\n");
            sScale.expressionEnabled = true;
            sScale.expression = scaleExpr;
        }

        // 随机模糊
        if (params.blurProb > 0) {
            var sBlur = addAnimProperty(sProps, "ADBE Text Blur");
            if (sBlur) {
                var blurExpr = [
                    buildScatterFadeExpr(params.blurSeed, ci, startTime, params.scatterStart, params.scatterTrans),
                    "r = random(0, 100);",
                    "if (r < " + params.blurProb + ") {",
                    "    seedRandom(" + params.blurSeed + " + " + ci + " + 5555, true);",
                    "    v = random(" + params.blurMin + ", " + params.blurMax + ") * fade;",
                    "} else { v = 0; }",
                    "[v, v]"
                ].join("\n");
                sBlur.expressionEnabled = true;
                sBlur.expression = blurExpr;
            }
        }
    }
}

// ============================================================
// Animator 4: 高度错落（波浪浮动）
// ============================================================
function applyHeightAnim(params, animatorsGroup, textLen) {
    for (var ci = 1; ci <= textLen; ci++) {
        var hPos = createPerCharAnimator(animatorsGroup, "歌词_高度", ci, textLen, "ADBE Text Position");
        if (hPos) {
            var hExpr = [
                "amp = " + params.heightAmp + ";",
                "freq = " + params.heightFreq + ";",
                "[0, Math.sin(time * freq * 2 + " + ci + " * 0.8) * amp]"
            ].join("\n");
            hPos.expressionEnabled = true;
            hPos.expression = hExpr;
        }
    }
}

// ============================================================
// Animator 5: 字间距动态（逐字线性变化）
// ============================================================
function applySpacingAnim(params, animatorsGroup, startTime, textLen) {
    for (var ci = 1; ci <= textLen; ci++) {
        var spTrack = createPerCharAnimator(animatorsGroup, "歌词_字间距", ci, textLen, "ADBE Text Tracking Amount");
        if (spTrack) {
            var is2D = (spTrack.propertyValueType === PropertyValueType.TwoD);
            var spExpr = [
                "t = time - " + startTime.toFixed(3) + ";",
                "st = " + params.spacingStartTime.toFixed(3) + ";",
                "dur = " + params.spacingDur.toFixed(3) + ";",
                "s = " + params.spacingStartVal + ";",
                "e = " + params.spacingEndVal + ";",
                "v = linear(t, st, st + dur, s, e) * 0.1;",
                is2D ? "[v, v]" : "v"
            ].join("\n");
            spTrack.expressionEnabled = true;
            spTrack.expression = spExpr;
        }
    }
}

// ============================================================
// 应用动画
// ============================================================
function applyAnimation() {
    try {
        setStatus("执行中...");

        // ---- 读取参数 ----
        var params = readAnimParams();

        // ---- 验证选区 ----
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            setStatus("错误: 请先激活一个合成"); return;
        }
        var layer = comp.selectedLayers[0];
        if (!layer || !(layer instanceof TextLayer)) {
            setStatus("错误: 请选中一个文本图层"); return;
        }

        var startTime = comp.time;
        var animatorsGroup = findAnimatorsGroup(layer);
        if (!animatorsGroup) {
            setStatus("错误: 找不到文字动画器组"); return;
        }

        // 清除旧的歌词动画器
        removeLyricsAnimators(animatorsGroup);

        var textLen = getTextLen(layer);

        // ============================================================
        // Animator 1: 入场
        // ============================================================
        if (params.entryEnbl) {
            if (!applyEntryAnim(params, animatorsGroup, startTime)) return;
        }

        // ============================================================
        // Animator 2: 出场
        // ============================================================
        if (params.exitEnbl) {
            if (!applyExitAnim(params, animatorsGroup, startTime)) return;
        }

        // ============================================================
        // Animator 3: 散落分布（逐字随机位置 + 随机大小 + 随机模糊 + 时间渐入）
        // ============================================================
        if (params.scatterEnbl) {
            applyScatterAnim(params, animatorsGroup, startTime, textLen);
        }

        // ============================================================
        // Animator 4: 高度错落（波浪浮动）
        // ============================================================
        if (params.heightEnbl) {
            applyHeightAnim(params, animatorsGroup, textLen);
        }

        // ============================================================
        // Animator 5: 字间距动态（逐字线性变化）
        // ============================================================
        if (params.spacingEnbl) {
            applySpacingAnim(params, animatorsGroup, startTime, textLen);
        }

        // ============================================================
        // 完成
        // ============================================================
        var dirNames = ["左→右", "右→左", "上→下", "下→上"];
        var dirName = dirNames[params.direction] || "左→右";
        var parts = [];
        if (params.entryEnbl) parts.push("入场" + (params.entryDur / params.speed).toFixed(1) + "s(" + dirName + ")");
        if (params.exitEnbl) parts.push("出场" + params.exitStart.toFixed(1) + "-" + (params.exitStart + params.exitDur / params.speed).toFixed(1) + "s");
        if (params.scatterEnbl) parts.push("散落" + textLen + "字符");
        if (params.heightEnbl) parts.push("波浪");
        if (params.spacingEnbl) parts.push("字间距" + params.spacingStartVal + "→" + params.spacingEndVal);
        var msg = parts.length > 0 ? parts.join(" ") : "无动画（全部关闭）";
        setStatus("完成! " + msg);
        $.writeln("歌词散落动画v3.5已应用成功: " + msg);

    } catch (err) {
        var errLine = err.line || err.lineNumber || "?";
        var errMsg = err.toString() + " (行" + errLine + ")";
        setStatus("出错: " + errMsg);
        $.writeln("歌词动画出错: " + err.toString() + " line:" + errLine);
    }
}

// ---- 绑定按钮 ----
applyBtn.onClick = function() { applyAnimation(); };
clearBtn.onClick = function() { clearAnimators(); };

// ---- 打开/刷新面板 ----
pal.layout.layout(true);
pal.onResizing = pal.onResize = function () { this.layout.resize(); };
if (pal instanceof Window) {
    pal.center();
    pal.show();
}
try { updateLoadButtons(); } catch (e) {}

})(this);
