"""
AVDAN Platform Seed Script
===========================
Creates all users, categories, vendor profiles, products, rider profiles,
and hub agent records needed to fully populate and test the platform.

Run from apps/api/:
    uv run python scripts/seed.py

Idempotent — safe to run multiple times (skips if admin@avdan.com already exists).
Password for every account: Avdan@2024
"""
from __future__ import annotations

import asyncio
import json
import sys
import uuid

sys.path.insert(0, ".")  # ensure project root is on path when run from apps/api/

import bcrypt
from sqlalchemy import text

from core.database import AsyncSessionLocal


PASSWORD_HASH = bcrypt.hashpw(b"Avdan@2024", bcrypt.gensalt()).decode()


# ── Category definitions ──────────────────────────────────────────────────────

CATEGORIES = [
    {"name": "Electronics",        "slug": "electronics",        "icon": "cpu",          "sort_order": 1},
    {"name": "Food & Groceries",    "slug": "food-groceries",     "icon": "shopping-bag", "sort_order": 2},
    {"name": "Fashion & Clothing",  "slug": "fashion-clothing",   "icon": "shirt",        "sort_order": 3},
    {"name": "Health & Beauty",     "slug": "health-beauty",      "icon": "heart",        "sort_order": 4},
    {"name": "Home & Kitchen",      "slug": "home-kitchen",       "icon": "home",         "sort_order": 5},
    {"name": "Sports & Fitness",    "slug": "sports-fitness",     "icon": "activity",     "sort_order": 6},
    {"name": "Baby & Kids",         "slug": "baby-kids",          "icon": "baby",         "sort_order": 7},
    {"name": "Books & Stationery",  "slug": "books-stationery",   "icon": "book",         "sort_order": 8},
]


# ── User definitions ──────────────────────────────────────────────────────────

USERS = [
    # Admin & support
    {"email": "admin@avdan.com",    "role": "admin",   "name": "Platform Admin"},
    {"email": "support@avdan.com",  "role": "support", "name": "Support Agent"},

    # Vendors
    {"email": "vendor1@avdan.com",  "role": "vendor",  "name": "Chidi Okonkwo",   "business": "TechHub Electronics"},
    {"email": "vendor2@avdan.com",  "role": "vendor",  "name": "Ngozi Adeyemi",   "business": "Fresh Farms Market"},
    {"email": "vendor3@avdan.com",  "role": "vendor",  "name": "Emeka Nwosu",     "business": "Style Avenue Fashion"},
    {"email": "vendor4@avdan.com",  "role": "vendor",  "name": "Aisha Bello",     "business": "HealthPlus Pharmacy"},
    {"email": "vendor5@avdan.com",  "role": "vendor",  "name": "Taiwo Afolabi",   "business": "Kitchen Masters"},
    {"email": "vendor6@avdan.com",  "role": "vendor",  "name": "Ibrahim Musa",    "business": "SportZone NG"},
    {"email": "vendor7@avdan.com",  "role": "vendor",  "name": "Chioma Eze",      "business": "Baby World Nigeria"},
    {"email": "vendor8@avdan.com",  "role": "vendor",  "name": "Adewale Olusanya","business": "Bookshelf NG"},

    # Customers
    {"email": "customer1@avdan.com","role": "customer","name": "Amaka Obi",       "phone": "+2348031234567"},
    {"email": "customer2@avdan.com","role": "customer","name": "Chukwuemeka Eze", "phone": "+2348041234568"},
    {"email": "customer3@avdan.com","role": "customer","name": "Fatima Abdullahi","phone": "+2348051234569"},
    {"email": "customer4@avdan.com","role": "customer","name": "Kelechi Okafor",  "phone": "+2348061234570"},
    {"email": "customer5@avdan.com","role": "customer","name": "Yewande Balogun", "phone": "+2348071234571"},

    # Riders
    {"email": "rider1@avdan.com",   "role": "rider",   "name": "Babatunde Ojo",   "phone": "+2348081234572", "online": True},
    {"email": "rider2@avdan.com",   "role": "rider",   "name": "Emeka Eze Jr",    "phone": "+2348091234573", "online": True},
    {"email": "rider3@avdan.com",   "role": "rider",   "name": "Yusuf Garba",     "phone": "+2348101234574", "online": False},
    {"email": "rider4@avdan.com",   "role": "rider",   "name": "Nnamdi Okafor",   "phone": "+2348111234575", "online": False},

    # Hub agents
    {"email": "hub1@avdan.com",     "role": "agent",   "name": "Segun Adeniyi"},
    {"email": "hub2@avdan.com",     "role": "agent",   "name": "Grace Okonkwo"},
]


# ── Product catalogue (price in NGN kobo = NGN × 100) ─────────────────────────

IMG = "https://images.unsplash.com/photo-{}?w=800&q=80"

VENDOR_PRODUCTS = {
    "TechHub Electronics": {
        "category": "electronics",
        "description": "Your one-stop shop for the latest gadgets and electronics in Lagos.",
        "logo_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&q=80",
        "products": [
            {"name": "Samsung Galaxy A55 5G",        "desc": "6.6-inch AMOLED display, 8GB RAM, 256GB storage, triple camera.",       "price": 38000000, "stock": 15, "imgs": [IMG.format("1610945265189-5ebf-4909-a536-ac9b70c9fc28")]},
            {"name": "Tecno Spark 20 Pro",            "desc": "6.78-inch display, 8GB RAM, 128GB, 5000mAh battery.",                  "price": 18500000, "stock": 22, "imgs": [IMG.format("1511707171634-56cf9b8be1b7")]},
            {"name": "iPhone 14 (128GB)",             "desc": "A15 Bionic chip, dual 12MP cameras, 5G connectivity.",                 "price": 89000000, "stock": 8,  "imgs": [IMG.format("1592750475338-74b7b21085ab")]},
            {"name": "JBL Tune 770NC Headphones",     "desc": "Wireless noise-cancelling over-ear headphones, 70hr battery.",         "price": 8500000,  "stock": 30, "imgs": [IMG.format("1505740420928-5e560c06d30e")]},
            {"name": "Anker PowerBank 26800mAh",      "desc": "Massive capacity, dual USB-A + USB-C, fast charge.",                   "price": 5200000,  "stock": 40, "imgs": [IMG.format("1609091839311-d5365f9ff1c5")]},
            {"name": "Samsung 65-inch UHD Smart TV",  "desc": "4K HDR, built-in WiFi, Tizen OS, 3 HDMI ports.",                      "price": 195000000,"stock": 5,  "imgs": [IMG.format("1593359677879-a26632322ede")]},
            {"name": "Logitech MX Keys Keyboard",     "desc": "Wireless full-size keyboard, backlit, multi-device pairing.",          "price": 4500000,  "stock": 20, "imgs": [IMG.format("1587829741301-dc798b83add3")]},
            {"name": "Xiaomi Mi Band 8",              "desc": "Fitness tracker, heart rate, SpO2, 16-day battery life.",              "price": 2800000,  "stock": 50, "imgs": [IMG.format("1544117519-31a4b7290f36")]},
            {"name": "TP-Link Archer AX3000 Router",  "desc": "WiFi 6, dual-band, ideal for smart homes.",                           "price": 9800000,  "stock": 12, "imgs": [IMG.format("1558618666-fcd25c85cd64")]},
            {"name": "SanDisk 1TB Portable SSD",      "desc": "USB-C, read 520MB/s, rugged and compact.",                            "price": 6500000,  "stock": 18, "imgs": [IMG.format("1629654291663-a91ade141093")]},
            {"name": "Ring Light 18-inch LED",        "desc": "Dimmable, 3 colour modes, phone holder, tripod stand.",               "price": 3200000,  "stock": 25, "imgs": [IMG.format("1605106702734-205df224ecce")]},
            {"name": "USB-C 7-in-1 Hub",              "desc": "4K HDMI, 3×USB-A, SD card, 100W PD charging.",                       "price": 1800000,  "stock": 35, "imgs": [IMG.format("1558618666-fcd25c85cd64")]},
        ],
    },
    "Fresh Farms Market": {
        "category": "food-groceries",
        "description": "Farm-fresh produce and quality groceries delivered to your door.",
        "logo_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&q=80",
        "products": [
            {"name": "Basmati Rice 25kg",             "desc": "Premium long-grain basmati rice, fluffy and aromatic.",               "price": 5500000,  "stock": 50, "imgs": [IMG.format("1586201375761-83865001e31c")]},
            {"name": "Groundnut Oil 5L",              "desc": "100% pure groundnut oil, cold-pressed, rich flavour.",                "price": 3200000,  "stock": 40, "imgs": [IMG.format("1474979266404-7eaacbcd87c5")]},
            {"name": "Tomatoes (1 Basket ~15kg)",     "desc": "Fresh red tomatoes, perfect for stew and soups.",                    "price": 1800000,  "stock": 30, "imgs": [IMG.format("1518977676865-d78d41e68889")]},
            {"name": "Indomie Noodles (1 Carton)",    "desc": "Indomie instant noodles, 40 packs per carton, assorted flavours.",   "price": 1450000,  "stock": 60, "imgs": [IMG.format("1569718212165-3a8278d5f624")]},
            {"name": "Semovita 10kg",                 "desc": "Smooth semolina flour, great for swallow dishes.",                   "price": 1600000,  "stock": 45, "imgs": [IMG.format("1586201375761-83865001e31c")]},
            {"name": "Quaker Oats 2kg",               "desc": "Wholesome rolled oats, perfect for a hearty breakfast.",             "price": 1200000,  "stock": 55, "imgs": [IMG.format("1517433456452-f9f2976d7f59")]},
            {"name": "Seasoning Cubes (Maggi 2×100)", "desc": "Maggi seasoning cubes, 2 packs of 100 cubes each.",                 "price": 1100000,  "stock": 80, "imgs": [IMG.format("1598511796432-91f4b1e5a052")]},
            {"name": "Frozen Chicken Drumsticks 2kg", "desc": "Quality frozen chicken, halal-certified, ready to cook.",            "price": 2800000,  "stock": 35, "imgs": [IMG.format("1587593810167-a84920ea0781")]},
            {"name": "Beans (Black-eyed Peas) 5kg",  "desc": "Nigerian black-eyed beans, cleaned and ready to cook.",              "price": 1900000,  "stock": 40, "imgs": [IMG.format("1516684732162-798a0062be99")]},
            {"name": "Palm Oil 4L",                   "desc": "Fresh unrefined red palm oil, rich colour and taste.",               "price": 2100000,  "stock": 30, "imgs": [IMG.format("1474979266404-7eaacbcd87c5")]},
        ],
    },
    "Style Avenue Fashion": {
        "category": "fashion-clothing",
        "description": "Contemporary African fashion — Ankara prints, luxury fabrics, modern cuts.",
        "logo_url": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&q=80",
        "products": [
            {"name": "Ankara Shirt (Men's)",          "desc": "100% cotton Ankara print shirt, fitted cut, sizes S–3XL.",           "price": 450000,   "stock": 60, "imgs": [IMG.format("1596755094514-f87e34085b2c")]},
            {"name": "Aso-oke Fabric Set (3 yards)",  "desc": "Handwoven aso-oke fabric in assorted colours, traditional occasions.","price": 1800000,  "stock": 25, "imgs": [IMG.format("1558618666-fcd25c85cd64")]},
            {"name": "Ladies Ankara Gown",            "desc": "Flared midi gown in vibrant Ankara print, off-shoulder option.",    "price": 750000,   "stock": 40, "imgs": [IMG.format("1516762689617-e1cffcef479d")]},
            {"name": "Men's Chinos (Slim Fit)",       "desc": "Stretch chinos in khaki, navy, and grey. Sizes 28–40.",              "price": 650000,   "stock": 55, "imgs": [IMG.format("1542291026-7eec264c27ff")]},
            {"name": "Leather Sneakers (Men's)",      "desc": "Premium faux leather sneakers, cushioned sole. Sizes 40–46.",       "price": 1200000,  "stock": 30, "imgs": [IMG.format("1542291026-7eec264c27ff")]},
            {"name": "Ladies Block-heel Sandals",     "desc": "Elegant block heels, faux suede, sizes 36–42.",                    "price": 900000,   "stock": 35, "imgs": [IMG.format("1543163521-1bf539c55dd2")]},
            {"name": "Structured Office Handbag",     "desc": "Faux leather tote with laptop compartment and zip closure.",        "price": 1500000,  "stock": 20, "imgs": [IMG.format("1553062407-98eeb64c6a62")]},
            {"name": "Men's Polo Shirt (3-pack)",     "desc": "Plain polo shirts in assorted colours, sizes M–3XL.",               "price": 750000,   "stock": 70, "imgs": [IMG.format("1622470953373-0f7d531d5de5")]},
            {"name": "Traditional Beaded Necklace",   "desc": "Handcrafted Nigerian coral-inspired beaded necklace.",              "price": 350000,   "stock": 45, "imgs": [IMG.format("1515562141207-7a88fb7ce338")]},
            {"name": "Men's Native Senator Suit",     "desc": "Agbada-inspired native senator suit, embroidered.",                 "price": 2800000,  "stock": 15, "imgs": [IMG.format("1596755094514-f87e34085b2c")]},
            {"name": "Ladies Wrap Skirt (Ankara)",    "desc": "Reversible wrap skirt, one-size fits most.",                       "price": 380000,   "stock": 50, "imgs": [IMG.format("1516762689617-e1cffcef479d")]},
        ],
    },
    "HealthPlus Pharmacy": {
        "category": "health-beauty",
        "description": "Authentic medications, supplements, and beauty products delivered to you.",
        "logo_url": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&q=80",
        "products": [
            {"name": "Vitamin C 1000mg (60 Tablets)", "desc": "High-potency vitamin C with rose hip, immune support.",              "price": 350000,   "stock": 100,"imgs": [IMG.format("1584308666744-24d5c474f2ae")]},
            {"name": "Multivitamin & Mineral Complex", "desc": "Daily multivitamin, 30 tablets, covers all essential nutrients.",   "price": 420000,   "stock": 80, "imgs": [IMG.format("1584308666744-24d5c474f2ae")]},
            {"name": "Paracetamol 500mg (100 tabs)",  "desc": "Fast-acting pain and fever relief, pharmacist-approved.",           "price": 120000,   "stock": 150,"imgs": [IMG.format("1550572017-edd951b04bf3")]},
            {"name": "Dettol Antiseptic Liquid 500ml","desc": "Kills 99.9% of bacteria, ideal for wounds and general hygiene.",    "price": 280000,   "stock": 60, "imgs": [IMG.format("1584308666744-24d5c474f2ae")]},
            {"name": "Cetaphil Moisturising Lotion",  "desc": "250ml gentle daily lotion for sensitive and dry skin.",             "price": 850000,   "stock": 45, "imgs": [IMG.format("1556228578-8c89e6adf883")]},
            {"name": "Neutrogena Face Wash",           "desc": "Oil-free acne wash, 175ml, for blemish-prone skin.",               "price": 720000,   "stock": 40, "imgs": [IMG.format("1556228578-8c89e6adf883")]},
            {"name": "Oral-B Electric Toothbrush",    "desc": "Rechargeable electric toothbrush, 3 brushing modes.",              "price": 1800000,  "stock": 25, "imgs": [IMG.format("1607613009820-a29f7bb81c04")]},
            {"name": "Hand Sanitizer 500ml Pump",     "desc": "70% isopropyl alcohol, kills 99.9% of germs, moisturising.",       "price": 180000,   "stock": 120,"imgs": [IMG.format("1584308666744-24d5c474f2ae")]},
            {"name": "First Aid Kit (40-piece)",      "desc": "Bandages, antiseptic wipes, scissors, tweezers, cotton wool.",     "price": 550000,   "stock": 35, "imgs": [IMG.format("1584308666744-24d5c474f2ae")]},
            {"name": "Omega-3 Fish Oil (60 caps)",    "desc": "High-strength 1000mg fish oil, heart and brain health support.",   "price": 390000,   "stock": 70, "imgs": [IMG.format("1584308666744-24d5c474f2ae")]},
        ],
    },
    "Kitchen Masters": {
        "category": "home-kitchen",
        "description": "Everything you need for a well-equipped Nigerian kitchen.",
        "logo_url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&q=80",
        "products": [
            {"name": "Non-Stick Frying Pan 28cm",     "desc": "Granite-coated non-stick, induction compatible, glass lid.",       "price": 1200000,  "stock": 40, "imgs": [IMG.format("1556909114-f6e7ad7d3136")]},
            {"name": "Pressure Cooker 6-Litre",       "desc": "Stainless steel pressure cooker with safety valve, fast cooking.",  "price": 2800000,  "stock": 20, "imgs": [IMG.format("1585515656618-9dba56cfce61")]},
            {"name": "Blender 1.5L (600W)",           "desc": "Powerful blender for smoothies, soups, and tomatoes. 3 speeds.",  "price": 1500000,  "stock": 30, "imgs": [IMG.format("1570197788417-0e82375c9371")]},
            {"name": "Kitchen Knife Set (6-piece)",   "desc": "Stainless steel chef knives with wooden block, ultra-sharp.",      "price": 1800000,  "stock": 25, "imgs": [IMG.format("1593618998000-fb219ac9d0b1")]},
            {"name": "Stainless Mixing Bowl Set (3)", "desc": "Nesting mixing bowls: 2L, 3L, 4L, dishwasher safe.",               "price": 750000,   "stock": 50, "imgs": [IMG.format("1575367382197-8ccf5e6f769d")]},
            {"name": "Electric Kettle 1.7L",          "desc": "Stainless steel kettle, auto shutoff, boils in 3 minutes.",       "price": 980000,   "stock": 35, "imgs": [IMG.format("1544787219-7f47ccb76574")]},
            {"name": "Food Storage Set (10 pieces)",  "desc": "BPA-free airtight containers, microwave and freezer safe.",        "price": 850000,   "stock": 60, "imgs": [IMG.format("1606854428451-02ade43c793c")]},
            {"name": "Cast Iron Dutch Oven 4L",       "desc": "Enamelled cast iron, oven-safe to 260°C, excellent heat retention.","price": 3200000, "stock": 12, "imgs": [IMG.format("1585515656618-9dba56cfce61")]},
            {"name": "Dish Drying Rack (2-tier)",     "desc": "Stainless steel 2-tier dish rack with drip tray.",                "price": 650000,   "stock": 45, "imgs": [IMG.format("1575367382197-8ccf5e6f769d")]},
            {"name": "Hand Mixer 300W",                "desc": "5-speed electric hand mixer, dough hooks and beaters included.",   "price": 750000,   "stock": 28, "imgs": [IMG.format("1570197788417-0e82375c9371")]},
        ],
    },
    "SportZone NG": {
        "category": "sports-fitness",
        "description": "Quality sports equipment and fitness gear for every level.",
        "logo_url": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&q=80",
        "products": [
            {"name": "Adidas Football (Size 5)",      "desc": "Official size 5 football, synthetic leather, ideal for outdoor.",  "price": 1200000,  "stock": 40, "imgs": [IMG.format("1516122572888-9a3c90b7b0cf")]},
            {"name": "Speed Jump Rope",               "desc": "Adjustable steel wire jump rope with ball-bearing handles.",       "price": 250000,   "stock": 80, "imgs": [IMG.format("1517836357463-d25dfeac3438")]},
            {"name": "Non-Slip Yoga Mat 6mm",         "desc": "TPE foam yoga mat, 183×61cm, carry strap included.",               "price": 680000,   "stock": 35, "imgs": [IMG.format("1545205597-3d9d02c29597")]},
            {"name": "Resistance Band Set (5 packs)", "desc": "5 resistance levels, latex-free, includes carry bag.",             "price": 450000,   "stock": 60, "imgs": [IMG.format("1517836357463-d25dfeac3438")]},
            {"name": "Adjustable Dumbbell Pair 10kg", "desc": "Cast iron dumbbells with rubber coating, 5kg × 2.",               "price": 1800000,  "stock": 20, "imgs": [IMG.format("1571019614242-c5c5dee81066")]},
            {"name": "Gym Bag (30L Backpack)",        "desc": "Waterproof gym bag with shoe compartment, multiple pockets.",     "price": 850000,   "stock": 30, "imgs": [IMG.format("1553062407-98eeb64c6a62")]},
            {"name": "Sports Water Bottle 1L",        "desc": "BPA-free Tritan bottle, leak-proof, with straw and carry loop.",  "price": 280000,   "stock": 70, "imgs": [IMG.format("1602143407955-d60d4608abb0")]},
            {"name": "Cooling Sports Towel",          "desc": "Microfibre quick-dry towel, 120×40cm, stays cold for 2 hours.",   "price": 180000,   "stock": 90, "imgs": [IMG.format("1517836357463-d25dfeac3438")]},
        ],
    },
    "Baby World Nigeria": {
        "category": "baby-kids",
        "description": "Everything your little one needs — safe, quality, and affordable.",
        "logo_url": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=200&q=80",
        "products": [
            {"name": "Baby Romper Set (3-pack)",      "desc": "Soft cotton rompers, sizes 0–18 months, snap-button closure.",    "price": 650000,   "stock": 50, "imgs": [IMG.format("1519689680058-324335573bb0")]},
            {"name": "Dr. Brown's Bottles Set (3)",   "desc": "Anti-colic feeding bottles, 150ml + 250ml, BPA-free.",           "price": 1200000,  "stock": 35, "imgs": [IMG.format("1515488042361-ee00e0ddd4e4")]},
            {"name": "Baby Wipes (6 packs × 80)",     "desc": "Fragrance-free, alcohol-free sensitive wipes for newborns.",     "price": 480000,   "stock": 80, "imgs": [IMG.format("1515488042361-ee00e0ddd4e4")]},
            {"name": "Johnson's Baby Lotion 500ml",   "desc": "Gentle all-over baby lotion, hypoallergenic, dermatologist tested.","price": 350000, "stock": 100,"imgs": [IMG.format("1556228578-8c89e6adf883")]},
            {"name": "Teething Toy Set (BPA-free)",   "desc": "Silicone teething rings in assorted shapes, soothing and safe.",  "price": 280000,   "stock": 60, "imgs": [IMG.format("1515488042361-ee00e0ddd4e4")]},
            {"name": "Baby Blanket (Muslin 4-pack)",  "desc": "100% organic cotton muslin swaddle blankets, 120×120cm.",        "price": 580000,   "stock": 40, "imgs": [IMG.format("1519689680058-324335573bb0")]},
            {"name": "Stroller Baby Toy Bar",         "desc": "Clip-on stroller toy bar with rattle, mirror, and teether.",     "price": 420000,   "stock": 30, "imgs": [IMG.format("1515488042361-ee00e0ddd4e4")]},
            {"name": "Baby Walker (Adjustable)",      "desc": "3-in-1 adjustable baby walker, activity tray, 6–18 months.",    "price": 2200000,  "stock": 15, "imgs": [IMG.format("1515488042361-ee00e0ddd4e4")]},
            {"name": "Diaper Bag Backpack",           "desc": "Multi-pocket diaper bag, includes changing mat, insulated pocket.","price": 1500000, "stock": 20, "imgs": [IMG.format("1553062407-98eeb64c6a62")]},
        ],
    },
    "Bookshelf NG": {
        "category": "books-stationery",
        "description": "Books, educational materials, and quality stationery for all ages.",
        "logo_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
        "products": [
            {"name": "Things Fall Apart (Chinua Achebe)","desc": "The classic Nigerian novel by Chinua Achebe. Paperback edition.","price": 180000,  "stock": 80, "imgs": [IMG.format("1507003211169-0a1dd7228f2d")]},
            {"name": "Rich Dad Poor Dad",             "desc": "Robert Kiyosaki's bestselling personal finance book.",            "price": 250000,   "stock": 60, "imgs": [IMG.format("1507003211169-0a1dd7228f2d")]},
            {"name": "Python Crash Course (3rd Ed.)", "desc": "Hands-on introduction to Python programming for beginners.",     "price": 650000,   "stock": 30, "imgs": [IMG.format("1507003211169-0a1dd7228f2d")]},
            {"name": "WAEC Past Questions (Sciences)", "desc": "10-year WAEC past questions for Biology, Chemistry, and Physics.","price": 120000,  "stock": 100,"imgs": [IMG.format("1507003211169-0a1dd7228f2d")]},
            {"name": "JAMB CBT Practice App (Card)",  "desc": "Scratch card for JAMB past questions app, unlimited access 1 year.","price": 200000, "stock": 150,"imgs": [IMG.format("1507003211169-0a1dd7228f2d")]},
            {"name": "A4 Drawing Pad (50 sheets)",    "desc": "110gsm cartridge drawing pad, acid-free, ideal for sketching.",  "price": 250000,   "stock": 70, "imgs": [IMG.format("1513364776144-60329b07e83a")]},
            {"name": "BIC Ballpoint Pens (50 pack)",  "desc": "Reliable blue ballpoint pens, smooth writing, long-lasting.",   "price": 180000,   "stock": 120,"imgs": [IMG.format("1513364776144-60329b07e83a")]},
            {"name": "Casio FX-991ES Scientific Calc","desc": "Solar-powered scientific calculator, 417 functions, WAEC approved.","price": 1500000,"stock": 45, "imgs": [IMG.format("1587829741301-dc798b83add3")]},
        ],
    },
}


# ── Seed helpers ──────────────────────────────────────────────────────────────

async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Idempotency check
        result = await db.execute(text("SELECT id FROM users WHERE email='admin@avdan.com' LIMIT 1"))
        if result.scalar_one_or_none():
            print("✓ Seed data already exists — skipping.")
            return

        print("Seeding AVDAN platform...")

        # 1. Delivery zone
        zone_id = uuid.uuid4()
        await db.execute(text(
            "INSERT INTO delivery_zones (id, name, active) VALUES (:id, 'Lagos Zone', true)"
        ), {"id": str(zone_id)})
        print("  ✓ Delivery zone created")

        # 2. Categories
        category_id_map: dict[str, str] = {}
        for cat in CATEGORIES:
            cid = uuid.uuid4()
            category_id_map[cat["slug"]] = str(cid)
            await db.execute(text(
                "INSERT INTO categories (id, name, slug, icon, sort_order) "
                "VALUES (:id, :name, :slug, :icon, :sort_order)"
            ), {"id": str(cid), "name": cat["name"], "slug": cat["slug"],
                "icon": cat["icon"], "sort_order": cat["sort_order"]})
        print(f"  ✓ {len(CATEGORIES)} categories created")

        # 3. Users
        user_id_map: dict[str, str] = {}
        for u in USERS:
            uid = uuid.uuid4()
            user_id_map[u["email"]] = str(uid)
            phone = u.get("phone")
            await db.execute(text(
                "INSERT INTO users (id, role, email, phone, password_hash, status) "
                "VALUES (:id, :role, :email, :phone, :pw, 'active')"
            ), {"id": str(uid), "role": u["role"], "email": u["email"],
                "phone": phone, "pw": PASSWORD_HASH})
        print(f"  ✓ {len(USERS)} users created")

        # 4. Vendor profiles (auth table) + Vendor rows + Products
        vendor_emails = [u["email"] for u in USERS if u["role"] == "vendor"]
        vendor_businesses = {u["email"]: u for u in USERS if u["role"] == "vendor"}

        for email in vendor_emails:
            u = vendor_businesses[email]
            business = u["business"]
            uid = user_id_map[email]

            # VendorProfile in auth.vendor_profiles
            vpid = uuid.uuid4()
            await db.execute(text(
                "INSERT INTO vendor_profiles (id, user_id, business_name, business_type, description) "
                "VALUES (:id, :uid, :bname, 'retail', :desc)"
            ), {"id": str(vpid), "uid": uid, "bname": business,
                "desc": VENDOR_PRODUCTS[business]["description"]})

            # Vendor row
            vid = uuid.uuid4()
            slug = business.lower().replace(" ", "-").replace("&", "and")
            slug = "".join(c if c.isalnum() or c == "-" else "" for c in slug)
            await db.execute(text(
                "INSERT INTO vendors (id, user_id, name, slug, description, logo_url, status, zone_id, rating) "
                "VALUES (:id, :uid, :name, :slug, :desc, :logo, 'active', :zone, :rating)"
            ), {"id": str(vid), "uid": uid, "name": business, "slug": slug,
                "desc": VENDOR_PRODUCTS[business]["description"],
                "logo": VENDOR_PRODUCTS[business]["logo_url"],
                "zone": str(zone_id),
                "rating": round(3.8 + (hash(business) % 13) / 10, 1)})

            # Products
            cat_slug = VENDOR_PRODUCTS[business]["category"]
            cat_id = category_id_map[cat_slug]
            for prod in VENDOR_PRODUCTS[business]["products"]:
                pid = uuid.uuid4()
                await db.execute(text(
                    "INSERT INTO products (id, vendor_id, category_id, name, description, "
                    "price_kobo, available, stock_qty, image_urls) "
                    "VALUES (:id, :vid, :cid, :name, :desc, :price, true, :stock, cast(:imgs as jsonb))"
                ), {"id": str(pid), "vid": str(vid), "cid": cat_id,
                    "name": prod["name"], "desc": prod["desc"],
                    "price": prod["price"], "stock": prod["stock"],
                    "imgs": json.dumps(prod["imgs"])})

        print(f"  ✓ {len(vendor_emails)} vendor profiles + products created")

        # 5. Rider profiles
        for u in USERS:
            if u["role"] != "rider":
                continue
            uid = user_id_map[u["email"]]
            rid = uuid.uuid4()
            online = u.get("online", False)
            await db.execute(text(
                "INSERT INTO riders (id, user_id, zone_id, online, vehicle_type) "
                "VALUES (:id, :uid, :zone, :online, 'motorcycle')"
            ), {"id": str(rid), "uid": uid, "zone": str(zone_id), "online": online})
        print("  ✓ Rider profiles created")

        # 6. Hub agents + agent_hubs
        hub_names = ["Hub Central Lagos", "Hub Lekki"]
        hub_emails = ["hub1@avdan.com", "hub2@avdan.com"]
        for email, hub_name in zip(hub_emails, hub_names):
            uid = user_id_map[email]
            hub_id = uuid.uuid4()
            await db.execute(text(
                "INSERT INTO agent_hubs (id, name, zone_id, lat, lng, capacity, active) "
                "VALUES (:id, :name, :zone, 6.5244, 3.3792, 50, true)"
            ), {"id": str(hub_id), "name": hub_name, "zone": str(zone_id)})
        print("  ✓ Agent hubs created")

        await db.commit()

        print("\n✅ Seed complete!")
        print("\nLogin credentials (all passwords: Avdan@2024):")
        print("  admin@avdan.com          — Admin")
        print("  support@avdan.com        — Support")
        print("  vendor1@avdan.com        — TechHub Electronics")
        print("  vendor2@avdan.com        — Fresh Farms Market")
        print("  vendor3@avdan.com        — Style Avenue Fashion")
        print("  vendor4@avdan.com        — HealthPlus Pharmacy")
        print("  vendor5@avdan.com        — Kitchen Masters")
        print("  vendor6@avdan.com        — SportZone NG")
        print("  vendor7@avdan.com        — Baby World Nigeria")
        print("  vendor8@avdan.com        — Bookshelf NG")
        print("  customer1@avdan.com      — Amaka Obi")
        print("  customer2@avdan.com      — Chukwuemeka Eze")
        print("  customer3@avdan.com      — Fatima Abdullahi")
        print("  customer4@avdan.com      — Kelechi Okafor")
        print("  customer5@avdan.com      — Yewande Balogun")
        print("  rider1@avdan.com         — Babatunde Ojo (online)")
        print("  rider2@avdan.com         — Emeka Eze Jr (online)")
        print("  rider3@avdan.com         — Yusuf Garba (offline)")
        print("  rider4@avdan.com         — Nnamdi Okafor (offline)")
        print("  hub1@avdan.com           — Hub Central Lagos agent")
        print("  hub2@avdan.com           — Hub Lekki agent")


if __name__ == "__main__":
    asyncio.run(seed())
