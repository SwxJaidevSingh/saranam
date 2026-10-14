# CV Raman Health Care - Dynamic Form Builder System

A practical healthcare data collection and reporting system with dynamic form builder capabilities.

## 🚀 Features

- **Dynamic Form Builder**: Create custom forms with various field types (text, number, date, select)
- **Role-Based Access Control**: Three user roles (Admin, Data Entry, Viewer) with specific permissions
- **Form Submissions**: Collect and manage data through dynamic forms
- **Analytics Dashboard**: View aggregated data with SUM, COUNT operations
- **Data Export**: Export submissions in JSON or CSV format
- **JWT Authentication**: Secure API with token-based authentication
- **Responsive UI**: Mobile-friendly interface built with React

## 🛠 Tech Stack

### Backend
- Flask (Python 3.9+)
- SQLAlchemy ORM
- PostgreSQL (Supabase)
- JWT Authentication
- Marshmallow for validation

### Frontend
- React 18 with Vite
- React Router for navigation
- Axios for API calls
- Recharts for data visualization
- Lucide React for icons
- CSS with Tailwind classes

## 📁 Project Structure

```
cv-raman-health/
├── backend/
│   ├── app/
│   │   ├── auth/         # Authentication module
│   │   ├── forms/        # Forms management
│   │   ├── submissions/  # Data submissions
│   │   ├── analytics/    # Analytics and reports
│   │   └── common/       # Shared utilities
│   ├── requirements.txt
│   └── run.py           # Application entry point
│
└── frontend/
    ├── src/
    │   ├── api/         # API client modules
    │   ├── components/  # React components
    │   ├── context/     # React contexts
    │   └── pages/       # Page components
    └── package.json
```

## 🚦 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL (or Supabase account)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file from example:
```bash
cp .env.example .env
```

5. Update `.env` with your database credentials:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/cv_raman_health
JWT_SECRET_KEY=your-secret-key-here
```

6. Initialize database:
```bash
flask init-db
flask seed-db
```

7. Run the backend server:
```bash
python run.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

4. Run the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## 👤 Default Users

After running `flask seed-db`, these users will be available:

- **Admin**: admin@cvraman.health / Admin@123
- **Data Entry**: dataentry@cvraman.health / DataEntry@123
- **Viewer**: viewer@cvraman.health / Viewer@123

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Forms
- `GET /api/forms` - List all forms
- `POST /api/forms` - Create new form (Admin only)
- `GET /api/forms/{id}` - Get form details
- `PUT /api/forms/{id}` - Update form (Admin only)
- `DELETE /api/forms/{id}` - Delete form (Admin only)

### Submissions
- `GET /api/submissions` - List submissions
- `POST /api/submissions` - Create submission
- `GET /api/submissions/{id}` - Get submission
- `PUT /api/submissions/{id}` - Update submission
- `GET /api/submissions/export` - Export data

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/forms/{id}` - Form analytics
- `GET /api/analytics/reports/user-activity` - User activity report
- `GET /api/analytics/reports/form-comparison` - Form comparison

## 🔐 Role Permissions

| Permission | Admin | Data Entry | Viewer |
|------------|-------|------------|---------|
| Create Forms | ✅ | ❌ | ❌ |
| Edit Forms | ✅ | ❌ | ❌ |
| Delete Forms | ✅ | ❌ | ❌ |
| View Forms | ✅ | ✅ | ✅ |
| Submit Forms | ✅ | ✅ | ❌ |
| View Submissions | ✅ | ✅* | ✅ |
| View Analytics | ✅ | ❌ | ✅ |
| Manage Users | ✅ | ❌ | ❌ |

*Data Entry users can only view their own submissions

## 📝 Form Schema Structure

Forms are stored as JSON schema in the database:

```json
{
  "fields": [
    {
      "id": "patient_name",
      "type": "text",
      "label": "Patient Name",
      "required": true,
      "validation": {
        "maxLength": 100
      }
    },
    {
      "id": "age",
      "type": "number",
      "label": "Age",
      "required": true,
      "validation": {
        "min": 0,
        "max": 150
      }
    },
    {
      "id": "department",
      "type": "select",
      "label": "Department",
      "options": ["Cardiology", "Neurology", "General"],
      "required": true
    }
  ]
}
```

## 🚀 Production Deployment

### Backend Deployment

1. Update production configuration in `app/config.py`
2. Set environment variables for production
3. Use Gunicorn as WSGI server:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

### Frontend Deployment

1. Build production bundle:
```bash
npm run build
```

2. Deploy the `dist` folder to your static hosting service (Vercel, Netlify, etc.)

### Database Considerations

- Add database indexes for better performance
- Enable connection pooling for production
- Regular backups recommended
- Consider read replicas for analytics queries

## 📈 Scalability

The system is designed to handle:
- 5,000 - 50,000 submissions
- 50 - 200 concurrent users

For scaling beyond these limits:
- Implement caching with Redis
- Use database read replicas
- Add pagination to all list endpoints
- Optimize database queries with proper indexes
- Consider CDN for static assets

## 🐛 Common Issues

1. **CORS Error**: Update `CORS_ORIGINS` in `.env` file
2. **Database Connection**: Check `DATABASE_URL` format
3. **JWT Errors**: Ensure `JWT_SECRET_KEY` is set
4. **Port Already in Use**: Change port in `run.py` or `vite.config.js`

## 📄 License

This project is proprietary software for CV Raman Health Care.

## 🤝 Support

For issues or questions, please contact the development team.# CVRAMAN
