// A branded drop-down: a field that opens a bottom sheet of options. Used for the council filter,
// the hour and minute pickers and the member picker. The selected row carries a gold marker.
// Sprint 6C: styled from useTheme(), so the large text layout gets a black field and sheet with gold edges and
// touchTarget-tall rows.
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { NavStripLayout } from '@/components/NavStrip';
import { AppText } from '@/components/ui';
import type { LayoutTokens } from '@kofc/shared';
import { useTheme } from '@/lib/layout-mode';

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
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
              <NavStripLayout
                surface="navy"
                onBack={() => setOpen(false)}
                onClose={() => setOpen(false)}
                closeLabel={`Close ${title}`}
                title={
                  <AppText variant="heading" tone="white" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18, lineHeight: 24 }}>
                    {title}
                  </AppText>
                }
              />
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

const makeStyles = ({ color, radius, space, touchTarget, border, large }: LayoutTokens) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minHeight: touchTarget,
      paddingHorizontal: space.md,
      borderWidth: border(1),
      borderColor: large ? color.gold : color.navy,
      borderRadius: radius.sm,
      backgroundColor: color.white,
    },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 40, 85, 0.45)' },
    sheet: {
      maxHeight: large ? '85%' : '70%',
      backgroundColor: color.white,
      borderWidth: large ? 4 : 0,
      borderColor: color.gold, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, overflow: 'hidden' },
    sheetHeader: {
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      backgroundColor: color.navy,
    },
    row: {
      minHeight: touchTarget,
      justifyContent: 'center',
      paddingHorizontal: space.lg,
      borderLeftWidth: large ? 12 : 6,
      borderBottomWidth: border(1),
      borderBottomColor: color.line,
      backgroundColor: color.white,
    },
  });
