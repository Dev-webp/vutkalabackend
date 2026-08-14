import pool from "../config/db.js";

const adminMiddleware = async (req, res, next) => {
  try {
    /*
     * For now, we need the logged-in user's ID.
     *
     * This expects req.userId to be set by your
     * authentication middleware.
     */
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        role,
        status,
        is_email_verified
      FROM auth_users
      WHERE id = $1
      `,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = result.rows[0];

    /*
     * Must be ADMIN
     */
    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    /*
     * Admin account must also be approved
     */
    if (user.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Admin account is not approved.",
      });
    }

    /*
     * Email must be verified
     */
    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: "Email verification required.",
      });
    }

    /*
     * Attach user to request
     */
    req.user = user;

    next();

  } catch (error) {

    console.error("Admin middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export default adminMiddleware;