// ============================================================
// 面板模板  PanelTemplate.jsx
// 版本: 0.1.0  (2026-09-21)
// 适用: After Effects 2015.3+ 至 2026 (ExtendScript / ScriptUI)
//
// ⚠️ 这是【骨架模板】, 不是可直接交付的面板。派生成新面板的三步:
//     ① 复制 _template/ 到 panels/<你的面板名>/, 重命名 .jsx (与目录同名)
//     ② 替换两个标识: TOOL_ID(英文) / TOOL_TITLE(中文显示名)
//        —— 用脚手架一条命令自动做: python new_panel.py MyPanel "我的面板"
//     ③ 把「示例逻辑」段(全文件搜 `示例`)替换成真实业务
//    详见同目录 README.md。
//
// 这个骨架承载的是【踩过坑之后才定下来的约定】, 每一条都有出处;
//   ❌ 不要为了"看起来简洁"删掉 safeRun 包裹 / 闸门位置 / pinW 三处写 —
//      它们看着冗余, 但各自对应一次真实的"面板打不开 / 点了没反应"。
//
// 变更说明(倒序, 最新在上):
//   无(模板初版)
// ============================================================
(function (thisObj) {

    // ============================================================
    // 一、标识与版本
    // ============================================================
    // ⚠️ 版本号是【单一真相】, 三处必须一致, 否则 verify.py 直接失败:
    //      ① 本常量 VER   ② CHANGELOG.md 顶部标题   ③ 面板顶部显示(v + VER)
    //   为什么较真: ScriptUI Panel 由 AE【启动时】载入 —— 改完脚本不重启 AE,
    //   面板里跑的还是旧版, 而 AE 报的错可能是【旧文件】的行号。
    //   (2026-09-21 实测: AE 比脚本早启动 33 分钟, 报的「行 2069」属于旧文件)
    //   没有版本号, 用户就无从判断 AE 里跑的是不是最新的。
    var VER = "0.1.0";

    // ---- 派生时替换这两行(脚手架自动处理) ----
    var TOOL_ID    = "PanelTemplate";   // 英文标识: 文件/函数/导出名用
    var TOOL_TITLE = "面板模板";         // 中文显示名: 窗口标题 / 图层名 / 按钮文案

    // 所有"魔法字符串"(图层名 / 控件名 / 预设文件名)集中在此 ——
    //   散写在代码里就会出现"改了一处漏了另一处"(本仓库真实发生过: 提示文档里的
    //   旧名「山峰 高度」在代码改名后没同步)。
    var LAYER_CTRL = TOOL_TITLE + " 控制器";
    var SL_VALUE   = "示例数值";          // 控制器上的一个数值控件

    // ============================================================
    // 二、纯逻辑层 —— 【只做数学/字符串, 绝不碰 AE API】
    // ============================================================
    // 为什么单独成层: 这一层能在 node 里直接跑断言(test_PanelTemplate.js),
    //   是"改完立即验"的唯一抓手 —— 没有它, 每个改动都只能靠肉眼看渲染结果。
    // ⚠️ 如果同一套数学还要写进 AE 表达式(如 buildExprCore), 必须【手工镜像】,
    //   并在测试里逐值比对。本仓库的 ftype 分叉就是漏了这条: 纯函数用 `=== 1/2/3`
    //   精确匹配、表达式用阈值分段, 非法枚举值时两侧结论不同, 画面与状态栏数字对不上。
    function clampNum(v, lo, hi) {
        v = Number(v);
        if (isNaN(v)) { v = lo; }
        return v < lo ? lo : (v > hi ? hi : v);
    }

    function clampInt(v, lo, hi) {
        return Math.round(clampNum(v, lo, hi));
    }

    // ---- 示例纯函数: 换成真实算法 ----
    // 归一化到 [0,1] —— 典型的小纯函数, 便于演示"可被 node 断言"
    function exampleNormalize(v, lo, hi) {
        if (!(hi > lo)) { return 0; }
        return clampNum((Number(v) - lo) / (hi - lo), 0, 1);
    }

    // ============================================================
    // 三、node 测试导出闸门
    // ============================================================
    // ⚠️ 位置有【硬约束】, 上下都不能挪:
    //     上移 → 纯函数还没定义, 导出的是 undefined;
    //     下移 → node 里会先执行 AE 代码(app 未定义)而崩。
    //   正确位置 = 所有纯函数定义之后、任何 AE API 调用之前。
    //   末尾的 `return` 是灵魂: 让 node 路径到此为止, 绝不往下走 UI 代码。
    if (typeof app === "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            module.exports = {
                clampNum: clampNum,
                clampInt: clampInt,
                exampleNormalize: exampleNormalize,
                VER: VER,
                NAMES: { ctrl: LAYER_CTRL, slValue: SL_VALUE, toolTitle: TOOL_TITLE, toolId: TOOL_ID }
            };
        }
        return;
    }

    // ============================================================
    // 四、AE 层(以下代码只在 AE 里执行)
    // ============================================================
    var C_OK   = [0.10, 0.75, 0.35];
    var C_WARN = [0.85, 0.55, 0.10];
    var C_ERR  = [0.90, 0.25, 0.20];

    // ---------- 状态栏 ----------
    function setStatus(pal, msg, rgb) {
        try {
            if (!pal.status) { return; }
            pal.status.text = msg;
            var pen = pal.status.graphics.newPen(0, rgb, 1);
            pal.status.graphics.foregroundColor = pen;
        } catch (e) { /* 颜色设置失败不影响文本 */ }
        try { pal.layout.layout(true); } catch (e2) {}
        // ⚠️ 这里【不要】调 layout.resize() —— 状态栏文本变长时它会按新的首选宽度
        //    把面板撑宽。宽度已在建控件时钉死(pinW), 无需 resize。
    }

    // ---------- 诊断三件套(diag 收集 → 调试区显示 → 复制拿走) ----------
    // 为什么必须有: AE 的 ScriptUI handler 抛错是【完全静默】的(没有控制台),
    //   用户看到的就是"点击没反应"。没有诊断输出, 只能靠猜。
    var gDiag = [];
    function diag(msg) { try { gDiag.push(String(msg)); } catch (e) {} }
    function flushDiag(p) {
        try { if (p && p.debugBox) { p.debugBox.text = gDiag.join("\n"); } } catch (e) {}
    }
    // 从只读框复制: 激活 → 全选(23) → 复制(19)。这是 NumCounter 真机验证过的做法。
    function copyBoxToClipboard(box) {
        try {
            box.active = true;
            app.executeCommand(23);
            app.executeCommand(19);
        } catch (e) { diag("复制失败: " + e); }
    }

    // ---------- 合成前置条件 ----------
    function getComp() {
        var item = app.project ? app.project.activeItem : null;
        if (!item || !(item instanceof CompItem)) { return null; }
        return item;
    }
    // 「未激活合成」统一弹窗。
    //   为什么必须弹窗: 状态栏在面板最底部, 极易被忽略 —— 用户看到的现象就是"点按钮没反应"。
    //   本仓库规范: 操作结果走状态栏, 但"未激活合成"这类【前置条件】值得弹窗。
    //   ⚠️ 弹窗是模态的, 期间 AE 会拒绝 scheduleTask 轮询(报"当模式对话框正在等待回应时,
    //      无法运行脚本")—— 用户关掉弹窗即恢复, 属已知取舍, 换取"点了有反应"。
    function needCompAlert() {
        try { alert("请先在时间轴里激活一个合成(在时间轴面板里点一下该合成), 再操作。"); } catch (e) {}
    }

    // ---------- 图层工具 ----------
    function findLayer(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) { return comp.layer(i); }
        }
        return null;
    }
    function findEffect(layer, name) {
        if (!layer || !layer.property("ADBE Effect Parade")) { return null; }
        var fx = layer.property("ADBE Effect Parade");
        for (var i = 1; i <= fx.numProperties; i++) {
            if (fx.property(i).name === name) { return fx.property(i); }
        }
        return null;
    }
    function findSlider(layer, name) {
        var e = findEffect(layer, name);
        return e ? e.property(1) : null;
    }

    // ---------- safeRun: 所有按钮 handler 的唯一入口 ----------
    // AE 的 ScriptUI handler 抛错【静默】—— 这就是"点击没反应"的根源。
    // 这里兜住并弹可复制的错误详情。⚠️ 每个 onClic/onChange 都必须经它, 不许裸写。
    function safeRun(label, fn) {
        return function () {
            try {
                gDiag.length = 0;              // 每次操作只保留本次诊断
                diag("操作: " + label);
                fn();
            } catch (e) {
                diag("!! handler 异常: " + (e ? e.toString() : e));
                try { alert(TOOL_TITLE + " 出错\n\n" + (e ? e.toString() : e)); } catch (e2) {}
            }
            flushDiag(pal);
        };
    }

    // ============================================================
    // 五、UI 尺寸工具
    // ============================================================
    // ScriptUI 坑: edittext / 多行 statictext 一旦赋 .text, 首选宽度会【跟着内容重算】,
    //   `characters` 只给初值压不住; 再叠加 layout.resize() 就会让面板"弹宽"。
    // 修法: 建控件时把宽度钉死到 preferredSize / minimumSize / maximumSize 三处。
    // ⚠️ 高度一律传 -1(自适应), 【绝不】读回 ctrl.preferredSize.height 再写回 ——
    //    控件刚建、尚未首次布局时该值不可靠(可能为 0 或 -1), 会把高度一起钉成 0。
    //    官方依据(extendscript.docsforadobe.dev · Size and location objects):
    //      "A preferredSize of -1 causes the size to be calculated automatically."
    // ⚠️ 三处都要写, 不能只写 preferredSize —— 它是"volatile"属性, 首次布局即丢失
    //    (Adobe 官方社区 Marc Autret 采纳答案: 需要改用 minimumSize)。
    function pinW(ctrl, w) {
        if (!ctrl || !w) { return; }
        try { ctrl.preferredSize = [w, -1]; } catch (e) {}
        try { ctrl.minimumSize = [w, 0]; } catch (e2) {}
        try { ctrl.maximumSize = [w, 10000]; } catch (e3) {}
    }

    var BOX_CHAR_W = 7;   // 每字符估算宽(px)
    function numBox(parent, chars, val) {
        var e = parent.add("edittext", undefined, val);
        e.characters = chars;
        pinW(e, chars * BOX_CHAR_W + 14);
        return e;
    }

    // 多行文本框: 【固定行数 + 右侧滚动条】—— 面板总高不被文字撑开。
    //   ⚠️ 顺序不能反: pinW() 内部会把 preferredSize 重置成 [w, -1](高度自适应),
    //      所以"先设高度、再 pinW"会被【静默覆盖】—— 必须【先 pinW 钉宽度, 再单独钉高度】。
    //   ⚠️ scrollable 做【存在性回退】: 本仓库有先例(v1.5.1 的 colorpicker 在 AE 的
    //      ScriptUI Panels 宿主里直接报 unknown/invalid)。某版本若不认 scrollable,
    //      退化成普通多行框(仍固定高度), 绝不让面板整个打不开。
    var LINE_H = 17;   // 单行像素高(默认 dialog 字体的经验值)
    function fixedBox(parent, w, rows, text, readonly) {
        var box;
        try {
            box = parent.add("edittext", undefined, text || "",
                { multiline: true, scrollable: true, readonly: !!readonly });
        } catch (eScroll) {
            box = parent.add("edittext", undefined, text || "",
                { multiline: true, readonly: !!readonly });
        }
        var h = Math.round(rows * LINE_H);
        pinW(box, w);                                        // 第一步: 钉宽度(会重置高度)
        try { box.preferredSize = [w, h]; } catch (e1) {}    // 第二步: 再钉高度
        try { box.minimumSize = [w, h]; } catch (e2) {}
        try { box.maximumSize = [w, h]; } catch (e3) {}
        return box;
    }

    // 一行「标签 + 滑块 + 数值框」
    function sliderRow(parent, label, lo, hi, val, decimals) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        row.spacing = 6;
        var lbl = row.add("statictext", undefined, label);
        pinW(lbl, 96);
        var sl = row.add("slider", undefined, val, lo, hi);
        pinW(sl, 120);
        var bx = numBox(row, 6, val);
        return { row: row, label: lbl, slider: sl, box: bx };
    }

    // ============================================================
    // 六、UI 层
    // ============================================================
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", TOOL_TITLE, undefined, { resizeable: false });

    pal.orientation = "column";
    pal.alignChildren = "fill";
    pal.spacing = 8;
    pal.margins = 12;

    // ---------- 顶部常驻版本号 ----------
    // ⚠️ 这不是装饰: 它是判断"AE 里跑的是不是最新版"的【唯一可靠手段】。
    //   判断法则: 打开面板先看这里 —— 版本不对说明 AE 没真正重启, 后面做什么都别信。
    var verLbl = pal.add("statictext", undefined, TOOL_TITLE + "   v" + VER);
    try { verLbl.alignment = ["fill", "center"]; } catch (eV1) {}
    try { verLbl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 12); } catch (eVer) {}

    // ---------- 参数区 ----------
    var gpParam = pal.add("panel", undefined, "参数");
    gpParam.orientation = "column";
    gpParam.alignChildren = "fill";
    gpParam.spacing = 6;
    gpParam.margins = 12;

    var rValue = sliderRow(gpParam, SL_VALUE, 0, 100, 50, 0);

    // ---------- 按钮区 ----------
    // 所有 handler 一律经 safeRun 包裹(见上文: AE 的 handler 抛错是静默的)
    var gpBtn = pal.add("group");
    gpBtn.orientation = "row";
    gpBtn.alignment = ["fill", "top"];
    gpBtn.spacing = 6;

    var btnRun  = gpBtn.add("button", undefined, "执行");
    var btnDiag = gpBtn.add("button", undefined, "诊断");
    var btnClr  = gpBtn.add("button", undefined, "清空调试");
    btnRun.onClick  = safeRun("执行",   function () { doMainThing(); });
    btnDiag.onClick = safeRun("诊断",   function () { dumpDiagnostics(); });
    btnClr.onClick  = safeRun("清空调试", function () {
        gDiag.length = 0; flushDiag(pal);
        setStatus(pal, "调试输出已清空。", C_OK);
    });

    // ---------- 说明区(固定 8 行 + 右侧滚动条) ----------
    // 文本用【显式 \n 分段】, 一段一条信息 —— 可读性优先, 不依赖自动折行。
    var TIP_TEXT =
        "【执行】在激活合成里创建/复用一个空对象「" + LAYER_CTRL + "」, 并把上面的数值写进它。\n"
        + "【诊断】把环境/合成/图层/控件值写入下方调试区, 可复制反馈。\n"
        + "⚠️ 面板顶部显示脚本版本号 —— AE 只在【启动时】载入脚本, 改完代码不重启 AE\n"
        + "    面板还是旧版, 靠版本号判断 AE 里跑的是不是最新的。";
    var tipBox = fixedBox(pal, 340, 8, TIP_TEXT, true);

    // ---------- 调试输出区 ----------
    var dbgPanel = pal.add("panel", undefined, "调试输出");
    dbgPanel.orientation = "column";
    dbgPanel.alignChildren = "fill";
    dbgPanel.margins = 8;
    pal.debugBox = fixedBox(dbgPanel, 328, 8, "", true);

    var dbgBtns = dbgPanel.add("group");
    var btnCopy = dbgBtns.add("button", undefined, "复制调试输出");
    btnCopy.onClick = safeRun("复制", function () { copyBoxToClipboard(pal.debugBox); });

    // ---------- 状态栏 ----------
    // 初始文案带版本号 —— 与顶部版本行互为双重确认。
    var sp = pal.add("group");
    sp.alignment = ["fill", "bottom"];
    pal.status = sp.add("statictext", undefined,
        "就绪 · v" + VER + " — 先在时间轴里点选一个合成, 再点「执行」。", { multiline: true });
    try { pinW(pal.status, 340); } catch (eSt) {}
    try { pal.status.graphics.font = ScriptUI.newFont("dialog", "REGULAR", 11); } catch (eF) {}

    // ============================================================
    // 七、主逻辑(示例 —— 派生时整段替换)
    // ============================================================
    // ⚠️ 三条铁律:
    //   ① 先判前置条件, 缺失就"状态栏 + 弹窗"双提示(只写状态栏 = 用户以为没反应)
    //   ② 所有写工程的操作包在一个 Undo 组里, Ctrl+Z 可整体撤销
    //   ③ 用既有图层时先 findLayer 复用, 不要重复创建(用户点两次会有两个)
    function doMainThing() {   // ← 示例逻辑, 换成真实业务
        var comp = getComp();
        if (!comp) {
            setStatus(pal, "⚠ 请先在时间轴里激活一个合成。", C_WARN);
            needCompAlert();
            return;
        }
        setStatus(pal, "正在执行…", C_OK);

        var value = clampNum(rValue.box.text, 0, 100);
        var groupName = TOOL_TITLE + ": 执行";
        app.beginUndoGroup(groupName);
        try {
            var ctrl = findLayer(comp, LAYER_CTRL);
            if (!ctrl) {
                ctrl = comp.layers.addNull();
                ctrl.name = LAYER_CTRL;
                ctrl.source.name = LAYER_CTRL;
                diag("已创建空对象: " + LAYER_CTRL);
            } else {
                diag("复用已有空对象: " + LAYER_CTRL);
            }
            // 示例: 把滑块值写进位置的 X(真实业务替换这里)
            var pos = ctrl.property("ADBE Transform Group").property("ADBE Position");
            var pv = pos.value;
            pos.setValue([value * comp.width / 100, pv[1]]);
            diag("写入数值: " + value);

            setStatus(pal, "完成 · " + TOOL_TITLE + " " + (Number(value).toFixed(0)) + "%", C_OK);
        } catch (e) {
            diag("!! 执行异常: " + (e ? e.toString() : e));
            setStatus(pal, "⚠ 执行失败: " + (e ? e.toString() : e), C_ERR);
            throw e;   // 交给 safeRun 统一弹窗
        } finally {
            app.endUndoGroup();
        }
    }

    function dumpDiagnostics() {
        gDiag.length = 0;
        diag("---- " + TOOL_TITLE + " 诊断 ----");
        diag("脚本版本: " + VER);           // ⭐ 判断 AE 里跑的是不是最新版
        diag("AE 版本: " + app.version);
        diag("引擎: " + $.version);
        diag("工程: " + ((app.project && app.project.file) ? app.project.file.fsName : "(未保存)"));
        var comp = getComp();
        if (!comp) {
            diag("活动合成: 无  <-- 如果你在点按钮\"没反应\", 最常见原因就是时间轴里没有激活的合成");
        } else {
            diag("合成: " + comp.name + "  " + comp.width + "x" + comp.height
                 + "  " + (Math.round(comp.frameRate * 100) / 100) + "fps");
            var ctrl = findLayer(comp, LAYER_CTRL);
            diag("空对象「" + LAYER_CTRL + "」: " + (ctrl ? "存在" : "不存在"));
            if (ctrl) {
                var sl = findSlider(ctrl, SL_VALUE);
                diag("    " + SL_VALUE + " = " + (sl ? sl.value : "(无)"));
            }
        }
        diag("面板参数: " + SL_VALUE + " = " + rValue.box.text);
        diag("---- 诊断结束, 点「复制调试输出」带走 ----");
        setStatus(pal, "诊断完成。", C_OK);
    }

    // ============================================================
    // 八、面板挂载
    // ============================================================
    if (thisObj instanceof Panel) {
        // 作为 ScriptUI Panel 嵌在 AE 里: 跟随面板尺寸重排
        thisObj.onResizing = thisObj.onResize = function () { this.layout.resize(); };
    } else {
        // 独立运行(双击 .jsx): 以浮动窗口显示
        pal.preferredSize.width = 360;
        pal.center();
        pal.show();
    }

})(this);
