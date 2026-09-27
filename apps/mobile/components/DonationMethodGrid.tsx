// One-tap donation method picker: a two-column grid of large tiles, never a drop-down
// (Specifications: "very easy and quick to pick one, not scrolling through drop down").
import { Pressable, View } from 'react-native';
import type { CouncilDonationOption, DonationMethodKind } from '@kofc/shared';
import { AppText } from '@/components/ui';
import { color, radius, space, touchTarget } from '@/lib/theme';

const HINT: Record<DonationMethodKind, string> = {
  cash: 'Record the amount',
  card: 'Record the charge',
  qr: 'Show the QR code',
  item: 'Describe and value',
  other: 'Record the amount',
};

export function DonationMethodGrid({ options, onPick }: { options: readonly CouncilDonationOption[]; onPick: (option: CouncilDonationOption) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {options.map((option) => (
        <Pressable
          key={option.method.id}
          accessibilityRole="button"
          accessibilityLabel={`${option.method.DonationMethod}: ${HINT[option.kind]}`}
          onPress={() => onPick(option)}
          style={({ pressed }) => ({
            flexBasis: '47%',
            flexGrow: 1,
            minHeight: touchTarget * 2,
            justifyContent: 'center',
            padding: space.md,
            borderWidth: 2,
            borderColor: color.navy,
            borderLeftWidth: 8,
            borderLeftColor: option.kind === 'qr' ? color.gold : color.navy,
            borderRadius: radius.md,
            backgroundColor: color.white,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <AppText variant="title">{option.method.DonationMethod}</AppText>
          <AppText variant="small" tone="muted">
            {HINT[option.kind]}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
