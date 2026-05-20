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
  selected?: boolean;
}

function ProfileCard({ profile, onSelect, selected = false }: Props) {
  const Icon = iconMap[profile.icon];
  return (
    <div
      className={`dns-profile-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <Icon size={28} className="dns-profile-icon" />
      <span className="dns-profile-name">{profile.label}</span>
      <span className="dns-profile-desc">{profile.description}</span>
    </div>
  );
}

export default ProfileCard;
