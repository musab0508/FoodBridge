# 🥗 FoodBridge

> **Connecting Surplus Food with Communities in Need Through AI Logistics, Computer Vision, and Real-Time Routing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.0+-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![React 18](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer_Vision-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org/)

---

## 📖 Overview

Every day, millions of tons of wholesome, edible surplus food from restaurants, event halls, catering services, and supermarkets are discarded into landfills. At the same time, community shelters and food banks operate under intense resource constraints, often struggling to secure fresh meals.

The core bottleneck in food rescue isn't goodwill—**it's logistics, time sensitivity, and trust**:
1. **Perishability**: Hot cooked food spoils quickly and must be redirected within hours.
2. **Quality Assurance**: NGOs need visual confirmation of food freshness before deploying volunteers.
3. **Logistics & Fuel Costs**: Volunteer riders often make inefficient single-stop runs across town.
4. **Safety & Vetting**: Unverified organizations cannot be entrusted with bulk food distribution.

**FoodBridge** solves this end-to-end. By uniting **computer vision image validation**, **exponential urgency decay scoring**, and **multi-stop TSP route optimization**, FoodBridge turns chaotic surplus donations into coordinated, safe, and fuel-efficient rescue missions.

---

## ✨ Key Features

### 🔍 Automated Food Quality & Spoilage Inspector (OpenCV)
- Donors upload food photos directly from the field.
- **Blur Detection**: Uses Laplacian variance ($\sigma^2 = \text{Var}(\nabla^2 I)$) to reject blurry or unidentifiable photos ($\text{threshold} \ge 35.0$).
- **Lighting & Contrast Analysis**: Analyzes pixel intensity distributions to flag overly dark or washed-out images ($30.0 \le \text{Brightness} \le 240.0$).
- Validated uploads receive an **"OpenCV Verified Clean"** quality badge on the live dashboard.

### ⚡ Smart Urgency & Safety Scoring Engine
- Calculates real-time urgency (0–100%) and assigns dynamic risk levels (`NORMAL`, `HIGH`, `CRITICAL`).
- Factored by food perishability weights:
  - **Cooked Meals**: `1.6x` multiplier
  - **Perishables (Dairy / Produce)**: `1.3x` multiplier
  - **Raw Ingredients**: `1.0x` multiplier
  - **Packaged / Non-Perishable**: `0.4x` multiplier
- Features live countdown tickers showing remaining safety shelf-life in real time.

### 🗺️ Multi-Stop Route Optimizer for Volunteers
- Solves the multi-pickup **Traveling Salesperson Problem (TSP)** using geodesic coordinates and AI urgency weightings.
- Enables NGO riders to select multiple claimed donations and calculate the shortest, most fuel-efficient sequence.
- Interactive map visualizer powered by **Leaflet.js** and **OpenStreetMap**, displaying pickup pins and route polylines.

### 🛡️ Verified NGO Trust Gate & Role-Based Access
- Strict gatekeeping: newly registered NGOs default to `is_approved = False`.
- Unapproved NGOs cannot claim food or access routes until verified by an Administrator.
- Tailored dashboards and permissions for three distinct roles:
  - **Donors**: Instant listing creation, photo verification, active rescue tracking.
  - **NGO Volunteers**: Real-time listings sorted by urgency, single-click claims, multi-stop route planner.
  - **Administrators**: Central approval queue, platform metrics, and food rescue analytics.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT 18 FRONTEND (Vite)                        │
│   Tailwind CSS  •  Leaflet Maps  •  Lucide Icons  •  Countdown Timers   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         REST API / JWT Bearer Tokens
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                   DJANGO REST FRAMEWORK BACKEND API                    │
│      Custom Auth  •  SimpleJWT  •  Role Permissions  •  CORS Headers    │
└──────────────┬────────────────────┬────────────────────┬───────────────┘
               │                    │                    │
               ▼                    ▼                    ▼
     ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
     │ AI Urgency Model │ │ OpenCV Inspector │ │  Route Optimizer │
     │  Decay Multipliers│ │ Blur & Lighting  │ │ Geodesic Multi-  │
     │  & Risk Badging  │ │  Quality Checks  │ │    Stop (TSP)    │
     └──────────────────┘ └──────────────────┘ └──────────────────┘
               │                    │                    │
               └────────────────────┼────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   SQLite / Postgres │
                         │   Relational Schema │
                         └─────────────────────┘
```

---

## 📁 Repository Structure

```text
FoodBridge/
├── backend/                  # Django REST API service
│   ├── foodbridge/           # Project settings & URL configuration
│   ├── users/                # Authentication, profiles, and role management
│   ├── donations/            # Donation lifecycle, OpenCV inspector, and route planner
│   ├── manage.py             # Django management entry point
│   ├── seed_data.py          # Demo database seeder
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React + Vite client
│   ├── src/
│   │   ├── components/       # Reusable UI (Navbar, Map visualizer, Timers, Badges)
│   │   ├── context/          # AuthContext for session management
│   │   ├── pages/            # Role dashboards (Donor, NGO, Admin, Route Planner)
│   │   └── services/         # Axios API client
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite dev configuration
└── README.md
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.0` or higher & `npm`

---

### 1️⃣ Backend Setup (Django)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows (Command Prompt)**:
     ```cmd
     python -m venv venv
     venv\Scripts\activate.bat
     ```
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Apply database migrations**:
   ```bash
   python manage.py migrate
   ```

5. **Seed demo data** (Creates sample donors, approved/pending NGOs, and listings):
   ```bash
   python seed_data.py
   ```

6. **Start the API server**:
   ```bash
   python manage.py runserver 8000
   ```
   *The backend API will be live at `http://localhost:8000/`.*

---

### 2️⃣ Frontend Setup (React + Vite)

1. **Open a new terminal and navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   *The application will be live at `http://localhost:3000/`.*

---

## 🔑 Pre-Seeded Demo Accounts

You can immediately explore all role capabilities using the seeded accounts:

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `admin123` | NGO verification queue & platform metrics |
| **Food Donor** | `restaurant_donor` | `donor123` | Post surplus food with OpenCV validation |
| **Approved NGO** | `hope_shelter_ngo` | `ngo123` | Claim donations & plan multi-stop pickup routes |
| **Pending NGO** | `community_kitchen_ngo` | `ngo123` | Test the unapproved NGO gatekeeping flow |

---

## 📡 API Reference Overview

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/` | Public | Register new Donor or NGO account |
| `POST` | `/api/auth/login/` | Public | Authenticate user & issue JWT tokens |
| `POST` | `/api/auth/refresh/` | Public | Refresh expired JWT access token |
| `GET` | `/api/auth/me/` | Authenticated | Fetch current user profile & role |
| `GET` | `/api/donations/` | Authenticated | List all donations (Supports `?sort=urgent`) |
| `POST` | `/api/donations/` | Donor / Admin | Create donation with AI score & OpenCV check |
| `POST` | `/api/donations/inspect-image/` | Authenticated | Analyze photo for blur and lighting quality |
| `POST` | `/api/donations/optimize-route/` | NGO / Admin | Generate multi-stop TSP pickup route |
| `POST` | `/api/donations/{id}/claim/` | Approved NGO | Claim an available donation |
| `POST` | `/api/donations/{id}/update_status/` | Claimed NGO / Admin | Update delivery stage (`IN_TRANSIT`, `DELIVERED`) |
| `GET` | `/api/admin/pending-ngos/` | Admin | List NGOs pending verification |
| `POST` | `/api/admin/ngos/{id}/approve/` | Admin | Approve pending NGO (`is_approved = True`) |
| `POST` | `/api/admin/ngos/{id}/reject/` | Admin | Reject and remove pending application |
| `GET` | `/api/admin/metrics/` | Admin | Platform-wide rescue metrics & risk analytics |

---

## 🔄 How It Works: The Rescue Lifecycle

```text
  ┌────────────────────────────────────────────────────────┐
  │ 1. DONOR LISTS SURPLUS FOOD                            │
  │    Donor enters quantity, food category, and expiry    │
  └──────────────────────────┬─────────────────────────────┘
                             │
  ┌──────────────────────────▼─────────────────────────────┐
  │ 2. OPENCV & AI VALIDATION                              │
  │    Image inspected for blur/lighting; Urgency scored   │
  └──────────────────────────┬─────────────────────────────┘
                             │
  ┌──────────────────────────▼─────────────────────────────┐
  │ 3. APPROVED NGO DISCOVERY & CLAIM                      │
  │    Verified NGOs filter listings by urgency & claim    │
  └──────────────────────────┬─────────────────────────────┘
                             │
  ┌──────────────────────────▼─────────────────────────────┐
  │ 4. MULTI-STOP ROUTE DISPATCH                           │
  │    Rider selects stops; TSP optimizer plans pickup     │
  └──────────────────────────┬─────────────────────────────┘
                             │
  ┌──────────────────────────▼─────────────────────────────┐
  │ 5. CONFIRMED DELIVERY & AUDIT                          │
  │    Food collected, marked IN_TRANSIT, then DELIVERED   │
  └────────────────────────────────────────────────────────┘
```

---

## 🤝 Contributing

Contributions to FoodBridge are welcome! Whether you are interested in improving route algorithms, training richer food classification models, or polishing the frontend interface:

1. **Fork the Repository**
2. **Create a Feature Branch** (`git checkout -b feature/smart-notification`)
3. **Commit Your Changes** (`git commit -m "Add smart notification service"`)
4. **Push to the Branch** (`git push origin feature/smart-notification`)
5. **Open a Pull Request**

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
