"""
Product Recommendation Module
Generates product recommendations based on user behavior and trends
"""

import os
from urllib.parse import urlparse
import pandas as pd
from pymongo import MongoClient
from collections import defaultdict
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


class RecommendationEngine:
    def __init__(self, mongo_uri=None, db_name=None):
        """Initialize MongoDB connection"""
        self.mongo_uri = mongo_uri or get_mongo_uri()
        self.db_name = db_name or get_mongo_db_name()
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.products = self.db.products
        self.user_activity = self.db.userActivity
        self.orders = self.db.orders

    def get_most_viewed_products(self, limit=20):
        """Get most viewed products across all users"""
        try:
            pipeline = [
                {
                    "$match": {"action": "view"}
                },
                {
                    "$group": {
                        "_id": "$productId",
                        "viewCount": {"$sum": 1}
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
            return [r["_id"] for r in results]
        except Exception as e:
            print(f"Error getting most viewed products: {e}")
            return []

    def get_trending_products(self, days=7, limit=10):
        """Get trending products (high views in recent period)"""
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            pipeline = [
                {
                    "$match": {
                        "action": "view",
                        "createdAt": {"$gte": start_date}
                    }
                },
                {
                    "$group": {
                        "_id": "$productId",
                        "recentViews": {"$sum": 1}
                    }
                },
                {
                    "$sort": {"recentViews": -1}
                },
                {
                    "$limit": limit
                }
            ]
            
            results = list(self.user_activity.aggregate(pipeline))
            return [r["_id"] for r in results]
        except Exception as e:
            print(f"Error getting trending products: {e}")
            return []

    def get_category_recommendations(self, product_id, limit=5):
        """Get product recommendations from the same category"""
        try:
            # Get the product and its category
            product = self.products.find_one({"_id": product_id})
            
            if not product:
                return []
            
            category = product.get("category")
            if not category:
                return []
            
            # Find other products in the same category
            pipeline = [
                {
                    "$match": {
                        "category": category,
                        "_id": {"$ne": product_id},
                        "stock": {"$gt": 0}
                    }
                },
                {
                    "$limit": limit
                }
            ]
            
            results = list(self.products.aggregate(pipeline))
            return results
        except Exception as e:
            print(f"Error getting category recommendations: {e}")
            return []

    def get_recommendations_for_user(self, user_id, limit=10):
        """Get personalized recommendations based on user's viewing history"""
        try:
            # Get products viewed by user
            user_views = list(self.user_activity.find(
                {"userId": user_id, "action": "view"},
                {"productId": 1}
            ))
            
            if not user_views:
                # No history, return trending products
                return self.get_trending_products(7, limit)
            
            viewed_ids = [v["productId"] for v in user_views]
            
            # Get categories of viewed products
            viewed_products = list(self.products.find(
                {"_id": {"$in": viewed_ids}},
                {"category": 1}
            ))
            
            categories = [p.get("category") for p in viewed_products if p.get("category")]
            
            if not categories:
                return self.get_trending_products(7, limit)
            
            # Get other products from same categories (not already viewed)
            pipeline = [
                {
                    "$match": {
                        "category": {"$in": categories},
                        "_id": {"$nin": viewed_ids},
                        "stock": {"$gt": 0}
                    }
                },
                {
                    "$limit": limit
                }
            ]
            
            results = list(self.products.aggregate(pipeline))
            return results
        except Exception as e:
            print(f"Error getting user recommendations: {e}")
            return []

    def get_frequently_bought_together(self, product_id, limit=5):
        """Get products frequently bought with the given product"""
        try:
            # Find orders containing the product
            pipeline = [
                {
                    "$match": {
                        "products.productId": product_id
                    }
                },
                {
                    "$unwind": "$products"
                },
                {
                    "$match": {
                        "products.productId": {"$ne": product_id}
                    }
                },
                {
                    "$group": {
                        "_id": "$products.productId",
                        "frequency": {"$sum": 1}
                    }
                },
                {
                    "$sort": {"frequency": -1}
                },
                {
                    "$limit": limit
                }
            ]
            
            results = list(self.orders.aggregate(pipeline))
            product_ids = [r["_id"] for r in results]
            
            # Get product details
            if product_ids:
                products = list(self.products.find(
                    {"_id": {"$in": product_ids}}
                ))
                return products
            return []
        except Exception as e:
            print(f"Error getting frequently bought together: {e}")
            return []

    def format_product(self, product):
        """Format product data for display"""
        if isinstance(product, dict):
            return {
                "ID": str(product.get("_id", "N/A")),
                "Name": product.get("name", "Unknown"),
                "Price": f"${product.get('price', 0):.2f}",
                "Category": product.get("category", "N/A"),
                "Stock": product.get("stock", 0)
            }
        return product

    def generate_report(self, user_id=None):
        """Generate recommendation report"""
        print("\n" + "="*60)
        print("PRODUCT RECOMMENDATION REPORT")
        print("="*60)
        
        # Most Viewed Products
        print("\n👀 TOP 10 MOST VIEWED PRODUCTS (TRENDING)")
        most_viewed = self.get_most_viewed_products(10)
        if most_viewed:
            products = list(self.products.find({"_id": {"$in": most_viewed}}))
            df = pd.DataFrame([self.format_product(p) for p in products])
            if not df.empty:
                print(df.to_string(index=False))
        else:
            print("  No data available")
        
        # Trending Products (Last 7 days)
        print("\n🔥 TRENDING PRODUCTS (LAST 7 DAYS)")
        trending = self.get_trending_products(7, 10)
        if trending:
            products = list(self.products.find({"_id": {"$in": trending}}))
            df = pd.DataFrame([self.format_product(p) for p in products])
            if not df.empty:
                print(df.to_string(index=False))
        else:
            print("  No data available")
        
        # Sample category recommendations
        print("\n📦 CATEGORY-BASED RECOMMENDATIONS (Sample)")
        if most_viewed:
            category_recs = self.get_category_recommendations(most_viewed[0], 5)
            if category_recs:
                df = pd.DataFrame([self.format_product(p) for p in category_recs])
                if not df.empty:
                    print(f"  Similar to: {most_viewed[0]}")
                    print(df.to_string(index=False))
            else:
                print("  No recommendations available")
        
        # Frequently bought together
        print("\n🛒 FREQUENTLY BOUGHT TOGETHER (Sample)")
        if most_viewed:
            bought_together = self.get_frequently_bought_together(most_viewed[0], 5)
            if bought_together:
                df = pd.DataFrame([self.format_product(p) for p in bought_together])
                if not df.empty:
                    print(f"  Often bought with: {most_viewed[0]}")
                    print(df.to_string(index=False))
            else:
                print("  No data available")
        
        # Personalized recommendations
        if user_id:
            print(f"\n👤 PERSONALIZED RECOMMENDATIONS FOR USER {user_id}")
            user_recs = self.get_recommendations_for_user(user_id, 10)
            if user_recs:
                df = pd.DataFrame([self.format_product(p) for p in user_recs])
                if not df.empty:
                    print(df.to_string(index=False))
            else:
                print("  No recommendations available")
        
        print("\n" + "="*60)

    def get_json_report(self):
        """Generate recommendations report as JSON (for API integration)"""
        try:
            most_viewed = self.get_most_viewed_products(10)
            trending = self.get_trending_products(7, 10)
            
            # Format products for JSON
            most_viewed_products = [self.format_product(p) for p in (
                list(self.products.find({"_id": {"$in": most_viewed}})) if most_viewed else []
            )]
            
            trending_products = [self.format_product(p) for p in (
                list(self.products.find({"_id": {"$in": trending}})) if trending else []
            )]
            
            return {
                "success": True,
                "data": {
                    "trending_products": trending_products,
                    "most_viewed_products": most_viewed_products
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


if __name__ == "__main__":
    engine = RecommendationEngine()
    print(json.dumps(engine.get_json_report()))
