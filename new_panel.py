#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ae-tools 新面板脚手架
把 _template/ 派生为一个可用的新面板目录（复制 + 改名 + 替换标识）。

用法:
    python new_panel.py MyPanel "我的面板"
    python new_panel.py MyPanel "我的面板" --dry-run

派生后会:
    panels/MyPanel/MyPanel.jsx            主文件（TOOL_ID/TOOL_TITLE 已替换）
    panels/MyPanel/test_MyPanel.js        断言测试（含骨架体检断言）
    panels/MyPanel/README.md / CHANGELOG.md / AGENTS.md

接着做:
    ① 写业务: 把「示例逻辑」段替换成真实实现, 纯函数放进「纯逻辑层」并补测试
    ② python verify.py     # 验收（语法 / 断言 / 部署一致性 / 技术债）
    ③ python install.py    # 部署到 AE（重启 AE 后生效）
"""
import os
import sys
import shutil
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(HERE, "_template")
PANELS_DIR = os.path.join(HERE, "panels")

# 模板里的可替换标识
TPL_ID = "PanelTemplate"     # 英文标识
TPL_TITLE = "面板模板"        # 中文显示名


def read_text(path):
    with open(path, "rb") as f:
        data = f.read()
    bom = data[:3] == b"\xef\xbb\xbf"
    return data.decode("utf-8-sig"), bom


def write_text(path, text, bom):
    data = text.encode("utf-8")
    if bom:
        data = b"\xef\xbb\xbf" + data
    with open(path, "wb") as f:
        f.write(data)


def derive_file(src, dst, new_id, new_title, dry_run):
    """复制并替换标识。⚠️ 保留原文件的 BOM 与行尾 —— 不要用通用文本库默认重写,
    否则 CRLF 会被转成 LF, 与仓库其他文件不一致（ExtendScript 对这个不敏感,
    但 diff 会整文件飘红）。"""
    text, bom = read_text(src)
    n_id = text.count(TPL_ID)
    n_title = text.count(TPL_TITLE)
    text = text.replace(TPL_ID, new_id).replace(TPL_TITLE, new_title)
    if not dry_run:
        write_text(dst, text, bom)
    print("  %-46s (标识 %d + 标题 %d)" % (os.path.relpath(dst, HERE), n_id, n_title))


def main():
    ap = argparse.ArgumentParser(description="ae-tools 新面板脚手架")
    ap.add_argument("name", help="面板英文标识（同时作为目录名与主文件名），如 MyPanel")
    ap.add_argument("title", help="面板中文显示名，如「我的面板」")
    ap.add_argument("--dry-run", action="store_true", help="仅打印将生成的文件")
    args = ap.parse_args()

    name = args.name.strip()
    title = args.title.strip()

    if not name or not title:
        print("错误: name 与 title 都不能为空")
        sys.exit(1)
    if not os.path.isdir(TEMPLATE_DIR):
        print("错误: 找不到模板目录 %s" % TEMPLATE_DIR)
        sys.exit(1)
    # 目录名要能安全地做文件名 —— 其它字符（空格等）会在部署时变成难以引用的路径
    bad = [c for c in name if not (c.isalnum() or c in "_-")]
    if bad:
        print("错误: name 只允许字母 / 数字 / 下划线 / 连字符，非法字符: %s" % "".join(bad))
        sys.exit(1)

    dst_dir = os.path.join(PANELS_DIR, name)
    if os.path.exists(dst_dir):
        print("错误: 目录已存在 %s" % dst_dir)
        print("      （若上次派生到一半失败，先确认里面没东西再手动删掉）")
        sys.exit(1)

    print("从模板派生面板: %s  /  %s" % (name, title))
    if args.dry_run:
        print("（dry-run，未写入）")

    # 模板 → 目标目录的映射（模板文件名里的 PanelTemplate 换成 name）
    mapping = [
        ("PanelTemplate.jsx", name + ".jsx"),
        ("test_PanelTemplate.js", "test_" + name + ".js"),
        ("README.md", "README.md"),
        ("AGENTS.md", "AGENTS.md"),
        ("DEVELOPMENT.md", "DEVELOPMENT.md"),
        ("CHANGELOG.md", "CHANGELOG.md"),
    ]

    if not args.dry_run:
        os.makedirs(dst_dir, exist_ok=True)

    for src_name, dst_name in mapping:
        src = os.path.join(TEMPLATE_DIR, src_name)
        if not os.path.isfile(src):
            print("  跳过（模板缺文件）: %s" % src_name)
            continue
        derive_file(src, os.path.join(dst_dir, dst_name), name, title, args.dry_run)

    if args.dry_run:
        print("dry-run 完成。")
        return

    print("")
    print("派生完成。接着做：")
    print("  ① 写业务: 打开 panels/%s/%s.jsx, 全文件搜「示例」——" % (name, name))
    print("     把那两段示例逻辑换成真实实现; 真实算法放进「纯逻辑层」并补进测试")
    print("  ② python verify.py     # 验收（语法 / 断言 / 部署一致性 / 技术债清单）")
    print("  ③ python install.py    # 部署到 AE（重启 AE 后生效）")
    print("")
    print("⚠️ 模板承载的约定（safeRun 包裹 / pinW 三处写 / 闸门位置 / 版本号三处一致）")
    print("   不是冗余, 注释里写了各自对应的真实事故 —— 别删。见 _template/README.md")


if __name__ == "__main__":
    main()
