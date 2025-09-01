/**
 * 渲染辅助模块
 * 负责头部轮廓渲染等视觉辅助功能
 */
export class RenderUtils {
  
  /**
   * 创建头部轮廓渲染函数
   */
  static createHeadOutlineRenderer() {
    return (params, api) => {
      const coordSys = params.coordSys
      
      // 获取坐标系中心点
      const centerX = (coordSys.x + coordSys.width / 2)
      const centerY = (coordSys.y + coordSys.height / 2)
      
      // 计算半径（取宽度和高度的较小值的40%）
      const radius = Math.min(coordSys.width, coordSys.height) * 0.4
      
      // 创建路径数组
      const pathData = []
      
      // 头部圆形
      pathData.push({
        type: 'circle',
        shape: {
          cx: centerX,
          cy: centerY,
          r: radius
        },
        style: {
          stroke: '#333',
          fill: 'none',
          lineWidth: 2
        }
      })
      
      // 鼻子标记（使用多边形）- 调整方向，使三角形朝上
      pathData.push({
        type: 'polygon',
        shape: {
          points: [
            [centerX, centerY - radius], // 底部贴在圆上
            [centerX - 8, centerY - radius - 12], // 左侧点
            [centerX + 8, centerY - radius - 12]  // 右侧点
          ]
        },
        style: {
          stroke: '#333',
          fill: 'none',
          lineWidth: 2
        }
      })
      
      // 左耳朵（椭圆）
      pathData.push({
        type: 'ellipse',
        shape: {
          cx: centerX - radius - 8,
          cy: centerY,
          rx: 8,
          ry: 15
        },
        style: {
          stroke: '#333',
          fill: 'none',
          lineWidth: 2
        }
      })
      
      // 右耳朵（椭圆）
      pathData.push({
        type: 'ellipse',
        shape: {
          cx: centerX + radius + 8,
          cy: centerY,
          rx: 8,
          ry: 15
        },
        style: {
          stroke: '#333',
          fill: 'none',
          lineWidth: 2
        }
      })
      
      return {
        type: 'group',
        children: pathData
      }
    }
  }
}