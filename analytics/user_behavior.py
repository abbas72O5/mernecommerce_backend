"""
User Behavior Analysis Module
Analyzes user activity and conversion metrics from MongoDB
"""

import os
from urllib.parse import urlparse
import pandas as pd
from pymongo import MongoClient
from datetime import datetime, timedelta
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


class UserBehaviorAnalyzer:
    def __init__(self, mongo_uri=None, db_name=None):
        """Initialize MongoDB connection"""
        self.mongo_uri = mongo_uri or get_mongo_uri()
        self.db_name = db_name or get_mongo_db_name()
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.user_activity = self.db.userActivity
        self.orders = self.db.orders

    def get_most_viewed_products(self, limit=15):
        """Get most viewed products by view count"""
        try:
            pipeline = [
                {
                    "$group": {
                        "_id": "$productId",
                        "productName": {"$first": "$productName"},
                        "viewCount": {"$sum": 1},
                        "uniqueUsers": {"$addToSet": "$userId"}
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "productName": 1,
                        "viewCount": 1,
                        "uniqueUsers": {"$size": "$uniqueUsers"}
                    }
                },
                {
                    "$sort": {"viewCount": -1}
                },
                {
                    "$limit": limit
                }
            ]
            
            results = list(self.user_activity.aggregate(pipeline))
            df = pd.DataFrame(results)
            
            if not df.empty:
                df = df.rename(columns={"_id": "product_id", "uniqueUsers": "unique_viewers"})
                df.columns = ["Product ID", "Product Name", "View Count", "Unique Viewers"]
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error getting most viewed products: {e}")
            return pd.DataFrame()

    def get_conversion_rate(self):
        """Calculate conversion rate (views -> purchases)"""
        try:
            # Get unique products viewed
            viewed_products = self.user_activity.aggregate([
                {"$match": {"action": "view"}},
                {"$group": {"_id": "$productId"}},
                {"$count": "total"}
            ])
            viewed_count = list(viewed_products)
            viewed_count = viewed_count[0]["total"] if viewed_count else 0
            
            # Get unique products purchased
            purchased_products = self.orders.aggregate([
                {"$unwind": "$products"},
                {"$group": {"_id": "$products.productId"}},
                {"$count": "total"}
            ])
            purchased_count = list(purchased_products)
            purchased_count = purchased_count[0]["total"] if purchased_count else 0
            
            # Calculate conversion rate
            if viewed_count > 0:
                conversion_rate = (purchased_count / viewed_count) * 100
            else:
                conversion_rate = 0
            
            return {
                "products_viewed": viewed_count,
                "products_purchased": purchased_count,
                "conversion_rate_percent": round(conversion_rate, 2)
            }
        except Exception as e:
            print(f"Error calculating conversion rate: {e}")
            return {}

    def get_user_activity_summary(self):
        """Get summary of different user activities"""
        try:
            pipeline = [
                {
                    "$group": {
                        "_id": "$action",
                        "count": {"$sum": 1},
                        "uniqueUsers": {"$addToSet": "$userId"}
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "count": 1,
                        "uniqueUsers": {"$size": "$uniqueUsers"}
                    }
                },
                {
                    "$sort": {"count": -1}
                }
            ]
            
            results = list(self.user_activity.aggregate(pipeline))
            df = pd.DataFrame(results)
            
            if not df.empty:
                df = df.rename(columns={"_id": "action", "uniqueUsers": "unique_users"})
                df.columns = ["Action", "Total Count", "Unique Users"]
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error getting user activity summary: {e}")
            return pd.DataFrame()

    def get_top_users_by_activity(self, limit=10):
        """Get top users by activity count"""
        try:
            pipeline = [
                {
                    "$group": {
                        "_id": "$userId",
                        "activityCount": {"$sum": 1},
                        "actions": {"$push": "$action"}
                    }
                },
                {
                    "$sort": {"activityCount": -1}
                },
                {
                    "$limit": limit
                }
            ]
            
            results = list(self.user_activity.aggregate(pipeline))
            df = pd.DataFrame(results)
            
            if not df.empty:
                df = df.rename(columns={"_id": "user_id", "activityCount": "activity_count"})
                df = df[["user_id", "activity_count"]]
                df.columns = ["User ID", "Activity Count"]
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error getting top users: {e}")
            return pd.DataFrame()

    def get_user_retention(self, days=30):
        """Get user retention rate (users returning within N days)"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            pipeline = [
                {
                    "$match": {"createdAt": {"$gte": start_date, "$lte": end_date}}
                },
                {
                    "$group": {
                        "_id": "$userId",
                        "firstSeen": {"$min": "$createdAt"},
                        "lastSeen": {"$max": "$createdAt"},
                        "activityCount": {"$sum": 1}
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "daysBetweenFirstLast": {
                            "$ceil": {
                                "$divide": [
                                    {"$subtract": ["$lastSeen", "$firstSeen"]},
                                    86400000
                                ]
                            }
                        },
                        "activityCount": 1
                    }
                }
            ]
            
            results = list(self.user_activity.aggregate(pipeline))
            
            if results:
                total_users = len(results)
                # Users with activity more than once are "returning"
                returning_users = sum(1 for r in results if r.get("daysBetweenFirstLast", 0) > 0)
                retention_rate = (returning_users / total_users * 100) if total_users > 0 else 0
                
                return {
                    "total_users": total_users,
                    "returning_users": returning_users,
                    "retention_rate_percent": round(retention_rate, 2),
                    "period_days": days
                }
            return {}
        except Exception as e:
            print(f"Error calculating retention rate: {e}")
            return {}

    def generate_report(self):
        """Generate comprehensive user behavior report"""
        print("\n" + "="*60)
        print("USER BEHAVIOR ANALYSIS REPORT")
        print("="*60)
        
        # Most Viewed Products
        print("\n👁️  TOP 15 MOST VIEWED PRODUCTS")
        viewed_products = self.get_most_viewed_products(15)
        if not viewed_products.empty:
            print(viewed_products.to_string(index=False))
        else:
            print("  No data available")
        
        # Conversion Rate
        print("\n🔄 CONVERSION ANALYSIS (Views → Purchases)")
        conversion = self.get_conversion_rate()
        if conversion:
            print(f"  Products Viewed: {conversion.get('products_viewed', 0)}")
            print(f"  Products Purchased: {conversion.get('products_purchased', 0)}")
            print(f"  Conversion Rate: {conversion.get('conversion_rate_percent', 0)}%")
        else:
            print("  No data available")
        
        # User Activity Summary
        print("\n📊 USER ACTIVITY BREAKDOWN")
        activity = self.get_user_activity_summary()
        if not activity.empty:
            print(activity.to_string(index=False))
        else:
            print("  No data available")
        
        # Top Active Users
        print("\n⭐ TOP 10 MOST ACTIVE USERS")
        top_users = self.get_top_users_by_activity(10)
        if not top_users.empty:
            print(top_users.to_string(index=False))
        else:
            print("  No data available")
        
        # User Retention
        print("\n🔁 USER RETENTION (LAST 30 DAYS)")
        retention = self.get_user_retention(30)
        if retention:
            print(f"  Total Users: {retention.get('total_users', 0)}")
            print(f"  Returning Users: {retention.get('returning_users', 0)}")
            print(f"  Retention Rate: {retention.get('retention_rate_percent', 0)}%")
        else:
            print("  No data available")
        
        print("\n" + "="*60)

    def get_json_report(self):
        """Generate user behavior report as JSON (for API integration)"""
        try:
            return {
                "success": True,
                "data": {
                    "most_viewed_products": self.get_most_viewed_products(15).to_dict(orient="records") if not self.get_most_viewed_products(15).empty else [],
                    "conversion_rate": self.get_conversion_rate(),
                    "activity_breakdown": self.get_user_activity_summary().to_dict(orient="records") if not self.get_user_activity_summary().empty else [],
                    "top_users": self.get_top_users_by_activity(10).to_dict(orient="records") if not self.get_top_users_by_activity(10).empty else [],
                    "retention": self.get_user_retention(30)
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


if __name__ == "__main__":
    analyzer = UserBehaviorAnalyzer()
    print(json.dumps(analyzer.get_json_report()))
