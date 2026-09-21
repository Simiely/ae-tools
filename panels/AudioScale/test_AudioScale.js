/* ============================================================
 * AudioScale —— 断言测试
 *   node test_AudioScale.js
 *
 * 本面板此前【零测试】(291 行代码)。2026-09-21 补最小测试, 覆盖两类:
 *   Ⅰ 纯逻辑断言   —— 三个表达式生成器 / Both Channels 索引探测
 *   Ⅱ 源码级体检   —— 版本号三处一致 / VER 位置 / 闸门位置 / Undo 组配对
 *
 * ⭐ 为什么这个面板特别值得测"表达式文本":
 *   三个 build*Expr 产出的是**写进 AE 表达式的字符串** —— 一旦写错(拼错变量名、
 *   少个分号、索引写死), 报错只出现在 AE 的表达式错误提示里, 从脚本侧完全看不见,
 *   排查一次很贵。锁住文本就等于锁住了整条链路最容易出错的一环。
 *
 * ⚠️ 本文件不依赖 AE: 所有断言跑在 node 里, 靠源码中的「测试导出闸门」取函数。
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "AudioScale.jsx");
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

function mockAmpLayer(n) {
    return { property: function () { return { numProperties: n }; } };
}

console.log("---------------------------------------------");
console.log("一、测试导出闸门");
console.log("---------------------------------------------");
ok("闸门生效: node 下拿到导出对象", T && typeof T === "object");
eq("导出 VER", typeof T.VER, "string");
["buildBasicExpr", "buildSmoothExpr", "buildBandExpr", "findBothChannelsEffectIndex"]
    .forEach(function (nm) { eq("导出 " + nm, typeof T[nm], "function"); });
eq("导出模式常量 MODE_BASIC", T.MODE_BASIC, "基础振幅映射");
eq("导出模式常量 MODE_SMOOTH", T.MODE_SMOOTH, "平滑+阈值");
eq("导出模式常量 MODE_BAND", T.MODE_BAND, "频段分离");

console.log("---------------------------------------------");
console.log("二、findBothChannelsEffectIndex(跨语言探测)");
console.log("---------------------------------------------");
(function () {
    // 关键设计: 不靠效果显示名("Both Channels" / 中文版"双声道"), 靠固定顺序取第 3 个 ——
    //   所以这里锁的是"下标恒为 3", 不是"名字匹配"。
    eq("正常(numProperties=3) → 索引 3(不是字符串, 写进表达式要做数字下标)", T.findBothChannelsEffectIndex(mockAmpLayer(3)), 3);
    eq("效果不足 3 个 → 兜底 1", T.findBothChannelsEffectIndex(mockAmpLayer(2)), 1);
    eq("效果为 0 个 → 兜底 1", T.findBothChannelsEffectIndex(mockAmpLayer(0)), 1);
    eq("property 返回 null → 兜底 1", T.findBothChannelsEffectIndex({ property: function () { return null; } }), 1);
    eq("返回类型恒为 number(写进表达式文本前要做数字拼接)",
       typeof T.findBothChannelsEffectIndex(mockAmpLayer(3)), "number");
    // 契约记录: 本函数【不】做 ampLayer 自身的空值兜底 —— 调用方 getSelectedAudioLayer 已保证非空。
    //   写成"两种行为都可接受", 这样将来真加了兜底也不会被这条挡住。
    ok("ampLayer 无效时行为已定义(抛错 或 返回兜底值 1)",
       (function () {
           try { return T.findBothChannelsEffectIndex(null) === 1; }
           catch (e) { return true; }
       })());
})();

console.log("---------------------------------------------");
console.log("三、buildBasicExpr(基础振幅映射)");
console.log("---------------------------------------------");
(function () {
    var e = T.buildBasicExpr("音频", 3, { intensity: 5, baseScale: 100 });
    var lines = e.split("\n");
    eq("表达式行数 = 6", lines.length, 6);
    eq("第 1 行: 取音频图层的 Both Channels 幅度值",
       lines[0], 'amp=thisComp.layer("音频").effect(3)(1);');
    eq("第 2 行: 幅度 × 强度系数", lines[1], "s=amp*5;");
    eq("第 3 行: 保存原值到 v(value)", lines[2], "v=value;");
    eq("第 4 行: X 分量 = 基础缩放 + 增量", lines[3], "v[0]=100+s;");
    eq("第 5 行: Y 分量 = 基础缩放 + 增量", lines[4], "v[1]=100+s;");
    eq("第 6 行: 返回 v(必须回值, 否则表达式结果为空)", lines[5], "v");
    // ⚠️ 契约记录: 图层名是【原样直插】进双引号的, 不做转义 ——
    //   若图层名本身含双引号, 生成的表达式会语法错误。AE 图层名一般不含引号, 属已知边界。
    //   断言只钉"原样直插"这个事实, 不假装它是安全的。
    eq("图层名原样直插(不转义 —— 含引号会破坏表达式, 已知边界)",
       T.buildBasicExpr('A"B', 3, { intensity: 1, baseScale: 1 }).split("\n")[0],
       'amp=thisComp.layer("A"B").effect(3)(1);');
    ok("数值参数原样嵌入(intensity / baseScale 变化会改文本)",
       T.buildBasicExpr("a", 3, { intensity: 7, baseScale: 55 }).indexOf("s=amp*7;") >= 0
       && T.buildBasicExpr("a", 3, { intensity: 7, baseScale: 55 }).indexOf("v[0]=55+s;") >= 0);
})();

console.log("---------------------------------------------");
console.log("四、buildSmoothExpr(平滑+阈值)");
console.log("---------------------------------------------");
(function () {
    var e = T.buildSmoothExpr("音频", 3, { intensity: 5, baseScale: 100, smoothW: 0.2, threshold: 10 });
    var lines = e.split("\n");
    eq("表达式行数 = 8(比基础模式多平滑与阈值两行)", lines.length, 8);
    eq("第 1 行: 取幅度属性(变量名 ampP, 因为要调 .smooth())",
       lines[0], 'ampP=thisComp.layer("音频").effect(3)(1);');
    eq("第 2 行: 滑动平均平滑(窗口, 5 次采样)", lines[1], "a=ampP.smooth(0.2,5);");
    eq("第 3 行: 阈值以下归零(减阈值而非截断, 保留超出部分)",
       lines[2], "th=a>10?a-10:0;");
    eq("第 4 行: 阈值后幅度 × 强度", lines[3], "s=th*5;");
    eq("第 5 行: 保存原值", lines[4], "v=value;");
    eq("第 6/7 行: X/Y 分量", lines[5] + "|" + lines[6], "v[0]=100+s;|v[1]=100+s;");
    eq("第 8 行: 返回 v", lines[7], "v");
    ok("用了 ampP 而非 amp(改名是为了可读: P = Property)",
       e.indexOf("ampP=") >= 0 && e.indexOf("amp=") < 0);
})();

console.log("---------------------------------------------");
console.log("五、buildBandExpr(频段分离)");
console.log("---------------------------------------------");
(function () {
    var e = T.buildBandExpr("低频层", 3, { intensity: 5, baseScale: 100 });
    var lines = e.split("\n");
    eq("表达式行数 = 6", lines.length, 6);
    eq("第 1 行: 图层名原样嵌入(频段差异体现在传入哪个 ampLayer)",
       lines[0], 'amp=thisComp.layer("低频层").effect(3)(1);');
    eq("末行返回 v", lines[5], "v");

    // ⚠️ 记录一个事实(不是 bug): 频段分离目前与基础振幅生成的表达式【完全相同】——
    //   两者的差异只在【调用方传哪个 ampLayer 的 name】(applyAudioScale vs applyBand),
    //   不在表达式结构本身。这条断言把这个"刻意相同"钉住;
    //   若将来刻意分化两者, 请同步更新此断言。
    var b = T.buildBasicExpr("低频层", 3, { intensity: 5, baseScale: 100 });
    eq("【记录】频段分离与基础振幅目前生成相同表达式(刻意相同, 见注释)",
       e, b);
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
           raw.indexOf('"AudioScale  v" + VER') >= 0, true);
        // VER 必须在 IIFE 顶层 —— 藏在 buildUI 内部时, 测试导出闸门引用不到它。
        var iVer = raw.indexOf("var VER =");
        var iBuildUI = raw.indexOf("function buildUI(");
        ok("VER 声明在 buildUI 之外(否则闸门引用不到, 单一真相也不该藏在函数里)",
           iVer > 0 && iBuildUI > 0 && iVer < iBuildUI);
    }
})();

console.log("---------------------------------------------");
console.log("七、源码级体检: 闸门位置与外壳");
console.log("---------------------------------------------");
(function () {
    var gate = raw.indexOf('if (typeof app === "undefined")');
    var firstUI = raw.indexOf("var ui = buildUI(thisObj);");
    ok("闸门存在", gate > 0);
    ok("闸门在【调用 buildUI 之前】(否则 node 下 new Window / Panel 未定义直接抛错)",
       firstUI > 0 && gate < firstUI);
    ok("闸门内有 return(node 路径到此为止)",
       /typeof app === "undefined"\)\s*\{[\s\S]{0,800}?return;/.test(raw));
    ok("文件外壳是 IIFE(return 才合法)", /^\s*\(function\s+AudioScaleUI\s*\(thisObj\)\s*\{/m.test(raw));
})();

console.log("---------------------------------------------");
console.log("八、源码级体检: 工程写入约定");
console.log("---------------------------------------------");
(function () {
    // ⚠️ 判据不是"数量相等": 正常路径 + catch 兜底各调一次 end 是好写法。
    //   实测本文件 begin 1 处(L80) / end 2 处(L82 正常 + L84 catch 兜底)。
    var nBegin = (raw.match(/beginUndoGroup\(/g) || []).length;
    var nEnd = (raw.match(/endUndoGroup\(/g) || []).length;
    ok("有 Undo 组 begin", nBegin > 0);
    ok("end 不少于 begin(允许 catch 里补兜底)", nEnd >= nBegin);
    ok("第一个 end 出现在第一个 begin 之后",
       raw.indexOf("endUndoGroup") > raw.indexOf("beginUndoGroup"));
    ok("双窗口模式: (thisObj instanceof Panel) ? thisObj : new Window(...)",
       /\(thisObj instanceof Panel\)/.test(raw));
    ok("未激活合成 / 未选中音频图层时 alert 提示(不静默失败)",
       (raw.match(/alert\(/g) || []).length >= 3);
})();

console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("---------------------------------------------");
process.exit(failed ? 1 : 0);
