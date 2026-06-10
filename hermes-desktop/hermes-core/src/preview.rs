//! Guards for the file preview pane: size caps and binary detection.

/// Maximum number of bytes returned to the preview pane.
pub const MAX_PREVIEW_BYTES: usize = 512 * 1024;

/// Number of leading bytes inspected when sniffing for binary content.
const SNIFF_BYTES: usize = 8 * 1024;

/// A file is treated as binary if its leading bytes contain a NUL or are not
/// valid UTF-8.
pub fn is_binary(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(SNIFF_BYTES)];
    if head.contains(&0) {
        return true;
    }

    match std::str::from_utf8(head) {
        Ok(_) => false,
        // A multi-byte sequence may be split at the sniff boundary; only the
        // tail may be incomplete, anything earlier means real invalid UTF-8.
        Err(error) => head.len() - error.valid_up_to() > 3,
    }
}

/// Truncate to at most `max_bytes` without splitting a UTF-8 sequence.
/// Returns the truncated string and whether truncation occurred.
pub fn truncate_utf8(content: &str, max_bytes: usize) -> (&str, bool) {
    if content.len() <= max_bytes {
        return (content, false);
    }

    let mut end = max_bytes;
    while end > 0 && !content.is_char_boundary(end) {
        end -= 1;
    }

    (&content[..end], true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text_is_not_binary() {
        assert!(!is_binary(b"fn main() {}\n"));
        assert!(!is_binary("héllo wörld".as_bytes()));
        assert!(!is_binary(b""));
    }

    #[test]
    fn nul_bytes_are_binary() {
        assert!(is_binary(b"\x00\x01\x02"));
        assert!(is_binary(b"PK\x03\x04\x00rest-of-zip"));
    }

    #[test]
    fn invalid_utf8_is_binary() {
        assert!(is_binary(&[0xff, 0xfe, 0x41, 0x42]));
    }

    #[test]
    fn multibyte_char_split_at_sniff_boundary_is_not_binary() {
        // 8 KiB of 'a' followed by a multi-byte char straddling the boundary.
        let mut bytes = vec![b'a'; 8 * 1024 - 1];
        bytes.extend_from_slice("é".as_bytes());
        assert!(!is_binary(&bytes));
    }

    #[test]
    fn truncate_returns_original_when_small() {
        let (out, truncated) = truncate_utf8("hello", 100);
        assert_eq!(out, "hello");
        assert!(!truncated);
    }

    #[test]
    fn truncate_respects_char_boundaries() {
        // "éé" is 4 bytes; a 3-byte cap must cut back to the first char.
        let (out, truncated) = truncate_utf8("éé", 3);
        assert_eq!(out, "é");
        assert!(truncated);
    }

    #[test]
    fn truncate_exact_boundary() {
        let (out, truncated) = truncate_utf8("abcd", 4);
        assert_eq!(out, "abcd");
        assert!(!truncated);
    }
}
