import transporter from "./mailService.js";

export const sendCandidateContactEmail = async ({
  email,
  candidateName,
  recruiterName,
  recruiterEmail,
  subject,
  message,
}) => {

  if (!email) {
    throw new Error(
      "Candidate email is required."
    );
  }

  if (!subject) {
    throw new Error(
      "Email subject is required."
    );
  }

  if (!message) {
    throw new Error(
      "Email message is required."
    );
  }

  const safeMessage =
    message.replace(/\n/g, "<br />");

  await transporter.sendMail({

    from:
      process.env.EMAIL_USER,

    to:
      email,

    replyTo:
      recruiterEmail ||
      process.env.EMAIL_USER,

    subject,

    text: `
Hello ${candidateName},

${message}

Regards,
${recruiterName}
`.trim(),

    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          line-height: 1.7;
          color: #333;
          max-width: 650px;
          margin: 0 auto;
          padding: 20px;
        "
      >

        <p>
          Hello ${candidateName},
        </p>

        <p>
          ${safeMessage}
        </p>

        <p>
          Regards,<br>
          <strong>${recruiterName}</strong>
        </p>

      </div>
    `,
  });
};