<template>
  <div class="device-status-section">
    <div class="device-status-grid">
      <div class="status-item">
        <span class="status-icon" :class="getFnirsStatusClass()">●</span>
        <span class="status-text">fNIRS {{ getFnirsStatusText() }}</span>
      </div>
      <div class="status-item">
        <span class="status-icon" :class="getKangzhuxiaStatusClass()">●</span>
        <span class="status-text">康助侠 {{ getKangzhuxiaStatusText() }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { trainingCommon } from '../mixins/TrainingCommon.js'

export default {
  name: 'DeviceStatus',
  props: {
    deviceStatus: {
      type: Object,
      required: true
    },
    kangzhuxiaStatus: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const { getKangzhuxiaStatusText: getKangzhuxiaStatusFromCommon } = trainingCommon()

    // 获取fNIRS状态文本
    function getFnirsStatusText() {
      return props.deviceStatus?.fnirs === 'connected' ? '已连接' : '未连接'
    }

    // 获取fNIRS状态CSS类名
    function getFnirsStatusClass() {
      return props.deviceStatus?.fnirs === 'connected' ? 'status-connected' : 'status-disconnected'
    }

    // 获取康助侠状态文本
    function getKangzhuxiaStatusText() {
      return getKangzhuxiaStatusFromCommon(props.kangzhuxiaStatus)
    }

    // 获取康助侠状态CSS类名
    function getKangzhuxiaStatusClass() {
      if (!props.kangzhuxiaStatus?.connected) return 'status-disconnected'
      
      switch(props.kangzhuxiaStatus.motion_status) {
        case 0: return 'status-connected'
        case 1: return 'status-active'
        case 2: return 'status-paused'
        default: return 'status-connected'
      }
    }

    return {
      getFnirsStatusText,
      getFnirsStatusClass,
      getKangzhuxiaStatusText,
      getKangzhuxiaStatusClass
    }
  }
}
</script>

<style scoped>
.device-status-section {
  background: rgba(248, 249, 250, 0.8);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.device-status-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.status-icon {
  font-size: 16px;
  font-weight: bold;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.status-connected {
  color: #28a745;
}

.status-disconnected {
  color: #dc3545;
}

.status-active {
  color: #ffc107;
}

.status-paused {
  color: #17a2b8;
}
</style>