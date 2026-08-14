import transporter from "../services/mailService.js";

// =====================================================
// HELPERS
// =====================================================

const parseArray = (value) => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatArray = (value) => {
  const array = parseArray(value);

  return array.length
    ? array.map(escapeHtml).join(", ")
    : "-";
};

// =====================================================
// SUBMIT CANDIDATE INTEREST
// =====================================================

export const submitCandidateInterest = async (
  req,
  res
) => {
  try {
    console.log(
      "========== CANDIDATE SUBMISSION =========="
    );

    console.log("BODY:", req.body);

    console.log("FILE:", req.file);

    // ===================================================
    // FORM DATA
    // ===================================================

    const {
      fullName,
      email,
      phone,
      currentCountry,
      currentCity,
      linkedin,
      currentStatus,

      currentRole,
      experienceLevel,
      yearsOfExperience,
      qualification,
      currentIndustry,
      professionalSummary,

      industries,
      skills,
      otherSkills,

      opportunityTypes,
      workModes,
      preferredCountries,
      preferredCities,
      relocation,
      availability,
      careerDirections,

      github,
      portfolio,
      additionalInformation,
      contactPreference,
      consent,
    } = req.body;

    // ===================================================
    // REQUIRED FIELDS
    // ===================================================

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, email and phone are required.",
      });
    }

    // ===================================================
    // RESUME
    // ===================================================

    const resume = req.file;

    // ===================================================
    // EMAIL HTML
    // ===================================================

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

        <h2>New Candidate Profile</h2>

        <hr />

        <h3>Personal Information</h3>

        <p>
          <strong>Name:</strong>
          ${escapeHtml(fullName)}
        </p>

        <p>
          <strong>Email:</strong>
          ${escapeHtml(email)}
        </p>

        <p>
          <strong>Phone:</strong>
          ${escapeHtml(phone)}
        </p>

        <p>
          <strong>Current Country:</strong>
          ${escapeHtml(currentCountry || "-")}
        </p>

        <p>
          <strong>Current City:</strong>
          ${escapeHtml(currentCity || "-")}
        </p>

        <p>
          <strong>LinkedIn:</strong>
          ${escapeHtml(linkedin || "-")}
        </p>

        <p>
          <strong>Current Status:</strong>
          ${escapeHtml(currentStatus || "-")}
        </p>

        <h3>Professional Information</h3>

        <p>
          <strong>Current / Most Recent Role:</strong>
          ${escapeHtml(currentRole || "-")}
        </p>

        <p>
          <strong>Experience:</strong>
          ${escapeHtml(experienceLevel || "-")}
        </p>

        <p>
          <strong>Years of Experience:</strong>
          ${escapeHtml(yearsOfExperience || "-")}
        </p>

        <p>
          <strong>Qualification:</strong>
          ${escapeHtml(qualification || "-")}
        </p>

        <p>
          <strong>Current Industry:</strong>
          ${escapeHtml(currentIndustry || "-")}
        </p>

        <h3>Professional Summary</h3>

        <p>
          ${escapeHtml(
            professionalSummary || "-"
          )}
        </p>

        <h3>Industries</h3>

        <p>
          ${formatArray(industries)}
        </p>

        <h3>Skills</h3>

        <p>
          ${formatArray(skills)}
        </p>

        <p>
          <strong>Other Skills:</strong>
          ${escapeHtml(otherSkills || "-")}
        </p>

        <h3>Opportunity Preferences</h3>

        <p>
          <strong>Opportunity Type:</strong>
          ${formatArray(opportunityTypes)}
        </p>

        <p>
          <strong>Work Mode:</strong>
          ${formatArray(workModes)}
        </p>

        <p>
          <strong>Preferred Countries:</strong>
          ${formatArray(preferredCountries)}
        </p>

        <p>
          <strong>Preferred Cities:</strong>
          ${formatArray(preferredCities)}
        </p>

        <p>
          <strong>Relocation:</strong>
          ${escapeHtml(relocation || "-")}
        </p>

        <p>
          <strong>Availability:</strong>
          ${escapeHtml(availability || "-")}
        </p>

        <p>
          <strong>Career Direction:</strong>
          ${formatArray(careerDirections)}
        </p>

        <h3>Professional Links</h3>

        <p>
          <strong>GitHub:</strong>
          ${escapeHtml(github || "-")}
        </p>

        <p>
          <strong>Portfolio:</strong>
          ${escapeHtml(portfolio || "-")}
        </p>

        <h3>Additional Information</h3>

        <p>
          ${escapeHtml(
            additionalInformation || "-"
          )}
        </p>

        <p>
          <strong>Contact Preference:</strong>
          ${escapeHtml(
            contactPreference || "-"
          )}
        </p>

        <p>
          <strong>Consent:</strong>
          ${escapeHtml(consent || "-")}
        </p>

        <hr />

        <p>
          <strong>Resume:</strong>
          ${
            resume
              ? escapeHtml(resume.originalname)
              : "No resume uploaded"
          }
        </p>

      </div>
    `;

    // ===================================================
    // EMAIL OPTIONS
    // ===================================================

    const mailOptions = {
      from: process.env.EMAIL_USER,

      to: process.env.EMAIL_USER,

      replyTo: email,

      subject:
        `New Candidate Profile - ${fullName}`,

      html: emailHtml,

      attachments: resume
        ? [
            {
              filename: resume.originalname,
              content: resume.buffer,
              contentType: resume.mimetype,
            },
          ]
        : [],
    };

    // ===================================================
    // SEND EMAIL
    // ===================================================

    console.log(
      "Sending candidate email..."
    );

    await transporter.sendMail(mailOptions);

    console.log(
      `Candidate profile email sent: ${email}`
    );

    // ===================================================
    // SUCCESS
    // ===================================================

    return res.status(200).json({
      success: true,
      message:
        "Candidate profile submitted successfully.",
    });

  } catch (error) {
    console.error(
      "Candidate email error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to submit candidate profile.",
    });
  }
};