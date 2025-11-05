require("dotenv").config();

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const UserAuth = require("../model/user_auth_schema");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");

// --- OTP model (persistent, TTL=300s) ---
// You can move this into models/OtpModel.js and require it instead
const OtpSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, index: true },
        otp: { type: Number, required: true },
        purpose: { type: String, enum: ["signup", "reset"], required: true },
        // For signup, we store the user payload to create the user after verification
        userPayload: {
            type: Object,
            default: null,
        },
        createdAt: { type: Date, default: Date.now, index: true },
    },
    {
        timestamps: false,
    }
);

// TTL index: document will be removed 300 seconds (5 minutes) after createdAt
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

const OtpModel = mongoose.models.Otp || mongoose.model("Otp", OtpSchema);

// --- Mail transporter setup ---
// If you plan to use a transactional provider, replace this transporter creation block
// and use their official SDK for better reliability on Vercel (recommended).
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // optional timeouts
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
});

// Verify transporter once on startup
transporter.verify((err, success) => {
    if (err) {
        console.error("Transporter verification failed:", err);
    } else {
        console.log("Mail transporter ready");
    }
});

let OTP_LENGTH = 4; // 1000-9999
const OTP_EXPIRY_MINUTES = 5;

const JWT_SECRET = process.env.JWT_SECRET;

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -------------------- HELPERS --------------------
async function sendMail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: `"Samsara Adventures" <${process.env.EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
    return { ok: true, info };
  } catch (err) {
    console.error("Error sending email:", err);
    return { ok: false, error: err };
  }
}


// ------------------ GOOGLE AUTH ------------------
const googleAuth = async (req, res) => {
    try {
        const { token } = req.body;

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub, email } = payload;

        let user = await UserAuth.findOne({ email });

        if (!user) {
            const hashedPassword = await bcrypt.hash(sub, 10);
            user = await UserAuth.create({
                email,
                password: hashedPassword,
            });
        }

        const jwtToken = jwt.sign(
            { id: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            token: jwtToken,
            user,
        });
    } catch (err) {
        console.error("Google Auth Error:", err);
        return res.status(401).json({ message: "Invalid Google token" });
    }
};

// ------------------ SIGNUP ------------------
const signup = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: "Please provide email and password." });

        const existUser = await UserAuth.findOne({ email });
        if (existUser)
            return res.status(400).json({ message: "This email already exists!" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH - 1);

        await OtpModel.create({
            email,
            otp,
            purpose: "signup",
            userPayload: { email, password: hashedPassword },
        });

        const html = `
      <div style="font-family: Arial; padding: 20px; border-radius: 10px; background: #fff; box-shadow: 0 0 8px rgba(0,0,0,0.1)">
        <h2 style="text-align:center; color:#D8327D;">💞 Welcome to SparkMatch 💞</h2>
        <p>Use the OTP below to verify your email and start your journey!</p>
        <div style="text-align:center; font-size:28px; font-weight:bold; color:#783AD0;">${otp}</div>
        <p style="color:#888;">Valid for ${OTP_EXPIRY_MINUTES} minutes only.</p>
      </div>
    `;

        await sendMail({
            to: email,
            subject: "💌 Verify your email - SparkMatch",
            html,
            text: `Your OTP is ${otp}`,
        });

        return res.status(200).json({ message: "OTP sent to your email. Verify to continue." });
    } catch (err) {
        console.error("Signup Error:", err);
        return res.status(500).json({ message: "Signup failed. Try again." });
    }
};

// ------------------ VERIFY EMAIL ------------------
const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const record = await OtpModel.findOne({ email, otp: Number(otp), purpose: "signup" });
        if (!record) return res.status(400).json({ message: "Invalid or expired OTP." });

        const { userPayload } = record;
        if (!userPayload) return res.status(500).json({ message: "User data missing." });

        const userExist = await UserAuth.findOne({ email });
        if (userExist) return res.status(400).json({ message: "User already exists." });

        const newUser = await UserAuth.create(userPayload);
        await OtpModel.deleteOne({ _id: record._id });

        const token = jwt.sign(
            { id: newUser._id, email: newUser.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            message: "Account created successfully!",
            token,
            user: { id: newUser._id, email: newUser.email },
        });
    } catch (err) {
        console.error("Verify Email Error:", err);
        return res.status(500).json({ message: "Verification failed." });
    }
};

// ------------------ LOGIN ------------------
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await UserAuth.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found!" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: "Incorrect password!" });

        const token = jwt.sign(
            { id: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({ token, user });
    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ message: "Login failed." });
    }
};

// ------------------ CHANGE PASSWORD ------------------
const changePassword = async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;

        const user = await UserAuth.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found!" });

        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) return res.status(400).json({ message: "Old password is incorrect!" });

        const hashed = await bcrypt.hash(newPassword, 10);
        await UserAuth.findByIdAndUpdate(user._id, { password: hashed });

        return res.status(200).json({ message: "Password updated successfully!" });
    } catch (err) {
        console.error("Change Password Error:", err);
        return res.status(500).json({ message: "Unable to change password." });
    }
};

// ------------------ SEND OTP (RESET PASSWORD) ------------------
const sendOtpForResetPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserAuth.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found!" });

        const otp = crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH - 1);
        await OtpModel.deleteMany({ email, purpose: "reset" });
        await OtpModel.create({ email, otp, purpose: "reset" });

        const html = `
      <div style="font-family: Arial; padding: 20px; border-radius: 10px; background: #fff; box-shadow: 0 0 8px rgba(0,0,0,0.1)">
        <h2 style="color:#D8327D; text-align:center;">💫 Reset Your SparkMatch Password</h2>
        <p style="text-align:center;">Use this OTP to reset your password:</p>
        <div style="text-align:center; font-size:28px; font-weight:bold; color:#783AD0;">${otp}</div>
        <p style="color:#888; text-align:center;">Valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
      </div>
    `;

        await sendMail({
            to: email,
            subject: "🔐 Reset Password - SparkMatch",
            html,
            text: `Your OTP for password reset is ${otp}`,
        });

        return res.status(200).json({ message: "OTP sent for password reset." });
    } catch (err) {
        console.error("Send OTP Reset Error:", err);
        return res.status(500).json({ message: "Failed to send reset OTP." });
    }
};

// ------------------ VERIFY OTP (RESET PASSWORD) ------------------
const verifyEmailForResetPassword = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const record = await OtpModel.findOne({ email, otp: Number(otp), purpose: "reset" });

        if (!record) return res.status(400).json({ message: "Invalid or expired OTP." });

        await OtpModel.updateOne({ _id: record._id }, { purpose: "reset-verified" });

        return res.status(200).json({ message: "OTP verified successfully!" });
    } catch (err) {
        console.error("Verify OTP Reset Error:", err);
        return res.status(500).json({ message: "OTP verification failed." });
    }
};

// ------------------ RESET PASSWORD ------------------
const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        const otpRecord = await OtpModel.findOne({ email, purpose: "reset-verified" });
        if (!otpRecord)
            return res.status(400).json({ message: "OTP not verified or expired." });

        const hashed = await bcrypt.hash(newPassword, 10);
        await UserAuth.findOneAndUpdate({ email }, { password: hashed });

        await OtpModel.deleteOne({ _id: otpRecord._id });

        return res.status(200).json({ message: "Password reset successfully!" });
    } catch (err) {
        console.error("Reset Password Error:", err);
        return res.status(500).json({ message: "Failed to reset password." });
    }
};

// ------------------ RESET OTP (OPTIONAL - CLEAR) ------------------
const resetOtp = async (req, res) => {
    try {
        const { email } = req.body;
        await OtpModel.deleteMany({ email });
        return res.status(200).json({ message: "All OTPs cleared for this email." });
    } catch (err) {
        console.error("Reset OTP Error:", err);
        return res.status(500).json({ message: "Failed to reset OTPs." });
    }
};

module.exports = {
    signup,
    verifyEmail,
    login,
    changePassword,
    sendOtpForResetPassword,
    verifyEmailForResetPassword,
    resetPassword,
    resetOtp,
    googleAuth,
};