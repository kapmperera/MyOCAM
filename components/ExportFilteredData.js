"use client";

export default function ExportFilteredData({ data, filename = "Filtered_OCAM_Data" }) {
  const handleDownload = () => {
    if (!data || data.length === 0) {
      alert("No data available to export.");
      return;
    }

    // 1. Get the headers from the first object
    const headers = Object.keys(data[0]);

    // 2. Map data to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...data.map(row => 
        headers.map(header => {
          // Escape commas, quotes, and newlines in values
          const value = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          const escaped = value.replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(",")
      )
    ].join("\n");

    // 3. Create a Blob and trigger download
    const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button className="btn-primary" onClick={handleDownload}>
      Download Filtered Data (CSV)
    </button>
  );
}
