<template>
  <div v-if="visible" class="user-selector-overlay">
    <div class="user-selector-modal">
      <div class="modal-header">
        <h2>选择用户账户 ({{ totalPatients }}人)</h2>
        <button @click="$emit('close')" class="modal-close-btn" title="关闭">×</button>
      </div>
      
      <!-- 搜索下拉组合框 -->
      <div class="search-dropdown-container">
        <div class="search-input-wrapper">
          <input 
            ref="searchInput"
            v-model="searchKeyword" 
            @input="onSearch"
            @focus="showDropdown = true"
            placeholder="🔍 搜索用户姓名/ID/诊断..."
            class="search-input"
          />
          <button @click="toggleDropdown" class="dropdown-btn">
            {{ showDropdown ? '▲' : '▼' }}
          </button>
        </div>
        
        <!-- 下拉列表 -->
        <div v-if="showDropdown" class="dropdown-list">
          <div v-if="isLoading" class="loading-item">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="displayPatients.length === 0" class="no-results">
            {{ searchKeyword ? '未找到匹配用户' : '暂无用户数据' }}
          </div>
          <div v-else class="patient-options">
            <div v-for="patient in displayPatients" :key="patient.id"
                 @click="selectPatient(patient)" class="patient-option">
              <span class="patient-icon">{{ patient.isRecent ? '📌' : '👤' }}</span>
              <div class="patient-info">
                <div class="patient-name">{{ patient.name }} ({{ patient.age }}岁)</div>
                <div class="patient-details">{{ patient.phone }} | {{ patient.diagnosis }}</div>
                <div v-if="patient.lastLogin" class="patient-last-login">
                  {{ formatDate(patient.lastLogin) }}
                </div>
              </div>
              <span v-if="patient.isRecent" class="recent-tag">最近</span>
            </div>
            
            <!-- 显示更多按钮 -->
            <div v-if="hasMore" @click="loadMore" class="load-more-btn">
              ┌─ 显示更多 ({{ displayPatients.length }}/{{ totalPatients }}) ─┐
            </div>
          </div>
        </div>
      </div>
      
      <!-- 最近用户快捷选择 -->
      <div v-if="!searchKeyword && recentPatients.length" class="recent-quick-select">
        <h3>📋 快速选择</h3>
        <div class="recent-patients-grid">
          <div v-for="patient in recentPatients.slice(0, 2)" :key="patient.id"
               @click="selectPatient(patient)" class="recent-patient-card">
            <div class="patient-avatar">👤</div>
            <div class="patient-details">
              <div class="patient-name">{{ patient.name }}</div>
              <div class="patient-meta">{{ patient.age }}岁 | {{ formatDate(patient.lastLogin) }}</div>
              <div class="patient-diagnosis">{{ patient.diagnosis }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 新用户按钮 -->
      <div class="new-patient-section">
        <button @click="selectNewPatient" class="new-patient-btn">
          ➕ 添加新用户
        </button>
      </div>
      
      <!-- 底部按钮 -->
      <div class="modal-buttons">
        <button @click="$emit('close')" class="cancel-btn">取消</button>
      </div>
    </div>
  </div>
</template>

<script>
import { userDataService } from '@/services/UserDataService.js'

export default {
  name: 'SearchableUserSelect',
  emits: ['close', 'select-patient', 'new-patient'],
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  
  data() {
    return {
      searchKeyword: '',
      showDropdown: false,
      displayPatients: [],
      recentPatients: [],
      allPatients: [],
      totalPatients: 0,
      isLoading: false,
      loadedCount: 8, // 初始显示8个用户
      searchTimeout: null
    }
  },
  
  computed: {
    hasMore() {
      return !this.searchKeyword && this.loadedCount < this.allPatients.length
    }
  },
  
  async mounted() {
    await this.loadPatients()
    // 点击外部关闭下拉
    document.addEventListener('click', this.handleClickOutside)
    // ESC键关闭弹窗
    document.addEventListener('keydown', this.handleKeyDown)
  },
  
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
    document.removeEventListener('keydown', this.handleKeyDown)
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }
  },
  
  methods: {
    /**
     * 加载用户数据
     */
    async loadPatients() {
      this.isLoading = true
      try {
        console.log('[PatientSelector] 开始加载用户数据...')
        
        // 智能刷新逻辑：如果缓存超过30分钟，强制刷新
        if (userDataService.shouldRefreshCache(30 * 60 * 1000)) {
          console.log('[PatientSelector] 缓存较旧，强制刷新用户列表')
          this.allPatients = await userDataService.forceRefreshUserList()
        } else {
          this.allPatients = await userDataService.getAllPatients()
        }
        
        this.totalPatients = this.allPatients.length
        
        // 标记最近用户
        const recentCount = Math.min(5, this.allPatients.length)
        this.allPatients.forEach((patient, index) => {
          patient.isRecent = index < recentCount
        })
        
        this.recentPatients = this.allPatients.slice(0, recentCount)
        this.updateDisplayPatients()
        
        console.log(`[PatientSelector] ✅ 加载完成：${this.totalPatients}个用户`)
        console.log(`[PatientSelector] 最近用户：${this.recentPatients.length}个`)
        
      } catch (error) {
        console.error('[PatientSelector] ❌ 用户数据加载失败:', error)
        this.allPatients = []
        this.totalPatients = 0
        this.recentPatients = []
      } finally {
        this.isLoading = false
      }
    },
    
    /**
     * 更新显示的用户列表
     */
    updateDisplayPatients() {
      if (this.searchKeyword) {
        // 搜索模式：显示搜索结果
        this.displayPatients = this.searchResults || []
      } else {
        // 普通模式：显示前N个用户，最近用户在前
        this.displayPatients = this.allPatients.slice(0, this.loadedCount)
      }
    },
    
    /**
     * 搜索处理（带防抖）
     */
    onSearch() {
      // 清除之前的搜索定时器
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }
      
      this.showDropdown = true
      
      // 防抖搜索，减少API调用
      this.searchTimeout = setTimeout(async () => {
        await this.performSearch()
      }, 500) // 500ms防抖
    },
    
    /**
     * 执行搜索
     */
    async performSearch() {
      if (!this.searchKeyword.trim()) {
        this.searchResults = []
        this.updateDisplayPatients()
        return
      }
      
      this.isLoading = true
      try {
        console.log(`[PatientSelector] 搜索用户: "${this.searchKeyword}"`)
        
        this.searchResults = await userDataService.searchPatients(this.searchKeyword)
        this.updateDisplayPatients()
        
        console.log(`[PatientSelector] 搜索结果: ${this.searchResults.length}个用户`)
        
      } catch (error) {
        console.error('[PatientSelector] 搜索失败:', error)
        this.searchResults = []
        this.updateDisplayPatients()
      } finally {
        this.isLoading = false
      }
    },
    
    /**
     * 切换下拉显示
     */
    toggleDropdown() {
      this.showDropdown = !this.showDropdown
      if (this.showDropdown) {
        this.$nextTick(() => {
          this.$refs.searchInput?.focus()
        })
      }
    },
    
    /**
     * 加载更多用户
     */
    loadMore() {
      this.loadedCount += 10
      this.updateDisplayPatients()
      console.log(`[PatientSelector] 加载更多，当前显示: ${this.displayPatients.length}/${this.totalPatients}`)
    },
    
    /**
     * 选择用户
     */
    async selectPatient(patient) {
      this.isLoading = true
      this.showDropdown = false
      
      try {
        console.log(`[PatientSelector] 选择用户: ${patient.name} (${patient.id})`)
        
        // 获取用户详细信息
        const fullProfile = await userDataService.getPatientDetail(patient.id)
        
        if (fullProfile) {
          console.log(`[PatientSelector] ✅ 获取用户详情成功: ${fullProfile.name}`)
          this.$emit('select-patient', fullProfile)
        } else {
          // 降级使用基本信息
          console.warn(`[PatientSelector] ⚠️ 详情获取失败，使用基本信息`)
          const basicProfile = this.transformBasicPatientData(patient)
          this.$emit('select-patient', basicProfile)
        }
        
      } catch (error) {
        console.error('[PatientSelector] ❌ 选择用户失败:', error)
        // 尝试使用基本信息
        const basicProfile = this.transformBasicPatientData(patient)
        this.$emit('select-patient', basicProfile)
      } finally {
        this.isLoading = false
      }
    },
    
    /**
     * 转换基本用户数据为表单格式（降级方案）
     */
    transformBasicPatientData(patient) {
      return {
        patient_id: patient.id,
        name: patient.name.replace('*', ''), // 尝试去掉脱敏标记
        age: patient.age,
        phone: patient.id,
        diagnosis: patient.diagnosis,
        gender: patient.gender || '',
        // 其他字段使用默认值
        height: null,
        weight: null,
        bmi: null,
        blood_pressure: { systolic: null, diastolic: null },
        conditions: {
          hypertension: false,
          diabetes: false,
          heart_disease: false,
          dyslipidemia: false,
          smoking: false
        }
      }
    },
    
    /**
     * 选择新用户
     */
    selectNewPatient() {
      console.log('[PatientSelector] 选择添加新用户')
      this.$emit('new-patient')
    },
    
    /**
     * 点击外部关闭下拉
     */
    handleClickOutside(event) {
      if (!this.$el.contains(event.target)) {
        this.showDropdown = false
      }
    },
    
    /**
     * ESC键关闭弹窗
     */
    handleKeyDown(event) {
      if (event.key === 'Escape') {
        this.$emit('close')
      }
    },
    
    /**
     * 格式化日期显示
     */
    formatDate(dateStr) {
      if (!dateStr) return ''
      
      try {
        const date = new Date(dateStr)
        const now = new Date()
        const diffDays = Math.floor((now - date) / (24 * 60 * 60 * 1000))
        
        if (diffDays === 0) return '今天记录'
        if (diffDays === 1) return '昨天记录'
        if (diffDays < 7) return `${diffDays}天前`
        
        return date.toLocaleDateString('zh-CN', { 
          month: '2-digit', 
          day: '2-digit' 
        }) + '记录'
      } catch (e) {
        return '历史记录'
      }
    }
  }
}
</script>

<style scoped>
/* 遮罩层 */
.user-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

/* 主弹窗 */
.user-selector-modal {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%);
  border-radius: 20px;
  padding: 32px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* 弹窗头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.user-selector-modal h2 {
  margin: 0;
  color: #1e40af;
  font-size: 28px;
  font-weight: 600;
  flex: 1;
  text-align: center;
}

/* 右上角关闭按钮 */
.modal-close-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  color: #ef4444;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.modal-close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  transform: scale(1.05);
}

/* 搜索输入框 */
.search-dropdown-container {
  position: relative;
  margin-bottom: 20px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 12px 50px 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 18px;
  background-color: white;
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dropdown-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 18px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.dropdown-btn:hover {
  background-color: rgba(59, 130, 246, 0.1);
}

/* 下拉列表 */
.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
}

/* 加载状态 */
.loading-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #64748b;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 无结果 */
.no-results {
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-style: italic;
}

/* 用户选项 */
.patient-option {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.2s;
  position: relative;
}

.patient-option:hover {
  background-color: rgba(59, 130, 246, 0.05);
}

.patient-option:last-child {
  border-bottom: none;
}

.patient-icon {
  font-size: 24px;
  margin-right: 12px;
}

.patient-info {
  flex: 1;
  min-width: 0;
}

.patient-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 20px;
  margin-bottom: 4px;
}

.patient-details {
  color: #64748b;
  font-size: 16px;
  margin-bottom: 2px;
}

.patient-last-login {
  color: #94a3b8;
  font-size: 14px;
}

.recent-tag {
  background-color: #3b82f6;
  color: white;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  position: absolute;
  top: 8px;
  right: 8px;
}

/* 加载更多按钮 */
.load-more-btn {
  text-align: center;
  padding: 12px;
  color: #3b82f6;
  cursor: pointer;
  font-size: 16px;
  border-top: 1px solid #f1f5f9;
  transition: background-color 0.2s;
}

.load-more-btn:hover {
  background-color: rgba(59, 130, 246, 0.05);
}

/* 最近用户快捷选择 */
.recent-quick-select {
  margin-bottom: 20px;
}

.recent-quick-select h3 {
  margin: 0 0 12px 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.recent-patients-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.recent-patient-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.recent-patient-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.patient-avatar {
  font-size: 32px;
  margin-right: 12px;
}

.patient-details .patient-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.patient-meta {
  color: #64748b;
  font-size: 12px;
  margin-bottom: 2px;
}

.patient-diagnosis {
  color: #3b82f6;
  font-size: 12px;
  font-weight: 500;
}

/* 新用户按钮 */
.new-patient-section {
  margin-bottom: 24px;
}

.new-patient-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.new-patient-btn:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* 底部按钮 */
.modal-buttons {
  display: flex;
  justify-content: center;
}

.cancel-btn {
  padding: 12px 32px;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cancel-btn:hover {
  background: #f1f5f9;
  color: #475569;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-selector-modal {
    width: 95%;
    padding: 24px;
    max-height: 85vh;
  }
  
  .recent-patients-grid {
    grid-template-columns: 1fr;
  }
  
  .patient-avatar {
    font-size: 28px;
  }
}
</style>