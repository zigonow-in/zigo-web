using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using Zigo.TrackingGateway;

var builder = WebApplication.CreateBuilder(args);
var jwtSecret = RequireSetting("JWT_SECRET");
var redisUrl = RequireSetting("REDIS_URL");
var internalToken = RequireSetting("TRACKING_GATEWAY_INTERNAL_TOKEN");
var allowedOrigins = (builder.Configuration["Tracking:AllowedOrigins"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
if (allowedOrigins.Length == 0) throw new InvalidOperationException("Tracking:AllowedOrigins is required.");

JwtSecurityTokenHandler.DefaultMapInboundClaims = false;
builder.Services.Configure<TrackingOptions>(builder.Configuration.GetSection("Tracking"));
builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisUrl));
builder.Services.AddHttpClient("node-api", client => {
    client.BaseAddress = new Uri(builder.Configuration["Tracking:NodeApiBaseUrl"] ?? "http://127.0.0.1:4003");
    client.Timeout = TimeSpan.FromSeconds(5);
    client.DefaultRequestHeaders.Add("x-zigo-tracking-gateway", internalToken);
});
builder.Services.AddCors(options => options.AddPolicy("tracking", policy => policy
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.RequireHttpsMetadata = true;
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256]
        };
        options.Events = new JwtBearerEvents {
            OnMessageReceived = context => {
                if (context.HttpContext.Request.Path.StartsWithSegments("/hubs/tracking")) {
                    context.Token = context.Request.Query["access_token"];
                }
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddSignalR(options => {
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 16 * 1024;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(45);
});
builder.Services.AddHostedService<RedisTrackingSubscriber>();

var app = builder.Build();
app.UseRouting();
app.UseCors("tracking");
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", async (IConnectionMultiplexer redis) => {
    try {
        var endpoint = redis.GetEndPoints().FirstOrDefault();
        if (endpoint is null) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        await redis.GetServer(endpoint).PingAsync().WaitAsync(TimeSpan.FromSeconds(2));
        return Results.Ok(new { status = "ok" });
    } catch {
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
});
app.MapHub<TrackingHub>("/hubs/tracking").RequireAuthorization();
app.Run();

static string RequireSetting(string key) => Environment.GetEnvironmentVariable(key)
    ?? throw new InvalidOperationException($"{key} is required for the tracking gateway.");