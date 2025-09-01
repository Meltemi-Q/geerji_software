<template>
  <div class="curve-mode-view">
    <!-- 曲线图模式 -->
    <div class="curve-section">
      <div class="curve-card">
        <div class="curve-header">
          <h3 class="curve-title">血氧数据实时曲线</h3>
          <!-- 时间选择控件 -->
          <div class="time-selection-controls">
            <div class="time-range-info">
              <span class="time-info">历史数据: {{ dataHistory.length }} 帧</span>
              <span class="time-range">{{ selectedTimeRange.start }} - {{ selectedTimeRange.end }}</span>
            </div>
            <div class="time-slider-container">
              <label class="slider-label">时间范围选择：</label>
              <input 
                type="range" 
                class="time-slider"
                :min="0"
                :max="Math.max(0, dataHistory.length - 1)"
                :value="selectedTimeRange.start"
                @input="updateTimeRangeStart"
              />
              <input 
                type="range" 
                class="time-slider"
                :min="selectedTimeRange.start"
                :max="Math.max(selectedTimeRange.start, dataHistory.length - 1)"
                :value="selectedTimeRange.end"
                @input="updateTimeRangeEnd"
              />
              <button class="reset-time-btn" @click="resetTimeRange">重置</button>
            </div>
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
    // 历史数据相关props
    dataHistory: {
      type: Array,
      default: () => []
    },
    selectedTimeRange: {
      type: Object,
      default: () => ({ start: 0, end: 100 })
    }
  },
  emits: ['update-time-range'],
  setup(props, { emit }) {
    const curveChartRef = ref(null)
    const curveTimeRange = ref(10) // 默认显示10秒数据
    
    let curveChart = null
    let updateTimer = null
    let lastUpdateTime = 0
    const UPDATE_THROTTLE = 100 // 限制更新频率为100ms
    
    // 曲线数据点
    const curveDataPoints = ref({
      hbo: [], // { time: timestamp, value: number }
      hbr: []
    })
    
    // 创建曲线图
    function createCurveChart() {
      if (!curveChartRef.value) return
      
      console.log('[数据曲线] 初始化ECharts曲线图')
      
      // 创建ECharts实例
      curveChart = echarts.init(curveChartRef.value, null, {
        renderer: 'canvas',
        useDirtyRect: true
      })
      
      // 配置图表选项（优化性能）
      const option = {
        animation: {
          duration: 200, // 缩短动画时间提升流畅度
          easing: 'linear' // 使用线性动画
        },
        title: {
          text: '血氧数据时间序列',
          left: 'center',
          textStyle: {
            color: '#333',
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            label: {
              backgroundColor: '#6a7985'
            }
          },
          formatter: function(params) {
            const time = new Date(params[0].axisValue).toLocaleTimeString()
            let result = `时间: ${time}<br/>`
            params.forEach(param => {
              result += `${param.seriesName}: ${param.value.toFixed(4)} μM<br/>`
            })
            return result
          }
        },
        legend: {
          data: ['HbO (含氧血红蛋白)', 'HbR (脱氧血红蛋白)'],
          top: 30,
          textStyle: {
            color: '#333'
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          top: '20%'
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLine: {
            lineStyle: {
              color: '#666'
            }
          },
          axisLabel: {
            formatter: function(value) {
              return new Date(value).toLocaleTimeString()
            },
            color: '#666'
          }
        },
        yAxis: {
          type: 'value',
          name: '浓度变化 (μM)',
          nameTextStyle: {
            color: '#666'
          },
          axisLine: {
            lineStyle: {
              color: '#666'
            }
          },
          axisLabel: {
            formatter: '{value}',
            color: '#666'
          },
          splitLine: {
            lineStyle: {
              color: '#e0e0e0',
              type: 'dashed'
            }
          }
        },
        dataZoom: [
          {
            type: 'inside',
            start: 70,
            end: 100,
            filterMode: 'none'
          },
          {
            type: 'slider',
            start: 70,
            end: 100,
            filterMode: 'none',
            height: 20,
            bottom: 20
          }
        ],
        series: [
          {
            name: 'HbO (含氧血红蛋白)',
            type: 'line',
            smooth: 0.3, // 使用数值控制平滑度，提升性能
            symbol: 'none',
            lineStyle: {
              color: '#dc3545',
              width: 2
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
            name: 'HbR (脱氧血红蛋白)',
            type: 'line',
            smooth: 0.3, // 使用数值控制平滑度，提升性能
            symbol: 'none',
            lineStyle: {
              color: '#007bff',
              width: 2
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
      
      // 窗口大小变化时重新调整
      window.addEventListener('resize', handleResize)
      
      console.log('[数据曲线] ECharts曲线图初始化完成')
    }
    
    // 更新曲线数据
    function updateCurveData() {
      if (!curveChart) return
      
      const now = Date.now()
      const timeWindow = curveTimeRange.value * 1000 // 转换为毫秒
      
      // 使用真实SDK数据，如果没有数据则不添加点
      const hboValue = props.currentValues?.hbo
      const hbrValue = props.currentValues?.hbr
      
      // 只有在有真实数据时才添加数据点
      if (hboValue == null || hbrValue == null) {
        console.warn('[数据曲线] 未接收到SDK数据')
        return
      }
      
      // 添加新数据点
      curveDataPoints.value.hbo.push({ time: now, value: hboValue })
      curveDataPoints.value.hbr.push({ time: now, value: hbrValue })
      
      // 清理过期数据点（超过时间窗口的）
      const cutoffTime = now - timeWindow
      
      // 如果数据不满10秒，显示所有数据
      const dataStartTime = curveDataPoints.value.hbo.length > 0 ? curveDataPoints.value.hbo[0].time : now
      const dataAge = now - dataStartTime
      
      if (dataAge >= 10000) {
        // 已经积累了10秒以上的数据，只保留最近10秒
        curveDataPoints.value.hbo = curveDataPoints.value.hbo.filter(point => point.time > cutoffTime)
        curveDataPoints.value.hbr = curveDataPoints.value.hbr.filter(point => point.time > cutoffTime)
      }
      // 否则保留所有数据（不满10秒时显示所有）
      
      // 转换为ECharts数据格式
      const hboSeriesData = curveDataPoints.value.hbo.map(point => [point.time, point.value])
      const hbrSeriesData = curveDataPoints.value.hbr.map(point => [point.time, point.value])
      
      // 更新图表数据
      curveChart.setOption({
        series: [
          { data: hboSeriesData },
          { data: hbrSeriesData }
        ]
      }, false, true)
    }
    
    // 重置曲线图缩放
    function resetCurveZoom() {
      if (!curveChart) return
      
      console.log('[数据曲线] 重置缩放')
      curveChart.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100
      })
    }
    
    // 更新时间范围
    function updateTimeRange() {
      console.log(`[数据曲线] 时间范围更改为 ${curveTimeRange.value} 秒`)
      
      // 清理超出新时间范围的数据
      const now = Date.now()
      const timeWindow = curveTimeRange.value * 1000
      const cutoffTime = now - timeWindow
      
      curveDataPoints.value.hbo = curveDataPoints.value.hbo.filter(point => point.time > cutoffTime)
      curveDataPoints.value.hbr = curveDataPoints.value.hbr.filter(point => point.time > cutoffTime)
      
      // 更新图表
      updateCurveData()
    }
    
    // 处理窗口大小变化
    function handleResize() {
      if (curveChart) {
        curveChart.resize()
      }
    }
    
    // 开始更新循环（已改为使用历史数据，避免冲突）
    function startUpdateLoop() {
      // 注释掉原有的实时数据更新，改用历史数据监听
      // updateTimer = setInterval(() => {
      //   updateCurveData()
      // }, 1000) // 每秒更新一次
    }
    
    // 停止更新循环
    function stopUpdateLoop() {
      if (updateTimer) {
        clearInterval(updateTimer)
        updateTimer = null
      }
    }
    
    // 初始化曲线图
    async function initCurveChart() {
      await nextTick()
      createCurveChart()
      if (curveChart) {
        startUpdateLoop()
      }
    }
    
    // 监听数据变化
    watch(() => props.currentValues, () => {
      // 数据变化时会在更新循环中自动处理
    }, { deep: true })
    
    // 组件挂载
    onMounted(async () => {
      console.log('[数据曲线模式] 组件已挂载')
      initCurveChart()
    })
    
    // 组件卸载
    onUnmounted(() => {
      console.log('[数据曲线模式] 组件已卸载')
      stopUpdateLoop()
      
      if (curveChart) {
        window.removeEventListener('resize', handleResize)
        curveChart.dispose()
        curveChart = null
      }
    })
    
    // 时间选择方法
    function updateTimeRangeStart(event) {
      const newStart = parseInt(event.target.value)
      const newTimeRange = { ...props.selectedTimeRange, start: newStart }
      emit('update-time-range', newTimeRange)
      console.log(`[时间选择] 更新开始时间: ${newStart}`)
      updateHistoricalChart()
    }
    
    function updateTimeRangeEnd(event) {
      const newEnd = parseInt(event.target.value)
      const newTimeRange = { ...props.selectedTimeRange, end: newEnd }
      emit('update-time-range', newTimeRange)
      console.log(`[时间选择] 更新结束时间: ${newEnd}`)
      updateHistoricalChart()
    }
    
    function resetTimeRange() {
      const maxIndex = Math.max(0, props.dataHistory.length - 1)
      const newTimeRange = { start: 0, end: maxIndex }
      emit('update-time-range', newTimeRange)
      console.log('[时间选择] 重置时间范围')
      updateHistoricalChart()
    }
    
    // 使用历史数据更新图表（加入防抖处理）
    function updateHistoricalChart() {
      if (!curveChart || !props.dataHistory.length) return
      
      const now = Date.now()
      if (now - lastUpdateTime < UPDATE_THROTTLE) {
        return // 防抖：避免频繁更新
      }
      lastUpdateTime = now
      
      const { start, end } = props.selectedTimeRange
      const selectedData = props.dataHistory.slice(start, end + 1)
      
      // 使用SDK统计数据（避免重新计算导致的跳动）
      const hboSeriesData = selectedData.map(frame => [frame.recordTime, frame.hboMean || 0])
      const hbrSeriesData = selectedData.map(frame => [frame.recordTime, frame.hbrMean || 0])
      
      console.log(`[曲线优化] 更新${selectedData.length}帧数据，使用防抖机制`)
      
      // 优化更新：使用notMerge=false避免重建整个图表
      curveChart.setOption({
        series: [
          { data: hboSeriesData },
          { data: hbrSeriesData }
        ]
      }, false, false) // 第三个参数改为false，避免强制重建
    }
    
    // 监听历史数据变化
    watch(() => props.dataHistory, () => {
      if (props.dataHistory.length > 0) {
        updateHistoricalChart()
      }
    }, { deep: true })
    
    // 监听时间范围变化
    watch(() => props.selectedTimeRange, () => {
      updateHistoricalChart()
    }, { deep: true })
    
    return {
      curveChartRef,
      curveTimeRange,
      resetCurveZoom,
      updateTimeRange,
      // 时间选择方法
      updateTimeRangeStart,
      updateTimeRangeEnd,
      resetTimeRange,
      // 历史数据相关
      dataHistory: props.dataHistory,
      selectedTimeRange: props.selectedTimeRange
    }
  }
}
</script>

<style scoped>
.curve-mode-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 曲线图区域 */
.curve-section {
  width: 100%;
  height: 100%;
}

.curve-card {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.curve-header {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.curve-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  text-align: center;
  margin: 0;
}

.curve-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.curve-canvas {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.1);
  min-height: 300px;
}

/* 时间选择控件样式 */
.time-selection-controls {
  margin-top: 15px;
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
  font-size: 12px;
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
  font-size: 12px;
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
  font-size: 11px;
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