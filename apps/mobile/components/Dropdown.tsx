// A branded drop-down: a field that opens a bottom sheet of options. Used for the council filter,
// the hour and minute pickers and the member picker. The selected row carries a gold marker.
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { color, radius, space, touchTarget } from '@/lib/theme';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
}

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  title,
  placeholder = 'Select…',
  accessibilityLabel,
  style,
}: {
  value: T | null;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Heading of the sheet. */
  title: string;
  placeholder?: string;
  accessibilityLabel?: string;
  style?: object;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel ?? title}: ${selected?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={[styles.field, style]}
      >
        <AppText numberOfLines={1} style={{ flex: 1 }} tone={selected ? 'navy' : 'muted'}>
          {selected?.label ?? placeholder}
        </AppText>
        <AppText variant="small">▾</AppText>
      </Pressable>

      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading" tone="white" style={{ fontSize: 18, lineHeight: 24 }}>
                {title}
              </AppText>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12}>
                <AppText variant="title" tone="white">
                  Done
                </AppText>
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.value)}
              initialNumToRender={20}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={[styles.row, { borderLeftColor: isSelected ? color.gold : color.white }]}
                  >
                    <AppText variant={isSelected ? 'title' : 'body'}>{item.label}</AppText>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: color.navy,
    borderRadius: radius.sm,
    backgroundColor: color.white,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 40, 85, 0.45)' },
  sheet: { maxHeight: '70%', backgroundColor: color.white, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, overflow: 'hidden' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
    backgroundColor: color.navy,
  },
  row: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderLeftWidth: 6,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    backgroundColor: color.white,
  },
});
