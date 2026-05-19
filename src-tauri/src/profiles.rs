use serde::{Serialize, Deserialize};
use crate::dns_bench::DnsProvider;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum UserProfile {
    Gamer,
    Family,
    Privacy,
    AdBlock,
    Balanced,
    ControlD,
    OpenDNS,
    Comodo,
}

pub fn get_profile_providers(profile: UserProfile) -> Vec<DnsProvider> {
    match profile {
        UserProfile::Gamer => vec![
            DnsProvider { name: "Cloudflare".to_string(), ip: "1.1.1.1".to_string(), latency: None },
            DnsProvider { name: "Cloudflare IPv6".to_string(), ip: "2606:4700:4700::1111".to_string(), latency: None },
            DnsProvider { name: "Google".to_string(), ip: "8.8.8.8".to_string(), latency: None },
            DnsProvider { name: "Google IPv6".to_string(), ip: "2001:4860:4860::8888".to_string(), latency: None },
        ],
        UserProfile::Family => vec![
            DnsProvider { name: "Cloudflare Family".to_string(), ip: "1.1.1.3".to_string(), latency: None },
            DnsProvider { name: "Cloudflare Family IPv6".to_string(), ip: "2606:4700:4700::1113".to_string(), latency: None },
            DnsProvider { name: "CleanBrowsing".to_string(), ip: "185.228.168.168".to_string(), latency: None },
            DnsProvider { name: "CleanBrowsing IPv6".to_string(), ip: "2a0d:2a00:1::2".to_string(), latency: None },
        ],
        UserProfile::Privacy => vec![
            DnsProvider { name: "Quad9".to_string(), ip: "9.9.9.9".to_string(), latency: None },
            DnsProvider { name: "Quad9 IPv6".to_string(), ip: "2620:fe::fe".to_string(), latency: None },
            DnsProvider { name: "Mullvad DNS".to_string(), ip: "194.242.2.2".to_string(), latency: None },
            DnsProvider { name: "Mullvad DNS IPv6".to_string(), ip: "2a07:e340::2".to_string(), latency: None },
        ],
        UserProfile::AdBlock => vec![
            DnsProvider { name: "AdGuard DNS".to_string(), ip: "94.140.14.14".to_string(), latency: None },
            DnsProvider { name: "AdGuard DNS IPv6".to_string(), ip: "2a10:50c0::ad1:ff".to_string(), latency: None },
            DnsProvider { name: "NextDNS".to_string(), ip: "45.45.46.46".to_string(), latency: None },
        ],
        UserProfile::Balanced => vec![
            DnsProvider { name: "Cloudflare".to_string(), ip: "1.1.1.1".to_string(), latency: None },
            DnsProvider { name: "Cloudflare IPv6".to_string(), ip: "2606:4700:4700::1111".to_string(), latency: None },
            DnsProvider { name: "Google".to_string(), ip: "8.8.8.8".to_string(), latency: None },
            DnsProvider { name: "Google IPv6".to_string(), ip: "2001:4860:4860::8888".to_string(), latency: None },
            DnsProvider { name: "Quad9".to_string(), ip: "9.9.9.9".to_string(), latency: None },
            DnsProvider { name: "Quad9 IPv6".to_string(), ip: "2620:fe::fe".to_string(), latency: None },
        ],
        UserProfile::ControlD => vec![
            DnsProvider { name: "Control D".to_string(), ip: "76.76.2.0".to_string(), latency: None },
            DnsProvider { name: "Control D Alt".to_string(), ip: "76.76.10.0".to_string(), latency: None },
            DnsProvider { name: "Control D IPv6".to_string(), ip: "2606:1c40::2".to_string(), latency: None },
            DnsProvider { name: "Control D Alt IPv6".to_string(), ip: "2606:1c40:1::2".to_string(), latency: None },
        ],
        UserProfile::OpenDNS => vec![
            DnsProvider { name: "OpenDNS".to_string(), ip: "208.67.222.222".to_string(), latency: None },
            DnsProvider { name: "OpenDNS Family".to_string(), ip: "208.67.220.220".to_string(), latency: None },
            DnsProvider { name: "OpenDNS IPv6".to_string(), ip: "2620:0:ccc::2".to_string(), latency: None },
        ],
        UserProfile::Comodo => vec![
            DnsProvider { name: "Comodo Secure".to_string(), ip: "8.26.56.26".to_string(), latency: None },
            DnsProvider { name: "Comodo Secure Alt".to_string(), ip: "8.20.247.20".to_string(), latency: None },
        ],
    }
}

pub fn get_all_providers() -> Vec<DnsProvider> {
    let profiles = [
        UserProfile::Gamer,
        UserProfile::Family,
        UserProfile::Privacy,
        UserProfile::AdBlock,
        UserProfile::Balanced,
        UserProfile::ControlD,
        UserProfile::OpenDNS,
        UserProfile::Comodo,
    ];
    let mut seen = std::collections::HashSet::new();
    let mut all = Vec::new();
    for profile in &profiles {
        for p in get_profile_providers(profile.clone()) {
            if seen.insert(p.ip.clone()) {
                all.push(p);
            }
        }
    }
    all
}