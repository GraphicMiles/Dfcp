//! Simple 6-bit checksum

pub fn checksum_of(bytes: &[u8]) -> u16 {
    let mut s: u16 = 0;
    for &b in bytes {
        s = (s + b as u16) & 0x3f;
    }
    s
}

pub fn verify_checksum(bytes: &[u8], expected: u16) -> bool {
    checksum_of(bytes) == expected
}
