---
name: technical-writer
description: Writes and revises KofC platform user manuals, SOPs and help answers in Simplified Technical English, with task workflows, front-loaded role limits and protected images.
---

# Technical Writer

Use this skill to write or revise any user-facing documentation for the KofC tracking platform: the user guides in
`docs/`, `user_guide.md`, the Online Help Center answers (`apps/web/app/help/page.tsx`), SOPs and release notes.

## 1. Sentence rules (Simplified Technical English)

- Write short sentences. Keep each sentence under 20 words for steps and under 25 words for descriptions.
- Put exactly one idea in each sentence. Split a sentence that contains "and then", "which" or a semicolon.
- Use the active voice and the present tense. Write "The Grand Knight signs the report", not "The report is signed".
- Write steps in the imperative. Start each step with a verb: "Select", "Enter", "Tap", "Open".
- Use one word for one meaning. Do not alternate "member", "user" and "Knight" for the same person.
- Use the exact on-screen label in **bold**. Copy the label from the code, with the same capital letters.

## 2. Remove vague text

- Delete filler: "simply", "just", "easily", "basically", "note that", "please".
- Replace vague quantities with numbers. Write "within 30 days", not "soon" or "after a while".
- Replace "it", "this", "that" and "they" when the noun is not clear from the same sentence. Repeat the noun.
- Name the actor in every rule. Write "A Trustee may vet the request", not "The request may be vetted".

## 3. Minimize jargon

- Use the plain word first. Give the official KofC term in parentheses once: "the annual report (Form 1728)".
- Define each acronym on first use in each document: "Grand Knight (GK)".
- Do not use developer terms in member documents: no "flag", "route", "driver", "modal" or "API".

## 4. Separate concepts from tasks

Keep two kinds of section apart. Never mix them in one section.

- **Concept sections** explain what a feature is and why it exists. They contain no numbered steps.
- **Task sections** tell the reader how to do one job. They follow the workflow template in section 5.

Put the concept section first. Link from the task to the concept when the reader needs background.

## 5. Workflow template

Write every task with these five headings, in this order:

```markdown
### <Task name, as a verb phrase: "Approve an expense report">

> **Who can do this:** <roles>. Other members do not see this page.
> **Warning:** <data-loss or irreversible effect, if any>

**Goal:** <one sentence: what the reader achieves>

**Start point:** <exact page and menu path: Sidebar → Finances → GK Expense Authorize>

**Steps:**
1. <one action per step>
2. <one action per step>

**Expected result:** <what the reader sees when the task succeeds>

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| <symptom the reader sees> | <why> | <one action> |
```

### Front-load restrictions and warnings

- Put the **Who can do this** line before the Goal. The reader must know at once if the task is not theirs.
- Put the **Warning** line before the steps for any action that deletes data, cannot be undone, sends messages, or posts money.
- Repeat the warning inside the step that causes the effect: "5. Select **Delete**. You cannot undo this."
- Omit the Warning line only when the task changes nothing permanent.

## 6. Visual anchors

- Use the 7-pillar sidebar names as the first part of every web start point: Governance, Faith In Action, Finances,
  Performance, Resources, Answers, Setup.
- Use the phone tab names for phone start points: Home, Mtgs, Signup, Report, Donate.
- Use arrows (→) for menu paths. Use **bold** for buttons and labels. Use `code` only for typed values.
- Use a table for any comparison of more than two items or roles.
- Use a numbered list for steps and a bulleted list for options. Keep a list to nine items or fewer.

## 7. Protect embedded images

Never delete, move or rewrite an image line during a revision. Wrap each embedded image in a keep block:

```markdown
<!-- KEEP_IMAGE: <short reason, e.g. "live console agenda screenshot"> -->
![Live Meeting Console with the agenda open](../generated/guide/live-console.png)
<!-- /KEEP_IMAGE -->
```

- Treat everything between `<!-- KEEP_IMAGE: ... -->` and `<!-- /KEEP_IMAGE -->` as read-only. Copy it unchanged.
- Add a keep block around any existing image that does not have one.
- Keep the image path exactly as written. Guide images use `../generated/` paths.
- You may revise the alt text only when it is empty or wrong. Keep alt text under 15 words.

## 8. Final check

Before you finish, check each item:

- [ ] Every sentence has one idea and is under the word limit.
- [ ] Every pronoun has a clear noun in the same sentence.
- [ ] Every task has Goal, Start point, Steps, Expected result and Common problems.
- [ ] Every restricted task starts with **Who can do this**.
- [ ] Every destructive or irreversible task has a **Warning** before the steps.
- [ ] Every image is inside an unchanged KEEP_IMAGE block.
- [ ] Every on-screen label matches the code exactly.
