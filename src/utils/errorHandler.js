/**
 * 统一错误处理器
 * 提供用户友好的错误消息和完整的错误日志
 */

// 错误类型定义
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  API_ERROR: 'API_ERROR',
  DATA_ERROR: 'DATA_ERROR',
  DEVICE_ERROR: 'DEVICE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

// 用户友好的错误消息映射
const USER_MESSAGES = {
  [ErrorTypes.NETWORK_ERROR]: {
    title: '网络连接异常',
    message: '请检查网络连接后重试',
    suggestion: '检查网络设置或联系技术支持',
    icon: '🌐'
  },
  [ErrorTypes.AUTH_ERROR]: {
    title: '认证失败',
    message: '登录状态已过期，请重新登录',
    suggestion: '点击重新登录按钮',
    icon: '🔐'
  },
  [ErrorTypes.API_ERROR]: {
    title: '服务异常',
    message: '服务器暂时不可用，请稍后重试',
    suggestion: '如问题持续，请联系技术支持',
    icon: '⚠️'
  },
  [ErrorTypes.DATA_ERROR]: {
    title: '数据错误',
    message: '数据加载失败，请刷新页面重试',
    suggestion: '检查数据完整性或联系管理员',
    icon: '📊'
  },
  [ErrorTypes.DEVICE_ERROR]: {
    title: '设备连接异常',
    message: 'fNIRS设备连接中断，请检查设备状态',
    suggestion: '检查设备连接线和电源',
    icon: '🔌'
  },
  [ErrorTypes.PERMISSION_ERROR]: {
    title: '权限不足',
    message: '您没有执行此操作的权限',
    suggestion: '联系管理员获取权限',
    icon: '🚫'
  },
  [ErrorTypes.VALIDATION_ERROR]: {
    title: '输入有误',
    message: '请检查输入信息是否正确',
    suggestion: '确保所有必填项都已正确填写',
    icon: '📝'
  }
}

// 错误分类函数
function categorizeError(error) {
  const errorStr = error.toString().toLowerCase()
  const statusCode = error.status || error.response?.status

  // 网络错误
  if (errorStr.includes('network') || errorStr.includes('timeout') ||
      errorStr.includes('connection') || errorStr.includes('cors') ||
      errorStr.includes('fetch')) {
    return ErrorTypes.NETWORK_ERROR
  }

  // HTTP状态码错误
  if (statusCode) {
    if (statusCode === 401) return ErrorTypes.AUTH_ERROR
    if (statusCode === 403) return ErrorTypes.PERMISSION_ERROR
    if (statusCode >= 400 && statusCode < 500) return ErrorTypes.VALIDATION_ERROR
    if (statusCode >= 500) return ErrorTypes.API_ERROR
  }

  // 认证相关错误
  if (errorStr.includes('认证失败') || errorStr.includes('登录') ||
      errorStr.includes('token') || errorStr.includes('unauthorized')) {
    return ErrorTypes.AUTH_ERROR
  }

  // 设备相关错误
  if (errorStr.includes('device') || errorStr.includes('serial') ||
      errorStr.includes('bluetooth') || errorStr.includes('usb') ||
      errorStr.includes('设备')) {
    return ErrorTypes.DEVICE_ERROR
  }

  // 数据相关错误
  if (errorStr.includes('data') || errorStr.includes('parse') ||
      errorStr.includes('json') || errorStr.includes('invalid') ||
      errorStr.includes('数据')) {
    return ErrorTypes.DATA_ERROR
  }

  return ErrorTypes.UNKNOWN_ERROR
}

// 错误日志记录
function logError(error, context, errorType) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    type: errorType,
    context: context,
    message: error.message,
    stack: error.stack,
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: localStorage.getItem('current_patient_id'),
    sessionId: localStorage.getItem('current_session_id'),
    deviceId: localStorage.getItem('device_id')
  }

  // 记录到控制台（开发环境）
  console.group(`🚨 [错误处理] ${errorType}`)
  console.error('错误详情:', error)
  console.info('上下文:', context)
  console.info('完整日志:', errorLog)
  console.groupEnd()

  // 保存到本地存储（用于后续上传）
  const localErrors = JSON.parse(localStorage.getItem('error_logs') || '[]')
  localErrors.push(errorLog)

  // 只保留最近50条错误
  if (localErrors.length > 50) {
    localErrors.splice(0, localErrors.length - 50)
  }

  localStorage.setItem('error_logs', JSON.stringify(localErrors))

  // 发送到服务器日志系统（异步，不阻塞主流程）
  sendErrorToServer(errorLog).catch(serverError => {
    console.warn('发送错误日志到服务器失败:', serverError)
  })
}

// 发送错误到服务器
async function sendErrorToServer(errorLog) {
  try {
    // 这里应该调用实际的日志API
    const response = await fetch('/api/logs/error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorLog),
      timeout: 5000 // 5秒超时，避免阻塞
    })

    if (!response.ok) {
      throw new Error(`日志服务器响应错误: ${response.status}`)
    }

    console.log('[错误处理] 错误日志已上传到服务器')
  } catch (error) {
    // 静默处理日志上传失败，避免递归错误
    console.warn('错误日志上传失败:', error.message)
  }
}

// 显示用户通知
function showUserNotification(errorType, customMessage = null) {
  const errorInfo = USER_MESSAGES[errorType] || USER_MESSAGES[ErrorTypes.UNKNOWN_ERROR]

  const notification = {
    type: 'error',
    title: errorInfo.title,
    message: customMessage || errorInfo.message,
    suggestion: errorInfo.suggestion,
    icon: errorInfo.icon,
    duration: 5000, // 5秒后自动关闭
    actions: [
      {
        text: '重试',
        action: 'retry'
      },
      {
        text: '反馈',
        action: 'feedback'
      }
    ]
  }

  // 使用自定义通知系统
  displayNotification(notification)
}

// 简单的通知显示实现
function displayNotification(notification) {
  // 创建通知元素
  const notificationEl = document.createElement('div')
  notificationEl.className = 'error-notification'
  notificationEl.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${notification.icon}</span>
      <div class="notification-text">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-message">${notification.message}</div>
        <div class="notification-suggestion">建议: ${notification.suggestion}</div>
      </div>
      <button class="notification-close">×</button>
    </div>
  `

  // 添加样式
  Object.assign(notificationEl.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: '#ff4444',
    color: 'white',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: '10000',
    maxWidth: '400px',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif'
  })

  // 添加到页面
  document.body.appendChild(notificationEl)

  // 关闭按钮事件
  const closeBtn = notificationEl.querySelector('.notification-close')
  closeBtn.addEventListener('click', () => {
    notificationEl.remove()
  })

  // 自动关闭
  setTimeout(() => {
    if (notificationEl.parentNode) {
      notificationEl.remove()
    }
  }, notification.duration)

  console.log('[错误处理] 显示用户通知:', notification.title)
}

// 主要的错误处理函数
export function handleError(error, context = '未知操作', options = {}) {
  const {
    showNotification = true,
    logToServer = true,
    customMessage = null,
    retryCallback = null
  } = options

  // 分类错误
  const errorType = categorizeError(error)

  // 记录错误日志
  if (logToServer) {
    logError(error, context, errorType)
  }

  // 显示用户通知
  if (showNotification) {
    showUserNotification(errorType, customMessage)
  }

  // 返回错误信息（供调用方使用）
  return {
    type: errorType,
    userMessage: USER_MESSAGES[errorType],
    originalError: error,
    canRetry: !!retryCallback
  }
}

// 特定场景的错误处理函数

// API调用错误
export function handleApiError(error, apiEndpoint) {
  return handleError(error, `API调用: ${apiEndpoint}`, {
    customMessage: '服务器通信失败，请检查网络连接'
  })
}

// 设备连接错误
export function handleDeviceError(error, deviceType) {
  return handleError(error, `设备连接: ${deviceType}`, {
    customMessage: `${deviceType}设备连接异常，请检查设备状态`
  })
}

// 数据处理错误
export function handleDataError(error, operation) {
  return handleError(error, `数据处理: ${operation}`, {
    customMessage: '数据处理失败，请重试或检查数据格式'
  })
}

// 用户输入验证错误
export function handleValidationError(error, fieldName) {
  return handleError(error, `输入验证: ${fieldName}`, {
    showNotification: false, // 验证错误通常在表单中显示
    logToServer: false
  })
}

// 获取错误统计
export function getErrorStatistics() {
  const errorLogs = JSON.parse(localStorage.getItem('error_logs') || '[]')

  const stats = {
    total: errorLogs.length,
    byType: {},
    byContext: {},
    recent: errorLogs.slice(-10),
    recentTime: errorLogs.length > 0 ? errorLogs[errorLogs.length - 1].timestamp : null
  }

  errorLogs.forEach(log => {
    stats.byType[log.type] = (stats.byType[log.type] || 0) + 1
    stats.byContext[log.context] = (stats.byContext[log.context] || 0) + 1
  })

  return stats
}

// 清理错误日志
export function clearErrorLogs() {
  localStorage.removeItem('error_logs')
  console.log('[错误处理] 错误日志已清理')
}

// 为全局错误设置监听器
export function setupGlobalErrorHandling() {
  // 全局未捕获Promise错误
  window.addEventListener('unhandledrejection', event => {
    console.error('未捕获的Promise错误:', event.reason)
    handleError(event.reason, 'Promise未捕获错误')
    event.preventDefault() // 阻止控制台显示
  })

  // 全局JavaScript错误
  window.addEventListener('error', event => {
    console.error('全局JavaScript错误:', event.error)
    handleError(event.error, `脚本错误: ${event.filename}:${event.lineno}`)
  })

  console.log('[错误处理] 全局错误监听器已设置')
}

export default {
  handleError,
  handleApiError,
  handleDeviceError,
  handleDataError,
  handleValidationError,
  getErrorStatistics,
  clearErrorLogs,
  setupGlobalErrorHandling,
  ErrorTypes
}