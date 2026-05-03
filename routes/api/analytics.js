/**
 * Analytics Routes
 * API endpoints for analytics data
 */

const express = require("express");
const router = express.Router();
const analyticsController = require("../../controllers/analyticsController");
const auth = require("../../middleware/auth");

/**
 * GET /api/v1/analytics/sales
 * Get sales analysis
 * - Total revenue
 * - Top selling products
 * - Daily sales summary
 */
router.get("/sales", auth, analyticsController.getSalesAnalytics);

/**
 * GET /api/v1/analytics/users
 * Get user behavior analysis
 * - Most viewed products
 * - Conversion rate
 * - User activity breakdown
 * - User retention
 */
router.get("/users", auth, analyticsController.getUserBehaviorAnalytics);

/**
 * GET /api/v1/analytics/recommendations
 * Get product recommendations
 * - Trending products
 * - Category-based recommendations
 * - Frequently bought together
 */
router.get("/recommendations", auth, analyticsController.getRecommendations);

/**
 * GET /api/v1/analytics/anomalies
 * Get anomaly detection results
 * - Unusual large orders
 * - Bulk orders
 * - Suspicious user activity
 * - High cancellation users
 */
router.get("/anomalies", auth, analyticsController.getAnomalies);

/**
 * GET /api/v1/analytics/health
 * Health check for analytics system
 */
router.get("/health", auth, analyticsController.healthCheck);

module.exports = router;
