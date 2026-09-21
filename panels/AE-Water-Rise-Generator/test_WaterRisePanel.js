/* ============================================================
 * 水面波动生成器 WaterRisePanel —— 断言测试
 *   node test_WaterRisePanel.js
 *
 * 本面板此前【零测试】(1044 行代码)。2026-09-21 补最小测试, 覆盖两类:
 *   Ⅰ 纯逻辑断言   —— 颜色换算 / JSON 序列化(靠源码里的「测试导出闸门」导出)
 *   Ⅱ 源码级体检   —— 版本号三处一致 / 闸门位置 / 双窗口模式 / Undo 组配对
 *
 * ⚠️ 为什么必须有 Ⅱ 类: 本面板 1044 行里只有 7 个纯函数, 业务主体(建图层/写表达式)
 *   在 node 里测不了 —— 那种部分只能靠"结构约定"兜底。
 *   两类断言都做过反向对照(故意改坏源码 → 必须变红)。
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "WaterRisePanel.jsx");
var raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");

// 在 node 里载入 .jsx: 显式【不给 app 变量】, 让脚本走「测试导出闸门」分支。
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
// 数组 / 对象比较: 序列化后比
function eqJson(name, got, want) { eq(name, JSON.stringify(got), JSON.stringify(want)); }
// 浮点近似比较(颜色分量是浮点)
function nearArr(name, got, want, eps) {
    eps = eps || 1e-9;
    var bad = !got || got.length !== want.length;
    if (!bad) {
        for (var i = 0; i < want.length; i++) {
            if (Math.abs(got[i] - want[i]) > eps) { bad = true; break; }
        }
    }
    var detail = bad ? (JSON.stringify(got) + " vs " + JSON.stringify(want)) : "ok";
    eq(name + (bad ? "  (" + detail + ")" : ""), bad ? false : true, true);
}

console.log("---------------------------------------------");
console.log("一、测试导出闸门");
console.log("---------------------------------------------");
ok("闸门生效: node 下拿到导出对象", T && typeof T === "object");
eq("导出 VER", typeof T.VER, "string");
["hslToRgb01", "rgb01ToHsl", "hexToRgb01", "rgb01ToHex", "quote", "jsonStringify", "jsonParse"]
    .forEach(function (nm) { eq("导出 " + nm, typeof T[nm], "function"); });

console.log("---------------------------------------------");
console.log("二、HSL → RGB");
console.log("---------------------------------------------");
nearArr("纯红 h=0", T.hslToRgb01(0, 100, 50), [1, 0, 0]);
nearArr("纯绿 h=120", T.hslToRgb01(120, 100, 50), [0, 1, 0]);
nearArr("纯蓝 h=240", T.hslToRgb01(240, 100, 50), [0, 0, 1]);
nearArr("青色 h=180", T.hslToRgb01(180, 100, 50), [0, 1, 1]);
nearArr("品红 h=300", T.hslToRgb01(300, 100, 50), [1, 0, 1]);
nearArr("黑色 l=0", T.hslToRgb01(0, 0, 0), [0, 0, 0]);
nearArr("白色 l=100", T.hslToRgb01(0, 0, 100), [1, 1, 1]);
nearArr("中灰 l=50 s=0", T.hslToRgb01(0, 0, 50), [0.5, 0.5, 0.5]);
eq("负角度归一化: -60 ≡ 300", JSON.stringify(T.hslToRgb01(-60, 100, 50)),
   JSON.stringify(T.hslToRgb01(300, 100, 50)));
eq("超 360 归一化: 420 ≡ 60", JSON.stringify(T.hslToRgb01(420, 100, 50)),
   JSON.stringify(T.hslToRgb01(60, 100, 50)));
eq("s 越界被夹紧: s=200 ≡ s=100", JSON.stringify(T.hslToRgb01(0, 200, 50)),
   JSON.stringify(T.hslToRgb01(0, 100, 50)));
eq("l 越界被夹紧: l=-50 ≡ l=0", JSON.stringify(T.hslToRgb01(0, 100, -50)),
   JSON.stringify(T.hslToRgb01(0, 100, 0)));
ok("输出分量恒在 [0,1](抽样 71 个 hue)",
   (function () {
       for (var h = -360; h <= 720; h += 15) {
           var c = T.hslToRgb01(h, 100, 50);
           for (var i = 0; i < 3; i++) {
               if (c[i] < -1e-9 || c[i] > 1 + 1e-9) { return false; }
           }
       }
       return true;
   })());

console.log("---------------------------------------------");
console.log("三、RGB → HSL");
console.log("---------------------------------------------");
eqJson("纯红", T.rgb01ToHsl(1, 0, 0), [0, 100, 50]);
eqJson("纯绿", T.rgb01ToHsl(0, 1, 0), [120, 100, 50]);
eqJson("纯蓝", T.rgb01ToHsl(0, 0, 1), [240, 100, 50]);
eqJson("黑", T.rgb01ToHsl(0, 0, 0), [0, 0, 0]);
eqJson("白", T.rgb01ToHsl(1, 1, 1), [0, 0, 100]);
eqJson("中灰 s=0", T.rgb01ToHsl(0.5, 0.5, 0.5), [0, 0, 50]);
// ⚠️ 容差不能拍脑袋: rgb01ToHsl 的输出是【取整后】的整数 HSL(h 度 / s%,l%),
//   所以往返必然有量化损失。2026-09-21 实测: 纯色误差 0, 一般颜色最大 1.53/255。
//   断言按实测真值写 —— 纯色要求精确, 一般色给 2/255 余量。
//   (初版写的是"一律 <= 1/255", 结果被实测打红 —— 那是判据错, 不是代码错。)
ok("往返精确: 纯色(红/绿/蓝/黑/白/灰) rgb→hsl→rgb 零误差",
   (function () {
       var solids = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0], [1, 1, 1], [0.5, 0.5, 0.5]];
       for (var i = 0; i < solids.length; i++) {
           var c = solids[i];
           var hsl = T.rgb01ToHsl(c[0], c[1], c[2]);
           var back = T.hslToRgb01(hsl[0], hsl[1], hsl[2]);
           for (var j = 0; j < 3; j++) { if (back[j] !== c[j]) { return false; } }
       }
       return true;
   })());
ok("往返稳定: 一般颜色误差 <= 2/255(实测最大 1.53, 余量含 hsl 取整)",
   (function () {
       var cases = [[0.2, 0.6, 0.9], [0.13, 0.87, 0.42], [0.7, 0.2, 0.35]];
       for (var i = 0; i < cases.length; i++) {
           var c = cases[i];
           var hsl = T.rgb01ToHsl(c[0], c[1], c[2]);
           var back = T.hslToRgb01(hsl[0], hsl[1], hsl[2]);
           for (var j = 0; j < 3; j++) {
               if (Math.abs(back[j] - c[j]) > 2 / 255) { return false; }
           }
       }
       return true;
   })());

console.log("---------------------------------------------");
console.log("四、十六进制互转");
console.log("---------------------------------------------");
nearArr("hexToRgb01 'FF0000'", T.hexToRgb01("FF0000"), [1, 0, 0]);
nearArr("hexToRgb01 带 # 前缀", T.hexToRgb01("#FF0000"), [1, 0, 0]);
nearArr("hexToRgb01 带空格 / 小写", T.hexToRgb01("#ff 00 00"), [1, 0, 0]);
nearArr("hexToRgb01 'FFFFFF'", T.hexToRgb01("FFFFFF"), [1, 1, 1]);
eq("hexToRgb01 长度不足 6 → null", T.hexToRgb01("FFF"), null);
eq("hexToRgb01 长度超过 6 → null", T.hexToRgb01("FF0000FF"), null);
eq("hexToRgb01 非法字符 → null", T.hexToRgb01("GGGGGG"), null);
eq("hexToRgb01 空串 → null", T.hexToRgb01(""), null);
eq("rgb01ToHex [1,0,0]", T.rgb01ToHex([1, 0, 0]), "FF0000");
eq("rgb01ToHex [0,0,0]", T.rgb01ToHex([0, 0, 0]), "000000");
eq("rgb01ToHex [1,1,1]", T.rgb01ToHex([1, 1, 1]), "FFFFFF");
eq("rgb01ToHex [0.5,0.5,0.5] = 808080", T.rgb01ToHex([0.5, 0.5, 0.5]), "808080");
eq("rgb01ToHex 每分量恒 2 位(抽样)",
   (function () {
       for (var v = 0; v <= 1.0001; v += 0.037) {
           var hx = T.rgb01ToHex([v, v, v]);
           if (hx.length !== 6) { return "长度 " + hx.length + " @ v=" + v; }
       }
       return "ok";
   })(), "ok");
eq("往返: hex → rgb → hex 无损(抽样)",
   (function () {
       var hexes = ["000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "1A2B3C", "808080"];
       for (var i = 0; i < hexes.length; i++) {
           if (T.rgb01ToHex(T.hexToRgb01(hexes[i])) !== hexes[i]) { return hexes[i]; }
       }
       return "ok";
   })(), "ok");

console.log("---------------------------------------------");
console.log("五、JSON polyfill(ExtendScript 没有原生 JSON)");
console.log("---------------------------------------------");
eq("quote 普通串", T.quote("abc"), '"abc"');
eq("quote 转义双引号", T.quote('a"b'), '"a\\"b"');
eq("quote 转义反斜杠", T.quote("a\\b"), '"a\\\\b"');
eq("jsonStringify null", T.jsonStringify(null), "null");
eq("jsonStringify 数字", T.jsonStringify(42), "42");
eq("jsonStringify 布尔", T.jsonStringify(true), "true");
eq("jsonStringify 字符串", T.jsonStringify("hi"), '"hi"');
eq("jsonStringify undefined → null", T.jsonStringify(undefined), "null");
eq("jsonStringify 数组", T.jsonStringify([1, 2, 3]), "[1,2,3]");
eq("jsonStringify 嵌套数组", T.jsonStringify([[1], [2]]), "[[1],[2]]");
eq("jsonStringify 单键对象", T.jsonStringify({ a: 1 }), '{"a":1}');
eq("jsonStringify 嵌套对象", T.jsonStringify({ a: { b: 2 } }), '{"a":{"b":2}}');
eq("jsonStringify 预设形态(本面板真实数据形状)",
   T.jsonStringify({ bodyColor: "#3399FF", amp: 40, on: true } ),
   '{"bodyColor":"#3399FF","amp":40,"on":true}');
eq("jsonParse ↔ jsonStringify 往返",
   (function () {
       var o = { a: 1, b: "x", c: [1, 2], d: { e: true } };
       return T.jsonStringify(T.jsonParse(T.jsonStringify(o)));
   })(),
   '{"a":1,"b":"x","c":[1,2],"d":{"e":true}}');
eq("jsonParse('null') → null", T.jsonParse("null"), null);
eq("jsonParse('[1,2]') 长度", T.jsonParse("[1,2]").length, 2);

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
           raw.indexOf('"水面波动生成器  v" + VER') >= 0, true);
    }
})();

console.log("---------------------------------------------");
console.log("七、源码级体检: 测试导出闸门的位置");
console.log("---------------------------------------------");
(function () {
    var gate = raw.indexOf('if (typeof app === "undefined")');
    var firstUI = raw.indexOf("var pal = (thisObj instanceof Panel)");
    ok("闸门存在", gate > 0);
    ok("闸门在【第一行 UI 代码之前】—— 否则 node 下 Panel/Window 未定义直接抛错",
       firstUI > 0 && gate < firstUI);
    ok("闸门内有 return(让 node 路径到此为止, 不执行 UI 代码)",
       /typeof app === "undefined"\)\s*\{[\s\S]{0,600}?return;/.test(raw));
    ok("文件外壳是 IIFE(return 才合法)",
       /^\s*\(function\s*\(thisObj\)\s*\{/m.test(raw));
})();

console.log("---------------------------------------------");
console.log("八、源码级体检: 工程写入约定");
console.log("---------------------------------------------");
(function () {
    var nBegin = (raw.match(/beginUndoGroup\(/g) || []).length;
    var nEnd = (raw.match(/endUndoGroup\(/g) || []).length;
    // ⚠️ 判据不是"数量相等": 正常路径 + catch 兜底各调一次 end 是【好写法】。
    //   2026-09-21 实测本文件: begin 1 处(L857) / end 2 处(L992 正常 + L996 catch 兜底)。
    //   初版写"数量配对"被这个好写法打红 —— 又一次"判据错被当成代码错"。
    //   真正要守的是: ① 有 begin ② end 不少于 begin ③ 顺序上 begin 在前。
    ok("有 Undo 组 begin", nBegin > 0);
    ok("end 不少于 begin(允许 catch 里补兜底 end)", nEnd >= nBegin);
    ok("第一个 end 出现在第一个 begin 之后(不会先 end 后 begin)",
       raw.indexOf("endUndoGroup") > raw.indexOf("beginUndoGroup"));
    ok("双窗口模式: (thisObj instanceof Panel) ? thisObj : new Window(...) 存在",
       /\(thisObj instanceof Panel\)\s*\?\s*thisObj/.test(raw));
    ok("有错误上报(showError), 不静默吞异常",
       raw.indexOf("function showError(") >= 0);
})();

console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("---------------------------------------------");
process.exit(failed ? 1 : 0);
