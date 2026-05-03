const mongoose = require("mongoose");
const { Schema } = mongoose;

const SalesReportSchema = new Schema(
    {
        date: {
            type: Date,
            unique: true,
            index: true,
        },
        totalOrders: {
            type: Number,
            default: 0,
        },
        totalRevenue: {
            type: Number,
            default: 0,
        },
        totalProductsSold: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model("SalesReport", SalesReportSchema);
