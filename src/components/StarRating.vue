<template>
  <div class="star-rating">
    <svg 
      v-for="i in maxStars" 
      :key="i"
      width="32" 
      height="32" 
      class="star"
      :class="{ 'filled': i <= stars }"
    >
      <polygon 
        points="16,2 20,12 30,12 22,20 26,30 16,24 6,30 10,20 2,12 12,12"
        :fill="i <= stars ? '#f1c40f' : 'none'"
        :stroke="i <= stars ? '#f39c12' : '#bdc3c7'"
        :stroke-width="i <= stars ? '1' : '2'"
      />
    </svg>
  </div>
</template>

<script>
export default {
  name: 'StarRating',
  props: {
    stars: {
      type: Number,
      required: true,
      validator: (value) => value >= 0 && value <= 5
    },
    maxStars: {
      type: Number,
      default: 5,
      validator: (value) => value > 0 && value <= 10
    }
  }
}
</script>

<style scoped>
.star-rating {
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
}

.star {
  transition: all 0.2s ease;
  cursor: default;
}

.star.filled {
  filter: drop-shadow(0 2px 4px rgba(241, 196, 15, 0.3));
}

.star:hover {
  transform: scale(1.1);
}
</style>