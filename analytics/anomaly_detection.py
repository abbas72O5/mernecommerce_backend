"""
Anomaly Detection Module
Detects unusual patterns in orders and user behavior
"""

import os
from urllib.parse import urlparse
import pandas as pd
from pymongo import MongoClient
from datetime import datetime, timedelta
import statistics
import json


def get_mongo_uri():
    return os.environ.get("MONGO_URI", "mongodb://localhost:27017")


def get_mongo_db_name(default_name="ecommerce"):
    env_name = os.environ.get("MONGO_DB_NAME")
    if env_name:
        return env_name

    uri = os.environ.get("MONGO_URI", "")
    if uri:
        parsed = urlparse(uri)
        if parsed.path and parsed.path != "/":
            return parsed.path.lstrip("/")

    return default_name


class AnomalyDetector:
    def __init__(self, mongo_uri=None, db_name=None):
        """Initialize MongoDB connection"""
        self.mongo_uri = mongo_uri or get_mongo_uri()
        self.db_name = db_name or get_mongo_db_name()
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.orders = self.db.orders
        self.user_activity = self.db.userActivity

    def detect_unusual_order_amounts(self, std_dev_threshold=3):
        """Detect unusually large orders based on standard deviation"""
        try:
            pipeline = [
                {
                    "$match": {
                        "status": {"$in": ["delivered", "completed", "pending"]}
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "userId": 1,
                        "totalPrice": 1,
                        "orderDate": "$createdAt",
                        "itemCount": {"$size": "$products"}
                    }
                },
                {
                    "$sort": {"totalPrice": -1}
                }
            ]
            
            orders = list(self.orders.aggregate(pipeline))
            
            if len(orders) < 10:
                return pd.DataFrame()
            
            df = pd.DataFrame(orders)
            df["_id"] = df["_id"].astype(str)
            
            # Calculate mean and standard deviation
            mean_price = df["totalPrice"].mean()
            std_price = df["totalPrice"].std()
            
            # Find anomalies (orders beyond threshold)
            threshold = mean_price + (std_dev_threshold * std_price)
            anomalies = df[df["totalPrice"] > threshold].copy()
            
            if not anomalies.empty:
                anomalies = anomalies[[
                    "_id", "userId", "totalPrice", "orderDate", "itemCount"
                ]].sort_values("totalPrice", ascending=False)
                
                anomalies.columns = [
                    "Order ID", "User ID", "Order Amount", "Order Date", "Item Count"
                ]
                
                # Add statistics info
                anomalies["Status"] = "⚠️ UNUSUAL"
                
            return anomalies
        except Exception as e:
            print(f"Error detecting unusual order amounts: {e}")
            return pd.DataFrame()

    def detect_bulk_orders(self, item_threshold=20):
        """Detect orders with unusually large quantities"""
        try:
            pipeline = [
                {
                    "$project": {
                        "_id": 1,
                        "userId": 1,
                        "totalPrice": 1,
                        "createdAt": 1,
                        "totalQuantity": {"$sum": "$products.quantity"}
                    }
                },
                {
                    "$match": {
                        "totalQuantity": {"$gte": item_threshold}
                    }
                },
                {
                    "$sort": {"totalQuantity": -1}
                },
                {
                    "$limit": 50
                }
            ]
            
            results = list(self.orders.aggregate(pipeline))
            
            if results:
                df = pd.DataFrame(results)
                df = df[[
                    "_id", "userId", "totalQuantity", "totalPrice", "createdAt"
                ]]
                df.columns = [
                    "Order ID", "User ID", "Item Quantity", "Order Amount", "Order Date"
                ]
                df["Status"] = "📦 BULK ORDER"
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error detecting bulk orders: {e}")
            return pd.DataFrame()

    def detect_suspicious_user_activity(self, action_threshold=50, time_window_minutes=60):
        """Detect unusual user activity patterns (rapid clicks, spam behavior)"""
        try:
            # Get users with excessive activity in short time period
            pipeline = [
                {
                    "$group": {
                        "_id": "$userId",
                        "activityCount": {"$sum": 1},
                        "timeSpan": {
                            "$subtract": [
                                {"$max": "$createdAt"},
                                {"$min": "$createdAt"}
                            ]
                        }
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "activityCount": 1,
                        "minutesActive": {"$divide": ["$timeSpan", 60000]}
                    }
                },
                {
                    "$match": {
                        "activityCount": {"$gte": action_threshold}
                    }
                },
                {
                    "$sort": {"activityCount": -1}
                },
                {
                    "$limit": 50
                }
            ]
            
            results = list(self.user_activity.aggregate(pipeline))
            
            if results:
                df = pd.DataFrame(results)
                df = df[[
                    "_id", "activityCount", "minutesActive"
                ]]
                
                # Calculate activity rate
                df["Activity/Min"] = df.apply(
                    lambda row: round(row["activityCount"] / max(row["minutesActive"], 1), 2),
                    axis=1
                )
                
                df.columns = ["User ID", "Activity Count", "Time Span (Minutes)", "Activity Rate"]
                df["Status"] = "🚨 SUSPICIOUS"
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error detecting suspicious user activity: {e}")
            return pd.DataFrame()

    def detect_failed_payment_patterns(self):
        """Detect users with multiple failed orders"""
        try:
            pipeline = [
                {
                    "$match": {
                        "status": "cancelled"
                    }
                },
                {
                    "$group": {
                        "_id": "$userId",
                        "cancelledOrderCount": {"$sum": 1},
                        "totalValue": {"$sum": "$totalPrice"}
                    }
                },
                {
                    "$match": {
                        "cancelledOrderCount": {"$gte": 3}
                    }
                },
                {
                    "$sort": {"cancelledOrderCount": -1}
                },
                {
                    "$limit": 50
                }
            ]
            
            results = list(self.orders.aggregate(pipeline))
            
            if results:
                df = pd.DataFrame(results)
                df.columns = ["User ID", "Cancelled Orders", "Total Value"]
                df["Status"] = "⛔ HIGH CANCELLATION"
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error detecting failed payment patterns: {e}")
            return pd.DataFrame()

    def get_order_statistics(self):
        """Get order statistics for baseline comparison"""
        try:
            pipeline = [
                {
                    "$match": {
                        "status": {"$in": ["delivered", "completed", "pending"]}
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "avgOrderValue": {"$avg": "$totalPrice"},
                        "minOrderValue": {"$min": "$totalPrice"},
                        "maxOrderValue": {"$max": "$totalPrice"},
                        "medianOrderValue": {"$avg": "$totalPrice"},
                        "totalOrders": {"$sum": 1}
                    }
                }
            ]
            
            results = list(self.orders.aggregate(pipeline))
            
            if results:
                stats = results[0]
                return {
                    "avg_order_value": round(stats.get("avgOrderValue", 0), 2),
                    "min_order_value": round(stats.get("minOrderValue", 0), 2),
                    "max_order_value": round(stats.get("maxOrderValue", 0), 2),
                    "total_orders": stats.get("totalOrders", 0)
                }
            return {}
        except Exception as e:
            print(f"Error getting order statistics: {e}")
            return {}

    def generate_report(self):
        """Generate comprehensive anomaly detection report"""
        print("\n" + "="*60)
        print("ANOMALY DETECTION REPORT")
        print("="*60)
        
        # Order Statistics Baseline
        print("\n📊 ORDER STATISTICS (Baseline)")
        stats = self.get_order_statistics()
        if stats:
            print(f"  Average Order Value: ${stats.get('avg_order_value', 0):,.2f}")
            print(f"  Min Order Value: ${stats.get('min_order_value', 0):,.2f}")
            print(f"  Max Order Value: ${stats.get('max_order_value', 0):,.2f}")
            print(f"  Total Orders: {stats.get('total_orders', 0)}")
        
        # Unusual Order Amounts
        print("\n⚠️  UNUSUALLY LARGE ORDERS (>3 Standard Deviations)")
        unusual_orders = self.detect_unusual_order_amounts(3)
        if not unusual_orders.empty:
            print(f"  Found {len(unusual_orders)} unusual orders:")
            print(unusual_orders.to_string(index=False))
        else:
            print("  No unusual orders detected ✓")
        
        # Bulk Orders
        print("\n📦 BULK ORDERS (20+ Items)")
        bulk_orders = self.detect_bulk_orders(20)
        if not bulk_orders.empty:
            print(f"  Found {len(bulk_orders)} bulk orders:")
            print(bulk_orders.to_string(index=False))
        else:
            print("  No bulk orders detected")
        
        # Suspicious User Activity
        print("\n🚨 SUSPICIOUS USER ACTIVITY (50+ Actions)")
        suspicious_activity = self.detect_suspicious_user_activity(50)
        if not suspicious_activity.empty:
            print(f"  Found {len(suspicious_activity)} suspicious users:")
            print(suspicious_activity.to_string(index=False))
        else:
            print("  No suspicious activity detected ✓")
        
        # Failed Payments
        print("\n⛔ HIGH CANCELLATION USERS (3+ Cancelled Orders)")
        failed_payments = self.detect_failed_payment_patterns()
        if not failed_payments.empty:
            print(f"  Found {len(failed_payments)} users with high cancellations:")
            print(failed_payments.to_string(index=False))
        else:
            print("  No users with high cancellations ✓")
        
        print("\n" + "="*60)
        print("END OF ANOMALY REPORT")
        print("="*60)

    def get_json_report(self):
        """Generate anomaly detection report as JSON (for API integration)"""
        try:
            return {
                "success": True,
                "data": {
                    "order_statistics": self.get_order_statistics(),
                    "unusual_orders": self.detect_unusual_order_amounts(3).to_dict(orient="records") if not self.detect_unusual_order_amounts(3).empty else [],
                    "bulk_orders": self.detect_bulk_orders(20).to_dict(orient="records") if not self.detect_bulk_orders(20).empty else [],
                    "suspicious_activity": self.detect_suspicious_user_activity(50).to_dict(orient="records") if not self.detect_suspicious_user_activity(50).empty else [],
                    "high_cancellation_users": self.detect_failed_payment_patterns().to_dict(orient="records") if not self.detect_failed_payment_patterns().empty else []
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


if __name__ == "__main__":
    detector = AnomalyDetector()
    print(json.dumps(detector.get_json_report()))
