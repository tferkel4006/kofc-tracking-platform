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
  default: { kind: 'literal'; value: number } | { kind: 'now' } | null;
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
        "name": "Budget",
        "kind": "real",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Spend",
        "kind": "real",
        "notNull": false,
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
        "Password": "koc15295"
      },
      {
        "Username": "testadmin@kofc.org",
        "Password": "koc15295"
      },
      {
        "Username": "testmember@kofc.org",
        "Password": "koc15295"
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
  }
];
