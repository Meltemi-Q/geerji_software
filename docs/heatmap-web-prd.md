## PRD｜报告风格热力图（Web实现）

目标：在不破坏现有代码的前提下，新增一套“复刻 Python 报告风格”的热力图渲染组件（ECharts 方案），实现更清晰、更稳定的视觉效果（蓝-黄-绿-红/固定色域/离散色阶/等高线/掩膜），保持与现有坐标与底图对齐。

### 一、范围与依赖
- 范围：新增组件与工具，训练模式内可切换渲染方案；不改动现有 D3 Canvas 代码。
- 依赖：ECharts（项目已包含）、可选 d3-contours（计算等高线）、Web Worker（前端后台线程，可选）。

### 二、功能列表
- 功能1：热力图渲染（报告风格）
  - 1.1 网格构建：在线模式默认 120×120，可配置（80–200）。
  - 1.2 插值计算：IDW（加通道质量权重）；支持半径 R 或 K 近邻。
  - 1.3 平滑处理：高斯平滑（分离核，一维两次）。
  - 1.4 掩膜裁切：头部/前额区域掩膜；边缘平滑过渡。
  - 1.5 颜色映射：固定色域；蓝-黄-绿-红（如 Spectral/RdYlGn/Rainbow）；支持 7/9/11 级离散。
  - 1.6 等高线叠加：10–12 条等值线；可开关；半透明填充或线框。
  - 1.7 颜色条：固定刻度与标签；单位/零点标识。

- 功能2：通道筛选与权重
  - 2.1 距离过滤：仅使用物理距离在 [25, 35] mm（默认）范围的通道。
  - 2.2 质量权重：SNR/SCI/耦合（可选）；形成通道权重 w_q(i)。
  - 2.3 邻域策略：半径 R 或 K 近邻（默认 K=16）；预计算近邻表。
  - 2.4 更新节奏：权重/集合 2–5s 更新一次；逐帧仅更新数值，避免闪烁。

- 功能3：性能与稳定性
  - 3.1 计算迁移：插值/平滑在 Web Worker 执行（可选，默认开启）。
  - 3.2 预计算：建立网格近邻表（或 KD-Tree）以 O(G×K) 计算。
  - 3.3 更新节流：500–1000ms/帧；窗口变更时重建网格与近邻。
  - 3.4 绘制优化：ECharts progressive/合批；仅更新数据数组。
  - 3.5 退化路径：异常时回退到当前 D3 Canvas 渲染。

- 功能4：UI/交互
  - 4.1 渲染模式切换：报告风格（ECharts）/ 现有 D3 Canvas。
  - 4.2 颜色域模式：固定域/滑动全局域（二选一）。
  - 4.3 显示开关：等高线/通道点/掩膜/颜色条。
  - 4.4 工具提示：鼠标悬停显示插值值与近邻通道数（可选）。

- 功能5：集成与兼容性
  - 5.1 新增组件：`src/components/training/modes/heatmap/HeatmapReportStyleView.vue`（ECharts版）。
  - 5.2 坐标对齐：继续使用 `HeatmapCoordinator` 计算容器像素边界；保持与大脑底图对齐。
  - 5.3 数据来源：沿用 `TriangleDataProcessor` 输出的 `channelPositions/layoutDimensions` 与 `props.hboData`。
  - 5.4 并存不冲突：不修改 `BrainModeView.vue` 内现有 D3 路线；父级可根据开关决定挂载哪一个组件。
  - 5.5 配置透传：通过 props 统一传入参数；支持运行时更新。

- 功能6：12-node 覆盖背景层（介于底图与热力图之间）
  - 6.1 数据来源：`fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json`（使用 `docks[*].optodes[*].coordinates_2d` 与 `dimensions.dimensions_2d`）。
  - 6.2 构型算法：以全部 optode 2D 点计算外轮廓（优先 concave hull；若不可用则 convex hull 并外扩 3mm）。
  - 6.3 坐标映射：Triangle(mm) → 像素(px)，与热力图一致（含 Y 轴翻转），在容器尺寸变化时重算并更新。
  - 6.4 层级顺序：底层=大脑图片；中间层=12-node 覆盖多边形；顶层=热力图（Canvas/SVG）。
  - 6.5 颜色规范：覆盖多边形填充色=“热力图颜色条的中心色”（当前 colorMap 的中点）；不透明度默认 0.6；描边 1.5px、圆角（linejoin/linecap=round），描边色为中心色的浅亮变体（alpha≈0.2）。
  - 6.6 显示开关：支持一键启用/禁用覆盖层；默认启用。

### 三、配置参数（Props/Options）
- gridSize：number（默认 120）
- interpolation: 'idw' | 'rbf'（默认 'idw'）
- kNeighbors：number（默认 16）或 radiusMm：number（默认 15）
- gaussianSigma：number（默认 2.0）
- colorMap：'Spectral' | 'RdYlGn' | 'Rainbow' | 'Jet'（默认 'Spectral'）
- valueDomain：{ min: -0.05, max: 0.05 }（固定域，必填/默认）
- discreteLevels：number（默认 9）
- showContours：boolean（默认 true）；contourLevels：number（默认 10）
- showColorbar：boolean（默认 true）
- showChannels：boolean（默认 false）
- useWorker：boolean（默认 true）
- updateIntervalMs：number（默认 500）
- overlayEnabled：boolean（默认 true）
- overlayFollowColorMap：boolean（默认 true，使用色条中心色）
- overlayOpacity：number（默认 0.6）
- overlayStrokeWidth：number（默认 1.5）
- overlayEdgeBufferMm：number（默认 3）
- overlayHullType：'concave' | 'convex'（默认 'convex'）

### 四、数据契约
- 输入：
  - channelPositions：Array<{ position: [x_mm, y_mm], ... }>（Triangle 2D，mm）
  - layoutDimensions：{ x: mm, y: mm }
  - hboValues：number[]（长度与 channelPositions 一致）
- 覆盖层输入：
  - fullLayout：`fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json`
  - optodePoints2D：从 fullLayout 提取的全部 `coordinates_2d`
- 输出（到渲染层）：
  - gridValues：Float32Array( gridSize×gridSize )（NaN 代表掩膜外）
  - contours：路径/多边形数据（可选，基于 d3-contours）
  - overlayPolygon：SVG points 字符串或路径数据（随容器尺寸动态更新）

### 五、性能预算（在线模式）
- 目标：500–1000ms/帧（含计算与绘制）。
- 估算：G=120×120=14,400；K=16 → ~23 万乘加/帧 + 分离高斯；Worker 内几十毫秒级。
- 内存：grid ~ 60–100KB；近邻/权重缓存 MB 级，可控。

### 六、验收标准（关键指标）
- 视觉：
  - 固定色域渲染，连续多帧颜色稳定，无明显“跳色”。
  - 蓝-黄-绿-红色谱，分区与层次清晰；等高线与色条正确。
  - 掩膜裁切正确，无越界涂抹；通道可选显示。
  - 覆盖层：多边形边界与 fullLayout 点云外轮廓一致；填充色与当前 colorMap 中心色一致（允许 ≤5% 色差）；叠放顺序正确（位于底图与热力图之间）。
- 性能：
  - 1920×1080 环境：在线模式默认配置下 ≥ 1fps（建议 2fps）；UI 不卡顿。
  - 尺寸变化后 200ms 内完成重建并恢复更新。
- 稳定：
  - 异常输入（NaN/空值/缺通道）能容错并退化渲染。

### 七、非功能要求
- 不修改/不破坏现有 D3 Canvas 路线；并存可切换。
- 代码模块化、可测试；参数集中管理；默认参数合理。
- 错误日志最小化噪声；关键路径加边界检查。

### 八、目录与交付物

### 九之二、图层结构与坐标系统（统一规范）

- 图层结构（自下而上）：
  - 底层：大脑图片（background image）。
  - 中间层：12-node 覆盖区域（来自 `fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json` 计算外轮廓，缺数据或 dock=0 时用当前色条中心色填充，描边为中心色浅亮变体）。
  - 顶层：热力图/通道点（基于实时 SDK 数据插值渲染，或显示通道散点）。

- 坐标源与一致性：
  - 热力图坐标使用 `fnirs_sdk/config/device_profiles/triangle/layout.json` 的 Triangle 2D(mm) 作为统一基准，用于确定渲染网格与布局边界。
  - 12-node 覆盖层坐标来源 `renumbered_full_layout.json`，提取全部 optode 的 `coordinates_2d`（mm）计算外轮廓（优先凹壳，兜底凸包，并外扩约 3mm），该多边形与热力图共享同一 mm→像素 映射（等比缩放 + 居中偏移 + Y 轴翻转），确保三层严格对齐。

- 坐标系定义（Triangle 2D）：
  - 原点在左下角（x_min, y_min）。
  - x 轴向右增大，y 轴向上增大（mm）。
  - 映射到像素时，先以 layout 宽高计算 scale = min(W/Lx, H/Ly)，再计算 offsetX/Y，使内容在容器内等比居中；像素坐标中 y 需翻转（上为大）以契合屏幕坐标。

- ECharts 配置（隐藏坐标轴）：
  - 主图采用类目轴并隐藏：xAxis/yAxis `type: category`，`data: [0..gridSize-1]`，`show: false`，`yAxis.inverse: true`。
  - 热力图数据使用三元组 `[xIndex, yIndex, value]`，只更新 series；坐标轴不随帧变化。
  - 覆盖层通过网格索引坐标绘制（custom polygon），或在数据生成时对覆盖层外网格置 NaN 进行预裁切。

- 无数据时的呈现：
  - 若 channel 数为 0 或未达最小阈值，只显示中间层覆盖区域（填充为色条中心色），颜色条仍展示固定刻度。

- 新增文件：
  - `src/components/training/modes/heatmap/HeatmapReportStyleView.vue`
  - `src/utils/heatmap/interpolation/idw.js`
  - `src/utils/heatmap/maskUtils.js`
  - `src/utils/heatmap/colorMaps.js`
  - `src/workers/heatmapWorker.js`（可选，含插值/平滑/等高线计算）
- 文档：更新 `docs/heatmap-renderer-architecture.md` 补充新路线说明。

### 九、实施里程碑（建议）
- M1：骨架与集成（新组件挂载、容器对齐、ECharts 基础热力图显示）
- M2：插值/平滑/掩膜（Worker 计算、网格+高斯+掩膜）
- M3：视觉强化（固定色域、离散色阶、色条、等高线）
- M4：通道权重与邻域（距离过滤、K 近邻、权重缓变）
- M5：参数面板与稳定性（开关/参数热更新、异常与退化）

### 十、说明
- “Web Worker”指浏览器的后台线程，用于把重计算从主线程（UI）挪走，避免卡顿；不涉及后端。


### 十一、阈值与降级策略（按 node 与有效通道）
- 术语说明：一个 node 含 3 个光源（双波长各 3）+ 4 个检测器，可形成约 24 个通道；不同设备定义略有差异。

- 按 node 数：
  - ≤1 个 node：默认通道级视图（圆斑/小范围径向渐变），禁用全局插值。
  - 2 个 node：默认通道级或“局部示意插值”（仅在两组通道的凸包/缓冲掩膜内插值），须显示通道点与“示意插值”提示，关闭等高线。
  - ≥3 个 node：可启用全局插值，但需做覆盖度检查（通道分布凸包面积/目标区域面积达到阈值，如 ≥40%）。
  - ≥4 个 node：全局插值基本稳定；启用固定色域+离散色阶；可开启等高线。
  - ≥6 个 node：完整“报告风格”（固定色域、离散色阶、等高线、颜色条）稳妥。

- 按“有效通道数”（通过质量筛且在合理距离内）：
  - <4：禁止插值，仅通道级视图。
  - 4–7：仅“示意插值”；grid 60–80，gaussianSigma 3.0–4.0，关闭等高线，显示通道点与提示语。
  - ≥8：允许插值，建议固定色域+离散色阶。
  - ≥12：建议开启等高线（10–12 条）。

- 自适应邻域与稀疏兜底：
  - 候选通道“全量参与”，采用质量权重 w_q(i)×距离权重 w_d(i,p) 做加权平均，避免“一刀切剔除”。
  - 每网格点设最小近邻数 K_min（如 8）；不足则自动扩大半径或退回全局 KNN。
  - 稀疏场景降密 grid、增大 σ；必要时切换 RBF/薄板样条以获得更平滑的面。
  - 稀疏时强制显示通道点，并使用头部/前额掩膜裁切 + 边缘平滑过渡。

### 十二、视觉对齐与验收细则（对标 Python 报告）
- 颜色与数值域：固定色域（如 HbO [-0.05, +0.05]，可配置），色谱用 Jet 或 Spectral/RdYlGn（蓝-黄-绿-红），离散 9/11 级，带刻度的颜色条。
- 插值方法：IDW + K=16 或 RBF/薄板样条（更接近 scipy.griddata cubic 的质感）。
- 网格密度：在线 120×120；离线/报告 150×150。
- 平滑与掩膜：分离高斯 σ≈2.0–3.0；头部/前额掩膜 + 边缘平滑。
- 等高线：10–12 条；node≥4 时开启。
- 对齐验收：选同一帧（或时间窗均值），Web 与 Python 报告并排对比；要求色阶分布、分区边界与总体观感一致（允许细微纹理差异）。

### 十三、不同节点规模的默认参数建议
- 2 个 node（局部示意为主）：
  - gridSize 60–80，K=8–12 或 R=20–30mm，gaussianSigma 3.0–4.0，showContours=false；显示通道点与“示意插值”提示。
- 3–4 个 node（可全局，先稳）：
  - gridSize 100–120，K=12–16，R≈15–25mm，gaussianSigma 2.5–3.0；等高线按覆盖度按需开启。
- ≥6 个 node（完整报告风格）：
  - gridSize 120（在线）/150（离线），K=16，R≈15mm，gaussianSigma 2.0，showContours=true（10–12 条）。


