#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ae-tools 一键部署器
将 panels/*.jsx 部署到 AE 的 ScriptUI Panels（Window > Extensions 菜单）
将 scripts/*.jsx 部署到 AE 的 Scripts（File > Scripts 菜单）
自动检测 AE 版本、确保 UTF-8 BOM（ExtendScript 中文不乱码）、逐字节校验。

用法:
    python install.py            # 自动检测最高版本并部署
    python install.py --version 26.0
    python install.py --dry-run  # 仅打印将部署的清单，不实际写入
"""
import os
import sys
import re
import shutil
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
BOM = b"\xef\xbb\xbf"


def find_ae_versions(appdata):
    """扫描 %APPDATA%\\Adobe\\After Effects\\ 下的数字版本目录，返回按版本排序的列表"""
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


def collect_jsx(folder):
    """收集 folder 下所有 .jsx：直接位于 folder 下，或位于其一级子目录下。
    返回 [(源绝对路径, 目标文件名)]"""
    items = []
    if not os.path.isdir(folder):
        return items
    for name in sorted(os.listdir(folder)):
        full = os.path.join(folder, name)
        if os.path.isdir(full):
            for f in sorted(os.listdir(full)):
                p = os.path.join(full, f)
                if f.lower().endswith(".jsx") and os.path.isfile(p):
                    items.append((p, f))
        elif name.lower().endswith(".jsx") and os.path.isfile(full):
            items.append((full, name))
    return items


def ensure_bom(path):
    """确保文件为 UTF-8 with BOM（就地修改），返回是否补了 BOM"""
    with open(path, "rb") as f:
        data = f.read()
    if data.startswith(BOM):
        return False
    with open(path, "wb") as f:
        f.write(BOM + data)
    return True


def deploy(src, dst, dry_run):
    if dry_run:
        print("  [dry-run] -> %s" % dst)
        return True
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    added = ensure_bom(src)  # 源码统一带 BOM，部署副本与源码一致
    shutil.copy2(src, dst)
    with open(src, "rb") as f:
        s = f.read()
    with open(dst, "rb") as f:
        d = f.read()
    ok = s == d
    print("  %s %s -> %s%s" % ("OK " if ok else "FAIL", os.path.basename(src), dst,
                                " (补BOM)" if added else ""))
    return ok


def main():
    ap = argparse.ArgumentParser(description="ae-tools 一键部署器")
    ap.add_argument("--version", help="AE 内部版本号，如 26.0（默认自动检测最高版本）")
    ap.add_argument("--dry-run", action="store_true", help="仅打印部署清单")
    args = ap.parse_args()

    appdata = os.environ.get("APPDATA")
    if not appdata:
        print("错误: 无法获取 %APPDATA% 环境变量")
        sys.exit(1)

    versions = find_ae_versions(appdata)
    if not versions:
        print("错误: 未在 %APPDATA%\\Adobe\\After Effects\\ 检测到任何 AE 版本")
        sys.exit(1)
    ver = args.version or versions[-1]
    if args.version and args.version not in versions:
        print("警告: 指定版本 %s 不在检测列表中 %s，仍将使用 %s" % (args.version, versions, ver))

    ae_root = os.path.join(appdata, "Adobe", "After Effects", ver)
    panels_dst = os.path.join(ae_root, "Scripts", "ScriptUI Panels")
    scripts_dst = os.path.join(ae_root, "Scripts")
    print("AE 版本: %s (%s)" % (ver, ae_root))

    targets = [
        ("panels", "ScriptUI Panels", "自写面板"),
        ("scripts", "Scripts", "自写脚本"),
        (os.path.join("third-party", "panels"), "ScriptUI Panels", "收集面板"),
        (os.path.join("third-party", "scripts"), "Scripts", "收集脚本"),
    ]

    ok_all = True
    counts = {}
    for sub, folder, label in targets:
        items = collect_jsx(os.path.join(HERE, sub))
        if not items:
            continue
        dst_dir = panels_dst if folder == "ScriptUI Panels" else scripts_dst
        print("== %s → %s ==" % (label, dst_dir))
        for src, name in items:
            ok_all &= deploy(src, os.path.join(dst_dir, name), args.dry_run)
            counts[folder] = counts.get(folder, 0) + 1

    n_panels = counts.get("ScriptUI Panels", 0)
    n_scripts = counts.get("Scripts", 0)
    if args.dry_run:
        print("dry-run 清单完成（%d 面板 / %d 脚本，未写入）" % (n_panels, n_scripts))
    elif ok_all:
        print("全部 %d 面板 + %d 脚本部署成功，校验通过。重启 After Effects 后生效。" % (n_panels, n_scripts))
    else:
        print("存在部署失败项，请检查上述 FAIL 行。")
        sys.exit(1)


if __name__ == "__main__":
    main()
