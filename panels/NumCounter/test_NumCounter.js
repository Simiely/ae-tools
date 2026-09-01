// test_NumCounter.js — 纯逻辑层断言 (node 运行, 不依赖 AE)
// 运行: node test_NumCounter.js
// 说明: NumCounter.jsx 在 app 未定义时只导出纯函数并返回, 这里 eval 取出后断言。

var fs = require("fs");
var path = require("path");

var srcPath = path.join(__dirname, "NumCounter.jsx");
var src = fs.readFileSync(srcPath, "utf8");
src = src.replace(/^\uFEFF/, ""); // 去 BOM(若有)

// 隔离作用域求值, 取出纯函数
var module = { exports: {} };
var app; // 故意未定义 -> 触发 jsx 内的 node 导出分支
eval(src);
var T = module.exports;

var passed = 0, failed = 0;
function eq(name, got, want) {
    var g = String(got), w = String(want);
    if (g === w) { passed++; }
    else { failed++; console.log("FAIL " + name + ": got=[" + g + "] want=[" + w + "]"); }
}

// ---- snapToStep ----
eq("snap 10.4/5", T.snapToStep(10.4, 5), 10);
eq("snap 12.6/5", T.snapToStep(12.6, 5), 15);
eq("snap 7/3", T.snapToStep(7, 3), 6);
eq("snap -3/2", T.snapToStep(-3, 2), -2);
eq("snap 10/0(无步进原样)", T.snapToStep(10, 0), 10);

// ---- formatNumber (无前后缀) ----
eq("fmt 123.456/2", T.formatNumber(123.456, 2, "", ""), "123.46");
eq("fmt 123.4/2", T.formatNumber(123.4, 2, "", ""), "123.40");
eq("fmt 0/2", T.formatNumber(0, 2, "", ""), "0.00");
eq("fmt 99.99/0", T.formatNumber(99.99, 0, "", ""), "100");
eq("fmt -5.5/1", T.formatNumber(-5.5, 1, "", ""), "-5.5");
eq("fmt 7/3", T.formatNumber(7, 3, "", ""), "7.000");
eq("fmt 1/2", T.formatNumber(1, 2, "", ""), "1.00");
eq("fmt 0.5/2", T.formatNumber(0.5, 2, "", ""), "0.50");
eq("fmt 12.34/2", T.formatNumber(12.34, 2, "", ""), "12.34");
eq("fmt -0.5/2", T.formatNumber(-0.5, 2, "", ""), "-0.50");
eq("fmt 100/0", T.formatNumber(100, 0, "", ""), "100");

// ---- formatNumber (带前缀/后缀) ----
eq("fmt 100/0 $ %", T.formatNumber(100, 0, "$", "%"), "$100%");
eq("fmt 12.3/1 ¥", T.formatNumber(12.3, 1, "¥", ""), "¥12.3");
eq("fmt -3/0 前导", T.formatNumber(-3, 0, "(", ")"), "(-3)");

// ---- 预设序列化 / 反序列化 往返 ----
var po = { start: 0, target: 100, frames: 30, step: 1, dec: 0, track: 0,
    font: "（默认）", style: "常规", align: 1, ease: 0, mono: true };
var po2 = T.deserializePreset(T.serializePreset(po));
eq("preset 默认 start", po2.start, 0);
eq("preset 默认 target", po2.target, 100);
eq("preset 默认 frames", po2.frames, 30);
eq("preset 默认 mono", po2.mono, true);
eq("preset 默认 align", po2.align, 1);
eq("preset 默认 font", po2.font, "（默认）");

var po3 = { start: 5, target: 12.3, frames: 24, step: 0, dec: 1, track: 4,
    font: "Arial", style: "Bold", align: 2, ease: 3, mono: false };
var po4 = T.deserializePreset(T.serializePreset(po3));
eq("preset2 start", po4.start, 5);
eq("preset2 target", po4.target, 12.3);
eq("preset2 dec", po4.dec, 1);
eq("preset2 mono", po4.mono, false);
eq("preset2 font", po4.font, "Arial");
eq("preset2 style", po4.style, "Bold");
eq("preset2 ease", po4.ease, 3);

console.log("");
console.log("断言: " + passed + " 通过, " + failed + " 失败");
if (failed > 0) { process.exit(1); }
console.log("OK 全部通过");
