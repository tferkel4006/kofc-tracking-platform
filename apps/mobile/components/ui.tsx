// Brand primitives. Every string on screen goes through AppText and every input through AppInput,
// which is what guarantees the Arial body font; colours come only from the shared tokens.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { color, fontFamily, radius, space, touchTarget } from '@/lib/theme';

type Variant = 'body' | 'small' | 'label' | 'title' | 'heading';

const variants: Record<Variant, TextStyle> = {
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.4 },
  title: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  heading: { fontFamily: fontFamily.heading, fontSize: 24, lineHeight: 30, fontWeight: '700' },
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: 'navy' | 'red' | 'muted' | 'white';
}

export function AppText({ variant = 'body', tone = 'navy', style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[variants[variant], { color: tone === 'muted' ? color.muted : color[tone] }, style]} />;
}

export function AppInput({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={color.muted}
      {...rest}
      style={[
        variants.body,
        { color: color.navy, borderWidth: 1, borderColor: color.navy, borderRadius: radius.sm, minHeight: touchTarget, paddingHorizontal: space.md, backgroundColor: color.white },
        style,
      ]}
    />
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  const filled = variant !== 'secondary';
  const fill = variant === 'danger' ? color.red : color.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled ? fill : color.white, borderColor: fill, opacity: off ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={filled ? color.white : color.navy} />
      ) : (
        <AppText variant="title" tone={filled ? 'white' : 'navy'}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

type PillTone = 'navy' | 'red' | 'redOutline' | 'gold' | 'outline';

/** Status chip. Gold fills carry navy text (6.4:1); gold is never used as text. */
export function Pill({ label, tone = 'navy', style }: { label: string; tone?: PillTone; style?: StyleProp<ViewStyle> }) {
  const look: Record<PillTone, { bg: string; fg: 'white' | 'navy' | 'red'; border: string }> = {
    navy: { bg: color.navy, fg: 'white', border: color.navy },
    red: { bg: color.red, fg: 'white', border: color.red },
    redOutline: { bg: color.white, fg: 'red', border: color.red },
    gold: { bg: color.gold, fg: 'navy', border: color.gold },
    outline: { bg: color.white, fg: 'navy', border: color.navy },
  };
  const { bg, fg, border } = look[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }, style]}>
      <AppText variant="label" tone={fg}>
        {label}
      </AppText>
    </View>
  );
}

/** A white card with a coloured accent bar on the left edge (red = urgent, gold = priority, navy = normal). */
export function Card({
  accent = color.navy,
  muted,
  children,
  style,
}: {
  accent?: string;
  muted?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, { borderLeftColor: muted ? color.line : accent, opacity: muted ? 0.75 : 1 }, style]}>{children}</View>
  );
}

export function Notice({ tone, message, onDismiss }: { tone: 'error' | 'info'; message: string; onDismiss?: () => void }) {
  const border = tone === 'error' ? color.red : color.navy;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: border }]}>
      <AppText variant="body" tone={tone === 'error' ? 'red' : 'navy'} style={{ flex: 1 }}>
        {message}
      </AppText>
      {onDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={12}>
          <AppText variant="title" tone={tone === 'error' ? 'red' : 'navy'}>
            ×
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.sectionHeader}>
        <AppText variant="heading" style={{ fontSize: 20, lineHeight: 26 }}>
          {title}
        </AppText>
        {right}
      </View>
      {children}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <AppText tone="muted">{message}</AppText>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.empty} accessibilityRole="progressbar">
      <ActivityIndicator color={color.navy} />
      <AppText tone="muted" style={{ marginTop: space.sm }}>
        {label}
      </AppText>
    </View>
  );
}

/** Scrolling white page with pull-to-refresh. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.white }}
      contentContainerStyle={[{ padding: space.lg, gap: space.xl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.navy} colors={[color.navy]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="label">{label}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  card: {
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.line,
    borderLeftWidth: 6,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: color.white,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  empty: { alignItems: 'center', padding: space.xl, borderWidth: 1, borderColor: color.line, borderRadius: radius.md },
});
