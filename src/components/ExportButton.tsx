import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  data: Record<string, string | number | null>[];
  filename: string;
  label?: string;
}

function toCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ),
  ];
  return lines.join("\n");
}

function toJson(rows: Record<string, string | number | null>[]): string {
  return JSON.stringify(rows, null, 2);
}

function ExportButton({ data, filename, label = "Export" }: Props) {
  const [open, setOpen] = useState(false);

  const handleExport = async (format: "csv" | "json") => {
    setOpen(false);
    const content = format === "csv" ? toCsv(data) : toJson(data);
    const ext = format === "csv" ? "csv" : "json";
    const defaultPath = `${filename}.${ext}`;

    const path = await save({
      defaultPath,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }],
    });

    if (path) {
      await invoke("save_file", { path, content });
    }
  };

  if (data.length === 0) return null;

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: "4px 10px",
          borderRadius: 4,
          border: "1px solid #334155",
          background: "transparent",
          color: "#94a3b8",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 4,
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: 4,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <button
            onClick={() => handleExport("csv")}
            style={{
              padding: "6px 12px",
              border: "none",
              background: "transparent",
              color: "#e2e8f0",
              fontSize: 12,
              cursor: "pointer",
              textAlign: "left",
              borderRadius: 4,
            }}
          >
            Export as CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            style={{
              padding: "6px 12px",
              border: "none",
              background: "transparent",
              color: "#e2e8f0",
              fontSize: 12,
              cursor: "pointer",
              textAlign: "left",
              borderRadius: 4,
            }}
          >
            Export as JSON
          </button>
        </div>
      )}
    </span>
  );
}

export default ExportButton;