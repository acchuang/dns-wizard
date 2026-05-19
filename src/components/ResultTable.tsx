interface Column {
  key: string;
  label: string;
}

interface Props {
  columns: Column[];
  rows: Record<string, React.ReactNode>[];
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  borderBottom: "1px solid #334155",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 14,
  borderBottom: "1px solid #1e293b",
};

function ResultTable({ columns, rows }: Props) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>{columns.map((col) => <th key={col.key} style={thStyle}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => <td key={col.key} style={tdStyle}>{row[col.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ResultTable;