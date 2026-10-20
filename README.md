# GovGuide AI - Government Scheme Eligibility Checker

A full-stack web application that helps citizens discover government welfare schemes they may qualify for. Built with React, Vite, FastAPI, and MongoDB (with JSON fallback).

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+) and npm
- Python 3.11+
- MongoDB (optional - falls back to JSON database if not available)

### Installation

1. **Backend Setup:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
```

2. **Frontend Setup:**
```bash
cd frontend
npm install
```

### Running the Application

The application requires both frontend and backend to run simultaneously.

#### Option 1: Manual Start (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
venv\Scripts\activate  # On Windows
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

#### Option 2: Using the provided startup script (Windows)

Run `start.bat` in the project root directory to start both services automatically.

### Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

## 🔐 Demo Credentials

The application includes demo users for testing:

### Citizen Demo:
- **Phone:** +919876543210
- **OTP:** 123456

### Admin Demo:
- **Phone:** +919999999999
- **OTP:** 123456

You can also use the "1-Click Demo Login" buttons on the landing page.

## 📁 Project Structure

```
govguide Ai/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection (MongoDB + JSON fallback)
│   ├── engine.py            # Eligibility calculation engine
│   ├── models.py            # Pydantic models
│   ├── requirements.txt     # Python dependencies
│   ├── routes/              # API route handlers
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── chat.py         # Chatbot endpoints
│   │   ├── schemes.py      # Scheme management
│   │   ├── recommendations.py # Eligibility matching
│   │   └── ...
│   └── data/                # JSON database fallback
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ChatBot.jsx
│   │   │   ├── AuthPage.jsx
│   │   │   └── ...
│   │   ├── App.jsx         # Main application component
│   │   └── main.jsx        # React entry point
│   ├── package.json        # Node dependencies
│   └── vite.config.js      # Vite configuration
└── README.md
```

## 🔧 Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory (see `.env.example`):

```env
MONGODB_URI=mongodb://localhost:27017
DB_NAME=govguide_db
JWT_SECRET=supersecretkeychangeinproduction12345
GEMINI_API_KEY=  # Optional - for AI chatbot features
```

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:8000/api
```

## 🌐 Key Features

### 1. **Smart Eligibility Matching**
- Dynamic questionnaire that adapts to user profile
- Match score calculation for each scheme
- Missing field identification

### 2. **Multi-language Support**
- English, Hindi (हिन्दी), and Tamil (தமிழ்)
- Text and voice interface
- Accessibility features (high contrast, large text)

### 3. **AI Chatbot**
- Natural language queries about schemes
- Voice input/output support
- Adaptive eligibility questioning

### 4. **User Dashboard**
- Personalized scheme recommendations
- Profile management
- Save schemes with reminders
- Notification system

### 5. **Admin Panel**
- Scheme management (CRUD operations)
- User statistics
- Database management

## 🛠️ Available Scripts

### Backend
```bash
# Start development server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run production server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📊 Database

The application uses MongoDB as the primary database but includes a robust JSON fallback for offline/demo scenarios:

- **MongoDB:** Full production database with async operations
- **JSON Fallback:** Local file-based database when MongoDB is unavailable
- **Automatic Seeding:** Demo schemes and users are created on first run

## 🔒 Security Notes

- Demo mode uses hardcoded OTPs for development convenience
- JWT tokens for authentication
- CORS enabled for development
- No real government credentials are stored or processed
- All data remains local in demo mode

## 🧪 Testing the Application

1. **Test Authentication:**
   - Navigate to http://localhost:5173
   - Click "Check My Eligibility" or use demo login buttons
   - Enter demo credentials

2. **Test Eligibility Flow:**
   - Complete user profile
   - View matched schemes
   - Check match scores and eligibility criteria

3. **Test Chatbot:**
   - Navigate to chat section
   - Ask about specific schemes
   - Try voice input/output

4. **Test Admin Panel:**
   - Login with admin credentials
   - Create/edit schemes
   - View user statistics

## 🐛 Troubleshooting

### Backend Issues
- **Module not found errors:** Ensure you're running from the backend directory with virtual environment activated
- **MongoDB connection failed:** The app will automatically fall back to JSON database
- **Port conflicts:** Change the port in the uvicorn command

### Frontend Issues
- **Build errors:** Run `npm install` to ensure dependencies are up to date
- **API connection errors:** Verify backend is running on port 8000
- **Environment variables:** Check `.env` file in frontend directory

## 📝 Development Notes

- The backend uses relative imports (e.g., `from config import settings`) for proper module resolution
- Frontend uses Vite for fast development with HMR
- Both services support hot reload during development
- The database automatically seeds demo data on first run

## 🚀 Production Deployment

For production deployment:

1. **Backend:**
   - Set proper environment variables
   - Use production MongoDB instance
   - Set secure JWT_SECRET
   - Run with `--workers` flag for performance

2. **Frontend:**
   - Run `npm run build`
   - Serve static files with nginx or similar
   - Set proper API_URL environment variable

## 📄 License

This is a demonstration project for educational purposes.

## 🤝 Contributing

This is a demo project. For production use, ensure proper security measures, real authentication, and official government API integrations.
