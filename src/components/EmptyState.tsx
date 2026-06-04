interface Props {
  icon: string;
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: Props) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{icon}</span>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
    </div>
  );
}

export default EmptyState;