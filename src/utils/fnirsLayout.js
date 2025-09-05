/**
 * fNIRS布局数据处理工具
 * 提供Triangle布局的加载、解析和转换功能
 */

// 真实Triangle布局数据缓存
let realTriangleLayoutData = null
let realTriangleParsed = null

// 模拟fNIRS设备配置数据（作为兜底方案）
const mockFnirsInfo = {
  optodes: {
    spos2: [
      [-40, 30, 0], [0, 35, 0], [40, 30, 0],
      [-30, -10, 0], [0, -15, 0], [30, -10, 0]
    ],
    dpos2: [
      [-35, 35, 0], [-45, 25, 0], [-35, 25, 0], [-30, 40, 0],
      [-5, 40, 0], [5, 40, 0], [-5, 30, 0], [5, 30, 0],
      [35, 35, 0], [45, 25, 0], [35, 25, 0], [30, 40, 0],
      [-25, -5, 0], [-35, -15, 0], [-25, -15, 0], [-20, 0, 0],
      [-5, -10, 0], [5, -10, 0], [-5, -20, 0], [5, -20, 0],
      [25, -5, 0], [35, -15, 0], [25, -15, 0], [20, 0, 0]
    ]
  },
  pairs: {
    Src: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6],
    Det: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
  }
}

/**
 * 加载Triangle布局数据
 * @returns {Promise<Object|null>} Triangle布局数据
 */
export async function loadTriangleLayoutData() {
  if (realTriangleLayoutData) return realTriangleLayoutData
  
  try {
    // 统一从 public/config 加载 Triangle 布局
    const response = await fetch('/config/triangle_layout.json')
    const data = await response.json()
    
    realTriangleLayoutData = data
    realTriangleParsed = parseTriangleLayoutForHeatmap(data)
    
    console.log('[fNIRS布局工具] Triangle数据加载完成')
    return data
  } catch (error) {
    console.error('[fNIRS布局工具] Triangle加载失败，使用模拟数据:', error)
    return null
  }
}

/**
 * 解析Triangle布局数据用于热力图渲染
 * @param {Object} layoutData - Triangle布局数据
 * @returns {Object} 解析后的数据，包含sources、detectors、channels
 */
export function parseTriangleLayoutForHeatmap(layoutData) {
  console.log('[fNIRS布局工具] 开始解析布局数据...')
  
  const sources = []
  const detectors = []
  const channels = []
  
  layoutData.docks.forEach(dock => {
    dock.optodes.forEach(optode => {
      const coords2d = optode.coordinates_2d
      const coords3d = optode.coordinates_3d
      const isSource = optode.optode_id.includes('optode_a') || 
                      optode.optode_id.includes('optode_b') || 
                      optode.optode_id.includes('optode_c')
      
      if (isSource) {
        sources.push({
          id: sources.length,
          x: coords2d.x,
          y: coords2d.y,
          z: coords3d.z || 0
        })
      } else {
        detectors.push({
          id: detectors.length,
          x: coords2d.x,
          y: coords2d.y, 
          z: coords3d.z || 0
        })
      }
    })
  })
  
  // 计算所有光源-检测器对的通道
  sources.forEach(source => {
    detectors.forEach(detector => {
      const channelX = (source.x + detector.x) / 2
      const channelY = (source.y + detector.y) / 2
      const channelZ = (source.z + detector.z) / 2
      
      channels.push({
        sourceId: source.id,
        detectorId: detector.id,
        x: channelX,
        y: channelY,
        z: channelZ,
        distance: Math.sqrt(
          Math.pow(source.x - detector.x, 2) + 
          Math.pow(source.y - detector.y, 2) +
          Math.pow(source.z - detector.z, 2)
        )
      })
    })
  })
  
  // 过滤合理距离的通道（30-80mm）
  const validChannels = channels.filter(c => c.distance >= 30 && c.distance <= 80)
  
  console.log(`[fNIRS布局工具] 解析完成: ${sources.length}光源, ${detectors.length}检测器, ${validChannels.length}有效通道`)
  
  return {
    sources,
    detectors,
    channels: validChannels
  }
}

/**
 * 创建Triangle fNIRS信息，用于HeatmapRenderer
 * @returns {Object} HeatmapRenderer期望的fNIRS信息格式
 */
export function createTriangleFnirsInfo() {
  if (!realTriangleParsed) {
    console.warn('[fNIRS布局工具] 布局数据未加载，使用模拟数据')
    return mockFnirsInfo
  }
  
  const { sources, detectors, channels } = realTriangleParsed
  
  // 计算Triangle布局的坐标范围，用于归一化
  const allPositions = [...sources, ...detectors]
  const xValues = allPositions.map(p => p.x)
  const yValues = allPositions.map(p => p.y)
  
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  
  const xCenter = (xMin + xMax) / 2
  const yCenter = (yMin + yMax) / 2
  const xRange = xMax - xMin
  const yRange = yMax - yMin
  const maxRange = Math.max(xRange, yRange)
  
  console.log(`[fNIRS布局工具] 坐标归一化 - 中心点: (${xCenter.toFixed(1)}, ${yCenter.toFixed(1)}), 最大范围: ${maxRange.toFixed(1)}`)
  
  // 归一化函数：将坐标映射到以原点为中心的对称范围[-50, 50]
  function normalizeCoordinate(x, y) {
    const normalizedX = ((x - xCenter) / maxRange) * 100
    const normalizedY = ((y - yCenter) / maxRange) * 100
    return [normalizedX, normalizedY]
  }
  
  // 转换为HeatmapRenderer期望的格式，使用归一化坐标
  const triangleFnirsInfo = {
    optodes: {
      spos2: sources.map(s => {
        const [normX, normY] = normalizeCoordinate(s.x, s.y)
        return [normX, normY, 0]
      }),
      dpos2: detectors.map(d => {
        const [normX, normY] = normalizeCoordinate(d.x, d.y)
        return [normX, normY, 0]
      })
    },
    pairs: {
      Src: channels.map(c => c.sourceId + 1),
      Det: channels.map(c => c.detectorId + 1)
    }
  }
  
  console.log(`[fNIRS布局工具] Triangle fNIRS信息创建完成: ${triangleFnirsInfo.pairs.Src.length}通道`)
  
  return triangleFnirsInfo
}

/**
 * 获取模拟fNIRS配置数据（兜底方案）
 * @returns {Object} 模拟的fNIRS信息
 */
export function getMockFnirsInfo() {
  return mockFnirsInfo
}

/**
 * 创建通道索引映射表
 * @param {Array} sourceData - 源数据通道数组
 * @param {Array} targetData - 目标数据通道数组（或目标通道数组长度的参考数组）
 * @param {Object} options - 映射选项
 * @param {string} options.strategy - 映射策略: 'truncate'(截断), 'pad'(填充), 'interpolate'(插值)
 * @param {number} options.defaultValue - 填充时使用的默认值
 * @returns {Array} 映射后的通道数据
 */
export function createChannelMapping(sourceData, targetData, options = {}) {
  if (!sourceData) return targetData || []
  if (!targetData) return sourceData
  
  const targetLength = Array.isArray(targetData) ? targetData.length : targetData
  
  if (sourceData.length === targetLength) {
    return [...sourceData]
  }
  
  const { strategy = 'auto', defaultValue = 0 } = options
  
  console.log(`[fNIRS布局工具] 通道映射: ${sourceData.length} -> ${targetLength} (策略: ${strategy})`)
  
  // 自动选择策略
  let selectedStrategy = strategy
  if (strategy === 'auto') {
    selectedStrategy = sourceData.length > targetLength ? 'truncate' : 'pad'
  }
  
  switch (selectedStrategy) {
    case 'truncate':
      // 截断策略：保留前N个数据
      return sourceData.slice(0, targetLength)
      
    case 'pad':
      // 填充策略：用默认值填充不足的数据
      const paddedData = [...sourceData]
      while (paddedData.length < targetLength) {
        paddedData.push(defaultValue)
      }
      return paddedData
      
    case 'interpolate':
      // 插值策略：对数据进行重新采样
      return interpolateChannelData(sourceData, targetLength)
      
    case 'average':
      // 平均策略：将多个源通道合并为目标通道
      return averageChannelData(sourceData, targetLength)
      
    default:
      console.warn(`[fNIRS布局工具] 未知映射策略: ${selectedStrategy}，使用默认策略`)
      return sourceData.length > targetLength ? 
        sourceData.slice(0, targetLength) : 
        [...sourceData, ...Array(targetLength - sourceData.length).fill(defaultValue)]
  }
}

/**
 * 插值重采样通道数据
 * @param {Array} sourceData - 源数据
 * @param {number} targetLength - 目标长度
 * @returns {Array} 插值后的数据
 */
function interpolateChannelData(sourceData, targetLength) {
  if (sourceData.length <= 1) {
    return Array(targetLength).fill(sourceData[0] || 0)
  }
  
  const result = []
  const step = (sourceData.length - 1) / (targetLength - 1)
  
  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = i * step
    const lowerIndex = Math.floor(sourceIndex)
    const upperIndex = Math.ceil(sourceIndex)
    
    if (lowerIndex === upperIndex) {
      result.push(sourceData[lowerIndex])
    } else {
      const weight = sourceIndex - lowerIndex
      const interpolated = sourceData[lowerIndex] * (1 - weight) + sourceData[upperIndex] * weight
      result.push(interpolated)
    }
  }
  
  return result
}

/**
 * 平均合并通道数据
 * @param {Array} sourceData - 源数据
 * @param {number} targetLength - 目标长度
 * @returns {Array} 平均合并后的数据
 */
function averageChannelData(sourceData, targetLength) {
  const result = []
  const groupSize = sourceData.length / targetLength
  
  for (let i = 0; i < targetLength; i++) {
    const startIndex = Math.floor(i * groupSize)
    const endIndex = Math.floor((i + 1) * groupSize)
    const group = sourceData.slice(startIndex, endIndex)
    
    const average = group.length > 0 ? 
      group.reduce((sum, val) => sum + val, 0) / group.length : 0
    result.push(average)
  }
  
  return result
}
