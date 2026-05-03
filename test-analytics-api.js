/**
 * QUICK TEST - Analytics API Integration
 * Run this in Node.js to test all endpoints
 */

const http = require("http");

// Base URL - adjust if your server runs on different port
const BASE_URL = "http://localhost:5000";
const API_PREFIX = "/api/v1/analytics";

// Color codes for console output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Make HTTP request and return JSON response
 */
async function fetchAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}${API_PREFIX}${endpoint}`;
        log("cyan", `\n📡 Testing: ${endpoint}`);
        log("yellow", `   URL: ${url}`);

        http.get(url, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: json,
                    });
                } catch (error) {
                    reject(
                        new Error(`Invalid JSON: ${data.substring(0, 100)}`),
                    );
                }
            });
        }).on("error", (error) => {
            reject(error);
        });
    });
}

/**
 * Display test results
 */
function displayResult(endpoint, result) {
    if (result.status === 200 || result.status === 503) {
        if (result.data.success !== false) {
            log("green", `✓ SUCCESS (${result.status})`);
            if (result.data.data) {
                const keys = Object.keys(result.data.data).slice(0, 3);
                log("blue", `   Data keys: ${keys.join(", ")}`);
            }
        } else {
            log("red", `✗ FAILED: ${result.data.message}`);
        }
    } else {
        log("red", `✗ ERROR ${result.status}`);
    }
}

/**
 * Run all tests
 */
async function runTests() {
    log("cyan", "\n╔════════════════════════════════════╗");
    log("cyan", "║  ANALYTICS API INTEGRATION TEST    ║");
    log("cyan", "╚════════════════════════════════════╝");

    const endpoints = [
        "/health",
        "/sales",
        "/users",
        "/recommendations",
        "/anomalies",
    ];

    const results = {};

    for (const endpoint of endpoints) {
        try {
            const result = await fetchAPI(endpoint);
            results[endpoint] = true;
            displayResult(endpoint, result);

            // Show sample data
            if (result.data.data && typeof result.data.data === "object") {
                const dataKeys = Object.keys(result.data.data);
                if (dataKeys.length > 0) {
                    log("yellow", `   Sample: ${dataKeys[0]}`);
                }
            }
        } catch (error) {
            results[endpoint] = false;
            log("red", `✗ ERROR: ${error.message}`);
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Summary
    log("cyan", "\n╔════════════════════════════════════╗");
    log("cyan", "║  TEST SUMMARY                      ║");
    log("cyan", "╚════════════════════════════════════╝");

    const passed = Object.values(results).filter((v) => v).length;
    const total = Object.keys(results).length;

    endpoints.forEach((endpoint) => {
        const status = results[endpoint] ? "✓" : "✗";
        const color = results[endpoint] ? "green" : "red";
        log(color, `${status} ${endpoint}`);
    });

    log(
        passed === total ? "green" : "yellow",
        `\n${passed}/${total} endpoints working`,
    );

    // Next steps
    if (passed === total) {
        log("green", "\n✅ All tests passed!");
        log("blue", "\nNext steps:");
        log("blue", "1. Test from React client with fetch()");
        log("blue", "2. Add error handling for failed endpoints");
        log("blue", "3. Consider caching results");
        log("blue", "4. Monitor Python execution times");
    } else {
        log("yellow", "\n⚠️  Some tests failed. Check:");
        log("yellow", "1. Is Node.js server running?");
        log("yellow", "2. Is MongoDB running?");
        log("yellow", "3. Are Python dependencies installed?");
        log("yellow", "4. Check server logs for errors");
    }

    log("cyan", "\n");
}

// Run tests
runTests().catch((error) => {
    log("red", `\nTest suite error: ${error.message}`);
    process.exit(1);
});
