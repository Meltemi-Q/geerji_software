<template>
  <div class="game-container">
    <!-- 3D雪球游戏iframe -->
    <iframe
      ref="snowballFrame"
      src="/snowball-game/index.html"
      class="game-iframe"
      @load="onGameLoaded"
    ></iframe>

    <!-- 医疗UI覆盖层（保留原有数据显示） -->
    <GameDataDisplay
      :score="score"
      :oxygen-data="oxygenData"
      :game-speed="gameSpeed"
      :is-device-connected="isDeviceConnected"
      :collection-active="collectionActive"
      :current-speed="currentSpeed"
      @speed-change="handleSpeedChange"
    />

    <!-- 游戏说明（更新内容） -->
    <div class="game-instructions" v-if="showInstructions">
      <div class="instructions-content">
        <h3>🌍 3D金币收集游戏</h3>
        <p>• 使用 ← → 箭头键切换车道</p>
        <p>• 收集金币获得分数，享受爆炸特效</p>
        <p>• 血氧平衡影响游戏速度体验</p>
        <p>• 在蓝天草地上畅快滚动冒险</p>
        <button @click="startGame" class="start-button">开始游戏</button>
      </div>
    </div>

    <!-- 退出按钮（保留） -->
    <div class="exit-button" @click="handleExit">
      <span>退出游戏</span>
    </div>

    <!-- 提示弹窗（保留） -->
    <div v-if="showAlert" class="alert-modal">
      <div class="alert-content">
        <p>{{ alertMessage }}</p>
        <button @click="closeAlert">确定</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import GameDataDisplay from './GameDataDisplay.vue'

export default {
  name: 'GameComponent',
  components: { GameDataDisplay },
  props: {
    isDeviceConnected: {
      type: Boolean,
      default: false
    },
    collectionActive: {
      type: Boolean,
      default: false
    },
    nirsData: {
      type: Object,
      default: null
    },
    currentValues: {
      type: Object,
      default: () => ({
        avgHbO: 0.025,
        avgHbR: -0.015
      })
    }
  },
  emits: ['exit-game', 'coin-collected'],
  setup(props, { emit }) {
    // 游戏状态
    const showInstructions = ref(true)
    const gameSpeed = ref(5)
    const score = ref(0)
    const currentSpeed = ref('medium')

    // iframe引用
    const snowballFrame = ref(null)

    // 血氧数据（保留原有逻辑）
    const oxygenData = ref({
      leftFrontal: 65,
      rightFrontal: 68,
      timestamp: Date.now()
    })

    // 提示弹窗相关
    const showAlert = ref(false)
    const alertMessage = ref('')

    // iframe游戏加载完成
    const onGameLoaded = () => {
      console.log('🎮 3D金币游戏加载完成')
    }

    // 计算血氧影响的速度倍数
    const calculateSpeedMultiplier = (oxygenData) => {
      if (!oxygenData) return 1

      const leftFrontal = oxygenData.leftFrontal || 65
      const rightFrontal = oxygenData.rightFrontal || 68
      const difference = Math.abs(leftFrontal - rightFrontal)

      // 血氧差异越大，游戏速度越快（挑战性增加）
      if (difference > 15) {
        return 1.5 // 快速
      } else if (difference > 8) {
        return 1.2 // 中速
      } else {
        return 1.0 // 正常
      }
    }

    // 更新血氧数据
    const updateBrainOxygenData = () => {
      if (props.isDeviceConnected && props.collectionActive && props.currentValues) {
        try {
          const avgHbO = props.currentValues.avgHbO || 0.025
          const avgHbR = props.currentValues.avgHbR || -0.015

          // 转换为百分比显示
          const convertToPercentage = (value) => 65 + (value / 0.001) * 15

          const leftFrontal = Math.max(50, Math.min(85, convertToPercentage(avgHbO + (Math.random() - 0.5) * 0.0001)))
          const rightFrontal = Math.max(50, Math.min(85, convertToPercentage(avgHbO + (Math.random() - 0.5) * 0.0001)))

          oxygenData.value = {
            leftFrontal,
            rightFrontal,
            timestamp: Date.now(),
          }

          // 根据血氧差异调整游戏速度
          const oxyDifference = Math.abs(oxygenData.value.leftFrontal - oxygenData.value.rightFrontal)
          if (oxyDifference > 10) {
            gameSpeed.value = Math.min(9, gameSpeed.value + 0.1)
          } else {
            gameSpeed.value = Math.max(3, gameSpeed.value - 0.05)
          }

          // 发送血氧数据到iframe游戏
          if (snowballFrame.value && snowballFrame.value.contentWindow) {
            const speedMultiplier = calculateSpeedMultiplier(oxygenData.value)
            snowballFrame.value.contentWindow.postMessage({
              type: 'oxygen-data',
              speedMultiplier: speedMultiplier,
              oxygenData: oxygenData.value
            }, '*')
          }
        } catch (error) {
          console.error('更新血氧数据时出错:', error)
        }
      } else {
        // 模拟血氧数据
        oxygenData.value = {
          leftFrontal: Math.max(50, Math.min(85, oxygenData.value.leftFrontal + (Math.random() - 0.5) * 2)),
          rightFrontal: Math.max(50, Math.min(85, oxygenData.value.rightFrontal + (Math.random() - 0.5) * 2)),
          timestamp: Date.now(),
        }
      }
    }

    // 接收iframe游戏的消息
    const handleGameMessage = (event) => {
      if (event.data.type === 'score-update') {
        score.value = event.data.score
        console.log(`🏆 分数更新: ${score.value}`)
        emit('coin-collected', {
          score: event.data.score,
          timestamp: event.data.timestamp
        })
      }
    }

    // 键盘事件处理 - 转发到iframe游戏
    const handleKeyDown = (event) => {
      // 只处理游戏相关的按键：左箭头(37)、上箭头(38)、右箭头(39)
      if ([37, 38, 39].includes(event.keyCode)) {
        event.preventDefault() // 阻止默认行为

        // 转发键盘事件到iframe游戏
        if (snowballFrame.value && snowballFrame.value.contentWindow) {
          snowballFrame.value.contentWindow.postMessage({
            type: 'keydown',
            keyCode: event.keyCode
          }, '*')
          console.log('⌨️ 键盘事件已转发到游戏:', event.keyCode)
        }
      }
    }

    const showAlertMessage = (message) => {
      alertMessage.value = message
      showAlert.value = true
    }

    const closeAlert = () => {
      showAlert.value = false
    }

    const startGame = () => {
      showInstructions.value = false
      console.log('🚀 3D金币游戏开始!')
    }

    const handleExit = () => {
      // 通知iframe游戏退出
      if (snowballFrame.value && snowballFrame.value.contentWindow) {
        snowballFrame.value.contentWindow.postMessage({
          type: 'exit-game'
        }, '*')
      }
      emit('exit-game')
    }

    // 速度等级定义
    const speedLevels = {
      low: 0.003,
      medium: 0.006,
      high: 0.009
    }

    // 处理速度变化
    const handleSpeedChange = (level) => {
      currentSpeed.value = level
      console.log('🎮 切换游戏速度到:', level, speedLevels[level])

      // 发送速度变化消息到iframe游戏
      if (snowballFrame.value && snowballFrame.value.contentWindow) {
        snowballFrame.value.contentWindow.postMessage({
          type: 'speed-change',
          speed: speedLevels[level],
          level: level
        }, '*')
      }
    }

    // 监听血氧数据变化
    watch(() => props.currentValues, (newData) => {
      if (newData) {
        updateBrainOxygenData()
      }
    }, { deep: true })

    // 组件生命周期
    let dataUpdateLoop
    onMounted(() => {
      console.log('🎮 3D金币游戏组件初始化')

      // 监听iframe消息
      window.addEventListener('message', handleGameMessage)

      // 监听键盘事件并转发到游戏
      window.addEventListener('keydown', handleKeyDown)

      // 启动血氧数据更新循环
      dataUpdateLoop = setInterval(updateBrainOxygenData, 100) // 100ms更新一次
    })

    onUnmounted(() => {
      console.log('🎮 3D金币游戏组件清理')
      clearInterval(dataUpdateLoop)
      window.removeEventListener('message', handleGameMessage)
      window.removeEventListener('keydown', handleKeyDown)
    })

    return {
      // 状态
      showInstructions,
      gameSpeed,
      score,
      currentSpeed,
      oxygenData,
      showAlert,
      alertMessage,

      // refs
      snowballFrame,

      // 方法
      onGameLoaded,
      showAlertMessage,
      closeAlert,
      startGame,
      handleExit,
      handleSpeedChange,

      // computed
      isDeviceConnected: computed(() => props.isDeviceConnected),
      collectionActive: computed(() => props.collectionActive)
    }
  },
}
</script>

<style scoped>
.game-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #333;
}

/* 3D游戏iframe */
.game-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  z-index: 1;
  background-color: #333; /* 防止加载时闪白 */
}

/* 退出按钮（保留原样式） */
.exit-button {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: rgba(231, 76, 60, 0.9);
  color: white;
  border: 2px solid white;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  z-index: 9999;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.exit-button:hover {
  background-color: #c0392b;
  transform: translateY(-1px);
}

/* 提示弹窗（保留原样式） */
.alert-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
}

.alert-content {
  background-color: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  text-align: center;
  min-width: 300px;
}

.alert-content p {
  margin-bottom: 20px;
  font-size: 18px;
  color: #333;
}

.alert-content button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.alert-content button:hover {
  background-color: #2980b9;
}

/* 游戏说明（保留原样式） */
.game-instructions {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.instructions-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  max-width: 500px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  color: white;
}

.instructions-content h3 {
  margin-bottom: 25px;
  font-size: 28px;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.instructions-content p {
  margin-bottom: 16px;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
}

.start-button {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.start-button:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}
</style>