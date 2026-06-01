"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, Trash2, Save, FileSpreadsheet } from "lucide-react";

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [sample, setSample] = useState([]);
  const [file, setFile] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }

  // Load current settings status on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
        setTotalCount(data.totalCount);
        setSample(data.sample || []);
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleChange = async (e) => {
    const val = e.target.checked;
    setEnabled(val);
    
    try {
      const res = await fetch('/api/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: val })
      });
      if (!res.ok) {
        throw new Error("Failed to save toggle state");
      }
      setStatus({
        type: 'success',
        message: `Registered Center column successfully ${val ? 'enabled' : 'disabled'}.`
      });
    } catch (err) {
      setEnabled(!val); // Revert
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus(null);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsSaving(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/settings/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      setStatus({ type: 'success', message: data.message });
      setFile(null);
      // Refresh count and list
      await fetchSettings();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete all registered center mappings? This cannot be undone.")) {
      setIsDeleting(true);
      setStatus(null);
      try {
        const res = await fetch('/api/settings', { method: 'DELETE' });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Failed to delete mapping data");
        }

        setStatus({ type: 'success', message: data.message });
        setTotalCount(0);
        setSample([]);
      } catch (err) {
        setStatus({ type: 'error', message: err.message });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>System Settings</h1>
        <p className={styles.subtitle}>Configure global system preferences and registered centers.</p>
      </header>

      {status && (
        <div className={status.type === 'success' ? styles.alertSuccess : styles.alertError}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <div>
            <strong>{status.type === 'success' ? 'Success' : 'Error'}</strong>
            <div className={styles.alertText}>{status.message}</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <RefreshCw className={styles.spin} size={28} />
          <span style={{ marginLeft: '12px', fontSize: '15px' }}>Loading Settings...</span>
        </div>
      ) : (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '24px' }}>
          
          {/* Enable / Disable Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionTitle}>
              Registered Center Integration
            </div>
            
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <h3>Registered Center Column</h3>
                <p>Toggle this on to show a dedicated "Registered Center" column inside the CAT 1 and CAT 2 comparison pages.</p>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={enabled} 
                  onChange={handleToggleChange} 
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </section>

          {/* Add Center File Upload Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionTitle}>
              Add Center / Mapping Upload
            </div>

            <div 
              className={styles.uploadBox}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <input 
                type="file" 
                className={styles.fileInput} 
                accept=".xlsx,.xls,.csv" 
                onChange={handleFileSelect} 
              />
              <div className={styles.uploadLabel}>
                <UploadCloud 
                  className={file ? styles.fileIconSelected : styles.fileIcon} 
                  size={48} 
                />
                {file ? (
                  <>
                    <span className={styles.fileName}>{file.name}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {(file.size / 1024).toFixed(1)} KB — Ready to save
                    </span>
                  </>
                ) : (
                  <>
                    <span className={styles.uploadText}>
                      Drag and drop your center mapping document here
                    </span>
                    <span className={styles.uploadSubtext}>
                      Supports Excel (.xlsx, .xls) and CSV (.csv) files
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className={styles.buttonRow}>
              {totalCount > 0 && (
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving}
                  className="btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                >
                  {isDeleting ? <RefreshCw className={styles.spin} size={16} /> : <Trash2 size={16} />}
                  <span>Delete Mappings</span>
                </button>
              )}
              
              <button 
                onClick={handleUpload}
                disabled={!file || isSaving || isDeleting}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isSaving ? <RefreshCw className={styles.spin} size={16} /> : <Save size={16} />}
                <span>Save Mapping Data</span>
              </button>
            </div>
          </section>

          {/* Active Center Mapping List */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionTitle}>
              <span>Active Mapping Overview</span>
              {totalCount > 0 && (
                <span style={{ fontSize: '13px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '20px' }}>
                  {totalCount} Students Mapped
                </span>
              )}
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Registration Number</th>
                    <th>Registered Center Name</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.length > 0 ? (
                    sample.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>{m.registrationNumber}</td>
                        <td>{m.centerName}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" className={styles.noData}>
                        <FileSpreadsheet size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
                        <div>No center mapping file uploaded. Upload an Excel or CSV mapping file above.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
