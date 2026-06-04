use std::net::IpAddr;
use std::collections::HashSet;

pub fn normalize_ip(ip: &str) -> Option<String> {
    let parsed: IpAddr = ip.parse().ok()?;
    match parsed {
        IpAddr::V4(v4) => Some(v4.to_string()),
        IpAddr::V6(v6) => Some(v6.to_string()),
    }
}

pub fn normalized_set(ips: &[String]) -> HashSet<String> {
    ips.iter()
        .filter_map(|ip| normalize_ip(ip))
        .collect()
}