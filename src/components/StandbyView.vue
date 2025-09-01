<template>
  <div class="obelab-standby-view">
    <!-- 顶部header -->
    <div class="top-header">
      <div class="system-branding">
        <span class="golgi-text-header">Golgi</span>
        <span class="system-subtitle">近红外脑氧监测系统</span>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <div class="welcome-section">
        <div class="welcome-icon">
          <img src="/gorky.png" alt="Golgi Logo" class="company-logo" />
        </div>
        <div class="welcome-text">
          <h1 class="system-title">戈尔基康复训练系统</h1>
          <p class="system-description">基于近红外光谱技术的智能康复训练平台</p>
        </div>
      </div>

      <div class="status-section">
        <div class="status-card">
          <div class="status-item">
            <div class="status-icon">
              <svg width="24" height="24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <div class="status-info">
              <div class="status-label">系统状态</div>
              <div class="status-value ready">准备就绪</div>
            </div>
          </div>
          
          <div class="status-item">
            <div class="status-icon">
              <svg width="24" height="24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <div class="status-info">
              <div class="status-label">当前时间</div>
              <div class="status-value">{{ formatTime(currentTime) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 三步骤训练准备流程 -->
      <div class="preparation-section">
        <!-- 进度指示器 -->
        <div class="progress-indicator">
          <div class="progress-track">
            <div class="progress-fill" :style="{width: progressWidth}"></div>
          </div>
          <div class="progress-nodes">
            <div class="progress-node" :class="getStepClass(1)">
              <span class="node-number">1</span>
            </div>
            <div class="progress-node" :class="getStepClass(2)">
              <span class="node-number">2</span>
            </div>
            <div class="progress-node" :class="getStepClass(3)">
              <span class="node-number">3</span>
            </div>
          </div>
        </div>

        <!-- 步骤按钮 -->
        <div class="step-buttons">
          <!-- 步骤1：基础信息 -->
          <button 
            class="step-button"
            :class="{
              'completed': stepCompleted.patientInfo,
              'active': currentStep === 1,
              'disabled': currentStep !== 1 && !stepCompleted.patientInfo
            }"
            :disabled="currentStep !== 1 && !stepCompleted.patientInfo"
            @click="openPatientInfo"
          >
            <div class="button-content">
              <svg width="24" height="24" viewBox="0 0 24 24" class="step-icon">
                <circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M16 14c0-2.21-1.79-4-4-4s-4 1.79-4 4v6h8v-6z" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="step-title">① 基础信息</span>
              <svg v-if="stepCompleted.patientInfo" width="20" height="20" class="check-icon">
                <circle cx="10" cy="10" r="9" fill="#4CAF50"/>
                <polyline points="6,10 9,13 14,7" fill="none" stroke="white" stroke-width="2"/>
              </svg>
            </div>
          </button>

          <!-- 步骤2：设备校验 -->
          <button 
            class="step-button"
            :class="{
              'completed': stepCompleted.deviceCheck,
              'active': currentStep === 2,
              'disabled': !stepCompleted.patientInfo
            }"
            :disabled="!stepCompleted.patientInfo"
            @click="startDeviceCheck"
          >
            <div class="button-content">
              <svg width="24" height="24" viewBox="0 0 24 24" class="step-icon">
                <path d="M3 12l3-3v2h12v-2l3 3-3 3v-2H6v2l-3-3z" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="19" r="2" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="step-title">② 设备校验</span>
              <svg v-if="stepCompleted.deviceCheck" width="20" height="20" class="check-icon">
                <circle cx="10" cy="10" r="9" fill="#4CAF50"/>
                <polyline points="6,10 9,13 14,7" fill="none" stroke="white" stroke-width="2"/>
              </svg>
            </div>
          </button>

          <!-- 步骤3：开始训练 -->
          <button 
            class="step-button start-button"
            :class="{
              'ready': stepCompleted.deviceCheck,
              'disabled': !stepCompleted.deviceCheck
            }"
            :disabled="!stepCompleted.deviceCheck"
            @click="$emit('start-training')"
          >
            <div class="button-content">
              <svg width="24" height="24" viewBox="0 0 24 24" class="step-icon">
                <polygon points="9,6 9,18 18,12" fill="currentColor"/>
              </svg>
              <span class="step-title">③ 开始训练</span>
            </div>
          </button>
        </div>

        <p class="start-hint">请按顺序完成准备步骤</p>
      </div>
    </div>
    
    <!-- 患者信息弹窗 -->
    <PatientInfoModal 
      v-if="showPatientModal"
      @close="showPatientModal = false"
      @save="savePatientInfo"
    />
    
    <!-- 设备检查弹窗 -->
    <div v-if="showDeviceCheck" class="device-check-modal">
      <div class="modal-overlay" @click.self="showDeviceCheck = false">
        <div class="device-check-content">
          <h2 class="check-title">设备检查中...</h2>
          
          <div class="check-progress">
            <svg class="spinner" width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>
              <circle cx="30" cy="30" r="25" fill="none" stroke="#2196F3" stroke-width="4" 
                      stroke-dasharray="157" 
                      :stroke-dashoffset="157 - (157 * deviceCheckProgress / 100)"
                      transform="rotate(-90 30 30)"/>
            </svg>
            <span class="progress-text">{{ deviceCheckProgress }}%</span>
          </div>
          
          <div class="check-items">
            <div class="check-item" :class="{done: deviceCheckProgress > 30}">
              <svg v-if="deviceCheckProgress > 30" width="20" height="20">
                <circle cx="10" cy="10" r="9" fill="#4CAF50"/>
                <polyline points="6,10 9,13 14,7" fill="none" stroke="white" stroke-width="2"/>
              </svg>
              <span>帽子佩戴检查</span>
            </div>
            <div class="check-item" :class="{done: deviceCheckProgress > 60}">
              <svg v-if="deviceCheckProgress > 60" width="20" height="20">
                <circle cx="10" cy="10" r="9" fill="#4CAF50"/>
                <polyline points="6,10 9,13 14,7" fill="none" stroke="white" stroke-width="2"/>
              </svg>
              <span>信号质量检测</span>
            </div>
            <div class="check-item" :class="{done: deviceCheckProgress >= 100}">
              <svg v-if="deviceCheckProgress >= 100" width="20" height="20">
                <circle cx="10" cy="10" r="9" fill="#4CAF50"/>
                <polyline points="6,10 9,13 14,7" fill="none" stroke="white" stroke-width="2"/>
              </svg>
              <span>系统自检完成</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PatientInfoModal from './PatientInfoModal.vue'

export default {
  name: 'StandbyView',
  components: {
    PatientInfoModal
  },
  emits: ['start-training'],
  setup() {
    const currentTime = ref(new Date())
    let timeInterval = null

    // 三步骤状态管理
    const currentStep = ref(1)
    const stepCompleted = ref({
      patientInfo: false,
      deviceCheck: false
    })
    const showPatientModal = ref(false)
    const showDeviceCheck = ref(false)
    const deviceCheckProgress = ref(0)

    // 从localStorage恢复状态
    onMounted(() => {
      timeInterval = setInterval(updateTime, 1000)
      
      // 恢复患者信息状态
      const savedPatientInfo = localStorage.getItem('patientInfo')
      if (savedPatientInfo) {
        stepCompleted.value.patientInfo = true
        currentStep.value = 2
      }
    })

    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
    })

    // 计算进度条宽度
    const progressWidth = computed(() => {
      let completed = 0
      if (stepCompleted.value.patientInfo) completed++
      if (stepCompleted.value.deviceCheck) completed++
      return `${(completed / 2) * 100}%`
    })

    // 获取步骤样式类
    function getStepClass(step) {
      if (step === 1 && stepCompleted.value.patientInfo) return 'completed'
      if (step === 2 && stepCompleted.value.deviceCheck) return 'completed'
      if (step === currentStep.value) return 'active'
      if (step === 1 || (step === 2 && stepCompleted.value.patientInfo) || 
          (step === 3 && stepCompleted.value.deviceCheck)) return 'available'
      return 'disabled'
    }

    function formatTime(time) {
      return time.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }

    function updateTime() {
      currentTime.value = new Date()
    }

    // 打开患者信息弹窗
    function openPatientInfo() {
      showPatientModal.value = true
    }

    // 保存患者信息
    function savePatientInfo(data) {
      localStorage.setItem('patientInfo', JSON.stringify(data))
      stepCompleted.value.patientInfo = true
      showPatientModal.value = false
      currentStep.value = 2
    }

    // 开始设备检查
    function startDeviceCheck() {
      if (!stepCompleted.value.patientInfo) return
      
      showDeviceCheck.value = true
      deviceCheckProgress.value = 0
      
      // 模拟设备检查过程
      const checkSteps = [33, 66, 100]
      let currentCheckStep = 0
      
      const checkInterval = setInterval(() => {
        if (currentCheckStep < checkSteps.length) {
          deviceCheckProgress.value = checkSteps[currentCheckStep]
          currentCheckStep++
        } else {
          clearInterval(checkInterval)
          setTimeout(() => {
            showDeviceCheck.value = false
            stepCompleted.value.deviceCheck = true
            currentStep.value = 3
          }, 500)
        }
      }, 700)
    }

    return {
      currentTime,
      formatTime,
      currentStep,
      stepCompleted,
      showPatientModal,
      showDeviceCheck,
      deviceCheckProgress,
      progressWidth,
      getStepClass,
      openPatientInfo,
      savePatientInfo,
      startDeviceCheck
    }
  }
}
</script>

<style scoped>
/* Obelab风格待机界面 */
.obelab-standby-view {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  display: flex;
  flex-direction: column;
}

/* 顶部header */
.top-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 40px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.system-branding {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.golgi-text-header {
  font-size: 32px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.system-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  letter-spacing: 1px;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  gap: 50px;
}

/* 欢迎区域 */
.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 30px;
}

.welcome-icon {
  animation: breathe 3s ease-in-out infinite;
}

.company-logo {
  max-width: 200px;
  max-height: 120px;
  width: auto;
  height: auto;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  object-fit: contain;
}

.welcome-text {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
}

.system-title {
  font-size: 42px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
}

.system-description {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  line-height: 1.5;
}

/* 状态区域 */
.status-section {
  width: 100%;
  max-width: 600px;
}

.status-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 30px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  gap: 40px;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
  justify-content: center;
}

.status-icon {
  color: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.status-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.status-value {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.status-value.ready {
  color: #4ade80;
  text-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
}

/* 开始区域 */
.start-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.start-training-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  border: none;
  border-radius: 20px;
  padding: 20px 50px;
  font-size: 24px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
  min-width: 200px;
  backdrop-filter: blur(10px);
}

.start-training-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4);
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.start-training-btn:active {
  transform: translateY(-1px);
}

.start-icon {
  flex-shrink: 0;
  animation: pulse-icon 2s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.start-hint {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  text-align: center;
}

/* 响应式设计 */
@media (width: 1920px) and (height: 1080px) {
  .golgi-text-header {
    font-size: 38px;
  }
  
  .system-title {
    font-size: 48px;
  }
  
  .start-training-btn {
    padding: 25px 60px;
    font-size: 28px;
  }
  
  .brain-icon {
    width: 140px;
    height: 140px;
  }
}

@media (max-width: 1200px) {
  .main-content {
    padding: 40px 30px;
    gap: 40px;
  }
  
  .system-title {
    font-size: 36px;
  }
  
  .status-card {
    flex-direction: column;
    gap: 25px;
  }
}

@media (max-width: 768px) {
  .golgi-text-header {
    font-size: 28px;
  }
  
  .system-title {
    font-size: 32px;
  }
  
  .start-training-btn {
    padding: 18px 40px;
    font-size: 20px;
  }
  
  .brain-icon {
    width: 100px;
    height: 100px;
  }
  
  .top-header {
    padding: 20px 30px;
  }
  
  .main-content {
    padding: 30px 20px;
  }
}

/* 三步骤准备流程部分 */
.preparation-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  padding: 30px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

/* 进度指示器 */
.progress-indicator {
  position: relative;
  width: 100%;
  height: 60px;
  margin-bottom: 20px;
}

.progress-track {
  position: absolute;
  top: 30px;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50 0%, #2196F3 100%);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.progress-nodes {
  display: flex;
  justify-content: space-between;
  position: relative;
  height: 60px;
}

.progress-node {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 3px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
  transition: all 0.3s ease;
}

.progress-node.completed {
  background: #4CAF50;
  border-color: #4CAF50;
  box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
}

.progress-node.active {
  background: #2196F3;
  border-color: #2196F3;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(33, 150, 243, 0); }
  100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
}

.node-number {
  color: white;
  font-weight: bold;
  font-size: 16px;
}

/* 步骤按钮 */
.step-buttons {
  display: flex;
  gap: 20px;
  width: 100%;
}

.step-button {
  flex: 1;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.step-button:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
}

.step-button.completed {
  background: rgba(76, 175, 80, 0.2);
  border-color: #4CAF50;
}

.step-button.active {
  background: rgba(33, 150, 243, 0.2);
  border-color: #2196F3;
  box-shadow: 0 0 20px rgba(33, 150, 243, 0.3);
}

.step-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-button.start-button.ready {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  border-color: #4CAF50;
  animation: readyPulse 2s ease-in-out infinite;
}

@keyframes readyPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
}

.step-icon {
  color: currentColor;
}

.step-title {
  font-size: 16px;
  font-weight: 600;
}

.check-icon {
  position: absolute;
  top: -10px;
  right: -10px;
}

/* 设备检查弹窗 */
.device-check-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-check-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-width: 400px;
  text-align: center;
}

.check-title {
  color: #1e3c72;
  font-size: 24px;
  margin-bottom: 30px;
  font-weight: 600;
}

.check-progress {
  position: relative;
  margin: 30px auto;
  width: 60px;
  height: 60px;
}

.spinner {
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #2196F3;
  font-weight: bold;
  font-size: 14px;
}

.check-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 30px;
  text-align: left;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #999;
  transition: color 0.3s ease;
}

.check-item.done {
  color: #4CAF50;
}
</style>