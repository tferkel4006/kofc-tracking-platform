# Publish a standard operating procedure

## About the SOP Center

The SOP Center shows the standard operating procedures (SOPs) of the council. Every signed-in member can read the SOPs.

Each SOP is one markdown file in the `docs/sop/` folder of the platform code. The SOP Center reads the folder when the portal is built. The first `# ` heading of a file is the SOP title in the list.

Each SOP follows the technical-writer rules. Each task has the headings Goal, Start point, Steps, Expected result and Common problems.

## Add or change an SOP

> **Who can do this:** a maintainer with write access to the platform code repository. Members cannot add SOPs from the portal.
> **Warning:** a file that you delete from `docs/sop/` disappears from the SOP Center at the next build. Git keeps the old version.

**Goal:** Publish a new SOP, or change an SOP, in the SOP Center.

**Start point:** The `docs/sop/` folder in the platform code repository.

**Steps:**
1. Create a file in `docs/sop/`. Name the file with lowercase words and hyphens, for example `record-a-hand-vote.md`.
2. Write the title on the first line, after `# `.
3. Write a concept section that explains the feature.
4. Write each task with the five workflow headings.
5. Put the **Who can do this** line and any **Warning** line before the Goal.
6. Commit the file to Git.
7. Build the portal again with `npm run build:web`.

**Expected result:** The SOP title shows in the **Procedures** list of the SOP Center. Selecting the title shows the SOP.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| The SOP does not show in the list. | The file name does not end in `.md`, or the portal was not built again. | Rename the file to end in `.md`, then build the portal again. |
| The list shows the file name, not the title. | The file has no line that starts with `# `. | Add the title as the first line, after `# `. |
| An image does not show. | The image address does not start with `https://`. | Upload the image to Google Drive and link to it with an `https://` address. |
