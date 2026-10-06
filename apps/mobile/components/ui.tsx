// Brand primitives. Every string on screen goes through AppText and every input through AppInput,
// which is what guarantees the Arial body font; colours come only from the shared tokens.
// Sprint 6C: every primitive reads useTheme(), so in the large text layout text is bold, white and larger, tap areas
// are at least LARGE_TEXT_TOUCH_TARGET tall, and cards, buttons, inputs and chips sit on black inside thick gold borders.
import { useMemo, useState, type ReactNode } from 'react';
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
import { isNewMember, NEW_MEMBER_BADGE_LABEL, type LayoutTokens, type Member } from '@kofc/shared';
import { useTheme } from '@/lib/layout-mode';
import { fontFamily } from '@/lib/theme';

type Variant = 'body' | 'small' | 'label' | 'title' | 'heading';

/** Standard-layout type ramp; the large text layout scales each size through LayoutTokens.font. */
const variants: Record<Variant, TextStyle> = {
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.4 },
  title: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  heading: { fontFamily: fontFamily.heading, fontSize: 24, lineHeight: 30, fontWeight: '700' },
};

/** The variant's style in the current layout. */
export function textVariant(theme: LayoutTokens, variant: Variant): TextStyle {
  const v = variants[variant];
  if (!theme.large) return v;
  return { ...v, fontSize: theme.font(v.fontSize!), lineHeight: theme.font(v.lineHeight!), fontWeight: '700' };
}

/**
 * The large text layout's override for any text style: its fontSize and lineHeight scaled, bold, and always white.
 * It goes last in a style array, so a screen's own sizes and colours are scaled and replaced rather than kept.
 */
export function largeTextOverride(theme: LayoutTokens, style: StyleProp<TextStyle>): TextStyle | null {
  if (!theme.large) return null;
  const flat = StyleSheet.flatten(style) ?? {};
  return {
    color: theme.color.text,
    fontWeight: '700',
    ...(typeof flat.fontSize === 'number' ? { fontSize: theme.font(flat.fontSize) } : {}),
    ...(typeof flat.lineHeight === 'number' ? { lineHeight: theme.font(flat.lineHeight) } : {}),
  };
}

/**
 * The large text layout's floor for a tap area: a screen's own smaller minHeight is lifted to the layout's
 * touchTarget. Goes last in a style array; null in the standard layout.
 */
export function largeHitTarget(theme: LayoutTokens, style: StyleProp<ViewStyle | TextStyle>): ViewStyle | null {
  if (!theme.large) return null;
  const own = StyleSheet.flatten(style)?.minHeight;
  return { minHeight: Math.max(typeof own === 'number' ? own : 0, theme.touchTarget) };
}

/**
 * The fill of a tab, chip or option that can be chosen: navy when chosen, white otherwise. Both are black in the large
 * text layout, so there a chosen one is ringed thick in white and the rest in gold.
 */
export function choiceStyle(theme: LayoutTokens, selected: boolean): ViewStyle {
  const { color } = theme;
  if (!theme.large) return { backgroundColor: selected ? color.navy : color.white };
  return { backgroundColor: color.white, borderWidth: selected ? 8 : 4, borderColor: selected ? color.text : color.gold };
}

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: 'navy' | 'red' | 'muted' | 'white';
}

export function AppText({ variant = 'body', tone = 'navy', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Text
      {...rest}
      style={[textVariant(theme, variant), { color: tone === 'muted' ? color.muted : color[tone] }, style, largeTextOverride(theme, style)]}
    />
  );
}

export function AppInput({ style, ...rest }: TextInputProps) {
  const theme = useTheme();
  const { color, radius, space, touchTarget } = theme;
  return (
    <TextInput
      placeholderTextColor={color.muted}
      {...rest}
      style={[
        textVariant(theme, 'body'),
        {
          color: color.text,
          borderWidth: theme.border(1),
          borderColor: theme.large ? color.gold : color.navy,
          borderRadius: radius.sm,
          minHeight: touchTarget,
          paddingHorizontal: space.md,
          backgroundColor: color.white,
        },
        style,
        largeTextOverride(theme, style),
        largeHitTarget(theme, style),
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
  const theme = useTheme();
  const { color } = theme;
  const styles = useStyles();
  const off = disabled || busy;
  const filled = variant !== 'secondary';
  const fill = variant === 'danger' ? color.red : color.navy;
  // Large text layout: every button is black (danger stays red) inside a thick gold edge.
  const edge = theme.large ? color.gold : fill;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled ? fill : color.white, borderColor: edge, opacity: off ? 0.45 : pressed ? 0.85 : 1 },
        style,
        largeHitTarget(theme, style),
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.large ? color.text : filled ? color.white : color.navy} />
      ) : (
        <AppText variant="title" tone={filled ? 'white' : 'navy'} style={{ textAlign: 'center' }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

type PillTone = 'navy' | 'red' | 'redOutline' | 'gold' | 'outline';

/**
 * Status chip. Gold fills carry navy text (6.4:1); gold is never used as text. In the large text layout every chip
 * is black with white text inside a thick edge: red for the red tones, gold otherwise (white on gold is unreadable).
 */
export function Pill({ label, tone = 'navy', style }: { label: string; tone?: PillTone; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { color } = theme;
  const styles = useStyles();
  const look: Record<PillTone, { bg: string; fg: 'white' | 'navy' | 'red'; border: string }> = {
    navy: { bg: color.navy, fg: 'white', border: color.navy },
    red: { bg: color.red, fg: 'white', border: color.red },
    redOutline: { bg: color.white, fg: 'red', border: color.red },
    gold: { bg: color.gold, fg: 'navy', border: color.gold },
    outline: { bg: color.white, fg: 'navy', border: color.navy },
  };
  const { bg, fg, border } = look[tone];
  const large = theme.large ? { backgroundColor: color.white, borderColor: tone === 'red' || tone === 'redOutline' ? color.red : color.gold } : null;
  return (
    <View style={[styles.pill, large ?? { backgroundColor: bg, borderColor: border }, style]}>
      <AppText variant="label" tone={fg}>
        {label}
      </AppText>
    </View>
  );
}

/**
 * Sprint 6B Patch: '[🆕 New Member]' for a member's first 180 days on the council (isNewMember, from
 * Member.DateJoinedCouncil); it drops off on day 181. Renders nothing otherwise.
 */
export function NewMemberBadge({ member, style }: { member: Pick<Member, 'DateJoinedCouncil'> | null | undefined; style?: StyleProp<ViewStyle> }) {
  if (!isNewMember(member, new Date())) return null;
  return <Pill label={`[${NEW_MEMBER_BADGE_LABEL}]`} tone="gold" style={style} />;
}

/**
 * A white card with a coloured accent bar on the left edge (red = urgent, gold = priority, navy = normal). In the
 * large text layout the card is black inside a gold edge, and the bar stays red only for urgent cards.
 */
export function Card({
  accent,
  muted,
  children,
  style,
}: {
  accent?: string;
  muted?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color, large } = useTheme();
  const styles = useStyles();
  const bar = muted ? color.line : large ? (accent === color.red ? color.red : color.gold) : (accent ?? color.navy);
  return <View style={[styles.card, { borderLeftColor: bar, opacity: muted ? 0.75 : 1 }, style]}>{children}</View>;
}

export function Notice({ tone, message, onDismiss }: { tone: 'error' | 'info'; message: string; onDismiss?: () => void }) {
  const { color, large, touchTarget } = useTheme();
  const styles = useStyles();
  const border = tone === 'error' ? color.red : large ? color.gold : color.navy;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: border }]}>
      <AppText variant="body" tone={tone === 'error' ? 'red' : 'navy'} style={{ flex: 1 }}>
        {message}
      </AppText>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          hitSlop={12}
          style={large ? { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' } : undefined}
        >
          <AppText variant="title" tone={tone === 'error' ? 'red' : 'navy'}>
            ×
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const { space } = useTheme();
  const styles = useStyles();
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
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <AppText tone="muted">{message}</AppText>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const { color, space } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.empty} accessibilityRole="progressbar">
      <ActivityIndicator color={color.text} />
      <AppText tone="muted" style={{ marginTop: space.sm }}>
        {label}
      </AppText>
    </View>
  );
}

/** Scrolling white page (pitch black in the large text layout) with pull-to-refresh. */
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
  const { color, space } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.white }}
      contentContainerStyle={[{ padding: space.lg, paddingTop: space.md, gap: space.xl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.text} colors={[color.text]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/**
 * Sprint 6B Security: a password box with a high-contrast eye button inside its right edge that switches the text
 * between masked dots and readable clear text. The button is a full touch target and says what it will do.
 */
export function PasswordInput({ style, ...rest }: Omit<TextInputProps, 'secureTextEntry'>) {
  const { color, large, radius, space, touchTarget } = useTheme();
  const [visible, setVisible] = useState(false);
  const eye = touchTarget - (large ? 16 : 8);
  return (
    <View style={{ justifyContent: 'center' }}>
      <AppInput {...rest} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} style={[{ paddingRight: touchTarget + space.xs }, style]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        accessibilityState={{ checked: visible }}
        onPress={() => setVisible((v) => !v)}
        hitSlop={4}
        style={({ pressed }) => ({
          position: 'absolute',
          right: large ? 8 : 4,
          width: eye,
          height: eye,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: visible ? color.navy : color.white,
          borderWidth: large ? 4 : 2,
          borderColor: large ? color.gold : color.navy,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <EyeGlyph open={!visible} tint={large ? color.text : visible ? color.white : color.navy} scale={large ? 2 : 1} />
      </Pressable>
    </View>
  );
}

/** An eye drawn from plain Views (no icon font is bundled): open, or struck through once the text is showing. */
function EyeGlyph({ open, tint, scale = 1 }: { open: boolean; tint: string; scale?: number }) {
  const k = (n: number) => n * scale;
  return (
    <View style={{ width: k(24), height: k(16), alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: k(24), height: k(14), borderRadius: k(12), borderWidth: k(2.5), borderColor: tint }} />
      <View style={{ width: k(8), height: k(8), borderRadius: k(4), backgroundColor: tint }} />
      {open ? null : (
        <View style={{ position: 'absolute', width: k(28), height: k(2.5), backgroundColor: tint, transform: [{ rotate: '-35deg' }] }} />
      )}
    </View>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="label">{label}</AppText>
      {children}
    </View>
  );
}

/**
 * Sprint 6C: a labelled on/off switch drawn as one full-width tap area (the label and a track with a sliding knob),
 * high contrast in either layout. The whole row toggles; screen readers hear a switch with its state.
 */
export function ToggleSwitch({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { color, large, radius, space, touchTarget } = useTheme();
  const trackWidth = large ? 112 : 56;
  const trackHeight = large ? 60 : 32;
  const knob = trackHeight - (large ? 16 : 8);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: touchTarget,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: large ? 4 : 2,
        borderColor: large ? color.gold : color.navy,
        backgroundColor: color.white,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <AppText variant="title" style={{ flex: 1 }}>
        {label}
      </AppText>
      <View
        style={{
          width: trackWidth,
          height: trackHeight,
          borderRadius: trackHeight / 2,
          borderWidth: large ? 4 : 2,
          borderColor: large ? color.gold : color.navy,
          backgroundColor: value ? (large ? color.gold : color.navy) : color.white,
          justifyContent: 'center',
          paddingHorizontal: (trackHeight - knob) / 2 - (large ? 4 : 2),
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            backgroundColor: value ? (large ? color.navy : color.white) : large ? color.text : color.navy,
          }}
        />
      </View>
    </Pressable>
  );
}

function makeStyles({ color, space, radius, touchTarget, border, large }: LayoutTokens) {
  return StyleSheet.create({
    button: {
      minHeight: touchTarget,
      paddingHorizontal: space.lg,
      paddingVertical: large ? space.md : 0,
      borderRadius: radius.md,
      borderWidth: border(2),
      alignItems: 'center',
      justifyContent: 'center',
    },
    pill: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: border(1),
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
    },
    card: {
      backgroundColor: color.white,
      borderWidth: border(1),
      borderColor: color.line,
      borderLeftWidth: large ? 12 : 6,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.sm,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      borderWidth: border(2),
      borderRadius: radius.md,
      padding: space.md,
      backgroundColor: color.white,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: large ? 'wrap' : 'nowrap' },
    empty: { alignItems: 'center', padding: space.xl, borderWidth: border(1), borderColor: color.line, borderRadius: radius.md },
  });
}

/** The primitives' StyleSheet in the current layout (built once per layout). */
function useStyles() {
  const theme = useTheme();
  return useMemo(() => makeStyles(theme), [theme]);
}
