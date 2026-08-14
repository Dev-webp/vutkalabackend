import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Check Gmail connection when server starts
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ EMAIL CONFIGURATION ERROR:");
    console.error(error);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

export default transporter;