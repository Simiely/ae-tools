/*
 * MountainSpectrum.jsx  (面板版 v6.4)
 * AE 山峰频谱一键搭建面板
 * ----------------------------------------
 * 功能:点击按钮,在当前合成中自动完成:
 *   1. 新建固态层(深色底:背景层 + 频谱层)
 *   2. 频谱层:音频频谱用水平基线(Path=无),柱子竖直
 *   3. 画"山峰包络"封闭蒙版(Add 模式),把竖直柱子裁剪成
 *      中间高、两侧低的山峰形状,顶部带轻微自然起伏
 *   4. 自动绑定音频层(单条自动选;多条面板下拉选;没有则提示)
 * 交互:窗口内只显示"状态"行;完整执行过程仅在出错/点按钮时弹出(可复制);正常不弹窗。
 * 安装位置:ScriptUI Panels 文件夹 → 出现在 Window > Extensions 菜单
 */
(function (thisObj) {

  var pal = (thisObj instanceof Panel) ? thisObj
      : new Window("palette", "山峰频谱", undefined, { resizeable: false });

  // ---------- 状态行 ----------
  var statusTxt = null;

  function status(msg) {
    if (statusTxt) {
      statusTxt.text = msg;
      try { pal.layout.layout(true); } catch (e) {}
    }
  }

  // ---------- 弹窗(内容可选中复制;错误/查看过程共用) ----------
  function showDialog(title, body) {
    try {
      var w = new Window("dialog", title);
      w.add("statictext", undefined, "内容(可选中后复制):");
      var et = w.add("edittext", undefined, body, { multiline: true });
      et.preferredSize.width = 380;
      et.preferredSize.height = 260;
      var ok = w.add("button", undefined, "关闭");
      ok.onClick = function () { w.close(); };
      w.show();
    } catch (e2) {
      alert(title + "\n\n" + body);
    }
  }

  // ---------- 工具:按名称设置效果参数,失败则按索引 ----------
  function setParam(eff, name, idx, val) {
    try { eff.property(name).setValue(val); return true; } catch (e) {}
    try { eff.property(idx).setValue(val); return true; } catch (e2) { return false; }
  }

  // ---------- 判断图层是否有音频 ----------
  function layerHasAudio(L) {
    try { if (L.hasAudio) return true; } catch (e) {}
    try { if (L.source && L.source.hasAudio) return true; } catch (e2) {}
    return false;
  }

  // ---------- 生成"山峰包络"封闭蒙版轮廓(竖直柱子的裁剪轮廓) ----------
  function buildEnvelope(w, h) {
    var n = 26;                    // 拱形采样点数
    var baseY = h * 0.86;          // 山脚基线(频谱水平基线同在此高度)
    var peakY = h * 0.18;          // 山顶
    var cx = w * 0.5;
    var half = w * 0.47;
    var pts = [];
    pts.push([w * 0.03, baseY]);   // 左下角
    var i, u, x, y, env, wob;
    for (i = 0; i < n; i++) {
      u = -1 + 2 * i / (n - 1);
      x = cx + u * half;
      env = 1 - u * u;                                              // 0@两端 1@中心
      wob = Math.sin(i * 2.2) * Math.sin((i / (n - 1)) * Math.PI) * h * 0.02; // 自然起伏,两端归零
      y = peakY + (baseY - peakY) * (1 - env) - wob;
      pts.push([x, y]);
    }
    pts.push([w * 0.97, baseY]);   // 右下角
    var verts = [], ins = [], outs = [];
    for (i = 0; i < pts.length; i++) {
      var p0 = pts[Math.max(0, i - 1)];
      var p1 = pts[Math.min(pts.length - 1, i + 1)];
      var tx = (p1[0] - p0[0]) * 0.3;
      var ty = (p1[1] - p0[1]) * 0.3;
      verts.push(pts[i]);
      ins.push([-tx, -ty]);
      outs.push([tx, ty]);
    }
    return { vertices: verts, inTangents: ins, outTangents: outs };
  }

  // ---------- 核心:生成山峰频谱 ----------
  function generate(bandsVal, jumpVal, dispVal) {
    var dbg = [];
    var step = "初始化";
    lastDbg = dbg;
    function dbgLog(s) { dbg.push(s); }

    // 添加音频频谱效果:依次尝试匹配名/英文名/中文名
    function addAudioSpectrum(parade) {
      var names = ["ADBE Audio Spectrum", "Audio Spectrum", "音频频谱"];
      for (var k = 0; k < names.length; k++) {
        try {
          var e = parade.addProperty(names[k]);
          if (e) {
            dbgLog("效果:用「" + names[k] + "」添加成功");
            return e;
          }
        } catch (ek) {
          dbgLog("效果:尝试「" + names[k] + "」失败");
        }
      }
      return null;
    }

    try {

      // 0. 项目检查(未打开项目时 app.project 为 null)
      step = "检查项目";
      if (!app.project) {
        dbgLog("错误:没有打开的项目(Project)");
        status("出错:未打开项目,请先新建项目");
        showDialog("执行出错",
          "没有打开的项目(Project)。\n\n" +
          "请先:File > New > New Project 新建项目\n" +
          "再重新点击「一键生成山峰频谱」。");
        return;
      }

      // 1. 合成
      step = "获取合成";
      status("正在执行:获取合成…");
      var comp = app.project.activeItem;
      if (!(comp instanceof CompItem)) {
        comp = app.project.items.addComp("山峰频谱", 1920, 1080, 1, 30, 30);
        dbgLog("合成:新建「山峰频谱」1920x1080 30s");
      } else {
        dbgLog("合成:使用当前「" + comp.name + "」" + comp.width + "x" + comp.height);
      }

      // 2. 音频层(优先用面板选择的;否则自动检测;多条且自动时弹窗)
      step = "查找音频层";
      status("正在执行:查找音频层…");
      var audioLayers = [];
      var i;
      for (i = 1; i <= comp.numLayers; i++) {
        if (layerHasAudio(comp.layer(i))) audioLayers.push(comp.layer(i));
      }
      var audioLayer = null;
      if (pickedAudio) {
        audioLayer = pickedAudio;
        dbgLog("音频层:使用面板选择「" + audioLayer.name + "」(index=" + audioLayer.index + ")");
      } else if (audioLayers.length === 1) {
        audioLayer = audioLayers[0];
        dbgLog("音频层:自动选择「" + audioLayer.name + "」(index=" + audioLayer.index + ")");
      } else if (audioLayers.length > 1) {
        dbgLog("音频层:检测到 " + audioLayers.length + " 条,请用面板下拉选择;未选择则自动取第 1 条");
        audioLayer = audioLayers[0];
        dbgLog("音频层:自动取第 1 条「" + audioLayer.name + "」");
      } else {
        dbgLog("音频层:未检测到音乐(可在面板下拉选择,或先拖入音乐再刷新)");
      }

      // 3. 固态层:先建背景层,再建频谱层(频谱层在上面)
      step = "创建固态层";
      status("正在执行:创建固态层…");
      var bgSolid = comp.layers.addSolid([0.02, 0.03, 0.08], "山峰背景", comp.width, comp.height, 1, comp.duration);
      var solid = comp.layers.addSolid([0.02, 0.03, 0.08], "山峰频谱", comp.width, comp.height, 1, comp.duration);
      dbgLog("固态层:已创建「山峰背景」(底色) + 「山峰频谱」(柱状)");

      // 4. 山峰包络蒙版(封闭轮廓,Add 模式:把竖直柱子裁剪成山峰形状)
      step = "绘制山峰包络蒙版";
      status("正在执行:绘制山峰包络蒙版…");
      var mask = solid.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
      mask.name = "山峰包络";
      try {
        mask.maskMode = MaskMode.ADD;                                // Add:裁剪频谱输出成山峰轮廓
        var mmRead = "?";
        try { mmRead = mask.maskMode; } catch (emr) {}
        dbgLog("蒙版:模式=" + mmRead + (mmRead === MaskMode.ADD ? " [Add ✓]" : " [注意]"));
      } catch (em) {
        dbgLog("蒙版:模式设置失败 " + em.toString());
      }
      try { mask.property("ADBE Mask Feather").setValue([4, 4]); } catch (ef) {}
      var arch = buildEnvelope(comp.width, comp.height);
      var shape = new Shape();
      shape.vertices = arch.vertices;
      shape.inTangents = arch.inTangents;
      shape.outTangents = arch.outTangents;
      shape.closed = true;
      mask.property("ADBE Mask Shape").setValue(shape);
      dbgLog("蒙版:已生成「山峰包络」封闭轮廓");

      // 5. 音频频谱效果 + 参数
      step = "添加音频频谱效果";
      status("正在执行:添加音频频谱效果…");
      var eff = addAudioSpectrum(solid.property("ADBE Effect Parade"));
      if (!eff) {
        dbgLog("错误:自动添加音频频谱失败(3 种名称均不被识别)");
        status("出错:无法自动添加音频频谱,详见弹窗");
        showDialog("无法添加音频频谱",
          "脚本无法自动添加「音频频谱」效果(3 种名称均不被此 AE 识别)。\n\n" +
          "请手动操作(约 30 秒):\n" +
          "1. 选中时间轴里的「山峰频谱」固态层\n" +
          "2. 顶部菜单:效果 > 生成 > 音频频谱\n" +
          "3. 效果控件里:音频层 → 选你的音乐\n" +
          "4. 路径保持「无」,把起始点/结束点拉到山峰基线高度\n\n" +
          "其余(背景层/山峰包络蒙版)脚本已生成好。\n\n" +
          "——执行过程——\n" +
          dbg.join("\n"));
        return;
      }

      // 路径保持 None(水平基线),设起始点/结束点
      setParam(eff, "Start Point", 2, [comp.width * 0.03, comp.height * 0.86]);
      setParam(eff, "End Point", 3, [comp.width * 0.97, comp.height * 0.86]);
      dbgLog("效果:路径=None(水平基线),基线在 3%→97% 宽、86% 高");

      // 音频层绑定 + 读回验证(索引 1 = Audio Layer)
      if (audioLayer) {
        var okAudio = setParam(eff, "Audio Layer", 1, audioLayer.index);
        var cur = -1;
        try { cur = eff.property("Audio Layer").value; } catch (e1) { try { cur = eff.property(1).value; } catch (e2) {} }
        dbgLog("效果:音频层 index=" + audioLayer.index +
               (okAudio ? "" : " 设置失败") +
               (cur === audioLayer.index ? " [已生效]" : " [待确认,当前值=" + cur + "]"));
      } else {
        dbgLog("效果:未设置音频层(未选音乐,回面板选择后重新生成)");
      }

      if (audioLayer && audioLayer.audioEnabled === false) {
        dbgLog("警告:音频层「" + audioLayer.name + "」被静音了,请点开时间轴上的小喇叭");
      }

      step = "设置参数";
      status("正在执行:设置参数…");
      setParam(eff, "Start Frequency", 6, 20);
      setParam(eff, "End Frequency", 7, 16000);
      setParam(eff, "Frequency bands", 8, bandsVal);
      setParam(eff, "Maximum Height", 9, Math.round(comp.height * 0.85)); // 必须够高,柱子才能"撞"上山峰轮廓被裁剪
      setParam(eff, "Audio Duration", 10, jumpVal);
      setParam(eff, "Audio Offset", 11, 0);
      setParam(eff, "Thickness", 12, 12);
      setParam(eff, "Softness", 13, 0);
      setParam(eff, "Inside Color", 14, [0.2, 0.85, 1, 1]);
      setParam(eff, "Outside Color", 15, [0.02, 0.28, 0.62, 1]);
      setParam(eff, "Blend Overlapping Colors", 16, true);
      setParam(eff, "Hue Interpolation", 17, 45);
      setParam(eff, "Dynamic Hue Phase", 18, false);
      setParam(eff, "Color Symmetry", 19, false);
      setParam(eff, "Display Options", 20, dispVal);               // 1数字(柱状图) 2谱线 3频点
      setParam(eff, "Side Options", 21, 1);                         // 1=A面 只向上
      setParam(eff, "Duration Averaging", 22, false);
      setParam(eff, "Composite On Original", 23, false);
      dbgLog("参数:频段=" + bandsVal + " 时长=" + jumpVal + "ms 最大高度=" + Math.round(comp.height * 0.85) + "(需够高才能显现山峰轮廓)");

      // 参数读回验证
      var pv = "?", dv = "?", sv2 = "?", mh2 = "?";
      try { pv = eff.property("Path").value; } catch (eP) { try { pv = eff.property(4).value; } catch (eP2) {} }
      try { dv = eff.property("Display Options").value; } catch (eD) { try { dv = eff.property(20).value; } catch (eD2) {} }
      try { sv2 = eff.property("Side Options").value; } catch (eS2) { try { sv2 = eff.property(21).value; } catch (eS3) {} }
      try { mh2 = eff.property("Maximum Height").value; } catch (eM) { try { mh2 = eff.property(9).value; } catch (eM2) {} }
      dbgLog("验证:路径=" + pv + " 显示=" + dv + " 面=" + sv2 + " 最大高度=" + mh2);

      // 6. 合成时长跟随音频
      step = "调整合成时长";
      status("正在执行:调整合成时长…");
      if (audioLayer && audioLayer.source && audioLayer.source.duration > 5) {
        comp.duration = audioLayer.source.duration;
        dbgLog("合成时长:跟随音频 " + Math.round(audioLayer.source.duration) + "s");
      }

      // 7. 完成
      step = "完成";
      dbgLog("完成:生成结束");
      if (audioLayer) {
        dbgLog("提示:按空格播放预览,柱子才会随音乐跳动");
        status("已完成:按空格播放,柱子随音乐跳动");
        // 把播放头移到音乐中段,便于立即看到柱子
        try {
          var srcDur = (audioLayer.source && audioLayer.source.duration) ? audioLayer.source.duration : comp.duration;
          comp.time = Math.max(1, Math.min(srcDur * 0.3, comp.duration - 1));
          dbgLog("播放头:已移到 " + Math.round(comp.time) + "s(此处一般有声音)");
        } catch (eT) {}
      } else {
        status("已完成:未选音乐,请在上方「音频层」选择后重新生成");
      }

    } catch (e) {
      dbg.push("出错位置:" + step);
      dbg.push(e.toString());
      status("出错:" + step + ",详情见弹窗");
      showDialog("执行出错",
        "出错位置:" + step + "\n\n" +
        e.toString() + "\n\n" +
        "——执行过程——\n" +
        dbg.join("\n"));
    }

    lastDbg = dbg.slice();
    try { refreshAudioList(); } catch (eSync) {}
  }

  // ---------- 面板 UI ----------
  pal.add("statictext", undefined, "中间高、两侧低,带跳动");

  // 音频层选择(下拉可整体重建,避免 removeAll 在部分 AE 版本失效)
  pal.add("statictext", undefined, "音频层(音乐):");
  var audioRow = pal.add("group");
  var ddAudio = null;
  var btnRefresh = null;
  var audioLayersCache = [];
  var pickedAudio = null;

  function onAudioChange() {
    var idx = ddAudio && ddAudio.selection ? ddAudio.selection.index : 0;
    pickedAudio = (idx >= 1 && audioLayersCache.length >= idx) ? audioLayersCache[idx - 1] : null;
    status(pickedAudio ? "已选择音频层:「" + pickedAudio.name + "」" : "音频层:自动检测");
  }

  function onRefreshClick() {
    refreshAudioList();
    status("已刷新音频层列表");
  }

  function rebuildAudioRow(labels) {
    try { if (ddAudio) audioRow.remove(ddAudio); } catch (e) {}
    try { if (btnRefresh) audioRow.remove(btnRefresh); } catch (e2) {}
    ddAudio = audioRow.add("dropdownlist", undefined, labels);
    ddAudio.preferredSize.width = 200;
    ddAudio.onChange = onAudioChange;
    btnRefresh = audioRow.add("button", undefined, "刷新");
    btnRefresh.onClick = onRefreshClick;
    pickedAudio = null;
    try { audioRow.layout.layout(true); } catch (e3) {}
    try { pal.layout.layout(true); } catch (e4) {}
  }

  function refreshAudioList() {
    var layers = [];
    var labels = ["自动检测"];
    var comp = app.project ? app.project.activeItem : null;
    if (!(comp instanceof CompItem)) {
      labels.push(app.project ? "(未选中合成,请点时间轴里的合成再刷新)" : "(未打开项目)");
    } else {
      for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        if (layerHasAudio(L)) {
          layers.push(L);
          labels.push("[" + L.index + "] " + L.name);
        }
      }
      if (layers.length === 0) labels.push("(未找到音频层)");
    }
    audioLayersCache = layers;
    rebuildAudioRow(labels);
  }

  pal.add("statictext", undefined, "显示样式:");
  var ddDisp = pal.add("dropdownlist", undefined, ["柱状图(数字)", "谱线(模拟)", "频点(模拟)"]);
  ddDisp.selection = 0;

  pal.add("statictext", undefined, "频段密度:");
  var ddBands = pal.add("dropdownlist", undefined, ["块状(60)", "标准(120)", "细腻(260)"]);
  ddBands.selection = 1;

  pal.add("statictext", undefined, "跳动感:");
  var ddJump = pal.add("dropdownlist", undefined, ["剧烈(40ms)", "标准(60ms)", "平滑(120ms)"]);
  ddJump.selection = 1;

  var dispVals = [1, 2, 3];
  var bandsVals = [60, 120, 260];
  var jumpVals = [40, 60, 120];

  var btnGo = pal.add("button", undefined, "一键生成山峰频谱");
  btnGo.onClick = function () {
    generate(bandsVals[ddBands.selection.index], jumpVals[ddJump.selection.index], dispVals[ddDisp.selection.index]);
  };

  var btnInfo = pal.add("button", undefined, "查看执行过程");
  btnInfo.onClick = function () {
    var body = lastDbg.length ? lastDbg.join("\n") : "(还没有运行记录)";
    showDialog("执行过程", body);
  };

  pal.add("statictext", undefined, "状态:");
  statusTxt = pal.add("statictext", undefined, "就绪,可点击「一键生成山峰频谱」");
  if (statusTxt) {
    statusTxt.preferredSize.width = 300;
    statusTxt.preferredSize.height = 16;
  }

  var lastDbg = [];

  refreshAudioList();
  status("就绪,可点击「一键生成山峰频谱」");

  if (pal instanceof Window) {
    pal.center();
    pal.show();
  } else {
    pal.layout.layout(true);
  }

})(this);
