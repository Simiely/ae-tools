// QuickKey 回归测试(node 直接运行)
// 用法: node test_quickkey.js
// 守护:computeTimes(三模式+关闭剔除+动态节点数)、anchorPos、classifyValue、
//       buildPlan/planHasExplicit(v0.1.14)、propDimCore(v0.1.17 维度定案)
var QK = require("./QuickKey.jsx");
var failures = 0;

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

console.log(failures === 0 ? "ALL PASS (" + 50 + " assertions)" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
