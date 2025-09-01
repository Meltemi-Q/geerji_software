// TrainingView.vue 中集成自适应热力图定位的关键部分
// 在现有的TrainingView.vue中添加或修改以下部分

import { 
  heatmapPositioning, 
  loadHeatmapAlignment, 
  calculateHeatmapStyles,
  smartAlignHeatmap 
} from '../utils/HeatmapAdaptivePositioning.js'

// 在 setup() 函数中添加
const setup = (props, { expose }) => {
  // ... 现有代码 ...
  
  // 热力图自适应定位相关
  const heatmapAlignment = ref(null)
  const isAlignmentConfigured = ref(false)
  const showAlignmentConfig = ref(false)
  
  // 加载保存的对齐配置
  onMounted(async () => {
    // ... 现有的 onMounted 代码 ...
    
    // 加载热力图对齐配置
    await loadHeatmapAlignmentConfig()
  })
  
  /**
   * 加载热力图对齐配置
   */
  async function loadHeatmapAlignmentConfig() {
    console.log('[热力图对齐] 开始加载配置...')
    
    try {
      // 尝试加载保存的配置
      const savedConfig = loadHeatmapAlignment()
      
      if (savedConfig && savedConfig.timestamp) {
        heatmapAlignment.value = savedConfig
        isAlignmentConfigured.value = true
        console.log('[热力图对齐] 加载保存的配置成功:', savedConfig)
      } else {
        // 使用智能预对齐
        const smartConfig = await generateSmartAlignment()
        heatmapAlignment.value = smartConfig
        isAlignmentConfigured.value = false // 需要用户确认
        console.log('[热力图对齐] 使用智能预对齐配置:', smartConfig)
      }
    } catch (error) {
      console.error('[热力图对齐] 加载配置失败:', error)
      // 使用默认配置
      heatmapAlignment.value = heatmapPositioning.defaultConfig
      isAlignmentConfigured.value = false
    }
  }
  
  /**
   * 生成智能预对齐配置
   */
  async function generateSmartAlignment() {
    console.log('[智能预对齐] 开始分析triangle布局...')
    
    try {
      // 获取triangle布局数据
      const triangleLayout = await loadTriangleLayoutData()
      
      // 使用智能算法计算最佳位置
      const smartConfig = smartAlignHeatmap(triangleLayout)
      
      return smartConfig
    } catch (error) {
      console.warn('[智能预对齐] 分析失败，使用默认配置:', error)
      return heatmapPositioning.applyPreset('forehead')
    }
  }
  
  /**
   * 修改现有的 drawHeatmapOverlay 函数，使用自适应定位
   */
  function drawHeatmapOverlay(ctx, size, hboValues, brainChart) {
    console.log('[专业大脑热力图] 开始绘制自适应定位热力图...')
    
    try {
      // 确保有对齐配置
      if (!heatmapAlignment.value) {
        console.warn('[热力图对齐] 配置未加载，跳过渲染')
        return
      }
      
      // 确保brainRect已设置
      if (!brainChart.brainRect) {
        console.warn('[热力图对齐] brainRect未设置，跳过对齐')
        return
      }
      
      const { brainRect } = brainChart
      const config = heatmapAlignment.value
      
      // 使用自适应定位计算像素位置
      const positioning = heatmapPositioning.calculatePixelPosition(
        config, 
        brainRect,
        { left: 0, top: 0, width: size, height: size }
      )
      
      console.log('[热力图对齐] 计算的像素位置:', positioning)
      
      // 生成热力图数据
      const heatmapData = generateAdaptiveHeatmapData(
        hboValues, 
        positioning.width, 
        positioning.height,
        config
      )
      
      // 渲染自适应定位的热力图
      renderAdaptiveHeatmap(ctx, heatmapData, positioning)
      
    } catch (error) {
      console.error('[热力图对齐] 渲染失败:', error)
      // 回退到原始渲染方式
      renderFallbackHeatmap(ctx, size, hboValues, brainChart)
    }
  }
  
  /**
   * 生成自适应热力图数据
   */
  function generateAdaptiveHeatmapData(hboValues, width, height, config) {
    // 基于配置的尺寸生成适配的热力图数据
    const imageData = new ImageData(width, height)
    const data = imageData.data
    
    // 计算数据覆盖范围
    const effectiveWidth = width * 0.9  // 留10%边距
    const effectiveHeight = height * 0.9
    const offsetX = (width - effectiveWidth) / 2
    const offsetY = (height - effectiveHeight) / 2
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4
        
        // 判断是否在有效区域内
        if (x >= offsetX && x < offsetX + effectiveWidth &&
            y >= offsetY && y < offsetY + effectiveHeight) {
          
          // 基于triangle通道数据计算颜色
          const intensity = calculateHeatmapIntensity(
            x - offsetX, 
            y - offsetY, 
            effectiveWidth, 
            effectiveHeight, 
            hboValues
          )
          
          // 应用颜色映射（蓝→红）
          const color = getHeatmapColor(intensity)
          
          data[index] = color.r         // Red
          data[index + 1] = color.g     // Green  
          data[index + 2] = color.b     // Blue
          data[index + 3] = Math.round(255 * config.opacity * intensity) // Alpha
        } else {
          // 边缘区域透明
          data[index + 3] = 0
        }
      }
    }
    
    return imageData
  }
  
  /**
   * 渲染自适应定位的热力图
   */
  function renderAdaptiveHeatmap(ctx, imageData, positioning) {
    // 保存当前绘图状态
    ctx.save()
    
    // 应用变换（旋转、缩放等）
    if (positioning.rotation !== 0) {
      ctx.translate(positioning.centerX, positioning.centerY)
      ctx.rotate(positioning.rotation * Math.PI / 180)
      ctx.translate(-positioning.width / 2, -positioning.height / 2)
    } else {
      ctx.translate(positioning.left, positioning.top)
    }
    
    // 创建临时画布用于渲染热力图
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = positioning.width
    tempCanvas.height = positioning.height
    const tempCtx = tempCanvas.getContext('2d')
    
    // 将imageData绘制到临时画布
    tempCtx.putImageData(imageData, 0, 0)
    
    // 应用平滑处理
    tempCtx.filter = 'blur(1px)'
    
    // 将处理后的热力图绘制到主画布
    ctx.globalAlpha = positioning.opacity
    ctx.drawImage(tempCanvas, 0, 0)
    
    // 恢复绘图状态
    ctx.restore()
    
    console.log('[热力图渲染] 自适应定位热力图渲染完成')
  }
  
  /**
   * 计算热力图强度值
   */
  function calculateHeatmapIntensity(x, y, width, height, hboValues) {
    // 将像素坐标映射到标准化坐标 (-1, 1)
    const normalizedX = (x / width) * 2 - 1
    const normalizedY = (y / height) * 2 - 1
    
    // 基于现有的IDW插值算法计算强度
    if (!channelMidpoints || channelMidpoints.length === 0) {
      // 如果没有通道数据，生成简单的径向梯度
      const distance = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY)
      return Math.max(0, 1 - distance)
    }
    
    // 使用IDW插值计算真实强度
    let weightedSum = 0
    let totalWeight = 0
    const maxDistance = 2.0
    
    for (let i = 0; i < Math.min(channelMidpoints.length, hboValues.length); i++) {
      const channel = channelMidpoints[i]
      const value = hboValues[i]
      
      const dx = normalizedX - channel.realX
      const dy = normalizedY - channel.realY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < maxDistance) {
        const weight = 1 / (1 + distance * distance)
        weightedSum += value * weight
        totalWeight += weight
      }
    }
    
    return totalWeight > 0 ? Math.abs(weightedSum / totalWeight) : 0
  }
  
  /**
   * 显示对齐配置界面
   */
  function showAlignmentConfigurator() {
    showAlignmentConfig.value = true
    console.log('[配置界面] 显示热力图对齐配置界面')
  }
  
  /**
   * 应用新的对齐配置
   */
  function applyAlignmentConfig(newConfig) {
    heatmapAlignment.value = newConfig
    isAlignmentConfigured.value = true
    
    // 保存到本地存储
    heatmapPositioning.saveConfiguration(newConfig)
    
    // 重新渲染热力图
    if (brainChart && displayMode.value === 'brain') {
      updateBrainHeatmap()
    }
    
    console.log('[配置应用] 新的对齐配置已应用:', newConfig)
  }
  
  /**
   * 重置对齐配置
   */
  function resetAlignmentConfig() {
    const defaultConfig = heatmapPositioning.applyPreset('forehead')
    applyAlignmentConfig(defaultConfig)
    console.log('[配置重置] 已重置为默认配置')
  }
  
  // ... 现有代码保持不变 ...
  
  // 在 return 语句中添加新的响应式变量和方法
  return {
    // ... 现有的返回值 ...
    
    // 热力图自适应定位相关
    heatmapAlignment,
    isAlignmentConfigured,
    showAlignmentConfig,
    showAlignmentConfigurator,
    applyAlignmentConfig,
    resetAlignmentConfig,
    loadHeatmapAlignmentConfig
  }
}

// 在模板中添加配置界面
/* 
在专业大脑模式的模板中添加：

<div v-if="displayMode === 'brain'" class="brain-section">
  <!-- 现有的大脑热力图内容 -->
  <div class="brain-heatmap-card">
    <!-- ... 现有内容 ... -->
    
    <!-- 新增：对齐配置按钮 -->
    <div class="brain-controls">
      <button 
        v-if="!isAlignmentConfigured" 
        @click="showAlignmentConfigurator"
        class="alignment-config-btn warning"
      >
        ⚙️ 配置热力图位置
      </button>
      
      <button 
        v-else
        @click="showAlignmentConfigurator"
        class="alignment-config-btn"
      >
        🎯 调整热力图位置
      </button>
      
      <button 
        @click="resetAlignmentConfig"
        class="alignment-reset-btn"
        title="重置为默认位置"
      >
        🔄 重置位置
      </button>
    </div>
    
    <!-- ... 现有的大脑容器内容 ... -->
  </div>
  
  <!-- 配置界面弹窗 -->
  <div v-if="showAlignmentConfig" class="alignment-config-modal">
    <div class="modal-overlay" @click="showAlignmentConfig = false"></div>
    <div class="modal-content">
      <HeatmapAlignmentConfigurator
        :initial-config="heatmapAlignment"
        @save="applyAlignmentConfig"
        @cancel="showAlignmentConfig = false"
      />
    </div>
  </div>
</div>
*/

export default {
  // ... 现有的组件选项 ...
  setup
}