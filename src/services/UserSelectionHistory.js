/**
 * 用户选择历史管理工具类
 * 用于记录和管理用户在系统中的选择历史，支持快速选择功能
 */
class UserSelectionHistory {
  static STORAGE_KEY = 'user_selection_history'
  static MAX_HISTORY = 10 // 最多保存10条选择历史

  /**
   * 记录用户选择
   * @param {string} userId 用户ID
   * @param {string} userName 用户姓名
   */
  static recordSelection(userId, userName) {
    try {
      const history = this.getHistory()
      const now = new Date().toISOString()

      // 移除已存在的记录（避免重复）
      const filtered = history.filter(h => h.userId !== userId)

      // 添加到开头（最新的在前面）
      filtered.unshift({
        userId,
        userName,
        selectedAt: now
      })

      // 保留最近N条记录
      const trimmed = filtered.slice(0, this.MAX_HISTORY)

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed))

      console.log(`[UserSelectionHistory] 记录用户选择: ${userName} (${userId})`)
    } catch (error) {
      console.error('[UserSelectionHistory] 记录选择历史失败:', error)
    }
  }

  /**
   * 获取选择历史
   * @returns {Array} 选择历史列表
   */
  static getHistory() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('[UserSelectionHistory] 读取选择历史失败:', error)
      return []
    }
  }

  /**
   * 获取最近选择的用户ID列表
   * @param {number} limit 限制数量，默认2个
   * @returns {Array} 用户ID列表
   */
  static getRecentUserIds(limit = 2) {
    const history = this.getHistory()
    return history.slice(0, limit).map(h => h.userId)
  }

  /**
   * 获取最近选择的用户信息
   * @param {number} limit 限制数量，默认2个
   * @returns {Array} 用户信息列表
   */
  static getRecentUsers(limit = 2) {
    const history = this.getHistory()
    return history.slice(0, limit)
  }

  /**
   * 检查用户是否在最近选择中
   * @param {string} userId 用户ID
   * @returns {boolean} 是否在最近选择中
   */
  static isRecentlySelected(userId) {
    const recentIds = this.getRecentUserIds(5) // 检查最近5个
    return recentIds.includes(userId)
  }

  /**
   * 清除选择历史
   */
  static clearHistory() {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('[UserSelectionHistory] 选择历史已清除')
    } catch (error) {
      console.error('[UserSelectionHistory] 清除选择历史失败:', error)
    }
  }

  /**
   * 获取用户的选择排序权重
   * @param {string} userId 用户ID
   * @returns {number} 权重值，数值越小权重越高
   */
  static getSelectionWeight(userId) {
    const history = this.getHistory()
    const index = history.findIndex(h => h.userId === userId)
    return index === -1 ? 999 : index // 未选择过的用户权重最低
  }
}

export default UserSelectionHistory