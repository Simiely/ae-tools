// ============================================================
// QuickKey · 节点式 K 帧排程面板  QuickKey.jsx
// 版本: 0.1.2  (2026-08-18)
// 适用: After Effects CC 2015.3+ (依赖 selectedProperties API)
//
// v0.1.4 变更:
//   - 节点数动态化:面板顶部新增「节点数」输入框(1~30,默认 5),
//     填几就显示几行节点,三种模式锚点规则自动适配 N:
//     起始 = 第 1 位,中间 = 第 ⌈N/2⌉ 位,末尾 = 第 N 位。
//   - 节点区改为"行池"复用:增减节点只切换 visible,不重建控件;
//     缩容再扩容时旧槽位数值保留。
//
// v0.1.3 变更:
//   - 关闭节点不再参与计算:从排程链中完全剔除(不占位、不打帧),
//     间隔 = 与"靠锚点一侧最近开启节点(或锚点)"的帧距。
//     (v0.1.0~v0.1.2 为"关闭占位"语义,用户真机实测后改为"跳过")
//
// v0.1.2 变更:
//   - 修复「中间帧/末尾帧」倒推计算 bug:原 `t[i] = t[i+1] - gap[i+1]`
//     误用了"锚点一侧节点"的间隔,当上方节点间隔与默认值不同时时间错位;
//     改为用节点自己的间隔 `t[i] = t[i+1] - gap[i]`(与下方节点"自己的
//     间隔定义相邻间距"对称)。默认全 5 时两种公式结果相同,故起始帧
//     未暴露此 bug。新增 test_quickkey.js 回归守护。
//   - 术语修正:「播放头」改为 AE 官方学名「当前时间指示器」
//     (Current Time Indicator, CTI)。
//   - computeTimes(mode, gap) 抽为纯函数,node 下可 require 测试。
//
// v0.1.1 变更:新增每节点「数值」输入框(列头:间隔/数值/时间)
//   - 数值支持逗号分隔多维(位置 "960, 540";缩放 "100, 100")
//   - 数值留空 = 用属性当前值(旧行为,向后兼容)
//   - 数值与属性维度不匹配时该键跳过并在状态栏提示,不静默用当前值
//
// 设计(与用户确认的规格):
//   - N 个节点位(默认 5,可 1~30;1 锚点 + N-1 可开关节点),时间轴方向 上早下晚
//   - 当前时间指示器所在帧 = 锚点帧,角色可选:起始 / 中间 / 末尾
//     · 起始:锚点排第 1 位,下方 N-1 节点
//     · 中间:锚点排第 ⌈N/2⌉ 位,上方 ⌈N/2⌉-1、下方 N-⌈N/2⌉(偶数时略偏上)
//     · 末尾:锚点排第 N 位,上方 N-1 节点
//   - 每个非锚点节点:开关(关闭=不打帧、不参与计算)+ 间隔数字(帧)+ 数值
//   - 间隔语义 = 与"靠锚点一侧最近开启节点(或锚点)"的帧距(即节点自己的间隔):
//     · 锚点下方节点:从锚点往后累加(节点4 = +gap4,节点5 = +gap4+gap5)
//     · 锚点上方节点:从锚点往前倒推(节点2 = -gap2,节点1 = -gap2-gap1)
//   - 点「打帧」:在选中图层当前选中的属性(comp.selectedProperties)
//     上,按排程时间依次打关键帧,数值 = 各节点数值(留空用当前值)
//   - 整次操作包在一个 Undo 组里,一键 Ctrl+Z 整体撤销
//
// 安装:免安装,文件部署到用户级目录
//   %APPDATA%\Adobe\After Effects\<ver>\Scripts\ScriptUI Panels\
//   (本仓库统一用 install.py 部署,自动补 UTF-8 BOM + 字节校验)
// ============================================================

(function (thisObj) {

    // ---------- 常量 ----------
    var MODE_NAMES = ["起始帧", "中间帧", "末尾帧"];
    var MAX_COUNT = 30;   // 节点数上限(防面板撑爆)

    // 锚点槽位:起始 = 1,中间 = ⌈N/2⌉,末尾 = N(v0.1.4 起随 N 动态)
    function anchorPos(mode, n) {
        if (mode === 0) { return 1; }
        if (mode === 1) { return Math.ceil(n / 2); }
        return n;
    }

    // ---------- 状态 ----------
    var state = {
        mode: 0,                       // 0=起始 1=中间 2=末尾
        count: 5,                      // 节点数(1~30,默认 5)
        on:  {1: true, 2: true, 3: true, 4: false, 5: false},  // 槽位开关(锚点恒开)
        gap: {1: 5, 2: 5, 3: 5, 4: 5, 5: 5},                   // 槽位间隔(帧)
        val: {1: "", 2: "", 3: "", 4: "", 5: ""}               // 槽位数值(留空=用当前值)
    };

    // 扩缩容:只补齐新槽位默认值,已有槽位数值保留
    function resizeState(n) {
        for (var i = 1; i <= n; i++) {
            if (state.on[i] === undefined) { state.on[i] = true; }
            if (state.gap[i] === undefined) { state.gap[i] = 5; }
            if (state.val[i] === undefined) { state.val[i] = ""; }
        }
    }

    // ---------- 工具(纯函数,node 可测) ----------
    function fmtFrames(n) {
        return (n >= 0 ? "+" : "") + n + " 帧";
    }

    // 计算各槽位相对当前时间指示器的帧偏移(锚点 = 0)
    // 间隔语义:每个节点自己的 gap = 与"靠锚点一侧最近开启节点(或锚点)"的帧距
    //   下方节点:t[i] = 最近开启上一节点时间 + gap[i]
    //   上方节点:t[i] = 最近开启下一节点时间 - gap[i]
    // 关闭节点返回 null:不打帧、不占位、不参与后续计算(v0.1.3)
    function computeTimes(mode, gap, on, n) {
        var a = anchorPos(mode, n);
        var t = {};
        for (var i = 1; i <= n; i++) { t[i] = null; }
        t[a] = 0;
        var prev = a;
        for (var i = a + 1; i <= n; i++) {
            if (on[i]) { t[i] = t[prev] + gap[i]; prev = i; }
        }
        var next = a;
        for (var i = a - 1; i >= 1; i--) {
            if (on[i]) { t[i] = t[next] - gap[i]; next = i; }
        }
        return t;
    }

    // 解析数值输入:空 → null(用当前值);"100" → 100;"960, 540" → [960, 540]
    function parseValue(text) {
        var t = String(text || "").replace(/^\s+|\s+$/g, "");
        if (t === "") { return null; }
        var parts = t.split(",");
        var arr = [];
        for (var i = 0; i < parts.length; i++) {
            var n = parseFloat(parts[i]);
            if (isNaN(n)) { return null; }
            arr.push(n);
        }
        return (arr.length === 1) ? arr[0] : arr;
    }

    // ---------- 打帧 ----------
    function doKey() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("请先激活一个合成,再点打帧。");
            return;
        }
        var props = comp.selectedProperties;
        if (!props || props.length === 0) {
            setStatus("未选中属性:先在时间轴展开属性并选中(P/S/R/T 等)");
            return;
        }
        var times = computeTimes(state.mode, state.gap, state.on, state.count);
        var anchorSlot = anchorPos(state.mode, state.count);
        var kfCount = 0;
        var propCount = props.length;
        var badCount = 0;
        app.beginUndoGroup("QuickKey K帧");
        try {
            for (var s = 1; s <= state.count; s++) {
                var isAnchor = (s === anchorSlot);
                if (!isAnchor && !state.on[s]) { continue; }   // 关闭节点:不打帧、不占位
                var t = comp.time + times[s] * comp.frameDuration;
                var v = parseValue(state.val[s]);
                for (var p = 0; p < props.length; p++) {
                    var prop = props[p];
                    try {
                        if (v === null) { prop.setValueAtTime(t, prop.value); }
                        else { prop.setValueAtTime(t, v); }
                        kfCount++;
                    } catch (e) {
                        badCount++;   // 维度不匹配/表达式/不可打帧,明确提示不静默
                    }
                }
            }
        } finally {
            app.endUndoGroup();
        }
        var msg = "完成:" + kfCount + " 个关键帧 · " + propCount + " 个属性 · " + MODE_NAMES[state.mode];
        if (badCount > 0) { msg += " · " + badCount + " 个未生效(数值与属性维度不匹配?)"; }
        setStatus(msg);
    }

    // ---------- UI(AE 环境才构建;node 下跳过供测试) ----------
    var isAe = (typeof app !== "undefined");

    if (isAe) {
        var pal = (thisObj instanceof Panel) ? thisObj
            : new Window("palette", "QuickKey · 快速K帧", undefined, {resizeable: false});
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 6;
        pal.margins = 8;

        // 模式行
        var grpMode = pal.add("group");
        grpMode.orientation = "row";
        grpMode.alignChildren = ["fill", "center"];
        grpMode.spacing = 6;
        grpMode.add("statictext", undefined, "当前时间指示器作为:");
        var ddMode = grpMode.add("dropdownlist", undefined, MODE_NAMES);
        ddMode.selection = ddMode.items[0];   // 默认起始帧

        // 节点数行(1~30,改后回车生效)
        var grpCount = pal.add("group");
        grpCount.orientation = "row";
        grpCount.alignChildren = ["fill", "center"];
        grpCount.spacing = 6;
        grpCount.add("statictext", undefined, "节点数(1~30):");
        var cntInp = grpCount.add("edittext", undefined, String(state.count));
        cntInp.characters = 3;
        cntInp.onChange = function () {
            var v = parseInt(cntInp.text, 10);
            if (isNaN(v) || v < 1) { v = 1; }
            if (v > MAX_COUNT) { v = MAX_COUNT; }
            if (v !== state.count) {
                state.count = v;
                resizeState(v);
                ensureRows();
                refresh();
                pal.layout.layout(true);
            }
            cntInp.text = String(state.count);
        };

        // 节点区(行池:预建足量行,按 count 切换 visible,不重建控件)
        var grpNodes = pal.add("group");
        grpNodes.orientation = "column";
        grpNodes.alignChildren = ["fill", "top"];
        grpNodes.spacing = 4;

        // 列头:开关 | 节点 | 间隔 | 数值 | 时间
        var head = grpNodes.add("group");
        head.orientation = "row";
        head.alignChildren = ["fill", "center"];
        head.spacing = 6;
        var hSp = head.add("statictext", undefined, "");
        hSp.preferredSize.width = 18;
        var hLbl = head.add("statictext", undefined, "节点");
        hLbl.preferredSize.width = 160;
        var hGap = head.add("statictext", undefined, "间隔");
        hGap.preferredSize.width = 40;
        var hVal = head.add("statictext", undefined, "数值");
        hVal.preferredSize.width = 64;
        var hTme = head.add("statictext", undefined, "时间");
        hTme.preferredSize.width = 50;

        var chk = {};    // 开关引用(按槽位)
        var lbl = {};    // 标签引用
        var inp = {};    // 间隔输入引用
        var vin = {};    // 数值输入引用
        var tme = {};    // 时间预览引用
        var rows = [];   // 行控件池(索引 = 槽位 - 1)

        function addRow(slot) {
            var row = grpNodes.add("group");
            row.orientation = "row";
            row.alignChildren = ["fill", "center"];
            row.spacing = 6;
            chk[slot] = row.add("checkbox", undefined, "");
            lbl[slot] = row.add("statictext", undefined, "节点" + slot);
            lbl[slot].preferredSize.width = 160;
            inp[slot] = row.add("edittext", undefined, String(state.gap[slot]));
            inp[slot].characters = 3;
            vin[slot] = row.add("edittext", undefined, state.val[slot]);
            vin[slot].characters = 7;
            tme[slot] = row.add("statictext", undefined, "");
            tme[slot].preferredSize.width = 50;
            chk[slot].onClick = function () {
                state.on[slot] = chk[slot].value;
                refresh();
            };
            inp[slot].onChange = function () {
                var v = parseInt(inp[slot].text, 10);
                if (isNaN(v) || v < 0) { v = 0; }
                state.gap[slot] = v;
                inp[slot].text = String(v);
                refresh();
            };
            vin[slot].onChange = function () {
                state.val[slot] = vin[slot].text;
            };
            rows.push(row);
        }

        // 确保行池覆盖 count;超出部分隐藏(缩容再扩容时旧值保留)
        function ensureRows() {
            while (rows.length < state.count) { addRow(rows.length + 1); }
            for (var i = 0; i < rows.length; i++) { rows[i].visible = (i + 1) <= state.count; }
        }

        // 打帧按钮 + 状态栏
        var btnKey = pal.add("button", undefined, "打帧(全部开启的节点)");
        btnKey.onClick = doKey;
        var status = pal.add("statictext", undefined, "就绪:选中属性 → 设间隔/数值 → 打帧(数值留空=用当前值)");
        status.alignment = ["fill", "top"];

        // ---------- 刷新 ----------
        function refresh() {
            var a = anchorPos(state.mode, state.count);
            var times = computeTimes(state.mode, state.gap, state.on, state.count);
            for (var s = 1; s <= state.count; s++) {
                var isAnchor = (s === a);
                chk[s].visible = !isAnchor;
                inp[s].visible = !isAnchor;
                vin[s].enabled = isAnchor ? true : state.on[s];
                if (isAnchor) {
                    lbl[s].text = "当前时间指示器(锚点)";
                    tme[s].text = "固定 +0";
                } else {
                    lbl[s].text = "节点" + s;
                    chk[s].value = state.on[s];
                    inp[s].enabled = state.on[s];
                    inp[s].text = String(state.gap[s]);
                    tme[s].text = state.on[s] ? fmtFrames(times[s]) : "关闭";
                }
            }
        }

        // 模式切换
        ddMode.onChange = function () {
            state.mode = ddMode.selection.index;
            refresh();
        };

        ensureRows();
        refresh();

        if (pal instanceof Window) { pal.center(); pal.show(); }
        else { pal.layout.layout(true); }
    }

    // ---------- 测试钩子(node 环境) ----------
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            computeTimes: computeTimes,
            parseValue: parseValue,
            anchorPos: anchorPos,
            MODE_NAMES: MODE_NAMES
        };
    }

})(this);
