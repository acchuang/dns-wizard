import { Profile, ProfileDef, NetworkInfo } from "../types";
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
  { id: "ControlD", label: "Control D", description: "Filtering & customization", icon: "filter" },
  { id: "OpenDNS", label: "OpenDNS", description: "Security & parental controls", icon: "lock" },
  { id: "Comodo", label: "Comodo Secure", description: "Malware & phishing protection", icon: "shieldCheck" },
];

interface Props {
  onSelect: (profile: Profile) => void;
  applied: boolean;
  appliedProfile: Profile | null;
  networkInfo: NetworkInfo | null;
  selectedProfile?: Profile | null;
}

function Step1_ChooseProfile({ onSelect, applied, appliedProfile, networkInfo, selectedProfile }: Props) {
  return (
    <div className="dns-step-wrapper">
      <h1 className="dns-step-title">Choose a Profile</h1>
      <p className="dns-step-desc">What do you want your internet to do?</p>
      {applied && appliedProfile && (
        <p className="dns-step-applied">DNS is active ({appliedProfile} profile applied)</p>
      )}
      {networkInfo && (
        <p className="dns-step-network">
          Active: {networkInfo.service}
          {networkInfo.servers.length > 0 ? ` · DNS: ${networkInfo.servers.join(", ")}` : " · DNS: DHCP (automatic)"}
        </p>
      )}
      <div className="dns-profile-grid">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            onSelect={() => onSelect(p.id)}
            selected={selectedProfile === p.id}
          />
        ))}
      </div>
    </div>
  );
}

export default Step1_ChooseProfile;
