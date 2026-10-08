---
name: ROTATION V3 UI Gallery
description: 实机截图与交互说明的浅色阅读图集
colors:
  action-blue: "#165ec9"
  selected-blue: "#104fae"
  ink: "#213449"
  muted-ink: "#52657b"
  canvas: "#f2f5f9"
  surface: "#f8fafc"
  white: "#fff"
  nav-cool: "#e7eff8"
  nav-light: "#f5f7fa"
  nav-end: "#e7eff4"
  image-ground: "#d7eaf6"
  control-border: "#c9d6e5"
  divider: "#dce5ee"
typography:
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.6
  card-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.6
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.85
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.6
  nav:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  image: "14px"
  control: "12px"
spacing:
  inline: "8px"
  compact: "14px"
  standard: "24px"
  section: "32px"
components:
  filter:
    backgroundColor: "transparent"
    textColor: "#4b6178"
    typography: "{typography.nav}"
    rounded: "15px"
    padding: "10px 22px"
  filter-selected:
    backgroundColor: "{colors.white}"
    textColor: "{colors.selected-blue}"
    rounded: "15px"
    padding: "10px 22px"
  viewer-action:
    backgroundColor: "{colors.white}"
    textColor: "{colors.action-blue}"
    rounded: "12px"
    padding: "8px 14px"
  icon-button:
    backgroundColor: "{colors.white}"
    textColor: "#36506c"
    rounded: "50%"
    width: "44px"
    height: "44px"
  screen-card:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.image}"
    padding: "0"
---
# Design System: ROTATION V3 UI Gallery

## Overview

**Creative North Star: "实机截图索引"**

沿用已确认的 V2 图集视觉：冷浅底色、蓝色控件和完整实机截图。页面服务于美术与交互交接，阅读顺序是筛选类别、查看截图、展开入口与操作说明。

图集使用紧凑的系统字体和可横向滚动的分类栏。截图承担主要视觉内容，动效集中在分类选中面和截图悬停；查看器将截图与说明并排，窄屏改为上下排列。

**Key Characteristics:**

- 实机截图保持完整比例。
- 导航选中状态使用一块移动玻璃面。
- 标题紧凑，说明按入口、操作、状态和动效分节。
- 桌面并排阅读，移动端单区滚动。

## Colors

冷白和浅蓝构成页面与导航底色，深蓝灰文字承担阅读，蓝色标记链接和当前分类。

### Primary

- **操作蓝**（`action-blue`）：链接、翻页按钮文字和键盘焦点。
- **选中蓝**（`selected-blue`）：当前分类的文字。

### Neutral

- **正文墨色**（`ink`）与**说明灰蓝**（`muted-ink`）：区分标题、正文与辅助说明。
- **冷浅画布**（`canvas`）与**查看器白**（`surface`）：页面基础色和弹窗表面。
- **导航浅蓝、导航亮部、导航尾色**（`nav-cool`、`nav-light`、`nav-end`）：分类栏渐变与 WebGL 背景取样使用同一组颜色。
- **图框浅蓝**（`image-ground`）：截图加载区的底色。
- **控件边线**与**分隔线**（`control-border`、`divider`）：圈定操作按钮并分开查看器头尾。

**The Screenshot Rule.** 保留原图比例和完整画面，用边框与背景区分截图和图集。

## Typography

字体栈使用系统界面字体，中文回退到 Microsoft YaHei。该页面属于 Read 模式，使用正文和紧凑标题；没有独立的展示字体角色。

### Hierarchy

- 页面主标题为 23px、750 字重，副标题为 20px、500 字重；窄屏分别降为 20px 与 16px。
- 章节及查看器标题采用 `heading`。窄屏章节标题为 19px，查看器标题为 17px。
- 卡片标题采用 `card-title`，窄屏为 14px；每张图下方留出 13px 间隔再显示标题。
- 交互说明采用 `body`，卡片摘要采用 `caption`；窄屏摘要为 12px。
- 说明分节标题采用 `label`，导航采用 `nav`；选中分类字重提高至 650。
- 查看器总述为 17px、1.8 行高，窄屏为 16px。计数使用等宽数字特性。

**The Read Mode Rule.** 使用现有系统字体与紧凑标题层级，让截图和操作说明占据主要阅读空间。

## Layout

页面通过左右动态留白将内容宽度限制在约 1400px；桌面外边距至少 24px。分类栏保持一行，内容超出时横向滚动。

截图网格自动填充，每列最小 220px，横向间距 24px、纵向间距 32px。视口至少 1500px 时固定为五列；700px 及以下为两列，间距改为纵向 24px、横向 14px，页面左右留白为 16px。卡片在网格行内顶部对齐，文字长度不会移动同排截图的上边缘。

查看器宽度上限 960px、桌面最大高度 94dvh。其阅读区使用 230–330px 图片列和自适应说明列，中间留白 36px。700px 及以下上下排列，图片宽度上限 330px，查看器最大高度 96dvh。图片与说明在同一可滚动区域内，标题和翻页栏留在区域外。

## Elevation & Depth

页面以细边框和浅色底面分层。截图平时带轻阴影，悬停时上移 3px 并加深阴影。查看器使用更宽的柔和阴影，遮罩降低背景亮度并模糊背景。所有阴影均为柔和扩散。

### Shadow Vocabulary

- 导航外框：`0 4px 16px #314c7110`。
- 分类 CSS 选中面：`0 2px 8px #244d7620`。
- 截图图框：`0 5px 16px #21344910`；悬停为 `0 10px 24px #21344920`。
- 查看器：`0 24px 90px #14274445`。

**The Selection Rule.** 玻璃材质用于分类选中面；选中信息始终由 HTML 按钮、文字颜色和 aria-pressed 表达。

WebGL 材质从分类栏自身渐变取样，沿当前按钮的位置和尺寸移动。切换时长为 230ms，采用立方减速；减少动效时立即定位。WebGL 不支持、上下文丢失、减少透明度或强制颜色模式时采用 CSS 选中面。强制颜色模式额外使用系统 Highlight 边线。

## Shapes

截图图框采用 `image` 圆角，图片保持 390:844 比例并完整容纳。导航外壳圆角为 21px，分类按钮和玻璃选中面为 15px。翻页按钮采用 `control` 圆角，关闭按钮为圆形，尺寸为 44px。查看器圆角为 22px，窄屏为 18px，内部原图圆角为 10px。

## Components

### Buttons

翻页按钮使用白底、控件边线和操作蓝文字，内边距为 8px 14px，最小高度为 44px。关闭按钮保持圆形和独立描边，图标采用内联 SVG。按钮与链接的键盘焦点使用 3px 操作蓝描边，外偏移 4px；禁用按钮透明度为 0.4。

### Navigation

分类按钮默认透明底、灰蓝字，内边距为 10px 22px，窄屏横向内边距为 17px。选中后文字变蓝并加粗。CSS 回退使用白色选中面和轻阴影；WebGL 就绪后，由画布绘制选中面，按钮仍提供文字、焦点和点击区域。画布不接收指针事件。

### Screenshot Cards

整张卡片可点击。图框有细描边和轻阴影，标题与摘要直接排在下方。悬停只移动图框，过渡时间为 0.18s；减少动效时停用过渡。卡片沿网格行顶部对齐。

### Image Viewer

原生对话框提供标题、关闭、原图链接和上一张／下一张。说明按入口、操作、状态、动效分节，分节使用浅色水平线。打开时锁定页面背景滚动，查看器阅读区单独滚动。

## Do's and Don'ts

### Do:

- Do 使用真实截图，并保持截图的完整比例。
- Do 为按钮和链接保留可见焦点，为分类保留横向滚动。
- Do 将入口、操作、状态和动效说明与对应截图放在同一查看器内。
- Do 在减少动效、减少透明度和强制颜色模式下保留清晰的选中反馈。

### Don't:

- Don’t 裁切截图以强行填满卡片。
- Don’t 用营销大标题取代紧凑的阅读页标题。
- Don’t 把 WebGL 画布作为按钮或文字的唯一承载层。
- Don’t 把每张卡片的分类重复写成眉题。
