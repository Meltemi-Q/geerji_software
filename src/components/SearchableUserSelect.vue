<template>
  <div v-show="visible" class="user-selector-overlay">
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

      <!-- 当前本地用户提示 -->
      <div v-if="currentLocalPatient" data-testid="current-user-banner" class="current-user-banner">
        当前用户：<strong>{{ currentLocalPatient.name || '未命名' }}</strong>
        <span v-if="currentLocalPatient.age" class="current-user-age">{{ currentLocalPatient.age }}岁</span>
        <span v-if="currentLocalPatient.lastTime" class="current-user-time">{{ formatDate(currentLocalPatient.lastTime) }}</span>
      </div>
      
      <!-- 最近用户快捷选择 -->
      <div v-if="!searchKeyword && recentPatients.length" class="recent-quick-select">
        <h3>📋 最近选择</h3>
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
import UserSelectionHistory from '@/services/UserSelectionHistory.js'

export default {
  name: 'SearchableUserSelect',
  emits: ['close', 'select-patient', 'new-patient'],
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  watch: {
    // 每次打开时强制从云端刷新，保证看到最新数据
    async visible(v) {
      if (v) {
        await this.refreshPatientsFromCloud()
      }
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
      searchTimeout: null,
      currentLocalPatient: null
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
     * 强制从云端刷新患者列表并合并本地当前用户
     */
    async refreshPatientsFromCloud() {
      this.isLoading = true
      try {
        this.loadedCount = 8
        this.allPatients = await userDataService.forceRefreshUserList()
        // 合并本地当前用户，避免云端暂不同步导致丢失
        try {
          const saved = localStorage.getItem('patientInfo')
          const current = saved ? JSON.parse(saved) : null
          const localId = localStorage.getItem('current_patient_id') || current?.patient_id
          if (current && localId) {
            this.currentLocalPatient = {
              name: current.name,
              age: current.age,
              lastTime: new Date().toISOString()
            }
            const exists = this.allPatients.some(p => p.id === localId)
            if (!exists) {
              this.allPatients.unshift({
                id: localId,
                name: current.name || '未命名',
                age: current.age || null,
                phone: localId,
                diagnosis: current.diagnosis || '康复训练',
                lastLogin: new Date().toISOString(),
                isRecent: true
              })
            }
          }
        } catch (e) {
          console.warn('[PatientSelector] 合并本地用户失败:', e)
        }
        // 基于用户选择历史进行排序（与loadPatients保持一致）
        try {
          const nowIso = new Date().toISOString()
          const currentId = this.currentLocalPatient?.id
          const recentSelectedIds = UserSelectionHistory.getRecentUserIds(5)

          this.allPatients = (this.allPatients || []).map(p => ({
            ...p,
            lastLogin: (p.id === currentId) ? nowIso : p.lastLogin
          })).sort((a, b) => {
            // 1. 优先显示最近选择的用户
            const aRecentIndex = recentSelectedIds.indexOf(a.id)
            const bRecentIndex = recentSelectedIds.indexOf(b.id)

            if (aRecentIndex !== -1 && bRecentIndex !== -1) {
              return aRecentIndex - bRecentIndex
            }
            if (aRecentIndex !== -1) return -1
            if (bRecentIndex !== -1) return 1

            // 2. 都不在最近选择中，按训练记录时间排序
            return new Date(b.lastLogin) - new Date(a.lastLogin)
          })
        } catch (e) {}

        this.totalPatients = this.allPatients.length
        // 标记最近选择的用户
        const recentSelectedIds = UserSelectionHistory.getRecentUserIds(5)
        this.allPatients.forEach((p) => { p.isRecent = recentSelectedIds.includes(p.id) })

        // 快速选择显示最近选择的前2个用户（按选择顺序）
        const quickSelectIds = UserSelectionHistory.getRecentUserIds(2)
        const recentFromHistory = []

        // 按顺序查找最近选择的用户，保持选择历史的顺序
        for (const id of quickSelectIds) {
          const patient = this.allPatients.find(p => p.id === id)
          if (patient) {
            recentFromHistory.push(patient)
          }
        }

        this.recentPatients = recentFromHistory

        // 如果选择历史不足2个，用最新的用户补充
        if (this.recentPatients.length < 2) {
          const needed = 2 - this.recentPatients.length
          const additionalPatients = this.allPatients
            .filter(p => !quickSelectIds.includes(p.id))
            .slice(0, needed)
          this.recentPatients = [...this.recentPatients, ...additionalPatients]
        }
        this.updateDisplayPatients()
        console.log('[PatientSelector] 🔄 已从云端刷新用户列表')
      } catch (e) {
        console.error('[PatientSelector] 云端刷新失败:', e)
        // 失败则回退用已有列表
      } finally {
        this.isLoading = false
      }
    },
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
        
        // 合并当前本地登记用户，确保刷新后仍可见
        try {
          const saved = localStorage.getItem('patientInfo')
          const current = saved ? JSON.parse(saved) : null
          const localId = localStorage.getItem('current_patient_id') || current?.patient_id
          if (current && localId) {
            this.currentLocalPatient = {
              name: current.name,
              age: current.age,
              lastTime: new Date().toISOString()
            }
            const exists = this.allPatients.some(p => p.id === localId)
            if (!exists) {
              this.allPatients.unshift({
                id: localId,
                name: current.name || '未命名',
                age: current.age || null,
                phone: localId,
                diagnosis: current.diagnosis || '康复训练',
                lastLogin: new Date().toISOString(),
                isRecent: true
              })
              console.log('[PatientSelector] 已合并本地当前用户到列表:', localId)
            }
          }
        } catch (e) {
          console.warn('[PatientSelector] 合并本地用户失败:', e)
        }

        // 基于用户选择历史进行排序（最近选择的用户优先显示）
        try {
          const nowIso = new Date().toISOString()
          const currentId = this.currentLocalPatient?.id
          const recentSelectedIds = UserSelectionHistory.getRecentUserIds(5)

          // 更新当前用户的时间并根据选择历史排序
          this.allPatients = (this.allPatients || []).map(p => ({
            ...p,
            lastLogin: (p.id === currentId) ? nowIso : p.lastLogin
          })).sort((a, b) => {
            // 1. 优先显示最近选择的用户
            const aRecentIndex = recentSelectedIds.indexOf(a.id)
            const bRecentIndex = recentSelectedIds.indexOf(b.id)

            if (aRecentIndex !== -1 && bRecentIndex !== -1) {
              // 都在最近选择中，按选择顺序排序
              return aRecentIndex - bRecentIndex
            }
            if (aRecentIndex !== -1) return -1  // a在最近选择中，排前面
            if (bRecentIndex !== -1) return 1   // b在最近选择中，排前面

            // 2. 都不在最近选择中，按训练记录时间排序（原有逻辑）
            return new Date(b.lastLogin) - new Date(a.lastLogin)
          })
        } catch (e) {
          console.error('[PatientSelector] 排序处理失败:', e)
        }

        this.totalPatients = this.allPatients.length

        // 标记最近选择的用户
        const recentSelectedIds = UserSelectionHistory.getRecentUserIds(5)
        this.allPatients.forEach((patient) => {
          patient.isRecent = recentSelectedIds.includes(patient.id)
        })

        // 快速选择显示最近选择的前2个用户（按选择顺序）
        const quickSelectIds = UserSelectionHistory.getRecentUserIds(2)
        const recentFromHistory = []

        // 按顺序查找最近选择的用户，保持选择历史的顺序
        for (const id of quickSelectIds) {
          const patient = this.allPatients.find(p => p.id === id)
          if (patient) {
            recentFromHistory.push(patient)
          }
        }

        this.recentPatients = recentFromHistory

        // 如果选择历史不足2个，用最新的用户补充
        if (this.recentPatients.length < 2) {
          const needed = 2 - this.recentPatients.length
          const additionalPatients = this.allPatients
            .filter(p => !quickSelectIds.includes(p.id))
            .slice(0, needed)
          this.recentPatients = [...this.recentPatients, ...additionalPatients]
        }
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

        // 记录用户选择历史
        UserSelectionHistory.recordSelection(patient.id, patient.name)

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

        // 对于较旧的记录，显示月日+时分，帮助用户区分同一天的不同记录
        return date.toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit'
        }) + ' ' + date.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      } catch (e) {
        return '历史记录'
      }
    }
  }
}
</script>

<style scoped>
/* 当前用户提示 */
.current-user-banner {
  margin: 10px 0 16px 0;
  padding: 10px 14px;
  background: #f0f9ff;
  color: #0c4a6e;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  font-size: 14px;
}
.current-user-age {
  color: #64748b;
  margin-left: 8px;
}

.current-user-time {
  color: #94a3b8;
  margin-left: 8px;
  font-size: 12px;
}
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
