// ============================================================
// 对话文本动画  DialogueText.jsx
// 版本: 0.11.11  (2026-11-25)
// 适用: After Effects 2015.3+ 至 2026 (ExtendScript / ScriptUI)
//
// 一句话: 给时间轴上【选中的文本图层】就地加动态 —— 不改文字、
//         不改字体字号、不改图层位置，只加文本动画器 + 一个参数化文本框蒙版。
//
// 两种方式(面板上是两个互斥单选, 选中哪个就只显示并使用哪套参数):
//   ① 横向滚动: 整行文字从一侧滚入、另一侧滚出，方向可选;
//   ② 逐字出现: 一整套动画 —— 窗口(文本框)内从左往右逐字出现,
//              打满窗口后整行左移, 最后一个字出现后整行在「隐藏(秒)」内
//              渐隐到 0 并按「隐藏像素」向左移动 (出现时长 / 隐藏时长可调)。
//
// 出现窗口(替代 v0.2 的空对象方案):
//   段落文本(框文本) = 【你给的段落框】; 点文本 = 选中文字自身的范围。
//   四边边距(px)可微调: 0 = 紧贴窗口, 正数向外扩, 负数向内收; 窗口外文字不显示。
//   文字在这个固定窗口内滑过, 不再横穿整个画面。
//   羽化距离(px) 决定边缘过渡宽度; 羽化强度(%) 直接映射为蒙版不透明度。
//   横向滚动: 羽化只向框内扩散(框外完全不可见);
//   逐字出现: 羽化向框外扩散(框内全清晰, 首尾字不发虚)。
//   段落文本溢出时会把【排版框】单行化(宽度加够; 不改文字/字号/图层位置),
//   你给的原框仍作为出现窗口 —— 文字在框内像终端一样从右往左流动(v0.11.8)。
//   改完参数再点一次「应用动画」即可更新效果。
//
// 关键 API 已联网核对(2026-11-25):
//   - 文本动画器位置 matchName 是 "ADBE Text Position 3D"
//     (用 "ADBE Text Position" 会报 Can not add a property);
//   - 蒙版形状用 new Shape() + setValue() 写静态路径(层空间顶点 + 零切线);
//   - 蒙版模式 MaskMode.ADD; 蒙版羽化/不透明度是属性组子属性。
//
// 版本历史:
//   v0.11.11: 修正「空格后的第一个字从 0 秒起一直显示」(真机 v0.11.10: 第一个「朵」):
//            根因是选区索引与关键帧节奏都按【原始字符下标】排, 而空格不建动画器,
//            AE 26 索引单位下空格又【不占索引】(真机验证) —— 空格后第一个字的
//            AE 索引没有任何动画器覆盖, 后续字整体早一拍。现统一改用
//            【非空白字符序号 selIdx】: 选区 Index Start/End = selIdx / selIdx+1,
//            关键帧时间 = selIdx × step, 表达式与时长按可见字符数 visN 计算。
//   v0.11.10: 修正 v0.11.9 的选区切换(真机报「属性或父级属性被隐藏」):
//            ① 索引单位必须【每个动画器】分别切 —— 每个新建动画器都自带一个
//               百分比默认选区, 只切第一个会让后面的字用索引值去写百分比;
//            ② 切到索引后 Start/End 换成 ADBE Text Index Start/End,
//               再写百分比那对会报「无法将 set value 与此属性一起使用…被隐藏」;
//            ③ 取不到索引属性就切回百分比, 绝不混用。v0.11.9 作废。
//   v0.11.9: (已撤回, 由 v0.11.10 修正) 每字动画器选区改用索引单位:
//            Start=i、End=i+1 精确选中第 i+1 个字符(0 基), 不依赖百分比取整;
//            修复段落文本「有两个字从 0 秒起一直显示」。
//   v0.11.8: 段落文本溢出【不再拉高框】(用户: 我给的文本框就是出现字的范围):
//            改为把排版框【单行化】(框高保持一行, 宽度倍增 + 二分加到能装下一行),
//            再把【你给的原框(宽高都不动)】当作出现窗口 —— 文字在框内像终端一样
//            从右往左流动, 不再换行、不再超出框; 原框尺寸写进蒙版名
//            ("DT_窗口 595x49"), 重复应用仍按原框当窗口, 不会把加宽的排版框误当窗口;
//            段落文本的窗口一律 = 段落框(v0.11.7 及之前是文字外框), 点文本不变;
//   v0.11.7: 段落框溢出改用【AE 官方 TextDocument.boxOverflow】判定(AE 24.6+),
//            再用「倍增 + 二分」找到最小可容纳高度写回 boxTextSize:
//            不再依赖 sourceRectAtTime 返回的是文字范围还是框尺寸
//            (v0.11.6 的撑高探测在返回框尺寸的版本上只能还原告警);
//            写回后复核 boxOverflow, 仍有溢出就还原; 框高变化时把 boxTextPos
//            恢复原值, 文字不会跟着框跳; 旧版 AE 没有 boxOverflow 时
//            自动退回 v0.11.6 的撑高探测法;
//   v0.11.6: 修复【出现时长(如 6 秒)像没生效、长句后半段不出现】:
//            根因不在时间轴 —— AE 的【段落文本(框文本)】超出定界框的部分不会显示
//            (框右下角只出现溢出图标), 而脚本按 sourceRectAtTime 的可见范围
//            建窗口、按字数排关键帧: 被裁掉的行整段时间都不可见, 视觉上就变成
//            「演到可见的一行(约 2 秒)就停了」。现在应用前先检测段落文本:
//            把定界框临时撑高再测, 文字高度变大 => 确有被裁掉的行, 就把框高
//            收到刚好容纳全部文字(宽度不变, 换行位置不变), 再按新范围建窗口;
//            同时日志打印框/字号/行距/图层时间基准与关键帧核对结果;
//   v0.11.5: 修复【文字很长时, 尾部的字没有逐字出现】: 逐字出现的窗口 = 文本框,
//            而羽化是向【框内】缩的(清晰区比框窄 2×羽化), 表达式为避开羽化把
//            文字右移一个羽化宽 —— 长文本时尾部几个字被推出框外/推进羽化区,
//            只能等隐藏阶段整行左移才露出来。现改为: 逐字出现的羽化向【框外】
//            扩散(框内始终完全清晰, 首尾字都不发虚), 位置表达式不再右移补偿,
//            边界直接按文本框计算; 只有负边距(框比文字窄)时才开始整行左移;
//   v0.11.4: 修复【逐字出现被整体渐隐顶掉】: DT_滚动 上覆盖 0-100% 选区的
//            不透明度 100 -> 0 会覆盖每字动画器的不透明度(整行从 0 秒就可见),
//            现改为把隐藏阶段渐隐写进【每个字自己的】不透明度动画器
//            (同一时间区间 100 -> 0), DT_滚动 只负责位置;
//   v0.11.3: 修复【开头逐字出现效果消失】: 每字动画器都自己 addRangeSelector,
//            但 AE 新建动画器自带一个默认选区(0-100%), 两个选区并集覆盖全部字符,
//            每字独立关键帧退化成整行一起渐变; 现改为优先复用已有选区;
//   v0.11.2: 修正整体渐隐关键帧: 文本动画器 Opacity 是【目标不透明度】(100 = 不变,
//            0 = 全透明), 脚本取值范围 0..100 —— 原先写 0 -> -100 会报
//            「值 -100 在 0 至 100 的范围外」, 且第一帧 0 会把整行提前变透明;
//            现改为 100 -> 0, 失败时把两个关键帧重置为 100 保持可见;
//   v0.11.1: 修复逐字出现【应用失败】(第二个动画器的创建链路在 AE 26 上不稳定):
//            整体渐隐改为与 DT_滚动 共用同一个动画器(不透明度 100 -> 0),
//            少建一个动画器/选区; 错误信息统一走 errText 安全转换;
//            「输出与调试」日志框加高(4 行 -> 10 行);
//   v0.11.0: 隐藏阶段补回【整体渐隐】: 隐藏(秒) 内不透明度 100% -> 0%,
//            「隐藏像素」只负责在这段时间里把文字向左推, 两者同时发生;
//   v0.10.0: 逐字出现新增【羽化自动补偿】: 内向羽化让清晰区左右各窄一个羽化宽,
//            文字自动右移进清晰区, 打字前沿也只到清晰区右缘, 出现的字不发虚;
//            新增参数「隐藏像素」, 控制隐藏阶段向左位移的距离(0 = 不动);
//   v0.9.0: 「方式」下拉改为【两个互斥单选】: 选中哪个就只显示并使用哪套参数
//           (横向滚动参数组 / 逐字出现参数组), 不再用下拉切换;
//   v0.8.0: 模式合并回【两种】: 「逐字出现」本身就是一整套(出现 + 左移 + 滑出),
//           删除独立的「逐字左移」模式与「字速」参数(改由出现总时长控制);
//   v0.7.0: 逐字左移改为【一整套动画】: 以文本框为窗口, 打满后整行左移,
//           最后一个字出现后用「隐藏时长」整行向左滑出窗口(不再渐隐);
//           时间参数改为【出现(秒) + 隐藏(秒)】, 去掉窗口宽/停留/整体渐隐;
//   v0.6.0: 新增【逐字左移】模式(固定窗口逐字出现 + 满窗整体左移 + 停留后整体渐隐);
//           首次加载提速(日志改为节流落盘); 说明文字改用静态文本,
//           去掉白底输入框和多余滚动条;
//   v0.5.1: 羽化改为【只向框内扩散】: 蒙版路径向内缩半个羽化, 框外完全不可见;
//   v0.5.0: 新增【开头曲线 / 结束曲线】两个下拉, 控制滚动的速度分布
//           (匀速 / 慢起加速 / 快起减速 · 匀速 / 减速慢收 / 加速快收);
//   v0.4.0: 文本框改为【贴合文字自身范围】, 文字只在框内滑过, 不再横穿整个画面;
//   v0.3.0: 移除空对象控制器, 改为「上下左右内缩 + 羽化距离 + 羽化强度」参数化文本框;
//   v0.2.0: 读取选中文本层就地加动画(破坏性改版, 移除字幕生成)。
// ============================================================
(function (thisObj) {

    // ============================================================
    // 一、标识与版本
    // ============================================================
    // 版本号单一真相: ① VER 常量 ② CHANGELOG 顶部 ③ 面板顶部显示, 三处必须一致。
    var VER = "0.11.11";

    var TOOL_ID = "DialogueText";          // 英文标识: 文件 / 导出名
    var TOOL_TITLE = "对话文本动画";        // 中文显示名

    // 所有魔法字符串集中在此, 不散写。
    var MASK_WINDOW_NAME = "DT_窗口";
    var ANIM_SCROLL_NAME = "DT_滚动";
    var ANIM_FADE_PREFIX = "DT_渐隐";

    var MODE_SCROLL = 0;                   // 横向滚动
    var MODE_TYPE = 1;                     // 逐字出现(一整套: 出现 + 满窗左移 + 滑出)
    var DIR_RTL = 0;                       // 从右往左
    var DIR_LTR = 1;                       // 从左往右

    // 动态曲线(只影响横向滚动的速度分布)
    var CURVE_LINEAR = 0;                  // 匀速
    var CURVE_SLOW = 1;                    // 开头=慢起加速 / 结束=减速慢收
    var CURVE_FAST = 2;                    // 开头=快起减速 / 结束=加速快收

    var MAX_TEXT_LAYERS = 50;              // 单次最多处理的文本层
    var MAX_TYPE_CHARS = 2000;             // 单层逐字动画器上限
    var MAX_TOTAL_TYPE_CHARS = 5000;       // 单次逐字动画器总数上限
    var MIN_BOX = 2;                       // 文本框最小宽高(px), 防止负边距把窗口挤没

    // ============================================================
    // 二、纯逻辑层 —— 只做数学/字符串, 绝不碰 AE API
    // ============================================================
    function clampNum(v, lo, hi) {
        v = Number(v);
        if (isNaN(v)) { v = lo; }
        return v < lo ? lo : (v > hi ? hi : v);
    }

    function clampInt(v, lo, hi) {
        return Math.round(clampNum(v, lo, hi));
    }

    // AE 宿主抛出的 Error 对象在个别情况下无法直接参与字符串拼接,
    // 统一经这里取文本, 避免「报错时又报错」把真正的失败原因吞掉。
    function errText(e) {
        if (e === null || e === undefined) { return "(无错误信息)"; }
        try { return String(e); } catch (e0) {}
        try { return String(e.message); } catch (e1) {}
        return "(无法读取错误信息)";
    }

    function trimStr(s) {
        return String(s === null || s === undefined ? "" : s).replace(/^\s+|\s+$/g, "");
    }

    function pad2(n) {
        var v = Math.round(Number(n));
        if (isNaN(v)) { v = 0; }
        return v < 10 ? "0" + v : String(v);
    }

    // 按 Unicode 码点拆字: 代理对(emoji)算 1 个字符, 与 AE 的字符计数一致。
    function splitChars(str) {
        var s = String(str === null || str === undefined ? "" : str);
        var out = [];
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
                var c2 = s.charCodeAt(i + 1);
                if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                    out.push(s.substring(i, i + 2));
                    i++;
                    continue;
                }
            }
            out.push(s.charAt(i));
        }
        return out;
    }

    function countChars(str) {
        return splitChars(str).length;
    }

    // 非空白字符数 = AE 索引单位下可被逐字动画器命中的字符数。
    // AE 26 真机: 逐字动画器不给空格建, 索引单位下空格也不占索引,
    // 因此选区索引与关键帧节奏都必须用这个序号(见 applyTypeScroll)。
    function countVisibleChars(str) {
        var cs = splitChars(str);
        var n = 0;
        for (var i = 0; i < cs.length; i++) {
            if (!/^\s$/.test(cs[i])) { n++; }
        }
        return n;
    }

    function truncateStr(str, maxChars) {
        var cs = splitChars(str);
        var n = Number(maxChars);
        if (!(n > 0)) { return ""; }
        if (cs.length <= n) { return cs.join(""); }
        return cs.slice(0, Math.max(0, n - 1)).join("") + "…";
    }

    // sourceRectAtTime 失败时的保守估算: 中文按 0.6 字号宽, 不追求精确。
    function estimateTextWidth(text, fontSize) {
        var n = countChars(text);
        var fs = Number(fontSize);
        if (!(fs > 0)) { fs = 72; }
        return Math.max(fs, n * fs * 0.6);
    }

    function normalizeMode(v) {
        return Number(v) === MODE_TYPE ? MODE_TYPE : MODE_SCROLL;
    }

    function normalizeDirection(v) {
        return Number(v) === DIR_LTR ? DIR_LTR : DIR_RTL;
    }

    function modeText(mode) {
        return normalizeMode(mode) === MODE_TYPE ? "逐字出现" : "横向滚动";
    }

    function directionText(dir) {
        return normalizeDirection(dir) === DIR_LTR ? "从左往右" : "从右往左";
    }

    function normalizeCurve(v) {
        var n = Math.round(Number(v));
        if (!(n >= CURVE_LINEAR && n <= CURVE_FAST)) { n = CURVE_LINEAR; }
        return n;
    }

    function curveStartText(c) {
        c = normalizeCurve(c);
        if (c === CURVE_SLOW) { return "慢起加速"; }
        if (c === CURVE_FAST) { return "快起减速"; }
        return "匀速起步";
    }

    function curveEndText(c) {
        c = normalizeCurve(c);
        if (c === CURVE_SLOW) { return "减速慢收"; }
        if (c === CURVE_FAST) { return "加速快收"; }
        return "匀速收尾";
    }

    // 组合曲线: 按进度对「开头曲线 a」与「结束曲线 b」加权, 端点严格 0/1。
    //   慢起 + 慢收 = 淡入淡出(平滑进退);
    //   快起 + 慢收 = 前面快后面慢;
    //   慢起 + 快收 = 前面慢后面快。
    function easeProgress(k, startCurve, endCurve) {
        var x = clampNum(k, 0, 1);
        var sc = normalizeCurve(startCurve);
        var ec = normalizeCurve(endCurve);
        var a = x;
        if (sc === CURVE_SLOW) { a = x * x; }
        else if (sc === CURVE_FAST) { a = 1 - (1 - x) * (1 - x); }
        var b = x;
        if (ec === CURVE_SLOW) { b = 1 - (1 - x) * (1 - x); }
        else if (ec === CURVE_FAST) { b = x * x; }
        return a * (1 - x) + b * x;
    }

    // 文本框 = 文字自身外框(层空间) + 四边边距。
    // 0 = 紧贴文字; 正数向外扩; 负数向内收。保证至少 MIN_BOX 宽高。
    function computeBox(rect, padL, padR, padT, padB) {
        var rl = rect ? Number(rect.left) : 0;
        if (isNaN(rl)) { rl = 0; }
        var rt = rect ? Number(rect.top) : 0;
        if (isNaN(rt)) { rt = 0; }
        var rw = rect ? Number(rect.width) : 0;
        if (isNaN(rw) || rw < 0) { rw = 0; }
        var rh = rect ? Number(rect.height) : 0;
        if (isNaN(rh) || rh < 0) { rh = 0; }

        var left = rl - (Number(padL) || 0);
        var right = rl + rw + (Number(padR) || 0);
        var top = rt - (Number(padT) || 0);
        var bottom = rt + rh + (Number(padB) || 0);

        if (right - left < MIN_BOX) {
            var cx = (left + right) / 2;
            left = cx - MIN_BOX / 2;
            right = left + MIN_BOX;
        }
        if (bottom - top < MIN_BOX) {
            var cy = (top + bottom) / 2;
            top = cy - MIN_BOX / 2;
            bottom = top + MIN_BOX;
        }
        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: right - left,
            height: bottom - top
        };
    }

    // 滚动位移(层空间): 正值向右, 负值向左。
    // 起始: 文字完全在窗口一侧之外; 结束: 完全到另一侧之外。
    function computeScrollOffsets(rectLeft, rectWidth, leftX, rightX, direction) {
        var rl = Number(rectLeft);
        if (isNaN(rl)) { rl = 0; }
        var rw = Number(rectWidth);
        if (isNaN(rw) || rw < 0) { rw = 0; }
        var rr = rl + rw;
        var lo = Math.min(Number(leftX) || 0, Number(rightX) || 0);
        var hi = Math.max(Number(leftX) || 0, Number(rightX) || 0);
        var start, end;
        if (normalizeDirection(direction) === DIR_LTR) {
            start = lo - rr;               // 文字右缘贴在左控制线
            end = hi - rl;                 // 文字左缘贴在右控制线
        } else {
            start = hi - rl;               // 文字左缘贴在右控制线
            end = lo - rr;                 // 文字右缘贴在左控制线
        }
        return { start: start, end: end, distance: Math.abs(end - start) };
    }

    // 蒙版名: "DT_窗口" 或 "DT_窗口 595x49"(v0.11.8: 段落文本把【用户原框】的
    // 尺寸存进名字里 —— 排版框被单行化加宽后, 重复应用时仍能找回真正的窗口)。
    function isOurMaskName(name) {
        var s = String(name === null || name === undefined ? "" : name);
        if (s === MASK_WINDOW_NAME) { return true; }
        return s.indexOf(MASK_WINDOW_NAME + " ") === 0;
    }

    function buildMaskName(boxW, boxH) {
        var w = Math.round(Number(boxW) || 0);
        var h = Math.round(Number(boxH) || 0);
        if (!(w > 0) || !(h > 0)) { return MASK_WINDOW_NAME; }
        return MASK_WINDOW_NAME + " " + w + "x" + h;
    }

    function parseMaskNameBox(name) {
        var s = String(name === null || name === undefined ? "" : name);
        if (s.indexOf(MASK_WINDOW_NAME + " ") !== 0) { return null; }
        var parts = s.substring(MASK_WINDOW_NAME.length + 1).split("x");
        if (parts.length !== 2) { return null; }
        var w = Number(parts[0]);
        var h = Number(parts[1]);
        if (!(w > 0) || !(h > 0)) { return null; }
        return { width: w, height: h };
    }

    function isOurAnimatorName(name) {
        var s = String(name === null || name === undefined ? "" : name);
        return s.indexOf(ANIM_SCROLL_NAME) === 0 || s.indexOf(ANIM_FADE_PREFIX) === 0;
    }

    // 表达式里的数字字面量。表达式是另一套引擎, 这里只做保守处理。
    function exprNum(v) {
        var n = Number(v);
        if (isNaN(n) || !isFinite(n)) { n = 0; }
        n = Math.round(n * 1000) / 1000;
        return String(n);
    }

    // 文本框蒙版顶点(层空间): 左上 -> 右上 -> 右下 -> 左下, 闭合矩形。
    // 直接写静态形状, 不用表达式; 图层有缩放/旋转时框随文字一起变换。
    function buildMaskVertices(box) {
        var l = box ? Number(box.left) || 0 : 0;
        var t = box ? Number(box.top) || 0 : 0;
        var r = box ? Number(box.right) || 0 : 0;
        var b = box ? Number(box.bottom) || 0 : 0;
        return [[l, t], [r, t], [r, b], [l, b]];
    }

    // 羽化向内: AE 的蒙版羽化以路径为中心向两侧扩散。
    // 把左右路径各向内缩【半个羽化】, 过渡区就完全落在文本框内部,
    // 框外不会出现半透明文字(超出边框完全看不到)。上下不羽化, 不内缩。
    function computeFeatherInsetBox(box, featherLayerX) {
        var l = box ? Number(box.left) || 0 : 0;
        var t = box ? Number(box.top) || 0 : 0;
        var r = box ? Number(box.right) || 0 : 0;
        var b = box ? Number(box.bottom) || 0 : 0;
        var f = Number(featherLayerX) || 0;
        if (f < 0) { f = 0; }
        var w = r - l;
        if (w < 0) { w = 0; r = l; }
        // 羽化不超过框宽, 且路径至少留 0.5px, 避免退化成一条线。
        if (f > w - 0.5) { f = Math.max(0, w - 0.5); }
        var half = Math.max(0.25, (w - f) / 2);
        var cx = (l + r) / 2;
        var nl = cx - half;
        var nr = cx + half;
        return {
            left: nl,
            top: t,
            right: nr,
            bottom: b,
            width: nr - nl,
            height: b - t
        };
    }

    // 羽化向外(逐字出现用): 逐字出现时窗口 = 文本框, 框内的字从出现那一刻起
    // 就必须是实心的(向内羽化会把首尾的字吃掉, 长文本尾部尤其明显)。
    // 把左右路径各向外扩【半个羽化】, 过渡区就完全落在文本框外面。
    function computeFeatherOutsetBox(box, featherLayerX) {
        var l = box ? Number(box.left) || 0 : 0;
        var t = box ? Number(box.top) || 0 : 0;
        var r = box ? Number(box.right) || 0 : 0;
        var b = box ? Number(box.bottom) || 0 : 0;
        var f = Number(featherLayerX) || 0;
        if (f < 0) { f = 0; }
        var half = f / 2;
        var nl = l - half;
        var nr = r + half;
        return {
            left: nl,
            top: t,
            right: nr,
            bottom: b,
            width: nr - nl,
            height: b - t
        };
    }

    // 滚动表达式: 位置 offset = 起始 -> 结束, 从图层入点开始。
    // 起止点由文本框左右边界决定(都是层空间坐标, 与静态蒙版一致)。
    // 曲线只改速度分布, 不改起止点: 先算 a(开头曲线)/b(结束曲线), 再按进度加权。
    function buildScrollExpression(rectLeft, rectWidth, boxLeft, boxRight,
                                   duration, direction, is3D, startCurve, endCurve) {
        var rl = Number(rectLeft);
        if (isNaN(rl)) { rl = 0; }
        var rw = Number(rectWidth);
        if (isNaN(rw) || rw < 0) { rw = 0; }
        var lo = Math.min(Number(boxLeft) || 0, Number(boxRight) || 0);
        var hi = Math.max(Number(boxLeft) || 0, Number(boxRight) || 0);
        var sc = normalizeCurve(startCurve);
        var ec = normalizeCurve(endCurve);
        var lines = [
            "var lo = " + exprNum(lo) + ";",
            "var hi = " + exprNum(hi) + ";",
            "var rl = " + exprNum(rl) + ";",
            "var rr = " + exprNum(rl + rw) + ";",
            "var s;",
            "var e;"
        ];
        if (normalizeDirection(direction) === DIR_LTR) {
            lines.push("s = lo - rr;");
            lines.push("e = hi - rl;");
        } else {
            lines.push("s = hi - rl;");
            lines.push("e = lo - rr;");
        }
        lines.push("var dur = " + exprNum(Math.max(0.01, duration)) + ";");
        lines.push("var k = (time - inPoint) / dur;");
        lines.push("if (k < 0) { k = 0; } else if (k > 1) { k = 1; }");
        // 曲线内联展开(表达式里不定义函数): q = a*(1-k) + b*k, 端点严格 0/1。
        lines.push("var a = k;");
        if (sc === CURVE_SLOW) { lines.push("a = k * k;"); }
        else if (sc === CURVE_FAST) { lines.push("a = 1 - (1 - k) * (1 - k);"); }
        lines.push("var b = k;");
        if (ec === CURVE_SLOW) { lines.push("b = 1 - (1 - k) * (1 - k);"); }
        else if (ec === CURVE_FAST) { lines.push("b = k * k;"); }
        lines.push("var q = a * (1 - k) + b * k;");
        lines.push("var dx = s + (e - s) * q;");
        lines.push(is3D ? "[dx, 0, 0]" : "[dx, 0]");
        return lines.join("\n");
    }

    // 逐字出现的时间轴(相对图层入点): 一整套动画 = 出现 + 隐藏。
    // step: 相邻两个字的出现间隔; 最后一个字在 appearDur 完成单字渐隐;
    // 之后用 hideDur 秒整行渐隐到 0, 同时按「隐藏像素」向左移动。
    function computeTypeScrollTiming(charCount, appearDur, fade, hideDur) {
        var n = Math.max(1, Math.round(Number(charCount) || 1));
        var ap = Number(appearDur);
        if (!(ap > 0)) { ap = 1; }
        var f = Number(fade);
        if (!(f > 0)) { f = 0; }
        if (f > ap) { f = ap; }
        var hd = Number(hideDur);
        if (!(hd > 0)) { hd = 0.05; }
        var step = n > 1 ? Math.max(0, ap - f) / (n - 1) : 0;
        return {
            step: step,
            lastVisible: ap,
            endTime: ap + hd
        };
    }

    // ---------- 段落文本(框文本)溢出 ----------
    // AE 的段落文本超出定界框的部分【不会显示】(框右下角只出现溢出图标)。
    // 旧版 AE 没有 boxOverflow 时, 只能把框临时撑高再量文字高度:
    // 量到的高度明显大于原框高, 说明原来确有被裁掉的行(v0.11.8 起改为单行化)。
    function isBoxOverflow(boxHeight, probedTextHeight) {
        var b = Number(boxHeight);
        var p = Number(probedTextHeight);
        if (!(b > 0) || !(p > 0)) { return false; }
        return p > b + 1;
    }

    // 逐字出现的位置表达式(一整套动画):
    //   窗口 = 文本框本身: 蒙版羽化在【框外】扩散(computeFeatherOutsetBox),
    //   框内的字从出现那一刻起就是实心的, 不需要再把文字右移避开羽化 ——
    //   那种右移会把长文本尾部的字推出框外, 尾部只能等隐藏阶段滑出来。
    //   出现阶段: 前沿(已出现的字 + 正在画的字)保持在框右缘以内;
    //             文字不右移, 只有文本框比文字窄(负边距)时才按前沿整行左移;
    //   隐藏阶段: 出现结束后, 用 hideDur 秒把整行再向左推 hidePx 像素
    //             (0 = 停在出现结束时的位置; 足够大 = 完全滑出窗口)。
    //             同一段时间里的整体渐隐由每字不透明度动画器负责, 不写进表达式。
    function buildTypeScrollExpression(charCount, rectLeft, rectWidth,
        boxLeft, boxRight, appearDur, fade, hideDur, is3D, hidePx) {
        var n = Math.max(0, Math.round(Number(charCount) || 0));
        var rl = Number(rectLeft);
        if (isNaN(rl)) { rl = 0; }
        var rw = Number(rectWidth);
        if (isNaN(rw) || rw < 0) { rw = 0; }
        var bl = Number(boxLeft);
        if (isNaN(bl)) { bl = 0; }
        var br = Number(boxRight);
        if (isNaN(br)) { br = 0; }
        var ap = Number(appearDur);
        if (!(ap > 0)) { ap = 1; }
        var f = Number(fade);
        if (!(f > 0)) { f = 0; }
        if (f > ap) { f = ap; }
        var hd = Number(hideDur);
        if (!(hd > 0)) { hd = 0.05; }
        // 隐藏阶段向左推进的距离(层空间); 0 = 停在出现结束的位置。
        var hpx = Number(hidePx);
        if (!(hpx > 0)) { hpx = 0; }

        var avg = n > 0 ? rw / n : 0;
        var step = n > 1 ? Math.max(0, ap - f) / (n - 1) : 0;
        var lines = [
            "var n = " + n + ";",
            "var rl = " + exprNum(rl) + ";",
            "var rr = " + exprNum(rl + rw) + ";",
            "var bl = " + exprNum(bl) + ";",
            "var br = " + exprNum(br) + ";",
            "var hpx = " + exprNum(hpx) + ";",
            "var avg = " + exprNum(avg) + ";",
            "var step = " + exprNum(step) + ";",
            "var ap = " + exprNum(ap) + ";",
            "var hd = " + exprNum(hd) + ";",
            "var t = time - inPoint;",
            // +1 = 把「正在画的那个字」的宽度也算进前沿, 保证它的右缘也不被框切到;
            // 出现结束时 ks 正好到 n, 与隐藏阶段的 dx0 连续, 不会在 t=ap 处跳一下。
            "var ks = step > 0 ? t / step + 1 : 0;",
            "if (ks < 0) { ks = 0; } else if (ks > n) { ks = n; }",
            // 前沿保持在框右缘以内; 文字【不右移】(dx 上限 0) ——
            // 右移会让尾部文字落到框外, 长文本时尾部就不再逐字出现。
            "var dx = br - (rl + avg * ks);",
            "if (dx > 0) { dx = 0; }",
            // 左移下限: 文字右缘不越过框右缘(零/正边距时恒为 0, 文字完全不动)。
            "var dxEnd = br - rr;",
            "if (dxEnd > 0) { dxEnd = 0; }",
            "if (dx < dxEnd) { dx = dxEnd; }",
            "if (t > ap) {",
            "    var h = (t - ap) / hd;",
            "    if (h > 1) { h = 1; }",
            "    var dx0 = dxEnd;",
            "    var dx1 = dx0 - hpx;",
            "    dx = dx0 + (dx1 - dx0) * h;",
            "}",
            is3D ? "[dx, 0, 0]" : "[dx, 0]"
        ];
        return lines.join("\n");
    }

    // ============================================================
    // 三、node 测试导出闸门
    // ============================================================
    // 位置硬约束: 所有纯函数定义之后、任何 AE API 调用之前。
    if (typeof app === "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            module.exports = {
                clampNum: clampNum,
                clampInt: clampInt,
                trimStr: trimStr,
                pad2: pad2,
                splitChars: splitChars,
                countChars: countChars,
                countVisibleChars: countVisibleChars,
                truncateStr: truncateStr,
                estimateTextWidth: estimateTextWidth,
                normalizeMode: normalizeMode,
                normalizeDirection: normalizeDirection,
                modeText: modeText,
                directionText: directionText,
                normalizeCurve: normalizeCurve,
                curveStartText: curveStartText,
                curveEndText: curveEndText,
                easeProgress: easeProgress,
                computeBox: computeBox,
                computeScrollOffsets: computeScrollOffsets,
                isOurMaskName: isOurMaskName,
                buildMaskName: buildMaskName,
                parseMaskNameBox: parseMaskNameBox,
                isOurAnimatorName: isOurAnimatorName,
                exprNum: exprNum,
                buildMaskVertices: buildMaskVertices,
                computeFeatherInsetBox: computeFeatherInsetBox,
                computeFeatherOutsetBox: computeFeatherOutsetBox,
                buildScrollExpression: buildScrollExpression,
                buildTypeScrollExpression: buildTypeScrollExpression,
                computeTypeScrollTiming: computeTypeScrollTiming,
                isBoxOverflow: isBoxOverflow,
                VER: VER,
                NAMES: {
                    toolTitle: TOOL_TITLE,
                    toolId: TOOL_ID,
                    mask: MASK_WINDOW_NAME,
                    scrollAnim: ANIM_SCROLL_NAME,
                    fadePrefix: ANIM_FADE_PREFIX
                },
                MODE_SCROLL: MODE_SCROLL,
                MODE_TYPE: MODE_TYPE,
                DIR_RTL: DIR_RTL,
                DIR_LTR: DIR_LTR,
                CURVE_LINEAR: CURVE_LINEAR,
                CURVE_SLOW: CURVE_SLOW,
                CURVE_FAST: CURVE_FAST,
                MAX_TEXT_LAYERS: MAX_TEXT_LAYERS,
                MAX_TYPE_CHARS: MAX_TYPE_CHARS,
                MAX_TOTAL_TYPE_CHARS: MAX_TOTAL_TYPE_CHARS,
                MIN_BOX: MIN_BOX
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

    var pal = null;                 // 面板引用, safeRun 收尾时要用
    var gUIError = "";

    // ---------- 文件日志(桌面) ----------
    // AE 的 ScriptUI 构建错误和 handler 异常都是【静默】的, 所以固定写桌面日志。
    var LOG_FILE_NAME = "DialogueText_debug.log";
    var LOG_WRITE_GAP = 800;        // 自动落盘的最小间隔(ms), 避免启动时频繁写文件
    var LOG_MAX_LINES = 2000;       // 内存里最多保留的日志行数
    var gLogPath = "";
    var gLogLines = [];
    var gLogDirty = false;
    var gLastLogWrite = 0;
    var gDiag = [];

    function nowStr() {
        var d = new Date();
        return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
            + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
    }

    function flog(msg) {
        var line = nowStr() + "  " + String(msg);
        try {
            gLogLines.push(line);
            if (gLogLines.length > LOG_MAX_LINES) { gLogLines.shift(); }
        } catch (e1) { return; }
        gLogDirty = true;
        // 启动阶段 flog 很密集, 而桌面目录可能被网盘同步, 每次整文件重写会明显拖慢加载。
        // 这里只先在内存累积, 最多每 LOG_WRITE_GAP 毫秒落盘一次;
        // 关键节点(挂载完成 / handler 结束 / 出错)由 flushLog() 强制落盘。
        var t = 0;
        try { t = new Date().getTime(); } catch (e2) { t = 0; }
        if (t - gLastLogWrite >= LOG_WRITE_GAP) { writeLogSnapshot(); }
    }

    function initLog() {
        try {
            gLogPath = Folder.desktop.fsName + "/" + LOG_FILE_NAME;
        } catch (e0) {
            try { gLogPath = Folder.temp.fsName + "/" + LOG_FILE_NAME; } catch (e1) { gLogPath = ""; }
        }
        gLogLines = [];
        gLogDirty = false;
        flog(TOOL_TITLE + " v" + VER + "  启动");
        try { flog("脚本文件: " + $.fileName); } catch (e3) {}
        try { flog("AE: " + app.version + " / ExtendScript " + $.version); } catch (e4) {}
        try { flog("宿主: " + ((thisObj instanceof Panel) ? "Panel 面板" : "独立窗口")); } catch (e5) {}
        flog("日志路径: " + (gLogPath || "(不可写)"));
    }

    function writeLogSnapshot() {
        if (!gLogDirty || !gLogPath) { return false; }
        try {
            var f = new File(gLogPath);
            f.encoding = "UTF-8";
            if (!f.open("w")) { return false; }
            f.write(gLogLines.join("\n"));
            f.close();
            gLogDirty = false;
            try { gLastLogWrite = new Date().getTime(); } catch (e2) {}
            return true;
        } catch (e) { return false; }
    }

    // 强制落盘: 首次加载结束时只写一次, 出错时也不丢最后几行。
    function flushLog() {
        return writeLogSnapshot();
    }

    function flushDiag(p) {
        try { if (p && p.debugBox) { p.debugBox.text = gDiag.join("\n"); } } catch (e) {}
    }

    function diag(msg) {
        var s = String(msg);
        flog("[diag] " + s);
        try {
            gDiag.push(s);
            if (gDiag.length > 300) { gDiag.shift(); }
        } catch (e1) {}
        flushDiag(pal);
    }

    function copyBoxToClipboard(box) {
        try {
            box.active = true;
            app.executeCommand(23);     // Select All
            app.executeCommand(19);     // Copy
        } catch (e) { diag("复制失败: " + errText(e)); }
    }

    initLog();

    // ---------- 状态栏 ----------
    function setStatus(p, msg, rgb) {
        var s = String(msg);
        flog("[status] " + s);
        var target = p || pal;
        if (target && target.statusText) {
            try { target.statusText.text = truncateStr(s, 64); } catch (e) {}
        }
    }

    // 所有 handler 必须经 safeRun: AE 的 ScriptUI handler 抛错是完全静默的。
    function safeRun(label, fn) {
        return function () {
            try {
                flog("▶ " + label);
                var r = fn.apply(this, arguments);
                flog("✔ " + label);
                flushLog();
                return r;
            } catch (e) {
                var detail = "✘ " + label + " 失败: " + errText(e);
                if (e && e.line) { detail += " @line " + e.line; }
                if (e && e.fileName) { detail += " @ " + e.fileName; }
                if (e && e.stack) { detail += "\n" + e.stack; }
                flog(detail);
                diag(detail);
                flushLog();
                setStatus(pal, "⚠ " + (e ? e.toString() : e), C_ERR);
                try {
                    alert(TOOL_TITLE + " 出错：\n" + (e ? e.toString() : e)
                        + (e && e.line ? "\n行号: " + e.line : "")
                        + "\n\n日志:\n" + gLogPath);
                } catch (e2) {}
                return null;
            }
        };
    }

    // ---------- 合成 / 图层前置条件 ----------
    function getComp() {
        var item = app.project ? app.project.activeItem : null;
        if (!item || !(item instanceof CompItem)) { return null; }
        return item;
    }

    function needCompAlert() {
        try {
            alert("请先在时间轴里激活一个合成（在时间轴面板里点一下该合成），再操作。");
        } catch (e) {}
    }

    function isTextLayer(L) {
        if (!L) { return false; }
        try { if (L instanceof TextLayer) { return true; } } catch (e1) {}
        try { if (String(L.matchName) === "ADBE Text Layer") { return true; } } catch (e2) {}
        return false;
    }

    function getSelectedTextLayers(comp) {
        var out = [];
        var sel = null;
        try { sel = comp.selectedLayers; } catch (e) { sel = []; }
        if (!sel) { return out; }
        for (var i = 0; i < sel.length; i++) {
            if (isTextLayer(sel[i])) {
                out.push(sel[i]);
            } else {
                diag("跳过非文本层: " + sel[i].name);
            }
        }
        return out;
    }

    // ---------- 属性取值(多候选回退) ----------
    function getPropSafe(parent, names) {
        if (!parent) { return null; }
        for (var i = 0; i < names.length; i++) {
            try {
                var p = parent.property(names[i]);
                if (p) { return p; }
            } catch (e) {}
        }
        return null;
    }

    function getTransformGroup(layer) {
        return getPropSafe(layer, ["ADBE Transform Group", "Transform", "变换"]);
    }

    function getTransformScale(layer) {
        var g = getTransformGroup(layer);
        return getPropSafe(g, ["ADBE Scale", "Scale", "缩放"]);
    }

    // 图层缩放比例(100 -> 1)。羽化/位移参数是画面像素, 写表达式前按它反算层空间。
    function getScaleXY(layer) {
        var sx = 1;
        var sy = 1;
        var scale = getTransformScale(layer);
        if (scale) {
            try {
                var sv = scale.value;
                var vx = Number(sv[0]) / 100;
                var vy = Number(sv[1]) / 100;
                if (vx > 0) { sx = vx; }
                if (vy > 0) { sy = vy; }
            } catch (eSc) {}
        }
        return { sx: sx, sy: sy };
    }

    function getSourceTextProp(layer) {
        var textProps = getPropSafe(layer, ["ADBE Text Properties", "Text", "文本"]);
        return getPropSafe(textProps, ["ADBE Text Document", "Source Text", "源文本"]);
    }

    // 只读文本内容(不测量), 用于应用前的上限检查。
    function getLayerText(layer) {
        var st = getSourceTextProp(layer);
        if (!st) { return null; }
        try { return String(st.value.text); } catch (e) { return null; }
    }

    function getAnimatorsGroup(layer) {
        var textProps = getPropSafe(layer, ["ADBE Text Properties", "Text", "文本"]);
        return getPropSafe(textProps, ["ADBE Text Animators", "Text Animators", "动画器"]);
    }

    function getAnimatorProps(anim) {
        var g = getPropSafe(anim, ["ADBE Text Animator Properties", "Animator Properties", "属性"]);
        if (!g) {
            // 少数版本新建动画器时不自带属性组, 这里兜底尝试创建。
            try { g = anim.addProperty("ADBE Text Animator Properties"); } catch (e) {}
        }
        return g;
    }

    function getSelectorsGroup(anim) {
        var g = getPropSafe(anim, ["ADBE Text Selectors", "Selectors", "选择器"]);
        if (!g) {
            try { g = anim.addProperty("ADBE Text Selectors"); } catch (e) {}
        }
        return g;
    }

    function addTextAnimator(animators) {
        var cand = ["ADBE Text Animator", "Text Animator", "动画器"];
        for (var i = 0; i < cand.length; i++) {
            try {
                var a = animators.addProperty(cand[i]);
                if (a) { return a; }
            } catch (e) {}
        }
        return null;
    }

    function addRangeSelector(selectors) {
        var cand = ["ADBE Text Selector", "ADBE Text Range Selector", "Range Selector", "范围选择器"];
        for (var i = 0; i < cand.length; i++) {
            try {
                var s = selectors.addProperty(cand[i]);
                if (s) { return s; }
            } catch (e) {}
        }
        return null;
    }

    // 可传字符串或候选数组; 先试 addProperty, 再按显示名/匹配名找已有属性。
    function addAnimProperty(propsGroup, candidates) {
        if (!propsGroup) { return null; }
        var list = (typeof candidates === "string") ? [candidates] : candidates;
        var i;
        for (i = 0; i < list.length; i++) {
            try {
                var p = propsGroup.addProperty(list[i]);
                if (p) { return p; }
            } catch (e1) {}
        }
        for (i = 0; i < list.length; i++) {
            try {
                var q = propsGroup.property(list[i]);
                if (q) { return q; }
            } catch (e2) {}
        }
        return null;
    }

    function setSelectorSmoothnessZero(sel) {
        if (!sel) { return; }
        var adv = getPropSafe(sel, ["ADBE Text Range Advanced", "Advanced", "高级"]);
        if (!adv) { return; }
        var smooth = getPropSafe(adv, ["ADBE Text Selector Smoothness", "Smoothness", "平滑度"]);
        if (smooth) {
            try { smooth.setValue(0); } catch (e) {}
        }
    }

    // 逐字动画必须【只选中一个字】。百分比选区在 n 不能整除 100 时会按字符边界取整，
    // 把相邻字并进同一个动画器 —— 被并进来的字从第一个关键帧(0 秒)起就一直显示，
    // 隐藏阶段也不消失(真机 v0.11.8 现象: 有两个字一直显示)。
    // 索引单位(Units=Index, 0 基)下 Start=k / End=k+1 精确选中第 k+1 个可见字符：
    // 官方帮助说「依据=字符」会数空格, 但 AE 26 中文版真机实测(2026-11-25)：
    // 索引单位下空格【不占索引】—— 必须用【非空白字符序号】, 不能用原文下标,
    // 否则空格后第一个字得不到选区、从 0 秒起一直显示(v0.11.11 修复)。
    // ⚠️ 每个动画器都自带一个默认选区(默认百分比)，必须【逐个】切单位，不能只切第一个。
    // ⚠️ 切到索引后，Start/End 换成另一对属性 ADBE Text Index Start/End；
    //    再写百分比那对会报「属性或父级属性被隐藏」(真机 v0.11.9)。
    // 返回 true = 已切到索引单位；false = 该版本不支持(调用方退回百分比并写诊断)。
    function setSelectorUnits(sel, unitValue) {
        if (!sel) { return false; }
        var adv = getPropSafe(sel, ["ADBE Text Range Advanced", "Advanced", "高级"]);
        if (!adv) { return false; }
        var units = getPropSafe(adv, ["ADBE Text Range Units", "Units", "单位"]);
        if (!units) { return false; }
        try {
            units.setValue(unitValue);
            return true;
        } catch (eU) {}
        return false;
    }

    function setSelectorIndexMode(sel) {
        if (!sel) { return false; }
        if (!setSelectorUnits(sel, 2)) { return false; }
        // 个别版本可能切完单位才生成索引属性；取不到就切回百分比，绝不混用。
        if (!getPropSafe(sel, ["ADBE Text Index Start"])
            || !getPropSafe(sel, ["ADBE Text Index End"])) {
            setSelectorUnits(sel, 1);
            return false;
        }
        var adv = getPropSafe(sel, ["ADBE Text Range Advanced", "Advanced", "高级"]);
        var based = adv ? getPropSafe(adv, ["ADBE Text Range Type2", "Based On", "依据"]) : null;
        if (based) {
            try { based.setValue(1); } catch (eB) {}
        }
        return true;
    }

    function findSelectorStartEnd(sel, wantIndex) {
        var se = { start: null, end: null };
        if (!sel) { return se; }
        // 单位切换后只有一对 Start/End 是「活动」的，另一对是隐藏属性；
        // 两者显示名都叫 Start / End，必须按 matchName 精确取，不能用显示名兜底。
        if (wantIndex) {
            se.start = getPropSafe(sel, ["ADBE Text Index Start"]);
            se.end = getPropSafe(sel, ["ADBE Text Index End"]);
        } else {
            se.start = getPropSafe(sel, ["ADBE Text Percent Start", "Start", "开始"]);
            se.end = getPropSafe(sel, ["ADBE Text Percent End", "End", "结束"]);
        }
        return se;
    }

    function getMaskParade(layer) {
        return getPropSafe(layer, ["ADBE Mask Parade", "Masks", "蒙版"]);
    }

    // ---------- 清理本工具加的动画/蒙版 ----------
    function clearOurAnimation(layer) {
        var removedAnim = 0;
        var removedMask = 0;

        var animators = getAnimatorsGroup(layer);
        if (animators) {
            for (var i = animators.numProperties; i >= 1; i--) {
                try {
                    var a = animators.property(i);
                    if (a && isOurAnimatorName(a.name)) {
                        a.remove();
                        removedAnim++;
                    }
                } catch (e1) {}
            }
        }

        var parade = getMaskParade(layer);
        if (parade) {
            for (var j = parade.numProperties; j >= 1; j--) {
                try {
                    var m = parade.property(j);
                    if (m && isOurMaskName(m.name)) {
                        m.remove();
                        removedMask++;
                    }
                } catch (e2) {}
            }
        }
        return { anim: removedAnim, mask: removedMask };
    }

    // ---------- 读取文本层信息 ----------
    function getTextInfo(layer, compTime) {
        var st = getSourceTextProp(layer);
        if (!st) {
            diag("「" + layer.name + "」没有源文本属性, 跳过");
            return null;
        }
        var doc = null;
        try { doc = st.value; } catch (e0) {
            diag("「" + layer.name + "」读取源文本失败: " + e0);
            return null;
        }
        var text = "";
        try { text = String(doc.text); } catch (e1) {}
        var fontSize = 72;
        try { if (doc.fontSize > 0) { fontSize = doc.fontSize; } } catch (e2) {}

        // 段落文本(框文本)信息: AE 会把超出定界框的文字隐藏(只留溢出图标),
        // 应用前要检测并把框高收到刚好容纳全部文字, 否则尾部整行演不到。
        var boxText = false;
        try { boxText = !!doc.boxText; } catch (e2b) {}
        var boxW = 0;
        var boxH = 0;
        if (boxText) {
            try {
                var bsz = doc.boxTextSize;
                boxW = Number(bsz[0]) || 0;
                boxH = Number(bsz[1]) || 0;
            } catch (e2c) {}
        }
        var leading = 0;
        try { leading = Number(doc.leading) || 0; } catch (e2d) {}

        var rect = null;
        try { rect = layer.sourceRectAtTime(compTime, false); } catch (e3) { rect = null; }
        if (!rect || !(rect.width > 0)) {
            var w = estimateTextWidth(text, fontSize);
            rect = { left: -w / 2, top: -fontSize, width: w, height: fontSize * 1.2 };
            diag("「" + layer.name + "」测量文字宽度失败, 使用估算 " + Math.round(w) + "px");
        }
        return {
            text: text,
            doc: doc,
            fontSize: fontSize,
            leading: leading,
            boxText: boxText,
            boxW: boxW,
            boxH: boxH,
            // v0.11.8: 段落文本的窗口 = 段落框(由 fitParagraphBox 填),
            // 点文本保持 null -> 第二遍沿用文字外框。
            windowRect: null,
            windowName: MASK_WINDOW_NAME,
            rect: {
                left: Number(rect.left) || 0,
                top: Number(rect.top) || 0,
                width: Number(rect.width) || 0,
                height: Number(rect.height) || 0
            }
        };
    }

    // ---------- 段落文本溢出修复(v0.11.8: 单行化 + 原框作窗口) ----------
    // 官方依据(AE 24.6+ 的 TextDocument, ae-scripting.docsforadobe.dev):
    //   boxOverflow = true  => 有文字没能排进定界框, 这些字 AE 不会显示;
    //   boxTextSize = [宽, 高] 可读写; boxTextPos 是框左上角的层坐标(可读写);
    //   composedLineCount 只统计排进框里的行数; boxText 只读(脚本不能转点文本)。
    // 用户明确要求: 我给的文本框就是出现字的范围 —— 所以【不再把框拉高】,
    // 而是把排版框【单行化】: 高保持一行, 宽度加到能装下整句(倍增 + 二分);
    // 再把【原框(宽高都不动)】当作出现窗口, 文字在窗口里像终端一样从右往左流动。
    // 原框尺寸写进蒙版名("DT_窗口 595x49"), 重复应用时仍按原框当窗口。
    // 每次判定都重新取 st.value: 旧 TextDocument 是组合时快照, 改了不会重组。
    // 只写 boxTextSize / boxTextPos, 不改文字/字体/字号/图层位置。
    function restoreBoxPos(st, pos) {
        try {
            var d = st.value;
            var p = d.boxTextPos;
            if (p && Math.abs(Number(p[0]) - pos[0]) < 0.01
                  && Math.abs(Number(p[1]) - pos[1]) < 0.01) {
                return;
            }
            d.boxTextPos = [pos[0], pos[1]];
            st.setValue(d);
        } catch (eP) {}
    }

    function fitParagraphBox(layer, st, doc, compTime, prevWin) {
        var res = {
            checked: false, changed: false, heightOnly: false,
            boxW: 0, boxH: 0, winW: 0, winH: 0,
            textW: 0, textH: 0, newW: 0, newH: 0, overflow: null,
            tries: 0, lines: 0, lineH: 0,
            method: "", windowRect: null, windowName: MASK_WINDOW_NAME
        };
        var isBox = false;
        try { isBox = !!doc.boxText; } catch (e0) {}
        if (!isBox) { return res; }
        res.checked = true;

        var sz = null;
        try { sz = doc.boxTextSize; } catch (e1) {}
        if (!sz) {
            diag("「" + layer.name + "」读不到段落框尺寸, 跳过溢出检查");
            return res;
        }
        var w = Number(sz[0]) || 0;
        var h = Number(sz[1]) || 0;
        res.boxW = w;
        res.boxH = h;
        if (!(w > 0) || !(h > 0)) { return res; }

        var pos0 = null;
        try {
            var p0 = doc.boxTextPos;
            pos0 = [Number(p0[0]) || 0, Number(p0[1]) || 0];
        } catch (ePos) { pos0 = null; }

        // 窗口 = 用户原框: 上次应用写进蒙版名的尺寸优先(那时排版框已被加宽)。
        var winW = (prevWin && Number(prevWin.width) > 0) ? Number(prevWin.width) : w;
        var winH = (prevWin && Number(prevWin.height) > 0) ? Number(prevWin.height) : h;
        res.winW = winW;
        res.winH = winH;
        res.windowName = buildMaskName(winW, winH);
        if (pos0) {
            res.windowRect = { left: pos0[0], top: pos0[1], width: winW, height: winH };
        }

        // 一行所需高度: 优先行距, 没有行距按字号 × 1.2 估算。
        var lead = 0;
        var fs = 0;
        try { lead = Number(doc.leading) || 0; } catch (eLd) {}
        try { fs = Number(doc.fontSize) || 0; } catch (eFs) {}
        var lineH = Math.ceil(lead > 0 ? lead : (fs > 0 ? fs * 1.2 : h));
        if (!(lineH > 0)) { lineH = Math.round(h); }
        res.lineH = lineH;
        if (winH < lineH) {
            diag("「" + layer.name + "」⚠ 框高 " + Math.round(winH) + "px 小于一行(行距 "
                + lineH + "px), 文字上下会被窗口裁掉; 请把框拉高到至少 " + lineH + "px");
        }

        // 源文本有动画(关键帧/表达式)时不写 TextDocument: setValue 会覆盖动画。
        var animated = false;
        try { animated = (st.numKeys > 0) || st.expressionEnabled; } catch (e2) {}
        if (animated) {
            diag("「" + layer.name + "」源文本有动画, 跳过段落框单行化(文字可能仍被裁)");
            return res;
        }

        // 每次都重新取一份 TextDocument 再写: 避免复用旧对象在个别版本上写不进去。
        var setBox = function (ww, hh) {
            try {
                var d = st.value;
                d.boxTextSize = [Math.round(ww), Math.round(hh)];
                st.setValue(d);
                return true;
            } catch (eS) {
                diag("「" + layer.name + "」写段落框尺寸失败: " + errText(eS));
                return false;
            }
        };
        // boxOverflow 是组合状态: 必须在 setValue 之后重新取 st.value 再读。
        var readOverflow = function () {
            try {
                var d = st.value;
                var v = d.boxOverflow;
                if (v === true || v === false) { return v; }
                return null;
            } catch (eO) { return null; }
        };
        var restore = function (msg) {
            setBox(w, h);
            if (pos0) { restoreBoxPos(st, pos0); }
            if (msg) { diag("「" + layer.name + "」" + msg); }
        };
        var measure = function () {
            try {
                var r = layer.sourceRectAtTime(compTime, false);
                if (r) {
                    res.textW = Number(r.width) || 0;
                    res.textH = Number(r.height) || 0;
                }
            } catch (eM) {}
        };

        var ov = readOverflow();
        res.overflow = ov;
        if (ov === false) { return res; }    // 全部文字在框内: 不动框, 窗口=原框

        if (!pos0) {
            restore("读不到段落框位置(boxTextPos), 无法把原框当窗口, 已还原; 请重试");
            return res;
        }

        var layoutH = Math.max(Math.round(h), lineH);

        if (ov === true) {
            // 官方路线: 框高设成【一行高】, 此时 boxOverflow=false 等价于「整段一行」。
            res.method = "boxOverflow";
            if (!setBox(w, layoutH)) { restore("段落框改单行失败, 已还原"); return res; }
            if (readOverflow() === false) {
                // 原来只是框太矮(宽度够): 只把高度补到一行, 不加宽。
                restoreBoxPos(st, pos0);
                res.heightOnly = true;
                res.newW = w;
                res.newH = layoutH;
                res.changed = (Math.round(layoutH) !== Math.round(h));
                try { res.lines = Number(st.value.composedLineCount) || 0; } catch (eL1) {}
                measure();
                return res;
            }
            var maxW = Math.max(8192, Math.round(w * 32));
            var lo = w;          // 已知溢出
            var hi = 0;          // 已知不溢出
            var cur = w;
            while (res.tries < 18) {
                cur = Math.round(cur * 2);
                if (cur > maxW) { break; }
                res.tries++;
                if (!setBox(cur, layoutH)) { restore("段落框加宽失败, 已还原"); return res; }
                var o1 = readOverflow();
                if (o1 === null) { break; }
                if (o1 === false) { hi = cur; break; }
                lo = cur;
            }
            while (hi > 0 && hi - lo > 1) {
                var mid = Math.floor((lo + hi) / 2);
                res.tries++;
                if (!setBox(mid, layoutH)) { restore("段落框二分失败, 已还原"); return res; }
                if (readOverflow() === false) { hi = mid; } else { lo = mid; }
            }
            if (!(hi > 0)) {
                restore("⚠ 段落文本在 " + Math.round(maxW) + "px 宽内仍排不成一行(可能含强制换行), 已还原框");
                return res;
            }
            if (!setBox(hi, layoutH)) { restore("段落框写回失败, 已还原"); return res; }
            if (readOverflow() !== false) {
                restore("⚠ 段落框写回后仍有溢出, 已还原; 请手动调整定界框");
                return res;
            }
            restoreBoxPos(st, pos0);
            res.newW = hi;
            res.newH = layoutH;
            res.changed = (Math.round(hi) !== Math.round(w)) || (Math.round(layoutH) !== Math.round(h));
            try { res.lines = Number(st.value.composedLineCount) || 0; } catch (eL2) {}
            measure();
            return res;
        }

        // 旧版 AE 没有 boxOverflow: 撑高测文字范围(判是否有被裁的行),
        // 有溢出就先放到足够宽量单行宽度, 再收紧到刚好一行。
        res.method = "probe";
        var probeH = Math.max(2000, Math.round(h * 40));
        try {
            if (!setBox(w, probeH)) { restore("段落框撑高失败, 已还原"); return res; }
            var r2 = null;
            try { r2 = layer.sourceRectAtTime(compTime, false); } catch (eM2) { r2 = null; }
            var ph = r2 ? Number(r2.height) : 0;
            res.textH = ph;
            // 量到的高度≈撑高后的框高 => 这个版本返回的是框尺寸而不是文字范围, 无法判断
            if (!(ph > 0) || ph >= probeH - 2) {
                restore("撑高后测量仍等于框高, 无法判断是否溢出, 已还原");
                return res;
            }
            if (!isBoxOverflow(h, ph)) { restore(""); return res; }
            var bigW = Math.max(8192, Math.round(w * 16));
            if (!setBox(bigW, layoutH)) { restore("段落框加宽失败, 已还原"); return res; }
            var r3 = null;
            try { r3 = layer.sourceRectAtTime(compTime, false); } catch (eM3) { r3 = null; }
            var tw3 = r3 ? Number(r3.width) : 0;
            var th3 = r3 ? Number(r3.height) : 0;
            if (!(tw3 > 0) || !(th3 > 0) || th3 > layoutH + 2) {
                restore("⚠ 段落文本含强制换行, 无法排成一行, 已还原框; 请手动调整定界框");
                return res;
            }
            var oneW = Math.ceil(tw3) + 8;
            if (!setBox(oneW, layoutH)) { restore("段落框写回失败, 已还原"); return res; }
            restoreBoxPos(st, pos0);
            res.newW = oneW;
            res.newH = layoutH;
            res.changed = (Math.round(oneW) !== Math.round(w)) || (Math.round(layoutH) !== Math.round(h));
            measure();
        } catch (eAll) {
            restore("段落框溢出检查失败: " + errText(eAll));
        }
        return res;
    }

    // 读蒙版名里存的窗口尺寸(上次应用写进去的 "DT_窗口 595x49")。
    // 没有(首次应用/旧版蒙版)返回 null, 调用方按当前框当窗口。
    function readStoredWindow(layer) {
        try {
            var parade = layer.property("ADBE Mask Parade");
            if (!parade) { return null; }
            for (var i = 1; i <= parade.numProperties; i++) {
                var nm = "";
                try { nm = String(parade.property(i).name); } catch (eN) { continue; }
                if (!isOurMaskName(nm)) { continue; }
                var b = parseMaskNameBox(nm);
                if (b) { return b; }
            }
        } catch (e0) {}
        return null;
    }

    // ---------- 文本框蒙版 ----------
    // box 是【层空间】矩形, 与 sourceRectAtTime 同一坐标系, 直接写静态形状。
    // outward = true(逐字出现): 羽化向【框外】扩散, 框内始终完全清晰 ——
    //   逐字出现的窗口就是文本框, 向内羽化会把首尾的字吃掉(长文本尾部尤其明显)。
    // outward = false(横向滚动): 羽化向【框内】扩散, 框外完全不可见。
    function applyWindowMask(layer, box, feather, strength, outward, maskName) {
        var parade = getMaskParade(layer);
        if (!parade) {
            diag("「" + layer.name + "」找不到蒙版组, 跳过文本框");
            return false;
        }
        var mask = null;
        var cand = ["ADBE Mask Atom", "Mask", "蒙版"];
        for (var i = 0; i < cand.length; i++) {
            try {
                mask = parade.addProperty(cand[i]);
                if (mask) { break; }
            } catch (e) {}
        }
        if (!mask) {
            diag("「" + layer.name + "」创建蒙版失败, 跳过文本框");
            return false;
        }
        try { mask.name = maskName || MASK_WINDOW_NAME; } catch (eN) {}
        try { mask.maskMode = MaskMode.ADD; } catch (eM) { diag("设置蒙版模式失败: " + eM); }

        // 图层缩放: 羽化距离按缩放反算, 保证画面上的羽化宽度≈面板输入的像素值。
        var sc = getScaleXY(layer);
        var sx = sc.sx;
        var sy = sc.sy;
        // 横向羽化(层空间), 夹到框宽以内;
        // 向内: 路径各内缩半个羽化 -> 过渡区全部落在框内, 框外完全不可见;
        // 向外: 路径各外扩半个羽化 -> 框内完全清晰, 过渡区全部落在框外。
        var featherX = Math.max(0, Number(feather) || 0) / sx;
        var featherBox = outward ? computeFeatherOutsetBox(box, featherX)
                                 : computeFeatherInsetBox(box, featherX);

        var shape = getPropSafe(mask, ["ADBE Mask Shape", "Mask Path", "蒙版路径"]);
        if (!shape) {
            diag("「" + layer.name + "」找不到蒙版路径属性");
            try { mask.remove(); } catch (eR) {}
            return false;
        }
        try {
            var sh = new Shape();
            sh.vertices = buildMaskVertices(featherBox);
            sh.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
            sh.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
            sh.closed = true;
            shape.setValue(sh);
        } catch (eS) {
            diag("写入文本框形状失败: " + eS);
            try { mask.remove(); } catch (eR2) {}
            return false;
        }

        // 羽化距离: 只做左右羽化(横向窗口), 上下留硬边 ——
        // 文本框贴合文字后, 上下羽化会直接把文字上下缘吃淡。
        var fea = getPropSafe(mask, ["ADBE Mask Feather", "Mask Feather", "蒙版羽化"]);
        if (fea) {
            try {
                fea.setValue([featherX, 0]);
            } catch (eF) {
                try {
                    fea.setValue([featherX, Math.max(0, Number(feather) || 0) / sy]);
                } catch (eF2) { diag("设置蒙版羽化失败: " + eF2); }
            }
        }

        // 羽化强度 = 蒙版不透明度(0-100), 100 = 完全保留。
        var op = getPropSafe(mask, ["ADBE Mask Opacity", "Mask Opacity", "蒙版不透明度"]);
        if (op) {
            try { op.setValue(clampNum(strength, 0, 100)); } catch (eO) { diag("设置蒙版不透明度失败: " + eO); }
        } else {
            diag("「" + layer.name + "」找不到蒙版不透明度属性, 强度未生效");
        }
        diag("「" + layer.name + "」文本框(层空间): [" + Math.round(box.left) + "," + Math.round(box.top)
            + "] - [" + Math.round(box.right) + "," + Math.round(box.bottom)
            + "], 左右羽化(" + (outward ? "向外" : "向内") + ") " + feather + "px, 强度 "
            + Math.round(strength) + "%");
        return true;
    }

    // ---------- 横向滚动 ----------
    function applyScroll(layer, rect, box, params) {
        var animators = getAnimatorsGroup(layer);
        if (!animators) { throw new Error("无法取得「" + layer.name + "」的文本动画器组"); }

        var anim = addTextAnimator(animators);
        if (!anim) { throw new Error("创建滚动动画器失败: " + layer.name); }
        try { anim.name = ANIM_SCROLL_NAME; } catch (eN) {}

        var props = getAnimatorProps(anim);
        var selGroup = getSelectorsGroup(anim);
        var sel = null;
        if (selGroup) {
            if (selGroup.numProperties > 0) {
                try { sel = selGroup.property(1); } catch (eP) {}
            }
            if (!sel) { sel = addRangeSelector(selGroup); }
        }
        if (!props || !sel) {
            try { anim.remove(); } catch (eR) {}
            throw new Error("创建滚动选择器/属性组失败: " + layer.name);
        }
        setSelectorSmoothnessZero(sel);
        var se = findSelectorStartEnd(sel);
        if (se.start) { try { se.start.setValue(0); } catch (eS1) {} }
        if (se.end) { try { se.end.setValue(100); } catch (eS2) {} }

        // 官方 matchName 是 "ADBE Text Position 3D"; 不要先用 "ADBE Text Position"。
        var pos = addAnimProperty(props, [
            "ADBE Text Position 3D", "ADBE Text Position",
            "Text Position", "Position", "位置"
        ]);
        if (!pos) {
            try { anim.remove(); } catch (eR2) {}
            throw new Error("创建滚动位置属性失败: " + layer.name);
        }
        // 官方 matchName 是 "ADBE Text Position 3D", 正常就是三维;
        // 只有真的读到二维值(旧版兼容分支)才降级成二维返回值。
        var is3D = true;
        try { is3D = pos.value.length >= 3; } catch (eD) {}
        var expr = buildScrollExpression(rect.left, rect.width, box.left, box.right,
            params.duration, params.direction, is3D, params.curveIn, params.curveOut);
        pos.expression = expr;
        flog("滚动表达式(" + layer.name + "):\n" + expr);
        return true;
    }

    // ---------- 逐字出现(一整套) ----------
    // 每字不透明度动画器同时负责【逐字出现】与【隐藏阶段整行渐隐】,
    // 再加一个 DT_滚动 位置动画器负责左移; 位置表达式同时负责
    // 「打满窗口后整行左移」与「最后整行向左滑出窗口」。
    function applyTypeScroll(layer, info, rect, box, params) {
        // ⚠ 选区索引与时间轴必须用【非空白字符序号】:
        // AE 26 真机实测, 索引单位下空格不占索引 —— 若按原始下标排(空格被跳过),
        // 空格后第一个字的 AE 索引没有任何动画器覆盖 ⇒ 从 0 秒起一直显示,
        // 后续字也整体早一拍(v0.11.10 真机: 第一个「朵」常显)。
        var rawN = countChars(info.text);
        var visN = countVisibleChars(info.text);
        if (!(visN > 0)) { visN = rawN; }
        var timing = computeTypeScrollTiming(visN, params.appearDur, params.fade, params.hideDur);
        // 隐藏阶段的整行渐隐写进【每个字自己的】不透明度动画器:
        // 不能再给 DT_滚动 加一个覆盖 0-100% 选区的整体渐隐动画器 ——
        // 它的 100% 不透明度会覆盖每字动画器的不透明度, 让开头逐字出现消失
        // (真机 v0.11.2 / v0.11.3 复现)。每字动画器各管自己那个字, 互不覆盖,
        // 且所有字在同一时间区间一起渐隐, 视觉上仍是整行渐隐。
        var tr = applyTypewriter(layer, info, params, timing.step,
            layer.inPoint + timing.lastVisible, layer.inPoint + timing.endTime, visN);
        var animators = getAnimatorsGroup(layer);
        if (!animators) { throw new Error("无法取得「" + layer.name + "」的文本动画器组"); }

        var anim = addTextAnimator(animators);
        if (!anim) { throw new Error("创建左移动画器失败: " + layer.name); }
        try { anim.name = ANIM_SCROLL_NAME; } catch (eN) {}
        var props = getAnimatorProps(anim);
        var selGroup = getSelectorsGroup(anim);
        var sel = null;
        if (selGroup) {
            if (selGroup.numProperties > 0) {
                try { sel = selGroup.property(1); } catch (eP) {}
            }
            if (!sel) { sel = addRangeSelector(selGroup); }
        }
        if (!props || !sel) {
            try { anim.remove(); } catch (eR) {}
            throw new Error("创建左移选择器/属性组失败: " + layer.name);
        }
        setSelectorSmoothnessZero(sel);
        var se = findSelectorStartEnd(sel);
        if (se.start) { try { se.start.setValue(0); } catch (eS1) {} }
        if (se.end) { try { se.end.setValue(100); } catch (eS2) {} }

        var pos = addAnimProperty(props, [
            "ADBE Text Position 3D", "ADBE Text Position",
            "Text Position", "Position", "位置"
        ]);
        if (!pos) {
            try { anim.remove(); } catch (eR2) {}
            throw new Error("创建左移位置属性失败: " + layer.name);
        }
        var is3D = true;
        try { is3D = pos.value.length >= 3; } catch (eD) {}
        // 隐藏位移按图层缩放反算到层空间, 保证画面上的像素≈面板输入值。
        // 羽化不参与表达式: 逐字出现的蒙版羽化在框外(见 applyWindowMask 的 outward),
        // 框内的字始终清晰, 不需要再为羽化右移文字。
        var scT = getScaleXY(layer);
        var hideX = Math.max(0, Number(params.hidePx) || 0) / scT.sx;
        var expr = buildTypeScrollExpression(visN, rect.left, rect.width,
            box.left, box.right, params.appearDur, params.fade, params.hideDur, is3D,
            hideX);
        pos.expression = expr;
        flog("逐字出现表达式(" + layer.name + "):\n" + expr);

        // 隐藏阶段的整体渐隐不在这里做: 已写进每字不透明度动画器(applyTypewriter),
        // 避免覆盖型动画器把逐字出现顶掉; DT_滚动 只负责位置。
        return { count: tr.count + 1, endTime: layer.inPoint + timing.endTime };
    }

    // ---------- 逐字出现 ----------
    // interval: 每字出现间隔(由「出现总时长」算出的 step)。
    // hideStart / hideEnd: 隐藏阶段(绝对时间); 传入时每个字的不透明度
    //   在 hideStart 保持 100、到 hideEnd 渐隐到 0, 实现「整行一起渐隐」。
    function applyTypewriter(layer, info, params, intervalOverride, hideStart, hideEnd, visibleCount) {
        var animators = getAnimatorsGroup(layer);
        if (!animators) { throw new Error("无法取得「" + layer.name + "」的文本动画器组"); }

        var chars = splitChars(info.text);
        var n = chars.length;
        if (!n) { return { count: 0, endTime: layer.inPoint }; }
        if (n > MAX_TYPE_CHARS) {
            throw new Error("「" + layer.name + "」有 " + n + " 个字符，超过单层上限 "
                + MAX_TYPE_CHARS + "；请改用横向滚动。");
        }

        // 选区索引 / 关键帧节奏一律按【非空白字符序号】排(原因见 applyTypeScroll):
        // 空格不建动画器、也不占 AE 的索引; 用原始下标会让空格后第一个字失去覆盖。
        var visN = Number(visibleCount);
        if (!(visN > 0)) { visN = countVisibleChars(info.text); }
        if (!(visN > 0)) { visN = n; }

        var interval = Number(intervalOverride);
        if (!(interval >= 0)) { interval = 0; }
        var fs = 1;
        try { fs = 1 / Number(layer.containingComp.frameRate); } catch (eF) { fs = 1 / 30; }
        var fadeDur = Math.max(params.fade, fs);
        var hs = Number(hideStart);
        var he = Number(hideEnd);
        var hasHide = !isNaN(hs) && !isNaN(he) && (he > hs);
        var made = 0;
        var indexWarned = false;   // 索引单位不可用时只提示一次
        var firstOp = null;
        var lastOp = null;

        var selIdx = -1;           // 非空白字符序号(0 基) = AE 索引单位下的字符索引
        for (var i = 0; i < n; i++) {
            if (/^\s$/.test(chars[i])) { continue; }
            selIdx++;
            var t0 = layer.inPoint + selIdx * interval;
            var t1 = t0 + fadeDur;

            var anim = addTextAnimator(animators);
            if (!anim) { diag("第 " + (selIdx + 1) + " 字: 动画器创建失败"); continue; }
            try { anim.name = ANIM_FADE_PREFIX + pad2(selIdx + 1); } catch (eN) {}

            var props = getAnimatorProps(anim);
            var selGroup = getSelectorsGroup(anim);
            // AE 新建的动画器可能【自带一个默认选区(0-100%)】:
            // 必须复用它, 否则再 add 一个只会多出第二个选区, 两个选区并集覆盖全部字符,
            // 每字独立的关键帧就退化成整行一起渐变(逐字出现效果消失)。
            var sel = null;
            if (selGroup) {
                if (selGroup.numProperties > 0) {
                    try { sel = selGroup.property(1); } catch (eP) {}
                }
                if (!sel) { sel = addRangeSelector(selGroup); }
            }
            if (!props || !sel) {
                try { anim.remove(); } catch (eR) {}
                diag("第 " + (selIdx + 1) + " 字: 选择器/属性组创建失败");
                continue;
            }
            setSelectorSmoothnessZero(sel);
            // 每个动画器都有自己的默认选区(默认百分比)，必须逐个切索引单位；
            // 切完用 ADBE Text Index Start/End 写值(百分比那对此时是隐藏属性)。
            var idxMode = setSelectorIndexMode(sel);
            if (!idxMode && !indexWarned) {
                indexWarned = true;
                diag("「" + layer.name + "」选区无法切换索引单位, 退回百分比(可能出现相邻字同时显示)");
            }

            var se = findSelectorStartEnd(sel, idxMode);
            if (!se.start || !se.end) {
                try { anim.remove(); } catch (eR2) {}
                diag("第 " + (selIdx + 1) + " 字: 找不到开始/结束属性");
                continue;
            }
            try {
                if (idxMode) {
                    se.start.setValue(selIdx);
                    se.end.setValue(selIdx + 1);
                } else {
                    se.start.setValue((selIdx / visN) * 100);
                    se.end.setValue(((selIdx + 1) / visN) * 100);
                }
            } catch (eSel) {
                try { anim.remove(); } catch (eR3) {}
                diag("第 " + (selIdx + 1) + " 字: 设置选区失败: " + errText(eSel));
                continue;
            }

            var op = addAnimProperty(props, [
                "ADBE Text Opacity", "ADBE Text Opacity Percent",
                "Text Opacity", "Opacity", "不透明度"
            ]);
            if (!op) {
                try { anim.remove(); } catch (eR4) {}
                diag("第 " + (selIdx + 1) + " 字: 不透明度属性创建失败");
                continue;
            }
            try {
                op.setValueAtTime(t0, 0);
                op.setValueAtTime(t1, 100);
                // 隐藏阶段整行渐隐: 每个字都在同一区间 100 -> 0, 视觉上整行一起渐隐。
                // 这里【不能】改用覆盖 0-100% 选区的整体渐隐动画器: 它会把每字动画器
                // 的不透明度顶掉, 开头逐字出现失效(真机 v0.11.2/v0.11.3 复现)。
                if (hasHide) {
                    op.setValueAtTime(hideStart, 100);
                    op.setValueAtTime(hideEnd, 0);
                }
                for (var k = 1; k <= op.numKeys; k++) {
                    op.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR,
                        KeyframeInterpolationType.LINEAR);
                }
            } catch (eK) {
                // 兜底: 至少把最后一个关键帧写回 100, 避免字被留在全透明状态
                try { op.setValueAtTime(t1, 100); } catch (eK2) {}
                diag("第 " + (selIdx + 1) + " 字: 关键帧写入失败: " + errText(eK));
            }
            if (!firstOp) { firstOp = op; }
            lastOp = op;
            made++;
        }

        // 关键帧核对: 读回真实落点。万一宿主对关键帧时间做了换算
        // (时间拉伸 / 时间重映射 / 关键帧对齐帧), 这里能直接看出来。
        if (lastOp) {
            try {
                var f0 = -1;
                var kt1 = -1;
                var ktN = -1;
                if (firstOp && firstOp.numKeys > 0) { f0 = firstOp.keyTime(1); }
                if (lastOp.numKeys > 0) {
                    kt1 = lastOp.keyTime(1);
                    ktN = lastOp.keyTime(lastOp.numKeys);
                }
                var doneAt = layer.inPoint + (visN - 1) * interval + fadeDur;
                var expectEnd = hasHide ? hideEnd : doneAt;
                var tol = fs * 0.5;
                var warn = (ktN >= 0 && Math.abs(ktN - expectEnd) > tol) ? "⚠ " : "";
                diag(warn + "关键帧核对: 首字起 " + (f0 >= 0 ? f0.toFixed(2) : "?")
                    + "s / 末字 " + (kt1 >= 0 ? kt1.toFixed(2) : "?")
                    + "s → " + (ktN >= 0 ? ktN.toFixed(2) : "?")
                    + "s (期望 " + expectEnd.toFixed(2) + "s, " + lastOp.numKeys + " 个关键帧)");
            } catch (eKT) {}
        }
        return { count: made, endTime: layer.inPoint + (visN - 1) * interval + fadeDur };
    }

    function extendOutPoint(layer, neededEnd, comp) {
        if (!(neededEnd > layer.outPoint)) { return; }
        try {
            layer.outPoint = neededEnd;
            diag("「" + layer.name + "」出点延长到 " + neededEnd.toFixed(2) + "s");
        } catch (e) {
            diag("延长出点失败: " + e);
        }
        if (neededEnd > comp.duration) {
            diag("⚠ 动画结束 " + neededEnd.toFixed(2) + "s 超出合成时长 "
                + comp.duration.toFixed(2) + "s");
        }
    }

    // ============================================================
    // 五、UI 尺寸工具
    // ============================================================
    var UI_W = 430;
    var BOX_W = 386;
    var LABEL_W = 64;
    var NUM_W = 74;

    // 三处都写: preferredSize / minimumSize / maximumSize —— 少一处 AE 就不认。
    // 高度一律传 -1(自适应), 绝不读回旧高度 —— 刚建控件时它可能是 0。
    function pinW(ctrl, w) {
        if (!ctrl || !w) { return; }
        try { ctrl.preferredSize = [w, -1]; } catch (e1) {}
        try { ctrl.minimumSize = [w, 0]; } catch (e2) {}
        try { ctrl.maximumSize = [w, 10000]; } catch (e3) {}
    }

    var LINE_H = 17;

    // 顺序硬约束: 先 pinW 钉宽度, 再单独钉高度 —— 反过来宽度会被静默覆盖。
    function fixedBox(box, w, h) {
        if (!box) { return; }
        pinW(box, w);
        try { box.preferredSize = [w, h]; } catch (e1) {}
        try { box.minimumSize = [w, h]; } catch (e2) {}
        try { box.maximumSize = [w, h]; } catch (e3) {}
    }

    // 多行只读说明文字。用 statictext 而不是 edittext:
    // edittext 在 AE 里是白底, 内容超出还会带滚动条(用户反馈「很多白色的滑动条」);
    // 说明文字只需要展示, 用静态文本更轻, 也不会出现输入框外观。
    // 文本按约 28 个汉字一行手工换行, 避免固定宽度下被裁掉。
    function addNote(parent, w, text) {
        var box = parent.add("statictext", undefined, text || "");
        try { box.alignment = ["left", "top"]; } catch (eA) {}
        pinW(box, w);
        return box;
    }

    // 多行调试输出框(可滚动, 可选中复制)。
    function addTextBox(parent, w, rows, text) {
        var box;
        try {
            box = parent.add("edittext", undefined, text || "",
                { multiline: true, scrolling: true });
        } catch (eScroll) {
            box = parent.add("edittext", undefined, text || "", { multiline: true });
        }
        fixedBox(box, w, Math.round(rows * LINE_H));
        return box;
    }

    function addLabel(parent, text, w) {
        var t = parent.add("statictext", undefined, text);
        pinW(t, w);
        return t;
    }

    function addNum(parent, value, w) {
        var e = parent.add("edittext", undefined, String(value));
        try { e.characters = 7; } catch (eC) {}
        pinW(e, w || NUM_W);
        return e;
    }

    function addDrop(parent, items, selected, w) {
        var d = parent.add("dropdownlist", undefined, items);
        if (selected !== null && selected !== undefined) {
            try { d.selection = selected; } catch (eS) {}
        }
        pinW(d, w);
        return d;
    }

    function newSection(parent, title) {
        var p = parent.add("panel", undefined, title);
        p.orientation = "column";
        p.alignChildren = ["fill", "top"];
        p.margins = 10;
        p.spacing = 6;
        return p;
    }

    // ============================================================
    // 六、UI 层
    // ============================================================
    var statusText = null;
    var debugBox = null;
    var rbScroll = null;                   // 方式单选: 横向滚动
    var rbType = null;                     // 方式单选: 逐字出现
    var grpScroll = null;                  // 横向滚动参数组(选中滚动时显示)
    var grpType = null;                    // 逐字出现参数组(选中逐字时显示)
    var ddlDir = null;
    var ddlCurveIn = null;
    var ddlCurveOut = null;
    var bxDur = null;
    var bxFade = null;
    var bxFeather = null;
    var bxStrength = null;
    var bxPadL = null;
    var bxPadR = null;
    var bxPadT = null;
    var bxPadB = null;
    var bxAppear = null;
    var bxHide = null;
    var bxHidePx = null;
    var btnApply = null;
    var btnRemove = null;
    var btnReset = null;

    var DEF = {
        mode: MODE_SCROLL,
        dir: DIR_RTL,
        curveIn: CURVE_LINEAR,
        curveOut: CURVE_LINEAR,
        duration: "3.0",
        fade: "0.12",
        feather: "25",
        strength: "100",
        padL: "0",
        padR: "0",
        padT: "0",
        padB: "0",
        appearDur: "2.0",
        hideDur: "0.8",
        hidePx: "100"
    };

    function buildControls(p) {
        // 顶部: 标题 + 版本
        var head = p.add("group");
        head.orientation = "row";
        head.alignChildren = ["left", "center"];
        head.alignment = ["fill", "top"];
        var title = head.add("statictext", undefined, TOOL_TITLE);
        pinW(title, 220);
        var ver = head.add("statictext", undefined, "v" + VER);
        try { ver.alignment = ["right", "center"]; } catch (eV) {}
        pinW(ver, 80);

        // 主按钮固定在顶部
        var mainRow = p.add("group");
        mainRow.orientation = "row";
        mainRow.alignChildren = ["left", "center"];
        mainRow.alignment = ["fill", "top"];
        mainRow.spacing = 6;
        btnApply = mainRow.add("button", undefined, "应用动画");
        try { btnApply.preferredSize = [150, 28]; } catch (eB) {}
        btnRemove = mainRow.add("button", undefined, "移除动画");
        try { btnRemove.preferredSize = [108, 28]; } catch (eB2) {}
        btnReset = mainRow.add("button", undefined, "重置参数");
        try { btnReset.preferredSize = [108, 28]; } catch (eB3) {}

        statusText = p.add("statictext", undefined,
            "就绪 · v" + VER + " — 选中文本图层后点「应用动画」。");
        pinW(statusText, BOX_W);
        p.statusText = statusText;

        // ---- 动画 ----
        var secAnim = newSection(p, "动画");

        // 两个模式是【二选一】: 不是多选, 也没有下拉。
        // 选中哪个, 就只显示并使用它那一套参数。
        var rowMode = secAnim.add("group");
        rowMode.orientation = "row";
        rowMode.alignChildren = ["left", "center"];
        rowMode.spacing = 14;
        addLabel(rowMode, "方式", 36);
        rbScroll = rowMode.add("radiobutton", undefined, "横向滚动");
        rbType = rowMode.add("radiobutton", undefined, "逐字出现");
        rbScroll.value = (DEF.mode === MODE_SCROLL);
        rbType.value = (DEF.mode === MODE_TYPE);

        // ---- 横向滚动参数组 ----
        grpScroll = secAnim.add("panel", undefined, "横向滚动参数");
        grpScroll.orientation = "column";
        grpScroll.alignChildren = ["fill", "top"];
        grpScroll.margins = 8;
        grpScroll.spacing = 6;

        var row1 = grpScroll.add("group");
        row1.orientation = "row";
        row1.alignChildren = ["left", "center"];
        row1.spacing = 6;
        addLabel(row1, "方向", 36);
        ddlDir = addDrop(row1, ["从右往左", "从左往右"], DEF.dir, 104);

        var row2 = grpScroll.add("group");
        row2.orientation = "row";
        row2.alignChildren = ["left", "center"];
        row2.spacing = 6;
        addLabel(row2, "时长(秒)", LABEL_W);
        bxDur = addNum(row2, DEF.duration);

        // 动态曲线: 只影响横向滚动的速度分布, 起止点不变。
        var rowC = grpScroll.add("group");
        rowC.orientation = "row";
        rowC.alignChildren = ["left", "center"];
        rowC.spacing = 6;
        addLabel(rowC, "开头曲线", 52);
        ddlCurveIn = addDrop(rowC, ["匀速起步", "慢起加速", "快起减速"], DEF.curveIn, 104);
        addLabel(rowC, "结束曲线", 52);
        ddlCurveOut = addDrop(rowC, ["匀速收尾", "减速慢收", "加速快收"], DEF.curveOut, 104);

        // ---- 逐字出现参数组 ----
        grpType = secAnim.add("panel", undefined, "逐字出现参数");
        grpType.orientation = "column";
        grpType.alignChildren = ["fill", "top"];
        grpType.margins = 8;
        grpType.spacing = 6;

        var rowW = grpType.add("group");
        rowW.orientation = "row";
        rowW.alignChildren = ["left", "center"];
        rowW.spacing = 6;
        addLabel(rowW, "渐隐(秒)", 48);
        bxFade = addNum(rowW, DEF.fade, 56);
        addLabel(rowW, "出现(秒)", 48);
        bxAppear = addNum(rowW, DEF.appearDur, 56);

        var rowH = grpType.add("group");
        rowH.orientation = "row";
        rowH.alignChildren = ["left", "center"];
        rowH.spacing = 6;
        addLabel(rowH, "隐藏(秒)", 48);
        bxHide = addNum(rowH, DEF.hideDur, 56);
        addLabel(rowH, "隐藏像素", 60);
        bxHidePx = addNum(rowH, DEF.hidePx, 56);

        var hint = addNote(secAnim, BOX_W - 20,
            "动画从图层入点开始；文字/字体/字号/位置都不改。\n"
            + "曲线组合：慢起加速+减速慢收 = 淡入淡出；\n"
            + "快起减速+减速慢收 = 前面快后面慢；\n"
            + "慢起加速+加速快收 = 前面慢后面快。\n"
            + "逐字出现是一整套：出现(秒) 管整句打完，\n"
            + "隐藏(秒) 管滑出时间，隐藏像素 管这段时间向左走多远；\n"
            + "羽化是内向的，出现的字会自动避开羽化边，不发虚。");

        // ---- 出现窗口(段落文本=你给的段落框 / 点文本=文字外框) ----
        var secBox = newSection(p, "出现窗口（段落框/文字框）");
        var boxTip = addNote(secBox, BOX_W - 20,
            "窗口：段落文本=你给的段落框，点文本=文字外框。\n"
            + "边距：0=紧贴窗口，正数外扩，负数内收。\n"
            + "段落框溢出时排版框会自动单行化(让你给的原框当窗口)。\n"
            + "逐字出现：在框内从右往左流动，打满后整行左移。");

        var rowL = secBox.add("group");
        rowL.orientation = "row";
        rowL.alignChildren = ["left", "center"];
        rowL.spacing = 6;
        addLabel(rowL, "左边距", 40);
        bxPadL = addNum(rowL, DEF.padL, 60);
        addLabel(rowL, "右边距", 40);
        bxPadR = addNum(rowL, DEF.padR, 60);
        addLabel(rowL, "上边距", 40);
        bxPadT = addNum(rowL, DEF.padT, 60);

        var rowR = secBox.add("group");
        rowR.orientation = "row";
        rowR.alignChildren = ["left", "center"];
        rowR.spacing = 6;
        addLabel(rowR, "下边距", 40);
        bxPadB = addNum(rowR, DEF.padB, 60);
        addLabel(rowR, "羽化(px)", 52);
        bxFeather = addNum(rowR, DEF.feather, 60);
        addLabel(rowR, "强度(%)", 52);
        bxStrength = addNum(rowR, DEF.strength, 60);

        // ---- 输出与调试 ----
        var secOut = newSection(p, "输出与调试");
        addNote(secOut, BOX_W - 20, "日志：" + truncateStr(gLogPath || "(不可写)", 46));

        debugBox = addTextBox(secOut, BOX_W - 20, 10, "");
        p.debugBox = debugBox;

        var logRow = secOut.add("group");
        logRow.orientation = "row";
        logRow.alignChildren = ["left", "center"];
        logRow.spacing = 4;
        var btnShowLog = logRow.add("button", undefined, "显示日志");
        try { btnShowLog.preferredSize = [88, 24]; } catch (eL1) {}
        var btnCopyDiag = logRow.add("button", undefined, "复制日志");
        try { btnCopyDiag.preferredSize = [88, 24]; } catch (eL2) {}
        var btnOpenLog = logRow.add("button", undefined, "打开日志");
        try { btnOpenLog.preferredSize = [88, 24]; } catch (eL3) {}
        var btnDiagnose = logRow.add("button", undefined, "诊断");
        try { btnDiagnose.preferredSize = [70, 24]; } catch (eL4) {}

        // ---- 事件(全部经 safeRun) ----
        btnApply.onClick = safeRun("应用动画", doApply);
        btnRemove.onClick = safeRun("移除动画", doRemove);
        btnReset.onClick = safeRun("重置参数", function () {
            applyDefaults();
            setStatus(pal, "参数已重置。", C_OK);
        });
        rbScroll.onClick = safeRun("切换动画方式", updateModeUI);
        rbType.onClick = safeRun("切换动画方式", updateModeUI);

        btnShowLog.onClick = safeRun("显示完整日志", function () {
            gDiag.length = 0;
            var lines = gLogLines.join("\n").split("\n");
            for (var i = 0; i < lines.length; i++) { gDiag.push(lines[i]); }
            flushDiag(pal);
            setStatus(pal, "完整日志已显示在下方。", C_OK);
        });
        btnCopyDiag.onClick = safeRun("复制调试输出", function () {
            copyBoxToClipboard(debugBox);
            setStatus(pal, "已尝试复制调试输出。", C_OK);
        });
        btnOpenLog.onClick = safeRun("打开日志", function () {
            var f = new File(gLogPath);
            if (f.exists) { f.execute(); } else { diag("日志文件不存在: " + gLogPath); }
        });
        btnDiagnose.onClick = safeRun("诊断", doDiagnose);

        updateModeUI();
    }

    function buildErrorUI() {
        flog("进入兜底界面");
        if (!pal) {
            try {
                alert(TOOL_TITLE + " 界面构建失败:\n" + gUIError + "\n\n日志:\n" + gLogPath);
            } catch (e0) {}
            return;
        }
        // 构建到一半失败会留下半成品控件, 先清空再摆兜底界面。
        try {
            while (pal.children && pal.children.length > 0) {
                pal.remove(pal.children[0]);
            }
        } catch (eC) {}
        try {
            addNote(pal, BOX_W,
                "⚠ 界面构建失败，请复制下方日志发给开发者。\n"
                + "日志：" + truncateStr(gLogPath, 52));
            var box = addTextBox(pal, BOX_W, 11, gLogLines.join("\n"));
            pal.debugBox = box;
        } catch (e1) {}

        var row = null;
        try { row = pal.add("group"); } catch (e2) {}
        if (row) {
            var bCopy = row.add("button", undefined, "复制日志");
            bCopy.onClick = safeRun("复制日志", function () {
                copyBoxToClipboard(pal.debugBox);
            });
            var bOpen = row.add("button", undefined, "打开日志");
            bOpen.onClick = safeRun("打开日志", function () {
                var f = new File(gLogPath);
                if (f.exists) { f.execute(); }
            });
        }
        try { alert(TOOL_TITLE + " 界面构建失败:\n" + gUIError + "\n\n日志:\n" + gLogPath); } catch (e3) {}
    }

    function buildUI() {
        pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", TOOL_TITLE, undefined, { resizeable: true });
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 8;
        pal.margins = 12;
        buildControls(pal);
        // AE 会记住上次的停靠尺寸; 面板被缩得太窄时所有行都会被裁掉(日志里 95x72),
        // 用户会以为「参数无法设置」。这里声明一个最小尺寸, 让面板至少能完整显示一行控件。
        try { pal.minimumSize = [BOX_W + 24, 300]; } catch (eMin) {}
    }

    // ============================================================
    // 七、主逻辑
    // ============================================================
    function readNum(box, def) {
        if (!box) { return String(def); }
        var s = trimStr(box.text);
        return s ? s : String(def);
    }

    // 方式只有一个真相: 两个互斥单选。rbType 选中 = 逐字出现, 否则横向滚动。
    function getMode() {
        var m = DEF.mode;
        try { if (rbType && rbType.value) { m = MODE_TYPE; } } catch (eM) {}
        return normalizeMode(m);
    }

    function readParams() {
        var mode = getMode();
        var dir = ddlDir && ddlDir.selection ? ddlDir.selection.index : DEF.dir;
        var curveIn = ddlCurveIn && ddlCurveIn.selection ? ddlCurveIn.selection.index : DEF.curveIn;
        var curveOut = ddlCurveOut && ddlCurveOut.selection ? ddlCurveOut.selection.index : DEF.curveOut;
        var duration = clampNum(readNum(bxDur, DEF.duration), 0.1, 120);
        var fade = clampNum(readNum(bxFade, DEF.fade), 0.01, 5);
        var feather = clampNum(readNum(bxFeather, DEF.feather), 0, 2000);
        var strength = clampNum(readNum(bxStrength, DEF.strength), 0, 100);
        var padL = clampNum(readNum(bxPadL, DEF.padL), -10000, 10000);
        var padR = clampNum(readNum(bxPadR, DEF.padR), -10000, 10000);
        var padT = clampNum(readNum(bxPadT, DEF.padT), -10000, 10000);
        var padB = clampNum(readNum(bxPadB, DEF.padB), -10000, 10000);
        var appearDur = clampNum(readNum(bxAppear, DEF.appearDur), 0.1, 120);
        var hideDur = clampNum(readNum(bxHide, DEF.hideDur), 0.05, 120);
        var hidePx = clampNum(readNum(bxHidePx, DEF.hidePx), 0, 100000);
        return {
            mode: normalizeMode(mode),
            direction: normalizeDirection(dir),
            curveIn: normalizeCurve(curveIn),
            curveOut: normalizeCurve(curveOut),
            duration: duration,
            fade: fade,
            feather: feather,
            strength: strength,
            padL: padL,
            padR: padR,
            padT: padT,
            padB: padB,
            appearDur: appearDur,
            hideDur: hideDur,
            hidePx: hidePx
        };
    }

    function updateModeUI() {
        var isScroll = (getMode() === MODE_SCROLL);
        // 选中哪个模式, 就只显示哪一套参数; 隐藏的那套不占版面, 也不参与阅读。
        if (grpScroll) { grpScroll.visible = isScroll; }
        if (grpType) { grpType.visible = !isScroll; }
        // 显隐后必须重新排版, 否则 AE 里会留下空白或控件重叠。
        try { if (pal && pal.layout) { pal.layout.layout(true); } } catch (eL) {}
    }

    function applyDefaults() {
        if (rbScroll) { rbScroll.value = (DEF.mode === MODE_SCROLL); }
        if (rbType) { rbType.value = (DEF.mode === MODE_TYPE); }
        if (ddlDir) { ddlDir.selection = DEF.dir; }
        if (ddlCurveIn) { ddlCurveIn.selection = DEF.curveIn; }
        if (ddlCurveOut) { ddlCurveOut.selection = DEF.curveOut; }
        if (bxDur) { bxDur.text = DEF.duration; }
        if (bxFade) { bxFade.text = DEF.fade; }
        if (bxFeather) { bxFeather.text = DEF.feather; }
        if (bxStrength) { bxStrength.text = DEF.strength; }
        if (bxPadL) { bxPadL.text = DEF.padL; }
        if (bxPadR) { bxPadR.text = DEF.padR; }
        if (bxPadT) { bxPadT.text = DEF.padT; }
        if (bxPadB) { bxPadB.text = DEF.padB; }
        if (bxAppear) { bxAppear.text = DEF.appearDur; }
        if (bxHide) { bxHide.text = DEF.hideDur; }
        if (bxHidePx) { bxHidePx.text = DEF.hidePx; }
        updateModeUI();
    }

    function doApply() {
        var comp = getComp();
        if (!comp) {
            needCompAlert();
            setStatus(pal, "⚠ 没有活动合成：请先在时间轴激活一个合成。", C_WARN);
            return;
        }
        var layers = getSelectedTextLayers(comp);
        if (!layers.length) {
            try {
                alert("请先选中至少一个文本图层。\n\n"
                    + "做法：在时间轴里点选文本层（可按住 Shift/Ctrl 多选），再点「应用动画」。");
            } catch (e0) {}
            setStatus(pal, "⚠ 没有选中文本图层。", C_WARN);
            return;
        }
        if (layers.length > MAX_TEXT_LAYERS) {
            try {
                alert("一次最多处理 " + MAX_TEXT_LAYERS + " 个文本层，当前选中 "
                    + layers.length + " 个。");
            } catch (e1) {}
            return;
        }

        var params = readParams();
        var isType = (params.mode === MODE_TYPE);
        var isScroll = (params.mode === MODE_SCROLL);

        if (isType) {
            // 上限检查只读文本, 不测量、不改图层。
            var totalChars = 0;
            for (var c = 0; c < layers.length; c++) {
                var tx = getLayerText(layers[c]);
                if (tx) { totalChars += countChars(tx); }
            }
            if (totalChars > MAX_TOTAL_TYPE_CHARS) {
                try {
                    alert("逐字模式一次最多 " + MAX_TOTAL_TYPE_CHARS
                        + " 个字符，当前选中约 " + totalChars + " 个。\n"
                        + "请减少图层，或改用「横向滚动」。");
                } catch (e2) {}
                return;
            }
        }

        var touched = [];
        var applied = 0;
        var animTotal = 0;
        var maxEnd = 0;

        diag("---- 应用开始 v" + VER + " ----");
        diag("合成: " + comp.name + " " + comp.width + "x" + comp.height);
        diag("参数: " + modeText(params.mode)
            + " / 渐隐 " + params.fade + "s / 羽化 " + params.feather + "px"
            + " / 强度 " + params.strength + "%");
        if (isScroll) {
            diag("横向滚动: 方向 " + directionText(params.direction)
                + " / 开头曲线 " + curveStartText(params.curveIn)
                + " / 结束曲线 " + curveEndText(params.curveOut)
                + " / 时长 " + params.duration + "s");
        }
        if (isType) {
            diag("逐字出现: 出现 " + params.appearDur + "s(整句打完)"
                + " / 隐藏 " + params.hideDur + "s(整行渐隐+左移)"
                + " / 隐藏像素 " + params.hidePx + "px");
        }
        diag("文本框边距(相对文字外框): 左 " + params.padL + " / 右 " + params.padR
            + " / 上 " + params.padT + " / 下 " + params.padB
            + " px（0=紧贴文字, 正数外扩, 负数内收）");
        diag("选中文本层: " + layers.length + " 个");

        setStatus(pal, "正在应用…", C_OK);
        app.beginUndoGroup(TOOL_TITLE + ": 应用动画");
        try {
            // 第一遍: 先清掉本工具旧动画, 再测量文字范围。
            // 否则旧滚动表达式的位移会被 sourceRectAtTime 算进去, 起止点会偏。
            var items = [];
            for (var i = 0; i < layers.length; i++) {
                var L0 = layers[i];
                if (L0.locked) {
                    diag("「" + L0.name + "」已锁定, 跳过");
                    continue;
                }
                var tx0 = getLayerText(L0);
                if (tx0 === null) {
                    diag("「" + L0.name + "」没有源文本属性, 跳过");
                    continue;
                }
                if (!tx0) {
                    diag("「" + L0.name + "」文本为空, 跳过");
                    continue;
                }
                // v0.11.8: 先读上次存进蒙版名的【用户原框】, 再清理旧动画/旧蒙版。
                var storedWin = readStoredWindow(L0);
                var old = clearOurAnimation(L0);
                if (old.anim || old.mask) {
                    diag("「" + L0.name + "」清理旧动画: 动画器 " + old.anim + " / 蒙版 " + old.mask);
                }
                var info = getTextInfo(L0, comp.time);
                if (!info) { continue; }

                // 文本层诊断: 段落文本(框文本) / 字号 / 行距 / 图层时间基准。
                // AE 的段落文本超出定界框的行【不会显示】, 有溢出就先修框高;
                // 否则尾部整段既看不到也演不到, 看起来像「出现时长没生效」。
                var boxMsg = info.boxText
                    ? ("段落文本(框 " + Math.round(info.boxW) + "x" + Math.round(info.boxH) + "px)")
                    : "点文本";
                var timeMsg = "";
                try {
                    timeMsg = ", 入/出点 " + L0.inPoint.toFixed(2) + "/" + L0.outPoint.toFixed(2) + "s";
                } catch (eT0) {}
                try {
                    if (Number(L0.stretch) !== 100) { timeMsg += ", ⚠ 拉伸 " + L0.stretch + "%"; }
                } catch (eT1) {}
                try {
                    if (L0.timeRemapEnabled) { timeMsg += ", ⚠ 时间重映射开启"; }
                } catch (eT2) {}
                diag("「" + L0.name + "」" + boxMsg
                    + " / 字号 " + (Math.round(info.fontSize * 100) / 100)
                    + (info.leading > 0 ? " / 行距 " + (Math.round(info.leading * 100) / 100) : "")
                    + " / 文字 " + Math.round(info.rect.width) + "x" + Math.round(info.rect.height) + "px"
                    + timeMsg);

                if (info.boxText && info.doc) {
                    var fitted = fitParagraphBox(L0, getSourceTextProp(L0), info.doc, comp.time, storedWin);
                    if (fitted.windowRect) {
                        info.windowRect = fitted.windowRect;
                        info.windowName = fitted.windowName;
                    }
                    if (fitted.changed) {
                        var rNew = null;
                        try { rNew = L0.sourceRectAtTime(comp.time, false); } catch (eRN) { rNew = null; }
                        if (rNew && Number(rNew.width) > 0) {
                            info.rect = {
                                left: Number(rNew.left) || 0,
                                top: Number(rNew.top) || 0,
                                width: Number(rNew.width) || 0,
                                height: Number(rNew.height) || 0
                            };
                        }
                        diag("「" + L0.name + "」⚠ 段落文本溢出: 排版框 "
                            + Math.round(fitted.boxW) + "x" + Math.round(fitted.boxH)
                            + " → " + Math.round(fitted.newW) + "x" + Math.round(fitted.newH)
                            + "px (" + (fitted.method === "boxOverflow"
                                ? "官方 boxOverflow, 试探 " + fitted.tries + " 次"
                                : "撑高探测")
                            + (fitted.lines > 0 ? ", " + fitted.lines + " 行" : "")
                            + "), " + (fitted.heightOnly ? "框高补到一行" : "改为单行")
                            + "; 你的框 " + Math.round(fitted.winW) + "x" + Math.round(fitted.winH)
                            + " 作为出现窗口, 文字在框内从右往左流动, 文字范围 "
                            + Math.round(info.rect.width) + "x" + Math.round(info.rect.height) + "px");
                    } else if (fitted.overflow === false) {
                        diag("「" + L0.name + "」段落框无溢出(全部文字都在框内), 框尺寸不改, 窗口=你的框 "
                            + Math.round(fitted.winW) + "x" + Math.round(fitted.winH));
                    } else if (fitted.overflow === true) {
                        diag("「" + L0.name + "」⚠ 段落文本溢出修复未生效(见上一条), 窗口仍按你的框");
                    }
                }
                items.push({ layer: L0, info: info });
            }
            if (!items.length) {
                throw new Error("选中的文本层都不可处理（锁定/空文本/无源文本）。");
            }

            // 第二遍: 加文本框蒙版 + 动画。
            for (var j = 0; j < items.length; j++) {
                var L = items[j].layer;
                var info2 = items[j].info;
                touched.push(L);

                // 窗口基准: 段落文本 = 用户给的段落框(原框, 已存进蒙版名);
                // 点文本 = 文字外框(v0.11.7 及之前的行为).
                var baseRect = info2.windowRect ? info2.windowRect : info2.rect;
                var box = computeBox(baseRect, params.padL, params.padR,
                    params.padT, params.padB);
                var maskName = info2.windowName || MASK_WINDOW_NAME;

                if (isType) {
                    // 逐字出现是一整套: 需要窗口蒙版把滑出窗口的文字裁掉。
                    // 羽化必须【向框外】扩散: 窗口 = 文本框, 向内羽化会把首尾的字吃掉,
                    // 长文本时尾部几个字整套落在羽化/框外, 只能等隐藏阶段才滑出来。
                    applyWindowMask(L, box, params.feather, params.strength, true, maskName);
                    var tsr = applyTypeScroll(L, info2, info2.rect, box, params);
                    animTotal += tsr.count;
                    if (tsr.endTime > maxEnd) { maxEnd = tsr.endTime; }
                    extendOutPoint(L, tsr.endTime, comp);
                    diag("「" + L.name + "」逐字出现: " + countChars(info2.text)
                        + " 字(可见 " + countVisibleChars(info2.text) + "), 文字 "
                        + Math.round(info2.rect.width) + "x"
                        + Math.round(info2.rect.height) + "px, 窗口="
                        + (info2.windowRect ? "你的框 " : "文字范围 ")
                        + Math.round(box.width) + "px, 隐藏位移 "
                        + params.hidePx + "px, 结束于 "
                        + tsr.endTime.toFixed(2) + "s");
                } else {
                    applyWindowMask(L, box, params.feather, params.strength, false, maskName);
                    applyScroll(L, info2.rect, box, params);
                    var endT = L.inPoint + params.duration;
                    if (endT > maxEnd) { maxEnd = endT; }
                    extendOutPoint(L, endT, comp);
                    diag("「" + L.name + "」横向滚动: 宽 " + Math.round(info2.rect.width)
                        + "px, 文本框宽 " + Math.round(box.width)
                        + "px, 从 " + L.inPoint.toFixed(2) + "s 开始");
                }
                applied++;
            }

            if (!applied) {
                throw new Error("选中的文本层都不可处理（锁定/空文本/无源文本）。");
            }
            diag("应用完成: " + applied + " 个文本层"
                + (isType ? ", 动画器 " + animTotal : "")
                + ", 最晚结束 " + maxEnd.toFixed(2) + "s");
            setStatus(pal, "完成 · " + applied + " 个文本层 · " + modeText(params.mode)
                + (isScroll ? " · " + directionText(params.direction) : ""), C_OK);
        } catch (err) {
            // 单个 Undo 组能整体撤销; 这里再主动撤掉本次加的动画器/蒙版。
            for (var k = 0; k < touched.length; k++) {
                try { clearOurAnimation(touched[k]); } catch (eR) {}
            }
            diag("!! 应用失败, 已回滚本次修改: " + errText(err));
            setStatus(pal, "⚠ 应用失败: " + errText(err), C_ERR);
            throw err;
        } finally {
            app.endUndoGroup();
        }
    }

    function doRemove() {
        var comp = getComp();
        if (!comp) {
            needCompAlert();
            setStatus(pal, "⚠ 没有活动合成。", C_WARN);
            return;
        }
        var layers = getSelectedTextLayers(comp);
        if (!layers.length) {
            try { alert("请先选中要移除动画的文本图层。"); } catch (e0) {}
            setStatus(pal, "⚠ 没有选中文本图层。", C_WARN);
            return;
        }

        var totalAnim = 0;
        var totalMask = 0;
        var n = 0;
        app.beginUndoGroup(TOOL_TITLE + ": 移除动画");
        try {
            for (var i = 0; i < layers.length; i++) {
                var r = clearOurAnimation(layers[i]);
                totalAnim += r.anim;
                totalMask += r.mask;
                if (r.anim || r.mask) { n++; }
                diag("「" + layers[i].name + "」移除: 动画器 " + r.anim + " / 蒙版 " + r.mask);
            }
            setStatus(pal, "已移除 " + n + " 个文本层的本工具动画"
                + "（动画器 " + totalAnim + " / 蒙版 " + totalMask + "）。", C_OK);
            diag("---- 移除完成 ----");
        } finally {
            app.endUndoGroup();
        }
    }

    function doDiagnose() {
        diag("---- " + TOOL_TITLE + " 诊断 ----");
        diag("脚本版本: " + VER);
        diag("AE 版本: " + app.version + " / 引擎 " + $.version);
        diag("日志: " + gLogPath);
        var comp = getComp();
        if (!comp) {
            diag("活动合成: 无  <-- 时间轴里没有激活的合成时, 按钮会提示但没有动作");
        } else {
            diag("合成: " + comp.name + "  " + comp.width + "x" + comp.height
                + "  " + (Math.round(comp.frameRate * 100) / 100) + "fps"
                + "  " + (Math.round(comp.duration * 100) / 100) + "s");
            var sel = getSelectedTextLayers(comp);
            diag("选中图层: " + comp.selectedLayers.length + " 个 / 其中文本层 " + sel.length + " 个");
            diag("当前文本框参数: 左边距 " + readNum(bxPadL, DEF.padL)
                + " / 右边距 " + readNum(bxPadR, DEF.padR)
                + " / 上边距 " + readNum(bxPadT, DEF.padT)
                + " / 下边距 " + readNum(bxPadB, DEF.padB)
                + " / 羽化 " + readNum(bxFeather, DEF.feather) + "px"
                + " / 强度 " + readNum(bxStrength, DEF.strength) + "%");
            diag("当前逐字出现参数: 出现 " + readNum(bxAppear, DEF.appearDur)
                + "s / 隐藏 " + readNum(bxHide, DEF.hideDur) + "s"
                + " / 隐藏像素 " + readNum(bxHidePx, DEF.hidePx) + "px");
            for (var i = 0; i < sel.length; i++) {
                var L = sel[i];
                var info = getTextInfo(L, comp.time);
                var animators = getAnimatorsGroup(L);
                var ourAnim = 0;
                if (animators) {
                    for (var j = 1; j <= animators.numProperties; j++) {
                        try {
                            if (isOurAnimatorName(animators.property(j).name)) { ourAnim++; }
                        } catch (eA) {}
                    }
                }
                var maskCount = 0;
                var parade = getMaskParade(L);
                if (parade) {
                    for (var k = 1; k <= parade.numProperties; k++) {
                        try {
                            if (isOurMaskName(parade.property(k).name)) { maskCount++; }
                        } catch (eM) {}
                    }
                }
                diag("层「" + L.name + "」: 文本 " + (info ? countChars(info.text) : 0)
                    + " 字 / 本工具动画器 " + ourAnim + " / 窗口蒙版 " + maskCount);
            }
            var params = readParams();
            diag("当前参数: " + modeText(params.mode)
                + (params.mode === MODE_TYPE
                    ? " / 出现 " + params.appearDur + "s / 隐藏 " + params.hideDur + "s"
                        + " / 隐藏像素 " + params.hidePx + "px"
                    : " / 方向 " + directionText(params.direction)
                        + " / 时长 " + params.duration + "s")
                + " / 渐隐 " + params.fade + "s / 羽化 " + params.feather + "px");
        }
        diag("---- 诊断结束 ----");
        flushDiag(pal);
        setStatus(pal, "诊断完成，结果在下方「输出与调试」区。", C_OK);
    }

    // ============================================================
    // 八、挂载
    // ============================================================
    function mountPanel() {
        try {
            buildUI();
        } catch (e) {
            gUIError = (e ? e.toString() : String(e))
                + (e && e.line ? " @line " + e.line : "");
            flog("!! UI 构建异常: " + gUIError + "\n" + (e && e.stack ? e.stack : ""));
            buildErrorUI();
        }

        if (pal instanceof Panel) {
            try { pal.layout.layout(true); } catch (eL) {}
            try { pal.layout.resize(); } catch (eR) {}
            pal.onResizing = pal.onResize = function () { this.layout.resize(); };
            try {
                flog("布局完成: 面板 " + pal.size[0] + "x" + pal.size[1]
                    + " / 首选 " + pal.preferredSize[0] + "x" + pal.preferredSize[1]);
                if (pal.size[0] < 200 || pal.size[1] < 200) {
                    flog("⚠ 面板被停靠得太小(" + pal.size[0] + "x" + pal.size[1]
                        + "): 请把面板拖宽/拖高, 否则参数行会被裁掉。");
                }
            } catch (eS) {}
            // 首次加载只在这里落盘一次: 桌面可能被网盘同步, 逐条写会明显拖慢加载。
            flushLog();
        } else if (pal) {
            try { pal.center(); } catch (eC) {}
            try { pal.show(); } catch (eS2) {}
        }
    }

    mountPanel();

})(this);
