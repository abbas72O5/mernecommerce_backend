const mongoose = require("mongoose");
const { Schema } = mongoose;

const AuditLogSchema = new Schema(
    {
        admin: {
            type: Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
        action: {
            type: String,
            required: true,
        },
        targetModel: String,
        targetId: Schema.Types.ObjectId,
        description: String,
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
