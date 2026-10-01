// Sprint 5Z-5: parliamentary cadence (CouncilCadenceConfig, meetings.populateAnnualCadence), proposed motions and the
// 10-day agenda rule (ProposedMotion, charities.routeRequestToNextEligibleAgenda), and the expense submission window
// around a linked event (assertExpenseSubmissionWindow). Sprint 5Z-6: the same window for linked meetings, drip-release
// invitations (Meeting.InviteReleaseDate), cadence config maintenance and the meeting's proposed-motion list.
import { describe, expect, it } from 'vitest';
import {
  assertExpenseSubmissionWindow,
  BusinessRuleError,
  cadenceDateInMonth,
  cadenceInviteReleaseDate,
  cleanCadenceConfigInput,
  eventExpenseSpan,
  expenseWindowLockMessage,
  expenseWindowState,
  isInvitationReleased,
  meetingExpenseSpan,
  cadenceDatesForYear,
  cadenceMeetingTimes,
  charitableMotionText,
  earliestAgendaDate,
  nextEligibleAgendaMeeting,
  parseCadencePattern,
  type DataService,
  type ExpenseLineItemInput,
  type NewCharitableRequest,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

// Dev seed: council 1 is 15295 (Super Admin 1 who is Grand Knight, Admin 2 who is Financial Secretary, Member 3).
// Its CouncilMeetingType 1 is 'Monthly', with the baseline cadence config 1: First Tuesday, 19:30, Parish Hall.
const OWN = 1;
const MONTHLY_TYPE = 1;
const CADENCE = 1;
const TODAY = '2026-09-20'; // NOW

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as BusinessRuleError).code;
  }
  return undefined;
};

describe('cadence rules (pure)', () => {
  it('reads an ordinal and a weekday, ignoring case and spacing, and refuses anything else', () => {
    expect(parseCadencePattern('First Tuesday')).toEqual({ ordinal: 'First', weekday: 'Tuesday' });
    expect(parseCadencePattern('  last   thursday ')).toEqual({ ordinal: 'Last', weekday: 'Thursday' });
    for (const bad of ['Fifth Monday', 'Tuesday', 'First Tuesday Evening', 'Every Tuesday', '', null, 3]) {
      expect(code(() => parseCadencePattern(bad))).toBe('INVALID_INPUT');
    }
  });

  it('finds the named day in a month', () => {
    expect(cadenceDateInMonth({ ordinal: 'First', weekday: 'Tuesday' }, 2026, 9)).toBe('2026-09-01');
    expect(cadenceDateInMonth({ ordinal: 'Fourth', weekday: 'Wednesday' }, 2026, 9)).toBe('2026-09-23');
    expect(cadenceDateInMonth({ ordinal: 'Last', weekday: 'Thursday' }, 2026, 11)).toBe('2026-11-26');
    expect(cadenceDateInMonth({ ordinal: 'Last', weekday: 'Monday' }, 2026, 8)).toBe('2026-08-31');
  });

  it('lays out twelve dates from July through June of the fraternal year', () => {
    expect(cadenceDatesForYear('First Tuesday', '2026-2027')).toEqual([
      '2026-07-07',
      '2026-08-04',
      '2026-09-01',
      '2026-10-06',
      '2026-11-03',
      '2026-12-01',
      '2027-01-05',
      '2027-02-02',
      '2027-03-02',
      '2027-04-06',
      '2027-05-04',
      '2027-06-01',
    ]);
    expect(code(() => cadenceDatesForYear('First Tuesday', '2026-2028'))).toBe('INVALID_INPUT');
  });

  it('runs a cadence meeting two hours from its start time, never past midnight', () => {
    expect(cadenceMeetingTimes('19:30')).toEqual({ 'Time Start': '19:30:00', 'Time End': '21:30:00' });
    expect(cadenceMeetingTimes('23:00:00')).toEqual({ 'Time Start': '23:00:00', 'Time End': '23:59:00' });
    expect(code(() => cadenceMeetingTimes('7:30 PM'))).toBe('INVALID_INPUT');
  });
});

describe('agenda and expense window rules (pure)', () => {
  it('picks the soonest meeting at least ten days out', () => {
    expect(earliestAgendaDate(TODAY)).toBe('2026-09-30');
    const m = (id: number, Date: string, start = '19:30:00') => ({ id, Date, 'Time Start': start });
    expect(nextEligibleAgendaMeeting([m(1, '2026-10-06'), m(2, '2026-09-29'), m(3, '2026-11-03')], TODAY)?.id).toBe(1);
    expect(nextEligibleAgendaMeeting([m(4, '2026-10-06', '20:00:00'), m(5, '2026-10-06', '18:00:00'), m(6, '2026-09-30')], TODAY)?.id).toBe(6);
    expect(nextEligibleAgendaMeeting([m(7, '2026-09-29'), m(8, '2026-09-01')], TODAY)).toBeNull();
  });

  it('words the motion with the amount and the organization', () => {
    expect(charitableMotionText({ id: 7, OrganizationName: "St. Mary's Food Pantry", AmountRequested: 500 })).toBe(
      "That the council donate $500.00 to St. Mary's Food Pantry (charitable request #7).",
    );
  });

  it('accepts a submission from the event start through thirty days after its end', () => {
    const event = (StartDate: string, EndDate: string) => [eventExpenseSpan({ id: 1, StartDate, EndDate })];
    expect(code(() => assertExpenseSubmissionWindow('Submitted', event('2026-09-21', '2026-09-21'), NOW))).toBe('EXPENSE_WINDOW_NOT_OPEN');
    expect(code(() => assertExpenseSubmissionWindow('Submitted', event('2026-09-20', '2026-09-22'), NOW))).toBeUndefined();
    expect(code(() => assertExpenseSubmissionWindow('Submitted', event('2026-08-01', '2026-08-21'), NOW))).toBeUndefined();
    expect(code(() => assertExpenseSubmissionWindow('Submitted', event('2026-08-01', '2026-08-20'), NOW))).toBe('EXPENSE_WINDOW_CLOSED');
    // Drafts and sheets linking nothing are not limited.
    expect(code(() => assertExpenseSubmissionWindow('Draft', event('2027-01-01', '2027-01-01'), NOW))).toBeUndefined();
    expect(code(() => assertExpenseSubmissionWindow('Draft', event('2026-01-01', '2026-01-01'), NOW))).toBeUndefined();
    expect(code(() => assertExpenseSubmissionWindow('Submitted', [], NOW))).toBeUndefined();
  });

  it('holds meetings to the same window, counting a multi-day meeting through its last day (Sprint 5Z-6)', () => {
    const meeting = (Date: string, EndDate: string | null = null) => meetingExpenseSpan({ id: 2, Date, IsMultiDay: EndDate ? 1 : 0, EndDate });
    expect(expenseWindowState(meeting('2026-09-21'), TODAY)).toBe('not-open');
    expect(expenseWindowState(meeting('2026-08-21'), TODAY)).toBe('open');
    expect(expenseWindowState(meeting('2026-08-20'), TODAY)).toBe('closed');
    expect(expenseWindowState(meeting('2026-08-10', '2026-08-22'), TODAY)).toBe('open');
    expect(code(() => assertExpenseSubmissionWindow('Submitted', [meeting('2026-10-06')], NOW))).toBe('EXPENSE_WINDOW_NOT_OPEN');
    expect(code(() => assertExpenseSubmissionWindow('Submitted', [meeting('2026-07-01')], NOW))).toBe('EXPENSE_WINDOW_CLOSED');
    // Every linked span must be open.
    const both = [eventExpenseSpan({ id: 1, StartDate: TODAY, EndDate: TODAY }), meeting('2026-07-01')];
    expect(code(() => assertExpenseSubmissionWindow('Submitted', both, NOW))).toBe('EXPENSE_WINDOW_CLOSED');
    expect(expenseWindowLockMessage(meeting('2026-07-01'), TODAY)).toMatch(/closed .*30 days after the meeting ended/);
    expect(expenseWindowLockMessage(meeting('2026-08-21'), TODAY)).toBeNull();
  });

  it('releases cadence invitations five days ahead and cleans a cadence config', () => {
    expect(cadenceInviteReleaseDate('2026-10-06')).toBe('2026-10-01');
    expect(isInvitationReleased({ InviteReleaseDate: '2026-09-25' }, TODAY)).toBe(false);
    expect(isInvitationReleased({ InviteReleaseDate: TODAY }, TODAY)).toBe(true);
    expect(isInvitationReleased({ InviteReleaseDate: null }, TODAY)).toBe(true);
    expect(cleanCadenceConfigInput({ MeetingTypeID: 1, CadencePattern: 'third  wednesday', DefaultStartTime: '19:00:00', DefaultLocation: ' Hall ' })).toEqual({
      MeetingTypeID: 1,
      CadencePattern: 'Third Wednesday',
      DefaultStartTime: '19:00',
      DefaultLocation: 'Hall',
      DefaultRecipientGroup: 'all_members',
    });
    const base = { MeetingTypeID: 1, CadencePattern: 'First Tuesday', DefaultStartTime: '19:00', DefaultLocation: 'Hall' };
    expect(code(() => cleanCadenceConfigInput({ ...base, DefaultRecipientGroup: 'trustees' as never }))).toBe('INVALID_INPUT');
    expect(code(() => cleanCadenceConfigInput({ ...base, MeetingTypeID: 0 }))).toBe('INVALID_INPUT');
    expect(code(() => cleanCadenceConfigInput({ ...base, DefaultLocation: '  ' }))).toBe('INVALID_INPUT');
  });
});

const form = (over: Partial<NewCharitableRequest> = {}): NewCharitableRequest => ({
  OrganizationName: 'St. Jude Youth Ministry',
  AmountRequested: 800,
  RelationshipTypeID: 1,
  Is501c3: true,
  ...over,
});

/** A request filed by `shepherdId`, claimed and advanced by the Financial Secretary (Admin 2), the vote pending. */
async function advancedRequest(db: DataService, shepherdId: number = MEMBER.member): Promise<number> {
  const { request } = await db.charities.submitCharitableRequest(shepherdId, form());
  await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'claim' });
  await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'advance' });
  return request.id;
}

const receipt = (): ExpenseLineItemInput => ({ DateOfExpense: TODAY, Amount: 42.5, VendorName: 'Costco', ExpenseDescription: 'Supplies' });

describe.each(drivers)('$name driver: parliamentary cadence', (d) => {
  it('lays down the twelve meetings of a fraternal year from the council cadence, with its agenda template', async () => {
    const db = await d.make();
    await db.meetings.saveAgendaTemplate(MEMBER.superAdmin, OWN, MONTHLY_TYPE, '1. Opening prayer\n2. Minutes');
    const monthlyGlobal = (await db.lookups.list('MeetingType')).find((t) => t.Type === 'Monthly')!.id;
    const before = d.count(db, 'Meeting');

    const result = await db.meetings.populateAnnualCadence(MEMBER.admin, OWN, CADENCE, '2026-2027');
    expect(result.config).toMatchObject({ id: CADENCE, CouncilID: OWN, MeetingTypeID: MONTHLY_TYPE, CadencePattern: 'First Tuesday' });
    expect(result.fraternalYear).toBe('2026-2027');
    expect(result.skippedDates).toEqual([]);
    expect(result.created.map((m) => m.Date)).toEqual(cadenceDatesForYear('First Tuesday', '2026-2027'));
    expect(result.created[0]).toMatchObject({
      CouncilID: OWN,
      'Meeting Name': 'Monthly Meeting',
      'Time Start': '19:30:00',
      'Time End': '21:30:00',
      Location: 'Parish Hall',
      Agenda: '1. Opening prayer\n2. Minutes',
      MeetingType: monthlyGlobal,
      MeetingTypeID: MONTHLY_TYPE,
      IsMultiDay: 0,
      EndDate: null,
      OwnerID: null,
      InviteReleaseDate: '2026-07-02',
    });
    expect(d.count(db, 'Meeting')).toBe(before + 12);
    // The config's recipient group (default All Members) is invited at once; the drip release hides it from feeds.
    const active = (await db.members.listByCouncil(OWN, { activeOnly: true })).map((m) => m.id).sort((a, b) => a - b);
    expect((await db.meetings.listInvites(result.created[0].id)).map((i) => i.MemberID).sort((a, b) => a - b)).toEqual(active);

    // Running it again creates only what is missing.
    const again = await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    expect(again.created).toEqual([]);
    expect(again.skippedDates).toHaveLength(12);
    expect(d.count(db, 'Meeting')).toBe(before + 12);
  });

  it('is for the council meeting keepers only, and refuses unknown configs and bad years without writing', async () => {
    const db = await d.make();
    const before = d.count(db, 'Meeting');
    await expectRule(db.meetings.populateAnnualCadence(MEMBER.member, OWN, CADENCE, '2026-2027'), 'ADMIN_REQUIRED');
    await expectRule(db.meetings.populateAnnualCadence(9999, OWN, CADENCE, '2026-2027'), 'MEMBER_NOT_FOUND');
    await expectRule(db.meetings.populateAnnualCadence(MEMBER.admin, 2, CADENCE, '2026-2027'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, 999, '2026-2027'), 'RECORD_NOT_FOUND');
    await expectRule(db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026'), 'INVALID_INPUT');
    expect(d.count(db, 'Meeting')).toBe(before);
  });
});

describe.each(drivers)('$name driver: routing a request to the next eligible agenda', (d) => {
  it('adds a pending motion to the soonest Monthly meeting at least ten days out, once', async () => {
    const db = await d.make();
    const requestId = await advancedRequest(db);
    await expectRule(db.charities.routeRequestToNextEligibleAgenda(MEMBER.superAdmin, requestId), 'NO_ELIGIBLE_MEETING');

    await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    const { motion, meeting } = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.superAdmin, requestId);
    // NOW is 2026-09-20: October 6 is the first First Tuesday on or after September 30.
    expect(meeting).toMatchObject({ Date: '2026-10-06', MeetingTypeID: MONTHLY_TYPE, CouncilID: OWN });
    expect(motion).toMatchObject({
      CouncilID: OWN,
      TargetMeetingID: meeting.id,
      SourceType: 'CharitableRequest',
      SourceRecordID: requestId,
      MotionText: `That the council donate $800.00 to St. Jude Youth Ministry (charitable request #${requestId}).`,
      PresenterMemberID: MEMBER.member,
      AllocatedMinutes: 5,
      VoteResult: 'Pending',
    });
    expect(d.count(db, 'ProposedMotion')).toBe(1);

    await expectRule(db.charities.routeRequestToNextEligibleAgenda(MEMBER.admin, requestId), 'REQUEST_STATUS_CONFLICT');
    expect(d.count(db, 'ProposedMotion')).toBe(1);
  });

  it('routes only advanced requests, by independent vetters, and writes nothing when it refuses', async () => {
    const db = await d.make();
    await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    const { request: fresh } = await db.charities.submitCharitableRequest(MEMBER.member, form());
    await expectRule(db.charities.routeRequestToNextEligibleAgenda(MEMBER.admin, fresh.id), 'REQUEST_STATUS_CONFLICT');
    await expectRule(db.charities.routeRequestToNextEligibleAgenda(MEMBER.admin, 9999), 'RECORD_NOT_FOUND');
    await expectRule(db.charities.routeRequestToNextEligibleAgenda(9999, fresh.id), 'MEMBER_NOT_FOUND');

    const ownRequest = await advancedRequest(db, MEMBER.superAdmin);
    await expectRule(db.charities.routeRequestToNextEligibleAgenda(MEMBER.superAdmin, ownRequest), 'SELF_VETTING_BLOCKED');
    const othersRequest = await advancedRequest(db, MEMBER.superAdmin);
    await expectRule(db.charities.routeRequestToNextEligibleAgenda(MEMBER.member, othersRequest), 'VETTING_AUTHORITY_REQUIRED');
    expect(d.count(db, 'ProposedMotion')).toBe(0);
  });
});

describe.each(drivers)('$name driver: expense submission window', (d) => {
  async function eventOn(db: DataService, StartDate: string, EndDate: string): Promise<number> {
    const category = (await db.lookups.list('Category'))[0];
    const event = await db.events.create(
      { EventName: `Fixture ${StartDate}`, EventDescription: 'Sprint 5Z-5 fixture', OwnerID: MEMBER.superAdmin, StartDate, EndDate, Location: 'Hall', CategoryID: category.id },
      [OWN],
    );
    return event.id;
  }

  it('submits only from the linked event start through thirty days after its end; drafts save any time', async () => {
    const db = await d.make();
    const upcoming = await eventOn(db, '2026-10-03', '2026-10-03');
    const stale = await eventOn(db, '2026-08-01', '2026-08-20');
    const lastDay = await eventOn(db, '2026-08-21', '2026-08-21');

    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedEventID: upcoming }, [receipt()]), 'EXPENSE_WINDOW_NOT_OPEN');
    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedEventID: stale }, [receipt()]), 'EXPENSE_WINDOW_CLOSED');
    expect(await db.expenses.listUserReports(MEMBER.member)).toEqual([]);

    const draft = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedEventID: upcoming }, [receipt()]);
    expect(draft.report).toMatchObject({ Status: 'Draft', LinkedEventID: upcoming });
    await expectRule(
      db.expenses.submitReport(MEMBER.member, { id: draft.report.id, Status: 'Submitted', LinkedEventID: upcoming }, [receipt()]),
      'EXPENSE_WINDOW_NOT_OPEN',
    );

    const onTime = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedEventID: lastDay }, [receipt()]);
    expect(onTime.report).toMatchObject({ Status: 'Submitted', LinkedEventID: lastDay });
  });

  it('holds sheets linked to a meeting to the same window (Sprint 5Z-6)', async () => {
    const db = await d.make();
    const type = (await db.lookups.list('MeetingType'))[0];
    const meetingOn = async (Date: string) =>
      (
        await db.meetings.create({
          OwnerID: null,
          CouncilID: OWN,
          'Meeting Name': `Fixture ${Date}`,
          Date,
          'Time Start': '19:00:00',
          'Time End': '20:00:00',
          Location: 'Hall',
          MeetingType: type.id,
        })
      ).id;
    const upcoming = await meetingOn('2026-10-06');
    const stale = await meetingOn('2026-08-01');
    const recent = await meetingOn('2026-09-01');
    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedMeetingID: upcoming }, [receipt()]), 'EXPENSE_WINDOW_NOT_OPEN');
    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedMeetingID: stale }, [receipt()]), 'EXPENSE_WINDOW_CLOSED');
    expect((await db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedMeetingID: upcoming }, [receipt()])).report.Status).toBe('Draft');
    expect((await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedMeetingID: recent }, [receipt()])).report.Status).toBe('Submitted');
  });
});

describe.each(drivers)('$name driver: drip-release invitations and cadence configs (Sprint 5Z-6)', (d) => {
  it('keeps cadence invitations off member feeds until five days before each meeting', async () => {
    const db = await d.make();
    const { created } = await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    const october = created.find((m) => m.Date === '2026-10-06')!;
    expect(october.InviteReleaseDate).toBe('2026-10-01');

    // On the master calendar at once ...
    expect((await db.meetings.listUpcoming(OWN, { fromDate: TODAY })).map((m) => m.id)).toContain(october.id);
    // ... but not in the member's own feed before October 1 (NOW is September 20).
    expect((await db.meetings.listUpcoming(OWN, { memberId: MEMBER.member, fromDate: TODAY })).map((m) => m.id)).not.toContain(october.id);
    const schedules = await db.meetings.listSchedules(OWN, MEMBER.member, { fromDate: TODAY });
    expect(schedules.allSchedules.map((m) => m.id)).toContain(october.id);
    expect(schedules.myInvites.map((m) => m.id)).not.toContain(october.id);
    expect(schedules.myResponses[october.id]).toBeUndefined();
    await expectRule(db.meetings.rsvpToInvite(MEMBER.member, october.id, 'Accepted'), 'NOT_INVITED');

    // A hand-scheduled meeting (no release date) reaches the feed at once.
    const type = (await db.lookups.list('MeetingType'))[0];
    const special = await db.meetings.create(
      {
        OwnerID: null,
        CouncilID: OWN,
        'Meeting Name': 'Special session',
        Date: '2026-12-15',
        'Time Start': '19:00:00',
        'Time End': '20:00:00',
        Location: 'Hall',
        MeetingType: type.id,
      },
      'allActive',
    );
    expect(special.InviteReleaseDate ?? null).toBeNull();
    expect((await db.meetings.listUpcoming(OWN, { memberId: MEMBER.member, fromDate: TODAY })).map((m) => m.id)).toContain(special.id);
    expect((await db.meetings.rsvpToInvite(MEMBER.member, special.id, 'Accepted')).ResponseStatus).toBe('Accepted');
  });

  it('saves, lists and removes cadence configs for the council keepers only', async () => {
    const db = await d.make();
    const configs = await db.meetings.listCadenceConfigs(OWN);
    expect(configs.map((c) => c.id)).toEqual([CADENCE]);
    expect(configs[0].DefaultRecipientGroup).toBe('all_members');

    const updated = await db.meetings.saveCadenceConfig(MEMBER.admin, OWN, {
      MeetingTypeID: MONTHLY_TYPE,
      CadencePattern: 'second thursday',
      DefaultStartTime: '19:00',
      DefaultLocation: 'Council Hall',
      DefaultRecipientGroup: 'active_officers',
    });
    expect(updated).toMatchObject({
      id: CADENCE,
      CadencePattern: 'Second Thursday',
      DefaultStartTime: '19:00',
      DefaultLocation: 'Council Hall',
      DefaultRecipientGroup: 'active_officers',
    });
    const officerType = (await db.meetings.listCouncilMeetingTypes(OWN)).find((t) => t.TypeName === 'Officer')!;
    const added = await db.meetings.saveCadenceConfig(MEMBER.superAdmin, OWN, {
      MeetingTypeID: officerType.id,
      CadencePattern: 'Last Monday',
      DefaultStartTime: '18:30',
      DefaultLocation: 'Rectory',
    });
    expect((await db.meetings.listCadenceConfigs(OWN)).map((c) => c.id)).toEqual([CADENCE, added.id]);

    // An officers-only cadence invites only the officers.
    const { created } = await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    const invited = (await db.meetings.listInvites(created[0].id)).map((i) => i.MemberID);
    expect(invited).toContain(MEMBER.superAdmin); // the Grand Knight
    expect(invited).not.toContain(MEMBER.member);

    const base = { MeetingTypeID: MONTHLY_TYPE, CadencePattern: 'First Tuesday', DefaultStartTime: '19:00', DefaultLocation: 'Hall' };
    await expectRule(db.meetings.saveCadenceConfig(MEMBER.member, OWN, base), 'ADMIN_REQUIRED');
    await expectRule(db.meetings.saveCadenceConfig(MEMBER.admin, OWN, { ...base, MeetingTypeID: 999 }), 'INVALID_INPUT');
    await expectRule(db.meetings.removeCadenceConfig(MEMBER.member, OWN, added.id), 'ADMIN_REQUIRED');
    await expectRule(db.meetings.removeCadenceConfig(MEMBER.admin, OWN, 999), 'RECORD_NOT_FOUND');
    await db.meetings.removeCadenceConfig(MEMBER.admin, OWN, added.id);
    expect((await db.meetings.listCadenceConfigs(OWN)).map((c) => c.id)).toEqual([CADENCE]);
    await expectRule(db.meetings.listCadenceConfigs(9999), 'INVALID_INPUT');
  });

  it("lists a meeting's proposed motions with the Knight Shepherd as presenter", async () => {
    const db = await d.make();
    await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    const requestId = await advancedRequest(db);
    const { meeting } = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.superAdmin, requestId);
    const [row, ...rest] = await db.meetings.listProposedMotions(meeting.id);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({ presenterFirstName: 'Brother', presenterLastName: 'Knight', motion: { SourceRecordID: requestId, AllocatedMinutes: 5 } });
    await expectRule(db.meetings.listProposedMotions(9999), 'MEETING_NOT_FOUND');
  });
});
