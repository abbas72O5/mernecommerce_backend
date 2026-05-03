const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserActivitySchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            index: true,
        },
        action: {
            type: String,
            enum: ["VIEW", "CLICK", "ADD_TO_CART", "WISHLIST", "PURCHASE"],
            required: true,
        },
        metadata: {
            type: Object,
            default: {},
        },
    },
    {
        timestamps: true,
    },
);

// Optional performance indexes (recommended)
UserActivitySchema.index({ user: 1, createdAt: -1 });
UserActivitySchema.index({ product: 1, action: 1 });

module.exports = mongoose.model("UserActivity", UserActivitySchema);
