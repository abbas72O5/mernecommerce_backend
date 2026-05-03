const Mongoose = require("mongoose");
const Order = require("../models/order");
const User = require("../models/user");

const toObjectId = (value) => {
    if (!value || !Mongoose.Types.ObjectId.isValid(value)) return null;
    return Mongoose.Types.ObjectId(value);
};

const getOrderFilter = async (query = {}) => {
    const merchantId = toObjectId(query.merchantId);
    if (!merchantId) return {};

    const matchingCartIds = await Mongoose.model("Cart")
        .aggregate([
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "products",
                    localField: "products.product",
                    foreignField: "_id",
                    as: "productDoc",
                },
            },
            { $unwind: "$productDoc" },
            {
                $lookup: {
                    from: "brands",
                    localField: "productDoc.brand",
                    foreignField: "_id",
                    as: "brandDoc",
                },
            },
            { $unwind: "$brandDoc" },
            { $match: { "brandDoc.merchant": merchantId } },
            { $group: { _id: "$_id" } },
        ])
        .exec();

    return { cart: { $in: matchingCartIds.map((entry) => entry._id) } };
};

const wrapResult = async (fn, fallbackMessage) => {
    try {
        const result = await fn();
        return { success: true, data: result };
    } catch (error) {
        return {
            success: false,
            message: error.message || fallbackMessage,
            error: error,
        };
    }
};

const getSalesAnalysis = (query = {}) =>
    wrapResult(async () => {
        const orderFilter = await getOrderFilter(query);
        const orders = await Order.find(orderFilter).populate({
            path: "cart",
            populate: {
                path: "products.product",
                populate: { path: "brand" },
            },
        });

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce(
            (sum, order) => sum + Number(order.total || 0),
            0,
        );

        const productSalesMap = new Map();
        for (const order of orders) {
            const cartProducts = (order.cart && order.cart.products) || [];
            for (const item of cartProducts) {
                const product = item.product;
                if (!product) continue;
                const key = String(product._id);
                const quantity = Number(item.quantity || 0);
                const revenue = Number(item.totalPrice || item.priceWithTax || 0);
                const current = productSalesMap.get(key) || {
                    name: product.name,
                    quantity_sold: 0,
                    total_revenue: 0,
                };
                current.quantity_sold += quantity;
                current.total_revenue += revenue;
                productSalesMap.set(key, current);
            }
        }

        const topProducts = Array.from(productSalesMap.values())
            .sort((a, b) => b.quantity_sold - a.quantity_sold)
            .slice(0, 10);

        const salesByStatus = [
            {
                status: "Completed",
                order_count: totalOrders,
                total_revenue: totalRevenue,
            },
        ];

        console.log("[Analytics][Sales]", {
            orderFilter,
            totalOrders,
            totalRevenue,
            topProductsCount: topProducts.length,
        });

        return {
            total_revenue: {
                total_revenue: Number(totalRevenue.toFixed(2)),
                total_orders: totalOrders,
            },
            top_products: topProducts,
            sales_by_status: salesByStatus,
        };
    }, "Sales analysis failed");

const getUserBehaviorAnalysis = (query = {}) =>
    wrapResult(async () => {
        const orderFilter = await getOrderFilter(query);
        const orders = await Order.find(orderFilter).select("user");
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });

        const orderCountByUser = new Map();
        for (const order of orders) {
            const key = String(order.user);
            orderCountByUser.set(key, (orderCountByUser.get(key) || 0) + 1);
        }
        const returningUsers = Array.from(orderCountByUser.values()).filter(
            (count) => count > 1,
        ).length;

        const conversionRate = totalUsers
            ? (orderCountByUser.size / totalUsers) * 100
            : 0;
        const retentionRate = totalUsers ? (returningUsers / totalUsers) * 100 : 0;

        console.log("[Analytics][Users]", {
            totalUsers,
            activeUsers,
            convertedUsers: orderCountByUser.size,
            returningUsers,
        });

        return {
            conversion_rate: {
                conversion_rate_percent: Number(conversionRate.toFixed(2)),
            },
            retention: {
                total_users: activeUsers,
                retention_rate_percent: Number(retentionRate.toFixed(2)),
            },
        };
    }, "User behavior analysis failed");

const getRecommendations = (userId, query = {}) =>
    wrapResult(async () => {
        const sales = await getSalesAnalysis(query);
        const trendingProducts = sales.success
            ? sales.data.top_products.map((product, index) => ({
                  ID: index + 1,
                  Name: product.name,
                  quantity_sold: product.quantity_sold,
              }))
            : [];

        console.log("[Analytics][Recommendations]", {
            userId,
            trendingProducts: trendingProducts.length,
        });

        return {
            trending_products: trendingProducts,
            category_based_recommendations: [],
            frequently_bought_together: [],
        };
    }, "Recommendations failed");

const getAnomalyDetection = (query = {}) =>
    wrapResult(async () => {
        const orderFilter = await getOrderFilter(query);
        const orders = await Order.find(orderFilter).select("total user createdAt");
        const averageOrderValue =
            orders.length > 0
                ? orders.reduce((sum, order) => sum + Number(order.total || 0), 0) /
                  orders.length
                : 0;

        const unusualOrders = orders
            .filter((order) => Number(order.total || 0) > averageOrderValue * 2)
            .map((order) => ({
                order_id: order._id,
                total: order.total,
                created_at: order.createdAt,
            }));

        console.log("[Analytics][Anomalies]", {
            totalOrders: orders.length,
            averageOrderValue: Number(averageOrderValue.toFixed(2)),
            unusualOrders: unusualOrders.length,
        });

        return {
            unusual_orders: unusualOrders,
            suspicious_activity: [],
            high_cancellation_users: [],
        };
    }, "Anomaly detection failed");

const healthCheck = async () => {
    try {
        await Mongoose.connection.db.admin().ping();
        return { status: "healthy", mongodb: "connected" };
    } catch (error) {
        return { status: "unhealthy", error: error.message };
    }
};

module.exports = {
    getSalesAnalysis,
    getUserBehaviorAnalysis,
    getRecommendations,
    getAnomalyDetection,
    healthCheck,
};
