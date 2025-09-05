## 热力图渲染实现思路（架构说明）

本文概述当前训练模式下的大脑热力图实现思路，聚焦架构、数据流、渲染策略与所用技术，不展开具体代码。

### 目标与适用场景
- **目标**: 在大脑底图之上，实时、清晰地渲染 fNIRS 通道级 HbO/HbR 活动，兼顾清晰度与性能。
- **场景**: 训练视图的实时热力图展示（`BrainModeView.vue`），每 ~500ms 更新一次。

### 技术栈与依赖
- **渲染**: 原生 Canvas 2D（通过 D3 进行少量工具支持）
- **可选**: `d3-contour` 用于等高线生成（当前默认未启用）
- **框架**: Vue 3 组件化组织、响应式协调与生命周期管理

### 总体架构（职责分离）
- **Triangle 数据处理（位置/布局）**: `TriangleDataProcessor`
  - 解析 `/public/config/triangle_layout.json`，得到光源、检测器与通道中点坐标（单位：mm），并提供布局边界 `layoutDimensions`。
- **坐标与位置协调（UI 对齐）**: `HeatmapCoordinator`
  - 依据大脑底图图片与容器的 DOM 尺寸，计算热力图容器在页面中的像素边界；负责窗口缩放/滚动的响应式更新。
- **渲染器（绘制像素）**: `D3HeatmapRenderer`
  - 主路径使用“通道级径向渐变扩散”的 Canvas 叠加法（每通道一个径向渐变圆形），强调通道清晰度与平滑过渡。
  - 保留 IDW 网格插值与等高线的生成能力（可选路径）。

### 数据流（从输入到像素）
1) 外部传入 `props.hboData`（或内部模拟），在 `BrainModeView.vue` 中标准化为数值数组。
2) `TriangleDataProcessor` 产出 `channelPositions`（mm）与 `layoutDimensions`（mm）。
3) `HeatmapCoordinator` 计算热力图容器的像素边界，并驱动 `D3HeatmapRenderer.initializeSVG(width,height)` 创建绘图 Canvas。
4) 周期性调用 `D3HeatmapRenderer.render(hboValues)` 完成当帧渲染。

### 坐标体系与单位换算
- **Triangle 坐标（mm）** → **Canvas 像素（px）**：
  - X: `(mmX / layoutBounds.x) * canvasWidth`
  - Y: `canvasHeight - (mmY / layoutBounds.y) * canvasHeight`（Y 轴翻转以匹配视觉坐标）
  - 渐变半径（px）由影响半径（mm）按比例换算。

### 渲染策略：通道级径向渐变扩散
- 对每个通道，在其像素位置创建一个径向渐变圆：中心高不透明，向外渐变降低不透明度（典型 alpha: 1.0 → 0.8 → 0.48 → 0.15）。
- 合成模式使用 `source-over`，多通道在边缘区自然混合，中心保持清晰。
- 每帧根据当前数据动态计算 `valueRange = max(|min|, |max|)`，将通道值归一化到 [-1, 1]，再映射到红蓝双向色谱（RdBu 风格）。

### 颜色映射与动态域
- 归一化后通过自定义的 RdBu 近似映射函数转为 RGB。
- 动态域每帧更新，保证不同强度范围下颜色分布始终占满色域，增强可辨性（如需固定色域可切换为全局域）。

### 可选路径：IDW 网格与等高线
- 提供 `calculateIDWValue` 与 `generateGridData` 生成规则网格的插值值，结合 `d3-contours` 生成等高线层级并绘制。
- 目前默认不走该路径（主路径是 Canvas 渐变叠加），如需展示等高线可在渲染容器中增加 SVG 层并调用对应接口。

### 性能与响应式
- **性能**: Canvas 逐通道绘制开销稳定，alpha 渐变叠加成本可控；每帧 O(通道数)。
- **响应式**: 监听图片加载、窗口尺寸与滚动变化，实时重新计算容器像素边界并重建 Canvas 尺寸以保持严密贴合。
- **更新节奏**: 训练视图默认每 ~500ms 刷新一次。

### 配置项要点（示例）
- **influenceRadius（mm）**: 通道扩散半径，影响平滑度与清晰度的权衡。
- **gridSize（整数）**: 供 IDW/等高线使用的网格密度（主路径不敏感）。
- **idwPower**: IDW 插值幂指数（等高线可选路径）。
- **colorScale/色域**: 可切换动态域或固定域策略。

### 主要文件与职责
- `src/components/training/modes/BrainModeView.vue`：初始化/更新循环、数据清洗、与渲染器对接。
- `src/components/training/modes/heatmap/TriangleDataProcessor.js`：解析 Triangle 配置，产出通道坐标与布局边界（mm）。
- `src/components/training/modes/heatmap/HeatmapCoordinator.js`：计算热力图容器像素位置与尺寸，提供响应式更新。
- `src/components/training/modes/heatmap/D3HeatmapRenderer.js`：Canvas 主渲染器（通道级径向渐变），保留 IDW+等高线能力。
- `public/config/triangle_layout.json`：Triangle 硬件布局配置（数据来源）。

### 集成与调用关系（训练模式）
1) 视图创建时：
   - `TriangleDataProcessor.processTriangleData()`
   - `HeatmapCoordinator.setLayoutBounds(layoutDimensions)`
   - `new D3HeatmapRenderer(container, config)` → `setChannelData(channelData)` → `initializeSVG(w,h)`
2) 周期刷新：
   - 标准化 `props.hboData` → `renderer.render(hboValues)`
3) 响应式：
   - 尺寸/位置变化 → 重新计算 bounds → `initializeSVG(newW,newH)` → `render(...)`

### 可扩展方向
- 叠加 SVG 等高线层（在 Canvas 之上）用于高级分析或报告。
- 固定色域/阈值掩膜/异常点标注等可视化增强。
- WebGL 加速与更大通道规模的优化（备用实现见 `src/utils/heatmap/FNIRSHeatmapRenderer.js`）。


