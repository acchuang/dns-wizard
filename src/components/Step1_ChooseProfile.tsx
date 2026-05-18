import { Profile, ProfileDef } from "../types";
import ProfileCard from "./ProfileCard";

const profiles: ProfileDef[] = [
  {
    id: "Gamer",
    label: "Gamer",
    description: "Lowest possible latency",
    icon: "zap",
  },
  {
    id: "Privacy",
    label: "Privacy",
    description: "Privacy-respecting providers",
    icon: "shield",
  },
  {
    id: "Family",
    label: "Family",
    description: "Block adult & malicious content",
    icon: "users",
  },
  {
    id: "AdBlock",
    label: "Ad-Free",
    description: "DNS-level ad blocking",
    icon: "ban",
  },
  {
    id: "Balanced",
    label: "Balanced",
    description: "Stable, high-speed default",
    icon: "scale",
  },
];

interface Props {
  onSelect: (profile: Profile) => void;
  applied: boolean;
  appliedProfile: Profile | null;
}

const wrapperStyle: React.CSSProperties = {
  flex: "0 0 100%",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  paddingTop: 20,
};

const gridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  justifyContent: "center",
  maxWidth: 460,
};

function Step1_ChooseProfile({ onSelect, applied, appliedProfile }: Props) {
  return (
    <div style={wrapperStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Choose a Profile</h1>
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, textAlign: "center" }}>
        What do you want your internet to do?
      </p>
      {applied && appliedProfile && (
        <p style={{ fontSize: 12, color: "#10b981", margin: 0 }}>
          DNS is active ({appliedProfile} profile applied)
        </p>
      )}
      <div style={gridStyle}>
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            onSelect={() => onSelect(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default Step1_ChooseProfile;
