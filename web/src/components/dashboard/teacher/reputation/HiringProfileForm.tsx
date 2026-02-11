'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe2, MapPin, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { CandidateProfileRow } from './types';
import { toNumber } from './types';

interface HiringProfileFormProps {
  candidateProfile: CandidateProfileRow;
  onSaved: (updated: CandidateProfileRow) => void;
  onError: (message: string) => void;
}

export function HiringProfileForm({ candidateProfile, onSaved, onError }: HiringProfileFormProps) {
  const supabase = createClient();

  const [isPublic, setIsPublic] = useState(Boolean(candidateProfile.is_public));
  const [city, setCity] = useState(candidateProfile.location_city || '');
  const [province, setProvince] = useState(candidateProfile.location_province || '');
  const [radiusKm, setRadiusKm] = useState(
    String(candidateProfile.preferred_radius_km || candidateProfile.willing_to_commute_km || 25),
  );
  const [locationLat, setLocationLat] = useState<number | null>(toNumber(candidateProfile.location_lat));
  const [locationLng, setLocationLng] = useState<number | null>(toNumber(candidateProfile.location_lng));
  const [locationSource, setLocationSource] = useState<'gps' | 'manual' | null>(
    candidateProfile.location_source || null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsPublic(Boolean(candidateProfile.is_public));
    setCity(candidateProfile.location_city || '');
    setProvince(candidateProfile.location_province || '');
    setRadiusKm(String(candidateProfile.preferred_radius_km || candidateProfile.willing_to_commute_km || 25));
    setLocationLat(toNumber(candidateProfile.location_lat));
    setLocationLng(toNumber(candidateProfile.location_lng));
    setLocationSource(candidateProfile.location_source || null);
  }, [candidateProfile]);

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const parsedRadius = Number(radiusKm);
      const safeRadius = Number.isFinite(parsedRadius) && parsedRadius > 0 ? Math.round(parsedRadius) : 25;

      const hasManualLocation = Boolean(city.trim() || province.trim());
      const nextSource: 'gps' | 'manual' | null =
        locationSource === 'gps' ? 'gps' : hasManualLocation ? 'manual' : null;

      const nextLat = nextSource === 'gps' ? locationLat : null;
      const nextLng = nextSource === 'gps' ? locationLng : null;
      const nextCity = city.trim() || null;
      const nextProvince = province.trim() || null;
      const nextLocation = nextCity || nextProvince ? [nextCity, nextProvince].filter(Boolean).join(', ') : null;

      const { data, error } = await supabase
        .from('candidate_profiles')
        .update({
          is_public: isPublic,
          location_city: nextCity,
          location_province: nextProvince,
          location_lat: nextLat,
          location_lng: nextLng,
          location_source: nextSource,
          preferred_radius_km: safeRadius,
          location_updated_at: new Date().toISOString(),
          location: nextLocation,
          preferred_location_lat: nextLat,
          preferred_location_lng: nextLng,
          willing_to_commute_km: safeRadius,
        })
        .eq('id', candidateProfile.id)
        .select('*')
        .single();

      if (error) throw error;

      const updated = data as CandidateProfileRow;
      setLocationLat(toNumber(updated.location_lat));
      setLocationLng(toNumber(updated.location_lng));
      setLocationSource(updated.location_source || null);
      onSaved(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save hiring profile.');
    } finally {
      setSaving(false);
    }
  }, [candidateProfile.id, city, isPublic, locationLat, locationLng, locationSource, onError, onSaved, province, radiusKm, supabase]);

  const handleUseGps = useCallback(() => {
    if (!navigator.geolocation) {
      onError('GPS is not available in this browser. Enter your city/province manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLat(position.coords.latitude);
        setLocationLng(position.coords.longitude);
        setLocationSource('gps');
      },
      (geoError) => {
        onError(geoError.message || 'Could not access your current location.');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }, [onError]);

  return (
    <div className="section">
      <div className="card p-md">
        <div className="flex items-center gap-2 mb-3">
          <Globe2 className="w-4 h-4 text-sky-300" />
          <h2 className="text-lg font-semibold text-white">Hiring Profile</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/35 px-3 py-2">
            <span className="text-sm text-slate-200">Visible to schools in Hiring Hub</span>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">City / Area</label>
              <input
                type="text"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setLocationSource('manual');
                }}
                placeholder="e.g. Johannesburg"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">Province</label>
              <input
                type="text"
                value={province}
                onChange={(event) => {
                  setProvince(event.target.value);
                  setLocationSource('manual');
                }}
                placeholder="e.g. Gauteng"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">Preferred radius (km)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={radiusKm}
                onChange={(event) => setRadiusKm(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleUseGps}
                type="button"
                className="px-3 py-2 rounded-lg border border-sky-500/40 text-sky-200 text-sm font-semibold hover:bg-sky-900/20 inline-flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Use Current Location
              </button>
            </div>
          </div>

          {locationLat !== null && locationLng !== null && (
            <div className="text-xs text-slate-400">
              GPS set: {locationLat.toFixed(4)}, {locationLng.toFixed(4)}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => void handleSaveProfile()}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
