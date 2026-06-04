interface Props {
  text: string;
  children: React.ReactNode;
}

function Tooltip({ text, children }: Props) {
  return (
    <span
      className="tooltip-wrapper"
      tabIndex={0}
      role="button"
      aria-describedby="tooltip-text"
    >
      {children}
      <span className="tooltip-box" role="tooltip" id="tooltip-text">{text}</span>
    </span>
  );
}

export default Tooltip;