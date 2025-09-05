/**
 * 截图工具模块
 * 用于捕获训练界面和评估报告的高质量截图
 * 支持热力图、评估界面等关键区域截图
 */

import html2canvas from 'html2canvas'

/**
 * 通用元素截图功能
 * @param {string} selector - CSS选择器
 * @param {Object} options - html2canvas选项
 * @returns {Promise<string>} Base64格式的图片数据
 */
export async function captureElement(selector, options = {}) {
  try {
    const element = document.querySelector(selector)
    if (!element) {
      console.warn(`[截图工具] 未找到元素: ${selector}`)
      return null
    }

    // 确保元素可见且已渲染
    if (element.offsetParent === null) {
      console.warn(`[截图工具] 元素不可见: ${selector}`)
      return null
    }

    // 默认截图配置
    const defaultOptions = {
      useCORS: true,                    // 支持跨域图片
      scale: 2,                         // 高分辨率截图
      backgroundColor: '#ffffff',       // 白色背景
      logging: false,                   // 关闭调试日志
      ignoreElements: (element) => {    // 忽略某些元素
        return element.classList.contains('no-screenshot')
      },
      ...options
    }

    console.log(`[截图工具] 开始截图: ${selector}`)
    const canvas = await html2canvas(element, defaultOptions)
    
    const dataURL = canvas.toDataURL('image/png', 0.95) // 高质量PNG
    console.log(`[截图工具] 截图完成: ${dataURL.length} 字符`)
    
    // 返回标准化的结果格式
    return {
      success: true,
      dataUrl: dataURL,
      width: canvas.width,
      height: canvas.height,
      selector: selector,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('[截图工具] 截图失败:', error)
    return null
  }
}

/**
 * 截图专业大脑模式热力图
 * @param {Object} options - 自定义选项
 * @returns {Promise<string>} 热力图截图的Base64数据
 */
export async function captureHeatmap(options = {}) {
  // 尝试多个可能的热力图容器选择器
  const selectors = [
    '.brain-heatmap-container',      // 主要热力图容器
    '.heatmap-canvas-container',     // Canvas热力图容器
    '.professional-brain-mode',      // 专业大脑模式容器
    '[data-testid="heatmap-view"]'   // 测试用选择器
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element && element.offsetParent !== null) {
      console.log(`[截图工具] 发现热力图容器: ${selector}`)
      
      return await captureElement(selector, {
        width: 800,                    // 固定宽度确保一致性
        height: 600,                   // 固定高度确保一致性
        backgroundColor: '#1a1a1a',    // 深色背景适合热力图
        ...options
      })
    }
  }

  console.warn('[截图工具] 未找到热力图容器')
  return null
}

/**
 * 截图评估报告界面
 * @param {Object} options - 自定义选项  
 * @returns {Promise<string>} 评估报告截图的Base64数据
 */
export async function captureAssessment(options = {}) {
  // 尝试多个可能的评估界面选择器
  const selectors = [
    '.obelab-assessment-view',      // 实际使用的评估容器（优先）
    '.assessment-grid',             // 评估网格容器
    '.main-content',                // 主内容区域
    '.assessment-container',         // 主要评估容器
    '.assessment-report',           // 评估报告容器
    '.evaluation-results',          // 评估结果容器
    '[data-testid="assessment-view"]' // 测试用选择器
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element && element.offsetParent !== null) {
      console.log(`[截图工具] 发现评估容器: ${selector}`)
      
      return await captureElement(selector, {
        width: 1200,                   // 评估报告需要更大宽度
        height: 900,                   // 更大高度包含完整报告
        backgroundColor: '#ffffff',    // 白色背景适合报告
        ...options
      })
    }
  }

  console.warn('[截图工具] 未找到评估报告容器')
  return null
}

/**
 * 截图训练数据曲线
 * @param {Object} options - 自定义选项
 * @returns {Promise<string>} 数据曲线截图的Base64数据
 */
export async function captureCurveMode(options = {}) {
  const selectors = [
    '.curve-chart-container',        // ECharts曲线图容器
    '.training-data-curves',         // 训练数据曲线
    '.echarts-for-react',           // React ECharts组件
    '[data-testid="curve-view"]'     // 测试用选择器
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element && element.offsetParent !== null) {
      console.log(`[截图工具] 发现曲线图容器: ${selector}`)
      
      return await captureElement(selector, {
        width: 1000,
        height: 400,
        backgroundColor: '#ffffff',
        ...options
      })
    }
  }

  console.warn('[截图工具] 未找到数据曲线容器')
  return null
}

/**
 * 等待元素完全加载后截图
 * @param {string} selector - CSS选择器
 * @param {number} timeout - 超时时间（毫秒）
 * @param {Object} options - 截图选项
 * @returns {Promise<string>} 截图的Base64数据
 */
export async function captureWhenReady(selector, timeout = 5000, options = {}) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    
    const checkElement = () => {
      const element = document.querySelector(selector)
      const isReady = element && 
                     element.offsetParent !== null && 
                     element.offsetWidth > 0 && 
                     element.offsetHeight > 0
      
      if (isReady) {
        console.log(`[截图工具] 元素已就绪: ${selector}`)
        captureElement(selector, options).then(resolve)
      } else if (Date.now() - startTime > timeout) {
        console.warn(`[截图工具] 等待超时: ${selector}`)
        resolve(null)
      } else {
        setTimeout(checkElement, 100) // 100ms后重试
      }
    }
    
    checkElement()
  })
}

/**
 * 批量截图多个区域
 * @param {Array} targets - 截图目标数组 [{selector, name, options}]
 * @returns {Promise<Object>} 包含所有截图的对象
 */
export async function captureMultiple(targets) {
  const results = {}
  
  for (const target of targets) {
    const { selector, name, options = {} } = target
    console.log(`[截图工具] 批量截图: ${name}`)
    
    const screenshot = await captureElement(selector, options)
    results[name] = screenshot
  }
  
  return results
}

/**
 * 压缩截图数据 (降低质量减小文件大小)
 * @param {string} dataURL - Base64图片数据
 * @param {number} quality - 压缩质量 (0-1)
 * @returns {Promise<string>} 压缩后的Base64数据
 */
export async function compressScreenshot(dataURL, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      canvas.width = img.width
      canvas.height = img.height
      
      ctx.drawImage(img, 0, 0)
      const compressedDataURL = canvas.toDataURL('image/jpeg', quality)
      
      console.log(`[截图工具] 压缩完成: ${dataURL.length} -> ${compressedDataURL.length}`)
      resolve(compressedDataURL)
    }
    img.src = dataURL
  })
}

/**
 * 获取截图元数据
 * @param {string} selector - 元素选择器
 * @returns {Object} 截图元数据
 */
export function getScreenshotMetadata(selector) {
  const element = document.querySelector(selector)
  if (!element) return null
  
  const rect = element.getBoundingClientRect()
  return {
    selector,
    timestamp: new Date().toISOString(),
    dimensions: {
      width: rect.width,
      height: rect.height
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    userAgent: navigator.userAgent
  }
}