import express from "express";
import pool from "../config/db.js";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();


// =====================================================
// APPLY FOR JOB
// POST /api/applications
// JOB SEEKER ONLY
// =====================================================

router.post(
  "/",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const candidateId = req.user.id;

      const {
        job_id,
        resume_url,
        cover_letter,
      } = req.body;


      // =================================================
      // VALIDATE JOB ID
      // =================================================

      if (!job_id) {
        return res.status(400).json({
          success: false,
          message: "Job ID is required.",
        });
      }


      // =================================================
      // CHECK JOB
      // =================================================

      const jobResult = await pool.query(
        `
        SELECT
          id,
          title,
          status
        FROM jobs
        WHERE id = $1
        `,
        [job_id]
      );


      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }


      const job = jobResult.rows[0];


      // =================================================
      // ONLY OPEN JOBS CAN RECEIVE APPLICATIONS
      // =================================================

      if (job.status !== "OPEN") {
        return res.status(400).json({
          success: false,
          message:
            "This job is no longer accepting applications.",
        });
      }


      // =================================================
      // CHECK DUPLICATE APPLICATION
      // =================================================

      const existingApplication =
        await pool.query(
          `
          SELECT
            id,
            status,
            applied_at
          FROM applications
          WHERE job_id = $1
            AND candidate_id = $2
          `,
          [
            job_id,
            candidateId,
          ]
        );


      if (
        existingApplication.rows.length > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "You have already applied for this job.",
          application:
            existingApplication.rows[0],
        });
      }


      // =================================================
      // CREATE APPLICATION
      // =================================================

      const result = await pool.query(
        `
        INSERT INTO applications
        (
          job_id,
          candidate_id,
          resume_url,
          cover_letter,
          status,
          applied_at,
          updated_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          'NEW',
          NOW(),
          NOW()
        )
        RETURNING
          id,
          job_id,
          candidate_id,
          resume_url,
          cover_letter,
          status,
          applied_at,
          updated_at
        `,
        [
          job_id,
          candidateId,
          resume_url || null,
          cover_letter || null,
        ]
      );


      // =================================================
      // SUCCESS
      // =================================================

      return res.status(201).json({
        success: true,
        message:
          "Application submitted successfully.",
        application:
          result.rows[0],
      });


    } catch (error) {

      console.error(
        "Apply for job error:",
        error
      );


      // Handle database unique constraint
      // in case two requests arrive together.

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "You have already applied for this job.",
        });
      }


      return res.status(500).json({
        success: false,
        message:
          "Server Error",
      });
    }
  }
);


// =====================================================
// GET MY APPLICATIONS
// GET /api/applications/my
// JOB SEEKER ONLY
// =====================================================

// =====================================================
// GET MY APPLICATIONS
// GET /api/applications/my
// =====================================================

router.get(
  "/my",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const candidateId = req.user.id;

      console.log(
        "GET MY APPLICATIONS:",
        candidateId
      );

      const result = await pool.query(
        `
        SELECT
          a.id,
          a.job_id,
          a.candidate_id,
          a.resume_url,
          a.cover_letter,
          a.status,
          a.applied_at,
          a.updated_at,

          j.title,
          j.description,
          j.location,
          j.employment_type,
          j.experience_required,
          j.salary_min,
          j.salary_max,
          j.skills,
          j.industry,
          j.job_type,
          j.work_mode,

          o.company_name,
          o.company_email,
          o.website,
          o.company_size,
          o.city,
          o.country

        FROM applications a

        INNER JOIN jobs j
          ON a.job_id = j.id

        LEFT JOIN organizations o
          ON j.organization_id = o.id

        WHERE a.candidate_id = $1

        ORDER BY a.applied_at DESC
        `,
        [candidateId]
      );

      console.log(
        "MY APPLICATIONS RESULT:",
        result.rows
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        applications: result.rows,
      });

    } catch (error) {
      console.error(
        "Get my applications error:",
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
// GET RECRUITER APPLICATIONS
// GET /api/applications/recruiter
// RECRUITER / ADMIN
// =====================================================

router.get(
  "/recruiter",
  authenticateUser,
  requireRole("RECRUITER", "ADMIN"),
  async (req, res) => {
    try {

      let query;
      let values;


      // =================================================
      // ADMIN
      // =================================================

      if (
        req.user.role === "ADMIN"
      ) {

        query = `
          SELECT
            a.id,
            a.job_id,
            a.candidate_id,
            a.resume_url,
            a.cover_letter,
            a.status,
            a.applied_at,
            a.updated_at,

            j.title AS job_title,
            j.status AS job_status,

            u.full_name AS candidate_name,
            u.email AS candidate_email,
            u.phone AS candidate_phone

          FROM applications a

          INNER JOIN jobs j
            ON a.job_id = j.id

          INNER JOIN auth_users u
            ON a.candidate_id = u.id

          ORDER BY a.applied_at DESC
        `;

        values = [];

      }


      // =================================================
      // RECRUITER
      // =================================================

      else {

        query = `
          SELECT
            a.id,
            a.job_id,
            a.candidate_id,
            a.resume_url,
            a.cover_letter,
            a.status,
            a.applied_at,
            a.updated_at,

            j.title AS job_title,
            j.status AS job_status,

            u.full_name AS candidate_name,
            u.email AS candidate_email,
            u.phone AS candidate_phone

          FROM applications a

          INNER JOIN jobs j
            ON a.job_id = j.id

          INNER JOIN auth_users u
            ON a.candidate_id = u.id

          WHERE j.created_by = $1

          ORDER BY a.applied_at DESC
        `;

        values = [
          req.user.id,
        ];
      }


      const result = await pool.query(
        query,
        values
      );


      return res.status(200).json({
        success: true,
        count: result.rows.length,
        applications:
          result.rows,
      });


    } catch (error) {

      console.error(
        "Get recruiter applications error:",
        error
      );


      return res.status(500).json({
        success: false,
        message:
          "Server Error",
      });
    }
  }
);


// =====================================================
// UPDATE APPLICATION STATUS
// PUT /api/applications/:id/status
// RECRUITER / ADMIN
// =====================================================

router.put(
  "/:id/status",
  authenticateUser,
  requireRole("RECRUITER", "ADMIN"),
  async (req, res) => {
    try {

      const {
        id,
      } = req.params;

      const {
        status,
      } = req.body;


      // =================================================
      // ALLOWED STATUSES
      // =================================================

      const allowedStatuses = [
        "NEW",
        "SHORTLISTED",
        "INTERVIEW",
        "SELECTED",
        "REJECTED",
      ];


      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid application status.",
        });
      }


      // =================================================
      // FIND APPLICATION
      // =================================================

      const applicationResult =
        await pool.query(
          `
          SELECT
            a.id,
            a.job_id,
            j.created_by
          FROM applications a

          INNER JOIN jobs j
            ON a.job_id = j.id

          WHERE a.id = $1
          `,
          [id]
        );


      if (
        applicationResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Application not found.",
        });
      }


      const application =
        applicationResult.rows[0];


      // =================================================
      // RECRUITER CAN ONLY UPDATE
      // APPLICATIONS FOR THEIR JOBS
      // =================================================

      if (
        req.user.role === "RECRUITER" &&
        application.created_by !==
          req.user.id
      ) {

        return res.status(403).json({
          success: false,
          message:
            "You can only manage applications for your own jobs.",
        });

      }


      // =================================================
      // UPDATE
      // =================================================

      const result = await pool.query(
        `
        UPDATE applications

        SET
          status = $1,
          updated_at = NOW()

        WHERE id = $2

        RETURNING
          id,
          job_id,
          candidate_id,
          resume_url,
          cover_letter,
          status,
          applied_at,
          updated_at
        `,
        [
          status,
          id,
        ]
      );


      return res.status(200).json({
        success: true,
        message:
          "Application status updated successfully.",
        application:
          result.rows[0],
      });


    } catch (error) {

      console.error(
        "Update application status error:",
        error
      );


      return res.status(500).json({
        success: false,
        message:
          "Server Error",
      });
    }
  }
);


export default router;