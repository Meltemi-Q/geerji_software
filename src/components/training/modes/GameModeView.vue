<template>
  <div class="game-mode-view">
    <!-- 脑氧骑行游戏 -->
    <div class="game-section">
      <GameComponent
        :is-device-connected="isDeviceConnected"
        :collection-active="isDataActive"
        :current-values="currentValues"
        @exit-game="$emit('exit-game')"
        @coin-collected="onCoinCollected"
      />
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import GameComponent from './game/GameComponent.vue'
import { trainingCommon } from '../mixins/TrainingCommon.js'

export default {
  name: 'GameModeView',
  components: {
    GameComponent
  },
  props: {
    currentValues: {
      type: Object,
      required: true
    },
    hboData: {
      type: Array,
      default: () => []
    },
    hbrData: {
      type: Array,
      default: () => []
    }
  },
  emits: ['exit-game', 'coin-collected'],
  setup(props, { emit }) {
    // 使用共享逻辑
    const { formatValue } = trainingCommon()
    
    // 模拟设备连接状态（基于数据是否可用）
    const isDeviceConnected = computed(() => {
      return props.hboData && props.hboData.length > 0 && props.hbrData && props.hbrData.length > 0
    })
    
    // 模拟数据采集活跃状态
    const isDataActive = computed(() => {
      return props.currentValues && 
             (Math.abs(props.currentValues.avgHbO) > 0.01 || Math.abs(props.currentValues.avgHbR) > 0.01)
    })
    
    // 金币收集事件处理
    const onCoinCollected = (coinData) => {
      console.log(`[游戏模式] 金币收集: 得分 ${coinData.score}`)
      emit('coin-collected', coinData)
    }
    
    return {
      formatValue,
      isDeviceConnected,
      isDataActive,
      onCoinCollected
    }
  }
}
</script>

<style scoped>
.game-mode-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 游戏区域 */
.game-section {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-placeholder {
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 60px 40px;
}

.game-placeholder h3 {
  font-size: 28px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  margin-bottom: 15px;
}

.game-placeholder p {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>