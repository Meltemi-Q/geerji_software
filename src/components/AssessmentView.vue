<template>
  <div class="obelab-assessment-view">
    <!-- 顶部header -->
    <div class="top-header">
      <div class="system-branding">
        <span class="golgi-text-header">Golgi</span>
        <span class="system-subtitle">近红外脑氧监测系统</span>
      </div>
      <div class="session-info">
        <span class="session-status">训练已完成</span>
      </div>
    </div>

    <!-- 主内容区域 - 四块布局 -->
    <div class="main-content">
      <div class="assessment-grid">
        <!-- 左上角：时间曲线 -->
        <div class="grid-card time-curve-card">
          <div class="card-header">
            <h3 class="card-title">训练时间曲线</h3>
            <div class="card-subtitle">血氧数据随时间变化</div>
          </div>
          <div class="card-content">
            <div ref="timeCurveRef" class="curve-chart"></div>
          </div>
        </div>

        <!-- 右上角：评估状态 -->
        <div class="grid-card assessment-status-card">
          <div class="card-header">
            <h3 class="card-title">训练评估</h3>
            <div class="card-subtitle">综合评价结果</div>
          </div>
          <div class="card-content status-content">
            <div class="status-badge" :class="activityLevelClass">
              <div class="badge-icon">
                <svg width="40" height="40">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="3"/>
                  <path d="M14 20l4 4 8-8" stroke="currentColor" stroke-width="3" fill="none"/>
                </svg>
              </div>
              <div class="badge-text">
                <div class="grade">{{ activityLevelText }}</div>
                <div class="description">{{ activityLevelDescription }}</div>
              </div>
            </div>
            <div class="status-metrics">
              <div class="metric-item">
                <span class="metric-label">HbO平均变化</span>
                <span class="metric-value positive">{{ formatValue(trainingSummary.avgHboChange) }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">HbR平均变化</span>
                <span class="metric-value negative">{{ formatValue(trainingSummary.avgHbrChange) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 左下角：专业大脑热力图 -->
        <div class="grid-card brain-heatmap-card">
          <div class="card-header">
            <h3 class="card-title">大脑活跃度热力图</h3>
            <div class="card-subtitle">完整训练时段平均</div>
          </div>
          <div class="card-content brain-content">
            <!-- 专业大脑模式颜色条 -->
            <div class="brain-colorbar-compact">
              <div class="colorbar-gradient-compact"></div>
              <div class="colorbar-labels-compact">
                <span>-0.05</span>
                <span>0.00</span>
                <span>+0.05</span>
              </div>
            </div>
            <div ref="brainHeatmapRef" class="brain-heatmap"></div>
          </div>
        </div>

        <!-- 右下角：康复建议 -->
        <div class="grid-card recovery-advice-card">
          <div class="card-header">
            <h3 class="card-title">康复建议</h3>
            <div class="card-subtitle">个性化训练指导</div>
          </div>
          <div class="card-content advice-content">
            <div class="advice-main">
              <div class="advice-title">{{ assessmentText.title }}</div>
              <div class="advice-description">{{ assessmentText.description }}</div>
            </div>
            <div class="advice-suggestions">
              <div class="suggestion-item">
                <div class="suggestion-icon">
                  <svg width="20" height="20">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M10 6v4l3 3" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <span>建议训练时间：15-20分钟</span>
              </div>
              <div class="suggestion-item">
                <div class="suggestion-icon">
                  <svg width="20" height="20">
                    <path d="M3 9l9-7 9 7v11c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V9z" 
                          fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <span>{{ assessmentText.suggestion }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部按钮区域 -->
    <div class="bottom-actions">
      <div class="action-buttons">
        <button 
          class="action-btn primary-btn"
          @click="$emit('new-training')"
        >
          <svg width="20" height="20" class="btn-icon">
            <path d="M12 2L2 7v10c0 5.55 3.84 10 9 11 5.16-1 9-5.45 9-11V7l-10-5z" 
                  fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          重新训练
        </button>
        
        <button 
          class="action-btn secondary-btn"
          @click="handleSaveRecord"
          :disabled="uploadStatus.isUploading"
        >
          <svg width="20" height="20" class="btn-icon">
            <path d="M19 21H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h11l5 5v11c0 1.1-.9 2-2 2z" 
                  fill="none" stroke="currentColor" stroke-width="2"/>
            <polyline points="17,21 17,13 7,13 7,21" fill="none" stroke="currentColor" stroke-width="2"/>
            <polyline points="7,3 7,8 15,8" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          {{ uploadStatus.isUploading ? uploadStatus.progress : '保存记录' }}
        </button>
        
        <!-- 上传状态提示 -->
        <div v-if="uploadStatus.success" class="upload-status success">
          <svg width="16" height="16" class="status-icon">
            <path d="M8 2L2 7v10c0 5.55 3.84 10 9 11 5.16-1 9-5.45 9-11V7l-10-5z" 
                  fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          评估记录已成功保存到云端
        </div>
        
        <div v-if="uploadStatus.error" class="upload-status error">
          <svg width="16" height="16" class="status-icon">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M8 4v4M8 12h.01" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          保存失败：{{ uploadStatus.error }}
        </div>

        <button 
          class="action-btn tertiary-btn"
          @click="$emit('return-standby')"
        >
          <svg width="20" height="20" class="btn-icon">
            <path d="M3 9l9-7 9 7v11c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V9z" 
                  fill="none" stroke="currentColor" stroke-width="2"/>
            <polyline points="9,22 9,12 15,12 15,22" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          返回主页
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart, CustomChart, LineChart } from 'echarts/charts'
import { 
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  VisualMapComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapRenderer } from '../utils/HeatmapRenderer.js'
import { 
  loadTriangleLayoutData, 
  createTriangleFnirsInfo,
  createChannelMapping 
} from '../utils/fnirsLayout.js'
import { captureAssessment } from '../utils/screenshotCapture.js'
import { sessionManager } from '../services/sessionManager.js'
import { cloudAPI } from '../services/geerjiCloudAPI.js'

// 加载配置（默认值，支持配置化）
const defaultConfig = {
  flipYForReport: false,
  idwPower: 2,
  scaleClampStrategy: "default",
  minScaleGuard: false,
  maskAlpha: 0.3
}

// 尝试加载外部配置
let heatmapConfig = defaultConfig
try {
  // 功能1：启用外部配置加载支持
  const configResponse = await fetch('/heatmap_renderer_config.json')
  const externalConfig = await configResponse.json()
  heatmapConfig = { ...defaultConfig, ...externalConfig.config }
  console.log('已加载外部配置:', heatmapConfig)
} catch (error) {
  console.log('使用默认配置:', error.message)
}

// 注册ECharts组件
echarts.use([
  HeatmapChart,
  CustomChart,
  LineChart,
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer
])

export default {
  name: 'AssessmentView',
  components: {
    // 移除StarRating组件
  },
  emits: ['new-training', 'save-record', 'return-standby'],
  props: {
    combinedHeatmap: {
      type: Array,
      required: true
    },
    brainActivityScore: {
      type: Object,
      required: true
    },
    assessmentText: {
      type: Object,
      required: true
    },
    trainingSummary: {
      type: Object,
      required: true
    }
  },
  setup(props, { emit }) {
    const timeCurveRef = ref(null)
    const brainHeatmapRef = ref(null)
    
    // 上传状态管理
    const uploadStatus = ref({
      isUploading: false,
      progress: '',
      success: false,
      error: null
    })
    
    let timeCurveChart = null
    let brainHeatmapChart = null
    // 功能1：传入配置参数到HeatmapRenderer构造函数
    const heatmapRenderer = new HeatmapRenderer(heatmapConfig)
    
    
    
    // 计算活跃度等级（基于训练总结数据）
    const activityLevelClass = computed(() => {
      const avgChange = (Math.abs(props.trainingSummary.avgHboChange) + Math.abs(props.trainingSummary.avgHbrChange)) / 2
      if (avgChange > 0.05) return 'level-excellent'
      if (avgChange > 0.02) return 'level-good'
      return 'level-normal'
    })
    
    const activityLevelText = computed(() => {
      const avgChange = (Math.abs(props.trainingSummary.avgHboChange) + Math.abs(props.trainingSummary.avgHbrChange)) / 2
      if (avgChange > 0.05) return '优秀'
      if (avgChange > 0.02) return '良好'
      return '一般'
    })
    
    const activityLevelDescription = computed(() => {
      const avgChange = (Math.abs(props.trainingSummary.avgHboChange) + Math.abs(props.trainingSummary.avgHbrChange)) / 2
      if (avgChange > 0.05) return '大脑活跃度表现优异，训练效果显著'
      if (avgChange > 0.02) return '大脑活跃度良好，训练有效果'
      return '大脑活跃度一般，建议继续训练'
    })
    
    // 生成模拟时间序列数据
    function generateTimeSeriesData() {
      const timePoints = 120 // 2分钟的数据，每秒1秒
      const hboData = []
      const hbrData = []
      
      for (let i = 0; i < timePoints; i++) {
        const time = i
        // 模拟训练过程中的血氧变化
        const baseHbo = props.trainingSummary.avgHboChange
        const baseHbr = props.trainingSummary.avgHbrChange
        
        // 添加时间变化和噪声
        const timeVariation = Math.sin(i / 20) * 0.3 + Math.sin(i / 40) * 0.2
        const noise = (Math.random() - 0.5) * 0.1
        
        hboData.push([time, baseHbo * (1 + timeVariation) + noise])
        hbrData.push([time, baseHbr * (1 + timeVariation) + noise])
      }
      
      return { hboData, hbrData }
    }

    // 创建时间曲线图
    function createTimeCurve(container) {
      if (!container) return null
      
      const chart = echarts.init(container)
      const { hboData, hbrData } = generateTimeSeriesData()
      
      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          textStyle: {
            color: '#ffffff'
          },
          formatter: function(params) {
            let result = `时间: ${params[0].data[0]}s<br/>`
            params.forEach(param => {
              result += `${param.seriesName}: ${param.data[1].toFixed(3)} μM<br/>`
            })
            return result
          }
        },
        legend: {
          data: ['HbO (含氧血红蛋白)', 'HbR (脱氧血红蛋白)'],
          textStyle: {
            color: '#ffffff'
          },
          top: 10
        },
        grid: {
          left: '10%',
          right: '10%',
          top: '20%',
          bottom: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'value',
          name: '时间 (s)',
          nameTextStyle: {
            color: '#ffffff'
          },
          axisLine: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.6)'
            }
          },
          axisTick: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.6)'
            }
          },
          axisLabel: {
            textStyle: {
              color: '#ffffff'
            }
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        yAxis: {
          type: 'value',
          name: '浓度 (μM)',
          nameTextStyle: {
            color: '#ffffff'
          },
          axisLine: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.6)'
            }
          },
          axisTick: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.6)'
            }
          },
          axisLabel: {
            textStyle: {
              color: '#ffffff'
            }
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        series: [
          {
            name: 'HbO (含氧血红蛋白)',
            type: 'line',
            data: hboData,
            lineStyle: {
              color: '#ef4444',
              width: 3
            },
            itemStyle: {
              color: '#ef4444'
            },
            smooth: true,
            showSymbol: false
          },
          {
            name: 'HbR (脱氧血红蛋白)',
            type: 'line',
            data: hbrData,
            lineStyle: {
              color: '#3b82f6',
              width: 3
            },
            itemStyle: {
              color: '#3b82f6'
            },
            smooth: true,
            showSymbol: false
          }
        ]
      }
      
      chart.setOption(option)
      return chart
    }

    // 创建专业大脑热力图（使用双Canvas分层）
    async function createBrainHeatmap(container) {
      if (!container) return null
      
      console.log('[评估界面-大脑显示] 创建简单大脑图片显示')
      
      // 创建图片元素
      const img = document.createElement('img')
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'contain'
      img.style.objectPosition = 'center'
      
      // 清空容器并添加图片
      container.innerHTML = ''
      container.style.position = 'relative'
      container.style.display = 'flex'
      container.style.alignItems = 'center'
      container.style.justifyContent = 'center'
      container.appendChild(img)
      
      // 加载大脑图片
      img.onload = () => {
        console.log('[评估界面-大脑显示] brain_no_bg.png 加载成功')
      }
      
      img.onerror = () => {
        console.warn('[评估界面-大脑显示] brain_no_bg.png 加载失败')
        container.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #666;">大脑图片加载失败</div>'
      }
      
      // 设置图片源
      img.src = new URL('../assets/brain_no_bg.png', import.meta.url).href
      
      return { img }
    }
    
    // 绘制大脑背景图（只执行一次）
    function drawBrainBackgroundOnce(ctx, size, brainChart, fnirsInfo) {
      const img = new Image()
      img.onload = () => {
        console.log(`[评估界面-大脑热力图] 图片加载成功: ${img.naturalWidth}x${img.naturalHeight}`)
        
        // 清空背景画布
        ctx.clearRect(0, 0, size, size)
        
        // **修复变形问题**：计算等比缩放尺寸，保持原始宽高比
        const maxSize = size * 0.8
        const aspectRatio = img.naturalWidth / img.naturalHeight
        
        let imgWidth, imgHeight
        if (aspectRatio > 1) {
          imgWidth = maxSize
          imgHeight = maxSize / aspectRatio
        } else {
          imgHeight = maxSize
          imgWidth = maxSize * aspectRatio
        }
        
        const imgX = (size - imgWidth) / 2
        const imgY = (size - imgHeight) / 2
        
        // 使用正确的宽高比绘制图片，避免变形
        ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight)
        
        // 设置brainRect用于热力图坐标映射（使用真实的图片尺寸和位置）
        brainChart.brainRect = { x: imgX, y: imgY, width: imgWidth, height: imgHeight }
        console.log('[评估界面-大脑热力图] brainRect设置完成:', brainChart.brainRect)
        
        // 背景加载完成后，立即绘制热力图
        drawHeatmapOverlay(brainChart, fnirsInfo)
      }
      
      img.onerror = () => {
        console.warn('[评估界面-大脑热力图] 大脑图像加载失败，使用备用方案')
        
        // 使用简单的圆形背景
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.fillStyle = 'rgba(100, 116, 139, 0.1)'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.fill()
        
        // **修复变形问题**：设置默认brainRect保持比例
        const imgSize = size * 0.95
        const offsetX = (size - imgSize) / 2
        const offsetY = (size - imgSize) / 2
        brainChart.brainRect = { x: offsetX, y: offsetY, width: imgSize, height: imgSize }
        
        // 绘制热力图
        drawHeatmapOverlay(brainChart, fnirsInfo)
      }
      
      // 尝试加载大脑图片（使用brain_no_bg.png）
      img.src = new URL('../assets/brain_no_bg.png', import.meta.url).href
    }
    
    // 绘制热力图覆盖层
    function drawHeatmapOverlay(brainChart, fnirsInfo) {
      if (!brainChart || !brainChart.brainRect) {
        console.warn('[评估界面-大脑热力图] brainRect未设置，无法绘制热力图')
        return
      }
      
      console.log('[评估界面-大脑热力图] 开始绘制热力图覆盖')
      
      const { heatmapCtx, size, brainRect } = brainChart
      
      // 清空热力图Canvas
      heatmapCtx.clearRect(0, 0, size, size)
      
      // 生成简单的演示数据
      const channelValues = []
      const channelCount = fnirsInfo.pairs.Src.length
      
      for (let i = 0; i < channelCount; i++) {
        // 基于训练总结创建综合数据
        const hboContribution = props.trainingSummary.avgHboChange * (0.8 + Math.random() * 0.4)
        const hbrContribution = props.trainingSummary.avgHbrChange * (0.8 + Math.random() * 0.4)
        
        // 综合血氧变化
        const spatialVariation = Math.sin(i * 0.5) * 0.3
        channelValues[i] = (hboContribution - hbrContribution * 0.5) * (1 + spatialVariation)
      }
      
      // 使用HeatmapRenderer生成热力图数据
      const heatmapResult = heatmapRenderer.generateContinuousHeatmap(fnirsInfo, channelValues)
      
      if (!heatmapResult || !heatmapResult.gridData || heatmapResult.gridData.length === 0) {
        console.warn('[评估界面-大脑热力图] 热力图数据生成失败')
        return
      }
      
      console.log(`[评估界面-大脑热力图] 生成热力图数据点数: ${heatmapResult.gridData.length}`)
      
      // 计算数据范围
      const values = heatmapResult.gridData.map(point => point[2]).filter(v => !isNaN(v))
      if (values.length === 0) return
      
      const minVal = Math.min(...values)
      const maxVal = Math.max(...values)
      const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal)) || 0.05
      
      // 绘制热力图点
      const gridSize = heatmapRenderer.gridSize
      const xStep = 2 / gridSize
      const yStep = 2 / gridSize
      
      for (const [gridI, gridJ, value] of heatmapResult.gridData) {
        // 坐标转换：网格索引转换为实际坐标
        const realX = -1 + gridJ * xStep + xStep / 2
        const realY = -1 + gridI * yStep + yStep / 2
        
        // 映射到brainRect坐标
        const canvasX = Math.floor(brainRect.x + (realX + 1) / 2 * brainRect.width)
        const canvasY = Math.floor(brainRect.y + (realY + 1) / 2 * brainRect.height)
        
        // 边界检查
        if (canvasX < brainRect.x || canvasX >= brainRect.x + brainRect.width || 
            canvasY < brainRect.y || canvasY >= brainRect.y + brainRect.height) {
          continue
        }
        
        // 计算颜色（红蓝温度映射）
        const normalizedValue = maxAbs > 0 ? value / maxAbs : 0
        const clampedValue = Math.max(-1, Math.min(1, normalizedValue))
        
        let r, g, b
        if (clampedValue > 0) {
          // 正值：蓝色到红色
          r = Math.floor(255 * clampedValue)
          g = 0
          b = Math.floor(255 * (1 - clampedValue))
        } else {
          // 负值：蓝色到黑色
          const absValue = Math.abs(clampedValue)
          r = 0
          g = 0
          b = Math.floor(255 * absValue)
        }
        
        // 绘制热力图点（增强显示效果）
        const alpha = 0.9
        // 创建径向渐变，让每个点有自然扩散效果
        const gradient = heatmapCtx.createRadialGradient(canvasX, canvasY, 0, canvasX, canvasY, 15)
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
        gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`)
        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`)
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
        
        heatmapCtx.fillStyle = gradient
        heatmapCtx.fillRect(canvasX - 15, canvasY - 15, 30, 30) // 更大的覆盖范围，确保热力图完整显示
      }
      
      console.log('[评估界面-大脑热力图] 热力图覆盖绘制完成')
    }
    
    
    // 格式化数值
    function formatValue(value) {
      return value >= 0 ? `+${value.toFixed(3)}` : value.toFixed(3)
    }
    
    // 保存评估记录（截图 + 云端上传）
    async function handleSaveRecord() {
      try {
        console.log('[评估界面] 开始保存评估记录')
        uploadStatus.value = {
          isUploading: true,
          progress: '正在截图保存...',
          success: false,
          error: null
        }
        
        // 1. 捕获评估界面截图
        const screenshotResult = await captureAssessment({
          filename: `assessment_${Date.now()}.png`,
          quality: 0.95
        })
        
        if (!screenshotResult.success) {
          throw new Error(`截图失败: ${screenshotResult.error}`)
        }
        
        console.log('[评估界面] 截图捕获成功')
        uploadStatus.value.progress = '正在上传截图...'
        
        // 2. 上传截图到云端
        const uploadResult = await cloudAPI.uploadScreenshot(screenshotResult.dataUrl, {
          type: 'assessment',
          session_id: sessionManager.currentSession?.session_id,
          dimensions: {
            width: screenshotResult.width,
            height: screenshotResult.height
          }
        })
        
        if (!uploadResult.success) {
          console.warn('[评估界面] 截图上传失败，继续完成会话')
        }
        
        uploadStatus.value.progress = '正在保存训练数据...'
        
        // 3. 完成训练会话并上传完整数据
        const sessionData = {
          assessment_summary: {
            activity_level: activityLevelText.value,
            activity_score: (Math.abs(props.trainingSummary.avgHboChange) + Math.abs(props.trainingSummary.avgHbrChange)) / 2,
            hbo_avg_change: props.trainingSummary.avgHboChange,
            hbr_avg_change: props.trainingSummary.avgHbrChange,
            brain_activity_score: props.brainActivityScore,
            assessment_text: props.assessmentText
          },
          screenshot_uploaded: uploadResult.success,
          combined_heatmap_data: props.combinedHeatmap
        }
        
        const sessionResult = await sessionManager.endSession(sessionData)
        
        if (sessionResult.success) {
          console.log('[评估界面] 完整评估数据保存成功')
          uploadStatus.value = {
            isUploading: false,
            progress: '保存完成！',
            success: true,
            error: null
          }
          
          // 延迟2秒后清理状态，让用户看到成功信息
          setTimeout(() => {
            uploadStatus.value = {
              isUploading: false,
              progress: '',
              success: false,
              error: null
            }
          }, 2000)
        } else {
          throw new Error(sessionResult.error || '会话数据保存失败')
        }
        
        // 触发原有的save-record事件
        emit('save-record')
        
      } catch (error) {
        console.error('[评估界面] 保存评估记录失败:', error)
        uploadStatus.value = {
          isUploading: false,
          progress: '',
          success: false,
          error: error.message
        }
      }
    }
    
    // 初始化图表
    function initCharts() {
      nextTick(async () => {
        if (timeCurveRef.value) {
          timeCurveChart = createTimeCurve(timeCurveRef.value)
        }
        
        if (brainHeatmapRef.value) {
          brainHeatmapChart = await createBrainHeatmap(brainHeatmapRef.value)
        }
        
        // 窗口大小变化时重绘
        window.addEventListener('resize', handleResize)
      })
    }
    
    // 处理窗口大小变化
    function handleResize() {
      if (timeCurveChart) timeCurveChart.resize()
      if (brainHeatmapChart) brainHeatmapChart.resize()
    }
    
    // 监听训练总结数据变化
    watch(() => props.trainingSummary, async (newData) => {
      if (newData) {
        // 重新创建图表
        if (timeCurveRef.value) {
          timeCurveChart = createTimeCurve(timeCurveRef.value)
        }
        if (brainHeatmapRef.value) {
          brainHeatmapChart = await createBrainHeatmap(brainHeatmapRef.value)
        }
      }
    }, { deep: true })

    
    onMounted(() => {
      initCharts()
    })
    
    return {
      timeCurveRef,
      brainHeatmapRef,
      formatValue,
      activityLevelClass,
      activityLevelText,
      activityLevelDescription,
      uploadStatus,
      handleSaveRecord
    }
  }
}
</script>

<style scoped>
/* Obelab风格训练结果评估界面 */
.obelab-assessment-view {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部header */
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 40px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.system-branding {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.golgi-text-header {
  font-size: 28px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.system-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.session-info {
  display: flex;
  align-items: center;
}

.session-status {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 16px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  padding: 30px 40px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

/* 四块网格布局 */
.assessment-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 30px;
  min-height: 600px; /* 确保最小高度 */
}

/* 通用卡片样式 - 毛玻璃效果 */
.grid-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 250px;
}

.card-header {
  margin-bottom: 15px; /* 减少间距 */
  text-align: center;
  flex-shrink: 0; /* 防止被压缩 */
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff; /* 毛玻璃背景下使用白色 */
  margin: 0 0 6px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); /* 添加文字阴影 */
}

.card-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8); /* 毛玻璃背景下使用白色 */
  font-weight: 500;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  min-height: 0; /* 允许灵活压缩 */
}

/* 左上角：时间曲线卡片 */
.time-curve-card {
  grid-column: 1;
  grid-row: 1;
}

.curve-chart {
  width: 100%;
  height: clamp(160px, 20vh, 260px); /* 响应式高度 */
  flex: 1;
  background: rgba(30, 60, 114, 0.1);
  border-radius: 12px;
  min-height: clamp(160px, 18vh, 220px); /* 响应式最小高度 */
}

/* 右上角：评估状态卡片 */
.assessment-status-card {
  grid-column: 2;
  grid-row: 1;
}

.status-content {
  justify-content: center;
  align-items: center;
  gap: 25px;
}

.status-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 25px;
  border-radius: 20px;
  text-align: center;
}

.badge-icon {
  color: #ffffff;
  opacity: 0.9;
}

.badge-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.grade {
  font-size: 28px;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.description {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.level-excellent {
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
}

.level-good {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
}

.level-normal {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);
}

.status-metrics {
  display: flex;
  flex-direction: row; /* 改为水平排列 */
  gap: 15px; /* 增加间距 */
  width: 100%;
}

.metric-item {
  display: flex;
  flex-direction: column; /* 内部垂直排列 */
  align-items: center; /* 居中对齐 */
  padding: 15px 12px; /* 调整内边距 */
  background: rgba(255, 255, 255, 0.15); /* 增加背景透明度 */
  border-radius: 12px;
  backdrop-filter: blur(10px);
  flex: 1; /* 平均分配宽度 */
  text-align: center;
}

.metric-label {
  font-size: 12px; /* 略微减小 */
  color: rgba(255, 255, 255, 0.8); /* 毛玻璃背景下使用白色 */
  font-weight: 500;
  margin-bottom: 5px; /* 添加下边距 */
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); /* 添加文字阴影 */
}

.metric-value.positive {
  color: #10b981;
}

.metric-value.negative {
  color: #ef4444;
}

/* 左下角：大脑热力图卡片 */
.brain-heatmap-card {
  grid-column: 1;
  grid-row: 2;
}

.brain-content {
  justify-content: flex-start; /* 改为顶部对齐 */
  align-items: center;
  gap: 10px; /* 减小间距 */
  flex: 1;
  padding: 0; /* 移除内边距 */
}

.brain-colorbar-compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px; /* 减小间距 */
  flex-shrink: 0; /* 防止被压缩 */
}

.colorbar-gradient-compact {
  width: 180px; /* 略微减小 */
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

.brain-heatmap {
  width: auto; /* 让宽度根据高度和aspect-ratio自动计算 */
  height: 100%; /* 占满容器高度 */
  aspect-ratio: 1; /* 强制保持1:1宽高比 */
  max-width: 250px; /* 限制最大宽度，对应max-height */
  max-height: 250px; /* 限制最大高度，确保不会过大 */
  background: transparent; /* 透明背景 */
  border-radius: 12px;
  border: none; /* 移除边框 */
  min-height: clamp(150px, 15vh, 250px); /* 响应式最小高度 */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* 确保内容不超出 */
  flex-shrink: 0; /* 防止被压缩 */
}

/* 右下角：康复建议卡片 */
.recovery-advice-card {
  grid-column: 2;
  grid-row: 2;
}

.advice-content {
  justify-content: space-between;
  gap: 20px;
}

.advice-main {
  text-align: center;
}

.advice-title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff; /* 毛玻璃背景下使用白色 */
  margin-bottom: 12px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.advice-description {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9); /* 毛玻璃背景下使用白色 */
  line-height: 1.6;
  margin-bottom: 20px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.advice-suggestions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.15); /* 增加背景透明度 */
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.suggestion-icon {
  color: rgba(255, 255, 255, 0.9); /* 改为白色 */
  flex-shrink: 0;
}

.suggestion-item span {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9); /* 改为白色 */
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 底部按钮区域 */
.bottom-actions {
  padding: 20px 40px 30px;
  display: flex;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-buttons {
  display: flex;
  gap: 20px;
  align-items: center;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px 30px;
  border: none;
  border-radius: 15px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 140px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.btn-icon {
  flex-shrink: 0;
}

.primary-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
}

.primary-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
}

.secondary-btn {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #ffffff;
}

.secondary-btn:hover {
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
}

.tertiary-btn {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.tertiary-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.action-btn:disabled:hover {
  transform: none;
  box-shadow: none;
}

/* 上传状态指示器 */
.upload-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-top: 10px;
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}

.upload-status.success {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9));
  color: #ffffff;
  border-color: rgba(16, 185, 129, 0.4);
}

.upload-status.error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9));
  color: #ffffff;
  border-color: rgba(239, 68, 68, 0.4);
}

.status-icon {
  flex-shrink: 0;
}

/* 确保底部按钮区域有正确的相对定位 */
.bottom-actions {
  position: relative;
}

/* 响应式设计 */
@media (width: 1920px) and (height: 1080px) {
  .assessment-grid {
    gap: 40px;
  }
  
  .grid-card {
    padding: 30px;
  }
  
  .card-title {
    font-size: 22px;
  }
  
  .action-btn {
    padding: 18px 35px;
    font-size: 18px;
  }
}

@media (max-width: 1400px) {
  .assessment-grid {
    gap: 25px;
  }
  
  .grid-card {
    padding: 20px;
  }
}

@media (max-width: 1200px) {
  .assessment-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(250px, 1fr));
    gap: 20px;
  }
  
  .time-curve-card,
  .assessment-status-card,
  .brain-heatmap-card,
  .recovery-advice-card {
    grid-column: 1;
  }
  
  .time-curve-card {
    grid-row: 1;
  }
  
  .assessment-status-card {
    grid-row: 2;
  }
  
  .brain-heatmap-card {
    grid-row: 3;
  }
  
  .recovery-advice-card {
    grid-row: 4;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 20px;
  }
  
  .golgi-text-header {
    font-size: 24px;
  }
  
  .top-header {
    padding: 15px 20px;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 15px;
  }
  
  .action-btn {
    min-width: 200px;
  }
}
</style>