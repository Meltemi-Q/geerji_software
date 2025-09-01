/**
 * 训练组件共享逻辑
 * 从TrainingView.vue中提取的通用函数和工具
 */

export function trainingCommon() {
  // 格式化数值显示
  function formatValue(value) {
    if (typeof value !== 'number') return '0.000'
    return value.toFixed(3)
  }

  // 格式化时长显示 
  function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00'
    
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 获取康助侠状态颜色
  function getKangzhuxiaStatusColor() {
    return '#28a745' // 绿色表示连接
  }

  // 获取康助侠状态文本
  function getKangzhuxiaStatusText(status) {
    if (!status || !status.connected) return '未连接'
    
    switch(status.motion_status) {
      case 0: return '已连接'
      case 1: return '运动中'
      case 2: return '暂停中'
      default: return '已连接'
    }
  }

  // 获取运动状态文本
  function getMotionStatusText(status) {
    if (!status) return '未知'
    
    switch(status.motion_status) {
      case 0: return '待机'
      case 1: return '运动中'
      case 2: return '暂停'
      default: return '未知'
    }
  }

  // 获取运动状态CSS类名
  function getMotionStatusClass(status) {
    if (!status) return 'status-unknown'
    
    switch(status.motion_status) {
      case 0: return 'status-idle'
      case 1: return 'status-active' 
      case 2: return 'status-paused'
      default: return 'status-unknown'
    }
  }

  // 十六进制颜色转RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16), 
      b: parseInt(result[3], 16)
    } : null
  }

  // 获取热力图颜色
  function getHeatmapColor(normalizedValue) {
    // 归一化值转换为颜色 (-1到1映射到蓝色到红色)
    const clampedValue = Math.max(-1, Math.min(1, normalizedValue))
    
    if (clampedValue < 0) {
      // 负值：白色到蓝色
      const intensity = Math.abs(clampedValue)
      const blue = Math.floor(255 * intensity)
      return `rgb(${255 - blue}, ${255 - blue}, 255)`
    } else {
      // 正值：白色到红色  
      const intensity = clampedValue
      const red = Math.floor(255 * intensity)
      return `rgb(255, ${255 - red}, ${255 - red})`
    }
  }

  // 格式化百分比
  function formatPercentage(value) {
    if (typeof value !== 'number') return '0%'
    return `${(value * 100).toFixed(1)}%`
  }

  // 处理窗口大小变化
  function handleResize() {
    // 窗口大小变化时的处理逻辑
    console.log('[共享逻辑] 处理窗口大小变化')
  }

  return {
    formatValue,
    formatDuration,
    getKangzhuxiaStatusColor,
    getKangzhuxiaStatusText,
    getMotionStatusText,
    getMotionStatusClass,
    hexToRgb,
    getHeatmapColor,
    formatPercentage,
    handleResize
  }
}