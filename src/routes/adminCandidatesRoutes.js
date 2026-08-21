import express from "express";
import pool from "../config/db.js";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// =====================================================
// ADMIN CANDIDATES
// GET /api/admin/candidates
//
// Returns:
// - Candidate account details
// - Job seeker profile
// - Resume
// - Number of applications
// =====================================================

router.get(
  "/",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.is_email_verified,
          u.profile_image,
          u.provider,
          u.last_login,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,

          p.id AS profile_id,
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
          p.github_url,
          p.created_at AS profile_created_at,
          p.updated_at AS profile_updated_at,

          COUNT(DISTINCT a.id)::integer AS applications_count

        FROM auth_users u

        LEFT JOIN job_seeker_profiles p
          ON p.user_id = u.id

        LEFT JOIN applications a
          ON a.candidate_id = u.id

        WHERE p.user_id IS NOT NULL

        GROUP BY
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.is_email_verified,
          u.profile_image,
          u.provider,
          u.last_login,
          u.created_at,
          u.updated_at,

          p.id,
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
          p.github_url,
          p.created_at,
          p.updated_at

        ORDER BY u.created_at DESC
      `);

      return res.json({
        success: true,
        candidates: result.rows,
      });
    } catch (error) {
      console.error(
        "ADMIN CANDIDATES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load candidates.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

// =====================================================
// GET SINGLE CANDIDATE
//
// GET /api/admin/candidates/:candidateId
//
// Returns complete candidate profile
// =====================================================

router.get(
  "/:candidateId",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    const { candidateId } = req.params;

    try {
      // -------------------------------------------------
      // Candidate + profile
      // -------------------------------------------------

      const candidateResult = await pool.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.is_email_verified,
          u.profile_image,
          u.provider,
          u.last_login,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,

          p.id AS profile_id,
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
          p.github_url,
          p.created_at AS profile_created_at,
          p.updated_at AS profile_updated_at

        FROM auth_users u

        LEFT JOIN job_seeker_profiles p
          ON p.user_id = u.id

        WHERE u.id = $1
          AND p.user_id IS NOT NULL

        LIMIT 1
        `,
        [candidateId]
      );

      if (candidateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Candidate not found.",
        });
      }

      const candidate = candidateResult.rows[0];

      // -------------------------------------------------
      // Applications
      // -------------------------------------------------

      const applicationsResult = await pool.query(
        `
        SELECT
          a.id AS application_id,
          a.status AS application_status,
          a.resume_url AS application_resume_url,
          a.cover_letter,
          a.applied_at,
          a.updated_at AS application_updated_at,

          j.id AS job_id,
          j.title AS job_title,
          j.description AS job_description,
          j.location AS job_location,
          j.employment_type,
          j.experience_required,
          j.salary_min,
          j.salary_max,
          j.skills AS job_skills,
          j.status AS job_status,
          j.industry AS job_industry,
          j.job_type,
          j.work_mode,
          j.created_at AS job_created_at,

          o.id AS organization_id,
          o.company_name,
          o.company_email,
          o.company_phone,
          o.website AS company_website,
          o.industry AS company_industry,
          o.company_size,
          o.address AS company_address,
          o.city AS company_city,
          o.country AS company_country,
          o.description AS company_description,
          o.status AS company_status,
          o.logo_url AS company_logo

        FROM applications a

        INNER JOIN jobs j
          ON j.id = a.job_id

        LEFT JOIN organizations o
          ON o.id = j.organization_id

        WHERE a.candidate_id = $1

        ORDER BY a.applied_at DESC
        `,
        [candidateId]
      );

      // -------------------------------------------------
      // Return complete candidate
      // -------------------------------------------------

      return res.json({
        success: true,

        candidate: {
          ...candidate,

          applications:
            applicationsResult.rows,

          applications_count:
            applicationsResult.rows.length,
        },
      });
    } catch (error) {
      console.error(
        "ADMIN CANDIDATE DETAILS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load candidate details.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

export default router;