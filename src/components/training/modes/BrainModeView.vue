<template>
  <div class="brain-mode-view">
    <!-- 专业大脑显示区域 - 新SVG热力图架构 -->
    <div class="brain-main-display">
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
        <div ref="brainDisplayRef" class="brain-display-large">
          <!-- 大脑背景图片 -->
          <img 
            ref="brainImageRef"
            :src="brainImageSrc" 
            alt="专业大脑图片"
            class="brain-background-image"
            @load="onBrainImageLoad"
          />
          
          <!-- 12-node覆盖区域容器 (位于热力图下方) -->
          <div 
            ref="coverageAreaRef"
            class="coverage-area-container"
            :style="heatmapContainerStyle"
          >
            <!-- 12-node设备覆盖区域多边形 -->
          </div>

          <!-- SVG热力图容器 -->
          <div 
            ref="heatmapContainerRef" 
            class="heatmap-svg-container"
            :style="heatmapContainerStyle"
          >
            <!-- 覆盖区域（12-node布局外轮廓，多边形） -->
            <svg 
              ref="coverageOverlayRef" 
              class="coverage-overlay"
              :viewBox="overlayViewBox"
              preserveAspectRatio="none"
            >
              <polygon 
                v-if="overlayPoints"
                :points="overlayPoints"
                fill="rgba(96,165,250,0.6)"
                stroke="rgba(255,255,255,0.2)"
                stroke-width="1.75"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            </svg>

            <!-- ECharts + IDW热力图组件 -->
            <HeatmapReportStyleView
              v-if="useReportHeatmap"
              :hboData="hboData"
              :channelPositions="reportChannelPositions"
              :sixDockTriangleVertices="sixDockTriangleVertices"
              :layoutDimensions="reportLayoutDimensions"
              :alignment="heatmapAlignment"
              :useSixDockMode="true"
              :gridSize="200"
              :gaussianSigma="3.5"
              :kNeighbors="24"
            />
            
            <!-- 统一使用ECharts热力图渲染 -->
          </div>
          
          <!-- 加载状态 -->
          <div v-if="isLoading" class="loading-overlay">
            <div class="loading-spinner"></div>
            <p>初始化热力图...</p>
          </div>
          
          <!-- 错误状态 -->
          <div v-if="hasError" class="error-overlay">
            <div class="error-icon">⚠️</div>
            <p>{{ errorMessage }}</p>
          </div>
        </div>
      </div>
      
      <!-- 调试信息面板 (开发模式) -->
      <div v-if="showDebugInfo" class="debug-panel">
        <h4>调试信息</h4>
        <pre>{{ debugInfo }}</pre>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, onUnmounted, computed } from 'vue'
import { trainingCommon } from '../mixins/TrainingCommon.js'
import { TriangleDataProcessor } from './heatmap/TriangleDataProcessor.js'
import { HeatmapCoordinator } from './heatmap/HeatmapCoordinator.js'
// D3相关导入已移除，统一使用ECharts
import fullLayout from '../../../../fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json'
import HeatmapReportStyleView from './heatmap/HeatmapReportStyleView.vue'
import { GeometryUtils } from '../../../utils/GeometryUtils.js'
import { sessionManager } from '../../../services/sessionManager.js'

export default {
  name: 'BrainModeView',
  components: {
    HeatmapReportStyleView
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
    }
  },
  setup(props) {
    // DOM引用
    const brainDisplayRef = ref(null)
    const brainImageRef = ref(null)
    const heatmapContainerRef = ref(null)
    const coverageOverlayRef = ref(null)
    const coverageAreaRef = ref(null)
    
    // 状态管理
    const isLoading = ref(true)
    const hasError = ref(false)
    const errorMessage = ref('')
    const activeBrainRegions = ref(12)
    const averageBrainActivity = ref(68.5)
    
    // 核心实例
    let triangleProcessor = null
    let heatmapCoordinator = null
    // d3Renderer已移除，统一使用ECharts
    let updateTimer = null
    let resizeCleanup = null

    // 覆盖层数据（SVG 多边形）
    const overlayPoints = ref('')
    const overlayViewBox = ref('0 0 0 0')

    // 新增：ECharts热力图系统配置
    const useReportHeatmap = ref(true)
    const reportChannelPositions = ref([])
    const reportLayoutDimensions = ref({ x: 188.72, y: 110.29 })
    
    // 6dock三角形顶点数据 (基于边界分析结果)
    const sixDockTriangleVertices = ref([
      { x: 94.36, y: 86.41 },  // 顶部 (dock_3)
      { x: 59.36, y: 25.81 },  // 左下 (dock_10)  
      { x: 129.36, y: 25.81 }  // 右下 (dock_12)
    ])
    
    // 优化的对齐参数配置 - 基于边界收缩分析
    const heatmapAlignment = ref({
      position: { x: 0.5, y: 0.42 },
      scale: { width: 0.8, height: 0.5 }, // 缩减至80%和50%，防止超出
      opacity: 0.7,
      rotation: 0,
      anchor: "center",
      version: "1.1", // 更新版本号标记优化
      deviceProfile: "triangle"
    })
    
    // 12-node覆盖区域状态
    let nodeLayoutData = null
    let coverageAreaSvg = null
    const triangleDimensions = ref({ x: 188.72346922981956, y: 110.29199999999999 }) // mm
    
    // 使用共享逻辑
    const { formatPercentage } = trainingCommon()
    
    // 大脑图片路径
    const brainImageSrc = new URL('../../../assets/brain_no_bg.png', import.meta.url).href
    
    // 开发模式调试 - 关闭调试信息显示
    const showDebugInfo = ref(false)
    const debugInfo = ref({})
    
    // 热力图容器样式（响应式）
    const heatmapContainerStyle = computed(() => {
      if (!heatmapCoordinator || !brainImageRef.value) {
        console.log('[BrainModeView] 样式计算跳过: coordinator=', !!heatmapCoordinator, 'brainImage=', !!brainImageRef.value)
        return {}
      }
      
      try {
        console.log('[BrainModeView] 开始计算SVG样式...')
        const style = heatmapCoordinator.getSVGStyle(brainImageRef.value, brainDisplayRef.value)
        console.log('[BrainModeView] SVG样式计算完成:', style)
        return style
      } catch (error) {
        console.warn('[BrainModeView] 样式计算失败:', error)
        return {}
      }
    })
    
    /**
     * 加载12-node布局数据 (使用renumbered_full_layout.json获取完整12个dock)
     */
    async function loadNodeLayoutData() {
      try {
        // 使用完整的12-node布局文件
        const response = await fetch('/fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        nodeLayoutData = await response.json()
        
        // 注意：坐标系统使用与热力图相同的dimensions
        // 热力图使用的是layout.json，所以我们也要使用相同的尺寸
        triangleDimensions.value = nodeLayoutData.dimensions.dimensions_2d
        
        console.log('[BrainModeView] 12-node完整布局数据加载成功:', {
          configFile: 'renumbered_full_layout.json',
          dimensions: triangleDimensions.value,
          docksCount: nodeLayoutData.docks?.length || 0,
          totalOptodes: nodeLayoutData.docks?.reduce((sum, dock) => sum + (dock.optodes?.length || 0), 0)
        })
        return nodeLayoutData
      } catch (error) {
        console.error('[BrainModeView] 12-node布局数据加载失败:', error)
        throw error
      }
    }
    
    /**
     * 提取所有12个node的最外围坐标点 (每个dock选择最极端的点)
     */
    function extractNodeBoundaryCoordinates(layoutData) {
      const boundaryPoints = []
      if (!layoutData?.docks) return boundaryPoints
      
      layoutData.docks.forEach(dock => {
        if (dock.optodes && Array.isArray(dock.optodes)) {
          // 对每个dock，找到最外围的点
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
          let minXPoint, maxXPoint, minYPoint, maxYPoint
          
          dock.optodes.forEach(optode => {
            if (optode.coordinates_2d) {
              const { x, y } = optode.coordinates_2d
              
              if (x < minX) { minX = x; minXPoint = { x, y, dock_id: dock.dock_id, optode_id: optode.optode_id } }
              if (x > maxX) { maxX = x; maxXPoint = { x, y, dock_id: dock.dock_id, optode_id: optode.optode_id } }
              if (y < minY) { minY = y; minYPoint = { x, y, dock_id: dock.dock_id, optode_id: optode.optode_id } }
              if (y > maxY) { maxY = y; maxYPoint = { x, y, dock_id: dock.dock_id, optode_id: optode.optode_id } }
            }
          })
          
          // 添加每个dock的边界点（去重）
          const dockBoundaryPoints = [minXPoint, maxXPoint, minYPoint, maxYPoint]
          dockBoundaryPoints.forEach(point => {
            if (point && !boundaryPoints.some(p => p.x === point.x && p.y === point.y)) {
              boundaryPoints.push(point)
            }
          })
        }
      })
      
      console.log('[BrainModeView] 12-node边界坐标提取完成:', {
        totalBoundaryPoints: boundaryPoints.length,
        samplePoints: boundaryPoints.slice(0, 3)
      })
      return boundaryPoints
    }
    
    /**
     * 计算Convex Hull (Graham扫描算法)
     */
    function calculateConvexHull(points) {
      if (points.length < 3) return points
      
      // 按x坐标排序，如果x相同则按y坐标排序
      const sortedPoints = [...points].sort((a, b) => {
        if (a.x === b.x) return a.y - b.y
        return a.x - b.x
      })
      
      // 计算下半部分的凸包
      const lower = []
      for (let i = 0; i < sortedPoints.length; i++) {
        while (lower.length >= 2 && 
               crossProduct(lower[lower.length-2], lower[lower.length-1], sortedPoints[i]) <= 0) {
          lower.pop()
        }
        lower.push(sortedPoints[i])
      }
      
      // 计算上半部分的凸包
      const upper = []
      for (let i = sortedPoints.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && 
               crossProduct(upper[upper.length-2], upper[upper.length-1], sortedPoints[i]) <= 0) {
          upper.pop()
        }
        upper.push(sortedPoints[i])
      }
      
      // 移除重复的点
      upper.pop()
      lower.pop()
      
      const convexHull = lower.concat(upper)
      console.log('[BrainModeView] 12-node Convex Hull计算完成:', {
        originalPoints: points.length,
        hullPoints: convexHull.length
      })
      
      return convexHull
    }
    
    /**
     * 计算叉积 (用于凸包算法)
     */
    function crossProduct(O, A, B) {
      return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x)
    }
    
    /**
     * 外扩多边形边界 (3mm)
     */
    function expandPolygon(points, expandDistance = 3) {
      if (points.length < 3) return points
      
      // 计算多边形重心
      const centroid = {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length
      }
      
      // 从重心向外扩展每个点
      const expandedPoints = points.map(point => {
        const dx = point.x - centroid.x
        const dy = point.y - centroid.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance === 0) return point // 避免除零
        
        const expandRatio = (distance + expandDistance) / distance
        
        return {
          x: centroid.x + dx * expandRatio,
          y: centroid.y + dy * expandRatio
        }
      })
      
      console.log('[BrainModeView] 12-node覆盖区域外扩完成:', {
        originalPoints: points.length,
        expandDistance: expandDistance + 'mm'
      })
      
      return expandedPoints
    }
    
    /**
     * Triangle坐标系到像素坐标的映射 (使用与热力图完全相同的转换逻辑)
     */
    function triangleToPixelCoordinates(trianglePoints, containerBounds) {
      if (!containerBounds || !heatmapCoordinator) return []
      
      // 使用HeatmapCoordinator的layoutBounds (与热力图相同)
      const layoutBounds = heatmapCoordinator.getLayoutBounds()
      if (!layoutBounds) return []
      
      const { width: containerWidth, height: containerHeight } = containerBounds
      const { x: layoutWidth, y: layoutHeight } = layoutBounds
      
      // 使用与热力图完全相同的缩放和偏移计算
      const scaleX = containerWidth / layoutWidth
      const scaleY = containerHeight / layoutHeight
      const scale = Math.min(scaleX, scaleY)
      
      const scaledWidth = layoutWidth * scale
      const scaledHeight = layoutHeight * scale
      const offsetX = (containerWidth - scaledWidth) / 2
      const offsetY = (containerHeight - scaledHeight) / 2
      
      // 使用与热力图相同的坐标转换 (注意Y轴翻转)
      const pixelPoints = trianglePoints.map(point => {
        // 与ECharts热力图的坐标转换保持一致
        const pixelX = point.x * scale + offsetX
        const pixelY = (layoutHeight - point.y) * scale + offsetY // Y轴翻转
        
        return { x: pixelX, y: pixelY }
      })
      
      console.log('[BrainModeView] 12-node坐标转换（使用热力图相同逻辑）:', {
        layoutBounds: layoutBounds,
        containerSize: { width: containerWidth, height: containerHeight },
        scale: scale.toFixed(3),
        offset: { x: offsetX.toFixed(1), y: offsetY.toFixed(1) },
        样例转换: pixelPoints.slice(0, 2).map((p, i) => ({
          原始: trianglePoints[i],
          像素: p
        }))
      })
      
      return pixelPoints
    }
    
    /**
     * 创建12-node覆盖区域SVG多边形
     */
    function createCoverageAreaSVG(pixelPoints, containerBounds) {
      if (!coverageAreaRef.value || pixelPoints.length < 3) return
      
      // 清除现有的SVG
      coverageAreaRef.value.innerHTML = ''
      
      // 创建SVG元素
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', containerBounds.width)
      svg.setAttribute('height', containerBounds.height)
      svg.style.position = 'absolute'
      svg.style.top = '0'
      svg.style.left = '0'
      svg.style.pointerEvents = 'none'
      svg.style.zIndex = '2' // 位于大脑图片之上，热力图之下
      
      // 创建多边形路径
      const pathData = pixelPoints.map((point, index) => {
        return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
      }).join(' ') + ' Z'
      
      // 创建path元素
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', pathData)
      path.style.fill = 'rgba(255,200,0,0.2)' // 金黄色半透明填充，更醒目
      path.style.stroke = 'rgba(255,150,0,0.9)' // 橙色描边，高对比度
      path.style.strokeWidth = '3' // 加粗描边
      path.style.strokeDasharray = '10,5' // 虚线样式，更容易识别
      
      svg.appendChild(path)
      coverageAreaRef.value.appendChild(svg)
      
      coverageAreaSvg = svg
      
      console.log('[BrainModeView] 12-node覆盖区域SVG创建完成:', {
        containerSize: containerBounds,
        polygonPoints: pixelPoints.length,
        pathData: pathData.substring(0, 100) + '...'
      })
    }
    
    /**
     * 更新12-node覆盖区域 (使用12个dock的实际位置形成倒梯形)
     */
    async function updateCoverageArea() {
      if (!brainImageRef.value || !heatmapCoordinator || !nodeLayoutData) return
      
      try {
        console.log('[BrainModeView] 开始更新12-node覆盖区域（倒梯形形状）...')
        
        // 1. 获取容器边界 (与热力图完全相同)
        const containerBounds = heatmapCoordinator.calculateHeatmapBounds(
          brainImageRef.value, 
          brainDisplayRef.value
        )
        if (!containerBounds) {
          console.warn('[BrainModeView] 无法获取容器边界')
          return
        }
        
        // 2. 从12个dock中提取每个dock的中心位置
        const dockCenters = []
        if (nodeLayoutData && nodeLayoutData.docks) {
          nodeLayoutData.docks.forEach(dock => {
            if (dock.optodes && dock.optodes.length > 0) {
              // 计算每个dock的中心位置
              let sumX = 0, sumY = 0
              let count = 0
              
              dock.optodes.forEach(optode => {
                if (optode.coordinates_2d) {
                  sumX += optode.coordinates_2d.x
                  sumY += optode.coordinates_2d.y
                  count++
                }
              })
              
              if (count > 0) {
                dockCenters.push({
                  x: sumX / count,
                  y: sumY / count,
                  dock_id: dock.dock_id
                })
              }
            }
          })
        }
        
        console.log('[BrainModeView] 12个dock中心位置计算完成:', {
          dock数量: dockCenters.length,
          dock_ids: dockCenters.map(d => d.dock_id),
          样例坐标: dockCenters.slice(0, 3).map(d => ({
            dock: d.dock_id,
            x: d.x.toFixed(2), 
            y: d.y.toFixed(2)
          }))
        })
        
        // 3. 根据12个dock的实际布局，直接定义倒梯形的关键点
        // 12-node设备实际布局是3行4列，形成倒梯形
        if (dockCenters.length !== 12) {
          console.warn('[BrainModeView] dock数量不是12个:', dockCenters.length)
        }
        
        // 4. 使用所有dock中心点计算凸包（会自然形成倒梯形）
        const convexHull = calculateConvexHull(dockCenters)
        console.log('[BrainModeView] 12-node凸包计算完成（倒梯形）:', {
          dock中心点数: dockCenters.length,
          凸包点数: convexHull.length,
          形状: '倒梯形'
        })
        
        // 5. 外扩形成明显的包边区域 (8mm外扩，让倒梯形更明显)
        const expandedHull = expandPolygon(convexHull, 8)
        
        // 6. 转换为像素坐标
        const pixelPoints = triangleToPixelCoordinates(expandedHull, containerBounds)
        console.log('[BrainModeView] 12-node倒梯形坐标转换完成:', {
          Triangle坐标范围: {
            x: [Math.min(...expandedHull.map(p => p.x)), Math.max(...expandedHull.map(p => p.x))],
            y: [Math.min(...expandedHull.map(p => p.y)), Math.max(...expandedHull.map(p => p.y))]
          },
          像素点数: pixelPoints.length
        })
        
        // 7. 创建倒梯形SVG覆盖区域
        createCoverageAreaSVG(pixelPoints, containerBounds)
        
        console.log('[BrainModeView] ✅ 12-node倒梯形覆盖区域创建成功!', {
          形状: '倒梯形',
          dock数量: dockCenters.length,
          凸包点数: convexHull.length,
          容器尺寸: `${containerBounds.width}×${containerBounds.height}`
        })
        
      } catch (error) {
        console.error('[BrainModeView] ❌ 12-node覆盖区域更新失败:', error)
      }
    }
    

    /**
     * 初始化热力图系统
     */
    async function initializeHeatmapSystem() {
      try {
        console.log('[BrainModeView] 开始初始化热力图系统...')
        isLoading.value = true
        hasError.value = false
        
        // 0. 加载12-node布局数据 (用于覆盖区域)
        await loadNodeLayoutData()
        
        // 1. 初始化Triangle数据处理器
        triangleProcessor = new TriangleDataProcessor()
        const channelData = await triangleProcessor.processTriangleData()
        
        console.log('[BrainModeView] Triangle数据处理完成:', {
          sources: channelData.sources.length,
          detectors: channelData.detectors.length,
          channels: channelData.totalChannels
        })
        
        // 设置ECharts热力图需要的通道位置数据
        reportChannelPositions.value = channelData.channelPositions || []
        console.log('[BrainModeView] 通道位置数据已设置:', reportChannelPositions.value.length, '个通道')
        
        // 2. 初始化坐标协调器
        heatmapCoordinator = new HeatmapCoordinator()
        heatmapCoordinator.setLayoutBounds(channelData.layoutDimensions)
        
        // 3. 初始化覆盖层
        if (heatmapContainerRef.value) {
          // 初始化覆盖层
          updateCoverageOverlay({ width: 400, height: 300 })
        }
        
        // 4. 设置响应式更新
        setupResponsiveUpdates()
        
        // 5. 初始化完成后立即计算位置并强制更新样式
        nextTick(() => {
          if (brainImageRef.value) {
            console.log('[BrainModeView] coordinator初始化完成，重新计算位置')
            const bounds = heatmapCoordinator.calculateHeatmapBounds(brainImageRef.value, brainDisplayRef.value)
            if (bounds) {
              updateHeatmapSize(bounds)
              // 强制触发样式更新
              forceStyleUpdate()
            }
          }
        })
        
        // 6. 开始更新循环
        startUpdateLoop()
        
        isLoading.value = false
        console.log('[BrainModeView] 热力图系统初始化完成')
        
      } catch (error) {
        console.error('[BrainModeView] 热力图系统初始化失败:', error)
        hasError.value = true
        errorMessage.value = `初始化失败: ${error.message}`
        isLoading.value = false
      }
    }
    
    /**
     * 设置响应式更新 - 增强版实时同步
     */
    function setupResponsiveUpdates() {
      if (!brainImageRef.value || !heatmapCoordinator) return
      
      // 清理之前的监听器
      if (resizeCleanup) resizeCleanup()
      
      // 设置响应式更新
      resizeCleanup = heatmapCoordinator.setupResponsiveUpdates(
        brainImageRef.value,
        (bounds) => {
          console.log('[BrainModeView] 响应式更新:', bounds)
          updateHeatmapSize(bounds)
          // 立即同步位置
          syncHeatmapPosition()
          // 同步更新12-node覆盖区域
          updateCoverageArea()
        },
        100 // 减少防抖时间以获得更快的响应
      )
      
      // 添加额外的实时同步机制
      const syncInterval = setInterval(() => {
        syncHeatmapPosition()
        // 每500ms也同步覆盖区域位置
        if (nodeLayoutData) updateCoverageArea()
      }, 500) // 每500ms检查一次位置
      
      // 监听窗口滚动事件（如果有）
      const handleScroll = () => {
        syncHeatmapPosition()
        // 滚动时也同步覆盖区域
        if (nodeLayoutData) updateCoverageArea()
      }
      window.addEventListener('scroll', handleScroll, { passive: true })
      
      // 增强清理函数
      const originalCleanup = resizeCleanup
      resizeCleanup = () => {
        clearInterval(syncInterval)
        window.removeEventListener('scroll', handleScroll)
        if (originalCleanup) originalCleanup()
      }
    }
    
    /**
     * 更新热力图尺寸
     */
    function updateHeatmapSize(bounds) {
      if (!bounds) return
      
      try {
        // 同步更新覆盖层尺寸与多边形
        updateCoverageOverlay(bounds)
        
        console.log('[BrainModeView] 热力图尺寸已更新:', bounds)
      } catch (error) {
        console.error('[BrainModeView] 热力图尺寸更新失败:', error)
      }
    }
    
    /**
     * 处理HbO数据
     */
    function processHboData(rawData) {
      if (!Array.isArray(rawData)) return []
      
      return rawData.map(value => {
        // 处理嵌套数组和Proxy对象
        let actualValue = Array.isArray(value) ? value[0] : value
        actualValue = Number(actualValue)
        
        // 过滤无效值
        return isNaN(actualValue) ? 0 : actualValue
      })
    }
    
    /**
     * 更新热力图渲染 - 统一使用ECharts
     */
    function updateHeatmapRender() {
      if (!props.hboData) return
      
      try {
        const processedData = processHboData(props.hboData)
        // ECharts渲染通过组件props自动更新
        
        // 更新统计信息
        updateBrainStats(processedData)
        
        // 更新调试信息
        if (showDebugInfo.value) {
          updateDebugInfo()
        }
        
      } catch (error) {
        console.error('[BrainModeView] 热力图渲染失败:', error)
      }
    }
    
    /**
     * 更新大脑统计信息
     */
    function updateBrainStats(hboValues) {
      if (!hboValues || hboValues.length === 0) return
      
      // 计算活跃区域数量（数值大于阈值的区域）
      const activeCount = hboValues.filter(value => Math.abs(value) > 0.01).length
      activeBrainRegions.value = activeCount
      
      // 计算平均活跃度
      const avgActivity = hboValues.reduce((sum, val) => sum + Math.abs(val), 0) / hboValues.length
      averageBrainActivity.value = Math.min(100, Math.max(0, avgActivity * 1000))
    }
    
    /**
     * 更新调试信息
     */
    function updateDebugInfo() {
      debugInfo.value = {
        // renderer信息已移除，统一使用ECharts
        coordinator: heatmapCoordinator?.getDebugInfo(),
        processor: triangleProcessor?.validateData(),
        hboDataLength: props.hboData?.length || 0,
        timestamp: new Date().toISOString()
      }
    }
    
    /**
     * 开始更新循环
     */
    function startUpdateLoop() {
      updateTimer = setInterval(() => {
        updateHeatmapRender()
      }, 500) // 每500ms更新一次
    }
    
    /**
     * 停止更新循环
     */
    function stopUpdateLoop() {
      if (updateTimer) {
        clearInterval(updateTimer)
        updateTimer = null
      }
    }
    
    /**
     * 大脑图片加载完成事件
     */
    function onBrainImageLoad() {
      console.log('[BrainModeView] 大脑图片加载完成')
      const brainRect = brainImageRef.value?.getBoundingClientRect()
      const containerRect = brainDisplayRef.value?.getBoundingClientRect()
      console.log('[BrainModeView] 大脑图片尺寸:', {
        left: brainRect?.left, top: brainRect?.top,
        width: brainRect?.width, height: brainRect?.height
      })
      console.log('[BrainModeView] 容器尺寸:', {
        left: containerRect?.left, top: containerRect?.top,  
        width: containerRect?.width, height: containerRect?.height
      })
      
      // 图片加载完成后更新热力图尺寸和覆盖区域
      nextTick(() => {
        if (heatmapCoordinator && brainImageRef.value) {
          console.log('[BrainModeView] 开始计算热力图边界...')
          const bounds = heatmapCoordinator.calculateHeatmapBounds(brainImageRef.value, brainDisplayRef.value)
          console.log('[BrainModeView] 计算得到的边界:', bounds)
          if (bounds) {
            updateHeatmapSize(bounds)
            // 同时更新12-node覆盖区域
            updateCoverageArea()
          }
        }
      })
    }
    
    /**
     * 强制触发样式更新 - 参考demo.html的精确定位算法
     */
    function forceStyleUpdate() {
      console.log('[BrainModeView] 强制触发样式更新')
      if (heatmapContainerRef.value && heatmapCoordinator && brainImageRef.value) {
        const style = heatmapCoordinator.getSVGStyle(brainImageRef.value, brainDisplayRef.value)
        console.log('[BrainModeView] 直接应用样式:', style)
        
        // 直接应用样式到DOM元素 - 完全复制demo.html的定位逻辑
        Object.entries(style).forEach(([key, value]) => {
          heatmapContainerRef.value.style[key] = value
        })
        
        // 强制重新计算并应用位置，确保与demo.html一致
        nextTick(() => {
          const updatedStyle = heatmapCoordinator.getSVGStyle(brainImageRef.value, brainDisplayRef.value)
          Object.entries(updatedStyle).forEach(([key, value]) => {
            heatmapContainerRef.value.style[key] = value
          })
          
          console.log('[BrainModeView] 二次位置校正完成，最终样式:', {
            left: heatmapContainerRef.value.style.left,
            top: heatmapContainerRef.value.style.top,
            width: heatmapContainerRef.value.style.width,
            height: heatmapContainerRef.value.style.height,
            opacity: heatmapContainerRef.value.style.opacity
          })
        })
      }
    }
    
    /**
     * 实时位置同步 - 确保热力图始终跟随大脑图片
     */
    function syncHeatmapPosition() {
      if (!heatmapContainerRef.value || !heatmapCoordinator || !brainImageRef.value) return
      
      // 使用requestAnimationFrame确保平滑的位置更新
      requestAnimationFrame(() => {
        const bounds = heatmapCoordinator.calculateHeatmapBounds(brainImageRef.value, brainDisplayRef.value)
        if (bounds) {
          // 直接更新位置，不依赖Vue的响应式系统以获得更好的性能
          heatmapContainerRef.value.style.left = `${bounds.left}px`
          heatmapContainerRef.value.style.top = `${bounds.top}px`
          heatmapContainerRef.value.style.width = `${bounds.width}px`
          heatmapContainerRef.value.style.height = `${bounds.height}px`
          
          // 同时更新热力图渲染尺寸
          updateHeatmapSize(bounds)
        }
      })
    }

    /**
     * 计算并更新覆盖区域多边形
     * 基于 fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json 的 optode 2D 坐标
     */
    function updateCoverageOverlay(bounds) {
      try {
        if (!coverageOverlayRef.value || !bounds) return

        // 1) 收集全部 optode 的二维坐标（mm）
        const pointsMm = []
        try {
          const docks = fullLayout?.docks || []
          docks.forEach(dock => {
            (dock.optodes || []).forEach(opt => {
              const c2d = opt?.coordinates_2d
              if (c2d && typeof c2d.x === 'number' && typeof c2d.y === 'number') {
                pointsMm.push([c2d.x, c2d.y])
              }
            })
          })
        } catch (e) {
          console.warn('[BrainModeView] 解析full layout失败', e)
        }

        if (pointsMm.length < 3) {
          overlayPoints.value = ''
          overlayViewBox.value = `0 0 ${bounds.width} ${bounds.height}`
          return
        }

        // 2) 计算外轮廓（凸包）使用GeometryUtils
        const hullMm = GeometryUtils.createConvexHull(pointsMm)
        if (!hullMm || hullMm.length < 3) {
          overlayPoints.value = ''
          overlayViewBox.value = `0 0 ${bounds.width} ${bounds.height}`
          return
        }

        // 3) mm → px 映射（与热力图一致的坐标变换，Y 轴翻转）
        const dims = fullLayout?.dimensions?.dimensions_2d || { x: 188.72, y: 110.29 }
        const widthPx = bounds.width
        const heightPx = bounds.height
        const pointsPx = hullMm.map(([xMm, yMm]) => {
          const x = (xMm / dims.x) * widthPx
          const y = heightPx - (yMm / dims.y) * heightPx
          return [x, y]
        })

        // 4) 生成 points 属性字符串
        overlayPoints.value = pointsPx.map(([x, y]) => `${x},${y}`).join(' ')
        overlayViewBox.value = `0 0 ${widthPx} ${heightPx}`

      } catch (error) {
        console.error('[BrainModeView] 覆盖区域更新失败:', error)
      }
    }
    
    /**
     * 清理资源
     */
    function cleanup() {
      console.log('[BrainModeView] 开始清理资源...')
      
      stopUpdateLoop()
      
      if (resizeCleanup) {
        resizeCleanup()
        resizeCleanup = null
      }
      
      // D3渲染器已移除
      
      triangleProcessor = null
      heatmapCoordinator = null
    }
    
    // 监听数据变化
    watch(() => props.currentValues, () => {
      updateHeatmapRender()
    }, { deep: true })
    
    // 监听HbO数据变化
    watch(() => props.hboData, (newHboData) => {
      console.log('[BrainModeView] HbO数据更新，触发热力图重绘')
      
      // 收集血氧数据到会话管理器
      if (newHboData && Array.isArray(newHboData) && newHboData.length > 0) {
        try {
          // 计算平均值或使用第一个有效值
          const validValues = newHboData.filter(val => !isNaN(val) && isFinite(val))
          if (validValues.length > 0) {
            // 可以传递单个平均值或整个数组
            const avgHbo = validValues.reduce((sum, val) => sum + val, 0) / validValues.length
            
            // 添加数据点到会话管理器
            sessionManager.addHBODataPoint(avgHbo, {
              timestamp: Date.now(),
              channel_count: newHboData.length,
              valid_ratio: validValues.length / newHboData.length,
              quality: validValues.length / newHboData.length // 简单的质量评分
            })
            
            console.log(`[BrainModeView] 已收集血氧数据: 平均值=${avgHbo.toFixed(3)}, 有效通道=${validValues.length}/${newHboData.length}`)
          }
        } catch (error) {
          console.error('[BrainModeView] 血氧数据收集失败:', error)
        }
      }
      
      updateHeatmapRender()
    }, { deep: true })
    
    // 组件挂载
    onMounted(async () => {
      console.log('[BrainModeView] 组件已挂载，开始初始化...')
      
      // 启动训练会话
      try {
        const sessionResult = await sessionManager.startSession('brain', {
          mode_details: {
            heatmap_enabled: true,
            triangle_layout: true,
            auto_screenshot: true
          }
        })
        
        if (sessionResult.success) {
          console.log(`[BrainModeView] 训练会话已启动: ${sessionResult.session_id}`)
        } else {
          console.warn('[BrainModeView] 会话启动失败，继续本地操作:', sessionResult.error)
        }
      } catch (error) {
        console.error('[BrainModeView] 会话启动异常:', error)
      }
      await nextTick()
      await initializeHeatmapSystem()
    })
    
    // 组件卸载
    onUnmounted(async () => {
      console.log('[BrainModeView] 组件正在卸载...')
      
      // 结束训练会话
      try {
        const sessionStatus = sessionManager.getSessionStatus()
        if (sessionStatus.active) {
          console.log('[BrainModeView] 结束训练会话...')
          
          const endResult = await sessionManager.endSession({
            mode: 'brain',
            end_reason: 'component_unmount',
            final_screenshot: null // 可以在这里添加最终截图
          })
          
          if (endResult.success) {
            console.log('[BrainModeView] 训练会话已成功结束')
          } else {
            console.warn('[BrainModeView] 会话结束失败:', endResult.error)
          }
        }
      } catch (error) {
        console.error('[BrainModeView] 结束会话时发生异常:', error)
      }
      
      cleanup()
    })
    
    return {
      // DOM引用
      brainDisplayRef,
      brainImageRef,
      heatmapContainerRef,
      coverageAreaRef,
      
      // 状态
      isLoading,
      hasError,
      errorMessage,
      activeBrainRegions,
      averageBrainActivity,
      
      // 计算属性
      heatmapContainerStyle,
      coverageOverlayRef,
      overlayPoints,
      overlayViewBox,
      
      // 配置
      brainImageSrc,
      showDebugInfo,
      debugInfo,
      useReportHeatmap,
      reportChannelPositions,
      reportLayoutDimensions,
      sixDockTriangleVertices,
      heatmapAlignment,
      
      // 方法
      formatPercentage,
      onBrainImageLoad
    }
  }
}
</script>

<style scoped>
.brain-mode-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
  /* Jet 风格：深蓝 → 蓝 → 青 → 黄 → 红 → 深红 */
  background: linear-gradient(to right, #000080, #0000FF, #00FFFF, #FFFF00, #FF0000, #800000);
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
  /* 确保容器不会过度拉伸 */
  min-height: 400px;
  overflow: hidden; /* 防止内容溢出 */
  padding: 20px; /* 添加内边距确保内容不贴边 */
}

.brain-display-large {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 大脑背景图片 - 响应式设计优化 */
.brain-background-image {
  /* 基础响应式设置 */
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  
  /* 为1920x1080分辨率优化的最大尺寸 */
  max-width: 650px;  /* 限制最大宽度 */
  max-height: 650px; /* 限制最大高度 */
  
  /* 保持比例和样式 */
  object-fit: contain;
  border-radius: 15px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

/* 12-node覆盖区域容器 - 位于大脑图片之上，热力图之下 */
.coverage-area-container {
  position: absolute;
  pointer-events: none;
  z-index: 2;
  border: none !important;
  outline: none !important;
}

/* SVG热力图容器 - 移除边框，确保无干扰 */
.heatmap-svg-container {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  border: none !important;
  outline: none !important;
}

/* 覆盖区域层（位于热力图Canvas下方，通过DOM插入顺序保证在下层） */
.coverage-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 加载状态 */
.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 30px;
  border-radius: 15px;
  z-index: 20;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误状态 */
.error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  padding: 30px;
  border-radius: 15px;
  z-index: 20;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

/* 调试面板 */
.debug-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  max-width: 400px;
  max-height: 300px;
  overflow: auto;
  font-size: 12px;
  z-index: 100;
}

.debug-panel h4 {
  margin: 0 0 10px 0;
  color: #4ade80;
}

.debug-panel pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 响应式设计 - 不同屏幕尺寸适配 */
@media (max-width: 1366px) {
  /* 小型笔记本屏幕 */
  .brain-background-image {
    max-width: 550px;
    max-height: 550px;
  }
  
  .brain-colorbar-gradient {
    width: 350px;
  }
  
  .brain-colorbar-labels {
    width: 350px;
  }
}

@media (max-width: 1280px) {
  /* 平板横屏 */
  .brain-background-image {
    max-width: 500px;
    max-height: 500px;
  }
  
  .brain-colorbar {
    margin-bottom: 20px;
  }
}

@media (min-width: 1920px) {
  /* 全高清屏幕(1920x1080) - 标准尺寸 */
  .brain-background-image {
    max-width: 700px;
    max-height: 700px;
  }
}

@media (min-width: 2560px) {
  /* 2K及以上屏幕 */
  .brain-background-image {
    max-width: 850px;
    max-height: 850px;
  }
  
  .brain-colorbar-gradient {
    width: 500px;
  }
  
  .brain-colorbar-labels {
    width: 500px;
  }
}

@media (max-height: 768px) {
  /* 垂直空间受限时(如某些平板) */
  .brain-background-image {
    max-height: 450px;
  }
  
  .brain-colorbar {
    margin-bottom: 15px;
  }
}

@media (max-height: 900px) {
  /* 中等高度屏幕 */
  .brain-background-image {
    max-height: 550px;
  }
}
</style>