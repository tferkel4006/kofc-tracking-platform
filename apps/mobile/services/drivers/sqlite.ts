// SQLite driver for the mobile app (expo-sqlite).
// The schema and seed statements are generated from Schema.sql / Seed.sql by
// scripts/gen-db-assets.mjs. Nothing outside /services may import this file.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
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
  assertNotSelfApproval,
  cleanRejectionReason,
  EXPENSE_SPEND_STATUSES,
  assertCheckNumberUnused,
  assertExpenseLinks,
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
  assertShiftReportAllowed,
  assertText,
  assertThreadParticipant,
  assertValidHours,
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
  DONATION_EDITABLE_COLUMNS,
  donationMethodKind,
  EVENT_COLUMNS,
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
  SHIFT_COLUMNS,
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
  type ElectionRows,
  type SeatTransition,
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
  CHARITABLE_TRIAGE_COLUMNS,
  charitableRequestNotFound,
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
  CHARITY_COLUMNS,
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
  type CleanGlobalCharity,
  type CouncilAdminDetails,
  type EventFunds,
  type GateCouncil,
  type MaintainedTable,
  type MemberWriteActor,
  type MessagingRows,
  type SignupContextRow,
  assertMeetingResponseStatus,
  shiftDefaultLengthHours,
  assertMayManageAgendaTemplates,
  cleanAgendaTemplateText,
  cleanMeetingSpan,
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
  HandTallyRecording,
  MeetingType,
  ProposedMotion,
  DistributionGroup,
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
  LessonsLearned,
  LessonsLearnedCategory,
  Category,
  LookupRowMap,
  LookupTableName,
  LookupValues,
  Meeting,
  BankReconciliationResult,
  BallotTally,
  BallotVote,
  LiveAssemblyState,
  LiveAttendance,
  MotionVoteFinalization,
  GLAccount,
  JournalEntry,
  MeetingInvites,
  MeetingResponseStatus,
  CouncilMeetingType,
  CharitableRequest,
  CharitableRequestDetail,
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
  MessagePageOptions,
  NewEvent,
  NewMeeting,
  ReadReceipt,
  Role,
  CouncilElectionBallot,
  CouncilBudgetCategory,
  AnnualBudgetForecast,
  BudgetYearPerformance,
  BudgetYearSpend,
  CouncilAssetsInventory,
  CouncilBudgetForecast,
  CharitableDisbursementLedger,
  CharityDonationProposal,
  CharityProposalDetail,
  CouncilCharityLink,
  GlobalCharityRegistry,
  CouncilLeadershipHistory,
  OfficerNominations,
  SessionUser,
  Shift,
  ShiftChanges,
  ShiftFeedItem,
} from '@kofc/shared';
import { PRESENTATION_SEED_STATEMENTS, SCHEMA_STATEMENTS, SEED_STATEMENTS } from '../generated/schema.sqlite';
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

const DB_NAME = 'kofc.db';
/**
 * Bump when Schema.sql changes; stored in PRAGMA user_version. Migrations are a later concern:
 * a dev database created at an older version must be wiped with reset() (or the app reinstalled).
 * 2: Phase 2 donations, skills, training and working status.
 * 3: Donation.RecordedBy (Sprint 5K).
 * 4: view_NoShows LEFT JOINs NoShowReason (Sprint 5L).
 * 5: SystemFeedback (Sprint 5P).
 * 6: Event.PhotoGalleryURL, Meeting.GoogleDriveMinutesURL and GoogleDriveFlyerURL (Sprint 5Q).
 * 7: Meeting.OwnerID (Sprint 5Q).
 * 8: ExpenseDisbursement, ExpenseReport and ExpenseLineItem (Sprint 5R).
 * 9: ExpenseReport.RejectionReason (Sprint 5R-1.5).
 * 10: Member.ProfilePhotoURL and Member.Biography (Sprint 5S).
 * 11: Member.ExpoPushToken, NotificationLog and SupremeReportingSync (Sprint 5T).
 * 12: CouncilElectionBallot, OfficerNominations and CouncilLeadershipHistory; Priest and Lector renamed Chaplain and Lecturer (Sprint 5U).
 * 13: GlobalCharityRegistry, CouncilCharityLink, CharityDonationProposal and CharitableDisbursementLedger (Sprint 5V).
 * 14: CharitableDisbursementLedger.ProposalID and CharityDonationProposal.RejectionReason (Sprint 5V-2).
 * 15: Event.IsAnnual, GlobalCharityRegistry.IsAnnual and CouncilBudgetForecast (Sprint 5Y).
 * 16: CouncilBudgetCategory, CouncilBudgetForecast.BudgetCategoryID and Member.IsBudgetDirector (Sprint 5Y-3).
 * 17: CouncilBudgetForecast.ProposedBudgetAmount and CouncilBudgetForecast.BudgetStatus (Sprint 5Y-4).
 * 18: CouncilMeetingType, CouncilAgendaTemplate, MeetingInvites.ResponseStatus, Meeting.IsMultiDay and MeetingTypeID,
 *     and Event.IsMultiDay (Sprint 5Y-5).
 * 19: Meeting.EndDate (Sprint 5Y-6).
 * 21: CouncilRelationshipType, CouncilMissionArea, CharitableRequest, and Event.MissionAreaID and Meeting.MissionAreaID
 *     (Sprint 5Z-1; the numbering skips 20).
 * 22: CharitableRequest.MissionAreaID and TargetBudgetLineID (Sprint 5Z-2).
 * 23: ExpenseReport.FinancialSecretaryMemberID, FinancialSecretaryApprovedAt, GrandKnightMemberID and GrandKnightApprovedAt
 *     (Sprint 5Z-3).
 * 24: CouncilCadenceConfig and ProposedMotion (Sprint 5Z-5).
 * 25: Meeting.InviteReleaseDate and CouncilCadenceConfig.DefaultRecipientGroup (Sprint 5Z-6).
 * 26: GLAccount, JournalEntry and Event.IntakeSessionStatus (Sprint 5Z-7).
 * 27: JournalEntry.TransactionID and the Opening Balance Equity account (Sprint 5Z-8).
 * 28: the live meeting columns on Meeting, ProposedMotion.BallotOpenedAt, LiveAttendance and BallotVote (Sprint 5Z-9).
 * 29: DistributionLists.IsCouncilWide - private member lists (Sprint 5Z-10.8).
 * 30: Council feature flags flag_mobile_elections, flag_fundraising_inflow, flag_charity_proposals, flag_complex_shifts
 *     and flag_meeting_management (Sprint 6A; the patch split flag_donations_hub in two within version 30).
 * 31: MeetingAgendaItem and MotionHandTally - the St. Mary's live agenda and hand-vote tallies (Sprint 6B).
 * 32: Meeting.ActiveAgendaLineKey, Member.DateJoinedCouncil and MemberEnrollmentToken (Sprint 6B Patch).
 * 33: PasswordResetToken - self-service password resets; the welcome setup code becomes mandatory (Sprint 6B Security).
 * 34: Member.flag_large_text_mode - the member's Large Text Layout Mode preference (Sprint 6C).
 * 35: Council.BylawsMarkdown and Council.BylawsUpdatedAt - the Council Bylaws Data Vault (Sprint 6Z).
 * 36: Event.GoogleDriveFlyerFileID - the Marketing Factory's filed flyer (Sprint 6C, Phase 4).
 * 37: Council.EmailProvider, SmtpHost, SmtpPort, SmtpUsername and EmailPasswordEncrypted - the council's outbound
 *     email gateway (Sprint 6Z-Email-Proxy).
 * 38: Shift.IsAllHands - All-Hands shifts with no volunteer cap (Phase 4.5).
 * 39: Council.tenant_type - the multi-tenant white-label gate (Sprint 6Z-Dual-Gate-Model).
 * 40: CouncilCredentialsVault, and Council.EmailPasswordEncrypted dropped - the Centralized Encrypted Credentials Vault
 *     (Sprint 6Y). The phone never reads or writes the vault; only the web server does.
 * 41: Council.base_dues_rate - the yearly dues per member behind the dues revenue forecast (Sprint 6A, Phase 5).
 * 42: CouncilBudgetForecast.quantity, unit_cost and budget_version, with budget_version added to the line index - the
 *     quantity x unit cost estimates and the immutable approved snapshots of mid-year amendments (Sprint 6D).
 * 43: ExpenseReport.is_long_term_asset and CouncilAssetsInventory - approved long-term asset expenses convert into
 *     inventory rows (Sprint 6E).
 */
const SCHEMA_VERSION = 43;

/** Where the device keeps the secret ballot key (Sprint 5Z-9), outside the database. */
const BALLOT_SECRET_KEY = 'kofc.ballotSecret';

/** Allow-list for the one place a table name is interpolated into SQL. Exhaustive by construction. */
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

const SIGN_IN_SELECT = `
  SELECT c.[id] AS credentialId, c.[Password] AS password, c.[Username] AS username,
         m.[id] AS memberId, m.[CouncilID] AS councilId,
         m.[MemberFirstName] AS firstName, m.[MemberLastName] AS lastName,
         t.[Type] AS memberType, m.[IsBudgetDirector] AS isBudgetDirector
    FROM [Credentials] c
    JOIN [Member] m ON m.[CredentialID] = c.[id]
    JOIN [MemberType] t ON t.[id] = m.[MemberTypeID]`;

const ACTIVE_MEMBER_FILTER = `
  m.[CouncilID] = ?
  AND m.[StatusID] = (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active')`;

interface SignInRow {
  credentialId: number;
  password: string;
  username: string;
  memberId: number;
  councilId: number;
  firstName: string;
  lastName: string;
  memberType: SessionUser['memberType'];
  isBudgetDirector: number;
}

/** Longest `IN (...)` list sent in one statement; SQLite caps the number of bound variables. */
const IN_CHUNK = 500;
const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Runs `sql(marks)` for slices of `ids` so a long id list never exceeds the variable limit. */
async function selectIn<T>(
  db: SQLite.SQLiteDatabase,
  sql: (marks: string) => string,
  ids: readonly number[],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const slice = ids.slice(i, i + IN_CHUNK);
    out.push(...(await db.getAllAsync<T>(sql(marks(slice.length)), slice)));
  }
  return out;
}

type Bind = string | number | null;

const noParish = (parishId: number) => new BusinessRuleError('INVALID_INPUT', `No parish with id ${parishId}.`, { parishId });

export interface SqliteDataServiceOptions {
  /** Clock used for seeding and the history-window rules. Tests pin it. Default: real time. */
  now?: () => Date;
  /** Where system emails, push requests and Alchemer posts go. Default: console.log (no such infrastructure exists yet). */
  log?: (...args: unknown[]) => void;
  /** How supreme.syncAlchemerReport posts to Alchemer. Default: print the request with `log` (logAlchemerRequest). */
  postAlchemer?: (request: AlchemerRequest) => Promise<AlchemerResponse>;
  /**
   * Sprint 6B Patch: how a welcome email is sent, as a SendGrid v3 mail/send request carrying the key placeholder. Default:
   * print the request with `log` (logSendGridRequest); the real key belongs on a server, never on the phone.
   */
  sendEmail?: (request: SendGridMailRequest) => Promise<void>;
  /**
   * Also load Seed.sql's presentation data (Sprint 5Z-1: officers, expense sheets, charity checks and intake requests)
   * right after the baseline rows when the database is first created. The app turns it on; tests keep the minimal
   * baseline. Default: false.
   */
  presentationData?: boolean;
  /**
   * The secret ballot key (Sprint 5Z-9) hashed with each voter into BallotVote.AnonymousBallotHash. Default: one kept in
   * the device's secure store (see ballotSecret).
   */
  ballotSecret?: string;
}

export class SqliteDataService implements DataService {
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;
  private readonly now: () => Date;
  private readonly log: (...args: unknown[]) => void;
  private readonly postAlchemer: (request: AlchemerRequest) => Promise<AlchemerResponse>;
  private readonly sendEmail: (request: SendGridMailRequest) => Promise<void>;
  private readonly presentationData: boolean;
  private ballotSecretValue: Promise<string> | null;

  constructor(options: SqliteDataServiceOptions = {}) {
    this.presentationData = options.presentationData ?? false;
    this.ballotSecretValue = options.ballotSecret ? Promise.resolve(options.ballotSecret) : null;
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? console.log;
    this.postAlchemer = options.postAlchemer ?? logAlchemerRequest((...args) => this.log(...args));
    this.sendEmail = options.sendEmail ?? logSendGridRequest((...args) => this.log(...args));
  }

  // ---- lifecycle ---------------------------------------------------------

  async init(): Promise<void> {
    await this.ready();
  }

  async reset(): Promise<void> {
    const opening = this.opening;
    this.opening = null;
    if (opening) {
      try {
        await (await opening).closeAsync();
      } catch {
        // a failed open has nothing to close
      }
    }
    await SQLite.deleteDatabaseAsync(DB_NAME);
    await this.init();
  }

  private ready(): Promise<SQLite.SQLiteDatabase> {
    if (!this.opening) {
      this.opening = this.open().catch((err) => {
        this.opening = null; // let the next call retry
        throw err;
      });
    }
    return this.opening;
  }

  private async open(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    // Must be set per connection, and cannot be changed inside a transaction.
    await db.execAsync('PRAGMA foreign_keys = ON;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) < SCHEMA_VERSION) await this.createAndSeed(db);
    return db;
  }

  /** First launch: schema + Seed.sql + dev meetings, all-or-nothing. */
  private async createAndSeed(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.withTransactionAsync(async () => {
      for (const statement of SCHEMA_STATEMENTS) await db.execAsync(statement);
      for (const statement of SEED_STATEMENTS) await db.execAsync(statement);
      if (this.presentationData) for (const statement of PRESENTATION_SEED_STATEMENTS) await db.execAsync(statement);
      await this.hashSeededPasswords(db);
      await this.seedDevMember(db);
      await this.seedDevMeetings(db);
      await this.seedDevEvents(db);
      await this.seedDevExtras(db);
      await this.seedDevDonationMethods(db);
      // Day-one leadership history: every seated officer gets an open term for the current fraternal year.
      for (const c of await db.getAllAsync<{ id: number }>('SELECT [id] FROM [Council] ORDER BY [id]')) await this.backfillLeadershipHistory(db, c.id);
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    });
  }

  private async seedDevMeetings(db: SQLite.SQLiteDatabase): Promise<void> {
    const council = await db.getFirstAsync<{ id: number }>(
      'SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?',
      [DEV_COUNCIL_NUMBER],
    );
    if (!council) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER}`);
    const types = await db.getAllAsync<{ id: number; Type: DevMeetingTypeName }>('SELECT [id], [Type] FROM [MeetingType]');
    const typeIds = Object.fromEntries(types.map((t) => [t.Type, t.id])) as Record<DevMeetingTypeName, number>;
    for (const { meeting, invite } of buildDevMeetings(council.id, typeIds, this.now())) {
      await this.insertMeeting(db, meeting, invite);
    }
  }

  /** Seed.sql stores dev passwords in plaintext; hash them so signIn only ever sees digests. */
  private async hashSeededPasswords(db: SQLite.SQLiteDatabase): Promise<void> {
    const rows = await db.getAllAsync<{ id: number; Password: string }>('SELECT [id], [Password] FROM [Credentials]');
    for (const { id, Password } of rows) {
      if (Password === UNREGISTERED_PASSWORD || isSha256Hex(Password)) continue;
      await db.runAsync('UPDATE [Credentials] SET [Password] = ? WHERE [id] = ?', [await sha256Hex(Password), id]);
    }
  }

  /**
   * A pre-provisioned member with a placeholder Credentials row, and (Sprint 6B Security) the published dev setup code
   * DEV_ENROLLMENT_CODE that auth.signUp now requires. Council activities come from Seed.sql.
   */
  private async seedDevMember(db: SQLite.SQLiteDatabase): Promise<void> {
    const council = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?', [
      DEV_COUNCIL_NUMBER,
    ]);
    const template = council
      ? await db.getFirstAsync<{ DegreeID: number }>(
          'SELECT [DegreeID] FROM [Member] WHERE [CouncilID] = ? ORDER BY [id] LIMIT 1',
          [council.id],
        )
      : null;
    if (!council || !template) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER} with members`);
    const m = DEV_UNREGISTERED_MEMBER;
    const cred = await db.runAsync('INSERT INTO [Credentials] ([Username], [Password]) VALUES (?, ?)', [
      m.Email,
      UNREGISTERED_PASSWORD,
    ]);
    const member = await db.runAsync(
      `INSERT INTO [Member] ([CouncilID], [MemberNumber], [MemberFirstName], [MemberLastName], [Phone],
                             [StreetAddress1], [City], [State], [ZipCode], [Email], [DateOfBirth],
                             [StatusID], [DegreeID], [MemberTypeID], [CredentialID])
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active'), ?,
               (SELECT [id] FROM [MemberType] WHERE [Type] = 'Member'), ?)`,
      [
        council.id,
        m.MemberNumber,
        m.MemberFirstName,
        m.MemberLastName,
        m.Phone,
        m.StreetAddress1,
        m.City,
        m.State,
        m.ZipCode,
        m.Email,
        m.DateOfBirth,
        template.DegreeID,
        cred.lastInsertRowId,
      ],
    );
    await db.runAsync('INSERT INTO [MemberEnrollmentToken] ([MemberID], [TokenHash], [CreatedAt], [ExpiresAt]) VALUES (?, ?, ?, ?)', [
      member.lastInsertRowId,
      await sha256Hex(enrollmentCodeHashInput(DEV_ENROLLMENT_CODE)),
      toTimestamp(this.now()),
      '9999-12-31 23:59:59',
    ]);
  }

  private async seedDevEvents(db: SQLite.SQLiteDatabase): Promise<void> {
    const council = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?', [
      DEV_COUNCIL_NUMBER,
    ]);
    const owner = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Member] WHERE [Email] = ?', [
      'testadmin@kofc.org',
    ]);
    const category = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Category] WHERE [Category] = ?', [
      'Service',
    ]);
    if (!council || !owner || !category) throw new Error('Seed.sql is missing the test council, admin or Service category');
    for (const { event, shifts } of buildDevEvents(this.now())) {
      const ev = await db.runAsync(
        `INSERT INTO [Event] ([EventName], [EventDescription], [OwnerID], [StartDate], [EndDate], [Location], [CategoryID])
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [event.EventName, event.EventDescription, owner.id, event.StartDate, event.EndDate, event.Location, category.id],
      );
      await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [
        ev.lastInsertRowId,
        council.id,
      ]);
      for (const { shift, signedUp } of shifts) {
        const sh = await db.runAsync(
          `INSERT INTO [Shift] ([ShiftName], [ShiftDescription], [ShiftDate], [StartTime], [EndTime], [EventID],
                                [MinNumberVolunteers], [NumberVolunteersSignedUp])
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shift.ShiftName,
            shift.ShiftDescription,
            shift.ShiftDate,
            shift.StartTime,
            shift.EndTime,
            ev.lastInsertRowId,
            shift.MinNumberVolunteers,
            signedUp.length,
          ],
        );
        for (const email of signedUp) {
          await db.runAsync(
            'INSERT INTO [EventSignup] ([ShiftID], [MemberID], [NoShow]) VALUES (?, (SELECT [id] FROM [Member] WHERE [Email] = ?), 0)',
            [sh.lastInsertRowId, email],
          );
        }
      }
    }
  }

  // ---- auth --------------------------------------------------------------

  auth: DataService['auth'] = {
    signIn: async (username, password) => {
      const db = await this.ready();
      const row = await db.getFirstAsync<SignInRow>(`${SIGN_IN_SELECT} WHERE c.[Username] = ? COLLATE NOCASE`, [username]);
      if (!row || !(await passwordMatches(row.password, password))) return null;
      return this.buildSession(db, row);
    },

    signUp: async (email, password, enrollmentCode) => {
      assertPasswordAcceptable(password);
      const hash = await sha256Hex(password);
      const codeHash = typeof enrollmentCode !== 'string' || enrollmentCode.trim() === '' ? null : await sha256Hex(enrollmentCodeHashInput(enrollmentCode));
      const db = await this.ready();
      let credentialId = 0;
      await db.withTransactionAsync(async () => {
        const member = await db.getFirstAsync<{ id: number; Email: string; CredentialID: number }>(
          'SELECT [id], [Email], [CredentialID] FROM [Member] WHERE [Email] = ? COLLATE NOCASE',
          [email.trim()],
        );
        if (!member) {
          throw new BusinessRuleError(
            'MEMBER_NOT_FOUND',
            `No member record has the email ${email.trim()}. Contact your council admin to be added.`,
            { email },
          );
        }
        // Sprint 6B Security: the welcome email's setup code is mandatory - this member's, unspent and unexpired - and is
        // spent here (inside the transaction, so a refused registration writes nothing).
        const registered = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Credentials] WHERE [id] = ? AND [Password] <> ?', [
          member.CredentialID,
          UNREGISTERED_PASSWORD,
        ]);
        if (!registered) {
          if (codeHash === null) throw enrollmentCodeRequired();
          const token = await db.getFirstAsync<{ id: number; ExpiresAt: string; ConsumedAt: string | null }>(
            'SELECT [id], [ExpiresAt], [ConsumedAt] FROM [MemberEnrollmentToken] WHERE [MemberID] = ? AND [TokenHash] = ?',
            [member.id, codeHash],
          );
          if (!token || !isEnrollmentTokenUsable(token, this.now())) throw enrollmentCodeInvalid();
          nextOnboardingState(memberOnboardingState(UNREGISTERED_PASSWORD, true), 'register', member.id);
          await db.runAsync('UPDATE [MemberEnrollmentToken] SET [ConsumedAt] = ? WHERE [id] = ?', [toTimestamp(this.now()), token.id]);
        }
        // The WHERE clause makes claiming the placeholder atomic: a second signUp changes nothing.
        const res = await db.runAsync(
          'UPDATE [Credentials] SET [Password] = ?, [Username] = ? WHERE [id] = ? AND [Password] = ?',
          [hash, member.Email, member.CredentialID, UNREGISTERED_PASSWORD],
        );
        if (res.changes === 0) {
          const cred = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Credentials] WHERE [id] = ?', [
            member.CredentialID,
          ]);
          throw cred
            ? new BusinessRuleError('ALREADY_REGISTERED', `${member.Email} has already registered. Sign in instead.`, {
                memberId: member.id,
              })
            : new BusinessRuleError(
                'CREDENTIALS_MISSING',
                `Member ${member.id} has no Credentials row (CredentialID ${member.CredentialID}).`,
                { memberId: member.id },
              );
        }
        credentialId = member.CredentialID;
      });
      const row = await db.getFirstAsync<SignInRow>(`${SIGN_IN_SELECT} WHERE c.[id] = ?`, [credentialId]);
      return this.buildSession(db, row!);
    },

    requestPasswordReset: async (email) => {
      const db = await this.ready();
      const found = await this.registeredMemberByEmail(db, email);
      if (!found) return; // the same answer for a stranger: the form must not reveal who is a member
      const last = await db.getFirstAsync<{ at: string | null }>('SELECT MAX([CreatedAt]) AS at FROM [PasswordResetToken] WHERE [MemberID] = ?', [found.id]);
      if (isResetRequestCoolingDown(last?.at, this.now())) return;
      const code = formatResetCode(await Crypto.getRandomBytesAsync(4));
      const codeHash = await sha256Hex(resetCodeHashInput(found.id, code));
      const issuedAt = this.now();
      const expiresAt = resetCodeExpiry(issuedAt);
      await db.withTransactionAsync(async () => {
        // Only the newest code works: every earlier unspent one is retired.
        await db.runAsync('UPDATE [PasswordResetToken] SET [ConsumedAt] = ? WHERE [MemberID] = ? AND [ConsumedAt] IS NULL', [toTimestamp(issuedAt), found.id]);
        await db.runAsync(
          'INSERT INTO [PasswordResetToken] ([MemberID], [CodeHash], [CreatedAt], [ExpiresAt], [FailedAttempts]) VALUES (?, ?, ?, ?, 0)',
          [found.id, codeHash, toTimestamp(issuedAt), expiresAt],
        );
      });
      try {
        const packet = buildPasswordResetEmail({ member: { id: found.id, Email: found.Email, MemberFirstName: found.MemberFirstName }, code, expiresAt });
        await this.sendEmail(buildSendGridMailRequest(packet.email));
      } catch (err) {
        console.error('[notification] password reset email failed:', err);
      }
    },

    verifyPasswordResetCode: async (email, code) => {
      await this.liveResetToken(await this.ready(), email, code);
    },

    resetPassword: async (email, code, newPassword) => {
      assertPasswordAcceptable(newPassword);
      const hash = await sha256Hex(newPassword);
      const db = await this.ready();
      const { member, tokenId } = await this.liveResetToken(db, email, code);
      let spent = false;
      await db.withTransactionAsync(async () => {
        // The ConsumedAt guard makes spending the code atomic: two resets racing on one code cannot both win.
        const res = await db.runAsync('UPDATE [PasswordResetToken] SET [ConsumedAt] = ? WHERE [id] = ? AND [ConsumedAt] IS NULL', [toTimestamp(this.now()), tokenId]);
        if (res.changes === 0) return;
        await db.runAsync('UPDATE [Credentials] SET [Password] = ? WHERE [id] = ?', [hash, member.CredentialID]);
        spent = true;
      });
      if (!spent) throw resetCodeInvalid();
      const row = await db.getFirstAsync<SignInRow>(`${SIGN_IN_SELECT} WHERE c.[id] = ?`, [member.CredentialID]);
      return this.buildSession(db, row!);
    },
  };

  /** The member who registered with `email` (case-insensitive); null for anyone else. */
  private async registeredMemberByEmail(
    db: SQLite.SQLiteDatabase,
    email: unknown,
  ): Promise<{ id: number; Email: string; MemberFirstName: string; CredentialID: number } | null> {
    const wanted = typeof email === 'string' ? email.trim() : '';
    if (!wanted) return null;
    return db.getFirstAsync<{ id: number; Email: string; MemberFirstName: string; CredentialID: number }>(
      `SELECT m.[id], m.[Email], m.[MemberFirstName], m.[CredentialID] FROM [Member] m JOIN [Credentials] c ON c.[id] = m.[CredentialID]
        WHERE m.[Email] = ? COLLATE NOCASE AND c.[Password] <> ?`,
      [wanted, UNREGISTERED_PASSWORD],
    );
  }

  /**
   * The member's newest live reset token when `code` matches it; otherwise RESET_CODE_INVALID, and a wrong code counts
   * against the token (written on its own, so the count sticks).
   */
  private async liveResetToken(
    db: SQLite.SQLiteDatabase,
    email: unknown,
    code: unknown,
  ): Promise<{ member: { id: number; CredentialID: number }; tokenId: number }> {
    const digits = cleanResetCode(code);
    const member = await this.registeredMemberByEmail(db, email);
    if (!member || digits === null) throw resetCodeInvalid();
    const token = await db.getFirstAsync<{ id: number; CodeHash: string; ExpiresAt: string; ConsumedAt: string | null; FailedAttempts: number }>(
      'SELECT * FROM [PasswordResetToken] WHERE [MemberID] = ? AND [ConsumedAt] IS NULL ORDER BY [id] DESC LIMIT 1',
      [member.id],
    );
    if (!token || !isResetTokenLive(token, this.now())) throw resetCodeInvalid();
    if (token.CodeHash !== (await sha256Hex(resetCodeHashInput(member.id, digits)))) {
      await db.runAsync('UPDATE [PasswordResetToken] SET [FailedAttempts] = [FailedAttempts] + 1 WHERE [id] = ?', [token.id]);
      throw resetCodeInvalid();
    }
    return { member, tokenId: token.id };
  }

  private async buildSession(db: SQLite.SQLiteDatabase, row: SignInRow): Promise<SessionUser> {
    const roles = await this.rolesFor(db, row.memberId);
    return {
      credentialId: row.credentialId,
      memberId: row.memberId,
      councilId: row.councilId,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      memberType: row.memberType,
      roles: roles.map((r) => r.Role),
      isOfficer: roles.some((r) => r.Officer === 1),
      isBudgetDirector: row.isBudgetDirector === 1,
    };
  }

  // ---- lookups / councils / members -------------------------------------

  lookups: DataService['lookups'] = {
    list: async <T extends LookupTableName>(table: T): Promise<LookupRowMap[T][]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const db = await this.ready();
      return db.getAllAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] ORDER BY [id]`);
    },
    create: async <T extends LookupTableName>(actorId: number, table: T, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cols = LOOKUP_META[table].fields.map((f) => f.key);
      const db = await this.ready();
      assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table);
      const cleaned = cleanLookupValues(table, values);
      let id = 0;
      await db.withTransactionAsync(async () => {
        assertLookupKeyUnique(table, await db.getAllAsync(`SELECT * FROM [${table}]`), cleaned);
        const res = await db.runAsync(
          `INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(cols.length)})`,
          cols.map((c) => cleaned[c]),
        );
        id = res.lastInsertRowId;
      });
      return (await db.getFirstAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]))!;
    },

    update: async <T extends LookupTableName>(actorId: number, table: T, id: number, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cols = LOOKUP_META[table].fields.map((f) => f.key);
      const db = await this.ready();
      assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table);
      const cleaned = cleanLookupValues(table, values);
      await db.withTransactionAsync(async () => {
        const row = await this.requireLookupRow(db, table, id);
        assertLookupNotProtected(table, row, cleaned);
        assertLookupKeyUnique(table, await db.getAllAsync(`SELECT * FROM [${table}]`), cleaned, id);
        await db.runAsync(`UPDATE [${table}] SET ${cols.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
          ...cols.map((c) => cleaned[c]),
          id,
        ]);
      });
      return (await db.getFirstAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]))!;
    },

    remove: async (actorId, table, id) => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table);
        const row = await this.requireLookupRow(db, table, id);
        assertLookupNotProtected(table, row, null);
        const usage = [];
        for (const ref of LOOKUP_META[table].references) {
          const found = await db.getFirstAsync<{ n: number }>(
            `SELECT COUNT(*) AS n FROM [${ref.table}] WHERE [${ref.column}] = ?`,
            [id],
          );
          usage.push({ ...ref, count: found?.n ?? 0 });
        }
        assertLookupUnused(table, row, usage);
        await db.runAsync(`DELETE FROM [${table}] WHERE [id] = ?`, [id]);
      });
    },

    listForMaintenance: async <T extends LookupTableName>(actorId: number, table: T): Promise<LookupRowMap[T][]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const db = await this.ready();
      assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table, 'view');
      return db.getAllAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] ORDER BY [id]`);
    },

    listCouncilSpecific: async <T extends CouncilLookupTableName>(actorId: number, councilId: number, table: T) => {
      const db = await this.ready();
      await this.assertMayManageCouncilLookups(db, actorId, councilId, table, `view the council's ${table} lookups`);
      return this.councilLookupRows(db, councilId, table);
    },

    saveCouncilSpecific: async <T extends CouncilLookupTableName>(actorId: number, councilId: number, table: T, records: unknown) => {
      const meta = COUNCIL_LOOKUP_META[table];
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        await this.assertMayManageCouncilLookups(db, actorId, councilId, table, `change the council's ${table} lookups`);
        const current = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [CouncilID] = ?`, [councilId]);
        const plan = planCouncilLookupSave(table, councilId, current, records);
        for (const values of [...plan.inserts, ...plan.updates.map((u) => u.values)]) {
          for (const fk of meta.foreignKeys) await this.assertRowExists(db, fk.table, values[fk.column] as number, fk.label);
        }
        for (const { id, values } of plan.updates) {
          await db.runAsync(`UPDATE [${table}] SET ${meta.columns.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...meta.columns.map((c) => values[c] ?? null),
            id,
          ]);
        }
        for (const values of plan.inserts) {
          await db.runAsync(
            `INSERT INTO [${table}] (${meta.columns.map((c) => `[${c}]`).join(', ')}, [CouncilID]) VALUES (${marks(meta.columns.length + 1)})`,
            [...meta.columns.map((c) => values[c] ?? null), councilId],
          );
        }
      });
      return this.councilLookupRows(db, councilId, table);
    },

    removeCouncilSpecific: async (actorId, councilId, table, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        await this.assertMayManageCouncilLookups(db, actorId, councilId, table, `delete the council's ${table} lookups`);
        const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [id] = ? AND [CouncilID] = ?`, [
          id,
          councilId,
        ]);
        if (!row) {
          throw new BusinessRuleError('RECORD_NOT_FOUND', `${table} ${id} does not exist in council ${councilId}.`, { table, id, councilId });
        }
        await this.assertRecordUnused(db, table, id, String(row[COUNCIL_LOOKUP_META[table].keyField]));
        await db.runAsync(`DELETE FROM [${table}] WHERE [id] = ?`, [id]);
      });
    },
  };

  /**
   * Loads the actor, checks the council exists and applies assertMayManageCouncilLookups. Also the allow-list
   * for the council lookup table names interpolated into SQL.
   */
  private async assertMayManageCouncilLookups(
    db: SQLite.SQLiteDatabase,
    actorId: number,
    councilId: number,
    table: CouncilLookupTableName,
    action: string,
  ): Promise<void> {
    if (!COUNCIL_LOOKUP_META[table]) throw new Error(`Unknown council lookup table: ${String(table)}`);
    const actor = await this.memberWriteActor(db, actorId);
    await this.assertCouncilsExist(db, [councilId]);
    assertMayManageCouncilLookups(actor, councilId, table, action);
  }

  private async councilLookupRows<T extends CouncilLookupTableName>(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    table: T,
  ): Promise<CouncilLookupRowMap[T][]> {
    const rows = await db.getAllAsync<CouncilLookupRowMap[T]>(`SELECT * FROM [${table}] WHERE [CouncilID] = ?`, [councilId]);
    return sortCouncilLookupRows(table, rows);
  }

  private async requireLookupRow(
    db: SQLite.SQLiteDatabase,
    table: LookupTableName,
    id: number,
  ): Promise<Record<string, unknown>> {
    const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]);
    if (!row) {
      throw new BusinessRuleError('INVALID_INPUT', `${LOOKUP_META[table].label} ${id} does not exist.`, { table, id });
    }
    return row;
  }

  councils: DataService['councils'] = {
    list: async () => {
      const db = await this.ready();
      return db.getAllAsync<Council>('SELECT * FROM [Council] ORDER BY [CouncilNumber], [CouncilName]');
    },
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [id])) ?? null;
    },
    listAffiliated: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Council>(
        `SELECT * FROM [Council]
          WHERE [id] <> ?
            AND [id] IN (SELECT [AffiliatedCouncilID] FROM [AffiliatedCouncils] WHERE [PrimaryCouncilID] = ?
                         UNION
                         SELECT [PrimaryCouncilID] FROM [AffiliatedCouncils] WHERE [AffiliatedCouncilID] = ?)
          ORDER BY [CouncilNumber], [CouncilName]`,
        [councilId, councilId, councilId],
      );
    },

    create: async (actorId, council) => {
      const db = await this.ready();
      assertMayMaintainCouncils(await this.memberWriteActor(db, actorId), 'add councils');
      const clean = cleanCouncil(council);
      let id = 0;
      await db.withTransactionAsync(async () => {
        const rows = await db.getAllAsync<Record<string, unknown>>('SELECT [id], [CouncilNumber] FROM [Council]');
        assertRecordValueUnique('Council', rows, 'CouncilNumber', clean.CouncilNumber, 'by another council');
        id = await this.insertRecord(db, 'Council', COUNCIL_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      assertMayMaintainCouncils(await this.memberWriteActor(db, actorId), `change council ${id}`);
      await db.withTransactionAsync(async () => {
        const row = await this.requireRecord(db, 'Council', id);
        const clean = cleanCouncil(mergeRecordChanges<NewCouncil>(row, changes, COUNCIL_COLUMNS));
        const rows = await db.getAllAsync<Record<string, unknown>>('SELECT [id], [CouncilNumber] FROM [Council]');
        assertRecordValueUnique('Council', rows, 'CouncilNumber', clean.CouncilNumber, 'by another council', id);
        await this.updateRecord(db, 'Council', id, COUNCIL_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayMaintainCouncils(await this.memberWriteActor(db, actorId), `delete council ${id}`);
        const row = await this.requireRecord(db, 'Council', id);
        await this.assertRecordUnused(db, 'Council', id, `${String(row.CouncilNumber)} ${String(row.CouncilName)}`);
        await db.runAsync('DELETE FROM [Council] WHERE [id] = ?', [id]);
      });
    },

    setFeatureFlags: async (actorId, councilId, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayMaintainCouncils(await this.memberWriteActor(db, actorId), `change the feature flags of council ${councilId}`);
        await this.requireRecord(db, 'Council', councilId);
        const flags = Object.entries(cleanFeatureFlagChanges(changes));
        // Column names come from FEATURE_FLAG_NAMES via cleanFeatureFlagChanges, never from the caller.
        if (flags.length > 0) {
          await db.runAsync(`UPDATE [Council] SET ${flags.map(([name]) => `[${name}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...flags.map(([, value]) => value),
            councilId,
          ]);
        }
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [councilId]))!;
    },

    setBylaws: async (actorId, councilId, markdown) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        await this.requireRecord(db, 'Council', councilId);
        assertMayEditBylaws(actor, councilId);
        await db.runAsync('UPDATE [Council] SET [BylawsMarkdown] = ?, [BylawsUpdatedAt] = ? WHERE [id] = ?', [
          cleanBylawsText(markdown),
          new Date().toISOString(),
          councilId,
        ]);
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [councilId]))!;
    },

    setDuesRate: async (actorId, councilId, rate) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        await this.requireRecord(db, 'Council', councilId);
        assertMayEditDuesRate(actor, councilId);
        await db.runAsync('UPDATE [Council] SET [base_dues_rate] = ? WHERE [id] = ?', [cleanDuesRate(rate), councilId]);
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [councilId]))!;
    },

    setEmailGateway: async (actorId, councilId, settings) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayMaintainCouncilRecords(await this.memberWriteActor(db, actorId), councilId, 'configure the email gateway');
        await this.requireRecord(db, 'Council', councilId);
        const g = settings === null ? CLEARED_EMAIL_GATEWAY : cleanEmailGatewaySettings(settings);
        await db.runAsync(
          'UPDATE [Council] SET [EmailProvider] = ?, [SmtpHost] = ?, [SmtpPort] = ?, [SmtpUsername] = ? WHERE [id] = ?',
          [g.EmailProvider, g.SmtpHost, g.SmtpPort, g.SmtpUsername, councilId],
        );
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [councilId]))!;
    },
  };

  // ---- council-level maintenance: parishes, pastors, activities, lists ----

  parishes: DataService['parishes'] = {
    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Parish>('SELECT * FROM [Parish] WHERE [CouncilID] = ? ORDER BY [Name] COLLATE NOCASE, [id]', [councilId]);
    },

    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Parish>('SELECT * FROM [Parish] WHERE [id] = ?', [id])) ?? null;
    },

    create: async (actorId, parish) => {
      const clean = cleanParish(parish);
      const db = await this.ready();
      assertMayMaintainCouncilRecords(await this.memberWriteActor(db, actorId), clean.CouncilID, 'add parishes');
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.assertCouncilsExist(db, [clean.CouncilID]);
        await this.assertParishNameUnique(db, clean);
        id = await this.insertRecord(db, 'Parish', PARISH_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Parish>('SELECT * FROM [Parish] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Parish', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `change parish ${id}`);
        const clean = cleanParish(mergeRecordChanges<NewParish>(row, changes, PARISH_COLUMNS));
        if (clean.CouncilID !== row.CouncilID) {
          assertMayMaintainCouncilRecords(actor, clean.CouncilID, `move parish ${id}`);
          await this.assertCouncilsExist(db, [clean.CouncilID]);
        }
        await this.assertParishNameUnique(db, clean, id);
        await this.updateRecord(db, 'Parish', id, PARISH_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Parish>('SELECT * FROM [Parish] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Parish', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `delete parish ${id}`);
        await this.assertRecordUnused(db, 'Parish', id, String(row.Name));
        await db.runAsync('DELETE FROM [Parish] WHERE [id] = ?', [id]);
      });
    },
  };

  private async assertParishNameUnique(db: SQLite.SQLiteDatabase, clean: NewParish, ignoreId?: number): Promise<void> {
    const siblings = await db.getAllAsync<Record<string, unknown>>('SELECT [id], [Name] FROM [Parish] WHERE [CouncilID] = ?', [
      clean.CouncilID,
    ]);
    assertRecordValueUnique('Parish', siblings, 'Name', clean.Name, `in council ${clean.CouncilID}`, ignoreId);
  }

  pastors: DataService['pastors'] = {
    listByParish: async (parishId) => {
      const db = await this.ready();
      return db.getAllAsync<Pastor>(
        'SELECT * FROM [Pastor] WHERE [ParishID] = ? ORDER BY [LastName] COLLATE NOCASE, [FirstName] COLLATE NOCASE, [id]',
        [parishId],
      );
    },

    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Pastor>(
        `SELECT p.* FROM [Pastor] p JOIN [Parish] pa ON pa.[id] = p.[ParishID]
          WHERE pa.[CouncilID] = ?
          ORDER BY p.[LastName] COLLATE NOCASE, p.[FirstName] COLLATE NOCASE, p.[id]`,
        [councilId],
      );
    },

    create: async (actorId, pastor) => {
      const clean = cleanPastor(pastor);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const councilId = await this.parishCouncilId(db, clean.ParishID);
        // A non-admin hears ADMIN_REQUIRED even for an unknown parish; the parish only decides the tenant.
        assertMayMaintainCouncilRecords(actor, councilId ?? actor.councilId, 'add pastors');
        if (councilId === null) throw noParish(clean.ParishID);
        id = await this.insertRecord(db, 'Pastor', PASTOR_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Pastor>('SELECT * FROM [Pastor] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Pastor', id);
        assertMayMaintainCouncilRecords(actor, (await this.parishCouncilId(db, row.ParishID as number))!, `change pastor ${id}`);
        const clean = cleanPastor(mergeRecordChanges<NewPastor>(row, changes, PASTOR_COLUMNS));
        if (clean.ParishID !== row.ParishID) {
          const councilId = await this.parishCouncilId(db, clean.ParishID);
          assertMayMaintainCouncilRecords(actor, councilId ?? actor.councilId, `move pastor ${id}`);
          if (councilId === null) throw noParish(clean.ParishID);
        }
        await this.updateRecord(db, 'Pastor', id, PASTOR_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Pastor>('SELECT * FROM [Pastor] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Pastor', id);
        assertMayMaintainCouncilRecords(actor, (await this.parishCouncilId(db, row.ParishID as number))!, `delete pastor ${id}`);
        await db.runAsync('DELETE FROM [Pastor] WHERE [id] = ?', [id]);
      });
    },
  };

  /** The parish's council, or null when there is no such parish. */
  private async parishCouncilId(db: SQLite.SQLiteDatabase, parishId: number): Promise<number | null> {
    return (await db.getFirstAsync<{ CouncilID: number }>('SELECT [CouncilID] FROM [Parish] WHERE [id] = ?', [parishId]))?.CouncilID ?? null;
  }

  activities: DataService['activities'] = {
    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Activities>('SELECT * FROM [Activities] WHERE [CouncilID] = ? ORDER BY [ActivityName], [id]', [
        councilId,
      ]);
    },

    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [id])) ?? null;
    },

    create: async (actorId, activity) => {
      const clean = cleanActivity(activity);
      const db = await this.ready();
      assertMayMaintainCouncilRecords(await this.memberWriteActor(db, actorId), clean.CouncilID, 'add activities');
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.assertActivityReferences(db, clean);
        await this.assertActivityNameUnique(db, clean);
        id = await this.insertRecord(db, 'Activities', ACTIVITY_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Activities', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `change activity ${id}`);
        const clean = cleanActivity(mergeRecordChanges<NewActivity>(row, changes, ACTIVITY_COLUMNS));
        if (clean.CouncilID !== row.CouncilID) assertMayMaintainCouncilRecords(actor, clean.CouncilID, `move activity ${id}`);
        await this.assertActivityReferences(db, clean);
        await this.assertActivityNameUnique(db, clean, id);
        await this.updateRecord(db, 'Activities', id, ACTIVITY_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Activities', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `delete activity ${id}`);
        await this.assertRecordUnused(db, 'Activities', id, String(row.ActivityName));
        await db.runAsync('DELETE FROM [Activities] WHERE [id] = ?', [id]);
      });
    },

    listSummaries: async (councilId) => {
      const activities = await this.activities.listByCouncil(councilId);
      const db = await this.ready();
      const times = await db.getAllAsync<Pick<ActivityTime, 'ActivityID' | 'ActivityDate' | 'Hours'>>(
        `SELECT t.[ActivityID], t.[ActivityDate], t.[Hours] FROM [ActivityTime] t
           JOIN [Activities] a ON a.[id] = t.[ActivityID]
          WHERE a.[CouncilID] = ?`,
        [councilId],
      );
      return summarizeActivities(activities, times);
    },
  };

  private async assertActivityReferences(db: SQLite.SQLiteDatabase, clean: NewActivity): Promise<void> {
    await this.assertCouncilsExist(db, [clean.CouncilID]);
    await this.assertRowExists(db, 'Category', clean.CategoryID, 'activity category');
  }

  private async assertActivityNameUnique(db: SQLite.SQLiteDatabase, clean: NewActivity, ignoreId?: number): Promise<void> {
    const siblings = await db.getAllAsync<Record<string, unknown>>(
      'SELECT [id], [ActivityName] FROM [Activities] WHERE [CouncilID] = ?',
      [clean.CouncilID],
    );
    assertRecordValueUnique('Activities', siblings, 'ActivityName', clean.ActivityName, `in council ${clean.CouncilID}`, ignoreId);
  }

  distributionLists: DataService['distributionLists'] = {
    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return this.sortedLists(db, '[CouncilID] = ? AND [IsCouncilWide] = 1', [councilId]);
    },

    listForMember: async (actorId, councilId) => {
      const db = await this.ready();
      await this.requireMember(db, actorId);
      return this.sortedLists(db, '[CouncilID] = ? AND ([IsCouncilWide] = 1 OR [CreatedBy] = ?)', [councilId, actorId]);
    },

    create: async (actorId, list) => {
      const clean = cleanNewDistributionList(list);
      const councilWide = clean.IsCouncilWide ?? false;
      const db = await this.ready();
      assertMayCreateDistributionList(await this.memberWriteActor(db, actorId), clean.CouncilID, councilWide);
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.assertCouncilsExist(db, [clean.CouncilID]);
        await this.assertListNameUnique(db, clean.CouncilID, clean.ListName, councilWide, actorId);
        await this.assertListMembers(db, clean.CouncilID, clean.memberIds);
        const res = await db.runAsync('INSERT INTO [DistributionLists] ([ListName], [CouncilID], [CreatedBy], [IsCouncilWide]) VALUES (?, ?, ?, ?)', [
          clean.ListName,
          clean.CouncilID,
          actorId,
          councilWide ? 1 : 0,
        ]);
        id = res.lastInsertRowId;
        await this.insertListMembers(db, id, clean.memberIds);
      });
      return this.listSummary(db, id);
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.storedList(db, id);
        const clean = cleanDistributionListChanges(changes);
        assertMayChangeDistributionList(actor, row, `change distribution list ${id}`, clean.IsCouncilWide);
        const councilWide = clean.IsCouncilWide ?? row.IsCouncilWide;
        if (clean.ListName !== undefined || clean.IsCouncilWide !== undefined) {
          await this.assertListNameUnique(db, row.CouncilID, clean.ListName ?? row.ListName, councilWide, row.CreatedBy ?? actorId, id);
        }
        if (clean.ListName !== undefined) await db.runAsync('UPDATE [DistributionLists] SET [ListName] = ? WHERE [id] = ?', [clean.ListName, id]);
        if (clean.IsCouncilWide !== undefined) {
          await db.runAsync('UPDATE [DistributionLists] SET [IsCouncilWide] = ? WHERE [id] = ?', [clean.IsCouncilWide ? 1 : 0, id]);
        }
        if (clean.memberIds !== undefined) {
          await this.assertListMembers(db, row.CouncilID, clean.memberIds);
          await db.runAsync('DELETE FROM [DistributionListMembers] WHERE [ListID] = ?', [id]);
          await this.insertListMembers(db, id, clean.memberIds);
        }
      });
      return this.listSummary(db, id);
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        assertMayChangeDistributionList(actor, await this.storedList(db, id), `delete distribution list ${id}`);
        await db.runAsync('DELETE FROM [DistributionListMembers] WHERE [ListID] = ?', [id]);
        await db.runAsync('DELETE FROM [DistributionLists] WHERE [id] = ?', [id]);
      });
    },
  };

  /** Lists matching `where` (fixed SQL only, never user text), ordered by name, with their members. */
  private async sortedLists(db: SQLite.SQLiteDatabase, where: string, params: Bind[]): Promise<DistributionListSummary[]> {
    const lists = await db.getAllAsync<DistributionLists>(`SELECT * FROM [DistributionLists] WHERE ${where} ORDER BY [ListName] COLLATE NOCASE, [id]`, params);
    const members = await selectIn<{ ListID: number; MemberID: number }>(
      db,
      (m) => `SELECT [ListID], [MemberID] FROM [DistributionListMembers] WHERE [ListID] IN (${m}) ORDER BY [MemberID]`,
      lists.map((l) => l.id),
    );
    return lists.map((list) => ({ list, memberIds: members.filter((m) => m.ListID === list.id).map((m) => m.MemberID) }));
  }

  /** A list as the access rules read it; an unknown id rejects RECORD_NOT_FOUND. */
  private async storedList(
    db: SQLite.SQLiteDatabase,
    id: number,
  ): Promise<{ id: number; CouncilID: number; CreatedBy: number | null; IsCouncilWide: boolean; ListName: string }> {
    const row = await db.getFirstAsync<DistributionLists>('SELECT * FROM [DistributionLists] WHERE [id] = ?', [id]);
    if (!row) throw distributionListNotFound(id);
    return { id, CouncilID: row.CouncilID ?? 0, CreatedBy: row.CreatedBy ?? null, IsCouncilWide: isCouncilWideList(row), ListName: row.ListName ?? '' };
  }

  private async listSummary(db: SQLite.SQLiteDatabase, id: number): Promise<DistributionListSummary> {
    const list = (await db.getFirstAsync<DistributionLists>('SELECT * FROM [DistributionLists] WHERE [id] = ?', [id]))!;
    const members = await db.getAllAsync<{ MemberID: number }>(
      'SELECT [MemberID] FROM [DistributionListMembers] WHERE [ListID] = ? ORDER BY [MemberID]',
      [id],
    );
    return { list, memberIds: members.map((m) => m.MemberID) };
  }

  /** A council-wide list's name is unique among the council's council-wide lists; a private one among its creator's. */
  private async assertListNameUnique(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    name: string,
    councilWide: boolean,
    ownerId: number,
    ignoreId?: number,
  ): Promise<void> {
    const rows = await db.getAllAsync<{ id: number; ListName: string | null; CouncilID: number; CreatedBy: number | null; IsCouncilWide: number }>(
      'SELECT [id], [ListName], [CouncilID], [CreatedBy], [IsCouncilWide] FROM [DistributionLists] WHERE [CouncilID] = ?',
      [councilId],
    );
    const siblings = distributionListNameSiblings(rows, councilId, councilWide, ownerId);
    assertRecordValueUnique('DistributionLists', siblings, 'ListName', name, councilWide ? `among council ${councilId}'s lists` : 'among your private lists', ignoreId);
  }

  /** Every list member must exist and belong to the list's council. */
  private async assertListMembers(db: SQLite.SQLiteDatabase, councilId: number, memberIds: readonly number[]): Promise<void> {
    const found = await selectIn<{ id: number; CouncilID: number }>(
      db,
      (m) => `SELECT [id], [CouncilID] FROM [Member] WHERE [id] IN (${m})`,
      memberIds,
    );
    for (const memberId of memberIds) {
      const member = found.find((f) => f.id === memberId);
      if (!member || member.CouncilID !== councilId) {
        throw new BusinessRuleError(
          'INVALID_INPUT',
          member
            ? `Member ${memberId} belongs to council ${member.CouncilID}, not council ${councilId}; a distribution list holds only its own council's members.`
            : `No member with id ${memberId}.`,
          { memberId, councilId },
        );
      }
    }
  }

  private async insertListMembers(db: SQLite.SQLiteDatabase, listId: number, memberIds: readonly number[]): Promise<void> {
    for (const memberId of memberIds) {
      await db.runAsync('INSERT INTO [DistributionListMembers] ([ListID], [MemberID]) VALUES (?, ?)', [listId, memberId]);
    }
  }

  // ---- maintenance helpers ------------------------------------------------
  // `table` is always a MaintainedTable and `columns` one of the shared *_COLUMNS lists, never caller input.

  private async requireRecord(db: SQLite.SQLiteDatabase, table: MaintainedTable, id: number): Promise<Record<string, unknown>> {
    const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]);
    if (!row) throw recordNotFound(table, id);
    return row;
  }

  private async insertRecord<T extends object>(
    db: SQLite.SQLiteDatabase,
    table: MaintainedTable,
    columns: readonly (keyof T & string)[],
    clean: T,
  ): Promise<number> {
    const res = await db.runAsync(
      `INSERT INTO [${table}] (${columns.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(columns.length)})`,
      columns.map((c) => (clean[c] ?? null) as Bind),
    );
    return res.lastInsertRowId;
  }

  private async updateRecord<T extends object>(
    db: SQLite.SQLiteDatabase,
    table: MaintainedTable,
    id: number,
    columns: readonly (keyof T & string)[],
    clean: T,
  ): Promise<void> {
    await db.runAsync(`UPDATE [${table}] SET ${columns.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
      ...columns.map((c) => (clean[c] ?? null) as Bind),
      id,
    ]);
  }

  private async assertRecordUnused(db: SQLite.SQLiteDatabase, table: MaintainedTable, id: number, name: string): Promise<void> {
    const usage = [];
    for (const ref of RECORD_REFERENCES[table]) {
      const found = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM [${ref.table}] WHERE [${ref.column}] = ?`, [id]);
      usage.push({ ...ref, count: found?.n ?? 0 });
    }
    assertRecordUnused(table, id, name, usage);
  }

  members: DataService['members'] = {
    get: async (id) => {
      const db = await this.ready();
      const row = await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]);
      return row ? withoutPushToken(row) : null;
    },
    getByEmail: async (email) => {
      const db = await this.ready();
      const row = await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [Email] = ? COLLATE NOCASE', [email]);
      return row ? withoutPushToken(row) : null;
    },
    listByCouncil: async (councilId, options) => {
      const db = await this.ready();
      const active = options?.activeOnly
        ? " AND [StatusID] = (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active')"
        : '';
      const rows = await db.getAllAsync<Member>(
        `SELECT * FROM [Member] WHERE [CouncilID] = ?${active} ORDER BY [MemberLastName], [MemberFirstName]`,
        [councilId],
      );
      return rows.map(withoutPushToken);
    },
    listRoles: async (memberId) => this.rolesFor(await this.ready(), memberId),

    create: async (actorId, member) => {
      const clean = cleanNewMember(member, this.now());
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        assertMayCreateMember(await this.memberWriteActor(db, actorId), clean, await this.memberTypeName(db, clean.MemberTypeID));
        await this.assertMemberReferences(db, clean);
        const taken = await db.getFirstAsync<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM [Member] WHERE [Email] = ? COLLATE NOCASE)
                + (SELECT COUNT(*) FROM [Credentials] WHERE [Username] = ? COLLATE NOCASE) AS n`,
          [clean.Email, clean.Email],
        );
        if ((taken?.n ?? 0) > 0) {
          throw new BusinessRuleError('INVALID_INPUT', `The email ${clean.Email} already belongs to a member or login.`, {
            email: clean.Email,
          });
        }
        const cred = await db.runAsync('INSERT INTO [Credentials] ([Username], [Password]) VALUES (?, ?)', [
          clean.Email,
          UNREGISTERED_PASSWORD,
        ]);
        const cols = MEMBER_COLUMNS.filter((c) => clean[c] != null);
        const res = await db.runAsync(
          `INSERT INTO [Member] (${cols.map((c) => `[${c}]`).join(', ')}, [CredentialID]) VALUES (${marks(cols.length + 1)})`,
          [...cols.map((c) => clean[c] as Bind), cred.lastInsertRowId],
        );
        id = res.lastInsertRowId;
      });
      const created = withoutPushToken((await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]))!);
      await this.sendWelcomeEmail(db, created);
      return created;
    },

    resendWelcome: async (actorId, memberId) => {
      const db = await this.ready();
      const actor = await this.memberWriteActor(db, actorId);
      const member = await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [memberId]);
      if (!member) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${memberId}.`, { memberId });
      assertMayImportSupremeRoster(actor, member.CouncilID, `send member ${memberId} a new setup code`);
      if (await db.getFirstAsync('SELECT [id] FROM [Credentials] WHERE [id] = ? AND [Password] <> ?', [member.CredentialID, UNREGISTERED_PASSWORD])) {
        throw new BusinessRuleError('ALREADY_REGISTERED', `${member.Email} has already registered; they can reset their password instead.`, { memberId });
      }
      await this.sendWelcomeEmail(db, withoutPushToken(member));
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const existing = await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]);
        if (!existing) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${id}.`, { memberId: id });
        const clean = mergeMemberChanges(existing, changes, this.now());
        assertMayUpdateMember(actor, existing, clean, {
          current: await this.memberTypeName(db, existing.MemberTypeID),
          next: await this.memberTypeName(db, clean.MemberTypeID),
        });
        await this.assertMemberReferences(db, clean);
        const taken = await db.getFirstAsync<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM [Member] WHERE [Email] = ? COLLATE NOCASE AND [id] <> ?)
                + (SELECT COUNT(*) FROM [Credentials] WHERE [Username] = ? COLLATE NOCASE AND [id] <> ?) AS n`,
          [clean.Email, id, clean.Email, existing.CredentialID],
        );
        if ((taken?.n ?? 0) > 0) {
          throw new BusinessRuleError('INVALID_INPUT', `The email ${clean.Email} already belongs to a member or login.`, {
            email: clean.Email,
          });
        }
        await db.runAsync('UPDATE [Credentials] SET [Username] = ? WHERE [id] = ?', [clean.Email, existing.CredentialID]);
        await db.runAsync(`UPDATE [Member] SET ${MEMBER_COLUMNS.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
          ...MEMBER_COLUMNS.map((c) => (clean[c] ?? null) as Bind),
          id,
        ]);
      });
      return withoutPushToken((await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]))!);
    },
  };

  /** The caller of a member write, read from the database so the client cannot claim a type it does not hold. */
  private async memberWriteActor(db: SQLite.SQLiteDatabase, actorId: number): Promise<MemberWriteActor> {
    const actor = await db.getFirstAsync<{ councilId: number; type: string | null; active: number; budgetDirector: number }>(
      `SELECT m.[CouncilID] AS councilId, t.[Type] AS type, (st.[Status] = 'Active') AS active, m.[IsBudgetDirector] AS budgetDirector FROM [Member] m
         LEFT JOIN [MemberType] t ON t.[id] = m.[MemberTypeID]
         LEFT JOIN [MemberStatus] st ON st.[id] = m.[StatusID]
        WHERE m.[id] = ?`,
      [actorId],
    );
    if (!actor) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${actorId}.`, { memberId: actorId });
    const roles = await db.getAllAsync<{ Role: string; Officer: number }>(
      'SELECT r.[Role], r.[Officer] FROM [MemberRoles] mr JOIN [Role] r ON r.[id] = mr.[RoleID] WHERE mr.[MemberID] = ? ORDER BY r.[id]',
      [actorId],
    );
    return {
      memberId: actorId,
      councilId: actor.councilId,
      memberType: actor.type ?? undefined,
      active: actor.active === 1,
      roles: roles.map((r) => r.Role),
      budgetDirector: actor.budgetDirector === 1,
      officer: roles.some((r) => r.Officer === 1),
    };
  }

  private async memberTypeName(db: SQLite.SQLiteDatabase, typeId: number): Promise<string | undefined> {
    return (await db.getFirstAsync<{ Type: string }>('SELECT [Type] FROM [MemberType] WHERE [id] = ?', [typeId]))?.Type;
  }

  /** The council and lookup ids a member row points at must exist. */
  private async assertMemberReferences(db: SQLite.SQLiteDatabase, clean: NewMember): Promise<void> {
    await this.assertCouncilsExist(db, [clean.CouncilID]);
    await this.assertRowExists(db, 'MemberStatus', clean.StatusID, 'member status');
    await this.assertRowExists(db, 'Degree', clean.DegreeID, 'degree');
    await this.assertRowExists(db, 'MemberType', clean.MemberTypeID, 'member type');
    if (clean.WorkingStatusID != null) await this.assertRowExists(db, 'WorkingStatus', clean.WorkingStatusID, 'working status');
  }

  /**
   * The post-insert hook after members.create or supreme.syncSupremeRoster stores a member: issues their one-time setup
   * code (only its hash is kept), compiles the welcome email and sends it as a SendGrid request (sendEmail).
   */
  private async sendWelcomeEmail(db: SQLite.SQLiteDatabase, member: Member): Promise<void> {
    try {
      const code = formatEnrollmentCode(await Crypto.getRandomBytesAsync(20));
      const issuedAt = this.now();
      const expiresAt = enrollmentCodeExpiry(issuedAt);
      await db.runAsync('INSERT INTO [MemberEnrollmentToken] ([MemberID], [TokenHash], [CreatedAt], [ExpiresAt]) VALUES (?, ?, ?, ?)', [
        member.id,
        await sha256Hex(enrollmentCodeHashInput(code)),
        toTimestamp(issuedAt),
        expiresAt,
      ]);
      const council = (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [member.CouncilID]))!;
      const admin = await db.getFirstAsync<{ first: string; last: string; Email: string; Phone: string }>(
        `SELECT m.[MemberFirstName] AS first, m.[MemberLastName] AS last, m.[Email], m.[Phone] FROM [Member] m
          WHERE ${ACTIVE_MEMBER_FILTER} AND m.[id] <> ?
            AND m.[MemberTypeID] = (SELECT [id] FROM [MemberType] WHERE [Type] = 'Admin')
          ORDER BY m.[MemberLastName], m.[MemberFirstName], m.[id] LIMIT 1`,
        [member.CouncilID, member.id],
      );
      const details: CouncilAdminDetails | null = admin
        ? { name: `${admin.first} ${admin.last}`, email: admin.Email, phone: admin.Phone }
        : null;
      const packet = buildWelcomeEmail({ member, council, admin: details, enrollment: { code, expiresAt } });
      await this.sendEmail(buildSendGridMailRequest(packet.email));
    } catch (err) {
      // The member is already saved; a failed notification must not undo or fail that.
      console.error('[notification] welcome email failed:', err);
    }
  }

  /** Friendly INVALID_INPUT for a foreign key the generic constraint message would explain poorly. `table` is always a literal. */
  private async assertRowExists(db: SQLite.SQLiteDatabase, table: string, id: number, label: string): Promise<void> {
    if (!(await db.getFirstAsync(`SELECT [id] FROM [${table}] WHERE [id] = ?`, [id]))) {
      throw new BusinessRuleError('INVALID_INPUT', `No ${label} with id ${id}.`, { table, id });
    }
  }

  // ---- Phase 2: member profiles, skill messaging, donations -------------

  memberProfiles: DataService['memberProfiles'] = {
    listOptions: async () => {
      const db = await this.ready();
      const options: ProfileOptions = {
        skills: await db.getAllAsync<Skill>('SELECT * FROM [Skill] ORDER BY [SkillName], [id]'),
        skillLevels: await db.getAllAsync<SkillLevel>('SELECT * FROM [SkillLevel] ORDER BY [id]'),
        trainingClasses: await db.getAllAsync<KOCTrainingClasses>('SELECT * FROM [KOCTrainingClasses] ORDER BY [ClassName], [id]'),
        workingStatuses: await db.getAllAsync<WorkingStatus>('SELECT * FROM [WorkingStatus] ORDER BY [id]'),
      };
      return options;
    },

    getExtensions: async (memberId) => {
      const db = await this.ready();
      await this.requireMember(db, memberId);
      return this.extensionsOf(db, memberId);
    },

    updateExtensions: async (actorId, memberId, skills, training, workingStatusId) => {
      const clean = cleanMemberExtensions(skills, training, workingStatusId, this.now());
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        await this.requireMember(db, memberId);
        const target = (await db.getFirstAsync<{ CouncilID: number }>('SELECT [CouncilID] FROM [Member] WHERE [id] = ?', [memberId]))!;
        assertMayEditMemberExtensions(actor, { id: memberId, CouncilID: target.CouncilID });
        for (const s of clean.skills) {
          await this.assertRowExists(db, 'Skill', s.skillId, 'skill');
          await this.assertRowExists(db, 'SkillLevel', s.skillLevelId, 'skill level');
        }
        for (const t of clean.training) await this.assertRowExists(db, 'KOCTrainingClasses', t.trainingClassId, 'training class');
        if (clean.workingStatusId !== null) await this.assertRowExists(db, 'WorkingStatus', clean.workingStatusId, 'working status');

        await db.runAsync('DELETE FROM [MemberSkill] WHERE [MemberID] = ?', [memberId]);
        for (const s of clean.skills) {
          await db.runAsync('INSERT INTO [MemberSkill] ([SkillID], [SkillLevelID], [MemberID]) VALUES (?, ?, ?)', [
            s.skillId,
            s.skillLevelId,
            memberId,
          ]);
        }
        await db.runAsync('DELETE FROM [MemberTraining] WHERE [MemberID] = ?', [memberId]);
        for (const t of clean.training) {
          await db.runAsync('INSERT INTO [MemberTraining] ([MemberID], [TrainingClassID], [YearTaken]) VALUES (?, ?, ?)', [
            memberId,
            t.trainingClassId,
            trainingYearToDate(t.year),
          ]);
        }
        await db.runAsync('UPDATE [Member] SET [WorkingStatusID] = ? WHERE [id] = ?', [clean.workingStatusId, memberId]);
      });
      return this.extensionsOf(db, memberId);
    },
  };

  private async extensionsOf(db: SQLite.SQLiteDatabase, memberId: number): Promise<MemberExtensions> {
    const member = await db.getFirstAsync<{ WorkingStatusID: number | null }>('SELECT [WorkingStatusID] FROM [Member] WHERE [id] = ?', [
      memberId,
    ]);
    const workingStatus =
      member?.WorkingStatusID == null
        ? null
        : ((await db.getFirstAsync<WorkingStatus>('SELECT * FROM [WorkingStatus] WHERE [id] = ?', [member.WorkingStatusID])) ?? null);
    const skills = new Map((await db.getAllAsync<Skill>('SELECT * FROM [Skill]')).map((r) => [r.id, r]));
    const levels = new Map((await db.getAllAsync<SkillLevel>('SELECT * FROM [SkillLevel]')).map((r) => [r.id, r]));
    const classes = new Map((await db.getAllAsync<KOCTrainingClasses>('SELECT * FROM [KOCTrainingClasses]')).map((r) => [r.id, r]));
    const skillRows = await db.getAllAsync<MemberSkill>('SELECT * FROM [MemberSkill] WHERE [MemberID] = ? ORDER BY [id]', [memberId]);
    const trainingRows = await db.getAllAsync<MemberTraining>(
      'SELECT * FROM [MemberTraining] WHERE [MemberID] = ? ORDER BY [YearTaken] DESC, [id]',
      [memberId],
    );
    return {
      workingStatus,
      skills: skillRows.map((row) => ({ row, skill: skills.get(row.SkillID)!, level: levels.get(row.SkillLevelID)! })),
      training: trainingRows.map((row) => ({
        row,
        trainingClass: classes.get(row.TrainingClassID)!,
        year: trainingDateToYear(row.YearTaken),
      })),
    };
  }

  communication: DataService['communication'] = {
    listCouncilSkills: async (councilId) => {
      const db = await this.ready();
      const rows = await db.getAllAsync<{
        memberId: number;
        firstName: string;
        lastName: string;
        phone: string;
        email: string;
        skillId: number;
        SkillName: string;
        levelId: number;
        SkillLevel: string;
      }>(
        `SELECT m.[id] AS memberId, m.[MemberFirstName] AS firstName, m.[MemberLastName] AS lastName,
                m.[Phone] AS phone, m.[Email] AS email,
                s.[id] AS skillId, s.[SkillName], sl.[id] AS levelId, sl.[SkillLevel]
           FROM [MemberSkill] ms
           JOIN [Member] m ON m.[id] = ms.[MemberID]
           JOIN [Skill] s ON s.[id] = ms.[SkillID]
           JOIN [SkillLevel] sl ON sl.[id] = ms.[SkillLevelID]
          WHERE m.[CouncilID] = ?
          ORDER BY s.[SkillName], m.[MemberLastName], m.[MemberFirstName], m.[id]`,
        [councilId],
      );
      return rows.map(
        (r): CouncilSkillEntry => ({
          memberId: r.memberId,
          firstName: r.firstName,
          lastName: r.lastName,
          phone: r.phone,
          email: r.email,
          skill: { id: r.skillId, SkillName: r.SkillName },
          level: { id: r.levelId, SkillLevel: r.SkillLevel },
        }),
      );
    },

    sendBulkToSkills: async (councilId, skillId, messageText, senderId) => {
      assertText(messageText, 'Message', 10_000);
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      const skill = await db.getFirstAsync<Skill>('SELECT * FROM [Skill] WHERE [id] = ?', [skillId]);
      if (!skill) throw new BusinessRuleError('INVALID_INPUT', `No skill with id ${skillId}.`, { skillId });
      const rows = await db.getAllAsync<{ id: number }>(
        `SELECT m.[id] FROM [Member] m
          WHERE ${ACTIVE_MEMBER_FILTER} AND m.[id] <> ?
            AND EXISTS (SELECT 1 FROM [MemberSkill] ms WHERE ms.[MemberID] = m.[id] AND ms.[SkillID] = ?)
          ORDER BY m.[id]`,
        [councilId, senderId, skillId],
      );
      const recipientIds = rows.map((r) => r.id);
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
      const db = await this.ready();
      const rows = await db.getAllAsync<CouncilDonationMethod & { MethodName: string }>(
        `SELECT cdm.*, dm.[DonationMethod] AS MethodName FROM [CouncilDonationMethod] cdm
           JOIN [DonationMethod] dm ON dm.[id] = cdm.[DonationMethodID]
          WHERE cdm.[CouncilID] = ? ORDER BY dm.[id], cdm.[id]`,
        [councilId],
      );
      return rows.map(({ MethodName, ...link }) => ({
        method: { id: link.DonationMethodID, DonationMethod: MethodName },
        kind: donationMethodKind(MethodName),
        link,
        qrCodeUrl: link.DonationMethodURL || null,
      }));
    },

    listAllMethods: async () => {
      const db = await this.ready();
      return db.getAllAsync<DonationMethod>('SELECT [id], [DonationMethod] FROM [DonationMethod] ORDER BY [id]');
    },

    listTypes: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<DonationType>('SELECT * FROM [DonationType] WHERE [CouncilID] = ? ORDER BY [DonationType], [id]', [
        councilId,
      ]);
    },

    list: async (councilId, options) => {
      const db = await this.ready();
      const byEvent = options?.eventId !== undefined;
      return db.getAllAsync<Donation>(
        `SELECT * FROM [Donation] WHERE [CouncilID] = ?${byEvent ? ' AND [EventID] = ?' : ''}
          ORDER BY [DonationDate] DESC, [id] DESC`,
        byEvent ? [councilId, options!.eventId!] : [councilId],
      );
    },

    listHistory: async (councilId, eventId) => {
      const db = await this.ready();
      let events: CouncilEvent[];
      let donations: Donation[];
      if (eventId === undefined) {
        events = await db.getAllAsync<CouncilEvent>(
          'SELECT * FROM [Event] WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)',
          [councilId],
        );
        donations = await db.getAllAsync<Donation>(
          `SELECT * FROM [Donation]
            WHERE ([EventID] IS NULL AND [CouncilID] = ?)
               OR [EventID] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)`,
          [councilId, councilId],
        );
      } else {
        const event = await this.requireEvent(db, eventId);
        await this.assertEventLinked(db, event, councilId);
        events = [event];
        donations = await db.getAllAsync<Donation>('SELECT * FROM [Donation] WHERE [EventID] = ?', [eventId]);
      }
      const recorders = [...new Set(donations.map((d) => d.RecordedBy).filter((id): id is number => id != null))];
      const members = await selectIn<{ id: number; MemberFirstName: string; MemberLastName: string }>(
        db,
        (m) => `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member] WHERE [id] IN (${m})`,
        recorders,
      );
      return buildDonationHistory(councilId, eventId, {
        donations,
        events,
        methods: await db.getAllAsync<DonationMethod>('SELECT * FROM [DonationMethod]'),
        types: await db.getAllAsync<DonationType>('SELECT * FROM [DonationType]'),
        names: new Map(members.map((m) => [m.id, `${m.MemberFirstName} ${m.MemberLastName}`])),
      });
    },

    record: async (actorId, donation) => {
      const clean = cleanNewDonation(donation, this.now());
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, actorId);
        await this.assertDonationReferences(db, clean);
        await this.withFundsSync(db, [clean.EventID], async () => {
          const res = await db.runAsync(
            `INSERT INTO [Donation] ([CouncilID], [DonationDate], [DonationMethodID], [DonationTypeID], [Donor],
                                     [DonationDesciption], [EventID], [DonationAmount], [DonationPhotoURL], [RecordedBy])
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clean.CouncilID,
              clean.DonationDate,
              clean.DonationMethodID,
              clean.DonationTypeID,
              clean.Donor ?? null,
              clean.DonationDesciption ?? null,
              clean.EventID ?? null,
              clean.DonationAmount,
              clean.DonationPhotoURL ?? null,
              actorId,
            ],
          );
          id = res.lastInsertRowId;
        });
      });
      return (await db.getFirstAsync<Donation>('SELECT * FROM [Donation] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const existing = await this.requireDonation(db, id);
        assertMayChangeDonation(actor, existing, await this.eventOwnerOf(db, existing.EventID), `change donation ${id}`);
        const clean = mergeDonationChanges(existing, changes, this.now());
        if ((clean.EventID ?? null) !== (existing.EventID ?? null)) {
          assertMayChangeDonation(actor, existing, await this.eventOwnerOf(db, clean.EventID), `move donation ${id} to another event`);
        }
        await this.assertDonationReferences(db, clean);
        await this.withFundsSync(db, [existing.EventID, clean.EventID], async () => {
          await db.runAsync(`UPDATE [Donation] SET ${DONATION_EDITABLE_COLUMNS.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...DONATION_EDITABLE_COLUMNS.map((c) => (clean[c] ?? null) as Bind),
            id,
          ]);
        });
      });
      return this.requireDonation(db, id);
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const existing = await this.requireDonation(db, id);
        assertMayChangeDonation(actor, existing, await this.eventOwnerOf(db, existing.EventID), `delete donation ${id}`);
        await this.withFundsSync(db, [existing.EventID], async () => {
          await db.runAsync('DELETE FROM [Donation] WHERE [id] = ?', [id]);
        });
      });
    },
  };

  /** The ids a donation points at must exist and belong together (method enabled, the council's type and event). */
  private async assertDonationReferences(db: SQLite.SQLiteDatabase, clean: CleanDonation): Promise<void> {
    await this.assertCouncilsExist(db, [clean.CouncilID]);
    const method = await db.getFirstAsync<{ DonationMethod: string }>('SELECT [DonationMethod] FROM [DonationMethod] WHERE [id] = ?', [
      clean.DonationMethodID,
    ]);
    if (!method) {
      throw new BusinessRuleError('INVALID_INPUT', `No donation method with id ${clean.DonationMethodID}.`, {
        donationMethodId: clean.DonationMethodID,
      });
    }
    const enabled = await db.getFirstAsync(
      'SELECT [id] FROM [CouncilDonationMethod] WHERE [CouncilID] = ? AND [DonationMethodID] = ?',
      [clean.CouncilID, clean.DonationMethodID],
    );
    if (!enabled) {
      throw new BusinessRuleError(
        'DONATION_METHOD_NOT_ENABLED',
        `Council ${clean.CouncilID} has not enabled ${method.DonationMethod} donations.`,
        { councilId: clean.CouncilID, donationMethodId: clean.DonationMethodID },
      );
    }
    assertDonationFitsMethod(donationMethodKind(method.DonationMethod), clean);
    if (!(await db.getFirstAsync('SELECT [id] FROM [DonationType] WHERE [id] = ? AND [CouncilID] = ?', [clean.DonationTypeID, clean.CouncilID]))) {
      throw new BusinessRuleError('INVALID_INPUT', `Council ${clean.CouncilID} has no donation type with id ${clean.DonationTypeID}.`, {
        councilId: clean.CouncilID,
        donationTypeId: clean.DonationTypeID,
      });
    }
    if (clean.EventID != null) {
      const event = await this.requireEvent(db, clean.EventID);
      await this.assertEventLinked(db, event, clean.CouncilID);
      assertDonationDateForEvent(clean.DonationDate, event);
    }
  }

  private async assertEventLinked(db: SQLite.SQLiteDatabase, event: CouncilEvent, councilId: number): Promise<void> {
    if (!(await this.councilIdsOf(db, event.id)).includes(councilId)) {
      throw new BusinessRuleError('INVALID_INPUT', `"${event.EventName}" is not linked to council ${councilId}.`, {
        eventId: event.id,
        councilId,
      });
    }
  }

  private async requireDonation(db: SQLite.SQLiteDatabase, id: number): Promise<Donation> {
    const row = await db.getFirstAsync<Donation>('SELECT * FROM [Donation] WHERE [id] = ?', [id]);
    if (!row) throw new BusinessRuleError('RECORD_NOT_FOUND', `No donation with id ${id}.`, { table: 'Donation', id });
    return row;
  }

  private async eventOwnerOf(db: SQLite.SQLiteDatabase, eventId: number | null | undefined): Promise<number | null> {
    if (eventId == null) return null;
    return (await db.getFirstAsync<{ OwnerID: number }>('SELECT [OwnerID] FROM [Event] WHERE [id] = ?', [eventId]))?.OwnerID ?? null;
  }

  /** The event's funds rollup from every donation now stored against it. */
  private async eventFunds(db: SQLite.SQLiteDatabase, eventId: number): Promise<EventFunds | null> {
    const rows = await db.getAllAsync<{ DonationAmount: number; MethodName: string }>(
      `SELECT d.[DonationAmount], dm.[DonationMethod] AS MethodName FROM [Donation] d
         JOIN [DonationMethod] dm ON dm.[id] = d.[DonationMethodID]
        WHERE d.[EventID] = ?`,
      [eventId],
    );
    return rollupEventFunds(rows.map((r) => ({ DonationAmount: r.DonationAmount, kind: donationMethodKind(r.MethodName) })));
  }

  /**
   * The donation write hook: runs `write`, then overwrites the funds columns of every event it touched with
   * the new rollup (see nextEventFunds). Callers are already inside a transaction, so both land together.
   */
  private async withFundsSync(db: SQLite.SQLiteDatabase, eventIds: readonly (number | null | undefined)[], write: () => Promise<void>): Promise<void> {
    const ids = [...new Set(eventIds.filter((id): id is number => id != null))];
    const before: (EventFunds | null)[] = [];
    for (const id of ids) before.push(await this.eventFunds(db, id));
    await write();
    for (const [i, id] of ids.entries()) {
      const next = nextEventFunds(before[i], await this.eventFunds(db, id));
      if (next) {
        await db.runAsync('UPDATE [Event] SET [FundsRaised-Cash] = ?, [FundsRaised-Electronic] = ? WHERE [id] = ?', [
          next['FundsRaised-Cash'],
          next['FundsRaised-Electronic'],
          id,
        ]);
      }
    }
  }

  /** The council's Active members that `groups` reach (message distribution lists, Sprint 5Y-Mobile). */
  private async distributionRecipients(
    db: SQLite.SQLiteDatabase,
    councilId: number | undefined,
    groups: readonly DistributionGroup[] | undefined,
  ): Promise<number[]> {
    if (councilId === undefined || !groups?.length) return [];
    const rows = await db.getAllAsync<{ MemberID: number; Role: string | null; Officer: 0 | 1 | null }>(
      `SELECT m.[id] AS MemberID, r.[Role], r.[Officer] FROM [Member] m
         LEFT JOIN [MemberRoles] mr ON mr.[MemberID] = m.[id]
         LEFT JOIN [Role] r ON r.[id] = mr.[RoleID]
        WHERE m.[CouncilID] = ? AND m.[StatusID] = (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active')`,
      [councilId],
    );
    const roster = new Map<number, { memberId: number; roles: { Role: string; Officer: 0 | 1 }[] }>();
    for (const row of rows) {
      const entry = roster.get(row.MemberID) ?? { memberId: row.MemberID, roles: [] };
      if (row.Role !== null) entry.roles.push({ Role: row.Role, Officer: row.Officer ?? 0 });
      roster.set(row.MemberID, entry);
    }
    return groups.flatMap((g) => distributionGroupMemberIds(g, [...roster.values()]));
  }

  private rolesFor(db: SQLite.SQLiteDatabase, memberId: number): Promise<Role[]> {
    return db.getAllAsync<Role>(
      `SELECT r.* FROM [MemberRoles] mr JOIN [Role] r ON r.[id] = mr.[RoleID]
        WHERE mr.[MemberID] = ? ORDER BY r.[id]`,
      [memberId],
    );
  }

  // ---- expense reporting (Sprint 5R) --------------------------------------

  expenses: DataService['expenses'] = {
    listUserReports: async (actorId) => {
      const db = await this.ready();
      await this.requireMember(db, actorId);
      const reports = await db.getAllAsync<ExpenseReport>(
        'SELECT * FROM [ExpenseReport] WHERE [SubmitterMemberID] = ? ORDER BY [id] DESC',
        [actorId],
      );
      return this.expenseDetails(db, reports);
    },

    listCouncilQueue: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayAuditCouncilExpenses(await this.memberWriteActor(db, actorId), councilId, `review the expense queue of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      const reports = await db.getAllAsync<ExpenseReport>(
        `SELECT * FROM [ExpenseReport] WHERE [CouncilID] = ? AND [Status] IN (${marks(EXPENSE_QUEUE_STATUSES.length)}) ORDER BY [id]`,
        [councilId, ...EXPENSE_QUEUE_STATUSES],
      );
      return this.expenseDetails(db, reports);
    },

    listAssetsInventory: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayAuditCouncilExpenses(await this.memberWriteActor(db, actorId), councilId, `read the assets inventory of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return db.getAllAsync<CouncilAssetsInventory>(
        'SELECT * FROM [CouncilAssetsInventory] WHERE [council_id] = ? ORDER BY [purchase_date] DESC, [id] DESC',
        [councilId],
      );
    },

    listAuthorizationQueue: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayReadAuthorizationDesk(await this.memberWriteActor(db, actorId), councilId, `read the authorization desk of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      const reports = await db.getAllAsync<ExpenseReport>(
        `SELECT * FROM [ExpenseReport]
          WHERE [CouncilID] = ? AND [Status] = 'Submitted' AND [FinancialSecretaryMemberID] IS NOT NULL AND [GrandKnightMemberID] IS NULL
          ORDER BY [id]`,
        [councilId],
      );
      return this.expenseDetails(db, reports);
    },

    submitReport: async (actorId, report, lineItems) => {
      const clean = cleanExpenseReportInput(report);
      const items = cleanExpenseLineItems(lineItems, clean.Status, this.now());
      const db = await this.ready();
      let reportId = clean.id ?? 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const draft = clean.id === null ? null : await this.requireOwnExpenseReport(db, clean.id, actorId);
        if (draft) assertExpenseStatus(draft, 'Draft', 'be edited');
        const councilId = draft ? draft.CouncilID : actor.councilId;
        const eventId = clean.LinkedEventID;
        const eventExists = eventId !== null && (await db.getFirstAsync('SELECT [id] FROM [Event] WHERE [id] = ?', [eventId])) !== null;
        assertExpenseLinks(
          clean,
          councilId,
          eventExists ? await this.councilIdsOf(db, eventId!) : null,
          clean.LinkedMeetingID === null
            ? null
            : await db.getFirstAsync<Meeting>('SELECT [CouncilID] FROM [Meeting] WHERE [id] = ?', [clean.LinkedMeetingID]),
        );
        const linkedEvent = eventId === null ? null : await db.getFirstAsync<Event>('SELECT [id], [StartDate], [EndDate] FROM [Event] WHERE [id] = ?', [eventId]);
        const linkedMeeting =
          clean.LinkedMeetingID === null
            ? null
            : await db.getFirstAsync<Meeting>('SELECT [id], [Date], [IsMultiDay], [EndDate] FROM [Meeting] WHERE [id] = ?', [clean.LinkedMeetingID]);
        assertExpenseSubmissionWindow(
          clean.Status,
          [...(linkedEvent ? [eventExpenseSpan(linkedEvent)] : []), ...(linkedMeeting ? [meetingExpenseSpan(linkedMeeting)] : [])],
          this.now(),
        );
        // The workflow engine decides the stored Status: a new sheet starts as Draft, and only a Draft is saved or submitted.
        const status = nextExpenseStatus(draft?.Status ?? null, clean.Status === 'Submitted' ? 'submit' : 'saveDraft', clean.id);
        const fields: Bind[] = [status, clean.LinkedEventID, clean.LinkedMeetingID, clean.is_long_term_asset];
        if (draft) {
          // Resubmitting answers the rejection, so its reason goes; a draft keeps it for the member to read.
          await db.runAsync(
            `UPDATE [ExpenseReport] SET [Status] = ?, [LinkedEventID] = ?, [LinkedMeetingID] = ?, [is_long_term_asset] = ?,
                    [RejectionReason] = CASE WHEN ? = 'Submitted' THEN NULL ELSE [RejectionReason] END
              WHERE [id] = ?`,
            [...fields, status, draft.id],
          );
          await db.runAsync('DELETE FROM [ExpenseLineItem] WHERE [ExpenseReportID] = ?', [draft.id]);
        } else {
          const res = await db.runAsync(
            `INSERT INTO [ExpenseReport] ([Status], [LinkedEventID], [LinkedMeetingID], [is_long_term_asset], [CouncilID], [SubmitterMemberID])
             VALUES (?, ?, ?, ?, ?, ?)`,
            [...fields, councilId, actorId],
          );
          reportId = res.lastInsertRowId;
        }
        for (const item of items) {
          await db.runAsync(
            `INSERT INTO [ExpenseLineItem] ([ExpenseReportID], [DateOfExpense], [Amount], [VendorName], [ReceiptPhotoURL], [ExpenseDescription])
             VALUES (?, ?, ?, ?, ?, ?)`,
            [reportId, item.DateOfExpense, item.Amount, item.VendorName, item.ReceiptPhotoURL ?? null, item.ExpenseDescription],
          );
        }
      });
      return (await this.expenseDetails(db, [await this.requireExpenseReport(db, reportId)]))[0];
    },

    rejectReport: async (actorId, reportId, rejectionReason) => {
      const reason = cleanRejectionReason(rejectionReason);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireExpenseReport(db, reportId);
        assertMayAuditCouncilExpenses(actor, row.CouncilID, `return expense report ${reportId}`);
        assertExpenseStatus(row, 'Submitted', 'be returned to its submitter');
        // A returned sheet starts its dual approval again (Sprint 5Z-3).
        await db.runAsync(
          `UPDATE [ExpenseReport] SET [Status] = ?, [RejectionReason] = ?,
                  [FinancialSecretaryMemberID] = NULL, [FinancialSecretaryApprovedAt] = NULL,
                  [GrandKnightMemberID] = NULL, [GrandKnightApprovedAt] = NULL
            WHERE [id] = ?`,
          [nextExpenseStatus(row.Status, 'return', reportId), reason, reportId],
        );
      });
      return (await this.expenseDetails(db, [await this.requireExpenseReport(db, reportId)]))[0];
    },

    financialSecretaryAuditOrder: async (actorId, reportId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireExpenseReport(db, reportId);
        assertMayIssueExpenseOrder(actor, row.CouncilID, `issue the written order for expense report ${reportId}`);
        assertNotSelfApproval(actor, row);
        assertExpenseSignatureStage(row, 'financialSecretary');
        await db.runAsync('UPDATE [ExpenseReport] SET [FinancialSecretaryMemberID] = ?, [FinancialSecretaryApprovedAt] = ? WHERE [id] = ?', [
          actorId,
          toTimestamp(this.now()),
          reportId,
        ]);
      });
      return (await this.expenseDetails(db, [await this.requireExpenseReport(db, reportId)]))[0];
    },

    grandKnightAuthorizeOrder: async (actorId, reportId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireExpenseReport(db, reportId);
        assertMayAuthorizeExpenseOrder(actor, row.CouncilID, `counter-sign expense report ${reportId}`);
        assertNotSelfApproval(actor, row);
        assertExpenseSignatureStage(row, 'grandKnight');
        assertDistinctExpenseSigners(actor, row);
        await db.runAsync(
          'UPDATE [ExpenseReport] SET [Status] = ?, [GrandKnightMemberID] = ?, [GrandKnightApprovedAt] = ? WHERE [id] = ?',
          [nextExpenseStatus(row.Status, 'approve', reportId), actorId, toTimestamp(this.now()), reportId],
        );
        await this.convertExpenseToAsset(db, reportId, row.Status);
      });
      return (await this.expenseDetails(db, [await this.requireExpenseReport(db, reportId)]))[0];
    },

    recordDisbursement: async (actorId, councilId, reportIds, checkDetails) => {
      const ids = cleanExpenseReportIds(reportIds);
      const check = cleanDisbursementCheck(checkDetails);
      const db = await this.ready();
      let disbursementId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        assertMayDisburseCouncilExpenses(actor, councilId, `record expense checks for council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        const paidStatus = new Map<number, string>();
        const priorStatus = new Map<number, string>();
        for (const id of ids) {
          const row = await this.requireExpenseReport(db, id);
          assertReportInCouncil(row, councilId);
          assertExpenseStatus(row, 'Approved', 'be paid');
          assertDualSigned(row);
          assertNoSelfPayout(actor, row);
          paidStatus.set(id, nextExpenseStatus(row.Status, 'reimburse', id));
          priorStatus.set(id, row.Status);
        }
        assertCheckNumberUnused(check.CheckNumber, councilId, await this.councilCheckNumbers(db, councilId));
        const amounts = await selectIn<{ Amount: number }>(
          db,
          (m) => `SELECT [Amount] FROM [ExpenseLineItem] WHERE [ExpenseReportID] IN (${m})`,
          ids,
        );
        const res = await db.runAsync(
          'INSERT INTO [ExpenseDisbursement] ([CouncilID], [CheckNumber], [PayoutDate], [TotalAmount], [Notes]) VALUES (?, ?, ?, ?, ?)',
          [councilId, check.CheckNumber, check.PayoutDate, sumAmounts(amounts.map((a) => a.Amount)), check.Notes],
        );
        disbursementId = res.lastInsertRowId;
        for (const id of ids) {
          await db.runAsync('UPDATE [ExpenseReport] SET [Status] = ?, [DisbursementID] = ? WHERE [id] = ?', [paidStatus.get(id)!, disbursementId, id]);
          await this.convertExpenseToAsset(db, id, priorStatus.get(id));
        }
      });
      const disbursement = (await db.getFirstAsync<ExpenseDisbursement>('SELECT * FROM [ExpenseDisbursement] WHERE [id] = ?', [
        disbursementId,
      ]))!;
      const reports: ExpenseReport[] = [];
      for (const id of ids) reports.push(await this.requireExpenseReport(db, id));
      return { disbursement, reports: await this.expenseDetails(db, reports) };
    },
  };

  private async requireExpenseReport(db: SQLite.SQLiteDatabase, reportId: number): Promise<ExpenseReport> {
    const row = await db.getFirstAsync<ExpenseReport>('SELECT * FROM [ExpenseReport] WHERE [id] = ?', [reportId]);
    if (!row) throw expenseReportNotFound(reportId);
    return row;
  }

  /** A member reaches only their own sheets; anyone else's reads as missing, so ids reveal nothing. */
  private async requireOwnExpenseReport(db: SQLite.SQLiteDatabase, reportId: number, memberId: number): Promise<ExpenseReport> {
    const row = await db.getFirstAsync<ExpenseReport>('SELECT * FROM [ExpenseReport] WHERE [id] = ? AND [SubmitterMemberID] = ?', [
      reportId,
      memberId,
    ]);
    if (!row) throw expenseReportNotFound(reportId);
    return row;
  }

  private async expenseDetails(db: SQLite.SQLiteDatabase, reports: readonly ExpenseReport[]): Promise<ExpenseReportDetail[]> {
    const reportIds = reports.map((r) => r.id);
    // Submitters and both signers (Sprint 5Z-4), for the names the desks show.
    const memberIds = [
      ...new Set(
        reports.flatMap((r) => [r.SubmitterMemberID, r.FinancialSecretaryMemberID, r.GrandKnightMemberID]).filter((id): id is number => id != null),
      ),
    ];
    const disbursementIds = [...new Set(reports.map((r) => r.DisbursementID).filter((id): id is number => id != null))];
    const [lineItems, members, disbursements] = await Promise.all([
      selectIn<ExpenseLineItem>(db, (m) => `SELECT * FROM [ExpenseLineItem] WHERE [ExpenseReportID] IN (${m})`, reportIds),
      selectIn<Member>(db, (m) => `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member] WHERE [id] IN (${m})`, memberIds),
      selectIn<ExpenseDisbursement>(db, (m) => `SELECT * FROM [ExpenseDisbursement] WHERE [id] IN (${m})`, disbursementIds),
    ]);
    return buildExpenseReportDetails(reports, lineItems, members, disbursements);
  }

  // ---- events, shifts and time logs -------------------------------------

  events: DataService['events'] = {
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<CouncilEvent>('SELECT * FROM [Event] WHERE [id] = ?', [id])) ?? null;
    },

    getShift: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Shift>('SELECT * FROM [Shift] WHERE [id] = ?', [id])) ?? null;
    },

    listShiftsBetween: async (fromDate, toDate) => {
      const db = await this.ready();
      return db.getAllAsync<Shift>(
        'SELECT * FROM [Shift] WHERE [ShiftDate] BETWEEN ? AND ? ORDER BY [ShiftDate], [StartTime], [id]',
        [fromDate, toDate],
      );
    },

    listSignups: async (shiftId) => {
      const db = await this.ready();
      return db.getAllAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [ShiftID] = ? ORDER BY [id]', [shiftId]);
    },

    signupForShift: async (memberId, shiftId) => {
      const db = await this.ready();
      let signupId = 0;
      await db.withTransactionAsync(async () => {
        const shift = await this.requireShift(db, shiftId);
        await this.requireMember(db, memberId);
        const dup = await db.getFirstAsync<{ id: number }>(
          'SELECT [id] FROM [EventSignup] WHERE [ShiftID] = ? AND [MemberID] = ?',
          [shiftId, memberId],
        );
        if (dup) {
          throw new BusinessRuleError(
            'ALREADY_SIGNED_UP',
            `Member ${memberId} is already signed up for shift "${shift.ShiftName}" (id ${shiftId}).`,
            { memberId, shiftId },
          );
        }
        // A full shift still takes honorary volunteers (Sprint 5Z-Final-Polish), so there is no cap check.
        await db.runAsync('UPDATE [Shift] SET [NumberVolunteersSignedUp] = [NumberVolunteersSignedUp] + 1 WHERE [id] = ?', [shiftId]);
        const ins = await db.runAsync('INSERT INTO [EventSignup] ([ShiftID], [MemberID], [NoShow]) VALUES (?, ?, 0)', [
          shiftId,
          memberId,
        ]);
        signupId = ins.lastInsertRowId;
      });
      return (await db.getFirstAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [id] = ?', [signupId]))!;
    },

    listMemberShifts: async (memberId, range) => {
      const db = await this.ready();
      const shifts = await db.getAllAsync<Shift>(
        `SELECT s.* FROM [Shift] s
          WHERE s.[ShiftDate] BETWEEN ? AND ?
            AND EXISTS (SELECT 1 FROM [EventSignup] es WHERE es.[ShiftID] = s.[id] AND es.[MemberID] = ?)
          ORDER BY s.[ShiftDate], s.[StartTime], s.[id]`,
        [range?.fromDate ?? '0000-01-01', range?.toDate ?? '9999-12-31', memberId],
      );
      if (shifts.length === 0) return [];
      const signups = new Map(
        (await db.getAllAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [MemberID] = ?', [memberId])).map((e) => [
          e.ShiftID,
          e,
        ]),
      );
      const events = new Map(
        (
          await selectIn<CouncilEvent>(
            db,
            (m) => `SELECT * FROM [Event] WHERE [id] IN (${m})`,
            [...new Set(shifts.map((s) => s.EventID))],
          )
        ).map((e) => [e.id, e]),
      );
      const hours = new Map(
        (
          await db.getAllAsync<{ ShiftID: number; Hours: number }>(
            'SELECT [ShiftID], [Hours] FROM [EventTime] WHERE [MemberID] = ?',
            [memberId],
          )
        ).map((t) => [t.ShiftID, t.Hours]),
      );
      const out: MemberShift[] = [];
      for (const shift of shifts) {
        const signup = signups.get(shift.id);
        const event = events.get(shift.EventID);
        if (signup && event) out.push({ signup, shift, event, hoursLogged: hours.get(shift.id) ?? null });
      }
      return out;
    },

    listShiftFeed: async ({ memberId, councilIds, fromDate, toDate }) => {
      if (councilIds.length === 0) return [];
      const db = await this.ready();
      const shifts = await db.getAllAsync<Shift>(
        `SELECT s.* FROM [Shift] s
          WHERE s.[ShiftDate] BETWEEN ? AND ?
            AND s.[EventID] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] IN (${marks(councilIds.length)}))
          ORDER BY s.[ShiftDate], s.[StartTime], s.[id]`,
        [fromDate, toDate, ...councilIds],
      );
      if (shifts.length === 0) return [];
      const eventIds = [...new Set(shifts.map((s) => s.EventID))];
      const events = new Map(
        (await selectIn<CouncilEvent>(db, (m) => `SELECT * FROM [Event] WHERE [id] IN (${m})`, eventIds)).map((e) => [e.id, e]),
      );
      const links = await selectIn<{ EventID: number; CouncilID: number }>(
        db,
        (m) => `SELECT [EventID], [CouncilID] FROM [EventCouncils] WHERE [EventID] IN (${m}) ORDER BY [CouncilID]`,
        eventIds,
      );
      const mine = new Set(
        (await db.getAllAsync<{ ShiftID: number }>('SELECT [ShiftID] FROM [EventSignup] WHERE [MemberID] = ?', [memberId])).map(
          (r) => r.ShiftID,
        ),
      );
      const out: ShiftFeedItem[] = [];
      for (const shift of shifts) {
        const event = events.get(shift.EventID);
        if (!event) continue;
        out.push({
          shift,
          event,
          councilIds: links.filter((l) => l.EventID === shift.EventID).map((l) => l.CouncilID),
          isSignedUp: mine.has(shift.id),
        });
      }
      return out;
    },

    countNoShows: async (memberId, sinceDate) => {
      const db = await this.ready();
      const row = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM [EventSignup] es JOIN [Shift] s ON s.[id] = es.[ShiftID]
          WHERE es.[MemberID] = ? AND es.[NoShow] = 1 AND s.[ShiftDate] >= ?`,
        [memberId, sinceDate],
      );
      return row?.n ?? 0;
    },

    setNoShow: async (actorId, signupId, noShow, reasonId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const signup = await db.getFirstAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [id] = ?', [signupId]);
        if (!signup) throw signupNotFound(signupId);
        const shift = await this.requireShift(db, signup.ShiftID);
        const target = {
          signupId,
          memberId: signup.MemberID,
          eventId: shift.EventID,
          eventCouncilIds: await this.councilIdsOf(db, shift.EventID),
        };
        assertMayMarkNoShow(actor, target, noShow);
        const reasons = await db.getAllAsync<{ id: number }>('SELECT [id] FROM [NoShowReason]');
        const reason = noShowReasonFor(noShow, reasonId, reasons.map((r) => r.id));
        if (noShow) {
          const time = await db.getFirstAsync<{ Hours: number }>('SELECT [Hours] FROM [EventTime] WHERE [ShiftID] = ? AND [MemberID] = ?', [
            shift.id,
            signup.MemberID,
          ]);
          assertNoShowWithoutHours(target, time ? time.Hours : null);
        }
        await db.runAsync('UPDATE [EventSignup] SET [NoShow] = ?, [NoShowReasonID] = ? WHERE [id] = ?', [noShow ? 1 : 0, reason, signupId]);
      });
      return (await db.getFirstAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [id] = ?', [signupId]))!;
    },

    listCalendarRange: async (councilId, startDate, endDate, options) => {
      const range = cleanCalendarRange(startDate, endDate);
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      // A standard member's calendar drops what has already happened: WHERE EndDate >= today (local).
      const today = toIsoDate(this.now());
      const hideEnded = options?.hideEnded === true;
      const events = await db.getAllAsync<CouncilEvent>(
        `SELECT * FROM [Event] WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)
            AND [StartDate] <= ? AND [EndDate] >= ?${hideEnded ? ' AND [EndDate] >= ?' : ''}`,
        hideEnded ? [councilId, range.endDate, range.startDate, today] : [councilId, range.endDate, range.startDate],
      );
      const meetings = await db.getAllAsync<Meeting>(
        // A multi-day meeting overlaps the range through its EndDate.
        `SELECT * FROM [Meeting] WHERE [CouncilID] = ? AND [Date] <= ? AND COALESCE([EndDate], [Date]) >= ?${hideEnded ? ' AND COALESCE([EndDate], [Date]) >= ?' : ''}`,
        hideEnded ? [councilId, range.endDate, range.startDate, today] : [councilId, range.endDate, range.startDate],
      );
      return buildCalendarEntries(range, events, meetings);
    },

    uploadPhotos: async (actorId, eventId, photoPaths) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const event = await this.requireEvent(db, eventId);
        assertMayAttachEventMedia(actor, event, await this.councilIdsOf(db, eventId), `add photos to event ${eventId}`);
        const gallery = appendPhotoPaths(event.PhotoGalleryURL, photoPaths);
        await db.runAsync('UPDATE [Event] SET [PhotoGalleryURL] = ? WHERE [id] = ?', [gallery, eventId]);
      });
      return this.requireEvent(db, eventId);
    },

    setFlyerFile: async (actorId, eventId, fileId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const event = await this.requireEvent(db, eventId);
        assertMayAttachEventMedia(actor, event, await this.councilIdsOf(db, eventId), `file a flyer for event ${eventId}`);
        await db.runAsync('UPDATE [Event] SET [GoogleDriveFlyerFileID] = ? WHERE [id] = ?', [cleanFlyerFileId(fileId), eventId]);
      });
      return this.requireEvent(db, eventId);
    },

    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<CouncilEvent>(
        `SELECT * FROM [Event] WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)
          ORDER BY [StartDate] DESC, [id] DESC`,
        [councilId],
      );
    },

    listShifts: async (eventId) => {
      const db = await this.ready();
      return db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ? ORDER BY [ShiftDate], [StartTime], [id]', [
        eventId,
      ]);
    },

    listTurnout: async (eventId) => {
      const db = await this.ready();
      const rows = await db.getAllAsync<{ SignupID: number; MemberFirstName: string; MemberLastName: string; DateJoinedCouncil: string | null; Hours: number | null }>(
        `SELECT es.[id] AS SignupID, m.[MemberFirstName], m.[MemberLastName], m.[DateJoinedCouncil], et.[Hours]
           FROM [EventSignup] es
           JOIN [Shift] s ON s.[id] = es.[ShiftID]
           JOIN [Member] m ON m.[id] = es.[MemberID]
           LEFT JOIN [EventTime] et ON et.[ShiftID] = es.[ShiftID] AND et.[MemberID] = es.[MemberID]
          WHERE s.[EventID] = ?
          ORDER BY s.[ShiftDate], s.[StartTime], s.[id], m.[MemberLastName], m.[MemberFirstName], es.[id]`,
        [eventId],
      );
      if (rows.length === 0) return [];
      const shifts = new Map(
        (await db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ?', [eventId])).map((s) => [s.id, s]),
      );
      const signups = new Map(
        (
          await selectIn<EventSignup>(
            db,
            (m) => `SELECT * FROM [EventSignup] WHERE [id] IN (${m})`,
            rows.map((r) => r.SignupID),
          )
        ).map((e) => [e.id, e]),
      );
      const out: VolunteerTurnout[] = [];
      for (const row of rows) {
        const signup = signups.get(row.SignupID);
        const shift = signup && shifts.get(signup.ShiftID);
        if (!signup || !shift) continue;
        out.push({
          signup,
          shift,
          MemberFirstName: row.MemberFirstName,
          MemberLastName: row.MemberLastName,
          DateJoinedCouncil: row.DateJoinedCouncil ?? null,
          hoursLogged: row.Hours ?? null,
        });
      }
      return out;
    },

    listCouncilIds: async (eventId) => {
      const db = await this.ready();
      return this.councilIdsOf(db, eventId);
    },

    create: async (event, councilIds) => {
      const clean = cleanNewEvent(event);
      assertEventRange(clean.StartDate, clean.EndDate);
      const ids = cleanCouncilIds(councilIds);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        id = await this.insertEventRow(db, clean, ids);
      });
      return this.requireEvent(db, id);
    },

    update: async (id, changes: EventChanges) => {
      const clean = cleanEventFields(changes);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireEvent(db, id);
        assertFundsEditable(row, clean, await this.eventFunds(db, id));
        assertEventRange(clean.StartDate ?? row.StartDate, clean.EndDate ?? row.EndDate);
        await this.assertOwnerAndCategory(db, clean);
        if (clean.StartDate !== undefined || clean.EndDate !== undefined) {
          const merged = { ...row, ...clean } as unknown as CouncilEvent;
          for (const sh of await db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ?', [id])) {
            assertShiftInsideEvent(sh.ShiftDate, merged);
          }
        }
        const cols = EVENT_COLUMNS.filter((c) => clean[c] !== undefined);
        if (cols.length > 0) {
          await db.runAsync(`UPDATE [Event] SET ${cols.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...cols.map((c) => clean[c] as Bind),
            id,
          ]);
        }
      });
      return this.requireEvent(db, id);
    },

    setCouncils: async (eventId, councilIds) => {
      const ids = cleanCouncilIds(councilIds);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        await this.requireEvent(db, eventId);
        await this.assertCouncilsExist(db, ids);
        await db.runAsync('DELETE FROM [EventCouncils] WHERE [EventID] = ?', [eventId]);
        for (const councilId of ids) {
          await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [eventId, councilId]);
        }
      });
    },

    copy: async (eventId, options) => {
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        const original = await this.requireEvent(db, eventId);
        const shifts = await db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ? ORDER BY [ShiftDate], [id]', [
          eventId,
        ]);
        const plan = planEventCopy(original, shifts, options);
        id = await this.insertEventRow(db, cleanNewEvent(plan.event), await this.councilIdsOf(db, eventId));
        for (const shift of plan.shifts) await this.insertShiftRow(db, id, shift);
      });
      return this.requireEvent(db, id);
    },

    createShift: async (shift) => {
      const clean = cleanNewShift(shift);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        assertShiftInsideEvent(clean.ShiftDate, await this.requireEvent(db, clean.EventID));
        id = await this.insertShiftRow(db, clean.EventID, clean);
      });
      return this.requireShift(db, id);
    },

    updateShift: async (id, changes: ShiftChanges) => {
      const clean = cleanShiftFields(changes);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireShift(db, id);
        // Phase 4.5: an All-Hands shift (as it stands or as changed) has no cap, so its target never blocks a change.
        const allHands = (clean.IsAllHands ?? row.IsAllHands) === 1;
        if (!allHands && clean.MinNumberVolunteers !== undefined && clean.MinNumberVolunteers < row.NumberVolunteersSignedUp) {
          throw new BusinessRuleError(
            'INVALID_INPUT',
            `Shift "${row.ShiftName}" already has ${row.NumberVolunteersSignedUp} volunteers signed up, so the volunteer target cannot be lowered to ${clean.MinNumberVolunteers}.`,
            { shiftId: id, signedUp: row.NumberVolunteersSignedUp, requested: clean.MinNumberVolunteers },
          );
        }
        if (clean.ShiftDate !== undefined) assertShiftInsideEvent(clean.ShiftDate, await this.requireEvent(db, row.EventID));
        const cols = SHIFT_COLUMNS.filter((c) => clean[c] !== undefined);
        if (cols.length > 0) {
          await db.runAsync(`UPDATE [Shift] SET ${cols.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...cols.map((c) => clean[c] as Bind),
            id,
          ]);
        }
      });
      return this.requireShift(db, id);
    },

    deleteShift: async (id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireShift(db, id);
        const found = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM [EventSignup] WHERE [ShiftID] = ?', [id]);
        const signups = found?.n ?? 0;
        if (signups > 0) {
          throw new BusinessRuleError(
            'SHIFT_HAS_SIGNUPS',
            `Shift "${row.ShiftName}" (id ${id}) has ${signups} volunteer${signups === 1 ? '' : 's'} signed up and cannot be deleted.`,
            { shiftId: id, signups },
          );
        }
        await db.runAsync('DELETE FROM [Shift] WHERE [id] = ?', [id]);
      });
    },

    setIntakeSessionStatus: async (actorId, eventId, status) => {
      const next = assertIntakeSessionStatus(status);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const event = await this.requireEvent(db, eventId);
        assertMayRunEventIntake(actor, eventId, await this.councilIdsOf(db, eventId));
        await db.runAsync('UPDATE [Event] SET [IntakeSessionStatus] = ? WHERE [id] = ?', [nextIntakeSessionStatus(event.IntakeSessionStatus, next, eventId), eventId]);
      });
      return (await this.requireEvent(db, eventId)) as unknown as Event;
    },
  };

  private async councilIdsOf(db: SQLite.SQLiteDatabase, eventId: number): Promise<number[]> {
    const rows = await db.getAllAsync<{ CouncilID: number }>(
      'SELECT [CouncilID] FROM [EventCouncils] WHERE [EventID] = ? ORDER BY [CouncilID]',
      [eventId],
    );
    return rows.map((r) => r.CouncilID);
  }

  private async requireEvent(db: SQLite.SQLiteDatabase, eventId: number): Promise<CouncilEvent> {
    const event = await db.getFirstAsync<CouncilEvent>('SELECT * FROM [Event] WHERE [id] = ?', [eventId]);
    if (!event) throw new BusinessRuleError('EVENT_NOT_FOUND', `No event with id ${eventId}.`, { eventId });
    return event;
  }

  private async assertCouncilsExist(db: SQLite.SQLiteDatabase, ids: readonly number[]): Promise<void> {
    for (const id of ids) {
      if (!(await db.getFirstAsync('SELECT [id] FROM [Council] WHERE [id] = ?', [id]))) {
        throw new BusinessRuleError('INVALID_INPUT', `No council with id ${id}.`, { councilId: id });
      }
    }
  }

  /** Sprint 6Z-Dual-Gate-Model: FRATERNAL_EXTENSION_REQUIRED unless the council is a Knights of Columbus council. */
  private async assertFraternalCouncil(db: SQLite.SQLiteDatabase, councilId: number, operation: string): Promise<void> {
    const council = await db.getFirstAsync<GateCouncil>('SELECT [id], [tenant_type] FROM [Council] WHERE [id] = ?', [councilId]);
    assertFraternalExtension(councilId, operation, council);
  }

  /** Friendly errors for the two foreign keys the generic constraint message would explain poorly. */
  private async assertOwnerAndCategory(db: SQLite.SQLiteDatabase, fields: EventChanges): Promise<void> {
    if (fields.OwnerID != null) await this.requireMember(db, fields.OwnerID);
    if (
      fields.CategoryID != null &&
      !(await db.getFirstAsync('SELECT [id] FROM [Category] WHERE [id] = ?', [fields.CategoryID]))
    ) {
      throw new BusinessRuleError('INVALID_INPUT', `No event category with id ${fields.CategoryID}.`, {
        categoryId: fields.CategoryID,
      });
    }
  }

  private async insertEventRow(db: SQLite.SQLiteDatabase, event: NewEvent, councilIds: readonly number[]): Promise<number> {
    await this.assertOwnerAndCategory(db, event);
    await this.assertCouncilsExist(db, councilIds);
    const cols = EVENT_COLUMNS.filter((c) => event[c] !== undefined);
    const res = await db.runAsync(
      `INSERT INTO [Event] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(cols.length)})`,
      cols.map((c) => event[c] as Bind),
    );
    for (const councilId of councilIds) {
      await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [res.lastInsertRowId, councilId]);
    }
    return res.lastInsertRowId;
  }

  private async insertShiftRow(
    db: SQLite.SQLiteDatabase,
    eventId: number,
    shift: Omit<Shift, 'id' | 'EventID' | 'NumberVolunteersSignedUp'>,
  ): Promise<number> {
    const res = await db.runAsync(
      `INSERT INTO [Shift] ([ShiftName], [ShiftDescription], [ShiftDate], [StartTime], [EndTime], [EventID],
                            [MinNumberVolunteers], [NumberVolunteersSignedUp], [IsAllHands])
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [shift.ShiftName, shift.ShiftDescription ?? '', shift.ShiftDate, shift.StartTime, shift.EndTime, eventId, shift.MinNumberVolunteers, shift.IsAllHands ?? 0],
    );
    return res.lastInsertRowId;
  }

  lessonsLearned: DataService['lessonsLearned'] = {
    list: async (eventId) => {
      const db = await this.ready();
      return db.getAllAsync<LessonsLearned>('SELECT * FROM [LessonsLearned] WHERE [EventID] = ? ORDER BY [id]', [eventId]);
    },

    add: async (actorId, eventId, categoryId, description) => {
      const text = assertText(description, 'Lesson learned', 255);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const event = await this.requireEvent(db, eventId);
        assertMayChangeLesson(actor, event, await this.councilIdsOf(db, eventId), `add lessons to event ${eventId}`);
        if (!(await db.getFirstAsync('SELECT [id] FROM [LessonsLearnedCategory] WHERE [id] = ?', [categoryId]))) {
          throw new BusinessRuleError('INVALID_INPUT', `No lessons-learned category with id ${categoryId}.`, { categoryId });
        }
        const res = await db.runAsync(
          `INSERT INTO [LessonsLearned] ([EventID], [LeassonsLearnedCategoryID], [LessonsLearnedDescription]) VALUES (?, ?, ?)`,
          [eventId, categoryId, text],
        );
        id = res.lastInsertRowId;
      });
      return (await db.getFirstAsync<LessonsLearned>('SELECT * FROM [LessonsLearned] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const lesson = await db.getFirstAsync<LessonsLearned>('SELECT * FROM [LessonsLearned] WHERE [id] = ?', [id]);
        if (!lesson) throw new BusinessRuleError('INVALID_INPUT', `No lesson learned with id ${id}.`, { id });
        const event = await this.requireEvent(db, lesson.EventID);
        assertMayChangeLesson(actor, event, await this.councilIdsOf(db, event.id), `remove lesson ${id}`);
        await db.runAsync('DELETE FROM [LessonsLearned] WHERE [id] = ?', [id]);
      });
    },

    listGlobalRegistry: async (actorId, filters) => {
      const clean = cleanLessonsRegistryFilters(filters);
      const db = await this.ready();
      const actor = await this.memberWriteActor(db, actorId);
      assertMayReadLessonsRegistry(actor);
      const lessonEvents = 'SELECT [EventID] FROM [LessonsLearned]';
      return buildLessonsRegistry(actor, clean, {
        lessons: await db.getAllAsync<LessonsLearned>('SELECT * FROM [LessonsLearned]'),
        events: await db.getAllAsync<CouncilEvent>(
          `SELECT [id], [EventName], [StartDate], [CategoryID], [OwnerID] FROM [Event] WHERE [id] IN (${lessonEvents})`,
        ),
        eventCouncils: await db.getAllAsync<{ EventID: number; CouncilID: number }>(
          `SELECT [EventID], [CouncilID] FROM [EventCouncils] WHERE [EventID] IN (${lessonEvents})`,
        ),
        councils: await db.getAllAsync<Council>('SELECT [id], [CouncilNumber], [CouncilName] FROM [Council]'),
        categories: await db.getAllAsync<Category>('SELECT * FROM [Category]'),
        lessonCategories: await db.getAllAsync<LessonsLearnedCategory>('SELECT * FROM [LessonsLearnedCategory]'),
      });
    },
  };

  eventTime: DataService['eventTime'] = {
    logHours: async (memberId, shiftId, hours, notes) => {
      assertValidHours(hours);
      const db = await this.ready();
      let timeId = 0;
      await db.withTransactionAsync(async () => {
        const shift = await this.requireShift(db, shiftId);
        await this.requireMember(db, memberId);
        assertShiftReportAllowed(shift.ShiftDate, this.now(), shiftId);
        const signup = await db.getFirstAsync<{ id: number }>(
          'SELECT [id] FROM [EventSignup] WHERE [ShiftID] = ? AND [MemberID] = ?',
          [shiftId, memberId],
        );
        if (!signup) {
          throw new BusinessRuleError(
            'NOT_SIGNED_UP',
            `Member ${memberId} never signed up for shift "${shift.ShiftName}" (id ${shiftId}), so no time can be logged against it.`,
            { memberId, shiftId },
          );
        }
        const existing = await db.getFirstAsync<{ id: number }>(
          'SELECT [id] FROM [EventTime] WHERE [ShiftID] = ? AND [MemberID] = ?',
          [shiftId, memberId],
        );
        if (existing) {
          await db.runAsync('UPDATE [EventTime] SET [Hours] = ?, [ShiftNotes] = ? WHERE [id] = ?', [
            hours,
            notes ?? null,
            existing.id,
          ]);
          timeId = existing.id;
        } else {
          const ins = await db.runAsync(
            'INSERT INTO [EventTime] ([ShiftID], [MemberID], [Hours], [ShiftNotes]) VALUES (?, ?, ?, ?)',
            [shiftId, memberId, hours, notes ?? null],
          );
          timeId = ins.lastInsertRowId;
        }
      });
      return (await db.getFirstAsync<EventTime>('SELECT * FROM [EventTime] WHERE [id] = ?', [timeId]))!;
    },
  };

  activityTime: DataService['activityTime'] = {
    logHours: async (memberId, activityId, hours, date, notes) => {
      assertValidHours(hours);
      assertActivityDateAllowed(date, this.now());
      const db = await this.ready();
      let timeId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, memberId);
        const activity = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Activities] WHERE [id] = ?', [
          activityId,
        ]);
        if (!activity) throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
        const ins = await db.runAsync(
          `INSERT INTO [ActivityTime] ([MemberID], [ActivityID], [ActivityDate], [Hours], [ActivityNotes])
           VALUES (?, ?, ?, ?, ?)`,
          [memberId, activityId, date, hours, notes ?? null],
        );
        timeId = ins.lastInsertRowId;
      });
      return (await db.getFirstAsync<ActivityTime>('SELECT * FROM [ActivityTime] WHERE [id] = ?', [timeId]))!;
    },

    addQuarterHour: async (memberId, activityId, date) => {
      assertActivityDateAllowed(date, this.now());
      const db = await this.ready();
      let timeId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, memberId);
        const activity = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Activities] WHERE [id] = ?', [
          activityId,
        ]);
        if (!activity) throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
        // The newest of the member's entries for the activity that day grows; there is normally just one.
        const entry = await db.getFirstAsync<{ id: number; Hours: number }>(
          `SELECT [id], [Hours] FROM [ActivityTime]
            WHERE [MemberID] = ? AND [ActivityID] = ? AND [ActivityDate] = ?
            ORDER BY [id] DESC LIMIT 1`,
          [memberId, activityId, date],
        );
        if (entry) {
          await db.runAsync('UPDATE [ActivityTime] SET [Hours] = ? WHERE [id] = ?', [nextQuarterHourTotal(entry.Hours), entry.id]);
          timeId = entry.id;
        } else {
          const ins = await db.runAsync(
            'INSERT INTO [ActivityTime] ([MemberID], [ActivityID], [ActivityDate], [Hours]) VALUES (?, ?, ?, ?)',
            [memberId, activityId, date, nextQuarterHourTotal(null)],
          );
          timeId = ins.lastInsertRowId;
        }
      });
      return (await db.getFirstAsync<ActivityTime>('SELECT * FROM [ActivityTime] WHERE [id] = ?', [timeId]))!;
    },

    listByActivity: async (activityId) => {
      const db = await this.ready();
      const activity = await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [activityId]);
      if (!activity) throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
      const times = await db.getAllAsync<ActivityTime>('SELECT * FROM [ActivityTime] WHERE [ActivityID] = ?', [activityId]);
      const members = await db.getAllAsync<{ id: number; MemberFirstName: string; MemberLastName: string }>(
        `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member]
          WHERE [id] IN (SELECT [MemberID] FROM [ActivityTime] WHERE [ActivityID] = ?)`,
        [activityId],
      );
      return buildActivityTimeLog(activity, times, new Map(members.map((m) => [m.id, m])));
    },
  };

  reports: DataService['reports'] = {
    monthlySummary: async (councilId, year, month) => {
      const { fromDate, toDate } = monthBounds(year, month);
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      const councilEvents = 'SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?';
      return summarizeMonth(councilId, year, month, {
        events: await db.getAllAsync<CouncilEvent>(
          `SELECT * FROM [Event] WHERE [id] IN (${councilEvents}) AND [StartDate] BETWEEN ? AND ?`,
          [councilId, fromDate, toDate],
        ),
        eventTime: await db.getAllAsync<{ MemberID: number; Hours: number }>(
          `SELECT t.[MemberID], t.[Hours] FROM [EventTime] t
             JOIN [Shift] sh ON sh.[id] = t.[ShiftID]
            WHERE sh.[EventID] IN (${councilEvents}) AND sh.[ShiftDate] BETWEEN ? AND ?`,
          [councilId, fromDate, toDate],
        ),
        activityTime: await db.getAllAsync<{ MemberID: number; Hours: number }>(
          `SELECT t.[MemberID], t.[Hours] FROM [ActivityTime] t
             JOIN [Activities] a ON a.[id] = t.[ActivityID]
            WHERE a.[CouncilID] = ? AND t.[ActivityDate] BETWEEN ? AND ?`,
          [councilId, fromDate, toDate],
        ),
        expenseItems: await db.getAllAsync<{ Amount: number }>(
          `SELECT li.[Amount] FROM [ExpenseLineItem] li
             JOIN [ExpenseReport] r ON r.[id] = li.[ExpenseReportID]
            WHERE r.[CouncilID] = ? AND r.[Status] IN (${marks(EXPENSE_SPEND_STATUSES.length)})
              AND li.[DateOfExpense] BETWEEN ? AND ?`,
          [councilId, ...EXPENSE_SPEND_STATUSES, fromDate, toDate],
        ),
        charitableGifts: await db.getAllAsync<{ Amount: number }>(
          'SELECT [Amount] FROM [CharitableDisbursementLedger] WHERE [CouncilID] = ? AND [PayoutDate] BETWEEN ? AND ?',
          [councilId, fromDate, toDate],
        ),
      });
    },

    missionAreaFootprint: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const db = await this.ready();
      assertMayReviewBudgetPerformance(await this.memberWriteActor(db, actorId), councilId, `read the mission footprint of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      const councilEvents = 'SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?';
      return buildMissionAreaFootprint(
        councilId,
        year,
        await db.getAllAsync<CouncilMissionArea>('SELECT * FROM [CouncilMissionArea] WHERE [CouncilID] = ?', [councilId]),
        await db.getAllAsync<{ id: number; StartDate: string; MissionAreaID: number | null }>(
          `SELECT [id], [StartDate], [MissionAreaID] FROM [Event] WHERE [id] IN (${councilEvents})`,
          [councilId],
        ),
        await db.getAllAsync<{ EventID: number | null; DonationDate: string; DonationAmount: number; methodName: string }>(
          `SELECT d.[EventID], d.[DonationDate], d.[DonationAmount], COALESCE(m.[DonationMethod], '') AS methodName FROM [Donation] d
             LEFT JOIN [DonationMethod] m ON m.[id] = d.[DonationMethodID]
            WHERE d.[CouncilID] = ?`,
          [councilId],
        ),
        await db.getAllAsync<{ Hours: number; eventId: number; shiftDate: string }>(
          `SELECT t.[Hours], sh.[EventID] AS eventId, sh.[ShiftDate] AS shiftDate FROM [EventTime] t
             JOIN [Shift] sh ON sh.[id] = t.[ShiftID]
            WHERE sh.[EventID] IN (${councilEvents})`,
          [councilId],
        ),
      );
    },

    listNoShowsAudit: async (councilId, dateThreshold) => {
      const threshold = noShowAuditThreshold(dateThreshold, this.now());
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      // LEFT JOIN, like view_NoShows: a no-show without a recorded reason is still audited.
      const found = await db.getAllAsync<{
        signupId: number;
        reasonId: number | null;
        code: NoShowReason['NoShowReasonCode'] | null;
        description: string | null;
      }>(
        `SELECT su.[id] AS signupId, r.[id] AS reasonId, r.[NoShowReasonCode] AS code, r.[NoShowReasonDescription] AS description
           FROM [EventSignup] su
           JOIN [Shift] sh ON sh.[id] = su.[ShiftID]
           JOIN [Member] m ON m.[id] = su.[MemberID]
           LEFT JOIN [NoShowReason] r ON r.[id] = su.[NoShowReasonID]
          WHERE su.[NoShow] = 1 AND m.[CouncilID] = ? AND sh.[ShiftDate] >= ?`,
        [councilId, threshold],
      );
      const context = await this.signupContexts(db, found.map((f) => f.signupId));
      return buildNoShowAudit(
        found.map((f) => ({
          ...context.get(f.signupId)!,
          reason: f.reasonId === null ? null : { id: f.reasonId, NoShowReasonCode: f.code!, NoShowReasonDescription: f.description! },
        })),
      );
    },

    listShiftsAwaitingHours: async (councilId) => {
      const now = this.now();
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      const found = await db.getAllAsync<{ signupId: number }>(
        `SELECT su.[id] AS signupId
           FROM [EventSignup] su
           JOIN [Shift] sh ON sh.[id] = su.[ShiftID]
          WHERE su.[NoShow] = 0 AND sh.[ShiftDate] < ?
            AND sh.[EventID] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)
            AND NOT EXISTS (SELECT 1 FROM [EventTime] t WHERE t.[ShiftID] = su.[ShiftID] AND t.[MemberID] = su.[MemberID])`,
        [toIsoDate(now), councilId],
      );
      const context = await this.signupContexts(db, found.map((f) => f.signupId));
      return buildShiftsAwaitingHours(found.map((f) => context.get(f.signupId)!), now);
    },
  };

  /** Each signup with its shift, event and member, keyed by signup id, for the audits. */
  private async signupContexts(db: SQLite.SQLiteDatabase, signupIds: readonly number[]): Promise<Map<number, SignupContextRow>> {
    const distinct = (ids: number[]) => [...new Set(ids)];
    const signups = await selectIn<EventSignup>(db, (m) => `SELECT * FROM [EventSignup] WHERE [id] IN (${m})`, signupIds);
    const shifts = new Map(
      (await selectIn<Shift>(db, (m) => `SELECT * FROM [Shift] WHERE [id] IN (${m})`, distinct(signups.map((s) => s.ShiftID)))).map((s) => [s.id, s]),
    );
    const events = new Map(
      (
        await selectIn<CouncilEvent>(db, (m) => `SELECT * FROM [Event] WHERE [id] IN (${m})`, distinct([...shifts.values()].map((s) => s.EventID)))
      ).map((e) => [e.id, e]),
    );
    const members = new Map(
      (
        await selectIn<SignupContextRow['member']>(
          db,
          (m) => `SELECT [id], [MemberNumber], [MemberFirstName], [MemberLastName], [Phone], [Email] FROM [Member] WHERE [id] IN (${m})`,
          distinct(signups.map((s) => s.MemberID)),
        )
      ).map((mb) => [mb.id, mb]),
    );
    return new Map(
      signups.map((signup) => {
        const shift = shifts.get(signup.ShiftID)!;
        return [signup.id, { signup, shift, event: events.get(shift.EventID)!, member: members.get(signup.MemberID)! }];
      }),
    );
  }

  private async requireShift(db: SQLite.SQLiteDatabase, shiftId: number): Promise<Shift> {
    const shift = await db.getFirstAsync<Shift>('SELECT * FROM [Shift] WHERE [id] = ?', [shiftId]);
    if (!shift) throw new BusinessRuleError('SHIFT_NOT_FOUND', `No shift with id ${shiftId}.`, { shiftId });
    return shift;
  }

  private async requireMember(db: SQLite.SQLiteDatabase, memberId: number): Promise<void> {
    const member = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Member] WHERE [id] = ?', [memberId]);
    if (!member) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${memberId}.`, { memberId });
  }

  // ---- meetings ----------------------------------------------------------

  meetings: DataService['meetings'] = {
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [id])) ?? null;
    },

    listUpcoming: async (councilId, options) => {
      const db = await this.ready();
      const from = options?.fromDate ?? toIsoDate(new Date());
      const params: (string | number)[] = [councilId, from];
      let invited = '';
      if (options?.memberId !== undefined) {
        // A member's own list leaves out drip-release invitations until their release day (Sprint 5Z-6).
        invited = ` AND [id] IN (SELECT [MeetingID] FROM [MeetingInvites] WHERE [MemberID] = ?)
                    AND ([InviteReleaseDate] IS NULL OR substr([InviteReleaseDate], 1, 10) <= ?)`;
        params.push(options.memberId, toIsoDate(this.now()));
      }
      return db.getAllAsync<Meeting>(
        `SELECT * FROM [Meeting] WHERE [CouncilID] = ? AND COALESCE([EndDate], [Date]) >= ?${invited}
          ORDER BY [Date], [Time Start], [id]`,
        params,
      );
    },

    listSchedules: async (councilId, memberId, options) => {
      const db = await this.ready();
      await this.requireMember(db, memberId);
      const from = options?.fromDate ?? toIsoDate(this.now());
      const allSchedules = await db.getAllAsync<Meeting & { response: MeetingResponseStatus | null }>(
        `SELECT m.*, (SELECT i.[ResponseStatus] FROM [MeetingInvites] i WHERE i.[MeetingID] = m.[id] AND i.[MemberID] = ? ORDER BY i.[id] LIMIT 1) AS response
           FROM [Meeting] m WHERE m.[CouncilID] = ? AND COALESCE(m.[EndDate], m.[Date]) >= ?
          ORDER BY m.[Date], m.[Time Start], m.[id]`,
        [memberId, councilId, from],
      );
      const strip = ({ response: _response, ...meeting }: Meeting & { response: MeetingResponseStatus | null }): Meeting => meeting;
      const today = toIsoDate(this.now());
      const invited = allSchedules.filter((m) => m.response !== null && isInvitationReleased(m, today));
      return {
        myInvites: invited.map(strip),
        allSchedules: allSchedules.map(strip),
        myResponses: Object.fromEntries(invited.map((m) => [m.id, m.response!])),
      };
    },

    create: async (meeting, invite = 'none') => {
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        id = await this.insertMeeting(db, meeting, invite);
      });
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [id]))!;
    },

    listInvites: async (meetingId) => {
      const db = await this.ready();
      return db.getAllAsync<MeetingInvites>(
        'SELECT * FROM [MeetingInvites] WHERE [MeetingID] = ? ORDER BY [id]',
        [meetingId],
      );
    },

    invite: async (meetingId, memberIds) => {
      const db = await this.ready();
      let added = 0;
      await db.withTransactionAsync(async () => {
        added = await this.insertInvites(db, meetingId, memberIds);
      });
      return added;
    },

    setAttended: async (meetingId, memberId, attended) => {
      const db = await this.ready();
      const res = await db.runAsync(
        'UPDATE [MeetingInvites] SET [Attended] = ? WHERE [MeetingID] = ? AND [MemberID] = ?',
        [attended ? 1 : 0, meetingId, memberId],
      );
      if (res.changes === 0) throw new Error(`Member ${memberId} is not invited to meeting ${meetingId}`);
    },

    setMinutes: async (meetingId, minutesUrl) => {
      // MinutesURL is NOT NULL in Schema.sql, so "no minutes" is stored as ''.
      const url = minutesUrl === null ? '' : assertText(minutesUrl, 'Minutes link', 255);
      const db = await this.ready();
      const res = await db.runAsync('UPDATE [Meeting] SET [MinutesURL] = ? WHERE [id] = ?', [url, meetingId]);
      if (res.changes === 0) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]))!;
    },

    linkGoogleDrive: async (actorId, meetingId, minutesUrl, flyerUrl) => {
      const minutes = cleanGoogleDriveUrl(minutesUrl, 'Google Drive minutes link');
      const flyer = cleanGoogleDriveUrl(flyerUrl, 'Google Drive flyer link');
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const meeting = await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]);
        if (!meeting) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
        assertMayLinkMeetingDrive(actor, meeting, `link Google Drive files to meeting ${meetingId}`);
        await db.runAsync('UPDATE [Meeting] SET [GoogleDriveMinutesURL] = ?, [GoogleDriveFlyerURL] = ? WHERE [id] = ?', [
          minutes,
          flyer,
          meetingId,
        ]);
      });
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]))!;
    },

    memberHours: async (memberId, range) => {
      const db = await this.ready();
      await this.requireMember(db, memberId);
      const attended = await db.getAllAsync<Meeting>(
        `SELECT m.* FROM [MeetingInvites] i JOIN [Meeting] m ON m.[id] = i.[MeetingID]
          WHERE i.[MemberID] = ? AND i.[Attended] = 1 AND m.[Date] BETWEEN ? AND ?`,
        [memberId, range?.fromDate ?? '0000-01-01', range?.toDate ?? '9999-12-31'],
      );
      return { memberId, ...aggregateMeetingHours(attended) };
    },

    listCouncilMeetingTypes: async (councilId) => {
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      return db.getAllAsync<CouncilMeetingType>(
        'SELECT * FROM [CouncilMeetingType] WHERE [CouncilID] = ? ORDER BY [TypeName], [id]',
        [councilId],
      );
    },

    rsvpToInvite: async (actorId, meetingId, status) => {
      const response = assertMeetingResponseStatus(status);
      const db = await this.ready();
      let inviteId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, actorId);
        const meeting = await db.getFirstAsync<Pick<Meeting, 'InviteReleaseDate'>>('SELECT [InviteReleaseDate] FROM [Meeting] WHERE [id] = ?', [meetingId]);
        if (!meeting) {
          throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
        }
        const invite = await db.getFirstAsync<{ id: number }>(
          'SELECT [id] FROM [MeetingInvites] WHERE [MeetingID] = ? AND [MemberID] = ? ORDER BY [id]',
          [meetingId, actorId],
        );
        // An invitation still held back by the drip release (Sprint 5Z-6) cannot be answered yet.
        if (!invite || !isInvitationReleased(meeting, toIsoDate(this.now()))) {
          throw new BusinessRuleError('NOT_INVITED', `Member ${actorId} is not invited to meeting ${meetingId}.`, { meetingId, memberId: actorId });
        }
        inviteId = invite.id;
        await db.runAsync('UPDATE [MeetingInvites] SET [ResponseStatus] = ? WHERE [id] = ?', [response, inviteId]);
      });
      return (await db.getFirstAsync<MeetingInvites>('SELECT * FROM [MeetingInvites] WHERE [id] = ?', [inviteId]))!;
    },

    getAgendaTemplate: async (councilId, meetingTypeId) => {
      const db = await this.ready();
      return (
        (await db.getFirstAsync<CouncilAgendaTemplate>(
          'SELECT * FROM [CouncilAgendaTemplate] WHERE [CouncilID] = ? AND [MeetingTypeID] = ?',
          [councilId, meetingTypeId],
        )) ?? null
      );
    },

    saveAgendaTemplate: async (actorId, councilId, meetingTypeId, templateText) => {
      const text = cleanAgendaTemplateText(templateText);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayManageAgendaTemplates(await this.memberWriteActor(db, actorId), councilId);
        await this.requireCouncilMeetingType(db, councilId, meetingTypeId);
        if (text === '') {
          await db.runAsync('DELETE FROM [CouncilAgendaTemplate] WHERE [CouncilID] = ? AND [MeetingTypeID] = ?', [councilId, meetingTypeId]);
          return;
        }
        const res = await db.runAsync('UPDATE [CouncilAgendaTemplate] SET [TemplateText] = ? WHERE [CouncilID] = ? AND [MeetingTypeID] = ?', [
          text,
          councilId,
          meetingTypeId,
        ]);
        if (res.changes === 0) {
          await db.runAsync('INSERT INTO [CouncilAgendaTemplate] ([CouncilID], [MeetingTypeID], [TemplateText]) VALUES (?, ?, ?)', [
            councilId,
            meetingTypeId,
            text,
          ]);
        }
      });
      return this.meetings.getAgendaTemplate(councilId, meetingTypeId);
    },

    populateAnnualCadence: async (actorId, councilId, configId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const db = await this.ready();
      let config: CouncilCadenceConfig | null = null;
      const createdIds: number[] = [];
      const skippedDates: string[] = [];
      await db.withTransactionAsync(async () => {
        assertMayScheduleCouncilCadence(await this.memberWriteActor(db, actorId), councilId);
        await this.assertCouncilsExist(db, [councilId]);
        config = await db.getFirstAsync<CouncilCadenceConfig>('SELECT * FROM [CouncilCadenceConfig] WHERE [id] = ? AND [CouncilID] = ?', [
          configId,
          councilId,
        ]);
        if (!config) throw cadenceConfigNotFound(configId, councilId);
        const cadence: CouncilCadenceConfig = config;
        await this.requireCouncilMeetingType(db, councilId, cadence.MeetingTypeID);
        const type = (await db.getFirstAsync<{ TypeName: string }>('SELECT [TypeName] FROM [CouncilMeetingType] WHERE [id] = ?', [cadence.MeetingTypeID]))!;
        const dates = cadenceDatesForYear(cadence.CadencePattern, year);
        const times = cadenceMeetingTimes(cadence.DefaultStartTime);
        const globalType = globalMeetingTypeFor(type.TypeName, await db.getAllAsync<MeetingType>('SELECT [id], [Type] FROM [MeetingType] ORDER BY [id]'));
        if (globalType === undefined) throw new BusinessRuleError('INVALID_INPUT', 'No global meeting types are defined to file the meetings under.');
        const template = await db.getFirstAsync<{ TemplateText: string }>(
          'SELECT [TemplateText] FROM [CouncilAgendaTemplate] WHERE [CouncilID] = ? AND [MeetingTypeID] = ?',
          [councilId, cadence.MeetingTypeID],
        );
        for (const date of dates) {
          const taken = await db.getFirstAsync(
            'SELECT [id] FROM [Meeting] WHERE [CouncilID] = ? AND [MeetingTypeID] = ? AND substr([Date], 1, 10) = ?',
            [councilId, cadence.MeetingTypeID, date],
          );
          if (taken) {
            skippedDates.push(date);
            continue;
          }
          const meeting: NewMeeting = {
            CouncilID: councilId,
            'Meeting Name': cadenceMeetingName(type.TypeName),
            Date: date,
            ...times,
            Location: cadence.DefaultLocation,
            Agenda: template?.TemplateText ?? '',
            MinutesURL: '',
            MeetingType: globalType,
            MeetingTypeID: cadence.MeetingTypeID,
            OwnerID: null,
            IsMultiDay: 0,
            EndDate: null,
            InviteReleaseDate: cadenceInviteReleaseDate(date),
          };
          createdIds.push(await this.insertMeeting(db, meeting, cadenceInviteMode(cadence.DefaultRecipientGroup)));
        }
      });
      const created = await selectIn<Meeting>(db, (m) => `SELECT * FROM [Meeting] WHERE [id] IN (${m}) ORDER BY [Date], [id]`, createdIds);
      return { config: config!, fraternalYear: year, created, skippedDates };
    },

    listCadenceConfigs: async (councilId) => {
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      return db.getAllAsync<CouncilCadenceConfig>('SELECT * FROM [CouncilCadenceConfig] WHERE [CouncilID] = ? ORDER BY [id]', [councilId]);
    },

    saveCadenceConfig: async (actorId, councilId, input) => {
      const clean = cleanCadenceConfigInput(input);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayScheduleCouncilCadence(await this.memberWriteActor(db, actorId), councilId);
        await this.assertCouncilsExist(db, [councilId]);
        await this.requireCouncilMeetingType(db, councilId, clean.MeetingTypeID);
        const fields: Bind[] = [clean.CadencePattern, clean.DefaultStartTime, clean.DefaultLocation, clean.DefaultRecipientGroup];
        const res = await db.runAsync(
          `UPDATE [CouncilCadenceConfig] SET [CadencePattern] = ?, [DefaultStartTime] = ?, [DefaultLocation] = ?, [DefaultRecipientGroup] = ?
            WHERE [CouncilID] = ? AND [MeetingTypeID] = ?`,
          [...fields, councilId, clean.MeetingTypeID],
        );
        if (res.changes === 0) {
          await db.runAsync(
            `INSERT INTO [CouncilCadenceConfig] ([CadencePattern], [DefaultStartTime], [DefaultLocation], [DefaultRecipientGroup], [CouncilID], [MeetingTypeID])
             VALUES (?, ?, ?, ?, ?, ?)`,
            [...fields, councilId, clean.MeetingTypeID],
          );
        }
      });
      return (await db.getFirstAsync<CouncilCadenceConfig>('SELECT * FROM [CouncilCadenceConfig] WHERE [CouncilID] = ? AND [MeetingTypeID] = ?', [
        councilId,
        clean.MeetingTypeID,
      ]))!;
    },

    removeCadenceConfig: async (actorId, councilId, configId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayScheduleCouncilCadence(await this.memberWriteActor(db, actorId), councilId);
        const res = await db.runAsync('DELETE FROM [CouncilCadenceConfig] WHERE [id] = ? AND [CouncilID] = ?', [configId, councilId]);
        if (res.changes === 0) throw cadenceConfigNotFound(configId, councilId);
      });
    },

    listProposedMotions: async (meetingId) => {
      const db = await this.ready();
      if (!(await db.getFirstAsync('SELECT [id] FROM [Meeting] WHERE [id] = ?', [meetingId]))) {
        throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
      }
      const rows = await db.getAllAsync<ProposedMotion & { presenterFirstName: string | null; presenterLastName: string | null }>(
        `SELECT p.*, m.[MemberFirstName] AS presenterFirstName, m.[MemberLastName] AS presenterLastName
           FROM [ProposedMotion] p LEFT JOIN [Member] m ON m.[id] = p.[PresenterMemberID]
          WHERE p.[TargetMeetingID] = ? ORDER BY p.[id]`,
        [meetingId],
      );
      return rows.map(({ presenterFirstName, presenterLastName, ...motion }) => ({
        motion,
        presenterFirstName: presenterFirstName ?? '',
        presenterLastName: presenterLastName ?? '',
      }));
    },

    startLiveAssemblyConsole: async (actorId, meetingId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const meeting = await this.requireMeetingRow(db, meetingId);
        assertMayRunLiveAssembly(actor, meeting, `start the live console of meeting ${meetingId}`);
        if (isMeetingLive(meeting)) return;
        // Lock the quorum base: the council's Active roster at the moment the meeting goes live.
        await db.runAsync(
          `UPDATE [Meeting] SET [IsLiveInProgress] = 1,
              [LiveQuorumRosterCount] = (SELECT COUNT(*) FROM [Member] m WHERE ${ACTIVE_MEMBER_FILTER})
            WHERE [id] = ?`,
          [meeting.CouncilID, meetingId],
        );
      });
      return this.liveAssemblyState(db, actorId, meetingId);
    },

    advanceActiveAgendaItem: async (actorId, meetingId, itemName, allottedMinutes, options = {}) => {
      const item = cleanLiveAgendaItem(itemName, allottedMinutes);
      const lineKey = cleanAgendaLineKey(options.lineKey);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const meeting = await this.requireMeetingRow(db, meetingId);
        assertMayRunLiveAssembly(actor, meeting, `set the agenda of meeting ${meetingId}`);
        assertMeetingLive(meeting, 'take a new agenda item');
        await db.runAsync(
          `UPDATE [Meeting] SET [ActiveAgendaItemName] = ?, [ActiveAgendaItemTimeRemaining] = ?, [ActiveAgendaItemStartedAt] = ?,
              [ActiveAgendaLineKey] = ? WHERE [id] = ?`,
          [item.name, item.minutes, toTimestamp(this.now()), lineKey, meetingId],
        );
      });
      return this.liveAssemblyState(db, actorId, meetingId);
    },

    logLiveAttendanceOverride: async (actorId, meetingId, memberId) => {
      const db = await this.ready();
      let rowId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const meeting = await this.requireMeetingRow(db, meetingId);
        if (actorId !== memberId) assertMayRunLiveAssembly(actor, meeting, `check member ${memberId} in to meeting ${meetingId}`);
        assertMeetingLive(meeting, 'take check-ins');
        assertLiveParticipant(actorId === memberId ? actor : await this.memberWriteActor(db, memberId), meeting);
        const existing = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [LiveAttendance] WHERE [MeetingID] = ? AND [MemberID] = ?', [meetingId, memberId]);
        if (existing) {
          rowId = existing.id;
          return;
        }
        // Checking in overrides whatever the member answered: the invitation reads Accepted and Attended.
        const updated = await db.runAsync(
          "UPDATE [MeetingInvites] SET [Attended] = 1, [ResponseStatus] = 'Accepted' WHERE [MeetingID] = ? AND [MemberID] = ?",
          [meetingId, memberId],
        );
        if (updated.changes === 0) {
          await db.runAsync("INSERT INTO [MeetingInvites] ([MeetingID], [MemberID], [Attended], [ResponseStatus]) VALUES (?, ?, 1, 'Accepted')", [meetingId, memberId]);
        }
        const res = await db.runAsync('INSERT INTO [LiveAttendance] ([CouncilID], [MeetingID], [MemberID], [CheckedInAt]) VALUES (?, ?, ?, ?)', [
          meeting.CouncilID,
          meetingId,
          memberId,
          toTimestamp(this.now()),
        ]);
        rowId = res.lastInsertRowId;
      });
      return (await db.getFirstAsync<LiveAttendance>('SELECT * FROM [LiveAttendance] WHERE [id] = ?', [rowId]))!;
    },

    launchSecretSmartphoneBallot: async (actorId, proposedMotionId) => {
      const db = await this.ready();
      let meetingId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const motion = await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ?', [proposedMotionId]);
        if (!motion) throw proposedMotionNotFound(proposedMotionId);
        const meeting = await this.requireMeetingRow(db, motion.TargetMeetingID);
        assertMayRunLiveAssembly(actor, meeting, `open the ballot on motion ${proposedMotionId}`);
        assertMotionPending(motion, 'go to a ballot');
        assertMeetingLive(meeting, 'open a ballot');
        assertBallotLaunchable(motion, await db.getAllAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [TargetMeetingID] = ?', [meeting.id]));
        await db.runAsync('UPDATE [ProposedMotion] SET [BallotOpenedAt] = ? WHERE [id] = ?', [toTimestamp(this.now()), proposedMotionId]);
        meetingId = meeting.id;
      });
      return this.liveAssemblyState(db, actorId, meetingId);
    },

    castAnonymousMobileVote: async (actorId, councilId, motionId, selection) => {
      const choice = assertBallotSelection(selection);
      const hash = await sha256Hex(ballotHashInput(await this.ballotSecret(), motionId, actorId));
      const db = await this.ready();
      let tally: BallotTally | null = null;
      await db.withTransactionAsync(async () => {
        const voter = await this.memberWriteActor(db, actorId);
        const motion = await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ? AND [CouncilID] = ?', [motionId, councilId]);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = await this.requireMeetingRow(db, motion.TargetMeetingID);
        assertBallotOpen(motion);
        assertLiveParticipant(voter, meeting);
        const checkedIn = await db.getAllAsync<{ MemberID: number }>('SELECT [MemberID] FROM [LiveAttendance] WHERE [MeetingID] = ?', [meeting.id]);
        assertCheckedIn(checkedIn.some((a) => a.MemberID === actorId), actorId, meeting.id);
        if (await db.getFirstAsync('SELECT [id] FROM [BallotVote] WHERE [ProposedMotionID] = ? AND [AnonymousBallotHash] = ?', [motionId, hash])) {
          throw ballotAlreadyCast(motionId);
        }
        await db.runAsync(
          'INSERT INTO [BallotVote] ([CouncilID], [ProposedMotionID], [AnonymousBallotHash], [VoteSelection], [CastAt]) VALUES (?, ?, ?, ?, ?)',
          [councilId, motionId, hash, choice, toTimestamp(this.now())],
        );
        const votes = await db.getAllAsync<BallotVote>('SELECT * FROM [BallotVote] WHERE [ProposedMotionID] = ?', [motionId]);
        tally = tallyBallots(motionId, votes, checkedIn.length);
      });
      return tally!;
    },

    finalizeProposedMotionVote: async (actorId, motionId, resultStatus) => {
      const result = assertFinalMotionResult(resultStatus);
      const db = await this.ready();
      let finalization: MotionVoteFinalization | null = null;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const motion = await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ?', [motionId]);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = await this.requireMeetingRow(db, motion.TargetMeetingID);
        assertMayRunLiveAssembly(actor, meeting, `decide motion ${motionId}`);
        assertMotionPending(motion, 'be decided again');
        const votes = await db.getAllAsync<BallotVote>('SELECT * FROM [BallotVote] WHERE [ProposedMotionID] = ?', [motionId]);
        const eligible = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM [LiveAttendance] WHERE [MeetingID] = ?', [meeting.id]);
        const tally = tallyBallots(motionId, votes, eligible?.n ?? 0);
        assertResultMatchesTally(result, tally, motion.BallotOpenedAt != null);
        await db.runAsync('UPDATE [ProposedMotion] SET [VoteResult] = ? WHERE [id] = ?', [result, motionId]);
        let charitableRequest: CharitableRequest | null = null;
        if (motion.SourceType === 'CharitableRequest' && motion.SourceRecordID != null) {
          const request = await db.getFirstAsync<CharitableRequest>('SELECT * FROM [CharitableRequest] WHERE [id] = ?', [motion.SourceRecordID]);
          if (request) {
            const outcome = charitableVoteOutcome(result, request);
            if (outcome) {
              await db.runAsync('UPDATE [CharitableRequest] SET [VoteStatus] = ?, [AmountApproved] = ? WHERE [id] = ?', [outcome.VoteStatus, outcome.AmountApproved, request.id]);
            }
            await this.tagCharitableBudgetFallback(db, request.id);
            charitableRequest = await db.getFirstAsync<CharitableRequest>('SELECT * FROM [CharitableRequest] WHERE [id] = ?', [request.id]);
          }
        }
        finalization = {
          motion: (await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ?', [motionId]))!,
          tally,
          charitableRequest,
        };
      });
      return finalization!;
    },

    getLiveAssemblyState: async (actorId, meetingId) => {
      const db = await this.ready();
      assertMayFollowLiveAssembly(await this.memberWriteActor(db, actorId), await this.requireMeetingRow(db, meetingId));
      return this.liveAssemblyState(db, actorId, meetingId);
    },

    closeLiveAssemblyConsole: async (actorId, meetingId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const meeting = await this.requireMeetingRow(db, meetingId);
        assertMayRunLiveAssembly(actor, meeting, `close the live console of meeting ${meetingId}`);
        if (!isMeetingLive(meeting)) return;
        assertNoBallotOpen(meetingId, await db.getAllAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [TargetMeetingID] = ?', [meetingId]));
        await db.runAsync(
          `UPDATE [Meeting] SET [IsLiveInProgress] = 0, [ActiveAgendaItemName] = NULL, [ActiveAgendaItemTimeRemaining] = NULL,
              [ActiveAgendaItemStartedAt] = NULL, [ActiveAgendaLineKey] = NULL WHERE [id] = ?`,
          [meetingId],
        );
      });
      return this.liveAssemblyState(db, actorId, meetingId);
    },

    getMeetingAgenda: async (actorId, meetingId) => {
      const db = await this.ready();
      assertMayFollowLiveAssembly(await this.memberWriteActor(db, actorId), await this.requireMeetingRow(db, meetingId));
      return this.meetingAgendaView(db, meetingId);
    },

    applyAgendaBlueprint: async (actorId, meetingId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const meeting = await this.requireMeetingRow(db, meetingId);
        assertMayEditLiveAgenda(await this.memberWriteActor(db, actorId), meeting, `lay out the agenda of meeting ${meetingId}`);
        if (await db.getFirstAsync('SELECT [id] FROM [MeetingAgendaItem] WHERE [MeetingID] = ?', [meetingId])) throw agendaAlreadyStructured(meetingId);
        const roles = await db.getAllAsync<{ id: number; Role: string }>('SELECT [id], [Role] FROM [Role]');
        for (const row of blueprintAgendaItems(meeting, roles)) {
          await db.runAsync(
            `INSERT INTO [MeetingAgendaItem] ([CouncilID], [MeetingID], [SectionKey], [SortOrder], [LineMarkdown], [SpeakerRoleID], [SpeakerLabel])
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [row.CouncilID, row.MeetingID, row.SectionKey, row.SortOrder, row.LineMarkdown, row.SpeakerRoleID ?? null, row.SpeakerLabel ?? null],
          );
        }
      });
      return this.meetingAgendaView(db, meetingId);
    },

    editAgendaLine: async (actorId, meetingId, line, markdown) => {
      const ref = assertAgendaLineRef(line);
      const text = cleanAgendaLineMarkdown(markdown);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const meeting = await this.requireMeetingRow(db, meetingId);
        assertMayEditLiveAgenda(await this.memberWriteActor(db, actorId), meeting, `correct the agenda of meeting ${meetingId}`);
        const stamp = toTimestamp(this.now());
        const update = (itemId: number) =>
          db.runAsync('UPDATE [MeetingAgendaItem] SET [LineMarkdown] = ?, [LastEditedByMemberID] = ?, [LastEditedAt] = ? WHERE [id] = ?', [text, actorId, stamp, itemId]);
        const insert = (section: string, sort: number, motionId: number | null, eventId: number | null) =>
          db.runAsync(
            `INSERT INTO [MeetingAgendaItem] ([CouncilID], [MeetingID], [SectionKey], [SortOrder], [LineMarkdown], [ProposedMotionID], [LinkedEventID],
               [LastEditedByMemberID], [LastEditedAt]) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [meeting.CouncilID, meetingId, section, sort, text, motionId, eventId, actorId, stamp],
          );
        if (ref.kind === 'item') {
          const item = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [MeetingAgendaItem] WHERE [id] = ? AND [MeetingID] = ?', [ref.itemId, meetingId]);
          if (!item) throw agendaLineNotFound(ref, meetingId);
          await update(item.id);
        } else if (ref.kind === 'motion') {
          if (!(await db.getFirstAsync('SELECT [id] FROM [ProposedMotion] WHERE [id] = ? AND [TargetMeetingID] = ?', [ref.motionId, meetingId]))) {
            throw agendaLineNotFound(ref, meetingId);
          }
          const item = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [MeetingAgendaItem] WHERE [MeetingID] = ? AND [ProposedMotionID] = ?', [meetingId, ref.motionId]);
          if (item) await update(item.id);
          else await insert('new_business', MOTION_LINE_SORT_BASE + ref.motionId, ref.motionId, null);
        } else {
          if (!(await db.getFirstAsync('SELECT [EventID] FROM [EventCouncils] WHERE [EventID] = ? AND [CouncilID] = ?', [ref.eventId, meeting.CouncilID]))) {
            throw agendaLineNotFound(ref, meetingId);
          }
          const item = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [MeetingAgendaItem] WHERE [MeetingID] = ? AND [LinkedEventID] = ?', [meetingId, ref.eventId]);
          if (item) await update(item.id);
          else await insert('upcoming_events', 0, null, ref.eventId);
        }
      });
      return this.meetingAgendaView(db, meetingId);
    },

    addAgendaLine: async (actorId, meetingId, sectionKey) => {
      const section = assertAgendaSectionKey(sectionKey);
      const db = await this.ready();
      let itemId = 0;
      await db.withTransactionAsync(async () => {
        const meeting = await this.requireMeetingRow(db, meetingId);
        assertMayEditLiveAgenda(await this.memberWriteActor(db, actorId), meeting, `add a line to the agenda of meeting ${meetingId}`);
        const items = await db.getAllAsync<MeetingAgendaItem>('SELECT [SectionKey], [SortOrder] FROM [MeetingAgendaItem] WHERE [MeetingID] = ?', [meetingId]);
        const motionIds = (await db.getAllAsync<{ id: number }>('SELECT [id] FROM [ProposedMotion] WHERE [TargetMeetingID] = ?', [meetingId])).map((m) => m.id);
        const res = await db.runAsync(
          `INSERT INTO [MeetingAgendaItem] ([CouncilID], [MeetingID], [SectionKey], [SortOrder], [LineMarkdown], [LastEditedByMemberID], [LastEditedAt])
           VALUES (?, ?, ?, ?, '', ?, ?)`,
          [meeting.CouncilID, meetingId, section, nextAgendaSortOrder(section, items, motionIds), actorId, toTimestamp(this.now())],
        );
        itemId = res.lastInsertRowId;
      });
      const agenda = await this.meetingAgendaView(db, meetingId);
      const line = agenda.sections.flatMap((sec) => sec.lines).find((l) => l.key === `item:${itemId}`)!;
      return { agenda, line };
    },

    recordHandBallotTally: async (actorId, motionId, approvedCount, deniedCount, options = {}) => {
      const counts = cleanHandTally(approvedCount, deniedCount);
      const transactionId = cleanTransactionId(options.transactionId);
      const result = handTallyResult(counts.approved, counts.denied);
      const db = await this.ready();
      let recording: HandTallyRecording | null = null;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const motion = await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ?', [motionId]);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = await this.requireMeetingRow(db, motion.TargetMeetingID);
        assertMayEditLiveAgenda(actor, meeting, `record the hand tally on motion ${motionId}`);
        assertHandTallyAllowed(motion);
        if (transactionId !== null) {
          if (result !== 'Passed') throw capitalOnFailedMotion(motionId);
          await this.requireLedgerTransaction(db, meeting.CouncilID, transactionId);
        }
        const res = await db.runAsync(
          `INSERT INTO [MotionHandTally] ([CouncilID], [ProposedMotionID], [ApprovedCount], [DeniedCount], [RecordedByMemberID], [RecordedAt], [LinkedTransactionID])
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [meeting.CouncilID, motionId, counts.approved, counts.denied, actorId, toTimestamp(this.now()), transactionId],
        );
        await db.runAsync('UPDATE [ProposedMotion] SET [VoteResult] = ? WHERE [id] = ?', [result, motionId]);
        let charitableRequest: CharitableRequest | null = null;
        if (motion.SourceType === 'CharitableRequest' && motion.SourceRecordID != null) {
          const request = await db.getFirstAsync<CharitableRequest>('SELECT * FROM [CharitableRequest] WHERE [id] = ?', [motion.SourceRecordID]);
          if (request) {
            const outcome = charitableVoteOutcome(result, request);
            if (outcome) {
              await db.runAsync('UPDATE [CharitableRequest] SET [VoteStatus] = ?, [AmountApproved] = ? WHERE [id] = ?', [outcome.VoteStatus, outcome.AmountApproved, request.id]);
            }
            await this.tagCharitableBudgetFallback(db, request.id);
            charitableRequest = await db.getFirstAsync<CharitableRequest>('SELECT * FROM [CharitableRequest] WHERE [id] = ?', [request.id]);
          }
        }
        recording = {
          tally: (await db.getFirstAsync<MotionHandTally>('SELECT * FROM [MotionHandTally] WHERE [id] = ?', [res.lastInsertRowId]))!,
          motion: (await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ?', [motionId]))!,
          charitableRequest,
        };
      });
      return recording!;
    },

    linkHandTallyTransaction: async (actorId, motionId, transactionIdInput) => {
      const transactionId = cleanTransactionId(transactionIdInput);
      const db = await this.ready();
      let tallyId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const motion = await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ?', [motionId]);
        if (!motion) throw proposedMotionNotFound(motionId);
        const meeting = await this.requireMeetingRow(db, motion.TargetMeetingID);
        if (!mayPostGeneralLedger(actor, meeting.CouncilID)) assertMayEditLiveAgenda(actor, meeting, `link the capital released for motion ${motionId}`);
        const tally = await db.getFirstAsync<MotionHandTally>('SELECT * FROM [MotionHandTally] WHERE [ProposedMotionID] = ?', [motionId]);
        if (!tally) throw handTallyNotFound(motionId);
        if (motion.VoteResult !== 'Passed') throw capitalOnFailedMotion(motionId);
        if (transactionId !== null) await this.requireLedgerTransaction(db, meeting.CouncilID, transactionId);
        await db.runAsync('UPDATE [MotionHandTally] SET [LinkedTransactionID] = ? WHERE [id] = ?', [transactionId, tally.id]);
        tallyId = tally.id;
      });
      return (await db.getFirstAsync<MotionHandTally>('SELECT * FROM [MotionHandTally] WHERE [id] = ?', [tallyId]))!;
    },
  };

  /** RECORD_NOT_FOUND unless the council's ledger holds a posting with this TransactionID. */
  private async requireLedgerTransaction(db: SQLite.SQLiteDatabase, councilId: number, transactionId: string): Promise<void> {
    if (!(await db.getFirstAsync('SELECT [id] FROM [JournalEntry] WHERE [CouncilID] = ? AND [TransactionID] = ?', [councilId, transactionId]))) {
      throw ledgerTransactionNotFound(transactionId, councilId);
    }
  }

  /** MeetingAgendaView of the meeting, from its items, motions and hand tallies and its council's seats and events. */
  private async meetingAgendaView(db: SQLite.SQLiteDatabase, meetingId: number): Promise<MeetingAgendaView> {
    const meeting = await this.requireMeetingRow(db, meetingId);
    return buildMeetingAgendaView({
      meeting,
      items: await db.getAllAsync<MeetingAgendaItem>('SELECT * FROM [MeetingAgendaItem] WHERE [MeetingID] = ?', [meetingId]),
      motions: await db.getAllAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [TargetMeetingID] = ?', [meetingId]),
      handTallies: await db.getAllAsync<MotionHandTally>(
        'SELECT t.* FROM [MotionHandTally] t JOIN [ProposedMotion] p ON p.[id] = t.[ProposedMotionID] WHERE p.[TargetMeetingID] = ?',
        [meetingId],
      ),
      events: await db.getAllAsync<Event>('SELECT e.* FROM [Event] e JOIN [EventCouncils] ec ON ec.[EventID] = e.[id] WHERE ec.[CouncilID] = ?', [meeting.CouncilID]),
      roles: await db.getAllAsync<{ id: number; Role: string; Officer: number }>('SELECT [id], [Role], [Officer] FROM [Role]'),
      seats: await db.getAllAsync<{ id: number; RoleID: number; MemberID: number }>('SELECT [id], [RoleID], [MemberID] FROM [MemberRoles]'),
      members: (
        await db.getAllAsync<{ id: number; CouncilID: number; MemberFirstName: string; MemberLastName: string; active: number }>(
          `SELECT m.[id], m.[CouncilID], m.[MemberFirstName], m.[MemberLastName],
                  (m.[StatusID] = (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active')) AS active
             FROM [Member] m`,
        )
      ).map((m) => ({ ...m, active: m.active === 1 })),
    });
  }

  /** A meeting row; an unknown id rejects MEETING_NOT_FOUND. */
  private async requireMeetingRow(db: SQLite.SQLiteDatabase, meetingId: number): Promise<Meeting> {
    const row = await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]);
    if (!row) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
    return row;
  }

  /**
   * The secret ballot key (Sprint 5Z-9): options.ballotSecret, or one kept in the device's secure store, created on first
   * use. It never enters the database, so the ballots cannot be traced back to voters from the tables, and it outlives
   * an app restart, so a member cannot vote twice by relaunching.
   */
  private ballotSecret(): Promise<string> {
    if (!this.ballotSecretValue) {
      this.ballotSecretValue = (async () => {
        const stored = await SecureStore.getItemAsync(BALLOT_SECRET_KEY);
        if (stored) return stored;
        const secret = formatBallotSecret(await Crypto.getRandomBytesAsync(32));
        await SecureStore.setItemAsync(BALLOT_SECRET_KEY, secret, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
        return secret;
      })().catch((err) => {
        this.ballotSecretValue = null; // let the next ballot retry
        throw err;
      });
    }
    return this.ballotSecretValue;
  }

  /** LiveAssemblyState for `viewerId`, who has voted on a motion when one of its ballots carries the viewer's hash. */
  private async liveAssemblyState(db: SQLite.SQLiteDatabase, viewerId: number, meetingId: number): Promise<LiveAssemblyState> {
    const meeting = await this.requireMeetingRow(db, meetingId);
    const motions = await db.getAllAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [TargetMeetingID] = ? ORDER BY [id]', [meetingId]);
    const votes = await db.getAllAsync<BallotVote>(
      'SELECT v.* FROM [BallotVote] v JOIN [ProposedMotion] p ON p.[id] = v.[ProposedMotionID] WHERE p.[TargetMeetingID] = ?',
      [meetingId],
    );
    const secret = motions.length ? await this.ballotSecret() : '';
    const voted = new Set<number>();
    for (const m of motions) {
      const hash = await sha256Hex(ballotHashInput(secret, m.id, viewerId));
      if (votes.some((v) => v.ProposedMotionID === m.id && v.AnonymousBallotHash === hash)) voted.add(m.id);
    }
    const checkedIn = await db.getAllAsync<{ MemberID: number }>('SELECT [MemberID] FROM [LiveAttendance] WHERE [MeetingID] = ?', [meetingId]);
    return buildLiveAssemblyState({
      meeting,
      motions,
      votes,
      checkedInMemberIds: checkedIn.map((a) => a.MemberID),
      viewerId,
      viewerVotedMotionIds: voted,
      now: this.now(),
      handTallies: await db.getAllAsync<MotionHandTally>(
        'SELECT t.* FROM [MotionHandTally] t JOIN [ProposedMotion] p ON p.[id] = t.[ProposedMotionID] WHERE p.[TargetMeetingID] = ?',
        [meetingId],
      ),
    });
  }

  /** A CouncilMeetingType of `councilId`; another council's type or an unknown id rejects INVALID_INPUT. */
  private async requireCouncilMeetingType(db: SQLite.SQLiteDatabase, councilId: number, meetingTypeId: number): Promise<void> {
    if (!(await db.getFirstAsync('SELECT [id] FROM [CouncilMeetingType] WHERE [id] = ? AND [CouncilID] = ?', [meetingTypeId, councilId]))) {
      throw new BusinessRuleError('INVALID_INPUT', `Council ${councilId} has no meeting type with id ${meetingTypeId}.`, { councilId, meetingTypeId });
    }
  }

  // ---- shifts ------------------------------------------------------------

  shifts: DataService['shifts'] = {
    getShiftDefaultLength: async (shiftId) => {
      const db = await this.ready();
      return shiftDefaultLengthHours(await this.requireShift(db, shiftId));
    },
  };

  private async insertMeeting(
    db: SQLite.SQLiteDatabase,
    m: NewMeeting,
    invite: MeetingInviteMode,
  ): Promise<number> {
    const ownerId = m.OwnerID ?? null;
    if (ownerId !== null && !(await db.getFirstAsync('SELECT [id] FROM [Member] WHERE [id] = ?', [ownerId]))) {
      throw new BusinessRuleError('INVALID_INPUT', `No member with id ${ownerId} to own the meeting.`, { ownerId });
    }
    const span = cleanMeetingSpan(m);
    const meetingTypeId = m.MeetingTypeID ?? null;
    if (meetingTypeId !== null) await this.requireCouncilMeetingType(db, m.CouncilID, meetingTypeId);
    const res = await db.runAsync(
      `INSERT INTO [Meeting] ([CouncilID], [Meeting Name], [Meeting Description], [Date],
                              [Time Start], [Time End], [Location], [Agenda], [MinutesURL], [MeetingType], [OwnerID],
                              [IsMultiDay], [EndDate], [MeetingTypeID], [InviteReleaseDate])
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.CouncilID,
        m['Meeting Name'],
        m['Meeting Description'] ?? null,
        m.Date,
        span['Time Start'],
        span['Time End'],
        m.Location,
        m.Agenda ?? '', // Agenda and MinutesURL are NOT NULL in Schema.sql: '' means "none yet"
        m.MinutesURL ?? '',
        m.MeetingType,
        ownerId,
        span.IsMultiDay,
        span.EndDate,
        meetingTypeId,
        m.InviteReleaseDate == null ? null : assertIsoDate(m.InviteReleaseDate, 'Invitation release date'),
      ],
    );
    const meetingId = res.lastInsertRowId;
    await this.insertInvites(db, meetingId, await this.resolveInvitees(db, m.CouncilID, invite));
    return meetingId;
  }

  private async resolveInvitees(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    mode: MeetingInviteMode,
  ): Promise<number[]> {
    if (mode === 'none') return [];
    if (typeof mode === 'object') return mode.memberIds;
    const officerOnly =
      mode === 'officers'
        ? ` AND EXISTS (SELECT 1 FROM [MemberRoles] mr JOIN [Role] r ON r.[id] = mr.[RoleID]
                         WHERE mr.[MemberID] = m.[id] AND r.[Officer] = 1)`
        : '';
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT m.[id] FROM [Member] m WHERE ${ACTIVE_MEMBER_FILTER}${officerOnly} ORDER BY m.[id]`,
      [councilId],
    );
    return rows.map((r) => r.id);
  }

  private async insertInvites(db: SQLite.SQLiteDatabase, meetingId: number, memberIds: number[]): Promise<number> {
    let added = 0;
    for (const memberId of new Set(memberIds)) {
      const res = await db.runAsync(
        `INSERT INTO [MeetingInvites] ([MeetingID], [MemberID], [Attended])
         SELECT ?, ?, 0
          WHERE NOT EXISTS (SELECT 1 FROM [MeetingInvites] WHERE [MeetingID] = ? AND [MemberID] = ?)`,
        [meetingId, memberId, meetingId, memberId],
      );
      added += res.changes;
    }
    return added;
  }

  // ---- messages ----------------------------------------------------------

  // ---- system feedback ---------------------------------------------------

  notifications: DataService['notifications'] = {
    registerDeviceToken: async (actorId, pushToken) => {
      const token = cleanExpoPushToken(pushToken);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, actorId);
        // A phone belongs to whoever registered it last, so a member still holding the token lets it go.
        if (token !== null) {
          await db.runAsync('UPDATE [Member] SET [ExpoPushToken] = NULL WHERE [ExpoPushToken] = ? AND [id] <> ?', [token, actorId]);
        }
        await db.runAsync('UPDATE [Member] SET [ExpoPushToken] = ? WHERE [id] = ?', [token, actorId]);
      });
    },

    listMemberAlerts: async (actorId) => {
      const db = await this.ready();
      await this.requireMember(db, actorId);
      return db.getAllAsync<NotificationLog>(
        'SELECT * FROM [NotificationLog] WHERE [TargetMemberID] = ? AND [SentAt] >= ? ORDER BY [SentAt] DESC, [id] DESC',
        [actorId, alertHistoryThreshold(this.now())],
      );
    },

    markAsRead: async (actorId, alertId) => {
      const db = await this.ready();
      await this.requireMember(db, actorId);
      const res = await db.runAsync('UPDATE [NotificationLog] SET [IsRead] = 1 WHERE [id] = ? AND [TargetMemberID] = ?', [alertId, actorId]);
      if (res.changes === 0) throw alertNotFound(alertId);
      return (await db.getFirstAsync<NotificationLog>('SELECT * FROM [NotificationLog] WHERE [id] = ?', [alertId]))!;
    },

    dispatchHighPriorityAlert: async (actorId, councilId, filters, payload) => {
      const target = cleanAlertFilters(filters);
      const alert = cleanAlertPayload(payload);
      const db = await this.ready();
      const logs: NotificationLog[] = [];
      await db.withTransactionAsync(async () => {
        assertMayDispatchCouncilAlerts(await this.memberWriteActor(db, actorId), councilId, `send alerts to council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        for (const skillId of target.skillIds) {
          if (!(await db.getFirstAsync('SELECT [id] FROM [Skill] WHERE [id] = ?', [skillId]))) {
            throw new BusinessRuleError('INVALID_INPUT', `No skill with id ${skillId}.`, { skillId });
          }
        }
        for (const shiftId of target.shiftIds) {
          const shift = await db.getFirstAsync<{ EventID: number }>('SELECT [EventID] FROM [Shift] WHERE [id] = ?', [shiftId]);
          if (!shift || !(await this.councilIdsOf(db, shift.EventID)).includes(councilId)) {
            throw new BusinessRuleError('INVALID_INPUT', `Shift ${shiftId} is not on an event of council ${councilId}.`, { shiftId, councilId });
          }
        }
        const skillHolders = new Set(
          (await selectIn<{ MemberID: number }>(db, (m) => `SELECT [MemberID] FROM [MemberSkill] WHERE [SkillID] IN (${m})`, target.skillIds)).map((r) => r.MemberID),
        );
        const roster = new Set(
          (await selectIn<{ MemberID: number }>(db, (m) => `SELECT [MemberID] FROM [EventSignup] WHERE [ShiftID] IN (${m})`, target.shiftIds)).map((r) => r.MemberID),
        );
        const active = await selectIn<{ id: number; CouncilID: number }>(
          db,
          (m) => `SELECT m.[id], m.[CouncilID] FROM [Member] m
                   WHERE m.[StatusID] = (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active') AND m.[id] IN (${m})`,
          [...new Set([...skillHolders, ...roster])],
        );
        // Skill networks stay inside the council; a shift roster includes sister-council volunteers on a shared event.
        const recipientIds = active
          .filter((m) => (m.CouncilID === councilId && skillHolders.has(m.id)) || roster.has(m.id))
          .map((m) => m.id)
          .sort((a, b) => a - b);
        if (recipientIds.length === 0) throw noAlertRecipients(councilId, target);
        const sentAt = toTimestamp(this.now());
        for (const memberId of recipientIds) {
          const res = await db.runAsync(
            `INSERT INTO [NotificationLog] ([CouncilID], [TargetMemberID], [Title], [MessageBody], [Priority], [SentAt], [IsRead])
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [councilId, memberId, alert.title, alert.body, alert.priority, sentAt],
          );
          logs.push((await db.getFirstAsync<NotificationLog>('SELECT * FROM [NotificationLog] WHERE [id] = ?', [res.lastInsertRowId]))!);
        }
      });
      const tokens = await selectIn<{ id: number; ExpoPushToken: string | null }>(
        db,
        (m) => `SELECT [id], [ExpoPushToken] FROM [Member] WHERE [id] IN (${m})`,
        logs.map((l) => l.TargetMemberID),
      );
      return deliverAlertsByStub(logs, new Map(tokens.map((r) => [r.id, r.ExpoPushToken])), this.log);
    },
  };

  supreme: DataService['supreme'] = {
    previewReport: async (actorId, councilId, formType, period) =>
      this.compileSupremeReport(await this.ready(), actorId, councilId, formType, period),

    syncAlchemerReport: async (actorId, councilId, formType, surveyId, period) => {
      const survey = cleanAlchemerSurveyId(surveyId);
      const db = await this.ready();
      const snapshot = await this.compileSupremeReport(db, actorId, councilId, formType, period);
      const form = snapshot.formType;
      const request = buildAlchemerRequest(survey, alchemerAnswers(snapshot));
      const { status, error } = await postAlchemerReport(this.postAlchemer, request);
      const res = await db.runAsync(
        `INSERT INTO [SupremeReportingSync] ([CouncilID], [FormType], [SyncDate], [SyncedByID], [AlchemerSurveyID], [Status])
         VALUES (?, ?, ?, ?, ?, ?)`,
        [councilId, form, toTimestamp(this.now()), actorId, survey, status],
      );
      const sync = (await db.getFirstAsync<SupremeReportingSync>('SELECT * FROM [SupremeReportingSync] WHERE [id] = ?', [res.lastInsertRowId]))!;
      return { sync, snapshot, request, error };
    },

    syncSupremeRoster: async (actorId, councilId, rows) => {
      const db = await this.ready();
      let result: SupremeRosterSyncResult = { created: [], updated: [], skipped: [] };
      await db.withTransactionAsync(async () => {
        assertMayImportSupremeRoster(await this.memberWriteActor(db, actorId), councilId);
        await this.assertCouncilsExist(db, [councilId]);
        await this.assertFraternalCouncil(db, councilId, 'import the Supreme Council roster');
        const ids = {
          activeStatusId: (await db.getFirstAsync<{ id: number }>("SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active'"))!.id,
          memberTypeId: (await db.getFirstAsync<{ id: number }>("SELECT [id] FROM [MemberType] WHERE [Type] = 'Member'"))!.id,
        };
        const out: SupremeRosterSyncResult = { created: [], updated: [], skipped: [] };
        const createdIds: number[] = [];
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
            const existing = await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [CouncilID] = ? AND [MemberNumber] = ?', [councilId, memberNumber]);
            if (existing) {
              const joined = cleanRosterJoinDate(row.DateJoinedCouncil, this.now());
              if ((existing.DateJoinedCouncil ?? null) !== joined) {
                await db.runAsync('UPDATE [Member] SET [DateJoinedCouncil] = ? WHERE [id] = ?', [joined, existing.id]);
                out.updated.push(withoutPushToken({ ...existing, DateJoinedCouncil: joined }));
              }
              continue;
            }
            const clean = cleanSupremeRosterRow(row, councilId, ids, this.now());
            const taken = await db.getFirstAsync<{ n: number }>(
              `SELECT (SELECT COUNT(*) FROM [Member] WHERE [Email] = ? COLLATE NOCASE)
                    + (SELECT COUNT(*) FROM [Credentials] WHERE [Username] = ? COLLATE NOCASE) AS n`,
              [clean.Email, clean.Email],
            );
            if ((taken?.n ?? 0) > 0) {
              out.skipped.push({ memberNumber, reason: `The email ${clean.Email} already belongs to a member or login.` });
              continue;
            }
            const cred = await db.runAsync('INSERT INTO [Credentials] ([Username], [Password]) VALUES (?, ?)', [clean.Email, UNREGISTERED_PASSWORD]);
            const cols = MEMBER_COLUMNS.filter((c) => clean[c] != null);
            const res = await db.runAsync(
              `INSERT INTO [Member] (${cols.map((c) => `[${c}]`).join(', ')}, [CredentialID]) VALUES (${marks(cols.length + 1)})`,
              [...cols.map((c) => clean[c] as Bind), cred.lastInsertRowId],
            );
            createdIds.push(res.lastInsertRowId);
          } catch (err) {
            if (!(err instanceof BusinessRuleError) || err instanceof SecurityPrivilegeError) throw err;
            out.skipped.push({ memberNumber, reason: describeError(err) });
          }
        }
        for (const id of createdIds) out.created.push(withoutPushToken((await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]))!));
        result = out;
      });
      // The post-insert hook: every new member gets the welcome email the moment the batch is stored.
      for (const member of result.created) await this.sendWelcomeEmail(db, member);
      return result;
    },

    listSyncHistory: async (actorId, councilId) => {
      const db = await this.ready();
      assertMaySyncSupremeReports(await this.memberWriteActor(db, actorId), councilId, `read the Supreme sync history of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      await this.assertFraternalCouncil(db, councilId, 'read the Supreme Council sync history');
      const syncs = await db.getAllAsync<SupremeReportingSync>('SELECT * FROM [SupremeReportingSync] WHERE [CouncilID] = ?', [councilId]);
      const members = await selectIn<Member>(
        db,
        (m) => `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member] WHERE [id] IN (${m})`,
        [...new Set(syncs.map((s) => s.SyncedByID))],
      );
      return buildSyncHistory(syncs, members);
    },
  };

  /** Checks the caller and compiles the snapshot from one transaction, so every figure comes from the same state of the ledgers. */
  private async compileSupremeReport(
    db: SQLite.SQLiteDatabase,
    actorId: number,
    councilId: number,
    formType: SupremeFormType,
    choice: SupremePeriodChoice | undefined,
  ): Promise<SupremeComplianceSnapshot> {
    const form = cleanSupremeFormType(formType);
    const period = resolveSupremePeriod(form, choice, this.now());
    assertMaySyncSupremeReports(await this.memberWriteActor(db, actorId), councilId, `file Supreme reports for council ${councilId}`);
    await this.assertCouncilsExist(db, [councilId]);
    await this.assertFraternalCouncil(db, councilId, 'file a Supreme Council report');
    let rows!: SupremeSnapshotRows;
    await db.withTransactionAsync(async () => {
      rows = await this.supremeSnapshotRows(db, councilId, period);
    });
    return compileSupremeSnapshot(form, period, rows);
  }

  /** The council's hours, events, donations and expense checks in the period, for compileSupremeSnapshot. */
  private async supremeSnapshotRows(db: SQLite.SQLiteDatabase, councilId: number, period: SupremeReportingPeriod): Promise<SupremeSnapshotRows> {
    const range = [councilId, period.fromDate, period.toDate];
    const council = (await db.getFirstAsync<{ CouncilNumber: number; CouncilName: string }>(
      'SELECT [CouncilNumber], [CouncilName] FROM [Council] WHERE [id] = ?',
      [councilId],
    ))!;
    const [eventTime, activityTime, events, donations, disbursements] = await Promise.all([
      db.getAllAsync<{ MemberID: number; Hours: number; category: string }>(
        `SELECT t.[MemberID], t.[Hours], COALESCE(c.[Category], 'Uncategorized') AS category
           FROM [EventTime] t
           JOIN [Shift] sh ON sh.[id] = t.[ShiftID]
           JOIN [Event] e ON e.[id] = sh.[EventID]
           LEFT JOIN [Category] c ON c.[id] = e.[CategoryID]
          WHERE e.[id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)
            AND sh.[ShiftDate] BETWEEN ? AND ?`,
        range,
      ),
      db.getAllAsync<{ MemberID: number; Hours: number; category: string }>(
        `SELECT t.[MemberID], t.[Hours], COALESCE(c.[Category], 'Uncategorized') AS category
           FROM [ActivityTime] t
           JOIN [Activities] a ON a.[id] = t.[ActivityID]
           LEFT JOIN [Category] c ON c.[id] = a.[CategoryID]
          WHERE a.[CouncilID] = ? AND t.[ActivityDate] BETWEEN ? AND ?`,
        range,
      ),
      db.getAllAsync<{ Spend: number | null }>(
        `SELECT [Spend] FROM [Event]
          WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?) AND [StartDate] BETWEEN ? AND ?`,
        range,
      ),
      db.getAllAsync<{ DonationAmount: number; method: string }>(
        `SELECT d.[DonationAmount], dm.[DonationMethod] AS method
           FROM [Donation] d JOIN [DonationMethod] dm ON dm.[id] = d.[DonationMethodID]
          WHERE d.[CouncilID] = ? AND d.[DonationDate] BETWEEN ? AND ?`,
        range,
      ),
      db.getAllAsync<{ TotalAmount: number }>(
        'SELECT [TotalAmount] FROM [ExpenseDisbursement] WHERE [CouncilID] = ? AND [PayoutDate] BETWEEN ? AND ?',
        range,
      ),
    ]);
    return {
      council: { id: councilId, ...council },
      eventTime,
      activityTime,
      events,
      donations: donations.map((d) => ({ DonationAmount: d.DonationAmount, kind: donationMethodKind(d.method) })),
      disbursements,
    };
  }

  // ---- officer elections (Sprint 5U) ----------------------------------------

  elections: DataService['elections'] = {
    listOfficerSeats: async (councilId) => {
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      return buildOfficerSeats(councilId, await this.electionRows(db, councilId));
    },

    listBallotConfig: async (councilId) => {
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      return buildBallotSeats(await this.electionRows(db, councilId), this.now());
    },

    listVacancies: async (councilId) => {
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      return buildVacancies(await this.electionRows(db, councilId));
    },

    toggleRoleBallotStatus: async (actorId, councilId, roleId, isOpen) => {
      const open = cleanBallotStatus(isOpen);
      const db = await this.ready();
      let ballot!: CouncilElectionBallot;
      await db.withTransactionAsync(async () => {
        assertMayConfigureBallot(await this.memberWriteActor(db, actorId), councilId);
        await this.assertCouncilsExist(db, [councilId]);
        assertElectedRole(requireRole(await this.allRoles(db), roleId));
        await this.backfillLeadershipHistory(db, councilId);
        // Closing a seat also ends any mid-year election on it; opening keeps a mid-year window already running.
        ballot = await this.upsertBallot(db, councilId, roleId, open ? { IsUpForElection: 1 } : { IsUpForElection: 0, IsMidYearElection: 0, NominationsCloseAt: null });
      });
      return ballot;
    },

    submitNomination: async (actorId, councilId, roleId, nomineeMemberId) => {
      const db = await this.ready();
      const now = this.now();
      let result!: Awaited<ReturnType<DataService['elections']['submitNomination']>>;
      await db.withTransactionAsync(async () => {
        assertMayNominate(await this.memberWriteActor(db, actorId), councilId);
        await this.assertCouncilsExist(db, [councilId]);
        const role = requireRole(await this.allRoles(db), roleId);
        assertElectedRole(role);
        await this.backfillLeadershipHistory(db, councilId);
        const stored = await db.getFirstAsync<CouncilElectionBallot>('SELECT * FROM [CouncilElectionBallot] WHERE [CouncilID] = ? AND [RoleID] = ?', [councilId, roleId]);
        const ballot = assertNominationsOpen(stored ?? undefined, role.Role, now);
        await this.assertActiveCouncilMember(db, nomineeMemberId, councilId, `nominated for ${role.Role}`);
        const fraternalYear = ballotTermYear(ballot, now);
        const seatNominees = await db.getAllAsync<{ NomineeMemberID: number }>(
          'SELECT [NomineeMemberID] FROM [OfficerNominations] WHERE [CouncilID] = ? AND [OfficeRoleID] = ? AND [FraternalYear] = ?',
          [councilId, roleId, fraternalYear],
        );
        if (seatNominees.some((n) => n.NomineeMemberID === nomineeMemberId)) throw alreadyNominated(role.Role, nomineeMemberId, fraternalYear);
        const served = await db.getAllAsync<{ Role: string }>(
          'SELECT r.[Role] FROM [CouncilLeadershipHistory] h JOIN [Role] r ON r.[id] = h.[RoleID] WHERE h.[MemberID] = ?',
          [nomineeMemberId],
        );
        const eligible = isEligibleNominee(role.Role, served.map((r) => r.Role));
        const res = await db.runAsync(
          `INSERT INTO [OfficerNominations] ([CouncilID], [OfficeRoleID], [NomineeMemberID], [NominatedByMemberID], [NominatedAt], [FraternalYear], [IsEligible])
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [councilId, roleId, nomineeMemberId, actorId, toTimestamp(now), fraternalYear, eligible ? 1 : 0],
        );
        const nomination = (await db.getFirstAsync<OfficerNominations>('SELECT * FROM [OfficerNominations] WHERE [id] = ?', [res.lastInsertRowId]))!;
        result = { nomination, eligible, tally: seatNominees.length + 1 };
      });
      return result;
    },

    recordOfficerAbdication: async (actorId, councilId, memberId, roleId) => {
      const db = await this.ready();
      const now = this.now();
      let result!: Awaited<ReturnType<DataService['elections']['recordOfficerAbdication']>>;
      await db.withTransactionAsync(async () => {
        assertMayRecordAbdication(await this.memberWriteActor(db, actorId), councilId, memberId);
        await this.assertCouncilsExist(db, [councilId]);
        const role = requireRole(await this.allRoles(db), roleId);
        const kind = assertOfficeRole(role);
        const held = await db.getFirstAsync(
          'SELECT 1 FROM [MemberRoles] mr JOIN [Member] m ON m.[id] = mr.[MemberID] WHERE mr.[MemberID] = ? AND mr.[RoleID] = ? AND m.[CouncilID] = ?',
          [memberId, roleId, councilId],
        );
        if (!held) throw roleNotHeld(memberId, role.Role, councilId);
        await this.backfillLeadershipHistory(db, councilId);
        const term = await this.openTerm(db, councilId, memberId, roleId);
        if (term) {
          await db.runAsync("UPDATE [CouncilLeadershipHistory] SET [EndDate] = ?, [ExitReason] = 'Abdicated' WHERE [id] = ?", [toIsoDate(now), term.id]);
        }
        await db.runAsync('DELETE FROM [MemberRoles] WHERE [MemberID] = ? AND [RoleID] = ?', [memberId, roleId]);
        const ballot =
          kind === 'elected'
            ? await this.upsertBallot(db, councilId, roleId, { IsUpForElection: 1, IsMidYearElection: 1, NominationsCloseAt: midYearNominationsCloseAt(now) })
            : null;
        result = {
          history: term ? (await db.getFirstAsync<CouncilLeadershipHistory>('SELECT * FROM [CouncilLeadershipHistory] WHERE [id] = ?', [term.id]))! : null,
          outcome: kind === 'elected' ? 'MidYearElection' : 'AwaitingAppointment',
          ballot,
        };
      });
      return result;
    },

    assignAppointedRole: async (actorId, councilId, roleId, targetMemberId) => {
      const db = await this.ready();
      const now = this.now();
      let term!: CouncilLeadershipHistory;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        await this.assertCouncilsExist(db, [councilId]);
        const rows = await this.electionRows(db, councilId);
        assertMayAppointOfficers(actor, councilId, seatHolderIdByName(rows, GRAND_KNIGHT_ROLE));
        const role = requireRole(rows.roles, roleId);
        assertAppointableRole(role);
        const holder = seatHolderId(rows, roleId);
        if (holder !== null) throw roleOccupied(role.Role, holder);
        await this.assertActiveCouncilMember(db, targetMemberId, councilId, `appointed ${role.Role}`);
        assertOneTrusteeSeat(role, (await this.rolesFor(db, targetMemberId)).map((r) => r.Role), targetMemberId);
        await this.backfillLeadershipHistory(db, councilId);
        await db.runAsync('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) VALUES (?, ?)', [roleId, targetMemberId]);
        const id = await this.insertTerm(db, councilId, targetMemberId, roleId, fraternalYearOf(now), toIsoDate(now), actorId);
        term = (await db.getFirstAsync<CouncilLeadershipHistory>('SELECT * FROM [CouncilLeadershipHistory] WHERE [id] = ?', [id]))!;
      });
      return term;
    },

    concludeFraternalYear: async (actorId, councilId, newGrandKnightId) => {
      const db = await this.ready();
      const now = this.now();
      let result!: Awaited<ReturnType<DataService['elections']['concludeFraternalYear']>>;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        await this.assertCouncilsExist(db, [councilId]);
        assertMayConcludeFraternalYear(actor, councilId, seatHolderIdByName(await this.electionRows(db, councilId), GRAND_KNIGHT_ROLE));
        await this.assertActiveCouncilMember(db, newGrandKnightId, councilId, 'seated as Grand Knight');
        await this.backfillLeadershipHistory(db, councilId);
        const rows = await this.electionRows(db, councilId);
        const plan = planConclusionFromSeats(buildOfficerSeats(councilId, rows), newGrandKnightId);
        const fraternalYear = electionTermYear(now);
        await this.applySeatTransitions(db, councilId, rows, plan.transitions, fraternalYear, toIsoDate(now));
        const reset = await db.runAsync('DELETE FROM [CouncilElectionBallot] WHERE [CouncilID] = ?', [councilId]);
        result = conclusionResult(plan, rows.roles, fraternalYear, reset.changes);
      });
      return result;
    },
  };

  private allRoles(db: SQLite.SQLiteDatabase): Promise<Role[]> {
    return db.getAllAsync<Role>('SELECT * FROM [Role] ORDER BY [id]');
  }

  /** Everything the election views read for one council (elections.ts ElectionRows). */
  private async electionRows(db: SQLite.SQLiteDatabase, councilId: number): Promise<ElectionRows> {
    return {
      roles: await this.allRoles(db),
      members: await db.getAllAsync<ElectionRows['members'][number]>('SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member]'),
      holdings: await db.getAllAsync<{ RoleID: number; MemberID: number }>(
        'SELECT mr.[RoleID], mr.[MemberID] FROM [MemberRoles] mr JOIN [Member] m ON m.[id] = mr.[MemberID] WHERE m.[CouncilID] = ?',
        [councilId],
      ),
      history: await db.getAllAsync<CouncilLeadershipHistory>('SELECT * FROM [CouncilLeadershipHistory] WHERE [CouncilID] = ? ORDER BY [id]', [councilId]),
      ballots: await db.getAllAsync<CouncilElectionBallot>('SELECT * FROM [CouncilElectionBallot] WHERE [CouncilID] = ? ORDER BY [RoleID]', [councilId]),
      nominations: await db.getAllAsync<OfficerNominations>('SELECT * FROM [OfficerNominations] WHERE [CouncilID] = ? ORDER BY [id]', [councilId]),
    };
  }

  /** Opens a history row for every Active office holder of the council who has none (planHistoryBackfill). */
  private async backfillLeadershipHistory(db: SQLite.SQLiteDatabase, councilId: number): Promise<void> {
    const active = await db.getAllAsync<{ id: number }>(`SELECT m.[id] FROM [Member] m WHERE ${ACTIVE_MEMBER_FILTER}`, [councilId]);
    const plan = planHistoryBackfill(councilId, await this.electionRows(db, councilId), new Set(active.map((m) => m.id)), this.now());
    for (const t of plan) await this.insertTerm(db, councilId, t.MemberID, t.RoleID, t.FraternalYear, t.StartDate, null);
  }

  private async insertTerm(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    memberId: number,
    roleId: number,
    fraternalYear: string,
    startDate: string,
    appointedById: number | null,
  ): Promise<number> {
    const res = await db.runAsync(
      `INSERT INTO [CouncilLeadershipHistory] ([CouncilID], [MemberID], [RoleID], [FraternalYear], [StartDate], [AppointedByID])
       VALUES (?, ?, ?, ?, ?, ?)`,
      [councilId, memberId, roleId, fraternalYear, startDate, appointedById],
    );
    return res.lastInsertRowId;
  }

  /** The open history row of a member's seat. */
  private openTerm(db: SQLite.SQLiteDatabase, councilId: number, memberId: number, roleId: number): Promise<{ id: number } | null> {
    return db.getFirstAsync<{ id: number }>(
      'SELECT [id] FROM [CouncilLeadershipHistory] WHERE [CouncilID] = ? AND [MemberID] = ? AND [RoleID] = ? AND [EndDate] IS NULL',
      [councilId, memberId, roleId],
    );
  }

  private async upsertBallot(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    roleId: number,
    fields: Partial<Pick<CouncilElectionBallot, 'IsUpForElection' | 'IsMidYearElection' | 'NominationsCloseAt'>>,
  ): Promise<CouncilElectionBallot> {
    const columns = Object.keys(fields) as (keyof typeof fields)[];
    const values = columns.map((c) => fields[c] ?? null);
    await db.runAsync(
      `INSERT INTO [CouncilElectionBallot] ([CouncilID], [RoleID], ${columns.map((c) => `[${c}]`).join(', ')})
       VALUES (?, ?, ${marks(columns.length)})
       ON CONFLICT ([CouncilID], [RoleID]) DO UPDATE SET ${columns.map((c) => `[${c}] = excluded.[${c}]`).join(', ')}`,
      [councilId, roleId, ...values],
    );
    return (await db.getFirstAsync<CouncilElectionBallot>('SELECT * FROM [CouncilElectionBallot] WHERE [CouncilID] = ? AND [RoleID] = ?', [councilId, roleId]))!;
  }

  /** NOT_ACTIVE_COUNCIL_MEMBER unless `memberId` is an Active member of the council. */
  private async assertActiveCouncilMember(db: SQLite.SQLiteDatabase, memberId: number, councilId: number, purpose: string): Promise<void> {
    const m = await db.getFirstAsync<{ id: number; CouncilID: number; active: number }>(
      `SELECT m.[id], m.[CouncilID], (st.[Status] = 'Active') AS active FROM [Member] m
         LEFT JOIN [MemberStatus] st ON st.[id] = m.[StatusID]
        WHERE m.[id] = ?`,
      [memberId],
    );
    assertActiveCouncilMember(m, m?.active === 1, councilId, purpose);
  }

  /**
   * Carries out a conclusion plan: every departing holder's term closes 'TermConcluded' and their role goes; then every
   * arriving holder gets the role and a term in `fraternalYear`. A renewal (same member) closes and reopens the term.
   */
  private async applySeatTransitions(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    rows: ElectionRows,
    transitions: readonly SeatTransition[],
    fraternalYear: string,
    today: string,
  ): Promise<void> {
    const roleId = (name: string) => rows.roles.find((r) => r.Role === name)!.id;
    for (const t of transitions) {
      if (t.from === null) continue;
      await db.runAsync(
        `UPDATE [CouncilLeadershipHistory] SET [EndDate] = ?, [ExitReason] = 'TermConcluded'
          WHERE [CouncilID] = ? AND [MemberID] = ? AND [RoleID] = ? AND [EndDate] IS NULL`,
        [today, councilId, t.from, roleId(t.roleName)],
      );
      if (t.from !== t.to) await db.runAsync('DELETE FROM [MemberRoles] WHERE [MemberID] = ? AND [RoleID] = ?', [t.from, roleId(t.roleName)]);
    }
    for (const t of transitions) {
      if (t.to === null) continue;
      if (t.from !== t.to) await db.runAsync('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) VALUES (?, ?)', [roleId(t.roleName), t.to]);
      await this.insertTerm(db, councilId, t.to, roleId(t.roleName), fraternalYear, today, null);
    }
  }

  // ---- charitable giving (Sprint 5V) ----------------------------------------

  charities: DataService['charities'] = {
    searchGlobalRegistry: async (actorId, filters) => {
      const search = cleanCharitySearchFilters(filters);
      const db = await this.ready();
      await this.requireMember(db, actorId);
      // The indexed filters narrow the rows here; the shared search applies the rest, so both drivers answer alike.
      const where: string[] = [];
      const params: string[] = [];
      if (search.state !== null) {
        where.push('[State] = ?');
        params.push(search.state);
      }
      if (search.ein !== null) {
        where.push('[EIN] = ?');
        params.push(search.ein);
      }
      const rows = await db.getAllAsync<GlobalCharityRegistry>(
        `SELECT * FROM [GlobalCharityRegistry]${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`,
        params,
      );
      return searchCharityRegistry(rows, search);
    },

    listSuggestedLocal: async (actorId, councilId, stateCode) => {
      const state = normalizeStateCode(stateCode, 'State code');
      const db = await this.ready();
      assertMayProposeCharityGift(await this.memberWriteActor(db, actorId), councilId, `see the charity suggestions of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      const rows = await db.getAllAsync<GlobalCharityRegistry>(
        `SELECT * FROM [GlobalCharityRegistry]
          WHERE [State] = ? AND [id] NOT IN (SELECT [CharityID] FROM [CouncilCharityLink] WHERE [CouncilID] = ?)`,
        [state, councilId],
      );
      return suggestLocalCharities(rows, state, []);
    },

    connectCouncilToCharity: async (actorId, councilId, charityId) => {
      const db = await this.ready();
      let link: CouncilCharityLink | null = null;
      await db.withTransactionAsync(async () => {
        assertMayConnectCouncilCharity(await this.memberWriteActor(db, actorId), councilId, `connect council ${councilId} to a charity`);
        await this.assertCouncilsExist(db, [councilId]);
        await this.requireCharity(db, charityId);
        link = await this.linkCharity(db, councilId, charityId);
      });
      return link!;
    },

    proposeDonation: async (actorId, councilId, data) => {
      const clean = cleanCharityProposal(data);
      const db = await this.ready();
      let proposalId = 0;
      await db.withTransactionAsync(async () => {
        assertMayProposeCharityGift(await this.memberWriteActor(db, actorId), councilId, `propose gifts for council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        const charity = clean.ExistingCharityID === null ? null : await this.requireCharity(db, clean.ExistingCharityID);
        const res = await db.runAsync(
          `INSERT INTO [CharityDonationProposal] ([CouncilID], [SubmitterMemberID], [ProposedCharityName], [ProposedAmount], [ExistingCharityID], [Status])
           VALUES (?, ?, ?, ?, ?, 'Pending')`,
          [councilId, actorId, clean.ProposedCharityName ?? charity!.Name, clean.ProposedAmount, clean.ExistingCharityID],
        );
        proposalId = res.lastInsertRowId;
      });
      return (await this.requireCharityProposal(db, proposalId))!;
    },

    addGlobalCharity: async (actorId, globalCharityData) => {
      const clean = cleanGlobalCharity(globalCharityData);
      const db = await this.ready();
      let charityId = 0;
      await db.withTransactionAsync(async () => {
        assertMayAddGlobalCharity(await this.memberWriteActor(db, actorId));
        const existing = findRegisteredCharity(await this.charityCandidates(db, clean), clean);
        if (existing) throw charityAlreadyRegistered(existing);
        charityId = await this.insertCharity(db, clean);
      });
      return this.requireCharity(db, charityId);
    },

    hydrateAndDisburse: async (actorId, councilId, proposalId, checkDetails, globalCharityData) => {
      const check = cleanCharityCheck(checkDetails);
      const incoming = globalCharityData === undefined ? null : cleanGlobalCharity(globalCharityData);
      assertOneCharitySource(check, incoming !== null);
      const db = await this.ready();
      let charityId = 0;
      let disbursementId = 0;
      let charityRegistered = false;
      await db.withTransactionAsync(async () => {
        assertMayDisburseCharity(await this.memberWriteActor(db, actorId), councilId, `record charity checks for council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        const proposal = await db.getFirstAsync<CharityDonationProposal>(
          'SELECT * FROM [CharityDonationProposal] WHERE [id] = ? AND [CouncilID] = ?',
          [proposalId, councilId],
        );
        if (!proposal) throw charityProposalNotFound(proposalId);
        assertProposalPending(proposal, 'be paid');
        if (check.MeetingMinutesID !== null) {
          const meeting = await db.getFirstAsync<Meeting>('SELECT [id], [CouncilID] FROM [Meeting] WHERE [id] = ?', [check.MeetingMinutesID]);
          assertMinutesMeetingInCouncil(meeting, check.MeetingMinutesID, councilId);
        }
        assertCheckNumberUnused(check.CheckNumber, councilId, await this.councilCheckNumbers(db, councilId));

        if (incoming) {
          const existing = findRegisteredCharity(await this.charityCandidates(db, incoming), incoming);
          if (existing) {
            charityId = existing.id;
            // Column names come from CHARITY_FILLABLE_COLUMNS only.
            const fills = Object.entries(charityBlankFills(existing, incoming));
            if (fills.length) {
              await db.runAsync(`UPDATE [GlobalCharityRegistry] SET ${fills.map(([c]) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
                ...fills.map(([, v]) => v as string | number),
                charityId,
              ]);
            }
          } else {
            charityId = await this.insertCharity(db, incoming);
            charityRegistered = true;
          }
        } else if (check.CharityID !== null) {
          charityId = (await this.requireCharity(db, check.CharityID)).id;
        } else if (proposal.ExistingCharityID != null) {
          charityId = (await this.requireCharity(db, proposal.ExistingCharityID)).id;
        } else {
          throw noCharityToPay(proposalId);
        }

        await this.linkCharity(db, councilId, charityId);
        const res = await db.runAsync(
          `INSERT INTO [CharitableDisbursementLedger] ([CouncilID], [CharityID], [Amount], [CheckNumber], [DisbursedByID], [PayoutDate], [Notes], [ProposalID])
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [councilId, charityId, check.Amount ?? proposal.ProposedAmount, check.CheckNumber, actorId, check.PayoutDate, check.Notes, proposalId],
        );
        disbursementId = res.lastInsertRowId;
        await db.runAsync("UPDATE [CharityDonationProposal] SET [Status] = 'Approved', [ExistingCharityID] = ?, [MeetingMinutesID] = ? WHERE [id] = ?", [
          charityId,
          check.MeetingMinutesID ?? proposal.MeetingMinutesID ?? null,
          proposalId,
        ]);
      });
      return {
        charity: await this.requireCharity(db, charityId),
        charityRegistered,
        link: (await db.getFirstAsync<CouncilCharityLink>('SELECT * FROM [CouncilCharityLink] WHERE [CouncilID] = ? AND [CharityID] = ?', [
          councilId,
          charityId,
        ]))!,
        proposal: (await this.requireCharityProposal(db, proposalId))!,
        disbursement: (await db.getFirstAsync<CharitableDisbursementLedger>('SELECT * FROM [CharitableDisbursementLedger] WHERE [id] = ?', [
          disbursementId,
        ]))!,
      };
    },

    listMyProposals: async (actorId) => {
      const db = await this.ready();
      await this.requireMember(db, actorId);
      return this.charityProposalDetails(db, '[SubmitterMemberID] = ?', [actorId], 'newest');
    },

    listCouncilProposals: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayReviewCharityProposals(await this.memberWriteActor(db, actorId), councilId, `review the charity proposals of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return this.charityProposalDetails(db, '[CouncilID] = ?', [councilId], 'queue');
    },

    listCouncilLedger: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayReviewCharityProposals(await this.memberWriteActor(db, actorId), councilId, `read the charity ledger of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return buildCouncilCharityLedger(
        await db.getAllAsync<CouncilCharityLink>('SELECT * FROM [CouncilCharityLink] WHERE [CouncilID] = ?', [councilId]),
        await db.getAllAsync<GlobalCharityRegistry>(
          'SELECT * FROM [GlobalCharityRegistry] WHERE [id] IN (SELECT [CharityID] FROM [CouncilCharityLink] WHERE [CouncilID] = ?)',
          [councilId],
        ),
        await db.getAllAsync<CharitableDisbursementLedger>('SELECT * FROM [CharitableDisbursementLedger] WHERE [CouncilID] = ?', [councilId]),
      );
    },

    rejectProposal: async (actorId, proposalId, reason) => {
      const clean = cleanRejectionReason(reason);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const proposal = await this.requireCharityProposal(db, proposalId);
        if (!proposal) throw charityProposalNotFound(proposalId);
        assertMayReviewCharityProposals(actor, proposal.CouncilID, `reject charity proposal ${proposalId}`);
        assertProposalPending(proposal, 'be rejected');
        await db.runAsync("UPDATE [CharityDonationProposal] SET [Status] = 'Rejected', [RejectionReason] = ? WHERE [id] = ?", [clean, proposalId]);
      });
      return (await this.charityProposalDetails(db, '[id] = ?', [proposalId], 'newest'))[0];
    },

    listCouncilRelationshipTypes: async (councilId) => {
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      return this.relationshipTypes(db, councilId);
    },

    listCouncilMissionAreas: async (councilId) => {
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      return db.getAllAsync<CouncilMissionArea>('SELECT * FROM [CouncilMissionArea] WHERE [CouncilID] = ? ORDER BY [MissionAreaName], [id]', [councilId]);
    },

    listApprovedFundingQueue: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayAuditCouncilExpenses(await this.memberWriteActor(db, actorId), councilId, `read the charitable funding queue of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return db.getAllAsync<CharitableRequest>(
        "SELECT * FROM [CharitableRequest] WHERE [CouncilID] = ? AND [VoteStatus] = 'Approved' AND [PaymentOrderId] IS NULL ORDER BY [id]",
        [councilId],
      );
    },

    listCharitableRequestsQueue: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayVetCharitableRequests(await this.memberWriteActor(db, actorId), councilId, `read the charitable request queue of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return this.charitableRequestDetails(db, '[CouncilID] = ?', [councilId]);
    },

    listMyCharitableRequests: async (actorId) => {
      const db = await this.ready();
      await this.requireMember(db, actorId);
      return (await this.charitableRequestDetails(db, '[ShepherdMemberID] = ?', [actorId])).sort((a, b) => b.request.id - a.request.id);
    },

    submitCharitableRequest: async (actorId, requestData) => {
      const clean = cleanCharitableRequest(requestData);
      const db = await this.ready();
      let requestId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        assertMayProposeCharityGift(actor, actor.councilId, 'submit a charitable request');
        assertCouncilRelationshipType(clean.RelationshipTypeID, await this.relationshipTypes(db, actor.councilId), actor.councilId);
        assertCouncilMissionArea(
          clean.MissionAreaID,
          await db.getAllAsync<CouncilMissionArea>('SELECT * FROM [CouncilMissionArea] WHERE [CouncilID] = ?', [actor.councilId]),
          actor.councilId,
        );
        const columns = [...CHARITABLE_REQUEST_FORM_COLUMNS, 'CouncilID', 'ShepherdMemberID', 'RequestStatus', 'SubmittedAt', 'VoteStatus', 'AmountApproved'];
        const result = await db.runAsync(
          `INSERT INTO [CharitableRequest] (${columns.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(columns.length)})`,
          [
            ...CHARITABLE_REQUEST_FORM_COLUMNS.map((c) => (clean[c] ?? null) as Bind),
            actor.councilId,
            actorId,
            'Submitted',
            toTimestamp(this.now()),
            'Pending',
            0,
          ],
        );
        requestId = result.lastInsertRowId;
      });
      return (await this.charitableRequestDetails(db, '[id] = ?', [requestId]))[0];
    },

    triageRequestStatus: async (actorId, requestId, vettingData) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const request = await db.getFirstAsync<CharitableRequest>('SELECT * FROM [CharitableRequest] WHERE [id] = ?', [requestId]);
        if (!request) throw charitableRequestNotFound(requestId);
        assertMayVetCharitableRequests(actor, request.CouncilID, `vet charitable request ${requestId}`);
        assertIndependentVetter(actor, request);
        const changes = planCharitableTriage(request, actorId, mayOverrideVettingClaim(actor, request.CouncilID), vettingData, this.now());
        if (changes.TargetBudgetLineID != null) {
          const line = await db.getFirstAsync<CouncilBudgetForecast>('SELECT * FROM [CouncilBudgetForecast] WHERE [id] = ?', [changes.TargetBudgetLineID]);
          assertCouncilBudgetLine(changes.TargetBudgetLineID, line, request.CouncilID);
        }
        const columns = CHARITABLE_TRIAGE_COLUMNS.filter((c) => c in changes);
        if (columns.length === 0) return;
        await db.runAsync(`UPDATE [CharitableRequest] SET ${columns.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
          ...columns.map((c) => (changes[c] ?? null) as Bind),
          requestId,
        ]);
      });
      return (await this.charitableRequestDetails(db, '[id] = ?', [requestId]))[0];
    },

    routeRequestToNextEligibleAgenda: async (actorId, requestId) => {
      const db = await this.ready();
      let motionId = 0;
      let meetingId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const request = await db.getFirstAsync<CharitableRequest>('SELECT * FROM [CharitableRequest] WHERE [id] = ?', [requestId]);
        if (!request) throw charitableRequestNotFound(requestId);
        const councilId = request.CouncilID;
        assertMayVetCharitableRequests(actor, councilId, `put charitable request ${requestId} on a meeting agenda`);
        assertIndependentVetter(actor, request);
        const alreadyRouted = await db.getFirstAsync(
          `SELECT [id] FROM [ProposedMotion] WHERE [SourceType] = 'CharitableRequest' AND [SourceRecordID] = ? AND [VoteResult] = 'Pending'`,
          [requestId],
        );
        assertRoutableRequest(request, alreadyRouted !== null);
        const types = await db.getAllAsync<{ id: number; TypeName: string }>('SELECT [id], [TypeName] FROM [CouncilMeetingType] WHERE [CouncilID] = ?', [councilId]);
        const monthlyTypeIds = types.filter((t) => isMonthlyCouncilMeetingType(t.TypeName)).map((t) => t.id);
        const monthly = await selectIn<Meeting>(
          db,
          (m) => `SELECT * FROM [Meeting] WHERE [CouncilID] = ${Number(councilId)} AND [MeetingTypeID] IN (${m})`,
          monthlyTypeIds,
        );
        const today = toIsoDate(this.now());
        const meeting = nextEligibleAgendaMeeting(monthly, today);
        if (!meeting) throw noEligibleAgendaMeeting(requestId, councilId, today);
        meetingId = meeting.id;
        const res = await db.runAsync(
          `INSERT INTO [ProposedMotion] ([CouncilID], [TargetMeetingID], [SourceType], [SourceRecordID], [MotionText], [PresenterMemberID],
                                         [AllocatedMinutes], [VoteResult])
           VALUES (?, ?, 'CharitableRequest', ?, ?, ?, ?, 'Pending')`,
          [councilId, meeting.id, requestId, charitableMotionText(request), request.ShepherdMemberID, PROPOSED_MOTION_DEFAULT_MINUTES],
        );
        motionId = res.lastInsertRowId;
      });
      return {
        motion: (await db.getFirstAsync<ProposedMotion>('SELECT * FROM [ProposedMotion] WHERE [id] = ?', [motionId]))!,
        meeting: (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]))!,
      };
    },
  };

  budget: DataService['budget'] = {
    listAnnualForecast: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const db = await this.ready();
      assertMayViewBudgetForecast(await this.memberWriteActor(db, actorId), councilId, `read the budget forecast of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return this.annualForecast(db, councilId, year);
    },

    updateLineItemBudget: async (actorId, budgetLineItemId, proposedAmount, notes, options = {}) => {
      const changes = cleanBudgetLineUpdate(proposedAmount, notes);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const line = await this.requireBudgetLine(db, budgetLineItemId);
        assertMayManageBudgetForecast(actor, line.CouncilID, `change budget line ${budgetLineItemId}`);
        assertBudgetYearNotApproved(line.FraternalYear, await this.budgetLines(db, line.CouncilID, line.FraternalYear));
        assertBudgetYearWritable(line.FraternalYear, this.now(), actor, options);
        const category = assertCouncilBudgetCategory(options.budgetCategoryId, await this.budgetCategories(db, line.CouncilID), line.CouncilID);
        // Only these fixed column names are ever interpolated.
        // Sprint 6D: the row moves through BUDGET_LINE_WORKFLOW; a lump sum that no longer equals quantity x unit cost clears the unit cost.
        const sets: [string, Bind][] = [
          ['ProposedBudgetAmount', changes.ProposedBudgetAmount],
          ['BudgetStatus', nextBudgetLineStatus(line, 'propose')],
          ['unit_cost', unitCostAfterLumpSum(line, changes.ProposedBudgetAmount)],
        ];
        if (changes.Notes !== undefined) sets.push(['Notes', changes.Notes]);
        if (category !== undefined) sets.push(['BudgetCategoryID', category]);
        await db.runAsync(`UPDATE [CouncilBudgetForecast] SET ${sets.map(([c]) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
          ...sets.map(([, v]) => v),
          budgetLineItemId,
        ]);
      });
      return this.requireBudgetLine(db, budgetLineItemId);
    },

    setLineQuantityAndUnitCost: async (actorId, budgetLineItemId, quantity, unitCost, options = {}) => {
      const changes = cleanLineQuantityAndUnitCost(quantity, unitCost);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const line = await this.requireBudgetLine(db, budgetLineItemId);
        assertMayManageBudgetForecast(actor, line.CouncilID, `change budget line ${budgetLineItemId}`);
        assertBudgetYearNotApproved(line.FraternalYear, await this.budgetLines(db, line.CouncilID, line.FraternalYear));
        assertBudgetYearWritable(line.FraternalYear, this.now(), actor, options);
        await db.runAsync(
          'UPDATE [CouncilBudgetForecast] SET [quantity] = ?, [unit_cost] = ?, [ProposedBudgetAmount] = ?, [BudgetStatus] = ? WHERE [id] = ?',
          [changes.quantity, changes.unit_cost, changes.ProposedBudgetAmount, nextBudgetLineStatus(line, 'propose'), budgetLineItemId],
        );
      });
      return this.requireBudgetLine(db, budgetLineItemId);
    },

    amendApprovedLine: async (actorId, budgetLineItemId, amendment, options = {}) => {
      const db = await this.ready();
      let lineId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const line = await this.requireBudgetLine(db, budgetLineItemId);
        assertMayApproveBudget(actor, line.CouncilID, `amend the ${line.FraternalYear} budget of council ${line.CouncilID}`);
        assertBudgetLineAmendable(line, budgetLineVersions(await this.allBudgetLines(db, line.CouncilID), line), this.now(), actor, options);
        // The approved row is an immutable snapshot: the amendment is a new row with the next budget_version.
        const v = planBudgetAmendment(line, amendment);
        const res = await db.runAsync(
          `INSERT INTO [CouncilBudgetForecast] ([CouncilID], [FraternalYear], [CategoryType], [ReferenceSourceID], [LineItemName], [PrePopulatedAmount], [ApprovedBudgetAmount], [Notes], [BudgetCategoryID], [ProposedBudgetAmount], [BudgetStatus], [quantity], [unit_cost], [budget_version])
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            v.CouncilID,
            v.FraternalYear,
            v.CategoryType,
            v.ReferenceSourceID ?? null,
            v.LineItemName,
            v.PrePopulatedAmount,
            v.ApprovedBudgetAmount,
            v.Notes ?? null,
            v.BudgetCategoryID ?? null,
            v.ProposedBudgetAmount,
            v.BudgetStatus,
            v.quantity,
            v.unit_cost,
            v.budget_version,
          ],
        );
        lineId = res.lastInsertRowId;
      });
      return this.requireBudgetLine(db, lineId);
    },

    listLineVersions: async (actorId, budgetLineItemId) => {
      const db = await this.ready();
      const actor = await this.memberWriteActor(db, actorId);
      const line = await this.requireBudgetLine(db, budgetLineItemId);
      assertMayViewBudgetForecast(actor, line.CouncilID, `read the budget forecast of council ${line.CouncilID}`);
      const versions = budgetLineVersions(await this.allBudgetLines(db, line.CouncilID), line);
      return { current: versions[versions.length - 1], versions };
    },

    addCustomBudgetLine: async (actorId, councilId, data, options = {}) => {
      const clean = cleanCustomBudgetLine(data);
      const db = await this.ready();
      let lineId = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        assertMayManageBudgetForecast(actor, councilId, `add budget lines for council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        assertBudgetYearNotApproved(clean.FraternalYear, await this.budgetLines(db, councilId, clean.FraternalYear));
        assertBudgetYearWritable(clean.FraternalYear, this.now(), actor, options);
        assertCouncilBudgetCategory(clean.BudgetCategoryID, await this.budgetCategories(db, councilId), councilId);
        const existing = findOperationalBudgetLine(await this.budgetLines(db, councilId, clean.FraternalYear), clean.LineItemName);
        if (existing) throw budgetLineExists(existing);
        const res = await db.runAsync(
          `INSERT INTO [CouncilBudgetForecast] ([CouncilID], [FraternalYear], [CategoryType], [ReferenceSourceID], [LineItemName], [PrePopulatedAmount], [ProposedBudgetAmount], [ApprovedBudgetAmount], [BudgetStatus], [Notes], [BudgetCategoryID])
           VALUES (?, ?, 'Operational', NULL, ?, 0, ?, 0, 'Proposed', ?, ?)`,
          [councilId, clean.FraternalYear, clean.LineItemName, clean.ProposedBudgetAmount, clean.Notes, clean.BudgetCategoryID],
        );
        lineId = res.lastInsertRowId;
      });
      return this.requireBudgetLine(db, lineId);
    },

    prePopulateNextYear: async (actorId, councilId, targetFraternalYear, options = {}) => {
      const target = assertFraternalYear(targetFraternalYear, 'Target fraternal year');
      const source = previousFraternalYear(target);
      const { fromDate, toDate } = fraternalYearBounds(source);
      const db = await this.ready();
      let created = 0;
      let refreshed = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        assertMayManageBudgetForecast(actor, councilId, `pre-populate the budget of council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        assertBudgetYearNotApproved(target, await this.budgetLines(db, councilId, target));
        assertBudgetYearWritable(target, this.now(), actor, options);
        const annualEvents = await db.getAllAsync<{ id: number; EventName: string }>(
          `SELECT [id], [EventName] FROM [Event]
            WHERE [IsAnnual] = 1 AND [StartDate] BETWEEN ? AND ?
              AND [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)`,
          [fromDate, toDate, councilId],
        );
        // The council's own spending sheets: 'Approved' and 'Reimbursed', as reports.monthlySummary counts them.
        const spending = `r.[CouncilID] = ? AND r.[Status] IN (${marks(EXPENSE_SPEND_STATUSES.length)})`;
        const eventExpenses = annualEvents.length
          ? await db.getAllAsync<{ EventID: number; Amount: number }>(
              `SELECT r.[LinkedEventID] AS EventID, li.[Amount] FROM [ExpenseLineItem] li
                 JOIN [ExpenseReport] r ON r.[id] = li.[ExpenseReportID]
                WHERE ${spending} AND r.[LinkedEventID] IN (${marks(annualEvents.length)})`,
              [councilId, ...EXPENSE_SPEND_STATUSES, ...annualEvents.map((e) => e.id)],
            )
          : [];
        const annualCharityChecks = await db.getAllAsync<{ CharityID: number; Name: string; Amount: number }>(
          `SELECT d.[CharityID], c.[Name], d.[Amount] FROM [CharitableDisbursementLedger] d
             JOIN [GlobalCharityRegistry] c ON c.[id] = d.[CharityID]
            WHERE d.[CouncilID] = ? AND c.[IsAnnual] = 1 AND d.[PayoutDate] BETWEEN ? AND ?`,
          [councilId, fromDate, toDate],
        );
        const meetings = await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM [Meeting] WHERE [CouncilID] = ? AND [Date] BETWEEN ? AND ?',
          [councilId, fromDate, toDate],
        );
        const meetingExpenses = await db.getAllAsync<{ Amount: number }>(
          `SELECT li.[Amount] FROM [ExpenseLineItem] li
             JOIN [ExpenseReport] r ON r.[id] = li.[ExpenseReportID]
             JOIN [Meeting] m ON m.[id] = r.[LinkedMeetingID]
            WHERE ${spending} AND m.[CouncilID] = ? AND m.[Date] BETWEEN ? AND ?`,
          [councilId, ...EXPENSE_SPEND_STATUSES, councilId, fromDate, toDate],
        );
        const seeds = planBudgetPrePopulation({
          annualEvents,
          eventExpenses,
          annualCharityChecks,
          meetingCount: meetings?.n ?? 0,
          meetingExpenses,
          priorLines: currentBudgetLines(
            await db.getAllAsync<CouncilBudgetForecast>(
              'SELECT * FROM [CouncilBudgetForecast] WHERE [CouncilID] = ? AND [FraternalYear] = ? ORDER BY [id]',
              [councilId, source],
            ),
          ),
        });
        const plan = mergeBudgetSeeds(await this.budgetLines(db, councilId, target), seeds);
        for (const line of plan.updates) {
          await db.runAsync('UPDATE [CouncilBudgetForecast] SET [LineItemName] = ?, [PrePopulatedAmount] = ? WHERE [id] = ?', [
            line.LineItemName,
            line.PrePopulatedAmount,
            line.id,
          ]);
        }
        for (const seed of plan.inserts) {
          await db.runAsync(
            `INSERT INTO [CouncilBudgetForecast] ([CouncilID], [FraternalYear], [CategoryType], [ReferenceSourceID], [LineItemName], [PrePopulatedAmount], [ProposedBudgetAmount], [ApprovedBudgetAmount], [BudgetStatus], [BudgetCategoryID])
             VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'Draft', ?)`,
            [councilId, target, seed.CategoryType, seed.ReferenceSourceID, seed.LineItemName, seed.PrePopulatedAmount, seed.BudgetCategoryID],
          );
        }
        created = plan.inserts.length;
        refreshed = plan.updates.length;
      });
      return {
        fraternalYear: target,
        sourceFraternalYear: source,
        created,
        refreshed,
        lines: sortBudgetLines(await this.budgetLines(db, councilId, target)),
      };
    },

    approveAndFinalizeEntireBudget: async (actorId, councilId, fraternalYear, options = {}) => {
      const year = assertFraternalYear(fraternalYear);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        assertMayApproveBudget(actor, councilId, `approve the ${year} budget of council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        const lines = await this.budgetLines(db, councilId, year);
        assertBudgetYearApprovable(year, lines, this.now(), actor, options);
        for (const line of planBudgetApproval(lines)) {
          await db.runAsync('UPDATE [CouncilBudgetForecast] SET [ApprovedBudgetAmount] = ?, [BudgetStatus] = ? WHERE [id] = ?', [
            line.ApprovedBudgetAmount,
            line.BudgetStatus,
            line.id,
          ]);
        }
      });
      return this.annualForecast(db, councilId, year);
    },

    getBudgetProgress: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const db = await this.ready();
      assertMayReviewBudgetPerformance(await this.memberWriteActor(db, actorId), councilId, `review the budget progress of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return this.budgetYearPerformance(db, councilId, year, budgetProgressThrough(year, this.now()));
    },

    getPriorYearBaselines: async (actorId, councilId, fraternalYear) => {
      const year = assertFraternalYear(fraternalYear);
      const db = await this.ready();
      assertMayViewBudgetForecast(await this.memberWriteActor(db, actorId), councilId, `read the budget baselines of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      const prior = previousFraternalYear(year);
      return buildPriorYearBaselines({
        councilId,
        fraternalYear: year,
        lines: await this.budgetLines(db, councilId, year),
        priorLines: await this.budgetLines(db, councilId, prior),
        priorSpend: await this.budgetYearSpend(db, councilId, prior, fraternalYearBounds(prior).toDate),
      });
    },

    getHistoricalKPIs: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayReviewBudgetPerformance(await this.memberWriteActor(db, actorId), councilId, `review the budget history of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      const today = this.now();
      const budgeted = await db.getAllAsync<{ FraternalYear: string }>('SELECT DISTINCT [FraternalYear] FROM [CouncilBudgetForecast] WHERE [CouncilID] = ?', [
        councilId,
      ]);
      const years: BudgetYearPerformance[] = [];
      for (const y of completedFraternalYears(budgeted.map((r) => r.FraternalYear), today)) {
        years.push(await this.budgetYearPerformance(db, councilId, y, fraternalYearBounds(y).toDate));
      }
      return summarizeBudgetHistory(councilId, years, today);
    },

    getConcludedPerformance: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayReviewBudgetPerformance(await this.memberWriteActor(db, actorId), councilId, `review the concluded budget performance of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      const today = this.now();
      const year = currentFraternalYear(today);
      const events = await db.getAllAsync<{
        id: number;
        EventName: string;
        StartDate: string;
        EndDate: string;
        IsAnnual: number;
      }>(
        `SELECT [id], [EventName], [StartDate], [EndDate], [IsAnnual] FROM [Event]
          WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)`,
        [councilId],
      );
      const expenses = await db.getAllAsync<{ EventID: number | null; MeetingID: number | null; Amount: number }>(
        `SELECT r.[LinkedEventID] AS EventID, r.[LinkedMeetingID] AS MeetingID, li.[Amount] FROM [ExpenseLineItem] li
           JOIN [ExpenseReport] r ON r.[id] = li.[ExpenseReportID]
          WHERE r.[CouncilID] = ? AND r.[Status] IN (${marks(EXPENSE_SPEND_STATUSES.length)})`,
        [councilId, ...EXPENSE_SPEND_STATUSES],
      );
      const meetings = await db.getAllAsync<{ id: number; Date: string; EndDate: string | null }>(
        'SELECT [id], [Date], [EndDate] FROM [Meeting] WHERE [CouncilID] = ?',
        [councilId],
      );
      return buildConcludedBudgetPerformance({
        councilId,
        fraternalYear: year,
        today: toIsoDate(today),
        // Every year's forecast lines: event budgets (and the benchmarks') come from the approved Event lines (Sprint 6C),
        // the latest budget_version of each (Sprint 6D).
        rows: { events, expenses, meetings, lines: currentBudgetLines(await this.allBudgetLines(db, councilId)) },
      });
    },
  };

  /** budget.listAnnualForecast's answer for the council's year. */
  private async annualForecast(db: SQLite.SQLiteDatabase, councilId: number, year: string): Promise<AnnualBudgetForecast> {
    const lines = await this.budgetLines(db, councilId, year);
    return {
      councilId,
      fraternalYear: year,
      window: budgetWindowOf(year, this.now()),
      status: budgetStatusOf(lines),
      categories: await this.budgetCategories(db, councilId),
      lines: sortBudgetLines(lines),
    };
  }

  /**
   * The council's year against its spend from July 1 through `throughDate`, counted as reports.monthlySummary counts
   * it: events starting in the period, line items dated in it on 'Approved' and 'Reimbursed' sheets, charity checks
   * paid in it.
   */
  private async budgetYearPerformance(db: SQLite.SQLiteDatabase, councilId: number, year: string, throughDate: string): Promise<BudgetYearPerformance> {
    return buildBudgetYearPerformance({
      councilId,
      fraternalYear: year,
      lines: await this.budgetLines(db, councilId, year),
      categories: await this.budgetCategories(db, councilId),
      throughDate,
      spend: await this.budgetYearSpend(db, councilId, year, throughDate),
    });
  }

  /**
   * The workflow engine's asset conversion hook, run inside the status change's transaction once the new Status is
   * stored (Sprint 6E): a long-term asset sheet leaving `from` gets its CouncilAssetsInventory row.
   */
  private async convertExpenseToAsset(db: SQLite.SQLiteDatabase, reportId: number, from: unknown): Promise<void> {
    const report = await this.requireExpenseReport(db, reportId);
    const asset = planExpenseAssetConversion({
      from,
      to: report.Status,
      report,
      lineItems: await db.getAllAsync<ExpenseLineItem>('SELECT * FROM [ExpenseLineItem] WHERE [ExpenseReportID] = ?', [reportId]),
      alreadyConverted: (await db.getFirstAsync('SELECT [id] FROM [CouncilAssetsInventory] WHERE [original_expense_id] = ?', [reportId])) != null,
    });
    if (!asset) return;
    await db.runAsync(
      `INSERT INTO [CouncilAssetsInventory] ([council_id], [asset_name], [purchase_date], [cost_basis], [original_expense_id], [current_status], [notes])
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [asset.council_id, asset.asset_name, asset.purchase_date, asset.cost_basis, asset.original_expense_id ?? null, asset.current_status, asset.notes ?? null],
    );
  }

  /**
   * The catch-all hook on a decided charitable vote (Sprint 6E): an approved request with no TargetBudgetLineID takes
   * the council's 'Miscellaneous Others' line of the vote's fraternal year.
   */
  private async tagCharitableBudgetFallback(db: SQLite.SQLiteDatabase, requestId: number): Promise<void> {
    const request = await db.getFirstAsync<CharitableRequest>('SELECT * FROM [CharitableRequest] WHERE [id] = ?', [requestId]);
    if (!request) return;
    const change = planCharitableBudgetFallback(request, await this.budgetLines(db, request.CouncilID, currentFraternalYear(this.now())));
    if (change) await db.runAsync('UPDATE [CharitableRequest] SET [TargetBudgetLineID] = ? WHERE [id] = ?', [change.TargetBudgetLineID ?? null, requestId]);
  }

  /** The council's spend from the year's July 1 through `throughDate`, as budgetYearPerformance counts it. */
  private async budgetYearSpend(db: SQLite.SQLiteDatabase, councilId: number, year: string, throughDate: string): Promise<BudgetYearSpend> {
    const { fromDate } = fraternalYearBounds(year);
    const expenses = await db.getAllAsync<{ EventID: number | null; EventName: string | null; MeetingID: number | null; Amount: number }>(
      `SELECT r.[LinkedEventID] AS EventID, e.[EventName], r.[LinkedMeetingID] AS MeetingID, li.[Amount] FROM [ExpenseLineItem] li
         JOIN [ExpenseReport] r ON r.[id] = li.[ExpenseReportID]
         LEFT JOIN [Event] e ON e.[id] = r.[LinkedEventID]
        WHERE r.[CouncilID] = ? AND r.[Status] IN (${marks(EXPENSE_SPEND_STATUSES.length)}) AND li.[DateOfExpense] BETWEEN ? AND ?`,
      [councilId, ...EXPENSE_SPEND_STATUSES, fromDate, throughDate],
    );
    // A check that paid a charitable request carries the request's TargetBudgetLineID (Sprint 6E).
    const charityChecks = await db.getAllAsync<{ CharityID: number; Amount: number; BudgetLineID: number | null }>(
      `SELECT d.[CharityID], d.[Amount], (SELECT MIN(r.[TargetBudgetLineID]) FROM [CharitableRequest] r WHERE r.[PaymentOrderId] = d.[id]) AS BudgetLineID
         FROM [CharitableDisbursementLedger] d WHERE d.[CouncilID] = ? AND d.[PayoutDate] BETWEEN ? AND ?`,
      [councilId, fromDate, throughDate],
    );
    return { expenses, charityChecks };
  }

  /** The council's budget categories in id order. */
  private async budgetCategories(db: SQLite.SQLiteDatabase, councilId: number): Promise<CouncilBudgetCategory[]> {
    return db.getAllAsync<CouncilBudgetCategory>('SELECT * FROM [CouncilBudgetCategory] WHERE [CouncilID] = ? ORDER BY [id]', [councilId]);
  }

  /**
   * The council's forecast lines for one fraternal year, unsorted: the latest budget_version of each line (Sprint 6D), so
   * superseded snapshots never enter a figure.
   */
  private async budgetLines(db: SQLite.SQLiteDatabase, councilId: number, fraternalYear: string): Promise<CouncilBudgetForecast[]> {
    return currentBudgetLines(
      await db.getAllAsync<CouncilBudgetForecast>('SELECT * FROM [CouncilBudgetForecast] WHERE [CouncilID] = ? AND [FraternalYear] = ?', [
        councilId,
        fraternalYear,
      ]),
    );
  }

  /** Every forecast row of the council, every year and every budget_version. */
  private allBudgetLines(db: SQLite.SQLiteDatabase, councilId: number): Promise<CouncilBudgetForecast[]> {
    return db.getAllAsync<CouncilBudgetForecast>('SELECT * FROM [CouncilBudgetForecast] WHERE [CouncilID] = ?', [councilId]);
  }

  private async requireBudgetLine(db: SQLite.SQLiteDatabase, budgetLineItemId: number): Promise<CouncilBudgetForecast> {
    const line = await db.getFirstAsync<CouncilBudgetForecast>('SELECT * FROM [CouncilBudgetForecast] WHERE [id] = ?', [budgetLineItemId]);
    if (!line) throw budgetLineNotFound(budgetLineItemId);
    return line;
  }

  private relationshipTypes(db: SQLite.SQLiteDatabase, councilId: number): Promise<CouncilRelationshipType[]> {
    return db.getAllAsync<CouncilRelationshipType>('SELECT * FROM [CouncilRelationshipType] WHERE [CouncilID] = ? ORDER BY [RelationshipName], [id]', [
      councilId,
    ]);
  }

  private async charitableRequestDetails(db: SQLite.SQLiteDatabase, where: string, params: number[]): Promise<CharitableRequestDetail[]> {
    const requests = await db.getAllAsync<CharitableRequest>(`SELECT * FROM [CharitableRequest] WHERE ${where}`, params);
    if (requests.length === 0) return [];
    const memberIds = [...new Set(requests.flatMap((r) => [r.ShepherdMemberID, r.VetterMemberID]).filter((id): id is number => id != null))];
    const typeIds = [...new Set(requests.map((r) => r.RelationshipTypeID).filter((id): id is number => id != null))];
    const areaIds = [...new Set(requests.map((r) => r.MissionAreaID).filter((id): id is number => id != null))];
    const lineIds = [...new Set(requests.map((r) => r.TargetBudgetLineID).filter((id): id is number => id != null))];
    return buildCharitableRequestDetails(
      requests,
      await selectIn<Member>(db, (m) => `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member] WHERE [id] IN (${m})`, memberIds),
      typeIds.length ? await selectIn<CouncilRelationshipType>(db, (m) => `SELECT * FROM [CouncilRelationshipType] WHERE [id] IN (${m})`, typeIds) : [],
      areaIds.length ? await selectIn<CouncilMissionArea>(db, (m) => `SELECT * FROM [CouncilMissionArea] WHERE [id] IN (${m})`, areaIds) : [],
      lineIds.length ? await selectIn<CouncilBudgetForecast>(db, (m) => `SELECT * FROM [CouncilBudgetForecast] WHERE [id] IN (${m})`, lineIds) : [],
    );
  }

  private async charityProposalDetails(
    db: SQLite.SQLiteDatabase,
    where: string,
    params: number[],
    order: 'queue' | 'newest',
  ): Promise<CharityProposalDetail[]> {
    const proposals = await db.getAllAsync<CharityDonationProposal>(`SELECT * FROM [CharityDonationProposal] WHERE ${where}`, params);
    if (proposals.length === 0) return [];
    const ids = proposals.map((p) => p.id);
    const memberIds = [...new Set(proposals.map((p) => p.SubmitterMemberID))];
    const charityIds = [...new Set(proposals.map((p) => p.ExistingCharityID).filter((id): id is number => id != null))];
    return buildCharityProposalDetails(
      proposals,
      await selectIn<Member>(db, (m) => `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member] WHERE [id] IN (${m})`, memberIds),
      charityIds.length ? await selectIn<GlobalCharityRegistry>(db, (m) => `SELECT * FROM [GlobalCharityRegistry] WHERE [id] IN (${m})`, charityIds) : [],
      await selectIn<CharitableDisbursementLedger>(db, (m) => `SELECT * FROM [CharitableDisbursementLedger] WHERE [ProposalID] IN (${m})`, ids),
      order,
    );
  }

  private async requireCharity(db: SQLite.SQLiteDatabase, charityId: number): Promise<GlobalCharityRegistry> {
    const row = await db.getFirstAsync<GlobalCharityRegistry>('SELECT * FROM [GlobalCharityRegistry] WHERE [id] = ?', [charityId]);
    if (!row) throw charityNotFound(charityId);
    return row;
  }

  private async requireCharityProposal(db: SQLite.SQLiteDatabase, proposalId: number): Promise<CharityDonationProposal | null> {
    return db.getFirstAsync<CharityDonationProposal>('SELECT * FROM [CharityDonationProposal] WHERE [id] = ?', [proposalId]);
  }

  /** The registry rows `charity` could duplicate (findRegisteredCharity): the same EIN, or anything in its State. */
  private async charityCandidates(db: SQLite.SQLiteDatabase, charity: CleanGlobalCharity): Promise<GlobalCharityRegistry[]> {
    return db.getAllAsync<GlobalCharityRegistry>('SELECT * FROM [GlobalCharityRegistry] WHERE [EIN] = ? OR [State] = ?', [
      charity.EIN ?? null,
      charity.State,
    ]);
  }

  private async insertCharity(db: SQLite.SQLiteDatabase, clean: CleanGlobalCharity): Promise<number> {
    const res = await db.runAsync(
      `INSERT INTO [GlobalCharityRegistry] (${CHARITY_COLUMNS.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(CHARITY_COLUMNS.length)})`,
      CHARITY_COLUMNS.map((c) => clean[c] ?? null),
    );
    return res.lastInsertRowId;
  }

  /** The council's link to the charity, made now if it does not exist yet. */
  private async linkCharity(db: SQLite.SQLiteDatabase, councilId: number, charityId: number): Promise<CouncilCharityLink> {
    await db.runAsync('INSERT OR IGNORE INTO [CouncilCharityLink] ([CouncilID], [CharityID], [ConnectedAt]) VALUES (?, ?, ?)', [
      councilId,
      charityId,
      toTimestamp(this.now()),
    ]);
    return (await db.getFirstAsync<CouncilCharityLink>('SELECT * FROM [CouncilCharityLink] WHERE [CouncilID] = ? AND [CharityID] = ?', [
      councilId,
      charityId,
    ]))!;
  }

  /** Every check number the council has written: expense and charity checks come out of one checkbook. */
  private async councilCheckNumbers(db: SQLite.SQLiteDatabase, councilId: number): Promise<{ CheckNumber: string }[]> {
    return db.getAllAsync<{ CheckNumber: string }>(
      `SELECT [CheckNumber] FROM [ExpenseDisbursement] WHERE [CouncilID] = ?
       UNION ALL
       SELECT [CheckNumber] FROM [CharitableDisbursementLedger] WHERE [CouncilID] = ?`,
      [councilId, councilId],
    );
  }

  finance: DataService['finance'] = {
    listChartOfAccounts: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayReadGeneralLedger(await this.memberWriteActor(db, actorId), councilId, `read the chart of accounts of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return buildChartOfAccounts(councilId, await this.glAccounts(db, councilId), await this.journalEntries(db, councilId));
    },

    logDoubleEntryTransaction: async (actorId, linesData) => {
      const lines = cleanJournalLines(linesData, this.now());
      const db = await this.ready();
      let ids: number[] = [];
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const named = await selectIn<GLAccount>(db, (m) => `SELECT * FROM [GLAccount] WHERE [id] IN (${m})`, [...new Set(lines.map((l) => l.GLAccountID))]);
        const councilId = journalCouncilOf(lines, named);
        assertMayPostGeneralLedger(actor, councilId, `post to the general ledger of council ${councilId}`);
        for (const line of lines) {
          const eventId = line.LinkedEventID;
          const event = eventId === null ? null : await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Event] WHERE [id] = ?', [eventId]);
          assertJournalLinks(
            line,
            councilId,
            event ? await this.councilIdsOf(db, event.id) : null,
            line.LinkedMeetingID === null
              ? null
              : await db.getFirstAsync<Pick<Meeting, 'CouncilID'>>('SELECT [CouncilID] FROM [Meeting] WHERE [id] = ?', [line.LinkedMeetingID]),
          );
        }
        ids = await this.insertJournalLines(db, councilId, lines);
      });
      return this.journalEntriesById(db, ids);
    },

    transferAssetFunds: async (actorId, sourceAccountId, targetAccountId, amount, options = {}) => {
      const db = await this.ready();
      let ids: number[] = [];
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const source = await this.glAccount(db, sourceAccountId);
        const target = await this.glAccount(db, targetAccountId);
        if (source) assertMayPostGeneralLedger(actor, source.CouncilID, `transfer funds in council ${source.CouncilID}`);
        const sourceBalance = source
          ? accountBalance(
              source,
              await db.getAllAsync<JournalEntry>('SELECT * FROM [JournalEntry] WHERE [GLAccountID] = ?', [source.id]),
            )
          : 0;
        const plan = planAssetTransfer(source, target, amount, sourceBalance, this.now(), options);
        ids = await this.insertJournalLines(db, plan.councilId, plan.lines);
      });
      return this.journalEntriesById(db, ids);
    },

    getLatestBalanceSheet: async (actorId, councilId) => {
      const db = await this.ready();
      assertMayReadGeneralLedger(await this.memberWriteActor(db, actorId), councilId, `read the balance sheet of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return buildBalanceSheet(councilId, await this.glAccounts(db, councilId), await this.journalEntries(db, councilId), this.now());
    },

    getAccountLedger: async (actorId, glAccountId) => {
      const db = await this.ready();
      const actor = await this.memberWriteActor(db, actorId);
      const account = await this.glAccount(db, glAccountId);
      if (!account) throw glAccountNotFound(glAccountId);
      assertMayReadGeneralLedger(actor, account.CouncilID, `read the ledger of account ${glAccountId}`);
      const entries = await this.journalEntries(db, account.CouncilID);
      const linked = [...new Set(entries.map((e) => e.LinkedEventID).filter((id): id is number => id != null))];
      const events = await selectIn<{ id: number; EventName: string }>(db, (m) => `SELECT [id], [EventName] FROM [Event] WHERE [id] IN (${m})`, linked);
      return buildAccountLedger(account, await this.glAccounts(db, account.CouncilID), entries, new Map(events.map((e) => [e.id, e.EventName])));
    },

    listLedgerTransactions: async (actorId, councilId, options = {}) => {
      const db = await this.ready();
      assertMayReadGeneralLedger(await this.memberWriteActor(db, actorId), councilId, `read the postings of council ${councilId}`);
      await this.assertCouncilsExist(db, [councilId]);
      return summarizeLedgerTransactions(await this.journalEntries(db, councilId), options.limit);
    },

    uploadBankStatementReconciliation: async (actorId, csvFileData, options = {}) => {
      const rows = parseBankStatementCsv(csvFileData);
      const db = await this.ready();
      let result: BankReconciliationResult | null = null;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const councilId = options.councilId ?? actor.councilId;
        assertMayPostGeneralLedger(actor, councilId, `reconcile the bank statements of council ${councilId}`);
        await this.assertCouncilsExist(db, [councilId]);
        const bankIds = reconcilableAccountIds(await this.glAccounts(db, councilId), options.glAccountId);
        const candidates = (
          await db.getAllAsync<JournalEntry>('SELECT * FROM [JournalEntry] WHERE [CouncilID] = ? AND [IsBankReconciled] = 0 ORDER BY [id]', [councilId])
        ).filter((e) => bankIds.has(e.GLAccountID));
        const { matched, unmatched } = matchBankStatement(rows, candidates);
        const reconciledEntryIds = matched.map((m) => m.journalEntryId).sort((a, b) => a - b);
        for (const id of reconciledEntryIds) await db.runAsync('UPDATE [JournalEntry] SET [IsBankReconciled] = 1 WHERE [id] = ?', [id]);
        result = { councilId, glAccountId: options.glAccountId ?? null, statementRows: rows.length, matched, unmatched, reconciledEntryIds };
      });
      return result!;
    },
  };

  private glAccounts(db: SQLite.SQLiteDatabase, councilId: number): Promise<GLAccount[]> {
    return db.getAllAsync<GLAccount>('SELECT * FROM [GLAccount] WHERE [CouncilID] = ? ORDER BY [id]', [councilId]);
  }

  private glAccount(db: SQLite.SQLiteDatabase, accountId: number): Promise<GLAccount | null> {
    return db.getFirstAsync<GLAccount>('SELECT * FROM [GLAccount] WHERE [id] = ?', [accountId]);
  }

  private journalEntries(db: SQLite.SQLiteDatabase, councilId: number): Promise<JournalEntry[]> {
    return db.getAllAsync<JournalEntry>('SELECT * FROM [JournalEntry] WHERE [CouncilID] = ? ORDER BY [id]', [councilId]);
  }

  /** The stored lines with these ids, in the order given. */
  private async journalEntriesById(db: SQLite.SQLiteDatabase, ids: readonly number[]): Promise<JournalEntry[]> {
    const rows = new Map((await selectIn<JournalEntry>(db, (m) => `SELECT * FROM [JournalEntry] WHERE [id] IN (${m})`, ids)).map((r) => [r.id, r]));
    return ids.map((id) => rows.get(id)!);
  }

  /**
   * Stores a balanced transaction's lines for the council, unreconciled and sharing one new TransactionID; resolves to
   * their ids in the order given.
   */
  private async insertJournalLines(db: SQLite.SQLiteDatabase, councilId: number, lines: readonly CleanJournalLine[]): Promise<number[]> {
    const transactionId = formatTransactionId(await Crypto.getRandomBytesAsync(16));
    const ids: number[] = [];
    for (const l of lines) {
      const res = await db.runAsync(
        `INSERT INTO [JournalEntry] ([CouncilID], [GLAccountID], [DateLogged], [Description], [DebitAmount], [CreditAmount], [LinkedEventID], [LinkedMeetingID], [IsBankReconciled], [CheckNumber], [TransactionID])
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [councilId, l.GLAccountID, l.DateLogged, l.Description, l.DebitAmount, l.CreditAmount, l.LinkedEventID, l.LinkedMeetingID, l.CheckNumber, transactionId],
      );
      ids.push(res.lastInsertRowId);
    }
    return ids;
  }

  feedback: DataService['feedback'] = {
    submit: async (memberId, text) => {
      const clean = cleanFeedbackText(text);
      const db = await this.ready();
      await this.requireMember(db, memberId);
      const res = await db.runAsync('INSERT INTO [SystemFeedback] ([MemberID], [SubmittedAt], [FeedbackText]) VALUES (?, ?, ?)', [
        memberId,
        toTimestamp(this.now()),
        clean,
      ]);
      return (await db.getFirstAsync<SystemFeedback>('SELECT * FROM [SystemFeedback] WHERE [id] = ?', [res.lastInsertRowId]))!;
    },

    listInbox: async (actorId) => {
      const db = await this.ready();
      assertMayReadFeedback(await this.memberWriteActor(db, actorId));
      const [feedback, members, councils] = await Promise.all([
        db.getAllAsync<SystemFeedback>('SELECT * FROM [SystemFeedback]'),
        db.getAllAsync<Member>(
          `SELECT m.[id], m.[CouncilID], m.[MemberFirstName], m.[MemberLastName], m.[Phone], m.[Email]
             FROM [Member] m WHERE m.[id] IN (SELECT [MemberID] FROM [SystemFeedback])`,
        ),
        db.getAllAsync<Council>('SELECT [id], [CouncilNumber] FROM [Council]'),
      ]);
      return buildFeedbackInbox(feedback, members, councils);
    },
  };

  messages: DataService['messages'] = {
    getPage: async (threadId, options?: MessagePageOptions) => {
      const db = await this.ready();
      const limit = options?.limit ?? 20;
      if (options?.before === undefined) {
        return db.getAllAsync<Message>(
          'SELECT * FROM [Messages] WHERE [ThreadID] = ? ORDER BY [CreatedAt] DESC, [id] DESC LIMIT ?',
          [threadId, limit],
        );
      }
      return db.getAllAsync<Message>(
        `SELECT * FROM [Messages] WHERE [ThreadID] = ? AND [CreatedAt] < ?
          ORDER BY [CreatedAt] DESC, [id] DESC LIMIT ?`,
        [threadId, options.before, limit],
      );
    },

    createReadReceiptStubs: async (messageId, listId) => {
      const db = await this.ready();
      const res = await db.runAsync(
        `INSERT INTO [ReadReceipts] ([MessageID], [MemberID], [ReadAt], [IsFlagged])
         SELECT ?, [MemberID], NULL, 0 FROM [DistributionListMembers] WHERE [ListID] = ?`,
        [messageId, listId],
      );
      return res.changes;
    },

    listThreads: async (memberId) => {
      const db = await this.ready();
      const ids = await db.getAllAsync<{ ThreadID: number }>(
        `SELECT [ThreadID] FROM [Messages] WHERE [SenderID] = ? AND [ThreadID] IS NOT NULL
         UNION
         SELECT m.[ThreadID] FROM [ReadReceipts] r JOIN [Messages] m ON m.[id] = r.[MessageID]
          WHERE r.[MemberID] = ? AND m.[ThreadID] IS NOT NULL`,
        [memberId, memberId],
      );
      return buildThreadSummaries(memberId, await this.loadMessaging(db, ids.map((r) => r.ThreadID)));
    },

    listThread: async (threadId, memberId) => {
      const db = await this.ready();
      const rows = await this.loadMessaging(db, [threadId]);
      assertThreadParticipant(rows, threadId, memberId);
      return buildThreadMessages(memberId, threadId, rows);
    },

    send: async (input) => {
      const text = assertText(input.text, 'Message', 10_000);
      const db = await this.ready();
      let messageId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, input.senderId);
        let threadId: number;
        let recipients: number[];
        if (input.threadId !== undefined) {
          const rows = await this.loadMessaging(db, [input.threadId]);
          assertThreadParticipant(rows, input.threadId, input.senderId);
          threadId = input.threadId;
          recipients = participantIds(threadId, rows.messages, rows.receipts).filter((id) => id !== input.senderId);
        } else {
          const grouped = await this.distributionRecipients(db, input.councilId, input.distributionGroups);
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
          for (const id of recipients) await this.requireMember(db, id);
          const created = await db.runAsync(
            'INSERT INTO [ChatThreads] ([CouncilID], [IsGroupChat], [CreatedAt]) VALUES (?, ?, ?)',
            [input.councilId, recipients.length > 1 ? 1 : 0, toTimestamp(this.now())],
          );
          threadId = created.lastInsertRowId;
        }
        await this.assertParent(db, threadId, input.parentMessageId);

        const stamp = toTimestamp(this.now());
        if (input.draftId !== undefined) {
          const draft = await this.requireDraft(db, input.draftId, input.senderId, threadId);
          await db.runAsync(
            'UPDATE [Messages] SET [MessageText] = ?, [IsDraft] = 0, [CreatedAt] = ?, [ParentMessageID] = ? WHERE [id] = ?',
            [text, stamp, input.parentMessageId !== undefined ? input.parentMessageId : (draft.ParentMessageID ?? null), draft.id],
          );
          messageId = draft.id;
        } else {
          const ins = await db.runAsync(
            `INSERT INTO [Messages] ([ThreadID], [SenderID], [ParentMessageID], [MessageText], [IsDraft], [CreatedAt])
             VALUES (?, ?, ?, ?, 0, ?)`,
            [threadId, input.senderId, input.parentMessageId ?? null, text, stamp],
          );
          messageId = ins.lastInsertRowId;
        }
        for (const memberId of recipients) {
          await db.runAsync('INSERT INTO [ReadReceipts] ([MessageID], [MemberID], [ReadAt], [IsFlagged]) VALUES (?, ?, NULL, 0)', [
            messageId,
            memberId,
          ]);
        }
      });
      return (await db.getFirstAsync<Message>('SELECT * FROM [Messages] WHERE [id] = ?', [messageId]))!;
    },

    saveDraft: async (input) => {
      const text = assertText(input.text, 'Draft', 10_000);
      const db = await this.ready();
      let messageId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, input.senderId);
        assertThreadParticipant(await this.loadMessaging(db, [input.threadId]), input.threadId, input.senderId);
        await this.assertParent(db, input.threadId, input.parentMessageId);
        const stamp = toTimestamp(this.now());
        if (input.draftId !== undefined) {
          const draft = await this.requireDraft(db, input.draftId, input.senderId, input.threadId);
          await db.runAsync('UPDATE [Messages] SET [MessageText] = ?, [CreatedAt] = ?, [ParentMessageID] = ? WHERE [id] = ?', [
            text,
            stamp,
            input.parentMessageId !== undefined ? input.parentMessageId : (draft.ParentMessageID ?? null),
            draft.id,
          ]);
          messageId = draft.id;
        } else {
          const ins = await db.runAsync(
            `INSERT INTO [Messages] ([ThreadID], [SenderID], [ParentMessageID], [MessageText], [IsDraft], [CreatedAt])
             VALUES (?, ?, ?, ?, 1, ?)`,
            [input.threadId, input.senderId, input.parentMessageId ?? null, text, stamp],
          );
          messageId = ins.lastInsertRowId;
        }
      });
      return (await db.getFirstAsync<Message>('SELECT * FROM [Messages] WHERE [id] = ?', [messageId]))!;
    },

    deleteDraft: async (messageId, memberId) => {
      const db = await this.ready();
      const res = await db.runAsync('DELETE FROM [Messages] WHERE [id] = ? AND [IsDraft] = 1 AND [SenderID] = ?', [
        messageId,
        memberId,
      ]);
      if (res.changes === 0) {
        throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft with id ${messageId}.`, {
          messageId,
          memberId,
        });
      }
    },

    setRead: async (messageId, memberId, read) => {
      const db = await this.ready();
      const res = await db.runAsync('UPDATE [ReadReceipts] SET [ReadAt] = ? WHERE [MessageID] = ? AND [MemberID] = ?', [
        read ? toTimestamp(this.now()) : null,
        messageId,
        memberId,
      ]);
      if (res.changes === 0) {
        throw new BusinessRuleError(
          'MESSAGE_NOT_FOUND',
          `Member ${memberId} did not receive message ${messageId}, so it has no read state for them.`,
          { messageId, memberId },
        );
      }
      return (await db.getFirstAsync<ReadReceipt>('SELECT * FROM [ReadReceipts] WHERE [MessageID] = ? AND [MemberID] = ?', [
        messageId,
        memberId,
      ]))!;
    },
  };

  /** Raw rows for the given threads, ready for the pure builders in @kofc/shared. */
  private async loadMessaging(db: SQLite.SQLiteDatabase, threadIds: readonly number[]): Promise<MessagingRows> {
    const threads = await selectIn<ChatThread>(db, (m) => `SELECT * FROM [ChatThreads] WHERE [id] IN (${m})`, threadIds);
    const messages = await selectIn<Message>(db, (m) => `SELECT * FROM [Messages] WHERE [ThreadID] IN (${m})`, threadIds);
    const messageIds = messages.map((m) => m.id);
    const receipts = await selectIn<ReadReceipt>(db, (m) => `SELECT * FROM [ReadReceipts] WHERE [MessageID] IN (${m})`, messageIds);
    const attachments = await selectIn<MessageAttachment>(
      db,
      (m) => `SELECT * FROM [MessageAttachments] WHERE [MessageID] IN (${m}) ORDER BY [id]`,
      messageIds,
    );
    const members = await db.getAllAsync<{ id: number; MemberFirstName: string; MemberLastName: string }>(
      'SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member]',
    );
    return {
      threads,
      messages,
      receipts,
      attachments,
      names: new Map(members.map((m) => [m.id, `${m.MemberFirstName} ${m.MemberLastName}`])),
    };
  }

  private async assertParent(db: SQLite.SQLiteDatabase, threadId: number, parentId: number | null | undefined): Promise<void> {
    if (parentId == null) return;
    if (!(await db.getFirstAsync('SELECT [id] FROM [Messages] WHERE [id] = ? AND [ThreadID] = ?', [parentId, threadId]))) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Thread ${threadId} has no message ${parentId} to reply to.`, {
        threadId,
        parentId,
      });
    }
  }

  private async requireDraft(db: SQLite.SQLiteDatabase, messageId: number, memberId: number, threadId: number): Promise<Message> {
    const draft = await db.getFirstAsync<Message>(
      'SELECT * FROM [Messages] WHERE [id] = ? AND [IsDraft] = 1 AND [SenderID] = ? AND [ThreadID] = ?',
      [messageId, memberId, threadId],
    );
    if (!draft) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft ${messageId} in thread ${threadId}.`, {
        messageId,
        memberId,
        threadId,
      });
    }
    return draft;
  }

  /** Enables every donation method for the test council (Seed.sql has no CouncilDonationMethod rows). */
  private async seedDevDonationMethods(db: SQLite.SQLiteDatabase): Promise<void> {
    for (const { method, qrUrl } of DEV_COUNCIL_DONATION_METHODS) {
      const res = await db.runAsync(
        `INSERT INTO [CouncilDonationMethod] ([CouncilID], [DonationMethodID], [DonationMethodURL])
         SELECT c.[id], dm.[id], ? FROM [Council] c, [DonationMethod] dm WHERE c.[CouncilNumber] = ? AND dm.[DonationMethod] = ?`,
        [qrUrl, DEV_COUNCIL_NUMBER, method],
      );
      if (res.changes !== 1) throw new Error(`Seed.sql is missing Council ${DEV_COUNCIL_NUMBER} or donation method ${method}`);
    }
  }

  /** Extra councils, shared and historical events, no-show history and message threads for the new screens. */
  private async seedDevExtras(db: SQLite.SQLiteDatabase): Promise<void> {
    const idOf = async (sql: string, param: string | number) => (await db.getFirstAsync<{ id: number }>(sql, [param]))?.id as number;
    const insertCouncil = async (c: { CouncilNumber: number; CouncilName: string; State: string; Phone: string }) =>
      (
        await db.runAsync('INSERT INTO [Council] ([CouncilNumber], [CouncilName], [State], [Phone]) VALUES (?, ?, ?, ?)', [
          c.CouncilNumber,
          c.CouncilName,
          c.State,
          c.Phone,
        ])
      ).lastInsertRowId;

    const own = await idOf('SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?', DEV_COUNCIL_NUMBER);
    const affiliated = await insertCouncil(DEV_AFFILIATED_COUNCIL);
    const unaffiliated = await insertCouncil(DEV_UNAFFILIATED_COUNCIL);
    await db.runAsync('INSERT INTO [AffiliatedCouncils] ([PrimaryCouncilID], [AffiliatedCouncilID]) VALUES (?, ?)', [own, affiliated]);
    const councilIds = { own, affiliated, unaffiliated };

    const memberId = (email: string) => idOf('SELECT [id] FROM [Member] WHERE [Email] = ?', email);
    const ownerId = await memberId('testadmin@kofc.org');
    const categoryId = await idOf('SELECT [id] FROM [Category] WHERE [Category] = ?', 'Service');

    for (const { event, councils, shifts } of buildDevExtraEvents(this.now())) {
      const ev = await db.runAsync(
        `INSERT INTO [Event] ([EventName], [EventDescription], [OwnerID], [StartDate], [EndDate], [Location], [CategoryID])
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [event.EventName, event.EventDescription, ownerId, event.StartDate, event.EndDate, event.Location, categoryId],
      );
      for (const c of councils) {
        await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [ev.lastInsertRowId, councilIds[c]]);
      }
      for (const { shift, signedUp, noShows } of shifts) {
        const sh = await this.insertShiftRow(db, ev.lastInsertRowId, shift);
        await db.runAsync('UPDATE [Shift] SET [NumberVolunteersSignedUp] = ? WHERE [id] = ?', [signedUp.length, sh]);
        for (const email of signedUp) {
          const code = noShows?.[email];
          await db.runAsync(
            'INSERT INTO [EventSignup] ([ShiftID], [MemberID], [NoShow], [NoShowReasonID]) VALUES (?, ?, ?, ?)',
            [
              sh,
              await memberId(email),
              code ? 1 : 0,
              code ? await idOf('SELECT [id] FROM [NoShowReason] WHERE [NoShowReasonCode] = ?', code) : null,
            ],
          );
        }
      }
    }

    const { threads, messages } = buildDevMessaging();
    const stampAt = (hoursAgo: number) => toTimestamp(new Date(this.now().getTime() - hoursAgo * 3_600_000));
    const threadIds = new Map<string, number>();
    const messageIds = new Map<string, number>();
    for (const t of threads) {
      const row = await db.runAsync('INSERT INTO [ChatThreads] ([CouncilID], [IsGroupChat], [CreatedAt]) VALUES (?, ?, ?)', [
        own,
        t.isGroup ? 1 : 0,
        stampAt(72),
      ]);
      threadIds.set(t.key, row.lastInsertRowId);
    }
    for (const m of messages) {
      const thread = threads.find((t) => t.key === m.thread)!;
      const row = await db.runAsync(
        `INSERT INTO [Messages] ([ThreadID], [SenderID], [ParentMessageID], [MessageText], [IsDraft], [CreatedAt])
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          threadIds.get(m.thread)!,
          await memberId(m.sender),
          m.parent ? (messageIds.get(m.parent) ?? null) : null,
          m.text,
          m.draft ? 1 : 0,
          stampAt(m.hoursAgo),
        ],
      );
      messageIds.set(m.key, row.lastInsertRowId);
      if (!m.draft) {
        for (const email of thread.participants.filter((e) => e !== m.sender)) {
          await db.runAsync('INSERT INTO [ReadReceipts] ([MessageID], [MemberID], [ReadAt], [IsFlagged]) VALUES (?, ?, ?, 0)', [
            row.lastInsertRowId,
            await memberId(email),
            m.readBy?.includes(email) ? stampAt(m.hoursAgo - 0.5) : null,
          ]);
        }
      }
      for (const a of m.attachments ?? []) {
        await db.runAsync(
          'INSERT INTO [MessageAttachments] ([MessageID], [Filename], [FileType], [StorageURL], [UploadedAt]) VALUES (?, ?, ?, ?, ?)',
          [row.lastInsertRowId, a.Filename, a.FileType, `placeholder://attachments/${encodeURIComponent(a.Filename)}`, stampAt(m.hoursAgo)],
        );
      }
    }
  }
}
