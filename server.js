/**
 * Farmer-Direct Marketplace
 * Express Backend API & MongoDB Interface
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/farmer_direct';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    seedDatabase(); // Seed mockup listings if DB is empty
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
  });

// ==================== SCHEMAS & MODELS ====================

// Listing Schema (Produce catalog)
const ListingSchema = new mongoose.Schema({
  farmerName: { type: String, required: true },
  avatar: { type: String, default: 'assets/images/farmer-1.png' },
  crop: { type: String, required: true },
  quantity: { type: Number, required: true }, // For numeric volume filtering
  quantityDisplay: { type: String, required: true }, // e.g. "1,200 Kg"
  price: { type: String, required: true }, // e.g. "₹140 - ₹160 / Kg"
  location: { type: String, required: true }, // e.g. "Salem", "Erode"
  description: { type: String, default: '' },
  rating: { type: String, default: '5.0' },
  ratingCount: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  phone: { type: String, required: true },
  image: { type: String, default: 'assets/images/hero_bg.png' },
  createdAt: { type: Date, default: Date.now }
});

const Listing = mongoose.model('Listing', ListingSchema);

// Pilot Registration Schema
const RegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  role: { type: String, required: true }, // Farmer, FPO, Buyer, Agent
  location: { type: String, required: true }, // Salem, Erode, etc.
  village: { type: String, required: true },
  message: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Registration = mongoose.model('Registration', RegistrationSchema);

// ==================== REST API ENDPOINTS ====================

// 1. Get Listings (with Search & Filter queries)
// GET /api/listings?crop=onions&location=Salem&quantity=medium
app.get('/api/listings', async (req, res) => {
  try {
    const { crop, location, quantity } = req.query;
    let query = {};

    // Filter by Crop (regex search, case-insensitive)
    if (crop) {
      query.crop = { $regex: crop, $options: 'i' };
    }

    // Filter by Location
    if (location) {
      query.location = location;
    }

    // Filter by Quantity tier
    if (quantity) {
      if (quantity === 'small') {
        query.quantity = { $lt: 500 };
      } else if (quantity === 'medium') {
        query.quantity = { $gte: 500, $lte: 2000 };
      } else if (quantity === 'large') {
        query.quantity = { $gt: 2000 };
      }
    }

    // Return listings sorted by newest first
    const results = await Listing.find(query).sort({ createdAt: -1 });
    res.json(results);
  } catch (error) {
    console.error('Error fetching listings:', error.message);
    res.status(500).json({ error: 'Failed to retrieve listings.' });
  }
});

// 2. Add New Listing
// POST /api/listings
app.post('/api/listings', async (req, res) => {
  try {
    const {
      farmerName,
      avatar,
      crop,
      quantity,
      quantityDisplay,
      price,
      location,
      description,
      phone,
      image
    } = req.body;

    if (!farmerName || !crop || !quantity || !quantityDisplay || !price || !location || !phone) {
      return res.status(400).json({ error: 'Missing required listing fields.' });
    }

    const newListing = new Listing({
      farmerName,
      avatar,
      crop,
      quantity,
      quantityDisplay,
      price,
      location,
      description,
      phone,
      image,
      verified: true // Seed simulated listing as verified for demo
    });

    const savedListing = await newListing.save();
    res.status(201).json(savedListing);
  } catch (error) {
    console.error('Error saving listing:', error.message);
    res.status(500).json({ error: 'Failed to create produce listing.' });
  }
});

// 3. Register Pilot Participant
// POST /api/registrations
app.post('/api/registrations', async (req, res) => {
  try {
    const { name, phone, email, role, location, village, message } = req.body;

    if (!name || !phone || !role || !location || !village) {
      return res.status(400).json({ error: 'Missing required registration fields.' });
    }

    const newRegistration = new Registration({
      name,
      phone,
      email,
      role,
      location,
      village,
      message
    });

    const savedRegistration = await newRegistration.save();
    res.status(201).json(savedRegistration);
  } catch (error) {
    console.error('Error saving registration:', error.message);
    res.status(500).json({ error: 'Failed to submit registration.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Farmer-Direct backend server is running on port ${PORT}`);
});

// ==================== MOCK DATA SEEDER ====================
async function seedDatabase() {
  try {
    const count = await Listing.countDocuments();
    if (count > 0) {
      console.log('Database already has listings. Skipping seeder.');
      return;
    }

    const MOCK_SEEDS = [
      {
        farmerName: "Thiru R. Selvam",
        avatar: "assets/images/farmer-1.png",
        crop: "Salem Turmeric",
        quantity: 1200,
        quantityDisplay: "1,200 Kg",
        price: "₹140 - ₹160 / Kg",
        location: "Salem",
        description: "GI-Tagged premium quality Salem turmeric. Sun-dried and polished. Low moisture content, rich yellow curcumin (5.2%). Ready for immediate pickup.",
        rating: "4.9",
        ratingCount: 14,
        verified: true,
        phone: "+919845011111",
        image: "assets/images/farmer-1.png"
      },
      {
        farmerName: "Smt. K. Gomathi",
        avatar: "assets/images/farmer-2.png",
        crop: "Onions",
        quantity: 3500,
        quantityDisplay: "3.5 Tonnes",
        price: "₹24 - ₹28 / Kg",
        location: "Erode",
        description: "Bellary Red onions. Well-cured, double-skin quality. Size 55mm+. Harvested last week, stored in ventilated cold structures. Perfect for bulk purchase.",
        rating: "4.8",
        ratingCount: 22,
        verified: true,
        phone: "+919845022222",
        image: "assets/images/farmer-2.png"
      },
      {
        farmerName: "Thiru M. Arumugam",
        avatar: "assets/images/farmer-1.png",
        crop: "Tomatoes",
        quantity: 450,
        quantityDisplay: "450 Kg (18 Crates)",
        price: "₹30 - ₹35 / Kg",
        location: "Dharmapuri",
        description: "Local country tomatoes (Naatu Thakkali) and Hybrid varieties. Firm quality, suitable for hotel kitchens. Geotagged harvest. Daily supplies possible.",
        rating: "4.7",
        ratingCount: 9,
        verified: true,
        phone: "+919845033333",
        image: "assets/images/hero_bg.png"
      },
      {
        farmerName: "Puducherry FPO Cooperative",
        avatar: "assets/images/farmer-2.png",
        crop: "Paddy Rice (Ponni)",
        quantity: 8000,
        quantityDisplay: "8 Tonnes (Bulk bags)",
        price: "₹45 - ₹48 / Kg",
        location: "Puducherry",
        description: "High-grade Ponni raw rice and boiled rice collected from 15 registered farmers in Puducherry cluster. Lab-tested quality, milled and bagged in 25Kg sacs.",
        rating: "4.9",
        ratingCount: 38,
        verified: true,
        phone: "+919845044444",
        image: "assets/images/farmer-2.png"
      },
      {
        farmerName: "Thiru S. Murugan",
        avatar: "assets/images/farmer-1.png",
        crop: "Mangoes (Alphonso)",
        quantity: 1500,
        quantityDisplay: "1,500 Kg",
        price: "₹90 - ₹110 / Kg",
        location: "Salem",
        description: "Salem Alphonso mangoes direct from our orchards in Omalur. Chemical-free natural ripening. Box packing available. Booking open for upcoming harvest.",
        rating: "4.6",
        ratingCount: 7,
        verified: false,
        phone: "+919845055555",
        image: "assets/images/farmer-1.png"
      },
      {
        farmerName: "Smt. A. Lakshmi",
        avatar: "assets/images/farmer-2.png",
        crop: "Potatoes",
        quantity: 2200,
        quantityDisplay: "2.2 Tonnes",
        price: "₹18 - ₹22 / Kg",
        location: "Villupuram",
        description: "Freshly dug table potatoes. Uniform size, zero disease or spots. Stored in red soil. Good starch content, perfect for restaurants and wholesale vendors.",
        rating: "4.8",
        ratingCount: 16,
        verified: true,
        phone: "+919845066666",
        image: "assets/images/hero_bg.png"
      }
    ];

    await Listing.insertMany(MOCK_SEEDS);
    console.log('Seeded database with initial listings successfully.');
  } catch (error) {
    console.error('Failed to seed listings database:', error.message);
  }
}
