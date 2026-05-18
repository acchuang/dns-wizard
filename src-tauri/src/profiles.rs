use serde::{Serialize, Deserialize};
use crate::dns_bench::DnsProvider;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum UserProfile {
    Gamer,
    Family,
    Privacy,
    AdBlock,
    Balanced,
}

pub fn get_profile_providers(profile: UserProfile) -> Vec<DnsProvider> {
    match profile {
        UserProfile::Gamer => vec![
            DnsProvider { name: "Cloudflare".to_string(), ip: "1.1.1.1".to_string(), latency: None },
            DnsProvider { name: "Google".to_string(), ip: "8.8.8.8".to_string(), latency: None },
        ],
        UserProfile::Family => vec![
            DnsProvider { name: "Cloudflare Family".to_string(), ip: "1.1.1.3".to_string(), latency: None },
            DnsProvider { name: "CleanBrowsing".to_string(), ip: "185.228.168.168".to_string(), latency: None },
        ],
        UserProfile::Privacy => vec![
            DnsProvider { name: "Quad9".to_string(), ip: "9.9.9.9".to_string(), latency: None },
            DnsProvider { name: "Mullvad DNS".to_string(), ip: "194.242.2.2".to_string(), latency: None },
        ],
        UserProfile::AdBlock => vec![
            DnsProvider { name: "AdGuard DNS".to_string(), ip: "94.100.104.4".to_string(), latency: None },
            DnsProvider { name: "NextDNS".to_string(), ip: "45.45.46.46".to_string(), latency: None },
        ],
        UserProfile::Balanced => vec![
            DnsProvider { name: "Cloudflare".to_string(), ip: "1.1.1.1".to_string(), latency: None },
            DnsProvider { name: "Google".to_string(), ip: "8.8.8.8".to_string(), latency: None },
            DnsProvider { name: "Quad9".to_string(), ip: "9.9.9.9".to_string(), latency: None },
        ],
    }
}
