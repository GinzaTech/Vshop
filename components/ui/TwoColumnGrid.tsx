import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

interface TwoColumnGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  rowStyle?: StyleProp<ViewStyle>;
  spacerStyle?: StyleProp<ViewStyle>;
}

export const buildTwoColumnRows = <T,>(items: T[]) => {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }

  return rows;
};

export default function TwoColumnGrid<T>({
  items,
  renderItem,
  keyExtractor,
  rowStyle,
  spacerStyle,
}: TwoColumnGridProps<T>) {
  const rows = React.useMemo(() => buildTwoColumnRows(items), [items]);

  return (
    <>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, rowStyle]}>
          {row.map((item, itemIndex) => (
            <React.Fragment key={keyExtractor(item, rowIndex * 2 + itemIndex)}>
              {renderItem(item, rowIndex * 2 + itemIndex)}
            </React.Fragment>
          ))}
          {row.length === 1 ? <View style={[styles.spacer, spacerStyle]} /> : null}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  spacer: {
    flex: 1,
  },
});
