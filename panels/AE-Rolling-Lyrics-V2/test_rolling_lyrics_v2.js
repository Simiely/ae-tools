// test_rolling_lyrics_v2.js
// Rolling Lyrics V2 组滚动逻辑模拟测试（Node 直接运行）
// 用法: node test_rolling_lyrics_v2.js
// 作用: 在 Node 里复刻 V2 表达式算法，验证布局/滚动连续性/整组缩放，避免"盲发"到 AE。
// 注意: 这里的算法必须与 rolling-lyrics-v2.jsx 里 attachExpressions / buildController 的表达式保持一致。
//
// 核心公式（v1 语义推广到组）：
//   参考点 ctrlY(停顿, idx) = H/2 + ((mnum-1)/2 - idx)*step   （滚动时线性插值到 idx+1）
//   句 i 相对参考点的固定偏移 = rel_i - ((mnum-1)/2)*step
//   句 i y = ctrlY(动态) + rel_i - ((mnum-1)/2)*step
//   rel_i = gi*step + (ii-(kk-1)/2)*mg，gi=⌊i/k⌋，ii=i mod k，step=mg*(k-1)+g
// 语义：idx=0 时第 0 组中心在画面中心（组0 的句子围绕 H/2 对称），滚动时整列平滑上移 step。

// ---- AE 表达式环境 polyfill ----
var _seed = 0;
function seedRandom(seed, timeless) { _seed = seed; }
function random() {
    _seed = (_seed * 1103515245 + 12345) % 2147483648;
    return _seed / 2147483648;
}
function ease(t, t1, t2, v1, v2) {
    if (t <= t1) { return v1; }
    if (t >= t2) { return v2; }
    var p = (t - t1) / (t2 - t1);
    return v1 + (v2 - v1) * p;
}
function linear(t, t1, t2, v1, v2) { return ease(t, t1, t2, v1, v2); }

// ---- 复刻 V2 组滚动核心（与 JSX 表达式同算法） ----
function rhythmTimes(n, kk, params, f) {
    var mnum = Math.max(1, Math.ceil(n / kk));
    var times = [0], t = 0;
    for (var jj = 0; jj < mnum - 1; jj++) {
        seedRandom(jj + 11000, true);
        var jp = params.pauseFrames + (params.pauseRandom ? params.jitterFrames * (random() * 2 - 1) : 0);
        t += (params.scrollFrames + jp) / f;
        times.push(t);
    }
    return { mnum: mnum, times: times };
}
function groupIndex(times, time) {
    var idx = 0;
    while (idx < times.length - 1 && time >= times[idx + 1]) { idx++; }
    return idx;
}

// 控制器 y（复刻 ctrl 位置表达式：停顿 y0 / 滚动 linear 到 y1）
function ctrlY(n, kk, params, time, f, H) {
    var mg = params.multiGap, g = params.gap;
    var step = mg * (kk - 1) + g;
    var rt = rhythmTimes(n, kk, params, f);
    var idx = groupIndex(rt.times, time);
    seedRandom(idx + 11000, true);
    var jp = params.pauseFrames + (params.pauseRandom ? params.jitterFrames * (random() * 2 - 1) : 0);
    var lt = time - rt.times[idx];
    var y0 = H / 2 + ((rt.mnum - 1) / 2 - idx) * step;
    var y1 = H / 2 + ((rt.mnum - 1) / 2 - Math.min(idx + 1, rt.mnum - 1)) * step;
    if (lt <= jp / f) { return y0; }
    return linear(lt, jp / f, jp / f + params.scrollFrames / f, y0, y1);
}

// 句 i 的 y（复刻句位置表达式：引用 ctrl 动态位置 + 固定偏移）
function lyricY(i, n, kk, params, time, f, H) {
    var mg = params.multiGap, g = params.gap;
    var step = mg * (kk - 1) + g;
    var rt = rhythmTimes(n, kk, params, f);
    var cy = ctrlY(n, kk, params, time, f, H); // 动态组中心（含滚动插值）
    var gi = Math.floor(i / kk), ii = i - gi * kk;
    var kkAct = Math.min(kk, n - gi * kk);      // 本组实际句数（最后一组可能不满）
    var rel = gi * step + (ii - (kkAct - 1) / 2) * mg;
    return cy + (rel - ((rt.mnum - 1) / 2) * step);
}

// 句 i 所属组中心到画面中心的距离（复刻新 d 公式；修正：组中心 = ctrlY + gi*step - (mnum-1)/2*step）
function groupDist(i, n, kk, params, time, f, H) {
    var mg = params.multiGap, g = params.gap;
    var step = mg * (kk - 1) + g;
    var rt = rhythmTimes(n, kk, params, f);
    var cy = ctrlY(n, kk, params, time, f, H);
    var gi = Math.floor(i / kk);
    return Math.abs(cy + gi * step - ((rt.mnum - 1) / 2) * step - H / 2);
}

// 句 i 的透明度（复刻 opacity 表达式：ease(min(d,step), 0, step, maxO, norO)）
function opacityI(i, n, kk, params, time, f, H) {
    var step = params.multiGap * (kk - 1) + params.gap;
    var d = groupDist(i, n, kk, params, time, f, H);
    return ease(Math.min(d, step), 0, step, params.maxOpacity, params.normalOpacity);
}

// 句 i 的缩放（复刻 scale 表达式）
function scaleI(i, n, kk, params, time, f, H) {
    var step = params.multiGap * (kk - 1) + params.gap;
    var d = groupDist(i, n, kk, params, time, f, H);
    var ratio = params.maxSize / params.normalSize;
    return ease(Math.min(d, step), 0, step, ratio * 100, 100);
}

// ---- 断言工具 ----
var passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log("  ✓ " + msg); }
    else { failed++; console.log("  ✗ FAIL: " + msg); }
}
function nearly(a, b, eps) { return Math.abs(a - b) <= (eps || 0.001); }

// ---- 默认参数（与 DEFAULTS 一致） ----
var P = { maxSize: 60, normalSize: 40, gap: 145, multiGap: 145, linesPerScroll: 1,
          maxOpacity: 100, normalOpacity: 30,
          scrollFrames: 9, pauseFrames: 30, pauseRandom: false, jitterFrames: 10 };
var FPS = 30, H = 1080;

console.log("== 用例 1: k=1（默认，应等同 v1 单句滚动）==");
P.linesPerScroll = 1;
var n1 = 5;
// idx=0（time=0）时句0 在画面中心
assert(nearly(lyricY(0, n1, 1, P, 0, FPS, H), H / 2), "句0 在画面中心 (idx=0)");
assert(nearly(lyricY(2, n1, 1, P, 0, FPS, H), H / 2 + 2 * P.gap), "句2 = 中心下方 2*gap");
// 相邻句间距 = gap
assert(nearly(lyricY(0, n1, 1, P, 0, FPS, H) - lyricY(1, n1, 1, P, 0, FPS, H), -P.gap), "相邻句间距 = gap");

console.log("== 用例 2: k=2, n=5 布局（组0 中心在画面中心）==");
P.linesPerScroll = 2;
var n2 = 5;
var ys = [];
for (var i = 0; i < n2; i++) { ys.push(lyricY(i, n2, 2, P, 0, FPS, H)); }
assert(nearly(ys[0], H / 2 - 0.5 * P.multiGap), "句0 = H/2 - 0.5*mg（组0 内上句）(" + ys[0].toFixed(1) + ")");
assert(nearly(ys[1], H / 2 + 0.5 * P.multiGap), "句1 = H/2 + 0.5*mg（组0 内下句）(" + ys[1].toFixed(1) + ")");
assert(nearly(ys[2] - ys[1], P.gap), "组间相邻句间距 = gap (" + (ys[2] - ys[1]).toFixed(1) + ")");
assert(nearly(ys[3] - ys[2], P.multiGap), "组内(句2->句3)间距 = mg (" + (ys[3] - ys[2]).toFixed(1) + ")");
// 组0 中心 = 画面中心（对称）
assert(nearly((ys[0] + ys[1]) / 2, H / 2), "组0 中心 = 画面中心（对称）");

console.log("== 用例 3: 滚动连续性（逐帧扫描，y 平滑不跳变）==");
var prev = null, maxJump = 0;
for (var fr = 0; fr < 180; fr++) {
    var t = fr / FPS;
    var y = lyricY(1, n2, 2, P, t, FPS, H);
    if (prev !== null) { maxJump = Math.max(maxJump, Math.abs(y - prev)); }
    prev = y;
}
var stepK2 = P.multiGap * 1 + P.gap; // 290
var expectPerFrame = stepK2 / P.scrollFrames; // ≈32.2
assert(maxJump <= expectPerFrame + 1, "单帧位移 ≤ " + expectPerFrame.toFixed(1) + "px（实际最大 " + maxJump.toFixed(1) + "px，平滑无跳变）");

console.log("== 用例 4: 句位置 = ctrl 组中心 + 固定偏移（整组跟随无漂移）==");
var off1 = lyricY(1, n2, 2, P, 0, FPS, H) - ctrlY(n2, 2, P, 0, FPS, H);
var off2 = lyricY(2, n2, 2, P, 0, FPS, H) - ctrlY(n2, 2, P, 0, FPS, H);
var stepV = P.multiGap * 1 + P.gap;
var expectOff1 = 0.5 * P.multiGap - ((2) / 2) * stepV;  // (mnum-1)/2 = 1 → +0.5mg - step
var expectOff2 = (1 * stepV - 0.5 * P.multiGap) - ((2) / 2) * stepV; // 句2: gi=1, ii=0 → rel=step-0.5mg
assert(nearly(off1, expectOff1, 1), "句1 相对 ctrl 固定偏移 = 0.5*mg - step (" + off1.toFixed(1) + ")");
assert(nearly(off2, expectOff2, 1), "句2 相对 ctrl 固定偏移 = step + 0.5*mg - step (" + off2.toFixed(1) + ")");
// 滚动全程偏移不变
var drift = 0;
for (var fr4 = 0; fr4 < 150; fr4++) {
    var t4 = fr4 / FPS;
    drift = Math.max(drift, Math.abs((lyricY(1, n2, 2, P, t4, FPS, H) - ctrlY(n2, 2, P, t4, FPS, H)) - expectOff1));
}
assert(drift < 1, "0~5s 全程句1 相对 ctrl 偏移漂移 < 1px（实际 " + drift.toFixed(3) + "px）");

console.log("== 用例 5: 整组缩放一致性（同帧同组共享 d）==");
P.linesPerScroll = 2;
var ok5 = true;
for (var fr5 = 0; fr5 < 60; fr5++) {
    var t5 = fr5 / FPS;
    if (!nearly(groupDist(0, n2, 2, P, t5, FPS, H), groupDist(1, n2, 2, P, t5, FPS, H), 1e-6)) { ok5 = false; break; }
    if (!nearly(groupDist(2, n2, 2, P, t5, FPS, H), groupDist(3, n2, 2, P, t5, FPS, H), 1e-6)) { ok5 = false; break; }
}
assert(ok5, "同组句子共享组中心距离（整组同缩放同透明度）");

console.log("== 用例 6: 组内行间距生效（mg 145→200）==");
P.linesPerScroll = 2;
var d0 = lyricY(1, n2, 2, P, 0, FPS, H) - lyricY(0, n2, 2, P, 0, FPS, H);
P.multiGap = 200;
var d1b = lyricY(1, n2, 2, P, 0, FPS, H) - lyricY(0, n2, 2, P, 0, FPS, H);
assert(nearly(d0, 145) && nearly(d1b, 200), "组内句距 = mg（145→200 生效）");

console.log("== 用例 7: 静止时透明度/字号二值（中心 100%/最大，其余普通）==");
P.linesPerScroll = 2; P.multiGap = 145;
// time=0：组0 在中心停顿
assert(nearly(groupDist(0, n2, 2, P, 0, FPS, H), 0, 1e-6), "组0 中心距离 = 0（停顿态）");
assert(nearly(opacityI(0, n2, 2, P, 0, FPS, H), P.maxOpacity), "中心组透明度 = 最大透明度 (100)");
assert(nearly(opacityI(1, n2, 2, P, 0, FPS, H), P.maxOpacity), "组0 另一句透明度 = 100（整组一致）");
assert(nearly(opacityI(2, n2, 2, P, 0, FPS, H), P.normalOpacity), "组1 透明度 = 普通 (30)（二值）");
assert(nearly(opacityI(4, n2, 2, P, 0, FPS, H), P.normalOpacity), "组2 透明度 = 普通 (30)");
assert(nearly(scaleI(0, n2, 2, P, 0, FPS, H), P.maxSize / P.normalSize * 100), "中心组缩放 = 最大字号比例");
assert(nearly(scaleI(2, n2, 2, P, 0, FPS, H), 100), "组1 缩放 = 普通 (100%)");

console.log("== 用例 8: 滚动过程中透明度/字号平滑过渡（非二值跳变）==");
P.linesPerScroll = 2; P.multiGap = 145;
// 找滚动中段时刻：先算组0 停顿结束后的滚动中点
var rt8 = rhythmTimes(n2, 2, P, FPS);
var jp0 = P.pauseFrames / FPS;
var scrollMid = rt8.times[0] + jp0 + (P.scrollFrames / FPS) / 2; // 组0→组1 滚动中点
var op0 = opacityI(0, n2, 2, P, scrollMid, FPS, H);
var op1 = opacityI(2, n2, 2, P, scrollMid, FPS, H);
assert(op0 > P.normalOpacity && op0 < P.maxOpacity, "滚动中点旧组透明度为过渡值（" + op0.toFixed(1) + " ∈ (30,100)）");
assert(nearly(op0, op1, 1), "滚动中点新旧组透明度相等（交叉过渡 " + op1.toFixed(1) + "）");
var sc0 = scaleI(0, n2, 2, P, scrollMid, FPS, H);
assert(sc0 > 100 && sc0 < P.maxSize / P.normalSize * 100, "滚动中点字号为过渡值（" + sc0.toFixed(1) + " ∈ (100,150)）");

console.log("== 用例 9: 任意句数（k=4, n=9；k=10 > n，不限制 1-3）==");
P.linesPerScroll = 4; P.multiGap = 145;
var n9 = 9, k9 = 4;
var ys9 = [];
for (var j9 = 0; j9 < n9; j9++) { ys9.push(lyricY(j9, n9, k9, P, 0, FPS, H)); }
assert(nearly((ys9[0] + ys9[3]) / 2, H / 2), "组0 中心 = 画面中心（k=4 对称）");
assert(nearly(ys9[1] - ys9[0], P.multiGap), "组内句距 = mg");
assert(nearly(ys9[4] - ys9[3], P.gap), "组间相邻句距 = gap");
assert(nearly(opacityI(0, n9, k9, P, 0, FPS, H), P.maxOpacity), "k=4 中心组透明度 = 100");
assert(nearly(opacityI(4, n9, k9, P, 0, FPS, H), P.normalOpacity), "k=4 相邻组透明度 = 30");
P.linesPerScroll = 10; // k > 句数：只有一组，全部居中 100%
var ys10 = [];
for (var j10 = 0; j10 < 5; j10++) { ys10.push(lyricY(j10, 5, 10, P, 0, FPS, H)); }
assert(nearly((ys10[0] + ys10[4]) / 2, H / 2), "k=10 > n=5：整组对称居中");
assert(nearly(opacityI(2, 5, 10, P, 0, FPS, H), P.maxOpacity), "k≥n 时全部句 100% 透明度");

console.log("\n===== 结果: " + passed + " 通过, " + failed + " 失败 =====");
process.exit(failed > 0 ? 1 : 0);
