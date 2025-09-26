/**
 * 带重试机制的API客户端
 * 支持指数退避、断路器模式、请求队列
 */

import { handleApiError } from './errorHandler.js'
import { getAuthHeaders } from './apiAuth.js'

class APIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || ''
    this.timeout = options.timeout || 30000
    this.maxRetries = options.maxRetries || 3
    this.retryDelay = options.retryDelay || 1000
    this.retryMultiplier = options.retryMultiplier || 2

    // 断路器配置
    this.circuitBreaker = {
      enabled: options.circuitBreaker !== false,
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failures: 0,
      lastFailureTime: null
    }

    // 请求队列（限制并发）
    this.requestQueue = []
    this.activeRequests = 0
    this.maxConcurrent = options.maxConcurrent || 10

    // 请求缓存
    this.requestCache = new Map()
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000 // 5分钟

    console.log('[API客户端] 增强型API客户端初始化完成')
  }

  /**
   * 主要的请求方法
   */
  async request(url, options = {}) {
    const fullUrl = this.baseURL + url
    const method = options.method || 'GET'

    // 检查缓存（仅GET请求）
    if (method === 'GET') {
      const cached = this.getFromCache(fullUrl)
      if (cached) {
        console.log(`[API缓存] 命中缓存: ${method} ${url}`)
        return cached
      }
    }

    // 检查断路器状态
    if (this.circuitBreaker.enabled && !this.canMakeRequest()) {
      throw new Error('服务暂时不可用，请稍后重试')
    }

    // 限制并发请求
    if (this.activeRequests >= this.maxConcurrent) {
      console.log(`[API队列] 等待请求槽位，当前活跃请求: ${this.activeRequests}`)
      await this.waitForSlot()
    }

    try {
      this.activeRequests++
      const result = await this.requestWithRetry(fullUrl, options)

      // 断路器：记录成功
      if (this.circuitBreaker.enabled) {
        this.onRequestSuccess()
      }

      // 缓存结果（仅GET请求且成功）
      if (method === 'GET' && result.success) {
        this.setCache(fullUrl, result)
      }

      return result

    } catch (error) {
      // 断路器：记录失败
      if (this.circuitBreaker.enabled) {
        this.onRequestFailure()
      }

      throw error
    } finally {
      this.activeRequests--
      this.processQueue()
    }
  }

  /**
   * 带重试的请求实现
   */
  async requestWithRetry(url, options, attempt = 1) {
    try {
      console.log(`[API重试] 尝试 ${attempt}/${this.maxRetries + 1}: ${options.method || 'GET'} ${url}`)

      const result = await this.makeHttpRequest(url, options)

      console.log(`[API重试] 成功: ${options.method || 'GET'} ${url}`)
      return result

    } catch (error) {
      console.warn(`[API重试] 尝试 ${attempt} 失败: ${error.message}`)

      // 检查是否应该重试
      if (attempt <= this.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateRetryDelay(attempt)
        console.log(`[API重试] ${delay}ms 后重试...`)

        await this.sleep(delay)
        return this.requestWithRetry(url, options, attempt + 1)
      }

      // 所有重试都失败了
      console.error(`[API重试] 最终失败: ${options.method || 'GET'} ${url}`)
      throw error
    }
  }

  /**
   * 实际的HTTP请求
   */
  async makeHttpRequest(url, options) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      // 添加认证头
      const authHeaders = getAuthHeaders(
        options.method || 'GET',
        url,
        options.body
      )

      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...options.headers
        },
        body: options.body,
        signal: controller.signal,
        ...options
      }

      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const errorText = await response.text()
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorText
        )
      }

      const data = await response.json()

      return {
        success: true,
        data: data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      }

    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(error) {
    // 不重试的错误类型
    const noRetryStatuses = [400, 401, 403, 404, 422]

    if (error instanceof APIError) {
      return !noRetryStatuses.includes(error.status)
    }

    // 网络错误通常可以重试
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'aborted'
    ]

    const errorMessage = error.message.toLowerCase()
    return retryableErrors.some(keyword => errorMessage.includes(keyword))
  }

  /**
   * 计算重试延迟（指数退避）
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.retryDelay
    const exponentialDelay = baseDelay * Math.pow(this.retryMultiplier, attempt - 1)

    // 添加随机抖动，避免雷群效应
    const jitter = Math.random() * 0.1 * exponentialDelay

    return Math.min(exponentialDelay + jitter, 30000) // 最大30秒
  }

  /**
   * 断路器逻辑
   */
  canMakeRequest() {
    const breaker = this.circuitBreaker

    switch (breaker.state) {
      case 'CLOSED':
        return true

      case 'OPEN':
        if (Date.now() - breaker.lastFailureTime > breaker.resetTimeout) {
          breaker.state = 'HALF_OPEN'
          console.log('[断路器] 转换为半开状态，尝试恢复')
          return true
        }
        return false

      case 'HALF_OPEN':
        return true

      default:
        return true
    }
  }

  onRequestSuccess() {
    const breaker = this.circuitBreaker

    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'CLOSED'
      breaker.failures = 0
      console.log('[断路器] 恢复正常，转换为关闭状态')
    }
  }

  onRequestFailure() {
    const breaker = this.circuitBreaker
    breaker.failures++
    breaker.lastFailureTime = Date.now()

    if (breaker.failures >= breaker.failureThreshold) {
      breaker.state = 'OPEN'
      console.log(`[断路器] 失败次数过多(${breaker.failures})，转换为开启状态`)
    }
  }

  /**
   * 请求队列管理
   */
  async waitForSlot() {
    return new Promise(resolve => {
      this.requestQueue.push(resolve)
    })
  }

  processQueue() {
    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const resolve = this.requestQueue.shift()
      resolve()
    }
  }

  /**
   * 缓存管理
   */
  getFromCache(url) {
    const cached = this.requestCache.get(url)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    if (cached) {
      this.requestCache.delete(url)
    }

    return null
  }

  setCache(url, data) {
    this.requestCache.set(url, {
      data: data,
      timestamp: Date.now()
    })

    // 清理过期缓存
    if (this.requestCache.size > 100) {
      this.cleanCache()
    }
  }

  cleanCache() {
    const now = Date.now()
    for (const [url, cached] of this.requestCache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.requestCache.delete(url)
      }
    }
  }

  /**
   * 便利方法
   */
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' })
  }

  async post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: typeof data === 'string' ? data : JSON.stringify(data)
    })
  }

  async put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: typeof data === 'string' ? data : JSON.stringify(data)
    })
  }

  async delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' })
  }

  /**
   * 工具方法
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取客户端状态
   */
  getStatus() {
    return {
      activeRequests: this.activeRequests,
      queueLength: this.requestQueue.length,
      cacheSize: this.requestCache.size,
      circuitBreaker: { ...this.circuitBreaker }
    }
  }

  /**
   * 清理资源
   */
  destroy() {
    this.requestQueue.length = 0
    this.requestCache.clear()
    this.activeRequests = 0
    console.log('[API客户端] 客户端已销毁')
  }
}

/**
 * 自定义API错误类
 */
class APIError extends Error {
  constructor(message, status, details = null) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.details = details
  }
}

// 创建默认实例
export const apiClient = new APIClient({
  baseURL: 'http://36.134.11.254:5002',
  timeout: 30000,
  maxRetries: 3,
  circuitBreaker: true
})

export { APIClient, APIError }
export default apiClient