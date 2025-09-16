<template>
  <header class="status-bar">
    <!-- 患者信息区 -->
    <div class="info-section">
      <div class="patient-info">
        <span class="patient-name">患者: {{ patientInfo.name }} ({{ patientInfo.age }}岁)</span>
        <span class="patient-room">房间: {{ patientInfo.room }}</span>
      </div>
    </div>
    
    <!-- 设备状态区 -->
    <div class="info-section">
      <div class="device-status">
        <div class="device-item">
          <StatusIndicator :status="deviceStatus.fnirs" />
          <span>fNIRS{{ getStatusText(deviceStatus.fnirs) }}</span>
        </div>
        <div class="device-item">
          <StatusIndicator :status="deviceStatus.kangzhuxia" />
          <span>康复器械{{ getStatusText(deviceStatus.kangzhuxia) }}</span>
        </div>
      </div>
    </div>
    
    <!-- 训练状态区 -->
    <div class="info-section">
      <div class="training-info">
        <span v-if="trainingStatus.isTraining" class="training-active">
          训练中 {{ formatDuration(trainingStatus.duration) }}
        </span>
        <span v-else class="training-idle">待机中</span>
        <span v-if="trainingStatus.speed" class="speed-mode">
          {{ trainingStatus.speed === 'low' ? '低速模式' : '高速模式' }}
        </span>
      </div>
    </div>
    
    <!-- 时间区 -->
    <div class="info-section">
      <div class="time-display">
        <span>时间 {{ currentTime }}</span>
      </div>
    </div>
  </header>
</template>

<script>
import StatusIndicator from './StatusIndicator.vue'

export default {
  name: 'StatusBar',
  components: {
    StatusIndicator
  },
  props: {
    patientInfo: {
      type: Object,
      required: true
    },
    deviceStatus: {
      type: Object,
      required: true
    },
    trainingStatus: {
      type: Object,
      required: true
    },
    currentTime: {
      type: String,
      required: true
    }
  },
  methods: {
    getStatusText(status) {
      const statusMap = {
        'connected': '已连接',
        'running': '运行中',
        'disconnected': '未连接',
        'stopped': '已停止',
        'error': '异常'
      }
      return statusMap[status] || '未知'
    },
    
    formatDuration(seconds) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
  }
}
</script>

<style scoped>
.status-bar {
  height: 80px;
  background-color: #2c3e50;
  color: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 18px;
  border-bottom: 2px solid #34495e;
}

.info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.patient-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.patient-name {
  font-weight: 600;
}

.patient-room {
  font-size: 16px;
  opacity: 0.9;
}

.device-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.training-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.training-active {
  color: #2ecc71;
  font-weight: 600;
}

.training-idle {
  color: #95a5a6;
}

.speed-mode {
  font-size: 16px;
  opacity: 0.9;
}

.time-display {
  text-align: right;
  font-size: 20px;
  font-weight: 600;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .status-bar {
    font-size: 16px;
    padding: 0 15px;
  }
  
  .device-item {
    font-size: 14px;
  }
  
  .time-display {
    font-size: 18px;
  }
}
</style>