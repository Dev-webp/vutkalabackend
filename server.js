import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import authRoutes from "./src/routes/auth.js";
import adminRoutes from "./src/routes/admin.js";
import jobRoutes from "./src/routes/jobs.js";
import organizationRoutes from "./src/routes/organizationRoutes.js";
import applicationRoutes from "./src/routes/applicationRoutes.js";
import savedJobRoutes from "./src/routes/savedJobRoutes.js";
import jobSeekerProfileRoutes from "./src/routes/jobSeekerProfileRoutes.js";
import candidateInterestRoutes from "./src/routes/candidateInterestRoutes.js";
import hiringRequestRoutes from "./src/routes/hiringRequestRoutes.js";
import contactRoutes from "./src/routes/contactRoutes.js";


dotenv.config();

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());


app.use(
  "/uploads",
  express.static(
    path.resolve("uploads")
  )
);
// =====================================================
// ROUTES
// =====================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/jobs",
  jobRoutes
);

app.use(
  "/api/organizations",
  organizationRoutes
);

app.use(
  "/api/applications",
  applicationRoutes
);

app.use(
  "/api/saved-jobs",
  savedJobRoutes
);

app.use(
  "/api/job-seeker/profile",
  jobSeekerProfileRoutes
);

app.use(
  "/api/hiring-requests",
  hiringRequestRoutes
);
app.use(
  "/api/contact",
  contactRoutes
);
// =====================================================
// CANDIDATE INTEREST / FIND OPPORTUNITIES
// =====================================================

app.use(
  "/api/candidate-interests",
  candidateInterestRoutes
);

// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "VUTKAL Global API is running",
  });
});

// =====================================================
// SERVER
// =====================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server Running on port http://localhost:${PORT}`
  );
});