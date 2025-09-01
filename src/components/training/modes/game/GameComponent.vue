<template>
  <div class="game-container">
    <!-- 视频背景 -->
    <video
      ref="videoPlayer"
      :src="currentVideo"
      autoplay
      loop
      muted
      class="video-background"
      :class="{ 'transitioning': isTransitioning }"
      :playbackRate="videoPlaybackRate"
      @ended="handleVideoEnded"
      @error="handleVideoError"
      @canplay="handleVideoCanPlay"
    ></video>

    <!-- 车把手覆盖层 -->
    <div class="handlebar" :style="handlebarStyle">
      <img :src="currentHandlebarImage" alt="Handlebar" @error="handleImageError" />
    </div>

    <!-- 金币 -->
    <div
      v-for="coin in visibleCoins"
      :key="coin.id"
      class="coin"
      :class="{ 'collected': coin.collected }"
      :style="getCoinStyle(coin)"
      @animationend="onCoinCollected(coin.id)"
    ></div>

    <!-- 游戏数据显示 -->
    <GameDataDisplay
      :score="score"
      :oxygen-data="oxygenData"
      :game-speed="gameSpeed"
      :is-device-connected="isDeviceConnected"
      :collection-active="collectionActive"
    />
    
    <!-- 游戏说明（仅首次显示） -->
    <div class="game-instructions" v-if="showInstructions">
      <div class="instructions-content">
        <h3>🚴‍♂️ 脑氧骑行游戏</h3>
        <p>• 使用 ← → 箭头键控制方向</p>
        <p>• 收集路径上的金币获得分数</p>
        <p>• 血氧数据会影响游戏体验</p>
        <p>• 保持平衡的脑活动获得最佳表现</p>
        <button @click="startGame" class="start-button">开始游戏</button>
      </div>
    </div>

    <!-- 退出按钮 -->
    <div class="exit-button" @click="handleExit">
      <span>退出游戏</span>
    </div>

    <!-- 提示弹窗 -->
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
    
    // 血氧数据
    const oxygenData = ref({
      leftFrontal: 65,
      rightFrontal: 68,
      timestamp: Date.now()
    })

    // 提示弹窗相关
    const showAlert = ref(false)
    const alertMessage = ref('')
    
    // 视频相关
    const videoPlayer = ref(null)
    const currentVideoState = ref('straight')
    const isTransitioning = ref(false)
    
    // 视频资源路径
    const videoSources = {
      'straight': new URL('../../../../assets/videos/straight.mp4', import.meta.url).href,
      'left-turn': new URL('../../../../assets/videos/left_turn.mp4', import.meta.url).href,
      'right-turn': new URL('../../../../assets/videos/right_turn.mp4', import.meta.url).href,
      'left-straight': new URL('../../../../assets/videos/left_straight.mp4', import.meta.url).href,
      'right-straight': new URL('../../../../assets/videos/right_straight.mp4', import.meta.url).href,
      'left-to-center': new URL('../../../../assets/videos/left_to_center.mp4', import.meta.url).href,
      'right-to-center': new URL('../../../../assets/videos/right_to_center.mp4', import.meta.url).href
    }
    
    const videoStates = {
      STRAIGHT: 'straight',
      LEFT_TURN: 'left-turn',
      RIGHT_TURN: 'right-turn',
      LEFT_STRAIGHT: 'left-straight',
      RIGHT_STRAIGHT: 'right-straight',
      LEFT_TO_CENTER: 'left-to-center',
      RIGHT_TO_CENTER: 'right-to-center'
    }

    const currentVideo = computed(() => videoSources[currentVideoState.value])
    const videoPlaybackRate = computed(() => {
      const baseRate = 1.0
      const speedFactor = gameSpeed.value / 5.0 // 正常速度为5
      return Math.max(0.5, Math.min(1.5, baseRate * speedFactor))
    })

    // 车把手相关
    const windowWidth = ref(window.innerWidth)
    const windowHeight = ref(window.innerHeight)
    const keyboard = ref({
      ArrowLeft: false,
      ArrowRight: false
    })

    const currentHandlebarImage = computed(() => {
      try {
        if (keyboard.value.ArrowLeft) {
          return new URL('../../../../assets/game/handler_left.png', import.meta.url).href
        } else if (keyboard.value.ArrowRight) {
          return new URL('../../../../assets/game/handler_right.png', import.meta.url).href
        } else {
          return new URL('../../../../assets/game/handler_center.png', import.meta.url).href
        }
      } catch (error) {
        console.warn('车把手图片加载失败，使用占位符')
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiIGZpbGw9IiM2NjYiLz48L3N2Zz4='
      }
    })

    const handlebarStyle = computed(() => {
      let rotation = 0
      if (currentVideoState.value === 'left-turn' || currentVideoState.value === 'left-to-center') {
        rotation = -5
      } else if (currentVideoState.value === 'right-turn' || currentVideoState.value === 'right-to-center') {
        rotation = 5
      }

      return {
        width: `${windowWidth.value * 0.55}px`,
        bottom: '0%',
        left: '48%',
        transform: `translateX(-50%) rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4))',
      }
    })

    // 金币系统
    const coins = ref([])
    const coinIdCounter = ref(0)
    const visibleCoins = computed(() => coins.value.filter(coin => coin.position.z >= 0 && coin.position.z <= 100))

    const generateCoin = () => {
      const trajectory = Math.random() < 0.5 ? 'left' : 'right'
      coins.value.push({
        id: coinIdCounter.value++,
        trajectory,
        position: { z: 0 },
        collected: false,
      })
    }

    const getCoinStyle = (coin) => {
      const zPos = coin.position.z
      const scale = 0.2 + (zPos / 100) * 0.8

      // 基础位置（地平线处）
      let xPosBase = coin.trajectory === 'left' ? 46.5 : 48.5
      const divergence = (zPos / 100) * 45 // 基础发散角度
      let xPos = coin.trajectory === 'left'
        ? xPosBase - divergence 
        : xPosBase + divergence

      // 根据当前视频状态调整曲率
      let curveOffset = 0
      
      // 左转状态 - 强烈向左弯曲
      if (currentVideoState.value === videoStates.LEFT_TURN) {
        // 转弯过程中，曲率随视频播放进度变化
        const progress = videoPlayer.value ? 
          Math.min(1, videoPlayer.value.currentTime / videoPlayer.value.duration) : 0
        curveOffset = (100 - zPos) * -0.15 * progress
      } 
      // 左直行状态 - 保持左偏
      else if (currentVideoState.value === videoStates.LEFT_STRAIGHT) {
        curveOffset = (100 - zPos) * -0.15 // 保持固定左偏
      }
      // 左回中状态 - 逐渐减小左偏
      else if (currentVideoState.value === videoStates.LEFT_TO_CENTER) {
        const progress = videoPlayer.value ? 
          Math.min(1, videoPlayer.value.currentTime / videoPlayer.value.duration) : 0
        curveOffset = (100 - zPos) * -0.15 * (1 - progress) // 从左偏逐渐回中
      }
      // 右转状态 - 强烈向右弯曲
      else if (currentVideoState.value === videoStates.RIGHT_TURN) {
        const progress = videoPlayer.value ? 
          Math.min(1, videoPlayer.value.currentTime / videoPlayer.value.duration) : 0
        curveOffset = (100 - zPos) * 0.15 * progress
      }
      // 右直行状态 - 保持右偏
      else if (currentVideoState.value === videoStates.RIGHT_STRAIGHT) {
        curveOffset = (100 - zPos) * 0.15 // 保持固定右偏
      }
      // 右回中状态 - 逐渐减小右偏
      else if (currentVideoState.value === videoStates.RIGHT_TO_CENTER) {
        const progress = videoPlayer.value ? 
          Math.min(1, videoPlayer.value.currentTime / videoPlayer.value.duration) : 0
        curveOffset = (100 - zPos) * 0.15 * (1 - progress) // 从右偏逐渐回中
      }
      
      // 应用曲率偏移
      xPos += curveOffset

      // Y位置计算（不变）
      const yPos = 44 + (zPos / 100) * 40
      
      return {
        left: `${xPos}%`,
        top: `${yPos}%`,
        width: `${windowWidth.value * 0.05 * scale}px`,
        height: `${windowWidth.value * 0.05 * scale}px`,
        zIndex: Math.floor(20 + zPos),
      }
    }

    const checkCoinCollisions = () => {
      coins.value.forEach(coin => {
        if (coin.collected) return
        if (coin.position.z > 80) {
          if (
            (coin.trajectory === 'left' && 
              (currentVideoState.value === videoStates.LEFT_TURN || 
               currentVideoState.value === videoStates.LEFT_STRAIGHT)) ||
            (coin.trajectory === 'right' && 
              (currentVideoState.value === videoStates.RIGHT_TURN || 
               currentVideoState.value === videoStates.RIGHT_STRAIGHT))
          ) {
            coin.collected = true
            score.value += 10
            emit('coin-collected', { score: score.value, timestamp: Date.now() })
          }
        }
      })
    }

    const onCoinCollected = (id) => {
      const index = coins.value.findIndex(c => c.id === id)
      if (index !== -1) coins.value.splice(index, 1)
    }

    // 游戏循环
    const animate = () => {
      if (showInstructions.value) {
        requestAnimationFrame(animate)
        return
      }

      coins.value.forEach(coin => {
        if (!coin.collected) {
          let speedMultiplier = 1
          if (currentVideoState.value === 'left-turn' && coin.trajectory === 'left') {
            speedMultiplier = 1.2
          } else if (currentVideoState.value === 'right-turn' && coin.trajectory === 'right') {
            speedMultiplier = 1.2
          }
          coin.position.z += gameSpeed.value * 0.3 * speedMultiplier
        }
      })
      coins.value = coins.value.filter(coin => coin.position.z <= 120 || coin.collected)
      checkCoinCollisions()

      if (Math.random() < 0.006 * gameSpeed.value) generateCoin()

      requestAnimationFrame(animate)
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

    // 键盘控制
    const handleKeyDown = (e) => {
      if (isTransitioning.value || showInstructions.value) return
      
      if (e.key === 'ArrowLeft') {
        keyboard.value.ArrowLeft = true
        
        if (currentVideoState.value === videoStates.STRAIGHT) {
          switchVideo(videoStates.LEFT_TURN)
        }
        else if (currentVideoState.value === videoStates.RIGHT_STRAIGHT) {
          switchVideo(videoStates.RIGHT_TO_CENTER)
        }
      } 
      else if (e.key === 'ArrowRight') {
        keyboard.value.ArrowRight = true
        
        if (currentVideoState.value === videoStates.STRAIGHT) {
          switchVideo(videoStates.RIGHT_TURN)
        }
        else if (currentVideoState.value === videoStates.LEFT_STRAIGHT) {
          switchVideo(videoStates.LEFT_TO_CENTER)
        }
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft') {
        keyboard.value.ArrowLeft = false
        
        if (currentVideoState.value === videoStates.LEFT_STRAIGHT && !keyboard.value.ArrowRight) {
          switchVideo(videoStates.LEFT_TO_CENTER)
        }
      } 
      else if (e.key === 'ArrowRight') {
        keyboard.value.ArrowRight = false
        
        if (currentVideoState.value === videoStates.RIGHT_STRAIGHT && !keyboard.value.ArrowLeft) {
          switchVideo(videoStates.RIGHT_TO_CENTER)
        }
      }
    }

    // 视频切换
    const switchVideo = (newState) => {
      if (currentVideoState.value === newState || isTransitioning.value) return
      
      console.log(`[游戏] 切换视频: ${currentVideoState.value} -> ${newState}`)
      isTransitioning.value = true
      
      currentVideoState.value = newState
      
      if (videoPlayer.value) {
        videoPlayer.value.style.opacity = '0'
        
        setTimeout(() => {
          videoPlayer.value.src = videoSources[newState]
          videoPlayer.value.currentTime = 0
          
          // 设置循环播放属性
          videoPlayer.value.loop = (
            newState === videoStates.STRAIGHT || 
            newState === videoStates.LEFT_STRAIGHT || 
            newState === videoStates.RIGHT_STRAIGHT
          )
          
          videoPlayer.value.load()
          videoPlayer.value.playbackRate = videoPlaybackRate.value
          
          const playPromise = videoPlayer.value.play()
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                videoPlayer.value.style.opacity = '1'
                setTimeout(() => {
                  isTransitioning.value = false
                }, 250)
              })
              .catch(error => {
                console.error('视频播放失败:', error)
                isTransitioning.value = false
                videoPlayer.value.muted = true
                if (newState === videoStates.STRAIGHT || 
                    newState === videoStates.LEFT_STRAIGHT || 
                    newState === videoStates.RIGHT_STRAIGHT) {
                  videoPlayer.value.loop = true
                }
                videoPlayer.value.play().catch(() => {
                  console.error('重试播放失败')
                })
              })
          } else {
            videoPlayer.value.style.opacity = '1'
            setTimeout(() => {
              isTransitioning.value = false
            }, 250)
          }
        }, 250)
      }
    }

    // 处理视频结束事件
    const handleVideoEnded = () => {
      if (isTransitioning.value) return
      
      console.log(`[游戏] 视频播放结束: ${currentVideoState.value}`)
      
      if (currentVideoState.value === videoStates.LEFT_TURN) {
        if (keyboard.value.ArrowLeft) {
          switchVideo(videoStates.LEFT_STRAIGHT)
        } else {
          switchVideo(videoStates.STRAIGHT)
        }
      } 
      else if (currentVideoState.value === videoStates.RIGHT_TURN) {
        if (keyboard.value.ArrowRight) {
          switchVideo(videoStates.RIGHT_STRAIGHT)
        } else {
          switchVideo(videoStates.STRAIGHT)
        }
      } 
      else if (currentVideoState.value === videoStates.LEFT_TO_CENTER) {
        if (keyboard.value.ArrowRight) {
          switchVideo(videoStates.RIGHT_TURN)
        } else if (keyboard.value.ArrowLeft) {
          switchVideo(videoStates.LEFT_TURN)
        } else {
          switchVideo(videoStates.STRAIGHT)
        }
      } 
      else if (currentVideoState.value === videoStates.RIGHT_TO_CENTER) {
        if (keyboard.value.ArrowLeft) {
          switchVideo(videoStates.LEFT_TURN)
        } else if (keyboard.value.ArrowRight) {
          switchVideo(videoStates.RIGHT_TURN)
        } else {
          switchVideo(videoStates.STRAIGHT)
        }
      }
    }

    const handleVideoError = (e) => {
      console.error('视频加载失败:', currentVideo.value, e)
      showAlertMessage('视频加载失败，请检查网络连接')
    }

    const handleImageError = (e) => {
      console.error('图片加载失败:', currentHandlebarImage.value, e)
    }

    const handleVideoCanPlay = () => {
      if (videoPlayer.value && videoPlayer.value.paused) {
        videoPlayer.value.play().catch(error => {
          console.error('视频播放失败:', error)
        })
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
    }

    const handleExit = () => {
      emit('exit-game')
    }

    // 窗口大小变化
    const handleResize = () => {
      windowWidth.value = window.innerWidth
      windowHeight.value = window.innerHeight
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
      console.log('[游戏组件] 初始化完成')
      
      if (videoPlayer.value) {
        videoPlayer.value.loop = true
        videoPlayer.value.muted = true
        videoPlayer.value.play().catch(err => {
          console.error('初始视频播放失败:', err)
          setTimeout(() => {
            videoPlayer.value.play().catch(error => 
              console.error('重试初始视频播放失败:', error)
            )
          }, 500)
        })
      }
      
      requestAnimationFrame(animate)
      dataUpdateLoop = setInterval(updateBrainOxygenData, 50)
      
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      window.addEventListener('resize', handleResize)
    })

    onUnmounted(() => {
      console.log('[游戏组件] 清理资源')
      clearInterval(dataUpdateLoop)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('resize', handleResize)
    })

    return {
      showInstructions,
      gameSpeed,
      score,
      oxygenData,
      videoPlayer,
      currentVideo,
      videoPlaybackRate,
      isTransitioning,
      currentHandlebarImage,
      handlebarStyle,
      visibleCoins,
      getCoinStyle,
      onCoinCollected,
      handleVideoEnded,
      handleVideoError,
      handleImageError,
      handleVideoCanPlay,
      showAlert,
      alertMessage,
      showAlertMessage,
      closeAlert,
      startGame,
      handleExit,
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

.video-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
  transition: opacity 0.2s ease-in-out;
  background-color: #333;
  transform: translateZ(0);
  will-change: opacity;
}

.video-background.transitioning {
  opacity: 0;
}

.handlebar {
  position: absolute;
  z-index: 2;
}

.handlebar img {
  width: 100%;
  height: auto;
  opacity: 0.95;
}

.coin {
  position: absolute;
  background-image: url('../../../../assets/images/coin.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  z-index: 3;
}

.coin.collected {
  animation: collect 0.3s forwards;
}

@keyframes collect {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

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