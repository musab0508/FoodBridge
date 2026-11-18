# 🥗 FoodBridge

> **Real-Time Intelligent Food Rescue and Redistribution Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Django 5.0+](https://img.shields.io/badge/Django-5.0+-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.14+-red?logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React 18](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 5](https://img.shields.io/badge/Vite-5.0+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer_Vision-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-GIS_Mapping-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)

---

## 📌 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Core Features](#-core-features)
  - [1. Cryptographic Chain-of-Custody](#1-cryptographic-chain-of-custody)
  - [2. GIS Route Optimization & Spoilage Heatmap](#2-gis-route-optimization--spoilage-heatmap)
  - [3. Conditional OpenCV & AI Urgency Scoring](#3-conditional-opencv--ai-urgency-scoring)
  - [4. Role-Based Access Control (RBAC) & Trust Gate](#4-role-based-access-control-rbac--trust-gate)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Local Installation & Setup Guide](#-local-installation--setup-guide)
  - [Prerequisites](#prerequisites)
  - [Backend Setup (Django & PostgreSQL)](#1-backend-setup)
  - [Database Seeding](#2-database-seeding)
  - [Frontend Setup (React + Vite)](#3-frontend-setup)
- [Pre-Seeded Demo Accounts](#-pre-seeded-demo-accounts)
- [API Reference](#-api-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Contributing & License](#-contributing--license)

---

## 📖 Overview

Every day, commercial kitchens, restaurants, banquets, and grocery outlets generate high-quality surplus food that is prematurely discarded due to compressed consumption windows. Concurrently, community shelters and food relief NGOs operate under persistent resource constraints, struggling with the high fuel costs and latency of uncoordinated pickups.

**FoodBridge** is an enterprise-grade, open-source food logistics platform engineered to close this gap. By combining **automated computer vision vetting**, **spatial-temporal GIS routing**, **exponential shelf-life decay modeling**, and **cryptographic proof-of-handoff**, FoodBridge transforms fragmented surplus food donations into efficient, safe, and verifiable food rescue missions.

### Key Objectives
- **Zero Hunger & Waste Reduction (UN SDG 12.3 & 2):** Connect excess edible meals to vulnerable populations before quality deteriorates.
- **Sub-300ms Donation Publishing:** High-speed heuristic scoring and singleton OpenCV processing ensure donors can post surplus food in seconds.
- **Non-Repudiable Handoffs:** Eliminate phantom collections and misplaced donations via two-way cryptographic verification.
- **Optimized Volunteer Transit:** Minimize transport emissions and volunteer transit time using multi-stop TSP route planning.

---

## 🏗️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT 18 CLIENT (Vite)                          │
│   Tailwind CSS  •  Leaflet GIS Maps  •  Lucide UI  •  Countdown Tickers │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         REST API / JWT Bearer Tokens
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    DJANGO REST FRAMEWORK BACKEND                       │
│    SimpleJWT Auth  •  CORS Interceptors  •  Role Permissions (RBAC)   │
└──────────────┬────────────────────┬────────────────────┬───────────────┘
               │                    │                    │
               ▼                    ▼                    ▼
     ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
     │ OpenCV Inspector │ │ AI Urgency Model │ │  GIS Route Engine│
     │  Laplacian Blur  │ │  Perishability   │ │ Haversine Metric │
     │  & Luminance CV  │ │  Decay Curves    │ │ TSP Multi-Stop   │
     └──────────────────┘ └──────────────────┘ └──────────────────┘
               │                    │                    │
               └────────────────────┼────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │     PostgreSQL      │
                         │  Relational Storage │
                         └─────────────────────┘
```

---

## ✨ Core Features

### 1. Cryptographic Chain-of-Custody
To ensure zero fraud, audit compliance, and non-repudiable transfer of custody:
- **4-Digit Verification PIN:** Automatically generated upon donation claim and issued exclusively to the donor and active rescuer.
- **SHA-256 Cryptographic Token:** A unique hash computed dynamically:
  $$\text{crypto\_token} = \text{SHA256}(\text{donation\_id} \parallel \text{claimed\_by\_id} \parallel \text{timestamp} \parallel \text{handoff\_pin})$$
- **Two-Way Physical Validation:** The donor verifies the pickup volunteer via the secure PIN/QR code. Upon arrival, the volunteer inputs the matching PIN into their dispatch interface to transition the record to `DELIVERED`.
- **Tamper-Evident Receipts:** Generates an immutable digital audit receipt capturing timestamps, GPS coordinates, donor details, and cryptographic signatures.

### 2. GIS Route Optimization & Spoilage Heatmap
Volunteer drivers frequently handle multiple pickups across congested urban areas:
- **Haversine Geodesic Distance Matrix:** Computes precise surface distances between the NGO operating base and food pickup locations.
- **Multi-Stop Traveling Salesperson (TSP) Sequencing:** Dynamically calculates the optimal multi-stop pickup sequence for all `CLAIMED` and `IN_TRANSIT` donations.
- **Spoilage Priority Index:** Combines distance, food decay category multipliers, and minutes remaining:
  $$\text{Priority Index} = \frac{\text{Urgency Score}}{\text{Hours Remaining} + 0.1} \times \frac{1}{\text{Distance (km)} + 0.5}$$
- **Interactive Spoilage Heatmap:** Rendered with Leaflet.js and OpenStreetMap, displaying live driver routes, urgent pickup pins, and calculated fuel/time estimates based on realistic traffic patterns.

### 3. Conditional OpenCV & AI Urgency Scoring
Fast, reliable quality inspection that never gets in the way of rapid donation creation:
- **Laplacian Variance Blur Detection:** Flags blurry, unidentifiable images using:
  $$\sigma^2 = \text{Var}(\nabla^2 I)$$
  Photos with $\sigma^2 < 35.0$ are flagged as unfocused.
- **Luminance & Contrast Verification:** Rejects under-exposed or over-saturated images where mean pixel intensity falls outside $30.0 \le \bar{I} \le 240.0$.
- **Strict Conditional Processing:** OpenCV validation and quality badges trigger **only** when an image file is actually uploaded. If a donor submits a text-only listing, the pipeline skips image processing instantly without displaying broken placeholders.
- **Perishability Multipliers:**
  - Cooked Meals: `1.6x` multiplier (spoilage window < 4-6 hours)
  - Dairy / Fresh Produce: `1.3x` multiplier
  - Raw Ingredients: `1.0x` multiplier
  - Packaged / Canned Goods: `0.4x` multiplier
- **Sub-300ms Creation:** Preloaded singleton models and local heuristic fallbacks eliminate blocking external API calls during donation publishing.

### 4. Role-Based Access Control (RBAC) & Trust Gate
- **Strict Role Separation:** Granular permissions across three roles: `DONOR`, `NGO`, and `ADMIN`.
- **NGO Verification Trust Gate:** Newly registered NGOs default to `is_approved = False`. Unapproved organizations are strictly blocked from claiming donations, viewing confidential pickup addresses, or querying dispatch routes until their official registration numbers are reviewed and approved by an Administrator.
- **Seamless Registration & Normalization:** Robust frontend and backend normalization handles domestic and international phone numbers (e.g., `+91 98765 43210`, leading zeros, dashes) with inline error diagnostics.

---

## 🛠️ Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Backend Framework** | **Django 5.0+** | High-performance Python web framework with robust ORM |
| **API Layer** | **Django REST Framework** | Modular REST APIs with serializer validation and viewsets |
| **Authentication** | **SimpleJWT** | Stateless JSON Web Tokens (access & refresh token flow) |
| **Computer Vision** | **OpenCV (`headless`)** | Laplacian sharpness variance, luminance histogram checks |
| **Database** | **PostgreSQL / SQLite** | Relational data persistence with foreign-key integrity |
| **Frontend Framework** | **React 18** | Modern reactive component hierarchy and custom hooks |
| **Build Tool** | **Vite 5** | Lightning-fast HMR and optimized production bundling |
| **Styling & Icons** | **Tailwind CSS & Lucide** | Responsive utility-first design with accessible icons |
| **Mapping & GIS** | **React-Leaflet / Leaflet** | Interactive geospatial mapping, tile rendering, and polylines |
| **HTTP Client** | **Axios** | Interceptor-equipped HTTP client with automated token sanitization |

---

## 📁 Project Structure

```text
FoodBridge/
├── backend/                              # Django REST API Backend
│   ├── foodbridge/                       # Core project configuration
│   │   ├── settings.py                   # Django settings, CORS, JWT & DB config
│   │   ├── urls.py                       # Root routing table
│   │   └── wsgi.py                       # WSGI application entry
│   ├── users/                            # User identity & authentication app
│   │   ├── models.py                     # Custom User, UserRole, UserProfile models
│   │   ├── serializers.py                # Register & User profile serializers
│   │   ├── views.py                      # Auth, JWT, NGO approval & toggle views
│   │   ├── urls.py                       # Authentication endpoints
│   │   └── tests.py                      # Registration & RBAC unit tests
│   ├── donations/                        # Surplus food & logistics engine
│   │   ├── models.py                     # Donation, Claim, Audit & Handoff models
│   │   ├── serializers.py                # Donation, Handoff & Route serializers
│   │   ├── views.py                      # Route optimization, claims & PIN validation
│   │   ├── urls.py                       # Donation & route endpoint definitions
│   │   ├── ai_engine.py                  # Urgency decay scoring & heuristic engine
│   │   ├── image_inspector.py            # OpenCV Laplacian & luminance inspection
│   │   └── tests.py                      # Handoff, route & quality unit tests
│   ├── manage.py                         # Django administrative CLI
│   ├── seed_data.py                      # Demo data generator
│   └── requirements.txt                  # Python dependencies
│
├── frontend/                             # React 18 + Vite Frontend Client
│   ├── public/                           # Static assets
│   ├── src/
│   │   ├── components/                   # Reusable UI components
│   │   │   ├── Navbar.jsx                # Dynamic navigation bar with role toggles
│   │   │   ├── RouteMapVisualizer.jsx    # Leaflet GIS route & heatmap component
│   │   │   ├── FoodImageLightboxModal.jsx# High-resolution image preview lightbox
│   │   │   └── ImageQualityBadge.jsx     # OpenCV verified badge component
│   │   ├── context/
│   │   │   └── AuthContext.jsx           # Global auth state & session persistence
│   │   ├── pages/                        # Role-specific application views
│   │   │   ├── DonorDashboard.jsx        # Food listing creation & active rescue monitor
│   │   │   ├── NgoDashboard.jsx          # Marketplace, claim queue & PIN handoff
│   │   │   ├── NgoRoutePlanner.jsx       # Multi-stop GIS dispatch visualizer
│   │   │   ├── AdminDashboard.jsx        # NGO approval queue & platform metrics
│   │   │   ├── Login.jsx                 # JWT authentication form
│   │   │   └── Register.jsx              # Donor & NGO registration with validation
│   │   ├── services/
│   │   │   └── api.js                    # Axios client with JWT interceptors
│   │   ├── App.jsx                       # Route provider & protected layouts
│   │   └── main.jsx                      # React application mount point
│   ├── index.html                        # HTML template
│   ├── package.json                      # NPM dependencies and scripts
│   ├── tailwind.config.js                # Tailwind theme customization
│   └── vite.config.js                    # Vite server & build configuration
└── README.md
```

---

## 🚀 Local Installation & Setup Guide

### Prerequisites
- **Python**: Version `3.10` or higher
- **Node.js**: Version `18.0` or higher & `npm`
- **PostgreSQL**: Version `14` or higher (Optional: default falls back to SQLite for zero-config local testing)
- **Git**

---

### 1. Backend Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-org/foodbridge.git
   cd foodbridge/backend
   ```

2. **Create and Activate a Virtual Environment**:
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Database (PostgreSQL)**:
   By default, FoodBridge runs out-of-the-box using SQLite. To use production PostgreSQL, set the following environment variables or create a `.env` file in `backend/`:
   ```env
   DB_ENGINE=django.db.backends.postgresql
   DB_NAME=foodbridge_db
   DB_USER=postgres
   DB_PASSWORD=your_secure_password
   DB_HOST=localhost
   DB_PORT=5432
   ```

5. **Apply Database Migrations**:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

---

### 2. Database Seeding

Populate the database with realistic donors, verified/pending NGOs, and active surplus food listings:
```bash
python seed_data.py
```

Start the Django development server:
```bash
python manage.py runserver 8000
```
*The REST API will be available at `http://127.0.0.1:8000/api/`.*

---

### 3. Frontend Setup

1. **Navigate to the Frontend Directory**:
   ```bash
   cd ../frontend
   ```

2. **Install Node Packages**:
   ```bash
   npm install
   ```

3. **Start the Vite Development Server**:
   ```bash
   npm run dev
   ```
   *The client interface will be live at `http://localhost:5173/` (or `http://localhost:3000/`).*

---

## 🔑 Pre-Seeded Demo Accounts

The database seeder provisions pre-configured accounts representing each persona in the food rescue ecosystem:

| Role | Username | Password | Operational Purpose |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `admin123` | Approves pending NGOs, reviews platform logs, views rescue KPIs |
| **Food Donor** | `restaurant_donor` | `donor123` | Posts surplus cooked food, inspects photos, verifies handoff PIN |
| **Approved NGO** | `hope_shelter_ngo` | `ngo123` | Claims urgent donations, plans multi-stop GIS routes, confirms PIN |
| **Pending NGO** | `community_kitchen_ngo` | `ngo123` | Demonstrates the mandatory unapproved NGO approval gate |

---

## 📡 API Reference

### Authentication & Users
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/` | Public | Register new Donor or NGO account |
| `POST` | `/api/auth/login/` | Public | Obtain JWT `access` and `refresh` tokens (NGO gate enforced) |
| `POST` | `/api/auth/refresh/` | Public | Refresh expired JWT access token |
| `GET` | `/api/auth/me/` | Authenticated | Retrieve authenticated user profile and permissions |
| `GET` | `/api/users/` | Admin | List all registered platform accounts |
| `GET` | `/api/admin/pending-ngos/` | Admin | List pending NGO applications awaiting verification |
| `POST` | `/api/admin/ngos/{id}/approve/`| Admin | Formally approve NGO (`is_approved = True`) |
| `POST` | `/api/admin/ngos/{id}/reject/` | Admin | Reject and delete an unverified NGO application |

### Surplus Donations & Logistics
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/donations/` | Authenticated | Fetch surplus listings (supports `?status=AVAILABLE`) |
| `POST` | `/api/donations/` | Donor / Admin | Create donation with instant heuristic AI score |
| `POST` | `/api/donations/inspect-image/`| Authenticated | Standalone OpenCV blur and luminance assessment |
| `POST` | `/api/donations/{id}/claim/` | Approved NGO | Claim an available donation, creating a 4-digit PIN |
| `GET` | `/api/routes/optimize/` | Approved NGO | Dynamic GIS multi-stop TSP routing for active claims |
| `POST` | `/api/donations/{id}/generate-handoff-token/` | Claimed NGO / Donor | Generate cryptographic SHA-256 handoff hash |
| `POST` | `/api/donations/{id}/verify-handoff/` | Claimed NGO | Submit 4-digit PIN to finalize physical handoff |
| `GET` | `/api/donations/{id}/handoff-receipt/`| Authenticated | Retrieve immutable proof-of-custody handoff receipt |
| `GET` | `/api/admin/metrics/` | Admin | Platform-wide rescue metrics, meals saved & emissions avoided |

---

## 🧪 Testing & Quality Assurance

Both backend services and frontend components include test coverage and automated build validation:

### Backend Unit Tests
```bash
# Run user registration, phone normalization & RBAC tests
python manage.py test users

# Run donation lifecycle, handoff PIN & route optimization tests
python manage.py test donations
```

### Frontend Build Validation
```bash
cd frontend
npm run build
```

---

## 🤝 Contributing & License

Contributions are welcome! Please follow these steps:
1. **Fork the Repository**
2. **Create a Feature Branch** (`git checkout -b feature/smart-telemetry`)
3. **Commit Your Changes** (`git commit -m "Add real-time telemetry stream"`)
4. **Push to Branch** (`git push origin feature/smart-telemetry`)
5. **Open a Pull Request**

Distributed under the **MIT License**. See `LICENSE` for details.
