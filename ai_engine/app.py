from fastapi import FastAPI, UploadFile, File, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn

from matching_engine import AIMatchingEngine
from vision_inspector import FoodVisionInspector
from forecasting_engine import DistrictSurplusForecaster
from route_optimizer import MultiStopRouteOptimizer

app = FastAPI(
    title="FoodBridge AI Engine Microservice",
    description="AI Microservice powering dynamic matching, vision spoilage inspection, surplus forecasting, and TSP route optimization.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

matching_engine = AIMatchingEngine()
vision_inspector = FoodVisionInspector()
forecasting_engine = DistrictSurplusForecaster()
route_optimizer = MultiStopRouteOptimizer()

class MatchRequest(BaseModel):
    donation: Dict[str, Any]
    ngos: List[Dict[str, Any]]

class RouteOptimizeRequest(BaseModel):
    volunteerLat: float
    volunteerLng: float
    pickups: List[Dict[str, Any]]
    dropoffNgo: Dict[str, Any]

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "FoodBridge AI Microservice",
        "version": "1.0.0",
        "documentation": "/docs",
        "endpoints": ["/health", "/api/v1/match", "/api/v1/vision-inspect", "/api/v1/forecast", "/api/v1/optimize-route"]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "FoodBridge-AI-Engine", "version": "1.0.0"}

@app.post("/api/v1/match")
def match_donation(req: MatchRequest):
    """
    Ranks NGOs for a donation using PostGIS distance, urgency decay, capacity, and dietary alignment.
    """
    try:
        rankings = matching_engine.rank_ngos_for_donation(req.donation, req.ngos)
        return {
            "success": True,
            "donationId": req.donation.get("id"),
            "matchCount": len(rankings),
            "rankings": rankings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vision-inspect")
async def vision_inspect(
    file: Optional[UploadFile] = File(None),
    foodCategory: str = "COOKED_MEALS"
):
    """
    Analyzes food item photo for spoilage risk, freshness index, packaging integrity, and portion estimation.
    """
    try:
        contents = await file.read() if file else None
        result = vision_inspector.analyze_image(contents, food_category=foodCategory)
        return {"success": True, "inspection": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/forecast")
def get_forecast(days: int = 7):
    """
    Returns time-series surplus & demand hotspot predictions across city districts.
    """
    try:
        result = forecasting_engine.predict_surplus_hotspots(days_ahead=days)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/optimize-route")
def optimize_route(req: RouteOptimizeRequest):
    """
    Solves Traveling Salesperson Problem (TSP) for volunteer multi-stop pickup and delivery.
    """
    try:
        result = route_optimizer.optimize_volunteer_batch(
            req.volunteerLat,
            req.volunteerLng,
            req.pickups,
            req.dropoffNgo
        )
        return {"success": True, "route": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
