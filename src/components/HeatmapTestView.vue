<template>
  <div class="heatmap-test-view">
    <!-- 控制面板 -->
    <div class="control-panel">
      <h3>HM测试控制面板</h3>
      
      <!-- 层显示控制 -->
      <div class="layer-controls">
        <label>
          <input type="checkbox" v-model="layers.background" />
          背景层
        </label>
        <label>
          <input type="checkbox" v-model="layers.brain" />
          大脑图片
        </label>
        <label>
          <input type="checkbox" v-model="layers.fullLayout" />
          12-node布局
        </label>
        <label>
          <input type="checkbox" v-model="layers.heatmap" />
          热力图
        </label>
        <label>
          <input type="checkbox" v-model="layers.actualNodes" />
          实际nodes
        </label>
        <label>
          <input type="checkbox" v-model="layers.contours" />
          等高线
        </label>
      </div>
      
      <!-- 参数调节 -->
      <div class="param-controls">
        <div class="control-group">
          <label>背景透明度: {{ overlayOpacity }}</label>
          <input type="range" v-model.number="overlayOpacity" min="0.1" max="0.9" step="0.05" />
        </div>
        <div class="control-group">
          <label>热力图透明度: {{ heatmapOpacity }}</label>
          <input type="range" v-model.number="heatmapOpacity" min="0.1" max="0.9" step="0.05" />
        </div>
        <div class="control-group">
          <label>节点模式</label>
          <select v-model="nodeMode" @change="processLayoutPoints">
            <option value="6node">6节点（正三角形）</option>
            <option value="12node">12节点（全部）</option>
          </select>
        </div>
        <div class="control-group">
          <label>Y轴翻转</label>
          <input type="checkbox" v-model="flipY" />
        </div>
        <div class="control-group">
          <label>旋转角度: {{ rotation }}°</label>
          <input type="range" v-model.number="rotation" min="-5" max="5" step="1" />
        </div>
        <div class="control-group">
          <label>缩放比例: {{ scale }}</label>
          <input type="range" v-model.number="scale" min="0.9" max="1.1" step="0.01" />
        </div>
        
        <div class="control-group">
          <label>水平位置: {{ alignmentConfig.position.x.toFixed(2) }}</label>
          <input type="range" v-model.number="alignmentConfig.position.x" min="0.3" max="0.7" step="0.01" />
        </div>
        
        <div class="control-group">
          <label>垂直位置: {{ alignmentConfig.position.y.toFixed(2) }}</label>
          <input type="range" v-model.number="alignmentConfig.position.y" min="0.2" max="0.6" step="0.01" />
        </div>
        
        <div class="control-group">
          <label>宽度缩放: {{ alignmentConfig.scale.width.toFixed(2) }}</label>
          <input type="range" v-model.number="alignmentConfig.scale.width" min="0.5" max="1.2" step="0.01" />
        </div>
        
        <div class="control-group">
          <label>高度缩放: {{ alignmentConfig.scale.height.toFixed(2) }}</label>
          <input type="range" v-model.number="alignmentConfig.scale.height" min="0.4" max="0.8" step="0.01" />
        </div>
      </div>
      
      <!-- 调试信息 -->
      <div class="debug-info">
        <p>容器尺寸: {{ containerSize.width }}×{{ containerSize.height }}</p>
        <p>映射比例: {{ pixelPerMm.toFixed(3) }}px/mm</p>
        <p>12-node边界: {{ layoutBounds.width.toFixed(1) }}×{{ layoutBounds.height.toFixed(1) }}mm</p>
      </div>
    </div>
    
    <!-- 主显示区域 -->
    <div class="display-container" ref="displayContainer">
      <!-- Layer 1: 背景层 -->
      <div 
        v-if="layers.background"
        class="layer background-layer"
        :style="{ opacity: 1, zIndex: 0 }"
      ></div>
      
      <!-- Layer 2: 大脑图片 -->
      <img 
        v-if="layers.brain"
        class="layer brain-image-layer"
        :src="brainImageUrl"
        :style="{ 
          opacity: 1, 
          zIndex: 1,
          width: brainImageSize.width + 'px',
          height: brainImageSize.height + 'px',
          left: brainImagePosition.left + 'px',
          top: brainImagePosition.top + 'px'
        }"
        alt="Brain"
      />
      
      <!-- Layer 3: 12-node布局背景 -->
      <svg 
        v-if="layers.fullLayout"
        class="layer full-layout-layer"
        :style="getLayerStyle(2)"
        ref="fullLayoutSvg"
      >
        <!-- 凸包外轮廓 -->
        <path 
          v-if="hullPath"
          :d="hullPath"
          :fill="hullFill"
          :stroke="hullStroke"
          :stroke-width="1.25"
          :opacity="0.3"
          transform="scale(1)"
        />
        
        <!-- Optode点 -->
        <circle 
          v-for="(point, idx) in fullLayoutPoints" 
          :key="'optode-' + idx"
          :cx="point.px.x - getAlignedBounds()?.left || 0"
          :cy="point.px.y - getAlignedBounds()?.top || 0"
          r="2"
          fill="#666"
          opacity="0.6"
        />
      </svg>
      
      <!-- Layer 4: 热力图 -->
      <canvas 
        v-if="layers.heatmap"
        class="layer heatmap-layer"
        ref="heatmapCanvas"
        :style="getLayerStyle(3, heatmapOpacity)"
      ></canvas>
      
      <!-- Layer 5: 实际node分布 -->
      <svg 
        v-if="layers.actualNodes"
        class="layer actual-nodes-layer"
        :style="getLayerStyle(4)"
        ref="actualNodesSvg"
      >
        <!-- 光源点（红色） -->
        <circle 
          v-for="(point, idx) in actualSourcePoints" 
          :key="'source-' + idx"
          :cx="point.px.x - getAlignedBounds()?.left || 0"
          :cy="point.px.y - getAlignedBounds()?.top || 0"
          r="3"
          fill="red"
          opacity="0.8"
        />
        
        <!-- 检测器点（蓝色） -->
        <circle 
          v-for="(point, idx) in actualDetectorPoints" 
          :key="'detector-' + idx"
          :cx="point.px.x - getAlignedBounds()?.left || 0"
          :cy="point.px.y - getAlignedBounds()?.top || 0"
          r="3"
          fill="blue"
          opacity="0.8"
        />
        
        <!-- 通道中点（绿色，可选） -->
        <circle 
          v-for="(point, idx) in channelMidpoints" 
          :key="'channel-' + idx"
          :cx="point.px.x - getAlignedBounds()?.left || 0"
          :cy="point.px.y - getAlignedBounds()?.top || 0"
          r="2"
          fill="green"
          opacity="0.5"
        />
      </svg>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { HeatmapCoordinator } from '@/components/training/modes/heatmap/HeatmapCoordinator.js'

export default {
  name: 'HeatmapTestView',
  setup() {
    // 容器引用
    const displayContainer = ref(null)
    const fullLayoutSvg = ref(null)
    const actualNodesSvg = ref(null)
    const heatmapCanvas = ref(null)
    
    // SDK数据连接
    const FNIRS_API_BASE = 'http://localhost:8091'
    const sdkConnected = ref(false)
    const sdkDataStream = ref(null)
    const dataUpdateTimer = ref(null)
    const sdkLogs = ref([])
    
    // 层显示控制
    const layers = ref({
      background: true,
      brain: true,
      fullLayout: true,
      heatmap: true,
      actualNodes: true,
      contours: true
    })
    
    // 参数控制
    const overlayOpacity = ref(0.3)
    const heatmapOpacity = ref(0.8)
    const flipY = ref(true) // 默认开启Y轴翻转，实现正三角形（底宽顶尖）
    const rotation = ref(0)
    const scale = ref(1.0)
    
    // 容器和图片尺寸
    const containerSize = ref({ width: 800, height: 600 })
    const svgSize = ref({ width: 800, height: 600 })
    const brainImageUrl = '/src/assets/brain_no_bg.png'
    const brainImageSize = ref({ width: 400, height: 400 })
    const brainImagePosition = ref({ left: 200, top: 100 })
    
    // 布局数据
    const fullLayoutData = ref(null)
    const fullLayoutPoints = ref([])
    const actualSourcePoints = ref([])
    const actualDetectorPoints = ref([])
    const channelMidpoints = ref([])
    const hullPath = ref('')
    const hullFill = ref('#ffd700')
    const hullStroke = ref('#ffaa00')
    
    // 节点配置（6节点或12节点）
    const nodeMode = ref('6node') // '6node' 或 '12node'
    const sixNodeIds = [2, 5, 6, 9, 10, 11] // 6节点配置的节点ID
    
    // Triangle布局尺寸（mm）
    const layoutBounds = ref({ width: 188.72, height: 110.29 })
    const pixelPerMm = computed(() => {
      return containerSize.value.width / layoutBounds.value.width
    })
    
    // HeatmapCoordinator实例
    let coordinator = null
    
    // 对齐配置（与HeatmapCoordinator保持一致）
    const alignmentConfig = ref({
      position: { x: 0.5, y: 0.42 },      // 热力图在大脑图片上的位置
      scale: { width: 0.9, height: 0.55 }, // 热力图相对于大脑图片的缩放
      opacity: 0.7,
      rotation: 0
    })
    
    // SDK数据获取函数
    async function fetchSDKData() {
      try {
        const response = await fetch(`${FNIRS_API_BASE}/api/fnirs/data`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        
        // 记录日志
        if (!sdkConnected.value) {
          sdkConnected.value = true
          const log = 'SDK连接成功'
          sdkLogs.value.push(log)
          console.log(`[HM测试] ${log}`)
          // 暴露给全局用于测试验证
          window.sdkLogs = sdkLogs.value
        }
        
        return data
      } catch (error) {
        console.error('[HM测试] SDK连接失败:', error)
        sdkLogs.value.push(`SDK连接失败: ${error.message}`)
        sdkConnected.value = false
        // 返回模拟数据作为后备
        return generateMockData()
      }
    }
    
    // 模拟数据生成（后备方案）
    function generateMockData() {
      const data = {
        hboData: [],
        hbrData: [],
        frameId: Date.now(),
        timestamp: Date.now() / 1000
      }
      
      // 生成432个通道的模拟数据
      for (let i = 0; i < 432; i++) {
        // 基于位置的激活模式
        const y = channelMidpoints.value[i]?.mm.y || 50
        const activation = (y - 55) / 55 // 顶部激活，底部抑制
        const hboValue = activation * 0.03 + (Math.random() - 0.5) * 0.01
        const hbrValue = -hboValue * 0.6 + (Math.random() - 0.5) * 0.005
        
        data.hboData.push(hboValue)
        data.hbrData.push(hbrValue)
      }
      
      return data
    }
    
    // 启动数据流
    function startDataStream() {
      if (dataUpdateTimer.value) {
        clearInterval(dataUpdateTimer.value)
      }
      
      dataUpdateTimer.value = setInterval(async () => {
        if (layers.value.heatmap) {
          const sdkData = await fetchSDKData()
          
          // 解析数据
          if (sdkData.hboData && sdkData.hbrData) {
            // 数据统计
            const hboStats = calculateStats(sdkData.hboData)
            const hbrStats = calculateStats(sdkData.hbrData)
            
            // 每秒输出一次统计信息（8次更新输出一次）
            if (sdkData.frameId % 8 === 0) {
              console.log('[HM测试] 数据范围统计:')
              console.log(`  HbO: [${hboStats.min.toFixed(4)}, ${hboStats.max.toFixed(4)}]`)
              console.log(`  HbR: [${hbrStats.min.toFixed(4)}, ${hbrStats.max.toFixed(4)}]`)
            }
            
            // 更新热力图（使用HbO数据）
            const channelData = sdkData.hboData.map((value, i) => ({
              channel: i,
              value: value,
              time: sdkData.timestamp
            }))
            
            updateHeatmap(channelData)
            
            // 记录更新日志（高频）
            const updateLog = `数据更新 frameId:${sdkData.frameId}`
            sdkLogs.value.push(updateLog)
            if (sdkLogs.value.length > 100) {
              sdkLogs.value = sdkLogs.value.slice(-50) // 保留最近50条
            }
          }
        }
      }, 125) // 125ms = 8Hz
    }
    
    // 计算统计信息
    function calculateStats(data) {
      if (!data || data.length === 0) {
        return { min: 0, max: 0, mean: 0, std: 0 }
      }
      const min = Math.min(...data)
      const max = Math.max(...data)
      const mean = data.reduce((a, b) => a + b, 0) / data.length
      const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length
      const std = Math.sqrt(variance)
      return { min, max, mean, std }
    }
    
    // 加载布局数据
    async function loadLayoutData() {
      try {
        const response = await fetch('/renumbered_full_layout.json')
        fullLayoutData.value = await response.json()
        
        // 提取布局尺寸
        if (fullLayoutData.value.dimensions?.dimensions_2d) {
          layoutBounds.value = {
            width: fullLayoutData.value.dimensions.dimensions_2d.x,
            height: fullLayoutData.value.dimensions.dimensions_2d.y
          }
        }
        
        // 处理optode坐标
        processLayoutPoints()
        
        console.log('[HM测试] 布局数据加载完成', fullLayoutData.value)
      } catch (error) {
        console.error('[HM测试] 加载布局数据失败:', error)
      }
    }
    
    // 处理布局点坐标
    function processLayoutPoints() {
      if (!fullLayoutData.value) return
      
      const allPoints = []
      const sources = []
      const detectors = []
      
      // 遍历所有docks
      fullLayoutData.value.docks.forEach(dock => {
        // 获取dock编号
        const dockId = parseInt(dock.dock_id.replace('dock_', ''))
        
        // 如果是6节点模式，只处理指定的6个节点
        if (nodeMode.value === '6node' && !sixNodeIds.includes(dockId)) {
          return // 跳过不在6节点配置中的dock
        }
        
        dock.optodes.forEach(optode => {
          const coord2d = optode.coordinates_2d
          if (coord2d) {
            const point = {
              mm: { x: coord2d.x, y: coord2d.y },
              px: mmToPixel(coord2d.x, coord2d.y),
              name: optode.optode_id || optode.name,
              type: optode.optode_id?.includes('optode_') ? 'detector' : 'source',
              dockId: dockId
            }
            
            allPoints.push(point)
            
            if (point.type === 'source') {
              sources.push(point)
            } else {
              detectors.push(point)
            }
          }
        })
      })
      
      fullLayoutPoints.value = allPoints
      actualSourcePoints.value = sources.slice(0, 18) // 实际使用的前18个光源
      actualDetectorPoints.value = detectors.slice(0, 24) // 实际使用的前24个检测器
      
      // 计算通道中点
      calculateChannelMidpoints()
      
      // 生成凸包
      generateHull()
    }
    
    // mm坐标转像素坐标（基于对齐后的热力图区域）
    function mmToPixel(mmX, mmY) {
      // 获取对齐后的热力图区域
      const heatmapBounds = getAlignedBounds()
      if (!heatmapBounds) {
        return { x: 0, y: 0 }
      }
      
      // 计算相对于热力图区域的比例
      const scaleX = heatmapBounds.width / layoutBounds.value.width
      const scaleY = heatmapBounds.height / layoutBounds.value.height
      
      // 应用Y轴翻转
      let pxX = mmX * scaleX
      let pxY = flipY.value 
        ? (layoutBounds.value.height - mmY) * scaleY 
        : mmY * scaleY
      
      // 转换到绝对位置（相对于容器）
      pxX += heatmapBounds.left
      pxY += heatmapBounds.top
      
      // 应用旋转（如果需要）
      if (rotation.value !== 0) {
        const centerX = heatmapBounds.left + heatmapBounds.width / 2
        const centerY = heatmapBounds.top + heatmapBounds.height / 2
        const rad = rotation.value * Math.PI / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        
        const dx = pxX - centerX
        const dy = pxY - centerY
        
        pxX = centerX + dx * cos - dy * sin
        pxY = centerY + dx * sin + dy * cos
      }
      
      return { x: pxX, y: pxY }
    }
    
    // 获取对齐后的边界
    function getAlignedBounds() {
      if (!brainImageSize.value || !brainImagePosition.value) {
        return null
      }
      
      // 模拟大脑图片的边界
      const brainBounds = {
        left: brainImagePosition.value.left,
        top: brainImagePosition.value.top,
        width: brainImageSize.value.width,
        height: brainImageSize.value.height
      }
      
      // 应用对齐配置计算热力图边界
      const config = alignmentConfig.value
      const heatmapWidth = brainBounds.width * config.scale.width * scale.value
      const heatmapHeight = brainBounds.height * config.scale.height * scale.value
      
      const heatmapLeft = brainBounds.left + 
        (brainBounds.width * config.position.x) - 
        (heatmapWidth / 2)
      
      const heatmapTop = brainBounds.top + 
        (brainBounds.height * config.position.y) - 
        (heatmapHeight / 2)
      
      return {
        left: heatmapLeft,
        top: heatmapTop,
        width: heatmapWidth,
        height: heatmapHeight
      }
    }
    
    // 计算通道中点
    function calculateChannelMidpoints() {
      const midpoints = []
      
      actualSourcePoints.value.forEach(source => {
        actualDetectorPoints.value.forEach(detector => {
          const dist = Math.sqrt(
            Math.pow(source.mm.x - detector.mm.x, 2) + 
            Math.pow(source.mm.y - detector.mm.y, 2)
          )
          
          // 只保留30-80mm距离的通道
          if (dist >= 30 && dist <= 80) {
            const midpoint = {
              mm: {
                x: (source.mm.x + detector.mm.x) / 2,
                y: (source.mm.y + detector.mm.y) / 2
              },
              px: mmToPixel(
                (source.mm.x + detector.mm.x) / 2,
                (source.mm.y + detector.mm.y) / 2
              ),
              source: source.name,
              detector: detector.name,
              distance: dist
            }
            midpoints.push(midpoint)
          }
        })
      })
      
      channelMidpoints.value = midpoints
      console.log(`[HM测试] 计算得到 ${midpoints.length} 个有效通道`)
    }
    
    // 生成凸包路径
    function generateHull() {
      if (fullLayoutPoints.value.length === 0) return
      
      const heatmapBounds = getAlignedBounds()
      if (!heatmapBounds) return
      
      // 简化版凸包算法（使用所有点的边界框）
      const points = fullLayoutPoints.value.map(p => ({
        x: p.px.x - heatmapBounds.left,
        y: p.px.y - heatmapBounds.top
      }))
      
      const minX = Math.min(...points.map(p => p.x)) - 10
      const maxX = Math.max(...points.map(p => p.x)) + 10
      const minY = Math.min(...points.map(p => p.y)) - 10
      const maxY = Math.max(...points.map(p => p.y)) + 10
      
      // 创建圆角矩形路径
      const radius = 10
      hullPath.value = `
        M ${minX + radius} ${minY}
        L ${maxX - radius} ${minY}
        Q ${maxX} ${minY} ${maxX} ${minY + radius}
        L ${maxX} ${maxY - radius}
        Q ${maxX} ${maxY} ${maxX - radius} ${maxY}
        L ${minX + radius} ${maxY}
        Q ${minX} ${maxY} ${minX} ${maxY - radius}
        L ${minX} ${minY + radius}
        Q ${minX} ${minY} ${minX + radius} ${minY}
        Z
      `
    }
    
    // 绘制热力图
    function drawHeatmap() {
      const canvas = heatmapCanvas.value
      if (!canvas) return
      
      const heatmapBounds = getAlignedBounds()
      if (!heatmapBounds) return
      
      const ctx = canvas.getContext('2d')
      canvas.width = heatmapBounds.width
      canvas.height = heatmapBounds.height
      
      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // IDW插值参数
      const gridSize = 120
      const kNeighbors = 16
      const gaussianSigma = 2.0
      
      // 生成模拟数据
      const mockData = generateMockData()
      
      // 创建网格
      const grid = createGrid(gridSize, mockData, kNeighbors)
      
      // 应用高斯平滑
      const smoothedGrid = applyGaussianSmoothing(grid, gaussianSigma)
      
      // 绘制热力图
      drawGridAsHeatmap(ctx, smoothedGrid, gridSize)
      
      // 绘制等高线（如果启用）
      if (layers.value.contours) {
        drawContours(ctx, smoothedGrid, gridSize)
      }
    }
    
    // 创建插值网格
    function createGrid(size, data, k) {
      const grid = new Array(size)
      for (let i = 0; i < size; i++) {
        grid[i] = new Array(size).fill(0)
      }
      
      // 获取一次热力图边界
      const heatmapBounds = getAlignedBounds()
      if (!heatmapBounds) return grid
      
      // 简化的IDW插值
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const x = (i / size) * heatmapBounds.width
          const y = (j / size) * heatmapBounds.height
          
          // IDW插值
          let sumWeight = 0
          let sumValue = 0
          
          channelMidpoints.value.slice(0, k).forEach((point, idx) => {
            const dist = Math.sqrt(
              Math.pow(x - (point.px.x - heatmapBounds.left), 2) + 
              Math.pow(y - (point.px.y - heatmapBounds.top), 2)
            )
            
            if (dist > 0) {
              const weight = 1 / (dist * dist)
              sumWeight += weight
              sumValue += weight * (data[idx]?.value || 0)
            }
          })
          
          grid[i][j] = sumWeight > 0 ? sumValue / sumWeight : 0
        }
      }
      
      return grid
    }
    
    // 高斯平滑
    function applyGaussianSmoothing(grid, sigma) {
      // 简化的高斯平滑实现
      const size = grid.length
      const smoothed = new Array(size)
      
      for (let i = 0; i < size; i++) {
        smoothed[i] = new Array(size)
        for (let j = 0; j < size; j++) {
          smoothed[i][j] = grid[i][j] // 暂时不平滑
        }
      }
      
      return smoothed
    }
    
    // 绘制网格热力图
    function drawGridAsHeatmap(ctx, grid, size) {
      const heatmapBounds = getAlignedBounds()
      if (!heatmapBounds) return
      
      const cellWidth = heatmapBounds.width / size
      const cellHeight = heatmapBounds.height / size
      
      // 颜色映射（Spectral）
      const colorMap = [
        '#2b83ba', '#5aabbd', '#90c5a6', '#c7e8ad',
        '#ffd700', '#fec980', '#f99459', '#e75b3a', '#d7191c'
      ]
      
      const valueMin = -0.05
      const valueMax = 0.05
      
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const value = grid[i][j]
          const normalized = (value - valueMin) / (valueMax - valueMin)
          const colorIndex = Math.floor(normalized * 8.99)
          const color = colorMap[Math.max(0, Math.min(8, colorIndex))]
          
          ctx.fillStyle = color
          ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight)
        }
      }
    }
    
    // 绘制等高线
    function drawContours(ctx, grid, size) {
      const heatmapBounds = getAlignedBounds()
      if (!heatmapBounds) return
      
      // 简化的等高线绘制
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1
      
      // 暂时绘制一些示例线
      ctx.beginPath()
      ctx.arc(heatmapBounds.width / 2, heatmapBounds.height / 2, 50, 0, Math.PI * 2)
      ctx.stroke()
    }
    
    // 更新容器尺寸
    function updateContainerSize() {
      if (!displayContainer.value) return
      
      const rect = displayContainer.value.getBoundingClientRect()
      containerSize.value = {
        width: rect.width,
        height: rect.height
      }
      
      // 更新大脑图片位置和尺寸（居中显示）
      const brainSize = Math.min(rect.width, rect.height) * 0.6
      brainImageSize.value = {
        width: brainSize,
        height: brainSize
      }
      brainImagePosition.value = {
        left: (rect.width - brainSize) / 2,
        top: (rect.height - brainSize) / 2
      }
      
      // 更新SVG尺寸为对齐后的热力图区域
      const heatmapBounds = getAlignedBounds()
      if (heatmapBounds) {
        svgSize.value = {
          width: heatmapBounds.width,
          height: heatmapBounds.height
        }
      }
    }
    
    // 获取层的样式（基于对齐）
    function getLayerStyle(zIndex, opacity = 1) {
      const heatmapBounds = getAlignedBounds()
      if (!heatmapBounds) {
        return {
          opacity: opacity,
          zIndex: zIndex,
          width: '100px',
          height: '100px'
        }
      }
      
      const layerOpacity = zIndex === 2 ? overlayOpacity.value : opacity
      
      return {
        opacity: layerOpacity,
        zIndex: zIndex,
        position: 'absolute',
        left: heatmapBounds.left + 'px',
        top: heatmapBounds.top + 'px',
        width: heatmapBounds.width + 'px',
        height: heatmapBounds.height + 'px',
        transform: `rotate(${rotation.value}deg)`,
        transformOrigin: 'center',
        pointerEvents: 'none'
      }
    }
    
    // 监听参数变化
    watch([flipY, rotation, scale, layers, alignmentConfig], () => {
      updateContainerSize()
      processLayoutPoints()
      nextTick(() => {
        drawHeatmap()
      })
    }, { deep: true })
    
    // 监听容器尺寸变化
    let resizeObserver = null
    
    onMounted(async () => {
      console.log('[HM测试] 组件挂载')
      
      // 初始化coordinator
      coordinator = new HeatmapCoordinator()
      
      // 更新容器尺寸
      updateContainerSize()
      
      // 加载布局数据
      await loadLayoutData()
      
      // 绘制热力图
      await nextTick()
      drawHeatmap()
      
      // 启动SDK数据流（功能1：SDK数据连接）
      startDataStream()
      console.log('[HM测试] 开始尝试连接SDK...')
      
      // 监听容器尺寸变化
      resizeObserver = new ResizeObserver(() => {
        updateContainerSize()
        processLayoutPoints()
        drawHeatmap()
      })
      
      if (displayContainer.value) {
        resizeObserver.observe(displayContainer.value)
      }
    })
    
    onUnmounted(() => {
      console.log('[HM测试] 组件卸载')
      
      // 清理定时器
      if (dataUpdateTimer.value) {
        clearInterval(dataUpdateTimer.value)
      }
      
      if (resizeObserver && displayContainer.value) {
        resizeObserver.unobserve(displayContainer.value)
        resizeObserver.disconnect()
      }
    })
    
    return {
      displayContainer,
      fullLayoutSvg,
      actualNodesSvg,
      heatmapCanvas,
      layers,
      overlayOpacity,
      heatmapOpacity,
      flipY,
      rotation,
      scale,
      containerSize,
      svgSize,
      brainImageUrl,
      brainImageSize,
      brainImagePosition,
      layoutBounds,
      pixelPerMm,
      fullLayoutPoints,
      actualSourcePoints,
      actualDetectorPoints,
      channelMidpoints,
      hullPath,
      hullFill,
      hullStroke,
      alignmentConfig,
      getLayerStyle,
      getAlignedBounds,
      sdkConnected,
      sdkLogs,
      startDataStream,
      nodeMode
    }
  }
}
</script>

<style scoped>
.heatmap-test-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  background: #f0f0f0;
}

/* 控制面板 */
.control-panel {
  width: 300px;
  background: white;
  padding: 20px;
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  overflow-y: auto;
}

.control-panel h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.layer-controls {
  margin-bottom: 20px;
}

.layer-controls label {
  display: block;
  margin: 5px 0;
  cursor: pointer;
}

.layer-controls input[type="checkbox"] {
  margin-right: 8px;
}

.param-controls {
  margin-bottom: 20px;
}

.control-group {
  margin: 10px 0;
}

.control-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
  color: #666;
}

.control-group input[type="range"] {
  width: 100%;
}

.control-group input[type="checkbox"] {
  margin-left: 10px;
}

.debug-info {
  padding: 10px;
  background: #f8f8f8;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
}

.debug-info p {
  margin: 5px 0;
}

/* 显示容器 */
.display-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #ffffff;
}

/* 层样式 */
.layer {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.background-layer {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
}

.brain-image-layer {
  position: absolute;
  object-fit: contain;
}

.full-layout-layer,
.actual-nodes-layer {
  overflow: visible;
}

.heatmap-layer {
  image-rendering: optimizeSpeed;
  image-rendering: -webkit-crisp-edges;
  image-rendering: pixelated;
}
</style>