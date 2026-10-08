// =========================================================================
// GENERATED FILE - DO NOT EDIT.
// Source: Schema.sql + Seed.sql   Generator: scripts/gen-db-assets.mjs
// Regenerate with:  node scripts/gen-db-assets.mjs
// =========================================================================

export type ColumnKind = 'int' | 'text' | 'real' | 'bit' | 'date' | 'time' | 'datetime';

export interface ColumnMeta {
  name: string;
  kind: ColumnKind;
  notNull: boolean;
  identity: boolean;
  default: { kind: 'literal'; value: number | string } | { kind: 'now' } | null;
}

export interface ForeignKeyMeta {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface TableMeta {
  primaryKey: string[];
  columns: ColumnMeta[];
  foreignKeys: ForeignKeyMeta[];
  /** Column sets of the table's CREATE UNIQUE INDEX statements, besides the primary key. */
  uniqueKeys: string[][];
}

export type SeedValue = string | number | null;

export interface SeedTable {
  table: string;
  rows: Record<string, SeedValue>[];
}

/** Every table in Schema.sql, in creation order. */
export const TABLES: Record<string, TableMeta> = {
  "Credentials": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Username",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Password",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "MemberStatus": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Status",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "Degree": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Degree",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "MemberType": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Type",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "Role": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Role",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Officer",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "NoShowReason": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "NoShowReasonCode",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "NoShowReasonDescription",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "Category": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Category",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CategoryDescription",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "LessonsLearnedCategory": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "LessonsLearnedCategory",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "MeetingType": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Type",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Description",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "Council": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilNumber",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CouncilName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "State",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Phone",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Email",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "flag_mobile_elections",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "flag_fundraising_inflow",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "flag_charity_proposals",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "flag_complex_shifts",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "flag_meeting_management",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "BylawsMarkdown",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "BylawsUpdatedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "EmailProvider",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SmtpHost",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SmtpPort",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SmtpUsername",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "tenant_type",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "KOFC"
        }
      },
      {
        "name": "base_dues_rate",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 40
        }
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "AffiliatedCouncils": {
    "primaryKey": [
      "PrimaryCouncilID",
      "AffiliatedCouncilID"
    ],
    "columns": [
      {
        "name": "PrimaryCouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "AffiliatedCouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "Parish": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Name",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StreetAddress1",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StreetAddress2",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "City",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "State",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Phone",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "Pastor": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "FirstName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "LastName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Phone",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Email",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ParishID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "ParishID",
        "refTable": "Parish",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "Meeting": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Meeting Name",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Meeting Description",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Date",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Time Start",
        "kind": "time",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Time End",
        "kind": "time",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Location",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Agenda",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MinutesURL",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MeetingType",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "GoogleDriveMinutesURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "GoogleDriveFlyerURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "OwnerID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsMultiDay",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "MeetingTypeID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "EndDate",
        "kind": "date",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MissionAreaID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "InviteReleaseDate",
        "kind": "date",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ActiveAgendaItemName",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ActiveAgendaItemTimeRemaining",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsLiveInProgress",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "ActiveAgendaItemStartedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "LiveQuorumRosterCount",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ActiveAgendaLineKey",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "MeetingType",
        "refTable": "MeetingType",
        "refColumn": "id"
      },
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "OwnerID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "MeetingTypeID",
        "refTable": "CouncilMeetingType",
        "refColumn": "id"
      },
      {
        "column": "MissionAreaID",
        "refTable": "CouncilMissionArea",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "MeetingInvites": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MeetingID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Attended",
        "kind": "bit",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "ResponseStatus",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "NoResponse"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "MeetingID",
        "refTable": "Meeting",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "Member": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberNumber",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberFirstName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberLastName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Phone",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StreetAddress1",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StreetAddress2",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "City",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "State",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ZipCode",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Email",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DateOfBirth",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StatusID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DegreeID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberTypeID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CredentialID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "WorkingStatusID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ProfilePhotoURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Biography",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ExpoPushToken",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsBudgetDirector",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "DateJoinedCouncil",
        "kind": "date",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "flag_large_text_mode",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "CredentialID",
        "refTable": "Credentials",
        "refColumn": "id"
      },
      {
        "column": "DegreeID",
        "refTable": "Degree",
        "refColumn": "id"
      },
      {
        "column": "MemberTypeID",
        "refTable": "MemberType",
        "refColumn": "id"
      },
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "StatusID",
        "refTable": "MemberStatus",
        "refColumn": "id"
      },
      {
        "column": "WorkingStatusID",
        "refTable": "WorkingStatus",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "MemberRoles": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "RoleID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "RoleID",
        "refTable": "Role",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "Event": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "EventName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "EventDescription",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "OwnerID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StartDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "EndDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Location",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CategoryID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "FundsRaised-Cash",
        "kind": "real",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "FundsRaised-Electronic",
        "kind": "real",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Highlights",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "PlannedNumberAttendees",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ActualNumberAttendees",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "PhotoGalleryURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsAnnual",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "IsMultiDay",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "MissionAreaID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IntakeSessionStatus",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "Inactive"
        }
      },
      {
        "name": "GoogleDriveFlyerFileID",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CategoryID",
        "refTable": "Category",
        "refColumn": "id"
      },
      {
        "column": "OwnerID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "MissionAreaID",
        "refTable": "CouncilMissionArea",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "EventCouncils": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "EventID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "Shift": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ShiftName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ShiftDescription",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ShiftDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StartTime",
        "kind": "time",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "EndTime",
        "kind": "time",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "EventID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MinNumberVolunteers",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "NumberVolunteersSignedUp",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "IsAllHands",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "EventID",
        "refTable": "Event",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "EventSignup": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ShiftID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "NoShow",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "NoShowReasonID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SignupNotes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "ShiftID",
        "refTable": "Shift",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "NoShowReasonID",
        "refTable": "NoShowReason",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "EventTime": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ShiftID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Hours",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ShiftNotes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "ShiftID",
        "refTable": "Shift",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "LessonsLearned": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "EventID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "LeassonsLearnedCategoryID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "LessonsLearnedDescription",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "LeassonsLearnedCategoryID",
        "refTable": "LessonsLearnedCategory",
        "refColumn": "id"
      },
      {
        "column": "EventID",
        "refTable": "Event",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "Activities": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ActivityName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ActivityDescription",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CategoryID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CategoryID",
        "refTable": "Category",
        "refColumn": "id"
      },
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "ActivityTime": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ActivityID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ActivityDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Hours",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ActivityNotes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "ActivityID",
        "refTable": "Activities",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "DistributionLists": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ListName",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "CreatedBy",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "CreatedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "now"
        }
      },
      {
        "name": "IsCouncilWide",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "DistributionListMembers": {
    "primaryKey": [
      "ListID",
      "MemberID"
    ],
    "columns": [
      {
        "name": "ListID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "ListID",
        "refTable": "DistributionLists",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "ChatThreads": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsGroupChat",
        "kind": "bit",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "CreatedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "Messages": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ThreadID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SenderID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ParentMessageID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MessageText",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsDraft",
        "kind": "bit",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "CreatedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "ThreadID",
        "refTable": "ChatThreads",
        "refColumn": "id"
      },
      {
        "column": "SenderID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "ParentMessageID",
        "refTable": "Messages",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "MessageAttachments": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MessageID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Filename",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "FileType",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StorageURL",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "UploadedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "MessageID",
        "refTable": "Messages",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "ReadReceipts": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MessageID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ReadAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsFlagged",
        "kind": "bit",
        "notNull": false,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "MessageID",
        "refTable": "Messages",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "WorkingStatus": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "WorkingStatus",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "Donation": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationMethodID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationTypeID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Donor",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationDesciption",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "EventID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationPhotoURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "RecordedBy",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "EventID",
        "refTable": "Event",
        "refColumn": "id"
      },
      {
        "column": "DonationMethodID",
        "refTable": "DonationMethod",
        "refColumn": "id"
      },
      {
        "column": "DonationTypeID",
        "refTable": "DonationType",
        "refColumn": "id"
      },
      {
        "column": "RecordedBy",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "DonationMethod": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "DonationMethod",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "DonationType": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationType",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "Skill": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "SkillName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "SkillLevel": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "SkillLevel",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "MemberSkill": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "SkillID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SkillLevelID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "SkillID",
        "refTable": "Skill",
        "refColumn": "id"
      },
      {
        "column": "SkillLevelID",
        "refTable": "SkillLevel",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "KOCTrainingClasses": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ClassName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": []
  },
  "MemberTraining": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "TrainingClassID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "YearTaken",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "TrainingClassID",
        "refTable": "KOCTrainingClasses",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CouncilDonationMethod": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationMethodID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DonationMethodURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "DonationMethodID",
        "refTable": "DonationMethod",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "SystemFeedback": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SubmittedAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      },
      {
        "name": "FeedbackText",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "ExpenseDisbursement": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CheckNumber",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "PayoutDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "TotalAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Notes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "ExpenseReport": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SubmitterMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Status",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "LinkedEventID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "LinkedMeetingID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "DisbursementID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "RejectionReason",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "FinancialSecretaryMemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "FinancialSecretaryApprovedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "GrandKnightMemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "GrandKnightApprovedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "is_long_term_asset",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "budget_line_id",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "charity_request_id",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "SubmitterMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "LinkedEventID",
        "refTable": "Event",
        "refColumn": "id"
      },
      {
        "column": "LinkedMeetingID",
        "refTable": "Meeting",
        "refColumn": "id"
      },
      {
        "column": "DisbursementID",
        "refTable": "ExpenseDisbursement",
        "refColumn": "id"
      },
      {
        "column": "FinancialSecretaryMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "GrandKnightMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "budget_line_id",
        "refTable": "CouncilBudgetForecast",
        "refColumn": "id"
      },
      {
        "column": "charity_request_id",
        "refTable": "CharitableRequest",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "ExpenseLineItem": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "ExpenseReportID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DateOfExpense",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Amount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "VendorName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ReceiptPhotoURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ExpenseDescription",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "ExpenseReportID",
        "refTable": "ExpenseReport",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "NotificationLog": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "TargetMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Title",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MessageBody",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Priority",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SentAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      },
      {
        "name": "IsRead",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "TargetMemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "SupremeReportingSync": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "FormType",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SyncDate",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      },
      {
        "name": "SyncedByID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "AlchemerSurveyID",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Status",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "SyncedByID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CouncilElectionBallot": {
    "primaryKey": [
      "CouncilID",
      "RoleID"
    ],
    "columns": [
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "RoleID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "IsUpForElection",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "IsMidYearElection",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "NominationsCloseAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "RoleID",
        "refTable": "Role",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "OfficerNominations": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "OfficeRoleID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "NomineeMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "NominatedByMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "NominatedAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      },
      {
        "name": "FraternalYear",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "IsEligible",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "OfficeRoleID",
        "refTable": "Role",
        "refColumn": "id"
      },
      {
        "column": "NomineeMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "NominatedByMemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "OfficeRoleID",
        "NomineeMemberID",
        "FraternalYear"
      ]
    ]
  },
  "CouncilLeadershipHistory": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "RoleID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "FraternalYear",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "StartDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "EndDate",
        "kind": "date",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ExitReason",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "AppointedByID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "RoleID",
        "refTable": "Role",
        "refColumn": "id"
      },
      {
        "column": "AppointedByID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "GlobalCharityRegistry": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "Name",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Description",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "EIN",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "State",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Phone",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ContactName",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ContactEmail",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Address",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ZipCode",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsCatholic",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "CharityType",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "IsAnnual",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [],
    "uniqueKeys": [
      [
        "EIN"
      ]
    ]
  },
  "CouncilCharityLink": {
    "primaryKey": [
      "CouncilID",
      "CharityID"
    ],
    "columns": [
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CharityID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ConnectedAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "CharityID",
        "refTable": "GlobalCharityRegistry",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CharityDonationProposal": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SubmitterMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ProposedCharityName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ProposedAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ExistingCharityID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Status",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MeetingMinutesID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "RejectionReason",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "SubmitterMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "ExistingCharityID",
        "refTable": "GlobalCharityRegistry",
        "refColumn": "id"
      },
      {
        "column": "MeetingMinutesID",
        "refTable": "Meeting",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CharitableDisbursementLedger": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CharityID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Amount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CheckNumber",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DisbursedByID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "PayoutDate",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Notes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ProposalID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "CharityID",
        "refTable": "GlobalCharityRegistry",
        "refColumn": "id"
      },
      {
        "column": "DisbursedByID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "ProposalID",
        "refTable": "CharityDonationProposal",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CouncilBudgetCategory": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CategoryName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "CategoryName"
      ]
    ]
  },
  "CouncilBudgetForecast": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "FraternalYear",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CategoryType",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ReferenceSourceID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "LineItemName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "PrePopulatedAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "ApprovedBudgetAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "Notes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "BudgetCategoryID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ProposedBudgetAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "BudgetStatus",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "quantity",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "unit_cost",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "budget_version",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "universal_category",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "BudgetCategoryID",
        "refTable": "CouncilBudgetCategory",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "FraternalYear",
        "CategoryType",
        "ReferenceSourceID",
        "LineItemName",
        "budget_version"
      ]
    ]
  },
  "CouncilMeetingType": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "TypeName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "TypeName"
      ]
    ]
  },
  "CouncilAgendaTemplate": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MeetingTypeID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "TemplateText",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "MeetingTypeID",
        "refTable": "CouncilMeetingType",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "MeetingTypeID"
      ]
    ]
  },
  "CouncilRelationshipType": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "RelationshipName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "RelationshipName"
      ]
    ]
  },
  "CouncilMissionArea": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MissionAreaName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "MissionAreaName"
      ]
    ]
  },
  "CharitableRequest": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "OrganizationName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ContactName",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ContactPhone",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ContactEmail",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "AmountRequested",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "RequestStatus",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "Submitted"
        }
      },
      {
        "name": "SubmittedAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      },
      {
        "name": "ShepherdMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "MailingAddress",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "RelationshipTypeID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Is501c3",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "EIN",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Website",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "OrgMission",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsRecurring",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "FundsNeededBy",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SpecificUse",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "TargetBeneficiary",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "AccountabilityPlan",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "RequestTier",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 1
        }
      },
      {
        "name": "VetterMemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "VettingNotes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "VettedDate",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MoverMemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SeconderMemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "VoteStatus",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "Pending"
        }
      },
      {
        "name": "AmountApproved",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "PaymentOrderId",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MissionAreaID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "TargetBudgetLineID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "ShepherdMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "RelationshipTypeID",
        "refTable": "CouncilRelationshipType",
        "refColumn": "id"
      },
      {
        "column": "VetterMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "MoverMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "SeconderMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "PaymentOrderId",
        "refTable": "CharitableDisbursementLedger",
        "refColumn": "id"
      },
      {
        "column": "MissionAreaID",
        "refTable": "CouncilMissionArea",
        "refColumn": "id"
      },
      {
        "column": "TargetBudgetLineID",
        "refTable": "CouncilBudgetForecast",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CouncilCadenceConfig": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MeetingTypeID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CadencePattern",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DefaultStartTime",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DefaultLocation",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DefaultRecipientGroup",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "all_members"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "MeetingTypeID",
        "refTable": "CouncilMeetingType",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "MeetingTypeID"
      ]
    ]
  },
  "ProposedMotion": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "TargetMeetingID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SourceType",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SourceRecordID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MotionText",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "PresenterMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "AllocatedMinutes",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 5
        }
      },
      {
        "name": "VoteResult",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "Pending"
        }
      },
      {
        "name": "BallotOpenedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "TargetMeetingID",
        "refTable": "Meeting",
        "refColumn": "id"
      },
      {
        "column": "PresenterMemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "GLAccount": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "AccountName",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "AccountType",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ParentAccountID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsVirtualGoal",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "TargetGoalAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "ParentAccountID",
        "refTable": "GLAccount",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "CouncilID",
        "AccountName"
      ]
    ]
  },
  "JournalEntry": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "GLAccountID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DateLogged",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "Description",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DebitAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "CreditAmount",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "LinkedEventID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "LinkedMeetingID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "IsBankReconciled",
        "kind": "bit",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "CheckNumber",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "TransactionID",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "GLAccountID",
        "refTable": "GLAccount",
        "refColumn": "id"
      },
      {
        "column": "LinkedEventID",
        "refTable": "Event",
        "refColumn": "id"
      },
      {
        "column": "LinkedMeetingID",
        "refTable": "Meeting",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "LiveAttendance": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MeetingID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CheckedInAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "MeetingID",
        "refTable": "Meeting",
        "refColumn": "id"
      },
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "MeetingID",
        "MemberID"
      ]
    ]
  },
  "BallotVote": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ProposedMotionID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "AnonymousBallotHash",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "VoteSelection",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CastAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "ProposedMotionID",
        "refTable": "ProposedMotion",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "ProposedMotionID",
        "AnonymousBallotHash"
      ]
    ]
  },
  "MeetingAgendaItem": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "MeetingID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SectionKey",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SortOrder",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      },
      {
        "name": "LineMarkdown",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "SpeakerRoleID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SpeakerMemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "SpeakerLabel",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "ProposedMotionID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "LinkedEventID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "LastEditedByMemberID",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "LastEditedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "MeetingID",
        "refTable": "Meeting",
        "refColumn": "id"
      },
      {
        "column": "SpeakerRoleID",
        "refTable": "Role",
        "refColumn": "id"
      },
      {
        "column": "SpeakerMemberID",
        "refTable": "Member",
        "refColumn": "id"
      },
      {
        "column": "ProposedMotionID",
        "refTable": "ProposedMotion",
        "refColumn": "id"
      },
      {
        "column": "LinkedEventID",
        "refTable": "Event",
        "refColumn": "id"
      },
      {
        "column": "LastEditedByMemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "MotionHandTally": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "CouncilID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ProposedMotionID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ApprovedCount",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "DeniedCount",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "RecordedByMemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "RecordedAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "LinkedTransactionID",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "CouncilID",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "ProposedMotionID",
        "refTable": "ProposedMotion",
        "refColumn": "id"
      },
      {
        "column": "RecordedByMemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "ProposedMotionID"
      ]
    ]
  },
  "MemberEnrollmentToken": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "TokenHash",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CreatedAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ExpiresAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ConsumedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "TokenHash"
      ]
    ]
  },
  "PasswordResetToken": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "MemberID",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CodeHash",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "CreatedAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ExpiresAt",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "ConsumedAt",
        "kind": "datetime",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "FailedAttempts",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": 0
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "MemberID",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CouncilCredentialsVault": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "council_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "credential_key",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "credential_value_encrypted",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "updated_at",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "council_id",
        "refTable": "Council",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "council_id",
        "credential_key"
      ]
    ]
  },
  "CouncilAssetsInventory": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "council_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "asset_name",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "purchase_date",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "cost_basis",
        "kind": "real",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "original_expense_id",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "current_status",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "literal",
          "value": "ACTIVE"
        }
      },
      {
        "name": "notes",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "council_id",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "original_expense_id",
        "refTable": "ExpenseReport",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "original_expense_id"
      ]
    ]
  },
  "CharitableRequestThread": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "request_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "thread_type",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "opened_by_member_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "opened_at",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "request_id",
        "refTable": "CharitableRequest",
        "refColumn": "id"
      },
      {
        "column": "opened_by_member_id",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "request_id",
        "thread_type"
      ]
    ]
  },
  "CharitableRequestThreadMessage": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "thread_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "author_member_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "posted_at",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      },
      {
        "name": "message_body",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      }
    ],
    "foreignKeys": [
      {
        "column": "thread_id",
        "refTable": "CharitableRequestThread",
        "refColumn": "id"
      },
      {
        "column": "author_member_id",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": []
  },
  "CouncilHistoryAnnals": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "council_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "fraternal_year",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "establishment_date",
        "kind": "date",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "original_chaplain",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "charter_photo_url",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "collective_accomplishments",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "team_metrics_summary",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "updated_by_member_id",
        "kind": "int",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "updated_at",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "council_id",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "updated_by_member_id",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "council_id",
        "fraternal_year"
      ]
    ]
  },
  "CouncilSpiritualDiary": {
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "kind": "int",
        "notNull": true,
        "identity": true,
        "default": null
      },
      {
        "name": "council_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "user_id",
        "kind": "int",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "entry_date",
        "kind": "date",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "fraternal_year",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "diary_text",
        "kind": "text",
        "notNull": true,
        "identity": false,
        "default": null
      },
      {
        "name": "audio_asset_url",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "created_at",
        "kind": "datetime",
        "notNull": true,
        "identity": false,
        "default": {
          "kind": "now"
        }
      }
    ],
    "foreignKeys": [
      {
        "column": "council_id",
        "refTable": "Council",
        "refColumn": "id"
      },
      {
        "column": "user_id",
        "refTable": "Member",
        "refColumn": "id"
      }
    ],
    "uniqueKeys": [
      [
        "user_id",
        "entry_date"
      ]
    ]
  }
};

/** Seed rows from Seed.sql, in insertion order. */
export const SEED_DATA: readonly SeedTable[] = [
  {
    "table": "Category",
    "rows": [
      {
        "Category": "Fellowship",
        "CategoryDescription": "Social Knights events"
      },
      {
        "Category": "Service",
        "CategoryDescription": "Providing help to parish, parishioners or community"
      },
      {
        "Category": "Faith Building",
        "CategoryDescription": "Events focussed on increasing the faith or Knights and/or parishioners"
      },
      {
        "Category": "Parish Community",
        "CategoryDescription": "Events that involve parishioners in getting to know each other better or contributing to the parish"
      },
      {
        "Category": "Fundraising",
        "CategoryDescription": "Generating income/donations for Knights council or parish"
      },
      {
        "Category": "Evangelization",
        "CategoryDescription": "Promoting Catholic faith to non-Catholics"
      }
    ]
  },
  {
    "table": "Degree",
    "rows": [
      {
        "Degree": "First"
      },
      {
        "Degree": "Second"
      },
      {
        "Degree": "Third"
      },
      {
        "Degree": "Fourth"
      }
    ]
  },
  {
    "table": "Role",
    "rows": [
      {
        "Role": "Grand Knight",
        "Officer": 1
      },
      {
        "Role": "Deputy Grand Knight",
        "Officer": 1
      },
      {
        "Role": "Chancellor",
        "Officer": 1
      },
      {
        "Role": "Recorder",
        "Officer": 1
      },
      {
        "Role": "Financial Secretary",
        "Officer": 1
      },
      {
        "Role": "Treasurer",
        "Officer": 1
      },
      {
        "Role": "Warden",
        "Officer": 1
      },
      {
        "Role": "Advocate",
        "Officer": 1
      },
      {
        "Role": "Inside Guard",
        "Officer": 1
      },
      {
        "Role": "Outside Guard",
        "Officer": 1
      },
      {
        "Role": "Lecturer",
        "Officer": 0
      },
      {
        "Role": "Trustee 1",
        "Officer": 1
      },
      {
        "Role": "Trustee 2",
        "Officer": 1
      },
      {
        "Role": "Trustee 3",
        "Officer": 1
      },
      {
        "Role": "Membership Director",
        "Officer": 0
      },
      {
        "Role": "Community Director",
        "Officer": 0
      },
      {
        "Role": "Program Director",
        "Officer": 0
      },
      {
        "Role": "Family Director",
        "Officer": 0
      },
      {
        "Role": "Chaplain",
        "Officer": 0
      },
      {
        "Role": "Member",
        "Officer": 0
      }
    ]
  },
  {
    "table": "MemberType",
    "rows": [
      {
        "Type": "Super Admin"
      },
      {
        "Type": "Admin"
      },
      {
        "Type": "Member"
      }
    ]
  },
  {
    "table": "MemberStatus",
    "rows": [
      {
        "Status": "Active"
      },
      {
        "Status": "Inactive"
      },
      {
        "Status": "Former"
      },
      {
        "Status": "Deceased"
      }
    ]
  },
  {
    "table": "NoShowReason",
    "rows": [
      {
        "NoShowReasonCode": "A",
        "NoShowReasonDescription": "Something came up"
      },
      {
        "NoShowReasonCode": "B",
        "NoShowReasonDescription": "Went to wrong location"
      },
      {
        "NoShowReasonCode": "C",
        "NoShowReasonDescription": "Had the wrong date"
      },
      {
        "NoShowReasonCode": "D",
        "NoShowReasonDescription": "Had the wrong time"
      },
      {
        "NoShowReasonCode": "E",
        "NoShowReasonDescription": "Forgot"
      }
    ]
  },
  {
    "table": "LessonsLearnedCategory",
    "rows": [
      {
        "LessonsLearnedCategory": "Planning"
      },
      {
        "LessonsLearnedCategory": "Budgeting"
      },
      {
        "LessonsLearnedCategory": "Scheduling"
      },
      {
        "LessonsLearnedCategory": "Marketing"
      },
      {
        "LessonsLearnedCategory": "Execution"
      }
    ]
  },
  {
    "table": "MeetingType",
    "rows": [
      {
        "Type": "Monthly",
        "Description": "Regular monthly meetings"
      },
      {
        "Type": "Officer",
        "Description": "Meeting of all officers"
      },
      {
        "Type": "Community",
        "Description": "Community committee meeting"
      }
    ]
  },
  {
    "table": "Council",
    "rows": [
      {
        "CouncilNumber": 15295,
        "CouncilName": "St. Jude Council",
        "State": "OR",
        "Phone": "503-555-0199",
        "Email": "kofc15295@gmail.com"
      }
    ]
  },
  {
    "table": "Credentials",
    "rows": [
      {
        "Username": "testsuperadmin@kofc.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "testadmin@kofc.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "testmember@kofc.org",
        "Password": "dev-pass-secure-9912"
      }
    ]
  },
  {
    "table": "Member",
    "rows": [
      {
        "CouncilID": 1,
        "MemberNumber": 9900001,
        "MemberFirstName": "Super",
        "MemberLastName": "Admin",
        "Phone": "555-111-2222",
        "StreetAddress1": "123 Global Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "testsuperadmin@kofc.org",
        "DateOfBirth": "1980-01-01",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 1,
        "CredentialID": 1
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900002,
        "MemberFirstName": "Council",
        "MemberLastName": "Admin",
        "Phone": "555-333-4444",
        "StreetAddress1": "456 Local Lane",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97205",
        "Email": "testadmin@kofc.org",
        "DateOfBirth": "1985-05-05",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 2,
        "CredentialID": 2
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900003,
        "MemberFirstName": "Brother",
        "MemberLastName": "Knight",
        "Phone": "555-666-7777",
        "StreetAddress1": "789 Fraternal Rd",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97210",
        "Email": "testmember@kofc.org",
        "DateOfBirth": "1990-10-10",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 3
      }
    ]
  },
  {
    "table": "MemberRoles",
    "rows": [
      {
        "RoleID": 1,
        "MemberID": 1
      },
      {
        "RoleID": 5,
        "MemberID": 2
      },
      {
        "RoleID": 20,
        "MemberID": 3
      }
    ]
  },
  {
    "table": "WorkingStatus",
    "rows": [
      {
        "WorkingStatus": "Student"
      },
      {
        "WorkingStatus": "Full Time"
      },
      {
        "WorkingStatus": "Part Time"
      },
      {
        "WorkingStatus": "Retired"
      },
      {
        "WorkingStatus": "Unemployed"
      }
    ]
  },
  {
    "table": "DonationMethod",
    "rows": [
      {
        "DonationMethod": "Cash"
      },
      {
        "DonationMethod": "Credit Card"
      },
      {
        "DonationMethod": "Venmo"
      },
      {
        "DonationMethod": "Zelle"
      },
      {
        "DonationMethod": "Zeffy"
      },
      {
        "DonationMethod": "Parishsoft"
      },
      {
        "DonationMethod": "Physical Items"
      }
    ]
  },
  {
    "table": "DonationType",
    "rows": [
      {
        "DonationType": "Parking",
        "CouncilID": 1
      },
      {
        "DonationType": "Parish Event",
        "CouncilID": 1
      },
      {
        "DonationType": "Meals",
        "CouncilID": 1
      },
      {
        "DonationType": "Unsolicited",
        "CouncilID": 1
      }
    ]
  },
  {
    "table": "Skill",
    "rows": [
      {
        "SkillName": "Bartending"
      },
      {
        "SkillName": "Plumbing"
      },
      {
        "SkillName": "Electrical"
      },
      {
        "SkillName": "Carpentry"
      },
      {
        "SkillName": "Automotive"
      },
      {
        "SkillName": "Mechanical"
      },
      {
        "SkillName": "Cooking"
      },
      {
        "SkillName": "Baking"
      },
      {
        "SkillName": "Canning"
      },
      {
        "SkillName": "Graphic Arts"
      },
      {
        "SkillName": "Finances"
      },
      {
        "SkillName": "Computer"
      },
      {
        "SkillName": "Marketing"
      },
      {
        "SkillName": "Masonry"
      },
      {
        "SkillName": "Heating/Cooling"
      }
    ]
  },
  {
    "table": "SkillLevel",
    "rows": [
      {
        "SkillLevel": "Novice"
      },
      {
        "SkillLevel": "Beginner"
      },
      {
        "SkillLevel": "Intermediate"
      },
      {
        "SkillLevel": "Senior"
      },
      {
        "SkillLevel": "Expert"
      }
    ]
  },
  {
    "table": "KOCTrainingClasses",
    "rows": [
      {
        "ClassName": "Background Check"
      },
      {
        "ClassName": "Preventing Abuse and Protecting Those We Serve"
      }
    ]
  },
  {
    "table": "CouncilBudgetCategory",
    "rows": [
      {
        "CouncilID": 1,
        "CategoryName": "Father George Wolf Memorial Fund"
      },
      {
        "CouncilID": 1,
        "CategoryName": "Sister Rita Rose Vistica Parish Community Fund"
      },
      {
        "CouncilID": 1,
        "CategoryName": "Cathedral School & Student Support"
      },
      {
        "CouncilID": 1,
        "CategoryName": "Other Donations & Projects"
      },
      {
        "CouncilID": 1,
        "CategoryName": "Council Maintenance & State/Supreme Programs"
      },
      {
        "CouncilID": 1,
        "CategoryName": "Blessed Michael McGivney Fraternal Activities Fund"
      }
    ]
  },
  {
    "table": "CouncilMeetingType",
    "rows": [
      {
        "CouncilID": 1,
        "TypeName": "Monthly"
      },
      {
        "CouncilID": 1,
        "TypeName": "Officer"
      },
      {
        "CouncilID": 1,
        "TypeName": "Committee"
      }
    ]
  },
  {
    "table": "CouncilRelationshipType",
    "rows": [
      {
        "CouncilID": 1,
        "RelationshipName": "Parish Ministry"
      },
      {
        "CouncilID": 1,
        "RelationshipName": "Catholic School"
      },
      {
        "CouncilID": 1,
        "RelationshipName": "Local Nonprofit"
      },
      {
        "CouncilID": 1,
        "RelationshipName": "Member or Family in Need"
      },
      {
        "CouncilID": 1,
        "RelationshipName": "Community Partner"
      },
      {
        "CouncilID": 1,
        "RelationshipName": "State or Supreme Program"
      }
    ]
  },
  {
    "table": "CouncilMissionArea",
    "rows": [
      {
        "CouncilID": 1,
        "MissionAreaName": "Faith"
      },
      {
        "CouncilID": 1,
        "MissionAreaName": "Family"
      },
      {
        "CouncilID": 1,
        "MissionAreaName": "Community"
      },
      {
        "CouncilID": 1,
        "MissionAreaName": "Life"
      }
    ]
  },
  {
    "table": "CouncilCadenceConfig",
    "rows": [
      {
        "CouncilID": 1,
        "MeetingTypeID": 1,
        "CadencePattern": "First Tuesday",
        "DefaultStartTime": "19:30",
        "DefaultLocation": "Parish Hall"
      }
    ]
  },
  {
    "table": "Activities",
    "rows": [
      {
        "ActivityName": "Bedding drive",
        "ActivityDescription": "Collecting blankets, sheets and pillows for families in need",
        "CategoryID": 2,
        "CouncilID": 1
      },
      {
        "ActivityName": "Coats for kids",
        "ActivityDescription": "Collecting and distributing winter coats for local children",
        "CategoryID": 2,
        "CouncilID": 1
      },
      {
        "ActivityName": "Food drive",
        "ActivityDescription": "Collecting and sorting food for the parish pantry",
        "CategoryID": 2,
        "CouncilID": 1
      },
      {
        "ActivityName": "Greeting",
        "ActivityDescription": "Welcoming parishioners at the church doors before Mass",
        "CategoryID": 4,
        "CouncilID": 1
      },
      {
        "ActivityName": "Meal delivery",
        "ActivityDescription": "Preparing and delivering meals to homebound and grieving families",
        "CategoryID": 2,
        "CouncilID": 1
      },
      {
        "ActivityName": "Planning",
        "ActivityDescription": "Council planning and committee work outside scheduled meetings",
        "CategoryID": 1,
        "CouncilID": 1
      },
      {
        "ActivityName": "Poop/Garbage patrol",
        "ActivityDescription": "Picking up litter and pet waste around the parish grounds",
        "CategoryID": 2,
        "CouncilID": 1
      },
      {
        "ActivityName": "Socials",
        "ActivityDescription": "Hosting and staffing council and parish social gatherings",
        "CategoryID": 1,
        "CouncilID": 1
      },
      {
        "ActivityName": "Transporting",
        "ActivityDescription": "Driving parishioners to Mass, appointments and council events",
        "CategoryID": 2,
        "CouncilID": 1
      },
      {
        "ActivityName": "Ultrasound",
        "ActivityDescription": "Supporting the Ultrasound Initiative for local pregnancy centers",
        "CategoryID": 5,
        "CouncilID": 1
      },
      {
        "ActivityName": "Ushering",
        "ActivityDescription": "Ushering and taking up the collection at Mass",
        "CategoryID": 4,
        "CouncilID": 1
      }
    ]
  },
  {
    "table": "GLAccount",
    "rows": [
      {
        "CouncilID": 1,
        "AccountName": "Operating Checking",
        "AccountType": "Asset",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Goal Account #1",
        "AccountType": "Asset",
        "ParentAccountID": 1,
        "IsVirtualGoal": 1,
        "TargetGoalAmount": 4000
      },
      {
        "CouncilID": 1,
        "AccountName": "Goal Account #2",
        "AccountType": "Asset",
        "ParentAccountID": 1,
        "IsVirtualGoal": 1,
        "TargetGoalAmount": 1500
      },
      {
        "CouncilID": 1,
        "AccountName": "General Savings",
        "AccountType": "Asset",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Charity Savings",
        "AccountType": "Asset",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Physical Assets",
        "AccountType": "Asset",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Member Dues Collections",
        "AccountType": "Revenue",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Parking Fundraising",
        "AccountType": "Revenue",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "General Fundraising",
        "AccountType": "Revenue",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "General Donations",
        "AccountType": "Revenue",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Charitable Disbursements",
        "AccountType": "Expense",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Event Operational Costs",
        "AccountType": "Expense",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Council Operational Costs",
        "AccountType": "Expense",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      },
      {
        "CouncilID": 1,
        "AccountName": "Supreme Assessments",
        "AccountType": "Expense",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      }
    ]
  },
  {
    "table": "GLAccount",
    "rows": [
      {
        "CouncilID": 1,
        "AccountName": "Opening Balance Equity",
        "AccountType": "Equity",
        "ParentAccountID": null,
        "IsVirtualGoal": 0,
        "TargetGoalAmount": 0
      }
    ]
  }
];

/** Presentation rows from below Seed.sql's @presentation-data marker, loaded right after SEED_DATA when requested. */
export const PRESENTATION_SEED_DATA: readonly SeedTable[] = [
  {
    "table": "Credentials",
    "rows": [
      {
        "Username": "michael.oconnor@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "james.delgado@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "patrick.nguyen@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "thomas.kowalski@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "robert.fitzgerald@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "anthony.russo@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "daniel.mbeki@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "joseph.hernandez@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "francis.byrne@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "william.schmidt@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "george.alvarez@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "peter.lindqvist@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "matthew.okafor@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "stephen.tran@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "christopher.walsh@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      }
    ]
  },
  {
    "table": "Member",
    "rows": [
      {
        "CouncilID": 1,
        "MemberNumber": 4817263,
        "MemberFirstName": "Michael",
        "MemberLastName": "O'Connor",
        "Phone": "503-555-0142",
        "StreetAddress1": "2215 NE Klickitat St",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97212",
        "Email": "michael.oconnor@kofc15295.org",
        "DateOfBirth": "1968-03-14",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 4,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 5120938,
        "MemberFirstName": "James",
        "MemberLastName": "Delgado",
        "Phone": "503-555-0187",
        "StreetAddress1": "4410 SE Woodstock Blvd",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97206",
        "Email": "james.delgado@kofc15295.org",
        "DateOfBirth": "1975-07-22",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 5,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 5388201,
        "MemberFirstName": "Patrick",
        "MemberLastName": "Nguyen",
        "Phone": "503-555-0123",
        "StreetAddress1": "918 SW Vista Ave",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97205",
        "Email": "patrick.nguyen@kofc15295.org",
        "DateOfBirth": "1982-11-02",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 6,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 4290115,
        "MemberFirstName": "Thomas",
        "MemberLastName": "Kowalski",
        "Phone": "503-555-0164",
        "StreetAddress1": "7336 N Lombard St",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97203",
        "Email": "thomas.kowalski@kofc15295.org",
        "DateOfBirth": "1961-05-09",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 7,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 5602774,
        "MemberFirstName": "Robert",
        "MemberLastName": "Fitzgerald",
        "Phone": "503-555-0118",
        "StreetAddress1": "1507 NE Tillamook St",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97212",
        "Email": "robert.fitzgerald@kofc15295.org",
        "DateOfBirth": "1979-01-27",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 8,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 5741390,
        "MemberFirstName": "Anthony",
        "MemberLastName": "Russo",
        "Phone": "503-555-0171",
        "StreetAddress1": "3620 SE Belmont St",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97214",
        "Email": "anthony.russo@kofc15295.org",
        "DateOfBirth": "1987-09-18",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 9,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 6013456,
        "MemberFirstName": "Daniel",
        "MemberLastName": "Mbeki",
        "Phone": "503-555-0139",
        "StreetAddress1": "5104 NE Sandy Blvd",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97213",
        "Email": "daniel.mbeki@kofc15295.org",
        "DateOfBirth": "1991-04-05",
        "StatusID": 1,
        "DegreeID": 2,
        "MemberTypeID": 3,
        "CredentialID": 10,
        "DateJoinedCouncil": "2025-11-20"
      },
      {
        "CouncilID": 1,
        "MemberNumber": 6128873,
        "MemberFirstName": "Joseph",
        "MemberLastName": "Hernandez",
        "Phone": "503-555-0156",
        "StreetAddress1": "8825 SE Powell Blvd",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97266",
        "Email": "joseph.hernandez@kofc15295.org",
        "DateOfBirth": "1994-12-11",
        "StatusID": 1,
        "DegreeID": 1,
        "MemberTypeID": 3,
        "CredentialID": 11,
        "DateJoinedCouncil": "2026-05-01"
      },
      {
        "CouncilID": 1,
        "MemberNumber": 3987412,
        "MemberFirstName": "Francis",
        "MemberLastName": "Byrne",
        "Phone": "503-555-0102",
        "StreetAddress1": "2830 SW Patton Rd",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "francis.byrne@kofc15295.org",
        "DateOfBirth": "1955-08-30",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 12,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 4105629,
        "MemberFirstName": "William",
        "MemberLastName": "Schmidt",
        "Phone": "503-555-0195",
        "StreetAddress1": "6419 SW Capitol Hwy",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97239",
        "Email": "william.schmidt@kofc15295.org",
        "DateOfBirth": "1958-02-16",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 13,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 4632087,
        "MemberFirstName": "George",
        "MemberLastName": "Alvarez",
        "Phone": "503-555-0148",
        "StreetAddress1": "1122 NE 64th Ave",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97213",
        "Email": "george.alvarez@kofc15295.org",
        "DateOfBirth": "1964-10-04",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 14,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 5519024,
        "MemberFirstName": "Peter",
        "MemberLastName": "Lindqvist",
        "Phone": "503-555-0177",
        "StreetAddress1": "4027 N Williams Ave",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97227",
        "Email": "peter.lindqvist@kofc15295.org",
        "DateOfBirth": "1983-06-21",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 15,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 5876310,
        "MemberFirstName": "Matthew",
        "MemberLastName": "Okafor",
        "Phone": "503-555-0131",
        "StreetAddress1": "2718 SE Division St",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97202",
        "Email": "matthew.okafor@kofc15295.org",
        "DateOfBirth": "1989-03-08",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 16,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 5933847,
        "MemberFirstName": "Stephen",
        "MemberLastName": "Tran",
        "Phone": "503-555-0184",
        "StreetAddress1": "9310 SW Barbur Blvd",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97219",
        "Email": "stephen.tran@kofc15295.org",
        "DateOfBirth": "1986-12-29",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 17,
        "DateJoinedCouncil": null
      },
      {
        "CouncilID": 1,
        "MemberNumber": 6245501,
        "MemberFirstName": "Christopher",
        "MemberLastName": "Walsh",
        "Phone": "503-555-0169",
        "StreetAddress1": "1645 NW Kearney St",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97209",
        "Email": "christopher.walsh@kofc15295.org",
        "DateOfBirth": "1998-07-15",
        "StatusID": 1,
        "DegreeID": 2,
        "MemberTypeID": 3,
        "CredentialID": 18,
        "DateJoinedCouncil": "2026-07-15"
      }
    ]
  },
  {
    "table": "MemberRoles",
    "rows": [
      {
        "RoleID": 2,
        "MemberID": 4
      },
      {
        "RoleID": 3,
        "MemberID": 5
      },
      {
        "RoleID": 4,
        "MemberID": 6
      },
      {
        "RoleID": 6,
        "MemberID": 7
      },
      {
        "RoleID": 7,
        "MemberID": 8
      },
      {
        "RoleID": 8,
        "MemberID": 9
      },
      {
        "RoleID": 9,
        "MemberID": 10
      },
      {
        "RoleID": 10,
        "MemberID": 11
      },
      {
        "RoleID": 12,
        "MemberID": 12
      },
      {
        "RoleID": 13,
        "MemberID": 13
      },
      {
        "RoleID": 14,
        "MemberID": 14
      },
      {
        "RoleID": 17,
        "MemberID": 15
      },
      {
        "RoleID": 18,
        "MemberID": 16
      },
      {
        "RoleID": 15,
        "MemberID": 17
      },
      {
        "RoleID": 16,
        "MemberID": 18
      }
    ]
  },
  {
    "table": "ExpenseDisbursement",
    "rows": [
      {
        "CouncilID": 1,
        "CheckNumber": "1101",
        "PayoutDate": "2025-10-08",
        "TotalAmount": 186.42,
        "Notes": "Columbus Day pancake breakfast supplies"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1102",
        "PayoutDate": "2025-11-12",
        "TotalAmount": 312.75,
        "Notes": "Coats for Kids distribution"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1103",
        "PayoutDate": "2025-12-10",
        "TotalAmount": 245.18,
        "Notes": "Advent family night"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1104",
        "PayoutDate": "2026-01-14",
        "TotalAmount": 94.6,
        "Notes": "Officer installation printing"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1105",
        "PayoutDate": "2026-02-11",
        "TotalAmount": 428.33,
        "Notes": "Lenten fish fry supplies"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1106",
        "PayoutDate": "2026-03-11",
        "TotalAmount": 157.9,
        "Notes": "Free Throw Championship awards"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1107",
        "PayoutDate": "2026-04-08",
        "TotalAmount": 212.46,
        "Notes": "Easter egg hunt"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1108",
        "PayoutDate": "2026-05-13",
        "TotalAmount": 138.25,
        "Notes": "Rosary rally sound rental"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1109",
        "PayoutDate": "2026-07-08",
        "TotalAmount": 364.8,
        "Notes": "Parish picnic grill supplies"
      },
      {
        "CouncilID": 1,
        "CheckNumber": "1110",
        "PayoutDate": "2026-08-12",
        "TotalAmount": 119.99,
        "Notes": "Back-to-school backpack drive"
      }
    ]
  },
  {
    "table": "ExpenseReport",
    "rows": [
      {
        "CouncilID": 1,
        "SubmitterMemberID": 4,
        "Status": "Reimbursed",
        "DisbursementID": 1,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2025-10-06 16:10:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2025-10-07 18:45:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 15,
        "Status": "Reimbursed",
        "DisbursementID": 2,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2025-11-10 15:30:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2025-11-11 19:05:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 16,
        "Status": "Reimbursed",
        "DisbursementID": 3,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2025-12-08 16:20:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2025-12-09 18:15:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 6,
        "Status": "Reimbursed",
        "DisbursementID": 4,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-01-12 17:00:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-01-13 18:30:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 15,
        "Status": "Reimbursed",
        "DisbursementID": 5,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-02-09 16:40:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-02-10 19:20:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 17,
        "Status": "Reimbursed",
        "DisbursementID": 6,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-03-09 15:55:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-03-10 18:00:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 16,
        "Status": "Reimbursed",
        "DisbursementID": 7,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-04-06 16:25:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-04-07 18:50:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 5,
        "Status": "Reimbursed",
        "DisbursementID": 8,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-05-11 17:10:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-05-12 18:35:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 18,
        "Status": "Reimbursed",
        "DisbursementID": 9,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-07-06 16:05:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-07-07 19:10:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 16,
        "Status": "Reimbursed",
        "DisbursementID": 10,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-08-10 15:45:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-08-11 18:25:00"
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 9,
        "Status": "Submitted",
        "DisbursementID": null,
        "FinancialSecretaryMemberID": null,
        "FinancialSecretaryApprovedAt": null,
        "GrandKnightMemberID": null,
        "GrandKnightApprovedAt": null
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 11,
        "Status": "Submitted",
        "DisbursementID": null,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-09-16 17:30:00",
        "GrandKnightMemberID": null,
        "GrandKnightApprovedAt": null
      },
      {
        "CouncilID": 1,
        "SubmitterMemberID": 14,
        "Status": "Approved",
        "DisbursementID": null,
        "FinancialSecretaryMemberID": 2,
        "FinancialSecretaryApprovedAt": "2026-09-08 16:15:00",
        "GrandKnightMemberID": 1,
        "GrandKnightApprovedAt": "2026-09-09 18:40:00"
      }
    ]
  },
  {
    "table": "ExpenseLineItem",
    "rows": [
      {
        "ExpenseReportID": 1,
        "DateOfExpense": "2025-10-04",
        "Amount": 142.17,
        "VendorName": "Cash & Carry",
        "ExpenseDescription": "Pancake mix, syrup, sausage and coffee"
      },
      {
        "ExpenseReportID": 1,
        "DateOfExpense": "2025-10-04",
        "Amount": 44.25,
        "VendorName": "Safeway",
        "ExpenseDescription": "Orange juice and paper plates"
      },
      {
        "ExpenseReportID": 2,
        "DateOfExpense": "2025-11-08",
        "Amount": 312.75,
        "VendorName": "Fred Meyer",
        "ExpenseDescription": "Forty children's winter coats (council match)"
      },
      {
        "ExpenseReportID": 3,
        "DateOfExpense": "2025-12-06",
        "Amount": 198.43,
        "VendorName": "WinCo Foods",
        "ExpenseDescription": "Soup supper ingredients"
      },
      {
        "ExpenseReportID": 3,
        "DateOfExpense": "2025-12-06",
        "Amount": 46.75,
        "VendorName": "Michaels",
        "ExpenseDescription": "Advent wreath craft kits"
      },
      {
        "ExpenseReportID": 4,
        "DateOfExpense": "2026-01-09",
        "Amount": 94.6,
        "VendorName": "Staples Print Center",
        "ExpenseDescription": "Installation programs and certificates"
      },
      {
        "ExpenseReportID": 5,
        "DateOfExpense": "2026-02-06",
        "Amount": 356.08,
        "VendorName": "Pacific Seafood",
        "ExpenseDescription": "Cod fillets for the fish fry"
      },
      {
        "ExpenseReportID": 5,
        "DateOfExpense": "2026-02-06",
        "Amount": 72.25,
        "VendorName": "Restaurant Depot",
        "ExpenseDescription": "Fryer oil and to-go boxes"
      },
      {
        "ExpenseReportID": 6,
        "DateOfExpense": "2026-03-07",
        "Amount": 157.9,
        "VendorName": "Crown Trophy",
        "ExpenseDescription": "Free Throw Championship trophies and ribbons"
      },
      {
        "ExpenseReportID": 7,
        "DateOfExpense": "2026-04-02",
        "Amount": 168.21,
        "VendorName": "Costco",
        "ExpenseDescription": "Candy and plastic eggs"
      },
      {
        "ExpenseReportID": 7,
        "DateOfExpense": "2026-04-02",
        "Amount": 44.25,
        "VendorName": "Party City",
        "ExpenseDescription": "Prize baskets"
      },
      {
        "ExpenseReportID": 8,
        "DateOfExpense": "2026-05-09",
        "Amount": 138.25,
        "VendorName": "Portland Sound Rentals",
        "ExpenseDescription": "PA system rental for the rosary rally"
      },
      {
        "ExpenseReportID": 9,
        "DateOfExpense": "2026-07-02",
        "Amount": 289.55,
        "VendorName": "Costco",
        "ExpenseDescription": "Burgers, hot dogs and buns"
      },
      {
        "ExpenseReportID": 9,
        "DateOfExpense": "2026-07-02",
        "Amount": 75.25,
        "VendorName": "Home Depot",
        "ExpenseDescription": "Propane refills"
      },
      {
        "ExpenseReportID": 10,
        "DateOfExpense": "2026-08-07",
        "Amount": 119.99,
        "VendorName": "Target",
        "ExpenseDescription": "Backpacks and school supplies"
      },
      {
        "ExpenseReportID": 11,
        "DateOfExpense": "2026-09-12",
        "Amount": 86.4,
        "VendorName": "Safeway",
        "ExpenseDescription": "Coffee and donuts for the Knights breakfast"
      },
      {
        "ExpenseReportID": 12,
        "DateOfExpense": "2026-09-10",
        "Amount": 64.99,
        "VendorName": "Office Depot",
        "ExpenseDescription": "Membership drive flyers and table signage"
      },
      {
        "ExpenseReportID": 12,
        "DateOfExpense": "2026-09-10",
        "Amount": 23.5,
        "VendorName": "FedEx Office",
        "ExpenseDescription": "Laminated sign-up sheets"
      },
      {
        "ExpenseReportID": 13,
        "DateOfExpense": "2026-09-05",
        "Amount": 142.75,
        "VendorName": "Cash & Carry",
        "ExpenseDescription": "Ice, water and paper goods for the parish festival booth"
      }
    ]
  },
  {
    "table": "GlobalCharityRegistry",
    "rows": [
      {
        "Name": "St. Jude Parish Food Pantry",
        "Description": "Weekly groceries for families in the parish boundaries",
        "EIN": null,
        "State": "OR",
        "Phone": "503-555-0210",
        "ContactName": "Maria Santos",
        "ContactEmail": "pantry@stjudeparish.org",
        "Address": "5200 NE Alameda St, Portland",
        "ZipCode": "97213",
        "IsCatholic": 1,
        "CharityType": "Food Security",
        "IsAnnual": 1
      },
      {
        "Name": "Holy Family Pregnancy Resource Center",
        "Description": "Free ultrasounds, diapers and parenting classes for expectant mothers",
        "EIN": null,
        "State": "OR",
        "Phone": "503-555-0233",
        "ContactName": "Ann Kelly",
        "ContactEmail": "director@holyfamilyprc.org",
        "Address": "1820 SE 39th Ave, Portland",
        "ZipCode": "97214",
        "IsCatholic": 1,
        "CharityType": "Protecting Life",
        "IsAnnual": 1
      },
      {
        "Name": "Rose City Warming Shelter",
        "Description": "Overnight winter shelter and hot meals",
        "EIN": null,
        "State": "OR",
        "Phone": "503-555-0247",
        "ContactName": "David Lee",
        "ContactEmail": "info@rosecitywarming.org",
        "Address": "640 NW Glisan St, Portland",
        "ZipCode": "97209",
        "IsCatholic": 0,
        "CharityType": "Homelessness",
        "IsAnnual": 0
      },
      {
        "Name": "Cathedral School Tuition Assistance Fund",
        "Description": "Need-based tuition aid for Catholic school families",
        "EIN": null,
        "State": "OR",
        "Phone": "503-555-0259",
        "ContactName": "Sr. Theresa Nolan",
        "ContactEmail": "aid@cathedralschoolpdx.org",
        "Address": "110 NW 17th Ave, Portland",
        "ZipCode": "97209",
        "IsCatholic": 1,
        "CharityType": "Faith",
        "IsAnnual": 1
      },
      {
        "Name": "Mothers of Hope Transitional Housing",
        "Description": "Transitional housing for single mothers and their children",
        "EIN": null,
        "State": "OR",
        "Phone": "503-555-0266",
        "ContactName": "Linda Park",
        "ContactEmail": "office@mothersofhope.org",
        "Address": "3345 N Vancouver Ave, Portland",
        "ZipCode": "97227",
        "IsCatholic": 0,
        "CharityType": "Women and Children",
        "IsAnnual": 0
      }
    ]
  },
  {
    "table": "CouncilCharityLink",
    "rows": [
      {
        "CouncilID": 1,
        "CharityID": 1,
        "ConnectedAt": "2025-09-15 18:00:00"
      },
      {
        "CouncilID": 1,
        "CharityID": 2,
        "ConnectedAt": "2025-09-15 18:00:00"
      },
      {
        "CouncilID": 1,
        "CharityID": 3,
        "ConnectedAt": "2025-11-03 18:30:00"
      },
      {
        "CouncilID": 1,
        "CharityID": 4,
        "ConnectedAt": "2026-01-12 19:00:00"
      },
      {
        "CouncilID": 1,
        "CharityID": 5,
        "ConnectedAt": "2026-03-09 19:00:00"
      }
    ]
  },
  {
    "table": "CharitableDisbursementLedger",
    "rows": [
      {
        "CouncilID": 1,
        "CharityID": 1,
        "Amount": 500,
        "CheckNumber": "1111",
        "DisbursedByID": 2,
        "PayoutDate": "2025-10-20",
        "Notes": "Fall food drive match"
      },
      {
        "CouncilID": 1,
        "CharityID": 2,
        "Amount": 750,
        "CheckNumber": "1112",
        "DisbursedByID": 2,
        "PayoutDate": "2025-11-17",
        "Notes": "Ultrasound machine fund"
      },
      {
        "CouncilID": 1,
        "CharityID": 3,
        "Amount": 400,
        "CheckNumber": "1113",
        "DisbursedByID": 7,
        "PayoutDate": "2025-12-15",
        "Notes": "Winter blankets"
      },
      {
        "CouncilID": 1,
        "CharityID": 1,
        "Amount": 500,
        "CheckNumber": "1114",
        "DisbursedByID": 2,
        "PayoutDate": "2026-01-19",
        "Notes": "Winter pantry restock"
      },
      {
        "CouncilID": 1,
        "CharityID": 4,
        "Amount": 1000,
        "CheckNumber": "1115",
        "DisbursedByID": 7,
        "PayoutDate": "2026-02-16",
        "Notes": "Spring tuition assistance"
      },
      {
        "CouncilID": 1,
        "CharityID": 2,
        "Amount": 600,
        "CheckNumber": "1116",
        "DisbursedByID": 2,
        "PayoutDate": "2026-03-23",
        "Notes": "Baby bottle campaign proceeds"
      },
      {
        "CouncilID": 1,
        "CharityID": 5,
        "Amount": 350,
        "CheckNumber": "1117",
        "DisbursedByID": 7,
        "PayoutDate": "2026-05-18",
        "Notes": "Mother's Day gift cards"
      },
      {
        "CouncilID": 1,
        "CharityID": 1,
        "Amount": 450,
        "CheckNumber": "1118",
        "DisbursedByID": 2,
        "PayoutDate": "2026-08-17",
        "Notes": "Back-to-school lunch program"
      }
    ]
  },
  {
    "table": "CharitableRequest",
    "rows": [
      {
        "CouncilID": 1,
        "OrganizationName": "St. Jude Youth Ministry",
        "ContactName": "Kevin Brandt",
        "ContactPhone": "503-555-0301",
        "ContactEmail": "youth@stjudeparish.org",
        "AmountRequested": 800,
        "RequestStatus": "Submitted",
        "SubmittedAt": "2026-09-14 19:22:00",
        "ShepherdMemberID": 15,
        "MailingAddress": "5200 NE Alameda St, Portland, OR 97213",
        "RelationshipTypeID": 1,
        "Is501c3": 0,
        "EIN": null,
        "Website": "https://stjudeparish.org/youth",
        "OrgMission": "Forming high-school students in faith and service",
        "IsRecurring": 0,
        "FundsNeededBy": "2026-10-31 00:00:00",
        "SpecificUse": "Bus rental and registration for the diocesan youth rally",
        "TargetBeneficiary": "Thirty parish teens",
        "AccountabilityPlan": "Receipts and a photo report to the council",
        "RequestTier": 1,
        "VetterMemberID": null,
        "VettingNotes": null,
        "VettedDate": null,
        "VoteStatus": "Pending",
        "AmountApproved": 0,
        "MissionAreaID": 1
      },
      {
        "CouncilID": 1,
        "OrganizationName": "Portland Refugee Welcome Network",
        "ContactName": "Amina Yusuf",
        "ContactPhone": "503-555-0318",
        "ContactEmail": "amina@prwn.org",
        "AmountRequested": 1500,
        "RequestStatus": "Submitted",
        "SubmittedAt": "2026-09-21 20:05:00",
        "ShepherdMemberID": 18,
        "MailingAddress": "2250 SE 82nd Ave, Portland, OR 97216",
        "RelationshipTypeID": 5,
        "Is501c3": 1,
        "EIN": null,
        "Website": "https://prwn.org",
        "OrgMission": "Resettling refugee families arriving in Portland",
        "IsRecurring": 0,
        "FundsNeededBy": "2026-11-15 00:00:00",
        "SpecificUse": "Starter kitchen kits for five newly arrived families",
        "TargetBeneficiary": "Five refugee families",
        "AccountabilityPlan": "Itemized purchase list and thank-you letters",
        "RequestTier": 2,
        "VetterMemberID": null,
        "VettingNotes": null,
        "VettedDate": null,
        "VoteStatus": "Pending",
        "AmountApproved": 0,
        "MissionAreaID": 3
      },
      {
        "CouncilID": 1,
        "OrganizationName": "Cathedral School Robotics Club",
        "ContactName": "Joan Pratt",
        "ContactPhone": "503-555-0325",
        "ContactEmail": "robotics@cathedralschoolpdx.org",
        "AmountRequested": 650,
        "RequestStatus": "Claimed by Trustee",
        "SubmittedAt": "2026-08-26 18:40:00",
        "ShepherdMemberID": 17,
        "MailingAddress": "110 NW 17th Ave, Portland, OR 97209",
        "RelationshipTypeID": 2,
        "Is501c3": 0,
        "EIN": null,
        "Website": "https://cathedralschoolpdx.org",
        "OrgMission": "STEM enrichment for Catholic middle-schoolers",
        "IsRecurring": 1,
        "FundsNeededBy": "2026-10-10 00:00:00",
        "SpecificUse": "Competition registration and replacement parts",
        "TargetBeneficiary": "Twelve seventh and eighth graders",
        "AccountabilityPlan": "Club treasurer reports spending at the November meeting",
        "RequestTier": 1,
        "VetterMemberID": 12,
        "VettingNotes": "Called the principal; the club is school-sponsored. Asked for last year's budget.",
        "VettedDate": null,
        "VoteStatus": "Pending",
        "AmountApproved": 0,
        "MissionAreaID": 2
      },
      {
        "CouncilID": 1,
        "OrganizationName": "Gabriel House Maternity Home",
        "ContactName": "Rebecca Moore",
        "ContactPhone": "503-555-0337",
        "ContactEmail": "rmoore@gabrielhouse.org",
        "AmountRequested": 2500,
        "RequestStatus": "Claimed by Trustee",
        "SubmittedAt": "2026-08-18 21:15:00",
        "ShepherdMemberID": 4,
        "MailingAddress": "4730 SE Hawthorne Blvd, Portland, OR 97215",
        "RelationshipTypeID": 3,
        "Is501c3": 1,
        "EIN": null,
        "Website": "https://gabrielhouse.org",
        "OrgMission": "A home for pregnant women facing homelessness",
        "IsRecurring": 1,
        "FundsNeededBy": "2026-12-01 00:00:00",
        "SpecificUse": "Crib and car-seat replacements for the nursery",
        "TargetBeneficiary": "Eight mothers and their newborns",
        "AccountabilityPlan": "Invoices plus a site visit by the vetter",
        "RequestTier": 2,
        "VetterMemberID": 13,
        "VettingNotes": "Confirmed 501(c)(3) status. Site visit booked for October 3.",
        "VettedDate": null,
        "VoteStatus": "Pending",
        "AmountApproved": 0,
        "MissionAreaID": 4
      },
      {
        "CouncilID": 1,
        "OrganizationName": "Portland Metro Special Olympics Teams",
        "ContactName": "Chris Dunn",
        "ContactPhone": "503-555-0349",
        "ContactEmail": "coach@pdxmetroathletes.org",
        "AmountRequested": 1000,
        "RequestStatus": "Advanced",
        "SubmittedAt": "2026-07-29 17:55:00",
        "ShepherdMemberID": 16,
        "MailingAddress": "6400 SE Lake Rd, Milwaukie, OR 97222",
        "RelationshipTypeID": 6,
        "Is501c3": 1,
        "EIN": null,
        "Website": "https://pdxmetroathletes.org",
        "OrgMission": "Year-round sports training for athletes with intellectual disabilities",
        "IsRecurring": 1,
        "FundsNeededBy": "2026-10-20 00:00:00",
        "SpecificUse": "Uniforms for the fall bocce and basketball teams",
        "TargetBeneficiary": "Forty metro-area athletes",
        "AccountabilityPlan": "Team photo and roster sent to the council",
        "RequestTier": 2,
        "VetterMemberID": 14,
        "VettingNotes": "Long-standing Knights partner program; financials reviewed. Recommend the full amount.",
        "VettedDate": "2026-09-02 20:30:00",
        "VoteStatus": "Pending",
        "AmountApproved": 0,
        "MissionAreaID": 3
      }
    ]
  },
  {
    "table": "Event",
    "rows": [
      {
        "EventName": "Rosary Rally at the Parish Grotto",
        "EventDescription": "Public rosary for peace with the Knights leading the decades",
        "OwnerID": 4,
        "StartDate": "2026-07-12",
        "EndDate": "2026-07-12",
        "Location": "St. Jude Parish Grotto",
        "CategoryID": 3,
        "FundsRaised-Cash": 180,
        "FundsRaised-Electronic": 0,
        "Highlights": "Over ninety parishioners prayed all five decades despite the heat.",
        "PlannedNumberAttendees": 80,
        "ActualNumberAttendees": 94,
        "IsAnnual": 0,
        "IsMultiDay": 0,
        "MissionAreaID": 1
      },
      {
        "EventName": "Holy Hour for Vocations",
        "EventDescription": "Eucharistic adoration praying for priestly and religious vocations",
        "OwnerID": 5,
        "StartDate": "2026-09-10",
        "EndDate": "2026-09-10",
        "Location": "St. Jude Church",
        "CategoryID": 3,
        "FundsRaised-Cash": 95,
        "FundsRaised-Electronic": 0,
        "Highlights": "Two seminarians joined us and spoke after Benediction.",
        "PlannedNumberAttendees": 40,
        "ActualNumberAttendees": 37,
        "IsAnnual": 0,
        "IsMultiDay": 0,
        "MissionAreaID": 1
      },
      {
        "EventName": "Parish Family Picnic",
        "EventDescription": "Summer picnic with games, a bounce house and a Knights grill line",
        "OwnerID": 16,
        "StartDate": "2026-07-26",
        "EndDate": "2026-07-26",
        "Location": "Laurelhurst Park, Picnic Area B",
        "CategoryID": 1,
        "FundsRaised-Cash": 640,
        "FundsRaised-Electronic": 215,
        "Highlights": "Record turnout; the grill line served 310 plates.",
        "PlannedNumberAttendees": 250,
        "ActualNumberAttendees": 312,
        "IsAnnual": 1,
        "IsMultiDay": 0,
        "MissionAreaID": 2
      },
      {
        "EventName": "Back-to-School Pancake Breakfast",
        "EventDescription": "Pancake breakfast raising school-supply money for parish families",
        "OwnerID": 15,
        "StartDate": "2026-08-16",
        "EndDate": "2026-08-16",
        "Location": "St. Jude Parish Hall",
        "CategoryID": 5,
        "FundsRaised-Cash": 525,
        "FundsRaised-Electronic": 310,
        "Highlights": "Funded forty backpacks for the school drive.",
        "PlannedNumberAttendees": 180,
        "ActualNumberAttendees": 205,
        "IsAnnual": 1,
        "IsMultiDay": 0,
        "MissionAreaID": 2
      },
      {
        "EventName": "Tootsie Roll Drive for Special Olympics",
        "EventDescription": "Annual candy drive at grocery stores for people with intellectual disabilities",
        "OwnerID": 18,
        "StartDate": "2026-08-22",
        "EndDate": "2026-08-22",
        "Location": "Fred Meyer and Safeway entrances, NE Portland",
        "CategoryID": 5,
        "FundsRaised-Cash": 1120.5,
        "FundsRaised-Electronic": 260,
        "Highlights": "Our best drive in five years.",
        "PlannedNumberAttendees": 0,
        "ActualNumberAttendees": 0,
        "IsAnnual": 1,
        "IsMultiDay": 0,
        "MissionAreaID": 3
      },
      {
        "EventName": "Food Pantry Restock Day",
        "EventDescription": "Sorting and shelving donated groceries at the parish pantry",
        "OwnerID": 17,
        "StartDate": "2026-09-12",
        "EndDate": "2026-09-12",
        "Location": "St. Jude Parish Food Pantry",
        "CategoryID": 2,
        "FundsRaised-Cash": 150,
        "FundsRaised-Electronic": 0,
        "Highlights": "Restocked every shelf before the fall rush.",
        "PlannedNumberAttendees": 0,
        "ActualNumberAttendees": 0,
        "IsAnnual": 0,
        "IsMultiDay": 0,
        "MissionAreaID": 3
      },
      {
        "EventName": "Baby Bottle Campaign Kickoff",
        "EventDescription": "Baby bottles handed out after every Mass to collect change for the pregnancy center",
        "OwnerID": 14,
        "StartDate": "2026-07-19",
        "EndDate": "2026-07-19",
        "Location": "St. Jude Church narthex",
        "CategoryID": 5,
        "FundsRaised-Cash": 865.25,
        "FundsRaised-Electronic": 400,
        "Highlights": "Six hundred bottles went home with families.",
        "PlannedNumberAttendees": 500,
        "ActualNumberAttendees": 600,
        "IsAnnual": 1,
        "IsMultiDay": 0,
        "MissionAreaID": 4
      },
      {
        "EventName": "Pregnancy Center Nursery Painting",
        "EventDescription": "Painting and furnishing the nursery at Holy Family Pregnancy Resource Center",
        "OwnerID": 13,
        "StartDate": "2026-09-19",
        "EndDate": "2026-09-19",
        "Location": "Holy Family Pregnancy Resource Center",
        "CategoryID": 2,
        "FundsRaised-Cash": 0,
        "FundsRaised-Electronic": 0,
        "Highlights": "The nursery reopened the following Monday.",
        "PlannedNumberAttendees": 0,
        "ActualNumberAttendees": 0,
        "IsAnnual": 0,
        "IsMultiDay": 0,
        "MissionAreaID": 4
      }
    ]
  },
  {
    "table": "EventCouncils",
    "rows": [
      {
        "EventID": 1,
        "CouncilID": 1
      },
      {
        "EventID": 2,
        "CouncilID": 1
      },
      {
        "EventID": 3,
        "CouncilID": 1
      },
      {
        "EventID": 4,
        "CouncilID": 1
      },
      {
        "EventID": 5,
        "CouncilID": 1
      },
      {
        "EventID": 6,
        "CouncilID": 1
      },
      {
        "EventID": 7,
        "CouncilID": 1
      },
      {
        "EventID": 8,
        "CouncilID": 1
      }
    ]
  },
  {
    "table": "Shift",
    "rows": [
      {
        "ShiftName": "Rally marshals",
        "ShiftDescription": "Set up chairs and sound, lead the decades",
        "ShiftDate": "2026-07-12",
        "StartTime": "09:00:00",
        "EndTime": "12:00:00",
        "EventID": 1,
        "MinNumberVolunteers": 3,
        "NumberVolunteersSignedUp": 3
      },
      {
        "ShiftName": "Adoration guard",
        "ShiftDescription": "Keep watch before the Blessed Sacrament",
        "ShiftDate": "2026-09-10",
        "StartTime": "18:30:00",
        "EndTime": "20:30:00",
        "EventID": 2,
        "MinNumberVolunteers": 2,
        "NumberVolunteersSignedUp": 2
      },
      {
        "ShiftName": "Grill and games crew",
        "ShiftDescription": "Run the grill line and the children's games",
        "ShiftDate": "2026-07-26",
        "StartTime": "10:00:00",
        "EndTime": "15:00:00",
        "EventID": 3,
        "MinNumberVolunteers": 4,
        "NumberVolunteersSignedUp": 5
      },
      {
        "ShiftName": "Griddle crew",
        "ShiftDescription": "Cook and serve pancakes",
        "ShiftDate": "2026-08-16",
        "StartTime": "07:00:00",
        "EndTime": "11:00:00",
        "EventID": 4,
        "MinNumberVolunteers": 4,
        "NumberVolunteersSignedUp": 4
      },
      {
        "ShiftName": "Store-front collectors",
        "ShiftDescription": "Hand out Tootsie Rolls and collect donations",
        "ShiftDate": "2026-08-22",
        "StartTime": "09:00:00",
        "EndTime": "15:00:00",
        "EventID": 5,
        "MinNumberVolunteers": 4,
        "NumberVolunteersSignedUp": 5
      },
      {
        "ShiftName": "Pantry shelvers",
        "ShiftDescription": "Sort, date and shelve groceries",
        "ShiftDate": "2026-09-12",
        "StartTime": "08:00:00",
        "EndTime": "12:00:00",
        "EventID": 6,
        "MinNumberVolunteers": 3,
        "NumberVolunteersSignedUp": 3
      },
      {
        "ShiftName": "Bottle distributors",
        "ShiftDescription": "Hand out bottles after each Mass",
        "ShiftDate": "2026-07-19",
        "StartTime": "08:00:00",
        "EndTime": "13:00:00",
        "EventID": 7,
        "MinNumberVolunteers": 3,
        "NumberVolunteersSignedUp": 3
      },
      {
        "ShiftName": "Painting crew",
        "ShiftDescription": "Prime, paint and assemble cribs",
        "ShiftDate": "2026-09-19",
        "StartTime": "09:00:00",
        "EndTime": "14:00:00",
        "EventID": 8,
        "MinNumberVolunteers": 4,
        "NumberVolunteersSignedUp": 4
      }
    ]
  },
  {
    "table": "EventSignup",
    "rows": [
      {
        "ShiftID": 1,
        "MemberID": 4,
        "NoShow": 0
      },
      {
        "ShiftID": 1,
        "MemberID": 8,
        "NoShow": 0
      },
      {
        "ShiftID": 1,
        "MemberID": 12,
        "NoShow": 0
      },
      {
        "ShiftID": 2,
        "MemberID": 5,
        "NoShow": 0
      },
      {
        "ShiftID": 2,
        "MemberID": 9,
        "NoShow": 0
      },
      {
        "ShiftID": 3,
        "MemberID": 16,
        "NoShow": 0
      },
      {
        "ShiftID": 3,
        "MemberID": 10,
        "NoShow": 0
      },
      {
        "ShiftID": 3,
        "MemberID": 11,
        "NoShow": 0
      },
      {
        "ShiftID": 3,
        "MemberID": 15,
        "NoShow": 0
      },
      {
        "ShiftID": 3,
        "MemberID": 18,
        "NoShow": 0
      },
      {
        "ShiftID": 4,
        "MemberID": 15,
        "NoShow": 0
      },
      {
        "ShiftID": 4,
        "MemberID": 6,
        "NoShow": 0
      },
      {
        "ShiftID": 4,
        "MemberID": 7,
        "NoShow": 0
      },
      {
        "ShiftID": 4,
        "MemberID": 17,
        "NoShow": 0
      },
      {
        "ShiftID": 5,
        "MemberID": 18,
        "NoShow": 0
      },
      {
        "ShiftID": 5,
        "MemberID": 9,
        "NoShow": 0
      },
      {
        "ShiftID": 5,
        "MemberID": 10,
        "NoShow": 0
      },
      {
        "ShiftID": 5,
        "MemberID": 11,
        "NoShow": 0
      },
      {
        "ShiftID": 5,
        "MemberID": 13,
        "NoShow": 0
      },
      {
        "ShiftID": 6,
        "MemberID": 17,
        "NoShow": 0
      },
      {
        "ShiftID": 6,
        "MemberID": 12,
        "NoShow": 0
      },
      {
        "ShiftID": 6,
        "MemberID": 14,
        "NoShow": 0
      },
      {
        "ShiftID": 7,
        "MemberID": 14,
        "NoShow": 0
      },
      {
        "ShiftID": 7,
        "MemberID": 4,
        "NoShow": 0
      },
      {
        "ShiftID": 7,
        "MemberID": 13,
        "NoShow": 0
      },
      {
        "ShiftID": 8,
        "MemberID": 13,
        "NoShow": 0
      },
      {
        "ShiftID": 8,
        "MemberID": 8,
        "NoShow": 0
      },
      {
        "ShiftID": 8,
        "MemberID": 5,
        "NoShow": 0
      },
      {
        "ShiftID": 8,
        "MemberID": 16,
        "NoShow": 0
      }
    ]
  },
  {
    "table": "EventTime",
    "rows": [
      {
        "ShiftID": 1,
        "MemberID": 4,
        "Hours": 3
      },
      {
        "ShiftID": 1,
        "MemberID": 8,
        "Hours": 3
      },
      {
        "ShiftID": 1,
        "MemberID": 12,
        "Hours": 2.5
      },
      {
        "ShiftID": 2,
        "MemberID": 5,
        "Hours": 2
      },
      {
        "ShiftID": 2,
        "MemberID": 9,
        "Hours": 2
      },
      {
        "ShiftID": 3,
        "MemberID": 16,
        "Hours": 5
      },
      {
        "ShiftID": 3,
        "MemberID": 10,
        "Hours": 5
      },
      {
        "ShiftID": 3,
        "MemberID": 11,
        "Hours": 4.5
      },
      {
        "ShiftID": 3,
        "MemberID": 15,
        "Hours": 5
      },
      {
        "ShiftID": 3,
        "MemberID": 18,
        "Hours": 4
      },
      {
        "ShiftID": 4,
        "MemberID": 15,
        "Hours": 4
      },
      {
        "ShiftID": 4,
        "MemberID": 6,
        "Hours": 4
      },
      {
        "ShiftID": 4,
        "MemberID": 7,
        "Hours": 3.5
      },
      {
        "ShiftID": 4,
        "MemberID": 17,
        "Hours": 4
      },
      {
        "ShiftID": 5,
        "MemberID": 18,
        "Hours": 6
      },
      {
        "ShiftID": 5,
        "MemberID": 9,
        "Hours": 6
      },
      {
        "ShiftID": 5,
        "MemberID": 10,
        "Hours": 5.5
      },
      {
        "ShiftID": 5,
        "MemberID": 11,
        "Hours": 6
      },
      {
        "ShiftID": 5,
        "MemberID": 13,
        "Hours": 4
      },
      {
        "ShiftID": 6,
        "MemberID": 17,
        "Hours": 4
      },
      {
        "ShiftID": 6,
        "MemberID": 12,
        "Hours": 4
      },
      {
        "ShiftID": 6,
        "MemberID": 14,
        "Hours": 3.75
      },
      {
        "ShiftID": 7,
        "MemberID": 14,
        "Hours": 5
      },
      {
        "ShiftID": 7,
        "MemberID": 4,
        "Hours": 4.5
      },
      {
        "ShiftID": 7,
        "MemberID": 13,
        "Hours": 5
      },
      {
        "ShiftID": 8,
        "MemberID": 13,
        "Hours": 5
      },
      {
        "ShiftID": 8,
        "MemberID": 8,
        "Hours": 5
      },
      {
        "ShiftID": 8,
        "MemberID": 5,
        "Hours": 4.75
      },
      {
        "ShiftID": 8,
        "MemberID": 16,
        "Hours": 5
      }
    ]
  },
  {
    "table": "Donation",
    "rows": [
      {
        "CouncilID": 1,
        "DonationDate": "2026-07-12",
        "DonationMethodID": 1,
        "DonationTypeID": 2,
        "Donor": null,
        "DonationDesciption": "Rally free-will offering",
        "EventID": 1,
        "DonationAmount": 180,
        "RecordedBy": 7
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-09-10",
        "DonationMethodID": 1,
        "DonationTypeID": 2,
        "Donor": null,
        "DonationDesciption": "Holy Hour vocations basket",
        "EventID": 2,
        "DonationAmount": 95,
        "RecordedBy": 7
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-07-26",
        "DonationMethodID": 1,
        "DonationTypeID": 3,
        "Donor": null,
        "DonationDesciption": "Picnic plates, cash",
        "EventID": 3,
        "DonationAmount": 640,
        "RecordedBy": 7
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-07-26",
        "DonationMethodID": 3,
        "DonationTypeID": 3,
        "Donor": null,
        "DonationDesciption": "Picnic plates, Venmo",
        "EventID": 3,
        "DonationAmount": 215,
        "RecordedBy": 7
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-08-16",
        "DonationMethodID": 1,
        "DonationTypeID": 3,
        "Donor": null,
        "DonationDesciption": "Pancake plates, cash",
        "EventID": 4,
        "DonationAmount": 525,
        "RecordedBy": 2
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-08-16",
        "DonationMethodID": 2,
        "DonationTypeID": 3,
        "Donor": null,
        "DonationDesciption": "Pancake plates, card reader",
        "EventID": 4,
        "DonationAmount": 310,
        "RecordedBy": 2
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-08-22",
        "DonationMethodID": 1,
        "DonationTypeID": 4,
        "Donor": null,
        "DonationDesciption": "Tootsie Roll cans",
        "EventID": 5,
        "DonationAmount": 1120.5,
        "RecordedBy": 7
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-08-22",
        "DonationMethodID": 3,
        "DonationTypeID": 4,
        "Donor": null,
        "DonationDesciption": "Tootsie Roll QR code",
        "EventID": 5,
        "DonationAmount": 260,
        "RecordedBy": 7
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-09-12",
        "DonationMethodID": 1,
        "DonationTypeID": 4,
        "Donor": "Anonymous parishioner",
        "DonationDesciption": "Pantry cash gift",
        "EventID": 6,
        "DonationAmount": 150,
        "RecordedBy": 2
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-09-12",
        "DonationMethodID": 7,
        "DonationTypeID": 4,
        "Donor": "Safeway NE Broadway",
        "DonationDesciption": "Pallet of canned goods (physical items)",
        "EventID": 6,
        "DonationAmount": 300,
        "RecordedBy": 2
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-07-19",
        "DonationMethodID": 1,
        "DonationTypeID": 2,
        "Donor": null,
        "DonationDesciption": "Baby bottles returned, cash and coins",
        "EventID": 7,
        "DonationAmount": 865.25,
        "RecordedBy": 7
      },
      {
        "CouncilID": 1,
        "DonationDate": "2026-07-19",
        "DonationMethodID": 4,
        "DonationTypeID": 2,
        "Donor": null,
        "DonationDesciption": "Baby bottle campaign, Zelle",
        "EventID": 7,
        "DonationAmount": 400,
        "RecordedBy": 7
      }
    ]
  },
  {
    "table": "CouncilBudgetForecast",
    "rows": [
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Annual Donation to Pastor",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1400,
        "Notes": "For any purpose chosen by our Pastor",
        "BudgetCategoryID": 1,
        "ProposedBudgetAmount": 1400,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Donation for Deacon or Parochial Vicar",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 500,
        "Notes": "For any purpose chosen by our Deacon",
        "BudgetCategoryID": 1,
        "ProposedBudgetAmount": 500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Annual Donation for Church Office Staff",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 300,
        "Notes": "$150/staff member, for personal use",
        "BudgetCategoryID": 1,
        "ProposedBudgetAmount": 300,
        "BudgetStatus": "Approved",
        "quantity": 2,
        "unit_cost": 150,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Annual Donation to Seminarian(s)",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 700,
        "Notes": "Funded by request or when an event/recipient is available. $700 provided by the Council; starting 7/1; RSVP",
        "BudgetCategoryID": 1,
        "ProposedBudgetAmount": 700,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Pennies for Heaven",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 400,
        "Notes": "Supreme/State program: supports seminarians",
        "BudgetCategoryID": 1,
        "ProposedBudgetAmount": 400,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Seminarian and Parochial Vicar Contributions",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1300,
        "Notes": "Funded by request or when an event/recipient is available. For Cathedral seminarians (up to $1,300 total)",
        "BudgetCategoryID": 1,
        "ProposedBudgetAmount": 1300,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Pancake Breakfasts (3x/year - Oct, Feb, May)",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1100,
        "Notes": "$370/breakfast: food & beverages ~60 people plus ~$70/breakfast for supplies",
        "BudgetCategoryID": 2,
        "ProposedBudgetAmount": 1100,
        "BudgetStatus": "Approved",
        "quantity": 3,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "COMMUNITY_EVENTS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Annual Parish Barbecue",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1600,
        "Notes": "Food, beverages, and supplies; serves ~170 people (~$9.50/person)",
        "BudgetCategoryID": 2,
        "ProposedBudgetAmount": 1600,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "COMMUNITY_EVENTS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Simple Suppers (5x/year - Lenten Fridays + fish fry)",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 700,
        "Notes": "Most food donated by volunteer hosts; fish fry and supplies are main expense",
        "BudgetCategoryID": 2,
        "ProposedBudgetAmount": 700,
        "BudgetStatus": "Approved",
        "quantity": 5,
        "unit_cost": 140,
        "budget_version": 1,
        "universal_category": "COMMUNITY_EVENTS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Annual Cathedral School Event",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Annual Autumn gathering; goes to general fund",
        "BudgetCategoryID": 3,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "YOUTH_PROGRAMS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Awards for Cathedral Students",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 600,
        "Notes": "Cash awards: one boy, one girl; three plaques",
        "BudgetCategoryID": 3,
        "ProposedBudgetAmount": 600,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "YOUTH_PROGRAMS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "St. Mary's Cathedral Tuition Fund",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Via Cathedral Parish; helps families with financial need",
        "BudgetCategoryID": 3,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Scouts General Support",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 300,
        "Notes": "For scouting affiliated with Cathedral School students",
        "BudgetCategoryID": 3,
        "ProposedBudgetAmount": 300,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Bingo for April in Paris[h]",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 500,
        "Notes": "Food, beverages, and prizes for bingo night",
        "BudgetCategoryID": 3,
        "ProposedBudgetAmount": 500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "YOUTH_PROGRAMS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Field Day for Graduation",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 800,
        "Notes": "Knights provide burgers, snow cones, etc.",
        "BudgetCategoryID": 3,
        "ProposedBudgetAmount": 800,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "YOUTH_PROGRAMS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "St. Andrew Nativity School",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Benefit lunch; provides free education",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Community Faith Services",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 500,
        "Notes": "Donation for Legion of Mary, Cathedral",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Our Lady of Peace Retreat House",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Contribution for equipment/facilities improvements",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Parking Lot Maintenance",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Funded by request or when an event/recipient is available. Lot striping expenses, signage",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CAPITAL_PROJECTS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Other Cathedral Maintenance",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Funded by request or when an event/recipient is available. Lights, paint; can be carried to next year",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CAPITAL_PROJECTS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Family Clinic",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Funded by request or when an event/recipient is available. Open to all; activities focus on Catholic ethics",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Sisters of Mary of Kakamega",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Supports children in African centers",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Food for Families (e.g., Lift Up)",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 500,
        "Notes": "Funded by request or when an event/recipient is available. Adds to Lenten food collection efforts",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "St. Patrick Parish Benefit Lunch",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 300,
        "Notes": "Funded by request or when an event/recipient is available. Up to 10 members at $30 each (reimbursed)",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 300,
        "BudgetStatus": "Approved",
        "quantity": 10,
        "unit_cost": 30,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Miscellaneous Others",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 2500,
        "Notes": "Funded by request or when an event/recipient is available. Special requests/projects; typically $500 each (e.g., Medical Team Intl., Mother & Child). Sprint 6E catch-all: approved spend and gifts with no budget line of their own",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 2500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "MISCELLANEOUS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Major Project(s)",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 4500,
        "Notes": "Ultrasound; destination/amount determined by future council vote",
        "BudgetCategoryID": 4,
        "ProposedBudgetAmount": 4500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CAPITAL_PROJECTS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "State Convention",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Funded by request or when an event/recipient is available. Expenses for two representatives (and wives)",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "ADMINISTRATIVE_OPERATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Exemplification / Member Support",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 500,
        "Notes": "Membership and degree advancement; 4th degree fees",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "MEMBERSHIP_RECOGNITION"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Equipment Purchases",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 500,
        "Notes": "Funded by request or when an event/recipient is available. Purchases not covered under other budget headings",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "ADMINISTRATIVE_OPERATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Shirts, Plaques, Badges, Pins",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 400,
        "Notes": "Funded by request or when an event/recipient is available. Materials representing the Knights",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 400,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "MEMBERSHIP_RECOGNITION"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Cathedral Bulletin Ad",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1300,
        "Notes": "Annual cost; promotes Knights membership",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 1300,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "ADMINISTRATIVE_OPERATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Per Capita, Bank Fees, Postage",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1500,
        "Notes": "~$24/member x 60 members",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 1500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "ADMINISTRATIVE_OPERATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Contributions to State/Supreme & K of C Projects",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1500,
        "Notes": "Father Taaffe Homes ($400); Coats for Kids ($1,100)",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 1500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "CHARITABLE_DONATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Roses for Easter and Mother's Day",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1000,
        "Notes": "Roses purchased in bulk and distributed by Knights",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 1000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "COMMUNITY_EVENTS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Council Knight Awards",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 700,
        "Notes": "Plaques, hammers, honorary funds",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 700,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "MEMBERSHIP_RECOGNITION"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Grand Knight Discretionary Fund",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 500,
        "Notes": "Funded by request or when an event/recipient is available. Applied by GK according to perceived needs, once/year",
        "BudgetCategoryID": 5,
        "ProposedBudgetAmount": 500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "ADMINISTRATIVE_OPERATIONS"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Operational",
        "ReferenceSourceID": null,
        "LineItemName": "Monthly Council Meetings",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1500,
        "Notes": "Food & beverages: 10 meetings, ~$120/meeting, ~20 attendees",
        "BudgetCategoryID": 6,
        "ProposedBudgetAmount": 1500,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "FRATERNAL_ACTIVITIES"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Council Camping Trip",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 1200,
        "Notes": "For campsite reservation, food, and supplies",
        "BudgetCategoryID": 6,
        "ProposedBudgetAmount": 1200,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "FRATERNAL_ACTIVITIES"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Council Retreats (Black Butte, Lent)",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 600,
        "Notes": "Faith-building fraternal gathering with Msgr. O'Connor; 8-10 Knights",
        "BudgetCategoryID": 6,
        "ProposedBudgetAmount": 600,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "FRATERNAL_ACTIVITIES"
      },
      {
        "CouncilID": 1,
        "FraternalYear": "2026-2027",
        "CategoryType": "Event",
        "ReferenceSourceID": null,
        "LineItemName": "Christmas Party",
        "PrePopulatedAmount": 0,
        "ApprovedBudgetAmount": 3000,
        "Notes": "Elks Lodge rental, main course, music",
        "BudgetCategoryID": 6,
        "ProposedBudgetAmount": 3000,
        "BudgetStatus": "Approved",
        "quantity": 1,
        "unit_cost": 0,
        "budget_version": 1,
        "universal_category": "FRATERNAL_ACTIVITIES"
      }
    ]
  },
  {
    "table": "JournalEntry",
    "rows": [
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-07-01 00:00:00",
        "Description": "Opening balance carried into the ledger",
        "DebitAmount": 8450,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 1,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0001"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 4,
        "DateLogged": "2026-07-01 00:00:00",
        "Description": "Opening balance carried into the ledger",
        "DebitAmount": 3200,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 1,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0001"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 5,
        "DateLogged": "2026-07-01 00:00:00",
        "Description": "Opening balance carried into the ledger",
        "DebitAmount": 2150,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 1,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0001"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 6,
        "DateLogged": "2026-07-01 00:00:00",
        "Description": "Opening balance: hall tables, banners and grill",
        "DebitAmount": 1875,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0001"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 15,
        "DateLogged": "2026-07-01 00:00:00",
        "Description": "Opening balance carried into the ledger",
        "DebitAmount": 0,
        "CreditAmount": 15675,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0001"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-07-12 00:00:00",
        "Description": "Rally free-will offering deposit",
        "DebitAmount": 180,
        "CreditAmount": 0,
        "LinkedEventID": 1,
        "LinkedMeetingID": null,
        "IsBankReconciled": 1,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0002"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 10,
        "DateLogged": "2026-07-12 00:00:00",
        "Description": "Rally free-will offering deposit",
        "DebitAmount": 0,
        "CreditAmount": 180,
        "LinkedEventID": 1,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0002"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-07-15 00:00:00",
        "Description": "July member dues deposit",
        "DebitAmount": 1260,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 1,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0003"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 7,
        "DateLogged": "2026-07-15 00:00:00",
        "Description": "July member dues deposit",
        "DebitAmount": 0,
        "CreditAmount": 1260,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0003"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-07-27 00:00:00",
        "Description": "Family picnic plate sales deposit",
        "DebitAmount": 855,
        "CreditAmount": 0,
        "LinkedEventID": 3,
        "LinkedMeetingID": null,
        "IsBankReconciled": 1,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0004"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 9,
        "DateLogged": "2026-07-27 00:00:00",
        "Description": "Family picnic plate sales deposit",
        "DebitAmount": 0,
        "CreditAmount": 855,
        "LinkedEventID": 3,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0004"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 14,
        "DateLogged": "2026-08-01 00:00:00",
        "Description": "Supreme per capita assessment",
        "DebitAmount": 642,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1119",
        "TransactionID": "seed-txn-0005"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-08-01 00:00:00",
        "Description": "Supreme per capita assessment",
        "DebitAmount": 0,
        "CreditAmount": 642,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1119",
        "TransactionID": "seed-txn-0005"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 2,
        "DateLogged": "2026-08-05 00:00:00",
        "Description": "Set aside toward Goal Account #1",
        "DebitAmount": 2250,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0006"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-08-05 00:00:00",
        "Description": "Set aside toward Goal Account #1",
        "DebitAmount": 0,
        "CreditAmount": 2250,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0006"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 3,
        "DateLogged": "2026-08-05 00:00:00",
        "Description": "Set aside toward Goal Account #2",
        "DebitAmount": 600,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0007"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-08-05 00:00:00",
        "Description": "Set aside toward Goal Account #2",
        "DebitAmount": 0,
        "CreditAmount": 600,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0007"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-08-17 00:00:00",
        "Description": "Pancake breakfast plate sales deposit",
        "DebitAmount": 835,
        "CreditAmount": 0,
        "LinkedEventID": 4,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0008"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 9,
        "DateLogged": "2026-08-17 00:00:00",
        "Description": "Pancake breakfast plate sales deposit",
        "DebitAmount": 0,
        "CreditAmount": 835,
        "LinkedEventID": 4,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0008"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 12,
        "DateLogged": "2026-08-20 00:00:00",
        "Description": "Pancake breakfast griddle rental and supplies",
        "DebitAmount": 312.4,
        "CreditAmount": 0,
        "LinkedEventID": 4,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1120",
        "TransactionID": "seed-txn-0009"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-08-20 00:00:00",
        "Description": "Pancake breakfast griddle rental and supplies",
        "DebitAmount": 0,
        "CreditAmount": 312.4,
        "LinkedEventID": 4,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1120",
        "TransactionID": "seed-txn-0009"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-08-29 00:00:00",
        "Description": "Fair parking lot proceeds deposit",
        "DebitAmount": 1480,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0010"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 8,
        "DateLogged": "2026-08-29 00:00:00",
        "Description": "Fair parking lot proceeds deposit",
        "DebitAmount": 0,
        "CreditAmount": 1480,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0010"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 11,
        "DateLogged": "2026-09-03 00:00:00",
        "Description": "Gift to St. Jude Parish Food Pantry",
        "DebitAmount": 500,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1121",
        "TransactionID": "seed-txn-0011"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 5,
        "DateLogged": "2026-09-03 00:00:00",
        "Description": "Gift to St. Jude Parish Food Pantry",
        "DebitAmount": 0,
        "CreditAmount": 500,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1121",
        "TransactionID": "seed-txn-0011"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 13,
        "DateLogged": "2026-09-08 00:00:00",
        "Description": "Parish hall rental, September meeting",
        "DebitAmount": 150,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1122",
        "TransactionID": "seed-txn-0012"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-09-08 00:00:00",
        "Description": "Parish hall rental, September meeting",
        "DebitAmount": 0,
        "CreditAmount": 150,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1122",
        "TransactionID": "seed-txn-0012"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 6,
        "DateLogged": "2026-09-10 00:00:00",
        "Description": "Purchased a second outdoor grill",
        "DebitAmount": 425,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1123",
        "TransactionID": "seed-txn-0013"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-09-10 00:00:00",
        "Description": "Purchased a second outdoor grill",
        "DebitAmount": 0,
        "CreditAmount": 425,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": "1123",
        "TransactionID": "seed-txn-0013"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 4,
        "DateLogged": "2026-09-15 00:00:00",
        "Description": "Transfer from Operating Checking to General Savings",
        "DebitAmount": 1000,
        "CreditAmount": 0,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0014"
      },
      {
        "CouncilID": 1,
        "GLAccountID": 1,
        "DateLogged": "2026-09-15 00:00:00",
        "Description": "Transfer from Operating Checking to General Savings",
        "DebitAmount": 0,
        "CreditAmount": 1000,
        "LinkedEventID": null,
        "LinkedMeetingID": null,
        "IsBankReconciled": 0,
        "CheckNumber": null,
        "TransactionID": "seed-txn-0014"
      }
    ]
  },
  {
    "table": "Credentials",
    "rows": [
      {
        "Username": "tom.gk@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "david.dgk@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "hector.trustee@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      }
    ]
  },
  {
    "table": "Member",
    "rows": [
      {
        "CouncilID": 1,
        "MemberNumber": 9900019,
        "MemberFirstName": "Tom",
        "MemberLastName": "McDougal",
        "Phone": "503-555-0119",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "tom.gk@kofc15295.org",
        "DateOfBirth": "1970-01-01",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 19
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900020,
        "MemberFirstName": "David",
        "MemberLastName": "Norman",
        "Phone": "503-555-0120",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "david.dgk@kofc15295.org",
        "DateOfBirth": "1975-01-01",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 20
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900021,
        "MemberFirstName": "Hector",
        "MemberLastName": "Nunez",
        "Phone": "503-555-0121",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "hector.trustee@kofc15295.org",
        "DateOfBirth": "1965-01-01",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 21
      }
    ]
  },
  {
    "table": "MemberRoles",
    "rows": [
      {
        "RoleID": 1,
        "MemberID": 19
      },
      {
        "RoleID": 2,
        "MemberID": 20
      },
      {
        "RoleID": 12,
        "MemberID": 21
      }
    ]
  },
  {
    "table": "Credentials",
    "rows": [
      {
        "Username": "brian.recorder@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "bill.treasurer@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "george.gurney@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "alan.sanchez@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "tim.community@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      },
      {
        "Username": "matt.fife@kofc15295.org",
        "Password": "dev-pass-secure-9912"
      }
    ]
  },
  {
    "table": "Member",
    "rows": [
      {
        "CouncilID": 1,
        "MemberNumber": 9900022,
        "MemberFirstName": "Brian",
        "MemberLastName": "Wolf",
        "Phone": "503-555-0122",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "brian.recorder@kofc15295.org",
        "DateOfBirth": "1972-01-01",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 22
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900023,
        "MemberFirstName": "Bill",
        "MemberLastName": "Kehrli",
        "Phone": "503-555-0123",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "bill.treasurer@kofc15295.org",
        "DateOfBirth": "1960-01-01",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 23
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900024,
        "MemberFirstName": "George",
        "MemberLastName": "Gurney",
        "Phone": "503-555-0124",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "george.gurney@kofc15295.org",
        "DateOfBirth": "1958-01-01",
        "StatusID": 1,
        "DegreeID": 4,
        "MemberTypeID": 3,
        "CredentialID": 24
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900025,
        "MemberFirstName": "Alan",
        "MemberLastName": "Sanchez",
        "Phone": "503-555-0125",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "alan.sanchez@kofc15295.org",
        "DateOfBirth": "1978-01-01",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 25
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900026,
        "MemberFirstName": "Tim",
        "MemberLastName": "Ferkel",
        "Phone": "503-555-0126",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "tim.community@kofc15295.org",
        "DateOfBirth": "1968-01-01",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 26
      },
      {
        "CouncilID": 1,
        "MemberNumber": 9900027,
        "MemberFirstName": "Matt",
        "MemberLastName": "Fife",
        "Phone": "503-555-0127",
        "StreetAddress1": "100 Parish Way",
        "City": "Portland",
        "State": "OR",
        "ZipCode": "97201",
        "Email": "matt.fife@kofc15295.org",
        "DateOfBirth": "1981-01-01",
        "StatusID": 1,
        "DegreeID": 3,
        "MemberTypeID": 3,
        "CredentialID": 27
      }
    ]
  },
  {
    "table": "MemberRoles",
    "rows": [
      {
        "RoleID": 4,
        "MemberID": 22
      },
      {
        "RoleID": 6,
        "MemberID": 23
      },
      {
        "RoleID": 15,
        "MemberID": 21
      },
      {
        "RoleID": 16,
        "MemberID": 26
      }
    ]
  },
  {
    "table": "Meeting",
    "rows": [
      {
        "CouncilID": 1,
        "Meeting Name": "October Business Meeting",
        "Meeting Description": "St. Mary's Cathedral business meeting: live agenda, check-ins, hand votes and smartphone ballots",
        "Date": "2026-10-06",
        "Time Start": "19:30:00",
        "Time End": "21:00:00",
        "Location": "St. Mary's Cathedral",
        "Agenda": "Call to Order & Opening\nChaplain's & Officer Reports\nDirector & Ministry Reports\nNew Business\nOld Business\nUpcoming Events\nGood of the Order",
        "MinutesURL": "",
        "MeetingType": 1,
        "OwnerID": 19,
        "IsMultiDay": 0,
        "MeetingTypeID": 1,
        "IsLiveInProgress": 1,
        "LiveQuorumRosterCount": 28
      }
    ]
  },
  {
    "table": "MeetingInvites",
    "rows": [
      {
        "MeetingID": 1,
        "MemberID": 19,
        "Attended": 0,
        "ResponseStatus": "Accepted"
      },
      {
        "MeetingID": 1,
        "MemberID": 20,
        "Attended": 0,
        "ResponseStatus": "Accepted"
      },
      {
        "MeetingID": 1,
        "MemberID": 21,
        "Attended": 0,
        "ResponseStatus": "Accepted"
      }
    ]
  },
  {
    "table": "ProposedMotion",
    "rows": [
      {
        "CouncilID": 1,
        "TargetMeetingID": 1,
        "SourceType": "GeneralMember",
        "SourceRecordID": null,
        "MotionText": "Vote on 2026-2027 Budget Proposed Changes",
        "PresenterMemberID": 23,
        "AllocatedMinutes": 10,
        "VoteResult": "Pending"
      }
    ]
  },
  {
    "table": "MeetingAgendaItem",
    "rows": [
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "opening",
        "SortOrder": 1,
        "LineMarkdown": "**Call to Order** - the Grand Knight opens the meeting",
        "SpeakerRoleID": 1,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "opening",
        "SortOrder": 2,
        "LineMarkdown": "**Opening Prayer & Pledge of Allegiance**",
        "SpeakerRoleID": null,
        "SpeakerMemberID": 24,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "opening",
        "SortOrder": 3,
        "LineMarkdown": "**Roll Call of Officers** - the full officer array",
        "SpeakerRoleID": 2,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "opening",
        "SortOrder": 4,
        "LineMarkdown": "**Reading & Approval of the Minutes** of the September meeting",
        "SpeakerRoleID": 4,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "officer_reports",
        "SortOrder": 1,
        "LineMarkdown": "**Chaplain's Report** & spiritual reflection",
        "SpeakerRoleID": 19,
        "SpeakerMemberID": null,
        "SpeakerLabel": "Monsignor",
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "officer_reports",
        "SortOrder": 2,
        "LineMarkdown": "**Grand Knight's Report**",
        "SpeakerRoleID": 1,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "officer_reports",
        "SortOrder": 3,
        "LineMarkdown": "**Financial Secretary's Report**",
        "SpeakerRoleID": 5,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "officer_reports",
        "SortOrder": 4,
        "LineMarkdown": "**Treasurer's Report**",
        "SpeakerRoleID": 6,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "officer_reports",
        "SortOrder": 5,
        "LineMarkdown": "**State Deputy's Remarks**",
        "SpeakerRoleID": null,
        "SpeakerMemberID": null,
        "SpeakerLabel": "State Deputy John Snyder",
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "director_reports",
        "SortOrder": 1,
        "LineMarkdown": "**Membership & Parking Report**",
        "SpeakerRoleID": 15,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "director_reports",
        "SortOrder": 2,
        "LineMarkdown": "**Ministry Report**",
        "SpeakerRoleID": null,
        "SpeakerMemberID": 25,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "director_reports",
        "SortOrder": 3,
        "LineMarkdown": "**Community Director's Report**",
        "SpeakerRoleID": 16,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "director_reports",
        "SortOrder": 4,
        "LineMarkdown": "**Ministry Report**",
        "SpeakerRoleID": null,
        "SpeakerMemberID": 27,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "old_business",
        "SortOrder": 1,
        "LineMarkdown": "**Vote on 2026-2027 Budget Proposed Changes** - the Treasurer presents the revised line items",
        "SpeakerRoleID": 6,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": 1
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "good_of_order",
        "SortOrder": 1,
        "LineMarkdown": "**Prayer Requests**\n- Dolores Redden\n- Mark Boshears\n- Paul Wolf\n- Paul Della",
        "SpeakerRoleID": null,
        "SpeakerMemberID": null,
        "SpeakerLabel": null,
        "ProposedMotionID": null
      },
      {
        "CouncilID": 1,
        "MeetingID": 1,
        "SectionKey": "good_of_order",
        "SortOrder": 2,
        "LineMarkdown": "**Closing Prayer**",
        "SpeakerRoleID": 19,
        "SpeakerMemberID": null,
        "SpeakerLabel": "Monsignor",
        "ProposedMotionID": null
      }
    ]
  }
];
