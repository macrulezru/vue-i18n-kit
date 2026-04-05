<script setup lang="ts">
defineProps<{
  modelValue: boolean
  indeterminate?: boolean
}>()
defineEmits<{ 'update:modelValue': [v: boolean] }>()
</script>

<template>
  <label class="cb">
    <input
      type="checkbox"
      class="cb-input"
      :checked="modelValue"
      :indeterminate="indeterminate"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="cb-box">
      <!-- checkmark -->
      <svg v-if="!indeterminate" class="cb-icon" viewBox="0 0 10 8" fill="none">
        <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <!-- dash for indeterminate -->
      <svg v-else class="cb-icon" viewBox="0 0 10 8" fill="none">
        <path d="M2 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </span>
  </label>
</template>

<style scoped>
.cb {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  line-height: 1;
}

.cb-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.cb-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1.5px solid #3f3f46;
  background: #18181b;
  color: transparent;
  transition: border-color 0.12s, background 0.12s, color 0.12s, box-shadow 0.12s;
  flex-shrink: 0;
}

.cb-icon {
  width: 10px;
  height: 8px;
}

/* checked / indeterminate */
.cb-input:checked ~ .cb-box,
.cb-input:indeterminate ~ .cb-box {
  background: #818cf8;
  border-color: #818cf8;
  color: #fff;
  box-shadow: 0 0 0 2px rgba(129,140,248,0.18);
}

/* hover when unchecked */
.cb:hover .cb-box {
  border-color: #52525b;
  background: #1c1c1f;
}

/* hover when checked */
.cb:hover .cb-input:checked ~ .cb-box,
.cb:hover .cb-input:indeterminate ~ .cb-box {
  background: #a5b4fc;
  border-color: #a5b4fc;
}

/* focus-visible ring */
.cb-input:focus-visible ~ .cb-box {
  outline: 2px solid rgba(129,140,248,0.5);
  outline-offset: 2px;
}
</style>
