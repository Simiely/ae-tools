/* ============================================================
 * 面板模板的断言测试 —— 派生时改名为 test_<你的面板>.js
 *   node test_PanelTemplate.js
 *
 * 这份测试有两类断言, 【都要留着】:
 *   Ⅰ 业务断言      —— 你写的纯函数行为(派生后往里加)
 *   Ⅱ 骨架体检断言  —— 守住模板承载的架构约定(闸门位置 / safeRun 覆盖 / pinW 三处写 /
 *                      fixedBox 顺序 / 版本号三处一致)
 *   Ⅱ 类为什么比 Ⅰ 类还重要: 模板会被反复复制, 骨架一旦腐化(比如有人觉得
 *   safeRun 包裹"多余"去掉了), 复制出来的新面板就是错的, 而且要等到真机报错才发现。
 *   这两类断言都做过反向对照(故意改坏源码 → 必须变红), 不是"看着绿就算数"。
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "PanelTemplate.jsx");
var raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");

// 在 node 里载入 .jsx: 用 eval 而非 require ——
//   显式【不给 app 变量】, 让脚本走「测试导出闸门」分支(typeof app === "undefined")。
var module = { exports: {} };
var app;                       // 故意声明为 undefined
eval(raw);
var T = module.exports;

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

console.log("---------------------------------------------");
console.log("一、测试导出闸门与导出完整性");
console.log("---------------------------------------------");
ok("闸门生效: node 下能拿到导出对象", T && typeof T === "object");
eq("导出 VER 常量", typeof T.VER, "string");
eq("导出 clampNum", typeof T.clampNum, "function");
eq("导出 clampInt", typeof T.clampInt, "function");
eq("导出 exampleNormalize", typeof T.exampleNormalize, "function");
ok("导出 NAMES(图层/控件名单一真相)", T.NAMES && typeof T.NAMES === "object");
eq("NAMES.ctrl 有值", typeof T.NAMES.ctrl, "string");
ok("NAMES.slValue 有值", typeof T.NAMES.slValue === "string" && T.NAMES.slValue.length > 0);

console.log("---------------------------------------------");
console.log("二、纯逻辑层行为");
console.log("---------------------------------------------");
eq("clampNum 区间内原样返回", T.clampNum(50, 0, 100), 50);
eq("clampNum 下越界夹紧", T.clampNum(-10, 0, 100), 0);
eq("clampNum 上越界夹紧", T.clampNum(999, 0, 100), 100);
eq("clampNum NaN 回退下界", T.clampNum("abc", 0, 100), 0);
eq("clampNum 字符串数字可解析", T.clampNum("42", 0, 100), 42);
eq("clampInt 四舍五入", T.clampInt(3.6, 0, 10), 4);
eq("clampInt 后仍夹紧", T.clampInt(99.6, 0, 10), 10);
eq("exampleNormalize 中点", T.exampleNormalize(50, 0, 100), 0.5);
eq("exampleNormalize 下越界夹到 0", T.exampleNormalize(-5, 0, 100), 0);
eq("exampleNormalize 上越界夹到 1", T.exampleNormalize(500, 0, 100), 1);
eq("exampleNormalize 区间退化(hi<=lo)返回 0, 不产生 NaN/Infinity",
   T.exampleNormalize(50, 10, 10), 0);

console.log("---------------------------------------------");
console.log("三、骨架体检: 测试导出闸门的位置");
console.log("---------------------------------------------");
(function () {
    var srcR = raw;
    var gate = srcR.indexOf('if (typeof app === "undefined")');
    var firstPure = srcR.indexOf("function clampNum(");
    var aeStart = srcR.indexOf("var C_OK");
    ok("闸门存在", gate > 0);
    ok("闸门在【所有纯函数定义之后】(否则导出的是 undefined)", firstPure > 0 && gate > firstPure);
    ok("闸门在【任何 AE API 调用之前】(否则 node 下会先执行 AE 代码而崩)",
       aeStart > 0 && gate < aeStart);
    ok("闸门内有 return(让 node 路径到此为止, 不走 UI 代码)",
       /typeof app === "undefined"\)\s*\{[\s\S]{0,400}?return;/.test(srcR));
})();

console.log("---------------------------------------------");
console.log("四、骨架体检: safeRun 覆盖 与 UI 尺寸约定");
console.log("---------------------------------------------");
(function () {
    var srcR = raw;

    // safeRun: AE 的 ScriptUI handler 抛错是静默的, 每个 handler 都必须经它包裹
    var nHandler = (srcR.match(/\.onClick\s*=/g) || []).length;
    var nSafe = (srcR.match(/\.onClick\s*=\s*safeRun\(/g) || []).length;
    ok("存在 onClick handler", nHandler > 0);
    eq("所有 onClick 都经 safeRun 包裹", nSafe, nHandler);

    // pinW 必须三处都写 —— 只写 preferredSize 会因它是 volatile 而在首次布局丢失
    var mP = srcR.match(/function pinW\(ctrl, w\)\s*\{[\s\S]*?\n    \}/);
    ok("能找到 pinW 函数体", !!mP);
    if (mP) {
        var seg = mP[0];
        eq("pinW 写 preferredSize", seg.indexOf("ctrl.preferredSize = [w, -1]") >= 0, true);
        eq("pinW 写 minimumSize", seg.indexOf("ctrl.minimumSize = [w, 0]") >= 0, true);
        eq("pinW 写 maximumSize", seg.indexOf("ctrl.maximumSize = [w, 10000]") >= 0, true);
        eq("pinW 高度传 -1(自适应), 不读回旧高度",
           seg.indexOf("preferredSize.height") < 0, true);
    }

    // fixedBox 顺序体检: pinW 钉宽度【必须早于】设高度 —— 顺序反了会被静默覆盖
    //   ⚠️ 必须取【整个函数体】, 不能用固定字符窗口: 只加几行注释就会让窗口取不到 pinW,
    //      断言自己失效(本仓库真实踩过: 体检断言因"代码变长"而假红)。
    var mF = srcR.match(/function fixedBox\(parent, w, rows, text, readonly\)\s*\{[\s\S]*?\n    \}/);
    ok("能找到 fixedBox 函数体", !!mF);
    if (mF) {
        var seg2 = mF[0];
        var iP = seg2.indexOf("pinW(box, w)");
        var iH = seg2.indexOf("box.preferredSize = [w, h]");
        ok("fixedBox 里 pinW 早于设置高度(顺序反了会被静默覆盖)", iP >= 0 && iH >= 0 && iP < iH);
        ok("fixedBox 有 scrollable 存在性回退(某版本 AE 不认时不至于打不开面板)",
           /catch \(eScroll\)/.test(seg2));
    }
})();

console.log("---------------------------------------------");
console.log("五、骨架体检: 版本号单一真相(三处一致)");
console.log("---------------------------------------------");
(function () {
    var srcR = raw;

    // ① 常量 VER  ② CHANGELOG 顶部标题  ③ 面板顶部显示 —— 三处必须一致
    //   不一致的后果: 用户按版本号判断"AE 里跑的是不是最新版", 版本号本身不可信就全白费。
    var mVer = srcR.match(/var VER = "([0-9][0-9.]*)";/);
    ok("源码里声明了 VER 常量", !!mVer);
    if (mVer) {
        eq("T.VER 与源码 VER 一致", T.VER, mVer[1]);

        var clPath = path.join(__dirname, "CHANGELOG.md");
        ok("CHANGELOG.md 存在", fs.existsSync(clPath));
        if (fs.existsSync(clPath)) {
            var cl = fs.readFileSync(clPath, "utf8").replace(/^\uFEFF/, "");
            var mCl = cl.match(/^##\s*\[?v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/m);
            ok("CHANGELOG 顶部有版本标题", !!mCl);
            if (mCl) { eq("VER 与 CHANGELOG 顶部版本一致", T.VER, mCl[1]); }
        }

        eq("面板顶部常驻版本号标签(引用 VER 常量, 不硬编码)",
           srcR.indexOf('TOOL_TITLE + "   v" + VER') >= 0, true);
        eq("状态栏初始文案也带版本", srcR.indexOf('"就绪 · v" + VER') >= 0, true);
    }
})();

console.log("---------------------------------------------");
console.log("六、骨架体检: 写工程的三条铁律");
console.log("---------------------------------------------");
(function () {
    var srcR = raw;
    ok("有 Undo 组 beginUndoGroup", srcR.indexOf("app.beginUndoGroup(") >= 0);
    ok("Undo 组成对 endUndoGroup(在 finally 里, 异常也能收)", /finally\s*\{[\s\S]{0,200}endUndoGroup\(\)/.test(srcR));
    ok("「未激活合成」走状态栏 + 弹窗双提示(只写状态栏 = 用户以为没反应)",
       srcR.indexOf("needCompAlert()") >= 0 && srcR.indexOf("setStatus(pal,") >= 0);
    ok("复用既有图层而非重复创建(findLayer)", srcR.indexOf("function findLayer(") >= 0);
    ok("有诊断三件套(diag / flushDiag / 复制按钮)",
       srcR.indexOf("function diag(") >= 0 && srcR.indexOf("function flushDiag(") >= 0
       && srcR.indexOf("copyBoxToClipboard(") >= 0);
})();

console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("---------------------------------------------");
process.exit(failed ? 1 : 0);
