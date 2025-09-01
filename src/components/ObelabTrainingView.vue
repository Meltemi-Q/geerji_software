<template>
  <div class="obelab-style-training-view">
    <!-- 顶部标题栏 -->
    <div class="top-header">
      <div class="system-branding">
        <span class="golgi-text-header">Golgi</span>
        <span class="system-subtitle">近红外脑氧监测系统</span>
      </div>
      <!-- 患者信息显示在右上角 -->
      <div class="patient-info-header">
        <span class="patient-name-header">{{ patientInfo.name }} ({{ patientInfo.age }}岁)</span>
        <span class="training-time-header">{{ formatDuration(trainingDuration) }}</span>
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
          <!-- 专业大脑模式专用颜色条 -->
          <div class="brain-colorbar">
            <div class="brain-colorbar-gradient"></div>
            <div class="brain-colorbar-labels">
              <span class="brain-colorbar-label">-0.05</span>
              <span class="brain-colorbar-label">0.00</span>
              <span class="brain-colorbar-label">+0.05</span>
            </div>
          </div>
          
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
        <div v-else-if="displayMode === 'curve'" class="curve-section">
          <div class="curve-card">
            <div class="curve-header">
              <h3 class="curve-title">血氧数据实时曲线</h3>
            </div>
            <div class="curve-container">
              <div ref="curveChartRef" class="curve-canvas"></div>
            </div>
          </div>
        </div>

        <!-- 游戏模式 -->
        <div v-else-if="displayMode === 'game'" class="game-section">
          <div class="game-placeholder">
            <h3>交互游戏模式</h3>
            <p>游戏功能开发中...</p>
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
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { HeatmapRenderer } from '../utils/HeatmapRenderer.js'
import { 
  loadTriangleLayoutData, 
  parseTriangleLayoutForHeatmap, 
  createTriangleFnirsInfo,
  createChannelMapping 
} from '../utils/fnirsLayout.js'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { 
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  LegendComponent,
  DataZoomComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 注册ECharts组件
echarts.use([
  LineChart,
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer
])

// 加载配置（默认值，支持配置化）
const defaultConfig = {
  flipYForReport: false,
  idwPower: 2,
  scaleClampStrategy: "default",
  minScaleGuard: false,
  maskAlpha: 0.3
}

// 尝试加载外部配置
let heatmapConfig = defaultConfig
try {
  const configResponse = await fetch('/heatmap_renderer_config.json')
  const externalConfig = await configResponse.json()
  heatmapConfig = { ...defaultConfig, ...externalConfig.config }
  console.log('[训练界面] 已加载外部配置:', heatmapConfig)
} catch (error) {
  console.log('[训练界面] 使用默认配置:', error.message)
}

export default {
  name: 'ObelabTrainingView',
  props: {
    hboData: Array,
    hbrData: Array,
    currentValues: Object,
    trainingDuration: Number,
    isTraining: Boolean,
    patientInfo: Object,
    deviceStatus: Object,
    kangzhuxiaStatus: Object
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
    
    // 引用
    const brainHeatmapRef = ref(null)
    const hboHeatmapRef = ref(null)
    const hbrHeatmapRef = ref(null)
    const curveChartRef = ref(null)
    
    // 大脑热力图相关
    let brainChart = null
    
    // 曲线图相关
    let curveChart = null
    const curveDataPoints = ref({ hbo: [], hbr: [] })
    const curveTimeRange = ref(10) // 默认显示10秒数据
    
    // 创建热力图渲染器实例
    const heatmapRenderer = new HeatmapRenderer(heatmapConfig)
    
    // 模式切换函数
    function switchMode(mode) {
      console.log(`[Obelab界面] 从 ${displayMode.value} 切换到 ${mode}`)
      displayMode.value = mode
      
      // 切换到曲线模式时初始化曲线图
      if (mode === 'curve') {
        nextTick(() => {
          initializeCurveChart()
        })
      }
    }
    
    // 初始化曲线图
    function initializeCurveChart() {
      if (!curveChartRef.value || curveChart) return
      
      console.log('[数据曲线] 初始化ECharts曲线图')
      
      curveChart = echarts.init(curveChartRef.value)
      
      const option = {
        title: {
          text: '血氧数据实时曲线',
          left: 'center',
          textStyle: {
            color: '#333',
            fontSize: 18,
            fontWeight: 600
          }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross'
          }
        },
        legend: {
          data: ['HbO (含氧血红蛋白)', 'HbR (脱氧血红蛋白)'],
          top: 30
        },
        grid: {
          left: '10%',
          right: '10%',
          bottom: '20%',
          top: '25%',
          containLabel: true
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            formatter: function(value) {
              return new Date(value).toLocaleTimeString()
            }
          }
        },
        yAxis: {
          type: 'value',
          name: '浓度变化 (μM)',
          splitLine: {
            lineStyle: {
              type: 'dashed'
            }
          }
        },
        dataZoom: [
          {
            type: 'inside',
            start: 0,
            end: 100,
            filterMode: 'none'
          },
          {
            type: 'slider',
            start: 0,
            end: 100,
            filterMode: 'none',
            height: 30,
            bottom: 30,
            handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
            handleSize: '80%'
          }
        ],
        series: [
          {
            name: 'HbO (含氧血红蛋白)',
            type: 'line',
            smooth: true,
            symbol: 'none',
            lineStyle: {
              color: '#dc3545',
              width: 2
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(220, 53, 69, 0.3)' },
                  { offset: 1, color: 'rgba(220, 53, 69, 0.1)' }
                ]
              }
            },
            data: []
          },
          {
            name: 'HbR (脱氧血红蛋白)',
            type: 'line',
            smooth: true,
            symbol: 'none',
            lineStyle: {
              color: '#007bff',
              width: 2
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(0, 123, 255, 0.3)' },
                  { offset: 1, color: 'rgba(0, 123, 255, 0.1)' }
                ]
              }
            },
            data: []
          }
        ]
      }
      
      curveChart.setOption(option)
      
      // 窗口大小变化时重新调整
      window.addEventListener('resize', () => {
        if (curveChart) {
          curveChart.resize()
        }
      })
      
      console.log('[数据曲线] ECharts曲线图初始化完成')
    }
    
    // 更新曲线数据
    function updateCurveData() {
      if (!curveChart || !props.currentValues) return
      
      const now = Date.now()
      const timeWindow = curveTimeRange.value * 1000 // 转换为毫秒
      
      // 使用真实SDK数据
      const hboValue = props.currentValues?.hbo
      const hbrValue = props.currentValues?.hbr
      
      // 只有在有真实数据时才添加数据点
      if (hboValue != null && hbrValue != null) {
        // 添加新数据点
        curveDataPoints.value.hbo.push({ time: now, value: hboValue })
        curveDataPoints.value.hbr.push({ time: now, value: hbrValue })
        
        // 清理过期数据点（超过时间窗口的）
        const cutoffTime = now - timeWindow
        
        // 如果数据不足10秒，显示所有数据
        const dataStartTime = curveDataPoints.value.hbo.length > 0 ? curveDataPoints.value.hbo[0].time : now
        const dataAge = now - dataStartTime
        
        if (dataAge >= 10000) {
          // 已经积累了10秒以上的数据，只保留最近10秒
          curveDataPoints.value.hbo = curveDataPoints.value.hbo.filter(point => point.time > cutoffTime)
          curveDataPoints.value.hbr = curveDataPoints.value.hbr.filter(point => point.time > cutoffTime)
        }
        // 否则保留所有数据（不足10秒时显示所有）
        
        // 转换为ECharts数据格式
        const hboSeriesData = curveDataPoints.value.hbo.map(point => [point.time, point.value])
        const hbrSeriesData = curveDataPoints.value.hbr.map(point => [point.time, point.value])
        
        // 更新图表数据
        curveChart.setOption({
          series: [
            { data: hboSeriesData },
            { data: hbrSeriesData }
          ]
        }, false, true)
      }
    }
    
    // 格式化函数
    function formatValue(value) {
      return value?.toFixed(3) || '0.000'
    }
    
    function formatDuration(seconds) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    
    // 康助侠状态相关
    function getKangzhuxiaStatusText() {
      if (!props.kangzhuxiaStatus.connected) return '未连接'
      if (props.kangzhuxiaStatus.motion_status === 1) return '运动中'
      return '已连接'
    }
    
    // 生命周期
    onMounted(() => {
      console.log('[Obelab界面] 组件已挂载')
      // 初始化3D大脑热力图
      nextTick(() => {
        if (brainHeatmapRef.value) {
          initBrainHeatmap()
        }
      })
    })
    
    // 监听显示模式切换
    watch(displayMode, (newMode, oldMode) => {
      console.log(`[Obelab界面] 显示模式从 ${oldMode} 切换到 ${newMode}`)
      if (newMode === 'brain') {
        // 切换到专业大脑模式时重新初始化
        nextTick(() => {
          if (brainHeatmapRef.value) {
            initBrainHeatmap()
          }
        })
      }
    })
    
    // 监听数据变化以更新曲线图
    watch(() => props.currentValues, () => {
      if (displayMode.value === 'curve') {
        updateCurveData()
      }
    }, { deep: true })
    
    // 初始化专业大脑热力图
    async function initBrainHeatmap() {
      console.log('[训练界面-大脑热力图] 初始化专业大脑热力图')
      
      // 预加载Triangle布局数据
      await loadTriangleLayoutData()
      
      brainChart = await createBrainHeatmap(brainHeatmapRef.value)
      if (brainChart) {
        console.log('[训练界面-大脑热力图] 专业大脑热力图初始化成功')
      }
    }
    
    // 创建大脑热力图（双Canvas设计）
    async function createBrainHeatmap(container) {
      if (!container) return null
      
      // 创建背景Canvas（背景层）
      const backgroundCanvas = document.createElement('canvas')
      const backgroundCtx = backgroundCanvas.getContext('2d')
      
      // 创建热力图Canvas（前景层）
      const heatmapCanvas = document.createElement('canvas')
      const heatmapCtx = heatmapCanvas.getContext('2d')
      
      // 设置固定尺寸
      const size = 700 // 训练界面使用更大尺寸
      
      // 背景Canvas配置
      backgroundCanvas.width = size
      backgroundCanvas.height = size
      backgroundCanvas.style.width = `${size}px` // 使用固定尺寸保持1:1比例
      backgroundCanvas.style.height = `${size}px`
      backgroundCanvas.style.position = 'absolute'
      backgroundCanvas.style.zIndex = '1'
      backgroundCanvas.style.top = '50%'
      backgroundCanvas.style.left = '50%'
      backgroundCanvas.style.transform = 'translate(-50%, -50%)' // 居中显示
      backgroundCanvas.style.maxWidth = '100%' // 响应式限制
      backgroundCanvas.style.maxHeight = '100%'
      
      // 热力图Canvas配置
      heatmapCanvas.width = size
      heatmapCanvas.height = size
      heatmapCanvas.style.width = `${size}px` // 使用固定尺寸保持1:1比例
      heatmapCanvas.style.height = `${size}px`
      heatmapCanvas.style.position = 'absolute'
      heatmapCanvas.style.zIndex = '2'
      heatmapCanvas.style.pointerEvents = 'none'
      heatmapCanvas.style.top = '50%'
      heatmapCanvas.style.left = '50%'
      heatmapCanvas.style.transform = 'translate(-50%, -50%)' // 居中显示
      heatmapCanvas.style.maxWidth = '100%' // 响应式限制
      heatmapCanvas.style.maxHeight = '100%'
      
      // 清空容器并添加分层Canvas
      container.innerHTML = ''
      container.style.position = 'relative'
      container.appendChild(backgroundCanvas)
      container.appendChild(heatmapCanvas)
      
      // 创建brainChart对象
      const brainChart = {
        backgroundCanvas,
        backgroundCtx,
        heatmapCanvas,
        heatmapCtx,
        size,
        brainRect: null
      }
      
      // 加载无背景大脑图片
      const img = new Image()
      img.onload = () => {
        console.log(`[训练界面-大脑热力图] 图片加载成功: ${img.naturalWidth}x${img.naturalHeight}`)
        
        // 清空背景画布
        backgroundCtx.clearRect(0, 0, size, size)
        
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
        backgroundCtx.drawImage(img, imgX, imgY, imgWidth, imgHeight)
        
        // 设置brainRect用于热力图坐标映射（使用真实的图片尺寸和位置）
        brainChart.brainRect = { x: imgX, y: imgY, width: imgWidth, height: imgHeight }
        console.log('[训练界面-大脑热力图] brainRect设置完成:', brainChart.brainRect)
        
        // 立即绘制真实热力图（而非模拟点）
        initializeHeatmapData()
      }
      
      img.onerror = () => {
        console.warn('[训练界面-大脑热力图] 大脑图片加载失败，使用备用方案')
        
        // 使用简单的圆形背景
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        backgroundCtx.fillStyle = 'rgba(100, 116, 139, 0.1)'
        backgroundCtx.beginPath()
        backgroundCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        backgroundCtx.fill()
        
        // **修复变形问题**：设置默认brainRect保持比例
        const imgSize = size * 0.95
        const offsetX = (size - imgSize) / 2
        const offsetY = (size - imgSize) / 2
        brainChart.brainRect = { x: offsetX, y: offsetY, width: imgSize, height: imgSize }
        
        // 绘制热力图
        initializeHeatmapData()
      }
      
      // 使用brain_no_bg.png
      img.src = new URL('../assets/brain_no_bg.png', import.meta.url).href
      return brainChart
    }
    
    // 生成基于Triangle布局的通道数据
    async function generateTriangleChannelValues(isHbO = true, time = 0) {
      try {
        // 确保Triangle数据已加载
        const layoutData = await loadTriangleLayoutData()
        if (!layoutData) {
          console.warn('[训练界面-Triangle数据] 布局数据加载失败，使用备用模拟数据')
          return generateMockChannelValues(isHbO, time)
        }
        
        // 解析布局获取通道信息
        const parsedData = parseTriangleLayoutForHeatmap(layoutData)
        const { channels } = parsedData
        const values = []
        
        for (let i = 0; i < channels.length; i++) {
          const channel = channels[i]
          
          const baseValue = isHbO ? 2e-5 : -1.5e-5
          const spatialVariation = Math.sin(channel.x * 0.1 + channel.y * 0.15) * 0.5e-5
          const temporalVariation = Math.sin(time * 0.1 + channel.x * 0.02 + channel.y * 0.03) * 1e-5
          const randomNoise = (Math.random() - 0.5) * 0.1e-5
          
          values[i] = baseValue + spatialVariation + temporalVariation + randomNoise
        }
        
        return values
      } catch (error) {
        console.warn('[训练界面-Triangle数据] 生成失败，使用备用模拟数据:', error)
        return generateMockChannelValues(isHbO, time)
      }
    }
    
    // 生成模拟数据（备用）
    function generateMockChannelValues(isHbO = true, time = 0) {
      const channelCount = 24
      const values = []
      
      for (let i = 0; i < channelCount; i++) {
        const baseValue = isHbO ? 2e-5 : -1.5e-5
        const spatialVariation = Math.sin(i * 0.5 + time * 0.1) * 0.5e-5
        const randomNoise = (Math.random() - 0.5) * 0.1e-5
        
        values[i] = baseValue + spatialVariation + randomNoise
      }
      
      return values
    }
    
    // 初始化热力图数据
    async function initializeHeatmapData() {
      console.log('[训练界面-大脑热力图] 初始化热力图数据')
      
      try {
        // 预加载Triangle布局数据
        await loadTriangleLayoutData()
        
        // 获取fNIRS配置信息
        const fnirsInfo = createTriangleFnirsInfo()
        
        // 生成初始HbO数据
        const currentTime = Date.now() / 1000
        const channelValues = await generateTriangleChannelValues(true, currentTime)
        
        // 绘制热力图
        if (brainChart) {
          drawHeatmapOverlay(brainChart, fnirsInfo, channelValues)
        }
        
        console.log('[训练界面-大脑热力图] 初始化完成')
      } catch (error) {
        console.error('[训练界面-大脑热力图] 初始化失败:', error)
      }
    }
    
    // 模拟fNIRS设备配置数据（备用）
    const mockFnirsInfo = {
      optodes: {
        spos2: [
          [-40, 30, 0], [0, 35, 0], [40, 30, 0],
          [-30, -10, 0], [0, -15, 0], [30, -10, 0]
        ],
        dpos2: [
          [-35, 35, 0], [-45, 25, 0], [-35, 25, 0], [-30, 40, 0],
          [-5, 40, 0], [5, 40, 0], [-5, 30, 0], [5, 30, 0],
          [35, 35, 0], [45, 25, 0], [35, 25, 0], [30, 40, 0],
          [-25, -5, 0], [-35, -15, 0], [-25, -15, 0], [-20, 0, 0],
          [-5, -10, 0], [5, -10, 0], [-5, -20, 0], [5, -20, 0],
          [25, -5, 0], [35, -15, 0], [25, -15, 0], [20, 0, 0]
        ]
      },
      pairs: {
        Src: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6],
        Det: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
      }
    }
    
    // 绘制真实热力图数据
    function drawHeatmapOverlay(brainChart, fnirsInfo, channelValues) {
      if (!brainChart || !brainChart.brainRect) {
        console.warn('[训练界面-大脑热力图] brainRect未设置，无法绘制热力图')
        return
      }
      
      console.log('[训练界面-大脑热力图] 开始绘制真实热力图数据')
      
      const { heatmapCtx, size, brainRect } = brainChart
      
      // 清空热力图Canvas
      heatmapCtx.clearRect(0, 0, size, size)
      
      try {
        // 使用HeatmapRenderer生成热力图数据
        const heatmapResult = heatmapRenderer.generateContinuousHeatmap(fnirsInfo, channelValues)
        
        if (!heatmapResult || !heatmapResult.gridData || heatmapResult.gridData.length === 0) {
          console.warn('[训练界面-大脑热力图] 热力图数据生成失败')
          return
        }
        
        console.log(`[训练界面-大脑热力图] 生成热力图数据点数: ${heatmapResult.gridData.length}`)
        
        // 计算数据范围
        const values = heatmapResult.gridData.map(point => point[2]).filter(v => !isNaN(v))
        if (values.length === 0) return
        
        const minVal = Math.min(...values)
        const maxVal = Math.max(...values)
        const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal)) || 0.05
        
        // 绘制热力图点
        const gridSize = heatmapRenderer.gridSize
        const xStep = 2 / gridSize
        const yStep = 2 / gridSize
        
        for (const [gridI, gridJ, value] of heatmapResult.gridData) {
          // 坐标转换：网格索引转换为实际坐标
          const realX = -1 + gridJ * xStep + xStep / 2
          const realY = -1 + gridI * yStep + yStep / 2
          
          // 映射到brainRect坐标
          const canvasX = Math.floor(brainRect.x + (realX + 1) / 2 * brainRect.width)
          const canvasY = Math.floor(brainRect.y + (realY + 1) / 2 * brainRect.height)
          
          // 边界检查
          if (canvasX < brainRect.x || canvasX >= brainRect.x + brainRect.width || 
              canvasY < brainRect.y || canvasY >= brainRect.y + brainRect.height) {
            continue
          }
          
          // 计算颜色（蓝红温度映射）
          const normalizedValue = maxAbs > 0 ? value / maxAbs : 0
          const clampedValue = Math.max(-1, Math.min(1, normalizedValue))
          
          let r, g, b
          if (clampedValue > 0) {
            // 正值：红色渐变
            r = Math.floor(255 * clampedValue)
            g = 0
            b = Math.floor(255 * (1 - clampedValue))
          } else {
            // 负值：蓝色渐变
            const absValue = Math.abs(clampedValue)
            r = 0
            g = 0
            b = Math.floor(255 * absValue)
          }
          
          // 绘制热力图点
          const alpha = 0.8
          heatmapCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
          heatmapCtx.fillRect(canvasX - 2, canvasY - 2, 4, 4)
        }
        
        console.log('[训练界面-大脑热力图] 真实热力图绘制完成')
        
      } catch (error) {
        console.error('[训练界面-大脑热力图] 绘制出错:', error)
      }
    }
    
    onUnmounted(() => {
      console.log('[Obelab界面] 组件已卸载')
      
      // 清理曲线图
      if (curveChart) {
        curveChart.dispose()
        curveChart = null
      }
      
      // 清理大脑图表
      if (brainChart) {
        brainChart = null
      }
    })
    
    return {
      displayMode,
      switchMode,
      brainHeatmapRef,
      hboHeatmapRef,
      hbrHeatmapRef,
      curveChartRef,
      formatValue,
      formatDuration,
      getKangzhuxiaStatusText
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

/* 顶部标题栏 */
.top-header {
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 40px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.system-branding {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.golgi-text-header {
  font-size: 36px;
  font-weight: 900;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
  line-height: 1;
}

.system-subtitle {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
  margin-top: 2px;
}

.patient-info-header {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.patient-name-header {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.training-time-header {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}


/* 主界面布局 */
.main-layout {
  flex: 1;
  display: flex;
  padding: 30px;
  gap: 40px;
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
  overflow-y: auto; /* 允许纵向滚动以防按钮被遮挡 */
  max-height: calc(100vh - 160px); /* 根据可用高度限制最大高度 */
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
  gap: 20px;
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
  gap: calc(1vh + 8px); /* 根据视窗高度动态调整间距 */
  flex: 1; /* 占据可用空间 */
  justify-content: flex-start;
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
  padding: calc(1.2vh + 8px) 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: #ffffff;
  font-size: calc(0.8vh + 10px); /* 根据视窗高度调整字体大小 */
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: calc(5vh + 40px); /* 根据视窗高度调整最小高度 */
  max-height: calc(8vh + 20px); /* 设置最大高度避免过度拉伸 */
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
  padding: calc(1vh + 10px) 12px;
  background: rgba(231, 76, 60, 0.2);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(231, 76, 60, 0.5);
  border-radius: 12px;
  color: #ffffff;
  font-size: calc(0.7vh + 9px);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: calc(4vh + 35px); /* 响应式最小高度 */
  max-height: calc(6vh + 20px); /* 设置最大高度 */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  margin-top: auto; /* 自动推到底部，紧跟其他按钮 */
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
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* 专业大脑模式专用颜色条 */
.brain-colorbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30px;
  z-index: 10;
}

.brain-colorbar-gradient {
  width: 400px;
  height: 20px;
  background: linear-gradient(to right, #0066cc, #ffffff, #ff6666);
  border-radius: 10px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.brain-colorbar-labels {
  display: flex;
  justify-content: space-between;
  width: 400px;
  margin-top: 8px;
}

.brain-colorbar-label {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.brain-container-large {
  width: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.brain-canvas-large {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  position: relative;
}

/* 传统热力图区域 */
.heatmap-section {
  display: flex;
  gap: 20px;
  width: 100%;
  height: 100%;
}

.heatmap-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 15px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.heatmap-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.current-value {
  font-size: 16px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.1);
}

/* 曲线图区域 */
.curve-section {
  width: 100%;
  height: 100%;
}

.curve-card {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.curve-header {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.curve-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  text-align: center;
  margin: 0;
}

.curve-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.curve-canvas {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.1);
  min-height: 300px;
}

/* 游戏区域 */
.game-section {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-placeholder {
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 60px 40px;
}

.game-placeholder h3 {
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  margin-bottom: 15px;
}

.game-placeholder p {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}


/* 翡丽F8Pro平板专用优化 - 1920x1080 */
@media (width: 1920px) and (height: 1080px) {
  /* F8Pro平板横屏模式 */
  .obelab-style-training-view {
    font-size: 16px; /* 基础字体 */
  }
  
  .top-colorbar {
    height: 80px;
    padding: 15px 40px;
  }
  
  .patient-name-large {
    font-size: 32px;
    font-weight: 800;
  }
  
  .training-time-large {
    font-size: 28px;
    font-weight: 700;
  }
  
  .sidebar-title {
    font-size: 24px;
    margin-bottom: 15px;
  }
  
  .left-sidebar, .right-sidebar {
    width: 220px;
  }
  
  /* 优化按钮尺寸以避免溢出 */
  .large-mode-btn {
    font-size: 17px;
    font-weight: 700;
    padding: 20px 15px;
    min-height: 95px;
    border-radius: 15px;
    gap: 8px;
  }
  
  .large-control-btn {
    font-size: 16px;
    font-weight: 600;
    padding: 18px 14px;
    min-height: 85px;
    border-radius: 14px;
    gap: 8px;
  }
  
  .mode-icon-large, .control-icon-large {
    width: 30px;
    height: 30px;
  }
  
  .large-emergency-btn {
    font-size: 15px;
    font-weight: 700;
    min-height: 75px;
    padding: 15px 12px;
  }
  
  .emergency-icon-large {
    width: 28px;
    height: 28px;
  }
  
  /* 调整按钮间距 */
  .mode-buttons-vertical, .control-buttons-vertical {
    gap: 15px;
  }
  
  .status-text-large {
    font-size: 19px;
    font-weight: 700;
  }
  
  .device-status-large {
    padding: 20px;
    margin-bottom: 15px;
    border-radius: 15px;
  }
}

/* 1920x1080分辨率通用优化（包括电脑显示器） */
@media (min-width: 1920px) and (min-height: 1080px) {
  .obelab-style-training-view {
    font-size: 16px;
  }
  
  .main-layout {
    padding: 25px 30px;
    gap: 30px;
  }
  
  .left-sidebar, .right-sidebar {
    width: 210px;
  }
  
  .large-mode-btn, .large-control-btn {
    font-size: 19px;
    padding: 26px 18px;
    min-height: 115px;
    gap: 10px;
  }
  
  .center-brain-display {
    padding: 25px;
  }
  
  .brain-main-display {
    border-radius: 25px;
  }
}

/* 大屏幕显示器优化（2K及以上） */
@media (min-width: 2560px) {
  .obelab-style-training-view {
    font-size: 18px;
  }
  
  .left-sidebar, .right-sidebar {
    width: 250px;
  }
  
  .large-mode-btn, .large-control-btn {
    font-size: 22px;
    padding: 32px 24px;
    min-height: 140px;
  }
  
  .patient-name-large {
    font-size: 36px;
  }
  
  .training-time-large {
    font-size: 32px;
  }
}

/* 标准桌面显示器 */
@media (min-width: 1366px) and (max-width: 1919px) {
  .left-sidebar, .right-sidebar {
    width: 180px;
  }
  
  .large-mode-btn, .large-control-btn {
    font-size: 16px;
    padding: 20px 14px;
    min-height: 95px;
  }
  
  .patient-name-large {
    font-size: 26px;
  }
  
  .training-time-large {
    font-size: 22px;
  }
}

/* Windows Edge 浏览器兼容性修复 */
@supports (-ms-accelerator: true) {
  /* Edge Legacy (EdgeHTML) 特定修复 */
  .large-mode-btn, .large-control-btn {
    -ms-flex-negative: 0;
    flex-shrink: 0;
    /* 禁用复杂变换以避免Edge渲染问题 */
    transform: none !important;
  }
  
  .large-mode-btn:hover, .large-control-btn:hover:not(:disabled) {
    transform: none !important;
    /* 使用更简单的悬停效果 */
    background: rgba(255, 255, 255, 0.3) !important;
    border-color: rgba(255, 255, 255, 0.6) !important;
  }
  
  /* 修复backdrop-filter在Edge中的兼容性问题 */
  .large-mode-btn, .large-control-btn, .large-emergency-btn {
    background: rgba(255, 255, 255, 0.2) !important;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
  }
  
  .mode-icon-large, .control-icon-large, .emergency-icon-large {
    -ms-flex-negative: 0;
    flex-shrink: 0;
  }
}

/* Chromium Edge (现代Edge) 兼容性修复 */
@supports (-webkit-appearance: none) and (not (-moz-appearance: none)) {
  .large-mode-btn, .large-control-btn {
    /* 确保在Windows上正确缩放 */
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    /* 改善字体渲染 */
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  
  /* 修复Windows Edge中的flexbox布局问题 */
  .mode-buttons-vertical, .control-buttons-vertical {
    -webkit-box-orient: vertical;
    -webkit-box-direction: normal;
    -ms-flex-direction: column;
    flex-direction: column;
  }
  
  /* Windows Edge中的字体大小修复 */
  @media screen and (-ms-high-contrast: active), 
         screen and (-ms-high-contrast: none) {
    .large-mode-btn, .large-control-btn {
      font-size: calc(100% + 1px); /* 轻微增加字体大小 */
    }
  }
}

/* 通用Edge兼容性修复 - 所有Edge版本 */
_:-ms-lang(x), _:-webkit-full-screen, .large-mode-btn {
  /* Edge浏览器检测 */
  min-height: 90px !important;
  padding: 20px 15px !important;
  font-size: 16px !important;
}

_:-ms-lang(x), _:-webkit-full-screen, .large-control-btn {
  min-height: 80px !important;  
  padding: 18px 12px !important;
  font-size: 15px !important;
}

/* Windows系统字体渲染优化 */
@media screen and (-webkit-min-device-pixel-ratio: 0) {
  .large-mode-btn, .large-control-btn, .large-emergency-btn {
    font-family: 'Segoe UI', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif;
    font-weight: 600;
    -webkit-text-stroke: 0.5px transparent;
  }
}

/* Windows高DPI显示修复 */
@media screen and (-webkit-device-pixel-ratio: 1.25),
       screen and (-webkit-device-pixel-ratio: 1.5),
       screen and (resolution: 120dpi),
       screen and (resolution: 144dpi) {
  .large-mode-btn, .large-control-btn {
    font-size: calc(100% + 2px);
    line-height: 1.3;
  }
}

/* 小屏幕适配 - 优化按钮布局 */
@media (max-width: 1365px) {
  .main-layout {
    flex-direction: column;
    gap: 20px;
    padding: 15px;
  }
  
  .left-sidebar, .right-sidebar {
    width: 100%;
    flex-direction: row;
    gap: 15px;
    justify-content: center;
  }
  
  .mode-buttons-vertical, .control-buttons-vertical {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .large-mode-btn, .large-control-btn {
    flex: 1;
    min-width: 140px;
    max-width: 220px;
    min-height: 80px;
    font-size: 14px;
    padding: 15px 10px;
  }
  
  .large-emergency-btn {
    min-height: 65px;
    font-size: 13px;
    padding: 12px 10px;
  }
  
  .center-brain-display {
    order: -1; /* 让大脑显示区域在上方 */
    min-height: 400px;
  }
}

/* 触摸设备专用优化 */
@media (pointer: coarse) {
  .large-mode-btn, .large-control-btn {
    min-height: 120px;
    padding: 28px 20px;
    border-width: 3px;
  }
  
  .large-mode-btn:hover, .large-control-btn:hover {
    transform: scale(1.03);
  }
  
  .large-mode-btn:active, .large-control-btn:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
}

/* 高对比度和视觉辅助 */
.large-mode-btn:focus, .large-control-btn:focus {
  outline: 4px solid #ffffff;
  outline-offset: 3px;
}

/* 横屏模式优化 */
@media (orientation: landscape) {
  .obelab-style-training-view {
    overflow-x: hidden;
  }
  
  .main-layout {
    max-height: calc(100vh - 140px); /* 减去顶部和底部高度 */
  }
}

/* 竖屏模式优化 */
@media (orientation: portrait) {
  .main-layout {
    flex-direction: column;
  }
  
  .left-sidebar, .right-sidebar {
    width: 100%;
    flex-direction: row;
  }
  
  .mode-buttons-vertical, .control-buttons-vertical {
    flex-direction: row;
    justify-content: space-around;
  }
}
</style>