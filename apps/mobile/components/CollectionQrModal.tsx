// The four electronic collection channels' QR codes, bundled with the app (Sprint 5Z-Mobile-Intake). Tapping Venmo,
// ParishSoft, Zeffy or Zelle on the Donate screen opens a full-screen pop-up showing only that channel's code, so the
// donor scans exactly one. The images live in apps/mobile/assets/images/qr/; replace a file under the same name to
// change a code.
import type { ImageSourcePropType } from 'react-native';
import { Image, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { color, radius, space } from '@/lib/theme';
import parishsoftQr from '../assets/images/qr/parishsoft-collection.png';
import venmoQr from '../assets/images/qr/venmo-collection.png';
import zeffyQr from '../assets/images/qr/zeffy-collection.png';
import zelleQr from '../assets/images/qr/zelle-collection.png';

/** Each channel's bundled code, keyed by the DonationMethod name in lower case. */
const COLLECTION_QR: Record<string, ImageSourcePropType> = {
  venmo: venmoQr,
  parishsoft: parishsoftQr,
  zeffy: zeffyQr,
  zelle: zelleQr,
};

/** The bundled code for a DonationMethod name, or null when the app carries none for it. */
export const collectionQrFor = (methodName: string): ImageSourcePropType | null => COLLECTION_QR[methodName.trim().toLowerCase()] ?? null;

export function CollectionQrModal({
  methodName,
  source,
  visible,
  onClose,
}: {
  methodName: string;
  source: ImageSourcePropType;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.lg,
          backgroundColor: color.white,
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.lg,
          paddingHorizontal: space.lg,
        }}
      >
        <AppText variant="heading" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Scan to pay with {methodName}
        </AppText>
        <View style={{ width: '100%', maxWidth: 420, padding: space.md, borderWidth: 6, borderColor: color.gold, borderRadius: radius.md }}>
          <Image source={source} accessibilityLabel={`${methodName} QR code for the donor to scan`} resizeMode="contain" style={{ width: '100%', aspectRatio: 1 }} />
        </View>
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          Turn the phone toward the donor. When they show you the payment confirmation, close this and record the amount.
        </AppText>
        <Button title="Done – record the payment" style={{ alignSelf: 'stretch' }} onPress={onClose} />
      </View>
    </Modal>
  );
}
