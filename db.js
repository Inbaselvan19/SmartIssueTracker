const mongoose = require('mongoose');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

async function initDB() {
    console.log('🔧 Connecting to MongoDB Atlas...');
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartconnect_db';
        await mongoose.connect(uri);
        console.log('✅ MongoDB connected successfully.');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

const citizenSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    address: { type: String },
    password_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

const officialSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    department_id: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    password_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

const problemSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    citizen_id: { type: String, required: true, index: true },
    department: { type: String, required: true },
    priority: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    lat: { type: Number, default: null },  // GPS latitude from map picker
    lng: { type: Number, default: null },  // GPS longitude from map picker
    status: { type: String, default: 'pending' },
    assigned_to: { type: String },
    image_data: { type: String },
    proof_image: { type: String },
    feedback: { type: String },
    rating: { type: Number, min: 1, max: 5, default: null },
    date_reported: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    report_count: { type: Number, default: 1 },
    reporters: { type: [String], default: [] }
});

const otpSchema = new mongoose.Schema({
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) } // 10 minutes
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Citizen = mongoose.model('Citizen', citizenSchema);
const Official = mongoose.model('Official', officialSchema);
const Problem = mongoose.model('Problem', problemSchema);
const Otp = mongoose.model('Otp', otpSchema);

module.exports = { initDB, Citizen, Official, Problem, Otp };
