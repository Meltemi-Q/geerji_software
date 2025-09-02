<template>
  <div class="heatmap-mode-switcher">
    <!-- 模式切换控制栏 -->
    <div class="mode-control-bar" v-if="showModeControls">
      <div class="control-group mode-selector">
        <label class="control-label">渲染模式:</label>
        <div class="mode-buttons">
          <button 
            class="mode-button" 
            :class="{ active: currentMode === 'report' }"
            @click="switchMode('report')"
            :disabled="isTransitioning"
          >
            <span class="mode-icon">📊</span>
            报告风格
          </button>
          <button 
            class="mode-button" 
            :class="{ active: currentMode === 'legacy' }"
            @click="switchMode('legacy')"
            :disabled="isTransitioning"
          >
            <span class="mode-icon">🖼️</span>
            传统模式
          </button>
        </div>
      </div>
      
      <!-- 性能指标显示 -->
      <div class="control-group performance-info" v-if="showPerformanceInfo">
        <span class="performance-label">性能:</span>
        <span class="performance-value">{{ performanceInfo.fps }}fps</span>
        <span class="performance-value">{{ performanceInfo.renderTime }}ms</span>
      </div>
      
      <!-- 功能开关 -->
      <div class="control-group feature-toggles">
        <label class="toggle-item">
          <input 
            type="checkbox" 
            v-model="enableSmoothTransition"
            :disabled="isTransitioning"
          >
          平滑切换
        </label>
        <label class="toggle-item">
          <input 
            type="checkbox" 
            v-model="syncBetweenModes"
          >
          模式同步
        </label>
      </div>
    </div>

    <!-- 主要渲染区域 -->
    <div class="render-container" :class="{ transitioning: isTransitioning }">
      <!-- 报告风格渲染器 -->
      <Transition 
        :name="enableSmoothTransition ? 'mode-fade' : ''"
        :duration="transitionDuration"
        mode="out-in"
      >
        <HeatmapReportStyleView
          v-if="currentMode === 'report'"
          key="report-mode"
          ref="reportRenderer"
          v-bind="reportStyleProps"
          @render-mode-changed="handleRenderModeChanged"
          @performance-update="handlePerformanceUpdate"
        />
        
        <!-- 传统Canvas渲染器 -->
        <component
          v-else-if="currentMode === 'legacy'"
          key="legacy-mode"
          ref="legacyRenderer"
          :is="legacyComponent"
          v-bind="legacyProps"
          @performance-update="handlePerformanceUpdate"
        />
      </Transition>
      
      <!-- 过渡状态指示器 -->
      <div v-if="isTransitioning" class="transition-overlay">
        <div class="transition-spinner"></div>
        <div class="transition-text">切换渲染模式中...</div>
      </div>
    </div>

    <!-- 模式对比信息面板 -->
    <div class="mode-comparison-panel" v-if="showComparisonPanel">
      <div class="comparison-title">模式对比</div>
      <div class="comparison-table">
        <table>
          <thead>
            <tr>
              <th>特性</th>
              <th>报告风格</th>
              <th>传统模式</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>视觉质量</td>
              <td class="feature-high">高</td>
              <td class="feature-medium">中</td>
            </tr>
            <tr>
              <td>性能</td>
              <td class="feature-medium">中</td>
              <td class="feature-high">高</td>
            </tr>
            <tr>
              <td>色域控制</td>
              <td class="feature-high">固定色域</td>
              <td class="feature-low">动态范围</td>
            </tr>
            <tr>
              <td>离散色阶</td>
              <td class="feature-high">支持</td>
              <td class="feature-low">连续</td>
            </tr>
            <tr>
              <td>等高线</td>
              <td class="feature-high">支持</td>
              <td class="feature-low">不支持</td>
            </tr>
            <tr>
              <td>12-node覆盖</td>
              <td class="feature-high">支持</td>
              <td class="feature-low">不支持</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 错误恢复面板 -->
    <div v-if="hasError" class="error-recovery-panel">
      <div class="error-title">渲染错误</div>
      <div class="error-message">{{ errorMessage }}</div>
      <div class="error-actions">
        <button @click="retryCurrentMode" class="retry-button">重试当前模式</button>
        <button @click="fallbackToLegacy" class="fallback-button">回退到传统模式</button>
        <button @click="clearError" class="clear-button">清除错误</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import HeatmapReportStyleView from './HeatmapReportStyleView.vue'

export default {
  name: 'HeatmapModeSwitcher',
  components: {
    HeatmapReportStyleView
  },
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
    
    // 模式控制
    defaultMode: {
      type: String,
      default: 'report', // 'report' | 'legacy'
      validator: (value) => ['report', 'legacy'].includes(value)
    },
    allowModeSwitch: {
      type: Boolean,
      default: true
    },
    showModeControls: {
      type: Boolean,
      default: true
    },
    
    // 传统模式配置
    legacyComponent: {
      type: [String, Object],
      default: 'HeatmapModeView' // 可以是组件名或组件定义
    },
    
    // UI控制
    showPerformanceInfo: {
      type: Boolean,
      default: false
    },
    showComparisonPanel: {
      type: Boolean,
      default: false
    },
    enableAutoFallback: {
      type: Boolean,
      default: true
    },
    
    // 过渡设置
    transitionDuration: {
      type: Number,
      default: 300
    }
  },
  
  setup(props, { emit }) {
    // 核心状态
    const currentMode = ref(props.defaultMode)
    const isTransitioning = ref(false)
    const hasError = ref(false)
    const errorMessage = ref('')
    
    // 渲染器引用
    const reportRenderer = ref(null)
    const legacyRenderer = ref(null)
    
    // 控制状态
    const enableSmoothTransition = ref(true)
    const syncBetweenModes = ref(true)
    
    // 性能监控
    const performanceInfo = reactive({
      fps: 0,
      renderTime: 0,
      lastUpdateTime: 0
    })
    
    // 同步状态缓存
    const syncState = reactive({
      colorMap: 'Spectral',
      showContours: true,
      showChannels: false,
      overlayEnabled: true,
      discreteLevels: 9
    })
    
    // 计算属性：报告风格组件props
    const reportStyleProps = computed(() => ({
      hboData: props.hboData,
      channelPositions: props.channelPositions,
      layoutDimensions: props.layoutDimensions,
      colorMap: syncState.colorMap,
      showContours: syncState.showContours,
      showChannels: syncState.showChannels,
      overlayEnabled: syncState.overlayEnabled,
      discreteLevels: syncState.discreteLevels,
      showControls: false, // 由切换器管理控制
      useWorker: true
    }))
    
    // 计算属性：传统模式组件props
    const legacyProps = computed(() => ({
      hboData: props.hboData,
      hbrData: props.hboData.map(v => -v * 0.8), // 模拟HbR数据
      currentValues: {
        hbo: props.hboData.reduce((sum, v) => sum + v, 0) / props.hboData.length,
        hbr: -props.hboData.reduce((sum, v) => sum + v, 0) / props.hboData.length * 0.8
      }
    }))
    
    // 模式切换处理
    async function switchMode(newMode) {
      if (currentMode.value === newMode || isTransitioning.value || !props.allowModeSwitch) {
        return
      }
      
      console.log(`[模式切换器] 切换模式: ${currentMode.value} -> ${newMode}`)
      
      try {
        isTransitioning.value = true
        hasError.value = false
        
        // 同步当前状态
        if (syncBetweenModes.value) {
          await syncCurrentState()
        }
        
        // 切换模式
        const oldMode = currentMode.value
        currentMode.value = newMode
        
        // 等待新组件挂载
        await nextTick()
        
        // 性能监控重置
        performanceInfo.fps = 0
        performanceInfo.renderTime = 0
        
        // 发送切换事件
        emit('mode-changed', {
          from: oldMode,
          to: newMode,
          timestamp: Date.now()
        })
        
        console.log(`[模式切换器] 模式切换完成: ${newMode}`)
        
      } catch (error) {
        console.error('[模式切换器] 模式切换失败:', error)
        handleSwitchError(error, newMode)
      } finally {
        // 延迟结束过渡状态，确保视觉效果
        setTimeout(() => {
          isTransitioning.value = false
        }, enableSmoothTransition.value ? props.transitionDuration : 0)
      }
    }
    
    // 同步当前状态
    async function syncCurrentState() {
      try {
        const currentRenderer = getCurrentRenderer()
        if (!currentRenderer) return
        
        // 从当前渲染器获取状态（如果支持）
        if (currentRenderer.getState && typeof currentRenderer.getState === 'function') {
          const state = currentRenderer.getState()
          Object.assign(syncState, state)
        }
        
        console.log('[模式切换器] 状态同步完成:', syncState)
      } catch (error) {
        console.warn('[模式切换器] 状态同步失败:', error)
      }
    }
    
    // 获取当前渲染器实例
    function getCurrentRenderer() {
      return currentMode.value === 'report' ? reportRenderer.value : legacyRenderer.value
    }
    
    // 处理切换错误
    function handleSwitchError(error, targetMode) {
      hasError.value = true
      errorMessage.value = `切换到${targetMode === 'report' ? '报告风格' : '传统模式'}失败: ${error.message}`
      
      if (props.enableAutoFallback && targetMode === 'report') {
        console.log('[模式切换器] 自动回退到传统模式')
        setTimeout(() => {
          currentMode.value = 'legacy'
        }, 1000)
      }
    }
    
    // 性能信息更新处理
    function handlePerformanceUpdate(perfData) {
      Object.assign(performanceInfo, {
        ...perfData,
        lastUpdateTime: Date.now()
      })
    }
    
    // 渲染模式改变处理（来自子组件）
    function handleRenderModeChanged(newMode) {
      if (newMode !== currentMode.value) {
        switchMode(newMode)
      }
    }
    
    // 错误恢复操作
    function retryCurrentMode() {
      hasError.value = false
      errorMessage.value = ''
      const mode = currentMode.value
      currentMode.value = null
      nextTick(() => {
        currentMode.value = mode
      })
    }
    
    function fallbackToLegacy() {
      hasError.value = false
      errorMessage.value = ''
      currentMode.value = 'legacy'
    }
    
    function clearError() {
      hasError.value = false
      errorMessage.value = ''
    }
    
    // 生命周期
    onMounted(() => {
      console.log('[模式切换器] 组件挂载，默认模式:', currentMode.value)
    })
    
    onUnmounted(() => {
      console.log('[模式切换器] 组件卸载')
    })
    
    // 监听器
    watch(() => props.hboData, () => {
      // 数据变化时重置错误状态
      if (hasError.value) {
        hasError.value = false
        errorMessage.value = ''
      }
    })
    
    return {
      // 状态
      currentMode,
      isTransitioning,
      hasError,
      errorMessage,
      performanceInfo,
      
      // 引用
      reportRenderer,
      legacyRenderer,
      
      // 控制
      enableSmoothTransition,
      syncBetweenModes,
      
      // 计算属性
      reportStyleProps,
      legacyProps,
      
      // 方法
      switchMode,
      handlePerformanceUpdate,
      handleRenderModeChanged,
      retryCurrentMode,
      fallbackToLegacy,
      clearError
    }
  }
}
</script>

<style scoped>
.heatmap-mode-switcher {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.mode-control-bar {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 12px;
}

.control-label {
  font-weight: 500;
  margin-right: 5px;
}

.mode-buttons {
  display: flex;
  gap: 5px;
}

.mode-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: #ffffff;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.3s ease;
}

.mode-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.mode-button.active {
  background: rgba(74, 144, 226, 0.6);
  border-color: rgba(74, 144, 226, 0.8);
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
}

.mode-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-icon {
  font-size: 14px;
}

.performance-info .performance-value {
  background: rgba(0, 0, 0, 0.4);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
  font-family: monospace;
  font-size: 10px;
}

.feature-toggles {
  display: flex;
  gap: 12px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 11px;
}

.render-container {
  flex: 1;
  position: relative;
  min-height: 300px;
}

.render-container.transitioning {
  pointer-events: none;
}

.transition-overlay {
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
  color: #ffffff;
  z-index: 1000;
  border-radius: 10px;
}

.transition-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 8px;
}

.transition-text {
  font-size: 12px;
}

/* 过渡动画 */
.mode-fade-enter-active, .mode-fade-leave-active {
  transition: all 0.3s ease;
}

.mode-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.mode-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.mode-comparison-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  width: 280px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 12px;
  color: #ffffff;
  font-size: 11px;
  z-index: 100;
}

.comparison-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: center;
}

.comparison-table table {
  width: 100%;
  border-collapse: collapse;
}

.comparison-table th,
.comparison-table td {
  padding: 4px 6px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.comparison-table th {
  background: rgba(255, 255, 255, 0.1);
  font-weight: 600;
}

.feature-high { color: #4ade80; }
.feature-medium { color: #fbbf24; }
.feature-low { color: #f87171; }

.error-recovery-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(239, 68, 68, 0.9);
  border: 1px solid rgba(239, 68, 68, 1);
  border-radius: 8px;
  padding: 20px;
  color: #ffffff;
  text-align: center;
  z-index: 1000;
  min-width: 300px;
}

.error-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.error-message {
  font-size: 12px;
  margin-bottom: 15px;
  opacity: 0.9;
}

.error-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.error-actions button {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: #ffffff;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.3s ease;
}

.error-actions button:hover {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>