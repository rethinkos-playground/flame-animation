# Flame Animation 🔥

基于 **TypeScript + Three.js** 的交互式程序化火焰动画。

🔗 **在线预览**: https://rethinkos-playground.github.io/flame-animation/

## 功能

- GLSL FBM 噪声驱动的火焰形态，实时上升、摇曳、闪烁
- 上升的火星粒子（自定义 Points shader）
- 可调节火焰**颜色**（取色器 + 5 个预设色）
- 可调节火焰**大小**与燃烧速度
- 响应式布局，移动端适配

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查 + 生产构建（输出到 dist/）
npm run preview  # 预览构建产物
```

## 部署

推送到 `main` 分支后，GitHub Actions（`.github/workflows/deploy.yml`）会自动构建并部署到 GitHub Pages。

## 技术栈

- [Three.js](https://threejs.org/) — 渲染
- [Vite](https://vite.dev/) — 构建
- TypeScript（strict 模式）