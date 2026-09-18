// test_MountainSpectrum.js — 纯逻辑层断言 (node 运行, 不依赖 AE)
// 运行: node test_MountainSpectrum.js
//
// 说明: MountainSpectrum.jsx 在 app 未定义时只导出纯函数并返回, 这里 eval 取出后断言。
// 重点: 不只测纯函数, 还把 buildSizeExpr/buildPosExpr 生成的【表达式真的 eval 出来跑】,
//       用 mock 的 thisComp 驱动, 与 barHeightOfIndex 逐根柱子比对数值 ——
//       这是保证「表达式 = 纯函数」两条实现不漂移的唯一手段。

var fs = require("fs");
var path = require("path");

var srcPath = path.join(__dirname, "MountainSpectrum.jsx");
var src = fs.readFileSync(srcPath, "utf8").replace(/^\uFEFF/, ""); // 去 BOM(若有)

var module = { exports: {} };
var app; // 故意未定义 -> 触发 jsx 内的 node 导出分支
eval(src);
var T = module.exports;
var NAME = T.NAMES;

var passed = 0, failed = 0;
function eq(name, got, want) {
    var g = String(got), w = String(want);
    if (g === w) { passed++; }
    else { failed++; console.log("FAIL " + name + ": got=[" + g + "] want=[" + w + "]"); }
}
function near(name, got, want, eps) {
    if (Math.abs(got - want) <= eps) { passed++; }
    else { failed++; console.log("FAIL " + name + ": got=" + got + " want=" + want); }
}

// ============================================================
// 一、纯逻辑层
// ============================================================

// ---- clampNum / clampInt ----
eq("clampNum NaN->lo", T.clampNum(NaN, 2, 10), 2);
eq("clampNum 下越界", T.clampNum(-5, 0, 10), 0);
eq("clampNum 上越界", T.clampNum(50, 0, 10), 10);
eq("clampNum 区间内", T.clampNum(7.5, 0, 10), 7.5);
eq("clampInt 四舍五入", T.clampInt(3.6, 0, 10), 4);
eq("clampInt 向下", T.clampInt(3.4, 0, 10), 3);
eq("clampInt NaN->lo", T.clampInt(NaN, 1, 10), 1);
eq("clampInt 上越界", T.clampInt(999, 1, 10), 10);

// ---- falloff: 端点与中点 ----
var ftypes = [0, 1, 2, 3];
var fnames = ["余弦", "高斯", "线性", "二次"];
var i, t, k;
for (i = 0; i < 4; i++) {
    eq("falloff " + fnames[i] + " t=0 -> 1", T.falloff(0, ftypes[i]), 1);
    eq("falloff " + fnames[i] + " t=1 -> 0", T.falloff(1, ftypes[i]), 0);
    eq("falloff " + fnames[i] + " t>1 -> 0", T.falloff(1.7, ftypes[i]), 0);
    eq("falloff " + fnames[i] + " t<0 -> 1", T.falloff(-0.3, ftypes[i]), 1);
}
near("falloff 余弦 t=0.5", T.falloff(0.5, 0), 0.5, 1e-12);
near("falloff 高斯 t=0.5", T.falloff(0.5, 1), 0.3170662, 1e-6);
near("falloff 线性 t=0.5", T.falloff(0.5, 2), 0.5, 1e-12);
near("falloff 二次 t=0.5", T.falloff(0.5, 3), 0.25, 1e-12);
near("falloff 高斯 t=0 精确 1", T.falloff(0, 1), 1, 1e-12);

// ---- falloff: 单调不增(0→1 采 21 点) ----
for (i = 0; i < 4; i++) {
    var prev = 2, mono = true;
    for (k = 0; k <= 20; k++) {
        var cur = T.falloff(k / 20, ftypes[i]);
        if (cur > prev + 1e-12) mono = false;
        prev = cur;
    }
    eq("falloff " + fnames[i] + " 单调不增", mono, true);
}

// ---- falloff: 左右对称 ----
for (i = 0; i < 4; i++) {
    eq("falloff " + fnames[i] + " 对称", T.falloff(0.31, ftypes[i]), T.falloff(0.31, ftypes[i]));
}

// ---- barOffsetX ----
eq("barOffsetX N=1 -> 0", T.barOffsetX(0, 1, 20, 10), 0);
near("barOffsetX N=4 i=0", T.barOffsetX(0, 4, 20, 10), -45, 1e-12);
near("barOffsetX N=4 i=3", T.barOffsetX(3, 4, 20, 10), 45, 1e-12);
near("barOffsetX N=4 对称", T.barOffsetX(0, 4, 20, 10) + T.barOffsetX(3, 4, 20, 10), 0, 1e-12);
near("barOffsetX N=3 G=0 i=0", T.barOffsetX(0, 3, 10, 0), -10, 1e-12);
near("barOffsetX N=3 G=0 i=1", T.barOffsetX(1, 3, 10, 0), 0, 1e-12);
near("barOffsetX N=3 G=0 i=2", T.barOffsetX(2, 3, 10, 0), 10, 1e-12);
var sOff = 0;
for (i = 0; i < 7; i++) { sOff += T.barOffsetX(i, 7, 24, 10); }
near("barOffsetX 整行偏移和为 0", sOff, 0, 1e-9);
near("barOffsetX 相邻间距 = W+G", T.barOffsetX(1, 5, 20, 10) - T.barOffsetX(0, 5, 20, 10), 30, 1e-12);

// ---- rowWidth ----
eq("rowWidth N=1", T.rowWidth(1, 20, 10), 20);
eq("rowWidth N=5", T.rowWidth(5, 20, 10), 140);
eq("rowWidth N=3 G=0", T.rowWidth(3, 24, 0), 72);

// ---- autoCount ----
eq("autoCount 1920/20/10 无边距", T.autoCount(1920, 20, 10, 0), 64);
eq("autoCount 1920/20/10 留 3%", T.autoCount(1920, 20, 10, 57.6), 60);
eq("autoCount W=0 保护", T.autoCount(1920, 0, 10, 0), 1);
eq("autoCount 合成太窄 -> 至少 1", T.autoCount(10, 100, 10, 40), 1);
eq("autoCount 封顶", T.autoCount(1000000, 1, 1, 0), NAME.maxBars);
eq("autoCount 恰好整除", T.autoCount(300, 20, 10, 0), 10);

// ---- pointContribution ----
// v0.4.1 起两条规则:
//   ① 半径取【第 m 近那根柱子的实际距离】× 柱距(kNN 半径) ⇒ "填 m 就恰好 m 根"
//   ② 判定窗口用未压缩的 t(|d| ≤ 半径 —— 注意是【≤】, 边界那根要算进来),
//      窗口形状改为【可调】: w(x) = e + (1-e)×falloff(x, 曲线), e = 边缘高度%/100
//      (Hamming 窗的推广: Hamming = 0.08 + 0.92×Hann)
var EDGE = NAME.edgeDef / 100;                       // 默认 0.30
var BASE = 1000;
function wE(t, ft) { return EDGE + (1 - EDGE) * T.falloff(t, ft || 0); }
eq("边缘高度默认 = 10%(v0.9.0 起下调, 新公式下已足够可见)", NAME.edgeDef, 10);
eq("edgeKeepOf(30) = 0.3", NAME.edgeKeepOf(30), 0.3);
eq("edgeKeepOf(0) = 0(纯 von Hann, 边缘归零)", NAME.edgeKeepOf(0), 0);
eq("edgeKeepOf(100) = 1(矩形窗, 窗口内全平)", NAME.edgeKeepOf(100), 1);
eq("edgeKeepOf(150) 钳到 1", NAME.edgeKeepOf(150), 1);
eq("edgeKeepOf(-20) 钳到 0", NAME.edgeKeepOf(-20), 0);
eq("edgeKeepOf(非数字) 回退默认 10%", NAME.edgeKeepOf(undefined), NAME.edgeDef / 100);
eq("edgeKeepOf(NaN) 回退默认 10%", NAME.edgeKeepOf(NaN), NAME.edgeDef / 100);
near("contrib 正下方峰值", T.pointContribution(0, 0, 700, BASE, 100, 0), 300, 1e-12);
near("contrib 半程(余弦) = 300 × w(0.5)",
    T.pointContribution(50, 0, 700, BASE, 100, 0), 300 * wE(0.5), 1e-12);
eq("contrib 半程高于纯 Hann(0.5) —— 边缘抬起把整条曲线也抬了",
    T.pointContribution(50, 0, 700, BASE, 100, 0) > 150, true);
near("contrib 窗口边界 = 300 × 边缘高度(刚好 edge 系数)",
    T.pointContribution(100, 0, 700, BASE, 100, 0), 300 * EDGE, 1e-9);
near("contrib 刚出窗口 -> 0", T.pointContribution(100.5, 0, 700, BASE, 100, 0), 0, 1e-12);
near("contrib 远超范围 -> 0", T.pointContribution(5000, 0, 700, BASE, 100, 0), 0, 1e-12);
near("contrib 点在基线上 -> 0", T.pointContribution(0, 0, BASE, BASE, 100, 0), 0, 1e-12);
near("contrib 点在基线下方 -> 0", T.pointContribution(0, 0, BASE + 50, BASE, 100, 0), 0, 1e-12);
near("contrib 影响范围为 0 -> 0", T.pointContribution(0, 0, 700, BASE, 0, 0), 0, 1e-12);
near("contrib 左右对称", T.pointContribution(-30, 0, 700, BASE, 100, 0),
    T.pointContribution(30, 0, 700, BASE, 100, 0), 1e-12);

// ---- combineHeights ----
near("combine 叠加", T.combineHeights([10, 20, 3], 0, 0), 33, 1e-12);
near("combine 取最高", T.combineHeights([10, 20, 3], 1, 0), 20, 1e-12);
near("combine 地板加在合成之上(叠加)", T.combineHeights([1, 2], 0, 10), 13, 1e-12);
near("combine 地板加在合成之上(取最高)", T.combineHeights([1, 2], 1, 10), 12, 1e-12);
near("combine 地板之上恒加基础高度", T.combineHeights([30], 1, 10), 40, 1e-12);
near("combine 空数组 -> 基础高度", T.combineHeights([], 0, 5), 5, 1e-12);
near("combine 单值 0 -> 基础高度", T.combineHeights([0], 0, 0), 0, 1e-12);

// ---- barHeightAt: 单点山丘形状 ----
var pts1 = [{ x: 0, y: 700, r: 100 }];
near("单点 峰顶", T.barHeightAt(0, pts1, BASE, 0, 0, 0), 300, 1e-12);
near("单点 半程", T.barHeightAt(50, pts1, BASE, 0, 0, 0), 300 * wE(0.5), 1e-12);
near("单点 边缘归零(刚出窗口)", T.barHeightAt(100.5, pts1, BASE, 0, 0, 0), 0, 1e-12);
near("单点 左右对称", T.barHeightAt(-50, pts1, BASE, 0, 0, 0), T.barHeightAt(50, pts1, BASE, 0, 0, 0), 1e-12);
near("单点 带基础高度(刚出窗口 -> 只剩基础高度)", T.barHeightAt(100.5, pts1, BASE, 0, 40, 0), 40, 1e-12);

// ---- barHeightAt: 双点重叠, 叠加 vs 取最高 ----
var pts2 = [{ x: -100, y: 700, r: 200 }, { x: 100, y: 700, r: 200 }];
var half1 = 300 * wE(0.5);
near("双点 中点 叠加", T.barHeightAt(0, pts2, BASE, 0, 0, 0), 2 * half1, 1e-12);
near("双点 中点 取最高", T.barHeightAt(0, pts2, BASE, 1, 0, 0), half1, 1e-12);
near("双点 峰顶 取最高", T.barHeightAt(-100, pts2, BASE, 1, 0, 0), 300, 1e-12);
// 叠加永远不会小于取最高
var okMode = true;
for (k = -300; k <= 300; k += 10) {
    if (T.barHeightAt(k, pts2, BASE, 0, 0, 0) < T.barHeightAt(k, pts2, BASE, 1, 0, 0) - 1e-9) okMode = false;
}
eq("叠加 >= 取最高(全域)", okMode, true);

// ---- barHeightOfIndex 与 barOffsetX 一致(点 r 为【总根数】, 柱距 20+10=30) ----
near("barHeightOfIndex 用行中心偏移(r=0 -> 有效半径 15px)",
    T.barHeightOfIndex(2, 5, 20, 10, 960, BASE, [{ x: 960, y: 700, r: 0 }], 0, 0, 0),
    T.barHeightAt(960, [{ x: 960, y: 700, r: 15 }], BASE, 0, 0, 0), 1e-12);

// ============================================================
// 二、表达式 <-> 纯函数 等价性(eval 真实表达式)
// ============================================================

function mkEffect(vals) {
    return function (name) {
        if (!(name in vals)) throw new Error("mock: 无此效果 " + name);
        return function (idx) { return vals[name]; };
    };
}

function mkThisComp(ctrlPos, ctrlFx, points, hgtY) {
    return {
        layer: function (nm) {
            // 总闸「山峰 高度」: 只有显式给了 hgtY 才"存在"(否则 throw -> 表达式走 catch,
            //   等价于图层被删 -> hGate 保持 0)。这样既测得到总闸路径, 也不影响既有用例。
            if (hgtY != null && nm === NAME.hgt) {
                return { transform: { position: [ctrlPos[0], hgtY] } };
            }
            if (nm === NAME.ctrl) {
                return { transform: { position: ctrlPos }, effect: mkEffect(ctrlFx) };
            }
            if (nm.indexOf(NAME.ptPrefix) === 0) {
                var rest = nm.substring(NAME.ptPrefix.length);
                var lLen = NAME.ptLSuffix.length, rLen = NAME.ptRSuffix.length;
                var isEdge = false, isL = false;
                if (rest.length > lLen && rest.substring(rest.length - lLen) === NAME.ptLSuffix) {
                    isEdge = true; isL = true;
                } else if (rest.length > rLen && rest.substring(rest.length - rLen) === NAME.ptRSuffix) {
                    isEdge = true; isL = false;
                }
                var kk = parseInt(rest, 10);
                var p = points[kk - 1];
                if (!p) throw new Error("mock: 无此图层 " + nm);
                if (isEdge) {
                    // 边缘控制点: p.xl / p.xr 给了才"存在", 否则 throw ->
                    //   表达式走 catch, 该侧回退成「影响范围」换算的对称半径
                    var ex = isL ? p.xl : p.xr;
                    if (ex == null) throw new Error("mock: 无边缘点 " + nm);
                    return { transform: { position: [ex, 0] } };
                }
                var fx = {};
                fx[NAME.r] = p.r;
                // 「高度」滑块: p.h 给了就提供, 没给就让它取不到 -> 走表达式里的 catch 回退
                // (这样既测得到"读高度"的路径, 也不会影响既有用例)
                if (p.h != null) { fx[NAME.h] = p.h; }
                // 「边缘控制」滑块: p.ec 给了才提供。没给 -> 表达式走 catch, ecOn = 0,
                //   于是完全不去查边缘点 -> 既有用例的路径与开销都不变。
                if (p.ec != null) { fx[NAME.ec] = p.ec; }
                return { transform: { position: [p.x, p.y] }, effect: mkEffect(fx) };
            }
            throw new Error("mock: 无此图层 " + nm);
        }
    };
}

function evalExpr(code, thisComp, layerPos, outVar) {
    // AE 取表达式最后一句的值; node 的 new Function 不会自动返回,
    // 所以按契约在末尾补一句 return <收尾变量>(表达式的收尾变量名由模块导出)。
    var f = new Function("thisComp", "transform", code + "\nreturn " + outVar + ";");
    return f(thisComp, { position: layerPos });
}

var CW = 1920, CH = 1080;
// v0.1.2 起: 几何锚点是【形状图层自身】的位置(= 行中心 X / 基线 Y),
// 控制器只提供滑块参数, 它的位置不参与几何计算。
var ctrlPos = [CW / 2, CH * 0.8];
var layerPos = [CW / 2, CH * 0.8];
var NN = 7, WW = 24, GG = 10, BASEC = 40;
var MO = 3;
// points[].r = 【总共影响几根竖条】(v0.3.4 口径)。
// 取 17/11/25 —— 换算出的有效半径与旧版「每侧 8/5/12」完全相同((m+1)/2 = 旧值+1),
// 所以下游那些关系型断言(上移更矮 / 下移更高 等)无需改动。
var pointsCase = [
    { x: CW / 2 - 220, y: CH * 0.8 - 300, r: 17 },
    { x: CW / 2 + 30, y: CH * 0.8 - 180, r: 11 },
    { x: CW / 2 + 300, y: CH * 0.8 - 420, r: 25 }
];

var cfgList = [
    { mode: 0, ftype: 0 }, { mode: 0, ftype: 1 }, { mode: 0, ftype: 2 }, { mode: 0, ftype: 3 },
    { mode: 1, ftype: 0 }, { mode: 1, ftype: 1 }, { mode: 1, ftype: 2 }, { mode: 1, ftype: 3 }
];

for (var ci = 0; ci < cfgList.length; ci++) {
    var cfg = cfgList[ci];
    var ctrlFx = {};
    ctrlFx[NAME.w] = WW;
    ctrlFx[NAME.g] = GG;
    ctrlFx[NAME.base] = BASEC;
    ctrlFx[NAME.mode] = cfg.mode;
    ctrlFx[NAME.ftype] = cfg.ftype;
    var tc = mkThisComp(ctrlPos, ctrlFx, pointsCase);

    for (var bi = 0; bi < NN; bi++) {
        var tag = "m" + cfg.mode + "/f" + cfg.ftype + "/#" + bi;

        // 纯函数期望值(行中心/基线 = 形状图层自身位置)
        var wantH = T.barHeightOfIndex(bi, NN, WW, GG, layerPos[0], layerPos[1],
                                       pointsCase, cfg.mode, BASEC, cfg.ftype);
        // 大小表达式
        var sz = evalExpr(T.buildSizeExpr(bi, NN, MO), tc, layerPos, NAME.outSize);
        near("size[0]=W " + tag, sz[0], WW, 1e-9);
        near("size[1]=h " + tag, sz[1], wantH, 1e-9);

        // 位置表达式: 输出【纯图层坐标偏移】, 不含任何抵消图层位置的项
        var ps = evalExpr(T.buildPosExpr(bi, NN, MO), tc, layerPos, NAME.outPos);
        near("pos[0] " + tag, ps[0], T.barOffsetX(bi, NN, WW, GG), 1e-9);
        near("pos[1] " + tag, ps[1], -wantH / 2, 1e-9);

        // 底边必须钉在基线: 矩形中心 y + h/2 = 图层原点 y(即基线)
        near("底边贴基线 " + tag, ps[1] + wantH / 2, 0, 1e-9);

        // 合成坐标校验: 图层位置 + 图层坐标 = 期望的合成坐标
        near("comp X 落在行布局上 " + tag,
            layerPos[0] + ps[0], layerPos[0] + T.barOffsetX(bi, NN, WW, GG), 1e-9);
        near("comp Y 顶边 = 基线 - h " + tag,
            layerPos[1] + ps[1] - wantH / 2, layerPos[1] - wantH, 1e-9);
    }
}

// ---- 表达式健壮性: 点位图层缺失 / 影响范围滑块读取失败 ----
var fxOnly2 = {};
fxOnly2[NAME.w] = WW; fxOnly2[NAME.g] = GG; fxOnly2[NAME.base] = BASEC;
fxOnly2[NAME.mode] = 0; fxOnly2[NAME.ftype] = 0;
// 只提供 2 个点位, 但表达式里的 M = 5(模拟用户删掉了点位图层)
var tcMissing = mkThisComp(ctrlPos, fxOnly2, [pointsCase[0], pointsCase[1]]);
var szMissing = evalExpr(T.buildSizeExpr(0, NN, 5), tcMissing, layerPos, NAME.outSize);
var wantMissing = T.barHeightOfIndex(0, NN, WW, GG, layerPos[0], layerPos[1],
    [pointsCase[0], pointsCase[1]], 0, BASEC, 0);
near("缺失点位不报错且跳过", szMissing[1], wantMissing, 1e-9);
eq("缺失点位时仍返回两分量", szMissing.length, 2);

// 影响范围滑块读取抛错 -> 该点被跳过
// 探针用「柱 3」(bx = layerPos[0] + 0, 柱距 pitch = 24+10 = 34):
//   点1 在 layerPos[0] 且 r=1(相位 Δ=0 -> kNN 半径 0.5 格, t=0, 贡献 300)
//   点2 在 layerPos[0]+68 且 r=7(相位 Δ=0 -> kNN 半径 3 格 = 102px, t=68/102)
//   -> 叠加按纯函数 barHeightOfIndex 校验(两条实现必须一致)
var ptsFx = [
    { x: layerPos[0], y: layerPos[1] - 300, r: 1 },
    { x: layerPos[0] + 68, y: layerPos[1] - 300, r: 7 }
];
var tcBoth = mkThisComp(ctrlPos, fxOnly2, ptsFx);
near("对照: 两点都生效时叠加 = 纯函数值",
    evalExpr(T.buildSizeExpr(3, NN, 2), tcBoth, layerPos, NAME.outSize)[1],
    // ⚠️ baseH 必须与 mock 控制器里的值(BASEC)一致: v0.9.0 起 baseH 参与峰高计算
    //    (effH = 峰高 − 基础高度), 传 0 会与表达式算出不同的数
    T.barHeightOfIndex(3, NN, WW, GG, layerPos[0], layerPos[1], ptsFx, 0, BASEC, 0, 100), 1e-9);

var tcBadFx = mkThisComp(ctrlPos, fxOnly2, ptsFx);
var origLayer = tcBadFx.layer;
tcBadFx.layer = function (nm) {
    var L = origLayer(nm);
    if (nm === NAME.ptPrefix + "2") { L.effect = function () { throw new Error("boom"); }; }
    return L;
};
// 点2 被跳过 -> 只剩点1 的 300
near("滑块读取失败的点被跳过",
    evalExpr(T.buildSizeExpr(3, NN, 2), tcBadFx, layerPos, NAME.outSize)[1], 300, 1e-9);

// ============================================================
// 三、影响范围 = 【影响几根竖条】(kNN 半径) + 影响范围倍率%
// ============================================================
var PITCH = WW + GG;   // 24 + 10 = 34

// ---- barPhase: 点位相对柱网的相位 ∈ [0, 0.5] ----
near("正落在柱子上 -> 相位 0", T.barPhase(100, 100, PITCH), 0, 1e-12);
near("落在两根正中 -> 相位 0.5", T.barPhase(117, 100, PITCH), 0.5, 1e-12);
near("偏 1/4 格 -> 相位 0.25", T.barPhase(108.5, 100, PITCH), 0.25, 1e-12);
near("相位按最近柱折叠(1.25 格 == 0.25 格)", T.barPhase(142.5, 100, PITCH), T.barPhase(108.5, 100, PITCH), 1e-12);
eq("柱距 0 时相位 0(不除零)", T.barPhase(100, 100, 0), 0);
eq("相位恒 ∈ [0, 0.5]", (function () {
    var q, v;
    for (q = 0; q < 200; q++) {
        v = T.barPhase(100 + q * 3.7, 100, PITCH);
        if (v < 0 || v > 0.5) { return false; }
    }
    return true;
})(), true);

// ---- influenceRadiusPx: kNN 半径 —— 取【第 m 近那根柱子的实际距离】× 柱距 ----
// 距离序列(单位=柱距): Δ, 1-Δ, 1+Δ, 2-Δ, 2+Δ, …
//   m 奇 → (m-1)/2 + Δ ;  m 偶 → m/2 - Δ
var REPS = 1 + 1e-9;   // 半径末尾的抗浮点放大系数(见 influenceRadiusPx 注释), 断言容差用 1e-6
near("Δ=0(正对柱子) m=9 -> 4 格", T.influenceRadiusPx(9, PITCH, 100, 0), 4 * PITCH * REPS, 1e-6);
near("Δ=0.5(正中) m=9 -> 4.5 格", T.influenceRadiusPx(9, PITCH, 100, 0.5), 4.5 * PITCH * REPS, 1e-6);
near("Δ=0.4265 m=9 -> 4.4265 格", T.influenceRadiusPx(9, PITCH, 100, 0.4265), 4.4265 * PITCH * REPS, 1e-6);
near("Δ=0 m=10(偶) -> 5 格", T.influenceRadiusPx(10, PITCH, 100, 0), 5 * PITCH * REPS, 1e-6);
near("Δ=0.5 m=10(偶) -> 4.5 格", T.influenceRadiusPx(10, PITCH, 100, 0.5), 4.5 * PITCH * REPS, 1e-6);
near("Δ 缺省 = 0.5(最保守)", T.influenceRadiusPx(9, PITCH, 100), 4.5 * PITCH * REPS, 1e-6);
near("Δ > 0.5 钳到 0.5", T.influenceRadiusPx(9, PITCH, 100, 0.9), 4.5 * PITCH * REPS, 1e-6);
near("Δ 负数钳到 0", T.influenceRadiusPx(9, PITCH, 100, -1), 4 * PITCH * REPS, 1e-6);
near("k 下限 0.5 格(填 1 且正对柱子)", T.influenceRadiusPx(1, PITCH, 100, 0), 0.5 * PITCH * REPS, 1e-6);
near("m=0 钳到 1 根", T.influenceRadiusPx(0, PITCH, 100, 0), 0.5 * PITCH * REPS, 1e-6);
near("m=-3 钳到 1 根", T.influenceRadiusPx(-3, PITCH, 100, 0), 0.5 * PITCH * REPS, 1e-6);
near("倍率 200% -> 半径翻倍", T.influenceRadiusPx(9, PITCH, 200, 0), 2 * T.influenceRadiusPx(9, PITCH, 100, 0), 1e-6);
near("倍率 50% -> 半径减半", T.influenceRadiusPx(9, PITCH, 50, 0), 0.5 * T.influenceRadiusPx(9, PITCH, 100, 0), 1e-6);
near("倍率 0% -> 半径 0", T.influenceRadiusPx(9, PITCH, 0, 0), 0, 1e-12);
near("倍率负数 -> 半径为负(视作无影响)", T.influenceRadiusPx(9, PITCH, -100, 0), -4 * PITCH * REPS, 1e-6);
near("半径与柱距成正比", T.influenceRadiusPx(9, PITCH * 2, 100, 0),
    2 * T.influenceRadiusPx(9, PITCH, 100, 0), 1e-6);
eq("导出倍率默认值 = 100", NAME.rscaleDef, 100);
eq("导出倍率滑块名", NAME.rscale, "影响范围倍率%");

// ---- resolvePoints: 根数 -> 像素(给了 rowLeftX 就走 kNN 精确半径) ----
var rp = T.resolvePoints([{ x: 5, y: 6, r: 9 }], PITCH, 100);
eq("resolvePoints 保留 x", rp[0].x, 5);
eq("resolvePoints 保留 y", rp[0].y, 6);
near("不给 rowLeftX 时按 Δ=0.5 保守取值(9 根 -> 4.5 格)", rp[0].r, 4.5 * PITCH * REPS, 1e-6);
// 给了 rowLeftX: 点位正好落在柱子上(Δ=0) -> 9 根 = 4 格
var rpK = T.resolvePoints([{ x: 200, y: 6, r: 9 }], PITCH, 100, 200);
near("给 rowLeftX 且 Δ=0: 9 根 -> 4 格", rpK[0].r, 4 * PITCH * REPS, 1e-6);
// 点位偏移 1 格 -> 仍 Δ=0(落在下一根柱子上)
var rpK2 = T.resolvePoints([{ x: 200 + PITCH, y: 6, r: 9 }], PITCH, 100, 200);
near("偏移整格仍 Δ=0", rpK2[0].r, 4 * PITCH * REPS, 1e-6);
// 偏移半格 -> Δ=0.5
var rpK3 = T.resolvePoints([{ x: 200 + PITCH / 2, y: 6, r: 9 }], PITCH, 100, 200);
near("偏移半格 Δ=0.5 -> 4.5 格", rpK3[0].r, 4.5 * PITCH * REPS, 1e-6);
// 逐点各自换算(倍率 200%)
var rp2 = T.resolvePoints([{ x: 200, y: 0, r: 3 }, { x: 200, y: 0, r: 9 }], PITCH, 200, 200);
near("resolvePoints 逐点换算 #1(3 根 Δ=0 -> 1 格 ×2 倍率)", rp2[0].r, 2 * PITCH * REPS, 1e-6);
near("resolvePoints 逐点换算 #2(9 根 Δ=0 -> 4 格 ×2 倍率)", rp2[1].r, 8 * PITCH * REPS, 1e-6);

// ---- ⭐ 核心性质: 同样"第 j 根", 换任何柱距高度都不变 ----
// 这正是"改成根数单位"的意义: 改矩形宽/间距时波形不被带跑
var pBars = [{ x: 0, y: BASE - 300, r: 2 }];   // 每侧 2 根
var pitchInvariant = true;
var pitchList = [1, 7, 34, 100, 250];
for (var pvi = 0; pvi < pitchList.length; pvi++) {
    for (var pj1 = 0; pj1 <= 4; pj1++) {
        var hTry = T.barHeightAt(pj1 * pitchList[pvi],
            T.resolvePoints(pBars, pitchList[pvi], 100), BASE, 0, 0, 0);
        var hRef = T.barHeightAt(pj1 * PITCH, T.resolvePoints(pBars, PITCH, 100), BASE, 0, 0, 0);
        if (Math.abs(hTry - hRef) > 1e-9) { pitchInvariant = false; }
    }
}
eq("换任何柱距, 同一根柱子的高度不变", pitchInvariant, true);

// ---- ⭐ 用户口径: 影响范围 m = 【总共影响 m 根】—— 摆一个奇数行逐根数 ----
// N=21 奇数行 + 点位正对中间那根 → j 取整数 -10..10, 数"有值的根数"
function countAffected(total, N) {
    var ptsM = [{ x: 0, y: BASE - 300, r: total }];
    var rpxM = T.resolvePoints(ptsM, PITCH, 100);
    var cnt = 0, half = (N - 1) / 2;
    for (var qj = -half; qj <= half; qj++) {
        if (T.barHeightAt(qj * PITCH, rpxM, BASE, 0, 0, 0) > 1e-9) { cnt = cnt + 1; }
    }
    return cnt;
}
eq("影响范围 1 -> 正好 1 根", countAffected(1, 21), 1);
eq("影响范围 3 -> 正好 3 根", countAffected(3, 21), 3);
eq("影响范围 5 -> 正好 5 根", countAffected(5, 21), 5);
eq("影响范围 9 -> 正好 9 根", countAffected(9, 21), 9);
eq("影响范围 15 -> 正好 15 根", countAffected(15, 21), 15);
eq("影响范围 19 -> 正好 19 根", countAffected(19, 21), 19);
eq("影响范围 40 -> 整行 21 根全影响", countAffected(40, 21), 21);

// ---- 边界: 最外那根有值、再外一根归零; 左右对称 ----
for (var kk1 = 1; kk1 <= 9; kk1 = kk1 + 2) {
    var rpxK = T.resolvePoints([{ x: 0, y: BASE - 300, r: kk1 }], PITCH, 100);
    var halfK = (kk1 - 1) / 2;
    near("总" + kk1 + "根: 正下方 = 峰顶", T.barHeightAt(0, rpxK, BASE, 0, 0, 0), 300, 1e-12);
    eq("总" + kk1 + "根: 最外那根有值", T.barHeightAt(halfK * PITCH, rpxK, BASE, 0, 0, 0) > 0, true);
    near("总" + kk1 + "根: 再外一根归零",
        T.barHeightAt((halfK + 1) * PITCH, rpxK, BASE, 0, 0, 0), 0, 1e-12);
    near("总" + kk1 + "根: 左右对称",
        T.barHeightAt(-halfK * PITCH, rpxK, BASE, 0, 0, 0),
        T.barHeightAt(halfK * PITCH, rpxK, BASE, 0, 0, 0), 1e-12);
}

// ---- 倍率: 只缩放宽度, 不动峰高 ----
// 总 3 根 -> 半径 2×34 = 68px; 取「柱 1」(偏移 (1-3)×34 = -68)正好落在半径边界上
var pb2 = [{ x: layerPos[0], y: layerPos[1] - 300, r: 3 }];
near("倍率 100%: 距 68px 的柱子归零",
    T.barHeightOfIndex(1, 7, WW, GG, layerPos[0], layerPos[1], pb2, 0, 0, 0, 100), 0, 1e-12);
eq("倍率 200%: 该柱子已有值",
    T.barHeightOfIndex(1, 7, WW, GG, layerPos[0], layerPos[1], pb2, 0, 0, 0, 200) > 0, true);
near("倍率只缩放宽度, 峰高不变(取最高)",
    T.barHeightOfIndex(3, 7, WW, GG, layerPos[0], layerPos[1], pb2, 1, 0, 0, 300), 300, 1e-12);
near("倍率 0%: 只剩基础高度",
    T.barHeightOfIndex(3, 7, WW, GG, layerPos[0], layerPos[1], pb2, 0, 40, 0, 0), 40, 1e-12);

// ---- autoInfluenceBars: 按数量/点数自动推算(返回【总根数】) ----
eq("自动: 40 根 / 5 点 / 柱距 34 -> 32", T.autoInfluenceBars(40, 24, 10, 5), 32);
eq("自动: 点越多半径越小",
    T.autoInfluenceBars(40, 24, 10, 20) < T.autoInfluenceBars(40, 24, 10, 5), true);
eq("自动: 至少为 1", T.autoInfluenceBars(1, 24, 10, 5) >= 1, true);
eq("自动: 柱距为 0 时保护", T.autoInfluenceBars(40, 0, 0, 5), 1);
eq("自动: 点数为 0 时保护", T.autoInfluenceBars(40, 24, 10, 0), 1);
eq("自动: 极窄合成仍为 1", T.autoInfluenceBars(1, 24, 10, 1), 1);

// ---- 自动值必须封顶到 N(点数很少时"点位/影响范围没作用"的根因) ----
eq("自动封顶: 点数=1 -> 整行 40", T.autoInfluenceBars(40, 24, 10, 1), 40);
eq("自动封顶: 点数=2 -> 整行 40", T.autoInfluenceBars(40, 24, 10, 2), 40);
eq("自动封顶: 点数=4 未触发封顶", T.autoInfluenceBars(40, 24, 10, 4), 39);
eq("自动: 任何点数都不超过 N", (function () {
    for (var mm = 1; mm <= 30; mm++) {
        if (T.autoInfluenceBars(40, 24, 10, mm) > 40) { return false; }
    }
    return true;
})(), true);

// 封顶后: 单点山丘在行端应【明显低于峰顶】(仍是山丘, 不是"整行被抬平")
// v0.6.0 起窗口形状可调(w = e + (1-e)×falloff), 边缘不再是 0 而是 e 倍峰高 —— 仍远低于峰顶
var pCap = [{ x: 0, y: BASE - 300, r: T.autoInfluenceBars(40, 24, 10, 1) }];   // 40 根 -> 19.5 格
var edgeCap = T.barHeightOfIndex(0, 40, 24, 10, 0, BASE, pCap, 0, 0, 0, 100);  // 第 0 根 = 行端
eq("封顶后: 行端贡献明显低于峰顶(<0.4 倍)", edgeCap < 300 * 0.4, true);
eq("封顶后: 行端仍在窗口内(边缘 = 曲线尾端 e 倍峰高, 非 0)", edgeCap > 300 * 0.05, true);
// 对照: 不封顶时(96 根 -> 47.5 格)行端几乎和峰顶一样高 —— 这就是"看起来没作用"的原因
var pNoCap = [{ x: 0, y: BASE - 300, r: 96 }];
var edgeNoCap = T.barHeightOfIndex(0, 40, 24, 10, 0, BASE, pNoCap, 0, 0, 0, 100);
eq("对照: 不封顶(96 根)行端仍高达六成", edgeNoCap > 300 * 0.6, true);
eq("封顶值远小于不封顶值", T.autoInfluenceBars(40, 24, 10, 1) < 96, true);
eq("封顶确实把行端压下来了", edgeCap < edgeNoCap, true);

// ---- 表达式端到端: 倍率参与运算 ----
var rsList = [25, 100, 250];
var rsCfg = [{ mode: 0, ftype: 0 }, { mode: 1, ftype: 3 }];
for (var ri = 0; ri < rsList.length; ri++) {
    for (var rj = 0; rj < rsCfg.length; rj++) {
        var rscV = rsList[ri];
        var cfR = rsCfg[rj];
        var fxR = {};
        fxR[NAME.w] = WW;
        fxR[NAME.g] = GG;
        fxR[NAME.base] = BASEC;
        fxR[NAME.mode] = cfR.mode;
        fxR[NAME.ftype] = cfR.ftype;
        fxR[NAME.rscale] = rscV;
        var tcR = mkThisComp(ctrlPos, fxR, pointsCase);
        for (var bk = 0; bk < NN; bk++) {
            var tgR = "倍率" + rscV + "/m" + cfR.mode + "/f" + cfR.ftype + "/#" + bk;
            var whR = T.barHeightOfIndex(bk, NN, WW, GG, layerPos[0], layerPos[1],
                                         pointsCase, cfR.mode, BASEC, cfR.ftype, rscV);
            var szR = evalExpr(T.buildSizeExpr(bk, NN, MO), tcR, layerPos, NAME.outSize);
            near("size[1] " + tgR, szR[1], whR, 1e-9);
            var psR = evalExpr(T.buildPosExpr(bk, NN, MO), tcR, layerPos, NAME.outPos);
            near("pos[1] " + tgR, psR[1], -whR / 2, 1e-9);
        }
    }
}

// ---- 向后兼容: 旧工程(v0.1.0 生成)没有倍率滑块 -> 表达式回退 100% ----
var fxOld = {};
fxOld[NAME.w] = WW;
fxOld[NAME.g] = GG;
fxOld[NAME.base] = BASEC;
fxOld[NAME.mode] = 0;
fxOld[NAME.ftype] = 0;
var tcOld = mkThisComp(ctrlPos, fxOld, pointsCase);
var szOld = evalExpr(T.buildSizeExpr(0, NN, MO), tcOld, layerPos, NAME.outSize);
near("无倍率滑块时回退 100%", szOld[1],
    T.barHeightOfIndex(0, NN, WW, GG, layerPos[0], layerPos[1],
                       pointsCase, 0, BASEC, 0, 100), 1e-9);

// ============================================================
// 四、形状图层可拖动(回归: v0.1.1 拖动形状图层整行不动)
// ============================================================
// 判据: 「矩形路径位置」输出的是【图层坐标偏移】, AE 会再叠加图层自身
// position, 所以只有输出【与图层位置无关】, 拖动图层才真能移动整行。
// 旧实现 bx 取自控制器合成坐标、又被减去图层坐标 -> 两者相消 -> 拖不动。
var fxDrag = {};
fxDrag[NAME.w] = WW; fxDrag[NAME.g] = GG; fxDrag[NAME.base] = BASEC;
fxDrag[NAME.mode] = 0; fxDrag[NAME.ftype] = 0;
var tcDrag = mkThisComp(ctrlPos, fxDrag, pointsCase);
var L0 = [CW / 2, CH * 0.8];

// ---- X 方向: 输出与图层 X 无关 -> 图层位移 1:1 传导到合成坐标 ----
var vx0 = evalExpr(T.buildPosExpr(2, NN, MO), tcDrag, L0, NAME.outPos);
var vx1 = evalExpr(T.buildPosExpr(2, NN, MO), tcDrag, [L0[0] + 200, L0[1]], NAME.outPos);
eq("位置输出 X 与图层位置无关(可拖动的前提)", vx0[0] === vx1[0], true);
near("图层右移 200 -> 合成坐标同步右移 200",
    (L0[0] + 200 + vx1[0]) - (L0[0] + vx0[0]), 200, 1e-9);
near("水平偏移就是 barOffsetX(行随图层整体平移)", vx0[0], T.barOffsetX(2, NN, WW, GG), 1e-9);

// ---- 几何不变式: 底边(基线)在合成坐标里恒等于图层 Y, 图层怎么移都成立 ----
// 注意: 纵向移动会改变基线与点位的相对距离, 峰高随之变, 所以
//       不能拿"柱心"做 delta 判据, 必须用"底边"这个不变量。
var dragCases = [[L0[0], L0[1]], [L0[0] + 340, L0[1]], [L0[0] - 260, L0[1] - 150], [L0[0], L0[1] + 90]];
for (var dk = 0; dk < dragCases.length; dk++) {
    var lpD = dragCases[dk];
    var hD = T.barHeightOfIndex(2, NN, WW, GG, lpD[0], lpD[1], pointsCase, 0, BASEC, 0);
    var pD = evalExpr(T.buildPosExpr(2, NN, MO), tcDrag, lpD, NAME.outPos);
    var sD = evalExpr(T.buildSizeExpr(2, NN, MO), tcDrag, lpD, NAME.outSize);
    near("大小与纯函数一致 #" + dk, sD[1], hD, 1e-9);
    near("底边在合成坐标 = 图层 Y #" + dk, lpD[1] + pD[1] + hD / 2, lpD[1], 1e-9);
    near("柱心在合成坐标 = 图层 Y - h/2 #" + dk, lpD[1] + pD[1], lpD[1] - hD / 2, 1e-9);
}

// ---- 纵向语义: 基线 = 图层 Y, 峰高 = 基线 - 点位 Y ----
// 图层上移 -> 基线抬高 -> 点位离基线更近 -> 山丘更矮(设计语义, 不是 bug)
var hBase = T.barHeightOfIndex(3, NN, WW, GG, L0[0], L0[1], pointsCase, 0, BASEC, 0);
var hUp = T.barHeightOfIndex(3, NN, WW, GG, L0[0], L0[1] - 200, pointsCase, 0, BASEC, 0);
var hDown = T.barHeightOfIndex(3, NN, WW, GG, L0[0], L0[1] + 100, pointsCase, 0, BASEC, 0);
eq("图层上移 -> 基线抬高 -> 山丘更矮", hUp < hBase, true);
eq("图层下移 -> 基线降低 -> 山丘更高", hDown > hBase, true);
eq("基线高过所有点位时山丘归零(只剩基础高度)",
    T.barHeightOfIndex(3, NN, WW, GG, L0[0], 300, pointsCase, 0, BASEC, 0), BASEC);

// ---- 表达式文本: 不允许出现"抵消图层位置"的写法 ----
eq("位置表达式无抵消图层位置项",
    T.buildPosExpr(0, 2, 1).indexOf("bx - transform.position[0]") < 0, true);
eq("位置表达式输出纯偏移量",
    T.buildPosExpr(0, 2, 1).indexOf("var outPos = [(i - (N - 1) / 2) * (W + G), -h / 2];") >= 0, true);
eq("核心改用图层自身位置算柱子 comp X",
    T.buildExprCore(0, 2, 1).indexOf("var bx = transform.position[0] + ") >= 0, true);
eq("核心用图层 Y 作基线", T.buildExprCore(0, 2, 1).indexOf("pk = transform.position[1] - pp[1];") >= 0, true);
eq("核心不再引用控制器位置", T.buildExprCore(0, 2, 1).indexOf("c.transform.position") < 0, true);

// ---- 表达式文本体检 ----
var ex = T.buildSizeExpr(3, 10, 4);
var core = T.buildExprCore(3, 10, 4);
eq("表达式写死 i", ex.indexOf("var i = 3;") >= 0, true);
eq("表达式写死 N", ex.indexOf("var N = 10;") >= 0, true);
eq("表达式写死 M", ex.indexOf("var M = 4;") >= 0, true);
eq("表达式输出无 BOM", ex.charCodeAt(0) !== 0xFEFF, true);
eq("表达式无单行注释", ex.indexOf("//") < 0, true);
eq("表达式无反斜杠(ExtendScript 正则雷)", ex.indexOf(String.fromCharCode(92)) < 0, true);
// 保守语法(表达式引擎子集, 见仓库 Water-Rise/AGENTS.md 与 NumCounter 已验证写法)
eq("表达式不用 += ", ex.indexOf("+=") < 0, true);
eq("表达式不用 *= ", ex.indexOf("*=") < 0, true);
eq("表达式不用 ++ ", ex.indexOf("++") < 0, true);
eq("表达式不用 continue ", ex.indexOf("continue") < 0, true);
eq("表达式不含 IIFE", ex.indexOf("(function") < 0, true);
eq("表达式无 var 多变量声明", core.search(/var \w+ = [^;]*,/) < 0, true);
// 靠收尾裸变量返回值(AE 取最后一句的值)
eq("大小表达式有收尾变量", ex.indexOf("var outSize = [W, h];") >= 0 && ex.indexOf("\noutSize;") >= 0, true);
eq("位置表达式有收尾变量", T.buildPosExpr(0, 2, 1).indexOf("\noutPos;") >= 0, true);
eq("位置表达式含底边补偿(-h/2)", T.buildPosExpr(0, 2, 1).indexOf(", -h / 2];") >= 0, true);
eq("表达式含 try 保护点位查找", ex.indexOf("try { P = thisComp.layer(") >= 0, true);
eq("表达式循环上限写死 M", ex.indexOf("k <= M; k = k + 1") >= 0, true);
eq("表达式读倍率滑块", ex.indexOf('rsc = c.effect("' + NAME.rscale + '")(1)') >= 0, true);
eq("表达式有倍率回退默认值", ex.indexOf("catch (e3) { rsc = 100; }") >= 0, true);
eq("表达式定义柱距 pitch", ex.indexOf("var pitch = W + G;") >= 0, true);
// kNN 半径(第 m 近那根柱子的实际距离)
eq("表达式算行首 X", ex.indexOf("var rowLeftX = transform.position[0] - (N - 1) / 2 * pitch;") >= 0, true);
eq("表达式算点位相位 fr", ex.indexOf("fr = ic - Math.floor(ic);") >= 0, true);
eq("表达式把相位折叠到 [0,0.5]", ex.indexOf("if (fr > 0.5) { fr = 1 - fr; }") >= 0, true);
eq("表达式按奇偶取第 m 近距离", ex.indexOf("if (R % 2 > 0.5) { kk = (R - 1) / 2 + fr; }") >= 0, true);
eq("表达式偶数分支", ex.indexOf("kk = R / 2 - fr;") >= 0, true);
eq("表达式 k 下限 0.5 格", ex.indexOf("if (kk < 0.5) { kk = 0.5; }") >= 0, true);
eq("表达式半径含抗浮点放大", ex.indexOf("R = kk * pitch * rsc / 100 * 1.000000001;") >= 0, true);
// v0.8.0 起判正对象由 R 改为 rUse(左右可能不同半径, 取实际用的那个)
eq("kNN 换算排在半径判正之前",
    ex.indexOf("R = kk * pitch * rsc / 100 * 1.000000001;") < ex.indexOf("if (rUse > 0) {"), true);
eq("旧公式已清除(每侧版)", ex.indexOf("R = (R + 1) * pitch * rsc / 100;") < 0, true);
eq("旧公式已清除(像素版)", ex.indexOf("R = R * rsc / 100;") < 0, true);
eq("旧公式已清除((m+1)/2 版)", ex.indexOf("R = (R + 1) / 2 * pitch * rsc / 100;") < 0, true);
eq("窗口判定用 ≤(边界那根要算进来)", ex.indexOf("if (t <= 1) {") >= 0, true);
// 表达式里不能出现 ES3 保留字做对象字面量键(这里根本没对象字面量)
eq("表达式无对象字面量", ex.indexOf("{ f:") < 0 && ex.indexOf("{f:") < 0, true);
eq("表达式无颜色字面量残留", ex.indexOf("undefined") < 0, true);

// ============================================================
// 五、预设(4 固定槽位 + 导出导入)
// ============================================================
var PK = T.PRESET;
eq("预设文件名", PK.file, "MountainSpectrum.presets.json");
eq("槽位数 = 4", PK.slotCount, 4);
eq("槽位 key 为 1-based 字符串", PK.slotKeys.join(","), "1,2,3,4");
eq("预设字段数 = 12(含 ph/edge)", PK.keys.length, 12);
eq("预设含「点位高度」键 ph", PK.keys.indexOf("ph") >= 0, true);
eq("预设含「边缘高度%」键 edge", PK.keys.indexOf("edge") >= 0, true);
eq("DEFAULTS.ph = 0(自动)", PK.defaults.ph, 0);
eq("DEFAULTS.edge = 10", PK.defaults.edge, 10);
eq("序列化: ph 越界钳到 0", T.serializePreset({ ph: -50 }).ph, 0);
eq("序列化: ph 保留", T.serializePreset({ ph: 500 }).ph, 500);
eq("序列化: edge 超 100 钳到 100", T.serializePreset({ edge: 250 }).edge, 100);
eq("序列化: edge 负数钳到 0", T.serializePreset({ edge: -5 }).edge, 0);
eq("序列化: ph 缺省 = 0", T.serializePreset({}).ph, 0);
eq("序列化: edge 缺省 = 10", T.serializePreset({}).edge, 10);
var peRT = T.deserializePreset(T.serializePreset({ n: 8, ph: 320, edge: 75 }));
eq("ph 往返一致", peRT.ph, 320);
eq("edge 往返一致", peRT.edge, 75);
eq("旧预设(无 ph/edge 键)按默认补", (function () {
    var o = T.jsonParseSlots('{"version":3,"slots":{"1":{"n":10,"r":9},"2":null,"3":null,"4":null}}');
    return o.slots["1"].ph === 0 && o.slots["1"].edge === NAME.edgeDef;
})(), true);

// ---- pickNum / pickBool ----
eq("pickNum 空串 -> 默认", T.pickNum("", 24), 24);
eq("pickNum undefined -> 默认", T.pickNum(undefined, 24), 24);
eq("pickNum null -> 默认", T.pickNum(null, 24), 24);
eq("pickNum 非数字串 -> 默认", T.pickNum("abc", 24), 24);
eq("pickNum 数字串 -> 数字", T.pickNum("24.5", 24), 24.5);
eq("pickNum 数字 -> 数字", T.pickNum(30, 24), 30);
eq("pickBool true", T.pickBool(true), true);
eq("pickBool \"true\"", T.pickBool("true"), true);
eq("pickBool 1", T.pickBool(1), true);
eq("pickBool \"1\"", T.pickBool("1"), true);
eq("pickBool false", T.pickBool(false), false);
eq("pickBool \"false\"", T.pickBool("false"), false);
eq("pickBool 0", T.pickBool(0), false);
eq("pickBool undefined", T.pickBool(undefined), false);

// ---- serializePreset: 缺省 -> DEFAULTS ----
var pzDefault = T.serializePreset(null);
eq("默认 n", pzDefault.n, PK.defaults.n);
eq("默认 w", pzDefault.w, PK.defaults.w);
eq("默认 gap", pzDefault.gap, PK.defaults.gap);
eq("默认 baseH", pzDefault.baseH, PK.defaults.baseH);
eq("默认 baseRatio", pzDefault.baseRatio, PK.defaults.baseRatio);
eq("默认 ftype", pzDefault.ftype, PK.defaults.ftype);
eq("默认 mode", pzDefault.mode, PK.defaults.mode);
eq("默认 r", pzDefault.r, PK.defaults.r);
eq("默认 pts", pzDefault.pts, PK.defaults.pts);
eq("默认 auto = false", pzDefault.auto, false);

// 复位 = serializePreset(null) -> 必须逐字段等于 DEFAULTS(面板「复位」按钮走这条)
var qResetOk = true;
for (qk = 0; qk < PK.keys.length; qk++) {
    var qRk = PK.keys[qk];
    if (String(pzDefault[qRk]) !== String(PK.defaults[qRk])) { qResetOk = false; }
}
eq("复位对象逐字段等于 DEFAULTS", qResetOk, true);

// ---- serializePreset: 面板串(全是字符串) -> 数字 ----
var pzStr = T.serializePreset({
    n: "12", auto: true, w: "30", gap: "4.5", baseH: "60",
    baseRatio: "75", ftype: "2", mode: "1", r: "180", pts: "8"
});
eq("面板串 n", pzStr.n, 12);
eq("面板串 auto", pzStr.auto, true);
eq("面板串 w", pzStr.w, 30);
eq("面板串 gap", pzStr.gap, 4.5);
eq("面板串 baseH", pzStr.baseH, 60);
eq("面板串 baseRatio", pzStr.baseRatio, 75);
eq("面板串 ftype", pzStr.ftype, 2);
eq("面板串 mode", pzStr.mode, 1);
eq("面板串 r", pzStr.r, 180);
eq("面板串 pts", pzStr.pts, 8);
var qCount = 0, qk;
for (qk in pzStr) { if (pzStr.hasOwnProperty(qk)) { qCount = qCount + 1; } }
eq("归一化结果字段数 = 12", qCount, 12);

// ---- serializePreset: 越界钳制 ----
var pzClamp = T.serializePreset({ n: 99999, w: -5, gap: -1, baseH: -9, baseRatio: 250, ftype: 9, mode: 7, r: -8, pts: 999 });
eq("n 上限钳制", pzClamp.n, NAME.maxBars);
eq("w 下限钳制", pzClamp.w, 1);
eq("gap 下限钳制", pzClamp.gap, 0);
eq("baseH 下限钳制", pzClamp.baseH, 0);
eq("baseRatio 上限钳制", pzClamp.baseRatio, 99);
eq("ftype 上限钳制", pzClamp.ftype, 3);
eq("mode 上限钳制", pzClamp.mode, 1);
eq("r 下限钳制", pzClamp.r, 0);
eq("pts 上限钳制", pzClamp.pts, NAME.maxPoints);
var pzLow = T.serializePreset({ n: 0, baseRatio: -3, ftype: -2, mode: -1, pts: 0 });
eq("n 下限钳制", pzLow.n, 1);
eq("baseRatio 下限钳制", pzLow.baseRatio, 1);
eq("ftype 下限钳制", pzLow.ftype, 0);
eq("mode 下限钳制", pzLow.mode, 0);
eq("pts 下限钳制", pzLow.pts, 1);
var pzRound = T.serializePreset({ n: 12.6, pts: 3.4, ftype: 1.7 });
eq("n 取整", pzRound.n, 13);
eq("pts 取整", pzRound.pts, 3);
eq("ftype 取整", pzRound.ftype, 2);

// ---- deserializePreset: 对象 / 旧版串 / 空 ----
var dzObj = T.deserializePreset({ n: 8, w: 30, auto: true, pts: 3 });
eq("反序列化对象 n", dzObj.n, 8);
eq("反序列化对象 auto", dzObj.auto, true);
eq("反序列化对象 缺失字段回默认", dzObj.baseRatio, PK.defaults.baseRatio);
eq("反序列化 null -> 默认", T.deserializePreset(null).n, PK.defaults.n);
eq("反序列化空串 -> 默认", T.deserializePreset("").n, PK.defaults.n);
var dzStr = T.deserializePreset("n=8&w=30&auto=true&pts=3&ftype=1");
eq("旧版串 n", dzStr.n, 8);
eq("旧版串 w", dzStr.w, 30);
eq("旧版串 auto", dzStr.auto, true);
eq("旧版串 pts", dzStr.pts, 3);
eq("旧版串 ftype", dzStr.ftype, 1);
eq("旧版串 未提及字段回默认", dzStr.mode, PK.defaults.mode);

// ---- 往返一致 ----
var pFull = T.serializePreset({ n: 64, auto: true, w: 12, gap: 6, baseH: 30, baseRatio: 65, ftype: 3, mode: 1, r: 220, pts: 9 });
var pBack = T.deserializePreset(pFull);
var qSame = true;
for (qk = 0; qk < PK.keys.length; qk++) {
    var qKey = PK.keys[qk];
    if (String(pFull[qKey]) !== String(pBack[qKey])) { qSame = false; }
}
eq("序列化 -> 反序列化 往返一致", qSame, true);

// ---- slotsToJson ----
var emptyCache = { "1": null, "2": null, "3": null, "4": null };
var jsEmpty = T.slotsToJson(emptyCache);
eq("空槽位文件含 version", jsEmpty.indexOf('"version": ' + PK.version) >= 0, true);
eq("空槽位全为 null", (jsEmpty.match(/null/g) || []).length, 4);
eq("空槽位文件是合法 JSON", (function () { try { JSON.parse(jsEmpty); return true; } catch (e) { return false; } })(), true);

var cacheFull = { "1": pFull, "2": null, "3": T.serializePreset({ n: 7, w: 8 }), "4": null };
var jsFull = T.slotsToJson(cacheFull);
eq("有槽位文件是合法 JSON", (function () { try { JSON.parse(jsFull); return true; } catch (e) { return false; } })(), true);
eq("导出文本不含 NaN", jsFull.indexOf("NaN") < 0, true);
eq("导出文本不含 undefined", jsFull.indexOf("undefined") < 0, true);
var jsObj = JSON.parse(jsFull);
eq("JSON 槽位 2 = null", jsObj.slots["2"], null);
eq("JSON 槽位 4 = null", jsObj.slots["4"], null);
eq("JSON 槽位 1 的 n", jsObj.slots["1"].n, 64);
eq("JSON 槽位 1 的 auto 为真布尔", jsObj.slots["1"].auto, true);
eq("JSON 槽位 3 的 w", jsObj.slots["3"].w, 8);
eq("JSON 槽位键为 1-based(无 \"0\")", jsObj.slots["0"] === undefined && jsObj.slots["1"] != null, true);

// ---- jsonParseSlots ----
var rtObj = T.jsonParseSlots(jsFull);
eq("解析回槽位 1 n", rtObj.slots["1"].n, 64);
eq("解析回槽位 1 auto", rtObj.slots["1"].auto, true);
eq("解析回槽位 2 为空", rtObj.slots["2"], null);
eq("解析回槽位 3 w", rtObj.slots["3"].w, 8);
eq("解析回槽位 4 为空", rtObj.slots["4"], null);
eq("解析回版本号", rtObj.version, PK.version);

eq("非 { 开头 -> 全空槽", T.jsonParseSlots("[1,2,3]").slots["1"], null);
eq("空串 -> 全空槽", T.jsonParseSlots("").slots["1"], null);
eq("null -> 全空槽", T.jsonParseSlots(null).slots["1"], null);
eq("坏 JSON -> 全空槽", T.jsonParseSlots("{ 这不是 json ").slots["1"], null);
eq("缺 slots 键 -> 全空槽", T.jsonParseSlots('{"version":1}').slots["1"], null);
eq("坏 JSON 仍返回当前版本号", T.jsonParseSlots("{ 坏 ").version, PK.version);

// 手改 / 外来文件里的脏值必须被钳制
var dirtyTxt = '{"version":1,"slots":{"1":{"n":-99,"w":"abc","baseRatio":500,"auto":"false","pts":9999},"2":null,"3":null,"4":null}}';
var pdDirty = T.jsonParseSlots(dirtyTxt);
eq("脏值 n 钳制", pdDirty.slots["1"].n, 1);
eq("脏值 w 非数字 -> 默认", pdDirty.slots["1"].w, PK.defaults.w);
eq("脏值 baseRatio 钳制", pdDirty.slots["1"].baseRatio, 99);
eq("脏值 auto \"false\" -> false", pdDirty.slots["1"].auto, false);
eq("脏值 pts 钳制", pdDirty.slots["1"].pts, NAME.maxPoints);

// 部分槽位有值、其余 null —— 这是"导入不冲掉现有槽位"的前提
var pdPartial = T.jsonParseSlots('{"version":1,"slots":{"1":null,"2":{"n":5},"3":null,"4":null}}');
eq("部分槽位 1 空", pdPartial.slots["1"], null);
eq("部分槽位 2 有值", pdPartial.slots["2"].n, 5);
eq("部分槽位 3 空", pdPartial.slots["3"], null);
eq("部分槽位 4 空", pdPartial.slots["4"], null);

// ---- 版本与迁移(v0.3.0: r 从【像素】改成【每侧根数】) ----
eq("预设文件版本 = 3", PK.version, 3);
eq("导出文件写当前版本号", jsFull.indexOf('"version": 3') >= 0, true);
eq("r 上限钳制 = MAX_BARS", T.serializePreset({ r: 99999 }).r, NAME.maxBars);
eq("r 不得为负", T.serializePreset({ r: -3 }).r, 0);

// v1 的 r 是像素半径, 与 v2 量纲不通 -> 迁移为"自动"; 其余字段保留
var v1Txt = '{"version":1,"slots":{"1":{"n":10,"w":30,"r":562},"2":null,"3":null,"4":null}}';
var v1Obj = T.jsonParseSlots(v1Txt);
eq("v1 槽位的 r 被重置为自动", v1Obj.slots["1"].r, PK.defaults.r);
eq("v1 槽位其余字段保留 n", v1Obj.slots["1"].n, 10);
eq("v1 槽位其余字段保留 w", v1Obj.slots["1"].w, 30);
eq("v1 文件版本号如实返回", v1Obj.version, 1);
var v2Txt = '{"version":2,"slots":{"1":{"n":10,"r":7},"2":null,"3":null,"4":null}}';
eq("v2 槽位的 r 也被重置(量纲又变了)", T.jsonParseSlots(v2Txt).slots["1"].r, PK.defaults.r);
eq("v2 槽位其余字段保留 n", T.jsonParseSlots(v2Txt).slots["1"].n, 10);
var v3Txt = '{"version":3,"slots":{"1":{"n":10,"r":9},"2":null,"3":null,"4":null}}';
eq("v3 槽位的 r 原样保留", T.jsonParseSlots(v3Txt).slots["1"].r, 9);
eq("无 version 字段时按 v1 处理(重置 r)",
    T.jsonParseSlots('{"slots":{"1":{"r":562},"2":null,"3":null,"4":null}}').slots["1"].r,
    PK.defaults.r);

// ============================================================
// 九、v0.4.0 自审修正(逐条以官方文档 / 真机验证过的做法为依据, 不靠推测)
// ============================================================

// ---- resetSlots: 【就地】清空 4 槽(切换工程时防"上个工程的预设残留") ----
var rc = { "1": { n: 1 }, "2": { n: 2 }, "3": null, "4": { n: 4 }, "extra": 9 };
var rcOut = T.resetSlots(rc);
eq("resetSlots 返回同一对象(就地改, 不换对象)", rcOut === rc, true);
eq("resetSlots 槽1 清空", rc["1"], null);
eq("resetSlots 槽2 清空", rc["2"], null);
eq("resetSlots 槽4 清空", rc["4"], null);
eq("resetSlots 不改动无关 key", rc["extra"], 9);
eq("resetSlots 不新增/删除 key", Object.keys(rc).length, 5);

var freshSlots = T.resetSlots({});
eq("resetSlots 出来的 key 共 4 个", Object.keys(freshSlots).length, 4);
eq("key 全程 1-based: \"1\" 存在", freshSlots["1"], null);
eq("key 全程 1-based: \"4\" 存在", freshSlots["4"], null);
eq("不存在 0-based 的 \"0\" key", freshSlots["0"], undefined);

// jsonParseSlots 的空结果也必须带齐 4 个 1-based key
// (否则 updateSlotLoadBtns 按 SLOT_KEYS[i] 取值为 undefined, 「使用」按钮状态错位)
var jpEmpty = T.jsonParseSlots("");
eq("空输入 -> 槽1 key 存在", jpEmpty.slots["1"], null);
eq("空输入 -> 槽4 key 存在", jpEmpty.slots["4"], null);
eq("空输入 -> 无 \"0\" key", jpEmpty.slots["0"], undefined);
eq("空输入 -> 槽位 key 共 4 个", Object.keys(jpEmpty.slots).length, 4);
eq("坏 JSON -> 槽位 key 共 4 个", Object.keys(T.jsonParseSlots("{ 坏 ").slots).length, 4);
eq("非本插件文件(首字符非 {) -> 槽位 key 共 4 个",
    Object.keys(T.jsonParseSlots("hello").slots).length, 4);

// ---- pickBaseY: 形状图层实际 Y 优先于面板「基线 %合成高」 ----
near("有图层 Y -> 用图层 Y", T.pickBaseY(700, 1080, 80), 700, 1e-12);
eq("图层 Y = 0 时仍以图层为准(不因 falsy 回退)", T.pickBaseY(0, 1080, 80), 0);
near("拿不到图层(null) -> 回退面板 %", T.pickBaseY(null, 1080, 80), 864, 1e-12);
near("拿不到图层(undefined) -> 回退面板 %", T.pickBaseY(undefined, 1000, 30), 300, 1e-12);
near("拿不到图层(NaN) -> 回退面板 %", T.pickBaseY(NaN, 1080, 50), 540, 1e-12);
near("回退时面板值越界要钳到 99", T.pickBaseY(null, 1000, 500), 990, 1e-12);
near("回退时面板值越界要钳到 1", T.pickBaseY(null, 1000, -20), 10, 1e-12);
eq("图层 Y 与面板值不一致时以图层为准(本次修复的要害)",
    T.pickBaseY(400, 1080, 80), 400);

// ---- 源码级体检: 把"上游 API 用法"钉死, 防止再退回未经证实的写法 ----
// ① 文件对话框起始目录 —— 官方文档: File.saveDialog(prompt[, preset]) 无目录参数;
//    只有 File 实例方法 saveDlg()/openDlg() 会 "presets the current folder to this
//    File object's parent folder"。
eq("① 导出用 File 实例方法 saveDlg", src.indexOf("pf.saveDlg(") >= 0, true);
eq("① 导入用 File 实例方法 openDlg", src.indexOf("pf.openDlg(") >= 0, true);
eq("① 保留类方法回退(工程尚未保存时)",
    src.indexOf("return File.saveDialog(prompt, DIALOG_FILTER);") >= 0, true);
eq("① 保留类方法回退(导入)",
    src.indexOf("return File.openDialog(prompt, DIALOG_FILTER);") >= 0, true);
eq("① 不再给 saveDialog 传第 3 个参数(未文档化)",
    /File\.saveDialog\([^)]*,[^)]*,[^)]*\)/.test(src), false);
eq("① 不再给 openDialog 传第 3 个参数(未文档化)",
    /File\.openDialog\([^)]*,[^)]*,[^)]*\)/.test(src), false);

// ② pinW —— 官方文档: "A preferredSize of -1 causes the size to be calculated automatically."
//    Adobe 官方社区(Marc Autret, 采纳答案): preferredSize 首次布局后丢失, 要靠 minimumSize。
eq("② pinW 宽度钉死、高度传 -1(自动)",
    src.indexOf("ctrl.preferredSize = [w, -1];") >= 0, true);
eq("② pinW 同时写 minimumSize(持久生效)", src.indexOf("ctrl.minimumSize = [w, 0];") >= 0, true);
eq("② pinW 同时写 maximumSize(持久生效)", src.indexOf("ctrl.maximumSize = [w, 10000];") >= 0, true);
eq("② 不再读回 preferredSize.height 当新高度(会把高度钉成 0)",
    /ctrl\.preferredSize = \[w, ctrl\.preferredSize\.height\]/.test(src), false);
eq("② 不再读回 minimumSize.height", /ctrl\.minimumSize = \[w, ctrl\.minimumSize\.height\]/.test(src), false);

// ③ 随机数 —— 官方文档: generateRandomNumber() "is recommended instead of Math.random() for
//    generating random numbers that will be applied as values in a project (e.g., when using
//    setValue)"。
eq("③ 优先用 generateRandomNumber", src.indexOf('typeof generateRandomNumber === "function"') >= 0, true);
eq("③ Math.random 仅作老版本回退", src.indexOf("return Math.random();") >= 0, true);
eq("③ 不再直接用它算要 setValue 的值", src.indexOf("* Math.random()") < 0, true);

// ④⑤⑥⑦⑧
eq("④ resetSlots 已定义", src.indexOf("function resetSlots(cache)") >= 0, true);
eq("④ 切换工程/清空全部都走 resetSlots(presetsCache)", src.indexOf("resetSlots(presetsCache);") >= 0, true);
eq("④ 缓存初始化也用 resetSlots", src.indexOf("var presetsCache = resetSlots({});") >= 0, true);
eq("⑤ 「重设点位」用【实际柱数】算行宽", src.indexOf("rowWidth(N, p.w, p.gap)") >= 0, true);
eq("⑤ 不再用面板数量算出的 p.rowW 排点位", src.indexOf("pointXAt(k3, p.m, p.rowW") < 0, true);
eq("⑥ 基线经 pickBaseY(实际图层位置优先)",
    src.indexOf("return pickBaseY(barsY, comp.height, ratio);") >= 0, true);
eq("⑥ randomPeaks 也用实际基线", src.indexOf("var baseY = currentBaseY(comp, U);") >= 0, true);
eq("⑦ 导入写盘失败要如实提示", src.indexOf("仅本次会话有效") >= 0, true);
eq("⑧ rewriteBarExpr 逐组保护(不因一个坏组整轮崩)",
    src.indexOf("跳过这一组") >= 0, true);

// 表达式「保守语法」体检(仓库真机坑: 表达式引擎只吃 ECMA-262 3rd 的子集)
// ⚠️ 正则必须同时抓住 `var a, b;` 与 `var a = 1, b = 2;` 两种多变量声明。
//    但【不能】被数组/字符串里的逗号误伤 —— 故用 [^;\[\n]* 限定"到下一个逗号前
//    不得出现分号或左方括号", 这样 `var outPos = [(i-..)*.., -h/2];` 不会误报。
//    (此正则经反向对照验证: 喂入 `var sum = 0, mx = 0, k;` 必须命中)
var MULTIVAR_RE = /var\s+[A-Za-z_$][\w$]*(\s*=[^;\[\n]*)?,/;
var exAudit = T.buildExprCore(0, 2, 1);
eq("多变量声明检测器本身有效(反向对照)",
    MULTIVAR_RE.test("  var sum = 0, mx = 0, k;"), true);
eq("多变量声明检测器不误伤数组逗号(反向对照)",
    MULTIVAR_RE.test("var outPos = [(i - (N - 1) / 2) * (W + G), -h / 2];"), false);
eq("表达式不含多变量声明 var a, b", MULTIVAR_RE.test(exAudit), false);
eq("表达式不含多变量声明 var a = 1, b = 2",
    MULTIVAR_RE.test(T.buildSizeExpr(0, 2, 1)), false);
eq("表达式不含 ++", exAudit.indexOf("++") < 0, true);
eq("表达式不含 +=", exAudit.indexOf("+=") < 0, true);
eq("表达式不含 continue", exAudit.indexOf("continue") < 0, true);
eq("表达式不含对象字面量", exAudit.indexOf("{ f:") < 0 && exAudit.indexOf("{f:") < 0, true);
eq("表达式不含 IIFE(靠最后一句裸变量返回)",
    T.buildSizeExpr(0, 2, 1).indexOf("(function") < 0, true);
eq("大小表达式以 outSize 收尾", /\noutSize;\n$/.test(T.buildSizeExpr(0, 2, 1)), true);
eq("位置表达式以 outPos 收尾", /\noutPos;\n$/.test(T.buildPosExpr(0, 2, 1)), true);

// ============================================================
// 十、v0.4.1: 点位「高度」控制 + 「实际可见根数」回报
// ============================================================

// ---- 高度(hExplicit): 0/负数 = 自动(基线-点位Y); >0 = 直接覆盖峰高 ----
var rAuto = T.resolvePoints([{ x: 0, y: BASE - 300, r: 2 }], PITCH, 100);
near("高度缺省 -> 峰高 = 基线-点位Y", T.pointContribution(0, 0, BASE - 300, BASE, rAuto[0].r, 0), 300, 1e-12);
near("高度=0 -> 同上(自动)", T.pointContribution(0, 0, BASE - 300, BASE, rAuto[0].r, 0, 0), 300, 1e-12);
near("高度=500 -> 峰高被覆盖为 500", T.pointContribution(0, 0, BASE - 300, BASE, rAuto[0].r, 0, 500), 500, 1e-12);
near("高度负数 -> 视作自动", T.pointContribution(0, 0, BASE - 300, BASE, rAuto[0].r, 0, -80), 300, 1e-12);
near("点在基线下 + 高度=0 -> 无贡献", T.pointContribution(0, 0, BASE + 100, BASE, 100, 0, 0), 0, 1e-12);
near("点在基线下 + 高度=400 -> 仍按高度生效", T.pointContribution(0, 0, BASE + 100, BASE, 100, 0, 400), 400, 1e-12);
// 高度只改幅度, 不改窗口范围: 刚出窗口处恒为 0(无论峰高多少)
near("高度只改幅度: 刚出窗口处恒为 0", T.pointContribution(100.5, 0, BASE + 999, BASE, 100, 0, 200), 0, 1e-12);
near("高度只改幅度: 窗口边界处 = 高度 × 边缘高度%",
    T.pointContribution(100, 0, BASE + 999, BASE, 100, 0, 200), 200 * EDGE, 1e-9);
near("高度线性缩放整条曲线", T.pointContribution(30, 0, BASE + 999, BASE, 100, 0, 400),
    2 * T.pointContribution(30, 0, BASE + 999, BASE, 100, 0, 200), 1e-12);
eq("resolvePoints 透传 h", T.resolvePoints([{ x: 1, y: 2, r: 3, h: 456 }], PITCH, 100)[0].h, 456);
eq("resolvePoints 无 h 时为 undefined", T.resolvePoints([{ x: 1, y: 2, r: 3 }], PITCH, 100)[0].h, undefined);

// ---- 表达式真的会读「高度」滑块(eval 实测, 与纯函数比对) ----
var ptsNoH = [{ x: layerPos[0], y: layerPos[1] - 50, r: 0 }];
var tcNoH = mkThisComp(layerPos, fxOnly2, ptsNoH);
var szNoH = evalExpr(T.buildSizeExpr(0, 1, 1), tcNoH, layerPos, NAME.outSize);
near("表达式(无高度滑块) 峰高 = 50", szNoH[1], 50, 1e-9);

var ptsWithH = [{ x: layerPos[0], y: layerPos[1] - 50, r: 0, h: 500 }];
var tcWithH = mkThisComp(layerPos, fxOnly2, ptsWithH);
var szWithH = evalExpr(T.buildSizeExpr(0, 1, 1), tcWithH, layerPos, NAME.outSize);
near("表达式(高度=500) 峰高被覆盖为 500", szWithH[1], 500, 1e-9);
near("表达式与纯函数一致(高度路径)",
    szWithH[1],
    T.barHeightAt(layerPos[0], T.resolvePoints(ptsWithH, WW + GG, 100), layerPos[1], 0, BASEC, 0), 1e-9);
eq("高度让同一个点位从 50 变成 500", szWithH[1] > szNoH[1] * 9, true);

// ---- countVisibleBars: "看得见"的根数(贡献 > 基础高度) ----
// 21 根(奇数, 有柱子正对点位) + 影响范围 9 -> 窗口内 9 根; 用高度直接指定峰高
// ⚠️ countVisibleBars 收的 points[].r 是【根数】(内部换算), 不要再自己 resolvePoints
function mkPts9(h) { return [{ x: 0, y: BASE + 999, r: 9, h: h }]; }
function vis9(h, baseH) { return T.countVisibleBars(21, WW, GG, 0, BASE, mkPts9(h), 0, baseH, 0, 100); }
eq("baseH=0 -> 有贡献的根数 = 9(点位正对柱子)", vis9(238, 0), 9);
// ⭐ v0.4.1 的核心契约: 窗口内每一根都可见 ⇒ 可见根数 = 窗口根数
eq("⭐ 可见根数 = 窗口根数(基础高度不再吃掉边缘)", vis9(238, 40), 9);
eq("可见根数与基础高度无关(默认量级内)", vis9(238, 40), vis9(238, 0));
// 对照 v0.4.0 之前: 同一场景只有 7 根可见(尾部被钳平) —— 用户报的"最多影响 7 个"
eq("对照 v0.4.0 前只有 7 根可见", vis9(238, 40) > 7, true);
eq("高度加倍可见根数不变(已经全可见)", vis9(4000, 40), 9);
eq("高度不影响窗口根数上限", vis9(99999, 40), 9);
eq("空点位 -> 0 根", T.countVisibleBars(21, WW, GG, 0, BASE, [], 0, 0, 0, 100), 0);

// ⭐ 反查表连续性(用户三轮都调不出来的根因): 填值 -> 可见根数 必须连续、不跳号
//   21 根(奇数)行上: 填 m -> 可见 m(m 奇) 或 m+1(m 偶)
function visM(m) {
    return T.countVisibleBars(21, WW, GG, 0, BASE,
        [{ x: 0, y: BASE + 999, r: m, h: 238 }], 0, BASEC, 0, 100);
}
eq("填值 1 -> 可见 1", visM(1), 1);
eq("填值 3 -> 可见 3", visM(3), 3);
eq("填值 7 -> 可见 7", visM(7), 7);
eq("填值 9 -> 可见 9(用户要的就是这个)", visM(9), 9);
eq("填值 11 -> 可见 11", visM(11), 11);
eq("填值 13 -> 可见 13", visM(13), 13);
eq("填值 15 -> 可见 15", visM(15), 15);
eq("填值 17 -> 可见 17", visM(17), 17);
eq("填值 19 -> 可见 19", visM(19), 19);
eq("可见根数与填值【同奇偶地】连续: 填奇数 -> 可见 = 填值", (function () {
    var m;
    for (m = 1; m <= 21; m += 2) { if (visM(m) !== m) { return false; } }
    return true;
})(), true);
eq("每个奇数根数都取得到(用户要 9 就能给 9)", (function () {
    var seen = {}, m;
    for (m = 1; m <= 21; m++) { seen[visM(m)] = 1; }
    for (m = 1; m <= 21; m += 2) { if (!seen[m]) { return false; } }
    return true;
})(), true);
// 点位正对柱子时只能取到奇数根 —— 奇偶性由"是否有柱子正对"决定, 这是几何事实
eq("点位正对柱子: 填 2 -> 可见 3(取不到 2)", visM(2), 3);
eq("可见根数随填值单调不减", (function () {
    var prev = -1, m, v;
    for (m = 1; m <= 21; m++) { v = visM(m); if (v < prev) { return false; } prev = v; }
    return true;
})(), true);

// ---- 用户真实几何(40 根 + 2 个点位 -> 点位不落在柱网正中) ----
// ⭐ kNN 半径的核心收益: 【填几根就恰好几根】, 不再随行根数奇偶漂成 m/m+1
var uPts = function (m) { return [{ x: 622.5, y: 864 - 237.6, r: m }]; };
var uHit = function (m, baseH) {
    return T.countVisibleBars(40, 24, 10, 960, 864, uPts(m), 0, baseH, 0, 100);
};
eq("用户几何: 填 9 -> 恰好 9 根(旧行为是 8 根)", uHit(9, 40), 9);
eq("⭐ 用户几何: 可见 = 有贡献(基础高度不再吞掉边缘)", uHit(9, 40), uHit(9, 0));
eq("用户几何: 可见根数与基础高度无关", uHit(9, 40), uHit(9, 0));
eq("用户几何: 填 1 -> 1 根", uHit(1, 40), 1);
eq("用户几何: 填 3 -> 3 根", uHit(3, 40), 3);
eq("用户几何: 填 7 -> 7 根", uHit(7, 40), 7);
eq("用户几何: 填 11 -> 11 根", uHit(11, 40), 11);
eq("用户几何: 填 15 -> 15 根", uHit(15, 40), 15);
eq("⭐ 用户几何: 1..21 每一档都恰好(无一例外)", (function () {
    var m;
    for (m = 1; m <= 21; m++) { if (uHit(m, 40) !== m) { return false; } }
    return true;
})(), true);

// ---- ⭐ 「边缘高度%」这个新参数对可见根数的影响(用户要的可控参数) ----
var uHitE = function (m, edgePct) {
    return T.countVisibleBars(40, 24, 10, 960, 864,
        [{ x: 622.5, y: 864 - 237.6, r: m }], 0, 40, 0, 100, edgePct);
};
eq("边缘高度 30%(默认): 填 9 -> 可见 9 根", uHitE(9, 30), 9);
eq("边缘高度 100%(矩形窗): 填 9 -> 可见 9 根", uHitE(9, 100), 9);
eq("边缘高度 0%(纯 von Hann): 边缘归零 -> 可见明显变少", uHitE(9, 0) < 9, true);
// v0.9.0 起衰减作用在地板之上: e=0 时只有恰好 t=1 那根等于地板(不可见),
//   其余都会高过地板 -> 9 根窗口里 8 根可见(旧公式下只有 6 根)。
eq("边缘高度 0% 时可见 8 根(仅 t=1 那根恰好落在地板上)", uHitE(9, 0), 8);
eq("边缘高度越高可见根数不减", uHitE(9, 60) >= uHitE(9, 0), true);
eq("边缘高度 100% 窗口内每一根都 ≥ 峰高(全平)", (function () {
    var pts = [{ x: 622.5, y: 864 - 237.6, r: 9 }];
    var i, h;
    for (i = 0; i < 40; i++) {
        h = T.barHeightOfIndex(i, 40, 24, 10, 960, 864, pts, 0, 0, 0, 100, 100);
        if (h > 0 && Math.abs(h - 237.6) > 1e-6) { return false; }
    }
    return true;
})(), true);

// ---- 源码/生成表达式体检 ----
eq("① 每个点位加「高度」滑块", src.indexOf("addSlider(P, SL_H, ") >= 0, true);
eq("① 点位高度用面板值初始化",
    src.indexOf("makePoint(comp, k, p.m, p.rowW, centerX, baseY, peak, p.r, p.ph, p.w + p.gap);") >= 0, true);
// v0.6.1: 两个新参数都必须【在面板上】且【改完立即生效】
eq("⭐ 面板有「点位高度」输入框", src.indexOf("U.edPH = numBox(") >= 0, true);
eq("⭐ 面板有「边缘高度%」输入框", src.indexOf("U.edEdge = numBox(") >= 0, true);
eq("⭐ 点位高度 onChange 立即推送", src.indexOf("U.edPH.onChange = function ()") >= 0, true);
eq("⭐ 边缘高度 onChange 立即推送", src.indexOf("U.edEdge.onChange = function ()") >= 0, true);
eq("推送函数 pushPointHeight 存在", src.indexOf("function pushPointHeight(pal, U)") >= 0, true);
eq("推送函数 pushEdgeToController 存在", src.indexOf("function pushEdgeToController(pal, U)") >= 0, true);
eq("老工程缺「边缘高度%」滑块时自动补建", src.indexOf("addSlider(ctrl, SL_EDGE, v);") >= 0, true);
eq("生成时用面板值初始化控制器边缘高度", src.indexOf("addSlider(ctrl, SL_EDGE, p.edge);") >= 0, true);
eq("「重设点位」也推点位高度", src.indexOf("setSlider(LP, SL_H, p.ph);") >= 0, true);
eq("预设收集含 ph", src.indexOf("ph: U.edPH.text,") >= 0, true);
eq("预设收集含 edge", src.indexOf("edge: U.edEdge.text") >= 0, true);
eq("预设回填含 ph", src.indexOf("U.edPH.text = String(p.ph);") >= 0, true);
eq("预设回填含 edge", src.indexOf("U.edEdge.text = String(p.edge);") >= 0, true);
eq("① 高度滑块默认 0(向后兼容)", NAME.hDef, 0);
var exVH = T.buildSizeExpr(0, 2, 1);
eq("① 生成的表达式读「高度」滑块", exVH.indexOf('hh = P.effect("' + NAME.h + '")') >= 0, true);
eq("① 生成的表达式按高度覆盖峰高", exVH.indexOf("if (hh > 0) { pk = hh; }") >= 0, true);
eq("① 高度读取有 try 回退(旧工程没这个滑块)", exVH.indexOf("catch (e4) { hh = 0; }") >= 0, true);
eq("② 状态栏回报「实际可见」根数", src.indexOf("实际可见 ") >= 0, true);
eq("② 生成/重设点位/改影响范围 三处都回报",
    (src.match(/visibleCountHint\(/g) || []).length >= 4, true);
eq("③ 半径走 kNN(第 m 近柱子的实际距离)", src.indexOf("if (R % 2 > 0.5) { kk = (R - 1) / 2 + fr; }") >= 0, true);
eq("③ 上一版 m/2 公式已清除", src.indexOf("R = R / 2 * pitch * rsc / 100;") < 0, true);
eq("③ 上一版 (m+1)/2 公式已清除", src.indexOf("R = (R + 1) / 2 * pitch * rsc / 100;") < 0, true);
eq("④ 半径零/负钳到 1 根", src.indexOf("if (R < 1) R = 1;") >= 0, true);
// ⑤ 衰减窗口压缩(让"窗口内每一根都看得见")
eq("⑤ 表达式读「边缘高度%」滑块",
    exVH.indexOf('edge = c.effect("' + NAME.edge + '")(1)') >= 0, true);
eq("⑤ 边缘高度缺失时回退默认", exVH.indexOf("catch (e5) { edge = " + NAME.edgeDef + "; }") >= 0, true);
eq("⑤ 边缘高度越界钳制", exVH.indexOf("if (edge > 100) { edge = 100; }") >= 0, true);
eq("⑤ 边缘高度折成 0..1 系数", exVH.indexOf("edge = edge / 100;") >= 0, true);
eq("⑤ 曲线与边缘系数复合(w = e + (1-e)f)",
    exVH.indexOf("f = edge + (1 - edge) * f;") >= 0, true);
eq("⑤ 复合发生在曲线分支之后、乘法之前",
    exVH.indexOf("f = (1 - t) * (1 - t);") < exVH.indexOf("f = edge + (1 - edge) * f;"), true);
eq("⑤ 旧写死的 t 压缩已清除", exVH.indexOf("t = t * ") < 0, true);
eq("⑤ 纯函数同样: 刚出窗口为 0",
    T.pointContribution(100.5, 0, 700, BASE, 100, 0), 0);
// 滑块取值直接改变边缘高度(纯函数侧)
near("边缘高度 0% -> 窗口边界归零(纯 Hann)",
    T.pointContribution(100, 0, 700, BASE, 100, 0, 0, 0), 0, 1e-12);
near("边缘高度 100% -> 窗口内全平(矩形窗)",
    T.pointContribution(100, 0, 700, BASE, 100, 0, 0, 100), 300, 1e-12);
near("边缘高度 60% -> 窗口边界 = 60% 峰高",
    T.pointContribution(100, 0, 700, BASE, 100, 0, 0, 60), 180, 1e-12);
near("边缘高度 100% -> 窗口正中也是满高",
    T.pointContribution(0, 0, 700, BASE, 100, 0, 0, 100), 300, 1e-12);

// ============================================================
// 十、总闸「山峰 高度」(v0.7.0)
//   语义: 拖这个空对象 -> 整排等比缩放到"最高那根 = 它离基线的高度"。
//   它不存在 -> hGate=0, 完全回到旧行为(向后兼容)。
// ============================================================
var HB = 864;                              // 基线 Y(= 形状图层 Y)
var gp = [
    { x: 943,  y: HB - 300, r: 9 },        // 固有峰高 300
    { x: 1147, y: HB - 150, r: 9 },        // 固有峰高 150
    { x: 1351, y: HB - 450, r: 9 }         // 固有峰高 450  <- 最高
];
var gpLeft = 960 - (40 - 1) / 2 * 34;

// ---- intrinsicPeak: 固有峰高 ----
near("固有峰高: 自动(基线-点位Y)", T.intrinsicPeak(gp[0], HB), 300, 1e-12);
near("固有峰高: 滑块 400 覆盖位置", T.intrinsicPeak({ x: 0, y: HB - 300, r: 9, h: 400 }, HB), 400, 1e-12);
near("固有峰高: 滑块 0 -> 自动", T.intrinsicPeak({ x: 0, y: HB - 300, r: 9, h: 0 }, HB), 300, 1e-12);
near("固有峰高: 滑块负 -> 自动", T.intrinsicPeak({ x: 0, y: HB - 300, r: 9, h: -80 }, HB), 300, 1e-12);
near("固有峰高: 滑块缺失 -> 自动", T.intrinsicPeak({ x: 0, y: HB - 300, r: 9 }, HB), 300, 1e-12);
near("固有峰高: 点在基线上 -> 0", T.intrinsicPeak({ x: 0, y: HB, r: 9 }, HB), 0, 1e-12);
near("固有峰高: 点在基线下 -> 0(不给负值)", T.intrinsicPeak({ x: 0, y: HB + 100, r: 9 }, HB), 0, 1e-12);
near("固有峰高: 点在基线下但滑块 400 -> 400", T.intrinsicPeak({ x: 0, y: HB + 100, r: 9, h: 400 }, HB), 400, 1e-12);

// ---- peakScaleOf: 缩放系数 ----
near("缩放: hMax = 最高固有峰高 -> 1", T.peakScaleOf(gp, HB, 450), 1, 1e-12);
near("缩放: hMax 翻倍 -> 2", T.peakScaleOf(gp, HB, 900), 2, 1e-12);
near("缩放: hMax 减半 -> 0.5", T.peakScaleOf(gp, HB, 225), 0.5, 1e-12);
near("缩放: hMax = 0 -> 0(整排压平, 是合法结果)", T.peakScaleOf(gp, HB, 0), 0, 1e-12);
near("缩放: hMax < 0 -> 钳到 0", T.peakScaleOf(gp, HB, -50), 0, 1e-12);
// ⚠️ "未启用" 与 "hMax=0" 必须区分开 —— 前者 1(原样), 后者 0(压平)
near("缩放: hMax = null -> 1(未启用)", T.peakScaleOf(gp, HB, null), 1, 1e-12);
near("缩放: hMax 未给 -> 1(未启用)", T.peakScaleOf(gp, HB), 1, 1e-12);
near("缩放: hMax = NaN -> 1(未启用)", T.peakScaleOf(gp, HB, NaN), 1, 1e-12);
near("缩放: 没有有效峰(pmax=0) -> 1(不 NaN)", T.peakScaleOf([{ x: 0, y: HB + 100, r: 9 }], HB, 500), 1, 1e-12);
near("缩放: 空点位列表 -> 1", T.peakScaleOf([], HB, 500), 1, 1e-12);
near("缩放: 单点 -> hMax / 该点峰高", T.peakScaleOf([gp[0]], HB, 600), 2, 1e-12);
near("缩放: 单点 = hMax -> 1", T.peakScaleOf([gp[0]], HB, 300), 1, 1e-12);

// ---- resolvePoints: 未启用时逐字段保持原样 ----
var rpOff = T.resolvePoints(gp, 34, 100, gpLeft);
eq("未启用: 点位数量不变", rpOff.length, 3);
near("未启用: y 原样 #1", rpOff[0].y, gp[0].y, 1e-12);
near("未启用: y 原样 #3", rpOff[2].y, gp[2].y, 1e-12);
eq("未启用: h 原样(undefined 仍是 undefined)", rpOff[0].h, gp[0].h);
eq("未启用: 传 null 也不改", T.resolvePoints(gp, 34, 100, gpLeft, HB, null)[0].y, gp[0].y);

// ---- resolvePoints: 启用时把"归一化峰高"编码进 y, h 置 -1 ----
var rpOn = T.resolvePoints(gp, 34, 100, gpLeft, HB, 900);   // 缩放 2 倍
near("启用(2x): 峰高 300 -> 600", HB - rpOn[0].y, 600, 1e-9);
near("启用(2x): 峰高 150 -> 300", HB - rpOn[1].y, 300, 1e-9);
near("启用(2x): 峰高 450 -> 900", HB - rpOn[2].y, 900, 1e-9);
eq("启用: h 置 -1(让 pointContribution 走自动分支)", rpOn[0].h, -1);
eq("启用: 不改 x", rpOn[0].x, gp[0].x);
near("启用: 半径不受归一化影响", rpOn[0].r,
    T.influenceRadiusPx(9, 34, 100, T.barPhase(gp[0].x, gpLeft, 34)), 1e-12);
var rpHalf = T.resolvePoints(gp, 34, 100, gpLeft, HB, 225);
near("启用(0.5x): 峰高 450 -> 225", HB - rpHalf[2].y, 225, 1e-9);
var rpZero = T.resolvePoints(gp, 34, 100, gpLeft, HB, 0);
near("启用(0x): 所有 y = 基线 -> 无峰", rpZero[0].y, HB, 1e-9);
near("启用(0x): 逐根贡献为 0",
    T.barHeightAt(943, rpZero, HB, 0, 0, 0), 0, 1e-12);

// ---- 端到端: 单点场景, 峰顶 = hMax(用户最关心的用法) ----
function gTop(pts, hMax, mode) {
    var m = 0, i, h;
    for (i = 0; i < 40; i++) {
        h = T.barHeightOfIndex(i, 40, 24, 10, 960, HB, pts, mode || 0, 0, 0, 100, NAME.edgeDef, hMax);
        if (h > m) { m = h; }
    }
    return m;
}
var gOne = [{ x: 943, y: HB - 300, r: 9 }];
near("端到端: 单点 hMax=150 -> 峰顶 150", gTop(gOne, 150), 150, 1e-6);
near("端到端: 单点 hMax=600 -> 峰顶 600", gTop(gOne, 600), 600, 1e-6);
near("端到端: 单点 hMax=1200 -> 峰顶 1200", gTop(gOne, 1200), 1200, 1e-6);
near("端到端: 单点 hMax=300 与未启用完全一致", gTop(gOne, 300), gTop(gOne, null), 1e-6);

// ---- 端到端: 多点等比(相对高矮保留) ----
// 用 resolvePoints 的输出直接验证各峰的归一化峰高 —— 比"读某根柱子"更准确:
//   多点窗口会重叠, 重叠处的柱子高度受叠加影响, 不等于该峰的峰高。
var rpE = T.resolvePoints(gp, 34, 100, gpLeft, HB, 900);   // 缩放 2x
near("端到端: 多点 2x 后 #1 峰高 600", HB - rpE[0].y, 600, 1e-9);
near("端到端: 多点 2x 后 #2 峰高 300", HB - rpE[1].y, 300, 1e-9);
near("端到端: 多点 2x 后 #3 峰高 900 = hMax", HB - rpE[2].y, 900, 1e-9);
eq("端到端: 最高的那根恰好 = hMax", Math.abs((HB - rpE[2].y) - 900) < 1e-9, true);
// 相对比例 = 固有比例 × 缩放(300:150:450 与 600:300:900 同比)
near("端到端: 相对比例保留(#1/#3 恒定)",
    (HB - rpE[0].y) / (HB - rpE[2].y), 300 / 450, 1e-12);
near("端到端: 缩放系数 = hMax / 最高固有峰高", T.peakScaleOf(gp, HB, 900), 2, 1e-12);
eq("端到端: 未启用时最高的那根 = 固有峰高 450",
    Math.abs((HB - T.resolvePoints(gp, 34, 100, gpLeft)[2].y) - 450) < 1e-9, true);
// ⚠️ 边界(必须如实说): 叠加模式下重叠处的柱子会【超过】hMax ——
//    "最高高度" 约束的是【最高的那个峰】, 不是"全场最高的柱子"。
eq("边界: 叠加模式重叠处会超过 hMax(两峰各 300 相距 102 -> 464)",
    gTop([{ x: 943, y: HB - 300, r: 9 }, { x: 1045, y: HB - 300, r: 9 }], 300) > 300, true);
eq("边界: 取最高模式则恰好 = hMax",
    Math.abs(gTop([{ x: 943, y: HB - 300, r: 9 }, { x: 1045, y: HB - 300, r: 9 }], 300, 1) - 300) < 1e-6, true);

// ---- 兼容性: 传 null 与旧调用逐根一致 ----
eq("兼容: 传 null 逐根等于旧调用", (function () {
    var i, a, b;
    for (i = 0; i < 40; i++) {
        a = T.barHeightOfIndex(i, 40, 24, 10, 960, HB, gp, 0, 40, 0, 100, NAME.edgeDef, null);
        b = T.barHeightOfIndex(i, 40, 24, 10, 960, HB, gp, 0, 40, 0, 100, NAME.edgeDef);
        if (Math.abs(a - b) > 1e-12) { return false; }
    }
    return true;
})(), true);
eq("兼容: 未启用时 countVisibleBars 逐点一致",
    T.countVisibleBars(40, 24, 10, 960, HB, gp, 0, 40, 0, 100, NAME.edgeDef, null),
    T.countVisibleBars(40, 24, 10, 960, HB, gp, 0, 40, 0, 100, NAME.edgeDef));

// ---- 表达式文本体检 ----
var exG = T.buildSizeExpr(0, 40, 3);
eq("表达式: 查找总闸图层", exG.indexOf('thisComp.layer("' + NAME.hgt + '")') >= 0, true);
eq("表达式: hGate 初值 0(向后兼容)", exG.indexOf("var hGate = 0;") >= 0, true);
eq("表达式: 有总闸分支", exG.indexOf("if (HL) {") >= 0, true);
eq("表达式: hMax = 基线 - 高度点Y",
    exG.indexOf("hMax = transform.position[1] - HL.transform.position[1];") >= 0, true);
eq("表达式: hMax 负数钳到 0", exG.indexOf("if (hMax < 0) { hMax = 0; }") >= 0, true);
eq("表达式: 有 pmax 扫描循环", exG.indexOf("for (k2 = 1; k2 <= M; k2 = k2 + 1) {") >= 0, true);
eq("表达式: 缩放系数 = hMax/pmax", exG.indexOf("if (pmax > 0) { hsc = hMax / pmax; }") >= 0, true);
eq("表达式: 主循环里应用缩放", exG.indexOf("if (hGate > 0) { pk = pk * hsc; }") >= 0, true);
eq("表达式: 扫描在应用之前",
    exG.indexOf("if (pmax > 0) { hsc = hMax / pmax; }") < exG.indexOf("if (hGate > 0) { pk = pk * hsc; }"), true);
eq("表达式: 总闸缺失时的 catch 设 HL = null",
    exG.indexOf("catch (e6) { HL = null; }") >= 0, true);
// 保守语法(仓库真机坑: 表达式引擎只吃 ECMA-262 3rd 的子集)
eq("表达式: 无多变量声明", /var\s+[A-Za-z_$][\w$]*(\s*=[^;\[\n]*)?,/.test(exG), false);
eq("表达式: 无 ++", exG.indexOf("++") < 0, true);
eq("表达式: 无 +=", exG.indexOf("+=") < 0, true);
eq("表达式: 无 continue", exG.indexOf("continue") < 0, true);
eq("表达式: 无对象字面量", exG.indexOf("{ f:") < 0 && exG.indexOf("{f:") < 0, true);
eq("表达式: 无单行注释", exG.indexOf("//") < 0, true);
// 新增变量名不与既有变量撞车
eq("表达式: 新增变量名单次声明", (function () {
    var names = ["hGate", "hMax", "hsc", "pmax", "HL", "P2", "pk2", "hh2", "k2"], i, re;
    for (i = 0; i < names.length; i++) {
        re = new RegExp("var " + names[i] + " ", "g");
        if ((exG.match(re) || []).length !== 1) { return names[i] + " 声明次数不为 1"; }
    }
    return "ok";
})(), "ok");
eq("表达式: 不与主循环的 mx/k/P/pk 撞名",
    /var\s+mx\s*=/.test(exG) && /var\s+pmax\s*=/.test(exG) && /var\s+P2\s*=/.test(exG), true);

// ---- 表达式等价性: eval 真表达式 + mock 高度层, 与纯函数逐根比对 ----
var gFx = {};
gFx[NAME.w] = 24; gFx[NAME.g] = 10; gFx[NAME.base] = BASEC;
gFx[NAME.mode] = 0; gFx[NAME.ftype] = 0;
gFx[NAME.rscale] = 100; gFx[NAME.edge] = NAME.edgeDef;
var gLayerPos = [960, HB];
eq("表达式等价: 总闸启用时逐根与纯函数一致(3 组 hMax)", (function () {
    var hs3 = [200, 900, 1500], c, i, e, p, bad = "";
    for (c = 0; c < hs3.length; c++) {
        var hgtY = HB - hs3[c];                       // hMax = HB - hgtY
        var tcG = mkThisComp(gLayerPos, gFx, gp, hgtY);
        for (i = 0; i < 40; i++) {
            e = evalExpr(T.buildSizeExpr(i, 40, 3), tcG, gLayerPos, NAME.outSize);
            p = T.barHeightOfIndex(i, 40, 24, 10, 960, HB, gp, 0, BASEC, 0, 100, NAME.edgeDef, hs3[c]);
            if (Math.abs(e[1] - p) > 1e-6) {
                bad = "hMax=" + hs3[c] + " i=" + i + " expr=" + e[1] + " pure=" + p;
                break;
            }
        }
        if (bad) { break; }
    }
    return bad || "ok";
})(), "ok");
eq("表达式等价: 高度层不存在时与未启用一致", (function () {
    var tcNoH = mkThisComp(gLayerPos, gFx, gp);       // 不传 hgtY -> 图层"不存在"
    var i, e, p;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 3), tcNoH, gLayerPos, NAME.outSize);
        p = T.barHeightOfIndex(i, 40, 24, 10, 960, HB, gp, 0, BASEC, 0, 100, NAME.edgeDef, null);
        if (Math.abs(e[1] - p) > 1e-6) { return "i=" + i + " expr=" + e[1] + " pure=" + p; }
    }
    return "ok";
})(), "ok");
eq("表达式等价: hMax=0(压平) 时柱子全为基础高度", (function () {
    var tcZ = mkThisComp(gLayerPos, gFx, gp, HB);     // hgtY = HB -> hMax = 0
    var e = evalExpr(T.buildSizeExpr(0, 40, 3), tcZ, gLayerPos, NAME.outSize);
    return (Math.abs(e[1] - BASEC) < 1e-6) ? "ok" : ("got " + e[1]);
})(), "ok");
eq("表达式等价: 最高柱恰好 = hMax(1200 实测)", (function () {
    var tcH = mkThisComp(gLayerPos, gFx, gOne, HB - 1200);
    var i, e, m = 0;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 1), tcH, gLayerPos, NAME.outSize);
        if (e[1] > m) { m = e[1]; }
    }
    return (Math.abs(m - 1200) < 1e-6) ? "ok" : ("got " + m);
})(), "ok");

// ============================================================
// 十一、左右边缘控制点(v0.8.0)
//   一个波峰 = 一组 3 个控制点(峰 + 左边缘 + 右边缘); M 个波峰 = M 组。
//   左半径 = 峰X − 左边缘X;  右半径 = 右边缘X − 峰X  ⇒ 两边可不对称。
// ============================================================
var EB = 864, EP = 34, ERowX = 960;
var ERowLeft = ERowX - 39 / 2 * EP;

// ---- resolvePoints: 对称 vs 不对称 ----
var eSym = T.resolvePoints([{ x: 943, y: EB - 300, r: 9 }], EP, 100, ERowLeft);
near("无边缘点: rl 与 r 相同(对称)", eSym[0].rl, eSym[0].r, 1e-12);
var eAsym = T.resolvePoints([{ x: 943, y: EB - 300, r: 9, xl: 943 - 500, xr: 943 + 200 }], EP, 100, ERowLeft);
near("给了边缘点: 左半径 = 峰X − 左边缘X", eAsym[0].rl, 500, 1e-9);
near("给了边缘点: 右半径 = 右边缘X − 峰X", eAsym[0].r, 200, 1e-9);
eq("左右可不对称", eAsym[0].rl !== eAsym[0].r, true);
var eHalf = T.resolvePoints([{ x: 943, y: EB - 300, r: 9, xl: 943 - 500 }], EP, 100, ERowLeft);
near("只给左边缘: 左 = 500", eHalf[0].rl, 500, 1e-9);
eq("只给左边缘: 右侧回退对称", Math.abs(eHalf[0].r - eSym[0].r) < 1e-12, true);
var eNeg = T.resolvePoints([{ x: 943, y: EB - 300, r: 9, xl: 1200, xr: 800 }], EP, 100, ERowLeft);
near("左边缘跑到峰右侧 -> 左半径钳 0", eNeg[0].rl, 0, 1e-12);
near("右边缘跑到峰左侧 -> 右半径钳 0", eNeg[0].r, 0, 1e-12);
near("两侧半径都为 0 -> 该峰完全不抬柱子", T.barHeightAt(943, eNeg, EB, 0, 0, 0), 0, 1e-12);

// ---- pointContribution: 左右不对称 ----
var EH = 1000;
// ⚠️ 对照组必须把 edgeKeep 也传成一样的值 —— 否则比的是"两个不同边缘高度下的值",
//    第一版就栽在这: 一边传 0(纯曲线)一边走默认 0.3, 数值对不上还以为是代码错。
near("不传 rLeftPx -> 左半仍用 rPx(对称, 向后兼容)",
    T.pointContribution(-50, 0, 700, EH, 100, 0, 0, 0), T.pointContribution(50, 0, 700, EH, 100, 0, 0, 0), 1e-12);
near("传 rLeftPx=200: 左侧 -100 处 t=0.5(等价于对称的 50)",
    T.pointContribution(-100, 0, 700, EH, 100, 0, 0, 0, 200), T.pointContribution(50, 0, 700, EH, 100, 0, 0, 0), 1e-9);
near("传 rLeftPx 不影响右侧",
    T.pointContribution(50, 0, 700, EH, 100, 0, 0, 0, 200), T.pointContribution(50, 0, 700, EH, 100, 0, 0, 0), 1e-12);
near("传 rLeftPx=0 -> 左侧无贡献", T.pointContribution(-10, 0, 700, EH, 100, 0, 0, 0, 0), 0, 1e-12);
near("传 rLeftPx=0 -> 右侧不受影响",
    T.pointContribution(10, 0, 700, EH, 100, 0, 0, 0, 0), T.pointContribution(10, 0, 700, EH, 100, 0, 0, 0), 1e-12);
near("rLeftPx = rPx 时与对称逐点一致",
    T.pointContribution(-40, 0, 700, EH, 100, 0, 0, 0, 100), T.pointContribution(-40, 0, 700, EH, 100, 0, 0, 0), 1e-12);
eq("左半径更大 -> 左侧同一位置贡献更高(形状被拉宽)",
    T.pointContribution(-100, 0, 700, EH, 100, 0, 0, 0, 200) > T.pointContribution(-100, 0, 700, EH, 100, 0, 0, 0, 100), true);

// ---- 端到端: 拖左边缘点 -> 只改左侧覆盖 ----
function eCover(pts, side) {
    var px = 943, c = 0, i, bx, h;
    var rp = T.resolvePoints(pts, EP, 100, ERowLeft);
    for (i = 0; i < 40; i++) {
        bx = ERowX + T.barOffsetX(i, 40, 24, 10);
        h = T.barHeightAt(bx, rp, EB, 0, 0, 0);
        if (h > 1e-9) {
            if (side === 0) { c++; }
            else if (side < 0 && bx < px) { c++; }
            else if (side > 0 && bx > px) { c++; }
        }
    }
    return c;
}
var eBase = [{ x: 943, y: EB - 300, r: 9, xl: 943 - 170, xr: 943 + 170 }];
var eWideL = [{ x: 943, y: EB - 300, r: 9, xl: 943 - 340, xr: 943 + 170 }];
eq("对称窗口: 左右覆盖根数相同", eCover(eBase, -1), eCover(eBase, 1));
eq("把左边缘拖远 -> 左侧覆盖变多", eCover(eWideL, -1) > eCover(eBase, -1), true);
eq("把左边缘拖远 -> 右侧【不变】", eCover(eWideL, 1), eCover(eBase, 1));
eq("把左边缘拖远 -> 总覆盖变多", eCover(eWideL, 0) > eCover(eBase, 0), true);

// ---- 表达式文本体检 ----
var exE = T.buildSizeExpr(0, 40, 3);
eq("表达式: 查左边缘点", exE.indexOf('" 左")') >= 0, true);
eq("表达式: 查右边缘点", exE.indexOf('" 右")') >= 0, true);
eq("表达式: 左半径 = 峰X − 左边缘X", exE.indexOf("rl = pp[0] - ECl.transform.position[0];") >= 0, true);
eq("表达式: 右半径 = 右边缘X − 峰X", exE.indexOf("R = ECr.transform.position[0] - pp[0];") >= 0, true);
eq("表达式: 读「边缘控制」开关", exE.indexOf('ecOn = P.effect("' + NAME.ec + '")(1);') >= 0, true);
eq("表达式: 开关缺失回退 0(省掉两次必然失败的图层查找)",
    exE.indexOf("catch (e11) { ecOn = 0; }") >= 0, true);
eq("表达式: 开关 > 0.5 才查边缘点", exE.indexOf("if (ecOn > 0.5) {") >= 0, true);
eq("表达式: 负数半径钳 0",
    exE.indexOf("if (rl < 0) { rl = 0; }") >= 0 && exE.indexOf("if (R < 0) { R = 0; }") >= 0, true);
eq("表达式: 按左右选半径", exE.indexOf("if (dd < 0) { rUse = rl; }") >= 0, true);
eq("表达式: 判定用 rUse", exE.indexOf("if (rUse > 0) {") >= 0, true);
eq("表达式: t = |dd| / rUse", exE.indexOf("t = Math.abs(dd) / rUse;") >= 0, true);
eq("表达式: 边缘查找包在 try 里", exE.indexOf("catch (e9) { ECl = null; }") >= 0, true);
eq("表达式: 无多变量声明", /var\s+[A-Za-z_$][\w$]*(\s*=[^;\[\n]*)?,/.test(exE), false);
eq("表达式: 无 ++", exE.indexOf("++") < 0, true);
eq("表达式: 无 +=", exE.indexOf("+=") < 0, true);
eq("表达式: 新增变量各声明一次", (function () {
    var names = ["rl", "rUse", "dd", "ECl", "ECr", "ecOn"], i, re;
    for (i = 0; i < names.length; i++) {
        re = new RegExp("var " + names[i] + " ", "g");
        if ((exE.match(re) || []).length !== 1) { return names[i]; }
    }
    return "ok";
})(), "ok");

// ---- 表达式等价性: eval 真表达式 + mock 边缘点 ----
var eFx = {};
eFx[NAME.w] = 24; eFx[NAME.g] = 10; eFx[NAME.base] = BASEC;
eFx[NAME.mode] = 0; eFx[NAME.ftype] = 0;
eFx[NAME.rscale] = 100; eFx[NAME.edge] = NAME.edgeDef;
var eLayerPos = [960, EB];
var ePtsF = [{ x: 943, y: EB - 300, r: 9, ec: 1, xl: 943 - 500, xr: 943 + 200 }];
eq("表达式等价: 不对称边缘点逐根与纯函数一致", (function () {
    var tc = mkThisComp(eLayerPos, eFx, ePtsF);
    var i, e, p;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 1), tc, eLayerPos, NAME.outSize);
        p = T.barHeightOfIndex(i, 40, 24, 10, 960, EB, ePtsF, 0, BASEC, 0, 100, NAME.edgeDef);
        if (Math.abs(e[1] - p) > 1e-6) { return "i=" + i + " expr=" + e[1] + " pure=" + p; }
    }
    return "ok";
})(), "ok");
eq("表达式等价: 边缘控制=0 时退回对称", (function () {
    var ptsOff = [{ x: 943, y: EB - 300, r: 9, ec: 0, xl: 943 - 500, xr: 943 + 200 }];
    var tc = mkThisComp(eLayerPos, eFx, ptsOff);
    var i, e, p;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 1), tc, eLayerPos, NAME.outSize);
        p = T.barHeightOfIndex(i, 40, 24, 10, 960, EB, [{ x: 943, y: EB - 300, r: 9 }], 0, BASEC, 0, 100, NAME.edgeDef);
        if (Math.abs(e[1] - p) > 1e-6) { return "i=" + i + " expr=" + e[1] + " pure=" + p; }
    }
    return "ok";
})(), "ok");
eq("表达式等价: 只给左边缘点时右侧回退对称", (function () {
    var ptsL = [{ x: 943, y: EB - 300, r: 9, ec: 1, xl: 943 - 500 }];
    var tc = mkThisComp(eLayerPos, eFx, ptsL);
    var i, e, p;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 1), tc, eLayerPos, NAME.outSize);
        p = T.barHeightOfIndex(i, 40, 24, 10, 960, EB, ptsL, 0, BASEC, 0, 100, NAME.edgeDef);
        if (Math.abs(e[1] - p) > 1e-6) { return "i=" + i + " expr=" + e[1] + " pure=" + p; }
    }
    return "ok";
})(), "ok");
eq("表达式等价: 总闸 + 边缘点同时生效", (function () {
    var tcG = mkThisComp(eLayerPos, eFx, ePtsF, EB - 900);
    var i, e, p;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 1), tcG, eLayerPos, NAME.outSize);
        p = T.barHeightOfIndex(i, 40, 24, 10, 960, EB, ePtsF, 0, BASEC, 0, 100, NAME.edgeDef, 900);
        if (Math.abs(e[1] - p) > 1e-6) { return "i=" + i + " expr=" + e[1] + " pure=" + p; }
    }
    return "ok";
})(), "ok");

// ---- 命名安全: 边缘点不能被数成峰 ----
eq("命名安全: parseInt(\"1 左\") = 1", parseInt("1" + NAME.ptLSuffix, 10), 1);
eq("命名安全: parseInt(\"12 右\") = 12", parseInt("12" + NAME.ptRSuffix, 10), 12);
eq("边缘控制默认 = 1", NAME.ecDef, 1);
eq("命名安全: 边缘点以 PT_PREFIX 开头(cleanup 自动覆盖)",
    (NAME.ptPrefix + 1 + NAME.ptLSuffix).indexOf(NAME.ptPrefix), 0);

// ---- 源码体检: AE 层的落地点 ----
eq("源码: makeEdgePoints 建两个空对象", src.indexOf("function makeEdgePoints") >= 0, true);
eq("源码: 点位加「边缘控制」滑块", src.indexOf("addSlider(P, SL_EC, EC_DEF);") >= 0, true);
eq("源码: syncEdgeX 共用重摆", src.indexOf("function syncEdgeX") >= 0, true);
eq("源码: pushInfluence 调 syncEdgeX", src.indexOf("syncEdgeX(comp, k, px, rPx);") >= 0, true);
eq("源码: resetPoints 调 syncEdgeX", src.indexOf("syncEdgeX(comp, k3, npx, syncR);") >= 0, true);
eq("源码: 老工程补建「边缘控制」滑块",
    src.indexOf("if (!setSlider(LP, SL_EC, EC_DEF)) { addSlider(LP, SL_EC, EC_DEF); }") >= 0, true);
eq("源码: readPointsFromComp 读 xl/xr", src.indexOf("p.xl = EL.transform.position.value[0];") >= 0, true);
eq("源码: 读 xl/xr 受开关控制", src.indexOf("if (ec > 0.5) {") >= 0, true);

// ============================================================
// 十二、v0.9.0: 衰减作用在【基础高度之上】的区间
//   柱高 = 基础高度 + (峰高 − 基础高度) × 衰减
//
//   旧契约(已废弃): 柱高 = max(峰高 × 衰减, 基础高度)。要看见窗口边缘, 必须
//     峰高 × e > 基础高度, 即【峰高 > 基础高度 ÷ e】—— e=30% 时是基础高度的 3.33 倍。
//     用户报的"必须要高度足够高"就是这个。
//   新契约: 只要 e > 0, 窗口内每一根都保证 > 基础高度; 峰顶仍精确等于峰高。
// ============================================================
var VB = 864, VP = 34, VRowX = 960;
var VRowLeft = VRowX - 39 / 2 * VP;
var VR = 340;                                  // 窗口半径(每侧约 10 根)

function vMinInWindow(peak, baseH, e, R) {
    // 返回 [窗口内最低柱高, 窗口内根数]
    var rp = T.resolvePoints([{ x: 943, y: VB - peak, r: 9, xl: 943 - R, xr: 943 + R }], VP, 100, VRowLeft);
    var mn = 1e18, n = 0, i, bx, h;
    for (i = 0; i < 40; i++) {
        bx = VRowX + T.barOffsetX(i, 40, 24, 10);
        if (Math.abs(bx - 943) > R) { continue; }
        n = n + 1;
        h = T.barHeightAt(bx, rp, VB, 0, baseH, 0, e);
        if (h < mn) { mn = h; }
    }
    return [mn, n];
}

// ---- ⭐ 核心契约: 任意 峰高 / 基础高度 组合下, 窗口内每根都高过地板 ----
[[237.6, 40], [237.6, 100], [237.6, 150], [237.6, 200], [150, 100], [400, 250], [238, 230]]
.forEach(function (c) {
    var r = vMinInWindow(c[0], c[1], NAME.edgeDef, VR);
    eq("⭐ v0.9.0 峰高 " + c[0] + " / 地板 " + c[1] + ": 窗口内最低那根仍高于地板",
        r[0] > c[1] + 1e-6, true);
});
// 对照: 旧公式在同样参数下会失败(峰高 ÷ e < 基础高度)
eq("对照: 旧公式的失败条件确实成立(峰高 237.6 < 地板 150 ÷ 10%)",
    237.6 < 150 / (NAME.edgeDef / 100), true);
// 上一条的"旧公式结果"手算复核: max(峰高×e, 地板) = 地板 -> 与范围外无差别
near("对照: 旧公式下 峰高 237.6 / 地板 150 的边缘柱高 = 地板(看不出被影响)",
    Math.max(237.6 * (NAME.edgeDef / 100), 150), 150, 1e-6);

// ---- 峰顶仍精确等于峰高(地板只是起点, 不改变峰高语义) ----
eq("v0.9.0: 峰顶仍精确 = 峰高(峰高 400 / 地板 250)", (function () {
    var rp = T.resolvePoints([{ x: 943, y: VB - 400, r: 9, xl: 943 - VR, xr: 943 + VR }], VP, 100, VRowLeft);
    return Math.abs(T.barHeightAt(943, rp, VB, 0, 250, 0, NAME.edgeDef) - 400) < 1e-6;
})(), true);
eq("v0.9.0: 峰顶仍精确 = 峰高(峰高 150 / 地板 100)", (function () {
    var rp = T.resolvePoints([{ x: 943, y: VB - 150, r: 9, xl: 943 - VR, xr: 943 + VR }], VP, 100, VRowLeft);
    return Math.abs(T.barHeightAt(943, rp, VB, 0, 100, 0, NAME.edgeDef) - 150) < 1e-6;
})(), true);

// ---- 地板语义保留: 范围外的柱子仍然 = 基础高度 ----
eq("v0.9.0: 窗口外仍是基础高度(地板语义没丢)", (function () {
    var rp = T.resolvePoints([{ x: 943, y: VB - 300, r: 9, xl: 943 - 100, xr: 943 + 100 }], VP, 100, VRowLeft);
    return Math.abs(T.barHeightAt(943 + 500, rp, VB, 0, 40, 0, NAME.edgeDef) - 40) < 1e-9;
})(), true);
eq("v0.9.0: 空点位 -> 全场 = 基础高度", (function () {
    return Math.abs(T.barHeightAt(943, [], VB, 0, 40, 0, NAME.edgeDef) - 40) < 1e-9;
})(), true);

// ---- 峰高不高于地板 -> 该点不起作用(否则会往地板下面拽) ----
near("v0.9.0: 峰高 30 < 地板 40 -> 该点无贡献, 柱子仍是地板", (function () {
    var rp = T.resolvePoints([{ x: 943, y: VB - 30, r: 9, xl: 943 - VR, xr: 943 + VR }], VP, 100, VRowLeft);
    return T.barHeightAt(943, rp, VB, 0, 40, 0, NAME.edgeDef);
})(), 40, 1e-9);
near("v0.9.0: 峰高恰好 = 地板 -> 也无贡献", (function () {
    var rp = T.resolvePoints([{ x: 943, y: VB - 40, r: 9, xl: 943 - VR, xr: 943 + VR }], VP, 100, VRowLeft);
    return T.barHeightAt(943, rp, VB, 0, 40, 0, NAME.edgeDef);
})(), 40, 1e-9);

// ---- 兼容: baseH=0 时与旧公式逐点相同 ----
eq("v0.9.0: baseH=0 时逐点等于旧公式(不传 baseH)", (function () {
    var pt = { x: 943, y: VB - 300, r: 9, xl: 943 - VR, xr: 943 + VR };
    var rp = T.resolvePoints([pt], VP, 100, VRowLeft);
    var i, bx, a, b;
    for (i = 0; i < 40; i++) {
        bx = VRowX + T.barOffsetX(i, 40, 24, 10);
        a = T.barHeightAt(bx, rp, VB, 0, 0, 0, NAME.edgeDef);
        b = T.combineHeights([T.pointContribution(bx, rp[0].x, rp[0].y, VB, rp[0].r,
            0, rp[0].h, NAME.edgeDef, rp[0].rl)], 0, 0);
        if (Math.abs(a - b) > 1e-9) { return "i=" + i + " " + a + " vs " + b; }
    }
    return "ok";
})(), "ok");
near("v0.9.0: pointContribution 不传 baseH 时与传 0 等价",
    T.pointContribution(943, 943, VB - 300, VB, 340, 0, -1, NAME.edgeDef, 340),
    T.pointContribution(943, 943, VB - 300, VB, 340, 0, -1, NAME.edgeDef, 340, 0), 1e-12);

// ---- 可见根数 = 窗口根数(e > 0 时) ----
eq("⭐ v0.9.0: 可见根数 = 窗口根数(e 取默认)", (function () {
    var r = vMinInWindow(237.6, 150, NAME.edgeDef, VR);      // 旧公式下这里是 0 根可见
    return r[0] > 150 + 1e-6 && r[1] > 0;
})(), true);

// ---- 表达式文本: 与纯函数严格镜像 ----
var exV = T.buildSizeExpr(0, 40, 3);
eq("表达式: 声明 eff", exV.indexOf("var eff = 0;") >= 0, true);
eq("表达式: eff = pk − baseH", exV.indexOf("eff = pk - baseH;") >= 0, true);
eq("表达式: v = eff × f (仅当 eff > 0)", exV.indexOf("if (eff > 0) { v = eff * f; }") >= 0, true);
eq("表达式: 收尾 = baseH + 合成", exV.indexOf("h = baseH + h;") >= 0, true);
eq("表达式: 旧的 max 钳制已清除", exV.indexOf("if (h < baseH) { h = baseH; }") < 0, true);
eq("表达式: 无多变量声明", /var\s+[A-Za-z_$][\w$]*(\s*=[^;\[\n]*)?,/.test(exV), false);
eq("表达式: eff 只声明一次", (exV.match(/var eff =/g) || []).length, 1);
eq("源码: countVisibleBars 把 baseH 真实传下去(不再传 0 绕开钳制)",
    src.indexOf("points, mode, baseH, type, rscalePct, edgeKeep, hMax);") >= 0, true);
eq("源码: combineHeights 收尾为 baseH + 合成",
    src.indexOf("return b + h;") >= 0, true);

// ---- 表达式等价性: 新公式下 mock 与纯函数逐根一致 ----
var vFx = {};
vFx[NAME.w] = 24; vFx[NAME.g] = 10; vFx[NAME.base] = 40;
vFx[NAME.mode] = 0; vFx[NAME.ftype] = 0;
vFx[NAME.rscale] = 100; vFx[NAME.edge] = NAME.edgeDef;
var vLayerPos = [960, VB];
var vPts = [{ x: 943, y: VB - 237.6, r: 9, ec: 1, xl: 943 - VR, xr: 943 + VR }];
eq("表达式等价: 新公式下逐根与纯函数一致(含地板 40)", (function () {
    var tc = mkThisComp(vLayerPos, vFx, vPts);
    var i, e, p;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 1), tc, vLayerPos, NAME.outSize);
        p = T.barHeightOfIndex(i, 40, 24, 10, 960, VB, vPts, 0, 40, 0, 100, NAME.edgeDef);
        if (Math.abs(e[1] - p) > 1e-6) { return "i=" + i + " expr=" + e[1] + " pure=" + p; }
    }
    return "ok";
})(), "ok");
eq("表达式等价: 高地板(150)下同样一致", (function () {
    var fx2 = {};
    fx2[NAME.w] = 24; fx2[NAME.g] = 10; fx2[NAME.base] = 150;
    fx2[NAME.mode] = 0; fx2[NAME.ftype] = 0;
    fx2[NAME.rscale] = 100; fx2[NAME.edge] = NAME.edgeDef;
    var tc = mkThisComp(vLayerPos, fx2, vPts);
    var i, e, p;
    for (i = 0; i < 40; i++) {
        e = evalExpr(T.buildSizeExpr(i, 40, 1), tc, vLayerPos, NAME.outSize);
        p = T.barHeightOfIndex(i, 40, 24, 10, 960, VB, vPts, 0, 150, 0, 100, NAME.edgeDef);
        if (Math.abs(e[1] - p) > 1e-6) { return "i=" + i + " expr=" + e[1] + " pure=" + p; }
    }
    return "ok";
})(), "ok");

// ============================================================
console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
if (failed > 0) { process.exit(1); }
