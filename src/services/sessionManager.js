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

      // 上传到云端
      const createResult = await cloudAPI.createTrainingSession(sessionData)
      if (!createResult.success) {
        console.warn('[会话管理] 云端会话创建失败，继续本地操作')
      }

      // 设置当前会话
      this.currentSession = sessionData
      
      // 重置数据缓冲区和统计
      this.hboDataBuffer = []
      this.sessionStats = {
        totalDataPoints: 0,
        avgHBO: 0,
        maxHBO: 0,
        minHBO: 0,
        qualityScore: 0
      }

      // 启动定期上传
      this.startBatchUpload()

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

    // 检查是否需要批量上传
    if (this.hboDataBuffer.length >= this.batchSize) {
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
      this.startBatchUpload()
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

      // 上传剩余数据
      if (this.hboDataBuffer.length > 0) {
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
      const result = await cloudAPI.completeTrainingSession(completeSessionData)
      
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
   * 恢复会话（从本地存储或异常中断后）
   * @returns {Promise<Object>} 恢复结果
   */
  async restoreSession() {
    try {
      const savedSession = localStorage.getItem('current_session')
      if (!savedSession) {
        return { success: false, error: '没有需要恢复的会话' }
      }

      const sessionData = JSON.parse(savedSession)
      
      // 检查会话是否过期（超过2小时）
      const sessionAge = Date.now() - Date.parse(sessionData.session_start)
      if (sessionAge > 2 * 60 * 60 * 1000) {
        console.warn('[会话管理] 会话已过期，清理本地数据')
        localStorage.removeItem('current_session')
        return { success: false, error: '会话已过期' }
      }

      console.log('[会话管理] 恢复会话:', sessionData.session_id)
      
      this.currentSession = sessionData
      this.startBatchUpload()

      return {
        success: true,
        session_data: this.currentSession
      }
    } catch (error) {
      console.error('[会话管理] 恢复会话失败:', error)
      localStorage.removeItem('current_session')
      return {
        success: false,
        error: error.message
      }
    }
  }
}

// 导出单例实例
export const sessionManager = new SessionManager()

// 导出类用于多实例
export default SessionManager