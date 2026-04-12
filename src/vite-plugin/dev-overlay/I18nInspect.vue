<script setup lang="ts">
/**
 * I18nInspect — dev-only wrapper component.
 *
 * Renders its slot content unchanged. On hover, shows a small pencil button
 * in the top-right corner; clicking it dispatches an edit event that the
 * DevOverlay listens to and opens the translation editor popup.
 *
 * Styles use the `__ik-` prefix to avoid collisions with the host application.
 *
 * @example
 * <I18nInspect i18n-key="nav.home">{{ t('nav.home') }}</I18nInspect>
 */
import { ref } from 'vue'
import { emitEdit } from './eventBus'
import type { I18nEditPayload } from './eventBus'

const props = defineProps<{
  /** The translation key passed to t(). */
  i18nKey: string
  /** Locale override — when omitted the editor uses the active locale. */
  locale?: string
}>()

const isHovered = ref(false)

function handleEdit() {
  const payload: I18nEditPayload = { key: props.i18nKey }
  if (props.locale) payload.locale = props.locale
  emitEdit(payload)
}
</script>

<template>
  <span
    class="__ik-w"
    :class="{ '__ik-w--on': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <slot />

    <Transition name="__ik-fade">
      <button
        v-if="isHovered"
        type="button"
        class="__ik-btn"
        :title="`vue-i18n-kit › ${i18nKey}`"
        @click.stop="handleEdit"
      >
        <!--
          Feather "edit-2" pencil icon, 10 × 10.
          Inline SVG so there are no external asset dependencies.
        -->
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </button>
    </Transition>
  </span>
</template>

<!-- Non-scoped intentionally: scoped hashes can interfere with SSR hydration.
     The `__ik-` prefix namespace prevents collisions with host-app styles. -->
<style>
.__ik-w {
  position: relative;
  display: inline;
}

/* Dashed outline highlights the translatable region on hover */
.__ik-w--on {
  outline: 1.5px dashed rgba(124, 58, 237, 0.4);
  outline-offset: 2px;
  border-radius: 2px;
}

.__ik-btn {
  position: absolute;
  top: 0px;
  left: 0px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: #7c3aed;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  /* Sit above absolutely everything in the host app */
  z-index: 2147483646;
  transition: background 0.1s ease;
  line-height: 1;
  vertical-align: top;
  /* Reset any host-app button resets */
  font-family: inherit;
  font-size: inherit;
  text-transform: none;
  letter-spacing: normal;
}

.__ik-btn:hover,
.__ik-btn:focus-visible {
  background: #6d28d9;
  outline: none;
}

/* Fade transition for the pencil button */
.__ik-fade-enter-active,
.__ik-fade-leave-active {
  transition: opacity 0.12s ease;
}

.__ik-fade-enter-from,
.__ik-fade-leave-to {
  opacity: 0;
}
</style>
