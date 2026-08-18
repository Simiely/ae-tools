# 安装说明（存储路径）

## 支持的版本

- After Effects 2026 中文版（内部版本 26.0）
- 其他版本请自行调整路径中的 `26.0` 版本号

## 安装步骤

1. 退出 After Effects
2. 将 `AE_dashed_grid_shared-edge.jsx` 复制到以下**用户级脚本目录**（推荐，无需管理员权限）：

```
%APPDATA%\Adobe\After Effects\26.0\Scripts\ScriptUI Panels\
```

   Windows 实际路径示例：
   ```
   C:\Users\<你的用户名>\AppData\Roaming\Adobe\After Effects\26.0\Scripts\ScriptUI Panels\
   ```

3. 重新启动 After Effects

## 使用

1. 菜单 **窗口 → 扩展 → 虚线网格生成器**
2. 双击打开一个合成
3. 填好参数（列 / 行 / 宽 / 高 / 线宽 / 虚线 / 间隙）
4. 点 **生成网格**
5. 缩放网格：展开图层的「内容 → 网格组 → 变换」，缩放**组变换**，线宽与虚线间距自动保持

## 常见问题

| 问题 | 说明 |
|---|---|
| 扩展菜单里找不到 | 确认文件在 `ScriptUI Panels\` 子目录（不是 Scripts 根目录），且已重启 AE |
| 提示需要管理员权限 | 该目录是用户级路径，正常无需权限；若被系统拦截，检查路径是否正确 |
| 想删掉 | 删除该 jsx 文件即可，无残留配置 |
