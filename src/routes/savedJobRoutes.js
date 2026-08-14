import express from "express";
import pool from "../config/db.js";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();


// =====================================================
// SAVE JOB
// POST /api/saved-jobs
// =====================================================

router.post(
  "/",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const candidateId = req.user.id;
      const { job_id } = req.body;

      // -----------------------------------------------
      // VALIDATION
      // -----------------------------------------------

      if (!job_id) {
        return res.status(400).json({
          success: false,
          message: "Job ID is required.",
        });
      }


      // -----------------------------------------------
      // CHECK JOB
      // -----------------------------------------------

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


      // -----------------------------------------------
      // CHECK IF ALREADY SAVED
      // -----------------------------------------------

      const existingResult =
        await pool.query(
          `
          SELECT id
          FROM saved_jobs
          WHERE candidate_id = $1
            AND job_id = $2
          `,
          [
            candidateId,
            job_id,
          ]
        );


      if (existingResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Job is already saved.",
        });
      }


      // -----------------------------------------------
      // SAVE JOB
      // -----------------------------------------------

      const result = await pool.query(
        `
        INSERT INTO saved_jobs
        (
          candidate_id,
          job_id
        )
        VALUES
        (
          $1,
          $2
        )
        RETURNING
          id,
          candidate_id,
          job_id,
          saved_at
        `,
        [
          candidateId,
          job_id,
        ]
      );


      return res.status(201).json({
        success: true,
        message: "Job saved successfully.",
        savedJob: result.rows[0],
      });

    } catch (error) {
      console.error(
        "Save job error:",
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
// REMOVE SAVED JOB
// DELETE /api/saved-jobs/:jobId
// =====================================================

router.delete(
  "/:jobId",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const candidateId = req.user.id;
      const { jobId } = req.params;


      const result = await pool.query(
        `
        DELETE FROM saved_jobs
        WHERE candidate_id = $1
          AND job_id = $2
        RETURNING id
        `,
        [
          candidateId,
          jobId,
        ]
      );


      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Saved job not found.",
        });
      }


      return res.status(200).json({
        success: true,
        message: "Job removed from saved jobs.",
      });

    } catch (error) {
      console.error(
        "Remove saved job error:",
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
// GET MY SAVED JOBS
// GET /api/saved-jobs
// =====================================================

router.get(
  "/",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const candidateId = req.user.id;


      const result = await pool.query(
        `
        SELECT
          s.id AS saved_job_id,
          s.saved_at,

          j.id,
          j.title,
          j.description,
          j.location,
          j.employment_type,
          j.experience_required,
          j.salary_min,
          j.salary_max,
          j.skills,
          j.status,
          j.industry,
          j.job_type,
          j.work_mode,
          j.created_at,

          o.company_name,
          o.company_email,
          o.website,
          o.company_size,
          o.city,
          o.country

        FROM saved_jobs s

        INNER JOIN jobs j
          ON s.job_id = j.id

        LEFT JOIN organizations o
          ON j.organization_id = o.id

        WHERE s.candidate_id = $1

        ORDER BY s.saved_at DESC
        `,
        [candidateId]
      );


      return res.status(200).json({
        success: true,
        count: result.rows.length,
        savedJobs: result.rows,
      });

    } catch (error) {
      console.error(
        "Get saved jobs error:",
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
// CHECK WHETHER JOB IS SAVED
// GET /api/saved-jobs/check/:jobId
// =====================================================

router.get(
  "/check/:jobId",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  async (req, res) => {
    try {
      const candidateId = req.user.id;
      const { jobId } = req.params;


      const result = await pool.query(
        `
        SELECT id
        FROM saved_jobs
        WHERE candidate_id = $1
          AND job_id = $2
        `,
        [
          candidateId,
          jobId,
        ]
      );


      return res.status(200).json({
        success: true,
        saved: result.rows.length > 0,
      });

    } catch (error) {
      console.error(
        "Check saved job error:",
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