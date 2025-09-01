<template>
  <div class="data-display">
    <div class="score-panel">
      分数: {{ score }}
    </div>
    <div class="pedaling-data">
      <div class="rpm">RPM: {{ pedalingData.rpm.toFixed(1) }}</div>
      <div class="resistance">阻力: {{ pedalingData.resistance }}</div>
    </div>
    
    <!-- 简化的血氧显示 -->
    <div class="oxygen-display">
      <div class="oxygen-title">
        脑氧监测
      </div>
      
      <!-- 没有数据时显示提示 -->
      <div v-if="!isDeviceConnected || !collectionActive" class="no-data-message">
        <p>{{ !isDeviceConnected ? '请先连接设备' : '请开始数据采集' }}</p>
      </div>
      
      <!-- 简化的血氧显示 -->
      <div v-else class="oxygen-map">
        <div class="left-brain" :style="leftBrainStyle">
          <span>左侧<br/>{{ oxygenData.leftFrontal.toFixed(1) }}%</span>
        </div>
        <div class="right-brain" :style="rightBrainStyle">
          <span>右侧<br/>{{ oxygenData.rightFrontal.toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'DataDisplay',
  props: {
    oxygenData: {
      type: Object,
      required: true
    },
    pedalingData: {
      type: Object,
      required: true
    },
    score: {
      type: Number,
      default: 0
    },
    nirsData: {
      type: Object,
      default: null
    },
    isDeviceConnected: {
      type: Boolean,
      default: false
    },
    collectionActive: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    // 计算左脑氧热力图样式
    const leftBrainStyle = computed(() => {
      const oxyLevel = props.oxygenData.leftFrontal;
      // 根据氧气水平计算颜色 (50-85)
      // 红色(低氧) -> 黄色 -> 绿色(高氧)
      const hue = Math.max(0, Math.min(120, (oxyLevel - 50) * 3.4));
      return {
        backgroundColor: `hsl(${hue}, 100%, 50%)`
      };
    });
    
    // 计算右脑氧热力图样式
    const rightBrainStyle = computed(() => {
      const oxyLevel = props.oxygenData.rightFrontal;
      const hue = Math.max(0, Math.min(120, (oxyLevel - 50) * 3.4));
      return {
        backgroundColor: `hsl(${hue}, 100%, 50%)`
      };
    });
    
    return {
      leftBrainStyle,
      rightBrainStyle
    };
  }
};
</script>

<style scoped>
.data-display {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 300px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  z-index: 100;
}

.score-panel {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.pedaling-data {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.rpm, .resistance {
  font-size: 16px;
}

.oxygen-display {
  margin-top: 15px;
}

.oxygen-title {
  font-size: 16px;
  margin-bottom: 5px;
  text-align: center;
}

.oxygen-map {
  display: flex;
  height: 80px;
  border: 1px solid white;
  border-radius: 4px;
  overflow: hidden;
}

.left-brain, .right-brain {
  width: 50%;
  height: 100%;
  transition: background-color 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
}

.no-data-message {
  padding: 20px;
  text-align: center;
  color: #ddd;
  border: 1px dashed #555;
  border-radius: 5px;
  margin-top: 10px;
}
</style>