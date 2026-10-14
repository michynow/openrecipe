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
    addShort: "Dodaj",
    drafts: "Szkice",
    settings: "Ustawienia",
    signOut: "Wyloguj się",
    account: "Konto",
    shoppingList: "Lista zakupów",
    /** The phone's tab label, where "Lista zakupów" does not fit. */
    shoppingListShort: "Zakupy",
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
    tooManyAttempts: "Za dużo prób logowania. Odczekaj minutę i spróbuj ponownie.",
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
    seeAll: "Zobacz wszystkie",
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
    /** The Shopping Export — one Recipe, unticked lines. Not the Shopping List. */
    export: "Wyślij, czego brakuje",
    copy: "Kopiuj",
    copied: "Skopiowano do schowka.",
    nothingToBuy: "Masz wszystko. Do dzieła.",

    wakeLock: "Nie gaś ekranu",
    wakeLockOn: "Ekran nie zgaśnie podczas gotowania.",

    cooked: "Ugotowane!",
    cookedConfirmed: "Zapisane. Smacznego.",

    substitutes: "Zamienniki",
    /** The two sides of the Substitutes sheet: what you lack → what works. */
    insteadOf: "Zamiast",
    youCanUse: "Możesz użyć",
    or: "albo",
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
    // Names the first section: the fields that are neither list nor picture.
    basics: "Podstawy",
    title: "Nazwa",
    totalMinutes: "Czas (minuty)",
    kcal: "kcal na porcję",
    sourceUrl: "Link do źródła",
    image: "Zdjęcie",
    imageHint: "JPG, PNG lub WebP, do 5 MB",
    pickImage: "Wybierz zdjęcie",
    dropImage: "Przeciągnij tutaj albo wybierz z galerii",
    replaceImage: "Zmień zdjęcie",
    removeImage: "Usuń zdjęcie",
    uploading: "Wysyłanie…",
    cancelUpload: "Przerwij",
    imageFailed: "Nie udało się wysłać zdjęcia. Spróbuj jeszcze raz.",
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
    /** The grip on each row: a drag target, and arrow keys when focused. */
    reorder: "Przeciągnij albo użyj strzałek ↑ ↓, żeby przestawić",
    moveUp: "Przesuń wyżej",
    moveDown: "Przesuń niżej",
    stepPlaceholder: "np. Podsmaż cebulę na złoto, ok. 5 minut",
    tipPlaceholder: "np. Sos można zamrozić na miesiąc",
    fixErrors: "Popraw zaznaczone pola.",
    optional: "opcjonalne",
    quantity: "Ilość",
    unit: "Jednostka",
    item: "Składnik",
    note: "Uwaga",
    quantityPlaceholder: "np. 2",
    unitPlaceholder: "np. łyżki",
    itemPlaceholder: "np. masło",
    notePlaceholder: "np. roztopione",
    pasteBlock: "Wklej listę",
    pasteHint: "Wklej składniki — po jednym w linii. Rozbijemy je na pola; potem możesz poprawić.",
    pasteApply: "Rozbij na wiersze",
    /** Sections (ADR-0008): optional headings over runs of Ingredient Lines. */
    sectionsHint: "Przepis z kilku części — bułki, sos, surówka? Dodaj nagłówki.",
    addSection: "Dodaj część",
    sectionName: "Nazwa części",
    sectionPlaceholder: "np. Sos",
    renameSection: "Zmień nazwę",
    removeSection: "Usuń nagłówek",
    removeSectionHint: "Składniki zostaną, tylko bez nagłówka.",
    moveToSection: "Przenieś do części",
    noSection: "Bez części",
    facets: {
      meal_slot: "Posiłek",
      cuisine: "Kuchnia",
      diet: "Dieta",
      effort: "Wysiłek",
      vibe: "Charakter",
    },
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

  /**
   * The three Proposal slots (OR-48). These duplicate the Tag labels on purpose:
   * a Tag's label is the Master's to rename, and the dashboard's headings should
   * not change under it.
   */
  mealSlots: {
    breakfast: "Śniadanie",
    lunch: "Obiad",
    dinner: "Kolacja",
  },

  dashboard: {
    proposals: "Na dziś",
    reroll: "Coś innego",
    wildcard: "Z dzikiej karty",
    slotEmpty: "Nic tu jeszcze nie ma.",
    draftsWaiting: "Szkice czekają",
    mostCooked: "Najczęściej gotowane",
    neglected: "Dawno nieużywane",
    total: "Przepisy",
    addedThisWeek: "Nowe w tym tygodniu",
    cookedThisWeek: "Ugotowane w tym tygodniu",
    neverCooked: "jeszcze nigdy",
    /** "40 dni temu" — the neglected tile's age, after a counted noun. */
    ago: "temu",
  },

  /** Parking a link, and the Drafts screen (OR-39, OR-45). */
  imports: {
    parkTitle: "Wklej link",
    /** What parking a link is for — the Drafts screen is the first place it is met. */
    parkIntro:
      "Masz przepis z internetu? Wklej link do strony, na której jest. Kuchnia przeczyta stronę, przetłumaczy przepis na polski, rozpisze składniki i kroki, dobierze tagi i zamienniki, i zrobi z tego szkic. Ty go tylko sprawdzasz i dodajesz do biblioteki.",
    parkHint: "Kuchnia zabiera się za link w ciągu minuty. Postęp widać poniżej.",
    parkAction: "Odłóż na później",
    parked: "Odłożone. Kuchnia już się za to zabiera — postęp widać poniżej.",
    alreadyParked: "Ten link już czeka w kolejce.",
    alreadyImported: "Ten przepis już jest w bibliotece.",
    openExisting: "Otwórz go",
    orPasteLink: "Masz link? Wklej go zamiast wpisywać.",
    draftsTitle: "Szkice",
    reviewTitle: "Sprawdź szkic",
    fromSource: "Zrobione z linku:",
    reviewHint:
      "Szkic zrobiła maszyna. Popraw, co trzeba, i dopiero wtedy dodaj do biblioteki.",
    approve: "Dodaj do biblioteki",
    /** MC Kiełbas, after a Draft becomes a Recipe. */
    approved: "Zaliczone! Przepis ląduje w bibliotece, prosto z grilla.",
    /** Approving a Draft someone already approved, discarded or sent back. */
    notReady: "Ten szkic nie czeka już na sprawdzenie. Odśwież listę.",
    guessed: "zgadywane",
    guessedHint:
      "Tej wartości nie było wprost na stronie — model ją oszacował. Sprawdź, zanim dodasz przepis.",
    guessedLegend: "— tego nie było wprost na stronie, model to wywnioskował. Sprawdź te pola przed dodaniem.",
    untranslated:
      "Model nie zadziałał, więc to dane prosto ze strony: bez tłumaczenia, tagów i zamienników. Przejrzyj całość.",
    discardConfirm: "Odrzucić ten szkic? Przepis nie powstanie.",
    reimport: "Zaimportuj ponownie",
    reimportConfirm:
      "Pobrać stronę źródłową jeszcze raz? Kuchnia przeczyta ją od nowa, a ty zobaczysz różnice i przyjmiesz tylko te, które chcesz.",
    reimportQueued: "Odłożone. Sprawdzisz zmiany w Szkicach.",
    reviewChangesTitle: "Sprawdź zmiany",
    diffHint:
      "Zostawiamy to, co masz teraz. Przyjmij tylko te zmiany, które chcesz.",
    noChanges: "Nic się nie zmieniło od ostatniego razu.",
    diffApply: "Przyjmij",
    diffTaken: "Przyjęte",
    updateRecipe: "Zapisz zmiany w przepisie",
    diffFields: {
      title: "Nazwa",
      servings: "Porcje",
      totalMinutes: "Czas",
      kcalPerServing: "Kcal",
      imageUrl: "Zdjęcie",
      steps: "Kroki",
      tips: "Wskazówki",
      tagSlugs: "Tagi",
      ingredientLines: "Składniki",
    },
    /** Toasts from MC Kiełbas when the Worker finishes a Draft. */
    toastReady: (title: string | null) =>
      title
        ? `Gorące z grilla! „${title}” czeka, aż rzucisz okiem.`
        : "Gorące z grilla! Szkic czeka, aż rzucisz okiem.",
    toastFailed: "Ups, ten link się przypalił. Zajrzyj do Szkiców, co poszło nie tak.",
    toastOpenDrafts: "Do Szkiców",
    toastDismiss: "Zamknij powiadomienie",
    draftsEmpty: "Nic nie czeka. Wklej link, a zajmiemy się resztą.",
    review: "Sprawdź szkic",
    retry: "Spróbuj jeszcze raz",
    discard: "Odrzuć",
    typeInstead: "Wpisz ręcznie",
    failedFallback:
      "Nie znaleziono przepisu na tej stronie. Spróbuj innego linku albo wpisz ręcznie.",
    /** What the Worker writes on a Draft it could not finish. Shown verbatim. */
    failures: {
      blocked: "Strona nie chciała się otworzyć. Może nas blokuje albo nie odpowiada.",
      notFound: "Pod tym linkiem nie ma strony (404). Sprawdź, czy link jest pełny i poprawny.",
      notHtml: "Ten link nie prowadzi do strony z przepisem.",
      needsModel:
        "Ta strona nie publikuje danych przepisu — trzeba ją przeczytać ze zrozumieniem. Na razie wpisz przepis ręcznie.",
      invalid: "Przepis z tej strony wyszedł niekompletny. Wpisz go ręcznie.",
      crashed: "Coś poszło nie tak przy przetwarzaniu. Spróbuj jeszcze raz.",
      expired:
        "Czekał w kolejce ponad 3 dni i kuchnia go nie ruszyła. Spróbuj jeszcze raz, kiedy worker będzie działał.",
    },
    /** Android push when the Worker finishes a Draft. MC Kiełbas, one beat. */
    push: {
      readyTitle: "Szkic gotowy do degustacji!",
      readyBody: (title: string) => `„${title}” czeka na Twój werdykt. Do dzieła, szefie!`,
      failedTitle: "Kuchnia się przypaliła",
      failedBody: "Ten link nie dał rady. Zerknij, co poszło nie tak.",
      /** Stand-in when a ready Draft somehow has no title. */
      untitled: "Przepis",
    },
    /**
     * A Draft's log (expandable on the Drafts screen). Written by the app and by
     * the Worker; every line says what happened in plain Polish, with the
     * technical detail — HTTP status, sizes, timings, the SDK's own error — in it.
     */
    log: {
      toggle: "Logi",
      parked: "Link dodany do kolejki.",
      requeued: "Ponownie w kolejce.",
      reimport: "Ponowny import przepisu — dodany do kolejki.",
      woke: "Kuchnia obudzona (GitHub Actions). Start zwykle w ciągu minuty.",
      /** Local dev without GITHUB_DISPATCH_TOKEN: the Worker runs on this laptop. */
      wokeLocal: "Kuchnia rusza lokalnie, na tym komputerze.",
      wakeOff: (missing: string) =>
        `Nie mogę obudzić kuchni w chmurze (brak ${missing} na Vercelu). Szkic weźmie cron, najpóźniej za 30 minut.`,
      wakeFailed: (detail: string) =>
        `Nie udało się obudzić kuchni (${detail}). Szkic weźmie cron, najpóźniej za 30 minut.`,
      claimed: (where: string) => `Kuchnia przejęła szkic (${where}).`,
      reclaimed: "Poprzedni worker zniknął w trakcie pracy — szkic wraca do kolejki.",
      expired: "Wygasł: czekał w kolejce ponad 3 dni.",
      fetching: (url: string) => `Pobieram stronę: ${url}`,
      fetched: (status: number, kb: number, ms: number) =>
        `Strona pobrana: HTTP ${status}, ${kb} kB, ${ms} ms.`,
      fetchFailed: (detail: string) => `Nie udało się pobrać strony: ${detail}.`,
      jsonLd: (ingredients: number) =>
        `Strona ma dane przepisu (JSON-LD): ${ingredients} składników.`,
      readableText: (chars: number) =>
        `Strona nie ma danych przepisu — model przeczyta jej tekst (${chars} znaków).`,
      noRecipe: "Na stronie nie ma ani danych przepisu, ani tekstu, który dałoby się przeczytać.",
      modelStart: "Model czyta przepis…",
      modelOk: (seconds: number, ingredients: number, steps: number) =>
        `Model gotowy po ${seconds} s: ${ingredients} składników, ${steps} kroków.`,
      modelFailed: (reason: string, seconds: number) =>
        `Model nie dał rady po ${seconds} s (${reason}).`,
      fallback: "Zapisuję dane ze strony bez modelu — bez tłumaczenia, tagów i zamienników.",
      image: (stored: boolean) =>
        stored ? "Zdjęcie zapisane." : "Zdjęcia nie udało się zapisać — szkic będzie bez niego.",
      ready: "Szkic gotowy do sprawdzenia.",
      crashed: (message: string) => `Worker się wysypał: ${message}`,
      limited: (at: string) =>
        `Skończył się limit subskrypcji Claude. Szkic poczeka i kuchnia sama spróbuje ponownie po ${at}.`,
    },

    /** The progress bar on a Draft that is queued or being worked on. */
    progress: {
      steps: {
        queued: "W kolejce",
        fetching: "Pobieram stronę",
        generating: "Model czyta przepis",
        image: "Zapisuję zdjęcie",
      },
      step: "Etap",
      waiting: "czeka",
      working: "w robocie",
      queuedHint:
        "Kuchnia rusza sama w ciągu minuty. Ta strona odświeży się sama, a w logach widać każdy krok. Po 3 dniach czekania link wygasa.",
      live: "Na żywo",
    },
    /** A Draft parked by a usage limit. `at` is the retry time, household clock. */
    limitedHint: (at: string) =>
      `Skończył się limit subskrypcji Claude. Kuchnia spróbuje sama po ${at} — możesz też kliknąć „Spróbuj jeszcze raz”, kiedy limit się odnowi.`,
    status: {
      queued: "Czeka w kolejce",
      processing: "W robocie",
      ready: "Gotowy do sprawdzenia",
      failed: "Nie wyszło",
      limited: "Czeka na limit Claude",
      approved: "Dodany do biblioteki",
      discarded: "Odrzucony",
    },
  },

  /** Android notification channel and the one-time permission ask for "Draft finished" pushes. */
  push: {
    channelName: "Szkice gotowe",
    channelDescription: "MC Kiełbas daje znać, kiedy kuchnia skończy szkic albo coś się jej przypali.",
    ask: "Chcesz usłyszeć gwizdek, gdy szkic będzie gotowy? Zaraz zapytam telefon o zgodę na powiadomienia.",
  },

  /** Sharing a page from another app (the phone's share sheet) into the park form. */
  share: {
    announce: "Mam twój link! Dotknij „Odłóż na później”, a kuchnia się nim zajmie.",
    notAdmin: "Odkładać linki mogą tylko administratorzy.",
    notSignedIn: "Zaloguj się, a potem udostępnij link jeszcze raz.",
    noUrl: "W tym, co udostępniono, nie ma linku do strony.",
  },

  account: {
    title: "Konto",
    theme: { title: "Motyw", system: "Jak w systemie", light: "Jasny", dark: "Ciemny" },
    push: {
      title: "Powiadomienia",
      hint: "Gwizdek od MC Kiełbasa, gdy szkic jest gotowy albo się przypalił.",
    },
    profile: "Profil",
    save: "Zapisz",
    saved: "Zapisane.",
    nameRequired: "Podaj imię.",
    currentPassword: "Obecne hasło",
    currentPasswordHint:
      "Logujesz się tylko przez Google? Zostaw puste, żeby ustawić pierwsze hasło.",
    newPassword: "Nowe hasło",
    changePassword: "Zmień hasło",
    passwordChanged: "Hasło zmienione. Inne urządzenia zostały wylogowane.",
    passwordTooShort: "Hasło musi mieć co najmniej 8 znaków.",
    passwordFailed: "Nie udało się zmienić hasła. Sprawdź obecne hasło.",
    roles: {
      master: "Właściciel",
      admin: "Administrator",
      member: "Tylko przeglądanie",
    },
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
    queueQueued: "w kolejce",
    queueReady: "do sprawdzenia",
    queueFailed: "nie wyszło",
    membersEmpty: "Na razie tylko ty.",
    master: "Właściciel",
    role: "Rola",
    rolesHint:
      "Administrator może wszystko co właściciel. Pozostali tylko przeglądają przepisy.",
    saveRole: "Zmień",
    joined: "Dołączył",
    removeMemberConfirm: "Usunąć tę osobę? Jej przepisy zostaną.",
    tagSlug: "slug (po angielsku)",
    tagLabel: "etykieta (po polsku)",
    tagSlugFixed: "Slug jest na stałe — zmienić można tylko etykietę.",
    tagInUse: "Ten tag jest w użyciu.",
    rename: "Zmień nazwę",
    inviteState: {
      used: "wykorzystane",
      expired: "przedawnione",
      revoked: "unieważnione",
      open: "aktywne",
    },
    shareInvite: "Udostępnij link",
    /** Why a member change was refused. */
    memberErrors: {
      master: "Właściciela nie można zmienić ani usunąć.",
      missing: "Tej osoby już nie ma. Odśwież listę.",
    },
    /** Why a tag change was refused (TagResult.reason). */
    tagErrors: {
      slug: "Slug: od 2 do 40 małych liter, cyfr lub myślników, zaczyna się od litery.",
      duplicate: "Taki tag już istnieje.",
      "in-use": "Ten tag jest w użyciu, więc nie da się go usunąć.",
      missing: "Tego tagu już nie ma. Odśwież listę.",
    },
  },

  /** The household Shopping List (ADR-0009). Shared: everyone sees the same ticks. */
  shoppingList: {
    title: "Lista zakupów",
    add: "Dodaj do listy zakupów",
    /** The servings picker in the add sheet. */
    addServings: "Na ile porcji?",
    pantryNote: "Pominiemy to, co masz odhaczone w „Co już masz?”.",
    added: "Wrzucone na listę! MC Kiełbas już pcha wózek.",
    /** The Recipe page when this Recipe is already on the list. */
    onList: "Już na liście zakupów",
    update: "Zmień porcje na liście",
    updated: "Lista poprawiona.",
    open: "Zobacz listę",
    recipes: "Przepisy na liście",
    items: "Do kupienia",
    remove: "Usuń z listy",
    removed: "Wyleciało z listy.",
    /** After a source Recipe's title: how many of its lines are left off. */
    skipped: (n: number) => `pominięto: ${n}`,
    /** Before the source Recipes under a row: "z: Ragu, Sałatka". */
    from: "z:",
    toTaste: "do smaku",
    tick: "Odhacz",
    untick: "Odznacz",
    clearTicked: "Wyczyść odhaczone",
    clearAll: "Wyczyść wszystko",
    clearAllConfirm: "Wyczyścić całą listę? Zniknie u wszystkich domowników.",
    share: "Udostępnij listę",
    empty: "Lista pusta. Wrzuć przepis, a składniki same tu wskoczą.",
    allTicked: "Wszystko w koszyku. Do kasy!",
    /** Text export footer: "Na: Ragu (4 porcje), Sałatka (2 porcje)". */
    forRecipes: "Na:",
    inBasket: (done: number, total: number) => `(${done} z ${total} już w koszyku)`,
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
    offline: "Brak połączenia. Przepis i „Co już masz?” działają dalej.",
    close: "Zamknij",
    notFoundTitle: "Nie ma tu nic",
    notFoundBody: "Ta strona nie istnieje albo nie masz do niej dostępu.",
    backHome: "Wróć na start",
  },

  /**
   * MC Kiełbas, the announcer behind the "?" button. A smug sausage in a bow
   * tie doing fighting-game MC: loud, cheeky, innuendo on every line — never
   * explicit. Lines are game-dialogue short, one beat each, and every one must
   * still be true about what the screen does.
   */
  help: {
    open: "Pomoc — co tu robić?",
    name: "MC Kiełbas",
    next: "Dalej",
    close: "Zamknij",
    pages: {
      dashboard: [
        "UWAGA, UWAGA! Na ring wchodzi twoja kuchnia! Ja jestem MC Kiełbas — dziś to ja tu robię za gorącą atrakcję.",
        "U góry tablica wyników: ile masz przepisów, ile szkiców czeka, co grillujesz najczęściej, a co leży i stygnie.",
        "„Na dziś” — trzech zawodników: śniadanie, obiad, kolacja. Nie podnieca cię? „Coś innego” i losujemy dalej.",
        "Na dole „Ostatnio dodane”. Świeże mięsko w bibliotece. Mrrr.",
      ],
      search: [
        "Tryb łowów! Wpisz, na co masz ochotę. Kiełbas nie ocenia, Kiełbas rozumie.",
        "Filtry: posiłek, kuchnia, dieta, wysiłek, charakter i czas. Zaznacz, co cię kręci, i „Pokaż wyniki”.",
        "Pro tip: „Ze zdjęciem”. Najpierw jemy oczami, kotku.",
      ],
      drafts: [
        "Etap bonusowy: import! Wklej link do przepisu z dowolnej strony i idź się zrelaksować.",
        "Maszyna przemieli go na szkic w minutę. Uwierz mi, znam się na mieleniu.",
        "Gotowe? „Sprawdź szkic”. Nie wyszło? Rozwiń „Logi” — tam wszystko jak na tacy. Potem spróbuj jeszcze raz albo wpisz ręcznie. Ręczna robota też ma swój urok.",
      ],
      draft: [
        "Kontrola jakości! Szkic złożyła maszyna, a maszyna czasem zgaduje. Jak ja, ile mam w sobie mięsa.",
        "Pola z dopiskiem „zgadywane” sprawdź dwa razy. Potem do pięciu tagów i „Dodaj do biblioteki”.",
        "Nie pasuje? Odrzuć bez litości. Ponowny import? Bierz tylko te zmiany, które ci smakują.",
      ],
      newRecipe: [
        "Tryb kreatora! Nazwa, porcje, co najmniej jeden składnik i jeden krok — i jedziemy.",
        "Kroki krótko, jedna czynność na raz. Długie gadanie zostaw mnie.",
        "Składniki wrzuć hurtem przez „Wklej listę”, posiekam je na pola. Tagów max pięć — nawet kiełbasa zna umiar.",
        "Masz link? Wklej go zamiast klepać. Szybciej niż ja na grillu.",
      ],
      recipe: [
        "GOTUJ! Plus i minus zmieniają porcje — ilości przeliczą się same, oryginał zostaje nietknięty.",
        "„Co już masz?” — odhacz, co stoi w lodówce. Resztę wyślij komuś albo wrzuć na listę zakupów — odhaczone zostaną w domu.",
        "„Nie gaś ekranu”, żeby telefon nie zasnął w połowie akcji. Nikt nie lubi, jak ktoś zasypia w połowie.",
        "Brakuje składnika? Zerknij w zamienniki. Skończone? Wal w „Ugotowane!” — combo zaliczone.",
        "Pod tytułem: edycja, ponowny import i usuwanie. Usunięcie da się na chwilę cofnąć. Mnie jak ktoś zje, to już nie.",
      ],
      editRecipe: [
        "Warsztat! Zmieniaj, co chcesz, i „Zapisz”. Spróbujesz uciec bez zapisu — zatrzymam cię.",
        "Strzałkami przestawiasz składniki i kroki. Góra, dół — pozycja dowolna.",
      ],
      settings: [
        "Zaplecze dla szefa. Zaproszenia: tworzysz link, kopiujesz, dajesz, komu chcesz. Maili nie wysyłamy — wszystko z ręki do ręki.",
        "Domownicy to twoja drużyna. Tagi dodajesz i przemianowujesz, ale slug zostaje na zawsze. Jak tatuaż po kawalerskim.",
        "Na dole kolejka importu: co czeka, co gotowe, a co poległo.",
      ],
      shoppingList: [
        "Supermarket Sweep! Jedna lista dla całej chaty — każdy dorzuca przepisy i odhacza, co już w wózku.",
        "To samo w tej samej jednostce sumuję. Inna jednostka? Osobny wiersz pod tym samym produktem. Nie przeliczam łyżek na gramy, nie jestem kalkulatorem, jestem kiełbasą.",
        "Pod każdą pozycją widać, do którego przepisu idzie. Porcje zmieniasz przy przepisie, a „Udostępnij listę” wyśle ją jako tekst.",
        "Po zakupach „Wyczyść odhaczone”. Lista zrobi się lekka jak ja po grillu… no dobra, nie aż tak.",
      ],
      lost: ["Zgubiłeś się, kotku? Wracaj na Start, tam cię oprowadzę."],
    },
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
