// ============================================================
// 时间轴错位显示工具  TimeAxisIndent.jsx
// 版本: 1.7.1  (2026-08-11)
// 适用: After Effects CC 全版本 至 2026 (ExtendScript / ScriptUI)
//
// v1.7.1 变更:自定义文字默认值调整——默认填入竖线 "|",
//   位置默认「缩进符号前」(此前默认空文字 + 缩进符号后)。
//
// v1.7 变更:新增"替换所有文字"复选框(自定义文字组下方)。
//   勾选后点「应用错位」,图层名整体变为"缩进+自定义文字",
//   原图层名丢弃(批量统一命名);仅 Ctrl+Z 可恢复原名。
//   自定义文字为空时提示并中止,避免把名字替换成纯缩进。
//
// v1.6.1 变更:「全部清除」改为跨文字剥光——从左往右剥离所有
//   树形缩进,被树形符号夹住的文字块一并删除(├- 【M】├- 图层→图层),
//   行首文字与文字中间空格保留;配合输入框文字可删缩进后的自定义文字。
//
// v1.6 变更:新增"自定义文字"输入框 + 位置选项(缩进符号前/后)。
//   应用时在缩进前缀旁附带一段自定义文字(如分组标记),可放在
//   缩进符号之前或之后;还原/清空重排时按相同位置顺序一并剥离,
//   输入框文字留空则不处理自定义文字(仅还原缩进)。
//
// v1.5 变更:操作结果不再用 alert 弹窗,改为面板底部"状态栏"显示
//   (成功/无图层等提示即时更新;仅"未激活合成"这类无法继续的
//   错误仍用弹窗提醒)。
//
// v1.4 变更:新增"应用方式"下拉(叠加缩进 / 清空重排)。
//   叠加缩进:每次应用直接追加一层(1格→2格→3格...),支持同风格/多风格累积;
//   清空重排:先清除所有旧缩进,再按本次参数统一应用。
//   作用范围(选中/全部)只决定处理哪些图层,不再隐含叠加语义。
//
// v1.2 修复:此前从"窗口 > 扩展"打开时,会同时出现两个窗口
//   (一个空的"TimeAxisIndent" Panel + 一个"时间轴错位显示" Window)。
//   根因:未接住 AE 顶层传入的 `this`(在 ScriptUI Panel 模式下,
//   `this` 即 AE 为我们创建好的 Panel 对象),脚本又自己 new 了一个
//   Window。按 Adobe 官方 Scripting Guide(CS3 起)与
//   Paul Tuersley / Aaron Cobb 标准模式修复:
//     var pal = (thisObj instanceof Panel) ? thisObj : new Window(...)
//   现在无论作为 ScriptUI Panel 运行(可停靠)还是作为普通脚本
//   双击运行(浮动),都只显示一个窗口。
//
// v1.1 修复说明(33 项断言测试通过,test_sim.js):
//   - 按风格精确剥离(保真,不误伤用户原始字符)
//   - 多风格共存 + 按风格/批次分别还原
//   - Undo 组 try/finally 保护
//
// 功能:
//   - 给时间轴图层名称添加前导缩进(全角空格 / 半角空格 / 树形符号),
//     实现"左侧错位显示",便于区分不同图层的内容。
//   - 只修改图层名称,不修改父子关系、不动关键帧、不影响动画与渲染。
//   - 不安装本脚本时,工程照常打开、图层正常显示。
//   - 一键还原;所有修改位于同一个 Undo 组,Ctrl+Z 可整体撤销。
//
// 安装:免安装,文件已复制到用户级目录
//   %APPDATA%\Adobe\After Effects\26.0\Scripts\ScriptUI Panels\
// ============================================================

(function (thisObj) {

    // ---------- 常量 ----------
    var CHAR_SPACE = " ";              // 半角空格
    var CHAR_FULL  = "\u3000";         // 全角空格(中文全角空格,缩进最明显)
    var CHAR_TREE  = "\u251c- ";  // "├- " 树形符号(用户指定样式)

    // 树形线条符集合(├ ─ └ │ ┘ ┐ ┤ 以及用户指定的 "-" 半边横线)
    var TREE_CHARS = [
        "\u251c", "\u2500", "\u2514", "\u2502",
        "\u2518", "\u2510", "\u2524", "-"
    ];
    // 空白类字符集合(半角/全角/制表)
    var SPACE_CHARS = [" ", "\u3000", "\t"];

    // ---------- 工具函数 ----------

    function isIn(ch, arr) {
        for (var i = 0; i < arr.length; i++) {
            if (ch === arr[i]) return true;
        }
        return false;
    }

    // 全部清除(style=3):从左往右扫描,剥离所有树形符号组
    // (即使中间隔着文字,一路剥到最后一个 ├-);被树形组夹住的
    // 文字块一并删除(如 ├- 【M】├- 图层 → 图层);行首/紧跟缩进
    // 的空白也剥,但普通文字中间的空白与行首文字保留,不误删。
    function stripAllIndent(name) {
        var out = "", i = 0, len = name.length, c, hasPrevTree = false;
        while (i < len) {
            c = name.charAt(i);
            if (isIn(c, TREE_CHARS)) {                    // 树形线条符组
                while (i < len && isIn(name.charAt(i), TREE_CHARS)) i++;
                if (i < len && name.charAt(i) === " ") i++; // 组后一个空格
                hasPrevTree = true;
            } else if (isIn(c, SPACE_CHARS)) {            // 空白:仅剥行首/紧跟缩进的
                if (i === 0 || hasPrevTree) {
                    i++; hasPrevTree = true;
                } else {
                    out += c; i++; hasPrevTree = false;
                }
            } else {                                      // 文字块
                var j = i;
                while (j < len && !isIn(name.charAt(j), TREE_CHARS)) j++;
                if (hasPrevTree && j < len) {             // 被树形组夹住 → 中间文字,删
                    i = j; continue;
                }
                out += name.substring(i);                  // 行首文字/末尾内容 → 保留
                break;
            }
        }
        return out;
    }

    // 按风格精确剥离前导缩进字符
    // style: 0=全角空格  1=半角空格  2=树形符号  3=全部清除
    function stripStyle(name, style) {
        var s = name, prevTree = false, c;
        while (true) {
            c = s.charAt(0);
            if (style === 0) {                       // 全角
                if (c === CHAR_FULL) { s = s.substring(1); continue; }
            } else if (style === 1) {                // 半角
                if (c === " " || c === "\t") { s = s.substring(1); continue; }
            } else if (style === 2) {                // 树形(线条符 + 紧随的一个空格)
                if (isIn(c, TREE_CHARS)) { s = s.substring(1); prevTree = true; continue; }
                if (c === " " && prevTree) { s = s.substring(1); prevTree = false; continue; }
            } else {                                 // 全部清除(跨文字剥光所有缩进)
                return stripAllIndent(name);
            }
            break;
        }
        return s;
    }

    // 从名字开头剥离自定义文字(若匹配);text 为空则原样返回
    function stripCustom(name, text) {
        if (text === "") return name;
        return (name.indexOf(text) === 0) ? name.substring(text.length) : name;
    }

    // 数行首"同风格"缩进层数(与 stripStyle 的剥离规则一致)
    // 全角/半角:每个字符一层;树形:每组"线条符+可选空格"一层
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

    // 剥净旧前缀(自定义文字 + 同风格缩进),顺序自适应:
    //   文字在行首 → 先剥文字再剥缩进;否则 → 先剥缩进再剥文字
    function stripOldPrefix(name, customText, style) {
        if (customText !== "" && name.indexOf(customText) === 0) {
            return stripStyle(stripCustom(name, customText), style);
        }
        return stripCustom(stripStyle(name, style), customText);
    }

    function repeatChar(ch, n) {
        var out = "";
        for (var i = 0; i < n; i++) out += ch;
        return out;
    }

    // UI 索引 → 缩进字符(UI 选项: 0=全角空格, 1=树形符号)
    function getUIChar(uiIdx) {
        return uiIdx === 0 ? CHAR_FULL : CHAR_TREE;
    }
    // UI 索引 → 剥离风格(0=全角, 2=树形;1=半角仅用于兼容清理旧数据)
    function getUIStripStyle(uiIdx) {
        return uiIdx === 0 ? 0 : 2;
    }

    function getComp() {
        var item = app.project.activeItem;
        if (!item || !(item instanceof CompItem)) {
            alert("请先在时间轴中激活一个合成(Comp),再运行本工具。");
            return null;
        }
        return item;
    }

    function collectLayers(comp, useSelected) {
        var out = [];
        var n = comp.layers.length;
        for (var i = 1; i <= n; i++) {
            var L = comp.layers[i];
            if (!useSelected || L.selected) out.push(L);
        }
        return out;
    }

    // ---------- 应用 / 还原 ----------

    // applyMode: 0=叠加(旧层数+本次,逐次加深), 1=清空重排(先全清再统一)
    // customText: 自定义前缀文字(可留空)
    // customPos:  0=文字在缩进符号前, 1=文字在缩进符号后
    // replaceAll: true=丢弃原名,名字整体变为"缩进+文字"(批量统一命名)
    function applyIndent(layers, style, ch, step, rule, firstSkip, applyMode, customText, customPos, replaceAll) {
        app.beginUndoGroup("时间轴错位显示:应用");
        try {
            for (var i = 0; i < layers.length; i++) {
                var name = layers[i].name, base, n;
                if (replaceAll) {
                    // 替换所有文字:原名丢弃,直接按当前参数生成前缀(等距/递进仍生效)
                    base = "";
                    n = (rule === 0) ? step : (firstSkip ? step * i : step * (i + 1));
                } else if (applyMode === 1) {
                    // 清空重排:按位置顺序剥文字 + 全剥缩进,再统一重排(不递增)
                    base = (customPos === 0)
                        ? stripStyle(stripCustom(name, customText), 3)
                        : stripCustom(stripStyle(name, 3), customText);
                    n = (rule === 0) ? step : (firstSkip ? step * i : step * (i + 1));
                } else {
                    // 叠加:剥净旧前缀,按"旧层数 + 本次层数"重建(1格→2格→3格)
                    base = stripOldPrefix(name, customText, style);
                    var oldN = countIndent(name, style);
                    var add = (rule === 0) ? step : (firstSkip ? step * i : step * (i + 1));
                    n = oldN + add;
                }
                var indent = repeatChar(ch, n);
                layers[i].name = (customPos === 0)
                    ? customText + indent + base   // 文字在前:【M】├- 图层
                    : indent + customText + base;  // 文字在后:├- 【M】图层
            }
        } finally {
            app.endUndoGroup();
        }
    }

    // style: 0/1/2 按当前字符风格还原, 3 全部清除
    // customText/customPos: 与自定义文字一致(留空则不剥文字)
    function revertIndent(layers, style, customText, customPos) {
        app.beginUndoGroup("时间轴错位显示:还原");
        try {
            for (var i = 0; i < layers.length; i++) {
                var name = layers[i].name;
                layers[i].name = (customPos === 0)
                    ? stripStyle(stripCustom(name, customText), style)
                    : stripCustom(stripStyle(name, style), customText);
            }
        } finally {
            app.endUndoGroup();
        }
    }

    // ---------- 启动检查 ----------
    if (app.project === null) {
        alert("请先打开一个 After Effects 工程,再运行本工具。");
        return;
    }

    // ---------- 创建容器(关键修复) ----------
    // 适配两种运行方式:
    //   - 作为 ScriptUI Panel 运行(放 ScriptUI Panels 目录,菜单触发):
    //       AE 把 Panel 作为 `this` 传给脚本 —— 复用它,可停靠。
    //   - 作为普通脚本运行(双击 / 文件 > 脚本 > 运行脚本文件):
    //       `this` 是 global object,需要自己 new 一个浮动 Window。
    // (Adobe 官方 Scripting Guide + Paul Tuersley / Aaron Cobb 标准模式)
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "时间轴错位显示", undefined, { resizeable: false });

    pal.orientation = "column";
    pal.alignChildren = "left";
    pal.spacing = 8;
    pal.margins = 12;

    // 作用范围
    var g1 = pal.add("group");
    g1.add("statictext", undefined, "作用范围:");
    var ddlScope = g1.add("dropdownlist", undefined, ["选中图层", "全部图层"]);
    ddlScope.selection = 0;

    // 错位规则
    var g2 = pal.add("group");
    g2.add("statictext", undefined, "错位规则:");
    var ddlRule = g2.add("dropdownlist", undefined, ["等距缩进", "按顺序递进"]);
    ddlRule.selection = 0;

    // 缩进量
    var g3 = pal.add("group");
    g3.add("statictext", undefined, "缩进量:");
        var ddlStep = g3.add("dropdownlist", undefined, ["1 格", "2 格", "3 格"]);
        ddlStep.selection = 0; // 默认 1 格

    // 缩进字符
    var g4 = pal.add("group");
    g4.add("statictext", undefined, "缩进字符:");
        var ddlChar = g4.add("dropdownlist", undefined, ["全角空格", "树形符号 ├-"]);
        ddlChar.selection = 1; // 默认树形符号

    // 首层不缩
    var cbFirst = pal.add("checkbox", undefined, "递进时首层不缩进 (0,1,2...格)");
    cbFirst.value = true;

    // 还原方式
    var g6 = pal.add("group");
    g6.add("statictext", undefined, "还原方式:");
    var ddlRevert = g6.add("dropdownlist", undefined, ["按当前字符", "全部清除"]);
    ddlRevert.selection = 0;

    // 应用方式
    var g7 = pal.add("group");
    g7.add("statictext", undefined, "应用方式:");
    var ddlApply = g7.add("dropdownlist", undefined, ["叠加缩进", "清空重排"]);
    ddlApply.selection = 0; // 默认叠加

    // 自定义文字(v1.6 新增;v1.7.1 默认=竖线 |,位置=缩进符号前)
    var g8 = pal.add("group");
    g8.add("statictext", undefined, "自定义文字:");
    var edtCustom = g8.add("edittext", undefined, "|");
    edtCustom.characters = 12;
    var ddlCustomPos = g8.add("dropdownlist", undefined, ["缩进符号前", "缩进符号后"]);
    ddlCustomPos.selection = 0; // 默认文字在缩进符号前

    // 替换所有文字(v1.7 新增):勾选后应用时丢弃原名,整体统一命名
    var cbReplace = pal.add("checkbox", undefined, "替换所有文字(丢弃原名,仅 Ctrl+Z 可恢复)");
    cbReplace.value = false;

    // 按钮
    var g5 = pal.add("group");
    g5.alignment = "center";
    var btnApply  = g5.add("button", undefined, "应用错位");
    var btnRevert = g5.add("button", undefined, "还原错位");

    var tip1 = pal.add("statictext", undefined, "提示:叠加=逐次加深;重排=先清后统一。");
    var tip2 = pal.add("statictext", undefined, "还原只剥最外层同风格前缀;Ctrl+Z 可整体撤销。");
    var tip3 = pal.add("statictext", undefined, "自定义文字:还原前保持输入一致,才能一并剥离。");

    // 状态栏(显示操作结果,替代弹窗)
    var statusBar = pal.add("statictext", undefined, "就绪:选择图层后即可应用错位。");
    statusBar.alignment = "left";

    // ---------- 逻辑 ----------
    btnApply.onClick = function () {
        var comp = getComp();
        if (!comp) return;
        var useSelected = (ddlScope.selection.index === 0);
        var layers = collectLayers(comp, useSelected);
        if (layers.length === 0) {
            statusBar.text = "没有可处理的图层" + (useSelected ? "(请先在时间轴中选中图层)" : "。");
            return;
        }
        var uiIdx = ddlChar.selection.index;
        var style = getUIStripStyle(uiIdx);
        var ch    = getUIChar(uiIdx);
        var step  = ddlStep.selection.index + 1;
        var rule  = ddlRule.selection.index;          // 0 等距, 1 递进
        var firstSkip = cbFirst.value;
        var customText = edtCustom.text;
        var customPos  = ddlCustomPos.selection.index;
        var replaceAll = cbReplace.value;

        // 替换所有文字必须搭配自定义文字,否则名字会变成纯缩进
        if (replaceAll && customText === "") {
            statusBar.text = "替换所有文字需要先输入自定义文字,本次未执行。";
            return;
        }

        applyIndent(layers, style, ch, step, rule, firstSkip, ddlApply.selection.index, customText, customPos, replaceAll);
        statusBar.text = "已对 " + layers.length + " 个图层应用错位显示。" + (replaceAll ? "(已替换全部文字)" : "");
    };

    btnRevert.onClick = function () {
        var comp = getComp();
        if (!comp) return;
        var useSelected = (ddlScope.selection.index === 0);
        var layers = collectLayers(comp, useSelected);
        if (layers.length === 0) {
            statusBar.text = "没有可处理的图层" + (useSelected ? "(请先在时间轴中选中图层)" : "。");
            return;
        }
        var style = (ddlRevert.selection.index === 0) ? getUIStripStyle(ddlChar.selection.index) : 3;
        revertIndent(layers, style, edtCustom.text, ddlCustomPos.selection.index);
        statusBar.text = "已还原 " + layers.length + " 个图层。";
    };

    // ---------- 显示 ----------
    if (pal instanceof Window) {
        pal.center();
        pal.show();
    } else {
        // ScriptUI Panel: AE 自己托管显示,只需 layout 刷新
        pal.layout.layout(true);
    }

})(this);