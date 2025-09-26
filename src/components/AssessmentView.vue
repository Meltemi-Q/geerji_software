<template>
  <div class="obelab-assessment-view">
    <!-- 顶部header -->
    <div class="top-header">
      <div class="system-branding">
        <span class="golgi-text-header">Golgi</span>
        <span class="system-subtitle">脑机交互智能康复训练系统</span>
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
            <h3 class="card-title">血氧变化曲线</h3>
          </div>
          <div class="card-content">
            <div ref="timeCurveRef" class="curve-chart"></div>
          </div>
        </div>

        <!-- 右上角：评估状态 -->
        <div class="grid-card assessment-status-card">
          <div class="card-header">
            <h3 class="card-title">综合评估结果</h3>
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

        <!-- 左下角：脑区活跃热力图（简化显示） -->
        <div class="grid-card brain-heatmap-card">
          <div class="card-header">
            <h3 class="card-title">脑区活跃热力图</h3>
          </div>
          <div class="card-content brain-content">
            <div class="brain-colorbar-compact">
              <div class="colorbar-gradient-compact"></div>
              <div class="colorbar-labels-compact">
                <span>-1.0</span>
                <span>0</span>
                <span>+1.0</span>
              </div>
            </div>
            <div ref="brainHeatmapRef" class="brain-heatmap"></div>
          </div>
        </div>

        <!-- 右下角：康复建议 (方案二重构) -->
        <div class="grid-card recovery-advice-card">
          <div class="card-header">
            <h3 class="card-title">康复建议</h3>
          </div>
          <div class="card-content advice-content">
            <div class="advice-sections">
              <div 
                v-for="section in currentAdvice.sections" 
                :key="section.label"
                class="advice-section"
              >
                <div class="section-header">
                  <div class="section-bullet"></div>
                  <span class="section-label">{{ section.label }}</span>
                </div>
                <div class="section-content">{{ section.content }}</div>
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
import { LineChart } from 'echarts/charts'
import { 
  GridComponent, 
  TooltipComponent, 
  TitleComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { captureAssessment } from '../utils/screenshotCapture.js'
import { sessionManager } from '../services/sessionManager.js'
import { cloudAPI } from '../services/geerjiCloudAPI.js'

// 无热力图配置，保留时间曲线能力

// 注册ECharts组件
echarts.use([
  LineChart,
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  CanvasRenderer
])

export default {
  name: 'AssessmentView',
  components: {
    // 移除StarRating组件
  },
  emits: ['new-training', 'save-record', 'return-standby'],
  props: {
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
    
    // 康复建议数据结构
    const rehabilitationContent = {
      "优秀": {
        sections: [
          {
            label: "训练安排",
            content: "建议在治疗师指导下保持当前训练频率，单次训练时长以您个体化的康复方案为准，注重控制负荷，避免疲劳。"
          },
          {
            label: "技术要点",
            content: "强调动作控制质量，适当放缓运动速度，增强神经肌肉控制与协调能力，进一步提升运动表现。"
          },
          {
            label: "参与鼓励",
            content: "您的康复经验对他人有积极影响，可在安全范围内适当交流。"
          }
        ]
      },
      "良好": {
        sections: [
          {
            label: "训练安排",
            content: "建议维持每周训练频次，具体单次时长请遵循治疗师的个性化方案，重在规律与可控性。"
          },
          {
            label: "技术要点",
            content: "继续完善动作模式，注重训练中的本体感觉输入，提高动作完成质量。"
          },
          {
            label: "防护建议",
            content: "训练前后请按治疗师指导进行关节保护与放松活动，预防代偿及劳损。"
          }
        ]
      },
      "一般": {
        sections: [
          {
            label: "训练安排",
            content: "以建立训练习惯为主，频率和强度应严格遵从治疗师建议，确保训练安全性。"
          },
          {
            label: "技术要点",
            content: "加强训练中的自我觉察与反馈，配合治疗师不断微调动作，打好基础。"
          },
          {
            label: "心理支持",
            content: "请勿与他人比较，关注自身每一点进步。康复是一个持续过程，您的努力终会带来改善。"
          }
        ]
      }
    }
    
    
    
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
    
    // 当前康复建议计算属性
    const currentAdvice = computed(() => {
      const level = activityLevelText.value // "优秀"/"良好"/"一般"
      return rehabilitationContent[level] || rehabilitationContent["一般"]
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

    // 创建简化版大脑显示（仅显示底图）
    async function createBrainHeatmap(container) {
      if (!container) return null
      const img = document.createElement('img')
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'contain'
      img.style.objectPosition = 'center'
      container.innerHTML = ''
      container.style.display = 'flex'
      container.style.alignItems = 'center'
      container.style.justifyContent = 'center'
      container.appendChild(img)
      img.src = new URL('../assets/brain_no_bg.png', import.meta.url).href
      return { img }
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
          // 去除 combined_heatmap_data
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
        
        // 【修复】即使云端操作失败，也要触发save-record事件（离线模式支持）
        console.log('[评估界面] 云端保存失败，触发离线保存模式')
        emit('save-record')
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
          await createBrainHeatmap(brainHeatmapRef.value)
        }
        // 窗口大小变化时重绘
        window.addEventListener('resize', handleResize)
      })
    }
    
    // 处理窗口大小变化
    function handleResize() {
      if (timeCurveChart) timeCurveChart.resize()
    }
    
    // 监听训练总结数据变化
    watch(() => props.trainingSummary, async (newData) => {
      if (newData) {
        // 重新创建图表
        if (timeCurveRef.value) {
          timeCurveChart = createTimeCurve(timeCurveRef.value)
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
      currentAdvice,
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
  padding: clamp(15px, 2vh, 25px) clamp(20px, 4vw, 40px);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  height: clamp(60px, 8vh, 100px); /* 响应式头部高度 */
  flex-shrink: 0;
}

.system-branding {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.golgi-text-header {
  font-size: 32px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.system-subtitle {
  font-size: 28px;
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
  font-size: 28px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  padding: clamp(15px, 3vh, 30px) clamp(20px, 4vw, 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 移除滑块，完全禁用溢出滚动 */
  min-height: 0;
}

/* 四块网格布局 */
.assessment-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: clamp(150px, 35vh, 1fr) clamp(150px, 35vh, 1fr); /* 固定最小高度+视窗比例 */
  gap: clamp(10px, 2vh, 30px); /* 更紧凑的响应式间距 */
  height: 100%;
  max-height: calc(100vh - clamp(60px, 8vh, 100px) - clamp(80px, 10vh, 120px) - 40px); /* 减去头部+底部+边距 */
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
  font-size: clamp(16px, 2.5vh, 24px); /* 更好的响应式缩放 */
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 clamp(8px, 1.2vh, 12px) 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  text-align: center; /* 确保卡片标题居中 */
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 移除滑块，禁用内容溢出滚动 */
  min-height: 0; /* 允许灵活压缩 */
  font-size: clamp(10px, 1.2vh, 14px); /* 更小的基础字体 */
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
  justify-content: space-between;
  align-items: stretch; /* 改为拉伸对齐 */
  gap: clamp(8px, 1.5vh, 15px);
  padding: clamp(8px, 1.5vh, 15px);
  flex-direction: column; /* 垂直布局 */
}

.status-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.8vh, 8px);
  padding: clamp(8px, 1.5vh, 15px);
  border-radius: 12px;
  text-align: center;
  flex-shrink: 0; /* 防止被压缩 */
}

.badge-icon {
  display: none; /* 直接隐藏SVG图标 */
}

.badge-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.grade {
  font-size: clamp(20px, 4vh, 34px); /* 响应式等级字体 */
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  text-align: center; /* 等级标题居中 */
}

.description {
  font-size: clamp(10px, 1.5vh, 16px); /* 响应式描述字体 */
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  text-align: center; /* 描述居中 */
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
  flex-direction: row; /* 改回水平排列 */
  gap: clamp(8px, 1.5vh, 15px);
  width: 100%;
  flex: 1; /* 占用剩余空间 */
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* 垂直居中 */
  padding: clamp(8px, 1.5vh, 12px);
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  flex: 1;
  text-align: center;
  min-height: clamp(60px, 8vh, 80px); /* 确保足够高度用于居中 */
  /* 内容溢出保护 */
  overflow: hidden;
  word-wrap: break-word;
}

.metric-label {
  font-size: clamp(12px, 2vh, 18px); /* 更好的响应式字体 */
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  margin-bottom: clamp(2px, 0.5vh, 4px);
  text-align: center; /* 确保标签居中 */
  line-height: 1.1;
}

.metric-value {
  font-size: clamp(14px, 2.2vh, 20px); /* 更大的响应式数值字体 */
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  text-align: center; /* 数值居中 */
  line-height: 1.1;
  /* 数值溢出保护 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  flex: 1;
  padding: 0;
}

.brain-heatmap {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  max-height: 100%;
  min-height: clamp(150px, 18vh, 240px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 1 1 0;
}

/* 左下角颜色条与刻度（历史类名还原） */
.brain-colorbar-compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-right: 12px;
}

.colorbar-gradient-compact {
  width: 180px;
  height: 12px;
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
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
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

/* 新康复建议样式 */
.advice-sections {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1.2vh, 12px);
  height: 100%;
  background: rgba(96, 165, 250, 0.05); /* 统一背景 */
  border-radius: 12px;
  padding: clamp(8px, 1.5vh, 16px); /* 统一内边距 */
  border: 1px solid rgba(96, 165, 250, 0.2);
  overflow: hidden;
}

.advice-section {
  background: transparent; /* 移除独立背景 */
  border-radius: 0;
  padding: clamp(6px, 1.2vh, 10px) 0; /* 只保留上下内边距 */
  border: none;
  border-bottom: 1px solid rgba(96, 165, 250, 0.1); /* 添加分割线 */
  flex: 1;
  min-height: 0;
}

.advice-section:last-child {
  border-bottom: none; /* 最后一个不要分割线 */
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: clamp(4px, 0.8vh, 8px);
  /* 康复建议内标题保持左对齐 */
}

.section-bullet {
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.section-label {
  font-size: clamp(12px, 2.2vh, 20px); /* 更大的响应式标题字体 */
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  line-height: 1.2;
  /* 康复建议内标题保持左对齐，移除居中 */
}

.section-content {
  font-size: clamp(10px, 1.8vh, 16px); /* 更大的响应式内容字体 */
  line-height: 1.4; /* 增加行高提高可读性 */
  color: rgba(255, 255, 255, 0.9);
  padding-left: clamp(10px, 2vw, 16px); /* 恢复左内边距 */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  /* 康复建议内容保持左对齐，移除居中 */
  /* 内容溢出保护 */
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

/* 底部按钮区域 */
.bottom-actions {
  padding: clamp(15px, 2vh, 25px) clamp(20px, 4vw, 40px);
  display: flex;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  height: clamp(80px, 10vh, 120px); /* 响应式底部高度 */
  flex-shrink: 0;
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
  font-size: 28px;
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

/* 720p以下的专项布局调整 */
@media (max-height: 720px) {
  .assessment-grid {
    grid-template-rows: minmax(120px, 1fr) minmax(120px, 1fr); /* 更小的最小高度 */
    gap: clamp(8px, 1.5vh, 20px);
  }
  
  .card-title {
    font-size: clamp(14px, 2vh, 20px);
    margin-bottom: clamp(2px, 0.5vh, 6px);
  }
  
  .grade {
    font-size: clamp(20px, 4vh, 30px); /* 更小的等级字体 */
  }
  
  .description {
    font-size: clamp(10px, 1.5vh, 14px);
  }
}

/* 超小屏幕紧急方案 - 单列布局 */
@media (max-width: 900px) or (max-height: 600px) {
  .assessment-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(100px, 1fr));
    gap: clamp(8px, 1vh, 15px);
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