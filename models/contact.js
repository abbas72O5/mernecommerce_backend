const Mongoose = require("mongoose");
const { Schema } = Mongoose;

// Contact Schema
const ContactSchema = new Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
        },
        message: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    },
);

module.exports = Mongoose.model("Contact", ContactSchema);
