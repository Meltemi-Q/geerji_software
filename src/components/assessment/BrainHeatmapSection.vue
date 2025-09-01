<template>
  <div class="brain-heatmap-section">
    <!-- 专业大脑模式颜色条 -->
    <div class="brain-colorbar-compact">
      <div class="colorbar-gradient-compact"></div>
      <div class="colorbar-labels-compact">
        <span>-0.05</span>
        <span>0.00</span>
        <span>+0.05</span>
      </div>
    </div>
    
    <!-- 增强大脑热力图容器 -->
    <div ref="brainHeatmapRef" class="brain-heatmap-enhanced">
      <!-- 使用新的增强热力图渲染器 -->
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { FNIRSHeatmapRenderer } from '../../utils/heatmap/FNIRSHeatmapRenderer.js'

export default {
  name: 'BrainHeatmapSection',
  props: {
    heatmapData: {
      type: Array,
      default: () => []
    },
    showAdaptive: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const brainHeatmapRef = ref(null)
    let heatmapRenderer = null
    
    // 初始化增强热力图
    async function initEnhancedBrainHeatmap() {
      console.log('[评估界面] 初始化增强大脑热力图')
      
      if (!brainHeatmapRef.value) {
        console.warn('[评估界面] DOM引用不存在')
        return
      }
      
      try {
        // 创建专业大脑热力图渲染器
        heatmapRenderer = new FNIRSHeatmapRenderer({
          deviceProfile: 'triangle',
          dataType: 'HbO', // 评估界面主要显示HbO数据
          renderMode: '2d',
          colorScheme: 'RdBu_r',
          showChannels: false, // 评估界面不显示通道点，保持简洁
          showOptodes: false,
          
          // 针对评估界面的特殊配置
          performance: {
            updateThrottle: 1000, // 评估界面更新频率较低
            enableCaching: true
          }
        })
        
        console.log('[评估界面] 增强大脑热力图初始化完成')
        
        // 渲染初始数据
        renderBrainHeatmap()
        
      } catch (error) {
        console.error('[评估界面] 增强热力图初始化失败:', error)
        // 回退到简单渲染
        renderFallbackHeatmap()
      }
    }
    
    // 渲染大脑热力图
    function renderBrainHeatmap() {
      if (!heatmapRenderer) return
      
      // 使用传入的数据，如果没有则生成评估用的模拟数据
      const channelData = props.heatmapData.length > 0 ? 
        props.heatmapData : 
        generateAssessmentHeatmapData()
      
      heatmapRenderer.renderHeatmap(brainHeatmapRef.value, channelData, {
        renderMode: '2d',
        showChannels: false // 评估界面保持简洁
      })
      
      console.log('[评估界面] 大脑热力图渲染完成')
    }
    
    // 生成评估用的模拟热力图数据
    function generateAssessmentHeatmapData() {
      // 生成代表训练总体效果的静态数据
      const channelCount = 432
      const data = []
      
      for (let i = 0; i < channelCount; i++) {
        // 模拟训练后的激活模式：某些区域有明显激活
        let value = 0
        
        // 前额区域激活（通道0-100）
        if (i < 100) {
          value = 0.03 + Math.random() * 0.02
        }
        // 运动区域激活（通道150-200）
        else if (i >= 150 && i < 200) {
          value = 0.025 + Math.random() * 0.015
        }
        // 其他区域较低激活
        else {
          value = -0.01 + Math.random() * 0.02
        }
        
        data.push(value)
      }
      
      return data
    }
    
    // 回退渲染（当增强渲染器失败时）
    function renderFallbackHeatmap() {
      console.log('[评估界面] 使用回退大脑热力图渲染')
      
      if (!brainHeatmapRef.value) return
      
      // 创建简单的Canvas显示
      const canvas = document.createElement('canvas')
      canvas.width = 250
      canvas.height = 250
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.borderRadius = '12px'
      
      const ctx = canvas.getContext('2d')
      
      // 绘制简化的大脑轮廓和热力图
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // 绘制圆形代表大脑
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const radius = Math.min(canvas.width, canvas.height) * 0.35
      
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 100, 100, 0.6)' // 红色表示激活
      ctx.fill()
      
      ctx.fillStyle = 'white'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('训练效果热力图', centerX, centerY)
      
      brainHeatmapRef.value.innerHTML = ''
      brainHeatmapRef.value.appendChild(canvas)
    }
    
    // 组件挂载
    onMounted(async () => {
      await nextTick()
      initEnhancedBrainHeatmap()
    })
    
    // 组件卸载
    onUnmounted(() => {
      if (heatmapRenderer) {
        heatmapRenderer.destroy()
      }
    })
    
    return {
      brainHeatmapRef
    }
  }
}
</script>

<style scoped>
/* 大脑热力图区域样式 */
.brain-heatmap-section {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

/* 紧凑颜色条 */
.brain-colorbar-compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.colorbar-gradient-compact {
  width: 180px; /* 减小宽度 */
  height: 12px; /* 减小高度 */
  background: linear-gradient(to right, 
    #313695 0%, #4575b4 20%, #74add1 40%, #abd9e9 50%, 
    #e0f3f8 60%, #ffffbf 70%, #fee090 80%, #fdae61 90%, 
    #f46d43 95%, #d73027 100%);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.colorbar-labels-compact {
  display: flex;
  justify-content: space-between;
  width: 180px;
  font-size: 11px; /* 减小字体 */
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* 增强大脑热力图容器 */
.brain-heatmap-enhanced {
  width: auto; /* 让宽度根据高度和aspect-ratio自动计算 */
  height: 100%; /* 占满容器高度 */
  aspect-ratio: 1; /* 强制保持1:1宽高比 */
  max-width: 250px; /* 限制最大宽度，对应max-height */
  max-height: 250px; /* 限制最大高度，确保不会过大 */
  background: transparent; /* 透明背景 */
  border-radius: 12px;
  border: none; /* 移除边框 */
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* 确保内容不超出 */
  flex-shrink: 0; /* 防止被压缩 */
}
</style>