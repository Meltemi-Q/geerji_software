<template>
  <div class="curve-mode-view">
    <!-- 曲线图模式 -->
    <div class="curve-section">
      <div class="curve-card">
        <div class="curve-header">
          <h3 class="curve-title">血氧变化曲线</h3>
          <div class="time-range-info">
            <span class="time-info">历史数据: {{ dataHistory.length }} 帧</span>
            <span class="time-range">显示最近 120 帧</span>
          </div>
        </div>
        <div class="curve-container">
          <div ref="curveChartRef" class="curve-canvas"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { 
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  LegendComponent,
  DataZoomComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 注册ECharts组件
echarts.use([
  LineChart,
  GridComponent, 
  TooltipComponent, 
  TitleComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer
])

export default {
  name: 'CurveModeView',
  props: {
    hboData: { type: Array, required: true },
    hbrData: { type: Array, required: true },
    currentValues: { type: Object, required: true },
    dataHistory: { type: Array, default: () => [] }
  },
  setup(props, { emit }) {
    const curveChartRef = ref(null)
    const WINDOW_FRAMES = 120
    let curveChart = null
    let resizeListenerAttached = false
    const TIME_WINDOW_MS = 15000
    let trainingStartTime = 0
    let rafId = null
    
    // 创建曲线图
    function createCurveChart() {
      const container = curveChartRef.value
      if (!container) return

      // 如果已有实例或DOM残留，先清理，防止重复叠加
      if (curveChart) {
        try { curveChart.dispose() } catch (e) {}
        curveChart = null
      }
      const existing = echarts.getInstanceByDom(container)
      if (existing) {
        try { existing.dispose() } catch (e) {}
      }
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }

      
      // 创建ECharts实例
      curveChart = echarts.init(container, null, {
        renderer: 'canvas',
        useDirtyRect: true
      })
      
      // 配置图表选项（优化性能与视觉）
      const option = {
        backgroundColor: 'rgba(255,255,255,0.6)',
        animation: false,
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            label: { backgroundColor: '#6a7985' }
          },
          formatter: (params) => {
            try {
              return params.map(p => {
                const raw = Array.isArray(p.value) ? p.value[1] : p.value
                const num = typeof raw === 'number' ? raw : Number(raw)
                const text = Number.isFinite(num) ? num.toFixed(4) : String(raw)
                return `${p.seriesName}: ${text} μM`
              }).join('<br/>')
            } catch (e) {
              return ''
            }
          }
        },
        legend: {
          data: ['含氧血红蛋白', '脱氧血红蛋白'],
          top: 30,
          textStyle: {
            color: '#000'
          }
        },
        grid: {
          left: '3%',
          right: '6%',
          bottom: '16%',
          top: '20%'
        },
        // 固定刻度位置：将时间轴改为 value 轴（0..TIME_WINDOW_MS），标签显示相对时间
        xAxis: {
          type: 'value',
          min: 0,
          max: TIME_WINDOW_MS,
          interval: 5000, // 固定5s间隔
          boundaryGap: false,
          axisTick: { alignWithLabel: true },
          splitNumber: 3,
          axisLine: {
            lineStyle: { color: '#000' }
          },
          axisLabel: {
            formatter: function(value) {
              const totalSeconds = Math.floor(value / 1000)
              const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
              const ss = String(totalSeconds % 60).padStart(2, '0')
              return `${mm}:${ss}`
            },
            color: '#000',
            rotate: -20,
            showMaxLabel: true,
            showMinLabel: true,
            hideOverlap: true,
            margin: 10
          }
        },
        yAxis: {
          type: 'value',
          name: '浓度变化 (μM)',
          nameTextStyle: {
            color: '#000'
          },
          axisLine: {
            lineStyle: {
              color: '#000'
            }
          },
          axisLabel: {
            formatter: '{value}',
            color: '#000'
          },
          splitLine: {
            lineStyle: {
              color: '#e0e0e0',
              type: 'dashed'
            }
          }
        },
        series: [
          {
            name: '含氧血红蛋白',
            type: 'line',
            smooth: 0.1, // 降低平滑度，增强真实波动感
            symbol: 'none',
            lineStyle: {
              color: '#dc3545',
              width: 3
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(220, 53, 69, 0.3)' },
                  { offset: 1, color: 'rgba(220, 53, 69, 0.1)' }
                ]
              }
            },
            data: []
          },
          {
            name: '脱氧血红蛋白',
            type: 'line',
            smooth: 0.1, // 降低平滑度，增强真实波动感
            symbol: 'none',
            lineStyle: {
              color: '#007bff',
              width: 3
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(0, 123, 255, 0.3)' },
                  { offset: 1, color: 'rgba(0, 123, 255, 0.1)' }
                ]
              }
            },
            data: []
          }
        ]
      }
      
      curveChart.setOption(option)
      
      // 窗口大小变化时重新调整（仅绑定一次）
      if (!resizeListenerAttached) {
        window.addEventListener('resize', handleResize)
        resizeListenerAttached = true
      }
      
      
    }
    
    // 最近窗口滚动更新
    function updateScrollingChart() {
      if (!curveChart) {
        return
      }
      
      const now = Date.now()
      
      // 处理空数据情况：显示空图表但保持坐标轴可见
      if (!props.dataHistory.length) {
        scheduleSetOption({
          xAxis: {
            min: 0,
            max: TIME_WINDOW_MS,
            interval: 5000,
            axisLabel: {
              formatter: function(value) {
                const totalSeconds = Math.floor(value / 1000)
                const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
                const ss = String(totalSeconds % 60).padStart(2, '0')
                return `${mm}:${ss}`
              }
            }
          },
          series: [
            { data: [] },
            { data: [] }
          ]
        })
        return
      }
      
      const dataLength = props.dataHistory.length
      
      const endIdx = dataLength
      const startIdx = Math.max(0, endIdx - WINDOW_FRAMES)
      
      const displayData = props.dataHistory.slice(startIdx, endIdx)
      
      // 以显示数据的首尾时间作为坐标轴范围（无数据时使用TIME_WINDOW_MS回退）
      const lastTime = displayData[displayData.length - 1]?.recordTime ?? now
      
      // 初始化训练开始时间（用于累计时间标签与绝对时间基准）
      if (!trainingStartTime && props.dataHistory.length > 0) {
        trainingStartTime = props.dataHistory[0]?.recordTime || now
      }

      // 采用绝对时间（相对训练开始），仅通过调节 xAxis 窗口实现平滑滚动
      const lastAbsMs = Math.max(0, lastTime - trainingStartTime)
      const windowMin = Math.max(0, lastAbsMs - TIME_WINDOW_MS)
      const windowMax = lastAbsMs
      const elapsedStartSec = Math.floor(windowMin / 1000)

      // 数据点始终用绝对时间，避免窗口切换时整批重映射
      const hboSeriesData = displayData.map(frame => [
        Math.max(0, frame.recordTime - trainingStartTime),
        frame.hboMean || 0
      ])
      const hbrSeriesData = displayData.map(frame => [
        Math.max(0, frame.recordTime - trainingStartTime),
        frame.hbrMean || 0
      ])
      
      // 更新图表（固定坐标间隔与位置，仅更新标签与数据）
      scheduleSetOption({
        xAxis: {
          min: windowMin,
          max: windowMax,
          interval: 5000,
          axisLabel: {
            formatter: function(value) {
              const totalSeconds = Math.floor(value / 1000)
              const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
              const ss = String(totalSeconds % 60).padStart(2, '0')
              return `${mm}:${ss}`
            }
          }
        },
        series: [
          { data: hboSeriesData },
          { data: hbrSeriesData }
        ]
      })
    }

    function scheduleSetOption(option) {
      if (!curveChart) return
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        try {
          // lazyUpdate=true，避免在主流程中强制同步刷新
          curveChart.setOption(option, false, true)
        } catch (e) {
          console.error('[数据曲线] setOption 失败:', e)
        } finally {
          rafId = null
        }
      })
    }
    
    // 无定时器更新，纯数据驱动
    
    // 初始化曲线图
    async function initCurveChart() {
      await nextTick()
      createCurveChart()
      if (curveChart) {
        updateScrollingChart()
        console.log('[数据曲线] 初始化更新完成')
      }
    }
    
    // 仅监听长度变化，避免深度依赖导致与 ECharts 主流程竞争
    watch(() => props.dataHistory.length, (len) => {
      if (len > 0) updateScrollingChart()
    })
    
    // 组件挂载
    onMounted(async () => {
      console.log('[数据曲线模式] 组件已挂载，使用简化更新逻辑')
      await initCurveChart()
    })
    
    // 组件卸载
    onUnmounted(() => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      
      if (resizeListenerAttached) {
        window.removeEventListener('resize', handleResize)
        resizeListenerAttached = false
      }

      if (curveChart) {
        try { curveChart.dispose() } catch (e) {}
        curveChart = null
      }

      const container = curveChartRef.value
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild)
        }
      }
    })
    
    return {
      curveChartRef,
      dataHistory: props.dataHistory
    }
  }
}
</script>

<style scoped>
/* 曲线模式视图样式 */
.curve-mode-view {
  width: 100%;
  height: 100%;
  min-height: 600px; /* 强制最小高度 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.curve-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.curve-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.curve-header {
  margin-bottom: 15px;
  flex-shrink: 0;
}

.curve-title {
  color: white;
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 15px 0;
  text-align: center;
}

.curve-container {
  flex: 1;
  min-height: 300px;
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
}

.curve-canvas {
  width: 100%;
  height: 100%;
  min-height: 280px;
}

/* 时间选择控件样式 */
.time-selection-controls {
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.time-range-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.time-info, .time-range {
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
}

.time-slider-container {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.slider-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  margin-right: 5px;
}

.time-slider {
  flex: 1;
  min-width: 80px;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  outline: none;
  transition: all 0.2s ease;
}

.time-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: #007bff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.time-slider::-webkit-slider-thumb:hover {
  background: #0056b3;
  transform: scale(1.1);
}

.time-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #007bff;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.time-slider::-moz-range-thumb:hover {
  background: #0056b3;
  transform: scale(1.1);
}

.reset-time-btn {
  background: rgba(220, 53, 69, 0.8);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.reset-time-btn:hover {
  background: rgba(220, 53, 69, 1);
  transform: translateY(-1px);
}

.reset-time-btn:active {
  transform: translateY(0);
}
</style>