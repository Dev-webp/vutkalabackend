import transporter from "../services/mailService.js";

// =====================================================
// CONTACT FORM
// =====================================================

export const submitContactForm = async (req, res) => {
  try {
    console.log("========== CONTACT FORM ==========");
    console.log("BODY:", req.body);

    const {
      fullName,
      email,
      phone,
      company,
      service,
      subject,
      message,
    } = req.body;

    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (!fullName || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, email, phone and message are required.",
      });
    }

    // =================================================
    // EMAIL HTML
    // =================================================

    const emailHtml = `
      <div
        style="
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #222;
          max-width: 800px;
          margin: 0 auto;
        "
      >

        <h2>New Contact Form Submission</h2>

        <p>
          A new inquiry has been submitted through
          the VUTKAL Global Technologies website.
        </p>

        <hr />

        <h3>Contact Information</h3>

        <p>
          <strong>Name:</strong>
          ${fullName}
        </p>

        <p>
          <strong>Email:</strong>
          ${email}
        </p>

        <p>
          <strong>Phone:</strong>
          ${phone}
        </p>

        <p>
          <strong>Company:</strong>
          ${company || "-"}
        </p>

        <hr />

        <h3>Inquiry Details</h3>

        <p>
          <strong>Service Required:</strong>
          ${service || "-"}
        </p>

        <p>
          <strong>Subject:</strong>
          ${subject || "-"}
        </p>

        <p>
          <strong>Message:</strong>
        </p>

        <div
          style="
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            white-space: pre-wrap;
          "
        >
          ${message}
        </div>

        <hr />

        <p>
          This message was submitted from the
          VUTKAL Global Technologies Contact page.
        </p>

      </div>
    `;

    // =================================================
    // EMAIL OPTIONS
    // =================================================

    const mailOptions = {
      from: process.env.EMAIL_USER,

      // VUTKAL receives the message
      to: process.env.EMAIL_USER,

      // Clicking Reply sends directly to visitor
      replyTo: email,

      subject: subject
        ? `Contact Inquiry - ${subject}`
        : `New Contact Inquiry - ${fullName}`,

      html: emailHtml,
    };

    // =================================================
    // START EMAIL IN BACKGROUND
    // =================================================

    console.log("Starting contact email...");

    transporter
      .sendMail(mailOptions)
      .then((info) => {
        console.log(
          "✅ Contact email sent successfully."
        );

        console.log(
          "Message ID:",
          info.messageId
        );
      })
      .catch((error) => {
        console.error(
          "❌ Contact email failed."
        );

        console.error(
          "NAME:",
          error.name
        );

        console.error(
          "MESSAGE:",
          error.message
        );

        console.error(
          "CODE:",
          error.code
        );

        console.error(
          "COMMAND:",
          error.command
        );
      });

    // =================================================
    // RESPOND IMMEDIATELY
    // =================================================

    return res.status(200).json({
      success: true,
      message:
        "Your message has been received successfully.",
    });

  } catch (error) {
    console.error(
      "========== CONTACT FORM ERROR =========="
    );

    console.error(
      "NAME:",
      error.name
    );

    console.error(
      "MESSAGE:",
      error.message
    );

    console.error(
      "CODE:",
      error.code
    );

    console.error(
      "STACK:",
      error.stack
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to submit your message. Please try again.",
    });
  }
};