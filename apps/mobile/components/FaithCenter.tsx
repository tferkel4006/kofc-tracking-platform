// Phase 4.5 Catholic Faith Center for the phone app:
//   - FaithCenterProvider (mounted round the tabs) owns the Daily Bible Quote modal and opens it by itself on the first
//     launch of each calendar day (isFirstOpenOfDay, remembered per device in services/daily-flags.ts);
//   - PrayingHandsButton in the header opens it again at any time;
//   - LiturgicalBanner, under the header on Home, names today's feast or saint (liturgicalBanner) and can be closed
//     until tomorrow;
//   - HolyDayBadge is the crimson '[ 🟥 HOLY DAY OF OBLIGATION ]' sub-badge line.
// Verses are only from the New American Bible, Revised Edition (DAILY_VERSES), shown with the NABRE notice.
// Sprint 6Z-Dual-Gate-Model: the Faith Center is a Knights of Columbus extension. For a white-label tenant the provider
// gives no context (so the praying hands draw nothing) and no modal, and the banner draws nothing.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addDays,
  dailyVerse,
  HOLY_DAY_BADGE,
  isFirstOpenOfDay,
  isFraternalTenant,
  liturgicalBanner,
  LITURGICAL_COLORS,
  NABRE_NOTICE,
  observancesBetween,
  toIsoDate,
} from '@kofc/shared';
import { AppText, Button } from '@/components/ui';
import { useFeatureFlags, useTenantType } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { readDailyFlag, writeDailyFlag } from '@/services/daily-flags';

/** How far ahead the modal lists coming feasts, holy days and holidays. */
const UPCOMING_DAYS = 14;

const FaithCenterContext = createContext<{ open(): void } | null>(null);

const shortDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/** The crimson Holy Day of Obligation sub-badge line: white bold text on LITURGICAL_COLORS.crimson. */
export function HolyDayBadge() {
  const { space, radius, border } = useTheme();
  return (
    <View
      accessibilityLabel="Holy Day of Obligation"
      style={{
        alignSelf: 'flex-start',
        backgroundColor: LITURGICAL_COLORS.crimson,
        borderColor: LITURGICAL_COLORS.crimson,
        borderWidth: border(1),
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      <AppText variant="label" tone="white">
        {HOLY_DAY_BADGE}
      </AppText>
    </View>
  );
}

function DailyQuoteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { color, space, radius, border } = useTheme();
  const today = toIsoDate(new Date());
  const verse = dailyVerse(today);
  const banner = liturgicalBanner(today);
  const upcoming = observancesBetween(addDays(today, 1), addDays(today, UPCOMING_DAYS));
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.lg }}>
        <View style={{ maxHeight: '100%', backgroundColor: color.white, borderRadius: radius.md, borderTopWidth: border(6), borderColor: color.gold, overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
            <AppText variant="label" tone="muted">
              🙏 DAILY BIBLE QUOTE
            </AppText>
            <View style={{ borderLeftWidth: border(4), borderLeftColor: color.gold, paddingLeft: space.md, gap: space.sm }}>
              <AppText variant="title" accessibilityRole="header">
                “{verse.text}”
              </AppText>
              <AppText variant="label">
                {verse.reference} (NABRE)
              </AppText>
            </View>

            <View style={{ gap: space.xs }}>
              <AppText variant="body">{banner.text}</AppText>
              {banner.holyDayOfObligation ? <HolyDayBadge /> : null}
              {banner.note ? (
                <AppText variant="small" tone="muted">
                  {banner.note}
                </AppText>
              ) : null}
            </View>

            {upcoming.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <AppText variant="label">COMING {UPCOMING_DAYS} DAYS</AppText>
                {upcoming.map((o) => (
                  <View key={`${o.date}-${o.title}`} style={{ gap: 2 }}>
                    <AppText variant="small">
                      {shortDay(o.date)} · {o.title}
                      {o.kind === 'holiday' ? ' (national holiday)' : ''}
                    </AppText>
                    {o.holyDayOfObligation ? <HolyDayBadge /> : null}
                  </View>
                ))}
              </View>
            ) : null}

            <Button title="Amen" onPress={onClose} />
            <AppText variant="small" tone="muted">
              {NABRE_NOTICE}
            </AppText>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Mount once round the signed-in tabs. Opens the Daily Bible Quote on the first launch of each calendar day. */
export function FaithCenterProvider({ children }: { children: ReactNode }) {
  // Sprint 6R: a council that switches feature_faith_center off loses the quote and the praying hands as well.
  const fraternal = isFraternalTenant(useTenantType()) && useFeatureFlags().feature_faith_center;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!fraternal) return;
    let live = true;
    const today = toIsoDate(new Date());
    void readDailyFlag('faith.verseShown').then((last) => {
      if (!live || !isFirstOpenOfDay(last, today)) return;
      setVisible(true);
      void writeDailyFlag('faith.verseShown', today);
    });
    return () => {
      live = false;
    };
  }, [fraternal]);
  const open = useCallback(() => setVisible(true), []);
  const value = useMemo(() => ({ open }), [open]);
  // The provider stays mounted either way, so the tabs below are not remounted when the tenant type loads.
  return (
    <FaithCenterContext.Provider value={fraternal ? value : null}>
      {children}
      {fraternal ? <DailyQuoteModal visible={visible} onClose={() => setVisible(false)} /> : null}
    </FaithCenterContext.Provider>
  );
}

/** Praying hands in the header: opens the Daily Bible Quote. Renders nothing outside FaithCenterProvider. */
export function PrayingHandsButton() {
  const faith = useContext(FaithCenterContext);
  const { touchTarget, large } = useTheme();
  if (!faith) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Daily Bible Quote and feast days"
      onPress={faith.open}
      hitSlop={10}
      style={large ? { minHeight: touchTarget, minWidth: 72, alignItems: 'center', justifyContent: 'center' } : undefined}
    >
      <AppText variant="title" tone="white" style={{ fontSize: large ? 40 : 24, lineHeight: large ? 48 : 30 }}>
        🙏
      </AppText>
    </Pressable>
  );
}

/**
 * The closable line under the header on Home with today's liturgical feast or saint (or the season on a plain
 * weekday), and the crimson Holy Day badge when it is one. Closing it hides it until tomorrow.
 */
export function LiturgicalBanner() {
  const fraternal = isFraternalTenant(useTenantType());
  const { color, space, border, touchTarget } = useTheme();
  const today = toIsoDate(new Date());
  const [closed, setClosed] = useState(true);
  useEffect(() => {
    let live = true;
    void readDailyFlag('faith.bannerClosed').then((last) => live && setClosed(last === today));
    return () => {
      live = false;
    };
  }, [today]);
  if (closed || !fraternal) return null;
  const banner = liturgicalBanner(today);
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        borderWidth: border(2),
        borderColor: banner.holyDayOfObligation ? LITURGICAL_COLORS.crimson : color.gold,
        borderRadius: 6,
        padding: space.sm,
        backgroundColor: color.white,
      }}
    >
      <View style={{ flex: 1, gap: space.xs }}>
        <AppText variant="label" tone="muted">
          LITURGICAL FEAST OR SAINT DAY
        </AppText>
        <AppText variant="body" style={{ fontWeight: '700' }}>
          {banner.text}
        </AppText>
        {banner.holyDayOfObligation ? <HolyDayBadge /> : null}
        {banner.note ? (
          <AppText variant="small" tone="muted">
            {banner.note}
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the feast day banner until tomorrow"
        hitSlop={12}
        onPress={() => {
          setClosed(true);
          void writeDailyFlag('faith.bannerClosed', today);
        }}
        style={{ minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText variant="title">✕</AppText>
      </Pressable>
    </View>
  );
}
