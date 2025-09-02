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
    const UPDATE_THROTTLE = 125 // 匹配8Hz数据频率（125ms）
    const autoScrollEnabled = ref(true) // 启用自动滚动窗口
    const TIME_WINDOW_MS = 10000 // 10秒窗口（毫秒）
    
    // 创建曲线图
    function createCurveChart() {
      if (!curveChartRef.value) return
      
      console.log('[数据曲线] 初始化ECharts曲线图')
      
      // 创建ECharts实例
      curveChart = echarts.init(curveChartRef.value, null, {
        renderer: 'canvas',
        useDirtyRect: true
      })
      
      // 配置图表选项（优化性能与视觉）
      const option = {
        backgroundColor: 'rgba(255,255,255,0.6)',
        animation: {
          duration: 200, // 缩短动画时间提升流畅度
          easing: 'linear' // 使用线性动画
        },
        title: {
          text: '血氧数据变化情况',
          subtext: '\nHbO 和 HbR',
          left: 'center',
          textStyle: {
            color: '#000',
            fontSize: 16,
            fontWeight: 'bold'
          },
          subtextStyle: {
            color: '#000',
            fontSize: 12,
            fontWeight: 'normal'
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
            color: '#000'
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
              color: '#000'
            }
          },
          axisLabel: {
            formatter: function(value) {
              return new Date(value).toLocaleTimeString()
            },
            color: '#000'
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
            name: 'HbR (脱氧血红蛋白)',
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
      
      // 窗口大小变化时重新调整
      window.addEventListener('resize', handleResize)
      
      console.log('[数据曲线] ECharts曲线图初始化完成')
    }
    
    // 10秒滚动窗口曲线更新（统一逻辑）
    function updateScrollingChart() {
      if (!curveChart) {
        console.warn('[滚动曲线] 图表未初始化，跳过更新')
        return
      }
      
      const now = Date.now()
      
      // 防抖：避免频繁更新
      if (now - lastUpdateTime < UPDATE_THROTTLE) {
        return
      }
      lastUpdateTime = now
      
      // 处理空数据情况：显示空图表但保持坐标轴可见
      if (!props.dataHistory.length) {
        console.log('[滚动曲线] 暂无数据，显示空图表')
        const emptyTimeAxisMin = now - TIME_WINDOW_MS
        const emptyTimeAxisMax = now
        
        curveChart.setOption({
          xAxis: {
            min: emptyTimeAxisMin,
            max: emptyTimeAxisMax
          },
          series: [
            { data: [] },  // 空的HbO数据
            { data: [] }   // 空的HbR数据
          ]
        }, false, false)
        return
      }
      
      // 【修复】使用参考项目的高效切片方法
      const dataLength = props.dataHistory.length
      const dataAge = dataLength > 0 ? (now - props.dataHistory[0].recordTime) / 1000 : 0
      
      let displayData = []
      let timeAxisMin, timeAxisMax
      let startIdx, endIdx
      
      // 计算显示范围索引
      endIdx = dataLength
      if (dataAge < 10) {
        // 数据不满10秒：显示所有数据
        startIdx = 0
        timeAxisMin = props.dataHistory[0]?.recordTime || (now - TIME_WINDOW_MS)
        timeAxisMax = now
        console.log(`[滚动曲线] 数据不满10秒(${dataAge.toFixed(1)}s)，显示全部${dataLength}帧`)
      } else {
        // 数据满10秒：使用slice切片最新10秒数据（参考项目方式）
        const windowFrames = Math.ceil(10 * 8) // 10秒 * 8Hz ≈ 80帧
        startIdx = Math.max(0, dataLength - windowFrames)
        timeAxisMin = now - TIME_WINDOW_MS
        timeAxisMax = now
        console.log(`[滚动曲线] 数据满10秒，slice切片显示最新${windowFrames}帧 (第${startIdx}-${endIdx}帧)`)
      }
      
      // 使用高效的slice方法获取显示数据
      displayData = props.dataHistory.slice(startIdx, endIdx)
      
      // 转换为ECharts数据格式，使用SDK统计数据
      const hboSeriesData = displayData.map(frame => [frame.recordTime, frame.hboMean || 0])
      const hbrSeriesData = displayData.map(frame => [frame.recordTime, frame.hbrMean || 0])
      
      console.log(`[滚动曲线] 更新图表: HbO=${hboSeriesData.length}点, HbR=${hbrSeriesData.length}点`)
      
      // 更新图表（优化性能：不合并配置，直接替换数据）
      curveChart.setOption({
        xAxis: {
          min: timeAxisMin,
          max: timeAxisMax
        },
        series: [
          { data: hboSeriesData },
          { data: hbrSeriesData }
        ]
      }, false, false) // notMerge=false, lazyUpdate=false 提升性能
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
    
    // 更新时间范围（简化逻辑）
    function updateTimeRange() {
      console.log(`[数据曲线] 时间范围更改为 ${curveTimeRange.value} 秒`)
      // 直接更新图表，数据由历史数据统一管理
      updateScrollingChart()
    }
    
    // 处理窗口大小变化
    function handleResize() {
      if (curveChart) {
        curveChart.resize()
      }
    }
    
    // 开始更新循环（自动滚动10秒窗口）
    function startUpdateLoop() {
      updateTimer = setInterval(() => {
        if (autoScrollEnabled.value) {
          updateScrollingChart()
        }
      }, UPDATE_THROTTLE) // 匹配8Hz数据频率（125ms）
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
        // 立即进行一次更新，显示初始图表（即使没有数据）
        updateScrollingChart()
        console.log('[数据曲线] 初始化更新完成')
      }
    }
    
    // 监听数据变化：到达新帧时即时刷新（与定时器并行，提升持续性）
    watch(() => props.currentValues, () => {
      if (autoScrollEnabled.value) {
        updateScrollingChart()
      }
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
    
    // 监听历史数据变化（统一使用滚动图表更新）
    watch(() => props.dataHistory, () => {
      if (props.dataHistory.length > 0) {
        if (autoScrollEnabled.value) {
          updateScrollingChart()
        } else {
          updateHistoricalChart() // 手动时间选择模式保留原逻辑
        }
      }
    }, { deep: true })
    
    // 监听时间范围变化
    watch(() => props.selectedTimeRange, () => {
      if (autoScrollEnabled.value) {
        // 自动滚动模式下忽略手动时间范围，保持10秒窗口
        updateScrollingChart()
      } else {
        updateHistoricalChart()
      }
    }, { deep: true })
    
    return {
      curveChartRef,
      curveTimeRange,
      resetCurveZoom,
      updateTimeRange,
      autoScrollEnabled,
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
  border-radius: 16px;
  overflow: hidden; /* 裁剪内部画布实现圆角范围 */
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