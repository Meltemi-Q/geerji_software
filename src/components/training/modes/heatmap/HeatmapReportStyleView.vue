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

    <!-- 覆盖层信息 -->
    <div v-if="overlayEnabled && overlayInfo" class="overlay-info">
      <span>覆盖区域: {{ overlayInfo.nodeCount }}个节点</span>
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
    let updateRequestId = null


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

    // 基于alignment参数的精确位置计算（移植demo.html算法）
    function calculateHeatmapPosition() {
      if (!chartContainer.value) return null
      
      // 获取父容器和大脑图片的引用
      const container = chartContainer.value.parentElement
      if (!container) return null
      
      // 尝试找到大脑图片元素
      const brainImage = container.parentElement?.querySelector('img') ||
                        document.querySelector('.brain-background-image') ||
                        document.querySelector('img[alt*="大脑"]')
      
      if (!brainImage) {
        console.warn('[热力图对齐] 未找到大脑图片元素')
        return null
      }
      
      const brainRect = brainImage.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      
      console.log('[热力图对齐] DOM Rects - Brain:', brainRect, 'Container:', containerRect)
      console.log('[热力图对齐] 使用alignment配置:', props.alignment)
      
      // 使用demo.html的精确算法
      const heatmapWidth = brainRect.width * props.alignment.scale.width
      const heatmapHeight = brainRect.height * props.alignment.scale.height
      
      const left = (brainRect.left - containerRect.left) + 
                   (brainRect.width * props.alignment.position.x) - 
                   (heatmapWidth / 2)
      const top = (brainRect.top - containerRect.top) + 
                  (brainRect.height * props.alignment.position.y) - 
                  (heatmapHeight / 2)

      console.log(`[热力图对齐] 计算结果 - Left:${left.toFixed(1)}, Top:${top.toFixed(1)}, Width:${heatmapWidth.toFixed(1)}, Height:${heatmapHeight.toFixed(1)}`)
      
      return {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(heatmapWidth),
        height: Math.round(heatmapHeight),
        opacity: props.alignment.opacity,
        transform: `rotate(${props.alignment.rotation}deg)`
      }
    }
    
    // 应用位置样式到chartContainer
    function applyHeatmapAlignment() {
      const position = calculateHeatmapPosition()
      if (!position || !chartContainer.value) return
      
      // 应用样式
      chartContainer.value.style.position = 'absolute'
      chartContainer.value.style.left = position.left + 'px'
      chartContainer.value.style.top = position.top + 'px'
      chartContainer.value.style.width = position.width + 'px'
      chartContainer.value.style.height = position.height + 'px'
      chartContainer.value.style.opacity = position.opacity
      chartContainer.value.style.transform = position.transform
      chartContainer.value.style.pointerEvents = 'none'
      chartContainer.value.style.zIndex = '3'
      
      console.log('[热力图对齐] 样式已应用:', {
        position: 'absolute',
        ...position
      })
      
      // 如果ECharts图表已初始化，重新设置尺寸
      if (mainChart && !mainChart.isDisposed()) {
        mainChart.resize({
          width: position.width,
          height: position.height
        })
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
          
          // 应用正确的对齐位置（关键步骤）
          setTimeout(() => {
            applyHeatmapAlignment()
          }, 100) // 短暂延迟确保DOM完全就绪
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
          console.warn('[热力图] 无HbO数据，使用测试数据')
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

        console.log(`[热力图IDW] 处理通道数据: ${channelData.length}个通道`)

        // 创建网格信息
        const gridInfo = GridBuilder.createGridInfo(channelData, {
          gridSize: props.gridSize,
          layoutDimensions: props.layoutDimensions,
          padding: 5,
          // 6dock模式支持
          useSixDockMode: props.useSixDockMode,
          sixDockTriangleVertices: props.sixDockTriangleVertices
        })

        console.log('[热力图IDW] 网格信息:', gridInfo)

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

        console.log(`[热力图IDW] 插值完成，网格大小: ${smoothedGrid.length}`)

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

        console.log(`[热力图IDW] ECharts数据点: ${heatmapData.length}`)
        
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
      
      console.log('[热力图] 使用备用测试数据')
      
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

      if (isUpdating) {
        console.log('[报告风格热力图] 正在更新中，跳过重复请求')
        return
      }

      try {
        isUpdating = true
        isLoading.value = true

        // 生成IDW插值热力图数据
        const heatmapData = generateInterpolatedHeatmapData()
        
        console.log('[报告风格热力图] 执行setOption，IDW数据点数:', heatmapData.length)

        // 构建系列数据
        const series = [{
          type: 'heatmap',
          name: 'test-heatmap',
          data: heatmapData,
          z: 3,
          emphasis: { disabled: true }
        }]

        // 执行更新
        const option = {
          series: series
        }
        
        mainChart.setOption(option, { notMerge: false })
        
        isLoading.value = false
        hasError.value = false
        
        console.log('[报告风格热力图] 显示更新完成:', {
          dataPoints: heatmapData.length,
          series: series.length
        })

      } catch (error) {
        console.error('[报告风格热力图] 显示更新失败:', error)
        hasError.value = true
        errorMessage.value = '显示更新失败: ' + error.message
        isLoading.value = false
      } finally {
        isUpdating = false
      }
    }

    // 监听数据变化
    watch([() => props.hboData, () => props.channelPositions], 
      () => {
        if (!isEChartsReady) return
        
        // 使用requestIdleCallback进行异步更新
        if (updateRequestId) {
          cancelIdleCallback(updateRequestId)
        }
        
        updateRequestId = requestIdleCallback(() => {
          updateHeatmapDisplay()
        }, { timeout: 100 })
      },
      { deep: true, immediate: false }
    )

    // 监听alignment参数变化
    watch(() => props.alignment, 
      () => {
        if (!isEChartsReady) return
        console.log('[热力图对齐] alignment参数变化，重新应用位置')
        
        nextTick(() => {
          applyHeatmapAlignment()
        })
      },
      { deep: true, immediate: false }
    )

    // 窗口大小变化监听
    let resizeObserver = null
    
    function setupResizeListener() {
      if (!window.ResizeObserver) {
        // 降级到传统window resize事件
        const handleResize = () => {
          setTimeout(() => {
            applyHeatmapAlignment()
          }, 100)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
      
      // 使用ResizeObserver监听容器大小变化
      resizeObserver = new ResizeObserver(() => {
        setTimeout(() => {
          applyHeatmapAlignment()
        }, 50)
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
          initializeCharts()
          
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
      
      // 清理定时器
      if (updateRequestId) {
        cancelIdleCallback(updateRequestId)
        updateRequestId = null
      }

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
        if (newPositions?.length > 0 && !isEChartsReady) {
          console.log('[报告风格热力图] channelPositions变化:', newPositions.length)
          nextTick(() => {
            initializeCharts()
          })
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