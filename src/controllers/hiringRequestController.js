import transporter from "../services/mailService.js";

// =====================================================
// HIRING REQUEST EMAIL
// =====================================================

export const submitHiringRequest = async (req, res) => {
  try {
    console.log("========== HIRING REQUEST ==========");
    console.log("BODY:", req.body);

    const {
      companyName,
      companyEmail,
      phone,
      industry,
      companySize,
      website,

      position,
      numberOfPositions,
      hiringType,
      employmentType,

      jobDescription,
      responsibilities,
      requiredSkills,
      preferredSkills,

      experience,
      education,
      industryExperience,
      certifications,
      languages,

      salaryMin,
      salaryMax,
      salaryPeriod,
      workMode,
      location,
      preferredCandidateLocation,

      hiringUrgency,
      expectedJoiningDate,
      interviewProcess,

      contactPerson,
      designation,
      contactEmail,
      contactPhone,

      additionalInformation,
      consent,
    } = req.body;

    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (
      !companyName ||
      !companyEmail ||
      !phone ||
      !industry ||
      !position ||
      !numberOfPositions ||
      !hiringType ||
      !employmentType ||
      !jobDescription ||
      !experience ||
      !workMode ||
      !location ||
      !hiringUrgency ||
      !contactPerson ||
      !contactEmail ||
      !contactPhone ||
      !consent
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields.",
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
          max-width: 850px;
          margin: 0 auto;
        "
      >

        <h2>New Hiring Request</h2>

        <p>
          A new hiring requirement has been submitted
          through the VUTKAL Global Technologies website.
        </p>

        <hr />

        <h3>Company Information</h3>

        <p>
          <strong>Company Name:</strong>
          ${companyName || "-"}
        </p>

        <p>
          <strong>Company Email:</strong>
          ${companyEmail || "-"}
        </p>

        <p>
          <strong>Phone:</strong>
          ${phone || "-"}
        </p>

        <p>
          <strong>Industry:</strong>
          ${industry || "-"}
        </p>

        <p>
          <strong>Company Size:</strong>
          ${companySize || "-"}
        </p>

        <p>
          <strong>Website:</strong>
          ${website || "-"}
        </p>

        <hr />

        <h3>Hiring Requirement</h3>

        <p>
          <strong>Position / Role:</strong>
          ${position || "-"}
        </p>

        <p>
          <strong>Number of Positions:</strong>
          ${numberOfPositions || "-"}
        </p>

        <p>
          <strong>Hiring Type:</strong>
          ${hiringType || "-"}
        </p>

        <p>
          <strong>Employment Type:</strong>
          ${employmentType || "-"}
        </p>

        <hr />

        <h3>Role Details</h3>

        <p>
          <strong>Job Description:</strong>
        </p>

        <p>
          ${jobDescription || "-"}
        </p>

        <p>
          <strong>Responsibilities:</strong>
        </p>

        <p>
          ${responsibilities || "-"}
        </p>

        <p>
          <strong>Required Skills:</strong>
          ${requiredSkills || "-"}
        </p>

        <p>
          <strong>Preferred Skills:</strong>
          ${preferredSkills || "-"}
        </p>

        <hr />

        <h3>Candidate Requirements</h3>

        <p>
          <strong>Experience:</strong>
          ${experience || "-"}
        </p>

        <p>
          <strong>Education:</strong>
          ${education || "-"}
        </p>

        <p>
          <strong>Industry Experience:</strong>
          ${industryExperience || "-"}
        </p>

        <p>
          <strong>Certifications:</strong>
          ${certifications || "-"}
        </p>

        <p>
          <strong>Languages:</strong>
          ${languages || "-"}
        </p>

        <hr />

        <h3>Compensation & Location</h3>

        <p>
          <strong>Minimum Salary:</strong>
          ${salaryMin || "-"}
        </p>

        <p>
          <strong>Maximum Salary:</strong>
          ${salaryMax || "-"}
        </p>

        <p>
          <strong>Salary Period:</strong>
          ${salaryPeriod || "-"}
        </p>

        <p>
          <strong>Work Mode:</strong>
          ${workMode || "-"}
        </p>

        <p>
          <strong>Job Location:</strong>
          ${location || "-"}
        </p>

        <p>
          <strong>Preferred Candidate Location:</strong>
          ${preferredCandidateLocation || "-"}
        </p>

        <hr />

        <h3>Hiring Timeline</h3>

        <p>
          <strong>Hiring Urgency:</strong>
          ${hiringUrgency || "-"}
        </p>

        <p>
          <strong>Expected Joining Date:</strong>
          ${expectedJoiningDate || "-"}
        </p>

        <p>
          <strong>Interview Process:</strong>
          ${interviewProcess || "-"}
        </p>

        <hr />

        <h3>Contact Person</h3>

        <p>
          <strong>Name:</strong>
          ${contactPerson || "-"}
        </p>

        <p>
          <strong>Designation:</strong>
          ${designation || "-"}
        </p>

        <p>
          <strong>Email:</strong>
          ${contactEmail || "-"}
        </p>

        <p>
          <strong>Phone:</strong>
          ${contactPhone || "-"}
        </p>

        <hr />

        <h3>Additional Information</h3>

        <p>
          ${additionalInformation || "-"}
        </p>

        <hr />

        <p>
          <strong>Consent:</strong>
          ${consent ? "Accepted" : "Not accepted"}
        </p>

      </div>
    `;

    // =================================================
    // MAIL OPTIONS
    // =================================================

    const mailOptions = {
      from: process.env.EMAIL_USER,

      // VUTKAL receives the hiring request
      to: process.env.EMAIL_USER,

      // Clicking Reply sends the reply to the company
      replyTo: contactEmail || companyEmail,

      subject:
        `New Hiring Request - ${companyName} - ${position}`,

      html: emailHtml,
    };

    // =================================================
    // SEND EMAIL
    // =================================================

    console.log("Sending hiring request email...");

    const info = await transporter.sendMail(mailOptions);

    console.log(
      "Hiring request email sent successfully."
    );

    console.log(
      "Message ID:",
      info.messageId
    );

    // =================================================
    // RESPONSE
    // =================================================

    const referenceNumber =
      `VG-${Date.now()}`;

    return res.status(200).json({
      success: true,
      message:
        "Hiring request submitted successfully.",
      referenceNumber,
    });

  } catch (error) {
    console.error(
      "❌ Hiring request email error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to submit hiring request.",
    });
  }
};