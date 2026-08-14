import express from "express";
import multer from "multer";

import {
  submitCandidateInterest,
} from "../controllers/candidateInterestController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post(
  "/",
  upload.single("resume"),
  submitCandidateInterest
);

export default router;