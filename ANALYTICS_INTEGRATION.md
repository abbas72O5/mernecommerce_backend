# Analytics API Integration Guide

Complete guide to using the Node.js Analytics API with Python scripts.

## Setup

### 1. Ensure Python is Installed

```bash
python --version  # Should be 3.6+
```

### 2. Install Python Dependencies

```bash
cd analytics
pip install -r requirements.txt
```

### 3. Verify MongoDB Connection

Ensure your MongoDB instance is running at the connection URI (default: `mongodb://localhost:27017`).

To test:

```bash
cd analytics
python sales_analysis.py
```

You should see JSON output.

### 4. No Changes Needed to Node.js

The integration is already set up! The Python scripts have been modified to output JSON automatically.

---

## API Endpoints

All endpoints are prefixed with `/api/v1/analytics/`

### 1. Sales Analysis

```
GET /api/v1/analytics/sales
```

**Returns:**

- Total revenue and order count
- Top 10 selling products with quantities and revenue
- Daily sales for last 7 days
- Orders breakdown by status

**Example Request (cURL):**

```bash
curl http://localhost:5000/api/v1/analytics/sales
```

**Example Request (JavaScript):**

```javascript
fetch("/api/v1/analytics/sales")
    .then((res) => res.json())
    .then((data) => console.log(data.data.total_revenue));
```

---

### 2. User Behavior Analysis

```
GET /api/v1/analytics/users
```

**Returns:**

- Top 15 most viewed products
- Conversion rate (views → purchases)
- User activity breakdown by action type
- Top 10 most active users
- 30-day user retention rate

**Example Request:**

```bash
curl http://localhost:5000/api/v1/analytics/users
```

---

### 3. Product Recommendations

```
GET /api/v1/analytics/recommendations
```

**Query Parameters:**

- `userId` (optional) - For personalized recommendations

**Returns:**

- Trending products (last 7 days)
- Most viewed products globally

**Example Requests:**

```bash
# Global recommendations
curl http://localhost:5000/api/v1/analytics/recommendations

# Personalized recommendations
curl "http://localhost:5000/api/v1/analytics/recommendations?userId=60d5ec49c1234567890abcd1"
```

---

### 4. Anomaly Detection

```
GET /api/v1/analytics/anomalies
```

**Returns:**

- Order statistics baseline
- Unusually large orders (3+ standard deviations)
- Bulk orders (20+ items)
- Suspicious user activity (50+ actions in short time)
- Users with high order cancellations

**Example Request:**

```bash
curl http://localhost:5000/api/v1/analytics/anomalies
```

---

### 5. Health Check

```
GET /api/v1/analytics/health
```

**Returns:**

- System status (healthy/unhealthy)
- MongoDB connection status

**Example Request:**

```bash
curl http://localhost:5000/api/v1/analytics/health
```

---

## Architecture

### Request Flow

```
Express Route
    ↓
Controller (analyticsController.js)
    ↓
Service (analyticsService.js)
    ↓
spawn Python Process
    ↓
Python Script
    ↓
MongoDB (direct connection)
    ↓
Python outputs JSON
    ↓
Node.js parses JSON
    ↓
Returns to Client
```

### File Structure

```
server/
├── services/
│   └── analyticsService.js      # Handles Python execution
├── controllers/
│   └── analyticsController.js   # Request handlers
├── routes/api/
│   └── analytics.js             # API routes
└── routes/api/index.js          # Register analytics routes

analytics/                        # Python scripts (outside server)
├── sales_analysis.py            # Outputs JSON
├── user_behavior.py             # Outputs JSON
├── recommendation.py            # Outputs JSON
├── anomaly_detection.py         # Outputs JSON
└── requirements.txt
```

---

## How It Works

### 1. Python Script Execution

When a request comes to `/api/v1/analytics/sales`:

```javascript
// analyticsService.js spawns Python process
const pythonProcess = spawn("python", ["path/to/sales_analysis.py"]);

// Python script runs directly against MongoDB
// No JSON data is passed to Python

// Python outputs JSON to stdout
// Node.js captures and parses it
```

### 2. No JSON Passing

- **Before:** JSON data → Node.js → Python → Analysis
- **Now:** Node.js → Python → MongoDB → Analysis → JSON → Node.js

This is more efficient because:

- Python connects directly to MongoDB (faster)
- Reduces data transfer between Node.js and Python
- Python handles MongoDB operations more efficiently

---

## Testing

### Test Individual Python Scripts

```bash
cd analytics

# Test sales analysis
python sales_analysis.py | python -m json.tool

# Test user behavior
python user_behavior.py | python -m json.tool

# Test recommendations
python recommendation.py | python -m json.tool

# Test anomalies
python anomaly_detection.py | python -m json.tool
```

### Test via API

```javascript
// In your React client
useEffect(() => {
    // Fetch sales data
    fetch("/api/v1/analytics/sales")
        .then((res) => res.json())
        .then((data) => {
            if (data.success) {
                console.log("Revenue:", data.data.total_revenue.total_revenue);
                console.log("Top Products:", data.data.top_products);
            }
        });
}, []);
```

### Monitor Python Execution

Add debug logging in `analyticsService.js`:

```javascript
pythonProcess.stdout.on("data", (data) => {
    console.log(`[Python Output] ${data}`); // Debug logging
    outputData += data.toString();
});

pythonProcess.stderr.on("data", (data) => {
    console.error(`[Python Error] ${data}`); // Error logging
    errorData += data.toString();
});
```

---

## Performance Considerations

### Timeout Configuration

Default timeout: 60 seconds. Adjust if needed:

```javascript
// In analyticsService.js
const pythonProcess = spawn("python", [scriptPath], {
    timeout: 120000, // 120 seconds
});
```

### Database Performance

For large datasets, add MongoDB indexes on frequently queried fields:

```javascript
// In server/utils/db.js or your seed script
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ createdAt: 1 });
db.userActivity.createIndex({ action: 1 });
db.userActivity.createIndex({ userId: 1 });
```

### Caching Results

For frequently accessed data, consider caching:

```javascript
// Simple in-memory cache
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedAnalytics = async (key, fetcher) => {
    if (cache[key] && Date.now() - cache[key].time < CACHE_DURATION) {
        return cache[key].data;
    }
    const data = await fetcher();
    cache[key] = { data, time: Date.now() };
    return data;
};
```

---

## Troubleshooting

### Python Script Not Found

**Error:** `ENOENT: no such file or directory`

**Solution:** Verify analytics folder path in `analyticsService.js`

```javascript
const getAnalyticsPath = (scriptName) => {
    // Adjust path if analytics folder is in different location
    return path.join(__dirname, "../../analytics", scriptName);
};
```

### MongoDB Connection Failed

**Error:** `connection refused`

**Solution:** Ensure MongoDB is running and URI is correct

```bash
# Start MongoDB
mongod

# Or use Docker
docker run -d -p 27017:27017 mongo
```

### Python Not Found

**Error:** `spawn ENOENT: no such file or directory`

**Solution:** Ensure Python is in PATH

```bash
# Check if Python is available
python --version
which python  # Unix/Mac
where python  # Windows
```

### JSON Parse Error

**Error:** `JSON parse error`

**Solution:** Check Python script output

```bash
# Run Python script manually
python analytics/sales_analysis.py

# Should output valid JSON starting with {
```

---

## Advanced Usage

### Custom MongoDB URI

Override MongoDB connection per request:

```javascript
// Modify analyticsService.js to accept options
const getSalesAnalysis = async (mongoUri = "mongodb://localhost:27017") => {
    const scriptPath = getAnalyticsPath("sales_analysis.py");
    // Pass URI to Python via environment variable or command-line arg
    const pythonProcess = spawn("python", [scriptPath], {
        env: { ...process.env, MONGO_URI: mongoUri },
    });
    // ...
};
```

Then in Python:

```python
import os
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
analyzer = SalesAnalyzer(mongo_uri=mongo_uri)
```

### Scheduled Analytics

Run analytics on a schedule:

```javascript
// In server/index.js
const cron = require("node-cron");

// Run sales analysis every hour
cron.schedule("0 * * * *", async () => {
    const result = await analyticsService.getSalesAnalysis();
    // Store result in database or cache
});
```

---

## Next Steps

1. **Dashboard Integration** - Display analytics in React dashboard
2. **Export to CSV** - Add endpoint to export data as CSV
3. **Real-time Updates** - Use WebSockets for live analytics
4. **Caching Layer** - Add Redis for performance
5. **Monitoring** - Track Python script execution times
6. **Error Alerts** - Email alerts for anomalies detected

---

## Support

For issues:

1. Check `ANALYTICS_API_EXAMPLES.md` for response formats
2. Run Python scripts manually to test
3. Check Node.js console for error messages
4. Verify MongoDB connection and data
5. Check analytics folder file paths
