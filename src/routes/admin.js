
import express from "express";
import pool from "../config/db.js";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
=========================================================
GET PENDING RECRUITERS
GET /api/admin/recruiters/pending
=========================================================
*/

router.get(
  "/recruiters/pending",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.is_email_verified,
          u.created_at,

          o.id AS organization_id,
          o.company_name,
          o.company_email,
          o.company_phone,
          o.website,
          o.industry,
          o.company_size,
          o.address,
          o.city,
          o.country,
          o.description,
          o.status AS organization_status

        FROM auth_users u

        LEFT JOIN organizations o
          ON u.organization_id = o.id

        WHERE u.role = 'RECRUITER'
          AND u.status = 'PENDING'

        ORDER BY u.created_at DESC
        `
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        recruiters: result.rows,
      });
    } catch (error) {
      console.error(
        "Get pending recruiters error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  }
);


/*
=========================================================
GET SINGLE RECRUITER
GET /api/admin/recruiters/:id
=========================================================
*/


/*
=========================================================
GET ADMIN APPROVALS
GET /api/admin/approvals
=========================================================
*/

router.get(
  "/approvals",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.is_email_verified,
          u.created_at,

          o.id AS organization_id,
          o.company_name,
          o.company_email,
          o.company_phone,
          o.website,
          o.industry,
          o.company_size,
          o.address,
          o.city,
          o.country,
          o.description,
          o.status AS organization_status

        FROM auth_users u

        LEFT JOIN organizations o
          ON u.organization_id = o.id

        WHERE u.status = 'PENDING'

        ORDER BY u.created_at DESC
        `
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        approvals: result.rows,
      });

    } catch (error) {
      console.error(
        "Get admin approvals error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load approvals.",
      });
    }
  }
);


router.get(
  "/recruiters/:id",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.is_email_verified,
          u.created_at,
          u.updated_at,

          o.id AS organization_id,
          o.company_name,
          o.company_email,
          o.company_phone,
          o.website,
          o.industry,
          o.company_size,
          o.address,
          o.city,
          o.country,
          o.description,
          o.status AS organization_status

        FROM auth_users u

        LEFT JOIN organizations o
          ON u.organization_id = o.id

        WHERE u.id = $1
          AND u.role = 'RECRUITER'
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Recruiter not found.",
        });
      }

      return res.status(200).json({
        success: true,
        recruiter: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Get recruiter error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  }
);


/*
=========================================================
APPROVE RECRUITER
PUT /api/admin/recruiters/:id/approve
=========================================================
*/

router.put(
  "/recruiters/:id/approve",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;

      await client.query("BEGIN");

      const recruiterResult = await client.query(
        `
        SELECT
          id,
          role,
          status,
          organization_id
        FROM auth_users
        WHERE id = $1
        `,
        [id]
      );

      if (recruiterResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Recruiter not found.",
        });
      }

      const recruiter = recruiterResult.rows[0];

      if (recruiter.role !== "RECRUITER") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "This user is not a recruiter.",
        });
      }

      if (recruiter.status === "APPROVED") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Recruiter is already approved.",
        });
      }

      await client.query(
        `
        UPDATE auth_users
        SET
          status = 'APPROVED',
          updated_at = NOW()
        WHERE id = $1
        `,
        [id]
      );

      if (recruiter.organization_id) {
        await client.query(
          `
          UPDATE organizations
          SET
            status = 'APPROVED',
            updated_at = NOW()
          WHERE id = $1
          `,
          [recruiter.organization_id]
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Recruiter approved successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Approve recruiter error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    } finally {
      client.release();
    }
  }
);


/*
=========================================================
REJECT RECRUITER
PUT /api/admin/recruiters/:id/reject
=========================================================
*/

router.put(
  "/recruiters/:id/reject",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;

      await client.query("BEGIN");

      const recruiterResult = await client.query(
        `
        SELECT
          id,
          role,
          status,
          organization_id
        FROM auth_users
        WHERE id = $1
        `,
        [id]
      );

      if (recruiterResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Recruiter not found.",
        });
      }

      const recruiter = recruiterResult.rows[0];

      if (recruiter.role !== "RECRUITER") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "This user is not a recruiter.",
        });
      }

      await client.query(
        `
        UPDATE auth_users
        SET
          status = 'REJECTED',
          updated_at = NOW()
        WHERE id = $1
        `,
        [id]
      );

      if (recruiter.organization_id) {
        await client.query(
          `
          UPDATE organizations
          SET
            status = 'REJECTED',
            updated_at = NOW()
          WHERE id = $1
          `,
          [recruiter.organization_id]
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Recruiter rejected successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Reject recruiter error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    } finally {
      client.release();
    }
  }
);


/*
=========================================================
ADMIN DASHBOARD
GET /api/admin/dashboard
=========================================================
*/

router.get(
  "/dashboard",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      // =====================================================
      // TOTAL USERS
      // =====================================================

      const totalUsersResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM auth_users
      `);

      // =====================================================
      // JOB SEEKERS
      // =====================================================

      const jobSeekersResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM auth_users
        WHERE role = 'JOB_SEEKER'
      `);

      // =====================================================
      // RECRUITERS
      // =====================================================

      const recruitersResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM auth_users
        WHERE role = 'RECRUITER'
      `);

      // =====================================================
      // COMPANIES
      // =====================================================

      const companiesResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM organizations
      `);

      // =====================================================
      // ACTIVE JOBS
      // =====================================================

      const activeJobsResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM jobs
        WHERE status = 'ACTIVE'
      `);

      // =====================================================
      // PENDING APPROVALS
      // =====================================================

      const pendingApprovalsResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM auth_users
        WHERE role = 'RECRUITER'
          AND status = 'PENDING'
      `);

      // =====================================================
      // RECENT USERS
      // =====================================================

      const recentUsersResult = await pool.query(`
        SELECT
          id,
          full_name,
          email,
          role,
          status,
          created_at
        FROM auth_users
        ORDER BY created_at DESC
        LIMIT 10
      `);

      // =====================================================
      // RESPONSE
      // =====================================================

      return res.status(200).json({
        success: true,

        stats: {
          totalUsers: Number(
            totalUsersResult.rows[0]?.count || 0
          ),

          jobSeekers: Number(
            jobSeekersResult.rows[0]?.count || 0
          ),

          recruiters: Number(
            recruitersResult.rows[0]?.count || 0
          ),

          companies: Number(
            companiesResult.rows[0]?.count || 0
          ),

          activeJobs: Number(
            activeJobsResult.rows[0]?.count || 0
          ),

          pendingApprovals: Number(
            pendingApprovalsResult.rows[0]?.count || 0
          ),
        },

        recentUsers: recentUsersResult.rows,
      });

    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load admin dashboard.",
      });
    }
  }
);



/*
=========================================================
GET ADMIN USERS
GET /api/admin/users
=========================================================
*/

router.get(
  "/users",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          full_name,
          email,
          phone,
          role,
          status,
          is_email_verified,
          organization_id,
          created_at,
          updated_at
        FROM auth_users
        ORDER BY created_at DESC
      `);

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        users: result.rows,
      });

    } catch (error) {
      console.error(
        "Get admin users error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load users.",
      });
    }
  }
);



// =========================================================
// ADMIN JOB MANAGEMENT
// =========================================================
//
// GET    /api/admin/jobs
// GET    /api/admin/jobs/:id
// GET    /api/admin/jobs/:id/applications
// GET    /api/admin/jobs/:id/shortlisted
// PUT    /api/admin/jobs/:id/status
// PUT    /api/admin/jobs/:id/archive
// PUT    /api/admin/jobs/:id/restore
//
// =========================================================


// =========================================================
// GET ALL JOBS
// GET /api/admin/jobs
// =========================================================

router.get(
  "/jobs",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          j.*,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
          )::INTEGER AS applications_count,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
              AND UPPER(COALESCE(a.status, '')) = 'SHORTLISTED'
          )::INTEGER AS shortlisted_count

        FROM jobs j

        ORDER BY j.created_at DESC
      `);

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        jobs: result.rows,
      });

    } catch (error) {
      console.error(
        "ADMIN GET JOBS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load jobs.",
      });
    }
  }
);


// =========================================================
// GET COMPLETE JOB DETAILS
// GET /api/admin/jobs/:id
// =========================================================

router.get(
  "/jobs/:id",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      // -----------------------------------------------------
      // JOB
      // -----------------------------------------------------

      const jobResult = await pool.query(
        `
        SELECT
          j.*,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
          )::INTEGER AS applications_count,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
              AND UPPER(COALESCE(a.status, '')) = 'SHORTLISTED'
          )::INTEGER AS shortlisted_count,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
              AND UPPER(COALESCE(a.status, '')) = 'PENDING'
          )::INTEGER AS pending_applications_count,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
              AND UPPER(COALESCE(a.status, '')) = 'REJECTED'
          )::INTEGER AS rejected_applications_count,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
              AND UPPER(COALESCE(a.status, '')) = 'HIRED'
          )::INTEGER AS hired_applications_count

        FROM jobs j

        WHERE j.id = $1
        `,
        [id]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }

      const job = jobResult.rows[0];

      // -----------------------------------------------------
      // COMPANY
      // -----------------------------------------------------

      let company = null;

      if (job.organization_id) {
        const companyResult = await pool.query(
          `
          SELECT *
          FROM organizations
          WHERE id = $1
          LIMIT 1
          `,
          [job.organization_id]
        );

        company =
          companyResult.rows[0] || null;
      }

      // -----------------------------------------------------
      // RECRUITER
      // -----------------------------------------------------

      let recruiter = null;

      if (job.created_by) {
        const recruiterResult =
          await pool.query(
            `
            SELECT
              id,
              full_name,
              email,
              phone,
              role,
              status,
              organization_id,
              created_at
            FROM auth_users
            WHERE id = $1
            LIMIT 1
            `,
            [job.created_by]
          );

        recruiter =
          recruiterResult.rows[0] || null;
      }

      // -----------------------------------------------------
      // RESPONSE
      // -----------------------------------------------------

      return res.status(200).json({
        success: true,

        job,

        company,

        recruiter,
      });

    } catch (error) {
      console.error(
        "ADMIN GET JOB DETAILS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load job details.",
      });
    }
  }
);


// =========================================================
// GET ALL APPLICATIONS FOR JOB
// GET /api/admin/jobs/:id/applications
// =========================================================

router.get(
  "/jobs/:id/applications",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT
          a.*,

          u.full_name AS candidate_name,
          u.email AS candidate_email,
          u.phone AS candidate_phone,
          u.status AS candidate_account_status,

          j.title AS job_title,
          j.location AS job_location

        FROM applications a

        INNER JOIN auth_users u
          ON a.candidate_id = u.id

        INNER JOIN jobs j
          ON a.job_id = j.id

        WHERE a.job_id = $1

        ORDER BY a.applied_at DESC
        `,
        [id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        applications: result.rows,
      });

    } catch (error) {
      console.error(
        "ADMIN GET JOB APPLICATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load job applications.",
      });
    }
  }
);


// =========================================================
// GET SHORTLISTED CANDIDATES
// GET /api/admin/jobs/:id/shortlisted
// =========================================================

router.get(
  "/jobs/:id/shortlisted",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT
          a.*,

          u.full_name AS candidate_name,
          u.email AS candidate_email,
          u.phone AS candidate_phone,

          j.title AS job_title

        FROM applications a

        INNER JOIN auth_users u
          ON a.candidate_id = u.id

        INNER JOIN jobs j
          ON a.job_id = j.id

        WHERE a.job_id = $1

          AND UPPER(
            COALESCE(a.status, '')
          ) = 'SHORTLISTED'

        ORDER BY a.updated_at DESC
        `,
        [id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        shortlisted: result.rows,
      });

    } catch (error) {
      console.error(
        "ADMIN GET SHORTLISTED ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load shortlisted candidates.",
      });
    }
  }
);


// =========================================================
// UPDATE JOB STATUS
// PUT /api/admin/jobs/:id/status
// =========================================================

router.put(
  "/jobs/:id/status",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        status,
      } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status is required.",
        });
      }

      const newStatus = String(
        status
      )
        .trim()
        .toUpperCase();

      const allowedStatuses = [
        "OPEN",
        "ACTIVE",
        "PENDING",
        "DRAFT",
        "CLOSED",
        "REJECTED",
        "EXPIRED",
        "ARCHIVED",
      ];

      if (
        !allowedStatuses.includes(
          newStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid job status.",
          allowedStatuses,
        });
      }

      const result = await pool.query(
        `
        UPDATE jobs

        SET
          status = $1,
          updated_at = NOW()

        WHERE id = $2

        RETURNING *
        `,
        [
          newStatus,
          id,
        ]
      );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Job status updated successfully.",
        job: result.rows[0],
      });

    } catch (error) {
      console.error(
        "ADMIN UPDATE JOB STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to update job status.",
      });
    }
  }
);


// =========================================================
// ARCHIVE JOB
// PUT /api/admin/jobs/:id/archive
// =========================================================

router.put(
  "/jobs/:id/archive",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        UPDATE jobs

        SET
          status = 'ARCHIVED',
          updated_at = NOW()

        WHERE id = $1

        RETURNING *
        `,
        [id]
      );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Job archived successfully.",
        job: result.rows[0],
      });

    } catch (error) {
      console.error(
        "ADMIN ARCHIVE JOB ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to archive job.",
      });
    }
  }
);


// =========================================================
// RESTORE JOB
// PUT /api/admin/jobs/:id/restore
// =========================================================

router.put(
  "/jobs/:id/restore",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        UPDATE jobs

        SET
          status = 'OPEN',
          updated_at = NOW()

        WHERE id = $1

        RETURNING *
        `,
        [id]
      );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Job restored successfully.",
        job: result.rows[0],
      });

    } catch (error) {
      console.error(
        "ADMIN RESTORE JOB ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to restore job.",
      });
    }
  }
);




/*
=========================================================
ADMIN COMPANY MANAGEMENT
=========================================================

GET    /api/admin/companies
GET    /api/admin/companies/:id
PUT    /api/admin/companies/:id/block
PUT    /api/admin/companies/:id/unblock
DELETE /api/admin/companies/:id

=========================================================
*/


// =========================================================
// GET ALL COMPANIES
// GET /api/admin/companies
// =========================================================

router.get(
  "/companies",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {

      const result = await pool.query(`
        SELECT
          o.*,

          (
            SELECT COUNT(*)
            FROM auth_users u
            WHERE u.organization_id = o.id
              AND u.role = 'RECRUITER'
          )::INTEGER AS recruiters_count,

          (
            SELECT COUNT(*)
            FROM jobs j
            WHERE j.organization_id = o.id
          )::INTEGER AS jobs_count

        FROM organizations o

        ORDER BY
          o.created_at DESC NULLS LAST
      `);


      return res.status(200).json({
        success: true,
        count: result.rows.length,
        companies: result.rows,
      });

    } catch (error) {

      console.error(
        "ADMIN GET COMPANIES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load companies.",
      });
    }
  }
);


// =========================================================
// GET SINGLE COMPANY
// GET /api/admin/companies/:id
// =========================================================

router.get(
  "/companies/:id",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {

    try {

      const { id } = req.params;


      const companyResult =
        await pool.query(
          `
          SELECT
            o.*,

            (
              SELECT COUNT(*)
              FROM auth_users u
              WHERE u.organization_id = o.id
                AND u.role = 'RECRUITER'
            )::INTEGER AS recruiters_count,

            (
              SELECT COUNT(*)
              FROM jobs j
              WHERE j.organization_id = o.id
            )::INTEGER AS jobs_count

          FROM organizations o

          WHERE o.id = $1

          LIMIT 1
          `,
          [id]
        );


      if (
        companyResult.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message: "Company not found.",
        });

      }


      return res.status(200).json({
        success: true,
        company:
          companyResult.rows[0],
      });

    } catch (error) {

      console.error(
        "ADMIN GET COMPANY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load company.",
      });
    }
  }
);


// =========================================================
// BLOCK COMPANY
// PUT /api/admin/companies/:id/block
// =========================================================

router.put(
  "/companies/:id/block",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {

    try {

      const { id } = req.params;


      /*
      =======================================================
      CHECK COMPANY
      =======================================================
      */

      const companyResult =
        await pool.query(
          `
          SELECT
            id,
            company_name,
            status
          FROM organizations
          WHERE id = $1
          LIMIT 1
          `,
          [id]
        );


      if (
        companyResult.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message: "Company not found.",
        });

      }


      /*
      =======================================================
      BLOCK COMPANY
      =======================================================
      */

      const result =
        await pool.query(
          `
          UPDATE organizations

          SET
            status = 'BLOCKED',
            updated_at = NOW()

          WHERE id = $1

          RETURNING *
          `,
          [id]
        );


      /*
      =======================================================
      OPTIONAL:
      CLOSE / ARCHIVE OPEN JOBS
      =======================================================

      We do NOT delete the jobs.

      Existing applications remain preserved.
      =======================================================
      */

      await pool.query(
        `
        UPDATE jobs

        SET
          status = 'ARCHIVED',
          updated_at = NOW()

        WHERE organization_id = $1
          AND UPPER(
            COALESCE(status, '')
          ) IN (
            'OPEN',
            'ACTIVE'
          )
        `,
        [id]
      );


      return res.status(200).json({
        success: true,
        message:
          "Company blocked successfully. New job posting has been disabled.",

        company:
          result.rows[0],
      });

    } catch (error) {

      console.error(
        "ADMIN BLOCK COMPANY ERROR:",
        error
      );


      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to block company.",
      });
    }
  }
);


// =========================================================
// UNBLOCK COMPANY
// PUT /api/admin/companies/:id/unblock
// =========================================================

router.put(
  "/companies/:id/unblock",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {

    try {

      const { id } = req.params;


      /*
      =======================================================
      CHECK COMPANY
      =======================================================
      */

      const companyResult =
        await pool.query(
          `
          SELECT
            id,
            company_name,
            status
          FROM organizations
          WHERE id = $1
          LIMIT 1
          `,
          [id]
        );


      if (
        companyResult.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message: "Company not found.",
        });

      }


      /*
      =======================================================
      UNBLOCK
      =======================================================
      */

      const result =
        await pool.query(
          `
          UPDATE organizations

          SET
            status = 'APPROVED',
            updated_at = NOW()

          WHERE id = $1

          RETURNING *
          `,
          [id]
        );


      return res.status(200).json({
        success: true,
        message:
          "Company unblocked successfully.",

        company:
          result.rows[0],
      });

    } catch (error) {

      console.error(
        "ADMIN UNBLOCK COMPANY ERROR:",
        error
      );


      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to unblock company.",
      });
    }
  }
);


// =========================================================
// DELETE COMPANY
// DELETE /api/admin/companies/:id
// =========================================================

router.delete(
  "/companies/:id",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      const { id } = req.params;


      await client.query(
        "BEGIN"
      );


      /*
      =======================================================
      CHECK COMPANY
      =======================================================
      */

      const companyResult =
        await client.query(
          `
          SELECT
            id,
            company_name
          FROM organizations

          WHERE id = $1

          LIMIT 1
          `,
          [id]
        );


      if (
        companyResult.rows.length === 0
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          message: "Company not found.",
        });

      }


      /*
      =======================================================
      CHECK RELATED JOBS
      =======================================================
      */

      const jobsResult =
        await client.query(
          `
          SELECT
            COUNT(*)::INTEGER AS count

          FROM jobs

          WHERE organization_id = $1
          `,
          [id]
        );


      const jobsCount =
        Number(
          jobsResult.rows[0]?.count || 0
        );


      /*
      =======================================================
      IMPORTANT SAFETY CHECK
      =======================================================

      We do not permanently delete a company that has jobs.

      This protects:
        - job records
        - applications
        - candidate history
      =======================================================
      */

      if (jobsCount > 0) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(409).json({

          success: false,

          message:
            `Company cannot be permanently deleted because it has ${jobsCount} job(s). Block the company instead.`,

          jobs_count:
            jobsCount,

        });

      }


      /*
      =======================================================
      DELETE COMPANY
      =======================================================
      */

      await client.query(
        `
        DELETE FROM organizations
        WHERE id = $1
        `,
        [id]
      );


      await client.query(
        "COMMIT"
      );


      return res.status(200).json({

        success: true,

        message:
          "Company deleted successfully.",

      });

    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      console.error(
        "ADMIN DELETE COMPANY ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          error?.message ||
          "Failed to delete company.",

      });

    } finally {

      client.release();

    }
  }
);

/*
=========================================================
ADMIN APPLICATIONS
=========================================================

GET /api/admin/applications

=========================================================
*/

router.get(
  "/applications",
  authenticateUser,
  requireRole("ADMIN"),
  async (req, res) => {
    try {

      const result = await pool.query(`
        SELECT
          a.*,

          u.full_name AS candidate_name,
          u.email AS candidate_email,
          u.phone AS candidate_phone,

          j.title AS job_title,
          j.location AS job_location

        FROM applications a

        INNER JOIN auth_users u
          ON a.candidate_id = u.id

        INNER JOIN jobs j
          ON a.job_id = j.id

        ORDER BY
          a.applied_at DESC NULLS LAST,
          a.updated_at DESC NULLS LAST
      `);

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        applications: result.rows,
      });

    } catch (error) {

      console.error(
        "ADMIN GET ALL APPLICATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load applications.",
      });
    }
  }
);

export default router;