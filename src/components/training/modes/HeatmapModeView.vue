<template>
  <div class="heatmap-mode-view">
    <!-- 传统热力图模式 -->
    <div class="heatmap-section">
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
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { HeatmapRenderer } from '../../../utils/HeatmapRenderer.js'
import { trainingCommon } from '../mixins/TrainingCommon.js'

export default {
  name: 'HeatmapModeView',
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
    const hboHeatmapRef = ref(null)
    const hbrHeatmapRef = ref(null)
    
    let hboChart = null
    let hbrChart = null
    let updateTimer = null
    
    // 使用共享逻辑
    const { formatValue } = trainingCommon()
    
    // 热力图配置
    const heatmapConfig = {
      flipYForReport: false,
      idwPower: 2,
      gaussianSigma: 2,
      scaleClampStrategy: "default",
      minScaleGuard: false,
      maskAlpha: 0.3
    }
    
    // 创建热力图渲染器实例
    const heatmapRenderer = new HeatmapRenderer(heatmapConfig)
    
    // Triangle布局数据
    let realTriangleLayoutData = null
    let realTriangleParsed = null
    
    // 加载Triangle布局数据
    async function loadTriangleLayoutData() {
      if (realTriangleLayoutData) return realTriangleLayoutData
      
      try {
        const response = await fetch(new URL('../../../../layout.json', import.meta.url).href)
        const data = await response.json()
        
        realTriangleLayoutData = data
        realTriangleParsed = parseTriangleLayoutForHeatmap(data)
        
        console.log('[传统热力图] Triangle布局数据加载完成')
        return data
      } catch (error) {
        console.error('[传统热力图] Triangle布局加载失败，使用模拟数据:', error)
        return null
      }
    }
    
    // 解析Triangle布局数据
    function parseTriangleLayoutForHeatmap(layoutData) {
      console.log('[传统热力图] 开始解析Triangle布局数据')
      
      const sources = []
      const detectors = []
      const channels = []
      
      if (!layoutData?.docks) {
        console.warn('[传统热力图] 布局数据格式无效')
        return { sources, detectors, channels }
      }
      
      // 解析dock中的optodes数据
      layoutData.docks.forEach((dock, dockIndex) => {
        if (dock.optodes && Array.isArray(dock.optodes)) {
          dock.optodes.forEach((optode, optodeIndex) => {
            const position = optode.coordinates_2d || { x: 0, y: 0 }
            
            if (optode.type === 'source') {
              sources.push({
                x: position.x,
                y: position.y,
                id: `s${dockIndex}_${optodeIndex}`
              })
            } else if (optode.type === 'detector') {
              detectors.push({
                x: position.x,
                y: position.y,
                id: `d${dockIndex}_${optodeIndex}`
              })
            }
          })
        }
      })
      
      // 生成通道配对
      for (let i = 0; i < Math.min(sources.length, detectors.length); i++) {
        channels.push({
          source: sources[i],
          detector: detectors[i % detectors.length],
          channelIndex: i,
          midpoint: {
            x: (sources[i].x + detectors[i % detectors.length].x) / 2,
            y: (sources[i].y + detectors[i % detectors.length].y) / 2
          }
        })
      }
      
      console.log(`[传统热力图] 解析完成: ${sources.length}个光源, ${detectors.length}个检测器, ${channels.length}个通道`)
      return { sources, detectors, channels }
    }
    
    // 生成Triangle通道数值
    function generateTriangleChannelValues(isHbO = true, time = 0) {
      if (!realTriangleParsed || realTriangleParsed.channels.length === 0) {
        console.warn('[传统热力图] Triangle数据未加载，使用备用模拟数据')
        return generateMockChannelValues(isHbO, time)
      }
      
      return realTriangleParsed.channels.map(channel => {
        // 基于通道位置和时间生成动态数值
        const baseValue = Math.sin(time * 0.001 + channel.channelIndex * 0.5) * 0.05
        const noise = (Math.random() - 0.5) * 0.02
        const typeMultiplier = isHbO ? 1 : -0.8
        
        return {
          channelIndex: channel.channelIndex,
          position: channel.midpoint,
          value: (baseValue + noise) * typeMultiplier
        }
      })
    }
    
    // 生成模拟通道数值
    function generateMockChannelValues(isHbO = true, time = 0) {
      const mockChannels = Array.from({length: 24}, (_, i) => ({
        channelIndex: i,
        position: {
          x: (i % 6) * 20 - 50,
          y: Math.floor(i / 6) * 20 - 30
        }
      }))
      
      return mockChannels.map(channel => {
        const baseValue = Math.sin(time * 0.001 + channel.channelIndex * 0.3) * 0.08
        const noise = (Math.random() - 0.5) * 0.03
        const typeMultiplier = isHbO ? 1 : -0.7
        
        return {
          channelIndex: channel.channelIndex,
          position: channel.position,
          value: (baseValue + noise) * typeMultiplier
        }
      })
    }
    
    // 创建连续热力图
    async function createContinuousHeatmap(container, isHbO = true) {
      if (!container) return null
      
      console.log(`[传统热力图] 创建${isHbO ? 'HbO' : 'HbR'}热力图`)
      
      // 清空容器
      container.innerHTML = ''
      
      // 创建Canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // 设置Canvas大小
      canvas.width = 400
      canvas.height = 300
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.border = '2px solid rgba(0, 0, 0, 0.1)'
      canvas.style.borderRadius = '10px'
      
      container.appendChild(canvas)
      
      // 等待Triangle数据加载
      await loadTriangleLayoutData()
      
      return { canvas, ctx, container }
    }
    
    // 更新热力图数据
    function updateHeatmapData() {
      const currentTime = Date.now()
      
      // 更新HbO热力图
      if (hboChart) {
        updateSingleHeatmap(hboChart, true, currentTime)
      }
      
      // 更新HbR热力图
      if (hbrChart) {
        updateSingleHeatmap(hbrChart, false, currentTime)
      }
    }
    
    // 更新单个热力图
    function updateSingleHeatmap(chart, isHbO, time) {
      if (!chart || !chart.ctx) return
      
      // 清空画布
      chart.ctx.clearRect(0, 0, chart.canvas.width, chart.canvas.height)
      
      // 生成通道数据
      const channelData = generateTriangleChannelValues(isHbO, time)
      
      // 提取数值用于热力图生成
      const values = channelData.map(channel => channel.value)
      
      try {
        // 生成热力图数据点
        const heatmapData = heatmapRenderer.generateContinuousHeatmap(
          values, 
          chart.canvas.width, 
          chart.canvas.height, 
          {}
        )
        
        if (heatmapData && heatmapData.length > 0) {
          // 渲染热力图
          const imageData = chart.ctx.createImageData(chart.canvas.width, chart.canvas.height)
          
          heatmapData.forEach(point => {
            const [x, y, value] = point
            const pixelX = Math.round(x)
            const pixelY = Math.round(y)
            
            if (pixelX >= 0 && pixelX < chart.canvas.width && pixelY >= 0 && pixelY < chart.canvas.height) {
              const index = (pixelY * chart.canvas.width + pixelX) * 4
              const color = getHeatmapColor(value, isHbO)
              
              imageData.data[index] = color.r
              imageData.data[index + 1] = color.g
              imageData.data[index + 2] = color.b
              imageData.data[index + 3] = 180 // 透明度
            }
          })
          
          chart.ctx.putImageData(imageData, 0, 0)
        }
      } catch (error) {
        console.warn(`[传统热力图] ${isHbO ? 'HbO' : 'HbR'}热力图更新失败:`, error)
      }
    }
    
    // 获取热力图颜色
    function getHeatmapColor(normalizedValue, isHbO) {
      const clampedValue = Math.max(-1, Math.min(1, normalizedValue))
      
      if (isHbO) {
        // HbO: 蓝色(负值) -> 白色(0) -> 红色(正值)
        if (clampedValue < 0) {
          const intensity = Math.abs(clampedValue)
          const blue = Math.floor(255 * intensity)
          return { r: 255 - blue, g: 255 - blue, b: 255 }
        } else {
          const intensity = clampedValue
          const red = Math.floor(255 * intensity)
          return { r: 255, g: 255 - red, b: 255 - red }
        }
      } else {
        // HbR: 绿色(负值) -> 白色(0) -> 紫色(正值)
        if (clampedValue < 0) {
          const intensity = Math.abs(clampedValue)
          const green = Math.floor(200 * intensity)
          return { r: 255 - green, g: 255, b: 255 - green }
        } else {
          const intensity = clampedValue
          const purple = Math.floor(180 * intensity)
          return { r: 255 - purple/2, g: 255 - purple, b: 255 }
        }
      }
    }
    
    // 初始化热力图
    async function initHeatmaps() {
      console.log('[传统热力图] 初始化HbO和HbR热力图')
      
      if (hboHeatmapRef.value) {
        hboChart = await createContinuousHeatmap(hboHeatmapRef.value, true)
      }
      
      if (hbrHeatmapRef.value) {
        hbrChart = await createContinuousHeatmap(hbrHeatmapRef.value, false)
      }
      
      // 开始更新循环
      startUpdateLoop()
    }
    
    // 开始更新循环
    function startUpdateLoop() {
      updateTimer = setInterval(() => {
        updateHeatmapData()
      }, 500) // 每500ms更新一次
    }
    
    // 停止更新循环
    function stopUpdateLoop() {
      if (updateTimer) {
        clearInterval(updateTimer)
        updateTimer = null
      }
    }
    
    // 监听数据变化
    watch(() => props.currentValues, () => {
      updateHeatmapData()
    }, { deep: true })
    
    // 组件挂载
    onMounted(async () => {
      console.log('[传统热力图模式] 组件已挂载')
      await nextTick()
      initHeatmaps()
    })
    
    // 组件卸载
    onUnmounted(() => {
      console.log('[传统热力图模式] 组件已卸载')
      stopUpdateLoop()
    })
    
    return {
      hboHeatmapRef,
      hbrHeatmapRef,
      formatValue
    }
  }
}
</script>

<style scoped>
.heatmap-mode-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

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
</style>