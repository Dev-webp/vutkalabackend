import express from "express";
import bcrypt from "bcrypt";
import pool from "../config/database.js";

const router = express.Router();

router.post("/register", async (req, res) => {

    try {

        const {
            fullName,
            email,
            phone,
            password,
            confirmPassword,
            role
        } = req.body;
await pool.query(
    `
    INSERT INTO auth_users
    (
        full_name,
        email,
        phone,
        password_hash,
        role
    )
    VALUES ($1, $2, $3, $4, $5)
    `,
    [
        fullName,
        email,
        phone,
        hashedPassword,
        role
    ]
);

res.status(201).json({
    success: true,
    message: "Account created successfully."
});
    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

export default router;