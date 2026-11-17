# Web Application Project

The objective of this project is to build a functional web application with:

* A frontend
* A backend
* A database
* Appropriate UI/UX design
* Deployment on the internet

The minimum and expanded requirements for each project will be provided in a separate project brief.

Each group will work on a different industry-related project and produce something of practical value. You will combine the knowledge and skills you have developed throughout your studies up to this point.

Projects are completed in teams of a maximum of **three students**.

The projects will be presented in **session 16, during week 8**. Final delivery is due **48 hours after session 16 ends**. The lecturer will publish the corresponding calendar date, time, and timezone in the LMS before the course starts.

## Project Milestones

| Milestone | Timing | Assessment status | Expected evidence |
| --- | --- | --- | --- |
| Project proposal | Before session 5, week 3 | Mandatory, ungraded | Problem, audience, MVP, exclusions, wireframes, technical approach, backlog, milestones, responsibilities, and risks |
| Checkpoint 1 | Session 8, week 4 | Mandatory, ungraded | A narrow working journey, design and backlog progress, contributions, blockers, and next steps |
| Checkpoint 2 | Session 14, week 7 | Mandatory, ungraded | Deployed MVP, test evidence, usability improvements, remaining requirements, and final defect list |
| Presentation and peer evaluation | Session 16, week 8 | Presentation informs the final grade; peer feedback supports improvement | Demonstration, explanation, questions, and testing of both other projects |
| Final delivery | 48 hours after session 16 ends | Assessed final work | GitHub release, public application, documentation, testing, and feedback evidence |

Additional ungraded check-ins take place in sessions 2, 4, 7, 10, 12, and 15. The proposal and checkpoints receive feedback and action lists, with no separate numerical marks or percentage weights.

Use the [proposal template](../materials/project_proposal.md) and [review and delivery checklists](../materials/reviews_and_delivery.md). Link the proposal and evidence from the team repository so the lecturer can access them.

Teams may otherwise work according to their own schedules. However, **mandatory project progress reviews** will be held during teaching weeks **4 and 7**.

All team members must attend their team's scheduled review.

During each progress review, the team will discuss:

* What has been completed so far?
* Who has completed each part of the work?
* What have been the biggest challenges so far?
* What are the next steps in the project?

---

# Grading Criteria

The final application, presentation, and supporting evidence inform a single course grade. Passing grades are **1–5**, with **0** for failure as described in the syllabus. Quality, completeness, robustness, and demonstrated understanding are considered together; additional feature count does not determine the grade.

Individual contribution is evidenced through implementation, reviews, design, testing, documentation, and discussion, rather than commit counts alone. All members must contribute technical work and be able to explain submitted work.

## Minimum Requirements – Grades 1–2

To meet the minimum requirements, the project should include:

* A basic functional web application or information display
* A functional, self-developed backend application
* User testing and/or user feedback
* Responsive content and layout
* All minimum requirements specified by the client

## Additional Features – Grades 3–5

You do **not** need to implement every item in this section to receive a grade of 5.

The overall quality, complexity, completeness, and implementation of the project will be taken into account.

Possible additional features include:

* All minimum requirements are fulfilled
* Polished visual design and functionality
* Excellent, robust, responsive, and adaptive content
* Language selection or support for multiple interface languages, such as Finnish and English

### Content Management

Possible content management features include:

* Adding content or links
* Removing content or links
* Editing content or links
* A separate administration interface for managing content

### Announcement Management

Possible announcement management features include:

* Adding announcements
* Removing announcements
* Editing announcements through the administration interface
* Storing announcements using a static JSON file hosted online

### Media and Visual Features

Possible media-related features include:

* Video
* Motion graphics
* Parallax effects
* Subtle animations

### Additional Development

Projects may also include:

* Additional features and ideas developed by the team
* Additional features and ideas requested by the client

---

# Technical Requirements

## Frontend

Frontend application logic must be implemented using:

* **JavaScript**
* **React**
* Or a suitable combination of both

The use of **ES6+ features** and practices introduced during the JavaScript and React exercises is recommended.

CSS frameworks are allowed, including:

* Bootstrap
* Tailwind CSS
* Other suitable CSS frameworks

---

## Backend

The project must include a backend application using:

* **JavaScript**
* **Node.js**
* **Express**
* **SQL database**
* **RESTful architecture**

---

## UX and UI Requirements

The project must include appropriate UX and UI design work.

Requirements include:

* Wireframes, mock-ups, and UI designs must be created according to the project requirements.
* The target audience must be identified.
* The target audience must be considered when designing the user interface.
* The user interface should reflect the needs of the selected target audience.
* Technical testing of the website must be performed using **Lighthouse**.
* HTML and CSS must be professionally implemented and validated.

---

## Code Quality and Documentation

Teams must follow good programming practices throughout the project.

Requirements include:

* Code should be clearly structured and maintainable.
* Code must be professionally documented and commented where appropriate.
* Documentation tools such as **JSDoc** and **ApiDoc** may be used.
* The application must be published and accessible on the internet.

Suitable hosting options may include:

* The school's eCloud
* Azure
* Vercel
* Another suitable hosting service

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

# After the Presentations

After all presentations have been completed, each team will test applications developed by the other teams and provide feedback.

Each team tests **both other teams' applications** in two 25-minute rounds, followed by 10 minutes to complete feedback. Individual members may perform different tasks during a round. Teams use the final project hour and the following 48-hour submission window to address priority findings and record any remaining limitations.

## Feedback Collection

Feedback must be collected using **Google Forms or a similar tool**.

Teachers must be able to access and view the feedback results using a shared link.

Each team is responsible for creating its own feedback form.

The feedback form must contain at least the following questions:

1. **Was the repository's `README.md` clear and did it meet the requirements?**
   Rating: **1–5**

2. **Did you get a clear understanding of the purpose of the application and its intended target audience?**
   Rating: **1–5**

3. **Was it easy to find everything needed in the user interface to properly test the application?**
   Rating: **1–5**

4. **Open feedback / comments**

5. At least **one additional question of your own choice**

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
