const Mongoose = require("mongoose");
const { Schema } = Mongoose;

// Wishlist Schema
const WishlistSchema = new Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
        isLiked: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    },
);

// Optional useful index (prevents duplicate likes)
WishlistSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = Mongoose.model("Wishlist", WishlistSchema);
