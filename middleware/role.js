exports.check = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user || !req.user.role) {
                return res.status(401).json({
                    message: "Unauthorized",
                });
            }

            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    message: "Access denied: insufficient permissions",
                });
            }

            next();
        } catch (error) {
            return res.status(500).json({
                message: "Server error in role middleware",
            });
        }
    };
};

exports.allowAdmin = (req, res, next) => {
    try {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }

        const { ROLES } = require("../constants");
        if (
            req.user.role !== ROLES.Admin &&
            req.user.role !== ROLES.SuperAdmin
        ) {
            return res.status(403).json({
                message: "Access denied: insufficient permissions",
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            message: "Server error in role middleware",
        });
    }
};

exports.allowSuperAdminOnly = (req, res, next) => {
    try {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }

        const { ROLES } = require("../constants");
        if (req.user.role !== ROLES.SuperAdmin) {
            return res.status(403).json({
                message: "Access denied: insufficient permissions",
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            message: "Server error in role middleware",
        });
    }
};
