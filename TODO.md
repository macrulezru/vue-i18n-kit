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

### 6. Namespace-based code splitting (опционально, надо ещё подумать)

Разбивка локалей на файлы по namespace — загружать только нужный namespace при навигации.

- [ ] CLI `vue-i18n-kit split --dir src/locales --out src/locales/split` — разбивает `en.json` на `en/auth.json`, `en/dashboard.json` и т.д.
- [ ] CLI `vue-i18n-kit merge-ns` — обратная операция: собрать из namespace-файлов один JSON
- [ ] Vite plugin — `vueI18nNamespacePlugin` с ленивой загрузкой namespace по мере навигации
- [ ] `i18n-kit.config.json` — поле `namespaces: true` — включает namespace-режим для редактора
- [ ] UI — в namespace-режиме каждый namespace — отдельная вкладка в редакторе
- [ ] Документация — миграция с flat JSON на namespace-структуру

---

## Итерация 3 — Дополнительно

### 7. i18n Ally совместимость

[i18n Ally](https://marketplace.visualstudio.com/items?itemName=lokalise.i18n-ally) — наиболее популярный VS Code extension для переводов. Совместимость сделает vue-i18n-kit «нативным» в этой экосистеме.

- [ ] Команда `vue-i18n-kit init` — опционально генерировать `.i18n-ally.js` / `vscode settings`
- [ ] Авто-определение путей локалей из `i18n-kit.config.json` для Ally
- [ ] Поддержка формата ключей Ally (nested vs flat)
- [ ] Документация — секция «Using with i18n Ally»

---

### 8. Translation memory

Локальная база прошлых переводов — редактор предлагает готовые переводы для похожих строк.

- [ ] Хранилище `i18n-kit.memory.json` — при сохранении перевода добавлять пару `{ source, target, locale }`
- [ ] UI — при открытии ячейки на редактирование — показывать suggestions из памяти (fuzzy-match по source)
- [ ] UI — кнопка «Apply» для вставки подсказки одним кликом
- [ ] UI — возможность очистить / экспортировать translation memory
- [ ] Опция `memory: false` в конфиге для отключения
- [ ] Документация

---

## Версии

| Итерация | Версия | Содержание |
|---|---|---|
| 1 | `0.3.0` ✅ | TypeScript types, stale detection, XLIFF/PO |
| 2 | `0.4.0` | DeepL, stats, namespace splitting |
| 3 | `0.5.0` | i18n Ally, translation memory |
