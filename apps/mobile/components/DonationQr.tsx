// The council's payment QR code, shown full width so a donor can scan it from the member's phone
// (Specifications: "present the QR code on the member's phone"). The image lives in blob storage; until a
// council uploads one (the dev seed stores placeholder:// links), or if it fails to load, a framed notice
// says so instead of an empty box, so the member knows to take the payment another way.
import { useState } from 'react';
import { Image, View } from 'react-native';
import { AppText } from '@/components/ui';
import { color, radius, space } from '@/lib/theme';

const LOADABLE = /^(https?:|data:image\/|file:)/i;

/** True when a council's QR link is one the phone can load: not null, blank or a dev-seed placeholder:// link. */
export const isLoadableQrUrl = (url: string | null): url is string => url !== null && LOADABLE.test(url.trim());

export function DonationQr({ url, methodName }: { url: string | null; methodName: string }) {
  const [failed, setFailed] = useState(false);
  const usable = isLoadableQrUrl(url) && !failed;

  return (
    <View
      accessible
      accessibilityLabel={usable ? `${methodName} QR code for the donor to scan` : `No ${methodName} QR code is available`}
      style={{ alignItems: 'center', gap: space.md, padding: space.lg, borderWidth: 6, borderColor: color.gold, borderRadius: radius.md, backgroundColor: color.white }}
    >
      <AppText variant="heading" style={{ fontSize: 20, lineHeight: 26 }}>
        Scan to pay with {methodName}
      </AppText>
      {usable ? (
        <Image source={{ uri: url }} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', aspectRatio: 1, maxWidth: 320 }} />
      ) : (
        <View style={{ width: '100%', aspectRatio: 1, maxWidth: 320, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: color.navy, borderRadius: radius.sm, padding: space.lg }}>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            {failed ? 'The QR code could not be loaded.' : 'Your council has not uploaded this QR code yet.'}
          </AppText>
          <AppText tone="muted" style={{ textAlign: 'center', marginTop: space.sm }}>
            Ask a council admin to upload the {methodName} code, or take the donation another way.
          </AppText>
        </View>
      )}
      <AppText tone="muted" style={{ textAlign: 'center' }}>
        Turn the phone toward the donor. When they show you the payment confirmation, check the amount and record it below.
      </AppText>
    </View>
  );
}
