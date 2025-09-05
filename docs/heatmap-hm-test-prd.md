## PRD｜/hm 对齐与布局测试页（报告风格热力图，前视方向，无颜色条）

目标：新建一个专用测试页面 `/hm`，快速验证并校准“大脑图片 / 实际 node 分布（三角）/ 完整 12-node 布局 / 热力图”的三者对齐与分层。页面不显示颜色条，采用“正面（前视）”方向展示，便于通过 Playwright MCP 截图精确比对定位问题。

### 一、范围
- 新增一个前端测试页路由 `/hm`（或独立 html 页面 `public/hm.html`，二选一，推荐路由实现）。
- 仅用于对齐与布局验证：不影响现有训练视图代码，不显示颜色条。
- 复用现有数据源与坐标：`fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json`、Triangle(mm) → px 映射、`HeatmapCoordinator` 对齐策略（必要时内嵌等效计算）。

- 分层顺序（从下到上）：
  1) 界面背景（页面底色/背景图）
  2) 大脑图片（现有 `brain_no_bg.png`）
  3) 完整 12-node 布局背景（所有 optode 2D 点的外轮廓多边形 + 关键点/连线）
  4) 热力图（报告风格网格插值，无颜色条）
  5) 实际 node 分布（最上层，三角 5-4-3 布局的通道/optode 点）
- 方向：正面（前视），坐标 y 轴向上（或与现有热力图一致的视觉翻转），三层的 mm→px 映射严格一致。

### 三、数据与坐标
- 数据来源：
  - 完整布局：`fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json` 的 `docks[*].optodes[*].coordinates_2d` 和 `dimensions.dimensions_2d`。
  - 实际 node/通道：沿用 `TriangleDataProcessor` 计算的中点/通道坐标（mm）。
- 坐标变换：Triangle(mm) → 容器 px，按 `layoutDimensions` 做线性缩放；y 轴翻转与否与现有热力图一致；位置/尺寸由 `HeatmapCoordinator` 的像素边界计算（等价逻辑）决定。

### 四、功能列表
- 功能1：完整 12-node 布局背景
  - 1.1 外轮廓：使用凸包（可选凹包），外扩 3mm，填充为“色条中心色的浅色变体 + 0.25~0.35 透明度”，描边 1.25px，圆角。
  - 1.2 点/连线：按 docks 顺序绘制 optode 点（小圆点）与连线（可选），弱化样式，便于观察背景轮廓。
  - 1.3 自适应：容器尺寸变更时，mm→px 重算，保持与上层元素严格对齐。

- 功能2：大脑图片（中层）
  - 2.1 采用现有 `brain_no_bg.png`，由 `HeatmapCoordinator` 等效逻辑计算像素位置与尺寸。
  - 2.2 禁止指针事件，透明背景，确保与背景/热力图叠放正确。

- 功能3：实际 node 分布（三角形 5-4-3 布局）
  - 3.1 渲染 optode/通道点：小尺寸高对比点；可选显示通道中点与索引标签（开发开关）。
  - 3.2 与背景轮廓严格对齐，便于肉眼校核“背景布局 vs 实际分布 vs 大脑图片”。

- 功能4：热力图（报告风格，无颜色条）
  - 4.1 网格插值：IDW（K=16 或 R=15mm），网格 120×120，分离高斯 σ≈2.0，掩膜为前额/头部区域。
  - 4.2 颜色：固定色域（默认 HbO [-0.05, 0.05]），蓝-黄-绿-红（Spectral/RdYlGn 任一），离散 9 级；不显示颜色条。
  - 4.3 等高线：10 级，默认开启；线宽 1px，圆角，半透明白。

- 功能5：交互开关（仅页内调试）
  - 5.1 显示/隐藏：完整 12-node、实际 node、热力图、等高线。
  - 5.2 方向/对齐：切换 y 轴翻转、偏移/缩放微调（±2%）、旋转（±5°）做快速校准。
  - 5.3 透明度：背景层与热力图透明度滑杆（0.2~0.9）。

### 五、无颜色条规范
- 本页不显示颜色条，仅固定域 + 离散色阶；中心色由色谱中点确定，并用于 12-node 背景填充基色（浅色透明变体）。
- 注：主训练视图中若使用颜色条，需将颜色条置于“热力图上方（上沿靠内）”，高度 16–20px、三到五档刻度（含 0 中心刻度），中心色与本页一致。

### 六、路由与页面结构
- 路由：`/hm`（推荐）。若无路由，可放 `public/hm.html`，通过脚本直接引用 ECharts 与布局 JSON。
- 结构：容器内 4 层（SVG/Canvas/ECharts）分层实现，z-index 明确：背景(0) < 大脑图片(1) < 实际 node(2) < 热力图(3)。

### 七、对齐验收（关键）
- 肉眼验收：
  - 背景 12-node 外轮廓与实际 node 分布边界高度一致；
  - 大脑图片与 node 群体位置匹配（前额区域重叠自然）；
  - 热力图热点与通道密集区域相符；
- 像素级容差：
  - 背景外轮廓与实际最外层 optode 的包围误差 ≤ 6px（1080p）；
  - mm→px 线性映射误差（抽查 6 点）≤ 1.5%；

### 八、Playwright MCP 自动化测试
- 用例1：加载与可见性
  - 步骤：打开 `/hm`，等待 4 层元素可见（选择器断言）。
  - 截图：全屏保存，命名 hm-01-loaded.png。
  - 断言：层级顺序正确（z-index/DOM顺序），颜色条不存在。
- 用例2：对齐校验
  - 步骤：切换“仅背景+实际 node”，截图 hm-02-overlay-nodes.png。
  - 断言：实际 node 的外接矩形与背景外轮廓的差值 ≤ 6px（脚本读取 DOM bbox 对比）。
- 用例3：方向/翻转
  - 步骤：切换 y 翻转，截图 hm-03-flipY.png。
  - 断言：翻转前后，node 与背景依旧严格重合（几何一致性）。
- 用例4：热力图叠加
  - 步骤：开启热力图+等高线，截图 hm-04-heatmap.png。
  - 断言：无颜色条，等高线存在，series 数量包含 heatmap/custom(contours)。

### 九、参数与默认值（测试页）
- gridSize=120，kNeighbors=16（或 radiusMm=15，二选一），gaussianSigma=2.0
- valueDomain={min:-0.05,max:0.05}，colorMap='Spectral'，discreteLevels=9，showContours=true
- overlayOpacity（12-node 背景）=0.3；nodesVisible=true；heatmapOpacity=0.8
- flipY=false（正面方向，如需调整可切换）；rotation=0；scale=1.0

### 十、实现拆解
- 任务1：新增路由/页面骨架 `/hm`（或 `public/hm.html`）
  - 1.1 容器与层级 DOM；
  - 1.2 加载 full layout JSON 与 brain 图；
- 任务2：mm→px 映射与对齐
  - 2.1 参照 `HeatmapCoordinator` 计算容器 bounds；
  - 2.2 提供 flip/offset/scale/rotation 开关。
- 任务3：完整 12-node 背景层
  - 3.1 hull 计算（凸包+外扩3mm）；
  - 3.2 点/连线绘制与样式；
- 任务4：实际 node 分布层
  - 4.1 optode/通道点显示；索引标签（开关）。
- 任务5：热力图层
  - 5.1 IDW 网格 + 高斯平滑 + 掩膜；
  - 5.2 等高线生成；
  - 5.3 无颜色条的视觉方案；
- 任务6：Playwright MCP 测试脚本
  - 6.1 导航、等待、截图；
  - 6.2 bbox 对齐断言；
  - 6.3 保存至 `test_screenshots/hm/*.png`。

### 十一、非功能与性能
- 500–1000ms/帧（若加载实时数据）；单帧静态渲染 < 150ms。
- 代码模块化：背景/node/热力图独立模块，便于移植回训练视图。


