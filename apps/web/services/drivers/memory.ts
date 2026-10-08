// In-memory mock driver for the web app.
// Backed by plain arrays, but it enforces the same rules the real database does
// (NOT NULL, defaults, IDENTITY ids, primary-key uniqueness, foreign keys) using
// the table metadata generated from Schema.sql, so UI bugs surface here instead
// of against Azure SQL. State is per browser tab and resets on reload.
// Nothing outside /services may import this file.
import {
  ACTIVITY_COLUMNS,
  aggregateMeetingHours,
  assertActivityDateAllowed,
  assertDonationDateForEvent,
  assertDonationFitsMethod,
  assertEventRange,
  assertFundsEditable,
  assertLookupKeyUnique,
  assertLookupNotProtected,
  assertLookupUnused,
  assertNoShowWithoutHours,
  assertMayChangeDonation,
  appendPhotoPaths,
  cleanFlyerFileId,
  assertMayAttachEventMedia,
  assertMayAuditCouncilExpenses,
  assertMayDisburseCouncilExpenses,
  assertMayDispatchCouncilAlerts,
  assertFraternalExtension,
  assertMaySyncSupremeReports,
  alertHistoryThreshold,
  cleanAlertFilters,
  cleanAlertPayload,
  cleanAlchemerSurveyId,
  cleanExpoPushToken,
  cleanSupremeFormType,
  compileSupremeSnapshot,
  alchemerAnswers,
  buildAlchemerRequest,
  deliverAlertsByStub,
  logAlchemerRequest,
  noAlertRecipients,
  postAlchemerReport,
  sortAlerts,
  resolveSupremePeriod,
  buildSyncHistory,
  alertNotFound,
  withoutPushToken,
  type SupremeSnapshotRows,
  assertNoSelfPayout,
  assertDistinctExpenseSigners,
  assertDualSigned,
  assertExpenseSignatureStage,
  assertMayAuthorizeExpenseOrder,
  assertMayIssueExpenseOrder,
  assertMayReadAuthorizationDesk,
  awaitsCounterSignature,
  assertNotSelfApproval,
  CLEARED_EXPENSE_SIGNATURES,
  cleanRejectionReason,
  EXPENSE_SPEND_STATUSES,
  assertCheckNumberUnused,
  assertExpenseLinks,
  assertExpenseCharityRequestLink,
  assertExpenseStatus,
  memberOnboardingState,
  nextExpenseStatus,
  nextIntakeSessionStatus,
  nextOnboardingState,
  assertReportInCouncil,
  buildExpenseReportDetails,
  cleanDisbursementCheck,
  cleanExpenseLineItems,
  cleanExpenseReportIds,
  cleanExpenseReportInput,
  EXPENSE_QUEUE_STATUSES,
  expenseReportNotFound,
  sumAmounts,
  assertMayChangeLesson,
  assertMayLinkMeetingDrive,
  buildCalendarEntries,
  cleanCalendarRange,
  cleanGoogleDriveUrl,
  assertMayManageCouncilLookups,
  assertMayMarkNoShow,
  assertMayReadFeedback,
  assertMayReadLessonsRegistry,
  assertMayCreateMember,
  assertMayEditMemberExtensions,
  assertMayMaintainCouncilRecords,
  assertMayMaintainCouncils,
  assertMayMaintainLookups,
  assertMayUpdateMember,
  assertPasswordAcceptable,
  assertRecordUnused,
  assertRecordValueUnique,
  assertShiftInsideEvent,
  assertText,
  assertValidHours,
  assertShiftReportAllowed,
  assertThreadParticipant,
  buildActivityTimeLog,
  buildDonationHistory,
  buildFeedbackInbox,
  buildLessonsRegistry,
  buildNoShowAudit,
  buildShiftsAwaitingHours,
  buildThreadMessages,
  buildThreadSummaries,
  buildWelcomeEmail,
  BusinessRuleError,
  cleanActivity,
  cleanCouncil,
  cleanFeatureFlagChanges,
  assertMayEditBylaws,
  assertMayEditDuesRate,
  cleanDuesRate,
  cleanGlobalCouncilParameters,
  cleanBylawsText,
  cleanEmailGatewaySettings,
  CLEARED_EMAIL_GATEWAY,
  nextQuarterHourTotal,
  cleanCouncilIds,
  cleanFeedbackText,
  cleanDistributionListChanges,
  cleanEventFields,
  cleanLessonsRegistryFilters,
  cleanLookupValues,
  cleanMemberExtensions,
  cleanNewDistributionList,
  cleanNewDonation,
  cleanNewEvent,
  cleanNewMember,
  cleanNewShift,
  cleanParish,
  cleanPastor,
  cleanShiftFields,
  COUNCIL_COLUMNS,
  COUNCIL_LOOKUP_META,
  donationMethodKind,
  isSha256Hex,
  LOOKUP_META,
  mergeDonationChanges,
  mergeMemberChanges,
  mergeRecordChanges,
  monthBounds,
  noShowReasonFor,
  noShowAuditThreshold,
  planCouncilLookupSave,
  nextEventFunds,
  MEMBER_COLUMNS,
  PARISH_COLUMNS,
  participantIds,
  distributionGroupMemberIds,
  PASTOR_COLUMNS,
  planEventCopy,
  RECORD_REFERENCES,
  recordNotFound,
  rollupEventFunds,
  signupNotFound,
  sortCouncilLookupRows,
  summarizeActivities,
  summarizeMonth,
  toTimestamp,
  trainingDateToYear,
  trainingYearToDate,
  UNREGISTERED_PASSWORD,
  alreadyNominated,
  assertActiveCouncilMember,
  assertAppointableRole,
  assertElectedRole,
  assertMayAppointOfficers,
  assertMayConcludeFraternalYear,
  assertMayConfigureBallot,
  assertMayNominate,
  assertMayRecordAbdication,
  assertNominationsOpen,
  assertOfficeRole,
  assertOneTrusteeSeat,
  ballotTermYear,
  buildBallotSeats,
  buildOfficerSeats,
  buildVacancies,
  cleanBallotStatus,
  conclusionResult,
  electionTermYear,
  fraternalYearOf,
  GRAND_KNIGHT_ROLE,
  isEligibleNominee,
  midYearNominationsCloseAt,
  planConclusionFromSeats,
  planHistoryBackfill,
  requireRole,
  roleNotHeld,
  roleOccupied,
  seatHolderId,
  seatHolderIdByName,
  assertMayAddGlobalCharity,
  assertMayReviewCharityProposals,
  assertMayVetCharitableRequests,
  mayOverrideVettingClaim,
  hasAdminRights,
  assertIndependentVetter,
  assertCouncilRelationshipType,
  assertCouncilMissionArea,
  assertCouncilBudgetLine,
  buildMissionAreaFootprint,
  buildCharitableRequestDetails,
  CHARITABLE_REQUEST_FORM_COLUMNS,
  charitableRequestNotFound,
  assertCharitableThreadAccess,
  assertCharitableThreadType,
  buildCharitableRequestThreads,
  buildCharitableThreadDetail,
  charitableThreadAccess,
  charitableThreadNotFound,
  cleanCharitableThreadMessage,
  linkableCharitableRequests,
  cleanCharitableRequest,
  planCharitableTriage,
  assertOneCharitySource,
  buildCharityProposalDetails,
  buildCouncilCharityLedger,
  assertMayConnectCouncilCharity,
  assertMayDisburseCharity,
  assertMayProposeCharityGift,
  assertMinutesMeetingInCouncil,
  assertProposalPending,
  charityAlreadyRegistered,
  charityBlankFills,
  charityNotFound,
  charityProposalNotFound,
  cleanCharityCheck,
  cleanCharityProposal,
  cleanCharitySearchFilters,
  cleanGlobalCharity,
  findRegisteredCharity,
  noCharityToPay,
  normalizeStateCode,
  searchCharityRegistry,
  suggestLocalCharities,
  assertBudgetYearApprovable,
  assertBudgetYearNotApproved,
  assertBudgetYearWritable,
  assertCouncilBudgetCategory,
  assertFraternalYear,
  assertMayApproveBudget,
  assertMayManageBudgetForecast,
  assertMayReviewBudgetPerformance,
  assertMayViewBudgetForecast,
  budgetProgressThrough,
  budgetStatusOf,
  budgetWindowOf,
  buildBudgetYearPerformance,
  buildPriorYearBaselines,
  completedFraternalYears,
  buildConcludedBudgetPerformance,
  currentFraternalYear,
  planCharitableBudgetFallback,
  planExpenseBudgetLineSave,
  assignableExpenseBudgetLines,
  currentBudgetLineIdOf,
  planExpenseAssetConversion,
  budgetLineExists,
  budgetLineNotFound,
  cleanBudgetLineUpdate,
  assertBudgetLineAmendable,
  budgetLineVersions,
  cleanLineQuantityAndUnitCost,
  currentBudgetLines,
  nextBudgetLineStatus,
  planBudgetAmendment,
  unitCostAfterLumpSum,
  cleanCustomBudgetLine,
  findOperationalBudgetLine,
  fraternalYearBounds,
  mergeBudgetSeeds,
  planBudgetApproval,
  planBudgetPrePopulation,
  previousFraternalYear,
  sortBudgetLines,
  summarizeBudgetHistory,
  type CleanDonation,
  type ElectionRows,
  type EventFunds,
  type GateCouncil,
  type MaintainedTable,
  type MemberWriteActor,
  type MessagingRows,
  type SeatTransition,
  type SignupContextRow,
  assertMeetingResponseStatus,
  shiftDefaultLengthHours,
  assertMayManageAgendaTemplates,
  cleanAgendaTemplateText,
  cleanMeetingSpan,
  meetingLastDate,
  assertExpenseSubmissionWindow,
  assertMayScheduleCouncilCadence,
  assertRoutableRequest,
  cadenceConfigNotFound,
  cadenceDatesForYear,
  cadenceMeetingName,
  cadenceMeetingTimes,
  charitableMotionText,
  globalMeetingTypeFor,
  isMonthlyCouncilMeetingType,
  nextEligibleAgendaMeeting,
  noEligibleAgendaMeeting,
  PROPOSED_MOTION_DEFAULT_MINUTES,
  assertIsoDate,
  cadenceInviteMode,
  cadenceInviteReleaseDate,
  cleanCadenceConfigInput,
  eventExpenseSpan,
  isInvitationReleased,
  meetingExpenseSpan,
  accountBalance,
  assertJournalLinks,
  assertMayPostGeneralLedger,
  assertMayReadGeneralLedger,
  buildBalanceSheet,
  buildChartOfAccounts,
  cleanJournalLines,
  journalCouncilOf,
  matchBankStatement,
  parseBankStatementCsv,
  planAssetTransfer,
  reconcilableAccountIds,
  buildAccountLedger,
  formatTransactionId,
  glAccountNotFound,
  assertBallotLaunchable,
  assertBallotOpen,
  assertBallotSelection,
  assertCheckedIn,
  assertFinalMotionResult,
  assertLiveParticipant,
  assertMayFollowLiveAssembly,
  assertMayRunLiveAssembly,
  assertMeetingLive,
  assertMotionPending,
  assertNoBallotOpen,
  assertResultMatchesTally,
  ballotAlreadyCast,
  ballotHashInput,
  buildLiveAssemblyState,
  charitableVoteOutcome,
  cleanLiveAgendaItem,
  formatBallotSecret,
  isMeetingLive,
  proposedMotionNotFound,
  tallyBallots,
  assertIntakeSessionStatus,
  assertMayChangeDistributionList,
  assertMayCreateDistributionList,
  distributionListNameSiblings,
  distributionListNotFound,
  isCouncilWideList,
  isListVisibleTo,
  assertMayRunEventIntake,
  agendaAlreadyStructured,
  agendaLineNotFound,
  assertAgendaLineRef,
  assertHandTallyAllowed,
  assertMayEditLiveAgenda,
  blueprintAgendaItems,
  buildMeetingAgendaView,
  capitalOnFailedMotion,
  cleanAgendaLineMarkdown,
  cleanHandTally,
  cleanTransactionId,
  handTallyNotFound,
  handTallyResult,
  ledgerTransactionNotFound,
  mayPostGeneralLedger,
  MOTION_LINE_SORT_BASE,
  summarizeLedgerTransactions,
  assertAgendaSectionKey,
  assertMayImportSupremeRoster,
  cleanAgendaLineKey,
  cleanRosterJoinDate,
  cleanSupremeRosterRow,
  describeError,
  SecurityPrivilegeError,
  enrollmentCodeExpiry,
  enrollmentCodeHashInput,
  enrollmentCodeInvalid,
  formatEnrollmentCode,
  buildSendGridMailRequest,
  isEnrollmentTokenUsable,
  logSendGridRequest,
  nextAgendaSortOrder,
  rosterMemberNumber,
  buildPasswordResetEmail,
  cleanResetCode,
  enrollmentCodeRequired,
  formatResetCode,
  isResetRequestCoolingDown,
  isResetTokenLive,
  resetCodeExpiry,
  resetCodeHashInput,
  resetCodeInvalid,
  type SendGridMailRequest,
  type SupremeRosterSyncResult,
  type CleanJournalLine,
  type MeetingAgendaItem,
  type MeetingAgendaView,
  type MotionHandTally,
} from '@kofc/shared';
import type {
  CouncilCadenceConfig,
  Event,
  MeetingType,
  ProposedMotion,
  DistributionGroup,
  AnnualBudgetForecast,
  BudgetYearPerformance,
  BudgetYearSpend,
  CharitableDisbursementLedger,
  CouncilBudgetCategory,
  CouncilAssetsInventory,
  CouncilBudgetForecast,
  CharityProposalDetail,
  CharityDonationProposal,
  CouncilCharityLink,
  GlobalCharityRegistry,
  CouncilElectionBallot,
  CouncilLeadershipHistory,
  OfficerNominations,
  Activities,
  AlchemerRequest,
  AlchemerResponse,
  NotificationLog,
  SupremeComplianceSnapshot,
  SupremeFormType,
  SupremePeriodChoice,
  SupremeReportingPeriod,
  SupremeReportingSync,
  ActivityTime,
  ChatThread,
  Council,
  CouncilDonationMethod,
  CouncilLookupRowMap,
  CouncilLookupTableName,
  CouncilSkillEntry,
  DataService,
  DistributionLists,
  DistributionListSummary,
  Donation,
  DonationMethod,
  DonationType,
  KOCTrainingClasses,
  MemberExtensions,
  MemberSkill,
  MemberTraining,
  NewActivity,
  NewCouncil,
  NewMember,
  NewParish,
  NewPastor,
  Parish,
  Pastor,
  ProfileOptions,
  Skill,
  SkillLevel,
  SystemFeedback,
  WorkingStatus,
  Event as CouncilEvent,
  EventChanges,
  EventSignup,
  EventTime,
  ExpenseDisbursement,
  ExpenseLineItem,
  ExpenseReport,
  ExpenseReportDetail,
  ExpenseReportStatus,
  LessonsLearned,
  LessonsLearnedCategory,
  Category,
  LookupRowMap,
  LookupTableName,
  Meeting,
  GLAccount,
  JournalEntry,
  BallotVote,
  LiveAssemblyState,
  LiveAttendance,
  MeetingInvites,
  MeetingResponseStatus,
  CouncilMeetingType,
  CharitableRequest,
  CharitableRequestDetail,
  CharitableRequestThread,
  CharitableRequestThreadDetail,
  CharitableRequestThreadMessage,
  CouncilMissionArea,
  CouncilRelationshipType,
  CouncilAgendaTemplate,
  MeetingInviteMode,
  Member,
  MemberShift,
  VolunteerTurnout,
  Message,
  MessageAttachment,
  NoShowReason,
  LookupValues,
  NewEvent,
  NewMeeting,
  ReadReceipt,
  Role,
  SessionUser,
  Shift,
  ShiftChanges,
  ShiftFeedItem,
} from '@kofc/shared';
import { PRESENTATION_SEED_DATA, SEED_DATA, TABLES, type SeedValue } from '../generated/schema.generated';
import { sha256Hex } from '../password';
import {
  buildDevEvents,
  buildDevExtraEvents,
  buildDevMeetings,
  buildDevMessaging,
  DEV_AFFILIATED_COUNCIL,
  DEV_COUNCIL_DONATION_METHODS,
  DEV_COUNCIL_NUMBER,
  DEV_UNAFFILIATED_COUNCIL,
  DEV_ENROLLMENT_CODE,
  DEV_UNREGISTERED_MEMBER,
  toIsoDate,
  type DevMeetingTypeName,
} from '../seed-dev';

type Row = Record<string, SeedValue>;

/** Allow-list mirroring the mobile driver. Exhaustive by construction. */
const LOOKUP_TABLES: Record<LookupTableName, true> = {
  MemberStatus: true,
  Degree: true,
  MemberType: true,
  Role: true,
  NoShowReason: true,
  Category: true,
  LessonsLearnedCategory: true,
  MeetingType: true,
};

/** Credentials.Password holds a SHA-256 hex digest; a not-yet-registered member's placeholder never matches. */
const passwordMatches = async (stored: string, supplied: string) =>
  stored !== UNREGISTERED_PASSWORD && stored === (await sha256Hex(supplied));

const lower = (v: SeedValue | undefined) => String(v ?? '').toLowerCase();

/** Soonest first: date, then start time, then id. */
const compareShifts = (a: Shift, b: Shift) =>
  a.ShiftDate.localeCompare(b.ShiftDate) || a.StartTime.localeCompare(b.StartTime) || a.id - b.id;

/** A cleaned row's `columns` as store values; optional fields left undefined are stored as NULL. */
const rowValues = <T extends object>(columns: readonly (keyof T & string)[], clean: T): Record<string, SeedValue> =>
  Object.fromEntries(columns.map((c) => [c, (clean[c] ?? null) as SeedValue]));

const noParish = (parishId: number) => new BusinessRuleError('INVALID_INPUT', `No parish with id ${parishId}.`, { parishId });

/** Matches SQLite's CURRENT_TIMESTAMP format ('YYYY-MM-DD HH:MM:SS', UTC). */
const nowTimestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

class MemoryStore {
  private tables = new Map<string, Row[]>();
  private lastId = new Map<string, number>();

  constructor() {
    for (const name of Object.keys(TABLES)) this.tables.set(name, []);
  }

  /** All-or-nothing, like a SQL transaction: if `fn` throws, every table and id counter is restored. */
  transaction<T>(fn: () => T): T {
    const tables = this.tables;
    const lastId = this.lastId;
    this.tables = new Map([...tables].map(([name, rows]) => [name, rows.map((r) => ({ ...r }))]));
    this.lastId = new Map(lastId);
    try {
      return fn();
    } catch (err) {
      this.tables = tables;
      this.lastId = lastId;
      throw err;
    }
  }

  /** Read-only view of the stored rows. Callers must copy before handing rows to the UI. */
  rows(table: string): readonly Row[] {
    const rows = this.tables.get(table);
    if (!rows) throw new Error(`no such table: ${table}`);
    return rows;
  }

  /** Deletes every row of `table` matching `predicate`; returns how many went. */
  remove(table: string, predicate: (row: Row) => boolean): number {
    const kept = this.rows(table).filter((r) => !predicate(r));
    const removed = this.rows(table).length - kept.length;
    this.tables.set(table, kept as Row[]);
    return removed;
  }

  insert(table: string, values: Record<string, SeedValue | boolean | undefined>): Row {
    const meta = TABLES[table];
    if (!meta) throw new Error(`no such table: ${table}`);
    for (const key of Object.keys(values)) {
      if (!meta.columns.some((c) => c.name === key)) throw new Error(`table ${table} has no column named ${key}`);
    }

    const row: Row = {};
    for (const col of meta.columns) {
      let v = values[col.name];
      if (typeof v === 'boolean') v = v ? 1 : 0;

      if ((v === undefined || v === null) && col.identity) {
        v = (this.lastId.get(table) ?? 0) + 1;
      } else if (v === undefined) {
        v = !col.default ? null : col.default.kind === 'now' ? nowTimestamp() : col.default.value;
      }

      if (v === null) {
        if (col.notNull) throw new Error(`NOT NULL constraint failed: ${table}.${col.name}`);
      } else if (col.kind === 'int' || col.kind === 'bit' || col.kind === 'real') {
        if (typeof v !== 'number') throw new Error(`datatype mismatch: ${table}.${col.name} expects a number`);
      } else if (typeof v !== 'string') {
        throw new Error(`datatype mismatch: ${table}.${col.name} expects text`);
      }
      row[col.name] = v;
    }

    const stored = this.rows(table);
    if (stored.some((r) => meta.primaryKey.every((k) => r[k] === row[k]))) {
      throw new Error(`UNIQUE constraint failed: ${meta.primaryKey.map((k) => `${table}.${k}`).join(', ')}`);
    }
    for (const key of meta.uniqueKeys) {
      // As in SQLite (and a WHERE ... IS NOT NULL filtered index), a key holding a NULL never collides.
      if (key.some((k) => row[k] === null)) continue;
      if (stored.some((r) => key.every((k) => r[k] === row[k]))) {
        throw new Error(`UNIQUE constraint failed: ${key.map((k) => `${table}.${k}`).join(', ')}`);
      }
    }
    for (const fk of meta.foreignKeys) {
      const v = row[fk.column];
      if (v !== null && !this.rows(fk.refTable).some((r) => r[fk.refColumn] === v)) {
        throw new Error(`FOREIGN KEY constraint failed: ${table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}`);
      }
    }

    const identity = meta.columns.find((c) => c.identity);
    if (identity) this.lastId.set(table, Math.max(this.lastId.get(table) ?? 0, row[identity.name] as number));
    (this.tables.get(table) as Row[]).push(row);
    return row;
  }
}

export interface MemoryDataServiceOptions {
  /** Clock used for seeding and the history-window rules. Tests pin it. Default: real time. */
  now?: () => Date;
  /** Where system emails, push requests and Alchemer posts go. Default: console.log (no such infrastructure exists yet). */
  log?: (...args: unknown[]) => void;
  /** How supreme.syncAlchemerReport posts to Alchemer. Default: print the request with `log` (logAlchemerRequest). */
  postAlchemer?: (request: AlchemerRequest) => Promise<AlchemerResponse>;
  /**
   * Sprint 6B Patch: how a welcome email is sent, as a SendGrid v3 mail/send request carrying the key placeholder. Default:
   * print the request with `log` (logSendGridRequest); the real key belongs on a server, never in this client driver.
   */
  sendEmail?: (request: SendGridMailRequest) => Promise<void>;
  /**
   * Also load Seed.sql's presentation data (Sprint 5Z-1: officers, expense sheets, charity checks and intake requests)
   * right after the baseline rows. The app turns it on; tests keep the minimal baseline. Default: false.
   */
  presentationData?: boolean;
  /**
   * The secret ballot key (Sprint 5Z-9) hashed with each voter into BallotVote.AnonymousBallotHash. It never enters the
   * store, so the ballots cannot be traced back to voters from the tables. Default: 32 random bytes per service (the
   * store lives as long as the service, so its ballots do too).
   */
  ballotSecret?: string;
}

export class MemoryDataService implements DataService {
  private store = new MemoryStore();
  private initialised: Promise<void> | null = null;
  private readonly now: () => Date;
  private readonly log: (...args: unknown[]) => void;
  private readonly postAlchemer: (request: AlchemerRequest) => Promise<AlchemerResponse>;
  private readonly sendEmail: (request: SendGridMailRequest) => Promise<void>;
  private readonly presentationData: boolean;
  private readonly ballotSecret: string;

  constructor(options: MemoryDataServiceOptions = {}) {
    this.presentationData = options.presentationData ?? false;
    this.ballotSecret = options.ballotSecret ?? formatBallotSecret(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? console.log;
    this.postAlchemer = options.postAlchemer ?? logAlchemerRequest((...args) => this.log(...args));
    this.sendEmail = options.sendEmail ?? logSendGridRequest((...args) => this.log(...args));
  }

  // ---- lifecycle ---------------------------------------------------------

  init(): Promise<void> {
    if (!this.initialised) {
      this.initialised = Promise.resolve()
        .then(() => this.seed())
        .catch((err) => {
          this.initialised = null;
          this.store = new MemoryStore(); // discard any half-seeded state
          throw err;
        });
    }
    return this.initialised;
  }

  async reset(): Promise<void> {
    this.store = new MemoryStore();
    this.initialised = null;
    await this.init();
  }

  private async seed(): Promise<void> {
    for (const { table, rows } of SEED_DATA) for (const row of rows) this.store.insert(table, row);
    if (this.presentationData) for (const { table, rows } of PRESENTATION_SEED_DATA) for (const row of rows) this.store.insert(table, row);

    // Seed.sql stores dev passwords in plaintext; hash them so signIn only ever sees digests.
    for (const cred of this.store.rows('Credentials')) {
      const stored = cred.Password as string;
      if (stored !== UNREGISTERED_PASSWORD && !isSha256Hex(stored)) (cred as Row).Password = await sha256Hex(stored);
    }
    await this.seedDevMember();

    const council = this.store.rows('Council').find((c) => c.CouncilNumber === DEV_COUNCIL_NUMBER);
    if (!council) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER}`);
    const typeIds = Object.fromEntries(
      this.store.rows('MeetingType').map((t) => [t.Type as string, t.id]),
    ) as Record<DevMeetingTypeName, number>;
    for (const { meeting, invite } of buildDevMeetings(council.id as number, typeIds, this.now())) {
      this.insertMeeting(meeting, invite);
    }
    this.seedDevEvents(council.id as number);
    this.seedDevExtras(council.id as number);

    // Enables every donation method for the test council (Seed.sql has no CouncilDonationMethod rows).
    for (const { method, qrUrl } of DEV_COUNCIL_DONATION_METHODS) {
      const methodRow = this.store.rows('DonationMethod').find((m) => m.DonationMethod === method);
      if (!methodRow) throw new Error(`Seed.sql is missing donation method ${method}`);
      this.store.insert('CouncilDonationMethod', { CouncilID: council.id, DonationMethodID: methodRow.id, DonationMethodURL: qrUrl });
    }

    // Day-one leadership history: every seated officer gets an open term for the current fraternal year.
    for (const c of this.store.rows('Council')) this.backfillLeadershipHistory(this.store, c.id as number);
  }

  /**
   * A pre-provisioned member with a placeholder Credentials row, and (Sprint 6B Security) the published dev setup code
   * DEV_ENROLLMENT_CODE that auth.signUp now requires. Council activities come from Seed.sql.
   */
  private async seedDevMember(): Promise<void> {
    const council = this.store.rows('Council').find((c) => c.CouncilNumber === DEV_COUNCIL_NUMBER);
    const template = this.store.rows('Member').find((m) => m.CouncilID === council?.id);
    if (!council || !template) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER} with members`);
    const cred = this.store.insert('Credentials', {
      Username: DEV_UNREGISTERED_MEMBER.Email,
      Password: UNREGISTERED_PASSWORD,
    });
    const member = this.store.insert('Member', {
      ...DEV_UNREGISTERED_MEMBER,
      CouncilID: council.id,
      StatusID: this.activeStatusId(this.store),
      DegreeID: template.DegreeID,
      MemberTypeID: this.store.rows('MemberType').find((t) => t.Type === 'Member')?.id,
      CredentialID: cred.id,
    });
    this.store.insert('MemberEnrollmentToken', {
      MemberID: member.id,
      TokenHash: await sha256Hex(enrollmentCodeHashInput(DEV_ENROLLMENT_CODE)),
      CreatedAt: toTimestamp(this.now()),
      ExpiresAt: '9999-12-31 23:59:59',
    });
  }

  private seedDevEvents(councilId: number): void {
    const owner = this.store.rows('Member').find((m) => m.Email === 'testadmin@kofc.org');
    const category = this.store.rows('Category').find((c) => c.Category === 'Service');
    if (!owner || !category) throw new Error('Seed.sql is missing the test admin or the Service category');
    for (const { event, shifts } of buildDevEvents(this.now())) {
      const eventRow = this.store.insert('Event', { ...event, OwnerID: owner.id, CategoryID: category.id });
      this.store.insert('EventCouncils', { EventID: eventRow.id, CouncilID: councilId });
      for (const { shift, signedUp } of shifts) {
        const shiftRow = this.store.insert('Shift', {
          ...shift,
          EventID: eventRow.id,
          NumberVolunteersSignedUp: signedUp.length,
        });
        for (const email of signedUp) {
          const member = this.store.rows('Member').find((m) => m.Email === email);
          this.store.insert('EventSignup', { ShiftID: shiftRow.id, MemberID: member?.id, NoShow: 0 });
        }
      }
    }
  }

/** Extra councils, shared and historical events, no-show history and message threads for the new screens. */
  private seedDevExtras(ownCouncilId: number): void {
    const s = this.store;
    const affiliated = s.insert('Council', { ...DEV_AFFILIATED_COUNCIL });
    const unaffiliated = s.insert('Council', { ...DEV_UNAFFILIATED_COUNCIL });
    s.insert('AffiliatedCouncils', { PrimaryCouncilID: ownCouncilId, AffiliatedCouncilID: affiliated.id });
    const councilIds = { own: ownCouncilId, affiliated: affiliated.id as number, unaffiliated: unaffiliated.id as number };

    const memberId = (email: string) => s.rows('Member').find((m) => m.Email === email)?.id as number;
    const reasonId = (code: string) => s.rows('NoShowReason').find((r) => r.NoShowReasonCode === code)?.id as number;
    const ownerId = memberId('testadmin@kofc.org');
    const categoryId = s.rows('Category').find((c) => c.Category === 'Service')?.id as number;

    for (const { event, councils, shifts } of buildDevExtraEvents(this.now())) {
      const eventRow = s.insert('Event', { ...event, OwnerID: ownerId, CategoryID: categoryId });
      for (const c of councils) s.insert('EventCouncils', { EventID: eventRow.id, CouncilID: councilIds[c] });
      for (const { shift, signedUp, noShows } of shifts) {
        const shiftRow = s.insert('Shift', { ...shift, EventID: eventRow.id, NumberVolunteersSignedUp: signedUp.length });
        for (const email of signedUp) {
          const code = noShows?.[email];
          s.insert('EventSignup', {
            ShiftID: shiftRow.id,
            MemberID: memberId(email),
            NoShow: code ? 1 : 0,
            NoShowReasonID: code ? reasonId(code) : null,
          });
        }
      }
    }

    const { threads, messages } = buildDevMessaging();
    const stampAt = (hoursAgo: number) => toTimestamp(new Date(this.now().getTime() - hoursAgo * 3_600_000));
    const threadIds = new Map<string, number>();
    const messageIds = new Map<string, number>();
    for (const t of threads) {
      const row = s.insert('ChatThreads', { CouncilID: ownCouncilId, IsGroupChat: t.isGroup ? 1 : 0, CreatedAt: stampAt(72) });
      threadIds.set(t.key, row.id as number);
    }
    for (const m of messages) {
      const thread = threads.find((t) => t.key === m.thread)!;
      const row = s.insert('Messages', {
        ThreadID: threadIds.get(m.thread),
        SenderID: memberId(m.sender),
        ParentMessageID: m.parent ? (messageIds.get(m.parent) ?? null) : null,
        MessageText: m.text,
        IsDraft: m.draft ? 1 : 0,
        CreatedAt: stampAt(m.hoursAgo),
      });
      messageIds.set(m.key, row.id as number);
      if (!m.draft) {
        for (const email of thread.participants.filter((e) => e !== m.sender)) {
          s.insert('ReadReceipts', {
            MessageID: row.id,
            MemberID: memberId(email),
            ReadAt: m.readBy?.includes(email) ? stampAt(m.hoursAgo - 0.5) : null,
            IsFlagged: 0,
          });
        }
      }
      for (const a of m.attachments ?? []) {
        s.insert('MessageAttachments', {
          MessageID: row.id,
          Filename: a.Filename,
          FileType: a.FileType,
          StorageURL: `placeholder://attachments/${encodeURIComponent(a.Filename)}`,
          UploadedAt: stampAt(m.hoursAgo),
        });
      }
    }
  }

  /** Every public method starts here so callers never observe an unseeded store. */
  private async ready(): Promise<MemoryStore> {
    await this.init();
    return this.store;
  }

  // ---- auth --------------------------------------------------------------

  auth: DataService['auth'] = {
    signIn: async (username, password) => {
      const s = await this.ready();
      const cred = s.rows('Credentials').find((c) => lower(c.Username) === username.toLowerCase());
      if (!cred || !(await passwordMatches(cred.Password as string, password))) return null;
      const member = s.rows('Member').find((m) => m.CredentialID === cred.id);
      return member ? this.sessionFor(s, member, cred) : null;
    },

    signUp: async (email, password, enrollmentCode) => {
      assertPasswordAcceptable(password);
      const hash = await sha256Hex(password); // hash first: the check-and-write below must not span an await
      const codeHash = typeof enrollmentCode !== 'string' || enrollmentCode.trim() === '' ? null : await sha256Hex(enrollmentCodeHashInput(enrollmentCode));
      const s = await this.ready();
      const member = s.rows('Member').find((m) => lower(m.Email) === email.trim().toLowerCase());
      if (!member) {
        throw new BusinessRuleError(
          'MEMBER_NOT_FOUND',
          `No member record has the email ${email.trim()}. Contact your council admin to be added.`,
          { email },
        );
      }
      const cred = s.rows('Credentials').find((c) => c.id === member.CredentialID);
      if (!cred) {
        throw new BusinessRuleError(
          'CREDENTIALS_MISSING',
          `Member ${member.id} has no Credentials row (CredentialID ${member.CredentialID}).`,
          { memberId: member.id },
        );
      }
      if (cred.Password !== UNREGISTERED_PASSWORD) {
        throw new BusinessRuleError('ALREADY_REGISTERED', `${member.Email} has already registered. Sign in instead.`, {
          memberId: member.id,
        });
      }
      // Sprint 6B Security: the welcome email's setup code is mandatory - this member's, unspent and unexpired - and is
      // spent here; without it the registration is refused and nothing is written.
      if (codeHash === null) throw enrollmentCodeRequired();
      const token = s.rows('MemberEnrollmentToken').find((t) => t.MemberID === member.id && t.TokenHash === codeHash);
      if (!token || !isEnrollmentTokenUsable(token as unknown as { ExpiresAt: string; ConsumedAt: string | null }, this.now())) throw enrollmentCodeInvalid();
      nextOnboardingState(memberOnboardingState(cred.Password as string, true), 'register', member.id as number);
      (token as Row).ConsumedAt = toTimestamp(this.now());
      (cred as Row).Password = hash;
      (cred as Row).Username = member.Email;
      return this.sessionFor(s, member, cred);
    },

    requestPasswordReset: async (email) => {
      const s = await this.ready();
      const found = this.registeredMemberByEmail(s, email);
      if (!found) return; // the same answer for a stranger: the form must not reveal who is a member
      const { member } = found;
      const tokens = s.rows('PasswordResetToken').filter((t) => t.MemberID === member.id);
      const last = tokens.map((t) => t.CreatedAt as string).sort().at(-1);
      if (isResetRequestCoolingDown(last, this.now())) return;
      const code = formatResetCode(globalThis.crypto.getRandomValues(new Uint8Array(4)));
      const codeHash = await sha256Hex(resetCodeHashInput(member.id as number, code));
      const issuedAt = this.now();
      const expiresAt = resetCodeExpiry(issuedAt);
      // Only the newest code works: every earlier unspent one is retired.
      for (const t of s.rows('PasswordResetToken')) if (t.MemberID === member.id && t.ConsumedAt == null) (t as Row).ConsumedAt = toTimestamp(issuedAt);
      s.insert('PasswordResetToken', { MemberID: member.id, CodeHash: codeHash, CreatedAt: toTimestamp(issuedAt), ExpiresAt: expiresAt, FailedAttempts: 0 });
      try {
        const packet = buildPasswordResetEmail({ member: member as unknown as Member, code, expiresAt });
        await this.sendEmail(buildSendGridMailRequest(packet.email));
      } catch (err) {
        console.error('[notification] password reset email failed:', err);
      }
    },

    verifyPasswordResetCode: async (email, code) => {
      await this.liveResetToken(email, code);
    },

    resetPassword: async (email, code, newPassword) => {
      assertPasswordAcceptable(newPassword);
      const hash = await sha256Hex(newPassword); // hashed first: the check-and-write below must not span an await
      const { s, member, cred, token } = await this.liveResetToken(email, code);
      nextOnboardingState(memberOnboardingState(cred.Password as string, false), 'resetPassword', member.id as number);
      (token as Row).ConsumedAt = toTimestamp(this.now());
      (cred as Row).Password = hash;
      return this.sessionFor(s, member, cred);
    },
  };

  /** The member who registered with `email` (case-insensitive) and their credentials; null for anyone else. */
  private registeredMemberByEmail(s: MemoryStore, email: unknown): { member: Row; cred: Row } | null {
    const wanted = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const member = wanted ? s.rows('Member').find((m) => lower(m.Email) === wanted) : undefined;
    const cred = member ? s.rows('Credentials').find((c) => c.id === member.CredentialID) : undefined;
    if (!member || !cred || cred.Password === UNREGISTERED_PASSWORD) return null;
    return { member: member as Row, cred: cred as Row };
  }

  /**
   * The member's newest live reset token when `code` matches it; otherwise RESET_CODE_INVALID, and a wrong code counts
   * against the token (outside any transaction, so the count sticks). Ends without an await after the token is read, so
   * the caller's writes follow at once.
   */
  private async liveResetToken(email: unknown, code: unknown): Promise<{ s: MemoryStore; member: Row; cred: Row; token: Row }> {
    const digits = cleanResetCode(code);
    const s = await this.ready();
    const found = this.registeredMemberByEmail(s, email);
    if (!found || digits === null) throw resetCodeInvalid();
    const codeHash = await sha256Hex(resetCodeHashInput(found.member.id as number, digits));
    const token = s
      .rows('PasswordResetToken')
      .filter((t) => t.MemberID === found.member.id && t.ConsumedAt == null)
      .sort((a, b) => (b.id as number) - (a.id as number))[0];
    if (!token || !isResetTokenLive(token as unknown as { ExpiresAt: string; ConsumedAt: string | null; FailedAttempts: number }, this.now())) throw resetCodeInvalid();
    if (token.CodeHash !== codeHash) {
      (token as Row).FailedAttempts = (token.FailedAttempts as number) + 1;
      throw resetCodeInvalid();
    }
    return { s, member: found.member, cred: found.cred, token: token as Row };
  }

  private sessionFor(s: MemoryStore, member: Row, cred: Row): SessionUser {
    const type = s.rows('MemberType').find((t) => t.id === member.MemberTypeID);
    const roles = this.rolesFor(s, member.id as number);
    return {
      credentialId: cred.id as number,
      memberId: member.id as number,
      councilId: member.CouncilID as number,
      username: cred.Username as string,
      firstName: member.MemberFirstName as string,
      lastName: member.MemberLastName as string,
      memberType: type?.Type as SessionUser['memberType'],
      roles: roles.map((r) => r.Role),
      isOfficer: roles.some((r) => r.Officer === 1),
      isBudgetDirector: member.IsBudgetDirector === 1,
    };
  }

  // ---- lookups / councils / members -------------------------------------

  lookups: DataService['lookups'] = {
    list: async <T extends LookupTableName>(table: T): Promise<LookupRowMap[T][]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const s = await this.ready();
      return s.rows(table).map((r) => ({ ...r })) as unknown as LookupRowMap[T][];
    },

    create: async <T extends LookupTableName>(actorId: number, table: T, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const s = await this.ready();
      assertMayMaintainLookups(this.memberWriteActor(s, actorId), table);
      const cleaned = cleanLookupValues(table, values);
      return s.transaction(() => {
        assertLookupKeyUnique(table, s.rows(table), cleaned);
        return { ...s.insert(table, cleaned) } as unknown as LookupRowMap[T];
      });
    },

    update: async <T extends LookupTableName>(actorId: number, table: T, id: number, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const s = await this.ready();
      assertMayMaintainLookups(this.memberWriteActor(s, actorId), table);
      const cleaned = cleanLookupValues(table, values);
      const row = this.requireLookupRow(s, table, id);
      assertLookupNotProtected(table, row, cleaned);
      assertLookupKeyUnique(table, s.rows(table), cleaned, id);
      Object.assign(row, cleaned);
      return { ...row } as unknown as LookupRowMap[T];
    },

    remove: async (actorId, table, id) => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const s = await this.ready();
      assertMayMaintainLookups(this.memberWriteActor(s, actorId), table);
      const row = this.requireLookupRow(s, table, id);
      assertLookupNotProtected(table, row, null);
      assertLookupUnused(
        table,
        row,
        LOOKUP_META[table].references.map((ref) => ({
          ...ref,
          count: s.rows(ref.table).filter((r) => r[ref.column] === id).length,
        })),
      );
      s.remove(table, (r) => r.id === id);
    },

    listForMaintenance: async <T extends LookupTableName>(actorId: number, table: T): Promise<LookupRowMap[T][]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const s = await this.ready();
      assertMayMaintainLookups(this.memberWriteActor(s, actorId), table, 'view');
      return s.rows(table).map((r) => ({ ...r })) as unknown as LookupRowMap[T][];
    },

    listCouncilSpecific: async <T extends CouncilLookupTableName>(actorId: number, councilId: number, table: T) => {
      const s = await this.ready();
      this.assertMayManageCouncilLookups(s, actorId, councilId, table, `view the council's ${table} lookups`);
      return this.councilLookupRows(s, councilId, table);
    },

    saveCouncilSpecific: async <T extends CouncilLookupTableName>(actorId: number, councilId: number, table: T, records: unknown) => {
      const s = await this.ready();
      this.assertMayManageCouncilLookups(s, actorId, councilId, table, `change the council's ${table} lookups`);
      return s.transaction(() => {
        const plan = planCouncilLookupSave(table, councilId, s.rows(table).filter((r) => r.CouncilID === councilId), records);
        for (const values of [...plan.inserts, ...plan.updates.map((u) => u.values)]) {
          for (const fk of COUNCIL_LOOKUP_META[table].foreignKeys) this.assertRowExists(s, fk.table, values[fk.column] as number, fk.label);
        }
        for (const { id, values } of plan.updates) Object.assign(s.rows(table).find((r) => r.id === id)!, values);
        for (const values of plan.inserts) s.insert(table, { ...values, CouncilID: councilId });
        return this.councilLookupRows(s, councilId, table);
      });
    },

    removeCouncilSpecific: async (actorId, councilId, table, id) => {
      const s = await this.ready();
      this.assertMayManageCouncilLookups(s, actorId, councilId, table, `delete the council's ${table} lookups`);
      const row = s.rows(table).find((r) => r.id === id && r.CouncilID === councilId);
      if (!row) {
        throw new BusinessRuleError('RECORD_NOT_FOUND', `${table} ${id} does not exist in council ${councilId}.`, { table, id, councilId });
      }
      this.assertRecordUnused(s, table, row, String(row[COUNCIL_LOOKUP_META[table].keyField]));
      s.remove(table, (r) => r.id === id);
    },
  };

  /** Loads the actor, checks the council exists and applies assertMayManageCouncilLookups. */
  private assertMayManageCouncilLookups(s: MemoryStore, actorId: number, councilId: number, table: CouncilLookupTableName, action: string): void {
    if (!COUNCIL_LOOKUP_META[table]) throw new Error(`Unknown council lookup table: ${String(table)}`);
    const actor = this.memberWriteActor(s, actorId);
    this.assertCouncilsExist(s, [councilId]);
    assertMayManageCouncilLookups(actor, councilId, table, action);
  }

  private councilLookupRows<T extends CouncilLookupTableName>(s: MemoryStore, councilId: number, table: T): CouncilLookupRowMap[T][] {
    const rows = s.rows(table).filter((r) => r.CouncilID === councilId).map((r) => ({ ...r })) as unknown as CouncilLookupRowMap[T][];
    return sortCouncilLookupRows(table, rows);
  }

  private requireLookupRow(s: MemoryStore, table: LookupTableName, id: number): Row {
    const row = s.rows(table).find((r) => r.id === id);
    if (!row) {
      throw new BusinessRuleError('INVALID_INPUT', `${LOOKUP_META[table].label} ${id} does not exist.`, { table, id });
    }
    return row;
  }

  councils: DataService['councils'] = {
    list: async () => this.sortedCouncils(await this.ready()),
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Council').find((c) => c.id === id);
      return row ? ({ ...row } as unknown as Council) : null;
    },
    listAffiliated: async (councilId) => {
      const s = await this.ready();
      const linked = new Set<number>();
      for (const a of s.rows('AffiliatedCouncils')) {
        if (a.PrimaryCouncilID === councilId) linked.add(a.AffiliatedCouncilID as number);
        if (a.AffiliatedCouncilID === councilId) linked.add(a.PrimaryCouncilID as number);
      }
      linked.delete(councilId);
      return this.sortedCouncils(s).filter((c) => linked.has(c.id));
    },

    create: async (actorId, council) => {
      const s = await this.ready();
      assertMayMaintainCouncils(this.memberWriteActor(s, actorId), 'add councils');
      const clean = cleanCouncil(council);
      return s.transaction(() => {
        assertRecordValueUnique('Council', s.rows('Council'), 'CouncilNumber', clean.CouncilNumber, 'by another council');
        return { ...s.insert('Council', rowValues(COUNCIL_COLUMNS, clean)) } as unknown as Council;
      });
    },

    update: async (actorId, id, changes) => {
      const s = await this.ready();
      assertMayMaintainCouncils(this.memberWriteActor(s, actorId), `change council ${id}`);
      const row = this.requireRecord(s, 'Council', id);
      const clean = cleanCouncil(mergeRecordChanges<NewCouncil>(row, changes, COUNCIL_COLUMNS));
      assertRecordValueUnique('Council', s.rows('Council'), 'CouncilNumber', clean.CouncilNumber, 'by another council', id);
      Object.assign(row, rowValues(COUNCIL_COLUMNS, clean));
      return { ...row } as unknown as Council;
    },

    remove: async (actorId, id) => {
      const s = await this.ready();
      assertMayMaintainCouncils(this.memberWriteActor(s, actorId), `delete council ${id}`);
      const row = this.requireRecord(s, 'Council', id);
      this.assertRecordUnused(s, 'Council', row, `${String(row.CouncilNumber)} ${String(row.CouncilName)}`);
      s.remove('Council', (r) => r.id === id);
    },

    setFeatureFlags: async (actorId, councilId, changes) => {
      const s = await this.ready();
      assertMayMaintainCouncils(this.memberWriteActor(s, actorId), `change the feature flags of council ${councilId}`);
      const row = this.requireRecord(s, 'Council', councilId);
      Object.assign(row, cleanFeatureFlagChanges(changes));
      return { ...row } as unknown as Council;
    },

    setBylaws: async (actorId, councilId, markdown) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Council', councilId);
      assertMayEditBylaws(actor, councilId);
      Object.assign(row, { BylawsMarkdown: cleanBylawsText(markdown), BylawsUpdatedAt: new Date().toISOString() });
      return { ...row } as unknown as Council;
    },

    setEmailGateway: async (actorId, councilId, settings) => {
      const s = await this.ready();
      assertMayMaintainCouncilRecords(this.memberWriteActor(s, actorId), councilId, 'configure the email gateway');
      const row = this.requireRecord(s, 'Council', councilId);
      Object.assign(row, settings === null ? CLEARED_EMAIL_GATEWAY : cleanEmailGatewaySettings(settings));
      return { ...row } as unknown as Council;
    },

    setDuesRate: async (actorId, councilId, rate) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Council', councilId);
      assertMayEditDuesRate(actor, councilId);
      row.base_dues_rate = cleanDuesRate(rate);
      return { ...row } as unknown as Council;
    },

    setGlobalParameters: async (actorId, councilId, parameters) => {
      const clean = cleanGlobalCouncilParameters(parameters);
      const s = await this.ready();
      assertMayMaintainCouncils(this.memberWriteActor(s, actorId), `change the global parameters of council ${councilId}`);
      const row = this.requireRecord(s, 'Council', councilId);
      Object.assign(row, clean);
      return { ...row } as unknown as Council;
    },
  };

  // ---- council-level maintenance: parishes, pastors, activities, lists ----

  parishes: DataService['parishes'] = {
    listByCouncil: async (councilId) => {
      const s = await this.ready();
      return this.sortedParishes(s, (p) => p.CouncilID === councilId);
    },

    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Parish').find((p) => p.id === id);
      return row ? ({ ...row } as unknown as Parish) : null;
    },

    create: async (actorId, parish) => {
      const clean = cleanParish(parish);
      const s = await this.ready();
      assertMayMaintainCouncilRecords(this.memberWriteActor(s, actorId), clean.CouncilID, 'add parishes');
      return s.transaction(() => {
        this.assertCouncilsExist(s, [clean.CouncilID]);
        this.assertParishNameUnique(s, clean);
        return { ...s.insert('Parish', rowValues(PARISH_COLUMNS, clean)) } as unknown as Parish;
      });
    },

    update: async (actorId, id, changes) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Parish', id);
      assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `change parish ${id}`);
      const clean = cleanParish(mergeRecordChanges<NewParish>(row, changes, PARISH_COLUMNS));
      if (clean.CouncilID !== row.CouncilID) {
        assertMayMaintainCouncilRecords(actor, clean.CouncilID, `move parish ${id}`);
        this.assertCouncilsExist(s, [clean.CouncilID]);
      }
      this.assertParishNameUnique(s, clean, id);
      Object.assign(row, rowValues(PARISH_COLUMNS, clean));
      return { ...row } as unknown as Parish;
    },

    remove: async (actorId, id) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Parish', id);
      assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `delete parish ${id}`);
      this.assertRecordUnused(s, 'Parish', row, String(row.Name));
      s.remove('Parish', (r) => r.id === id);
    },
  };

  private sortedParishes(s: MemoryStore, keep: (row: Row) => boolean): Parish[] {
    const rows = s.rows('Parish').filter(keep).map((r) => ({ ...r })) as unknown as Parish[];
    return rows.sort((a, b) => a.Name.localeCompare(b.Name) || a.id - b.id);
  }

  private assertParishNameUnique(s: MemoryStore, clean: NewParish, ignoreId?: number): void {
    const siblings = s.rows('Parish').filter((p) => p.CouncilID === clean.CouncilID);
    assertRecordValueUnique('Parish', siblings, 'Name', clean.Name, `in council ${clean.CouncilID}`, ignoreId);
  }

  pastors: DataService['pastors'] = {
    listByParish: async (parishId) => {
      const s = await this.ready();
      return this.sortedPastors(s, [parishId]);
    },

    listByCouncil: async (councilId) => {
      const s = await this.ready();
      const parishIds = s.rows('Parish').filter((p) => p.CouncilID === councilId).map((p) => p.id as number);
      return this.sortedPastors(s, parishIds);
    },

    create: async (actorId, pastor) => {
      const clean = cleanPastor(pastor);
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const parish = s.rows('Parish').find((p) => p.id === clean.ParishID);
      // A non-admin hears ADMIN_REQUIRED even for an unknown parish; the parish only decides the tenant.
      assertMayMaintainCouncilRecords(actor, (parish?.CouncilID as number | undefined) ?? actor.councilId, 'add pastors');
      if (!parish) throw noParish(clean.ParishID);
      return { ...s.insert('Pastor', rowValues(PASTOR_COLUMNS, clean)) } as unknown as Pastor;
    },

    update: async (actorId, id, changes) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Pastor', id);
      assertMayMaintainCouncilRecords(actor, this.parishCouncilId(s, row.ParishID as number), `change pastor ${id}`);
      const clean = cleanPastor(mergeRecordChanges<NewPastor>(row, changes, PASTOR_COLUMNS));
      if (clean.ParishID !== row.ParishID) {
        const parish = s.rows('Parish').find((p) => p.id === clean.ParishID);
        assertMayMaintainCouncilRecords(actor, (parish?.CouncilID as number | undefined) ?? actor.councilId, `move pastor ${id}`);
        if (!parish) throw noParish(clean.ParishID);
      }
      Object.assign(row, rowValues(PASTOR_COLUMNS, clean));
      return { ...row } as unknown as Pastor;
    },

    remove: async (actorId, id) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Pastor', id);
      assertMayMaintainCouncilRecords(actor, this.parishCouncilId(s, row.ParishID as number), `delete pastor ${id}`);
      s.remove('Pastor', (r) => r.id === id);
    },
  };

  private sortedPastors(s: MemoryStore, parishIds: readonly number[]): Pastor[] {
    const rows = s
      .rows('Pastor')
      .filter((p) => parishIds.includes(p.ParishID as number))
      .map((p) => ({ ...p })) as unknown as Pastor[];
    return rows.sort((a, b) => a.LastName.localeCompare(b.LastName) || a.FirstName.localeCompare(b.FirstName) || a.id - b.id);
  }

  private parishCouncilId(s: MemoryStore, parishId: number): number {
    return s.rows('Parish').find((p) => p.id === parishId)?.CouncilID as number;
  }

  private sortedCouncils(s: MemoryStore): Council[] {
    const rows = s.rows('Council').map((r) => ({ ...r })) as unknown as Council[];
    return rows.sort((a, b) => a.CouncilNumber - b.CouncilNumber || a.CouncilName.localeCompare(b.CouncilName));
  }

  activities: DataService['activities'] = {
    listByCouncil: async (councilId) => {
      const s = await this.ready();
      const rows = s
        .rows('Activities')
        .filter((a) => a.CouncilID === councilId)
        .map((a) => ({ ...a })) as unknown as Activities[];
      return rows.sort((a, b) => a.ActivityName.localeCompare(b.ActivityName) || a.id - b.id);
    },

    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Activities').find((a) => a.id === id);
      return row ? ({ ...row } as unknown as Activities) : null;
    },

    create: async (actorId, activity) => {
      const clean = cleanActivity(activity);
      const s = await this.ready();
      assertMayMaintainCouncilRecords(this.memberWriteActor(s, actorId), clean.CouncilID, 'add activities');
      return s.transaction(() => {
        this.assertActivityReferences(s, clean);
        this.assertActivityNameUnique(s, clean);
        return { ...s.insert('Activities', rowValues(ACTIVITY_COLUMNS, clean)) } as unknown as Activities;
      });
    },

    update: async (actorId, id, changes) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Activities', id);
      assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `change activity ${id}`);
      const clean = cleanActivity(mergeRecordChanges<NewActivity>(row, changes, ACTIVITY_COLUMNS));
      if (clean.CouncilID !== row.CouncilID) assertMayMaintainCouncilRecords(actor, clean.CouncilID, `move activity ${id}`);
      this.assertActivityReferences(s, clean);
      this.assertActivityNameUnique(s, clean, id);
      Object.assign(row, rowValues(ACTIVITY_COLUMNS, clean));
      return { ...row } as unknown as Activities;
    },

    remove: async (actorId, id) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.requireRecord(s, 'Activities', id);
      assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `delete activity ${id}`);
      this.assertRecordUnused(s, 'Activities', row, String(row.ActivityName));
      s.remove('Activities', (r) => r.id === id);
    },

    listSummaries: async (councilId) => {
      const activities = await this.activities.listByCouncil(councilId);
      const s = await this.ready();
      const ids = new Set(activities.map((a) => a.id));
      return summarizeActivities(activities, s.rows('ActivityTime').filter((t) => ids.has(t.ActivityID as number)) as unknown as ActivityTime[]);
    },
  };

  private assertActivityReferences(s: MemoryStore, clean: NewActivity): void {
    this.assertCouncilsExist(s, [clean.CouncilID]);
    this.assertRowExists(s, 'Category', clean.CategoryID, 'activity category');
  }

  private assertActivityNameUnique(s: MemoryStore, clean: NewActivity, ignoreId?: number): void {
    const siblings = s.rows('Activities').filter((a) => a.CouncilID === clean.CouncilID);
    assertRecordValueUnique('Activities', siblings, 'ActivityName', clean.ActivityName, `in council ${clean.CouncilID}`, ignoreId);
  }

  distributionLists: DataService['distributionLists'] = {
    listByCouncil: async (councilId) => {
      const s = await this.ready();
      return this.sortedLists(s, (l) => l.CouncilID === councilId && isCouncilWideList(l));
    },

    listForMember: async (actorId, councilId) => {
      const s = await this.ready();
      this.requireMember(s, actorId);
      return this.sortedLists(s, (l) => l.CouncilID === councilId && isListVisibleTo(l, actorId));
    },

    create: async (actorId, list) => {
      const clean = cleanNewDistributionList(list);
      const councilWide = clean.IsCouncilWide ?? false;
      const s = await this.ready();
      assertMayCreateDistributionList(this.memberWriteActor(s, actorId), clean.CouncilID, councilWide);
      const row = s.transaction(() => {
        this.assertCouncilsExist(s, [clean.CouncilID]);
        this.assertListNameUnique(s, clean.CouncilID, clean.ListName, councilWide, actorId);
        this.assertListMembers(s, clean.CouncilID, clean.memberIds);
        const created = s.insert('DistributionLists', {
          ListName: clean.ListName,
          CouncilID: clean.CouncilID,
          CreatedBy: actorId,
          IsCouncilWide: councilWide ? 1 : 0,
        });
        for (const memberId of clean.memberIds) s.insert('DistributionListMembers', { ListID: created.id, MemberID: memberId });
        return created;
      });
      return this.listSummary(s, row);
    },

    update: async (actorId, id, changes) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const row = this.storedList(s, id);
      const clean = cleanDistributionListChanges(changes);
      assertMayChangeDistributionList(actor, row, `change distribution list ${id}`, clean.IsCouncilWide);
      const saved = s.transaction(() => {
        // Inside a transaction the store works on copied rows, so change the copy, not `row`.
        const current = this.requireRecord(s, 'DistributionLists', id);
        const councilWide = clean.IsCouncilWide ?? row.IsCouncilWide;
        if (clean.ListName !== undefined || clean.IsCouncilWide !== undefined) {
          this.assertListNameUnique(s, row.CouncilID, clean.ListName ?? String(current.ListName ?? ''), councilWide, row.CreatedBy ?? actorId, id);
        }
        if (clean.ListName !== undefined) current.ListName = clean.ListName;
        if (clean.IsCouncilWide !== undefined) current.IsCouncilWide = clean.IsCouncilWide ? 1 : 0;
        if (clean.memberIds !== undefined) {
          this.assertListMembers(s, row.CouncilID, clean.memberIds);
          s.remove('DistributionListMembers', (m) => m.ListID === id);
          for (const memberId of clean.memberIds) s.insert('DistributionListMembers', { ListID: id, MemberID: memberId });
        }
        return current;
      });
      return this.listSummary(s, saved);
    },

    remove: async (actorId, id) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      assertMayChangeDistributionList(actor, this.storedList(s, id), `delete distribution list ${id}`);
      s.transaction(() => {
        s.remove('DistributionListMembers', (m) => m.ListID === id);
        s.remove('DistributionLists', (l) => l.id === id);
      });
    },
  };

  private sortedLists(s: MemoryStore, keep: (row: Row) => boolean): DistributionListSummary[] {
    return s
      .rows('DistributionLists')
      .filter(keep)
      .map((l) => this.listSummary(s, l))
      .sort((a, b) => (a.list.ListName ?? '').localeCompare(b.list.ListName ?? '') || a.list.id - b.list.id);
  }

  /** A list as the access rules read it; an unknown id rejects RECORD_NOT_FOUND. */
  private storedList(s: MemoryStore, id: number): { id: number; CouncilID: number; CreatedBy: number | null; IsCouncilWide: boolean } {
    const row = s.rows('DistributionLists').find((l) => l.id === id);
    if (!row) throw distributionListNotFound(id);
    return { id, CouncilID: (row.CouncilID as number | null) ?? 0, CreatedBy: (row.CreatedBy as number | null) ?? null, IsCouncilWide: isCouncilWideList(row) };
  }

  private listSummary(s: MemoryStore, row: Row): DistributionListSummary {
    const memberIds = s
      .rows('DistributionListMembers')
      .filter((m) => m.ListID === row.id)
      .map((m) => m.MemberID as number)
      .sort((a, b) => a - b);
    return { list: { ...row } as unknown as DistributionLists, memberIds };
  }

  /** A council-wide list's name is unique among the council's council-wide lists; a private one among its creator's. */
  private assertListNameUnique(s: MemoryStore, councilId: number, name: string, councilWide: boolean, ownerId: number, ignoreId?: number): void {
    const siblings = distributionListNameSiblings(s.rows('DistributionLists'), councilId, councilWide, ownerId);
    assertRecordValueUnique('DistributionLists', siblings, 'ListName', name, councilWide ? `among council ${councilId}'s lists` : 'among your private lists', ignoreId);
  }

  /** Every list member must exist and belong to the list's council. */
  private assertListMembers(s: MemoryStore, councilId: number, memberIds: readonly number[]): void {
    for (const memberId of memberIds) {
      const member = s.rows('Member').find((m) => m.id === memberId);
      if (!member || member.CouncilID !== councilId) {
        throw new BusinessRuleError(
          'INVALID_INPUT',
          member
            ? `Member ${memberId} belongs to council ${String(member.CouncilID)}, not council ${councilId}; a distribution list holds only its own council's members.`
            : `No member with id ${memberId}.`,
          { memberId, councilId },
        );
      }
    }
  }

  // ---- maintenance helpers ------------------------------------------------

  private requireRecord(s: MemoryStore, table: MaintainedTable, id: number): Row {
    const row = s.rows(table).find((r) => r.id === id);
    if (!row) throw recordNotFound(table, id);
    return row;
  }

  private assertRecordUnused(s: MemoryStore, table: MaintainedTable, row: Row, name: string): void {
    assertRecordUnused(
      table,
      row.id as number,
      name,
      RECORD_REFERENCES[table].map((ref) => ({ ...ref, count: s.rows(ref.table).filter((r) => r[ref.column] === row.id).length })),
    );
  }

  members: DataService['members'] = {
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Member').find((m) => m.id === id);
      return row ? (withoutPushToken({ ...row }) as unknown as Member) : null;
    },
    getByEmail: async (email) => {
      const s = await this.ready();
      const row = s.rows('Member').find((m) => lower(m.Email) === email.toLowerCase());
      return row ? (withoutPushToken({ ...row }) as unknown as Member) : null;
    },
    listByCouncil: async (councilId, options) => {
      const s = await this.ready();
      const activeId = options?.activeOnly ? this.activeStatusId(s) : null;
      const rows = s
        .rows('Member')
        .filter((m) => m.CouncilID === councilId && (activeId === null || m.StatusID === activeId))
        .map((m) => withoutPushToken({ ...m })) as unknown as Member[];
      return rows.sort(
        (a, b) => a.MemberLastName.localeCompare(b.MemberLastName) || a.MemberFirstName.localeCompare(b.MemberFirstName),
      );
    },
    listRoles: async (memberId) => this.rolesFor(await this.ready(), memberId),

    create: async (actorId, member) => {
      const clean = cleanNewMember(member, this.now());
      const s = await this.ready();
      const row = s.transaction(() => {
        assertMayCreateMember(this.memberWriteActor(s, actorId), clean, this.memberTypeName(s, clean.MemberTypeID));
        this.assertMemberReferences(s, clean);
        const email = clean.Email.toLowerCase();
        if (s.rows('Member').some((m) => lower(m.Email) === email) || s.rows('Credentials').some((c) => lower(c.Username) === email)) {
          throw new BusinessRuleError('INVALID_INPUT', `The email ${clean.Email} already belongs to a member or login.`, {
            email: clean.Email,
          });
        }
        const cred = s.insert('Credentials', { Username: clean.Email, Password: UNREGISTERED_PASSWORD });
        const values: Record<string, SeedValue | undefined> = { CredentialID: cred.id };
        for (const c of MEMBER_COLUMNS) values[c] = clean[c] ?? null;
        return s.insert('Member', values);
      });
      const created = withoutPushToken({ ...row }) as unknown as Member;
      await this.sendWelcomeEmail(s, created);
      return created;
    },

    resendWelcome: async (actorId, memberId) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const member = this.requireMember(s, memberId);
      assertMayImportSupremeRoster(actor, member.CouncilID as number, `send member ${memberId} a new setup code`);
      const cred = s.rows('Credentials').find((c) => c.id === member.CredentialID);
      if (cred && cred.Password !== UNREGISTERED_PASSWORD) {
        throw new BusinessRuleError('ALREADY_REGISTERED', `${member.Email as string} has already registered; they can reset their password instead.`, { memberId });
      }
      await this.sendWelcomeEmail(s, withoutPushToken({ ...member }) as unknown as Member);
    },

    update: async (actorId, id, changes) => {
      const s = await this.ready();
      const row = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const existing = this.requireMember(s, id);
        const clean = mergeMemberChanges(existing as unknown as Member, changes, this.now());
        assertMayUpdateMember(actor, existing as unknown as Member, clean, {
          current: this.memberTypeName(s, existing.MemberTypeID as number),
          next: this.memberTypeName(s, clean.MemberTypeID),
        });
        this.assertMemberReferences(s, clean);
        const email = clean.Email.toLowerCase();
        if (
          s.rows('Member').some((m) => m.id !== id && lower(m.Email) === email) ||
          s.rows('Credentials').some((c) => c.id !== existing.CredentialID && lower(c.Username) === email)
        ) {
          throw new BusinessRuleError('INVALID_INPUT', `The email ${clean.Email} already belongs to a member or login.`, {
            email: clean.Email,
          });
        }
        const credential = s.rows('Credentials').find((c) => c.id === existing.CredentialID);
        if (credential) credential.Username = clean.Email;
        for (const c of MEMBER_COLUMNS) existing[c] = clean[c] ?? null;
        return existing;
      });
      return withoutPushToken({ ...row }) as unknown as Member;
    },
  };

  /** The caller of a member write, read from the store so the client cannot claim a type it does not hold. */
  private memberWriteActor(s: MemoryStore, actorId: number): MemberWriteActor {
    const actor = this.requireMember(s, actorId);
    const roles = this.rolesFor(s, actorId);
    return {
      memberId: actorId,
      councilId: actor.CouncilID as number,
      memberType: this.memberTypeName(s, actor.MemberTypeID as number),
      active: actor.StatusID === this.activeStatusId(s),
      roles: roles.map((r) => r.Role),
      budgetDirector: actor.IsBudgetDirector === 1,
      officer: roles.some((r) => r.Officer === 1),
    };
  }

  private memberTypeName(s: MemoryStore, typeId: number): string | undefined {
    return s.rows('MemberType').find((t) => t.id === typeId)?.Type as string | undefined;
  }

  /** The council and lookup ids a member row points at must exist. */
  private assertMemberReferences(s: MemoryStore, clean: NewMember): void {
    this.assertCouncilsExist(s, [clean.CouncilID]);
    this.assertRowExists(s, 'MemberStatus', clean.StatusID, 'member status');
    this.assertRowExists(s, 'Degree', clean.DegreeID, 'degree');
    this.assertRowExists(s, 'MemberType', clean.MemberTypeID, 'member type');
    if (clean.WorkingStatusID != null) this.assertRowExists(s, 'WorkingStatus', clean.WorkingStatusID, 'working status');
  }

  /**
   * The post-insert hook after members.create or supreme.syncSupremeRoster stores a member: issues their one-time setup
   * code (only its hash is kept), compiles the welcome email and sends it as a SendGrid request (sendEmail).
   */
  private async sendWelcomeEmail(s: MemoryStore, member: Member): Promise<void> {
    try {
      const code = formatEnrollmentCode(globalThis.crypto.getRandomValues(new Uint8Array(20)));
      const issuedAt = this.now();
      const expiresAt = enrollmentCodeExpiry(issuedAt);
      s.insert('MemberEnrollmentToken', {
        MemberID: member.id,
        TokenHash: await sha256Hex(enrollmentCodeHashInput(code)),
        CreatedAt: toTimestamp(issuedAt),
        ExpiresAt: expiresAt,
      });
      const council = { ...s.rows('Council').find((c) => c.id === member.CouncilID)! } as unknown as Council;
      const activeId = this.activeStatusId(s);
      const adminType = s.rows('MemberType').find((t) => t.Type === 'Admin')?.id;
      const admin = (s.rows('Member').filter(
        (m) => m.CouncilID === member.CouncilID && m.id !== member.id && m.StatusID === activeId && m.MemberTypeID === adminType,
      ) as unknown as Member[]).sort(
        (a, b) =>
          a.MemberLastName.localeCompare(b.MemberLastName) || a.MemberFirstName.localeCompare(b.MemberFirstName) || a.id - b.id,
      )[0];
      const details = admin
        ? { name: `${admin.MemberFirstName} ${admin.MemberLastName}`, email: admin.Email, phone: admin.Phone }
        : null;
      const packet = buildWelcomeEmail({ member, council, admin: details, enrollment: { code, expiresAt } });
      await this.sendEmail(buildSendGridMailRequest(packet.email));
    } catch (err) {
      // The member is already saved; a failed notification must not undo or fail that.
      console.error('[notification] welcome email failed:', err);
    }
  }

  /** Friendly INVALID_INPUT for a foreign key the generic constraint message would explain poorly. */
  private assertRowExists(s: MemoryStore, table: string, id: number, label: string): void {
    if (!s.rows(table).some((r) => r.id === id)) {
      throw new BusinessRuleError('INVALID_INPUT', `No ${label} with id ${id}.`, { table, id });
    }
  }

  // ---- Phase 2: member profiles, skill messaging, donations -------------

  memberProfiles: DataService['memberProfiles'] = {
    listOptions: async () => {
      const s = await this.ready();
      const copy = <T>(table: string) => s.rows(table).map((r) => ({ ...r })) as unknown as T[];
      const byId = <T extends { id: number }>(rows: T[]) => rows.sort((a, b) => a.id - b.id);
      const options: ProfileOptions = {
        skills: copy<Skill>('Skill').sort((a, b) => a.SkillName.localeCompare(b.SkillName) || a.id - b.id),
        skillLevels: byId(copy<SkillLevel>('SkillLevel')),
        trainingClasses: copy<KOCTrainingClasses>('KOCTrainingClasses').sort((a, b) => a.ClassName.localeCompare(b.ClassName) || a.id - b.id),
        workingStatuses: byId(copy<WorkingStatus>('WorkingStatus')),
      };
      return options;
    },

    getExtensions: async (memberId) => {
      const s = await this.ready();
      this.requireMember(s, memberId);
      return this.extensionsOf(s, memberId);
    },

    updateExtensions: async (actorId, memberId, skills, training, workingStatusId) => {
      const clean = cleanMemberExtensions(skills, training, workingStatusId, this.now());
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const member = this.requireMember(s, memberId);
        assertMayEditMemberExtensions(actor, member as unknown as Member);
        for (const sk of clean.skills) {
          this.assertRowExists(s, 'Skill', sk.skillId, 'skill');
          this.assertRowExists(s, 'SkillLevel', sk.skillLevelId, 'skill level');
        }
        for (const t of clean.training) this.assertRowExists(s, 'KOCTrainingClasses', t.trainingClassId, 'training class');
        if (clean.workingStatusId !== null) this.assertRowExists(s, 'WorkingStatus', clean.workingStatusId, 'working status');

        s.remove('MemberSkill', (r) => r.MemberID === memberId);
        for (const sk of clean.skills) {
          s.insert('MemberSkill', { SkillID: sk.skillId, SkillLevelID: sk.skillLevelId, MemberID: memberId });
        }
        s.remove('MemberTraining', (r) => r.MemberID === memberId);
        for (const t of clean.training) {
          s.insert('MemberTraining', { MemberID: memberId, TrainingClassID: t.trainingClassId, YearTaken: trainingYearToDate(t.year) });
        }
        (member as Row).WorkingStatusID = clean.workingStatusId;
      });
      return this.extensionsOf(s, memberId);
    },
  };

  private extensionsOf(s: MemoryStore, memberId: number): MemberExtensions {
    const find = <T>(table: string, id: unknown) => ({ ...s.rows(table).find((r) => r.id === id)! }) as unknown as T;
    const member = s.rows('Member').find((m) => m.id === memberId)!;
    const skills = (s.rows('MemberSkill').filter((r) => r.MemberID === memberId).map((r) => ({ ...r })) as unknown as MemberSkill[]).sort(
      (a, b) => a.id - b.id,
    );
    const training = (
      s.rows('MemberTraining').filter((r) => r.MemberID === memberId).map((r) => ({ ...r })) as unknown as MemberTraining[]
    ).sort((a, b) => b.YearTaken.localeCompare(a.YearTaken) || a.id - b.id);
    return {
      workingStatus: member.WorkingStatusID == null ? null : find<WorkingStatus>('WorkingStatus', member.WorkingStatusID),
      skills: skills.map((row) => ({ row, skill: find<Skill>('Skill', row.SkillID), level: find<SkillLevel>('SkillLevel', row.SkillLevelID) })),
      training: training.map((row) => ({
        row,
        trainingClass: find<KOCTrainingClasses>('KOCTrainingClasses', row.TrainingClassID),
        year: trainingDateToYear(row.YearTaken),
      })),
    };
  }

  communication: DataService['communication'] = {
    listCouncilSkills: async (councilId) => {
      const s = await this.ready();
      const out: CouncilSkillEntry[] = [];
      for (const ms of s.rows('MemberSkill')) {
        const m = s.rows('Member').find((r) => r.id === ms.MemberID);
        const skill = s.rows('Skill').find((r) => r.id === ms.SkillID);
        const level = s.rows('SkillLevel').find((r) => r.id === ms.SkillLevelID);
        if (!m || !skill || !level || m.CouncilID !== councilId) continue;
        out.push({
          memberId: m.id as number,
          firstName: m.MemberFirstName as string,
          lastName: m.MemberLastName as string,
          phone: m.Phone as string,
          email: m.Email as string,
          skill: { ...skill } as unknown as Skill,
          level: { ...level } as unknown as SkillLevel,
        });
      }
      return out.sort(
        (a, b) =>
          a.skill.SkillName.localeCompare(b.skill.SkillName) ||
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.memberId - b.memberId,
      );
    },

    sendBulkToSkills: async (councilId, skillId, messageText, senderId) => {
      assertText(messageText, 'Message', 10_000);
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      const skill = s.rows('Skill').find((r) => r.id === skillId);
      if (!skill) throw new BusinessRuleError('INVALID_INPUT', `No skill with id ${skillId}.`, { skillId });
      const activeId = this.activeStatusId(s);
      const holders = new Set(s.rows('MemberSkill').filter((r) => r.SkillID === skillId).map((r) => r.MemberID));
      const recipientIds = s
        .rows('Member')
        .filter((m) => m.CouncilID === councilId && m.StatusID === activeId && m.id !== senderId && holders.has(m.id))
        .map((m) => m.id as number)
        .sort((a, b) => a - b);
      if (recipientIds.length === 0) {
        throw new BusinessRuleError(
          'NO_RECIPIENTS',
          `No other active member of council ${councilId} has the skill "${skill.SkillName}", so there is nobody to message.`,
          { councilId, skillId },
        );
      }
      const message = await this.messages.send({ senderId, councilId, recipientIds, text: messageText });
      return { message, recipientIds };
    },
  };

  donations: DataService['donations'] = {
    listMethods: async (councilId) => {
      const s = await this.ready();
      const out = [];
      for (const link of s.rows('CouncilDonationMethod').filter((r) => r.CouncilID === councilId)) {
        const method = s.rows('DonationMethod').find((m) => m.id === link.DonationMethodID)!;
        out.push({
          method: { id: method.id as number, DonationMethod: method.DonationMethod as string },
          kind: donationMethodKind(method.DonationMethod as string),
          link: { ...link } as unknown as CouncilDonationMethod,
          qrCodeUrl: (link.DonationMethodURL as string | null) || null,
        });
      }
      return out.sort((a, b) => a.method.id - b.method.id || a.link.id - b.link.id);
    },

    listAllMethods: async () => {
      const s = await this.ready();
      return (s.rows('DonationMethod').map((m) => ({ ...m })) as unknown as DonationMethod[]).sort((a, b) => a.id - b.id);
    },

    listTypes: async (councilId) => {
      const s = await this.ready();
      return (s.rows('DonationType').filter((t) => t.CouncilID === councilId).map((t) => ({ ...t })) as unknown as DonationType[]).sort(
        (a, b) => a.DonationType.localeCompare(b.DonationType) || a.id - b.id,
      );
    },

    list: async (councilId, options) => {
      const s = await this.ready();
      const rows = s
        .rows('Donation')
        .filter((d) => d.CouncilID === councilId && (options?.eventId === undefined || d.EventID === options.eventId))
        .map((d) => ({ ...d })) as unknown as Donation[];
      return rows.sort((a, b) => b.DonationDate.localeCompare(a.DonationDate) || b.id - a.id);
    },

    listHistory: async (councilId, eventId) => {
      const s = await this.ready();
      let events: CouncilEvent[];
      if (eventId === undefined) {
        const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
        events = s.rows('Event').filter((e) => linked.has(e.id)).map((e) => ({ ...e })) as unknown as CouncilEvent[];
      } else {
        const event = { ...this.requireEvent(s, eventId) } as unknown as CouncilEvent;
        this.assertEventLinked(s, event, councilId);
        events = [event];
      }
      const eventIds = new Set(events.map((e) => e.id));
      const donations = s
        .rows('Donation')
        .filter((d) => (d.EventID == null ? d.CouncilID === councilId : eventIds.has(d.EventID as number)))
        .map((d) => ({ ...d })) as unknown as Donation[];
      const names = new Map(s.rows('Member').map((m) => [m.id as number, `${m.MemberFirstName} ${m.MemberLastName}`]));
      return buildDonationHistory(councilId, eventId, {
        donations,
        events,
        methods: s.rows('DonationMethod').map((m) => ({ ...m })) as unknown as DonationMethod[],
        types: s.rows('DonationType').map((t) => ({ ...t })) as unknown as DonationType[],
        names,
      });
    },

    record: async (actorId, donation) => {
      const clean = cleanNewDonation(donation, this.now());
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, actorId);
        this.assertDonationReferences(s, clean);
        return this.withFundsSync(s, [clean.EventID], () => ({ ...s.insert('Donation', { ...clean, RecordedBy: actorId }) }) as unknown as Donation);
      });
    },

    update: async (actorId, id, changes) => {
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const row = this.requireDonation(s, id);
        const existing = { ...row } as unknown as Donation;
        assertMayChangeDonation(actor, existing, this.eventOwnerOf(s, existing.EventID), `change donation ${id}`);
        const clean = mergeDonationChanges(existing, changes, this.now());
        if ((clean.EventID ?? null) !== (existing.EventID ?? null)) {
          assertMayChangeDonation(actor, existing, this.eventOwnerOf(s, clean.EventID), `move donation ${id} to another event`);
        }
        this.assertDonationReferences(s, clean);
        return this.withFundsSync(s, [existing.EventID, clean.EventID], () => {
          Object.assign(row, clean);
          return { ...row } as unknown as Donation;
        });
      });
    },

    remove: async (actorId, id) => {
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const existing = { ...this.requireDonation(s, id) } as unknown as Donation;
        assertMayChangeDonation(actor, existing, this.eventOwnerOf(s, existing.EventID), `delete donation ${id}`);
        this.withFundsSync(s, [existing.EventID], () => s.remove('Donation', (r) => r.id === id));
      });
    },
  };

  /** The ids a donation points at must exist and belong together (method enabled, the council's type and event). */
  private assertDonationReferences(s: MemoryStore, clean: CleanDonation): void {
    this.assertCouncilsExist(s, [clean.CouncilID]);
    const method = s.rows('DonationMethod').find((m) => m.id === clean.DonationMethodID);
    if (!method) {
      throw new BusinessRuleError('INVALID_INPUT', `No donation method with id ${clean.DonationMethodID}.`, {
        donationMethodId: clean.DonationMethodID,
      });
    }
    if (!s.rows('CouncilDonationMethod').some((r) => r.CouncilID === clean.CouncilID && r.DonationMethodID === clean.DonationMethodID)) {
      throw new BusinessRuleError(
        'DONATION_METHOD_NOT_ENABLED',
        `Council ${clean.CouncilID} has not enabled ${method.DonationMethod} donations.`,
        { councilId: clean.CouncilID, donationMethodId: clean.DonationMethodID },
      );
    }
    assertDonationFitsMethod(donationMethodKind(method.DonationMethod as string), clean);
    if (!s.rows('DonationType').some((t) => t.id === clean.DonationTypeID && t.CouncilID === clean.CouncilID)) {
      throw new BusinessRuleError('INVALID_INPUT', `Council ${clean.CouncilID} has no donation type with id ${clean.DonationTypeID}.`, {
        councilId: clean.CouncilID,
        donationTypeId: clean.DonationTypeID,
      });
    }
    if (clean.EventID != null) {
      const event = this.requireEvent(s, clean.EventID) as unknown as CouncilEvent;
      this.assertEventLinked(s, event, clean.CouncilID);
      assertDonationDateForEvent(clean.DonationDate, event);
    }
  }

  private assertEventLinked(s: MemoryStore, event: CouncilEvent, councilId: number): void {
    if (!this.councilIdsOf(s, event.id).includes(councilId)) {
      throw new BusinessRuleError('INVALID_INPUT', `"${event.EventName}" is not linked to council ${councilId}.`, {
        eventId: event.id,
        councilId,
      });
    }
  }

  private requireDonation(s: MemoryStore, id: number): Row {
    const row = s.rows('Donation').find((d) => d.id === id);
    if (!row) throw new BusinessRuleError('RECORD_NOT_FOUND', `No donation with id ${id}.`, { table: 'Donation', id });
    return row;
  }

  private eventOwnerOf(s: MemoryStore, eventId: number | null | undefined): number | null {
    if (eventId == null) return null;
    return (s.rows('Event').find((e) => e.id === eventId)?.OwnerID as number | undefined) ?? null;
  }

  /** The event's funds rollup from every donation now stored against it. */
  private eventFunds(s: MemoryStore, eventId: number): EventFunds | null {
    const kinds = new Map(s.rows('DonationMethod').map((m) => [m.id, donationMethodKind(m.DonationMethod as string)]));
    return rollupEventFunds(
      s
        .rows('Donation')
        .filter((d) => d.EventID === eventId)
        .map((d) => ({ DonationAmount: d.DonationAmount as number, kind: kinds.get(d.DonationMethodID) ?? 'other' })),
    );
  }

  /**
   * The donation write hook: runs `write`, then overwrites the funds columns of every event it touched with
   * the new rollup (see nextEventFunds). Callers are already inside a transaction, so both land together.
   */
  private withFundsSync<T>(s: MemoryStore, eventIds: readonly (number | null | undefined)[], write: () => T): T {
    const ids = [...new Set(eventIds.filter((id): id is number => id != null))];
    const before = ids.map((id) => this.eventFunds(s, id));
    const result = write();
    ids.forEach((id, i) => {
      const next = nextEventFunds(before[i], this.eventFunds(s, id));
      if (next) Object.assign(this.requireEvent(s, id), next);
    });
    return result;
  }

  private activeStatusId(s: MemoryStore): number | undefined {
    return s.rows('MemberStatus').find((st) => st.Status === 'Active')?.id as number | undefined;
  }

  /** The council's Active members that `groups` reach (message distribution lists, Sprint 5Y-Mobile). */
  private distributionRecipients(s: MemoryStore, councilId: number | undefined, groups: readonly DistributionGroup[] | undefined): number[] {
    if (councilId === undefined || !groups?.length) return [];
    const activeId = this.activeStatusId(s);
    const roster = s
      .rows('Member')
      .filter((m) => m.CouncilID === councilId && m.StatusID === activeId)
      .map((m) => ({ memberId: m.id as number, roles: this.rolesFor(s, m.id as number) }));
    return groups.flatMap((g) => distributionGroupMemberIds(g, roster));
  }

  private rolesFor(s: MemoryStore, memberId: number): Role[] {
    return s
      .rows('MemberRoles')
      .filter((mr) => mr.MemberID === memberId)
      .map((mr) => s.rows('Role').find((r) => r.id === mr.RoleID))
      .filter((r): r is Row => r !== undefined)
      .map((r) => ({ ...r }) as unknown as Role)
      .sort((a, b) => a.id - b.id);
  }

  // ---- expense reporting (Sprint 5R) --------------------------------------

  expenses: DataService['expenses'] = {
    listUserReports: async (actorId) => {
      const s = await this.ready();
      this.requireMember(s, actorId);
      const reports = s.rows('ExpenseReport').filter((r) => r.SubmitterMemberID === actorId);
      return this.expenseDetails(s, [...reports].sort((a, b) => (b.id as number) - (a.id as number)));
    },

    listCouncilQueue: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayAuditCouncilExpenses(this.memberWriteActor(s, actorId), councilId, `review the expense queue of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      const reports = s
        .rows('ExpenseReport')
        .filter((r) => r.CouncilID === councilId && EXPENSE_QUEUE_STATUSES.includes(r.Status as ExpenseReportStatus));
      return this.expenseDetails(s, [...reports].sort((a, b) => (a.id as number) - (b.id as number)));
    },

    listAssetsInventory: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayAuditCouncilExpenses(this.memberWriteActor(s, actorId), councilId, `read the assets inventory of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return (s.rows('CouncilAssetsInventory').filter((a) => a.council_id === councilId).map((a) => ({ ...a })) as unknown as CouncilAssetsInventory[]).sort(
        (a, b) => b.purchase_date.localeCompare(a.purchase_date) || b.id - a.id,
      );
    },

    listAuthorizationQueue: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayReadAuthorizationDesk(this.memberWriteActor(s, actorId), councilId, `read the authorization desk of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      const reports = s
        .rows('ExpenseReport')
        .filter((r) => r.CouncilID === councilId && awaitsCounterSignature(r as unknown as ExpenseReport));
      return this.expenseDetails(s, [...reports].sort((a, b) => (a.id as number) - (b.id as number)));
    },

    submitReport: async (actorId, report, lineItems) => {
      const clean = cleanExpenseReportInput(report);
      const items = cleanExpenseLineItems(lineItems, clean.Status, this.now());
      const s = await this.ready();
      const id = s.transaction(() => {
        const actor = this.requireMember(s, actorId);
        // Inside a transaction the store works on copied rows, so the draft found here is the one to change.
        const draft = clean.id === null ? null : this.requireOwnExpenseReport(s, clean.id, actorId);
        if (draft) assertExpenseStatus(draft as unknown as ExpenseReport, 'Draft', 'be edited');
        const councilId = (draft ?? actor).CouncilID as number;
        const eventId = clean.LinkedEventID;
        assertExpenseLinks(
          clean,
          councilId,
          eventId !== null && s.rows('Event').some((e) => e.id === eventId) ? this.councilIdsOf(s, eventId) : null,
          (s.rows('Meeting').find((m) => m.id === clean.LinkedMeetingID) as unknown as Meeting | undefined) ?? null,
        );
        assertExpenseCharityRequestLink(
          clean,
          councilId,
          (s.rows('CharitableRequest').find((r) => r.id === clean.charity_request_id) as unknown as { CouncilID: number } | undefined) ?? null,
        );
        const linkedEvent = eventId === null ? undefined : (s.rows('Event').find((e) => e.id === eventId) as unknown as Event | undefined);
        const linkedMeeting = s.rows('Meeting').find((m) => m.id === clean.LinkedMeetingID) as unknown as Meeting | undefined;
        assertExpenseSubmissionWindow(
          clean.Status,
          [...(linkedEvent ? [eventExpenseSpan(linkedEvent)] : []), ...(linkedMeeting ? [meetingExpenseSpan(linkedMeeting)] : [])],
          this.now(),
        );
        // The workflow engine decides the stored Status: a new sheet starts as Draft, and only a Draft is saved or submitted.
        const status = nextExpenseStatus(draft?.Status ?? null, clean.Status === 'Submitted' ? 'submit' : 'saveDraft', clean.id);
        const fields = {
          Status: status,
          LinkedEventID: clean.LinkedEventID,
          LinkedMeetingID: clean.LinkedMeetingID,
          is_long_term_asset: clean.is_long_term_asset,
          charity_request_id: clean.charity_request_id,
        };
        let reportId: number;
        if (draft) {
          Object.assign(draft, fields);
          if (status === 'Submitted') draft.RejectionReason = null;
          reportId = draft.id as number;
          s.remove('ExpenseLineItem', (li) => li.ExpenseReportID === reportId);
        } else {
          reportId = s.insert('ExpenseReport', { ...fields, CouncilID: councilId, SubmitterMemberID: actorId }).id as number;
        }
        for (const item of items) s.insert('ExpenseLineItem', { ...item, ReceiptPhotoURL: item.ReceiptPhotoURL ?? null, ExpenseReportID: reportId });
        return reportId;
      });
      return this.expenseDetails(s, [this.requireExpenseReport(s, id)])[0];
    },

    rejectReport: async (actorId, reportId, rejectionReason) => {
      const reason = cleanRejectionReason(rejectionReason);
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const row = this.requireExpenseReport(s, reportId);
        assertMayAuditCouncilExpenses(actor, row.CouncilID as number, `return expense report ${reportId}`);
        assertExpenseStatus(row as unknown as ExpenseReport, 'Submitted', 'be returned to its submitter');
        // A returned sheet starts its dual approval again (Sprint 5Z-3).
        Object.assign(row, { Status: nextExpenseStatus(row.Status, 'return', reportId), RejectionReason: reason, ...CLEARED_EXPENSE_SIGNATURES });
      });
      return this.expenseDetails(s, [this.requireExpenseReport(s, reportId)])[0];
    },

    financialSecretaryAuditOrder: async (actorId, reportId, budgetLineId) => {
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const row = this.requireExpenseReport(s, reportId);
        const report = row as unknown as ExpenseReport;
        assertMayIssueExpenseOrder(actor, report.CouncilID, `issue the written order for expense report ${reportId}`);
        assertNotSelfApproval(actor, report);
        assertExpenseSignatureStage(report, 'financialSecretary');
        Object.assign(row, {
          FinancialSecretaryMemberID: actorId,
          FinancialSecretaryApprovedAt: toTimestamp(this.now()),
          budget_line_id: this.expenseBudgetLineToSave(s, row, budgetLineId),
        });
      });
      return this.expenseDetails(s, [this.requireExpenseReport(s, reportId)])[0];
    },

    grandKnightAuthorizeOrder: async (actorId, reportId, budgetLineId) => {
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const row = this.requireExpenseReport(s, reportId);
        const report = row as unknown as ExpenseReport;
        assertMayAuthorizeExpenseOrder(actor, report.CouncilID, `counter-sign expense report ${reportId}`);
        assertNotSelfApproval(actor, report);
        assertExpenseSignatureStage(report, 'grandKnight');
        assertDistinctExpenseSigners(actor, report);
        const from = row.Status;
        Object.assign(row, {
          Status: nextExpenseStatus(row.Status, 'approve', reportId),
          GrandKnightMemberID: actorId,
          GrandKnightApprovedAt: toTimestamp(this.now()),
          budget_line_id: this.expenseBudgetLineToSave(s, row, budgetLineId),
        });
        this.convertExpenseToAsset(s, row, from);
      });
      return this.expenseDetails(s, [this.requireExpenseReport(s, reportId)])[0];
    },

    recordDisbursement: async (actorId, councilId, reportIds, checkDetails) => {
      const ids = cleanExpenseReportIds(reportIds);
      const check = cleanDisbursementCheck(checkDetails);
      const s = await this.ready();
      const disbursementId = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        assertMayDisburseCouncilExpenses(actor, councilId, `record expense checks for council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        const rows = ids.map((id) => this.requireExpenseReport(s, id));
        for (const row of rows) {
          assertReportInCouncil(row as unknown as ExpenseReport, councilId);
          assertExpenseStatus(row as unknown as ExpenseReport, 'Approved', 'be paid');
          assertDualSigned(row as unknown as ExpenseReport);
          assertNoSelfPayout(actor, row as unknown as ExpenseReport);
        }
        assertCheckNumberUnused(check.CheckNumber, councilId, this.councilCheckNumbers(s, councilId));
        const total = sumAmounts(
          s
            .rows('ExpenseLineItem')
            .filter((li) => ids.includes(li.ExpenseReportID as number))
            .map((li) => li.Amount as number),
        );
        const disbursement = s.insert('ExpenseDisbursement', { ...check, CouncilID: councilId, TotalAmount: total });
        for (const row of rows) {
          const from = row.Status;
          Object.assign(row, { Status: nextExpenseStatus(row.Status, 'reimburse', row.id as number), DisbursementID: disbursement.id });
          this.convertExpenseToAsset(s, row, from);
        }
        return disbursement.id as number;
      });
      const disbursement = s.rows('ExpenseDisbursement').find((d) => d.id === disbursementId)!;
      return {
        disbursement: { ...disbursement } as unknown as ExpenseDisbursement,
        reports: this.expenseDetails(s, ids.map((id) => this.requireExpenseReport(s, id))),
      };
    },
  };

  /** The workflow engine's asset conversion hook, run inside the status change's transaction (Sprint 6E). */
  /**
   * The budget_line_id a signature saves on `row` (Sprint 6G Extension): the signer's pick, else the sheet's saved line,
   * else the default for its link among the council's Approved lines of the fraternal year in progress.
   */
  private expenseBudgetLineToSave(s: MemoryStore, row: Row, picked: number | null | undefined): number | null {
    const councilId = row.CouncilID as number;
    const eventId = (row.LinkedEventID as number | null) ?? null;
    const requestId = (row.charity_request_id as number | null) ?? null;
    return planExpenseBudgetLineSave({
      allLines: this.allBudgetLines(s, councilId),
      assignable: assignableExpenseBudgetLines(this.budgetLines(s, councilId, currentFraternalYear(this.now()))),
      councilId,
      picked,
      saved: (row.budget_line_id as number | null) ?? null,
      link: {
        EventID: eventId,
        EventName: eventId === null ? null : ((s.rows('Event').find((e) => e.id === eventId)?.EventName as string | undefined) ?? null),
        MeetingID: (row.LinkedMeetingID as number | null) ?? null,
        CharityBudgetLineID:
          requestId === null ? null : ((s.rows('CharitableRequest').find((r) => r.id === requestId)?.TargetBudgetLineID as number | null | undefined) ?? null),
      },
    });
  }

  private convertExpenseToAsset(s: MemoryStore, row: Row, from: unknown): void {
    const asset = planExpenseAssetConversion({
      from,
      to: row.Status as ExpenseReportStatus,
      report: row as unknown as ExpenseReport,
      lineItems: s.rows('ExpenseLineItem').filter((li) => li.ExpenseReportID === row.id) as unknown as ExpenseLineItem[],
      alreadyConverted: s.rows('CouncilAssetsInventory').some((a) => a.original_expense_id === row.id),
    });
    if (asset) s.insert('CouncilAssetsInventory', { ...asset });
  }

  private requireExpenseReport(s: MemoryStore, reportId: number): Row {
    const row = s.rows('ExpenseReport').find((r) => r.id === reportId);
    if (!row) throw expenseReportNotFound(reportId);
    return row as Row;
  }

  /** A member reaches only their own sheets; anyone else's reads as missing, so ids reveal nothing. */
  private requireOwnExpenseReport(s: MemoryStore, reportId: number, memberId: number): Row {
    const row = s.rows('ExpenseReport').find((r) => r.id === reportId && r.SubmitterMemberID === memberId);
    if (!row) throw expenseReportNotFound(reportId);
    return row as Row;
  }

  private expenseDetails(s: MemoryStore, reports: readonly Row[]): ExpenseReportDetail[] {
    const ids = new Set(reports.map((r) => r.id));
    return buildExpenseReportDetails(
      reports as unknown as ExpenseReport[],
      s.rows('ExpenseLineItem').filter((li) => ids.has(li.ExpenseReportID)) as unknown as ExpenseLineItem[],
      s.rows('Member') as unknown as Member[],
      s.rows('ExpenseDisbursement') as unknown as ExpenseDisbursement[],
      s.rows('CharitableRequest') as unknown as { id: number; TargetBudgetLineID: number | null }[],
    );
  }

  // ---- events, shifts and time logs -------------------------------------

  events: DataService['events'] = {
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Event').find((e) => e.id === id);
      return row ? ({ ...row } as unknown as CouncilEvent) : null;
    },

    getShift: async (id) => {
      const s = await this.ready();
      const row = s.rows('Shift').find((sh) => sh.id === id);
      return row ? ({ ...row } as unknown as Shift) : null;
    },

    listShiftsBetween: async (fromDate, toDate) => {
      const s = await this.ready();
      const rows = s
        .rows('Shift')
        .filter((sh) => (sh.ShiftDate as string) >= fromDate && (sh.ShiftDate as string) <= toDate)
        .map((sh) => ({ ...sh })) as unknown as Shift[];
      return rows.sort(
        (a, b) => a.ShiftDate.localeCompare(b.ShiftDate) || a.StartTime.localeCompare(b.StartTime) || a.id - b.id,
      );
    },

    listSignups: async (shiftId) => {
      const s = await this.ready();
      return s
        .rows('EventSignup')
        .filter((e) => e.ShiftID === shiftId)
        .map((e) => ({ ...e })) as unknown as EventSignup[];
    },

    signupForShift: async (memberId, shiftId) => {
      const s = await this.ready();
      return s.transaction(() => {
        const shift = this.requireShift(s, shiftId);
        this.requireMember(s, memberId);
        if (s.rows('EventSignup').some((e) => e.ShiftID === shiftId && e.MemberID === memberId)) {
          throw new BusinessRuleError(
            'ALREADY_SIGNED_UP',
            `Member ${memberId} is already signed up for shift "${shift.ShiftName}" (id ${shiftId}).`,
            { memberId, shiftId },
          );
        }
        // A full shift still takes honorary volunteers (Sprint 5Z-Final-Polish), so there is no cap check.
        const row = s.insert('EventSignup', { ShiftID: shiftId, MemberID: memberId, NoShow: 0 });
        (shift as Row).NumberVolunteersSignedUp = (shift.NumberVolunteersSignedUp as number) + 1;
        return { ...row } as unknown as EventSignup;
      });
    },

    listMemberShifts: async (memberId, range) => {
      const s = await this.ready();
      const from = range?.fromDate ?? '0000-01-01';
      const to = range?.toDate ?? '9999-12-31';
      const out: MemberShift[] = [];
      for (const signup of s.rows('EventSignup').filter((e) => e.MemberID === memberId)) {
        const shift = s.rows('Shift').find((sh) => sh.id === signup.ShiftID);
        const event = shift && s.rows('Event').find((ev) => ev.id === shift.EventID);
        if (!shift || !event || (shift.ShiftDate as string) < from || (shift.ShiftDate as string) > to) continue;
        const time = s.rows('EventTime').find((t) => t.ShiftID === shift.id && t.MemberID === memberId);
        out.push({
          signup: { ...signup } as unknown as EventSignup,
          shift: { ...shift } as unknown as Shift,
          event: { ...event } as unknown as CouncilEvent,
          hoursLogged: time ? (time.Hours as number) : null,
        });
      }
      return out.sort((a, b) => compareShifts(a.shift, b.shift));
    },

    listShiftFeed: async ({ memberId, councilIds, fromDate, toDate }) => {
      const s = await this.ready();
      const wanted = new Set(councilIds);
      const mine = new Set(s.rows('EventSignup').filter((e) => e.MemberID === memberId).map((e) => e.ShiftID));
      const out: ShiftFeedItem[] = [];
      for (const shift of s.rows('Shift')) {
        if ((shift.ShiftDate as string) < fromDate || (shift.ShiftDate as string) > toDate) continue;
        const linked = this.councilIdsOf(s, shift.EventID as number);
        const event = s.rows('Event').find((ev) => ev.id === shift.EventID);
        if (!event || !linked.some((id) => wanted.has(id))) continue;
        out.push({
          shift: { ...shift } as unknown as Shift,
          event: { ...event } as unknown as CouncilEvent,
          councilIds: linked,
          isSignedUp: mine.has(shift.id),
        });
      }
      return out.sort((a, b) => compareShifts(a.shift, b.shift));
    },

    countNoShows: async (memberId, sinceDate) => {
      const s = await this.ready();
      return s.rows('EventSignup').filter((e) => {
        if (e.MemberID !== memberId || e.NoShow !== 1) return false;
        const shift = s.rows('Shift').find((sh) => sh.id === e.ShiftID);
        return shift !== undefined && (shift.ShiftDate as string) >= sinceDate;
      }).length;
    },

    setNoShow: async (actorId, signupId, noShow, reasonId) => {
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const signup = s.rows('EventSignup').find((e) => e.id === signupId);
        if (!signup) throw signupNotFound(signupId);
        const shift = this.requireShift(s, signup.ShiftID as number);
        const target = {
          signupId,
          memberId: signup.MemberID as number,
          eventId: shift.EventID as number,
          eventCouncilIds: this.councilIdsOf(s, shift.EventID as number),
        };
        assertMayMarkNoShow(actor, target, noShow);
        const reason = noShowReasonFor(noShow, reasonId, s.rows('NoShowReason').map((r) => r.id as number));
        if (noShow) {
          const time = s.rows('EventTime').find((t) => t.ShiftID === shift.id && t.MemberID === signup.MemberID);
          assertNoShowWithoutHours(target, time ? (time.Hours as number) : null);
        }
        (signup as Row).NoShow = noShow ? 1 : 0;
        (signup as Row).NoShowReasonID = reason;
        return { ...signup } as unknown as EventSignup;
      });
    },

    listCalendarRange: async (councilId, startDate, endDate, options) => {
      const range = cleanCalendarRange(startDate, endDate);
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      // A standard member's calendar drops what has already happened (EndDate / Date before today).
      const floor = options?.hideEnded === true ? toIsoDate(this.now()) : '';
      const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
      const events = s
        .rows('Event')
        .filter((e) => linked.has(e.id) && (e.EndDate as string) >= floor)
        .map((e) => ({ ...e })) as unknown as CouncilEvent[];
      const meetings = s
        .rows('Meeting')
        .filter((m) => m.CouncilID === councilId && meetingLastDate(m as unknown as Meeting) >= floor)
        .map((m) => ({ ...m })) as unknown as Meeting[];
      return buildCalendarEntries(range, events, meetings);
    },

    uploadPhotos: async (actorId, eventId, photoPaths) => {
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const event = this.requireEvent(s, eventId);
        assertMayAttachEventMedia(actor, event as unknown as CouncilEvent, this.councilIdsOf(s, eventId), `add photos to event ${eventId}`);
        (event as Row).PhotoGalleryURL = appendPhotoPaths(event.PhotoGalleryURL as string | null, photoPaths);
        return { ...event } as unknown as CouncilEvent;
      });
    },

    setFlyerFile: async (actorId, eventId, fileId) => {
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const event = this.requireEvent(s, eventId);
        assertMayAttachEventMedia(actor, event as unknown as CouncilEvent, this.councilIdsOf(s, eventId), `file a flyer for event ${eventId}`);
        (event as Row).GoogleDriveFlyerFileID = cleanFlyerFileId(fileId);
        return { ...event } as unknown as CouncilEvent;
      });
    },

    listByCouncil: async (councilId) => {
      const s = await this.ready();
      const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
      const rows = s
        .rows('Event')
        .filter((e) => linked.has(e.id))
        .map((e) => ({ ...e })) as unknown as CouncilEvent[];
      return rows.sort((a, b) => b.StartDate.localeCompare(a.StartDate) || b.id - a.id);
    },

    listShifts: async (eventId) => {
      const s = await this.ready();
      return (s
        .rows('Shift')
        .filter((sh) => sh.EventID === eventId)
        .map((sh) => ({ ...sh })) as unknown as Shift[]).sort(compareShifts);
    },

    listTurnout: async (eventId) => {
      const s = await this.ready();
      const out: VolunteerTurnout[] = [];
      for (const shift of s.rows('Shift').filter((sh) => sh.EventID === eventId)) {
        for (const signup of s.rows('EventSignup').filter((e) => e.ShiftID === shift.id)) {
          const member = s.rows('Member').find((m) => m.id === signup.MemberID);
          if (!member) continue;
          const time = s.rows('EventTime').find((t) => t.ShiftID === shift.id && t.MemberID === signup.MemberID);
          out.push({
            signup: { ...signup } as unknown as EventSignup,
            shift: { ...shift } as unknown as Shift,
            MemberFirstName: member.MemberFirstName as string,
            MemberLastName: member.MemberLastName as string,
            DateJoinedCouncil: (member.DateJoinedCouncil as string | null | undefined) ?? null,
            hoursLogged: time ? (time.Hours as number) : null,
          });
        }
      }
      return out.sort(
        (a, b) =>
          compareShifts(a.shift, b.shift) ||
          a.MemberLastName.localeCompare(b.MemberLastName) ||
          a.MemberFirstName.localeCompare(b.MemberFirstName) ||
          a.signup.id - b.signup.id,
      );
    },

    listCouncilIds: async (eventId) => this.councilIdsOf(await this.ready(), eventId),

    create: async (event, councilIds) => {
      const clean = cleanNewEvent(event);
      assertEventRange(clean.StartDate, clean.EndDate);
      const ids = cleanCouncilIds(councilIds);
      const s = await this.ready();
      return s.transaction(() => ({ ...this.insertEvent(s, clean, ids) }) as unknown as CouncilEvent);
    },

    update: async (id, changes: EventChanges) => {
      const clean = cleanEventFields(changes);
      const s = await this.ready();
      return s.transaction(() => {
        const row = this.requireEvent(s, id);
        assertFundsEditable(row as unknown as CouncilEvent, clean, this.eventFunds(s, id));
        assertEventRange((clean.StartDate ?? row.StartDate) as string, (clean.EndDate ?? row.EndDate) as string);
        this.assertOwnerAndCategory(s, clean);
        if (clean.StartDate !== undefined || clean.EndDate !== undefined) {
          const event = { ...row, ...clean } as unknown as CouncilEvent;
          for (const sh of s.rows('Shift').filter((x) => x.EventID === id)) {
            assertShiftInsideEvent(sh.ShiftDate as string, event);
          }
        }
        Object.assign(row, clean);
        return { ...row } as unknown as CouncilEvent;
      });
    },

    setCouncils: async (eventId, councilIds) => {
      const ids = cleanCouncilIds(councilIds);
      const s = await this.ready();
      s.transaction(() => {
        this.requireEvent(s, eventId);
        this.assertCouncilsExist(s, ids);
        s.remove('EventCouncils', (ec) => ec.EventID === eventId);
        for (const CouncilID of ids) s.insert('EventCouncils', { EventID: eventId, CouncilID });
      });
    },

    copy: async (eventId, options) => {
      const s = await this.ready();
      return s.transaction(() => {
        const original = { ...this.requireEvent(s, eventId) } as unknown as CouncilEvent;
        const shifts = s.rows('Shift').filter((sh) => sh.EventID === eventId) as unknown as Shift[];
        const plan = planEventCopy(original, shifts, options);
        const clean = cleanNewEvent(plan.event);
        const row = this.insertEvent(s, clean, this.councilIdsOf(s, eventId));
        for (const shift of plan.shifts) this.insertShift(s, row.id as number, shift);
        return { ...row } as unknown as CouncilEvent;
      });
    },

    createShift: async (shift) => {
      const clean = cleanNewShift(shift);
      const s = await this.ready();
      return s.transaction(() => {
        const event = this.requireEvent(s, clean.EventID);
        assertShiftInsideEvent(clean.ShiftDate, event as unknown as CouncilEvent);
        return { ...this.insertShift(s, clean.EventID, clean) } as unknown as Shift;
      });
    },

    updateShift: async (id, changes: ShiftChanges) => {
      const clean = cleanShiftFields(changes);
      const s = await this.ready();
      return s.transaction(() => {
        const row = this.requireShift(s, id);
        // Phase 4.5: an All-Hands shift (as it stands or as changed) has no cap, so its target never blocks a change.
        const allHands = (clean.IsAllHands ?? row.IsAllHands) === 1;
        if (!allHands && clean.MinNumberVolunteers !== undefined && clean.MinNumberVolunteers < (row.NumberVolunteersSignedUp as number)) {
          throw new BusinessRuleError(
            'INVALID_INPUT',
            `Shift "${row.ShiftName}" already has ${row.NumberVolunteersSignedUp} volunteers signed up, so the volunteer target cannot be lowered to ${clean.MinNumberVolunteers}.`,
            { shiftId: id, signedUp: row.NumberVolunteersSignedUp, requested: clean.MinNumberVolunteers },
          );
        }
        if (clean.ShiftDate !== undefined) {
          assertShiftInsideEvent(clean.ShiftDate, this.requireEvent(s, row.EventID as number) as unknown as CouncilEvent);
        }
        Object.assign(row, clean);
        return { ...row } as unknown as Shift;
      });
    },

    deleteShift: async (id) => {
      const s = await this.ready();
      s.transaction(() => {
        const row = this.requireShift(s, id);
        const signups = s.rows('EventSignup').filter((e) => e.ShiftID === id).length;
        if (signups > 0) {
          throw new BusinessRuleError(
            'SHIFT_HAS_SIGNUPS',
            `Shift "${row.ShiftName}" (id ${id}) has ${signups} volunteer${signups === 1 ? '' : 's'} signed up and cannot be deleted.`,
            { shiftId: id, signups },
          );
        }
        s.remove('Shift', (sh) => sh.id === id);
      });
    },

    setIntakeSessionStatus: async (actorId, eventId, status) => {
      const next = assertIntakeSessionStatus(status);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const event = this.requireEvent(s, eventId);
        assertMayRunEventIntake(actor, eventId, this.councilIdsOf(s, eventId));
        event.IntakeSessionStatus = nextIntakeSessionStatus(event.IntakeSessionStatus, next, eventId);
        return { ...event } as unknown as Event;
      });
    },
  };

  private councilIdsOf(s: MemoryStore, eventId: number): number[] {
    return s
      .rows('EventCouncils')
      .filter((ec) => ec.EventID === eventId)
      .map((ec) => ec.CouncilID as number)
      .sort((a, b) => a - b);
  }

  private requireEvent(s: MemoryStore, eventId: number): Row {
    const event = s.rows('Event').find((e) => e.id === eventId);
    if (!event) throw new BusinessRuleError('EVENT_NOT_FOUND', `No event with id ${eventId}.`, { eventId });
    return event;
  }

  private assertCouncilsExist(s: MemoryStore, ids: readonly number[]): void {
    for (const id of ids) {
      if (!s.rows('Council').some((c) => c.id === id)) {
        throw new BusinessRuleError('INVALID_INPUT', `No council with id ${id}.`, { councilId: id });
      }
    }
  }

  /** Sprint 6Z-Dual-Gate-Model: FRATERNAL_EXTENSION_REQUIRED unless the council is a Knights of Columbus council. */
  private assertFraternalCouncil(s: MemoryStore, councilId: number, operation: string): void {
    const council = s.rows('Council').find((c) => c.id === councilId) as unknown as GateCouncil | undefined;
    assertFraternalExtension(councilId, operation, council ?? null);
  }

  /** Friendly errors for the two foreign keys the generic constraint message would explain poorly. */
  private assertOwnerAndCategory(s: MemoryStore, fields: EventChanges): void {
    if (fields.OwnerID != null) this.requireMember(s, fields.OwnerID);
    if (fields.CategoryID != null && !s.rows('Category').some((c) => c.id === fields.CategoryID)) {
      throw new BusinessRuleError('INVALID_INPUT', `No event category with id ${fields.CategoryID}.`, {
        categoryId: fields.CategoryID,
      });
    }
  }

  private insertEvent(s: MemoryStore, event: NewEvent, councilIds: readonly number[]): Row {
    this.assertOwnerAndCategory(s, event);
    this.assertCouncilsExist(s, councilIds);
    const row = s.insert('Event', event as unknown as Record<string, SeedValue | undefined>);
    for (const CouncilID of councilIds) s.insert('EventCouncils', { EventID: row.id, CouncilID });
    return row;
  }

  private insertShift(s: MemoryStore, eventId: number, shift: Omit<Shift, 'id' | 'EventID' | 'NumberVolunteersSignedUp'>): Row {
    return s.insert('Shift', {
      ShiftName: shift.ShiftName,
      ShiftDescription: shift.ShiftDescription ?? '',
      ShiftDate: shift.ShiftDate,
      StartTime: shift.StartTime,
      EndTime: shift.EndTime,
      EventID: eventId,
      MinNumberVolunteers: shift.MinNumberVolunteers,
      NumberVolunteersSignedUp: 0,
      IsAllHands: shift.IsAllHands ?? 0,
    });
  }

  lessonsLearned: DataService['lessonsLearned'] = {
    list: async (eventId) => {
      const s = await this.ready();
      return s
        .rows('LessonsLearned')
        .filter((l) => l.EventID === eventId)
        .map((l) => ({ ...l })) as unknown as LessonsLearned[];
    },

    add: async (actorId, eventId, categoryId, description) => {
      const text = assertText(description, 'Lesson learned', 255);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const event = this.requireEvent(s, eventId);
        assertMayChangeLesson(actor, event as unknown as CouncilEvent, this.councilIdsOf(s, eventId), `add lessons to event ${eventId}`);
        if (!s.rows('LessonsLearnedCategory').some((c) => c.id === categoryId)) {
          throw new BusinessRuleError('INVALID_INPUT', `No lessons-learned category with id ${categoryId}.`, { categoryId });
        }
        const row = s.insert('LessonsLearned', {
          EventID: eventId,
          LeassonsLearnedCategoryID: categoryId,
          LessonsLearnedDescription: text,
        });
        return { ...row } as unknown as LessonsLearned;
      });
    },

    remove: async (actorId, id) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const lesson = s.rows('LessonsLearned').find((l) => l.id === id);
      if (!lesson) throw new BusinessRuleError('INVALID_INPUT', `No lesson learned with id ${id}.`, { id });
      const eventId = lesson.EventID as number;
      const event = this.requireEvent(s, eventId);
      assertMayChangeLesson(actor, event as unknown as CouncilEvent, this.councilIdsOf(s, eventId), `remove lesson ${id}`);
      s.remove('LessonsLearned', (l) => l.id === id);
    },

    listGlobalRegistry: async (actorId, filters) => {
      const clean = cleanLessonsRegistryFilters(filters);
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      assertMayReadLessonsRegistry(actor);
      const copy = <T>(table: string) => s.rows(table).map((r) => ({ ...r })) as unknown as T[];
      return buildLessonsRegistry(actor, clean, {
        lessons: copy<LessonsLearned>('LessonsLearned'),
        events: copy<CouncilEvent>('Event'),
        eventCouncils: copy<{ EventID: number; CouncilID: number }>('EventCouncils'),
        councils: copy<Council>('Council'),
        categories: copy<Category>('Category'),
        lessonCategories: copy<LessonsLearnedCategory>('LessonsLearnedCategory'),
      });
    },
  };

  eventTime: DataService['eventTime'] = {
    logHours: async (memberId, shiftId, hours, notes) => {
      assertValidHours(hours);
      const s = await this.ready();
      return s.transaction(() => {
        const shift = this.requireShift(s, shiftId);
        this.requireMember(s, memberId);
        assertShiftReportAllowed(shift.ShiftDate as string, this.now(), shiftId);
        if (!s.rows('EventSignup').some((e) => e.ShiftID === shiftId && e.MemberID === memberId)) {
          throw new BusinessRuleError(
            'NOT_SIGNED_UP',
            `Member ${memberId} never signed up for shift "${shift.ShiftName}" (id ${shiftId}), so no time can be logged against it.`,
            { memberId, shiftId },
          );
        }
        const existing = s.rows('EventTime').find((t) => t.ShiftID === shiftId && t.MemberID === memberId);
        if (existing) {
          (existing as Row).Hours = hours;
          (existing as Row).ShiftNotes = notes ?? null;
          return { ...existing } as unknown as EventTime;
        }
        const row = s.insert('EventTime', { ShiftID: shiftId, MemberID: memberId, Hours: hours, ShiftNotes: notes ?? null });
        return { ...row } as unknown as EventTime;
      });
    },
  };

  activityTime: DataService['activityTime'] = {
    logHours: async (memberId, activityId, hours, date, notes) => {
      assertValidHours(hours);
      assertActivityDateAllowed(date, this.now());
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, memberId);
        if (!s.rows('Activities').some((a) => a.id === activityId)) {
          throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
        }
        const row = s.insert('ActivityTime', {
          MemberID: memberId,
          ActivityID: activityId,
          ActivityDate: date,
          Hours: hours,
          ActivityNotes: notes ?? null,
        });
        return { ...row } as unknown as ActivityTime;
      });
    },

    addQuarterHour: async (memberId, activityId, date) => {
      assertActivityDateAllowed(date, this.now());
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, memberId);
        if (!s.rows('Activities').some((a) => a.id === activityId)) {
          throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
        }
        // The newest of the member's entries for the activity that day grows (rows are in id order); there is normally just one.
        const entry = s
          .rows('ActivityTime')
          .filter((t) => t.MemberID === memberId && t.ActivityID === activityId && t.ActivityDate === date)
          .at(-1);
        if (entry) {
          entry.Hours = nextQuarterHourTotal(entry.Hours as number);
          return { ...entry } as unknown as ActivityTime;
        }
        const row = s.insert('ActivityTime', {
          MemberID: memberId,
          ActivityID: activityId,
          ActivityDate: date,
          Hours: nextQuarterHourTotal(null),
          ActivityNotes: null,
        });
        return { ...row } as unknown as ActivityTime;
      });
    },

    listByActivity: async (activityId) => {
      const s = await this.ready();
      const activity = s.rows('Activities').find((a) => a.id === activityId);
      if (!activity) throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
      const times = s.rows('ActivityTime').filter((t) => t.ActivityID === activityId).map((t) => ({ ...t })) as unknown as ActivityTime[];
      const members = new Map(
        s.rows('Member').map((m) => [m.id as number, { MemberFirstName: m.MemberFirstName as string, MemberLastName: m.MemberLastName as string }]),
      );
      return buildActivityTimeLog({ ...activity } as unknown as Activities, times, members);
    },
  };

  reports: DataService['reports'] = {
    monthlySummary: async (councilId, year, month) => {
      const { fromDate, toDate } = monthBounds(year, month);
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      const inMonth = (date: unknown) => (date as string) >= fromDate && (date as string) <= toDate;
      const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
      const events = s.rows('Event').filter((e) => linked.has(e.id) && inMonth(e.StartDate)).map((e) => ({ ...e })) as unknown as CouncilEvent[];
      const shifts = new Set(s.rows('Shift').filter((sh) => linked.has(sh.EventID) && inMonth(sh.ShiftDate)).map((sh) => sh.id));
      const activities = new Set(s.rows('Activities').filter((a) => a.CouncilID === councilId).map((a) => a.id));
      const hours = (t: Row) => ({ MemberID: t.MemberID as number, Hours: t.Hours as number });
      const spendingReports = new Set(
        s
          .rows('ExpenseReport')
          .filter((r) => r.CouncilID === councilId && EXPENSE_SPEND_STATUSES.includes(r.Status as ExpenseReportStatus))
          .map((r) => r.id),
      );
      return summarizeMonth(councilId, year, month, {
        events,
        eventTime: s.rows('EventTime').filter((t) => shifts.has(t.ShiftID)).map(hours),
        activityTime: s.rows('ActivityTime').filter((t) => activities.has(t.ActivityID) && inMonth(t.ActivityDate)).map(hours),
        expenseItems: s
          .rows('ExpenseLineItem')
          .filter((li) => spendingReports.has(li.ExpenseReportID) && inMonth(li.DateOfExpense))
          .map((li) => ({ Amount: li.Amount as number })),
        charitableGifts: s
          .rows('CharitableDisbursementLedger')
          .filter((g) => g.CouncilID === councilId && inMonth(g.PayoutDate))
          .map((g) => ({ Amount: g.Amount as number })),
      });
    },

    missionAreaFootprint: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const s = await this.ready();
      assertMayReviewBudgetPerformance(this.memberWriteActor(s, actorId), councilId, `read the mission footprint of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
      const shifts = new Map(s.rows('Shift').filter((sh) => linked.has(sh.EventID)).map((sh) => [sh.id, sh]));
      const methodName = (id: unknown) => (s.rows('DonationMethod').find((m) => m.id === id)?.DonationMethod as string | undefined) ?? '';
      return buildMissionAreaFootprint(
        councilId,
        year,
        s.rows('CouncilMissionArea').map((a) => ({ ...a })) as unknown as CouncilMissionArea[],
        s.rows('Event').filter((e) => linked.has(e.id)).map((e) => ({ id: e.id as number, StartDate: e.StartDate as string, MissionAreaID: (e.MissionAreaID as number | null) ?? null })),
        s
          .rows('Donation')
          .filter((d) => d.CouncilID === councilId)
          .map((d) => ({
            EventID: (d.EventID as number | null) ?? null,
            DonationDate: d.DonationDate as string,
            DonationAmount: d.DonationAmount as number,
            methodName: methodName(d.DonationMethodID),
          })),
        s
          .rows('EventTime')
          .filter((t) => shifts.has(t.ShiftID))
          .map((t) => {
            const shift = shifts.get(t.ShiftID)!;
            return { Hours: t.Hours as number, eventId: shift.EventID as number, shiftDate: shift.ShiftDate as string };
          }),
      );
    },

    listNoShowsAudit: async (councilId, dateThreshold) => {
      const threshold = noShowAuditThreshold(dateThreshold, this.now());
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      const rows = [];
      for (const signup of s.rows('EventSignup').filter((su) => su.NoShow === 1)) {
        const row = this.signupContext(s, signup);
        if (row.member.CouncilID !== councilId || row.shift.ShiftDate < threshold) continue;
        const reason = s.rows('NoShowReason').find((r) => r.id === signup.NoShowReasonID); // a LEFT JOIN: may be missing
        rows.push({ ...row, reason: reason ? ({ ...reason } as unknown as NoShowReason) : null });
      }
      return buildNoShowAudit(rows);
    },

    listShiftsAwaitingHours: async (councilId) => {
      const now = this.now();
      const today = toIsoDate(now);
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
      const rows = [];
      for (const signup of s.rows('EventSignup').filter((su) => su.NoShow === 0)) {
        const row = this.signupContext(s, signup);
        if (!linked.has(row.event.id) || row.shift.ShiftDate >= today) continue;
        if (s.rows('EventTime').some((t) => t.ShiftID === signup.ShiftID && t.MemberID === signup.MemberID)) continue;
        rows.push(row);
      }
      return buildShiftsAwaitingHours(rows, now);
    },
  };

  /** A signup with its shift, event and member, copied for the audits. */
  private signupContext(s: MemoryStore, signup: Row): SignupContextRow & { member: Pick<Member, 'CouncilID'> } {
    const shift = this.requireShift(s, signup.ShiftID as number);
    return {
      signup: { ...signup } as unknown as EventSignup,
      shift: { ...shift } as unknown as Shift,
      event: { ...this.requireEvent(s, shift.EventID as number) } as unknown as CouncilEvent,
      member: { ...this.requireMember(s, signup.MemberID as number) } as unknown as Member,
    };
  }

  private requireShift(s: MemoryStore, shiftId: number): Row {
    const shift = s.rows('Shift').find((sh) => sh.id === shiftId);
    if (!shift) throw new BusinessRuleError('SHIFT_NOT_FOUND', `No shift with id ${shiftId}.`, { shiftId });
    return shift;
  }

  private requireMember(s: MemoryStore, memberId: number): Row {
    const member = s.rows('Member').find((m) => m.id === memberId);
    if (!member) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${memberId}.`, { memberId });
    return member;
  }

  // ---- meetings ----------------------------------------------------------

  meetings: DataService['meetings'] = {
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Meeting').find((m) => m.id === id);
      return row ? ({ ...row } as unknown as Meeting) : null;
    },

    listUpcoming: async (councilId, options) => {
      const s = await this.ready();
      const from = options?.fromDate ?? toIsoDate(new Date());
      const invitedTo =
        options?.memberId === undefined
          ? null
          : new Set(s.rows('MeetingInvites').filter((i) => i.MemberID === options.memberId).map((i) => i.MeetingID));
      // A member's own list leaves out drip-release invitations until their release day (Sprint 5Z-6).
      const today = toIsoDate(this.now());
      const rows = s
        .rows('Meeting')
        .filter(
          (m) =>
            m.CouncilID === councilId &&
            meetingLastDate(m as unknown as Meeting) >= from &&
            (!invitedTo || (invitedTo.has(m.id) && isInvitationReleased(m as unknown as Meeting, today))),
        )
        .map((m) => ({ ...m })) as unknown as Meeting[];
      return rows.sort(
        (a, b) => a.Date.localeCompare(b.Date) || a['Time Start'].localeCompare(b['Time Start']) || a.id - b.id,
      );
    },

    listSchedules: async (councilId, memberId, options) => {
      const s = await this.ready();
      this.requireMember(s, memberId);
      const fromDate = options?.fromDate ?? toIsoDate(this.now());
      const responses = new Map(
        s.rows('MeetingInvites').filter((i) => i.MemberID === memberId).map((i) => [i.MeetingID as number, i.ResponseStatus as MeetingResponseStatus]),
      );
      const allSchedules = await this.meetings.listUpcoming(councilId, { fromDate });
      const today = toIsoDate(this.now());
      const myInvites = allSchedules.filter((m) => responses.has(m.id) && isInvitationReleased(m, today));
      return { myInvites, allSchedules, myResponses: Object.fromEntries(myInvites.map((m) => [m.id, responses.get(m.id)!])) };
    },

    create: async (meeting, invite = 'none') => {
      const s = await this.ready();
      const id = s.transaction(() => this.insertMeeting(meeting, invite));
      return { ...s.rows('Meeting').find((m) => m.id === id)! } as unknown as Meeting;
    },

    listInvites: async (meetingId) => {
      const s = await this.ready();
      return s
        .rows('MeetingInvites')
        .filter((i) => i.MeetingID === meetingId)
        .map((i) => ({ ...i })) as unknown as MeetingInvites[];
    },

    invite: async (meetingId, memberIds) => {
      const s = await this.ready();
      return s.transaction(() => this.insertInvites(meetingId, memberIds));
    },

    setAttended: async (meetingId, memberId, attended) => {
      const s = await this.ready();
      const invite = s.rows('MeetingInvites').find((i) => i.MeetingID === meetingId && i.MemberID === memberId);
      if (!invite) throw new Error(`Member ${memberId} is not invited to meeting ${meetingId}`);
      (invite as Row).Attended = attended ? 1 : 0;
    },

    setMinutes: async (meetingId, minutesUrl) => {
      // MinutesURL is NOT NULL in Schema.sql, so "no minutes" is stored as ''.
      const url = minutesUrl === null ? '' : assertText(minutesUrl, 'Minutes link', 255);
      const s = await this.ready();
      const row = s.rows('Meeting').find((m) => m.id === meetingId);
      if (!row) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
      (row as Row).MinutesURL = url;
      return { ...row } as unknown as Meeting;
    },

    linkGoogleDrive: async (actorId, meetingId, minutesUrl, flyerUrl) => {
      const minutes = cleanGoogleDriveUrl(minutesUrl, 'Google Drive minutes link');
      const flyer = cleanGoogleDriveUrl(flyerUrl, 'Google Drive flyer link');
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const row = s.rows('Meeting').find((m) => m.id === meetingId);
        if (!row) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
        assertMayLinkMeetingDrive(actor, row as unknown as Meeting, `link Google Drive files to meeting ${meetingId}`);
        (row as Row).GoogleDriveMinutesURL = minutes;
        (row as Row).GoogleDriveFlyerURL = flyer;
        return { ...row } as unknown as Meeting;
      });
    },

    memberHours: async (memberId, range) => {
      const s = await this.ready();
      this.requireMember(s, memberId);
      const from = range?.fromDate ?? '0000-01-01';
      const to = range?.toDate ?? '9999-12-31';
      const attendedIds = new Set(s.rows('MeetingInvites').filter((i) => i.MemberID === memberId && i.Attended === 1).map((i) => i.MeetingID));
      const attended = s
        .rows('Meeting')
        .filter((m) => attendedIds.has(m.id) && (m.Date as string) >= from && (m.Date as string) <= to)
        .map((m) => ({ ...m })) as unknown as Meeting[];
      return { memberId, ...aggregateMeetingHours(attended) };
    },

    listCouncilMeetingTypes: async (councilId) => {
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      return (s.rows('CouncilMeetingType').filter((t) => t.CouncilID === councilId).map((t) => ({ ...t })) as unknown as CouncilMeetingType[]).sort(
        (a, b) => (a.TypeName < b.TypeName ? -1 : a.TypeName > b.TypeName ? 1 : a.id - b.id), // binary order, as SQLite's ORDER BY
      );
    },

    rsvpToInvite: async (actorId, meetingId, status) => {
      const response = assertMeetingResponseStatus(status);
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, actorId);
        const meeting = s.rows('Meeting').find((m) => m.id === meetingId);
        if (!meeting) {
          throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
        }
        const invite = s.rows('MeetingInvites').find((i) => i.MeetingID === meetingId && i.MemberID === actorId);
        // An invitation still held back by the drip release (Sprint 5Z-6) cannot be answered yet.
        if (!invite || !isInvitationReleased(meeting as unknown as Meeting, toIsoDate(this.now()))) {
          throw new BusinessRuleError('NOT_INVITED', `Member ${actorId} is not invited to meeting ${meetingId}.`, { meetingId, memberId: actorId });
        }
        (invite as Row).ResponseStatus = response;
        return { ...invite } as unknown as MeetingInvites;
      });
    },

    getAgendaTemplate: async (councilId, meetingTypeId) => {
      const s = await this.ready();
      const row = s.rows('CouncilAgendaTemplate').find((t) => t.CouncilID === councilId && t.MeetingTypeID === meetingTypeId);
      return row ? ({ ...row } as unknown as CouncilAgendaTemplate) : null;
    },

    saveAgendaTemplate: async (actorId, councilId, meetingTypeId, templateText) => {
      const text = cleanAgendaTemplateText(templateText);
      const s = await this.ready();
      return s.transaction(() => {
        assertMayManageAgendaTemplates(this.memberWriteActor(s, actorId), councilId);
        this.requireCouncilMeetingType(s, councilId, meetingTypeId);
        const existing = s.rows('CouncilAgendaTemplate').find((t) => t.CouncilID === councilId && t.MeetingTypeID === meetingTypeId);
        if (text === '') {
          if (existing) s.remove('CouncilAgendaTemplate', (t) => t.id === existing.id);
          return null;
        }
        if (existing) {
          (existing as Row).TemplateText = text;
          return { ...existing } as unknown as CouncilAgendaTemplate;
        }
        return { ...s.insert('CouncilAgendaTemplate', { CouncilID: councilId, MeetingTypeID: meetingTypeId, TemplateText: text }) } as unknown as CouncilAgendaTemplate;
      });
    },

    populateAnnualCadence: async (actorId, councilId, configId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const s = await this.ready();
      return s.transaction(() => {
        assertMayScheduleCouncilCadence(this.memberWriteActor(s, actorId), councilId);
        this.assertCouncilsExist(s, [councilId]);
        const config = s.rows('CouncilCadenceConfig').find((c) => c.id === configId && c.CouncilID === councilId) as unknown as
          | CouncilCadenceConfig
          | undefined;
        if (!config) throw cadenceConfigNotFound(configId, councilId);
        const typeName = String(this.requireCouncilMeetingType(s, councilId, config.MeetingTypeID).TypeName);
        const dates = cadenceDatesForYear(config.CadencePattern, year);
        const times = cadenceMeetingTimes(config.DefaultStartTime);
        const globalType = globalMeetingTypeFor(typeName, s.rows('MeetingType') as unknown as MeetingType[]);
        if (globalType === undefined) throw new BusinessRuleError('INVALID_INPUT', 'No global meeting types are defined to file the meetings under.');
        const template = s.rows('CouncilAgendaTemplate').find((t) => t.CouncilID === councilId && t.MeetingTypeID === config.MeetingTypeID);
        const createdIds: number[] = [];
        const skippedDates: string[] = [];
        for (const date of dates) {
          const taken = s
            .rows('Meeting')
            .some((m) => m.CouncilID === councilId && m.MeetingTypeID === config.MeetingTypeID && String(m.Date).slice(0, 10) === date);
          if (taken) {
            skippedDates.push(date);
            continue;
          }
          const meeting: NewMeeting = {
            CouncilID: councilId,
            'Meeting Name': cadenceMeetingName(typeName),
            Date: date,
            ...times,
            Location: config.DefaultLocation,
            Agenda: (template?.TemplateText as string | undefined) ?? '',
            MinutesURL: '',
            MeetingType: globalType,
            MeetingTypeID: config.MeetingTypeID,
            OwnerID: null,
            IsMultiDay: 0,
            EndDate: null,
            InviteReleaseDate: cadenceInviteReleaseDate(date),
          };
          createdIds.push(this.insertMeeting(meeting, cadenceInviteMode(config.DefaultRecipientGroup)));
        }
        const created = createdIds.map((id) => ({ ...s.rows('Meeting').find((m) => m.id === id)! }) as unknown as Meeting);
        return { config: { ...config }, fraternalYear: year, created, skippedDates };
      });
    },

    listCadenceConfigs: async (councilId) => {
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      return s
        .rows('CouncilCadenceConfig')
        .filter((c) => c.CouncilID === councilId)
        .map((c) => ({ ...c }))
        .sort((a, b) => (a.id as number) - (b.id as number)) as unknown as CouncilCadenceConfig[];
    },

    saveCadenceConfig: async (actorId, councilId, input) => {
      const clean = cleanCadenceConfigInput(input);
      const s = await this.ready();
      return s.transaction(() => {
        assertMayScheduleCouncilCadence(this.memberWriteActor(s, actorId), councilId);
        this.assertCouncilsExist(s, [councilId]);
        this.requireCouncilMeetingType(s, councilId, clean.MeetingTypeID);
        const existing = s.rows('CouncilCadenceConfig').find((c) => c.CouncilID === councilId && c.MeetingTypeID === clean.MeetingTypeID);
        if (existing) {
          Object.assign(existing, clean);
          return { ...existing } as unknown as CouncilCadenceConfig;
        }
        return { ...s.insert('CouncilCadenceConfig', { CouncilID: councilId, ...clean }) } as unknown as CouncilCadenceConfig;
      });
    },

    removeCadenceConfig: async (actorId, councilId, configId) => {
      const s = await this.ready();
      s.transaction(() => {
        assertMayScheduleCouncilCadence(this.memberWriteActor(s, actorId), councilId);
        if (s.remove('CouncilCadenceConfig', (c) => c.id === configId && c.CouncilID === councilId) === 0) {
          throw cadenceConfigNotFound(configId, councilId);
        }
      });
    },

    listProposedMotions: async (meetingId) => {
      const s = await this.ready();
      if (!s.rows('Meeting').some((m) => m.id === meetingId)) {
        throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
      }
      return s
        .rows('ProposedMotion')
        .filter((p) => p.TargetMeetingID === meetingId)
        .sort((a, b) => (a.id as number) - (b.id as number))
        .map((p) => {
          const presenter = s.rows('Member').find((m) => m.id === p.PresenterMemberID);
          return {
            motion: { ...p } as unknown as ProposedMotion,
            presenterFirstName: (presenter?.MemberFirstName as string | undefined) ?? '',
            presenterLastName: (presenter?.MemberLastName as string | undefined) ?? '',
          };
        });
    },

    startLiveAssemblyConsole: async (actorId, meetingId) => {
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const meeting = this.requireMeetingRow(s, meetingId);
        assertMayRunLiveAssembly(actor, meeting as unknown as Meeting, `start the live console of meeting ${meetingId}`);
        if (isMeetingLive(meeting as unknown as Meeting)) return;
        // Lock the quorum base: the council's Active roster at the moment the meeting goes live.
        const active = this.activeStatusId(s);
        const roster = s.rows('Member').filter((m) => m.CouncilID === meeting.CouncilID && m.StatusID === active).length;
        Object.assign(meeting, { IsLiveInProgress: 1, LiveQuorumRosterCount: roster });
      });
      return this.liveAssemblyState(s, actorId, meetingId);
    },

    advanceActiveAgendaItem: async (actorId, meetingId, itemName, allottedMinutes, options = {}) => {
      const item = cleanLiveAgendaItem(itemName, allottedMinutes);
      const lineKey = cleanAgendaLineKey(options.lineKey);
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const meeting = this.requireMeetingRow(s, meetingId);
        assertMayRunLiveAssembly(actor, meeting as unknown as Meeting, `set the agenda of meeting ${meetingId}`);
        assertMeetingLive(meeting as unknown as Meeting, 'take a new agenda item');
        Object.assign(meeting, {
          ActiveAgendaItemName: item.name,
          ActiveAgendaItemTimeRemaining: item.minutes,
          ActiveAgendaItemStartedAt: toTimestamp(this.now()),
          ActiveAgendaLineKey: lineKey,
        });
      });
      return this.liveAssemblyState(s, actorId, meetingId);
    },

    logLiveAttendanceOverride: async (actorId, meetingId, memberId) => {
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const meeting = this.requireMeetingRow(s, meetingId);
        if (actorId !== memberId) assertMayRunLiveAssembly(actor, meeting as unknown as Meeting, `check member ${memberId} in to meeting ${meetingId}`);
        assertMeetingLive(meeting as unknown as Meeting, 'take check-ins');
        assertLiveParticipant(actorId === memberId ? actor : this.memberWriteActor(s, memberId), meeting as unknown as Meeting);
        const existing = s.rows('LiveAttendance').find((a) => a.MeetingID === meetingId && a.MemberID === memberId);
        if (existing) return { ...existing } as unknown as LiveAttendance;
        // Checking in overrides whatever the member answered: the invitation reads Accepted and Attended.
        const invite = s.rows('MeetingInvites').find((i) => i.MeetingID === meetingId && i.MemberID === memberId);
        if (invite) Object.assign(invite, { Attended: 1, ResponseStatus: 'Accepted' });
        else s.insert('MeetingInvites', { MeetingID: meetingId, MemberID: memberId, Attended: 1, ResponseStatus: 'Accepted' });
        const row = s.insert('LiveAttendance', { CouncilID: meeting.CouncilID, MeetingID: meetingId, MemberID: memberId, CheckedInAt: toTimestamp(this.now()) });
        return { ...row } as unknown as LiveAttendance;
      });
    },

    launchSecretSmartphoneBallot: async (actorId, proposedMotionId) => {
      const s = await this.ready();
      const meetingId = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const motion = s.rows('ProposedMotion').find((p) => p.id === proposedMotionId);
        if (!motion) throw proposedMotionNotFound(proposedMotionId);
        const meeting = this.requireMeetingRow(s, motion.TargetMeetingID as number);
        assertMayRunLiveAssembly(actor, meeting as unknown as Meeting, `open the ballot on motion ${proposedMotionId}`);
        assertMotionPending(motion as unknown as ProposedMotion, 'go to a ballot');
        assertMeetingLive(meeting as unknown as Meeting, 'open a ballot');
        assertBallotLaunchable(
          motion as unknown as ProposedMotion,
          s.rows('ProposedMotion').filter((p) => p.TargetMeetingID === meeting.id) as unknown as ProposedMotion[],
        );
        motion.BallotOpenedAt = toTimestamp(this.now());
        return meeting.id as number;
      });
      return this.liveAssemblyState(s, actorId, meetingId);
    },

    castAnonymousMobileVote: async (actorId, councilId, motionId, selection) => {
      const choice = assertBallotSelection(selection);
      const hash = await sha256Hex(ballotHashInput(this.ballotSecret, motionId, actorId));
      const s = await this.ready();
      return s.transaction(() => {
        const voter = this.memberWriteActor(s, actorId);
        const motion = s.rows('ProposedMotion').find((p) => p.id === motionId && p.CouncilID === councilId);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = this.requireMeetingRow(s, motion.TargetMeetingID as number);
        assertBallotOpen(motion as unknown as ProposedMotion);
        assertLiveParticipant(voter, meeting as unknown as Meeting);
        const checkedIn = s.rows('LiveAttendance').filter((a) => a.MeetingID === meeting.id);
        assertCheckedIn(checkedIn.some((a) => a.MemberID === actorId), actorId, meeting.id as number);
        if (s.rows('BallotVote').some((v) => v.ProposedMotionID === motionId && v.AnonymousBallotHash === hash)) throw ballotAlreadyCast(motionId);
        s.insert('BallotVote', { CouncilID: councilId, ProposedMotionID: motionId, AnonymousBallotHash: hash, VoteSelection: choice, CastAt: toTimestamp(this.now()) });
        const votes = s.rows('BallotVote').filter((v) => v.ProposedMotionID === motionId) as unknown as BallotVote[];
        return tallyBallots(motionId, votes, checkedIn.length);
      });
    },

    finalizeProposedMotionVote: async (actorId, motionId, resultStatus) => {
      const result = assertFinalMotionResult(resultStatus);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const motion = s.rows('ProposedMotion').find((p) => p.id === motionId);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = this.requireMeetingRow(s, motion.TargetMeetingID as number);
        assertMayRunLiveAssembly(actor, meeting as unknown as Meeting, `decide motion ${motionId}`);
        assertMotionPending(motion as unknown as ProposedMotion, 'be decided again');
        const votes = s.rows('BallotVote').filter((v) => v.ProposedMotionID === motionId) as unknown as BallotVote[];
        const eligible = s.rows('LiveAttendance').filter((a) => a.MeetingID === meeting.id).length;
        const tally = tallyBallots(motionId, votes, eligible);
        assertResultMatchesTally(result, tally, motion.BallotOpenedAt != null);
        motion.VoteResult = result;
        let charitableRequest: CharitableRequest | null = null;
        if (motion.SourceType === 'CharitableRequest' && motion.SourceRecordID != null) {
          const request = s.rows('CharitableRequest').find((r) => r.id === motion.SourceRecordID);
          if (request) {
            const outcome = charitableVoteOutcome(result, request as unknown as CharitableRequest);
            if (outcome) Object.assign(request, outcome);
            this.tagCharitableBudgetFallback(s, request);
            charitableRequest = { ...request } as unknown as CharitableRequest;
          }
        }
        return { motion: { ...motion } as unknown as ProposedMotion, tally, charitableRequest };
      });
    },

    getLiveAssemblyState: async (actorId, meetingId) => {
      const s = await this.ready();
      assertMayFollowLiveAssembly(this.memberWriteActor(s, actorId), this.requireMeetingRow(s, meetingId) as unknown as Meeting);
      return this.liveAssemblyState(s, actorId, meetingId);
    },

    closeLiveAssemblyConsole: async (actorId, meetingId) => {
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const meeting = this.requireMeetingRow(s, meetingId);
        assertMayRunLiveAssembly(actor, meeting as unknown as Meeting, `close the live console of meeting ${meetingId}`);
        if (!isMeetingLive(meeting as unknown as Meeting)) return;
        assertNoBallotOpen(meetingId, s.rows('ProposedMotion').filter((p) => p.TargetMeetingID === meetingId) as unknown as ProposedMotion[]);
        Object.assign(meeting, {
          IsLiveInProgress: 0,
          ActiveAgendaItemName: null,
          ActiveAgendaItemTimeRemaining: null,
          ActiveAgendaItemStartedAt: null,
          ActiveAgendaLineKey: null,
        });
      });
      return this.liveAssemblyState(s, actorId, meetingId);
    },

    getMeetingAgenda: async (actorId, meetingId) => {
      const s = await this.ready();
      assertMayFollowLiveAssembly(this.memberWriteActor(s, actorId), this.requireMeetingRow(s, meetingId) as unknown as Meeting);
      return this.meetingAgendaView(s, meetingId);
    },

    applyAgendaBlueprint: async (actorId, meetingId) => {
      const s = await this.ready();
      s.transaction(() => {
        const meeting = this.requireMeetingRow(s, meetingId) as unknown as Meeting;
        assertMayEditLiveAgenda(this.memberWriteActor(s, actorId), meeting, `lay out the agenda of meeting ${meetingId}`);
        if (s.rows('MeetingAgendaItem').some((i) => i.MeetingID === meetingId)) throw agendaAlreadyStructured(meetingId);
        const roles = s.rows('Role').map((r) => ({ id: r.id as number, Role: r.Role as string }));
        for (const row of blueprintAgendaItems(meeting, roles)) s.insert('MeetingAgendaItem', row as unknown as Row);
      });
      return this.meetingAgendaView(s, meetingId);
    },

    editAgendaLine: async (actorId, meetingId, line, markdown) => {
      const ref = assertAgendaLineRef(line);
      const text = cleanAgendaLineMarkdown(markdown);
      const s = await this.ready();
      s.transaction(() => {
        const meeting = this.requireMeetingRow(s, meetingId) as unknown as Meeting;
        assertMayEditLiveAgenda(this.memberWriteActor(s, actorId), meeting, `correct the agenda of meeting ${meetingId}`);
        const stamp = { LineMarkdown: text, LastEditedByMemberID: actorId, LastEditedAt: toTimestamp(this.now()) };
        const items = s.rows('MeetingAgendaItem').filter((i) => i.MeetingID === meetingId);
        if (ref.kind === 'item') {
          const item = items.find((i) => i.id === ref.itemId);
          if (!item) throw agendaLineNotFound(ref, meetingId);
          Object.assign(item, stamp);
        } else if (ref.kind === 'motion') {
          if (!s.rows('ProposedMotion').some((p) => p.id === ref.motionId && p.TargetMeetingID === meetingId)) throw agendaLineNotFound(ref, meetingId);
          const item = items.find((i) => i.ProposedMotionID === ref.motionId);
          if (item) Object.assign(item, stamp);
          else {
            s.insert('MeetingAgendaItem', {
              CouncilID: meeting.CouncilID,
              MeetingID: meetingId,
              SectionKey: 'new_business',
              SortOrder: MOTION_LINE_SORT_BASE + ref.motionId,
              ProposedMotionID: ref.motionId,
              ...stamp,
            });
          }
        } else {
          const linked = s.rows('EventCouncils').some((ec) => ec.EventID === ref.eventId && ec.CouncilID === meeting.CouncilID);
          if (!linked) throw agendaLineNotFound(ref, meetingId);
          const item = items.find((i) => i.LinkedEventID === ref.eventId);
          if (item) Object.assign(item, stamp);
          else s.insert('MeetingAgendaItem', { CouncilID: meeting.CouncilID, MeetingID: meetingId, SectionKey: 'upcoming_events', SortOrder: 0, LinkedEventID: ref.eventId, ...stamp });
        }
      });
      return this.meetingAgendaView(s, meetingId);
    },

    addAgendaLine: async (actorId, meetingId, sectionKey) => {
      const section = assertAgendaSectionKey(sectionKey);
      const s = await this.ready();
      const itemId = s.transaction(() => {
        const meeting = this.requireMeetingRow(s, meetingId) as unknown as Meeting;
        assertMayEditLiveAgenda(this.memberWriteActor(s, actorId), meeting, `add a line to the agenda of meeting ${meetingId}`);
        const items = s.rows('MeetingAgendaItem').filter((i) => i.MeetingID === meetingId) as unknown as MeetingAgendaItem[];
        const motionIds = s.rows('ProposedMotion').filter((p) => p.TargetMeetingID === meetingId).map((p) => p.id as number);
        return s.insert('MeetingAgendaItem', {
          CouncilID: meeting.CouncilID,
          MeetingID: meetingId,
          SectionKey: section,
          SortOrder: nextAgendaSortOrder(section, items, motionIds),
          LineMarkdown: '',
          LastEditedByMemberID: actorId,
          LastEditedAt: toTimestamp(this.now()),
        }).id as number;
      });
      const agenda = this.meetingAgendaView(s, meetingId);
      const line = agenda.sections.flatMap((sec) => sec.lines).find((l) => l.key === `item:${itemId}`)!;
      return { agenda, line };
    },

    recordHandBallotTally: async (actorId, motionId, approvedCount, deniedCount, options = {}) => {
      const counts = cleanHandTally(approvedCount, deniedCount);
      const transactionId = cleanTransactionId(options.transactionId);
      const result = handTallyResult(counts.approved, counts.denied);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const motion = s.rows('ProposedMotion').find((p) => p.id === motionId);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = this.requireMeetingRow(s, motion.TargetMeetingID as number) as unknown as Meeting;
        assertMayEditLiveAgenda(actor, meeting, `record the hand tally on motion ${motionId}`);
        assertHandTallyAllowed(motion as unknown as ProposedMotion);
        if (transactionId !== null) {
          if (result !== 'Passed') throw capitalOnFailedMotion(motionId);
          this.requireLedgerTransaction(s, meeting.CouncilID, transactionId);
        }
        const tally = s.insert('MotionHandTally', {
          CouncilID: meeting.CouncilID,
          ProposedMotionID: motionId,
          ApprovedCount: counts.approved,
          DeniedCount: counts.denied,
          RecordedByMemberID: actorId,
          RecordedAt: toTimestamp(this.now()),
          LinkedTransactionID: transactionId,
        });
        motion.VoteResult = result;
        let charitableRequest: CharitableRequest | null = null;
        if (motion.SourceType === 'CharitableRequest' && motion.SourceRecordID != null) {
          const request = s.rows('CharitableRequest').find((r) => r.id === motion.SourceRecordID);
          if (request) {
            const outcome = charitableVoteOutcome(result, request as unknown as CharitableRequest);
            if (outcome) Object.assign(request, outcome);
            this.tagCharitableBudgetFallback(s, request);
            charitableRequest = { ...request } as unknown as CharitableRequest;
          }
        }
        return { tally: { ...tally } as unknown as MotionHandTally, motion: { ...motion } as unknown as ProposedMotion, charitableRequest };
      });
    },

    linkHandTallyTransaction: async (actorId, motionId, transactionIdInput) => {
      const transactionId = cleanTransactionId(transactionIdInput);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const motion = s.rows('ProposedMotion').find((p) => p.id === motionId);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = this.requireMeetingRow(s, motion.TargetMeetingID as number) as unknown as Meeting;
        if (!mayPostGeneralLedger(actor, meeting.CouncilID)) assertMayEditLiveAgenda(actor, meeting, `link the capital released for motion ${motionId}`);
        const tally = s.rows('MotionHandTally').find((t) => t.ProposedMotionID === motionId);
        if (!tally) throw handTallyNotFound(motionId);
        if (motion.VoteResult !== 'Passed') throw capitalOnFailedMotion(motionId);
        if (transactionId !== null) this.requireLedgerTransaction(s, meeting.CouncilID, transactionId);
        tally.LinkedTransactionID = transactionId;
        return { ...tally } as unknown as MotionHandTally;
      });
    },
  };

  /** RECORD_NOT_FOUND unless the council's ledger holds a posting with this TransactionID. */
  private requireLedgerTransaction(s: MemoryStore, councilId: number, transactionId: string): void {
    if (!s.rows('JournalEntry').some((e) => e.CouncilID === councilId && e.TransactionID === transactionId)) {
      throw ledgerTransactionNotFound(transactionId, councilId);
    }
  }

  /** MeetingAgendaView of the meeting, from its items, motions and hand tallies and its council's seats and events. */
  private meetingAgendaView(s: MemoryStore, meetingId: number): MeetingAgendaView {
    const meeting = { ...this.requireMeetingRow(s, meetingId) } as unknown as Meeting;
    const motions = s.rows('ProposedMotion').filter((p) => p.TargetMeetingID === meetingId).map((p) => ({ ...p })) as unknown as ProposedMotion[];
    const motionIds = new Set(motions.map((m) => m.id));
    const eventIds = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === meeting.CouncilID).map((ec) => ec.EventID as number));
    const active = this.activeStatusId(s);
    return buildMeetingAgendaView({
      meeting,
      items: s.rows('MeetingAgendaItem').filter((i) => i.MeetingID === meetingId).map((i) => ({ ...i })) as unknown as MeetingAgendaItem[],
      motions,
      handTallies: s.rows('MotionHandTally').filter((t) => motionIds.has(t.ProposedMotionID as number)).map((t) => ({ ...t })) as unknown as MotionHandTally[],
      events: s.rows('Event').filter((e) => eventIds.has(e.id as number)).map((e) => ({ ...e })) as unknown as Event[],
      roles: s.rows('Role').map((r) => ({ id: r.id as number, Role: r.Role as string, Officer: r.Officer as number })),
      seats: s.rows('MemberRoles').map((mr) => ({ id: mr.id as number, RoleID: mr.RoleID as number, MemberID: mr.MemberID as number })),
      members: s.rows('Member').map((m) => ({
        id: m.id as number,
        CouncilID: m.CouncilID as number,
        MemberFirstName: m.MemberFirstName as string,
        MemberLastName: m.MemberLastName as string,
        active: m.StatusID === active,
      })),
    });
  }

  /** A meeting row of the store (inside a transaction, its working copy); an unknown id rejects MEETING_NOT_FOUND. */
  private requireMeetingRow(s: MemoryStore, meetingId: number): Row {
    const row = s.rows('Meeting').find((m) => m.id === meetingId);
    if (!row) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
    return row as Row;
  }

  /** LiveAssemblyState for `viewerId`, who has voted on a motion when one of its ballots carries the viewer's hash. */
  private async liveAssemblyState(s: MemoryStore, viewerId: number, meetingId: number): Promise<LiveAssemblyState> {
    const meeting = { ...this.requireMeetingRow(s, meetingId) } as unknown as Meeting;
    const motions = s.rows('ProposedMotion').filter((p) => p.TargetMeetingID === meetingId).map((p) => ({ ...p })) as unknown as ProposedMotion[];
    const motionIds = new Set(motions.map((m) => m.id));
    const votes = s.rows('BallotVote').filter((v) => motionIds.has(v.ProposedMotionID as number)).map((v) => ({ ...v })) as unknown as BallotVote[];
    const voted = new Set<number>();
    for (const m of motions) {
      const hash = await sha256Hex(ballotHashInput(this.ballotSecret, m.id, viewerId));
      if (votes.some((v) => v.ProposedMotionID === m.id && v.AnonymousBallotHash === hash)) voted.add(m.id);
    }
    return buildLiveAssemblyState({
      meeting,
      motions,
      votes,
      checkedInMemberIds: s.rows('LiveAttendance').filter((a) => a.MeetingID === meetingId).map((a) => a.MemberID as number),
      viewerId,
      viewerVotedMotionIds: voted,
      now: this.now(),
      handTallies: s.rows('MotionHandTally').filter((t) => motionIds.has(t.ProposedMotionID as number)).map((t) => ({ ...t })) as unknown as MotionHandTally[],
    });
  }

  /** A CouncilMeetingType of `councilId`; another council's type or an unknown id rejects INVALID_INPUT. */
  private requireCouncilMeetingType(s: MemoryStore, councilId: number, meetingTypeId: number): Row {
    const type = s.rows('CouncilMeetingType').find((t) => t.id === meetingTypeId && t.CouncilID === councilId);
    if (!type) {
      throw new BusinessRuleError('INVALID_INPUT', `Council ${councilId} has no meeting type with id ${meetingTypeId}.`, { councilId, meetingTypeId });
    }
    return type;
  }

  // ---- shifts ------------------------------------------------------------

  shifts: DataService['shifts'] = {
    getShiftDefaultLength: async (shiftId) => {
      const s = await this.ready();
      return shiftDefaultLengthHours(this.requireShift(s, shiftId) as unknown as Shift);
    },
  };

  private insertMeeting(m: NewMeeting, invite: MeetingInviteMode): number {
    const ownerId = m.OwnerID ?? null;
    if (ownerId !== null && !this.store.rows('Member').some((x) => x.id === ownerId)) {
      throw new BusinessRuleError('INVALID_INPUT', `No member with id ${ownerId} to own the meeting.`, { ownerId });
    }
    const span = cleanMeetingSpan(m);
    const meetingTypeId = m.MeetingTypeID ?? null;
    if (meetingTypeId !== null) this.requireCouncilMeetingType(this.store, m.CouncilID, meetingTypeId);
    const row = this.store.insert('Meeting', {
      OwnerID: ownerId,
      CouncilID: m.CouncilID,
      'Meeting Name': m['Meeting Name'],
      'Meeting Description': m['Meeting Description'] ?? null,
      Date: m.Date,
      'Time Start': span['Time Start'],
      'Time End': span['Time End'],
      IsMultiDay: span.IsMultiDay,
      EndDate: span.EndDate,
      MeetingTypeID: meetingTypeId,
      Location: m.Location,
      Agenda: m.Agenda ?? '', // Agenda and MinutesURL are NOT NULL in Schema.sql: '' means "none yet"
      MinutesURL: m.MinutesURL ?? '',
      MeetingType: m.MeetingType,
      InviteReleaseDate: m.InviteReleaseDate == null ? null : assertIsoDate(m.InviteReleaseDate, 'Invitation release date'),
    });
    const meetingId = row.id as number;
    this.insertInvites(meetingId, this.resolveInvitees(m.CouncilID, invite));
    return meetingId;
  }

  private resolveInvitees(councilId: number, mode: MeetingInviteMode): number[] {
    if (mode === 'none') return [];
    if (typeof mode === 'object') return mode.memberIds;
    const activeId = this.activeStatusId(this.store);
    return this.store
      .rows('Member')
      .filter((m) => m.CouncilID === councilId && m.StatusID === activeId)
      .filter((m) => mode === 'allActive' || this.rolesFor(this.store, m.id as number).some((r) => r.Officer === 1))
      .map((m) => m.id as number)
      .sort((a, b) => a - b);
  }

  private insertInvites(meetingId: number, memberIds: number[]): number {
    let added = 0;
    for (const memberId of new Set(memberIds)) {
      const exists = this.store.rows('MeetingInvites').some((i) => i.MeetingID === meetingId && i.MemberID === memberId);
      if (exists) continue;
      this.store.insert('MeetingInvites', { MeetingID: meetingId, MemberID: memberId, Attended: 0 });
      added++;
    }
    return added;
  }

  // ---- messages ----------------------------------------------------------

  // ---- system feedback ---------------------------------------------------

  notifications: DataService['notifications'] = {
    registerDeviceToken: async (actorId, pushToken) => {
      const token = cleanExpoPushToken(pushToken);
      const s = await this.ready();
      s.transaction(() => {
        const member = this.requireMember(s, actorId);
        // A phone belongs to whoever registered it last, so a member still holding the token lets it go.
        if (token !== null) {
          for (const other of s.rows('Member')) if (other.id !== actorId && other.ExpoPushToken === token) other.ExpoPushToken = null;
        }
        member.ExpoPushToken = token;
      });
    },

    listMemberAlerts: async (actorId) => {
      const s = await this.ready();
      this.requireMember(s, actorId);
      const since = alertHistoryThreshold(this.now());
      return sortAlerts(
        s
          .rows('NotificationLog')
          .filter((n) => n.TargetMemberID === actorId && (n.SentAt as string) >= since)
          .map((n) => ({ ...n })) as unknown as NotificationLog[],
      );
    },

    markAsRead: async (actorId, alertId) => {
      const s = await this.ready();
      this.requireMember(s, actorId);
      const row = s.rows('NotificationLog').find((n) => n.id === alertId && n.TargetMemberID === actorId);
      if (!row) throw alertNotFound(alertId);
      row.IsRead = 1;
      return { ...row } as unknown as NotificationLog;
    },

    dispatchHighPriorityAlert: async (actorId, councilId, filters, payload) => {
      const target = cleanAlertFilters(filters);
      const alert = cleanAlertPayload(payload);
      const s = await this.ready();
      const logs = s.transaction(() => {
        assertMayDispatchCouncilAlerts(this.memberWriteActor(s, actorId), councilId, `send alerts to council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        for (const skillId of target.skillIds) {
          if (!s.rows('Skill').some((r) => r.id === skillId)) throw new BusinessRuleError('INVALID_INPUT', `No skill with id ${skillId}.`, { skillId });
        }
        for (const shiftId of target.shiftIds) {
          const shift = s.rows('Shift').find((r) => r.id === shiftId);
          if (!shift || !this.councilIdsOf(s, shift.EventID as number).includes(councilId)) {
            throw new BusinessRuleError('INVALID_INPUT', `Shift ${shiftId} is not on an event of council ${councilId}.`, { shiftId, councilId });
          }
        }
        const skills = new Set<SeedValue>(target.skillIds);
        const shifts = new Set<SeedValue>(target.shiftIds);
        const skillHolders = new Set(s.rows('MemberSkill').filter((r) => skills.has(r.SkillID)).map((r) => r.MemberID));
        const roster = new Set(s.rows('EventSignup').filter((r) => shifts.has(r.ShiftID)).map((r) => r.MemberID));
        const activeId = this.activeStatusId(s);
        // Skill networks stay inside the council; a shift roster includes sister-council volunteers on a shared event.
        const recipientIds = s
          .rows('Member')
          .filter((m) => m.StatusID === activeId && ((m.CouncilID === councilId && skillHolders.has(m.id)) || roster.has(m.id)))
          .map((m) => m.id as number)
          .sort((a, b) => a - b);
        if (recipientIds.length === 0) throw noAlertRecipients(councilId, target);
        const sentAt = toTimestamp(this.now());
        return recipientIds.map((memberId) => {
          const row = s.insert('NotificationLog', {
            CouncilID: councilId,
            TargetMemberID: memberId,
            Title: alert.title,
            MessageBody: alert.body,
            Priority: alert.priority,
            SentAt: sentAt,
            IsRead: 0,
          });
          return { ...row } as unknown as NotificationLog;
        });
      });
      const tokens = new Map(logs.map((l) => [l.TargetMemberID, (this.requireMember(s, l.TargetMemberID).ExpoPushToken as string | null) ?? null]));
      return deliverAlertsByStub(logs, tokens, this.log);
    },
  };

  supreme: DataService['supreme'] = {
    previewReport: async (actorId, councilId, formType, period) => {
      const s = await this.ready();
      return this.compileSupremeReport(s, actorId, councilId, formType, period);
    },

    syncAlchemerReport: async (actorId, councilId, formType, surveyId, period) => {
      const survey = cleanAlchemerSurveyId(surveyId);
      const s = await this.ready();
      const snapshot = this.compileSupremeReport(s, actorId, councilId, formType, period);
      const form = snapshot.formType;
      const request = buildAlchemerRequest(survey, alchemerAnswers(snapshot));
      const { status, error } = await postAlchemerReport(this.postAlchemer, request);
      const row = s.insert('SupremeReportingSync', {
        CouncilID: councilId,
        FormType: form,
        SyncDate: toTimestamp(this.now()),
        SyncedByID: actorId,
        AlchemerSurveyID: survey,
        Status: status,
      });
      return { sync: { ...row } as unknown as SupremeReportingSync, snapshot, request, error };
    },

    syncSupremeRoster: async (actorId, councilId, rows) => {
      const s = await this.ready();
      const result = s.transaction((): SupremeRosterSyncResult => {
        assertMayImportSupremeRoster(this.memberWriteActor(s, actorId), councilId);
        this.assertCouncilsExist(s, [councilId]);
        this.assertFraternalCouncil(s, councilId, 'import the Supreme Council roster');
        const memberTypeId = s.rows('MemberType').find((t) => t.Type === 'Member')?.id as number;
        const ids = { activeStatusId: this.activeStatusId(s) as number, memberTypeId };
        const out: SupremeRosterSyncResult = { created: [], updated: [], skipped: [] };
        const seen = new Set<number>();
        for (const row of Array.isArray(rows) ? rows : []) {
          const memberNumber = rosterMemberNumber(row);
          if (memberNumber === null) {
            out.skipped.push({ memberNumber: null, reason: 'The row has no member number.' });
            continue;
          }
          if (seen.has(memberNumber)) {
            out.skipped.push({ memberNumber, reason: 'The member number appears twice in this roster.' });
            continue;
          }
          seen.add(memberNumber);
          try {
            const existing = s.rows('Member').find((m) => m.CouncilID === councilId && m.MemberNumber === memberNumber);
            if (existing) {
              const joined = cleanRosterJoinDate(row.DateJoinedCouncil, this.now());
              if ((existing.DateJoinedCouncil ?? null) !== joined) {
                existing.DateJoinedCouncil = joined;
                out.updated.push(withoutPushToken({ ...existing }) as unknown as Member);
              }
              continue;
            }
            const clean = cleanSupremeRosterRow(row, councilId, ids, this.now());
            const email = clean.Email.toLowerCase();
            if (s.rows('Member').some((m) => lower(m.Email) === email) || s.rows('Credentials').some((c) => lower(c.Username) === email)) {
              out.skipped.push({ memberNumber, reason: `The email ${clean.Email} already belongs to a member or login.` });
              continue;
            }
            const cred = s.insert('Credentials', { Username: clean.Email, Password: UNREGISTERED_PASSWORD });
            const values: Record<string, SeedValue | undefined> = { CredentialID: cred.id };
            for (const c of MEMBER_COLUMNS) values[c] = clean[c] ?? null;
            out.created.push(withoutPushToken({ ...s.insert('Member', values) }) as unknown as Member);
          } catch (err) {
            if (!(err instanceof BusinessRuleError) || err instanceof SecurityPrivilegeError) throw err;
            out.skipped.push({ memberNumber, reason: describeError(err) });
          }
        }
        return out;
      });
      // The post-insert hook: every new member gets the welcome email the moment the batch is stored.
      for (const member of result.created) await this.sendWelcomeEmail(s, member);
      return result;
    },

    listSyncHistory: async (actorId, councilId) => {
      const s = await this.ready();
      assertMaySyncSupremeReports(this.memberWriteActor(s, actorId), councilId, `read the Supreme sync history of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      this.assertFraternalCouncil(s, councilId, 'read the Supreme Council sync history');
      return buildSyncHistory(
        s.rows('SupremeReportingSync').filter((r) => r.CouncilID === councilId).map((r) => ({ ...r })) as unknown as SupremeReportingSync[],
        s.rows('Member') as unknown as Member[],
      );
    },
  };

  /** Checks the caller and compiles the snapshot; the store is synchronous, so the read is consistent. */
  private compileSupremeReport(
    s: MemoryStore,
    actorId: number,
    councilId: number,
    formType: SupremeFormType,
    choice: SupremePeriodChoice | undefined,
  ): SupremeComplianceSnapshot {
    const form = cleanSupremeFormType(formType);
    const period = resolveSupremePeriod(form, choice, this.now());
    assertMaySyncSupremeReports(this.memberWriteActor(s, actorId), councilId, `file Supreme reports for council ${councilId}`);
    this.assertCouncilsExist(s, [councilId]);
    this.assertFraternalCouncil(s, councilId, 'file a Supreme Council report');
    return compileSupremeSnapshot(form, period, this.supremeSnapshotRows(s, councilId, period));
  }

  /** The council's hours, events, donations and expense checks in the period, for compileSupremeSnapshot. */
  private supremeSnapshotRows(s: MemoryStore, councilId: number, period: SupremeReportingPeriod): SupremeSnapshotRows {
    const inPeriod = (date: SeedValue | undefined) => (date as string) >= period.fromDate && (date as string) <= period.toDate;
    const categoryName = (id: SeedValue | undefined) => (s.rows('Category').find((c) => c.id === id)?.Category as string | undefined) ?? 'Uncategorized';
    const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
    const councilEvents = s.rows('Event').filter((e) => linked.has(e.id));
    const eventCategory = new Map(councilEvents.map((e) => [e.id, categoryName(e.CategoryID)]));
    const shiftCategory = new Map(
      s
        .rows('Shift')
        .filter((sh) => eventCategory.has(sh.EventID) && inPeriod(sh.ShiftDate))
        .map((sh) => [sh.id, eventCategory.get(sh.EventID)!]),
    );
    const activityCategory = new Map(s.rows('Activities').filter((a) => a.CouncilID === councilId).map((a) => [a.id, categoryName(a.CategoryID)]));
    const methodKind = new Map(s.rows('DonationMethod').map((m) => [m.id, donationMethodKind(m.DonationMethod as string)]));
    const council = s.rows('Council').find((c) => c.id === councilId)!;
    const periodEvents = councilEvents.filter((e) => inPeriod(e.StartDate));
    const periodEventIds = new Set(periodEvents.map((e) => e.id));
    // Sprint 6I: an event's spend is the line items of the council's Approved and Reimbursed sheets linked to it.
    const spendSheets = new Set(
      s
        .rows('ExpenseReport')
        .filter((r) => r.CouncilID === councilId && periodEventIds.has(r.LinkedEventID) && EXPENSE_SPEND_STATUSES.includes(r.Status as ExpenseReportStatus))
        .map((r) => r.id),
    );
    return {
      council: { id: councilId, CouncilNumber: council.CouncilNumber as number, CouncilName: council.CouncilName as string },
      eventTime: s
        .rows('EventTime')
        .filter((t) => shiftCategory.has(t.ShiftID))
        .map((t) => ({ MemberID: t.MemberID as number, Hours: t.Hours as number, category: shiftCategory.get(t.ShiftID)! })),
      activityTime: s
        .rows('ActivityTime')
        .filter((t) => activityCategory.has(t.ActivityID) && inPeriod(t.ActivityDate))
        .map((t) => ({ MemberID: t.MemberID as number, Hours: t.Hours as number, category: activityCategory.get(t.ActivityID)! })),
      events: periodEvents.map((e) => ({ id: e.id })),
      eventExpenseItems: s
        .rows('ExpenseLineItem')
        .filter((li) => spendSheets.has(li.ExpenseReportID))
        .map((li) => ({ Amount: li.Amount as number })),
      donations: s
        .rows('Donation')
        .filter((d) => d.CouncilID === councilId && inPeriod(d.DonationDate))
        .map((d) => ({ DonationAmount: d.DonationAmount as number, kind: methodKind.get(d.DonationMethodID) ?? 'other' })),
      disbursements: s
        .rows('ExpenseDisbursement')
        .filter((d) => d.CouncilID === councilId && inPeriod(d.PayoutDate))
        .map((d) => ({ TotalAmount: d.TotalAmount as number })),
    };
  }

  // ---- officer elections (Sprint 5U) ----------------------------------------

  elections: DataService['elections'] = {
    listOfficerSeats: async (councilId) => {
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      return buildOfficerSeats(councilId, this.electionRows(s, councilId));
    },

    listBallotConfig: async (councilId) => {
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      return buildBallotSeats(this.electionRows(s, councilId), this.now());
    },

    listVacancies: async (councilId) => {
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      return buildVacancies(this.electionRows(s, councilId));
    },

    toggleRoleBallotStatus: async (actorId, councilId, roleId, isOpen) => {
      const open = cleanBallotStatus(isOpen);
      const s = await this.ready();
      return s.transaction(() => {
        assertMayConfigureBallot(this.memberWriteActor(s, actorId), councilId);
        this.assertCouncilsExist(s, [councilId]);
        assertElectedRole(requireRole(this.electionRows(s, councilId).roles, roleId));
        this.backfillLeadershipHistory(s, councilId);
        // Closing a seat also ends any mid-year election on it; opening keeps a mid-year window already running.
        return this.upsertBallot(s, councilId, roleId, open ? { IsUpForElection: 1 } : { IsUpForElection: 0, IsMidYearElection: 0, NominationsCloseAt: null });
      });
    },

    submitNomination: async (actorId, councilId, roleId, nomineeMemberId) => {
      const s = await this.ready();
      const now = this.now();
      return s.transaction(() => {
        assertMayNominate(this.memberWriteActor(s, actorId), councilId);
        this.assertCouncilsExist(s, [councilId]);
        const role = requireRole(this.electionRows(s, councilId).roles, roleId);
        assertElectedRole(role);
        this.backfillLeadershipHistory(s, councilId);
        const stored = s.rows('CouncilElectionBallot').find((b) => b.CouncilID === councilId && b.RoleID === roleId);
        const ballot = assertNominationsOpen(stored as unknown as CouncilElectionBallot | undefined, role.Role, now);
        this.assertActiveCouncilMember(s, nomineeMemberId, councilId, `nominated for ${role.Role}`);
        const fraternalYear = ballotTermYear(ballot, now);
        const seatNominations = s
          .rows('OfficerNominations')
          .filter((n) => n.CouncilID === councilId && n.OfficeRoleID === roleId && n.FraternalYear === fraternalYear);
        if (seatNominations.some((n) => n.NomineeMemberID === nomineeMemberId)) throw alreadyNominated(role.Role, nomineeMemberId, fraternalYear);
        const served = s
          .rows('CouncilLeadershipHistory')
          .filter((h) => h.MemberID === nomineeMemberId)
          .map((h) => s.rows('Role').find((r) => r.id === h.RoleID)?.Role as string);
        const eligible = isEligibleNominee(role.Role, served);
        const row = s.insert('OfficerNominations', {
          CouncilID: councilId,
          OfficeRoleID: roleId,
          NomineeMemberID: nomineeMemberId,
          NominatedByMemberID: actorId,
          NominatedAt: toTimestamp(now),
          FraternalYear: fraternalYear,
          IsEligible: eligible ? 1 : 0,
        });
        return { nomination: { ...row } as unknown as OfficerNominations, eligible, tally: seatNominations.length + 1 };
      });
    },

    recordOfficerAbdication: async (actorId, councilId, memberId, roleId) => {
      const s = await this.ready();
      const now = this.now();
      return s.transaction(() => {
        assertMayRecordAbdication(this.memberWriteActor(s, actorId), councilId, memberId);
        this.assertCouncilsExist(s, [councilId]);
        const role = requireRole(this.electionRows(s, councilId).roles, roleId);
        const kind = assertOfficeRole(role);
        const member = s.rows('Member').find((m) => m.id === memberId);
        if (member?.CouncilID !== councilId || !s.rows('MemberRoles').some((mr) => mr.MemberID === memberId && mr.RoleID === roleId)) {
          throw roleNotHeld(memberId, role.Role, councilId);
        }
        this.backfillLeadershipHistory(s, councilId);
        const term = this.openTerm(s, councilId, memberId, roleId);
        if (term) Object.assign(term, { EndDate: toIsoDate(now), ExitReason: 'Abdicated' });
        s.remove('MemberRoles', (mr) => mr.MemberID === memberId && mr.RoleID === roleId);
        const ballot =
          kind === 'elected'
            ? this.upsertBallot(s, councilId, roleId, { IsUpForElection: 1, IsMidYearElection: 1, NominationsCloseAt: midYearNominationsCloseAt(now) })
            : null;
        return {
          history: term ? ({ ...term } as unknown as CouncilLeadershipHistory) : null,
          outcome: kind === 'elected' ? 'MidYearElection' : 'AwaitingAppointment',
          ballot,
        };
      });
    },

    assignAppointedRole: async (actorId, councilId, roleId, targetMemberId) => {
      const s = await this.ready();
      const now = this.now();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        this.assertCouncilsExist(s, [councilId]);
        const rows = this.electionRows(s, councilId);
        assertMayAppointOfficers(actor, councilId, seatHolderIdByName(rows, GRAND_KNIGHT_ROLE));
        const role = requireRole(rows.roles, roleId);
        assertAppointableRole(role);
        const holder = seatHolderId(rows, roleId);
        if (holder !== null) throw roleOccupied(role.Role, holder);
        this.assertActiveCouncilMember(s, targetMemberId, councilId, `appointed ${role.Role}`);
        assertOneTrusteeSeat(role, this.rolesFor(s, targetMemberId).map((r) => r.Role), targetMemberId);
        this.backfillLeadershipHistory(s, councilId);
        s.insert('MemberRoles', { RoleID: roleId, MemberID: targetMemberId });
        const term = s.insert('CouncilLeadershipHistory', {
          CouncilID: councilId,
          MemberID: targetMemberId,
          RoleID: roleId,
          FraternalYear: fraternalYearOf(now),
          StartDate: toIsoDate(now),
          AppointedByID: actorId,
        });
        return { ...term } as unknown as CouncilLeadershipHistory;
      });
    },

    concludeFraternalYear: async (actorId, councilId, newGrandKnightId) => {
      const s = await this.ready();
      const now = this.now();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        this.assertCouncilsExist(s, [councilId]);
        assertMayConcludeFraternalYear(actor, councilId, seatHolderIdByName(this.electionRows(s, councilId), GRAND_KNIGHT_ROLE));
        this.assertActiveCouncilMember(s, newGrandKnightId, councilId, 'seated as Grand Knight');
        this.backfillLeadershipHistory(s, councilId);
        const rows = this.electionRows(s, councilId);
        const plan = planConclusionFromSeats(buildOfficerSeats(councilId, rows), newGrandKnightId);
        const fraternalYear = electionTermYear(now);
        this.applySeatTransitions(s, councilId, rows, plan.transitions, fraternalYear, toIsoDate(now));
        const ballotsReset = s.remove('CouncilElectionBallot', (b) => b.CouncilID === councilId);
        return conclusionResult(plan, rows.roles, fraternalYear, ballotsReset);
      });
    },
  };

  /** Everything the election views read for one council (elections.ts ElectionRows), copied out of the store. */
  private electionRows(s: MemoryStore, councilId: number): ElectionRows {
    const inCouncil = new Set(s.rows('Member').filter((m) => m.CouncilID === councilId).map((m) => m.id));
    const copy = <T>(rows: readonly Row[]) => rows.map((r) => ({ ...r })) as unknown as T[];
    return {
      roles: copy<Role>(s.rows('Role')),
      members: s.rows('Member').map((m) => ({ id: m.id as number, MemberFirstName: m.MemberFirstName as string, MemberLastName: m.MemberLastName as string })),
      holdings: s
        .rows('MemberRoles')
        .filter((h) => inCouncil.has(h.MemberID))
        .map((h) => ({ RoleID: h.RoleID as number, MemberID: h.MemberID as number })),
      history: copy<CouncilLeadershipHistory>(s.rows('CouncilLeadershipHistory').filter((h) => h.CouncilID === councilId)),
      ballots: copy<CouncilElectionBallot>(s.rows('CouncilElectionBallot').filter((b) => b.CouncilID === councilId)),
      nominations: copy<OfficerNominations>(s.rows('OfficerNominations').filter((n) => n.CouncilID === councilId)),
    };
  }

  /** Opens a history row for every Active office holder of the council who has none (planHistoryBackfill). */
  private backfillLeadershipHistory(s: MemoryStore, councilId: number): void {
    const activeId = this.activeStatusId(s);
    const active = new Set(s.rows('Member').filter((m) => m.CouncilID === councilId && m.StatusID === activeId).map((m) => m.id as number));
    for (const term of planHistoryBackfill(councilId, this.electionRows(s, councilId), active, this.now())) {
      s.insert('CouncilLeadershipHistory', { ...term });
    }
  }

  /** The stored (mutable) open history row of a member's seat. */
  private openTerm(s: MemoryStore, councilId: number, memberId: number, roleId: number): Row | undefined {
    return s
      .rows('CouncilLeadershipHistory')
      .find((h) => h.CouncilID === councilId && h.MemberID === memberId && h.RoleID === roleId && h.EndDate == null) as Row | undefined;
  }

  private upsertBallot(s: MemoryStore, councilId: number, roleId: number, fields: Partial<CouncilElectionBallot>): CouncilElectionBallot {
    const existing = s.rows('CouncilElectionBallot').find((b) => b.CouncilID === councilId && b.RoleID === roleId) as Row | undefined;
    const row = existing ? Object.assign(existing, fields) : s.insert('CouncilElectionBallot', { CouncilID: councilId, RoleID: roleId, ...fields });
    return { ...row } as unknown as CouncilElectionBallot;
  }

  /** NOT_ACTIVE_COUNCIL_MEMBER unless `memberId` is an Active member of the council. */
  private assertActiveCouncilMember(s: MemoryStore, memberId: number, councilId: number, purpose: string): void {
    const m = s.rows('Member').find((r) => r.id === memberId);
    assertActiveCouncilMember(
      m ? { id: m.id as number, CouncilID: m.CouncilID as number } : null,
      m?.StatusID === this.activeStatusId(s),
      councilId,
      purpose,
    );
  }

  /**
   * Carries out a conclusion plan: every departing holder's term closes 'TermConcluded' and their role goes; then every
   * arriving holder gets the role and a term in `fraternalYear`. A renewal (same member) closes and reopens the term.
   */
  private applySeatTransitions(
    s: MemoryStore,
    councilId: number,
    rows: ElectionRows,
    transitions: readonly SeatTransition[],
    fraternalYear: string,
    today: string,
  ): void {
    const roleId = (name: string) => rows.roles.find((r) => r.Role === name)!.id;
    for (const t of transitions) {
      if (t.from === null) continue;
      const term = this.openTerm(s, councilId, t.from, roleId(t.roleName));
      if (term) Object.assign(term, { EndDate: today, ExitReason: 'TermConcluded' });
      if (t.from !== t.to) s.remove('MemberRoles', (mr) => mr.MemberID === t.from && mr.RoleID === roleId(t.roleName));
    }
    for (const t of transitions) {
      if (t.to === null) continue;
      if (t.from !== t.to) s.insert('MemberRoles', { RoleID: roleId(t.roleName), MemberID: t.to });
      s.insert('CouncilLeadershipHistory', { CouncilID: councilId, MemberID: t.to, RoleID: roleId(t.roleName), FraternalYear: fraternalYear, StartDate: today });
    }
  }

  // ---- charitable giving (Sprint 5V) ----------------------------------------

  charities: DataService['charities'] = {
    searchGlobalRegistry: async (actorId, filters) => {
      const search = cleanCharitySearchFilters(filters);
      const s = await this.ready();
      this.requireMember(s, actorId);
      return searchCharityRegistry(this.charityRows(s), search).map((c) => ({ ...c }));
    },

    listSuggestedLocal: async (actorId, councilId, stateCode) => {
      const state = normalizeStateCode(stateCode, 'State code');
      const s = await this.ready();
      assertMayProposeCharityGift(this.memberWriteActor(s, actorId), councilId, `see the charity suggestions of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      const linked = s
        .rows('CouncilCharityLink')
        .filter((l) => l.CouncilID === councilId)
        .map((l) => l.CharityID as number);
      return suggestLocalCharities(this.charityRows(s), state, linked).map((c) => ({ ...c }));
    },

    connectCouncilToCharity: async (actorId, councilId, charityId) => {
      const s = await this.ready();
      return s.transaction(() => {
        assertMayConnectCouncilCharity(this.memberWriteActor(s, actorId), councilId, `connect council ${councilId} to a charity`);
        this.assertCouncilsExist(s, [councilId]);
        this.requireCharity(s, charityId);
        return { ...this.linkCharity(s, councilId, charityId) } as unknown as CouncilCharityLink;
      });
    },

    proposeDonation: async (actorId, councilId, data) => {
      const clean = cleanCharityProposal(data);
      const s = await this.ready();
      const row = s.transaction(() => {
        assertMayProposeCharityGift(this.memberWriteActor(s, actorId), councilId, `propose gifts for council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        const charity = clean.ExistingCharityID === null ? null : this.requireCharity(s, clean.ExistingCharityID);
        return s.insert('CharityDonationProposal', {
          CouncilID: councilId,
          SubmitterMemberID: actorId,
          ProposedCharityName: clean.ProposedCharityName ?? (charity!.Name as string),
          ProposedAmount: clean.ProposedAmount,
          ExistingCharityID: clean.ExistingCharityID,
          Status: 'Pending',
        });
      });
      return { ...row } as unknown as CharityDonationProposal;
    },

    addGlobalCharity: async (actorId, globalCharityData) => {
      const clean = cleanGlobalCharity(globalCharityData);
      const s = await this.ready();
      const row = s.transaction(() => {
        assertMayAddGlobalCharity(this.memberWriteActor(s, actorId));
        const existing = findRegisteredCharity(this.charityRows(s), clean);
        if (existing) throw charityAlreadyRegistered(existing);
        return s.insert('GlobalCharityRegistry', { ...clean });
      });
      return { ...row } as unknown as GlobalCharityRegistry;
    },

    hydrateAndDisburse: async (actorId, councilId, proposalId, checkDetails, globalCharityData) => {
      const check = cleanCharityCheck(checkDetails);
      const incoming = globalCharityData === undefined ? null : cleanGlobalCharity(globalCharityData);
      assertOneCharitySource(check, incoming !== null);
      const s = await this.ready();
      return s.transaction(() => {
        assertMayDisburseCharity(this.memberWriteActor(s, actorId), councilId, `record charity checks for council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        // Inside a transaction the store works on copied rows, so the proposal found here is the one to change.
        const proposal = s.rows('CharityDonationProposal').find((p) => p.id === proposalId && p.CouncilID === councilId);
        if (!proposal) throw charityProposalNotFound(proposalId);
        assertProposalPending(proposal as unknown as CharityDonationProposal, 'be paid');
        if (check.MeetingMinutesID !== null) {
          const meeting = s.rows('Meeting').find((m) => m.id === check.MeetingMinutesID) as unknown as Meeting | undefined;
          assertMinutesMeetingInCouncil(meeting, check.MeetingMinutesID, councilId);
        }
        assertCheckNumberUnused(check.CheckNumber, councilId, this.councilCheckNumbers(s, councilId));

        let charity: Row;
        let charityRegistered = false;
        if (incoming) {
          const existing = findRegisteredCharity(this.charityRows(s), incoming) as unknown as Row | undefined;
          if (existing) {
            charity = Object.assign(existing, charityBlankFills(existing as unknown as GlobalCharityRegistry, incoming));
          } else {
            charity = s.insert('GlobalCharityRegistry', { ...incoming });
            charityRegistered = true;
          }
        } else if (check.CharityID !== null) {
          charity = this.requireCharity(s, check.CharityID);
        } else if (proposal.ExistingCharityID != null) {
          charity = this.requireCharity(s, proposal.ExistingCharityID as number);
        } else {
          throw noCharityToPay(proposalId);
        }

        const link = this.linkCharity(s, councilId, charity.id as number);
        const disbursement = s.insert('CharitableDisbursementLedger', {
          CouncilID: councilId,
          CharityID: charity.id,
          Amount: check.Amount ?? (proposal.ProposedAmount as number),
          CheckNumber: check.CheckNumber,
          DisbursedByID: actorId,
          PayoutDate: check.PayoutDate,
          Notes: check.Notes,
          ProposalID: proposalId,
        });
        Object.assign(proposal, {
          Status: 'Approved',
          ExistingCharityID: charity.id,
          MeetingMinutesID: check.MeetingMinutesID ?? proposal.MeetingMinutesID,
        });
        return {
          charity: { ...charity } as unknown as GlobalCharityRegistry,
          charityRegistered,
          link: { ...link } as unknown as CouncilCharityLink,
          proposal: { ...proposal } as unknown as CharityDonationProposal,
          disbursement: { ...disbursement } as unknown as CharitableDisbursementLedger,
        };
      });
    },

    listMyProposals: async (actorId) => {
      const s = await this.ready();
      this.requireMember(s, actorId);
      return this.charityProposalDetails(s, (p) => p.SubmitterMemberID === actorId, 'newest');
    },

    listCouncilProposals: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayReviewCharityProposals(this.memberWriteActor(s, actorId), councilId, `review the charity proposals of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return this.charityProposalDetails(s, (p) => p.CouncilID === councilId, 'queue');
    },

    listCouncilLedger: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayReviewCharityProposals(this.memberWriteActor(s, actorId), councilId, `read the charity ledger of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return buildCouncilCharityLedger(
        s.rows('CouncilCharityLink').filter((l) => l.CouncilID === councilId) as unknown as CouncilCharityLink[],
        this.charityRows(s),
        s.rows('CharitableDisbursementLedger').filter((d) => d.CouncilID === councilId) as unknown as CharitableDisbursementLedger[],
      ).map((e) => ({ ...e, charity: { ...e.charity }, disbursements: e.disbursements.map((d) => ({ ...d })) }));
    },

    rejectProposal: async (actorId, proposalId, reason) => {
      const clean = cleanRejectionReason(reason);
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const proposal = s.rows('CharityDonationProposal').find((p) => p.id === proposalId);
        if (!proposal) throw charityProposalNotFound(proposalId);
        assertMayReviewCharityProposals(actor, proposal.CouncilID as number, `reject charity proposal ${proposalId}`);
        assertProposalPending(proposal as unknown as CharityDonationProposal, 'be rejected');
        Object.assign(proposal, { Status: 'Rejected', RejectionReason: clean });
      });
      return this.charityProposalDetails(s, (p) => p.id === proposalId, 'newest')[0];
    },

    listCouncilRelationshipTypes: async (councilId) => {
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      return this.relationshipTypes(s, councilId).map((t) => ({ ...t }));
    },

    listCouncilMissionAreas: async (councilId) => {
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      return (s.rows('CouncilMissionArea').filter((a) => a.CouncilID === councilId).map((a) => ({ ...a })) as unknown as CouncilMissionArea[]).sort(
        (a, b) => (a.MissionAreaName < b.MissionAreaName ? -1 : a.MissionAreaName > b.MissionAreaName ? 1 : a.id - b.id), // binary order, as SQLite's ORDER BY
      );
    },

    listApprovedFundingQueue: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayAuditCouncilExpenses(this.memberWriteActor(s, actorId), councilId, `read the charitable funding queue of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return s
        .rows('CharitableRequest')
        .filter((r) => r.CouncilID === councilId && r.VoteStatus === 'Approved' && r.PaymentOrderId == null)
        .sort((a, b) => (a.id as number) - (b.id as number))
        .map((r) => ({ ...r }) as unknown as CharitableRequest);
    },

    listCharitableRequestsQueue: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayVetCharitableRequests(this.memberWriteActor(s, actorId), councilId, `read the charitable request queue of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return this.charitableRequestDetails(s, (r) => r.CouncilID === councilId);
    },

    listMyCharitableRequests: async (actorId) => {
      const s = await this.ready();
      this.requireMember(s, actorId);
      return this.charitableRequestDetails(s, (r) => r.ShepherdMemberID === actorId).sort((a, b) => b.request.id - a.request.id);
    },

    submitCharitableRequest: async (actorId, requestData) => {
      const clean = cleanCharitableRequest(requestData);
      const s = await this.ready();
      const row = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        assertMayProposeCharityGift(actor, actor.councilId, 'submit a charitable request');
        assertCouncilRelationshipType(clean.RelationshipTypeID, this.relationshipTypes(s, actor.councilId), actor.councilId);
        assertCouncilMissionArea(clean.MissionAreaID, s.rows('CouncilMissionArea') as unknown as CouncilMissionArea[], actor.councilId);
        return s.insert('CharitableRequest', {
          ...rowValues(CHARITABLE_REQUEST_FORM_COLUMNS, clean),
          CouncilID: actor.councilId,
          ShepherdMemberID: actorId,
          RequestStatus: 'Submitted',
          SubmittedAt: toTimestamp(this.now()),
          VoteStatus: 'Pending',
          AmountApproved: 0,
        });
      });
      return this.charitableRequestDetails(s, (r) => r.id === row.id)[0];
    },

    triageRequestStatus: async (actorId, requestId, vettingData) => {
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const request = s.rows('CharitableRequest').find((r) => r.id === requestId);
        if (!request) throw charitableRequestNotFound(requestId);
        const councilId = request.CouncilID as number;
        assertMayVetCharitableRequests(actor, councilId, `vet charitable request ${requestId}`);
        assertIndependentVetter(actor, request as unknown as CharitableRequest);
        const changes = planCharitableTriage(request as unknown as CharitableRequest, actorId, mayOverrideVettingClaim(actor, councilId), vettingData, this.now());
        if (changes.TargetBudgetLineID != null) {
          const line = s.rows('CouncilBudgetForecast').find((l) => l.id === changes.TargetBudgetLineID);
          assertCouncilBudgetLine(changes.TargetBudgetLineID, line as unknown as CouncilBudgetForecast | undefined, councilId);
        }
        Object.assign(request, changes);
      });
      return this.charitableRequestDetails(s, (r) => r.id === requestId)[0];
    },

    listLinkableCharitableRequests: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayProposeCharityGift(this.memberWriteActor(s, actorId), councilId, `read the charitable requests of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return linkableCharitableRequests(s.rows('CharitableRequest') as unknown as CharitableRequest[], councilId);
    },

    listRequestThreads: async (actorId, requestId) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const request = s.rows('CharitableRequest').find((r) => r.id === requestId) as unknown as CharitableRequest | undefined;
      if (!request) throw charitableRequestNotFound(requestId);
      const threads = this.copyRows<CharitableRequestThread>(s, 'CharitableRequestThread', (t) => t.request_id === requestId);
      const ids = new Set(threads.map((t) => t.id));
      return buildCharitableRequestThreads(
        actor,
        { ...request },
        threads,
        this.copyRows<CharitableRequestThreadMessage>(s, 'CharitableRequestThreadMessage', (m) => ids.has(m.thread_id as number)),
        s.rows('Member') as unknown as Member[],
      );
    },

    openRequestThread: async (actorId, requestId, threadType, messageBody) => {
      const type = assertCharitableThreadType(threadType);
      const body = cleanCharitableThreadMessage(messageBody);
      const s = await this.ready();
      const threadId = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const request = s.rows('CharitableRequest').find((r) => r.id === requestId) as unknown as CharitableRequest | undefined;
        if (!request) throw charitableRequestNotFound(requestId);
        const existing = s.rows('CharitableRequestThread').find((t) => t.request_id === requestId && t.thread_type === type);
        assertCharitableThreadAccess(actor, request, type, existing ? 'post' : 'open');
        const now = toTimestamp(this.now());
        const thread = existing ?? s.insert('CharitableRequestThread', { request_id: requestId, thread_type: type, opened_by_member_id: actorId, opened_at: now });
        s.insert('CharitableRequestThreadMessage', { thread_id: thread.id, author_member_id: actorId, posted_at: now, message_body: body });
        return thread.id as number;
      });
      return this.charitableThreadDetail(s, actorId, threadId);
    },

    postRequestThreadMessage: async (actorId, threadId, messageBody) => {
      const body = cleanCharitableThreadMessage(messageBody);
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const thread = s.rows('CharitableRequestThread').find((t) => t.id === threadId) as unknown as CharitableRequestThread | undefined;
        if (!thread) throw charitableThreadNotFound(threadId);
        const request = s.rows('CharitableRequest').find((r) => r.id === thread.request_id) as unknown as CharitableRequest;
        assertCharitableThreadAccess(actor, request, thread.thread_type, 'post');
        s.insert('CharitableRequestThreadMessage', { thread_id: threadId, author_member_id: actorId, posted_at: toTimestamp(this.now()), message_body: body });
      });
      return this.charitableThreadDetail(s, actorId, threadId);
    },

    routeRequestToNextEligibleAgenda: async (actorId, requestId) => {
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const request = s.rows('CharitableRequest').find((r) => r.id === requestId) as unknown as CharitableRequest | undefined;
        if (!request) throw charitableRequestNotFound(requestId);
        const councilId = request.CouncilID;
        assertMayVetCharitableRequests(actor, councilId, `put charitable request ${requestId} on a meeting agenda`);
        assertIndependentVetter(actor, request);
        const alreadyRouted = s
          .rows('ProposedMotion')
          .some((p) => p.SourceType === 'CharitableRequest' && p.SourceRecordID === requestId && p.VoteResult === 'Pending');
        assertRoutableRequest(request, alreadyRouted);
        const monthlyTypeIds = new Set(
          s
            .rows('CouncilMeetingType')
            .filter((t) => t.CouncilID === councilId && isMonthlyCouncilMeetingType(String(t.TypeName)))
            .map((t) => t.id),
        );
        const monthly = s.rows('Meeting').filter((m) => m.CouncilID === councilId && monthlyTypeIds.has(m.MeetingTypeID)) as unknown as Meeting[];
        const today = toIsoDate(this.now());
        const meeting = nextEligibleAgendaMeeting(monthly, today);
        if (!meeting) throw noEligibleAgendaMeeting(requestId, councilId, today);
        const motion = s.insert('ProposedMotion', {
          CouncilID: councilId,
          TargetMeetingID: meeting.id,
          SourceType: 'CharitableRequest',
          SourceRecordID: requestId,
          MotionText: charitableMotionText(request),
          PresenterMemberID: request.ShepherdMemberID,
          AllocatedMinutes: PROPOSED_MOTION_DEFAULT_MINUTES,
          VoteResult: 'Pending',
        });
        return { motion: { ...motion } as unknown as ProposedMotion, meeting: { ...meeting } };
      });
    },
  };

  budget: DataService['budget'] = {
    listAnnualForecast: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const s = await this.ready();
      assertMayViewBudgetForecast(this.memberWriteActor(s, actorId), councilId, `read the budget forecast of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return this.annualForecast(s, councilId, year);
    },

    updateLineItemBudget: async (actorId, budgetLineItemId, proposedAmount, notes, options = {}) => {
      const changes = cleanBudgetLineUpdate(proposedAmount, notes);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const line = s.rows('CouncilBudgetForecast').find((l) => l.id === budgetLineItemId);
        if (!line) throw budgetLineNotFound(budgetLineItemId);
        const councilId = line.CouncilID as number;
        assertMayManageBudgetForecast(actor, councilId, `change budget line ${budgetLineItemId}`);
        assertBudgetYearNotApproved(line.FraternalYear as string, this.budgetLines(s, councilId, line.FraternalYear as string));
        assertBudgetYearWritable(line.FraternalYear as string, this.now(), actor, options);
        const category = assertCouncilBudgetCategory(options.budgetCategoryId, this.budgetCategories(s, councilId), councilId);
        const stored = line as unknown as CouncilBudgetForecast;
        Object.assign(
          line,
          changes,
          // Sprint 6D: the row moves through BUDGET_LINE_WORKFLOW; a lump sum that no longer equals quantity x unit cost clears the unit cost.
          { BudgetStatus: nextBudgetLineStatus(stored, 'propose'), unit_cost: unitCostAfterLumpSum(stored, changes.ProposedBudgetAmount) },
          category === undefined ? {} : { BudgetCategoryID: category },
        );
        return { ...line } as unknown as CouncilBudgetForecast;
      });
    },

    setLineQuantityAndUnitCost: async (actorId, budgetLineItemId, quantity, unitCost, options = {}) => {
      const changes = cleanLineQuantityAndUnitCost(quantity, unitCost);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const line = s.rows('CouncilBudgetForecast').find((l) => l.id === budgetLineItemId);
        if (!line) throw budgetLineNotFound(budgetLineItemId);
        const councilId = line.CouncilID as number;
        assertMayManageBudgetForecast(actor, councilId, `change budget line ${budgetLineItemId}`);
        assertBudgetYearNotApproved(line.FraternalYear as string, this.budgetLines(s, councilId, line.FraternalYear as string));
        assertBudgetYearWritable(line.FraternalYear as string, this.now(), actor, options);
        Object.assign(line, changes, { BudgetStatus: nextBudgetLineStatus(line as unknown as CouncilBudgetForecast, 'propose') });
        return { ...line } as unknown as CouncilBudgetForecast;
      });
    },

    amendApprovedLine: async (actorId, budgetLineItemId, amendment, options = {}) => {
      const s = await this.ready();
      const row = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const line = s.rows('CouncilBudgetForecast').find((l) => l.id === budgetLineItemId) as unknown as CouncilBudgetForecast | undefined;
        if (!line) throw budgetLineNotFound(budgetLineItemId);
        assertMayApproveBudget(actor, line.CouncilID, `amend the ${line.FraternalYear} budget of council ${line.CouncilID}`);
        assertBudgetLineAmendable(line, budgetLineVersions(this.allBudgetLines(s, line.CouncilID), line), this.now(), actor, options);
        // The approved row is an immutable snapshot: the amendment is a new row with the next budget_version.
        return s.insert('CouncilBudgetForecast', { ...planBudgetAmendment({ ...line }, amendment) });
      });
      return { ...row } as unknown as CouncilBudgetForecast;
    },

    listLineVersions: async (actorId, budgetLineItemId) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const line = s.rows('CouncilBudgetForecast').find((l) => l.id === budgetLineItemId) as unknown as CouncilBudgetForecast | undefined;
      if (!line) throw budgetLineNotFound(budgetLineItemId);
      assertMayViewBudgetForecast(actor, line.CouncilID, `read the budget forecast of council ${line.CouncilID}`);
      const versions = budgetLineVersions(this.allBudgetLines(s, line.CouncilID), line).map((l) => ({ ...l }));
      return { current: versions[versions.length - 1], versions };
    },

    addCustomBudgetLine: async (actorId, councilId, data, options = {}) => {
      const clean = cleanCustomBudgetLine(data);
      const s = await this.ready();
      const row = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        assertMayManageBudgetForecast(actor, councilId, `add budget lines for council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        assertBudgetYearNotApproved(clean.FraternalYear, this.budgetLines(s, councilId, clean.FraternalYear));
        assertBudgetYearWritable(clean.FraternalYear, this.now(), actor, options);
        assertCouncilBudgetCategory(clean.BudgetCategoryID, this.budgetCategories(s, councilId), councilId);
        const existing = findOperationalBudgetLine(this.budgetLines(s, councilId, clean.FraternalYear), clean.LineItemName);
        if (existing) throw budgetLineExists(existing);
        return s.insert('CouncilBudgetForecast', {
          CouncilID: councilId,
          FraternalYear: clean.FraternalYear,
          CategoryType: 'Operational',
          ReferenceSourceID: null,
          LineItemName: clean.LineItemName,
          PrePopulatedAmount: 0,
          ProposedBudgetAmount: clean.ProposedBudgetAmount,
          ApprovedBudgetAmount: 0,
          BudgetStatus: 'Proposed',
          Notes: clean.Notes,
          BudgetCategoryID: clean.BudgetCategoryID,
        });
      });
      return { ...row } as unknown as CouncilBudgetForecast;
    },

    prePopulateNextYear: async (actorId, councilId, targetFraternalYear, options = {}) => {
      const target = assertFraternalYear(targetFraternalYear, 'Target fraternal year');
      const source = previousFraternalYear(target);
      const { fromDate, toDate } = fraternalYearBounds(source);
      const inYear = (date: unknown) => (date as string) >= fromDate && (date as string) <= toDate;
      const s = await this.ready();
      const { created, refreshed } = s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        assertMayManageBudgetForecast(actor, councilId, `pre-populate the budget of council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        assertBudgetYearNotApproved(target, this.budgetLines(s, councilId, target));
        assertBudgetYearWritable(target, this.now(), actor, options);
        const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
        const annualEvents = s.rows('Event').filter((e) => linked.has(e.id) && e.IsAnnual === 1 && inYear(e.StartDate));
        const annualEventIds = new Set(annualEvents.map((e) => e.id));
        const meetingIds = new Set(s.rows('Meeting').filter((m) => m.CouncilID === councilId && inYear(m.Date)).map((m) => m.id));
        const spendingReports = new Map(
          s
            .rows('ExpenseReport')
            .filter((r) => r.CouncilID === councilId && EXPENSE_SPEND_STATUSES.includes(r.Status as ExpenseReportStatus))
            .map((r) => [r.id, r]),
        );
        const expenseLines = s.rows('ExpenseLineItem').flatMap((li) => {
          const report = spendingReports.get(li.ExpenseReportID);
          return report ? [{ report, Amount: li.Amount as number }] : [];
        });
        const annualCharities = new Map(s.rows('GlobalCharityRegistry').filter((c) => c.IsAnnual === 1).map((c) => [c.id, c.Name as string]));
        const seeds = planBudgetPrePopulation({
          annualEvents: annualEvents.map((e) => ({ id: e.id as number, EventName: e.EventName as string })),
          eventExpenses: expenseLines
            .filter((x) => annualEventIds.has(x.report.LinkedEventID))
            .map((x) => ({ EventID: x.report.LinkedEventID as number, Amount: x.Amount })),
          annualCharityChecks: s
            .rows('CharitableDisbursementLedger')
            .filter((d) => d.CouncilID === councilId && inYear(d.PayoutDate) && annualCharities.has(d.CharityID))
            .map((d) => ({ CharityID: d.CharityID as number, Name: annualCharities.get(d.CharityID)!, Amount: d.Amount as number })),
          meetingCount: meetingIds.size,
          meetingExpenses: expenseLines.filter((x) => meetingIds.has(x.report.LinkedMeetingID)).map((x) => ({ Amount: x.Amount })),
          priorLines: [...this.budgetLines(s, councilId, source)].sort((a, b) => a.id - b.id),
        });
        const plan = mergeBudgetSeeds(this.budgetLines(s, councilId, target), seeds);
        for (const { id, ...refresh } of plan.updates) Object.assign(s.rows('CouncilBudgetForecast').find((l) => l.id === id)!, refresh);
        for (const seed of plan.inserts) {
          s.insert('CouncilBudgetForecast', {
            CouncilID: councilId,
            FraternalYear: target,
            ...seed,
            universal_category: seed.universal_category ?? null,
            ProposedBudgetAmount: 0,
            ApprovedBudgetAmount: 0,
            BudgetStatus: 'Draft',
            Notes: null,
          });
        }
        return { created: plan.inserts.length, refreshed: plan.updates.length };
      });
      return {
        fraternalYear: target,
        sourceFraternalYear: source,
        created,
        refreshed,
        lines: sortBudgetLines(this.budgetLines(s, councilId, target)).map((l) => ({ ...l })),
      };
    },

    approveAndFinalizeEntireBudget: async (actorId, councilId, fraternalYear, options = {}) => {
      const year = assertFraternalYear(fraternalYear);
      const s = await this.ready();
      s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        assertMayApproveBudget(actor, councilId, `approve the ${year} budget of council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        const lines = this.budgetLines(s, councilId, year);
        assertBudgetYearApprovable(year, lines, this.now(), actor, options);
        for (const { id, ...approval } of planBudgetApproval(lines)) Object.assign(lines.find((l) => l.id === id)!, approval);
      });
      return this.annualForecast(s, councilId, year);
    },

    getBudgetProgress: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const s = await this.ready();
      assertMayReviewBudgetPerformance(this.memberWriteActor(s, actorId), councilId, `review the budget progress of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return this.budgetYearPerformance(s, councilId, year, budgetProgressThrough(year, this.now()));
    },

    getPriorYearBaselines: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const s = await this.ready();
      assertMayViewBudgetForecast(this.memberWriteActor(s, actorId), councilId, `read the budget baselines of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      const prior = previousFraternalYear(year);
      return buildPriorYearBaselines({
        councilId,
        fraternalYear: year,
        lines: this.budgetLines(s, councilId, year).map((l) => ({ ...l })),
        priorLines: this.budgetLines(s, councilId, prior).map((l) => ({ ...l })),
        priorSpend: this.budgetYearSpend(s, councilId, prior, fraternalYearBounds(prior).toDate),
      });
    },

    getHistoricalKPIs: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayReviewBudgetPerformance(this.memberWriteActor(s, actorId), councilId, `review the budget history of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      const today = this.now();
      const budgeted = s.rows('CouncilBudgetForecast').filter((l) => l.CouncilID === councilId).map((l) => l.FraternalYear as string);
      const years = completedFraternalYears(budgeted, today).map((y) => this.budgetYearPerformance(s, councilId, y, fraternalYearBounds(y).toDate));
      return summarizeBudgetHistory(councilId, years, today);
    },

    getConcludedPerformance: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayReviewBudgetPerformance(this.memberWriteActor(s, actorId), councilId, `review the concluded budget performance of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      const today = this.now();
      const year = currentFraternalYear(today);
      const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
      const spendingReports = new Map(
        s
          .rows('ExpenseReport')
          .filter((r) => r.CouncilID === councilId && EXPENSE_SPEND_STATUSES.includes(r.Status as ExpenseReportStatus))
          .map((r) => [r.id, r]),
      );
      return buildConcludedBudgetPerformance({
        councilId,
        fraternalYear: year,
        today: toIsoDate(today),
        rows: {
          events: s
            .rows('Event')
            .filter((e) => linked.has(e.id))
            .map((e) => ({
              id: e.id as number,
              EventName: e.EventName as string,
              StartDate: e.StartDate as string,
              EndDate: e.EndDate as string,
              IsAnnual: e.IsAnnual as boolean | number | null,
            })),
          expenses: s.rows('ExpenseLineItem').flatMap((li) => {
            const report = spendingReports.get(li.ExpenseReportID);
            if (!report) return [];
            return [{ EventID: (report.LinkedEventID as number | null) ?? null, MeetingID: (report.LinkedMeetingID as number | null) ?? null, Amount: li.Amount as number }];
          }),
          meetings: s
            .rows('Meeting')
            .filter((m) => m.CouncilID === councilId)
            .map((m) => ({ id: m.id as number, Date: m.Date as string, EndDate: (m.EndDate as string | null) ?? null })),
          // Every year's forecast lines: event budgets (and the benchmarks') come from the approved Event lines (Sprint 6C),
          // the latest budget_version of each (Sprint 6D).
          lines: currentBudgetLines(this.allBudgetLines(s, councilId)).map((l) => ({ ...l })),
        },
      });
    },
  };

  /** budget.listAnnualForecast's answer for the council's year, copied out of the store. */
  private annualForecast(s: MemoryStore, councilId: number, year: string): AnnualBudgetForecast {
    const lines = this.budgetLines(s, councilId, year);
    return {
      councilId,
      fraternalYear: year,
      window: budgetWindowOf(year, this.now()),
      status: budgetStatusOf(lines),
      categories: this.budgetCategories(s, councilId).map((c) => ({ ...c })),
      lines: sortBudgetLines(lines).map((l) => ({ ...l })),
    };
  }

  /**
   * The council's year against its spend from July 1 through `throughDate`, counted as reports.monthlySummary counts
   * it: events starting in the period, line items dated in it on 'Approved' and 'Reimbursed' sheets, charity checks
   * paid in it.
   */
  private budgetYearPerformance(s: MemoryStore, councilId: number, year: string, throughDate: string): BudgetYearPerformance {
    return buildBudgetYearPerformance({
      councilId,
      fraternalYear: year,
      lines: this.budgetLines(s, councilId, year).map((l) => ({ ...l })),
      categories: this.budgetCategories(s, councilId).map((c) => ({ ...c })),
      throughDate,
      spend: this.budgetYearSpend(s, councilId, year, throughDate),
    });
  }

  /** The council's spend from the year's July 1 through `throughDate`, as budgetYearPerformance counts it. */
  private budgetYearSpend(s: MemoryStore, councilId: number, year: string, throughDate: string): BudgetYearSpend {
    const { fromDate } = fraternalYearBounds(year);
    const inPeriod = (date: unknown) => (date as string) >= fromDate && (date as string) <= throughDate;
    const allLines = this.allBudgetLines(s, councilId);
    const spendingReports = new Map(
      s
        .rows('ExpenseReport')
        .filter((r) => r.CouncilID === councilId && EXPENSE_SPEND_STATUSES.includes(r.Status as ExpenseReportStatus))
        .map((r) => [r.id, r]),
    );
    return {
        expenses: s.rows('ExpenseLineItem').flatMap((li) => {
          const report = spendingReports.get(li.ExpenseReportID);
          if (!report || !inPeriod(li.DateOfExpense)) return [];
          return [{ BudgetLineID: currentBudgetLineIdOf(allLines, report.budget_line_id as number | null | undefined), Amount: li.Amount as number }];
        }),
        charityChecks: s
          .rows('CharitableDisbursementLedger')
          .filter((d) => d.CouncilID === councilId && inPeriod(d.PayoutDate))
          .map((d) => ({
            CharityID: d.CharityID as number,
            Amount: d.Amount as number,
            BudgetLineID: (s.rows('CharitableRequest').find((r) => r.PaymentOrderId === d.id)?.TargetBudgetLineID as number | null | undefined) ?? null,
          })),
    };
  }

  /** The council's budget categories in id order, as stored (not copied). */
  private budgetCategories(s: MemoryStore, councilId: number): CouncilBudgetCategory[] {
    return (s.rows('CouncilBudgetCategory').filter((c) => c.CouncilID === councilId) as unknown as CouncilBudgetCategory[]).sort((a, b) => a.id - b.id);
  }

  /**
   * The council's forecast lines for one fraternal year, as stored (not copied): the latest budget_version of each line
   * (Sprint 6D), so superseded snapshots never enter a figure.
   */
  private budgetLines(s: MemoryStore, councilId: number, fraternalYear: string): CouncilBudgetForecast[] {
    return currentBudgetLines(this.allBudgetLines(s, councilId).filter((l) => l.FraternalYear === fraternalYear));
  }

  /**
   * The catch-all hook on a decided charitable vote (Sprint 6E): an approved request with no TargetBudgetLineID takes
   * the council's 'Miscellaneous Others' line of the vote's fraternal year.
   */
  private tagCharitableBudgetFallback(s: MemoryStore, request: Row): void {
    const councilId = request.CouncilID as number;
    const change = planCharitableBudgetFallback(
      request as unknown as CharitableRequest,
      this.budgetLines(s, councilId, currentFraternalYear(this.now())),
    );
    if (change) Object.assign(request, change);
  }

  /** Every forecast row of the council, every year and every budget_version, as stored. */
  private allBudgetLines(s: MemoryStore, councilId: number): CouncilBudgetForecast[] {
    return s.rows('CouncilBudgetForecast').filter((l) => l.CouncilID === councilId) as unknown as CouncilBudgetForecast[];
  }

  private charityProposalDetails(s: MemoryStore, keep: (p: Row) => boolean, order: 'queue' | 'newest'): CharityProposalDetail[] {
    return buildCharityProposalDetails(
      s.rows('CharityDonationProposal').filter(keep).map((p) => ({ ...p })) as unknown as CharityDonationProposal[],
      s.rows('Member') as unknown as Member[],
      this.charityRows(s).map((c) => ({ ...c })),
      s.rows('CharitableDisbursementLedger').map((d) => ({ ...d })) as unknown as CharitableDisbursementLedger[],
      order,
    );
  }

  /** The council's relationship types, by RelationshipName then id (binary order, as SQLite's ORDER BY). */
  private relationshipTypes(s: MemoryStore, councilId: number): CouncilRelationshipType[] {
    return (s.rows('CouncilRelationshipType').filter((t) => t.CouncilID === councilId) as unknown as CouncilRelationshipType[]).sort((a, b) =>
      a.RelationshipName < b.RelationshipName ? -1 : a.RelationshipName > b.RelationshipName ? 1 : a.id - b.id,
    );
  }

  /** Copies of the table's rows that `keep` accepts. */
  private copyRows<T>(s: MemoryStore, table: string, keep: (r: Row) => boolean): T[] {
    return s.rows(table).filter(keep).map((r) => ({ ...r })) as unknown as T[];
  }

  /** One request thread as the caller sees it, after a write the caller was allowed to make. */
  private charitableThreadDetail(s: MemoryStore, actorId: number, threadId: number): CharitableRequestThreadDetail {
    const thread = { ...s.rows('CharitableRequestThread').find((t) => t.id === threadId)! } as unknown as CharitableRequestThread;
    const request = s.rows('CharitableRequest').find((r) => r.id === thread.request_id) as unknown as CharitableRequest;
    return buildCharitableThreadDetail(
      thread,
      this.copyRows<CharitableRequestThreadMessage>(s, 'CharitableRequestThreadMessage', (m) => m.thread_id === threadId),
      s.rows('Member') as unknown as Member[],
      charitableThreadAccess(this.memberWriteActor(s, actorId), request, thread.thread_type).post,
    );
  }

  private charitableRequestDetails(s: MemoryStore, keep: (r: Row) => boolean): CharitableRequestDetail[] {
    return buildCharitableRequestDetails(
      s.rows('CharitableRequest').filter(keep).map((r) => ({ ...r })) as unknown as CharitableRequest[],
      s.rows('Member') as unknown as Member[],
      s.rows('CouncilRelationshipType') as unknown as CouncilRelationshipType[],
      s.rows('CouncilMissionArea') as unknown as CouncilMissionArea[],
      s.rows('CouncilBudgetForecast') as unknown as CouncilBudgetForecast[],
    ).map((d) => ({ ...d, request: { ...d.request }, targetBudgetLine: d.targetBudgetLine ? { ...d.targetBudgetLine } : null }));
  }

  private charityRows(s: MemoryStore): readonly GlobalCharityRegistry[] {
    return s.rows('GlobalCharityRegistry') as unknown as GlobalCharityRegistry[];
  }

  private requireCharity(s: MemoryStore, charityId: number): Row {
    const row = s.rows('GlobalCharityRegistry').find((c) => c.id === charityId);
    if (!row) throw charityNotFound(charityId);
    return row;
  }

  /** The council's link to the charity, made now if it does not exist yet. */
  private linkCharity(s: MemoryStore, councilId: number, charityId: number): Row {
    return (
      s.rows('CouncilCharityLink').find((l) => l.CouncilID === councilId && l.CharityID === charityId) ??
      s.insert('CouncilCharityLink', { CouncilID: councilId, CharityID: charityId, ConnectedAt: toTimestamp(this.now()) })
    );
  }

  /** Every check number the council has written: expense and charity checks come out of one checkbook. */
  private councilCheckNumbers(s: MemoryStore, councilId: number): { CheckNumber: string }[] {
    return [...s.rows('ExpenseDisbursement'), ...s.rows('CharitableDisbursementLedger')]
      .filter((d) => d.CouncilID === councilId)
      .map((d) => ({ CheckNumber: d.CheckNumber as string }));
  }

  finance: DataService['finance'] = {
    listChartOfAccounts: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayReadGeneralLedger(this.memberWriteActor(s, actorId), councilId, `read the chart of accounts of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return buildChartOfAccounts(councilId, this.glAccounts(s, councilId), this.journalEntries(s, councilId));
    },

    logDoubleEntryTransaction: async (actorId, linesData) => {
      const lines = cleanJournalLines(linesData, this.now());
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const named = new Set(lines.map((l) => l.GLAccountID));
        const councilId = journalCouncilOf(lines, s.rows('GLAccount').filter((a) => named.has(a.id as number)) as unknown as GLAccount[]);
        assertMayPostGeneralLedger(actor, councilId, `post to the general ledger of council ${councilId}`);
        for (const line of lines) {
          const eventId = line.LinkedEventID;
          assertJournalLinks(
            line,
            councilId,
            eventId !== null && s.rows('Event').some((e) => e.id === eventId) ? this.councilIdsOf(s, eventId) : null,
            (s.rows('Meeting').find((m) => m.id === line.LinkedMeetingID) as unknown as Meeting | undefined) ?? null,
          );
        }
        return this.insertJournalLines(s, councilId, lines);
      });
    },

    transferAssetFunds: async (actorId, sourceAccountId, targetAccountId, amount, options = {}) => {
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const source = this.glAccount(s, sourceAccountId);
        const target = this.glAccount(s, targetAccountId);
        if (source) assertMayPostGeneralLedger(actor, source.CouncilID, `transfer funds in council ${source.CouncilID}`);
        const sourceBalance = source ? accountBalance(source, this.journalEntries(s, source.CouncilID)) : 0;
        const plan = planAssetTransfer(source, target, amount, sourceBalance, this.now(), options);
        return this.insertJournalLines(s, plan.councilId, plan.lines);
      });
    },

    getLatestBalanceSheet: async (actorId, councilId) => {
      const s = await this.ready();
      assertMayReadGeneralLedger(this.memberWriteActor(s, actorId), councilId, `read the balance sheet of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return buildBalanceSheet(councilId, this.glAccounts(s, councilId), this.journalEntries(s, councilId), this.now());
    },

    getAccountLedger: async (actorId, glAccountId) => {
      const s = await this.ready();
      const actor = this.memberWriteActor(s, actorId);
      const account = this.glAccount(s, glAccountId);
      if (!account) throw glAccountNotFound(glAccountId);
      assertMayReadGeneralLedger(actor, account.CouncilID, `read the ledger of account ${glAccountId}`);
      const entries = this.journalEntries(s, account.CouncilID);
      const linked = new Set(entries.map((e) => e.LinkedEventID).filter((id): id is number => id != null));
      const eventNames = new Map(s.rows('Event').filter((e) => linked.has(e.id as number)).map((e) => [e.id as number, e.EventName as string]));
      return buildAccountLedger(account, this.glAccounts(s, account.CouncilID), entries, eventNames);
    },

    listLedgerTransactions: async (actorId, councilId, options = {}) => {
      const s = await this.ready();
      assertMayReadGeneralLedger(this.memberWriteActor(s, actorId), councilId, `read the postings of council ${councilId}`);
      this.assertCouncilsExist(s, [councilId]);
      return summarizeLedgerTransactions(this.journalEntries(s, councilId), options.limit);
    },

    uploadBankStatementReconciliation: async (actorId, csvFileData, options = {}) => {
      const rows = parseBankStatementCsv(csvFileData);
      const s = await this.ready();
      return s.transaction(() => {
        const actor = this.memberWriteActor(s, actorId);
        const councilId = options.councilId ?? actor.councilId;
        assertMayPostGeneralLedger(actor, councilId, `reconcile the bank statements of council ${councilId}`);
        this.assertCouncilsExist(s, [councilId]);
        const bankIds = reconcilableAccountIds(this.glAccounts(s, councilId), options.glAccountId);
        const candidates = this.journalEntries(s, councilId).filter((e) => bankIds.has(e.GLAccountID) && e.IsBankReconciled !== 1);
        const { matched, unmatched } = matchBankStatement(rows, candidates);
        const reconciledEntryIds = matched.map((m) => m.journalEntryId).sort((a, b) => a - b);
        // Inside a transaction the store works on copied rows, so flag the copies.
        for (const id of reconciledEntryIds) Object.assign(s.rows('JournalEntry').find((e) => e.id === id)!, { IsBankReconciled: 1 });
        return { councilId, glAccountId: options.glAccountId ?? null, statementRows: rows.length, matched, unmatched, reconciledEntryIds };
      });
    },
  };

  private glAccounts(s: MemoryStore, councilId: number): GLAccount[] {
    return s.rows('GLAccount').filter((a) => a.CouncilID === councilId).map((a) => ({ ...a }) as unknown as GLAccount);
  }

  private glAccount(s: MemoryStore, accountId: number): GLAccount | null {
    const row = s.rows('GLAccount').find((a) => a.id === accountId);
    return row ? ({ ...row } as unknown as GLAccount) : null;
  }

  private journalEntries(s: MemoryStore, councilId: number): JournalEntry[] {
    return s.rows('JournalEntry').filter((e) => e.CouncilID === councilId).map((e) => ({ ...e }) as unknown as JournalEntry);
  }

  /**
   * Stores a balanced transaction's lines for the council, unreconciled and sharing one new TransactionID, and returns
   * copies in the order given.
   */
  private insertJournalLines(s: MemoryStore, councilId: number, lines: readonly CleanJournalLine[]): JournalEntry[] {
    const TransactionID = formatTransactionId(globalThis.crypto.getRandomValues(new Uint8Array(16)));
    return lines.map((line) => ({ ...s.insert('JournalEntry', { CouncilID: councilId, ...line, IsBankReconciled: 0, TransactionID }) }) as unknown as JournalEntry);
  }

  feedback: DataService['feedback'] = {
    submit: async (memberId, text) => {
      const clean = cleanFeedbackText(text);
      const s = await this.ready();
      this.requireMember(s, memberId);
      const row = s.insert('SystemFeedback', { MemberID: memberId, SubmittedAt: toTimestamp(this.now()), FeedbackText: clean });
      return { ...row } as unknown as SystemFeedback;
    },

    listInbox: async (actorId) => {
      const s = await this.ready();
      assertMayReadFeedback(this.memberWriteActor(s, actorId));
      return buildFeedbackInbox(
        s.rows('SystemFeedback') as unknown as SystemFeedback[],
        s.rows('Member') as unknown as Member[],
        s.rows('Council') as unknown as Council[],
      );
    },
  };

  messages: DataService['messages'] = {
    getPage: async (threadId, options) => {
      const s = await this.ready();
      const limit = options?.limit ?? 20;
      const before = options?.before;
      const rows = s
        .rows('Messages')
        .filter((m) => m.ThreadID === threadId && (before === undefined || (m.CreatedAt as string) < before))
        .map((m) => ({ ...m })) as unknown as Message[];
      return rows
        .sort((a, b) => (b.CreatedAt ?? '').localeCompare(a.CreatedAt ?? '') || b.id - a.id)
        .slice(0, limit);
    },

    createReadReceiptStubs: async (messageId, listId) => {
      const s = await this.ready();
      const members = s.rows('DistributionListMembers').filter((m) => m.ListID === listId);
      for (const m of members) {
        this.store.insert('ReadReceipts', { MessageID: messageId, MemberID: m.MemberID, ReadAt: null, IsFlagged: 0 });
      }
      return members.length;
    },

    listThreads: async (memberId) => buildThreadSummaries(memberId, this.messagingRows(await this.ready())),

    listThread: async (threadId, memberId) => {
      const s = await this.ready();
      const rows = this.messagingRows(s);
      assertThreadParticipant(rows, threadId, memberId);
      return buildThreadMessages(memberId, threadId, rows);
    },

    send: async (input) => {
      const text = assertText(input.text, 'Message', 10_000);
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, input.senderId);
        const rows = this.messagingRows(s);
        let thread: Row;
        let recipients: number[];
        if (input.threadId !== undefined) {
          thread = this.requireThread(s, input.threadId);
          assertThreadParticipant(rows, input.threadId, input.senderId);
          recipients = participantIds(input.threadId, rows.messages, rows.receipts).filter((id) => id !== input.senderId);
        } else {
          const grouped = this.distributionRecipients(s, input.councilId, input.distributionGroups);
          recipients = [...new Set([...(input.recipientIds ?? []), ...grouped])].filter((id) => id !== input.senderId);
          if (input.councilId !== undefined && recipients.length === 0 && input.distributionGroups?.length) {
            throw new BusinessRuleError('NO_RECIPIENTS', 'The chosen distribution list has nobody in it but you.', {
              councilId: input.councilId,
              distributionGroups: input.distributionGroups,
            });
          }
          if (input.councilId === undefined || recipients.length === 0) {
            throw new BusinessRuleError(
              'INVALID_INPUT',
              'A new conversation needs a council and at least one recipient other than the sender.',
              { councilId: input.councilId, recipientIds: input.recipientIds },
            );
          }
          for (const id of recipients) this.requireMember(s, id);
          thread = s.insert('ChatThreads', {
            CouncilID: input.councilId,
            IsGroupChat: recipients.length > 1 ? 1 : 0,
            CreatedAt: toTimestamp(this.now()),
          });
        }
        this.assertParent(s, thread.id as number, input.parentMessageId);

        const stamp = toTimestamp(this.now());
        let message: Row;
        if (input.draftId !== undefined) {
          message = this.requireDraft(s, input.draftId, input.senderId, thread.id as number);
          Object.assign(message, {
            MessageText: text,
            IsDraft: 0,
            CreatedAt: stamp,
            ParentMessageID: input.parentMessageId !== undefined ? input.parentMessageId : message.ParentMessageID,
          });
        } else {
          message = s.insert('Messages', {
            ThreadID: thread.id,
            SenderID: input.senderId,
            ParentMessageID: input.parentMessageId ?? null,
            MessageText: text,
            IsDraft: 0,
            CreatedAt: stamp,
          });
        }
        for (const MemberID of recipients) {
          s.insert('ReadReceipts', { MessageID: message.id, MemberID, ReadAt: null, IsFlagged: 0 });
        }
        return { ...message } as unknown as Message;
      });
    },

    saveDraft: async (input) => {
      const text = assertText(input.text, 'Draft', 10_000);
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, input.senderId);
        this.requireThread(s, input.threadId);
        assertThreadParticipant(this.messagingRows(s), input.threadId, input.senderId);
        this.assertParent(s, input.threadId, input.parentMessageId);
        const stamp = toTimestamp(this.now());
        if (input.draftId !== undefined) {
          const draft = this.requireDraft(s, input.draftId, input.senderId, input.threadId);
          Object.assign(draft, {
            MessageText: text,
            CreatedAt: stamp,
            ParentMessageID: input.parentMessageId !== undefined ? input.parentMessageId : draft.ParentMessageID,
          });
          return { ...draft } as unknown as Message;
        }
        const row = s.insert('Messages', {
          ThreadID: input.threadId,
          SenderID: input.senderId,
          ParentMessageID: input.parentMessageId ?? null,
          MessageText: text,
          IsDraft: 1,
          CreatedAt: stamp,
        });
        return { ...row } as unknown as Message;
      });
    },

    deleteDraft: async (messageId, memberId) => {
      const s = await this.ready();
      const draft = s.rows('Messages').find((m) => m.id === messageId && m.IsDraft === 1 && m.SenderID === memberId);
      if (!draft) {
        throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft with id ${messageId}.`, {
          messageId,
          memberId,
        });
      }
      s.remove('Messages', (m) => m.id === messageId);
    },

    setRead: async (messageId, memberId, read) => {
      const s = await this.ready();
      const receipt = s.rows('ReadReceipts').find((r) => r.MessageID === messageId && r.MemberID === memberId);
      if (!receipt) {
        throw new BusinessRuleError(
          'MESSAGE_NOT_FOUND',
          `Member ${memberId} did not receive message ${messageId}, so it has no read state for them.`,
          { messageId, memberId },
        );
      }
      (receipt as Row).ReadAt = read ? toTimestamp(this.now()) : null;
      return { ...receipt } as unknown as ReadReceipt;
    },
  };

  private messagingRows(s: MemoryStore): MessagingRows {
    const copy = <T>(table: string) => s.rows(table).map((r) => ({ ...r })) as unknown as T[];
    return {
      threads: copy<ChatThread>('ChatThreads'),
      messages: copy<Message>('Messages'),
      receipts: copy<ReadReceipt>('ReadReceipts'),
      attachments: copy<MessageAttachment>('MessageAttachments'),
      names: new Map(s.rows('Member').map((m) => [m.id as number, `${m.MemberFirstName} ${m.MemberLastName}`])),
    };
  }

  private requireThread(s: MemoryStore, threadId: number): Row {
    const thread = s.rows('ChatThreads').find((t) => t.id === threadId);
    if (!thread) throw new BusinessRuleError('THREAD_NOT_FOUND', `No message thread with id ${threadId}.`, { threadId });
    return thread;
  }

  private assertParent(s: MemoryStore, threadId: number, parentId: number | null | undefined): void {
    if (parentId == null) return;
    if (!s.rows('Messages').some((m) => m.id === parentId && m.ThreadID === threadId)) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Thread ${threadId} has no message ${parentId} to reply to.`, {
        threadId,
        parentId,
      });
    }
  }

  private requireDraft(s: MemoryStore, messageId: number, memberId: number, threadId: number): Row {
    const draft = s.rows('Messages').find((m) => m.id === messageId && m.IsDraft === 1 && m.SenderID === memberId && m.ThreadID === threadId);
    if (!draft) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft ${messageId} in thread ${threadId}.`, {
        messageId,
        memberId,
        threadId,
      });
    }
    return draft;
  }

  /** Test/debug hook: direct access to the backing store. Not part of the DataService contract. */
  get debugStore(): MemoryStore {
    return this.store;
  }
}
