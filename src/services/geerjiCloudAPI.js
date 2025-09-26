/**
 * 戈尔基康复训练系统云端API客户端
 * 负责与服务器 (36.134.11.254:5002) 的所有数据通信
 * 支持患者信息、训练会话、血氧数据、截图上传
 * 【2025-09-20更新】添加API认证机制
 */

import { apiClient } from '../utils/apiClient.js'
import { handleApiError } from '../utils/errorHandler.js'

// 戈尔基云端API配置
const API_BASE_URL = 'http://36.134.11.254:5002'
const API_TIMEOUT = 30000 // 30秒超时

/**
 * 戈尔基云端API客户端类
 * 【2025-09-20升级】使用增强型API客户端，支持重试和断路器
 */
export class GeerjiCloudAPI {
  constructor() {
    this.apiUrl = API_BASE_URL
    this.timeout = API_TIMEOUT

    // 使用新的API客户端
    this.client = apiClient

    console.log('[戈尔基云端] API客户端初始化完成 - 支持重试、断路器、缓存')
  }

  /**
   * 通用HTTP请求方法（重写版本）
   * @private
   * @param {string} endpoint - API端点
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} API响应
   */
  async _request(endpoint, options = {}) {
    try {
      console.log(`[戈尔基云端] 增强请求: ${options.method || 'GET'} ${endpoint}`)

      // 使用新的API客户端（自动包含认证、重试、断路器等功能）
      const result = await this.client.request(endpoint, {
        ...options,
        timeout: this.timeout
      })

      console.log(`[戈尔基云端] 请求成功: ${JSON.stringify(result.data).substring(0, 100)}...`)

      return result
    } catch (error) {
      console.error('[戈尔基云端] 请求失败:', error)

      // 使用统一错误处理
      const errorInfo = handleApiError(error, endpoint)

      return {
        success: false,
        error: errorInfo.userMessage.message,
        errorType: errorInfo.type,
        status: error.status || 0
      }
    }
  }

  /**
   * 上传患者档案信息
   * @param {Object} patientData - 患者信息
   * @returns {Promise<Object>} 上传结果
   */
  async uploadPatientProfile(patientData) {
    try {
      // 生成患者ID（如果没有）
      const patientId = patientData.patient_id || `PATIENT_${Date.now()}`
      
      // 格式化患者数据以匹配数据库schema
      const formattedData = {
        patient_id: patientId,
        name: patientData.name || '未知患者',
        name_masked: this._maskName(patientData.name),
        age: patientData.age || null,
        gender: patientData.gender || null,
        phone: patientData.phone || null,
        height: patientData.height || null,
        weight: patientData.weight || null,
        bmi: patientData.bmi || null,
        blood_pressure_systolic: patientData.bloodPressure?.systolic || null,
        blood_pressure_diastolic: patientData.bloodPressure?.diastolic || null,
        hypertension: patientData.conditions?.hypertension || false,
        diabetes: patientData.conditions?.diabetes || false,
        smoking: patientData.conditions?.smoking || false,
        heart_disease: patientData.conditions?.heartDisease || false,
        dyslipidemia: patientData.conditions?.dyslipidemia || false,
        risk_level: patientData.risk_level || this._calculateRiskLevel(patientData),
        diagnosis: '康复训练评估',
        onset_time: patientData.onset_time || null
      }

      console.log('[戈尔基云端] 上传患者档案:', patientId)

      const result = await this._request('/api/upload/data', {
        method: 'POST',
        body: JSON.stringify({
          data_type: 'patient_profile',
          manufacturer: 'golgi',
          patient_info: JSON.stringify(formattedData)
        })
      })

      if (result.success) {
        console.log('[戈尔基云端] 患者档案上传成功')
        // 保存患者ID到本地，供后续会话使用
        localStorage.setItem('current_patient_id', patientId)
        
        return {
          success: true,
          patient_id: patientId,
          data: result.data
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[戈尔基云端] 患者档案上传失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 创建训练会话
   * @param {Object} sessionData - 会话数据
   * @returns {Promise<Object>} 创建结果
   */
  async createTrainingSession(sessionData) {
    try {
      const sessionId = sessionData.session_id || `SESSION_${Date.now()}`
      const patientId = sessionData.patient_id || localStorage.getItem('current_patient_id')

      if (!patientId) {
        throw new Error('未找到患者ID，请先完成患者信息登记')
      }

      const formattedSession = {
        session_id: sessionId,
        patient_id: patientId,
        session_start: sessionData.session_start || new Date().toISOString(),
        training_mode: sessionData.training_mode || 'brain',
        created_at: new Date().toISOString()
      }

      console.log('[戈尔基云端] 创建训练会话:', sessionId)

      const result = await this._request('/api/upload/data', {
        method: 'POST',
        body: JSON.stringify({
          data_type: 'training_session',
          manufacturer: 'golgi',
          session_data: JSON.stringify(formattedSession)
        })
      })

      if (result.success) {
        console.log('[戈尔基云端] 训练会话创建成功')
        localStorage.setItem('current_session_id', sessionId)
        
        return {
          success: true,
          session_id: sessionId,
          data: result.data
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[戈尔基云端] 训练会话创建失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 上传截图数据
   * @param {string} screenshotBase64 - Base64格式截图
   * @param {Object} metadata - 截图元数据
   * @returns {Promise<Object>} 上传结果
   */
  async uploadScreenshot(screenshotBase64, metadata = {}) {
    try {
      const sessionId = metadata.session_id || localStorage.getItem('current_session_id')
      const screenshotType = metadata.type || 'assessment'

      if (!sessionId) {
        throw new Error('未找到会话ID，请先开始训练')
      }

      console.log('[戈尔基云端] 上传截图:', screenshotType)

      // 转换Base64为Blob用于文件上传
      const blob = this._dataURLToBlob(screenshotBase64)
      const formData = new FormData()
      
      formData.append('data_type', 'screenshot')
      formData.append('manufacturer', 'golgi')
      formData.append('session_id', sessionId)
      formData.append('report_type', screenshotType)
      formData.append('mime_type', 'image/png')
      formData.append('metadata', JSON.stringify({
        type: screenshotType,
        timestamp: new Date().toISOString(),
        dimensions: metadata.dimensions || {},
        file_size: blob.size
      }))
      formData.append('screenshot_file', blob, `${screenshotType}_${sessionId}.png`)

      const result = await this._request('/api/upload/data', {
        method: 'POST',
        headers: {}, // 让浏览器设置Content-Type for FormData
        body: formData
      })

      if (result.success) {
        console.log('[戈尔基云端] 截图上传成功')
        return {
          success: true,
          data: result.data
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[戈尔基云端] 截图上传失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 批量上传血氧数据点
   * @param {Array} hboDataPoints - 血氧数据点数组
   * @returns {Promise<Object>} 上传结果
   */
  async uploadHBODataBatch(hboDataPoints) {
    try {
      const sessionId = localStorage.getItem('current_session_id')
      if (!sessionId) {
        throw new Error('未找到会话ID，请先开始训练')
      }

      console.log(`[戈尔基云端] 批量上传血氧数据: ${hboDataPoints.length} 个数据点`)

      const batchData = {
        session_id: sessionId,
        data_points: hboDataPoints.map(point => ({
          timestamp_ms: point.timestamp || Date.now(),
          hbo_value: point.hbo || point.value || 0,
          channel_id: point.channel_id || null,
          data_quality: point.quality || null
        })),
        upload_timestamp: new Date().toISOString()
      }

      const result = await this._request('/api/upload/data', {
        method: 'POST',
        body: JSON.stringify({
          data_type: 'hbo_batch',
          manufacturer: 'golgi',
          batch_data: JSON.stringify(batchData)
        })
      })

      if (result.success) {
        console.log('[戈尔基云端] 血氧数据批量上传成功')
        return {
          success: true,
          data: result.data
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[戈尔基云端] 血氧数据上传失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 完成训练会话并上传完整数据
   * @param {Object} completeSessionData - 完整会话数据
   * @returns {Promise<Object>} 上传结果
   */
  async completeTrainingSession(completeSessionData) {
    try {
      const sessionId = localStorage.getItem('current_session_id')
      if (!sessionId) {
        throw new Error('未找到会话ID，请先开始训练')
      }

      console.log('[戈尔基云端] 完成训练会话:', sessionId)

      // 更新会话完成信息
      const sessionUpdate = {
        session_id: sessionId,
        session_end: new Date().toISOString(),
        total_duration: completeSessionData.duration || null,
        hbo_avg: completeSessionData.hbo_avg || null,
        hbo_max: completeSessionData.hbo_max || null,
        hbo_min: completeSessionData.hbo_min || null,
        data_quality_score: completeSessionData.quality_score || null,
        assessment_summary: completeSessionData.assessment_summary || null
      }

      const result = await this._request('/api/upload/complete_session', {
        method: 'POST',
        body: JSON.stringify({
          session_update: sessionUpdate,
          complete_data: completeSessionData,
          manufacturer: 'golgi'
        })
      })

      if (result.success) {
        console.log('[戈尔基云端] 训练会话完成')
        // 清理本地会话数据
        localStorage.removeItem('current_session_id')
        
        return {
          success: true,
          data: result.data
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[戈尔基云端] 训练会话完成失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 检查服务器连接状态
   * @returns {Promise<Object>} 连接状态
   */
  async checkConnection() {
    try {
      console.log('[戈尔基云端] 检查服务器连接')
      
      const result = await this._request('/api/health', {
        method: 'GET'
      })

      return {
        connected: result.success,
        server_info: result.data || null,
        error: result.error || null
      }
    } catch (error) {
      console.error('[戈尔基云端] 连接检查失败:', error)
      return {
        connected: false,
        error: error.message
      }
    }
  }

  /**
   * 私有方法：姓名脱敏
   * @private
   * @param {string} name - 原始姓名
   * @returns {string} 脱敏后的姓名
   */
  _maskName(name) {
    if (!name || name.length < 2) return name
    
    const firstChar = name.charAt(0)
    const maskedPart = '*'.repeat(Math.min(name.length - 1, 9))
    return firstChar + maskedPart
  }

  /**
   * 私有方法：计算风险等级
   * @private
   * @param {Object} patientData - 患者数据
   * @returns {string} 风险等级
   */
  _calculateRiskLevel(patientData) {
    let riskScore = 0
    
    // 年龄风险
    if (patientData.age > 65) riskScore += 2
    else if (patientData.age > 45) riskScore += 1
    
    // BMI风险
    if (patientData.bmi > 30) riskScore += 2
    else if (patientData.bmi > 25) riskScore += 1
    
    // 健康状况风险
    const conditions = patientData.conditions || {}
    if (conditions.hypertension) riskScore += 2
    if (conditions.diabetes) riskScore += 2
    if (conditions.smoking) riskScore += 1
    if (conditions.heartDisease) riskScore += 3
    if (conditions.dyslipidemia) riskScore += 1
    
    // 风险等级判定
    if (riskScore >= 6) return 'high'
    if (riskScore >= 3) return 'medium'
    return 'low'
  }

  /**
   * 私有方法：Base64转Blob
   * @private
   * @param {string} dataURL - Base64数据URL
   * @returns {Blob} Blob对象
   */
  _dataURLToBlob(dataURL) {
    const arr = dataURL.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    
    return new Blob([u8arr], { type: mime })
  }
}

// 导出单例实例
export const cloudAPI = new GeerjiCloudAPI()

// 导出工具函数
export { GeerjiCloudAPI as default }