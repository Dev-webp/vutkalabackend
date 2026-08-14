import crypto from "crypto";
import pool from "../config/db.js";

export const authenticateUser = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

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
        u.organization_id
      FROM refresh_tokens rt
      JOIN auth_users u
        ON u.id = rt.user_id
      WHERE rt.refresh_token = $1
        AND rt.expires_at > NOW()
      `,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    const user = result.rows[0];

    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first.",
      });
    }

    if (user.status === "REJECTED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been rejected.",
      });
    }

    if (user.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }

    if (
      user.role === "RECRUITER" &&
      user.status !== "APPROVED"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your recruiter account is waiting for admin approval.",
      });
    }

    req.user = user;

    next();

  } catch (error) {
    console.error("Authentication middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    next();
  };
};