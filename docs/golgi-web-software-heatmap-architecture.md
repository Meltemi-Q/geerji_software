# Golgi Web Software 热力图实现架构说明

本文概述 `golgi_web_software` 项目中 fNIRS 热力图的实现思路，聚焦架构、数据流、渲染策略与技术栈，基于对实际代码的分析整理。

## 目标与适用场景
- **目标**: 实时展示 fNIRS 脑氧监测数据的连续插值热力图，支持动态帧范围控制和播放功能
- **场景**: Web端的实时/离线 fNIRS 数据可视化，支持 HbO/HbR 双通道热力图显示

## 技术栈与依赖
- **前端框架**: Vue 3 + Composition API + Vite 5.0
- **图表引擎**: ECharts 核心库（ScatterChart, HeatmapChart, CustomChart）
- **插值算法**: 自实现的 IDW（反距离权重）插值 + 高斯模糊
- **数据处理**: Python 后端 API + JavaScript 前端处理
- **布局配置**: JSON 格式的设备坐标布局文件

## 总体架构（模块分工）

### 1. 主渲染组件：`HeatmapDynamic.vue`
- **职责**: 热力图的主要 UI 组件，负责数据获取、控制面板和图表渲染协调
- **核心功能**: 
  - 帧范围选择器（10-500帧可选范围）
  - 播放控制（1x-10x变速播放）
  - 在线/离线模式切换
  - 双热力图显示（HbO/HbR）

### 2. 热力图工具库：`HeadShapedHeatmap.js`
- **职责**: 提供简化的 ECharts 热力图配置接口
- **功能**: 
  - 通道位置归一化（物理坐标 → [0,1] 范围）
  - 颜色主题映射（红/蓝/双向色谱）
  - ECharts 配置生成

### 3. 插值算法模块：`interpolation.js`
- **职责**: 实现类似 MATLAB griddata 的连续插值功能
- **算法**: 
  - IDW 反距离权重插值
  - 圆形掩码生成
  - 高斯模糊后处理

### 4. 绘图工具：`plotUtils.js`
- **职责**: 信号质量评估可视化和时间序列绘图
- **功能**: 
  - 信号质量节点-连线图（Graph 类型）
  - 多通道时间序列曲线
  - 动态连接线颜色编码

## 数据流架构（从硬件到像素）

```
LUMO设备硬件 → Python API处理 → WebSocket/HTTP → Vue组件 → ECharts渲染
```

### 详细数据流：
1. **硬件数据采集**: LUMO 设备通过二进制文件输出光强度数据
2. **Python后端处理**: `lumo_processor.py` 解析 `.LUMO` 文件格式，转换为标准化数据
3. **质量评估**: `channel_quality.py` 进行 SNR、SCI、光强度等多维质量评估
4. **前端数据接收**: Vue 组件通过 API 获取处理后的 HbO/HbR 浓度数据
5. **空间插值**: JavaScript 端使用 IDW 算法生成连续热力图网格数据
6. **ECharts渲染**: 使用 heatmap 系列类型渲染最终的像素级热力图

## 坐标体系与空间映射

### 物理坐标系统
- **设备布局**: Triangle/LUMO 设备的2D/3D坐标系统（毫米单位）
- **配置来源**: `layout.json` 文件定义各节点optode的精确坐标
- **坐标转换**: 物理坐标（mm） → 归一化坐标[0,1] → ECharts网格像素

### 空间映射算法
```javascript
// 通道中点位置计算
const channelX = (sourcePos[0] + detectorPos[0]) / 2
const channelY = (sourcePos[1] + detectorPos[1]) / 2

// 归一化到[0,1]范围
const normalizedX = (channelX - minX) / (maxX - minX)
const normalizedY = (channelY - minY) / (maxY - minY)
```

## 热力图渲染策略

### 1. 连续插值热力图方案（主要实现）
- **算法核心**: IDW 反距离权重插值 + 高斯滤波平滑
- **网格分辨率**: 150×150 网格（在线模式可调至80×80提升性能）
- **边界处理**: 凸包生成 + 扩展 + 圆形掩码 + 边缘平滑
- **颜色映射**: 动态值域范围，蓝-绿-红双向色谱

### 2. 头部轮廓渲染
```javascript
// 自定义渲染头部轮廓（圆形+鼻子+耳朵标记）
const renderHeadOutline = (params, api) => {
  // 头部圆形 + 鼻子三角形 + 左右耳椭圆
  // 动态计算坐标系中心和半径
}
```

### 3. 实时数据更新
- **更新频率**: 每1000ms检查数据更新
- **节流策略**: 使用 lodash throttle 限制频繁更新
- **帧范围动态**: 支持滑动窗口浏览历史数据

## 插值算法实现细节

### IDW（反距离权重）插值
```javascript
// 核心插值公式
for (let k = 0; k < channelPositions.length; k++) {
  const distance = Math.sqrt(dx*dx + dy*dy)
  const weight = 1 / (distance * distance)  // 距离平方的倒数
  weightedSum += channelValues[k] * weight
  weightSum += weight
}
const interpolatedValue = weightedSum / weightSum
```

### 高斯滤波平滑
- **核函数**: 3σ 高斯核，可配置 sigma 参数
- **边缘处理**: 权重归一化处理 NaN 值
- **性能优化**: 核大小自适应调整

## 质量评估与可视化

### Python端质量评估（`channel_quality.py`）
- **SNR评估**: 低频趋势 vs 高频噪声比值
- **SCI评估**: 双波长信号相关性指标  
- **光强度评估**: 强度范围和变异系数
- **心率成分**: 0.8-2.5Hz 心律频段功率占比
- **综合评分**: 加权组合多个指标

### 前端可视化（`plotUtils.js`）
- **节点视图**: Graph类型显示光源检测器布局
- **连线视图**: 通道质量用连线颜色编码
- **时间序列**: 多通道信号时域显示

## 配置与布局管理

### 设备布局配置（`layout.json`）
```json
{
  "group_uid": 20155470,
  "dimensions": {"dimensions_2d": {"x": 188.72, "y": 110.29}},
  "docks": [
    {
      "dock_id": "dock_1", 
      "optodes": [
        {"optode_id": "optode_1", "coordinates_2d": {"x": 121.67, "y": 81.97}},
        // ... 更多optode定义
      ]
    }
  ]
}
```

### 数据结构标准化
- **LUMO格式**: 支持Gowerlabs LUMO设备的原生数据格式
- **DOT格式**: 转换为标准的DOT (Diffuse Optical Tomography) 数据结构
- **NIRS格式**: 兼容标准NIRS数据格式

## 性能优化策略

### 1. 渲染性能优化
- **网格分辨率**: 在线模式80×80，离线模式150×150
- **动画禁用**: `animation: false` 提升渲染性能
- **渐进渲染**: `progressive: 1000` 大数据集分批渲染
- **节流更新**: 2秒节流限制更新频率

### 2. 数据处理优化
- **通道筛选**: 根据距离范围筛选有效通道（30-80mm）
- **空间索引**: 凸包算法减少插值计算范围
- **内存管理**: 及时清理ECharts实例和事件监听

## 主要文件与职责

### 前端核心文件
- `src/components/HeatmapDynamic.vue`: 主热力图组件，1937行
- `src/utils/HeadShapedHeatmap.js`: ECharts配置工具，193行
- `src/utils/interpolation.js`: 插值算法库，165行  
- `src/utils/plotUtils.js`: 绘图工具集，457行

### 后端处理文件
- `python_apis/lumo_processor.py`: LUMO数据处理器，692行
- `python_apis/channel_quality.py`: 通道质量评估，635行
- `python_apis/addfiles/layout.json`: 设备布局配置文件

### 配置文件
- `package.json`: 依赖管理（echarts, lodash, axios等）
- `vite.config.js`: Vite构建配置

## 与参考架构的区别

### 相比jiemian_zonghe项目的优势：
1. **更完整的质量评估**: 7种不同的信号质量指标
2. **标准数据格式**: 支持LUMO/DOT/NIRS多种标准格式
3. **更灵活的播放控制**: 支持变速播放和精确帧跳转
4. **Python+JavaScript双端**: 前端专注渲染，后端专注数据处理

### 技术架构差异：
1. **渲染引擎**: ECharts（简化）vs D3.js+Canvas（复杂）
2. **插值策略**: IDW单一算法 vs IDW+等高线双路径
3. **数据源**: 标准设备格式 vs SDK实时数据流
4. **坐标系统**: 设备物理坐标 vs Triangle配置坐标

## 扩展方向

### 近期优化
- WebGL加速大数据集渲染
- 多设备类型支持（Triangle, LUMO等）
- 实时流数据WebSocket优化
- 移动端响应式适配

### 长期发展  
- 3D体渲染支持
- 机器学习质量评估模型
- 云端数据分析平台集成
- 多用户协作功能

---

**总结**: golgi_web_software 的热力图实现注重标准化和实用性，通过ECharts简化了渲染复杂度，通过Python后端保证了数据处理的专业性，是一个工程化程度较高的fNIRS可视化解决方案。