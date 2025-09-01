<template>
  <svg width="16" height="16" class="trend-arrow">
    <!-- 上升箭头 -->
    <path 
      v-if="trend === 'up'"
      d="M8 2 L14 8 L10 8 L10 14 L6 14 L6 8 L2 8 Z"
      fill="#2ecc71"
    />
    
    <!-- 下降箭头 -->
    <path 
      v-else-if="trend === 'down'"
      d="M8 14 L2 8 L6 8 L6 2 L10 2 L10 8 L14 8 Z"
      fill="#e74c3c"
    />
    
    <!-- 稳定箭头 -->
    <path 
      v-else
      d="M2 8 L14 8 M10 4 L14 8 L10 12"
      fill="none"
      stroke="#f39c12"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script>
export default {
  name: 'TrendArrow',
  props: {
    trend: {
      type: String,
      required: true,
      validator: (value) => ['up', 'down', 'stable'].includes(value)
    }
  }
}
</script>

<style scoped>
.trend-arrow {
  display: inline-block;
  vertical-align: middle;
}
</style>