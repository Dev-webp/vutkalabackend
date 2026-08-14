import express from "express";
import pool from "../config/db.js";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();


// =====================================================
// GET MY ORGANIZATION
// =====================================================

router.get(
  "/my",
  authenticateUser,
  requireRole("RECRUITER"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          o.id,
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
          o.status,
          o.created_at,
          o.updated_at

        FROM auth_users u

        INNER JOIN organizations o
          ON u.organization_id = o.id

        WHERE u.id = $1
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Organization not found.",
        });
      }

      return res.status(200).json({
        success: true,
        organization: result.rows[0],
      });

    } catch (error) {
      console.error(
        "Get my organization error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  }
);


// =====================================================
// UPDATE MY ORGANIZATION
// =====================================================

router.put(
  "/my",
  authenticateUser,
  requireRole("RECRUITER"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
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
      } = req.body;


      // -----------------------------------------------
      // Find recruiter's organization
      // -----------------------------------------------

      const organizationResult = await pool.query(
        `
        SELECT organization_id
        FROM auth_users
        WHERE id = $1
          AND role = 'RECRUITER'
        `,
        [userId]
      );

      if (
        organizationResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "Recruiter not found.",
        });
      }

      const organizationId =
        organizationResult.rows[0].organization_id;


      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message:
            "No organization is assigned to this recruiter.",
        });
      }


      // -----------------------------------------------
      // Update organization
      // -----------------------------------------------

      const result = await pool.query(
        `
        UPDATE organizations

        SET
          company_name = $1,
          company_email = $2,
          company_phone = $3,
          website = $4,
          industry = $5,
          company_size = $6,
          address = $7,
          city = $8,
          country = $9,
          description = $10,
          updated_at = NOW()

        WHERE id = $11

        RETURNING
          id,
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
          status,
          created_at,
          updated_at
        `,
        [
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
          organizationId,
        ]
      );


      return res.status(200).json({
        success: true,
        message:
          "Company profile updated successfully.",
        organization: result.rows[0],
      });

    } catch (error) {
      console.error(
        "Update my organization error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  }
);


export default router;