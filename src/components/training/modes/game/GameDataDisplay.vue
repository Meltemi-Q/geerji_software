<template>
  <div class="game-data-display">
    <!-- 得分显示 -->
    <div class="score-panel">
      <div class="score-icon">🏆</div>
      <div class="score-info">
        <div class="score-label">得分</div>
        <div class="score-value">{{ score }}</div>
      </div>
    </div>

    <!-- 血氧数据显示 -->
    <div class="oxygen-display">
      <div class="oxygen-item left-brain">
        <div class="brain-icon">🧠</div>
        <div class="oxygen-info">
          <div class="oxygen-label">左脑血氧</div>
          <div class="oxygen-value" :class="{ 'high': oxygenData.leftFrontal > 70 }">
            {{ oxygenData.leftFrontal.toFixed(1) }}%
          </div>
        </div>
      </div>
      <div class="oxygen-item right-brain">
        <div class="brain-icon">🧠</div>
        <div class="oxygen-info">
          <div class="oxygen-label">右脑血氧</div>
          <div class="oxygen-value" :class="{ 'high': oxygenData.rightFrontal > 70 }">
            {{ oxygenData.rightFrontal.toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏状态显示 -->
    <div class="game-status">
      <div class="status-item">
        <div class="status-icon">📊</div>
        <div class="status-info">
          <div class="status-label">游戏速度</div>
          <div class="status-value">{{ gameSpeed.toFixed(1) }}</div>
        </div>
      </div>
      <div class="status-item">
        <div class="status-icon">🎮</div>
        <div class="status-info">
          <div class="status-label">设备状态</div>
          <div class="status-value" :class="isDeviceConnected ? 'connected' : 'disconnected'">
            {{ isDeviceConnected ? '已连接' : '未连接' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GameDataDisplay',
  props: {
    score: {
      type: Number,
      default: 0
    },
    oxygenData: {
      type: Object,
      default: () => ({
        leftFrontal: 65,
        rightFrontal: 68,
        timestamp: Date.now()
      })
    },
    gameSpeed: {
      type: Number,
      default: 5
    },
    isDeviceConnected: {
      type: Boolean,
      default: false
    },
    collectionActive: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style scoped>
.game-data-display {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 15px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 得分显示 */
.score-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 215, 0, 0.6);
  border-radius: 15px;
  padding: 15px 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.score-icon {
  font-size: 24px;
}

.score-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.score-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.score-value {
  font-size: 24px;
  font-weight: bold;
  color: #FFD700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

/* 血氧数据显示 */
.oxygen-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oxygen-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 10px 15px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.brain-icon {
  font-size: 20px;
}

.oxygen-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.oxygen-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.oxygen-value {
  font-size: 16px;
  font-weight: bold;
  color: #00ff88;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.oxygen-value.high {
  color: #ff4444;
}

/* 游戏状态显示 */
.game-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 8px 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-icon {
  font-size: 16px;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.status-value {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.status-value.connected {
  color: #00ff88;
}

.status-value.disconnected {
  color: #ff6b6b;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .game-data-display {
    top: 10px;
    left: 10px;
    gap: 10px;
  }
  
  .score-panel {
    padding: 12px 16px;
  }
  
  .score-value {
    font-size: 20px;
  }
  
  .oxygen-value {
    font-size: 14px;
  }
}
</style>