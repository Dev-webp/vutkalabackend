import express from "express";

import {
  submitHiringRequest,
} from "../controllers/hiringRequestController.js";

const router = express.Router();

router.post(
  "/",
  submitHiringRequest
);

export default router;