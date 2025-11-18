'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ArrowLeft, Calendar, Save, Loader2 } from 'lucide-react';

export default function RegisterChildPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [userEmail, setUserEmail] = useState<string>();
  const [preschoolId, setPreschoolId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [dietaryRequirements, setDietaryRequirements] = useState('');
  const [medicalInfo, setMedicalInfo] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gradeLevel, setGradeLevel] = useState('');
  const [schoolNotListed, setSchoolNotListed] = useState(false);
  const [manualSchoolName, setManualSchoolName] = useState('');

  // Organizations/schools
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email);

      // Get user's preschool
      const { data: profile } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', session.user.id)
        .maybeSingle();

      setPreschoolId(profile?.preschool_id);
      setSelectedOrgId(profile?.preschool_id || '');
      setLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoadingOrgs(true);
        const { data, error } = await supabase
          .from('preschools')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        
        // Find EduDash Pro Community School or create default entry
        const communitySchool = (data || []).find((p: any) => 
          p.name.toLowerCase().includes('edudash pro community') || 
          p.name.toLowerCase().includes('community school')
        );
        
        const schools = (data || []).map((p: any) => ({ id: p.id, name: p.name, type: 'preschool' }));
        
        // If community school exists, move it to top; otherwise add it as first option
        if (communitySchool) {
          const filtered = schools.filter((s: { id: string; name: string; type: string }) => s.id !== communitySchool.id);
          setOrganizations([{ id: communitySchool.id, name: communitySchool.name, type: 'preschool' }, ...filtered]);
          // Auto-select community school as default (always set it)
          setSelectedOrgId(communitySchool.id);
        } else {
          // If no community school found, create a virtual one as first option
          setOrganizations([{ id: 'edudash-community', name: 'EduDash Pro Community School', type: 'preschool' }, ...schools]);
          setSelectedOrgId('edudash-community');
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      } finally {
        setLoadingOrgs(false);
      }
    };

    fetchOrganizations();
  }, [supabase]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const dob = new Date(dateOfBirth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 2 || age > 18) {
        newErrors.dateOfBirth = 'Child must be between 2 and 18 years old';
      }
    }
    if (!gender) newErrors.gender = 'Please select gender';
    
    // Validate school selection OR manual entry
    if (schoolNotListed) {
      if (!manualSchoolName.trim()) {
        newErrors.manualSchool = 'Please enter your child\'s school name';
      }
    } else {
      if (!selectedOrgId) {
        newErrors.organization = 'Please select a school or choose "My child\'s school is not listed"';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    if (!userId) {
      alert('User session not found. Please log in again.');
      return;
    }

    if (!schoolNotListed && !selectedOrgId) {
      alert('Please select a school before submitting.');
      return;
    }
    
    if (schoolNotListed && !manualSchoolName.trim()) {
      alert('Please enter your child\'s school name.');
      return;
    }

    setSubmitting(true);

    try {
      // Proactive duplicate check: query for existing pending requests
      // Normalize names: trim and collapse inner spaces
      const normalizedFirst = firstName.trim().replace(/\s+/g, ' ');
      const normalizedLast = lastName.trim().replace(/\s+/g, ' ');
      const selectedOrgName = schoolNotListed 
        ? manualSchoolName.trim() 
        : (organizations.find(o => o.id === selectedOrgId)?.name || 'this school');

      console.log('[RegisterChild] Checking for duplicate pending requests...');
      
      // Build duplicate check query
      let duplicateQuery = supabase
        .from('child_registration_requests')
        .select('id')
        .eq('parent_id', userId)
        .eq('status', 'pending')
        .ilike('child_first_name', normalizedFirst)
        .ilike('child_last_name', normalizedLast);
      
      // Add preschool_id filter only if a school is selected from the list
      if (!schoolNotListed && selectedOrgId) {
        duplicateQuery = duplicateQuery.eq('preschool_id', selectedOrgId);
      }
      
      const { data: existingRequests, error: checkError } = await duplicateQuery;

      if (checkError) {
        // Log error but continue - DB uniqueness constraint is our fallback
        console.error('[RegisterChild] Duplicate check query failed:', checkError);
      } else if (existingRequests && existingRequests.length > 0) {
        // Found duplicate - block submission
        alert(`You already have a pending registration request for ${normalizedFirst} ${normalizedLast} at ${selectedOrgName}.\n\nPlease wait for the school to review your existing request.`);
        setSubmitting(false);
        return;
      }

      // Note: We use profiles table directly (users table is deprecated)
      console.log('[RegisterChild] Using auth user ID directly (profiles-first architecture):', userId);

      const relationshipNote = emergencyRelation ? `[EmergencyRelationship: ${emergencyRelation.trim()}]` : '';
      const gradeNote = gradeLevel ? `[Grade: ${gradeLevel.trim()}]` : '';
      const schoolNote = schoolNotListed ? `[School: ${manualSchoolName.trim()}]` : '';
      const combinedNotes = ([relationshipNote, gradeNote, schoolNote].filter(Boolean).join(' ') + (notes ? ` ${notes}` : '')).trim();

      const payload = {
        child_first_name: normalizedFirst,
        child_last_name: normalizedLast,
        child_birth_date: dateOfBirth,
        child_gender: gender || null,
        dietary_requirements: dietaryRequirements || null,
        medical_info: medicalInfo || null,
        special_needs: specialNeeds || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        notes: combinedNotes || null,
        parent_id: userId, // Use auth.uid() directly (references profiles.id)
        preschool_id: schoolNotListed ? null : selectedOrgId, // Null if school not in system
        status: 'pending',
      };

      console.log('[RegisterChild] Submitting payload:', { ...payload, parent_id: userId });

      // Update parent's preschool_id if not set AND school is from our list (not manual entry)
      if (!preschoolId && !schoolNotListed && selectedOrgId) {
        console.log('✅ Setting parent preschool_id to:', selectedOrgId);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ preschool_id: selectedOrgId })
          .eq('id', userId);
        
        if (updateError) {
          console.error('❌ Failed to update parent preschool_id:', updateError);
        } else {
          console.log('✅ Parent preschool_id updated successfully');
        }
      }

      const { error } = await supabase.from('child_registration_requests').insert(payload);

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          alert(`You have already submitted a registration request for ${normalizedFirst} ${normalizedLast} at ${selectedOrgName}.\n\nPlease wait for the school to review your existing request.`);
          return;
        }
        throw error;
      }

      const successMessage = schoolNotListed
        ? `✅ Child information saved!\n\n📝 Your child has been added to your profile.\n\n💡 Since ${manualSchoolName} is not yet registered on EduDash Pro, you can track your child's progress independently using our AI-powered features.`
        : `✅ Registration request submitted!\n\n🕒 ${selectedOrgName} will review your request.\n\nYou'll be notified once it's approved.`;
      
      alert(successMessage);
      router.push('/dashboard/parent');
    } catch (err) {
      console.error('Registration error:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit registration request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <ParentShell tenantSlug={slug} userEmail={userEmail}>
      <div className="container" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="section">
          <button
            onClick={() => router.back()}
            className="btn inline-flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <h1 className="h1">Register a Child</h1>
          <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>Submit a registration request for your child</p>

          <form onSubmit={handleSubmit} className="card" style={{ padding: 'var(--space-6)', maxWidth: 800 }}>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              {/* Child Information */}
              <div>
                <h3 className="sectionTitle">Child Information</h3>

                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>First Name *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="formInput"
                      style={{ width: '100%' }}
                      placeholder="e.g. Thandi"
                    />
                    {errors.firstName && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 'var(--space-1)' }}>{errors.firstName}</p>}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="formInput"
                      style={{ width: '100%' }}
                      placeholder="e.g. Ndlovu"
                    />
                    {errors.lastName && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 'var(--space-1)' }}>{errors.lastName}</p>}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Date of Birth *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="formInput"
                        style={{ width: '100%' }}
                        max={new Date().toISOString().split('T')[0]}
                      />
                      <Calendar style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }} className="icon16" />
                    </div>
                    <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-1)' }}>Child must be between 2 and 18 years old</p>
                    {errors.dateOfBirth && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 'var(--space-1)' }}>{errors.dateOfBirth}</p>}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Gender *</label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {(['male', 'female', 'other'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`btn ${gender === g ? 'btnPrimary' : ''}`}
                          style={{ flex: 1 }}
                        >
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </button>
                      ))}
                    </div>
                    {errors.gender && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 'var(--space-1)' }}>{errors.gender}</p>}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Select School *</label>
                    
                    {/* Checkbox for school not listed */}
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={schoolNotListed}
                          onChange={(e) => {
                            setSchoolNotListed(e.target.checked);
                            if (e.target.checked) {
                              setSelectedOrgId('');
                            } else {
                              setManualSchoolName('');
                            }
                          }}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 14 }}>My child&apos;s school is not listed (K-12 schools)</span>
                      </label>
                    </div>
                    
                    {schoolNotListed ? (
                      <div>
                        <input
                          type="text"
                          value={manualSchoolName}
                          onChange={(e) => setManualSchoolName(e.target.value)}
                          className="formInput"
                          style={{ width: '100%' }}
                          placeholder="Enter your child's school name (e.g., Hoërskool Waterkloof)"
                        />
                        <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-1)' }}>
                          💡 Enter the full name of your child&apos;s primary or high school
                        </p>
                        {errors.manualSchool && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 'var(--space-1)' }}>{errors.manualSchool}</p>}
                      </div>
                    ) : (
                      <>
                        {loadingOrgs ? (
                          <div className="formInput" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 className="icon16" style={{ animation: 'spin 1s linear infinite' }} />
                          </div>
                        ) : (
                          <select
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                            className="formInput"
                            style={{ width: '100%' }}
                          >
                            <option value="">Select a preschool...</option>
                            {organizations.map((org) => (
                              <option key={org.id} value={org.id}>
                                {org.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {errors.organization && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 'var(--space-1)' }}>{errors.organization}</p>}
                      </>
                    )}
                  </div>

                  {/* Grade/Class Level */}
                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Grade/Class (Optional)</label>
                    <select
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                      className="formInput"
                      style={{ width: '100%' }}
                    >
                      <option value="">Select grade level...</option>
                      <optgroup label="Preschool">
                        <option value="Playgroup">Playgroup (2-3 years)</option>
                        <option value="Pre-Primary">Pre-Primary (3-4 years)</option>
                        <option value="Grade R">Grade R (5-6 years)</option>
                      </optgroup>
                      <optgroup label="Primary School">
                        <option value="Grade 1">Grade 1</option>
                        <option value="Grade 2">Grade 2</option>
                        <option value="Grade 3">Grade 3</option>
                        <option value="Grade 4">Grade 4</option>
                        <option value="Grade 5">Grade 5</option>
                        <option value="Grade 6">Grade 6</option>
                        <option value="Grade 7">Grade 7</option>
                      </optgroup>
                      <optgroup label="High School">
                        <option value="Grade 8">Grade 8</option>
                        <option value="Grade 9">Grade 9</option>
                        <option value="Grade 10">Grade 10</option>
                        <option value="Grade 11">Grade 11</option>
                        <option value="Grade 12">Grade 12</option>
                      </optgroup>
                    </select>
                    <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-1)' }}>
                      📚 Select your child&apos;s current grade level
                    </p>
                  </div>
                </div>
              </div>

              {/* Health & Special Needs */}
              <div style={{ marginTop: 'var(--space-5)' }}>
                <h3 className="sectionTitle">Health & Special Needs (Optional)</h3>

                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Dietary Requirements</label>
                    <input
                      type="text"
                      value={dietaryRequirements}
                      onChange={(e) => setDietaryRequirements(e.target.value)}
                      className="formInput"
                      style={{ width: '100%' }}
                      placeholder="e.g. Vegetarian, Halal, Allergies"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Medical Information</label>
                    <textarea
                      value={medicalInfo}
                      onChange={(e) => setMedicalInfo(e.target.value)}
                      className="formInput"
                      style={{ width: '100%', minHeight: 80, paddingTop: 10, fontFamily: 'inherit', resize: 'vertical' }}
                      rows={3}
                      placeholder="e.g. Allergies, medications, conditions"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Special Needs</label>
                    <textarea
                      value={specialNeeds}
                      onChange={(e) => setSpecialNeeds(e.target.value)}
                      className="formInput"
                      style={{ width: '100%', minHeight: 80, paddingTop: 10, fontFamily: 'inherit', resize: 'vertical' }}
                      rows={3}
                      placeholder="Any special educational needs or accommodations"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div style={{ marginTop: 'var(--space-5)' }}>
                <h3 className="sectionTitle">Emergency Contact (Optional)</h3>

                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Emergency Contact Name</label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      className="formInput"
                      style={{ width: '100%' }}
                      placeholder="e.g. Sipho Mthethwa"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Emergency Contact Phone</label>
                    <input
                      type="tel"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      className="formInput"
                      style={{ width: '100%' }}
                      placeholder="+27 XX XXX XXXX"
                    />
                    <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-1)' }}>Format: +27 XX XXX XXXX or 0XX XXX XXXX</p>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Relationship to Child</label>
                    <input
                      type="text"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      className="formInput"
                      style={{ width: '100%' }}
                      placeholder="e.g. Mother, Father, Aunt"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div style={{ marginTop: 'var(--space-5)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="formInput"
                  style={{ width: '100%', minHeight: 100, paddingTop: 10, fontFamily: 'inherit', resize: 'vertical' }}
                  rows={4}
                  placeholder="Anything else the school should know"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="btn btnPrimary inline-flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Submit Registration Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ParentShell>
  );
}
