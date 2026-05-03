const mongoose = require("mongoose");
const { Schema } = mongoose;

const ProductInsightsSchema = new Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            unique: true,
            index: true,
        },
        views: {
            type: Number,
            default: 0,
        },
        clicks: {
            type: Number,
            default: 0,
        },
        purchases: {
            type: Number,
            default: 0,
        },
        revenue: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model("ProductInsights", ProductInsightsSchema);
