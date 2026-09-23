FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY SalesDashboard.Api/SalesDashboard.Api.csproj SalesDashboard.Api/
RUN dotnet restore SalesDashboard.Api/SalesDashboard.Api.csproj
COPY SalesDashboard.Api/ SalesDashboard.Api/
RUN dotnet publish SalesDashboard.Api/SalesDashboard.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
# tzdata — IANA-часовые пояса (периоды считаются в поясе браузера); krb5-libs — чтобы Npgsql не ругался на отсутствие GSSAPI.
RUN apk add --no-cache tzdata krb5-libs
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "SalesDashboard.Api.dll"]
