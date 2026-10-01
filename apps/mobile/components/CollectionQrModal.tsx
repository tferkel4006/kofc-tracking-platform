// The four electronic collection channels' QR codes (Sprint 5Z-Mobile-Intake). Tapping Venmo, ParishSoft, Zeffy or Zelle
// on the Donate screen opens a full-screen pop-up showing only that channel's code, so the donor scans exactly one.
// Sprint 5Z-WhiteLabel: the council's own uploaded code (CouncilDonationOption.qrCodeUrl) comes first; when it is
// missing, blank, a placeholder:// link, or fails to load, the code bundled with the app from
// apps/mobile/assets/images/qr/ is shown instead.
import { useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLoadableQrUrl } from '@/components/DonationQr';
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
  uploadedUrl,
  fallback,
  visible,
  onClose,
}: {
  methodName: string;
  /** The council's uploaded code for this channel, shown first when the phone can load it. */
  uploadedUrl: string | null;
  /** The code bundled with the app, shown when the council has none or it fails to load. */
  fallback: ImageSourcePropType;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [uploadFailed, setUploadFailed] = useState(false);
  const useUpload = isLoadableQrUrl(uploadedUrl) && !uploadFailed;
  const source: ImageSourcePropType = useUpload ? { uri: uploadedUrl.trim() } : fallback;
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
          <Image
            key={useUpload ? 'uploaded' : 'bundled'}
            source={source}
            onError={useUpload ? () => setUploadFailed(true) : undefined}
            accessibilityLabel={`${methodName} QR code for the donor to scan`} resizeMode="contain" style={{ width: '100%', aspectRatio: 1 }} />
        </View>
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          Turn the phone toward the donor. When they show you the payment confirmation, close this and record the amount.
        </AppText>
        <Button title="Done – record the payment" style={{ alignSelf: 'stretch' }} onPress={onClose} />
      </View>
    </Modal>
  );
}
