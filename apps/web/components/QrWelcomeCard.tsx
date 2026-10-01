// The welcome card's parish QR codes (Sprint 5Z-Demo-Assets). The images live in apps/web/public/assets/images/qr/;
// each file there is a placeholder until the council's real code replaces it under the same name.
import { Panel } from '@/components/ui';

export interface ParishQr {
  file: string;
  title: string;
  caption: string;
}

export const QR_ASSET_DIR = '/assets/images/qr';

export const PARISH_QR_CODES: readonly ParishQr[] = [
  { file: 'parishsoft-collection.png', title: 'ParishSoft', caption: 'Give through ParishSoft.' },
  { file: 'venmo-collection.png', title: 'Venmo', caption: 'Give through Venmo.' },
  { file: 'zeffy-collection.png', title: 'Zeffy', caption: 'Give through Zeffy.' },
  { file: 'zelle-collection.png', title: 'Zelle', caption: 'Give through Zelle.' },
];

export function QrWelcomeCard() {
  return (
    <Panel title="Welcome, Brother Knight: scan to give" className="mb-4">
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {PARISH_QR_CODES.map(({ file, title, caption }) => (
          <li key={file} className="flex flex-col items-center text-center">
            <img src={`${QR_ASSET_DIR}/${file}`} alt={`${title} QR code`} width={128} height={128} loading="lazy" className="h-32 w-32" />
            <span className="mt-2 text-sm font-bold">{title}</span>
            <span className="text-xs">{caption}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
