/**
 * Analytics Controller
 * Handles requests for analytics data
 */

const analyticsService = require("../services/analyticsService");
let pythonAnalyticsService;
try {
    pythonAnalyticsService = require("../services/pythonAnalyticsService");
} catch (err) {
    // optional; python bridge may not be available in all environments
    pythonAnalyticsService = null;
}
const { ROLES } = require("../constants");

const resolveScopedQuery = (req) => {
    const scopedQuery = { ...req.query };
    if (req.user?.role === ROLES.Merchant) {
        scopedQuery.merchantId = req.user.merchant;
    }
    return scopedQuery;
};

/**
 * GET /api/v1/analytics/sales
 * Get sales analysis data
 */
exports.getSalesAnalytics = async (req, res) => {
    try {
        const usePython = req.query.source === 'python' || process.env.USE_PYTHON_ANALYTICS === 'true';
        const result = usePython && pythonAnalyticsService
            ? await pythonAnalyticsService.getSalesAnalysis(resolveScopedQuery(req))
            : await analyticsService.getSalesAnalysis(resolveScopedQuery(req));
        res.status(200).json(result);
    } catch (error) {
        console.error("Sales analytics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch sales analytics",
            error: process.env.NODE_ENV === "development" ? error : undefined,
        });
    }
};

/**
 * GET /api/v1/analytics/users
 * Get user behavior analysis
 */
exports.getUserBehaviorAnalytics = async (req, res) => {
    try {
        const usePython = req.query.source === 'python' || process.env.USE_PYTHON_ANALYTICS === 'true';
        const result = usePython && pythonAnalyticsService
            ? await pythonAnalyticsService.getUserBehaviorAnalysis(resolveScopedQuery(req))
            : await analyticsService.getUserBehaviorAnalysis(resolveScopedQuery(req));
        res.status(200).json(result);
    } catch (error) {
        console.error("User behavior analytics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user behavior analytics",
            error: process.env.NODE_ENV === "development" ? error : undefined,
        });
    }
};

/**
 * GET /api/v1/analytics/recommendations
 * Get product recommendations
 */
exports.getRecommendations = async (req, res) => {
    try {
        const scopedQuery = resolveScopedQuery(req);
        const { userId } = scopedQuery;
        const usePython = req.query.source === 'python' || process.env.USE_PYTHON_ANALYTICS === 'true';
        const result = usePython && pythonAnalyticsService
            ? await pythonAnalyticsService.getRecommendations(userId, scopedQuery)
            : await analyticsService.getRecommendations(userId, scopedQuery);
        res.status(200).json(result);
    } catch (error) {
        console.error("Recommendations error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch recommendations",
            error: process.env.NODE_ENV === "development" ? error : undefined,
        });
    }
};

/**
 * GET /api/v1/analytics/anomalies
 * Get anomaly detection results
 */
exports.getAnomalies = async (req, res) => {
    try {
        const usePython = req.query.source === 'python' || process.env.USE_PYTHON_ANALYTICS === 'true';
        const result = usePython && pythonAnalyticsService
            ? await pythonAnalyticsService.getAnomalyDetection(resolveScopedQuery(req))
            : await analyticsService.getAnomalyDetection(resolveScopedQuery(req));
        res.status(200).json(result);
    } catch (error) {
        console.error("Anomaly detection error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch anomalies",
            error: process.env.NODE_ENV === "development" ? error : undefined,
        });
    }
};

/**
 * GET /api/v1/analytics/health
 * Health check for analytics system
 */
exports.healthCheck = async (req, res) => {
    try {
        const result = await analyticsService.healthCheck();
        const statusCode = result.status === "healthy" ? 200 : 503;
        res.status(statusCode).json(result);
    } catch (error) {
        console.error("Health check error:", error);
        res.status(503).json({
            status: "unhealthy",
            error: error.message,
        });
    }
};
