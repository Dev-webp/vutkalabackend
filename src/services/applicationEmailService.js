import transporter from "./mailService.js";

export const sendApplicationStatusEmail = async ({
  email,
  candidateName,
  jobTitle,
  status,
}) => {

  let subject = "";
  let html = "";

  // =====================================================
  // SHORTLISTED
  // =====================================================

  if (status === "SHORTLISTED") {

    subject =
      `Application Shortlisted - ${jobTitle}`;

    html = `
      <div style="
        font-family: Arial, sans-serif;
        line-height: 1.6;
        max-width: 600px;
        margin: auto;
      ">

        <h2>
          Congratulations, ${candidateName}!
        </h2>

        <p>
          We are pleased to inform you that your
          application for the
          <strong>${jobTitle}</strong>
          position has been shortlisted.
        </p>

        <p>
          Our recruitment team will contact you
          regarding the next steps.
        </p>

        <p>
          Best regards,<br>
          <strong>VUTKALA Recruitment Team</strong>
        </p>

      </div>
    `;
  }

  // =====================================================
  // INTERVIEW
  // =====================================================

  else if (status === "INTERVIEW") {

    subject =
      `Interview Stage - ${jobTitle}`;

    html = `
      <div style="
        font-family: Arial, sans-serif;
        line-height: 1.6;
        max-width: 600px;
        margin: auto;
      ">

        <h2>
          Hello ${candidateName},
        </h2>

        <p>
          Your application for the
          <strong>${jobTitle}</strong>
          position has progressed to the
          <strong>interview stage</strong>.
        </p>

        <p>
          Our recruitment team will contact you
          with the interview details.
        </p>

        <p>
          Best regards,<br>
          <strong>VUTKALA Recruitment Team</strong>
        </p>

      </div>
    `;
  }

  // =====================================================
  // SELECTED
  // =====================================================

  else if (status === "SELECTED") {

    subject =
      `Congratulations! You Have Been Selected - ${jobTitle}`;

    html = `
      <div style="
        font-family: Arial, sans-serif;
        line-height: 1.6;
        max-width: 600px;
        margin: auto;
      ">

        <h2>
          Congratulations, ${candidateName}!
        </h2>

        <p>
          We are pleased to inform you that you have been
          <strong>selected</strong> for the
          <strong>${jobTitle}</strong> position.
        </p>

        <p>
          Our recruitment team will contact you with
          the next steps.
        </p>

        <p>
          Best regards,<br>
          <strong>VUTKALA Recruitment Team</strong>
        </p>

      </div>
    `;
  }

  // =====================================================
  // REJECTED
  // =====================================================

  else if (status === "REJECTED") {

    subject =
      `Application Update - ${jobTitle}`;

    html = `
      <div style="
        font-family: Arial, sans-serif;
        line-height: 1.6;
        max-width: 600px;
        margin: auto;
      ">

        <h2>
          Hello ${candidateName},
        </h2>

        <p>
          Thank you for your interest in the
          <strong>${jobTitle}</strong>
          position at VUTKALA.
        </p>

        <p>
          After careful consideration, we have decided
          not to move forward with your application
          at this time.
        </p>

        <p>
          We appreciate your time and interest in
          VUTKALA and wish you the very best in
          your future career.
        </p>

        <p>
          Best regards,<br>
          <strong>VUTKALA Recruitment Team</strong>
        </p>

      </div>
    `;
  }

  // =====================================================
  // NO EMAIL FOR OTHER STATUS
  // =====================================================

  else {
    return;
  }

  // =====================================================
  // SEND EMAIL
  // =====================================================

  await transporter.sendMail({

    from: process.env.EMAIL_USER,

    to: email,

    subject,

    html,

  });
};