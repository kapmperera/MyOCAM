"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { UploadCloud, FileType2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function UploadPage() {
  const [formData, setFormData] = useState({
    courseCode: "",
    moduleName: "",
    academicYear: "",
    semester: "",
  });

  const [files, setFiles] = useState({
    cat1Entry1: null,
    cat1Entry2: null,
    cat2Entry1: null,
    cat2Entry2: null,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error'
  const [mismatchModal, setMismatchModal] = useState(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileDrop = (e, fileType) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFiles({ ...files, [fileType]: e.dataTransfer.files[0] });
    }
  };

  const handleFileSelect = (e, fileType) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [fileType]: e.target.files[0] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadStatus(null);
    
    try {
      const formPayload = new FormData();
      formPayload.append('courseCode', formData.courseCode);
      formPayload.append('moduleName', formData.moduleName);
      formPayload.append('academicYear', formData.academicYear);
      formPayload.append('semester', formData.semester);
      
      formPayload.append('cat1Entry1', files.cat1Entry1);
      formPayload.append('cat1Entry2', files.cat1Entry2);
      formPayload.append('cat2Entry1', files.cat2Entry1);
      formPayload.append('cat2Entry2', files.cat2Entry2);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formPayload
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadStatus('success');

      // Automatically select the newly processed module
      if (data.moduleId) {
        await fetch('/api/modules/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId: data.moduleId })
        });
      }
      
      if (
        (data.mismatches && (data.mismatches.cat1 > 0 || data.mismatches.cat2 > 0)) ||
        (data.regMismatches && (data.regMismatches.cat1.length > 0 || data.regMismatches.cat2.length > 0)) ||
        (data.crossDatasetMismatches && data.crossDatasetMismatches.length > 0)
      ) {
        setMismatchModal({
          cat1: data.mismatches.cat1,
          cat2: data.mismatches.cat2,
          regMismatches: data.regMismatches || { cat1: [], cat2: [] },
          crossDatasetMismatches: data.crossDatasetMismatches || [],
          moduleId: data.moduleId
        });
      }
      
      // Reset files
      setFiles({
        cat1Entry1: null,
        cat1Entry2: null,
        cat2Entry1: null,
        cat2Entry2: null,
      });
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const FileUploadBox = ({ title, fileType, accept = ".xml" }) => (
    <div 
      className={styles.uploadBox}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => handleFileDrop(e, fileType)}
    >
      <input 
        type="file" 
        id={fileType} 
        accept={accept}
        className={styles.fileInput} 
        onChange={(e) => handleFileSelect(e, fileType)}
      />
      <label htmlFor={fileType} className={styles.uploadLabel}>
        {files[fileType] ? (
          <>
            <FileType2 size={32} className={styles.fileIconSelected} />
            <span className={styles.fileName}>{files[fileType].name}</span>
            <span className={styles.fileSize}>{(files[fileType].size / 1024).toFixed(1)} KB</span>
          </>
        ) : (
          <>
            <UploadCloud size={32} className={styles.fileIcon} />
            <span className={styles.uploadText}>Click or drag to upload</span>
            <span className={styles.uploadSubtext}>{title} ({accept})</span>
          </>
        )}
      </label>
    </div>
  );

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Data Upload & Processing</h1>
          <p className={styles.subtitle}>Upload XML data files for CAT marks and automatically process differences.</p>
        </div>
      </header>

      {uploadStatus === 'success' && (
        <div className={styles.alertSuccess}>
          <CheckCircle2 size={24} />
          <div>
            <strong>Upload Successful!</strong>
            <p>The files have been processed and OCAM calculations are ready to view.</p>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className={styles.alertError}>
          <AlertCircle size={24} />
          <div>
            <strong>Processing Error</strong>
            <p>There was a mismatch between Student IDs in CAT1 Entry 1 and Entry 2.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={`glass-panel ${styles.formSection}`}>
          <h3 className={styles.sectionTitle}>Module Details</h3>
          <div className={styles.inputGrid}>
            <div className={styles.inputGroup}>
              <label>Course Code</label>
              <input type="text" name="courseCode" required placeholder="e.g. CS101" onChange={handleInputChange} />
            </div>
            <div className={styles.inputGroup}>
              <label>Module Name</label>
              <input type="text" name="moduleName" required placeholder="e.g. Intro to Computer Science" onChange={handleInputChange} />
            </div>
            <div className={styles.inputGroup}>
              <label>Academic Year</label>
              <input type="text" name="academicYear" required placeholder="e.g. 2026-2027" onChange={handleInputChange} />
            </div>
            <div className={styles.inputGroup}>
              <label>Semester</label>
              <select name="semester" required onChange={handleInputChange} defaultValue="">
                <option value="" disabled>Select Semester</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.filesGrid}>
          <div className={`glass-panel ${styles.formSection}`}>
            <h3 className={styles.sectionTitle}>CAT 1 Data</h3>
            <div className={styles.uploadGrid}>
              <FileUploadBox title="CAT 1 - Entry 1" fileType="cat1Entry1" />
              <FileUploadBox title="CAT 1 - Entry 2" fileType="cat1Entry2" />
            </div>
          </div>

          <div className={`glass-panel ${styles.formSection}`}>
            <h3 className={styles.sectionTitle}>CAT 2 Data</h3>
            <div className={styles.uploadGrid}>
              <FileUploadBox title="CAT 2 - Entry 1" fileType="cat2Entry1" />
              <FileUploadBox title="CAT 2 - Entry 2" fileType="cat2Entry2" />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isUploading || !files.cat1Entry1 || !files.cat1Entry2 || !files.cat2Entry1 || !files.cat2Entry2}
          >
            {isUploading ? (
              <span className={styles.btnContent}><RefreshCw className={styles.spin} size={20} /> Processing...</span>
            ) : (
              "Process Files & Calculate OCAM"
            )}
          </button>
        </div>
      </form>

      {mismatchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            background: 'rgba(20, 20, 25, 0.95)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '16px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              marginBottom: '20px'
            }}>
              <AlertCircle size={48} />
            </div>
            
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>
              Mark Mismatches Detected!
            </h2>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '15px', lineHeight: '1.5' }}>
              We successfully processed the XML files, but discovered differences between the verification entries.
            </p>

            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '28px',
              textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '260px',
              overflowY: 'auto'
            }}>
              {/* Mark Mismatches */}
              {((mismatchModal.cat1 || 0) > 0 || (mismatchModal.cat2 || 0) > 0) && (
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', color: 'var(--accent-primary)' }}>
                    Type: Mark Verification Mismatches
                  </div>
                  {mismatchModal.cat1 > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--text-primary)', fontSize: '13px' }}>
                      <span>⚠️ <strong>CAT 1 Comparison</strong></span>
                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{mismatchModal.cat1} mismatches</span>
                    </div>
                  )}
                  {mismatchModal.cat2 > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: '13px' }}>
                      <span>⚠️ <strong>CAT 2 Comparison</strong></span>
                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{mismatchModal.cat2} mismatches</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reg No Mismatches */}
              {(((mismatchModal.regMismatches?.cat1 || []).length > 0) || ((mismatchModal.regMismatches?.cat2 || []).length > 0)) && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', color: '#f59e0b' }}>
                    Type: Registration Number Mismatch
                  </div>
                  
                  {mismatchModal.regMismatches.cat1.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        📍 <strong>CAT 1 Comparison</strong> ({mismatchModal.regMismatches.cat1.length} unmatched):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {mismatchModal.regMismatches.cat1.map(reg => (
                          <span key={reg} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                            {reg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {mismatchModal.regMismatches.cat2.length > 0 && (
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        📍 <strong>CAT 2 Comparison</strong> ({mismatchModal.regMismatches.cat2.length} unmatched):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {mismatchModal.regMismatches.cat2.map(reg => (
                          <span key={reg} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                            {reg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cross-Dataset Reg Mismatches */}
              {(mismatchModal.crossDatasetMismatches || []).length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', color: '#ef4444' }}>
                    Type: CAT 1 vs CAT 2 Registration Mismatch (Total: {mismatchModal.crossDatasetMismatches.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {mismatchModal.crossDatasetMismatches.map(item => (
                      <span key={item.id} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                        {item.id} ({item.type === 'missing_in_cat1' ? 'Missing in CAT 1' : 'Missing in CAT 2'})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setMismatchModal(null)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Dismiss
              </button>
              <a 
                href="/ocam"
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                Go to OCAM Page
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
