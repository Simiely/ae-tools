// QuickKey 回归测试(node 直接运行)
// 用法: node test_quickkey.js
// 守护:computeTimes(三模式+关闭剔除+动态节点数)、anchorPos、classifyValue、
//       buildPlan/planHasExplicit(v0.1.14)、propDimCore(v0.1.17 维度定案)
var QK = require("./QuickKey.jsx");
var failures = 0;

// v0.2.4:mock AE 全局(applySegCurves 运行时才引用,require 前设置)
// v0.2.8:mock 也模拟真实约束——influence 合法范围 [0.1..100](官方文档),
// 越界直接抛错(和 AE 一致),让"influence=0 构造抛错"这类 bug 在测试里暴露
global.KeyframeEase = function (speed, influence) {
    if (influence < 0.1 || influence > 100) {
        throw new Error("KeyframeEase influence out of range [0.1..100]: " + influence);
    }
    this.speed = speed;
    this.influence = influence;
};
global.KeyframeInterpolationType = {LINEAR: 0, BEZIER: 1};

function eq(name, actual, expected) {
    var a = JSON.stringify(actual);
    var e = JSON.stringify(expected);
    if (a === e) { console.log("PASS  " + name); }
    else { console.log("FAIL  " + name + "  got " + a + " want " + e); failures++; }
}

var ALL = {1: true, 2: true, 3: true, 4: true, 5: true};

// ---- computeTimes:三种模式 + 非均匀间隔(回归:v0.1.2 修复倒推取错 gap) ----
var g = {1: 3, 2: 7, 3: 5, 4: 2, 5: 9};
eq("起始帧(非均匀)", QK.computeTimes(0, g, ALL, 5), {1: 0, 2: 7, 3: 12, 4: 14, 5: 23});
eq("中间帧(非均匀)", QK.computeTimes(1, g, ALL, 5), {1: -10, 2: -7, 3: 0, 4: 2, 5: 11});
eq("末尾帧(非均匀)", QK.computeTimes(2, g, ALL, 5), {1: -17, 2: -14, 3: -7, 4: -2, 5: 0});

// ---- 默认均匀间隔(全 5) ----
var g5 = {1: 5, 2: 5, 3: 5, 4: 5, 5: 5};
eq("起始帧(默认5)", QK.computeTimes(0, g5, ALL, 5), {1: 0, 2: 5, 3: 10, 4: 15, 5: 20});
eq("中间帧(默认5)", QK.computeTimes(1, g5, ALL, 5), {1: -10, 2: -5, 3: 0, 4: 5, 5: 10});
eq("末尾帧(默认5)", QK.computeTimes(2, g5, ALL, 5), {1: -20, 2: -15, 3: -10, 4: -5, 5: 0});

// ---- 对称性:锚点两侧相邻节点的间距 = 各自 gap(间隔语义的核心) ----
var t = QK.computeTimes(1, g, ALL, 5);
eq("间距 节点2↔锚点 = gap2", t[3] - t[2], g[2]);
eq("间距 节点4↔锚点 = gap4", t[4] - t[3], g[4]);

// ---- 关闭节点剔除(v0.1.3):关闭 = null,后续节点按最近开启节点重算 ----
var off2 = {1: true, 2: false, 3: true, 4: true, 5: true};
eq("中间帧 关节点2", QK.computeTimes(1, g, off2, 5), {1: -3, 2: null, 3: 0, 4: 2, 5: 11});
var off4 = {1: true, 2: true, 3: true, 4: false, 5: true};
eq("末尾帧 关节点4", QK.computeTimes(2, g, off4, 5), {1: -15, 2: -12, 3: -5, 4: null, 5: 0});
var off3 = {1: true, 2: true, 3: false, 4: true, 5: true};
eq("起始帧 关节点3", QK.computeTimes(0, g, off3, 5), {1: 0, 2: 7, 3: null, 4: 9, 5: 18});
var off12 = {1: false, 2: false, 3: true, 4: true, 5: true};
eq("中间帧 关节点1/2", QK.computeTimes(1, g, off12, 5), {1: null, 2: null, 3: 0, 4: 2, 5: 11});

// ---- 动态节点数(v0.1.4):N 任意,锚点 = 起始1 / 中间⌈N/2⌉ / 末尾N ----
var gN = {};
for (var i = 1; i <= 30; i++) { gN[i] = 5; }
var ALLN = {};
for (var j = 1; j <= 30; j++) { ALLN[j] = true; }
eq("N=7 中间帧", QK.computeTimes(1, gN, ALLN, 7), {1: -15, 2: -10, 3: -5, 4: 0, 5: 5, 6: 10, 7: 15});
eq("N=4 中间帧(偶数偏上)", QK.computeTimes(1, gN, ALLN, 4), {1: -5, 2: 0, 3: 5, 4: 10});
eq("N=8 末尾帧", QK.computeTimes(2, gN, ALLN, 8), {1: -35, 2: -30, 3: -25, 4: -20, 5: -15, 6: -10, 7: -5, 8: 0});
eq("N=6 起始帧", QK.computeTimes(0, gN, ALLN, 6), {1: 0, 2: 5, 3: 10, 4: 15, 5: 20, 6: 25});
var offN5 = {1: true, 2: true, 3: true, 4: true, 5: false, 6: true, 7: true};
eq("N=7 中间帧 关节点5", QK.computeTimes(1, gN, offN5, 7), {1: -15, 2: -10, 3: -5, 4: 0, 5: null, 6: 5, 7: 10});

// ---- anchorPos 锚点位置规则 ----
eq("anchorPos 起始9", QK.anchorPos(0, 9), 1);
eq("anchorPos 中间5", QK.anchorPos(1, 5), 3);
eq("anchorPos 中间6(偶数偏上)", QK.anchorPos(1, 6), 3);
eq("anchorPos 中间7", QK.anchorPos(1, 7), 4);
eq("anchorPos 末尾9", QK.anchorPos(2, 9), 9);

// ---- classifyValue(v0.1.7):cells 数组格子,empty/fixed/bad ----
eq("1空 全空 → empty", QK.classifyValue(["", "", ""], 1), {kind: "empty"});
eq("3空 空格 → empty", QK.classifyValue([" ", " ", " "], 3), {kind: "empty"});
eq("1空 单值", QK.classifyValue(["100", "", ""], 1), {kind: "fixed", value: 100});
eq("1空 尾格残留(回归 123,,)", QK.classifyValue(["123", "", ""], 1), {kind: "fixed", value: 123});
eq("1空 非法 → bad", QK.classifyValue(["abc", "", ""], 1), {kind: "bad"});
eq("1空 框内逗号 → bad", QK.classifyValue(["960, 540", "", ""], 1), {kind: "bad"});
eq("2空 全填", QK.classifyValue(["960", "540", ""], 2), {kind: "fixed", value: [960, 540]});
eq("2空 只填1个 → bad", QK.classifyValue(["960", "", ""], 2), {kind: "bad"});
eq("2空 缺框 → bad", QK.classifyValue(["960"], 2), {kind: "bad"});
eq("3空 三维", QK.classifyValue(["1", "2", "3"], 3), {kind: "fixed", value: [1, 2, 3]});
eq("3空 部分 → bad", QK.classifyValue(["1", "2", ""], 3), {kind: "bad"});

// ---- buildPlan / planHasExplicit(v0.1.14 重构:计划生成纯函数) ----
var VEMPTY = {1: ["", "", ""], 2: ["", "", ""], 3: ["", "", ""], 4: ["", "", ""], 5: ["", "", ""]};
var pA = QK.buildPlan(0, 5, g5, ALL, VEMPTY, 1);
eq("buildPlan 起始帧全空", pA, [
    {slot: 1, isAnchor: true,  closed: false, offset: 0,  kind: "empty", value: null, raw: ""},
    {slot: 2, isAnchor: false, closed: false, offset: 5,  kind: "empty", value: null, raw: ""},
    {slot: 3, isAnchor: false, closed: false, offset: 10, kind: "empty", value: null, raw: ""},
    {slot: 4, isAnchor: false, closed: false, offset: 15, kind: "empty", value: null, raw: ""},
    {slot: 5, isAnchor: false, closed: false, offset: 20, kind: "empty", value: null, raw: ""}
]);
eq("planHasExplicit 全空=false", QK.planHasExplicit(pA), false);
var VB = {1: ["", "", ""], 2: ["100", "", ""], 3: ["", "", ""], 4: ["", "", ""], 5: ["", "", ""]};
var pB = QK.buildPlan(1, 5, g5, ALL, VB, 1);
eq("buildPlan 中间帧含显式值", pB, [
    {slot: 1, isAnchor: false, closed: false, offset: -10, kind: "empty", value: null, raw: ""},
    {slot: 2, isAnchor: false, closed: false, offset: -5,  kind: "fixed", value: 100, raw: "100"},
    {slot: 3, isAnchor: true,  closed: false, offset: 0,   kind: "empty", value: null, raw: ""},
    {slot: 4, isAnchor: false, closed: false, offset: 5,   kind: "empty", value: null, raw: ""},
    {slot: 5, isAnchor: false, closed: false, offset: 10,  kind: "empty", value: null, raw: ""}
]);
eq("planHasExplicit 有显式=true", QK.planHasExplicit(pB), true);
var VC = {1: ["50", "", ""], 2: ["", "", ""], 3: ["", "", ""], 4: ["", "", ""], 5: ["", "", ""]};
var off2 = {1: true, 2: false, 3: true, 4: true, 5: true};
var pC = QK.buildPlan(0, 5, g5, off2, VC, 1);
eq("buildPlan 关闭节点剔除", pC, [
    {slot: 1, isAnchor: true,  closed: false, offset: 0,  kind: "fixed", value: 50, raw: "50"},
    {slot: 2, isAnchor: false, closed: true,  offset: null, kind: null, value: null, raw: ""},
    {slot: 3, isAnchor: false, closed: false, offset: 5,  kind: "empty", value: null, raw: ""},
    {slot: 4, isAnchor: false, closed: false, offset: 10, kind: "empty", value: null, raw: ""},
    {slot: 5, isAnchor: false, closed: false, offset: 15, kind: "empty", value: null, raw: ""}
]);
eq("planHasExplicit 关闭但有显式=true", QK.planHasExplicit(pC), true);

// ---- propDimCore(v0.1.17 维度定案):AE 2026 实测枚举 6413~6417 ----
eq("2D图层 位置(6413)→2", QK.propDimCore("ADBE Position", 6413, false), 2);
eq("3D图层 位置(6413)→3", QK.propDimCore("ADBE Position", 6413, true), 3);
eq("2D图层 缩放(6414)→2", QK.propDimCore("ADBE Scale", 6414, false), 2);
eq("2D图层 锚点(6413)→2", QK.propDimCore("ADBE Anchor Point", 6413, false), 2);
eq("不透明度(6417)→1 恒1维", QK.propDimCore("ADBE Opacity", 6417, false), 1);
eq("旋转Z(6417)→1 即使3D图层", QK.propDimCore("ADBE Rotate Z", 6417, true), 1);
eq("找不到图层 位置→退回类型3", QK.propDimCore("ADBE Position", 6413, null), 3);
eq("非变换2D点(6415)→2", QK.propDimCore("My Effect Point", 6415, false), 2);
eq("非变换3D点(6413)→3", QK.propDimCore("My Effect Point", 6413, false), 3);
// ---- v0.1.18:分离尺寸跟随者恒 1 维 ----
eq("分离位置X(6413,isSep)→1", QK.propDimCore("ADBE Position", 6413, false, true), 1);
eq("分离缩放X(6414,isSep)→1", QK.propDimCore("ADBE Scale", 6414, false, true), 1);

// ---- 曲线纯函数(v0.2.0):matchPreset / isLinearPreset / curveSegments / mergePresets / validatePresets / valDiff ----
eq("isLinear 线性", QK.isLinearPreset(0, 0, 1, 1), true);
eq("isLinear 缓入非线", QK.isLinearPreset(0.42, 0, 1, 1), false);

var P4 = [
    {name: "线性",     x1: 0,    y1: 0,    x2: 1,    y2: 1},
    {name: "缓入",     x1: 0.42, y1: 0,    x2: 1,    y2: 1},
    {name: "缓出",     x1: 0,    y1: 0,    x2: 0.58, y2: 1},
    {name: "缓入缓出", x1: 0.42, y1: 0,    x2: 0.58, y2: 1}
];
eq("matchPreset 线性", QK.matchPreset(P4, 0, 0, 1, 1), 0);
eq("matchPreset 缓入缓出", QK.matchPreset(P4, 0.42, 0, 0.58, 1), 3);
eq("matchPreset 浮点容差(0.4200001)", QK.matchPreset(P4, 0.4200001, 0, 0.58, 1), 3);
eq("matchPreset 不匹配 → -1", QK.matchPreset(P4, 0.5, 0.5, 0.5, 0.5), -1);
eq("matchPreset 空列表 → -1", QK.matchPreset([], 0, 0, 1, 1), -1);

eq("curveSegments 全开5", QK.curveSegments(ALL, 5), [[1, 2], [2, 3], [3, 4], [4, 5]]);
eq("curveSegments 关节点2 → 1→3直连", QK.curveSegments(off2, 5), [[1, 3], [3, 4], [4, 5]]);
eq("curveSegments 关节点3/5", QK.curveSegments({1: true, 2: true, 3: false, 4: true, 5: false}, 5), [[1, 2], [2, 4]]);
eq("curveSegments 只开1个 → 0段", QK.curveSegments({1: true, 2: false, 3: false}, 3), []);
eq("curveSegments N=7 全开", QK.curveSegments(ALLN, 7), [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]);

var orig = [{name: "线性", x1: 0, y1: 0, x2: 1, y2: 1}];
var imp1 = [{name: "线性", x1: 0.1, y1: 0.2, x2: 0.8, y2: 1}, {name: "回弹", x1: 0.2, y1: 1.4, x2: 0.7, y2: 0.6}];
var merged = QK.mergePresets(orig, imp1);
eq("mergePresets 同名覆盖 + 追加", merged, [
    {name: "线性", x1: 0.1, y1: 0.2, x2: 0.8, y2: 1},
    {name: "回弹", x1: 0.2, y1: 1.4, x2: 0.7, y2: 0.6}
]);
eq("mergePresets 不改原数组", orig, [{name: "线性", x1: 0, y1: 0, x2: 1, y2: 1}]);
eq("mergePresets 深拷贝不共享引用", (merged[0] !== orig[0]), true);

eq("validatePresets 标准格式", QK.validatePresets({version: 1, presets: imp1}), [
    {name: "线性", x1: 0.1, y1: 0.2, x2: 0.8, y2: 1},
    {name: "回弹", x1: 0.2, y1: 1.4, x2: 0.7, y2: 0.6}
]);
eq("validatePresets 裸数组", QK.validatePresets([{name: "A", x1: 0, y1: 0, x2: 1, y2: 1}]), [
    {name: "A", x1: 0, y1: 0, x2: 1, y2: 1}
]);
eq("validatePresets 过滤非法(x2>1)", QK.validatePresets({presets: [
    {name: "ok", x1: 0, y1: 0, x2: 1, y2: 1},
    {name: "bad-x", x1: 0, y1: 0, x2: 1.5, y2: 1},
    {name: "", x1: 0, y1: 0, x2: 1, y2: 1},
    {name: "bad-nan", x1: "a", y1: 0, x2: 1, y2: 1},
    {name: "no-nums", x1: 0, y1: 0, x2: 1}
]}), [{name: "ok", x1: 0, y1: 0, x2: 1, y2: 1}]);
eq("validatePresets 格式错误 → null", QK.validatePresets("hello"), null);
eq("validatePresets null → null", QK.validatePresets(null), null);
eq("validatePresets y 可超1(回弹)", QK.validatePresets({presets: [{name: "弹", x1: 0.2, y1: 1.4, x2: 0.7, y2: 0.6}]}), [
    {name: "弹", x1: 0.2, y1: 1.4, x2: 0.7, y2: 0.6}
]);

eq("valDiff 数字", QK.valDiff(100, 40), 60);
eq("valDiff 数组最大维差", QK.valDiff([100, 100], [50, 80]), 50);
eq("valDiff 同值 → 0", QK.valDiff([50, 50], [50, 50]), 0);
eq("valDiff 类型不匹配 → 0", QK.valDiff(100, [50, 80]), 0);

// ---- 迷你 JSON(v0.2.1):stringifyPresets / parsePresetsText / extractPresetsFallback ----
var PEX = [
    {name: "线性", x1: 0, y1: 0, x2: 1, y2: 1},
    {name: "回弹", x1: 0.2, y1: 1.4, x2: 0.7, y2: 0.6}
];
var PEX_JSON = QK.stringifyPresets(PEX);
eq("stringifyPresets 含字段", (PEX_JSON.indexOf('"name": "线性"') >= 0
    && PEX_JSON.indexOf('"x1": 0') >= 0 && PEX_JSON.indexOf('"y1": 1.4') >= 0
    && PEX_JSON.indexOf('"x2": 0.7') >= 0 && PEX_JSON.indexOf('"y2": 0.6') >= 0), true);
eq("stringifyPresets 是标准 JSON(node 可解析)", JSON.parse(PEX_JSON).presets.length, 2);
eq("parsePresetsText round-trip(node 走 JSON 分支)", QK.parsePresetsText(PEX_JSON), PEX);
eq("extractPresetsFallback 手写分支", QK.extractPresetsFallback(PEX_JSON), PEX);
eq("extractPresetsFallback 空 → null", QK.extractPresetsFallback("no json here"), null);
eq("extractPresetsFallback 过滤非法", QK.extractPresetsFallback(
    '{"presets": [{"name":"ok","x1":0,"y1":0,"x2":1,"y2":1},'
    + '{"name":"bad-x","x1":0,"y1":0,"x2":1.5,"y2":1}]}'
), [{name: "ok", x1: 0, y1: 0, x2: 1, y2: 1}]);
eq("parsePresetsText 垃圾 → null", QK.parsePresetsText("???not json???"), null);

// ---- applySegCurves 调用序列核验(v0.2.4/0.2.6,mock prop 记录调用) ----
// v0.2.6:mock 也校验 setTemporalEaseAtKey 的【数组参数】(官方 API 要求
// 1D/2D/3D 属性分别传 1/2/3 个 KeyframeEase——之前传单个对象是真机不生效的根因)
function mockProp(failEase, mn) {
    var log = {interp: [], ease: [], key: []};
    var keys = [];   // 模拟关键帧 [{time, value}]
    return {
        log: log,
        propertyValueType: 6417,          // OneD(1 维,旋转)
        matchName: mn || "ADBE Rotate Z",
        value: 0,
        numKeys: 0,
        keyframeTime: function (k) { return keys[k - 1].time; },
        addKey: function (t) { keys.push({time: t, value: 0}); return keys.length; },   // 官方:返回新帧索引
        setValueAtKey: function (idx, wv) {
            keys[idx - 1].value = wv;
            log.key.push({idx: idx, v: wv});
        },
        setValueAtTime: function (t, wv) { keys.push({time: t, value: wv}); return keys.length; },
        nearestKeyIndex: function (t) { return 0; },   // findKeyIndex 兜底用(mock: 找不到)
        setInterpolationTypeAtKey: function (idx) { log.interp.push(idx); },
        setTemporalEaseAtKey: function (idx, ei, eo) {
            if (failEase) { throw new Error("mock ease 调用失败"); }
            log.ease.push({
                idx: idx,
                eiLen: ei ? ei.length : 0,
                eiInf: ei && ei[0] ? ei[0].influence : null,
                eiSpd: ei && ei[0] ? ei[0].speed : null,
                eoLen: eo ? eo.length : 0,
                eoInf: eo && eo[0] ? eo[0].influence : null,
                eoSpd: eo && eo[0] ? eo[0].speed : null
            });
        }
    };
}
// 3 帧(idx 1/2/3)+ 2 段;值 0→100→200、时差 1s → 平均速度 avg=100
// v0.2.9 社区公式验证:X→影响(钳 0.1~100)、Y→速度(×avg 归一化)
var F3 = [{t: 0, v: 0, idx: 1}, {t: 1, v: 100, idx: 2}, {t: 2, v: 200, idx: 3}];
var mp1 = mockProp();
var r1 = QK.applySegCurves(mp1, F3, [
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1},   // 缓入缓出
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1}
]);
eq("applySegCurves 全缓入缓出 applied=3", r1.applied, 3);
eq("applySegCurves 全缓入缓出 插值全 BEZIER", mp1.log.interp, [1, 2, 3]);
eq("applySegCurves 全缓入缓出 ease(影响=X、速度=Y)", mp1.log.ease, [
    {idx: 1, eiLen: 1, eiInf: 0.1, eiSpd: 0, eoLen: 1, eoInf: 42, eoSpd: 0},    // 帧1:入中性,出影响 x1×100=42
    {idx: 2, eiLen: 1, eiInf: 42, eiSpd: 0, eoLen: 1, eoInf: 42, eoSpd: 0},     // 帧2:入影响 (1−0.58)×100=42
    {idx: 3, eiLen: 1, eiInf: 42, eiSpd: 0, eoLen: 1, eoInf: 0.1, eoSpd: 0}     // 末帧:出中性
]);
var mp2 = mockProp();
var r2 = QK.applySegCurves(mp2, F3, [
    {x1: 0, y1: 0, x2: 1, y2: 1},   // 线性
    {x1: 0, y1: 0, x2: 1, y2: 1}
]);
eq("applySegCurves 全线性 完全不动", (r2.applied === 0 && r2.missed === 0 && mp2.log.interp.length === 0 && mp2.log.ease.length === 0), true);
var mp3 = mockProp();
var r3 = QK.applySegCurves(mp3, F3, [
    {x1: 0.42, y1: 0, x2: 1, y2: 1},  // 缓入
    {x1: 0, y1: 0, x2: 1, y2: 1}      // 线性(混合场景,核验修复:线性侧不污染)
]);
eq("applySegCurves 缓入+线性 applied=2", r3.applied, 2);
eq("applySegCurves 缓入+线性 插值 1/2(帧3 线性跳过)", mp3.log.interp, [1, 2]);
eq("applySegCurves 缓入+线性 ease(帧3 线性不被污染)", mp3.log.ease, [
    {idx: 1, eiLen: 1, eiInf: 0.1, eiSpd: 0, eoLen: 1, eoInf: 42, eoSpd: 0},    // 帧1:出影响 42
    {idx: 2, eiLen: 1, eiInf: 0.1, eiSpd: 100, eoLen: 1, eoInf: 0.1, eoSpd: 100} // 帧2:入=x2=1→影响0.1/速度退avg;出=线性段匀速(avg=100, v0.2.14)
]);
var mp4 = mockProp();
var r4 = QK.applySegCurves(mp4, F3, [
    {x1: 0, y1: 0, x2: 1, y2: 1},
    {x1: 0.42, y1: 0, x2: 1, y2: 1}
]);
eq("applySegCurves 线性+缓入 applied=2", r4.applied, 2);
eq("applySegCurves 线性+缓入 ease(帧1 不动)", mp4.log.ease, [
    {idx: 2, eiLen: 1, eiInf: 0.1, eiSpd: 100, eoLen: 1, eoInf: 42, eoSpd: 0},     // 帧2:入=线性段匀速(avg=100,v0.2.14);出=段2 出影响 42
    {idx: 3, eiLen: 1, eiInf: 0.1, eiSpd: 100, eoLen: 1, eoInf: 0.1, eoSpd: 0}  // 帧3:入=x2=1→影响0.1/速度退avg
]);
var mp5 = mockProp();
var r5 = QK.applySegCurves(mp5, [{t: 0, v: 0, idx: 0}, {t: 1, v: 100, idx: 2}], [
    {x1: 0.42, y1: 0, x2: 1, y2: 1}
]);
eq("applySegCurves idx=0 → missed", (r5.applied === 1 && r5.missed === 1), true);
eq("applySegCurves idx=0 → missIdx 计数", r5.missIdx, 1);

// v0.2.10:missed 细分——调用异常(mock setTemporalEaseAtKey 抛错)
var mp6 = mockProp(true);
var r6 = QK.applySegCurves(mp6, F3, [
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1},   // 缓入缓出
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1}
]);
eq("applySegCurves 调用异常 applied=0", r6.applied, 0);
eq("applySegCurves 调用异常 missErr=3", r6.missErr, 3);
eq("applySegCurves 调用异常 missIdx=0(非索引问题)", r6.missIdx, 0);
eq("applySegCurves 调用异常 missErrMsg 带文本", (r6.missErrMsg !== ""), true);

// ---- setKeyAt(v0.2.11):打帧即得索引(官方 addKey 方案,消灭"打完再找") ----
// 场景1:无已有帧 → addKey 创建并返回索引,setValueAtKey 设值
var sk1 = mockProp();
var sk1idx = QK.setKeyAt(sk1, 0.5, 100);
eq("setKeyAt 无已有帧 addKey 返回索引=1", sk1idx, 1);
eq("setKeyAt 无已有帧 setValueAtKey 设值", sk1.log.key, [{idx: 1, v: 100}]);

// 场景2:已有帧(容差 0.05 内)→ 复用索引,不调 addKey
var sk2 = {
    numKeys: 1,
    keyframeTime: function (k) { return 0.5; },
    addKey: function (t) { throw new Error("不应调用 addKey"); },
    setValueAtKey: function (idx, wv) { this._idx = idx; this._v = wv; }
};
var sk2idx = QK.setKeyAt(sk2, 0.52, 200);
eq("setKeyAt 已有帧 复用索引=1", sk2idx, 1);
eq("setKeyAt 已有帧 setValueAtKey(1,200)", (sk2._idx === 1 && sk2._v === 200), true);

// 场景3:keyframeTime 遍历抛错 → addKey 兜底拿索引
var sk3 = {
    numKeys: 1,
    keyframeTime: function (k) { throw new Error("numKeys 异常"); },
    addKey: function (t) { return 5; },
    setValueAtKey: function (idx, wv) { this._idx = idx; this._v = wv; }
};
var sk3idx = QK.setKeyAt(sk3, 0.5, 300);
eq("setKeyAt keyframeTime 抛错 → addKey 兜底返回 5", sk3idx, 5);
eq("setKeyAt 兜底 setValueAtKey(5,300)", (sk3._idx === 5 && sk3._v === 300), true);

// ---- bezierToEase(v0.2.12 重写,纯转换函数,公式集中一处) ----
// 缓入缓出(0.42 0 0.58 1,avg=100):X→影响 42、Y→速度 0(两头静止)
eq("bezierToEase 缓入缓出", QK.bezierToEase(0.42, 0, 0.58, 1, 100), {
    out: {speed: 0, influence: 42},
    inE: {speed: 0, influence: 42}
});
// 线性(0 0 1 1)→ null(两侧中性,保持 AE 默认线性)
eq("bezierToEase 线性 → null", QK.bezierToEase(0, 0, 1, 1, 100), null);
// 缓入(0.42 0 1 1):出影响 42/速度 0;入侧 x2=1 除零退 avg=100、影响钳 0.1
eq("bezierToEase 缓入", QK.bezierToEase(0.42, 0, 1, 1, 100), {
    out: {speed: 0, influence: 42},
    inE: {speed: 100, influence: 0.1}
});
// 缓出(0 0 0.58 1):出侧 x1=0 除零退 avg=100、影响钳 0.1;入影响 (1−0.58)×100=42
eq("bezierToEase 缓出", QK.bezierToEase(0, 0, 0.58, 1, 100), {
    out: {speed: 100, influence: 0.1},
    inE: {speed: 0, influence: 42}
});

// ---- applySegCurves 端点平滑(v0.2.15,smoothEnd 参数) ----
// 全线性 + 平滑:帧1/帧3 转 BEZIER 端点速度 0(圆润),帧2 保持 LINEAR 跳过
var mp7 = mockProp();
var r7 = QK.applySegCurves(mp7, F3, [
    {x1: 0, y1: 0, x2: 1, y2: 1},
    {x1: 0, y1: 0, x2: 1, y2: 1}
], true);
eq("平滑 全线性 applied=2(端点帧)", r7.applied, 2);
eq("平滑 全线性 插值只 1/3(帧2 跳过)", mp7.log.interp, [1, 3]);
eq("平滑 全线性 ease(端点速度 0)", mp7.log.ease, [
    {idx: 1, eiLen: 1, eiInf: 0.1, eiSpd: 0, eoLen: 1, eoInf: 0.1, eoSpd: 0},
    {idx: 3, eiLen: 1, eiInf: 0.1, eiSpd: 0, eoLen: 1, eoInf: 0.1, eoSpd: 0}
]);
// 全缓入缓出 + 平滑:端点速度本就 0(缓入缓出 y1=0/y2=1),行为与硬模式一致
var mp8 = mockProp();
var r8 = QK.applySegCurves(mp8, F3, [
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1},
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1}
], true);
eq("平滑 全缓入缓出 applied=3(与硬一致)", r8.applied, 3);
eq("平滑 全缓入缓出 ease 同硬模式", mp8.log.ease, [
    {idx: 1, eiLen: 1, eiInf: 0.1, eiSpd: 0, eoLen: 1, eoInf: 42, eoSpd: 0},
    {idx: 2, eiLen: 1, eiInf: 42, eiSpd: 0, eoLen: 1, eoInf: 42, eoSpd: 0},
    {idx: 3, eiLen: 1, eiInf: 42, eiSpd: 0, eoLen: 1, eoInf: 0.1, eoSpd: 0}
]);

// ---- 缓动数组维度(v0.2.16):SPATIAL(锚点/位置)=1、缩放按值维度 ----
// 锚点(2D_SPATIAL):easeArr 必须 1 个元素——修复「值数组没有 1 元素」真机 bug
var mp9 = mockProp(false, "ADBE Anchor Point");
var r9 = QK.applySegCurves(mp9, [
    {t: 0, v: [0, 100], idx: 1},
    {t: 1, v: [300, 100], idx: 2},
    {t: 2, v: [600, 100], idx: 3}
], [
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1},
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1}
]);
eq("锚点 缓动数组长度=1 applied=3", r9.applied, 3);
eq("锚点 ease 全 eiLen=1(SPATIAL 规则)", mp9.log.ease, [
    {idx: 1, eiLen: 1, eiInf: 0.1, eiSpd: 0, eoLen: 1, eoInf: 42, eoSpd: 0},
    {idx: 2, eiLen: 1, eiInf: 42, eiSpd: 0, eoLen: 1, eoInf: 42, eoSpd: 0},
    {idx: 3, eiLen: 1, eiInf: 42, eiSpd: 0, eoLen: 1, eoInf: 0.1, eoSpd: 0}
]);
// 缩放(2D,非空间):easeArr 2 个元素
var mp10 = mockProp(false, "ADBE Scale");
var r10 = QK.applySegCurves(mp10, [
    {t: 0, v: [100, 100], idx: 1},
    {t: 1, v: [200, 200], idx: 2},
    {t: 2, v: [300, 300], idx: 3}
], [
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1},
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1}
]);
eq("缩放 缓动数组长度=2 applied=3", r10.applied, 3);
eq("缩放 ease 全 eiLen=2(非空间规则)", mp10.log.ease, [
    {idx: 1, eiLen: 2, eiInf: 0.1, eiSpd: 0, eoLen: 2, eoInf: 42, eoSpd: 0},
    {idx: 2, eiLen: 2, eiInf: 42, eiSpd: 0, eoLen: 2, eoInf: 42, eoSpd: 0},
    {idx: 3, eiLen: 2, eiInf: 42, eiSpd: 0, eoLen: 2, eoInf: 0.1, eoSpd: 0}
]);
// 3D 场景(v0.2.16 规则覆盖):3D 位置(SPATIAL)=1、3D 缩放(非空间)=3
var mp11 = mockProp(false, "ADBE Position");
var r11 = QK.applySegCurves(mp11, [
    {t: 0, v: [0, 100, 0], idx: 1},
    {t: 1, v: [300, 100, 0], idx: 2},
    {t: 2, v: [600, 100, 0], idx: 3}
], [
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1},
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1}
]);
eq("3D 位置(SPATIAL)缓动数组=1 applied=3", r11.applied, 3);
eq("3D 位置 ease 全 eiLen=1", (mp11.log.ease.length === 3 && mp11.log.ease[0].eiLen === 1 && mp11.log.ease[2].eiLen === 1), true);
var mp12 = mockProp(false, "ADBE Scale");
var r12 = QK.applySegCurves(mp12, [
    {t: 0, v: [100, 100, 100], idx: 1},
    {t: 1, v: [200, 200, 200], idx: 2},
    {t: 2, v: [300, 300, 300], idx: 3}
], [
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1},
    {x1: 0.42, y1: 0, x2: 0.58, y2: 1}
]);
eq("3D 缩放(非空间)缓动数组=3 applied=3", r12.applied, 3);
eq("3D 缩放 ease 全 eiLen=3", (mp12.log.ease.length === 3 && mp12.log.ease[0].eiLen === 3 && mp12.log.ease[2].eiLen === 3), true);

console.log(failures === 0 ? "ALL PASS (" + 116 + " assertions)" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
