use regex::Regex;
use std::net::IpAddr;

const HOST_REGEX: &str = r"^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$";

pub fn validate_host(host: &str) -> Result<String, String> {
    let trimmed = host.trim();
    if trimmed.is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    if trimmed.len() > 253 {
        return Err("Host name too long".to_string());
    }
    let re = Regex::new(HOST_REGEX).map_err(|e| format!("Regex error: {}", e))?;
    if !re.is_match(trimmed) {
        return Err("Invalid host format".to_string());
    }
    if let Ok(ip) = trimmed.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err(format!("Cannot ping private/internal IP: {}", ip));
        }
    }
    Ok(trimmed.to_string())
}

fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            octets[0] == 127
            || octets[0] == 10
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] == 192 && octets[1] == 168)
            || (octets[0] == 169 && octets[1] == 254)
        }
        IpAddr::V6(_) => false,
    }
}

pub fn clamp_count(count: u32, min: u32, max: u32) -> u32 {
    count.max(min).min(max)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_host() {
        assert!(validate_host("cloudflare.com").is_ok());
        assert!(validate_host("1.1.1.1").is_ok());
        assert!(validate_host("8.8.8.8").is_ok());
    }

    #[test]
    fn test_invalid_host() {
        assert!(validate_host("").is_err());
        assert!(validate_host("host with spaces").is_err());
        assert!(validate_host("127.0.0.1").is_err());
        assert!(validate_host("10.0.0.1").is_err());
        assert!(validate_host("192.168.1.1").is_err());
    }
}