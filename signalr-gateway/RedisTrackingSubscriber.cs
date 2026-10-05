using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Zigo.TrackingGateway;

public sealed class RedisTrackingSubscriber(
    IConnectionMultiplexer redis,
    IHubContext<TrackingHub> hub,
    IOptions<TrackingOptions> options,
    ILogger<RedisTrackingSubscriber> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var channel = RedisChannel.Literal(options.Value.RedisChannel);
        var subscriber = redis.GetSubscriber();
        await subscriber.SubscribeAsync(channel, async (_, raw) => {
            try {
                var trackingEvent = JsonSerializer.Deserialize<TrackingEvent>(raw!, JsonOptions);
                if (trackingEvent is null || string.IsNullOrWhiteSpace(trackingEvent.BookingId)) return;
                await hub.Clients.Group(TrackingHub.BookingGroup(trackingEvent.BookingId))
                    .SendAsync("tracking.updated", trackingEvent, stoppingToken);
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Unable to relay a tracking event from Redis.");
            }
        });
        await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
    }
}