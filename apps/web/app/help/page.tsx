'use client';
// Online Help Center: the troubleshooting workflows of docs/MEMBER_USER_GUIDE.md and docs/ADMIN_USER_GUIDE.md as a
// searchable question-and-answer accordion. Open to every signed-in member. The time windows and limits quoted come
// from the shared rule constants, so an answer cannot drift from what the drivers enforce.
import { useState } from 'react';
import {
  ACTIVITY_HISTORY_MONTHS,
  FEED_HORIZON_MONTHS,
  HOURS_REMINDER_FIRST_DAY,
  HOURS_REMINDER_REPEAT_DAYS,
  MAX_HOURS_PER_ENTRY,
  MIN_PASSWORD_LENGTH,
  NO_SHOW_AUDIT_MONTHS,
  NO_SHOW_WINDOW_MONTHS,
  PRIORITY_WITHIN_DAYS,
  SHIFT_HISTORY_MONTHS,
} from '@kofc/shared';
import { Empty, Field, Input, PageTitle, Pill } from '@/components/ui';

type Audience = 'Everyone' | 'Admins & officers';
interface Topic {
  q: string;
  a: string[];
}
interface Section {
  title: string;
  audience: Audience;
  topics: Topic[];
}

const SECTIONS: Section[] = [
  {
    title: 'Signing in and your password',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I set up my account for the first time?',
        a: [
          'Open the phone app and enter the email address your council has on file, then tap Continue.',
          `If you are on the roster you are asked to choose a password of at least ${MIN_PASSWORD_LENGTH} characters and type it twice. Tap Create password and you are signed in; the phone remembers you until you sign out.`,
          'The same email and password sign you in to this desktop portal.',
        ],
      },
      {
        q: 'The app says it could not find my email in the member roster.',
        a: [
          'Members cannot register themselves: a council Admin adds you first. Check the address for typos and tap Try a different email.',
          'If it is correct, contact the admin shown on the Contact your council admin card (the council office phone is listed too) and ask to be added.',
        ],
      },
      {
        q: 'My password is refused or I see “Incorrect password”.',
        a: [
          `New passwords need at least ${MIN_PASSWORD_LENGTH} characters, and both entries must match.`,
          'At sign-in, check the email and password. If you have never created a password, do the phone onboarding first. If you have forgotten it, ask your council Admin for help.',
        ],
      },
      {
        q: 'How do I sign out?',
        a: ['In the portal, select Sign out under your name in the navy header. On the phone, tap Sign out in the header; this also forgets the remembered session.'],
      },
    ],
  },
  {
    title: 'Shifts and registration',
    audience: 'Everyone',
    topics: [
      {
        q: 'Where do I find shifts to volunteer for?',
        a: [
          `Member Actions → Registration desk (or the Shifts tab on the phone) lists shifts over the next ${FEED_HORIZON_MONTHS} months for your council and its sister councils that still need volunteers.`,
          'Filter by Council, then select Register (or tap Sign up on the phone).',
        ],
      },
      {
        q: 'Why is there no Register or Sign up button on a shift?',
        a: [
          'The shift is Full: once its sign-ups reach the minimum volunteers it locks automatically, so it cannot be over-booked. If two members take the last place at once, only one succeeds.',
          'On the phone, full shifts are hidden unless you switch on Show full shifts.',
        ],
      },
      {
        q: 'What do the red, gold and Full tags mean?',
        a: [
          'Red (Within 48 hours / WITHIN 2 DAYS): the shift starts within two days.',
          `Gold (Priority): still short of volunteers and either nobody has signed up or it starts within ${PRIORITY_WITHIN_DAYS} days.`,
          'Full: the minimum number of volunteers has been reached.',
        ],
      },
      {
        q: 'What is the red no-show badge on my phone?',
        a: [
          `It counts shifts you were marked absent for in the past ${NO_SHOW_WINDOW_MONTHS} months. Each one drops off after a year. If you cannot make a shift, tell the event owner or your Admin before the day.`,
        ],
      },
    ],
  },
  {
    title: 'Reporting hours',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I log the time I worked?',
        a: [
          'Member Actions → Hour ledger (or the Log time tab on the phone). Choose the shift or council activity, pick hours and minutes, add optional notes and save.',
          'Logging a shift again replaces the earlier hours, which is how you correct a mistake.',
        ],
      },
      {
        q: 'Why are my hours refused? (the 15-minute rule)',
        a: [
          'Time is kept in 15-minute chunks, so minutes can only be :00, :15, :30 or :45. For example, 1 h 15 min saves as 1.25 hours.',
          `An entry must be more than 0 and at most ${MAX_HOURS_PER_ENTRY} hours. You may report more than the shift's planned length.`,
        ],
      },
      {
        q: 'How far back can I log time?',
        a: [
          `Shifts: up to ${SHIFT_HISTORY_MONTHS} months after the shift date. Council activities: dates up to ${ACTIVITY_HISTORY_MONTHS} months back.`,
          'After that the entry is frozen to protect the council’s records, and the shift shows Closed in your history.',
        ],
      },
      {
        q: 'Why did I get a text reminder about hours?',
        a: [
          `You signed up for a shift but have not logged hours. The first reminder goes out ${HOURS_REMINDER_FIRST_DAY} days after the shift, then one every ${HOURS_REMINDER_REPEAT_DAYS} days, and reminders stop once the ${SHIFT_HISTORY_MONTHS}-month window closes.`,
        ],
      },
    ],
  },
  {
    title: 'Donations and QR codes',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I take donations at an event?',
        a: [
          'On the phone, open Donate → Start accepting for an event, choose the event and any default amount, type or description, and tap Start.',
          'For each donor, tap the method tile (Cash, Credit Card, a QR method or Physical items), fill in the form and tap Record donation. Tap Stop accepting when the event is over.',
        ],
      },
      {
        q: 'How does a QR donation work?',
        a: [
          'Tap the Venmo, Zelle, Zeffy or ParishSoft tile and turn the phone toward the donor so they can scan the code.',
          'When they show you the payment confirmation, check the amount, then enter it with the donation type and tap Record donation.',
        ],
      },
      {
        q: 'The QR code does not appear.',
        a: [
          '“Your council has not uploaded this QR code yet” means no image link is on file: an Admin, Treasurer or Financial Secretary adds it under Council lookups → Enabled donation methods.',
          '“The QR code could not be loaded” usually means the phone is offline or the link is broken. Take the donation another way and tell your Admin.',
        ],
      },
      {
        q: 'Why can I not pick an upcoming event for donations?',
        a: ['Event donations are taken during or after an event, so only events that have already started are offered. Anything else is recorded as standalone.'],
      },
    ],
  },
  {
    title: 'Messages, roster and profile',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I reach another Brother Knight?',
        a: ['Member Actions → Fraternal roster lists active members of your council and its sister councils with phone and email. You can also message them through the Communications Hub.'],
      },
      {
        q: 'How do I update my phone, email or skills?',
        a: [
          'Open My Profile. Save contact details to update phone, email and address; changing the email changes your sign-in too.',
          'Record your trade skills and training so Admins can find you for projects. Name, member number, degree and type are kept by your council’s Admins.',
        ],
      },
    ],
  },
  {
    title: 'Events, shifts and twins',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I build a multi-day event?',
        a: [
          'Event planner → New event. Enter name, description, Starts and Ends dates, location, category, owner, and tick every council sharing the event. Save.',
          'In the Shifts panel add one row per day and time slot with its volunteers needed. Each shift date must fall inside the event.',
        ],
      },
      {
        q: 'What does Copy as a twin copy?',
        a: [
          'Details, councils and every shift, moved by the same number of days to the New first day you choose.',
          'Sign-ups, logged hours, post-event results and lessons are not copied.',
        ],
      },
      {
        q: 'Why can I not delete a shift, member or lookup value?',
        a: [
          'Nothing cascades: a record that others still point to (sign-ups, logged hours, donations, messages) is refused as in use, so history is never lost. Remove or reassign the dependants first, or keep the record.',
        ],
      },
    ],
  },
  {
    title: 'Roster and trade skills',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I find members with a particular trade?',
        a: [
          'Member roster → Skills opens the Council skills drawer with every skill and how many members hold it. Choose one to see the holders.',
          'Write a note and select Send to message all of them at once. Only active members receive it, never you, and replies arrive in the Communications Hub.',
        ],
      },
      {
        q: 'How do I add a new member?',
        a: [
          'Member roster → Add member. The email you enter is the member’s login; they then create their password on the phone.',
          'Admins may grant Admin or Member; only a Super Admin may grant Super Admin.',
        ],
      },
    ],
  },
  {
    title: 'Audits and the post-event ledger',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I review no-shows?',
        a: [
          `Executive Summaries → Executive audits → No-show audit lists every no-show in the last ${NO_SHOW_AUDIT_MONTHS} months with its reason code, newest first.`,
          'Rows with a red “No reason provided” pill need follow-up; the header counts them. The audits are for Admins and Super Admins only.',
        ],
      },
      {
        q: 'What is the Shifts awaiting hours list?',
        a: [
          'Volunteers who worked a past shift (not no-shows) and have not logged hours, with their phone number.',
          `From day ${HOURS_REMINDER_FIRST_DAY} the row turns red as ⚠ Overdue and shows the log-by date. Rows past ${SHIFT_HISTORY_MONTHS} months show Closed because the hours can no longer be recorded.`,
        ],
      },
      {
        q: 'Why are the cash and electronic fields locked on the ledger?',
        a: [
          'Once cash or electronic donations are recorded for an event, the ledger shows “Synced from donations” and those totals follow the donations. Correct the donations instead. Physical items never count toward the funds.',
        ],
      },
      {
        q: 'Who can record an event’s results?',
        a: ['Admins of any council linked to the event, any Super Admin, and the event’s owner. Choose the event in the Active queue, save the results, and add lessons learned.'],
      },
    ],
  },
  {
    title: 'Council lookups, donations and summaries',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I set up donation types and methods?',
        a: [
          'Council lookups → Donation types and Enabled donation methods. Paste the council’s QR image link for Venmo, Zelle, Zeffy or ParishSoft.',
          'Changes are saved together: if one row is refused, none are written. Fix the named row and save again.',
          'Admins, Super Admins, Treasurers and Financial Secretaries maintain the donation lookups; only Admins and Super Admins maintain Activities.',
        ],
      },
      {
        q: 'Who can correct or delete a donation?',
        a: ['The member who recorded it, the event’s owner, the council’s Treasurer, Financial Secretary and Admins, and any Super Admin. A donation’s council and recorder never change.'],
      },
      {
        q: 'How do I read the monthly executive scorecard?',
        a: [
          'Total labor hours: shift plus activity hours logged in the month. Unique Knights participating: distinct members who logged any time.',
          'Net balance: cash plus electronic funds raised minus spend for the month’s events. Community outreach: actual attendees at those events.',
          `Figures grow as members log hours, which may be up to ${SHIFT_HISTORY_MONTHS} months after a shift, so re-check a recent month later.`,
        ],
      },
      {
        q: 'A Treasurer lost access to Donations after a role was renamed.',
        a: ['Finance access follows the role names “Treasurer” and “Financial Secretary”. A Super Admin should restore the exact name under System lookups → Role.'],
      },
    ],
  },
];

const slug = (title: string) => `help-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const matches = (topic: Topic, words: string[]) => {
  const text = `${topic.q} ${topic.a.join(' ')}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const shown = SECTIONS.map((s) => ({ ...s, topics: s.topics.filter((t) => matches(t, words)) })).filter((s) => s.topics.length > 0);
  const count = shown.reduce((n, s) => n + s.topics.length, 0);

  return (
    <>
      <PageTitle>Online Help Center</PageTitle>
      <div className="flex max-w-4xl flex-col gap-4">
        <p className="text-sm">
          Quick answers drawn from the Member User Guide and the Administrator Operations Manual. Select a question to open its answer. Still stuck? Message your
          council&apos;s Admin through the Communications Hub.
        </p>
        <Field label="Search help" hint={searching ? `${count} answer${count === 1 ? '' : 's'} match; matching questions open automatically.` : undefined} className="max-w-md">
          {(id) => <Input id={id} type="search" value={query} placeholder="e.g. QR code, 15 minutes, no-show" onChange={(e) => setQuery(e.target.value)} />}
        </Field>
        {shown.length === 0 ? <Empty>No answer matches “{query}”. Try fewer or different words.</Empty> : null}
        {shown.map((section) => (
          <section key={section.title} aria-labelledby={slug(section.title)} className="rounded border border-line bg-white">
            <header className="flex items-center justify-between gap-3 border-b-4 border-gold bg-white px-4 py-2">
              <h2 id={slug(section.title)} className="font-serif text-lg font-bold text-navy">
                {section.title}
              </h2>
              <Pill tone={section.audience === 'Everyone' ? 'outline' : 'navy'}>{section.audience}</Pill>
            </header>
            <div className="divide-y divide-line">
              {section.topics.map((topic) => (
                // Remounting on search changes lets matches open while still letting the reader close them.
                <details key={`${topic.q}-${searching}`} open={searching} className="group px-4">
                  <summary className="flex cursor-pointer list-none items-start gap-2 py-2 text-sm font-bold text-navy">
                    <span aria-hidden="true" className="w-3 shrink-0 transition-transform group-open:rotate-90">
                      ›
                    </span>
                    <span className="group-hover:underline">{topic.q}</span>
                  </summary>
                  <div className="flex flex-col gap-2 pb-3 pl-5 text-sm leading-relaxed">
                    {topic.a.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
