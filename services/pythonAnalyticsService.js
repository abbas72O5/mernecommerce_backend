const { execFileSync } = require('child_process');
const path = require('path');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const SCRIPTS_DIR = path.resolve(__dirname, '..', 'analytics');

function runScript(scriptName, args = []) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  try {
    const stdout = execFileSync(PYTHON_BIN, [scriptPath, ...args], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    });
    try {
      return JSON.parse(stdout);
    } catch (parseErr) {
      return { success: false, error: 'Invalid JSON from python script', raw: stdout };
    }
  } catch (err) {
    return { success: false, error: err.message, details: err.stderr ? err.stderr.toString() : undefined };
  }
}

async function getSalesAnalysis(/* query */) {
  return runScript('sales_analysis.py');
}

async function getUserBehaviorAnalysis(/* query */) {
  return runScript('user_behavior.py');
}

async function getRecommendations(userId /*, query */) {
  const args = userId ? [String(userId)] : [];
  return runScript('recommendation.py', args);
}

async function getAnomalyDetection(/* query */) {
  return runScript('anomaly_detection.py');
}

async function healthCheck() {
  // Try running a lightweight script (recommendation) and check success
  const res = runScript('recommendation.py');
  if (res && res.success) return { status: 'healthy', python: 'available' };
  return { status: 'unhealthy', error: res && res.error };
}

module.exports = {
  getSalesAnalysis,
  getUserBehaviorAnalysis,
  getRecommendations,
  getAnomalyDetection,
  healthCheck,
};
