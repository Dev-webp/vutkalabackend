import express from "express";
import pool from "../config/db.js";
import {
  sendCandidateContactEmail,
} from "../services/candidateEmailService.js";

const router = express.Router();

/* =========================================================
   HELPER
   ========================================================= */

/**
 * Convert query value to a safe trimmed string.
 */
const cleanQuery = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};


/**
 * Parse experience filter.
 *
 * Supported:
 * 0-1
 * 1-3
 * 3-5
 * 5-10
 * 10+
 */
const addExperienceFilter = (
  experience,
  values,
  conditions
) => {

  if (!experience) {
    return;
  }

  switch (experience) {

    case "0-1":

      conditions.push(
        `jsp.experience_years >= 0
         AND jsp.experience_years <= 1`
      );

      break;


    case "1-3":

      conditions.push(
        `jsp.experience_years > 1
         AND jsp.experience_years <= 3`
      );

      break;


    case "3-5":

      conditions.push(
        `jsp.experience_years > 3
         AND jsp.experience_years <= 5`
      );

      break;


    case "5-10":

      conditions.push(
        `jsp.experience_years > 5
         AND jsp.experience_years <= 10`
      );

      break;


    case "10+":

      conditions.push(
        `jsp.experience_years > 10`
      );

      break;


    default:
      break;
  }
};


/* =========================================================
   GET ALL / SEARCH CANDIDATES
   =========================================================

   GET /api/candidates

   Optional query parameters:

   ?search=react
   ?location=Hyderabad
   ?experience=1-3
   ?work_mode=remote
   ?education=bachelor
   ?skills=React,Node.js

   ========================================================= */

router.get("/", async (req, res) => {

  try {

    const search =
      cleanQuery(req.query.search);

    const location =
      cleanQuery(req.query.location);

    const experience =
      cleanQuery(req.query.experience);

    const workMode =
      cleanQuery(req.query.work_mode);

    const education =
      cleanQuery(req.query.education);

    const skills =
      cleanQuery(req.query.skills);


    /* =====================================================
       CONDITIONS
       ===================================================== */

    const conditions = [];

    const values = [];


    /* -----------------------------------------------------
       ONLY JOB SEEKERS
    ----------------------------------------------------- */

    conditions.push(
      `LOWER(au.role::text) IN (
        'job_seeker',
        'jobseeker',
        'candidate'
      )`
    );


    /* -----------------------------------------------------
       EXCLUDE INACTIVE ACCOUNTS
    ----------------------------------------------------- */

    conditions.push(
      `(au.status IS NULL
        OR LOWER(au.status::text) NOT IN (
          'blocked',
          'deleted',
          'suspended'
        ))`
    );


    /* =====================================================
       GENERAL SEARCH
       ===================================================== */

    if (search) {

      values.push(
        `%${search}%`
      );

      const searchParam =
        `$${values.length}`;


      conditions.push(
        `(
          au.full_name ILIKE ${searchParam}

          OR au.email ILIKE ${searchParam}

          OR jsp.headline ILIKE ${searchParam}

          OR jsp.bio ILIKE ${searchParam}

          OR jsp.location ILIKE ${searchParam}

          OR jsp.current_job_title ILIKE ${searchParam}

          OR jsp.industry ILIKE ${searchParam}

          OR jsp.skills ILIKE ${searchParam}

          OR jsp.education ILIKE ${searchParam}
        )`
      );

    }


    /* =====================================================
       LOCATION
       ===================================================== */

    if (location) {

      values.push(
        `%${location}%`
      );

      conditions.push(
        `jsp.location ILIKE $${values.length}`
      );

    }


    /* =====================================================
       SKILLS
       ===================================================== */

    if (skills) {

      const skillList =
        skills
          .split(",")
          .map((skill) =>
            skill.trim()
          )
          .filter(Boolean);


      if (skillList.length > 0) {

        const skillConditions =
          skillList.map(
            (skill) => {

              values.push(
                `%${skill}%`
              );

              return `jsp.skills ILIKE $${values.length}`;

            }
          );


        /*
         * Candidate must match at least
         * one selected skill.
         */

        conditions.push(
          `(${skillConditions.join(" OR ")})`
        );

      }

    }


    /* =====================================================
       EDUCATION
       ===================================================== */

    if (education) {

      let educationSearch =
        education;


      const educationMap = {

        "10th": "10th",

        "12th": "12th",

        diploma: "diploma",

        bachelor: "bachelor",

        master: "master",

        phd: "phd",

      };


      if (
        educationMap[education]
      ) {

        educationSearch =
          educationMap[education];

      }


      values.push(
        `%${educationSearch}%`
      );


      conditions.push(
        `jsp.education ILIKE $${values.length}`
      );

    }


    /* =====================================================
       EXPERIENCE
       ===================================================== */

    addExperienceFilter(
      experience,
      values,
      conditions
    );


    /* =====================================================
       WORK MODE
       =====================================================

       Your current database does NOT have
       jsp.work_mode.

       Therefore we intentionally don't filter
       by work mode yet.

       ===================================================== */

    if (workMode) {

      // Intentionally ignored until
      // work_mode is added to the database.

    }


    /* =====================================================
       WHERE CLAUSE
       ===================================================== */

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join("\nAND ")}`
        : "";


    /* =====================================================
       DATABASE QUERY
       ===================================================== */

const query = `
  SELECT

    jsp.id AS profile_id,

    au.id AS user_id,

    au.full_name,
    au.email,
    au.phone,
    au.profile_image,

    jsp.headline,
    jsp.bio,
    jsp.location,
    jsp.experience_years,
    jsp.current_job_title,
    jsp.industry,
    jsp.skills,
    jsp.education,
    jsp.resume_url,
    jsp.linkedin_url,
    jsp.portfolio_url,
    jsp.github_url,

    jsp.created_at AS profile_created_at,
    jsp.updated_at AS profile_updated_at,

    au.created_at AS user_created_at

  FROM public.auth_users au

  LEFT JOIN public.job_seeker_profiles jsp
    ON au.id = jsp.user_id

  ${whereClause}

  ORDER BY
    COALESCE(jsp.updated_at, au.created_at) DESC NULLS LAST,
    COALESCE(jsp.created_at, au.created_at) DESC

  LIMIT 100
`;

    console.log(
      "GET /api/candidates",
      {
        search,
        location,
        experience,
        workMode,
        education,
        skills,
      }
    );


    const result =
      await pool.query(
        query,
        values
      );


    /* =====================================================
       FORMAT RESPONSE
       ===================================================== */

const candidates = result.rows.map((candidate) => ({
  id: candidate.user_id,
  user_id: candidate.user_id,

  profile_id: candidate.profile_id,

  name: candidate.full_name,
  full_name: candidate.full_name,

  email: candidate.email,
  phone: candidate.phone,

  profile_image: candidate.profile_image,

  headline: candidate.headline || "Job Seeker",

  bio: candidate.bio || "",

  location: candidate.location || "Location not specified",

  experience_years: candidate.experience_years,

  experience:
    candidate.experience_years !== null &&
    candidate.experience_years !== undefined
      ? candidate.experience_years
      : null,

  current_job_title: candidate.current_job_title,

  designation: candidate.current_job_title,

  industry: candidate.industry,

  skills: candidate.skills,

  education: candidate.education,

  resume_url: candidate.resume_url,

  linkedin_url: candidate.linkedin_url,

  portfolio_url: candidate.portfolio_url,

  github_url: candidate.github_url,

  created_at:
    candidate.profile_created_at ||
    candidate.user_created_at,

  updated_at:
    candidate.profile_updated_at ||
    candidate.user_created_at,
}));

    /* =====================================================
       RESPONSE
       ===================================================== */

    return res.status(200).json({

      success: true,

      count:
        candidates.length,

      candidates,

    });

  } catch (error) {

    console.error(
      "GET /api/candidates error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Unable to load candidates.",

      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,

    });

  }

});

/* =========================================================
   GET SINGLE CANDIDATE
   =========================================================

   GET /api/candidates/:id

   :id can be:
   1. auth_users.id
   OR
   2. job_seeker_profiles.id

   Works even when the JOB_SEEKER has
   not created a job_seeker_profiles row yet.
   ========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Candidate ID is required.",
      });
    }

    /* -----------------------------------------------------
       QUERY

       IMPORTANT:
       Start from auth_users and LEFT JOIN the profile.

       This allows approved JOB_SEEKER accounts that don't
       have a job_seeker_profiles row yet to still be viewed.
    ----------------------------------------------------- */

    const query = `
      SELECT

        au.id AS user_id,

        jsp.id AS profile_id,

        au.full_name,
        au.email,
        au.phone,
        au.profile_image,

        jsp.headline,
        jsp.bio,
        jsp.location,
        jsp.experience_years,
        jsp.current_job_title,
        jsp.industry,
        jsp.skills,
        jsp.education,
        jsp.resume_url,
        jsp.linkedin_url,
        jsp.portfolio_url,
        jsp.github_url,

        jsp.created_at AS profile_created_at,
        jsp.updated_at AS profile_updated_at,

        au.created_at AS user_created_at

      FROM public.auth_users au

      LEFT JOIN public.job_seeker_profiles jsp
        ON jsp.user_id = au.id

      WHERE
        (
          au.id::text = $1
          OR jsp.id::text = $1
        )

        AND LOWER(au.role::text) IN (
          'job_seeker',
          'jobseeker',
          'candidate'
        )

        AND (
          au.status IS NULL
          OR LOWER(au.status::text) NOT IN (
            'blocked',
            'deleted',
            'suspended'
          )
        )

      LIMIT 1
    `;

    console.log(
      "GET /api/candidates/:id",
      {
        candidateId: id,
      }
    );

    const result = await pool.query(
      query,
      [id]
    );

    /* -----------------------------------------------------
       NOT FOUND
    ----------------------------------------------------- */

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found.",
      });
    }

    const candidate = result.rows[0];

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(200).json({
      success: true,

      candidate: {
        /* Auth user ID is the primary candidate ID */
        id: candidate.user_id,

        user_id: candidate.user_id,

        /* Profile ID can be null */
        profile_id: candidate.profile_id,

        name:
          candidate.full_name ||
          "Candidate",

        full_name:
          candidate.full_name ||
          "Candidate",

        email:
          candidate.email ||
          "",

        phone:
          candidate.phone ||
          "",

        profile_image:
          candidate.profile_image ||
          null,

        headline:
          candidate.headline ||
          candidate.current_job_title ||
          "Job Seeker",

        bio:
          candidate.bio ||
          "",

        location:
          candidate.location ||
          "Location not specified",

        experience_years:
          candidate.experience_years,

        experience:
          candidate.experience_years,

        current_job_title:
          candidate.current_job_title ||
          null,

        designation:
          candidate.current_job_title ||
          null,

        industry:
          candidate.industry ||
          null,

        skills:
          candidate.skills ||
          null,

        education:
          candidate.education ||
          null,

        resume_url:
          candidate.resume_url ||
          null,

        linkedin_url:
          candidate.linkedin_url ||
          null,

        portfolio_url:
          candidate.portfolio_url ||
          null,

        github_url:
          candidate.github_url ||
          null,

        created_at:
          candidate.profile_created_at ||
          candidate.user_created_at,

        updated_at:
          candidate.profile_updated_at ||
          candidate.user_created_at,
      },
    });

  } catch (error) {

    console.error(
      "GET /api/candidates/:id error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load candidate.",

      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
});

/* =========================================================
   CONTACT CANDIDATE
   =========================================================

   POST /api/candidates/:id/contact

   Body:

   {
     "subject": "Career Opportunity",
     "message": "Hi, I came across your profile..."
   }

   ========================================================= */

router.post(
  "/:id/contact",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      /* ===================================================
         GET EMAIL DATA
      =================================================== */

      const subject =
        cleanQuery(
          req.body?.subject
        );

      const message =
        cleanQuery(
          req.body?.message
        );


      /* ===================================================
         VALIDATION
      =================================================== */

      if (!subject) {

        return res.status(400).json({

          success: false,

          message:
            "Email subject is required.",

        });

      }


      if (!message) {

        return res.status(400).json({

          success: false,

          message:
            "Email message is required.",

        });

      }


      /* ===================================================
         FIND CANDIDATE
      =================================================== */

      const candidateQuery = `

        SELECT

          jsp.id,

          jsp.user_id,

          au.full_name,

          au.email

        FROM public.job_seeker_profiles jsp

        INNER JOIN public.auth_users au

          ON au.id = jsp.user_id

        WHERE

          jsp.id::text = $1

          OR jsp.user_id::text = $1

        LIMIT 1

      `;


      const candidateResult =
        await pool.query(
          candidateQuery,
          [id]
        );


      /* ===================================================
         CANDIDATE NOT FOUND
      =================================================== */

      if (
        candidateResult.rows.length === 0
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Candidate not found.",

        });

      }


      const candidate =
        candidateResult.rows[0];


      /* ===================================================
         EMAIL CHECK
      =================================================== */

      if (!candidate.email) {

        return res.status(400).json({

          success: false,

          message:
            "This candidate does not have an email address.",

        });

      }


      /* ===================================================
         GET LOGGED-IN RECRUITER
      =================================================== */

      const recruiterUserId =
        req.user?.id ||
        req.user?.userId ||
        req.user?.user_id;


      let recruiterName =
        "Recruitment Team";


      let recruiterEmail =
        "";


      /* ===================================================
         GET RECRUITER DETAILS
      =================================================== */

      if (recruiterUserId) {

        const recruiterResult =
          await pool.query(
            `

              SELECT

                full_name,

                email

              FROM public.auth_users

              WHERE id = $1

              LIMIT 1

            `,
            [recruiterUserId]
          );


        if (
          recruiterResult.rows.length > 0
        ) {

          recruiterName =
            recruiterResult.rows[0]
              .full_name ||
            "Recruitment Team";


          recruiterEmail =
            recruiterResult.rows[0]
              .email ||
            "";

        }

      }


      /* ===================================================
         SEND EMAIL
      =================================================== */

      await sendCandidateContactEmail({

        email:
          candidate.email,

        candidateName:
          candidate.full_name,

        recruiterName,

        recruiterEmail,

        subject,

        message,

      });


      /* ===================================================
         LOG
      =================================================== */

      console.log(
        "✅ Candidate contact email sent",
        {
          candidateId:
            candidate.id,

          candidateName:
            candidate.full_name,

          candidateEmail:
            candidate.email,

          recruiterName,

          recruiterEmail,

          subject,
        }
      );


      /* ===================================================
         SUCCESS
      =================================================== */

      return res.status(200).json({

        success: true,

        message:
          "Email sent successfully.",

        candidate: {

          id:
            candidate.id,

          user_id:
            candidate.user_id,

          name:
            candidate.full_name,

          email:
            candidate.email,

        },

      });

    } catch (error) {

      console.error(
        "❌ POST /api/candidates/:id/contact error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Unable to send email to candidate.",

        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,

      });

    }

  }
);


/* =========================================================
   EXPORT
   ========================================================= */

export default router;