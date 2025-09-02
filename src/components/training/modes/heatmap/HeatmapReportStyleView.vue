<template>
  <div class="heatmap-report-style-view">
    <!-- 控制面板 -->
    <div class="control-panel" v-if="showControls">
      <div class="control-group">
        <label>渲染模式:</label>
        <select v-model="renderMode" @change="switchRenderMode">
          <option value="report">报告风格(ECharts)</option>
          <option value="legacy">传统模式(Canvas)</option>
        </select>
      </div>
      
      <div class="control-group">
        <label>色谱类型:</label>
        <select v-model="colorMapType" @change="updateColorMap">
          <option value="Spectral">Spectral (蓝-黄-绿-红)</option>
          <option value="RdYlGn">RdYlGn (红-黄-绿)</option>
          <option value="Rainbow">Rainbow (彩虹)</option>
          <option value="Jet">Jet (经典)</option>
        </select>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" v-model="showContours" @change="updateContours">
          显示等高线
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" v-model="showChannels" @change="updateChannelDisplay">
          显示通道点
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" v-model="overlayEnabled" @change="updateOverlay">
          显示12-node覆盖层
        </label>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="heatmap-content">
      <!-- ECharts容器 -->
      <div 
        ref="chartContainer" 
        class="chart-container"
        :class="{ 'with-colorbar': showColorbar }"
      >
      </div>
      
      <!-- 颜色条 -->
      <div v-if="showColorbar" class="colorbar-container">
        <div ref="colorbarChart" class="colorbar-chart"></div>
      </div>
      
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">生成报告风格热力图...</div>
      </div>
      
      <!-- 错误状态 -->
      <div v-if="hasError" class="error-overlay">
        <div class="error-message">{{ errorMessage }}</div>
        <button @click="retryRender" class="retry-button">重试</button>
      </div>
    </div>
    
    <!-- 12-node覆盖层信息 -->
    <div v-if="overlayEnabled && overlayInfo" class="overlay-info">
      <span>覆盖区域: {{ overlayInfo.nodeCount }}个节点</span>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'
import { IDWInterpolator, GridBuilder } from '../../../../utils/heatmap/interpolation/idw.js'
import { ColorMapManager, MaskUtils } from '../../../../utils/heatmap/colorMaps.js'
import * as d3 from 'd3'
import fullLayout from '../../../../../fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json'

export default {
  name: 'HeatmapReportStyleView',
  props: {
    // 数据输入
    hboData: {
      type: Array,
      required: true
    },
    channelPositions: {
      type: Array,
      required: true
    },
    layoutDimensions: {
      type: Object,
      default: () => ({ x: 188.72, y: 110.29 })
    },
    
    // 配置参数
    gridSize: {
      type: Number,
      default: 120
    },
    kNeighbors: {
      type: Number,
      default: 16
    },
    gaussianSigma: {
      type: Number,
      default: 2.0
    },
    valueDomain: {
      type: Object,
      default: () => ({ min: -0.05, max: 0.05 })
    },
    colorMap: {
      type: String,
      default: 'Spectral'
    },
    discreteLevels: {
      type: Number,
      default: 9
    },
    showContours: {
      type: Boolean,
      default: true
    },
    showColorbar: {
      type: Boolean,
      default: true
    },
    showChannels: {
      type: Boolean,
      default: false
    },
    overlayEnabled: {
      type: Boolean,
      default: true
    },
    updateIntervalMs: {
      type: Number,
      default: 500
    },
    showControls: {
      type: Boolean,
      default: false
    },
    useWorker: {
      type: Boolean,
      default: false // 暂时禁用Worker
    }
  },
  
  setup(props, { emit }) {
    // 组件状态
    const chartContainer = ref(null)
    const colorbarChart = ref(null)
    const isLoading = ref(false)
    const hasError = ref(false)
    const errorMessage = ref('')
    
    // ECharts实例
    let mainChart = null
    let colorbarChartInstance = null
    
    // 控制状态
    const renderMode = ref('report')
    const colorMapType = ref(props.colorMap)
    const showContours = ref(props.showContours)
    const showChannels = ref(props.showChannels)
    const overlayEnabled = ref(props.overlayEnabled)
    
    // 核心处理器实例
    let idwInterpolator = null
    let colorMapManager = null
    let updateTimer = null
    
    // 预计算数据缓存
    const computeCache = reactive({
      gridInfo: null,
      neighbors: null,
      maskData: null,
      overlayPolygon: null
    })
    
    // 覆盖层信息
    const overlayInfo = ref(null)
    const overlayPointsMm = ref([])

    // 预计算12-node覆盖层外轮廓（基于 fullLayout 的 optode 2D 坐标，mm）
    function precomputeOverlayHull() {
      try {
        const points = []
        const docks = fullLayout?.docks || []
        docks.forEach(d => {
          (d.optodes || []).forEach(o => {
            const c2d = o?.coordinates_2d
            if (c2d && typeof c2d.x === 'number' && typeof c2d.y === 'number') {
              points.push([c2d.x, c2d.y])
            }
          })
        })
        if (points.length < 3) {
          overlayPointsMm.value = []
          overlayInfo.value = { nodeCount: docks.length || 0 }
          return
        }
        const hull = convexHull(points)
        const buffered = expandPolygon(hull, 3) // 外扩≈3mm
        overlayPointsMm.value = buffered
        overlayInfo.value = { nodeCount: docks.length || 0 }
      } catch (e) {
        console.warn('[报告风格热力图] 预计算覆盖层失败:', e)
        overlayPointsMm.value = []
      }
    }

    // Andrew 单调链凸包
    function convexHull(pts) {
      const points = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
      const lower = []
      for (const p of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
        lower.push(p)
      }
      const upper = []
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i]
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
        upper.push(p)
      }
      upper.pop(); lower.pop()
      return lower.concat(upper)
    }

    // 多边形外扩：以质心为中心径向外推 edgeMm
    function expandPolygon(poly, edgeMm = 3) {
      const n = poly.length
      if (n === 0) return []
      let cx = 0, cy = 0
      for (const [x, y] of poly) { cx += x; cy += y }
      cx /= n; cy /= n
      const out = []
      for (const [x, y] of poly) {
        const vx = x - cx
        const vy = y - cy
        const len = Math.hypot(vx, vy) || 1
        const nx = vx / len
        const ny = vy / len
        out.push([x + nx * edgeMm, y + ny * edgeMm])
      }
      return out
    }
    
    // 计算属性
    const currentChannelData = computed(() => {
      if (!props.channelPositions || !props.hboData) return []
      
      return props.channelPositions.map((pos, index) => ({
        position: pos.position || [pos.x, pos.y],
        value: props.hboData[index] || 0,
        channelIndex: index
      }))
    })
    
    // 初始化核心组件
    function initializeComponents() {
      try {
        // 初始化IDW插值器
        idwInterpolator = new IDWInterpolator({
          power: 2,
          kNeighbors: props.kNeighbors,
          qualityWeightEnabled: false
        })
        
        // 初始化颜色映射管理器
        colorMapManager = new ColorMapManager({
          valueDomain: props.valueDomain,
          colorMap: colorMapType.value,
          discreteLevels: props.discreteLevels
        })
        
        console.log('[报告风格热力图] 核心组件初始化完成')
      } catch (error) {
        console.error('[报告风格热力图] 组件初始化失败:', error)
        hasError.value = true
        errorMessage.value = '组件初始化失败: ' + error.message
      }
    }
    
    // 预计算网格和掩膜
    function precomputeGridData() {
      if (!currentChannelData.value.length) return
      
      try {
        // 创建网格信息
        computeCache.gridInfo = GridBuilder.createGridInfo(
          currentChannelData.value, 
          { gridSize: props.gridSize, padding: 5 }
        )
        
        // 预计算近邻关系
        computeCache.neighbors = idwInterpolator.precomputeNeighbors(
          currentChannelData.value,
          computeCache.gridInfo
        )
        
        // 创建掩膜
        computeCache.maskData = MaskUtils.createHeadMask(
          props.gridSize,
          computeCache.gridInfo.bounds,
          {
            maskType: 'forehead',
            smoothing: true,
            smoothingSigma: 2.0
          }
        )
        // 预计算12-node覆盖层外轮廓
        precomputeOverlayHull()
        // 预计算12-node覆盖层外轮廓
        precomputeOverlayHull()
        
        console.log('[报告风格热力图] 网格预计算完成:', {
          gridSize: props.gridSize,
          channels: currentChannelData.value.length,
          bounds: computeCache.gridInfo.bounds
        })
      } catch (error) {
        console.error('[报告风格热力图] 网格预计算失败:', error)
        hasError.value = true
        errorMessage.value = '网格预计算失败: ' + error.message
      }
    }
    
    // 初始化ECharts
    function initializeCharts() {
      if (!chartContainer.value) return
      
      try {
        // 主热力图
        mainChart = echarts.init(chartContainer.value)
        
        // 设置基础配置
        const option = {
          animation: false, // 关闭动画提高性能
          grid: {
            left: '5%',
            right: showColorbar ? '15%' : '5%',
            top: '5%',
            bottom: '5%',
            containLabel: false
          },
          xAxis: {
            type: 'value',
            show: false,
            min: computeCache.gridInfo?.bounds.minX || 0,
            max: computeCache.gridInfo?.bounds.maxX || 100
          },
          yAxis: {
            type: 'value',
            show: false,
            min: computeCache.gridInfo?.bounds.minY || 0,
            max: computeCache.gridInfo?.bounds.maxY || 100
          },
          series: []
        }
        
        mainChart.setOption(option)
        
        // 颜色条
        if (props.showColorbar && colorbarChart.value) {
          initializeColorbar()
        }
        
        console.log('[报告风格热力图] ECharts初始化完成')
      } catch (error) {
        console.error('[报告风格热力图] ECharts初始化失败:', error)
        hasError.value = true
        errorMessage.value = 'ECharts初始化失败: ' + error.message
      }
    }
    
    // 初始化颜色条
    function initializeColorbar() {
      if (!colorbarChart.value) return
      
      colorbarChartInstance = echarts.init(colorbarChart.value)
      
      const colorBarData = colorMapManager.getColorBarData()
      
      const option = {
        grid: {
          left: '20%',
          right: '20%',
          top: '5%',
          bottom: '15%'
        },
        xAxis: {
          show: false
        },
        yAxis: {
          type: 'value',
          min: colorBarData.domain.min,
          max: colorBarData.domain.max,
          axisLabel: {
            formatter: '{value}',
            fontSize: 10
          },
          axisTick: {
            show: true
          }
        },
        series: [{
          type: 'scatter',
          data: colorBarData.data.map(item => [0, item.value]),
          itemStyle: {
            color: (params) => colorBarData.data[params.dataIndex].color
          },
          symbolSize: 20,
          symbol: 'rect'
        }]
      }
      
      colorbarChartInstance.setOption(option)
    }
    
    // 生成热力图数据
    function generateHeatmapData() {
      if (!computeCache.gridInfo || !idwInterpolator || !colorMapManager) {
        console.warn('[报告风格热力图] 必要组件未初始化')
        return null
      }
      
      try {
        // IDW插值
        const gridData = idwInterpolator.interpolate(
          currentChannelData.value,
          computeCache.gridInfo,
          computeCache.neighbors
        )
        
        // 高斯平滑
        const smoothedData = idwInterpolator.applyGaussianSmoothing(
          gridData,
          props.gridSize,
          props.gaussianSigma
        )
        
        // 应用掩膜
        const maskedData = MaskUtils.applyMask(smoothedData, computeCache.maskData)
        computeCache.lastMaskedGrid = maskedData
        
        // 转换为ECharts格式
        const heatmapData = []
        const { bounds } = computeCache.gridInfo
        const width = bounds.maxX - bounds.minX
        const height = bounds.maxY - bounds.minY
        
        for (let y = 0; y < props.gridSize; y++) {
          for (let x = 0; x < props.gridSize; x++) {
            const value = maskedData[y * props.gridSize + x]
            
            if (!isNaN(value)) {
              const worldX = bounds.minX + (x / (props.gridSize - 1)) * width
              const worldY = bounds.minY + (y / (props.gridSize - 1)) * height
              
              heatmapData.push([worldX, worldY, value])
            }
          }
        }
        
        return heatmapData
      } catch (error) {
        console.error('[报告风格热力图] 热力图数据生成失败:', error)
        return null
      }
    }
    
    // 更新热力图显示
    function updateHeatmapDisplay() {
      if (!mainChart || isLoading.value) return
      
      isLoading.value = true
      hasError.value = false
      
      try {
        const heatmapData = generateHeatmapData()
        
        if (!heatmapData) {
          throw new Error('热力图数据生成失败')
        }
        
        // 构建系列数据
        const series = []

        // 覆盖层（底于热力图）
        if (overlayEnabled.value && overlayPointsMm.value && overlayPointsMm.value.length >= 3) {
          const center = colorMapManager.getCenterColor()
          const fill = `rgba(${center[0]}, ${center[1]}, ${center[2]}, ${center[3]})`
          const stroke = `rgba(${Math.min(255, center[0] + 30)}, ${Math.min(255, center[1] + 30)}, ${Math.min(255, center[2] + 30)}, 0.2)`
          series.push({
            type: 'custom',
            name: 'overlay',
            z: 0,
            data: [overlayPointsMm.value],
            renderItem: (params, api) => {
              const pts = params.data[0]
              const poly = pts.map(p => api.coord(p))
              return {
                type: 'polygon',
                shape: { points: poly },
                style: api.style({ fill, stroke, lineWidth: 1.5 })
              }
            },
            silent: true
          })
        }
        
        // 主热力图系列
        series.push({
          type: 'heatmap',
          data: heatmapData,
          itemStyle: {
            color: (params) => {
              const color = colorMapManager.getColor(params.value[2], true)
              return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
            }
          },
          emphasis: {
            itemStyle: {
              borderColor: '#333',
              borderWidth: 1
            }
          }
        })
        
        // 通道点系列
        if (showChannels.value) {
          const channelData = currentChannelData.value.map(ch => [
            ch.position[0], 
            ch.position[1], 
            ch.value
          ])
          
          series.push({
            type: 'scatter',
            data: channelData,
            symbolSize: 6,
            itemStyle: {
              color: '#ffffff',
              borderColor: '#333333',
              borderWidth: 1
            },
            z: 10
          })
        }
        
        // 更新图表
        mainChart.setOption({ series }, true)
        
        console.log('[报告风格热力图] 显示更新完成:', {
          dataPoints: heatmapData.length,
          channels: showChannels.value ? currentChannelData.value.length : 0
        })
        
      } catch (error) {
        console.error('[报告风格热力图] 显示更新失败:', error)
        hasError.value = true
        errorMessage.value = '显示更新失败: ' + error.message
      } finally {
        isLoading.value = false
      }
    }
    
    // 切换渲染模式
    function switchRenderMode() {
      emit('render-mode-changed', renderMode.value)
    }
    
    // 更新颜色映射
    function updateColorMap() {
      if (colorMapManager) {
        colorMapManager.updateColorMap(colorMapType.value)
        updateHeatmapDisplay()
      }
    }
    
    // 更新等高线显示
    function updateContours() { updateHeatmapDisplay() }
    
    // 更新通道点显示
    function updateChannelDisplay() {
      updateHeatmapDisplay()
    }
    
    // 更新覆盖层
    function updateOverlay() { updateHeatmapDisplay() }
    
    // 重试渲染
    function retryRender() {
      hasError.value = false
      errorMessage.value = ''
      updateHeatmapDisplay()
    }
    
    // 开始更新循环
    function startUpdateLoop() {
      if (updateTimer) return
      
      updateTimer = setInterval(() => {
        if (!isLoading.value && !hasError.value) {
          updateHeatmapDisplay()
        }
      }, props.updateIntervalMs)
    }
    
    // 停止更新循环
    function stopUpdateLoop() {
      if (updateTimer) {
        clearInterval(updateTimer)
        updateTimer = null
      }
    }
    
    // 监听器
    watch(() => props.hboData, () => {
      if (mainChart) {
        updateHeatmapDisplay()
      }
    })
    
    watch(() => props.channelPositions, () => {
      precomputeGridData()
      if (mainChart) {
        updateHeatmapDisplay()
      }
    })
    
    // 生命周期
    onMounted(async () => {
      console.log('[报告风格热力图] 组件挂载')
      
      await nextTick()
      
      initializeComponents()
      precomputeGridData()
      initializeCharts()
      
      await nextTick()
      updateHeatmapDisplay()
      
      startUpdateLoop()
    })
    
    onUnmounted(() => {
      console.log('[报告风格热力图] 组件卸载')
      
      stopUpdateLoop()
      
      if (mainChart) {
        mainChart.dispose()
      }
      
      if (colorbarChartInstance) {
        colorbarChartInstance.dispose()
      }
    })
    
    return {
      // refs
      chartContainer,
      colorbarChart,
      
      // 状态
      isLoading,
      hasError,
      errorMessage,
      overlayInfo,
      
      // 控制
      renderMode,
      colorMapType,
      showContours,
      showChannels,
      overlayEnabled,
      
      // 方法
      switchRenderMode,
      updateColorMap,
      updateContours,
      updateChannelDisplay,
      updateOverlay,
      retryRender
    }
  }
}
</script>

<style scoped>
.heatmap-report-style-view {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.control-panel {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #ffffff;
  font-size: 12px;
}

.control-group select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  color: #ffffff;
  padding: 2px 6px;
  font-size: 11px;
}

.control-group input[type="checkbox"] {
  margin-right: 4px;
}

.heatmap-content {
  flex: 1;
  position: relative;
  display: flex;
}

.chart-container {
  flex: 1;
  min-height: 300px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.chart-container.with-colorbar {
  margin-right: 60px;
}

.colorbar-container {
  position: absolute;
  right: 10px;
  top: 10px;
  bottom: 10px;
  width: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.colorbar-chart {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #ffffff;
  z-index: 100;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.loading-text {
  font-size: 14px;
  text-align: center;
}

.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(200, 50, 50, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #ffffff;
  z-index: 100;
  padding: 20px;
  text-align: center;
}

.error-message {
  font-size: 14px;
  margin-bottom: 15px;
}

.retry-button {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;
}

.retry-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.overlay-info {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  z-index: 10;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>