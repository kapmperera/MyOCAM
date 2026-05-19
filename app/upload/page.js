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

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      setUploadStatus('success');
      // Reset form conditionally or redirect
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
    </div>
  );
}
