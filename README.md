# ROTATION V3 界面与交互

[打开在线图集](https://silvera0218.github.io/Rotatev3-UI-Gallery/)

供美术与交互交接使用。按主页、局内操作、图鉴与规则、通关与补给、商店、失败与复活分类浏览实机截图。点击截图查看入口、按钮作用、状态和动效说明。

截图来自 V3 的独立测试对局，采集视口为 390 × 844，图片保留 2 倍分辨率。截图来源记录在图片元数据和 `data/screens.json` 中。

## 本地预览

```sh
npm ci
npm run build
npm run dev
```

打开 `http://127.0.0.1:5190/`。页面通过 HTTP 读取数据，直接双击 HTML 无法载入图集。

## 更新图集

将新截图放入 `screens/`，更新 `data/screens.json` 对应条目。说明字段遵循 [CONTENT.md](CONTENT.md)，视觉规范见 [DESIGN.md](DESIGN.md)。修改 `src/` 后运行 `npm run build`，将生成的 `assets/app.js` 一并提交。GitHub Pages 从 `main` 分支根目录发布。

`npm test` 使用 Playwright 和本机 Edge，验证桌面、手机、分类筛选、图片查看与 WebGL 回退。可用 `GALLERY_URL` 指定待测站点。

## 第三方资源

- 导航玻璃使用 apple-liquid-glass-webgl，授权见 [LIQUID-GLASS-LICENSE.txt](LIQUID-GLASS-LICENSE.txt)。
- 关闭与翻页图标取自 Tabler Icons，授权见 [TABLER-LICENSE.txt](TABLER-LICENSE.txt)。
- 图集结构参考 [ROTATION V2 UI 图集](https://silvera0218.github.io/Rotatev2-UI-Gallery/)。
