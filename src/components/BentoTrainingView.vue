<template>
  <div class="bento-training-view">
    <!-- Bento网格布局 -->
    <div class="bento-grid">
      <!-- 状态栏卡片 -->
      <div class="bento-card status-card">
        <div class="status-content">
          <div class="status-section">
            <div class="status-label">患者信息</div>
            <div class="status-value">张三 (87岁)</div>
            <div class="status-sub">房间: 201-3</div>
          </div>
          <div class="status-section">
            <div class="status-label">设备状态</div>
            <div class="device-status">
              <div class="device-item">
                <StatusIndicator status="connected" />
                <span>fNIRS已连接</span>
              </div>
              <div class="device-item">
                <StatusIndicator status="running" />
                <span>康复器械运行中</span>
              </div>
            </div>
          </div>
          <div class="status-section">
            <div class="status-label">训练状态</div>
            <div class="status-value">训练中 {{ formatDuration(trainingDuration) }}</div>
            <div class="status-sub">低速模式</div>
          </div>
          <div class="status-section">
            <div class="status-label">时间</div>
            <div class="status-value">{{ currentTime }}</div>
          </div>
        </div>
      </div>
      
      <!-- HbO热力图卡片 -->
      <div class="bento-card heatmap-card hbo-card">
        <h3 class="heatmap-title">含氧血红蛋白 (HbO)</h3>
        <div class="heatmap-container">
          <div ref="hboHeatmapRef" class="heatmap-canvas black-bg"></div>
        </div>
      </div>
      
      <!-- HbR热力图卡片 -->
      <div class="bento-card heatmap-card hbr-card">
        <h3 class="heatmap-title">脱氧血红蛋白 (HbR)</h3>
        <div class="heatmap-container">
          <div ref="hbrHeatmapRef" class="heatmap-canvas black-bg"></div>
        </div>
      </div>
      
      <!-- 数值显示卡片 -->
      <div class="bento-card values-card">
        <h3 class="card-title">实时血氧数据</h3>
        <div class="values-grid">
          <div class="value-item hbo-value">
            <div class="value-header">
              <span>HbO</span>
              <TrendArrow :trend="currentValues.hboTrend" />
            </div>
            <div class="value-number">{{ formatValue(currentValues.hbo) }} μM</div>
            <div class="value-trend">{{ getTrendText(currentValues.hboTrend) }}</div>
            <div class="value-change">变化率: +2.1%</div>
          </div>
          <div class="value-item hbr-value">
            <div class="value-header">
              <span>HbR</span>
              <TrendArrow :trend="currentValues.hbrTrend" />
            </div>
            <div class="value-number">{{ formatValue(currentValues.hbr) }} μM</div>
            <div class="value-trend">{{ getTrendText(currentValues.hbrTrend) }}</div>
            <div class="value-change">变化率: -1.8%</div>
          </div>
        </div>
      </div>
      
      <!-- 训练控制卡片 -->
      <div class="bento-card control-card">
        <div class="control-content">
          <div class="control-section">
            <h3 class="card-title">训练控制</h3>
            <div class="control-buttons">
              <button class="bento-button" :disabled="isTraining" @click="$emit('start-training')">
                开始
              </button>
              <button class="bento-button warning" :disabled="!isTraining" @click="$emit('pause-training')">
                暂停
              </button>
              <button class="bento-button" @click="$emit('stop-training')">
                结束
              </button>
            </div>
          </div>
          
          <div class="emergency-section">
            <button class="bento-button emergency" @click="$emit('emergency-stop')">
              🚨 紧急停止
            </button>
          </div>
          
          <div class="device-section">
            <h3 class="card-title">设备状态</h3>
            <div class="device-info">
              <div class="info-item">
                <StatusIndicator status="running" />
                <span>康复器械: 运行中 低速模式</span>
              </div>
              <div class="info-item">
                <span>数据质量: 良好</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import StatusIndicator from './StatusIndicator.vue'
import TrendArrow from './TrendArrow.vue'

export default {
  name: 'BentoTrainingView',
  components: {
    StatusIndicator,
    TrendArrow
  },
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
    },
    trainingDuration: {
      type: Number,
      default: 0
    },
    isTraining: {
      type: Boolean,
      default: false
    }
  },
  emits: ['start-training', 'pause-training', 'stop-training', 'emergency-stop'],
  setup(props) {
    const hboHeatmapRef = ref(null)
    const hbrHeatmapRef = ref(null)
    const currentTime = ref(new Date().toLocaleTimeString())
    
    let hboChart = null
    let hbrChart = null
    let timeInterval = null
    
    // 创建优化的热力图（黑色背景）
    function createHeatmap(container, data, isHbO = true) {
      if (!container || !data) return null
      
      d3.select(container).selectAll('*').remove()
      
      const width = 500
      const height = 500
      const margin = { top: 10, right: 10, bottom: 10, left: 10 }
      const chartWidth = width - margin.left - margin.right
      const chartHeight = height - margin.top - margin.bottom
      
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
      
      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`)
      
      // 数据处理
      const flatData = data.flat()
      const nonZeroData = flatData.filter(d => d !== 0)
      const extent = d3.extent(nonZeroData)
      
      // 针对黑色背景优化的颜色映射
      let colorScale
      if (isHbO) {
        // HbO使用暖色调（在黑背景上效果好）
        colorScale = d3.scaleSequential(d3.interpolateInferno)
          .domain(extent)
      } else {
        // HbR使用冷色调
        colorScale = d3.scaleSequential(d3.interpolateViridis)
          .domain(extent)
      }
      
      const xScale = d3.scaleLinear()
        .domain([0, data[0].length - 1])
        .range([0, chartWidth])
      
      const yScale = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([0, chartHeight])
      
      const cellWidth = chartWidth / data[0].length
      const cellHeight = chartHeight / data.length
      
      // 绘制热力图
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
          const value = data[i][j]
          if (value !== 0) {
            g.append('rect')
              .attr('x', xScale(j))
              .attr('y', yScale(i))
              .attr('width', cellWidth)
              .attr('height', cellHeight)
              .attr('fill', colorScale(value))
              .attr('opacity', 0.9)
              .attr('rx', 1) // 轻微圆角
          }
        }
      }
      
      // 头型轮廓（在黑背景上更清晰）
      const headPath = createHeadShape(chartWidth, chartHeight)
      g.append('path')
        .attr('d', headPath)
        .attr('fill', 'none')
        .attr('stroke', '#666666')
        .attr('stroke-width', 2)
        .attr('opacity', 0.8)
      
      return { svg, colorScale, extent }
    }
    
    function createHeadShape(width, height) {
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.35
      
      return `M ${centerX - radius} ${centerY} 
              A ${radius} ${radius * 1.1} 0 1 1 ${centerX + radius} ${centerY}
              A ${radius} ${radius * 1.1} 0 1 1 ${centerX - radius} ${centerY} Z`
    }
    
    function formatValue(value) {
      return value >= 0 ? `+${value.toFixed(3)}` : value.toFixed(3)
    }
    
    function formatDuration(seconds) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    
    function getTrendText(trend) {
      const trendMap = {
        'up': '上升',
        'down': '下降',
        'stable': '稳定'
      }
      return trendMap[trend] || '稳定'
    }
    
    function initHeatmaps() {
      nextTick(() => {
        if (hboHeatmapRef.value && props.hboData) {
          hboChart = createHeatmap(hboHeatmapRef.value, props.hboData, true)
        }
        if (hbrHeatmapRef.value && props.hbrData) {
          hbrChart = createHeatmap(hbrHeatmapRef.value, props.hbrData, false)
        }
      })
    }
    
    // 监听数据变化
    watch(() => props.hboData, (newData) => {
      if (hboHeatmapRef.value && newData) {
        hboChart = createHeatmap(hboHeatmapRef.value, newData, true)
      }
    }, { deep: true })
    
    watch(() => props.hbrData, (newData) => {
      if (hbrHeatmapRef.value && newData) {
        hbrChart = createHeatmap(hbrHeatmapRef.value, newData, false)
      }
    }, { deep: true })
    
    onMounted(() => {
      initHeatmaps()
      
      // 更新时间
      timeInterval = setInterval(() => {
        currentTime.value = new Date().toLocaleTimeString()
      }, 1000)
    })
    
    return {
      hboHeatmapRef,
      hbrHeatmapRef,
      currentTime,
      formatValue,
      formatDuration,
      getTrendText
    }
  }
}
</script>

<style scoped>
.bento-training-view {
  width: 100%;
  height: 100%;
  background-color: #f8f9fa;
}

.bento-grid {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  height: 100%;
  width: 100%;
}

/* 基础卡片样式 */
.bento-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 20px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s ease;
  animation: cardSlideIn 0.4s ease-out;
}

.bento-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

@keyframes cardSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 状态栏卡片 */
.status-card {
  grid-column: 1 / -1;
  padding: 16px 24px;
}

.status-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-section {
  flex: 1;
  text-align: center;
}

.status-label {
  font-size: 14px;
  color: #757575;
  margin-bottom: 4px;
}

.status-value {
  font-size: 18px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 2px;
}

.status-sub {
  font-size: 14px;
  color: #757575;
}

.device-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #212121;
}

/* 热力图卡片 */
.heatmap-card {
  grid-row: 2;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.hbo-card {
  grid-column: 1;
}

.hbr-card {
  grid-column: 2;
}

.heatmap-title {
  color: #1e88e5;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
  text-align: center;
}

.heatmap-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.heatmap-canvas {
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  width: 100%;
  height: 100%;
  max-width: 500px;
  max-height: 500px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.heatmap-canvas.black-bg {
  background-color: #000000;
}

/* 数值显示卡片 */
.values-card {
  grid-column: 3;
  grid-row: 2;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 16px;
  text-align: center;
}

.values-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: calc(100% - 50px);
}

.value-item {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #e0e0e0;
}

.value-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
  color: #212121;
}

.value-number {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  color: #1e88e5;
}

.value-trend {
  font-size: 14px;
  color: #757575;
  margin-bottom: 4px;
}

.value-change {
  font-size: 12px;
  color: #43a047;
  font-weight: 500;
}

.hbo-value .value-number {
  color: #e53935;
}

.hbr-value .value-number {
  color: #1e88e5;
}

/* 控制卡片 */
.control-card {
  grid-column: 1 / -1;
  grid-row: 3;
}

.control-content {
  display: flex;
  flex-direction: row;
  gap: 24px;
  align-items: center;
  height: 100%;
}

.control-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.emergency-section {
  display: flex;
  align-items: center;
}

.device-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.control-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.bento-button {
  background: #1e88e5;
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  min-width: 80px;
}

.bento-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.bento-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bento-button.warning {
  background: #fb8c00;
}

.bento-button.emergency {
  background: #e53935;
  animation: pulse 2s infinite;
  font-size: 14px;
  align-self: center;
  max-width: 150px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  font-size: 14px;
  color: #212121;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .bento-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto 1fr auto;
  }
  
  .hbo-card {
    grid-column: 1;
    grid-row: 2;
  }
  
  .hbr-card {
    grid-column: 2;
    grid-row: 2;
  }
  
  .values-card {
    grid-column: 1 / -1;
    grid-row: 3;
  }
  
  .control-card {
    grid-column: 1 / -1;
    grid-row: 4;
  }
  
  .values-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1000px) {
  .bento-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto repeat(4, auto);
  }
  
  .hbo-card,
  .hbr-card,
  .values-card,
  .control-card {
    grid-column: 1;
    grid-row: auto;
  }
  
  .status-content {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .values-grid {
    grid-template-columns: 1fr;
  }
}
</style>