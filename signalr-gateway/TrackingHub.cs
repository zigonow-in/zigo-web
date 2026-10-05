using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Zigo.TrackingGateway;

[Authorize]
public sealed class TrackingHub(IHttpClientFactory httpClientFactory, ILogger<TrackingHub> logger) : Hub
{
    public async Task JoinBooking(string bookingId)
    {
        if (!Guid.TryParse(bookingId, out _)) throw new HubException("Invalid booking.");
        var accessToken = Context.GetHttpContext()?.Request.Query["access_token"].ToString();
        if (string.IsNullOrWhiteSpace(accessToken)) throw new HubException("Authentication is required.");

        var client = httpClientFactory.CreateClient("node-api");
        var response = await client.PostAsJsonAsync("/portal/internal/tracking/authorize", new { bookingId, accessToken }, Context.ConnectionAborted);
        if (!response.IsSuccessStatusCode) {
            logger.LogWarning("Denied tracking subscription for connection {ConnectionId}, booking {BookingId}.", Context.ConnectionId, bookingId);
            throw new HubException("Booking access denied.");
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, BookingGroup(bookingId), Context.ConnectionAborted);
    }

    public Task LeaveBooking(string bookingId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, BookingGroup(bookingId), Context.ConnectionAborted);

    internal static string BookingGroup(string bookingId) => $"booking:{bookingId}";
}