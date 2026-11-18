'use client';

import React, { useState } from 'react';
import { Role, Donation, DonationStatus } from '@/lib/types';
import { INITIAL_DONORS, INITIAL_NGOS, INITIAL_VOLUNTEERS, INITIAL_DONATIONS, INITIAL_TELEMETRY } from '@/lib/mockData';
import { calculateEsgImpact } from '@/lib/esgCalculator';
import { Navbar } from '@/components/Navbar';
import { DonorDashboard } from '@/components/DonorDashboard';
import { NgoDashboard } from '@/components/NgoDashboard';
import { VolunteerDashboard } from '@/components/VolunteerDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { VisionInspectorModal } from '@/components/VisionInspectorModal';

export default function Home() {
  const [currentRole, setCurrentRole] = useState<Role>('DONOR');
  const [donations, setDonations] = useState<Donation[]>(INITIAL_DONATIONS);
  const [selectedInspectionDonation, setSelectedInspectionDonation] = useState<Donation | null>(null);

  // Compute aggregate stats
  const totalWeightKg = donations.reduce((acc, d) => acc + d.weightKg, 0);
  const esgMetrics = calculateEsgImpact(totalWeightKg);

  const handleAddDonation = (newDonation: Partial<Donation>) => {
    const created: Donation = {
      id: `don_${Date.now()}`,
      donorId: newDonation.donorId || 'donor_1',
      donorName: newDonation.donorName || 'Grand Horizon Hotel',
      title: newDonation.title || 'Surplus Food',
      description: newDonation.description || '',
      category: newDonation.category || 'COOKED_MEALS',
      servingsCount: newDonation.servingsCount || 20,
      weightKg: newDonation.weightKg || 10,
      prepTime: newDonation.prepTime || new Date().toISOString(),
      expirationEta: newDonation.expirationEta || new Date(Date.now() + 3*3600*1000).toISOString(),
      storageRequirement: newDonation.storageRequirement || 'AMBIENT',
      status: 'POSTED',
      urgencyScore: newDonation.urgencyScore || 40,
      qualityIndex: newDonation.qualityIndex || 95,
      spoilageRiskFlag: newDonation.spoilageRiskFlag || false,
      latitude: newDonation.latitude || 40.7589,
      longitude: newDonation.longitude || -73.9851,
      address: newDonation.address || '1540 Broadway, NYC',
      createdAt: new Date().toISOString()
    };

    setDonations([created, ...donations]);
  };

  const handleAcceptDonation = (donationId: string, ngoId: string) => {
    setDonations(donations.map(d => {
      if (d.id === donationId) {
        return { ...d, status: 'ACCEPTED', aiMatchedNgoId: ngoId };
      }
      return d;
    }));
  };

  const handleUpdateStatus = (donationId: string, status: DonationStatus) => {
    setDonations(donations.map(d => {
      if (d.id === donationId) {
        return { ...d, status };
      }
      return d;
    }));
  };

  const handleResetData = () => {
    setDonations(INITIAL_DONATIONS);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Bar */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeDonationCount={donations.filter(d => d.status !== 'DISTRIBUTED' && d.status !== 'AUDITED').length}
        totalCo2SavedKg={esgMetrics.co2SavedKg}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {currentRole === 'DONOR' && (
          <DonorDashboard
            donor={INITIAL_DONORS[0]}
            donations={donations}
            onAddDonation={handleAddDonation}
            onOpenVisionModal={(d) => setSelectedInspectionDonation(d)}
          />
        )}

        {currentRole === 'NGO' && (
          <NgoDashboard
            ngo={INITIAL_NGOS[0]}
            donations={donations}
            allNgos={INITIAL_NGOS}
            onAcceptDonation={handleAcceptDonation}
          />
        )}

        {currentRole === 'VOLUNTEER' && (
          <VolunteerDashboard
            volunteer={INITIAL_VOLUNTEERS[0]}
            donations={donations}
            ngos={INITIAL_NGOS}
            telemetryLogs={INITIAL_TELEMETRY}
            onUpdateDonationStatus={handleUpdateStatus}
          />
        )}

        {currentRole === 'ADMIN' && (
          <AdminDashboard
            donations={donations}
          />
        )}
      </main>

      {/* Computer Vision Modal */}
      {selectedInspectionDonation && (
        <VisionInspectorModal
          isOpen={!!selectedInspectionDonation}
          onClose={() => setSelectedInspectionDonation(null)}
          inspectionData={{
            qualityIndex: selectedInspectionDonation.qualityIndex,
            freshnessStatus: selectedInspectionDonation.qualityIndex >= 90 ? 'EXCELLENT' : 'GOOD',
            spoilageRiskFlag: selectedInspectionDonation.spoilageRiskFlag,
            darkSpotAnomalyPct: 1.2,
            packagingSealed: true,
            estimatedPortions: selectedInspectionDonation.servingsCount,
            safetyApproval: !selectedInspectionDonation.spoilageRiskFlag,
            recommendedStorage: selectedInspectionDonation.storageRequirement,
            inspectionNotes: 'Food visually passed safety inspection. Vibrant coloration, no decomposition.'
          }}
          foodTitle={selectedInspectionDonation.title}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>FoodBridge Platform v2.4 • Open-Source AI Telemetry Redistribution Framework</span>
          <span>PostGIS Spatial Engine • OpenCV Vision Model • TSP Route Optimizer</span>
        </div>
      </footer>

    </div>
  );
}
