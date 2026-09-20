// First-launch onboarding as a framework-neutral state machine
// (Specifications: "Security"; Blueprint: "First-Time Provisioning Pipeline").
//
//   enterEmail ──email matches a preloaded Member──▶ createPassword ──▶ signedIn
//       │                                                  │ (already registered)
//       │                                                  ▼
//       │                                               signIn ──▶ signedIn
//       └──no Member with that email──▶ contactAdmin   (halted: shows the admin's details)
//
// Screens render `controller.state` and call submitEmail / submitPassword; they
// hold no rules of their own. `contactAdmin` is terminal: submitEmail and
// submitPassword do nothing until the screen offers restart().
import type { DataService, SessionUser } from '@kofc/shared';
import { BusinessRuleError } from '@kofc/shared';
import type { SessionStore } from './session';

/** The council whose admin is shown when an email is not recognised. */
export const DEFAULT_COUNCIL_NUMBER = 15295;

export function getConfiguredCouncilNumber(): number {
  const configured = Number(process.env.EXPO_PUBLIC_COUNCIL_NUMBER);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_COUNCIL_NUMBER;
}

export interface CouncilAdminContact {
  councilNumber: number;
  councilName: string;
  councilPhone?: string;
  /** null when the council has no active Admin member on file. */
  admin: { name: string; email: string; phone: string } | null;
}

export type OnboardingState =
  | { screen: 'loading' }
  | { screen: 'enterEmail'; error?: string }
  | { screen: 'createPassword'; email: string; firstName: string; error?: string }
  | { screen: 'signIn'; email: string; error?: string }
  | { screen: 'contactAdmin'; email: string; message: string; contact: CouncilAdminContact | null }
  | { screen: 'signedIn'; user: SessionUser };

/** The council admin's name and phone/email, from existing DataService methods. */
export async function findCouncilAdminContact(db: DataService, councilNumber: number): Promise<CouncilAdminContact | null> {
  const council = (await db.councils.list()).find((c) => c.CouncilNumber === councilNumber);
  if (!council) return null;
  const adminType = (await db.lookups.list('MemberType')).find((t) => t.Type === 'Admin');
  const members = await db.members.listByCouncil(council.id, { activeOnly: true });
  const admin = adminType ? members.find((m) => m.MemberTypeID === adminType.id) : undefined;
  return {
    councilNumber: council.CouncilNumber,
    councilName: council.CouncilName,
    councilPhone: council.Phone,
    admin: admin
      ? { name: `${admin.MemberFirstName} ${admin.MemberLastName}`, email: admin.Email, phone: admin.Phone }
      : null,
  };
}

export interface OnboardingDeps {
  db: DataService;
  sessions: SessionStore;
  councilNumber: number;
  /** Optional Face ID / fingerprint gate applied when restoring a remembered session. */
  authenticate?: () => Promise<boolean>;
}

export class OnboardingController {
  state: OnboardingState = { screen: 'loading' };

  constructor(private readonly deps: OnboardingDeps) {}

  /** Call once at launch: resumes a remembered session, otherwise asks for an email. */
  async start(): Promise<OnboardingState> {
    const user = await this.deps.sessions.restore(this.deps.db, { authenticate: this.deps.authenticate });
    return this.set(user ? { screen: 'signedIn', user } : { screen: 'enterEmail' });
  }

  async submitEmail(rawEmail: string): Promise<OnboardingState> {
    if (this.state.screen !== 'enterEmail') return this.state;
    const email = rawEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return this.set({ screen: 'enterEmail', error: 'Enter the email address your council has on file.' });
    }

    const member = await this.deps.db.members.getByEmail(email);
    if (!member) {
      return this.set({
        screen: 'contactAdmin',
        email,
        message: `We could not find ${email} in the member roster. Please contact your council admin to be added.`,
        contact: await findCouncilAdminContact(this.deps.db, this.deps.councilNumber),
      });
    }
    return this.set({ screen: 'createPassword', email: member.Email, firstName: member.MemberFirstName });
  }

  /**
   * On `createPassword`: registers the password (hashed by auth.signUp) and remembers the session.
   * On `signIn`: checks the password against the stored hash.
   */
  async submitPassword(password: string, confirmation?: string): Promise<OnboardingState> {
    const current = this.state;
    if (current.screen === 'createPassword') {
      if (password !== confirmation) return this.set({ ...current, error: 'The two passwords do not match.' });
      try {
        return await this.finish(await this.deps.db.auth.signUp(current.email, password));
      } catch (err) {
        if (err instanceof BusinessRuleError && err.code === 'ALREADY_REGISTERED') {
          return this.set({ screen: 'signIn', email: current.email });
        }
        if (err instanceof BusinessRuleError) return this.set({ ...current, error: err.message });
        throw err;
      }
    }
    if (current.screen === 'signIn') {
      const user = await this.deps.db.auth.signIn(current.email, password);
      return user ? this.finish(user) : this.set({ ...current, error: 'Incorrect password. Please try again.' });
    }
    return current;
  }

  /** Back to the email prompt (e.g. after a typo froze the screen on contactAdmin). */
  restart(): OnboardingState {
    return this.set({ screen: 'enterEmail' });
  }

  /** Sign out and forget the remembered session. */
  async signOut(): Promise<OnboardingState> {
    await this.deps.sessions.clear();
    return this.set({ screen: 'enterEmail' });
  }

  private async finish(user: SessionUser): Promise<OnboardingState> {
    await this.deps.sessions.save(user);
    return this.set({ screen: 'signedIn', user });
  }

  private set(state: OnboardingState): OnboardingState {
    this.state = state;
    return state;
  }
}
