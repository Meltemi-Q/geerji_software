<template>
  <svg width="12" height="12" class="status-indicator">
    <circle 
      cx="6" 
      cy="6" 
      r="5" 
      :fill="getStatusColor(status)"
      :class="{'pulse': status === 'running'}"
    />
  </svg>
</template>

<script>
export default {
  name: 'StatusIndicator',
  props: {
    status: {
      type: String,
      required: true
    }
  },
  methods: {
    getStatusColor(status) {
      const colorMap = {
        'connected': '#27ae60',    // 绿色
        'running': '#27ae60',      // 绿色
        'disconnected': '#e74c3c', // 红色
        'stopped': '#f39c12',      // 橙色
        'error': '#e74c3c',        // 红色
        'standby': '#95a5a6'       // 灰色
      }
      return colorMap[status] || '#95a5a6'
    }
  }
}
</script>

<style scoped>
.status-indicator {
  flex-shrink: 0;
}

.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}
</style>