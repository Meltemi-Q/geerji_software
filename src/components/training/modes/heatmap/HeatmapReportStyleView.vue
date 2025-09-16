<template>
  <div class="heatmap-report-style-view" :class="{ 'has-error': hasError }">
    <!-- 主热力图容器 -->
    <div 
      ref="chartContainer"
      class="chart-container"
      :style="{ 
        minHeight: '200px',
        display: 'block',
        opacity: isLoading ? 0.5 : 1
      }"
    ></div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-indicator">
      <span>正在渲染热力图...</span>
    </div>

    <!-- 错误信息 -->
    <div v-if="hasError" class="error-message">
      <span>{{ errorMessage }}</span>
    </div>

    <!-- 调试信息 -->
    <div v-if="showDebug" class="debug-info" style="position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px; font-size: 12px;">
      <div>数据点数: {{ currentChannelDataLength }}</div>
      <div>网格尺寸: {{ gridSize }}</div>
      <div>实例状态: {{ isEChartsReady ? '已就绪' : '未就绪' }}</div>
    </div>

  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'
import { IDWInterpolator, GridBuilder } from '../../../../utils/heatmap/interpolation/idw.js'

export default {
  name: 'HeatmapReportStyleView',
  
  props: {
    // 核心数据
    hboData: {
      type: Array,
      default: () => []
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
    valueDomain: {
      type: Object,
      default: () => ({ min: -0.05, max: 0.05 })
    },
    
    // IDW插值参数
    kNeighbors: {
      type: Number,
      default: 16
    },
    gaussianSigma: {
      type: Number,
      default: 2.0
    },
    
    // 对齐参数配置
    alignment: {
      type: Object,
      default: () => ({
        position: { x: 0.5, y: 0.42 },
        scale: { width: 0.9, height: 0.55 },
        opacity: 0.7,
        rotation: 0,
        anchor: "center",
        version: "1.0",
        deviceProfile: "triangle"
      })
    },
    
    // 6dock模式支持
    useSixDockMode: {
      type: Boolean,
      default: false
    },
    sixDockTriangleVertices: {
      type: Array,
      default: () => []
    },
    
    // 显示控制
    showChannels: {
      type: Boolean,
      default: false
    },
    showDebug: {
      type: Boolean,
      default: false
    },
    overlayEnabled: {
      type: Boolean,
      default: false
    }
  },
  
  setup(props) {
    // 组件状态
    const chartContainer = ref(null)
    const isLoading = ref(false)
    const hasError = ref(false)
    const errorMessage = ref('')
    
    // ECharts实例
    let mainChart = null
    
    // 状态标志
    let isEChartsReady = false
    let isUpdating = false
    // 更新节流控制
    const MIN_UPDATE_INTERVAL_MS = 800
    let lastUpdateAt = 0
    let updateDebounceTimer = null
    let pendingUpdate = false

    // 🚀 固定结构预计算变量 - 实现用户理念："第一帧设定mask，后续只计算数值"
    let fixedGridInfo = null
    let fixedInterpolator = null
    let precomputedNeighbors = null
    let isStructureInitialized = false


    // 当前通道数据长度
    const currentChannelDataLength = computed(() => {
      return props.channelPositions?.length || 0
    })

    // 覆盖层信息
    const overlayInfo = computed(() => {
      if (!props.overlayEnabled) return null
      return {
        nodeCount: props.channelPositions?.length || 0
      }
    })
    
    // 等待容器准备就绪
    async function waitForContainerReady(maxWaitMs = 3000) {
      const start = Date.now()
      return new Promise(resolve => {
        const check = () => {
          const el = chartContainer.value
          if (!el) {
            if (Date.now() - start > maxWaitMs) {
              resolve(false)
            } else {
              setTimeout(check, 50)
            }
            return
          }
          
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            resolve(true)
          } else if (Date.now() - start > maxWaitMs) {
            console.warn('[报告风格热力图] 容器尺寸等待超时')
            resolve(false)
          } else {
            setTimeout(check, 50)
          }
        }
        check()
      })
    }

    // 🚀 SDK数据标准化函数 - 严格按照 HEATMAP_INSTANT_REFRESH_STORY.md
    function normalizeHboData(raw, channelPositions) {
      const n = channelPositions?.length || 0
      if (!raw) return new Array(n).fill(0)

      if (Array.isArray(raw)) {
        return Array.from({ length: n }, (_, i) => {
          const v = raw[i]
          const x = Array.isArray(v) ? Number(v?.[0]) : Number(v)
          return Number.isFinite(x) ? x : 0
        })
      }

      const map = raw instanceof Map ? raw : new Map(Object.entries(raw || {}))
      return Array.from({ length: n }, (_, i) => {
        const id = channelPositions[i]?.channelId ?? i
        const v = map.get?.(String(id)) ?? map.get?.(id) ?? raw?.[id]
        const x = Array.isArray(v) ? Number(v?.[0]) : Number(v)
        return Number.isFinite(x) ? x : 0
      })
    }

    // 🚀 初始化固定热力图结构 - 一次性预计算网格、mask、邻居关系
    function initializeFixedHeatmapStructure() {
      // 如果已经初始化，直接返回成功
      if (isStructureInitialized) {
        return true
      }
      
      // 如果没有通道位置数据，返回失败
      if (!props.channelPositions || props.channelPositions.length === 0) {
        console.warn(`[固定结构] 初始化失败 - 通道位置数据无效:`, {
          channelPositions: props.channelPositions,
          length: props.channelPositions?.length
        })
        return false
      }

      // console.log('[固定结构] 开始初始化热力图固定结构...')

      try {
        // 创建通道模板（固定位置，数值设为0）
        const channelTemplate = props.channelPositions.map((pos, index) => ({
          position: pos.position,
          value: 0, // 模板数值，后续只更新这个字段
          channelId: pos.channelId || index
        }))

        // 一次性创建固定网格信息（包含三角形mask）
        fixedGridInfo = GridBuilder.createGridInfo(channelTemplate, {
          gridSize: props.gridSize,
          layoutDimensions: props.layoutDimensions,
          padding: 5,
          useSixDockMode: props.useSixDockMode,
          sixDockTriangleVertices: props.sixDockTriangleVertices
        })

        // 创建固定IDW插值器
        fixedInterpolator = new IDWInterpolator({
          power: 2,
          kNeighbors: props.kNeighbors,
          useRadius: false
        })

        // 一次性预计算所有网格点的邻居关系
        precomputedNeighbors = fixedInterpolator.precomputeNeighbors(channelTemplate, fixedGridInfo)

        isStructureInitialized = true
        console.log(`[固定结构] 初始化完成 - 网格:${fixedGridInfo.gridSize}x${fixedGridInfo.gridSize}, 有效mask点:${fixedGridInfo.triangleMask?.filter(Boolean).length || 0}`)
        
        return true
      } catch (error) {
        console.error('[固定结构] 初始化失败:', error)
        return false
      }
    }

    // 🚀 快速热力图数据更新 - 使用固定结构，只更新数值
    function fastUpdateHeatmapData() {
      
      // 确保固定结构已初始化
      if (!initializeFixedHeatmapStructure()) {
        console.warn('[快速更新] 固定结构初始化失败，回退到传统模式')
        return generateInterpolatedHeatmapData()
      }

      // 🚀 使用标准化SDK数据
      const currentData = normalizeHboData(props.hboData, props.channelPositions)

      try {
        // 只更新数值，不重建结构
        const channelDataWithValues = props.channelPositions.map((channel, index) => ({
          position: channel.position,
          value: currentData[index] || 0,  // 直接使用当前SDK数据
          channelId: channel.channelId || index
        }))

        // 使用预计算的固定结构进行快速插值
        const interpolatedGrid = fixedInterpolator.interpolate(
          channelDataWithValues, 
          fixedGridInfo, 
          precomputedNeighbors  // 使用预计算的邻居关系
        )
        
        // 应用高斯平滑
        const smoothedGrid = fixedInterpolator.applyGaussianSmoothing(
          interpolatedGrid, 
          props.gridSize, 
          props.gaussianSigma
        )

        // console.log(`[快速更新] 插值完成，有效数据点: ${smoothedGrid.filter(v => !isNaN(v)).length}`)

        // 转换为ECharts格式: [x, y, value]
        const heatmapData = []
        for (let y = 0; y < props.gridSize; y++) {
          for (let x = 0; x < props.gridSize; x++) {
            const index = y * props.gridSize + x
            const value = smoothedGrid[index]
            
            if (!isNaN(value)) {
              // 保持与原始代码一致，不翻转Y轴
              heatmapData.push([x, y, value])
            }
          }
        }

        return heatmapData

      } catch (error) {
        console.error('[快速更新] 插值计算失败:', error)
        return generateInterpolatedHeatmapData() // 回退到传统模式
      }
    }

    

    // 初始化ECharts图表
    async function initializeCharts() {
      if (!chartContainer.value) {
        console.warn('[报告风格热力图] chartContainer未找到')
        return false
      }

      try {
        console.log('[报告风格热力图] 开始初始化ECharts')
        
        // 等待容器准备就绪
        const isReady = await waitForContainerReady(3000)
        if (!isReady) {
          console.warn('[报告风格热力图] 容器未准备就绪，跳过初始化')
          return false
        }

        // 销毁现有实例
        if (mainChart && !mainChart.isDisposed()) {
          mainChart.dispose()
          mainChart = null
          isEChartsReady = false
        }

        // 创建新的ECharts实例
        mainChart = echarts.init(chartContainer.value)
        
        // 验证实例创建
        if (!mainChart || mainChart.isDisposed()) {
          throw new Error('ECharts实例创建失败')
        }

        isEChartsReady = true
        console.log('[报告风格热力图] ECharts实例创建成功:', {
          id: mainChart.id,
          disposed: mainChart.isDisposed()
        })

        // 生成坐标轴类别数据
        const xAxisData = []
        const yAxisData = []
        for (let i = 0; i < props.gridSize; i++) {
          xAxisData.push(i.toString())
          yAxisData.push(i.toString())
        }

        // 设置基础配置
        const option = {
          animation: false,
          backgroundColor: 'transparent',
          grid: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            containLabel: false
          },
          xAxis: {
            type: 'category',
            data: xAxisData,
            show: false,
            splitLine: {
              show: false
            }
          },
          yAxis: {
            type: 'category',
            data: yAxisData,
            show: false,
            splitLine: {
              show: false
            }
          },
          visualMap: {
            type: 'continuous',
            min: props.valueDomain.min,
            max: props.valueDomain.max,
            show: false,
            inRange: {
              color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
            }
          },
          series: []
        }

        mainChart.setOption(option)
        console.log('[报告风格热力图] ECharts初始化完成')

        // 立即触发一次更新
        nextTick(() => {
          updateHeatmapDisplay()
        })

        return true

      } catch (error) {
        console.error('[报告风格热力图] ECharts初始化失败:', error)
        hasError.value = true
        errorMessage.value = 'ECharts初始化失败: ' + error.message
        isEChartsReady = false
        mainChart = null
        return false
      }
    }

    // 生成IDW插值热力图数据
    function generateInterpolatedHeatmapData() {
      const heatmapData = []
      
      try {
        // 检查是否有有效的通道数据
        if (!props.channelPositions || props.channelPositions.length === 0) {
          console.warn('[热力图] 无通道位置数据，使用测试数据')
          return generateFallbackTestData()
        }

        if (!props.hboData || props.hboData.length === 0) {
        // 无HbO数据时回退到测试数据
          return generateFallbackTestData()
        }

        // 准备通道数据（包含位置和数值）
        const channelData = props.channelPositions.map((channel, index) => {
          // 从hboData获取对应通道的数值，如果没有数据则使用0
          const value = props.hboData[index] !== undefined ? props.hboData[index] : 0
          
          return {
            position: channel.position, // [x, y] in Triangle 2D coordinates (mm)
            value: value,
            channelId: channel.channelId || index
          }
        })

        // console.log(`[热力图IDW] 处理通道数据: ${channelData.length}个通道`) // 清理性能影响

        // 创建网格信息
        const gridInfo = GridBuilder.createGridInfo(channelData, {
          gridSize: props.gridSize,
          layoutDimensions: props.layoutDimensions,
          padding: 5,
          // 6dock模式支持
          useSixDockMode: props.useSixDockMode,
          sixDockTriangleVertices: props.sixDockTriangleVertices
        })

        // console.log('[热力图IDW] 网格信息:', gridInfo) // 清理性能影响

        // 创建IDW插值器
        const interpolator = new IDWInterpolator({
          power: 2,
          kNeighbors: props.kNeighbors,
          useRadius: false
        })

        // 执行IDW插值
        const interpolatedGrid = interpolator.interpolate(channelData, gridInfo)
        
        // 应用高斯平滑
        const smoothedGrid = interpolator.applyGaussianSmoothing(
          interpolatedGrid, 
          props.gridSize, 
          props.gaussianSigma
        )

        // console.log(`[热力图IDW] 插值完成，网格大小: ${smoothedGrid.length}`) // 清理性能影响

        // 转换为ECharts格式: [x, y, value]
        for (let y = 0; y < props.gridSize; y++) {
          for (let x = 0; x < props.gridSize; x++) {
            const index = y * props.gridSize + x
            const value = smoothedGrid[index]
            
            // 跳过NaN值
            if (!isNaN(value)) {
              heatmapData.push([x, y, value])
            }
          }
        }

        // console.log(`[热力图IDW] ECharts数据点: ${heatmapData.length}`) // 清理性能影响
        
        return heatmapData

      } catch (error) {
        console.error('[热力图IDW] 插值处理失败:', error)
        return generateFallbackTestData()
      }
    }

    // 备用测试数据生成
    function generateFallbackTestData() {
      const heatmapData = []
      const gridSize = props.gridSize
      
      // 使用静态测试数据回退
      
      // 生成简单的径向模式
      for (let y = 0; y < gridSize; y += 3) {
        for (let x = 0; x < gridSize; x += 3) {
          const centerX = gridSize / 2
          const centerY = gridSize / 2
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
          const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2)
          const value = Math.cos(distance / maxDistance * Math.PI) * 0.03
          
          heatmapData.push([x, y, value])
        }
      }
      
      return heatmapData
    }

    // 更新热力图显示
    function updateHeatmapDisplay() {
      if (!isEChartsReady || !mainChart || mainChart.isDisposed()) {
        console.warn('[报告风格热力图] ECharts未就绪，跳过更新')
        return
      }

      // 硬保护：没有通道位置时直接报错并停止
      if (!props.channelPositions || props.channelPositions.length === 0) {
        hasError.value = true
        errorMessage.value = '通道位置为空，无法渲染热力图（请检查Triangle配置加载）'
        return
      }

      if (isUpdating) {
        console.warn('[报告风格热力图] 正在更新中，跳过重复请求，防止递归调用')
        return
      }

      try {
        isUpdating = true
        // 🚀 帧更新不再设置 isLoading - 严格按照 HEATMAP_INSTANT_REFRESH_STORY.md

        // 🚀 使用固定结构快速更新 - 实现"保持上一帧→瞬间切换"
        const heatmapData = fastUpdateHeatmapData()
        if (!Array.isArray(heatmapData) || heatmapData.length === 0) {
          hasError.value = true
          errorMessage.value = '热力图数据为空（可能是mask覆盖或SDK数据为空）'
          return
        }
        
        // 🚀 构建系列数据
        const series = [{
          id: 'hmap',
          type: 'heatmap',
          name: 'hbo-heatmap',
          data: heatmapData,
          z: 3,
          emphasis: { disabled: true },
          progressive: 0,
          progressiveThreshold: 0,
          animation: false,
          animationDuration: 0,
          animationDurationUpdate: 0
        }]

        // 🚀 瞬时替换更新
        // 仅替换数据，避免重建坐标或视觉映射，保证“瞬间替换”
        mainChart.setOption({ series }, { replaceMerge: ['series'], lazyUpdate: true })
        
        hasError.value = false
        
        // console.log('[报告风格热力图] 显示更新完成:', {
        //   dataPoints: heatmapData.length,
        //   series: series.length
        // }) // 清理性能影响

      } catch (error) {
        console.error('[报告风格热力图] 显示更新失败:', error)
        hasError.value = true
        errorMessage.value = '显示更新失败: ' + error.message
        isLoading.value = false
      } finally {
        isUpdating = false
      }
    }

    // 节流：在最小间隔内合并多次更新请求
    function scheduleHeatmapUpdate() {
      const now = Date.now()
      const elapsed = now - lastUpdateAt
      if (elapsed >= MIN_UPDATE_INTERVAL_MS && !isUpdating) {
        updateHeatmapDisplay()
        lastUpdateAt = Date.now()
        return
      }
      pendingUpdate = true
      const delay = Math.max(50, MIN_UPDATE_INTERVAL_MS - elapsed)
      if (updateDebounceTimer) clearTimeout(updateDebounceTimer)
      updateDebounceTimer = setTimeout(() => {
        pendingUpdate = false
        updateDebounceTimer = null
        updateHeatmapDisplay()
        lastUpdateAt = Date.now()
      }, delay)
    }

    // 🚀 简化数据监听 - 严格按照 HEATMAP_INSTANT_REFRESH_STORY.md
    watch([() => props.hboData, () => props.channelPositions], () => {
      if (!isEChartsReady) return
      scheduleHeatmapUpdate()
    }, { deep: true, immediate: false })


    // 窗口大小变化监听
    let resizeObserver = null
    
    // 🚀 简化尺寸监听 - 严格按照 HEATMAP_INSTANT_REFRESH_STORY.md
    function setupResizeListener() {
      if (!window.ResizeObserver) {
        const handleResize = () => { if (mainChart && !mainChart.isDisposed()) mainChart.resize() }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
      resizeObserver = new ResizeObserver(() => {
        if (mainChart && !mainChart.isDisposed()) mainChart.resize()
      })
      
      if (chartContainer.value?.parentElement) {
        resizeObserver.observe(chartContainer.value.parentElement)
      }
      
      return () => {
        if (resizeObserver) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
      }
    }

    // 存储清理函数
    let resizeCleanup = null

    // 组件挂载
    onMounted(async () => {
      console.log('[报告风格热力图] 组件挂载')
      
      try {
        // 延迟初始化图表，等待DOM完全就绪
        await nextTick()
        
        setTimeout(() => {
          const tryInit = async (attempt = 1) => {
            const ok = await initializeCharts()
            if (!ok && attempt < 20) { // 最长重试 ~6s（20*300ms）
              setTimeout(() => tryInit(attempt + 1), 300)
            }
          }
          tryInit()
          
          // 设置响应式监听器
          resizeCleanup = setupResizeListener()
          
          console.log('[热力图对齐] 响应式监听器已设置')
        }, 200)

      } catch (error) {
        console.error('[报告风格热力图] 组件挂载过程出错:', error)
        hasError.value = true
        errorMessage.value = '组件初始化失败: ' + error.message
      }
    })

    // 组件卸载
    onUnmounted(() => {
      console.log('[报告风格热力图] 组件卸载')
      
      // 清理节流定时器
      if (updateDebounceTimer) clearTimeout(updateDebounceTimer)

      // 清理响应式监听器
      if (resizeCleanup) {
        resizeCleanup()
        resizeCleanup = null
      }

      // 销毁ECharts实例
      if (mainChart && !mainChart.isDisposed()) {
        mainChart.dispose()
        mainChart = null
      }

      isEChartsReady = false
      isUpdating = false
      
      console.log('[热力图对齐] 所有资源已清理')
    })


    // 监听channelPositions变化，触发初始化
    watch(() => props.channelPositions, 
      (newPositions) => {
        if (newPositions?.length > 0) {
          console.log('[报告风格热力图] channelPositions变化:', newPositions.length)
          
          // 🚀 重置固定结构标志，准备重新初始化
          isStructureInitialized = false
          
          if (!isEChartsReady) {
            nextTick(() => {
              initializeCharts()
            })
          } else {
            // ECharts已就绪，触发一次更新以初始化固定结构
            nextTick(() => {
              updateHeatmapDisplay()
            })
          }
        }
      },
      { immediate: true }
    )

    return {
      chartContainer,
      isLoading,
      hasError,
      errorMessage,
      currentChannelDataLength,
      overlayInfo,
      isEChartsReady,
      updateHeatmapDisplay
    }
  }
}
</script>

<style scoped>
.heatmap-report-style-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
  position: relative;
  transition: opacity 0.3s ease;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  font-size: 14px;
  z-index: 1000;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  font-size: 14px;
  max-width: 80%;
  text-align: center;
  z-index: 1000;
}

.debug-info {
  font-family: 'Courier New', monospace;
  line-height: 1.3;
  z-index: 1001;
}

.overlay-info {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 5px 10px;
  border-radius: 3px;
  font-size: 12px;
  z-index: 100;
}

.has-error .chart-container {
  opacity: 0.3;
}
</style>