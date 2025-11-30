'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { useCreatePOPUpload, formatFileSize } from '@/lib/hooks/parent/usePOPUploads';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
}

interface POPUploadFormProps {
  linkedChildren: Child[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function POPUploadForm({ linkedChildren, onSuccess, onCancel }: POPUploadFormProps) {
  const { upload, uploading, error, success, reset } = useCreatePOPUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [selectedChild, setSelectedChild] = useState<string>(linkedChildren[0]?.id || '');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFT');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF and image files (JPG, PNG) are allowed');
      return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    reset();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !selectedChild) {
      alert('Please select a file and child');
      return;
    }
    
    const result = await upload({
      student_id: selectedChild,
      upload_type: 'proof_of_payment',
      title: paymentReference ? `Payment - ${paymentReference}` : 'Proof of Payment',
      description,
      file: selectedFile,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      payment_reference: paymentReference,
    });
    
    if (result) {
      onSuccess?.();
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    reset();
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') {
      return <FileText size={24} style={{ color: '#ef4444' }} />;
    }
    return <ImageIcon size={24} style={{ color: '#3b82f6' }} />;
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <CheckCircle2 size={64} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Upload Successful!</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
          Your proof of payment has been submitted and is pending review.
        </p>
        <button
          onClick={onSuccess}
          className="btn btnPrimary"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Child Selection */}
      {linkedChildren.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            For which child?
          </label>
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="input"
            style={{ width: '100%' }}
          >
            {linkedChildren.map((child) => (
              <option key={child.id} value={child.id}>
                {child.first_name} {child.last_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Payment Reference */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          Payment Reference <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Optional)</span>
        </label>
        <input
          type="text"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder="e.g., TXN123456"
          className="input"
          style={{ width: '100%' }}
        />
      </div>

      {/* Payment Amount */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          Amount Paid <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Optional)</span>
        </label>
        <div style={{ position: 'relative' }}>
          <span style={{ 
            position: 'absolute', 
            left: 12, 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--muted)'
          }}>R</span>
          <input
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
            className="input"
            style={{ width: '100%', paddingLeft: 28 }}
            step="0.01"
            min="0"
          />
        </div>
      </div>

      {/* Payment Method & Date Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="input"
            style={{ width: '100%' }}
          >
            <option value="EFT">EFT / Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card Payment</option>
            <option value="Other">Other</option>
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            Payment Date
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="input"
            style={{ width: '100%' }}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          Notes <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any additional notes about this payment..."
          className="input"
          style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
        />
      </div>

      {/* File Upload Area */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          Upload Proof of Payment *
        </label>
        
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              cursor: 'pointer',
              background: dragActive ? 'rgba(124, 58, 237, 0.05)' : 'var(--surface)',
              transition: 'all 0.2s',
            }}
          >
            <Upload size={40} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              Click to upload or drag and drop
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              PDF, JPG or PNG (max 10MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            background: 'var(--surface)',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}>
            {getFileIcon(selectedFile.type)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {formatFileSize(selectedFile.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={removeFile}
              style={{
                padding: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <X size={16} style={{ color: '#ef4444' }} />
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'start',
          gap: 8,
        }}>
          <X size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 14, color: '#ef4444', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btnSecondary"
            style={{ flex: 1 }}
            disabled={uploading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btnPrimary"
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 8,
            opacity: uploading || !selectedFile ? 0.6 : 1,
            cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
          }}
          disabled={uploading || !selectedFile}
        >
          {uploading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
          {uploading ? 'Uploading...' : 'Submit Proof of Payment'}
        </button>
      </div>
    </form>
  );
}
