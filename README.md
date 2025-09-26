# 戈尔基康复训练系统 (Golgi Rehabilitation Training System)

[![Version](https://img.shields.io/badge/version-v2.2.1-blue.svg)](https://github.com/golgi-fnirs/rehabilitation-system)
[![Vue](https://img.shields.io/badge/Vue-3.5.0-brightgreen.svg)](https://vuejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-brightgreen.svg)](https://python.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> 基于近红外光谱技术(fNIRS)的智能康复训练平台，集成康助侠运动设备，提供实时脑氧监测和多模式可视化训练界面

## 📋 项目概述

戈尔基康复训练系统是一套完整的医疗级康复训练解决方案，采用前后端分离架构，结合了**fNIRS脑氧监测技术**与**康助侠运动康复设备**，为康复中心和医疗机构提供科学、可视化的训练评估平台。

### 🎯 核心功能

- **📡 实时fNIRS脑氧监测** - 432通道高精度血氧数据采集 (8Hz采样)
- **🏋️ 康助侠设备集成** - 运动数据同步采集与分析
- **🧠 专业大脑可视化** - 基于Triangle布局的热力图渲染
- **📊 多模式训练界面** - 专业大脑、传统热力图、数据曲线、交互游戏四种模式
- **📈 智能评估报告** - 训练效果分析与可视化报告生成
- **🔄 三步骤预训练流程** - 患者信息登记→设备校验→开始训练

## 🏗️ 系统架构

### 前端架构 (Vue 3.5 + Vite 5.0)

```
src/
├── App.vue                          # 主应用：状态管理、数据流控制
├── components/
│   ├── training/
│   │   ├── TrainingContainer.vue    # 训练容器：模式切换、数据传递
│   │   ├── modes/
│   │   │   ├── BrainModeView.vue    # 专业大脑模式：Triangle热力图
│   │   │   ├── HeatmapModeView.vue  # 传统热力图模式
│   │   │   ├── CurveModeView.vue    # 数据曲线模式：ECharts可视化
│   │   │   └── GameModeView.vue     # 交互游戏模式
│   │   └── controls/
│   │       ├── ModeSelector.vue     # 模式选择器：响应式按钮
│   │       ├── TrainingControls.vue # 训练控制面板
│   │       └── DeviceStatus.vue     # 设备状态监控
│   ├── StandbyView.vue             # 待机界面：三步骤预训练流程
│   ├── AssessmentView.vue          # 评估界面：训练结果分析
│   └── PatientInfoModal.vue        # 患者信息模态框：分步卡片式表单
└── utils/
    ├── heatmap/                     # 热力图渲染引擎
    │   ├── HeatmapRenderer.js       # 主渲染器
    │   ├── HeatmapCore.js           # 数据处理核心
    │   ├── interpolation/idw.js     # IDW插值算法
    │   └── colorMaps.js             # 颜色映射配置
    └── fnirsLayout.js               # fNIRS设备布局定义
```

### 后端架构 (Python 3.8+ SDK)

```
fnirs_sdk/                           # fNIRS处理SDK
├── __init__.py                      # SDK API导出
├── processor.py                     # 核心处理器：设备连接、数据流管理
├── algorithms.py                    # 核心算法：光密度转换、血氧计算
├── data_types.py                    # 数据结构定义
├── data_encryption.py               # 数据加密模块
├── processing/
│   ├── brain_oxygen_processor.py    # 血氧数据处理
│   ├── blood_oxygen_processor.py    # 血红蛋白浓度计算
│   └── node_processor.py           # 节点数据处理
├── config/
│   ├── loader.py                    # 配置加载器
│   └── device_profiles/             # 设备配置文件
└── reports/                         # 报告生成模块

fnirs_data_server.py                 # HTTP API服务器
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 16.0.0
- **Python** >= 3.8
- **系统支持**: Windows 11, macOS, Linux
- **设备**: 戈尔基fNIRS设备 (VID:18D1, PID:D002)

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/golgi-fnirs/rehabilitation-system.git
cd rehabilitation-system
```

#### 2. 前端环境配置
```bash
# 安装前端依赖
npm install

# 启动前端开发服务器 (端口3000)
npm run dev
```

#### 3. 后端环境配置
```bash
# 创建Python虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装后端依赖
pip install -r requirements.txt

# 启动fNIRS数据服务器 (端口8091)
python fnirs_data_server.py
```

#### 4. 访问系统
- **前端界面**: http://localhost:3000
- **API文档**: http://localhost:8091/api/fnirs/data

## 💡 技术特色

### 🧠 专业fNIRS算法实现

- **📊 光密度转换**: 基于Modified Beer-Lambert Law的精确算法
- **🔬 血氧计算**: HbO、HbR、HbT、SO2完整血氧指标
- **📈 实时滤波**: 高通(0.01Hz)、低通(0.08Hz)滤波处理
- **🎯 运动校正**: TDDR运动校正算法，消除运动伪影
- **📏 多波长支持**: 735nm/850nm双波长，路径长度因子校正

```python
# fNIRS核心算法示例
from fnirs_sdk import FNIRSProcessor

processor = FNIRSProcessor()
processor.connect_device()                    # 连接戈尔基fNIRS设备
processor.start_data_stream()                 # 开始8Hz数据流

# 获取实时血氧数据
brain_data = processor.get_oxygen_data()      # 432通道血氧数据
oxygen_stats = processor.get_oxygen_data_single_channel()  # 单通道平均值
```

### 🎨 高级热力图可视化

- **🔥 双Canvas分层渲染**: 大脑背景 + 热力图叠加
- **🌈 连续插值算法**: IDW反距离权重插值，自然边界扩散
- **📐 Triangle坐标系统**: 基于物理位置的精确映射
- **🎛️ 动态颜色映射**: 多种医学专用配色方案
- **📱 响应式自适应**: CSS clamp()实现多分辨率完美适配

### 🔄 智能数据流管理

- **⚡ 8Hz实时更新**: 匹配fNIRS设备采样频率
- **📚 历史数据缓存**: 10秒滚动窗口，支持时间轴回溯
- **🛡️ 多级容错机制**: 真实设备→加密数据→模拟数据三级回退
- **🔧 统计数据优化**: 使用SDK预计算统计值，避免前端重复计算

## 🎮 使用指南

### 训练流程

#### 1. 待机界面操作
- **基础信息登记**: 患者姓名、年龄、联系方式、身体指标
- **设备连接校验**: fNIRS设备信号质量检查
- **系统就绪确认**: 确保所有设备正常工作

#### 2. 训练模式选择
- **🧠 专业大脑模式**: Triangle布局热力图，医学专业视角
- **🔥 传统热力图模式**: 网格热力图，直观温度显示  
- **📊 数据曲线模式**: ECharts时序图表，量化分析
- **🎮 交互游戏模式**: 认知训练游戏，提升患者参与度

#### 3. 训练执行
- **实时监控**: HbO/HbR数值变化、设备状态、训练时长
- **康助侠集成**: 运动数据同步采集，动作质量评估
- **应急处理**: 紧急停止按钮，确保患者安全

#### 4. 评估报告
- **脑活跃度评分**: 10分制量化评估，星级可视化
- **训练效果分析**: 血氧变化趋势、激活区域热力图
- **个性化建议**: 基于数据的康复训练建议

### 康助侠设备集成

```javascript
// 康助侠设备状态监控
const kangzhuxiaStatus = {
  connected: true,          // 设备连接状态
  card_status: 1,          // 刷卡状态：0-未刷卡，1-已刷卡
  motion_status: 1,        // 运动状态：0-停止，1-运动中
  emergency_status: 0      // 急停状态：0-正常，1-急停
}

// 运动数据接收
const motionData = {
  timestamp: Date.now(),
  force_data: [...],       // 力传感器数据
  position_data: [...],    // 位置传感器数据
  speed_data: [...]        // 速度传感器数据
}
```

## 🧪 测试验证

### 自动化测试 (Playwright)
```bash
# 运行完整测试套件
npm run test

# UI界面测试
npm run test:ui

# 生成测试报告
npm run test:report
```

**测试覆盖范围**:
- ✅ 系统可访问性测试 (100%通过)
- ✅ 响应式设计验证 (1920x1080 / 1024x768 / 768x1024)
- ✅ 患者信息表单验证
- ✅ 训练模式切换功能
- ✅ 热力图渲染性能测试
- ✅ 数据流稳定性测试

### 性能基准测试
- **🚀 热力图渲染**: <50ms (432通道数据)
- **📊 数据更新频率**: 8Hz (125ms间隔)
- **💾 内存使用**: <100MB (10分钟训练)
- **🌐 网络延迟**: <10ms (本地API)
- **📱 UI响应时间**: <16ms (60FPS)

## 📦 打包发布（桌面版）

### 1) 一键打包后端（含 SDK）为 EXE（Windows）
```
scripts\build_fnirs_backend.bat
# 产物：backend_bin\fnirs_server.exe
```

注意：若读取中文路径/文件，已默认 `PYTHONIOENCODING=utf-8`，并建议在后端使用 `Path(getattr(sys, "_MEIPASS", Path(__file__).parent))` 作为基路径加载资源。

### 2) 前端构建
```
npm run build   # 生成 dist/
```

### 3) Electron 最小外壳
- 入口：`electron/main.js` 会在应用启动时拉起 `backend_bin/fnirs_server.exe`，退出时关闭进程。
- 若需要完整安装包，可引入 electron-builder 并配置 `build.extraResources` 把 `backend_bin` 嵌入安装包。

## 🔧 开发指南

### 环境变量配置
```bash
# .env文件
VITE_API_BASE_URL=http://localhost:8091  # 后端API地址
VITE_DEVICE_MODE=development             # 设备模式：development/production
FNIRS_DEVICE_VID=18D1                    # 戈尔基设备VID
FNIRS_DEVICE_PID=D002                    # 戈尔基设备PID
FNIRS_BAUD_RATE=2000000                  # 串口波特率
```

### API接口文档

#### fNIRS数据接口
```http
GET /api/fnirs/data
Content-Type: application/json

{
  "hbo_data": [...],        // 432通道HbO数据
  "hbr_data": [...],        // 432通道HbR数据
  "hbo_stats": {            // HbO统计数据
    "mean": 0.025,
    "std": 0.015,
    "min": 0.01,
    "max": 0.04
  },
  "hbr_stats": {...},       // HbR统计数据
  "timestamp": 1693564800.123,
  "frame_id": 1234
}
```

#### 设备状态接口
```http
GET /api/device/status
Content-Type: application/json

{
  "fnirs_connected": true,
  "kangzhuxia_connected": true,
  "sample_rate": 8,
  "channel_count": 432,
  "node_count": 6
}
```

### 热力图自定义配置

```javascript
// utils/heatmap/config.js
export const heatmapConfig = {
  gridSize: 200,           // 插值网格密度
  radius: 50,              // 插值影响半径
  idwPower: 2,             // IDW权重指数
  gaussianSigma: 15,       // 高斯模糊sigma
  colorMap: 'medical',     // 颜色映射方案
  scaleMode: 'adaptive'    // 缩放策略
}
```

## 📁 文件说明

### 关键文件解析
- **`App.vue`** - 主应用状态管理，数据流控制中心
- **`fnirs_data_server.py`** - HTTP API服务器，提供RESTful接口
- **`processor.py`** - fNIRS处理器核心，设备通信与数据处理
- **`HeatmapRenderer.js`** - 热力图渲染引擎，支持多种可视化模式
- **`TrainingContainer.vue`** - 训练容器组件，模式切换与数据分发

### 配置文件
- **`package.json`** - 前端项目配置，依赖管理
- **`setup.py`** - Python包配置，SDK安装脚本
- **`vite.config.js`** - Vite构建配置，开发服务器设置
- **`requirements.txt`** - Python依赖列表

## 🛠️ 故障排除

### 常见问题

#### 1. fNIRS设备连接失败
```bash
# 检查设备连接
python -c "import serial.tools.list_ports; print([port.device for port in serial.tools.list_ports.comports()])"

# 检查设备VID/PID
# 戈尔基设备: VID=18D1, PID=D002
```

#### 2. 热力图不显示
- 确认432通道数据格式正确
- 检查Triangle坐标配置文件
- 验证Canvas元素DOM挂载状态

#### 3. 数据曲线跳动
- 使用SDK统计数据而非实时重计算
- 检查历史数据缓存机制
- 确认8Hz更新频率同步

#### 4. 康助侠设备无响应  
- 验证设备驱动程序安装
- 检查COM端口占用情况
- 确认设备固件版本兼容性

### 日志调试
```bash
# 启用详细日志
export DEBUG=fnirs:*
npm run dev

# Python后端日志
python fnirs_data_server.py --log-level=DEBUG
```

## 📚 参考资料

### 技术文档
- [fNIRS技术白皮书](docs/fnirs-technical-whitepaper.pdf)
- [康助侠设备集成指南](docs/kangzhuxia-integration-guide.md)
- [热力图算法说明](docs/heatmap-algorithm-documentation.md)
- [API接口规范](docs/api-specification.md)

### 学术论文
- Scholkmann, F., et al. (2014). "A review on continuous wave functional near-infrared spectroscopy and imaging instrumentation and methodology." *NeuroImage*, 85, 6-27.
- Pinti, P., et al. (2020). "The present and future use of functional near-infrared spectroscopy (fNIRS) for cognitive neuroscience." *Annals of the New York Academy of Sciences*, 1464(1), 5-29.

## 🤝 贡献指南

### 开发流程
1. Fork项目到个人仓库
2. 创建功能分支: `git checkout -b feature/your-feature-name`
3. 提交更改: `git commit -am 'Add your feature'`
4. 推送到分支: `git push origin feature/your-feature-name`
5. 提交Pull Request

### 代码规范
- **前端**: ESLint + Prettier，Vue 3 Composition API风格
- **后端**: PEP 8代码规范，类型注解强制要求
- **提交信息**: 采用Conventional Commits规范
- **测试覆盖**: 新功能必须包含相应测试用例

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🏥 医疗免责声明

本系统仅供科研和教育用途，不能替代专业医疗诊断。在临床应用前，请确保符合相关医疗器械法规要求。

## 👥 开发团队

- **架构设计**: 戈尔基fNIRS技术团队
- **前端开发**: Vue.js专家组
- **后端算法**: 近红外光谱算法研究团队  
- **医疗顾问**: 康复医学专家委员会
- **设备集成**: 康助侠技术支持团队

---

<div align="center">

**🌟 感谢使用戈尔基康复训练系统 🌟**

[官方网站](https://golgi-fnirs.com) | [技术文档](https://docs.golgi-fnirs.com) | [在线演示](https://demo.golgi-fnirs.com)

</div>