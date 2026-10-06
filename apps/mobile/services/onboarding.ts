// First-launch onboarding as a framework-neutral state machine
// (Specifications: "Security"; Blueprint: "First-Time Provisioning Pipeline").
//
//   enterEmail ──email matches a preloaded Member──▶ createPassword ──▶ signedIn
//       │                                                  │ (already registered)
//       │                                                  ▼
//       │                                               signIn ──▶ signedIn
//       └──no Member with that email──▶ contactAdmin   (halted: shows the admin's details)
//
// Sprint 6B Security: createPassword needs the setup code from the welcome email (auth.signUp refuses without it), and
// "Forgot password?" (from enterEmail or signIn) runs the self-service reset:
//   forgotPassword ──email──▶ resetCode ──6-digit code──▶ newPassword ──▶ signedIn
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
  | { screen: 'forgotPassword'; email: string; error?: string }
  | { screen: 'resetCode'; email: string; error?: string }
  | { screen: 'newPassword'; email: string; code: string; error?: string }
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
   * On `createPassword`: registers the password (hashed by auth.signUp) and remembers the session. Sprint 6B Security:
   * `setupCode`, the one-time code from the welcome email, is required; auth.signUp spends it (a missing, wrong, used or
   * expired code is shown on the screen and nothing is registered).
   * On `signIn`: checks the password against the stored hash.
   */
  async submitPassword(password: string, confirmation?: string, setupCode?: string): Promise<OnboardingState> {
    const current = this.state;
    if (current.screen === 'createPassword') {
      if (password !== confirmation) return this.set({ ...current, error: 'The two passwords do not match.' });
      try {
        // The driver decides about the code: a member who already registered goes to sign-in (ALREADY_REGISTERED) whatever
        // was typed; anyone else is refused without a valid code.
        return await this.finish(await this.deps.db.auth.signUp(current.email, password, setupCode?.trim() ?? ''));
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

  /** "Forgot password?" from the email or password prompt: asks for the email, filled in when it is known. */
  startPasswordReset(): OnboardingState {
    const current = this.state;
    if (current.screen !== 'enterEmail' && current.screen !== 'signIn') return current;
    return this.set({ screen: 'forgotPassword', email: current.screen === 'signIn' ? current.email : '' });
  }

  /**
   * Asks for a reset code by email (auth.requestPasswordReset) and moves on to the code prompt whatever the answer, so
   * the screen never reveals whether the email belongs to a member.
   */
  async submitResetEmail(rawEmail: string): Promise<OnboardingState> {
    if (this.state.screen !== 'forgotPassword') return this.state;
    const email = rawEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return this.set({ screen: 'forgotPassword', email, error: 'Enter the email address you sign in with.' });
    await this.deps.db.auth.requestPasswordReset(email);
    return this.set({ screen: 'resetCode', email });
  }

  /** Checks the 6-digit code (auth.verifyPasswordResetCode) before the new-password form opens. */
  async submitResetCode(code: string): Promise<OnboardingState> {
    const current = this.state;
    if (current.screen !== 'resetCode') return current;
    try {
      await this.deps.db.auth.verifyPasswordResetCode(current.email, code);
      return this.set({ screen: 'newPassword', email: current.email, code: code.trim() });
    } catch (err) {
      if (err instanceof BusinessRuleError) return this.set({ ...current, error: err.message });
      throw err;
    }
  }

  /** Sets the new password (auth.resetPassword), which spends the code, and signs the member in. */
  async submitNewPassword(password: string, confirmation: string): Promise<OnboardingState> {
    const current = this.state;
    if (current.screen !== 'newPassword') return current;
    if (password !== confirmation) return this.set({ ...current, error: 'The two passwords do not match.' });
    try {
      return await this.finish(await this.deps.db.auth.resetPassword(current.email, current.code, password));
    } catch (err) {
      if (err instanceof BusinessRuleError && err.code === 'RESET_CODE_INVALID') return this.set({ screen: 'resetCode', email: current.email, error: err.message });
      if (err instanceof BusinessRuleError) return this.set({ ...current, error: err.message });
      throw err;
    }
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
