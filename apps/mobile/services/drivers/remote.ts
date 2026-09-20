// Placeholder for the production driver.
//
// React Native cannot open a TDS connection to Azure SQL directly, so the real
// driver will most likely be an HTTPS client for an API (Azure Functions, or the
// Next.js route handlers in apps/web) that owns the Azure SQL connection.
// Implement each method below, then set EXPO_PUBLIC_DATA_DRIVER=remote.
// No UI code changes: views only ever see the DataService contract.
import type { DataService } from '@kofc/shared';

const notImplemented = (method: string) => async (): Promise<never> => {
  throw new Error(`RemoteDataService.${method} is not implemented yet (production Azure SQL driver).`);
};

/** Written out explicitly so the compiler flags this file whenever the contract gains a method. */
export function createRemoteDataService(): DataService {
  return {
    init: notImplemented('init'),
    reset: notImplemented('reset'),
    auth: { signIn: notImplemented('auth.signIn'), signUp: notImplemented('auth.signUp') },
    lookups: { list: notImplemented('lookups.list') },
    councils: { list: notImplemented('councils.list'), get: notImplemented('councils.get') },
    members: {
      get: notImplemented('members.get'),
      getByEmail: notImplemented('members.getByEmail'),
      listByCouncil: notImplemented('members.listByCouncil'),
      listRoles: notImplemented('members.listRoles'),
    },
    events: {
      get: notImplemented('events.get'),
      getShift: notImplemented('events.getShift'),
      listShiftsBetween: notImplemented('events.listShiftsBetween'),
      listSignups: notImplemented('events.listSignups'),
      signupForShift: notImplemented('events.signupForShift'),
    },
    eventTime: { logHours: notImplemented('eventTime.logHours') },
    activityTime: { logHours: notImplemented('activityTime.logHours') },
    meetings: {
      get: notImplemented('meetings.get'),
      listUpcoming: notImplemented('meetings.listUpcoming'),
      create: notImplemented('meetings.create'),
      listInvites: notImplemented('meetings.listInvites'),
      invite: notImplemented('meetings.invite'),
      setAttended: notImplemented('meetings.setAttended'),
    },
    messages: {
      getPage: notImplemented('messages.getPage'),
      createReadReceiptStubs: notImplemented('messages.createReadReceiptStubs'),
    },
  };
}
