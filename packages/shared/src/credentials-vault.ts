// Sprint 6Y (Schema 40): the Centralized Encrypted Credentials Vault.
//
// Every secret a council's portal holds - its SMTP password, its Google Drive service-account key and (Sprint 6L
// Extension 2) its Microsoft Copilot Studio Direct Line secret - is one row
// of CouncilCredentialsVault: council_id, credential_key (CREDENTIAL_KEYS), credential_value_encrypted and updated_at.
// No other table holds a credential (the Council row's EmailPasswordEncrypted column is gone).
//
// THE TABLE BELONGS TO THE WEB SERVER ALONE. The only writer is apps/web/services/server/credentials-vault.ts, which
// takes the plain value, seals it with AES-256-GCM under a key that exists only on the server (CREDENTIALS_VAULT_SECRET)
// and stores the sealed text; it unseals a value only inside a server route, at the moment of use. No data driver reads
// or writes the table, no route answers with a value, and the browser only ever sees CredentialStatus: the key, when it
// was saved and REDACTED_SECRET. This file holds the browser-safe half: the key names, the masked view and the checks.
import { BusinessRuleError } from './rules';

/** The credentials a council may keep in the vault. */
export const CREDENTIAL_KEYS = ['SMTP_OUTBOUND_PASSWORD', 'GOOGLE_DRIVE_PRIVATE_KEY', 'COPILOT_STUDIO_DIRECT_LINE_SECRET'] as const;
export type CredentialKey = (typeof CREDENTIAL_KEYS)[number];

export const isCredentialKey = (value: unknown): value is CredentialKey => typeof value === 'string' && (CREDENTIAL_KEYS as readonly string[]).includes(value);

/** What each credential is, for messages and the masked listing. */
export const CREDENTIAL_LABELS: Record<CredentialKey, string> = {
  SMTP_OUTBOUND_PASSWORD: 'SMTP password',
  GOOGLE_DRIVE_PRIVATE_KEY: 'Google Drive service-account private key',
  COPILOT_STUDIO_DIRECT_LINE_SECRET: 'Microsoft Copilot Studio Direct Line secret',
};

/**
 * The longest plain value each key accepts, and whether it may span lines. A PEM private key is multi-line (a literal
 * `\n` is also accepted and turned into a line break); an SMTP password is one line, since it goes into an AUTH command.
 */
export const CREDENTIAL_RULES: Record<CredentialKey, { maxLength: number; multiLine: boolean }> = {
  SMTP_OUTBOUND_PASSWORD: { maxLength: 1000, multiLine: false },
  GOOGLE_DRIVE_PRIVATE_KEY: { maxLength: 8000, multiLine: true },
  COPILOT_STUDIO_DIRECT_LINE_SECRET: { maxLength: 500, multiLine: false },
};

/** Sealed values look like `v1.<iv>.<tag>.<ciphertext>`, each part base64url. */
export const SEALED_SECRET_PATTERN = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,11000}$/;

/** What shows in place of a saved credential. It is fixed, so it gives away nothing, not even the length. */
export const REDACTED_SECRET = '••••••••••••';

/** One CouncilCredentialsVault row, as the server stores it. Never sent to a browser. */
export interface CouncilCredentialsVaultRow {
  id: number;
  council_id: number;
  credential_key: CredentialKey;
  credential_value_encrypted: string;
  updated_at: string;
}

/** The only view of a vault row that leaves the server: the key, when it was saved, and the mask. */
export interface CredentialStatus {
  credential_key: CredentialKey;
  label: string;
  saved: true;
  masked: typeof REDACTED_SECRET;
  updated_at: string;
}

/** The masked view of a row; the sealed value is dropped, not masked. */
export const credentialStatus = (row: Pick<CouncilCredentialsVaultRow, 'credential_key' | 'updated_at'>): CredentialStatus => ({
  credential_key: row.credential_key,
  label: CREDENTIAL_LABELS[row.credential_key],
  saved: true,
  masked: REDACTED_SECRET,
  updated_at: row.updated_at,
});

/** A plain credential value checked against its key's rules. Rejects INVALID_INPUT for an empty, oversized or (for a one-line key) multi-line value. */
export function cleanCredentialValue(key: CredentialKey, value: unknown): string {
  const rule = CREDENTIAL_RULES[key];
  const text = typeof value === 'string' ? (rule.multiLine ? value.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim() : value) : '';
  const lines = rule.multiLine ? '' : ' on one line';
  if (!text || text.length > rule.maxLength || (!rule.multiLine && /[\r\n]/.test(text))) {
    throw new BusinessRuleError('INVALID_INPUT', `The ${CREDENTIAL_LABELS[key]} must be 1-${rule.maxLength} characters${lines}.`, { field: key });
  }
  return text;
}
