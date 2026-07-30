// RecShelf — one horizontal Discover shelf: a section title/blurb over a
// sideways-scrolling row of RecCards.
//
// `onDark` renders the shelf as a translucent black panel with white text, for
// the Discover screen's blurred-hero background.

import { FlatList, Text, View } from "react-native";

import { RecCard } from "./RecCard.jsx";

export function RecShelf({ section, baseUrl, onDark }) {
  if (!section?.items?.length) return null;
  return (
    <View className={onDark ? "mx-4 mb-4 bg-black/45 pt-4 pb-3" : "mb-7"}>
      <View className={onDark ? "px-4 mb-3" : "px-5 mb-3"}>
        <Text
          className={`font-ui text-lg font-bold leading-tight ${
            onDark ? "text-white" : "text-base-content"
          }`}
        >
          {section.name}
        </Text>
        {section.summary ? (
          <Text
            className={`font-ui text-xs mt-0.5 ${
              onDark ? "text-white/70" : "text-base-content/55"
            }`}
            numberOfLines={2}
          >
            {section.summary}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={section.items}
        keyExtractor={(it, i) => `${it.id}:${i}`}
        renderItem={({ item }) => <RecCard item={item} baseUrl={baseUrl} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: onDark ? 16 : 20 }}
      />
    </View>
  );
}
