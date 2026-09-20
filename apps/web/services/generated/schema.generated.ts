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
    "foreignKeys": []
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
    "foreignKeys": []
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
    "foreignKeys": []
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
    "foreignKeys": []
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
    "foreignKeys": []
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
    "foreignKeys": []
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
    "foreignKeys": []
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
    "foreignKeys": []
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
    "foreignKeys": []
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
      }
    ],
    "foreignKeys": []
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
    "foreignKeys": []
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
    ]
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
    ]
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
        "notNull": false,
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
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Time Start",
        "kind": "time",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Time End",
        "kind": "time",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Location",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "Agenda",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MinutesURL",
        "kind": "text",
        "notNull": false,
        "identity": false,
        "default": null
      },
      {
        "name": "MeetingType",
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
      }
    ]
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
    ]
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
      }
    ]
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
    ]
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
    ]
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
    "foreignKeys": []
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    "foreignKeys": []
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
    ]
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
    ]
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
    ]
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
    ]
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
        "Role": "Lector",
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
        "Role": "Priest",
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
        "Phone": "503-555-0199"
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
  }
];
