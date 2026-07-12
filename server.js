/**
 * Farmer-Direct Marketplace
 * Express Backend API & MongoDB Interface
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Supabase stores columns as snake_case (farmer_name, quantity_display, ...)
// but the frontend (and the Mongoose model) expect camelCase. Normalize here
// so the API always returns the same shape regardless of which DB served it.
// Also guards against missing/null values so clients never receive
// "undefined" for farmerName or quantityDisplay.
function isEmptyValue(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function firstDefined(...values) {
  return values.find(v => !isEmptyValue(v));
}

function normalizeListing(row) {
  if (!row) return row;

  const farmerName = firstDefined(row.farmer_name, row.farmerName, row.name) || 'Not available';

  const quantityDisplay = firstDefined(
    row.quantity_display,
    row.quantityDisplay,
    row.availability,
    row.availability_display,
    !isEmptyValue(row.quantity) ? `${row.quantity} Kg` : undefined
  ) || 'Not available';

  return {
    id: row.id || row._id,
    farmerName,
    avatar: row.avatar,
    crop: row.crop,
    quantity: row.quantity,
    quantityDisplay,
    price: row.price,
    location: row.location,
    address: row.address ?? row.village ?? '',
    description: row.description,
    rating: row.rating,
    ratingCount: row.rating_count ?? row.ratingCount ?? 0,
    verified: row.verified,
    phone: row.phone,
    altPhone: row.alt_phone ?? row.altPhone ?? '',
    email: row.email ?? '',
    image: row.image,
    createdAt: row.created_at ?? row.createdAt
  };
}

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/farmer_direct';

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 })
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    seedDatabase(); // Seed mockup listings if DB is empty
  })
  .catch(err => {
    console.warn('MongoDB not available; continuing without it.', err.message);
  });

// ==================== SCHEMAS & MODELS ====================

// Listing Schema (Produce catalog + full farmer profile)
const ListingSchema = new mongoose.Schema({
  farmerName: { type: String, required: true },
  avatar: { type: String, default: 'assets/images/farmer-1.png' },
  crop: { type: String, required: true },
  quantity: { type: Number, required: true }, // For numeric volume filtering
  quantityDisplay: { type: String, required: true }, // e.g. "1,200 Kg"
  price: { type: String, required: true }, // e.g. "₹140 - ₹160 / Kg"
  location: { type: String, required: true }, // e.g. "Salem", "Erode" (district)
  address: { type: String, default: '' }, // Full village / street address
  description: { type: String, default: '' },
  rating: { type: String, default: '5.0' },
  ratingCount: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  phone: { type: String, required: true },
  altPhone: { type: String, default: '' }, // Alternate contact number
  email: { type: String, default: '' },
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

app.get('/api/health', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: 'Supabase is not configured.' });
  }

  try {
    const { data, error } = await supabase.from('listings').select('id').limit(1);
    if (error) {
      return res.status(500).json({ ok: false, message: error.message, details: 'Create the public.listings table in Supabase to enable persistence.' });
    }
    res.json({ ok: true, message: 'Supabase connected.', sample: data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// 1. Get Listings (with Search & Filter queries)
// GET /api/listings?crop=onions&location=Salem&quantity=medium
app.get('/api/listings', async (req, res) => {
  try {
    const { crop, location, quantity } = req.query;

    if (supabase) {
      let query = supabase.from('listings').select('*').order('created_at', { ascending: false });

      if (crop) {
        query = query.ilike('crop', `%${crop}%`);
      }

      if (location) {
        query = query.eq('location', location);
      }

      if (quantity) {
        if (quantity === 'small') {
          query = query.lt('quantity', 500);
        } else if (quantity === 'medium') {
          query = query.gte('quantity', 500).lte('quantity', 2000);
        } else if (quantity === 'large') {
          query = query.gt('quantity', 2000);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.json((data || []).map(normalizeListing));
    }

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
      address,
      description,
      phone,
      altPhone,
      email,
      image
    } = req.body;

    if (!farmerName || !crop || !quantity || !quantityDisplay || !price || !location || !phone) {
      return res.status(400).json({ error: 'Missing required listing fields.' });
    }

    if (supabase) {
      const { data, error } = await supabase.from('listings').insert([{ 
        farmer_name: farmerName,
        avatar,
        crop,
        quantity,
        quantity_display: quantityDisplay,
        price,
        location,
        address,
        description,
        phone,
        alt_phone: altPhone,
        email,
        image,
        verified: true,
        rating: '5.0',
        rating_count: 0
      }]).select().single();

      if (error) throw error;
      return res.status(201).json(normalizeListing(data));
    }

    const newListing = new Listing({
      farmerName,
      avatar,
      crop,
      quantity,
      quantityDisplay,
      price,
      location,
      address,
      description,
      phone,
      altPhone,
      email,
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

    if (supabase) {
      const { data, error } = await supabase.from('registrations').insert([{ 
        name,
        phone,
        email,
        role,
        location,
        village,
        message
      }]).select().single();

      if (error) throw error;
      return res.status(201).json(data);
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
        address: "24, Kovil Street, Omalur, Salem",
        description: "GI-Tagged premium quality Salem turmeric. Sun-dried and polished. Low moisture content, rich yellow curcumin (5.2%). Ready for immediate pickup.",
        rating: "4.9",
        ratingCount: 14,
        verified: true,
        phone: "+919845011111",
        altPhone: "+919845011112",
        email: "selvam.turmeric@example.com",
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
        address: "7, Periyar Nagar, Gobichettipalayam, Erode",
        description: "Bellary Red onions. Well-cured, double-skin quality. Size 55mm+. Harvested last week, stored in ventilated cold structures. Perfect for bulk purchase.",
        rating: "4.8",
        ratingCount: 22,
        verified: true,
        phone: "+919845022222",
        altPhone: "",
        email: "gomathi.farms@example.com",
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
        address: "Near Bus Stand, Pappireddipatti, Dharmapuri",
        description: "Local country tomatoes (Naatu Thakkali) and Hybrid varieties. Firm quality, suitable for hotel kitchens. Geotagged harvest. Daily supplies possible.",
        rating: "4.7",
        ratingCount: 9,
        verified: true,
        phone: "+919845033333",
        altPhone: "+919845033334",
        email: "",
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
        address: "FPO Office, Villianur Main Road, Puducherry",
        description: "High-grade Ponni raw rice and boiled rice collected from 15 registered farmers in Puducherry cluster. Lab-tested quality, milled and bagged in 25Kg sacs.",
        rating: "4.9",
        ratingCount: 38,
        verified: true,
        phone: "+919845044444",
        altPhone: "+919845044445",
        email: "contact@puducherryfpo.example.com",
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
        address: "Orchard Road, Omalur, Salem",
        description: "Salem Alphonso mangoes direct from our orchards in Omalur. Chemical-free natural ripening. Box packing available. Booking open for upcoming harvest.",
        rating: "4.6",
        ratingCount: 7,
        verified: false,
        phone: "+919845055555",
        altPhone: "",
        email: "",
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
        address: "14, Anna Nagar, Tindivanam, Villupuram",
        description: "Freshly dug table potatoes. Uniform size, zero disease or spots. Stored in red soil. Good starch content, perfect for restaurants and wholesale vendors.",
        rating: "4.8",
        ratingCount: 16,
        verified: true,
        phone: "+919845066666",
        altPhone: "+919845066667",
        email: "lakshmi.potatoes@example.com",
        image: "assets/images/hero_bg.png"
      }
    ];

    await Listing.insertMany(MOCK_SEEDS);
    console.log('Seeded database with initial listings successfully.');
  } catch (error) {
    console.error('Failed to seed listings database:', error.message);
  }
}
