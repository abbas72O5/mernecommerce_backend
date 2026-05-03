const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const auth = require("../../middleware/auth");

// Bring in Models & Helpers
const User = require("../../models/user");
const Merchant = require("../../models/merchant");
const mailchimp = require("../../services/mailchimp");
const mailgun = require("../../services/mailgun");
const postmark = require("../../services/postmark");
const keys = require("../../config/keys");
const { EMAIL_PROVIDER, JWT_COOKIE, ROLES } = require("../../constants");

const { secret, tokenLife } = keys.jwt;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_VERIFICATION_WINDOW_MS = 15 * 60 * 1000;

const hashValue = (value) =>
    crypto.createHash("sha256").update(String(value)).digest("hex");

const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const OTP_SENT_RESPONSE = {
    success: true,
    message: "If an account exists with this email, a verification code has been sent.",
};

const sendPasswordResetOtp = async (email) => {
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
        return OTP_SENT_RESPONSE;
    }

    const otpCode = createOtpCode();
    existingUser.resetPasswordOtpHash = hashValue(otpCode);
    existingUser.resetPasswordOtpExpires = Date.now() + OTP_EXPIRY_MS;
    existingUser.resetPasswordOtpAttempts = 0;
    existingUser.resetPasswordOtpVerifiedAt = undefined;
    await existingUser.save();

    try {
        await postmark.sendEmail({
            to: existingUser.email,
            subject: "Your Password Reset Verification Code",
            textBody: `Hi ${existingUser.firstName || "there"},

Use this code to reset your password: ${otpCode}

This code expires in 10 minutes.
If you did not request this, you can ignore this email.`,
            htmlBody: `<p>Hi <strong>${existingUser.firstName || "there"}</strong>,</p>
<p>Use this code to reset your password:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otpCode}</p>
<p>This code expires in 10 minutes.</p>
<p>If you did not request this, you can ignore this email.</p>`,
        });
    } catch (error) {
        existingUser.resetPasswordOtpHash = undefined;
        existingUser.resetPasswordOtpExpires = undefined;
        existingUser.resetPasswordOtpAttempts = 0;
        existingUser.resetPasswordOtpVerifiedAt = undefined;
        await existingUser.save();
        throw error;
    }

    return OTP_SENT_RESPONSE;
};

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email) {
            return res
                .status(400)
                .json({ error: "You must enter an email address." });
        }

        if (!password) {
            return res
                .status(400)
                .json({ error: "You must enter a password." });
        }

        // Validate email format
        if (!EMAIL_REGEX.test(email)) {
            return res
                .status(400)
                .json({ error: "Please enter a valid email address." });
        }

        let user = await User.findOne({ email });
        if (!user) {
            // Backward compatibility: some merchant records may exist without a user.
            const merchant = await Merchant.findOne({ email });
            if (!merchant) {
                return res
                    .status(400)
                    .send({ error: "No user found for this email address." });
            }

            const merchantPasswordMatch = await bcrypt.compare(
                password,
                merchant.password,
            );
            if (!merchantPasswordMatch) {
                return res.status(400).json({
                    success: false,
                    error: "Password Incorrect",
                });
            }

            if (merchant.isActive === false) {
                return res.status(403).json({
                    success: false,
                    error: "Your account has been disabled. Contact admin.",
                });
            }

            user = new User({
                email: merchant.email,
                firstName: merchant.name || "Merchant",
                lastName: "",
                password: merchant.password,
                merchant: merchant._id,
                role: ROLES.Merchant,
            });
            await user.save();
        }

        if (user && user.provider !== EMAIL_PROVIDER.Email) {
            return res.status(400).send({
                error: `That email address is already in use using ${user.provider} provider.`,
            });
        }

        if (user.role === ROLES.Merchant && user.merchant) {
            const merchant = await Merchant.findById(user.merchant);
            if (merchant && merchant.isActive === false) {
                return res.status(403).json({
                    success: false,
                    error: "Your account has been disabled. Contact admin.",
                });
            }
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                error: "Password Incorrect",
            });
        }

        const payload = {
            id: user.id,
            role: user.role,
        };

        const token = jwt.sign(payload, secret, { expiresIn: tokenLife });

        if (!token) {
            throw new Error();
        }

        res.status(200).json({
            success: true,
            token: `Bearer ${token}`,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.post("/register", async (req, res) => {
    try {
        const { email, firstName, lastName, password, isSubscribed } = req.body;

        if (!email) {
            return res
                .status(400)
                .json({ error: "You must enter an email address." });
        }

        // Validate email format
        if (!EMAIL_REGEX.test(email)) {
            return res
                .status(400)
                .json({ error: "Please enter a valid email address." });
        }

        if (!firstName || !lastName) {
            return res
                .status(400)
                .json({ error: "You must enter your full name." });
        }

        if (!password) {
            return res
                .status(400)
                .json({ error: "You must enter a password." });
        }

        // Validate password strength (minimum 6 characters)
        if (password.length < 6) {
            return res
                .status(400)
                .json({
                    error: "Password must be at least 6 characters long.",
                });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res
                .status(400)
                .json({ error: "That email address is already in use." });
        }

        let subscribed = false;
        if (isSubscribed) {
            const result = await mailchimp.subscribeToNewsletter(email);

            if (result.status === "subscribed") {
                subscribed = true;
            }
        }

        const user = new User({
            email,
            password,
            firstName,
            lastName,
        });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(user.password, salt);

        user.password = hash;
        const registeredUser = await user.save();

        const payload = {
            id: registeredUser.id,
            role: registeredUser.role,
        };

        await mailgun.sendEmail(
            registeredUser.email,
            "signup",
            null,
            registeredUser,
        );

        const token = jwt.sign(payload, secret, { expiresIn: tokenLife });

        res.status(200).json({
            success: true,
            subscribed,
            token: `Bearer ${token}`,
            user: {
                id: registeredUser.id,
                firstName: registeredUser.firstName,
                lastName: registeredUser.lastName,
                email: registeredUser.email,
                role: registeredUser.role,
            },
        });
    } catch (error) {
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.post("/forgot/send-code", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res
                .status(400)
                .json({ error: "You must enter an email address." });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res
                .status(400)
                .json({ error: "Please enter a valid email address." });
        }

        try {
            const response = await sendPasswordResetOtp(email);
            return res.status(200).json(response);
        } catch (emailError) {
            return res.status(500).json({
                error: "Failed to send verification code. Please try again later.",
            });
        }
    } catch (error) {
        console.error("[Auth] Forgot password error:", error.message);
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.post("/forgot", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "You must enter an email address." });
        }
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }
        const response = await sendPasswordResetOtp(email);
        return res.status(200).json(response);
    } catch (error) {
        return res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.post("/forgot/verify-code", async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }
        if (!code || !OTP_REGEX.test(String(code))) {
            return res.status(400).json({ error: "Please enter a valid 6-digit code." });
        }

        const user = await User.findOne({ email });
        if (
            !user ||
            !user.resetPasswordOtpHash ||
            !user.resetPasswordOtpExpires ||
            user.resetPasswordOtpExpires <= Date.now()
        ) {
            return res.status(400).json({ error: "Verification code is invalid or expired." });
        }

        if (user.resetPasswordOtpAttempts >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({
                error: "Too many invalid attempts. Please request a new verification code.",
            });
        }

        const inputCodeHash = hashValue(code);
        if (user.resetPasswordOtpHash !== inputCodeHash) {
            user.resetPasswordOtpAttempts += 1;
            await user.save();
            return res.status(400).json({ error: "Incorrect verification code." });
        }

        user.resetPasswordOtpVerifiedAt = Date.now();
        user.resetPasswordOtpAttempts = 0;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Code verified. You can now reset your password.",
        });
    } catch (error) {
        return res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.post("/forgot/reset-password", async (req, res) => {
    try {
        const { email, code, password, confirmPassword } = req.body;

        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }
        if (!code || !OTP_REGEX.test(String(code))) {
            return res.status(400).json({ error: "Please enter a valid 6-digit code." });
        }
        if (!password || password.length < 8) {
            return res
                .status(400)
                .json({ error: "Password must be at least 8 characters long." });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: "Passwords do not match." });
        }

        const user = await User.findOne({ email });
        if (
            !user ||
            !user.resetPasswordOtpHash ||
            !user.resetPasswordOtpExpires ||
            user.resetPasswordOtpExpires <= Date.now()
        ) {
            return res.status(400).json({ error: "Verification code is invalid or expired." });
        }

        if (
            !user.resetPasswordOtpVerifiedAt ||
            Date.now() - new Date(user.resetPasswordOtpVerifiedAt).getTime() >
                OTP_VERIFICATION_WINDOW_MS
        ) {
            return res.status(400).json({
                error: "Code verification expired. Please verify your code again.",
            });
        }

        if (user.resetPasswordOtpHash !== hashValue(code)) {
            return res.status(400).json({ error: "Incorrect verification code." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.resetPasswordOtpHash = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtpAttempts = 0;
        user.resetPasswordOtpVerifiedAt = undefined;
        await user.save();

        try {
            await postmark.sendPasswordResetSuccessEmail({
                email: user.email,
                userName: user.firstName || "User",
            });
        } catch (emailError) {
            console.error("[Auth] Confirmation email failed:", emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: "Password changed successfully. Please login with your new password.",
        });
    } catch (error) {
        return res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.post("/reset/:token", async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const { token } = req.params;

        // Validate inputs
        if (!password) {
            return res
                .status(400)
                .json({ error: "You must enter a password." });
        }

        if (password !== confirmPassword) {
            return res
                .status(400)
                .json({ error: "Passwords do not match." });
        }

        // Validate password strength (minimum 8 characters recommended)
        if (password.length < 8) {
            return res
                .status(400)
                .json({
                    error: "Password must be at least 8 characters long.",
                });
        }

        // Find user with valid reset token
        const resetUser = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }, // Token not expired
        });

        if (!resetUser) {
            return res.status(400).json({
                error: "Password reset token is invalid or has expired. Please request a new password reset.",
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Update password and clear reset token
        resetUser.password = hash;
        resetUser.resetPasswordToken = undefined;
        resetUser.resetPasswordExpires = undefined;

        await resetUser.save();

        try {
            // Send confirmation email using Postmark
            await postmark.sendPasswordResetSuccessEmail({
                email: resetUser.email,
                userName: resetUser.firstName || 'User',
            });

            console.log(`[Auth] Password reset confirmation email sent to ${resetUser.email}`);
        } catch (emailError) {
            console.error('[Auth] Confirmation email failed:', emailError.message);
            // Don't fail the reset if confirmation email fails
        }

        res.status(200).json({
            success: true,
            message: "Password changed successfully. Please login with your new password.",
        });
    } catch (error) {
        console.error('[Auth] Reset password error:', error.message);
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.post("/reset", auth, async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const email = req.user.email;

        if (!email) {
            return res.status(401).send("Unauthenticated");
        }

        if (!password) {
            return res
                .status(400)
                .json({ error: "You must enter a password." });
        }

        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res
                .status(400)
                .json({ error: "That email address is already in use." });
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);

        if (!isMatch) {
            return res
                .status(400)
                .json({ error: "Please enter your correct old password." });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(confirmPassword, salt);
        existingUser.password = hash;
        existingUser.save();

        await mailgun.sendEmail(existingUser.email, "reset-confirmation");

        res.status(200).json({
            success: true,
            message:
                "Password changed successfully. Please login with your new password.",
        });
    } catch (error) {
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

// Merchant Login
router.post("/merchant/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email) {
            return res
                .status(400)
                .json({ error: "You must enter an email address." });
        }

        if (!password) {
            return res
                .status(400)
                .json({ error: "You must enter a password." });
        }

        // Validate email format
        if (!EMAIL_REGEX.test(email)) {
            return res
                .status(400)
                .json({ error: "Please enter a valid email address." });
        }

        const merchant = await Merchant.findOne({ email });
        if (!merchant) {
            return res
                .status(400)
                .send({
                    error: "No merchant account found for this email address.",
                });
        }

        if (merchant.isActive === false) {
            return res.status(403).json({
                success: false,
                error: "Your account has been disabled. Contact admin.",
            });
        }

        const isMatch = await bcrypt.compare(password, merchant.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                error: "Password Incorrect",
            });
        }

        // Ensure merchant can access protected endpoints that rely on User-based JWT payload.
        let linkedUser = await User.findOne({ email: merchant.email });
        if (!linkedUser) {
            linkedUser = new User({
                email: merchant.email,
                firstName: merchant.name || "Merchant",
                lastName: "",
                password: merchant.password,
                merchant: merchant._id,
                role: ROLES.Merchant,
            });
            await linkedUser.save();
        }

        const payload = {
            id: linkedUser.id,
            role: linkedUser.role || ROLES.Merchant,
            merchantId: merchant.id,
            isMerchant: true,
        };

        const token = jwt.sign(payload, secret, { expiresIn: tokenLife });

        if (!token) {
            throw new Error();
        }

        res.status(200).json({
            success: true,
            token: `Bearer ${token}`,
            merchant: {
                id: merchant.id,
                name: merchant.name,
                email: merchant.email,
                brandName: merchant.brandName,
            },
        });
    } catch (error) {
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

// Verify reset token validity
router.get("/verify-reset-token/:token", async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: "Reset token is required.",
            });
        }

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: "Password reset token is invalid or has expired.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Token is valid.",
        });
    } catch (error) {
        console.error('[Auth] Token verification error:', error.message);
        res.status(400).json({
            success: false,
            error: "Your request could not be processed. Please try again.",
        });
    }
});

module.exports = router;
