# vue-i18n-kit — Roadmap

Список запланированных доработок, разбитый на 3 итерации по приоритету.

---

## Итерация 1 — Высокий приоритет

### 1. TypeScript type generation (`vue-i18n-kit types`)

Генерация `.d.ts` из локальных файлов — автодополнение и проверка ключей на уровне компилятора.

- [x] CLI-команда `vue-i18n-kit types` — сканирует референсную локаль и генерирует тип `TranslationKey`
- [x] Опция `--out <path>` — путь для записи файла (default: `src/i18n.d.ts`)
- [x] Опция `--locale <code>` — какую локаль использовать как источник (default: первая в конфиге)
- [x] Опция `--watch` — пересоздавать при изменении JSON-файлов
- [ ] Vite plugin интеграция — автоматически запускать `types` при `vite dev`
- [x] Документация — README + CHANGELOG

**Пример результата:**
```ts
// src/i18n.d.ts (generated, do not edit)
export type TranslationKey =
  | 'buttons.submit'
  | 'buttons.cancel'
  | 'greeting'
  | 'errors.auth.invalid'
  | ...

declare module 'vue-i18n-kit' {
  interface Register {
    key: TranslationKey
  }
}
```

---

### 2. Stale translation detection (устаревшие переводы)

Отслеживать, когда в референсной локали изменилось значение — и помечать переводы других локалей как «требует проверки».

- [x] `i18n-kit.config.json` — новое поле `staleTracking: true/false` (default: false)
- [x] При сохранении ключа в референсной локали — записывать хеш значения в `i18n-kit.notes.json` (`_hash.<key>: "sha"`)
- [x] При загрузке редактора — сравнивать текущий хеш с сохранённым; если расходятся — ключ «stale»
- [x] UI — значок `⚠ outdated` в key-cell, отдельный фильтр `stale` в тулбаре
- [x] UI — tooltip показывает старое и новое значение референса
- [x] UI — кнопка «Mark as reviewed» сбрасывает флаг и обновляет хеш
- [x] CLI-команда `vue-i18n-kit stale` — выводит список устаревших ключей по всем локалям
- [x] Документация

---

### 3. XLIFF / PO export-import

Поддержка отраслевых форматов для работы с профессиональными переводчиками и сервисами локализации.

- [x] CLI `vue-i18n-kit export --format xliff --locale ru --out translations.xliff`
- [x] CLI `vue-i18n-kit export --format po --locale ru --out ru.po`
- [x] CLI `vue-i18n-kit import --file translations.xliff` — обновляет locale JSON из файла
- [x] CLI `vue-i18n-kit import --file ru.po`
- [x] Поддержка `<note>` / `msgctxt` — экспортировать заметки редактора как комментарии переводчика
- [x] UI — кнопки «Export XLIFF» и «Export PO» в хедере рядом с CSV
- [x] UI — импорт файлов XLIFF/PO через диалог (аналогично Import CSV)
- [x] Документация

---

## Итерация 2 — Средний приоритет

### 4. DeepL API поддержка

Альтернативный движок машинного перевода — значительно выше качество, чем LibreTranslate; 500k символов/месяц бесплатно.

- [x] `i18n-kit.config.json` — новое поле `translation.engine: "libretranslate" | "deepl"`
- [x] UI Settings — переключатель движка LibreTranslate / DeepL
- [x] UI Settings — поле для DeepL API key
- [x] Серверный прокси `/api/translate` — роутинг по движку
- [x] DeepL: поддержка `formality` параметра (`"more"` / `"less"`) как опция в UI
- [x] DeepL: корректная обработка плейсхолдеров (режим `"xml"` с тегами-заглушками)
- [x] Документация — как получить ключ, лимиты бесплатного плана

---

### 5. `vue-i18n-kit stats` — отчёт по покрытию

Видимость состояния локализации: покрытие по локалям, тяжёлые namespace-ы, мёртвые ключи.

- [x] CLI `vue-i18n-kit stats` — вывод в консоль: % заполнения по каждой локали, кол-во missing/empty/phantom
- [x] Опция `--format json` — вывод машиночитаемого JSON для CI
- [x] Опция `--format html` — HTML-отчёт с визуализацией (progress bars)
- [x] Статистика по namespace-ам: кол-во ключей, размер в байтах, % заполнения
- [x] CI интеграция — пример GitHub Actions шага с `stats --format json`
- [x] UI Dashboard — новая карточка «Coverage» с прогресс-барами по локалям
- [x] Документация

---

## Версия 0.4.0

### 6. Namespace-based code splitting (опционально, надо ещё подумать)

Разбивка локалей на файлы по namespace — загружать только нужный namespace при навигации.

- [x] CLI `vue-i18n-kit split --dir src/locales --out src/locales/split` — разбивает `en.json` на `en/auth.json`, `en/dashboard.json` и т.д.
- [x] CLI `vue-i18n-kit merge-ns` — обратная операция: собрать из namespace-файлов один JSON
- [x] Vite plugin — `vueI18nNamespacePlugin` с ленивой загрузкой namespace по мере навигации
- [x] `i18n-kit.config.json` — поле `namespaces: true` — включает namespace-режим для редактора
- [x] UI — в namespace-режиме каждый namespace — отдельная вкладка (pill-фильтр) в редакторе
- [x] Документация — миграция с flat JSON на namespace-структуру

---

## Итерация 3 — Дополнительно

### 7. i18n Ally совместимость

[i18n Ally](https://marketplace.visualstudio.com/items?itemName=lokalise.i18n-ally) — наиболее популярный VS Code extension для переводов. Совместимость сделает vue-i18n-kit «нативным» в этой экосистеме.

- [x] Команда `vue-i18n-kit init` — опционально генерировать `.vscode/settings.json` для i18n Ally
- [x] Авто-определение путей локалей из `i18n-kit.config.json` для Ally
- [x] Документация — секция «Using with i18n Ally»

---

### 8. Translation memory

Локальная база прошлых переводов — редактор предлагает готовые переводы для похожих строк.

- [x] Хранилище `i18n-kit.memory.json` — при сохранении перевода добавлять пару `{ source, target, locale }`
- [x] UI — при открытии ячейки на редактирование — показывать suggestions из памяти (fuzzy-match по source)
- [x] UI — кнопка «Apply» (один клик по chip) для вставки подсказки
- [x] UI — возможность очистить / экспортировать translation memory (кнопки в Settings)
- [x] Опция `memory: { enabled: false }` в конфиге для отключения
- [x] Документация

---

## Итерация 4 — In-context editing (визуальное редактирование прямо в приложении)

Цель: при запуске `vue-i18n-kit ui` рядом с dev-сервером приложения — отображать иконку-карандаш рядом с каждой репликой прямо в UI приложения. Клик открывает попап-редактор из нашего UI, изменение сразу записывается в JSON и подхватывается HMR.

Работает **только в dev-режиме** — в production-сборку ничего не попадает.

---

### 9. Vite dev-плагин — инфраструктура инжекции

Базовый Vite-плагин `vueI18nDevPlugin`, который активен только в режиме `serve`.

- [x] Новый плагин `vueI18nDevPlugin` в `src/vite-plugin/index.ts`
- [x] В режиме `build` — полный no-op, ничего в бандл не добавляет
- [x] В режиме `serve` — инжектирует глобальный компонент `I18nInspect` через `app.component()`
- [x] Монтирует корневой элемент оверлея (`DevOverlay`) в `document.body` через виртуальный модуль
- [x] Передаёт в оверлей URL i18n UI сервера (настраивается опцией `uiUrl`, default: `http://localhost:4173`)
- [x] Документация

---

### 10. Компонент `I18nInspect` — обёртка с иконкой-карандашом

Dev-only Vue-компонент, который оборачивает переведённый текст и показывает иконку редактирования.

- [x] Компонент `src/vite-plugin/dev-overlay/I18nInspect.vue`
- [x] Принимает пропы: `i18n-key: string`, `locale?: string`
- [x] Рендерит слот (сам текст) + иконку-карандаш, появляющуюся при hover
- [x] При клике — эмитит событие на шину оверлея (открыть попап с этим ключом)
- [x] Стили изолированы (scoped / inline), не конфликтуют с приложением
- [x] Документация — как использовать `<I18nInspect i18n-key="nav.home">{{ t('nav.home') }}</I18nInspect>`

---

### 11. Компонент `DevOverlay` — попап-редактор

Плавающий попап, монтируемый в `body` независимо от дерева компонентов приложения.

- [x] Компонент `src/vite-plugin/dev-overlay/DevOverlay.vue`
- [x] Показывает/скрывается через глобальную шину событий (`mitt` или простой `EventTarget`)
- [x] Отображает: ключ, текущее значение для каждой локали, поля редактирования
- [x] Сохранение — `PUT /api/locale/:locale` на i18n UI сервер (тот же, что `vue-i18n-kit ui`)
- [x] После сохранения Vite HMR автоматически перезагружает локаль в приложении
- [x] Закрывается по Escape и по клику вне попапа
- [x] Стили полностью изолированы от приложения (Shadow DOM или уникальные префиксы классов)
- [x] Документация

---

### 12. Vite transform — авто-обёртка `t()`, `tm()` в шаблонах

Опциональная магия: плагин переписывает шаблоны `.vue` в dev-режиме, чтобы не требовалась явная разметка.

- [x] Vite `transform` хук для `.vue` файлов (только `serve`)
- [x] Парсинг шаблона через `@vue/compiler-dom` — находит все вызовы `t('key')` в интерполяциях `{{ }}`
- [x] Оборачивает каждый вызов: `{{ t('nav.home') }}` → `<I18nInspect i18n-key="nav.home">{{ t('nav.home') }}</I18nInspect>`
- [x] Поддержка алиасов — настраивается список имён функций (default: `['t', 'tm', '$t']`)
- [x] Работает только с литеральными строками-ключами (динамические ключи пропускаются)
- [x] Атрибуты (`:placeholder="t('key')"`) — не трогаются (ограничение по природе)
- [x] Опция `autoWrap: false` — отключить трансформацию, использовать `<I18nInspect>` явно
- [x] Документация — ограничения авто-обёртки, когда лучше явная разметка

---

### 13. Интеграция: единая команда запуска

Удобный способ запустить приложение и i18n UI одновременно.

- [x] Команда `vue-i18n-kit dev` — запускает `vite` (или `nuxt dev`) и `vue-i18n-kit ui` параллельно
- [x] Автоматически определяет dev-команду проекта из `package.json` (`scripts.dev`)
- [x] Опция `--ui-port <n>` — порт для i18n UI сервера (default: 4173)
- [x] Передаёт `uiUrl` в `vueI18nDevPlugin` автоматически
- [x] Документация — обновить секцию «Running the editor»

---

### 14. DevOverlay → «Открыть в полном редакторе»

Кнопка-иконка в попапе `DevOverlay`: открывает новый таб браузера с полноценным редактором, проскроллив до нужного ключа и сразу открыв его в режиме редактирования.

- [x] В `DevOverlay.vue` — добавить кнопку «Открыть в редакторе» (иконка внешней ссылки) в header попапа
- [x] Кнопка строит URL: `${uiUrl}/?key=<editKey>&edit=<firstLocale>` и открывает в новом табе (`window.open`)
- [x] В `App.vue` — при `onMounted` после загрузки данных читать `?key=` и `?edit=` из `location.search`
- [x] Если `?key=` задан — переключить секцию на `editor`, вызвать `jumpToKey(key)`
- [x] Если `?edit=<locale>` задан — дополнительно вызвать `startEdit(key, locale, currentValue)` в `LocaleTable`
- [x] Для этого `LocaleTable` нужно `defineExpose({ jumpToKey, startEdit })`
- [x] Документация — обновить секцию DevOverlay в README

---

### 15. Директива `v-i18n-inspect` — поддержка динамических ключей

Авто-обёртка `wrapTranslationCalls` работает только с литеральными строками: `{{ t('key') }}`.
Для динамических ключей (`t(someVar)`, `t('prefix.' + name)`) статический анализ невозможен.
Директива позволяет разработчику явно указать ключ прямо на существующем элементе — без изменения DOM-структуры.

**Использование:**
```html
<span v-i18n-inspect="myKey">{{ t(myKey) }}</span>
<li v-for="item in items" v-i18n-inspect="'items.' + item.id">{{ t('items.' + item.id) }}</li>
```

- [x] Директива `vI18nInspect` в `src/vite-plugin/dev-overlay/` — `mounted` и `updated` хуки
  - `mounted(el, binding)` — навешивает hover-логику на `el`; `binding.value` — ключ
  - `updated(el, binding)` — обновляет ключ если `binding.oldValue !== binding.value`
  - `unmounted(el)` — чистит слушатели
- [x] На hover добавляет на `el` CSS-outline (тот же `__ik-w--on` стиль) и абсолютно позиционированную кнопку-карандаш
- [x] Клик по кнопке — вызывает `emitEdit({ key: binding.value })`, открывая DevOverlay
- [x] В `buildDevOverlayCode` — экспортировать директиву в `window.__I18N_KIT_INSPECT_DIRECTIVE__`
- [x] В документации для пользователя — зарегистрировать директиву глобально в `main.ts`:
  ```ts
  if (import.meta.env.DEV && window.__I18N_KIT_INSPECT_DIRECTIVE__) {
    app.directive('i18n-inspect', window.__I18N_KIT_INSPECT_DIRECTIVE__)
  }
  ```
- [x] В production — директива не регистрируется, `v-i18n-inspect` на элементах игнорируется Vue (нет предупреждений, нет влияния на бандл)
- [x] Документация — секция «Dynamic keys» в README

---

### 16. DevOverlay → открытие редактора в iframe поверх приложения

Вместо `window.open` (новая вкладка) — редактор открывается в `<iframe>` поверх приложения прямо в текущей вкладке. Это обеспечивает полную интеграцию: видно и приложение (за iframe), и редактор одновременно.

**Поведение:**
- Клик «Открыть в редакторе» в `DevOverlay` — разворачивает iframe-панель поверх страницы
- iframe занимает, например, правую половину экрана (resizable) или фиксированную ширину, за ним остаётся видна часть приложения
- Можно продолжать ховерить по репликам приложения, не закрывая редактор

**Шапка iframe-панели** (рендерится снаружи iframe, в `DevOverlay`):
- Кнопка **✕ Закрыть** — скрывает iframe, возвращает к обычному режиму DevOverlay
- Кнопка **↗ Открыть в новой вкладке** — `window.open` с тем же URL (текущий `key=` / `edit=` параметр), после чего iframe закрывается

- [x] В `DevOverlay.vue` — добавить состояние `iframeOpen: boolean` и `iframeUrl: string`
- [x] Кнопка «Открыть в редакторе» переключает `iframeOpen = true` вместо `window.open`; URL строится так же: `${uiUrl}/?key=<editKey>&edit=<firstLocale>`
- [x] Отрисовка iframe-панели: фиксированный overlay справа, поверх `z-index`
- [x] Шапка панели с кнопками «Закрыть» и «Открыть в новой вкладке»; стили в пространстве `__ik-` (не конфликтуют с приложением)
- [x] При повторном клике «Открыть в редакторе» (другой ключ) — `src` iframe обновляется
- [x] `Escape` закрывает панель когда popup закрыт
- [x] Опция `iframeWidth` в `vueI18nDevPlugin` (default: `480px`) — ширина панели
- [x] Документация — обновить секцию DevOverlay в README

---

## Версии

| Итерация | Версия | Содержание |
|---|---|---|
| 1 | `0.3.0` ✅ | TypeScript types, stale detection, XLIFF/PO |
| 2 | `0.4.0` ✅ | DeepL, stats, namespace splitting, i18n Ally, translation memory, In-context editing (пункты 9–13) |
