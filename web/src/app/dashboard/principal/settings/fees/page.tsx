'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { DollarSign, Plus, Edit2, Trash2, ArrowLeft, Save } from 'lucide-react';
import { getUniformItemType, isUniformFee } from '@/lib/utils/feeUtils';

interface FeeItem {
  id?: string;
  name: string;
  amount: number;
  frequency: 'once' | 'monthly' | 'quarterly' | 'annually';
  required: boolean;
  description?: string;
}

interface UniformFeeRow {
  id: string;
  name?: string | null;
  description?: string | null;
  fee_category?: string | null;
  amount_cents: number;
  is_active?: boolean | null;
}

interface UniformPricingState {
  enabled: boolean;
  setPrice: string;
  tshirtPrice: string;
  shortsPrice: string;
  ids: {
    set?: string;
    tshirt?: string;
    shorts?: string;
  };
}

export default function FeesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeItem | null>(null);
  const [uniformPricing, setUniformPricing] = useState<UniformPricingState>({
    enabled: false,
    setPrice: '',
    tshirtPrice: '',
    shortsPrice: '',
    ids: {},
  });

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!preschoolId) return;
    fetchFees();
    fetchUniformPricing();
  }, [preschoolId]);

  const fetchFees = async () => {
    if (!preschoolId) return;
    const { data } = await supabase
      .from('school_settings')
      .select('setting_value')
      .eq('preschool_id', preschoolId)
      .eq('setting_key', 'fees')
      .single();

    if (data?.setting_value) {
      setFees(JSON.parse(data.setting_value as string));
    } else {
      // Default fees
      setFees([
        { name: 'Registration Fee', amount: 500, frequency: 'once', required: true },
        { name: 'Monthly Tuition', amount: 2500, frequency: 'monthly', required: true },
      ]);
    }
  };

  const fetchUniformPricing = async () => {
    if (!preschoolId) return;

    const { data, error } = await supabase
      .from('school_fee_structures')
      .select('id, name, description, fee_category, amount_cents, is_active')
      .eq('preschool_id', preschoolId)
      .eq('fee_category', 'uniform');

    if (error) {
      return;
    }

    const uniformRows: UniformFeeRow[] = Array.isArray(data) ? data : [];
    const enabled = uniformRows.some((row) => row.is_active);
    const ids: UniformPricingState['ids'] = {};
    let setPrice = '';
    let tshirtPrice = '';
    let shortsPrice = '';

    uniformRows.forEach((row) => {
      if (!isUniformFee(row.fee_category, row.name, row.description)) return;
      const itemType = getUniformItemType(row.fee_category, row.name, row.description);
      const amount = row.amount_cents ? (row.amount_cents / 100).toFixed(2) : '';

      if (itemType === 'set') {
        ids.set = row.id;
        if (!setPrice) setPrice = amount;
      }
      if (itemType === 'tshirt') {
        ids.tshirt = row.id;
        if (!tshirtPrice) tshirtPrice = amount;
      }
      if (itemType === 'shorts') {
        ids.shorts = row.id;
        if (!shortsPrice) shortsPrice = amount;
      }
    });

    setUniformPricing({
      enabled,
      setPrice,
      tshirtPrice,
      shortsPrice,
      ids,
    });
  };

  const handleSaveFees = async () => {
    if (!preschoolId) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('school_settings')
      .upsert({
        preschool_id: preschoolId,
        setting_key: 'fees',
        setting_value: JSON.stringify(fees),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'preschool_id,setting_key',
      });

    if (error) {
      setSaving(false);
      setMessage({ type: 'error', text: 'Failed to save fees. Please try again.' });
      return;
    }

    const uniformSaveResult = await saveUniformPricing();
    setSaving(false);

    if (!uniformSaveResult) {
      setMessage({ type: 'error', text: 'Fees saved, but uniform pricing could not be updated.' });
      return;
    }

    setMessage({ type: 'success', text: 'Fees updated successfully!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveUniformPricing = async (): Promise<boolean> => {
    if (!preschoolId) return false;

    if (!uniformPricing.enabled) {
      const { error } = await supabase
        .from('school_fee_structures')
        .update({ is_active: false })
        .eq('preschool_id', preschoolId)
        .eq('fee_category', 'uniform');

      return !error;
    }

    const setPrice = Number.parseFloat(uniformPricing.setPrice);
    const tshirtPrice = Number.parseFloat(uniformPricing.tshirtPrice);
    const shortsPrice = Number.parseFloat(uniformPricing.shortsPrice);

    if (!Number.isFinite(setPrice) || !Number.isFinite(tshirtPrice) || !Number.isFinite(shortsPrice)) {
      setMessage({ type: 'error', text: 'Please enter all uniform prices before saving.' });
      return false;
    }

    const payloads = [
      {
        id: uniformPricing.ids.set,
        preschool_id: preschoolId,
        name: 'Uniform Set',
        description: 'Uniform Set',
        amount_cents: Math.round(setPrice * 100),
        fee_category: 'uniform',
        is_active: true,
        currency: 'ZAR',
      },
      {
        id: uniformPricing.ids.tshirt,
        preschool_id: preschoolId,
        name: 'Uniform T-shirt',
        description: 'Uniform T-shirt',
        amount_cents: Math.round(tshirtPrice * 100),
        fee_category: 'uniform',
        is_active: true,
        currency: 'ZAR',
      },
      {
        id: uniformPricing.ids.shorts,
        preschool_id: preschoolId,
        name: 'Uniform Shorts',
        description: 'Uniform Shorts',
        amount_cents: Math.round(shortsPrice * 100),
        fee_category: 'uniform',
        is_active: true,
        currency: 'ZAR',
      },
    ];

    const [setPayload, tshirtPayload, shortsPayload] = payloads;

    const inserts = payloads.filter((row) => !row.id);
    const updates = payloads.filter((row) => row.id);

    if (updates.length) {
      const { error: updateError } = await supabase
        .from('school_fee_structures')
        .upsert(updates, { onConflict: 'id' });
      if (updateError) {
        return false;
      }
    }

    if (inserts.length) {
      const { error: insertError } = await supabase
        .from('school_fee_structures')
        .insert(inserts.map(({ id, ...row }) => row));
      if (insertError) {
        return false;
      }
    }

    return true;
  };

  const handleAddFee = (fee: FeeItem) => {
    setFees([...fees, { ...fee, id: Date.now().toString() }]);
    setShowAddModal(false);
  };

  const handleEditFee = (fee: FeeItem) => {
    setFees(fees.map((f) => (f.id === fee.id ? fee : f)));
    setEditingFee(null);
  };

  const handleDeleteFee = (id: string) => {
    setFees(fees.filter((f) => f.id !== id));
  };

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="iconBtn" onClick={() => router.back()}>
              <ArrowLeft className="icon20" />
            </button>
            <div>
              <h1 className="h1" style={{ marginBottom: 4 }}>Fee Structure</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                Configure registration, tuition, and other fees
              </p>
            </div>
          </div>
          <button 
            className="btn btnPrimary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={18} />
            Add Fee
          </button>
        </div>

        {message && (
          <div
            className="card"
            style={{
              marginBottom: 24,
              padding: 16,
              background: message.type === 'success' ? '#10b98120' : '#ef444420',
              borderLeft: `4px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            }}
          >
            <p style={{ color: message.type === 'success' ? '#10b981' : '#ef4444', margin: 0 }}>
              {message.text}
            </p>
          </div>
        )}

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <DollarSign size={24} style={{ color: 'var(--primary)' }} />
            <h3>Current Fee Structure</h3>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {fees.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>
                No fees configured. Click "Add Fee" to get started.
              </p>
            ) : (
              fees.map((fee, idx) => (
                <div
                  key={fee.id || idx}
                  className="card"
                  style={{ background: 'var(--surface-2)', padding: 20 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <h4 style={{ margin: 0 }}>{fee.name}</h4>
                        {fee.required && (
                          <span className="chip" style={{ fontSize: 12, padding: '2px 8px' }}>
                            Required
                          </span>
                        )}
                      </div>
                      {fee.description && (
                        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 12px 0' }}>
                          {fee.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
                        <div>
                          <span style={{ color: 'var(--muted)' }}>Amount: </span>
                          <span style={{ fontWeight: 600 }}>R{fee.amount.toLocaleString()}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted)' }}>Frequency: </span>
                          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                            {fee.frequency}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="iconBtn"
                        onClick={() => setEditingFee(fee)}
                        aria-label="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="iconBtn"
                        onClick={() => handleDeleteFee(fee.id!)}
                        aria-label="Delete"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>Uniform Pricing</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                Enable uniform sales and set pricing for your school.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={uniformPricing.enabled}
                onChange={(e) => setUniformPricing((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable Uniform Sales
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Full Set (R)</label>
              <input
                type="number"
                className="input"
                value={uniformPricing.setPrice}
                onChange={(e) => setUniformPricing((prev) => ({ ...prev, setPrice: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={!uniformPricing.enabled}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>T-shirt Only (R)</label>
              <input
                type="number"
                className="input"
                value={uniformPricing.tshirtPrice}
                onChange={(e) => setUniformPricing((prev) => ({ ...prev, tshirtPrice: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={!uniformPricing.enabled}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Shorts Only (R)</label>
              <input
                type="number"
                className="input"
                value={uniformPricing.shortsPrice}
                onChange={(e) => setUniformPricing((prev) => ({ ...prev, shortsPrice: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={!uniformPricing.enabled}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btnMuted" onClick={() => router.back()}>
            Cancel
          </button>
          <button 
            className="btn btnPrimary" 
            onClick={handleSaveFees}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Add/Edit Fee Modal */}
      {(showAddModal || editingFee) && (
        <FeeModal
          fee={editingFee || undefined}
          onSave={editingFee ? handleEditFee : handleAddFee}
          onClose={() => {
            setShowAddModal(false);
            setEditingFee(null);
          }}
        />
      )}
    </PrincipalShell>
  );
}

// Fee Modal Component (under 400 lines total)
function FeeModal({ 
  fee, 
  onSave, 
  onClose 
}: { 
  fee?: FeeItem; 
  onSave: (fee: FeeItem) => void; 
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<FeeItem>(
    fee || {
      name: '',
      amount: 0,
      frequency: 'monthly',
      required: false,
      description: '',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 24 }}>{fee ? 'Edit Fee' : 'Add New Fee'}</h3>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Fee Name *
            </label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Registration Fee"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Amount (ZAR) *
            </label>
            <input
              type="number"
              className="input"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Frequency *
            </label>
            <select
              className="input"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
              required
            >
              <option value="once">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Description
            </label>
            <textarea
              className="input"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="checkbox"
              id="required"
              checked={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="required" style={{ fontWeight: 500, cursor: 'pointer' }}>
              Required for all students
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <button type="button" className="btn btnMuted" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btnPrimary">
              {fee ? 'Update' : 'Add'} Fee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
