interface Props {
  text: string;
  children: React.ReactNode;
}

function Tooltip({ text, children }: Props) {
  return (
    <span className="tooltip-wrapper" style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {children}
      <span className="tooltip-box">{text}</span>
    </span>
  );
}

export default Tooltip;