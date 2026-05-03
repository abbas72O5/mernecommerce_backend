const Mongoose = require("mongoose");
const { ROLES, EMAIL_PROVIDER } = require("../constants");

const { Schema } = Mongoose;

// User Schema
const UserSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            sparse: true,
        },
        phoneNumber: {
            type: String,
        },
        firstName: {
            type: String,
        },
        lastName: {
            type: String,
        },
        password: {
            type: String,
            required: true,
        },
        merchant: {
            type: Schema.Types.ObjectId,
            ref: "Merchant",
            default: null,
        },
        provider: {
            type: String,
            required: true,
            default: EMAIL_PROVIDER.Email,
        },
        avatar: {
            type: String,
        },
        role: {
            type: String,
            default: ROLES.Member,
            enum: [
                ROLES.SuperAdmin,
                ROLES.Admin,
                ROLES.Moderator,
                ROLES.Merchant,
                ROLES.Member,
            ],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        resetPasswordToken: { type: String },
        resetPasswordExpires: { type: Date },
        resetPasswordOtpHash: { type: String },
        resetPasswordOtpExpires: { type: Date },
        resetPasswordOtpAttempts: { type: Number, default: 0 },
        resetPasswordOtpVerifiedAt: { type: Date },
    },
    {
        timestamps: true,
    },
);

module.exports = Mongoose.model("User", UserSchema);
