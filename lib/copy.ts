/**
 * Every user-facing string in OpenRecipe. Polish, informal register (ty, not Pan/Pani).
 *
 * Nothing a user can read belongs in a component. See ADR-0005: the interface is Polish,
 * the code is English, and there is no i18n library because there is no second locale.
 *
 * Polish typographic quotes („…”) — not straight quotes.
 */
export const copy = {
  app: {
    name: "OpenRecipe",
  },

  nav: {
    dashboard: "Start",
    search: "Szukaj",
    add: "Dodaj przepis",
    drafts: "Szkice",
    settings: "Ustawienia",
    signOut: "Wyloguj się",
    account: "Konto",
  },

  auth: {
    title: "Witaj ponownie.",
    email: "E-mail",
    password: "Hasło",
    signIn: "Zaloguj się",
    google: "Kontynuuj przez Google",
    // No email provider by design, so resets go through the Master by hand.
    noSelfReset: "Zapomniałeś hasła? Poproś właściciela o link do zmiany.",
    // Deliberately identical whether or not the address exists — no account enumeration.
    invalidCredentials: "Nieprawidłowy e-mail lub hasło.",
    signingIn: "Logowanie…",
  },

  join: {
    title: "Dołącz do OpenRecipe",
    yourName: "Twoje imię",
    createAccount: "Utwórz konto",
    tokenUnknown: "Nie znamy tego zaproszenia.",
    tokenUsed: "To zaproszenie zostało już wykorzystane.",
    tokenExpired: "To zaproszenie straciło ważność.",
  },

  library: {
    empty: "Brak przepisów. Dodaj pierwszy.",
    recent: "Ostatnio dodane",
  },

  recipe: {
    servings: "Porcje",
    ingredients: "Składniki",
    steps: "Przygotowanie",
    tips: "Wskazówki",
    source: "Źródło",
    addedBy: "Dodał",
    editedBy: "Poprawił",
    edit: "Edytuj",
    kcalPerServing: "kcal na porcję",

    pantryCheck: "Co już masz?",
    export: "Wyślij listę zakupów",
    copy: "Kopiuj",
    copied: "Skopiowano do schowka.",
    nothingToBuy: "Masz wszystko. Do dzieła.",

    wakeLock: "Nie gaś ekranu",
    wakeLockOn: "Ekran nie zgaśnie podczas gotowania.",

    cooked: "Ugotowane!",
    cookedConfirmed: "Zapisane. Smacznego.",

    substitutes: "Zamienniki",
    noSubstitutes:
      "Brak zamienników dla tego składnika. Pojawiają się przy przepisach z linku.",
  },

  editor: {
    newTitle: "Nowy przepis",
    editTitle: "Edytuj przepis",
    title: "Nazwa",
    totalMinutes: "Czas (minuty)",
    kcal: "kcal na porcję",
    sourceUrl: "Link do źródła",
    image: "Zdjęcie",
    removeImage: "Usuń zdjęcie",
    tags: "Tagi",
    tagsCount: "wybrane z 5",
    tagsFull: "Maksymalnie 5 tagów. Odznacz któryś, żeby dodać nowy.",
    addIngredient: "Dodaj składnik",
    addStep: "Dodaj krok",
    addTip: "Dodaj wskazówkę",
    save: "Zapisz",
    saving: "Zapisywanie…",
    cancel: "Anuluj",
    unsavedChanges: "Masz niezapisane zmiany. Wyjść i je porzucić?",
  },

  importFlow: {
    pasteLink: "Wklej link do przepisu",
    park: "Odłóż na później",
    queued: "Odłożone. Zajmiemy się tym, gdy kuchnia będzie otwarta.",
    duplicate: "Ten link już u nas jest.",
    openExisting: "Otwórz to, co mamy",

    draftReady: "Szkic gotowy — sprawdź go przed zapisaniem.",
    guessedField: "Zgadywane — sprawdź",
    approve: "Zatwierdź",
    discard: "Odrzuć",

    failed:
      "Nie znaleziono przepisu na tej stronie. Spróbuj innego linku albo wpisz ręcznie.",
    retry: "Spróbuj ponownie",
    typeItMyself: "Wpiszę ręcznie",
    waitingForWorker: "Czeka na przetworzenie.",
  },

  search: {
    placeholder: "Czego szukasz?",
    noResults: "Brak wyników. Spróbuj innej frazy.",
    filters: "Filtry",
    clearFilters: "Wyczyść filtry",
    endOfResults: "To wszystko.",
  },

  dashboard: {
    proposals: "Na dziś",
    reroll: "Coś innego",
    wildcard: "Z dzikiej karty",
    slotEmpty: "Nic tu jeszcze nie ma.",
    draftsWaiting: "Szkice czekają",
    mostCooked: "Najczęściej gotowane",
    neglected: "Dawno nieużywane",
  },

  settings: {
    title: "Ustawienia",
    invites: "Zaproszenia",
    mintInvite: "Utwórz zaproszenie",
    revoke: "Unieważnij",
    inviteHint:
      "Nie wysyłamy e-maili — skopiuj link i przekaż go samodzielnie.",
    members: "Domownicy",
    remove: "Usuń",
    tags: "Tagi",
    addTag: "Dodaj tag",
    queue: "Kolejka importu",
  },

  validation: {
    titleRequired: "Podaj nazwę przepisu.",
    servingsRequired: "Podaj liczbę porcji.",
    servingsRange: "Liczba porcji musi być między 1 a 99.",
    ingredientsRequired: "Dodaj przynajmniej jeden składnik.",
    itemRequired: "Podaj nazwę składnika.",
    stepsRequired: "Dodaj przynajmniej jeden krok.",
    quantityPositive: "Ilość nie może być ujemna.",
    urlInvalid: "To nie wygląda na poprawny link.",
    imageTooBig: "Zdjęcie jest za duże. Maksymalnie 5 MB.",
    imageWrongType: "Dozwolone formaty: JPG, PNG, WebP.",
  },

  common: {
    undo: "Cofnij",
    delete: "Usuń",
    deleted: "Usunięto.",
    loading: "Ładowanie…",
    retry: "Spróbuj ponownie",
    somethingFailed: "Nie udało się. Spróbuj jeszcze raz.",
    offline: "Brak połączenia. Przepis i lista zakupów działają dalej.",
    close: "Zamknij",
  },

  /** Plural forms, for the `plural` helper in ./format. Polish needs three. */
  units: {
    servings: { one: "porcja", few: "porcje", many: "porcji" },
    recipes: { one: "przepis", few: "przepisy", many: "przepisów" },
    drafts: { one: "szkic", few: "szkice", many: "szkiców" },
    minutes: { one: "minuta", few: "minuty", many: "minut" },
    times: { one: "raz", few: "razy", many: "razy" },
    days: { one: "dzień", few: "dni", many: "dni" },
    ingredients: { one: "składnik", few: "składniki", many: "składników" },
  },
} as const;

/** Delete confirmation names the Recipe — never a bare "are you sure?". */
export const confirmDelete = (title: string) =>
  `Usunąć „${title}”? Tego nie da się cofnąć.`;

/** How many of a Recipe's Ingredient Lines the reader already had. */
export const pantrySkipped = (skipped: number, total: number) =>
  `(${skipped} z ${total} już masz)`;
