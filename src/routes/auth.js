import express from "express";
import bcrypt from "bcrypt";
import pool from "../config/db.js";
import crypto from "crypto";
import transporter from "../services/mailService.js";
import { authenticateUser } from "../middleware/authMiddleware.js";


const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      role,
    } = req.body;

    // Check required fields
    if (
      !fullName ||
      !email ||
      !phone ||
      !password ||
      !confirmPassword ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all fields.",
      });
    }

    // Check passwords
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM auth_users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `
      INSERT INTO auth_users
      (
        full_name,
        email,
        phone,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, full_name, email, phone, role
      `,
      [
        fullName,
        email,
        phone,
        hashedPassword,
        role,
      ]
    );

    // Success response
    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        status,
        is_email_verified,
        organization_id
      FROM auth_users
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    // Email must be verified
    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
      });
    }

    // Rejected accounts cannot login
    if (user.status === "REJECTED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been rejected.",
      });
    }

    // Blocked accounts cannot login
    if (user.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }

    // Recruiters must be approved
    if (
      user.role === "RECRUITER" &&
      user.status !== "APPROVED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your recruiter account is waiting for admin approval.",
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Create secure random refresh token
    const refreshToken = crypto.randomBytes(64).toString("hex");

    // Token expires in 7 days
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // Save token in existing refresh_tokens table
    await pool.query(
      `
      INSERT INTO refresh_tokens
      (
        user_id,
        refresh_token,
        expires_at
      )
      VALUES ($1, $2, $3)
      `,
      [
        user.id,
        refreshToken,
        expiresAt,
      ]
    );

    // Update last login
    await pool.query(
      `
      UPDATE auth_users
      SET last_login = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [user.id]
    );

    // Store token in HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Never return password hash
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isEmailVerified: user.is_email_verified,
        organizationId: user.organization_id,
      },
    });

  } catch (error) {

    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


router.get("/me", authenticateUser, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      authenticated: true,
      user: {
        id: req.user.id,
        fullName: req.user.full_name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        status: req.user.status,
        isEmailVerified: req.user.is_email_verified,
        organizationId: req.user.organization_id,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


router.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await pool.query(
        `
        DELETE FROM refresh_tokens
        WHERE refresh_token = $1
        `,
        [refreshToken]
      );
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });

  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});





router.post("/forgot", async (req, res) => {
    try {

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await pool.query(
            "SELECT id FROM auth_users WHERE email=$1",
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No account found"
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        await pool.query(
            `
            UPDATE auth_users
            SET reset_token=$1,
                reset_token_expiry=$2
            WHERE email=$3
            `,
            [resetToken, expiry, email]
        );


        await transporter.sendMail({
          from:process.env.EMAIL_USER,
          to:email,
          subject:"password Reset",
          html:`
          <h2> Password Reset Request </h2>

          <p> Click the button below to reset your password. </p>

          <a href="${resetLink}"> Reset password </a>

          <p> This link expires in 15 minutes </p>
          `
        
        
        });


        return res.status(200).json({
            success: true,
            message: "Reset token generated successfully",
            token: resetToken
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
    }
});

router.post("/reset-password", async (req, res) => {

  try {

    const {
      token,
      password,
      confirmPassword
    } = req.body;

    // Check fields
    if (!token || !password || !confirmPassword) {

      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });

    }

    // Check passwords
    if (password !== confirmPassword) {

      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });

    }

    // Find user with valid token
    const result = await pool.query(
      `
      SELECT id
      FROM auth_users
      WHERE reset_token = $1
      AND reset_token_expiry > NOW()
      `,
      [token]
    );

    // Token invalid or expired
    if (result.rows.length === 0) {

      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or expired."
      });

    }

    const userId = result.rows[0].id;

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and remove token
    await pool.query(
      `
      UPDATE auth_users
      SET
        password_hash = $1,
        reset_token = NULL,
        reset_token_expiry = NULL,
        updated_at = NOW()
      WHERE id = $2
      `,
      [hashedPassword, userId]
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully."
    });

  } catch (error) {

    console.error("Reset Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error"
    });

  }

});




router.get("/test",(req ,res)=>{
  res.json({
    sucess:true,
    message:"Auth route is working"
  });
})


router.post("/register/send-otp", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      role,

      // Recruiter organization details
      companyName,
      companyEmail,
      companyPhone,
      website,
      industry,
      companySize,
      address,
      city,
      country,
      description,
    } = req.body;

    // =========================================================
    // 1. BASIC VALIDATION
    // =========================================================

    if (
      !fullName ||
      !email ||
      !phone ||
      !password ||
      !confirmPassword ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    // =========================================================
    // 2. VALIDATE ROLE
    // =========================================================

    if (!["JOB_SEEKER", "RECRUITER"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration role.",
      });
    }

    // =========================================================
    // 3. PASSWORD VALIDATION
    // =========================================================

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    // =========================================================
    // 4. RECRUITER ORGANIZATION VALIDATION
    // =========================================================

    if (role === "RECRUITER") {
      if (
        !companyName ||
        !companyEmail ||
        !companyPhone ||
        !industry ||
        !companySize ||
        !address ||
        !city ||
        !country
      ) {
        return res.status(400).json({
          success: false,
          message: "Please fill all required organization details.",
        });
      }
    }

    // =========================================================
    // 5. CHECK EXISTING USER
    // =========================================================

    const existingUser = await pool.query(
      `
      SELECT id
      FROM auth_users
      WHERE email = $1
      `,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // =========================================================
    // 6. CHECK EXISTING ORGANIZATION EMAIL
    // =========================================================

    if (role === "RECRUITER") {
      const existingOrganization = await pool.query(
        `
        SELECT id
        FROM organizations
        WHERE company_email = $1
        `,
        [companyEmail]
      );

      if (existingOrganization.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "An organization with this email already exists.",
        });
      }
    }

    // =========================================================
    // 7. GENERATE EXACTLY 6-DIGIT OTP
    // =========================================================

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // =========================================================
    // 8. OTP EXPIRY — 10 MINUTES
    // =========================================================

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // =========================================================
    // 9. HASH PASSWORD
    // =========================================================

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // =========================================================
    // 10. REMOVE OLD UNVERIFIED OTP RECORDS
    // =========================================================

    await pool.query(
      `
      DELETE FROM email_verifications
      WHERE email = $1
      AND verified = false
      `,
      [email]
    );

    // =========================================================
    // 11. SAVE VERIFICATION DATA
    // =========================================================

    await pool.query(
      `
      INSERT INTO email_verifications
      (
        full_name,
        email,
        phone,
        password_hash,
        role,
        otp,
        expires_at,
        verified,

        company_name,
        company_email,
        company_phone,
        website,
        industry,
        company_size,
        address,
        city,
        country,
        description
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        false,

        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17
      )
      `,
      [
        fullName,
        email,
        phone,
        hashedPassword,
        role,
        otp,
        expiresAt,

        role === "RECRUITER" ? companyName : null,
        role === "RECRUITER" ? companyEmail : null,
        role === "RECRUITER" ? companyPhone : null,
        role === "RECRUITER" ? website || null : null,
        role === "RECRUITER" ? industry : null,
        role === "RECRUITER" ? companySize : null,
        role === "RECRUITER" ? address : null,
        role === "RECRUITER" ? city : null,
        role === "RECRUITER" ? country : null,
        role === "RECRUITER" ? description || null : null,
      ]
    );

    // =========================================================
    // 12. SEND OTP EMAIL
    // =========================================================

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Vutkala Global Verification OTP",

      html: `
        <div style="font-family: Arial, sans-serif;">

          <h2>Verify Your Email</h2>

          <p>
            Hello ${fullName},
          </p>

          <p>
            Your Vutkala Global verification OTP is:
          </p>

          <h1
            style="
              letter-spacing: 8px;
              font-size: 32px;
            "
          >
            ${otp}
          </h1>

          <p>
            This OTP will expire in 10 minutes.
          </p>

          <p>
            If you did not create this account,
            please ignore this email.
          </p>

        </div>
      `,
    });

    // =========================================================
    // 13. SUCCESS RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
    });

  } catch (error) {
    console.error(
      "Send registration OTP error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


router.post("/register/verify-otp", async (req, res) => {
  const client = await pool.connect();

  try {
    const { email, otp } = req.body;

    // =========================================================
    // 1. VALIDATE REQUEST
    // =========================================================

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    // =========================================================
    // 2. FIND LATEST OTP
    // =========================================================

    const result = await client.query(
      `
      SELECT
        id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        otp,
        expires_at,

        company_name,
        company_email,
        company_phone,
        website,
        industry,
        company_size,
        address,
        city,
        country,
        description

      FROM email_verifications

      WHERE email = $1
      AND verified = false

      ORDER BY created_at DESC
      LIMIT 1
      `,
      [email]
    );

    // =========================================================
    // 3. OTP NOT FOUND
    // =========================================================

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "OTP not found. Please register again.",
      });
    }

    const verification = result.rows[0];

    // =========================================================
    // 4. CHECK OTP
    // =========================================================

    if (verification.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // =========================================================
    // 5. CHECK OTP EXPIRY
    // =========================================================

    if (
      new Date() >
      new Date(verification.expires_at)
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // =========================================================
    // 6. START DATABASE TRANSACTION
    // =========================================================

    await client.query("BEGIN");

    // =========================================================
    // 7. DETERMINE ACCOUNT STATUS
    // =========================================================

    const status =
      verification.role === "RECRUITER"
        ? "PENDING"
        : "APPROVED";

    let organizationId = null;

    // =========================================================
    // 8. CREATE ORGANIZATION FOR RECRUITER
    // =========================================================

    if (verification.role === "RECRUITER") {

      const organizationResult = await client.query(
        `
        INSERT INTO organizations
        (
          company_name,
          company_email,
          company_phone,
          website,
          industry,
          company_size,
          address,
          city,
          country,
          description,
          status
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
        RETURNING id
        `,
        [
          verification.company_name,
          verification.company_email,
          verification.company_phone,
          verification.website,
          verification.industry,
          verification.company_size,
          verification.address,
          verification.city,
          verification.country,
          verification.description,
          "PENDING",
        ]
      );

      organizationId =
        organizationResult.rows[0].id;
    }

    // =========================================================
    // 9. CREATE AUTH USER
    // =========================================================

    const userResult = await client.query(
      `
      INSERT INTO auth_users
      (
        full_name,
        email,
        phone,
        password_hash,
        role,
        status,
        is_email_verified,
        organization_id
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      RETURNING
        id,
        full_name,
        email,
        phone,
        role,
        status,
        is_email_verified,
        organization_id
      `,
      [
        verification.full_name,
        verification.email,
        verification.phone,
        verification.password_hash,
        verification.role,
        status,
        true,
        organizationId,
      ]
    );

    // =========================================================
    // 10. MARK OTP AS VERIFIED
    // =========================================================

    await client.query(
      `
      UPDATE email_verifications
      SET verified = true
      WHERE id = $1
      `,
      [verification.id]
    );

    // =========================================================
    // 11. COMMIT TRANSACTION
    // =========================================================

    await client.query("COMMIT");

    const user = userResult.rows[0];

    // =========================================================
    // 12. SUCCESS RESPONSE
    // =========================================================

    if (verification.role === "RECRUITER") {
      return res.status(201).json({
        success: true,
        message:
          "Email verified successfully. Your recruiter account is waiting for admin approval.",
        user,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user,
    });

  } catch (error) {

    // =========================================================
    // ROLLBACK IF ANYTHING FAILS
    // =========================================================

    await client.query("ROLLBACK");

    console.error(
      "Verify OTP error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });

  } finally {

    // =========================================================
    // RELEASE DATABASE CONNECTION
    // =========================================================

    client.release();
  }
});


export default router;