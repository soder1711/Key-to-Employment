~~todo: point calc fix, widen UI, review past materials, many per job (?)~~
## Hot patch: enhance weekly timetable v2

- [x] Add distinct default assignment views for admins:
  - [x] **Schedule:** default to a weekly grid of fixed recurring task definitions (weekday, task, time, points); new rules have no default assignee.
  - [x] **Plan:** default to the selected week's dated occurrences. Dragging employees assigns them to that occurrence's timetable task, not to the recurring rule.
- [x] Implement the distinct visual layouts (the default routing/assignment behavior above is already in place):
  - [x] **Schedule:** render the attached mockup as a weekly assignment matrix: fixed timetable task slots grouped by weekday as columns, employees as rows, with occurrence assignments visible in the corresponding cells.
  - [x] **Plan:** retain the dated-sessions look, but build each day's fixed task list from the timetable and show/edit assignees from the occurrence-assignment data. Changes in Plan apply to that date only; do not edit the recurring timetable.
- [x] Store assignments as employee-to-occurrence links: no rows means unassigned; one or more rows means the occurrence's assignees. Reuse the timetable task/occurrence rather than creating duplicate task or session records per employee. Support one-off timed sessions as well as projected recurring occurrences.
- [x] Keep completion/status shared on the single dated occurrence. Award the full session points to each assignee when completed; show estimated points per employee as a separate projection assuming all assigned sessions are completed. Combined employee points may exceed the session's points.
- [x] Make Plan drag/drop add or remove an employee's assignment for that date only; do not modify the recurring task definition or assignments on other dates. Update employee-specific schedule/task reads to use these links.
- [x] Add minimal schema/API support for occurrence assignment links and migrate existing employee assignments without changing who is assigned to existing occurrences. New recurring task definitions remain unassigned by default.
- [x] Add focused tests for unassigned/single/multiple assignees, dated-vs-recurring isolation, migration preservation, and estimated/credited point totals; update README guidance.

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

