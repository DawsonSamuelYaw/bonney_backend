// scripts/seedProducts.js - Run this to add sample products to your database
const mongoose = require('mongoose');
require('dotenv').config();

// Make sure this path matches your Product model location
const Product = require('../src/models/Product');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bigbonney');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample products data
const sampleProducts = [
  {
    name: "WAEC Results Checker",
    description: "Check your WAEC results instantly with our reliable and fast checking service. Get your results within seconds.",
    price: 50.00,
    category: "checker",
    stock: 100,
    lowStockThreshold: 10,
    isActive: true,
    features: ["Instant Results", "Reliable Service", "24/7 Available"],
    tags: ["waec", "results", "education"]
  },
  {
    name: "University Admission Form",
    description: "Complete university admission form assistance. We help you fill and submit your application forms correctly.",
    price: 150.00,
    category: "form",
    stock: 50,
    lowStockThreshold: 5,
    isActive: true,
    features: ["Professional Assistance", "Error-free Submission", "Fast Processing"],
    tags: ["university", "admission", "form", "education"]
  },
  {
    name: "Passport Application Form",
    description: "Professional help with passport application forms. We ensure your application is completed correctly and submitted on time.",
    price: 100.00,
    category: "form",
    stock: 0, // Out of stock for testing
    lowStockThreshold: 5,
    isActive: true,
    features: ["Professional Guidance", "Document Verification", "Status Updates"],
    tags: ["passport", "application", "travel", "documents"]
  },
  {
    name: "JAMB Result Checker",
    description: "Check your JAMB UTME results quickly and easily. Get your scores and institution choices verified.",
    price: 30.00,
    category: "checker",
    stock: 200,
    lowStockThreshold: 20,
    isActive: true,
    features: ["Instant Access", "Score Verification", "Institution Matching"],
    tags: ["jamb", "utme", "results", "university"]
  },
  {
    name: "Birth Certificate Processing",
    description: "Fast and reliable birth certificate processing service. Get your official documents processed quickly.",
    price: 200.00,
    category: "form",
    stock: 25,
    lowStockThreshold: 5,
    isActive: true,
    features: ["Fast Processing", "Official Documents", "Secure Service"],
    tags: ["birth certificate", "documents", "official"]
  },
  {
    name: "Document Verification Tool",
    description: "Verify the authenticity of your documents with our advanced verification system.",
    price: 75.00,
    category: "tool",
    stock: 80,
    lowStockThreshold: 10,
    isActive: true,
    features: ["Advanced Verification", "Instant Results", "Multiple Formats"],
    tags: ["verification", "documents", "security"]
  }
];

const seedProducts = async () => {
  try {
    await connectDB();

    // Clear existing products (optional - remove if you want to keep existing data)
    console.log('🗑️ Clearing existing products...');
    await Product.deleteMany({});

    // Insert sample products
    console.log('📦 Adding sample products...');
    const createdProducts = await Product.insertMany(sampleProducts);

    console.log(`✅ Successfully added ${createdProducts.length} products:`);
    createdProducts.forEach(product => {
      console.log(`   - ${product.name} (${product.category}) - GH₵${product.price} - Stock: ${product.stock}`);
    });

    console.log('🎉 Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeder
seedProducts();