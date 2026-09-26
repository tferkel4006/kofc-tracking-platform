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
      create: notImplemented('members.create'),
    },
    memberProfiles: {
      getExtensions: notImplemented('memberProfiles.getExtensions'),
      updateExtensions: notImplemented('memberProfiles.updateExtensions'),
    },
    communication: {
      listCouncilSkills: notImplemented('communication.listCouncilSkills'),
      sendBulkToSkills: notImplemented('communication.sendBulkToSkills'),
    },
    donations: {
      listMethods: notImplemented('donations.listMethods'),
      listTypes: notImplemented('donations.listTypes'),
      list: notImplemented('donations.list'),
      record: notImplemented('donations.record'),
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
      memberHours: notImplemented('meetings.memberHours'),
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
