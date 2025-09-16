<template>
  <div class="curve-mode-view">
    <!-- 曲线图模式 -->
    <div class="curve-section">
      <div class="curve-card">
        <div class="curve-header">
          <h3 class="curve-title">血氧变化曲线</h3>
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
    let resizeListenerAttached = false
    let updateTimer = null
    let lastUpdateTime = 0
    const UPDATE_THROTTLE = 125 // 匹配8Hz数据频率（125ms）
    const autoScrollEnabled = ref(true) // 启用自动滚动窗口
    const TIME_WINDOW_MS = 15000 // 默认用于空数据坐标轴范围（与120帧≈15秒匹配）
    let axisBaseEndTime = 0 // 轴标签基准结束时间（用于窗口对齐）
    let trainingStartTime = 0 // 训练开始时间（用于累计时间标签）
    
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

      console.log('[数据曲线] 初始化ECharts曲线图')
      
      // 创建ECharts实例
      curveChart = echarts.init(container, null, {
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
        // 移除内置dataZoom，避免鼠标交互影响自动滚动
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
      
      // 不绑定dataZoom事件，避免悬停/点击影响自动滚动

      // 窗口大小变化时重新调整（仅绑定一次）
      if (!resizeListenerAttached) {
        window.addEventListener('resize', handleResize)
        resizeListenerAttached = true
      }
      
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
        axisBaseEndTime = now
        
        curveChart.setOption({
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
            { data: [] },  // 空的HbO数据
            { data: [] }   // 空的HbR数据
          ]
        }, false, false)
        return
      }
      
      // 【修复】使用参考项目的高效切片方法
      const dataLength = props.dataHistory.length
      
      let displayData = []
      let timeAxisMin, timeAxisMax
      let startIdx, endIdx
      
      // 使用固定帧窗口（120帧）
      const WINDOW_FRAMES = 120
      endIdx = dataLength
      if (dataLength <= WINDOW_FRAMES) {
        startIdx = 0
        console.log(`[滚动曲线] 数据不足${WINDOW_FRAMES}帧，显示全部${dataLength}帧`)
      } else {
        startIdx = Math.max(0, dataLength - WINDOW_FRAMES)
        console.log(`[滚动曲线] 显示最新${WINDOW_FRAMES}帧 (第${startIdx}-${endIdx}帧)`)
      }
      
      // 使用高效的slice方法获取显示数据
      displayData = props.dataHistory.slice(startIdx, endIdx)
      
      // 以显示数据的首尾时间作为坐标轴范围（无数据时使用TIME_WINDOW_MS回退）
      const firstTime = displayData[0]?.recordTime ?? (now - TIME_WINDOW_MS)
      const lastTime = displayData[displayData.length - 1]?.recordTime ?? now
      timeAxisMin = firstTime
      timeAxisMax = lastTime
      
      // 初始化训练开始时间（用于累计时间标签）
      if (!trainingStartTime && props.dataHistory.length > 0) {
        trainingStartTime = props.dataHistory[0]?.recordTime || now
      }

      // 窗口对齐：数据不足窗口时从第一帧对齐到0，否则保持末尾对齐
      const lastRecordTime = displayData[displayData.length - 1]?.recordTime || now
      const firstRecordTime = displayData[0]?.recordTime || lastRecordTime
      axisBaseEndTime = lastRecordTime
      const windowStart = displayData.length < WINDOW_FRAMES 
        ? firstRecordTime 
        : (lastRecordTime - TIME_WINDOW_MS)
      const elapsedStartSec = Math.max(0, Math.floor((windowStart - trainingStartTime) / 1000))
      // 转换为相对时间（0..TIME_WINDOW_MS）
      const hboSeriesData = displayData.map(frame => [
        Math.max(0, frame.recordTime - windowStart),
        frame.hboMean || 0
      ])
      const hbrSeriesData = displayData.map(frame => [
        Math.max(0, frame.recordTime - windowStart),
        frame.hbrMean || 0
      ])
      
      console.log(`[滚动曲线] 更新图表: HbO=${hboSeriesData.length}点, HbR=${hbrSeriesData.length}点`)
      
      // 更新图表（固定坐标间隔与位置，仅更新标签与数据）
      curveChart.setOption({
        xAxis: {
          min: 0,
          max: TIME_WINDOW_MS,
          interval: 5000,
          axisLabel: {
            formatter: function(value) {
              const totalSeconds = elapsedStartSec + Math.floor(value / 1000)
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
    
    // 开始更新循环（自动滚动10秒窗口）- 简化版
    function startUpdateLoop() {
      // 不使用定时器，完全依赖数据驱动更新
      console.log('[曲线简化] 移除定时器，使用纯数据驱动更新')
    }
    
    // 停止更新循环 - 简化版
    function stopUpdateLoop() {
      // 无定时器需要清理
      console.log('[曲线简化] 无定时器需要清理')
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
    
    // （已精简）数据更新触发器统一在后文的“滚动更新”监听中处理
    
    // 组件挂载
    onMounted(async () => {
      console.log('[数据曲线模式] 组件已挂载，使用简化更新逻辑')
      initCurveChart()
    })
    
    // 组件卸载
    onUnmounted(() => {
      console.log('[数据曲线模式] 组件已卸载')
      stopUpdateLoop()
      
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
    
    // 时间选择方法
    function updateTimeRangeStart(event) {
      // 【修改】当用户操作此滑块时，禁用自动滚动
      if (autoScrollEnabled.value) {
        autoScrollEnabled.value = false;
      }
      const newStart = parseInt(event.target.value)
      const newTimeRange = { ...props.selectedTimeRange, start: newStart }
      emit('update-time-range', newTimeRange)
      console.log(`[时间选择] 更新开始时间: ${newStart}`)
      updateHistoricalChart()
    }
    
    function updateTimeRangeEnd(event) {
      // 【修改】当用户操作此滑块时，禁用自动滚动
      if (autoScrollEnabled.value) {
        autoScrollEnabled.value = false;
      }
      const newEnd = parseInt(event.target.value)
      const newTimeRange = { ...props.selectedTimeRange, end: newEnd }
      emit('update-time-range', newTimeRange)
      console.log(`[时间选择] 更新结束时间: ${newEnd}`)
      updateHistoricalChart()
    }
    
    function resetTimeRange() {
      // 【修改】“重置”按钮现在用于恢复“自动滚动”模式
      const maxIndex = Math.max(0, props.dataHistory.length - 1)
      const newTimeRange = { start: 0, end: maxIndex }
      emit('update-time-range', newTimeRange)
      console.log('[时间选择] 重置时间范围')
      
      if (!autoScrollEnabled.value) {
        autoScrollEnabled.value = true
        console.log('[数据曲线] 恢复自动滚动')
      }
      
      // 立即调用滚动更新，确保视图立即切换到实时模式
      updateScrollingChart()
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
      if (!trainingStartTime && selectedData.length > 0) {
        trainingStartTime = selectedData[0]?.recordTime || now
      }
      const lastSelTime = selectedData[selectedData.length - 1]?.recordTime || now
      const firstSelTime = selectedData[0]?.recordTime || lastSelTime
      axisBaseEndTime = lastSelTime
      const windowStart = selectedData.length < WINDOW_FRAMES 
        ? firstSelTime 
        : (lastSelTime - TIME_WINDOW_MS)
      const elapsedStartSec = Math.max(0, Math.floor((windowStart - trainingStartTime) / 1000))
      
      // 使用SDK统计数据（避免重新计算导致的跳动）
      const hboSeriesData = selectedData.map(frame => [
        Math.max(0, frame.recordTime - windowStart),
        frame.hboMean || 0
      ])
      const hbrSeriesData = selectedData.map(frame => [
        Math.max(0, frame.recordTime - windowStart),
        frame.hbrMean || 0
      ])
      
      console.log(`[曲线优化] 更新${selectedData.length}帧数据，使用防抖机制`)
      
      // 优化更新：固定坐标间隔与位置，仅更新标签与数据
      curveChart.setOption({
        xAxis: {
          min: 0,
          max: TIME_WINDOW_MS,
          interval: 5000,
          axisLabel: {
            formatter: function(value) {
              const totalSeconds = elapsedStartSec + Math.floor(value / 1000)
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
      }, false, false) // 第三个参数改为false，避免强制重建
    }
    
    // 监听历史数据变化（统一使用滚动图表更新）
    watch(() => props.dataHistory, () => {
      if (props.dataHistory.length > 0) {
        if (autoScrollEnabled.value) {
          updateScrollingChart()
        } else {
          // 在手动模式下，当有新数据时，我们不再自动更新历史视图
          // 这样可以防止用户正在查看的范围被意外改变
          // updateHistoricalChart() // 注释掉此行
        }
      }
    }, { deep: true })
    
    // 监听时间范围变化
    watch(() => props.selectedTimeRange, () => {
      // 此监听器现在主要由手动滑块触发
      if (!autoScrollEnabled.value) {
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