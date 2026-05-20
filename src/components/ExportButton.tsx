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
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
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
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
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
              color: "var(--text-primary)",
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
              color: "var(--text-primary)",
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
