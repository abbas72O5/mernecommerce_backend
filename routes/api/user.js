const express = require("express");
const router = express.Router();

// Bring in Models & Helpers
const User = require("../../models/user");
const auth = require("../../middleware/auth");
const role = require("../../middleware/role");
const { ROLES } = require("../../constants");

// search users api
router.get(
    "/search",
    auth,
    role.check(ROLES.SuperAdmin, ROLES.Admin),
    async (req, res) => {
        try {
            const { search } = req.query;

            const regex = new RegExp(search, "i");

            const users = await User.find(
                {
                    $or: [
                        { firstName: { $regex: regex } },
                        { lastName: { $regex: regex } },
                        { email: { $regex: regex } },
                    ],
                },
                { password: 0, _id: 0 },
            ).populate("merchant", "name");

            res.status(200).json({
                users,
            });
        } catch (error) {
            res.status(400).json({
                error: "Your request could not be processed. Please try again.",
            });
        }
    },
);

// fetch users api
router.get("/", auth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const users = await User.find({}, { password: 0, _id: 0, googleId: 0 })
            .sort("-created")
            .populate("merchant", "name")
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.countDocuments();

        res.status(200).json({
            users,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            count,
        });
    } catch (error) {
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.get("/me", auth, async (req, res) => {
    try {
        const user = req.user._id;
        const userDoc = await User.findById(user, { password: 0 }).populate({
            path: "merchant",
            model: "Merchant",
            populate: {
                path: "brand",
                model: "Brand",
            },
        });

        res.status(200).json({
            user: userDoc,
        });
    } catch (error) {
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

router.put("/", auth, async (req, res) => {
    try {
        const user = req.user._id;

        const update = { ...req.body.profile };

        // Prevent role tampering
        delete update.role;

        // Allow only super admin to change roles
        if (req.user.role === ROLES.SuperAdmin && req.body.profile.role) {
            update.role = req.body.profile.role;
        }

        const query = { _id: user };

        const userDoc = await User.findOneAndUpdate(query, update, {
            new: true,
        });

        res.status(200).json({
            success: true,
            message: "Your profile is successfully updated!",
            user: userDoc,
        });
    } catch (error) {
        res.status(400).json({
            error: "Your request could not be processed. Please try again.",
        });
    }
});

// Block user (only SuperAdmin can block Admins)
router.patch(
    "/admin/block/:id",
    auth,
    role.allowSuperAdminOnly,
    async (req, res) => {
        try {
            const { id } = req.params;

            if (id === req.user._id.toString()) {
                return res.status(400).json({
                    error: "You cannot block yourself.",
                });
            }

            const userToBlock = await User.findById(id);

            if (!userToBlock) {
                return res.status(404).json({
                    error: "User not found.",
                });
            }

            if (userToBlock.role !== ROLES.Admin) {
                return res.status(403).json({
                    error: "You can only block Admin users.",
                });
            }

            if (!userToBlock.isActive) {
                return res.status(400).json({
                    error: "User is already blocked.",
                });
            }

            userToBlock.isActive = false;
            await userToBlock.save();

            res.status(200).json({
                success: true,
                message: "User has been blocked successfully.",
            });
        } catch (error) {
            res.status(400).json({
                error: "Your request could not be processed. Please try again.",
            });
        }
    },
);

// Unblock user (only SuperAdmin can unblock Admins)
router.patch(
    "/admin/unblock/:id",
    auth,
    role.allowSuperAdminOnly,
    async (req, res) => {
        try {
            const { id } = req.params;

            const userToUnblock = await User.findById(id);

            if (!userToUnblock) {
                return res.status(404).json({
                    error: "User not found.",
                });
            }

            if (userToUnblock.role !== ROLES.Admin) {
                return res.status(403).json({
                    error: "You can only unblock Admin users.",
                });
            }

            if (userToUnblock.isActive) {
                return res.status(400).json({
                    error: "User is already active.",
                });
            }

            userToUnblock.isActive = true;
            await userToUnblock.save();

            res.status(200).json({
                success: true,
                message: "User has been unblocked successfully.",
            });
        } catch (error) {
            res.status(400).json({
                error: "Your request could not be processed. Please try again.",
            });
        }
    },
);

module.exports = router;
