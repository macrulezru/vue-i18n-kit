export const mockConfig = {
  locales: [
    { code: 'en', path: 'src/locales/en.json', meta: { display: 'English', flag: '🇬🇧' } },
    { code: 'ru', path: 'src/locales/ru.json', meta: { display: 'Русский', flag: '🇷🇺' } },
    { code: 'de', path: 'src/locales/de.json', meta: { display: 'Deutsch', flag: '🇩🇪' } },
  ],
  rules: {
    lengthWarningFactor: 2.5,
    warnOnHtmlTags: true,
    warnOnIcuErrors: true,
    warnOnDuplicateValues: true,
  },
  ignore: {
    prune: [],
    duplicates: [],
    unused: [],
    scanExclude: [],
  },
  lockedKeys: [] as string[],
}

export const mockLocales: Record<string, Record<string, unknown>> = {
  en: {
    buttons: {
      submit: 'Submit',
      cancel: 'Cancel',
      save: 'Save changes',
      delete: 'Delete',
    },
    nav: {
      home: 'Home',
      profile: 'Profile',
      settings: 'Settings',
      logout: 'Log out',
    },
    greeting: 'Hello, {name}!',
    farewell: 'Goodbye, {name}! See you soon.',
    items: '{count, plural, one {# item} other {# items}}',
    errors: {
      required: 'This field is required.',
      invalid_email: 'Please enter a valid email address.',
      network: 'Network error. Please try again.',
      auth: {
        expired: 'Your session has expired. Please log in again.',
        forbidden: 'You do not have permission to perform this action.',
      },
      form: {
        min_length: 'Must be at least {min} characters.',
        max_length: 'Must be no more than {max} characters.',
        pattern: 'Invalid format.',
      },
    },
    // intentionally missing in some locales to demonstrate "missing" state
    dashboard: {
      title: 'Dashboard',
      welcome: 'Welcome back, {name}!',
      stats: '{count, plural, one {# active session} other {# active sessions}}',
      widgets: {
        revenue: {
          title: 'Revenue',
          total: 'Total revenue',
          growth: 'Growth vs last month',
        },
        users: {
          title: 'Users',
          active: 'Active users',
          new: 'New this week',
        },
      },
    },
    auth: {
      login: {
        title: 'Sign in',
        submit: 'Sign in',
        forgot_password: 'Forgot password?',
      },
      register: {
        title: 'Create account',
        submit: 'Create account',
        terms: 'By signing up, you agree to our {terms}.',
      },
      reset: {
        title: 'Reset password',
        submit: 'Send reset link',
        success: 'Check your email for the reset link.',
      },
    },
  },

  ru: {
    buttons: {
      submit: 'Отправить',
      cancel: 'Отмена',
      save: 'Сохранить',
      delete: 'Удалить',
    },
    nav: {
      home: 'Главная',
      profile: 'Профиль',
      settings: 'Настройки',
      logout: 'Выйти',
    },
    greeting: 'Привет, {name}!',
    farewell: 'Пока, {name}! До скорого.',
    items: '{count, plural, one {# товар} few {# товара} many {# товаров} other {# товаров}}',
    errors: {
      required: 'Это поле обязательно.',
      invalid_email: 'Введите корректный email.',
      network: 'Ошибка сети. Попробуйте ещё раз.',
      auth: {
        expired: 'Сессия истекла. Войдите снова.',
        forbidden: 'У вас нет прав для этого действия.',
      },
      form: {
        min_length: 'Минимум {min} символов.',
        max_length: 'Максимум {max} символов.',
        pattern: 'Неверный формат.',
      },
    },
    // dashboard section missing — demonstrates "missing" highlight
    auth: {
      login: {
        title: 'Войти',
        submit: 'Войти',
        forgot_password: 'Забыли пароль?',
      },
      register: {
        title: 'Создать аккаунт',
        submit: 'Создать аккаунт',
        terms: 'Регистрируясь, вы соглашаетесь с {terms}.',
      },
      reset: {
        title: 'Сброс пароля',
        submit: 'Отправить ссылку',
        success: 'Проверьте email — ссылка уже там.',
      },
    },
  },

  de: {
    buttons: {
      submit: 'Absenden',
      cancel: 'Abbrechen',
      // save missing — demonstrates per-cell missing highlight
      delete: 'Löschen',
    },
    nav: {
      home: 'Startseite',
      profile: 'Profil',
      // settings missing
      logout: 'Abmelden',
    },
    greeting: 'Hallo, {name}!',
    // farewell missing
    items: '{count, plural, one {# Artikel} other {# Artikel}}',
    errors: {
      required: 'Dieses Feld ist erforderlich.',
      invalid_email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      // network missing
      auth: {
        expired: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
        // forbidden missing
      },
      form: {
        min_length: 'Mindestens {min} Zeichen erforderlich.',
        // max_length missing
        pattern: 'Ungültiges Format.',
      },
    },
    auth: {
      login: {
        title: 'Anmelden',
        submit: 'Anmelden',
        // forgot_password missing
      },
      register: {
        title: 'Konto erstellen',
        submit: 'Konto erstellen',
        // terms missing
      },
      // reset section missing entirely
    },
  },
}

export const mockNotes: Record<string, string> = {
  'greeting': 'Supports {name} placeholder. name = display name of the current user.',
  'items': 'ICU plural format. count is always a non-negative integer.',
  'farewell': 'Shown on the logout confirmation screen.',
  'dashboard.stats': 'ICU plural — count = number of active browser sessions.',
  'dashboard.widgets.revenue.growth': 'Percentage string, e.g. "+12%". Can be negative.',
  'errors.form.min_length': 'min = minimum character count as integer.',
  'errors.form.max_length': 'max = maximum character count as integer.',
  'auth.register.terms': '{terms} is replaced with a <a> link to the Terms of Service page.',
}

export const mockEntries: Record<string, string[]> = {
  'buttons.submit':     ['src/components/Form.vue', 'src/views/Login.vue'],
  'buttons.cancel':     ['src/components/Form.vue', 'src/components/Modal.vue'],
  'buttons.save':       ['src/views/Settings.vue'],
  'buttons.delete':     ['src/components/Table.vue'],
  'nav.home':           ['src/components/Navbar.vue'],
  'nav.profile':        ['src/components/Navbar.vue', 'src/views/Profile.vue'],
  'nav.settings':       ['src/components/Navbar.vue'],
  'nav.logout':         ['src/components/Navbar.vue'],
  'greeting':           ['src/views/Home.vue', 'src/components/UserCard.vue'],
  'farewell':           ['src/views/Profile.vue'],
  'items':              ['src/components/Table.vue', 'src/views/Home.vue'],
  'errors.required':    ['src/composables/useValidation.ts'],
  'errors.invalid_email': ['src/composables/useValidation.ts'],
  'errors.auth.expired':   ['src/composables/useAuth.ts'],
  'errors.auth.forbidden': ['src/composables/useAuth.ts'],
  'errors.form.min_length': ['src/composables/useValidation.ts'],
  'errors.form.max_length': ['src/composables/useValidation.ts'],
  'errors.form.pattern':    ['src/composables/useValidation.ts'],
  // errors.network intentionally absent — demonstrates "unused" state
  'dashboard.title':    ['src/views/Dashboard.vue'],
  'dashboard.welcome':  ['src/views/Dashboard.vue'],
  'dashboard.widgets.revenue.title':  ['src/views/Dashboard.vue'],
  'dashboard.widgets.revenue.total':  ['src/views/Dashboard.vue'],
  'dashboard.widgets.revenue.growth': ['src/views/Dashboard.vue'],
  'dashboard.widgets.users.title':    ['src/views/Dashboard.vue'],
  'dashboard.widgets.users.active':   ['src/views/Dashboard.vue'],
  'dashboard.widgets.users.new':      ['src/views/Dashboard.vue'],
  // dashboard.stats intentionally absent — demonstrates "unused" state
  'auth.login.title':          ['src/views/Login.vue'],
  'auth.login.submit':         ['src/views/Login.vue'],
  'auth.login.forgot_password': ['src/views/Login.vue'],
  'auth.register.title':       ['src/views/Register.vue'],
  'auth.register.submit':      ['src/views/Register.vue'],
  'auth.register.terms':       ['src/views/Register.vue'],
  'auth.reset.title':          ['src/views/ResetPassword.vue'],
  'auth.reset.submit':         ['src/views/ResetPassword.vue'],
  'auth.reset.success':        ['src/views/ResetPassword.vue'],
  // phantom keys — used in code but not declared in any locale file
  'profile.avatar.upload':     ['src/views/Profile.vue'],
  'notifications.mark_all_read': ['src/components/NotificationBell.vue'],
}
