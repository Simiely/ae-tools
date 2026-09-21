/* ============================================================
 * 歌词逐字散落动画工具 —— 断言测试
 *   node test_lyrics_animator.js
 *
 * 本面板此前【零测试】(1185 行代码)。2026-09-21 补最小测试, 覆盖两类:
 *   Ⅰ 纯逻辑断言   —— getDirectionPos(方向→偏移向量) / buildScatterFadeExpr(表达式文本)
 *   Ⅱ 源码级体检   —— 版本号三处一致 / 闸门位置 / 双窗口模式 / DEFAULTS 完整性
 *
 * ⚠️ 已知债务(2026-09-21 审计发现, 本次【不修】, 只记录):
 *   本面板全文件【没有】app.beginUndoGroup —— AE 默认会把每个操作记为独立 undo 步骤,
 *   用户撤销一次"应用动画"要按很多次 Ctrl+Z。对应的断言写成【条件式】
 *   ("若存在则必须配对"), 这样将来补上 Undo 组不会被测试挡住。
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "歌词逐字散落动画工具.jsx");
var raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");

var module = { exports: {} };
var app;
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
function eqJson(name, got, want) { eq(name, JSON.stringify(got), JSON.stringify(want)); }

console.log("---------------------------------------------");
console.log("一、测试导出闸门");
console.log("---------------------------------------------");
ok("闸门生效: node 下拿到导出对象", T && typeof T === "object");
eq("导出 VER", typeof T.VER, "string");
eq("导出 getDirectionPos", typeof T.getDirectionPos, "function");
eq("导出 buildScatterFadeExpr", typeof T.buildScatterFadeExpr, "function");

console.log("---------------------------------------------");
console.log("二、getDirectionPos: 2D 四方向(穷举)");
console.log("---------------------------------------------");
eqJson("方向 1 从右到左 → +X", T.getDirectionPos(80, 1, false, false), [80, 0]);
eqJson("方向 2 从上到下 → -Y", T.getDirectionPos(80, 2, false, false), [0, -80]);
eqJson("方向 3 从下到上 → +Y", T.getDirectionPos(80, 3, false, false), [0, 80]);
eqJson("方向 0 从左到右 → -X", T.getDirectionPos(80, 0, false, false), [-80, 0]);
eqJson("未知方向(99) 落默认分支 → -X", T.getDirectionPos(80, 99, false, false), [-80, 0]);
eqJson("偏移 0 → 两轴都 0", T.getDirectionPos(0, 1, false, false), [0, 0]);
eq("2D 返回值长度恒为 2(穷举 4 方向 + 未知)",
   (function () {
       var dirs = [0, 1, 2, 3, 7, -1];
       for (var i = 0; i < dirs.length; i++) {
           if (T.getDirectionPos(10, dirs[i], false, false).length !== 2) { return "方向 " + dirs[i]; }
       }
       return "ok";
   })(), "ok");

console.log("---------------------------------------------");
console.log("三、getDirectionPos: 3D 四方向(穷举)");
console.log("---------------------------------------------");
eqJson("3D 方向 1 → [+X,0,0]", T.getDirectionPos(80, 1, true, false), [80, 0, 0]);
eqJson("3D 方向 2 → [0,-Y,0]", T.getDirectionPos(80, 2, true, false), [0, -80, 0]);
eqJson("3D 方向 3 → [0,+Y,0]", T.getDirectionPos(80, 3, true, false), [0, 80, 0]);
eqJson("3D 方向 0 → [-X,0,0]", T.getDirectionPos(80, 0, true, false), [-80, 0, 0]);
eq("3D 返回值长度恒为 3",
   (function () {
       var dirs = [0, 1, 2, 3, 7];
       for (var i = 0; i < dirs.length; i++) {
           if (T.getDirectionPos(10, dirs[i], true, false).length !== 3) { return "方向 " + dirs[i]; }
       }
       return "ok";
   })(), "ok");

console.log("---------------------------------------------");
console.log("四、getDirectionPos: isExit 恰好取反");
console.log("---------------------------------------------");
ok("isExit=true 时全部方向取反(2D+3D 穷举)",
   (function () {
       var dirs = [0, 1, 2, 3];
       for (var d = 0; d < dirs.length; d++) {
           for (var k = 0; k < 2; k++) {
               var is3D = (k === 1);
               var entry = T.getDirectionPos(80, dirs[d], is3D, false);
               var exit = T.getDirectionPos(80, dirs[d], is3D, true);
               for (var i = 0; i < entry.length; i++) {
                   if (exit[i] !== -entry[i]) { return "d=" + dirs[d] + " is3D=" + is3D + " 轴" + i; }
               }
           }
       }
       return "ok";
   })(), "ok");
eqJson("进入 + 退出 的偏移互为相反数(单例核对)",
   [T.getDirectionPos(80, 1, false, false)[0], T.getDirectionPos(80, 1, false, true)[0]],
   [80, -80]);

console.log("---------------------------------------------");
console.log("五、buildScatterFadeExpr: 表达式文本");
console.log("---------------------------------------------");
(function () {
    var e = T.buildScatterFadeExpr(1, 2, 0, 2, 1);
    ok("含确定性随机种子 seedRandom(seed + ci, true)",
       e.indexOf("seedRandom(1 + 2, true);") >= 0);
    ok("含局部时间 t = time - startTime",
       e.indexOf("t = time - 0.000;") >= 0);
    ok("含淡入 linear(t, scatterStart, scatterStart+scatterTrans, 0, 1)",
       e.indexOf("fade = linear(t, 2.000, 3.000, 0, 1);") >= 0);
    eq("三段以 \\n 分隔", e.split("\n").length, 4);   // 3 行 + 结尾空段
    ok("数值固定 3 位小数(toFixed(3) 契约)",
       (function () {
           var e2 = T.buildScatterFadeExpr(7, 19, 1.234567, 2.5, 0.25);
           return e2.indexOf("1.235") >= 0 && e2.indexOf("2.750") >= 0;
       })());
    ok("ci 极值不影响结构(ci=0 与 ci=999 都含完整三段)",
       (function () {
           var a = T.buildScatterFadeExpr(1, 0, 0, 1, 1);
           var b = T.buildScatterFadeExpr(1, 999, 0, 1, 1);
           return a.indexOf("seedRandom(1 + 0, true);") >= 0
               && b.indexOf("seedRandom(1 + 999, true);") >= 0
               && a.split("\n").length === b.split("\n").length;
       })());
})();

console.log("---------------------------------------------");
console.log("六、源码级体检: 版本号单一真相");
console.log("---------------------------------------------");
(function () {
    var mVer = raw.match(/var VER = "([0-9][0-9.]*)";/);
    ok("声明了 VER 常量", !!mVer);
    if (mVer) {
        eq("T.VER 与源码 VER 一致", T.VER, mVer[1]);
        var clPath = path.join(__dirname, "CHANGELOG.md");
        ok("CHANGELOG.md 存在", fs.existsSync(clPath));
        if (fs.existsSync(clPath)) {
            var cl = fs.readFileSync(clPath, "utf8").replace(/^\uFEFF/, "");
            var mCl = cl.match(/^##\s*\[?v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/m);
            ok("CHANGELOG 顶部有版本标题", !!mCl);
            if (mCl) { eq("VER 与 CHANGELOG 顶部一致", T.VER, mCl[1]); }
        }
        eq("面板顶部常驻版本号标签(引用 VER, 不硬编码)",
           raw.indexOf('"歌词逐字散落动画工具  v" + VER') >= 0, true);
    }
})();

console.log("---------------------------------------------");
console.log("七、源码级体检: 闸门位置与外壳");
console.log("---------------------------------------------");
(function () {
    var gate = raw.indexOf('if (typeof app === "undefined")');
    var firstUI = raw.indexOf("var pal = (thisObj instanceof Panel)");
    ok("闸门存在", gate > 0);
    ok("闸门在【第一行 UI 代码之前】(否则 node 下 Window/Panel 未定义直接抛错)",
       firstUI > 0 && gate < firstUI);
    ok("闸门内有 return(node 路径到此为止)",
       /typeof app === "undefined"\)\s*\{[\s\S]{0,700}?return;/.test(raw));
    ok("文件外壳是 IIFE(return 才合法)", /^\s*\(function\s*\(thisObj\)\s*\{/m.test(raw));
})();

console.log("---------------------------------------------");
console.log("八、源码级体检: 结构约定与已知债务");
console.log("---------------------------------------------");
(function () {
    ok("双窗口模式: (thisObj instanceof Panel) ? thisObj : new Window(...)",
       /\(thisObj instanceof Panel\)\s*\?\s*thisObj/.test(raw));
    ok("DEFAULTS 集中默认值表存在(不是散落的字面量)",
       /var DEFAULTS = \{/.test(raw));
    ok("DEFAULTS 含散落动画关键项(seed / scatterStart / scatterTrans)",
       /seed:/.test(raw) && /scatterStart:/.test(raw) && /scatterTrans:/.test(raw));

    // ⚠️ 已知债务: 本面板【没有】beginUndoGroup(2026-09-21 审计发现, 本次不修)。
    //   这里只做【条件式】断言: 将来补上 Undo 组时, 配对关系要守住;
    //   不写成 "nBegin === 0", 否则将来的修复反而会被测试挡住。
    var nBegin = (raw.match(/beginUndoGroup\(/g) || []).length;
    var nEnd = (raw.match(/endUndoGroup\(/g) || []).length;
    ok("Undo 组若存在则 end >= begin(当前 begin=" + nBegin + " → 债务: 无 Undo 组, 撤销需多次 Ctrl+Z)",
       nEnd >= nBegin);
})();

console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("---------------------------------------------");
process.exit(failed ? 1 : 0);
