import { Zap, Shield, Users, Ban, Scale, ListFilter, Lock, ShieldCheck } from "lucide-react";
import { ProfileDef } from "../types";

const iconMap = {
  zap: Zap,
  shield: Shield,
  users: Users,
  ban: Ban,
  scale: Scale,
  filter: ListFilter,
  lock: Lock,
  shieldCheck: ShieldCheck,
};

interface Props {
  profile: ProfileDef;
  onSelect: () => void;
}

const cardStyle: React.CSSProperties = {
  background: "#16213e",
  borderRadius: 12,
  padding: "20px 16px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  boxShadow: "0 0 0 0px transparent",
  transition: "box-shadow 0.2s ease, transform 0.2s ease",
  width: "100%",
};

function ProfileCard({ profile, onSelect }: Props) {
  const Icon = iconMap[profile.icon];

  return (
    <div
      style={cardStyle}
      onClick={onSelect}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px #7c3aed";
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 0px transparent";
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
      }}
    >
      <Icon size={28} color="#7c3aed" />
      <span style={{ fontSize: 18, fontWeight: 600 }}>{profile.label}</span>
      <span style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 1.4 }}>
        {profile.description}
      </span>
    </div>
  );
}

export default ProfileCard;
