// ============================================================
// TimeAxisIndent 模拟测试 — 用 10 个使用方案验证核心逻辑
// 复刻 jsx 中的字符串处理逻辑(不含 AE API),Node 可直接运行。
// 对比: v1.0 旧逻辑(全字符集剥离) vs v1.1 新逻辑(按风格精确剥离)
// ============================================================

"use strict";

// ---------- 字符常量(与 jsx 保持一致) ----------
var CHAR_SPACE = " ";
var CHAR_FULL  = "\u3000";
var CHAR_TREE  = "\u251c- ";            // "├─ "
var TREE_CHARS  = ["\u251c","\u2500","\u2514","\u2502","\u2518","\u2510","\u2524","-"]; // ├ ─ └ │ ┘ ┐ ┤ -
var SPACE_CHARS = [" ", "\u3000", "\t"];

// ---------- v1.0 旧逻辑 ----------
var STRIP_CHARS = [" ", "\u3000", "\t"].concat(TREE_CHARS);
function origStrip(name) {
    var s = name, changed = true;
    while (changed) {
        changed = false;
        for (var i = 0; i < STRIP_CHARS.length; i++) {
            if (s.charAt(0) === STRIP_CHARS[i]) { s = s.substring(1); changed = true; break; }
        }
    }
    return s;
}

// ---------- v1.1 新逻辑 ----------
function isIn(ch, arr) { for (var i = 0; i < arr.length; i++) if (ch === arr[i]) return true; return false; }

// 全部清除(style=3):从左往右扫描,剥离所有树形符号组
// (即使中间隔着文字,一路剥到最后一个 ├-);被树形组夹住的
// 文字块一并删除(如 ├- 【M】├- 图层 → 图层);行首/紧跟缩进
// 的空白也剥,但普通文字中间的空白与行首文字保留,不误删。
function stripAllIndent(name) {
    var out = "", i = 0, len = name.length, c, hasPrevTree = false;
    while (i < len) {
        c = name.charAt(i);
        if (isIn(c, TREE_CHARS)) {
            while (i < len && isIn(name.charAt(i), TREE_CHARS)) i++;
            if (i < len && name.charAt(i) === " ") i++;
            hasPrevTree = true;
        } else if (isIn(c, SPACE_CHARS)) {
            if (i === 0 || hasPrevTree) {
                i++; hasPrevTree = true;
            } else {
                out += c; i++; hasPrevTree = false;
            }
        } else {
            var j = i;
            while (j < len && !isIn(name.charAt(j), TREE_CHARS)) j++;
            if (hasPrevTree && j < len) {
                i = j; continue;
            }
            out += name.substring(i);
            break;
        }
    }
    return out;
}

// style: 0=全角  1=半角  2=树形  3=全部清除
function stripStyle(name, style) {
    var s = name, prevTree = false, c;
    while (true) {
        c = s.charAt(0);
        if (style === 0) {
            if (c === CHAR_FULL) { s = s.substring(1); continue; }
        } else if (style === 1) {
            if (c === " " || c === "\t") { s = s.substring(1); continue; }
        } else if (style === 2) {
            if (isIn(c, TREE_CHARS)) { s = s.substring(1); prevTree = true; continue; }
            if (c === " " && prevTree) { s = s.substring(1); prevTree = false; continue; }
        } else {
            return stripAllIndent(name);
        }
        break;
    }
    return s;
}

function repeatChar(ch, n) { var out = ""; for (var i = 0; i < n; i++) out += ch; return out; }

// 从名字开头剥离自定义文字(若匹配);text 为空则原样返回
function stripCustom(name, text) {
    if (text === "") return name;
    return (name.indexOf(text) === 0) ? name.substring(text.length) : name;
}

// 数行首"同风格"缩进层数(与 stripStyle 的剥离规则一致)
function countIndent(name, style) {
    var s = name, c, count = 0;
    while (true) {
        c = s.charAt(0);
        if (style === 0 && c === CHAR_FULL) {
            s = s.substring(1); count++; continue;
        }
        if (style === 1 && (c === " " || c === "\t")) {
            s = s.substring(1); count++; continue;
        }
        if (style === 2 && isIn(c, TREE_CHARS)) {
            while (isIn(s.charAt(0), TREE_CHARS)) s = s.substring(1);
            if (s.charAt(0) === " ") s = s.substring(1);
            count++; continue;
        }
        break;
    }
    return count;
}

// 剥净旧前缀(自定义文字 + 同风格缩进),顺序自适应
function stripOldPrefix(name, customText, style) {
    if (customText !== "" && name.indexOf(customText) === 0) {
        return stripStyle(stripCustom(name, customText), style);
    }
    return stripCustom(stripStyle(name, style), customText);
}

// 应用缩进(纯函数,与 jsx 的 applyIndent 逻辑一致)
// applyMode: 0=叠加(旧层数+本次,逐次加深), 1=清空重排(先全剥再统一)
// customText: 自定义前缀文字(可留空);customPos: 0=文字在缩进前, 1=文字在缩进后
// replaceAll: true=丢弃原名,名字整体变为"缩进+文字"
// 不传 applyMode 时向后兼容: useSelected=true → 叠加, false → 重排
function applyLayers(all, selSet, useSelected, style, step, rule, firstSkip, applyMode, customText, customPos, replaceAll) {
    if (applyMode === undefined) applyMode = useSelected ? 0 : 1;
    if (customText === undefined) customText = "";
    if (customPos === undefined) customPos = 1;
    if (replaceAll === undefined) replaceAll = false;
    var targets = [];
    for (var i = 0; i < all.length; i++) {
        if (!useSelected || selSet.indexOf(i) >= 0) targets.push(all[i]);
    }
    for (var j = 0; j < targets.length; j++) {
        var name = targets[j].name, base, n;
        if (replaceAll) {
            base = "";
            n = (rule === 0) ? step : (firstSkip ? step * j : step * (j + 1));
        } else if (applyMode === 1) {
            base = (customPos === 0)
                ? stripStyle(stripCustom(name, customText), 3)
                : stripCustom(stripStyle(name, 3), customText);
            n = (rule === 0) ? step : (firstSkip ? step * j : step * (j + 1));
        } else {
            base = stripOldPrefix(name, customText, style);
            var oldN = countIndent(name, style);
            var add = (rule === 0) ? step : (firstSkip ? step * j : step * (j + 1));
            n = oldN + add;
        }
        var indent = repeatChar(getChar(style), n);
        targets[j].name = (customPos === 0)
            ? customText + indent + base
            : indent + customText + base;
    }
}
function getChar(style) { return style === 0 ? CHAR_FULL : (style === 1 ? CHAR_SPACE : CHAR_TREE); }

// 还原(纯函数)
function revertLayers(all, selSet, useSelected, style, customText, customPos) {
    if (customText === undefined) customText = "";
    if (customPos === undefined) customPos = 1;
    var targets = [];
    for (var i = 0; i < all.length; i++) {
        if (!useSelected || selSet.indexOf(i) >= 0) targets.push(all[i]);
    }
    for (var j = 0; j < targets.length; j++) {
        var name = targets[j].name;
        targets[j].name = (customPos === 0)
            ? stripStyle(stripCustom(name, customText), style)
            : stripCustom(stripStyle(name, style), customText);
    }
}

// ---------- 测试框架 ----------
var pass = 0, fail = 0;
function names(arr) { return arr.map(function (o) { return o.name; }); }
function mk(arr) { return arr.map(function (n) { return { name: n }; }); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function test(label, actual, expected) {
    if (eq(actual, expected)) { pass++; console.log("  [PASS] " + label); }
    else { fail++; console.log("  [FAIL] " + label); console.log("        实际:   " + JSON.stringify(actual)); console.log("        期望:   " + JSON.stringify(expected)); }
}

// ============================================================
// 场景 1:大工程分层整理(全选 + 递进 + 全角 1 格 + 首层不缩)
// ============================================================
console.log("\n=== 方案1:全选递进全角 ===");
{
    var L = mk(["A", "B", "C", "D"]);
    applyLayers(L, [], false, 0, 1, 1, true);
    test("应用后阶梯错位", names(L), ["A", "\u3000B", "\u3000\u3000C", "\u3000\u3000\u3000D"]);
    revertLayers(L, [], false, 0);
    test("还原后原样", names(L), ["A", "B", "C", "D"]);
}

// ============================================================
// 场景 2:等距半角 2 格
// ============================================================
console.log("\n=== 方案2:等距半角 ===");
{
    var L = mk(["A", "B"]);
    applyLayers(L, [], false, 1, 2, 0, true);
    test("等距2格半角", names(L), ["  A", "  B"]);
    revertLayers(L, [], false, 1);
    test("还原原样", names(L), ["A", "B"]);
}

// ============================================================
// 场景 3:选中部分图层 + 树形等距(重点标记)
// ============================================================
console.log("\n=== 方案3:选中树形 ===");
{
    var L = mk(["A", "B", "C"]);
    applyLayers(L, [0, 2], true, 2, 1, 0, true);
    test("仅选中层加树形", names(L), ["\u251c- A", "B", "\u251c- C"]);
    revertLayers(L, [0, 2], true, 2);
    test("仅还原选中层,B 不动", names(L), ["A", "B", "C"]);
}

// ============================================================
// 场景 4:递进树形(动画节奏可视化)
// ============================================================
console.log("\n=== 方案4:递进树形 ===");
{
    var L = mk(["A", "B", "C"]);
    applyLayers(L, [], false, 2, 1, 1, true);
    test("递进树形", names(L), ["A", "\u251c- B", "\u251c- \u251c- C"]);
    revertLayers(L, [], false, 2);
    test("还原全清", names(L), ["A", "B", "C"]);
}

// ============================================================
// 场景 5:临时区分 + 交付前还原
// ============================================================
console.log("\n=== 方案5:应用->还原->与原样一致 ===");
{
    var L = mk(["\u6807\u9898A", "\u6807\u9898B"]); // 标题A 标题B
    applyLayers(L, [], false, 0, 2, 0, true);
    test("应用后", names(L), ["\u3000\u3000\u6807\u9898A", "\u3000\u3000\u6807\u9898B"]);
    revertLayers(L, [], false, 0);
    test("还原后与初始完全一致", names(L), ["\u6807\u9898A", "\u6807\u9898B"]);
}

// ============================================================
// 场景 6:多层递进规律(百层抽样)
// ============================================================
console.log("\n=== 方案6:多层递进规律 ===");
{
    var L = mk(["L1", "L2", "L3", "L4", "L5", "L6"]);
    applyLayers(L, [], false, 1, 1, 1, true);
    test("0,1,2,3,4,5 格递进", names(L), ["L1", " L2", "  L3", "   L4", "    L5", "     L6"]);
}

// ============================================================
// 场景 7:分批不同字符共存(父子链层树形 + 普通层全角)
// ============================================================
console.log("\n=== 方案7:分批共存 ===");
{
    var L = mk(["A", "B", "C", "D"]);
    applyLayers(L, [1, 2], true, 2, 1, 0, true); // 批1:B、C 树形
    test("批1后", names(L), ["A", "\u251c- B", "\u251c- C", "D"]);
    applyLayers(L, [3], true, 0, 2, 0, true);     // 批2:D 全角2格
    test("批2后,批1树形保留", names(L), ["A", "\u251c- B", "\u251c- C", "\u3000\u3000D"]);
    revertLayers(L, [1, 2], true, 2);             // 还原批1
    test("还原批1,批2保留", names(L), ["A", "B", "C", "\u3000\u3000D"]);
    revertLayers(L, [3], true, 0);                // 还原批2
    test("还原批2,全部原样", names(L), ["A", "B", "C", "D"]);
}

// ============================================================
// 场景 8:三批不同字符 + 分别还原(版本对比)
// ============================================================
console.log("\n=== 方案8:三批分别还原 ===");
{
    var L = mk(["V1", "V2", "V3"]);
    applyLayers(L, [0], true, 0, 2, 0, true); // V1 全角2格
    applyLayers(L, [1], true, 2, 1, 0, true); // V2 树形1格
    applyLayers(L, [2], true, 1, 3, 0, true); // V3 半角3格
    test("三批共存", names(L), ["\u3000\u3000V1", "\u251c- V2", "   V3"]);
    revertLayers(L, [0], true, 0);
    test("还原V1,V2/V3不动", names(L), ["V1", "\u251c- V2", "   V3"]);
    revertLayers(L, [1], true, 2);
    revertLayers(L, [2], true, 1);
    test("全部还原", names(L), ["V1", "V2", "V3"]);
}

// ============================================================
// 场景 9:隐藏/锁定层状态管理(只处理选中层)
// ============================================================
console.log("\n=== 方案9:选中层递进,未选层不动 ===");
{
    var L = mk(["A", "B", "C", "D"]);
    applyLayers(L, [0, 1, 2], true, 0, 1, 1, true);
    test("只处理选中层,D 不动", names(L), ["A", "\u3000B", "\u3000\u3000C", "D"]);
    revertLayers(L, [0, 1, 2], true, 0);
    test("还原选中层", names(L), ["A", "B", "C", "D"]);
}

// ============================================================
// 场景 10:排序后递进 + 全部清除还原
// ============================================================
console.log("\n=== 方案10:排序递进 + 全清 ===");
{
    var L = mk(["T1", "T2", "T3", "T4"]);
    applyLayers(L, [], false, 0, 1, 1, true);
    test("按时间顺序阶梯", names(L), ["T1", "\u3000T2", "\u3000\u3000T3", "\u3000\u3000\u3000T4"]);
    revertLayers(L, [], false, 3); // 全部清除
    test("全清还原", names(L), ["T1", "T2", "T3", "T4"]);
}

// ============================================================
// 场景 11:叠加缩进(同风格逐次加深,用户新增需求)
// ============================================================
console.log("\n=== 方案11:应用方式=叠加(同风格逐次加深) ===");
{
    var L = mk(["A", "B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0); // 第1次:树形1格
    test("第1次:1格", names(L), ["\u251c- A", "\u251c- B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0); // 第2次:再叠加1格
    test("第2次:叠加为2格", names(L), ["\u251c- \u251c- A", "\u251c- \u251c- B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0); // 第3次:叠加为3格
    test("第3次:叠加为3格", names(L), ["\u251c- \u251c- \u251c- A", "\u251c- \u251c- \u251c- B"]);
    revertLayers(L, [0, 1], true, 2);               // 树形还原
    test("树形还原后原样", names(L), ["A", "B"]);
}

// ============================================================
// 场景 12:应用方式=清空重排(先清旧缩进再统一)
// ============================================================
console.log("\n=== 方案12:应用方式=清空重排 ===");
{
    var L = mk(["A", "B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0);  // 先叠加1格树形
    applyLayers(L, [0, 1], true, 0, 2, 0, true, 1);  // 再清空重排:全角2格
    test("旧树形被清,统一为全角2格", names(L), ["\u3000\u3000A", "\u3000\u3000B"]);
}

// ============================================================
// 场景 13:自定义文字 + 树形 + 位置=缩进符号后(v1.6 新功能)
// ============================================================
console.log("\n=== 方案13:自定义文字在缩进符号后 ===");
{
    var L = mk(["A", "B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0, "\u3010M\u3011", 1); // 【M】在缩进后
    test("应用后", names(L), ["\u251c- \u3010M\u3011A", "\u251c- \u3010M\u3011B"]);
    revertLayers(L, [0, 1], true, 2, "\u3010M\u3011", 1);
    test("还原后原样", names(L), ["A", "B"]);
}

// ============================================================
// 场景 14:自定义文字 + 位置=缩进符号前
// ============================================================
console.log("\n=== 方案14:自定义文字在缩进符号前 ===");
{
    var L = mk(["A", "B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0, "\u3010M\u3011", 0); // 【M】在缩进前
    test("应用后", names(L), ["\u3010M\u3011\u251c- A", "\u3010M\u3011\u251c- B"]);
    revertLayers(L, [0, 1], true, 2, "\u3010M\u3011", 0);
    test("还原后原样", names(L), ["A", "B"]);
}

// ============================================================
// 场景 15:叠加模式 + 自定义文字(只保留一份,不重复叠加)
// ============================================================
console.log("\n=== 方案15:叠加时自定义文字不重复 ===");
{
    var L = mk(["A"]);
    applyLayers(L, [0], true, 2, 1, 0, true, 0, "\u3010M\u3011", 1); // 第1次
    test("第1次", names(L), ["\u251c- \u3010M\u3011A"]);
    applyLayers(L, [0], true, 2, 1, 0, true, 0, "\u3010M\u3011", 1); // 第2次
    test("第2次(文字仍1份)", names(L), ["\u251c- \u251c- \u3010M\u3011A"]);
    applyLayers(L, [0], true, 2, 1, 0, true, 0, "\u3010M\u3011", 0); // 换到缩进前
    test("换位置:文字移到最前", names(L), ["\u3010M\u3011\u251c- \u251c- \u251c- A"]);
    revertLayers(L, [0], true, 2, "\u3010M\u3011", 0);
    test("还原后原样", names(L), ["A"]);
}

// ============================================================
// 场景 16:清空重排 + 自定义文字(旧文字一并清除)
// ============================================================
console.log("\n=== 方案16:清空重排清除旧自定义文字 ===");
{
    var L = mk(["A", "B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0, "\u3010M\u3011", 1); // 先叠加树形+【M】
    applyLayers(L, [0, 1], true, 0, 2, 0, true, 1, "\u3010M\u3011", 1);  // 清空重排:全角2格+【M】
    test("旧前缀被清,统一为全角2格+【M】", names(L), ["\u3000\u3000\u3010M\u3011A", "\u3000\u3000\u3010M\u3011B"]);
    applyLayers(L, [0, 1], true, 0, 1, 0, true, 1, "", 1);              // 文字留空:无从剥离,旧文字保留
    test("文字留空时重排:旧文字保留(不误删)", names(L), ["\u3000\u3010M\u3011A", "\u3000\u3010M\u3011B"]);
}

// ============================================================
// 场景 17:自定义文字 + 递进(位置=缩进符号后)
// ============================================================
console.log("\n=== 方案17:自定义文字递进 ===");
{
    var L = mk(["A", "B", "C"]);
    applyLayers(L, [], false, 2, 1, 1, true, 0, "[BG]", 1);
    test("递进+文字", names(L), ["[BG]A", "\u251c- [BG]B", "\u251c- \u251c- [BG]C"]);
    revertLayers(L, [], false, 3, "[BG]", 1); // 全部清除
    test("全清还原", names(L), ["A", "B", "C"]);
}

// ============================================================
// 场景 18:还原时自定义文字不匹配 → 保留原名(不误删)
// ============================================================
console.log("\n=== 方案18:还原文字不匹配不误删 ===");
{
    var L = mk(["\u3010X\u3011\u251c- A"]); // 手写名字:【X】├- A
    revertLayers(L, [0], true, 2, "\u3010M\u3011", 0); // 想还原【M】,实际是【X】
    test("文字不匹配:原名保留", names(L), ["\u3010X\u3011\u251c- A"]);
}

// ============================================================
// 场景 19:全部清除跨文字剥离 + 中间文字一起删(用户需求)
// ============================================================
console.log("\n=== 方案19:全部清除跨文字剥光缩进 ===");
{
    var L = mk(["\u251c- \u3010M\u3011\u251c- \u56fe\u5c42"]); // ├- 【M】├- 图层
    revertLayers(L, [0], true, 3, "", 1);
    test("被树形夹住的文字一起删", names(L), ["\u56fe\u5c42"]);

    var L2 = mk(["\u251c- \u3000\u3000\u6807\u9898"]); // ├- 　　标题(树形包全角)
    revertLayers(L2, [0], true, 3, "", 1);
    test("树形+全角混叠一步清光", names(L2), ["\u6807\u9898"]);

    var L3 = mk(["\u6211\u7684 \u56fe\u5c42"]); // 我的 图层(中间普通空格)
    revertLayers(L3, [0], true, 3, "", 1);
    test("普通文字中间空格不误删", names(L3), ["\u6211\u7684 \u56fe\u5c42"]);

    // 应用树形2格+【M】后再全部清除(带文字,位置=后)
    var L4 = mk(["A"]);
    applyLayers(L4, [0], true, 2, 2, 0, true, 0, "\u3010M\u3011", 1); // ├- ├- 【M】A
    test("应用后", names(L4), ["\u251c- \u251c- \u3010M\u3011A"]);
    revertLayers(L4, [0], true, 3, "\u3010M\u3011", 1); // 全部清除:文字一致→一起删
    test("全部清除:缩进与文字都剥", names(L4), ["A"]);
}

// ============================================================
// 场景 20:替换所有文字(v1.7 新功能:丢弃原名,整体统一命名)
// ============================================================
console.log("\n=== 方案20:替换所有文字 ===");
{
    var L = mk(["A", "B"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0, "\u3010M\u3011", 1, true); // 树形1格+【M】+替换
    test("位置后:名字整体变为前缀", names(L), ["\u251c- \u3010M\u3011", "\u251c- \u3010M\u3011"]);
    applyLayers(L, [0, 1], true, 2, 1, 0, true, 0, "\u3010M\u3011", 0, true); // 换位置=前
    test("位置前:文字移到最前", names(L), ["\u3010M\u3011\u251c- ", "\u3010M\u3011\u251c- "]);

    var L2 = mk(["X", "Y", "Z"]);
    applyLayers(L2, [], false, 2, 1, 1, true, 0, "[BG]", 1, true); // 递进+替换
    test("递进+替换:0,1,2格阶梯", names(L2), ["[BG]", "\u251c- [BG]", "\u251c- \u251c- [BG]"]);

    var L3 = mk(["A", "B"]);
    applyLayers(L3, [0, 1], true, 0, 2, 0, true, 0, "", 1, true); // 空文字+替换(jsx UI 层会中止)
    test("空文字+替换:名字=纯缩进(UI 层会拦截)", names(L3), ["\u3000\u3000", "\u3000\u3000"]);
}

// ============================================================
// Bug 对照 1:用户原始装饰字符保真(v1.0 会误删)
// ============================================================
console.log("\n=== Bug对照1:名字带装饰字符(─ 开头) ===");
{
    var name0 = "\u2500\u2500\u2500 \u5206\u9694\u7ebf"; // "─── 分隔线"
    // v1.0:应用全角2格
    var s10 = repeatChar(CHAR_FULL, 2) + origStrip(name0);
    test("v1.0 应用后(装饰被吞)", s10, "\u3000\u3000\u5206\u9694\u7ebf");
    // v1.1:应用全角2格
    var s11 = repeatChar(CHAR_FULL, 2) + stripStyle(name0, 0);
    test("v1.1 应用后(装饰保留)", s11, "\u3000\u3000\u2500\u2500\u2500 \u5206\u9694\u7ebf");
    // v1.1 还原
    test("v1.1 还原后与原样一致", stripStyle(s11, 0), name0);
}

// ============================================================
// Bug 对照 2:同层多风格叠加 + 分风格还原(v1.0 后覆盖先)
// ============================================================
console.log("\n=== Bug对照2:同层叠加两种风格 ===");
{
    var name0 = "X";
    // v1.1:先树形再全角
    var a = stripStyle(name0, 2), b = repeatChar(CHAR_TREE, 1) + a;
    var c = stripStyle(b, 0), d = repeatChar(CHAR_FULL, 2) + c;
    test("v1.1 叠加后(两风格共存)", d, "\u3000\u3000\u251c- X");
    test("v1.1 还原全角(树形保留)", stripStyle(d, 0), "\u251c- X");
    test("v1.1 再还原树形(全清)", stripStyle("\u251c- X", 2), "X");

    // v1.0:第二次应用会把树形全剥(后覆盖先,且无法分风格还原)
    var s10 = repeatChar(CHAR_FULL, 2) + origStrip(repeatChar(CHAR_TREE, 1) + origStrip(name0));
    test("v1.0 叠加后(树形被吞)", s10, "\u3000\u3000X");
}

// ============================================================
// Bug 对照 3:v1.0 还原误伤其他风格前缀
// ============================================================
console.log("\n=== Bug对照3:还原误伤 ===");
{
    var mixed = "\u251c- \u3000\u3000\u6807\u9898"; // "├─ 　　标题"(全角被树形包在里层)
    test("v1.1 全角还原:里层被外层挡住→无操作", stripStyle(mixed, 0), mixed);
    test("v1.1 先剥外层树形,再剥内层全角→两步干净", stripStyle(stripStyle(mixed, 2), 0), "\u6807\u9898");
    test("v1.1 按树形还原(行首树形)", stripStyle(mixed, 2), "\u3000\u3000\u6807\u9898");
    test("v1.0 还原(全剥,无法分步)", origStrip(mixed), "\u6807\u9898");
}

// ============================================================
console.log("\n----------------------------------------");
console.log("结果: " + pass + " 通过, " + fail + " 失败");
process.exit(fail ? 1 : 0);
