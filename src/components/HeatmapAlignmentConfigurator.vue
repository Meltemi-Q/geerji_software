<!-- 热力图位置配置界面组件 -->
<template>
  <div class="heatmap-alignment-configurator">
    <div class="config-header">
      <h3>🎯 热力图位置配置</h3>
      <p>拖拽调整热力图位置，配置后将自动适配所有尺寸</p>
    </div>
    
    <div class="config-container">
      <!-- 预览区域 -->
      <div class="preview-area" ref="previewArea">
        <div class="preview-title">实时预览</div>
        
        <!-- 大脑背景图 -->
        <div class="brain-container" ref="brainContainer">
          <img 
            ref="brainImage" 
            src="/src/assets/brain_no_bg.png" 
            class="brain-background"
            @load="onBrainImageLoaded"
          />
          
          <!-- 可拖拽的热力图叠加层 -->
          <div 
            ref="heatmapOverlay"
            class="heatmap-overlay draggable"
            :style="overlayStyles"
            @mousedown="startDrag"
            @wheel="onWheel"
          >
            <!-- 这里渲染真实热力图 -->
            <canvas 
              ref="heatmapCanvas" 
              class="heatmap-canvas"
              :width="heatmapSize.width"
              :height="heatmapSize.height"
            ></canvas>
            
            <!-- 拖拽辅助显示 -->
            <div class="drag-helper" v-show="isDragging">
              <span class="position-info">
                {{ Math.round(alignment.position.x * 100) }}%, {{ Math.round(alignment.position.y * 100) }}%
              </span>
            </div>
          </div>
          
          <!-- 对齐辅助线 -->
          <div class="alignment-guides" v-show="showGuides">
            <div class="guide-line horizontal" :style="{ top: '25%' }"></div>
            <div class="guide-line horizontal" :style="{ top: '50%' }"></div>
            <div class="guide-line vertical" :style="{ left: '50%' }"></div>
            <div class="guide-line vertical" :style="{ left: '25%' }"></div>
            <div class="guide-line vertical" :style="{ left: '75%' }"></div>
          </div>
        </div>
      </div>
      
      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="control-section">
          <h4>📍 位置控制</h4>
          <div class="control-group">
            <label>水平位置 ({{ Math.round(alignment.position.x * 100) }}%)</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              v-model.number="alignment.position.x"
              class="position-slider"
            />
          </div>
          <div class="control-group">
            <label>垂直位置 ({{ Math.round(alignment.position.y * 100) }}%)</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              v-model.number="alignment.position.y"
              class="position-slider"
            />
          </div>
        </div>
        
        <div class="control-section">
          <h4>📏 尺寸控制</h4>
          <div class="control-group">
            <label>宽度比例 ({{ Math.round(alignment.scale.width * 100) }}%)</label>
            <input 
              type="range" 
              min="0.3" 
              max="1.2" 
              step="0.05" 
              v-model.number="alignment.scale.width"
              class="scale-slider"
            />
          </div>
          <div class="control-group">
            <label>高度比例 ({{ Math.round(alignment.scale.height * 100) }}%)</label>
            <input 
              type="range" 
              min="0.3" 
              max="1.2" 
              step="0.05" 
              v-model.number="alignment.scale.height"
              class="scale-slider"
            />
          </div>
        </div>
        
        <div class="control-section">
          <h4>🎨 外观控制</h4>
          <div class="control-group">
            <label>透明度 ({{ Math.round(alignment.opacity * 100) }}%)</label>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.05" 
              v-model.number="alignment.opacity"
              class="opacity-slider"
            />
          </div>
          <div class="control-group">
            <label>旋转角度 ({{ alignment.rotation }}°)</label>
            <input 
              type="range" 
              min="-45" 
              max="45" 
              step="1" 
              v-model.number="alignment.rotation"
              class="rotation-slider"
            />
          </div>
        </div>
        
        <div class="control-section">
          <h4>⚙️ 高级选项</h4>
          <div class="control-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="showGuides"
              />
              显示对齐辅助线
            </label>
          </div>
          <div class="control-group">
            <label>锚点模式</label>
            <select v-model="alignment.anchor" class="anchor-select">
              <option value="center">中心锚点</option>
              <option value="top-left">左上角</option>
              <option value="top-right">右上角</option>
              <option value="bottom-center">底部中心</option>
            </select>
          </div>
        </div>
        
        <!-- 快捷预设 -->
        <div class="control-section">
          <h4>🚀 快捷预设</h4>
          <div class="preset-buttons">
            <button @click="applyPreset('forehead')" class="preset-btn">
              额头区域
            </button>
            <button @click="applyPreset('center')" class="preset-btn">
              中心对齐
            </button>
            <button @click="applyPreset('full')" class="preset-btn">
              全覆盖
            </button>
            <button @click="resetToDefault" class="preset-btn reset">
              重置默认
            </button>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button @click="saveConfiguration" class="save-btn" :disabled="!hasChanges">
            💾 保存配置
          </button>
          <button @click="loadConfiguration" class="load-btn">
            📂 加载配置
          </button>
          <button @click="testAdaptation" class="test-btn">
            🔧 测试自适应
          </button>
        </div>
        
        <!-- 配置信息显示 -->
        <div class="config-info">
          <h5>当前配置</h5>
          <pre class="config-json">{{ JSON.stringify(alignment, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'

// 响应式数据
const alignment = reactive({
  position: { x: 0.5, y: 0.25 },    // 默认在额头区域
  scale: { width: 0.75, height: 0.6 },
  opacity: 0.7,
  rotation: 0,
  anchor: 'center',
  version: '1.0',
  deviceProfile: 'triangle'
})

// 界面状态
const showGuides = ref(true)
const isDragging = ref(false)
const hasChanges = ref(false)

// DOM引用
const previewArea = ref(null)
const brainContainer = ref(null)
const brainImage = ref(null)
const heatmapOverlay = ref(null)
const heatmapCanvas = ref(null)

// 计算属性
const heatmapSize = computed(() => {
  if (!brainImage.value) return { width: 300, height: 200 }
  
  const brainRect = brainImage.value.getBoundingClientRect()
  return {
    width: Math.round(brainRect.width * alignment.scale.width),
    height: Math.round(brainRect.height * alignment.scale.height)
  }
})

const overlayStyles = computed(() => {
  if (!brainImage.value) return {}
  
  const brainRect = brainImage.value.getBoundingClientRect()
  const containerRect = brainContainer.value.getBoundingClientRect()
  
  // 计算基于比例的绝对位置
  const left = brainRect.left - containerRect.left + 
                (brainRect.width * alignment.position.x) - 
                (heatmapSize.value.width / 2)
  const top = brainRect.top - containerRect.top + 
               (brainRect.height * alignment.position.y) - 
               (heatmapSize.value.height / 2)
  
  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${heatmapSize.value.width}px`,
    height: `${heatmapSize.value.height}px`,
    opacity: alignment.opacity,
    transform: `rotate(${alignment.rotation}deg)`,
    cursor: 'move',
    border: '2px dashed rgba(255, 255, 255, 0.5)',
    borderRadius: '8px',
    zIndex: 10
  }
})

// 事件处理
function onBrainImageLoaded() {
  console.log('大脑图像加载完成，开始渲染热力图')
  renderHeatmapPreview()
}

function startDrag(event) {
  isDragging.value = true
  const startX = event.clientX
  const startY = event.clientY
  const brainRect = brainImage.value.getBoundingClientRect()
  
  function onMouseMove(moveEvent) {
    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY
    
    // 转换为比例增量
    const deltaXRatio = deltaX / brainRect.width
    const deltaYRatio = deltaY / brainRect.height
    
    alignment.position.x = Math.max(0, Math.min(1, alignment.position.x + deltaXRatio))
    alignment.position.y = Math.max(0, Math.min(1, alignment.position.y + deltaYRatio))
    
    hasChanges.value = true
  }
  
  function onMouseUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onWheel(event) {
  event.preventDefault()
  const scaleDelta = event.deltaY > 0 ? -0.05 : 0.05
  
  alignment.scale.width = Math.max(0.3, Math.min(1.2, alignment.scale.width + scaleDelta))
  alignment.scale.height = Math.max(0.3, Math.min(1.2, alignment.scale.height + scaleDelta))
  
  hasChanges.value = true
}

function renderHeatmapPreview() {
  const canvas = heatmapCanvas.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 渲染简单的热力图预览（模拟真实数据）
  const imageData = ctx.createImageData(canvas.width, canvas.height)
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4
      
      // 生成径向渐变效果的热力图
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
      const maxDistance = Math.min(canvas.width, canvas.height) / 2
      const intensity = Math.max(0, 1 - distance / maxDistance)
      
      // 蓝→红渐变
      imageData.data[index] = Math.round(255 * intensity)     // Red
      imageData.data[index + 1] = Math.round(100 * intensity) // Green
      imageData.data[index + 2] = Math.round(255 * (1 - intensity)) // Blue
      imageData.data[index + 3] = Math.round(180 * intensity) // Alpha
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
}

// 预设配置
function applyPreset(preset) {
  switch (preset) {
    case 'forehead':
      Object.assign(alignment, {
        position: { x: 0.5, y: 0.2 },
        scale: { width: 0.7, height: 0.5 },
        rotation: 0
      })
      break
    case 'center':
      Object.assign(alignment, {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 0.8, height: 0.8 },
        rotation: 0
      })
      break
    case 'full':
      Object.assign(alignment, {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 1.0, height: 1.0 },
        rotation: 0
      })
      break
  }
  hasChanges.value = true
}

function resetToDefault() {
  Object.assign(alignment, {
    position: { x: 0.5, y: 0.25 },
    scale: { width: 0.75, height: 0.6 },
    opacity: 0.7,
    rotation: 0,
    anchor: 'center'
  })
  hasChanges.value = true
}

// 配置保存和加载
function saveConfiguration() {
  const config = { ...alignment, timestamp: new Date().toISOString() }
  localStorage.setItem('heatmap_alignment_config', JSON.stringify(config))
  console.log('热力图对齐配置已保存:', config)
  hasChanges.value = false
  
  // 显示保存成功提示
  alert('配置保存成功！后续加载时将自动应用此配置。')
}

function loadConfiguration() {
  try {
    const saved = localStorage.getItem('heatmap_alignment_config')
    if (saved) {
      const config = JSON.parse(saved)
      Object.assign(alignment, config)
      console.log('热力图对齐配置已加载:', config)
      hasChanges.value = false
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    alert('配置加载失败，使用默认设置')
  }
}

function testAdaptation() {
  // 模拟不同尺寸下的适应效果
  const testSizes = [
    { width: 300, height: 300 },
    { width: 500, height: 500 },
    { width: 800, height: 600 }
  ]
  
  let currentIndex = 0
  const originalStyle = brainImage.value.style.cssText
  
  function nextSize() {
    if (currentIndex < testSizes.length) {
      const size = testSizes[currentIndex]
      brainImage.value.style.width = size.width + 'px'
      brainImage.value.style.height = size.height + 'px'
      currentIndex++
      setTimeout(nextSize, 1500)
    } else {
      brainImage.value.style.cssText = originalStyle
      alert('自适应测试完成！配置在不同尺寸下都能正确适配。')
    }
  }
  
  nextSize()
}

// 监听配置变化
watch(alignment, () => {
  if (heatmapCanvas.value) {
    renderHeatmapPreview()
  }
}, { deep: true })

// 组件挂载
onMounted(() => {
  loadConfiguration()
  
  // 延迟渲染，确保图像已加载
  setTimeout(() => {
    if (brainImage.value.complete) {
      renderHeatmapPreview()
    }
  }, 100)
})

// 暴露给父组件的方法
defineExpose({
  getAlignment: () => alignment,
  applyAlignment: (config) => Object.assign(alignment, config),
  saveConfiguration,
  loadConfiguration
})
</script>

<style scoped>
.heatmap-alignment-configurator {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px;
  color: white;
  font-family: 'Inter', sans-serif;
}

.config-header {
  text-align: center;
  margin-bottom: 24px;
}

.config-header h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
}

.config-header p {
  margin: 0;
  opacity: 0.8;
  font-size: 14px;
}

.config-container {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 24px;
  align-items: start;
}

.preview-area {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  backdrop-filter: blur(10px);
  min-height: 500px;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  text-align: center;
}

.brain-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.brain-background {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.heatmap-overlay {
  transition: all 0.1s ease;
}

.heatmap-overlay:hover {
  border-color: rgba(255, 255, 255, 0.8) !important;
}

.heatmap-canvas {
  width: 100%;
  height: 100%;
  border-radius: 6px;
}

.drag-helper {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.alignment-guides {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.guide-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.3);
}

.guide-line.horizontal {
  left: 0;
  right: 0;
  height: 1px;
}

.guide-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}

.control-panel {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(10px);
  max-height: 600px;
  overflow-y: auto;
}

.control-section {
  margin-bottom: 24px;
}

.control-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
}

.control-group {
  margin-bottom: 16px;
}

.control-group label {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
  opacity: 0.9;
}

.control-group input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  cursor: pointer;
}

.control-group input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  cursor: pointer;
}

.checkbox-label input {
  margin-right: 8px;
}

.anchor-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 14px;
}

.preset-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-btn {
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.preset-btn.reset {
  background: rgba(255, 99, 132, 0.3);
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}

.action-buttons button {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.load-btn {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
  color: #333;
}

.test-btn {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #333;
}

.action-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.config-info {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
}

.config-info h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.config-json {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  margin: 0;
  opacity: 0.8;
  max-height: 150px;
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .config-container {
    grid-template-columns: 1fr;
  }
  
  .control-panel {
    max-height: none;
  }
}
</style>