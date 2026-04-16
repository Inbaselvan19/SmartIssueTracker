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
    status: { type: String, default: 'pending' },
    assigned_to: { type: String },
    image_data: { type: String },
    proof_image: { type: String },
    feedback: { type: String },
    date_reported: { type: Date, default: Date.now }
});

const Citizen = mongoose.model('Citizen', citizenSchema);
const Official = mongoose.model('Official', officialSchema);
const Problem = mongoose.model('Problem', problemSchema);

module.exports = { initDB, Citizen, Official, Problem };
