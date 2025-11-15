'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { uploadMultipleImages } from '@/lib/simple-image-upload';

interface ImageUploadProps {
  onSelect: (images: Array<{ data: string; media_type: string; preview: string; url?: string }>) => void;
  onClose: () => void;
  maxImages?: number;
}

export function ImageUpload({ onSelect, onClose, maxImages = 3 }: ImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [processedFiles, setProcessedFiles] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    setError(null);
    const fileArray = Array.from(files).slice(0, maxImages);
    const newPreviews: string[] = [];

    // Enhanced file validation
    const invalidFiles = fileArray.filter(f => !f.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      setError('Only image files are allowed (JPG, PNG, WebP, etc.)');
      return;
    }

    // Check for oversized files with better messaging
    const maxSizeMB = 20; // Reduced from 50MB for better UX
    const oversizedFiles = fileArray.filter(f => f.size > maxSizeMB * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      const sizeMB = (oversizedFiles[0].size / 1024 / 1024).toFixed(1);
      setError(`Image too large (${sizeMB}MB). Please use photos under ${maxSizeMB}MB for faster upload.`);
      return;
    }

    // Check total batch size to prevent memory issues
    const totalSizeMB = fileArray.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;
    if (totalSizeMB > 30) {
      setError(`Total batch too large (${totalSizeMB.toFixed(1)}MB). Please select fewer or smaller images.`);
      return;
    }

    // Process files with memory management
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      try {
        const preview = await createOptimizedPreview(file);
        newPreviews.push(preview);

        // Update progress
        setProcessedFiles(i + 1);

        // Force garbage collection for large files
        if (file.size > 5 * 1024 * 1024) {
          if (global.gc) global.gc();
        }
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        setError(`Could not process "${file.name}". Please try a different image.`);
        return;
      }
    }

    setPreviews(newPreviews);
    setSelectedFiles(fileArray);
    setProcessedFiles(0);
  };

  // Create optimized preview with memory management
  const createOptimizedPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // For small files, use direct file reader
      if (file.size < 2 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as string);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // For larger files, create compressed preview
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas not available'));
        return;
      }

      img.onload = () => {
        try {
          // Calculate preview dimensions (max 800px for preview)
          const maxPreviewSize = 800;
          let width = img.width;
          let height = img.height;

          if (width > maxPreviewSize || height > maxPreviewSize) {
            const ratio = Math.min(maxPreviewSize / width, maxPreviewSize / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          // Create preview with good quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  if (e.target?.result) {
                    resolve(e.target.result as string);
                  } else {
                    reject(new Error('Failed to create preview'));
                  }
                };
                reader.readAsDataURL(blob);
              } else {
                reject(new Error('Failed to create preview blob'));
              }
            },
            'image/jpeg',
            0.85
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for preview'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleConfirm = async () => {
    setUploading(true);
    setCompressing(true);
    setError(null);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    try {
      console.log('[ImageUpload] Processing', selectedFiles.length, 'images...');

      // Show compression message for large files
      const hasLargeFiles = selectedFiles.some(f => f.size > 5 * 1024 * 1024);
      if (hasLargeFiles) {
        console.log('[ImageUpload] Large files detected, compression may take a moment...');
      }

      // Process files one by one for better progress tracking
      const uploadResults = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        try {
          setUploadProgress({ current: i + 1, total: selectedFiles.length });
          const result = await uploadSingleImage(selectedFiles[i]);
          uploadResults.push(result);
        } catch (fileError) {
          console.error(`Error uploading file ${selectedFiles[i].name}:`, fileError);
          setError(`Failed to upload "${selectedFiles[i].name}". Please try again.`);
          setUploading(false);
          setCompressing(false);
          return;
        }
      }

      setCompressing(false);
      console.log('[ImageUpload] Upload complete, processing results...');

      // Convert to format expected by chat
      const processedImages = uploadResults.map((result, index) => ({
        data: result.base64!,
        media_type: 'image/jpeg' as const,
        preview: previews[index],
        url: result.url, // Include the storage URL
      }));

      // Success feedback before selecting
      setTimeout(() => {
        onSelect(processedImages);
      }, 500); // Small delay for success state
    } catch (err: any) {
      console.error('[ImageUpload] Upload failed:', err);
      setError(err?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setCompressing(false);
    }
  };

  // Upload single image with better error handling
  const uploadSingleImage = async (file: File) => {
    // This would use the same uploadMultipleImages logic but for individual files
    const results = await uploadMultipleImages([file], true);
    return results[0];
  };

  const removeImage = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 0,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        style={{
          background: 'var(--surface-0)',
          borderRadius: '32px 32px 0 0',
          padding: '32px 24px 40px',
          maxWidth: 680,
          width: '100%',
          maxHeight: '88vh',
          overflow: 'auto',
          border: isDragging ? '3px dashed var(--primary)' : '1px solid var(--border)',
          boxShadow: isDragging
            ? '0 -8px 40px rgba(124, 58, 237, 0.3)'
            : '0 -8px 32px rgba(0, 0, 0, 0.4)',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transition: 'all 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(124, 58, 237, 0.1)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '32px 32px 0 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              border: '3px dashed var(--primary)',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              <Upload size={40} color="white" />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text)',
                textAlign: 'center',
              }}
            >
              Drop images here
            </h3>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 16,
                color: 'var(--muted)',
                textAlign: 'center',
              }}
            >
              Release to add photos to your message
            </p>
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)',
                animation: !isDragging ? 'slideUp 0.5s ease-out 0.2s both' : 'none',
              }}
            >
              <ImageIcon size={24} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                {uploading ? 'Processing Images' : isDragging ? 'Drop to Upload' : 'Add Images'}
              </h3>
              {!uploading && !isDragging && (
                <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
                  Upload photos or drag & drop here
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              background: uploading ? 'transparent' : 'var(--surface-1)',
              border: uploading ? 'none' : '1px solid var(--border)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              padding: 12,
              borderRadius: '50%',
              color: uploading ? 'var(--muted)' : 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              transition: 'all 0.2s ease',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Processing Progress */}
        {(uploading || processedFiles > 0) && (
          <div style={{
            marginBottom: 24,
            padding: 16,
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(236, 72, 153, 0.05))',
            borderRadius: 16,
            border: '1px solid rgba(124, 58, 237, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {compressing ? (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                ) : (
                  <CheckCircle size={16} color="white" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {compressing ? 'Optimizing images...' : 'Processing complete'}
                </h4>
                {uploadProgress && (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                    File {uploadProgress.current} of {uploadProgress.total}
                  </p>
                )}
              </div>
            </div>
            {uploadProgress && (
              <div style={{
                width: '100%',
                height: 6,
                background: 'var(--surface-1)',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </div>
        )}

        {/* Upload Options */}
        {selectedFiles.length === 0 && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              capture="environment"
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn"
              style={{
                flex: 1,
                padding: '28px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                background: 'var(--surface-1)',
                border: '2px solid var(--border)',
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--surface-2)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface-1)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.1)',
                }}
              >
                <Upload size={26} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Gallery</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                Choose from photos<br/>
                <span style={{ fontSize: 11, opacity: 0.7 }}>JPG, PNG, WebP up to 20MB</span>
              </span>
            </button>

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="btn"
              style={{
                flex: 1,
                padding: '28px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                background: 'var(--surface-1)',
                border: '2px solid var(--border)',
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--surface-2)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface-1)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.1)',
                }}
              >
                <Camera size={26} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Camera</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                Take a photo<br/>
                <span style={{ fontSize: 11, opacity: 0.7 }}>High quality capture</span>
              </span>
            </button>
          </div>
        )}

        {/* Preview Grid */}
        {previews.length > 0 && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {previews.map((preview, index) => (
                <div
                  key={index}
                  style={{
                    position: 'relative',
                    paddingTop: '100%',
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '2px solid var(--primary)',
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.2)',
                  }}
                >
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <button
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.8)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    <X size={14} color="white" />
                  </button>
                </div>
              ))}
            </div>

            {/* Info / Error */}
            {error ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 12,
                  marginBottom: 16,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ef4444',
                  }}
                />
                <p style={{ fontSize: 13, color: '#ef4444', margin: 0, fontWeight: 500 }}>
                  {error}
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(236, 72, 153, 0.05))',
                  borderRadius: 12,
                  marginBottom: 16,
                  border: '1px solid rgba(124, 58, 237, 0.1)',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                  }}
                />
                <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500 }}>
                  {selectedFiles.length} of {maxImages} images selected
                  {selectedFiles.some(f => f.size > 5 * 1024 * 1024) && 
                    ' • Large photos will be compressed'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setSelectedFiles([]);
                  setPreviews([]);
                  setError(null);
                }}
                className="btn"
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                Clear
              </button>
              <button
                onClick={handleConfirm}
                disabled={uploading}
                className="btn btnPrimary"
                style={{
                  flex: 2,
                  padding: '12px 20px',
                  background: uploading 
                    ? 'var(--surface-2)' 
                    : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                  color: uploading ? 'var(--text)' : 'white',
                  border: 'none',
                  fontWeight: 600,
                  borderRadius: 12,
                  fontSize: 15,
                  boxShadow: uploading ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {uploading ? (
                  <>
                    <div 
                      style={{
                        width: 16,
                        height: 16,
                        border: '2px solid rgba(124, 58, 237, 0.3)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    {compressing ? 'Compressing...' : 'Uploading...'}
                  </>
                ) : (
                  'Add to Message'
                )}
              </button>
            </div>
          </>
        )}

        {/* Help Text */}
        <div
          style={{
            marginTop: 20,
            padding: '12px 16px',
            background: 'var(--surface-1)',
            borderRadius: 12,
            borderLeft: '3px solid var(--primary)',
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            💡 <strong>Dash can analyze images</strong> to help with diagrams, math problems, homework, and more!
          </p>
        </div>
      </div>
      
      {/* Enhanced animations */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        .btn:disabled {
          animation: pulse 2s ease-in-out infinite;
        }

        .btn:not(:disabled):active {
          transform: scale(0.95);
        }

        /* Modern scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: var(--surface-1);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, var(--primary), var(--muted));
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, var(--primary), var(--text));
        }

        /* Image hover effects */
        .preview-image {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .preview-image:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 25px rgba(124, 58, 237, 0.25);
        }

        /* Button hover enhancement */
        .modern-button {
          position: relative;
          overflow: hidden;
        }

        .modern-button::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          transition: width 0.6s ease, height 0.6s ease;
        }

        .modern-button:hover::before {
          width: 300px;
          height: 300px;
        }
      `}</style>
    </div>
  );
}
