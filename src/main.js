import { createApp } from 'vue'
import App from './App.vue'
import { setupAuthInterceptor, validateAuthStatus } from './utils/apiAuth.js'
import { setupGlobalErrorHandling, handleError } from './utils/errorHandler.js'

// 初始化API认证系统
setupAuthInterceptor()

// 初始化全局错误处理
setupGlobalErrorHandling()

// 验证认证状态
const authStatus = validateAuthStatus()
console.log('[认证系统] API认证中间件初始化完成')
console.log('[认证系统] 认证状态:', authStatus)
console.log('[错误处理] 统一错误处理系统初始化完成')

const app = createApp(App)

// 配置Vue全局错误处理
app.config.errorHandler = (error, instance, info) => {
  console.error('Vue全局错误:', error, info)

  // 使用统一错误处理
  handleError(error, `Vue组件: ${info}`)
}

// 将错误处理器挂载到全局
app.config.globalProperties.$handleError = handleError
window.$handleError = handleError

app.mount('#app')