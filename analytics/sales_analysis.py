"""
Sales Analysis Module
Analyzes sales data from MongoDB orders collection
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


class SalesAnalyzer:
    def __init__(self, mongo_uri=None, db_name=None):
        """Initialize MongoDB connection"""
        self.mongo_uri = mongo_uri or get_mongo_uri()
        self.db_name = db_name or get_mongo_db_name()
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.orders = self.db.orders

    def get_total_revenue(self):
        """Calculate total revenue from all orders"""
        try:
            pipeline = [
                {
                    "$match": {
                        "status": {"$in": ["delivered", "completed"]}  # Only successful orders
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "totalRevenue": {"$sum": "$totalPrice"},
                        "totalOrders": {"$sum": 1}
                    }
                }
            ]
            
            result = list(self.orders.aggregate(pipeline))
            if result:
                return {
                    "total_revenue": result[0].get("totalRevenue", 0),
                    "total_orders": result[0].get("totalOrders", 0)
                }
            return {"total_revenue": 0, "total_orders": 0}
        except Exception as e:
            print(f"Error calculating total revenue: {e}")
            return {}

    def get_top_selling_products(self, limit=10):
        """Get top selling products by quantity"""
        try:
            pipeline = [
                {
                    "$match": {
                        "status": {"$in": ["delivered", "completed"]}
                    }
                },
                {
                    "$unwind": "$products"  # Break down products array
                },
                {
                    "$group": {
                        "_id": "$products.productId",
                        "productName": {"$first": "$products.name"},
                        "totalQuantity": {"$sum": "$products.quantity"},
                        "totalRevenue": {"$sum": {"$multiply": ["$products.quantity", "$products.price"]}},
                        "orderCount": {"$sum": 1}
                    }
                },
                {
                    "$sort": {"totalQuantity": -1}
                },
                {
                    "$limit": limit
                }
            ]
            
            results = list(self.orders.aggregate(pipeline))
            df = pd.DataFrame(results)
            
            if not df.empty:
                df = df.rename(columns={"_id": "product_id"})
                df = df[["product_id", "productName", "totalQuantity", "totalRevenue", "orderCount"]]
                df.columns = ["Product ID", "Product Name", "Quantity Sold", "Total Revenue", "Order Count"]
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error getting top selling products: {e}")
            return pd.DataFrame()

    def get_daily_sales_summary(self, days=30):
        """Get daily sales summary for the last N days"""
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            pipeline = [
                {
                    "$match": {
                        "createdAt": {"$gte": start_date},
                        "status": {"$in": ["delivered", "completed"]}
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "$dateToString": {
                                "format": "%Y-%m-%d",
                                "date": "$createdAt"
                            }
                        },
                        "dailyRevenue": {"$sum": "$totalPrice"},
                        "orderCount": {"$sum": 1},
                        "avgOrderValue": {"$avg": "$totalPrice"}
                    }
                },
                {
                    "$sort": {"_id": 1}
                }
            ]
            
            results = list(self.orders.aggregate(pipeline))
            df = pd.DataFrame(results)
            
            if not df.empty:
                df = df.rename(columns={"_id": "date"})
                df.columns = ["Date", "Daily Revenue", "Order Count", "Avg Order Value"]
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error getting daily sales summary: {e}")
            return pd.DataFrame()

    def get_sales_by_status(self):
        """Get order count and revenue breakdown by status"""
        try:
            pipeline = [
                {
                    "$group": {
                        "_id": "$status",
                        "orderCount": {"$sum": 1},
                        "totalRevenue": {"$sum": "$totalPrice"}
                    }
                },
                {
                    "$sort": {"orderCount": -1}
                }
            ]
            
            results = list(self.orders.aggregate(pipeline))
            df = pd.DataFrame(results)
            
            if not df.empty:
                df = df.rename(columns={"_id": "status"})
                df.columns = ["Status", "Order Count", "Total Revenue"]
                return df
            return pd.DataFrame()
        except Exception as e:
            print(f"Error getting sales by status: {e}")
            return pd.DataFrame()

    def generate_report(self):
        """Generate comprehensive sales report"""
        print("\n" + "="*60)
        print("SALES ANALYSIS REPORT")
        print("="*60)
        
        # Total Revenue
        print("\n📊 TOTAL REVENUE")
        revenue = self.get_total_revenue()
        if revenue:
            print(f"  Total Revenue: ${revenue.get('total_revenue', 0):,.2f}")
            print(f"  Total Orders: {revenue.get('total_orders', 0)}")
        
        # Top Selling Products
        print("\n🏆 TOP 10 SELLING PRODUCTS")
        top_products = self.get_top_selling_products(10)
        if not top_products.empty:
            print(top_products.to_string(index=False))
        else:
            print("  No data available")
        
        # Daily Sales Summary (Last 7 days)
        print("\n📈 DAILY SALES (LAST 7 DAYS)")
        daily_sales = self.get_daily_sales_summary(7)
        if not daily_sales.empty:
            print(daily_sales.to_string(index=False))
        else:
            print("  No data available")
        
        # Sales by Status
        print("\n📋 ORDERS BY STATUS")
        sales_status = self.get_sales_by_status()
        if not sales_status.empty:
            print(sales_status.to_string(index=False))
        else:
            print("  No data available")
        
        print("\n" + "="*60)

    def get_json_report(self):
        """Generate sales report as JSON (for API integration)"""
        try:
            return {
                "success": True,
                "data": {
                    "total_revenue": self.get_total_revenue(),
                    "top_products": self.get_top_selling_products(10).to_dict(orient="records") if not self.get_top_selling_products(10).empty else [],
                    "daily_sales": self.get_daily_sales_summary(7).to_dict(orient="records") if not self.get_daily_sales_summary(7).empty else [],
                    "sales_by_status": self.get_sales_by_status().to_dict(orient="records") if not self.get_sales_by_status().empty else []
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


if __name__ == "__main__":
    import sys
    analyzer = SalesAnalyzer()
    
    # Always output JSON for API integration
    print(json.dumps(analyzer.get_json_report()))
