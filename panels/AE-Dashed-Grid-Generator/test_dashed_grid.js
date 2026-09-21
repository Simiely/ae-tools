/* ============================================================
 * 虚线网格生成器 AE_dashed_grid_shared-edge —— 断言测试
 *   node test_dashed_grid.js
 *
 * 本面板此前【零测试】(261 行代码)。2026-09-21 补最小测试。
 *
 * ⚠️ 说清楚这份测试【能】与【不能】做什么 —— 不假装它覆盖了业务:
 *   ✔ 能: 守住结构约定(版本号单一真相 / 错误处理不静默 / 参数兜底写法 / 双窗口模式)
 *   ✘ 不能: 验证网格真的画对了 —— 本面板只有 3 个函数(buildGrid / setStatus / showDebugError),
 *     逻辑全在 UI 回调里且强依赖 app/CompItem, node 里没有可导出的纯函数。
 *     要测业务得先把"参数解析 + 虚线几何"抽成纯函数 —— 那是重构, 不在本轮范围。
 *   所以这份测试的价值是: **以后改动不会悄悄破坏结构**, 而不是"网格一定正确"。
 *
 * 为什么不用「测试导出闸门」: 本文件没有任何可导出的纯函数(见上), 闸门无从谈起。
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "AE_dashed_grid_shared-edge.jsx");
var raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");

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

function count(re) { return (raw.match(re) || []).length; }

console.log("---------------------------------------------");
console.log("一、源码级体检: 版本号单一真相");
console.log("---------------------------------------------");
(function () {
    var mVer = raw.match(/var VER = "([0-9][0-9.]*)";/);
    ok("声明了 VER 常量", !!mVer);
    if (mVer) {
        var ver = mVer[1];
        var clPath = path.join(__dirname, "CHANGELOG.md");
        ok("CHANGELOG.md 存在", fs.existsSync(clPath));
        if (fs.existsSync(clPath)) {
            var cl = fs.readFileSync(clPath, "utf8").replace(/^\uFEFF/, "");
            var mCl = cl.match(/^##\s*\[?v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/m);
            ok("CHANGELOG 顶部有版本标题", !!mCl);
            if (mCl) { eq("VER 与 CHANGELOG 顶部一致", ver, mCl[1]); }
        }
        eq("面板顶部常驻版本号标签(引用 VER, 不硬编码)",
           raw.indexOf('"虚线网格生成器  v" + VER') >= 0, true);

        // 可执行代码里不该有其他硬编码版本号(先剥离注释再搜 —— 不能用行首前瞻正则,
        //   `^\s*(?!//)` 会被回溯绕过: \s* 少匹配一个空格后面就不是 // 了)。
        var noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, "");
        var codeOnly = noBlock.split("\n").map(function (l) { return l.split("//")[0]; }).join("\n");
        var hits = codeOnly.match(/v[0-9]+\.[0-9]+/g) || [];
        eq("可执行代码里无硬编码版本号残留", hits.length, 0);

        // VER 必须在 IIFE 顶层 —— 判据不能是"在第一个函数定义之前"
        //   (本文件 VER 在 L190, 而第一个函数在 L19: 顺序上在后, 但依然是顶层)。
        //   真正能判断"在不在函数里"的是【缩进】: IIFE 顶层 = 4 空格, 函数内 ≥ 8。
        var verLine = raw.split("\n").filter(function (l) { return /var VER =/.test(l); })[0] || "";
        eq("VER 行缩进为 4(在 IIFE 顶层, 没被包进任何函数)",(verLine.match(/^\s*/) || [""])[0].length, 4);
        var iVer = raw.indexOf("var VER =");
        ok("VER 声明在 var pal 之前(版本标签才能引用它)",
           iVer > 0 && iVer < raw.indexOf("var pal = (thisObj instanceof Panel)"));
    }
})();

console.log("---------------------------------------------");
console.log("二、源码级体检: 外壳与双窗口");
console.log("---------------------------------------------");
(function () {
    ok("文件外壳是 IIFE(单文件交付, 不污染全局)", /^\s*\(function\s*\(thisObj\)\s*\{/m.test(raw));
    eq("IIFE 以 })(this); 收尾", /^\}\)\(this\);\s*$/m.test(raw), true);
    ok("双窗口模式: (thisObj instanceof Panel) ? thisObj : new Window(...) —— 否则从",
       /\(thisObj instanceof Panel\)\s*\?\s*thisObj/.test(raw));
    ok("独立运行时会 show(), 停靠时走 layout(true)(两种宿主都处理)",
       /pal instanceof Window\)\s*\{\s*pal\.center\(\);\s*pal\.show\(\);\s*\}/.test(raw)
       && /pal\.layout\.layout\(true\)/.test(raw));
    ok("每个输入框都设了 characters(宽度不被内容撑开的第一道防线)",
       count(/\.characters = /g) >= 5);
})();

console.log("---------------------------------------------");
console.log("三、源码级体检: 错误处理不静默");
console.log("---------------------------------------------");
(function () {
    ok("有专门的错误对话框 showDebugError(文字可复制)",
       /function\s+showDebugError\s*\(/.test(raw));
    ok("buildGrid 整体包在 try/catch 里(AE 的 handler 抛错是静默的)",
       /function\s+buildGrid\s*\(pal\)\s*\{[\s\S]{0,80}?try\s*\{/.test(raw));
    ok("catch 里把错误交给 showDebugError(不是吞掉)",
       /catch\s*\([^)]*\)\s*\{[\s\S]{0,200}?showDebugError\(/.test(raw));
    ok("未激活合成时给用户明确提示(不留'点了没反应'的空白)",
       /请先双击打开一个合成/.test(raw) && /setStatus\(pal,/.test(raw));
    ok("setStatus 的分支覆盖成功与失败两种颜色",
       count(/setStatus\(pal, /g) >= 2);
})();

console.log("---------------------------------------------");
console.log("四、源码级体检: 数值输入的兜底写法");
console.log("---------------------------------------------");
(function () {
    // 关键约定: 输入框可能是空的 / 非数字 —— 必须 `parseXxx(...) || 默认值` 兜底,
    //   否则 NaN 一路传到图层参数, 报错很难回溯。这是本面板唯一的"可断言逻辑约定"。
    var cols = /Math\.max\(1, parseInt\(pal\.cols\.text, 10\) \|\| 2\)/.test(raw);
    var rows = /Math\.max\(1, parseInt\(pal\.rows\.text, 10\) \|\| 2\)/.test(raw);
    var gw = /parseFloat\(pal\.gw\.text\) \|\| 900/.test(raw);
    var gh = /parseFloat\(pal\.gh\.text\) \|\| 600/.test(raw);
    var sw = /parseFloat\(pal\.sw\.text\) \|\| 3/.test(raw);
    ok("列数兜底: Math.max(1, parseInt(...) || 2)", cols);
    ok("行数兜底: Math.max(1, parseInt(...) || 2)", rows);
    ok("网格宽兜底: parseFloat(...) || 900", gw);
    ok("网格高兜底: parseFloat(...) || 600", gh);
    ok("线宽兜底: parseFloat(...) || 3", sw);
    ok("行列数下限被 Math.max(1, ...) 保护(不会出现 0 行 0 列)",
       count(/Math\.max\(1, parseInt\(/g) >= 2);
})();

console.log("---------------------------------------------");
console.log("五、源码级体检: 功能入口");
console.log("---------------------------------------------");
(function () {
    ok("有生成按钮并绑定到 buildGrid",
       /btn\.onClick\s*=\s*function\s*\(\)\s*\{\s*buildGrid\(pal\);\s*\}/.test(raw));
    ok("状态栏是 multiline(多行文本才自动换行 —— 单行 statictext 会截断)",
       /\{\s*multiline:\s*true\s*\}/.test(raw));
    ok("产物在单一入口内创建(便于后续加 Undo 组)",
       /function\s+buildGrid\s*\(pal\)/.test(raw));
})();

console.log("---------------------------------------------");
console.log("六、已知债务记录(本次【不修】, 只钉住不恶化)");
console.log("---------------------------------------------");
(function () {
    // ⚠️ 债务: setStatus 里调了 layout.resize()。
    //   它会在状态栏文本变长时按【新的首选宽度】重排, 把面板撑宽 ——
    //   MountainSpectrum v1.1.1 踩过同一坑, 修法是"删掉该调用"(宽度已在建控件时固定)。
    //   本面板状态栏固定 300px, 风险较低, 但模式与其他面板不一致。
    //   断言写成"不超过 1 处": 现在通过, 将来删掉也通过 —— 不阻碍修复。
    var nResize = count(/layout\.resize\(\)/g);
    ok("【记录】layout.resize() 调用 " + nResize + " 处(建议删除, 不超过 1 处)", nResize <= 1);

    // ⚠️ 债务: 本面板【没有】Undo 组 —— 生成失败/误操作无法整体 Ctrl+Z。
    //   同样写成条件式, 将来补上不会被挡。
    var nBegin = count(/beginUndoGroup\(/g);
    var nEnd = count(/endUndoGroup\(/g);
    ok("【记录】Undo 组: begin " + nBegin + " / end " + nEnd + " (当前无 Undo 组)",
       nEnd >= nBegin);
})();

console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("---------------------------------------------");
process.exit(failed ? 1 : 0);
