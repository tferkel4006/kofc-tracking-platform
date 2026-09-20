// Placeholder for the production driver.
//
// In the web app the real driver is a server-side implementation (Next.js route
// handlers using an mssql/tedious connection to Azure SQL) that this client-side
// module calls over HTTPS. Implement each method below, then set
// NEXT_PUBLIC_DATA_DRIVER=remote. No UI code changes: views only ever see the
// DataService contract.
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
    lookups: {
      list: notImplemented('lookups.list'),
      create: notImplemented('lookups.create'),
      update: notImplemented('lookups.update'),
      remove: notImplemented('lookups.remove'),
    },
    councils: {
      list: notImplemented('councils.list'),
      get: notImplemented('councils.get'),
      listAffiliated: notImplemented('councils.listAffiliated'),
    },
    activities: { listByCouncil: notImplemented('activities.listByCouncil') },
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
      listMemberShifts: notImplemented('events.listMemberShifts'),
      listShiftFeed: notImplemented('events.listShiftFeed'),
      countNoShows: notImplemented('events.countNoShows'),
      listByCouncil: notImplemented('events.listByCouncil'),
      listShifts: notImplemented('events.listShifts'),
      listCouncilIds: notImplemented('events.listCouncilIds'),
      create: notImplemented('events.create'),
      update: notImplemented('events.update'),
      setCouncils: notImplemented('events.setCouncils'),
      copy: notImplemented('events.copy'),
      createShift: notImplemented('events.createShift'),
      updateShift: notImplemented('events.updateShift'),
      deleteShift: notImplemented('events.deleteShift'),
    },
    lessonsLearned: {
      list: notImplemented('lessonsLearned.list'),
      add: notImplemented('lessonsLearned.add'),
      remove: notImplemented('lessonsLearned.remove'),
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
      setMinutes: notImplemented('meetings.setMinutes'),
    },
    messages: {
      getPage: notImplemented('messages.getPage'),
      createReadReceiptStubs: notImplemented('messages.createReadReceiptStubs'),
      listThreads: notImplemented('messages.listThreads'),
      listThread: notImplemented('messages.listThread'),
      send: notImplemented('messages.send'),
      saveDraft: notImplemented('messages.saveDraft'),
      deleteDraft: notImplemented('messages.deleteDraft'),
      setRead: notImplemented('messages.setRead'),
    },
  };
}
