import express from "express";
import pool from "../config/db.js";
import axios from "axios";

import multer from "multer";
import path from "path";
import fs from "fs";

import {
  authenticateUser,
  requireRole,
} from "../middleware/authMiddleware.js";



import {
  sendApplicationStatusEmail,
} from "../services/applicationEmailService.js";
const router = express.Router();


// =====================================================
// RESUME UPLOAD CONFIGURATION
// =====================================================

const resumeUploadPath = path.resolve(
  "uploads/resumes"
);

if (!fs.existsSync(resumeUploadPath)) {
  fs.mkdirSync(resumeUploadPath, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resumeUploadPath);
  },

  filename: (req, file, cb) => {
    const extension =
      path.extname(file.originalname);

    const uniqueName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}${extension}`;

    cb(null, uniqueName);
  },
});

const uploadResume = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return cb(
        new Error(
          "Only PDF, DOC and DOCX files are allowed."
        )
      );
    }

    cb(null, true);
  },
});


// =====================================================
// UPDATE APPLICATION STATUS
// PUT /api/applications/:id/status
// RECRUITER / ADMIN
// =====================================================



const applicationsApi = axios.create({
  baseURL: "/api/applications",
  withCredentials: true,
});


// =====================================================
// APPLY FOR JOB
// =====================================================

export const applyForJob = async (data) => {

  const formData = new FormData();

  formData.append(
    "job_id",
    data.job_id
  );

  if (data.cover_letter) {

    formData.append(
      "cover_letter",
      data.cover_letter
    );

  }

  if (data.resume) {

    formData.append(
      "resume",
      data.resume
    );

  }

  return await applicationsApi.post(
    "/",
    formData
  );

};


// =====================================================
// GET MY APPLICATIONS
// =====================================================

export const getMyApplications = async () => {

  return await applicationsApi.get(
    "/my"
  );

};


// =====================================================
// GET RECRUITER APPLICATIONS
// =====================================================

export const getRecruiterApplications = async () => {

  return await applicationsApi.get(
    "/recruiter"
  );

};


// =====================================================
// VIEW RESUME
// =====================================================

export const viewResume = async (
  applicationId
) => {

  return await applicationsApi.get(
    `/${applicationId}/resume`,
    {
      responseType: "blob",
    }
  );

};


// =====================================================
// UPDATE APPLICATION STATUS
// =====================================================

export const updateApplicationStatus = async (
  applicationId,
  status
) => {

  return await applicationsApi.put(
    `/${applicationId}/status`,
    {
      status,
    }
  );

};

// =====================================================
// APPLY FOR JOB
// POST /api/applications
// JOB SEEKER ONLY
// =====================================================

router.post(
  "/",
  authenticateUser,
  requireRole("JOB_SEEKER"),
  uploadResume.single("resume"),
  async (req, res) => {

    try {

      const {
        job_id,
        cover_letter,
      } = req.body;

      const candidateId = req.user.id;

      console.log(
        "📝 APPLY FOR JOB:",
        {
          candidateId,
          job_id,
          hasResume: !!req.file,
        }
      );

      // =================================================
      // VALIDATE JOB
      // =================================================

      if (!job_id) {

        return res.status(400).json({
          success: false,
          message: "Job ID is required.",
        });

      }

      // =================================================
      // CHECK JOB EXISTS
      // =================================================

      const jobResult = await pool.query(
        `
        SELECT
          id,
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

      // =================================================
      // CHECK JOB IS OPEN
      // =================================================

      if (
        jobResult.rows[0].status &&
        jobResult.rows[0].status !== "OPEN"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "This job is no longer accepting applications.",
        });

      }

      // =================================================
      // PREVENT DUPLICATE APPLICATION
      // =================================================

      const existingApplication =
        await pool.query(
          `
          SELECT id
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
        });

      }

      // =================================================
      // RESUME
      // =================================================

      let resumeUrl = null;

      if (req.file) {

        resumeUrl =
          `/uploads/resumes/${req.file.filename}`;

        console.log(
          "📄 RESUME SAVED:",
          resumeUrl
        );

      }

      // =================================================
      // CREATE APPLICATION
      // =================================================

      const result = await pool.query(
        `
        INSERT INTO applications (
          job_id,
          candidate_id,
          resume_url,
          cover_letter,
          status,
          applied_at,
          updated_at
        )
        VALUES (
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
          resumeUrl,
          cover_letter || null,
        ]
      );

      console.log(
        "✅ APPLICATION CREATED:",
        result.rows[0]
      );

      return res.status(201).json({
        success: true,
        message:
          "Application submitted successfully.",
        application:
          result.rows[0],
      });

    } catch (error) {

      console.error(
        "❌ Apply for job error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to submit application.",
      });

    }

  }
);
// =====================================================
// APPLY FOR JOB
// POST /api/applications
// JOB SEEKER ONLY
// =====================================================

router.use((error, req, res, next) => {

  console.error(
    "APPLICATION UPLOAD ERROR:",
    error
  );

  if (error instanceof multer.MulterError) {

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message:
          "Resume must be 5 MB or smaller.",
      });
    }

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Resume upload failed.",
    });
  }


  if (error) {

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Resume upload failed.",
    });

  }

  next();

});


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
// UPDATE APPLICATION STATUS
// PUT /api/applications/:id/status
// RECRUITER / ADMIN
// =====================================================

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
      const { id } = req.params;
      const { status } = req.body;

      console.log("======================================");
      console.log("📌 UPDATE APPLICATION STATUS");
      console.log("Application ID:", id);
      console.log("New Status:", status);
      console.log("======================================");

      // =====================================================
      // ALLOWED STATUSES
      // =====================================================

      const allowedStatuses = [
        "NEW",
        "SHORTLISTED",
        "INTERVIEW",
        "SELECTED",
        "REJECTED",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application status.",
        });
      }

      // =====================================================
      // GET APPLICATION + CANDIDATE + JOB
      // =====================================================

      const applicationResult = await pool.query(
        `
        SELECT
          a.id,
          a.job_id,
          a.candidate_id,
          a.status AS old_status,

          j.created_by,
          j.title AS job_title,

          u.full_name AS candidate_name,
          u.email AS candidate_email

        FROM applications a

        INNER JOIN jobs j
          ON a.job_id = j.id

        INNER JOIN auth_users u
          ON a.candidate_id = u.id

        WHERE a.id = $1
        `,
        [id]
      );

      // =====================================================
      // APPLICATION NOT FOUND
      // =====================================================

      if (applicationResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found.",
        });
      }

      const application = applicationResult.rows[0];

      console.log("📌 APPLICATION DATA:");
      console.log({
        candidateName: application.candidate_name,
        candidateEmail: application.candidate_email,
        jobTitle: application.job_title,
        oldStatus: application.old_status,
        newStatus: status,
      });

      // =====================================================
      // RECRUITER PERMISSION
      // =====================================================

      if (
        req.user.role === "RECRUITER" &&
        String(application.created_by) !== String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only manage applications for your own jobs.",
        });
      }

      // =====================================================
      // UPDATE STATUS
      // =====================================================

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
        [status, id]
      );

      console.log(
        "✅ APPLICATION STATUS UPDATED:",
        result.rows[0]
      );

      // =====================================================
      // SEND EMAIL
      // =====================================================

      if (
        ["SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"].includes(
          status
        )
      ) {
        console.log("📧 EMAIL REQUIRED FOR STATUS:", status);

        if (!application.candidate_email) {
          console.error(
            "❌ CANDIDATE EMAIL NOT FOUND"
          );
        } else {
          try {
            console.log(
              "📧 SENDING EMAIL TO:",
              application.candidate_email
            );

            await sendApplicationStatusEmail({
              email: application.candidate_email,
              candidateName:
                application.candidate_name || "Candidate",
              jobTitle:
                application.job_title || "Job Position",
              status,
            });

            console.log(
              "✅ APPLICATION STATUS EMAIL SENT SUCCESSFULLY"
            );
          } catch (emailError) {
            console.error(
              "❌ APPLICATION STATUS EMAIL FAILED"
            );

            console.error(emailError);
          }
        }
      }

      // =====================================================
      // RESPONSE
      // =====================================================

      return res.status(200).json({
        success: true,
        message:
          "Application status updated successfully.",
        application: result.rows[0],
      });

    } catch (error) {
      console.error(
        "❌ Update application status error:",
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
// GET RECRUITER APPLICATIONS
// GET /api/applications/recruiter
// RECRUITER / ADMIN
// =====================================================

router.get(
  "/:id/resume",
  authenticateUser,
  requireRole("RECRUITER", "ADMIN"),
  async (req, res) => {

    console.log(
      "🔥 VIEW RESUME ROUTE HIT:",
      req.params.id
    );

    try {

      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT resume_url
        FROM applications
        WHERE id = $1
        `,
        [id]
      );

      console.log(
        "📌 DATABASE RESULT:",
        result.rows
      );

      if (result.rows.length === 0) {

        console.log(
          "❌ APPLICATION NOT FOUND"
        );

        return res.status(404).json({
          success: false,
          message: "Application not found.",
        });
      }

      const resumeUrl =
        result.rows[0].resume_url;

      console.log(
        "📄 RESUME URL:",
        resumeUrl
      );

      if (!resumeUrl) {

        console.log(
          "❌ RESUME URL IS EMPTY"
        );

        return res.status(404).json({
          success: false,
          message: "Resume not found.",
        });
      }

      const cleanPath =
        resumeUrl.replace(/^\/+/, "");

      const filePath =
        path.resolve(
          process.cwd(),
          cleanPath
        );

      console.log(
        "📂 CLEAN PATH:",
        cleanPath
      );

      console.log(
        "📂 FULL FILE PATH:",
        filePath
      );

      const fileExists =
        fs.existsSync(filePath);

      console.log(
        "📁 FILE EXISTS:",
        fileExists
      );

      if (!fileExists) {

        console.log(
          "❌ RESUME FILE DOES NOT EXIST"
        );

        return res.status(404).json({
          success: false,
          message:
            "Resume file does not exist on server.",
          resumeUrl,
          filePath,
        });
      }

      console.log(
        "✅ SENDING RESUME:",
        filePath
      );

      return res.sendFile(filePath);

    } catch (error) {

      console.error(
        "❌ VIEW RESUME ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error.",
      });
    }
  }
);


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




export default router;