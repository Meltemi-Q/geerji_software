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
          
          <!-- SVG热力图容器 -->
          <div 
            ref="heatmapContainerRef" 
            class="heatmap-svg-container"
            :style="heatmapContainerStyle"
          >
            <!-- D3 SVG热力图将在这里渲染 -->
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
import { D3HeatmapRenderer } from './heatmap/D3HeatmapRenderer.js'

export default {
  name: 'BrainModeView',
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
    
    // 状态管理
    const isLoading = ref(true)
    const hasError = ref(false)
    const errorMessage = ref('')
    const activeBrainRegions = ref(12)
    const averageBrainActivity = ref(68.5)
    
    // 核心实例
    let triangleProcessor = null
    let heatmapCoordinator = null
    let d3Renderer = null
    let updateTimer = null
    let resizeCleanup = null
    
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
     * 初始化热力图系统
     */
    async function initializeHeatmapSystem() {
      try {
        console.log('[BrainModeView] 开始初始化热力图系统...')
        isLoading.value = true
        hasError.value = false
        
        // 1. 初始化Triangle数据处理器
        triangleProcessor = new TriangleDataProcessor()
        const channelData = await triangleProcessor.processTriangleData()
        
        console.log('[BrainModeView] Triangle数据处理完成:', {
          sources: channelData.sources.length,
          detectors: channelData.detectors.length,
          channels: channelData.totalChannels
        })
        
        // 2. 初始化坐标协调器
        heatmapCoordinator = new HeatmapCoordinator()
        heatmapCoordinator.setLayoutBounds(channelData.layoutDimensions)
        
        // 3. 初始化D3渲染器
        if (heatmapContainerRef.value) {
          d3Renderer = new D3HeatmapRenderer(heatmapContainerRef.value, {
            showDebugPoints: showDebugInfo.value,
            influenceRadius: 10, // mm（通道级清晰显示）
            gridSize: 50
          })
          
          d3Renderer.setChannelData(channelData)
          
          // 初始化SVG（使用默认尺寸）
          d3Renderer.initializeSVG(400, 300)
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
        },
        100 // 减少防抖时间以获得更快的响应
      )
      
      // 添加额外的实时同步机制
      const syncInterval = setInterval(() => {
        syncHeatmapPosition()
      }, 500) // 每500ms检查一次位置
      
      // 监听窗口滚动事件（如果有）
      const handleScroll = () => {
        syncHeatmapPosition()
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
      if (!d3Renderer || !bounds) return
      
      try {
        // 重新初始化SVG以匹配新尺寸
        d3Renderer.initializeSVG(bounds.width, bounds.height)
        
        // 如果有当前数据，重新渲染
        if (props.hboData && props.hboData.length > 0) {
          const processedData = processHboData(props.hboData)
          d3Renderer.render(processedData)
        }
        
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
     * 更新热力图渲染
     */
    function updateHeatmapRender() {
      if (!d3Renderer || !props.hboData) return
      
      try {
        const processedData = processHboData(props.hboData)
        d3Renderer.render(processedData)
        
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
        renderer: d3Renderer?.getDebugInfo(),
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
      
      // 图片加载完成后更新热力图尺寸
      nextTick(() => {
        if (heatmapCoordinator && brainImageRef.value) {
          console.log('[BrainModeView] 开始计算热力图边界...')
          const bounds = heatmapCoordinator.calculateHeatmapBounds(brainImageRef.value, brainDisplayRef.value)
          console.log('[BrainModeView] 计算得到的边界:', bounds)
          if (bounds) {
            updateHeatmapSize(bounds)
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
     * 清理资源
     */
    function cleanup() {
      console.log('[BrainModeView] 开始清理资源...')
      
      stopUpdateLoop()
      
      if (resizeCleanup) {
        resizeCleanup()
        resizeCleanup = null
      }
      
      if (d3Renderer) {
        d3Renderer.destroy()
        d3Renderer = null
      }
      
      triangleProcessor = null
      heatmapCoordinator = null
    }
    
    // 监听数据变化
    watch(() => props.currentValues, () => {
      updateHeatmapRender()
    }, { deep: true })
    
    // 监听HbO数据变化
    watch(() => props.hboData, () => {
      console.log('[BrainModeView] HbO数据更新，触发热力图重绘')
      updateHeatmapRender()
    }, { deep: true })
    
    // 组件挂载
    onMounted(async () => {
      console.log('[BrainModeView] 组件已挂载，开始初始化...')
      await nextTick()
      await initializeHeatmapSystem()
    })
    
    // 组件卸载
    onUnmounted(() => {
      console.log('[BrainModeView] 组件已卸载')
      cleanup()
    })
    
    return {
      // DOM引用
      brainDisplayRef,
      brainImageRef,
      heatmapContainerRef,
      
      // 状态
      isLoading,
      hasError,
      errorMessage,
      activeBrainRegions,
      averageBrainActivity,
      
      // 计算属性
      heatmapContainerStyle,
      
      // 配置
      brainImageSrc,
      showDebugInfo,
      debugInfo,
      
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
  background: linear-gradient(to right, #053061, #4393c3, #f7f7f7, #d6604d, #67001f);
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

/* SVG热力图容器 - 移除边框，确保无干扰 */
.heatmap-svg-container {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  border: none !important;
  outline: none !important;
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