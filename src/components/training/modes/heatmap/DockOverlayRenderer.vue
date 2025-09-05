<template>
  <div class="dock-overlay-renderer">
    <!-- 12dock梯形覆盖层 -->
    <svg 
      v-if="show12Dock && dock12Polygon"
      class="dock-overlay twelve-dock"
      :viewBox="viewBox"
      :style="{
        ...alignedContainerStyle,
        zIndex: 1
      }"
      preserveAspectRatio="none"
    >
      <polygon 
        :points="dock12Polygon"
        :fill="dock12Style.fill"
        :stroke="dock12Style.stroke"
        :stroke-width="dock12Style.strokeWidth"
        :stroke-linejoin="dock12Style.strokeLinejoin"
        :stroke-linecap="dock12Style.strokeLinecap"
      />
      <!-- 调试信息：显示dock点位 (强制关闭) -->
      <g v-if="false">
        <circle 
          v-for="(point, index) in dock12DebugPoints" 
          :key="`dock12-${index}`"
          :cx="point.x" 
          :cy="point.y" 
          r="2" 
          fill="#ff0000" 
          opacity="0.8"
        />
        <text 
          v-for="(point, index) in dock12DebugPoints"
          :key="`dock12-text-${index}`"
          :x="point.x + 5" 
          :y="point.y - 5" 
          font-size="10" 
          fill="#ff0000"
        >{{ point.dockId }}</text>
      </g>
    </svg>

    <!-- 6dock三角形覆盖层 -->
    <svg 
      v-if="show6Dock && dock6Polygon"
      class="dock-overlay six-dock"
      :viewBox="viewBox"
      :style="{
        ...alignedContainerStyle,
        zIndex: 2
      }"
      preserveAspectRatio="none"
    >
      <polygon 
        :points="dock6Polygon"
        :fill="dock6Style.fill"
        :stroke="dock6Style.stroke"
        :stroke-width="dock6Style.strokeWidth"
        :stroke-linejoin="dock6Style.strokeLinejoin"
        :stroke-linecap="dock6Style.strokeLinecap"
      />
      <!-- 调试信息：显示dock点位 (强制关闭) -->
      <g v-if="false">
        <circle 
          v-for="(point, index) in dock6DebugPoints" 
          :key="`dock6-${index}`"
          :cx="point.x" 
          :cy="point.y" 
          r="2" 
          fill="#00ff00" 
          opacity="0.8"
        />
        <text 
          v-for="(point, index) in dock6DebugPoints"
          :key="`dock6-text-${index}`"
          :x="point.x + 5" 
          :y="point.y - 5" 
          font-size="10" 
          fill="#00ff00"
        >{{ point.dockId }}</text>
      </g>
    </svg>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue'

export default {
  name: 'DockOverlayRenderer',
  
  props: {
    // 核心数据
    dock12Config: {
      type: Object,
      required: true // renumbered_full_layout.json数据
    },
    dock6Config: {
      type: Object, 
      required: true // layout.json数据
    },
    layoutDimensions: {
      type: Object,
      default: () => ({ x: 188.72, y: 110.29 }) // Triangle 2D坐标系尺寸
    },
    
    // 统一坐标系统支持
    heatmapCoordinator: {
      type: Object,
      default: null // HeatmapCoordinator实例（可选，用于统一坐标系统）
    },
    brainImageRef: {
      type: Object,
      default: null // 大脑图片DOM引用（可选，用于统一坐标系统）
    },
    containerRef: {
      type: Object,
      default: null // 容器DOM引用
    },
    
    // 传统对齐参数（向后兼容）
    alignment: {
      type: Object,
      default: () => ({
        position: { x: 0.5, y: 0.42 },
        scale: { width: 0.9, height: 0.55 },
        opacity: 0.7,
        rotation: 0,
        anchor: "center"
      })
    },
    
    // 显示控制
    show12Dock: {
      type: Boolean,
      default: true
    },
    show6Dock: {
      type: Boolean,
      default: true
    },
    showDebugPoints: {
      type: Boolean,
      default: false
    },
    
    // 样式配置
    dock12Style: {
      type: Object,
      default: () => ({
        fill: 'rgba(96,165,250,0.3)', // 蓝色半透明
        stroke: 'none', // 去掉框线
        strokeWidth: '0',
        strokeLinejoin: 'round',
        strokeLinecap: 'round'
      })
    },
    dock6Style: {
      type: Object,
      default: () => ({
        fill: 'rgba(34,197,94,0.4)', // 绿色半透明
        stroke: 'none', // 去掉框线
        strokeWidth: '0',
        strokeLinejoin: 'round',
        strokeLinecap: 'round'
      })
    }
  },
  
  setup(props) {
    // 视图框配置
    const viewBox = computed(() => {
      return `0 0 ${props.layoutDimensions.x} ${props.layoutDimensions.y}`
    })
    
    // 统一坐标系统样式 - 使用HeatmapCoordinator的getSVGStyle方法（优先）或传统对齐参数（fallback）
    const alignedContainerStyle = computed(() => {
      // 优先使用HeatmapCoordinator统一坐标系统
      if (props.heatmapCoordinator && props.brainImageRef) {
        try {
          // 使用与热力图完全相同的坐标计算逻辑
          const style = props.heatmapCoordinator.getSVGStyle(
            props.brainImageRef, 
            props.containerRef
          )
          
          console.log('[DockOverlay统一对齐] 使用HeatmapCoordinator样式:', style)
          
          return {
            ...style,
            pointerEvents: 'none' // 确保不阻挡鼠标事件
          }
        } catch (error) {
          console.warn('[DockOverlay统一对齐] HeatmapCoordinator样式计算失败:', error)
          // 继续使用传统方法
        }
      }
      
      // fallback：使用传统对齐参数（向后兼容）
      console.log('[DockOverlay传统对齐] 使用传统对齐参数:', props.alignment)
      
      const { position, scale, opacity } = props.alignment
      
      // 计算基于大脑图片的精确定位
      const translateX = (position.x - 0.5) * 100  // 转换为百分比偏移
      const translateY = (position.y - 0.5) * 100  // 转换为百分比偏移
      
      return {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${scale.width * 100}%`,
        height: `${scale.height * 100}%`,
        opacity: opacity,
        transform: `translate(-50%, -50%) translate(${translateX}%, ${translateY}%)`,
        transformOrigin: 'center center',
        pointerEvents: 'none'
      }
    })
    
    // 计算12dock梯形多边形边界点
    const dock12Polygon = computed(() => {
      if (!props.dock12Config?.docks) return null
      
      try {
        const dockCenters = calculateDockCenters(props.dock12Config.docks)
        const boundaryPoints = calculateConvexHull(dockCenters)
        return convertPointsToSVGPath(boundaryPoints)
      } catch (error) {
        console.error('[12dock多边形计算] 失败:', error)
        return null
      }
    })
    
    // 计算6dock三角形多边形边界点
    const dock6Polygon = computed(() => {
      if (!props.dock6Config?.docks) return null
      
      try {
        const dockCenters = calculateDockCenters(props.dock6Config.docks)
        const boundaryPoints = calculateConvexHull(dockCenters)
        return convertPointsToSVGPath(boundaryPoints)
      } catch (error) {
        console.error('[6dock多边形计算] 失败:', error)
        return null
      }
    })
    
    // 调试点位信息
    const dock12DebugPoints = computed(() => {
      if (!props.dock12Config?.docks) return []
      return calculateDockCenters(props.dock12Config.docks).map((point, index) => ({
        x: point.x,
        y: point.y,
        dockId: props.dock12Config.docks[index]?.dock_id || index
      }))
    })
    
    const dock6DebugPoints = computed(() => {
      if (!props.dock6Config?.docks) return []
      return calculateDockCenters(props.dock6Config.docks).map((point, index) => ({
        x: point.x,
        y: point.y,
        dockId: props.dock6Config.docks[index]?.dock_id || index
      }))
    })
    
    // 计算dock中心点坐标（基于optodes位置的平均值）+ 智能边界裁剪
    function calculateDockCenters(docks) {
      // 第一步：计算所有dock的基础中心点
      const allCenters = docks.map(dock => {
        if (!dock.optodes || dock.optodes.length === 0) {
          console.warn('[dock中心计算] dock无optodes:', dock.dock_id)
          return { x: 0, y: 0, dockId: dock.dock_id, valid: false }
        }
        
        // 计算所有optodes的中心点
        let totalX = 0
        let totalY = 0
        let validOptodes = 0
        
        dock.optodes.forEach(optode => {
          if (optode.coordinates_2d && typeof optode.coordinates_2d.x === 'number' && typeof optode.coordinates_2d.y === 'number') {
            totalX += optode.coordinates_2d.x
            totalY += optode.coordinates_2d.y
            validOptodes++
          }
        })
        
        if (validOptodes === 0) {
          console.warn('[dock中心计算] dock无有效coordinates_2d:', dock.dock_id)
          return { x: 0, y: 0, dockId: dock.dock_id, valid: false }
        }
        
        // 反转Y坐标实现"上宽下窄梯形、上尖下宽三角形"
        const originalY = totalY / validOptodes
        const flippedY = props.layoutDimensions.y - originalY
        
        return {
          x: totalX / validOptodes,
          y: flippedY,  // 使用反转后的Y坐标
          dockId: dock.dock_id,
          valid: true
        }
      }).filter(center => center.valid)
      
      // 第二步：智能边界裁剪（仅对12dock应用）
      if (docks.length === 12) {
        console.log(`[智能边界裁剪] 原始12dock中心点数量: ${allCenters.length}`)
        
        // 计算质心
        const centroid = {
          x: allCenters.reduce((sum, c) => sum + c.x, 0) / allCenters.length,
          y: allCenters.reduce((sum, c) => sum + c.y, 0) / allCenters.length
        }
        
        // 计算到质心距离并排序
        const centersWithDistance = allCenters.map(center => ({
          ...center,
          distanceToCenter: Math.sqrt(
            Math.pow(center.x - centroid.x, 2) + 
            Math.pow(center.y - centroid.y, 2)
          )
        })).sort((a, b) => a.distanceToCenter - b.distanceToCenter)
        
        // 使用85%保留率进行边界收缩
        const shrinkRatio = 0.85 // 基于分析结果的最优值
        const keepCount = Math.ceil(allCenters.length * shrinkRatio)
        const optimizedCenters = centersWithDistance.slice(0, keepCount)
        
        console.log(`[智能边界裁剪] 85%收缩后保留: ${keepCount}/${allCenters.length}个dock`)
        console.log(`[智能边界裁剪] 移除的dock: ${centersWithDistance.slice(keepCount).map(c => c.dockId).join(', ')}`)
        
        // 计算优化前后的边界范围
        const originalBounds = {
          x: { min: Math.min(...allCenters.map(c => c.x)), max: Math.max(...allCenters.map(c => c.x)) },
          y: { min: Math.min(...allCenters.map(c => c.y)), max: Math.max(...allCenters.map(c => c.y)) }
        }
        const optimizedBounds = {
          x: { min: Math.min(...optimizedCenters.map(c => c.x)), max: Math.max(...optimizedCenters.map(c => c.x)) },
          y: { min: Math.min(...optimizedCenters.map(c => c.y)), max: Math.max(...optimizedCenters.map(c => c.y)) }
        }
        
        const xReduction = ((originalBounds.x.max - originalBounds.x.min) - (optimizedBounds.x.max - optimizedBounds.x.min)) / (originalBounds.x.max - originalBounds.x.min) * 100
        const yReduction = ((originalBounds.y.max - originalBounds.y.min) - (optimizedBounds.y.max - optimizedBounds.y.min)) / (originalBounds.y.max - originalBounds.y.min) * 100
        
        console.log(`[智能边界裁剪] 边界收缩效果: X轴缩减${xReduction.toFixed(1)}%, Y轴缩减${yReduction.toFixed(1)}%`)
        
        // 返回优化后的中心点（移除distance属性）
        return optimizedCenters.map(({ distanceToCenter, ...center }) => center)
      }
      
      // 6dock或其他数量：不进行边界裁剪
      return allCenters
    }
    
    // 计算凸包边界（Graham扫描算法）
    function calculateConvexHull(points) {
      if (points.length < 3) return points
      
      // 排序：按y坐标降序（上宽下窄梯形、上尖下宽三角形），再按x坐标升序
      const sortedPoints = [...points].sort((a, b) => {
        if (a.y !== b.y) return b.y - a.y  // 修复：使用降序排列实现上宽下窄形状
        return a.x - b.x
      })
      
      // Graham扫描算法计算凸包
      function cross(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
      }
      
      // 下凸包
      const lower = []
      for (let i = 0; i < sortedPoints.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], sortedPoints[i]) <= 0) {
          lower.pop()
        }
        lower.push(sortedPoints[i])
      }
      
      // 上凸包
      const upper = []
      for (let i = sortedPoints.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], sortedPoints[i]) <= 0) {
          upper.pop()
        }
        upper.push(sortedPoints[i])
      }
      
      // 移除重复点
      upper.pop()
      lower.pop()
      
      console.log(`[凸包计算] 输入${points.length}点，输出${lower.concat(upper).length}点`)
      return lower.concat(upper)
    }
    
    // 转换点位为SVG路径字符串
    function convertPointsToSVGPath(points) {
      if (!points || points.length < 3) return ''
      
      return points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    }
    
    onMounted(() => {
      nextTick(() => {
        console.log('[DockOverlayRenderer] 组件已挂载')
        console.log('[DockOverlayRenderer] 12dock多边形:', dock12Polygon.value)
        console.log('[DockOverlayRenderer] 6dock多边形:', dock6Polygon.value)
      })
    })
    
    return {
      viewBox,
      alignedContainerStyle,
      dock12Polygon,
      dock6Polygon,
      dock12DebugPoints,
      dock6DebugPoints
    }
  }
}
</script>

<style scoped>
.dock-overlay-renderer {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.dock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.twelve-dock {
  z-index: 1;
}

.six-dock {
  z-index: 2;
}

/* 调试模式样式 */
.dock-overlay-renderer[debug-mode] {
  border: 2px dashed rgba(255, 0, 0, 0.5);
}
</style>