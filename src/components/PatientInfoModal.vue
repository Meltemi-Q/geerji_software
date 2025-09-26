<template>
  <div v-show="visible" class="patient-modal-overlay" @click.self="$emit('close')">
    <div class="patient-modal-container">
      <!-- 弹窗头部 -->
      <div class="modal-header">
        <h2 class="modal-title">基础信息登记</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>

      <!-- 步骤指示器 -->
      <div class="step-indicator">
        <div class="step-dots">
          <span class="dot" :class="{active: currentStep === 1, completed: currentStep > 1}">1</span>
          <span class="step-line" :class="{completed: currentStep > 1}"></span>
          <span class="dot" :class="{active: currentStep === 2, completed: currentStep > 2}">2</span>
          <span class="step-line" :class="{completed: currentStep > 2}"></span>
          <span class="dot" :class="{active: currentStep === 3}">3</span>
        </div>
        <div class="step-labels">
          <span>基本信息</span>
          <span>身体指标</span>
          <span>健康状况</span>
        </div>
      </div>

      <!-- 弹窗内容 -->
      <div class="modal-body">
        <!-- 步骤1：基本信息 -->
        <div v-if="currentStep === 1" class="step-content">
          <div class="form-group">
            <label class="form-label">
              <svg width="20" height="20" viewBox="0 0 20 20" class="label-icon">
                <circle cx="10" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <path d="M14 13c0-2.21-1.79-4-4-4s-4 1.79-4 4v5h8v-5z" fill="none" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              姓名 <span class="required">*</span>
            </label>
            <input 
              type="text" 
              v-model="formData.name" 
              class="form-input"
              placeholder="请输入用户姓名"
              @input="validateName"
            >
            <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">
              <svg width="20" height="20" viewBox="0 0 20 20" class="label-icon">
                <rect x="3" y="4" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <line x1="7" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="1.5"/>
                <line x1="7" y1="13" x2="10" y2="13" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              年龄 <span class="required">*</span>
            </label>
            <div class="dual-input-container">
              <input 
                type="number" 
                v-model.number="formData.age"
                class="number-input"
                min="1" 
                max="120"
                @click="selectAll($event)"
                @input="validateAge"
              >
              <span class="unit">岁</span>
              <input 
                type="range" 
                v-model.number="formData.age"
                min="1" 
                max="120"
                class="slider-input"
              >
            </div>
            <span v-if="errors.age" class="error-text">{{ errors.age }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">
              <svg width="20" height="20" viewBox="0 0 20 20" class="label-icon">
                <path d="M16 2v16l-6-3-6 3V2h12z" fill="none" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              联系电话 <span class="required">*</span>
            </label>
            <input 
              type="tel" 
              v-model="formData.phone" 
              class="form-input"
              placeholder="请输入联系电话"
              @input="validatePhone"
            >
            <span v-if="errors.phone" class="error-text">{{ errors.phone }}</span>
          </div>
        </div>

        <!-- 步骤2：身体指标 -->
        <div v-if="currentStep === 2" class="step-content">
          <div class="form-group">
            <label class="form-label">
              <svg width="20" height="20" viewBox="0 0 20 20" class="label-icon">
                <line x1="10" y1="3" x2="10" y2="17" stroke="currentColor" stroke-width="1.5"/>
                <line x1="7" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1.5"/>
                <line x1="7" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/>
                <line x1="7" y1="15" x2="10" y2="15" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              身高 <span class="required">*</span>
            </label>
            <div class="dual-input-container">
              <span 
                class="editable-number"
                @click="editHeight"
                :contenteditable="editingHeight"
                @blur="finishEditHeight"
                @keydown.enter.prevent="finishEditHeight"
                ref="heightInput"
              >{{ formData.height }}</span>
              <span class="unit">cm</span>
              <input 
                type="range" 
                v-model.number="formData.height"
                min="100" 
                max="220"
                class="slider-input"
              >
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <svg width="20" height="20" viewBox="0 0 20 20" class="label-icon">
                <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <text x="10" y="14" text-anchor="middle" font-size="8" fill="currentColor">kg</text>
              </svg>
              体重 <span class="required">*</span>
            </label>
            <div class="dual-input-container">
              <span 
                class="editable-number"
                @click="editWeight"
                :contenteditable="editingWeight"
                @blur="finishEditWeight"
                @keydown.enter.prevent="finishEditWeight"
                ref="weightInput"
              >{{ formData.weight }}</span>
              <span class="unit">kg</span>
              <input 
                type="range" 
                v-model.number="formData.weight"
                min="30" 
                max="150"
                class="slider-input"
              >
            </div>
          </div>

          <!-- BMI显示 -->
          <div class="bmi-display">
            <div class="bmi-header">
              <span class="bmi-label">BMI指数</span>
              <span class="bmi-value">{{ bmi }}</span>
            </div>
            <div class="bmi-status" :class="bmiStatusClass">
              {{ bmiStatusText }}
            </div>
            <div class="bmi-bar">
              <div class="bmi-track"></div>
              <div class="bmi-indicator" :style="{left: bmiPosition}"></div>
              <div class="bmi-scale">
                <span>18.5</span>
                <span>24</span>
                <span>28</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <svg width="20" height="20" viewBox="0 0 20 20" class="label-icon">
                <path d="M10 3 L10 17 M5 7 Q10 5 15 7 M5 13 Q10 15 15 13" fill="none" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              血压记录（选填）
            </label>
            <div class="blood-pressure-inputs">
              <input 
                type="number" 
                v-model.number="formData.bloodPressure.systolic"
                class="bp-input"
                placeholder="收缩压"
                min="60"
                max="200"
              >
              <span class="bp-separator">/</span>
              <input 
                type="number" 
                v-model.number="formData.bloodPressure.diastolic"
                class="bp-input"
                placeholder="舒张压"
                min="40"
                max="130"
              >
              <span class="unit">mmHg</span>
            </div>
          </div>
        </div>

        <!-- 步骤3：健康状况 -->
        <div v-if="currentStep === 3" class="step-content">
          <p class="step-question">请选择您的健康状况（可多选）</p>
          
          <div class="condition-grid">
            <button 
              class="condition-card"
              :class="{selected: formData.conditions.hypertension}"
              @click="toggleCondition('hypertension')"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" class="condition-icon">
                <path d="M16 6 L16 26 M8 10 Q16 7 24 10 M8 22 Q16 25 24 22" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="condition-label">高血压</span>
              <span class="condition-desc">≥140/90mmHg</span>
            </button>

            <button 
              class="condition-card"
              :class="{selected: formData.conditions.diabetes}"
              @click="toggleCondition('diabetes')"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" class="condition-icon">
                <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M16 10 L16 22 M10 16 L22 16" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="condition-label">糖尿病</span>
              <span class="condition-desc">血糖异常</span>
            </button>

            <button 
              class="condition-card"
              :class="{selected: formData.conditions.smoking}"
              @click="toggleCondition('smoking')"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" class="condition-icon">
                <rect x="8" y="14" width="16" height="4" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M24 14 Q26 14 26 12 Q26 8 22 8" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="condition-label">吸烟史</span>
              <span class="condition-desc">6个月以上</span>
            </button>

            <button 
              class="condition-card"
              :class="{selected: formData.conditions.heartDisease}"
              @click="toggleCondition('heartDisease')"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" class="condition-icon">
                <path d="M16 28 C8 22 4 16 4 11 C4 7 7 4 11 4 C13 4 15 5 16 7 C17 5 19 4 21 4 C25 4 28 7 28 11 C28 16 24 22 16 28z" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="condition-label">心脏病</span>
              <span class="condition-desc">心律不齐</span>
            </button>

            <button 
              class="condition-card"
              :class="{selected: formData.conditions.dyslipidemia}"
              @click="toggleCondition('dyslipidemia')"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" class="condition-icon">
                <ellipse cx="16" cy="16" rx="12" ry="6" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="16" cy="16" r="3" fill="currentColor"/>
              </svg>
              <span class="condition-label">血脂异常</span>
              <span class="condition-desc">胆固醇高</span>
            </button>

            <button 
              class="condition-card special"
              :class="{selected: noConditions}"
              @click="selectNone"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" class="condition-icon">
                <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <polyline points="10,16 14,20 22,12" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="condition-label">均无以上</span>
              <span class="condition-desc">健康状态</span>
            </button>
          </div>

          <!-- 上传状态提示 -->
          <div v-if="uploadStatus.uploading || uploadStatus.success || uploadStatus.error" class="upload-status-container">
            <div v-if="uploadStatus.uploading" class="status-message status-loading">
              <div class="status-icon">⏳</div>
              <div class="status-text">
                <div class="status-title">正在上传用户信息...</div>
                <div class="status-desc">请稍候，正在同步到戈尔基云端服务器</div>
              </div>
            </div>

            <div v-if="uploadStatus.success" class="status-message status-success">
              <div class="status-icon">✅</div>
              <div class="status-text">
                <div class="status-title">上传成功！</div>
                <div class="status-desc">用户信息已安全保存到云端，即将自动关闭</div>
              </div>
            </div>

            <div v-if="uploadStatus.error" class="status-message status-error">
              <div class="status-icon">⚠️</div>
              <div class="status-text">
                <div class="status-title">上传失败</div>
                <div class="status-desc">{{ uploadStatus.error }}</div>
                <div class="status-note">数据已本地保存，可以继续训练</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 弹窗底部 -->
      <div class="modal-footer">
        <button 
          v-if="currentStep > 1" 
          class="btn btn-secondary"
          @click="prevStep"
        >
          上一步
        </button>
        <div class="spacer"></div>
        <button 
          v-if="currentStep < 3"
          class="btn btn-primary"
          @click="nextStep"
          :disabled="!canProceed"
        >
          下一步
        </button>
        <button 
          v-if="currentStep === 3"
          class="btn btn-success"
          @click="submitForm"
          :disabled="uploadStatus.uploading"
          :class="{
            'btn-loading': uploadStatus.uploading,
            'btn-success': uploadStatus.success,
            'btn-error': uploadStatus.error && !uploadStatus.uploading
          }"
        >
          <span v-if="uploadStatus.uploading" class="loading-icon">⏳</span>
          <span v-else-if="uploadStatus.success" class="success-icon">✅</span>
          <span v-else-if="uploadStatus.error" class="error-icon">⚠️</span>
          <span v-if="uploadStatus.uploading">上传中...</span>
          <span v-else-if="uploadStatus.success">上传成功</span>
          <span v-else-if="uploadStatus.error">上传失败，点击重试</span>
          <span v-else>完成</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick } from 'vue'
import { userDataService } from '@/services/UserDataService.js'

export default {
  name: 'PatientInfoModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'save'],
  setup(props, { emit }) {
    const currentStep = ref(1)
    const editingHeight = ref(false)
    const editingWeight = ref(false)
    const heightInput = ref(null)
    const weightInput = ref(null)
    
    // 表单数据
    const formData = ref({
      name: '',
      age: 45,
      phone: '',
      height: 170,
      weight: 65,
      bloodPressure: {
        systolic: null,
        diastolic: null
      },
      conditions: {
        hypertension: false,
        diabetes: false,
        smoking: false,
        heartDisease: false,
        dyslipidemia: false
      }
    })
    
    // 错误信息
    const errors = ref({
      name: '',
      age: '',
      phone: ''
    })

    // 上传状态管理
    const uploadStatus = ref({
      uploading: false,
      success: false,
      error: null
    })
    
    // 从localStorage恢复数据
    const savedData = localStorage.getItem('patientInfo')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        Object.assign(formData.value, parsed)
      } catch (e) {
        console.error('Failed to parse saved data:', e)
      }
    }
    
    // 计算BMI
    const bmi = computed(() => {
      const height = formData.value.height / 100 // 转换为米
      const weight = formData.value.weight
      const bmiValue = weight / (height * height)
      return bmiValue.toFixed(1)
    })
    
    // BMI状态
    const bmiStatusClass = computed(() => {
      const value = parseFloat(bmi.value)
      if (value < 18.5) return 'underweight'
      if (value < 24) return 'normal'
      if (value < 28) return 'overweight'
      return 'obese'
    })
    
    const bmiStatusText = computed(() => {
      const value = parseFloat(bmi.value)
      if (value < 18.5) return '偏瘦'
      if (value < 24) return '正常'
      if (value < 28) return '偏胖'
      return '肥胖'
    })
    
    // BMI指示器位置
    const bmiPosition = computed(() => {
      const value = parseFloat(bmi.value)
      // BMI范围 15-35，映射到 0-100%
      const percentage = Math.min(Math.max((value - 15) / 20 * 100, 0), 100)
      return `${percentage}%`
    })
    
    // 是否无健康问题
    const noConditions = computed(() => {
      return !Object.values(formData.value.conditions).some(v => v)
    })
    
    // 是否可以进入下一步
    const canProceed = computed(() => {
      if (currentStep.value === 1) {
        return formData.value.name && formData.value.age && formData.value.phone && 
               !errors.value.name && !errors.value.age && !errors.value.phone
      }
      return true
    })
    
    // 验证函数
    function validateName() {
      if (!formData.value.name) {
        errors.value.name = '请输入姓名'
      } else if (formData.value.name.length < 2) {
        errors.value.name = '姓名至少2个字符'
      } else {
        errors.value.name = ''
      }
    }
    
    function validateAge() {
      if (!formData.value.age) {
        errors.value.age = '请输入年龄'
      } else if (formData.value.age < 1 || formData.value.age > 120) {
        errors.value.age = '年龄范围：1-120岁'
      } else {
        errors.value.age = ''
      }
    }
    
    function validatePhone() {
      const phoneRegex = /^1[0-9]\d{9}$/
      if (!formData.value.phone) {
        errors.value.phone = '请输入联系电话'
      } else if (!phoneRegex.test(formData.value.phone)) {
        errors.value.phone = '请输入11位手机号'
      } else {
        errors.value.phone = ''
      }
    }
    
    // 全选输入框内容
    function selectAll(event) {
      event.target.select()
    }
    
    // 编辑身高
    function editHeight() {
      editingHeight.value = true
      nextTick(() => {
        if (heightInput.value) {
          const range = document.createRange()
          range.selectNodeContents(heightInput.value)
          const selection = window.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        }
      })
    }
    
    function finishEditHeight() {
      editingHeight.value = false
      const value = parseInt(heightInput.value?.textContent)
      if (!isNaN(value) && value >= 100 && value <= 220) {
        formData.value.height = value
      } else {
        // 恢复原值
        if (heightInput.value) {
          heightInput.value.textContent = formData.value.height
        }
      }
    }
    
    // 编辑体重
    function editWeight() {
      editingWeight.value = true
      nextTick(() => {
        if (weightInput.value) {
          const range = document.createRange()
          range.selectNodeContents(weightInput.value)
          const selection = window.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        }
      })
    }
    
    function finishEditWeight() {
      editingWeight.value = false
      const value = parseInt(weightInput.value?.textContent)
      if (!isNaN(value) && value >= 30 && value <= 150) {
        formData.value.weight = value
      } else {
        // 恢复原值
        if (weightInput.value) {
          weightInput.value.textContent = formData.value.weight
        }
      }
    }
    
    // 切换健康状况
    function toggleCondition(condition) {
      formData.value.conditions[condition] = !formData.value.conditions[condition]
    }
    
    // 选择"均无以上"
    function selectNone() {
      Object.keys(formData.value.conditions).forEach(key => {
        formData.value.conditions[key] = false
      })
    }
    
    // 步骤控制
    function nextStep() {
      if (currentStep.value === 1) {
        validateName()
        validateAge()
        validatePhone()
        if (!canProceed.value) return
      }
      currentStep.value++
    }
    
    function prevStep() {
      currentStep.value--
    }
    
    // 提交表单
    async function submitForm() {
      // 重置上传状态
      uploadStatus.value = {
        uploading: true,
        success: false,
        error: null
      }

      const data = {
        ...formData.value,
        bmi: parseFloat(bmi.value),
        bmiStatus: bmiStatusText.value,
        timestamp: new Date().toISOString()
      }
      
      try {
        // 1. 本地保存（立即保存，确保数据不丢失）
        localStorage.setItem('patientInfo', JSON.stringify(data))
        console.log('[用户信息] 本地保存成功')

        // 2. 云端上传用户档案
        console.log('[用户信息] 开始上传到戈尔基云端')
        const uploadResult = await userDataService.createPatient(data)

        if (uploadResult.success) {
          console.log('[用户信息] 云端上传成功:', uploadResult.patient_id)
          
          uploadStatus.value = {
            uploading: false,
            success: true,
            error: null
          }

          // 保存用户ID用于后续会话
          const enhancedData = {
            ...data,
            patient_id: uploadResult.patient_id,
            cloud_sync: true,
            sync_timestamp: new Date().toISOString()
          }

          // 更新本地存储包含用户ID
          localStorage.setItem('patientInfo', JSON.stringify(enhancedData))
          localStorage.setItem('current_patient_id', uploadResult.patient_id)

          // 触发保存事件
          emit('save', enhancedData)

          // 1.5秒后自动关闭（显示成功状态）
          setTimeout(() => {
            emit('close')
          }, 1500)
        } else {
          throw new Error(uploadResult.error || '上传失败')
        }
      } catch (error) {
        console.error('[用户信息] 云端上传失败:', error)
        
        uploadStatus.value = {
          uploading: false,
          success: false,
          error: error.message
        }

        // 即使云端上传失败，也继续本地流程
        // 生成本地用户ID用于会话管理
        const localPatientId = data.patient_id || `PATIENT_${Date.now()}`
        
        // 标记为离线数据，待下次训练时重试
        const offlineData = {
          ...data,
          patient_id: localPatientId,
          cloud_sync: false,
          offline_reason: error.message,
          needs_sync: true
        }

        localStorage.setItem('patientInfo', JSON.stringify(offlineData))
        localStorage.setItem('current_patient_id', localPatientId)
        console.warn('[用户信息] 已保存为离线数据，将在下次训练时重试上传')

        // 触发保存事件（本地数据）
        emit('save', offlineData)

        // 3秒后允许手动关闭
        setTimeout(() => {
          if (!uploadStatus.value.success) {
            uploadStatus.value.error += '\n\n点击"完成"继续训练（数据已本地保存）'
          }
        }, 3000)
      }
    }
    
    return {
      currentStep,
      formData,
      errors,
      editingHeight,
      editingWeight,
      heightInput,
      weightInput,
      bmi,
      bmiStatusClass,
      bmiStatusText,
      bmiPosition,
      noConditions,
      canProceed,
      uploadStatus,
      validateName,
      validateAge,
      validatePhone,
      selectAll,
      editHeight,
      finishEditHeight,
      editWeight,
      finishEditWeight,
      toggleCondition,
      selectNone,
      nextStep,
      prevStep,
      submitForm
    }
  }
}
</script>

<style scoped>
/* 弹窗覆盖层 */
.patient-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 弹窗容器 */
.patient-modal-container {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 弹窗头部 */
.modal-header {
  padding: 20px 30px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white;
}

.modal-title {
  font-size: 26px;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 5px;
  display: flex;
  align-items: center;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 0.7;
}

/* 步骤指示器 */
.step-indicator {
  padding: 20px 30px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.step-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
}

.dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  transition: all 0.3s;
}

.dot.active {
  background: #2196F3;
  color: white;
  transform: scale(1.1);
}

.dot.completed {
  background: #4CAF50;
  color: white;
}

.step-line {
  width: 60px;
  height: 2px;
  background: #e5e7eb;
  transition: background 0.3s;
}

.step-line.completed {
  background: #4CAF50;
}

.step-labels {
  display: flex;
  justify-content: space-around;
  font-size: 14px;
  color: #6b7280;
}

/* 弹窗内容 */
.modal-body {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.step-content {
  animation: fadeIn 0.3s ease;
}

/* 表单样式 */
.form-group {
  margin-bottom: 25px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
}

.label-icon {
  color: #2196F3;
}

.required {
  color: #ef4444;
}

.form-input {
  width: 100%;
  padding: 10px 15px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 18px;
  transition: all 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.error-text {
  color: #ef4444;
  font-size: 14px;
  margin-top: 5px;
  display: block;
}

/* 双输入模式 */
.dual-input-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.number-input {
  width: 100px;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}

.editable-number {
  display: inline-block;
  padding: 10px 15px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 80px;
  text-align: center;
}

.editable-number:hover {
  border-color: #2196F3;
  background: rgba(33, 150, 243, 0.05);
}

.editable-number[contenteditable="true"] {
  border-color: #2196F3;
  background: white;
  outline: none;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.unit {
  font-size: 16px;
  color: #6b7280;
  font-weight: 500;
}

.slider-input {
  flex: 1;
  height: 6px;
}

/* 滑块样式 */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: #e5e7eb;
  border-radius: 3px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2196F3;
  cursor: pointer;
  transition: all 0.3s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 0 8px rgba(33, 150, 243, 0.1);
}

/* BMI显示 */
.bmi-display {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 15px;
  padding: 20px;
  margin-top: 20px;
}

.bmi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.bmi-label {
  font-size: 16px;
  color: #64748b;
  font-weight: 500;
}

.bmi-value {
  font-size: 36px;
  font-weight: bold;
  color: #1e3c72;
}

.bmi-status {
  font-size: 18px;
  font-weight: 600;
  padding: 5px 15px;
  border-radius: 20px;
  display: inline-block;
  margin-bottom: 15px;
}

.bmi-status.underweight {
  background: #fef3c7;
  color: #d97706;
}

.bmi-status.normal {
  background: #d1fae5;
  color: #059669;
}

.bmi-status.overweight {
  background: #fed7aa;
  color: #ea580c;
}

.bmi-status.obese {
  background: #fecaca;
  color: #dc2626;
}

.bmi-bar {
  position: relative;
  height: 30px;
}

.bmi-track {
  position: absolute;
  width: 100%;
  height: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(90deg, 
    #3b82f6 0%, 
    #10b981 30%, 
    #f59e0b 70%, 
    #ef4444 100%);
  border-radius: 4px;
}

.bmi-indicator {
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border: 3px solid #1e3c72;
  border-radius: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  transition: left 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.bmi-scale {
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
  margin-top: 25px;
  font-size: 14px;
  color: #64748b;
}

/* 血压输入 */
.blood-pressure-inputs {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bp-input {
  width: 100px;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  text-align: center;
  font-size: 18px;
}

.bp-separator {
  font-size: 22px;
  color: #6b7280;
}

/* 健康状况卡片 */
.step-question {
  font-size: 18px;
  color: #374151;
  margin-bottom: 20px;
  text-align: center;
}

.condition-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.condition-card {
  padding: 20px;
  border: 2px solid #e5e7eb;
  border-radius: 15px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
}

.condition-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.condition-card.selected {
  border-color: #2196F3;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.condition-card.selected::after {
  content: '';
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  background: #2196F3;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.condition-card.special {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
}

.condition-card.special.selected {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-color: #4ade80;
}

.condition-icon {
  color: #6b7280;
}

.condition-card.selected .condition-icon {
  color: #2196F3;
}

.condition-card.special .condition-icon {
  color: #4ade80;
}

.condition-label {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.condition-desc {
  font-size: 12px;
  color: #9ca3af;
}

/* 弹窗底部 */
.modal-footer {
  padding: 20px 30px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 15px;
  background: #f9fafb;
}

.spacer {
  flex: 1;
}

/* 按钮样式 */
.btn {
  padding: 10px 25px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-primary {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 15px rgba(33, 150, 243, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-success {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
}

.btn-success:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);
}
</style>