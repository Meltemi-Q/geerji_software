<template>
  <div class="left-sidebar">
    <div class="sidebar-title">显示模式</div>
    <div class="mode-buttons-vertical">
      <button 
        class="large-mode-btn" 
        :class="{ active: displayMode === 'brain' }"
        @click="$emit('switch-mode', 'brain')"
      >
        <svg width="32" height="32" class="mode-icon-large">
          <path d="M16 4C10 4 5 9 5 15c0 3 1.5 6 3.5 8C9 24.5 10 26 10 28h12c0-2 1-3.5 1.5-4.5C26 21 27.5 18 27.5 15c0-6-5-11-11.5-11z" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
          <circle cx="20" cy="13" r="1.5" fill="currentColor"/>
        </svg>
        <span>脑图</span>
      </button>
      
      <button 
        class="large-mode-btn" 
        :class="{ active: displayMode === 'curve' }"
        @click="$emit('switch-mode', 'curve')"
      >
        <svg width="32" height="32" class="mode-icon-large">
          <path d="M4 16L8 12L16 18L28 8" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M28 8L22 8L22 14" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        <span>数据曲线</span>
      </button>
      
      <button 
        class="large-mode-btn" 
        :class="{ active: displayMode === 'game' }"
        @click="$emit('switch-mode', 'game')"
      >
        <svg width="32" height="32" class="mode-icon-large">
          <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M10 18s2 3 6 3 6-3 6-3" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="20" cy="12" r="1.5" fill="currentColor"/>
        </svg>
        <span>交互游戏</span>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ModeSelector',
  props: {
    displayMode: {
      type: String,
      required: true
    }
  },
  emits: ['switch-mode']
}
</script>

<style scoped>
.left-sidebar {
  width: clamp(140px, 12vw, 180px); /* 响应式宽度 */
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1vw, 15px); /* 响应式间距 */
}

.sidebar-title {
  font-size: clamp(16px, 1.5vw, 28px); /* 响应式字体 */
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  margin-bottom: clamp(8px, 0.8vw, 10px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.mode-buttons-vertical {
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 1.5vw, 20px); /* 响应式间距 */
}

.large-mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(6px, 0.6vw, 8px);
  padding: clamp(15px, 1.5vw, 20px) clamp(10px, 1vw, 15px); /* 响应式内边距 */
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: clamp(10px, 1vw, 15px);
  color: #ffffff;
  font-size: clamp(13px, 1.2vw, 22px); /* 响应式字体 */
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: clamp(70px, 7vw, 90px); /* 响应式最小高度 */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.large-mode-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.large-mode-btn.active {
  background: rgba(255, 255, 255, 0.35);
  border-color: #ffffff;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  transform: scale(1.02);
}

.mode-icon-large {
  flex-shrink: 0;
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  width: clamp(24px, 2.5vw, 32px); /* 响应式图标尺寸 */
  height: clamp(24px, 2.5vw, 32px);
}

.large-mode-btn span {
  text-align: center;
  line-height: 1.2;
}
</style>