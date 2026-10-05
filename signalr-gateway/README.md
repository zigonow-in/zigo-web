# ZIGO Tracking SignalR Gateway

This is a separate ASP.NET Core service for low-latency booking tracking events. The Node application remains the source of truth for bookings, authorization, and GPS persistence.

## Required environment

Set these values on the gateway process. `JWT_SECRET` and `REDIS_URL` must match the Node application. `TRACKING_GATEWAY_INTERNAL_TOKEN` must be a new random secret shared only between the Node app and this gateway.

```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5100
JWT_SECRET=<same value used by Node>
REDIS_URL=<same Redis URL used by Node>
TRACKING_GATEWAY_INTERNAL_TOKEN=<minimum 32 character random secret>
Tracking__NodeApiBaseUrl=http://127.0.0.1:4003
Tracking__AllowedOrigins=https://zigonow.in
Tracking__RedisChannel=zigo:tracking-events
```

Also set `TRACKING_GATEWAY_INTERNAL_TOKEN` to the same value in the Node application's `.env`.

## Build and run

```powershell
dotnet restore
dotnet publish -c Release -o publish
dotnet publish\Zigo.TrackingGateway.dll
```

The health check is available at `GET /health`. The SignalR hub endpoint is `/hubs/tracking` and requires a customer or assistant portal access token.

## Nginx

Proxy `/admin/tracking/` to `http://127.0.0.1:5100/`, including WebSocket upgrade headers. Do not expose the Node internal authorization endpoint publicly through Nginx.

```nginx
location /admin/tracking/ {
    proxy_pass http://127.0.0.1:5100/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90s;
}
```

## Event contract

Node publishes persisted assistant pings to Redis channel `zigo:tracking-events`.
The gateway broadcasts `tracking.updated` only to the authorized `booking:{bookingId}` SignalR group.

The next phase connects the customer and assistant portal clients to this hub and updates the live map in place.