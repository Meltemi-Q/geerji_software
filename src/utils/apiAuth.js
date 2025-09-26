/**
 * API认证工具
 * 实现简单但有效的API密钥认证和请求签名
 */

// 生成API密钥
function generateApiKey() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const deviceId = localStorage.getItem('device_id') || generateDeviceId()

  // 简单的密钥生成算法
  const rawKey = `${deviceId}-${timestamp}-${random}`
  const apiKey = btoa(rawKey).replace(/[+/=]/g, '').substring(0, 32)

  return apiKey
}

// 生成设备唯一标识
function generateDeviceId() {
  const deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  localStorage.setItem('device_id', deviceId)
  return deviceId
}

// 生成请求签名
function generateSignature(method, url, timestamp, data = null) {
  const deviceId = localStorage.getItem('device_id')
  const apiKey = getApiKey()

  // 构建签名字符串
  let signatureString = `${method.toUpperCase()}|${url}|${timestamp}|${deviceId}`

  if (data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data)
    signatureString += `|${dataString}`
  }

  // 使用简单哈希算法（生产环境应使用HMAC-SHA256）
  const signature = btoa(signatureString + apiKey).replace(/[+/=]/g, '').substring(0, 16)

  return signature
}

// 获取或生成API密钥
function getApiKey() {
  let apiKey = localStorage.getItem('fnirs_api_key')
  if (!apiKey) {
    apiKey = generateApiKey()
    localStorage.setItem('fnirs_api_key', apiKey)
    console.log('[API认证] 生成新的API密钥')
  }
  return apiKey
}

// API请求认证头
export function getAuthHeaders(method, url, data = null) {
  const timestamp = Date.now()
  const deviceId = localStorage.getItem('device_id') || generateDeviceId()
  const apiKey = getApiKey()
  const signature = generateSignature(method, url, timestamp, data)

  return {
    'X-API-Key': apiKey,
    'X-Device-ID': deviceId,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
    'X-Client-Version': '1.0.0',
    'X-Client-Type': 'jiemian_zonghe'
  }
}

// 请求拦截器（用于自动添加认证头）
export function setupAuthInterceptor() {
  console.log('[API认证] 初始化认证拦截器')

  // 如果使用fetch，包装原生fetch
  const originalFetch = window.fetch
  window.fetch = function(url, options = {}) {
    // 只对通用后端API添加认证头；对本地 fNIRS 数据端口或 /api/fnirs/* 不加头以避免 CORS 预检失败
    try {
      const u = new URL(url, window.location.href)
      const isFnirsEndpoint = u.pathname.startsWith('/api/fnirs/') || u.host === 'localhost:8090'
      if (isFnirsEndpoint) {
        return originalFetch.call(this, url, options)
      }
    } catch (e) {
      // URL 解析失败则走原逻辑
    }

    if (String(url).includes('/api/')) {
      const method = options.method || 'GET'
      const authHeaders = getAuthHeaders(method, url, options.body)

      options.headers = {
        ...options.headers,
        ...authHeaders
      }

      console.log(`[API认证] 为 ${method} ${url} 添加认证头`)
    }

    return originalFetch.call(this, url, options)
  }

  console.log('[API认证] 认证拦截器设置完成')
}

// 验证认证状态
export function validateAuthStatus() {
  const apiKey = localStorage.getItem('fnirs_api_key')
  const deviceId = localStorage.getItem('device_id')

  return {
    hasApiKey: !!apiKey,
    hasDeviceId: !!deviceId,
    apiKeyLength: apiKey?.length || 0,
    deviceId: deviceId?.substring(0, 10) + '***' // 脱敏显示
  }
}

// 重新生成认证信息
export function regenerateAuth() {
  localStorage.removeItem('fnirs_api_key')
  localStorage.removeItem('device_id')

  const newApiKey = getApiKey()
  const newDeviceId = generateDeviceId()

  console.log('[API认证] 重新生成认证信息')

  return {
    apiKey: newApiKey.substring(0, 8) + '***', // 脱敏显示
    deviceId: newDeviceId.substring(0, 10) + '***'
  }
}

export default {
  getAuthHeaders,
  setupAuthInterceptor,
  validateAuthStatus,
  regenerateAuth,
  generateApiKey,
  getApiKey
}