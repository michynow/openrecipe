import { copy } from "@openrecipe/core/copy";
import { parseSearchFilters, searchFiltersToQuery, type SearchFilters } from "@openrecipe/core/search-params";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";

import { SearchFilterPanel } from "../../components/search/filters";
import { ArcadeButton } from "../../components/ui/button";
import { RecipeCard, RecipeCardSkeleton } from "../../components/ui/recipe-card";
import { Screen } from "../../components/ui/screen";
import { useSearch, useTags } from "../../lib/hooks/discovery";

export default function Search() {
  // The screen state *is* the canonical query string (core search-params).
  const [qs, setQs] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const filters = useMemo(() => parseSearchFilters(new URLSearchParams(qs)), [qs]);
  const setFilters = (next: SearchFilters) => setQs(searchFiltersToQuery(next));

  // Debounce typing into the query string.
  useEffect(() => {
    const timer = setTimeout(
      () => setQs((cur) => searchFiltersToQuery({ ...parseSearchFilters(new URLSearchParams(cur)), query: text.trim() || undefined })),
      300,
    );
    return () => clearTimeout(timer);
  }, [text]);

  const tags = useTags();
  const search = useSearch(qs);
  const recipes = search.data?.pages.flatMap((p) => p.recipes) ?? [];
  const active = filters.tagSlugs.length + (filters.maxTotalMinutes !== undefined ? 1 : 0) + (filters.hasImage ? 1 : 0);

  const header = (
    <View className="gap-3 pb-3">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={copy.search.placeholder}
        accessibilityLabel={copy.nav.search}
        returnKeyType="search"
        className="min-h-11 rounded-input border-2 border-line bg-surface px-3 font-body text-base text-text"
      />
      <View className="flex-row items-center gap-3">
        <ArcadeButton
          label={`${copy.search.filters}${active ? ` (${active})` : ""}`}
          onPress={() => setOpen((o) => !o)}
          tone="surface"
        />
        {active > 0 ? (
          <Text
            accessibilityRole="button"
            onPress={() => setFilters({ query: filters.query, tagSlugs: [], maxTotalMinutes: undefined, hasImage: false })}
            className="font-bold text-sm text-muted underline"
          >
            {copy.search.clearFilters}
          </Text>
        ) : null}
      </View>
      {open && tags.data ? <SearchFilterPanel filters={filters} groups={tags.data} onChange={setFilters} /> : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        key="grid"
        data={search.isPending ? [] : recipes}
        keyExtractor={(r) => r.slug}
        numColumns={2}
        columnWrapperClassName="gap-3 mb-3"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        onEndReached={() => search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          search.isPending ? (
            <View className="flex-row gap-3">
              <RecipeCardSkeleton />
              <RecipeCardSkeleton />
            </View>
          ) : search.isError ? (
            <View className="items-center gap-3 py-10">
              <Text className="text-center font-bold text-accent">{copy.common.somethingFailed}</Text>
              <ArcadeButton label={copy.common.retry} onPress={() => search.refetch()} />
            </View>
          ) : (
            <Text className="rounded-card border-2 border-dashed border-line p-6 text-center font-body text-muted">
              {copy.search.noResults}
            </Text>
          )
        }
        ListFooterComponent={
          search.isFetchingNextPage ? (
            <ActivityIndicator />
          ) : recipes.length > 0 && !search.hasNextPage ? (
            <Text className="py-4 text-center font-body text-sm text-muted">{copy.search.endOfResults}</Text>
          ) : null
        }
      />
    </Screen>
  );
}
