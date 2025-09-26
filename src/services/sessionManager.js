/**
 * 训练会话管理器
 * 负责训练会话的完整生命周期管理
 * 包括会话创建、数据收集、状态管理、云端同步
 */

import { cloudAPI } from './geerjiCloudAPI.js'

/**
 * 训练会话管理器类
 */
export class SessionManager {
  constructor() {
    // 当前会话信息
    this.currentSession = null
    
    // 数据缓冲区
    this.hboDataBuffer = []
    this.batchSize = 100        // 批量上传大小
    this.uploadInterval = 10000 // 上传间隔（毫秒）
    
    // 会话统计
    this.sessionStats = {
      totalDataPoints: 0,
      avgHBO: 0,
      maxHBO: 0,
      minHBO: 0,
      qualityScore: 0
    }
    
    // 定时器
    this.uploadTimer = null
    this.cloudEnabled = false // 是否启用云端上传（需成功创建会话ID）
    this.cloudMode = (typeof localStorage !== 'undefined' && localStorage.getItem('cloud_mode')) || 'disabled' // 'disabled' | 'realtime'
    
    console.log('[会话管理] 初始化完成')
  }

  /**
   * 开始新的训练会话
   * @param {string} trainingMode - 训练模式 ('brain', 'heatmap', 'curve', 'game')
   * @param {Object} options - 可选配置
   * @returns {Promise<Object>} 会话创建结果
   */
  async startSession(trainingMode = 'brain', options = {}) {
    try {
      // 检查是否有未完成的会话
      if (this.currentSession && !this.currentSession.session_end) {
        console.warn('[会话管理] 存在未完成会话，将强制完成')
        await this.endSession()
      }

      // 获取当前患者ID
      const patientId = localStorage.getItem('current_patient_id')
      if (!patientId) {
        throw new Error('未找到患者信息，请先完成患者信息登记')
      }
      
      // 检查是否为本地模式（LOCAL_前缀）
      const isLocalMode = patientId.startsWith('LOCAL_')
      if (isLocalMode) {
        console.log('[会话管理] 检测到本地模式，禁用云端上传功能')
        this.cloudMode = 'disabled'
      }

      // 生成会话ID
      const sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      
      // 创建会话对象
      const sessionData = {
        session_id: sessionId,
        patient_id: patientId,
        training_mode: trainingMode,
        session_start: new Date().toISOString(),
        status: 'active',
        ...options
      }

      console.log('[会话管理] 创建新会话:', sessionId, trainingMode)

      // 上传到云端（仅实时模式）
      if (this.cloudMode === 'realtime') {
        const createResult = await cloudAPI.createTrainingSession(sessionData)
        if (!createResult.success) {
          console.warn('[会话管理] 云端会话创建失败，进入本地离线模式')
        }
      }

      // 设置当前会话
      this.currentSession = sessionData
      // 是否启用云端：实时模式且已分配会话ID
      this.cloudEnabled = this.cloudMode === 'realtime' && !!localStorage.getItem('current_session_id')
      
      // 重置数据缓冲区和统计
      this.hboDataBuffer = []
      this.sessionStats = {
        totalDataPoints: 0,
        avgHBO: 0,
        maxHBO: 0,
        minHBO: 0,
        qualityScore: 0
      }

      // 启动定期上传（仅云端可用时）
      if (this.cloudEnabled) {
        this.startBatchUpload()
      } else {
        console.log('[会话管理] 离线模式：暂停云端批量上传，仅本地缓冲')
      }

      // 保存到本地存储
      localStorage.setItem('current_session', JSON.stringify(this.currentSession))

      console.log('[会话管理] 会话启动成功')
      return {
        success: true,
        session_id: sessionId,
        session_data: this.currentSession
      }
    } catch (error) {
      console.error('[会话管理] 会话启动失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 添加血氧数据点
   * @param {number|Array} hboValue - 血氧值或数据数组
   * @param {Object} metadata - 数据元信息
   */
  addHBODataPoint(hboValue, metadata = {}) {
    if (!this.currentSession) {
      console.warn('[会话管理] 未找到活动会话，无法添加数据点')
      return
    }

    const timestamp = Date.now()
    let dataPoints = []

    // 支持单个值或数组
    if (Array.isArray(hboValue)) {
      dataPoints = hboValue.map((value, index) => ({
        timestamp_ms: timestamp,
        hbo_value: value,
        channel_id: index,
        data_quality: metadata.quality || null,
        session_id: this.currentSession.session_id
      }))
    } else {
      dataPoints = [{
        timestamp_ms: timestamp,
        hbo_value: hboValue,
        channel_id: metadata.channel_id || null,
        data_quality: metadata.quality || null,
        session_id: this.currentSession.session_id
      }]
    }

    // 添加到缓冲区
    this.hboDataBuffer.push(...dataPoints)
    
    // 更新统计信息
    this.updateSessionStats(dataPoints)

    // 检查是否需要批量上传（仅云端启用时）
    if (this.cloudEnabled && this.hboDataBuffer.length >= this.batchSize) {
      this.uploadBatchData()
    }
  }

  /**
   * 更新会话统计信息
   * @private
   * @param {Array} dataPoints - 新增的数据点
   */
  updateSessionStats(dataPoints) {
    const validValues = dataPoints
      .map(point => point.hbo_value)
      .filter(value => !isNaN(value) && isFinite(value))

    if (validValues.length === 0) return

    const oldTotal = this.sessionStats.totalDataPoints
    const newTotal = oldTotal + validValues.length

    // 更新平均值（增量计算）
    const newSum = validValues.reduce((sum, value) => sum + value, 0)
    const oldSum = this.sessionStats.avgHBO * oldTotal
    this.sessionStats.avgHBO = (oldSum + newSum) / newTotal

    // 更新最大最小值
    const newMax = Math.max(...validValues)
    const newMin = Math.min(...validValues)
    
    if (oldTotal === 0) {
      this.sessionStats.maxHBO = newMax
      this.sessionStats.minHBO = newMin
    } else {
      this.sessionStats.maxHBO = Math.max(this.sessionStats.maxHBO, newMax)
      this.sessionStats.minHBO = Math.min(this.sessionStats.minHBO, newMin)
    }

    this.sessionStats.totalDataPoints = newTotal

    // 计算数据质量评分（简单算法）
    const validRatio = validValues.length / dataPoints.length
    const stablilityScore = this.calculateStabilityScore(validValues)
    this.sessionStats.qualityScore = (validRatio * 0.7 + stablilityScore * 0.3) * 100
  }

  /**
   * 计算数据稳定性评分
   * @private
   * @param {Array} values - 数值数组
   * @returns {number} 稳定性评分 (0-1)
   */
  calculateStabilityScore(values) {
    if (values.length < 2) return 1

    // 计算变异系数 (CV = 标准差/平均值)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const standardDeviation = Math.sqrt(variance)
    
    if (mean === 0) return 0
    
    const coefficientOfVariation = standardDeviation / Math.abs(mean)
    
    // CV越小，稳定性越高，评分越高
    // 假设CV > 0.5时评分为0，CV = 0时评分为1
    return Math.max(0, 1 - coefficientOfVariation / 0.5)
  }

  /**
   * 启动批量上传定时器
   * @private
   */
  startBatchUpload() {
    if (!this.cloudEnabled) {
      console.log('[会话管理] 云端未启用，跳过批量上传定时器')
      return
    }
    this.stopBatchUpload() // 清理旧定时器
    
    this.uploadTimer = setInterval(() => {
      if (this.hboDataBuffer.length > 0) {
        this.uploadBatchData()
      }
    }, this.uploadInterval)

    console.log('[会话管理] 批量上传定时器启动')
  }

  /**
   * 停止批量上传定时器
   * @private
   */
  stopBatchUpload() {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer)
      this.uploadTimer = null
      console.log('[会话管理] 批量上传定时器停止')
    }
  }

  /**
   * 批量上传缓冲区数据
   * @private
   */
  async uploadBatchData() {
    if (this.hboDataBuffer.length === 0) return
    const currentSessionId = localStorage.getItem('current_session_id')
    if (!this.cloudEnabled || !currentSessionId) {
      // 未激活云端会话，保持本地缓冲，静默跳过
      return
    }

    const batchToUpload = this.hboDataBuffer.splice(0, this.batchSize)
    
    try {
      console.log(`[会话管理] 批量上传血氧数据: ${batchToUpload.length} 个数据点`)
      
      const result = await cloudAPI.uploadHBODataBatch(batchToUpload)
      
      if (result.success) {
        console.log('[会话管理] 血氧数据批量上传成功')
      } else {
        console.warn('[会话管理] 血氧数据上传失败，重新加入缓冲区')
        // 上传失败，重新加入缓冲区头部
        this.hboDataBuffer.unshift(...batchToUpload)
      }
    } catch (error) {
      console.error('[会话管理] 批量上传异常:', error)
      // 异常情况下也重新加入缓冲区
      this.hboDataBuffer.unshift(...batchToUpload)
    }
  }

  /**
   * 暂停会话（保持会话活跃但暂停数据收集）
   */
  pauseSession() {
    if (this.currentSession) {
      this.currentSession.status = 'paused'
      this.stopBatchUpload()
      console.log('[会话管理] 会话已暂停')
    }
  }

  /**
   * 恢复会话
   */
  resumeSession() {
    if (this.currentSession) {
      this.currentSession.status = 'active'
      if (this.cloudEnabled) this.startBatchUpload()
      console.log('[会话管理] 会话已恢复')
    }
  }

  /**
   * 结束当前会话
   * @param {Object} finalData - 最终会话数据
   * @returns {Promise<Object>} 结束结果
   */
  async endSession(finalData = {}) {
    if (!this.currentSession) {
      console.warn('[会话管理] 没有活动会话需要结束')
      return { success: false, error: '没有活动会话' }
    }

    try {
      console.log('[会话管理] 结束会话:', this.currentSession.session_id)

      // 停止定时上传
      this.stopBatchUpload()

      // 上传剩余数据（仅云端可用时）
      if (this.cloudEnabled && this.hboDataBuffer.length > 0) {
        console.log(`[会话管理] 上传剩余数据: ${this.hboDataBuffer.length} 个数据点`)
        await this.uploadBatchData()
      }

      // 更新会话结束信息
      this.currentSession.session_end = new Date().toISOString()
      this.currentSession.status = 'completed'
      this.currentSession.duration = Date.parse(this.currentSession.session_end) - 
                                     Date.parse(this.currentSession.session_start)
      
      // 合并最终数据和统计信息
      const completeSessionData = {
        ...this.currentSession,
        ...finalData,
        session_stats: this.sessionStats,
        final_hbo_avg: this.sessionStats.avgHBO,
        final_hbo_max: this.sessionStats.maxHBO,
        final_hbo_min: this.sessionStats.minHBO,
        final_quality_score: this.sessionStats.qualityScore,
        total_data_points: this.sessionStats.totalDataPoints
      }

      // 上传完整会话数据
      let result = { success: true }
      if (this.cloudEnabled && localStorage.getItem('current_session_id')) {
        result = await cloudAPI.completeTrainingSession(completeSessionData)
      }
      
      if (result.success) {
        console.log('[会话管理] 会话完成并上传成功')
      } else {
        console.warn('[会话管理] 会话数据上传失败，本地保存')
        // 保存到本地待重试
        localStorage.setItem(`offline_session_${this.currentSession.session_id}`, 
                           JSON.stringify(completeSessionData))
      }

      // 清理当前会话
      const completedSession = { ...this.currentSession }
      this.currentSession = null
      this.hboDataBuffer = []

      // 清理本地存储
      localStorage.removeItem('current_session')

      return {
        success: true,
        session_data: completedSession,
        stats: this.sessionStats
      }
    } catch (error) {
      console.error('[会话管理] 结束会话失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取当前会话状态
   * @returns {Object} 会话状态信息
   */
  getSessionStatus() {
    if (!this.currentSession) {
      return {
        active: false,
        session: null,
        stats: null
      }
    }

    return {
      active: true,
      session: { ...this.currentSession },
      stats: { ...this.sessionStats },
      buffer_size: this.hboDataBuffer.length,
      next_upload_in: this.uploadTimer ? this.uploadInterval : 0
    }
  }

  /**
   * 恢复会话（改进版本 - 完整验证和状态检查）
   * @returns {Promise<Object>} 恢复结果
   */
  async restoreSession() {
    try {
      console.log('[会话管理] 开始恢复会话...')

      // 1. 检查本地存储的会话数据
      const savedSession = localStorage.getItem('current_session')
      if (!savedSession) {
        console.log('[会话管理] 没有找到需要恢复的会话')
        return { success: false, error: '没有需要恢复的会话' }
      }

      let sessionData
      try {
        sessionData = JSON.parse(savedSession)
      } catch (parseError) {
        console.error('[会话管理] 会话数据解析失败:', parseError)
        localStorage.removeItem('current_session')
        return { success: false, error: '会话数据已损坏' }
      }

      // 2. 验证会话数据完整性
      const validationResult = this.validateSessionData(sessionData)
      if (!validationResult.valid) {
        console.warn('[会话管理] 会话数据验证失败:', validationResult.errors)
        localStorage.removeItem('current_session')
        return {
          success: false,
          error: `会话数据不完整: ${validationResult.errors.join(', ')}`
        }
      }

      // 3. 检查会话是否过期
      const sessionAge = Date.now() - Date.parse(sessionData.session_start)
      const maxSessionAge = 8 * 60 * 60 * 1000 // 8小时

      if (sessionAge > maxSessionAge) {
        console.warn(`[会话管理] 会话已过期，年龄: ${Math.round(sessionAge / 1000 / 60)} 分钟`)

        // 保存过期会话到历史记录
        await this.archiveExpiredSession(sessionData)
        localStorage.removeItem('current_session')

        return { success: false, error: '会话已过期' }
      }

      // 4. 检查患者信息是否还存在
      const patientId = sessionData.patient_id
      if (!this.validatePatientExists(patientId)) {
        console.warn('[会话管理] 患者信息不存在或已被删除:', patientId)
        localStorage.removeItem('current_session')
        return { success: false, error: '关联的患者信息不存在' }
      }

      // 5. 检查云端会话状态（如果启用云端模式）
      if (this.cloudMode === 'realtime') {
        const cloudSessionValid = await this.validateCloudSession(sessionData.session_id)
        if (!cloudSessionValid) {
          console.warn('[会话管理] 云端会话已失效')
          // 不直接失败，而是切换到离线模式
          this.cloudMode = 'disabled'
          this.cloudEnabled = false
        }
      }

      // 6. 恢复会话状态
      this.currentSession = {
        ...sessionData,
        // 更新恢复时间
        restored_at: new Date().toISOString(),
        // 标记为已恢复
        is_restored: true
      }

      // 7. 恢复数据缓冲区和统计信息
      await this.restoreSessionBuffer(sessionData.session_id)

      // 8. 重新启动定时器（如果需要）
      if (this.cloudEnabled && sessionData.status === 'active') {
        this.startBatchUpload()
        console.log('[会话管理] 重新启动批量上传定时器')
      }

      // 9. 启动自动保存
      this.startAutoSave()

      // 10. 更新本地存储
      localStorage.setItem('current_session', JSON.stringify(this.currentSession))

      console.log(`[会话管理] 会话恢复成功: ${sessionData.session_id}`)
      console.log(`[会话管理] 会话详情:`, {
        sessionId: sessionData.session_id,
        patientId: sessionData.patient_id,
        mode: sessionData.training_mode,
        age: Math.round(sessionAge / 1000 / 60) + ' 分钟',
        cloudEnabled: this.cloudEnabled
      })

      return {
        success: true,
        session_data: this.currentSession,
        restored_from_age: sessionAge
      }

    } catch (error) {
      console.error('[会话管理] 恢复会话失败:', error)

      // 清理可能损坏的数据
      localStorage.removeItem('current_session')

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 验证会话数据完整性
   */
  validateSessionData(sessionData) {
    const errors = []
    const requiredFields = [
      'session_id',
      'patient_id',
      'training_mode',
      'session_start',
      'status'
    ]

    // 检查必需字段
    requiredFields.forEach(field => {
      if (!sessionData[field]) {
        errors.push(`缺少必需字段: ${field}`)
      }
    })

    // 检查字段格式
    if (sessionData.session_id && !sessionData.session_id.startsWith('SESSION_')) {
      errors.push('会话ID格式无效')
    }

    if (sessionData.training_mode &&
        !['brain', 'heatmap', 'curve', 'game'].includes(sessionData.training_mode)) {
      errors.push('训练模式无效')
    }

    if (sessionData.session_start && isNaN(Date.parse(sessionData.session_start))) {
      errors.push('会话开始时间格式无效')
    }

    return {
      valid: errors.length === 0,
      errors: errors
    }
  }

  /**
   * 验证患者是否还存在
   */
  validatePatientExists(patientId) {
    // 检查本地存储
    const currentPatientId = localStorage.getItem('current_patient_id')
    if (currentPatientId === patientId) {
      return true
    }

    // 检查患者信息是否在缓存中
    const userCache = localStorage.getItem('user_data_cache')
    if (userCache) {
      try {
        const cache = JSON.parse(userCache)
        const patient = cache.users?.find(u => u.patient_id === patientId)
        return !!patient
      } catch (error) {
        console.warn('[会话管理] 用户缓存解析失败:', error)
      }
    }

    return false
  }

  /**
   * 验证云端会话状态
   */
  async validateCloudSession(sessionId) {
    try {
      // 这里应该调用实际的云端API检查会话状态
      const response = await fetch(`${this.apiUrl}/api/sessions/${sessionId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })

      if (response.ok) {
        const data = await response.json()
        return data.active === true
      }

      return false
    } catch (error) {
      console.warn('[会话管理] 云端会话验证失败:', error)
      return false // 网络错误时默认为无效
    }
  }

  /**
   * 恢复会话数据缓冲区
   */
  async restoreSessionBuffer(sessionId) {
    try {
      // 尝试从本地存储恢复缓冲区数据
      const bufferKey = `session_buffer_${sessionId}`
      const savedBuffer = localStorage.getItem(bufferKey)

      if (savedBuffer) {
        const bufferData = JSON.parse(savedBuffer)

        // 恢复血氧数据缓冲区
        if (bufferData.hboDataBuffer && Array.isArray(bufferData.hboDataBuffer)) {
          this.hboDataBuffer = bufferData.hboDataBuffer
          console.log(`[会话管理] 恢复数据缓冲区: ${this.hboDataBuffer.length} 个数据点`)
        }

        // 恢复统计信息
        if (bufferData.sessionStats) {
          this.sessionStats = { ...this.sessionStats, ...bufferData.sessionStats }
          console.log('[会话管理] 恢复会话统计信息')
        }
      }
    } catch (error) {
      console.warn('[会话管理] 恢复缓冲区数据失败:', error)
      // 不抛出错误，继续恢复会话
    }
  }

  /**
   * 归档过期会话
   */
  async archiveExpiredSession(sessionData) {
    try {
      const archivedSessions = JSON.parse(
        localStorage.getItem('archived_sessions') || '[]'
      )

      archivedSessions.push({
        ...sessionData,
        archived_at: new Date().toISOString(),
        reason: 'expired'
      })

      // 只保留最近10个归档会话
      if (archivedSessions.length > 10) {
        archivedSessions.splice(0, archivedSessions.length - 10)
      }

      localStorage.setItem('archived_sessions', JSON.stringify(archivedSessions))
      console.log('[会话管理] 过期会话已归档:', sessionData.session_id)
    } catch (error) {
      console.warn('[会话管理] 归档过期会话失败:', error)
    }
  }

  /**
   * 改进的会话保存方法
   */
  saveSessionToLocal() {
    if (!this.currentSession) {
      return
    }

    try {
      // 保存会话数据
      const sessionToSave = {
        ...this.currentSession,
        last_saved: new Date().toISOString()
      }

      localStorage.setItem('current_session', JSON.stringify(sessionToSave))

      // 保存缓冲区数据（分离存储）
      const bufferKey = `session_buffer_${this.currentSession.session_id}`
      const bufferData = {
        hboDataBuffer: this.hboDataBuffer.slice(), // 创建副本
        sessionStats: { ...this.sessionStats },
        saved_at: new Date().toISOString()
      }

      localStorage.setItem(bufferKey, JSON.stringify(bufferData))

      console.log(`[会话管理] 会话数据已保存: ${this.currentSession.session_id}`)

    } catch (error) {
      console.error('[会话管理] 保存会话数据失败:', error)
    }
  }

  /**
   * 定期保存会话数据（每30秒）
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
    }

    this.autoSaveTimer = setInterval(() => {
      if (this.currentSession && this.currentSession.status === 'active') {
        this.saveSessionToLocal()
      }
    }, 30 * 1000) // 每30秒保存一次

    console.log('[会话管理] 自动保存定时器已启动')
  }

  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
      console.log('[会话管理] 自动保存定时器已停止')
    }
  }
}

// 导出单例实例
export const sessionManager = new SessionManager()

// 导出类用于多实例
export default SessionManager