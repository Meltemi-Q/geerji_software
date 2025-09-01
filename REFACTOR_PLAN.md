# 代码重构计划与功能清单

## TrainingView.vue 功能清单 (3392行)

### 📋 核心功能模块

#### 1. 显示模式管理 (Mode Management)
- **专业大脑模式** (`brain`): 3D大脑热力图显示，支持真实optodes数据加载
- **传统热力图模式** (`heatmap`): HbO/HbR双热力图显示
- **数据曲线模式** (`curve`): ECharts时间序列曲线图，支持缩放重置
- **交互游戏模式** (`game`): 异步加载GameComponent，性能优化

#### 2. 热力图渲染系统 (Heatmap Rendering)
**专业大脑模式相关**:
- `loadOptodesData()`: 加载真实optodes映射数据
- `parseOptodesData()`: 解析JSON为HeatmapRenderer格式
- `calculateChannelMidpoints()`: 计算source-detector通道中点
- `createBrainHeatmap()`: 创建大脑热力图实例
- `updateBrainHeatmap()`: 实时更新热力图数据
- `drawBrainBackgroundOnce()`: 绘制大脑背景图片
- `drawHeatmapOverlay()`: 覆盖热力图到大脑图像

**传统热力图相关**:
- `createContinuousHeatmap()`: 创建连续热力图
- `updateHeatmaps()`: 更新HbO/HbR热力图
- `flipHeatmapData180()`: 180度翻转数据处理

**Triangle布局系统**:
- `loadTriangleLayoutData()`: 加载Triangle布局数据
- `parseTriangleLayoutForHeatmap()`: 解析Triangle数据
- `createTriangleFnirsInfo()`: 创建Triangle布局信息
- `generateTriangleChannelValues()`: 生成Triangle通道数值

#### 3. 数据可视化 (Data Visualization)
**ECharts集成**:
- `createCurveChart()`: 创建曲线图实例
- `initCurveChart()`: 初始化曲线图配置
- `updateCurveData()`: 实时更新曲线数据点
- `resetCurveZoom()`: 重置图表缩放

**统计分析**:
- `updateBrainStats()`: 更新大脑活跃度统计
- `generateBrainActivityReport()`: 生成大脑活动报告
- `createStaticBrainReport()`: 创建静态分析报告

#### 4. 设备状态管理 (Device Management) 
**设备连接**:
- 康助侠设备状态监控
- fNIRS设备状态显示
- 紧急停止按钮
- 连接/断开设备控制

**状态显示**:
- `getKangzhuxiaStatusColor()`: 获取设备状态颜色
- `getKangzhuxiaStatusText()`: 获取设备状态文本
- `getMotionStatusText()`: 获取运动状态文本

#### 5. 训练控制 (Training Control)
**训练操作**:
- 开始训练 (`start-training`)
- 暂停训练 (`pause-training`) 
- 停止训练 (`stop-training`)
- 紧急停止 (`emergency-stop`)

**时间管理**:
- 训练时长显示
- 实时时间更新
- 持续数据记录

#### 6. UI响应式系统 (Responsive UI)
**布局适配**:
- `handleResize()`: 窗口大小变化处理
- 大屏幕布局优化
- Canvas尺寸自适应

**数据格式化**:
- `formatValue()`: 数值格式化显示
- `formatDuration()`: 时长格式化
- `formatPercentage()`: 百分比格式化

#### 7. 配置系统 (Configuration)
**外部配置加载**:
- 支持`/heatmap_renderer_config.json`外部配置
- 默认配置fallback机制
- 热力图渲染参数可配置

**性能优化**:
- GameComponent异步加载
- optodes数据缓存机制
- 按需初始化各模式组件

### 🔧 技术特性

#### 数据流管理
- Vue 3 Composition API
- 响应式数据绑定
- Props/Emits事件系统

#### 第三方集成
- **D3.js**: 数据可视化支持
- **ECharts**: 专业图表库
- **HeatmapRenderer**: 自定义热力图引擎

#### 文件结构分析
- **模板部分**: ~300行 (UI布局)
- **脚本部分**: ~2200行 (核心逻辑)
- **样式部分**: ~800行 (CSS样式)

### ⚠️ 代码复杂度问题

#### 1. 单一职责原则违反
- 一个文件包含4种不同的显示模式
- 热力图渲染、数据处理、UI控制混合
- 设备管理与数据可视化耦合

#### 2. 函数过长问题
- `parseTriangleLayoutForHeatmap()`: ~60行
- `drawHeatmapOverlay()`: ~200行
- `createContinuousHeatmap()`: ~80行

#### 3. 状态管理复杂
- 多种数据状态混合管理
- 模式切换逻辑分散
- 初始化顺序依赖复杂

---

## ObelabTrainingView.vue 功能清单 (1535行)

### 📋 核心功能模块

#### 1. Obelab专业界面设计
- **品牌标识**: Golgi近红外脑氧监测系统专业界面
- **患者信息**: 右上角显示患者姓名、年龄、训练时长
- **专业布局**: 左侧模式选择、中间可视化、右侧控制面板

#### 2. 显示模式管理 (Mode Switching)
- **专业大脑模式** (`brain`): 带专用颜色条的大脑热力图
- **传统热力图模式** (`heatmap`): HbO/HbR双热力图
- **数据曲线模式** (`curve`): ECharts曲线图
- **交互游戏模式** (`game`): 游戏化训练界面

#### 3. 大脑热力图核心 (Brain Heatmap System)
**核心函数**:
- `initBrainHeatmap()`: 初始化专业大脑热力图
- `createBrainHeatmap()`: 创建大脑热力图实例
- `drawHeatmapOverlay()`: 绘制热力图覆盖层
- `initializeHeatmapData()`: 初始化热力图数据

**Triangle布局集成**:
- `loadTriangleLayoutData()`: 加载Triangle设备布局
- `parseTriangleLayoutForHeatmap()`: 解析布局数据
- `createTriangleFnirsInfo()`: 创建fNIRS信息结构
- `generateTriangleChannelValues()`: 生成Triangle通道数值

#### 4. 训练控制系统 (Training Controls)
**训练操作**:
- 开始训练按钮 (`start-training`)
- 暂停训练按钮 (`pause-training`)
- 停止训练按钮 (`stop-training`)
- 紧急停止按钮 (`emergency-stop`)

**设备管理**:
- 康助侠连接/断开控制
- 设备状态实时显示
- `getKangzhuxiaStatusText()`: 设备状态文本

#### 5. 配置与优化 (Configuration & Performance)
**外部配置支持**:
- 支持`/heatmap_renderer_config.json`配置文件
- HeatmapRenderer参数可配置
- 默认配置fallback机制

**性能优化**:
- Vue 3 Composition API
- 响应式数据管理
- 模式切换时的智能初始化

#### 6. 数据处理 (Data Processing)
**格式化工具**:
- `formatValue()`: 数值格式化
- `formatDuration()`: 时长格式化
- `generateMockChannelValues()`: 模拟数据生成

**布局坐标处理**:
- `normalizeCoordinate()`: 坐标标准化
- Triangle到Canvas坐标转换
- 多设备适配支持

### 🔧 技术特性
- **专业医疗界面**: Obelab风格设计
- **模块化架构**: HeatmapRenderer集成
- **响应式设计**: 适配不同屏幕尺寸
- **配置化**: 外部配置文件支持

---

## AssessmentView.vue 功能清单 (1303行)

### 📋 核心功能模块

#### 1. 评估报告界面 (Assessment Report UI)
- **四象限布局**: 左上曲线、右上评估、左下热力图、右下建议
- **Obelab品牌界面**: 专业医疗系统标识
- **训练完成状态**: 会话状态显示

#### 2. 时间序列可视化 (Time Series Visualization)
**训练时间曲线**:
- `createTimeCurve()`: 创建ECharts时间曲线图
- `generateTimeSeriesData()`: 生成时间序列数据
- HbO/HbR双曲线显示
- 训练全程血氧数据变化

#### 3. 大脑热力图评估 (Brain Heatmap Assessment)
**专业大脑可视化**:
- `createBrainHeatmap()`: 创建评估用大脑热力图
- `loadOptodesData()`: 加载optodes布局数据
- `parseOptodesData()`: 解析设备数据格式
- `drawBrainBackgroundOnce()`: 绘制大脑背景图
- `drawHeatmapOverlay()`: 绘制训练平均热力图

**热力图数据处理**:
- `generateCombinedChannelValues()`: 生成综合通道数值
- 训练全程平均值计算
- 专用紧凑颜色条显示

#### 4. 训练评估系统 (Training Assessment)
**综合评价**:
- 活跃度等级评定 (`activityLevelClass`)
- 训练效果文字描述 (`activityLevelText`)
- HbO/HbR平均变化量显示

**评估指标**:
- `trainingSummary.avgHboChange`: HbO平均变化
- `trainingSummary.avgHbrChange`: HbR平均变化
- 等级徽章UI显示系统

#### 5. 康复建议系统 (Rehabilitation Recommendations)
**个性化建议**:
- 基于训练数据的康复建议
- 专业医疗指导意见
- 下次训练计划建议

#### 6. 数据处理工具 (Data Processing)
**核心工具函数**:
- `formatValue()`: 数值格式化显示
- `initCharts()`: 初始化所有图表
- `handleResize()`: 响应式布局处理

### 🔧 技术特性
- **ECharts集成**: 专业时间序列曲线
- **Canvas渲染**: 大脑热力图评估显示  
- **响应式设计**: 四象限自适应布局
- **数据分析**: 训练全程统计分析

### ⚠️ 复杂度分析
- **多图表管理**: 时间曲线 + 大脑热力图同时渲染
- **数据聚合**: 训练全程数据的统计处理
- **布局复杂**: 四象限响应式网格布局

---

## 功能基线测试计划

### 🎯 测试目标
在重构前建立功能基线，确保重构后功能完全一致。

### 📝 测试清单

#### TrainingView.vue 基线测试
- [ ] 四种显示模式切换正常 (brain/heatmap/curve/game)
- [ ] 专业大脑热力图加载显示正常
- [ ] 传统热力图 HbO/HbR 双图显示
- [ ] 数据曲线图实时更新和缩放
- [ ] 游戏模式组件异步加载
- [ ] 设备控制按钮功能 (开始/暂停/停止/紧急停止)
- [ ] 康助侠设备连接/断开
- [ ] 时间显示和患者信息显示
- [ ] 响应式布局适配

#### ObelabTrainingView.vue 基线测试  
- [ ] Obelab专业界面风格正确
- [ ] 专业大脑模式热力图正常
- [ ] Triangle布局数据加载和解析
- [ ] 模式切换功能完整
- [ ] 训练控制按钮功能
- [ ] 外部配置文件加载

#### AssessmentView.vue 基线测试
- [ ] 四象限布局正确显示
- [ ] 时间序列曲线图生成
- [ ] 大脑热力图评估显示  
- [ ] 训练评估等级计算
- [ ] 康复建议内容显示
- [ ] 数据格式化正确

---

## 重构实施计划

### 🚀 第一阶段: TrainingView.vue 模式组件拆分

#### 目标结构
```
src/components/training/
├── TrainingContainer.vue          # 主容器 (~200行)
├── modes/
│   ├── BrainModeView.vue         # 专业大脑模式 (~400行)
│   ├── HeatmapModeView.vue       # 热力图模式 (~350行)
│   ├── CurveModeView.vue         # 数据曲线模式 (~300行)
│   └── GameModeView.vue          # 游戏模式 (~200行)
├── controls/
│   ├── ModeSelector.vue          # 模式选择器 (~150行)
│   ├── TrainingControls.vue      # 训练控制 (~200行)
│   └── DeviceStatus.vue          # 设备状态 (~100行)
└── mixins/
    └── TrainingCommon.js          # 共享逻辑 (~300行)
```

#### 拆分步骤
1. **创建容器组件**: 保留基本布局和状态管理
2. **提取模式组件**: 独立的显示模式实现
3. **分离控制组件**: 按钮和状态显示组件
4. **抽取共享逻辑**: Mixin和工具函数

### 🚀 第二阶段: 热力图模块重构

#### 目标结构
```
src/utils/heatmap/
├── index.js                      # 统一入口
├── renderers/
│   ├── BrainHeatmapRenderer.js   # 专业大脑渲染
│   ├── GridHeatmapRenderer.js    # 网格热力图渲染  
│   └── AssessmentHeatmap.js      # 评估热力图
├── data/
│   ├── DataProcessor.js          # 数据处理核心
│   ├── TriangleLayoutParser.js   # Triangle布局解析
│   └── OptodesDataLoader.js      # Optodes数据加载
└── utils/
    ├── CoordinateUtils.js        # 坐标转换工具
    └── ColorUtils.js             # 颜色处理工具
```

### 🚀 第三阶段: Obelab和Assessment组件拆分

#### ObelabTrainingView.vue 拆分
```
src/components/obelab/
├── ObelabContainer.vue           # 主容器 (~200行)
├── ObelabHeatmap.vue             # 热力图显示 (~400行)
├── ObelabControls.vue            # 控制面板 (~300行) 
└── ObelabHeader.vue              # 头部信息 (~150行)
```

#### AssessmentView.vue 拆分
```
src/components/assessment/
├── AssessmentContainer.vue       # 主容器 (~200行)
├── sections/
│   ├── TimeCurveSection.vue      # 时间曲线 (~300行)
│   ├── StatusSection.vue         # 评估状态 (~250行)
│   ├── BrainHeatmapSection.vue   # 大脑热力图 (~300行)
│   └── RecommendationSection.vue # 康复建议 (~200行)
└── utils/
    └── AssessmentCalculator.js   # 评估计算工具
```

---

## MCP验证检查点

### ✅ MCP验证1: 模式组件拆分后
- 运行应用验证所有模式切换正常
- 验证热力图显示完整性
- 确认设备控制功能无变化

### ✅ MCP验证2: 热力图模块重构后  
- 验证所有热力图渲染功能
- 确认数据加载和解析正确
- 测试不同设备布局支持

### ✅ MCP验证3: 所有组件拆分后
- 完整功能回归测试
- 性能对比测试
- 代码质量检查
