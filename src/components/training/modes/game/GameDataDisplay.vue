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

    <!-- 速度控制 -->
    <div class="speed-control">
      <div class="speed-label">
        <div class="control-icon">⚡</div>
        <span>游戏速度</span>
      </div>
      <div class="speed-buttons">
        <button
          @click="$emit('speed-change', 'low')"
          :class="{ active: currentSpeed === 'low' }"
          class="speed-btn speed-low">
          低速
        </button>
        <button
          @click="$emit('speed-change', 'medium')"
          :class="{ active: currentSpeed === 'medium' }"
          class="speed-btn speed-medium">
          中速
        </button>
        <button
          @click="$emit('speed-change', 'high')"
          :class="{ active: currentSpeed === 'high' }"
          class="speed-btn speed-high">
          高速
        </button>
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
    },
    currentSpeed: {
      type: String,
      default: 'medium'
    }
  },
  emits: ['speed-change']
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

/* 速度控制 */
.speed-control {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.speed-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
}

.control-icon {
  font-size: 14px;
}

.speed-buttons {
  display: flex;
  gap: 6px;
}

.speed-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(5px);
}

.speed-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  transform: translateY(-1px);
}

.speed-btn.active {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border-color: #4facfe;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(79, 172, 254, 0.3);
}

.speed-low.active {
  background: linear-gradient(135deg, #81c784 0%, #4caf50 100%);
  border-color: #4caf50;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.speed-high.active {
  background: linear-gradient(135deg, #ff7043 0%, #f44336 100%);
  border-color: #f44336;
  box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
}
</style>