<template>
  <div class="enhanced-heatmap-mode-view">
    <!-- 增强传统热力图模式 - 基于extra_tool功能 -->
    <div class="heatmap-section">
      <!-- HbO热力图 -->
      <div class="heatmap-card">
        <div class="heatmap-header">
          <h3 class="heatmap-title">含氧血红蛋白 (HbO)</h3>
          <div class="current-value positive">{{ formatValue(currentValues.hbo) }} μM</div>
          <div class="heatmap-controls">
            <button class="control-btn" @click="toggleAdaptiveMode" :class="{ active: useAdaptive }">
              自适应
            </button>
            <button class="control-btn" @click="saveConfiguration">
              保存配置
            </button>
          </div>
        </div>
        <div class="heatmap-container" :class="{ adaptive: useAdaptive }">
          <div ref="hboHeatmapRef" class="heatmap-canvas"></div>
        </div>
      </div>
      
      <!-- HbR热力图 -->
      <div class="heatmap-card">
        <div class="heatmap-header">
          <h3 class="heatmap-title">脱氧血红蛋白 (HbR)</h3>
          <div class="current-value negative">{{ formatValue(currentValues.hbr) }} μM</div>
          <div class="heatmap-info">
            <span class="channel-count">{{ triangleLayoutInfo.channels }}通道</span>
          </div>
        </div>
        <div class="heatmap-container" :class="{ adaptive: useAdaptive }">
          <div ref="hbrHeatmapRef" class="heatmap-canvas"></div>
        </div>
      </div>
    </div>
    
    <!-- 自适应控制面板（当启用自适应模式时显示） -->
    <div v-if="useAdaptive" class="adaptive-control-panel">
      <div class="control-group">
        <label>位置调整:</label>
        <div class="slider-group">
          <input type="range" v-model="adaptiveConfig.position.x" min="0" max="1" step="0.01" @input="updateAdaptive">
          <input type="range" v-model="adaptiveConfig.position.y" min="0" max="1" step="0.01" @input="updateAdaptive">
        </div>
      </div>
      <div class="control-group">
        <label>尺寸调整:</label>
        <div class="slider-group">
          <input type="range" v-model="adaptiveConfig.scale.width" min="0.3" max="1.2" step="0.05" @input="updateAdaptive">
          <input type="range" v-model="adaptiveConfig.scale.height" min="0.3" max="1.2" step="0.05" @input="updateAdaptive">
        </div>
      </div>
      <div class="preset-buttons">
        <button class="preset-btn" @click="applyPreset('forehead')">额头</button>
        <button class="preset-btn" @click="applyPreset('center')">中心</button>
        <button class="preset-btn" @click="applyPreset('full')">全覆盖</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, onUnmounted, reactive } from 'vue'
import { trainingCommon } from '../mixins/TrainingCommon.js'
import { FNIRSHeatmapRenderer } from '../../../utils/heatmap/FNIRSHeatmapRenderer.js'
import { HeatmapAdaptiveController } from '../../../utils/heatmap/HeatmapAdaptiveController.js'

export default {
  name: 'EnhancedHeatmapModeView',
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
    const useAdaptive = ref(false)
    
    // 热力图渲染器
    let hboRenderer = null
    let hbrRenderer = null
    let adaptiveController = null
    let updateTimer = null
    
    // Triangle布局信息
    const triangleLayoutInfo = reactive({
      sources: 18,
      detectors: 24,  
      channels: 432
    })
    
    // 自适应配置
    const adaptiveConfig = reactive({
      position: { x: 0.5, y: 0.25 },
      scale: { width: 0.75, height: 0.6 },
      opacity: 0.7,
      rotation: 0
    })
    
    // 使用共享逻辑
    const { formatValue } = trainingCommon()
    
    // 初始化增强热力图
    async function initEnhancedHeatmaps() {
      console.log('[增强热力图] 初始化HbO和HbR热力图...')
      
      if (!hboHeatmapRef.value || !hbrHeatmapRef.value) {
        console.warn('[增强热力图] DOM引用不存在')
        return
      }
      
      try {
        // 创建HbO渲染器
        hboRenderer = new FNIRSHeatmapRenderer({
          deviceProfile: 'triangle',
          dataType: 'HbO',
          renderMode: useAdaptive.value ? 'adaptive' : '2d',
          adaptivePosition: adaptiveConfig,
          colorScheme: 'RdBu_r',
          showChannels: true,
          showOptodes: false // 不显示光源检测器，避免过于复杂
        })
        
        // 创建HbR渲染器
        hbrRenderer = new FNIRSHeatmapRenderer({
          deviceProfile: 'triangle',
          dataType: 'HbR', 
          renderMode: useAdaptive.value ? 'adaptive' : '2d',
          adaptivePosition: adaptiveConfig,
          colorScheme: 'RdBu_r',
          showChannels: true,
          showOptodes: false
        })
        
        // 创建自适应控制器
        adaptiveController = new HeatmapAdaptiveController(adaptiveConfig)
        
        // 加载保存的配置
        adaptiveController.loadConfig()
        Object.assign(adaptiveConfig, adaptiveController.getConfig())
        
        // 获取Triangle布局信息
        const layoutInfo = hboRenderer.getLayoutInfo()
        if (layoutInfo) {
          Object.assign(triangleLayoutInfo, layoutInfo)
        }
        
        console.log('[增强热力图] 渲染器初始化完成:', triangleLayoutInfo)
        
        // 开始更新循环
        startUpdateLoop()
        
      } catch (error) {
        console.error('[增强热力图] 初始化失败:', error)
        // 回退到简单渲染
        initFallbackRendering()
      }
    }
    
    // 回退渲染（当增强渲染器失败时）
    function initFallbackRendering() {
      console.log('[增强热力图] 使用回退渲染模式')
      
      // 创建简单的Canvas渲染
      if (hboHeatmapRef.value) {
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 300
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.background = 'rgba(255, 255, 255, 0.1)'
        canvas.style.borderRadius = '10px'
        hboHeatmapRef.value.appendChild(canvas)
        
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ff6b6b'
        ctx.fillRect(50, 50, 100, 50)
        ctx.fillStyle = 'white'
        ctx.font = '16px Arial'
        ctx.fillText('HbO 热力图', 60, 80)
      }
      
      if (hbrHeatmapRef.value) {
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 300
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.background = 'rgba(255, 255, 255, 0.1)'
        canvas.style.borderRadius = '10px'
        hbrHeatmapRef.value.appendChild(canvas)
        
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#4dabf7'
        ctx.fillRect(50, 50, 100, 50)
        ctx.fillStyle = 'white'
        ctx.font = '16px Arial'
        ctx.fillText('HbR 热力图', 60, 80)
      }
    }
    
    // 更新热力图数据
    function updateHeatmapData() {
      if (!hboRenderer || !hbrRenderer) return
      
      try {
        // 生成模拟432通道数据
        const currentTime = Date.now()
        const hboChannelData = generateTriangleChannelData(true, currentTime)
        const hbrChannelData = generateTriangleChannelData(false, currentTime)
        
        // 渲染HbO热力图
        hboRenderer.renderHeatmap(hboHeatmapRef.value, hboChannelData, {
          renderMode: useAdaptive.value ? 'adaptive' : '2d'
        })
        
        // 渲染HbR热力图  
        hbrRenderer.renderHeatmap(hbrHeatmapRef.value, hbrChannelData, {
          renderMode: useAdaptive.value ? 'adaptive' : '2d'
        })
        
      } catch (error) {
        console.warn('[增强热力图] 更新失败:', error)
      }
    }
    
    // 生成Triangle通道模拟数据
    function generateTriangleChannelData(isHbO = true, time = 0) {
      const channelCount = triangleLayoutInfo.channels
      const data = []
      
      for (let i = 0; i < channelCount; i++) {
        // 基于时间和通道索引的动态数值
        const baseValue = Math.sin(time * 0.001 + i * 0.1) * 0.05
        const noise = (Math.random() - 0.5) * 0.02
        const typeMultiplier = isHbO ? 1 : -0.8
        
        // 添加空间模式（三角形顶部激活）
        const spatialPattern = Math.cos(i / channelCount * Math.PI * 2) * 0.03
        
        data.push((baseValue + noise + spatialPattern) * typeMultiplier)
      }
      
      return data
    }
    
    // 切换自适应模式
    function toggleAdaptiveMode() {
      useAdaptive.value = !useAdaptive.value
      
      if (hboRenderer && hbrRenderer) {
        const newMode = useAdaptive.value ? 'adaptive' : '2d'
        
        // 更新渲染器配置
        hboRenderer.config.renderMode = newMode
        hbrRenderer.config.renderMode = newMode
        
        // 重新渲染
        updateHeatmapData()
      }
      
      console.log(`[增强热力图] 自适应模式: ${useAdaptive.value ? '开启' : '关闭'}`)
    }
    
    // 更新自适应配置
    function updateAdaptive() {
      if (!adaptiveController) return
      
      // 更新控制器配置
      adaptiveController.currentConfig.position = { ...adaptiveConfig.position }
      adaptiveController.currentConfig.scale = { ...adaptiveConfig.scale }
      
      // 更新渲染器配置
      if (hboRenderer) {
        hboRenderer.setAdaptivePosition(adaptiveConfig)
      }
      if (hbrRenderer) {
        hbrRenderer.setAdaptivePosition(adaptiveConfig)
      }
      
      // 重新渲染
      if (useAdaptive.value) {
        updateHeatmapData()
      }
    }
    
    // 应用预设配置
    function applyPreset(presetName) {
      if (!adaptiveController) return
      
      if (adaptiveController.applyPreset(presetName)) {
        Object.assign(adaptiveConfig, adaptiveController.getConfig())
        updateAdaptive()
      }
    }
    
    // 保存配置
    function saveConfiguration() {
      if (adaptiveController) {
        if (adaptiveController.saveConfig()) {
          // 显示保存成功提示（这里可以用更好的UI提示）
          console.log('[增强热力图] 配置保存成功')
        }
      }
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
    
    // 监听自适应模式变化
    watch(useAdaptive, () => {
      updateHeatmapData()
    })
    
    // 组件挂载
    onMounted(async () => {
      console.log('[增强热力图模式] 组件已挂载')
      await nextTick()
      initEnhancedHeatmaps()
    })
    
    // 组件卸载
    onUnmounted(() => {
      console.log('[增强热力图模式] 组件已卸载')
      stopUpdateLoop()
      
      // 销毁渲染器
      if (hboRenderer) {
        hboRenderer.destroy()
      }
      if (hbrRenderer) {
        hbrRenderer.destroy()
      }
      if (adaptiveController) {
        adaptiveController.destroy()
      }
    })
    
    return {
      hboHeatmapRef,
      hbrHeatmapRef,
      useAdaptive,
      adaptiveConfig,
      triangleLayoutInfo,
      toggleAdaptiveMode,
      updateAdaptive,
      applyPreset,
      saveConfiguration,
      formatValue
    }
  }
}
</script>

<style scoped>
.enhanced-heatmap-mode-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.heatmap-section {
  display: flex;
  gap: 20px;
  flex: 1;
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
  flex-wrap: wrap;
  gap: 10px;
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

.heatmap-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.control-btn.active {
  background: rgba(34, 197, 94, 0.8);
  border-color: rgba(34, 197, 94, 0.6);
}

.heatmap-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.channel-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
}

.heatmap-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 250px;
}

.heatmap-container.adaptive {
  background: rgba(0, 0, 0, 0.1);
  border: 1px dashed rgba(255, 255, 255, 0.3);
  border-radius: 8px;
}

.heatmap-canvas {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  position: relative;
}

/* 自适应控制面板 */
.adaptive-control-panel {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 15px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.control-group {
  margin-bottom: 15px;
}

.control-group label {
  display: block;
  color: #ffffff;
  font-size: 14px;
  margin-bottom: 8px;
  font-weight: 500;
}

.slider-group {
  display: flex;
  gap: 10px;
}

.slider-group input[type="range"] {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  cursor: pointer;
  appearance: none;
}

.slider-group input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.preset-buttons {
  display: flex;
  gap: 8px;
}

.preset-btn {
  padding: 8px 16px;
  background: rgba(99, 102, 241, 0.8);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.preset-btn:hover {
  background: rgba(99, 102, 241, 1);
  transform: translateY(-1px);
}
</style>