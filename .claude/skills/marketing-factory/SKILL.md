---
name: marketing-factory
description: Writes KofC platform flyers, landing pages and pitch decks in warm non-profit voice, with Stewardship Management Platform framing, a banned-jargon matrix and persona-targeted layouts. Also plans and writes public event marketing (fish fries, drives, festivals) with a four-tier engine and fixed output headers.
---

# Marketing Factory

Use this skill to write any outward-facing marketing copy for the KofC tracking platform: flyers, landing pages,
pitch decks, one-pagers, email announcements and demo scripts. Do not use it for user manuals, SOPs or help
answers. Those belong to the `technical-writer` skill.

## 1. Voice and non-profit copywriting constraints

- Write for volunteers, pastors and diocesan leaders, not for IT buyers. Lead with the mission, then the tool.
- Use warm, plain, hopeful language. Every claim must answer "how does this help the council serve more people?"
- Say "the council", "Knights", "families" and "the parish". Never say "customers", "users", "end users" or "seats".
- Talk about dollars as gifts held in trust. Never describe money as "revenue", "spend" or "budget burn".
- Keep sentences under 25 words. Keep headlines under 10 words. One idea per paragraph.
- Do not invent numbers. Every statistic, testimonial or dollar figure must come from the repo, the seed data
  labelled as demo data, or the user. Mark demo figures as "illustrative".
- Do not use the Knights of Columbus emblem, Supreme Council branding or official seals. Say "built for
  Knights of Columbus councils", never "official" or "endorsed by Supreme" unless the user supplies that approval.
- Never promise legal, tax or canonical compliance. Say "helps you stay ready for" an audit, not "guarantees".

## 2. Positioning frameworks (mandatory)

### 2.1 Stewardship Management Platform

Name the product category as a **Stewardship Management Platform** on every piece. Never call it "software",
"an app", "an ERP", "a CRM" or "a system" in a headline. The platform helps a council steward three gifts:

| Gift     | What the council stewards                 | Platform proof points                                  |
|----------|-------------------------------------------|--------------------------------------------------------|
| Time     | Volunteer hours and shifts                | Event signups, rapid-tap check-in, hours charts        |
| Treasure | Donations, dues and charitable gifts      | Double-entry ledger, expense reports, charity vetting  |
| Talent   | Leadership, meetings and member growth    | Live assembly, secret ballots, bylaws vault, onboarding |

### 2.2 Mission Toolkits

Group features into **Mission Toolkits**, never into "modules", "features", "add-ons" or "packages". Present
each toolkit with: a mission-first name, the people it serves, and the one outcome it delivers. Map toolkits to
the seven sidebar pillars so the pitch matches what the buyer sees in the demo.

## 3. Jargon-scrubbing lookup matrix (enforced)

Before you deliver any copy, replace every banned term with its approved term. The banned terms are not
allowed anywhere: headlines, body, captions, alt text, speaker notes or file names.

| Banned term (any case or plural)    | Approved replacement                  |
|-------------------------------------|---------------------------------------|
| Resource Allocation                 | Mission Deployment                    |
| Operational Efficiency              | Maximizing Dollars for the Cause      |
| Labor Units                         | Changemakers                          |
| Modules / Module                    | Mission Toolkits / Mission Toolkit    |
| Headcount / Human resources / FTEs  | Changemakers                          |
| Users / End users / Customers       | Knights / members / the council       |
| Cost center / Overhead reduction    | Maximizing Dollars for the Cause      |
| Throughput / Utilization            | Mission Deployment                    |
| Leverage / Synergy / Disrupt        | (rewrite the sentence in plain words) |

Rewrite the sentence when a direct swap reads badly. Do not just paste the new term into a cold sentence.

### 3.1 Mandatory self-check

Run this scan on every file you produce and fix every hit before you deliver:

```bash
grep -inE "resource allocation|operational efficiency|labou?r units?|\bmodules?\b|headcount|human resources|\bFTEs?\b|\bend users?\b|\bcustomers?\b|cost cent(er|re)|overhead reduction|throughput|utili[sz]ation|leverage|synerg|disrupt" <file>
```

An empty result is required. Report the scan result in your final message.

## 4. Enterprise pitch matrix

Every flyer, landing page and pitch deck must carry all three narratives below. Weight them by persona (section 5).

1. **Single Source of Truth.** One record for members, hours, meetings, money and gifts. No more spreadsheets
   passed between officers, no lost binders at officer turnover.
2. **Audit and compliance readiness.** Double-entry ledger, receipts attached to expenses, logged votes and
   vetting trails. The council is ready when the auditors or the Trustees ask.
3. **Top-Down Diocesan Funding model.** A diocese or state council funds the platform once and deploys it to
   every parish council beneath it. Local councils pay nothing and spend their dollars on the cause.

## 5. Persona-targeted layouts

Pick one primary persona per piece. State the persona at the top of your draft (not in the published copy).

| Persona                          | Primary narrative          | Lead headline angle                         | Call to action                      |
|----------------------------------|----------------------------|---------------------------------------------|-------------------------------------|
| Bishop / Diocesan finance office | Top-Down Diocesan Funding  | One investment, every parish council served | Schedule a diocesan briefing        |
| State Deputy / State Council     | Single Source of Truth     | See every council's mission in one place    | Pilot with five councils            |
| Grand Knight                     | Single Source of Truth     | Spend your term on the mission, not paperwork | Book a 20-minute council demo       |
| Financial Secretary / Treasurer  | Audit and compliance       | Close the books with confidence             | See the ledger walkthrough          |
| Trustees                         | Audit and compliance       | Every gift vetted, every vote recorded      | Request the stewardship audit tour  |
| Pastor / Chaplain                | Mission Deployment         | More Knights serving more families          | Invite the council to a parish demo |

### 5.1 Flyer layout (one page)

1. Headline (persona angle) and one-line subhead naming the Stewardship Management Platform.
2. Three Mission Toolkit tiles with one outcome each.
3. One proof block from the pitch matrix weighted to the persona.
4. Single call to action with a contact line. No more than 120 words in total.

### 5.2 Landing page layout

1. Hero: headline, subhead, one call to action.
2. "The problem today": scattered spreadsheets, officer turnover, audit stress (2-3 short lines).
3. The three narratives from section 4, primary narrative first.
4. Mission Toolkits grid mapped to the seven pillars.
5. Diocesan funding explainer with a simple "Diocese funds, parishes serve" diagram.
6. Closing call to action and FAQ (3-5 questions).

### 5.3 Pitch deck layout (10-12 slides)

1. Title and mission line. 2. The stewardship problem. 3. Single Source of Truth. 4. Mission Toolkits overview.
5-7. One slide per toolkit group (Time, Treasure, Talent). 8. Audit and compliance readiness.
9. Top-Down Diocesan Funding model. 10. Rollout plan. 11. Call to action. Optional 12: Q&A.
Put supporting detail in speaker notes, not on the slide. Keep slide text under 30 words.

## 6. Delivery checklist

- [ ] Persona named and primary narrative chosen.
- [ ] "Stewardship Management Platform" appears at least once; "Mission Toolkits" used for feature groups.
- [ ] All three pitch-matrix narratives present.
- [ ] Jargon scan (section 3.1) returns no hits.
- [ ] No invented numbers, testimonials or endorsements; demo figures marked "illustrative".
- [ ] No official KofC emblems or Supreme endorsement claims.
- [ ] Format matches the request: use the Slides artifact type or the `pptx` skill for decks, an HTML artifact
      for landing pages, and the `pdf` skill or an artifact for print flyers.

## 7. Public Event Marketing and Communications Assistant

Use this role engine when the request promotes one public event: a fish fry, pancake breakfast, coat drive,
blood drive, Tootsie Roll drive, parish festival, family Mass or open house. The audience is the parish and the
neighborhood, not a diocese or a buyer. Write for faith-based and mission-driven associations in a warm,
welcoming, community-centric voice.

### 7.1 Scope and precedence

- Sections 1 and 3 still apply in full: the voice rules, the no-invented-numbers rule, the no-emblem rule and the
  jargon scan.
- Sections 2, 4 and 5 do not apply to public event assets. Do not pitch the platform, name the Stewardship
  Management Platform or carry the enterprise narratives unless the user asks for it.
- Speak to neighbors and families as guests. Say "join us", "bring the family", "all are welcome".
- Get the event facts (name, date, time, place, cost, beneficiary, contact) from the user or the repo. When a fact
  is missing, write a clear placeholder such as `[DATE]` or `[PARISH HALL ADDRESS]`. Never guess.

### 7.2 The four-tiered public event engine (mandatory)

Work through all four tiers in order. Do not skip a tier.

1. **Define and Distill.** Write the event goal in one sentence (for example, gifts raised, coats collected,
   families served). Name the target audience. Choose one clear call to action (CTA) and use the same CTA
   wording in every asset.
2. **Mobilize the Core.** Equip Knights, families and parish supporters before the public hears about it:
   word-of-mouth talking points, a supporter social pack (ready-to-share posts and captions), and an internal
   rollout plan (council meeting announcement, officer roles, volunteer signup push).
3. **Digital Front Door.** Write the online assets: landing page copy, social reel scripts (15-30 seconds, hook
   in the first 3 seconds), email newsletter copy, and targeted text alerts (160 characters or fewer, CTA plus
   date).
4. **Community Touchpoints.** Plan the in-person reach: parish and neighborhood bulletin board notices, a print
   flyer (section 5.1 word limit applies), pulpit or bulletin announcements, and local business
   cross-promotions (counter cards, window posters, "show your receipt" partner offers).

### 7.3 Required output structure (enforced)

Format every public event response with exactly these four markdown headers, in this order. Do not rename,
merge or add top-level headers. Put tier work under the header shown.

```markdown
## 🎯 Event Blueprint
<!-- Tier 1: goal, target audience, single CTA, key facts and placeholders -->

## 👥 Core Mobilization Pack
<!-- Tier 2: word-of-mouth templates, supporter social pack, internal rollout plan -->

## 🌐 Digital Front Door Plan
<!-- Tier 3: landing page copy, social reels, email newsletter, text alerts -->
<!-- Tier 4: bulletin boards, flyers, local business cross-promotions (as a "Community Touchpoints" subsection) -->

## 📅 30-Day Launch Timeline
<!-- Day-by-day or week-by-week plan from Day -30 to event day, plus a thank-you follow-up -->
```

### 7.4 30-Day Launch Timeline pattern

| Window        | Focus                                                                  |
|---------------|------------------------------------------------------------------------|
| Day -30 to -22 | Define and Distill locked; council announcement; volunteer signups open |
| Day -21 to -15 | Core Mobilization Pack shared; local business partners asked           |
| Day -14 to -8  | Landing page and email live; flyers and bulletin notices posted        |
| Day -7 to -1   | Social reels; reminder email; text alert on Day -1                     |
| Event day      | Day-of text alert; live social posts; welcome table                    |
| Day +1 to +3   | Thank-you email and post; share illustrative or real results only      |

### 7.5 Public event delivery checklist

- [ ] All four headers from section 7.3 present, in order, with no extra top-level headers.
- [ ] One CTA, worded the same in every asset.
- [ ] All four engine tiers covered (Community Touchpoints sits under the Digital Front Door Plan header).
- [ ] Missing facts shown as placeholders, not guessed.
- [ ] Jargon scan (section 3.1) returns no hits. Partner businesses' shoppers are "neighbors" or "guests".
- [ ] No official KofC emblems or Supreme endorsement claims.
