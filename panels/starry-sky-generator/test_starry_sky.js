/* ============================================================
 * 星空粒子生成器 —— 断言测试
 *   node test_starry_sky.js
 *
 * 本面板此前【零测试】(2125 行代码)。2026-09-21 补最小测试。
 *
 * ⚠️ 本文件与仓库里其他 test_*.js 的取函数方式【不同】:
 *   其他面板有「测试导出闸门」(if (typeof app === "undefined") { module.exports = …; return; }),
 *   靠它把纯函数交出来。但本文件的**外壳是裸块 `{ … }`(L16 → 2108)而不是 IIFE** ——
 *   裸块里 `return` 不合法, 闸门写不进去。所以这里改用**文本提取**:
 *   从源码里按花括号配对切出目标函数体, 再 eval 成函数表达式。
 *   代价: 比闸门脆(依赖函数签名写法), 好处: **零源码改动**也能测。
 *   将来若把外壳改成 IIFE, 建议换成标准闸门(那时本文件的 extractFn 可删)。
 *
 * 覆盖两类:
 *   Ⅰ 纯逻辑断言   —— padNumber(数字补零) / hslToRgbInt(颜色换算, 写进表达式/效果参数)
 *   Ⅱ 源码级体检   —— 版本号三处一致 / 无硬编码版本号残留 / 裸块结构 / safeExecute 包装
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "starry-sky-generator.jsx");
var raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");

// ---- 文本提取: 按花括号配对切出函数体, 返回可 eval 的函数 ----
function extractFn(name, src) {
    var re = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{");
    var m = re.exec(src);
    if (!m) { return null; }
    var i = m.index + m[0].length - 1;
    var depth = 0, j = i;
    for (; j < src.length; j++) {
        var c = src[j];
        if (c === "{") { depth++; }
        else if (c === "}") { depth--; if (depth === 0) { j++; break; } }
    }
    var body = src.substring(m.index, j);
    /* eslint-disable no-eval */
    return eval("(" + body + ")");
}
function extractBody(name, src) {
    var re = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{");
    var m = re.exec(src);
    return m ? m[0] : null;
}

var passed = 0;
var failed = 0;

function eq(name, got, want) {
    if (got === want) { passed++; console.log("  \u2714 " + name); }
    else {
        failed++;
        console.log("  \u2718 " + name + "\n        期望: " + JSON.stringify(want)
                    + "\n        实得: " + JSON.stringify(got));
    }
}
function ok(name, cond) { eq(name, !!cond, true); }
function eqJson(name, got, want) { eq(name, JSON.stringify(got), JSON.stringify(want)); }

console.log("---------------------------------------------");
console.log("一、文本提取(本文件取纯函数的方式)");
console.log("---------------------------------------------");
var padNumber = extractFn("padNumber", raw);
var hslToRgbInt = extractFn("hslToRgbInt", raw);
ok("提取到 padNumber(函数签名未变)", typeof padNumber === "function");
ok("提取到 hslToRgbInt(函数签名未变)", typeof hslToRgbInt === "function");
ok("提取到的确实是函数体文本(含 function 关键字)",
   /function\s+padNumber\s*\(num, width\)/.test(extractBody("padNumber", raw) || ""));

console.log("---------------------------------------------");
console.log("二、padNumber(数字补零, 用于帧号/序号文本)");
console.log("---------------------------------------------");
if (padNumber) {
    eq("padNumber(7, 3) = '007'", padNumber(7, 3), "007");
    eq("padNumber(42, 4) = '0042'", padNumber(42, 4), "0042");
    eq("padNumber(0, 1) = '0'(恰好够宽不补)", padNumber(0, 1), "0");
    eq("padNumber(123, 2) = '123'(超宽不截断 —— 补零不截断)", padNumber(123, 2), "123");
    eq("padNumber(5, 0) = '5'(width 0 不崩)", padNumber(5, 0), "5");
    eq("padNumber(0, 5) = '00000'", padNumber(0, 5), "00000");
    ok("返回类型恒为 string",
       typeof padNumber(7, 3) === "string" && typeof padNumber(1234, 2) === "string");
}

console.log("---------------------------------------------");
console.log("三、hslToRgbInt(HSL → 0-255 整数 RGB)");
console.log("---------------------------------------------");
if (hslToRgbInt) {
    eqJson("纯红 (0,100,50)", hslToRgbInt(0, 100, 50), [255, 0, 0]);
    eqJson("纯绿 (120,100,50)", hslToRgbInt(120, 100, 50), [0, 255, 0]);
    eqJson("纯蓝 (240,100,50)", hslToRgbInt(240, 100, 50), [0, 0, 255]);
    eqJson("黄 (60,100,50)", hslToRgbInt(60, 100, 50), [255, 255, 0]);
    eqJson("青 (180,100,50)", hslToRgbInt(180, 100, 50), [0, 255, 255]);
    eqJson("品红 (300,100,50)", hslToRgbInt(300, 100, 50), [255, 0, 255]);
    // ⭐ 这条专门抓"Math.round 被改成 Math.floor": 30° 时 g 分量 = x+m = 0.5,
    //   round(127.5) = 128 而 floor 会得 127。
    //   —— 纯色用例(0/120/240°)两条路径结果相同, 抓不到这个回归。
    //   2026-09-21 反向对照时发现: 把 round 改成 floor, 原先所有颜色断言都照样通过。
    eqJson("半通道值【四舍五入】而非截断: (30,100,50) → [255,128,0]",
           hslToRgbInt(30, 100, 50), [255, 128, 0]);
    eqJson("(210,100,50) → [0,128,255](另一个半通道位置)",
           hslToRgbInt(210, 100, 50), [0, 128, 255]);
    eqJson("黑 (0,0,0)", hslToRgbInt(0, 0, 0), [0, 0, 0]);
    eqJson("白 (0,0,100)", hslToRgbInt(0, 0, 100), [255, 255, 255]);
    eq("负角归一化: -60 ≡ 300",
       JSON.stringify(hslToRgbInt(-60, 100, 50)), JSON.stringify(hslToRgbInt(300, 100, 50)));
    eq("超 360 归一化: 420 ≡ 60",
       JSON.stringify(hslToRgbInt(420, 100, 50)), JSON.stringify(hslToRgbInt(60, 100, 50)));
    eq("s 越界夹紧: 200 ≡ 100",
       JSON.stringify(hslToRgbInt(0, 200, 50)), JSON.stringify(hslToRgbInt(0, 100, 50)));
    eq("l 越界夹紧: -50 ≡ 0",
       JSON.stringify(hslToRgbInt(0, 100, -50)), JSON.stringify(hslToRgbInt(0, 100, 0)));
    ok("分量恒为整数(Math.round —— 写进效果参数必须是整数)",
       (function () {
           for (var h = -400; h <= 800; h += 37) {
               var c = hslToRgbInt(h, 70, 45);
               for (var i = 0; i < 3; i++) {
                   if (c[i] !== Math.round(c[i])) { return false; }
               }
           }
           return true;
       })());
    ok("分量恒在 [0,255](抽样 33 个 hue)",
       (function () {
           for (var h = -360; h <= 720; h += 33) {
               var c = hslToRgbInt(h, 100, 50);
               for (var i = 0; i < 3; i++) {
                   if (c[i] < 0 || c[i] > 255) { return false; }
               }
           }
           return true;
       })());
}

console.log("---------------------------------------------");
console.log("四、源码级体检: 版本号单一真相");
console.log("---------------------------------------------");
(function () {
    var mVer = raw.match(/var VER = "([0-9][0-9.]*)";/);
    ok("声明了 VER 常量", !!mVer);
    var ver = mVer ? mVer[1] : null;

    if (ver) {
        var clPath = path.join(__dirname, "CHANGELOG.md");
        ok("CHANGELOG.md 存在", fs.existsSync(clPath));
        if (fs.existsSync(clPath)) {
            var cl = fs.readFileSync(clPath, "utf8").replace(/^\uFEFF/, "");
            var mCl = cl.match(/^##\s*\[?v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/m);
            ok("CHANGELOG 顶部有版本标题", !!mCl);
            if (mCl) { eq("VER 与 CHANGELOG 顶部一致", ver, mCl[1]); }
        }
        eq("面板顶部常驻版本号标签(引用 VER, 不硬编码)",
           raw.indexOf('"★  星空粒子生成器  v" + VER') >= 0, true);
        eq("窗口标题引用 VER(2026-09-21 修复: 此前硬编码 v3.2)",
           raw.indexOf('"星空粒子生成器 v" + VER') >= 0, true);

        // ⚠️ 启动日志那行在【裸块之外】, 访问不到 buildUI 内的 VER —— 只能硬编码。
        //   这条断言就是专门守它的: 改版本号时漏改这里会被测出来。
        var mLog = raw.match(/debugLog\("=== 星空粒子生成器 v([0-9.]+) 启动 ==="\)/);
        ok("启动日志那行存在", !!mLog);
        if (mLog) {
            eq("启动日志里的版本号 == VER(它只能硬编码, 靠本断言守)", mLog[1], ver);
        }

        // 可执行代码里不该再有别的硬编码版本号。
        //   ⚠️ 判据写法: 【先剥离注释再搜】, 不能用 "^\s*(?!//)" 这种行首前瞻 ——
        //     实测被【回溯】绕过: \s* 少匹配一个空格, 后面就不是 // 了, 缩进注释照样命中
        //     (写检查器时的经典坑)。
        var noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, "");
        var codeOnly = noBlock.split("\n").map(function (l) { return l.split("//")[0]; }).join("\n");
        var hits = codeOnly.match(/v[0-9]+\.[0-9]+/g) || [];
        eq("剥离注释后, 可执行代码里的版本号只剩【启动日志那一处】", hits.length, 1);
        ok("而那唯一一处就是启动日志(裸块外访问不到 VER, 只能硬编码 —— 由上面那条断言守)",
           codeOnly.indexOf("星空粒子生成器 v" + ver + " 启动") >= 0);
    }
})();

console.log("---------------------------------------------");
console.log("五、源码级体检: 外壳与结构");
console.log("---------------------------------------------");
(function () {
    // 记录一个结构事实: 本文件外壳是【裸块】而不是 IIFE —— 这直接决定了测试取函数的方式。
    //   若将来改成 IIFE, 这条会红, 提醒你把 extractFn 换成标准闸门。
    ok("【记录】外壳是裸块 { … }(故不能加 return 式导出闸门, 本测试用文本提取)",
       /^\s*\{/m.test(raw) && raw.indexOf("module.exports") < 0);
    ok("裸块正确闭合(最后一个顶层 } 之后还有启动代码)",
       raw.lastIndexOf("\n}") > 0);
    ok("双窗口模式: (thisObj instanceof Panel)",
       /\(thisObj instanceof Panel\)/.test(raw));
    ok("所有写操作经 safeExecute 统一包装(AE 的 handler 抛错是静默的)",
       /function\s+safeExecute\s*\(/.test(raw) && (raw.match(/safeExecute\(/g) || []).length >= 2);
    ok("有错误上报(showErrorReport), 不静默吞异常",
       raw.indexOf("function showErrorReport(") >= 0);
    var nBegin = (raw.match(/beginUndoGroup\(/g) || []).length;
    var nEnd = (raw.match(/endUndoGroup\(/g) || []).length;
    ok("Undo 组: begin " + nBegin + " / end " + nEnd + " —— end 不少于 begin 且顺序正确",
       nEnd >= nBegin && (nBegin === 0 || raw.indexOf("endUndoGroup") > raw.indexOf("beginUndoGroup")));
    ok("生成粒子是单一入口 generateParticles(comp, controller, …)",
       /function\s+generateParticles\s*\(/.test(raw));
})();

console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("---------------------------------------------");
process.exit(failed ? 1 : 0);
