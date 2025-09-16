<template>
  <footer class="control-panel">
    <!-- 训练过程中的控制面板 -->
    <div v-if="appState === 'training'" class="training-controls">
      <!-- 设备状态信息 -->
      <div class="device-info">
        <div class="info-item">
          <StatusIndicator :status="deviceStatus.fnirs" />
          <span>fNIRS设备: {{ getStatusText(deviceStatus.fnirs) }}</span>
        </div>
        <div class="info-item">
          <StatusIndicator :status="deviceStatus.kangzhuxia" />
          <span>康复器械设备: {{ getStatusText(deviceStatus.kangzhuxia) }} 低速模式</span>
        </div>
        <div class="info-item">
          <span class="info-label">数据质量: </span>
          <span class="info-value good">良好</span>
        </div>
        <div class="info-item">
          <span class="info-label">会话时长: </span>
          <span class="info-value">{{ formatDuration(trainingStatus.duration) }}</span>
        </div>
      </div>
      
      <!-- 训练控制按钮 -->
      <div class="button-group">
        <button 
          class="control-btn start-btn"
          @click="$emit('start-training')"
          :disabled="trainingStatus.isTraining"
        >
          开始训练
        </button>
        <button 
          class="control-btn pause-btn"
          @click="$emit('pause-training')"
          :disabled="!trainingStatus.isTraining"
        >
          暂停
        </button>
        <button 
          class="control-btn stop-btn"
          @click="$emit('stop-training')"
        >
          结束训练
        </button>
        <button 
          class="control-btn emergency-btn"
          @click="$emit('emergency-stop')"
        >
          紧急停止
        </button>
      </div>
    </div>
    
    <!-- 评估界面的控制面板 -->
    <div v-else-if="appState === 'assessment'" class="assessment-controls">
      <div class="button-group assessment-buttons">
        <button 
          class="control-btn save-btn primary"
          @click="$emit('save-record')"
        >
          保存训练记录
        </button>
        <button 
          class="control-btn new-training-btn"
          @click="$emit('new-training')"
        >
          开始新训练
        </button>
        <button 
          class="control-btn history-btn"
          @click="viewHistory"
        >
          查看历史
        </button>
        <button 
          class="control-btn settings-btn secondary"
          @click="openSettings"
        >
          系统设置
        </button>
      </div>
    </div>
    
    <!-- 待机状态的控制面板 -->
    <div v-else class="standby-controls">
      <div class="system-info">
        <span>系统就绪 - 等待开始训练</span>
      </div>
    </div>
  </footer>
</template>

<script>
import StatusIndicator from './StatusIndicator.vue'

export default {
  name: 'ControlPanel',
  components: {
    StatusIndicator
  },
  props: {
    appState: {
      type: String,
      required: true
    },
    deviceStatus: {
      type: Object,
      required: true
    },
    trainingStatus: {
      type: Object,
      default: () => ({
        isTraining: false,
        duration: 0
      })
    }
  },
  emits: [
    'start-training',
    'pause-training', 
    'stop-training',
    'emergency-stop',
    'save-record',
    'new-training'
  ],
  methods: {
    getStatusText(status) {
      const statusMap = {
        'connected': '连接正常',
        'running': '运行中',
        'disconnected': '未连接',
        'stopped': '已停止',
        'error': '异常'
      }
      return statusMap[status] || '未知'
    },
    
    formatDuration(seconds) {
      const hrs = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      
      if (hrs > 0) {
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    },
    
    viewHistory() {
      console.log('查看历史记录')
      // TODO: 实现历史记录功能
    },
    
    openSettings() {
      console.log('打开系统设置')
      // TODO: 实现系统设置功能
    }
  }
}
</script>

<style scoped>
.control-panel {
  height: 200px;
  background-color: #34495e;
  color: #ffffff;
  display: flex;
  align-items: center;
  padding: 20px;
  border-top: 2px solid #2c3e50;
}

.training-controls {
  display: flex;
  width: 100%;
  gap: 40px;
  align-items: center;
}

.device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
}

.info-label {
  opacity: 0.8;
}

.info-value {
  font-weight: 600;
}

.info-value.good {
  color: #2ecc71;
}

.button-group {
  display: flex;
  gap: 15px;
  align-items: center;
}

.control-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;
  height: 50px;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.start-btn {
  background-color: #27ae60;
  color: #ffffff;
}

.start-btn:not(:disabled):hover {
  background-color: #2ecc71;
}

.pause-btn {
  background-color: #f39c12;
  color: #ffffff;
}

.pause-btn:not(:disabled):hover {
  background-color: #e67e22;
}

.stop-btn {
  background-color: #3498db;
  color: #ffffff;
}

.stop-btn:not(:disabled):hover {
  background-color: #2980b9;
}

.emergency-btn {
  background-color: #e74c3c;
  color: #ffffff;
  min-width: 120px;
  animation: pulse 2s infinite;
}

.emergency-btn:hover {
  background-color: #c0392b;
  animation: none;
}

.assessment-controls {
  width: 100%;
  display: flex;
  justify-content: center;
}

.assessment-buttons {
  gap: 20px;
}

.save-btn.primary {
  background-color: #27ae60;
  color: #ffffff;
  font-size: 18px;
  padding: 15px 35px;
  min-width: 180px;
}

.new-training-btn {
  background-color: #3498db;
  color: #ffffff;
}

.history-btn {
  background-color: #95a5a6;
  color: #ffffff;
}

.settings-btn.secondary {
  background-color: #7f8c8d;
  color: #ffffff;
  font-size: 14px;
  padding: 10px 20px;
  min-width: 80px;
  height: 40px;
}

.standby-controls {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.system-info {
  font-size: 18px;
  opacity: 0.8;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .training-controls {
    flex-direction: column;
    gap: 20px;
  }
  
  .device-info {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 20px;
  }
  
  .button-group {
    width: 100%;
    justify-content: center;
  }
  
  .assessment-buttons {
    flex-wrap: wrap;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .control-panel {
    height: auto;
    min-height: 200px;
    padding: 15px;
  }
  
  .control-btn {
    font-size: 14px;
    padding: 10px 16px;
    min-width: 80px;
  }
  
  .button-group {
    gap: 10px;
  }
}
</style>