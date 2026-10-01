// The welcome card's app download keys (Sprint 5Z-Demo-Assets; onboarding keys since Sprint 5Z-Mobile-Intake), sized for
// the hall projector. The images live in apps/web/public/assets/images/qr/; each file there is a placeholder until the
// council's real code replaces it under the same name. The collection channels' codes are on the phone's Donate screen.
import { Panel } from '@/components/ui';

export interface ParishQr {
  file: string;
  title: string;
  caption: string;
}

export const QR_ASSET_DIR = '/assets/images/qr';

export const PARISH_QR_CODES: readonly ParishQr[] = [
  { file: 'expo-go-sync.png', title: 'Mobile App (Expo Go)', caption: 'Open the KofC Tracker phone app in Expo Go.' },
  { file: 'member-sign-up.png', title: 'Member Sign-Up', caption: 'Ask to join the council.' },
];

export function QrWelcomeCard() {
  return (
    <Panel title="Welcome, Brother Knight: get the app" className="mb-4">
      <ul className="grid grid-cols-2 gap-4">
        {PARISH_QR_CODES.map(({ file, title, caption }) => (
          <li key={file} className="flex flex-col items-center text-center">
            <img src={`${QR_ASSET_DIR}/${file}`} alt={`${title} QR code`} width={160} height={160} loading="lazy" className="h-40 w-40" />
            <span className="mt-2 text-sm font-bold">{title}</span>
            <span className="text-xs">{caption}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
