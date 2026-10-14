# Feature Specification: Analytics Dashboard

## 📋 Overview

**Feature ID**: FEAT-001
**Priority**: High
**Complexity**: Medium
**Estimated Effort**: 2 weeks
**Dependencies**: Existing patient, form submission, and encounter data

### Purpose
Provide real-time analytics and insights into patient population, operational metrics, and health outcomes through an interactive dashboard accessible to administrators, physicians, and data analysts.

### Business Value
- **Decision Making**: Data-driven insights for resource allocation
- **Performance Tracking**: Monitor key health indicators and operational efficiency
- **Trend Identification**: Early detection of disease outbreaks or care gaps
- **Reporting**: Automated compliance and performance reports

---

## 👥 User Stories

### As a Hospital Administrator
```
GIVEN I access the analytics dashboard
WHEN I view the patient overview section
THEN I see total patients, growth rate, and demographic breakdowns
  AND I can filter by date range, location, or department
  AND I can export reports as PDF/Excel
```

### As a Physician
```
GIVEN I access the clinical analytics section
WHEN I view disease prevalence data
THEN I see top diagnoses with trends over time
  AND I can drill down into patient cohorts
  AND I see patients requiring follow-up
```

### As a Data Analyst
```
GIVEN I need to generate a monthly report
WHEN I access the dashboard
THEN I can select date ranges, metrics, and filters
  AND I can schedule automated report generation
  AND I receive reports via email at specified intervals
```

---

## 🎨 Dashboard Sections

### 1. Executive Summary (Top Cards)
```
┌─────────────────────────────────────────────────────────┐
│  📊 Total Patients    👥 New This Month   ⚡ Active    │
│      12,458              +342 (15%)        9,234       │
│                                                         │
│  📋 Total Forms      🏥 Encounters        ⚠️ Alerts     │
│      45,230             2,156              23           │
└─────────────────────────────────────────────────────────┘
```

**Metrics**:
- Total registered patients (with growth % vs previous period)
- New patients this week/month/year
- Active patients (submitted form in last 30 days)
- Total form submissions
- Total encounters
- Active alerts requiring attention

### 2. Patient Demographics
```javascript
Visualizations:
├── Age Distribution (Bar Chart)
│   └── Groups: 0-18, 19-35, 36-60, 60+
├── Gender Distribution (Pie Chart)
│   └── Male, Female, Other
├── Geographic Distribution (Map/Table)
│   └── By State/City with patient counts
└── Registration Trends (Line Chart)
    └── Patients registered over time
```

**Filters**:
- Date range picker
- Gender filter
- Age range slider
- Location dropdown
- Active/Inactive toggle

### 3. Clinical Insights
```javascript
Panels:
├── Top 10 Diagnoses (Horizontal Bar Chart)
│   ├── Diagnosis name
│   ├── Patient count
│   └── Trend indicator (↑↓)
├── Risk Distribution (Donut Chart)
│   ├── Low Risk: Green
│   ├── Medium Risk: Yellow
│   ├── High Risk: Orange
│   └── Critical: Red
├── Vital Signs Alerts (Table)
│   ├── Abnormal BP readings
│   ├── Abnormal blood glucose
│   └── Other threshold violations
└── Common Medications (Word Cloud/List)
```

### 4. Operational Metrics
```javascript
Metrics:
├── Form Completion Rate (%)
│   └── Completed vs Started submissions
├── Average Response Time
│   └── Time from form assignment to completion
├── Department Activity (Table)
│   ├── OPD visits
│   ├── IPD admissions
│   ├── Home care assessments
│   └── Specialty consultations
└── User Activity (Table)
    ├── Forms created by user
    ├── Submissions per user
    └── Last active timestamp
```

### 5. Trends & Predictions
```javascript
Visualizations:
├── Patient Growth Forecast (Line Chart with projection)
├── Seasonal Patterns (Heatmap)
│   └── Visits by month/day of week
├── Form Usage Trends (Stacked Area Chart)
│   └── Different form types over time
└── Care Gap Analysis
    ├── Patients overdue for screenings
    ├── Pending follow-ups
    └── Incomplete care protocols
```

---

## 🗄️ Database Schema

### New Tables

```sql
-- Store dashboard configurations per user
CREATE TABLE dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_name VARCHAR(255) NOT NULL,
    layout JSONB NOT NULL, -- Widget positions and sizes
    filters JSONB, -- Default filters
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, config_name)
);

-- Store scheduled reports
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'analytics', 'patient_list', 'cohort'
    filters JSONB, -- Report parameters
    schedule VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
    recipients TEXT[], -- Email addresses
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cache analytics results for performance
CREATE TABLE analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    filters JSONB,
    result JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_analytics_cache_key ON analytics_cache(cache_key);
CREATE INDEX idx_analytics_cache_expires ON analytics_cache(expires_at);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run) WHERE is_active = TRUE;
```

---

## 🔌 API Endpoints

### 1. Dashboard Metrics

**GET /api/analytics/dashboard**
```javascript
Request:
{
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  filters: {
    gender: "Male",
    age_range: [30, 60],
    location: "Ranchi"
  }
}

Response:
{
  summary: {
    total_patients: 12458,
    new_patients: 342,
    growth_rate: 15.2,
    active_patients: 9234,
    total_forms: 45230,
    total_encounters: 2156,
    active_alerts: 23
  },
  demographics: {
    age_distribution: [
      { range: "0-18", count: 2345, percentage: 18.8 },
      { range: "19-35", count: 4567, percentage: 36.7 },
      { range: "36-60", count: 3890, percentage: 31.2 },
      { range: "60+", count: 1656, percentage: 13.3 }
    ],
    gender_distribution: [
      { gender: "Male", count: 6543, percentage: 52.5 },
      { gender: "Female", count: 5789, percentage: 46.5 },
      { gender: "Other", count: 126, percentage: 1.0 }
    ],
    location_distribution: [
      { state: "Jharkhand", city: "Ranchi", count: 8234 },
      { state: "Bihar", city: "Patna", count: 2156 }
    ]
  },
  clinical_insights: {
    top_diagnoses: [
      { name: "Diabetes Mellitus Type 2", count: 1234, trend: "up" },
      { name: "Hypertension", count: 1123, trend: "stable" },
      { name: "Asthma", count: 876, trend: "down" }
    ],
    risk_distribution: {
      low: 7234,
      medium: 3456,
      high: 1234,
      critical: 534
    }
  },
  trends: {
    registration_over_time: [
      { month: "2024-01", count: 234 },
      { month: "2024-02", count: 312 },
      { month: "2024-03", count: 289 }
    ],
    form_completion_rate: 87.3,
    average_response_time_hours: 4.2
  }
}
```

### 2. Cohort Analysis

**POST /api/analytics/cohorts**
```javascript
Request:
{
  name: "Diabetic Patients Needing Follow-up",
  criteria: {
    diagnosis: "Diabetes",
    age_range: [40, 70],
    last_visit_before: "2024-01-01",
    risk_level: ["medium", "high"]
  },
  save: true
}

Response:
{
  cohort_id: "uuid",
  name: "Diabetic Patients Needing Follow-up",
  patient_count: 234,
  patients: [
    {
      id: "uuid",
      full_name: "John Doe",
      age: 55,
      gender: "Male",
      last_visit: "2023-12-15",
      risk_level: "medium",
      diagnosis: ["Diabetes Type 2", "Hypertension"]
    }
  ],
  summary: {
    avg_age: 58.3,
    gender_split: { male: 134, female: 100 },
    avg_days_since_visit: 45
  }
}
```

### 3. Export Report

**POST /api/analytics/export**
```javascript
Request:
{
  report_type: "patient_demographics",
  format: "pdf", // or "excel", "csv"
  filters: {
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    include_charts: true
  },
  email_to: "admin@hospital.com"
}

Response:
{
  job_id: "uuid",
  status: "processing",
  estimated_completion: "2024-03-01T10:05:00Z",
  download_url: null // Populated when complete
}
```

### 4. Schedule Report

**POST /api/analytics/schedule**
```javascript
Request:
{
  report_name: "Monthly Patient Summary",
  report_type: "analytics",
  schedule: "monthly", // daily, weekly, monthly
  day_of_month: 1, // For monthly
  time: "09:00",
  recipients: ["admin@hospital.com", "ceo@hospital.com"],
  filters: {
    include_sections: ["summary", "demographics", "clinical"]
  }
}

Response:
{
  schedule_id: "uuid",
  next_run: "2024-04-01T09:00:00Z",
  status: "active"
}
```

---

## 🎨 Frontend Components

### Component Structure
```
src/pages/analytics/
├── AnalyticsDashboard.jsx          # Main dashboard page
├── components/
│   ├── SummaryCards.jsx            # Top metric cards
│   ├── DemographicsPanel.jsx       # Age/gender/location charts
│   ├── ClinicalInsights.jsx        # Diagnoses, risk, vitals
│   ├── TrendsPanel.jsx             # Time-series visualizations
│   ├── FilterSidebar.jsx           # Date range & filter controls
│   ├── ExportDialog.jsx            # Export configuration modal
│   └── ScheduleReportDialog.jsx   # Schedule report modal
└── hooks/
    ├── useAnalytics.js             # Fetch analytics data
    ├── useCohorts.js               # Cohort management
    └── useExport.js                # Export functionality
```

### Key Component: SummaryCards.jsx
```jsx
import { Users, TrendingUp, FileText, AlertCircle } from 'lucide-react';

export default function SummaryCards({ data, loading }) {
  const cards = [
    {
      title: 'Total Patients',
      value: data?.summary?.total_patients || 0,
      change: `+${data?.summary?.growth_rate || 0}%`,
      icon: Users,
      color: 'blue'
    },
    {
      title: 'New This Month',
      value: data?.summary?.new_patients || 0,
      change: 'vs last month',
      icon: TrendingUp,
      color: 'green'
    },
    {
      title: 'Form Submissions',
      value: data?.summary?.total_forms || 0,
      change: `${data?.trends?.form_completion_rate || 0}% complete`,
      icon: FileText,
      color: 'purple'
    },
    {
      title: 'Active Alerts',
      value: data?.summary?.active_alerts || 0,
      change: 'require attention',
      icon: AlertCircle,
      color: 'red'
    }
  ];

  if (loading) {
    return <CardsSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <Card key={idx} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{card.title}</p>
              <h3 className="text-3xl font-bold mt-2">{card.value.toLocaleString()}</h3>
              <p className="text-xs text-gray-500 mt-1">{card.change}</p>
            </div>
            <div className={`p-3 bg-${card.color}-100 rounded-lg`}>
              <card.icon className={`w-8 h-8 text-${card.color}-600`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### Chart Library
Use **Recharts** for React-friendly, responsive charts:

```bash
npm install recharts
```

```jsx
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Example: Age Distribution Bar Chart
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={ageDistribution}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="range" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="count" fill="#3b82f6" />
  </BarChart>
</ResponsiveContainer>
```

---

## 🔧 Backend Implementation

### Analytics Service
```python
# backend/app/analytics/services.py
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from app.models import Patient, FormSubmission, Encounter, Diagnosis
from app.extensions import db

class AnalyticsService:

    @staticmethod
    def get_dashboard_metrics(start_date=None, end_date=None, filters=None):
        """Get comprehensive dashboard metrics"""

        # Summary metrics
        total_patients = Patient.query.filter(Patient.is_active == True).count()

        # New patients this month
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
        new_patients = Patient.query.filter(
            Patient.created_at >= month_start
        ).count()

        # Calculate growth rate
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        last_month_patients = Patient.query.filter(
            Patient.created_at >= last_month_start,
            Patient.created_at < month_start
        ).count()
        growth_rate = ((new_patients - last_month_patients) / last_month_patients * 100) if last_month_patients > 0 else 0

        # Active patients (submitted form in last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_patients = db.session.query(func.count(func.distinct(FormSubmission.patient_id))).filter(
            FormSubmission.created_at >= thirty_days_ago
        ).scalar()

        # Demographics
        age_distribution = AnalyticsService._get_age_distribution()
        gender_distribution = AnalyticsService._get_gender_distribution()
        location_distribution = AnalyticsService._get_location_distribution()

        # Clinical insights
        top_diagnoses = AnalyticsService._get_top_diagnoses(limit=10)

        # Trends
        registration_trends = AnalyticsService._get_registration_trends()

        return {
            'summary': {
                'total_patients': total_patients,
                'new_patients': new_patients,
                'growth_rate': round(growth_rate, 1),
                'active_patients': active_patients,
                'total_forms': FormSubmission.query.count(),
                'total_encounters': Encounter.query.count(),
                'active_alerts': 0  # TODO: Implement alerts
            },
            'demographics': {
                'age_distribution': age_distribution,
                'gender_distribution': gender_distribution,
                'location_distribution': location_distribution
            },
            'clinical_insights': {
                'top_diagnoses': top_diagnoses
            },
            'trends': {
                'registration_over_time': registration_trends
            }
        }

    @staticmethod
    def _get_age_distribution():
        """Calculate age distribution by age groups"""
        from datetime import date

        patients = Patient.query.filter(
            Patient.is_active == True,
            Patient.date_of_birth != None
        ).all()

        age_groups = {
            '0-18': 0,
            '19-35': 0,
            '36-60': 0,
            '60+': 0
        }

        for patient in patients:
            age = (date.today() - patient.date_of_birth).days // 365
            if age <= 18:
                age_groups['0-18'] += 1
            elif age <= 35:
                age_groups['19-35'] += 1
            elif age <= 60:
                age_groups['36-60'] += 1
            else:
                age_groups['60+'] += 1

        total = sum(age_groups.values())
        return [
            {
                'range': range_name,
                'count': count,
                'percentage': round(count / total * 100, 1) if total > 0 else 0
            }
            for range_name, count in age_groups.items()
        ]

    @staticmethod
    def _get_gender_distribution():
        """Calculate gender distribution"""
        result = db.session.query(
            Patient.gender,
            func.count(Patient.id).label('count')
        ).filter(
            Patient.is_active == True,
            Patient.gender != None
        ).group_by(Patient.gender).all()

        total = sum(r.count for r in result)
        return [
            {
                'gender': r.gender,
                'count': r.count,
                'percentage': round(r.count / total * 100, 1) if total > 0 else 0
            }
            for r in result
        ]

    @staticmethod
    def _get_registration_trends(months=12):
        """Get patient registration trends over time"""
        from sqlalchemy import text

        query = text("""
            SELECT
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as count
            FROM patients
            WHERE created_at >= NOW() - INTERVAL ':months months'
            GROUP BY month
            ORDER BY month
        """)

        result = db.session.execute(query, {'months': months})

        return [
            {
                'month': row.month.strftime('%Y-%m'),
                'count': row.count
            }
            for row in result
        ]
```

### Analytics Routes
```python
# backend/app/analytics/routes.py
from flask import Blueprint, request, jsonify
from app.analytics.services import AnalyticsService
from app.middleware.auth import require_auth

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')

@analytics_bp.route('/dashboard', methods=['GET'])
@require_auth
def get_dashboard():
    """Get dashboard metrics"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    filters = request.args.get('filters')

    try:
        data = AnalyticsService.get_dashboard_metrics(
            start_date=start_date,
            end_date=end_date,
            filters=filters
        )
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/cohorts', methods=['POST'])
@require_auth
def create_cohort():
    """Create patient cohort based on criteria"""
    # Implementation here
    pass

@analytics_bp.route('/export', methods=['POST'])
@require_auth
def export_report():
    """Export analytics report"""
    # Implementation here
    pass
```

---

## 🧪 Testing Strategy

### Unit Tests
```python
# tests/test_analytics.py
import pytest
from app.analytics.services import AnalyticsService
from datetime import datetime, timedelta

def test_get_dashboard_metrics(test_db, sample_patients):
    """Test dashboard metrics calculation"""
    metrics = AnalyticsService.get_dashboard_metrics()

    assert metrics['summary']['total_patients'] > 0
    assert 'demographics' in metrics
    assert len(metrics['demographics']['age_distribution']) == 4

def test_age_distribution_calculation(test_db, sample_patients):
    """Test age distribution grouping"""
    distribution = AnalyticsService._get_age_distribution()

    age_ranges = [d['range'] for d in distribution]
    assert '0-18' in age_ranges
    assert '19-35' in age_ranges

    total_percentage = sum(d['percentage'] for d in distribution)
    assert abs(total_percentage - 100) < 1  # Should sum to ~100%
```

### Integration Tests
```python
def test_dashboard_endpoint(client, auth_token):
    """Test dashboard API endpoint"""
    response = client.get(
        '/api/analytics/dashboard',
        headers={'Authorization': f'Bearer {auth_token}'}
    )

    assert response.status_code == 200
    data = response.json
    assert 'summary' in data
    assert 'demographics' in data
```

---

## 🔐 Security & Performance

### Security
- **Role-Based Access**: Only admins/physicians can access analytics
- **Data Masking**: Sensitive patient data masked in exports
- **Audit Logging**: Log all analytics access and exports
- **Rate Limiting**: Prevent abuse of export functionality

### Performance Optimization
```python
# Cache expensive queries
from flask_caching import Cache
cache = Cache(config={'CACHE_TYPE': 'redis'})

@cache.memoize(timeout=300)  # Cache for 5 minutes
def get_dashboard_metrics():
    # Expensive computation
    pass

# Database indexes
CREATE INDEX idx_patients_created_at ON patients(created_at);
CREATE INDEX idx_patients_is_active ON patients(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_submissions_created_at ON form_submissions(created_at);
CREATE INDEX idx_submissions_patient_id ON form_submissions(patient_id);
```

---

## 📅 Implementation Timeline

### Week 1: Backend Foundation
- Day 1-2: Database schema + migrations
- Day 3-4: Analytics service (summary metrics)
- Day 5: Analytics routes + tests

### Week 2: Frontend + Advanced Features
- Day 1-2: Dashboard page + summary cards
- Day 3-4: Charts and visualizations
- Day 5: Export functionality
- Weekend: Testing + documentation

---

## ✅ Acceptance Criteria

- [ ] Dashboard loads in < 2 seconds
- [ ] All charts render correctly on mobile/desktop
- [ ] Export to PDF/Excel works
- [ ] Filters apply correctly to all metrics
- [ ] Cached results refresh appropriately
- [ ] Unit test coverage > 80%
- [ ] Security audit passed
- [ ] Stakeholder demo approved

---

## 🔄 Future Enhancements

- Real-time updates via WebSocket
- Custom dashboard layouts (drag-and-drop widgets)
- Predictive analytics (ML models)
- Benchmarking against industry standards
- Multi-language support
- Voice-activated queries
