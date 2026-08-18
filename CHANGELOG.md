# 更新日志（CHANGELOG）

## v1.0.2（当前版本）

- 新增 **Rolling Lyrics V2**（`panels/AE-Rolling-Lyrics-V2/`）：滚动句数 1/2/3 句一起滚动 + 组内行间距；v1（`panels/AE-Rolling-Lyrics/`）冻结不动
- README 自写插件表补 V2 行；修正 MountainSpectrum 残留行

## v1.0.1

- MountainSpectrum 内容清理出主目录，标注「待开发」（WIP），暂不部署/安装
- 源码保留在 `D:\workbuddy\2026-08-12-17-14-47\ae-scripts\MountainSpectrum.jsx`，待开发完成后再纳入

## v1.0.0

- 建立 ae-tools monorepo：整合 8 个自写 AE 插件（TimeAxisIndent / AE-Dashed-Grid-Generator / AE-Water-Rise-Generator / MountainSpectrum / AE-Rolling-Lyrics / AE-Lyrics-Animator / AudioScale / starry-sky-generator）
- 收集脚本 asu_NudgeKeyFrames.jsx（外部免费脚本，sundstedt.se）归入 `third-party/scripts/`，与自写插件严格分离
- `install.py` 一键部署器：自动检测 AE 版本、补 UTF-8 BOM、逐字节校验
- 四件套文档建立（README / AGENTS / DEVELOPMENT / CHANGELOG）
- 去重：TimeAxisIndent / RollingLyrics 以 AE 实际运行版本为准
