// MountainSpectrum 断言测试(node 直接跑: node test_MountainSpectrum.js)
//
// 运行方式(必须在本目录内, 脚本会相对路径载入主文件):
//     node test_MountainSpectrum.js
//
// 覆盖策略:
//   ① 纯逻辑层逐函数断言;
//   ② 【表达式 ↔ 纯函数 等价性】—— 把生成的表达式真的 eval 出来, 用 mock thisComp 驱动,
//      与纯函数逐根柱子比对数值(两条实现不允许漂移);
//   ③ 源码级体检 —— 把"不许再出现的写法"钉死(已删参数、魔数、静默失败等);
//     ⚠️ 这些正则断言做过反向对照: 喂入回归代码必须变红(见 DEVELOPMENT.md「如何验证断言有效」)。
//
// v1.0.0 起的分层:
//   宽度只由左右边缘点决定;「影响范围」「影响范围倍率%」「边缘控制」三个滑块已删除。

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "MountainSpectrum.jsx");
var raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");

var passed = 0, failed = 0;
var SEC = {}, cur = "?";

function eq(name, got, want) {
    SEC[cur] = (SEC[cur] || 0) + 1;
    var g = JSON.stringify(got);
    if (g === JSON.stringify(want)) { passed++; }
    else { failed++; console.log("FAIL " + name + ": got=[" + g + "] want=[" + JSON.stringify(want) + "]"); }
}
function near(name, got, want, eps) {
    SEC[cur] = (SEC[cur] || 0) + 1;
    if (Math.abs(got - want) <= eps) { passed++; }
    else { failed++; console.log("FAIL " + name + ": got=" + got + " want=" + want); }
}

// ---- 载入被测模块(在 AE 之外, app 未定义 -> 只导出纯函数) ----
var module = { exports: {} };
var app;
eval(raw);
var T = module.exports;
var NM = T.NAMES;
var PK = T.PRESET;

// ---- mock: 一份最小的 AE 对象模型(只实现表达式会用到的部分) ----
function mkEffect(vals) {
    return function (name) {
        if (!(name in vals)) throw new Error("mock: 无此效果 " + name);
        return function (idx) { return withVT(vals[name]); };
    };
}
// 控制器滑块: 表达式里 W/G/baseH/mode/ftype 是【无保护读取】, 必须提供; edge 走 try/catch
function mkCtrlFx(o) {
    o = o || {};
    var fx = {};
    fx[NM.w] = (o.w != null) ? o.w : 24;
    fx[NM.g] = (o.g != null) ? o.g : 10;
    fx[NM.base] = (o.baseH != null) ? o.baseH : 0;
    fx[NM.mode] = (o.mode != null) ? o.mode : 0;
    fx[NM.ftype] = (o.ftype != null) ? o.ftype : 0;
    if (o.edge != null) { fx[NM.edge] = o.edge; }
    // 节奏条(v1.1.0): o.rhy = { on, interval, ratioPct } 或省略(= 滑块缺失 -> 表达式回退"关")
    if (o.rhy) {
        fx[NM.rhyOn] = o.rhy.on;
        fx[NM.rhyN] = o.rhy.interval;
        fx[NM.rhyPct] = o.rhy.ratioPct;
    }
    // v1.5.0 边缘过渡(根): o.fw —— 不传 = 0(硬边界), 与纯函数缺省口径一致
    fx[NM.rhyFw] = (o.fw != null) ? o.fw : 0;
    return fx;
}
// points[i] = { x, y, h?, xl?, xr?, posVT?(t)->[x,y] 动画钩子(v1.4.0 帧缓冲测试用) }
function mkThisComp(ctrlPos, ctrlFx, points, hgtY) {
    return {
        frameDuration: 1 / 25,   // v1.4.0: 帧缓冲采样的帧长
        layer: function (nm) {
            if (hgtY != null && nm === NM.hgt) {
                return { transform: { position: withVT([ctrlPos[0], hgtY]) } };
            }
            if (nm === NM.ctrl) {
                return { transform: { position: withVT(ctrlPos) }, effect: mkEffect(ctrlFx) };
            }
            if (nm.indexOf(NM.ptPrefix) === 0) {
                var rest = nm.substring(NM.ptPrefix.length);
                var lLen = NM.ptLSuffix.length, rLen = NM.ptRSuffix.length;
                var isEdge = false, isL = false;
                if (rest.length > lLen && rest.substring(rest.length - lLen) === NM.ptLSuffix) { isEdge = true; isL = true; }
                else if (rest.length > rLen && rest.substring(rest.length - rLen) === NM.ptRSuffix) { isEdge = true; isL = false; }
                var kk = parseInt(rest, 10);
                var p = points[kk - 1];
                if (!p) throw new Error("mock: 无此图层 " + nm);
                if (isEdge) {
                    var ex = isL ? p.xl : p.xr;
                    if (ex == null) throw new Error("mock: 无边缘点 " + nm);
                    return { transform: { position: withVT([ex, 0]) } };
                }
                var fx = {};
                if (p.h != null) { fx[NM.h] = p.h; }
                var posArr = withVT([p.x, p.y]);
                if (p.posVT) { posArr.valueAtTime = p.posVT; }   // 动画钩子: 覆盖采样轨迹
                return { transform: { position: posArr }, effect: mkEffect(fx) };
            }
            throw new Error("mock: 无此图层 " + nm);
        }
    };
}
// AE 取表达式最后一句的值; node 的 new Function 不会自动返回 -> 补一句 return <收尾变量>
// v1.4.0: 补 time 全局(帧缓冲采样用); mock 的 position/effect 值都带 valueAtTime(见 mkThisComp)
function evalExpr(code, thisComp, layerPos, outVar) {
    var f = new Function("thisComp", "transform", "time", code + "\nreturn " + outVar + ";");
    return f(thisComp, { position: layerPos }, 0);
}
// 给数值/数组挂 valueAtTime(v1.4.0 帧缓冲表达式会调用; 静态 mock 恒返回自身)
function withVT(v) {
    if (typeof v === "number") {
        var n = new Number(v);
        n.valueAtTime = function () { return v; };
        return n;
    }
    v.valueAtTime = function () { return v; };
    return v;
}

// ---- 统一几何 ----
var CW = 1920, CH = 1080;
var NN = 40, WW = 24, GG = 10, PITCH = WW + GG;      // 40 根 / 柱距 34
var ROWW = NN * WW + (NN - 1) * GG;                   // 1350
var ROWX = CW / 2, ROWY = CH * 0.8;                   // 960 / 864
var M2 = 2;
// 峰 X 必须【正对某根柱子】—— 否则"峰顶 = 峰高"这类断言会因 t≠0 差一点点。
//   用 barX() 反算, 免得以后改柱距/根数时又对不齐(踩过)。
var PX1 = barX(12), PX2 = barX(27);
function barX(i) { return ROWX + T.barOffsetX(i, NN, WW, GG); }
function barIndexOf(px) { return Math.round((px - ROWX) / PITCH + (NN - 1) / 2); }

// 一个"正常的"波峰: 峰高 300, 左右各 170px
function pt(px, opts) {
    var o = opts || {};
    var p = { x: px, y: ROWY - (o.peak != null ? o.peak : 300) };
    if (o.h != null) { p.h = o.h; }
    if (o.rl != null) { p.xl = px - o.rl; }
    if (o.rr != null) { p.xr = px + o.rr; }
    return p;
}
function pureH(i, points, opts) {
    var o = opts || {};
    return T.barHeightOfIndex(i, NN, WW, GG, ROWX, ROWY, points,
        o.mode || 0, o.baseH || 0, o.ftype || 0, o.edge, o.hMax, o.rhy, o.fw);
}
function exprH(i, points, opts) {
    var o = opts || {};
    var code = T.buildSizeExpr(i, NN, points.length);
    return evalExpr(code, mkThisComp([ROWX, ROWY], mkCtrlFx(o),
        points, o.hMax != null ? ROWY - o.hMax : null), [ROWX, ROWY], NM.outSize)[1];
}
function countPx(points, opts) {
    var c = 0, i;
    for (i = 0; i < NN; i++) { if (pureH(i, points, opts) > ((opts && opts.baseH) || 0) + 1e-6) { c++; } }
    return c;
}

// ============================================================
cur = "一、基础工具与曲线";
// ============================================================
eq("clampNum 钳下限", T.clampNum(-5, 0, 10), 0);
eq("clampNum 钳上限", T.clampNum(50, 0, 10), 10);
eq("clampNum NaN -> 下限", T.clampNum(NaN, 3, 10), 3);
eq("clampInt 取整", T.clampInt(4.6, 0, 10), 5);
eq("clampInt NaN -> 下限", T.clampInt(NaN, 2, 10), 2);
eq("pickNum 空串 -> 默认", T.pickNum("", 24), 24);
eq("pickNum 非数字 -> 默认", T.pickNum("abc", 24), 24);
eq("pickNum 正常取值", T.pickNum("18", 24), 18);
eq("pickBool 0 -> false", T.pickBool(0), false);
eq("pickBool \"true\" -> true", T.pickBool("true"), true);
eq("pickBool 缺省 -> false", T.pickBool(undefined), false);

eq("falloff t=0 -> 1", T.falloff(0, 0), 1);
eq("falloff t=1 -> 0", T.falloff(1, 0), 0);
eq("falloff t>1 -> 0", T.falloff(1.5, 0), 0);
near("falloff 余弦 t=0.5 -> 0.5", T.falloff(0.5, 0), 0.5, 1e-12);
eq("falloff 线性 t=0.5 -> 0.5", T.falloff(0.5, 2), 0.5);
near("falloff 二次 t=0.5 -> 0.25", T.falloff(0.5, 3), 0.25, 1e-12);
near("falloff 高斯 t=0 -> 1", T.falloff(0, 1), 1, 1e-12);
near("falloff 高斯 t=1 -> 0", T.falloff(1, 1), 0, 1e-12);
[0, 1, 2, 3].forEach(function (ft) {
    var ok = true, prev = 2, i2, v;
    for (i2 = 0; i2 <= 20; i2++) {
        v = T.falloff(i2 / 20, ft);
        if (v > prev + 1e-12) { ok = false; }
        prev = v;
    }
    eq("曲线 " + ft + " 单调不增(21 点)", ok, true);
    eq("曲线 " + ft + " 越近越高(0.3 > 0.7)", T.falloff(0.3, ft) > T.falloff(0.7, ft), true);
});

eq("barOffsetX 居中(首根)", T.barOffsetX(0, 40, 24, 10), -19.5 * 34);
eq("barOffsetX 居中(末根)", T.barOffsetX(39, 40, 24, 10), 19.5 * 34);
eq("barOffsetX 对称", T.barOffsetX(0, 40, 24, 10), -T.barOffsetX(39, 40, 24, 10));
eq("rowWidth", T.rowWidth(40, 24, 10), ROWW);
near("autoCount 铺满(1920 宽留 3%): floor((1804.8+10)/34) = 53", T.autoCount(1920, 24, 10, 57.6), 53, 1e-12);
eq("autoCount 极窄 -> 至少 1", T.autoCount(10, 24, 10, 30), 1);
eq("pickBaseY 图层 Y 优先", T.pickBaseY(700, 1080, 80), 700);
eq("pickBaseY 无图层 -> 面板值", T.pickBaseY(null, 1080, 80), 864);
eq("pickBaseY 图层 NaN -> 面板值", T.pickBaseY(NaN, 1080, 50), 540);

// ============================================================
cur = "二、点贡献与合成";
// ============================================================
var B = 1000;
near("contrib 正下方 = 峰高", T.pointContribution(0, 0, 700, B, 100, 0), 300, 1e-12);
// ⚠️ 窗口边界(t=1)不是 0, 而是 e(边缘高度%)倍峰高 —— 这是"窗口内每一根都看得见"的实现方式
near("contrib 窗口边界 = e 倍峰高(默认 e=10%)",
    T.pointContribution(100, 0, 700, B, 100, 0), 300 * (NM.edgeDef / 100), 1e-9);
near("contrib 窗口外(t>1) = 0", T.pointContribution(100.5, 0, 700, B, 100, 0), 0, 1e-12);
near("contrib e=0(边缘不保底)时窗口边界才归零",
    T.pointContribution(100, 0, 700, B, 100, 0, 0, 0, 100), 0, 1e-12);
near("contrib 半径 0 -> 0", T.pointContribution(0, 0, 700, B, 0, 0), 0, 1e-12);
near("contrib 点在基线下方 -> 0", T.pointContribution(0, 0, 1100, B, 100, 0), 0, 1e-12);
near("contrib hExplicit 覆盖位置推算", T.pointContribution(0, 0, 700, B, 100, 0, 500), 500, 1e-12);
near("contrib 左侧用左半径(200): -100 处 t=0.5",
    T.pointContribution(-100, 0, 700, B, 100, 0, 0, 0, 200), T.pointContribution(50, 0, 700, B, 100, 0, 0, 0, 100), 1e-9);
near("contrib 不传左半径 -> 两侧对称",
    T.pointContribution(-50, 0, 700, B, 100, 0), T.pointContribution(50, 0, 700, B, 100, 0), 1e-12);
near("contrib 左半径 0 -> 左侧无贡献", T.pointContribution(-10, 0, 700, B, 100, 0, 0, 0, 0), 0, 1e-12);
// 基础高度口径(v0.9.0 起): 返回"超出地板多少", 于是窗口内每根都保证高过地板
near("contrib baseH=0 与不传 baseH 相同",
    T.pointContribution(0, 0, 700, B, 100, 0, 0, 0, 100, 0),
    T.pointContribution(0, 0, 700, B, 100, 0, 0, 0, 100), 1e-12);
near("contrib 峰顶: baseH 不影响峰高(峰高 = 地板 + 超出量)",
    T.pointContribution(0, 0, 700, B, 100, 0, 0, 0, 100, 100), 200, 1e-12);
near("contrib 峰顶低于地板 -> 0", T.pointContribution(0, 0, 700, B, 100, 0, 0, 0, 100, 400), 0, 1e-12);

near("combine 叠加 = 相加", T.combineHeights([100, 200], 0, 0), 300, 1e-12);
near("combine 取最高", T.combineHeights([100, 200], 1, 0), 200, 1e-12);
near("combine + 基础高度(地板是加法基线)", T.combineHeights([100, 200], 0, 40), 340, 1e-12);
near("combine 空数组 + 地板", T.combineHeights([], 0, 40), 40, 1e-12);
near("combine 空数组 无地板", T.combineHeights([], 0, 0), 0, 1e-12);
near("combine 负地板按 0 处理(与表达式同口径)", T.combineHeights([100], 0, -50), 100, 1e-12);

var pts1 = [pt(PX1, { rl: 170, rr: 170 })];
near("barHeightAt 峰顶 = 峰高", pureH(barIndexOf(PX1), pts1), 300, 1e-9);
eq("barHeightAt 窗口外 = 0(无地板)", pureH(0, pts1), 0);
near("barHeightAt 窗口外 = 地板", pureH(0, pts1, { baseH: 40 }), 40, 1e-9);
near("barHeightAt 左右对称(同半径)", pureH(barIndexOf(PX1) - 3, pts1), pureH(barIndexOf(PX1) + 3, pts1), 1e-9);

// ============================================================
cur = "三、宽度只由左右边缘点决定(v1.0.0)";
// ============================================================
var sym = [pt(PX1, { rl: 170, rr: 170 })];
var asym = [pt(PX1, { rl: 400, rr: 100 })];
function profile(points, opts) {
    var a = [], i;
    for (i = 0; i < NN; i++) { a.push(pureH(i, points, opts)); }
    return a;
}
eq("对称: 左右覆盖根数相等",
    (function () { var a = profile(sym), l = 0, r = 0, i, bi = barIndexOf(PX1);
        for (i = 0; i < NN; i++) { if (a[i] > 1e-9) { if (i < bi) l++; else if (i > bi) r++; } }
        return Math.abs(l - r) <= 1 && l > 0; })(), true);
eq("不对称(左 400 / 右 100): 左侧覆盖明显多于右侧",
    (function () { var a = profile(asym), l = 0, r = 0, i, bi = barIndexOf(PX1);
        for (i = 0; i < NN; i++) { if (a[i] > 1e-9) { if (i < bi) l++; else if (i > bi) r++; } } return l > r * 3; })(), true);
near("不对称: 峰顶仍是峰高(宽度不影响幅度)", pureH(barIndexOf(PX1), asym), 300, 1e-9);
// 边缘点拖到峰的【另一侧】-> 该侧半径负 -> 钳 0 -> 关掉那侧
var swapped = [pt(PX1, { rl: -200, rr: 170 })];
eq("左边缘点拖到峰右侧 -> 左侧无贡献",
    (function () { var i, bi = barIndexOf(PX1);
        for (i = 0; i < bi; i++) { if (pureH(i, swapped) > 1e-9) { return false; } } return true; })(), true);
eq("左边缘点拖到峰右侧 -> 右侧不受影响", pureH(bi_plus(2), swapped) > 0, true);
function bi_plus(n) { return barIndexOf(PX1) + n; }
// 缺一侧 -> 回退自动半径(autoRadiusFor)
var onlyRight = [pt(PX1, { rr: 170 })];
var autoR = T.autoRadiusFor(NN, WW, GG, 1);
eq("缺左边缘点 -> 左侧用自动半径(有贡献)", pureH(barIndexOf(PX1) - 2, onlyRight) > 0, true);
near("缺左边缘点: 左侧 -autoR 处 t=1 -> 无贡献",
    pureH(barIndexOf(PX1) - Math.ceil(autoR / PITCH) - 1, onlyRight), 0, 1e-9);
var PXC = barX(19);   // 行中心那根
eq("两侧都缺 -> 回到自动宽度且左右基本对称",
    (function () { var a = profile([pt(PXC)]), i, bi = barIndexOf(PXC), l = 0, r = 0;
        for (i = 0; i < NN; i++) { if (a[i] > 1e-9) { if (i < bi) l++; else if (i > bi) r++; } }
        return Math.abs(l - r) <= 1 && l > 5; })(), true);

// ============================================================
cur = "四、自动半径与影响范围换算";
// ============================================================
eq("autoInfluenceBars(40,24,10,5) = 32", T.autoInfluenceBars(40, 24, 10, 5), 32);
eq("autoInfluenceBars 封顶到 N(点数=1)", T.autoInfluenceBars(40, 24, 10, 1), 40);
eq("autoInfluenceBars 封顶到 N(点数=2)", T.autoInfluenceBars(40, 24, 10, 2), 40);
eq("autoInfluenceBars 封顶到 N(点数=3)", T.autoInfluenceBars(40, 24, 10, 3), 40);
eq("autoInfluenceBars 不超 N(逐点数扫)", (function () {
    for (var m = 1; m <= 30; m++) { if (T.autoInfluenceBars(40, 24, 10, m) > 40) { return false; } }
    return true;
})(), true);
eq("autoInfluenceBars 至少 1", T.autoInfluenceBars(1, 24, 10, 9) >= 1, true);
eq("点数越多 -> 自动半径越小或相等(单调)", (function () {
    var prev = 1e9;
    for (var m = 1; m <= 20; m++) {
        var r = T.autoRadiusFor(40, 24, 10, m);
        if (r > prev + 1e-9) { return false; }
        prev = r;
    }
    return true;
})(), true);
eq("柱距 0 -> 1", T.autoInfluenceBars(40, 0, 0, 5), 1);

near("influenceRadiusPx: 9 根 Δ=0.5 -> 4.5×柱距", T.influenceRadiusPx(9, PITCH, 0.5), 153, 1e-6);
near("influenceRadiusPx: 9 根 Δ=0   -> 4×柱距", T.influenceRadiusPx(9, PITCH, 0), 136, 1e-6);
near("influenceRadiusPx: 10 根 Δ=0.5 -> 4.5×柱距(偶数同值)",
    T.influenceRadiusPx(10, PITCH, 0.5), 153, 1e-6);
near("influenceRadiusPx: 1 根 -> 0.5×柱距(下限)", T.influenceRadiusPx(1, PITCH, 0.5), 17, 1e-6);
near("influenceRadiusPx: 0 根 -> 钳到 1 根", T.influenceRadiusPx(0, PITCH, 0.5), 17, 1e-6);
near("influenceRadiusPx: 负数 -> 钳到 1 根", T.influenceRadiusPx(-9, PITCH, 0.5), 17, 1e-6);
near("influenceRadiusPx: Δ 缺省 = 0.5", T.influenceRadiusPx(9, PITCH), 153, 1e-6);
near("influenceRadiusPx: Δ 超界 -> 钳到 0.5", T.influenceRadiusPx(9, PITCH, 3), 153, 1e-6);
eq("influenceRadiusPx 与柱距成正比",
    Math.abs(T.influenceRadiusPx(9, PITCH * 2, 0.5) - 2 * T.influenceRadiusPx(9, PITCH, 0.5)) < 1e-6, true);
near("autoRadiusFor = 自动根数换算的半径(点数 5)",
    T.autoRadiusFor(40, 24, 10, 5), T.influenceRadiusPx(32, PITCH, 0.5), 1e-9);
near("autoRadiusFor 点数=1 铺满整行", T.autoRadiusFor(40, 24, 10, 1), T.influenceRadiusPx(40, PITCH, 0.5), 1e-9);

// ============================================================
cur = "五、resolvePoints(宽度解析与总闸)";
// ============================================================
var rp = T.resolvePoints([{ x: 100, y: 200, h: 0, xl: 60, xr: 300 }], 864, null, 0);
eq("保留峰 X", rp[0].x, 100);
eq("左半径 = 峰X - 左边缘X", rp[0].rl, 40);
eq("右半径 = 右边缘X - 峰X", rp[0].r, 200);
eq("缺边缘点时用 autoR", T.resolvePoints([{ x: 100, y: 200, h: 0 }], 864, null, 55)[0].r, 55);
eq("autoR=0 且缺边缘点 -> 半径 0", T.resolvePoints([{ x: 100, y: 200, h: 0 }], 864, null, 0)[0].r, 0);
eq("边缘点在另一侧 -> 半径钳 0",
    T.resolvePoints([{ x: 100, y: 200, h: 0, xl: 300, xr: 50 }], 864, null, 0)[0].rl, 0);
eq("h 原样透传(未启用总闸)", T.resolvePoints([{ x: 100, y: 200, h: 77 }], 864, null, 0)[0].h, 77);
eq("总闸启用 -> h 置 -1(自动)", T.resolvePoints([{ x: 100, y: 200, h: 0 }], 864, 500, 0)[0].h, -1);
near("总闸启用 -> y = 基线 - 缩放后峰高",
    864 - T.resolvePoints([{ x: 100, y: 200, h: 0 }], 864, 500, 0)[0].y, 500, 1e-12);
eq("未启用总闸 -> y 原样", T.resolvePoints([{ x: 100, y: 200, h: 0 }], 864, null, 0)[0].y, 200);

eq("intrinsicPeak: 用 h(若 >0)", T.intrinsicPeak({ x: 0, y: 0, h: 250 }, 864), 250);
eq("intrinsicPeak: 否则用 基线-Y", T.intrinsicPeak({ x: 0, y: 500, h: 0 }, 864), 364);
eq("intrinsicPeak: 点在基线下方 -> 0", T.intrinsicPeak({ x: 0, y: 900, h: 0 }, 864), 0);
eq("peakScaleOf: 未启用 -> 1", T.peakScaleOf([pt(PX1, { rl: 1, rr: 1 })], ROWY, null), 1);
eq("peakScaleOf: hMax=峰高 -> 1", T.peakScaleOf([{ x: 0, y: 0, h: 300 }], 864, 300), 1);
eq("peakScaleOf: hMax 翻倍 -> 2", T.peakScaleOf([{ x: 0, y: 0, h: 300 }], 864, 600), 2);
eq("peakScaleOf: hMax=0 -> 0(整排压平, 与「未启用」是两件事)", T.peakScaleOf([{ x: 0, y: 0, h: 300 }], 864, 0), 0);
eq("peakScaleOf: 无有效峰(点落在基线下方) -> 1", T.peakScaleOf([{ x: 0, y: 900, h: 0 }], 864, 500), 1);
eq("peakScaleOf: 多点取最大峰高为基准",
    T.peakScaleOf([{ x: 0, y: 0, h: 100 }, { x: 0, y: 0, h: 400 }], 864, 800), 2);

// ============================================================
cur = "六、表达式 ↔ 纯函数 等价性";
// ============================================================
var cases = [
    { tag: "单点对称", pts: [pt(PX1, { rl: 170, rr: 170 })] },
    { tag: "单点不对称", pts: [pt(PX1, { rl: 400, rr: 100 })] },
    { tag: "缺左边缘点", pts: [pt(PX1, { rr: 170 })] },
    { tag: "双点重叠", pts: [pt(PX1, { rl: 170, rr: 170 }), pt(PX1 + 100, { rl: 170, rr: 170 })] },
    { tag: "点位高度显式", pts: [pt(PX1, { rl: 120, rr: 120, h: 500 })] }
];
var optsList = [
    { mode: 0, baseH: 0, ftype: 0 },
    { mode: 1, baseH: 0, ftype: 0 },
    { mode: 0, baseH: 40, ftype: 0 },
    { mode: 0, baseH: 40, ftype: 1 },
    { mode: 0, baseH: 150, ftype: 2 },
    { mode: 1, baseH: 40, ftype: 3 },
    { mode: 0, baseH: 0, ftype: 0, edge: 0 },
    { mode: 0, baseH: 0, ftype: 0, edge: 100 },
    { mode: 0, baseH: 40, ftype: 0, rhy: { on: 1, interval: 8, ratioPct: 180 } },
    { mode: 1, baseH: 40, ftype: 1, rhy: { on: 1, interval: 3, ratioPct: 250 } },
    { mode: 0, baseH: 40, ftype: 0, fw: 3 },
    { mode: 0, baseH: 40, ftype: 0, rhy: { on: 1, interval: 8, ratioPct: 180 }, fw: 3 },
    { mode: 0, baseH: 0, ftype: 0, edge: 0, fw: 3 }
];
var ci, oi, k, bad = 0, total = 0;
var CMP = 0;   // 真实数值比对次数(循环会放大, 单看 eq/near 的调用数会低估)
for (ci = 0; ci < cases.length; ci++) {
    for (oi = 0; oi < optsList.length; oi++) {
        for (k = 0; k < NN; k++) {
            total++; CMP++;
            var a = pureH(k, cases[ci].pts, optsList[oi]);
            var b = exprH(k, cases[ci].pts, optsList[oi]);
            if (Math.abs(a - b) > 1e-6) {
                bad++;
                if (bad <= 3) {
                    console.log("  差异: " + cases[ci].tag + " / 选项 " + oi + " / 柱 " + k +
                                " 纯函数=" + a + " 表达式=" + b);
                }
            }
        }
    }
}
eq("表达式与纯函数逐根一致(" + total + " 组比对)", bad, 0);
near("逐根比对次数与用例数一致", CMP, total, 0);

// 总闸: 表达式侧
eq("表达式侧总闸: 最高柱 = hMax",
    (function () { var m = 0, i; for (i = 0; i < NN; i++) {
        var v = exprH(i, [pt(PX1, { rl: 170, rr: 170 })], { hMax: 500 }); if (v > m) { m = v; } } return m; })(),
    500, 1e-6);
eq("表达式侧总闸与纯函数一致",
    (function () { var i; for (i = 0; i < NN; i++) {
        if (Math.abs(exprH(i, [pt(PX1, { rl: 170, rr: 170 })], { hMax: 500 }) -
                     pureH(i, [pt(PX1, { rl: 170, rr: 170 })], { hMax: 500 })) > 1e-6) { return false; } }
        return true; })(), true);

// 表达式健壮性: 点位图层缺失 / 高度滑块缺失 / 边缘点缺失
var tcMissingPts = mkThisComp([ROWX, ROWY], mkCtrlFx({}), []);
eq("点位图层缺失 -> 只剩地板", evalExpr(T.buildSizeExpr(0, NN, 5), tcMissingPts, [ROWX, ROWY], NM.outSize)[1], 0);
eq("点位图层缺失 + 地板 -> 地板值",
    evalExpr(T.buildSizeExpr(0, NN, 5), mkThisComp([ROWX, ROWY], mkCtrlFx({ baseH: 40 }), []), [ROWX, ROWY], NM.outSize)[1], 40);
eq("高度滑块缺失 -> 回退用点位 Y 推算",
    Math.abs(exprH(barIndexOf(PX1), [{ x: PX1, y: ROWY - 300, xl: PX1 - 100, xr: PX1 + 100 }]) -
             300) < 1e-6, true);
eq("边缘高度滑块缺失 -> 回退默认 " + NM.edgeDef + "%",
    (function () {
        var pts = [pt(PX1, { rl: 170, rr: 170 })];
        var withEdge = exprH(barIndexOf(PX1) - 5, pts, { edge: NM.edgeDef });
        var noEdge = exprH(barIndexOf(PX1) - 5, pts, {});
        return Math.abs(withEdge - noEdge) < 1e-9;
    })(), true);

// ============================================================
cur = "七、形状图层可拖动(回归)";
// ============================================================
// 位置表达式必须是"纯偏移量" —— 与图层自身位置无关, 否则拖图层整行不动(v0.1.2 的 bug)
var posExpr = T.buildPosExpr(0, 2, 1);
eq("位置表达式不含抵消图层位置的写法", posExpr.indexOf("bx - transform.position[0]") < 0, true);
eq("位置表达式输出纯偏移", posExpr.indexOf("var outPos = [(i - (N - 1) / 2) * (W + G), -h / 2];") >= 0, true);
eq("核心用图层自身 X 定位柱子", T.buildExprCore(0, 2, 1).indexOf("transform.position[0] + (i - (N - 1) / 2) * pitch") >= 0, true);
var pv0 = evalExpr(T.buildPosExpr(2, 2, 1), mkThisComp([ROWX, ROWY], mkCtrlFx({}), [pt(PX1, { rl: 170, rr: 170 })]), [ROWX, ROWY], NM.outPos);
var pv1 = evalExpr(T.buildPosExpr(2, 2, 1), mkThisComp([ROWX, ROWY], mkCtrlFx({}), [pt(PX1, { rl: 170, rr: 170 })]), [ROWX + 200, ROWY], NM.outPos);
near("图层右移 200 -> 输出偏移不变(X 无关)", pv1[0] - pv0[0], 0, 1e-12);
// 底边恒等于图层 Y(合成坐标)
eq("底边贴基线(合成坐标)", (function () {
        var i, base0 = [ROWX, ROWY], off = [0, 0];
        for (i = 0; i < 3; i++) {
            var pos = evalExpr(T.buildPosExpr(i, NN, 1), mkThisComp(base0, mkCtrlFx({}), [pt(PX1, { rl: 170, rr: 170 })]), base0, NM.outPos);
            var h = evalExpr(T.buildSizeExpr(i, NN, 1), mkThisComp(base0, mkCtrlFx({}), [pt(PX1, { rl: 170, rr: 170 })]), base0, NM.outSize)[1];
            if (Math.abs((base0[1] + pos[1] + h / 2) - ROWY) > 1e-6) { return false; }
        }
        return true;
    })(), true);

// 纵向: 图层下移 100 -> 矩形在合成坐标里也整体下移(底边仍贴图层 Y)
eq("图层纵向平移 1:1 传导到合成坐标", (function () {
    var p0 = [ROWX, ROWY], p1 = [ROWX, ROWY + 100];
    var pts = [pt(PX1, { rl: 170, rr: 170 })];
    var a = evalExpr(T.buildPosExpr(3, NN, 1), mkThisComp(p0, mkCtrlFx({}), pts), p0, NM.outPos);
    var b = evalExpr(T.buildPosExpr(3, NN, 1), mkThisComp(p0, mkCtrlFx({}), pts), p1, NM.outPos);
    return Math.abs((p1[1] + b[1]) - (p0[1] + a[1]) - 100) < 1e-9;
})(), true);
eq("高度不受图层位置影响(大小表达式不含图层位置)", (function () {
    var pts = [pt(PX1, { rl: 170, rr: 170 })], o = { baseH: 40 };
    var a = evalExpr(T.buildSizeExpr(3, NN, 1), mkThisComp([ROWX, ROWY], mkCtrlFx(o), pts), [100, 100], NM.outSize);
    var b = evalExpr(T.buildSizeExpr(3, NN, 1), mkThisComp([ROWX, ROWY], mkCtrlFx(o), pts), [1800, 1000], NM.outSize);
    return Math.abs(a[1] - b[1]) < 1e-9;
})(), true);

// ============================================================
cur = "八、参数空间(单一真相)";
// ============================================================
var specs = PK.specs;
eq("参数表存在", !!specs, true);
eq("参数表项数 = 15(v1.4.0 加节奏缓冲帧)", specs.length, 15);
eq("PRESET_KEYS 由参数表派生", PK.keys.length, specs.length);
eq("DEFAULTS 与参数表一一对应", (function () {
    for (var i = 0; i < specs.length; i++) {
        if (PK.defaults[specs[i].key] !== specs[i].def) { return false; }
    }
    return Object.keys(PK.defaults).length === specs.length;
})(), true);
eq("已删除的 r 不在参数表里", PK.keys.indexOf("r") < 0, true);
eq("预设版本 = 4", PK.version, 4);
eq("paramSpec 可按 key 取回", T.paramSpec("edge").label, "边缘高度%");
eq("paramSpec 未知 key -> null", T.paramSpec("nope"), null);

// ---- readParams: 面板 mock -> 参数对象(回归 v1.1.3: p.m 与 p.pts 键名断链, 波峰组全没建) ----
function mkMockUI() {
    var U = {}, i, sp;
    for (i = 0; i < specs.length; i++) {
        sp = specs[i];
        if (sp.kind === "bool") { U[sp.ui] = { value: sp.def }; }
        else if (sp.kind === "idx") { U[sp.ui] = { selection: { index: sp.def }, items: [] }; }
        else { U[sp.ui] = { text: String(sp.def) }; }
    }
    return U;
}
var mockComp = { width: 1920, height: 1080 };
var rp1 = T.readParams(mkMockUI(), mockComp);
eq("readParams: p.m 与 p.pts 接通(⭐ v1.1.3 波峰组消失的根因)", rp1.m, rp1.pts);
eq("readParams: p.m = 默认点数 5", rp1.m, 5);
eq("readParams: p.n = 默认 40", rp1.n, 40);
near("readParams: baseRatio 转成 0..1", rp1.baseRatio, 0.8, 1e-12);
near("readParams: rowW = 40×24 + 39×10", rp1.rowW, 1350, 1e-12);
eq("readParams: 键名一致性 — generate 用到的每个 p.* 都已定义", (function () {
    var keys = ["n", "m", "pts", "auto", "w", "gap", "baseH", "baseRatio",
                "ftype", "mode", "ph", "edge", "rhyOn", "rhyN", "rhyPct", "rhyFw", "rowW"];
    for (var i = 0; i < keys.length; i++) {
        if (rp1[keys[i]] === undefined) { return false; }
    }
    return true;
})(), true);
eq("参数表 UI 覆盖: 每个参数的控件都会被创建(⭐ v1.5.0 应用预设 TypeError 的根因回归)",
    (function () {
        // 从源码提取 UI_ROWS 布局, 逐个参数核对: 非 bool 的 ui 必须在布局里, bool 必须带 check 文案
        var m = raw.match(/var UI_ROWS = \[[\s\S]*?\];/);
        if (!m) { return false; }
        var rowsSrc = m[0];
        for (var i = 0; i < T.PRESET.specs.length; i++) {
            var sp = T.PRESET.specs[i];
            if (sp.kind === "bool") {
                if (!sp.check) { return false; }
                continue;
            }
            if (rowsSrc.indexOf("\"" + sp.key + "\"") < 0) { return false; }
        }
        return true;
    })(), true);
eq("readParams: 自动铺满时按合成宽反推数量", (function () {
    var U = mkMockUI(); U.cbFill.value = true;
    return T.readParams(U, mockComp).n > 40;
})(), true);
eq("readParams: 自定义输入穿透(点数=2 → p.m=2)", (function () {
    var U = mkMockUI(); U.edPoints.text = "2";
    return T.readParams(U, mockComp).m;
})(), 2);
eq("readParams: 非数字输入回落默认(点数=\"abc\" → 5)", (function () {
    var U = mkMockUI(); U.edPoints.text = "abc";
    return T.readParams(U, mockComp).m;
})(), 5);
// mode 分布: 11 个实时 + 3 个结构性
var liveKeys = [], rebuildKeys = [], i2;
for (i2 = 0; i2 < specs.length; i2++) {
    if (specs[i2].mode === "rebuild") { rebuildKeys.push(specs[i2].key); } else { liveKeys.push(specs[i2].key); }
}
eq("结构性参数 = 数量/自动铺满/点数", rebuildKeys.sort().join(","), "auto,n,pts");
eq("其余 12 个都是改完即生效", liveKeys.length, 12);
eq("每个实时参数都有落地通道(ctrl/points/layer)",
    (function () {
        for (var i = 0; i < specs.length; i++) {
            var sp = specs[i];
            if (sp.mode === "rebuild") { continue; }
            if (sp.mode === "ctrl" && !sp.ctrl) { return false; }
            if (sp.mode !== "ctrl" && sp.mode !== "points" && sp.mode !== "layer") { return false; }
        }
        return true;
    })(), true);

// 序列化往返与钳制
var s1 = T.serializePreset({ n: 64, w: 12, gap: 6, baseH: 30, baseRatio: 65, ftype: 3, mode: 1, pts: 9, ph: 400, edge: 25, auto: true });
eq("序列化: 字段数 = 参数表项数", Object.keys(s1).length, 15);
eq("序列化: 布尔保留", s1.auto, true);
eq("序列化: 数字字符串转数字", s1.w, 12);
eq("序列化: ftype 钳到 0..3", T.serializePreset({ ftype: 99 }).ftype, 3);
eq("序列化: mode 钳到 0..1", T.serializePreset({ mode: 99 }).mode, 1);
eq("序列化: pts 钳到 1.." + NM.maxPoints, T.serializePreset({ pts: 0 }).pts, 1);
eq("序列化: baseRatio 钳到 1..99", T.serializePreset({ baseRatio: 0 }).baseRatio, 1);
eq("序列化: edge 钳到 0..100", T.serializePreset({ edge: 500 }).edge, 100);
eq("序列化: 缺省 = DEFAULTS", T.serializePreset(null).w, PK.defaults.w);
eq("序列化: 忽略已删除的 r 键", Object.keys(T.serializePreset({ r: 999 })).indexOf("r") < 0, true);
eq("旧版串(k=v&k=v)也能吃", T.deserializePreset("n=20&w=30").w, 30);

// 槽位 JSON
var jsTxt = T.slotsToJson({ "1": s1, "2": null, "3": T.serializePreset({ n: 10 }), "4": null });
eq("导出 JSON 含版本号", jsTxt.indexOf('"version": 4') >= 0, true);
eq("导出 JSON 含空槽 null", jsTxt.indexOf('"2": null') >= 0, true);
eq("导出 JSON 可被真正的 JSON.parse 解析", (function () {
    try { var o = JSON.parse(jsTxt); return o.slots["1"].edge === 25 && o.slots["2"] === null; }
    catch (e) { return "解析失败: " + e.message; }
})(), true);
eq("导出 JSON 无 NaN / undefined", jsTxt.indexOf("NaN") < 0 && jsTxt.indexOf("undefined") < 0, true);
var back = T.jsonParseSlots(jsTxt);
eq("解析回槽 1 的 w", back.slots["1"].w, 12);
eq("解析回槽 2 为 null", back.slots["2"], null);
eq("解析回版本号", back.version, 4);
eq("坏 JSON -> 全空槽(不抛错)", T.jsonParseSlots("{ 坏 ").slots["1"], null);
eq("非 JSON 头 -> 全空槽", T.jsonParseSlots("hello").slots["1"], null);
eq("v3 旧文件(带 r) 读到 v4: r 被忽略, 其余保留",
    T.jsonParseSlots('{"version":3,"slots":{"1":{"n":7,"w":9,"r":562},"2":null,"3":null,"4":null}}').slots["1"].w, 9);
eq("v3 旧文件: r 不进入结果",
    Object.keys(T.jsonParseSlots('{"version":3,"slots":{"1":{"n":7,"r":562},"2":null,"3":null,"4":null}}').slots["1"]).indexOf("r") < 0, true);
eq("resetSlots 就地清空 4 槽", (function () {
    var c = { "1": 1, "2": 2, "3": 3, "4": 4 };
    var r = T.resetSlots(c);
    return r === c && c["1"] === null && c["4"] === null;
})(), true);

// 应用预设全链路: 面板参数 → 收集 → 槽位 JSON → 解析 → 回填面板 → 再收集 (⭐ v1.5.0 TypeError 的回归)
eq("应用预设全链路: 参数值往返一致", (function () {
    var U1 = mkMockUI();
    U1.edCount.text = "60"; U1.edBaseH.text = "55"; U1.edRhyFw.text = "5"; U1.cbRhyOn.value = true;
    var params1 = T.collectParams(U1);
    var json = T.slotsToJson({ "1": params1, "2": null, "3": null, "4": null });
    var back = T.jsonParseSlots(json);
    var U2 = mkMockUI();
    T.applyParamsToUI(U2, back.slots["1"]);
    var params2 = T.collectParams(U2);
    var keys = ["n", "w", "gap", "baseH", "ph", "edge", "rhyN", "rhyPct", "rhyFw"];
    for (var i = 0; i < keys.length; i++) {
        if (String(params1[keys[i]]) !== String(params2[keys[i]])) { return "diff:" + keys[i]; }
    }
    if (params1.auto !== params2.auto || params1.rhyOn !== params2.rhyOn) { return "diff:bool"; }
    return true;
})(), true);
eq("应用预设全链路: 旧版含 rhyBuf 键的 JSON 导入被忽略不报错", (function () {
    var back = T.jsonParseSlots('{"version":4,"slots":{"1":{"n":30,"w":20,"gap":8,"baseH":50,"baseRatio":80,' +
        '"ftype":0,"mode":0,"pts":4,"ph":0,"edge":10,"rhyOn":1,"rhyN":6,"rhyPct":200,"rhyBuf":9,"auto":false},' +
        '"2":null,"3":null,"4":null}}');
    var U = mkMockUI();
    T.applyParamsToUI(U, back.slots["1"]);
    var p = T.collectParams(U);
    return p.n === 30 && p.rhyN === 6 && p.rhyFw === T.PRESET.defaults.rhyFw;
})(), true);

// ============================================================
cur = "九、缺陷回归(审计 P0/P1/P2)";
// ============================================================
// P2-1: 基础高度负数 -> 纯函数与表达式必须一致(以前纯函数当 0、表达式算出负高度)
var badNeg = 0;
[-50, -1].forEach(function (bh) {
    for (k = 0; k < NN; k++) {
        var pa = pureH(k, [pt(PX1, { rl: 170, rr: 170 })], { baseH: bh });
        var pb = exprH(k, [pt(PX1, { rl: 170, rr: 170 })], { baseH: bh });
        if (Math.abs(pa - pb) > 1e-6) { badNeg++; }
    }
});
eq("负基础高度: 纯函数与表达式逐根一致(审计 P2-1)", badNeg, 0);
eq("负基础高度: 表达式不产出负高度", (function () {
    for (k = 0; k < NN; k++) {
        if (exprH(k, [pt(PX1, { rl: 170, rr: 170 })], { baseH: -50 }) < 0) { return false; }
    }
    return true;
})(), true);
eq("负基础高度: 与 baseH=0 等价",
    (function () {
        for (k = 0; k < NN; k++) {
            if (Math.abs(exprH(k, [pt(PX1, { rl: 170, rr: 170 })], { baseH: -50 }) -
                         exprH(k, [pt(PX1, { rl: 170, rr: 170 })], { baseH: 0 })) > 1e-9) { return false; }
        }
        return true;
    })(), true);
eq("表达式含负基础高度钳制行", T.buildExprCore(0, 2, 1).indexOf("if (baseH < 0) { baseH = 0; }") >= 0, true);

// P0-1/P0-2: 三个死参数必须彻底消失(纯逻辑层 + 表达式层)
eq("已删参数「影响范围」变量不再声明", raw.indexOf('var SL_R ') < 0, true);
eq("已删参数「影响范围倍率%」不再声明", raw.indexOf("SL_RSCALE") < 0, true);
eq("已删参数「边缘控制」不再声明", raw.indexOf("SL_EC") < 0, true);
eq("表达式不含倍率换算", T.buildExprCore(0, 2, 1).indexOf("rsc") < 0, true);
eq("表达式不含柱网相位换算(宽度不再由根数推)",
    T.buildExprCore(0, 2, 1).indexOf("ic - Math.floor(ic)") < 0, true);
eq("表达式含边缘层查找(左, v1.2.0 新名)", T.buildExprCore(0, 2, 1).indexOf("【左缘】") >= 0, true);
eq("表达式含边缘层查找(右, v1.2.0 新名)", T.buildExprCore(0, 2, 1).indexOf("【右缘】") >= 0, true);
eq("表达式含峰层查找(峰, v1.2.0 新名)", T.buildExprCore(0, 2, 1).indexOf("【峰】") >= 0, true);
eq("表达式不含旧名(旧字面量应彻底消失)", T.buildExprCore(0, 2, 1).indexOf(" 左") < 0 &&
    T.buildExprCore(0, 2, 1).indexOf(" 右") < 0, true);
eq("表达式含回退半径 autoR", T.buildExprCore(0, 2, 1).indexOf("var autoR = kk * pitch") >= 0, true);
eq("回退半径与 autoRadiusFor 同源(公式镜像)",
    Math.abs((function () {
        // 用 M=2 / N=40 手算表达式里的 autoR, 与 autoRadiusFor 对比
        var N = 40, W = 24, G = 10, M = 2, pitch = W + G;
        var rowW = N * W + (N - 1) * G;
        var ab = Math.round(rowW / (M + 1) * 2.5 / pitch * 2 - 1);
        if (ab > N) { ab = N; }
        if (ab < 1) { ab = 1; }
        var kk = ab / 2 - 0.5;
        if (ab % 2 > 0.5) { kk = (ab - 1) / 2 + 0.5; }
        if (kk < 0.5) { kk = 0.5; }
        return kk * pitch * 1.000000001 - T.autoRadiusFor(N, W, G, M);
    })(), 0) < 1e-9, true);

// P1: 参数实时化 / 结构性参数提示 —— 源码级体检
eq("onChange 由参数表统一绑定",
    raw.indexOf("bindLiveParam(pal, U, PARAM_SPECS[uiBind].key)") >= 0, true);
eq("结构性参数只提示需重新生成(不静默)",
    raw.indexOf("是结构性参数 — 点「生成 / 重建」生效。") >= 0, true);
eq("pushParam 按 mode 分流", raw.indexOf('sp.mode === "ctrl"') >= 0 && raw.indexOf('sp.mode === "layer"') >= 0, true);
eq("UI 控件由参数表生成(不再逐个手写)",
    raw.indexOf("uiSpec = paramSpec(UI_ROWS[uiRi][uiCi])") >= 0, true);

// P2-2: 魔数收敛
eq("HGT_DEF_RATIO 不再被字面量 0.22 重复", (raw.match(/comp\.height \* 0\.22/g) || []).length, 0);
eq("visibleCountHint 不再硬编码 24/10 回退", (function () {
    var seg = raw.substring(raw.indexOf("function visibleCountHint"), raw.indexOf("function pushParam"));
    return seg.indexOf("= 24;") < 0 && seg.indexOf("= 10;") < 0;
})(), true);

// P2-3: 静默失败可见化
eq("syncEdgeX 返回实际摆动个数", raw.indexOf("function syncEdgeX(comp, k, px, rPx) {") >= 0 &&
    raw.indexOf("return moved;") >= 0, true);
eq("均分边缘点会提示缺失的边缘点", raw.indexOf("个波峰缺边缘点") >= 0, true);

// ============================================================
cur = "十、表达式文本体检(ExtendScript 保守子集)";
// ============================================================
var ex = T.buildExprCore(3, 10, 4);
eq("表达式输出无 BOM", ex.charCodeAt(0) !== 0xFEFF, true);
eq("表达式无单行注释", ex.indexOf("//") < 0, true);
eq("表达式无反斜杠(ExtendScript 字符串雷)", ex.indexOf(String.fromCharCode(92)) < 0, true);
eq("表达式无多变量声明", /var\s+[A-Za-z_$][\w$]*(\s*=[^;\[\n]*)?\s*,\s*[A-Za-z_$]/.test(ex), false);
eq("表达式无 ++", ex.indexOf("++") < 0, true);
eq("表达式无 +=", ex.indexOf("+=") < 0, true);
eq("表达式无 continue", ex.indexOf("continue") < 0, true);
eq("表达式无 IIFE", ex.indexOf("(function") < 0, true);
eq("表达式写死 i/N/M", ex.indexOf("var i = 3;") >= 0 && ex.indexOf("var N = 10;") >= 0 && ex.indexOf("var M = 4;") >= 0, true);
eq("大小表达式以裸变量收尾", (function () {
    var s = T.buildSizeExpr(0, 2, 1);
    return s.substring(s.length - (NM.outSize.length + 2)) === NM.outSize + ";\n";
})(), true);
eq("位置表达式以裸变量收尾", (function () {
    var s = T.buildPosExpr(0, 2, 1);
    return s.substring(s.length - (NM.outPos.length + 2)) === NM.outPos + ";\n";
})(), true);
eq("表达式含 try 保护点位查找", ex.indexOf("try { P = thisComp.layer(") >= 0, true);
eq("表达式含 try 保护边缘点查找", ex.indexOf("catch (e9)") >= 0 && ex.indexOf("catch (e10)") >= 0, true);
eq("表达式循环上限写死 M", ex.indexOf("k <= M; k = k + 1") >= 0, true);
eq("表达式无对象字面量(避开 ES3 保留字)", ex.indexOf("{ f:") < 0 && ex.indexOf("{f:") < 0, true);

// 反向对照: 上面这些体检里的关键正则, 喂"回归代码"必须命中(证明断言不是假绿)
var regress = [
    "var a = 1, b = 2;",
    "        t = Math.abs(bx - pp[0]) / R;",
    "      R = (R + 1) / 2 * pitch * rsc / 100;"
];
eq("反向对照: 多变量声明会被抓", /var\s+[A-Za-z_$][\w$]*(\s*=[^;\[\n]*)?\s*,\s*[A-Za-z_$]/.test(regress[0]), true);
eq("反向对照: 旧的柱网相位换算会被抓", /ic\s*-\s*Math\.floor\(ic\)/.test("      ic = (pp[0] - rowLeftX) / pitch;\n      fr = ic - Math.floor(ic);"), true);
eq("反向对照: 倍率换算会被抓", regress[2].indexOf("rsc") >= 0, true);

// ============================================================
cur = "十一、节奏条(v1.1.0): 每 N 根一根更高, v1.5.0 羽化带线性过渡";
// ============================================================

// ---- barFloor 纯函数 ----
near("关 -> 地板 = baseH", T.barFloor(0, null, 40), 40, 1e-12);
near("关(rhy.on=0) -> 地板 = baseH", T.barFloor(0, { on: 0, interval: 8, ratioPct: 180 }, 40), 40, 1e-12);
near("开 + i=0(间隔上) -> baseH×180%", T.barFloor(0, { on: 1, interval: 8, ratioPct: 180 }, 40), 72, 1e-12);
near("开 + i=7 -> baseH(7 不是间隔 8 的倍数)", T.barFloor(7, { on: 1, interval: 8, ratioPct: 180 }, 40), 40, 1e-12);
near("开 + i=1 -> baseH(非间隔柱)", T.barFloor(1, { on: 1, interval: 8, ratioPct: 180 }, 40), 40, 1e-12);
near("开 + i=8 -> baseH×180%(每 8 根循环)", T.barFloor(8, { on: 1, interval: 8, ratioPct: 180 }, 40), 72, 1e-12);
near("开 + i=16 -> baseH×180%(第三根节奏柱)", T.barFloor(16, { on: 1, interval: 8, ratioPct: 180 }, 40), 72, 1e-12);
near("开 + i=15 -> baseH(15 % 8 = 7)", T.barFloor(15, { on: 1, interval: 8, ratioPct: 180 }, 40), 40, 1e-12);
near("baseH=0 -> 地板 0(节奏条也是 0)", T.barFloor(0, { on: 1, interval: 8, ratioPct: 180 }, 0), 0, 1e-12);
near("负 baseH -> 地板 0(与 combineHeights 同口径)", T.barFloor(0, { on: 1, interval: 8, ratioPct: 180 }, -5), 0, 1e-12);
near("间隔 0 -> 钳到 1(每根都节奏, 与表达式同口径)", T.barFloor(3, { on: 1, interval: 0, ratioPct: 180 }, 40), 72, 1e-12);
near("高度% ≤ 0 -> 回退 baseH", T.barFloor(0, { on: 1, interval: 8, ratioPct: 0 }, 40), 40, 1e-12);
near("高度% 100 -> 等于 baseH(无效果但合法)", T.barFloor(0, { on: 1, interval: 8, ratioPct: 100 }, 40), 40, 1e-12);
near("分数间隔 2.4 -> round 到 2", T.barFloor(2, { on: 1, interval: 2.4, ratioPct: 180 }, 40), 72, 1e-12);
eq("图案从最左第 1 根开始(锚定 i%N===0)", T.barFloor(0, { on: 1, interval: 5, ratioPct: 200 }, 40) > T.barFloor(1, { on: 1, interval: 5, ratioPct: 200 }, 40), true);

// ---- 核心不变量(v1.3.2 山内跟随): 山内(h_关 > baseH)节奏条 = 普通柱; 山外(= baseH)= 地板 ----
//   即 h_开(i) === (h_关(i) > baseH) ? h_关(i) : floor_i, 对每一根柱成立 —— 山内零戳出。
(function () {
    var pts = [pt(PX1, { rl: 170, rr: 170 })];
    var rhy = { on: 1, interval: 8, ratioPct: 180 };
    var i, badN = 0;
    for (i = 0; i < NN; i++) {
        var hOn = pureH(i, pts, { baseH: 40, rhy: rhy });
        var hOff = pureH(i, pts, { baseH: 40 });
        var fl = T.barFloor(i, rhy, 40);
        var want = (hOff > 40 + 1e-12) ? hOff : fl;
        if (Math.abs(hOn - want) > 1e-9) { badN++; }
    }
    eq("h_开 = 山内跟随/山外地板(" + NN + " 根逐根验证)", badN, 0);
})();

// ---- 端点行为 ----
(function () {
    var pts = [pt(PX1, { rl: 170, rr: 170 })];
    var rhy = { on: 1, interval: 8, ratioPct: 180 };
    // 山外(远端柱): 柱高 = 自己的地板
    // 选两根【山外】的柱: 24(节奏柱, 24%8=0) 和 25(普通柱) —— 山丘窗口在柱 7..17 附近
    var far = 24;
    eq("山外探针确实是节奏柱", far % 8, 0);
    eq("山外探针在窗口外(高=地板)", Math.abs(pureH(far, pts, { baseH: 40 }) - 40) < 1e-9, true);
    near("山外节奏柱 = 独自高度 baseH×180%", pureH(far, pts, { baseH: 40, rhy: rhy }), 72, 1e-9);
    near("山外普通柱 = baseH", pureH(far + 1, pts, { baseH: 40, rhy: rhy }), 40, 1e-9);
    // 山内(v1.3.0): 节奏柱被山丘吞掉 —— 与紧邻普通柱同高(轮廓平滑, 参考截图②), 不再戳出
    //   动态找一根【山内】节奏柱: i%8===0 且开关关时高度 > 节奏地板 72
    var inRhy = -1, iq2;
    for (iq2 = 0; iq2 < NN; iq2++) {
        if (iq2 % 8 === 0 && pureH(iq2, pts, { baseH: 40 }) > 72 + 1e-9) { inRhy = iq2; break; }
    }
    eq("找到了山内节奏柱探针", inRhy > -1, true);
    var hcIn = pureH(inRhy, pts, { baseH: 40, rhy: rhy });
    var hnIn = pureH(inRhy, pts, { baseH: 40 });
    near("山内节奏柱 = 普通柱高度(被山吞掉, 无锯齿)", hcIn - hnIn, 0, 1e-9);
    eq("山内节奏柱未戳出(≤ 峰高 300)", hcIn <= 300 + 1e-9, true);
    // 山脚过渡带(v1.3.2): 开关关时 40 < 高度 < 72 的节奏柱 -> 完全跟随山丘(= h_关, < 72, 零戳出)
    var inFlank = -1;
    for (iq2 = 0; iq2 < NN; iq2++) {
        var hoff = pureH(iq2, pts, { baseH: 40 });
        if (iq2 % 8 === 0 && hoff > 40 + 1e-9 && hoff < 72 - 1e-9) { inFlank = iq2; break; }
    }
    if (inFlank > -1) {
        var hFlank = pureH(inFlank, pts, { baseH: 40, rhy: rhy });
        near("山脚过渡带节奏柱跟随山丘(= 普通柱高度)", hFlank - hoff, 0, 1e-9);
        eq("山脚过渡带节奏柱不戳出到地板", hFlank < 72 - 1e-9, true);
    }
    // 开关关 -> 逐点等于 v1.0.0(不含 rhy 参数的旧调用)
    eq("开关关 → 与旧签名调用逐点一致", (function () {
        var i;
        for (i = 0; i < NN; i++) {
            if (Math.abs(pureH(i, pts, { baseH: 40, rhy: { on: 0, interval: 8, ratioPct: 180 } }) -
                         T.barHeightOfIndex(i, NN, WW, GG, ROWX, ROWY, pts, 0, 40, 0)) > 1e-12) { return false; }
        }
        return true;
    })(), true);
})();

// ---- 可见根数: 节奏柱恒可见(它本来就更高) ----
(function () {
    var pts = [pt(PX1, { rl: 170, rr: 170 })];
    var base = 40;
    var off = T.countVisibleBars(NN, WW, GG, ROWX, ROWY, pts, 0, base, 0, null, null, null);
    var on = T.countVisibleBars(NN, WW, GG, ROWX, ROWY, pts, 0, base, 0, null, null,
        { on: 1, interval: 8, ratioPct: 180 });
    eq("开 > 关(节奏柱山外也可见)", on > off, true);
    var expectInc = 0, iq;
    for (iq = 0; iq < NN; iq++) {
        if (iq % 8 === 0 && pureH(iq, pts, { baseH: 40 }) <= 40 + 1e-9) { expectInc++; }
    }
    eq("可见数增量 = 山外的节奏柱数(山内在开关关时已可见)", on - off, expectInc);
})();

// ---- v1.5.0 羽化带: 山脚/节奏条在带内线性过渡(纯函数 + 表达式双侧验证) ----
(function () {
    var baseH = 40;
    var pts = [pt(PX1, { rl: 170, rr: 170 })];
    var pitch = WW + GG;

    // 1) 普通柱连续性: 核心边界 t=1 两侧的柱高差被带宽摊薄 —— 带 fw=3 时相邻柱差远小于 edge 跳变
    var hIn = T.barHeightOfIndex(barIndexOf(PX1), NN, WW, GG, ROWX, ROWY, pts, 0, baseH, 0, null, null, null, 3);
    var hOut = T.barHeightOfIndex(barIndexOf(PX1) + 2, NN, WW, GG, ROWX, ROWY, pts, 0, baseH, 0, null, null, null, 3);
    eq("羽化带: 核心内柱 > 带外柱(轮廓单调收尾)", hIn > hOut, true);

    // 2) pointBand: 带内返回 [s, B], 核心内/带外返回 null
    var rPx = 170;
    var bxCore = PX1;                     // t=0 核心
    var bxEdge = PX1 + rPx;               // t=1 边界
    var bxMid = PX1 + rPx + pitch * 1.5;  // 带内(t ≈ 1 + 1.5×pitch/r)
    var bxFar = PX1 + rPx + pitch * 9;    // 带外
    eq("pointBand: 核心内 -> null", T.pointBand(bxCore, PX1, ROWY - 300, ROWY, rPx, 0, 10, null, baseH, 3, pitch), null);
    var band = T.pointBand(bxMid, PX1, ROWY - 300, ROWY, rPx, 0, 10, null, baseH, 3, pitch);
    eq("pointBand: 带内非 null", band != null, true);
    if (band) {
        eq("pointBand: s ∈ (0,1]", band[0] > 0 && band[0] <= 1, true);
        near("pointBand: B = effH×edge", band[1], (300 - baseH) * 0.1, 1e-9);
    }
    eq("pointBand: 带外 -> null", T.pointBand(bxFar, PX1, ROWY - 300, ROWY, rPx, 0, 10, null, baseH, 3, pitch), null);

    // 3) 节奏条带内过渡: 高度介于 边界轮廓 与 独自地板 之间, 且与公式逐点吻合
    //    探针: 间隔 3 -> 第 18 根是节奏柱(18%3=0), 距峰(第 12 根)204px → t=1.2 落在带内(fwT=0.6)
    var rhy = { on: 1, interval: 3, ratioPct: 180 };
    var floorV = T.barFloor(18, rhy, baseH);
    var iRhy = 18;
    var hR = T.barHeightOfIndex(iRhy, NN, WW, GG, ROWX, ROWY, pts, 0, baseH, 0, null, null, rhy, 3);
    var bandR = T.pointBand(T.barOffsetX(iRhy, NN, WW, GG) + ROWX, PX1, ROWY - 300, ROWY, rPx, 0, 10, null, baseH, 3, pitch);
    eq("羽化带: 探针节奏柱确实在带内", bandR != null, true);
    if (bandR) {
        var want = floorV + ((baseH + bandR[1]) - floorV) * (1 - bandR[0]);
        near("羽化带: 节奏条高度 = 地板 + (边界轮廓 − 地板)×(1−s)", hR, want, 1e-9);
        eq("羽化带: 节奏条带内高度介于轮廓与地板之间",
            hR >= Math.min(floorV, baseH + bandR[1]) - 1e-9 && hR <= Math.max(floorV, baseH + bandR[1]) + 1e-9, true);
    }

    // 4) fw=0 -> 硬边界(v1.3.2 口径): 节奏柱带外 = 地板
    var h0 = T.barHeightOfIndex(iRhy, NN, WW, GG, ROWX, ROWY, pts, 0, baseH, 0, null, null, rhy, 0);
    near("羽化带: fw=0 -> 硬边界口径不变", h0, floorV, 1e-9);

    // 5) 表达式 ↔ 纯函数: 羽化带开(上下文里 exprH/pureH 走 o.fw)
    var badE = 0, iE;
    for (iE = 0; iE < NN; iE++) {
        var a = pureH(iE, pts, { baseH: baseH, rhy: rhy, fw: 3 });
        var b = exprH(iE, pts, { baseH: baseH, rhy: rhy, fw: 3 });
        if (Math.abs(a - b) > 1e-6) { badE++; }
    }
    eq("羽化带: 表达式与纯函数逐根一致(" + NN + " 根)", badE, 0);
})();

// ---- 表达式 ↔ 纯函数 等价性(节奏条开启) ----
(function () {
    var rhyCases = [
        { on: 1, interval: 8, ratioPct: 180 },
        { on: 1, interval: 3, ratioPct: 250 },
        { on: 1, interval: 1, ratioPct: 120 }
    ];
    var pts = [pt(PX1, { rl: 170, rr: 170 })];
    var ri, ci2, i, bad2 = 0, tot2 = 0;
    for (ri = 0; ri < rhyCases.length; ri++) {
        for (ci2 = 0; ci2 < 2; ci2++) {
            var o = { baseH: ci2 === 0 ? 0 : 40, rhy: rhyCases[ri] };
            for (i = 0; i < NN; i++) {
                tot2++;
                if (Math.abs(pureH(i, pts, o) - exprH(i, pts, o)) > 1e-6) {
                    bad2++;
                    if (bad2 <= 3) { console.log("  节奏差异: case " + ri + "/" + ci2 + " 柱 " + i +
                        " 纯函数=" + pureH(i, pts, o) + " 表达式=" + exprH(i, pts, o)); }
                }
            }
        }
    }
    eq("节奏开启: 表达式与纯函数逐根一致(" + tot2 + " 组比对)", bad2, 0);
})();

// ---- 表达式回退: 滑块缺失(mkCtrlFx 不带 rhy) -> 表现与"关"一致 ----
eq("节奏滑块缺失 -> 表达式回退关(旧工程不报错不变样)", (function () {
    var pts = [pt(PX1, { rl: 170, rr: 170 })], i;
    for (i = 0; i < NN; i++) {
        if (Math.abs(exprH(i, pts, {}) - exprH(i, pts, { rhy: { on: 0, interval: 8, ratioPct: 180 } })) > 1e-12) {
            return false;
        }
    }
    return true;
})(), true);

// ---- 源码体检 ----
var srcR = raw;   // 文件头已读入的 jsx 源码
eq("表达式含节奏地板计算", srcR.indexOf("if (i % Math.round(rint) === 0 && rpct > 0) { fl = baseH * rpct / 100; }") >= 0, true);
eq("表达式收尾 = v1.5.0 空间羽化(山内核心/带内过渡/带外地板)",
    srcR.indexOf("if (liftC > 0) { h = baseH + h; } else {") >= 0 &&
    srcR.indexOf("if (sMin <= 1) { h = fl + (baseH + Bmin - fl) * (1 - sMin); } else { h = fl; }") >= 0, true);
eq("旧收尾已清除(固定增量/取大/瞬切/帧缓冲四种旧写法都不在)", srcR.indexOf("h = fl + h;") < 0 &&
    srcR.indexOf("? hn : fl;") < 0 &&
    srcR.indexOf("if (fl > baseH && h <= 0) { h = fl; } else { h = baseH + h; }") < 0 &&
    srcR.indexOf("outN") < 0, true);
eq("表达式含羽化带采样(vB/sMin/Bmin)", srcR.indexOf("vB = eff * edge * (1 - s2);") >= 0 &&
    srcR.indexOf("sMin = s2; Bmin = eff * edge;") >= 0, true);
eq("节奏滑块缺失回退到关(查生成的表达式文本)",
    T.buildExprCore(0, 2, 1).indexOf("catch (e11) { ron = " + NM.rhyOnDef + "; }") >= 0, true);
eq("反向对照: 旧收尾写法会被抓", /h\s*=\s*baseH\s*\+\s*h\s*;/.test("      h = baseH + h;\n"), true);

// 柱子颜色(⭐ v1.5.1 需求 / v1.5.3 默认值可见化): 默认白色 + 按钮初始显示 #FFFFFF
eq("默认填充色 FILL_COLOR = [1,1,1,1] 即 #FFFFFF", srcR.indexOf("var FILL_COLOR = [1, 1, 1, 1];") >= 0, true);
eq("柱色按钮初始文字显示默认色 #FFFFFF(不是「选色…」)", srcR.indexOf('colorRow.add("button", undefined, "#FFFFFF")') >= 0 &&
    srcR.indexOf('"button", undefined, "选色…")') < 0, true);
eq("填充颜色由图层颜色控件统一驱动(effect 表达式引用)", srcR.indexOf('fc.expression = "effect(\\"" + SL_COLOR + "\\")(1)";') >= 0, true);

// 版本号单一真相(⭐ v1.5.3 实测漏改: 只改了带 v 前缀的 diag, 文件头裸号与「脚本版本」两处漏掉)
eq("版本号三处一致(文件头 / VER 常量 / CHANGELOG 顶部标题)", (function () {
    var mHead = raw.match(/^\/\/ 版本:\s*([0-9]+\.[0-9]+\.[0-9]+)/m);
    var mVer = raw.match(/var VER = "([0-9]+\.[0-9]+\.[0-9]+)";/);
    if (!mHead || !mVer) { return false; }
    var chg = "";
    try {
        var chgTxt = fs.readFileSync(path.join(__dirname, "CHANGELOG.md"), "utf8");
        var mC = chgTxt.match(/^## v([0-9]+\.[0-9]+\.[0-9]+)/m);
        chg = mC ? mC[1] : "";
    } catch (eChg) { return false; }
    return mHead[1] === mVer[1] && mVer[1] === chg;
})(), true);
eq("版本号无硬编码残留(诊断输出必须走 VER 常量)", raw.indexOf('diag("脚本版本: 1.5.') < 0 &&
    raw.indexOf('diag("面板已加载 v1.5.') < 0, true);

// 版本号上界面 + 「点生成没反应」修复(⭐ v1.5.4 需求:「点击生成 没反应。版本号 需要显示在 ui面板上」)
eq("面板顶部常驻版本号标签, 且引用 VER 常量(不硬编码)",
    srcR.indexOf('pal.add("statictext", undefined, "山峰频谱 MountainSpectrum   v" + VER)') >= 0, true);
eq("状态栏初始文案带版本号",
    srcR.indexOf('"就绪 · v" + VER + " — 先在时间轴里点选一个合成') >= 0, true);
eq("未激活合成统一走 needCompAlert() 弹窗, 且入口 >= 5 个(生成/均分/重设/随机/清理)", (function () {
    if (srcR.indexOf("function needCompAlert()") < 0) { return false; }
    var n = (srcR.match(/needCompAlert\(\);/g) || []).length;
    return n >= 5;
})(), true);
eq("点「生成 / 重建」立刻写「正在生成…」状态(点击即有可见反馈)",
    srcR.indexOf('setStatus(pal, "正在生成…", C_OK);') >= 0, true);

// 提示区/调试区固定行数 + 滚动条(⭐ v1.5.5 需求:「需要换成有右侧进度条的设计, 8 行左右就够」)
eq("提示区走 fixedBox(固定 8 行 + 多行文本框), 不再是 statictext",
    srcR.indexOf('var tipBox = fixedBox(pal, 320, 8, TIP_TEXT, true);') >= 0 &&
    srcR.indexOf('var tip = pal.add("statictext"') < 0, true);
eq("调试输出区也走 fixedBox(修 pinW 吃掉高度的老坑)",
    srcR.indexOf('pal.debugBox = fixedBox(dbgPanel, 320, 8, "", true);') >= 0, true);
eq("文本框开启 scrollable(右侧滚动条)", srcR.indexOf("multiline: true, scrollable: true, readonly: !!readonly") >= 0, true);
eq("提示文本显式分段(\\n >= 10 处, 不靠自动折行)", (function () {
    var m = srcR.match(/var TIP_TEXT =[\s\S]*?;\r?\n/);
    if (!m) { return false; }
    return (m[0].match(/\\n/g) || []).length >= 10;
})(), true);
eq("fixedBox 顺序体检: pinW 钉宽度必须早于设置高度(顺序反了会被静默覆盖)", (function () {
    // ⚠️ 必须取【整个函数体】, 不能用固定字符窗口 —— v1.5.5 实测: 只加了几行注释(800 窗口取不到
    //    pinW), 断言就假红。体检断言本身也会因"代码变长"而失效, 这是同类坑的第二次出现。
    var m = srcR.match(/function fixedBox\([\s\S]*?\r?\n    \}/);
    if (!m) { return false; }
    var seg = m[0];
    var p = seg.indexOf("pinW(box, w)");
    var h = seg.indexOf("box.preferredSize = [w, h]");
    return p >= 0 && h >= 0 && p < h;
})(), true);

// ============================================================
cur = "十二、边界值等价性(审计发现 ftype 分叉的回归)";
// ============================================================
// 来源: 2026-09-21 架构审计用 _audit/boundary.js 探测「纯函数 ↔ 表达式」在【边界值】上的分叉,
//   发现 ftype 非法枚举值(9 / 3.5)下两侧结论不同 —— 纯函数落「默认分支 = 余弦」、
//   表达式落「else = 二次」, 40 根里 8 根不一致(拖控制器上的「起伏曲线」滑块出界时,
//   画面按二次渲染、状态栏回报的可见根数却按余弦算)。
//   v1.5.6 两侧统一「先 Math.round 再夹到 [0,3], 越界/NaN 回退 0」后分叉消失。
//   ⭐ 本节把那次探测的 25 个边界用例固化 —— 以后任何一侧改动都会在这里变红,
//   不再只靠「正常区间」用例兜着(第六节覆盖的 ftype 只有 0~3)。
eq("normalizeFalloffType 已导出", typeof T.normalizeFalloffType, "function");
eq("normalizeFalloffType: 0..3 原样通过",
    [T.normalizeFalloffType(0), T.normalizeFalloffType(1), T.normalizeFalloffType(2), T.normalizeFalloffType(3)].join(","), "0,1,2,3");
eq("normalizeFalloffType: 越界 / 负数 / NaN 一律回退 0",
    [T.normalizeFalloffType(9), T.normalizeFalloffType(-1), T.normalizeFalloffType(3.5), T.normalizeFalloffType(NaN)].join(","), "0,0,0,0");
eq("normalizeFalloffType: 就近取整(0.4→0, 1.4→1, 2.6→3)",
    [T.normalizeFalloffType(0.4), T.normalizeFalloffType(1.4), T.normalizeFalloffType(2.6)].join(","), "0,1,3");
eq("falloff 对非法 type 与 type=0 完全等价", T.falloff(0.5, 9) === T.falloff(0.5, 0), true);

var EDGE_PARAM = [
    ["hMax = 0 (总闸压平)",        { hMax: 0 }],
    ["hMax = 0.0001 (极小)",       { hMax: 0.0001 }],
    ["hMax 负值(无效输入)",        { hMax: -50 }],
    ["baseH = -100 (负地板)",      { baseH: -100 }],
    ["edge = -50 (越界下)",        { edge: -50 }],
    ["edge = 150 (越界上)",        { edge: 150 }],
    ["edge = 0 (纯 Hann)",         { edge: 0 }],
    ["fw = 0 (硬边界)",            { fw: 0 }],
    ["fw = 50 (上限)",             { fw: 50 }],
    ["rhy.interval = 0 (非法)",    { rhy: { on: 1, interval: 0, ratioPct: 180 } }],
    ["rhy.ratioPct = 0",           { rhy: { on: 1, interval: 8, ratioPct: 0 } }],
    ["rhy.ratioPct = 1000 (越界)", { rhy: { on: 1, interval: 8, ratioPct: 1000 } }],
    ["rhy.interval = 1000 > 根数", { rhy: { on: 1, interval: 1000, ratioPct: 180 } }],
    ["mode = 9 (非法枚举)",        { mode: 9 }],
    ["ftype = 9 (非法枚举) ⭐",     { ftype: 9 }],
    ["ftype = -1 (负数)",          { ftype: -1 }]
];
var EDGE_POINT = [
    ["半径 rl=rr=0 (关两侧)",     [pt(PX1, { rl: 0, rr: 0 })], {}],
    ["半径 rl=rr=0 且带 fw",      [pt(PX1, { rl: 0, rr: 0 })], { fw: 3 }],
    ["点位在基线下方 (peak<=0)",   [{ x: PX1, y: ROWY + 100, h: 0, xl: PX1 - 170, xr: PX1 + 170 }], {}],
    ["点位 h 显式 = 0 (自动)",     [pt(PX1, { rl: 170, rr: 170, h: 0 })], {}],
    ["点位 h 显式 = 1 (极小)",     [pt(PX1, { rl: 170, rr: 170, h: 1 })], {}],
    ["点位 h=5 但 baseH=40",      [pt(PX1, { rl: 170, rr: 170, h: 5 })], { baseH: 40 }],
    ["不对称 rl=1000 rr=1",       [pt(PX1, { rl: 1000, rr: 1 })], {}],
    ["双点完全重合",               [pt(PX1, { rl: 170, rr: 170 }), pt(PX1, { rl: 170, rr: 170 })], {}],
    ["fw=3 + edge=0 + 节奏开",     [pt(PX1, { rl: 170, rr: 170 })], { fw: 3, edge: 0, rhy: { on: 1, interval: 8, ratioPct: 180 } }]
];
var ebad = 0, etot = 0, efirst = "";
function edgeRun(tag, pts, opts) {
    for (var i = 0; i < NN; i++) {
        etot++;
        var a, b;
        try { a = pureH(i, pts, opts); } catch (eA) { a = "ERR:" + eA.message; }
        try { b = exprH(i, pts, opts); } catch (eB) { b = "ERR:" + eB.message; }
        var ok;
        if (typeof a === "number" && typeof b === "number") { ok = Math.abs(a - b) <= 1e-6; }
        else { ok = String(a) === String(b); }
        if (!ok) { ebad++; if (!efirst) { efirst = tag + " 柱" + i + " 纯=" + a + " 式=" + b; } }
    }
}
for (var ei = 0; ei < EDGE_PARAM.length; ei++) { edgeRun(EDGE_PARAM[ei][0], [pt(PX1, { rl: 170, rr: 170 })], EDGE_PARAM[ei][1]); }
for (var ej = 0; ej < EDGE_POINT.length; ej++) { edgeRun(EDGE_POINT[ej][0], EDGE_POINT[ej][1], EDGE_POINT[ej][2]); }
eq("边界值逐根等价: " + (EDGE_PARAM.length + EDGE_POINT.length) + " 用例 × " + NN + " 根 = " + etot + " 组比对全一致" +
   (ebad ? ("(首处分叉: " + efirst + ")") : ""), ebad, 0);
eq("边界用例数 = 25(防止用例被误删)", EDGE_PARAM.length + EDGE_POINT.length, 25);

// ============================================================
console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("(其中独立数值比对 " + (CMP || 0) + " 次 —— 循环内的逐根比对会放大断言数)");
console.log("---- 分节断言数 ----");
var ks = [];
for (var kk2 in SEC) { ks.push([kk2, SEC[kk2]]); }
for (var ki = 0; ki < ks.length; ki++) { console.log("  " + String(ks[ki][1]).padStart(4) + "  " + ks[ki][0]); }
if (failed > 0) { process.exit(1); }
