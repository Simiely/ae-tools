#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ae-tools 仓库级验收器（verify.py）

一条命令跑完四件事，把"改完不知道有没有弄坏别的地方"这个空白补上：

  ① 语法检查    每个面板的 .jsx 过一遍 node --check
                （node 不认 .jsx 后缀，复制成 .js 再查）
  ② 断言测试    跑所有带 test_*.js 的面板（必须在该面板目录内跑，测试按相对路径载入源码）
  ③ 部署一致性  AE 部署副本 vs 源码（去 BOM + 归一化行尾后逐字节比对）
  ④ 欠债清单    列出「无测试」「无 VER 常量」的面板 —— 把技术债摆到台面上

用法:
    python verify.py                 # 全跑
    python verify.py --no-deploy     # 跳过部署一致性检查（AE 未部署时用）

退出码: 0 = 全部通过; 1 = 有失败

设计约束（本仓库既有约定）:
  · 只读 —— 不修改任何文件（临时语法检查文件写系统临时目录，用完即删）
  · 不接管部署 —— 部署仍走 install.py；本脚本只**验收**，不写入 AE 目录
  · 面板目录里可能有旧版本备份（如 xxx.jsx.bak-*），按"每目录一个主 .jsx"的仓库约定只认唯一那个
"""
import os
import re
import sys
import shutil
import tempfile
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
NODE = shutil.which("node") or "node"

C_OK = "  [OK]   "
C_BAD = "  [FAIL] "
C_SKIP = "  [--]   "
C_WARN = "  [WARN] "


def find_ae_versions(appdata):
    base = os.path.join(appdata, "Adobe", "After Effects")
    if not os.path.isdir(base):
        return []
    out = []
    for name in os.listdir(base):
        m = re.fullmatch(r"(\d+)\.(\d+)", name)
        if m and os.path.isdir(os.path.join(base, name)):
            out.append((int(m[1]), int(m[2]), name))
    out.sort()
    return [v[2] for v in out]


def norm_bytes(path):
    """去 BOM + 归一化行尾 —— 只比内容，不关心 CRLF/LF 与 BOM 差异"""
    with open(path, "rb") as f:
        b = f.read()
    if b[:3] == b"\xef\xbb\xbf":
        b = b[3:]
    return b.replace(b"\r\n", b"\n")


def collect_panels():
    """返回 [(面板名, 主 jsx 路径, 测试路径或 None)]"""
    out = []
    pdir = os.path.join(HERE, "panels")
    if not os.path.isdir(pdir):
        return out
    for name in sorted(os.listdir(pdir)):
        d = os.path.join(pdir, name)
        if not os.path.isdir(d):
            continue
        jsx = sorted(f for f in os.listdir(d) if f.lower().endswith(".jsx"))
        if len(jsx) != 1:
            # 仓库约定: 每目录一个 .jsx 主文件; 多于一个说明有东西没清干净
            if len(jsx) > 1:
                out.append((name, None, None))
            continue
        tests = sorted(f for f in os.listdir(d) if f.startswith("test_") and f.endswith(".js"))
        out.append((name,
                    os.path.join(d, jsx[0]),
                    os.path.join(d, tests[0]) if tests else None))
    return out


def check_syntax(jsx_path):
    """node --check 需要 .js 后缀 —— 复制到临时文件再查"""
    fd, tmp = tempfile.mkstemp(suffix=".js", prefix="_verify_")
    os.close(fd)
    try:
        shutil.copyfile(jsx_path, tmp)
        r = subprocess.run([NODE, "--check", tmp],
                           capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        return r.returncode == 0, (r.stderr or r.stdout or "").strip()
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def check_tests(panel_dir, test_path):
    """跑测试并判定结果。测试必须在该面板目录内运行（脚本按相对路径载入主文件）。

    ⚠️ 本仓库的测试有【多套输出格式】(2026-09-21 实测)，判定不能只认一种：
         "全部通过: N 通过 / M 失败"  ← MountainSpectrum
         "结果: N 通过, M 失败"        ← TimeAxisIndent / Rolling-Lyrics-V2
         "断言: N 通过, M 失败"        ← NumCounter
         "全部 N 组测试通过"           ← AE-Rolling-Lyrics（无失败计数，且**没有失败退出码**）
         "ALL PASS (N assertions)"    ← QuickKey
    判定顺序：① 解析「通过/失败」计数对 → ② 关键字 + 退出码 → ③ 认不出就返回 None。
    **None 表示"无法判定"，主流程报 WARN —— 绝不假装通过**，否则一个坏掉的测试会悄悄绿着。
    """
    r = subprocess.run([NODE, os.path.basename(test_path)],
                       cwd=panel_dir, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    out = (r.stdout or "") + (r.stderr or "")
    pats = [
        r"(?:全部通过|存在失败)\s*[:：]\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败",
        r"结果\s*[:：]\s*(\d+)\s*通过\s*[,，]\s*(\d+)\s*失败",
        r"断言\s*[:：]\s*(\d+)\s*通过\s*[,，]\s*(\d+)\s*失败",
        r"(\d+)\s*通过\s*[,，]\s*(\d+)\s*失败",
    ]
    for p in pats:
        m = re.search(p, out)
        if m:
            passed, failed = int(m.group(1)), int(m.group(2))
            return (failed == 0 and r.returncode == 0), "%d 通过 / %d 失败" % (passed, failed)
    if re.search(r"ALL\s*PASS|全部\s*\d+\s*组测试通过", out):
        return (r.returncode == 0), "全部通过(exit %d)" % r.returncode
    if r.returncode != 0:
        last = out.strip().splitlines()[-1][:80] if out.strip() else "无输出"
        return False, "运行失败(exit %d): %s" % (r.returncode, last)
    return None, "未识别输出格式(需人工确认)"


def main():
    skip_deploy = "--no-deploy" in sys.argv

    print("=" * 72)
    print("ae-tools 仓库级验收")
    print("=" * 72)

    panels = collect_panels()
    if not panels:
        print("错误: 未找到 panels/ 下的任何面板")
        return 1

    # AE 部署目录
    appdata = os.environ.get("APPDATA")
    vers = find_ae_versions(appdata) if appdata else []
    ae_panels_dir = None
    if vers:
        ae_panels_dir = os.path.join(appdata, "Adobe", "After Effects", vers[-1],
                                     "Scripts", "ScriptUI Panels")
    print("node: %s" % NODE)
    if ae_panels_dir and not skip_deploy:
        print("AE 部署目录: %s" % ae_panels_dir)
    elif skip_deploy:
        print("AE 部署目录: （已按要求跳过比对）")
    else:
        print("AE 部署目录: 未检测到 AE 版本 -> 跳过一致性比对")
    print()

    n_ok = 0
    n_fail = 0
    n_warn = 0
    no_test = []
    no_ver = []
    no_exit = []
    deploy_mismatch = []
    bad_jsx = []

    hdr = "%-28s %-8s %-22s %s" % ("面板", "语法", "断言", "部署一致性")
    print(hdr)
    print("-" * 72)

    for name, jsx, test in panels:
        if jsx is None:
            print("%-28s %s多个 .jsx 主文件(违反仓库约定)" % (name, C_WARN))
            bad_jsx.append(name)
            n_fail += 1
            continue

        # ① 语法
        ok_syn, err = check_syntax(jsx)
        s_syn = "OK" if ok_syn else "FAIL"
        if not ok_syn:
            n_fail += 1
            bad_jsx.append(name)

        # ② 测试
        if test:
            ok_t, tinfo = check_tests(os.path.dirname(jsx), test)
            if ok_t is None:
                s_t = "WARN " + tinfo           # 无法判定: 不算失败, 但也绝不算通过
                n_warn += 1
                ok_t = True
            elif ok_t:
                s_t = tinfo
            else:
                s_t = "FAIL " + tinfo
                n_fail += 1
        else:
            ok_t = True
            s_t = "—(无测试)"
            no_test.append(name)

        # ③ 部署一致性
        s_d = "—"
        if ae_panels_dir and not skip_deploy:
            dep = os.path.join(ae_panels_dir, os.path.basename(jsx))
            if not os.path.exists(dep):
                s_d = "未部署"
                deploy_mismatch.append(name)
            elif norm_bytes(jsx) == norm_bytes(dep):
                s_d = "一致"
            else:
                s_d = "不一致(需重新部署)"
                deploy_mismatch.append(name)

        # ④ 欠债: VER 常量
        raw = open(jsx, "rb").read().decode("utf-8-sig", "replace")
        if "var VER = " not in raw:
            no_ver.append(name)
        # ⑤ 欠债: 测试是否具备【失败退出码】(没有它, 验收只能靠猜输出格式)
        if test:
            tb = open(test, "rb").read().decode("utf-8-sig", "replace")
            if "process.exit" not in tb:
                no_exit.append(name)

        if ok_syn and ok_t:
            n_ok += 1
        print("%-28s %-8s %-22s %s" % (name, s_syn, s_t, s_d))
        if not ok_syn and err:
            print("      ↳ 语法错误: " + err.splitlines()[-1][:100])

    print("-" * 72)
    print("面板 %d 个: 通过 %d / 失败 %d" % (len(panels), n_ok, n_fail)
          + ("  |  无法判定 %d" % n_warn if n_warn else ""))

    # ---- 欠债清单 ----
    print()
    print("=" * 72)
    print("技术债清单（不失败，但建议按此顺序处理）")
    print("=" * 72)
    if no_test:
        print("① 无断言测试（重构/加功能时没有安全网）: %d 个" % len(no_test))
        print("     " + ", ".join(no_test))
    else:
        print("① 无断言测试: 无 ✓")
    if no_ver:
        print("② 无 VER 版本常量（AE 只在启动时载入脚本，无版本号就无法判断跑的是哪版）: %d 个" % len(no_ver))
        print("     " + ", ".join(no_ver))
    else:
        print("② 无 VER 版本常量: 无 ✓")
    if no_exit:
        print("③ 测试缺【失败退出码】(失败也返回 0, 验收只能靠猜文本): %d 个" % len(no_exit))
        print("     " + ", ".join(no_exit) + "   -> 在该测试末尾补 process.exit(failed ? 1 : 0)")
    else:
        print("③ 测试缺失败退出码: 无 ✓")
    if deploy_mismatch:
        print("④ 部署副本与源码不一致: %d 个 -> 跑 python install.py" % len(deploy_mismatch))
        print("     " + ", ".join(deploy_mismatch))

    ok_all = (n_fail == 0)
    print()
    print("=" * 72)
    print("验收结果: " + ("全部通过 ✓" if ok_all else "存在失败 ✗"))
    print("=" * 72)
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
