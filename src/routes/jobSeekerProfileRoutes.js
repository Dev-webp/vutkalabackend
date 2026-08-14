import express from "express";
import pool from "../config/db.js";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();


// =====================================================
// GET MY PROFILE
// GET /api/job-seeker/profile
// =====================================================

router.get(
  "/",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.profile_image,

          p.headline,
          p.bio,
          p.location,
          p.experience_years,
          p.current_job_title,
          p.industry,
          p.skills,
          p.education,
          p.resume_url,
          p.linkedin_url,
          p.portfolio_url,
          p.github_url

        FROM auth_users u

        LEFT JOIN job_seeker_profiles p
          ON u.id = p.user_id

        WHERE u.id = $1
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job seeker not found.",
        });
      }

      return res.status(200).json({
        success: true,
        profile: result.rows[0],
      });

    } catch (error) {
      console.error(
        "Get job seeker profile error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error.",
      });
    }
  }
);


// =====================================================
// UPDATE MY PROFILE
// PUT /api/job-seeker/profile
// =====================================================

router.put(
  "/",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
        full_name,
        phone,
        headline,
        bio,
        location,
        experience_years,
        current_job_title,
        industry,
        skills,
        education,
        linkedin_url,
        portfolio_url,
        github_url,
      } = req.body;


      // =================================================
      // UPDATE BASIC USER INFORMATION
      // =================================================

      await pool.query(
        `
        UPDATE auth_users

        SET
          full_name = $1,
          phone = $2,
          updated_at = NOW()

        WHERE id = $3
        `,
        [
          full_name,
          phone,
          userId,
        ]
      );


      // =================================================
      // INSERT / UPDATE JOB SEEKER PROFILE
      // =================================================

      const result = await pool.query(
        `
        INSERT INTO job_seeker_profiles
        (
          user_id,
          headline,
          bio,
          location,
          experience_years,
          current_job_title,
          industry,
          skills,
          education,
          linkedin_url,
          portfolio_url,
          github_url,
          updated_at
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
          $11,
          $12,
          NOW()
        )

        ON CONFLICT (user_id)

        DO UPDATE SET
          headline = EXCLUDED.headline,
          bio = EXCLUDED.bio,
          location = EXCLUDED.location,
          experience_years = EXCLUDED.experience_years,
          current_job_title = EXCLUDED.current_job_title,
          industry = EXCLUDED.industry,
          skills = EXCLUDED.skills,
          education = EXCLUDED.education,
          linkedin_url = EXCLUDED.linkedin_url,
          portfolio_url = EXCLUDED.portfolio_url,
          github_url = EXCLUDED.github_url,
          updated_at = NOW()

        RETURNING *
        `,
        [
          userId,
          headline || null,
          bio || null,
          location || null,
          experience_years || null,
          current_job_title || null,
          industry || null,
          skills || null,
          education || null,
          linkedin_url || null,
          portfolio_url || null,
          github_url || null,
        ]
      );


      return res.status(200).json({
        success: true,
        message:
          "Profile updated successfully.",
        profile: result.rows[0],
      });

    } catch (error) {
      console.error(
        "Update job seeker profile error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error.",
      });
    }
  }
);


export default router;