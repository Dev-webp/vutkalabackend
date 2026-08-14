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

export default router;