~~todo: point calc fix, widen UI, review past materials, many per job (?)~~
## Hot patch: enhance weekly timetable
- [x] Make the weekly timetable the source of truth for recurring schedules:
  - [x] Add a dedicated Monday-Sunday timetable editor; keep importing an existing week as an optional setup shortcut.
  - [x] Define recurring entries with weekday, time, task type, assigned person, planned points, an explicit start date, and an optional end date.
  - [x] Project dated occurrences for requested ranges without creating session rows just because a week is viewed; use shared expansion logic across schedule views and monthly summaries.
  - [x] Keep sessions as dated records of completion, credited points, actual details, and occurrence-specific notes.
- [x] Give recurring entries stable series IDs; replace task/weekday/time similarity matching for bulk operations.
- [x] Preserve earlier timetable settings with effective-dated versions when changes apply from a selected date onward.
- [x] Make recurring entries stand out with a consistent "Weekly" badge in personal task lists, weekly schedules, planning boards, and session details; do not rely on colour alone.
- [x] Default recurring schedule edits to "This and future occurrences", with an explicit cutoff and confirmation; cover edits, drag-and-drop reassignment, moves, cancellations, and ending a series.
  - [x] Keep completion and actual-session notes occurrence-only; preserve past and completed session records.
  - [x] Decide whether to support "Only this occurrence" schedule edits; if supported, persist exceptions and show "Weekly - Modified" with the overridden details.
  - [x] Preserve existing future exceptions by default; require an explicit option to replace them.
  - [x] Apply bulk changes atomically and record their scope in schedule history.
- [x] Add a coordinated schema migration and API/client updates; preserve existing copied sessions as one-offs unless an admin explicitly groups them into a series.
- [x] Add focused tests for recurrence boundaries, version cutoffs, series isolation, historical/completed record preservation, and exceptions if supported.
- [x] Smoke-test badges and edit scope across views using a local mocked admin API.
- [ ] Verify OAuth-backed admin and D1 behavior in a browser before deployment.
- [x] Update README and API documentation to explain timetable ownership, session records, recurrence markers, and present/future edit behavior.

## Weekly timetable UX: first iteration
- [x] Add admin Weekly timetable / Dated schedule switch; retain employee dated schedule.
- [x] Reuse the dated schedule's employee-by-weekday grid and assignment form for recurring rules; show planned totals and visible effective dates.
- [x] Move import/copy and stop-all actions into secondary tools.
- [x] Use a shared scope/date/impact dialog for recurring edits, reassignment, cancellation, and ending series.
- [x] Preserve exceptions by default and keep completion/actual notes occurrence-only.
- [x] Clarify one-off creation and planned versus earned point labels; widen the scheduling workspace.
- [ ] Validate the new controls with OAuth-backed admin/employee accounts and D1 before deployment.

## Refactor
- [x] Split frontend into multiple modules
## Task
- [x] Editable individual tasks
- [ ] More edit options:
  - [x] Clone for other weekdays
  - [ ] Add/remove multiple people per task
- [x] Default clone week task to next week (not yearly repeated write)
- [ ] Auto completed task on creation (completion can be unset later on) (?)
## Employee
- [ ] Employee features:
  - [ ] Add new emp
  - [ ] Gender
# Main project requirements

## UX and UI Requirements

The project must include appropriate UX and UI design work.

Requirements include:

* Wireframes, mock-ups, and UI designs must be created according to the project requirements.
* HTML and CSS must be professionally implemented and validated.

---

## Code Quality and Documentation

Teams must follow good programming practices throughout the project.

* Code must be professionally documented and commented where appropriate.
* The application must be published and accessible on the internet.

Suitable hosting options may include:

* (We used Github Pages + Cloudflare Workers)

---

## Automated Testing

The project must include automated testing.

At minimum, the application must contain:

* **5 integration tests**
* **5 end-to-end (E2E) tests**

---

# Project Presentation

Each team will give a **presentation of less than 10 minutes** about their project, followed by approximately **five minutes of questions**. All team members must participate and be ready to explain their contributions.

Session 16 uses the first hour for the three presentations and questions, the second hour for peer testing, and the final hour for feedback triage, priority fixes, and a short team retrospective.

The presentation should approximately cover:

1. Team members
2. The idea of the application and its target audience
3. The main features and functionality of the application
4. A demonstration of the application
5. Instructions explaining how to test the application and locate all major features

The testing instructions must also be included in the project's `README.md` file.

## Presentation Format

Instead of creating a PowerPoint presentation, you may include all of the required information in your project's `README.md` file and use this during your presentation.

If you choose to use PowerPoint or another presentation tool, at minimum the following information must also appear in the `README.md` file:

* The idea of the application and its target audience
* The application's main features and functionality
* Instructions explaining how to test the application and locate all major features

---

# README.md Requirements

The project's `README.md` file must contain the relevant project information described above.

At minimum, it must include:

* **The idea and target audience of the application**
* **The application's main features and functionality**
* **Instructions for testing the application and finding all its features**

In addition, following the [GitHub README guidelines](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), your `README.md` should explain:

* **What the project does**
* **Why the project is useful**
* **How users can get started with the project**

The "getting started" section should include installation and setup instructions for users who want to run the application locally.

---

# AI Policy

As described in the course syllabus, the use of generative AI is permitted in this unit.

However, you must clearly acknowledge **where and how AI tools have been used**.

You may create a dedicated directory in your GitHub repository containing examples of how AI was used during the project.

This could include:

* Example prompts
* Example AI-generated outputs
* Explanations of how the output was used or modified
* Examples of AI-assisted debugging or development

You are expected to understand and be able to explain all work submitted as part of the project.

The lecturer may interview individual team members to confirm their understanding of the submitted work.

---

# Submission Instructions

Your group must complete the following before submission:

1. Publish a **GitHub release** for the completed project.
2. Submit the link to the GitHub release.
3. Ensure the application is published and available on the internet.
4. Follow the official submission instructions.

The final delivery deadline is **48 hours after session 16 ends**. Submit the release link through the designated LMS submission point. The README must link to the public application and make the supporting design, test, contribution, AI-use, and feedback evidence easy to find. Teachers must be able to access the feedback results.

Identify the submitted version with a GitHub release and include release notes describing priority fixes made after peer testing and any known limitations. Check that the deployed application corresponds to the submitted release. See the [final delivery checklist](../materials/reviews_and_delivery.md#final-delivery-checklist).

See:

[Assignment Submission Guidelines](https://canvasx.edu.vn/files/100938)

**The submitted application must be publicly accessible on the internet at the time of assessment.**

