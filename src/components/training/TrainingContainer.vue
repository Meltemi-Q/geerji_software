<template>
  <div class="training-container-view">
    <!-- 顶部标题栏 -->
    <div class="top-header">
      <div class="system-branding">
        <span class="golgi-text-header">Golgi</span>
        <span class="system-subtitle">脑机交互智能康复训练系统</span>
      </div>
      <!-- 患者信息显示在右上角 -->
      <div class="patient-info-header">
        <span class="patient-name-header">{{ patientInfo.name }} ({{ patientInfo.age }}岁)</span>
        <span class="training-time-header">{{ formatDuration(trainingDuration) }}</span>
      </div>
    </div>

    <!-- 主界面区域 -->
    <div class="main-layout">
      <!-- 左侧模式选择按钮 -->
      <ModeSelector
        :display-mode="displayMode"
@switch-mode="switchMode"
      />

      <!-- 中间显示区域 - 根据模式切换组件 -->
      <div class="center-display" :class="{ 'curve-mode': displayMode === 'curve' }">
        <CurveModeView 
          v-if="displayMode === 'curve'"
          :hbo-data="hboData"
          :hbr-data="hbrData"
          :current-values="currentValues"
          :data-history="dataHistory"
          :selected-time-range="selectedTimeRange"
          class="curve-display"
        />
        
        <GameModeView 
          v-else
          :current-values="currentValues"
          :hbo-data="hboData"
          :hbr-data="hbrData"
          @exit-game="switchMode('curve')"
          @coin-collected="onCoinCollected"
        />
      </div>

      <!-- 右侧控制面板 -->
      <TrainingControls
        :is-training="isTraining"
        :device-status="deviceStatus"
        :kangzhuxia-status="kangzhuxiaStatus"
        @start-training="$emit('start-training')"
        @pause-training="$emit('pause-training')" 
        @stop-training="$emit('stop-training')"
        @emergency-stop="$emit('emergency-stop')"
        @connect-kangzhuxia="$emit('connect-kangzhuxia')"
        @disconnect-kangzhuxia="$emit('disconnect-kangzhuxia')"
      />
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import ModeSelector from './controls/ModeSelector.vue'
import TrainingControls from './controls/TrainingControls.vue'
import CurveModeView from './modes/CurveModeView.vue'
import GameModeView from './modes/GameModeView.vue'
import { trainingCommon } from './mixins/TrainingCommon.js'

export default {
  name: 'TrainingContainer',
  components: {
    ModeSelector,
    TrainingControls,
    CurveModeView,
    GameModeView
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
    },
    patientInfo: {
      type: Object,
      default: () => ({
        name: '张三',
        age: 87
      })
    },
    deviceStatus: {
      type: Object,
      default: () => ({
        fnirs: 'connected',
        kangzhuxia: 'disconnected'
      })
    },
    kangzhuxiaStatus: {
      type: Object,
      default: () => ({
        connected: false,
        card_status: 0,
        motion_status: 0,
        emergency_status: 0
      })
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
  emits: [
    'start-training', 
    'pause-training', 
    'stop-training', 
    'emergency-stop',
    'connect-kangzhuxia',
    'disconnect-kangzhuxia',
    'update-time-range'
  ],
  setup() {
    // 模式切换相关
    const displayMode = ref('game') // 默认游戏模式，用户进入训练直接显示游戏界面
    
    // 使用共享逻辑
    const { formatDuration } = trainingCommon()
    
    // 模式切换函数
    function switchMode(mode) {
      console.log(`[训练容器] 从 ${displayMode.value} 切换到 ${mode}`)
      displayMode.value = mode
    }
    
    // 金币收集事件处理
    function onCoinCollected(coinData) {
      console.log(`[训练容器] 游戏金币收集: 得分 ${coinData.score}, 时间 ${new Date(coinData.timestamp).toLocaleTimeString()}`)
    }
    
    return {
      displayMode,
      switchMode,
      formatDuration,
      onCoinCollected
    }
  }
}
</script>

<style scoped>
/* TrainingContainer - 专业大脑热力图系统 */
.training-container-view {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); /* 专业蓝色渐变背景 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部标题栏 */
.top-header {
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 40px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.system-branding {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.golgi-text-header {
  font-size: 40px;
  font-weight: 900;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
  line-height: 1;
}

.system-subtitle {
  font-size: 24px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
  margin-top: 2px;
}

.patient-info-header {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.patient-name-header {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.training-time-header {
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 主界面布局 */
.main-layout {
  flex: 1;
  display: flex;
  padding: 30px;
  gap: 40px;
  min-height: 0;
}

/* 中间显示区域 */
.center-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 20px;
}

/* 曲线模式专用布局 */
.center-display.curve-mode {
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
}

/* ≤1365px断点：响应式布局 */
@media (max-width: 1365px) {
  .main-layout {
    flex-direction: column;
    gap: 20px;
    padding: 15px;
  }
  
  .center-display {
    min-height: 0;
    padding: 10px;
  }
  
  /* 确保左右栏可以横排和包装 */
  .main-layout > * {
    min-height: 0;
  }
}
</style>
