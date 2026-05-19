use hickory_resolver::TokioAsyncResolver;
use hickory_resolver::config::{ResolverConfig, ResolverOpts};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DnsLeakResult {
    pub configured_servers: Vec<String>,
    pub detected_servers: Vec<String>,
    pub is_leaking: Option<bool>,
}

pub async fn run_dns_leak_test(configured_servers: Vec<String>) -> Result<DnsLeakResult, String> {
    let config = ResolverConfig::default();
    let opts = ResolverOpts::default();

    let resolver = TokioAsyncResolver::tokio(config, opts);

    let mut detected: Vec<String> = Vec::new();

    // Primary: whoami.ds.akahelp.net returns the IP of the resolving server
    match resolver.lookup_ip("whoami.ds.akahelp.net").await {
        Ok(response) => {
            for ip in response.iter() {
                detected.push(ip.to_string());
            }
        }
        Err(_) => {}
    }

    // Secondary: resolver.dnscrypt.info
    match resolver.lookup_ip("resolver.dnscrypt.info").await {
        Ok(response) => {
            for ip in response.iter() {
                if !detected.contains(&ip.to_string()) {
                    detected.push(ip.to_string());
                }
            }
        }
        Err(_) => {}
    }

    // Deduplicate
    detected.sort();
    detected.dedup();

    let is_leaking = if configured_servers.is_empty() {
        None // Can't determine without a baseline
    } else {
        let configured_set: std::collections::HashSet<String> = configured_servers.iter().cloned().collect();
        let detected_set: std::collections::HashSet<String> = detected.iter().cloned().collect();

        // Leaking if ANY detected server is not in the configured set
        let has_leak = detected_set.iter().any(|d| !configured_set.contains(d));
        let has_match = detected_set.iter().any(|d| configured_set.contains(d));

        Some(if has_leak && has_match { false } else if has_leak { true } else { false })
    };

    Ok(DnsLeakResult {
        configured_servers,
        detected_servers: detected,
        is_leaking,
    })
}