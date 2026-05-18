use std::time::{Duration, Instant};
use hickory_resolver::config::{NameServerConfig, Protocol, ResolverConfig, ResolverOpts};
use hickory_resolver::TokioAsyncResolver;
use serde::{Serialize, Deserialize};
use tokio::time::timeout;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DnsProvider {
    pub name: String,
    pub ip: String,
    pub latency: Option<u128>,
}

const BENCHMARK_TIMEOUT_SECS: u64 = 5;

pub async fn benchmark_dns(providers: Vec<DnsProvider>) -> Vec<DnsProvider> {
    let mut results = providers;

    for provider in results.iter_mut() {
        let ip: std::net::IpAddr = match provider.ip.parse() {
            Ok(addr) => addr,
            Err(_) => {
                provider.latency = Some(u128::MAX);
                continue;
            }
        };

        let ns = NameServerConfig {
            socket_addr: std::net::SocketAddr::new(ip, 53),
            protocol: Protocol::Udp,
            tls_dns_name: None,
            trust_negative_responses: false,
            bind_addr: None,
        };

        let config = ResolverConfig::from_parts(None, vec![], vec![ns]);
        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_millis(2000);

        let resolver = TokioAsyncResolver::tokio(config, opts);

        let start = Instant::now();
        let result = timeout(
            Duration::from_secs(BENCHMARK_TIMEOUT_SECS),
            resolver.lookup_ip("google.com"),
        )
        .await;

        match result {
            Ok(Ok(_)) => {
                provider.latency = Some(start.elapsed().as_millis());
            }
            _ => {
                provider.latency = Some(u128::MAX);
            }
        }
    }

    results.sort_by(|a, b| {
        a.latency
            .unwrap_or(u128::MAX)
            .cmp(&b.latency.unwrap_or(u128::MAX))
    });
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dns_provider_serialization() {
        let provider = DnsProvider {
            name: "Cloudflare".to_string(),
            ip: "1.1.1.1".to_string(),
            latency: Some(12),
        };
        let json = serde_json::to_string(&provider).unwrap();
        assert!(json.contains("Cloudflare"));
        assert!(json.contains("1.1.1.1"));
    }

    #[test]
    fn test_dns_provider_none_latency() {
        let provider = DnsProvider {
            name: "Test".to_string(),
            ip: "8.8.8.8".to_string(),
            latency: None,
        };
        let json = serde_json::to_string(&provider).unwrap();
        assert!(json.contains("\"latency\":null"));
    }
}
