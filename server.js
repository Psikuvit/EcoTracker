const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist (for local development)
const uploadsDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static file serving
app.use('/uploads', express.static(uploadsDir));
app.use(express.static('public'));

// MongoDB Connection
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set (length: ' + process.env.MONGODB_URI.length + ')' : 'Not set');
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check if MongoDB URI is available
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  console.error('Available environment variables:', Object.keys(process.env).filter(key => key.includes('MONGO') || key.includes('DB')));
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eco_admin_db';
console.log('Using MongoDB URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials in logs

// Improved connection options for serverless environments
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  maxPoolSize: 10, // Maintain up to 10 socket connections
  bufferMaxEntries: 0, // Disable mongoose buffering
  bufferCommands: false, // Disable mongoose buffering
};

mongoose.connect(mongoUri, mongooseOptions)
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
  console.log('Database name:', mongoose.connection.name);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  console.error('Error details:', err.message);
});

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// MongoDB Schema for Locations
const LocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  imageData: {
    type: String, 
    required: true
  },
  imageMimetype: {
    type: String,
    required: true
  },
  imageUrl: String,
  submittedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  processedBy: String,
  rejectionReason: String
});

const Location = mongoose.model('Location', LocationSchema);

// MongoDB Schema for Users
const UserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 100
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  imageData: {
    type: String,
    required: true
  },
  imageMimetype: {
    type: String,
    required: true
  },
  imageUrl: String,
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', UserSchema);

// Admin key validation endpoint
app.post('/validate-admin-key', (req, res) => {
    try {
        const { key } = req.body;
        const adminKey = process.env.ADMIN_ACCESS_KEY;
        
        if (key === adminKey) {
            res.json({ 
                valid: true, 
                message: 'Access granted' 
            });
        } else {
            res.status(401).json({ 
                valid: false, 
                message: 'Invalid access key' 
            });
        }
    } catch (error) {
        console.error('Key validation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only JPG, PNG, and GIF files are allowed. Received: ${file.originalname} (${file.mimetype})`));
    }
  }
});

// Routes

// Submit a new location
app.post('/api/submit-location', upload.single('image'), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, attempting to connect...');
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eco_admin_db';
      if (!mongoUri || mongoUri === 'undefined') {
        throw new Error('MongoDB URI is not configured properly');
      }
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,
        bufferCommands: false,
      });
    }
    
    const { name, description, link } = req.body;

    // Validate input fields
    if (!name || !description || !link) {
      console.log('Missing required fields:', { name: !!name, description: !!description, link: !!link });
      return res.status(400).json({ error: 'Name, description, and link are required' });
    }

    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'Image file is required' });
    }

    console.log('Creating location with data:', { name, description, link, fileSize: req.file.size, mimetype: req.file.mimetype });

    // Convert image buffer to base64
    const imageBase64 = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${imageBase64}`;

    // Create new location in database
    const newLocation = new Location({
      name,
      description,
      link,
      imageData: imageBase64,
      imageMimetype: req.file.mimetype,
      imageUrl: imageUrl
    });

    console.log('Attempting to save location to database...');
    const savedLocation = await newLocation.save();
    console.log('Location saved successfully:', savedLocation._id);

    res.status(201).json({
      success: true,
      message: 'Location submitted successfully',
      locationId: savedLocation._id,
      data: savedLocation
    });

  } catch (error) {
    console.error('Error submitting location:', error);
    console.error('Error stack:', error.stack);
    
    // Handle specific MongoDB timeout errors
    if (error.message.includes('buffering timed out') || error.message.includes('Server selection timed out')) {
      return res.status(503).json({ error: 'Database connection timeout. Please try again in a moment.' });
    }
    
    res.status(500).json({ error: 'Failed to submit location: ' + error.message });
  }
});

// Get all pending locations (for admin)
app.get('/api/admin/pending-locations', async (req, res) => {
  try {
    const pendingLocations = await Location.find({ status: 'pending' })
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      count: pendingLocations.length,
      data: pendingLocations
    });

  } catch (error) {
    console.error('Error fetching pending locations:', error);
    res.status(500).json({ error: 'Failed to fetch pending locations' });
  }
});

// Get all locations with filtering
app.get('/api/admin/locations', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    if (status) filter.status = status;

    const locations = await Location.find(filter)
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Location.countDocuments(filter);

    res.json({
      success: true,
      data: locations,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Get approved locations for public display
app.get('/api/locations/approved', async (req, res) => {
  try {
    const locations = await Location.find({ status: 'approved' })
      .sort({ processedAt: -1 });

    res.json({
      success: true,
      data: locations
    });

  } catch (error) {
    console.error('Error fetching approved locations:', error);
    res.status(500).json({ error: 'Failed to fetch approved locations' });
  }
});

// Submit a new user to join a location
app.post('/api/submit-user', upload.single('image'), async (req, res) => {
  try {
    const { fullName, age, email, phone, address, locationId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (!locationId) {
      return res.status(400).json({ error: 'Location ID is required' });
    }

    // Check if location exists and is approved
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (location.status !== 'approved') {
      return res.status(400).json({ error: 'Can only join approved locations' });
    }

    // Convert image buffer to base64
    const imageBase64 = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${imageBase64}`;

    // Create new user
    const newUser = new User({
      fullName,
      age,
      email,
      phone,
      address,
      locationId,
      imageData: imageBase64,
      imageMimetype: req.file.mimetype,
      imageUrl: imageUrl
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Successfully joined the location!',
      userId: savedUser._id,
      data: savedUser
    });

  } catch (error) {
    console.error('Error adding user to location:', error);
    res.status(500).json({ error: 'Failed to join location' });
  }
});

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: 'File upload error: ' + error.message });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({ error: error.message });
  }
  
  next(error);
});

// Get all users with location information
app.get('/api/admin/users', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const users = await User.find()
      .populate('locationId', 'name description imageUrl')
      .sort({ joinedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments();

    res.json({
      success: true,
      data: users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get users for a specific location
app.get('/api/location/:locationId/users', async (req, res) => {
  try {
    const { locationId } = req.params;
    
    const users = await User.find({ locationId })
      .populate('locationId', 'name description imageUrl')
      .sort({ joinedAt: -1 });

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Error fetching location users:', error);
    res.status(500).json({ error: 'Failed to fetch location users' });
  }
});





// Approve a location
app.post('/api/admin/approve/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { adminId } = req.body;

    const location = await Location.findById(locationId);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (location.status !== 'pending') {
      return res.status(400).json({ error: 'Location has already been processed' });
    }

    // Update location status
    location.status = 'approved';
    location.processedAt = new Date();
    location.processedBy = adminId || 'admin';

    const updatedLocation = await location.save();

    res.json({
      success: true,
      message: 'Location approved successfully',
      data: updatedLocation
    });

  } catch (error) {
    console.error('Error approving location:', error);
    res.status(500).json({ error: 'Failed to approve location' });
  }
});

// Reject a location
app.post('/api/admin/reject/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { adminId, reason } = req.body;

    const location = await Location.findById(locationId);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (location.status !== 'pending') {
      return res.status(400).json({ error: 'Location has already been processed' });
    }

    // Update location status
    location.status = 'rejected';
    location.processedAt = new Date();
    location.processedBy = adminId || 'admin';
    location.rejectionReason = reason || 'No reason provided';

    const updatedLocation = await location.save();

    res.json({
      success: true,
      message: 'Location rejected',
      data: updatedLocation
    });

  } catch (error) {
    console.error('Error rejecting location:', error);
    res.status(500).json({ error: 'Failed to reject location' });
  }
});

// Get location status
app.get('/api/location-status/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    
    const location = await Location.findById(locationId);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({
      success: true,
      data: {
        id: location._id,
        status: location.status,
        submittedAt: location.submittedAt,
        processedAt: location.processedAt,
        rejectionReason: location.rejectionReason
      }
    });

  } catch (error) {
    console.error('Error fetching request status:', error);
    res.status(500).json({ error: 'Failed to fetch request status' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    mongoConnection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    uploadsDir: uploadsDir
  });
});

// Serve image from database
app.get('/api/image/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const location = await Location.findById(locationId);
    
    if (!location || !location.imageData) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Convert base64 back to buffer
    const imageBuffer = Buffer.from(location.imageData, 'base64');
    
    // Set appropriate headers
    res.set({
      'Content-Type': location.imageMimetype,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });
    
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler - only for API routes, not static files
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use('/validate-admin-key', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Don't add a catch-all 404 handler here for Vercel compatibility

// Start server (only for local development)
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/eco_admin_db'}`);
    console.log(`🌐 External API: ${process.env.EXTERNAL_API_URL || 'https://httpbin.org/post (fallback)'}`);
  });
}

module.exports = app;