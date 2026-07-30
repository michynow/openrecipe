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
    tokenWrongEmail: "To zaproszenie jest przypisane do innego adresu e-mail.",
    emailTaken: "Konto z tym adresem już istnieje. Zaloguj się.",
    couldNotCreate:
      "Nie udało się utworzyć konta. Hasło musi mieć co najmniej 8 znaków.",
    creating: "Tworzenie konta…",
    goToLogin: "Przejdź do logowania",
  },

  library: {
    empty: "Brak przepisów. Dodaj pierwszy.",
    recent: "Ostatnio dodane",
  },

  recipe: {
    servings: "Porcje",
    fewerServings: "Mniej porcji",
    moreServings: "Więcej porcji",
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
    openSource: "Zobacz oryginał",
    // The editor asks for minutes; the read view shows "1 h 35 min", so it must
    // not repeat the unit in the label.
    time: "Czas",
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
    moveUp: "W górę",
    moveDown: "W dół",
    stepPlaceholder: "Krótko, jedna czynność",
    tipPlaceholder: "Coś, co warto wiedzieć",
    fixErrors: "Popraw zaznaczone pola.",
    optional: "opcjonalne",
    quantity: "Ilość",
    unit: "Jednostka",
    item: "Składnik",
    note: "Uwaga",
    quantityPlaceholder: "2",
    unitPlaceholder: "łyżki",
    itemPlaceholder: "masło",
    notePlaceholder: "roztopione",
    pasteBlock: "Wklej listę",
    pasteHint: "Wklej składniki — po jednym w linii. Rozbijemy je na pola; potem możesz poprawić.",
    pasteApply: "Rozbij na wiersze",
    facets: {
      meal_slot: "Posiłek",
      cuisine: "Kuchnia",
      diet: "Dieta",
      effort: "Wysiłek",
      vibe: "Charakter",
    },
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
    maxTime: "Maksymalny czas",
    anyTime: "Bez limitu",
    hasImage: "Ze zdjęciem",
    apply: "Pokaż wyniki",
    /** Names the autocomplete's listbox. The placeholder is a question, not a name. */
    suggestions: "Podpowiedzi",
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
    inviteState: {
      used: "wykorzystane",
      expired: "przedawnione",
      revoked: "unieważnione",
    },
  },

  validation: {
    titleRequired: "Podaj nazwę przepisu.",
    servingsRequired: "Podaj liczbę porcji.",
    servingsRange: "Liczba porcji musi być między 1 a 99.",
    ingredientsRequired: "Dodaj przynajmniej jeden składnik.",
    itemRequired: "Podaj nazwę składnika.",
    stepsRequired: "Dodaj przynajmniej jeden krok.",
    quantityPositive: "Ilość nie może być ujemna.",
    totalMinutesRange: "Czas musi być między 1 a 10080 minut.",
    kcalRange: "Kalorie muszą być między 0 a 10000.",
    tagsTooMany: "Maksymalnie 5 tagów.",
    tagsDuplicate: "Ten tag jest już wybrany.",
    tagUnknown: "Nie znamy takiego tagu:",
    lineTooLong: "Za długo. Skróć do 300 znaków.",
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
    notFoundTitle: "Nie ma tu nic",
    notFoundBody: "Ta strona nie istnieje albo nie masz do niej dostępu.",
    backHome: "Wróć na start",
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
