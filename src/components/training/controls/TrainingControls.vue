<template>
  <div class="right-controls">
    <div class="controls-title">功能控制</div>
    <div class="controls-content">
      <!-- 设备状态显示 -->
      <DeviceStatus 
        :device-status="deviceStatus"
        :kangzhuxia-status="kangzhuxiaStatus" 
      />

      <!-- 训练控制按钮 -->
      <div class="control-buttons">
        <button 
          class="large-control-btn start-btn"
          :disabled="isTraining"
          @click="$emit('start-training')"
        >
          <svg width="32" height="32" class="control-icon-large">
            <polygon points="12,8 12,24 22,16" fill="currentColor"/>
          </svg>
          <span>开始训练</span>
        </button>
        
        <button 
          class="large-control-btn pause-btn"
          :disabled="!isTraining"
          @click="$emit('pause-training')"
        >
          <svg width="32" height="32" class="control-icon-large">
            <rect x="10" y="8" width="4" height="16" fill="currentColor"/>
            <rect x="18" y="8" width="4" height="16" fill="currentColor"/>
          </svg>
          <span>暂停训练</span>
        </button>
        
        <button 
          class="large-control-btn stop-btn"
          @click="$emit('stop-training')"
        >
          <svg width="32" height="32" class="control-icon-large">
            <rect x="8" y="8" width="16" height="16" fill="currentColor"/>
          </svg>
          <span>结束训练</span>
        </button>
        
        <button 
          v-if="!kangzhuxiaStatus.connected"
          class="large-control-btn connect-btn"
          @click="$emit('connect-kangzhuxia')"
        >
          <svg width="32" height="32" class="control-icon-large">
            <path d="M4 20V10L16 4l12 6V20l-12 6L4 20z" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="16" cy="14" r="3" fill="currentColor"/>
          </svg>
          <span>连接康助侠</span>
        </button>
        
        <button 
          v-else
          class="large-control-btn disconnect-btn"
          @click="$emit('disconnect-kangzhuxia')"
        >
          <svg width="32" height="32" class="control-icon-large">
            <path d="M4 20V10L16 4l12 6V20l-12 6L4 20z" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="3"/>
          </svg>
          <span>断开康助侠</span>
        </button>
        
        <!-- 紧急停止按钮 -->
        <button 
          class="large-emergency-btn"
          @click="$emit('emergency-stop')"
        >
          <svg width="32" height="32" class="emergency-icon-large">
            <polygon points="16,4 28,24 4,24" fill="currentColor"/>
            <text x="16" y="20" text-anchor="middle" font-size="12" fill="white" font-weight="bold">!</text>
          </svg>
          <span>紧急停止</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import DeviceStatus from './DeviceStatus.vue'

export default {
  name: 'TrainingControls',
  components: {
    DeviceStatus
  },
  props: {
    isTraining: {
      type: Boolean,
      default: false
    },
    deviceStatus: {
      type: Object,
      required: true
    },
    kangzhuxiaStatus: {
      type: Object,
      required: true
    }
  },
  emits: [
    'start-training',
    'pause-training', 
    'stop-training',
    'emergency-stop',
    'connect-kangzhuxia',
    'disconnect-kangzhuxia'
  ]
}
</script>

<style scoped>
.right-controls {
  width: clamp(160px, 15vw, 220px);
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  max-height: calc(100vh - 160px);
}

.controls-title {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  margin-bottom: 10px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.controls-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.large-control-btn, .large-emergency-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 1vh, 12px);
  padding: clamp(12px, 2vh, 24px) clamp(8px, 1vw, 16px);
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: #ffffff;
  font-size: clamp(13px, 1.5vh, 18px);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: clamp(60px, 8vh, 100px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.large-control-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.large-control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.start-btn:hover:not(:disabled) {
  background: rgba(39, 174, 96, 0.3);
  border-color: #27ae60;
}

.pause-btn:hover:not(:disabled) {
  background: rgba(255, 193, 7, 0.3);
  border-color: #ffc107;
}

.stop-btn:hover:not(:disabled) {
  background: rgba(231, 76, 60, 0.3);
  border-color: #e74c3c;
}

.connect-btn:hover {
  background: rgba(52, 152, 219, 0.3);
  border-color: #3498db;
}

.disconnect-btn:hover {
  background: rgba(149, 165, 166, 0.3);
  border-color: #95a5a6;
}

.large-emergency-btn {
  background: rgba(231, 76, 60, 0.2);
  border-color: rgba(231, 76, 60, 0.5);
  font-size: clamp(12px, 1.4vh, 16px);
  font-weight: 700;
  min-height: clamp(50px, 7vh, 90px);
  gap: clamp(3px, 0.8vh, 10px);
  padding: clamp(10px, 1.8vh, 20px) clamp(8px, 1vw, 16px);
  margin-top: 10px;
}

.large-emergency-btn:hover {
  background: rgba(231, 76, 60, 0.4);
  border-color: #e74c3c;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(231, 76, 60, 0.3);
}

.control-icon-large, .emergency-icon-large {
  flex-shrink: 0;
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  width: 32px;
  height: 32px;
}

/* ≤1365px断点：横向布局支持 */
@media (max-width: 1365px) {
  .right-controls {
    width: 100%;
    max-height: none;
    overflow-y: visible;
  }
  
  .control-buttons {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
  }
  
  .large-control-btn, .large-emergency-btn {
    flex: 1;
    min-width: 140px;
    max-width: 220px;
    min-height: clamp(50px, 6vh, 80px);
  }
}
</style>