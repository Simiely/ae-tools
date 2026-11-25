/* ============================================================
 * 对话文本动画 v0.9.0 的断言测试
 *   node test_DialogueText.js
 *
 * 两类断言, 【都要留着】:
 *   Ⅰ 业务断言      —— 纯函数行为(拆字 / 文本框 / 滚动位移 / 蒙版顶点 / 表达式生成 / 命名)
 *   Ⅱ 骨架体检断言  —— 守住模板承载的架构约定(闸门位置 / safeRun 覆盖 / pinW 三处写 /
 *                      fixedBox 顺序 / 版本号三处一致 / Undo 组 / 诊断三件套)
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "DialogueText.jsx");
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
function near(name, got, want, eps) {
    var e = eps === undefined ? 1e-6 : eps;
    if (typeof got === "number" && Math.abs(got - want) <= e) {
        passed++; console.log("  \u2714 " + name);
    } else {
        failed++;
        console.log("  \u2718 " + name + "\n        期望: " + want + " (\u00b1" + e + ")"
                    + "\n        实得: " + got);
    }
}

console.log("---------------------------------------------");
console.log("一、测试导出闸门与导出完整性");
console.log("---------------------------------------------");
ok("闸门生效: node 下能拿到导出对象", T && typeof T === "object");
eq("导出 VER 常量", T.VER, "0.11.11");
["clampNum", "clampInt", "trimStr", "pad2", "splitChars", "countChars",
 "countVisibleChars", "truncateStr",
 "estimateTextWidth", "normalizeMode", "normalizeDirection", "modeText", "directionText",
 "normalizeCurve", "curveStartText", "curveEndText", "easeProgress",
 "computeBox", "computeScrollOffsets", "isOurMaskName", "buildMaskName", "parseMaskNameBox",
 "isOurAnimatorName",
 "exprNum", "buildMaskVertices", "computeFeatherInsetBox", "computeFeatherOutsetBox",
 "buildScrollExpression", "buildTypeScrollExpression",
 "computeTypeScrollTiming"].forEach(function (k) {
    eq("导出 " + k, typeof T[k], "function");
});
eq("导出 CURVE_LINEAR", T.CURVE_LINEAR, 0);
eq("导出 CURVE_SLOW", T.CURVE_SLOW, 1);
eq("导出 CURVE_FAST", T.CURVE_FAST, 2);
ok("导出 NAMES(标识单一真相)", T.NAMES && typeof T.NAMES === "object");
eq("NAMES.mask", T.NAMES.mask, "DT_窗口");
eq("NAMES.scrollAnim", T.NAMES.scrollAnim, "DT_滚动");
eq("NAMES.fadePrefix", T.NAMES.fadePrefix, "DT_渐隐");
eq("已移除: NAMES.nullLeft", T.NAMES.nullLeft, undefined);
eq("已移除: NAMES.nullRight", T.NAMES.nullRight, undefined);
eq("MODE_SCROLL", T.MODE_SCROLL, 0);
eq("MODE_TYPE", T.MODE_TYPE, 1);
eq("DIR_RTL", T.DIR_RTL, 0);
eq("DIR_LTR", T.DIR_LTR, 1);
ok("MAX_TEXT_LAYERS 是正数", T.MAX_TEXT_LAYERS > 0);
ok("MAX_TYPE_CHARS 是正数", T.MAX_TYPE_CHARS > 0);
ok("MAX_TOTAL_TYPE_CHARS 是正数", T.MAX_TOTAL_TYPE_CHARS > 0);
ok("MIN_BOX 是正数", T.MIN_BOX > 0);

console.log("---------------------------------------------");
console.log("二、字符串工具(代理对算 1 个)");
console.log("---------------------------------------------");
eq("splitChars 普通中文", T.splitChars("小明").length, 2);
eq("splitChars emoji 算 1 个", T.splitChars("\uD83D\uDE00").length, 1);
eq("countChars 中英混排", T.countChars("A B 好"), 5);
eq("truncateStr 不超长原样返回", T.truncateStr("你好", 5), "你好");
eq("truncateStr 超长补省略号", T.truncateStr("一二三四五", 3), "一二\u2026");
eq("pad2 补零", T.pad2(3), "03");
eq("pad2 两位原样", T.pad2(12), "12");
eq("trimStr 去首尾空白", T.trimStr("  你好  "), "你好");
eq("clampNum 下夹", T.clampNum(-5, 0, 10), 0);
eq("clampNum 上夹", T.clampNum(50, 0, 10), 10);
eq("clampNum 非法值落下限", T.clampNum("abc", 2, 10), 2);
eq("clampInt 四舍五入", T.clampInt(3.6, 0, 10), 4);
ok("estimateTextWidth 至少一个字宽", T.estimateTextWidth("", 72) >= 72);
ok("estimateTextWidth 随字数增长", T.estimateTextWidth("一二三", 72) > T.estimateTextWidth("一", 72));

console.log("---------------------------------------------");
console.log("三、方式 / 方向归一化");
console.log("---------------------------------------------");
eq("normalizeMode 保留逐字", T.normalizeMode(1), 1);
eq("normalizeMode 只有两个模式(2 回滚动)", T.normalizeMode(2), 0);
eq("normalizeMode 非法值回滚动", T.normalizeMode(9), 0);
eq("normalizeDirection 保留 LTR", T.normalizeDirection(1), 1);
eq("normalizeDirection 非法值回 RTL", T.normalizeDirection(9), 0);
eq("modeText 滚动", T.modeText(0), "横向滚动");
eq("modeText 逐字", T.modeText(1), "逐字出现");
eq("modeText 不再有逐字左移", T.modeText(2), "横向滚动");
eq("directionText RTL", T.directionText(0), "从右往左");
eq("directionText LTR", T.directionText(1), "从左往右");

console.log("---------------------------------------------");
console.log("四、文本框(贴合文字 + 四边边距)");
console.log("---------------------------------------------");
var RECT = { left: -300, top: -80, width: 600, height: 160 };
var b1 = T.computeBox(RECT, 0, 0, 0, 0);
eq("零边距左边=文字左边", b1.left, -300);
eq("零边距上边=文字上边", b1.top, -80);
eq("零边距右边=文字右边", b1.right, 300);
eq("零边距下边=文字下边", b1.bottom, 80);
eq("零边距框宽=文字宽", b1.width, 600);
eq("零边距框高=文字高", b1.height, 160);

var b2 = T.computeBox(RECT, 100, 200, 50, 150);
eq("左正边距向外扩", b2.left, -400);
eq("右正边距向外扩", b2.right, 500);
eq("上正边距向外扩", b2.top, -130);
eq("下正边距向外扩", b2.bottom, 230);
near("外扩后宽", b2.width, 900);
near("外扩后高", b2.height, 360);

var b3 = T.computeBox(RECT, -100, -200, -20, -30);
eq("左负边距向内收", b3.left, -200);
eq("右负边距向内收", b3.right, 100);
eq("上负边距向内收", b3.top, -60);
eq("下负边距向内收", b3.bottom, 50);
near("内收后宽", b3.width, 300);
near("内收后高", b3.height, 110);

var b4 = T.computeBox(RECT, -400, -400, 0, 0);
ok("左右收过头仍保留最小宽度", b4.width >= T.MIN_BOX - 1e-9);
near("最小宽度以文字中心为中心", (b4.left + b4.right) / 2, 0);
var b5 = T.computeBox(RECT, 0, 0, -200, -200);
ok("上下收过头仍保留最小高度", b5.height >= T.MIN_BOX - 1e-9);

var b6 = T.computeBox(RECT, "abc", "abc", "abc", "abc");
eq("非法边距按 0(左)", b6.left, -300);
eq("非法边距按 0(右)", b6.right, 300);
eq("非法边距按 0(上)", b6.top, -80);
eq("非法边距按 0(下)", b6.bottom, 80);

var b7 = T.computeBox({ left: 10, top: 20, width: "x", height: "x" }, 0, 0, 0, 0);
eq("非法文字宽按 0 并保留最小宽", b7.width, T.MIN_BOX);
eq("非法文字高按 0 并保留最小高", b7.height, T.MIN_BOX);
near("最小框以文字左上为中心", (b7.left + b7.right) / 2, 10);

console.log("---------------------------------------------");
console.log("五、滚动位移(层空间)");
console.log("---------------------------------------------");
var s1 = T.computeScrollOffsets(-200, 400, 0, 1000, T.DIR_RTL);
near("RTL 起点: 文字左缘贴右边界", s1.start, 1200);
near("RTL 终点: 文字右缘贴左边界", s1.end, -200);
near("RTL 位移距离", s1.distance, 1400);

var s2 = T.computeScrollOffsets(-200, 400, 0, 1000, T.DIR_LTR);
near("LTR 起点: 文字右缘贴左边界", s2.start, -200);
near("LTR 终点: 文字左缘贴右边界", s2.end, 1200);
near("LTR 位移距离", s2.distance, 1400);

var s3 = T.computeScrollOffsets(0, 300, 1000, 0, T.DIR_RTL);
near("边界左右颠倒不影响起点", s3.start, 1000);
near("边界左右颠倒不影响终点", s3.end, -300);

var s4 = T.computeScrollOffsets(0, 0, 0, 1000, T.DIR_RTL);
near("零宽文字起点", s4.start, 1000);
near("零宽文字终点", s4.end, 0);

var s5 = T.computeScrollOffsets(-300, 600, -300, 300, T.DIR_RTL);
near("零边距框内滚动距离=2倍文字宽", s5.distance, 1200);

console.log("---------------------------------------------");
console.log("六、蒙版顶点与滚动表达式");
console.log("---------------------------------------------");
eq("exprNum 取整到 3 位", T.exprNum(1.23456), "1.235");
eq("exprNum 非数字归零", T.exprNum("abc"), "0");

var v1 = T.buildMaskVertices({ left: -400, top: -130, right: 500, bottom: 230 });
eq("蒙版顶点有四个角", v1.length, 4);
eq("顶点顺序: 左上", v1[0].join(","), "-400,-130");
eq("顶点顺序: 右上", v1[1].join(","), "500,-130");
eq("顶点顺序: 右下", v1[2].join(","), "500,230");
eq("顶点顺序: 左下", v1[3].join(","), "-400,230");
var v0 = T.buildMaskVertices(null);
eq("空 box 顶点不崩", v0.length, 4);
eq("空 box 顶点归零", v0[0].join(","), "0,0");

var e1 = T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_RTL, true,
                                 T.CURVE_LINEAR, T.CURVE_LINEAR);
eq("RTL 表达式方向行", e1.indexOf("s = hi - rl;") >= 0, true);
eq("RTL 表达式终点行", e1.indexOf("e = lo - rr;") >= 0, true);
ok("3D 属性返回三维", e1.indexOf("[dx, 0, 0]") >= 0);
ok("表达式从入点开始计时", e1.indexOf("(time - inPoint) / dur") >= 0);
ok("表达式把进度夹在 0..1", e1.indexOf("k > 1") >= 0);
ok("表达式不再做坐标换算", e1.indexOf("fromComp") < 0);
ok("表达式烘入文本框左边界", e1.indexOf("var lo = 0;") >= 0);
ok("表达式烘入文本框右边界", e1.indexOf("var hi = 1920;") >= 0);
ok("左边界先取小", e1.indexOf("Math.min") < 0);
ok("表达式不再引用空对象", e1.indexOf("thisComp.layer(") < 0);

var mRl = e1.match(/var rl = (-?[\d.]+);/);
var mRr = e1.match(/var rr = (-?[\d.]+);/);
ok("表达式烘入文字左缘", !!mRl);
ok("表达式烘入文字右缘", !!mRr);
if (mRl && mRr) {
    near("烘入左缘与 rect 一致", parseFloat(mRl[1]), -200);
    near("烘入右缘与 rect 一致", parseFloat(mRr[1]), 200);
    var exprStart = 1920 - parseFloat(mRl[1]);
    var exprEnd = 0 - parseFloat(mRr[1]);
    var pure = T.computeScrollOffsets(-200, 400, 0, 1920, T.DIR_RTL);
    near("RTL 表达式起点与纯函数一致", exprStart, pure.start);
    near("RTL 表达式终点与纯函数一致", exprEnd, pure.end);
}

var e2 = T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_LTR, false,
                                 T.CURVE_LINEAR, T.CURVE_LINEAR);
eq("LTR 表达式方向行", e2.indexOf("s = lo - rr;") >= 0, true);
eq("LTR 表达式终点行", e2.indexOf("e = hi - rl;") >= 0, true);
ok("2D 属性返回二维", e2.indexOf("[dx, 0]") >= 0 && e2.indexOf("[dx, 0, 0]") < 0);

var e3 = T.buildScrollExpression(0, 100, 0, 1920, 0, T.DIR_RTL, true,
                                 T.CURVE_LINEAR, T.CURVE_LINEAR);
ok("时长为 0 时表达式至少 0.01 秒", e3.indexOf("var dur = 0.01;") >= 0);

var e4 = T.buildScrollExpression(-300, 600, -300, 300, 3, T.DIR_RTL, true,
                                 T.CURVE_LINEAR, T.CURVE_LINEAR);
var p4 = T.computeScrollOffsets(-300, 600, -300, 300, T.DIR_RTL);
ok("贴合框的起点烘入表达式", e4.indexOf("var hi = 300;") >= 0);
near("贴合框起点与纯函数一致", 300 - (-300), p4.start);

console.log("---------------------------------------------");
console.log("七、命名约定(清理旧动画靠它)");
console.log("---------------------------------------------");
eq("识别本工具蒙版", T.isOurMaskName("DT_窗口"), true);
eq("不误删别人的蒙版", T.isOurMaskName("蒙版 1"), false);
eq("识别滚动动画器", T.isOurAnimatorName("DT_滚动"), true);
eq("识别逐字动画器", T.isOurAnimatorName("DT_渐隐01"), true);
eq("不误删别人的动画器", T.isOurAnimatorName("我的动画"), false);

console.log("---------------------------------------------");
console.log("八、骨架体检: 测试导出闸门的位置");
console.log("---------------------------------------------");
(function () {
    var gate = raw.indexOf('if (typeof app === "undefined")');
    var firstPure = raw.indexOf("function clampNum(");
    var mAE = raw.match(/\n    var C_OK\s*=/);
    var aeStart = mAE ? mAE.index : -1;
    ok("闸门存在", gate > 0);
    ok("闸门在【所有纯函数定义之后】", firstPure > 0 && gate > firstPure);
    ok("闸门在【任何 AE API 调用之前】", aeStart > 0 && gate < aeStart);
    ok("闸门内有 return(让 node 路径到此为止)",
       /typeof app === "undefined"\)\s*\{[\s\S]{0,5000}?\n\s{8}return;/.test(raw));
})();

console.log("---------------------------------------------");
console.log("九、骨架体检: safeRun 覆盖 与 UI 尺寸约定");
console.log("---------------------------------------------");
(function () {
    var nHandler = (raw.match(/\.onClick\s*=/g) || []).length;
    var nSafe = (raw.match(/\.onClick\s*=\s*safeRun\(/g) || []).length;
    ok("存在 onClick handler", nHandler > 0);
    eq("所有 onClick 都经 safeRun 包裹", nSafe, nHandler);

    var nChange = (raw.match(/\.onChange\s*=/g) || []).length;
    var nChangeSafe = (raw.match(/\.onChange\s*=\s*safeRun\(/g) || []).length;
    eq("所有 onChange 都经 safeRun 包裹", nChangeSafe, nChange);

    var mP = raw.match(/function pinW\(ctrl, w\)\s*\{[\s\S]*?\n    \}/);
    ok("能找到 pinW 函数体", !!mP);
    if (mP) {
        var seg = mP[0];
        eq("pinW 写 preferredSize", seg.indexOf("ctrl.preferredSize = [w, -1]") >= 0, true);
        eq("pinW 写 minimumSize", seg.indexOf("ctrl.minimumSize = [w, 0]") >= 0, true);
        eq("pinW 写 maximumSize", seg.indexOf("ctrl.maximumSize = [w, 10000]") >= 0, true);
        eq("pinW 不读回旧高度", seg.indexOf("preferredSize.height") < 0, true);
    }

    var mF = raw.match(/function fixedBox\(box, w, h\)\s*\{[\s\S]*?\n    \}/);
    ok("能找到 fixedBox 函数体", !!mF);
    if (mF) {
        var seg2 = mF[0];
        var iP = seg2.indexOf("pinW(box, w)");
        var iH = seg2.indexOf("box.preferredSize = [w, h]");
        ok("fixedBox 里 pinW 早于设置高度(顺序反了会被静默覆盖)", iP >= 0 && iH >= 0 && iP < iH);
    }

    var mScroll = raw.match(/function addNote\([\s\S]*?\n    \}/);
    ok("说明文字用 statictext(不再用白底输入框)", !!mScroll
       && mScroll[0].indexOf('add("statictext"') >= 0
       && mScroll[0].indexOf('add("edittext"') < 0);
    var mDebug = raw.match(/function addTextBox\([\s\S]*?\n    \}/);
    ok("调试框有 scrolling 存在性回退", !!mDebug && /catch \(eScroll\)/.test(mDebug[0]));
})();

console.log("---------------------------------------------");
console.log("十、骨架体检: 版本号单一真相(三处一致)");
console.log("---------------------------------------------");
(function () {
    var mVer = raw.match(/var VER = "([0-9][0-9.]*)";/);
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
           raw.indexOf('"v" + VER') >= 0, true);
        eq("状态栏初始文案也带版本", raw.indexOf('"就绪 · v" + VER') >= 0, true);
    }
})();

console.log("---------------------------------------------");
console.log("十一、骨架体检: 写工程的三条铁律");
console.log("---------------------------------------------");
(function () {
    ok("有 Undo 组 beginUndoGroup", raw.indexOf("app.beginUndoGroup(") >= 0);
    ok("Undo 组成对 endUndoGroup(在 finally 里, 异常也能收)",
       /finally\s*\{[\s\S]{0,200}endUndoGroup\(\)/.test(raw));
    ok("失败时清理本次加的动画", /catch \(err\)[\s\S]{0,600}clearOurAnimation\(/.test(raw));
    ok("「未激活合成」走状态栏 + 弹窗双提示",
       raw.indexOf("needCompAlert()") >= 0 && raw.indexOf("setStatus(pal,") >= 0);
    ok("有诊断三件套(diag / flushDiag / 复制按钮)",
       raw.indexOf("function diag(") >= 0 && raw.indexOf("function flushDiag(") >= 0
       && raw.indexOf("copyBoxToClipboard(") >= 0);
    ok("有桌面日志(initLog / flog)", raw.indexOf("function initLog(") >= 0
       && raw.indexOf("function flog(") >= 0);
})();

console.log("---------------------------------------------");
console.log("十二、骨架体检: v0.4.0 贴合文字的文本框");
console.log("---------------------------------------------");
(function () {
    eq("已移除空对象创建", raw.indexOf("comp.layers.addNull(") < 0, true);
    eq("已移除左消失点控制器", raw.indexOf("DT_左消失点") < 0, true);
    eq("已移除右消失点控制器", raw.indexOf("DT_右消失点") < 0, true);
    eq("已移除「选中控制器」按钮", raw.indexOf("选中控制器") < 0, true);

    ok("用 computeBox 取窗口框(段落=原框)", raw.indexOf("computeBox(baseRect") >= 0);
    ok("computeBox 不再依赖画面宽高", raw.indexOf("computeBox(params.padL") < 0);
    ok("窗口蒙版用 MaskMode.ADD", raw.indexOf("MaskMode.ADD") >= 0);
    ok("蒙版形状用静态 Shape", raw.indexOf("new Shape()") >= 0);
    ok("蒙版形状写入顶点", raw.indexOf("sh.vertices = buildMaskVertices(featherBox)") >= 0);
    ok("蒙版路径按羽化向内缩", raw.indexOf("computeFeatherInsetBox(box, featherX)") >= 0);
    ok("蒙版不再写路径表达式", raw.indexOf("shape.expression") < 0);
    ok("羽化只作用左右(横向窗口)", raw.indexOf("fea.setValue([featherX, 0])") >= 0);
    ok("羽化距离按图层缩放反算", raw.indexOf("Number(feather) || 0) / sx") >= 0);
    ok("羽化强度写入蒙版不透明度", raw.indexOf('"ADBE Mask Opacity"') >= 0);
    ok("滚动用文本动画器位置表达式", raw.indexOf("pos.expression = expr") >= 0);
    ok("滚动表达式使用文本框边界",
       raw.indexOf("buildScrollExpression(rect.left, rect.width, box.left, box.right") >= 0);
    ok("逐字模式不加窗口蒙版", /else \{\s*applyWindowMask\(L, box/.test(raw));

    var i3D = raw.indexOf('"ADBE Text Position 3D"');
    var i2D = raw.indexOf('"ADBE Text Position"');
    ok("优先用 ADBE Text Position 3D(官方 matchName)", i3D > 0);
    ok("2D 名称只作为后备候选(不能排在 3D 之前)", i2D < 0 || i2D > i3D);

    ok("读取选中文本层(不改 Source Text)", raw.indexOf("comp.selectedLayers") >= 0);
    ok("不改 Source Text(不写 setValue 到源文本)", !/getSourceTextProp\([^)]*\)\.setValue/.test(raw));
    ok("读取文字范围用 sourceRectAtTime", raw.indexOf("sourceRectAtTime(") >= 0);
    ok("不再用 fromComp 做坐标换算", raw.indexOf("fromComp(") < 0);
    ok("填充面板末尾有 layout.layout(true)", /pal\.layout\.layout\(true\)/.test(raw));
    ok("不使用 tabbedpanel(真机空白事故)", raw.indexOf("tabbedpanel") < 0);
    ok("参数可反复调整: 应用前按名称清理旧动画", raw.indexOf("clearOurAnimation(L0)") >= 0);

    ok("已移除旧方案: parseDialogue", raw.indexOf("function parseDialogue(") < 0);
    ok("已移除旧方案: planSchedule", raw.indexOf("function planSchedule(") < 0);
    ok("已移除旧方案: buildDisplayLines", raw.indexOf("function buildDisplayLines(") < 0);
    ok("已移除旧方案: 新建字幕层 addText(", raw.indexOf(".layers.addText(") < 0);
})();

console.log("---------------------------------------------");
console.log("十三、v0.5.0 动态曲线(开头 / 结束)");
console.log("---------------------------------------------");
(function () {
    // 归一化: 非法值回退匀速。
    eq("曲线归一化: -1 -> 匀速", T.normalizeCurve(-1), T.CURVE_LINEAR);
    eq("曲线归一化: 99 -> 匀速", T.normalizeCurve(99), T.CURVE_LINEAR);
    eq("曲线归一化: \"abc\" -> 匀速", T.normalizeCurve("abc"), T.CURVE_LINEAR);
    eq("曲线归一化: 1 -> 慢", T.normalizeCurve(1), T.CURVE_SLOW);
    eq("曲线归一化: 2 -> 快", T.normalizeCurve(2), T.CURVE_FAST);

    eq("开头曲线文案: 匀速", T.curveStartText(0), "匀速起步");
    eq("开头曲线文案: 慢", T.curveStartText(1), "慢起加速");
    eq("开头曲线文案: 快", T.curveStartText(2), "快起减速");
    eq("结束曲线文案: 匀速", T.curveEndText(0), "匀速收尾");
    eq("结束曲线文案: 慢", T.curveEndText(1), "减速慢收");
    eq("结束曲线文案: 快", T.curveEndText(2), "加速快收");

    // 端点严格 0/1, 与曲线组合无关。
    var combos = [[0, 0], [1, 1], [2, 1], [1, 2], [2, 2], [0, 2], [2, 0]];
    var c;
    for (c = 0; c < combos.length; c++) {
        near("曲线组合 " + combos[c].join("+") + " 起点为 0",
            T.easeProgress(0, combos[c][0], combos[c][1]), 0);
        near("曲线组合 " + combos[c].join("+") + " 终点为 1",
            T.easeProgress(1, combos[c][0], combos[c][1]), 1);
    }

    // 中点值: 匀速 0.5 / 淡入淡出 0.5 / 前快后慢 0.75 / 前慢后快 0.25。
    near("匀速+匀速 中点 0.5", T.easeProgress(0.5, 0, 0), 0.5);
    near("慢起+慢收(淡入淡出) 中点 0.5", T.easeProgress(0.5, 1, 1), 0.5);
    near("快起+慢收(前快后慢) 中点 0.75", T.easeProgress(0.5, 2, 1), 0.75);
    near("慢起+快收(前慢后快) 中点 0.25", T.easeProgress(0.5, 1, 2), 0.25);
    near("淡入淡出 0.25 -> 0.15625(smoothstep)", T.easeProgress(0.25, 1, 1), 0.15625);
    near("前快后慢 0.25 -> 0.4375", T.easeProgress(0.25, 2, 1), 0.4375);
    near("前慢后快 0.25 -> 0.0625", T.easeProgress(0.25, 1, 2), 0.0625);

    // 进度夹取: 越界按端点处理。
    near("进度小于 0 按 0 处理", T.easeProgress(-3, 1, 1), 0);
    near("进度大于 1 按 1 处理", T.easeProgress(5, 2, 1), 1);

    // 单调性: 所有组合都必须单调不减(不能倒退)。
    var monoOk = true;
    for (c = 0; c < combos.length; c++) {
        var prev = -1;
        for (var s = 0; s <= 100; s++) {
            var cur = T.easeProgress(s / 100, combos[c][0], combos[c][1]);
            if (cur < prev - 1e-12) { monoOk = false; }
            prev = cur;
        }
    }
    eq("所有曲线组合单调不减", monoOk, true);

    // 表达式: 曲线内联展开, 端点由 q 加权, 不再直接 dx = s + (e-s)*k。
    var eL = T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_RTL, true, 0, 0);
    ok("匀速表达式不写入开头曲线覆盖", eL.indexOf("a = k * k;") < 0
       && eL.indexOf("a = 1 - (1 - k) * (1 - k);") < 0);
    ok("匀速表达式不写入结束曲线覆盖", eL.indexOf("b = k * k;") < 0
       && eL.indexOf("b = 1 - (1 - k) * (1 - k);") < 0);
    ok("表达式用 q 加权", eL.indexOf("var q = a * (1 - k) + b * k;") >= 0);
    ok("表达式位移用 q", eL.indexOf("var dx = s + (e - s) * q;") >= 0);
    ok("表达式不再直接用 k 做位移", eL.indexOf("var dx = s + (e - s) * k;") < 0);

    var eSS = T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_RTL, true, 1, 1);
    ok("淡入淡出表达式含开头慢起", eSS.indexOf("a = k * k;") >= 0);
    ok("淡入淡出表达式含结束慢收", eSS.indexOf("b = 1 - (1 - k) * (1 - k);") >= 0);

    var eFS = T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_RTL, true, 2, 1);
    ok("前快后慢表达式含开头快起", eFS.indexOf("a = 1 - (1 - k) * (1 - k);") >= 0);
    ok("前快后慢表达式含结束慢收", eFS.indexOf("b = 1 - (1 - k) * (1 - k);") >= 0);

    var eSF = T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_RTL, true, 1, 2);
    ok("前慢后快表达式含开头慢起", eSF.indexOf("a = k * k;") >= 0);
    ok("前慢后快表达式含结束快收", eSF.indexOf("b = k * k;") >= 0);

    var eBad = T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_RTL, true, 99, -5);
    ok("非法曲线回退匀速(不写曲线覆盖)", eBad.indexOf("a = k * k;") < 0
       && eBad.indexOf("b = k * k;") < 0
       && eBad.indexOf("= 1 - (1 - k) * (1 - k);") < 0);

    // 曲线不改起止点: 同一组参数下, 三种曲线的 s / e / dur 行完全一致。
    function tailOf(expr) {
        return expr.split("\n").slice(0, 8).join("|");
    }
    eq("曲线不改起止点(RTL)", tailOf(eL), tailOf(eSS));
    eq("曲线不改起止点(LTR)",
       tailOf(T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_LTR, true, 1, 2)),
       tailOf(T.buildScrollExpression(-200, 400, 0, 1920, 3, T.DIR_LTR, true, 2, 1)));

    // UI 接线。
    ok("面板有开头曲线下拉", raw.indexOf('["匀速起步", "慢起加速", "快起减速"]') >= 0);
    ok("面板有结束曲线下拉", raw.indexOf('["匀速收尾", "减速慢收", "加速快收"]') >= 0);
    ok("默认曲线为匀速", /curveIn:\s*CURVE_LINEAR/.test(raw)
       && /curveOut:\s*CURVE_LINEAR/.test(raw));
    ok("readParams 读取并归一化曲线", /curveIn:\s*normalizeCurve\(curveIn\)/.test(raw)
       && /curveOut:\s*normalizeCurve\(curveOut\)/.test(raw));
    ok("逐字模式隐藏滚动参数组", /grpScroll\.visible = isScroll/.test(raw));
    ok("横向滚动模式隐藏逐字参数组", /grpType\.visible = !isScroll/.test(raw));
    ok("重置参数恢复曲线默认", /ddlCurveIn\.selection = DEF\.curveIn/.test(raw)
       && /ddlCurveOut\.selection = DEF\.curveOut/.test(raw));
    ok("applyScroll 把曲线传给表达式",
       raw.indexOf("params.curveIn, params.curveOut") >= 0);
    ok("应用日志打印曲线", raw.indexOf("开头曲线 \" + curveStartText(params.curveIn)") >= 0
       && raw.indexOf("结束曲线 \" + curveEndText(params.curveOut)") >= 0);
})();

console.log("---------------------------------------------");
console.log("十四、v0.5.1 羽化只向框内扩散(框外不可见)");
console.log("---------------------------------------------");
(function () {
    var b = { left: -500, top: -50, right: 500, bottom: 50, width: 1000, height: 100 };
    var f0 = T.computeFeatherInsetBox(b, 0);
    near("羽化 0 时左路径不内缩", f0.left, -500);
    near("羽化 0 时右路径不内缩", f0.right, 500);
    near("羽化 0 时上边界不变", f0.top, -50);
    near("羽化 0 时下边界不变", f0.bottom, 50);

    var f1 = T.computeFeatherInsetBox(b, 100);
    near("羽化 100 时左路径内缩半个羽化", f1.left, -450);
    near("羽化 100 时右路径内缩半个羽化", f1.right, 450);
    near("路径宽度 = 框宽 - 羽化", f1.width, 900);
    near("左侧羽化外边界与框边对齐", f1.left - 100 / 2, b.left);
    near("右侧羽化外边界与框边对齐", f1.right + 100 / 2, b.right);
    near("竖直方向不内缩(上)", f1.top, b.top);
    near("竖直方向不内缩(下)", f1.bottom, b.bottom);

    var fBig = T.computeFeatherInsetBox(b, 5000);
    ok("羽化大于框宽时路径不反向", fBig.width >= 0.5);
    ok("羽化大于框宽时路径仍在框内",
       fBig.left >= b.left && fBig.right <= b.right);

    var neg = T.computeFeatherInsetBox(b, -30);
    near("负羽化按 0 处理", neg.left, b.left);

    var none = T.computeFeatherInsetBox(null, 50);
    ok("空 box 不崩", !!none && none.width >= 0.5);

    ok("羽化值按图层缩放反算",
       raw.indexOf("var featherX = Math.max(0, Number(feather) || 0) / sx;") >= 0);
    ok("蒙版路径用内缩后的框",
       raw.indexOf("sh.vertices = buildMaskVertices(featherBox)") >= 0);
    ok("羽化只设左右(上下硬边)", raw.indexOf("fea.setValue([featherX, 0])") >= 0);
    ok("诊断日志注明羽化方向", raw.indexOf('(outward ? "向外" : "向内")') >= 0);

    // v0.11.5: 逐字出现的羽化向【框外】扩散 —— 框内始终完全清晰,
    // 首尾的字从出现那一刻起就不发虚(向内羽化会吃掉长文本尾部的字)。
    var o1 = T.computeFeatherOutsetBox(b, 100);
    near("向外: 左路径外扩半个羽化", o1.left, -550);
    near("向外: 右路径外扩半个羽化", o1.right, 550);
    near("向外: 左侧清晰边界仍在框边", o1.left + 100 / 2, b.left);
    near("向外: 右侧清晰边界仍在框边", o1.right - 100 / 2, b.right);
    near("向外: 竖直方向不变(上)", o1.top, b.top);
    near("向外: 竖直方向不变(下)", o1.bottom, b.bottom);
    var o0 = T.computeFeatherOutsetBox(b, 0);
    near("向外: 羽化 0 时路径=框(左)", o0.left, b.left);
    near("向外: 羽化 0 时路径=框(右)", o0.right, b.right);
    var oNeg = T.computeFeatherOutsetBox(b, -30);
    near("向外: 负羽化按 0 处理", oNeg.left, b.left);
    var oNull = T.computeFeatherOutsetBox(null, 50);
    ok("向外: 空 box 不崩", !!oNull && oNull.width >= 0);
})();

console.log("---------------------------------------------");
console.log("十五、v0.8.0 逐字出现(一整套：以文本框为窗口 + 出现/隐藏两段)");
console.log("---------------------------------------------");
(function () {
    var rect = { left: -100, top: -50, width: 1000, height: 100 };

    // 窗口 = 文本框: 不再有独立窗口宽, 直接用 computeBox + 四边边距。
    ok("已移除独立窗口框函数", typeof T.computeTypeScrollBox === "undefined");
    var box = T.computeBox(rect, 0, 0, 0, 0);
    near("窗口=文字框(零边距)", box.width, 1000);
    near("窗口左边界=文字左缘", box.left, -100);
    near("窗口右边界=文字右缘", box.right, 900);
    var box2 = T.computeBox(rect, 0, -300, 0, 0);
    near("负右边距把窗口收窄", box2.width, 700);
    near("收窄后窗口右边界", box2.right, 600);

    // 表达式: 框内始终清晰(羽化在框外) -> 文字不右移; 只有负边距(框比文字窄)
    // 时才按前沿左移; 隐藏阶段按隐藏像素左移。
    var ex = T.buildTypeScrollExpression(10, -100, 1000, -100, 900, 2, 0.12, 0.8, true, 600);
    ok("表达式含字符数", ex.indexOf("var n = 10;") >= 0);
    ok("表达式含文字左缘", ex.indexOf("var rl = -100;") >= 0);
    ok("表达式含文字右缘", ex.indexOf("var rr = 900;") >= 0);
    ok("表达式含窗口左缘", ex.indexOf("var bl = -100;") >= 0);
    ok("表达式含窗口右缘", ex.indexOf("var br = 900;") >= 0);
    ok("表达式含平均字宽", ex.indexOf("var avg = 100;") >= 0);
    ok("表达式含出现步长", ex.indexOf("var step = ") >= 0);
    ok("表达式含出现时长", ex.indexOf("var ap = 2;") >= 0);
    ok("表达式含隐藏时长", ex.indexOf("var hd = 0.8;") >= 0);
    ok("表达式含隐藏像素", ex.indexOf("var hpx = 600;") >= 0);
    ok("表达式不再烘入羽化宽度(羽化只在蒙版上)",
       ex.indexOf("var fe =") < 0 && ex.indexOf("var cl =") < 0 && ex.indexOf("var cr =") < 0);
    ok("不再把文字右移避羽化(长文本尾字会被推出框)",
       ex.indexOf("shift") < 0);
    ok("表达式把已出现字数夹在 0..n",
       ex.indexOf("if (ks < 0) { ks = 0; } else if (ks > n) { ks = n; }") >= 0);
    ok("前沿把正在画的字也算进去",
       ex.indexOf("var ks = step > 0 ? t / step + 1 : 0;") >= 0);
    ok("打字前沿按框右缘计算", ex.indexOf("var dx = br - (rl + avg * ks);") >= 0);
    ok("文字不向右移(上限 0)", ex.indexOf("if (dx > 0) { dx = 0; }") >= 0);
    ok("零/正边距时文字完全不动(右缘不越过框右缘)",
       ex.indexOf("var dxEnd = br - rr;") >= 0 && ex.indexOf("if (dxEnd > 0) { dxEnd = 0; }") >= 0);
    ok("负边距时按前沿整行左移", ex.indexOf("if (dx < dxEnd) { dx = dxEnd; }") >= 0);
    ok("表达式有隐藏阶段", ex.indexOf("if (t > ap) {") >= 0);
    ok("隐藏阶段从出现结束时的位移出发(连续不跳)", ex.indexOf("var dx0 = dxEnd;") >= 0);
    ok("隐藏阶段向左走隐藏像素", ex.indexOf("var dx1 = dx0 - hpx;") >= 0);
    ok("隐藏阶段按隐藏时长线性推进", ex.indexOf("var h = (t - ap) / hd;") >= 0);
    ok("3D 返回三维偏移", ex.indexOf("[dx, 0, 0]") >= 0);
    ok("2D 返回二维偏移",
       T.buildTypeScrollExpression(10, -100, 1000, -100, 900, 2, 0.12, 0.8, false)
           .indexOf("[dx, 0]") >= 0);
    ok("空文本不产生 NaN",
       T.buildTypeScrollExpression(0, 0, 0, 0, 0, 2, 0.12, 0.8, true).indexOf("NaN") < 0);
    ok("零出现时长回退 1s",
       T.buildTypeScrollExpression(10, 0, 100, 0, 100, 0, 0.12, 0.8, true)
           .indexOf("var ap = 1;") >= 0);
    var exBig = T.buildTypeScrollExpression(10, 0, 100, 0, 100, 2, 0.12, 0.8, true, -5);
    ok("负隐藏像素按 0", exBig.indexOf("var hpx = 0;") >= 0);
    // 零边距(框=文字): dxEnd 必须恒为 0, 出现阶段文字一动不动。
    var exZero = T.buildTypeScrollExpression(10, -100, 1000, -100, 900, 2, 0.12, 0.8, true, 100);
    ok("零边距: 文字右缘=框右缘", exZero.indexOf("var rr = 900;") >= 0
       && exZero.indexOf("var br = 900;") >= 0);

    // 时间轴: 出现时长里平均分配步长, 隐藏时长接在后面。
    var tm = T.computeTypeScrollTiming(10, 2, 0.12, 0.8);
    near("10 字: 步长 = (出现-单字渐隐)/9", tm.step, (2 - 0.12) / 9);
    near("10 字: 最后一个字完成于出现时长", tm.lastVisible, 2);
    near("10 字: 隐藏结束后整段结束", tm.endTime, 2.8);

    var tm1 = T.computeTypeScrollTiming(1, 2, 0.12, 0.8);
    near("单字: 步长 0", tm1.step, 0);
    near("单字: 结束于 出现+隐藏", tm1.endTime, 2.8);

    var tmBad = T.computeTypeScrollTiming(0, 0, -1, 0);
    near("非法出现时长回退 1s", tmBad.lastVisible, 1);
    ok("非法隐藏时长至少 0.05s", tmBad.endTime >= 1.05);
    ok("结束时间晚于出现结束", tm.endTime > tm.lastVisible);
    near("单字渐隐大于出现时长时被夹住",
       T.computeTypeScrollTiming(5, 1, 2, 1).lastVisible, 1);

    // UI / 分支接线。
    ok("方式改为两个互斥单选",
       raw.indexOf('rbScroll = rowMode.add("radiobutton"') >= 0
       && raw.indexOf('rbType = rowMode.add("radiobutton"') >= 0);
    ok("已移除方式下拉", raw.indexOf("ddlMode") < 0);
    ok("两个模式是二选一(radio 默认值互斥)",
       raw.indexOf("rbScroll.value = (DEF.mode === MODE_SCROLL)") >= 0
       && raw.indexOf("rbType.value = (DEF.mode === MODE_TYPE)") >= 0);
    ok("两套参数各自成组",
       raw.indexOf('"横向滚动参数"') >= 0 && raw.indexOf('"逐字出现参数"') >= 0);
    ok("切换方式后重新排版", /pal\.layout\.layout\(true\)/.test(raw));
    ok("方式读取收口到 getMode", raw.indexOf("function getMode()") >= 0
       && raw.indexOf("var mode = getMode();") >= 0);
    ok("下拉不再有逐字左移", raw.indexOf('"逐字左移"') < 0);
    ok("面板有出现时长输入", raw.indexOf("bxAppear = addNum(rowW, DEF.appearDur, 56)") >= 0);
    ok("面板有隐藏时长输入", raw.indexOf("bxHide = addNum(rowH, DEF.hideDur, 56)") >= 0);
    ok("面板有隐藏像素输入", raw.indexOf("bxHidePx = addNum(rowH, DEF.hidePx, 56)") >= 0);
    eq("隐藏像素只创建一次", (raw.match(/bxHidePx = addNum\(/g) || []).length, 1);
    ok("参数读取包含隐藏像素",
       raw.indexOf("var hidePx = clampNum(readNum(bxHidePx, DEF.hidePx), 0, 100000);") >= 0);
    ok("表达式传入隐藏像素(羽化不参与位置)",
       raw.indexOf("params.hideDur, is3D,") >= 0 && raw.indexOf("featherX, hideX") < 0);
    eq("逐字参数只创建一次(不会在别的分组重复)",
       (raw.match(/bxAppear = addNum\(/g) || []).length, 1);
    eq("渐隐参数只创建一次", (raw.match(/bxFade = addNum\(/g) || []).length, 1);
    ok("已移除窗口宽输入", raw.indexOf("bxWinW") < 0);
    ok("已移除停留输入", raw.indexOf("bxHold") < 0);
    ok("已移除整体渐隐输入", raw.indexOf("bxFadeOut") < 0);
    ok("已移除字速输入", raw.indexOf("bxCps") < 0);
    ok("已移除字速参数", raw.indexOf("params.cps") < 0);

    var mTS = raw.match(/function applyTypeScroll\([\s\S]*?\n    \}/);
    ok("逐字出现: 复用逐字动画器并传入出现步长 + 隐藏时间轴",
       !!mTS && mTS[0].indexOf("applyTypewriter(layer, info, params, timing.step,") >= 0
       && mTS[0].indexOf("layer.inPoint + timing.lastVisible, layer.inPoint + timing.endTime") >= 0);
    ok("逐字出现: 左移动画器", !!mTS && mTS[0].indexOf("anim.name = ANIM_SCROLL_NAME") >= 0);
    ok("逐字出现: 位移表达式", !!mTS && mTS[0].indexOf("buildTypeScrollExpression") >= 0);
    ok("DT_滚动 只负责位置, 不再挂不透明度(避免顶掉逐字出现)",
       !!mTS && mTS[0].indexOf('"ADBE Text Position 3D"') >= 0
       && mTS[0].indexOf('"ADBE Text Opacity"') < 0);
    ok("逐字出现不再新建第二个动画器",
       !!mTS && mTS[0].indexOf("addTextAnimator(animators)") === mTS[0].lastIndexOf("addTextAnimator(animators)"));
    ok("整体渐隐不写负值(AE 脚本范围 0..100)",
       mTS ? mTS[0].indexOf(", -100)") < 0 : false);
    ok("整体渐隐计入动画器数量(仅 DT_滚动)",
       !!mTS && mTS[0].indexOf("count: tr.count + 1,") >= 0);
    ok("整体渐隐不改图层自身 Opacity",
       !!mTS && mTS[0].indexOf("layer.property") < 0);
    ok("逐字出现: 使用出现/隐藏时间轴",
       !!mTS && mTS[0].indexOf("computeTypeScrollTiming") >= 0);

    ok("doApply 统一用 computeBox 取窗口框",
       raw.indexOf("var box = computeBox(baseRect, params.padL, params.padR,") >= 0);
    ok("已移除独立窗口框计算", raw.indexOf("computeTypeScrollBox") < 0);
    ok("逐字出现分支建窗口蒙版(羽化向外)",
       raw.indexOf("applyWindowMask(L, box, params.feather, params.strength, true, maskName)") >= 0);
    ok("逐字出现分支创建整套动画",
       raw.indexOf("applyTypeScroll(L, info2, info2.rect, box, params)") >= 0);
    ok("逐字出现延长出点", raw.indexOf("extendOutPoint(L, tsr.endTime, comp)") >= 0);
    ok("逐字出现不再走原地分支", raw.indexOf("applyTypewriter(L, info2, params)") < 0);
})();

console.log("---------------------------------------------");
console.log("十六、v0.6.0 首次加载提速 + 说明文字");
console.log("---------------------------------------------");
(function () {
    ok("日志写入有节流间隔", raw.indexOf("var LOG_WRITE_GAP") >= 0
       && raw.indexOf("t - gLastLogWrite >= LOG_WRITE_GAP") >= 0);
    ok("日志行数有上限", raw.indexOf("var LOG_MAX_LINES") >= 0
       && raw.indexOf("gLogLines.shift()") >= 0);
    ok("有强制落盘函数", raw.indexOf("function flushLog()") >= 0);
    var mSafe = raw.match(/function safeRun\([\s\S]*?\n    \}/);
    ok("handler 收尾强制落盘", !!mSafe && mSafe[0].indexOf("flushLog();") >= 0);
    var mMount = raw.match(/function mountPanel\([\s\S]*?\n    \}/);
    ok("面板挂载完成只落盘一次", !!mMount && mMount[0].indexOf("flushLog();") >= 0);
    var mNote = raw.match(/function addNote\([\s\S]*?\n    \}/);
    ok("说明文字不使用固定高度输入框", !!mNote
       && mNote[0].indexOf("fixedBox") < 0
       && mNote[0].indexOf('add("statictext"') >= 0);
})();

console.log("---------------------------------------------");
console.log("十七、v0.11.0 默认参数(按用户面板截图)");
console.log("---------------------------------------------");
(function () {
    ok("默认隐藏像素 100", /hidePx:\s*"100"/.test(raw));
    ok("默认羽化 25", /feather:\s*"25"/.test(raw));
    ok("重置参数恢复隐藏像素", raw.indexOf("bxHidePx.text = DEF.hidePx;") >= 0);
    ok("日志框加高到 10 行", raw.indexOf("addTextBox(secOut, BOX_W - 20, 10,") >= 0);
    ok("提供 errText 安全错误转换", raw.indexOf("function errText(e)") >= 0);
})();

console.log("---------------------------------------------");
console.log("十八、v0.11.3 每字动画器复用已有选区(修复逐字出现消失)");
console.log("---------------------------------------------");
(function () {
    var mTW = raw.match(/function applyTypewriter\([\s\S]*?\n    \}/);
    ok("每字动画器先复用已有选区",
       !!mTW && mTW[0].indexOf("if (selGroup.numProperties > 0)") >= 0
       && mTW[0].indexOf("sel = selGroup.property(1)") >= 0);
    ok("已有选区取不到时才新建第二个",
       !!mTW && mTW[0].indexOf("if (!sel) { sel = addRangeSelector(selGroup); }") >= 0);
    eq("每字动画器最多只加一个选区",
       mTW ? (mTW[0].match(/addRangeSelector\(selGroup\)/g) || []).length : -1, 1);
    ok("复用选区发生在设置起止百分比之前",
       !!mTW && mTW[0].indexOf("sel = selGroup.property(1)")
       < mTW[0].indexOf("se.start.setValue("));
    eq("三处动画器创建都复用选区",
       (raw.match(/if \(selGroup\.numProperties > 0\)/g) || []).length, 3);
})();

console.log("---------------------------------------------");
console.log("十九、v0.11.4 整行渐隐写进每字动画器(修复逐字出现被顶掉)");
console.log("---------------------------------------------");
(function () {
    var mTW = raw.match(/function applyTypewriter\([\s\S]*?\n    \}/);
    ok("每字动画器接收隐藏时间区间",
       !!mTW && mTW[0].indexOf("hideStart, hideEnd") >= 0);
    ok("隐藏区间有效时才写渐隐关键帧",
       !!mTW && mTW[0].indexOf("var hasHide = !isNaN(hs) && !isNaN(he) && (he > hs);") >= 0);
    ok("隐藏开始保持 100(不变)",
       !!mTW && mTW[0].indexOf("op.setValueAtTime(hideStart, 100);") >= 0);
    ok("隐藏结束到 0(全透明)",
       !!mTW && mTW[0].indexOf("op.setValueAtTime(hideEnd, 0);") >= 0);
    ok("每字动画器的所有关键帧统一线性",
       !!mTW && mTW[0].indexOf("for (var k = 1; k <= op.numKeys; k++)") >= 0);
    ok("关键帧失败兜底写回 100",
       !!mTW && mTW[0].indexOf("try { op.setValueAtTime(t1, 100); } catch (eK2) {}") >= 0);
    ok("关键帧失败走 errText 安全转换",
       !!mTW && mTW[0].indexOf("关键帧写入失败: ") >= 0
       && mTW[0].indexOf("errText(eK)") >= 0);
    var mTS = raw.match(/function applyTypeScroll\([\s\S]*?\n    \}/);
    ok("DT_滚动 不再创建不透明度属性",
       !!mTS && mTS[0].indexOf("ADBE Text Opacity") < 0);
    ok("整体渐隐不再使用 fadeCount",
       raw.indexOf("fadeCount") < 0);
})();

console.log("---------------------------------------------");
console.log("二十、v0.11.5 逐字出现羽化向外(修复长文本尾字不出现)");
console.log("---------------------------------------------");
(function () {
    ok("蒙版函数接收羽化方向开关",
       raw.indexOf("function applyWindowMask(layer, box, feather, strength, outward, maskName)") >= 0);
    ok("逐字出现: 羽化向框外扩散",
       raw.indexOf("applyWindowMask(L, box, params.feather, params.strength, true, maskName)") >= 0);
    ok("横向滚动: 羽化仍向框内(框外不可见)",
       raw.indexOf("applyWindowMask(L, box, params.feather, params.strength, false, maskName)") >= 0);
    ok("蒙版按开关选内缩/外扩",
       raw.indexOf("outward ? computeFeatherOutsetBox(box, featherX)") >= 0
       && raw.indexOf(": computeFeatherInsetBox(box, featherX)") >= 0);
    var mExpr = raw.match(/function buildTypeScrollExpression\([\s\S]*?\n    \}/);
    ok("位置表达式不再接收羽化宽度",
       !!mExpr && mExpr[0].indexOf("featherX") < 0);
    ok("位置表达式去掉羽化补偿右移",
       raw.indexOf("var shift = cl - rl;") < 0 && raw.indexOf("var fe = ") < 0);
    ok("位置表达式按框边界计算前沿",
       !!mExpr && mExpr[0].indexOf("var dx = br - (rl + avg * ks);") >= 0);
    ok("位置表达式不让文字右移",
       !!mExpr && mExpr[0].indexOf("if (dx > 0) { dx = 0; }") >= 0);
    ok("隐藏阶段与出现结束位移连续",
       !!mExpr && mExpr[0].indexOf("var dx0 = dxEnd;") >= 0);
    var mTS2 = raw.match(/function applyTypeScroll\([\s\S]*?\n    \}/);
    ok("逐字出现日志带文字尺寸(便于核对长文本)",
       raw.indexOf('Math.round(info2.rect.width) + "x"') >= 0);
    ok("逐字出现位置表达式只传隐藏像素",
       !!mTS2 && mTS2[0].indexOf("hideX);") >= 0 && mTS2[0].indexOf("featherX, hideX") < 0);
})();

console.log("---------------------------------------------");
console.log("二十一、v0.11.6 段落文本溢出修复(修复出现时长像没生效)");
console.log("---------------------------------------------");
(function () {
    // 纯逻辑: 溢出判定与框高取整
    eq("溢出判定: 文字高明显大于框高", T.isBoxOverflow(38, 114), true);
    eq("溢出判定: 正好等于框高不算溢出", T.isBoxOverflow(38, 38), false);
    eq("溢出判定: 误差 1px 以内不算溢出", T.isBoxOverflow(38, 39), false);
    eq("溢出判定: 框高无效时不判定", T.isBoxOverflow(0, 114), false);
    ok("导出 isBoxOverflow", typeof T.isBoxOverflow === "function");

    // getTextInfo 采集段落文本信息
    var mInfo = raw.match(/function getTextInfo\([\s\S]*?\n    \}/);
    ok("测量时读取段落框标记", !!mInfo && mInfo[0].indexOf("doc.boxText") >= 0);
    ok("测量时读取段落框尺寸", !!mInfo && mInfo[0].indexOf("doc.boxTextSize") >= 0);
    ok("测量时读取行距", !!mInfo && mInfo[0].indexOf("doc.leading") >= 0);
    ok("测量结果带框标记/框宽高/行距",
       !!mInfo && mInfo[0].indexOf("boxText: boxText") >= 0
       && mInfo[0].indexOf("boxW: boxW") >= 0
       && mInfo[0].indexOf("boxH: boxH") >= 0
       && mInfo[0].indexOf("leading: leading") >= 0);

    // 修复函数: 撑高探测 -> 溢出才改框高 -> 失败还原
    var mFit = raw.match(/function fitParagraphBox\([\s\S]*?\n    \}/);
    ok("提供段落框溢出修复函数", !!mFit);
    ok("只处理段落文本", !!mFit && mFit[0].indexOf("doc.boxText") >= 0);
    ok("源文本有动画时不写 TextDocument",
       !!mFit && mFit[0].indexOf("st.numKeys > 0") >= 0
       && mFit[0].indexOf("st.expressionEnabled") >= 0);
    ok("旧版先撑高定界框再测量", !!mFit && mFit[0].indexOf("setBox(w, probeH)") >= 0);
    ok("按撑高后的文字高度判定溢出",
       !!mFit && mFit[0].indexOf("isBoxOverflow(h, ph)") >= 0);
    ok("溢出时改为单行(不再靠拉高框)",
       !!mFit && mFit[0].indexOf("layoutH = Math.max(Math.round(h), lineH)") >= 0);
    ok("不是溢出时还原原框", !!mFit && mFit[0].indexOf("setBox(w, h)") >= 0);
    ok("每次写框都重新取 TextDocument",
       !!mFit && mFit[0].indexOf("var d = st.value;") >= 0
       && mFit[0].indexOf("d.boxTextSize = [Math.round(ww), Math.round(hh)];") >= 0);
    ok("写框失败走 errText 安全转换",
       !!mFit && mFit[0].indexOf("写段落框尺寸失败: ") >= 0
       && mFit[0].indexOf("errText(eS)") >= 0);
    ok("撑高后测量仍等于框高则还原并告警",
       !!mFit && mFit[0].indexOf("ph >= probeH - 2") >= 0
       && mFit[0].indexOf("已还原") >= 0);

    // doApply: 应用前先修框, 并按新范围建窗口
    ok("应用前调用段落框修复",
       raw.indexOf("fitParagraphBox(L0, getSourceTextProp(L0), info.doc, comp.time, storedWin)") >= 0);
    ok("修复后重新测量文字范围",
       raw.indexOf("rNew = L0.sourceRectAtTime(comp.time, false)") >= 0);
    ok("修复后更新 info.rect",
       raw.indexOf("info.rect = {") >= 0);
    ok("段落文本溢出有明确日志",
       raw.indexOf("段落文本溢出: 排版框") >= 0);
    ok("日志打印文本层类型/字号/入出点",
       raw.indexOf("段落文本(框 ") >= 0
       && raw.indexOf("点文本") >= 0
       && raw.indexOf("入/出点 ") >= 0);
    ok("日志提示时间拉伸异常",
       raw.indexOf("⚠ 拉伸 ") >= 0);
    ok("日志提示时间重映射开启",
       raw.indexOf("⚠ 时间重映射开启") >= 0);

    // 关键帧读回核对(万一宿主换算时间, 日志能直接看出来)
    var mTW2 = raw.match(/function applyTypewriter\([\s\S]*?\n    \}/);
    ok("逐字关键帧写完后读回核对",
       !!mTW2 && mTW2[0].indexOf("lastOp.keyTime(") >= 0);
    ok("核对日志含期望结束时间",
       !!mTW2 && mTW2[0].indexOf("(期望 ") >= 0);
})();

console.log("---------------------------------------------");
console.log("二十二、v0.11.7 段落框溢出改用官方 boxOverflow(不再依赖 sourceRectAtTime 语义)");
console.log("---------------------------------------------");
(function () {
    var mFit = raw.match(/function fitParagraphBox\([\s\S]*?\n    \}/);
    ok("提供段落框溢出修复函数", !!mFit);
    if (!mFit) { return; }

    ok("优先读官方 boxOverflow",
       mFit[0].indexOf("d.boxOverflow") >= 0
       && mFit[0].indexOf("var readOverflow = function ()") >= 0);
    ok("官方判定无溢出时不动用户的框",
       mFit[0].indexOf("if (ov === false) { return res; }") >= 0);
    ok("溢出时倍增找可容纳高度",
       mFit[0].indexOf("cur = Math.round(cur * 2);") >= 0);
    ok("再二分收到最小高度",
       mFit[0].indexOf("Math.floor((lo + hi) / 2)") >= 0);
    ok("写回后复核 boxOverflow",
       mFit[0].indexOf("readOverflow() !== false") >= 0);
    ok("任何失败都还原原框",
       mFit[0].indexOf("var restore = function (msg)") >= 0
       && mFit[0].indexOf("setBox(w, h);") >= 0);
    ok("改框高后恢复框位置",
       mFit[0].indexOf("restoreBoxPos(st, pos0)") >= 0);

    var mPos = raw.match(/function restoreBoxPos\([\s\S]*?\n    \}/);
    ok("提供框位置恢复函数", !!mPos);
    ok("按原 boxTextPos 写回",
       !!mPos && mPos[0].indexOf("d.boxTextPos = [pos[0], pos[1]]") >= 0);

    ok("旧版 AE 仍退回撑高探测",
       mFit[0].indexOf('res.method = "probe"') >= 0
       && mFit[0].indexOf("setBox(w, probeH)") >= 0);
    ok("日志写明检测方式与试探次数",
       raw.indexOf("官方 boxOverflow, 试探 ") >= 0);
    ok("日志明确报告无溢出",
       raw.indexOf("段落框无溢出") >= 0);
    ok("日志报告溢出行数",
       raw.indexOf('" 行"') >= 0);
})();

console.log("---------------------------------------------");
console.log("二十三、v0.11.8 段落文本单行化 + 用户原框作窗口(不再拉高框)");
console.log("---------------------------------------------");
(function () {
    // 蒙版名里存的窗口尺寸
    eq("窗口名: 带尺寸", T.buildMaskName(595, 49), "DT_窗口 595x49");
    eq("窗口名: 尺寸无效时退回原名", T.buildMaskName(0, 49), "DT_窗口");
    var b1 = T.parseMaskNameBox("DT_窗口 595x49");
    ok("解析窗口名: 拿得到尺寸", !!b1 && b1.width === 595 && b1.height === 49);
    eq("解析窗口名: 无尺寸返回 null", T.parseMaskNameBox("DT_窗口"), null);
    eq("解析窗口名: 别的蒙版返回 null", T.parseMaskNameBox("蒙版 1"), null);
    eq("清理判定: 带尺寸的蒙版也算本工具的", T.isOurMaskName("DT_窗口 595x49"), true);
    eq("清理判定: 原名仍是本工具的", T.isOurMaskName("DT_窗口"), true);
    eq("清理判定: 相似名字不误删", T.isOurMaskName("DT_窗口2"), false);

    var mFit = raw.match(/function fitParagraphBox\([\s\S]*?\n    \}/);
    ok("提供段落框修复函数", !!mFit);
    if (!mFit) { return; }

    ok("接收上次存的窗口尺寸",
       mFit[0].indexOf("compTime, prevWin") >= 0
       && mFit[0].indexOf("prevWin.width") >= 0);
    ok("返回窗口矩形(层空间)与窗口名",
       mFit[0].indexOf("windowRect:") >= 0
       && mFit[0].indexOf("res.windowRect = { left: pos0[0], top: pos0[1], width: winW, height: winH };") >= 0
       && mFit[0].indexOf("res.windowName = buildMaskName(winW, winH);") >= 0);
    ok("框高按行距/字号定一行",
       mFit[0].indexOf("Math.ceil(lead > 0 ? lead : (fs > 0 ? fs * 1.2 : h))") >= 0);
    ok("单行化只加宽不加高(高=一行)",
       mFit[0].indexOf("var layoutH = Math.max(Math.round(h), lineH);") >= 0
       && mFit[0].indexOf("setBox(w, layoutH)") >= 0);
    ok("宽度倍增找第一行不溢出",
       mFit[0].indexOf("cur = Math.round(cur * 2);") >= 0);
    ok("宽度二分收到最小一行",
       mFit[0].indexOf("Math.floor((lo + hi) / 2)") >= 0);
    ok("只把框高补到一行时不加宽(单独标记)",
       mFit[0].indexOf("res.heightOnly = true;") >= 0);
    ok("读不到框位置时不盲目加宽",
       mFit[0].indexOf("if (!pos0) {") >= 0
       && mFit[0].indexOf("无法把原框当窗口") >= 0);
    ok("超宽仍排不成一行(强制换行)会还原",
       mFit[0].indexOf("仍排不成一行") >= 0);

    var mRead = raw.match(/function readStoredWindow\([\s\S]*?\n    \}/);
    ok("提供读取已存窗口的函数", !!mRead);
    ok("按蒙版名读窗口尺寸",
       !!mRead && mRead[0].indexOf('layer.property("ADBE Mask Parade")') >= 0
       && mRead[0].indexOf("parseMaskNameBox(nm)") >= 0);

    ok("应用前先取旧窗口再清理",
       raw.indexOf("var storedWin = readStoredWindow(L0);") >= 0
       && raw.indexOf("var storedWin = readStoredWindow(L0);") < raw.indexOf("var old = clearOurAnimation(L0);"));
    ok("段落文本窗口=用户框(点文本仍用文字范围)",
       raw.indexOf("var baseRect = info2.windowRect ? info2.windowRect : info2.rect;") >= 0);
    ok("蒙版名带上原框尺寸",
       raw.indexOf("applyWindowMask(L, box, params.feather, params.strength, true, maskName);") >= 0
       && raw.indexOf("applyWindowMask(L, box, params.feather, params.strength, false, maskName);") >= 0);
    ok("蒙版命名可传入",
       raw.indexOf("function applyWindowMask(layer, box, feather, strength, outward, maskName)") >= 0
       && raw.indexOf("maskName || MASK_WINDOW_NAME") >= 0);
    ok("日志说明原框作窗口",
       raw.indexOf("作为出现窗口") >= 0
       && raw.indexOf('"你的框 "') >= 0);
})();

console.log("---------------------------------------------");
console.log("二十四、v0.11.9/v0.11.10 逐字选区改用索引单位");
console.log("---------------------------------------------");
(function () {
    var mUnits = raw.match(/function setSelectorUnits\([\s\S]*?\n    \}/);
    var mIdx = raw.match(/function setSelectorIndexMode\([\s\S]*?\n    \}/);
    var mFind = raw.match(/function findSelectorStartEnd\([\s\S]*?\n    \}/);
    ok("提供 setSelectorUnits", !!mUnits);
    ok("提供 setSelectorIndexMode", !!mIdx);
    ok("提供 findSelectorStartEnd(sel, wantIndex)", !!mFind);
    if (!mUnits || !mIdx || !mFind) { return; }
    ok("写入单位值",
       mUnits[0].indexOf("units.setValue(unitValue)") >= 0);
    ok("取不到单位属性时返回 false",
       mUnits[0].indexOf("if (!units) { return false; }") >= 0);
    ok("索引属性取不到时切回百分比",
       mIdx[0].indexOf('"ADBE Text Index Start"') >= 0
       && mIdx[0].indexOf('"ADBE Text Index End"') >= 0
       && mIdx[0].indexOf("setSelectorUnits(sel, 1)") >= 0);
    ok("依据设为字符(1)",
       mIdx[0].indexOf("based.setValue(1)") >= 0);
    ok("索引分支取 Index Start/End",
       mFind[0].indexOf('"ADBE Text Index Start"') >= 0
       && mFind[0].indexOf('"ADBE Text Index End"') >= 0);
    ok("百分比分支取 Percent Start/End",
       mFind[0].indexOf('"ADBE Text Percent Start"') >= 0
       && mFind[0].indexOf('"ADBE Text Percent End"') >= 0);
    ok("find 不再把百分比属性兜底给索引",
       mFind[0].indexOf("idxStart") < 0);
    ok("每个动画器分别切索引单位",
       raw.indexOf("var idxMode = setSelectorIndexMode(sel);") >= 0
       && raw.indexOf("useIndex") < 0);
    ok("按 idxMode 取对应属性",
       raw.indexOf("var se = findSelectorStartEnd(sel, idxMode);") >= 0);
    ok("索引模式: Start=selIdx / End=selIdx+1",
       raw.indexOf("se.start.setValue(selIdx);") >= 0
       && raw.indexOf("se.end.setValue(selIdx + 1);") >= 0);
    ok("保留百分比回退(按可见字数)",
       raw.indexOf("se.end.setValue(((selIdx + 1) / visN) * 100);") >= 0);
    ok("回退只提示一次",
       raw.indexOf("var indexWarned = false;") >= 0
       && raw.indexOf("if (!idxMode && !indexWarned)") >= 0);
    ok("回退时写诊断",
       raw.indexOf("选区无法切换索引单位") >= 0);
    ok("选区平滑度仍为 0",
       raw.indexOf("smooth.setValue(0)") >= 0);
})();

console.log("---------------------------------------------");
console.log("二十五、v0.11.11 索引/节奏改用非空白字符序号(修复空格后首字常显)");
console.log("---------------------------------------------");
(function () {
    eq("countVisibleChars 跳过空格", T.countVisibleChars("A B 好"), 3);
    eq("countVisibleChars 全空白为 0", T.countVisibleChars("  "), 0);
    eq("countVisibleChars 中文长句", T.countVisibleChars("话说大圣 朵朵"), 6);
    eq("countVisibleChars 与 countChars 的差 = 空白数",
       T.countChars("A B 好") - T.countVisibleChars("A B 好"), 2);
    ok("applyTypeScroll 计算可见字符数",
       raw.indexOf("var visN = countVisibleChars(info.text);") >= 0);
    ok("可见数为 0 时退回原始字数",
       raw.indexOf("if (!(visN > 0)) { visN = rawN; }") >= 0);
    ok("时间轴按 visN 计算",
       raw.indexOf("computeTypeScrollTiming(visN,") >= 0);
    ok("表达式按 visN 计算",
       raw.indexOf("buildTypeScrollExpression(visN,") >= 0);
    ok("逐字动画器接收 visN",
       raw.indexOf("layer.inPoint + timing.endTime, visN);") >= 0);
    ok("循环用独立 selIdx(不拿原始下标写选区)",
       raw.indexOf("var selIdx = -1;") >= 0
       && raw.indexOf("selIdx++;") >= 0);
    ok("索引模式写 selIdx / selIdx+1",
       raw.indexOf("se.start.setValue(selIdx);") >= 0
       && raw.indexOf("se.end.setValue(selIdx + 1);") >= 0);
    ok("百分比回退按 visN",
       raw.indexOf("se.start.setValue((selIdx / visN) * 100);") >= 0
       && raw.indexOf("se.end.setValue(((selIdx + 1) / visN) * 100);") >= 0);
    ok("关键帧时间按可见序号",
       raw.indexOf("var t0 = layer.inPoint + selIdx * interval;") >= 0);
    ok("日志显示可见字数",
       raw.indexOf('" 字(可见 " + countVisibleChars(info2.text)') >= 0);
})();

console.log("---------------------------------------------");
console.log((failed === 0 ? "全部通过" : "存在失败") + ": " + passed + " 通过 / " + failed + " 失败");
console.log("---------------------------------------------");
process.exit(failed ? 1 : 0);
