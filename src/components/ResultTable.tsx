interface Column {
  key: string;
  label: string;
}

interface Props {
  columns: Column[];
  rows: Record<string, React.ReactNode>[];
}

function ResultTable({ columns, rows }: Props) {
  return (
    <table className="result-table">
      <thead>
        <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => <td key={col.key}>{row[col.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ResultTable;
