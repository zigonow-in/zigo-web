function startsWithBytes(buffer, signature) {
    return signature.every((value, index) => buffer[index] === value);
}
function ascii(buffer, start, end) {
    return Buffer.from(buffer.subarray(start, end)).toString("ascii");
}
export function detectMediaMimeType(buffer) {
    if (!buffer.length)
        return "";
    if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        return "image/png";
    if (startsWithBytes(buffer, [0xff, 0xd8, 0xff]))
        return "image/jpeg";
    if (ascii(buffer, 0, 6) === "GIF87a" || ascii(buffer, 0, 6) === "GIF89a")
        return "image/gif";
    if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP")
        return "image/webp";
    if (ascii(buffer, 0, 5) === "%PDF-")
        return "application/pdf";
    if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WAVE")
        return "audio/wav";
    if (ascii(buffer, 0, 4) === "OggS")
        return "audio/ogg";
    if (ascii(buffer, 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
        return "audio/mpeg";
    if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]))
        return "video/webm";
    if (ascii(buffer, 4, 8) === "ftyp") {
        const brand = ascii(buffer, 8, 12).toLowerCase();
        if (brand === "qt  ")
            return "video/quicktime";
        if (brand.startsWith("m4a"))
            return "audio/mp4";
        return "video/mp4";
    }
    const text = Buffer.from(buffer.subarray(0, Math.min(buffer.length, 4096)))
        .toString("utf8")
        .replace(/^\uFEFF/, "")
        .trimStart();
    if (/^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(text))
        return "image/svg+xml";
    return "";
}
export function extensionForMediaMimeType(mimeType) {
    const extensionByMime = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/svg+xml": ".svg",
        "application/pdf": ".pdf",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "audio/wav": ".wav",
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/x-m4a": ".m4a"
    };
    return extensionByMime[mimeType] || "";
}
