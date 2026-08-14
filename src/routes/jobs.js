import express from "express";
import pool from "../config/db.js";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
=========================================================
GET ALL OPEN JOBS
GET /api/jobs
PUBLIC
=========================================================
*/

/*
=========================================================
GET ALL OPEN JOBS
GET /api/jobs
PUBLIC

SUPPORTED FILTERS:

/api/jobs?search=react
/api/jobs?location=Hyderabad
/api/jobs?industry=Information%20Technology
/api/jobs?employment_type=FULL_TIME
/api/jobs?job_type=FULL_TIME
/api/jobs?work_mode=REMOTE

Multiple filters can be combined.
=========================================================
*/

router.get("/", async (req, res) => {
  try {
    const {
      search,
      location,
      industry,
      employment_type,
      job_type,
      work_mode,
      experience,
      salary_min,
      salary_max,
    } = req.query;

    // =====================================================
    // BASE CONDITION
    // Only show OPEN jobs
    // =====================================================

    const conditions = [
      "j.status = 'OPEN'",
    ];

    const values = [];


    // =====================================================
    // SEARCH
    //
    // Searches:
    // - Job title
    // - Description
    // - Skills
    // - Company name
    // - Industry
    // =====================================================

    if (search && search.trim()) {
      values.push(`%${search.trim()}%`);

      const param = `$${values.length}`;

      conditions.push(`
        (
          j.title ILIKE ${param}
          OR j.description ILIKE ${param}
          OR j.skills ILIKE ${param}
          OR o.company_name ILIKE ${param}
          OR j.industry ILIKE ${param}
        )
      `);
    }


    // =====================================================
    // LOCATION
    //
    // Searches:
    // - Job location
    // - Company city
    // - Company country
    // =====================================================

    if (location && location.trim()) {
      values.push(`%${location.trim()}%`);

      const param = `$${values.length}`;

      conditions.push(`
        (
          j.location ILIKE ${param}
          OR o.city ILIKE ${param}
          OR o.country ILIKE ${param}
        )
      `);
    }


    // =====================================================
    // INDUSTRY
    // =====================================================

    if (industry && industry.trim()) {
      values.push(industry.trim());

      conditions.push(`
        LOWER(j.industry) =
        LOWER($${values.length})
      `);
    }


    // =====================================================
    // EMPLOYMENT TYPE
    // =====================================================

    if (
      employment_type &&
      employment_type.trim()
    ) {
      values.push(
        employment_type.trim()
      );

      conditions.push(`
        LOWER(j.employment_type) =
        LOWER($${values.length})
      `);
    }


    // =====================================================
    // JOB TYPE
    // =====================================================

    if (
      job_type &&
      job_type.trim()
    ) {
      values.push(
        job_type.trim()
      );

      conditions.push(`
        LOWER(j.job_type) =
        LOWER($${values.length})
      `);
    }


    // =====================================================
    // WORK MODE
    // =====================================================

    if (
      work_mode &&
      work_mode.trim()
    ) {
      values.push(
        work_mode.trim()
      );

      conditions.push(`
        LOWER(j.work_mode) =
        LOWER($${values.length})
      `);
    }


    // =====================================================
    // EXPERIENCE
    //
    // Current database stores experience as text,
    // for example:
    //
    // "2-4 years"
    // "3 years"
    // "Fresher"
    //
    // Therefore we use text matching for now.
    // =====================================================

    if (
      experience &&
      experience.trim()
    ) {
      values.push(
        `%${experience.trim()}%`
      );

      conditions.push(`
        j.experience_required ILIKE
        $${values.length}
      `);
    }


    // =====================================================
    // MINIMUM SALARY
    //
    // Example:
    // User searches minimum 50000
    //
    // Job maximum salary must be >= 50000
    // =====================================================

    if (salary_min) {
      const parsedSalaryMin =
        Number(salary_min);

      if (
        Number.isFinite(
          parsedSalaryMin
        )
      ) {
        values.push(
          parsedSalaryMin
        );

        conditions.push(`
          COALESCE(j.salary_max, 0) >=
          $${values.length}
        `);
      }
    }


    // =====================================================
    // MAXIMUM SALARY
    //
    // Example:
    // User searches maximum 100000
    //
    // Job minimum salary must be <= 100000
    // =====================================================

    if (salary_max) {
      const parsedSalaryMax =
        Number(salary_max);

      if (
        Number.isFinite(
          parsedSalaryMax
        )
      ) {
        values.push(
          parsedSalaryMax
        );

        conditions.push(`
          COALESCE(j.salary_min, 0) <=
          $${values.length}
        `);
      }
    }


    // =====================================================
    // FINAL QUERY
    // =====================================================

    const query = `
      SELECT
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
        j.created_by,
        j.organization_id,
        j.industry,
        j.job_type,
        j.work_mode,
        j.created_at,
        j.updated_at,

        u.full_name AS recruiter_name,

        o.company_name,
        o.company_email,
        o.website,
        o.industry AS company_industry,
        o.company_size,
        o.address AS company_address,
        o.city,
        o.country

      FROM jobs j

      LEFT JOIN auth_users u
        ON j.created_by = u.id

      LEFT JOIN organizations o
        ON j.organization_id = o.id

      WHERE ${conditions.join(" AND ")}

      ORDER BY j.created_at DESC
    `;


    // =====================================================
    // EXECUTE QUERY
    // =====================================================

    const result = await pool.query(
      query,
      values
    );


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      jobs: result.rows,
    });

  } catch (error) {

    console.error(
      "Get jobs error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

/*
=========================================================
GET MY JOBS
GET /api/jobs/my
RECRUITER / ADMIN
=========================================================
*/

router.get(
  "/my",
  authenticateUser,
  requireRole("RECRUITER", "ADMIN"),
  async (req, res) => {
    try {
      let query;
      let values;

      if (req.user.role === "ADMIN") {
        /*
        ADMIN:
        Return all jobs
        */

        query = `
          SELECT
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
            j.created_by,
            j.organization_id,
            j.created_at,
            j.updated_at,

            u.full_name AS recruiter_name,

            o.company_name,
            o.company_email,
            o.website,
            o.industry,
            o.company_size,
            o.city,
            o.country

          FROM jobs j

          LEFT JOIN auth_users u
            ON j.created_by = u.id

          LEFT JOIN organizations o
            ON j.organization_id = o.id

          ORDER BY j.created_at DESC
        `;

        values = [];
      } else {
        /*
        RECRUITER:
        Return only jobs created by this recruiter
        */

        query = `
          SELECT
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
            j.created_by,
            j.organization_id,
            j.created_at,
            j.updated_at,

            u.full_name AS recruiter_name,

            o.company_name,
            o.company_email,
            o.website,
            o.industry,
            o.company_size,
            o.city,
            o.country

          FROM jobs j

          LEFT JOIN auth_users u
            ON j.created_by = u.id

          LEFT JOIN organizations o
            ON j.organization_id = o.id

          WHERE j.created_by = $1

          ORDER BY j.created_at DESC
        `;

        values = [req.user.id];
      }

      const result = await pool.query(
        query,
        values
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        jobs: result.rows,
      });

    } catch (error) {

      console.error(
        "Get my jobs error:",
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
GET SINGLE JOB
GET /api/jobs/:id
PUBLIC
=========================================================
*/



router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
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
        j.created_by,
        j.organization_id,
        j.created_at,
        j.updated_at,

        u.full_name AS recruiter_name,

        o.company_name,
        o.company_email,
        o.website,
        o.industry,
        o.company_size,
        o.address,
        o.city,
        o.country,
        o.description AS company_description

      FROM jobs j

      LEFT JOIN auth_users u
        ON j.created_by = u.id

      LEFT JOIN organizations o
        ON j.organization_id = o.id

      WHERE j.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    return res.status(200).json({
      success: true,
      job: result.rows[0],
    });
  } catch (error) {
    console.error("Get job error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


/*
=========================================================
CREATE JOB
POST /api/jobs
RECRUITER / ADMIN
=========================================================
*/

router.post(
  "/",
  authenticateUser,
  requireRole("RECRUITER", "ADMIN"),
  async (req, res) => {
    try {
      // =================================================
      // GET DATA FROM REQUEST
      // =================================================

      const {
        title,
        description,
        location,
        employment_type,
        experience_required,
        salary_min,
        salary_max,
        skills,
        industry,
        job_type,
        work_mode,
      } = req.body;


      // =================================================
      // BASIC VALIDATION
      // =================================================

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message:
            "Title and description are required.",
        });
      }


      // =================================================
      // DETERMINE ORGANIZATION
      // =================================================

      let organizationId = null;


      // -------------------------------------------------
      // RECRUITER
      // -------------------------------------------------

      if (req.user.role === "RECRUITER") {
        organizationId =
          req.user.organization_id;

        if (!organizationId) {
          return res.status(400).json({
            success: false,
            message:
              "Recruiter is not associated with an organization.",
          });
        }
      }


      // -------------------------------------------------
      // ADMIN
      // -------------------------------------------------

      if (
        req.user.role === "ADMIN" &&
        req.body.organization_id
      ) {
        organizationId =
          req.body.organization_id;
      }


      // =================================================
      // CREATE JOB
      // =================================================

      const result = await pool.query(
        `
        INSERT INTO jobs
        (
          title,
          description,
          location,
          employment_type,
          experience_required,
          salary_min,
          salary_max,
          skills,
          industry,
          job_type,
          work_mode,
          status,
          created_by,
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
          $8,
          $9,
          $10,
          $11,
          'OPEN',
          $12,
          $13
        )

        RETURNING
          id,
          title,
          description,
          location,
          employment_type,
          experience_required,
          salary_min,
          salary_max,
          skills,
          industry,
          job_type,
          work_mode,
          status,
          created_by,
          organization_id,
          created_at,
          updated_at
        `,
        [
          title,
          description,
          location || null,
          employment_type || null,
          experience_required || null,
          salary_min || null,
          salary_max || null,
          skills || null,
          industry || null,
          job_type || null,
          work_mode || null,
          req.user.id,
          organizationId,
        ]
      );


      // =================================================
      // SUCCESS
      // =================================================

      return res.status(201).json({
        success: true,
        message:
          "Job posted successfully.",
        job: result.rows[0],
      });


    } catch (error) {

      console.error(
        "Create job error:",
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
UPDATE JOB
PUT /api/jobs/:id
RECRUITER OWNER / ADMIN
=========================================================
*/

router.put(
  "/:id",
  authenticateUser,
  requireRole("RECRUITER", "ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const existingJob = await pool.query(
        `
        SELECT
          id,
          created_by,
          status
        FROM jobs
        WHERE id = $1
        `,
        [id]
      );

      if (existingJob.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }

      const job = existingJob.rows[0];

      /*
      ---------------------------------------------------
      Recruiter can modify only own jobs
      ---------------------------------------------------
      */

      if (
        req.user.role === "RECRUITER" &&
        job.created_by !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only modify your own job posts.",
        });
      }

      const {
        title,
        description,
        location,
        employment_type,
        experience_required,
        salary_min,
        salary_max,
        skills,
        status,
      } = req.body;

      const result = await pool.query(
        `
        UPDATE jobs
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          location = COALESCE($3, location),
          employment_type = COALESCE($4, employment_type),
          experience_required = COALESCE($5, experience_required),
          salary_min = COALESCE($6, salary_min),
          salary_max = COALESCE($7, salary_max),
          skills = COALESCE($8, skills),
          status = COALESCE($9, status),
          updated_at = NOW()
        WHERE id = $10
        RETURNING
          id,
          title,
          description,
          location,
          employment_type,
          experience_required,
          salary_min,
          salary_max,
          skills,
          status,
          created_by,
          organization_id,
          created_at,
          updated_at
        `,
        [
          title,
          description,
          location,
          employment_type,
          experience_required,
          salary_min,
          salary_max,
          skills,
          status,
          id,
        ]
      );

      return res.status(200).json({
        success: true,
        message: "Job updated successfully.",
        job: result.rows[0],
      });
    } catch (error) {
      console.error("Update job error:", error);

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  }
);


/*
=========================================================
ARCHIVE JOB
DELETE /api/jobs/:id
RECRUITER OWNER / ADMIN
=========================================================
*/

router.delete(
  "/:id",
  authenticateUser,
  requireRole("RECRUITER", "ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const existingJob = await pool.query(
        `
        SELECT
          id,
          created_by,
          status
        FROM jobs
        WHERE id = $1
        `,
        [id]
      );

      if (existingJob.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }

      const job = existingJob.rows[0];

      /*
      ---------------------------------------------------
      Recruiter can archive only own jobs
      ---------------------------------------------------
      */

      if (
        req.user.role === "RECRUITER" &&
        job.created_by !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only delete your own job posts.",
        });
      }

      await pool.query(
        `
        UPDATE jobs
        SET
          status = 'ARCHIVED',
          updated_at = NOW()
        WHERE id = $1
        `,
        [id]
      );

      return res.status(200).json({
        success: true,
        message: "Job archived successfully.",
      });
    } catch (error) {
      console.error("Archive job error:", error);

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  }
);

export default router;