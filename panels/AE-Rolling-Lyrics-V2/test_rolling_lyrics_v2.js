// test_rolling_lyrics_v2.js
// Rolling Lyrics V2 表达式真实执行测试（Node 直接运行）
// 用法: node test_rolling_lyrics_v2.js
// 原理: 直接 require rolling-lyrics-v2.jsx（复制为 .js），用 mock 图层/合成调用
//       buildController / attachExpressions 捕获【真实表达式字符串】+【真实控件名/值】，
//       在 Node 里模拟 AE 表达式环境（effect/thisComp/seedRandom/ease/linear）逐帧求值并断言。
//       —— 不再"复刻算法"，改表达式忘改测试会立即假红。
// 注: seedRandom/random 为确定性 polyfill，与 AE 表达式语义一致（同种子同序列）。

var fs = require("fs");
var path = require("path");
var vm = require("vm");

/* ================= 加载 JSX（vm 执行内容，不落盘，绕开沙箱删除拦截） ================= */
var jsxPath = path.join(__dirname, "rolling-lyrics-v2.jsx");
var code = fs.readFileSync(jsxPath, "utf8");
var sandbox = { module: { exports: {} } };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(code, sandbox, { filename: "rolling-lyrics-v2.jsx" });
var SCRIPTS = sandbox.module.exports;

/* ================= AE 表达式环境 polyfill ================= */
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

/* ================= AE 对象 mock（捕获真实表达式/控件名/控件值） ================= */
// mock 效果：记录 fx.name 与 setValue 值 → ctrlValues[name] = value
function mockFx(ctrlValues) {
    var fx = { _name: "" };
    Object.defineProperty(fx, "name", {
        get: function () { return fx._name; },
        set: function (v) { fx._name = v; }
    });
    fx.property = function () {
        return { setValue: function (v) { ctrlValues[fx._name] = v; } };
    };
    return fx;
}
function mockFxGroup(ctrlValues) {
    return { addProperty: function () { return mockFx(ctrlValues); } };
}
function mockLayer(ctrlValues) {
    return {
        name: "", startTime: 0,
        transform: {
            position: { setValue: function () {}, expression: "" },
            scale: { expression: "" },
            opacity: { expression: "" }
        },
        property: function () { return mockFxGroup(ctrlValues); }
    };
}
function mockComp(W, H, f, ctrlValues) {
    return {
        width: W, height: H, frameDuration: 1 / f,
        layers: { addNull: function () { return mockLayer(ctrlValues); } }
    };
}

/* ================= 真实表达式求值环境 ================= */
function makeEnv(ctrlValues, W, H, f) {
    var ctrlPos = { 0: W / 2, 1: H / 2 };      // Lyrics_Ctrl 位置（先求值 ctrl 表达式后写入）
    var masterPos = { 0: W / 2, 1: H / 2 };    // Lyrics_Master（初始在画面中心）
    var ctrlObj = { transform: { position: ctrlPos }, effect: ctrlEffect };
    var masterObj = { transform: { position: masterPos } };
    function ctrlEffect(name) { return function () { return ctrlValues[name]; }; }
    var thisComp = {
        frameDuration: 1 / f, width: W, height: H,
        layer: function (name) { return (name === "Lyrics_Ctrl") ? ctrlObj : masterObj; }
    };
    // AE 表达式语义：多条语句，最后一条语句的值作为结果（若最后为 if/else，返回分支值）。
    // JS 的 function 不自动返回语句值，这里把表达式包装成 IIFE + return 尾行。
    function wrapExpr(expr) {
        var trimmed = expr.replace(/\s+$/, "");
        // 处理控制器表达式的 if/else 两行结尾 → return 三元
        var fm = trimmed.match(/\n\s*if\s*\((.*?)\)\s*\{\s*([^}]*?)\s*\}\s*\n\s*else\s*\{\s*([^}]*?)\s*\}\s*$/);
        if (fm) {
            var head = trimmed.slice(0, fm.index);
            var a = fm[2].replace(/;\s*$/, "").trim();
            var b = fm[3].replace(/;\s*$/, "").trim();
            return "(function(){\n" + head + "\nreturn (" + fm[1] + ") ? (" + a + ") : (" + b + ");\n})();";
        }
        // 其他：最后一行转 return
        var m = trimmed.match(/([\s\S]*\n)?([^\n]+)$/);
        var hd = m[1] || "";
        var tl = m[2].replace(/;\s*$/, "").trim();
        return "(function(){\n" + hd + "\nreturn " + tl + ";\n})();";
    }

    function evalExpr(expr, time) {
        var fn = new Function(
            "time", "thisComp", "effect", "seedRandom", "random", "ease", "linear",
            "return " + wrapExpr(expr) + ";"
        );
        return fn(time, thisComp, ctrlEffect, seedRandom, random, ease, linear);
    }
    return {
        evalExpr: evalExpr,
        setCtrlPos: function (xy) { ctrlPos[0] = xy[0]; ctrlPos[1] = xy[1]; },
        ctrlPos: ctrlPos
    };
}

/* ================= 构造"真实表达式快照" ================= */
function snapshot(params, n, W, H, f) {
    var ctrlValues = {};
    var comp = mockComp(W, H, f, ctrlValues);
    var ctl = SCRIPTS.core.buildController(comp, n, params);   // 真实 ctrl 表达式 + 控件值
    var layers = [];
    for (var i = 0; i < n; i++) {
        var L = mockLayer();
        SCRIPTS.core.attachExpressions(L, i, n, W / 2, H / 2, null);  // 真实句表达式
        layers.push(L);
    }
    return { env: makeEnv(ctrlValues, W, H, f), ctrlExpr: ctl.ctrl.transform.position.expression, layers: layers };
}
// 对给定时刻求值：先 ctrl（写入 ctrlPos），再每句 3 条
function valuesAt(snap, time) {
    var ctrlXY = snap.env.evalExpr(snap.ctrlExpr, time);
    snap.env.setCtrlPos(ctrlXY);
    var out = [];
    for (var i = 0; i < snap.layers.length; i++) {
        var L = snap.layers[i];
        out.push({
            pos: snap.env.evalExpr(L.transform.position.expression, time),
            scale: snap.env.evalExpr(L.transform.scale.expression, time),
            opacity: snap.env.evalExpr(L.transform.opacity.expression, time)
        });
    }
    return { ctrlY: ctrlXY[1], layers: out };
}

/* ================= 断言工具 ================= */
var passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log("  ✓ " + msg); }
    else { failed++; console.log("  ✗ FAIL: " + msg); }
}
function nearly(a, b, eps) { return Math.abs(a - b) <= (eps || 0.001); }

/* ================= 用例 ================= */
var P = { maxSize: 60, normalSize: 40, gap: 145, multiGap: 145, linesPerScroll: 1,
          maxOpacity: 100, normalOpacity: 30,
          scrollFrames: 9, pauseFrames: 30, pauseRandom: false, jitterFrames: 10 };
var W = 1920, H = 1080, FPS = 30;

console.log("== 用例 1: k=1（默认，应等同 v1 单句滚动）==");
var s1 = snapshot(P, 5, W, H, FPS);
var v1t = valuesAt(s1, 0);
assert(nearly(v1t.layers[0].pos[1], H / 2), "句0 在画面中心 (idx=0)");
assert(nearly(v1t.layers[2].pos[1], H / 2 + 2 * P.gap), "句2 = 中心下方 2*gap");
assert(nearly(v1t.layers[0].pos[1] - v1t.layers[1].pos[1], -P.gap), "相邻句间距 = gap");

console.log("== 用例 2: k=2, n=5 布局（组0 中心在画面中心）==");
P.linesPerScroll = 2;
var s2 = snapshot(P, 5, W, H, FPS);
var v2t = valuesAt(s2, 0);
assert(nearly(v2t.layers[0].pos[1], H / 2 - 0.5 * P.multiGap), "句0 = H/2 - 0.5*mg (" + v2t.layers[0].pos[1].toFixed(1) + ")");
assert(nearly(v2t.layers[1].pos[1], H / 2 + 0.5 * P.multiGap), "句1 = H/2 + 0.5*mg (" + v2t.layers[1].pos[1].toFixed(1) + ")");
assert(nearly(v2t.layers[2].pos[1] - v2t.layers[1].pos[1], P.gap), "组间相邻句间距 = gap");
assert(nearly(v2t.layers[3].pos[1] - v2t.layers[2].pos[1], P.multiGap), "组内(句2->句3)间距 = mg");
assert(nearly((v2t.layers[0].pos[1] + v2t.layers[1].pos[1]) / 2, H / 2), "组0 中心 = 画面中心（对称）");

console.log("== 用例 3: 滚动连续性（逐帧扫描，y 平滑不跳变）==");
var prev = null, maxJump = 0;
for (var fr = 0; fr < 180; fr++) {
    var y = valuesAt(s2, fr / FPS).layers[1].pos[1];
    if (prev !== null) { maxJump = Math.max(maxJump, Math.abs(y - prev)); }
    prev = y;
}
var stepK2 = P.multiGap * 1 + P.gap;
assert(maxJump <= stepK2 / P.scrollFrames + 1, "单帧位移 ≤ " + (stepK2 / P.scrollFrames).toFixed(1) + "px（实际 " + maxJump.toFixed(1) + "px，平滑）");

console.log("== 用例 4: 句位置 = ctrl 组中心 + 固定偏移（整组跟随无漂移）==");
var drift = 0, offRef = v2t.layers[1].pos[1] - v2t.ctrlY;
for (var fr4 = 0; fr4 < 150; fr4++) {
    var v4 = valuesAt(s2, fr4 / FPS);
    drift = Math.max(drift, Math.abs((v4.layers[1].pos[1] - v4.ctrlY) - offRef));
}
assert(drift < 1, "0~5s 全程句1 相对 ctrl 偏移漂移 < 1px（实际 " + drift.toFixed(3) + "px）");

console.log("== 用例 5: 整组一致性（同组同缩放同透明度）==");
var ok5 = true;
for (var fr5 = 0; fr5 < 60; fr5++) {
    var v5 = valuesAt(s2, fr5 / FPS);
    if (!nearly(v5.layers[0].scale[0], v5.layers[1].scale[0], 1e-6)) { ok5 = false; break; }
    if (!nearly(v5.layers[0].opacity, v5.layers[1].opacity, 1e-6)) { ok5 = false; break; }
    if (!nearly(v5.layers[2].scale[0], v5.layers[3].scale[0], 1e-6)) { ok5 = false; break; }
}
assert(ok5, "同组句子共享缩放/透明度（真实表达式）");

console.log("== 用例 6: 组内行间距生效（mg 145→200）==");
P.multiGap = 200;
var s6a = snapshot(P, 5, W, H, FPS);
var dA = valuesAt(s6a, 0).layers[1].pos[1] - valuesAt(s6a, 0).layers[0].pos[1];
P.multiGap = 145;
assert(nearly(dA, 200), "组内句距 = mg（200 生效）");
var s6b = snapshot(P, 5, W, H, FPS);
assert(nearly(valuesAt(s6b, 0).layers[1].pos[1] - valuesAt(s6b, 0).layers[0].pos[1], 145), "组内句距 = mg（145）");

console.log("== 用例 7: 静止时透明度/字号二值（中心 100%/最大，其余普通）==");
P.linesPerScroll = 2; P.multiGap = 145;
var v7 = valuesAt(snapshot(P, 5, W, H, FPS), 0);
assert(nearly(v7.layers[0].opacity, P.maxOpacity), "中心组透明度 = 100");
assert(nearly(v7.layers[1].opacity, P.maxOpacity), "组0 另一句透明度 = 100（整组一致）");
assert(nearly(v7.layers[2].opacity, P.normalOpacity), "组1 透明度 = 30（二值）");
assert(nearly(v7.layers[4].opacity, P.normalOpacity), "组2 透明度 = 30");
assert(nearly(v7.layers[0].scale[0], P.maxSize / P.normalSize * 100), "中心组缩放 = 最大字号比例");
assert(nearly(v7.layers[2].scale[0], 100), "组1 缩放 = 普通 (100%)");

console.log("== 用例 8: 滚动过程中透明度/字号平滑过渡（非二值跳变）==");
// 滚动中点：ctrl 表达式内部 times[1] = (sc+pause)/f = 39/30 = 1.3s；滚动段 = [1, 1.3] → 中点 1.15
var scrollMid = 1 + (P.scrollFrames / FPS) / 2;
var v8 = valuesAt(snapshot(P, 5, W, H, FPS), scrollMid);
assert(v8.layers[0].opacity > P.normalOpacity && v8.layers[0].opacity < P.maxOpacity, "滚动中点旧组透明度为过渡值（" + v8.layers[0].opacity.toFixed(1) + "）");
assert(nearly(v8.layers[0].opacity, v8.layers[2].opacity, 1), "滚动中点新旧组透明度相等（交叉过渡）");
assert(v8.layers[0].scale[0] > 100 && v8.layers[0].scale[0] < P.maxSize / P.normalSize * 100, "滚动中点字号为过渡值（" + v8.layers[0].scale[0].toFixed(1) + "）");

console.log("== 用例 9: 任意句数（k=4, n=9；k=10 > n）==");
P.linesPerScroll = 4;
var v9 = valuesAt(snapshot(P, 9, W, H, FPS), 0);
assert(nearly((v9.layers[0].pos[1] + v9.layers[3].pos[1]) / 2, H / 2), "组0 中心 = 画面中心（k=4 对称）");
assert(nearly(v9.layers[4].pos[1] - v9.layers[3].pos[1], P.gap), "组间相邻句距 = gap");
assert(nearly(v9.layers[0].opacity, P.maxOpacity), "k=4 中心组透明度 = 100");
assert(nearly(v9.layers[4].opacity, P.normalOpacity), "k=4 相邻组透明度 = 30");
P.linesPerScroll = 10;
var v10 = valuesAt(snapshot(P, 5, W, H, FPS), 0);
assert(nearly((v10.layers[0].pos[1] + v10.layers[4].pos[1]) / 2, H / 2), "k=10 > n=5：整组对称居中");
assert(nearly(v10.layers[2].opacity, P.maxOpacity), "k≥n 时全部句 100% 透明度");

console.log("\n===== 结果: " + passed + " 通过, " + failed + " 失败 =====");
process.exit(failed > 0 ? 1 : 0);
