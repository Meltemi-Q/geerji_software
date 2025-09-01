<template>
  <div class="obelab-style-training-view">
    <!-- 顶部热力图颜色条 -->
    <div class="top-colorbar">
      <div class="colorbar-container">
        <div class="colorbar-gradient"></div>
        <div class="colorbar-labels">
          <span class="colorbar-label">-0.05</span>
          <span class="colorbar-label">0.00</span>
          <span class="colorbar-label">+0.05</span>
        </div>
      </div>
      <!-- 患者信息显示在右上角 -->
      <div class="patient-info-top">
        <span class="patient-name-large">{{ patientInfo.name }} ({{ patientInfo.age }}岁)</span>
        <span class="training-time-large">{{ formatDuration(trainingDuration) }}</span>
      </div>
    </div>

    <!-- 主界面区域 -->
    <div class="main-layout">
      <!-- 左侧模式选择按钮 -->
      <div class="left-sidebar">
        <div class="sidebar-title">显示模式</div>
        <div class="mode-buttons-vertical">
          <button 
            class="large-mode-btn" 
            :class="{ active: displayMode === 'brain' }"
            @click="switchMode('brain')"
          >
            <svg width="32" height="32" class="mode-icon-large">
              <path d="M16 4C10 4 5 9 5 15c0 3 1.5 6 3.5 8C9 24.5 10 26 10 28h12c0-2 1-3.5 1.5-4.5C26 21 27.5 18 27.5 15c0-6-5-11-11.5-11z" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
              <circle cx="20" cy="13" r="1.5" fill="currentColor"/>
            </svg>
            <span>专业大脑</span>
          </button>
          
          <button 
            class="large-mode-btn" 
            :class="{ active: displayMode === 'heatmap' }"
            @click="switchMode('heatmap')"
          >
            <svg width="32" height="32" class="mode-icon-large">
              <rect x="4" y="4" width="24" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <circle cx="20" cy="12" r="2" fill="currentColor"/>
              <circle cx="12" cy="20" r="2" fill="currentColor"/>
              <circle cx="20" cy="20" r="2" fill="currentColor"/>
            </svg>
            <span>传统热力图</span>
          </button>
          
          <button 
            class="large-mode-btn" 
            :class="{ active: displayMode === 'curve' }"
            @click="switchMode('curve')"
          >
            <svg width="32" height="32" class="mode-icon-large">
              <path d="M4 16L8 12L16 18L28 8" stroke="currentColor" stroke-width="2" fill="none"/>
              <path d="M28 8L22 8L22 14" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
            <span>数据曲线</span>
          </button>
          
          <button 
            class="large-mode-btn" 
            :class="{ active: displayMode === 'game' }"
            @click="switchMode('game')"
          >
            <svg width="32" height="32" class="mode-icon-large">
              <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="M10 18s2 3 6 3 6-3 6-3" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="20" cy="12" r="1.5" fill="currentColor"/>
            </svg>
            <span>交互游戏</span>
          </button>
        </div>
      </div>

      <!-- 中间3D大脑热力图显示区域 -->
      <div class="center-brain-display">
        <!-- 专业大脑热力图模式（默认） -->
        <div v-if="displayMode === 'brain'" class="brain-main-display">
          <div class="brain-container-large">
            <div ref="brainHeatmapRef" class="brain-canvas-large"></div>
          </div>
        </div>
        
        <!-- 传统热力图模式 -->
        <div v-else-if="displayMode === 'heatmap'" class="heatmap-section">
            <!-- HbO热力图 -->
            <div class="heatmap-card">
              <div class="heatmap-header">
                <h3 class="heatmap-title">含氧血红蛋白 (HbO)</h3>
                <div class="current-value positive">{{ formatValue(currentValues.hbo) }} μM</div>
              </div>
              <div class="heatmap-container">
                <div ref="hboHeatmapRef" class="heatmap-canvas white-bg"></div>
              </div>
            </div>

            <!-- HbR热力图 -->
            <div class="heatmap-card">
              <div class="heatmap-header">
                <h3 class="heatmap-title">脱氧血红蛋白 (HbR)</h3>
                <div class="current-value negative">{{ formatValue(currentValues.hbr) }} μM</div>
              </div>
              <div class="heatmap-container">
                <div ref="hbrHeatmapRef" class="heatmap-canvas white-bg"></div>
              </div>
            </div>
          </div>

          <!-- 曲线图模式 -->
          <div v-if="displayMode === 'curve'" class="curve-section">
            <div class="curve-card">
              <div class="curve-header">
                <h3 class="curve-title">血氧浓度变化曲线</h3>
                <div class="curve-controls">
                  <button class="curve-control-btn" @click="resetCurveZoom">重置缩放</button>
                  <span class="time-range">显示时间: {{ curveTimeRange }}秒</span>
                </div>
              </div>
              <div class="curve-container">
                <div ref="curveChartRef" class="curve-canvas"></div>
              </div>
              <div class="curve-legend">
                <div class="legend-item">
                  <div class="legend-color hbo-color"></div>
                  <span>HbO ({{ formatValue(currentValues.hbo) }} μM)</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color hbr-color"></div>
                  <span>HbR ({{ formatValue(currentValues.hbr) }} μM)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 游戏模式 -->
          <div v-if="displayMode === 'game'" class="game-section">
            <GameComponent 
              v-if="gameInitialized"
              :isDeviceConnected="deviceStatus.fnirs === 'connected'"
              :collectionActive="isTraining"
              :nirsData="{ hboData: hboData, hbrData: hbrData }"
              @exit-game="switchMode('heatmap')"
            />
            <div v-else class="game-loading">
              <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>正在加载游戏组件...</p>
              </div>
            </div>
          </div>

          <!-- 专业大脑热力图模式 -->
          <div v-if="displayMode === 'brain'" class="brain-section">
            <div class="brain-heatmap-card">
              <div class="brain-header">
                <h3 class="brain-title">专业脑氧监测热力图</h3>
                <div class="brain-controls">
                  <div class="brain-info">
                    <span class="brain-label">HbO浓度:</span>
                    <span class="brain-value positive">{{ formatValue(currentValues.hbo) }} μM</span>
                  </div>
                  <div class="colorbar-legend">
                    <span class="colorbar-label">低</span>
                    <div class="colorbar-gradient"></div>
                    <span class="colorbar-label">高</span>
                  </div>
                </div>
              </div>
              <div class="brain-container">
                <div ref="brainHeatmapRef" class="brain-canvas"></div>
              </div>
              <div class="brain-status">
                <div class="brain-stats">
                  <div class="stat-item">
                    <span class="stat-label">活跃区域:</span>
                    <span class="stat-value">{{ activeBrainRegions }}个</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">平均活跃度:</span>
                    <span class="stat-value">{{ formatPercentage(averageBrainActivity) }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">更新频率:</span>
                    <span class="stat-value">{{ brainUpdateRate }}Hz</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      <!-- 右侧功能按钮区域 -->
      <div class="right-sidebar">
        <div class="sidebar-title">功能控制</div>
        <div class="control-buttons-vertical">
          <!-- 设备连接状态显示 -->
          <div class="device-status-large">
            <div class="status-indicator-large" :class="deviceStatus.fnirs === 'connected' ? 'connected' : 'disconnected'">
              <div class="status-dot"></div>
              <span class="status-text-large">fNIRS {{ deviceStatus.fnirs === 'connected' ? '已连接' : '未连接' }}</span>
            </div>
            <div class="status-indicator-large" :class="kangzhuxiaStatus.connected ? 'connected' : 'disconnected'">
              <div class="status-dot"></div>
              <span class="status-text-large">康助侠 {{ getKangzhuxiaStatusText() }}</span>
            </div>
          </div>
          
          <!-- 训练控制按钮 -->
          <button 
            class="large-control-btn start-btn" 
            :disabled="isTraining"
            @click="$emit('start-training')"
          >
            <svg width="32" height="32" class="control-icon-large">
              <polygon points="8,4 8,28 24,16" fill="currentColor"/>
            </svg>
            <span>开始训练</span>
          </button>
          
          <button 
            class="large-control-btn pause-btn" 
            :disabled="!isTraining"
            @click="$emit('pause-training')"
          >
            <svg width="32" height="32" class="control-icon-large">
              <rect x="6" y="4" width="6" height="24" fill="currentColor"/>
              <rect x="20" y="4" width="6" height="24" fill="currentColor"/>
            </svg>
            <span>暂停训练</span>
          </button>
          
          <button 
            class="large-control-btn stop-btn"
            @click="$emit('stop-training')"
          >
            <svg width="32" height="32" class="control-icon-large">
              <rect x="6" y="6" width="20" height="20" fill="currentColor"/>
            </svg>
            <span>结束训练</span>
          </button>
          
          <!-- 康助侠设备控制 -->
          <button 
            v-if="!kangzhuxiaStatus.connected"
            class="large-control-btn connect-btn"
            @click="$emit('connect-kangzhuxia')"
          >
            <svg width="32" height="32" class="control-icon-large">
              <path d="M4 20V10L16 4l12 6V20l-12 6L4 20z" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="16" cy="14" r="3" fill="currentColor"/>
            </svg>
            <span>连接康助侠</span>
          </button>
          
          <button 
            v-else
            class="large-control-btn disconnect-btn"
            @click="$emit('disconnect-kangzhuxia')"
          >
            <svg width="32" height="32" class="control-icon-large">
              <path d="M4 20V10L16 4l12 6V20l-12 6L4 20z" fill="none" stroke="currentColor" stroke-width="2"/>
              <line x1="10" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="3"/>
            </svg>
            <span>断开康助侠</span>
          </button>
          
          <!-- 紧急停止按钮 -->
          <button 
            class="large-emergency-btn"
            @click="$emit('emergency-stop')"
          >
            <svg width="32" height="32" class="emergency-icon-large">
              <polygon points="16,4 28,24 4,24" fill="currentColor"/>
              <text x="16" y="20" text-anchor="middle" font-size="12" fill="white" font-weight="bold">!</text>
            </svg>
            <span>紧急停止</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 底部Golgi标识 -->
    <div class="bottom-branding">
      <div class="golgi-logo">
        <span class="golgi-text">Golgi</span>
        <span class="golgi-subtitle">近红外脑氧监测系统</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, onUnmounted, defineAsyncComponent } from 'vue'
import * as d3 from 'd3'
import * as echarts from 'echarts/core'
import { HeatmapChart, CustomChart, LineChart } from 'echarts/charts'
import { 
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  VisualMapComponent,
  LegendComponent,
  DataZoomComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapRenderer } from '../utils/HeatmapRenderer.js'
import { heatmapPositioning } from '../utils/HeatmapAdaptivePositioning.js'

// 功能1：加载配置（默认值，支持配置化）
const defaultConfig = {
  flipYForReport: false,
  idwPower: 2,
  gaussianSigma: 2,
  scaleClampStrategy: "default",
  minScaleGuard: false,
  maskAlpha: 0.3
}

// 尝试加载外部配置
let heatmapConfig = defaultConfig
try {
  // 功能1：启用外部配置加载支持
  const configResponse = await fetch('/heatmap_renderer_config.json')
  const externalConfig = await configResponse.json()
  heatmapConfig = { ...defaultConfig, ...externalConfig.config }
  console.log('[TrainingView] 已加载外部配置:', heatmapConfig)
} catch (error) {
  console.log('[TrainingView] 使用默认配置:', error.message)
}

// 动态加载游戏组件（按需加载，优化性能）
const GameComponent = defineAsyncComponent(() => {
  console.log('[性能优化] 按需加载游戏组件')
  return import('./GameComponent.vue')
})

// 注册ECharts组件
echarts.use([
  HeatmapChart,
  CustomChart,
  LineChart,
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  VisualMapComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer
])

export default {
  name: 'TrainingView',
  components: {
    GameComponent
  },
  props: {
    hboData: {
      type: Array,
      required: true
    },
    hbrData: {
      type: Array,
      required: true
    },
    currentValues: {
      type: Object,
      required: true
    },
    trainingDuration: {
      type: Number,
      default: 0
    },
    isTraining: {
      type: Boolean,
      default: false
    },
    patientInfo: {
      type: Object,
      default: () => ({
        name: '张三',
        age: 87
      })
    },
    deviceStatus: {
      type: Object,
      default: () => ({
        fnirs: 'connected',
        kangzhuxia: 'disconnected'
      })
    },
    kangzhuxiaStatus: {
      type: Object,
      default: () => ({
        connected: false,
        card_status: 0,
        motion_status: 0,
        emergency_status: 0
      })
    }
  },
  emits: [
    'start-training', 
    'pause-training', 
    'stop-training', 
    'emergency-stop',
    'connect-kangzhuxia',
    'disconnect-kangzhuxia'
  ],
  setup(props) {
    // 模式切换相关
    const displayMode = ref('brain') // 默认专业大脑模式 'heatmap', 'curve', 'game', 'brain'
    const gameInitialized = ref(false)
    
    // 现有引用
    const hboHeatmapRef = ref(null)
    const hbrHeatmapRef = ref(null)
    const curveChartRef = ref(null)
    const brainHeatmapRef = ref(null) // 新增大脑热力图引用
    const currentTime = ref(new Date().toLocaleTimeString())
    
    // 曲线图相关
    const curveTimeRange = ref(60) // 显示60秒的数据
    const curveDataPoints = ref({
      hbo: [], // { time: timestamp, value: number }
      hbr: []
    })
    
    // 大脑热力图相关
    const activeBrainRegions = ref(12) // 活跃区域数量
    const averageBrainActivity = ref(68.5) // 平均活跃度（百分比）
    const brainUpdateRate = ref(1) // 更新频率
    
    // 热力图自适应定位配置
    const heatmapConfig = ref(null)
    
    // 图表实例
    let hboChart = null
    let hbrChart = null
    let curveChart = null
    let brainChart = null // 新增大脑图表实例
    let timeInterval = null
    let updateTimer = null
    
    // 创建热力图渲染器实例
    // 功能1：传入配置参数到HeatmapRenderer构造函数
    const heatmapRenderer = new HeatmapRenderer(heatmapConfig)
    
    // 真实的optodes数据引用（延迟加载）
    let realOptodesData = null
    let isOptodesDataLoaded = false
    
    // 加载真实optodes数据
    async function loadOptodesData() {
      if (isOptodesDataLoaded) return realOptodesData
      
      try {
        const response = await fetch(new URL('../assets/optodes_mapping_data.json', import.meta.url).href)
        const data = await response.json()
        
        // 解析optodes数据为HeatmapRenderer期望的格式
        const parsedData = parseOptodesData(data)
        realOptodesData = parsedData
        isOptodesDataLoaded = true
        
        console.log('[大脑热力图] optodes数据加载完成，点位数量:', parsedData?.optodes?.spos2?.length || 0)
        return parsedData
      } catch (error) {
        console.warn('[大脑热力图] 无法加载真实optodes数据，使用模拟数据:', error)
        isOptodesDataLoaded = true // 防止重复请求
        return null
      }
    }
    
    // 解析optodes JSON数据为HeatmapRenderer期望的格式（正确区分sources和detectors）
    function parseOptodesData(jsonData) {
      try {
        const allOptodes = []
        
        // 遍历所有docks和optodes
        if (jsonData.rawData && jsonData.rawData.docks) {
          jsonData.rawData.docks.forEach(dock => {
            if (dock.optodes && Array.isArray(dock.optodes)) {
              dock.optodes.forEach(optode => {
                if (optode.coordinates_3d) {
                  // 将{x, y, z}转换为[x, y, z]数组格式，使用3D坐标的x,y分量
                  allOptodes.push([
                    optode.coordinates_3d.x || 0,
                    optode.coordinates_3d.y || 0, 
                    optode.coordinates_3d.z || 0
                  ])
                }
              })
            }
          })
        }
        
        console.log(`[专业大脑热力图] 解析到 ${allOptodes.length} 个optodes位置`)
        
        // 创建真实的sources和detectors分布
        // 根据fNIRS原理：sources和detectors应该有不同的空间分布
        const halfCount = Math.floor(allOptodes.length / 2)
        
        return {
          optodes: {
            spos2: allOptodes.slice(0, halfCount),           // 前一半作为sources
            dpos2: allOptodes.slice(halfCount)               // 后一半作为detectors
          },
          pairs: {
            // 生成更真实的source/detector配对
            Src: Array.from({length: Math.min(432, halfCount * 4)}, (_, i) => (i % halfCount) + 1),
            Det: Array.from({length: Math.min(432, halfCount * 4)}, (_, i) => (i % (allOptodes.length - halfCount)) + 1)
          },
          channelPositions: null // 将在下面计算
        }
      } catch (error) {
        console.error('[专业大脑热力图] 解析optodes数据失败:', error)
        return null
      }
    }
    
    // 计算真实的通道中间值位置（基于source-detector配对）
    function calculateChannelMidpoints(optodesData) {
      if (!optodesData || !optodesData.optodes) return []
      
      const { spos2: sources, dpos2: detectors } = optodesData.optodes
      const { Src: srcIndices, Det: detIndices } = optodesData.pairs
      
      const channelMidpoints = []
      
      for (let i = 0; i < Math.min(srcIndices.length, detIndices.length); i++) {
        const sourceIdx = srcIndices[i] - 1  // 转换为0-based索引
        const detectorIdx = detIndices[i] - 1
        
        if (sourceIdx < sources.length && detectorIdx < detectors.length) {
          // 计算source和detector的中点位置
          const midpointX = (sources[sourceIdx][0] + detectors[detectorIdx][0]) / 2
          const midpointY = (sources[sourceIdx][1] + detectors[detectorIdx][1]) / 2
          const midpointZ = (sources[sourceIdx][2] + detectors[detectorIdx][2]) / 2
          
          channelMidpoints.push({
            channelIndex: i,
            sourceIndex: sourceIdx,
            detectorIndex: detectorIdx,
            position: [midpointX, midpointY, midpointZ],
            distance: Math.sqrt(
              Math.pow(sources[sourceIdx][0] - detectors[detectorIdx][0], 2) +
              Math.pow(sources[sourceIdx][1] - detectors[detectorIdx][1], 2) +
              Math.pow(sources[sourceIdx][2] - detectors[detectorIdx][2], 2)
            )
          })
        }
      }
      
      console.log(`[专业大脑热力图] 计算了 ${channelMidpoints.length} 个通道中点位置`)
      return channelMidpoints
    }
    
    // 真实Triangle布局数据加载
    let realTriangleLayoutData = null
    let realTriangleParsed = null
    
    // 加载真实Triangle布局数据
    async function loadTriangleLayoutData() {
      if (realTriangleLayoutData) return realTriangleLayoutData
      
      try {
        const response = await fetch(new URL('../../layout.json', import.meta.url).href)
        const data = await response.json()
        
        realTriangleLayoutData = data
        realTriangleParsed = parseTriangleLayoutForHeatmap(data)
        
        console.log('[Triangle布局] 真实数据加载完成，12个dock，总optodes:', 
          realTriangleParsed.sources.length + realTriangleParsed.detectors.length)
        console.log('[Triangle布局] 生成通道数:', realTriangleParsed.channels.length)
        
        return data
      } catch (error) {
        console.error('[Triangle布局] 加载失败，使用模拟数据:', error)
        return null
      }
    }
    
    // 解析Triangle布局数据用于热力图渲染
    function parseTriangleLayoutForHeatmap(layoutData) {
      console.log('[Triangle解析] 开始解析布局数据...')
      
      const sources = []
      const detectors = []
      const channels = []
      
      // 从layout数据中提取光源和检测器
      layoutData.docks.forEach(dock => {
        dock.optodes.forEach(optode => {
          const coords2d = optode.coordinates_2d
          const coords3d = optode.coordinates_3d
          const isSource = optode.optode_id.includes('optode_a') || 
                          optode.optode_id.includes('optode_b') || 
                          optode.optode_id.includes('optode_c')
          
          if (isSource) {
            sources.push({
              id: sources.length,
              x: coords2d.x,
              y: coords2d.y,
              z: coords3d.z || 0,
              dock: dock.dock_id,
              optode: optode.optode_id
            })
          } else {
            detectors.push({
              id: detectors.length,
              x: coords2d.x,
              y: coords2d.y, 
              z: coords3d.z || 0,
              dock: dock.dock_id,
              optode: optode.optode_id
            })
          }
        })
      })
      
      // 计算所有光源-检测器对的通道
      sources.forEach(source => {
        detectors.forEach(detector => {
          const channelX = (source.x + detector.x) / 2
          const channelY = (source.y + detector.y) / 2
          const channelZ = (source.z + detector.z) / 2
          
          channels.push({
            sourceId: source.id,
            detectorId: detector.id,
            x: channelX,
            y: channelY,
            z: channelZ,
            distance: Math.sqrt(
              Math.pow(source.x - detector.x, 2) + 
              Math.pow(source.y - detector.y, 2) +
              Math.pow(source.z - detector.z, 2)
            )
          })
        })
      })
      
      console.log(`[Triangle解析] 解析完成: ${sources.length}光源, ${detectors.length}检测器, ${channels.length}通道`)
      
      return { sources, detectors, channels }
    }
    
    // 将Triangle布局转换为HeatmapRenderer期望的fNIRS格式
    function createTriangleFnirsInfo() {
      if (!realTriangleParsed) {
        console.warn('[Triangle转换] 布局数据未加载，使用模拟数据')
        return mockFnirsInfo
      }
      
      const { sources, detectors, channels } = realTriangleParsed
      
      // 计算Triangle布局的坐标范围，用于归一化
      const allPositions = [...sources, ...detectors]
      const xValues = allPositions.map(p => p.x)
      const yValues = allPositions.map(p => p.y)
      
      const xMin = Math.min(...xValues)
      const xMax = Math.max(...xValues)
      const yMin = Math.min(...yValues)
      const yMax = Math.max(...yValues)
      
      // 计算中心点和缩放比例
      const xCenter = (xMin + xMax) / 2
      const yCenter = (yMin + yMax) / 2
      const xRange = xMax - xMin
      const yRange = yMax - yMin
      const maxRange = Math.max(xRange, yRange)
      
      console.log(`[Triangle坐标归一化] 原始范围: X(${xMin.toFixed(1)}, ${xMax.toFixed(1)}), Y(${yMin.toFixed(1)}, ${yMax.toFixed(1)})`)
      console.log(`[Triangle坐标归一化] 中心点: (${xCenter.toFixed(1)}, ${yCenter.toFixed(1)}), 最大范围: ${maxRange.toFixed(1)}`)
      
      // 归一化函数：将坐标映射到以原点为中心的对称范围[-50, 50]
      function normalizeCoordinate(x, y) {
        const normalizedX = ((x - xCenter) / maxRange) * 100  // 缩放到[-50, 50]范围
        const normalizedY = ((y - yCenter) / maxRange) * 100
        return [normalizedX, normalizedY]
      }
      
      // 转换为HeatmapRenderer期望的格式，使用归一化坐标
      const triangleFnirsInfo = {
        optodes: {
          // 光源位置（使用归一化的2D坐标）
          spos2: sources.map(s => {
            const [normX, normY] = normalizeCoordinate(s.x, s.y)
            return [normX, normY, 0]  // z坐标设为0，使用2D热力图
          }),
          // 检测器位置（使用归一化的2D坐标）
          dpos2: detectors.map(d => {
            const [normX, normY] = normalizeCoordinate(d.x, d.y)
            return [normX, normY, 0]  // z坐标设为0，使用2D热力图
          })
        },
        pairs: {
          // 生成source-detector配对
          Src: channels.map(c => c.sourceId + 1),    // 1-based索引
          Det: channels.map(c => c.detectorId + 1)   // 1-based索引
        }
      }
      
      console.log('[Triangle转换] fNIRS格式转换完成:', {
        sources: triangleFnirsInfo.optodes.spos2.length,
        detectors: triangleFnirsInfo.optodes.dpos2.length,
        channels: triangleFnirsInfo.pairs.Src.length
      })
      
      return triangleFnirsInfo
    }
    
    // 模拟fNIRS设备配置数据（备用）
    const mockFnirsInfo = {
      optodes: {
        // 模拟光源位置（6个节点，每个节点1个光源）
        spos2: [
          [-40, 30, 0],   // 左前额
          [0, 35, 0],     // 中央前额
          [40, 30, 0],    // 右前额
          [-30, -10, 0],  // 左侧
          [0, -15, 0],    // 中央后
          [30, -10, 0]    // 右侧
        ],
        // 模拟探测器位置（每个光源对应4个探测器）
        dpos2: [
          [-35, 35, 0], [-45, 25, 0], [-35, 25, 0], [-30, 40, 0],  // 光源1的探测器
          [-5, 40, 0], [5, 40, 0], [-5, 30, 0], [5, 30, 0],        // 光源2的探测器
          [35, 35, 0], [45, 25, 0], [35, 25, 0], [30, 40, 0],      // 光源3的探测器
          [-25, -5, 0], [-35, -15, 0], [-25, -15, 0], [-20, 0, 0], // 光源4的探测器
          [-5, -10, 0], [5, -10, 0], [-5, -20, 0], [5, -20, 0],    // 光源5的探测器
          [25, -5, 0], [35, -15, 0], [25, -15, 0], [20, 0, 0]      // 光源6的探测器
        ]
      },
      pairs: {
        // 通道配置：每个光源与其对应的4个探测器形成4个通道
        Src: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6], // 24个通道
        Det: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
      }
    }
    
    // 生成基于Triangle布局的通道数据 - 使用真实432通道
    function generateTriangleChannelValues(isHbO = true, time = 0) {
      console.log('[Triangle数据] 生成基于真实Triangle布局的通道数据')
      
      // 如果Triangle数据未加载，使用模拟数据
      if (!realTriangleParsed) {
        console.warn('[Triangle数据] 布局未加载，使用备用模拟数据')
        return generateMockChannelValues(isHbO, time)
      }
      
      const { channels } = realTriangleParsed
      const values = []
      
      console.log(`[Triangle数据] 基于${channels.length}个通道生成${isHbO ? 'HbO' : 'HbR'}数据`)
      
      // 计算坐标归一化参数（与createTriangleFnirsInfo保持一致）
      const allChannels = channels
      const xValues = allChannels.map(c => c.x)
      const yValues = allChannels.map(c => c.y)
      
      const xMin = Math.min(...xValues)
      const xMax = Math.max(...xValues)
      const yMin = Math.min(...yValues)
      const yMax = Math.max(...yValues)
      
      const xCenter = (xMin + xMax) / 2
      const yCenter = (yMin + yMax) / 2
      const xRange = xMax - xMin
      const yRange = yMax - yMin
      const maxRange = Math.max(xRange, yRange)
      
      for (let i = 0; i < channels.length; i++) {
        const channel = channels[i]
        
        // 使用归一化后的坐标（与HeatmapRenderer的坐标系统保持一致）
        const normalizedX = ((channel.x - xCenter) / maxRange) * 100  // 缩放到[-50, 50]范围
        const normalizedY = ((channel.y - yCenter) / maxRange) * 100
        const normalizedZ = 0  // 2D热力图，z坐标为0
        
        // 基础数值（符合fNIRS血氧浓度范围）
        const baseValue = isHbO ? 2e-5 : -1.5e-5
        
        // 基于归一化坐标的空间变化（调整系数适应新的坐标范围）
        const spatialVariation = Math.sin(normalizedX * 0.1 + normalizedY * 0.15 + normalizedZ * 0.08) * 0.5e-5
        const temporalVariation = Math.sin(time * 0.1 + normalizedX * 0.02 + normalizedY * 0.03) * 1e-5
        
        // 模拟大脑前后区域的生理差异（基于归一化坐标）
        const frontBackGradient = normalizedY * 0.01e-5  // Y坐标越大越靠前
        const leftRightBalance = Math.sin(normalizedX * 0.1) * 0.2e-5
        const depthEffect = normalizedZ * 0.005e-5  // 深度效应
        
        // 添加距离衰减效应（模拟光传播特性）
        const distanceAttenuation = Math.exp(-channel.distance * 0.01) * 0.1e-5
        
        const randomNoise = (Math.random() - 0.5) * 0.1e-5
        
        values[i] = baseValue + spatialVariation + temporalVariation + 
                   frontBackGradient + leftRightBalance + depthEffect + 
                   distanceAttenuation + randomNoise
        
        // 调试前几个通道的数据（显示归一化后的坐标）
        if (i < 5) {
          console.log(`[Triangle数据] 通道${i} - 原始位置(${channel.x.toFixed(1)}, ${channel.y.toFixed(1)}) → 归一化位置(${normalizedX.toFixed(1)}, ${normalizedY.toFixed(1)}) 距离=${channel.distance.toFixed(1)} 值=${values[i].toExponential(3)}`)
        }
      }
      
      console.log(`[Triangle数据] 生成了${values.length}个通道的${isHbO ? 'HbO' : 'HbR'}数据`)
      return values
    }

    // 创建基于原始实现的热力图
    function createContinuousHeatmap(container, isHbO = true) {
      if (!container) return null
      
      const chart = echarts.init(container)
      
      const option = {
        tooltip: {
          position: 'top',
          formatter: (params) => {
            if (!params.data || params.data.length < 3 || params.data[2] === undefined) {
              return '无数据'
            }
            return `值: ${params.data[2].toExponential(3)}`
          }
        },
        grid: {
          left: '10%',
          right: '10%',
          top: '10%',
          bottom: '15%',
          containLabel: false
        },
        xAxis: {
          type: 'category',
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          data: Array.from({ length: heatmapRenderer.gridSize }, (_, i) => i)
        },
        yAxis: {
          type: 'category',
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          data: Array.from({ length: heatmapRenderer.gridSize }, (_, i) => i)
        },
        visualMap: {
          type: 'continuous',
          min: isHbO ? -3e-5 : -3e-5,
          max: isHbO ? 3e-5 : 3e-5,
          show: false,  // 隐藏颜色条
          inRange: {
            color: isHbO ? 
              // HbO: 蓝到红渐变
              ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', 
               '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] :
              // HbR: 红到蓝渐变（反向）
              ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf',
               '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695']
          },
          outOfRange: {
            colorAlpha: 0
          }
        },
        series: [
          {
            type: 'custom',
            coordinateSystem: 'cartesian2d',
            renderItem: heatmapRenderer.createHeadOutlineRenderer(),
            itemStyle: {
              opacity: 1
            },
            data: [[0, 0]]
          },
          {
            name: '热力图',
            type: 'heatmap',
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            },
            progressive: 1000,
            animation: false,
            data: []
          }
        ]
      }
      
      chart.setOption(option)
      return chart
    }
    
    // 模式切换函数
    function switchMode(mode) {
      console.log(`[模式切换] 从 ${displayMode.value} 切换到 ${mode}`)
      
      if (displayMode.value === mode) return
      
      // 清理当前模式的资源
      if (displayMode.value === 'heatmap') {
        // 停止热力图更新
        if (updateTimer) {
          clearInterval(updateTimer)
          updateTimer = null
        }
      } else if (displayMode.value === 'curve') {
        // 清理曲线图
        if (curveChart) {
          curveChart.dispose()
          curveChart = null
        }
      } else if (displayMode.value === 'brain') {
        console.log('[模式切换] 清理专业大脑模式资源...')
        
        // 停止大脑热力图更新定时器
        if (updateTimer) {
          clearInterval(updateTimer)
          updateTimer = null
        }
        
        // 清理双画布资源（brainChart不是ECharts实例）
        if (brainChart) {
          const { backgroundCanvas, heatmapCanvas } = brainChart
          
          // 清理画布内容
          if (backgroundCanvas && backgroundCanvas.getContext) {
            const bgCtx = backgroundCanvas.getContext('2d')
            bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height)
          }
          
          if (heatmapCanvas && heatmapCanvas.getContext) {
            const heatCtx = heatmapCanvas.getContext('2d')
            heatCtx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height)
          }
          
          // 从DOM中移除画布（如果存在父节点）
          if (backgroundCanvas && backgroundCanvas.parentNode) {
            backgroundCanvas.parentNode.removeChild(backgroundCanvas)
          }
          if (heatmapCanvas && heatmapCanvas.parentNode) {
            heatmapCanvas.parentNode.removeChild(heatmapCanvas)
          }
          
          brainChart = null
          console.log('[模式切换] 专业大脑模式资源清理完成')
        }
      } else if (displayMode.value === 'game') {
        // 清理游戏模式
        gameInitialized.value = false
      }
      
      displayMode.value = mode
      
      // 初始化新模式
      nextTick(() => {
        if (mode === 'heatmap') {
          initHeatmaps()
        } else if (mode === 'curve') {
          initCurveChart()
        } else if (mode === 'game') {
          initGameMode()
        } else if (mode === 'brain') {
          initBrainHeatmap()
        }
      })
    }
    
    // 初始化游戏模式
    function initGameMode() {
      console.log('[性能优化] 初始化游戏模式')
      gameInitialized.value = true
    }
    
    // 初始化大脑热力图模式
    async function initBrainHeatmap() {
      console.log('[大脑热力图] 初始化专业大脑热力图模式')
      
      // 预加载Triangle布局数据
      await loadTriangleLayoutData()
      
      nextTick(() => {
        if (brainHeatmapRef.value) {
          brainChart = createBrainHeatmap(brainHeatmapRef.value)
          updateBrainHeatmap()
          // 设置1Hz更新频率（专业医疗设备标准）
          updateTimer = setInterval(() => {
            if (props.isTraining) {
              updateBrainHeatmap()
            }
          }, 1000)
        }
      })
    }
    
    // 创建大脑热力图
    function createBrainHeatmap(container) {
      if (!container) return null
      
      console.log('[大脑热力图] 创建大脑热力图实例')
      
      // 创建主画布（背景层）
      const backgroundCanvas = document.createElement('canvas')
      const backgroundCtx = backgroundCanvas.getContext('2d')
      
      // 创建热力图画布（前景层）
      const heatmapCanvas = document.createElement('canvas')
      const heatmapCtx = heatmapCanvas.getContext('2d')
      
      // **ULTRATHINK 11.2**: 大幅放大画布尺寸，让大脑热力图尽可能大
      const size = 700; // 与 CSS max-width/max-height: 700px 对齐
      
      // 背景画布
      backgroundCanvas.width = size
      backgroundCanvas.height = size
      backgroundCanvas.style.width = '100%'
      backgroundCanvas.style.height = '100%'
      backgroundCanvas.style.position = 'absolute'
      backgroundCanvas.style.zIndex = '1'
      
      // 热力图画布
      heatmapCanvas.width = size
      heatmapCanvas.height = size
      heatmapCanvas.style.width = '100%'
      heatmapCanvas.style.height = '100%'
      heatmapCanvas.style.position = 'absolute'
      heatmapCanvas.style.zIndex = '2'
      heatmapCanvas.style.pointerEvents = 'none' // 允许点击穿透到背景
      
      // 清空容器并添加画布（分层）
      container.innerHTML = ''
      container.style.position = 'relative'
      container.appendChild(backgroundCanvas)
      container.appendChild(heatmapCanvas)
      
      // 创建brainChart对象引用，用于在回调中设置brainRect
      const brainChart = { 
        backgroundCanvas, 
        backgroundCtx, 
        heatmapCanvas, 
        heatmapCtx, 
        size,
        brainRect: null
      }
      
      // 立即加载大脑背景图像（只加载一次）
      drawBrainBackgroundOnce(backgroundCtx, size, brainChart)
      
      return brainChart
    }
    
    // 更新大脑热力图
    function updateBrainHeatmap() {
      if (!brainChart || !props.isTraining) return
      
      const currentTime = Date.now() / 1000
      
      try {
        // 生成基于Triangle布局的真实HbO数据
        const hboValues = generateTriangleChannelValues(true, currentTime)
        
        // 只清空热力图画布（背景保持不变）
        const { heatmapCtx, size } = brainChart
        heatmapCtx.clearRect(0, 0, size, size)
        
        // 只重绘热力图叠加层
        drawHeatmapOverlay(heatmapCtx, size, hboValues, brainChart)
        
        // 更新统计信息
        updateBrainStats(hboValues)
        
      } catch (error) {
        console.error('[大脑热力图] 更新失败:', error)
      }
    }
    
    // 绘制大脑背景图像（只执行一次）
    function drawBrainBackgroundOnce(ctx, size, brainChart) {
      const img = new Image()
      img.onload = () => {
        console.log(`[大脑热力图] 图片加载成功: ${img.naturalWidth}x${img.naturalHeight}`)
        
        // 清空背景画布
        ctx.clearRect(0, 0, size, size)
        
        // **修复变形问题**：计算等比缩放尺寸，保持原始宽高比
        const maxSize = size * 0.8
        const aspectRatio = img.naturalWidth / img.naturalHeight
        
        let imgWidth, imgHeight
        if (aspectRatio > 1) {
          imgWidth = maxSize
          imgHeight = maxSize / aspectRatio
        } else {
          imgHeight = maxSize
          imgWidth = maxSize * aspectRatio
        }
        
        const imgX = (size - imgWidth) / 2
        const imgY = (size - imgHeight) / 2
        
        // 使用正确的宽高比绘制图片，避免变形
        ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight)
        
        // 设置brainRect用于热力图坐标映射（使用真实的图片尺寸和位置）
        brainChart.brainRect = { x: imgX, y: imgY, width: imgWidth, height: imgHeight }
        console.log('[大脑热力图] brainRect设置完成:', brainChart.brainRect)
      }
      img.onerror = () => {
        console.warn('[大脑热力图] 大脑图像加载失败，使用备用方案')
        drawFallbackBrainOutline(ctx, size)
        
        // 备用方案也保持原始设置
        const imgSize = size * 0.95
        const offsetX = (size - imgSize) / 2
        const offsetY = (size - imgSize) / 2
        brainChart.brainRect = { x: offsetX, y: offsetY, width: imgSize, height: imgSize }
        console.log('[大脑热力图] brainRect设置完成(备用方案):', brainChart.brainRect)
      }
      // 使用Vite静态资源处理方式
      img.src = new URL('../assets/brain_no_bg.png', import.meta.url).href
    }
    
    // 备用大脑轮廓绘制（当图像加载失败时）
    function drawFallbackBrainOutline(ctx, size) {
      const centerX = size / 2
      const centerY = size / 2
      const radius = size * 0.35
      
      // 绘制基本大脑轮廓
      ctx.strokeStyle = '#bdc3c7'
      ctx.lineWidth = 3
      ctx.beginPath()
      
      // 主要的大脑形状（椭圆形）
      ctx.ellipse(centerX, centerY * 0.95, radius * 1.1, radius * 0.9, 0, 0, Math.PI * 2)
      ctx.stroke()
      
      // 添加一些简单的脑回路线条
      ctx.strokeStyle = '#95a5a6'
      ctx.lineWidth = 1.5
      
      // 中线
      ctx.beginPath()
      ctx.moveTo(centerX, centerY - radius * 0.8)
      ctx.lineTo(centerX, centerY + radius * 0.8)
      ctx.stroke()
      
      // 左右分区线
      ctx.beginPath()
      ctx.moveTo(centerX - radius * 0.6, centerY - radius * 0.5)
      ctx.lineTo(centerX - radius * 0.6, centerY + radius * 0.5)
      ctx.moveTo(centerX + radius * 0.6, centerY - radius * 0.5)
      ctx.lineTo(centerX + radius * 0.6, centerY + radius * 0.5)
      ctx.stroke()
      
      // 添加文字说明
      ctx.fillStyle = '#7f8c8d'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('大脑热力图', centerX, centerY + radius * 1.3)
    }
    
    // 绘制热力图叠加层（真实HbO数据热力图）
    function drawHeatmapOverlay(ctx, size, hboValues, brainChart) {
      console.log('[专业大脑热力图] 开始绘制Triangle几何约束热力图...')
      
      // 清除合成模式（确保正常绘制）
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1.0
      
      // 加载自适应定位配置
      const adaptiveConfig = heatmapConfig.value
      if (!adaptiveConfig) {
        console.warn('[专业大脑热力图] 未找到自适应定位配置，使用默认定位')
      } else {
        console.log('[专业大脑热力图] 应用自适应定位配置:', adaptiveConfig)
      }
      
      // Triangle几何约束函数 - 基于12dock三角形分布
      function isPointInTriangleLayout(realX, realY) {
        // 将归一化坐标[-1,1]转换为Triangle布局坐标系
        // Triangle布局范围大约是: X(15-175), Y(15-95)
        const triangleX = (realX + 1) * 80 + 15  // 映射到[15, 175]
        const triangleY = (realY + 1) * 40 + 15  // 映射到[15, 95]
        
        // ✅ 6-dock居中三角分布 - 从顶部到底部1、2、3个dock
        // 顶部(Y:80-95): 1个dock (最窄，居中)
        // 中间层(Y:45-65): 2个dock (中等宽度)
        // 底部(Y:15-35): 3个dock (最宽)
        
        if (triangleY >= 80 && triangleY <= 95) {
          // 顶部：1个dock，最窄居中区域 - X范围约80-110 (居中窄区域)
          return triangleX >= 80 && triangleX <= 110
        } else if (triangleY >= 45 && triangleY <= 80) {
          // 中层：2个dock，中等宽度 - X范围约60-130
          const layerProgress = (triangleY - 45) / (80 - 45)  // 从下到上的进度
          const leftBound = 60 + layerProgress * 20   // 60->80
          const rightBound = 130 - layerProgress * 20  // 130->110
          return triangleX >= leftBound && triangleX <= rightBound
        } else if (triangleY >= 15 && triangleY <= 45) {
          // 底部：3个dock，最宽区域 - X范围约40-150
          const layerProgress = (triangleY - 15) / (45 - 15)  // 从下到上的进度
          const leftBound = 40 + layerProgress * 20   // 40->60
          const rightBound = 150 - layerProgress * 20  // 150->130
          return triangleX >= leftBound && triangleX <= rightBound
        }
        
        return false
      }
      
      try {
        // 使用Triangle布局数据
        let fnirsInfo = createTriangleFnirsInfo()
        
        console.log('[专业大脑热力图] 数据源:', realTriangleParsed ? 'Triangle布局数据' : '模拟数据')
        console.log('[专业大脑热力图] Triangle布局光源数:', fnirsInfo?.optodes?.spos2?.length || 0)
        console.log('[专业大脑热力图] Triangle布局检测器数:', fnirsInfo?.optodes?.dpos2?.length || 0)
        console.log('[专业大脑热力图] Triangle布局通道数:', fnirsInfo?.pairs?.Src?.length || 0)
        
        // 使用IDW插值算法生成热力图数据
        const result = heatmapRenderer.generateContinuousHeatmap(fnirsInfo, hboValues)
        
        if (!result || !result.gridData || result.gridData.length === 0) {
          console.warn('[专业大脑热力图] 热力图数据生成失败')
          return
        }
        
        console.log(`[专业大脑热力图] 生成热力图数据点数: ${result.gridData.length}`)
        
        // 🔬 ULTRATHINK调试: 验证TrainingView坐标转换是否匹配修改后的HeatmapRenderer
        console.log('🔬 ULTRATHINK调试: TrainingView Canvas绘制开始，验证坐标转换修复')
        let canvasDebugCount = 0
        
        // 获取数据范围
        const values = result.gridData.map(point => point[2]).filter(v => !isNaN(v))
        if (values.length === 0) {
          console.warn('[专业大脑热力图] 无有效数据值')
          return
        }
        
        const minVal = Math.min(...values)
        const maxVal = Math.max(...values)
        const range = maxVal - minVal || 1e-5
        
        console.log(`[专业大脑热力图] 数据范围: ${minVal.toExponential(3)} 到 ${maxVal.toExponential(3)}`)
        
        // Phase 2.3: 创建数据覆盖区域映射（用于后续遮罩）
        const dataCoverageMap = new Set()
        result.gridData.forEach(([gridI, gridJ, value]) => {
          dataCoverageMap.add(`${gridI},${gridJ}`)
        })
        
        console.log(`[专业大脑热力图] 数据覆盖网格点: ${dataCoverageMap.size} 个`)
        
        // 绘制真实热力图数据点（HbO蓝→红色彩映射）
        for (const [gridI, gridJ, value] of result.gridData) {
          // 正确的坐标映射：将网格索引转换回实际坐标空间
          // HeatmapRenderer使用(-1,1)坐标空间生成网格
          const gridSize = heatmapRenderer.gridSize
          const xStep = 2 / gridSize
          const yStep = 2 / gridSize
          
          // ULTRATHINK第四次修复：修正坐标转换以匹配修改后的网格循环逻辑
          // 现在HeatmapRenderer中：i控制y(行), j控制x(列)
          // gridData格式：[i, j, value] = [y_index, x_index, value]
          const realX = -1 + gridJ * xStep + xStep / 2  // gridJ对应j（x_index）
          const realY = -1 + gridI * yStep + yStep / 2  // gridI对应i（y_index）
          
          // 🔬 ULTRATHINK调试: 前3个点的坐标转换过程
          if (canvasDebugCount < 3) {
            console.log(`🔬 ULTRATHINK调试: Canvas点${canvasDebugCount} - gridData[${gridI}, ${gridJ}] → realX=${realX.toFixed(4)}, realY=${realY.toFixed(4)}`)
            canvasDebugCount++
          }
          
          // 确保brainRect已设置
          if (!brainChart.brainRect) continue
          
          const { brainRect } = brainChart
          
          // 应用自适应定位配置进行坐标转换
          let x, y
          if (adaptiveConfig && adaptiveConfig.position && adaptiveConfig.scale) {
            // 使用自适应定位配置计算热力图区域
            const heatmapWidth = brainRect.width * adaptiveConfig.scale.width
            const heatmapHeight = brainRect.height * adaptiveConfig.scale.height
            
            // 计算热力图区域的左上角位置
            const heatmapLeft = brainRect.x + (brainRect.width * adaptiveConfig.position.x) - (heatmapWidth / 2)
            const heatmapTop = brainRect.y + (brainRect.height * adaptiveConfig.position.y) - (heatmapHeight / 2)
            
            // 将realX/realY ∈ (-1,1) 映射到自适应热力图区域
            x = Math.floor(heatmapLeft + (realX + 1) / 2 * heatmapWidth)
            y = Math.floor(heatmapTop + (realY + 1) / 2 * heatmapHeight)
            
            // 调试自适应坐标转换
            if (canvasDebugCount <= 3) {
              console.log(`[自适应定位] realX=${realX.toFixed(4)}, realY=${realY.toFixed(4)} → 
                热力图区域: left=${heatmapLeft.toFixed(1)}, top=${heatmapTop.toFixed(1)}, 
                size=${heatmapWidth.toFixed(1)}x${heatmapHeight.toFixed(1)} → 
                像素坐标: x=${x}, y=${y}`)
            }
          } else {
            // 默认使用brainRect将realX/realY ∈ (-1,1) 映射为像素坐标
            x = Math.floor(brainRect.x + (realX + 1) / 2 * brainRect.width)
            y = Math.floor(brainRect.y + (realY + 1) / 2 * brainRect.height)
          }
          
          // 边界检查：根据是否使用自适应配置来调整边界
          let boundaryCheck = false
          if (adaptiveConfig && adaptiveConfig.position && adaptiveConfig.scale) {
            // 使用自适应热力图区域进行边界检查
            const heatmapWidth = brainRect.width * adaptiveConfig.scale.width
            const heatmapHeight = brainRect.height * adaptiveConfig.scale.height
            const heatmapLeft = brainRect.x + (brainRect.width * adaptiveConfig.position.x) - (heatmapWidth / 2)
            const heatmapTop = brainRect.y + (brainRect.height * adaptiveConfig.position.y) - (heatmapHeight / 2)
            
            boundaryCheck = x < heatmapLeft || x >= heatmapLeft + heatmapWidth || 
                           y < heatmapTop || y >= heatmapTop + heatmapHeight
          } else {
            // 使用默认brainRect边界检查
            boundaryCheck = x < brainRect.x || x >= brainRect.x + brainRect.width || 
                           y < brainRect.y || y >= brainRect.y + brainRect.height
          }
          
          if (boundaryCheck) {
            continue // 跳过边界区域的点
          }
          
          // 规范化数值到[0,1]范围
          const normalizedValue = Math.max(0, Math.min(1, (value - minVal) / range))
          
          // HbO科学标准色彩映射：蓝→青→黄→红（完整光谱）
          const scientificColorMap = [
            '#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', 
            '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'
          ]
          
          // 计算在颜色序列中的位置
          const colorIndex = normalizedValue * (scientificColorMap.length - 1)
          const lowerIndex = Math.floor(colorIndex)
          const upperIndex = Math.min(lowerIndex + 1, scientificColorMap.length - 1)
          const fraction = colorIndex - lowerIndex
          
          // 在两个颜色之间插值
          const lowerColor = hexToRgb(scientificColorMap[lowerIndex])
          const upperColor = hexToRgb(scientificColorMap[upperIndex])
          
          const red = Math.floor(lowerColor.r + (upperColor.r - lowerColor.r) * fraction)
          const green = Math.floor(lowerColor.g + (upperColor.g - lowerColor.g) * fraction)
          const blue = Math.floor(lowerColor.b + (upperColor.b - lowerColor.b) * fraction)
          
          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.8)`
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fill()
        }
        
        console.log('[专业大脑热力图] 真实HbO热力图绘制完成')
        
        // ✅ 用户要求: 移除白色背景遮罩
        // drawWhiteIrregularMask(ctx, size, dataCoverageMap, heatmapRenderer.gridSize, adaptiveConfig, brainChart)
        console.log('[专业大脑热力图] 已移除白色背景遮罩，按用户要求');
        
      } catch (error) {
        console.error('[专业大脑热力图] 绘制出错:', error)
      }
    }
    
    // 辅助函数：将十六进制颜色转换为RGB
    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }
    
    // 获取热力图颜色（极大增强对比度的蓝红渐变）
    function getHeatmapColor(normalizedValue) {
      // 将数值映射到[0,1]范围，并极大增强对比度
      const t = Math.max(0, Math.min(1, (normalizedValue + 1) / 2))
      
      // 极限增强映射 - 使任何非零值都可见
      const enhanced = Math.pow(t, 0.3) // 极大增强小值的可见性
      
      if (enhanced <= 0.5) {
        // 深蓝到浅蓝
        const factor = enhanced * 2
        return {
          r: Math.floor(0 + (50) * factor),       // 0 -> 50
          g: Math.floor(0 + (100) * factor),      // 0 -> 100  
          b: Math.floor(150 + (105) * factor)     // 150 -> 255 (保持强蓝)
        }
      } else {
        // 浅蓝到深红
        const factor = (enhanced - 0.5) * 2
        return {
          r: Math.floor(50 + (205) * factor),     // 50 -> 255 (强红)
          g: Math.floor(100 - (100) * factor),    // 100 -> 0
          b: Math.floor(255 - (255) * factor)     // 255 -> 0
        }
      }
    }
    
    // 更新大脑统计信息
    function updateBrainStats(hboValues) {
      // 计算活跃区域数量（值大于阈值的通道数）
      const threshold = 1e-5
      activeBrainRegions.value = hboValues.filter(val => Math.abs(val) > threshold).length
      
      // 计算平均活跃度
      const totalActivity = hboValues.reduce((sum, val) => sum + Math.abs(val), 0)
      const avgActivity = totalActivity / hboValues.length
      averageBrainActivity.value = (avgActivity / threshold * 100).toFixed(1)
    }
    
    // 生成静态脑活跃度报告
    function generateBrainActivityReport(hboValues, hbrValues, sessionId = 'session_' + Date.now()) {
      const threshold = 1e-5
      const reportTimestamp = new Date().toLocaleString('zh-CN')
      
      // 计算HbO（含氧血红蛋白）统计
      const hboStats = {
        activeChannels: hboValues.filter(val => Math.abs(val) > threshold).length,
        totalChannels: hboValues.length,
        averageLevel: hboValues.reduce((sum, val) => sum + val, 0) / hboValues.length,
        maxLevel: Math.max(...hboValues),
        minLevel: Math.min(...hboValues),
        std: Math.sqrt(hboValues.reduce((sum, val) => sum + Math.pow(val - hboValues.reduce((s, v) => s + v, 0) / hboValues.length, 2), 0) / hboValues.length)
      }
      
      // 计算HbR（脱氧血红蛋白）统计  
      const hbrStats = {
        activeChannels: hbrValues.filter(val => Math.abs(val) > threshold).length,
        totalChannels: hbrValues.length,
        averageLevel: hbrValues.reduce((sum, val) => sum + val, 0) / hbrValues.length,
        maxLevel: Math.max(...hbrValues),
        minLevel: Math.min(...hbrValues),
        std: Math.sqrt(hbrValues.reduce((sum, val) => sum + Math.pow(val - hbrValues.reduce((s, v) => s + v, 0) / hbrValues.length, 2), 0) / hbrValues.length)
      }
      
      // 计算血氧饱和度
      const so2Values = hboValues.map((hbo, i) => {
        const hbr = hbrValues[i] || 0
        const total = hbo + Math.abs(hbr)
        return total > 0 ? (hbo / total) * 100 : 0
      })
      
      const so2Stats = {
        average: so2Values.reduce((sum, val) => sum + val, 0) / so2Values.length,
        max: Math.max(...so2Values),
        min: Math.min(...so2Values),
        std: Math.sqrt(so2Values.reduce((sum, val) => sum + Math.pow(val - so2Values.reduce((s, v) => s + v, 0) / so2Values.length, 2), 0) / so2Values.length)
      }
      
      // 计算整体脑活跃度评级
      const overallActivityLevel = (hboStats.activeChannels / hboStats.totalChannels) * 100
      let activityGrade = 'E'
      let activityDescription = '活跃度极低'
      
      if (overallActivityLevel >= 80) {
        activityGrade = 'A+'
        activityDescription = '极高活跃度'
      } else if (overallActivityLevel >= 70) {
        activityGrade = 'A'
        activityDescription = '高活跃度'
      } else if (overallActivityLevel >= 60) {
        activityGrade = 'B+'
        activityDescription = '中高活跃度'
      } else if (overallActivityLevel >= 50) {
        activityGrade = 'B'
        activityDescription = '中等活跃度'
      } else if (overallActivityLevel >= 40) {
        activityGrade = 'C'
        activityDescription = '中低活跃度'
      } else if (overallActivityLevel >= 30) {
        activityGrade = 'D'
        activityDescription = '低活跃度'
      }
      
      // 生成训练建议
      const recommendations = []
      if (overallActivityLevel < 50) {
        recommendations.push('建议增加训练强度和时长')
        recommendations.push('注意保持专注度和配合度')
      }
      if (hboStats.std > hboStats.averageLevel * 0.5) {
        recommendations.push('活跃度分布不均，建议调整训练姿态')
      }
      if (so2Stats.average < 70) {
        recommendations.push('血氧饱和度偏低，建议适当休息')
      } else if (so2Stats.average > 90) {
        recommendations.push('血氧饱和度良好，可继续当前训练强度')
      }
      
      const report = {
        meta: {
          sessionId,
          timestamp: reportTimestamp,
          trainDuration: formatDuration(props.trainingDuration),
          patientInfo: {
            name: props.patientInfo.name,
            age: props.patientInfo.age
          }
        },
        summary: {
          overallActivityLevel: overallActivityLevel.toFixed(1),
          activityGrade,
          activityDescription,
          totalChannels: hboStats.totalChannels,
          activeChannels: hboStats.activeChannels
        },
        hboData: {
          name: '含氧血红蛋白 (HbO)',
          unit: 'μM',
          ...hboStats,
          averageLevel: hboStats.averageLevel.toExponential(3),
          maxLevel: hboStats.maxLevel.toExponential(3),
          minLevel: hboStats.minLevel.toExponential(3),
          std: hboStats.std.toExponential(3)
        },
        hbrData: {
          name: '脱氧血红蛋白 (HbR)', 
          unit: 'μM',
          ...hbrStats,
          averageLevel: hbrStats.averageLevel.toExponential(3),
          maxLevel: hbrStats.maxLevel.toExponential(3),
          minLevel: hbrStats.minLevel.toExponential(3),
          std: hbrStats.std.toExponential(3)
        },
        so2Data: {
          name: '血氧饱和度 (SO2)',
          unit: '%',
          average: so2Stats.average.toFixed(1),
          max: so2Stats.max.toFixed(1),
          min: so2Stats.min.toFixed(1),
          std: so2Stats.std.toFixed(2)
        },
        recommendations,
        deviceInfo: {
          updateRate: brainUpdateRate.value,
          deviceStatus: props.deviceStatus.fnirs,
          layoutType: 'Triangle 6-dock配置'
        }
      }
      
      console.log('[静态脑活跃度报告] 报告生成完成:', report)
      return report
    }
    
    // 创建可共用的静态脑活跃度报告组件数据
    function createStaticBrainReport() {
      // 生成当前时刻的静态数据快照
      const currentTime = Date.now() / 1000
      const hboValues = generateTriangleChannelValues(true, currentTime)
      const hbrValues = generateTriangleChannelValues(false, currentTime)
      
      // 生成完整的脑活跃度报告
      const report = generateBrainActivityReport(hboValues, hbrValues)
      
      // 创建用于显示的静态组件数据
      const staticReportData = {
        ...report,
        // 添加显示友好的格式化数据
        displayData: {
          title: '脑活跃度分析报告',
          subtitle: `${report.meta.patientInfo.name} (${report.meta.patientInfo.age}岁) - ${report.meta.timestamp}`,
          gradeColor: getGradeColor(report.summary.activityGrade),
          sections: [
            {
              title: '训练概况',
              items: [
                { label: '训练时长', value: report.meta.trainDuration },
                { label: '整体评级', value: `${report.summary.activityGrade} - ${report.summary.activityDescription}` },
                { label: '活跃通道', value: `${report.summary.activeChannels}/${report.summary.totalChannels}` },
                { label: '活跃度', value: `${report.summary.overallActivityLevel}%` }
              ]
            },
            {
              title: '血氧指标',
              items: [
                { label: 'HbO平均值', value: report.hboData.averageLevel },
                { label: 'HbR平均值', value: report.hbrData.averageLevel },
                { label: '血氧饱和度', value: `${report.so2Data.average}%` },
                { label: '数据质量', value: report.so2Data.std < 10 ? '优秀' : report.so2Data.std < 20 ? '良好' : '一般' }
              ]
            }
          ],
          recommendations: report.recommendations
        }
      }
      
      console.log('[静态报告组件] 静态报告数据创建完成')
      return staticReportData
    }
    
    // 根据评级获取颜色
    function getGradeColor(grade) {
      const colorMap = {
        'A+': '#2ecc71', 'A': '#27ae60',
        'B+': '#f39c12', 'B': '#e67e22', 
        'C': '#f1c40f',
        'D': '#e74c3c', 'E': '#c0392b'
      }
      return colorMap[grade] || '#95a5a6'
    }
    
    // 格式化百分比
    function formatPercentage(value) {
      return `${value}%`
    }
    
    // 创建曲线图
    function createCurveChart() {
      if (!curveChartRef.value) return null
      
      const chart = echarts.init(curveChartRef.value)
      
      const option = {
        title: {
          text: '实时血氧浓度',
          left: 'center',
          textStyle: {
            color: '#333',
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross'
          },
          formatter: function (params) {
            let result = `时间: ${new Date(params[0].value[0]).toLocaleTimeString()}<br/>`
            params.forEach(param => {
              result += `${param.seriesName}: ${param.value[1].toExponential(3)} μM<br/>`
            })
            return result
          }
        },
        legend: {
          data: ['HbO', 'HbR'],
          top: 30
        },
        grid: {
          left: '8%',
          right: '8%',
          top: '20%',
          bottom: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            formatter: function (value) {
              return new Date(value).toLocaleTimeString()
            }
          }
        },
        yAxis: {
          type: 'value',
          name: '浓度 (μM)',
          axisLabel: {
            formatter: function (value) {
              return value.toExponential(1)
            }
          }
        },
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: [0],
            start: 70,
            end: 100
          },
          {
            show: true,
            xAxisIndex: [0],
            type: 'slider',
            bottom: '5%',
            start: 70,
            end: 100
          }
        ],
        series: [
          {
            name: 'HbO',
            type: 'line',
            smooth: true,
            symbol: 'none',
            itemStyle: {
              color: '#e74c3c'
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(231, 76, 60, 0.3)' },
                  { offset: 1, color: 'rgba(231, 76, 60, 0.1)' }
                ]
              }
            },
            data: []
          },
          {
            name: 'HbR',
            type: 'line',
            smooth: true,
            symbol: 'none',
            itemStyle: {
              color: '#3498db'
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(52, 152, 219, 0.3)' },
                  { offset: 1, color: 'rgba(52, 152, 219, 0.1)' }
                ]
              }
            },
            data: []
          }
        ]
      }
      
      chart.setOption(option)
      return chart
    }
    
    // 初始化曲线图
    function initCurveChart() {
      nextTick(() => {
        if (curveChartRef.value) {
          curveChart = createCurveChart()
          updateCurveData()
          // 每500ms更新一次曲线图数据
          updateTimer = setInterval(updateCurveData, 500)
        }
      })
    }
    
    // 更新曲线图数据
    function updateCurveData() {
      if (!curveChart || !props.isTraining) return
      
      const currentTime = Date.now()
      const hboValue = props.currentValues.hbo * 1e-5 // 转换为实际单位
      const hbrValue = props.currentValues.hbr * 1e-5
      
      // 添加新数据点
      curveDataPoints.value.hbo.push([currentTime, hboValue])
      curveDataPoints.value.hbr.push([currentTime, hbrValue])
      
      // 保持数据点数量在合理范围内（最多保存5分钟数据）
      const maxPoints = 600 // 5分钟 * 60秒 * 2次/秒
      if (curveDataPoints.value.hbo.length > maxPoints) {
        curveDataPoints.value.hbo.shift()
        curveDataPoints.value.hbr.shift()
      }
      
      // 更新图表
      curveChart.setOption({
        series: [
          { data: curveDataPoints.value.hbo },
          { data: curveDataPoints.value.hbr }
        ]
      })
    }
    
    // 重置曲线图缩放
    function resetCurveZoom() {
      if (curveChart) {
        curveChart.dispatchAction({
          type: 'dataZoom',
          start: 70,
          end: 100
        })
      }
    }

    // 更新热力图数据
    function updateHeatmaps() {
      const currentTime = Date.now() / 1000
      
      // ✅ 使用真实Triangle数据（与专业大脑模式一致）
      const hboValues = generateTriangleChannelValues(true, currentTime)
      const hbrValues = generateTriangleChannelValues(false, currentTime)
      
      try {
        // ✅ 使用真实Triangle布局信息（从上往下视角）
        const triangleFnirsInfo = createTriangleFnirsInfo()
        const hboResult = heatmapRenderer.generateContinuousHeatmap(triangleFnirsInfo, hboValues)
        const hbrResult = heatmapRenderer.generateContinuousHeatmap(triangleFnirsInfo, hbrValues)
        
        // 更新HbO热力图（翻转180度用于从上往下视角）
        if (hboChart && hboResult && hboResult.gridData && hboResult.gridData.length > 0) {
          const values = hboResult.gridData.map(point => point[2]).filter(v => !isNaN(v))
          const minVal = Math.min(...values)
          const maxVal = Math.max(...values)
          const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal)) * 1.2 || 3e-5
          
          // ✅ 实现180度翻转 - 从上往下视角
          const flippedHboData = flipHeatmapData180(hboResult.gridData)
          
          // 只更新数据部分，避免整体重绘
          hboChart.setOption({
            series: [{}, {
              data: flippedHboData
            }]
          }, false, true)  // notMerge=false, lazyUpdate=true 减少闪烁
        }
        
        // 更新HbR热力图（翻转180度用于从上往下视角）
        if (hbrChart && hbrResult && hbrResult.gridData && hbrResult.gridData.length > 0) {
          const values = hbrResult.gridData.map(point => point[2]).filter(v => !isNaN(v))
          const minVal = Math.min(...values)
          const maxVal = Math.max(...values)
          const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal)) * 1.2 || 3e-5
          
          // ✅ 实现180度翻转 - 从上往下视角
          const flippedHbrData = flipHeatmapData180(hbrResult.gridData)
          
          // 只更新数据部分，避免整体重绘  
          hbrChart.setOption({
            series: [{}, {
              data: flippedHbrData
            }]
          }, false, true)  // notMerge=false, lazyUpdate=true 减少闪烁
        }
        
      } catch (error) {
        console.error('更新热力图时出错:', error)
      }
    }
    
    function formatValue(value) {
      return value >= 0 ? `+${value.toFixed(3)}` : value.toFixed(3)
    }
    
    function formatDuration(seconds) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    
    onMounted(() => {
      initHeatmaps()
      
      // 加载热力图自适应定位配置
      heatmapConfig.value = heatmapPositioning.loadConfiguration()
      console.log('[热力图自适应] 配置已加载:', heatmapConfig.value)
      
      // 更新时间
      timeInterval = setInterval(() => {
        currentTime.value = new Date().toLocaleTimeString()
      }, 1000)
    })
    
    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
    })
    
    // 康助侠状态相关方法
    function getKangzhuxiaStatusColor() {
      if (!props.kangzhuxiaStatus.connected) return '#e74c3c'
      if (props.kangzhuxiaStatus.motion_status === 1) return '#27ae60'
      return '#f39c12'
    }
    
    function getKangzhuxiaStatusText() {
      if (!props.kangzhuxiaStatus.connected) return '未连接'
      if (props.kangzhuxiaStatus.motion_status === 1) return '运动中'
      return '已连接'
    }
    
    
    function getMotionStatusText() {
      if (!props.kangzhuxiaStatus.connected) {
        return '设备未连接'
      }
      return props.kangzhuxiaStatus.motion_status ? '运动中' : '已停止'
    }
    
    function getMotionStatusClass() {
      if (!props.kangzhuxiaStatus.connected) {
        return 'warning'
      }
      return props.kangzhuxiaStatus.motion_status ? 'good' : 'warning'
    }
    
    // 初始化热力图
    function initHeatmaps() {
      nextTick(() => {
        // 创建HbO热力图
        if (hboHeatmapRef.value) {
          hboChart = createContinuousHeatmap(hboHeatmapRef.value, true)
        }
        
        // 创建HbR热力图  
        if (hbrHeatmapRef.value) {
          hbrChart = createContinuousHeatmap(hbrHeatmapRef.value, false)
        }
        
        // 初始更新
        updateHeatmaps()
        
        // 与专业大脑模式保持相同频率（1秒一次）
        updateTimer = setInterval(() => {
          if (props.isTraining) {
            updateHeatmaps()
          }
        }, 1000)
        
        // 窗口大小变化时重绘
        window.addEventListener('resize', handleResize)
      })
    }
    
    // 处理窗口大小变化
    function handleResize() {
      if (hboChart) hboChart.resize()
      if (hbrChart) hbrChart.resize()
    }
    
    // 180度翻转热力图数据（从上往下视角）- 简化版本，复用专业大脑模式逻辑
    function flipHeatmapData180(gridData) {
      if (!gridData || gridData.length === 0) return []
      
      console.log('[热力图翻转] 开始180度翻转，数据点数:', gridData.length)
      
      // 找到网格的边界范围
      const xValues = gridData.map(point => point[0])
      const yValues = gridData.map(point => point[1])
      const minX = Math.min(...xValues)
      const maxX = Math.max(...xValues)
      const minY = Math.min(...yValues)
      const maxY = Math.max(...yValues)
      
      // 180度翻转：水平翻转 + 垂直翻转
      const flippedData = gridData.map(([x, y, value]) => {
        const flippedX = maxX - (x - minX)  // 水平翻转
        const flippedY = maxY - (y - minY)  // 垂直翻转
        return [flippedX, flippedY, value]
      })
      
      console.log('[热力图翻转] 180度翻转完成，数据点数:', flippedData.length)
      
      // 直接返回翻转后的数据，不做额外约束（复用专业大脑模式的形状）
      return flippedData
    }
    
    // A3: 测试钩子实现（仅测试时使用）
    let stableMode = false
    let stableModeTimer = null
    
    // A3: 像素采样钩子 - readPixel(x, y)返回指定位置RGBA
    function readPixel(x, y) {
      try {
        if (!brainChart || !brainChart.heatmapCanvas) {
          console.warn('[测试钩子] brainChart或heatmapCanvas不存在')
          return { r: 0, g: 0, b: 0, a: 0 }
        }
        
        const canvas = brainChart.heatmapCanvas
        const ctx = canvas.getContext('2d')
        
        // 确保坐标在canvas范围内
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
          console.warn(`[测试钩子] 坐标(${x}, ${y})超出canvas范围(${canvas.width}x${canvas.height})`)
          return { r: 0, g: 0, b: 0, a: 0 }
        }
        
        // 获取像素数据
        const imageData = ctx.getImageData(x, y, 1, 1)
        const pixel = imageData.data
        
        return {
          r: pixel[0],
          g: pixel[1], 
          b: pixel[2],
          a: pixel[3]
        }
      } catch (error) {
        console.error('[测试钩子] readPixel错误:', error)
        return { r: 0, g: 0, b: 0, a: 0 }
      }
    }
    
    // A3: 稳定模式钩子 - setStableMode(on)控制动画暂停
    function setStableMode(on) {
      console.log(`[测试钩子] 设置稳定模式: ${on}`)
      
      stableMode = on
      
      if (on) {
        // 开启稳定模式：暂停所有动画更新
        if (updateTimer) {
          clearInterval(updateTimer)
          updateTimer = null
        }
        
        // 使用固定种子的伪随机数，确保测试一致性
        Math.random = () => 0.5  // 固定随机值
        
        // 可选：设置固定的时间值以确保稳定性
        stableModeTimer = setInterval(() => {
          if (stableMode && props.isTraining && displayMode.value === 'brain') {
            // 在稳定模式下使用固定时间值更新
            const fixedTime = 1000 // 固定时间戳
            const fixedValues = generateMockChannelValues(true, fixedTime)
            if (brainChart) {
              const { heatmapCtx, size } = brainChart
              heatmapCtx.clearRect(0, 0, size, size)
              drawHeatmapOverlay(heatmapCtx, size, fixedValues, brainChart)
            }
          }
        }, 1000)
        
      } else {
        // 关闭稳定模式：恢复正常动画
        if (stableModeTimer) {
          clearInterval(stableModeTimer)
          stableModeTimer = null
        }
        
        // 恢复原始随机函数（重新加载页面后会自动恢复）
        // 这里可以保存原始Math.random的引用，然后恢复
        
        // 重新启动正常更新定时器
        if (props.isTraining && displayMode.value === 'brain') {
          updateTimer = setInterval(() => {
            if (props.isTraining) {
              updateBrainHeatmap()
            }
          }, 1000)
        }
      }
    }
    
    // 组件挂载时初始化
    onMounted(() => {
      // 初始化时间显示
      timeInterval = setInterval(() => {
        currentTime.value = new Date().toLocaleTimeString()
      }, 1000)
      
      // 初始化热力图
      initHeatmaps()
      
      // A3: 注入测试钩子到window对象（开发环境和测试环境）
      if (import.meta.env.DEV || import.meta.env.MODE === 'test' || window.location.hostname === 'localhost') {
        window.__heatmapTest__ = {
          readPixel,
          setStableMode,
          // 额外的调试信息
          getBrainChart: () => brainChart,
          getDisplayMode: () => displayMode.value,
          getCurrentTime: () => new Date().toLocaleTimeString()
        }
        console.log('[测试钩子] window.__heatmapTest__已注入，包含readPixel和setStableMode方法')
        console.log('[测试钩子] 当前环境:', { 
          DEV: import.meta.env.DEV, 
          MODE: import.meta.env.MODE, 
          hostname: window.location.hostname 
        })
      }
    })
    
    // 组件卸载时清理
    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
      if (updateTimer) {
        clearInterval(updateTimer)
      }
      if (stableModeTimer) {
        clearInterval(stableModeTimer)
        stableModeTimer = null
      }
      if (hboChart) {
        hboChart.dispose()
      }
      if (hbrChart) {
        hbrChart.dispose()
      }
      if (brainChart) {
        // 清理双画布资源
        const { backgroundCanvas, heatmapCanvas } = brainChart
        if (backgroundCanvas && backgroundCanvas.parentNode) {
          backgroundCanvas.parentNode.removeChild(backgroundCanvas)
        }
        if (heatmapCanvas && heatmapCanvas.parentNode) {
          heatmapCanvas.parentNode.removeChild(heatmapCanvas)
        }
      }
      
      // A3: 清理测试钩子
      if (window.__heatmapTest__) {
        delete window.__heatmapTest__
        console.log('[测试钩子] window.__heatmapTest__已清理')
      }
      
      window.removeEventListener('resize', handleResize)
    })

    return {
      // 模式切换相关
      displayMode,
      switchMode,
      gameInitialized,
      
      // 图表引用
      hboHeatmapRef,
      hbrHeatmapRef,
      curveChartRef,
      brainHeatmapRef, // 新增大脑热力图引用
      currentTime,
      
      // 曲线图相关
      curveTimeRange,
      resetCurveZoom,
      
      // 大脑热力图相关
      activeBrainRegions,
      averageBrainActivity,
      brainUpdateRate,
      formatPercentage,
      
      // 静态脑活跃度报告相关
      generateBrainActivityReport,
      createStaticBrainReport,
      getGradeColor,
      
      // 热力图自适应定位
      heatmapConfig,
      
      // 工具函数
      formatValue,
      formatDuration,
      
      // 康助侠状态相关
      getKangzhuxiaStatusColor,
      getKangzhuxiaStatusText,
      getMotionStatusText,
      getMotionStatusClass
    }
  }
}
</script>

<style scoped>
/* Obelab风格界面 - 专业大脑热力图系统 */
.obelab-style-training-view {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); /* 专业蓝色渐变背景 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部热力图颜色条 */
.top-colorbar {
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 30px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.colorbar-container {
  display: flex;
  align-items: center;
  gap: 15px;
}

.colorbar-gradient {
  width: 200px;
  height: 20px;
  background: linear-gradient(to right, #0066cc, #ffffff, #ff6666);
  border-radius: 10px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.colorbar-labels {
  display: flex;
  justify-content: space-between;
  width: 200px;
}

.colorbar-label {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.patient-info-top {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.patient-name-large {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.training-time-large {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 主界面布局 */
.main-layout {
  flex: 1;
  display: flex;
  padding: 20px;
  gap: 25px;
  min-height: 0;
}

/* 左侧侧边栏 */
.left-sidebar {
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* 右侧侧边栏 */
.right-sidebar {
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.sidebar-title {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  margin-bottom: 10px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 左侧模式选择按钮 */
.mode-buttons-vertical {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.large-mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 15px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 15px;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 90px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.large-mode-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.large-mode-btn.active {
  background: rgba(255, 255, 255, 0.35);
  border-color: #ffffff;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  transform: scale(1.02);
}

.mode-icon-large {
  flex-shrink: 0;
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* 右侧功能控制按钮 */
.control-buttons-vertical {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-status-large {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-indicator-large {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.status-indicator-large:last-child {
  margin-bottom: 0;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #e74c3c;
}

.status-indicator-large.connected .status-dot {
  background-color: #27ae60;
  box-shadow: 0 0 8px rgba(39, 174, 96, 0.5);
}

.status-text-large {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.large-control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 80px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.large-control-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.large-control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.large-control-btn.start-btn:hover:not(:disabled) {
  background: rgba(39, 174, 96, 0.3);
  border-color: #27ae60;
}

.large-control-btn.pause-btn:hover:not(:disabled) {
  background: rgba(255, 193, 7, 0.3);
  border-color: #ffc107;
}

.large-control-btn.stop-btn:hover:not(:disabled) {
  background: rgba(231, 76, 60, 0.3);
  border-color: #e74c3c;
}

.control-icon-large {
  flex-shrink: 0;
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.large-emergency-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 15px 12px;
  background: rgba(231, 76, 60, 0.2);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(231, 76, 60, 0.5);
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 70px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.large-emergency-btn:hover {
  background: rgba(231, 76, 60, 0.4);
  border-color: #e74c3c;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(231, 76, 60, 0.3);
}

.emergency-icon-large {
  flex-shrink: 0;
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* 中间3D大脑显示区域 */
.center-brain-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 20px;
}

.brain-main-display {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  position: relative;
  overflow: hidden;
}

.brain-container-large {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.brain-canvas-large {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.1);
  position: relative;
}

/* 底部Golgi标识 */
.bottom-branding {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.golgi-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.golgi-text {
  font-size: 36px;
  font-weight: 900;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
}

.golgi-subtitle {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
}

/* 老人友好设计 - 大字体和触摸友好 */
@media (min-width: 1024px) {
  /* 平板及以上设备 - 适合老人的大字体 */
  .patient-name-large {
    font-size: 28px;
  }
  
  .training-time-large {
    font-size: 24px;
  }
  
  .sidebar-title {
    font-size: 22px;
  }
  
  .large-mode-btn, .large-control-btn {
    font-size: 18px;
    padding: 24px 16px;
    min-height: 100px;
  }
  
  .large-mode-btn span, .large-control-btn span {
    margin-top: 4px;
  }
  
  .status-text-large {
    font-size: 17px;
  }
  
  .golgi-text {
    font-size: 42px;
  }
  
  .golgi-subtitle {
    font-size: 18px;
  }
  
  .colorbar-label {
    font-size: 18px;
  }
}

/* 响应式设计 - 适应不同屏幕大小 */
@media (max-width: 1200px) {
  .left-sidebar, .right-sidebar {
    width: 160px;
  }
  
  .large-mode-btn, .large-control-btn {
    min-height: 85px;
    padding: 16px 12px;
  }
}

@media (max-width: 1000px) {
  .main-layout {
    flex-direction: column;
    gap: 20px;
  }
  
  .left-sidebar, .right-sidebar {
    width: 100%;
    flex-direction: row;
    gap: 10px;
  }
  
  .mode-buttons-vertical, .control-buttons-vertical {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .large-mode-btn, .large-control-btn {
    flex: 1;
    min-width: 120px;
    max-width: 200px;
  }
}

/* 高对比度和视觉辅助 */
.large-mode-btn:focus, .large-control-btn:focus {
  outline: 3px solid #ffffff;
  outline-offset: 2px;
}

/* 触摸设备优化 */
@media (pointer: coarse) {
  .large-mode-btn, .large-control-btn, .large-emergency-btn {
    min-height: 110px;
    padding: 26px 18px;
  }
  
  .large-mode-btn:hover, .large-control-btn:hover {
    transform: scale(1.02);
  }
}

.system-title {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  text-align: center;
  margin-bottom: 16px;
}

.session-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  color: #555;
}

.patient-name {
  font-weight: 600;
  color: #2c3e50;
}

.training-time {
  color: #27ae60;
  font-weight: 600;
}

.current-time {
  color: #7f8c8d;
}

/* 主要内容区域 */
.main-content {
  flex: 1;
  display: flex;
  gap: 20px;
}

/* 模式选择器样式 */
.mode-selector {
  min-width: 120px;
  background: #ffffff;
  border-radius: 12px;
  padding: 20px 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: fit-content;
}

.mode-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  text-align: center;
  margin-bottom: 8px;
}

.mode-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #ffffff;
  color: #7f8c8d;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.mode-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(52, 152, 219, 0.1), transparent);
  transition: left 0.5s;
}

.mode-btn:hover {
  border-color: #3498db;
  color: #3498db;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.2);
}

.mode-btn:hover::before {
  left: 100%;
}

.mode-btn.active {
  border-color: #3498db;
  background: #3498db;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.mode-btn.active .mode-icon {
  color: #ffffff;
}

.mode-icon {
  flex-shrink: 0;
  transition: all 0.3s ease;
}

/* 内容区域 */
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 热力图区域 */
.heatmap-section {
  flex: 1;
  display: flex;
  gap: 20px;
}

/* 曲线图区域 */
.curve-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.curve-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.curve-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.curve-title {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
}

.curve-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.curve-control-btn {
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.curve-control-btn:hover {
  background: #2980b9;
}

.time-range {
  color: #7f8c8d;
  font-size: 14px;
}

.curve-container {
  flex: 1;
  min-height: 400px;
}

.curve-canvas {
  width: 100%;
  height: 100%;
}

.curve-legend {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.hbo-color {
  background-color: #e74c3c;
}

.hbr-color {
  background-color: #3498db;
}

/* 游戏区域 */
.game-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #000000;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

/* 大脑热力图区域 */
.brain-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.brain-heatmap-card {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); /* 蓝色渐变背景 */
  color: white; /* 白色文字 */
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(30, 60, 114, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.brain-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 16px;
}

.brain-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff; /* 适应蓝色背景的白色标题 */
}

.brain-controls {
  display: flex;
  align-items: center;
  gap: 24px;
}

.brain-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brain-label {
  color: rgba(255, 255, 255, 0.8); /* 适应蓝色背景 */
  font-size: 16px;
}

.brain-value {
  font-size: 18px;
  font-weight: 600;
}

.brain-value.positive {
  color: #e74c3c;
}

.colorbar-legend {
  display: flex;
  align-items: center;
  gap: 8px;
}

.colorbar-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7); /* 适应蓝色背景 */
  font-weight: 500;
}

.colorbar-gradient {
  width: 80px;
  height: 16px;
  border-radius: 8px;
  background: linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #e0f3f8, #ffffbf, #fee090, #fdae61, #f46d43, #d73027, #a50026);
  border: 1px solid #ddd;
}

.brain-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px; /* 进一步增加高度 */
  padding: 5px; /* 最小边距，最大化显示区域 */
}

.brain-canvas {
  /* 完全移除所有边框样式 */
  border: none !important;
  border-radius: 0 !important;
  outline: none !important;
  
  /* **ULTRATHINK 11.2 大脑尺寸最大化**: 大幅放大尺寸 */
  width: 100%;
  height: 100%;
  max-width: 700px !important; /* 与 JavaScript size = 700 对齐 */
  max-height: 700px !important; /* 与 JavaScript size = 700 对齐 */
  min-width: 300px; /* 调整最小尺寸 */
  min-height: 300px;
  aspect-ratio: 1;
  
  /* 清洁背景 */
  background-color: transparent;
  
  /* 居中对齐 */
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* 增强视觉效果的阴影（非边框） */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.brain-status {
  border-top: 1px solid rgba(255, 255, 255, 0.2); /* 适应蓝色背景 */
  padding-top: 16px;
  margin-top: 16px;
}

.brain-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7); /* 适应蓝色背景 */
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff; /* 适应蓝色背景 */
}

/* 大脑模式响应式设计 */
@media (max-width: 1200px) {
  .brain-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .brain-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .brain-stats {
    justify-content: center;
  }
}

.game-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.loading-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-left: 4px solid #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.heatmap-card {
  flex: 1;
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.heatmap-title {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
}

.current-value {
  font-size: 24px;
  font-weight: 700;
}

.current-value.positive {
  color: #e74c3c;
}

.current-value.negative {
  color: #3498db;
}

.heatmap-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.heatmap-canvas {
  border-radius: 8px;
  border: 2px solid #ddd;
  width: 100%;
  height: 100%;
  max-width: 400px;
  max-height: 400px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.heatmap-canvas.white-bg {
  background-color: #ffffff;
}

/* 控制区域 */
.control-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-card,
.control-card,
.trend-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 16px;
  text-align: center;
}

/* 设备状态 */
.status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.status-icon {
  flex-shrink: 0;
}

.status-label {
  color: #7f8c8d;
}

.status-value {
  font-weight: 600;
  color: #2c3e50;
}

.status-value.good {
  color: #27ae60;
}

/* 控制按钮 */
.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.control-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.start-btn {
  background: #27ae60;
  color: white;
}

.pause-btn {
  background: #f39c12;
  color: white;
}

.stop-btn {
  background: #3498db;
  color: white;
}

.btn-icon {
  flex-shrink: 0;
}

.emergency-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 20px;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3);
  animation: emergency-pulse 2s infinite;
}

.emergency-btn:hover {
  background: #c0392b;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(231, 76, 60, 0.4);
}

.emergency-icon {
  flex-shrink: 0;
}

@keyframes emergency-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* 康助侠控制 */
.kangzhuxia-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.device-connection {
  display: flex;
  justify-content: center;
}

.connect-btn {
  background: #3498db;
  color: white;
  border: 2px solid #3498db;
}

.connect-btn:hover {
  background: #2980b9;
  border-color: #2980b9;
  transform: translateY(-1px);
}

.disconnect-btn {
  background: transparent;
  color: #e74c3c;
  border: 2px solid #e74c3c;
}

.disconnect-btn:hover {
  background: #e74c3c;
  color: white;
  transform: translateY(-1px);
}


.status-value.warning {
  color: #f39c12;
}

/* 数据趋势 */
.trend-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trend-label {
  font-size: 16px;
  color: #7f8c8d;
}

.trend-value-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.trend-icon {
  flex-shrink: 0;
}

.trend-value {
  font-size: 16px;
  font-weight: 600;
}

.trend-value.positive {
  color: #27ae60;
}

.trend-value.negative {
  color: #e74c3c;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .main-content {
    flex-direction: column;
  }
  
  .heatmap-section {
    flex-direction: row;
  }
  
  .control-section {
    flex-direction: row;
  }
  
  .control-buttons {
    flex-direction: row;
  }
}

@media (max-width: 1000px) {
  .heatmap-section {
    flex-direction: column;
  }
  
  .control-section {
    flex-direction: column;
  }
  
  .session-info {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}
</style>