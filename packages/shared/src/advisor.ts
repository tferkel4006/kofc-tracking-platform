// =========================================================================
// AI FRATERNAL & CONSTITUTIONAL ADVISOR (Sprint 6B, Phase 4)
// adviseQuery answers an officer's parliamentary question in two tiers:
//   Tier 1 - the council's own bylaws (Council.BylawsMarkdown through bylawsTokenFeed). A clause id in the question
//            ('A2.S3') opens that clause; otherwise the clause whose words best match the question answers it.
//   Tier 2 - when the vault is empty, or no clause matches, the built-in baseline: standard parliamentary law and the
//            platform's own voting rules (hand votes, secret ballots, the 10-day rule).
// Every answer carries a Source Authority line. A question that asks for an act the baseline rules forbid (proxy
// votes, business without a quorum, opening a secret ballot ...) also carries a compliance warning, whichever tier
// answers. The engine is deterministic keyword matching - no model call, no network - so the same question always gets
// the same answer. The baseline does not quote the Order's Charter, Constitution and Laws; its authorities name the
// general rule and tell the officer to confirm the exact section with the State Deputy.
// =========================================================================
import { AGENDA_NOTICE_DAYS } from './charities';
import type { BylawsClause, BylawsTokenFeed } from './bylaws';

/** The longest question the advisor reads (characters). */
export const ADVISOR_QUERY_MAX_LENGTH = 500;

/** The longest clause excerpt a Tier 1 answer quotes (characters). */
export const ADVISOR_EXCERPT_MAX_LENGTH = 600;

export type AdvisorTier = 'bylaws' | 'baseline';

export interface AdvisorWarning {
  /** Always 'PARLIAMENTARY COMPLIANCE WARNING'. */
  title: string;
  text: string;
  authority: string;
}

export interface AdvisorAnswer {
  tier: AdvisorTier;
  answer: string;
  /** The exact clause or baseline rule the answer rests on. */
  authority: string;
  /** Tier 1: the matched clause ids, best first (at most 3). Tier 2: []. */
  clauseIds: string[];
  /** Tier 2 only: why the bylaws did not answer ('empty' vault or 'no-match'). */
  fallbackReason: 'empty' | 'no-match' | null;
  warnings: AdvisorWarning[];
}

export const COMPLIANCE_WARNING_TITLE = 'PARLIAMENTARY COMPLIANCE WARNING';

const PARLIAMENTARY_LAW = 'Standard parliamentary law (Robert’s Rules of Order, general principles)';
const CHARTER_CHECK = 'confirm the exact section of the Charter, Constitution and Laws of the Knights of Columbus with your State Deputy';

/** A baseline rule of Tier 2. */
interface BaselineRule {
  id: string;
  keywords: string[];
  answer: string;
  authority: string;
}

export const ADVISOR_BASELINE_RULES: readonly BaselineRule[] = [
  {
    id: 'quorum',
    keywords: ['quorum', 'present', 'attendance', 'enough'],
    answer:
      'The council may transact business only while a quorum is present. Without a quorum the chair may only fix the time to adjourn, adjourn, recess, or take steps to obtain a quorum. The live console locks the Active roster count when it starts, as the base for the quorum check.',
    authority: `${PARLIAMENTARY_LAW} - Quorum; platform rule: live console quorum base (Meeting.LiveQuorumRosterCount)`,
  },
  {
    id: 'motion',
    keywords: ['motion', 'move', 'second', 'propose', 'introduce', 'floor'],
    answer:
      'A member obtains the floor from the chair, states the motion ("I move that ..."), and another member seconds it. The chair then states the question, the council debates it, and the chair puts it to a vote. A motion that is not seconded is not considered.',
    authority: `${PARLIAMENTARY_LAW} - Handling a main motion`,
  },
  {
    id: 'majority',
    keywords: ['majority', 'pass', 'passes', 'tie', 'fail', 'fails', 'threshold', 'count'],
    answer:
      'A main motion passes by a majority of the votes cast: more Approved than Denied. Abstentions are not votes cast. A tie fails. The hand-vote console and the smartphone ballot apply the same rule.',
    authority: `${PARLIAMENTARY_LAW} - Majority vote; platform rule: hand-vote and ballot decision (a tie fails)`,
  },
  {
    id: 'hand-vote',
    keywords: ['hand', 'hands', 'manual', 'show', 'tally', 'recorder', 'voice', 'rising'],
    answer:
      'For a manual vote, the chair calls for a show of hands and the Recorder counts both sides on the hand-vote console. Each motion is decided by one method only: a motion that went to a smartphone ballot cannot also take a hand tally. Each side counts whole hands, and the vote counts at least one hand.',
    authority: `${PARLIAMENTARY_LAW} - Methods of voting; platform rule: Recorder's hand-vote console (one vote, one method)`,
  },
  {
    id: 'secret-ballot',
    keywords: ['ballot', 'secret', 'anonymous', 'smartphone', 'phone'],
    answer:
      'A ballot vote is secret. Each checked-in member casts one ballot: Approve, Deny or Abstain. The platform stores only a keyed hash of who voted, so no officer can see how a member voted. Elections and any question the bylaws or the council direct are decided by ballot.',
    authority: `${PARLIAMENTARY_LAW} - Voting by ballot; platform rule: secret smartphone ballots (keyed hash)`,
  },
  {
    id: 'table',
    keywords: ['table', 'tabled', 'postpone', 'postponed', 'defer', 'delay', 'later'],
    answer:
      'To put off a pending motion to a set time, move to postpone it to that meeting or hour. To set it aside temporarily for urgent business, move to lay it on the table; it can be taken from the table later. The live console records the motion as Tabled.',
    authority: `${PARLIAMENTARY_LAW} - Postpone to a certain time; Lay on the table`,
  },
  {
    id: 'reconsider',
    keywords: ['reconsider', 'rescind', 'revisit', 'undo', 'reverse', 'overturn', 'again'],
    answer:
      'To revisit a decided motion, a member who voted on the prevailing side may move to reconsider it at the same meeting. At a later meeting, the council may rescind or amend the earlier decision; this needs previous notice and a majority, or a two-thirds vote without notice.',
    authority: `${PARLIAMENTARY_LAW} - Reconsider; Rescind or amend something previously adopted`,
  },
  {
    id: 'notice',
    keywords: ['notice', 'advance', 'days', 'deadline', 'agenda', 'submit'],
    answer: `A proposed motion goes to the soonest Monthly meeting that is at least ${AGENDA_NOTICE_DAYS} calendar days away (the ${AGENDA_NOTICE_DAYS}-day rule), so every member has notice before the council votes on it.`,
    authority: `Platform rule: ${AGENDA_NOTICE_DAYS}-day agenda notice (AGENDA_NOTICE_DAYS); ${PARLIAMENTARY_LAW} - Previous notice`,
  },
  {
    id: 'bylaws-amend',
    keywords: ['bylaws', 'bylaw', 'amend', 'amendment', 'constitution', 'revise', 'change'],
    answer: `Under parliamentary law, amending the bylaws needs previous notice and a two-thirds vote, unless the bylaws set another procedure. Council bylaws must stay consistent with the laws of the Order; ${CHARTER_CHECK} before the council adopts a change.`,
    authority: `${PARLIAMENTARY_LAW} - Amending bylaws; Knights of Columbus baseline (${CHARTER_CHECK})`,
  },
  {
    id: 'election',
    keywords: ['election', 'elect', 'elected', 'nominate', 'nomination', 'officer', 'officers', 'term'],
    answer: `Officers are nominated and then elected by secret ballot, by a majority of the votes cast, at the meeting the bylaws set. Use the Elections pages to record nominations and results. For the election calendar and eligibility, ${CHARTER_CHECK}.`,
    authority: `${PARLIAMENTARY_LAW} - Nominations and elections; Knights of Columbus baseline (${CHARTER_CHECK})`,
  },
  {
    id: 'order-of-business',
    keywords: ['order', 'business', 'agenda', 'minutes', 'reports', 'unfinished', 'new'],
    answer:
      'The standard order of business is: reading and approval of the minutes, reports of officers, reports of committees, unfinished business, and new business. The council may adopt its own order in its bylaws or standing rules.',
    authority: `${PARLIAMENTARY_LAW} - Standard order of business`,
  },
  {
    id: 'point-of-order',
    keywords: ['point', 'order', 'chair', 'ruling', 'appeal', 'interrupt'],
    answer:
      'A member who believes a rule is being broken rises to a point of order; the chair rules on it at once. Any two members (one moving, one seconding) may appeal the ruling, and the council then decides by majority vote.',
    authority: `${PARLIAMENTARY_LAW} - Point of order; Appeal`,
  },
  {
    id: 'spending',
    keywords: ['spend', 'spending', 'funds', 'money', 'pay', 'payment', 'expense', 'donate', 'donation', 'charity', 'check', 'budget'],
    answer:
      'Council funds are spent only on the authority of a council vote or the adopted budget. Expense reports need the Financial Secretary and the Grand Knight to sign before the Treasurer pays them, and charity grants go to the floor as motions.',
    authority: `${PARLIAMENTARY_LAW} - Authority of the assembly; platform rule: dual-signed expense reports and charity motions`,
  },
];

/** A forbidden act a question may ask for. */
interface ComplianceRule {
  id: string;
  pattern: RegExp;
  text: string;
  authority: string;
}

export const ADVISOR_COMPLIANCE_RULES: readonly ComplianceRule[] = [
  {
    id: 'proxy',
    pattern: /\bprox(y|ies)\b|\bvote (for|on behalf of) (an? )?(absent|another|other)\b/,
    text: 'Proxy voting is not allowed. A member votes only in person, at the meeting, unless the governing laws expressly allow otherwise.',
    authority: `${PARLIAMENTARY_LAW} - Proxy voting`,
  },
  {
    id: 'no-quorum',
    pattern: /\b(without|no|lack(ing)?|below|under|short of|skip(ping)?|ignor(e|ing)|waiv(e|ing)|less than)\b( an?| the)? quorum\b/,
    text: 'Business transacted without a quorum is void. Without a quorum, only adjourn, recess, fix the time to adjourn, or obtain a quorum.',
    authority: `${PARLIAMENTARY_LAW} - Quorum`,
  },
  {
    id: 'non-member-vote',
    pattern: /\b(non-?members?|guests?|visitors?|spouses?|wives|former members?|suspended members?)\b.{0,40}\bvot(e|es|ing)\b|\bvot(e|es|ing)\b.{0,40}\b(non-?members?|guests?|visitors?)\b/,
    text: 'Only members of the council in good standing vote. Guests, visitors and non-members may not vote.',
    authority: `${PARLIAMENTARY_LAW} - Right to vote; Knights of Columbus baseline (${CHARTER_CHECK})`,
  },
  {
    id: 'open-ballot',
    pattern: /\b(reveal|see|show|find out|disclose|unseal|unmask|identify|know)\b.{0,40}\b(who|how)\b.{0,30}\bvot(ed|e|ing)\b|\b(reveal|unseal|unmask|disclose)\b.{0,20}\bballots?\b/,
    text: 'A secret ballot stays secret. No officer may learn or disclose how a member voted, and the platform keeps no record that could show it.',
    authority: `${PARLIAMENTARY_LAW} - Voting by ballot; platform rule: secret smartphone ballots (keyed hash)`,
  },
  {
    id: 'unauthorized-spend',
    pattern: /\b(spend|pay|withdraw|transfer|disburse|donate|write a check)\b.{0,60}\bwithout\b.{0,30}\b(vote|approval|motion|authori[sz]ation|council)\b/,
    text: 'Council funds may not be spent without the authority of a council vote or the adopted budget.',
    authority: `${PARLIAMENTARY_LAW} - Authority of the assembly; platform rule: dual-signed expense reports`,
  },
  {
    id: 'alter-result',
    pattern: /\b(change|alter|edit|override|overrule|flip|falsify)\b (the |a |that |this |our )?(final )?(vote|votes|vote result|result|results|tally|tallies|ballot|ballots|count)\b/,
    text: 'A recorded vote result stands as announced. The chair may not change it; the council can only reconsider, rescind or amend the decision by a new vote.',
    authority: `${PARLIAMENTARY_LAW} - Announcing the vote; Reconsider; Rescind`,
  },
  {
    id: 'bylaws-no-notice',
    pattern: /\bsuspend\b.{0,30}\bbylaws?\b|\b(amend|change|revise)\b.{0,30}\bbylaws?\b.{0,40}\bwithout\b.{0,20}\b(notice|vote)\b/,
    text: 'Bylaws cannot be suspended, and they are amended only by the procedure they set: by default, previous notice and a two-thirds vote.',
    authority: `${PARLIAMENTARY_LAW} - Bylaws; Knights of Columbus baseline (${CHARTER_CHECK})`,
  },
  {
    id: 'double-vote',
    pattern: /\bvot(e|ing)\b.{0,20}\b(twice|two times|more than once|again on the same)\b|\b(two|2|extra|second) (votes|ballots)\b/,
    text: 'Each member has one vote on each question. No member may vote twice, and the platform accepts one ballot per member per motion.',
    authority: `${PARLIAMENTARY_LAW} - One member, one vote; platform rule: one ballot per member`,
  },
];

const STOPWORDS = new Set(
  'a an and are as at be by can could do does for from has have how i if in into is it its may me might must my of on or our should so that the their them then there they this to us was we what when where which who why will with would you your council knight knights'.split(' '),
);

const normalize = (w: string): string => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** The question's search words: lower case, no stopwords, a plural 's' dropped. */
export function advisorKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    out.add(normalize(w));
  }
  return [...out];
}

const CLAUSE_ID = /\bA(\d+)(?:\.S(\d+))?\b/i;

/** The first ADVISOR_EXCERPT_MAX_LENGTH characters of a clause, cut at a word. */
export function clauseExcerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= ADVISOR_EXCERPT_MAX_LENGTH) return flat;
  const cut = flat.slice(0, ADVISOR_EXCERPT_MAX_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)} …`;
}

const clauseAuthority = (c: BylawsClause): string => `Council Bylaws, clause ${c.id}${c.path.length > 0 ? ` - ${c.path.join(' › ')}` : ' - Preamble'}`;

/** Ranks the clauses against the keywords; a clause matches when it shares at least a third of them (minimum one). */
export function rankClauses(clauses: readonly BylawsClause[], keywords: readonly string[]): BylawsClause[] {
  if (keywords.length === 0) return [];
  const needed = Math.max(1, Math.ceil(keywords.length / 3));
  return clauses
    .map((c, index) => {
      const words = new Set((`${c.path.join(' ')} ${c.text}`.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(normalize));
      const heading = new Set((c.path.join(' ').toLowerCase().match(/[a-z0-9]+/g) ?? []).map(normalize));
      const hits = keywords.filter((k) => words.has(k)).length;
      const headingHits = keywords.filter((k) => heading.has(k)).length;
      return { c, index, hits, score: hits * 2 + headingHits };
    })
    .filter((r) => r.c.text !== '' && r.hits >= needed)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.c);
}

/** The compliance warnings the question raises, in ADVISOR_COMPLIANCE_RULES order. */
export function complianceWarnings(query: string): AdvisorWarning[] {
  const text = query.toLowerCase().replace(/\s+/g, ' ');
  return ADVISOR_COMPLIANCE_RULES.filter((r) => r.pattern.test(text)).map((r) => ({ title: COMPLIANCE_WARNING_TITLE, text: r.text, authority: r.authority }));
}

function baselineAnswer(keywords: readonly string[]): { answer: string; authority: string } {
  let best: BaselineRule | null = null;
  let bestHits = 0;
  for (const rule of ADVISOR_BASELINE_RULES) {
    const hits = keywords.filter((k) => rule.keywords.some((w) => normalize(w) === k)).length;
    if (hits > bestHits) {
      best = rule;
      bestHits = hits;
    }
  }
  if (!best) {
    return {
      answer:
        'The baseline rules do not cover this question. Ask it with parliamentary terms such as motion, quorum, ballot, hand vote, table, reconsider, notice, election or bylaws, or enter the council bylaws in the Constitutional Bylaws vault.',
      authority: `${PARLIAMENTARY_LAW} - no matching rule`,
    };
  }
  return { answer: best.answer, authority: best.authority };
}

/**
 * Answers a question. Tier 1 reads the bylaws feed; Tier 2 answers from ADVISOR_BASELINE_RULES when the feed has no
 * clauses or none matches. Rejects nothing: an empty question gets the Tier 2 'no matching rule' answer.
 */
export function adviseQuery(feed: Pick<BylawsTokenFeed, 'clauses'>, query: string): AdvisorAnswer {
  const question = query.slice(0, ADVISOR_QUERY_MAX_LENGTH);
  const warnings = complianceWarnings(question);
  const clauses = feed.clauses.filter((c) => c.text !== '');
  if (clauses.length > 0) {
    const ref = CLAUSE_ID.exec(question);
    const id = ref ? (ref[2] ? `A${ref[1]}.S${ref[2]}` : `A${ref[1]}`) : null;
    const direct = id ? clauses.find((c) => c.id === id) : undefined;
    const ranked = direct ? [direct] : rankClauses(clauses, advisorKeywords(question));
    if (ranked.length > 0) {
      const top = ranked[0];
      return { tier: 'bylaws', answer: clauseExcerpt(top.text), authority: clauseAuthority(top), clauseIds: ranked.slice(0, 3).map((c) => c.id), fallbackReason: null, warnings };
    }
  }
  const base = baselineAnswer(advisorKeywords(question));
  return { tier: 'baseline', ...base, clauseIds: [], fallbackReason: clauses.length > 0 ? 'no-match' : 'empty', warnings };
}
