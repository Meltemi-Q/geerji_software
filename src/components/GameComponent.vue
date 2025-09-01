<template>
  <div class="game-container">
    <!-- Video Background -->
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

    <!-- Handlebar Overlay -->
    <div class="handlebar" :style="handlebarStyle">
      <img :src="currentHandlebarImage" alt="Handlebar" @error="handleImageError" />
    </div>

    <!-- Coins -->
    <div
      v-for="coin in visibleCoins"
      :key="coin.id"
      class="coin"
      :class="{ 'collected': coin.collected }"
      :style="getCoinStyle(coin)"
      @animationend="onCoinCollected(coin.id)"
    ></div>

    <!-- Data Display -->
    <div class="game-hud">
      <div class="hud-top">
        <div class="score-display">
          <span class="score-label">得分:</span>
          <span class="score-value">{{ score }}</span>
        </div>
        <div class="oxygen-display">
          <div class="oxygen-item">
            <span class="oxygen-label">左侧血氧:</span>
            <span class="oxygen-value" :class="{ 'high': oxygenData.leftFrontal > 70 }">
              {{ oxygenData.leftFrontal.toFixed(1) }}%
            </span>
          </div>
          <div class="oxygen-item">
            <span class="oxygen-label">右侧血氧:</span>
            <span class="oxygen-value" :class="{ 'high': oxygenData.rightFrontal > 70 }">
              {{ oxygenData.rightFrontal.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
      
      <div class="hud-bottom">
        <div class="device-status">
          <span class="status-label">设备状态:</span>
          <span :class="['status-indicator', isDeviceConnected ? 'connected' : 'disconnected']">
            {{ isDeviceConnected ? '已连接' : '未连接' }}
          </span>
        </div>
        <div class="collection-status">
          <span class="status-label">数据采集:</span>
          <span :class="['status-indicator', collectionActive ? 'active' : 'inactive']">
            {{ collectionActive ? '进行中' : '未开始' }}
          </span>
        </div>
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

    <!-- 游戏说明 -->
    <div class="game-instructions" v-if="showInstructions">
      <div class="instructions-content">
        <h3>游戏说明</h3>
        <p>使用左右箭头键控制方向</p>
        <p>收集路径上的金币获得分数</p>
        <p>血氧数据实时显示</p>
        <button @click="showInstructions = false">开始游戏</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

export default {
  name: 'GameComponent',
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
    }
  },
  emits: ['exit-game', 'coin-collected'],
  setup(props, { emit }) {
    // 游戏状态
    const showInstructions = ref(true)
    const gameSpeed = ref(5)
    const score = ref(0)
    const cyclistState = ref('straight')
    
    // 模拟踏板数据
    const pedalingData = ref({
      rpm: 60,
      resistance: 5,
    })
    
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
      'straight': new URL('../assets/videos/straight.mp4', import.meta.url).href,
      'left-turn': new URL('../assets/videos/left_turn.mp4', import.meta.url).href,
      'right-turn': new URL('../assets/videos/right_turn.mp4', import.meta.url).href,
      'left-straight': new URL('../assets/videos/left_straight.mp4', import.meta.url).href,
      'right-straight': new URL('../assets/videos/right_straight.mp4', import.meta.url).href,
      'left-to-center': new URL('../assets/videos/left_to_center.mp4', import.meta.url).href,
      'right-to-center': new URL('../assets/videos/right_to_center.mp4', import.meta.url).href
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
      const rpm = pedalingData.value.rpm
      return Math.max(0.5, Math.min(1.5, rpm / 60))
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
        // 根据按键状态决定车把手图片
        if (keyboard.value.ArrowLeft) {
          return new URL('../assets/handler_left.png', import.meta.url).href
        } else if (keyboard.value.ArrowRight) {
          return new URL('../assets/handler_right.png', import.meta.url).href
        } else {
          return new URL('../assets/handler_center.png', import.meta.url).href
        }
      } catch (error) {
        // 如果资源加载失败，返回SVG占位符
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

      // 调整车把手大小和位置，使其更适中
      return {
        width: `${windowWidth.value * 0.35}px`,  // 从0.55减少到0.35，减小车把手
        bottom: '8%',    // 从0%改为8%，稍微往上移，避免贴底部
        left: '50%',     // 从48%改为50%，更居中
        transform: `translateX(-50%) rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5))',  // 调整阴影强度
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

      let xPosBase = coin.trajectory === 'left' ? 46.5 : 48.5
      const divergence = (zPos / 100) * 45
      let xPos = coin.trajectory === 'left'
        ? xPosBase - divergence 
        : xPosBase + divergence

      // 根据视频状态调整曲率
      let curveOffset = 0
      
      if (currentVideoState.value === videoStates.LEFT_TURN) {
        curveOffset = (100 - zPos) * -0.15
      } else if (currentVideoState.value === videoStates.RIGHT_TURN) {
        curveOffset = (100 - zPos) * 0.15
      }
      
      xPos += curveOffset
      const yPos = 44 + (zPos / 100) * 40
      
      return {
        left: `${xPos}%`,
        top: `${yPos}%`,
        width: `${windowWidth.value * 0.05 * scale}px`,
        height: `${windowWidth.value * 0.05 * scale}px`,
        zIndex: Math.floor(20 + zPos),
        backgroundColor: '#FFD700', // 金色
        borderRadius: '50%',
        border: '2px solid #FFA500'
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
      gameSpeed.value = Math.max(3, Math.min(9, pedalingData.value.rpm / 10))

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
      if (props.isDeviceConnected && props.collectionActive && props.nirsData) {
        try {
          const hboData = props.nirsData.hboData
          const hbrData = props.nirsData.hbrData
          
          if (Array.isArray(hboData) && hboData.length > 1 && Array.isArray(hbrData) && hbrData.length > 1) {
            const getRecentValues = (data, channelIndex, frameCount = 5) => {
              if (Array.isArray(data[channelIndex]) && data[channelIndex].length > 0) {
                const recentValues = data[channelIndex].slice(-frameCount)
                return recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length
              }
              return 0
            }
            
            const leftChannel = 0
            const rightChannel = 1
            const leftHbO = getRecentValues(hboData, leftChannel)
            const rightHbO = getRecentValues(hboData, rightChannel)
            
            // 转换为百分比显示
            const convertToPercentage = (value) => 65 + (value / 1e-5) * 15
            
            oxygenData.value = {
              leftFrontal: Math.max(50, Math.min(85, convertToPercentage(leftHbO))),
              rightFrontal: Math.max(50, Math.min(85, convertToPercentage(rightHbO))),
              timestamp: Date.now(),
            }
            
            // 根据血氧差异调整游戏速度
            const oxyDifference = Math.abs(oxygenData.value.leftFrontal - oxygenData.value.rightFrontal)
            if (oxyDifference > 10) {
              gameSpeed.value = Math.min(9, gameSpeed.value + 0.1)
            }
          }
        } catch (error) {
          console.error('更新血氧数据时出错:', error)
        }
      }
    }

    // 模拟数据更新
    const updateDeviceData = () => {
      if (props.isDeviceConnected && props.collectionActive) {
        updateBrainOxygenData()
        return
      }
      
      // 模拟数据
      pedalingData.value.rpm = Math.max(30, Math.min(90, pedalingData.value.rpm + (Math.random() - 0.5) * 5))
      oxygenData.value = {
        leftFrontal: Math.max(50, Math.min(85, oxygenData.value.leftFrontal + (Math.random() - 0.5) * 2)),
        rightFrontal: Math.max(50, Math.min(85, oxygenData.value.rightFrontal + (Math.random() - 0.5) * 2)),
        timestamp: Date.now(),
      }
    }

    // 键盘控制 - 恢复完整的原始逻辑
    const handleKeyDown = (e) => {
      if (isTransitioning.value) return  // 过渡期间不响应按键
      
      if (e.key === 'ArrowLeft') {
        keyboard.value.ArrowLeft = true
        
        // 根据当前状态决定下一个视频
        if (currentVideoState.value === videoStates.STRAIGHT) {
          // 直行状态按左键 -> 左转
          switchVideo(videoStates.LEFT_TURN)
        }
        else if (currentVideoState.value === videoStates.RIGHT_STRAIGHT) {
          // 右直行按左键 -> 右回中
          switchVideo(videoStates.RIGHT_TO_CENTER)
        }
        // 其他状态不响应
      } 
      else if (e.key === 'ArrowRight') {
        keyboard.value.ArrowRight = true
        
        // 根据当前状态决定下一个视频
        if (currentVideoState.value === videoStates.STRAIGHT) {
          // 直行状态按右键 -> 右转
          switchVideo(videoStates.RIGHT_TURN)
        }
        else if (currentVideoState.value === videoStates.LEFT_STRAIGHT) {
          // 左直行按右键 -> 左回中
          switchVideo(videoStates.LEFT_TO_CENTER)
        }
        // 其他状态不响应
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft') {
        keyboard.value.ArrowLeft = false
        
        // 左直行中松开左键且右键没按 -> 左回中
        if (currentVideoState.value === videoStates.LEFT_STRAIGHT && !keyboard.value.ArrowRight) {
          switchVideo(videoStates.LEFT_TO_CENTER)
        }
        // 左转中松开不做特殊处理，等视频结束时处理
      } 
      else if (e.key === 'ArrowRight') {
        keyboard.value.ArrowRight = false
        
        // 右直行中松开右键且左键没按 -> 右回中
        if (currentVideoState.value === videoStates.RIGHT_STRAIGHT && !keyboard.value.ArrowLeft) {
          switchVideo(videoStates.RIGHT_TO_CENTER)
        }
        // 右转中松开不做特殊处理，等视频结束时处理
      }
    }

    // 视频切换 - 恢复完整的切换逻辑
    const switchVideo = (newState) => {
      if (currentVideoState.value === newState || isTransitioning.value) return
      
      console.log(`切换视频: ${currentVideoState.value} -> ${newState}`)
      isTransitioning.value = true
      
      // 更新当前视频状态
      currentVideoState.value = newState
      
      if (videoPlayer.value) {
        // 淡出当前视频
        videoPlayer.value.style.opacity = '0'
        
        // 等待淡出完成后再切换源
        setTimeout(() => {
          videoPlayer.value.src = videoSources[newState]
          videoPlayer.value.currentTime = 0
          
          // 设置循环播放属性 - 只有特定视频才循环
          videoPlayer.value.loop = (
            newState === videoStates.STRAIGHT || 
            newState === videoStates.LEFT_STRAIGHT || 
            newState === videoStates.RIGHT_STRAIGHT
          )
          
          // 确保视频已加载
          videoPlayer.value.load()
          
          // 设置播放速度
          videoPlayer.value.playbackRate = videoPlaybackRate.value
          
          const playPromise = videoPlayer.value.play()
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                // 播放成功，恢复可见性
                videoPlayer.value.style.opacity = '1'
                setTimeout(() => {
                  isTransitioning.value = false
                }, 250) // 等待淡入动画完成
              })
              .catch(error => {
                // 播放失败处理
                console.error('视频播放失败:', error)
                isTransitioning.value = false
                
                // 尝试再次播放并确保循环
                videoPlayer.value.muted = true // 确保静音以自动播放
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
            // 旧浏览器可能不返回Promise
            videoPlayer.value.style.opacity = '1'
            setTimeout(() => {
              isTransitioning.value = false
            }, 250)
          }
        }, 250) // 等待淡出动画完成
      }
    }

    // 处理视频结束事件 - 恢复原始逻辑
    const handleVideoEnded = () => {
      // 如果正在转场，不处理
      if (isTransitioning.value) return
      
      console.log(`视频播放结束: ${currentVideoState.value}`)
      
      // 根据当前视频状态和按键状态决定下一个视频
      if (currentVideoState.value === videoStates.LEFT_TURN) {
        // LEFT_TURN结束时
        if (keyboard.value.ArrowLeft) {
          // 如果左键仍按下，切换到左直行
          switchVideo(videoStates.LEFT_STRAIGHT)
        } else {
          // 如果没有按键，直接回到直行
          switchVideo(videoStates.STRAIGHT)
        }
      } 
      else if (currentVideoState.value === videoStates.RIGHT_TURN) {
        // RIGHT_TURN结束时
        if (keyboard.value.ArrowRight) {
          // 如果右键仍按下，切换到右直行
          switchVideo(videoStates.RIGHT_STRAIGHT)
        } else {
          // 如果没有按键，直接回到直行
          switchVideo(videoStates.STRAIGHT)
        }
      } 
      else if (currentVideoState.value === videoStates.LEFT_TO_CENTER) {
        // 左回中结束时
        if (keyboard.value.ArrowRight) {
          // 如果右键按下，切换到右转
          switchVideo(videoStates.RIGHT_TURN)
        } else if (keyboard.value.ArrowLeft) {
          // 如果左键按下，返回左直行
          switchVideo(videoStates.LEFT_TURN)
        } else {
          // 否则回到直行
          switchVideo(videoStates.STRAIGHT)
        }
      } 
      else if (currentVideoState.value === videoStates.RIGHT_TO_CENTER) {
        // 右回中结束时
        if (keyboard.value.ArrowLeft) {
          // 如果左键按下，切换到左转
          switchVideo(videoStates.LEFT_TURN)
        } else if (keyboard.value.ArrowRight) {
          // 如果右键按下，返回右直行
          switchVideo(videoStates.RIGHT_TURN)
        } else {
          // 否则回到直行
          switchVideo(videoStates.STRAIGHT)
        }
      }
      // STRAIGHT, LEFT_STRAIGHT, RIGHT_STRAIGHT已设置为循环播放，不需要处理
    }

    const handleVideoError = (e) => {
      console.error('视频加载失败:', e)
    }

    const handleImageError = (e) => {
      console.error('图片加载失败:', e)
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

    const handleExit = () => {
      emit('exit-game')
    }

    // 窗口大小变化
    const handleResize = () => {
      windowWidth.value = window.innerWidth
      windowHeight.value = window.innerHeight
    }

    // 监听血氧数据变化
    watch(() => props.nirsData, (newData) => {
      if (newData) {
        updateBrainOxygenData()
      }
    }, { deep: true })

    // 组件生命周期
    let deviceDataLoop
    onMounted(() => {
      console.log('[游戏组件] 初始化完成')
      
      // 设置初始视频为循环播放
      if (videoPlayer.value) {
        videoPlayer.value.loop = true
        
        // 确保视频自动播放
        videoPlayer.value.muted = true
        videoPlayer.value.play().catch(err => {
          console.error('初始视频播放失败:', err)
          // 重试播放
          setTimeout(() => {
            videoPlayer.value.play().catch(error => 
              console.error('重试初始视频播放失败:', error)
            )
          }, 500)
        })
      }
      
      requestAnimationFrame(animate)
      deviceDataLoop = setInterval(updateDeviceData, 100) // 更频繁的数据更新
      
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      window.addEventListener('resize', handleResize)
    })

    onUnmounted(() => {
      console.log('[游戏组件] 清理资源')
      clearInterval(deviceDataLoop)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('resize', handleResize)
    })

    return {
      showInstructions,
      gameSpeed,
      score,
      cyclistState,
      pedalingData,
      oxygenData,
      videoPlayer,
      currentVideo,
      videoPlaybackRate,
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
      handleExit,
    }
  },
}
</script>

<style scoped>
.game-container {
  position: relative;
  width: 100%;
  height: 100%;  /* 改为100%适配父容器，而不是100vh */
  min-height: 500px;  /* 设置最小高度，确保游戏区域足够大 */
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;  /* 添加圆角，与整体界面风格保持一致 */
  aspect-ratio: 16/9;  /* 确保16:9横屏比例 */
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  opacity: 0.95;  /* 提高透明度，从0.8改为0.95，减少透明感 */
}

.coin {
  position: absolute;
  z-index: 3;
  border-radius: 50%;
  background: radial-gradient(circle, #FFD700 0%, #FFA500 100%);
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
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

/* 游戏HUD */
.game-hud {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  z-index: 10;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.hud-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.score-display {
  background: rgba(0, 0, 0, 0.7);
  padding: 12px 20px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.score-label {
  font-size: 16px;
  margin-right: 8px;
}

.score-value {
  font-size: 24px;
  font-weight: bold;
  color: #FFD700;
}

.oxygen-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oxygen-item {
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 16px;
  border-radius: 6px;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 8px;
}

.oxygen-label {
  font-size: 14px;
}

.oxygen-value {
  font-size: 18px;
  font-weight: bold;
  color: #00ff00;
}

.oxygen-value.high {
  color: #ff4444;
}

.hud-bottom {
  display: flex;
  gap: 20px;
}

.device-status,
.collection-status {
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 16px;
  border-radius: 6px;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 14px;
}

.status-indicator {
  font-size: 14px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-indicator.connected,
.status-indicator.active {
  background: #27ae60;
  color: white;
}

.status-indicator.disconnected,
.status-indicator.inactive {
  background: #e74c3c;
  color: white;
}

.exit-button {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: rgba(231, 76, 60, 0.9);
  color: white;
  border: 2px solid white;
  border-radius: 5px;
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
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
  max-width: 400px;
}

.instructions-content h3 {
  margin-bottom: 20px;
  font-size: 24px;
  color: #333;
}

.instructions-content p {
  margin-bottom: 16px;
  font-size: 16px;
  color: #666;
}

.instructions-content button {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
}

.instructions-content button:hover {
  background: #2980b9;
}
</style>