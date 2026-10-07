# Edit the council bylaws

## About the Council Bylaws Data Vault

The Council Bylaws Data Vault holds the bylaws of your council. Every member of the council can read the bylaws.

The vault stores the bylaws as text with simple headings. A line that starts with `# ` starts an article. A line that starts with `## ` starts a section.

The vault splits the bylaws into numbered clauses. The clause id `A2.S3` means article 2, section 3. The parliamentary engines use these ids to cite a clause.

## Edit the bylaws

> **Who can do this:** the Grand Knight (GK) of the council, a council Admin, or a Super Admin. Other members see the bylaws but no **Edit bylaws** button.
> **Warning:** a save replaces the stored bylaws for every member of the council. The vault keeps no earlier version. Copy the old text to a file before you make large changes.

**Goal:** Change the text of the council bylaws.

**Start point:** Sidebar → Governance → Constitutional Bylaws

**Steps:**
1. Select **Edit bylaws**.
2. Change the text in the **Bylaws text** box.
3. Start each article with `# ` and each section with `## `.
4. Read the **Preview** panel. Check that each heading shows as a heading.
5. Read the **Parliamentary engine feed** panel. Check that each article and section has its own clause id.
6. Select **Save bylaws**. The new text replaces the old text for every member.

**Expected result:** The page shows the message "The bylaws are saved." The **Last saved** line shows the current date and time.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| The **Edit bylaws** button does not show. | You do not hold the GK seat or an Admin role in this council. | Ask the GK or a council Admin to make the change. |
| A heading shows as plain text in the preview. | The `#` has no space after it. | Type a space after the `#` or `##`. |
| The save fails with a length message. | The text is longer than 100,000 characters. | Remove text, or move long appendices to Google Drive and link to them. |
| A section has the wrong clause id. | The section heading uses `#` instead of `##`. | Change the section heading to start with `## `. |
