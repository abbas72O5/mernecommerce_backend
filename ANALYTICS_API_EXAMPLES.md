/\*\*

- Example API Responses
- Reference for all analytics API endpoints
  \*/

// ============================================
// 1. GET /api/v1/analytics/sales
// ============================================

EXAMPLE RESPONSE:
{
"success": true,
"data": {
"total_revenue": {
"total_revenue": 15234.50,
"total_orders": 342
},
"top_products": [
{
"Product ID": "60d5ec49c1234567890abcde",
"Product Name": "Wireless Headphones",
"Quantity Sold": 145,
"Total Revenue": 7250.50,
"Order Count": 98
},
{
"Product ID": "60d5ec49c1234567890abcdf",
"Product Name": "USB-C Cable",
"Quantity Sold": 342,
"Total Revenue": 1710.00,
"Order Count": 285
}
],
"daily_sales": [
{
"Date": "2024-04-16",
"Daily Revenue": 1245.50,
"Order Count": 42,
"Avg Order Value": 29.65
},
{
"Date": "2024-04-17",
"Daily Revenue": 1890.75,
"Order Count": 58,
"Avg Order Value": 32.60
}
],
"sales_by_status": [
{
"Status": "delivered",
"Order Count": 298,
"Total Revenue": 14500.25
},
{
"Status": "pending",
"Order Count": 35,
"Total Revenue": 1250.50
}
]
}
}

// ============================================
// 2. GET /api/v1/analytics/users
// ============================================

EXAMPLE RESPONSE:
{
"success": true,
"data": {
"most_viewed_products": [
{
"Product ID": "60d5ec49c1234567890abcde",
"Product Name": "Wireless Headphones",
"View Count": 1245,
"Unique Viewers": 892
},
{
"Product ID": "60d5ec49c1234567890abcdf",
"Product Name": "USB-C Cable",
"View Count": 2156,
"Unique Viewers": 1456
}
],
"conversion_rate": {
"products_viewed": 2500,
"products_purchased": 342,
"conversion_rate_percent": 13.68
},
"activity_breakdown": [
{
"Action": "view",
"Total Count": 12456,
"Unique Users": 3250
},
{
"Action": "add_to_cart",
"Total Count": 1850,
"Unique Users": 1250
},
{
"Action": "purchase",
"Total Count": 342,
"Unique Users": 320
}
],
"top_users": [
{
"User ID": "60d5ec49c1234567890abcd1",
"Activity Count": 156
},
{
"User ID": "60d5ec49c1234567890abcd2",
"Activity Count": 142
}
],
"retention": {
"total_users": 4250,
"returning_users": 1856,
"retention_rate_percent": 43.67,
"period_days": 30
}
}
}

// ============================================
// 3. GET /api/v1/analytics/recommendations
// ============================================

EXAMPLE RESPONSE:
{
"success": true,
"data": {
"trending_products": [
{
"ID": "60d5ec49c1234567890abcde",
"Name": "Wireless Headphones",
"Price": "$89.99",
"Category": "Electronics",
"Stock": 45
},
{
"ID": "60d5ec49c1234567890abcdf",
"Name": "Phone Stand",
"Price": "$15.99",
"Category": "Accessories",
"Stock": 120
}
],
"most_viewed_products": [
{
"ID": "60d5ec49c1234567890abce0",
"Name": "Laptop Bag",
"Price": "$49.99",
"Category": "Bags",
"Stock": 78
}
]
}
}

// ============================================
// 4. GET /api/v1/analytics/anomalies
// ============================================

EXAMPLE RESPONSE:
{
"success": true,
"data": {
"order_statistics": {
"avg_order_value": 45.25,
"min_order_value": 5.99,
"max_order_value": 2450.00,
"total_orders": 342
},
"unusual_orders": [
{
"Order ID": "60d5ec49c1234567890abcde",
"User ID": "60d5ec49c1234567890abcd1",
"Order Amount": 2450.00,
"Order Date": "2024-04-20T10:30:00Z",
"Item Count": 45,
"Status": "⚠️ UNUSUAL"
}
],
"bulk_orders": [
{
"Order ID": "60d5ec49c1234567890abcdf",
"User ID": "60d5ec49c1234567890abcd2",
"Item Quantity": 25,
"Order Amount": 850.50,
"Order Date": "2024-04-20T14:15:00Z",
"Status": "📦 BULK ORDER"
}
],
"suspicious_activity": [
{
"User ID": "60d5ec49c1234567890abcd3",
"Activity Count": 256,
"Time Span (Minutes)": 45,
"Activity Rate": 5.69,
"Status": "🚨 SUSPICIOUS"
}
],
"high_cancellation_users": [
{
"User ID": "60d5ec49c1234567890abcd4",
"Cancelled Orders": 5,
"Total Value": 450.00,
"Status": "⛔ HIGH CANCELLATION"
}
]
}
}

// ============================================
// 5. GET /api/v1/analytics/health
// ============================================

EXAMPLE RESPONSE - SUCCESS:
{
"status": "healthy",
"mongodb": "connected"
}

EXAMPLE RESPONSE - ERROR:
{
"status": "unhealthy",
"error": "Failed to connect to MongoDB"
}

// ============================================
// Error Response (All Endpoints)
// ============================================

{
"success": false,
"message": "Failed to fetch sales analytics",
"error": "connection refused" // Only shown in development
}
