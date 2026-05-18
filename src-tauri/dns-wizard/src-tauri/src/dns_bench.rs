use std::time::Instant;
use trust_dns_resolver::config::*;
use trust_dns_resolver::TokioAsyncResolver;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DnsProvider {
    pub name: String,
    pub ip: String,
    pub latency: Option<u128>,
}

pub async fn benchmark_dns(providers: Vec<DnsProvider>) -> Vec<DnsProvider> {
    let mut results = providers;
    let domain_to_test = "google.com";

    for provider in results.iter_mut() {
        // Correct way to set up a specific NameServer for testing
        let ns = NameServer {
            ip: provider.ip.parse().unwrap_or_else(|_| "0.0.0.0".parse().unwrap()),
            protocol: Protocol::Udp,
        };
        
        let config = ResolverConfig::from([ns]);
        
        let resolver = match TokioAsyncResolver::tokio(config, ResolverOpts::default()) {
            Ok(r) => r,
            Err(_) => {
                provider.latency = Some(u128::MAX);
                continue;
            }
        };

        let start = Instant::now();
        match resolver.lookup_ip(domain_to_test).await {
            Ok(_) => {
                provider.latency = Some(start.elapsed().as_millis());
            }
            Err(_) => {
                provider.latency = Some(u128::MAX); 
            }
        }
    }

    results.sort_by(|a, b| a.latency.unwrap_or(u128::MAX).cmp(&b.latency.unwrap_or(u128::MAX)));
    results
}
