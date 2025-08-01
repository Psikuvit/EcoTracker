# Lager Waste Management - Admin System

A complete backend system for handling user applications with image uploads, admin approval workflow, and MongoDB integration.

## Features

- **User Application Submission**: Users can submit applications with profile images and personal information
- **Admin Dashboard**: Complete admin interface for managing applications
- **Image Upload**: Secure file upload with validation (5MB limit, image files only)
- **Approval Workflow**: Admin can approve or reject applications with reasons
- **MongoDB Integration**: Persistent data storage with Mongoose ODM
- **Real-time Statistics**: Dashboard shows total, pending, approved, and rejected applications
- **Responsive Design**: Modern UI that works on all devices

## Setup Instructions

### Prerequisites

1. **Node.js** (v14 or higher)
2. **MongoDB** (local installation or MongoDB Atlas)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up MongoDB**:
   - Install MongoDB locally, or
   - Use MongoDB Atlas (cloud service)
   - Update the connection string in `server.js` or create a `.env` file

3. **Create environment file** (optional):
   ```bash
   # Create .env file
   MONGODB_URI=mongodb://localhost:27017/eco-admin-system
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server**:
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the application**:
   - Main page: `http://localhost:3000`
   - Submit application: `http://localhost:3000/submit.html`
   - Admin dashboard: `http://localhost:3000/admin.html`

## API Endpoints

### User Submission
- **POST** `/submit-user` - Submit user application with image
  - Content-Type: `multipart/form-data`
  - Fields: `image`, `fullName`, `age`, `email`, `phone`, `address`

### Admin Management
- **GET** `/users` - Get all users
- **GET** `/users/pending` - Get pending users only
- **GET** `/users/:userId` - Get specific user details
- **PUT** `/users/:userId/approve` - Approve user application
- **PUT** `/users/:userId/reject` - Reject user application

### File Serving
- **GET** `/uploads/:filename` - Serve uploaded images

### Email (Legacy)
- **POST** `/send-email` - Handle email subscriptions

## Database Schema

### User Model
```javascript
{
  fullName: String (required),
  age: Number (required),
  email: String (required),
  phone: String (required),
  address: String (required),
  imagePath: String (required),
  status: String (enum: ['pending', 'approved', 'rejected']),
  submittedAt: Date (default: now),
  approvedAt: Date,
  approvedBy: String,
  rejectedAt: Date,
  rejectedBy: String,
  rejectionReason: String
}
```

## File Structure

```
eco-main/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── public/
│   ├── copy.html         # Main landing page
│   ├── submit.html       # User application form
│   └── admin.html        # Admin dashboard
├── uploads/              # Uploaded images (created automatically)
└── README.md            # This file
```

## Usage

### For Users
1. Visit the main page
2. Click "Submit Application" or go to `/submit.html`
3. Fill out the form with personal information
4. Upload a profile image (JPG, PNG, GIF, max 5MB)
5. Submit the application
6. Wait for admin approval

### For Admins
1. Go to `/admin.html`
2. View all submitted applications
3. Filter by status (All, Pending, Approved, Rejected)
4. Click "View" to see full details
5. Click "Approve" or "Reject" to manage applications
6. Provide rejection reason if rejecting

## Security Features

- File type validation (images only)
- File size limits (5MB)
- Secure file naming with timestamps
- Input validation and sanitization
- CORS enabled for cross-origin requests

## Error Handling

- Comprehensive error messages
- File upload validation
- Database connection error handling
- Graceful degradation for missing images

## Development

### Adding New Features
1. Update the User schema in `server.js` if needed
2. Add new routes in the Express app
3. Update the admin dashboard UI as needed
4. Test thoroughly before deployment

### Database Migrations
The current schema is simple and doesn't require migrations. For future changes:
1. Update the Mongoose schema
2. Handle existing data appropriately
3. Test with sample data

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**:
   - Ensure MongoDB is running
   - Check connection string in server.js
   - Verify network connectivity

2. **File Upload Issues**:
   - Check uploads directory permissions
   - Verify file size limits
   - Ensure image file types

3. **Admin Dashboard Not Loading**:
   - Check browser console for errors
   - Verify server is running
   - Check network connectivity

### Logs
The server logs all activities to console. Check for:
- Database connection status
- File upload success/failure
- API request/response details
- Error messages

## License

MIT License - feel free to use and modify as needed. 