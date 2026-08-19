// ============================================================
// QuickKey · 节点式 K 帧排程面板  QuickKey.jsx
// 版本: 0.3.6  (2026-08-19)
// 适用: After Effects CC 2015.3+ (依赖 selectedProperties API)
//
// 以当前时间指示器为锚点,按节点排程给选中属性批量打关键帧;
// 曲线功能为每段套 cubic-bezier 缓动;预设可导出/导入 JSON。
//
// 代码地图(用函数名定位,行号会随编辑漂移):
//   纯逻辑层(node 可测,test_quickkey.js 158 断言):
//     排程: anchorPos / computeTimes / classifyValue / buildPlan / planHasExplicit
//     曲线: matchPreset / curveSegments / mergePresets / validatePresets /
//            isLinearPreset / bezierToEase / valDiff / valSignedDiff(v0.3.7)
//     迷你 JSON(ES3 自包含,勿依赖全局 JSON): stringifyPresets /
//            parsePresetsText / extractPresetsFallback
//     全参数预设(v0.3.5): collectParams / applyParamsToState / decodeOn·
//            decodeNums·decodeVal·decodeSeg / jsonStringify / stringifyConfig /
//            parseConfigText / extractParamsFromBlock / extractSlotsFallback
//   预检层(AE 依赖): propDimCore / propDimOf / easeDimOf / propTypeName /
//            propLayerInfo / dimCheck / failDimCheck
//   公共辅助: withUndo / perProp / setStatus / propName / errMsg
//   执行层: setKeyAt / applySegCurves / executePlan / buildReport /
//            applyExpression / doKey / exportPresets / importPresets
//   UI 层(v0.3.0 重组):
//     公共: showReport(调试弹窗)/ makeRowPool(行池工厂)/
//           bindNumTab·focusNextNum(Tab 数字框循环)
//     构建: buildHeader(节点数/模式/数值类型/表达式)/
//           buildNodeArea(节点行池)/ buildCurveArea(曲线开关+段行池)/
//           buildPresetArea(预设管理:存储/使用/复位/清除/导出配置/导入配置)/
//           buildFooter(打帧/调试按钮+状态栏)
//     刷新: refresh = refreshHeader + refreshNodes + refreshCurve
//     曲线: syncSegDropdown / rebuildPresetDropdowns
//     预设持久化(v0.3.5): saveSlot / loadSlot / clearAllPresets / resetParams /
//           exportConfig / importConfig / loadSlotsFromStorage /
//           getProjectPresetFile · read·write·deleteProjectFile /
//           read·write·deleteSlotFromSettings / updatePresetButtons
//
// 关键设计(改代码前必读,详见 AGENTS.md / DEVELOPMENT.md):
//   - 间隔 = 与「靠锚点侧最近开启节点」的帧距;关闭节点完全剔除
//   - 曲线段 = 开启节点的相邻对;总开关常驻可见,段行区随开关显隐
//   - 维度判断:变换属性以图层 threeDLayer 开关为准(AE 2026 的 2D 变换
//     属性 value/propertyValueType 都报 3D,勿用这两者判断)
//   - 曲线套用(v0.2.12 重写 / 0.2.14 修线性端点 / 0.2.15 端点平滑):
//     打帧用 setKeyAt(addKey 创建即得索引);逐段 bezierToEase → 逐帧先转
//     BEZIER 插值再 setTemporalEaseAtKey(缓动参数是【数组】,长度按
//     easeDimOf 官方规则:SPATIAL=1、缩放按值维度);线性段端点 = 段平均速度
//     (线性=匀速,严禁速度 0);平滑模式首/末帧速度归零;帧两侧段都线性才跳过
//   - ExtendScript 雷区:禁写含双反斜杠的正则字面量(语法错误);
//     对象属性名禁用 ES3 保留字(如 in);JSON 非原生内置,必须用自带迷你 JSON
//   - 全参数预设(v0.3.5):4 槽位 + 双层持久化(工程 quickkey_配置.json 读优先
//     + app.settings 保底);载入/复位走「改 state → refresh → layout」单向流;
//     参数扁平化编码让手写 JSON 兜底解析可行;槽位空 = {} 而非 null
//   - 打帧目标 = selectedProperties;整次操作一个 Undo 组(Ctrl+Z 整体撤销)
//   - Tab 键只在数字输入框之间循环(v0.2.7)
//   - KeyframeEase influence 合法范围 [0.1..100](v0.2.8)
//   - bezier→AE 映射公式(v0.2.9,社区公认):X→影响、Y→速度
//
// 安装:免安装,文件部署到用户级目录
//   %APPDATA%\Adobe\After Effects\<ver>\Scripts\ScriptUI Panels\
//   (本仓库统一用 install.py 部署,自动补 UTF-8 BOM + 字节校验)
// 历史版本记录 → CHANGELOG.md;架构与坑 → DEVELOPMENT.md / AGENTS.md
// ============================================================

(function (thisObj) {

    // ---------- 常量 ----------
    var MODE_NAMES = ["起始帧", "中间帧", "末尾帧"];
    var VTYPE_NAMES = ["1 个空", "2 个空", "3 个空", "表达式"];
    var MAX_COUNT = 30;   // 节点数上限(防面板撑爆)

    // 内置曲线预设(cubic-bezier):线性 / 缓入 / 缓出 / 缓入缓出
    // (v0.3.10 回退:v0.3.6 曾加 5 个 cubic 英文预设,用户确认不需要,回到默认 4 个中文)
    var PRESETS_DEFAULT = [
        {name: "线性",     x1: 0,    y1: 0,    x2: 1,    y2: 1},
        {name: "缓入",     x1: 0.42, y1: 0,    x2: 1,    y2: 1},
        {name: "缓出",     x1: 0,    y1: 0,    x2: 0.58, y2: 1},
        {name: "缓入缓出", x1: 0.42, y1: 0,    x2: 0.58, y2: 1}
    ];

    // 锚点槽位:起始 = 1,中间 = ⌈N/2⌉,末尾 = N(v0.1.4 起随 N 动态)
    function anchorPos(mode, n) {
        if (mode === 0) { return 1; }
        if (mode === 1) { return Math.ceil(n / 2); }
        return n;
    }

    // ---------- 状态 ----------
    var curvePresetsInit = [];
    for (var cpi = 0; cpi < PRESETS_DEFAULT.length; cpi++) {
        curvePresetsInit.push(clonePreset(PRESETS_DEFAULT[cpi]));
    }

    var state = {
        mode: 0,                       // 0=起始 1=中间 2=末尾
        count: 3,                      // 节点数(1~30,默认 3)
        vtype: 0,                      // 数值类型 0=1空 1=2空 2=3空 3=表达式
        expr: "",                      // 表达式内容(表达式模式)
        on:  {1: true, 2: true, 3: true, 4: false, 5: false},  // 槽位开关(锚点恒开)
        gap: {1: 5, 2: 5, 3: 5, 4: 5, 5: 5},                   // 槽位间隔(帧)
        val: {                                 // 槽位数值:每空一格,数组长度 3(v0.1.7)
            1: ["", "", ""], 2: ["", "", ""], 3: ["", "", ""],
            4: ["", "", ""], 5: ["", "", ""]
        },
        curve: {                         // 曲线功能(v0.2.0)
            enabled: false,              // 总开关
            smoothEnd: false,            // 端点平滑(v0.2.15):首帧/末帧速度归零,两端圆润
            presets: curvePresetsInit,   // 预设列表(内置 + 导入,同名覆盖)
            seg: {}                      // 段 1..n: {preset, x1, y1, x2, y2}
        },
        slots: {}                        // 预设槽位 1..4 → 扁平参数(v0.3.5,内存缓存)
    };
    var lastReport = "";               // 上次执行报告(调试按钮弹出)

    // 扩缩容:只补齐新槽位默认值,已有槽位数值保留
    function resizeState(n) {
        for (var i = 1; i <= n; i++) {
            if (state.on[i] === undefined) { state.on[i] = true; }
            if (state.gap[i] === undefined) { state.gap[i] = 5; }
            if (state.val[i] === undefined || !(state.val[i] instanceof Array)) {
                state.val[i] = ["", "", ""];
            }
        }
    }

    // 曲线段状态:按段序号补齐(默认线性),已有值保留
    function ensureCurveSeg(i) {
        if (!state.curve.seg[i]) {
            state.curve.seg[i] = {preset: "线性", x1: 0, y1: 0, x2: 1, y2: 1};
        }
        return state.curve.seg[i];
    }

    // ===== 纯逻辑层(不依赖 AE,node 可测)=====

    function fmtFrames(n) {
        return (n >= 0 ? "+" : "") + n + " 帧";
    }

    function describeVal(v) {
        if (v === null || v === undefined) { return "当前值"; }
        if (v instanceof Array) { return v.join(", "); }
        return String(v);
    }

    // 计算各槽位相对当前时间指示器的帧偏移(锚点 = 0)
    // 间隔语义:每个节点自己的 gap = 与"靠锚点一侧最近开启节点(或锚点)"的帧距
    //   下方节点:t[i] = 最近开启上一节点时间 + gap[i]
    //   上方节点:t[i] = 最近开启下一节点时间 - gap[i]
    // 关闭节点返回 null:不打帧、不占位、不参与后续计算(v0.1.3)
    function computeTimes(mode, gap, on, n) {
        var a = anchorPos(mode, n);
        var t = {};
        for (var i = 1; i <= n; i++) { t[i] = null; }
        t[a] = 0;
        var prev = a;
        for (var i = a + 1; i <= n; i++) {
            if (on[i]) { t[i] = t[prev] + gap[i]; prev = i; }
        }
        var next = a;
        for (var i = a - 1; i >= 1; i--) {
            if (on[i]) { t[i] = t[next] - gap[i]; next = i; }
        }
        return t;
    }

    // 执行归类:cells = 每空一格字符串数组,直接读格子,无逗号拼接
    //   empty:全部留空 → 用属性当前值
    //   fixed:全部填好 → 数字(1 空)或数组(2/3 空)
    //   bad:部分填写 / 非法字符 / 框内逗号 → 可见跳过(报告写明)
    function classifyValue(cells, dim) {
        var filled = [];
        var empty = 0;
        for (var i = 0; i < dim; i++) {
            var cell = String(cells[i] || "").replace(/\s/g, "");
            if (cell === "") { empty++; filled.push(null); }
            else {
                if (cell.indexOf(",") >= 0) { return {kind: "bad"}; }  // 单框内逗号 → 用对应空数模式
                var n = parseFloat(cell);
                if (isNaN(n)) { return {kind: "bad"}; }
                filled.push(n);
            }
        }
        if (empty === dim) { return {kind: "empty"}; }
        if (empty > 0) { return {kind: "bad"}; }   // 部分填写 → 可见跳过
        return {kind: "fixed", value: (dim === 1) ? filled[0] : filled};
    }

    // 格子数组 → 显示用 raw:去掉尾部空格(",," → "";"100,," → "100")
    function cellsRaw(cells) {
        var end = cells.length;
        while (end > 0 && String(cells[end - 1] || "").replace(/\s/g, "") === "") { end--; }
        var parts = [];
        for (var i = 0; i < end; i++) { parts.push(cells[i]); }
        return parts.join(",");
    }

    // 生成执行计划(v0.1.14 重构,纯函数):每节点 → {slot, isAnchor, closed, offset, kind, value, raw}
    //   closed=true 的节点不打帧;offset 为相对指示器帧偏移;kind/value 来自 classifyValue
    function buildPlan(mode, count, gap, on, val, dim) {
        var times = computeTimes(mode, gap, on, count);
        var anchor = anchorPos(mode, count);
        var plan = [];
        for (var s = 1; s <= count; s++) {
            var isAnchor = (s === anchor);
            if (!isAnchor && !on[s]) {
                plan.push({slot: s, isAnchor: false, closed: true, offset: null, kind: null, value: null, raw: ""});
                continue;
            }
            var cls = classifyValue(val[s], dim);
            plan.push({
                slot: s,
                isAnchor: isAnchor,
                closed: false,
                offset: times[s],
                kind: cls.kind,
                value: (cls.value === undefined) ? null : cls.value,
                raw: cellsRaw(val[s])
            });
        }
        return plan;
    }

    // 计划里是否有显式数值(有才需要做位数预检)
    function planHasExplicit(plan) {
        for (var i = 0; i < plan.length; i++) {
            if (!plan[i].closed && plan[i].kind === "fixed") { return true; }
        }
        return false;
    }

    // ===== 曲线纯函数(v0.2.0,node 可测)=====

    function clonePreset(p) {
        return {name: p.name, x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2};
    }

    // 线性判定(0 0 1 1 = 匀速)
    function isLinearPreset(x1, y1, x2, y2) {
        return x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1;
    }

    // bezier→AE 缓动转换(社区公认公式,v0.2.9 三方交叉验证,集中一处便于维护):
    //   X 坐标→影响(x1×100、[1−x2]×100,钳 0.1~100 并四舍五入 1 位)
    //   Y 坐标→速度(y1×avg/x1、[1−y2]×avg/[1−x2];x=0 / x2=1 除零退 avg)
    //   线性(0 0 1 1)→ null(两侧用中性缓动,保持 AE 默认线性)
    // avg = 该段平均速度(值/秒)。返回 {out:{speed,influence}, inE:{speed,influence}} 或 null
    // 注意:属性名不能用 in(in 是 ES3 保留字,ExtendScript 报「非法使用保留字」;
    // node 现代引擎允许,node --check 拦不住——v0.2.13 真机踩坑)
    function bezierToEase(x1, y1, x2, y2, avg) {
        if (isLinearPreset(x1, y1, x2, y2)) { return null; }
        var inflOut = Math.round(Math.max(0.1, Math.min(100, x1 * 100)) * 10) / 10;
        var spdOut = (x1 > 0.0001) ? y1 * avg / x1 : avg;
        var inflIn = Math.round(Math.max(0.1, Math.min(100, (1 - x2) * 100)) * 10) / 10;
        var spdIn = (x2 < 0.9999) ? (1 - y2) * avg / (1 - x2) : avg;
        return {
            out: {speed: spdOut, influence: inflOut},
            inE: {speed: spdIn, influence: inflIn}
        };
    }

    // 精确匹配预设(浮点容差 1e-4),命中返回下标,否则 -1
    function matchPreset(presets, x1, y1, x2, y2) {
        for (var i = 0; i < presets.length; i++) {
            var p = presets[i];
            if (Math.abs(p.x1 - x1) < 0.0001 && Math.abs(p.y1 - y1) < 0.0001
                && Math.abs(p.x2 - x2) < 0.0001 && Math.abs(p.y2 - y2) < 0.0001) {
                return i;
            }
        }
        return -1;
    }

    // 曲线段 = 开启节点的相邻对([[s1,s2], [s2,s3], ...]);关闭节点断开链条
    // (关闭剔除语义的自然延伸:5 节点全开 = 4 段,关掉节点2 → [1,3] 直接成段)
    function curveSegments(on, count) {
        var open = [];
        for (var s = 1; s <= count; s++) {
            if (on[s]) { open.push(s); }
        }
        var segs = [];
        for (var i = 1; i < open.length; i++) {
            segs.push([open[i - 1], open[i]]);
        }
        return segs;
    }

    // 合并预设:同名(name)覆盖,新名追加;不修改原数组(深拷贝返回)
    function mergePresets(existing, imported) {
        var out = [];
        for (var i = 0; i < existing.length; i++) { out.push(clonePreset(existing[i])); }
        for (var j = 0; j < imported.length; j++) {
            var imp = imported[j];
            var found = -1;
            for (var k = 0; k < out.length; k++) {
                if (out[k].name === imp.name) { found = k; break; }
            }
            if (found >= 0) { out[found] = clonePreset(imp); }
            else { out.push(clonePreset(imp)); }
        }
        return out;
    }

    // 校验导入数据(data = JSON.parse 结果):
    //   接受 {presets:[...]} 或裸数组;过滤非法项(name 非空字符串、
    //   4 数均为数字、x1/x2 在 0~1);格式完全不对返回 null
    function validatePresets(data) {
        var arr = (data && data.presets instanceof Array) ? data.presets
                : (data instanceof Array ? data : null);
        if (!arr) { return null; }
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var p = arr[i];
            if (!p || typeof p.name !== "string" || !p.name) { continue; }
            var x1 = Number(p.x1), y1 = Number(p.y1), x2 = Number(p.x2), y2 = Number(p.y2);
            if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) { continue; }
            if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) { continue; }   // bezier x 限 0~1
            out.push({name: p.name, x1: x1, y1: y1, x2: x2, y2: y2});
        }
        return out;
    }

    // 数值差(标量,供曲线速度计算):数字直接差;数组取各维最大绝对差
    function valDiff(a, b) {
        if (typeof a === "number" && typeof b === "number") { return Math.abs(a - b); }
        if (a instanceof Array && b instanceof Array && a.length === b.length) {
            var mx = 0;
            for (var i = 0; i < a.length; i++) {
                var d = Math.abs(a[i] - b[i]);
                if (d > mx) { mx = d; }
            }
            return mx;
        }
        return 0;
    }

    // 带符号的值差(v0.3.7,修复值减少时曲线方向反):
    //   valDiff 返回绝对值 → avg 恒 ≥ 0 → bezierToEase 速度恒正;
    //   AE 的 KeyframeEase.speed 是带符号浮点(官方文档无正负限制,
    //   Keyframe Velocity 面板值减少时显示负速度,官方表达式 velocity
    //   也按运动方向返回负值)——值 100→0 时真实速度应为 -100。
    //   数字 → a - b(带符号);数组 → 取"最大绝对差分量"的带符号差
    //   (与 valDiff 的"最大分量差"语义对称,单轴变化完全正确);其他 → 0
    function valSignedDiff(a, b) {
        if (typeof a === "number" && typeof b === "number") { return a - b; }
        if (a instanceof Array && b instanceof Array && a.length === b.length) {
            var mxAbs = 0;
            var sign = 0;
            for (var i = 0; i < a.length; i++) {
                var d = a[i] - b[i];
                var ad = Math.abs(d);
                if (ad > mxAbs) { mxAbs = ad; sign = d; }
            }
            return sign;
        }
        return 0;
    }

    // ===== 迷你 JSON(v0.2.1,ES3 自包含)=====
    // ExtendScript 不原生内置 JSON(ECMA-262 v3;社区定论:依赖全局 JSON 会因
    // 环境而异——有的机器只有开了 Adobe Libraries 面板才有泄漏的 JSON 对象)。
    // 这里针对本插件固定格式 {version:1, presets:[{name,x1,y1,x2,y2}]} 提供
    // 序列化与解析:零外部依赖、零正则字面量(规避 ExtendScript 解析器风险)。
    // 导出的文本是标准 JSON,任何编辑器/工具都能读;导入优先用全局 JSON,
    // 没有则退回手写提取。

    function jsonStr(s) {
        var out = '"';
        for (var i = 0; i < s.length; i++) {
            var c = s[i];
            if (c === '"') { out += '\\"'; }
            else if (c === "\\") { out += "\\\\"; }
            else if (c === "\n") { out += "\\n"; }
            else if (c === "\r") { out += "\\r"; }
            else if (c === "\t") { out += "\\t"; }
            else { out += c; }
        }
        return out + '"';
    }

    function jsonNum(n) {
        if (typeof n !== "number" || isNaN(n) || !isFinite(n)) { return "0"; }
        return String(n);
    }

    // 内置预设名判断(v0.3.9,导出分组用:内置一组、导入一组,组间空行)
    function isBuiltinPresetName(n) {
        for (var i = 0; i < PRESETS_DEFAULT.length; i++) {
            if (PRESETS_DEFAULT[i].name === n) { return true; }
        }
        return false;
    }

    // 预设列表格式化(v0.3.9):每条预设单行(名称 + 4 数值),内置/导入组间空行。
    // 返回 "presets" 数组内部的文本行(缩进 4 空格),供 stringifyPresets /
    // stringifyConfig 复用——保证两份导出里预设段的格式一致
    function presetBodyLines(presets) {
        var lines = [];
        var lastB = true;
        for (var i = 0; i < presets.length; i++) {
            var p = presets[i];
            var isB = isBuiltinPresetName(String(p.name));
            if (i > 0 && lastB && !isB) { lines.push(""); }   // 内置 → 导入,空行分段
            lastB = isB;
            var line = '    { "name": ' + jsonStr(String(p.name))
                + ', "x1": ' + jsonNum(p.x1)
                + ', "y1": ' + jsonNum(p.y1)
                + ', "x2": ' + jsonNum(p.x2)
                + ', "y2": ' + jsonNum(p.y2) + ' }';
            if (i < presets.length - 1) { line += ","; }      // 元素间逗号(标准 JSON)
            lines.push(line);
        }
        return lines;
    }

    // presets 数组 → 标准 JSON 文本(v0.3.9 可读性优化):
    //   每条单行、内置/导入组间空行、顶层 _comment 字段说明含义。
    //   仍是标准 JSON(node/JSON.parse 可直接读),解析端忽略 _comment;
    //   用户可直接编辑该文件后重新导入(同名覆盖、新名追加)
    function stringifyPresets(presets) {
        var body = presetBodyLines(presets).join("\n");
        if (body === "") { body = "  "; }
        return '{\n'
            + '  "version": 1,\n'
            + '  "_comment": ' + jsonStr("QuickKey 曲线预设文件:每条 = name / x1 / y1 / x2 / y2,"
                + "为 cubic-bezier 缓动控制点(x1/y1 起点手柄、x2/y2 终点手柄;线性 = 0 0 1 1)。"
                + "可直接编辑后重新导入,同名覆盖、新名追加。") + ',\n'
            + '  "presets": [\n' + body + '\n  ]\n}';
    }

    // 在 "{...}" 块内提取字符串键值(name):返回解码后的字符串,找不到返回 null
    // 解码用逐字符扫描(不写正则字面量,规避 ExtendScript 解析器风险)
    function grabStr(block, key) {
        var q = '"' + key + '"';
        var p = block.indexOf(q);
        if (p < 0) { return null; }
        p = block.indexOf('"', p + q.length);
        if (p < 0) { return null; }
        p++;
        var e = block.indexOf('"', p);
        if (e < 0) { return null; }
        var raw = block.substring(p, e);
        var out = "";
        for (var k = 0; k < raw.length; k++) {
            var c = raw[k];
            if (c === "\\" && k + 1 < raw.length) {
                var c2 = raw[k + 1];
                if (c2 === '"') { out += '"'; k++; }
                else if (c2 === "\\") { out += "\\"; k++; }
                else if (c2 === "n") { out += "\n"; k++; }
                else if (c2 === "r") { out += "\r"; k++; }
                else if (c2 === "t") { out += "\t"; k++; }
                else { out += c; }
            } else { out += c; }
        }
        return out;
    }

    // 在 "{...}" 块内提取数字键值:跳过空白与冒号后读数字,找不到/非法返回 null
    function grabNum(block, key) {
        var q = '"' + key + '"';
        var p = block.indexOf(q);
        if (p < 0) { return null; }
        var rest = block.substring(p + q.length);
        var j = 0;
        while (j < rest.length && (rest[j] === " " || rest[j] === "\t"
                || rest[j] === "\n" || rest[j] === "\r" || rest[j] === ":")) { j++; }
        var start = j;
        while (j < rest.length && ((rest[j] >= "0" && rest[j] <= "9")
                || rest[j] === "." || rest[j] === "-" || rest[j] === "+"
                || rest[j] === "e" || rest[j] === "E")) { j++; }
        if (j === start) { return null; }
        var n = parseFloat(rest.substring(start, j));
        return isNaN(n) ? null : n;
    }

    // 手写提取(全局 JSON 不存在时的回退):扫描每个 "{...}" 块,校验字段
    function extractPresetsFallback(txt) {
        var out = [];
        var i = 0;
        var len = txt.length;
        while (i < len) {
            var s = txt.indexOf("{", i);
            if (s < 0) { break; }
            var e = txt.indexOf("}", s);
            if (e < 0) { break; }
            var block = txt.substring(s + 1, e);
            i = e + 1;
            var name = grabStr(block, "name");
            var x1 = grabNum(block, "x1");
            var y1 = grabNum(block, "y1");
            var x2 = grabNum(block, "x2");
            var y2 = grabNum(block, "y2");
            if (name !== null && name !== "" && x1 !== null && y1 !== null
                && x2 !== null && y2 !== null && x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1) {
                out.push({name: name, x1: x1, y1: y1, x2: x2, y2: y2});
            }
        }
        return out.length > 0 ? out : null;
    }

    // 导入入口:优先全局 JSON.parse(标准严谨),失败/不可用退回手写提取
    function parsePresetsText(txt) {
        try {
            if (typeof JSON !== "undefined" && JSON.parse) {
                var d = JSON.parse(txt);
                var v = validatePresets(d);
                if (v !== null && v.length > 0) { return v; }
            }
        } catch (e) {}
        return extractPresetsFallback(txt);
    }

    // ===== 全参数预设(v0.3.5,纯逻辑层,node 可测)=====
    // 对齐 AE-Lyrics-Animator / AE-Rolling-Lyrics / AE-Water-Rise-Generator 的
    // 4 槽位 + 双层持久化方案;QuickKey 参数集中在 state,收集/回填直接操作
    // state(单向流),比从 UI 控件读更可靠。
    //
    // 参数扁平化编码(槽位与配置文件共用):
    //   on       = "110"       槽位 1..count 开关串(1=开 0=关)
    //   gap      = "5,5,5"     槽位间隔,逗号分隔
    //   val      = "50,,|,,"   每槽位 3 格逗号分隔,槽位间 | 分隔(空串=留空)
    //   curveSeg = "线性,0,0,1,1|缓入,0.42,0,1,1"  段间 |、字段逗号(名,x1,y1,x2,y2)
    // 配置文件 = {version, ...参数, presets 曲线库, slots[4](空槽位 = {})}

    function splitBy(s, sep) {
        var out = [];
        var cur = "";
        for (var i = 0; i < s.length; i++) {
            if (s[i] === sep) { out.push(cur); cur = ""; }
            else { cur += s[i]; }
        }
        out.push(cur);
        return out;
    }

    // 收集当前 state 的全部参数 → 扁平对象(深拷贝语义)
    function collectParams(state) {
        var on = "";
        var gaps = [];
        var vals = [];
        for (var i = 1; i <= state.count; i++) {
            on += (state.on[i] !== false) ? "1" : "0";
            gaps.push(String(state.gap[i] !== undefined ? state.gap[i] : 5));
            var v = state.val[i];
            var cells = [];
            for (var k = 0; k < 3; k++) {
                cells.push((v && v[k] !== undefined) ? String(v[k]) : "");
            }
            vals.push(cells.join(","));
        }
        var segParts = [];
        var segList = curveSegments(state.on, state.count);
        for (var j = 0; j < segList.length; j++) {
            var seg = state.curve.seg[j + 1];
            if (seg) {
                segParts.push((seg.preset || "自定义") + "," + seg.x1 + "," + seg.y1
                    + "," + seg.x2 + "," + seg.y2);
            } else {
                segParts.push("线性,0,0,1,1");
            }
        }
        return {
            mode: state.mode,
            count: state.count,
            vtype: state.vtype,
            expr: state.expr,
            on: on,
            gap: gaps.join(","),
            val: vals.join("|"),
            curveEnabled: state.curve.enabled ? 1 : 0,
            curveSmoothEnd: state.curve.smoothEnd ? 1 : 0,
            curveSeg: segParts.join("|")
        };
    }

    function decodeOn(str, n) {
        var on = {};
        var has = (typeof str === "string");
        for (var i = 1; i <= n; i++) {
            on[i] = has ? (str[i - 1] === "1") : true;
        }
        return on;
    }

    function decodeNums(str, n, def) {
        var arr = (typeof str === "string" && str !== "") ? splitBy(str, ",") : [];
        var out = {};
        for (var i = 1; i <= n; i++) {
            var raw = (i <= arr.length) ? parseFloat(arr[i - 1]) : NaN;
            out[i] = isNaN(raw) ? def : raw;
        }
        return out;
    }

    function decodeVal(str, n) {
        var parts = (typeof str === "string" && str !== "") ? splitBy(str, "|") : [];
        var out = {};
        for (var i = 1; i <= n; i++) {
            var cells = (i <= parts.length) ? splitBy(parts[i - 1], ",") : [];
            var arr = [];
            for (var k = 0; k < 3; k++) { arr.push(k < cells.length ? cells[k] : ""); }
            out[i] = arr;
        }
        return out;
    }

    function decodeSeg(str) {
        var parts = (typeof str === "string" && str !== "") ? splitBy(str, "|") : [];
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            var f = splitBy(parts[i], ",");
            if (f.length >= 5) {
                var x1 = parseFloat(f[1]), y1 = parseFloat(f[2]);
                var x2 = parseFloat(f[3]), y2 = parseFloat(f[4]);
                out.push({preset: f[0],
                    x1: isNaN(x1) ? 0 : x1, y1: isNaN(y1) ? 0 : y1,
                    x2: isNaN(x2) ? 1 : x2, y2: isNaN(y2) ? 1 : y2});
            }
        }
        return out;
    }

    function clampInt(v, def, lo, hi) {
        var n = parseInt(v, 10);
        if (isNaN(n)) { return def; }
        return Math.max(lo, Math.min(hi, n));
    }

    // 扁平参数 → 写回 state(缺失字段回退默认,兼容旧配置/空槽位)
    function applyParamsToState(state, p) {
        if (!p || typeof p !== "object") { return false; }
        state.mode = clampInt(p.mode, 0, 0, 2);
        state.count = clampInt(p.count, 3, 1, 30);
        state.vtype = clampInt(p.vtype, 0, 0, 3);
        state.expr = (typeof p.expr === "string") ? p.expr : "";
        var onMap = decodeOn(p.on, 30);
        var gaps = decodeNums(p.gap, 30, 5);
        var vals = decodeVal(p.val, 30);
        for (var i = 1; i <= 30; i++) {
            state.on[i] = onMap[i];
            state.gap[i] = gaps[i];
            state.val[i] = vals[i];
        }
        state.curve.enabled = (clampInt(p.curveEnabled, 0, 0, 1) === 1);
        state.curve.smoothEnd = (clampInt(p.curveSmoothEnd, 0, 0, 1) === 1);
        var segs = decodeSeg(p.curveSeg);
        state.curve.seg = {};
        for (var j = 0; j < segs.length; j++) { state.curve.seg[j + 1] = segs[j]; }
        return true;
    }

    // 通用 JSON 序列化(紧凑,零正则字面量;node 可验证标准性)
    function jsonStringify(obj) {
        var t = typeof obj;
        if (obj === null) { return "null"; }
        if (t === "number") { return jsonNum(obj); }
        if (t === "boolean") { return obj ? "true" : "false"; }
        if (t === "string") { return jsonStr(obj); }
        if (obj instanceof Array) {
            var a = [];
            for (var i = 0; i < obj.length; i++) { a.push(jsonStringify(obj[i])); }
            return "[" + a.join(",") + "]";
        }
        if (t === "object") {
            var out = [];
            for (var k in obj) {
                if (obj.hasOwnProperty(k) && obj[k] !== undefined) {
                    out.push(jsonStr(k) + ":" + jsonStringify(obj[k]));
                }
            }
            return "{" + out.join(",") + "}";
        }
        return "null";
    }

    // 配置对象 → JSON 文本(v0.3.9 可读性优化:分段 + 单行对象 + _comment 备注)。
    // 当前参数一行一个、曲线库单行+分组、槽位单行;仍是标准 JSON(解析端忽略
    // _comment),用户可直接编辑后重新导入(导入 = 应用参数 + 合并曲线库 + 载入槽位)
    function stringifyConfig(params, presets, slots) {
        var out = [];
        out.push('{\n  "version": 1,');
        out.push('  "_comment": ' + jsonStr("QuickKey 全参数配置:当前面板全部参数 + 曲线预设库 + 4 个槽位,"
            + "导入后完整还原。参数含义:mode 模式(0 起始/1 中间/2 末尾)、count 节点数、"
            + "vtype 数值类型、expr 表达式、on 节点开关串、gap 间隔(帧)、val 节点数值、"
            + "curveEnabled 曲线总开关、curveSmoothEnd 端点平滑、curveSeg 曲线段。"
            + "可直接编辑后重新导入。") + ',');
        var keys = ["mode", "count", "vtype", "expr", "on", "gap", "val",
                    "curveEnabled", "curveSmoothEnd", "curveSeg"];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (params.hasOwnProperty(k) && params[k] !== undefined) {
                out.push('  ' + jsonStr(k) + ': ' + jsonStringify(params[k]) + ',');
            }
        }
        var pbody = presetBodyLines(presets || []).join("\n");
        if (pbody === "") { pbody = "    "; }
        out.push('  "presets": [\n' + pbody + '\n  ],');
        out.push('  "slots": [');
        var sarr = slots || [{}, {}, {}, {}];
        for (var s = 0; s < 4; s++) {
            out.push('    ' + jsonStringify(sarr[s]) + (s < 3 ? "," : ""));
        }
        out.push('  ]\n}');
        return out.join("\n");
    }

    // 从文本块提取扁平参数(手写兜底用;无任何字段返回 null = 空槽位)
    function extractParamsFromBlock(block) {
        var p = {};
        var m = grabNum(block, "mode"); if (m !== null) { p.mode = m; }
        m = grabNum(block, "count"); if (m !== null) { p.count = m; }
        m = grabNum(block, "vtype"); if (m !== null) { p.vtype = m; }
        m = grabNum(block, "curveEnabled"); if (m !== null) { p.curveEnabled = m; }
        m = grabNum(block, "curveSmoothEnd"); if (m !== null) { p.curveSmoothEnd = m; }
        var s = grabStr(block, "expr"); if (s !== null) { p.expr = s; }
        s = grabStr(block, "on"); if (s !== null) { p.on = s; }
        s = grabStr(block, "gap"); if (s !== null) { p.gap = s; }
        s = grabStr(block, "val"); if (s !== null) { p.val = s; }
        s = grabStr(block, "curveSeg"); if (s !== null) { p.curveSeg = s; }
        var any = false;
        for (var k in p) { any = true; break; }
        return any ? p : null;
    }

    // 手写提取 slots 数组(按 {..} 块顺序 = 槽位 1-4,空槽位 {} 返回 {})
    function extractSlotsFallback(txt) {
        var slots = [{}, {}, {}, {}];
        var q = '"slots"';
        var p = txt.indexOf(q);
        if (p < 0) { return slots; }
        p = txt.indexOf("[", p + q.length);
        if (p < 0) { return slots; }
        var e = txt.lastIndexOf("]");
        if (e < 0 || e < p) { return slots; }
        var body = txt.substring(p + 1, e);
        var idx = 0;
        var i = 0;
        while (i < body.length && idx < 4) {
            var ns = body.indexOf("{", i);
            if (ns < 0) { break; }
            var ne = body.indexOf("}", ns);
            if (ne < 0) { break; }
            var prm = extractParamsFromBlock(body.substring(ns + 1, ne));
            if (prm) { slots[idx] = prm; }
            idx++;
            i = ne + 1;
        }
        return slots;
    }

    // 配置文本 → {params, presets, slots}(全局 JSON 优先,失败退回手写提取)
    function parseConfigText(txt) {
        if (!txt || typeof txt !== "string") { return null; }
        var slots = [{}, {}, {}, {}];
        try {
            if (typeof JSON !== "undefined" && JSON.parse) {
                var d = JSON.parse(txt);
                if (d && typeof d === "object") {
                    var params = {
                        mode: d.mode, count: d.count, vtype: d.vtype, expr: d.expr,
                        on: d.on, gap: d.gap, val: d.val,
                        curveEnabled: d.curveEnabled, curveSmoothEnd: d.curveSmoothEnd,
                        curveSeg: d.curveSeg
                    };
                    var vp = validatePresets(d);
                    var presets = vp ? vp : [];
                    if (d.slots instanceof Array) {
                        for (var si = 0; si < 4 && si < d.slots.length; si++) {
                            if (d.slots[si] && typeof d.slots[si] === "object") { slots[si] = d.slots[si]; }
                        }
                    }
                    return {params: params, presets: presets, slots: slots};
                }
            }
        } catch (e) {}
        var params2 = extractParamsFromBlock(txt);
        if (!params2) { return null; }
        return {params: params2, presets: extractPresetsFallback(txt) || [], slots: extractSlotsFallback(txt)};
    }

    // ===== 预检层(AE 依赖)=====

    // AE 26.0 实测枚举数值(dim_test.jsx 定案):
    //   ThreeD_SPATIAL=6413, ThreeD=6414, TwoD_SPATIAL=6415, TwoD=6416, OneD=6417
    var VT_THREE_D_SPATIAL = 6413;
    var VT_THREE_D = 6414;
    var VT_TWO_D_SPATIAL = 6415;
    var VT_TWO_D = 6416;
    var VT_ONE_D = 6417;

    // 维度纯决策(v0.1.17/0.1.18,node 可测):
    //   - isSep(分离尺寸跟随者,如 位置X)→ 恒 1 维
    //   - OneD → 1 维(不透明度/旋转,恒 1 维)
    //   - 变换属性(位置/缩放/锚点/方向)→ 以图层 3D 开关为准:
    //     AE 2026 中 2D 图层的这些属性 propertyValueType 也报 3D(6413/6414),
    //     只有 threeDLayer 能区分 2D/3D(用户三次实测确认)
    //   - 非变换属性 → 退回 propertyValueType 映射
    function propDimCore(mn, vt, is3D, isSep) {
        if (isSep === true) { return 1; }
        if (vt === VT_ONE_D) { return 1; }
        var t = (mn === "ADBE Position" || mn === "ADBE Scale"
              || mn === "ADBE Anchor Point" || mn === "ADBE Orientation");
        if (t && (is3D === true || is3D === false)) { return is3D ? 3 : 2; }
        if (vt === VT_THREE_D_SPATIAL || vt === VT_THREE_D) { return 3; }
        if (vt === VT_TWO_D_SPATIAL || vt === VT_TWO_D) { return 2; }
        return 0;
    }

    // 属性维度(读取 AE 对象后交给纯决策)
    function propDimOf(prop) {
        try {
            var vt = prop.propertyValueType;
            var mn = "";
            try { mn = String(prop.matchName); } catch (e2) {}
            var li = propLayerInfo(prop);
            var is3D = li.is3D;
            if (li.type === "camera" || li.type === "light") { is3D = true; }   // 恒 3D(v0.1.18)
            var isSep = false;
            try { isSep = (prop.separationLeader !== null && prop.separationLeader !== undefined); } catch (e3) {}
            return propDimCore(mn, vt, is3D, isSep);
        } catch (e) {}
        return 0;   // COLOR/自定义/文本等 → 不预检,执行时兜底
    }

    // setTemporalEaseAtKey 缓动数组长度(官方指南,与 propDimOf 的"位数预检"
    // 语义不同!):SPATIAL 属性(位置/锚点/方向)恒 1 个 KeyframeEase——
    // 官方指南: "For all other keyframeValueTypes, including TwoD_SPATIAL and
    // ThreeD_SPATIAL types, it is 1";Paul Tuersley 社区确认 Position 只有
    // 一组速度缓动。缩放等非空间属性按实际值维度(2D→2、3D→3)。用
    // matchName + 实际写入值 v 判断,不依赖 propertyValueType(AE 2026 的
    // 2D 变换属性也报 3D 类型,v0.2.16 真机 bug「值数组没有 1 元素」)
    function easeDimOf(prop, v) {
        try {
            var mn = "";
            try { mn = String(prop.matchName); } catch (e2) {}
            if (mn === "ADBE Position" || mn === "ADBE Anchor Point"
                || mn === "ADBE Orientation") { return 1; }
            if (v instanceof Array && v.length >= 2) { return v.length; }
        } catch (e) {}
        return 1;
    }

    // 属性类型常量名(诊断用):返回 "ThreeD_SPATIAL" 之类,读不到返回 "?"
    function propTypeName(prop) {
        try {
            var vt = prop.propertyValueType;
            var map = [
                ["ThreeD_SPATIAL", PropertyValueType.ThreeD_SPATIAL],
                ["ThreeD", PropertyValueType.ThreeD],
                ["TwoD_SPATIAL", PropertyValueType.TwoD_SPATIAL],
                ["TwoD", PropertyValueType.TwoD],
                ["OneD", PropertyValueType.OneD]
            ];
            for (var i = 0; i < map.length; i++) {
                if (vt === map[i][1]) { return map[i][0]; }
            }
            return "类型#" + vt;
        } catch (e) { return "?"; }
    }

    // 属性所属图层:层名 + 所在合成 + 3D 图层开关 + 图层类型(v0.1.18 加类型)
    // 识别 Layer 用 duck-typing(containingComp)——instanceof Layer 在此处
    // 不可靠(曾静默失败导致诊断缺失);parentProperty 不可用时退回
    // propertyGroup() 上溯;12 层守卫防死循环。
    function propLayerInfo(prop) {
        var info = {name: "", comp: "", is3D: null, type: "layer"};
        try {
            var pb = prop;
            var guard = 0;
            while (pb && guard < 12) {
                guard++;
                var isLayer = false;
                try { isLayer = (typeof pb.containingComp !== "undefined"); } catch (e7) {}
                if (isLayer) {
                    try { info.name = String(pb.name); } catch (e2) {}
                    try { info.comp = String(pb.containingComp.name); } catch (e6) {}
                    try { info.is3D = (pb.threeDLayer === true); } catch (e3) {}
                    // 摄像机/灯光恒 3D(无 3D 开关)
                    try { if (pb instanceof CameraLayer) { info.type = "camera"; } } catch (e8) {}
                    try { if (pb instanceof LightLayer) { info.type = "light"; } } catch (e9) {}
                    try {
                        var mnL = String(pb.matchName);
                        if (mnL === "ADBE Camera Layer") { info.type = "camera"; }
                        if (mnL === "ADBE Light Layer") { info.type = "light"; }
                    } catch (e10) {}
                    break;
                }
                var next = null;
                try { next = pb.parentProperty; } catch (e11) {}
                if (!next) {
                    try { next = pb.propertyGroup(); } catch (e12) {}
                }
                pb = next;
            }
        } catch (e5) {}
        return info;
    }

    // 统一预检:返回 {ok, lines, sugDim}
    //   ok=true  通过;ok=false 时 lines 为逐条不匹配说明,sugDim 为建议空数(0=无统一建议)
    //   每条附带 AE 原始诊断:[类型 X · 图层「Y」@「合成Z」3D开关:开/关/未知]
    function dimCheck(props, propNames, dim) {
        var errs = [];
        for (var p = 0; p < props.length; p++) {
            var pd = propDimOf(props[p]);
            if (pd > 0 && pd !== dim) {
                var li = propLayerInfo(props[p]);
                var diag = " [类型:" + propTypeName(props[p]);
                if (li.name !== "" || li.is3D !== null) {
                    diag += " · 图层「" + (li.name || "?") + "」@「" + (li.comp || "?") + "」3D开关:"
                        + (li.is3D === true ? "开" : (li.is3D === false ? "关" : "未知"));
                }
                diag += "]";
                errs.push({name: propNames[p], pd: pd, extra: diag});
            }
        }
        if (errs.length === 0) { return {ok: true, lines: [], sugDim: 0}; }
        var lines = [];
        var sugDim = errs[0].pd;
        var sugAll = true;
        for (var i = 0; i < errs.length; i++) {
            lines.push("属性「" + errs[i].name + "」为 " + errs[i].pd + " 维,本次输入 " + dim + " 个数" + errs[i].extra);
            if (errs[i].pd !== sugDim) { sugAll = false; }
        }
        return {ok: false, lines: lines, sugDim: (sugAll ? sugDim : 0)};
    }

    // 预检失败:写报告 + 状态栏 + 弹窗,调用方 return(v0.1.14 抽取)
    function failDimCheck(dchk, dim) {
        var hint = "请把「数值输入」的空数(1/2/3)调到与属性维度一致,或留空用当前值。";
        if (dchk.sugDim >= 1 && dchk.sugDim <= 3 && dchk.sugDim !== dim) {
            hint = "建议「数值输入」切到「" + dchk.sugDim + " 个空」,或留空用当前值。";
        }
        var head = "数值位数不匹配,未执行:";
        lastReport = head + "\n- " + dchk.lines.join("\n- ") + "\n\n" + hint;
        setStatus("数值位数不匹配,未执行(见弹窗)");
        alert(head + "\n- " + dchk.lines.join("\n- ") + "\n\n" + hint);
    }

    // ===== 公共辅助 =====

    function setStatus(msg) {
        if (status) { status.text = msg; }
    }

    function propName(prop, idx) {
        try { return String(prop.name); } catch (e) { return "属性#" + idx; }
    }

    function errMsg(e) {
        try { return (e && e.message) ? String(e.message) : String(e); } catch (e2) { return "未知错误"; }
    }

    // undo 组包装:beginUndoGroup 必须配 try/finally,异常不留半截撤销栈
    function withUndo(label, fn) {
        app.beginUndoGroup(label);
        try { fn(); } finally { app.endUndoGroup(); }
    }

    // 逐属性执行:返回 {ok, bad, entries} — entries 为有序 [{ok, idx, msg?}],报告顺序与执行一致
    function perProp(props, fn) {
        var ok = 0;
        var bad = 0;
        var entries = [];
        for (var p = 0; p < props.length; p++) {
            try {
                fn(props[p], p);
                ok++;
                entries.push({ok: true, idx: p});
            } catch (e) {
                bad++;
                entries.push({ok: false, idx: p, msg: errMsg(e)});
            }
        }
        return {ok: ok, bad: bad, entries: entries};
    }

    // 预设名 → 下标(导入/选择用)
    function presetIndexByName(presets, name) {
        for (var i = 0; i < presets.length; i++) {
            if (presets[i].name === name) { return i; }
        }
        return -1;
    }

    // ===== 执行层 =====

    // 打一个关键帧并返回其索引(官方 API 方案,v0.2.11):
    //   - 先按时间找已有帧(容差 ±0.05s ≈ 1.5 帧——社区确认 AE 关键帧放置
    //     有精度问题,Paul Tuersley 社区帖;原 0.03s 容差可能漏)→ 复用其索引
    //   - 无已有帧 → prop.addKey(t) 直接创建并返回索引(官方文档:addKey
    //     "Adds a new keyframe... returns the index of the new keyframe",
    //     创建即得,彻底不依赖"打完再按时间找"——v0.2.10 真机「3 索引无效」)
    //   - addKey 异常兜底 setValueAtTime + numKeys(极端情况,帧仍打上)
    function setKeyAt(prop, t, wv) {
        var idx = 0;
        try {
            var n = prop.numKeys;
            for (var k = 1; k <= n; k++) {
                if (Math.abs(prop.keyframeTime(k) - t) < 0.05) { idx = k; break; }
            }
        } catch (e) { idx = 0; }
        if (idx === 0) {
            try { idx = prop.addKey(t); }
            catch (e2) { idx = 0; }
        }
        if (idx > 0) { prop.setValueAtKey(idx, wv); }
        else { prop.setValueAtTime(t, wv); idx = prop.numKeys; }
        return idx;
    }

    // 给一个属性的关键帧序列套缓动曲线(v0.2.12 重写,0.2.14 修线性端点,
    // 0.2.15 加端点平滑):
    //   frames = [{t, v, idx}] 按时间升序;idx 来自打帧时 setKeyAt 的 addKey 返回值
    //   segs   = 每段 {x1,y1,x2,y2}(长度 m-1,bezier 0~1)
    //   smoothEnd = true 时(端点平滑):首帧「出」/末帧「入」速度强制 0(曲线
    //   两端水平圆润,像 Easy Ease 起止静止);首/末帧即使两侧段都线性也不
    //   跳过(转 BEZIER)——「硬」(默认)则保持现状(端点按各段曲线直接连,
    //   线性段端点匀速、边界帧可保持 LINEAR)
    // 流程:
    //   1. 逐段 bezierToEase(avg = 段值差/时差)→ 每段的入/出缓动
    //   2. 帧 k 的「出」= 段 k 的「出」,帧 k+1 的「入」= 段 k 的「入」;
    //      首帧「入」/末帧「出」= NEUTRAL
    //   3. 线性段端点缓动 = KeyframeEase(段平均速度, 0.1)——线性 = 匀速
    //      (官方文档 "uniform rate of change");平滑模式端点邻接线性段时速度 0
    //   4. 帧两侧都属于线性段(或边界无段)→ 跳过,保持 AE 默认线性插值;
    //      平滑模式首/末帧例外(强制转 BEZIER);否则先转 BEZIER 再设缓动
    // 返回 {applied, missed, missIdx, missErr, missErrMsg}
    function applySegCurves(prop, frames, segs, smoothEnd) {
        var m = frames.length;
        var EMPTY = {applied: 0, missed: 0, missIdx: 0, missErr: 0, missErrMsg: ""};
        if (m < 2) { return EMPTY; }
        // 缓动数组长度按官方规则(v0.2.16):SPATIAL(位置/锚点/方向)=1,
        // 缩放等按实际值维度;不能用 propDimOf(锚点 2D 返回 2,AE 只收 1)
        var dim = easeDimOf(prop, frames[0].v);
        function easeArr(e) {
            var arr = [];
            for (var d = 0; d < dim; d++) { arr.push(e); }
            return arr;
        }
        // 每段端点缓动:outEase[j] = 帧 j 出(段 j 出);inEase[j+1] = 帧 j+1 入(段 j 入)
        var inEase = [];
        var outEase = [];
        var j;
        for (j = 1; j < m; j++) {
            var sg = segs[j - 1];
            var dt = frames[j].t - frames[j - 1].t;
            var avg = (dt > 0.000001) ? valSignedDiff(frames[j].v, frames[j - 1].v) / dt : 0;
            var conv = sg ? bezierToEase(sg.x1, sg.y1, sg.x2, sg.y2, avg) : null;
            var isFirstSeg = (j === 1);
            var isLastSeg = (j === m - 1);
            if (conv) {
                var outSpd = conv.out.speed;
                var inSpd = conv.inE.speed;
                if (smoothEnd) {
                    if (isFirstSeg) { outSpd = 0; }   // 起点速度归零(0.2.15)
                    if (isLastSeg) { inSpd = 0; }     // 终点速度归零(0.2.15)
                }
                outEase[j] = new KeyframeEase(outSpd, conv.out.influence);
                inEase[j + 1] = new KeyframeEase(inSpd, conv.inE.influence);
            } else {
                var linSpd = avg;                    // 线性 = 匀速(0.2.14)
                if (smoothEnd && (isFirstSeg || isLastSeg)) { linSpd = 0; }   // 端点邻接线性也圆润
                outEase[j] = new KeyframeEase(linSpd, 0.1);
                inEase[j + 1] = new KeyframeEase(linSpd, 0.1);
            }
        }
        var NEUTRAL = new KeyframeEase(0, 0.1);   // 仅用于边界:首帧入 / 末帧出
        var applied = 0;
        var missed = 0;
        var missIdx = 0;
        var missErr = 0;
        var missErrMsg = "";
        for (var k = 1; k <= m; k++) {
            var idx = frames[k - 1].idx;
            if (!idx || idx <= 0) { missed++; missIdx++; continue; }
            // 帧两侧段:入侧 = 段 k-1,出侧 = 段 k;边界无段视为线性
            var segL = (k > 1) ? segs[k - 2] : null;
            var segR = (k < m) ? segs[k - 1] : null;
            var linL = !segL || isLinearPreset(segL.x1, segL.y1, segL.x2, segL.y2);
            var linR = !segR || isLinearPreset(segR.x1, segR.y1, segR.x2, segR.y2);
            // 平滑模式:首/末帧强制转 BEZIER(端点圆润),不因邻接线性而跳过
            if (!(smoothEnd && (k === 1 || k === m)) && linL && linR) { continue; }
            var inE = (k > 1) ? inEase[k] : NEUTRAL;
            var outE = (k < m) ? outEase[k] : NEUTRAL;
            try {
                prop.setInterpolationTypeAtKey(idx,
                    KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                prop.setTemporalEaseAtKey(idx, easeArr(inE), easeArr(outE));
                applied++;
            } catch (e8) {
                missed++;
                missErr++;
                if (!missErrMsg) { missErrMsg = errMsg(e8); }
            }
        }
        return {applied: applied, missed: missed, missIdx: missIdx, missErr: missErr, missErrMsg: missErrMsg};
    }

    // 执行计划:只写 AE(setValueAtTime + 可选曲线),不拼报告
    // opts: {curveOn, curveSegs, smoothEnd} — curveOn=true 时对每个属性套曲线
    // 返回 {kfCount, badCount, fails, curveApplied, curveMissed, curveFail, curveErr}
    function executePlan(comp, props, plan, opts) {
        var kfCount = 0;
        var badCount = 0;
        var fails = [];
        var curveApplied = 0;
        var curveMissed = 0;
        var curveMissIdx = 0;
        var curveMissErr = 0;
        var curveMissErrMsg = "";
        var curveFail = 0;
        var curveErr = "";
        opts = opts || {};
        withUndo("QuickKey K帧", function () {
            // 每个属性打上的帧(含打帧时立即记录的索引,v0.2.3)
            var propFrames = [];
            for (var pf0 = 0; pf0 < props.length; pf0++) { propFrames.push([]); }
            for (var i = 0; i < plan.length; i++) {
                var item = plan[i];
                if (item.closed) { continue; }                       // 关闭节点:不打帧
                if (item.kind === "bad") { badCount += props.length; continue; }  // 非法:整行跳过
                var t = comp.time + item.offset * comp.frameDuration;
                var v = item.value;
                var r = perProp(props, function (prop, p) {
                    var wv;
                    if (v === null) { wv = prop.value; }
                    else { wv = v; }
                    var idx = setKeyAt(prop, t, wv);   // v0.2.11:创建即得索引(addKey)
                    propFrames[p].push({t: t, v: wv, idx: idx});
                });
                kfCount += r.ok;
                badCount += r.bad;
                for (var f = 0; f < r.entries.length; f++) {
                    if (!r.entries[f].ok) {
                        var en = r.entries[f];
                        var exp = false;
                        try { exp = props[en.idx].expressionEnabled; } catch (e4) {}
                        fails.push({slot: item.slot, propIdx: en.idx, msg: en.msg, exp: exp});
                    }
                }
            }
            // 曲线应用:每个属性按打帧时记录的帧序列套缓动
            if (opts.curveOn && opts.curveSegs && opts.curveSegs.length > 0) {
                for (var p = 0; p < props.length; p++) {
                    var frames = propFrames[p];
                    if (frames.length >= 2) {
                        try {
                            var cr = applySegCurves(props[p], frames, opts.curveSegs, opts.smoothEnd);
                            curveApplied += cr.applied;
                            curveMissed += cr.missed;
                            curveMissIdx += cr.missIdx;
                            curveMissErr += cr.missErr;
                            if (!curveMissErrMsg) { curveMissErrMsg = cr.missErrMsg; }
                        } catch (e7) {
                            curveFail++;
                            if (!curveErr) { curveErr = errMsg(e7); }   // v0.2.8:记首个异常信息
                        }
                    }
                }
            }
        });
        return {
            kfCount: kfCount, badCount: badCount, fails: fails,
            curveApplied: curveApplied, curveMissed: curveMissed,
            curveMissIdx: curveMissIdx, curveMissErr: curveMissErr,
            curveMissErrMsg: curveMissErrMsg,
            curveFail: curveFail, curveErr: curveErr
        };
    }

    // 打帧报告:纯文本拼接(报告与执行彻底分离,v0.1.14)
    // curveNames = 各段预设名(如 "线性 / 缓入")或 null(曲线关闭)
    // segMeta = 各段 {name, x1, y1, x2, y2} 或 null(动效整理段用,v0.3.3)
    function buildReport(comp, props, propNames, plan, result, st, curveNames, segMeta) {
        var report = [];
        report.push("QuickKey 打帧报告 · " + MODE_NAMES[st.mode] + " · 节点 " + st.count
            + " · 数值输入 " + VTYPE_NAMES[st.vtype]);
        report.push("合成: " + comp.name + " · 指示器 " + comp.time.toFixed(2) + "s · 帧率 "
            + (1 / comp.frameDuration).toFixed(0) + "fps");
        report.push("选中属性(" + props.length + "): " + propNames.join(" / "));
        for (var i = 0; i < plan.length; i++) {
            var item = plan[i];
            if (item.closed) { report.push("节点" + item.slot + " 关闭 → 跳过"); continue; }
            var note = "";
            if (item.kind === "bad") { note = "数值非法[" + item.raw + "] → 跳过"; }
            else if (item.kind === "empty") { note = "留空 → 用属性当前值"; }
            else { note = "数值 " + describeVal(item.value); }
            var t = comp.time + item.offset * comp.frameDuration;
            report.push("节点" + item.slot + " " + fmtFrames(item.offset) + " (" + t.toFixed(2) + "s) · " + note);
            for (var f = 0; f < result.fails.length; f++) {
                if (result.fails[f].slot === item.slot) {
                    report.push("    ✕ " + propNames[result.fails[f].propIdx] + " : " + result.fails[f].msg
                        + (result.fails[f].exp ? " [属性已启用表达式]" : ""));
                }
            }
        }
        if (curveNames) { report.push("曲线: " + curveNames); }
        else { report.push("曲线: 未开启(勾选面板上的「曲线功能」后,段预设才参与打帧)"); }
        if (result.curveApplied !== undefined && (result.curveApplied > 0 || result.curveMissed > 0 || result.curveFail > 0)) {
            var cl = "曲线应用: " + result.curveApplied + " 帧套上缓动";
            if (result.curveMissed > 0) {
                cl += " · " + result.curveMissed + " 帧未匹配";
                var mparts = [];
                if (result.curveMissIdx > 0) { mparts.push(result.curveMissIdx + " 索引无效"); }
                if (result.curveMissErr > 0) { mparts.push(result.curveMissErr + " 调用异常"); }
                if (mparts.length > 0) { cl += "(" + mparts.join(" / ") + ")"; }
                if (result.curveMissErrMsg) { cl += " [" + result.curveMissErrMsg + "]"; }
            }
            if (result.curveFail > 0) {
                cl += " · " + result.curveFail + " 个属性异常";
                if (result.curveErr) { cl += " [" + result.curveErr + "]"; }
            }
            report.push(cl);
        }
        report.push("结果: " + result.kfCount + " 个关键帧 · " + result.badCount + " 个未生效");

        // ────── 动效整理(v0.3.3):对象 + 节点/曲线竖排,便于核对当前动效 ──────
        report.push("");
        // v0.3.8:标题标注工程帧率(毫秒换算依据;29.97/23.976 等非整帧率如实显示)
        var fpsTxt = "" + Math.round((1 / comp.frameDuration) * 1000) / 1000;
        report.push("────── 动效整理 (" + fpsTxt + "fps) ──────");
        // 对象行:每个选中属性一行(合成 · 图层 · 属性名 · 维度)
        for (var oi = 0; oi < props.length; oi++) {
            var objDesc = "「" + comp.name + "」";
            try {
                var oli = propLayerInfo(props[oi]);
                if (oli && oli.name) { objDesc += " · " + oli.name; }
            } catch (e9) {}
            objDesc += " · " + propNames[oi];
            var odim = 0;
            try { odim = propDimOf(props[oi]); } catch (e10) {}
            if (odim > 0) { objDesc += " (" + odim + "D)"; }
            report.push("对象: " + objDesc);
        }
        // 节点 + 曲线竖排:只列实际打帧的节点(fixed/empty),关闭与非法跳过
        var disp = [];
        for (var d1 = 0; d1 < plan.length; d1++) {
            if (!plan[d1].closed && plan[d1].kind !== "bad") { disp.push(plan[d1]); }
        }
        for (var d2 = 0; d2 < disp.length; d2++) {
            var nd = disp[d2];
            var nt = comp.time + nd.offset * comp.frameDuration;
            // v0.3.8:节点行帧偏移追加毫秒(按工程帧率换算;锚点 +0 帧不显示)
            var offTxt = "(" + fmtFrames(nd.offset) + ")";
            if (nd.offset !== 0) {
                offTxt = "(" + fmtFrames(nd.offset) + " / "
                    + Math.round(nd.offset * comp.frameDuration * 1000) + "ms)";
            }
            report.push("节点" + nd.slot + "  " + nt.toFixed(2) + "s  " + offTxt + "   值 "
                + ((nd.kind === "empty") ? "当前值" : describeVal(nd.value)));
            // 该节点与下一个节点之间的曲线段(段序 = 打帧节点序,正常情况与面板段一一对应)
            if (d2 < disp.length - 1 && segMeta && segMeta[d2]) {
                var sm = segMeta[d2];
                report.push("  ↓ " + sm.name + "  [" + fmtBz(sm.x1) + ", " + fmtBz(sm.y1)
                    + ", " + fmtBz(sm.x2) + ", " + fmtBz(sm.y2) + "]");
            }
        }
        return report.join("\n");
    }

    // bezier 数值显示:去浮点尾巴(0.58 → "0.58", 1 → "1")
    function fmtBz(n) {
        var r = Math.round(n * 1000) / 1000;
        return String(r);
    }

    // 表达式(表达式模式,支线):写入选中属性,不排关键帧
    function applyExpression(props) {
        var expr = state.expr;
        if (!expr || expr.replace(/\s/g, "") === "") {
            setStatus("表达式为空:先在上方填表达式");
            return;
        }
        var result = null;
        withUndo("QuickKey 应用表达式", function () {
            result = perProp(props, function (prop) {
                prop.expression = expr;
                prop.expressionEnabled = true;
            });
        });
        var report = ["QuickKey 表达式应用报告", "表达式: " + expr];
        for (var i = 0; i < result.entries.length; i++) {
            var en = result.entries[i];
            var pn = propName(props[en.idx], en.idx + 1);
            if (en.ok) { report.push("  OK   " + pn); }
            else { report.push("  FAIL " + pn + " : " + en.msg); }
        }
        report.push("结果: " + result.ok + " 个成功 · " + result.bad + " 个失败");
        lastReport = report.join("\n");
        var msg = "表达式已应用:" + result.ok + " 个属性";
        if (result.bad > 0) { msg += " · " + result.bad + " 个失败(点「调试」看明细)"; }
        setStatus(msg);
        if (result.ok === 0 && result.bad > 0) { showReport(); }
    }

    // 主线打帧(v0.1.14 重构):校验 → 计划 → 预检 → 执行 → 报告,各管一段
    function doKey() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("请先激活一个合成,再点打帧。");
            return;
        }
        var props = comp.selectedProperties;
        if (!props || props.length === 0) {
            setStatus("未选中属性:先在时间轴展开属性并选中(P/S/R/T 等)");
            return;
        }
        if (state.vtype === 3) { applyExpression(props); return; }   // 表达式模式:只写表达式

        var dim = state.vtype + 1;
        var plan = buildPlan(state.mode, state.count, state.gap, state.on, state.val, dim);
        var propNames = [];
        for (var pi = 0; pi < props.length; pi++) { propNames.push(propName(props[pi], pi + 1)); }

        // 预检:有显式数值时校验位数,不匹配直接提示并中止
        if (planHasExplicit(plan)) {
            var dchk = dimCheck(props, propNames, dim);
            if (!dchk.ok) {
                failDimCheck(dchk, dim);
                return;
            }
        }

        // 曲线段(v0.2.0):开启相邻对 → 各段预设数值;表达式模式已分流,此处必为打帧
        var curveSegs = null;
        if (state.curve.enabled) {
            var segPairs = curveSegments(state.on, state.count);
            if (segPairs.length > 0) {
                curveSegs = [];
                for (var si = 0; si < segPairs.length; si++) {
                    var cseg = ensureCurveSeg(si + 1);
                    curveSegs.push({x1: cseg.x1, y1: cseg.y1, x2: cseg.x2, y2: cseg.y2});
                }
            }
        }

        // 执行 + 报告
        var result = executePlan(comp, props, plan, {
            curveOn: (curveSegs !== null),
            curveSegs: curveSegs,
            smoothEnd: state.curve.smoothEnd    // v0.2.15:端点平滑
        });
        var curveNames = null;
        var segMeta = null;   // v0.3.3:动效整理段用——每段 {name, x1, y1, x2, y2}
        if (curveSegs !== null) {
            curveNames = [];
            segMeta = [];
            for (var cn = 0; cn < curveSegs.length; cn++) {
                var csg = ensureCurveSeg(cn + 1);
                curveNames.push(csg.preset || "自定义");
                segMeta.push({name: csg.preset || "自定义",
                    x1: curveSegs[cn].x1, y1: curveSegs[cn].y1,
                    x2: curveSegs[cn].x2, y2: curveSegs[cn].y2});
            }
            curveNames = curveNames.join(" / ");
        }
        lastReport = buildReport(comp, props, propNames, plan, result, state, curveNames, segMeta);
        var msg = "完成:" + result.kfCount + " 个关键帧 · " + props.length + " 个属性 · " + MODE_NAMES[state.mode];
        if (result.curveMissed > 0) { msg += " · " + result.curveMissed + " 帧未套上曲线(点「调试」看明细)"; }
        else if (result.curveApplied > 0) { msg += " · 曲线已套用"; }
        if (result.curveFail > 0) { msg += " · 曲线异常 " + result.curveFail + " 个属性"; }
        if (result.badCount > 0) { msg += " · " + result.badCount + " 个未生效(点「调试」看明细)"; }
        setStatus(msg);
        if (result.kfCount === 0) { showReport(); }   // 一个关键帧都没打上 → 自动弹报告
    }

    // ===== 预设导出/导入(v0.2.0)=====

    function projectFileDir() {
        try {
            var pf = app.project.file;
            if (pf && pf.fsName) {
                // 取路径的目录部分:纯字符串操作,不用正则字面量
                // (ExtendScript 解析器对含 \\ 的正则字面量会报语法错误)
                var s = String(pf.fsName);
                var idx = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
                if (idx >= 0) { return s.substring(0, idx); }
                return s;
            }
        } catch (e) {}
        return "~";
    }

    // 导出:全部当前预设(内置 + 已导入)→ JSON(默认当前工程目录,UTF-8)
    function exportPresets() {
        try {
            var f = File.saveDialog("导出曲线预设 (JSON)",
                "JSON 文件:*.json;*.*", projectFileDir() + "/quickkey_presets.json");
            if (!f) { return; }   // 用户取消
            f.encoding = "UTF-8";
            if (!f.open("w")) { setStatus("导出失败:无法写入文件"); return; }
            f.write(stringifyPresets(state.curve.presets));   // 自包含序列化(v0.2.1)
            f.close();
            setStatus("已导出 " + state.curve.presets.length + " 个预设 → " + f.fsName);
        } catch (e) {
            setStatus("导出失败:" + errMsg(e));
        }
    }

    // 导入:读 JSON → 校验 → 合并(同名覆盖)→ 重建下拉
    function importPresets() {
        try {
            var f = File.openDialog("导入曲线预设 (JSON)", "JSON 文件:*.json;*.*");
            if (!f) { return; }
            f.encoding = "UTF-8";
            if (!f.open("r")) { setStatus("导入失败:无法打开文件"); return; }
            var txt = f.read();
            f.close();
            var list = parsePresetsText(txt);   // 自包含解析:全局 JSON 优先,手写回退(v0.2.1)
            if (!list || list.length === 0) { setStatus("导入失败:文件里没有合法预设"); return; }
            state.curve.presets = mergePresets(state.curve.presets, list);
            rebuildPresetDropdowns();
            setStatus("已导入 " + list.length + " 个预设(共 " + state.curve.presets.length + " 个)");
        } catch (e) {
            setStatus("导入失败:" + errMsg(e));
        }
    }

    // ===== UI 层(AE 环境才构建;node 下跳过供测试)=====

    function showReport() {
        var dlg = new Window("dialog", "QuickKey · 调试报告", undefined, {resizeable: true});
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "fill"];
        dlg.margins = 10;
        dlg.spacing = 8;
        var txt = dlg.add("edittext", undefined,
            lastReport || "(尚无执行记录:先点一次「打帧」或「应用表达式」)",
            {multiline: true, scrollable: true});
        txt.preferredSize.width = 520;
        txt.preferredSize.height = 340;
        var grp = dlg.add("group");
        grp.orientation = "row";
        grp.alignment = ["right", "center"];
        var btnClose = grp.add("button", undefined, "关闭");
        btnClose.onClick = function () { dlg.close(); };
        dlg.center();
        dlg.show();
    }

    var isAe = (typeof app !== "undefined");

    if (isAe) {
        var pal = (thisObj instanceof Panel) ? thisObj
            : new Window("palette", "QuickKey · 快速K帧", undefined, {resizeable: false});
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 6;
        pal.margins = 8;

        // ---- Tab 键只在数字输入框之间循环(v0.2.7)----
        // 方案(搜索确认):ScriptUI edittext 支持 onKeyDown 处理器,event.keyName
        // 判键、event.preventDefault() 有效(Adobe 官方 NumericEditKeyboardHandler
        // 同款),控件 .active = true 可设焦点(ExtendScript wiki)。
        var numBoxes = [];   // 所有数字输入框(间隔 + 节点数值 + 曲线段数值),按创建顺序

        function focusNextNum(current) {
            var n = numBoxes.length;
            if (n < 2) { return; }
            var idx = -1;
            for (var i = 0; i < n; i++) { if (numBoxes[i] === current) { idx = i; break; } }
            if (idx < 0) { return; }
            for (var step = 1; step <= n; step++) {
                var cand = numBoxes[(idx + step) % n];
                if (cand && cand.visible && cand.enabled) {
                    cand.active = true;
                    return;
                }
            }
        }

        function bindNumTab(box) {
            numBoxes.push(box);
            box.onKeyDown = function (e) {
                try {
                    if (e && e.keyName === "Tab") {
                        if (e.preventDefault) { e.preventDefault(); }
                        focusNextNum(box);
                    }
                } catch (err) {}
            };
        }

        // ---- 行池工厂(v0.3.0 重构):统一"懒增长 + visible 切换"----
        // createRow(i) 返回 {row, ...控件引用};ensure(need) 补齐行数并切换
        // 可见性;get(i) 取第 i 行(1-based);hideAll() 隐藏全部(曲线关时)
        function makeRowPool(createRow) {
            var rows = [];
            return {
                rows: rows,
                ensure: function (need) {
                    var added = false;
                    while (rows.length < need) {
                        rows.push(createRow(rows.length + 1));
                        added = true;
                    }
                    for (var i = 0; i < rows.length; i++) { rows[i].row.visible = (i + 1) <= need; }
                    return added;
                },
                hideAll: function () {
                    for (var i = 0; i < rows.length; i++) { rows[i].row.visible = false; }
                },
                get: function (i) { return rows[i - 1]; }
            };
        }

        // 面板构建产物(供 refresh/事件引用,声明在 isAe 块内)
        var grpExpr = null;    // 表达式行(随 vtype 显隐)
        var grpSegs = null;    // 曲线段容器(随曲线开关显隐)
        var btnKey = null;     // 打帧/应用表达式按钮(文案随 vtype)
        var status = null;     // 状态栏

        // 顶部行:节点数 / 模式 / 数值类型 / 表达式(v0.3.0 分组构建)
        function buildHeader() {
            var grpCount = pal.add("group");
            grpCount.orientation = "row";
            grpCount.alignChildren = ["fill", "center"];
            grpCount.spacing = 6;
            grpCount.add("statictext", undefined, "节点数(1~30):");
            var cntInp = grpCount.add("edittext", undefined, String(state.count));
            cntInp.characters = 3;
            cntInp.onChange = function () {
                var v = parseInt(cntInp.text, 10);
                if (isNaN(v) || v < 1) { v = 1; }
                if (v > MAX_COUNT) { v = MAX_COUNT; }
                if (v !== state.count) {
                    state.count = v;
                    resizeState(v);
                    nodePool.ensure(v);
                    refresh();
                    pal.layout.layout(true);
                }
                cntInp.text = String(state.count);
            };

            var grpMode = pal.add("group");
            grpMode.orientation = "row";
            grpMode.alignChildren = ["fill", "center"];
            grpMode.spacing = 6;
            grpMode.add("statictext", undefined, "当前时间指示器作为:锚点");
            var ddMode = grpMode.add("dropdownlist", undefined, MODE_NAMES);
            ddMode.selection = ddMode.items[0];   // 默认起始帧
            ddMode.onChange = function () {
                state.mode = ddMode.selection.index;
                refresh();
                pal.layout.layout(true);
            };

            var grpType = pal.add("group");
            grpType.orientation = "row";
            grpType.alignChildren = ["fill", "center"];
            grpType.spacing = 6;
            grpType.add("statictext", undefined, "数值输入:");
            var ddType = grpType.add("dropdownlist", undefined, VTYPE_NAMES);
            ddType.selection = ddType.items[0];   // 默认 1 个空
            var typeHint = grpType.add("statictext", undefined, "空=数组维度");
            typeHint.preferredSize.width = 84;
            ddType.onChange = function () {
                state.vtype = ddType.selection.index;
                refresh();
                pal.layout.layout(true);
            };

            grpExpr = pal.add("group");
            grpExpr.orientation = "row";
            grpExpr.alignChildren = ["fill", "center"];
            grpExpr.spacing = 6;
            grpExpr.add("statictext", undefined, "表达式:");
            var exprInp = grpExpr.add("edittext", undefined, state.expr);
            exprInp.characters = 26;
            exprInp.onChange = function () { state.expr = exprInp.text; };
        }

        // 节点区(v0.3.0 行池化):列头 + 节点行池
        var nodePool = null;
        function buildNodeArea() {
            var grpNodes = pal.add("group");
            grpNodes.orientation = "column";
            grpNodes.alignChildren = ["fill", "top"];
            grpNodes.spacing = 4;

            // 列头:开关 | 节点 | 间隔 | 数值 | 时间
            var head = grpNodes.add("group");
            head.orientation = "row";
            head.alignChildren = ["fill", "center"];
            head.spacing = 6;
            var hSp = head.add("statictext", undefined, "");
            hSp.preferredSize.width = 18;
            var hLbl = head.add("statictext", undefined, "节点");
            hLbl.preferredSize.width = 80;
            var hGap = head.add("statictext", undefined, "间隔");
            hGap.preferredSize.width = 55;
            var hVal = head.add("statictext", undefined, "数值");
            hVal.preferredSize.width = 190;
            var hTme = head.add("statictext", undefined, "时间");
            hTme.preferredSize.width = 50;

            // 单行节点:返回 {row, chk, lbl, inp, vin[3], tme}(v0.3.0 引用分组)
            function createNodeRow(slot) {
                var row = grpNodes.add("group");
                row.orientation = "row";
                row.alignChildren = ["fill", "center"];
                row.spacing = 6;
                var it = {row: row};
                it.chk = row.add("checkbox", undefined, "");
                it.lbl = row.add("statictext", undefined, "节点" + slot);
                it.lbl.preferredSize.width = 80;   // v0.3.1:锚点行文字改短,标签列收窄
                it.inp = row.add("edittext", undefined, String(state.gap[slot]));
                it.inp.characters = 5;   // v0.3.1:间隔框加宽,可显示 5 位数字
                bindNumTab(it.inp);
                it.vin = [];
                for (var k = 0; k < 3; k++) {
                    (function (k2) {
                        var box = row.add("edittext", undefined, "");
                        box.characters = 6;   // v0.3.1:数值框加宽,可显示 5 位数字(含负号/小数点)
                        bindNumTab(box);
                        box.onChange = function () {
                            state.val[slot][k2] = box.text;   // 框对格直写(v0.1.7 数组存储)
                        };
                        it.vin.push(box);
                    })(k);
                }
                it.tme = row.add("statictext", undefined, "");
                it.tme.preferredSize.width = 50;
                it.chk.onClick = function () {
                    state.on[slot] = it.chk.value;
                    refresh();
                    pal.layout.layout(true);   // v0.2.2:开关影响曲线段数,布局即时生效
                };
                it.inp.onChange = function () {
                    var v = parseInt(it.inp.text, 10);
                    if (isNaN(v) || v < 0) { v = 0; }
                    state.gap[slot] = v;
                    it.inp.text = String(v);
                    refresh();
                };
                return it;
            }

            nodePool = makeRowPool(createNodeRow);
        }

        // 曲线区(v0.3.0 行池化):开关行 + 段列头 + 段行池
        var segPool = null;
        function buildCurveArea() {
            // 曲线功能开关行 + 端点平滑 + 导出/导入(常驻可见,v0.2.2)
            var grpCurve = pal.add("group");
            grpCurve.orientation = "row";
            grpCurve.alignChildren = ["fill", "center"];
            grpCurve.spacing = 6;
            var chkCurve = grpCurve.add("checkbox", undefined, "曲线功能");
            var chkSmooth = grpCurve.add("checkbox", undefined, "端点平滑");
            var btnExport = grpCurve.add("button", undefined, "导出预设");
            var btnImport = grpCurve.add("button", undefined, "导入预设");
            chkCurve.onClick = function () {
                state.curve.enabled = chkCurve.value;
                refresh();
                pal.layout.layout(true);
            };
            chkSmooth.onClick = function () {
                state.curve.smoothEnd = chkSmooth.value;
            };
            btnExport.onClick = exportPresets;
            btnImport.onClick = importPresets;

            grpSegs = pal.add("group");
            grpSegs.orientation = "column";
            grpSegs.alignChildren = ["fill", "top"];
            grpSegs.spacing = 4;

            // 曲线列头:段 | 预设 | x1 y1 x2 y2
            var segHead = grpSegs.add("group");
            segHead.orientation = "row";
            segHead.alignChildren = ["fill", "center"];
            segHead.spacing = 6;
            var sh1 = segHead.add("statictext", undefined, "段");
            sh1.preferredSize.width = 78;
            var sh2 = segHead.add("statictext", undefined, "预设");
            sh2.preferredSize.width = 92;
            var sh3 = segHead.add("statictext", undefined, "x1");
            sh3.preferredSize.width = 52;
            var sh4 = segHead.add("statictext", undefined, "y1");
            sh4.preferredSize.width = 52;
            var sh5 = segHead.add("statictext", undefined, "x2");
            sh5.preferredSize.width = 52;
            var sh6 = segHead.add("statictext", undefined, "y2");
            sh6.preferredSize.width = 52;

            // 下拉 items = [自定义] + 全部预设名(v0.2.2:创建行时即全量)
            function ddItemsForPresets() {
                var items = ["自定义"];
                for (var j = 0; j < state.curve.presets.length; j++) {
                    items.push(state.curve.presets[j].name);
                }
                return items;
            }

            // 单行段:返回 {row, lbl, dd, ins[4]}(v0.3.0 引用分组)
            function createSegRow(si) {
                var row = grpSegs.add("group");
                row.orientation = "row";
                row.alignChildren = ["fill", "center"];
                row.spacing = 6;
                var it = {row: row};
                it.lbl = row.add("statictext", undefined, "");
                it.lbl.preferredSize.width = 78;
                it.dd = row.add("dropdownlist", undefined, ddItemsForPresets());
                it.dd.preferredSize.width = 92;
                it.ins = [];
                for (var d = 0; d < 4; d++) {
                    (function (d2) {
                        var box = row.add("edittext", undefined, "");
                        box.characters = 5;   // v0.3.1:曲线数值框加宽,可显示 5 位(如 0.125)
                        bindNumTab(box);   // v0.2.7:Tab 键参与数字框循环
                        box.onChange = function () {
                            var seg = ensureCurveSeg(si);
                            var n = parseFloat(box.text);
                            if (isNaN(n)) { n = 0; box.text = String(n); }
                            if (d2 === 0) { seg.x1 = n; }
                            else if (d2 === 1) { seg.y1 = n; }
                            else if (d2 === 2) { seg.x2 = n; }
                            else { seg.y2 = n; }
                            syncSegDropdown(si);   // 手填 → 匹配预设显示名,否则「自定义」
                        };
                        it.ins.push(box);
                    })(d);
                }
                it.dd.onChange = function () {
                    var name = it.dd.selection.text;
                    if (name === "自定义") { return; }   // 自定义:保留当前数值
                    var idx = presetIndexByName(state.curve.presets, name);
                    if (idx < 0) { return; }
                    var p = state.curve.presets[idx];
                    var seg = ensureCurveSeg(si);
                    seg.preset = p.name;
                    seg.x1 = p.x1; seg.y1 = p.y1; seg.x2 = p.x2; seg.y2 = p.y2;
                    it.ins[0].text = String(p.x1);
                    it.ins[1].text = String(p.y1);
                    it.ins[2].text = String(p.x2);
                    it.ins[3].text = String(p.y2);
                    syncSegDropdown(si);
                };
                return it;
            }

            segPool = makeRowPool(createSegRow);
        }

        // 底部:打帧 + 调试按钮 + 状态栏
        function buildFooter() {
            var grpBtns = pal.add("group");
            grpBtns.orientation = "row";
            grpBtns.alignChildren = ["fill", "center"];
            grpBtns.spacing = 6;
            btnKey = grpBtns.add("button", undefined, "打帧(全部开启的节点)");
            btnKey.onClick = doKey;
            var btnDebug = grpBtns.add("button", undefined, "调试");
            btnDebug.onClick = showReport;
            status = pal.add("statictext", undefined, "就绪:选中属性 → 设间隔/数值 → 打帧(数值留空=用当前值)");
            status.alignment = ["fill", "top"];
        }

        // ---------- 预设管理(v0.3.5):4 槽位 + 双层持久化 + 导出导入 ----------
        // 对齐 AE-Lyrics-Animator / Rolling-Lyrics / Water-Rise 方案:
        //   工程目录 quickkey_配置.json(跟工程走,读优先)+ app.settings(Section=QuickKey 全局保底)
        var SETTINGS_SECTION = "QuickKey";
        var SETTINGS_KEY_PREFIX = "preset_";
        var PRESET_FILENAME = "quickkey_配置.json";
        var loadBtns = [];   // 「使用」按钮(无数据时禁用)

        function getProjectPresetFile() {
            try {
                var pf = app.project.file;
                if (pf && pf.parent) { return new File(pf.parent.fsName + "/" + PRESET_FILENAME); }
            } catch (e) {}
            return null;
        }

        function readFromProjectFile() {
            try {
                var f = getProjectPresetFile();
                if (!f || !f.exists) { return null; }
                f.encoding = "UTF-8";
                if (!f.open("r")) { return null; }
                var txt = f.read();
                f.close();
                return (txt && txt.length > 0) ? txt : null;
            } catch (e) { return null; }
        }

        function writeToProjectFile(text) {
            try {
                var f = getProjectPresetFile();
                if (!f) { return false; }
                f.encoding = "UTF-8";
                if (!f.open("w")) { return false; }
                var ok = f.write(text);
                f.close();
                return ok;
            } catch (e) { return false; }
        }

        function deleteProjectFile() {
            try {
                var f = getProjectPresetFile();
                if (f && f.exists) { f.remove(); }
            } catch (e) {}
        }

        function readSlotFromSettings(idx) {
            try {
                if (app.settings.haveSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx)) {
                    return app.settings.getSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx);
                }
            } catch (e) {}
            return null;
        }

        function writeSlotToSettings(idx, text) {
            try { app.settings.saveSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx, text); return true; }
            catch (e) { return false; }
        }

        function deleteSlotFromSettings(idx) {
            try { app.settings.deleteSetting(SETTINGS_SECTION, SETTINGS_KEY_PREFIX + idx); } catch (e) {}
        }

        // 4 槽位 → 数组(空槽位 = {},供序列化)
        function slotsArray() {
            var arr = [];
            for (var i = 1; i <= 4; i++) { arr.push(state.slots[i] || {}); }
            return arr;
        }

        function hasAnyParam(obj) {
            if (!obj || typeof obj !== "object") { return false; }
            for (var k in obj) { return true; }
            return false;
        }

        // 存储当前全部参数到槽位(内存 + 双写)
        function saveSlot(idx) {
            var params = collectParams(state);
            state.slots[idx] = params;
            var fileOk = writeToProjectFile(stringifyConfig(params, state.curve.presets, slotsArray()));
            var setOk = writeSlotToSettings(idx, stringifyConfig(params, [], [{}, {}, {}, {}]));
            updatePresetButtons();
            setStatus("已存储槽位 " + idx + "(工程 " + (fileOk ? "✓" : "✗") + " · 全局 " + (setOk ? "✓" : "✗") + ")");
        }

        // 载入槽位:参数写回 state → 单向流刷新(改 state 即全面板重绘)
        function loadSlot(idx) {
            var p = state.slots[idx];
            if (!p || !hasAnyParam(p)) { setStatus("槽位 " + idx + " 无预设(先「存储」)"); return; }
            applyParamsToState(state, p);
            refresh();
            pal.layout.layout(true);
            setStatus("已载入槽位 " + idx + " 预设");
        }

        // 清除全部:内存 + 工程 JSON + 全局设置 三处
        function clearAllPresets() {
            state.slots = {};
            deleteProjectFile();
            for (var i = 1; i <= 4; i++) { deleteSlotFromSettings(i); }
            updatePresetButtons();
            setStatus("已清除全部预设(工程 JSON + 全局设置)");
        }

        // 复位:参数回默认(曲线库保留)
        function resetParams() {
            applyParamsToState(state, {});
            refresh();
            pal.layout.layout(true);
            setStatus("参数已复位为默认值");
        }

        // 启动时载入槽位:工程 JSON 优先,app.settings 保底(只恢复槽位,不覆盖当前参数)
        function loadSlotsFromStorage() {
            var txt = readFromProjectFile();
            if (txt) {
                var cfg = parseConfigText(txt);
                if (cfg) {
                    for (var i = 0; i < 4; i++) {
                        if (hasAnyParam(cfg.slots[i])) { state.slots[i + 1] = cfg.slots[i]; }
                    }
                    return;
                }
            }
            for (var j = 1; j <= 4; j++) {
                var st = readSlotFromSettings(j);
                if (st) {
                    var c2 = parseConfigText(st);
                    if (c2 && hasAnyParam(c2.params)) { state.slots[j] = c2.params; }
                }
            }
        }

        // 导出配置:当前参数 + 曲线库 + 4 槽位 全量备份(UTF-8)
        function exportConfig() {
            try {
                var f = File.saveDialog("导出 QuickKey 全参数配置 (JSON)",
                    "JSON 文件:*.json;*.*", projectFileDir() + "/quickkey_配置.json");
                if (!f) { return; }
                f.encoding = "UTF-8";
                if (!f.open("w")) { setStatus("导出失败:无法写入文件"); return; }
                var txt = stringifyConfig(collectParams(state), state.curve.presets, slotsArray());
                var ok = f.write(txt);
                f.close();
                setStatus(ok ? "已导出全参数配置 → " + f.fsName : "导出失败:写入出错");
            } catch (e) { setStatus("导出失败:" + errMsg(e)); }
        }

        // 导入配置:应用当前参数 + 合并曲线库 + 载入槽位
        function importConfig() {
            try {
                var f = File.openDialog("导入 QuickKey 全参数配置 (JSON)", "JSON 文件:*.json;*.*");
                if (!f) { return; }
                f.encoding = "UTF-8";
                if (!f.open("r")) { setStatus("导入失败:无法打开文件"); return; }
                var txt = f.read();
                f.close();
                var cfg = parseConfigText(txt);
                if (!cfg || !cfg.params) { setStatus("导入失败:文件里没有合法配置"); return; }
                applyParamsToState(state, cfg.params);
                if (cfg.presets && cfg.presets.length > 0) {
                    state.curve.presets = mergePresets(state.curve.presets, cfg.presets);
                }
                for (var i = 0; i < 4; i++) {
                    if (hasAnyParam(cfg.slots[i])) { state.slots[i + 1] = cfg.slots[i]; }
                }
                rebuildPresetDropdowns();
                refresh();
                pal.layout.layout(true);
                updatePresetButtons();
                setStatus("已导入配置:参数 + " + (cfg.presets ? cfg.presets.length : 0)
                    + " 个曲线预设 + 槽位");
            } catch (e) { setStatus("导入失败:" + errMsg(e)); }
        }

        // 「使用」按钮可用性:槽位有数据才可点
        function updatePresetButtons() {
            for (var i = 0; i < loadBtns.length; i++) {
                loadBtns[i].enabled = hasAnyParam(state.slots[i + 1]);
            }
        }

        // 预设管理 UI:存储 1-4 | 清除全部 / 使用 1-4 | 复位 / 导出配置 | 导入配置
        function buildPresetArea() {
            var pPre = pal.add("panel", undefined, "预设管理(工程 JSON + 全局设置双层存储)");
            pPre.orientation = "column";
            pPre.alignChildren = ["fill", "top"];
            pPre.spacing = 4;
            var saveRow = pPre.add("group");
            saveRow.orientation = "row";
            saveRow.alignChildren = ["left", "center"];
            saveRow.spacing = 4;
            var sLbl = saveRow.add("statictext", undefined, "存储");
            sLbl.preferredSize.width = 40;
            for (var i = 1; i <= 4; i++) {
                (function (idx) {
                    var b = saveRow.add("button", undefined, String(idx));
                    b.preferredSize.width = 28;
                    b.onClick = function () { saveSlot(idx); };
                })(i);
            }
            var btnClear = saveRow.add("button", undefined, "清除全部");
            btnClear.onClick = clearAllPresets;
            var loadRow = pPre.add("group");
            loadRow.orientation = "row";
            loadRow.alignChildren = ["left", "center"];
            loadRow.spacing = 4;
            var lLbl = loadRow.add("statictext", undefined, "使用");
            lLbl.preferredSize.width = 40;
            for (var j = 1; j <= 4; j++) {
                (function (idx) {
                    var b2 = loadRow.add("button", undefined, String(idx));
                    b2.preferredSize.width = 28;
                    b2.enabled = false;
                    b2.onClick = function () { loadSlot(idx); };
                    loadBtns.push(b2);
                })(j);
            }
            var btnReset = loadRow.add("button", undefined, "复位");
            btnReset.onClick = resetParams;
            var ioRow = pPre.add("group");
            ioRow.orientation = "row";
            ioRow.alignChildren = ["left", "center"];
            ioRow.spacing = 4;
            var btnExp = ioRow.add("button", undefined, "导出配置");
            btnExp.onClick = exportConfig;
            var btnImp = ioRow.add("button", undefined, "导入配置");
            btnImp.onClick = importConfig;
        }

        // 段下拉与当前 4 值同步:匹配预设 → 显示预设名;否则「自定义」
        function syncSegDropdown(si) {
            var it = segPool.get(si);
            if (!it) { return; }
            var seg = ensureCurveSeg(si);
            var idx = matchPreset(state.curve.presets, seg.x1, seg.y1, seg.x2, seg.y2);
            if (idx >= 0) {
                seg.preset = state.curve.presets[idx].name;
                it.dd.selection = it.dd.items[idx + 1];   // items[0] = 自定义
            } else {
                seg.preset = "自定义";
                it.dd.selection = it.dd.items[0];
            }
        }

        // 重建全部段下拉 items(导入/导出后调用):自定义 + 全部预设(仅已建行)
        function rebuildPresetDropdowns() {
            for (var i = 0; i < segPool.rows.length; i++) {
                var it = segPool.rows[i];
                it.dd.removeAll();
                it.dd.add("item", "自定义");
                for (var j = 0; j < state.curve.presets.length; j++) {
                    it.dd.add("item", state.curve.presets[j].name);
                }
                syncSegDropdown(i + 1);
            }
        }

        // ---------- 刷新(拆分,每块管一件事;refresh 为唯一渲染入口)----------

        // 顶部:表达式行显隐 + 按钮文案(v0.3.0 拆分)
        function refreshHeader() {
            grpExpr.visible = (state.vtype === 3);
            btnKey.text = (state.vtype === 3) ? "应用表达式(选中属性)" : "打帧(全部开启的节点)";
        }

        // 节点行:开关/间隔/数值/时间(v0.3.0 拆分)
        function refreshNodes() {
            var a = anchorPos(state.mode, state.count);
            var times = computeTimes(state.mode, state.gap, state.on, state.count);
            var dim = (state.vtype === 3) ? 0 : state.vtype + 1;
            for (var s = 1; s <= state.count; s++) {
                var it = nodePool.get(s);
                var isAnchor = (s === a);
                it.chk.visible = !isAnchor;
                it.inp.visible = !isAnchor;
                var cells = state.val[s];
                for (var k = 0; k < 3; k++) {
                    it.vin[k].visible = (k < dim);
                    it.vin[k].enabled = isAnchor ? true : state.on[s];
                    it.vin[k].text = cells[k];   // 直读格子(v0.1.7)
                }
                if (isAnchor) {
                    it.lbl.text = "锚点";
                    it.tme.text = "固定 +0";
                } else {
                    it.lbl.text = "节点" + s;
                    it.chk.value = state.on[s];
                    it.inp.enabled = state.on[s];
                    it.inp.text = String(state.gap[s]);
                    it.tme.text = state.on[s] ? fmtFrames(times[s]) : "关闭";
                }
            }
        }

        // 曲线段行:开关开启且非表达式模式时显示,懒增长 + 填值(v0.3.0 拆分)
        function refreshCurve() {
            var curveShow = state.curve.enabled && state.vtype !== 3;
            grpSegs.visible = curveShow;
            if (curveShow) {
                var segList = curveSegments(state.on, state.count);
                var added = segPool.ensure(segList.length);
                if (added) { pal.layout.layout(true); }
                for (var si = 1; si <= segList.length; si++) {
                    var it = segPool.get(si);
                    it.lbl.text = "段" + si + ":节点" + segList[si - 1][0] + "→" + segList[si - 1][1];
                    var seg = ensureCurveSeg(si);
                    it.ins[0].text = String(seg.x1);
                    it.ins[1].text = String(seg.y1);
                    it.ins[2].text = String(seg.x2);
                    it.ins[3].text = String(seg.y2);
                    syncSegDropdown(si);
                }
            } else {
                segPool.hideAll();   // 曲线关/表达式模式:隐藏已建的段行
            }
        }

        // 唯一渲染入口:顶部 → 节点 → 曲线
        function refresh() {
            refreshHeader();
            refreshNodes();
            refreshCurve();
        }

        // ---------- 初始化 ----------
        buildHeader();
        buildNodeArea();
        buildCurveArea();
        buildPresetArea();
        buildFooter();
        loadSlotsFromStorage();    // v0.3.5:启动恢复槽位(工程 JSON 优先)
        updatePresetButtons();
        nodePool.ensure(state.count);
        refresh();   // 曲线段行懒增长:refresh() 里按需建

        if (pal instanceof Window) { pal.center(); pal.show(); }
        else { pal.layout.layout(true); }
    }

    // ---------- 测试钩子(node 环境) ----------
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            computeTimes: computeTimes,
            classifyValue: classifyValue,
            anchorPos: anchorPos,
            buildPlan: buildPlan,
            planHasExplicit: planHasExplicit,
            propDimCore: propDimCore,
            matchPreset: matchPreset,
            curveSegments: curveSegments,
            mergePresets: mergePresets,
            validatePresets: validatePresets,
            isLinearPreset: isLinearPreset,
            bezierToEase: bezierToEase,   // v0.2.12:bezier→AE 缓动转换(纯函数)
            valDiff: valDiff,
            valSignedDiff: valSignedDiff,   // v0.3.7:带符号值差(曲线减少方向修复)
            setKeyAt: setKeyAt,   // v0.2.11:打帧即得索引(addKey),导出供 mock 核验
            applySegCurves: applySegCurves,   // v0.2.4:导出供 node mock 核验调用序列
            stringifyPresets: stringifyPresets,
            extractPresetsFallback: extractPresetsFallback,
            parsePresetsText: parsePresetsText,
            collectParams: collectParams,                 // v0.3.5 全参数预设
            applyParamsToState: applyParamsToState,
            decodeOn: decodeOn,
            decodeNums: decodeNums,
            decodeVal: decodeVal,
            decodeSeg: decodeSeg,
            jsonStringify: jsonStringify,
            stringifyConfig: stringifyConfig,
            parseConfigText: parseConfigText,
            extractParamsFromBlock: extractParamsFromBlock,
            extractSlotsFallback: extractSlotsFallback,
            MODE_NAMES: MODE_NAMES
        };
    }

})(this);
