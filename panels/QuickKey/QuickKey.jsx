// ============================================================
// QuickKey · 节点式 K 帧排程面板  QuickKey.jsx
// 版本: 0.1.18  (2026-08-18)
// 适用: After Effects CC 2015.3+ (依赖 selectedProperties API)
//
// v0.1.18 变更:维度判断补两个缺口(用户问"还有别的判断方式"盘点后补)
//   ① 摄像机/灯光图层恒 3D(无 3D 开关,threeDLayer 读不到)→ propLayerInfo
//      识别 layerType(camera/light),propDimOf 强制 is3D=true
//   ② 分离尺寸跟随者(位置X/位置Y)→ separationLeader 非空 = 单值属性,
//      propDimCore 新增 isSep 参数恒返回 1
//
// v0.1.17 变更:维度判断彻底修正(用户三次坚持无 3D,诊断实测定案)
//   - 定案数据(AE 26.0 实测):2D 图层(3D开关=关)的 位置/锚点
//     propertyValueType=6413(ThreeD_SPATIAL)、缩放=6414(ThreeD)——
//     AE 2026 的 2D 变换属性 .value 与 propertyValueType 都报 3D!
//     唯一可靠的维度真相 = 图层 threeDLayer 开关。
//   - 修复:propDimCore(mn, vt, is3D) 纯决策——变换属性
//     (位置/缩放/锚点/方向)以图层 3D 开关定维度,OneD 恒 1 维,
//     非变换属性退回 propertyValueType。枚举数值硬编码(AE 26.0 实测):
//     ThreeD_SPATIAL=6413, ThreeD=6414, TwoD_SPATIAL=6415, TwoD=6416, OneD=6417。
//
// v0.1.16 变更:图层诊断遍历修复(连报 3 维的真相已确认)
//   - 用户原始诊断显示 [类型:ThreeD/ThreeD_SPATIAL] —— AE 自报 3D 类型,
//     即这些图层确实开了「3D 图层开关」(非插件误判);"没开过"多为
//     复制/粘贴图层、拖摄像机灯光或误点立方体图标导致。
//   - 但「图层名 + 3D 开关」标注没显示出来:propLayerInfo 用 instanceof Layer
//     遍历 parentProperty 失败(静默)。改为 duck-typing(containingComp)识别
//     Layer + parentProperty/propertyGroup 双通道上溯 + 防死循环守卫。
//
// v0.1.15 变更:位数预检加入原始诊断(连报 3 维,停止猜测)
//   - 不匹配提示附带 AE 原始数据:propertyValueType 常量名(如 ThreeD_SPATIAL)
//     + 所属图层名 + 所在合成 + threeDLayer 原始开关状态
//   - 下次报告即确凿证据:能区分「AE 真把 2D 报成 3D(异常)」还是
//     「图层确实开了 3D 开关(预检正确)」
//
// v0.1.14 变更:执行层重构(用户:逻辑越来越乱,先优化)
//   - doKey 拆为三段:buildPlan(纯计算,node 可测)→ executePlan(只写 AE)
//     → buildReport(纯文本拼接),报告与执行不再交错
//   - 抽公共辅助 withUndo(label, fn) / perProp(props, fn) / failDimCheck(),
//     doKey 与 applyExpression 的 undo/逐属性/报告五连重复消除
//   - 新增纯函数 buildPlan / planHasExplicit,回归测试扩至 39 断言
//   - 行为不变:报告格式、预检、自动弹窗、undo 分组全部保持
//
// v0.1.13 变更:位数预检重写(用户反馈逻辑混乱)
//   - 重写为三个单一职责函数:propDimOf(维度,propertyValueType 权威)、
//     propLayerInfo(图层名 + 3D 开关诊断)、dimCheck(统一入口返回 {ok,lines,sugDim})
//   - 提示新增图层诊断:3 维属性若所属图层开了 3D 图层开关,直接写明
//     「(图层「X」已开启 3D 图层开关)」——2D 图层看着却报 3 维的真相
//
// v0.1.12 变更:修复 2D 图层被误判为 3 维
//   - 根因:维度判断用 prop.value.length,而 AE 2026 中 2D 图层的位置/锚点
//     .value 返回 [x,y,0](3 元素,第三位为 0),会把 2D 误判成 3 维。
//   - ⚠️ 本版本"改用 propertyValueType"的修复已被 v0.1.17 实测推翻:
//     AE 2026 的 2D 变换属性 propertyValueType 同样报 3D(6413/6414),
//     唯一可靠来源是图层 threeDLayer 开关。历史记录仅存档,勿再采用。
//
// v0.1.11 变更:位数预检提示增强
//   - 不匹配提示改为智能建议:所有不匹配属性维度一致时,直接给出
//     「建议「数值输入」切到「N 个空」」(如 3D 属性 × 2 空 → 建议切 3 空)
//
// v0.1.10 变更:数值位数预检(撤销 v0.1.8 的自动广播/补齐,用户明确要求)
//   - 执行前先查询选中属性的维度(1/2/3),与「数值输入」空数比对;
//     不匹配 → 弹窗提示「数值位数不匹配」并中止,不做任何写入。
//   - 留空(用当前值)的节点不参与校验;特殊属性(如文本)不预检,执行时兜底。
//
// v0.1.9 变更:UI 调整
//   - 数值输入下拉「公式」→「表达式」(与功能语义一致)
//   - 「节点数」行移到面板最顶(顺序:节点数 → 模式 → 数值输入 → 表达式)
//
// v0.1.8 变更:数值维度自动适配(后被 v0.1.10 撤销,保留记录)
//   - fillDimsValue 数字广播/补齐;用户明确拒绝"魔法"行为,已删除
//
// v0.1.7 变更:修复"1 空模式全部判非法"——数值存储改数组
//   - 根因(由 v0.1.6 调试报告定位):旧版 state.val 用逗号拼接字符串,
//     3 空模式部分填写(如 X=123 留空 Y/Z)存成 "123,,";切回 1 空后
//     显示正常(只显示第一格)但解析时残留逗号 → parseFloat("") NaN
//     → 整行判非法 → 0 关键帧。报告原文:「数值非法[123,,]」。
//   - 修复:state.val[slot] 改为【每空一格】的字符串数组(长度 3),
//     框对格直读直写,不再逗号拼接/拆分,杜绝残留逗号;
//     切换数值类型不丢数据(3 空 "123/540/0" → 1 空显示 "123" → 切回还原)。
//
// v0.1.6 变更:调试报告 + 执行归类(修复"打帧无效果"难排查)
//   - 新增「调试」按钮:点击弹出本次执行完整报告——模式/节点数/数值类型、
//     每个节点的 时间/原始值/解析结果、每个属性的失败原因与错误信息、
//     表达式启用状态。打帧结果为零(或表达式全部失败)时自动弹出。
//   - parseValueDim 升级为 classifyValue:empty(留空→当前值)/
//     fixed(数字或数组)/ bad(非法·部分填写·超维度 → 可见跳过)
//
// v0.1.5 变更:数值输入类型切换(下拉:1 个空 / 2 个空 / 3 个空 / 表达式)
//   - 1/2/3 空 = 每节点 1~3 个数值输入框,写入 [x] / [x,y] / [x,y,z] 数组
//   - 表达式模式:单个表达式框,点按钮写入选中属性,不排关键帧
//
// v0.1.4 变更:节点数动态化(1~30,默认 5);节点区"行池"复用
// v0.1.3 变更:关闭节点从排程链完全剔除(不占位)
// v0.1.2 变更:修复中间/末尾帧倒推计算 bug;术语改「当前时间指示器」
// v0.1.1 变更:新增每节点「数值」输入框(留空=用属性当前值)
//
// 设计(与用户确认的规格):
//   - N 个节点位(默认 5,可 1~30;1 锚点 + N-1 可开关节点),时间轴方向 上早下晚
//   - 当前时间指示器所在帧 = 锚点帧,角色可选:起始 / 中间 / 末尾
//     · 起始:锚点排第 1 位,下方 N-1 节点
//     · 中间:锚点排第 ⌈N/2⌉ 位,上方 ⌈N/2⌉-1、下方 N-⌈N/2⌉(偶数时略偏上)
//     · 末尾:锚点排第 N 位,上方 N-1 节点
//   - 间隔语义 = 与"靠锚点一侧最近开启节点(或锚点)"的帧距(即节点自己的间隔):
//     · 锚点下方节点:从锚点往后累加(节点4 = +gap4,节点5 = +gap4+gap5)
//     · 锚点上方节点:从锚点往前倒推(节点2 = -gap2,节点1 = -gap2-gap1)
//   - 点「打帧」:在选中图层当前选中的属性(comp.selectedProperties)
//     上,按排程时间依次打关键帧,数值 = 各节点数值(留空用当前值)
//   - 「表达式」模式:表达式写入选中属性,不排帧
//   - 整次操作包在一个 Undo 组里,一键 Ctrl+Z 整体撤销
//
// 安装:免安装,文件部署到用户级目录
//   %APPDATA%\Adobe\After Effects\<ver>\Scripts\ScriptUI Panels\
//   (本仓库统一用 install.py 部署,自动补 UTF-8 BOM + 字节校验)
// ============================================================

(function (thisObj) {

    // ---------- 常量 ----------
    var MODE_NAMES = ["起始帧", "中间帧", "末尾帧"];
    var VTYPE_NAMES = ["1 个空", "2 个空", "3 个空", "表达式"];
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
        vtype: 0,                      // 数值类型 0=1空 1=2空 2=3空 3=表达式
        expr: "",                      // 表达式内容(表达式模式)
        on:  {1: true, 2: true, 3: true, 4: false, 5: false},  // 槽位开关(锚点恒开)
        gap: {1: 5, 2: 5, 3: 5, 4: 5, 5: 5},                   // 槽位间隔(帧)
        val: {                                 // 槽位数值:每空一格,数组长度 3(v0.1.7)
            1: ["", "", ""], 2: ["", "", ""], 3: ["", "", ""],
            4: ["", "", ""], 5: ["", "", ""]
        }
    };
    var lastReport = "";               // 上次执行报告(调试按钮弹出)

    // 扩缩容:只补齐新槽位默认值,已有槽位数值保留
    function resizeState(n) {
        for (var i = 1; i <= n; i++) {
            if (state.on[i] === undefined) { state.on[i] = true; }
            if (state.gap[i] === undefined) { state.gap[i] = 5; }
            if (state.val[i] === undefined || !(state.val[i] instanceof Array)) {
                state.val[i] = ["", "", ""];
            }
        }
    }

    // ===== 纯逻辑层(不依赖 AE,node 可测)=====

    function fmtFrames(n) {
        return (n >= 0 ? "+" : "") + n + " 帧";
    }

    function describeVal(v) {
        if (v === null || v === undefined) { return "当前值"; }
        if (v instanceof Array) { return v.join(", "); }
        return String(v);
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

    // 执行归类:cells = 每空一格字符串数组,直接读格子,无逗号拼接
    //   empty:全部留空 → 用属性当前值
    //   fixed:全部填好 → 数字(1 空)或数组(2/3 空)
    //   bad:部分填写 / 非法字符 / 框内逗号 → 可见跳过(报告写明)
    function classifyValue(cells, dim) {
        var filled = [];
        var empty = 0;
        for (var i = 0; i < dim; i++) {
            var cell = String(cells[i] || "").replace(/\s/g, "");
            if (cell === "") { empty++; filled.push(null); }
            else {
                if (cell.indexOf(",") >= 0) { return {kind: "bad"}; }  // 单框内逗号 → 用对应空数模式
                var n = parseFloat(cell);
                if (isNaN(n)) { return {kind: "bad"}; }
                filled.push(n);
            }
        }
        if (empty === dim) { return {kind: "empty"}; }
        if (empty > 0) { return {kind: "bad"}; }   // 部分填写 → 可见跳过
        return {kind: "fixed", value: (dim === 1) ? filled[0] : filled};
    }

    // 格子数组 → 显示用 raw:去掉尾部空格(",," → "";"100,," → "100")
    function cellsRaw(cells) {
        var end = cells.length;
        while (end > 0 && String(cells[end - 1] || "").replace(/\s/g, "") === "") { end--; }
        var parts = [];
        for (var i = 0; i < end; i++) { parts.push(cells[i]); }
        return parts.join(",");
    }

    // 生成执行计划(v0.1.14 重构,纯函数):每节点 → {slot, isAnchor, closed, offset, kind, value, raw}
    //   closed=true 的节点不打帧;offset 为相对指示器帧偏移;kind/value 来自 classifyValue
    function buildPlan(mode, count, gap, on, val, dim) {
        var times = computeTimes(mode, gap, on, count);
        var anchor = anchorPos(mode, count);
        var plan = [];
        for (var s = 1; s <= count; s++) {
            var isAnchor = (s === anchor);
            if (!isAnchor && !on[s]) {
                plan.push({slot: s, isAnchor: false, closed: true, offset: null, kind: null, value: null, raw: ""});
                continue;
            }
            var cls = classifyValue(val[s], dim);
            plan.push({
                slot: s,
                isAnchor: isAnchor,
                closed: false,
                offset: times[s],
                kind: cls.kind,
                value: (cls.value === undefined) ? null : cls.value,
                raw: cellsRaw(val[s])
            });
        }
        return plan;
    }

    // 计划里是否有显式数值(有才需要做位数预检)
    function planHasExplicit(plan) {
        for (var i = 0; i < plan.length; i++) {
            if (!plan[i].closed && plan[i].kind === "fixed") { return true; }
        }
        return false;
    }

    // ===== 预检层(AE 依赖)=====

    // AE 26.0 实测枚举数值(dim_test.jsx 定案):
    //   ThreeD_SPATIAL=6413, ThreeD=6414, TwoD_SPATIAL=6415, TwoD=6416, OneD=6417
    var VT_THREE_D_SPATIAL = 6413;
    var VT_THREE_D = 6414;
    var VT_TWO_D_SPATIAL = 6415;
    var VT_TWO_D = 6416;
    var VT_ONE_D = 6417;

    // 维度纯决策(v0.1.17/0.1.18,node 可测):
    //   - isSep(分离尺寸跟随者,如 位置X)→ 恒 1 维
    //   - OneD → 1 维(不透明度/旋转,恒 1 维)
    //   - 变换属性(位置/缩放/锚点/方向)→ 以图层 3D 开关为准:
    //     AE 2026 中 2D 图层的这些属性 propertyValueType 也报 3D(6413/6414),
    //     只有 threeDLayer 能区分 2D/3D(用户三次实测确认)
    //   - 非变换属性 → 退回 propertyValueType 映射
    function propDimCore(mn, vt, is3D, isSep) {
        if (isSep === true) { return 1; }
        if (vt === VT_ONE_D) { return 1; }
        var t = (mn === "ADBE Position" || mn === "ADBE Scale"
              || mn === "ADBE Anchor Point" || mn === "ADBE Orientation");
        if (t && (is3D === true || is3D === false)) { return is3D ? 3 : 2; }
        if (vt === VT_THREE_D_SPATIAL || vt === VT_THREE_D) { return 3; }
        if (vt === VT_TWO_D_SPATIAL || vt === VT_TWO_D) { return 2; }
        return 0;
    }

    // 属性维度(读取 AE 对象后交给纯决策)
    function propDimOf(prop) {
        try {
            var vt = prop.propertyValueType;
            var mn = "";
            try { mn = String(prop.matchName); } catch (e2) {}
            var li = propLayerInfo(prop);
            var is3D = li.is3D;
            if (li.type === "camera" || li.type === "light") { is3D = true; }   // 恒 3D(v0.1.18)
            var isSep = false;
            try { isSep = (prop.separationLeader !== null && prop.separationLeader !== undefined); } catch (e3) {}
            return propDimCore(mn, vt, is3D, isSep);
        } catch (e) {}
        return 0;   // COLOR/自定义/文本等 → 不预检,执行时兜底
    }

    // 属性类型常量名(诊断用):返回 "ThreeD_SPATIAL" 之类,读不到返回 "?"
    function propTypeName(prop) {
        try {
            var vt = prop.propertyValueType;
            var map = [
                ["ThreeD_SPATIAL", PropertyValueType.ThreeD_SPATIAL],
                ["ThreeD", PropertyValueType.ThreeD],
                ["TwoD_SPATIAL", PropertyValueType.TwoD_SPATIAL],
                ["TwoD", PropertyValueType.TwoD],
                ["OneD", PropertyValueType.OneD]
            ];
            for (var i = 0; i < map.length; i++) {
                if (vt === map[i][1]) { return map[i][0]; }
            }
            return "类型#" + vt;
        } catch (e) { return "?"; }
    }

    // 属性所属图层:层名 + 所在合成 + 3D 图层开关 + 图层类型(v0.1.18 加类型)
    // 识别 Layer 用 duck-typing(containingComp)——instanceof Layer 在此处
    // 不可靠(曾静默失败导致诊断缺失);parentProperty 不可用时退回
    // propertyGroup() 上溯;12 层守卫防死循环。
    function propLayerInfo(prop) {
        var info = {name: "", comp: "", is3D: null, type: "layer"};
        try {
            var pb = prop;
            var guard = 0;
            while (pb && guard < 12) {
                guard++;
                var isLayer = false;
                try { isLayer = (typeof pb.containingComp !== "undefined"); } catch (e7) {}
                if (isLayer) {
                    try { info.name = String(pb.name); } catch (e2) {}
                    try { info.comp = String(pb.containingComp.name); } catch (e6) {}
                    try { info.is3D = (pb.threeDLayer === true); } catch (e3) {}
                    // 摄像机/灯光恒 3D(无 3D 开关)
                    try { if (pb instanceof CameraLayer) { info.type = "camera"; } } catch (e8) {}
                    try { if (pb instanceof LightLayer) { info.type = "light"; } } catch (e9) {}
                    try {
                        var mnL = String(pb.matchName);
                        if (mnL === "ADBE Camera Layer") { info.type = "camera"; }
                        if (mnL === "ADBE Light Layer") { info.type = "light"; }
                    } catch (e10) {}
                    break;
                }
                var next = null;
                try { next = pb.parentProperty; } catch (e11) {}
                if (!next) {
                    try { next = pb.propertyGroup(); } catch (e12) {}
                }
                pb = next;
            }
        } catch (e5) {}
        return info;
    }

    // 统一预检:返回 {ok, lines, sugDim}
    //   ok=true  通过;ok=false 时 lines 为逐条不匹配说明,sugDim 为建议空数(0=无统一建议)
    //   每条附带 AE 原始诊断:[类型 X · 图层「Y」@「合成Z」3D开关:开/关/未知]
    function dimCheck(props, propNames, dim) {
        var errs = [];
        for (var p = 0; p < props.length; p++) {
            var pd = propDimOf(props[p]);
            if (pd > 0 && pd !== dim) {
                var li = propLayerInfo(props[p]);
                var diag = " [类型:" + propTypeName(props[p]);
                if (li.name !== "" || li.is3D !== null) {
                    diag += " · 图层「" + (li.name || "?") + "」@「" + (li.comp || "?") + "」3D开关:"
                        + (li.is3D === true ? "开" : (li.is3D === false ? "关" : "未知"));
                }
                diag += "]";
                errs.push({name: propNames[p], pd: pd, extra: diag});
            }
        }
        if (errs.length === 0) { return {ok: true, lines: [], sugDim: 0}; }
        var lines = [];
        var sugDim = errs[0].pd;
        var sugAll = true;
        for (var i = 0; i < errs.length; i++) {
            lines.push("属性「" + errs[i].name + "」为 " + errs[i].pd + " 维,本次输入 " + dim + " 个数" + errs[i].extra);
            if (errs[i].pd !== sugDim) { sugAll = false; }
        }
        return {ok: false, lines: lines, sugDim: (sugAll ? sugDim : 0)};
    }

    // 预检失败:写报告 + 状态栏 + 弹窗,调用方 return(v0.1.14 抽取)
    function failDimCheck(dchk, dim) {
        var hint = "请把「数值输入」的空数(1/2/3)调到与属性维度一致,或留空用当前值。";
        if (dchk.sugDim >= 1 && dchk.sugDim <= 3 && dchk.sugDim !== dim) {
            hint = "建议「数值输入」切到「" + dchk.sugDim + " 个空」,或留空用当前值。";
        }
        var head = "数值位数不匹配,未执行:";
        lastReport = head + "\n- " + dchk.lines.join("\n- ") + "\n\n" + hint;
        setStatus("数值位数不匹配,未执行(见弹窗)");
        alert(head + "\n- " + dchk.lines.join("\n- ") + "\n\n" + hint);
    }

    // ===== 公共辅助 =====

    function setStatus(msg) {
        if (status) { status.text = msg; }
    }

    function propName(prop, idx) {
        try { return String(prop.name); } catch (e) { return "属性#" + idx; }
    }

    function errMsg(e) {
        try { return (e && e.message) ? String(e.message) : String(e); } catch (e2) { return "未知错误"; }
    }

    // undo 组包装:beginUndoGroup 必须配 try/finally,异常不留半截撤销栈
    function withUndo(label, fn) {
        app.beginUndoGroup(label);
        try { fn(); } finally { app.endUndoGroup(); }
    }

    // 逐属性执行:返回 {ok, bad, entries} — entries 为有序 [{ok, idx, msg?}],报告顺序与执行一致
    function perProp(props, fn) {
        var ok = 0;
        var bad = 0;
        var entries = [];
        for (var p = 0; p < props.length; p++) {
            try {
                fn(props[p], p);
                ok++;
                entries.push({ok: true, idx: p});
            } catch (e) {
                bad++;
                entries.push({ok: false, idx: p, msg: errMsg(e)});
            }
        }
        return {ok: ok, bad: bad, entries: entries};
    }

    // ===== 执行层 =====

    // 执行计划:只写 AE(setValueAtTime),不拼报告
    // 返回 {kfCount, badCount, fails} — fails 为 [{slot, propIdx, msg, exp}]
    function executePlan(comp, props, plan) {
        var kfCount = 0;
        var badCount = 0;
        var fails = [];
        withUndo("QuickKey K帧", function () {
            for (var i = 0; i < plan.length; i++) {
                var item = plan[i];
                if (item.closed) { continue; }                       // 关闭节点:不打帧
                if (item.kind === "bad") { badCount += props.length; continue; }  // 非法:整行跳过
                var t = comp.time + item.offset * comp.frameDuration;
                var v = item.value;
                var r = perProp(props, function (prop) {
                    if (v === null) { prop.setValueAtTime(t, prop.value); }
                    else { prop.setValueAtTime(t, v); }
                });
                kfCount += r.ok;
                badCount += r.bad;
                for (var f = 0; f < r.entries.length; f++) {
                    if (!r.entries[f].ok) {
                        var en = r.entries[f];
                        var exp = false;
                        try { exp = props[en.idx].expressionEnabled; } catch (e4) {}
                        fails.push({slot: item.slot, propIdx: en.idx, msg: en.msg, exp: exp});
                    }
                }
            }
        });
        return {kfCount: kfCount, badCount: badCount, fails: fails};
    }

    // 打帧报告:纯文本拼接(报告与执行彻底分离,v0.1.14)
    function buildReport(comp, props, propNames, plan, result, st) {
        var report = [];
        report.push("QuickKey 打帧报告 · " + MODE_NAMES[st.mode] + " · 节点 " + st.count
            + " · 数值输入 " + VTYPE_NAMES[st.vtype]);
        report.push("合成: " + comp.name + " · 指示器 " + comp.time.toFixed(2) + "s · 帧率 "
            + (1 / comp.frameDuration).toFixed(0) + "fps");
        report.push("选中属性(" + props.length + "): " + propNames.join(" / "));
        for (var i = 0; i < plan.length; i++) {
            var item = plan[i];
            if (item.closed) { report.push("节点" + item.slot + " 关闭 → 跳过"); continue; }
            var note = "";
            if (item.kind === "bad") { note = "数值非法[" + item.raw + "] → 跳过"; }
            else if (item.kind === "empty") { note = "留空 → 用属性当前值"; }
            else { note = "数值 " + describeVal(item.value); }
            var t = comp.time + item.offset * comp.frameDuration;
            report.push("节点" + item.slot + " " + fmtFrames(item.offset) + " (" + t.toFixed(2) + "s) · " + note);
            for (var f = 0; f < result.fails.length; f++) {
                if (result.fails[f].slot === item.slot) {
                    report.push("    ✕ " + propNames[result.fails[f].propIdx] + " : " + result.fails[f].msg
                        + (result.fails[f].exp ? " [属性已启用表达式]" : ""));
                }
            }
        }
        report.push("结果: " + result.kfCount + " 个关键帧 · " + result.badCount + " 个未生效");
        return report.join("\n");
    }

    // 表达式(表达式模式,支线):写入选中属性,不排关键帧
    function applyExpression(props) {
        var expr = state.expr;
        if (!expr || expr.replace(/\s/g, "") === "") {
            setStatus("表达式为空:先在上方填表达式");
            return;
        }
        var result = null;
        withUndo("QuickKey 应用表达式", function () {
            result = perProp(props, function (prop) {
                prop.expression = expr;
                prop.expressionEnabled = true;
            });
        });
        var report = ["QuickKey 表达式应用报告", "表达式: " + expr];
        for (var i = 0; i < result.entries.length; i++) {
            var en = result.entries[i];
            var pn = propName(props[en.idx], en.idx + 1);
            if (en.ok) { report.push("  OK   " + pn); }
            else { report.push("  FAIL " + pn + " : " + en.msg); }
        }
        report.push("结果: " + result.ok + " 个成功 · " + result.bad + " 个失败");
        lastReport = report.join("\n");
        var msg = "表达式已应用:" + result.ok + " 个属性";
        if (result.bad > 0) { msg += " · " + result.bad + " 个失败(点「调试」看明细)"; }
        setStatus(msg);
        if (result.ok === 0 && result.bad > 0) { showReport(); }
    }

    // 主线打帧(v0.1.14 重构):校验 → 计划 → 预检 → 执行 → 报告,各管一段
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
        if (state.vtype === 3) { applyExpression(props); return; }   // 表达式模式:只写表达式

        var dim = state.vtype + 1;
        var plan = buildPlan(state.mode, state.count, state.gap, state.on, state.val, dim);
        var propNames = [];
        for (var pi = 0; pi < props.length; pi++) { propNames.push(propName(props[pi], pi + 1)); }

        // 预检:有显式数值时校验位数,不匹配直接提示并中止
        if (planHasExplicit(plan)) {
            var dchk = dimCheck(props, propNames, dim);
            if (!dchk.ok) {
                failDimCheck(dchk, dim);
                return;
            }
        }

        // 执行 + 报告
        var result = executePlan(comp, props, plan);
        lastReport = buildReport(comp, props, propNames, plan, result, state);
        var msg = "完成:" + result.kfCount + " 个关键帧 · " + props.length + " 个属性 · " + MODE_NAMES[state.mode];
        if (result.badCount > 0) { msg += " · " + result.badCount + " 个未生效(点「调试」看明细)"; }
        setStatus(msg);
        if (result.kfCount === 0) { showReport(); }   // 一个关键帧都没打上 → 自动弹报告
    }

    // ===== UI 层(AE 环境才构建;node 下跳过供测试)=====

    function showReport() {
        var dlg = new Window("dialog", "QuickKey · 调试报告", undefined, {resizeable: true});
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "fill"];
        dlg.margins = 10;
        dlg.spacing = 8;
        var txt = dlg.add("edittext", undefined,
            lastReport || "(尚无执行记录:先点一次「打帧」或「应用表达式」)",
            {multiline: true, scrollable: true});
        txt.preferredSize.width = 520;
        txt.preferredSize.height = 340;
        var grp = dlg.add("group");
        grp.orientation = "row";
        grp.alignment = ["right", "center"];
        var btnClose = grp.add("button", undefined, "关闭");
        btnClose.onClick = function () { dlg.close(); };
        dlg.center();
        dlg.show();
    }

    var isAe = (typeof app !== "undefined");

    if (isAe) {
        var pal = (thisObj instanceof Panel) ? thisObj
            : new Window("palette", "QuickKey · 快速K帧", undefined, {resizeable: false});
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 6;
        pal.margins = 8;

        // 节点数行(1~30,改后回车生效)— 排在最上面
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

        // 模式行
        var grpMode = pal.add("group");
        grpMode.orientation = "row";
        grpMode.alignChildren = ["fill", "center"];
        grpMode.spacing = 6;
        grpMode.add("statictext", undefined, "当前时间指示器作为:");
        var ddMode = grpMode.add("dropdownlist", undefined, MODE_NAMES);
        ddMode.selection = ddMode.items[0];   // 默认起始帧

        // 数值类型行(1/2/3 空 / 表达式)
        var grpType = pal.add("group");
        grpType.orientation = "row";
        grpType.alignChildren = ["fill", "center"];
        grpType.spacing = 6;
        grpType.add("statictext", undefined, "数值输入:");
        var ddType = grpType.add("dropdownlist", undefined, VTYPE_NAMES);
        ddType.selection = ddType.items[0];   // 默认 1 个空
        var typeHint = grpType.add("statictext", undefined, "空=数组维度");
        typeHint.preferredSize.width = 84;

        // 表达式行(仅表达式模式显示)
        var grpExpr = pal.add("group");
        grpExpr.orientation = "row";
        grpExpr.alignChildren = ["fill", "center"];
        grpExpr.spacing = 6;
        grpExpr.add("statictext", undefined, "表达式:");
        var exprInp = grpExpr.add("edittext", undefined, state.expr);
        exprInp.characters = 26;
        exprInp.onChange = function () { state.expr = exprInp.text; };

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
        hLbl.preferredSize.width = 130;
        var hGap = head.add("statictext", undefined, "间隔");
        hGap.preferredSize.width = 40;
        var hVal = head.add("statictext", undefined, "数值");
        hVal.preferredSize.width = 120;
        var hTme = head.add("statictext", undefined, "时间");
        hTme.preferredSize.width = 50;

        var chk = {};    // 开关引用(按槽位)
        var lbl = {};    // 标签引用
        var inp = {};    // 间隔输入引用
        var vin = {};    // 数值输入引用(每个槽位 3 个框的数组)
        var tme = {};    // 时间预览引用
        var rows = [];   // 行控件池(索引 = 槽位 - 1)

        function addRow(slot) {
            var row = grpNodes.add("group");
            row.orientation = "row";
            row.alignChildren = ["fill", "center"];
            row.spacing = 6;
            chk[slot] = row.add("checkbox", undefined, "");
            lbl[slot] = row.add("statictext", undefined, "节点" + slot);
            lbl[slot].preferredSize.width = 130;
            inp[slot] = row.add("edittext", undefined, String(state.gap[slot]));
            inp[slot].characters = 3;
            vin[slot] = [];
            for (var k = 0; k < 3; k++) {
                (function (slot2, k2) {
                    var box = row.add("edittext", undefined, "");
                    box.characters = 4;
                    box.onChange = function () {
                        state.val[slot2][k2] = box.text;   // 框对格直写(v0.1.7 数组存储)
                    };
                    vin[slot2].push(box);
                })(slot, k);
            }
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
            rows.push(row);
        }

        // 确保行池覆盖 count;超出部分隐藏(缩容再扩容时旧值保留)
        function ensureRows() {
            while (rows.length < state.count) { addRow(rows.length + 1); }
            for (var i = 0; i < rows.length; i++) { rows[i].visible = (i + 1) <= state.count; }
        }

        // 打帧 + 调试按钮
        var grpBtns = pal.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignChildren = ["fill", "center"];
        grpBtns.spacing = 6;
        var btnKey = grpBtns.add("button", undefined, "打帧(全部开启的节点)");
        btnKey.onClick = doKey;
        var btnDebug = grpBtns.add("button", undefined, "调试");
        btnDebug.onClick = showReport;
        var status = pal.add("statictext", undefined, "就绪:选中属性 → 设间隔/数值 → 打帧(数值留空=用当前值)");
        status.alignment = ["fill", "top"];

        // ---------- 刷新 ----------
        function refresh() {
            var a = anchorPos(state.mode, state.count);
            var times = computeTimes(state.mode, state.gap, state.on, state.count);
            var dim = (state.vtype === 3) ? 0 : state.vtype + 1;
            grpExpr.visible = (state.vtype === 3);
            btnKey.text = (state.vtype === 3) ? "应用表达式(选中属性)" : "打帧(全部开启的节点)";
            for (var s = 1; s <= state.count; s++) {
                var isAnchor = (s === a);
                chk[s].visible = !isAnchor;
                inp[s].visible = !isAnchor;
                var cells = state.val[s];
                for (var k = 0; k < 3; k++) {
                    vin[s][k].visible = (k < dim);
                    vin[s][k].enabled = isAnchor ? true : state.on[s];
                    vin[s][k].text = cells[k];   // 直读格子(v0.1.7)
                }
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
            pal.layout.layout(true);
        };

        // 数值类型切换
        ddType.onChange = function () {
            state.vtype = ddType.selection.index;
            refresh();
            pal.layout.layout(true);
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
            classifyValue: classifyValue,
            anchorPos: anchorPos,
            buildPlan: buildPlan,
            planHasExplicit: planHasExplicit,
            propDimCore: propDimCore,
            MODE_NAMES: MODE_NAMES
        };
    }

})(this);
