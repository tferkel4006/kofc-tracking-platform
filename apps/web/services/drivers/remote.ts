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
      listForMaintenance: notImplemented('lookups.listForMaintenance'),
      listCouncilSpecific: notImplemented('lookups.listCouncilSpecific'),
      saveCouncilSpecific: notImplemented('lookups.saveCouncilSpecific'),
      removeCouncilSpecific: notImplemented('lookups.removeCouncilSpecific'),
    },
    councils: {
      list: notImplemented('councils.list'),
      get: notImplemented('councils.get'),
      listAffiliated: notImplemented('councils.listAffiliated'),
      create: notImplemented('councils.create'),
      update: notImplemented('councils.update'),
      remove: notImplemented('councils.remove'),
    },
    parishes: {
      listByCouncil: notImplemented('parishes.listByCouncil'),
      get: notImplemented('parishes.get'),
      create: notImplemented('parishes.create'),
      update: notImplemented('parishes.update'),
      remove: notImplemented('parishes.remove'),
    },
    pastors: {
      listByParish: notImplemented('pastors.listByParish'),
      listByCouncil: notImplemented('pastors.listByCouncil'),
      create: notImplemented('pastors.create'),
      update: notImplemented('pastors.update'),
      remove: notImplemented('pastors.remove'),
    },
    activities: {
      listByCouncil: notImplemented('activities.listByCouncil'),
      get: notImplemented('activities.get'),
      create: notImplemented('activities.create'),
      update: notImplemented('activities.update'),
      remove: notImplemented('activities.remove'),
      listSummaries: notImplemented('activities.listSummaries'),
    },
    distributionLists: {
      listByCouncil: notImplemented('distributionLists.listByCouncil'),
      create: notImplemented('distributionLists.create'),
      update: notImplemented('distributionLists.update'),
      remove: notImplemented('distributionLists.remove'),
    },
    members: {
      get: notImplemented('members.get'),
      getByEmail: notImplemented('members.getByEmail'),
      listByCouncil: notImplemented('members.listByCouncil'),
      listRoles: notImplemented('members.listRoles'),
      create: notImplemented('members.create'),
      update: notImplemented('members.update'),
    },
    memberProfiles: {
      listOptions: notImplemented('memberProfiles.listOptions'),
      getExtensions: notImplemented('memberProfiles.getExtensions'),
      updateExtensions: notImplemented('memberProfiles.updateExtensions'),
    },
    communication: {
      listCouncilSkills: notImplemented('communication.listCouncilSkills'),
      sendBulkToSkills: notImplemented('communication.sendBulkToSkills'),
    },
    donations: {
      listMethods: notImplemented('donations.listMethods'),
      listAllMethods: notImplemented('donations.listAllMethods'),
      listTypes: notImplemented('donations.listTypes'),
      list: notImplemented('donations.list'),
      listHistory: notImplemented('donations.listHistory'),
      record: notImplemented('donations.record'),
      update: notImplemented('donations.update'),
      remove: notImplemented('donations.remove'),
    },
    expenses: {
      listUserReports: notImplemented('expenses.listUserReports'),
      listCouncilQueue: notImplemented('expenses.listCouncilQueue'),
      submitReport: notImplemented('expenses.submitReport'),
      approveReport: notImplemented('expenses.approveReport'),
      rejectReport: notImplemented('expenses.rejectReport'),
      recordDisbursement: notImplemented('expenses.recordDisbursement'),
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
      setNoShow: notImplemented('events.setNoShow'),
      listCalendarRange: notImplemented('events.listCalendarRange'),
      uploadPhotos: notImplemented('events.uploadPhotos'),
      listByCouncil: notImplemented('events.listByCouncil'),
      listShifts: notImplemented('events.listShifts'),
      listTurnout: notImplemented('events.listTurnout'),
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
      listGlobalRegistry: notImplemented('lessonsLearned.listGlobalRegistry'),
    },
    eventTime: { logHours: notImplemented('eventTime.logHours') },
    activityTime: { logHours: notImplemented('activityTime.logHours'), listByActivity: notImplemented('activityTime.listByActivity') },
    reports: {
      monthlySummary: notImplemented('reports.monthlySummary'),
      listNoShowsAudit: notImplemented('reports.listNoShowsAudit'),
      listShiftsAwaitingHours: notImplemented('reports.listShiftsAwaitingHours'),
    },
    meetings: {
      get: notImplemented('meetings.get'),
      listUpcoming: notImplemented('meetings.listUpcoming'),
      create: notImplemented('meetings.create'),
      listInvites: notImplemented('meetings.listInvites'),
      invite: notImplemented('meetings.invite'),
      setAttended: notImplemented('meetings.setAttended'),
      setMinutes: notImplemented('meetings.setMinutes'),
      linkGoogleDrive: notImplemented('meetings.linkGoogleDrive'),
      memberHours: notImplemented('meetings.memberHours'),
    },
    notifications: {
      registerDeviceToken: notImplemented('notifications.registerDeviceToken'),
      listMemberAlerts: notImplemented('notifications.listMemberAlerts'),
      markAsRead: notImplemented('notifications.markAsRead'),
      dispatchHighPriorityAlert: notImplemented('notifications.dispatchHighPriorityAlert'),
    },
    elections: {
      listOfficerSeats: notImplemented('elections.listOfficerSeats'),
      listBallotConfig: notImplemented('elections.listBallotConfig'),
      listVacancies: notImplemented('elections.listVacancies'),
      toggleRoleBallotStatus: notImplemented('elections.toggleRoleBallotStatus'),
      submitNomination: notImplemented('elections.submitNomination'),
      recordOfficerAbdication: notImplemented('elections.recordOfficerAbdication'),
      assignAppointedRole: notImplemented('elections.assignAppointedRole'),
      concludeFraternalYear: notImplemented('elections.concludeFraternalYear'),
    },
    charities: {
      searchGlobalRegistry: notImplemented('charities.searchGlobalRegistry'),
      listSuggestedLocal: notImplemented('charities.listSuggestedLocal'),
      connectCouncilToCharity: notImplemented('charities.connectCouncilToCharity'),
      proposeDonation: notImplemented('charities.proposeDonation'),
      addGlobalCharity: notImplemented('charities.addGlobalCharity'),
      hydrateAndDisburse: notImplemented('charities.hydrateAndDisburse'),
    },
    supreme: {
      previewReport: notImplemented('supreme.previewReport'),
      syncAlchemerReport: notImplemented('supreme.syncAlchemerReport'),
      listSyncHistory: notImplemented('supreme.listSyncHistory'),
    },
    feedback: {
      submit: notImplemented('feedback.submit'),
      listInbox: notImplemented('feedback.listInbox'),
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
