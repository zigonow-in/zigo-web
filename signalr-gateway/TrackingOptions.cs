namespace Zigo.TrackingGateway;

public sealed class TrackingOptions
{
    public string RedisChannel { get; init; } = "zigo:tracking-events";
    public string NodeApiBaseUrl { get; init; } = "http://127.0.0.1:4003";
    public string AllowedOrigins { get; init; } = "";
}

public sealed record TrackingEvent(
    string Id,
    string Type,
    string BookingId,
    string AssistantId,
    object Payload,
    DateTimeOffset CreatedAt);